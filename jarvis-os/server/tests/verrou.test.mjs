/* Le verrou de l'app par passkey (0.75.0) : un vrai serveur JARVIS, un authentificateur écrit ici (clés P-256 et RSA, CBOR, signatures)
   pour toutes les preuves fausses, puis la vraie app dans Chromium avec son authentificateur virtuel (passkey créée, Face ID simulé).
   Lancer : node jarvis-os/server/tests/verrou.test.mjs      (sans navigateur : VERROU_SANS_NAVIGATEUR=1) */
import {spawn, execFileSync} from 'node:child_process';
import crypto from 'node:crypto'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
import {cbor} from '../verrou.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', 'server.mjs'), APP = path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-verrou-')), PORT = 22000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT, RP = '127.0.0.1';
const out = []; let rates = 0; const ok = (n, c, i) => { if (!c) rates++; out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (!c && i ? ' :: ' + i : '')); };
const pause = (ms) => new Promise((z) => setTimeout(z, ms));
const env = {...process.env, PORT: String(PORT), JARVIS_DATA: DATA, JARVIS_OS_DIR: APP, JARVIS_REPO: os.tmpdir(), JARVIS_MAJ: '0', JARVIS_HUMOUR: '0', JARVIS_VERROU_INACTIF_MS: '2500', JARVIS_VERROU_FRAIS_MS: '1500', JARVIS_COFFRE_PRISE: path.join(DATA, 'absent.sock'),
  JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_PUSH_ALLOW_HTTP: '1', CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), ANTHROPIC_API_KEY: 'sk-ant-faux-pour-le-test', ANTHROPIC_BASE_URL: 'https://exemple.invalid'};
delete env.JARVIS_PUBLIC_URL;
let srv = null, journal = '';
const lance = async (plus = {}) => { srv = spawn(process.execPath, [SRV], {env: {...env, ...plus}, stdio: ['ignore', 'pipe', 'pipe']}); srv.stdout.on('data', (d) => { journal += d; }); srv.stderr.on('data', (d) => { journal += d; }); await new Promise((z) => srv.stdout.once('data', z)); };
const arrete = () => new Promise((z) => { if (!srv) return z(); srv.once('exit', z); srv.kill('SIGKILL'); srv = null; });
const cli = (...a) => { try { return {code: 0, out: execFileSync(process.execPath, [SRV, ...a], {env, stdio: ['ignore', 'pipe', 'pipe']}).toString()}; } catch (e) { return {code: e.status, out: String(e.stdout || '') + String(e.stderr || '')}; } };
const c = async (u, o = {}) => { const x = await fetch(BASE + u, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); return {status: x.status, body: await x.json().catch(() => null)}; };
const relier = async (nom) => { const code = cli('pair').out.match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1]; return {authorization: 'Bearer ' + (await c('/api/pair', {method: 'POST', body: JSON.stringify({code, device: nom})})).body.token}; };
const post = (u, h, b) => c(u, {method: 'POST', headers: h, body: JSON.stringify(b || {})});

/* ---- un authentificateur de banc ---- */
const sha = (b) => crypto.createHash('sha256').update(b).digest(), u64 = (b) => Buffer.from(b).toString('base64url');
const tete = (t, n) => (n < 24 ? Buffer.from([(t << 5) | n]) : n < 256 ? Buffer.from([(t << 5) | 24, n]) : Buffer.from([(t << 5) | 25, n >> 8, n & 255]));
const enc = (v) => {
  if (typeof v === 'number') return v >= 0 ? tete(0, v) : tete(1, -1 - v);
  if (Buffer.isBuffer(v)) return Buffer.concat([tete(2, v.length), v]);
  if (typeof v === 'string') { const b = Buffer.from(v, 'utf8'); return Buffer.concat([tete(3, b.length), b]); }
  if (v instanceof Map) return Buffer.concat([tete(5, v.size), ...[...v].flatMap(([k, x]) => [enc(k), enc(x)])]);
  throw new Error('enc');
};
const cdj = (type, challenge, origin = BASE) => Buffer.from(JSON.stringify({type, challenge, origin, crossOrigin: false}));
const compteur = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
function passkey(genre = 'ec') {
  const paire = genre === 'ec' ? crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'}) : crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
  const j = paire.publicKey.export({format: 'jwk'}), id = crypto.randomBytes(20), b = (s) => Buffer.from(s, 'base64url');
  const cose = genre === 'ec' ? new Map([[1, 2], [3, -7], [-1, 1], [-2, b(j.x)], [-3, b(j.y)]]) : new Map([[1, 3], [3, -257], [-1, b(j.n)], [-2, b(j.e)]]);
  return {id: u64(id),
    creation(challenge, {origin = BASE, rp = RP, drapeaux = 0x45, n = 0} = {}) {
      const ad = Buffer.concat([sha(rp), Buffer.from([drapeaux]), compteur(n), Buffer.alloc(16), Buffer.from([0, id.length]), id, enc(cose)]);
      return {clientData: u64(cdj('webauthn.create', challenge, origin)), attestation: u64(enc(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', ad]]))), nom: 'Passkey du banc'};
    },
    preuve(challenge, {origin = BASE, rp = RP, drapeaux = 0x05, n = 0, cle = paire.privateKey, type = 'webauthn.get'} = {}) {
      const ad = Buffer.concat([sha(rp), Buffer.from([drapeaux]), compteur(n)]), d = cdj(type, challenge, origin);
      return {id: u64(id), clientData: u64(d), authData: u64(ad), signature: u64(crypto.sign('sha256', Buffer.concat([ad, sha(d)]), cle))};
    }};
}

let nav = null;
try {
  ok('lecteur CBOR : une table imbriquée relue à l\'identique, un contenu coupé ou trop profond refusé', (() => {
    const m = cbor(enc(new Map([['a', 1], [-2, Buffer.from('xy')], ['m', new Map([[3, -257]])]])))[0];
    let coupe = false; try { cbor(enc(Buffer.alloc(40)).subarray(0, 10)); } catch { coupe = true; }
    return m.get('a') === 1 && m.get(-2).toString() === 'xy' && m.get('m').get(3) === -257 && coupe; })());

  await lance();
  const A = await relier('iPhone un'), B = await relier('iPhone deux');
  const defi = async (h) => (await c('/api/verrou/defi', {headers: h})).body.challenge, defiC = async (h) => (await c('/api/verrou/creer', {headers: h})).body.challenge;
  const prouver = async (h, k, o) => post('/api/verrou/ouvrir', h, k.preuve(await defi(h), o));
  const etatDe = async (h) => (await c('/api/state', {headers: h})).status;

  /* 1. verrou éteint : rien ne change */
  const e0 = await c('/api/verrou', {headers: A});
  ok('verrou éteint : actif = false, ouvert = true, aucune passkey ; JARVIS répond comme avant', e0.status === 200 && e0.body.actif === false && e0.body.ouvert === true && e0.body.cles.length === 0 && await etatDe(A) === 200, JSON.stringify(e0));
  const inv = (await post('/api/invites', A, {nom: 'Invité du banc'})).body.cle, fixe = (await post('/api/mcp/jeton', A, {nom: 'Assistant du banc', profil: 'executant'})).body.jeton;
  const sans = [];
  for (const h of [{}, {authorization: 'Bearer ' + inv}, {authorization: 'Bearer ' + fixe}])
    for (const [u, m] of [['/api/verrou', 'GET'], ['/api/verrou/defi', 'GET'], ['/api/verrou/creer', 'GET'], ['/api/verrou/ouvrir', 'POST'], ['/api/verrou/activer', 'POST'], ['/api/verrou/desactiver', 'POST'], ['/api/verrou/retirer', 'POST'], ['/api/verrou/verrouiller', 'POST']])
      sans.push((await c(u, {method: m, headers: h, ...(m === 'POST' ? {body: '{}'} : {})})).status);
  ok('routes du verrou refusées (401) sans appareil relié, à un invité et à un jeton MCP', inv && fixe && sans.length === 24 && sans.every((x) => x === 401), sans.join());
  ok('activer sans passkey ni preuve : refusé (403) ; aucun défi de preuve sans passkey (404)', (await post('/api/verrou/activer', A)).status === 403 && (await c('/api/verrou/defi', {headers: A})).status === 404);

  /* 2. création : ce qui est refusé, puis la bonne */
  const K = passkey();
  const cr = [];
  cr.push((await post('/api/verrou/creer', A, K.creation(await defiC(A), {origin: 'https://autre.exemple'}))).status);          /* autre origine */
  cr.push((await post('/api/verrou/creer', A, K.creation(await defiC(A), {rp: 'autre.exemple'}))).status);                       /* autre domaine */
  cr.push((await post('/api/verrou/creer', A, K.creation(await defiC(A), {drapeaux: 0x41}))).status);                            /* sans Face ID */
  cr.push((await post('/api/verrou/creer', A, K.creation(await defiC(B)))).status);                                              /* défi d'un autre appareil */
  cr.push((await post('/api/verrou/creer', A, K.creation(u64(crypto.randomBytes(32))))).status);                                 /* défi inventé */
  cr.push((await post('/api/verrou/creer', A, {clientData: 'a', attestation: 'b'})).status);                                     /* n'importe quoi */
  const dOk = await defiC(A), bonne = K.creation(dOk), c1 = await post('/api/verrou/creer', A, bonne), c2 = await post('/api/verrou/creer', A, bonne);
  ok('création refusée (400) : autre origine, autre domaine, sans « utilisateur vérifié », défi d\'un autre appareil, défi inventé, contenu illisible', cr.join() === '400,400,400,400,400,400', cr.join());
  ok('création acceptée une fois (200), le même envoi rejoué refusé (400) ; la passkey ne compte pas avant sa première preuve', c1.status === 200 && c2.status === 400 && c1.body.cles.length === 0 && c1.body.actif === false, JSON.stringify([c1, c2.status]));

  /* 3. preuve : ce qui est refusé, puis la bonne */
  const autre = crypto.generateKeyPairSync('ec', {namedCurve: 'prime256v1'}).privateKey, pr = [];
  pr.push((await prouver(A, K, {cle: autre})).status);                    /* signée par une autre clé */
  pr.push((await prouver(A, K, {origin: 'https://autre.exemple'})).status);
  pr.push((await prouver(A, K, {rp: 'autre.exemple'})).status);
  pr.push((await prouver(A, K, {drapeaux: 0x01})).status);                /* présent mais pas vérifié (pas de Face ID) */
  pr.push((await prouver(A, K, {type: 'webauthn.create'})).status);
  pr.push((await post('/api/verrou/ouvrir', A, K.preuve(await defi(B)))).status);   /* défi d'un autre appareil */
  pr.push((await post('/api/verrou/ouvrir', A, {...K.preuve(await defi(A)), id: 'inconnue'})).status);
  const dP = await defi(A), preuve = K.preuve(dP), p1 = await post('/api/verrou/ouvrir', A, preuve), p2 = await post('/api/verrou/ouvrir', A, preuve);
  ok('preuve refusée (403) : autre clé, autre origine, autre domaine, sans Face ID, mauvais geste, défi d\'un autre appareil, passkey inconnue', pr.join() === '403,403,403,403,403,403,403', pr.join());
  ok('preuve acceptée (200, passkey comptée, preuve « récente ») ; la même preuve rejouée refusée (403)', p1.status === 200 && p1.body.cles.length === 1 && p1.body.recente === true && p2.status === 403, JSON.stringify([p1, p2.status]));

  /* 4. activation, et ce que le verrou ferme */
  ok('activer sans preuve depuis CET appareil : refusé (403)', (await post('/api/verrou/activer', B)).status === 403);
  const act = await post('/api/verrou/activer', A);
  ok('activer après la preuve : verrou actif, l\'appareil qui vient de prouver reste ouvert', act.status === 200 && act.body.actif === true && act.body.ouvert === true && await etatDe(A) === 200, JSON.stringify(act));
  const fB = await c('/api/state', {headers: B}), coffreB = await c('/api/coffre', {headers: B}), racB = (await fetch(BASE + '/api/raccourci/vocal', {headers: B})).status, vB = await c('/api/verrou', {headers: B});
  ok('l\'autre appareil relié, sans preuve : 423 « JARVIS est verrouillé. » partout (état, coffre), 401 sur le Raccourci, et il le sait (ouvert = false)',
    fB.status === 423 && fB.body.verrou === true && coffreB.status === 423 && racB === 401 && vB.status === 200 && vB.body.actif === true && vB.body.ouvert === false, JSON.stringify([fB, coffreB.status, racB, vB.body]));
  /* 0.91.0 : le dépôt de papiers est derrière le verrou comme le reste : lire, déposer, valider, retirer */
  { const pdf = Buffer.from('%PDF-1.4\n% papier inventé du banc\n%%EOF\n'), brut = (u) => fetch(BASE + u, {method: 'POST', headers: {...B, 'content-type': 'application/octet-stream'}, body: pdf}).then((x) => x.status);
    const dB = [(await c('/api/depot', {headers: B})).status, await brut('/api/depot?nom=a.pdf'), (await post('/api/depot/valider', B, {id: 'x', dossier: 'y'})).status, (await post('/api/depot/retirer', B, {id: 'x'})).status, await brut('/api/raccourci/depot?nom=a.pdf')];
    ok('0.91 : appareil verrouillé : le dépôt de papiers répond 423 (lire, déposer, valider, retirer), 401 par l\'adresse du Raccourci ; rien n\'est gardé ; l\'appareil ouvert, lui, lit le dépôt (200)',
      dB.join() === '423,423,423,423,401' && !fs.existsSync(path.join(DATA, 'depot')) && (await c('/api/depot', {headers: A})).status === 200, dB.join()); }
  ok('un appareil verrouillé ne peut ni créer une passkey, ni désactiver le verrou, ni retirer une passkey',
    (await c('/api/verrou/creer', {headers: B})).status === 423 && (await post('/api/verrou/desactiver', B)).status === 423 && (await post('/api/verrou/retirer', B, {id: act.body.cles[0].id})).status === 423);
  const oB = await prouver(B, K);
  ok('il prouve la passkey : ouvert pour lui, JARVIS répond', oB.status === 200 && oB.body.ouvert === true && await etatDe(B) === 200, JSON.stringify(oB));
  await post('/api/verrou/verrouiller', A);
  ok('« verrouiller » ne ferme que l\'appareil qui le demande', await etatDe(A) === 423 && await etatDe(B) === 200);
  ok('invités et assistants MCP ne sont pas derrière le verrou (leurs propres clés)', (await c('/mcp', {method: 'POST', headers: {authorization: 'Bearer ' + fixe}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}})})).status === 200);

  /* 5. l'ouverture tombe seule : sans demande pendant le délai (2,5 s ici, 5 min en vrai) ; chaque demande la prolonge */
  await prouver(A, K);
  const tenus = []; for (let i = 0; i < 4; i++) { await pause(1000); tenus.push(await etatDe(A)); }
  const vieux = [(await c('/api/verrou/creer', {headers: A})).status, (await post('/api/verrou/desactiver', A)).status, (await post('/api/verrou/retirer', A, {id: act.body.cles[0].id})).status, (await post('/api/verrou/activer', A)).status];
  ok('une app ouverte mais dont la preuve date (plus de 2 min en vrai, 1,5 s ici) : ni nouvelle passkey, ni désactivation, ni retrait (403), tout en restant ouverte', vieux.join() === '403,403,403,403' && await etatDe(A) === 200, vieux.join());
  await pause(3000);
  ok('une app qui parle reste ouverte (4 s de demandes espacées de 1 s) ; 3 s de silence : reverrouillée', tenus.join() === '200,200,200,200' && await etatDe(A) === 423 && (await c('/api/verrou', {headers: A})).body.ouvert === false, tenus.join());

  /* 5 bis. l'app à l'arrière-plan : le délai réglé (0.76.0) */
  await prouver(A, K);
  const d1 = await post('/api/verrou/delai', A, {delai: 120}), d2 = await post('/api/verrou/delai', A, {delai: 45}), d3 = await post('/api/verrou/delai', B, {delai: 0});
  await post('/api/verrou/cache', A); const pendant = await etatDe(A), revenu = await post('/api/verrou/retour', A);
  await prouver(A, K); const d4 = await post('/api/verrou/delai', A, {delai: 0});
  await post('/api/verrou/cache', A); const apresCache = await etatDe(A), revenu0 = await post('/api/verrou/retour', A);
  await prouver(A, K); const d5 = await post('/api/verrou/delai', A, {delai: 60});
  ok('délai d\'absence : 60 s par défaut ; réglé à 2 min après une preuve (une valeur hors liste et un appareil verrouillé sont refusés)', e0.body.delai === 60 && d1.status === 200 && d1.body.delai === 120 && d2.status === 403 && d3.status === 423 && d5.body.delai === 60, [d1.status, d2.status, d3.status, d5.status].join());
  ok('app à l\'arrière-plan, délai de 2 min : elle reste ouverte et son retour efface le compte ; délai « tout de suite » : fermée dès qu\'elle quitte l\'écran, le retour le dit',
    pendant === 200 && revenu.body.ouvert === true && d4.body.delai === 0 && apresCache === 423 && revenu0.body.ouvert === false, [pendant, revenu.body.ouvert, apresCache, revenu0.body.ouvert].join());
  /* 6. deuxième passkey (RSA), compteur, retrait */
  await prouver(A, K);
  const R = passkey('rsa'), cR = await post('/api/verrou/creer', A, R.creation(await defiC(A), {n: 3}));
  const r1 = await prouver(A, R, {n: 4}), r2 = await prouver(A, R, {n: 4}), r3 = await prouver(A, R, {n: 9});
  ok('une passkey RSA (RS256) avec compteur : preuve acceptée, le même compteur refusé (copie), un compteur plus grand accepté', cR.status === 200 && r1.status === 200 && r2.status === 403 && r3.status === 200 && r3.body.cles.length === 2, [cR.status, r1.status, r2.status, r3.status].join());
  const ids = r3.body.cles.map((x) => x.id), ret1 = await post('/api/verrou/retirer', A, {id: ids[1]}), ret2 = await post('/api/verrou/retirer', A, {id: ids[0]});
  ok('retirer une passkey sur deux : fait ; la dernière d\'un verrou actif : refusé (il s\'enfermerait dehors)', ret1.status === 200 && ret1.body.cles.length === 1 && ret2.status === 403 && ret2.body.cles.length === 1, JSON.stringify([ret1.body, ret2.status]));
  const etat = JSON.parse(fs.readFileSync(path.join(DATA, 'state.json'), 'utf8'));
  ok('state.json : le verrou et la clé PUBLIQUE de la passkey (ni clé privée, ni ouverture)', etat.verrou.actif === true && etat.verrou.cles.length === 1 && etat.verrou.cles[0].jwk.kty === 'EC' && !('d' in etat.verrou.cles[0].jwk) && !/ouverture|depuis/.test(JSON.stringify(etat.verrou)));

  /* 7. redémarrage : tout le monde reverrouillé ; secours en ligne de commande */
  await arrete(); await lance();
  ok('redémarrage du serveur : le verrou tient, toutes les ouvertures sont tombées', await etatDe(A) === 423 && await etatDe(B) === 423 && (await prouver(A, K)).status === 200 && await etatDe(A) === 200);
  const des0 = await post('/api/verrou/desactiver', B), des1 = await post('/api/verrou/desactiver', A);
  ok('désactiver : refusé à l\'appareil verrouillé, fait par celui qui vient de prouver ; l\'autre appareil rouvre sans preuve', des0.status === 423 && des1.status === 200 && des1.body.actif === false && await etatDe(B) === 200);
  await prouver(A, K); await post('/api/verrou/activer', A);
  await arrete();
  const s1 = cli('verrou', '--etat'), s2 = cli('verrou', '--retirer'), s3 = cli('verrou', '--etat'), s4 = cli('verrou');
  await lance();
  const apres = await c('/api/verrou', {headers: B});
  ok('secours `server.mjs verrou --etat | --retirer` : compte sans rien changer, puis éteint le verrou et oublie les passkeys ; sans mode : mode d\'emploi (code 2)',
    JSON.parse(s1.out).actif === true && JSON.parse(s1.out).passkeys === 1 && s2.code === 0 && JSON.parse(s3.out).actif === false && JSON.parse(s3.out).passkeys === 0 && s4.code === 2
    && apres.body.actif === false && apres.body.cles.length === 0 && await etatDe(B) === 200, s1.out + s3.out + JSON.stringify(apres.body));

  /* 8. la vraie app dans Chromium, avec son authentificateur virtuel (une passkey, « utilisateur vérifié » = Face ID) */
  if (process.env.VERROU_SANS_NAVIGATEUR !== '1') {
    await arrete(); await lance({JARVIS_VERROU_INACTIF_MS: '300000', JARVIS_VERROU_FRAIS_MS: '120000'});
    const LOC = 'http://localhost:' + PORT, jeton = A.authorization.slice(7);
    const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x') : import.meta.url); const {chromium, devices} = require('playwright');
    nav = await chromium.launch(); const ctx = await nav.newContext({...devices['iPhone 15 Pro Max']}); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
    const {authenticatorId} = await cdp.send('WebAuthn.addVirtualAuthenticator', {options: {protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true}});
    await p.addInitScript((j) => { try { if (!localStorage.getItem('jarvis.settings')) localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: j})); if (!localStorage.getItem('jarvis.reglages.onglet')) localStorage.setItem('jarvis.reglages.onglet', 'securite'); } catch (e) { /* rien */ } }, jeton);   /* Réglages, onglet « Sécurité » */
    const ecran = () => p.locator('#verrou-ecran').count(), carte = p.locator('#verrou-card');
    await p.goto(LOC + '/?serveur#reglages'); await p.waitForSelector('#verrou-card', {timeout: 20000});
    ok('carte « Verrou de l\'app » : désactivé, un bouton pour l\'activer avec une passkey', await carte.getAttribute('data-etat') === 'eteint' && /Désactivé/.test(await carte.textContent()) && await ecran() === 0, await carte.textContent());
    await carte.getByRole('button', {name: /Activer avec une passkey/}).tap();
    await p.waitForFunction(() => document.querySelector('#verrou-card').dataset.etat === 'actif', null, {timeout: 20000});
    const cles = (await cdp.send('WebAuthn.getCredentials', {authenticatorId})).credentials;
    ok('« Activer » : la passkey est créée dans l\'authentificateur puis prouvée (l\'essai), le verrou est actif', cles.length === 1 && /Activé · 1 passkey/.test(await carte.textContent()) && (await c('/api/verrou', {headers: B})).body.actif === true, await carte.textContent());
    if (process.env.VERROU_CAPTURE) { await carte.scrollIntoViewIfNeeded(); await p.screenshot({path: process.env.VERROU_CAPTURE + '-carte.png'}); }
    await p.reload(); await p.waitForSelector('#verrou-card', {timeout: 20000}); await p.waitForTimeout(1500);
    ok('un simple rechargement de la page ne redemande pas Face ID', await ecran() === 0 && await carte.getAttribute('data-etat') === 'actif');
    const verifie = (oui) => cdp.send('WebAuthn.setUserVerified', {authenticatorId, isUserVerified: oui});
    const relancer = async () => { await p.evaluate(() => sessionStorage.clear()); await p.reload(); };   /* l'app fermée puis relancée : sessionStorage repart vide */
    const quitter = (ms) => p.evaluate(async (t) => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => window.__vis || 'visible'}); window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); await new Promise((z) => setTimeout(z, t)); window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }, ms);
    /* il quitte l'app (elle prévient le serveur), puis iOS la ferme ; `preuves` : le nombre de Face ID réellement demandés à la passkey */
    const partir = async () => { await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'}); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(400); };
    const preuves = async () => (await cdp.send('WebAuthn.getCredentials', {authenticatorId})).credentials[0].signCount;
    /* a. dans le délai (1 min par défaut) : ni le retour ni la relance de l'app ne redemandent Face ID */
    const n0 = await preuves(); await partir(); await relancer(); await p.waitForSelector('#verrou-card', {timeout: 20000}); await p.waitForTimeout(1500);
    ok('app quittée puis relancée dans le délai (1 min) : aucun Face ID redemandé, elle s\'ouvre', await ecran() === 0 && await etatDe(A) === 200 && await preuves() === n0);
    await quitter(400); await p.waitForTimeout(1200);
    ok('il quitte l\'app une demi-seconde (délai : 1 min) : rien n\'est redemandé', await ecran() === 0 && await etatDe(A) === 200);
    ok('carte : les délais proposés vont de « Tout de suite » à 4 h', (await carte.locator('.verrou-delai button').allTextContents()).join() === 'Tout de suite,1 min,5 min,15 min,1 h,4 h', (await carte.locator('.verrou-delai button').allTextContents()).join());
    await carte.getByRole('button', {name: 'Tout de suite'}).tap();
    await p.waitForFunction(() => /dès que tu la quittes/.test(document.querySelector('#verrou-card .verrou-etat').textContent), null, {timeout: 20000});
    ok('carte : le délai se règle (Face ID redemandé), ici « Tout de suite »', (await c('/api/verrou', {headers: A})).body.delai === 0, await carte.textContent());
    /* b. au-delà du délai, app relancée, Face ID réussit : il part tout seul, sans toucher l'écran */
    const n1 = await preuves(); await partir(); await relancer(); await p.waitForSelector('#verrou-card', {timeout: 20000}); await p.waitForTimeout(1500);
    ok('app quittée puis relancée au-delà du délai : Face ID part tout seul (aucun toucher) et ouvre', await ecran() === 0 && await etatDe(A) === 200 && await preuves() === n1 + 1, String(await preuves() - n1));
    /* c. au-delà du délai, Face ID échoue : l'écran d'accueil reste, sans message d'erreur pour l'essai automatique ; le bouton est le secours */
    await verifie(false); await partir(); await relancer(); await p.waitForSelector('#verrou-ecran', {timeout: 20000}); await p.waitForTimeout(2500);
    ok('app relancée, Face ID sans succès : écran « JARVIS est verrouillé » par-dessus tout, aucun message pour l\'essai automatique, et le serveur refuse cet appareil (423)',
      /JARVIS est verrouillé/.test(await p.locator('#verrou-ecran').textContent()) && await p.locator('#verrou-ecran [role=status]').textContent() === '' && await etatDe(A) === 423
      && await p.evaluate(() => { const e = document.getElementById('verrou-ecran').getBoundingClientRect(); return e.width >= innerWidth && e.height >= innerHeight && document.elementFromPoint(innerWidth / 2, 40).closest('#verrou-ecran') !== null; }));
    if (process.env.VERROU_CAPTURE) await p.screenshot({path: process.env.VERROU_CAPTURE + '-ecran.png'});
    await p.locator('#verrou-ouvrir').tap(); await p.waitForFunction(() => document.querySelector('#verrou-ecran [role=status]').textContent.length > 3, null, {timeout: 20000});
    ok('bouton « Déverrouiller », Face ID refusé : l\'écran reste, un message le dit, le serveur reste fermé', await ecran() === 1 && await etatDe(A) === 423, await p.locator('#verrou-ecran').textContent());
    await verifie(true);
    await p.locator('#verrou-ouvrir').tap(); await p.waitForSelector('#verrou-card', {timeout: 20000}); await p.waitForTimeout(1500);
    ok('bouton « Déverrouiller », Face ID réussi : l\'écran part, l\'app est rechargée et ouverte', await ecran() === 0 && await etatDe(A) === 200 && await carte.getAttribute('data-etat') === 'actif');
    /* sans relance : il quitte l'app et revient, délai « tout de suite » */
    await verifie(false); await quitter(400); await p.waitForSelector('#verrou-ecran', {timeout: 20000}); await p.waitForTimeout(1500);
    ok('délai « tout de suite » : il quitte l\'app et revient, elle est verrouillée (écran, 423)', await ecran() === 1 && await etatDe(A) === 423);
    await verifie(true); await quitter(300); await p.waitForSelector('#verrou-card', {timeout: 20000}); await p.waitForTimeout(1500);
    ok('il revient sur l\'écran de verrou : Face ID repart tout seul et ouvre', await ecran() === 0 && await etatDe(A) === 200);
    /* d. verrouillé à la main : Face ID ne repart pas tout seul */
    await carte.getByRole('button', {name: 'Verrouiller maintenant'}).tap(); await p.waitForSelector('#verrou-ecran', {timeout: 20000}); await p.waitForTimeout(2000);
    ok('« Verrouiller maintenant » : écran de verrou qui reste (pas de Face ID automatique), serveur fermé pour cet appareil', await ecran() === 1 && await etatDe(A) === 423);
    await p.locator('#verrou-ouvrir').tap(); await p.waitForSelector('#verrou-card', {timeout: 20000}); await p.waitForTimeout(1000);
    await carte.getByRole('button', {name: 'Désactiver'}).tap();
    await p.waitForFunction(() => document.querySelector('#verrou-card').dataset.etat === 'eteint', null, {timeout: 20000});
    ok('« Désactiver » (Face ID redemandé) : verrou éteint pour tous les appareils', (await c('/api/verrou', {headers: B})).body.actif === false && await etatDe(B) === 200);
    await relancer(); await p.waitForSelector('#verrou-card', {timeout: 20000}); await p.waitForTimeout(1500);
    ok('verrou éteint : l\'app relancée s\'ouvre sans écran de verrou', await ecran() === 0);
    ok('aucune erreur de script dans la page', errs.length === 0, errs.join(' | '));
    await nav.close(); nav = null;
  } else out.push('–     (navigateur non lancé : VERROU_SANS_NAVIGATEUR=1)');
  ok('le journal du serveur dit les changements du verrou, sans jeton ni défi', /verrou de l’app activé/.test(journal) && /passkey « .* » prouvée/.test(journal) && !journal.includes(A.authorization.slice(7)));
} catch (e) { ok('le banc est allé au bout', false, (e && e.stack) || String(e)); }
finally { if (nav) await nav.close().catch(() => {}); await arrete(); fs.rmSync(DATA, {recursive: true, force: true}); }
console.log(out.join('\n'));
console.log('\nVerrou de l\'app : ' + out.filter((x) => x.startsWith('OK')).length + ' vérifications réussies, ' + rates + ' en échec.');
process.exit(rates ? 1 : 0);
