import { json, preflight } from '../lib/common';

const ALLOWED = /^https:\/\/(claude\.ai|claude\.com)\/api\/mcp\/auth_callback$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//;

/** Dynamic client registration. Only Claude's own callback addresses are accepted. */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'invalid_request' }, 405);
  let body: { redirect_uris?: string[]; client_name?: string } = {};
  try { body = await req.json(); } catch { return json({ error: 'invalid_client_metadata' }, 400); }
  const uris = body.redirect_uris ?? [];
  if (!uris.length || !uris.every((u) => ALLOWED.test(u))) return json({ error: 'invalid_redirect_uri', error_description: 'Only Claude can connect to ABET Content OS.' }, 400);
  return json({
    client_id: `claude-${crypto.randomUUID()}`,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: body.client_name ?? 'Claude',
    redirect_uris: uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }, 201);
};

export const config = { path: '/oauth/register' };
