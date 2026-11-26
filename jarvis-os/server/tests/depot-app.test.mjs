/* Le rangement des papiers de bout en bout (0.91.0) : un vrai serveur JARVIS, le faux Google, et l'écran Papiers › Déposer dans Chromium
   (iPhone simulé), par le vrai pont de la page (jarvis-serveur.js). Données inventées, aucun réseau.
   Lancer : NODE_PATH=/opt/node-tools/node_modules node jarvis-os/server/tests/depot-app.test.mjs   (DEPOT_APP_CAPTURE=<fichier.png> pour relire l'écran) */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
import {startFakeGoogle} from './fake-google.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', 'server.mjs'), APP = path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette');
const FG = await startFakeGoogle();
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-depot-app-')), PORT = 24000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT;
const out = []; let rates = 0; const ok = (n, c, i) => { if (!c) rates++; out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (!c && i ? ' :: ' + i : '')); };
const env = {...process.env, PORT: String(PORT), JARVIS_DATA: DATA, JARVIS_OS_DIR: APP, JARVIS_REPO: os.tmpdir(), JARVIS_MAJ: '0', JARVIS_HUMOUR: '0', JARVIS_GOOGLE_FAKE: FG.url, JARVIS_PAPIERS_ID: 'pap', JARVIS_RD_RACINE: 'rda', JARVIS_COURRIER: '0',
  JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_PUSH_ALLOW_HTTP: '1', CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), ANTHROPIC_API_KEY: 'sk-ant-faux-pour-le-test', ANTHROPIC_BASE_URL: 'https://exemple.invalid'};
const c = async (u, o = {}) => { const x = await fetch(BASE + u, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); return {status: x.status, body: await x.json().catch(() => null)}; };
const DRIVE = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive.readonly';
const QUITTANCE = Buffer.from('%PDF-1.4\n% quittance inventée du banc, avec des octets : \x00\x01\xfe\xff\n%%EOF\n', 'latin1'), PHOTO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from('photo inventée du banc')]);
const ecrituresDrive = () => FG.calls.filter((x) => x.method !== 'GET' && /^\/(drive|upload\/drive)\//.test(x.path)).length;

let srv = null, nav = null;
try {
  const code = execFileSync(process.execPath, [SRV, 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
  srv = spawn(process.execPath, [SRV], {env, stdio: ['ignore', 'pipe', 'pipe']}); await new Promise((z) => srv.stdout.once('data', z));
  const jeton = (await c('/api/pair', {method: 'POST', body: JSON.stringify({code, device: 'iPhone du banc'})})).body.token, A = {authorization: 'Bearer ' + jeton};
  const lier = async () => { const l = await c('/api/google/link', {method: 'POST', headers: A, body: '{}'}); await fetch(BASE + '/api/google/callback?state=' + new URL(l.body.url).searchParams.get('state') + '&code=CODE-OK'); };
  await c('/api/google/config', {method: 'POST', headers: A, body: JSON.stringify({clientId: FG.client.id, clientSecret: FG.client.secret})});
  FG.scope = DRIVE; await lier();   /* relié SANS la portée « drive », comme son lien d'aujourd'hui */

  const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x') : import.meta.url); const {chromium, devices} = require('playwright');
  nav = await chromium.launch(); const ctx = await nav.newContext({...devices['iPhone 15 Pro Max']}); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript((j) => { try { localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: j})); } catch (e) { /* rien */ } }, jeton);
  await p.goto(BASE + '/?serveur#papiers'); await p.waitForSelector('#view .dm-seg [data-f="depot"]', {timeout: 30000});
  await p.evaluate(() => document.querySelector('#view .dm-seg [data-f="depot"]').click());
  await p.waitForSelector('.dep-jarvis input[type=file]', {timeout: 20000});
  const cartes = () => p.evaluate(() => [...document.querySelectorAll('.dep-item')].map((x) => ({nom: x.querySelector('.dep-recu-t b').textContent, dossier: x.querySelector('.dep-dossier').selectedOptions[0].textContent, fichier: x.querySelector('.dep-nom').value + x.querySelector('.dep-ext').textContent, meta: x.querySelector('.dep-recu-t small').textContent})));
  const toasts = () => p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
  const t0 = await p.evaluate(() => document.querySelector('.dep-jarvis').innerText.replace(/\s+/g, ' '));
  ok('vrai serveur, sans la portée « drive » : l’écran du dépôt s’affiche (plus de carte « À trier ») et dit « Reconnecte Google une fois » ; rien n’attend', /JARVIS range tes papiers/.test(t0) && /Reconnecte Google une fois/.test(t0) && /Rien n’attend/.test(t0) && !/Le fichier va dans « À trier »/.test(t0), t0.slice(0, 300));

  const e0 = ecrituresDrive();
  await p.setInputFiles('.dep-jarvis input[type=file]', [{name: 'Quittance octobre.pdf', mimeType: 'application/pdf', buffer: QUITTANCE}]);
  await p.waitForSelector('.dep-item', {timeout: 20000});
  const c1 = await cartes(), garde = fs.readdirSync(path.join(DATA, 'depot'));
  ok('déposer par le champ fichier de l’app : le fichier arrive entier sur le serveur (mêmes octets, 600), la carte montre le dossier proposé dans l’arbre de Papiers et le nom ; rien n’est écrit dans Drive',
    c1.length === 1 && c1[0].nom === 'Quittance octobre.pdf' && c1[0].dossier === 'Logement › Locations' && /^Quittance de loyer/.test(c1[0].fichier) && garde.length === 1 && fs.readFileSync(path.join(DATA, 'depot', garde[0])).equals(QUITTANCE) && (fs.statSync(path.join(DATA, 'depot', garde[0])).mode & 0o777) === 0o600 && ecrituresDrive() === e0, JSON.stringify([c1, garde]));
  await p.evaluate(() => document.querySelector('.dep-item .dep-oui').click());
  await p.waitForFunction(() => /Reconnecte Google une fois/.test([...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' ')), null, {timeout: 20000});
  ok('« Oui, ranger ici » sans la portée : « Reconnecte Google une fois (Réglages, Google, Reconnecter) », le fichier attend, rien dans Drive', (await cartes()).length === 1 && ecrituresDrive() === e0 && FG.depots.length === 0, await toasts());

  /* il reconnecte Google (portée « drive » accordée), corrige le dossier et le nom, puis dit oui */
  FG.scope = DRIVE + ' https://www.googleapis.com/auth/drive'; await lier();
  await p.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); location.hash = '#accueil'; }); await p.waitForTimeout(800);
  await p.evaluate(() => { location.hash = '#voir-papiers-depot'; });
  await p.waitForFunction(() => !!document.querySelector('.dep-jarvis') && !/Reconnecte Google une fois/.test(document.querySelector('.dep-jarvis').innerText) && !!document.querySelector('.dep-item'), null, {timeout: 30000});
  await p.evaluate(() => { const s = document.querySelector('.dep-item .dep-dossier'); s.value = [...s.options].find((o) => o.textContent === 'Logement').value; s.dispatchEvent(new Event('change', {bubbles: true})); });
  await p.fill('.dep-item .dep-nom', 'Quittance du banc 2026-10');
  await p.evaluate(() => document.querySelector('.dep-item .dep-oui').click());
  await p.waitForFunction(() => document.querySelectorAll('.dep-ranges .pf').length === 1, null, {timeout: 30000});
  const f1 = FG.depots[0] || {}, r1 = await p.evaluate(() => ({ranges: document.querySelector('.dep-ranges').innerText.replace(/\s+/g, ' '), lien: document.querySelector('.dep-ranges .pf').href, cartes: document.querySelectorAll('.dep-item').length}));
  ok('Google reconnecté : il corrige le dossier et le nom, « Oui, ranger ici » : le fichier est dans le dossier choisi du (faux) Drive, octets intacts, sous son nom ; il quitte le serveur et passe dans « Rangés récemment » avec son lien',
    FG.depots.length === 1 && f1.parents.join() === 'f-log' && f1.name === 'Quittance du banc 2026-10.pdf' && f1.octets.equals(QUITTANCE) && fs.readdirSync(path.join(DATA, 'depot')).length === 0 && r1.cartes === 0 && /Quittance du banc 2026-10/.test(r1.ranges) && r1.lien === 'https://drive.example/' + f1.id
    && !FG.calls.some((x) => /permissions/.test(x.path)), JSON.stringify([FG.depots.map((f) => [f.name, f.parents]), r1, await toasts()]));

  /* le partage du système : le service worker a gardé un fichier dans son cache ; l'app l'envoie avec son jeton, puis vide le cache */
  await p.evaluate(async (octets) => { const k = await caches.open('jarvis-os-partage'); await k.put(new Request('/partage-recu/banc-0'), new Response(new Blob([new Uint8Array(octets)], {type: 'image/jpeg'}), {headers: {'content-type': 'image/jpeg', 'x-nom': encodeURIComponent('Reçu boulangerie.jpeg')}})); location.hash = '#accueil'; }, [...PHOTO]);
  await p.waitForTimeout(800); await p.evaluate(() => { location.hash = '#voir-papiers-depot'; });
  await p.waitForFunction(() => document.querySelectorAll('.dep-item').length === 1, null, {timeout: 30000});
  const c2 = await cartes(), reste = await p.evaluate(async () => (await (await caches.open('jarvis-os-partage')).keys()).length), g2 = fs.readdirSync(path.join(DATA, 'depot'));
  ok('partage du système (fichier gardé par le service worker) : envoyé par l’app avec le jeton de l’appareil, il attend son oui (« par le menu Partager ») ; le cache du partage est vidé ; rien de plus dans Drive',
    c2.length === 1 && c2[0].nom === 'Reçu boulangerie.jpg' && /par le menu Partager/.test(c2[0].meta) && reste === 0 && g2.length === 1 && fs.readFileSync(path.join(DATA, 'depot', g2[0])).equals(PHOTO) && FG.depots.length === 1, JSON.stringify([c2, reste, g2]));
  if (process.env.DEPOT_APP_CAPTURE) { await p.evaluate(() => document.querySelector('.dep-jarvis').scrollIntoView()); await p.screenshot({path: process.env.DEPOT_APP_CAPTURE}); }
  ok('aucune erreur de script dans la page', errs.length === 0, errs.join(' | '));
} catch (e) { ok('le banc est allé au bout', false, (e && e.stack) || String(e)); }
finally {
  if (nav) await nav.close().catch(() => {});
  if (srv) srv.kill('SIGTERM');
  FG.close(); fs.rmSync(DATA, {recursive: true, force: true});
}
console.log(out.join('\n'));
console.log(rates ? rates + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications).');
process.exit(rates ? 1 : 0);
