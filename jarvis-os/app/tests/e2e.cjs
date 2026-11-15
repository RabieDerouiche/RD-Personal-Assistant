/* Banc du prototype JARVIS OS : faux micro et fausse voix, comme sur l'iPhone. Construire d'abord (npm run build), puis :
   NODE_PATH=/opt/node-tools/node_modules node tests/e2e.cjs */
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../web');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json'};
const server = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); r.end(d); }); });

const MOCK = (sc) => `(() => {
  const SC = ${JSON.stringify(sc)};
  window.__say = []; window.__spoken = []; window.__starts = 0;
  const Rec = function () {};
  Rec.prototype.start = function () {
    const r = this, n = ++window.__starts;
    if (SC.hang) return;
    if (SC.deny) { setTimeout(() => { r.onerror && r.onerror({error: SC.deny}); r.onend && r.onend(); }, 30); return; }
    if (SC.captureOnce && n === 2) { setTimeout(() => { r.onerror && r.onerror({error: 'audio-capture'}); r.onend && r.onend(); }, 30); return; }
    setTimeout(() => r.onstart && r.onstart(), 30);
    let k = 0;
    const tick = () => { const p = window.__say.shift(); if (!p) { if (++k > 12) { r.onerror && r.onerror({error: 'no-speech'}); r.onend && r.onend(); return; } r._t = setTimeout(tick, 250); return; }
      r.onresult && r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p.slice(0, 8)}], {isFinal: false})]});
      setTimeout(() => { r.onresult && r.onresult({resultIndex: 0, results: [Object.assign([{transcript: p}], {isFinal: true})]}); setTimeout(() => r.onend && r.onend(), 30); }, 120); };
    r._t = setTimeout(tick, 120);
  };
  Rec.prototype.stop = function () { clearTimeout(this._t); setTimeout(() => this.onend && this.onend(), 10); };
  Rec.prototype.abort = function () { clearTimeout(this._t); };
  window.webkitSpeechRecognition = SC.noRec ? undefined : Rec;
  try { Object.defineProperty(window, 'SpeechRecognition', {value: undefined, configurable: true, writable: true}); } catch (e) {}
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  const synth = {speaking: false, getVoices() { return [{lang: 'fr-FR', name: 'Thomas', voiceURI: 'thomas'}]; }, addEventListener() {}, cancel() { synth.speaking = false; }, speak(u) { if (!u.text.trim()) return; window.__spoken.push(u.text); synth.speaking = true; setTimeout(() => { synth.speaking = false; u.onend && u.onend(); }, 250); }};
  Object.defineProperty(window, 'speechSynthesis', {value: synth, configurable: true});
})();`;

const results = [];
async function scen(name, sc, fn) {
  const b = await chromium.launch(); const p = await b.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 1});
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(MOCK(sc)); await p.goto('http://127.0.0.1:' + server.address().port + '/');
  await p.waitForTimeout(500);
  const out = [];
  const step = async (label, f) => { try { out.push(label + ' :: ' + (await f())); } catch (e) { out.push(label + ' :: EXCEPTION ' + e.message); } };
  await fn(p, step);
  results.push('[' + name + ']' + (errs.length ? ' ERREURS ' + errs.join(' | ') : '') + '\n   ' + out.join('\n   '));
  await b.close();
}
const st = (p) => p.evaluate(() => { const j = window.__jarvis; return 'état : ' + (document.getElementById('pill') || {}).textContent + ' · voix : ' + j.voice.state + ' · missions : ' + j.store.missions.map((m) => m.agent + '/' + m.status).join(',') + ' · dernier : ' + (j.store.msgs.slice(-1)[0] || {}).text; });
const say = (p, t) => p.evaluate((t) => window.__say.push(t), t);

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  await scen('A chargement', {}, async (p, step) => {
    await step('hologramme et onglets', () => p.evaluate(() => ({webgl: !!document.querySelector('.holo canvas'), css: !!document.querySelector('.holo-css'), tabs: document.querySelectorAll('.tabs button').length, debord: document.documentElement.scrollWidth > innerWidth})).then(JSON.stringify));
    if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/center.png'});
  });
  await scen('B conversation vocale continue', {}, async (p, step) => {
    await p.click('.mic'); await p.waitForTimeout(200);
    await step('micro ouvert', () => st(p));
    await say(p, "Jarvis, demande à Claude d'analyser mes documents"); await p.waitForTimeout(1200);
    await step('mission Claude, réponse lue, écoute repartie', async () => (await st(p)) + ' · lu : ' + (await p.evaluate(() => window.__spoken.slice(-1)[0])));
    await say(p, "Demande à Claude de préparer un rapport et à Grok de vérifier les données"); await p.waitForTimeout(1200);
    await step('deux missions', () => st(p));
    await say(p, 'Fais travailler Claude et Grok ensemble sur ce projet'); await p.waitForTimeout(1200);
    await step('mission commune', () => st(p));
    await say(p, 'Quelles sont les missions en attente'); await p.waitForTimeout(1200);
    await step('missions en attente', () => st(p));
    await say(p, 'Demande à Kairos de vérifier le prix du robot'); await p.waitForTimeout(1200);
    await step('mission Kairos', () => st(p));
    await say(p, 'Quel temps fait-il demain'); await p.waitForTimeout(1200);
    await step('question hors de portée : proposition', () => st(p));
    await say(p, 'oui'); await p.waitForTimeout(1200);
    await step('oui : mission créée', () => st(p));
    if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/session.png'});
    await step('session : salutation masquée, fil visible', () => p.evaluate(() => { const t = document.getElementById('log').getBoundingClientRect(), tabs = document.querySelector('.tabs').getBoundingClientRect(); return 'salutation : ' + (getComputedStyle(document.querySelector('.hello')).display) + ' · fil en haut ' + Math.round(t.top) + ' < onglets ' + Math.round(tabs.top); }));
    await say(p, "Merci c'est tout"); await p.waitForTimeout(1200);
    await step('fin', () => st(p));
    if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/conversation.png'});
    await step('missions : badge', () => p.evaluate(() => (document.querySelector('.badge') || {}).textContent));
    await p.click('.tabs button:nth-child(3)'); await p.waitForTimeout(200);
    await step('approuver la première', async () => { await p.click('.mcard .btn.main'); await p.waitForTimeout(100); return st(p); });
    await step('priorité haute', async () => { await p.click('.kanban-tabs button:nth-child(2)'); await p.waitForTimeout(100); await p.click('.mcard .prio'); await p.waitForTimeout(100); return p.evaluate(() => window.__jarvis.store.missions.filter((m) => m.priority === 'haute').map((m) => m.agent + '/' + m.status).join(',')); });
    await p.click('.kanban-tabs button:nth-child(1)'); await p.waitForTimeout(100);
    if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/missions.png', fullPage: true});
    await p.click('.tabs button:nth-child(2)'); await p.waitForTimeout(150);
    await step('agents : stats et recherche', async () => { const a = await p.evaluate(() => [...document.querySelectorAll('.agent-card')].map((c) => c.querySelector('.ag-id b').textContent + ':' + c.querySelector('.ag-stats b').textContent).join(',')); await p.fill('.search', 'prix'); await p.waitForTimeout(150); const b = await p.evaluate(() => [...document.querySelectorAll('.agent-card .ag-id b')].map((x) => x.textContent).join(',') + ' · focus : ' + (document.activeElement && document.activeElement.className)); return a + ' → « prix » : ' + b; });
    await p.fill('.search', ''); await p.waitForTimeout(100);
    await step('fiche ouverte puis mission confiée', async () => { await p.click('.agent-card:nth-child(5)'); await p.waitForTimeout(100); const o = await p.evaluate(() => document.querySelector('.agent-card.open .ag-id b').textContent + ' · ' + document.querySelectorAll('.agent-card.open .skills li').length + ' compétences'); if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/agent-ouvert.png', fullPage: true}); await p.click('.agent-card.open .btn.main'); await p.waitForTimeout(200); return o + ' → champ : « ' + (await p.inputValue('#in')) + ' » · focus : ' + (await p.evaluate(() => document.activeElement.id)); });
    await p.click('.tabs button:nth-child(2)'); await p.waitForTimeout(150);
    if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/agents.png', fullPage: true});
    await p.click('.tabs button:nth-child(4)'); await p.waitForTimeout(150);
    await step('mémoire : graphe', () => p.evaluate(() => !!document.querySelector('canvas.graph') + ' · souvenirs : ' + document.querySelector('.mem-stats b').textContent));
    if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/memoire.png', fullPage: true});
    await p.click('.tabs button:nth-child(5)'); await p.click('text=Intelligence'); await p.waitForTimeout(150);
    await step('intelligence : jauges et état', () => p.evaluate(() => document.querySelectorAll('.gauge').length + ' jauges · ' + [...document.querySelectorAll('.llm-row')].map((r) => r.querySelector('b').textContent + '=' + r.querySelector('.pill').textContent).join(', ')));
    if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/intelligence.png', fullPage: true});
    await p.click('.back'); await p.click('text=Automatisations'); await p.waitForTimeout(150);
    if (process.env.SHOTS) await p.screenshot({path: process.env.SHOTS + '/automatisations.png', fullPage: true});
    await p.click('.tabs button:nth-child(1)'); await p.waitForTimeout(150);
    await step('rechargement : tout est gardé', async () => { await p.reload(); await p.waitForTimeout(400); return st(p); });
  });
  await scen('C clavier', {}, async (p, step) => {
    await p.fill('#in', 'Demande à Ulysse de trouver une sortie pour samedi'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    await step('mission Ulysse par écrit', () => st(p));
    await p.click('.chip-q'); await p.waitForTimeout(300);
    await step('commande rapide', () => st(p));
  });
  await scen('D micro refusé', {deny: 'not-allowed'}, async (p, step) => { await p.click('.mic'); await p.waitForTimeout(400); await step('note et clavier', async () => (await st(p)) + ' · note : ' + (await p.evaluate(() => (document.querySelector('.note') || {}).textContent)) + ' · clavier : ' + (await p.evaluate(() => !!document.getElementById('in')))); });
  await scen("E micro qui ne répond jamais", {hang: true}, async (p, step) => { await p.click('.mic'); await p.waitForTimeout(4500); await step('arrêt clair après 4 s', async () => (await st(p)) + ' · note : ' + (await p.evaluate(() => (document.querySelector('.note') || {}).textContent))); });
  await scen('F coupure du micro une fois', {captureOnce: true}, async (p, step) => {
    await p.click('.mic'); await p.waitForTimeout(200); await say(p, 'Demande à Iris de ranger mes papiers'); await p.waitForTimeout(1300);
    await say(p, 'Demande à Chronos de préparer mon CRA'); await p.waitForTimeout(2500);
    await step('reprise après la coupure', () => st(p));
  });
  await scen('G pas de reconnaissance vocale', {noRec: true}, async (p, step) => { await p.click('.mic'); await p.waitForTimeout(200); await step('clavier proposé', async () => (await p.evaluate(() => (document.querySelector('.note') || {}).textContent)) + ' · clavier : ' + (await p.evaluate(() => !!document.getElementById('in')))); });
  await scen('H écrans', {}, async (p, step) => {
    for (const [i, n] of [[2, 'agents'], [4, 'mémoire'], [5, 'plus']]) { await p.click('.tabs button:nth-child(' + i + ')'); await p.waitForTimeout(150); await step(n, () => p.evaluate(() => document.querySelector('.page h2').textContent + ' · débordement : ' + (document.documentElement.scrollWidth > innerWidth))); }
    for (const t of ['Automatisations', 'Intelligence', 'Réglages']) { await p.click('text=' + t); await p.waitForTimeout(150); await step(t, () => p.evaluate(() => document.querySelector('.page h2').textContent + ' · débordement : ' + (document.documentElement.scrollWidth > innerWidth))); if (process.env.SHOTS && t === 'Réglages') await p.screenshot({path: process.env.SHOTS + '/reglages.png', fullPage: true}); await p.click('.back'); await p.waitForTimeout(100); }
  });
  console.log(results.join('\n'));
  server.close();
})().catch((e) => { console.error('ECHEC', e); process.exit(1); });
