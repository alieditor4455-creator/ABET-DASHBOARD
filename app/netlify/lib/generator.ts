/**
 * Script generation through the Claude API (server-side only; the key never reaches the browser).
 * Uses the ABET Brand Kit, the compliance rules and the chosen style's specification.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { REG_LINE, RISK_FULL, RISK_SHORT, TYPES } from '../../src/lib/constants';
import type { ContentType } from '../../src/lib/types';

export const MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-5-5';
export const claudeApiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const ScriptSchema = z.object({
  title: z.string(),
  length: z.string(),
  audience: z.string(),
  angle: z.string(),
  sections: z.array(z.object({
    label: z.string(),
    timing: z.string(),
    voiceover: z.string(),
    on_screen: z.string(),
    visual: z.string(),
  })),
  captions: z.object({ IG: z.string(), FB: z.string(), YT: z.string(), TT: z.string(), LI: z.string(), X: z.string() }),
});
export type GeneratedScript = z.infer<typeof ScriptSchema>;

// Stable system prompt (identical bytes every call, so it can be cached).
const SYSTEM = `You write marketing and education content for ABET Global (abetglobal.com), a multi-asset broker for forex, gold, oil, indices and crypto CFDs on MetaTrader 5.

Voice: clear and plain; short sentences that explain trading terms simply. Reassuring, never promising: talk about learning, safety, transparency and support, never profits. Plain English for a global audience.

Compliance rules you must follow in every script and caption:
- Never promise or imply returns. Never use "guaranteed", "risk-free", "easy money", "can't lose" or similar.
- Every video ends with the risk warning on screen and spoken or captioned: "${RISK_SHORT}"
- Label every example price or chart "illustrative example". Never quote live prices or forecasts.
- Do not claim regulation or licences beyond: "${REG_LINE}"
- ABET is execution-only: never give advice or recommendations to buy or sell.
- Demo-account content may say "no real funds needed", never "risk-free trading".
- Every caption includes the short risk warning, except X, which ends with "CFDs carry a high risk of losing money." and stays under 280 characters. The YouTube description ends with the full risk warning: "${RISK_FULL}"

Write the script so a video editor or designer can produce it directly: each section has the words (voiceover or slide/page copy), the on-screen text, and the visual direction.`;

export async function writeScript(args: {
  type: ContentType; topic: string; audience?: string | null; objective?: string | null; note?: string | null;
  style?: { name: string; description: string; spec: [string, string][]; execution_config?: Record<string, unknown> } | null;
}): Promise<GeneratedScript> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the server environment
  const T = TYPES[args.type];
  const styleText = args.style
    ? `Creative style: ${args.style.name}. ${args.style.description}\nStyle specification:\n${args.style.spec.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : 'No creative style chosen yet: write a clean, style-neutral script.';
  const user = [
    `Format: ${T.name} (${T.meta}). Split it into ${T.unit.toLowerCase()}s.`,
    `Topic: ${args.topic}`,
    `Audience: ${args.audience || 'choose the best audience for this topic'}`,
    `Objective: ${args.objective || 'choose the best objective'}`,
    args.note ? `Request note from the team: ${args.note}` : '',
    styleText,
    'Research the topic from your own knowledge, pick the angle and hook, then write the complete script and platform captions.',
  ].filter(Boolean).join('\n\n');

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(ScriptSchema) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude declined this request. Try rewording the topic.');
  if (response.stop_reason === 'max_tokens') throw new Error('The script was too long to finish. Try a shorter format or topic.');
  if (!response.parsed_output) throw new Error('Claude returned a script in an unexpected format. Try again.');
  return response.parsed_output;
}

export function friendlyApiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The Claude API key is invalid. An admin needs to update it in Netlify.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'The Claude API key does not have access to this model.';
  if (e instanceof Anthropic.RateLimitError) return 'Claude is busy or the monthly spending limit was reached. Try again later.';
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status}: ${e.message}`;
  return (e as Error)?.message ?? 'Unknown error';
}
