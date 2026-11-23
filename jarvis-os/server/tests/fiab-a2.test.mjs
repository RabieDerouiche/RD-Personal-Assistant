/* Banc 0.70.0 (lot A2, routeur du serveur) : node tests/fiab-a2.test.mjs (aucun vrai Claude, aucun vrai Google, aucun coût).
   Adresses mal formées, redirection /os/, bancs non servis, corps des requêtes (UTF-8, trop gros, null), cache des sons (vides, coupés,
   ménage), programme de la voix (bloqué, entrée fermée), messages vocaux d'une invitée (413, envois simultanés, échecs comptés),
   mission approuvée qui échoue, textes du guide et des outils MCP. Prénoms et textes inventés. */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), SERVEUR = process.env.FIAB_A2_SERVEUR || path.join(HERE, '..', 'server.mjs');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-a2-')), OUTILS = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-a2-outils-'));
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info && !cond ? ' :: ' + info : '')); if (!cond) fails++; };
const attends = (ms) => new Promise((z) => setTimeout(z, ms));

/* une fausse voix Pierre pilotée par un fichier « mode » : ok, vide-echec, vide-ok, muet, meurt ; au lancement, « ferme » : entrée fermée,
   « lent » : la voix met 1,5 s à se charger (comme Piper sur un petit serveur) */
fs.writeFileSync(path.join(OUTILS, 'voix-essai.mjs'), `import fs from 'node:fs'; import path from 'node:path';
const D = process.env.FIAB_TTS_DIR, mode = () => { try { return fs.readFileSync(path.join(D, 'mode'), 'utf8').trim(); } catch { return 'ok'; } };
const wav = (t) => { const d = Buffer.from('RIFF-faux:' + t, 'utf8'), h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + d.length, 4); h.write('WAVE', 8); return Buffer.concat([h, d]); };
fs.appendFileSync(path.join(D, 'lancements'), 'x\\n');
const go = () => {
  console.log(JSON.stringify({ready: true})); let buf = '';
  process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let r; try { r = JSON.parse(line); } catch { continue; }
    fs.appendFileSync(path.join(D, 'requetes'), r.out + '\\n'); const m = mode();
    if (m === 'muet') continue;
    if (m === 'meurt') process.exit(3);
    if (m === 'vide-echec' || m === 'vide-ok') { fs.writeFileSync(r.out, ''); console.log(JSON.stringify({id: r.id, ok: m === 'vide-ok'})); continue; }
    fs.writeFileSync(r.out, wav(r.text)); console.log(JSON.stringify({id: r.id, ok: true})); } });
};
if (mode() === 'ferme') { fs.closeSync(0); setTimeout(() => process.exit(0), 4000); } else if (mode() === 'lent') setTimeout(go, 1500); else go();
`);
fs.writeFileSync(path.join(OUTILS, 'fausse-voix.onnx'), 'faux');
const MODE = (m) => fs.writeFileSync(path.join(OUTILS, 'mode'), m), lancements = () => { try { return fs.readFileSync(path.join(OUTILS, 'lancements'), 'utf8').split('\n').filter(Boolean).length; } catch { return 0; } };
MODE('ok');
/* faux Google Text-to-Speech : un vrai en-tête WAV et le texte ; « COURT » : un son sans contenu (15 octets) */
const GV = {n: 0};
const GVS = http.createServer(async (q, res) => { let b = ''; for await (const c of q) b += c; res.writeHead(200, {'content-type': 'application/json'});
  if (q.url.startsWith('/v1/voices')) return res.end(JSON.stringify({voices: [{name: 'fr-FR-Chirp3-HD-Charon'}]}));
  GV.n++; const t = ((JSON.parse(b || '{}').input) || {}).text || '';
  if (/COURT/i.test(t)) return res.end(JSON.stringify({audioContent: Buffer.from('RIFF-trop-court').toString('base64')}));
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.write('WAVE', 8); res.end(JSON.stringify({audioContent: Buffer.concat([h, Buffer.from('GOOGLE:' + t)]).toString('base64')})); });
await new Promise((z) => GVS.listen(0, '127.0.0.1', z));

/* le cache des sons avant le démarrage : un vieux son (40 jours), un reste coupé (2 h), un reste en cours, deux sons récents (6 Ko chacun,
   plafond du banc 10 Ko), un fichier qui n'est pas un son */
const TTSD = path.join(DATA, 'tts'); fs.mkdirSync(TTSD, {recursive: true});
const vieux = (f, jours, octets = 100) => { fs.writeFileSync(path.join(TTSD, f), Buffer.alloc(octets, 1)); const d = new Date(Date.now() - jours * 864e5); fs.utimesSync(path.join(TTSD, f), d, d); };
vieux('vieux.wav', 40); vieux('reste.wav.ab12.part', 2 / 24); vieux('frais.wav.cd34.part', 0); vieux('recent-a.wav', 3, 6000); vieux('recent-b.wav', 1, 6000); vieux('note.txt', 40);

const env = {...process.env, JARVIS_DATA: DATA, JARVIS_HUMOUR: '0', JARVIS_PUSH_ALLOW_HTTP: '1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_ROUTINES_MS: '3600000', JARVIS_RADAR_TICK_MS: '3600000', JARVIS_VOIX_BUDGET_MS: '3600000', JARVIS_MAJ: '0',
  CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), ANTHROPIC_API_KEY: 'sk-ant-faux-pour-le-test', ANTHROPIC_BASE_URL: 'https://exemple.invalid', JARVIS_REPO: OUTILS, JARVIS_OS_DIR: path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette'),
  JARVIS_TTS_HELPER: path.join(OUTILS, 'voix-essai.mjs'), JARVIS_VOICE_MODEL: path.join(OUTILS, 'fausse-voix.onnx'), FIAB_TTS_DIR: OUTILS, JARVIS_TTS_ATTENTE_MS: '900', JARVIS_TTS_MENAGE_MS: '300', JARVIS_TTS_MAX_MO: '0.01',
  JARVIS_VOIX_GOOGLE_URL: 'http://127.0.0.1:' + GVS.address().port, JARVIS_STT_HELPER: path.join(HERE, 'fake-stt.mjs'), JARVIS_TOUR_HELPER: path.join(HERE, 'fake-tour.mjs'),
  JARVIS_AUDIO_PY: process.execPath, JARVIS_AUDIO_HELPER: path.join(HERE, 'fake-audio.mjs'), JARVIS_FFMPEG: ''};
delete env.JARVIS_GOOGLE_FAKE;
const code = execFileSync(process.execPath, [SERVEUR, 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
let journal = '', mort = null, srv = null, PORT = 0, BASE = '';
/* d'autres bancs tournent peut-être en même temps : un port déjà pris, on en essaie un autre */
for (let essai = 0; essai < 5 && !srv; essai++) {
  PORT = 21000 + Math.floor(Math.random() * 900); BASE = 'http://127.0.0.1:' + PORT; env.PORT = String(PORT); journal = ''; mort = null;
  const s = spawn(process.execPath, [SERVEUR], {env, stdio: ['ignore', 'pipe', 'pipe']});
  s.stdout.on('data', (d) => { journal += d; }); s.stderr.on('data', (d) => { journal += d; });
  s.on('exit', (c, sig) => { mort = c === null ? sig : c; });
  await new Promise((z) => { s.stdout.once('data', z); s.once('exit', z); });
  if (mort === null) srv = s;
}
if (!srv) { console.log('ÉCHEC serveur pas démarré :: ' + journal.slice(-400)); process.exit(1); }
const call = async (p, o = {}) => { try { const r = await fetch(BASE + p, {redirect: 'manual', ...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { j = null; } return {status: r.status, body: j, texte: t, headers: r.headers}; } catch (e) { return {status: 0, erreur: String(e.cause && e.cause.code || e.message)}; } };
/* une requête brute : chemin tel quel, corps en plusieurs morceaux (pause entre deux), réponse lue même avant la fin de l'envoi */
const brut = (methode, chemin, {headers = {}, morceaux = [], pause = 0, finir = true} = {}) => new Promise((resolve) => {
  let fini = false; const q = http.request({host: '127.0.0.1', port: PORT, method: methode, path: chemin, headers}, (r) => { const ch = []; r.on('data', (d) => ch.push(d)); r.on('end', () => { fini = true; resolve({status: r.statusCode, headers: r.headers, texte: Buffer.concat(ch).toString('utf8'), q}); if (!finir) q.destroy(); }); });
  q.on('error', (e) => { if (!fini) resolve({status: 0, erreur: e.code || e.message}); });
  (async () => { for (const m of morceaux) { if (fini) return; q.write(m); if (pause) await attends(pause); } if (finir) q.end(); })();
});
const sante = async () => (await call('/api/health')).status === 200 && mort === null;

try {
  /* ---------- ménage du cache des sons (au démarrage, plafond 10 Ko) ---------- */
  await attends(900);
  const reste = new Set(fs.readdirSync(TTSD));
  ok('cache des sons : le ménage du démarrage efface un son vieux de 40 jours et un reste coupé de 2 h, puis le plus ancien au-delà du plafond ; garde le reste en cours, le son récent et ce qui n’est pas un son',
    !reste.has('vieux.wav') && !reste.has('reste.wav.ab12.part') && !reste.has('recent-a.wav') && reste.has('recent-b.wav') && reste.has('frais.wav.cd34.part') && reste.has('note.txt'), JSON.stringify([...reste]));

  /* ---------- adresses mal formées : plus d'arrêt du serveur, 400 au lieu de 500 ---------- */
  { const r1 = await brut('GET', '//'), r2 = await brut('GET', '//%'), r3 = await brut('GET', '//['), vivant = await sante();
    ok('adresse « // » (et « //% », « //[ ») : 400 « Adresse invalide. », le serveur reste debout (elle l’arrêtait)', [r1, r2, r3].every((r) => r.status === 400 && /Adresse invalide/.test(r.texte)) && vivant, JSON.stringify([r1.status, r2.status, r3.status, vivant, mort]));
    const m1 = await call('/%E0%A4%A'), m2 = await call('/ancienne/%00x'), m3 = await call('/maquettes/ux/%00x');
    ok('adresse mal encodée : 400 (pas 500) ; un caractère nul : 400, ou 404 dans les maquettes', m1.status === 400 && /Adresse invalide/.test(m1.body && m1.body.error) && m2.status === 400 && m3.status === 404, JSON.stringify([m1.status, m1.body, m2.status, m3.status])); }

  /* ---------- /os/ : jamais vers un autre site ---------- */
  { const a = await call('/os//site-externe.example/connexion'), b = await brut('GET', '/os/\\site-externe.example/x'), c = await brut('GET', '/os///site-externe.example'), d = await call('/os'), e = await call('/os/'), f = await call('/os/?x=1'), g = await call('/os/jarvis-serveur.js');
    ok('/os//autre-site : renvoie sur JARVIS (« /site-externe.example/… »), jamais vers un autre domaine ; /os, /os/, /os/?x=1 et /os/fichier inchangés',
      a.status === 301 && a.headers.get('location') === '/site-externe.example/connexion' && b.status === 301 && b.headers.location === '/site-externe.example/x' && c.headers.location === '/site-externe.example'
      && d.headers.get('location') === '/' && e.headers.get('location') === '/' && f.headers.get('location') === '/?x=1' && g.headers.get('location') === '/jarvis-serveur.js',
      JSON.stringify([a.headers.get('location'), b.headers.location, c.headers.location, d.headers.get('location'), e.headers.get('location'), f.headers.get('location'), g.headers.get('location')])); }

  /* ---------- les bancs ne sont pas servis ; la page, oui ---------- */
  { const st = await Promise.all(['/banc/banc.cjs', '/banc/banc-serveur.mjs', '/banc%2faudit.cjs', '/banc/', '/ancienne/banc/banc.cjs'].map((u) => call(u).then((x) => x.status)));
    const pg = await Promise.all(['/', '/sw.js', '/invite/', '/confidentialite.html', '/jarvis-serveur.js', '/manifest.webmanifest'].map((u) => call(u).then((x) => x.status)));
    ok('bancs d’essai (banc/) : 404, comme pour /maquettes/ ; la page, son service worker, la page invitée et les règles de confidentialité : 200', st.every((s) => s === 404) && pg.every((s) => s === 200), JSON.stringify([st, pg])); }

  /* ---------- appairage ---------- */
  const pr = await call('/api/pair', {method: 'POST', body: JSON.stringify({code, device: 'Banc A2'})}), tok = pr.body && pr.body.token, A = {authorization: 'Bearer ' + tok};
  ok('appareil relié (banc)', pr.status === 200 && !!tok);
  { const x = await call('/api/adresse-qui-n-existe-pas', {headers: A}); ok('adresse d’API inconnue : 404 « Adresse inconnue du serveur. » (au lieu de « Inconnu. »)', x.status === 404 && x.body && x.body.error === 'Adresse inconnue du serveur.', JSON.stringify([x.status, x.body])); }

  /* ---------- corps des requêtes ---------- */
  { const n = await call('/api/mission', {method: 'POST', headers: A, body: 'null'});
    ok('corps « null » : traité comme vide (« Mission vide. », 400), plus une erreur du serveur', n.status === 400 && /Mission vide/.test(n.body && n.body.error), JSON.stringify([n.status, n.body]));
    const g = await call('/api/memoire', {method: 'POST', headers: A, body: JSON.stringify({texte: 'x'.repeat(70000)})}), vivant = await sante();
    ok('corps trop gros (70 000 caractères) : 413 « Requête trop grosse. » (la connexion était coupée sans réponse)', g.status === 413 && g.body && g.body.error === 'Requête trop grosse.' && vivant, JSON.stringify([g.status, g.body, g.erreur]));
    const phrase = 'Il préfère le thé à la menthe', corps = Buffer.from(JSON.stringify({texte: phrase})), i = corps.indexOf(Buffer.from('é')) + 1;
    const u = await brut('POST', '/api/memoire', {headers: {...A, 'content-type': 'application/json', 'content-length': corps.length}, morceaux: [corps.subarray(0, i), corps.subarray(i)], pause: 150});
    const items = ((JSON.parse(u.texte || '{}') || {}).items || []).map((x) => x.texte);
    ok('UTF-8 : un « é » coupé entre deux morceaux du corps reste un « é » (il devenait « �� »)', u.status === 200 && items.includes(phrase) && !items.some((x) => x.includes('\uFFFD')), JSON.stringify([u.status, items])); }

  /* ---------- import : filtre ; une mission approuvée qui échoue ne fait plus tomber le serveur ---------- */
  { const at = Date.now(), im = await call('/api/import', {method: 'POST', headers: A, body: JSON.stringify({msgs: [{text: 'Bonjour (message importé, inventé)', role: 'user', at}], missions: [
      {id: 'mission-bloquee', agent: 'claude', status: 'a_approuver', text: 'Comparer deux offres inventées', at, priority: 'normale'},
      {id: 'texte-nombre', agent: 'claude', status: 'a_approuver', text: 123, at},
      {id: '../evasion', agent: 'claude', status: 'a_approuver', text: 'Sortir du dossier de travail', at}], remplissage: 'y'.repeat(120000)})});
    const st = (await call('/api/state', {headers: A})).body || {}, ids = (st.missions || []).map((x) => x.id);
    ok('import de l’ancienne app : plus de 64 000 caractères acceptés ; une mission sans texte ou à l’identifiant douteux n’entre pas', im.status === 200 && ids.join() === 'mission-bloquee' && (st.msgs || []).length === 1, JSON.stringify([im.status, ids]));
    fs.mkdirSync(path.join(DATA, 'work'), {recursive: true}); fs.writeFileSync(path.join(DATA, 'work', 'mission-bloquee'), 'un fichier à la place de son dossier');   /* mkdir échouera */
    const ap = await call('/api/missions/mission-bloquee', {method: 'POST', headers: A, body: JSON.stringify({status: 'approuvee'})});
    let m = null; for (let k = 0; k < 20 && !(m && m.status === 'echouee'); k++) { await attends(100); m = (((await call('/api/state', {headers: A})).body || {}).missions || []).find((x) => x.id === 'mission-bloquee'); }
    const vivant = await sante();
    ok('mission approuvée qui échoue en partant (dossier impossible) : « en échec » avec la raison, le serveur reste debout (il s’arrêtait)', ap.status === 200 && vivant && m && m.status === 'echouee' && /EEXIST|ENOTDIR|exist/i.test(m.result || ''), JSON.stringify([ap.status, vivant, mort, m && m.status, m && m.result])); }

  /* ---------- textes : guide de Claude, outils MCP, revérification ---------- */
  { /* « montre le contexte » : le faux Claude renvoie la consigne qu'il a reçue (celle de la page, puis le guide de JARVIS) */
    const s = await call('/api/sample', {method: 'POST', headers: A, body: JSON.stringify({input: 'Où je règle le brief du matin ? montre le contexte', system: 'Consigne du banc.'})}), ctx = String((s.body && s.body.text) || '');
    ok('guide de Claude : les routines sont dans « Espaces, Équipe, filtre « Routines » », plus dans le menu « Tout » retiré', s.status === 200 && /Consigne du banc\./.test(ctx) && /Routines et brief du matin : Espaces, Équipe, filtre « Routines »/.test(ctx) && !/« Tout », Automatisations/.test(ctx), JSON.stringify([s.status, s.body && s.body.error, ctx.length]));
    const jf = await call('/api/mcp/jeton', {method: 'POST', headers: A, body: JSON.stringify({nom: 'Banc'})}), J = {authorization: 'Bearer ' + (jf.body && jf.body.jeton), accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18'};
    const rpc = (method, params, id) => call('/mcp', {method: 'POST', headers: J, body: JSON.stringify({jsonrpc: '2.0', id, method, params})});
    const li = await rpc('tools/list', {}, 1), pm = await rpc('tools/call', {name: 'jarvis_proposer_mission', arguments: {texte: 'Comparer trois forfaits inventés'}}, 2), po = await rpc('tools/call', {name: 'jarvis_proposer_ordre', arguments: {bot: 'kairos', message: 'Surveiller un prix inventé'}}, 3);
    const desc = ((li.body && li.body.result && li.body.result.tools) || []).filter((x) => /proposer/.test(x.name)).map((x) => x.description).join(' '), tm = pm.body && pm.body.result && pm.body.result.content[0].text, to = po.body && po.body.result && po.body.result.content[0].text;
    ok('outils MCP : la proposition attend « dans JARVIS (Espaces, Équipe, filtre Demandes, « Missions de Claude ») », plus dans « Suivi » (rubrique absorbée)', /Équipe, filtre Demandes, « Missions de Claude »/.test(tm || '') && /Équipe, filtre Demandes/.test(to || '') && /attend son accord/.test(tm || '') && desc.length > 50 && !/Suivi/.test(desc + tm + to), JSON.stringify([tm, to]));
    const src = fs.readFileSync(SERVEUR, 'utf8'), par = '(annulable dans Espaces, Équipe, filtre Demandes, « Relances »)';
    ok('revérification : « annulable dans Espaces, Équipe, filtre Demandes, « Relances » » (plus « Suivi, Relances »), et la même parenthèse retirée du message pour le bot', !src.includes('(annulable dans Suivi') && src.split(par).length === 3); }

  /* ---------- cache des sons de Pierre ---------- */
  const T = async (text) => { const r = await fetch(BASE + '/api/tts', {method: 'POST', headers: {...A, 'content-type': 'application/json'}, body: JSON.stringify({text})}).catch(() => null); if (!r) return {status: 0, b: Buffer.alloc(0)}; return {status: r.status, voix: r.headers.get('x-jarvis-voix'), b: Buffer.from(await r.arrayBuffer())}; };
  const sons = () => fs.readdirSync(TTSD).filter((f) => f !== 'recent-b.wav' && f !== 'note.txt' && f !== 'frais.wav.cd34.part');
  const fichierDe = (marque) => sons().map((f) => path.join(TTSD, f)).find((f) => fs.readFileSync(f).includes(marque));
  { MODE('vide-echec'); const a = await T('Phrase un du banc.'); await attends(100); const s1 = sons();
    MODE('vide-ok'); const b = await T('Phrase un du banc.'); await attends(100); const s2 = sons();
    ok('voix : une synthèse ratée (fichier vide, réponse en échec ou « ok ») : 500 et rien gardé dans le cache (ni son vide, ni reste)', a.status === 500 && b.status === 500 && s1.length === 0 && s2.length === 0, JSON.stringify([a.status, b.status, s1, s2]));
    MODE('ok'); const c = await T('Phrase un du banc.'), f = fichierDe('RIFF-faux:');
    ok('voix : ensuite la même phrase est bien synthétisée et gardée (pas un son vide resservi pour toujours)', c.status === 200 && /RIFF-faux:/.test(c.b.toString()) && !!f && fs.statSync(f).size > 44 && !sons().some((x) => x.endsWith('.part')), JSON.stringify([c.status, sons()]));
    const d10 = new Date(Date.now() - 10 * 864e5); fs.utimesSync(f, d10, d10); MODE('vide-echec');
    const d = await T('Phrase un du banc.');
    ok('voix : une phrase déjà dite est relue du cache et marquée récente (le ménage garde les phrases redites)', d.status === 200 && d.b.equals(c.b) && Date.now() - fs.statSync(f).mtimeMs < 60000, JSON.stringify([d.status, fs.statSync(f).mtime]));
    fs.truncateSync(f, 20); MODE('ok'); const nq = fs.readFileSync(path.join(OUTILS, 'requetes'), 'utf8').split('\n').length;
    const e = await T('Phrase un du banc.');
    ok('voix : un son coupé dans le cache (20 octets) n’est pas resservi : il est refait', e.status === 200 && e.b.equals(c.b) && fs.readFileSync(path.join(OUTILS, 'requetes'), 'utf8').split('\n').length === nq + 1, JSON.stringify([e.status, e.b.length])); }

  /* ---------- programme de la voix bloqué, mort, entrée fermée ---------- */
  { MODE('ok'); await T('Phrase zéro du banc.'); const l0 = lancements(); MODE('muet'); const t0 = Date.now(), a = await T('Phrase deux du banc.'), dt = Date.now() - t0;
    MODE('ok'); const b = await T('Phrase deux du banc.');
    ok('voix : un programme qui ne répond plus est arrêté au bout du délai, la phrase suivante en relance un et passe (elle échouait jusqu’au redémarrage)', a.status === 500 && dt < 5000 && b.status === 200 && /Phrase deux/.test(b.b.toString()) && lancements() === l0 + 1, JSON.stringify([a.status, dt, b.status, l0, lancements()]));
    MODE('meurt'); const c0 = await T('Phrase trois du banc.');
    MODE('lent'); const l2 = lancements(), g1 = await T('Phrase lente du banc.'); await attends(1000); MODE('ok'); const g2 = await T('Phrase lente du banc.');
    ok('voix : un premier chargement lent (plus long que le délai) n’est pas interrompu : la phrase d’après passe avec le même programme', c0.status === 500 && g1.status === 500 && g2.status === 200 && /Phrase lente/.test(g2.b.toString()) && lancements() === l2 + 1, JSON.stringify([c0.status, g1.status, g2.status, l2, lancements()]));
    for (const x of fs.readdirSync(TTSD)) if (x.endsWith('.part') && x !== 'frais.wav.cd34.part') fs.rmSync(path.join(TTSD, x), {force: true});   /* la réponse tardive a écrit un reste (effacé par le ménage en vrai) */
    MODE('meurt'); const c = await T('Phrase trois bis du banc.');
    MODE('ferme'); const l1 = lancements(), p1 = T('Phrase quatre du banc.'); await attends(1000); const p2 = T('Phrase cinq du banc.'); const [d, e] = await Promise.all([p1, p2]); await attends(200);
    const vivant = await sante();
    MODE('ok'); let f = await T('Phrase six du banc.'); if (f.status !== 200) f = await T('Phrase six du banc.');   /* machine très chargée : l'entrée fermée tardivement */
    ok('voix : programme mort puis programme qui ferme son entrée : les phrases échouent proprement (500), le serveur reste debout (EPIPE l’arrêtait), puis la voix revient',
      c.status === 500 && d.status === 500 && e.status === 500 && vivant && f.status === 200 && /Phrase six/.test(f.b.toString()) && lancements() >= l1 + 2 && !/EPIPE/.test(journal), JSON.stringify([c.status, d.status, e.status, vivant, mort, f.status, l1, lancements()])); }

  /* ---------- cache des sons de Google (clé inventée) ---------- */
  { const k = await call('/api/voix/google/cle', {method: 'POST', headers: A, body: JSON.stringify({cle: 'AIzaFAUX0123456789abcdefghijklmnopq'})});
    const n0 = GV.n, a = await T('Bonjour de Google.'), fg = fichierDe('GOOGLE:Bonjour de Google.');
    ok('voix Google : la clé vérifiée, la phrase dite par Google et gardée (écrite à côté puis renommée, aucun reste)', k.status === 200 && k.body.verifie === true && a.status === 200 && a.voix === 'google' && /GOOGLE:Bonjour de Google\./.test(a.b.toString()) && GV.n === n0 + 1 && !!fg && !sons().some((x) => x.endsWith('.part')), JSON.stringify([k.status, k.body && k.body.verifie, a.status, a.voix, GV.n - n0]));
    const b = await T('Bonjour de Google.'); fs.truncateSync(fg, 10); const c = await T('Bonjour de Google.');
    ok('voix Google : relue du cache sans rappeler Google ; un son coupé (10 octets) est redemandé au lieu d’être resservi', b.status === 200 && b.voix === 'google' && c.status === 200 && /GOOGLE:Bonjour de Google\./.test(c.b.toString()) && GV.n === n0 + 2, JSON.stringify([b.voix, c.status, GV.n - n0]));
    const avant = sons().length, d = await T('Son COURT de Google.'); await attends(100);
    ok('voix Google : un son sans contenu renvoyé par Google n’est pas gardé ; Pierre dit la phrase', d.status === 200 && d.voix === 'pierre' && /RIFF-faux:/.test(d.b.toString()) && !sons().some((x) => x.endsWith('.part') || fs.statSync(path.join(TTSD, x)).size <= 44) && sons().length === avant + 1, JSON.stringify([d.status, d.voix, sons().length - avant]));
    const E = () => fetch(BASE + '/api/voix/google/essai', {method: 'POST', headers: {...A, 'content-type': 'application/json'}, body: '{}'}).then(async (x) => ({status: x.status, b: Buffer.from(await x.arrayBuffer())}));
    const e1 = await E(), fe = fichierDe('Voici comment je sonne'), n1 = GV.n; fs.truncateSync(fe, 0); const e2 = await E();
    ok('voix Google, « Écouter » : un essai coupé dans le cache est redemandé', e1.status === 200 && e1.b.length > 44 && e2.status === 200 && e2.b.equals(e1.b) && GV.n === n1 + 1, JSON.stringify([e1.status, e2.status, GV.n - n1]));
    await call('/api/voix/google', {method: 'POST', headers: A, body: JSON.stringify({voixServeur: 'pierre'})}); }

  /* ---------- messages vocaux d'une invitée ---------- */
  { const cr = await call('/api/invites', {method: 'POST', headers: A, body: JSON.stringify({nom: 'Zoé'})}), IV = {authorization: 'Bearer ' + (cr.body && cr.body.cle), 'content-type': 'application/octet-stream'};
    const g1 = await brut('POST', '/api/invite/vocal', {headers: {...IV, 'content-length': 26000000}, morceaux: [Buffer.alloc(1000)], finir: false});
    ok('vocal : annoncé à plus de 25 Mo, refusé avant d’être lu : 413 « Message trop long. » (Siri entendait une coupure)', g1.status === 413 && g1.texte === 'Message trop long.', JSON.stringify([g1.status, g1.texte, g1.erreur]));
    const Mo = Buffer.alloc(1e6, 7), g2 = await brut('POST', '/api/invite/vocal', {headers: {...IV, 'transfer-encoding': 'chunked'}, morceaux: Array.from({length: 26}, () => Mo)});
    ok('vocal : envoyé sans taille annoncée et au-delà de 25 Mo : la réponse « Message trop long. » arrive quand même', g2.status === 413 && g2.texte === 'Message trop long.' && await sante(), JSON.stringify([g2.status, g2.texte, g2.erreur]));
    const lent = () => { let q; const pr = new Promise((resolve) => { q = http.request({host: '127.0.0.1', port: PORT, method: 'POST', path: '/api/invite/vocal', headers: {...IV, 'content-length': 300}}, (r) => { let t = ''; r.on('data', (d) => { t += d; }); r.on('end', () => resolve({status: r.statusCode, texte: t})); }); q.on('error', (e) => resolve({status: 0, erreur: e.code})); q.write(Buffer.alloc(100, 65)); }); return {pr, fin: () => q.end(Buffer.alloc(200, 65))}; };
    const l1 = lent(), l2 = lent(); await attends(300);
    const t3 = await call('/api/invite/vocal', {method: 'POST', headers: IV, body: Buffer.alloc(200, 66)});
    l1.fin(); l2.fin(); const [r1, r2] = await Promise.all([l1.pr, l2.pr]);
    const t4 = await call('/api/invite/vocal', {method: 'POST', headers: IV, body: Buffer.alloc(200, 66)});
    ok('vocal : deux envois à la fois au plus par invitée (le 3e : 429 « déjà en cours d’envoi ») ; une fois finis, la place est rendue', t3.status === 429 && /déjà en cours d’envoi/.test(t3.texte) && r1.status === 415 && r2.status === 415 && t4.status === 415, JSON.stringify([t3.status, t3.texte, r1.status, r2.status, t4.status]));
    const c2 = await call('/api/invites', {method: 'POST', headers: A, body: JSON.stringify({nom: 'Inès'})}), IV2 = {authorization: 'Bearer ' + (c2.body && c2.body.cle), 'content-type': 'application/octet-stream'};
    const st = []; for (let i = 0; i < 30; i++) st.push((await call('/api/invite/vocal', {method: 'POST', headers: IV2, body: Buffer.alloc(120, 67)})).status);
    const t31 = await call('/api/invite/vocal', {method: 'POST', headers: IV2, body: Buffer.alloc(120, 67)}), tt = await call('/api/invite/tache', {method: 'POST', headers: {...IV2, 'content-type': 'application/json'}, body: JSON.stringify({texte: 'Une tâche inventée'})});
    ok('vocal : les envois refusés (son illisible) comptent aussi dans les 30 par heure : le 31e est refusé (429)', st.every((s) => s === 415) && t31.status === 429 && /Trop de tâches en une heure/.test(t31.texte) && tt.status === 429, JSON.stringify([st.filter((s) => s !== 415), t31.status, tt.status])); }

  /* ---------- une vraie erreur est écrite dans le journal (méthode et chemin, sans la clé) ---------- */
  { fs.renameSync(TTSD, TTSD + '-de-cote'); fs.writeFileSync(TTSD, 'un fichier à la place du dossier des sons');
    const a = await T('Phrase sept du banc.'); await attends(200);
    const ligne = journal.split('\n').find((l) => l.startsWith('[jarvis] POST /api/tts : ')) || '';
    ok('erreur du serveur : 500 « Erreur du serveur. » et une ligne « [jarvis] POST /api/tts : … » dans le journal, sans le jeton', a.status === 500 && !!ligne && !journal.includes(tok), ligne.slice(0, 160) || journal.slice(-300));
    fs.rmSync(TTSD, {force: true}); fs.renameSync(TTSD + '-de-cote', TTSD); }
  ok('le serveur est resté debout pendant tout le banc', await sante(), String(mort));
} catch (e) { ok('exception', false, e.stack); }
srv.kill(); GVS.close();
fs.rmSync(DATA, {recursive: true, force: true}); fs.rmSync(OUTILS, {recursive: true, force: true});
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
