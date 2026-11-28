/* Banc 0.104.0 (son choix du 28/11/2026 : « fermer le mode sans écran », « plafonner les missions », et « vérifie qu'il n'y a pas d'impact
   négatif sur l'existant ») : node tests/sobre.test.mjs
   Le vrai serveur, un faux Claude Code qui répète ses options. Trois lancements :
   A. rien de réglé, Claude Code récent : aucune option de fermeture (elle est éteinte par défaut), le plafond d'une mission seulement ;
   B. JARVIS_CLAUDE_SOURCES=user : la fermeture partout, sauf pour une mission (ses skills sont dans son dossier) ; une mission arrêtée par
      son plafond le dit en français, garde ce qu'elle a écrit, note ses étapes et son coût ;
   C. un Claude Code ancien (son aide ne connaît aucune des deux options) : rien n'est passé, tout marche comme avant. */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SERVEUR = path.join(HERE, '..', 'server.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-sobre-'));
const results = []; let ko = 0;
const ok = (nom, cond, detail) => { if (!cond) ko++; results.push((cond ? 'OK    ' : 'ÉCHEC ') + nom + (cond || detail === undefined ? '' : ' :: ' + String(detail).slice(0, 700))); };
const attendre = (ms) => new Promise((z) => setTimeout(z, ms));

/* le faux Claude Code : son aide (récente ou ancienne), puis une réponse qui répète les options reçues */
const FAUX = path.join(TMP, 'faux-claude.mjs');
fs.writeFileSync(FAUX, `#!/usr/bin/env node
import fs from 'node:fs';
const a = process.argv.slice(2), out = (o) => process.stdout.write(JSON.stringify(o) + '\\n'), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
if (a[0] === '--help') { console.log('Usage: claude [options]\\n  --settings <file>\\n' + (process.env.FAUX_ANCIEN ? '' : '  --setting-sources <sources>   Comma-separated list\\n  --max-budget-usd <amount>     Maximum dollar amount\\n')); process.exit(0); }
if (a[0] === 'mcp') { console.log('Checking MCP server health…\\n'); process.exit(0); }
if (a[0] === 'auth') { console.log(JSON.stringify({loggedIn: true, authMethod: 'claude.ai'})); process.exit(0); }
if (a.includes('--setting-sources') && process.env.FAUX_ANCIEN) { process.stderr.write("error: unknown option '--setting-sources'\\n"); process.exit(1); }
if (a.includes('--max-budget-usd') && process.env.FAUX_ANCIEN) { process.stderr.write("error: unknown option '--max-budget-usd'\\n"); process.exit(1); }
let raw = ''; process.stdin.on('data', (d) => { raw += d; }); process.stdin.on('end', () => {
  const dit = 'OPTIONS sources=' + (opt('--setting-sources') || 'aucune') + ' plafond=' + (opt('--max-budget-usd') || 'aucun') + ' garde=' + (opt('--settings') ? 'oui' : 'non') + ' FIN';
  out({type: 'system', subtype: 'init', session_id: 's1', tools: []});
  out({type: 'assistant', session_id: 's1', message: {content: [{type: 'text', text: dit}]}});
  if (/EMBALLE/.test(raw) && opt('--max-budget-usd')) { out({type: 'result', subtype: 'error_max_budget_usd', is_error: true, result: '', errors: ['Reached maximum budget ($' + opt('--max-budget-usd') + ')'], num_turns: 31, total_cost_usd: 5.0213, session_id: 's1', usage: {input_tokens: 9, output_tokens: 9}}); process.exit(1); }
  out({type: 'result', subtype: 'success', is_error: false, result: dit, num_turns: 4, total_cost_usd: 0.4321, session_id: 's1', usage: {input_tokens: 9, output_tokens: 9}});
});
`, {mode: 0o755});

async function lancer(nom, plus) {
  const DATA = path.join(TMP, nom); fs.mkdirSync(DATA, {recursive: true});
  const env = {...process.env, JARVIS_DATA: DATA, JARVIS_HUMOUR: '0', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_ROUTINES_MS: '3600000', JARVIS_RADAR_TICK_MS: '3600000', JARVIS_MAJ: '0', CLAUDE_BIN: FAUX,
    JARVIS_OS_DIR: path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette'), ...plus};
  for (const k of ['JARVIS_CLAUDE_SOURCES', 'JARVIS_MISSION_BUDGET_USD', 'FAUX_ANCIEN', 'JARVIS_GOOGLE_FAKE']) if (!(k in plus)) delete env[k];
  const code = execFileSync(process.execPath, [SERVEUR, 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
  let srv = null, journal = '', BASE = '';
  for (let essai = 0; essai < 5 && !srv; essai++) {
    const PORT = 22000 + Math.floor(Math.random() * 900); BASE = 'http://127.0.0.1:' + PORT; env.PORT = String(PORT); journal = ''; let mort = false;
    const s = spawn(process.execPath, [SERVEUR], {env, stdio: ['ignore', 'pipe', 'pipe']});
    s.stdout.on('data', (d) => { journal += d; }); s.stderr.on('data', (d) => { journal += d; }); s.on('exit', () => { mort = true; });
    for (let i = 0; i < 60 && !mort; i++) { await attendre(150); try { if ((await fetch(BASE + '/api/health')).ok) { srv = s; break; } } catch { /* pas encore */ } }
    if (!srv) try { s.kill('SIGKILL'); } catch { /* rien */ }
  }
  if (!srv) throw new Error('le serveur ne démarre pas (' + nom + ') : ' + journal.slice(-300));
  const call = async (p, o = {}) => { const r = await fetch(BASE + p, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); return {status: r.status, body: await r.json().catch(() => null), texte: ''}; };
  const tok = (await call('/api/pair', {method: 'POST', body: JSON.stringify({code, device: 'banc'})})).body.token, A = {authorization: 'Bearer ' + tok};
  for (let i = 0; i < 40 && !/Claude Code : réglages fermés/.test(journal); i++) await attendre(100);   /* l'aide de Claude Code est lue au démarrage */
  const siri = async (q) => { const r = await fetch(BASE + '/api/raccourci', {method: 'POST', headers: {'content-type': 'application/json', ...A}, body: JSON.stringify({texte: q})}); return {status: r.status, texte: await r.text()}; };
  const mission = async (texte) => { const c = await call('/api/mission', {method: 'POST', headers: A, body: JSON.stringify({texte})});
    for (let i = 0; i < 80; i++) { await attendre(150); const m = ((await call('/api/missions', {headers: A})).body.missions || []).find((x) => x.text === texte); if (m && ['terminee', 'echouee'].includes(m.status)) return {...m, brut: JSON.parse(fs.readFileSync(path.join(DATA, 'state.json'), 'utf8')).missions.find((x) => x.text === texte)}; }
    return {status: 'pas finie', cree: c.status}; };
  return {siri, mission, journal: () => journal, arreter: async () => { srv.kill('SIGTERM'); await attendre(300); }};
}

try {
  /* A. rien de réglé */
  const A = await lancer('a', {});
  const a1 = await A.siri('Quelle heure est-il à Tokyo'), a2 = await A.mission('Prépare une liste de trois idées');
  ok('par défaut : la fermeture des réglages est éteinte (aucune option passée, ni à une question ni à une mission) ; le garde-fou est toujours passé ; le journal le dit',
    a1.status === 200 && /sources=aucune/.test(a1.texte) && /garde=oui/.test(a1.texte) && /sources=aucune/.test(a2.result || '') && /réglages fermés éteints \(JARVIS_CLAUDE_SOURCES=user pour les allumer\)/.test(A.journal()), JSON.stringify([a1, a2.result, A.journal().slice(-200)]));
  ok('par défaut : une mission a son plafond (5 $), une question n’en a pas ; la mission finie note ses étapes et son coût estimé',
    /plafond=aucun/.test(a1.texte) && a2.status === 'terminee' && /plafond=5 /.test(a2.result) && a2.brut.tours === 4 && a2.brut.cout === 0.432 && /plafond d’une mission : 5 \$/.test(A.journal()), JSON.stringify([a1.texte, a2.result, a2.brut && [a2.brut.tours, a2.brut.cout]]));
  await A.arreter();

  /* B. fermeture allumée, plafond réglé */
  const B = await lancer('b', {JARVIS_CLAUDE_SOURCES: 'user', JARVIS_MISSION_BUDGET_USD: '3.5'});
  const b1 = await B.siri('Quelle heure est-il à Tokyo'), b2 = await B.mission('Prépare une liste de trois idées'), b3 = await B.mission('EMBALLE toi sur ce sujet sans fin');
  ok('JARVIS_CLAUDE_SOURCES=user : une question tourne avec les seuls réglages du compte (et le garde-fou) ; une mission garde les réglages de son dossier (ses skills y sont)',
    /sources=user /.test(b1.texte) && /garde=oui/.test(b1.texte) && /sources=aucune/.test(b2.result || '') && /garde=oui/.test(b2.result || '') && /réglages fermés allumés \(user\)/.test(B.journal()), JSON.stringify([b1.texte, b2.result]));
  ok('le plafond se règle (JARVIS_MISSION_BUDGET_USD=3.5)', /plafond=3\.5 /.test(b2.result || ''), b2.result);
  ok('mission arrêtée par son plafond : « échouée », une phrase en français (le plafond, les étapes, quoi faire), ce qu’elle avait dit est gardé, ses étapes et son coût notés ; pas de message anglais ni de « s’est arrêté sans répondre »',
    b3.status === 'echouee' && /^Arrêtée : elle dépassait le plafond prévu pour une mission \(3,5 \$ au prix public, 31 étapes\)\./.test(b3.result) && /Ce qu’elle avait dit :\nOPTIONS /.test(b3.result) && !/Reached maximum|sans répondre|n'a pas pu répondre/.test(b3.result) && b3.brut.plafond === true && b3.brut.tours === 31 && b3.brut.cout === 5.021, JSON.stringify([b3.status, b3.result, b3.brut && [b3.brut.tours, b3.brut.cout]]));
  await B.arreter();
  const B0 = await lancer('b0', {JARVIS_CLAUDE_SOURCES: 'n-importe-quoi; rm -rf', JARVIS_MISSION_BUDGET_USD: '0'});
  const b4 = await B0.siri('Quelle heure est-il à Tokyo'), b5 = await B0.mission('Prépare une liste de trois idées');
  ok('une valeur inattendue de JARVIS_CLAUDE_SOURCES n’est jamais passée à Claude Code ; JARVIS_MISSION_BUDGET_USD=0 : aucun plafond', /sources=aucune/.test(b4.texte) && /plafond=aucun/.test(b5.result || '') && b5.status === 'terminee', JSON.stringify([b4.texte, b5.result]));
  await B0.arreter();

  /* C. un Claude Code ancien : il refuserait ces options (« unknown option ») ; elles ne lui sont pas passées */
  const C = await lancer('c', {FAUX_ANCIEN: '1', JARVIS_CLAUDE_SOURCES: 'user'});
  const c1 = await C.siri('Quelle heure est-il à Tokyo'), c2 = await C.mission('Prépare une liste de trois idées');
  ok('Claude Code ancien (son aide ne connaît ni l’une ni l’autre) : rien n’est passé, une question et une mission marchent comme avant ; le journal le dit',
    c1.status === 200 && /sources=aucune plafond=aucun/.test(c1.texte) && c2.status === 'terminee' && /sources=aucune plafond=aucun/.test(c2.result) && /réglages fermés inconnus de cette version ; plafond d’une mission : inconnu de cette version/.test(C.journal()), JSON.stringify([c1, c2.status, c2.result, C.journal().slice(-200)]));
  await C.arreter();
} catch (e) { ok('exception', false, (e && e.stack) || e); }
fs.rmSync(TMP, {recursive: true, force: true});
console.log(results.join('\n')); console.log(ko ? ko + ' échec(s) sur ' + results.length + ' vérifications' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(ko ? 1 : 0);
