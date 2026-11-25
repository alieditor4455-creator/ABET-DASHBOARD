#!/usr/bin/env node
/**
 * ABET video renderer. Turns a scene plan (JSON written by Claude) into a finished file:
 *   - output "video"  -> MP4 (H.264, 30 fps, silent track or music/voiceover if given)
 *   - output "slides" -> one PNG per scene (carousels, static ads)
 *   - output "pdf"    -> one A4 page per scene
 *
 * Usage: node video/render.mjs <plan.json> <out-file-or-folder> [--preview]
 * --preview renders one still per scene (fast check before the full render).
 *
 * How it works: the plan is turned into an HTML page with CSS animations (templates/*.css).
 * Chromium (Playwright) loads it, every frame is "seeked" to an exact time and captured,
 * and ffmpeg encodes the frames. Rendering is deterministic: the same plan gives the same video.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Playwright is pre-installed globally in Claude Code cloud sessions; require() finds it there (ESM import does not).
const { chromium } = createRequire(import.meta.url)('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

export const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], A4: [1240, 1754] };
export const REG_LINE = 'ABET is a registered trading services provider in Anguilla under registration number A000000977.';
export const RISK_SHORT = 'CFDs are complex instruments traded on leverage and carry a high risk of losing money. Only trade with money you can afford to lose.';
const FPS = 30;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** **word** in plan text becomes an accent highlight. */
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>');

// ------------------------------------------------------------------ validation
const SCENE_TYPES = ['title', 'points', 'stat', 'steps', 'compare', 'chart', 'statement', 'cta', 'image'];
export function validatePlan(plan) {
  const errs = [];
  if (!plan || typeof plan !== 'object') return ['The plan must be a JSON object.'];
  if (!['video', 'slides', 'pdf'].includes(plan.output ?? 'video')) errs.push('output must be video, slides or pdf.');
  const aspect = plan.output === 'pdf' ? 'A4' : plan.aspect ?? '16:9';
  if (!SIZES[aspect]) errs.push(`aspect must be one of ${Object.keys(SIZES).join(', ')}.`);
  if (!Array.isArray(plan.scenes) || !plan.scenes.length) errs.push('scenes must be a non-empty array.');
  (plan.scenes ?? []).forEach((s, i) => {
    if (!SCENE_TYPES.includes(s.type)) errs.push(`scene ${i + 1}: type must be one of ${SCENE_TYPES.join(', ')}.`);
    if ((plan.output ?? 'video') === 'video' && !(s.duration > 0.5 && s.duration <= 30)) errs.push(`scene ${i + 1}: duration must be between 0.5 and 30 seconds.`);
    if (s.type === 'points' && !(Array.isArray(s.points) && s.points.length)) errs.push(`scene ${i + 1}: points needs a list.`);
    if (s.type === 'steps' && !(Array.isArray(s.steps) && s.steps.length)) errs.push(`scene ${i + 1}: steps needs a list.`);
    if (s.type === 'compare' && !(s.left && s.right)) errs.push(`scene ${i + 1}: compare needs left and right.`);
    if (s.type === 'image' && !s.src) errs.push(`scene ${i + 1}: image needs src.`);
  });
  return errs;
}

// ------------------------------------------------------------------ chart helper (illustrative only)
function chartSvg(trend = 'up', seed = 7) {
  let x = seed;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const n = 28, pts = [];
  let v = trend === 'down' ? 70 : 30;
  for (let i = 0; i < n; i++) {
    const drift = trend === 'up' ? 1.6 : trend === 'down' ? -1.6 : Math.sin(i / 3) * 1.2;
    v = Math.max(8, Math.min(92, v + drift + (rnd() - 0.5) * 7));
    pts.push(v);
  }
  const lo0 = Math.min(...pts), hi0 = Math.max(...pts);
  for (let i = 0; i < n; i++) pts[i] = 12 + ((pts[i] - lo0) / Math.max(1, hi0 - lo0)) * 76;
  const W = 1000, H = 420, step = W / (n - 1);
  const line = pts.map((p, i) => `${(i * step).toFixed(1)},${(H - (p / 100) * H).toFixed(1)}`).join(' ');
  const candles = pts.map((p, i) => {
    const o = i ? pts[i - 1] : p, c = p, hi = Math.max(o, c) + rnd() * 5, lo = Math.min(o, c) - rnd() * 5;
    const up = c >= o, cx = i * step, y = (q) => H - (q / 100) * H;
    return `<g class="cdl" style="--d:${(0.25 + i * 0.035).toFixed(2)}s"><line x1="${cx}" x2="${cx}" y1="${y(hi)}" y2="${y(lo)}" class="${up ? 'u' : 'dn'}"/><rect x="${cx - step * 0.28}" width="${step * 0.56}" y="${Math.min(y(o), y(c))}" height="${Math.max(3, Math.abs(y(o) - y(c)))}" class="${up ? 'u' : 'dn'}"/></g>`;
  }).join('');
  return `<svg viewBox="-20 -20 1040 460" preserveAspectRatio="none" class="chart-svg">${[1, 2, 3].map((g) => `<line class="grid" x1="0" x2="${W}" y1="${(H / 4) * g}" y2="${(H / 4) * g}"/>`).join('')}${candles}<polyline class="trend" pathLength="1" points="${line}"/></svg>`;
}

// ------------------------------------------------------------------ scene markup
function sceneBody(s, ctx) {
  const d = (i) => `style="--d:${(0.15 + i * 0.22).toFixed(2)}s"`;
  switch (s.type) {
    case 'title':
      return `<div class="stack center">
        ${s.kicker ? `<div class="kicker in" ${d(0)}>${esc(s.kicker)}</div>` : ''}
        <h1 class="headline in" ${d(1)}>${rich(s.headline)}</h1>
        ${s.sub ? `<p class="sub in" ${d(2)}>${rich(s.sub)}</p>` : ''}
        <div class="bar in" ${d(2.5)}></div></div>`;
    case 'statement':
      return `<div class="stack center"><p class="statement in" ${d(0)}>${rich(s.text)}</p>${s.sub ? `<p class="sub in" ${d(1.5)}>${rich(s.sub)}</p>` : ''}</div>`;
    case 'points':
      return `<div class="stack">${s.heading ? `<h2 class="h2 in" ${d(0)}>${rich(s.heading)}</h2>` : ''}
        <ol class="points">${s.points.map((p, i) => `<li class="in" ${d(i + 1)}><span class="num">${i + 1}</span><span>${rich(typeof p === 'string' ? p : p.text)}</span></li>`).join('')}</ol></div>`;
    case 'stat':
      return `<div class="stack center">${s.heading ? `<h2 class="h2 in" ${d(0)}>${rich(s.heading)}</h2>` : ''}
        <div class="stat-value pop" ${d(1)}>${esc(s.value)}</div>
        ${s.label ? `<p class="stat-label in" ${d(2)}>${rich(s.label)}</p>` : ''}
        ${s.note ? `<p class="note in" ${d(3)}>${rich(s.note)}</p>` : ''}</div>`;
    case 'steps':
      return `<div class="stack">${s.heading ? `<h2 class="h2 in" ${d(0)}>${rich(s.heading)}</h2>` : ''}
        <div class="steps n${s.steps.length}">${s.steps.map((st, i) => `<div class="step-card in" ${d(i + 1)}><span class="step-n">${String(i + 1).padStart(2, '0')}</span><b>${rich(st.title)}</b>${st.text ? `<p>${rich(st.text)}</p>` : ''}</div>`).join('')}</div></div>`;
    case 'compare': {
      const col = (c, i, cls) => `<div class="cmp-card ${cls} in" ${d(i)}><b>${rich(c.title)}</b><ul>${(c.points ?? []).map((p) => `<li>${rich(p)}</li>`).join('')}</ul></div>`;
      return `<div class="stack">${s.heading ? `<h2 class="h2 in" ${d(0)}>${rich(s.heading)}</h2>` : ''}<div class="compare">${col(s.left, 1, 'l')}<div class="vs pop" ${d(1.6)}>VS</div>${col(s.right, 2, 'r')}</div></div>`;
    }
    case 'chart':
      return `<div class="stack">${s.heading ? `<h2 class="h2 in" ${d(0)}>${rich(s.heading)}</h2>` : ''}
        <div class="chart in" ${d(0.5)}>${chartSvg(s.trend, s.seed ?? 7)}${s.label ? `<div class="chart-label">${rich(s.label)}</div>` : ''}<div class="illus">Illustrative example, not real market data</div></div></div>`;
    case 'image':
      return `<div class="stack center">${s.heading ? `<h2 class="h2 in" ${d(0)}>${rich(s.heading)}</h2>` : ''}<img class="figure pop" ${d(1)} src="${esc(ctx.asset(s.src))}" alt="">${s.caption_text ? `<p class="sub in" ${d(2)}>${rich(s.caption_text)}</p>` : ''}</div>`;
    case 'cta':
      return `<div class="stack center"><h2 class="cta-head in" ${d(0)}>${rich(s.headline)}</h2>${s.action ? `<div class="cta-btn pop" ${d(1.4)}>${esc(s.action)}</div>` : ''}<p class="url in" ${d(2)}>${esc(s.url ?? 'abetglobal.com')}</p></div>`;
    default: return '';
  }
}

function endCard(theme) {
  const logo = theme === 'light' ? 'abet-wordmark-dark-derived.png' : 'abet-wordmark-white-official.png';
  return `<div class="stack center end"><img class="end-logo pop" style="--d:.1s" src="${pathToFileURL(path.join(ROOT, 'brand/logos', logo))}" alt="ABET">
    <p class="url in" style="--d:.4s">abetglobal.com · @abet.global</p>
    <p class="risk in" style="--d:.6s">${esc(RISK_SHORT)}</p><p class="reg in" style="--d:.7s">${esc(REG_LINE)}</p></div>`;
}

export function buildHtml(plan, planDir) {
  const output = plan.output ?? 'video';
  const aspect = output === 'pdf' ? 'A4' : plan.aspect ?? '16:9';
  const [W, H] = SIZES[aspect];
  const theme = plan.theme ?? 'light';
  const asset = (src) => (/^(https?:|data:|file:)/.test(src) ? src : pathToFileURL(path.resolve(planDir, src)).href);
  const scenes = [...plan.scenes];
  if (plan.end_card !== false) scenes.push({ type: '__end', duration: 4 });
  let t = 0;
  const timed = scenes.map((s) => { const dur = output === 'video' ? Number(s.duration) : 4; const r = { ...s, start: t, end: t + dur }; t += dur; return r; });
  const total = t;
  const logo = theme === 'light' ? 'abet-wordmark-dark-derived.png' : 'abet-wordmark-white-official.png';
  const fontFace = ['Poppins-400', 'Poppins-500', 'Poppins-600', 'Poppins-700', 'SpaceGrotesk-600', 'SpaceGrotesk-700'].map((f) => {
    const [fam, w] = f.split('-');
    return `@font-face{font-family:'${fam === 'SpaceGrotesk' ? 'Space Grotesk' : fam}';font-weight:${w};src:url('${pathToFileURL(path.join(HERE, 'fonts', f + '.woff2'))}') format('woff2')}`;
  }).join('\n');
  const css = fs.readFileSync(path.join(HERE, 'templates', `${plan.template ?? 'abet-motion'}.css`), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}\n${css}</style></head>
<body class="theme-${theme} out-${output} ${W >= H ? 'land' : 'port'} a-${aspect.replace(':', 'x')}" style="width:${W}px;height:${H}px;--total:${total}s">
<div class="bg"><div class="glow"></div></div>
${plan.logo === false ? '' : `<img class="corner-logo" src="${pathToFileURL(path.join(ROOT, 'brand/logos', logo))}" alt="">`}
${timed.map((s, i) => `<section class="scene t-${s.type}" data-s="${s.start}" data-e="${s.end}" data-cap="${esc(s.caption ?? '')}" style="--s:${s.start}s;--e:${s.end}s">${s.type === '__end' ? endCard(theme) : sceneBody(s, { asset })}${output === 'slides' && plan.scenes.length > 1 ? `<div class="slide-n">${i + 1} / ${timed.length}</div>${i === 0 ? '<div class="swipe">Swipe →</div>' : ''}` : ''}</section>`).join('\n')}
${output === 'video' && plan.captions !== false ? '<div class="caption" id="cap"></div>' : ''}
${plan.footer_risk ? `<div class="risk-footer">${esc(RISK_SHORT)}</div>` : ''}
<div class="progress" style="--total:${total}s"></div>
<script>
const scenes=[...document.querySelectorAll('.scene')];const cap=document.getElementById('cap');
const chunks=scenes.map(el=>{const w=(el.dataset.cap||'').split(/\\s+/).filter(Boolean);const out=[];for(let i=0;i<w.length;i+=7)out.push(w.slice(i,i+7).join(' '));return out});
window.__seek=(t)=>{scenes.forEach((el,i)=>{const s=+el.dataset.s,e=+el.dataset.e;const on=t>=s&&t<e;el.style.display=on?'flex':'none';
 if(on&&cap){const c=chunks[i];if(!c.length){cap.style.opacity=0}else{const k=Math.min(c.length-1,Math.floor((t-s)/((e-s)/c.length)));cap.textContent=c[k];cap.style.opacity=1}}});
 const lg=document.querySelector('.corner-logo');if(lg){const last=scenes[scenes.length-1];lg.style.opacity=(last.classList.contains('t-__end')&&t>=+last.dataset.s)?0:1}
 document.getAnimations().forEach(a=>{a.pause();a.currentTime=t*1000});};
window.__total=${total};window.__scenes=scenes.map(el=>[+el.dataset.s,+el.dataset.e]);
</script></body></html>`;
  return { html, W, H, total, output, scenes: timed };
}

// ------------------------------------------------------------------ render
export async function render(plan, out, { planDir = process.cwd(), preview = false, onProgress = () => {} } = {}) {
  const errs = validatePlan(plan);
  if (errs.length) throw new Error('Plan problems:\n- ' + errs.join('\n- '));
  const { html, W, H, total, output, scenes } = buildHtml(plan, planDir);
  const tmp = path.join(path.dirname(path.resolve(out)), `.render-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(tmp).href);
    await page.evaluate(() => document.fonts.ready);
    const shotAt = async (t, file, type = 'png') => { await page.evaluate((x) => window.__seek(x), t); return page.screenshot(file ? { path: file, type } : { type: 'jpeg', quality: 90 }); };

    if (preview || output !== 'video') {
      const dir = preview || output === 'slides' ? out : path.join(path.dirname(path.resolve(out)), `.pages-${Date.now()}`);
      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      for (const [i, s] of scenes.entries()) {
        const f = path.join(dir, `${String(i + 1).padStart(2, '0')}.png`);
        await shotAt(Math.max(s.start, s.end - 0.5), f);
        files.push(f); onProgress(Math.round(((i + 1) / scenes.length) * 100));
      }
      if (output === 'pdf' && !preview) {
        const doc = `<!doctype html><html><head><style>@page{size:${W}px ${H}px;margin:0}body{margin:0}img{display:block;width:${W}px;height:${H}px;page-break-after:always}</style></head><body>${files.map((f) => `<img src="${pathToFileURL(f)}">`).join('')}</body></html>`;
        const p2 = await browser.newPage();
        const docFile = path.join(dir, 'doc.html'); fs.writeFileSync(docFile, doc);
        await p2.goto(pathToFileURL(docFile).href); await p2.waitForLoadState('load');
        await p2.pdf({ path: out, width: `${W}px`, height: `${H}px`, printBackground: true });
        fs.rmSync(dir, { recursive: true, force: true });
        return { file: out, pages: files.length };
      }
      return { files };
    }

    // Video: frame-accurate capture piped into ffmpeg.
    const frames = Math.round(total * FPS);
    const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
    const audio = plan.audio ?? {};
    const inputs = [];
    if (audio.voiceover) inputs.push(path.resolve(planDir, audio.voiceover));
    if (audio.music) inputs.push(path.resolve(planDir, audio.music));
    for (const f of inputs) args.push('-i', f);
    if (!inputs.length) args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=48000:cl=stereo');
    if (inputs.length === 2) args.push('-filter_complex', `[2:a]volume=0.18,afade=t=out:st=${Math.max(0, total - 2)}:d=2[m];[1:a][m]amix=inputs=2:duration=first:normalize=0[a]`, '-map', '0:v', '-map', '[a]');
    else if (inputs.length === 1 && audio.music) args.push('-af', `volume=0.35,afade=t=out:st=${Math.max(0, total - 2)}:d=2`, '-map', '0:v', '-map', '1:a');
    else args.push('-map', '0:v', '-map', '1:a');
    const rate = total > 120 ? ['-maxrate', '1800k', '-bufsize', '3600k'] : ['-maxrate', '4M', '-bufsize', '8M'];
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '21', ...rate, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-t', String(total), '-movflags', '+faststart', '-r', String(FPS), out);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited with ${c}`)))));
    for (let f = 0; f < frames; f++) {
      const buf = await shotAt(f / FPS);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % FPS === 0) onProgress(Math.round((f / frames) * 100));
    }
    ff.stdin.end();
    await done;
    return { file: out, seconds: total, frames };
  } finally {
    await browser.close();
    fs.rmSync(tmp, { force: true });
  }
}

// ------------------------------------------------------------------ CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planFile, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!planFile || !out) { console.error('Usage: node video/render.mjs <plan.json> <out.mp4 | out.pdf | out-folder> [--preview]'); process.exit(2); }
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const t0 = Date.now(); let last = -1;
  render(plan, out, { planDir: path.dirname(path.resolve(planFile)), preview: process.argv.includes('--preview'), onProgress: (p) => { if (p >= last + 10) { last = p; process.stdout.write(`${p}% `); } } })
    .then((r) => console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s:`, JSON.stringify(r)))
    .catch((e) => { console.error('\nRender failed:', e.message); process.exit(1); });
}
