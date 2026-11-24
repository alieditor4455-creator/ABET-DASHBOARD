import { json, preflight } from '../lib/common';
import { claudeApiConfigured } from '../lib/generator';
import { SERVER_RENDERERS } from '../lib/render';

/** Tells the dashboard what the production engine can do right now (no secrets returned). */
export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  return json({ claudeApi: claudeApiConfigured(), renderers: Object.keys(SERVER_RENDERERS) });
};

export const config = { path: '/api/capabilities' };
