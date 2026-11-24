/**
 * Production templates ("renderers") registry.
 *
 * Each approved creative style points at one renderer by id (styles.template_kind) and passes its own
 * settings in styles.execution_config. A renderer turns a script plus the style's settings into the
 * finished file (video, PDF, carousel images). Renderers are code, built from the references you provide;
 * see docs/STYLE-DEVELOPMENT.md. A style whose template_kind is not listed here has no working
 * production template yet, so its Generate button stays disabled.
 *
 * This list is intentionally empty: no creative style is created without your references.
 */
import type { ContentType } from './types';

export interface RendererInfo {
  id: string;
  label: string;
  contentTypes: ContentType[];
  outputs: string[];            // e.g. ['mp4 9:16'], ['pdf a4'], ['png 1080x1350']
  engine: 'in-app' | 'video-worker';
}

export const RENDERERS: Record<string, RendererInfo> = {};

export const rendererFor = (templateKind: string | null | undefined): RendererInfo | null =>
  (templateKind && RENDERERS[templateKind]) || null;
