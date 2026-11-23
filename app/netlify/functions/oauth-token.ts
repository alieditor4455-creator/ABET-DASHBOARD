import { json, preflight, refreshSession, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/common';

/** Token endpoint: turns a one-time code (or a refresh token) into a Supabase session for Claude. */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  try { return await handle(req); } catch {
    return json({ error: 'temporarily_unavailable', error_description: 'ABET Content OS couldn’t reach its database. Try again in a minute.' }, 503);
  }
};

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'invalid_request' }, 405);
  const ct = req.headers.get('content-type') ?? '';
  const raw = await req.text();
  const p = ct.includes('application/json') ? new URLSearchParams(Object.entries(JSON.parse(raw || '{}')) as [string, string][]) : new URLSearchParams(raw);
  const grant = p.get('grant_type');

  if (grant === 'authorization_code') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/redeem_oauth_code`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: p.get('code') ?? '', p_code_verifier: p.get('code_verifier') ?? '', p_redirect_uri: p.get('redirect_uri') ?? '' }),
    });
    if (!r.ok) return json({ error: 'invalid_grant', error_description: 'The sign-in code is invalid or expired. Connect again.' }, 400);
    const refresh = (await r.json()) as string;
    const s = refresh ? await refreshSession(refresh) : null;
    if (!s) return json({ error: 'invalid_grant', error_description: 'Your ABET session expired. Connect again.' }, 400);
    return json({ access_token: s.access_token, token_type: 'bearer', expires_in: s.expires_in, refresh_token: s.refresh_token, scope: 'content' });
  }

  if (grant === 'refresh_token') {
    const s = await refreshSession(p.get('refresh_token') ?? '');
    if (!s) return json({ error: 'invalid_grant', error_description: 'Session ended. Reconnect ABET Content OS in Claude.' }, 400);
    return json({ access_token: s.access_token, token_type: 'bearer', expires_in: s.expires_in, refresh_token: s.refresh_token, scope: 'content' });
  }

  return json({ error: 'unsupported_grant_type' }, 400);
}

export const config = { path: '/oauth/token' };
