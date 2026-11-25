import { createClient } from '@supabase/supabase-js';
import { CORS, SUPABASE_ANON_KEY, SUPABASE_URL, json, origin, preflight } from '../lib/common';
import { handleRpc, makeDb } from '../lib/mcp-server';

/**
 * The hourly Claude video worker signs in with its own ABET account. Its password travels in the
 * x-abet-worker-key header (saved as a network secret on the Claude Code environment, never in code),
 * so the worker needs no claude.ai connector. Tokens are reused while this function instance is warm.
 */
const WORKER_EMAIL = 'claude-worker@example.com';
let workerCache: { key: string; token: string; exp: number } | null = null;
async function workerToken(key: string): Promise<string | null> {
  if (workerCache && workerCache.key === key && workerCache.exp > Date.now() + 60_000) return workerCache.token;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: WORKER_EMAIL, password: key });
  if (error || !data.session) return null;
  workerCache = { key, token: data.session.access_token, exp: (data.session.expires_at ?? 0) * 1000 };
  return workerCache.token;
}

/** The Claude connector endpoint: https://<site>/mcp */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  const o = origin(req);
  const challenge = { 'WWW-Authenticate': `Bearer resource_metadata="${o}/.well-known/oauth-protected-resource"` };
  if (req.method === 'GET') return new Response('Method not allowed', { status: 405, headers: { ...CORS, Allow: 'POST' } });
  if (req.method === 'DELETE') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const auth = req.headers.get('authorization') ?? '';
  let token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const wk = req.headers.get('x-abet-worker-key');
  if (!token && wk) token = (await workerToken(wk.trim())) ?? '';
  if (!token) return json({ error: 'unauthorized' }, 401, challenge);

  const db = makeDb(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return json({ error: 'invalid_token' }, 401, challenge);
  const { data: me } = await db.rpc('my_profile');
  if (!me || !(me as { active?: boolean }).active) return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Your ABET Content OS account is not active. Ask an admin to approve it.' } }, 403);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
  const ctx = { db, userId: data.user.id, appUrl: o };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, ctx)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const res = await handleRpc(body as Record<string, unknown>, ctx);
  return res ? json(res) : new Response(null, { status: 202, headers: CORS });
};

export const config = { path: '/mcp' };
