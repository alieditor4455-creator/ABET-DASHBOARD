/**
 * Server-side production templates. Each entry renders one approved style's deliverable and returns the
 * created asset id. Entries are added when a style is built from ABET's references
 * (see docs/STYLE-DEVELOPMENT.md); the id must match styles.template_kind and src/lib/renderers.ts.
 *
 * Intentionally empty: no style is built without ABET's references.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneratedScript } from './generator';

export interface RenderContext {
  db: SupabaseClient;
  userId: string;
  item: { id: string; title: string; type: string };
  style: { id: string; name: string; execution_config: Record<string, unknown>; template_version: number };
  script: GeneratedScript;
  progress: (stage: string, pct: number) => Promise<void>;
}

export type Renderer = (ctx: RenderContext) => Promise<{ assetId: string }>;

export const SERVER_RENDERERS: Record<string, Renderer> = {};
