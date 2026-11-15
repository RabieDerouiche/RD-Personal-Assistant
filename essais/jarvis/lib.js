const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');
const DIR = process.cwd(); /* le fichier de la page est donné en argument, relatif au dossier courant ou absolu */
const MOCK = fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8');

/* ouvre la page avec les faux connecteurs ; opts : {file, scen, time, width, height} */
async function open(opts) {
  opts = opts || {};
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: opts.width || 390, height: opts.height || 844}, deviceScaleFactor: opts.dsf || 1, locale: 'fr-FR', timezoneId: 'Europe/Paris', hasTouch: true, isMobile: true, permissions: ['clipboard-read', 'clipboard-write']});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + String(e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.abort());
  if (opts.time) await page.clock.install({time: new Date(opts.time)});
  await page.addInitScript('window.__SCEN = ' + JSON.stringify(opts.scen || {}) + ';');
  if (opts.storage) await page.addInitScript('try { const s = ' + JSON.stringify(opts.storage) + '; Object.keys(s).forEach((k) => localStorage.setItem(k, JSON.stringify(s[k]))); } catch (e) {}');
  await page.addInitScript(MOCK);
  await page.goto('file://' + path.resolve(DIR, opts.file || 'jarvis.html'));
  if (opts.time) await page.clock.runFor(3600); else await page.waitForTimeout(3600);
  return {browser, page, errors, opts};
}
/* avance le temps : horloge simulée si elle est installée */
async function tick(h, ms) { if (h.opts.time) await h.page.clock.runFor(ms); else await h.page.waitForTimeout(ms); }
const calls = (h, f) => h.page.evaluate(() => window.__calls).then((c) => (f ? c.filter(f) : c));
const writes = (h) => calls(h, (c) => !/^(get_values|list_events|search_threads|list_drafts|get_thread)$/.test(c.tool));
const text = (h, sel) => h.page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel || '#view');
const toasts = (h) => h.page.evaluate(() => Array.from(document.querySelectorAll('.toast')).map((t) => t.innerText.replace(/\n/g, ' | ')));
const tab = async (h, id) => { await h.page.evaluate((i) => { const b = document.querySelector('.tab[data-tab="' + i + '"]'); if (b) b.click(); else location.hash = i; }, id); await tick(h, 400); };
/* clique le premier bouton visible dont le texte commence par label, dans root */
async function click(h, label, root) {
  const ok = await h.page.evaluate(({label, root}) => {
    const scope = root ? document.querySelector(root) : document;
    if (!scope) return 'no-root';
    const vis = (e) => e.getClientRects().length > 0;
    const els = Array.from(scope.querySelectorAll('button, a.btn')).filter(vis);
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    const b = els.find((e) => norm(e.innerText).startsWith(label)) || els.find((e) => norm(e.innerText).includes(label));
    if (!b) return 'absent';
    b.click(); return 'ok';
  }, {label, root: root || null});
  await tick(h, 350);
  return ok;
}
const overflow = (h) => h.page.evaluate(() => { const s = document.getElementById('scroller'); const wide = Array.from(document.querySelectorAll('#view *')).filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.strip, .sugg, .stats, .dock, .seg, .status, .cost-t-wrap, .sor')).slice(0, 5).map((e) => e.className + ':' + Math.round(e.getBoundingClientRect().right)); return {sw: s.scrollWidth, cw: s.clientWidth, wide}; });
module.exports = {open, tick, calls, writes, text, toasts, tab, click, overflow, DIR};
