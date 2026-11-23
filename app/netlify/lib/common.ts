/* Shared helpers for the Claude connector (Netlify Functions). */

// Public values: the same ones the browser app uses. Row-level security protects the data.
export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://zgbzsnrumpcyzctvssxl.supabase.co';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_pPjfUCjY1t8pTVdOpGbhBA_vuJgFYzS';

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
};

export function origin(req: Request): string {
  const u = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? u.host;
  return `${proto}://${host}`;
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extra },
  });
}

export const preflight = () => new Response(null, { status: 204, headers: CORS });

/** Exchanges a Supabase refresh token for a fresh session. */
export async function refreshSession(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return j.access_token ? j : null;
}
