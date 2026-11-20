/* Banc du serveur : node tests/server.test.mjs (aucun vrai Claude, aucun coût). */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), HOME0 = os.homedir();
import {startFakeGoogle} from './fake-google.mjs';
import http from 'node:http'; import crypto from 'node:crypto';
import {paris, pauseDepuisFaits, paliers} from '../notify.mjs';
const FG = await startFakeGoogle();
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-'));
/* 0.22.0 : faux Open-Meteo (prévisions de 8 jours à partir d'aujourd'hui, heure de Paris) */
const METEO_REQ = [];
const MET = http.createServer((q, r) => { METEO_REQ.push(q.url); const t = paris(new Date()), days = [...Array(8)].map((_, i) => new Date(Date.UTC(t.y, t.m - 1, t.d + i)).toISOString().slice(0, 10)), hours = [];
  days.forEach((d) => { for (let hh = 0; hh < 24; hh++) hours.push(d + 'T' + String(hh).padStart(2, '0') + ':00'); });
  r.writeHead(200, {'content-type': 'application/json'}); r.end(JSON.stringify({current: {temperature_2m: 9.4, apparent_temperature: 6.2, weather_code: 3}, daily: {time: days, weather_code: [3, 61, 0, 0, 0, 0, 0, 0], temperature_2m_min: [4, 2, 1, 1, 1, 1, 1, 1], temperature_2m_max: [11, 7, 12, 12, 12, 12, 12, 12], precipitation_probability_max: [10, 70, 0, 0, 0, 0, 0, 0]},
    hourly: {time: hours, temperature_2m: hours.map((x) => (+x.slice(11, 13) >= 18 ? 6 : 9)), precipitation_probability: hours.map(() => 0), weather_code: hours.map(() => 2)}})); });
await new Promise((z) => MET.listen(0, '127.0.0.1', z));
/* 0.23.2 : faux vendeurs (bannière promo en og:image, vraie photo dans la fiche JSON-LD), fausse boutique Shopify, faux Steam */
const png = (w, h, mark) => { const hd = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(hd, 0); hd.writeUInt32BE(13, 8); hd.write('IHDR', 12); hd.writeUInt32BE(w, 16); hd.writeUInt32BE(h, 20); return Buffer.concat([hd, Buffer.from(mark.repeat(400))]); };
const IMGS = {'/promo-a.png': png(1200, 1200, 'PROMO'), '/bon-a.png': png(800, 800, 'BON-A'), '/bon-b.png': png(900, 900, 'BON-B'), '/petit.png': png(120, 120, 'BON-petit'), '/bon-steam.png': png(920, 430, 'BON-STEAM')};
const VEND = http.createServer((q, rr) => { const VBx = 'http://127.0.0.1:' + VEND.address().port, u = q.url.split('?')[0];
  if (IMGS[u]) { rr.writeHead(200, {'content-type': 'image/png'}); rr.end(IMGS[u]); return; }
  const html = (b) => { rr.writeHead(200, {'content-type': 'text/html'}); rr.end('<html><head>' + b + '</head></html>'); };
  if (u === '/produit-a') return html('<meta property="og:image" content="/promo-a.png"><script type="application/ld+json">{"@type":"Product","image":["' + VBx + '/bon-a.png","' + VBx + '/petit.png"]}</script>');
  if (u === '/idee-a') return html('<script type="application/ld+json">{"@type":"Product","image":"' + VBx + '/bon-a.png","offers":{"@type":"Offer","price":"52.90","priceCurrency":"EUR"}}</script>');
  if (u === '/produit-b') return html('<script type="application/ld+json">{"@type":"Product","image":["http:\\/\\/127.0.0.1:' + VEND.address().port + '\\/bon-b.png"]}</script>');
  if (u === '/api/storesearch/') { rr.writeHead(200, {'content-type': 'application/json'}); rr.end(JSON.stringify({items: [{id: 42, name: 'Phantom Blade Zero'}]})); return; }
  if (u === '/api/appdetails') { rr.writeHead(200, {'content-type': 'application/json'}); rr.end(JSON.stringify({42: {data: {header_image: VBx + '/bon-steam.png'}}})); return; }
  html('rien'); });
await new Promise((z) => VEND.listen(0, '127.0.0.1', z)); const VB = 'http://127.0.0.1:' + VEND.address().port;
const PORT = 18000 + Math.floor(Math.random() * 1000), BASE = 'http://127.0.0.1:' + PORT;
const env = {...process.env, JARVIS_PUSH_ALLOW_HTTP: '1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_PAUSE_CACHE_MS: '0', JARVIS_PAPIERS_ID: 'pap', JARVIS_BELL_DEDUP_MS: '0', JARVIS_GOOGLE_FAKE: FG.url, PORT: String(PORT), JARVIS_DATA: DATA, CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), ANTHROPIC_API_KEY: 'sk-ant-faux-pour-le-test', ANTHROPIC_BASE_URL: 'https://exemple.invalid', JARVIS_ORIGINS: 'https://rabiederouiche.github.io', JARVIS_REPO: os.tmpdir(), JARVIS_OS_DIR: path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette'), JARVIS_TTS_HELPER: path.join(HERE, 'fake-tts.mjs'), JARVIS_VOICE_MODEL: path.join(HERE, 'fake-tts.mjs'), JARVIS_VOICE_SCRIPT: path.join(DATA, 'fausse-install.sh')};
Object.assign(env, {JARVIS_STEAM_URL: VB, JARVIS_STT_HELPER: path.join(HERE, 'fake-stt.mjs'), JARVIS_METEO_URL: 'http://127.0.0.1:' + MET.address().port + '/v1/forecast', JARVIS_ECOUTE_SCRIPT: path.join(DATA, 'fausse-install.sh')});
const results = []; let fails = 0;
{ const H = ['Domaine', 'Fait', 'Valeur'], v = (x) => pauseDepuisFaits([H, ['Grok Bot', "Grok en pause jusqu'au", x]]);
  const okP = v('17/11/2026 13h05') === Date.parse('2026-11-17T13:05:00+01:00') && v('14/07/2027 12h47') === Date.parse('2027-07-14T12:47:00+02:00') && v('Reprise faite, sonnettes envoyées') === null && pauseDepuisFaits([H, ['x', 'Autre', 'y']]) === undefined;
  results.push((okP ? 'OK    ' : 'ÉCHEC ') + 'pause de Grok : date de Faits lue à l\'heure de Paris (hiver comme été), « reprise » = plus de pause'); if (!okP) fails++; }
{ const a = paliers("3 mois, 1 mois, 1 semaine avant, vendredi d'avant", '15/02/2027').join(), b = paliers('6 mois, 60, 30 et 7 jours avant', '30/06/2027').join(), c = paliers('Le jour même', '01/12/2026').join(), d = paliers('3 mois avant, pour le budget', '02/09/2027').join(), e = paliers("vendredi d'avant", '23/10/2027').join();
  const okR = a === '2026-11-15,2027-01-15,2027-02-08,2027-02-12' && b === '2026-12-30,2027-05-01,2027-05-31,2027-06-23' && c === '2026-12-01' && d === '2027-06-02' && e === '2027-10-22';
  results.push((okR ? 'OK    ' : 'ÉCHEC ') + 'rappels à paliers : mois, semaines, jours, le jour même, vendredi d\'avant (lundi 15/02 → vendredi 12/02 ; samedi 23/10 → vendredi 22/10)' + (okR ? '' : ' :: ' + [a, b, c, d, e].join(' / '))); if (!okR) fails++; }
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const code = execFileSync(process.execPath, [path.join(HERE, '..', 'server.mjs'), 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
let srv;
const startSrv = async () => { srv = spawn(process.execPath, [path.join(HERE, '..', 'server.mjs')], {env, stdio: ['ignore', 'pipe', 'pipe']}); srv.stderr.on('data', (d) => process.stderr.write(d)); await new Promise((r) => srv.stdout.once('data', r)); };
/* arrêt brutal puis relance (mise à jour, panne) : l'état sur disque doit suffire */
const restartSrv = async () => { const old = srv; await new Promise((z) => { old.once('exit', z); old.kill('SIGKILL'); }); await startSrv(); };
await startSrv();
const call = async (p, o = {}) => { const r = await fetch(BASE + p, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); return {status: r.status, body: await r.json().catch(() => null), headers: r.headers}; };
const sse = async (body, tok) => { const r = await fetch(BASE + '/api/chat', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + tok}, body: JSON.stringify(body)}); const t = await r.text(); const evs = []; for (const b of t.split('\n\n')) { const m = /^event: (\w+)\ndata: (.*)$/s.exec(b.trim()); if (m) evs.push({ev: m[1], d: JSON.parse(m[2])}); } return evs; };
try {
  let r = await call('/api/health'); ok('santé', r.status === 200 && r.body.paired === false, JSON.stringify(r.body));
  r = await call('/api/state'); ok('sans appairage : refusé', r.status === 401);
  r = await call('/api/update', {method: 'POST'}); ok('mise à jour : refusée sans appairage', r.status === 401);
  r = await call('/api/pair', {method: 'POST', body: JSON.stringify({code: 'AAAA-BBBB'})}); ok('mauvais code : refusé', r.status === 401, r.body.error);
  r = await call('/api/pair', {method: 'POST', body: JSON.stringify({code: code.toLowerCase().replace('-', ' '), device: 'iPhone test'})}); const tok = r.body && r.body.token;
  ok('bon code (minuscules, espace) : jeton', r.status === 200 && tok && tok.length > 30);
  r = await call('/api/pair', {method: 'POST', body: JSON.stringify({code})}); ok('code à usage unique', r.status === 401);
  const A = {authorization: 'Bearer ' + tok};
  r = await call('/api/update', {method: 'POST', headers: A}); ok('mise à jour : échec propre hors dépôt git', r.status === 200 && r.body.ok === false && /impossible/.test(r.body.message), r.body.message);
  { const tr = await fetch(BASE + '/api/tts', {method: 'POST', headers: {...A, 'content-type': 'application/json'}, body: JSON.stringify({text: 'Bonjour, je suis JARVIS. Kairos surveille un prix.'})}); const body = await tr.text();
    ok('voix du serveur : audio et noms bien prononcés', tr.status === 200 && tr.headers.get('content-type') === 'audio/wav' && /Djarviss/.test(body) && /Kaïross/.test(body), body.slice(0, 70)); }
  { fs.writeFileSync(path.join(DATA, 'fausse-install.sh'), 'echo installation simulée; exit 0');
    const vi = await call('/api/voice/install', {method: 'POST', headers: A}); let st = vi.body.state;
    for (let i = 0; i < 30 && st === 'running'; i++) { await new Promise((z) => setTimeout(z, 100)); st = (await call('/api/voice/install', {headers: A})).body.state; }
    ok('installation de la voix lancée par le serveur', vi.status === 200 && st === 'done', st); }
  r = await call('/api/status', {headers: A}); ok('état de Claude Code', r.status === 200 && r.body.claude.loggedIn === true, JSON.stringify(r.body.claude));
  { const d = await call('/api/diag', {headers: A}); ok('diagnostic des connecteurs', d.status === 200 && /claude\.ai Gmail/.test(d.body.mcpList) && d.body.rules.length === 3, d.body.mcpList.split('\n')[0]); }
  { const td = await call('/api/test-data', {method: 'POST', headers: A}); ok('essai réel des données : outils utilisés rapportés', td.body.ok && td.body.used.length === 2 && /prochain événement/.test(td.body.answer), td.body.used.join(', ')); }
  ok('connecteurs relevés sans appel au modèle', r.body.connectors.gmail && r.body.connectors.sheets && r.body.connectors.calendar && r.body.connectors.read === 3, JSON.stringify(r.body.connectors).slice(0, 120));
  let evs = await sse({text: 'Bonjour JARVIS', model: 'rapide'}, tok);
  const done = evs.find((e) => e.ev === 'done');
  ok('discussion en flux : morceaux puis réponse', evs.filter((e) => e.ev === 'delta').length > 3 && done && /Tu as dit : Bonjour JARVIS\. Session : nouvelle, modèle : haiku/.test(done.d.reply), done && done.d.reply);
  ok('discussion : web et connecteurs en lecture seule, garde « chat »', done && /outils : WebSearch,WebFetch,mcp__claude_ai_Google_Calendar,mcp__claude_ai_Google_Sheets,mcp__claude_ai_Gmail, garde : chat/.test(done.d.reply) && !/Claude_Docs/.test(done.d.reply), done && done.d.reply);
  evs = await sse({text: 'Et ensuite ?'}, tok); const r2 = evs.find((e) => e.ev === 'done').d.reply; ok('même session reprise, modèle Sonnet par défaut', /Session : reprise, modèle : sonnet/.test(r2));
  evs = await sse({text: 'Encore une'}, tok); const r3 = evs.find((e) => e.ev === 'done'); const pid = (x) => (x.match(/processus : (\d+)/) || [])[1];
  ok('Claude reste ouvert entre deux phrases (même processus, 2e tour)', pid(r3.d.reply) === pid(r2) && /tour : 2/.test(r3.d.reply), r3.d.reply.slice(-40));
  ok('chronométrage de la réponse', r3.d.timing && r3.d.timing.warm === true && r3.d.timing.first >= 0 && r3.d.timing.total >= r3.d.timing.first, JSON.stringify(r3.d.timing));
  { const e2 = await sse({text: 'montre les outils refusés'}, tok); const rf = (e2.find((e) => e.ev === 'done') || {d: {}}).d.reply || '';
    ok('conversation : aucun outil de fichiers (lecture comprise) ni commande système', ['Bash', 'Read', 'Glob', 'Grep', 'Edit', 'Write'].every((t) => rf.split(/[ ,]/).includes(t)), rf); }
  /* 0.16.0 : le garde-fou bloque les outils de fichiers hors des dossiers de travail (secrets du serveur, identifiants de Claude Code, /proc, /etc) */
  { const HOMEX = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-home-')), DX = path.join(HOMEX, '.jarvis'), WK = path.join(DX, 'work', 'm1');
    fs.mkdirSync(WK, {recursive: true}); fs.mkdirSync(path.join(HOMEX, '.claude'), {recursive: true}); fs.writeFileSync(path.join(DX, 'state.json'), '{}'); fs.symlinkSync(path.join(DX, 'state.json'), path.join(WK, 'lien.json'));
    const gd = (mode, tool_name, tool_input) => new Promise((z) => { const c = spawn(process.execPath, [path.join(HERE, '..', 'hooks', 'guard.mjs'), mode], {env: {...process.env, HOME: HOMEX, JARVIS_DATA: DX}}); c.on('close', (code) => z(code)); c.stdin.end(JSON.stringify({tool_name, tool_input, cwd: WK})); });
    const cas = [['Read', {file_path: path.join(DX, 'state.json')}, 2], ['Read', {file_path: path.join(HOMEX, '.claude', '.credentials.json')}, 2], ['Read', {file_path: '~/.ssh/id_ed25519'}, 2],
      ['Glob', {pattern: '../../*.json'}, 2], ['Glob', {pattern: '**/*.md'}, 0], ['Grep', {pattern: 'refresh', path: DX}, 2], ['Grep', {pattern: 'state.json'}, 0], ['Read', {file_path: '/proc/self/environ'}, 2],
      ['Read', {file_path: path.join(WK, 'lien.json')}, 2], ['Read', {file_path: path.join(WK, 'notes.md')}, 0], ['Write', {file_path: path.join(WK, 'rapport.md'), content: 'x'}, 0], ['Write', {file_path: path.join(DX, 'state.json'), content: '{}'}, 2],
      ['Edit', {file_path: path.join(HOMEX, 'x.txt')}, 2], ['Read', {file_path: '/tmp/page.html'}, 0]];
    const got = []; for (const [t, i, want] of cas) { const code = await gd('mission', t, i); if (code !== want) got.push(t + ' ' + JSON.stringify(i) + ' → ' + code); }
    ok('garde-fou : fichiers secrets, dossier personnel, /proc bloqués (lien symbolique compris) ; dossier de travail ouvert', !got.length, got.join(' | '));
    fs.rmSync(HOMEX, {recursive: true, force: true}); }
  evs = await sse({text: 'Nouvelle conversation', newSession: true}, tok); ok('nouvelle session sur demande', /Session : nouvelle/.test(evs.find((e) => e.ev === 'done').d.reply));
  evs = await sse({text: 'Demande à Kairos de vérifier le prix'}, tok);
  const d2 = evs.find((e) => e.ev === 'done').d, deltas = evs.filter((e) => e.ev === 'delta').map((e) => e.d.text);
  ok('mission proposée par Claude', d2.missions.length === 1 && d2.missions[0].agent === 'kairos' && d2.missions[0].status === 'a_approuver', JSON.stringify(d2.missions[0]));
  ok('ligne MISSIONS jamais lue ni affichée', !/MISSIONS/.test(d2.reply) && deltas.every((t) => !/MIS/.test(t)), d2.reply);
  evs = await sse({text: 'La clé est-elle là ?'}, tok); ok('clé d\'API payante retirée, outils donnés directement', /clé payante : absente, base : absente, recherche d'outils : false/.test(evs.find((e) => e.ev === 'done').d.reply));
  evs = await sse({text: 'provoque une erreur'}, tok); const er = evs.find((e) => e.ev === 'error');
  ok('Claude non connecté : message clair', er && /claude auth login/.test(er.d.message), er && er.d.message);
  r = await call('/api/state', {headers: A}); ok('mémoire sur le serveur', r.body.msgs.length >= 9 && r.body.missions.length === 1, r.body.msgs.length + ' messages');
  const kid = d2.missions[0].id;
  await call('/api/config', {method: 'POST', headers: A, body: JSON.stringify({grokPauseUntil: new Date(Date.now() + 864e5).toISOString()})});   /* pause de Grok en cours (date fixée par le banc, pas celle du jour) */
  r = await call('/api/missions/' + kid, {method: 'POST', headers: A, body: JSON.stringify({status: 'approuvee'})}); ok('mission pour un bot lancée', ['envoyee', 'approuvee', 'terminee'].includes(r.body.mission.status));
  const waitM = async (id) => { let x; for (let i = 0; i < 40; i++) { await new Promise((z) => setTimeout(z, 100)); x = (await call('/api/state', {headers: A})).body.missions.find((m) => m.id === id); if (x && ['terminee', 'echouee'].includes(x.status)) break; } return x; };
  let km = await waitM(kid);
  ok('bot pendant la pause Grok : ligne Canal sans sonnette', km.status === 'terminee' && /Ligne écrite dans le Canal pour Kairos ; pas de sonnette/.test(km.result) && /Outils : mcp__claude_ai_Google_Sheets\. Garde : bot/.test(km.result), km.result);
  r = await call('/api/config', {method: 'POST', headers: A, body: JSON.stringify({grokPauseUntil: ''})}); ok('fin de pause réglable', r.body.config.grokPauseUntil === '');
  evs = await sse({text: 'Demande à Kairos de vérifier le prix'}, tok); const k2 = evs.find((e) => e.ev === 'done').d.missions[0].id;
  await call('/api/missions/' + k2, {method: 'POST', headers: A, body: JSON.stringify({status: 'approuvee'})}); km = await waitM(k2);
  ok('bot hors pause : ligne Canal et sonnette', /sonnette envoyée/.test(km.result) && /Outils : mcp__claude_ai_Google_Sheets,mcp__claude_ai_Gmail\. Garde : bot/.test(km.result), km.result);
  const cm = {id: 'm-claude', agent: 'claude', text: 'résumer les nouveautés de .NET 10', status: 'a_approuver', at: Date.now()};
  await call('/api/memory', {method: 'DELETE', headers: A});
  await call('/api/import', {method: 'POST', headers: A, body: JSON.stringify({msgs: [{who: 'me', text: 'souvenir importé', at: 1}], missions: [cm]})});
  r = await call('/api/state', {headers: A}); ok('import de l\'historique du téléphone', r.body.msgs[0].text === 'souvenir importé' && r.body.missions[0].id === 'm-claude');
  r = await call('/api/missions/m-claude', {method: 'POST', headers: A, body: JSON.stringify({status: 'approuvee'})}); ok('mission Claude lancée', ['attente', 'envoyee', 'approuvee'].includes(r.body.mission.status), r.body.mission.status);
  let st; for (let i = 0; i < 40; i++) { await new Promise((x) => setTimeout(x, 100)); st = (await call('/api/state', {headers: A})).body.missions[0]; if (st.status === 'terminee') break; }
  ok('mission Claude terminée avec compte rendu', st.status === 'terminee' && /Compte rendu/.test(st.result), st.result);
  r = await call('/api/missions/m-claude', {method: 'DELETE', headers: A}); ok('suppression', r.status === 200);
  { let sn = (await call('/api/snap', {headers: A})).body.modules; const t0 = Date.now();
    while (Date.now() - t0 < 30000 && Object.values(sn).some((m) => !m.at)) { await new Promise((z) => setTimeout(z, 300)); sn = (await call('/api/snap', {headers: A})).body.modules; }
    ok('modules lus en arrière-plan', Object.keys(sn).length === 9 && Object.values(sn).every((m) => m.data && m.data.items), Object.keys(sn).filter((k) => sn[k].data).join(','));
    ok('chaque module lit sa source', sn.mails.data.items[0].module === 'mails' && sn.agenda.data.items[0].module === 'agenda' && sn.achats.data.items[0].module === 'Prix' && sn.atoi.data.items[0].module === 'À toi', [sn.mails, sn.agenda, sn.achats].map((m) => m.data.items[0].module).join(','));
    const before = sn.achats.at; await call('/api/snap/refresh', {method: 'POST', headers: A, body: JSON.stringify({modules: ['achats']})});
    for (let i = 0; i < 60; i++) { await new Promise((z) => setTimeout(z, 200)); sn = (await call('/api/snap', {headers: A})).body.modules; if (sn.achats.at > before) break; }
    ok('actualisation d\'un seul module', sn.achats.at > before && sn.mails.at < sn.achats.at, 'achats relu');
    const ev = await sse({text: 'Quoi de neuf ?'}, tok); ok('la conversation reçoit les données déjà lues', /contexte : oui/.test(ev.find((e) => e.ev === 'done').d.reply)); }
  /* ---------- accès Google direct ---------- */
  { const G = (p, b) => call(p, b ? {method: 'POST', headers: A, body: JSON.stringify(b)} : {headers: A});
    const T = (server, tool, input) => G('/api/tool', {server, tool, input});
    let g = await G('/api/google'); ok('Google : ni réglé ni relié au départ, adresse de retour donnée', g.status === 200 && !g.body.configured && !g.body.linked && /\/api\/google\/callback$/.test(g.body.redirect), g.body.redirect);
    r = await call('/api/google', {}); ok('Google : réglages refusés sans appairage', r.status === 401);
    r = await T('Google Sheets', 'get_values', {spreadsheetId: 'X', range: 'Canal!A1:H3'}); ok('outil avant liaison : refus clair', r.status === 409 && r.body.error.code === 'server_not_connected', JSON.stringify(r.body));
    r = await G('/api/google/config', {clientId: 'pas-un-id', clientSecret: 'x'}); ok('identifiant client invalide refusé', r.status === 400, r.body.error);
    r = await G('/api/google/config', {clientId: FG.client.id, clientSecret: FG.client.secret}); ok('identifiant et secret enregistrés', r.status === 200 && r.body.google.configured && !r.body.google.linked);
    ok('secret jamais renvoyé', !JSON.stringify(r.body).includes(FG.client.secret) && !JSON.stringify((await G('/api/google')).body).includes(FG.client.secret));
    r = await G('/api/google/link', {}); const L = new URL(r.body.url), state = L.searchParams.get('state');
    ok('lien Google : droits demandés, accès durable, état unique', L.origin + L.pathname === FG.url + '/auth' && L.searchParams.get('access_type') === 'offline' && L.searchParams.get('prompt') === 'consent' && /spreadsheets/.test(L.searchParams.get('scope')) && /gmail\.modify/.test(L.searchParams.get('scope')) && state.length === 48, L.searchParams.get('scope'));
    let cb = await fetch(BASE + '/api/google/callback?state=faux&code=CODE-OK'); ok('retour Google : état inconnu refusé', cb.status === 400 && /expiré/.test(await cb.text()));
    cb = await fetch(BASE + '/api/google/callback?state=' + state + '&code=CODE-OK'); const html = await cb.text();
    ok('retour Google : relié, compte affiché', cb.status === 200 && /Google est relié/.test(html) && /proprietaire@example\.org/.test(html), html.replace(/<[^>]+>/g, ' ').slice(0, 120));
    cb = await fetch(BASE + '/api/google/callback?state=' + state + '&code=CODE-OK'); ok('retour Google : état à usage unique', cb.status === 400);
    g = await G('/api/google'); ok('état : relié', g.body.linked && g.body.account === 'proprietaire@example.org');
    r = await T('Google Sheets', 'get_values', {spreadsheetId: 'PIL', range: "'À toi'!A3:D300"}); ok('Sheets get_values : plage avec accents et apostrophes', r.status === 200 && r.body.payload.values[1][0] === 'Relance syndic' && r.body.payload.range === "'À toi'!A3:D300", JSON.stringify(r.body).slice(0, 120));
    r = await T('Google Sheets', 'append_values', {spreadsheetId: 'PIL', range: 'Canal!A1', values: [['16/11/2026', 'Rabie', 'Iris', 'Info', 'Test', 'À faire', '', '']]}); let c = FG.calls.filter((x) => /:append$/.test(x.path)).pop();
    ok('Sheets append_values : ligne ajoutée, saisie comme dans Sheets', r.status === 200 && c.q.valueInputOption === 'USER_ENTERED' && c.q.insertDataOption === 'INSERT_ROWS' && c.body.values[0][4] === 'Test', JSON.stringify(c.q));
    r = await T('Google Sheets', 'update_values', {spreadsheetId: 'PIL', range: 'Échéances!F12', values: [['Fait']]}); c = FG.calls.filter((x) => x.method === 'PUT').pop(); ok('Sheets update_values', r.status === 200 && c.path.endsWith('Échéances!F12') && c.body.values[0][0] === 'Fait');
    r = await T('Google Calendar', 'list_events', {startTime: '2026-11-15T00:00:00', endTime: '2026-07-13T00:00:00', orderBy: 'startTime', pageSize: 250}); c = FG.calls.filter((x) => /\/events$/.test(x.path) && x.method === 'GET').pop();
    ok('Agenda list_events : heures de Paris (hiver +01:00, été +02:00), instances dépliées', r.body.payload.events[0].id === 'ev1' && c.q.timeMin === '2026-11-15T00:00:00+01:00' && c.q.timeMax === '2026-07-13T00:00:00+02:00' && c.q.singleEvents === 'true', c.q.timeMin + ' / ' + c.q.timeMax);
    r = await T('Google Calendar', 'create_event', {calendarId: 'pres@group.calendar.google.com', summary: 'Télétravail', allDay: true, startTime: '2026-11-18T00:00:00', endTime: '2026-11-19T00:00:00', availability: 'AVAILABILITY_FREE', useDefaultReminders: false});
    c = FG.calls.filter((x) => x.method === 'POST' && /\/events$/.test(x.path)).pop(); ok('Agenda create_event journée entière (présence)', r.status === 200 && c.body.start.date === '2026-11-18' && c.body.end.date === '2026-11-19' && c.body.transparency === 'transparent' && /pres@group/.test(c.path), JSON.stringify(c.body).slice(0, 140));
    r = await T('Google Calendar', 'create_event', {summary: 'Notaire', colorId: '11', startTime: '2026-11-22T14:30:00', endTime: '2026-11-22T15:30:00', overrideReminders: [{method: 'popup', minutes: 1440}], recurrenceData: ['RRULE:FREQ=YEARLY'], useDefaultReminders: false});
    c = FG.calls.filter((x) => x.method === 'POST' && /\/events$/.test(x.path)).pop(); ok('Agenda create_event à heure fixe, rouge, rappels, annuel', c.body.start.dateTime === '2026-11-22T14:30:00+01:00' && c.body.colorId === '11' && c.body.reminders.overrides[0].minutes === 1440 && c.body.recurrence[0] === 'RRULE:FREQ=YEARLY');
    r = await T('Google Calendar', 'create_event', {summary: 'X', startTime: '2026-11-22T14:30:00', endTime: '2026-11-22T15:30:00', overrideReminders: [{method: 'popup', minutes: -480}]}); ok('rappel négatif refusé comme le connecteur (la page réessaie sans)', r.status === 502 && r.body.error.code === 'tool_error');
    r = await T('Google Calendar', 'update_event', {eventId: 'ev1', startTime: '2026-11-21T09:00:00', notificationLevel: 'NONE'}); c = FG.calls.filter((x) => x.method === 'PATCH').pop();
    ok('Agenda update_event : durée gardée en déplaçant', r.status === 200 && c.body.start.dateTime === '2026-11-21T09:00:00+01:00' && Date.parse(c.body.end.dateTime) - Date.parse(c.body.start.dateTime) === 3600e3 && c.q.sendUpdates === 'none', JSON.stringify(c.body));
    r = await T('Google Calendar', 'delete_event', {eventId: 'ev1', notificationLevel: 'NONE'}); ok('Agenda delete_event', r.status === 200);
    /* Drive : arborescence de Papiers (JARVIS OS, 16/11/2026), lecture seule */
    r = await T('Google Drive', 'folder_tree', {roots: [{id: 'pap', key: 'papiers'}, {name: 'Papiers privés', parent: 'root', key: 'prive'}, {name: 'Absent', parent: 'root', key: 'x'}]}); const tr = r.body.payload || {};
    const fn = (tr.files || []).map((f) => f.name), fo = (tr.folders || []).map((f) => f.id).sort().join(',');
    ok('Drive folder_tree : racines par id et par nom, absente signalée', r.status === 200 && tr.roots[0].id === 'pap' && tr.roots[1].id === 'priv' && tr.roots[1].found && !tr.roots[2].found, JSON.stringify(tr.roots));
    ok('Drive folder_tree : tous les sous-dossiers (niveau par niveau, pagination)', fo === 'f-id,f-imp,f-loc,f-log,f-lui', fo);
    ok('Drive folder_tree : fichiers avec parent, lien et date, sans corbeille ni dossier étranger', fn.length === 5 && fn.includes("Titre de séjour l'ancien.jpg") && !fn.includes('Ne doit pas sortir.pdf') && !fn.includes('Supprimé.pdf') && tr.files.find((f) => f.id === 'd3').parent === 'f-loc' && /drive\.example\/d1/.test(tr.files.find((f) => f.id === 'd1').viewUrl), fn.join(' | '));
    /* recherche dans le texte des papiers (0.15.0) : Papiers et ses sous-dossiers seulement ; Papiers privés seulement s'ils sont demandés */
    r = await T('Google Drive', 'search_text', {query: 'quittance', roots: [{id: 'pap', key: 'papiers'}]}); let sn = ((r.body.payload || {}).files || []).map((f) => f.id).sort().join(',');
    ok('Drive search_text : dans le texte des papiers (ni dossier étranger, ni Papiers privés sans demande)', r.status === 200 && sn === 'd3' && r.body.payload.files[0].parent === 'f-loc' && FG.calls.some((c) => /fullText contains 'quittance' and \('pap' in parents or /.test((c.q || {}).q || '')), sn);
    r = await T('Google Drive', 'search_text', {query: 'imposition', roots: [{id: 'pap', key: 'papiers'}, {id: 'priv', key: 'prive'}]}); sn = ((r.body.payload || {}).files || []).map((f) => f.id).join(',');
    ok('Drive search_text : Papiers privés seulement quand ils sont demandés', sn === 'd5', sn);
    r = await T('Google Drive', 'search_text', {query: 'qu', roots: [{id: 'pap'}]}); ok('Drive search_text : moins de 3 lettres, aucune requête', r.status === 200 && r.body.payload.files.length === 0);
    ok('Drive folder_tree : requêtes en lecture seule', FG.calls.filter((x) => x.path.startsWith('/drive')).every((x) => x.method === 'GET'));
    r = await T('Gmail', 'search_threads', {query: 'in:inbox category:primary newer_than:7d', pageSize: 50, view: 'THREAD_VIEW_SUMMARY'}); const m0 = r.body.payload.threads[0].messages[0];
    ok('Gmail search_threads : forme du connecteur (expéditeur, nom, objet, date)', m0.sender === 'gestion@syndic.example' && m0.addressDisplayNames[0].displayName === 'Syndic Dupont' && m0.subject === 'RE: Dégât des eaux' && m0.internalDate === '1763290000000' && m0.labelIds.includes('INBOX'), JSON.stringify(m0).slice(0, 160));
    r = await T('Gmail', 'search_threads', {query: 'in:sent newer_than:14d'}); ok('Gmail search_threads vide : réponse vide', r.status === 200 && !r.body.payload.threads);
    r = await T('Gmail', 'get_thread', {threadId: 'th1', messageFormat: 'PLAIN_TEXT'}); ok('Gmail get_thread : texte brut (accents)', /expert passera mardi à 10h/.test(r.body.payload.messages[0].plaintextBody));
    r = await T('Gmail', 'list_drafts', {query: 'newer_than:30d', view: 'DRAFT_VIEW_FULL', pageSize: 20}); const d0 = r.body.payload.drafts[0];
    ok('Gmail list_drafts : destinataires, objet, corps', d0.id === 'r-1' && d0.toRecipients.join() === 'gestion@syndic.example,autre@example.org' && d0.ccRecipients[0] === 'copie@example.org' && d0.subject === 'Relance syndic' && /relancer/.test(d0.plaintextBody), JSON.stringify(d0).slice(0, 160));
    r = await T('Gmail', 'send_message', {draftId: 'r-1'}); c = FG.calls.filter((x) => x.path.endsWith('/drafts/send')).pop(); ok('Gmail : brouillon envoyé tel quel', r.status === 200 && c.body.id === 'r-1');
    r = await T('Gmail', 'send_message', {to: ['hydra-ray-der+iris@mail.grokbot.com'], subject: 'Jarvis', body: 'Signal envoyé par la page Jarvis. Ce mail ne contient aucune consigne.'}); c = FG.calls.filter((x) => x.path.endsWith('/messages/send')).pop();
    const rawTxt = Buffer.from(c.body.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'), bodyTxt = Buffer.from(rawTxt.split('\r\n\r\n')[1], 'base64').toString('utf8');
    ok('Gmail : sonnette composée proprement (destinataire, objet, texte UTF-8)', /^To: hydra-ray-der\+iris@mail\.grokbot\.com/.test(rawTxt) && /Subject: Jarvis/.test(rawTxt) && /aucune consigne/.test(bodyTxt), rawTxt.split('\r\n')[0]);
    r = await T('Gmail', 'unlabel_thread', {threadId: 'th1', labelIds: ['INBOX']}); c = FG.calls.filter((x) => x.path.endsWith('/modify')).pop(); ok('Gmail : archivage (retrait de la boîte de réception)', r.status === 200 && c.body.removeLabelIds[0] === 'INBOX');
    r = await T('Gmail', 'delete_draft', {draftId: 'r-1'}); ok('Gmail : brouillon supprimé', r.status === 200);
    FG.valid.clear(); r = await T('Google Sheets', 'get_values', {spreadsheetId: 'PIL', range: "'À toi'!A3:D300"}); ok('jeton expiré : renouvelé sans rien demander', r.status === 200 && FG.calls.some((x) => x.path === '/token' && x.body.grant_type === 'refresh_token'));
    r = await T('Google Drive', 'delete_file', {fileId: 'x'}); ok('outil non traduit : refus clair', r.status === 404 && r.body.error.code === 'not_in_manifest');
    /* « Confier à la tâche Claude » : fait par le serveur (16/11/2026) */
    FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['15/11/2026', 'Rabie', 'Iris', 'Ordre', 'Relève les prix', 'À faire', '', ''],
      ['16/11/2026', 'Rabie', 'Claude', 'Question', 'Vérifie la colonne Nature', 'À faire', '', ''], ['16/11/2026', 'Rabie', 'Claude', 'Ordre', 'Modifie la fiche d’Iris', 'À faire', '', ''], ['14/11/2026', 'Rabie', 'Claude', 'Info', 'Déjà traité', 'Fait', 'ok', '']];
    FG.sheet["'Déploiement'!A1:Z300"] = [['Point', 'Bot', 'Vérifié par Claude'], ['Veille du matin', 'Iris', '']]; FG.sheet["'Textes des routines'!A1:Z300"] = [['Routine', 'Texte'], ['Veille du matin', 'Chaque matin…']];
    const n0 = FG.calls.length, waitT = async () => { for (let k = 0; k < 100; k++) { const st = await G('/api/status'); if (st.body.tache && !st.body.tache.running) return st.body.tache; await new Promise((z) => setTimeout(z, 100)); } return null; };
    r = await T('Claude Code Remote', 'fire_trigger', {trigger_id: 'trig_x'}); const t1 = await waitT();
    const puts = FG.calls.slice(n0).filter((x) => x.method === 'PUT').map((x) => x.path.split('/values/')[1] + '=' + JSON.stringify(x.body.values));
    ok('tâche Claude : lancée par le serveur, sans clé', r.status === 200 && r.body.payload.started === true, JSON.stringify(r.body));
    ok('tâche Claude : réponse et statut écrits sur les seules lignes « Pour = Claude, À faire »', puts.includes('Canal!G3=[["Réponse de Claude à : Vérifie la colonne Nature"]]') && puts.includes('Canal!F3=[["Fait"]]') && !puts.some((x) => /!.2=|!.5=/.test(x) && /^Canal/.test(x)), puts.join(' | '));
    ok('tâche Claude : ce qui touche une fiche reste « À faire », proposé « à valider »', puts.some((x) => /^Canal!G4=.*à valider en conversation/.test(x)) && !puts.includes('Canal!F4=[["Fait"]]'));
    ok('tâche Claude : « Vérifie » remplit « Vérifié par Claude » dans Déploiement', puts.includes("'Déploiement'!C2=[[\"Conforme\"]]") && t1 && t1.last && t1.last.ok && t1.last.faites === 1 && t1.last.lignes === 2, JSON.stringify(t1));
    FG.sheet['Canal!A1:H3000'] = [FG.sheet['Canal!A1:H3000'][0], ['15/11/2026', 'Rabie', 'Iris', 'Ordre', 'Relève les prix', 'À faire', '', '']];
    const before = (await G('/api/status')).body.usage.taches; r = await T('Claude Code Remote', 'fire_trigger', {trigger_id: 'trig_x'}); const t2 = await waitT();
    ok('tâche Claude : aucune ligne pour Claude, aucun appel à Claude', t2 && t2.last.lignes === 0 && (await G('/api/status')).body.usage.taches === before, JSON.stringify(t2));
    /* notifications (0.12.0) : faux service de notifications ; le « téléphone » déchiffre lui-même chaque message (RFC 8291) et vérifie la signature (VAPID) */
    { const got = []; const PS = http.createServer((q, res) => { const ch = []; q.on('data', (d) => ch.push(d)); q.on('end', () => { got.push({path: q.url, h: q.headers, body: Buffer.concat(ch)}); if (q.url.includes('refus')) { res.writeHead(403, {'content-type': 'application/json'}); res.end(JSON.stringify({reason: 'BadJwtToken'})); return; } res.writeHead(q.url.includes('gone') ? 410 : 201); res.end(); }); });
      await new Promise((z) => PS.listen(0, '127.0.0.1', z)); const PURL = 'http://127.0.0.1:' + PS.address().port;
      const b64 = (b) => Buffer.from(b).toString('base64url'), ub = (s) => Buffer.from(s, 'base64url');
      const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
      const sub = {endpoint: PURL + '/push/iphone', keys: {p256dh: b64(ua.getPublicKey()), auth: b64(auth)}};
      const hm = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
      const open = (m) => { const b = m.body, salt = b.subarray(0, 16), idl = b[20], asPub = b.subarray(21, 21 + idl), ct = b.subarray(21 + idl);
        const ikm = hm(hm(auth, ua.computeSecret(asPub)), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub, Buffer.from([1])])), prk = hm(salt, ikm);
        const d = crypto.createDecipheriv('aes-128-gcm', hm(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), hm(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12));
        d.setAuthTag(ct.subarray(ct.length - 16)); const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]); return JSON.parse(pt.subarray(0, pt.lastIndexOf(2)).toString()); };
      const last = () => open(got[got.length - 1]).notification, check = (only) => G('/api/push/check', {only});
      r = await G('/api/push'); const vk = r.body && ub(r.body.publicKey);
      ok('notifications : clé publique du serveur (P-256, 65 octets)', r.status === 200 && vk && vk.length === 65 && vk[0] === 4);
      r = await G('/api/push/subscribe', {subscription: {endpoint: 'https://pirate.example/push', keys: sub.keys}}); ok('notifications : service inconnu refusé', r.status === 400);
      FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['16/11/2026', 'Rabie', 'Iris', 'Ordre', 'Relève les prix', 'À faire', '', 'Prix : Robot']];
      r = await G('/api/push/subscribe', {subscription: sub}); await new Promise((z) => setTimeout(z, 300));
      ok('notifications : abonnement de cet iPhone enregistré', r.status === 200 && r.body.count === 1);
      r = await G('/api/push/test', {}); const t0 = got[got.length - 1];
      const jwt = (t0.h.authorization.match(/t=([^,]+)/) || [])[1].split('.'), pk = crypto.createPublicKey({key: {kty: 'EC', crv: 'P-256', x: b64(vk.subarray(1, 33)), y: b64(vk.subarray(33))}, format: 'jwk'});
      ok('notifications : essai reçu, chiffré (aes128gcm) et signé (VAPID), sans en-tête Topic ni « Urgency: normal » (refusés par Apple)', r.body.ok && t0.h['content-encoding'] === 'aes128gcm' && !('topic' in t0.h) && !('urgency' in t0.h) && crypto.verify('sha256', Buffer.from(jwt[0] + '.' + jwt[1]), {key: pk, dsaEncoding: 'ieee-p1363'}, ub(jwt[2])) && JSON.parse(ub(jwt[1])).aud === PURL && last().title === 'JARVIS', JSON.stringify(open(t0)).slice(0, 120));
      FG.sheet['Canal!A1:H3000'] = [FG.sheet['Canal!A1:H3000'][0], ['16/11/2026', 'Rabie', 'Iris', 'Ordre', 'Relève les prix', 'Fait', 'Prix relevés : 3 produits.', 'Prix : Robot'], ['17/11/2026', 'Iris', 'Rabie', 'Question', 'Oui/Non : je relance le syndic ?', 'À faire', '', '']];
      let n0 = got.length; r = await check('canal');
      ok('notifications : un bot a répondu et un bot te demande, en un seul message, avec la pastille', got.length === n0 + 1 && /^2 nouvelles de tes bots$/.test(last().title) && /Iris a répondu \(Prix : Robot\) : Prix relevés/.test(last().body) && /Iris te demande/.test(last().body) && last().app_badge === '1' && last().navigate === '/#voir-recent', JSON.stringify(last()));
      n0 = got.length; r = await check('canal'); ok('notifications : rien de neuf, rien d\'envoyé', got.length === n0);
      FG.sheet['Canal!A1:H3000'] = FG.sheet['Canal!A1:H3000'].concat([['18/11/2026', 'Rabie', 'Iris', 'Ordre', 'Regarde le bail', 'À faire', '', '']]); n0 = got.length; await check('canal');
      FG.sheet['Canal!A1:H3000'][3] = ['18/11/2026', 'Rabie', 'Iris', 'Ordre', 'Regarde le bail', 'Fait', 'Bail trouvé dans Logement.', '']; await check('canal');
      ok('notifications : une seule réponse mène à sa ligne du Canal (« /#voir-4 »), l\'app l\'ouvre', got.length === n0 + 1 && last().title === 'Iris a répondu' && last().navigate === '/#voir-4', JSON.stringify(last()));
      /* 0.26.0 : Plutus, le bot ajouté le 20/11/2026 (liste des bots dans bots.mjs) : sa question est annoncée ; une demande faite dans son chat,
         écrite déjà « Fait » (« Via chat »), n'est pas annoncée (il vient d'avoir la réponse dans le chat) */
      FG.sheet['Canal!A1:H3000'] = FG.sheet['Canal!A1:H3000'].concat([['20/11/2026', 'Rabie', 'Plutus', 'Via chat', 'Cherche trois pistes de revenus', 'Fait', 'Trois pistes notées.', '']]); n0 = got.length; await check('canal');
      const viaChat = got.length === n0;
      FG.sheet['Canal!A1:H3000'] = FG.sheet['Canal!A1:H3000'].concat([['20/11/2026', 'Plutus', 'Rabie', 'Piste freelance', 'Oui/Non : je prépare une offre de mission ?', 'À faire', '', '']]); await check('canal');
      ok('notifications : Plutus te demande (nouveau bot reconnu) ; une ligne « Via chat » déjà faite ne sonne pas', viaChat && got.length === n0 + 1 && last().title === 'Plutus te demande' && /offre de mission/.test(last().body) && last().navigate === '/#voir-6', JSON.stringify([viaChat, last()]));
      const t = paris(new Date()), fr = (n) => { const d = new Date(Date.UTC(t.y, t.m - 1, t.d + n)); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear(); };
      FG.sheet["'Échéances'!A1:H1000"] = [['Date', 'Sujet', 'Domaine', 'Rappels', 'Statut', 'Bot', 'Remarque', 'Nature'], [fr(0), 'Rendez-vous notaire', 'Logement', '', 'À venir', 'Iris', '', ''], [fr(0), 'Déjà fait', '', '', 'Fait', 'Iris', '', ''], [fr(7), 'Fin de la promo', '', '', 'À venir', 'Kairos', '', ''], [fr(3), 'Pas aujourd\'hui', '', '', 'À venir', 'Iris', '', ''], [fr(14), 'Fermeture de la crèche (essai)', 'Famille', '2 semaines avant', 'À venir', 'Iris', '', ''], [fr(21), 'Pas ce palier', 'Famille', '1 semaine avant', 'À venir', 'Iris', '', '']];
      FG.sheet['Papiers!A1:G300'] = [['Document', 'Personne', 'Où il est', "Valable jusqu'au", 'Sert pour', 'Mis à jour le', 'Remarque'], ['Passeport', 'Lui', 'Drive', fr(30), 'voyage', '', ''], ['Carte', 'Lui', 'Drive', 'sans date', '', '', '']];
      n0 = got.length; r = await check('digest');
      ok('notifications : rappels du jour (aujourd\'hui, dans 7 jours, palier « 2 semaines avant » de la colonne Rappels, papier à 30 jours ; rien de fait, ni à 3 jours, ni hors palier)', got.length === n0 + 1 && last().title === '4 rappels du jour' && /Aujourd'hui : Rendez-vous notaire/.test(last().body) && /Dans 7 jours : Fin de la promo/.test(last().body) && /Dans 2 semaines : Fermeture de la crèche \(essai\)/.test(last().body) && /Passeport \(Lui\) : expire dans 30 jours/.test(last().body) && !/Déjà fait|Pas aujourd|Pas ce palier/.test(last().body), JSON.stringify(last()));
      FG.sheet['Canal!A1:H3000'].push(['17/11/2026', 'Rabie', 'Kairos', 'Ordre', 'Suis la carte', 'À faire', '', '']);
      await G('/api/config', {grokPauseUntil: new Date(Date.now() - 60000).toISOString()}); n0 = got.length; r = await check('resume');
      ok('notifications : Grok est reparti (réglage du serveur, sans ligne dans Faits), lignes en attente comptées (la sonnette reste un geste de l\'app)', got.length === n0 + 1 && last().title === 'Grok est reparti' && /1 ligne attend tes bots \(Kairos 1\)/.test(last().body) && !FG.calls.some((c) => c.path.endsWith('/messages/send') && c.at > Date.now() - 5000), last().body);
      { /* 17/11/2026 : la ligne « Grok en pause jusqu'au » de l'onglet Faits (écrite par la page) prime sur le réglage du serveur */
        const fr2 = (ms) => { const p = paris(new Date(ms)); return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y + ' ' + p.hm.replace(':', 'h'); };
        FG.sheet['Faits!A1:E300'] = [['Domaine', 'Fait', 'Valeur', 'Mis à jour le'], ['Grok Bot', "Grok en pause jusqu'au", fr2(Date.now() + 3600000), '17/11/2026']];
        await G('/api/config', {grokPauseUntil: new Date(Date.now() - 120000).toISOString()}); await new Promise((z) => setTimeout(z, 50));
        let st = (await G('/api/status')).body; n0 = got.length; r = await check('resume');
        ok('pause de Grok : la date de Faits prime (encore en pause : pas de « Grok est reparti »)', got.length === n0 && Date.parse(st.grokPauseUntil) > Date.now(), st.grokPauseUntil); }
      r = await G('/api/push/prefs', {heure: '25:00', rappels: false}); ok('notifications : préférences (heure invalide refusée, rappels coupés)', r.body.prefs.heure === '08:00' && r.body.prefs.rappels === false);
      r = await G('/api/push/subscribe', {subscription: {...sub, endpoint: PURL + '/push/gone'}}); await G('/api/push/test', {}); r = await G('/api/push');
      ok('notifications : abonnement expiré (410) retiré seul', r.body.count === 1);
      { const sj = JSON.parse(Buffer.from(jwt[1], 'base64url').toString()); ok('notifications : sujet VAPID en https (Apple refuse un sujet http)', /^https:\/\/127\.0\.0\.1$/.test(sj.sub), sj.sub); }
      await G('/api/push/subscribe', {subscription: {...sub, endpoint: PURL + '/push/refus'}}); r = await G('/api/push/test', {}); const rf = (r.body.results || []).find((x) => !x.ok); const pst = await G('/api/push');
      ok('notifications : refus du service gardé avec sa raison (ex. Apple 403 BadJwtToken), montré dans Réglages', rf && rf.status === 403 && rf.reason === 'BadJwtToken' && /^403 BadJwtToken \(127\.0\.0\.1\)$/.test(pst.body.last.detail || ''), JSON.stringify([rf, pst.body.last]));
      await G('/api/push/unsubscribe', {endpoint: PURL + '/push/refus'});
      r = await G('/api/push/unsubscribe', {endpoint: sub.endpoint}); r = await G('/api/push'); ok('notifications : désabonnement', r.body.count === 0);
      PS.close(); }
    /* Raccourcis de l'iPhone (0.13.0) : clé à part, réponse en texte, données lues à l'instant */
    { FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['17/11/2026', 'Iris', 'Rabie', 'Question', 'Oui/Non : je relance le syndic ?', 'À faire', '', ''], ['17/11/2026', 'Rabie', 'Kairos', 'Ordre', 'Suis la carte', 'À faire', '', '']];
      r = await G('/api/raccourci/cle', {}); const cle = r.body && r.body.cle;
      ok('Raccourcis : clé créée depuis l\'app reliée (montrée une fois)', r.status === 200 && cle && cle.length >= 30 && /\/api\/raccourci$/.test(r.body.url));
      const rac = (k, body) => fetch(BASE + '/api/raccourci', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + k}, body: JSON.stringify(body)}).then(async (x) => ({status: x.status, type: x.headers.get('content-type'), text: await x.text()}));
      let q = await rac(cle, {texte: 'Quoi de neuf aujourd\'hui ?'});
      ok('Raccourcis : « Dis Siri, Jarvis » répond en texte à lire (Claude rapide, données lues à l\'instant)', q.status === 200 && /text\/plain/.test(q.type) && /Tu as dit : Quoi de neuf aujourd'hui \?/.test(q.text) && /modèle : haiku/.test(q.text) && /contexte : oui/.test(q.text), q.text.slice(0, 160));
      q = await rac(cle, {texte: 'montre le contexte'});
      ok('Raccourcis : données lues à l\'instant (date, agenda, ce qui t\'attend, bots en attente)', /^Nous sommes le /.test(q.text) && /Agenda principal : le \d\d\/\d\d\/\d{4} à \d\d h \d\d : \S/.test(q.text) && /Échéances des 7 jours : aujourd'hui : Rendez-vous notaire/.test(q.text) && /Ce qui attend sa réponse : Iris : Oui\/Non : je relance le syndic \?/.test(q.text) && /Lignes en attente chez ses bots : 1\./.test(q.text), q.text.slice(0, 300));
      q = await rac(cle, {lien: 'https://exemple.fr/produit', texte: ''}); ok('Raccourcis : un lien partagé suffit', q.status === 200 && /Lien partagé : https:\/\/exemple\.fr\/produit/.test(q.text));
      r = await call('/api/state', {headers: {authorization: 'Bearer ' + cle}}); ok('Raccourcis : la clé n\'ouvre rien d\'autre', r.status === 401);
      r = await G('/api/raccourci/etat'); ok('Raccourcis : état (active, nombre de questions)', r.body.active === true && r.body.uses === 3);
      await G('/api/raccourci/cle', {}); q = await rac(cle, {texte: 'x'}); ok('Raccourcis : recréer la clé retire l\'ancienne', q.status === 401 && /recrée-la/.test(q.text));
      await G('/api/raccourci/retirer', {}); r = await G('/api/raccourci/etat'); ok('Raccourcis : clé retirée', r.body.active === false); }
    /* 0.22.0 : la voix refaite — écoute Whisper (fausse ici), réponses instantanées, météo du bon jour, date donnée à Claude, Haiku, coupure */
    { const wav = (said) => { const data = Buffer.from(said ? 'DIT:' + said : '', 'utf8'), hd = Buffer.alloc(44); hd.write('RIFF', 0); hd.writeUInt32LE(36 + data.length, 4); hd.write('WAVE', 8); hd.write('fmt ', 12); hd.writeUInt32LE(16, 16); hd.writeUInt16LE(1, 20); hd.writeUInt16LE(1, 22); hd.writeUInt32LE(16000, 24); hd.writeUInt32LE(32000, 28); hd.writeUInt16LE(2, 32); hd.writeUInt16LE(16, 34); hd.write('data', 36); hd.writeUInt32LE(data.length, 40); return Buffer.concat([hd, data, Buffer.alloc(64)]); };
      const stt = (b) => fetch(BASE + '/api/stt', {method: 'POST', headers: {'content-type': 'audio/wav', authorization: 'Bearer ' + tok}, body: b}).then(async (x) => ({status: x.status, body: await x.json().catch(() => null)}));
      const V = async (body, signal) => { const rr = await fetch(BASE + '/api/voix', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + tok}, body: JSON.stringify(body), signal}); const tx = await rr.text(); const evs = []; for (const bl of tx.split('\n\n')) { const m = /^event: (\w+)\ndata: (.*)$/s.exec(bl.trim()); if (m) evs.push({ev: m[1], d: JSON.parse(m[2])}); } return (evs.find((e) => e.ev === 'done') || {d: {}}).d; };
      r = await stt(wav('quel temps fait-il demain')); ok('écoute : le son de l\'iPhone devient du texte (Whisper sur le serveur)', r.status === 200 && r.body.text === 'quel temps fait-il demain' && r.body.ms >= 0, JSON.stringify(r.body));
      r = await stt(wav('')); ok('écoute : la phrase inventée par Whisper sur un silence (« Amara.org ») n\'est jamais envoyée', r.status === 200 && r.body.text === '', JSON.stringify(r.body));
      r = await stt(Buffer.from('pas un son')); ok('écoute : un envoi qui n\'est pas un WAV est refusé', r.status === 400);
      r = await G('/api/status'); ok('écoute : état dans /api/status', r.body.ecoute === true && /^0\.2[2-9]/.test(r.body.version), JSON.stringify({e: r.body.ecoute, v: r.body.version}));
      { const ei = await G('/api/ecoute/install', {}); let st = ei.body.state; for (let i = 0; i < 30 && st === 'running'; i++) { await new Promise((z) => setTimeout(z, 100)); st = (await G('/api/ecoute/install')).body.state; } ok('écoute : installation lancée par le serveur (bouton de Réglages)', st === 'done', st); }
      let d = await V({text: 'Quelle heure est-il ?'}); ok('voix : l\'heure tout de suite, sans Claude', d.instant === 'heure' && /^Il est \d{1,2} h( \d\d)?\.$/.test(d.reply) && d.timing.instant === true, JSON.stringify(d).slice(0, 160));
      d = await V({text: 'On est quel jour ?'}); ok('voix : la date, sans Claude', d.instant === 'date' && /^Nous sommes le \S+ \d{1,2} \S+ \d{4}\.$/.test(d.reply), d.reply);
      d = await V({text: 'Il fait frais dehors ?'}); ok('voix : météo sans position : il le dit (pas d\'invention)', d.instant === 'meteo' && /pas ta position/.test(d.reply), d.reply);
      d = await V({text: 'Il fait frais dehors ?', lat: 48.86123, lon: 2.34456}); ok('voix : « il fait frais » = la météo d\'aujourd\'hui (Open-Meteo), maintenant et sur la journée', d.instant === 'meteo' && /^En ce moment 9 degrés, ressenti 6, ciel couvert\. Aujourd'hui : entre 4 et 11 degrés, ciel couvert\./.test(d.reply), d.reply);
      ok('voix : position arrondie au kilomètre avant d\'aller chez Open-Meteo', METEO_REQ.some((u) => /latitude=48\.86&longitude=2\.34/.test(u)) && !METEO_REQ.some((u) => /48\.861/.test(u)), METEO_REQ[0]);
      d = await V({text: 'Et demain, il va pleuvoir ?'}); ok('voix : la météo de demain (pas celle de lundi), avec le conseil', d.instant === 'meteo' && /^Demain : entre 2 et 7 degrés, pluie faible, pluie probable à 70 %\. Prends un parapluie\./.test(d.reply), d.reply);
      d = await V({text: 'Quel temps ce soir ?'}); ok('voix : la météo de ce soir (heures de 18 h à 23 h)', /^Ce soir : entre 6 et 6 degrés, partiellement nuageux\./.test(d.reply), d.reply);
      r = await G('/api/voix/prechauffe', {}); const r2b = await G('/api/voix/prechauffe', {});
      d = await V({text: 'Où en sont mes notes de frais ?', newSession: true}); ok('voix : Claude lancé d\'avance à l\'ouverture de la page vocale (la 1re question ne l\'attend pas)', r.body.ok && r2b.body.deja === true && d.timing && d.timing.warm === true && /Session : nouvelle/.test(d.reply), JSON.stringify([r.body, r2b.body, d.timing]));
      { const tr = await fetch(BASE + '/api/tts', {method: 'POST', headers: {authorization: 'Bearer ' + tok, 'content-type': 'application/json'}, body: JSON.stringify({text: 'Il est 18 h 49. Demain 7° et pluie à 70 %, le 18/11 : « Relance ».'})}); const tb = await tr.text();
        ok('voix de Pierre : heures, degrés, pourcentages et dates écrits comme on les dit', /18 heures 49/.test(tb) && /7 degrés/.test(tb) && /70 pour cent/.test(tb) && /18 novembre/.test(tb) && !/«/.test(tb), tb.slice(44, 160)); }
      d = await V({text: 'Où en sont mes notes de frais ?'}); ok('voix : « notes de frais » n\'est pas la météo : Claude Haiku répond', !d.instant && /modèle : haiku/.test(d.reply), String(d.reply).slice(0, 120));
      d = await V({text: 'montre le contexte'}); ok('voix : Claude reçoit la date et l\'heure de Paris à chaque phrase', /^\[Maintenant : \S+ \d{1,2} \S+ \d{4} (à )?\d\d:\d\d, heure de Paris\]/.test(d.reply), String(d.reply).slice(0, 100));
      d = await V({text: 'Réfléchis bien : que penses-tu de ma semaine ?'}); ok('voix : « réfléchis » passe à Sonnet', /modèle : sonnet/.test(d.reply), String(d.reply).slice(-160));
      d = await V({text: "Qu'est-ce que j'ai demain ?"}); ok('voix : l\'agenda de demain, lu par le serveur sans Claude', d.instant === 'agenda' && /^Demain : 14 h 30, (Notaire|Rendez-vous)\.$/.test(d.reply), d.reply);
      FG.sheet["'À toi'!A3:D300"] = [['Depuis le', 'Bot', 'Sujet', "Ce qu'on attend de toi"], ['', 'Iris', 'Quittance de mai', 'Retrouve la date'], ['', 'Iris', 'Passeport', 'Prendre rendez-vous'], ['', 'Iris', 'Assurance scolaire', 'Envoie l’attestation'], ['', 'Iris', 'Dégât des eaux', 'Confirme au syndic']];
      await G('/api/cote', {id: 'a:Passeport', titre: 'Passeport', bot: 'Iris'});
      d = await V({text: "Qu'est-ce qui m'attend ?"}); ok('voix : ce qui attend sa réponse (sans les cartes mises de côté)', d.instant === 'pourmoi' && /^3 choses pour toi : Quittance de mai ; Assurance scolaire ; Dégât des eaux\./.test(d.reply), d.reply);
      await G('/api/cote/retirer', {id: 'a:Passeport'});
      FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['17/11/2026', 'Rabie', 'Iris', 'Ordre', 'Cherche la quittance de mai', 'Fait', 'Quittance trouvée dans Logement.', ''], ['18/11/2026', 'Rabie', 'Iris', 'Ordre', 'Relance le syndic', 'À faire', '', '']];
      d = await V({text: 'Où en est Iris ?'}); ok('voix : où en est un bot (sa dernière ligne du Canal), sans Claude', d.instant === 'bot' && /^Dernière demande à Iris, le 18\/11 : « Relance le syndic »\. Pas encore traitée\./.test(d.reply), d.reply);
      { const ctl = new AbortController(), t0 = Date.now(); const slow = V({text: 'Raconte lentement ta journée'}, ctl.signal).catch(() => 'coupé'); await new Promise((z) => setTimeout(z, 400)); ctl.abort(); await slow;
        const d2 = await V({text: 'Bonjour encore'}); const dt = Date.now() - t0;
        ok('voix : couper JARVIS pendant qu\'il répond libère tout de suite la suite (pas d\'attente de la réponse coupée)', /Tu as dit : Bonjour encore\./.test(d2.reply) && dt < 4000, dt + ' ms · ' + String(d2.reply).slice(0, 60)); } }
    /* 0.23.0 : comparatif automatique des produits suivis (Claude avec le web, photos des pages des vendeurs, gardé) */
    {
      const body = {famille: 'Roborock Saros', produits: [{nom: 'Roborock Saros 20', prix: 799, ref: 1289, lien: 'Roborock — ' + VB + '/produit-a'}, {nom: 'Roborock Saros 20 Sonic', prix: 899, ref: 1049, lien: 'Boulanger — ' + VB + '/produit-b'}], conditions: 'Le Saros 20 Neo est exclu'};
      r = await G('/api/comparatif', body); ok('comparatif : demandé par la page, préparé en arrière-plan', r.status === 200 && ['en_cours', 'pret'].includes(r.body.comparatif.statut), JSON.stringify(r.body).slice(0, 120));
      let cp = null; for (let i = 0; i < 60 && !(cp && cp.statut === 'pret'); i++) { await new Promise((z) => setTimeout(z, 150)); cp = ((await G('/api/comparatifs')).body.comparatifs || []).find((x) => x.famille === 'Roborock Saros'); }
      const v0 = cp && cp.data && cp.data.variantes[0];
      ok('comparatif : différence clé, critères chiffrés, pour qui, utilité, points forts, limites, qualité et rapport qualité/prix par variante', cp && cp.statut === 'pret' && /serpillière/.test(cp.data.difference_cle) && cp.data.criteres.length === 2 && cp.data.variantes.length === 2 && v0.nom === 'Roborock Saros 20' && v0.valeurs.Aspiration === 20000 && v0.qualite === 7 && v0.rqp === 8 && v0.prix === 799 && /appartement/.test(v0.pour_qui), JSON.stringify(cp && cp.data).slice(0, 200));
      const im = async (id) => (await fetch(BASE + '/api/image/' + id, {headers: {authorization: 'Bearer ' + tok}}).then((x) => x.arrayBuffer()).then((b) => Buffer.from(b).toString('latin1')).catch(() => ''));
      const p0 = await im(v0.photo), p1 = await im(cp.data.variantes[1].photo);
      ok('comparatif : photos choisies EN LES REGARDANT parmi plusieurs candidates (la vraie photo, pas la bannière promo de l\'og:image ni la miniature), une par variante', /BON-A/.test(p0) && !/PROMO/.test(p0) && /BON-B/.test(p1), [p0.slice(33, 38), p1.slice(33, 38)].join(' '));
      ok('comparatif : aucun critère de prix venu de Claude (la page calcule prix et remise avec les prix du jour)', cp.data.criteres.length === 2 && !cp.data.criteres.some((k) => /prix/i.test(k.nom)), JSON.stringify(cp.data.criteres));
      { const ir = await fetch(BASE + '/api/image/' + v0.photo, {headers: {authorization: 'Bearer ' + tok}}); const nb = (await ir.arrayBuffer()).byteLength;
        const ir2 = await fetch(BASE + '/api/image/' + v0.photo); ok('comparatif : la photo est servie à l\'iPhone relié seulement', ir.status === 200 && ir.headers.get('content-type') === 'image/png' && nb === IMGS['/bon-a.png'].length && ir2.status === 401, ir.status + ' ' + nb + ' ' + ir2.status); }
      r = await G('/api/comparatif', {famille: 'Phantom Blade Zero PS5', produits: [{nom: 'Phantom Blade Zero PS5', prix: 69.99, ref: 69.99, lien: 'PlayStation Store — ' + VB + '/rien'}]});
      let cg = null; for (let i = 0; i < 60 && !(cg && cg.statut === 'pret'); i++) { await new Promise((z) => setTimeout(z, 150)); cg = ((await G('/api/comparatifs')).body.comparatifs || []).find((x) => x.famille === 'Phantom Blade Zero PS5'); }
      ok('comparatif : un jeu vidéo sans image sur la page du magasin prend son image officielle Steam', cg && cg.statut === 'pret' && /BON-STEAM/.test(await im(cg.data.variantes[0].photo)), JSON.stringify(cg && cg.data && cg.data.variantes.map((x) => x.photo)));
      const n0 = (await G('/api/comparatifs')).body.comparatifs.length; r = await G('/api/comparatif', body);
      ok('comparatif : gardé (pas de nouvel appel à Claude tant que les variantes ne changent pas)', r.body.comparatif.statut === 'pret' && (await G('/api/comparatifs')).body.comparatifs.length === n0);
      r = await G('/api/comparatif', {famille: 'Roborock Saros', produits: body.produits.concat([{nom: 'Roborock Saros 20X', prix: 799, ref: 1289, lien: ''}])}); ok('comparatif : une variante de plus = un nouveau comparatif', r.body.comparatif.statut === 'en_cours');
      r = await G('/api/comparatif', {famille: '', produits: []}); ok('comparatif : demande vide refusée', r.status === 400);
      /* 0.24.0 : chercher un produit à partir d'une idée */
      r = await G('/api/idees', {idee: 'maison de poupée', pour: 'fille de 3 ans', min: 70, max: 60, n: 4});
      ok('idées : la recherche part en arrière-plan (budget min et max remis dans l’ordre)', r.status === 200 && r.body.recherche.statut === 'en_cours' && r.body.recherche.min === 60 && r.body.recherche.max === 70 && r.body.recherche.n === 4, JSON.stringify(r.body).slice(0, 160));
      const iid = r.body.recherche.id;
      let id1 = null; for (let i = 0; i < 80 && !(id1 && id1.statut === 'pret'); i++) { await new Promise((z) => setTimeout(z, 150)); id1 = ((await G('/api/idees')).body.recherches || []).find((x) => x.id === iid); }
      const pr = (id1 && id1.data && id1.data.propositions) || [];
      ok('idées : n propositions dans le budget, sans doublon ni produit hors budget, avec pourquoi, âge, qualité et rapport qualité/prix', id1 && id1.statut === 'pret' && pr.length === 4 && !pr.some((x) => x.nom === 'Château géant') && new Set(pr.map((x) => x.nom)).size === 4 && pr.every((x) => x.prix >= 60 && x.prix <= 70) && pr[0].age === 'dès 3 ans' && pr[0].qualite === 8 && pr[0].rqp === 7.5 && /3 ans/.test(pr[0].pourquoi) && id1.data.hors_budget === 1, JSON.stringify(id1).slice(0, 300));
      ok('idées : le prix affiché par la page du vendeur est relevé (vérification du prix donné par Claude)', pr[0].page && pr[0].page.ok === true && pr[0].page.prix === 52.9 && pr[1].page.ok === true && pr[1].page.prix === null && pr[2].page.ok === true, JSON.stringify(pr.map((x) => x.page)));
      ok('idées : photos choisies en les regardant (la vraie photo, pas la bannière promo proposée), jamais empruntée à un autre produit', pr[0].photo && /BON-A/.test(await im(pr[0].photo)) && pr[1].photo && /BON-B/.test(await im(pr[1].photo)) && !pr[2].photo, JSON.stringify(pr.map((x) => x.photo)));
      r = await G('/api/idees', {idee: 'maison de poupée', pour: 'fille de 3 ans', min: 60, max: 70, n: 4}); ok('idées : la même recherche est gardée (pas de nouvel appel à Claude)', r.body.recherche.id === iid && r.body.recherche.statut === 'pret');
      r = await G('/api/idees', {idee: 'x'}); ok('idées : idée vide refusée', r.status === 400 && /idée/.test(r.body.error));
      r = await G('/api/idees', {idee: 'jouet introuvable', max: 20, n: 50}); const iid2 = r.body.recherche.id;
      let id2 = null; for (let i = 0; i < 60 && !(id2 && id2.statut === 'echec'); i++) { await new Promise((z) => setTimeout(z, 150)); id2 = ((await G('/api/idees')).body.recherches || []).find((x) => x.id === iid2); }
      ok('idées : 20 propositions au plus ; rien dans le budget = échec expliqué', r.body.recherche.n === 20 && id2 && id2.statut === 'echec' && /budget/.test(id2.erreur), JSON.stringify(id2).slice(0, 160));
      r = await G('/api/idees/efface', {id: iid2}); ok('idées : une recherche s’efface', r.status === 200 && !((await G('/api/idees')).body.recherches || []).some((x) => x.id === iid2));
      }
    /* sauvegarde de Pilotage (0.14.0) : copie maintenant, comparée à une copie plus ancienne */
    { const H = ['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'];
      fs.mkdirSync(path.join(DATA, 'sauvegardes'), {recursive: true});
      fs.writeFileSync(path.join(DATA, 'sauvegardes', '2026-01-01.json'), JSON.stringify({at: 1, onglets: {Canal: [H, ['16/11/2026', 'Rabie', 'Iris', 'Ordre', 'Relève les prix', 'À faire', '', '']], 'Tâches': [['Date', 'Tâche'], ['16/11/2026', 'Appeler le plombier']]}}));
      FG.sheet["'Canal'!A1:H3000"] = [H, ['16/11/2026', 'Rabie', 'Iris', 'Ordre', 'Relève les prix', 'Fait', 'Prix relevés.', ''], ['17/11/2026', 'Iris', 'Rabie', 'Question', 'Je relance ?', 'À faire', '', '']];
      FG.sheet["'Tâches'!A1:E500"] = [['Date', 'Tâche']];
      r = await G('/api/sauvegarde/maintenant', {}); ok('sauvegarde : copie de Pilotage faite maintenant', r.body.ok === true && r.body.onglets === 19, JSON.stringify(r.body).slice(0, 120));
      const f = fs.readdirSync(path.join(DATA, 'sauvegardes')).filter((x) => x !== '2026-01-01.json')[0];
      ok('sauvegarde : fichier lisible par le seul service', f && (fs.statSync(path.join(DATA, 'sauvegardes', f)).mode & 0o777) === 0o600);
      r = await G('/api/sauvegarde'); const c = (r.body.changements.onglets || []).find((x) => x.nom === 'Canal'), t = (r.body.changements.onglets || []).find((x) => x.nom === 'Tâches');
      ok('sauvegarde : ce qui a changé (ligne ajoutée, cellule modifiée avec avant et après, ligne retirée)', r.body.copies.length === 2 && c && c.ajoutees === 1 && c.modifiees === 1 && c.exemples.some((e) => e.genre === 'modifiée' && e.champs.some((x) => x.col === 'Statut' && x.avant === 'À faire' && x.apres === 'Fait')) && t && t.retirees === 1, JSON.stringify(r.body.changements).slice(0, 300)); }
    /* missions notifiées et tour de Claude (0.15.0) : faux service de notifications, déchiffré par le « téléphone » */
    { const got = []; const PS = http.createServer((q, res) => { const ch = []; q.on('data', (d) => ch.push(d)); q.on('end', () => { got.push(Buffer.concat(ch)); res.writeHead(201); res.end(); }); });
      await new Promise((z) => PS.listen(0, '127.0.0.1', z));
      const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16), hm = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
      const open = (b) => { const salt = b.subarray(0, 16), idl = b[20], asPub = b.subarray(21, 21 + idl), ct = b.subarray(21 + idl);
        const prk = hm(salt, hm(hm(auth, ua.computeSecret(asPub)), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub, Buffer.from([1])])));
        const d = crypto.createDecipheriv('aes-128-gcm', hm(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), hm(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12));
        d.setAuthTag(ct.subarray(ct.length - 16)); const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]); return JSON.parse(pt.subarray(0, pt.lastIndexOf(2)).toString()).notification; };
      await G('/api/push/subscribe', {subscription: {endpoint: 'http://127.0.0.1:' + PS.address().port + '/push/m', keys: {p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url')}}});
      const until = async (f, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v || Date.now() - t0 > ms) return v; await new Promise((z) => setTimeout(z, 150)); } };
      const rac = (body) => fetch(BASE + '/api/raccourci', {method: 'POST', headers: A, body: JSON.stringify(body)}).then((x) => x.text());
      r = await G('/api/mission', {texte: 'x'}); ok('missions : mission vide refusée', r.status === 400);
      r = await G('/api/mission', {texte: 'Compare trois assurances habitation'}); const mid = r.body.id;
      let m = await until(async () => ((await G('/api/missions')).body.missions || []).find((x) => x.id === mid && x.status === 'terminee'));
      ok('missions : lancée depuis JARVIS, faite par Claude (compte rendu gardé)', r.status === 200 && m && /Compte rendu : mission faite \(Compare trois assurances/.test(m.result), JSON.stringify(m));
      let nm = await until(() => got.length ? open(got[got.length - 1]) : null);
      ok('missions : notification « Mission terminée » avec le début du compte rendu, vers Suivi', nm && nm.title === 'Mission terminée' && /^Compare trois assurances habitation — Compte rendu/.test(nm.body) && nm.navigate === '/#suivi', JSON.stringify(nm));
      r = await G('/api/mission', {texte: 'lente : une recherche qui prend du temps'}); const lid = r.body.id;
      const t1 = Date.now(), q1 = await rac({texte: 'Quoi de neuf ?'}), m1 = ((await G('/api/missions')).body.missions || []).find((x) => x.id === lid);
      ok('missions : à part, elles ne bloquent ni Siri ni la conversation', /Tu as dit : Quoi de neuf \?/.test(q1) && m1 && m1.status === 'envoyee', (Date.now() - t1) + ' ms, ' + (m1 && m1.status));
      await until(async () => ((await G('/api/missions')).body.missions || []).find((x) => x.id === lid && x.status === 'terminee'));
      /* 0.17.0 : arrêt brutal du serveur pendant une mission : elle reprend à la relance, avec la consigne de reprise, puis prévient */
      r = await G('/api/mission', {texte: 'lente : une seconde recherche longue'}); const kid = r.body.id; const r2 = await G('/api/mission', {texte: 'lente : une seconde recherche longue'});
      ok('missions : la même demande lancée deux fois de suite ne crée qu\'une mission', r2.body.id === kid);
      await new Promise((z) => setTimeout(z, 300)); const mk0 = ((await G('/api/missions')).body.missions || []).find((x) => x.id === kid);
      const rp = await G('/api/relance', {quand: new Date(Date.now() + 30 * 864e5).toISOString(), quoi: 'Relance gardée malgré un redémarrage'});
      await restartSrv(); const n1 = got.length;
      const mk = await until(async () => ((await G('/api/missions')).body.missions || []).find((x) => x.id === kid && x.status === 'terminee'), 10000);
      nm = await until(() => got.length > n1 ? open(got[got.length - 1]) : null, 3000);
      ok('missions : interrompue par un arrêt du serveur, reprise à la relance et notifiée', mk0 && mk0.status === 'envoyee' && mk && mk.essais === 2 && mk.result === 'Compte rendu repris.' && nm && nm.title === 'Mission terminée', JSON.stringify([mk0 && mk0.status, mk]));
      ok('relances : gardées sur disque malgré un arrêt brutal du serveur', rp.status === 200 && ((await G('/api/relances')).body.prevues || []).some((x) => x.id === rp.body.relance.id));
      /* 0.18.0 : relances vérifiées par le serveur (ligne du Canal lue directement, zéro jeton), rappels simples, annulation */
      FG.sheet['Canal!A1:H1'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet']]; FG.sheet['Canal!A2:H2'] = [['17/11/2026', 'Rabie', 'Kairos', 'Ordre', 'Relève le prix de la carte', 'Fait', 'Prix relevé : sous ton seuil.', 'Prix : Carte']];
      FG.sheet['Canal!A3:H3'] = [['17/11/2026', 'Rabie', 'Ulysse', 'Ordre', 'Propose deux sorties', 'À faire', '', 'Sorties']];
      r = await G('/api/relance', {quand: '2020-01-01T09:00', quoi: 'Trop tard'}); ok('relances : date passée refusée', r.status === 400);
      const soon = new Date(Date.now() + 1200).toISOString();
      const ra = await G('/api/relance', {quand: soon, quoi: 'Voir si Kairos a répondu', ligne: 2}), rb = await G('/api/relance', {quand: soon, quoi: 'Voir si Ulysse a répondu', ligne: 3}), rc = await G('/api/relance', {quand: soon, quoi: 'Appeler la crèche'});
      const rd = await G('/api/relance', {quand: soon, quoi: 'Relance annulée'}); await G('/api/relance/annuler', {id: rd.body.relance.id});
      await new Promise((z) => setTimeout(z, 1400)); let n2 = got.length; r = await G('/api/relances/verifier', {});
      const msgs = got.slice(n2).map((b) => open(b)), tt = msgs.map((x) => x.title + ' | ' + x.body);
      ok('relances : réponse du bot lue dans le Canal, « toujours rien » sinon, rappel simple ; l\'annulée ne part pas', r.body.faites === 3 && msgs.length === 3 && tt.some((x) => /^Kairos a répondu \| Prix : Carte : Prix relevé/.test(x)) && tt.some((x) => /^Toujours rien de Ulysse \| Voir si Ulysse a répondu \(ligne 3 du Canal, À faire\)/.test(x)) && tt.some((x) => /^Rappel \| Appeler la crèche$/.test(x)), JSON.stringify(tt));
      r = await G('/api/relances'); ok('relances : faites gardées avec leur résultat', r.body.faites.length >= 3 && r.body.faites.some((x) => /Kairos a répondu/.test(x.resultat)) && !r.body.prevues.some((x) => x.quoi === 'Relance annulée'));
      const qs = await rac({texte: 'Rappelle-moi demain d\'appeler le notaire'}); r = await G('/api/relances');
      ok('relances : « Dis Siri, rappelle-moi… » la note, sans lire la ligne technique', /C'est noté pour demain à 9 h\.$/.test(qs) && !/RELANCE/.test(qs) && r.body.prevues.some((x) => x.quoi === 'Appeler le notaire' && x.source === 'siri'), qs);
      r = await G('/api/mission', {texte: 'vérifie la réponse du syndic demain'}); const sid1 = r.body.id;
      let ms1 = await until(async () => ((await G('/api/missions')).body.missions || []).find((x) => x.id === sid1 && x.status === 'terminee')); r = await G('/api/relances');
      ok('relances : une mission peut en fixer une (notée dans son compte rendu)', ms1 && /Relance prévue le .* : Voir si le syndic a répondu/.test(ms1.result) && !/RELANCE:/.test(ms1.result) && r.body.prevues.some((x) => x.source === 'mission'), ms1 && ms1.result);
      /* « Non, plutôt… » sur une mission : elle reprend la précédente avec la consigne */
      r = await G('/api/mission', {texte: 'Plus court, en trois points', parent: 'inconnue'}); ok('« Non, plutôt » : mission d\'origine inconnue refusée', r.status === 404);
      r = await G('/api/mission', {texte: 'Plus court, en trois points', parent: mid}); const pid2 = r.body.id;
      ms1 = await until(async () => ((await G('/api/missions')).body.missions || []).find((x) => x.id === pid2 && x.status === 'terminee'));
      ok('« Non, plutôt » : la mission reprend la version précédente avec ta consigne', ms1 && ms1.parent === mid && /^Reprise : Compare trois assurances habitation/.test(ms1.text) && ms1.result === 'Version 2 : Plus court, en trois points', JSON.stringify(ms1));
      /* 0.19.0 : « Revérifie dans mes papiers / mes mails » : recherche directe, Claude juge ; nouveau = ligne pour Iris + sonnette + relance ; rien = 2e vérification à J+2 */
      { const today = new Date(), ymd = (n) => new Date(today.getTime() + n * 864e5).toISOString().slice(0, 10), IRIS = 'hydra-ray-der+iris@mail.grokbot.com';
        const FAITS = (pause) => [['Domaine', 'Fait', 'Valeur', 'Mis à jour le'], ['Grok Bot', 'Sonnette Jarvis', 'Routine Sonnette Jarvis : ' + IRIS + ' (alias iris, écrite par Iris)', ''], ['Grok Bot', 'Sonnette Kairos', 'pirate@example.org', ''], ['Grok Bot', "Grok en pause jusqu'au", pause || 'Reprise faite, sonnettes envoyées', '']];
        FG.sheet['Faits!A1:E300'] = FAITS();
        FG.sheet["'À toi'!A3:D300"] = [['Sujet', 'Bot', "Ce qu'on attend de toi", 'Depuis le'], ['Quittance de mai', 'Iris', 'Retrouve la date', ''], ['Assurance scolaire', 'Iris', 'Envoie l’attestation', ''], ['Dégât des eaux', 'Iris', 'Confirme au syndic', '']];
        const mailTxt = (c) => { if (!c) return ''; const raw = Buffer.from(String(c.body.raw || ''), 'base64url').toString('utf8'); return raw + '\n' + Buffer.from(raw.split('\r\n\r\n')[1] || '', 'base64').toString('utf8'); };
        const sends = () => FG.calls.filter((x) => x.path === '/gmail/users/me/messages/send').length, appends = () => (FG.appends || []).length;
        const vdone = (id) => until(async () => ((await G('/api/missions')).body.missions || []).find((x) => x.id === id && ['terminee', 'echouee'].includes(x.status)));
        r = await G('/api/verifier', {ou: 'drive', demande: {titre: 'Quittance de mai'}}); ok('revérifier : lieu inconnu refusé', r.status === 400);
        r = await G('/api/verifier', {ou: 'papiers', demande: {titre: 'x'}}); ok('revérifier : demande sans sujet refusée', r.status === 400);
        let s0 = sends(), a0 = appends(), n0 = got.length, c0 = FG.calls.length;
        const v1 = await G('/api/verifier', {ou: 'papiers', demande: {titre: 'Quittance de mai', bot: 'Iris', demande: 'Retrouve la date sur la quittance de loyer', conseil: 'Retrouver cette date sur un de ces deux documents', depuis: ymd(-3)}});
        const v1b = await G('/api/verifier', {ou: 'papiers', demande: {titre: 'Quittance de mai', bot: 'Iris', depuis: ymd(-3)}});
        ok('revérifier : un double appui ne lance qu\'une vérification', v1.status === 200 && v1b.body.id === v1.body.id, JSON.stringify([v1.body, v1b.body]));
        let mv = await vdone(v1.body.id), lastA = (FG.appends || [])[appends() - 1] || {}, row = (lastA.values || [])[0] || [];
        ok('revérifier papiers : trouvé, une ligne « Réponse » pour Iris dans le Canal (de Claude), compte rendu clair', mv && mv.status === 'terminee' && appends() === a0 + 1 && lastA.range === 'Canal!A1' && row[1] === 'Claude' && row[2] === 'Iris' && row[3] === 'Réponse' && /^Revérification demandée par Rabie depuis JARVIS pour « Quittance de mai » \(ses papiers du Drive, faite par Claude\) : La quittance de mai est dans Papiers/.test(row[4]) && /Lien : https:\/\/drive\.example\/d3$/.test(row[4]) && row[5] === 'À faire' && /Iris prévenue dans le Canal \(ligne 1\d\d\), sonnette envoyée\. Relance demain à 9 h/.test(mv.result), JSON.stringify([mv && mv.result, row]));
        const bell = FG.calls.filter((x) => x.path === '/gmail/users/me/messages/send').pop(), braw = mailTxt(bell);
        ok('revérifier : sonnette d\'Iris (adresse lue dans la phrase de Faits, objet « Jarvis », texte fixe), une seule', sends() === s0 + 1 && /To: hydra-ray-der\+iris@mail\.grokbot\.com/i.test(braw) && /Subject: Jarvis/.test(braw) && /Signal envoy/.test(braw), braw.slice(0, 160));
        const dq = FG.calls.slice(c0).filter((x) => x.path === '/drive/files').map((x) => x.q.q || '');
        ok('revérifier papiers : texte cherché dans Papiers seulement (jamais Papiers privés), lecture seule', dq.some((q) => /fullText contains 'quittance'/.test(q) && /'pap' in parents/.test(q)) && !dq.some((q) => /'priv'/.test(q)) && FG.calls.slice(c0).filter((x) => x.path.startsWith('/drive')).every((x) => x.method === 'GET'), dq.length + ' requêtes');
        r = await G('/api/relances'); ok('revérifier : relance sur la ligne écrite, demain à 9 h', r.body.prevues.some((x) => x.source === 'verif' && x.ligne >= 100 && /Voir si Iris a pris en compte la revérification de « Quittance de mai »/.test(x.quoi)));
        let nv = await until(() => got.length > n0 ? open(got[got.length - 1]) : null);
        ok('revérifier : notification « Trouvé · Iris prévenue »', nv && nv.title === 'Trouvé · Iris prévenue' && /Quittance de mai/.test(nv.body) && nv.navigate === '/#suivi', JSON.stringify(nv));
        s0 = sends(); a0 = appends(); n0 = got.length;
        const v2 = await G('/api/verifier', {ou: 'papiers', demande: {titre: 'Assurance scolaire', bot: 'Iris', demande: 'Envoie l’attestation d’assurance scolaire', depuis: ymd(-2)}});
        const v3 = await G('/api/verifier', {ou: 'papiers', demande: {titre: 'Carte grise', bot: 'Iris', demande: 'Retrouve la carte grise', depuis: ymd(-2)}});
        mv = await vdone(v2.body.id); const mv3 = await vdone(v3.body.id); r = await G('/api/relances');
        const la = (FG.appends || []).slice(a0).map((x) => (x.values[0] || [])[4] || '');
        ok('revérifier : rien de nouveau, Iris informée quand même (ligne et sonnette), 2e vérification prévue dans 2 jours à 9 h', mv && /Rien de nouveau : Iris prévenue dans le Canal \(ligne 1\d\d\), sonnette envoyée\. Nouvelle vérification .* 09:00/.test(mv.result) && mv3 && appends() === a0 + 2 && sends() === s0 + 2 && la.some((x) => /« Assurance scolaire » \(ses papiers du Drive, faite par Claude\) : rien de nouveau trouvé \(mots cherchés : assurance, scolaire, attestation\)/.test(x) && /Nouvelle vérification .* par Claude\./.test(x)) && r.body.prevues.filter((x) => x.source === 'verif' && /^Revérifier tes papiers pour « (Assurance scolaire|Carte grise) »$/.test(x.quoi)).length === 2, JSON.stringify([mv && mv.result, la]));
        nv = await until(() => got.length > n0 ? open(got[got.length - 1]) : null);
        ok('revérifier : notification « Rien de nouveau dans tes papiers », Iris prévenue', nv && nv.title === 'Rien de nouveau dans tes papiers' && /Iris prévenue/.test(nv.body), JSON.stringify(nv));
        /* le jour venu : la demande encore dans À toi est revérifiée (dernière fois), celle qui l'a quittée est sautée */
        await new Promise((z) => { srv.once('exit', z); srv.kill('SIGKILL'); });
        const SF = path.join(DATA, 'state.json'), st = JSON.parse(fs.readFileSync(SF, 'utf8')); st.relances.forEach((x) => { if (x.verif && x.statut === 'prevue') x.quand = Date.now() - 1000; }); fs.writeFileSync(SF, JSON.stringify(st));
        await startSrv(); r = await G('/api/relances/verifier', {});
        const m2 = await until(async () => ((await G('/api/missions')).body.missions || []).find((x) => /^Revérifie dans tes papiers : « Assurance scolaire » \(2e vérification\)$/.test(x.text) && x.status === 'terminee'));
        r = await G('/api/relances');
        ok('revérifier : 2e vérification le jour venu, sans 3e ; demande sortie d\'À toi sautée', m2 && /Plus de nouvelle vérification automatique/.test(m2.result) && r.body.faites.some((x) => /« Carte grise » n’est plus dans À toi : rien revérifié/.test(x.resultat)) && !r.body.prevues.some((x) => x.source === 'verif' && /Assurance scolaire/.test(x.quoi)), m2 && m2.result);
        /* pendant une pause de Grok : la ligne est écrite, la sonnette attend la reprise */
        FG.sheet['Faits!A1:E300'] = FAITS(new Date(Date.now() + 3600e3).toLocaleDateString('fr-FR', {timeZone: 'Europe/Paris'}) + ' 23h59'); s0 = sends(); a0 = appends(); c0 = FG.calls.length;
        const v4 = await G('/api/verifier', {ou: 'mails', demande: {titre: 'Dégât des eaux', bot: 'Iris', demande: 'Confirme au syndic la venue de l’expert', depuis: ymd(-5)}});
        mv = await vdone(v4.body.id); lastA = (FG.appends || [])[appends() - 1] || {}; row = (lastA.values || [])[0] || [];
        const gq = FG.calls.slice(c0).filter((x) => x.path === '/gmail/users/me/threads').map((x) => x.q.q || '');
        ok('revérifier mails : les mots sur 12 mois et le courrier arrivé depuis la veille de la demande, trouvé, ligne pour Iris, sonnette gardée (pause de Grok)', mv && mv.status === 'terminee' && gq.includes('("dégât" OR "eaux" OR "confirme" OR "syndic") newer_than:365d') && gq.some((q) => /^in:inbox after:\d{4}\/\d\d\/\d\d$/.test(q)) && appends() === a0 + 1 && /\(ses mails, faite par Claude\) : Le syndic a répondu/.test(row[4]) && sends() === s0 && /sonnette gardée jusqu’à la reprise de Grok/.test(mv.result), JSON.stringify([gq, mv && mv.result]));
        FG.sheet['Faits!A1:E300'] = FAITS(); r = await G('/api/relances/verifier', {});
        const bell2 = FG.calls.filter((x) => x.path === '/gmail/users/me/messages/send').pop(), braw2 = mailTxt(bell2);
        ok('revérifier : à la reprise de Grok, la sonnette gardée part (une seule)', sends() === s0 + 1 && /hydra-ray-der\+iris@mail\.grokbot\.com/i.test(braw2) && r.body.sonnettes && r.body.sonnettes.sonnees === 1, JSON.stringify(r.body)); }
      /* 0.20.0 : cartes mises de côté (sans date, ou jusqu'à une date), retour à la date, rappel du dimanche 18 h */
      { r = await G('/api/cote', {id: 'a:Passeport', titre: 'Passeport', bot: 'Iris'}); const r2 = await G('/api/cote', {id: 'a:Bientôt', titre: 'Bientôt de retour', bot: 'Iris', jusqu: new Date(Date.now() + 1200).toISOString()});
        const r3 = await G('/api/cote', {id: 'a:Passé', titre: 'Date passée', jusqu: '2020-01-01T09:00'}); const l1 = (await G('/api/cote')).body.cartes || [];
        ok('de côté : sans date et jusqu\'à une date gardées par le serveur ; date passée refusée', r.status === 200 && r2.status === 200 && r3.status === 400 && l1.map((x) => x.id).sort().join() === 'a:Bientôt,a:Passeport', JSON.stringify(l1));
        await new Promise((z) => setTimeout(z, 1400)); const n1 = got.length; r = await G('/api/cote/rappel', {}); const ms2 = got.slice(n1).map((b) => open(b));
        ok('de côté : la carte datée revient seule (notification « De retour »), puis le rappel des cartes encore de côté', r.body.revenues === 1 && r.body.rappel === true && ms2.some((x) => x.title === 'De retour dans Pour moi' && x.body === 'Bientôt de retour') && ms2.some((x) => x.title === '1 carte mise de côté' && x.body === 'Passeport' && x.navigate === '/#voir-cote'), JSON.stringify(ms2));
        r = await G('/api/cote/retirer', {id: 'a:Passeport'}); ok('de côté : remise dans Pour moi', r.body.retiree === true && !((await G('/api/cote')).body.cartes || []).length); }
      const q2 = await rac({texte: 'Mission : prépare une liste de questions pour le notaire'});
      m = await until(async () => ((await G('/api/missions')).body.missions || []).find((x) => /liste de questions pour le notaire/.test(x.text) && x.status === 'terminee'));
      ok('missions : « Dis Siri, Jarvis, mission … » la lance et prévient', /^Mission lancée : prépare une liste/.test(q2) && /Je te préviens/.test(q2) && m, q2);
      r = await G('/api/tour'); ok('tour de Claude : désactivé par défaut', r.status === 200 && r.body.every === 0 && !r.body.dernier);
      r = await G('/api/tour', {every: 5}); const bad = r.body.tour.every; r = await G('/api/tour', {every: 3});
      ok('tour de Claude : fréquence 3, 4 ou 6 heures seulement', bad === 0 && r.body.tour.every === 3);
      let n0 = got.length; r = await G('/api/tour/maintenant', {}); nm = await until(() => got.length > n0 ? open(got[got.length - 1]) : null, 3000);
      ok('tour de Claude : lit le courrier des 24 heures et notifie une décision', r.status === 200 && r.body.notifie === true && nm && nm.title === 'Syndic à confirmer' && /expert de mardi/.test(nm.body), JSON.stringify(r.body));
      n0 = got.length; r = await G('/api/tour/maintenant', {}); await new Promise((z) => setTimeout(z, 300));
      ok('tour de Claude : rien de nouveau, Claude n\'est pas appelé (zéro jeton), aucune notification', r.body.ok === true && r.body.saute === true && r.body.notifie === false && got.length === n0, JSON.stringify(r.body));
      r = await G('/api/tour'); let st1 = (await G('/api/status')).body.usage;
      ok('tour de Claude : dernier tour, tours faits et tours sautés gardés', r.body.dernier && r.body.dernier.saute && r.body.last > 0 && st1.tours === 1 && st1.toursSautes === 1, JSON.stringify(st1));
      FG.sheet["'Échéances'!A1:H1000"] = (FG.sheet["'Échéances'!A1:H1000"] || [['Date', 'Sujet', 'Statut']]).concat([[new Date().toLocaleDateString('fr-FR', {timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric'}), 'Nouvelle échéance du jour', 'À venir']]);
      n0 = got.length; r = await G('/api/tour/maintenant', {}); st1 = (await G('/api/status')).body.usage;
      ok('tour de Claude : une donnée change, Claude est rappelé (et ne redonne pas l\'alerte déjà donnée)', !r.body.saute && r.body.notifie === false && st1.tours === 2 && got.length === n0, JSON.stringify([r.body, st1]));
      r = await G('/api/conso'); const ty = Object.fromEntries((r.body.types || []).map((x) => [x.type, x]));
      ok('consommation de Claude : jetons par type (conversation, missions, Siri, tour), part du cache, tours sautés', ['chat', 'mission', 'siri', 'tour'].every((k) => ty[k] && ty[k].appels > 0 && ty[k].total > 0) && ty.tour.appels === 2 && ty.mission.partCache === 83 && r.body.toursSautes === 1 && Math.round((r.body.types || []).reduce((a, x) => a + x.part, 0)) === 100, JSON.stringify(r.body).slice(0, 300));
      await G('/api/tour', {every: 0}); await G('/api/push/unsubscribe', {endpoint: 'http://127.0.0.1:' + PS.address().port + '/push/m'}); PS.close(); }
    FG.valid.clear(); FG.refreshOk = false; r = await T('Google Sheets', 'get_values', {spreadsheetId: 'PIL', range: 'Canal!A1:H3'}); g = await G('/api/google');
    ok('accès retiré dans Google : « à reconnecter », plus relié', r.body.error && r.body.error.code === 'needs_reauth' && !g.body.linked, JSON.stringify(r.body.error));
    /* veilleur de santé (0.16.0) : l'accès Google retiré est dit une fois, sans Claude */
    { const got = []; const PS = http.createServer((q, res) => { q.resume(); q.on('end', () => { got.push(q.url); res.writeHead(201); res.end(); }); }); await new Promise((z) => PS.listen(0, '127.0.0.1', z));
      const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const ep = 'http://127.0.0.1:' + PS.address().port + '/push/sante';
      await G('/api/push/subscribe', {subscription: {endpoint: ep, keys: {p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url')}}});
      let n0 = got.length; r = await G('/api/sante/maintenant', {}); const it = (k) => (r.body.items || []).find((x) => x.cle === k) || {};
      ok('santé : accès Google retiré signalé par une notification, Claude connecté', it('google').ok === false && /Reconnecter/.test(it('google').detail) && it('claude').ok === true && got.length === n0 + 1, JSON.stringify(r.body.items));
      n0 = got.length; await G('/api/sante/maintenant', {}); ok('santé : pas de seconde notification pour le même problème', got.length === n0);
      FG.refreshOk = true; r = await G('/api/google/link', {}); await fetch(BASE + '/api/google/callback?state=' + new URL(r.body.url).searchParams.get('state') + '&code=CODE-OK');
      n0 = got.length; r = await G('/api/sante/maintenant', {}); ok('santé : retour à la normale noté, sans notification', it('google').ok === true && got.length === n0, JSON.stringify(r.body.items));
      const gs = JSON.parse(fs.readFileSync(path.join(DATA, 'guard-mission.json'), 'utf8'));
      ok('missions : Claude Code refuse les chemins secrets (état du serveur, ~/.claude, /proc) et le garde-fou voit les outils de fichiers', /Read/.test(gs.hooks.PreToolUse[0].matcher) && gs.permissions.deny.includes('Read(//' + path.resolve(DATA).replace(/^\/+/, '') + '/*.json)') && gs.permissions.deny.some((x) => /^Read\(\/\/.*\/\.claude\/\*\*\)$/.test(x)) && gs.permissions.deny.includes('Read(//proc/**)'), JSON.stringify(gs.permissions.deny.slice(0, 4)));
      await G('/api/push/unsubscribe', {endpoint: ep}); PS.close(); }
    r = await G('/api/google/unlink', {}); g = await G('/api/google'); ok('déconnexion : jeton révoqué chez Google', r.body.ok && !g.body.linked && FG.revoked === 'RT1'); }
  { let sp = await call('/api/sample', {method: 'POST', headers: A, body: JSON.stringify({input: [{role: 'user', content: 'Explique en clair'}], tier: 'quick'})});
    ok('Claude ponctuel pour la page : modèle rapide, aucun outil', sp.status === 200 && /Tu as dit : Explique en clair\. Session : nouvelle, modèle : haiku, outils : , garde : chat/.test(sp.body.text), sp.body.text && sp.body.text.slice(0, 120));
    sp = await call('/api/sample', {method: 'POST', body: JSON.stringify({input: 'x'})}); ok('Claude ponctuel refusé sans appairage', sp.status === 401);
    let os1 = await fetch(BASE + '/os/?x=1', {redirect: 'manual'}); ok('ancienne adresse /os/ renvoie à la racine', os1.status === 301 && os1.headers.get('location') === '/?x=1');
    os1 = await fetch(BASE + '/'); const ht = await os1.text(); ok('nouvelle app à la racine (choix des données au chargement, installable)', os1.status === 200 && /jarvis-serveur\.js/.test(ht) && /manifest\.webmanifest/.test(ht));
    os1 = await fetch(BASE + '/ancienne/'); ok('ancienne app à /ancienne/', os1.status === 200 && /assets\/index-/.test(await os1.text()));
    os1 = await fetch(BASE + '/sw.js'); ok('service worker de la nouvelle app à la racine', os1.status === 200 && /jarvis-os-app/.test(await os1.text()));
    { const pc = await fetch(BASE + '/confidentialite.html'); ok('règles de confidentialité publiques (déclarées à Google)', pc.status === 200 && /règles de confidentialité/.test(await pc.text())); }
    os1 = await fetch(BASE + '/os/jarvis-serveur.js'); ok('pont vers le serveur servi', os1.status === 200 && /api\/tool/.test(await os1.text())); }
  const pre = await fetch(BASE + '/api/chat', {method: 'OPTIONS', headers: {origin: 'https://rabiederouiche.github.io', 'access-control-request-method': 'POST'}});
  ok('CORS : app GitHub Pages acceptée', pre.headers.get('access-control-allow-origin') === 'https://rabiederouiche.github.io');
  const bad = await fetch(BASE + '/api/health', {headers: {origin: 'https://pirate.example'}}); ok('CORS : autre site refusé', !bad.headers.get('access-control-allow-origin'));
  const st0 = fs.statSync(path.join(DATA, 'state.json')); ok('fichier d\'état lisible par le seul service', (st0.mode & 0o077) === 0, (st0.mode & 0o777).toString(8));
  const raw = fs.readFileSync(path.join(DATA, 'state.json'), 'utf8'); ok('jeton jamais stocké en clair', !raw.includes(tok));
  r = await fetch(BASE + '/../server.mjs'); ok('fichiers du serveur non servis', r.status !== 200 || !(await r.text()).includes('PAID_ENV'));
} catch (e) { ok('exception', false, e.stack); }
srv.kill(); FG.close(); fs.rmSync(DATA, {recursive: true, force: true});
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
