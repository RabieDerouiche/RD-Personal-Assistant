/* Banc de bout en bout : vrai serveur JARVIS (faux Claude, faux Google) et la nouvelle app dans Chromium.
   Relier l'iPhone par code, enregistrer l'accès Google, se connecter, tester les données, page en direct.
   Lancer : NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-maquette/banc/banc-serveur.mjs */
import {spawn, execFileSync} from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x') : import.meta.url); const {chromium, devices} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', '..', '..', 'jarvis-os', 'server'), SH = path.join(os.tmpdir(), 'jarvis-os-banc') + path.sep; fs.mkdirSync(SH, {recursive: true});
const {startFakeGoogle} = await import(SRV + '/tests/fake-google.mjs'); const FG = await startFakeGoogle();
FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['15/11/2026', 'Rabie', 'Iris', 'Info', 'Le syndic a appelé.', 'Fait', 'Noté.', '']];
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-e2e-')), PORT = 19000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT;
const env = {...process.env, JARVIS_PUSH_ALLOW_HTTP: '1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_GOOGLE_FAKE: FG.url, PORT: String(PORT), JARVIS_DATA: DATA, CLAUDE_BIN: SRV + '/tests/fake-claude.mjs', JARVIS_TTS_HELPER: SRV + '/tests/fake-tts.mjs'};
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
  /* Siri et bouton Action (0.13.0) : clé créée dans Réglages, question posée comme par le Raccourci */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    ok('Réglages : carte « Siri et bouton Action »', await q.evaluate(() => /Créer la clé du Raccourci/.test((document.querySelector('.siri-card') || {}).textContent || '')));
    await q.evaluate(() => [...document.querySelectorAll('.siri-card button')].find((b) => /Créer la clé/.test(b.textContent)).click()); await q.waitForTimeout(1200);
    const k = await q.evaluate(() => (document.querySelector('.siri-key') || {}).textContent || '');
    ok('Siri : clé montrée une fois, avec les étapes (adresse, en-tête, champ « texte »)', k.length >= 30 && await q.evaluate((kk) => { const c = document.querySelector('.siri-card').textContent; return c.includes('/api/raccourci') && c.includes('Bearer ' + kk) && /Dicter le texte/.test(c) && /Énoncer le texte/.test(c); }, k));
    await q.evaluate(() => { const c = document.querySelector('.siri-card'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 90; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'reglages-siri.png'});
    const ans = await fetch(BASE + '/api/raccourci', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + k}, body: JSON.stringify({texte: 'Quoi de neuf ?'})}).then(async (x) => [x.status, await x.text()]);
    ok('Siri : le Raccourci obtient une réponse à lire', ans[0] === 200 && /Tu as dit : Quoi de neuf/.test(ans[1]), ans.join(' '));
    await q.reload(); await q.waitForTimeout(2500);
    ok('Siri : clé active, nombre de questions affiché, « Essayer ici »', await q.evaluate(() => { const c = document.querySelector('.siri-card').textContent; return /Clé active/.test(c) && /1 question/.test(c) && /Essayer ici/.test(c) && !document.querySelector('.siri-key'); })); }
  /* sauvegarde de Pilotage (0.14.0) : carte de Réglages, copie immédiate */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    ok('Réglages : carte « Sauvegarde de Pilotage »', await q.evaluate(() => /Pas encore de copie|Dernière copie/.test((document.querySelector('.sav-card') || {}).textContent || '')));
    await q.evaluate(() => [...document.querySelectorAll('.sav-card button')].find((b) => /Sauvegarder maintenant/.test(b.textContent)).click()); await q.waitForTimeout(2500);
    ok('sauvegarde : « Sauvegarder maintenant » fait une copie des 19 onglets', await q.evaluate(() => /Dernière copie le|Copie faite \(19 onglets\)/.test(document.querySelector('.sav-card').textContent))); }
  /* 0.15.0 : missions de Claude (Suivi), tour de Claude (Réglages), recherche dans le texte des papiers */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.goto(BASE + '/?serveur#suivi'); await q.waitForTimeout(2500);
    ok('Suivi : panneau « Missions de Claude » (avant l\'état des systèmes)', await q.evaluate(() => { const m = document.querySelector('.mis-panel'), hs = [...document.querySelectorAll('.panel h2')].map((x) => x.textContent); return !!m && /Aucune mission/.test(m.textContent) && hs.indexOf('Missions de Claude') === hs.indexOf('État des systèmes') - 1; }));
    await q.fill('.mis-inp', 'Compare trois assurances habitation'); await q.evaluate(() => [...document.querySelectorAll('.mis-panel button')].find((b) => /Lancer la mission/.test(b.textContent)).click()); await q.waitForTimeout(2500);
    await q.reload(); await q.waitForTimeout(2500); await q.evaluate(() => { const d = document.querySelector('.mis-it'); if (d) d.open = true; });
    ok('missions : lancée depuis Suivi, terminée, compte rendu lisible', await q.evaluate(() => { const m = document.querySelector('.mis-it'); return !!m && /Terminée/.test(m.textContent) && /Compte rendu : mission faite/.test(m.textContent); }));
    await q.evaluate(() => { const c = document.querySelector('.mis-panel'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 90; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'suivi-missions.png'});
    /* 0.16.0 : santé du serveur dans « État des systèmes » */
    await q.evaluate(() => [...document.querySelectorAll('.sante-box button')].find((b) => /Vérifier maintenant/.test(b.textContent)).click()); await q.waitForTimeout(1500);
    ok('Suivi : santé du serveur (Google relié, Claude connecté), vérifiable à la demande', await q.evaluate(() => { const t = (document.querySelector('.sante-box') || {}).textContent || ''; return /Accès Google\s*relié/.test(t) && /Claude sur le serveur\s*connecté/.test(t) && document.querySelectorAll('.sante-box .sys-row.is-ok').length >= 2; }));
    await q.evaluate(() => { const c = document.querySelector('.sante-box'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 200; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'suivi-sante.png'});
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    ok('Réglages : carte « Tour de Claude », coupée par défaut, notifications demandées', await q.evaluate(() => { const c = document.querySelector('.tour-card'); return !!c && c.querySelector('[aria-pressed="true"]').textContent === 'Non' && /Active d’abord les notifications/.test(c.textContent); }));
    await q.evaluate(() => [...document.querySelectorAll('.tour-card .seg button')].find((b) => b.textContent === '4 h').click()); await q.waitForTimeout(2500);
    ok('tour de Claude : fréquence choisie gardée par le serveur', await q.evaluate(() => document.querySelector('.tour-card [aria-pressed="true"]').textContent === '4 h'));
    await q.evaluate(() => [...document.querySelectorAll('.tour-card button')].find((b) => /Faire un tour maintenant/.test(b.textContent)).click()); await q.waitForTimeout(2500);
    ok('tour de Claude : « Faire un tour maintenant » dit ce qu\'il a trouvé', await q.evaluate(() => /Syndic à confirmer/.test(document.querySelector('.tour-card').textContent)));
    await q.evaluate(() => { const c = document.querySelector('.tour-card'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 90; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'reglages-tour.png'});
    await q.evaluate(() => [...document.querySelectorAll('.tour-card .seg button')].find((b) => b.textContent === 'Non').click()); await q.waitForTimeout(1500);
    const DF = 'application/vnd.google-apps.folder', PAPR = '1huMsPD8I81buG4GWhuoGmsOafvy4HrE4';
    FG.drive.push({id: PAPR, name: 'Papiers', parents: ['rda'], mimeType: DF, modifiedTime: '2025-01-02T10:00:00Z'}, {id: 'e-log', name: 'Logement', parents: [PAPR], mimeType: DF, modifiedTime: '2025-01-02T10:00:00Z'},
      {id: 'e1', name: 'Bail 2024.pdf', parents: ['e-log'], mimeType: 'application/pdf', modifiedTime: '2025-01-02T10:00:00Z', size: '1234', text: 'contrat de location, loyer mensuel'});
    await q.evaluate(() => { try { Object.keys(localStorage).filter((k) => /pap/i.test(k) && !/prive/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* rien */ } });
    await q.goto(BASE + '/?serveur#papiers'); await q.waitForTimeout(3500); await q.fill('.pap-search', 'loyer'); await q.waitForTimeout(2000);
    ok('papiers en direct : « loyer » trouvé dans le texte du bail (Drive, lecture seule)', FG.calls.some((c) => c.path === '/drive/files' && /fullText contains 'loyer'/.test(c.q.q || '')) && await q.evaluate(() => /Dans le texte des documents · 1/.test(document.querySelector('.pap-res').textContent) && /Bail 2024/.test((document.querySelector('.pap-res-txt') || {}).textContent || '') && !/null|undefined/.test(document.querySelector('.pap-res').textContent)),
      JSON.stringify(FG.calls.filter((c) => c.path === '/drive/files' && /fullText/.test(c.q.q || '')).map((c) => c.q.q)) + ' ' + await q.evaluate(() => document.querySelector('.pap-res').textContent.slice(0, 200)));
    await q.screenshot({path: SH + 'papiers-texte-serveur.png'}); }
} catch (e) { ok('exception', false, e.stack); }
ok('aucune erreur de page', !errs.length, errs.join(' | '));
console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('ÉCHEC')).length; console.log(bad ? bad + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications).');
await b.close(); srv.kill(); FG.close();
