import { CORS, json, origin, preflight } from '../lib/common';
import { handleRpc, makeDb } from '../lib/mcp-server';

/** The Claude connector endpoint: https://<site>/mcp */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  const o = origin(req);
  const challenge = { 'WWW-Authenticate': `Bearer resource_metadata="${o}/.well-known/oauth-protected-resource"` };
  if (req.method === 'GET') return new Response('Method not allowed', { status: 405, headers: { ...CORS, Allow: 'POST' } });
  if (req.method === 'DELETE') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
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
