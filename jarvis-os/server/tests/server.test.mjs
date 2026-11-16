/* Banc du serveur : node tests/server.test.mjs (aucun vrai Claude, aucun coût). */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-'));
const PORT = 18000 + Math.floor(Math.random() * 1000), BASE = 'http://127.0.0.1:' + PORT;
const env = {...process.env, PORT: String(PORT), JARVIS_DATA: DATA, CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), ANTHROPIC_API_KEY: 'sk-ant-faux-pour-le-test', ANTHROPIC_BASE_URL: 'https://exemple.invalid', JARVIS_ORIGINS: 'https://rabiederouiche.github.io', JARVIS_REPO: os.tmpdir(), JARVIS_TTS_HELPER: path.join(HERE, 'fake-tts.mjs'), JARVIS_VOICE_MODEL: path.join(HERE, 'fake-tts.mjs'), JARVIS_VOICE_SCRIPT: path.join(DATA, 'fausse-install.sh')};
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const code = execFileSync(process.execPath, [path.join(HERE, '..', 'server.mjs'), 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
const srv = spawn(process.execPath, [path.join(HERE, '..', 'server.mjs')], {env, stdio: ['ignore', 'pipe', 'pipe']});
srv.stderr.on('data', (d) => process.stderr.write(d));
await new Promise((r) => srv.stdout.once('data', r));
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
  r = await call('/api/missions/m-claude', {method: 'POST', headers: A, body: JSON.stringify({status: 'approuvee'})}); ok('mission Claude lancée', ['envoyee', 'approuvee'].includes(r.body.mission.status));
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
  const pre = await fetch(BASE + '/api/chat', {method: 'OPTIONS', headers: {origin: 'https://rabiederouiche.github.io', 'access-control-request-method': 'POST'}});
  ok('CORS : app GitHub Pages acceptée', pre.headers.get('access-control-allow-origin') === 'https://rabiederouiche.github.io');
  const bad = await fetch(BASE + '/api/health', {headers: {origin: 'https://pirate.example'}}); ok('CORS : autre site refusé', !bad.headers.get('access-control-allow-origin'));
  const st0 = fs.statSync(path.join(DATA, 'state.json')); ok('fichier d\'état lisible par le seul service', (st0.mode & 0o077) === 0, (st0.mode & 0o777).toString(8));
  const raw = fs.readFileSync(path.join(DATA, 'state.json'), 'utf8'); ok('jeton jamais stocké en clair', !raw.includes(tok));
  r = await fetch(BASE + '/../server.mjs'); ok('fichiers du serveur non servis', r.status !== 200 || !(await r.text()).includes('PAID_ENV'));
} catch (e) { ok('exception', false, e.stack); }
srv.kill(); fs.rmSync(DATA, {recursive: true, force: true});
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
