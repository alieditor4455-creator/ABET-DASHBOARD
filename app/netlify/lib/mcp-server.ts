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
    description: 'Lists ABET’s creative styles (video editing, motion graphics, graphic design, ads, PDF templates) with their specifications.',
    inputSchema: { type: 'object', properties: { category: { type: 'string', enum: ['video', 'motion', 'graphic', 'ad', 'pdf'], description: 'Optional filter' } } },
    annotations: { readOnlyHint: true },
    run: async (a, ctx) => {
      let q = ctx.db.from('styles').select('id,category,name,description,complexity,spec').eq('archived', false).order('category');
      if (a.category) q = q.eq('category', a.category as string);
      return must(await q, 'Listing styles');
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
        instructions: 'ABET Content OS is ABET Global’s content workspace. Call get_brand_kit before writing anything. Save scripts with save_script; people approve and publish in the dashboard. When asked to work through the queue, call get_claude_queue and write a script for each item.',
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
