import { RISK_FULL, RISK_SHORT, TYPES } from './constants';
import type { ContentType, Platform, ScriptUnit } from './types';

export interface DraftScript { title: string; length: string; units: ScriptUnit[] }

/**
 * A starting template, filled from the topic. It is not AI: real scripts come from Claude
 * through the connector. Prices are always labelled as illustrative and every script ends
 * with the risk warning.
 */
export function templateScript(type: ContentType, topic: string, length?: string): DraftScript {
  const t = topic.trim().replace(/\s+/g, ' ');
  const q = t.replace(/\?$/, '');
  const isQ = /^(what|how|why|when|where|which|who|is|are|can|should|do|does)\b/i.test(t);
  const subj = isQ ? q.replace(/^(what is|what are|how does|how do|why do|why does|how)\s+/i, '').trim() : q;
  const Subj = subj.charAt(0).toUpperCase() + subj.slice(1);
  const hook = isQ ? `${q}? Here is the simple answer.` : `${Subj}, explained in plain words.`;
  const title = isQ ? (t.endsWith('?') ? t : `${t}?`) : Subj;
  const cat = TYPES[type].cat;
  const u = (tc: string, label: string, vo: string, on: string, vis: string): ScriptUnit => ({ tc, label, vo, on, vis });
  const short = Subj.length > 28 ? `${Subj.slice(0, 28)}…` : Subj;

  if (type === 'yt') return { title, length: length || '8 minutes', units: [
    u('0:00–0:30', 'Intro', `${hook} In the next few minutes we cover what it means, a worked example and the risks.`, `Title card: ${Subj}`, 'Presenter to camera, ABET lower third'),
    u('0:30–2:30', 'Chapter 1 · The basics', `Start with the definition of ${subj}, and where you see it on an MT5 chart.`, 'Definition card', 'Screen recording on a demo account'),
    u('2:30–5:00', 'Chapter 2 · Worked example', 'Use illustrative prices only, so the idea is clear without referring to live market numbers.', '“Example” label on all figures', 'Animated chart with annotations'),
    u('5:00–7:00', 'Chapter 3 · Managing risk', 'Leverage magnifies gains and losses. Decide your risk before you place a trade, and consider a stop-loss.', 'Risk checklist', 'Split screen: plan vs. outcome'),
    u('7:00–8:00', 'Summary and next step', 'Practise on a demo account first, and read the Beginner Guides on abetglobal.com. Trading CFDs carries a high risk of losing money.', 'End card with logo and risk warning', 'Presenter to camera'),
  ] };
  if (type === 'ad') return { title, length: '15 and 30 seconds', units: [
    u('Variant A', 'Question hook', `${hook} Learn the basics, then practise on an MT5 demo account. CFDs carry a high risk of losing money.`, `Headline: ${short}`, 'Phone screen, demo badge'),
    u('Variant B', 'Statement hook', `Before you trade, understand ${subj}. Start with ABET’s free beginner guides. CFDs carry a high risk of losing money.`, 'Headline: Learn first', 'Typography on ink'),
    u('Variant C', 'Platform hook', 'Explore MetaTrader 5 on a demo account. No real funds needed while you learn. CFDs carry a high risk of losing money.', 'Headline: Try MT5 on demo', 'MT5 device visual'),
  ] };
  if (type === 'pdf') return { title, length: length || '12 pages', units: [
    u('p. 1', 'Cover', `${Subj}: a beginner’s guide from ABET.`, 'Title, logo, ink cover', 'Cover template'),
    u('pp. 2–3', 'Introduction', `Why ${subj} matters and what this guide covers.`, 'Contents', 'Single column'),
    u('pp. 4–7', 'The essentials', 'Definitions, a glossary box and simple diagrams.', 'Glossary callouts', 'Diagrams'),
    u('pp. 8–10', 'Worked example', 'A step-by-step example with illustrative prices only.', '“Example” labels', 'Annotated chart'),
    u('p. 11', 'Checklist', 'A short checklist before placing a trade.', 'Checkboxes', 'Two columns'),
    u('p. 12', 'Risk warning', 'Full risk warning and registration line.', 'Legal text', 'Back cover'),
  ] };
  if (type === 'carousel') return { title, length: '7 slides', units: [
    u('Slide 1', 'Cover', hook, Subj, 'Ink slide, red keyword'),
    u('Slide 2', 'Definition', `${Subj} in one sentence.`, 'Definition', 'White slide'),
    u('Slide 3', 'Example', 'An example with illustrative prices.', 'EUR/USD · example', 'Chart graphic'),
    u('Slide 4', 'Common mistake', 'The most common beginner misunderstanding, and the fix.', 'Mistake → Fix', 'Two columns'),
    u('Slide 5', 'Why it matters', 'How it helps you plan risk.', 'Plan your risk', 'Icon'),
    u('Slide 6', 'Recap', 'A three-point recap.', 'Recap', 'White slide'),
    u('Slide 7', 'Next step', 'Save this post and try MT5 on a demo account. Trading CFDs carries a high risk of losing money.', 'Try MT5 on demo', 'Ink slide, risk warning'),
  ] };
  if (cat === 'graphic') return { title, length: '1 design', units: [
    u('Headline', 'Headline', Subj, 'Large headline', 'Top third'),
    u('Body', 'Supporting line', 'One clear sentence that explains the idea.', 'Body copy', 'Centre'),
    u('CTA', 'Call to action', 'Learn more on abetglobal.com', 'Button-style CTA', 'Bottom'),
    u('Footer', 'Risk warning', RISK_SHORT, 'Small print', 'Footer band'),
  ] };
  return { title, length: length || '45 seconds', units: [
    u('0:00–0:03', 'Hook', hook, short, 'Presenter to camera, punch-in on the key word'),
    u('0:03–0:12', 'Explain', `Here is what ${subj} means for someone just starting out, in one sentence.`, 'Key idea', 'Clean definition card'),
    u('0:12–0:26', 'Example', 'Now an example with illustrative prices, not live market numbers.', 'EUR/USD · example', 'Animated chart labelled “Example”'),
    u('0:26–0:36', 'Why it matters', 'Understanding this helps you read prices and plan your risk more carefully.', 'Plan your risk', 'Icons: chart, shield'),
    u('0:36–0:45', 'Call to action', 'Learn the basics first, then practise on an MT5 demo account. Trading CFDs carries a high risk of losing money.', 'Try MT5 on demo', 'End card with ABET logo and risk warning'),
  ] };
}

export interface Check { ok: boolean; msg: string }
const BANNED = /(guarantee[ds]?|risk[- ]free|no risk|can'?t lose|sure profit|always (win|profit)|100% (safe|profit)|get rich|easy money|double your)/i;
const RISK = /(risk of losing|high risk|risk warning)/i;
const REG_CLAIMS = /\b(regulated by|licensed by|authori[sz]ed by|FCA|CySEC|ASIC|SEC)\b/i;

/** Rule-based checks that run on every script. Human compliance approval is still required. */
export function complianceCheck(title: string, units: ScriptUnit[]): Check[] {
  const text = `${title} ${units.map((x) => `${x.vo} ${x.on}`).join(' ')}`;
  const bad = text.match(BANNED);
  const reg = text.match(REG_CLAIMS);
  return [
    { ok: !bad, msg: bad ? `Remove “${bad[0]}”: it suggests a guaranteed outcome.` : 'No guaranteed-return or risk-free language' },
    { ok: RISK.test(text), msg: RISK.test(text) ? 'Risk warning included' : 'Add the risk warning to the final scene' },
    { ok: !reg, msg: reg ? `“${reg[0]}” is a regulatory claim. Only the Anguilla registration is verified.` : 'No regulatory claims beyond the verified Anguilla registration' },
  ];
}

export function makeCaption(p: Platform, title: string): string {
  const tag = '#forex #tradingeducation #MT5 #ABET';
  switch (p) {
    case 'IG': return `${title}\n\nSave this for later and follow for more trading basics.\n\n${tag}\n\n${RISK_SHORT}`;
    case 'FB': return `${title}\n\nNew to trading? Start with the basics, then practise on an MT5 demo account.\n\n${RISK_SHORT}`;
    case 'YT': return `${title}\n\nIn this video: the basics, a worked example with illustrative prices, and how to manage risk.\n\nLearn more: abetglobal.com\n\n${RISK_FULL}`;
    case 'TT': return `${title} ${tag}\n${RISK_SHORT}`;
    case 'LI': return `${title}\n\nA short, plain-English explainer from the ABET education team.\n\n${RISK_SHORT}`;
    case 'X': return `${title}. CFDs carry a high risk of losing money.`.slice(0, 280);
  }
}

/** The prompt a team member pastes into claude.ai when the connector is set up. */
export function claudePrompt(type: ContentType, topic: string, styleName: string | null, itemId: string): string {
  return `Using the ABET Content OS connector, write a ${TYPES[type].name.toLowerCase()} script about "${topic}" for ABET Global. ` +
    `Follow the Brand Kit and compliance rules (risk warning at the end, illustrative prices only, no guaranteed returns). ` +
    (styleName ? `Plan it for the "${styleName}" style. ` : '') +
    `Save it as a new script version on content item ${itemId}.`;
}
