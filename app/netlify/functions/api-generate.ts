import { json, origin, preflight } from '../lib/common';
import { makeDb } from '../lib/mcp-server';
import { claudeApiConfigured } from '../lib/generator';
import { SERVER_RENDERERS } from '../lib/render';

/**
 * Starts generating a content item. Runs as the signed-in person (database rules apply).
 * With a Claude API key: hands the work to the background worker and returns at once.
 * Without one: puts the item in the Claude queue, so a teammate with Claude writes it through the connector.
 */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const token = (req.headers.get('authorization') ?? '').replace(/^bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Sign in first.' }, 401);
  const db = makeDb(token);
  const { data: u, error: ue } = await db.auth.getUser(token);
  if (ue || !u.user) return json({ error: 'Your session expired. Sign in again.' }, 401);

  let body: { itemId?: string; mode?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const mode = body.mode === 'full' ? 'full' : 'script';
  const { data: item } = await db.from('content_items').select('id,title,style_id,request_note').eq('id', body.itemId ?? '').maybeSingle();
  if (!item) return json({ error: 'Content item not found, or your role can’t see it.' }, 404);

  let style: { id: string; template_kind: string | null; status: string; active: boolean } | null = null;
  if (item.style_id) {
    const { data } = await db.from('styles').select('id,template_kind,status,active').eq('id', item.style_id).maybeSingle();
    style = data;
  }
  if (mode === 'full') {
    if (!style || style.status !== 'approved' || !style.active) return json({ error: 'Choose an approved style first.' }, 400);
    if (!style.template_kind || !SERVER_RENDERERS[style.template_kind]) return json({ error: 'This style’s production template isn’t built yet, so it can’t generate the finished file.' }, 400);
  }

  const api = claudeApiConfigured();
  const { data: job, error: je } = await db.from('production_jobs').insert({
    item_id: item.id, style_id: style?.id ?? null, created_by: u.user.id,
    status: api ? 'queued' : 'waiting_for_claude', engine: api ? 'claude-api' : 'claude-queue',
    stage: api ? 'Starting' : 'Waiting for Claude', progress: api ? 5 : 10,
    steps: [{ name: api ? 'Job created' : 'Sent to the Claude queue', status: 'done', at: new Date().toISOString() }],
  }).select('id').single();
  if (je || !job) return json({ error: `Couldn’t start the job: ${je?.message ?? 'unknown error'}` }, 400);

  if (!api) {
    const { error } = await db.from('content_items').update({ needs_script: true, requested_by: u.user.id }).eq('id', item.id);
    if (error) return json({ error: `Couldn’t add it to the Claude queue: ${error.message}` }, 400);
    await db.rpc('log_claude_activity', { p_message: `sent “${item.title}” to the Claude queue`, p_item_id: item.id });
    return json({ jobId: job.id, engine: 'claude-queue' });
  }

  // Background functions return 202 at once and keep running (up to 15 minutes).
  const r = await fetch(`${origin(req)}/.netlify/functions/generate-background`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id, token, mode }),
  }).catch(() => null);
  if (!r || (r.status !== 202 && !r.ok)) {
    await db.from('production_jobs').update({ status: 'failed', error: 'The production worker didn’t start. Try again in a minute.' }).eq('id', job.id);
    return json({ error: 'The production worker didn’t start. Try again in a minute.' }, 502);
  }
  return json({ jobId: job.id, engine: 'claude-api' });
};

export const config = { path: '/api/generate' };
