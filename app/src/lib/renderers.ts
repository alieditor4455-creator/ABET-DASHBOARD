/**
 * Production templates ("renderers") registry.
 *
 * Each approved creative style points at one renderer by id (styles.template_kind) and passes its own
 * settings in styles.execution_config. A renderer turns a script plus the style's settings into the
 * finished file (video, PDF, carousel images). Renderers are code, built from the references you provide;
 * see docs/STYLE-DEVELOPMENT.md. A style whose template_kind is not listed here has no working
 * production template yet, so its Generate button stays disabled.
 *
 * "claude-worker" templates are made by Claude (Claude Code) from the video queue, using the template code in
 * the repository's video/ folder. The dashboard itself renders nothing.
 */
import type { ContentType } from './types';

export interface RendererInfo {
  id: string;
  label: string;
  contentTypes: ContentType[];
  outputs: string[];            // e.g. ['mp4 9:16'], ['pdf a4'], ['png 1080x1350']
  engine: 'in-app' | 'video-worker' | 'claude-worker';
}

export const RENDERERS: Record<string, RendererInfo> = {
  'claude:poster': {
    id: 'claude:poster', label: 'ABET Posters: 7 looks for ads, carousels and PDFs (made by Claude)', engine: 'claude-worker',
    contentTypes: ['ad', 'carousel', 'pdf'],
    outputs: ['PNG 1:1, 4:5, 9:16, 1200×628', 'A4/A3 print', 'Carousel slides + LinkedIn PDF', 'A4 PDF documents'],
  },
  'claude:cinema': {
    id: 'claude:cinema', label: 'ABET Cinema: Cinematic Dark / Light Glass (made by Claude)', engine: 'claude-worker',
    contentTypes: ['reel', 'yt', 'explainer', 'ad', 'carousel'],
    outputs: ['MP4 16:9, 9:16, 1:1, 4:5', 'PNG'],
  },
  'claude:abet-motion': {
    id: 'claude:abet-motion', label: 'ABET Motion (made by Claude)', engine: 'claude-worker',
    contentTypes: ['reel', 'yt', 'explainer', 'pdf', 'carousel', 'ad'],
    outputs: ['MP4 16:9, 9:16, 1:1, 4:5', 'PNG slides', 'A4 PDF'],
  },
};

export const rendererFor = (templateKind: string | null | undefined): RendererInfo | null =>
  (templateKind && RENDERERS[templateKind]) || null;

/** Claude-worker settings stored on the style (styles.execution_config). */
export interface WorkerConfig { outputs: VideoRequestOutput[]; aspects: string[]; lengths: string[]; theme?: string }
type VideoRequestOutput = 'video' | 'image' | 'slides' | 'pdf';
export function workerConfig(cfg: Record<string, unknown> | null | undefined): WorkerConfig {
  const c = (cfg ?? {}) as Partial<WorkerConfig>;
  const arr = (v: unknown, d: string[]) => (Array.isArray(v) && v.length ? v.map(String) : d);
  return { outputs: arr(c.outputs, ['video']) as VideoRequestOutput[], aspects: arr(c.aspects, ['16:9']), lengths: arr(c.lengths, ['60–90 seconds']), theme: c.theme };
}

/** Can this style make finished files right now? Claude-worker templates always can; server renderers must be deployed. */
export function canGenerate(templateKind: string | null | undefined, serverRenderers: string[] | undefined): boolean {
  const r = rendererFor(templateKind);
  if (!r) return false;
  return r.engine === 'claude-worker' || !!serverRenderers?.includes(r.id);
}

/** Static preview image for a style (execution_config.preview), used until an uploaded preview exists. */
export const previewOf = (s: { execution_config?: Record<string, unknown> | null }): string | undefined =>
  typeof s.execution_config?.preview === 'string' ? (s.execution_config.preview as string) : undefined;
