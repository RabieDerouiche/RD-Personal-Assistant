/* Banc de bout en bout : vrai serveur JARVIS (faux Claude, faux Google) et la nouvelle app dans Chromium.
   Relier l'iPhone par code, enregistrer l'accès Google, se connecter, tester les données, page en direct.
   Lancer : NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-maquette/banc/banc-serveur.mjs */
import {spawn, execFileSync} from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x') : import.meta.url); const {chromium, devices} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', '..', '..', 'jarvis-os', 'server'), SH = path.join(os.tmpdir(), 'jarvis-os-banc') + path.sep; fs.mkdirSync(SH, {recursive: true});
const {startFakeGoogle} = await import(SRV + '/tests/fake-google.mjs'); const FG = await startFakeGoogle();
FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['15/11/2026', 'Rabie', 'Iris', 'Info', 'Le syndic a appelé.', 'Fait', 'Noté.', '']];
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-e2e-')), PORT = 19000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT;
const env = {...process.env, JARVIS_GOOGLE_FAKE: FG.url, PORT: String(PORT), JARVIS_DATA: DATA, CLAUDE_BIN: SRV + '/tests/fake-claude.mjs', JARVIS_TTS_HELPER: SRV + '/tests/fake-tts.mjs'};
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
  const t = await p.evaluate(() => document.querySelector('.set-card .set-msg').textContent); ok('test des données : Pilotage lu par le serveur', /Pilotage lu : 1 lignes/.test(t), t);
  await p.screenshot({path: SH + 'set-2.png'});
  const before = FG.calls.length;
  await p.goto(BASE + '/?serveur'); await p.waitForTimeout(6000);
  const used = FG.calls.slice(before).map((c) => c.path.replace(/\/v4\/spreadsheets\/[^/]+\/values\//, ' values ').replace(/^\/(\w+).*?(values .*|events|threads|drafts).*$/, '$1 $2'));
  const uniq = [...new Set(used)];
  ok('page en direct : Pilotage, agenda et Gmail lus par l’accès Google', uniq.some((u) => /sheets values Canal/.test(u)) && uniq.some((u) => /calendar events/.test(u)) && uniq.some((u) => /gmail threads/.test(u)), uniq.length + ' sources : ' + uniq.slice(0, 8).join(' | '));
  ok('aucune donnée d’exemple chargée', await p.evaluate(() => !document.querySelector('script[src="donnees-fictives.js"]')));
  await p.screenshot({path: SH + 'os-live.png'});
} catch (e) { ok('exception', false, e.stack); }
ok('aucune erreur de page', !errs.length, errs.join(' | '));
console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('ÉCHEC')).length; console.log(bad ? bad + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications).');
await b.close(); srv.kill(); FG.close();
