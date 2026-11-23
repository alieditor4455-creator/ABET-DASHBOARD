import { json, origin, preflight } from '../lib/common';

/** OAuth discovery documents that claude.ai reads when you add the connector. */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  const o = origin(req);
  const path = new URL(req.url).pathname;
  if (path.startsWith('/.well-known/oauth-protected-resource')) {
    return json({ resource: `${o}/mcp`, authorization_servers: [o], bearer_methods_supported: ['header'], resource_name: 'ABET Content OS' });
  }
  return json({
    issuer: o,
    authorization_endpoint: `${o}/connect`,
    token_endpoint: `${o}/oauth/token`,
    registration_endpoint: `${o}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['content'],
  });
};

export const config = { path: ['/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'] };
