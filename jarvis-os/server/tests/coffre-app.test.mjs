/* Le coffre en mémoire vu depuis JARVIS (0.74.0) : un VRAI service jarvis-coffre (dossiers temporaires, dérivation raccourcie), un vrai
   serveur JARVIS relié à sa prise de service, et la carte « Coffre » de Réglages dans Chromium.
   Lancer : node jarvis-os/server/tests/coffre-app.test.mjs      (sans navigateur : COFFRE_APP_SANS_NAVIGATEUR=1)
   Les phrases sont inventées. Ce qui est vérifié : l'état à chaque stade, l'ouverture par la phrase scellée (le serveur de JARVIS ne voit
   que le paquet), les refus (mauvaise phrase, paquet rejoué, forme, taille, sans session, invité, jeton MCP), « Verrouiller », le coffre
   absent, et la phrase introuvable dans les requêtes, les journaux et les fichiers. */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import net from 'node:net'; import os from 'node:os'; import path from 'node:path';
import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
import {scellerPhrase} from '../../coffre/sceller.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', 'server.mjs'), DEMON = path.join(HERE, '..', '..', 'coffre', 'coffre.mjs');
const APP = path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-coffre-app-')), DATA = path.join(T, 'jarvis'), PRISES = path.join(T, 'p'), FICHIER = path.join(T, 'etat', 'coffre.json');
for (const d of [DATA, PRISES, path.dirname(FICHIER)]) fs.mkdirSync(d, {recursive: true, mode: 0o700});
const PORT = 21000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT;
const PHRASE = 'phrase inventée du banc, quarante caractères et plus : 0123456789', FAUSSE = 'une autre phrase inventée, tout aussi longue, mais fausse : 987';
const out = []; let rates = 0; const ok = (n, c, i) => { if (!c) rates++; out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (!c && i ? ' :: ' + i : '')); };
const pause = (ms) => new Promise((z) => setTimeout(z, ms));
const journaux = {coffre: '', jarvis: ''};

/* une ligne JSON sur une prise du coffre, une ligne en réponse */
const prise = (chemin, demande) => new Promise((resolve) => { let b = ''; const c = net.createConnection(chemin); c.on('error', () => resolve(null)); c.on('connect', () => c.write(JSON.stringify(demande) + '\n'));
  c.on('data', (d) => { b += d; const i = b.indexOf('\n'); if (i >= 0) { c.destroy(); try { resolve(JSON.parse(b.slice(0, i))); } catch { resolve(null); } } }); });
let coffre = null;
const lanceCoffre = async () => {
  coffre = spawn(process.execPath, [DEMON], {stdio: ['ignore', 'pipe', 'pipe'], env: {PATH: process.env.PATH, COFFRE_FICHIER: FICHIER, COFFRE_PRISES: PRISES, COFFRE_SCRYPT_N: '4096', COFFRE_FREIN_MS: '40'}});
  coffre.stdout.on('data', (d) => { journaux.coffre += d; }); coffre.stderr.on('data', (d) => { journaux.coffre += d; });
  for (let i = 0; i < 100; i++) { if (await prise(path.join(PRISES, 'service.sock'), {commande: 'etat'})) return; await pause(50); }
  throw new Error('le coffre du banc ne démarre pas : ' + journaux.coffre);
};
const arreteCoffre = () => new Promise((z) => { if (!coffre) return z(); coffre.once('exit', z); coffre.kill('SIGTERM'); coffre = null; });

const env = {...process.env, PORT: String(PORT), JARVIS_DATA: DATA, JARVIS_COFFRE_PRISE: path.join(PRISES, 'service.sock'), JARVIS_OS_DIR: APP, JARVIS_REPO: os.tmpdir(), JARVIS_MAJ: '0', JARVIS_HUMOUR: '0',
  JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_PUSH_ALLOW_HTTP: '1', CLAUDE_BIN: path.join(HERE, 'fake-claude.mjs'), ANTHROPIC_API_KEY: 'sk-ant-faux-pour-le-test', ANTHROPIC_BASE_URL: 'https://exemple.invalid'};
const appairer = () => execFileSync(process.execPath, [SRV, 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
const c = async (u, o = {}) => { const x = await fetch(BASE + u, {...o, headers: {'content-type': 'application/json', ...(o.headers || {})}}); return {status: x.status, body: await x.json().catch(() => null)}; };

let srv = null, nav = null;
try {
  /* 1. coffre absent : JARVIS marche, la carte n'a rien à montrer */
  const code = appairer();
  srv = spawn(process.execPath, [SRV], {env, stdio: ['ignore', 'pipe', 'pipe']}); srv.stdout.on('data', (d) => { journaux.jarvis += d; }); srv.stderr.on('data', (d) => { journaux.jarvis += d; });
  await new Promise((z) => srv.stdout.once('data', z));
  const jeton = (await c('/api/pair', {method: 'POST', body: JSON.stringify({code, device: 'iPhone du banc'})})).body.token, A = {authorization: 'Bearer ' + jeton};
  const e0 = await c('/api/coffre', {headers: A}), k0 = await c('/api/coffre/cle', {headers: A}), f0 = await c('/api/coffre/fermer', {method: 'POST', headers: A, body: '{}'});
  ok('coffre pas installé : état {installe: false} sans erreur, la clé et « fermer » répondent 503, le reste de JARVIS répond',
    e0.status === 200 && e0.body.installe === false && Object.keys(e0.body).length === 1 && k0.status === 503 && f0.status === 503 && (await c('/api/state', {headers: A})).status === 200, JSON.stringify([e0, k0.status, f0.status]));

  /* 2. coffre installé, pas encore créé, puis créé (donc ouvert), deux secrets, puis verrouillé par l'app */
  await lanceCoffre();
  const e1 = (await c('/api/coffre', {headers: A})).body;
  ok('coffre installé mais pas créé : installe, existe = false, fermé, 0 secret', e1.installe === true && e1.existe === false && e1.ouvert === false && e1.secrets === 0 && e1.bloque === 0, JSON.stringify(e1));
  const admin = path.join(PRISES, 'admin.sock');
  await prise(admin, {commande: 'creer', phrase: PHRASE});
  await prise(admin, {commande: 'mettre', nom: 'jarvis-essai', portee: 'service', valeur: 'valeur-secrete-du-banc-1'});
  await prise(admin, {commande: 'mettre', nom: 'site-essai', portee: 'guichet', valeur: 'valeur-secrete-du-banc-2'});
  const e2 = await c('/api/coffre', {headers: A});
  ok('coffre ouvert : ouvert, depuis une date, 2 secrets comptés ; ni leur nom ni leur valeur ne sortent',
    e2.body.ouvert === true && !isNaN(new Date(e2.body.depuis)) && e2.body.secrets === 2 && !/essai|valeur-secrete/.test(JSON.stringify(e2.body)), JSON.stringify(e2.body));
  const f1 = await c('/api/coffre/fermer', {method: 'POST', headers: A, body: '{}'});
  ok('« Verrouiller » : le coffre est fermé (200, ouvert = false), les secrets restent comptés', f1.status === 200 && f1.body.ouvert === false && f1.body.existe === true && f1.body.secrets === 2, JSON.stringify(f1));

  /* 3. refus d'accès : sans session, invité, jeton MCP */
  const inv = (await c('/api/invites', {method: 'POST', headers: A, body: JSON.stringify({nom: 'Invité du banc'})})).body.cle;
  const fixe = (await c('/api/mcp/jeton', {method: 'POST', headers: A, body: JSON.stringify({nom: 'Assistant du banc', profil: 'executant'})})).body.jeton;
  const refus = [];
  for (const h of [{}, {authorization: 'Bearer ' + inv}, {authorization: 'Bearer ' + fixe}, {authorization: 'Bearer nimporte'}])
    for (const [u, m] of [['/api/coffre', 'GET'], ['/api/coffre/cle', 'GET'], ['/api/coffre/ouvrir', 'POST'], ['/api/coffre/fermer', 'POST']])
      refus.push((await c(u, {method: m, headers: h, ...(m === 'POST' ? {body: '{}'} : {})})).status);
  ok('les quatre routes refusent (401) : sans session, clé d\'invité, jeton fixe MCP, jeton inconnu', inv && fixe && refus.length === 16 && refus.every((x) => x === 401), refus.join());

  /* 4. ouverture scellée par l'API : forme, taille, mauvaise phrase, bonne phrase, rejeu */
  const cle = async () => (await c('/api/coffre/cle', {headers: A})).body;
  const formes = [];
  for (const b of [{}, {epk: 'a', iv: 'b'}, {epk: 'a b', iv: 'b', ct: 'c'}, {epk: 'A'.repeat(101), iv: 'b', ct: 'c'}, {epk: 'a', iv: 'b', ct: 'C'.repeat(6001)}, {epk: 1, iv: 2, ct: 3}])
    formes.push((await c('/api/coffre/ouvrir', {method: 'POST', headers: A, body: JSON.stringify(b)})).status);
  const gros = await c('/api/coffre/ouvrir', {method: 'POST', headers: A, body: JSON.stringify({epk: 'a', iv: 'b', ct: 'C'.repeat(9000)})});
  ok('paquet mal formé : 400, sans appel au coffre ; corps trop gros : 413', formes.every((x) => x === 400) && gros.status === 413, formes.join() + ' ' + gros.status);
  const k1 = await cle(), mauvais = await c('/api/coffre/ouvrir', {method: 'POST', headers: A, body: JSON.stringify(await scellerPhrase(FAUSSE, k1.cle, k1.defi))});
  ok('mauvaise phrase : 403 « Ouverture refusée. », le coffre reste verrouillé', mauvais.status === 403 && mauvais.body.error === 'Ouverture refusée.' && mauvais.body.ouvert === false, JSON.stringify(mauvais));
  const k2 = await cle(), paquet = await scellerPhrase(PHRASE, k2.cle, k2.defi);
  ok('la clé du coffre : un point P-256 (65 octets), un défi neuf à chaque demande', Buffer.from(k2.cle, 'base64url').length === 65 && Buffer.from(k2.defi, 'base64url').length === 32 && k2.defi !== k1.defi, JSON.stringify(k2));
  const bon = await c('/api/coffre/ouvrir', {method: 'POST', headers: A, body: JSON.stringify(paquet)});
  ok('bonne phrase scellée : 200, coffre ouvert ; le paquet ne contient pas la phrase', bon.status === 200 && bon.body.ouvert === true && !JSON.stringify(paquet).includes(PHRASE.slice(0, 12)), JSON.stringify(bon));
  await c('/api/coffre/fermer', {method: 'POST', headers: A, body: '{}'});
  const rejeu = await c('/api/coffre/ouvrir', {method: 'POST', headers: A, body: JSON.stringify(paquet)});
  ok('le même paquet rejoué après un verrouillage : refusé (403), le coffre reste verrouillé', rejeu.status === 403 && rejeu.body.ouvert === false, JSON.stringify(rejeu));

  /* 5. une seule source pour le module de la page */
  ok('sceller.mjs de l\'app est la copie exacte de celui du coffre, et le serveur le sert en JavaScript',
    fs.readFileSync(path.join(APP, 'sceller.mjs'), 'utf8') === fs.readFileSync(path.join(HERE, '..', '..', 'coffre', 'sceller.mjs'), 'utf8')
    && /javascript/.test((await fetch(BASE + '/sceller.mjs')).headers.get('content-type') || ''));

  /* 6. la carte « Coffre » dans Chromium */
  if (process.env.COFFRE_APP_SANS_NAVIGATEUR !== '1') {
    const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x') : import.meta.url); const {chromium, devices} = require('playwright');
    nav = await chromium.launch(); const ctx = await nav.newContext({...devices['iPhone 15 Pro Max']}); const p = await ctx.newPage();
    const errs = [], envois = []; p.on('pageerror', (e) => errs.push(e.message));
    p.on('request', (r) => { if (r.url().startsWith(BASE)) envois.push(r.url() + ' ' + (r.postData() || '')); });
    await p.addInitScript((j) => { try { localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: j})); } catch (e) { /* rien */ } }, jeton);
    /* 0.78.0 : Réglages en onglets. « Général » d'abord ; le coffre, verrouillé, met un point sur « Sécurité » ; l'onglet choisi est retenu ;
       un lien direct vers une carte ouvre son onglet ; « Tout » rend la page entière. */
    await p.goto(BASE + '/?serveur#reglages'); await p.waitForSelector('.set-tabs', {timeout: 20000});
    const carte = p.locator('#coffre-card'), onglet = (nom) => p.locator('.set-tabs [role=tab]', {hasText: nom}), choisi = () => p.locator('.set-tabs [role=tab][aria-selected=true]').textContent();
    const vus = () => p.evaluate(() => [...document.querySelectorAll('#view section[data-onglet]')].filter((x) => !x.hidden).map((x) => (x.querySelector('b, h2') || {}).textContent));
    const v0 = await vus();
    ok('Réglages : six onglets (plus de « Tout »), « Général » ouvert (serveur, version, état des systèmes) ; le coffre et les assistants reliés sont rangés ailleurs ; un point sur « Sécurité » (coffre verrouillé)',
      (await p.locator('.set-tabs [role=tab]').allTextContents()).join() === 'Général,Sécurité,Connexions,Voix,Alertes,Mémoire' && await choisi() === 'Général' && v0.includes('Serveur JARVIS') && v0.includes('JARVIS') && v0.includes('État des systèmes')
      && !v0.includes('Coffre') && !v0.includes('Assistants reliés (MCP)') && await carte.isHidden() && await onglet('Sécurité').locator('.set-tab-pt').count() === 1 && await onglet('Général').locator('.set-tab-pt').count() === 0, JSON.stringify(v0));
    await onglet('Sécurité').tap(); const v1 = await vus();
    ok('onglet « Sécurité » : le verrou de l\'app et le coffre, rien d\'autre', v1.slice().sort().join() === 'Coffre,Verrou de l’app' && await carte.isVisible(), JSON.stringify(v1));
    await onglet('Voix').tap(); const v2 = await vus();
    ok('onglet « Voix » : la voix du serveur, la voix et l\'écoute (sorties de la carte JARVIS), le tour de Claude', v2.some((t) => /^Voix du serveur/.test(t)) && v2.includes('Voix et écoute') && v2.every((t) => /^(Voix|Tour de Claude)/.test(t)), JSON.stringify(v2));
    ok('la carte « JARVIS » ne propose plus l\'ancienne app', await p.locator('a[href="/ancienne/"]').count() === 0);
    await onglet('Général').tap(); await p.goto(BASE + '/?serveur#voir-reglages-mcp'); await p.waitForSelector('#mcp-card', {timeout: 20000}); await p.waitForTimeout(1500);
    ok('depuis « Général », un lien direct vers une carte (assistants reliés) ouvre son onglet, « Connexions »', await choisi() === 'Connexions' && await p.locator('#mcp-card').isVisible() && await carte.isHidden(), await choisi());
    await onglet('Sécurité').tap(); await p.reload(); await p.waitForSelector('#coffre-card', {timeout: 20000});
    ok('l\'onglet choisi est retenu après un rechargement', await choisi() === 'Sécurité');
    await p.evaluate(() => localStorage.setItem('jarvis.banc.reglages', 'entier')); await p.reload(); await p.waitForSelector('#mcp-card', {timeout: 20000});
    ok('pour le banc de bout en bout seulement (« jarvis.banc.reglages ») : la page entière, toutes les cartes visibles', (await vus()).length >= 10 && await carte.isVisible());
    await p.evaluate(() => localStorage.removeItem('jarvis.banc.reglages')); await p.reload(); await p.waitForSelector('#coffre-card', {timeout: 20000});
    if (process.env.COFFRE_APP_CAPTURE) { await carte.scrollIntoViewIfNeeded(); await p.screenshot({path: process.env.COFFRE_APP_CAPTURE}); }   /* pour relire la carte à l'œil */
    ok('carte « Coffre » dans Réglages : « Verrouillé », un champ de mot de passe rempli par le gestionnaire (current-password) et sa fiche (username)',
      /Verrouillé · 2 secrets/.test(await carte.textContent()) && await carte.locator('input[type=password][autocomplete=current-password]').count() === 1 && await carte.locator('input[autocomplete=username]').inputValue() === 'Coffre JARVIS', await carte.textContent());
    await carte.locator('input[type=password]').fill(FAUSSE); await carte.locator('button[type=submit]').tap();
    await p.waitForFunction(() => /refusée/.test(document.querySelector('#coffre-card .set-msg').textContent), null, {timeout: 20000});
    ok('mauvaise phrase dans la carte : « Ouverture refusée. », champ vidé, toujours verrouillé', await carte.getAttribute('data-etat') === 'verrouille' && await carte.locator('input[type=password]').inputValue() === '', await carte.textContent());
    await carte.locator('input[type=password]').fill(PHRASE); await carte.locator('button[type=submit]').tap();
    await p.waitForFunction(() => document.querySelector('#coffre-card').dataset.etat === 'ouvert', null, {timeout: 20000});
    const reel = await prise(path.join(PRISES, 'service.sock'), {commande: 'etat'});
    ok('bonne phrase dans la carte : « Ouvert depuis… », le coffre est réellement ouvert, plus de champ de phrase', /Ouvert depuis le .*2 secrets/.test(await carte.textContent()) && reel.ouvert === true && await carte.locator('input[type=password]').count() === 0, await carte.textContent());
    ok('aucune requête de la page ne porte une phrase en clair (ni la bonne ni la fausse), et rien dans le stockage de l\'app',
      envois.some((x) => x.includes('/api/coffre/ouvrir')) && !envois.some((x) => x.includes(PHRASE.slice(0, 14)) || x.includes(FAUSSE.slice(0, 14)))
      && !(await p.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + location.href)).includes('phrase invent'), String(envois.length));
    await carte.getByRole('button', {name: 'Verrouiller'}).tap();
    await p.waitForFunction(() => document.querySelector('#coffre-card').dataset.etat === 'verrouille', null, {timeout: 20000});
    ok('« Verrouiller » dans la carte : le coffre est réellement fermé, le champ revient', (await prise(path.join(PRISES, 'service.sock'), {commande: 'etat'})).ouvert === false && await carte.locator('input[type=password]').count() === 1);
    ok('aucune erreur de script dans la page', errs.length === 0, errs.join(' | '));
    await nav.close(); nav = null;
  } else out.push('–     (navigateur non lancé : COFFRE_APP_SANS_NAVIGATEUR=1)');

  /* 7. blocage après trop d'essais ratés (5), dit à l'app ; puis le coffre arrêté : la carte n'a plus rien */
  let dernier = null;
  for (let i = 0; i < 6; i++) { const k = await cle(); dernier = await c('/api/coffre/ouvrir', {method: 'POST', headers: A, body: JSON.stringify(await scellerPhrase(FAUSSE, k.cle, k.defi))}); }
  const eb = (await c('/api/coffre', {headers: A})).body, kb = await cle(), bloque = await c('/api/coffre/ouvrir', {method: 'POST', headers: A, body: JSON.stringify(await scellerPhrase(PHRASE, kb.cle, kb.defi))});
  ok('cinq phrases fausses : le coffre se bloque, l\'état le dit (minutes restantes), même la bonne phrase est refusée pendant le blocage',
    eb.bloque > 0 && eb.ouvert === false && bloque.status === 403 && /bloqué encore \d+ min/.test(bloque.body.error) && dernier.status === 403, JSON.stringify([eb, bloque.body]));
  await arreteCoffre();
  const ef = await c('/api/coffre', {headers: A});
  ok('service du coffre arrêté : état {installe: false}, JARVIS répond toujours', ef.status === 200 && ef.body.installe === false && (await c('/api/state', {headers: A})).status === 200, JSON.stringify(ef));

  /* 8. rien de secret dans les journaux ni dans les fichiers */
  const fichiers = []; const parcourir = (d) => { for (const f of fs.readdirSync(d, {withFileTypes: true})) { const x = path.join(d, f.name); if (f.isDirectory()) parcourir(x); else if (f.isFile()) fichiers.push(x); } }; parcourir(T);
  const tout = journaux.coffre + journaux.jarvis + fichiers.map((f) => fs.readFileSync(f, 'latin1')).join('\n');
  ok('ni phrase (bonne ou fausse) ni valeur de secret dans les journaux du coffre et de JARVIS, ni dans aucun fichier du banc (' + fichiers.length + ' fichiers)',
    fichiers.length > 1 && ![PHRASE.slice(0, 14), FAUSSE.slice(0, 14), 'valeur-secrete-du-banc'].some((x) => tout.includes(x) || tout.includes(Buffer.from(x, 'utf8').toString('latin1'))));
} catch (e) { ok('le banc est allé au bout', false, (e && e.stack) || String(e)); }
finally {
  if (nav) await nav.close().catch(() => {});
  if (srv) srv.kill('SIGKILL');
  await arreteCoffre();
  fs.rmSync(T, {recursive: true, force: true});
}
console.log(out.join('\n'));
console.log('\nCoffre depuis JARVIS : ' + (out.filter((x) => x.startsWith('OK')).length) + ' vérifications réussies, ' + rates + ' en échec.');
process.exit(rates ? 1 : 0);
