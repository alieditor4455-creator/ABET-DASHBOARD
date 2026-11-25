/**
 * ABET Content OS MCP server (Streamable HTTP, stateless, JSON responses).
 * Every tool runs as the signed-in person through Supabase, so database permissions apply.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './common';
import { complianceCheck, makeCaption } from '../../src/lib/script';
import { HANDLES, PLAT, REG_LINE, RISK_FULL, RISK_SHORT, STATUS_LABEL, TYPES, TYPE_KEYS } from '../../src/lib/constants';
import type { ContentType, Platform, ScriptUnit, Status } from '../../src/lib/types';

export const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

type Json = Record<string, unknown>;
interface Ctx { db: SupabaseClient; userId: string; appUrl: string }
interface Tool { name: string; title: string; description: string; inputSchema: Json; annotations?: Json; run: (args: Json, ctx: Ctx) => Promise<unknown> }

const str = (d: string, extra: Json = {}) => ({ type: 'string', description: d, ...extra });
const uuid = (d: string) => str(d, { format: 'uuid' });
const typeEnum = { type: 'string', enum: TYPE_KEYS, description: `Format: ${TYPE_KEYS.map((k) => `${k} = ${TYPES[k].name}`).join(', ')}` };
const PLATS = Object.keys(PLAT) as Platform[];

class ToolError extends Error {}
const must = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (r.error) {
    const m = r.error.message;
    if (/row-level security|permission denied/i.test(m)) throw new ToolError(`Your ABET role doesn’t allow this (${what}). Ask an admin if you need access.`);
    throw new ToolError(`${what} failed: ${m}`);
  }
  return r.data as T;
};
const link = (ctx: Ctx, id: string) => `${ctx.appUrl}/studio/${id}`;
const log = (ctx: Ctx, message: string, itemId?: string) => ctx.db.rpc('log_claude_activity', { p_message: message, p_item_id: itemId ?? null });

async function getItem(ctx: Ctx, id: string) {
  const r = await ctx.db.from('content_items').select('*').eq('id', id).maybeSingle();
  const it = must(r, 'Reading the content item') as Json | null;
  if (!it) throw new ToolError(`No content item with id ${id}. Use list_content to find the right id.`);
  return it;
}

export const TOOLS: Tool[] = [
  {
    name: 'get_brand_kit', title: 'Get ABET brand kit and compliance rules',
    description: 'Returns ABET Global’s brand voice, colours, fonts, mandatory risk warnings and content compliance rules. Read this before writing any script, caption or design brief.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
    run: async () => ({
      company: 'ABET Global (abetglobal.com): multi-asset broker for forex, gold, oil, indices and crypto CFDs on MetaTrader 5.',
      tone: ['Clear and plain: short sentences, explain trading terms simply.', 'Reassuring, never promising: talk about learning, safety, transparency and support; never profits.', 'Global: plain English for clients in many countries.'],
      compliance_rules: [
        'Never promise or imply returns: no “guaranteed”, “risk-free”, “easy money”, “can’t lose”.',
        'Every video ends with the risk warning on screen and in the caption.',
        'Label all example prices and charts “illustrative example”. Never quote live prices.',
        'Do not claim regulation or licences beyond: ' + REG_LINE,
        'ABET is execution-only: do not give advice or recommendations to buy or sell.',
        'Demo-account content may say “no real funds needed”, never “risk-free trading”.',
      ],
      risk_warning_full: RISK_FULL,
      risk_warning_short_for_captions: RISK_SHORT,
      colours: { abet_red: '#AE1818', red_pressed: '#8C1313', logo_red: '#BC202E', ink: '#191B22', logo_ink: '#231F20', light: '#F8F9FA' },
      fonts: { headings: 'Space Grotesk', body: 'Poppins', secondary: 'Montserrat' },
      social_accounts: HANDLES,
      formats: Object.fromEntries(TYPE_KEYS.map((k) => [k, `${TYPES[k].name} (${TYPES[k].meta})`])),
    }),
  },
  {
    name: 'list_styles', title: 'List creative styles',
    description: 'Lists ABET’s approved, active creative styles for a content category, with their creative specifications. Styles come only from ABET’s own references; never invent one.',
    inputSchema: { type: 'object', properties: { category: typeEnum } },
    annotations: { readOnlyHint: true },
    run: async (a, ctx) => {
      let q = ctx.db.from('styles').select('id,content_type,name,description,spec,output_formats').eq('archived', false).eq('status', 'approved').eq('active', true).order('content_type');
      if (a.category) q = q.eq('content_type', a.category as string);
      const rows = must(await q, 'Listing styles') as Json[];
      return rows.length ? rows : { styles: [], note: 'No approved styles yet for this category. Write a style-neutral script.' };
    },
  },
  {
    name: 'get_claude_queue', title: 'Get the Claude queue',
    description: 'Lists content items the team has sent to the Claude queue because they need a script written. For each one, read get_brand_kit (once), write the script for its format and topic, following the request note, and save it with save_script. Saving clears it from the queue and notifies the requester.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
    run: async (_a, ctx) => {
      const rows = must(await ctx.db.from('content_items').select('id,title,topic,type,audience,objective,request_note,requested_by,style_id,created_at').eq('needs_script', true).order('created_at'), 'Reading the queue') as Json[];
      const ids = [...new Set(rows.map((r) => r.requested_by).filter(Boolean))] as string[];
      const people = ids.length ? (must(await ctx.db.from('profiles').select('id,full_name').in('id', ids), 'Reading names') as Json[]) : [];
      return {
        count: rows.length,
        items: rows.map((r) => ({ ...r, format: TYPES[r.type as ContentType]?.name, requested_by_name: people.find((p) => p.id === r.requested_by)?.full_name ?? null, link: link(ctx, r.id as string) })),
        next: rows.length ? 'Write and save a script for each item with save_script.' : 'The queue is empty.',
      };
    },
  },
  {
    name: 'add_comment', title: 'Comment on a content item',
    description: 'Adds a comment to a content item, for example to explain choices in a script or flag something for the reviewer. The owner and other commenters are notified.',
    inputSchema: { type: 'object', properties: { item_id: uuid('Content item id'), comment: str('The comment text') }, required: ['item_id', 'comment'] },
    run: async (a, ctx) => {
      const it = await getItem(ctx, a.item_id as string);
      must(await ctx.db.from('comments').insert({ item_id: it.id, body: String(a.comment).slice(0, 4000), author_id: ctx.userId, via: 'claude' }), 'Adding the comment');
      return { ok: true, link: link(ctx, it.id as string) };
    },
  },
  {
    name: 'list_content', title: 'List content items',
    description: 'Lists content items in ABET Content OS, newest first. Use it to find an item’s id.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: Object.keys(STATUS_LABEL) }, type: typeEnum, search: str('Words in the title'), limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } } },
    annotations: { readOnlyHint: true },
    run: async (a, ctx) => {
      let q = ctx.db.from('content_items').select('id,title,type,status,style_id,owner_id,scheduled_at,compliance_note,updated_at').order('updated_at', { ascending: false }).limit(Number(a.limit ?? 20));
      if (a.status) q = q.eq('status', a.status as string);
      if (a.type) q = q.eq('type', a.type as string);
      if (a.search) q = q.ilike('title', `%${String(a.search).replace(/[%_]/g, '')}%`);
      const rows = must(await q, 'Listing content') as Json[];
      return rows.map((r) => ({ ...r, link: link(ctx, r.id as string) }));
    },
  },
  {
    name: 'get_content', title: 'Get a content item',
    description: 'Returns one content item with its latest script, style and captions.',
    inputSchema: { type: 'object', properties: { item_id: uuid('Content item id') }, required: ['item_id'] }, annotations: { readOnlyHint: true },
    run: async (a, ctx) => {
      const it = await getItem(ctx, a.item_id as string);
      const [scripts, style, caps, comments] = await Promise.all([
        ctx.db.from('scripts').select('version,title,length_label,units,source,approved_at,created_at').eq('item_id', it.id as string).order('version', { ascending: false }).limit(1),
        it.style_id ? ctx.db.from('styles').select('name,category,spec').eq('id', it.style_id as string).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ctx.db.from('captions').select('platform,body').eq('item_id', it.id as string),
        ctx.db.from('comments').select('body,via,created_at').eq('item_id', it.id as string).order('created_at').limit(30),
      ]);
      return { ...it, link: link(ctx, it.id as string), latest_script: (scripts.data ?? [])[0] ?? null, style: style.data, captions: caps.data ?? [], comments: comments.data ?? [] };
    },
  },
  {
    name: 'create_content', title: 'Create a content item',
    description: 'Creates a new draft content item in ABET Content OS (owned by the signed-in person). Then save a script to it with save_script.',
    inputSchema: { type: 'object', properties: { title: str('Short title'), topic: str('What it is about'), type: typeEnum, audience: str('Target audience, e.g. Complete beginners'), objective: str('e.g. Education, Awareness, Lead generation') }, required: ['title', 'type'] },
    run: async (a, ctx) => {
      if (!TYPE_KEYS.includes(a.type as ContentType)) throw new ToolError(`Unknown format "${a.type}".`);
      const row = { title: String(a.title).slice(0, 200), topic: String(a.topic ?? a.title), type: a.type, audience: a.audience ?? null, objective: a.objective ?? null, owner_id: ctx.userId, created_by: ctx.userId };
      const it = must(await ctx.db.from('content_items').insert(row).select('id,title,type,status').single(), 'Creating the item') as Json;
      await log(ctx, `created “${it.title}”`, it.id as string);
      return { ...it, link: link(ctx, it.id as string), next: 'Save a script with save_script.' };
    },
  },
  {
    name: 'save_script', title: 'Save a script',
    description: 'Saves a script as a new version on a content item and runs ABET’s automatic compliance check. A person approves it in the dashboard. Split the script into sections (scenes, slides, chapters or PDF sections).',
    inputSchema: {
      type: 'object', required: ['item_id', 'title', 'sections'],
      properties: {
        item_id: uuid('Content item id'), title: str('Script title'), length: str('e.g. 45 seconds, 7 slides, 12 pages'),
        sections: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'object', required: ['label', 'voiceover'], properties: {
          label: str('Section name, e.g. Hook, Scene 2, Slide 3'), timing: str('e.g. 0:00–0:03'), voiceover: str('What is said or written (main copy)'),
          on_screen: str('On-screen text'), visual: str('Visual or editing direction') } } },
      },
    },
    run: async (a, ctx) => {
      const it = await getItem(ctx, a.item_id as string);
      const units: ScriptUnit[] = (a.sections as Json[]).map((s) => ({ label: String(s.label ?? ''), tc: String(s.timing ?? ''), vo: String(s.voiceover ?? ''), on: String(s.on_screen ?? ''), vis: String(s.visual ?? '') }));
      const last = must(await ctx.db.from('scripts').select('version').eq('item_id', it.id as string).order('version', { ascending: false }).limit(1), 'Reading versions') as { version: number }[];
      const version = (last[0]?.version ?? 0) + 1;
      must(await ctx.db.from('scripts').insert({ item_id: it.id, version, title: String(a.title), length_label: a.length ?? null, units, source: 'claude', created_by: ctx.userId }), 'Saving the script');
      await log(ctx, `saved script version ${version} for “${it.title}”`, it.id as string);
      const checks = complianceCheck(String(a.title), units);
      return { saved: true, version, link: `${link(ctx, it.id as string)}?step=script`, compliance_check: checks, compliance_passed: checks.every((c) => c.ok), note: checks.every((c) => c.ok) ? 'Ask the team to review and approve it in the dashboard.' : 'Fix the failed checks and save a new version.' };
    },
  },
  {
    name: 'set_style', title: 'Set the creative style',
    description: 'Sets the creative style of a content item, by style id or exact style name (see list_styles).',
    inputSchema: { type: 'object', properties: { item_id: uuid('Content item id'), style: str('Style id or exact name') }, required: ['item_id', 'style'] },
    run: async (a, ctx) => {
      const it = await getItem(ctx, a.item_id as string);
      const s = String(a.style);
      const isId = /^[0-9a-f-]{36}$/i.test(s);
      const st = must(await (isId ? ctx.db.from('styles').select('id,name').eq('id', s) : ctx.db.from('styles').select('id,name').ilike('name', s)).limit(1), 'Finding the style') as Json[];
      if (!st[0]) throw new ToolError(`No style called "${s}". Use list_styles.`);
      must(await ctx.db.from('content_items').update({ style_id: st[0].id }).eq('id', it.id as string), 'Setting the style');
      await log(ctx, `set the style of “${it.title}” to ${st[0].name}`, it.id as string);
      return { ok: true, style: st[0].name, link: link(ctx, it.id as string) };
    },
  },
  {
    name: 'save_captions', title: 'Save platform captions',
    description: 'Saves social captions for a content item, one per platform (IG, FB, YT, TT, LI, X). Each must include the short risk warning; X is limited to 280 characters.',
    inputSchema: { type: 'object', required: ['item_id', 'captions'], properties: { item_id: uuid('Content item id'), captions: { type: 'object', description: 'Platform code to caption text', properties: Object.fromEntries(PLATS.map((p) => [p, str(`${PLAT[p]} caption`)])) } } },
    run: async (a, ctx) => {
      const it = await getItem(ctx, a.item_id as string);
      const caps = a.captions as Record<string, string>;
      const out: Json[] = [];
      for (const p of PLATS) {
        if (!caps?.[p]) continue;
        const body = String(caps[p]);
        must(await ctx.db.from('captions').upsert({ item_id: it.id, platform: p, body, updated_at: new Date().toISOString() }), `Saving the ${PLAT[p]} caption`);
        out.push({ platform: p, length: body.length, has_risk_warning: /risk/i.test(body), suggestion_if_missing: /risk/i.test(body) ? undefined : makeCaption(p, String(it.title)) });
      }
      await log(ctx, `saved captions for “${it.title}”`, it.id as string);
      return { saved: out, link: `${link(ctx, it.id as string)}?step=publish` };
    },
  },
  {
    name: 'update_status', title: 'Move a content item to another stage',
    description: 'Moves a content item through the workflow: draft → in_production → in_review. Approval and publishing are done by people in the dashboard.',
    inputSchema: { type: 'object', properties: { item_id: uuid('Content item id'), status: { type: 'string', enum: ['draft', 'in_production', 'in_review'] } }, required: ['item_id', 'status'] },
    run: async (a, ctx) => {
      const st = a.status as Status;
      if (!['draft', 'in_production', 'in_review'].includes(st)) throw new ToolError('Claude can only move items to draft, in_production or in_review. People approve and publish in the dashboard.');
      const it = await getItem(ctx, a.item_id as string);
      must(await ctx.db.from('content_items').update({ status: st }).eq('id', it.id as string), 'Changing the status');
      await log(ctx, `moved “${it.title}” to ${STATUS_LABEL[st]}`, it.id as string);
      return { ok: true, status: STATUS_LABEL[st], link: link(ctx, it.id as string) };
    },
  },
  {
    name: 'get_calendar', title: 'Get the content calendar',
    description: 'Lists scheduled and published content between two dates (default: the next 14 days), to help plan what to make next.',
    inputSchema: { type: 'object', properties: { from: str('Start date, YYYY-MM-DD'), to: str('End date, YYYY-MM-DD') } }, annotations: { readOnlyHint: true },
    run: async (a, ctx) => {
      const from = a.from ? new Date(String(a.from)) : new Date();
      const to = a.to ? new Date(String(a.to)) : new Date(Date.now() + 14 * 86400000);
      const rows = must(await ctx.db.from('content_items').select('id,title,type,platforms,scheduled_at,published_at').gte('scheduled_at', from.toISOString()).lte('scheduled_at', to.toISOString()).order('scheduled_at'), 'Reading the calendar') as Json[];
      const approved = must(await ctx.db.from('content_items').select('id,title,type').eq('status', 'approved').is('scheduled_at', null), 'Reading approved content') as Json[];
      return { scheduled: rows, approved_but_unscheduled: approved, range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } };
    },
  },

  // ---------------------------------------------------------------- Claude video worker
  {
    name: 'get_video_queue', title: 'Get the video queue',
    description: 'Lists videos, carousels, PDFs and ads the team requested in the dashboard and is waiting for Claude to make. Making them needs Claude Code with the ABET-DASHBOARD repository (skill: abet-video-worker). For each request: claim_video_job, write and save the script, render the file with video/render.mjs, upload it with get_upload_url, then complete_video_job.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
    run: async (_a, ctx) => {
      const rows = must(await ctx.db.rpc('video_queue'), 'Reading the video queue') as Json[];
      return { count: rows.length, requests: rows, next: rows.length ? 'Claim the oldest request with claim_video_job.' : 'The video queue is empty. Nothing to do.' };
    },
  },
  {
    name: 'claim_video_job', title: 'Claim a video request',
    description: 'Claims one request from the video queue so no other Claude makes it too, and returns the full brief: topic, format, style (template and settings), shape, length and notes. The dashboard shows “Claude is writing the script”.',
    inputSchema: { type: 'object', required: ['job_id'], properties: { job_id: uuid('Request id (job_id) from get_video_queue'), worker: str('Who is making it, e.g. "Claude Code (scheduled)"') } },
    run: async (a, ctx) => {
      const brief = must(await ctx.db.rpc('claim_video_job', { p_job: a.job_id, p_worker: a.worker ? String(a.worker).slice(0, 80) : 'Claude' }), 'Claiming the request') as Json;
      await log(ctx, `started making “${(brief.item as Json)?.title ?? 'a request'}”`, (brief.item as Json)?.id as string);
      return { ...brief, link: link(ctx, (brief.item as Json).id as string), next: 'Call get_brand_kit, write the script and save it with save_script, write the scene plan (video/PLAN.md), preview, render, upload, then complete_video_job. Report progress with report_video_progress.' };
    },
  },
  {
    name: 'report_video_progress', title: 'Report video progress',
    description: 'Updates the progress the requester sees in the dashboard while you make a claimed request, e.g. stage "Rendering the video", progress 60.',
    inputSchema: { type: 'object', required: ['job_id', 'stage', 'progress'], properties: { job_id: uuid('Claimed request id'), stage: str('Short stage shown in the dashboard'), progress: { type: 'integer', minimum: 0, maximum: 95 }, step: str('Optional finished step to add to the log') } },
    run: async (a, ctx) => {
      must(await ctx.db.rpc('video_job_progress', { p_job: a.job_id, p_stage: String(a.stage), p_progress: Number(a.progress), p_step: a.step ? String(a.step) : null }), 'Updating progress');
      return { ok: true };
    },
  },
  {
    name: 'get_upload_url', title: 'Get a secure upload link',
    description: 'Returns a one-time link to upload a finished file for a claimed request. Upload with: curl -sS -X PUT -H "Content-Type: <type>" --data-binary @<file> "<upload_url>". Then pass the returned path to complete_video_job. Files up to 50 MB.',
    inputSchema: { type: 'object', required: ['job_id', 'file_name'], properties: { job_id: uuid('Claimed request id'), file_name: str('File name, e.g. how-abet-works-16x9.mp4, slide-01.png, guide.pdf') } },
    run: async (a, ctx) => {
      const job = must(await ctx.db.from('production_jobs').select('id,status,claimed_by,kind').eq('id', a.job_id as string).maybeSingle(), 'Reading the request') as Json | null;
      if (!job || job.kind !== 'video' || job.status !== 'running' || job.claimed_by !== ctx.userId) throw new ToolError('Claim this request with claim_video_job first.');
      const safe = String(a.file_name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'file';
      if (!/\.(mp4|png|jpg|jpeg|pdf)$/.test(safe)) throw new ToolError('Use a .mp4, .png, .jpg or .pdf file name.');
      const p = `jobs/${job.id}/${safe}`;
      const r = await ctx.db.storage.from('content').createSignedUploadUrl(p);
      if (r.error || !r.data) throw new ToolError(`Couldn’t create the upload link: ${r.error?.message ?? 'unknown error'}`);
      const type = safe.endsWith('.mp4') ? 'video/mp4' : safe.endsWith('.pdf') ? 'application/pdf' : safe.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return { upload_url: r.data.signedUrl, path: p, content_type: type, method: 'PUT', example: `curl -sS -X PUT -H "Content-Type: ${type}" --data-binary @${safe} "${r.data.signedUrl}"` };
    },
  },
  {
    name: 'complete_video_job', title: 'Finish a video request',
    description: 'Marks a claimed request as done after the files are uploaded. Saves each file to the Asset Library, moves the item to In review and notifies the requester. kind is Video for MP4, Graphic for PNG/JPG, PDF for PDF.',
    inputSchema: { type: 'object', required: ['job_id', 'files'], properties: {
      job_id: uuid('Claimed request id'), note: str('Short note for the reviewer, e.g. "16:9, 62 seconds, captions on"'),
      files: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', required: ['path', 'kind'], properties: { path: str('Path returned by get_upload_url'), name: str('Display name in the Asset Library'), kind: { type: 'string', enum: ['Video', 'Graphic', 'PDF'] } } } },
    } },
    run: async (a, ctx) => {
      const r = must(await ctx.db.rpc('complete_video_job', { p_job: a.job_id, p_files: a.files, p_note: a.note ? String(a.note).slice(0, 300) : null }), 'Finishing the request') as Json;
      return { ...r, link: `${link(ctx, r.item_id as string)}?step=review`, next: 'Done. The requester reviews and approves it in the dashboard.' };
    },
  },
  {
    name: 'get_reference_files', title: 'Download reference files',
    description: 'Returns short-lived download links for reference files (videos, images, PDFs) by reference id, as listed in a video brief ("references") or a style request. Download with curl -sSL -o <file> "<url>", then look at frames (ffmpeg) or images. Link-only references return the link, which may not be reachable.',
    inputSchema: { type: 'object', required: ['reference_ids'], properties: { reference_ids: { type: 'array', items: uuid('Reference id'), minItems: 1, maxItems: 12 } } }, annotations: { readOnlyHint: true },
    run: async (a, ctx) => {
      const refs = must(await ctx.db.from('style_references').select('id,title,notes,url,asset_id').in('id', a.reference_ids as string[]), 'Reading references') as Json[];
      const ids = refs.map((r) => r.asset_id).filter(Boolean) as string[];
      const assets = ids.length ? (must(await ctx.db.from('assets').select('id,name,storage_path,size_bytes').in('id', ids), 'Reading files') as Json[]) : [];
      const out = [];
      for (const r of refs) {
        const f = assets.find((x) => x.id === r.asset_id);
        let download_url: string | null = null;
        if (f) { const u = await ctx.db.storage.from('content').createSignedUrl(f.storage_path as string, 3600); download_url = u.data?.signedUrl ?? null; }
        out.push({ id: r.id, title: r.title, notes: r.notes, link: r.url, file_name: f?.name ?? null, size_bytes: f?.size_bytes ?? null, download_url });
      }
      return { references: out, note: 'Download links expire in 1 hour.' };
    },
  },
  {
    name: 'get_style_requests', title: 'Get style requests',
    description: 'Lists new styles an admin asked Claude to build from the team’s references. For each: download the references (get_reference_files), study them (look, colour, type, layout, motion, pacing), adapt them to the ABET brand (get_brand_kit), express the style as settings for the cinema template (video/PLAN.md, "Style settings"), render a preview, upload it (get_style_upload_url) and save with save_style_draft. An admin approves it in the dashboard.',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
    run: async (_a, ctx) => {
      const rows = must(await ctx.db.rpc('style_requests'), 'Reading style requests') as Json[];
      return { count: rows.length, requests: rows, next: rows.length ? 'Build the oldest request first.' : 'No style requests.' };
    },
  },
  {
    name: 'get_style_upload_url', title: 'Get an upload link for a style preview',
    description: 'One-time link to upload a preview image (PNG/JPG) or short preview video (MP4) for a style request. Upload with curl -sS -X PUT -H "Content-Type: <type>" --data-binary @<file> "<upload_url>", then pass the path to save_style_draft.',
    inputSchema: { type: 'object', required: ['style_id', 'file_name'], properties: { style_id: uuid('Style id from get_style_requests'), file_name: str('e.g. preview.png') } },
    run: async (a, ctx) => {
      const safe = String(a.file_name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'preview.png';
      if (!/\.(png|jpg|jpeg|mp4)$/.test(safe)) throw new ToolError('Use a .png, .jpg or .mp4 file name.');
      const p = `styles/${a.style_id}/${Date.now()}-${safe}`;
      const r = await ctx.db.storage.from('content').createSignedUploadUrl(p);
      if (r.error || !r.data) throw new ToolError(`Couldn’t create the upload link: ${r.error?.message ?? 'unknown error'}`);
      const type = safe.endsWith('.mp4') ? 'video/mp4' : safe.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return { upload_url: r.data.signedUrl, path: p, content_type: type, example: `curl -sS -X PUT -H "Content-Type: ${type}" --data-binary @${safe} "${r.data.signedUrl}"` };
    },
  },
  {
    name: 'save_style_draft', title: 'Save a style built from references',
    description: 'Saves the style you built for a style request: description, creative specifications ([[label, value], …]), template settings (execution_config: template, theme, tokens, outputs, aspects, lengths) and the uploaded preview. The style goes to "pending approval" and the requester is notified.',
    inputSchema: { type: 'object', required: ['style_id', 'description', 'spec', 'execution_config'], properties: {
      style_id: uuid('Style id'), description: str('One or two sentences describing the look'),
      spec: { type: 'array', items: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 }, description: '[["Look","…"],["Typography","…"],["Motion","…"],["Pacing","…"],["Captions","…"]]' },
      execution_config: { type: 'object', description: '{"template":"cinema","theme":"dark","tokens":{…},"outputs":["video"],"aspects":["16:9","9:16"],"lengths":["30 seconds","60–90 seconds"]}' },
      preview_path: str('Path from get_style_upload_url'),
    } },
    run: async (a, ctx) => {
      const r = must(await ctx.db.rpc('save_style_draft', { p_style: a.style_id, p_description: String(a.description), p_spec: a.spec, p_config: a.execution_config, p_preview_path: a.preview_path ?? null }), 'Saving the style') as Json;
      return { ...r, link: `${ctx.appUrl}/styles`, next: 'An admin reviews the preview and clicks Approve and activate.' };
    },
  },
  {
    name: 'fail_video_job', title: 'Report a failed video request',
    description: 'Stops a claimed request and tells the requester why, in plain words (e.g. the topic needs facts you don’t have). Use it instead of leaving a request half-done.',
    inputSchema: { type: 'object', required: ['job_id', 'reason'], properties: { job_id: uuid('Claimed request id'), reason: str('Plain-language reason and what the requester can do') } },
    run: async (a, ctx) => {
      must(await ctx.db.rpc('fail_video_job', { p_job: a.job_id, p_error: String(a.reason) }), 'Reporting the failure');
      return { ok: true };
    },
  },
];

const ok = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

export function makeDb(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
}

/** Handles one JSON-RPC message. Returns null for notifications. */
export async function handleRpc(msg: Json, ctx: Ctx): Promise<Json | null> {
  const { id, method, params } = msg as { id?: unknown; method?: string; params?: Json };
  if (id === undefined || id === null) return null; // notification
  switch (method) {
    case 'initialize': {
      const want = String((params ?? {}).protocolVersion ?? '');
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(want) ? want : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'abet-content-os', title: 'ABET Content OS', version: '1.0.0' },
        instructions: 'ABET Content OS is ABET Global’s content workspace. Call get_brand_kit before writing anything. Save scripts with save_script; people approve and publish in the dashboard. When asked to work through the queue, call get_claude_queue and write a script for each item. Videos, carousels, PDFs and ads requested in the dashboard are in get_video_queue; making them needs Claude Code with the ABET-DASHBOARD repository (skill: abet-video-worker).',
      });
    }
    case 'ping': return ok(id, {});
    case 'tools/list': return ok(id, { tools: TOOLS.map(({ run: _r, ...t }) => t) });
    case 'tools/call': {
      const name = String((params ?? {}).name ?? '');
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return err(id, -32602, `Unknown tool: ${name}`);
      try {
        const out = await tool.run(((params ?? {}).arguments ?? {}) as Json, ctx);
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: Array.isArray(out) ? { items: out } : (out as Json) });
      } catch (e) {
        const m = e instanceof ToolError ? e.message : `Something went wrong: ${(e as Error).message}`;
        return ok(id, { content: [{ type: 'text', text: m }], isError: true });
      }
    }
    case 'resources/list': return ok(id, { resources: [] });
    case 'prompts/list': return ok(id, { prompts: [] });
    default: return err(id, -32601, `Method not found: ${method}`);
  }
}
