/**
 * ABET Cinema: premium UI-motion template inspired by ABET's Forex Trading Academy film (dark) and a light
 * glass fintech look (light). Ambient light, blur-to-focus motion, word-by-word type, 3D phone and cards,
 * glossy orbit icons, chat bubbles, word-by-word captions. Themes: "dark" (ABET Cinematic Dark), "light" (ABET Light Glass).
 */

const ACC = {
  dark: { red: ['#FF6A4D', '#E0383B'], green: ['#3BE08E', '#13A866'], blue: ['#5B9BFF', '#2F6BEB'], gold: ['#FFC857', '#E39B1B'], white: ['#FFFFFF', '#C9CDD6'] },
  light: { red: ['#D6342B', '#AE1818'], green: ['#22A86B', '#13804F'], blue: ['#3B7BEA', '#2459C8'], gold: ['#E0A325', '#B87A0D'], white: ['#191B22', '#3A3E48'] },
};

// 24px stroke icons (drawn for this template).
const ICONS = {
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
  candles: '<path d="M7 4v16M17 4v16"/><rect x="5" y="8" width="4" height="7" rx="1"/><rect x="15" y="6" width="4" height="9" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  wallet: '<path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H4z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  graduation: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
};
const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.star}</svg>`;

const D = (x) => `style="--d:${x.toFixed(2)}s"`;
const acc = (s, def = 'red') => (s && ACC.dark[s] ? s : def);

/** Glossy sphere with an icon or short text. */
const orb = (o, i, ctx) => {
  const a = acc(o.color, ['red', 'blue', 'gold', 'green'][i % 4]);
  const inner = o.text ? `<b>${ctx.esc(String(o.text).slice(0, 3))}</b>` : icon(o.icon ?? 'star');
  return `<span class="orb o-${a}">${inner}</span>`;
};

/** Small seeded sparkline path. */
function spark(seed, up = true, w = 70, h = 22) {
  let x = seed * 9301 + 49297; const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const n = 14; let v = up ? 30 : 70; const pts = [];
  for (let i = 0; i < n; i++) { v = Math.max(5, Math.min(95, v + (up ? 3.5 : -3.5) + (r() - 0.5) * 18)); pts.push(v); }
  return pts.map((p, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - (p / 100) * h).toFixed(1)}`).join(' ');
}

const WATCH = [['EUR/USD', '€', 'blue', '1.08xx', true], ['GBP/USD', '£', 'blue', '1.27xx', false], ['USD/JPY', '¥', 'red', '151.xx', true], ['XAU/USD', 'Au', 'gold', '2,3xx.x', true], ['AUD/USD', 'A$', 'green', '0.66xx', false], ['USD/CAD', 'C$', 'red', '1.36xx', true]];

function phone(ph = {}, ctx, d0 = 0.3) {
  const kind = ph.screen ?? 'watchlist';
  const markUrl = ctx.file('brand/logos/abet-mark-96.png');
  let body = '';
  if (kind === 'watchlist') {
    const rows = (ph.rows ?? WATCH.map(([sym, glyph, color, price, up]) => ({ sym, glyph, color, price, up }))).slice(0, 6);
    body = `<div class="ph-balance in" ${D(d0 + 0.25)}><small>${ctx.esc(ph.balance_label ?? 'Demo balance')}</small><b>${ctx.esc(ph.balance ?? '$10,000.00')}</b></div>
      ${rows.map((r, i) => `<div class="ph-row in${ph.highlight === i ? ' hot' : ''}" ${D(d0 + 0.4 + i * 0.08)}><span class="ph-sym o-${acc(r.color, 'blue')}">${ctx.esc(r.glyph ?? r.sym?.[0] ?? '')}</span><span class="ph-name"><b>${ctx.esc(r.sym)}</b><small>${ctx.esc(r.note ?? 'Illustrative')}</small></span><svg class="ph-spark ${r.up === false ? 'dn' : 'up'}" viewBox="0 0 70 22"><polyline points="${spark(i + 3, r.up !== false)}"/></svg><span class="ph-price">${ctx.esc(r.price ?? '')}</span></div>`).join('')}`;
  } else if (kind === 'notifications') {
    body = (ph.items ?? []).slice(0, 4).map((n, i) => `<div class="ph-note in" ${D(d0 + 0.35 + i * 0.35)}><span class="ph-sym o-${acc(n.color, 'red')}">${icon(n.icon ?? 'bolt')}</span><span class="ph-name"><b>${ctx.esc(n.title)}</b><small>${ctx.esc(n.text ?? '')}</small></span></div>`).join('');
  } else {
    body = (ph.items ?? []).slice(0, 6).map((n, i) => `<div class="ph-row in" ${D(d0 + 0.35 + i * 0.12)}><span class="ph-sym o-${acc(n.color, 'red')}">${n.done ? icon('check') : icon(n.icon ?? 'play')}</span><span class="ph-name"><b>${ctx.esc(n.title)}</b><small>${ctx.esc(n.text ?? '')}</small></span></div>`).join('');
  }
  return `<div class="phone-wrap pin" ${D(d0)}><div class="phone"><div class="ph-island"></div>
    <div class="ph-status"><span>9:41</span><span>●●● ▮</span></div>
    <div class="ph-head"><img src="${markUrl}" alt=""><b>${ctx.esc(ph.title ?? 'Watchlist')}</b>${ph.badge === false ? '' : `<i>${ctx.esc(ph.badge ?? 'DEMO')}</i>`}</div>
    ${body}</div></div>`;
}

function chartPanel(ch = {}, ctx, d0 = 0.4) {
  return `<div class="panel3d pin" ${D(d0)}><div class="p-label">${ctx.esc(ch.label ?? 'EUR/USD · ILLUSTRATIVE')}</div>${ctx.chartSvg(ch.trend ?? 'up', ch.seed ?? 11)}<div class="p-foot">Illustrative example, not real market data</div></div>`;
}

function scene(s, ctx) {
  const { esc, rich, words } = ctx;
  const head = (t, d0 = 0.15, cls = 'h') => (t ? `<h2 class="${cls}">${words(t, d0, 0.08)}</h2>` : '');
  const kick = (t, d0 = 0) => (t ? `<div class="kick pin" ${D(d0)}><i></i>${esc(t)}</div>` : '');
  let html = '';
  switch (s.type) {
    case 'logo':
    case '__end': {
      const end = s.type === '__end';
      const url = ctx.file(`brand/logos/${ctx.theme === 'light' ? 'abet-wordmark-dark-derived.png' : 'abet-wordmark-white-official.png'}`);
      html = `<div class="col center logo-scene"><div class="logo-glow"></div><div class="logo-box pin" ${D(0.2)}><img class="big-logo" src="${url}" alt="ABET"></div>
        ${s.tagline ? `<div class="tag pin" ${D(0.9)}>${esc(s.tagline)}</div>` : ''}
        ${end ? `<p class="url pin" ${D(0.6)}>abetglobal.com · @abet.global</p><p class="risk pin" ${D(0.8)}>${esc(ctx.RISK_SHORT)}</p><p class="reg pin" ${D(0.9)}>${esc(ctx.REG_LINE)}</p>` : ''}</div>`;
      break;
    }
    case 'title':
      html = `<div class="col center">${kick(s.kicker)}<h1 class="mega">${words(s.headline, 0.2, 0.1)}</h1>${s.sub ? `<p class="sub pin" ${D(0.9)}>${rich(s.sub)}</p>` : ''}</div>`;
      break;
    case 'statement': {
      const lines = s.lines ?? [s.text];
      if (s.sequence && lines.length > 1) {
        const dur = (s.duration ?? 4) / lines.length;
        html = `<div class="col center seq">${lines.map((l, i) => `<div class="seq-line" style="--a:${(i * dur).toFixed(2)}s;--b:${((i + 1) * dur - 0.35).toFixed(2)}s;--last:${i === lines.length - 1 ? 1 : 0}"><h1 class="mega">${words(l, i * dur + 0.05, 0.12)}</h1></div>`).join('')}</div>`;
      } else {
        html = `<div class="col center">${lines.map((l, i) => `<h1 class="mega">${words(l, 0.15 + i * 0.6, 0.1)}</h1>`).join('')}${s.sub ? `<p class="sub pin" ${D(0.4 + lines.length * 0.6)}>${rich(s.sub)}</p>` : ''}</div>`;
      }
      break;
    }
    case 'stat':
    case 'bigstat': {
      const c = s.count;
      const val = c ? `<span data-count data-at="${(s.start + 0.3).toFixed(2)}" data-dur="1.6" data-from="${c.from ?? 0}" data-to="${c.to}" data-dec="${c.decimals ?? 0}" data-pre="${esc(c.prefix ?? '')}" data-suf="${esc(c.suffix ?? '')}">${esc(c.prefix ?? '')}${c.to}${esc(c.suffix ?? '')}</span>` : esc(s.value);
      const text = `<div class="col ${s.phone ? '' : 'center'}">${kick(s.kicker ?? s.heading)}<div class="giant pin" ${D(0.25)}>${val}</div>${s.label ? `<p class="lead pin" ${D(0.8)}>${rich(s.label)}</p>` : ''}${s.note ? `<p class="sub pin" ${D(1.1)}>${rich(s.note)}</p>` : ''}</div>`;
      html = s.phone ? `<div class="split">${text}${phone(s.phone, ctx, 0.5)}</div>` : text;
      break;
    }
    case 'phone':
      html = `<div class="split">${`<div class="col">${kick(s.kicker)}${s.headline ? `<h1 class="mega left">${words(s.headline, 0.3, 0.1)}</h1>` : ''}${s.sub ? `<p class="sub pin" ${D(1)}>${rich(s.sub)}</p>` : ''}</div>`}${phone(s.phone ?? s, ctx, 0.1)}</div>`;
      break;
    case 'orbit': {
      const orbs = (s.orbs ?? [{ icon: 'trend' }, { icon: 'shield' }, { icon: 'book' }, { icon: 'target' }, { icon: 'globe' }, { icon: 'bulb' }, { icon: 'candles' }, { icon: 'clock' }]).slice(0, 10);
      const inner = orbs.filter((_, i) => i % 2 === 0), outer = orbs.filter((_, i) => i % 2 === 1);
      const ring = (list, cls, off) => `<div class="ring ${cls}"><div class="spin">${list.map((o, i) => `<div class="slot" style="--ang:${(off + (360 / list.length) * i).toFixed(1)}deg"><div class="unrot"><div class="counter"><div class="pop2" ${D(0.4 + i * 0.12 + (cls === 'r2' ? 0.2 : 0))}>${orb(o, i + (cls === 'r2' ? 1 : 0), ctx)}</div></div></div></div>`).join('')}</div></div>`;
      const center = (s.center ?? [s.headline ?? '']).map((l, i) => `<div class="c-line">${words(l, 0.5 + i * 0.35, 0.08)}</div>`).join('');
      html = `<div class="orbit-wrap"><div class="ring r0 pin" ${D(0.1)}></div>${ring(inner, 'r1', 20)}${ring(outer, 'r2', 0)}<div class="o-center pin" ${D(0.3)}>${center}</div></div>`;
      break;
    }
    case 'card': {
      const a = acc(s.accent, 'red');
      const bullets = (s.bullets ?? []).slice(0, 6);
      const card = `<div class="col"><div class="gcard g-${a} pin" ${D(0.15)}>
          ${s.number != null ? `<span class="num-badge">${esc(s.number)}</span>` : s.icon ? `<span class="num-badge">${icon(s.icon)}</span>` : ''}
          <div class="gc-text">${s.kicker ? `<small>${esc(s.kicker)}</small>` : ''}<b>${rich(s.title)}</b></div>
          ${s.progress != null ? `<div class="prog"><span style="--p:${Math.max(0, Math.min(1, s.progress))}"></span>${[0, 1, 2, 3].map((k) => `<em style="left:${k * 33.33}%"></em>`).join('')}</div><div class="prog-l"><span>${esc(s.progress_label?.[0] ?? '')}</span><span>${esc(s.progress_label?.[1] ?? '')}</span></div>` : ''}
        </div>
        ${bullets.length ? `<ul class="bul">${bullets.map((b, i) => `<li class="pin" ${D(0.7 + i * 0.22)}><i class="dot d-${a}"></i>${rich(b)}</li>`).join('')}</ul>` : ''}</div>`;
      html = s.chart ? `<div class="split wide">${card}${chartPanel(s.chart, ctx, 0.45)}</div>` : s.phone ? `<div class="split">${card}${phone(s.phone, ctx, 0.4)}</div>` : `<div class="col center narrow">${card}</div>`;
      break;
    }
    case 'chart':
      html = `<div class="col center">${head(s.heading)}${chartPanel({ label: s.label, trend: s.trend, seed: s.seed }, ctx, 0.35)}</div>`;
      break;
    case 'chat': {
      const msgs = (s.messages ?? []).slice(0, 5);
      html = `<div class="col center chat">${head(s.heading)}${msgs.map((m, i) => {
        const me = m.from === 'user';
        return `<div class="msg ${me ? 'me' : 'them'} pin" ${D(0.3 + i * 0.9)}><div class="who">${esc(m.name ?? (me ? 'You' : 'ABET Coach'))}</div><div class="bubble">${rich(m.text)}</div>${me ? `<span class="av">${icon('user')}</span>` : `<span class="av brand"><img src="${ctx.file('brand/logos/abet-mark-96.png')}" alt=""></span>`}</div>`;
      }).join('')}</div>`;
      break;
    }
    case 'points':
      html = `<div class="col ${ctx.land ? '' : 'center'}">${head(s.heading, 0.1)}<div class="plist">${(s.points ?? []).slice(0, 5).map((p, i) => {
        const o = typeof p === 'string' ? { text: p } : p;
        return `<div class="pt pin" ${D(0.5 + i * 0.25)}>${orb({ icon: o.icon ?? ['check', 'shield', 'trend', 'book', 'target'][i % 5], color: o.color }, i, ctx)}<span>${rich(o.text)}</span></div>`;
      }).join('')}</div></div>`;
      break;
    case 'steps':
      html = `<div class="col center">${head(s.heading, 0.1)}<div class="steps n${(s.steps ?? []).length}"><div class="track"><span></span></div>${(s.steps ?? []).slice(0, 6).map((st, i) => `<div class="step pin" ${D(0.5 + i * 0.35)}><span class="num-badge sm">${i + 1}</span><b>${rich(st.title)}</b>${st.text ? `<p>${rich(st.text)}</p>` : ''}</div>`).join('')}</div></div>`;
      break;
    case 'compare': {
      const col = (c, i, a) => `<div class="cmp pin" ${D(0.4 + i * 0.3)}><div class="cmp-h c-${a}">${rich(c.title)}</div>${(c.points ?? []).map((p) => `<div class="cmp-p">${icon(a === 'green' ? 'check' : 'bolt', 'ic s')}<span>${rich(p)}</span></div>`).join('')}</div>`;
      html = `<div class="col center">${head(s.heading, 0.1)}<div class="cmp-wrap">${col(s.left, 0, acc(s.left?.accent, 'red'))}${col(s.right, 1, acc(s.right?.accent, 'green'))}</div></div>`;
      break;
    }
    case 'image':
      html = `<div class="col center">${head(s.heading, 0.1)}<div class="panel3d img pin" ${D(0.35)}><img src="${esc(ctx.asset(s.src))}" alt=""></div>${s.caption_text ? `<p class="sub pin" ${D(0.8)}>${rich(s.caption_text)}</p>` : ''}</div>`;
      break;
    case 'cta':
      html = `<div class="col center">${kick(s.kicker)}<h1 class="mega">${words(s.headline, 0.15, 0.09)}</h1>${s.action ? `<div class="cta pin" ${D(0.9)}>${icon('play', 'ic s')}${esc(s.action)}</div>` : ''}<p class="url pin" ${D(1.2)}>${esc(s.url ?? 'abetglobal.com')}</p></div>`;
      break;
    default: html = '';
  }
  return `<div class="cam">${html}</div>`;
}

function chrome(ctx) {
  return `<div class="bg"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="blob b4"></div><div class="grain"></div><div class="vig"></div></div>`;
}

/** Style settings from a style built from references (plan.tokens). Values are checked so a plan can't inject CSS. */
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/;
const FONTS = { poppins: 'Poppins', 'space grotesk': 'Space Grotesk' };
function tokenCss(tk = {}) {
  const c = (v) => (typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : null);
  let out = '';
  const root = [['bg', '--bg'], ['text', '--fg'], ['muted', '--mute'], ['glass', '--glass'], ['line', '--line'], ['panel', '--panel']]
    .map(([k, v]) => (c(tk[k]) ? `${v}:${c(tk[k])};` : '')).join('');
  if (root) out += `:root{${root}}`;
  for (const [k, pair] of Object.entries(tk.accents ?? {})) {
    if (!/^[a-z]+$/.test(k) || !Array.isArray(pair) || !c(pair[0]) || !c(pair[1] ?? pair[0])) continue;
    const [c1, c2] = [c(pair[0]), c(pair[1] ?? pair[0])];
    out += `.ac-${k}{--a1:${c1};--a2:${c2}} .o-${k}{--o1:${c1};--o2:${c2}} .g-${k}{--g1:${c1};--g2:${c2}} .d-${k}{background:${c1}} .c-${k}{color:${c1}}`;
    if (k === 'red' || k === 'primary') out += `:root{--a1:${c1};--a2:${c2}}`;
  }
  (tk.glows ?? []).slice(0, 4).forEach((g, i) => { if (c(g)) out += `.b${i + 1}{background:radial-gradient(closest-side,${c(g)},transparent)}`; });
  const font = FONTS[String(tk.heading_font ?? '').toLowerCase()];
  if (font) out += `.mega,.h,.giant,.c-line,.gc-text b,.cmp-h,.step b,.lead{font-family:'${font}',Poppins,sans-serif}`;
  const r = Number(tk.radius);
  if (r >= 0 && r <= 6) out += `.gcard,.panel3d,.pt,.step,.cmp,.bubble,.ph-balance{border-radius:${r}vmin}`;
  if (tk.background === 'plain') out += '.blob{display:none}';
  if (tk.background === 'grid') out += '.bg::before{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:8vmin 8vmin;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}';
  if (tk.motion === 'snappy') out += '.pin,.w,.pop2{animation-duration:.55s!important}';
  if (tk.motion === 'slow') out += '.pin,.w,.pop2{animation-duration:1.4s!important}';
  if (tk.captions === 'none') out += '.caption{display:none!important}';
  return out;
}

function css(ctx) {
  const th = ctx.theme === 'light' ? 'light' : 'dark';
  const A = ACC[th];
  const accVars = Object.entries(A).map(([k, [c1, c2]]) => `.ac-${k}{--a1:${c1};--a2:${c2}} .o-${k}{--o1:${c1};--o2:${c2}} .g-${k}{--g1:${c1};--g2:${c2}} .d-${k}{background:${c1}} .c-${k}{color:${c1}}`).join('\n');
  const dark = th === 'dark';
  return `
:root{--bg:${dark ? '#06070A' : '#F3F3F5'};--fg:${dark ? '#F5F6F8' : '#15171C'};--mute:${dark ? '#9AA0AC' : '#5D626E'};--glass:${dark ? 'rgba(255,255,255,.055)' : 'rgba(255,255,255,.72)'};--line:${dark ? 'rgba(255,255,255,.10)' : 'rgba(20,22,28,.08)'};--panel:${dark ? 'rgba(14,16,21,.92)' : '#FFFFFF'};--a1:${A.red[0]};--a2:${A.red[1]};--ease:cubic-bezier(.22,.9,.24,1)}
${accVars}
*{box-sizing:border-box;margin:0;padding:0}html,body{overflow:hidden}
body{position:relative;background:var(--bg);color:var(--fg);font-family:Poppins,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.bg{position:absolute;inset:0;overflow:hidden}
.blob{position:absolute;border-radius:50%;transform-origin:center;-webkit-mask-image:radial-gradient(closest-side,#000 0%,rgba(0,0,0,.75) 25%,rgba(0,0,0,.35) 55%,rgba(0,0,0,.1) 78%,transparent 100%);opacity:1;animation:float var(--total) linear 0s both}
.b1{width:95vmin;height:80vmin;left:-25vmin;top:-35vmin;background:radial-gradient(closest-side,${dark ? 'rgba(190,40,30,.55)' : 'rgba(255,190,180,.75)'},transparent)}
.b2{width:110vmin;height:90vmin;right:-40vmin;bottom:-45vmin;background:radial-gradient(closest-side,${dark ? 'rgba(10,120,100,.38)' : 'rgba(215,220,235,.95)'},transparent);animation-direction:reverse}
.b3{width:80vmin;height:70vmin;right:-10vmin;top:-30vmin;background:radial-gradient(closest-side,${dark ? 'rgba(40,70,170,.30)' : 'rgba(255,225,215,.8)'},transparent);animation-duration:calc(var(--total) * 1.3)}
.b4{width:70vmin;height:60vmin;left:15vmin;bottom:-40vmin;background:radial-gradient(closest-side,${dark ? 'rgba(170,30,30,.22)' : 'rgba(174,24,24,.10)'},transparent);animation-direction:reverse;animation-duration:calc(var(--total) * .8)}
@keyframes float{0%{transform:translate(0,0) scale(1)}50%{transform:translate(8vmin,5vmin) scale(1.08)}100%{transform:translate(-4vmin,9vmin) scale(1)}}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,${dark ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.35)'})}
.grain{position:absolute;inset:0;opacity:${dark ? '.05' : '.03'};background-image:repeating-radial-gradient(circle at 17% 23%,#fff 0 1px,transparent 1px 3px)}
.corner-logo{position:absolute;right:4.5vmin;top:4vmin;height:3.6vmin;z-index:5;opacity:.9}
.port .corner-logo{top:7vmin;right:6vmin;height:4.2vmin}
.progress{display:none}

.scene{position:absolute;inset:0;display:none;animation:sOut var(--xf) cubic-bezier(.4,0,1,1) var(--e) forwards}
@keyframes sOut{to{opacity:0;filter:blur(2.2vmin);transform:scale(1.05)}}
.cam{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12vmin 10vmin 17vmin;animation:push var(--dur) linear var(--s) both}
.port .cam{padding:20vmin 7vmin 30vmin}
.out-slides .cam,.out-pdf .cam{animation:none;padding:12vmin 9vmin}
@keyframes push{from{transform:scale(1)}to{transform:scale(1.045)}}

/* entrances: blur to focus */
.pin{animation:pin 1s var(--ease) calc(var(--s) + var(--d,0s)) both}
@keyframes pin{from{opacity:0;filter:blur(1.6vmin);transform:translateY(3vmin) scale(.97)}to{opacity:1;filter:blur(0);transform:none}}
.w{display:inline-block;animation:win .9s var(--ease) calc(var(--s) + var(--d,0s)) both;white-space:pre}
@keyframes win{from{opacity:0;filter:blur(1.4vmin);transform:translateY(.35em)}to{opacity:1;filter:blur(0);transform:none}}
.kw{background:linear-gradient(180deg,var(--a1),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent}
.pop2{animation:pop2 .9s var(--ease) calc(var(--s) + var(--d,0s)) both}
@keyframes pop2{from{opacity:0;transform:scale(.4);filter:blur(1vmin)}to{opacity:1;transform:none;filter:none}}

.col{display:flex;flex-direction:column;gap:2.6vmin;max-width:150vmin;min-width:0}
.col.center{align-items:center;text-align:center}
.col.narrow{width:min(100%,95vmin)}
.split{display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:8vmin;width:100%;max-width:160vmin}
.split.wide{grid-template-columns:.85fr 1.15fr}
.port .split,.a-1x1 .split{grid-template-columns:1fr;gap:5vmin;justify-items:center;text-align:center}
.port .split .col,.a-1x1 .split .col{align-items:center}
.col .kick{align-self:flex-start}.col.center .kick,.port .split .kick{align-self:center}
.kick{display:inline-flex;align-items:center;gap:1.4vmin;font:600 2vmin/1 Poppins;letter-spacing:.24em;text-transform:uppercase;color:var(--mute);padding:1.2vmin 2vmin;border:1px solid var(--line);border-radius:10vmin;background:var(--glass)}
.kick i{width:1.1vmin;height:1.1vmin;border-radius:50%;background:var(--a1);box-shadow:0 0 1.6vmin var(--a1)}
.mega{font:500 9.4vmin/1.04 Poppins,sans-serif;letter-spacing:-.045em;max-width:140vmin;text-wrap:balance}
.mega.left{text-align:left}
.port .mega{font-size:10.5vmin}
.h{font:500 6vmin/1.1 Poppins;letter-spacing:-.035em;text-wrap:balance}
.port .h{font-size:7vmin}
.sub{font:400 3vmin/1.5 Poppins;color:var(--mute);max-width:100vmin;text-wrap:balance}
.lead{font:500 3.8vmin/1.3 Poppins;max-width:110vmin;text-wrap:balance}
.giant{font:600 20vmin/1 Poppins;letter-spacing:-.06em;background:linear-gradient(180deg,var(--a1),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 4vmin color-mix(in srgb,var(--a1) 45%,transparent))}
.port .giant{font-size:19vmin}
.url{font:500 2.6vmin/1.3 Poppins;color:var(--mute)}

/* logo */
.logo-scene{position:relative;gap:3vmin}
.logo-box{position:relative;z-index:1;-webkit-mask-size:100% 100%;mask-size:100% 100%;filter:drop-shadow(0 0 5vmin rgba(225,50,40,${dark ? '.55' : '.25'}))}
.big-logo{height:22vmin;display:block}
.t-__end .big-logo{height:14vmin}
.logo-glow{position:absolute;width:90vmin;height:30vmin;left:50%;top:50%;transform:translate(-50%,-70%);background:radial-gradient(closest-side,rgba(220,45,35,${dark ? '.35' : '.15'}),transparent);animation:pin 1.6s var(--ease) var(--s) both}
.sweep{position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,${dark ? '.18' : '.6'}) 50%,transparent 60%);transform:translateX(-100%);animation:sweep 1.8s ease-in-out calc(var(--s) + .8s) both;mix-blend-mode:${dark ? 'screen' : 'overlay'};pointer-events:none}
@keyframes sweep{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.tag{font:600 2.2vmin/1 Poppins;letter-spacing:.42em;text-transform:uppercase;color:var(--mute)}
.risk{font:400 2vmin/1.5 Poppins;color:var(--mute);max-width:110vmin}
.reg{font:400 1.7vmin/1.5 Poppins;color:var(--mute);opacity:.8;max-width:110vmin}

/* phone */
.phone-wrap{perspective:220vmin;display:flex;justify-content:center}
.phone{width:29vmin;aspect-ratio:9/19;border-radius:6.5vmin;background:${dark ? 'linear-gradient(160deg,#16181E,#0B0C10)' : 'linear-gradient(160deg,#FFFFFF,#F2F3F6)'};border:.6vmin solid ${dark ? '#2A2D35' : '#D9DBE1'};box-shadow:0 6vmin 12vmin rgba(0,0,0,${dark ? '.6' : '.18'}),inset 0 0 0 .3vmin ${dark ? '#000' : '#fff'};padding:3.4vmin 2.6vmin;display:flex;flex-direction:column;gap:1.5vmin;transform:rotateY(-16deg) rotateX(5deg) rotateZ(2deg);animation:tilt var(--dur) ease-in-out var(--s) both;position:relative;overflow:hidden}
.port .phone{width:44vmin}.port .split .col + .phone-wrap .phone,.port .gcard ~ * .phone{width:38vmin}.a-1x1 .phone{width:30vmin}
@keyframes tilt{from{transform:rotateY(-20deg) rotateX(7deg) rotateZ(3deg) translateY(1vmin)}to{transform:rotateY(-10deg) rotateX(3deg) rotateZ(1deg) translateY(-1vmin)}}
.ph-island{position:absolute;top:1.4vmin;left:50%;transform:translateX(-50%);width:12vmin;height:3vmin;border-radius:2vmin;background:#000}
.ph-status{display:flex;justify-content:space-between;font:600 1.5vmin/1 Poppins;color:var(--mute);padding:0 1vmin;margin-top:-1.4vmin}
.ph-head{display:flex;align-items:center;gap:1.2vmin;margin-top:1.4vmin}
.ph-head img{height:2.6vmin}.ph-head b{font:600 2.2vmin/1 Poppins;flex:1}
.ph-head i{font:700 1.2vmin/1 Poppins;font-style:normal;letter-spacing:.1em;color:#0B0C10;background:#3BE08E;padding:.6vmin 1vmin;border-radius:1vmin}
.ph-balance{border-radius:2.2vmin;padding:1.8vmin 2vmin;background:${dark ? 'linear-gradient(135deg,rgba(255,255,255,.09),rgba(255,255,255,.03))' : 'linear-gradient(135deg,#F7F7F9,#ECEDF1)'};border:1px solid var(--line);display:flex;flex-direction:column;gap:.6vmin}
.ph-balance small{font:400 1.3vmin/1 Poppins;color:var(--mute)}.ph-balance b{font:600 3vmin/1 Poppins;letter-spacing:-.03em}
.ph-row,.ph-note{display:flex;align-items:center;gap:1.2vmin;padding:1.2vmin 1.3vmin;border-radius:1.8vmin;background:${dark ? 'rgba(255,255,255,.04)' : '#fff'};border:1px solid var(--line)}
.ph-row.hot{background:linear-gradient(90deg,#E0383B,#FF6A4D);border-color:transparent;box-shadow:0 0 4vmin rgba(240,70,60,.55);color:#fff}
.ph-row.hot small{color:rgba(255,255,255,.8)}
.ph-sym{flex:none;width:3.6vmin;height:3.6vmin;border-radius:50%;display:grid;place-items:center;font:700 1.4vmin/1 Poppins;color:#fff;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.55),transparent 40%),linear-gradient(160deg,var(--o1),var(--o2))}
.ph-sym .ic{width:2vmin;height:2vmin}
.ph-name{flex:1;display:flex;flex-direction:column;gap:.3vmin;min-width:0}.ph-name b{font:600 1.6vmin/1.1 Poppins}.ph-name small{font:400 1.2vmin/1.2 Poppins;color:var(--mute)}
.ph-spark{width:8vmin;height:2.6vmin}.ph-spark polyline{fill:none;stroke-width:2.2;stroke-linejoin:round}.ph-spark.up polyline{stroke:#3BE08E}.ph-spark.dn polyline{stroke:#FF5A4D}
.ph-row.hot .ph-spark polyline{stroke:#fff}
.ph-price{font:600 1.5vmin/1 Poppins;min-width:7vmin;text-align:right}
.ph-note{align-items:flex-start}

/* orbit */
.orbit-wrap{position:relative;width:min(88vmin,100%);aspect-ratio:1}
.port .orbit-wrap{width:84vmin}
.ring{position:absolute;border-radius:50%;border:.25vmin solid ${dark ? 'rgba(255,255,255,.14)' : 'rgba(174,24,24,.22)'}}
.r0{inset:31%;background:radial-gradient(circle,${dark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.8)'},transparent 70%)}
.r1{inset:17%}.r2{inset:0}
.spin{position:absolute;inset:0;animation:spin 60s linear var(--s) both}
.r2 .spin{animation-duration:90s;animation-direction:reverse}
@keyframes spin{to{transform:rotate(360deg)}}
.slot{position:absolute;left:50%;top:50%;width:0;height:0;transform:rotate(var(--ang)) translateY(calc(var(--rad) * -1))}
.r1 .slot{--rad:min(29vmin,calc(88vmin * .33))}.r2 .slot{--rad:min(44vmin,calc(88vmin * .5))}
.port .r1 .slot{--rad:27.7vmin}.port .r2 .slot{--rad:42vmin}
.unrot{transform:rotate(calc(var(--ang) * -1))}
.counter{animation:spin 60s linear var(--s) both reverse}
.r2 .counter{animation-duration:90s;animation-direction:normal}
.counter>div{position:absolute;left:-4.5vmin;top:-4.5vmin}
.orb{width:9vmin;height:9vmin;border-radius:50%;display:grid;place-items:center;color:#fff;background:radial-gradient(circle at 32% 26%,rgba(255,255,255,.75) 0,rgba(255,255,255,.12) 22%,transparent 40%),radial-gradient(circle at 50% 120%,rgba(0,0,0,.35),transparent 60%),linear-gradient(160deg,var(--o1),var(--o2));box-shadow:0 1.6vmin 4vmin color-mix(in srgb,var(--o2) 55%,transparent),inset 0 -.8vmin 1.6vmin rgba(0,0,0,.25)}
.orb .ic{width:4.2vmin;height:4.2vmin}.orb b{font:700 3vmin/1 Poppins;letter-spacing:-.03em}
.o-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6vmin;text-align:center}
.c-line{font:500 4.6vmin/1.15 Poppins;letter-spacing:-.04em}

/* glass card */
.gcard{position:relative;border-radius:3.2vmin;padding:3.4vmin 3.6vmin;display:grid;grid-template-columns:auto 1fr;gap:1.6vmin 2.6vmin;align-items:center;color:#fff;background:linear-gradient(135deg,var(--g1),var(--g2));box-shadow:0 3vmin 8vmin color-mix(in srgb,var(--g2) 50%,transparent),inset 0 .2vmin 0 rgba(255,255,255,.35);min-width:min(64vmin,100%)}
.gcard::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(160deg,rgba(255,255,255,.28),transparent 45%);pointer-events:none}
.num-badge{width:9vmin;height:9vmin;border-radius:50%;display:grid;place-items:center;font:600 4.6vmin/1 Poppins;color:#fff;background:radial-gradient(circle at 32% 26%,rgba(255,255,255,.6),rgba(255,255,255,.12) 45%,rgba(0,0,0,.12));box-shadow:inset 0 0 0 .25vmin rgba(255,255,255,.35)}
.num-badge .ic{width:4.4vmin;height:4.4vmin}
.num-badge.sm{width:6.4vmin;height:6.4vmin;font-size:3vmin;background:linear-gradient(160deg,var(--a1),var(--a2))}
.gc-text{display:flex;flex-direction:column;gap:.6vmin}.gc-text small{font:600 1.7vmin/1 Poppins;letter-spacing:.24em;text-transform:uppercase;opacity:.85}.gc-text b{font:500 4.4vmin/1.1 Poppins;letter-spacing:-.035em}
.prog{grid-column:1/-1;position:relative;height:.9vmin;border-radius:1vmin;background:rgba(255,255,255,.28);margin-top:1vmin}
.prog span{position:absolute;left:0;top:0;bottom:0;width:calc(var(--p) * 100%);border-radius:inherit;background:#fff;transform-origin:left;animation:grow 1.4s var(--ease) calc(var(--s) + .8s) both}
.prog span::after{content:'';position:absolute;right:-1.1vmin;top:50%;width:2.2vmin;height:2.2vmin;border-radius:50%;background:#fff;transform:translateY(-50%);box-shadow:0 0 1.6vmin rgba(255,255,255,.8)}
.prog em{position:absolute;top:50%;width:1.4vmin;height:1.4vmin;border-radius:50%;background:rgba(255,255,255,.55);transform:translate(-50%,-50%)}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.prog-l{grid-column:1/-1;display:flex;justify-content:space-between;font:500 1.6vmin/1 Poppins;opacity:.85}
.bul{list-style:none;display:flex;flex-direction:column;gap:1.6vmin;padding-left:1vmin}
.bul li{display:flex;align-items:center;gap:1.8vmin;font:500 3vmin/1.3 Poppins}
.dot{width:1.8vmin;height:1.8vmin;border-radius:50%;flex:none;box-shadow:0 0 1.6vmin currentColor}

/* chart panel */
.panel3d{position:relative;border-radius:2.6vmin;padding:4.4vmin 3.4vmin 4vmin;background:var(--panel);border:1px solid var(--line);box-shadow:0 5vmin 10vmin rgba(0,0,0,${dark ? '.55' : '.12'}),0 0 0 .2vmin ${dark ? 'rgba(90,200,170,.12)' : 'rgba(0,0,0,.02)'};transform:perspective(200vmin) rotateY(-12deg) rotateX(4deg);width:min(100%,96vmin)}
.col.center .panel3d{transform:perspective(200vmin) rotateX(10deg)}
.p-label{position:absolute;left:3.4vmin;top:2vmin;font:600 1.6vmin/1 Poppins;letter-spacing:.16em;color:var(--mute)}
.p-foot{position:absolute;right:3vmin;bottom:1.6vmin;font:400 1.4vmin/1 Poppins;color:var(--mute)}
.chart-svg{width:100%;height:40vmin;display:block;overflow:visible}
.port .chart-svg{height:52vmin}
.chart-svg .grid{stroke:var(--line);stroke-width:1.5}
.chart-svg .u{fill:#2BD17E;stroke:#2BD17E;stroke-width:3}.chart-svg .dn{fill:#F0473E;stroke:#F0473E;stroke-width:3}
.cdl{opacity:0;animation:pop2 .5s var(--ease) calc(var(--s) + var(--d) + .3s) both;transform-box:fill-box;transform-origin:center bottom}
.trend{fill:none;stroke:var(--a1);stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 0 6px var(--a1));animation:draw 2s var(--ease) calc(var(--s) + 1.4s) both}
@keyframes draw{to{stroke-dashoffset:0}}
.panel3d.img img{display:block;max-width:100%;max-height:50vmin;border-radius:1.6vmin}

/* chat */
.chat{gap:3vmin;width:min(100%,110vmin)}
.msg{position:relative;display:flex;flex-direction:column;gap:.8vmin;max-width:80%;padding:0 7vmin}
.msg.me{align-self:flex-start;align-items:flex-start;text-align:left}.msg.them{align-self:flex-end;align-items:flex-end;text-align:left}
.who{font:500 1.7vmin/1 Poppins;color:var(--mute)}
.bubble{font:400 2.9vmin/1.45 Poppins;padding:2vmin 2.8vmin;border-radius:2.4vmin;border:1px solid var(--line);background:var(--glass);box-shadow:0 2vmin 5vmin rgba(0,0,0,${dark ? '.35' : '.08'})}
.msg.me .bubble{background:${dark ? 'linear-gradient(135deg,#1B3A6B,#162A4C)' : 'linear-gradient(135deg,#E9EEF9,#DDE5F6)'};border-color:transparent}
.bubble em{font-style:normal;color:var(--a1);font-weight:600}
.av{position:absolute;bottom:.4vmin;width:5vmin;height:5vmin;border-radius:50%;display:grid;place-items:center;background:var(--glass);border:1px solid var(--line);color:var(--mute)}
.av .ic{width:2.6vmin;height:2.6vmin}.av img{width:3vmin}
.msg.me .av{left:0}.msg.them .av{right:0;background:${dark ? '#fff' : '#191B22'}}

/* points */
.plist{display:flex;flex-direction:column;gap:2vmin;min-width:min(80vmin,100%)}
.pt{display:flex;align-items:center;gap:2.6vmin;padding:1.8vmin 3vmin 1.8vmin 1.8vmin;border-radius:3vmin;background:var(--glass);border:1px solid var(--line);font:500 3.4vmin/1.3 Poppins;text-align:left}
.pt .orb{width:7vmin;height:7vmin}.pt .orb .ic{width:3.4vmin;height:3.4vmin}

/* steps */
.steps{position:relative;display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:3vmin;width:min(100%,150vmin)}
.steps.n2{--n:2}.steps.n4{--n:4}.steps.n5,.steps.n6{--n:3}
.port .steps,.a-1x1 .steps{--n:1;gap:2.2vmin}
.track{position:absolute;left:8%;right:8%;top:5.6vmin;height:.3vmin;background:var(--line)}
.track span{position:absolute;inset:0;background:linear-gradient(90deg,var(--a2),var(--a1));transform-origin:left;animation:grow 2s var(--ease) calc(var(--s) + .5s) both;box-shadow:0 0 1.4vmin var(--a1)}
.port .track,.a-1x1 .track{display:none}
.step{position:relative;display:flex;flex-direction:column;align-items:center;gap:1.4vmin;padding:2.4vmin 2.6vmin 3vmin;border-radius:3vmin;background:var(--glass);border:1px solid var(--line);text-align:center}
.port .step,.a-1x1 .step{flex-direction:row;text-align:left;align-items:center;flex-wrap:wrap;column-gap:2.4vmin}
.port .step p,.a-1x1 .step p{flex-basis:100%;padding-left:8.8vmin}
.step b{font:500 3.6vmin/1.2 Poppins;letter-spacing:-.03em}.step p{font:400 2.5vmin/1.45 Poppins;color:var(--mute)}

/* compare */
.cmp-wrap{display:grid;grid-template-columns:1fr 1fr;gap:3.4vmin;width:min(100%,130vmin)}
.port .cmp-wrap{grid-template-columns:1fr}
.cmp{padding:3.4vmin;border-radius:3vmin;background:var(--glass);border:1px solid var(--line);display:flex;flex-direction:column;gap:1.8vmin;text-align:left}
.cmp-h{font:500 4.4vmin/1.1 Poppins;letter-spacing:-.035em}
.cmp-p{display:flex;gap:1.6vmin;align-items:flex-start;font:400 2.8vmin/1.4 Poppins}.cmp-p .ic{width:3vmin;height:3vmin;flex:none;margin-top:.4vmin;color:var(--mute)}

/* cta */
.cta{display:inline-flex;align-items:center;gap:1.6vmin;font:600 3vmin/1 Poppins;color:#fff;padding:2.6vmin 4.6vmin;border-radius:10vmin;background:linear-gradient(135deg,#FF6A4D,#AE1818);box-shadow:0 0 5vmin rgba(240,70,55,.55),inset 0 .2vmin 0 rgba(255,255,255,.4)}
.cta .ic{width:2.6vmin;height:2.6vmin;fill:currentColor}

/* sequence statement */
.seq{position:relative;width:100%;height:30vmin}
.seq-line{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;animation:seqOut .45s ease-in calc(var(--s) + var(--b)) forwards}
.seq-line[style*="--last:1"]{animation:none}
@keyframes seqOut{to{opacity:0;filter:blur(2vmin);transform:scale(1.06)}}

/* captions: word by word */
.caption{position:absolute;left:50%;bottom:6.5vmin;transform:translateX(-50%);max-width:82%;padding:1.5vmin 3vmin;border-radius:10vmin;background:${dark ? 'rgba(14,15,20,.72)' : 'rgba(255,255,255,.85)'};border:1px solid var(--line);box-shadow:0 1.6vmin 4vmin rgba(0,0,0,${dark ? '.4' : '.08'});font:500 2.7vmin/1.35 Poppins;text-align:center;z-index:6;opacity:0;white-space:nowrap}
.port .caption{bottom:18vmin;font-size:3.6vmin;white-space:normal;width:max-content;max-width:86%}
.cw{color:var(--fg);opacity:.32;filter:blur(.12vmin)}
.cw.on{opacity:1;filter:none}
.cw.kw.on{color:var(--a1)}
${tokenCss(ctx.plan?.tokens)}
`;
}

export default {
  xf: 0.6,
  types: ['logo', 'bigstat', 'phone', 'orbit', 'card', 'chat'],
  css,
  chrome,
  scene,
};
