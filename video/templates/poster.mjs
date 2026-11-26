/**
 * ABET Posters: static posters, social/paid ads, print (A4/A3) and carousels in seven looks, adapted to
 * ABET red from the owner's references (26 Nov 2026):
 *   red-neon        Orizon: black, red neon pillars, tilted glass stat cards
 *   spotlight       Trade Zone: warm spotlight, curved app screen / phone with quote cards, pedestal
 *   glass-cards     opnr: glowing spheres, numbered glass cards with icons (also carousels)
 *   hero-campaign   Zenith + CoinGuard: centred two-tone headline, pill CTA, one big hero object; dark or light
 *   glass-objects   Velox: translucent glass objects, label chips, huge ABET watermark
 *   trader-spotlight AG Crypto: hanging lamp, light cone, trader silhouette at a chart monitor
 *   torn-reveal     Swing Trading Blueprint: torn-paper engraved band, big headline, bullet box, social footer
 * Everything is drawn in HTML/CSS/SVG (no photos). Prices and charts are always labelled illustrative.
 */

const STYLES = ['red-neon', 'spotlight', 'glass-cards', 'hero-campaign', 'glass-objects', 'trader-spotlight', 'torn-reveal'];
const DEFAULT_HERO = { 'red-neon': 'stats', spotlight: 'screen', 'glass-cards': 'none', 'hero-campaign': 'shield', 'glass-objects': 'candles', 'trader-spotlight': 'trader', 'torn-reveal': 'none' };

const ICON = {
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.3 0 4 1.3 4.8 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  candles: '<path d="M7 4v16M17 4v16"/><rect x="5" y="8" width="4" height="7" rx="1"/><rect x="15" y="6" width="4" height="9" rx="1"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  wallet: '<path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H4z"/><path d="M4 7l11-3v3"/><circle cx="16" cy="13.5" r="1.3"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  arrow: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
};
const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[n] ?? ICON.star}</svg>`;

function spark(seed, n = 9, up = true) {
  let x = seed * 9301 + 49297; const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  let v = 30; const pts = [];
  for (let i = 0; i < n; i++) { v = Math.max(8, Math.min(92, v + (up ? 7 : -3) + (r() - 0.45) * 22)); pts.push(v); }
  return pts;
}

// ------------------------------------------------------------------ hero objects
const H = {
  candles(o, ctx, glass) {
    const hs = o.heights ?? [46, 70, 58, 88, 64];
    return `<div class="h-candles${glass ? ' glass' : ''}">${hs.map((h, i) => `<span class="cdl${i % 3 === 2 ? ' dn' : ''}" style="--h:${h}%;--i:${i}"><i></i></span>`).join('')}</div>`;
  },
  coins(o) {
    const syms = o.symbols ?? ['$', '€', '£', 'Au'];
    return `<div class="h-coins">${syms.slice(0, 5).map((s, i) => `<span class="coin c${i}"><b>${s}</b></span>`).join('')}</div>`;
  },
  shield() {
    return `<div class="h-shield"><svg viewBox="0 0 200 230"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a1)"/><stop offset="1" stop-color="var(--a3)"/></linearGradient><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="M100 8l84 30v62c0 56-36 101-84 122C52 201 16 156 16 100V38z" fill="url(#sg)"/><path d="M100 8l84 30v62c0 56-36 101-84 122C52 201 16 156 16 100V38z" fill="url(#sh)"/>
      <path d="M100 26l66 24v50c0 45-28 82-66 99-38-17-66-54-66-99V50z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>
      <path d="M62 112l26 26 52-56" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>${H.coins({ symbols: ['$', '€'] })}</div>`;
  },
  safe() {
    return `<div class="h-safe"><div class="box"><div class="door"><span class="dial"></span><span class="handle"></span></div><div class="bars">${'<i></i>'.repeat(6)}</div></div></div>`;
  },
  globe() {
    return `<div class="h-globe"><svg viewBox="0 0 200 200"><defs><radialGradient id="gg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="var(--a1)"/><stop offset="1" stop-color="var(--a3)"/></radialGradient></defs>
      <circle cx="100" cy="100" r="90" fill="url(#gg)"/><g fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"><ellipse cx="100" cy="100" rx="90" ry="34"/><ellipse cx="100" cy="100" rx="40" ry="90"/><path d="M10 100h180M100 10v180"/><ellipse cx="100" cy="100" rx="76" ry="90"/></g>
      <ellipse cx="70" cy="58" rx="34" ry="18" fill="#fff" opacity=".18"/></svg></div>`;
  },
  hourglass() {
    return `<div class="h-glass-obj"><svg viewBox="0 0 160 220"><rect x="20" y="6" width="120" height="14" rx="6" fill="var(--a1)"/><rect x="20" y="200" width="120" height="14" rx="6" fill="var(--a1)"/>
      <path d="M34 22c0 40 46 58 46 88S34 158 34 198h92c0-40-46-58-46-88s46-48 46-88z" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
      <path d="M48 196c6-22 32-30 32-50 0 20 26 28 32 50z" fill="var(--a1)"/><path d="M56 40h48c-6 14-24 22-24 34 0-12-18-20-24-34z" fill="var(--a1)" opacity=".8"/></svg></div>`;
  },
  padlock() {
    return `<div class="h-glass-obj"><svg viewBox="0 0 180 220"><path d="M50 96V64a40 40 0 0180 0v32" fill="none" stroke="#C8CBD3" stroke-width="18"/><rect x="22" y="92" width="136" height="116" rx="22" fill="var(--a1)"/>
      <rect x="22" y="92" width="136" height="50" rx="22" fill="#fff" opacity=".18"/><circle cx="90" cy="142" r="14" fill="#fff"/><rect x="84" y="148" width="12" height="30" rx="5" fill="#fff"/></svg></div>`;
  },
  scales() {
    return `<div class="h-glass-obj"><svg viewBox="0 0 220 220"><rect x="104" y="30" width="12" height="150" rx="6" fill="#C8CBD3"/><rect x="60" y="186" width="100" height="16" rx="8" fill="#C8CBD3"/><circle cx="110" cy="26" r="10" fill="var(--a1)"/>
      <path d="M30 60h160" stroke="#C8CBD3" stroke-width="8" stroke-linecap="round"/><path d="M30 60l-22 60h44zM190 60l-22 60h44z" fill="none" stroke="#C8CBD3" stroke-width="3"/>
      <path d="M4 120a26 12 0 0052 0z" fill="var(--a1)"/><path d="M164 120a26 12 0 0052 0z" fill="var(--a1)"/></svg></div>`;
  },
  stats(o, ctx) {
    const cards = (o.cards ?? [{ label: 'EUR/USD', value: '+1.2%' }, { label: 'XAU/USD', value: '+0.8%' }]).slice(0, 2);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'];
    return `<div class="h-stats">${cards.map((c, k) => {
      const p = spark(k + 3, 7); const pts = p.map((v, i) => `${(i / 6) * 100},${100 - v}`).join(' ');
      return `<div class="scard s${k}"><small>${ctx.esc(c.kicker ?? 'ILLUSTRATIVE')}</small><b>${ctx.esc(c.value)}</b><span class="lbl">${ctx.esc(c.label)}</span>
        <svg viewBox="0 -5 100 110" preserveAspectRatio="none"><polygon points="0,105 ${pts} 100,105" fill="url(#fillR)"/><polyline points="${pts}" fill="none" stroke="var(--a1)" stroke-width="2.4" vector-effect="non-scaling-stroke"/>${p.map((v, i) => `<line x1="${(i / 6) * 100}" x2="${(i / 6) * 100}" y1="${100 - v}" y2="105" stroke="var(--a1)" stroke-opacity=".5" vector-effect="non-scaling-stroke"/>`).join('')}</svg>
        <div class="months">${months.map((m) => `<i>${m}</i>`).join('')}</div></div>`;
    }).join('')}<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="fillR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--a1)" stop-opacity=".55"/><stop offset="1" stop-color="var(--a1)" stop-opacity="0"/></linearGradient></defs></svg></div>`;
  },
  screen(o, ctx) {
    const tiles = (o.tiles ?? ['Range', 'Session', 'Levels']).slice(0, 3);
    return `<div class="h-screen"><div class="scr"><div class="scr-top"><b>${ctx.esc(o.title ?? 'Workspace')}</b><span class="srch">Search</span></div>
      <div class="scr-tabs">${(o.tabs ?? ['Charts', 'Watchlist', 'Notes', 'Learn']).map((t) => `<i>${ctx.esc(t)}</i>`).join('')}</div>
      <div class="scr-grid"><div class="scr-main"><small>${ctx.esc(o.small ?? 'New session')}</small><b>${ctx.rich(o.main ?? 'Plan it before the open')}</b><span class="mini-btn">Open notes</span></div>${tiles.map((t) => `<div class="scr-tile">${ic('trend')}<span>${ctx.esc(t)}</span></div>`).join('')}</div></div>
      <div class="pedestal"><div class="top"></div>${H.candles({ heights: [40, 66, 52, 80, 58] }, ctx, true)}</div></div>`;
  },
  phone(o, ctx) {
    const qs = (o.quotes ?? []).slice(0, 3);
    return `<div class="h-phone"><div class="ph"><div class="ph-notch"></div>${qs.map((q) => `<div class="ph-row"><span>${ic('candles')}</span><div><b>${ctx.esc(q.name)}</b><p>${ctx.esc(q.text)}</p></div></div>`).join('')}</div>
      <div class="qcards">${qs.map((q, i) => `<div class="qcard q${i}"><span class="qi">${ic('candles')}</span><div><b>${ctx.esc(q.name)}</b><i>now</i><p>“${ctx.esc(q.text)}”</p></div></div>`).join('')}</div></div>`;
  },
  trader() {
    const p = spark(7, 40); const pts = p.map((v, i) => `${(i / 39) * 300},${90 - v * 0.8}`).join(' ');
    return `<div class="h-trader"><div class="lamp"><i class="cord"></i><i class="shade"></i><i class="cone"></i></div>
      <div class="arrow-up"><svg viewBox="0 0 100 60"><path d="M6 52l26-24 16 14 40-36M66 6h22v22" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="desk"><div class="monitor"><svg viewBox="0 0 300 90" preserveAspectRatio="none">${p.map((v, i) => `<rect x="${(i / 39) * 300 - 2}" y="${88 - v * 0.8}" width="4" height="${6 + (i % 5)}" fill="${i % 4 === 1 ? '#F0473E' : '#2BD17E'}"/>`).join('')}<polyline points="${pts}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/></svg></div>
      <svg class="person" viewBox="0 0 120 140"><circle cx="60" cy="38" r="24" fill="#050506"/><path d="M8 140c4-46 26-70 52-70s48 24 52 70z" fill="#050506"/></svg></div></div>`;
  },
  none() { return ''; },
};

function heroOf(s, ctx) {
  const kind = s.hero ?? DEFAULT_HERO[ctx.style];
  const fn = H[kind] ?? H.none;
  const glass = ctx.style === 'glass-objects';
  return `<div class="hero hero-${kind}">${fn(s, ctx, glass)}</div>`;
}

// ------------------------------------------------------------------ copy blocks
function copy(s, ctx, cls = '') {
  const { esc, rich } = ctx;
  return `<div class="copy ${cls}">
    ${s.kicker ? `<div class="kicker">${esc(s.kicker)}</div>` : ''}
    <h1 class="head">${rich(s.headline ?? '')}</h1>
    ${s.sub ? `<p class="sub">${rich(s.sub)}</p>` : ''}
    ${s.points && ctx.style !== 'glass-cards' && ctx.style !== 'torn-reveal' ? `<ul class="ticks">${s.points.slice(0, 4).map((p) => `<li>${ic('check')}<span>${rich(typeof p === 'string' ? p : p.text)}</span></li>`).join('')}</ul>` : ''}
    ${s.cta ? `<div class="cta-row"><span class="cta">${esc(s.cta)}</span><span class="cta-arrow">${ic('arrow')}</span></div>` : ''}
  </div>`;
}
function glassList(s, ctx) {
  return `<div class="glist">${(s.points ?? []).slice(0, 4).map((p, i) => {
    const o = typeof p === 'string' ? { text: p } : p;
    return `<div class="gitem"><span class="gicon">${ic(o.icon ?? ['bulb', 'chart', 'users', 'shield'][i % 4])}</span><div class="gtxt"><b>${ctx.rich(o.text)}</b>${o.note ? `<small>${ctx.rich(o.note)}</small>` : ''}</div><span class="gnum">${String(i + 1).padStart(2, '0')}</span></div>`;
  }).join('')}</div>`;
}
function bulletBox(s, ctx) {
  return `<div class="bbox">${(s.points ?? []).slice(0, 6).map((p) => `<span>${ic('arrow', 'ic chev')}${ctx.rich(typeof p === 'string' ? p : p.text)}</span>`).join('')}</div>`;
}
function chips(s, ctx) {
  return (s.chips ?? []).slice(0, 3).map((c, i) => `<span class="chip ch${i}">${ic(c.icon ?? 'shield')}${ctx.esc(c.text ?? c)}</span>`).join('');
}
function footer(s, ctx) {
  const f = s.footer ?? {};
  const bits = [];
  if (f.handle) bits.push(`<span>${ic('instagram')}${ctx.esc(f.handle)}</span>`);
  if (f.url) bits.push(`<span>${ic('web')}${ctx.esc(f.url)}</span>`);
  return bits.length ? `<div class="social">${bits.join('<i></i>')}</div>` : '';
}

// ------------------------------------------------------------------ scenes
function scene(s, ctx) {
  const style = STYLES.includes(ctx.plan.style) ? ctx.plan.style : 'hero-campaign';
  const c = { ...ctx, style };
  const logo = `<img class="logo" src="${ctx.file(`brand/logos/${ctx.theme === 'light' ? 'abet-wordmark-dark-derived.png' : 'abet-wordmark-white-official.png'}`)}" alt="ABET">`;
  const risk = `<div class="risk">${ic('warn')}<span>${ctx.esc(ctx.plan.risk_text ?? ctx.RISK_SHORT)}</span></div>`;
  const tag = s.tag ? `<span class="tag">${ctx.rich(s.tag)}</span>` : '';

  if (s.type === '__end') {
    return `<div class="poster end"><div class="bgfx"></div>${logo.replace('class="logo"', 'class="logo big"')}<p class="url">abetglobal.com · @abet.global</p>
      <p class="end-risk">${ctx.esc(ctx.RISK_SHORT)}</p><p class="end-reg">${ctx.esc(ctx.REG_LINE)}</p></div>`;
  }
  let body = '';
  switch (style) {
    case 'red-neon':
      body = `<div class="top center">${logo}</div>${copy(s, c, 'center')}${heroOf(s, c)}`; break;
    case 'spotlight':
      body = `<div class="top">${logo}${tag}</div>${copy(s, c, s.hero === 'phone' ? 'left' : 'center')}${heroOf(s, c)}`; break;
    case 'glass-cards':
      body = `<div class="top line">${logo}<i class="rule"></i>${tag}</div>${copy(s, c, 'left')}${glassList(s, c)}<div class="glass-tag">${(s.side ?? ['Learn.', 'Practise.', 'Trade with a plan.']).map((l) => ctx.rich(l)).join('<br>')}<span class="cta-arrow">${ic('arrow')}</span></div>`; break;
    case 'hero-campaign':
      body = `<div class="top center">${logo}</div>${copy(s, c, 'center')}${heroOf(s, c)}`; break;
    case 'glass-objects':
      body = `<div class="watermark">ABET</div><div class="top center">${logo}</div>${copy(s, c, 'left')}${heroOf(s, c)}<div class="chips">${chips(s, c)}</div>`; break;
    case 'trader-spotlight':
      body = `<div class="top">${logo}</div>${s.handle ? `<div class="handle">${ctx.esc(s.handle)}</div>` : ''}${copy(s, c, 'center')}${heroOf(s, c)}`; break;
    case 'torn-reveal':
      body = `<div class="torn"><div class="engrave"></div><div class="bars-bg">${spark(5, 14).map((v) => `<i style="height:${v}%"></i>`).join('')}</div></div><div class="top">${logo}</div>${copy(s, c, 'center torn-copy')}${bulletBox(s, c)}${s.closer ? `<p class="closer">${ctx.rich(s.closer)}</p>` : ''}${footer(s, c)}`; break;
  }
  return `<div class="poster st-${style}"><div class="bgfx"></div>${body}${risk}</div>`;
}

function chrome() { return ''; }

// ------------------------------------------------------------------ styles
function css(ctx) {
  const light = ctx.theme === 'light';
  const style = STYLES.includes(ctx.plan.style) ? ctx.plan.style : 'hero-campaign';
  // second accent per style (kept small): amber, green, gold
  const PAL = {
    red: ['#E5383B', '#FF6A4D', '#8E1013', '229 56 59', '255 120 100', '140 16 19'],
    amber: ['#FF9A3C', '#FFD0A0', '#8A420F', '255 154 60', '255 205 150', '120 60 15'],
    orange: ['#FF6A2C', '#FFB08A', '#8A2A08', '255 106 44', '255 170 130', '130 40 10'],
    blue: ['#2F7BFF', '#8CBCFF', '#0B3A9E', '47 123 255', '140 188 255', '11 58 158'],
    purple: ['#8B5CF6', '#C9B8FF', '#4C1D95', '139 92 246', '201 184 255', '76 29 149'],
    green: ['#22C57A', '#8BFFC0', '#0C6B3C', '34 197 122', '139 255 192', '12 90 50'],
    gold: ['#F5C542', '#FFE38A', '#8A6410', '245 197 66', '255 227 138', '120 90 15'],
  };
  const DEF = { 'red-neon': 'red', spotlight: 'amber', 'glass-cards': 'orange', 'hero-campaign': 'blue', 'glass-objects': 'purple', 'trader-spotlight': 'green', 'torn-reveal': 'gold' };
  const pal = PAL[ctx.plan.palette] ?? PAL[DEF[style]];
  const acc2 = pal[0];
  return `
:root{--bg:${light ? '#F5F5F7' : '#060608'};--fg:${light ? '#15161B' : '#F6F6F8'};--mute:${light ? '#5A5E69' : '#A9ADB7'};
  --a1:${pal[0]};--a2:${pal[1]};--a3:${pal[2]};--g:${pal[3]};--g2:${pal[4]};--g3:${pal[5]};--brand:#E5383B;--acc2:${acc2};--glass:${light ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.06)'};--line:${light ? 'rgba(20,22,28,.1)' : 'rgba(255,255,255,.13)'};
  --ease:cubic-bezier(.2,.8,.2,1)}
*{box-sizing:border-box;margin:0;padding:0}html,body{overflow:hidden}
body{background:var(--bg);color:var(--fg);font-family:Poppins,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.corner-logo,.progress,.caption{display:none!important}
.scene{position:absolute;inset:0;display:none}
.poster{position:absolute;inset:0;overflow:hidden;padding:6vmin 6.5vmin}
.bgfx{position:absolute;inset:0;pointer-events:none}
.top{position:relative;z-index:3;display:flex;align-items:center;gap:2.4vmin;height:5vmin}
.top.center{justify-content:center}
.logo{height:4.4vmin;display:block}
.logo.big{height:13vmin}
.tag{margin-left:auto;font:500 2.1vmin/1 Poppins;padding:1.2vmin 2vmin;border-radius:1.4vmin;border:1px solid var(--line);background:var(--glass);font-style:italic}
.tag em{font-style:italic;font-weight:700;color:var(--fg)}
.copy{position:relative;z-index:3;display:flex;flex-direction:column;gap:2.2vmin;margin-top:5vmin}
.copy.center{align-items:center;text-align:center}
.copy.left{align-items:flex-start;text-align:left;max-width:62%}
.kicker{font:600 1.9vmin/1 Poppins;letter-spacing:.28em;text-transform:uppercase;color:var(--mute)}
.head{font:600 7.2vmin/1.03 Poppins,sans-serif;letter-spacing:-.04em;text-wrap:balance}
.head em{font-style:normal;background:linear-gradient(180deg,var(--a2),var(--a1));-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{font:400 2.7vmin/1.4 Poppins;color:var(--mute);max-width:70vmin;text-wrap:balance}
.sub em{font-style:normal;color:var(--a1);font-weight:500}
.ticks{list-style:none;display:flex;flex-direction:column;gap:1.2vmin}
.ticks li{display:flex;align-items:center;gap:1.4vmin;font:500 2.5vmin/1.3 Poppins}.ticks .ic{width:2.6vmin;height:2.6vmin;color:var(--a1)}
.cta-row{display:flex;align-items:center;gap:1vmin;margin-top:.6vmin}
.cta{font:600 2.3vmin/1 Poppins;padding:1.9vmin 3.6vmin;border-radius:10vmin;background:linear-gradient(180deg,#141418,#0C0C0F);border:1px solid rgb(var(--g) / .55);box-shadow:0 0 3vmin rgb(var(--g) / .35),inset 0 .2vmin 0 rgba(255,255,255,.12);color:#fff}
.cta-arrow{width:6vmin;height:6vmin;border-radius:50%;display:grid;place-items:center;background:linear-gradient(160deg,#FF6A4D,#AE1818);color:#fff;box-shadow:0 0 3vmin rgba(229,56,59,.45)}
.cta-arrow .ic{width:2.8vmin;height:2.8vmin;transform:rotate(90deg)}
.ic{width:100%;height:100%}
.hero{position:absolute;z-index:2;left:0;right:0;bottom:0;height:52%;display:flex;align-items:flex-end;justify-content:center;pointer-events:none}
.risk{position:absolute;z-index:4;right:5vmin;bottom:3.4vmin;max-width:66%;display:flex;align-items:center;gap:1vmin;font:400 1.45vmin/1.35 Poppins;color:var(--mute);padding:1vmin 1.6vmin;border-radius:1.2vmin;background:${light ? 'rgba(255,255,255,.8)' : 'rgba(10,10,12,.72)'};border:1px solid var(--line)}
.risk .ic{width:2vmin;height:2vmin;flex:none;color:var(--brand)}
.slide-n{position:absolute;z-index:6;right:5vmin;top:1.8vmin;font:600 1.9vmin/1 Poppins;color:var(--mute)}
.swipe{position:absolute;z-index:6;left:6vmin;bottom:3.8vmin;font:600 2.1vmin/1 Poppins;color:var(--a1)}
.out-slides .t-__end .swipe{display:none}

/* ---- landscape (1.91:1, 16:9): copy left, hero right */
.land:not(.a-1x1) .copy{max-width:56%;align-items:flex-start!important;text-align:left!important;margin-top:4vmin}
.land:not(.a-1x1) .head{font-size:8.6vmin}.land:not(.a-1x1) .sub{font-size:3.2vmin}
.land:not(.a-1x1) .hero{left:auto;width:46%;height:86%;top:7%;bottom:auto;align-items:center}
.land:not(.a-1x1) .top.center{justify-content:flex-start}
.land:not(.a-1x1) .risk{left:6.5vmin;right:auto;max-width:52%}
/* ---- square */
.a-1x1 .head{font-size:6.4vmin}.a-1x1 .hero{height:46%}.a-1x1 .copy{gap:1.6vmin;margin-top:3.6vmin}
/* ---- tall */
.a-9x16 .copy{margin-top:12vmin}.a-9x16 .head{font-size:8.4vmin}.a-9x16 .hero{height:50%;bottom:6%}.a-9x16 .poster{padding-top:14vmin}
.a-A4 .head,.a-A3 .head{font-size:8vmin}

/* ================= coins, candles, objects ================= */
.coin{position:absolute;width:var(--cs,14vmin);height:var(--cs,14vmin);border-radius:50%;display:grid;place-items:center;color:#fff;
  background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.8),rgba(255,255,255,.1) 26%,transparent 45%),radial-gradient(circle at 50% 120%,rgba(0,0,0,.45),transparent 60%),linear-gradient(150deg,var(--a2),var(--a3));
  box-shadow:0 2vmin 5vmin rgba(0,0,0,.45),inset 0 0 0 .8vmin rgba(255,255,255,.14),0 0 4vmin rgb(var(--g) / .35)}
.coin b{font:700 calc(var(--cs,14vmin)*.42)/1 Poppins;text-shadow:0 .3vmin 0 rgba(0,0,0,.25)}
.h-coins{position:absolute;inset:0}
.h-coins .c0{--cs:16vmin;left:14%;bottom:18%;transform:rotate(-14deg)}.h-coins .c1{--cs:11vmin;right:16%;bottom:44%;transform:rotate(12deg)}
.h-coins .c2{--cs:20vmin;right:22%;bottom:6%}.h-coins .c3{--cs:9vmin;left:30%;bottom:58%;filter:blur(.25vmin)}.h-coins .c4{--cs:7vmin;left:6%;bottom:62%;filter:blur(.4vmin)}
.h-candles{position:relative;display:flex;align-items:flex-end;gap:3.6vmin;height:72%;padding-bottom:4vmin}
.cdl{position:relative;width:6vmin;height:var(--h);display:flex;justify-content:center}
.cdl::before{content:'';position:absolute;left:50%;top:-12%;bottom:-12%;width:.5vmin;transform:translateX(-50%);background:linear-gradient(var(--a2),var(--a1));border-radius:1vmin}
.cdl i{position:relative;width:100%;height:100%;border-radius:1.2vmin;background:linear-gradient(90deg,var(--a3),var(--a1) 45%,var(--a2) 60%,var(--a3));box-shadow:0 0 4vmin rgb(var(--g) / .55),inset 0 .3vmin 0 rgba(255,255,255,.35)}
.cdl.dn i{filter:brightness(.8) saturate(.9)}
.h-candles.glass .cdl i{background:linear-gradient(90deg,rgb(var(--g2) / .18),rgb(var(--g2) / .55) 40%,rgba(255,255,255,.75) 52%,rgb(var(--g2) / .25));border:1px solid rgb(var(--g2) / .6);backdrop-filter:blur(2px);box-shadow:0 0 5vmin rgb(var(--g) / .6),inset 0 0 2vmin rgba(255,255,255,.4)}
.h-shield{position:relative;width:48vmin;height:100%;display:flex;align-items:flex-end;justify-content:center;padding-bottom:7vmin}
.h-shield>svg{width:30vmin;filter:drop-shadow(0 3vmin 5vmin rgb(var(--g) / .45))}
.h-shield .h-coins .c0{--cs:13vmin;left:0;bottom:10%}.h-shield .h-coins .c1{--cs:10vmin;right:0;bottom:46%}
.h-globe svg{width:36vmin;margin-bottom:6vmin;filter:drop-shadow(0 3vmin 6vmin rgb(var(--g) / .45))}
.h-glass-obj svg{width:34vmin;max-height:100%;margin-bottom:7vmin;filter:drop-shadow(0 3vmin 6vmin rgb(var(--g) / .45))}
.h-safe{padding-bottom:7vmin}.h-safe .box{position:relative;width:38vmin;height:34vmin;border-radius:3vmin;background:linear-gradient(150deg,#24262C,#101114);border:.5vmin solid #33363E;box-shadow:0 3vmin 7vmin rgba(0,0,0,.6),0 0 6vmin rgb(var(--g) / .3);overflow:hidden}
.h-safe .door{position:absolute;inset:3vmin 50% 3vmin 3vmin;border-radius:2vmin;background:linear-gradient(150deg,#2E3038,#141418);display:grid;place-items:center}
.h-safe .dial{width:9vmin;height:9vmin;border-radius:50%;background:radial-gradient(circle,#C8CBD3 30%,#7B7F88 32%,#C8CBD3 60%);box-shadow:0 0 0 .6vmin #141418}
.h-safe .bars{position:absolute;right:3vmin;bottom:3vmin;width:14vmin;display:grid;grid-template-columns:repeat(2,1fr);gap:.8vmin}
.h-safe .bars i{height:4vmin;border-radius:.6vmin;background:linear-gradient(180deg,var(--a2),#C9921E);box-shadow:inset 0 .3vmin 0 rgba(255,255,255,.6)}

/* ================= stat cards (red neon) ================= */
.h-stats{position:relative;width:100%;height:100%}
.scard{position:absolute;bottom:14%;width:42%;height:72%;border-radius:4vmin;padding:4vmin 4vmin 3vmin;color:#fff;display:flex;flex-direction:column;
  background:linear-gradient(160deg,rgb(var(--g) / .9),#0E0F12 45%,#08090B);border:.35vmin solid rgb(var(--g2) / .7);box-shadow:0 0 6vmin rgb(var(--g) / .45)}
.scard.s0{left:7%;transform:rotate(-8deg)}.scard.s1{right:7%;transform:rotate(9deg);bottom:20%}
.scard small{font:600 1.7vmin/1 Poppins;letter-spacing:.18em;opacity:.8}.scard b{font:700 6.4vmin/1.1 Poppins;letter-spacing:-.03em;margin-top:1vmin}
.scard .lbl{font:500 2vmin/1 Poppins;color:#7DFFB0;margin-top:.6vmin}
.scard svg{flex:1;width:100%;margin-top:2vmin;overflow:visible}
.scard .months{display:flex;justify-content:space-between;font:500 1.3vmin/1 Poppins;opacity:.7}.scard .months i{font-style:normal}

/* ================= screen + pedestal (spotlight) ================= */
.h-screen{position:relative;width:100%;height:100%;display:flex;justify-content:center}
.scr{position:absolute;bottom:30%;width:84%;height:60%;border-radius:2.6vmin;padding:3vmin;background:linear-gradient(180deg,#17181C,#0C0C0E);border:1px solid rgba(255,255,255,.12);transform:perspective(160vmin) rotateX(6deg);box-shadow:0 0 0 .4vmin rgba(0,0,0,.6),0 3vmin 8vmin rgba(0,0,0,.6);display:flex;flex-direction:column;gap:2vmin}
.scr-top{display:flex;align-items:center;gap:2vmin;font:600 2.3vmin Poppins}.srch{margin-left:auto;width:45%;font:400 1.6vmin Poppins;color:var(--mute);border:1px solid var(--line);border-radius:5vmin;padding:.9vmin 2vmin}
.scr-tabs{display:flex;gap:3vmin;font:400 1.6vmin Poppins;color:var(--mute)}.scr-tabs i{font-style:normal}
.scr-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:1.6vmin;flex:1}
.scr-main,.scr-tile{border-radius:1.8vmin;border:1px solid var(--line);background:rgba(255,255,255,.04);padding:2vmin;display:flex;flex-direction:column;gap:1vmin}
.scr-main small{font:400 1.4vmin Poppins;color:var(--mute)}.scr-main b{font:600 2.6vmin/1.15 Poppins}.scr-main b em{font-style:normal;color:var(--acc2)}
.mini-btn{align-self:flex-start;margin-top:auto;font:500 1.4vmin Poppins;border:1px solid var(--line);border-radius:4vmin;padding:.8vmin 1.6vmin}
.scr-tile{align-items:center;justify-content:center;font:500 1.6vmin Poppins}.scr-tile .ic{width:3.4vmin;height:3.4vmin;color:var(--acc2)}
.pedestal{position:absolute;bottom:0;width:26vmin;height:20%;background:linear-gradient(180deg,#2A1D16,#0B0807);border-radius:1vmin 1vmin 0 0;box-shadow:0 -1vmin 6vmin rgb(var(--g) / .35)}
.pedestal .top{position:absolute;top:0;left:0;right:0;height:3vmin;border-radius:1vmin;background:linear-gradient(180deg,var(--a2),var(--a1));box-shadow:0 0 6vmin 2vmin rgb(var(--g) / .55)}
.pedestal .h-candles{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);height:15vmin;gap:1.6vmin;padding-bottom:3.4vmin}
.pedestal .cdl{width:3vmin}
.st-spotlight .pedestal .cdl i{background:linear-gradient(90deg,var(--a3),var(--a1) 45%,var(--a2) 60%,var(--a3));box-shadow:0 0 3vmin rgb(var(--g) / .6)}
.st-spotlight .pedestal .cdl::before{background:var(--a2)}

/* ================= phone + quote cards ================= */
.h-phone{position:relative;width:100%;height:100%}
.ph{position:absolute;right:6%;bottom:-8%;width:46vmin;height:70%;border-radius:5vmin;background:linear-gradient(160deg,#1C1D22,#0B0B0D);border:.5vmin solid #2E3038;transform:perspective(120vmin) rotateX(32deg) rotateZ(-8deg);padding:5vmin 3vmin;display:flex;flex-direction:column;gap:1.6vmin;box-shadow:0 4vmin 8vmin rgba(0,0,0,.7)}
.ph-notch{position:absolute;top:1.6vmin;left:50%;transform:translateX(-50%);width:12vmin;height:2.4vmin;border-radius:2vmin;background:#000}
.ph-row{display:flex;gap:1.2vmin;align-items:center;font:400 1.3vmin/1.3 Poppins;padding:1.2vmin;border-radius:1.6vmin;background:rgba(255,255,255,.05);border:1px solid rgb(var(--g) / .35)}
.ph-row span{width:3vmin;height:3vmin;flex:none;color:var(--acc2)}.ph-row b{font-size:1.4vmin}.ph-row p{opacity:.7}
.qcards{position:absolute;right:4%;top:-36%;width:52%;display:flex;flex-direction:column;gap:2vmin}
.qcard{display:flex;gap:1.8vmin;padding:2.2vmin 2.6vmin;border-radius:2.6vmin;background:linear-gradient(160deg,#1A1513,#0D0A09);border:.3vmin solid rgb(var(--g) / .8);box-shadow:0 0 4vmin rgb(var(--g) / .35)}
.qcard.q1{margin-left:-8vmin}.qcard.q2{margin-left:-2vmin}
.qi{flex:none;width:6vmin;height:6vmin;border-radius:50%;display:grid;place-items:center;background:linear-gradient(160deg,var(--a2),var(--a3));color:#120806}.qi .ic{width:3vmin;height:3vmin}
.qcard b{font:700 2.2vmin Poppins}.qcard i{float:right;font:400 1.5vmin Poppins;color:var(--mute);font-style:normal}.qcard p{font:400 2vmin/1.35 Poppins;margin-top:.6vmin}

/* ================= trader spotlight ================= */
.h-trader{position:relative;width:100%;height:100%}
.st-trader-spotlight .hero{height:100%}
.lamp{position:absolute;left:50%;top:0;transform:translateX(-50%);width:100%;height:100%}
.lamp .cord{position:absolute;left:50%;top:0;width:.3vmin;height:3vmin;background:#333}
.lamp .shade{position:absolute;left:50%;top:3vmin;width:14vmin;height:5vmin;transform:translateX(-50%);border-radius:7vmin 7vmin 1vmin 1vmin;background:linear-gradient(180deg,#2A2C30,#0E0F11);box-shadow:0 1.6vmin 4vmin rgb(var(--g2) / .5)}
.lamp .cone{position:absolute;left:50%;top:8vmin;width:90vmin;height:120vmin;transform:translateX(-50%);background:radial-gradient(ellipse 30% 60% at 50% 0%,rgb(var(--g2) / .22),transparent 70%);clip-path:polygon(44% 0,56% 0,100% 100%,0 100%)}
.arrow-up{position:absolute;left:50%;top:46%;width:22vmin;transform:translateX(-50%);color:var(--a2);filter:drop-shadow(0 0 2vmin rgb(var(--g) / .9))}
.desk{position:absolute;left:0;right:0;bottom:0;height:34%;display:flex;justify-content:center}
.monitor{position:absolute;bottom:34%;width:64%;height:56%;border-radius:1.4vmin;background:#06100B;border:.5vmin solid #1D2A23;box-shadow:0 0 6vmin rgb(var(--g) / .35);padding:1.4vmin}
.monitor svg{width:100%;height:100%}
.person{position:absolute;bottom:0;width:30vmin}
.handle{position:relative;z-index:3;text-align:center;margin-top:5vmin;font:700 3vmin/1 Poppins;color:var(--fg);opacity:.12}
.st-trader-spotlight .copy{margin-top:2vmin}
.st-trader-spotlight .head em{background:none;color:var(--fg)}
.st-trader-spotlight .sub{color:var(--acc2);font-style:italic;font-weight:600}

/* ================= torn reveal ================= */
.torn{position:absolute;left:-2%;right:-2%;top:9%;height:30%;z-index:1;overflow:hidden;transform:rotate(-2deg);
  clip-path:polygon(0 8%,4% 3%,9% 7%,14% 2%,20% 6%,27% 1%,33% 6%,40% 2%,47% 7%,53% 3%,60% 8%,66% 2%,73% 6%,80% 1%,86% 6%,92% 2%,100% 6%,100% 94%,95% 98%,89% 93%,83% 99%,76% 94%,70% 98%,63% 92%,57% 97%,50% 93%,44% 99%,37% 94%,30% 98%,24% 92%,17% 97%,11% 93%,5% 98%,0 94%)}
.engrave{position:absolute;inset:0;background:
  repeating-radial-gradient(circle at 30% 55%,#C9A24A 0 .25vmin,#2A2008 .25vmin .9vmin),
  repeating-radial-gradient(circle at 75% 50%,#C9A24A 0 .25vmin,transparent .25vmin .9vmin);mix-blend-mode:normal;filter:sepia(.5) saturate(.7) contrast(1.15) brightness(.9)}
.engrave::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 30%,rgba(0,0,0,.55)),linear-gradient(90deg,rgb(var(--g) / .35),transparent 40%,transparent 60%,rgb(var(--g) / .35)),repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 .3vmin,transparent .3vmin .9vmin)}
.bars-bg{position:absolute;left:0;right:0;top:-110%;height:100%;display:flex;align-items:flex-end;gap:2vmin;padding:0 6vmin}
.torn-copy{margin-top:38vmin}.a-9x16 .torn-copy{margin-top:44vmin}.a-1x1 .torn-copy{margin-top:28vmin}
.st-torn-reveal .head{font-size:8.4vmin;font-weight:700}.st-torn-reveal .head em{background:linear-gradient(180deg,var(--a2),var(--acc2));-webkit-background-clip:text;background-clip:text}
.st-torn-reveal .sub{display:inline-block;background:#fff;color:#111;font-weight:700;padding:.6vmin 2vmin;border-radius:1vmin;text-transform:uppercase;font-size:3vmin}
.bbox{position:relative;z-index:3;margin:3.4vmin auto 0;display:grid;grid-template-columns:1fr 1fr;gap:1.6vmin 4vmin;padding:3vmin 4vmin;border-radius:3vmin;border:.25vmin solid rgb(var(--g) / .55);background:rgba(10,8,4,.75);max-width:92%}
.bbox span{display:flex;align-items:center;gap:1.4vmin;font:500 2.3vmin/1.3 Poppins}.bbox .chev{width:2.6vmin;height:2.6vmin;color:var(--acc2);flex:none;transform:rotate(45deg)}
.closer{position:relative;z-index:3;text-align:center;margin-top:3.4vmin;font:700 3.6vmin/1.2 Poppins}
.social{position:absolute;z-index:4;left:50%;bottom:11vmin;transform:translateX(-50%);display:flex;align-items:center;gap:2vmin;padding:1.4vmin 3vmin;border-radius:5vmin;border:.25vmin solid rgb(var(--g) / .55);background:rgba(10,8,4,.85);font:500 1.9vmin Poppins;white-space:nowrap}
.social span{display:flex;align-items:center;gap:1vmin}.social .ic{width:2.6vmin;height:2.6vmin;color:var(--acc2)}.social i{width:1px;height:3vmin;background:var(--line)}
.st-torn-reveal .risk{left:50%;right:auto;transform:translateX(-50%);bottom:2.6vmin;max-width:88%}
.land:not(.a-1x1) .torn{top:0;height:100%;left:auto;right:-4%;width:46%;transform:none}
.land:not(.a-1x1) .torn-copy{margin-top:3vmin}.land:not(.a-1x1) .bbox{margin:2vmin 0 0;max-width:54%}.land:not(.a-1x1) .closer{text-align:left;max-width:54%}.land:not(.a-1x1) .social{left:6.5vmin;transform:none;bottom:9vmin}

/* ================= glass cards (opnr) ================= */
.top.line .rule{flex:1;height:1px;background:var(--line)}
.top.line .tag{margin-left:0;font-style:normal}
.glist{position:relative;z-index:3;display:flex;flex-direction:column;gap:2vmin;margin-top:4vmin;width:72%}
.gitem{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:3vmin;padding:2.2vmin 3vmin 2.2vmin 2.2vmin;border-radius:3vmin;
  background:linear-gradient(120deg,rgb(var(--g) / .22),rgba(255,255,255,.04) 60%);border:.25vmin solid rgb(var(--g2) / .55);box-shadow:inset 0 .2vmin 0 rgba(255,255,255,.12),0 0 3vmin rgb(var(--g) / .18)}
.gicon{width:8vmin;height:8vmin;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,var(--a2),var(--a3));color:#fff;box-shadow:0 0 3vmin rgb(var(--g) / .5)}
.gicon .ic{width:3.6vmin;height:3.6vmin}
.gtxt b{display:block;font:500 3vmin/1.15 Poppins}.gtxt small{display:block;font:400 1.8vmin/1.3 Poppins;color:var(--mute);margin-top:.5vmin}
.gnum{font:300 6vmin/1 Poppins;color:var(--mute);padding-left:3vmin;border-left:1px solid var(--line)}
.glass-tag{position:absolute;z-index:3;right:6vmin;top:18vmin;width:28vmin;padding:3vmin;border-radius:3vmin;transform:rotate(12deg);font:500 2.4vmin/1.4 Poppins;color:var(--fg);
  background:linear-gradient(140deg,rgba(255,255,255,.14),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(6px);box-shadow:0 2vmin 5vmin rgba(0,0,0,.4)}
.glass-tag .cta-arrow{position:absolute;right:2vmin;bottom:-3vmin;width:7vmin;height:7vmin}
.st-glass-cards .bgfx{background:radial-gradient(circle at 110% 40%,rgb(var(--g) / .9) 0,rgb(var(--g3) / .6) 22%,transparent 42%),radial-gradient(circle at -10% 105%,rgb(var(--g) / .7),transparent 35%),radial-gradient(circle at 95% 95%,#141418 0 12%,transparent 12.3%),var(--bg)}
.a-1x1 .glist{gap:1.4vmin;margin-top:2.6vmin}.a-1x1 .gitem{padding:1.6vmin 2.4vmin 1.6vmin 1.6vmin}.a-1x1 .gicon{width:6.4vmin;height:6.4vmin}.a-1x1 .glass-tag{display:none}.a-1x1 .glist{width:86%}
.land:not(.a-1x1) .glist{position:absolute;right:6vmin;top:14vmin;width:44%;margin:0}.land:not(.a-1x1) .glass-tag{display:none}

/* ================= style backgrounds ================= */
.st-red-neon .bgfx{background:radial-gradient(ellipse 80% 45% at 50% 105%,rgb(var(--g) / .95),rgb(var(--g3) / .5) 45%,transparent 75%),
  repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 .2vmin,transparent .2vmin 9vmin),linear-gradient(180deg,#000 0%,#0A0203 55%,#1A0405 100%)}
.st-red-neon .head{font-weight:400;letter-spacing:-.03em}.st-red-neon .head em{font-weight:400}
.st-red-neon .hero{height:46%}
.st-spotlight .bgfx{background:radial-gradient(ellipse 60% 30% at 50% -4%,rgb(var(--g2) / .9),rgb(var(--g) / .35) 40%,transparent 75%),radial-gradient(ellipse 50% 30% at 50% 100%,rgb(var(--g) / .35),transparent 70%),
  repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 .2vmin,transparent .2vmin 3vmin),#080605}
.st-spotlight .head{font-weight:700}.st-spotlight .head em{background:linear-gradient(180deg,var(--a2),var(--acc2));-webkit-background-clip:text;background-clip:text}
.st-spotlight .tag em{color:var(--fg)}
.st-spotlight .copy.left{margin-top:9vmin;max-width:58%}.st-spotlight .copy.left .head{font-size:8vmin;text-transform:uppercase}
.st-spotlight .hero-phone{height:56%}
.st-hero-campaign .bgfx{background:${light
    ? 'radial-gradient(ellipse 70% 40% at 50% 100%,rgb(var(--g) / .18),transparent 70%),radial-gradient(circle at 50% 30%,#fff,#ECECF0 70%)'
    : 'radial-gradient(ellipse 70% 45% at 50% 100%,rgb(var(--g) / .45),transparent 70%),radial-gradient(ellipse 60% 40% at 50% 0%,rgb(var(--g) / .18),transparent 70%),#07070A'}}
.st-hero-campaign .head{font-weight:500}.st-hero-campaign .head em{font-style:italic;font-weight:500}
.st-hero-campaign .cta{${light ? 'background:var(--a3);border-color:var(--a3);box-shadow:none' : ''}}
.st-hero-campaign .risk{left:6.5vmin;right:auto;background:transparent;border:0;padding:0}
.st-glass-objects .bgfx{background:radial-gradient(ellipse 60% 45% at 70% 75%,rgb(var(--g) / .55),transparent 70%),radial-gradient(ellipse 50% 40% at 10% 0%,rgb(var(--g3) / .35),transparent 70%),#09060A}
.watermark{position:absolute;z-index:1;left:50%;transform:translateX(-50%);bottom:7vmin;font:700 30vmin/0.8 Poppins;white-space:nowrap;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:.3vmin rgb(var(--g2) / .18);background:linear-gradient(180deg,rgb(var(--g) / .22),transparent);-webkit-background-clip:text;background-clip:text}
.st-glass-objects .head{font-weight:500;color:#F2EEF6}.st-glass-objects .head em{background:linear-gradient(180deg,var(--a2),var(--a1));-webkit-background-clip:text;background-clip:text}
.st-glass-objects .hero{right:-4%;left:auto;width:70%;height:62%}
.chips{position:absolute;z-index:3;left:6.5vmin;top:46%;display:flex;flex-direction:column;gap:1.4vmin}
.chip{display:flex;align-items:center;gap:1.2vmin;font:500 1.7vmin/1 Poppins;letter-spacing:.06em;text-transform:uppercase;padding:1.2vmin 2vmin;border-radius:5vmin;background:rgba(255,255,255,.06);border:1px solid rgb(var(--g2) / .35);backdrop-filter:blur(4px)}
.chip .ic{width:2.2vmin;height:2.2vmin;color:var(--a2)}
.st-trader-spotlight .bgfx{background:radial-gradient(ellipse 50% 60% at 50% 10%,rgb(var(--g3) / .35),transparent 70%),radial-gradient(ellipse 60% 30% at 50% 100%,rgb(var(--g) / .25),transparent 70%),#030806}
.st-torn-reveal .bgfx{background:radial-gradient(ellipse 60% 40% at 50% 70%,rgb(var(--g) / .25),transparent 70%),repeating-radial-gradient(circle at 20% 30%,rgba(255,255,255,.03) 0 .15vmin,transparent .15vmin .6vmin),#070604}

/* ================= end card (carousels) ================= */
.poster.end{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3vmin;text-align:center;background:radial-gradient(ellipse 70% 45% at 50% 55%,rgb(var(--g) / .4),transparent 70%),var(--bg)}
.end .url{font:500 3vmin Poppins;color:var(--mute)}.end-risk{font:400 2.2vmin/1.5 Poppins;color:var(--mute);max-width:80%}.end-reg{font:400 1.8vmin/1.5 Poppins;color:var(--mute);opacity:.8;max-width:80%}
/* ---- square fine-tuning */
.a-1x1 .torn{height:25%;top:8%}.a-1x1 .torn-copy{margin-top:24vmin}.a-1x1 .st-torn-reveal .head{font-size:7.2vmin}
.a-1x1 .bbox{margin-top:2.4vmin;padding:2.2vmin 3vmin}.a-1x1 .closer{margin-top:2vmin;font-size:3vmin}.a-1x1 .social{bottom:8vmin}
.a-1x1 .st-spotlight .scr{bottom:36%;height:58%;width:76%}.a-1x1 .pedestal{height:18%}.a-1x1 .pedestal .h-candles{height:11vmin}
.a-1x1 .person{width:22vmin}.a-1x1 .monitor{width:56%}
`;
}

export default {
  xf: 0,
  types: ['poster'],
  css,
  chrome,
  scene,
};
