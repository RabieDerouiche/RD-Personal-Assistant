/* Banc de la 0.70.0, lot A1 (cœur du serveur) : node tests/fiab-a1.test.mjs (aucun vrai Claude, aucun vrai Google, aucun coût).
   Chaque correction du lot a sa vérification : état abîmé, appairage, tâche d'un proche (formule, date, double écriture), relances, sonnette,
   Claude qui s'arrête (EPIPE), missions, rangement de la mémoire, tour, ordres aux bots, tâche Claude (Déploiement), agenda, MCP.
   Données inventées seulement. A1_SERVEUR=<fichier> lance un autre server.mjs (même dossier), pour voir le banc échouer sur l'ancien code. */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startFakeGoogle} from './fake-google.mjs';
import {paris} from '../notify.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVEUR = process.env.A1_SERVEUR ? path.resolve(process.env.A1_SERVEUR) : path.join(HERE, '..', 'server.mjs');
const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (cond || !info ? '' : ' :: ' + String(info).slice(0, 600))); if (!cond) fails++; if (process.env.A1_SUIVI) process.stderr.write(results[results.length - 1].slice(0, 300) + '\n'); };
const until = async (f, ms = 8000, pas = 100) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(pas); } };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-a1-'));

/* ---------- faux Google, et devant lui un relais qui peut ralentir, faire tomber ou modifier une réponse ---------- */
const FG = await startFakeGoogle();
const PX = {hooks: [], log: []};
const PXS = http.createServer((q, res) => {
  const ch = []; q.on('data', (d) => ch.push(d)); q.on('end', async () => {
    const body = Buffer.concat(ch), p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    PX.log.push({method: q.method, path: p, at: Date.now()});
    const hs = PX.hooks.filter((h) => (!h.method || h.method === q.method) && h.re.test(p));
    for (const h of hs) if (h.delay) await sleep(h.delay);
    const f = hs.find((h) => h.fail); if (f) { res.writeHead(f.fail, {'content-type': 'application/json'}); res.end(JSON.stringify({error: {code: f.fail, message: 'panne simulée'}})); return; }
    try {
      const r = await fetch(FG.url + q.url, {method: q.method, headers: {...(q.headers.authorization ? {authorization: q.headers.authorization} : {}), ...(q.headers['content-type'] ? {'content-type': q.headers['content-type']} : {})}, body: ['GET', 'HEAD'].includes(q.method) ? undefined : body});
      let txt = Buffer.from(await r.arrayBuffer());
      const t = hs.find((h) => h.transform); if (t && r.ok) { t.k = (t.k || 0) + 1; txt = Buffer.from(JSON.stringify(t.transform(JSON.parse(txt.toString()), t.k))); }
      res.writeHead(r.status, {'content-type': r.headers.get('content-type') || 'application/json'}); res.end(r.status === 204 ? '' : txt);
    } catch (e) { res.writeHead(502); res.end(JSON.stringify({error: {message: String(e.message)}})); }
  });
});
await new Promise((z) => PXS.listen(0, '127.0.0.1', z));
const PXURL = 'http://127.0.0.1:' + PXS.address().port;
const hook = (h) => { PX.hooks.push(h); return () => { PX.hooks = PX.hooks.filter((x) => x !== h); }; };

/* ---------- faux Claude : celui du banc, derrière une enveloppe qui note les demandes et obéit à des drapeaux (fichiers de A1_FLAGS) ---------- */
const ENV_BIN = path.join(TMP, 'claude-a1.mjs');
fs.writeFileSync(ENV_BIN, `#!/usr/bin/env node
import {spawn} from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const REAL = process.env.A1_VRAI_CLAUDE, F = process.env.A1_FLAGS || '', a = process.argv.slice(2);
const flag = (n) => { try { return fs.existsSync(path.join(F, n)); } catch { return false; } };
const pass = (stdio) => spawn(process.execPath, [REAL, ...a], {stdio});
if (a[0] === 'mcp') {
  const L = ['claude.ai Google Calendar: https://calendarmcp.example/mcp/v1 - ✓ Connected', 'claude.ai Google Sheets: https://sheetsmcp.example/mcp/v1 - ✓ Connected', 'claude.ai Gmail: https://gmailmcp.example/mcp/v1 - ✓ Connected']
    .filter((l) => !(flag('sans-sheets') && /Sheets/.test(l)) && !(flag('sans-gmail') && /Gmail/.test(l)));
  console.log('Checking MCP server health…\\n\\n' + L.join('\\n')); process.exit(0);
}
if (a[0] !== '-p') { const c = pass('inherit'); c.on('exit', (k) => process.exit(k ?? 1)); }
else if (a.includes('--input-format')) {
  if (flag('athena')) {
    const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n'), TXT = 'Je prépare la mission pour Athéna, elle attend ton accord.\\nMISSIONS: [{"agent":"Athéna","text":"veille IA de la semaine"},{"agent":" KAIROS ","text":"relever le prix du robot"}]';
    out({type: 'system', subtype: 'init', session_id: 's-a1', tools: [], mcp_servers: []}); let buf = '';
    process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\\n')) >= 0) { buf = buf.slice(i + 1); out({type: 'result', is_error: false, result: TXT, session_id: 's-a1'}); } });
    process.stdin.on('end', () => process.exit(0));
  } else { const c = pass('inherit'); c.on('exit', (k) => process.exit(k ?? 1)); }
} else {
  let input = ''; process.stdin.on('data', (d) => { input += d; });
  process.stdin.on('end', async () => {
    try { fs.appendFileSync(path.join(F, 'prompts.jsonl'), JSON.stringify({at: Date.now(), input: input.length > 6000 ? input.slice(0, 3000) + ' … ' + input.slice(-3000) : input}) + '\\n'); } catch { /* rien */ }
    if (flag('lent-tour') && /Tour de JARVIS/.test(input)) await new Promise((z) => setTimeout(z, 1200));
    const c = pass(['pipe', 'inherit', 'inherit']); c.stdin.on('error', () => {}); c.stdin.end(input); c.on('exit', (k) => process.exit(k ?? 1));
  });
}
`, {mode: 0o755});
/* un Claude qui s'arrête aussitôt sans rien lire (mise à jour ratée, manque de mémoire) : l'écriture de la demande tombe sur un tube fermé */
const SH_BIN = path.join(TMP, 'claude-mort.sh');
fs.writeFileSync(SH_BIN, '#!/bin/sh\ncase "$1" in\n  mcp) echo "claude.ai Google Sheets: https://sheetsmcp.example/mcp/v1 - ✓ Connected"; exit 0;;\n  auth) echo \'{"loggedIn":true}\'; exit 0;;\nesac\nexit 1\n', {mode: 0o755});

/* ---------- un serveur JARVIS de banc ---------- */
const TOK = 'jeton-de-banc-a1-' + crypto.randomBytes(8).toString('hex'), A = {authorization: 'Bearer ' + TOK};
const portLibre = () => new Promise((z) => { const s = http.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => z(p)); }); });
const baseEnv = (data, flags, port) => ({...process.env, JARVIS_HUMOUR: '0', JARVIS_PUSH_ALLOW_HTTP: '1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_RADAR_TICK_MS: '3600000', JARVIS_ROUTINES_MS: '3600000',
  JARVIS_PAUSE_CACHE_MS: '0', JARVIS_BELL_DEDUP_MS: '0', JARVIS_PAPIERS_ID: 'pap', JARVIS_RD_RACINE: 'rda', JARVIS_GOOGLE_FAKE: PXURL, PORT: String(port), JARVIS_DATA: data, CLAUDE_BIN: ENV_BIN, A1_VRAI_CLAUDE: path.join(HERE, 'fake-claude.mjs'), A1_FLAGS: flags,
  JARVIS_ORIGINS: 'https://exemple.invalid', JARVIS_REPO: os.tmpdir(), JARVIS_MAJ: '0', JARVIS_OS_DIR: path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette'), JARVIS_TTS_HELPER: path.join(HERE, 'fake-tts.mjs'), JARVIS_VOICE_MODEL: path.join(HERE, 'fake-tts.mjs'),
  JARVIS_STT_HELPER: path.join(HERE, 'fake-stt.mjs'), JARVIS_TOUR_HELPER: path.join(HERE, 'fake-tour.mjs'), JARVIS_AUDIO_PY: process.execPath, JARVIS_AUDIO_HELPER: path.join(HERE, 'fake-audio.mjs'), JARVIS_FFMPEG: '', JARVIS_TACHES_CACHE_MS: '0', JARVIS_RAPPEL_MS: '3600000', JARVIS_VOIX_BUDGET_MS: '3600000'});
const SERVEURS = [];
async function demarrer({etat, env = {}, flags = [], data} = {}) {
  data = data || fs.mkdtempSync(path.join(TMP, 'data-')); const F = path.join(data, 'drapeaux'); fs.mkdirSync(F, {recursive: true});
  for (const f of flags) fs.writeFileSync(path.join(F, f), '');
  if (etat !== undefined && !fs.existsSync(path.join(data, 'state.json'))) fs.writeFileSync(path.join(data, 'state.json'), typeof etat === 'string' ? etat : JSON.stringify({tokens: [{hash: sha(TOK), at: 1, device: 'banc'}], ...etat}));
  const port = await portLibre(), e = {...baseEnv(data, F, port), ...env}, proc = spawn(process.execPath, [SERVEUR], {env: e, stdio: ['ignore', 'pipe', 'pipe']});
  const S = {data, F, port, env: e, proc, base: 'http://127.0.0.1:' + port, out: '', err: '', exit: null};
  proc.stdout.on('data', (d) => { S.out += d; }); proc.stderr.on('data', (d) => { S.err += d; }); proc.on('exit', (c, sig) => { S.exit = c ?? sig ?? 'fin'; });
  SERVEURS.push(S);
  await until(() => /JARVIS OS serveur/.test(S.out) || S.exit !== null, 15000, 30);
  S.call = async (p, o = {}) => { const r = await fetch(S.base + p, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch { b = t; } return {status: r.status, body: b, headers: r.headers}; };
  S.G = (p, b) => S.call(p, b !== undefined ? {method: 'POST', headers: A, body: JSON.stringify(b)} : {headers: A});
  S.vivant = async () => { try { return (await fetch(S.base + '/api/health')).status === 200 && S.exit === null; } catch { return false; } };
  S.stop = async () => { if (S.exit === null) { await new Promise((z) => { proc.once('exit', z); proc.kill('SIGKILL'); }); } };
  S.drapeau = (n, oui = true) => { const f = path.join(F, n); if (oui) fs.writeFileSync(f, ''); else fs.rmSync(f, {force: true}); };
  S.prompts = () => { try { return fs.readFileSync(path.join(F, 'prompts.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  S.etat = () => JSON.parse(fs.readFileSync(path.join(data, 'state.json'), 'utf8'));
  return S;
}
async function relierGoogle(S) {
  await S.G('/api/google/config', {clientId: FG.client.id, clientSecret: FG.client.secret});
  const r = await S.G('/api/google/link', {}), st = new URL(r.body.url).searchParams.get('state');
  await fetch(S.base + '/api/google/callback?state=' + st + '&code=CODE-OK');
  return (await S.G('/api/google')).body.linked === true;
}
const sse = async (S, text) => { const r = await fetch(S.base + '/api/chat', {method: 'POST', headers: {...A, 'content-type': 'application/json'}, body: JSON.stringify({text, model: 'rapide'})}); const t = await r.text(); const evs = []; for (const b of t.split('\n\n')) { const m = /^event: (\w+)\ndata: (.*)$/s.exec(b.trim()); if (m) evs.push({ev: m[1], d: JSON.parse(m[2])}); } return evs; };
const mission = (S, id) => S.G('/api/state').then((r) => (r.body.missions || []).find((m) => m.id === id));
const appendsDe = (texte) => (FG.appends || []).filter((a) => /^Tâches!A1$/.test(a.range) && String((a.values[0] || [])[1]).replace(/^'/, '') === texte);
const mailTxt = (c) => { if (!c) return ''; const raw = Buffer.from(String(c.body.raw || ''), 'base64url').toString('utf8'); return raw + '\n' + Buffer.from(raw.split('\r\n\r\n')[1] || '', 'base64').toString('utf8'); };
const envois = () => FG.calls.filter((x) => x.path === '/gmail/users/me/messages/send');
const idDe = (ms, hex) => ms.toString(36) + hex;   /* comme uid() du serveur */

/* ---------- faux service de notifications : le « téléphone » déchiffre chaque message (RFC 8291) ---------- */
const GOT = []; const PS = http.createServer((q, res) => { const ch = []; q.on('data', (d) => ch.push(d)); q.on('end', () => { GOT.push(Buffer.concat(ch)); res.writeHead(201); res.end(); }); });
await new Promise((z) => PS.listen(0, '127.0.0.1', z));
const UA = crypto.createECDH('prime256v1'); UA.generateKeys(); const PAUTH = crypto.randomBytes(16);
const hm = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
const ouvrir = (b) => { const salt = b.subarray(0, 16), idl = b[20], asPub = b.subarray(21, 21 + idl), ct = b.subarray(21 + idl);
  const ikm = hm(hm(PAUTH, UA.computeSecret(asPub)), Buffer.concat([Buffer.from('WebPush: info\0'), UA.getPublicKey(), asPub, Buffer.from([1])])), prk = hm(salt, ikm);
  const d = crypto.createDecipheriv('aes-128-gcm', hm(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), hm(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12));
  d.setAuthTag(ct.subarray(ct.length - 16)); const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]); return JSON.parse(pt.subarray(0, pt.lastIndexOf(2)).toString()).notification; };
const titres = (n0 = 0) => GOT.slice(n0).map((b) => { try { return ouvrir(b).title; } catch { return '?'; } });
const abonner = (S) => S.G('/api/push/subscribe', {subscription: {endpoint: 'http://127.0.0.1:' + PS.address().port + '/push/iphone', keys: {p256dh: UA.getPublicKey().toString('base64url'), auth: PAUTH.toString('base64url')}}});

const H_CANAL = ['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'];
try {
  /* ================= 1. state.json abîmé ou illisible (srv-a#2) ================= */
  { const S = await demarrer({etat: '{"tokens": [{"hash": "abc"'});
    const copies = fs.readdirSync(S.data).filter((f) => /^state\.json\.corrompu-\d+$/.test(f));
    const copie = copies.length ? fs.readFileSync(path.join(S.data, copies[0]), 'utf8') : '';
    ok('état abîmé : copie gardée à côté (contenu d’origine), message clair, JARVIS repart quand même', copies.length === 1 && copie === '{"tokens": [{"hash": "abc"' && /state\.json abîmé : copie gardée/.test(S.err) && await S.vivant(), JSON.stringify([copies, S.err.slice(0, 200)]));
    await S.stop(); }
  { const data = fs.mkdtempSync(path.join(TMP, 'data-')); fs.mkdirSync(path.join(data, 'state.json')); fs.writeFileSync(path.join(data, 'state.json', 'garde.txt'), 'x');
    const S = await demarrer({data}); await until(() => S.exit !== null, 8000);
    ok('état illisible (pas un fichier) : JARVIS s’arrête (code 1) avec un message, sans rien écraser', S.exit === 1 && /state\.json illisible \(EISDIR\)/.test(S.err) && fs.statSync(path.join(data, 'state.json')).isDirectory() && fs.existsSync(path.join(data, 'state.json', 'garde.txt')), JSON.stringify([S.exit, S.err.slice(0, 300)]));
    await S.stop(); }

  /* ================= 2. serveur A : le plus gros des vérifications ================= */
  const SA = await demarrer({etat: {}, env: {JARVIS_INV_RELANCE_MS: '200'}});
  /* appairage (srv-a#5, srv-routes#11) : 10 essais par code, plus pour tout Internet */
  { let st = []; for (let k = 0; k < 12; k++) st.push((await SA.call('/api/pair', {method: 'POST', body: JSON.stringify({code: 'AAAA-BBB' + (k % 10)})})).status);
    const code = () => execFileSync(process.execPath, [SERVEUR, 'pair'], {env: SA.env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
    const c1 = code(), r1 = await SA.call('/api/pair', {method: 'POST', body: JSON.stringify({code: c1, device: 'iPad banc'})});
    ok('appairage : sans code en attente, 12 essais faux ne bloquent rien (401, jamais 429) ; le nouveau code marche', st.every((x) => x === 401) && r1.status === 200 && !!r1.body.token, JSON.stringify([st, r1.status, r1.body]));
    const c2 = code(); st = []; for (let k = 0; k < 11; k++) st.push((await SA.call('/api/pair', {method: 'POST', body: JSON.stringify({code: 'ZZZZ-ZZZ' + k})})));
    const r2 = await SA.call('/api/pair', {method: 'POST', body: JSON.stringify({code: c2})});
    const c3 = code(), r3 = await SA.call('/api/pair', {method: 'POST', body: JSON.stringify({code: c3})});
    ok('appairage : 10 essais par code, puis 429 qui dit de créer un code ; un nouveau code remet le compteur à zéro', st.slice(0, 10).every((x) => x.status === 401) && st[10].status === 429 && /Crée-en un nouveau/.test(st[10].body.error) && r2.status === 429 && r3.status === 200, JSON.stringify([st.map((x) => x.status), st[10].body, r2.status, r3.status])); }
  /* missions inventées pour le MCP (srv-b#9) : un résultat avec un taux et une mensualité, un texte avec un taux, un résultat ordinaire */
  { const t = Date.now();
    const r = await SA.G('/api/import', {missions: [{id: 'a1credit01', agent: 'claude', text: 'Comparer les offres de rachat', status: 'terminee', at: t - 7200e3, done: t - 7000e3, result: 'Meilleure offre : prêt immobilier au taux de 3,1 % sur 20 ans, mensualité 950 €.'},
      {id: 'a1veille01', agent: 'claude', text: 'Résumer la veille de la semaine', status: 'terminee', at: t - 3600e3, done: t - 3500e3, result: 'Trois articles lus, rien d’urgent.'},
      {id: 'a1taux0001', agent: 'claude', text: 'Négocier le taux de 3,1 % du prêt immobilier', status: 'a_approuver', at: t - 600e3}]});
    ok('banc : missions inventées importées', r.status === 200, JSON.stringify(r.body)); }
  ok('banc : Google relié (faux Google derrière le relais)', await relierGoogle(SA));
  await abonner(SA);

  /* tâche d'un proche (srv-a#1, srv-routes#2) : jamais une formule ; (srv-a#3) dates ; (srv-a#4) une seule écriture, statut du moment */
  { const cr = await SA.G('/api/invites', {nom: 'Lina'}), IH = {authorization: 'Bearer ' + cr.body.cle, 'content-type': 'application/json'};
    const envoyer = async (texte) => { const r = await fetch(SA.base + '/api/invite/tache', {method: 'POST', headers: IH, body: JSON.stringify({texte})}); return {status: r.status, texte: await r.text(), ap: FG.appends ? FG.appends[FG.appends.length - 1] : null, row: 100 + (FG.appends || []).length}; };
    const f = await envoyer('=1+1'), m = await envoyer('- lait demi-écrémé'), n = await envoyer('12/12'), pl = await envoyer('+33 6 00 00 00 00 à rappeler'), q = await envoyer("'Allo' au plombier"), pain = await envoyer('Prendre du pain');
    ok('tâche d’un proche : un texte qui ressemble à une formule, un nombre ou une date est écrit comme texte (apostrophe de tête), le reste tel quel',
      f.ap.values[0][1] === "'=1+1" && m.ap.values[0][1] === "'- lait demi-écrémé" && n.ap.values[0][1] === "'12/12" && pl.ap.values[0][1] === "'+33 6 00 00 00 00 à rappeler" && q.ap.values[0][1] === "''Allo' au plombier" && pain.ap.values[0][1] === 'Prendre du pain' && f.ap.values[0][4] === 'De Lina',
      JSON.stringify([f, m, n, pl, q, pain].map((x) => x.ap && x.ap.values[0][1])));
    /* Sheets ne renvoie pas l'apostrophe : la ligne est retrouvée par son texte, son « Fait » est lu */
    const vals = Array.from({length: f.row}, () => []); vals[0] = ['Ajoutée le', 'Tâche', 'Pour le', 'Statut', 'Remarque']; vals[f.row - 1] = ['23/11/2026', '=1+1', '', 'Fait', 'De Lina']; FG.sheet['Tâches!A1:E500'] = vals;
    const sj = await fetch(SA.base + '/api/invite/taches', {headers: IH}).then((x) => x.json()), tf = (sj.taches || []).find((x) => x.texte === '=1+1');
    ok('tâche d’un proche : « =1+1 » retrouvée dans Pilotage, son « Fait » est vu', tf && tf.statut === 'Fait', JSON.stringify(sj.taches && sj.taches.slice(0, 3)));
    /* dates dictées (srv-a#3) */
    const tel = await envoyer('Rappelle le 06 12 34 56 78 pour le vaccin'), d31 = await envoyer('Acheter des fleurs le 31'), d31n = await envoyer('Réserver la salle le 31 novembre'), d30f = await envoyer('Dentiste le 30 février'), d2 = await envoyer('Courses le 2 à 14h');
    ok('tâche d’un proche : un numéro de téléphone n’est pas une date ; « le 31 » tombe un 31 ; un jour qui n’existe pas n’invente rien ; « le 2 à 14h » reste un 2',
      tel.ap.values[0][2] === '' && !/, pour /.test(tel.texte) && /^31\/\d\d\/\d{4}$/.test(d31.ap.values[0][2]) && d31n.ap.values[0][2] === '' && d30f.ap.values[0][2] === '' && /^02\/\d\d\/\d{4}$/.test(d2.ap.values[0][2]),
      JSON.stringify([tel, d31, d31n, d30f, d2].map((x) => [x.ap.values[0][2], x.texte])));
    /* une écriture lente : la relance (toutes les 200 ms au banc) ne l'écrit pas une seconde fois */
    let off = hook({method: 'POST', re: /Tâches!A1:append$/, delay: 1500});
    const lent = await envoyer('Arroser les plantes'); off(); await sleep(700);
    ok('tâche d’un proche : Pilotage lent, une seule ligne écrite (la relance attend la fin de l’écriture en cours)', lent.status === 200 && appendsDe('Arroser les plantes').length === 1, appendsDe('Arroser les plantes').length + ' lignes');
    /* Google en panne à l'arrivée, puis « C'est fait » dans JARVIS : à son retour, la ligne arrive « Fait », pas « À faire » */
    off = hook({method: 'POST', re: /Tâches!A1:append$/, fail: 500});
    await envoyer('Appeler la crèche'); const rc = await SA.G('/api/invites/recues'), tc = (rc.body.recues || []).find((x) => x.texte === 'Appeler la crèche');
    const fa = tc ? await SA.G('/api/invites/recues/' + tc.id, {action: 'fait'}) : null; off();
    const ap = await until(() => appendsDe('Appeler la crèche')[0], 4000);
    ok('tâche d’un proche : écrite après une panne avec son statut du moment (« Fait » touché entre-temps)', !!tc && fa && fa.status === 200 && ap && ap.values[0][3] === 'Fait' && appendsDe('Appeler la crèche').length === 1, JSON.stringify([tc && tc.id, ap && ap.values])); }

  /* relances (srv-a#6, srv-b#2) : un seul passage à la fois, une relance annulée pendant le passage reste annulée */
  { FG.sheet['Canal!A1:H1'] = [H_CANAL]; FG.sheet['Canal!A2:H2'] = [['20/11/2026', 'Rabie', 'Kairos', 'Ordre', 'Relève le prix', 'À faire', '', '']];
    const quand = new Date(Date.now() + 700).toISOString();
    const r1 = await SA.G('/api/relance', {quand, quoi: 'Voir si Kairos a répondu (banc A1)', ligne: 2}), r2 = await SA.G('/api/relance', {quand, quoi: 'Rappel simple annulé pendant le passage'});
    const off = hook({method: 'GET', re: /Canal!A2:H2$/, delay: 1500}); await sleep(900);
    const n0 = PX.log.filter((x) => /Canal!A2:H2$/.test(x.path)).length;
    const p1 = SA.G('/api/relances/verifier', {}); await sleep(300);
    const an = await SA.G('/api/relance/annuler', {id: r2.body.relance.id}); const p2 = SA.G('/api/relances/verifier', {});
    const [v1, v2] = await Promise.all([p1, p2]); off();
    const lus = PX.log.filter((x) => /Canal!A2:H2$/.test(x.path)).length - n0, li = await SA.G('/api/relances');
    ok('relances : deux vérifications à la fois traitent la relance une seule fois (une lecture du Canal, une notification)', lus === 1 && v1.body.faites === 1 && v2.body.faites === 1 && li.body.faites.filter((x) => x.id === r1.body.relance.id).length === 1, JSON.stringify([lus, v1.body, v2.body]));
    ok('relances : annulée dans Suivi pendant le passage, elle reste annulée (pas de rappel)', an.status === 200 && !li.body.faites.some((x) => x.id === r2.body.relance.id) && !li.body.prevues.some((x) => x.id === r2.body.relance.id), JSON.stringify(li.body.faites.map((x) => x.quoi))); }

  /* sonnette (srv-a#9) : une adresse en fin de phrase, suivie d'un point ; accords (srv-b#8) : « Ulysse prévenu » */
  { FG.sheet['Faits!A1:E300'] = [['Domaine', 'Fait', 'Valeur'], ['Grok Bot', 'Sonnette Ulysse', 'Routine Sonnette Ulysse : exemple+ulysse@mail.grokbot.com.'], ['Grok Bot', 'Sonnette Jarvis', 'exemple+iris@mail.grokbot.com']];
    const e0 = envois().length, n0 = GOT.length, d = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
    const v = await SA.G('/api/verifier', {ou: 'papiers', demande: {titre: 'Quittance de mai', bot: 'Ulysse', demande: 'Retrouve la quittance de loyer', depuis: d}});
    const mv = await until(async () => { const x = await mission(SA, v.body.id); return x && ['terminee', 'echouee'].includes(x.status) ? x : null; }, 15000);
    const bell = envois().slice(e0), raw = mailTxt(bell[bell.length - 1]);
    ok('sonnette : l’adresse suivie d’un point dans la phrase de Faits est reconnue (celle d’Ulysse, pas celle d’Iris)', bell.length === 1 && /To: exemple\+ulysse@mail\.grokbot\.com/i.test(raw), raw.slice(0, 200));
    const tt = await until(() => titres(n0).find((x) => /^Trouvé · /.test(x)), 4000);
    ok('accords : « Ulysse prévenu » (masculin) dans le compte rendu et la notification', mv && mv.status === 'terminee' && /Ulysse prévenu dans le Canal/.test(mv.result) && !/Ulysse prévenue/.test(mv.result) && tt === 'Trouvé · Ulysse prévenu', JSON.stringify([mv && mv.result, tt])); }

  /* tâche Claude (srv-b#4) : « Vérifié par Claude » seulement sur une ligne de Déploiement restée la même, pour une demande traitée dans ce passage */
  { const DEP = [['Point', 'Bot', 'Vérifié par Claude'], ['Veille du matin', 'Iris', ''], ['Prix du matin', 'Kairos', '']];
    FG.sheet['Canal!A1:H3000'] = [H_CANAL, ['16/11/2026', 'Rabie', 'Claude', 'Question', 'Vérifie la colonne Nature', 'À faire', '', '']];
    FG.sheet["'Déploiement'!A1:Z300"] = DEP; FG.sheet["'Textes des routines'!A1:Z300"] = [['Routine', 'Texte'], ['Veille du matin', 'Chaque matin…']];
    const lancer = async () => { const t0 = Date.now(), c0 = FG.calls.length; await SA.G('/api/tool', {server: 'Claude Code Remote', tool: 'fire_trigger', input: {trigger_id: 'trig_x'}});
      const st = await until(async () => { const s = (await SA.G('/api/status')).body; return s.tache && !s.tache.running && s.tache.last && s.tache.last.at >= t0 ? s.tache.last : null; }, 10000);
      return {last: st, puts: FG.calls.slice(c0).filter((x) => x.method === 'PUT').map((x) => x.path.split('/values/')[1])}; };
    const a = await lancer();
    ok('tâche Claude : Déploiement inchangé, « Vérifié par Claude » écrit sur la ligne vue', a.puts.includes("'Déploiement'!C2") && a.puts.includes('Canal!G2'), JSON.stringify(a));
    let off = hook({method: 'GET', re: /'Déploiement'!A1:Z300$/, transform: (j, k) => (k === 2 ? {...j, values: [DEP[0], ['Nouvelle routine', 'Argus', ''], ...DEP.slice(1)]} : j)});
    const b = await lancer(); off();
    ok('tâche Claude : une ligne insérée dans Déploiement pendant que Claude travaille, rien n’est marqué à tort (et c’est dit)', !b.puts.some((x) => /Déploiement/.test(x)) && b.puts.includes('Canal!G2') && /Déploiement : ligne 2 changée entre-temps/.test(b.last && b.last.note), JSON.stringify(b));
    off = hook({method: 'GET', re: /^\/sheets\/v4\/spreadsheets\/[^/]+\/values\/Canal!A1:H3000$/, transform: (j, k) => (k === 2 ? {...j, values: j.values.map((r, i) => (i === 1 ? [...r.slice(0, 5), 'Fait', 'Traité par Argus', ''] : r))} : j)});
    const c = await lancer(); off();
    ok('tâche Claude : la ligne « Vérifie » a été close entre-temps, Déploiement n’est pas touché', !c.puts.some((x) => /Déploiement|Canal/.test(x)) && /Lignes modifiées entre-temps/.test(c.last && c.last.note), JSON.stringify(c)); }

  /* agenda instantané (srv-b#7) : un rendez-vous en cours reste dans « aujourd'hui » */
  { const iso = (ms) => new Date(ms).toISOString(), t = Date.now(), ev = FG.events.primary;
    ev.push({id: 'a1-cours', summary: 'Réunion en cours A1', status: 'confirmed', start: {dateTime: iso(t - 30 * 60000)}, end: {dateTime: iso(t + 30 * 60000)}}, {id: 'a1-finie', summary: 'Réunion finie A1', status: 'confirmed', start: {dateTime: iso(t - 3 * 3600e3)}, end: {dateTime: iso(t - 2 * 3600e3)}});
    const r = await SA.call('/api/raccourci', {method: 'POST', headers: A, body: JSON.stringify({action: 'agenda'})});
    FG.events.primary = ev.filter((e) => !/^a1-/.test(e.id));
    ok('agenda : un rendez-vous commencé mais pas fini reste (« en cours »), un rendez-vous fini disparaît', r.status === 200 && /en cours[^;]*Réunion en cours A1/.test(r.body) && !/Réunion finie A1/.test(r.body), r.body); }

  /* tour de Claude (srv-b#2) : deux demandes pendant qu'il attend Claude, un seul appel et une seule notification */
  { SA.drapeau('lent-tour'); const u0 = (await SA.G('/api/status')).body.usage.tours || 0, p0 = SA.prompts().filter((x) => /Tour de JARVIS/.test(x.input)).length, n0 = GOT.length;
    const [t1, t2] = await Promise.all([SA.G('/api/tour/maintenant', {}), (async () => { await sleep(150); return SA.G('/api/tour/maintenant', {}); })()]);
    await sleep(400); const u1 = (await SA.G('/api/status')).body.usage.tours || 0, p1 = SA.prompts().filter((x) => /Tour de JARVIS/.test(x.input)).length, nt = titres(n0).filter((x) => x === 'Syndic à confirmer').length;
    SA.drapeau('lent-tour', false);
    ok('tour : « Maintenant » pendant un tour en cours reçoit le même tour (un appel à Claude, une notification)', t1.status === 200 && t2.status === 200 && t1.body.at === t2.body.at && u1 - u0 === 1 && p1 - p0 === 1 && nt <= 1, JSON.stringify([u0, u1, p0, p1, nt, t1.body, t2.body])); }

  /* garde-fou (srv-a#10) : écrit une fois, d'un coup ; réécrit s'il a disparu */
  { const f = path.join(SA.data, 'guard-chat.json'); await SA.G('/api/test-data', {}); const m1 = fs.statSync(f).mtimeMs; await sleep(40);
    await SA.G('/api/test-data', {}); const m2 = fs.statSync(f).mtimeMs, j = JSON.parse(fs.readFileSync(f, 'utf8'));
    fs.rmSync(f); await SA.G('/api/test-data', {}); const back = fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).hooks.PreToolUse.length === 1;
    ok('garde-fou : pas réécrit à chaque lancement de Claude (même contenu), jamais de fichier temporaire laissé, recréé s’il disparaît', m1 === m2 && j.hooks.PreToolUse[0].hooks[0].command.endsWith(' chat') && back && !fs.existsSync(f + '.tmp'), JSON.stringify([m1, m2, back])); }

  /* MCP (srv-b#9, srv-b#8) : pas de chiffre de crédit aux assistants reliés ; « Mission proposée par… » */
  { const PK = (v) => crypto.createHash('sha256').update(v).digest('base64url'), raw = (u, o = {}) => fetch(SA.base + u, {redirect: 'manual', ...o});
    const rpc = (tok, m, params, id = 1) => raw('/mcp', {method: 'POST', headers: {'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: 'Bearer ' + tok, 'mcp-protocol-version': '2025-06-18'}, body: JSON.stringify({jsonrpc: '2.0', id, method: m, params})}).then(async (x) => ({status: x.status, body: await x.json().catch(() => null)}));
    const ins = await raw('/oauth/register', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], client_name: 'Claude', token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token']})}).then((x) => x.json());
    const ver = crypto.randomBytes(32).toString('base64url'), cid = ins.client_id, RU = 'https://claude.ai/api/mcp/auth_callback';
    const html = await raw('/oauth/authorize?' + new URLSearchParams({response_type: 'code', client_id: cid, redirect_uri: RU, state: 'e1', code_challenge: PK(ver), code_challenge_method: 'S256', scope: 'jarvis', resource: SA.base + '/mcp'})).then((x) => x.text());
    const aid = (/var id="([\w-]+)"/.exec(html) || [])[1]; await SA.G('/api/mcp/decider', {id: aid, oui: true});
    const att = await raw('/oauth/attente/' + aid).then((x) => x.json()), code = new URL(att.redirect || 'https://x/').searchParams.get('code');
    const tk = await raw('/oauth/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'authorization_code', code, code_verifier: ver, client_id: cid, redirect_uri: RU, resource: SA.base + '/mcp'}).toString()}).then((x) => x.json());
    const AT = tk.access_token; await rpc(AT, 'initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'banc', version: '1'}});
    const lm = await rpc(AT, 'tools/call', {name: 'jarvis_missions', arguments: {}}, 2), tx = String(((lm.body || {}).result || {content: [{}]}).content[0].text || '');
    ok('MCP : jarvis_missions ne donne ni taux ni mensualité d’un crédit (« non partagé »), le reste est lu', !!AT && !/3,1|950/.test(tx) && /non partagé : chiffres personnels/.test(tx) && /Résumer la veille de la semaine → Trois articles lus/.test(tx), tx.slice(0, 500));
    const mt = await rpc(AT, 'tools/call', {name: 'jarvis_maintenant', arguments: {}}, 3), tm = String(((mt.body || {}).result || {content: [{}]}).content[0].text || '');
    ok('MCP : jarvis_maintenant ne donne pas le texte d’une mission qui cite un taux', /Missions et propositions : « \(non partagé : chiffres personnels\) » \(à approuver\)/.test(tm) && !/3,1 %/.test(tm), tm.slice(-300));
    const n0 = GOT.length; await rpc(AT, 'tools/call', {name: 'jarvis_proposer_mission', arguments: {texte: 'Compare trois forfaits mobiles'}}, 4); await rpc(AT, 'tools/call', {name: 'jarvis_proposer_ordre', arguments: {bot: 'kairos', message: 'Surveille le prix du robot'}}, 5);
    const tt = await until(() => { const x = titres(n0).filter((y) => / par Claude$/.test(y)); return x.length >= 2 ? x : null; }, 4000);
    ok('accords : « Mission proposée par Claude », « Ordre à Kairos proposé par Claude »', tt && tt.includes('Mission proposée par Claude') && tt.includes('Ordre à Kairos proposé par Claude'), JSON.stringify(tt)); }
  ok('serveur A : toujours debout', await SA.vivant());
  await SA.stop();

  /* ================= 3. serveur B : état d'avant (rangement coupé, vieux dossiers de travail), Claude qui écrit « Athéna » ================= */
  { const t = Date.now(), J = 864e5, vieux = t - 40 * J;
    const ids = {orphelin: idDe(vieux, 'a1a1a1'), vieille: idDe(vieux, 'b2b2b2'), recente: idDe(t - J, 'c3c3c3'), attend: idDe(vieux, 'd4d4d4'), orphelinNeuf: idDe(t, 'e5e5e5')};
    const data = fs.mkdtempSync(path.join(TMP, 'data-')), W = path.join(data, 'work');
    for (const n of [...Object.values(ids), 'photos-0a1b2c3d4e5f']) { fs.mkdirSync(path.join(W, n, '.claude'), {recursive: true}); fs.writeFileSync(path.join(W, n, 'note.md'), 'x'); }
    for (const n of [ids.orphelin, 'photos-0a1b2c3d4e5f']) fs.utimesSync(path.join(W, n), new Date(vieux), new Date(vieux));
    const SB = await demarrer({data, flags: ['athena'], env: {JARVIS_TRAVAIL_DELAI_MS: '400'}, etat: {memRange: {dernier: 0, dernierJour: '', enCours: true, n: 0},
      missions: [{id: ids.vieille, agent: 'claude', text: 'Vieille mission', status: 'terminee', at: vieux, done: vieux + 60000, result: 'ok'}, {id: ids.recente, agent: 'claude', text: 'Mission d’hier', status: 'terminee', at: t - J, done: t - J + 60000, result: 'ok'},
        {id: ids.attend, agent: 'claude', text: 'Mission qui attend son accord', status: 'a_approuver', at: vieux}]}});
    const rg = await SB.G('/api/memoire/ranger', {});
    ok('mémoire : un rangement coupé par un redémarrage (« en cours » sur disque) ne bloque plus le suivant', rg.status === 200 && rg.body.ok === true && rg.body.rangement && rg.body.rangement.enCours === false, JSON.stringify([rg.status, rg.body.error, rg.body.rangement]));
    await sleep(1200); const reste = (n) => fs.existsSync(path.join(W, n));
    ok('dossiers de travail : effacés 30 jours après la fin (ou oubliés depuis 30 jours) ; gardés : mission récente, mission qui attend, photos, dossier récent', !reste(ids.orphelin) && !reste(ids.vieille) && reste(ids.recente) && reste(ids.attend) && reste(ids.orphelinNeuf) && reste('photos-0a1b2c3d4e5f') && fs.existsSync(W), JSON.stringify(Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, reste(v)]))));
    const ev = await sse(SB, 'Prépare la veille'), dn = (ev.find((e) => e.ev === 'done') || {d: {}}).d;
    ok('missions : « Athéna » et « KAIROS » écrits par Claude valent athena et kairos (plus jetées en silence)', (dn.missions || []).map((x) => x.agent).join() === 'athena,kairos' && !/MISSIONS/.test(dn.reply || ''), JSON.stringify(dn));
    await SB.stop(); }

  /* ================= 4. serveur C : ordres aux bots (connecteurs pas prêts, date de Paris, sonnette gardée ou envoyée par le serveur) ================= */
  { const h = +paris(new Date()).hm.slice(0, 2), TZ = h >= 12 ? 'Pacific/Kiritimati' : 'Pacific/Pago_Pago';   /* un fuseau où la date du jour n'est pas celle de Paris */
    const local = new Date().toLocaleDateString('fr-FR', {timeZone: TZ}), pd = () => { const p = paris(new Date()); return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y; };
    let SC = await demarrer({etat: {}, flags: ['sans-sheets'], env: {TZ}});
    await relierGoogle(SC);
    FG.sheet['Faits!A1:E300'] = [['Domaine', 'Fait', 'Valeur'], ['Grok Bot', 'Sonnette Kairos', 'exemple+kairos@mail.grokbot.com'], ['Grok Bot', 'Sonnette Jarvis', 'exemple+iris@mail.grokbot.com']];
    const ordre = async () => { const ev = await sse(SC, 'Demande à Kairos de vérifier le prix'); return ((ev.find((e) => e.ev === 'done') || {d: {}}).d.missions || [])[0]; };
    const approuver = async (id) => { await SC.G('/api/missions/' + id, {status: 'approuvee'}); return until(async () => { const x = await mission(SC, id); return x && !['approuvee', 'envoyee'].includes(x.status) ? x : null; }, 10000); };
    const k1 = await ordre(), m1 = k1 && await approuver(k1.id);
    ok('ordre à un bot : connecteur Sheets de Claude pas prêt, l’ordre redevient « à approuver » (avec la raison), il ne reste pas « approuvée »', m1 && m1.status === 'a_approuver' && /Pas parti : le connecteur Google Sheets/.test(m1.result) && !m1.approved, JSON.stringify(m1));
    SC.drapeau('sans-sheets', false); const p0 = SC.prompts().length; const m1b = await approuver(k1.id);
    const bp = SC.prompts().slice(p0).find((x) => /^Ordre du propriétaire, approuvé dans JARVIS OS, pour le bot Kairos/.test(x.input)), dt = bp && (/\["(\d\d\/\d\d\/\d{4})", "Rabie", "Kairos"/.exec(bp.input) || [])[1];
    ok('ordre à un bot : réapprouvé une fois le connecteur prêt, il part (la liste des connecteurs est relue)', m1b && m1b.status === 'terminee' && /Ligne écrite dans le Canal pour Kairos/.test(m1b.result), JSON.stringify(m1b));
    ok('ordre à un bot : la ligne du Canal porte la date de Paris, même quand le serveur est dans un autre fuseau', !!dt && dt === pd() && dt !== local, JSON.stringify([dt, pd(), local, TZ]));
    /* pendant une pause de Grok : la sonnette est gardée, puis part à la reprise */
    await SC.G('/api/config', {grokPauseUntil: new Date(Date.now() + 864e5).toISOString()});
    const k2 = await ordre(), m2 = k2 && await approuver(k2.id), garde = SC.etat().sonnettesGardees || [];
    await SC.G('/api/config', {grokPauseUntil: ''}); const e0 = envois().length, rv = await SC.G('/api/relances/verifier', {}), b2 = envois().slice(e0);
    ok('ordre à un bot pendant une pause de Grok : ligne écrite, sonnette gardée, puis envoyée à la reprise (une seule)', m2 && m2.status === 'terminee' && /Sonnette gardée pour la reprise de Grok/.test(m2.result) && garde.includes('Kairos') && rv.body.sonnettes && rv.body.sonnettes.sonnees === 1 && b2.length === 1 && /To: exemple\+kairos@mail\.grokbot\.com/i.test(mailTxt(b2[0])), JSON.stringify([m2 && m2.result, garde, rv.body, b2.length]));
    /* sans Gmail chez Claude : la sonnette part par l'accès Google du serveur */
    await SC.stop(); SC = await demarrer({data: SC.data, flags: ['sans-gmail'], env: {TZ}});
    /* la mission passe « terminée » dès la réponse de Claude ; la sonnette du serveur suit (lecture de Faits, envoi) : on l'attend */
    const e1 = envois().length, k3 = await ordre(), m3a = k3 && await approuver(k3.id);
    const m3 = m3a && ((await until(async () => { const x = await mission(SC, k3.id); return x && /Sonnette/.test(x.result || '') ? x : null; }, 5000)) || m3a), b3 = envois().slice(e1);
    ok('ordre à un bot sans Gmail chez Claude : la sonnette part quand même, par l’accès Google du serveur', m3 && m3.status === 'terminee' && /Sonnette : sonnette envoyée/.test(m3.result) && b3.length === 1 && /To: exemple\+kairos@mail\.grokbot\.com/i.test(mailTxt(b3[0])), JSON.stringify([m3 && m3.result, b3.length]));
    await SC.stop(); }

  /* ================= 5. serveur D : Claude s'arrête sans lire sa demande (EPIPE) ; mission qui lève une erreur (srv-a#7) ================= */
  { const SD = await demarrer({etat: {}, env: {CLAUDE_BIN: SH_BIN}});
    const td = await SD.G('/api/test-data', {}); const v1 = await SD.vivant();
    const ev = await sse(SD, 'Bonjour'); const v2 = await SD.vivant();
    const dg = await SD.G('/api/diag'); const v3 = await SD.vivant();
    ok('Claude arrêté avant de lire sa demande : une erreur claire, le serveur reste debout (missions, discussion, diagnostic)', td.status === 200 && td.body.ok === false && v1 && ev.some((e) => e.ev === 'error') && v2 && dg.status === 200 && v3, JSON.stringify([td.body, ev.map((e) => e.ev), dg.status, SD.err.slice(-300)]));
    await SD.G('/api/import', {missions: [{id: 'a1mkdir01', agent: 'claude', text: 'Mission sans dossier de travail', status: 'a_approuver', at: Date.now()}]});
    fs.writeFileSync(path.join(SD.data, 'work', 'a1mkdir01'), 'un fichier à la place du dossier');
    await SD.G('/api/missions/a1mkdir01', {status: 'approuvee'});
    const mk = await until(async () => { const x = await mission(SD, 'a1mkdir01'); return x && x.status === 'echouee' ? x : null; }, 5000); const v4 = await SD.vivant();
    ok('mission qui lève une erreur (dossier de travail impossible) : « en échec » avec la raison, le serveur reste debout', mk && /erreur du serveur/.test(mk.result) && v4, JSON.stringify([mk, SD.exit, SD.err.slice(-300)]));
    await SD.stop(); }
} catch (e) { ok('le banc a planté', false, e && e.stack); }
finally {
  if (process.env.A1_SUIVI) process.stderr.write('fin : arrêt des serveurs\n');
  for (const S of SERVEURS) { try { await S.stop(); } catch { /* rien */ } }
  if (process.env.A1_SUIVI) process.stderr.write('fin : serveurs arrêtés\n');
  FG.close(); PXS.close(); PS.close();
  try { fs.rmSync(TMP, {recursive: true, force: true}); } catch { /* rien */ }
}
console.log(results.join('\n'));
console.log(fails ? '\n' + fails + ' échec(s) sur ' + results.length + ' vérifications.' : '\nTout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
