/**
 * Production worker (Netlify background function, up to 15 minutes).
 * Writes the script with the Claude API, saves it with captions, runs the compliance check and,
 * for "full" jobs, renders the deliverable with the style's production template. Every stage is
 * written to production_jobs so the dashboard shows real progress.
 */
import { makeDb } from '../lib/mcp-server';
import { friendlyApiError, writeScript } from '../lib/generator';
import { SERVER_RENDERERS } from '../lib/render';
import { complianceCheck } from '../../src/lib/script';
import type { ContentType } from '../../src/lib/types';

type Step = { name: string; status: string; at: string; detail?: string };

export default async (req: Request) => {
  let body: { jobId?: string; token?: string; mode?: string };
  try { body = await req.json(); } catch { return; }
  const db = makeDb(body.token ?? '');
  const { data: u } = await db.auth.getUser(body.token ?? '');
  if (!u?.user || !body.jobId) return;

  const { data: job } = await db.from('production_jobs').select('*').eq('id', body.jobId).maybeSingle();
  if (!job || job.status !== 'queued') return;
  const steps: Step[] = Array.isArray(job.steps) ? job.steps : [];
  const update = async (patch: Record<string, unknown>, step?: Step) => {
    if (step) steps.push(step);
    await db.from('production_jobs').update({ ...patch, steps }).eq('id', job.id);
  };
  const now = () => new Date().toISOString();

  try {
    const { data: item } = await db.from('content_items').select('*').eq('id', job.item_id).single();
    const { data: style } = job.style_id ? await db.from('styles').select('*').eq('id', job.style_id).maybeSingle() : { data: null };

    await update({ status: 'running', stage: 'Writing the script with Claude', progress: 15 }, { name: 'Researching the topic and writing the script', status: 'running', at: now() });
    const script = await writeScript({
      type: item.type as ContentType, topic: item.topic || item.title, audience: item.audience, objective: item.objective, note: item.request_note,
      style: style ? { name: style.name, description: style.description, spec: style.spec ?? [], execution_config: style.execution_config } : null,
    });
    steps[steps.length - 1].status = 'done';

    const { data: last } = await db.from('scripts').select('version').eq('item_id', item.id).order('version', { ascending: false }).limit(1);
    const version = ((last ?? [])[0]?.version ?? 0) + 1;
    const units = script.sections.map((s) => ({ label: s.label, tc: s.timing, vo: s.voiceover, on: s.on_screen, vis: s.visual }));
    const ins = await db.from('scripts').insert({ item_id: item.id, version, title: script.title, length_label: script.length, units, source: 'claude', created_by: u.user.id });
    if (ins.error) throw new Error(`Saving the script failed: ${ins.error.message}`);
    for (const [platform, text] of Object.entries(script.captions)) {
      await db.from('captions').upsert({ item_id: item.id, platform, body: text, updated_at: now() });
    }
    const checks = complianceCheck(script.title, units);
    const passed = checks.every((c) => c.ok);
    await update({ stage: 'Script saved', progress: 55 }, { name: `Script v${version} saved, compliance check ${passed ? 'passed' : 'needs changes'}`, status: passed ? 'done' : 'warning', at: now(), detail: passed ? undefined : checks.filter((c) => !c.ok).map((c) => c.msg).join(' ') });
    await db.rpc('log_claude_activity', { p_message: `wrote script v${version} for “${item.title}” (Claude API)`, p_item_id: item.id });

    if (body.mode === 'full' && style?.template_kind && SERVER_RENDERERS[style.template_kind]) {
      await update({ stage: 'Rendering', progress: 60 }, { name: `Rendering with “${style.name}”`, status: 'running', at: now() });
      const { assetId } = await SERVER_RENDERERS[style.template_kind]({
        db, userId: u.user.id, item: { id: item.id, title: item.title, type: item.type }, style, script,
        progress: (stage, pct) => update({ stage, progress: Math.min(95, Math.max(60, pct)) }),
      });
      steps[steps.length - 1].status = 'done';
      await update({ result_asset_id: assetId, stage: 'Saved to the Asset Library', progress: 98 }, { name: 'Saved to the Asset Library', status: 'done', at: now() });
      await db.from('content_items').update({ status: 'in_review' }).eq('id', item.id);
    }
    await update({ status: 'succeeded', stage: body.mode === 'full' ? 'Ready for review' : 'Script ready', progress: 100 }, { name: 'Finished', status: 'done', at: now() });
  } catch (e) {
    const msg = friendlyApiError(e);
    if (steps.length) steps[steps.length - 1].status = 'failed';
    await update({ status: 'failed', error: msg, stage: 'Failed' }, { name: 'Stopped', status: 'failed', at: now(), detail: msg });
  }
};
