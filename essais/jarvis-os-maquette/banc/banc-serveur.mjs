/* Banc de bout en bout : vrai serveur JARVIS (faux Claude, faux Google) et la nouvelle app dans Chromium.
   Relier l'iPhone par code, enregistrer l'accès Google, se connecter, tester les données, page en direct.
   Lancer : NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-maquette/banc/banc-serveur.mjs */
import {spawn, execFileSync} from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x') : import.meta.url); const {chromium, devices} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', '..', '..', 'jarvis-os', 'server'), SH = path.join(os.tmpdir(), 'jarvis-os-banc') + path.sep; fs.mkdirSync(SH, {recursive: true});
const {startFakeGoogle} = await import(SRV + '/tests/fake-google.mjs'); const FG = await startFakeGoogle();
FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['15/11/2026', 'Rabie', 'Iris', 'Info', 'Le syndic a appelé.', 'Fait', 'Noté.', '']];
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-e2e-')), PORT = 19000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT;
const env = {...process.env, JARVIS_PUSH_ALLOW_HTTP: '1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_GOOGLE_FAKE: FG.url, PORT: String(PORT), JARVIS_DATA: DATA, CLAUDE_BIN: SRV + '/tests/fake-claude.mjs', JARVIS_TTS_HELPER: SRV + '/tests/fake-tts.mjs'};
const code = execFileSync(process.execPath, [SRV + '/server.mjs', 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
const srv = spawn(process.execPath, [SRV + '/server.mjs'], {env, stdio: ['ignore', 'pipe', 'pipe']}); await new Promise((r) => srv.stdout.once('data', r));
const out = [], errs = []; const ok = (n, c, i) => out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (i ? ' :: ' + i : ''));
const b = await chromium.launch(); const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.route(FG.url + '/auth**', (route) => { const u = new URL(route.request().url()); route.fulfill({status: 302, headers: {location: BASE + '/api/google/callback?state=' + u.searchParams.get('state') + '&code=CODE-OK'}}); });
try {
  await p.goto(BASE + '/?serveur#reglages'); await p.waitForTimeout(2500);
  ok('mode serveur choisi', await p.evaluate(() => window.__JARVIS_MODE === 'serveur' && !!window.JarvisServeur));
  await p.fill('.set-card input', code); await p.tap('.set-card .btn.main'); await p.waitForTimeout(2500);
  ok('iPhone relié par code', await p.evaluate(() => window.JarvisServeur.linked() && /relié à/.test(document.querySelector('.set-wrap').textContent)));
  await p.screenshot({path: SH + 'set-1.png'});
  const inputs = await p.$$('.set-card input'); await inputs[0].fill(FG.client.id); await inputs[1].fill(FG.client.secret);
  await p.tap('button:has-text("Enregistrer")'); await p.waitForTimeout(800);
  ok('identifiant Google enregistré', await p.evaluate(() => /Enregistré sur ton serveur/.test(document.querySelector('.set-wrap').textContent)));
  await p.tap('button:has-text("Connecter Google")'); await p.waitForTimeout(1500);
  ok('retour de Google : page « relié »', /Google est relié/.test(await p.textContent('body')), (await p.textContent('body')).slice(0, 80));
  await p.goto(BASE + '/?serveur#reglages'); await p.waitForTimeout(2500);
  ok('Réglages : compte Google affiché', await p.evaluate(() => /proprietaire@example\.org/.test(document.querySelector('.set-wrap').textContent)));
  await p.tap('button:has-text("Tester mes données")'); await p.waitForTimeout(1500);
  const t = await p.evaluate(() => document.querySelector('.set-card .set-msg').textContent); ok('test des données : Pilotage lu par le serveur', /Pilotage lu : 1 ligne dans/.test(t), t);
  await p.screenshot({path: SH + 'set-2.png'});
  const before = FG.calls.length;
  await p.goto(BASE + '/?serveur'); await p.waitForTimeout(6000);
  const used = FG.calls.slice(before).map((c) => c.path.replace(/\/v4\/spreadsheets\/[^/]+\/values\//, ' values ').replace(/^\/(\w+).*?(values .*|events|threads|drafts).*$/, '$1 $2'));
  const uniq = [...new Set(used)];
  ok('page en direct : Pilotage, agenda et Gmail lus par l’accès Google', uniq.some((u) => /sheets values Canal/.test(u)) && uniq.some((u) => /calendar events/.test(u)) && uniq.some((u) => /gmail threads/.test(u)), uniq.length + ' sources : ' + uniq.slice(0, 8).join(' | '));
  ok('aucune donnée d’exemple chargée', await p.evaluate(() => !document.querySelector('script[src="donnees-fictives.js"]')));
  await p.screenshot({path: SH + 'os-live.png'});
  await p.goto(BASE + '/?serveur#agenda'); await p.waitForTimeout(4000);
  ok('agenda en direct : carte Aujourd\'hui, 7 prochains jours, grille', await p.evaluate(() => !!document.querySelector('.agt .agt-date') && document.querySelectorAll('.agw-d').length === 7 && !!document.querySelector('.mgrid .mg-d.is-today')));
  await p.screenshot({path: SH + 'os-live-agenda.png'});
  await p.goto(BASE + '/?serveur#papiers'); await p.waitForTimeout(3000);
  ok('papiers en direct : arborescence demandée au Drive (lecture seule)', FG.calls.some((c) => c.path === '/drive/files') && FG.calls.filter((c) => c.path.startsWith('/drive')).every((c) => c.method === 'GET') && await p.evaluate(() => !!document.querySelector('.pap-n')));
  /* outils de Claude dans la discussion et « Confier à la tâche Claude », sur le serveur (16/11/2026) */
  await p.goto(BASE + '/?serveur'); await p.waitForTimeout(4000);
  await p.fill('.intent-input', 'Fais un ordre de test pour Kairos'); await p.press('.intent-input', 'Enter'); await p.waitForTimeout(2500);
  ok('discussion : Claude propose un ordre, la page l\'affiche avec son bouton', await p.evaluate(() => { const c = document.getElementById('chat'); return !c.hidden && /Ordre proposé à Kairos/.test(c.textContent) && /Relève le prix du robot cuiseur/.test(c.textContent) && !/⟦|outil preparer_ordre/.test(c.textContent); }));
  await p.screenshot({path: SH + 'discussion-ordre.png'});
  let n0 = FG.calls.length;
  await p.evaluate(() => [...document.querySelectorAll('#chat .msg.proposal .btn.main')].pop().click()); await p.waitForTimeout(7000);
  ok('discussion : l\'ordre confirmé part dans le Canal', FG.calls.slice(n0).some((c) => c.method === 'POST' && /Canal.*:append$/.test(c.path) && /Relève le prix du robot cuiseur/.test(JSON.stringify(c.body))));
  FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['16/11/2026', 'Rabie', 'Claude', 'Ordre', 'Vérifie les routines d’Iris.', 'À faire', '', '']];
  await p.fill('#chat-in', 'Merci, et confie à la tâche Claude la vérification');
  await p.press('#chat-in', 'Enter').catch(() => {}); await p.waitForTimeout(2500);
  if (!(await p.evaluate(() => /Confier à la tâche Claude/.test(document.getElementById('chat').textContent)))) { await p.evaluate(() => { const f = document.querySelector('#chat form'); if (f) f.requestSubmit(); }); await p.waitForTimeout(2500); }
  ok('discussion : proposition de tâche Claude (entourée de ``` par Claude) affichée proprement', await p.evaluate(() => { const c = document.getElementById('chat').textContent; return /Confier à la tâche Claude/.test(c) && !/⟦|```/.test(c); }));
  await p.screenshot({path: SH + 'discussion-tache.png'});
  n0 = FG.calls.length;
  await p.evaluate(() => [...document.querySelectorAll('#chat .msg.proposal.is-act .btn.main')].pop().click()); await p.waitForTimeout(19000);
  const puts = FG.calls.slice(n0).filter((c) => c.method === 'PUT').map((c) => c.path.split('/values/')[1]);
  ok('tâche Claude : lancée par la page, faite par le serveur (réponse et statut dans le Canal)', puts.includes('Canal!G2') && puts.includes('Canal!F2'), puts.join(' | '));
  /* notifications (0.12.0) : depuis Réglages, comme sur l'iPhone ouvert depuis l'écran d'accueil ; faux service de notifications et faux abonnement du navigateur */
  { const http = await import('node:http'), crypto = await import('node:crypto'); const got = [];
    const PS = http.createServer((q, res) => { const ch = []; q.on('data', (d) => ch.push(d)); q.on('end', () => { got.push({h: q.headers, n: Buffer.concat(ch).length}); res.writeHead(201); res.end(); }); });
    await new Promise((z) => PS.listen(0, '127.0.0.1', z));
    const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
    const fake = {endpoint: 'http://127.0.0.1:' + PS.address().port + '/push/iphone', keys: {p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url')}};
    const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.addInitScript((f) => {
      const mm = window.matchMedia.bind(window); window.matchMedia = (m) => (/display-mode: standalone/.test(m) ? {matches: true, addEventListener() {}, removeEventListener() {}} : mm(m));
      let cur = null; const sub = {endpoint: f.endpoint, toJSON: () => f, unsubscribe: () => { cur = null; return Promise.resolve(true); }};
      const reg = {pushManager: {getSubscription: () => Promise.resolve(cur), subscribe: (o) => { window.__pushKey = o && o.applicationServerKey && o.applicationServerKey.length; cur = sub; return Promise.resolve(sub); }}};
      Object.defineProperty(navigator, 'serviceWorker', {value: {ready: Promise.resolve(reg), getRegistration: () => Promise.resolve(reg), register: () => Promise.resolve(reg)}});
      window.PushManager = window.PushManager || function () {}; window.Notification = window.Notification || function () {};
      Object.defineProperty(window.Notification, 'permission', {get: () => 'default'}); window.Notification.requestPermission = () => Promise.resolve('granted');
    }, fake);
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    ok('Réglages : carte Notifications, bouton « Activer »', await q.evaluate(() => { const c = document.querySelector('.notif-card'); return !!c && /Activer les notifications/.test(c.textContent); }));
    await q.evaluate(() => [...document.querySelectorAll('.notif-card button')].find((b) => /Activer/.test(b.textContent)).click()); await q.waitForTimeout(2000);
    const st = await fetch(BASE + '/api/push', {headers: {authorization: 'Bearer ' + (await q.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken))}}).then((r) => r.json());
    ok('notifications : abonnement enregistré par le serveur (clé VAPID de 65 octets donnée au navigateur)', st.count === 1 && await q.evaluate(() => window.__pushKey === 65 && /Actives sur cet iPhone/.test(document.querySelector('.notif-card').textContent)), JSON.stringify(st).slice(0, 100));
    await q.evaluate(() => [...document.querySelectorAll('.notif-card button')].find((b) => /essai/.test(b.textContent)).click()); await q.waitForTimeout(1500);
    ok('notifications : « Envoyer un essai » part chiffré vers le service de notifications', got.length >= 1 && got[got.length - 1].h['content-encoding'] === 'aes128gcm' && /^vapid t=/.test(got[got.length - 1].h.authorization) && await q.evaluate(() => /Envoyée/.test(document.querySelector('.notif-card').textContent)));
    await q.evaluate(() => { const c = document.querySelector('.notif-card'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 90; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'reglages-notifications.png'});
    await q.evaluate(() => [...document.querySelectorAll('.notif-card button')].find((b) => /Couper/.test(b.textContent)).click()); await q.waitForTimeout(1500);
    ok('notifications : « Couper sur cet iPhone » retire l\'abonnement', await q.evaluate(() => /Activer les notifications/.test(document.querySelector('.notif-card').textContent)));
    PS.close(); }
} catch (e) { ok('exception', false, e.stack); }
ok('aucune erreur de page', !errs.length, errs.join(' | '));
console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('ÉCHEC')).length; console.log(bad ? bad + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications).');
await b.close(); srv.kill(); FG.close();
