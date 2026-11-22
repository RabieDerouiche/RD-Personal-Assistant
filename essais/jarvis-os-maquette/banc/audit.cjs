/* Check-up de la nouvelle app JARVIS OS (maquette, données d'exemple), écran par écran, en émulation iPhone 15 Pro Max, thème Hologramme.
   Lancer : NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-maquette/banc/audit.cjs [écran…]
   Relève pour chaque écran : texte cassé, débordement, défilement horizontal, polices, contraste, blocs en double, boutons sans effet,
   erreurs de console. Captures (tranches de l'écran) et rapport JSON dans le dossier temporaire (jarvis-os-audit). */
const {chromium, devices} = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..'), OUT = path.join(os.tmpdir(), 'jarvis-os-audit'); fs.mkdirSync(OUT, {recursive: true});
const TYPES = {'.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.css': 'text/css', '.webmanifest': 'application/manifest+json'};
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); r.end(d); }); });
const ONLY = process.argv.slice(2), SCALE = process.env.SCALE ? +process.env.SCALE : 1, CLICKS = process.env.CLICKS !== '0';

/* espions posés avant la page : gestes enregistrés, liens, ouvertures, presse-papiers, outils */
const SPY = () => {
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) { if (this instanceof Element && /^(click|pointerdown|pointerup|touchstart|touchend|mousedown|change|input|toggle)$/.test(t)) this.__clk = (this.__clk || '') + t + ' '; return add.call(this, t, f, o); };
  window.__fx = [];
  window.open = (u) => { window.__fx.push('open ' + u); return null; };
  try { Object.defineProperty(navigator, 'clipboard', {value: {writeText: (t) => { window.__fx.push('clip ' + String(t).slice(0, 60)); return Promise.resolve(); }, readText: () => Promise.resolve('')}}); } catch (e) { /* rien */ }
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (a) { const u = a.getAttribute('href'); if (u && u[0] !== '#') { window.__fx.push('lien ' + u.slice(0, 80)); e.preventDefault(); } } }, true);
  const wrap = () => { const c = window.claude; if (!c || c.__spied) return; c.__spied = true;
    const ct = c.callTool && c.callTool.bind(c); if (ct) c.callTool = (s, t, i) => { if (!/get_values|list_events|search_threads|get_thread|list_drafts|folder_tree/.test(t)) window.__fx.push('outil ' + t); return ct(s, t, i); };
    const sm = c.sample && c.sample.bind(c); if (sm) c.sample = (...a) => { window.__fx.push('claude'); return sm(...a); }; };
  document.addEventListener('DOMContentLoaded', wrap); setTimeout(wrap, 50); setTimeout(wrap, 600);
};

/* contrôles statiques d'un écran, dans la page */
const CHECK = () => {
  const vw = innerWidth, R = {broken: [], overflow: [], hscroll: [], clipped: [], fonts: {}, odd: [], tiny: [], contrast: [], dup: [], fontsLoaded: {}};
  const vis = (e) => { if (!e.getClientRects().length) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const txt = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const layers = [...document.querySelectorAll('#scroller, #sheet:not([hidden]), #chat:not([hidden]), #app:not([hidden]), .all-sheet:not([hidden]), #gsearch:not([hidden]), #toasts')].filter(vis);
  /* texte cassé */
  const all = document.body.innerText;
  const re = /\[object \w+\]|\bundefined\b|\bNaN\b|\bnull\b|Invalid Date|\$\{|function \(|=>/g; let m;
  while ((m = re.exec(all))) R.broken.push(all.slice(Math.max(0, m.index - 50), m.index + 40).replace(/\s+/g, ' '));
  /* éléments visibles */
  const els = [...document.querySelectorAll('body *')].filter((e) => !['SCRIPT', 'STYLE', 'svg', 'path', 'circle', 'line', 'g', 'rect', 'polyline', 'polygon', 'defs', 'stop', 'linearGradient', 'radialGradient', 'text', 'tspan', 'ellipse', 'use', 'mask', 'clipPath', 'filter'].includes(e.tagName) && !e.closest('svg') && vis(e));
  const inXScroll = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.id !== 'scroller') return p; if (s.overflowX === 'hidden' && p.id !== 'scroller' && p.getBoundingClientRect().right <= vw + 1) return p; if (s.position === 'fixed') return null; } return null; };
  for (const e of els) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (r.width === 0 || r.height === 0) continue;
    if ((r.right > vw + 1 || r.left < -1) && !inXScroll(e) && s.position !== 'fixed' && !e.closest('[aria-hidden="true"]')) R.overflow.push(name(e) + ' [' + Math.round(r.left) + '→' + Math.round(r.right) + '] ' + txt(e));
    if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 2 && e.id !== 'scroller') R.hscroll.push(name(e) + ' (' + e.clientWidth + '/' + e.scrollWidth + ') ' + txt(e).slice(0, 50));
    if (s.display !== 'inline' && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2 && !/(auto|scroll)/.test(s.overflowX) && s.textOverflow !== 'ellipsis' && e.id !== 'scroller' && e.innerText && e.innerText.trim() && ![...e.children].some((c) => getComputedStyle(c).position === 'absolute' && c.getBoundingClientRect().right > r.right)) R.clipped.push(name(e) + ' (' + e.clientWidth + '/' + e.scrollWidth + ', ' + s.overflowX + ') ' + txt(e));
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const fam = s.fontFamily.split(',')[0].replace(/["']/g, '').trim(); R.fonts[fam] = (R.fonts[fam] || 0) + 1;
    if (!/^(Oxanium|Exo 2|Orbitron)$/.test(fam) && R.odd.length < 40) R.odd.push(fam + ' · ' + name(e) + ' · ' + txt(e).slice(0, 40));
    const fs = parseFloat(s.fontSize); if (fs < 11) R.tiny.push(fs + 'px · ' + name(e) + ' · ' + txt(e).slice(0, 40));
    /* contraste approché : couleur du texte contre le premier fond opaque (dégradés moyennés) */
    const col = (c) => { const k = c.match(/rgba?\(([^)]+)\)/); if (!k) return null; const v = k[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat); return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
    const cols = (bg) => (bg.match(/rgba?\([^)]+\)/g) || []).map(col);
    let fg = col(s.color); if (!fg) continue; if (s.webkitTextFillColor && /transparent/.test(s.webkitTextFillColor) || s.color === 'rgba(0, 0, 0, 0)') continue;
    let op = 1; const stack = [];
    for (let p = e; p; p = p.parentElement) {
      const ps = getComputedStyle(p); op *= parseFloat(ps.opacity);
      const bgc = col(ps.backgroundColor); const gi = ps.backgroundImage !== 'none' ? cols(ps.backgroundImage) : [];
      if (gi.length) { const a = gi.reduce((t, c) => t.map((v, i) => v + c[i] / gi.length), [0, 0, 0, 0]); stack.push(a); }
      if (bgc && bgc[3] > 0) stack.push(bgc);
      if (stack.length && stack[stack.length - 1][3] >= .95) break;
    }
    let base = [3, 10, 30];
    for (let i = stack.length - 1; i >= 0; i--) { const c = stack[i]; base = base.map((v, j) => v * (1 - c[3]) + c[j] * c[3]); }
    const fa = fg[3] * op; const f = base.map((v, j) => v * (1 - fa) + fg[j] * fa);
    const L = (c) => { const x = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * x[0] + .7152 * x[1] + .0722 * x[2]; };
    const a = L(f), b = L(base), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (ratio < (fs >= 18 ? 3 : 4.5) && !e.closest('button[disabled], .is-dim, [aria-disabled="true"]')) R.contrast.push(ratio.toFixed(1) + ' · ' + fs + 'px · ' + name(e) + ' · ' + txt(e).slice(0, 40));
  }
  /* blocs en double : titres répétés, cartes identiques */
  const root = document.querySelector('#sheet:not([hidden])') || document.getElementById('view');
  const hs = [...root.querySelectorAll('h1, h2, h3')].filter(vis).map(txt).filter(Boolean); const seen = {};
  hs.forEach((t) => { seen[t] = (seen[t] || 0) + 1; }); Object.keys(seen).filter((k) => seen[k] > 1).forEach((k) => R.dup.push('titre ×' + seen[k] + ' : ' + k));
  const cards = [...root.querySelectorAll('article, .card, .hm-row, .canal-row, .lf-r, .mate, .soon, .pf, .stat')].filter(vis).map(txt).filter((t) => t.length > 18); const cs = {};
  cards.forEach((t) => { cs[t] = (cs[t] || 0) + 1; }); Object.keys(cs).filter((k) => cs[k] > 1).forEach((k) => R.dup.push('bloc ×' + cs[k] + ' : ' + k));
  ['Oxanium', 'Exo 2', 'Orbitron'].forEach((f) => { R.fontsLoaded[f] = document.fonts.check('16px "' + f + '"'); });
  R.layers = layers.map(name); R.scrollH = (document.getElementById('scroller') || {}).scrollHeight;
  return R;
};

/* boutons : candidats visibles de l'écran (un identifiant stable par position) */
const CANDS = (scope) => {
  const vis = (e) => { if (!e.getClientRects().length) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.pointerEvents === 'none') return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const root = document.querySelector(scope) || document.body;
  const list = [...root.querySelectorAll('button, a[href], summary, [role="button"], [tabindex="0"], input[type="checkbox"], input[type="radio"], select, *')].filter((e) => (e.matches('button, a[href], summary, [role="button"], input[type="checkbox"], input[type="radio"], select') || (e.__clk && /click|pointer|touch|mouse/.test(e.__clk))) && vis(e) && !e.closest('svg'));
  const uniq = [...new Set(list)];
  const sig = {}, out = [];
  uniq.forEach((e, i) => { const k = e.tagName + '.' + (typeof e.className === 'string' ? e.className.trim().split(/\s+/).sort().join('.') : '') + '|' + (e.getAttribute('data-tab') || ''); sig[k] = (sig[k] || 0) + 1; if (sig[k] <= 2) out.push({i, k, t: ((e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim()).slice(0, 50), dis: e.disabled || e.getAttribute('aria-disabled') === 'true'}); });
  window.__cands = uniq; return out;
};
const SNAP = () => { const g = (s) => { const e = document.querySelector(s); return e ? (e.hidden ? '' : (e.innerText || '').replace(/\d{1,2}:\d{2}/g, '')) : ''; };
  return JSON.stringify([location.hash, g('#view'), g('#sheet'), g('#chat'), g('#app'), g('#toasts'), g('.all-sheet'), document.querySelector('.jv-turn') ? document.querySelectorAll('.jv-turn').length : 0, document.querySelector('[class*="jv-"][class*="open"], .jv-overlay:not([hidden])') ? 1 : 0, (window.__fx || []).length, [...document.querySelectorAll('details')].map((d) => d.open ? 1 : 0).join(''), [...document.querySelectorAll('[aria-pressed], [aria-expanded], [aria-current], [aria-selected]')].map((x) => (x.getAttribute('aria-pressed') || '') + (x.getAttribute('aria-expanded') || '') + (x.getAttribute('aria-current') || '') + (x.getAttribute('aria-selected') || '')).join(''), document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) ? 'focus' : '', document.documentElement.className, document.body.className, (document.getElementById('scroller') || {}).scrollTop]); };

/* les écrans : nom, adresse, gestes pour y arriver, portée des boutons */
const SCREENS = [
  {id: 'accueil', url: ''},
  {id: 'espaces', url: '#espaces'},   /* refonte UX (22/11/2026) : Espaces remplace le menu « Tout » */
  {id: 'pour-moi', url: '#demandes'},
  {id: 'agenda', url: '#agenda'},
  {id: 'suivi', url: '#suivi'},
  {id: 'achats', url: '#achats'},
  {id: 'achat-fiche', url: '#achats', go: async (p) => { await p.evaluate(() => document.querySelector('.fam .fam-hit').click()); await p.waitForTimeout(900); }},
  {id: 'voyages', url: '#voyages', web: true},
  {id: 'voyage-projet', url: '#voyages', web: true, go: async (p) => { await p.evaluate(() => document.querySelector('.voy .fam-hit').click()); await p.waitForTimeout(1300); }},
  {id: 'voyage-carnet', url: '#voyages', web: true, go: async (p) => { await p.evaluate(() => document.querySelector('.voy .fam-hit').click()); await p.waitForTimeout(1000); await p.evaluate(() => { const b = document.querySelector('.cn-cta .btn'); if (b) b.click(); }); await p.waitForTimeout(1500); }},
  {id: 'sorties', url: '#sorties'},
  {id: 'papiers', url: '#papiers'},
  {id: 'papiers-dossier', url: '#papiers', go: async (p) => { await p.evaluate(() => [...document.querySelectorAll('.pt')].find((b) => /Logement/.test(b.textContent)).click()); await p.waitForTimeout(600); }},
  {id: 'equipe', url: '#equipe'},
  {id: 'equipe-bot', url: '#equipe', go: async (p) => { await p.evaluate(() => document.querySelector('.team .mate').click()); await p.waitForTimeout(900); }},
  {id: 'automatisations', url: '#automatisations'},
  {id: 'reglages', url: '#reglages'},
  /* 0.25.0 : l'orbe ouvre la discussion avec Claude (plus de page vocale) ; puis « Pour moi » une par une et la recherche partout */
  {id: 'claude', url: '', go: async (p) => { await p.tap('.talk-slot .jv-btn'); await p.waitForTimeout(1200); }, scope: 'body', voice: true},
  {id: 'claude-echange', url: '', go: async (p) => { await p.tap('.talk-slot .jv-btn'); await p.waitForTimeout(1000); await p.fill('#chat-in', 'Quoi de neuf aujourd\'hui ?'); await p.tap('#chat .chat-row .btn.main'); await p.waitForTimeout(2500); }, scope: 'body', voice: true},
  {id: 'une-par-une', url: '#demandes', go: async (p) => { await p.tap('#fc-start'); await p.waitForTimeout(700); }},
  {id: 'recherche', url: '#accueil', go: async (p) => { await p.tap('#gs-btn'); await p.waitForTimeout(300); await p.fill('#gs-in', 'robot'); await p.waitForTimeout(500); }, scope: 'body'}
];

const web = async (ctx) => {
  await ctx.route('https://fr.wikipedia.org/**', (r) => r.fulfill({status: 200, headers: {'access-control-allow-origin': '*'}, contentType: 'application/json', body: JSON.stringify({type: 'standard', originalimage: {source: 'https://photo.essai/img.png', width: 960}})}));
  await ctx.route('https://photo.essai/**', (r) => r.fulfill({status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'icon-512.png'))}));
  await ctx.route('https://geocoding-api.open-meteo.com/**', (r) => r.fulfill({status: 200, headers: {'access-control-allow-origin': '*'}, contentType: 'application/json', body: JSON.stringify({results: [{name: 'Tunis', latitude: 36.8, longitude: 10.18}]})}));
  await ctx.route('https://archive-api.open-meteo.com/**', (r) => r.fulfill({status: 200, headers: {'access-control-allow-origin': '*'}, contentType: 'application/json', body: JSON.stringify({daily: {time: Array.from({length: 16}, (_, i) => '2026-03-' + String(5 + i).padStart(2, '0')), temperature_2m_max: Array(16).fill(19), temperature_2m_min: Array(16).fill(11), precipitation_sum: [0, 0, 3, 0, 0, 0, 1.5, 0, 0, 0, 0, 0, 0, 2, 0, 0]}})}));
};

srv.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const b = await chromium.launch(); const report = {};
  for (const S of SCREENS.filter((x) => !ONLY.length || ONLY.includes(x.id))) {
    const R = report[S.id] = {console: [], errors: [], failed: []};
    const ctx = await b.newContext({...devices['iPhone 15 Pro Max'], ...(SCALE ? {deviceScaleFactor: SCALE} : {})}); await ctx.addInitScript(SPY); if (S.web) await web(ctx);
    const open = async () => { const p = await ctx.newPage();
      /* SAFE=1 : marges d'un vrai iPhone 15 Pro Max (barre d'état 59 px, barre d'accueil 34 px), que l'émulation seule n'a pas */
      if (process.env.SAFE === '1') { const c = await ctx.newCDPSession(p); await c.send('Emulation.setSafeAreaInsetsOverride', {insets: {top: 59, bottom: 34, left: 0, right: 0}}); }
      p.on('console', (m) => { if (/error|warning/.test(m.type())) R.console.push(m.type() + ' ' + m.text().slice(0, 200)); });
      p.on('pageerror', (e) => R.errors.push(e.message.slice(0, 200))); p.on('requestfailed', (q) => R.failed.push(q.url().slice(0, 100) + ' ' + (q.failure() || {}).errorText));
      await p.goto(base + S.url); await p.waitForTimeout(+(process.env.WAIT || 3200)); if (S.go) await S.go(p); await p.waitForTimeout(300); return p; };
    let p = await open();
    Object.assign(R, await p.evaluate(CHECK));
    /* captures : tranches de la hauteur de l'écran */
    const H = await p.evaluate(() => { const s = document.querySelector('#sheet:not([hidden]) .sheet-in, #sheet:not([hidden])') || document.getElementById('scroller'); return {h: s.scrollHeight, c: s.clientHeight, sel: s.id ? '#' + s.id : '.sheet-in'}; });
    const n = S.voice ? 1 : Math.min(6, Math.ceil(H.h / Math.max(1, H.c - 120)));
    R.shots = [];
    for (let k = 0; k < n; k++) { await p.evaluate(([sel, y]) => { const s = document.querySelector(sel); if (s) s.scrollTop = y; }, [H.sel, k * (H.c - 120)]); await p.waitForTimeout(250); const f = path.join(OUT, S.id + '-' + (k + 1) + '.png'); await p.screenshot({path: f}); R.shots.push(f); }
    /* boutons sans effet */
    R.dead = []; R.tested = 0;
    if (CLICKS) {
      const scope = S.scope || (await p.evaluate(() => !document.getElementById('sheet').hidden) ? '#sheet' : '#scroller');
      const cands = await p.evaluate(CANDS, scope);
      for (const c of cands) {
        if (/Thème|Actuel|Hologramme|Mettre à jour le serveur|Recharger/.test(c.t)) continue;
        if (c.dis) continue;
        await p.close(); p = await open(); await p.evaluate(CANDS, scope);
        const before = await p.evaluate(SNAP); let nav = false; p.once('framenavigated', () => { nav = true; });
        const ok = await p.evaluate((i) => { const e = window.__cands[i]; if (!e || !e.isConnected) return false; e.scrollIntoView({block: 'center'}); e.click(); return true; }, c.i).catch(() => false);
        if (!ok) continue; R.tested++;
        await p.waitForTimeout(700);
        const after = await p.evaluate(SNAP).catch(() => 'nav');
        if (!nav && after === before) R.dead.push(c.t + '  [' + c.k + ']');
      }
    }
    await ctx.close();
    console.log(S.id, '· cassé', R.broken.length, '· débord', R.overflow.length, '· coupé', R.clipped.length, '· h-scroll', R.hscroll.length, '· polices', JSON.stringify(R.fonts), '· contraste', R.contrast.length, '· doublons', R.dup.length, '· sans effet', R.dead.length + '/' + R.tested, '· console', R.console.length + R.errors.length);
  }
  fs.writeFileSync(path.join(OUT, process.env.RAPPORT || 'rapport.json'), JSON.stringify(report, null, 1));
  console.log('Rapport : ' + path.join(OUT, 'rapport.json'));
  await b.close(); srv.close();
});
