/* Banc 0.70.0, lot C (décisions du 23/11/2026) : node jarvis-os/server/tests/fiab-c.test.mjs (aucun vrai Claude, aucun vrai Google, aucun coût).
   « Retirer dans Réglages » : deux appareils reliés, la liste, le retrait de l'un depuis l'autre (401 pour le retiré, ses notifications retirées),
   se retirer soi-même refusé, un appareil inconnu. Puis le service worker de l'ancienne app (/ancienne/), exécuté hors navigateur.
   Noms d'appareils et adresses inventés. */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import vm from 'node:vm'; import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {b64u} from '../push.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), SERVEUR = path.join(HERE, '..', 'server.mjs');
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (cond || !info ? '' : ' :: ' + String(info).slice(0, 600))); if (!cond) fails++; };
const attends = (ms) => new Promise((z) => setTimeout(z, ms));
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'fiab-c-'));
const env = {...process.env, JARVIS_DATA: DATA, JARVIS_HUMOUR: '0', JARVIS_PUSH_ALLOW_HTTP: '1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_ROUTINES_MS: '3600000', JARVIS_RADAR_TICK_MS: '3600000', JARVIS_VOIX_BUDGET_MS: '3600000', JARVIS_MAJ: '0',
  CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), JARVIS_REPO: os.tmpdir(), JARVIS_OS_DIR: path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette'), JARVIS_TTS_HELPER: path.join(HERE, 'fake-tts.mjs'),
  JARVIS_STT_HELPER: path.join(HERE, 'fake-stt.mjs'), JARVIS_TOUR_HELPER: path.join(HERE, 'fake-tour.mjs'), JARVIS_AUDIO_PY: process.execPath, JARVIS_AUDIO_HELPER: path.join(HERE, 'fake-audio.mjs'), JARVIS_FFMPEG: ''};
delete env.JARVIS_GOOGLE_FAKE;
const nouveauCode = () => execFileSync(process.execPath, [SERVEUR, 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
const code1 = nouveauCode();
let journal = '', mort = null, srv = null, BASE = '';
/* d'autres bancs tournent peut-être en même temps : un port déjà pris, on en essaie un autre */
for (let essai = 0; essai < 5 && !srv; essai++) {
  const PORT = 22000 + Math.floor(Math.random() * 900); BASE = 'http://127.0.0.1:' + PORT; env.PORT = String(PORT); journal = ''; mort = null;
  const s = spawn(process.execPath, [SERVEUR], {env, stdio: ['ignore', 'pipe', 'pipe']});
  s.stdout.on('data', (d) => { journal += d; }); s.stderr.on('data', (d) => { journal += d; });
  s.on('exit', (c, sig) => { mort = c === null ? sig : c; });
  await new Promise((z) => { s.stdout.once('data', z); s.once('exit', z); });
  if (mort === null) srv = s;
}
if (!srv) { console.log('ÉCHEC serveur pas démarré :: ' + journal.slice(-400)); process.exit(1); }
const call = async (p, o = {}) => { try { const r = await fetch(BASE + p, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { j = null; } return {status: r.status, body: j}; } catch (e) { return {status: 0, erreur: String(e.cause && e.cause.code || e.message)}; } };
const etat = () => JSON.parse(fs.readFileSync(path.join(DATA, 'state.json'), 'utf8'));
const abonnement = (nom) => ({endpoint: 'http://127.0.0.1:9/push-' + nom, keys: {p256dh: b64u(Buffer.concat([Buffer.from([4]), crypto.randomBytes(64)])), auth: b64u(crypto.randomBytes(16))}});

try {
  /* ---------- deux appareils reliés ---------- */
  const pa = await call('/api/pair', {method: 'POST', body: JSON.stringify({code: code1, device: 'JARVIS OS · iPad essai'})});
  const code2 = nouveauCode();   /* un second code, le serveur en marche (comme « node server.mjs pair » en SSH) */
  const pb = await call('/api/pair', {method: 'POST', body: JSON.stringify({code: code2, device: 'JARVIS OS · iPhone essai'})});
  const A = {authorization: 'Bearer ' + (pa.body && pa.body.token)}, B = {authorization: 'Bearer ' + (pb.body && pb.body.token)};
  ok('deux appareils reliés (deux codes, le second créé serveur en marche)', pa.status === 200 && pb.status === 200 && pa.body.token !== pb.body.token, JSON.stringify([pa, pb]));
  const sa = await call('/api/push/subscribe', {method: 'POST', headers: A, body: JSON.stringify({subscription: abonnement('a')})});
  const sb = await call('/api/push/subscribe', {method: 'POST', headers: B, body: JSON.stringify({subscription: abonnement('b')})});
  const subs0 = etat().push.subs.map((x) => x.endpoint.split('-').pop() + ':' + x.device);
  ok('notifications : chaque appareil a son abonnement, marqué de son empreinte', sa.status === 200 && sb.status === 200 && subs0.length === 2, JSON.stringify([sa, sb, subs0]));

  /* ---------- la liste ---------- */
  const la = await call('/api/appareils', {headers: B}), l = (la.body && la.body.appareils) || [];
  const ia = l.find((x) => /iPad essai/.test(x.nom)), ib = l.find((x) => /iPhone essai/.test(x.nom));
  ok('GET /api/appareils : les deux, avec nom, date de liaison et « moi » pour celui qui demande ; empreinte courte seulement (12 caractères), jamais le jeton ni son empreinte entière',
    la.status === 200 && l.length === 2 && ia && ib && ib.moi === true && ia.moi === false && /^[0-9a-f]{12}$/.test(ia.id) && /^[0-9a-f]{12}$/.test(ib.id) && Math.abs(Date.now() - ia.at) < 60000
    && !JSON.stringify(la.body).includes(pa.body.token) && !JSON.stringify(la.body).includes(etat().tokens[0].hash) && Object.keys(ia).sort().join() === 'at,id,moi,nom', JSON.stringify(la.body));
  const sans = await call('/api/appareils'), sansR = await call('/api/appareils/retirer', {method: 'POST', body: JSON.stringify({id: ia && ia.id})});
  ok('sans jeton : la liste et le retrait répondent 401', sans.status === 401 && sansR.status === 401, JSON.stringify([sans, sansR]));

  /* ---------- se retirer soi-même : refusé ; un appareil inconnu : 404 ---------- */
  const soi = await call('/api/appareils/retirer', {method: 'POST', headers: B, body: JSON.stringify({id: ib && ib.id})});
  const inconnu = await call('/api/appareils/retirer', {method: 'POST', headers: B, body: JSON.stringify({id: 'ffffffffffff'})}), vide = await call('/api/appareils/retirer', {method: 'POST', headers: B, body: '{}'});
  ok('se retirer soi-même : 400 avec une phrase claire, rien n’est retiré', soi.status === 400 && /ne peut pas se retirer lui-même/.test(soi.body && soi.body.error) && etat().tokens.length === 2 && (await call('/api/status', {headers: B})).status === 200, JSON.stringify(soi));
  ok('appareil inconnu (ou id vide) : 404 « Appareil introuvable », rien n’est retiré', inconnu.status === 404 && /Appareil introuvable/.test(inconnu.body && inconnu.body.error) && vide.status === 404 && etat().tokens.length === 2, JSON.stringify([inconnu, vide]));

  /* ---------- retirer le premier depuis le second ---------- */
  const ret = await call('/api/appareils/retirer', {method: 'POST', headers: B, body: JSON.stringify({id: ia && ia.id})});
  const stA = await call('/api/status', {headers: A}), stB = await call('/api/status', {headers: B}), toolA = await call('/api/tool', {method: 'POST', headers: A, body: JSON.stringify({server: 'Gmail', tool: 'search_threads', input: {}})});
  ok('retrait du premier depuis le second : 200 ; ensuite le premier reçoit 401 sur /api/status (et /api/tool), le second 200',
    ret.status === 200 && ret.body.ok === true && ret.body.nom === 'JARVIS OS · iPad essai' && stA.status === 401 && toolA.status === 401 && stB.status === 200 && ret.body.appareils.length === 1 && ret.body.appareils[0].moi === true, JSON.stringify([ret, stA.status, toolA.status, stB.status]));
  const e1 = etat(), subs1 = e1.push.subs.map((x) => x.endpoint.split('-').pop());
  ok('retrait : le jeton sort de l’état gardé ; les notifications du retiré partent avec lui, celles du second restent', e1.tokens.length === 1 && ret.body.notifications === 1 && subs1.join() === 'b' && (await call('/api/push', {headers: B})).body.count === 1, JSON.stringify([ret.body, subs1]));
  const encore = await call('/api/appareils/retirer', {method: 'POST', headers: A, body: JSON.stringify({id: ib && ib.id})});
  ok('le retiré ne peut plus rien retirer (401)', encore.status === 401 && etat().tokens.length === 1, JSON.stringify(encore));
} catch (e) { ok('exception', false, e && e.stack); }
try { srv.kill(); } catch { /* rien */ }

/* ---------- le service worker de l'ancienne app (jarvis-os/app/public/sw.js, recopié tel quel dans jarvis-os/web/sw.js) ---------- */
try {
  const SRC = fs.readFileSync(path.join(HERE, '..', '..', 'app', 'public', 'sw.js'), 'utf8'), WEB = fs.readFileSync(path.join(HERE, '..', '..', 'web', 'sw.js'), 'utf8');
  ok('ancienne app : le service worker servi (web/sw.js) est la copie exacte de celui de l’app (app/public/sw.js)', SRC === WEB);
  const vieux = (o = {}) => {
    const H = {}, j = {effaces: [], gardes: []};
    const self = {addEventListener: (t, f) => { H[t] = f; }, skipWaiting: () => Promise.resolve(), clients: {claim: () => Promise.resolve()}};
    const caches = {open: () => Promise.resolve({addAll: () => Promise.resolve(), put: (r) => { j.gardes.push(typeof r === 'string' ? r : r.url); return Promise.resolve(); }}),
      keys: () => Promise.resolve(o.caches || []), delete: (k) => { j.effaces.push(k); return Promise.resolve(true); }, match: () => Promise.resolve(null)};
    vm.runInNewContext(SRC, {self, caches, fetch: () => Promise.resolve({ok: true, status: 200, clone: () => ({})}), URL, Promise, location: {origin: 'https://jarvis.essai'}});
    const attendre = async (t, ev) => { const w = []; H[t](Object.assign({waitUntil: (p) => w.push(p)}, ev || {})); await Promise.all(w); };
    const charger = async (url) => { let rendu = null; H.fetch({request: {method: 'GET', url}, respondWith: (p) => { rendu = p; }}); if (rendu) await rendu; return !!rendu; };
    return {j, attendre, charger};
  };
  { const S = vieux({caches: ['jarvis-os-v3', 'jarvis-os-app-v4', 'jarvis-os-app-v3', 'panier-v2', 'autre']}); await S.attendre('activate');
    ok('ancienne app : à l’activation, elle n’efface que ses propres anciens caches (jarvis-os-v3), ni ceux de la nouvelle app (jarvis-os-app-…) ni Panier', S.j.effaces.join() === 'jarvis-os-v3', JSON.stringify(S.j)); }
  { const S = vieux(), api = await S.charger('https://jarvis.essai/api/status'), page = await S.charger('https://jarvis.essai/ancienne/'); await attends(10);
    ok('ancienne app : une réponse de /api/ n’est plus gardée en copie (ses données restaient dans le cache du téléphone) ; la page, oui', !api && page && S.j.gardes.join() === 'https://jarvis.essai/ancienne/', JSON.stringify([api, page, S.j.gardes])); }
} catch (e) { ok('exception (ancien service worker)', false, e && e.stack); }

console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
fs.rmSync(DATA, {recursive: true, force: true});
process.exit(fails ? 1 : 0);
