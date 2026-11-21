/* Banc de bout en bout : vrai serveur JARVIS (faux Claude, faux Google) et la nouvelle app dans Chromium.
   Relier l'iPhone par code, enregistrer l'accès Google, se connecter, tester les données, page en direct.
   Lancer : NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-maquette/banc/banc-serveur.mjs */
import crypto from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x') : import.meta.url); const {chromium, devices} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), SRV = path.join(HERE, '..', '..', '..', 'jarvis-os', 'server'), SH = path.join(os.tmpdir(), 'jarvis-os-banc') + path.sep; fs.mkdirSync(SH, {recursive: true});
const {startFakeGoogle} = await import(SRV + '/tests/fake-google.mjs'); const FG = await startFakeGoogle();
FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['15/11/2026', 'Rabie', 'Iris', 'Info', 'Le syndic a appelé.', 'Fait', 'Noté.', '']];
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-e2e-')), PORT = 19000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT;
/* 0.40.0 : faux Google Text-to-Speech (clé d'API) */
const GV = {calls: []}; const GVS = (await import('node:http')).createServer(async (q, res) => { let b = ''; for await (const c of q) b += c; GV.calls.push({url: q.url, key: q.headers['x-goog-api-key'] || ''}); res.writeHead(200, {'content-type': 'application/json'});
  if (q.url.startsWith('/v1/voices')) return res.end(JSON.stringify({voices: [{name: 'fr-FR-Chirp3-HD-Charon'}, {name: 'fr-FR-Chirp3-HD-Aoede'}]}));
  const j = JSON.parse(b || '{}'), h = Buffer.alloc(44); h.write('RIFF', 0); h.write('WAVE', 8); res.end(JSON.stringify({audioContent: Buffer.concat([h, Buffer.from('GOOGLE:' + ((j.voice || {}).name || '') + ':' + ((j.input || {}).text || ''))]).toString('base64')})); });
await new Promise((z) => GVS.listen(0, '127.0.0.1', z)); GVS.unref();   /* le banc se termine sans attendre ce faux serveur */
const env = {...process.env, JARVIS_VOIX_GOOGLE_URL: 'http://127.0.0.1:' + GVS.address().port, JARVIS_PUSH_ALLOW_HTTP: '1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_GOOGLE_FAKE: FG.url, PORT: String(PORT), JARVIS_DATA: DATA, CLAUDE_BIN: SRV + '/tests/fake-claude.mjs', JARVIS_TTS_HELPER: SRV + '/tests/fake-tts.mjs', JARVIS_STT_HELPER: SRV + '/tests/fake-stt.mjs', JARVIS_TOUR_HELPER: SRV + '/tests/fake-tour.mjs', JARVIS_RD_RACINE: 'rda', JARVIS_VOICE_MODEL: path.join(DATA, 'fausse-voix.onnx'), JARVIS_MAJ: '0'};   /* 0.27.0 : pas de question de mise à jour pendant le banc (elle a son essai à part, sur un dépôt de test) */
fs.mkdirSync(DATA, {recursive: true}); fs.writeFileSync(path.join(DATA, 'fausse-voix.onnx'), 'faux');   /* 0.25.0 : la voix Pierre « installée » (fausse), pour la lecture des réponses */
const code = execFileSync(process.execPath, [SRV + '/server.mjs', 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
const srv = spawn(process.execPath, [SRV + '/server.mjs'], {env, stdio: ['ignore', 'pipe', 'pipe']}); await new Promise((r) => srv.stdout.once('data', r));
const out = [], errs = []; const ok = (n, c, i) => out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (i ? ' :: ' + i : ''));
const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']}); const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); const p = await ctx.newPage();
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
  /* 0.32.0 : l'écoute du serveur est Whisper (faux moteur du banc) : Réglages le dit et propose de passer à Parakeet */
  { const e = await p.evaluate(() => ({txt: document.querySelector('.set-wrap').textContent, btn: (document.getElementById('set-ecoute') || {}).textContent || ''}));
    ok('Réglages : écoute du serveur nommée (Whisper) et « Passer à Parakeet » proposé', /écoute Whisper prête/.test(e.txt) && /Passer à Parakeet/.test(e.btn) && /conversation continue/.test(e.txt) && /L’orbe/.test(e.txt), e.btn); }
  await p.tap('button:has-text("Tester mes données")'); await p.waitForTimeout(1500);
  const t = await p.evaluate(() => document.querySelector('.set-card .set-msg').textContent); ok('test des données : Pilotage lu par le serveur', /Pilotage lu : 1 ligne dans/.test(t), t);
  await p.screenshot({path: SH + 'set-2.png'});
  const before = FG.calls.length;
  await p.goto(BASE + '/?serveur'); await p.waitForTimeout(6000);
  const used = FG.calls.slice(before).map((c) => c.path.replace(/\/v4\/spreadsheets\/[^/]+\/values\//, ' values ').replace(/^\/(\w+).*?(values .*|events|threads|drafts).*$/, '$1 $2'));
  const uniq = [...new Set(used)];
  ok('page en direct : Pilotage, agenda et Gmail lus par l’accès Google', uniq.some((u) => /sheets values Canal/.test(u)) && uniq.some((u) => /calendar events/.test(u)) && uniq.some((u) => /gmail threads/.test(u)), uniq.length + ' sources : ' + uniq.slice(0, 8).join(' | '));
  ok('aucune donnée d’exemple chargée', await p.evaluate(() => !document.querySelector('script[src="donnees-fictives.js"]')));
  /* Radar (21/11/2026) : le serveur répond, la rubrique Argent apparaît ; sa première ouverture lit les mails (faux Google : 3 factures inventées) */
  { await p.tap('.fav-handle').catch(() => p.click('.fav-handle')); await p.waitForTimeout(600);
    ok('Radar : le serveur répond, la rubrique Argent est dans « Toutes les rubriques »', await p.evaluate(() => !!document.querySelector('.all-grid .tab[data-tab="argent"]')));
    await p.evaluate(() => { const c = document.querySelector('.all-close'); if (c) c.click(); }); await p.waitForTimeout(400); }
  await p.screenshot({path: SH + 'os-live.png'});
  { await p.goto(BASE + '/?serveur#argent'); await p.waitForTimeout(9000);
    const a1 = await p.evaluate(() => ({props: [...document.querySelectorAll('.rad-prop')].map((x) => x.innerText.replace(/\s+/g, ' ')), defaut: !!document.querySelector('.rad-paie-defaut'), big: (document.querySelector('.rad-big') || {}).textContent || ''}));
    ok('Radar (serveur) : la première ouverture lit les mails ; la facture mensuelle inventée devient une dépense à valider (48,20 € le 12) ; la paie pas encore réglée est signalée', a1.props.length === 1 && /Énergie Exemple/.test(a1.props[0]) && /le 12 de chaque mois/.test(a1.props[0]) && /48,20 €/.test(a1.props[0]) && a1.defaut, JSON.stringify(a1));
    await p.evaluate(() => { const b = document.querySelector('.rad-prop .row-actions button'); if (b) b.click(); }); await p.waitForTimeout(1500);
    const a2 = await p.evaluate(() => ({props: document.querySelectorAll('.rad-prop').length, rules: [...document.querySelectorAll('.rad-rule')].map((x) => x.innerText.replace(/\s+/g, ' '))}));
    await p.reload(); await p.waitForTimeout(4000);
    const a3 = await p.evaluate(() => document.querySelectorAll('.rad-rule').length);
    ok('Radar (serveur) : « Ajouter » la garde sur le serveur (« lu dans tes mails »), toujours là après un rechargement', a2.props === 0 && a2.rules.length === 1 && /Énergie Exemple/.test(a2.rules[0]) && /lu dans tes mails/.test(a2.rules[0]) && a3 === 1, JSON.stringify([a2, a3]));
    /* 0.46.0 : l'app plantait à l'ouverture d'Argent : chaque rendu relançait une lecture du serveur, sans fin */
    { let n = 0; const compte = (r) => { try { if (new URL(r.url()).pathname === '/api/radar') n++; } catch { /* rien */ } };
      p.on('request', compte); await p.waitForTimeout(8000); p.off('request', compte);
      ok('Radar (serveur) : la page ne relit pas le serveur en boucle (au plus une lecture en 8 s, lecture des mails finie)', n <= 1, n + ' lectures'); }
    await p.screenshot({path: SH + 'radar-serveur.png'}); }
  await p.goto(BASE + '/?serveur#agenda'); await p.waitForTimeout(4000);
  ok('agenda en direct : carte Aujourd\'hui, 7 prochains jours, grille', await p.evaluate(() => !!document.querySelector('.agt .agt-date') && document.querySelectorAll('.agw-d').length === 7 && !!document.querySelector('.mgrid .mg-d.is-today')));
  await p.screenshot({path: SH + 'os-live-agenda.png'});
  /* 0.21.0 : la notification « Iris a répondu » ouvre « /#voir-<ligne> » : la page relit Pilotage par le serveur et ouvre ton ordre avec la réponse */
  await p.goto(BASE + '/?serveur#voir-2'); await p.waitForTimeout(4500);
  { const v = await p.evaluate(() => { const s = document.getElementById('sheet'); return [location.hash, s && !s.hidden ? s.innerText : '']; });
    ok('notification : « /#voir-2 » ouvre la ligne 2 du Canal (ton ordre, la réponse d\'Iris), en direct par le serveur', v[0] === '#demandes' && /Ton ordre/i.test(v[1]) && /Noté\./.test(v[1]), v[0] + ' ' + v[1].replace(/\s+/g, ' ').slice(0, 100));
    await p.screenshot({path: SH + 'os-voir-ligne.png'}); }
  await p.goto(BASE + '/?serveur#papiers'); await p.waitForTimeout(3000);
  ok('papiers en direct : arborescence demandée au Drive (lecture seule)', FG.calls.some((c) => c.path === '/drive/files') && FG.calls.filter((c) => c.path.startsWith('/drive')).every((c) => c.method === 'GET') && await p.evaluate(() => !!document.querySelector('.pap-n')));
  /* outils de Claude dans la discussion et « Confier à la tâche Claude », sur le serveur (16/11/2026) */
  await p.goto(BASE + '/?serveur'); await p.waitForTimeout(4000);
  await p.fill('.intent-input', 'Fais un ordre de test pour Kairos'); await p.press('.intent-input', 'Enter'); await p.waitForTimeout(2500);
  ok('discussion : Claude propose un ordre, la page l\'affiche avec son bouton', await p.evaluate(() => { const c = document.getElementById('chat'); return !c.hidden && /Ordre proposé à Kairos/.test(c.textContent) && /Relève le prix du robot cuiseur/.test(c.textContent) && !/⟦|outil preparer_ordre/.test(c.textContent); }));
  await p.screenshot({path: SH + 'discussion-ordre.png'});
  let n0 = FG.calls.length;
  await p.evaluate(() => [...document.querySelectorAll('#chat .msg.proposal .btn.main')].pop().click()); await p.waitForTimeout(7000);
  ok('discussion : l\'ordre confirmé part dans le Canal', FG.calls.slice(n0).some((c) => c.method === 'POST' && /Canal.*:append$/.test(c.path) && /Relève le prix du robot cuiseur/.test(JSON.stringify(c.body))));
  FG.sheet['Canal!A1:H3000'] = [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['16/11/2026', 'Rabie', 'Claude', 'Ordre', 'Vérifie les routines d’Iris.', 'À faire', '', '']];
  await p.fill('#chat-in', 'Merci, et confie à la tâche Claude la vérification');
  await p.press('#chat-in', 'Enter').catch(() => {}); await p.waitForTimeout(2500);
  if (!(await p.evaluate(() => /Confier à la tâche Claude/.test(document.getElementById('chat').textContent)))) { await p.evaluate(() => { const f = document.querySelector('#chat form'); if (f) f.requestSubmit(); }); await p.waitForTimeout(2500); }
  ok('discussion : proposition de tâche Claude (entourée de ``` par Claude) affichée proprement', await p.evaluate(() => { const c = document.getElementById('chat').textContent; return /Confier à la tâche Claude/.test(c) && !/⟦|```/.test(c); }));
  await p.screenshot({path: SH + 'discussion-tache.png'});
  /* 0.18.0 : Claude propose une relance dans la discussion ; programmée sur son bouton */
  await p.fill('#chat-in', 'Programme une relance demain pour Iris'); await p.press('#chat-in', 'Enter').catch(() => {}); await p.waitForTimeout(2500);
  if (!(await p.evaluate(() => /Relance proposée/.test(document.getElementById('chat').textContent)))) { await p.evaluate(() => { const f = document.querySelector('#chat form'); if (f) f.requestSubmit(); }); await p.waitForTimeout(2500); }
  ok('discussion : Claude propose une relance liée à une ligne du Canal', await p.evaluate(() => /Relance proposée · ligne 2 du Canal/.test(document.getElementById('chat').textContent) && /Voir si Iris a répondu au syndic/.test(document.getElementById('chat').textContent)));
  await p.evaluate(() => [...document.querySelectorAll('#chat .msg.proposal .btn.main')].pop().click()); await p.waitForTimeout(1500);
  { const tk = await p.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken); const rl = await fetch(BASE + '/api/relances', {headers: {authorization: 'Bearer ' + tk}}).then((x) => x.json());
    ok('discussion : la relance confirmée est programmée sur le serveur', rl.prevues.some((x) => x.source === 'conversation' && x.ligne === 2 && /Iris a répondu au syndic/.test(x.quoi)), JSON.stringify(rl.prevues)); }
  /* 0.37.0 : la mémoire durable — Claude propose de retenir (carte « À retenir ») ; gardé sur le serveur seulement sur son bouton */
  await p.fill('#chat-in', 'Retiens que je préfère le train pour Lyon'); await p.press('#chat-in', 'Enter').catch(() => {}); await p.waitForTimeout(2500);
  if (!(await p.evaluate(() => /À retenir/.test(document.getElementById('chat').textContent)))) { await p.evaluate(() => { const f = document.querySelector('#chat form'); if (f) f.requestSubmit(); }); await p.waitForTimeout(2500); }
  { const tk = await p.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken), M = () => fetch(BASE + '/api/memoire', {headers: {authorization: 'Bearer ' + tk}}).then((x) => x.json());
    const avant = await M(), carte = await p.evaluate(() => /À retenir/.test(document.getElementById('chat').textContent) && /Préfère le train pour aller à Lyon/.test(document.getElementById('chat').textContent));
    ok('mémoire : Claude propose de retenir (carte « À retenir ») ; rien n\'est retenu sans le bouton', carte && !avant.items.some((x) => /train/.test(x.texte)), JSON.stringify(avant.items));
    await p.evaluate(() => [...document.querySelectorAll('#chat .msg.proposal .btn.main')].pop().click()); await p.waitForTimeout(1500); const apres = await M();
    ok('mémoire : « Retenir » le garde sur le serveur (venu de la discussion)', apres.items.some((x) => x.texte === 'Préfère le train pour aller à Lyon' && x.source === 'discussion'), JSON.stringify(apres.items)); }
  /* 0.41.0 : Claude propose une routine dans la discussion ; programmée sur son bouton */
  await p.fill('#chat-in', 'Programme chaque lundi un résumé de ma semaine'); await p.press('#chat-in', 'Enter').catch(() => {}); await p.waitForTimeout(2500);
  if (!(await p.evaluate(() => /Routine proposée/.test(document.getElementById('chat').textContent)))) { await p.evaluate(() => { const f = document.querySelector('#chat form'); if (f) f.requestSubmit(); }); await p.waitForTimeout(2500); }
  { const tk = await p.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken), RL = () => fetch(BASE + '/api/routines', {headers: {authorization: 'Bearer ' + tk}}).then((x) => x.json());
    const carte = await p.evaluate(() => /Routine proposée · chaque lundi à 8 h/.test(document.getElementById('chat').textContent) && /Résume la semaine qui vient/.test(document.getElementById('chat').textContent)), avant = await RL();
    await p.evaluate(() => [...document.querySelectorAll('#chat .msg.proposal .btn.main')].pop().click()); await p.waitForTimeout(1500); const apres = await RL();
    ok('routines : Claude propose une routine (carte « Routine proposée ») ; programmée seulement sur « Programmer »', carte && !avant.routines.length && apres.routines.some((x) => x.texte === 'Résume la semaine qui vient' && x.source === 'claude' && x.quand === 'chaque lundi à 8 h'), JSON.stringify(apres.routines));
    for (const x of apres.routines) await fetch(BASE + '/api/routines/' + x.id, {method: 'DELETE', headers: {authorization: 'Bearer ' + tk}}); }
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('mémoire : ' + e.message));
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(3500);
    const c1 = await q.evaluate(() => { const c = document.getElementById('mem-card'); return c ? {txt: c.textContent, n: c.querySelectorAll('.mem-it').length} : null; });
    ok('mémoire : Réglages montre ce que JARVIS retient et son Profil (lu dans Drive, sans sa partie finances)', !!c1 && /Préfère le train pour aller à Lyon/.test(c1.txt) && /Ton Profil \(Drive\) est lu, modifié le 20\/11\/2026, sans sa partie finances/.test(c1.txt), JSON.stringify(c1));
    const ajoute = async (t) => { await q.fill('#mem-card .mem-in', t); await q.evaluate(() => [...document.querySelectorAll('#mem-card .mem-add .btn')].pop().click()); await q.waitForTimeout(900); return q.evaluate(() => ({n: document.querySelectorAll('#mem-card .mem-it').length, txt: document.getElementById('mem-card').textContent})); };
    const c2 = await ajoute('Mon IBAN est FR76 3000 6000 0112 3456 7890 189'), c3 = await ajoute('Aime les randonnées le dimanche');
    ok('mémoire : ajout à la main dans Réglages ; un IBAN est refusé', /Rien de bancaire/.test(c2.txt) && !/FR76/.test(c2.txt) && c2.n === 1 && c3.n === 2 && /randonnées le dimanche/.test(c3.txt), JSON.stringify([c2.n, c3.n, c2.txt.slice(-160)]));
    await q.evaluate(() => [...document.querySelectorAll('#mem-card .mem-it')].find((x) => /train/.test(x.textContent)).querySelector('.btn').click()); await q.waitForTimeout(900);
    const c4 = await q.evaluate(() => ({n: document.querySelectorAll('#mem-card .mem-it').length, txt: document.getElementById('mem-card').textContent}));
    ok('mémoire : « Oublier » le retire', c4.n === 1 && !/train pour aller/.test(c4.txt), JSON.stringify(c4));
    /* 0.42.0 : la mémoire qui se range seule — « Ranger maintenant » : Claude relit les échanges et propose ; « Retenir » remplace le souvenir dépassé, « Non » écarte */
    await q.evaluate(() => [...document.querySelectorAll('#mem-card .btn')].find((b) => b.textContent === 'Ranger maintenant').click()); await q.waitForTimeout(3000);
    const r1 = await q.evaluate(() => ({props: [...document.querySelectorAll('#mem-card .mem-prop p')].map((x) => x.textContent), msg: (document.querySelector('#mem-card .set-msg') || {}).textContent || ''}));
    await q.evaluate(() => [...document.querySelectorAll('#mem-card .mem-prop')].find((x) => /samedi/.test(x.textContent)).querySelector('.btn.main').click()); await q.waitForTimeout(900);
    await q.evaluate(() => [...document.querySelectorAll('#mem-card .mem-prop')].find((x) => /trains de nuit/.test(x.textContent)).querySelector('.btn.ghost').click()); await q.waitForTimeout(900);
    const r2 = await q.evaluate(() => ({items: [...document.querySelectorAll('#mem-card .mem-it span')].map((x) => x.textContent), props: document.querySelectorAll('#mem-card .mem-prop').length}));
    ok('mémoire qui se range : « Ranger maintenant » montre les propositions de Claude ; « Retenir » remplace « dimanche » par « samedi », « Non » écarte', r1.props.length === 2 && r1.props.some((x) => /Aime les randonnées le samedi \(à la place de « Aime les randonnées le dimanche »\)/.test(x)) && /2 propositions/.test(r1.msg) && r2.props === 0 && r2.items.includes('Aime les randonnées le samedi') && !r2.items.some((x) => /dimanche|trains de nuit/.test(x)), JSON.stringify([r1, r2]));
    await q.close(); }
  /* 0.39.0 : le serveur MCP — l'accord se donne dans Réglages (mêmes 4 chiffres) ; une proposition venue de l'assistant s'approuve dans Suivi */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('mcp : ' + e.message));
    const tk = await p.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken), RU = 'https://claude.ai/api/mcp/auth_callback';
    const ins = await fetch(BASE + '/oauth/register', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({redirect_uris: [RU], client_name: 'Claude'})}).then((x) => x.json());
    const ver = crypto.randomBytes(32).toString('base64url'), ch = crypto.createHash('sha256').update(ver).digest('base64url');
    const html = await fetch(BASE + '/oauth/authorize?' + new URLSearchParams({response_type: 'code', client_id: ins.client_id, redirect_uri: RU, state: 's1', code_challenge: ch, code_challenge_method: 'S256'})).then((x) => x.text());
    const chiffres = (/>(\d{4})<\/p>/.exec(html) || [])[1], aid = (/var id="([\w-]+)"/.exec(html) || [])[1];
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(3500);
    const c1 = await q.evaluate(() => { const c = document.getElementById('mcp-card'); return c ? {txt: c.textContent, urgent: c.dataset.urgent === '1'} : null; });
    ok('MCP : une demande d\'accès apparaît dans Réglages (en tête), avec les mêmes 4 chiffres que la page de l\'assistant', !!c1 && c1.txt.includes('Claude demande l’accès à JARVIS') && !!chiffres && c1.txt.includes(chiffres) && c1.urgent, JSON.stringify([chiffres, c1 && c1.txt.slice(0, 300)]));
    await q.evaluate(() => document.querySelector('#mcp-card .mcp-d .btn.main').click()); await q.waitForTimeout(1200);
    const att = await fetch(BASE + '/oauth/attente/' + aid).then((x) => x.json()), c2 = await q.evaluate(() => document.getElementById('mcp-card').textContent);
    ok('MCP : « Autoriser » dans JARVIS renvoie l\'assistant à sa page avec un code', att.statut === 'accordee' && /code=/.test(att.redirect || '') && /Claude est relié à JARVIS/.test(c2), JSON.stringify([att.statut, c2.slice(-120)]));
    const code = new URL(att.redirect).searchParams.get('code');
    const tok = await fetch(BASE + '/oauth/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'authorization_code', code, code_verifier: ver, client_id: ins.client_id, redirect_uri: RU}).toString()}).then((x) => x.json());
    const rpc = (m, params, id) => fetch(BASE + '/mcp', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + tok.access_token}, body: JSON.stringify({jsonrpc: '2.0', id, method: m, params})}).then((x) => x.json());
    await rpc('tools/call', {name: 'jarvis_proposer_mission', arguments: {texte: 'Compare trois box internet fibre'}}, 1);
    await rpc('tools/call', {name: 'jarvis_proposer_ordre', arguments: {bot: 'Kairos', message: 'Surveille le prix de la box'}}, 2);
    await q.goto(BASE + '/?serveur#suivi'); await q.waitForTimeout(2500); await q.evaluate(() => { const b = document.querySelector('#missions'); if (b) b.scrollIntoView(); }); await q.waitForTimeout(800);
    const s1 = await q.evaluate(() => [...document.querySelectorAll('#missions .mis-it')].filter((x) => /box/.test(x.textContent)).map((x) => ({txt: x.textContent, btn: [...x.querySelectorAll('.mis-accord .btn')].map((b) => b.textContent)})));
    ok('MCP : Suivi montre les propositions de l\'assistant (« Proposée par Claude »), un ordre à Kairos compris, avec « Approuver » et « Refuser »', s1.length === 2 && s1.some((x) => /Ordre à Kairos : Surveille le prix de la box/.test(x.txt) && /Proposée par Claude : elle attend ton accord/.test(x.txt) && x.btn.includes('Approuver (part à Kairos)') && x.btn.includes('Refuser')) && s1.some((x) => /Compare trois box internet fibre/.test(x.txt) && x.btn.includes('Approuver (part à Claude)')), JSON.stringify(s1).slice(0, 500));
    await q.screenshot({path: SH + 'mcp-suivi.png'});
    await q.evaluate(() => { const it = [...document.querySelectorAll('#missions .mis-it')].find((x) => /Compare trois box/.test(x.textContent)); it.querySelector('.mis-accord .btn.main').click(); }); await q.waitForTimeout(600);
    await q.evaluate(() => { const it = [...document.querySelectorAll('#missions .mis-it')].find((x) => /Ordre à Kairos/.test(x.textContent)); it.querySelector('.mis-accord .btn.ghost').click(); }); await q.waitForTimeout(4500);
    const ms = await fetch(BASE + '/api/missions', {headers: {authorization: 'Bearer ' + tk}}).then((x) => x.json()).then((j) => j.missions);
    ok('MCP : « Approuver » lance la mission chez Claude ; « Refuser » écarte l\'ordre', ms.some((x) => /Compare trois box/.test(x.text) && ['envoyee', 'terminee'].includes(x.status)) && ms.some((x) => /Surveille le prix de la box/.test(x.text) && x.status === 'refusee'), JSON.stringify(ms.filter((x) => /box/.test(x.text)).map((x) => [x.text.slice(0, 24), x.status])));
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(3000); await q.evaluate(() => { const c = document.getElementById('mcp-card'); if (c) c.scrollIntoView(); }); await q.screenshot({path: SH + 'mcp-reglages.png'});
    for (const x of ms.filter((y) => /box/.test(y.text))) await fetch(BASE + '/api/missions/' + x.id, {method: 'DELETE', headers: {authorization: 'Bearer ' + tk}});   /* le banc suivant attend « Aucune mission » */
    /* 0.40.0 : la voix Google — la clé collée dans Réglages (jamais relue), le choix Pierre ou Google, la liste des voix, puis la lecture par Google */
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(3500);
    const v0 = await q.evaluate(() => { const c = document.getElementById('voixg-card'); return c ? c.textContent : ''; });
    await q.fill('#voixg-card .mem-in', 'AIzaSyTEST-0123456789abcdefghijklmnop'); await q.evaluate(() => [...document.querySelectorAll('#voixg-card .mem-add .btn')].pop().click()); await q.waitForTimeout(1500);
    const v1 = await q.evaluate(() => { const c = document.getElementById('voixg-card'); return {txt: c.textContent, opts: [...c.querySelectorAll('select option')].map((o) => o.textContent), grp: [...c.querySelectorAll('select optgroup')].map((o) => o.label), seg: [...c.querySelectorAll('.set-seg button')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed'))}; });
    /* 0.47.0 : la clé est essayée aussitôt (une vraie phrase) et Google choisi s'il répond ; la carte dit qui a dit la dernière phrase */
    ok('voix Google : Réglages explique comment l\'activer ; la clé collée est vérifiée auprès de Google et Google parle aussitôt ; elle n\'est jamais réaffichée ; voix conseillées d\'abord', /Cloud Text-to-Speech/.test(v0) && /990\s000/.test(v0) && /Clé vérifiée : Google parle maintenant \(Charon\)/.test(v1.txt) && /Google parle \(Charon\)\./.test(v1.txt) && /Dernière phrase du serveur : Google \(Charon\)/.test(v1.txt) && /Ce mois : \d+ sur 990\s000/.test(v1.txt) && v1.opts.join(',') === 'Charon (homme),Aoede (femme)' && v1.grp.join(',') === 'Conseillées pour JARVIS,Autres voix' && v1.seg.join(',') === 'Pierre:false,Google:true' && !/AIzaSyTEST/.test(v1.txt), JSON.stringify([v1.seg, v1.opts, v1.grp, v1.txt.slice(0, 260)]));
    await q.evaluate(() => [...document.querySelectorAll('#voixg-card button')].find((b) => b.textContent === 'Vérifier').click()); await q.waitForTimeout(1500);
    const v2 = await q.evaluate(() => document.getElementById('voixg-card').textContent);
    ok('voix Google : « Vérifier » demande une phrase à Google et le dit', /Google répond : sa voix marche, et c’est elle qui parle\./.test(v2), v2.slice(0, 200));
    /* 0.48.0 : une alerte de budget de Google Cloud (faux Gmail) coupe Google ; la carte le dit ; « Relancer Google » le relance ; la remise à zéro du 1er est affichée */
    FG.budget = ['bud-e2e']; const bm = await fetch(BASE + '/api/voix/google/budget/maintenant', {method: 'POST', headers: {authorization: 'Bearer ' + tk, 'content-type': 'application/json'}, body: '{}'}).then((x) => x.json());
    await q.reload(); await q.waitForTimeout(3500);   /* même adresse : goto ne rechargerait pas la page */
    const v4 = await q.evaluate(() => document.getElementById('voixg-card').textContent);
    await q.evaluate(() => { const b = [...document.querySelectorAll('#voixg-card button')].find((x) => x.textContent === 'Relancer Google'); if (b) b.click(); }); await q.waitForTimeout(1500);
    const v5 = await q.evaluate(() => document.getElementById('voixg-card').textContent); FG.budget = [];
    ok('voix Google : une alerte de budget de Google Cloud coupe Google et la carte le dit ; « Relancer Google » le relance ; la remise à zéro du 1er est affichée', /Google coupé : alerte de budget de Google Cloud reçue/.test(v4) && /remis à zéro le 1er \S+ à \d+ h/.test(v4) && /Google relancé/.test(v5) && /Google parle \(Charon\)\./.test(v5), JSON.stringify([bm.coupure, bm.budget, v4.slice(0, 240), v5.slice(0, 160)]));
    await q.evaluate(() => [...document.querySelectorAll('#voixg-card .set-seg button')].find((b) => b.textContent === 'Google').click()); await q.waitForTimeout(1000);
    const tv = await fetch(BASE + '/api/tts', {method: 'POST', headers: {authorization: 'Bearer ' + tk, 'content-type': 'application/json'}, body: JSON.stringify({text: 'Bonjour de Google.'})}).then((x) => x.text());
    const sv = await fetch(BASE + '/api/status', {headers: {authorization: 'Bearer ' + tk}}).then((x) => x.json());
    ok('voix Google : « Google » choisi, JARVIS parle avec la voix Google (clé envoyée à Google seulement)', /GOOGLE:fr-FR-Chirp3-HD-Charon:Bonjour de Google\./.test(tv) && sv.voixServeur === 'google' && GV.calls.some((c) => c.key === 'AIzaSyTEST-0123456789abcdefghijklmnop'), JSON.stringify([tv.slice(44), sv.voixServeur]));
    await q.evaluate(() => document.getElementById('voixg-card').scrollIntoView()); await q.screenshot({path: SH + 'voix-google.png'});
    await q.evaluate(() => [...document.querySelectorAll('#voixg-card .set-seg button')].find((b) => b.textContent === 'Pierre').click()); await q.waitForTimeout(800);
    const v3 = await q.evaluate(() => document.getElementById('voixg-card').textContent);
    ok('voix Google : « Pierre » choisi, la carte le dit en clair (clé posée, Pierre parle)', /Clé Google posée, mais c’est Pierre qui parle/.test(v3), v3.slice(0, 160));
    /* 0.41.0 : les routines dans Automatisations (une phrase lue, programmée, mise en pause, supprimée) et le brief du matin (activé, fait maintenant, sur l'accueil) */
    await q.goto(BASE + '/?serveur#automatisations'); await q.waitForTimeout(3000);
    await q.fill('#routines .mem-in', 'chaque vendredi à 18 h, prépare les sorties du week-end'); await q.waitForTimeout(1500);
    const ap = await q.evaluate(() => (document.querySelector('#routines .rout-apercu') || {}).textContent || '');
    await q.evaluate(() => document.querySelector('#routines .rout-apercu .btn.main').click()); await q.waitForTimeout(1200);
    const l1 = await q.evaluate(() => [...document.querySelectorAll('#routines .rout-it')].map((x) => x.textContent));
    ok('routines : Automatisations lit la phrase (« Chaque vendredi à 18 h · « Prépare les sorties du week-end » »), puis la programme', /Chaque vendredi à 18 h · « Prépare les sorties du week-end »/.test(ap) && l1.length === 1 && /Chaque vendredi à 18 h/.test(l1[0]) && /prochaine :/.test(l1[0]), JSON.stringify([ap, l1]));
    await q.evaluate(() => [...document.querySelectorAll('#routines .rout-it .btn')].find((b) => b.textContent === 'Pause').click()); await q.waitForTimeout(800);
    const l2 = await q.evaluate(() => [...document.querySelectorAll('#routines .rout-it')].map((x) => x.textContent));
    await q.evaluate(() => [...document.querySelectorAll('#routines .rout-it .btn')].find((b) => b.textContent === 'Supprimer').click()); await q.waitForTimeout(800);
    const l3 = await q.evaluate(() => document.querySelectorAll('#routines .rout-it').length);
    ok('routines : « Pause » puis « Supprimer »', /en pause/.test(l2[0] || '') && l3 === 0, JSON.stringify([l2, l3]));
    await q.evaluate(() => [...document.querySelectorAll('#routines .rout-brief .btn')].find((b) => b.textContent === 'Activer').click()); await q.waitForTimeout(1000);
    await q.evaluate(() => [...document.querySelectorAll('#routines .rout-brief .btn')].find((b) => b.textContent === 'Brief maintenant').click()); await q.waitForTimeout(1500);
    const br = await q.evaluate(() => ({b: (document.querySelector('#routines .rout-brief') || {}).textContent || '', out: (document.querySelector('#routines .set-msg') || {}).textContent || ''}));
    await q.screenshot({path: SH + 'routines.png'});
    ok('brief du matin : activé (tous les jours à 7 h 30 par défaut) et fait sans IA à la demande', /Brief du matin · tous les jours à 7 h 30/.test(br.b) && /^Bonjour\. Nous sommes /.test(br.out), JSON.stringify(br).slice(0, 300));
    await q.goto(BASE + '/?serveur#accueil'); await q.waitForTimeout(2500);
    const bc = await q.evaluate(() => { const c = document.getElementById('brief-card'); return c && !c.hidden ? c.textContent : ''; });
    ok('brief du matin : le brief du jour est sur l\'accueil, avec « Lire »', /Brief du matin/.test(bc) && /Bonjour\. Nous sommes/.test(bc) && /Lire/.test(bc), bc.slice(0, 160));
    { const tk2 = await q.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken); for (const x of (await fetch(BASE + '/api/routines', {headers: {authorization: 'Bearer ' + tk2}}).then((y) => y.json())).routines) await fetch(BASE + '/api/routines/' + x.id, {method: 'DELETE', headers: {authorization: 'Bearer ' + tk2}}); }
    await q.close(); }
  { const q = await ctx.newPage();
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(3500);
    /* 0.38.0 : les skills des missions, listées dans Réglages */
    const sk = await q.evaluate(() => { const c = document.getElementById('skills-card'); return c ? {n: c.querySelectorAll('.skill-it').length, txt: c.textContent} : null; });
    ok('skills : Réglages liste les cinq skills des missions et à quoi sert chacune', !!sk && sk.n === 5 && /Recherche sur le web/.test(sk.txt) && /Démarche administrative/.test(sk.txt) && /Préparer un voyage/.test(sk.txt) && !/À charger/.test(sk.txt), JSON.stringify(sk && {n: sk.n, t: sk.txt.slice(0, 200)}));
    await q.evaluate(() => document.getElementById('mem-card').scrollIntoView()); await q.screenshot({path: SH + 'memoire.png'});
    await q.close(); }
  n0 = FG.calls.length;
  await p.evaluate(() => [...document.querySelectorAll('#chat .msg.proposal.is-act .btn.main')].pop().click()); await p.waitForTimeout(19000);
  const puts = FG.calls.slice(n0).filter((c) => c.method === 'PUT').map((c) => c.path.split('/values/')[1]);
  ok('tâche Claude : lancée par la page, faite par le serveur (réponse et statut dans le Canal)', puts.includes('Canal!G2') && puts.includes('Canal!F2'), puts.join(' | '));
  /* 0.30.0 : Claude instantané — Claude préparé à l'ouverture de la discussion, réponse qui s'écrit mot par mot, « Arrêter » qui coupe Claude */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('flux : ' + e.message));
    const vus = {prep: 0, sample: 0, conv: 0}; q.on('request', (r) => { const u = r.url(); if (/\/api\/sample\/prepare$/.test(u)) vus.prep++; if (/\/api\/sample$/.test(u)) { vus.sample++; try { if (JSON.parse(r.postData() || '{}').conv) vus.conv++; } catch (e) { /* rien */ } } });
    await q.addInitScript(() => { try { const s0 = JSON.parse(localStorage.getItem('jarvis.settings') || '{}'); s0.orbe = 'dictee'; localStorage.setItem('jarvis.settings', JSON.stringify(s0)); } catch (e) { /* rien */ } });
    await q.goto(BASE + '/?serveur'); await q.waitForTimeout(3500);
    await q.evaluate(() => window.JarvisAsk()); await q.waitForTimeout(600);
    await q.evaluate(() => { const n = document.querySelector('#chat .dict-no'); if (n) n.click(); }); await q.waitForTimeout(1200);
    const derniere = () => q.evaluate(() => { const m = [...document.querySelectorAll('#chat .msg.them p')]; return m.length ? m[m.length - 1].textContent : ''; });
    await q.fill('#chat-in', 'Bonjour Claude'); await q.press('#chat-in', 'Enter'); await q.waitForTimeout(1500);
    const r1 = await derniere(), mod1 = await q.evaluate(() => { const m = [...document.querySelectorAll('#chat .msg.them .msg-mod')]; return m.length ? m[m.length - 1].textContent : ''; });
    ok('Claude instantané : Claude préparé à l\'ouverture de la discussion (avec son historique gardé dans le téléphone) ; la première question part seule, sans les données ; « Auto » l\'a confiée à Haiku, dit sous la réponse', vus.prep >= 1 && vus.conv >= 1 && /^Tu as dit : Bonjour Claude\. Session : reprise/.test(r1) && mod1 === 'Haiku', JSON.stringify([vus, mod1, r1.slice(-120)]));
    await q.fill('#chat-in', 'Raconte lentement'); await q.press('#chat-in', 'Enter'); await q.waitForTimeout(1300);
    const enCours = await derniere(), arret = await q.evaluate(() => !!document.querySelector('#chat .chat-row .btn[aria-label="Arrêter"]'));
    await q.screenshot({path: SH + 'discussion-flux.png'});
    await q.click('#chat .chat-row .btn[aria-label="Arrêter"]'); await q.waitForTimeout(800);
    const coupe = await derniere(), libre = await q.evaluate(() => !!document.querySelector('#chat .chat-row .btn[aria-label="Envoyer"]'));
    ok('Claude instantané : la réponse s\'écrit pendant que Claude parle (pas d\'attente de la fin) ; « Arrêter » garde ce qui est écrit', /^Réponse lente\. bla/.test(enCours) && enCours.length > 40 && enCours.length < 6000 && arret && libre && coupe.length >= enCours.length && coupe.length < 6000, JSON.stringify([enCours.length, coupe.length, arret, libre]));
    await q.fill('#chat-in', 'Et après ?'); await q.press('#chat-in', 'Enter'); await q.waitForTimeout(1500);
    const r3 = await derniere(), tk3 = await q.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken);
    const pg = (await fetch(BASE + '/api/status', {headers: {authorization: 'Bearer ' + tk3}}).then((x) => x.json())).page || {};
    ok('Claude instantané : après « Arrêter », la question suivante repart sur un Claude neuf (avec les données et l\'historique) et reçoit sa réponse', r3.length > 10 && !/Je réfléchis|interrompue/.test(r3) && pg.dernier && pg.dernier.conv === true && pg.dernier.chaud === false && pg.dernier.ok === true, JSON.stringify([r3.slice(0, 60), pg.dernier]));
    /* 0.35.0 : les réponses de Claude mises en forme (gras, listes) au lieu des ** et des tirets bruts */
    { await q.fill('#chat-in', 'Réponds en liste'); await q.press('#chat-in', 'Enter'); await q.waitForTimeout(1800);
      const md = await q.evaluate(() => { const ms = [...document.querySelectorAll('#chat .msg.them p')], p = ms[ms.length - 1]; return {b: p ? p.querySelectorAll('b').length : 0, li: p ? p.querySelectorAll('li').length : 0, i: p ? p.querySelectorAll('i').length : 0, brut: p ? /\*\*|^- /m.test(p.textContent) : true}; });
      ok('réponses : gras, italique et listes de Claude mis en forme (plus de ** ni de tirets bruts)', md.b === 1 && md.li === 2 && md.i === 1 && !md.brut, JSON.stringify(md)); }
    await q.close(); }
  /* 0.34.0 : réponses illustrées — Claude montre la demande dont il parle : sa carte sous la réponse (l'élément inconnu est ignoré), un appui l'ouvre là où elle vit */
  { const avant = FG.sheet["'À toi'!A3:D300"], auj = new Intl.DateTimeFormat('fr-FR', {timeZone: 'Europe/Paris'}).format(new Date());
    FG.sheet["'À toi'!A3:D300"] = [['Depuis le', 'Bot', 'Sujet', "Ce qu'on attend de toi"], [auj, 'Iris', 'Relance du syndic', "À faire : Dis-moi si je relance le syndic pour l'expert"]];
    const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('cartes : ' + e.message));
    await q.addInitScript(() => { try { const s0 = JSON.parse(localStorage.getItem('jarvis.settings') || '{}'); s0.orbe = 'dictee'; localStorage.setItem('jarvis.settings', JSON.stringify(s0)); } catch (e) { /* rien */ } });
    await q.goto(BASE + '/?serveur#accueil'); await q.waitForTimeout(3500);
    await q.evaluate(() => window.JarvisAsk()); await q.waitForTimeout(600); await q.evaluate(() => { const n = document.querySelector('#chat .dict-no'); if (n) n.click(); }); await q.waitForTimeout(800);
    await q.fill('#chat-in', 'Montre-moi ce qui m’attend'); await q.press('#chat-in', 'Enter'); await q.waitForTimeout(2500);
    const c1 = await q.evaluate(() => { const cs = [...document.querySelectorAll('#chat .msg.carte')], ms = [...document.querySelectorAll('#chat .msg.them p')]; return {n: cs.length, t: cs.map((c) => c.textContent), brut: /⟦|outil montrer/.test(document.getElementById('chat').textContent), der: ms.length ? ms[ms.length - 1].textContent.slice(0, 120) : ''}; });
    await q.screenshot({path: SH + 'reponse-illustree.png'});
    if (c1.n) await q.click('#chat .msg.carte');
    await q.waitForTimeout(900);
    const c2 = await q.evaluate(() => ({chat: !document.getElementById('chat').hidden, hash: location.hash}));
    ok('réponses illustrées : la carte de la demande s\'affiche sous la réponse (une seule : l\'élément inconnu est ignoré) ; un appui ferme la discussion et ouvre Pour moi', c1.n === 1 && /Pour moi/.test(c1.t[0]) && /Relance du syndic/.test(c1.t[0]) && !c1.brut && !c2.chat && /demandes/.test(c2.hash), JSON.stringify([c1, c2]));
    await q.close(); FG.sheet["'À toi'!A3:D300"] = avant; }
  /* notifications (0.12.0) : depuis Réglages, comme sur l'iPhone ouvert depuis l'écran d'accueil ; faux service de notifications et faux abonnement du navigateur */
  { const http = await import('node:http'), crypto = await import('node:crypto'); const got = [];
    const PS = http.createServer((q, res) => { const ch = []; q.on('data', (d) => ch.push(d)); q.on('end', () => { got.push({h: q.headers, n: Buffer.concat(ch).length}); res.writeHead(201); res.end(); }); });
    await new Promise((z) => PS.listen(0, '127.0.0.1', z));
    const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
    const fake = {endpoint: 'http://127.0.0.1:' + PS.address().port + '/push/iphone', keys: {p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url')}};
    const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.addInitScript((f) => {
      const mm = window.matchMedia.bind(window); window.matchMedia = (m) => (/display-mode: standalone/.test(m) ? {matches: true, addEventListener() {}, removeEventListener() {}} : mm(m));
      let cur = null; const sub = {endpoint: f.endpoint, toJSON: () => f, unsubscribe: () => { cur = null; return Promise.resolve(true); }};
      const reg = {pushManager: {getSubscription: () => Promise.resolve(cur), subscribe: (o) => { window.__pushKey = o && o.applicationServerKey && o.applicationServerKey.length; cur = sub; return Promise.resolve(sub); }}};
      Object.defineProperty(navigator, 'serviceWorker', {value: {ready: Promise.resolve(reg), getRegistration: () => Promise.resolve(reg), register: () => Promise.resolve(reg)}});
      window.PushManager = window.PushManager || function () {}; window.Notification = window.Notification || function () {};
      Object.defineProperty(window.Notification, 'permission', {get: () => 'default'}); window.Notification.requestPermission = () => Promise.resolve('granted');
    }, fake);
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    ok('Réglages : carte Notifications, bouton « Activer »', await q.evaluate(() => { const c = document.querySelector('.notif-card'); return !!c && /Activer les notifications/.test(c.textContent); }));
    await q.evaluate(() => [...document.querySelectorAll('.notif-card button')].find((b) => /Activer/.test(b.textContent)).click()); await q.waitForTimeout(2000);
    const st = await fetch(BASE + '/api/push', {headers: {authorization: 'Bearer ' + (await q.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken))}}).then((r) => r.json());
    ok('notifications : abonnement enregistré par le serveur (clé VAPID de 65 octets donnée au navigateur)', st.count === 1 && await q.evaluate(() => window.__pushKey === 65 && /Actives sur cet iPhone/.test(document.querySelector('.notif-card').textContent)), JSON.stringify(st).slice(0, 100));
    await q.evaluate(() => [...document.querySelectorAll('.notif-card button')].find((b) => /essai/.test(b.textContent)).click()); await q.waitForTimeout(1500);
    ok('notifications : « Envoyer un essai » part chiffré vers le service de notifications', got.length >= 1 && got[got.length - 1].h['content-encoding'] === 'aes128gcm' && /^vapid t=/.test(got[got.length - 1].h.authorization) && await q.evaluate(() => /Envoyée/.test(document.querySelector('.notif-card').textContent)));
    await q.evaluate(() => { const c = document.querySelector('.notif-card'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 90; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'reglages-notifications.png'});
    await q.evaluate(() => [...document.querySelectorAll('.notif-card button')].find((b) => /Couper/.test(b.textContent)).click()); await q.waitForTimeout(1500);
    ok('notifications : « Couper sur cet iPhone » retire l\'abonnement', await q.evaluate(() => /Activer les notifications/.test(document.querySelector('.notif-card').textContent)));
    PS.close(); }
  /* Siri et bouton Action (0.13.0) : clé créée dans Réglages, question posée comme par le Raccourci */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    ok('Réglages : carte « Siri et bouton Action »', await q.evaluate(() => /Créer la clé du Raccourci/.test((document.querySelector('.siri-card') || {}).textContent || '')));
    await q.evaluate(() => [...document.querySelectorAll('.siri-card button')].find((b) => /Créer la clé/.test(b.textContent)).click()); await q.waitForTimeout(1200);
    const k = await q.evaluate(() => (document.querySelector('.siri-key') || {}).textContent || '');
    ok('Siri : clé montrée une fois, avec les étapes (adresse, en-tête, champ « texte »)', k.length >= 30 && await q.evaluate((kk) => { const c = document.querySelector('.siri-card').textContent; return c.includes('/api/raccourci') && c.includes('Bearer ' + kk) && /Dicter le texte/.test(c) && /Énoncer le texte/.test(c); }, k));
    await q.evaluate(() => { const c = document.querySelector('.siri-card'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 90; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'reglages-siri.png'});
    const ans = await fetch(BASE + '/api/raccourci', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + k}, body: JSON.stringify({texte: 'Quoi de neuf ?'})}).then(async (x) => [x.status, await x.text()]);
    ok('Siri : le Raccourci obtient une réponse à lire', ans[0] === 200 && /Tu as dit : Quoi de neuf/.test(ans[1]), ans.join(' '));
    await q.reload(); await q.waitForTimeout(2500);
    ok('Siri : clé active, nombre de questions affiché, « Essayer ici »', await q.evaluate(() => { const c = document.querySelector('.siri-card').textContent; return /Clé active/.test(c) && /1 question/.test(c) && /Essayer ici/.test(c) && !document.querySelector('.siri-key'); }));
    /* 0.43.0 : les automatisations de l'iPhone (sans IA) : les recettes dans la carte Siri, chacune avec « Essayer » */
    await q.evaluate(() => { const d = document.querySelector('.siri-card .siri-auto'); if (d) d.open = true; }); await q.waitForTimeout(300);
    const au = await q.evaluate(() => { const d = document.querySelector('.siri-card .siri-auto'); return d ? {n: d.querySelectorAll('.auto-it').length, txt: d.textContent} : null; });
    await q.evaluate(() => [...document.querySelectorAll('.siri-card .auto-it')].find((x) => /« brief »/.test(x.textContent)).querySelector('.btn').click()); await q.waitForTimeout(2000);
    const au2 = await q.evaluate(() => (document.querySelector('.siri-card .set-msg') || {}).textContent || '');
    await q.evaluate(() => { const d = document.querySelector('.siri-card .siri-auto'), sc = document.getElementById('scroller'); if (d && sc) sc.scrollTop += d.getBoundingClientRect().top - 80; }); await q.waitForTimeout(300); await q.screenshot({path: SH + 'automatisations-iphone.png'});
    ok('automatisations : cinq recettes (réveil, voiture, bureau, soir, sortie) avec l\'action à mettre ; « Essayer » lit le brief sans IA', !!au && au.n === 5 && /Au réveil · « brief »/.test(au.txt) && /CarPlay/.test(au.txt) && /Exécuter immédiatement/.test(au.txt) && /^Bonjour\. Nous sommes /.test(au2), JSON.stringify([au && au.n, au2.slice(0, 80)])); }
  /* 17/11/2026 : Réglages ne clignote plus quand les données de Pilotage arrivent (écran de chargement montré une seule fois) */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.addInitScript(() => { window.__lect = 0; window.__vu = false; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType !== 1) return; const t = n.textContent || ''; window.__log = window.__log || []; if (n.matches && n.matches('.set-card') && /Serveur JARVIS/.test(t)) { if (!window.__vu) window.__log.push(Math.round(performance.now()) + ' vu ' + n.className); window.__vu = true; } else if (window.__vu && /Lecture des réglages/.test(t)) { window.__lect++; window.__log.push(Math.round(performance.now()) + ' lect ' + n.className + ' < ' + (n.parentNode && n.parentNode.className) + ' ' + t.slice(0, 60)); } }))).observe(document, {childList: true, subtree: true}); });   /* compte les retours à « Lecture des réglages… » une fois le contenu affiché */
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(6000);
    const n1 = await q.evaluate(() => window.__lect);
    await q.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); }); await q.waitForTimeout(2500);
    const n2 = await q.evaluate(() => window.__lect), has = await q.evaluate(() => /Serveur JARVIS/.test(document.querySelector('.set-wrap').textContent));
    ok('Réglages sans clignotement : plus de retour à « Lecture des réglages… » une fois le contenu affiché, même quand les données arrivent', n1 === 0 && n2 === 0 && has, n1 + ' puis ' + n2 + ' ' + JSON.stringify(await q.evaluate(() => window.__log || []))); }
  /* sauvegarde de Pilotage (0.14.0) : carte de Réglages, copie immédiate */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    ok('Réglages : carte « Sauvegarde de Pilotage »', await q.evaluate(() => /Pas encore de copie|Dernière copie/.test((document.querySelector('.sav-card') || {}).textContent || '')));
    await q.evaluate(() => [...document.querySelectorAll('.sav-card button')].find((b) => /Sauvegarder maintenant/.test(b.textContent)).click()); await q.waitForTimeout(2500);
    ok('sauvegarde : « Sauvegarder maintenant » fait une copie des 19 onglets', await q.evaluate(() => /Dernière copie le|Copie faite \(19 onglets\)/.test(document.querySelector('.sav-card').textContent))); }
  /* 0.15.0 : missions de Claude (Suivi), tour de Claude (Réglages), recherche dans le texte des papiers */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.goto(BASE + '/?serveur#suivi'); await q.waitForTimeout(2500);
    ok('Suivi : panneau « Missions de Claude » (avant l\'état des systèmes)', await q.evaluate(() => { const m = document.querySelector('.mis-panel'), hs = [...document.querySelectorAll('.panel h2')].map((x) => x.textContent); return !!m && /Aucune mission/.test(m.textContent) && hs.indexOf('Missions de Claude') >= 0 && hs.indexOf('Missions de Claude') < hs.indexOf('Relances') && hs.indexOf('Relances') < hs.indexOf('État des systèmes'); }));
    await q.fill('.mis-inp', 'Compare trois assurances habitation'); await q.evaluate(() => [...document.querySelectorAll('.mis-panel button')].find((b) => /Lancer la mission/.test(b.textContent)).click()); await q.waitForTimeout(2500);
    await q.reload(); await q.waitForTimeout(2500); await q.evaluate(() => { const d = document.querySelector('.mis-it'); if (d) d.open = true; });
    ok('missions : lancée depuis Suivi, terminée, compte rendu lisible', await q.evaluate(() => { const m = document.querySelector('.mis-it'); return !!m && /Terminée/.test(m.textContent) && /Compte rendu : mission faite/.test(m.textContent); }));
    await q.evaluate(() => { const c = document.querySelector('.mis-panel'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 90; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'suivi-missions.png'});
    /* 0.18.0 : « Non, plutôt… » sur une mission, relances, consommation de Claude */
    await q.evaluate(() => { const d = document.querySelector('.mis-it'); d.open = true; d.querySelector('.mis-plutot').open = true; d.querySelector('.mis-plutot textarea').value = 'Plus court, en trois points'; [...d.querySelectorAll('.mis-plutot button')].find((b) => /Refaire avec ça/.test(b.textContent)).click(); });
    await q.waitForTimeout(3000); await q.reload(); await q.waitForTimeout(2500); await q.evaluate(() => { const d = document.querySelector('.mis-it'); if (d) d.open = true; });
    ok('missions : aucune ligne plus large que l\'écran (titre long d\'une reprise)', await q.evaluate(() => [...document.querySelectorAll('.mis-it, .rel-it')].every((x) => x.getBoundingClientRect().right <= innerWidth - 8)));
    ok('missions : « Non, plutôt… » relance Claude avec sa version précédente et ta consigne', await q.evaluate(() => { const t = (document.querySelector('.mis-it') || {}).textContent || ''; return /Reprise : Compare trois assurances/.test(t) && /Version 2 : Plus court, en trois points/.test(t); }));
    await q.fill('.rel-panel input[type=text]', 'Voir si le syndic a répondu'); await q.evaluate(() => [...document.querySelectorAll('.rel-panel button')].find((b) => /Programmer/.test(b.textContent)).click()); await q.waitForTimeout(1500);
    ok('Suivi : relance programmée (demain 9 h par défaut), visible dans la liste', await q.evaluate(() => /Programmée : /.test(document.querySelector('.rel-panel').textContent) && [...document.querySelectorAll('.rel-it:not(.is-done)')].some((x) => /Voir si le syndic a répondu/.test(x.textContent) && /09:00/.test(x.textContent))));
    ok('Suivi : « Claude cette semaine » par usage (missions, conversation…)', await q.evaluate(() => { const t = (document.querySelector('.conso-panel') || {}).textContent || ''; return document.querySelectorAll('.conso-panel tbody tr').length >= 2 && /Missions/.test(t) && /jetons sur/.test(t); }));
    await q.evaluate(() => { const c = document.querySelector('.rel-panel'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 140; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'suivi-relances.png'});
    await q.evaluate(() => [...document.querySelectorAll('.rel-it:not(.is-done)')].find((x) => /Voir si le syndic a répondu/.test(x.textContent)).querySelector('button').click()); await q.waitForTimeout(1500);
    ok('Suivi : relance annulée', await q.evaluate(() => ![...document.querySelectorAll('.rel-it:not(.is-done)')].some((x) => /Voir si le syndic a répondu/.test(x.textContent))));
    /* 0.16.0 : santé du serveur dans « État des systèmes » */
    await q.evaluate(() => [...document.querySelectorAll('.sante-box button')].find((b) => /Vérifier maintenant/.test(b.textContent)).click()); await q.waitForTimeout(1500);
    ok('Suivi : santé du serveur (Google relié, Claude connecté), vérifiable à la demande', await q.evaluate(() => { const t = (document.querySelector('.sante-box') || {}).textContent || ''; return /Accès Google\s*relié/.test(t) && /Claude sur le serveur\s*connecté/.test(t) && document.querySelectorAll('.sante-box .sys-row.is-ok').length >= 2; }));
    await q.evaluate(() => { const c = document.querySelector('.sante-box'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 200; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'suivi-sante.png'});
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    ok('Réglages : carte « Tour de Claude », coupée par défaut, notifications demandées', await q.evaluate(() => { const c = document.querySelector('.tour-card'); return !!c && c.querySelector('[aria-pressed="true"]').textContent === 'Non' && /Active d’abord les notifications/.test(c.textContent); }));
    await q.evaluate(() => [...document.querySelectorAll('.tour-card .seg button')].find((b) => b.textContent === '4 h').click()); await q.waitForTimeout(2500);
    ok('tour de Claude : fréquence choisie gardée par le serveur', await q.evaluate(() => document.querySelector('.tour-card [aria-pressed="true"]').textContent === '4 h'));
    await q.evaluate(() => [...document.querySelectorAll('.tour-card button')].find((b) => /Faire un tour maintenant/.test(b.textContent)).click()); await q.waitForTimeout(2500);
    ok('tour de Claude : « Faire un tour maintenant » dit ce qu\'il a trouvé', await q.evaluate(() => /Syndic à confirmer/.test(document.querySelector('.tour-card').textContent)));
    await q.evaluate(() => [...document.querySelectorAll('.tour-card button')].find((b) => /Faire un tour maintenant/.test(b.textContent)).click()); await q.waitForTimeout(2000);
    ok('tour de Claude : second tour sans changement, Claude pas appelé (gratuit)', await q.evaluate(() => /Rien de nouveau depuis le tour précédent : Claude n’a pas été appelé/.test(document.querySelector('.tour-card').textContent)));
    await q.evaluate(() => { const c = document.querySelector('.tour-card'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 90; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'reglages-tour.png'});
    await q.evaluate(() => [...document.querySelectorAll('.tour-card .seg button')].find((b) => b.textContent === 'Non').click()); await q.waitForTimeout(1500);
    const DF = 'application/vnd.google-apps.folder', PAPR = '1huMsPD8I81buG4GWhuoGmsOafvy4HrE4';
    FG.drive.push({id: PAPR, name: 'Papiers', parents: ['rda'], mimeType: DF, modifiedTime: '2025-01-02T10:00:00Z'}, {id: 'e-log', name: 'Logement', parents: [PAPR], mimeType: DF, modifiedTime: '2025-01-02T10:00:00Z'},
      {id: 'e1', name: 'Bail 2024.pdf', parents: ['e-log'], mimeType: 'application/pdf', modifiedTime: '2025-01-02T10:00:00Z', size: '1234', text: 'contrat de location, loyer mensuel'});
    await q.evaluate(() => { try { Object.keys(localStorage).filter((k) => /pap/i.test(k) && !/prive/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* rien */ } });
    await q.goto(BASE + '/?serveur#papiers'); await q.waitForTimeout(3500); await q.fill('.pap-search', 'loyer'); await q.waitForTimeout(2000);
    ok('papiers en direct : « loyer » trouvé dans le texte du bail (Drive, lecture seule)', FG.calls.some((c) => c.path === '/drive/files' && /fullText contains 'loyer'/.test(c.q.q || '')) && await q.evaluate(() => /Dans le texte des documents · 1/.test(document.querySelector('.pap-res').textContent) && /Bail 2024/.test((document.querySelector('.pap-res-txt') || {}).textContent || '') && !/null|undefined/.test(document.querySelector('.pap-res').textContent)),
      JSON.stringify(FG.calls.filter((c) => c.path === '/drive/files' && /fullText/.test(c.q.q || '')).map((c) => c.q.q)) + ' ' + await q.evaluate(() => document.querySelector('.pap-res').textContent.slice(0, 200)));
    await q.screenshot({path: SH + 'papiers-texte-serveur.png'}); }
  /* 0.19.0 (18/11/2026) : « Revérifie dans mes papiers » depuis la feuille d'une demande : le serveur cherche dans Papiers, Claude juge, une ligne pour Iris dans le Canal */
  { const today = new Date().toLocaleDateString('fr-FR', {timeZone: 'Europe/Paris'});
    FG.sheet["'À toi'!A3:D300"] = [['Depuis le', 'Bot', 'Sujet', "Ce qu'on attend de toi"], [today, 'Iris', 'Date du bail', "À faire : Retrouve la date de début du bail pour l'assureur | Conseil : retrouver cette date sur l'un de ces deux documents"]];
    await p.goto(BASE + '/?serveur#demandes'); await p.reload(); await p.waitForTimeout(4500);   /* même page, seul le # change : recharger pour relire Pilotage */
    const found = await p.evaluate(() => { const c = [...document.querySelectorAll('article')].find((x) => /Date du bail/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); if (!c) return false; [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); return true; }); await p.waitForTimeout(900);
    if (!found) console.error('DIAG', JSON.stringify(await p.evaluate(() => ({h: location.href, title: (document.getElementById('view-title') || {}).textContent, arts: [...document.querySelectorAll('article')].map((x) => x.textContent.slice(0, 70)).slice(0, 14)}))), JSON.stringify(FG.calls.filter((c) => /toi/.test(c.path)).slice(-3).map((c) => [c.path, c.auth ? 'jeton' : 'sans', c.method])));
    const vis = await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions > div:not(.sa-more) .btn')].map((x) => x.firstChild.textContent.trim()));
    await p.screenshot({path: SH + 'demande-feuille-serveur.png'});
    const a0 = (FG.appends || []).length;
    await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Revérifie dans mes papiers/.test(x.textContent)).click());
    let ln = null; for (let i = 0; i < 40 && !ln; i++) { await p.waitForTimeout(250); ln = (FG.appends || []).slice(a0).find((x) => /Date du bail/.test(JSON.stringify(x.values))); }
    const ts = await p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
    const ms = await p.evaluate(() => window.JarvisServeur.missions()), mv = (ms || []).find((x) => /^Revérifie dans tes papiers : « Date du bail »/.test(x.text));
    ok('revérifier : « Revérifie dans mes papiers » en haut de la feuille, lancé sur le serveur, ligne pour Iris dans le Canal, mission suivie', vis.includes('Revérifie dans mes papiers') && /Claude revérifie tes papiers/.test(ts) && ln && ln.values[0][1] === 'Claude' && ln.values[0][2] === 'Iris' && /Bail 2024\.pdf/.test(ln.values[0][4]) && mv && /Iris prévenue dans le Canal/.test(mv.result || ''), JSON.stringify([vis, ts.slice(0, 120), ln && ln.values[0][4], mv && mv.status]));
    await p.screenshot({path: SH + 'demande-reverifie-serveur.png'}); }
  /* 0.20.0 (18/11/2026) : « Mettre de côté » gardé par le serveur (rappel du dimanche), puis « Remettre » */
  { await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
    await p.evaluate(() => { const c = [...document.querySelectorAll('article')].find((x) => /Date du bail/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }); await p.waitForTimeout(900);
    await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions > div:not(.sa-more) .btn')].find((x) => /^Plus tard/.test(x.textContent)).click()); await p.waitForTimeout(600);
    await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-pick .btn')].find((x) => /^Dans une semaine/.test(x.textContent)).click()); await p.waitForTimeout(1500);
    const l1 = await p.evaluate(() => window.JarvisServeur.cote.liste());
    const shown = await p.evaluate(() => [...document.querySelectorAll('article')].some((x) => /Date du bail/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)));
    await p.evaluate(() => [...[...document.querySelectorAll('.cote-it')].find((x) => /Date du bail/.test(x.textContent)).querySelectorAll('button')].find((b) => b.textContent === 'Remettre').click()); await p.waitForTimeout(1200);   /* le premier bouton ouvre la carte (0.23.0) */
    const l2 = await p.evaluate(() => window.JarvisServeur.cote.liste());
    ok('« Plus tard » (dans une semaine) gardé par le serveur, gratuit, carte cachée, puis « Remettre »', (l1 || []).some((x) => x.id === 'a:Date du bail' && x.jusqu > Date.now() + 6 * 864e5) && !shown && Array.isArray(l2) && !l2.some((x) => x.id === 'a:Date du bail'), JSON.stringify([l1, shown, l2])); }
  /* 0.25.0 : un seul Claude. L'orbe ouvre la discussion avec Claude (celle qui a ses données) et écoute UNE question : faux micro
     (un son que le banc allume), écoute Whisper du serveur (fausse). La phrase arrive dans le champ, le micro se referme, rien ne part
     sans « Envoyer » ; « J'ai fini » envoie la phrase à l'écriture sans attendre le silence ; « Lecture » fait lire la réponse par Pierre. */
  { const v = await ctx.newPage(); v.on('pageerror', (e) => errs.push('voix : ' + e.message));
    const hits = {tts: 0, stt: 0, voix: 0, sample: 0}; v.on('request', (r) => { const u = r.url(); if (/\/api\/tts$/.test(u)) hits.tts++; if (/\/api\/stt$/.test(u)) hits.stt++; if (/\/api\/voix(\/|$)/.test(u)) hits.voix++; if (/\/api\/sample$/.test(u)) hits.sample++; });
    await v.addInitScript(() => {
      try { const s0 = JSON.parse(localStorage.getItem('jarvis.settings') || '{}'); s0.orbe = 'dictee'; localStorage.setItem('jarvis.settings', JSON.stringify(s0)); } catch (e) { /* rien */ }   /* 0.31.0 : ici, la dictée d'une question (mains libres coupées) */
      const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC(), osc = ac.createOscillator(), g = ac.createGain(), dest = ac.createMediaStreamDestination();
      g.gain.value = 0; osc.frequency.value = 220; osc.connect(g); g.connect(dest); osc.start();
      window.__talk = (ms) => { ac.resume(); const t0 = ac.currentTime + 0.02; g.gain.setValueAtTime(0.6, t0); g.gain.setValueAtTime(0, t0 + ms / 1000); };
      window.__gum = 0; window.__stops = 0; navigator.mediaDevices.getUserMedia = async (c) => { window.__gum++; window.__gumC = c; await ac.resume(); const s = dest.stream.clone(); s.getTracks().forEach((t) => { const st = t.stop.bind(t); t.stop = () => { window.__stops++; st(); }; }); return s; };
    });
    await v.goto(BASE + '/?serveur#accueil'); await v.waitForTimeout(3000);
    const st = () => v.evaluate(() => ({chat: !document.getElementById('chat').hidden, strip: (document.querySelector('#chat .dict-txt') || {}).textContent || '', val: (document.getElementById('chat-in') || {}).value, note: (document.querySelector('#chat .dict-note') || {}).textContent || '', on: (document.getElementById('dict-btn') || {className: ''}).className.includes('is-on'), moi: [...document.querySelectorAll('#chat .msg.me')].map((x) => x.textContent), eux: [...document.querySelectorAll('#chat .msg.them p')].map((x) => x.textContent), kind: window.JarvisVoice.dictKind(), say: window.JarvisVoice.sayKind(), dict: window.JarvisVoice.dictating(), gum: window.__gum, stops: window.__stops, page: !!document.querySelector('.jv')}));
    await v.tap('.talk-slot .jv-btn'); await v.waitForTimeout(1500);
    let s0 = await st(); const c0 = await v.evaluate(() => window.__gumC && window.__gumC.audio), n0 = s0.moi.length;   /* la discussion générale garde ses messages d'avant */
    ok('un seul Claude : l\'orbe ouvre la discussion avec Claude et écoute par Whisper du serveur (plus de page vocale, plus de cerveau à part)', s0.chat && !s0.page && s0.kind === 'whisper' && /écoute/.test(s0.strip) && s0.on && s0.gum === 1 && c0 && c0.echoCancellation === true && hits.voix === 0, JSON.stringify([s0, c0, hits]));
    await v.evaluate(() => window.__talk(900)); await v.waitForTimeout(3600); s0 = await st();
    ok('dictée : Whisper écrit la phrase dans le champ, le micro se referme, rien ne part sans « Envoyer »', s0.val === 'Quelle heure est-il' && /Relis/.test(s0.note) && !s0.on && !s0.dict && s0.stops >= 1 && s0.moi.length === n0 && hits.stt === 1 && hits.sample === 0, JSON.stringify([s0, hits]));
    await v.screenshot({path: SH + 'dictee-whisper.png'});
    await v.tap('#chat .lire-toggle'); await v.waitForTimeout(300);
    await v.tap('#chat .chat-row .btn.main'); await v.waitForTimeout(5000); const s1 = await st();
    ok('dictée : « Envoyer » pose la question à Claude (celui de la page, avec ses données) ; « Lecture : oui » la fait lire par Pierre', s1.say === 'serveur' && s1.moi.length === n0 + 1 && /Quelle heure est-il/.test(s1.moi[n0]) && s1.eux.length >= 2 && hits.sample === 1 && hits.voix === 0 && hits.tts >= 1, JSON.stringify([s1.say, s1.moi, s1.eux.map((x) => x.slice(0, 60)), hits]));
    /* « J'ai fini » : une longue phrase, coupée d'un appui : elle part à l'écriture tout de suite, sans attendre le silence */
    await v.tap('#dict-btn'); await v.waitForTimeout(900); await v.evaluate(() => window.__talk(6000)); await v.waitForTimeout(2200);
    const mid = await st(); await v.tap('#chat .dict-fin'); await v.waitForTimeout(1500); const s2 = await st();
    ok('dictée : « J\'ai fini » envoie la phrase à l\'écriture sans attendre que tu te taises', /entends/.test(mid.strip) && s2.val === 'Raconte lentement ta journée' && !s2.on && hits.stt === 2, JSON.stringify([mid.strip, s2.val, s2.on, hits]));
    /* annuler : le micro se referme, le champ garde ce qui y était */
    await v.tap('#dict-btn'); await v.waitForTimeout(900); const s3 = await st(); await v.tap('#chat .dict-no'); await v.waitForTimeout(600); const s4 = await st();
    ok('dictée : « Annuler » referme le micro et garde le champ', s3.on && !s4.on && !s4.dict && s4.val === 'Raconte lentement ta journée' && s4.stops >= 3, JSON.stringify([s3.on, s4]));
    await v.close(); }
  /* 0.31.0 : mains libres — l'orbe garde le micro ouvert ; chaque phrase part seule à Claude (le même, avec ses données) ; la réponse est lue
     dès sa première phrase, puis il réécoute ; ta voix le coupe pendant qu'il parle ; « c'est tout » termine ; « Mains libres : non » rend la dictée */
  { const v = await ctx.newPage(); v.on('pageerror', (e) => errs.push('mains libres : ' + e.message));
    const hits = {tts: 0, stt: 0, sample: 0, rapide: 0, tour: [], plain: []}, entendu = []; v.on('request', (r) => { const u = r.url(); if (/\/api\/tts$/.test(u)) hits.tts++; if (/\/api\/stt$/.test(u)) { hits.stt++; (r.headers()['x-tour'] ? hits.tour : hits.plain).push(Date.now()); } if (/\/api\/sample$/.test(u)) hits.sample++; if (/\/api\/rapide$/.test(u)) hits.rapide++; });
    v.on('response', (r) => { if (/\/api\/stt$/.test(r.url())) r.text().then((t) => entendu.push(t.slice(0, 80))).catch(() => {}); });
    await v.addInitScript(() => {
      try { const s0 = JSON.parse(localStorage.getItem('jarvis.settings') || '{}'); s0.orbe = 'conversation'; localStorage.setItem('jarvis.settings', JSON.stringify(s0)); } catch (e) { /* rien */ }
      const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC(), osc = ac.createOscillator(), g = ac.createGain(), dest = ac.createMediaStreamDestination();
      g.gain.value = 0; osc.frequency.value = 220; osc.connect(g); g.connect(dest); osc.start();
      window.__talk = (ms) => { ac.resume(); const t0 = ac.currentTime + 0.02; g.gain.setValueAtTime(0.6, t0); g.gain.setValueAtTime(0, t0 + ms / 1000); };
      window.__gum = 0; window.__stops = 0; navigator.mediaDevices.getUserMedia = async (c) => { window.__gum++; await ac.resume(); const s = dest.stream.clone(); s.getTracks().forEach((t) => { const st = t.stop.bind(t); t.stop = () => { window.__stops++; st(); }; }); return s; };
    });
    await v.goto(BASE + '/?serveur#accueil'); await v.waitForTimeout(3000);
    const st = () => v.evaluate(() => ({chat: !document.getElementById('chat').hidden, strip: (document.querySelector('#chat .mains-strip .dict-txt') || {}).textContent || '', etat: (document.querySelector('#chat .mains-strip') || {dataset: {}}).dataset.s || '', toggle: (document.querySelector('#chat .mains-toggle') || {}).textContent || '', dictBtn: !!document.getElementById('dict-btn'), val: (document.getElementById('chat-in') || {}).value, moi: [...document.querySelectorAll('#chat .msg.me')].map((x) => x.textContent), eux: [...document.querySelectorAll('#chat .msg.them p')].map((x) => x.textContent), conv: window.JarvisVoice.conversing(), gum: window.__gum, stops: window.__stops}));
    await v.tap('.talk-slot .jv-btn'); await v.waitForTimeout(1500);
    let s0 = await st(); const n0 = s0.moi.length;
    ok('mains libres : l\'orbe ouvre la discussion avec Claude, micro ouvert pour toute la conversation (écoute Whisper du serveur)', s0.chat && s0.conv && /écoute/.test(s0.strip) && !s0.toggle && !s0.dictBtn && s0.gum === 1, JSON.stringify(s0));
    let tT = Date.now(); await v.evaluate(() => window.__talk(900)); await v.waitForTimeout(4500); let s1 = await st();
    /* 0.36.0 : « Voix plus vive » — fin de phrase par Smart Turn (faux modèle : une phrase courte est finie) : elle part dès 0,25 s de pause,
       écrite dans la même réponse (un seul envoi) ; l'heure est répondue par le serveur sans Claude (aucune question à Claude), lue par Pierre */
    ok('mains libres : phrase finie (Smart Turn) : elle part dès 0,25 s de pause, écrite dans le même envoi ; l\'heure répondue sans Claude, lue par Pierre, puis il réécoute', s1.moi.length === n0 + 1 && /quelle heure est-il/i.test(s1.moi[n0]) && /^Il est \d{1,2} h/.test(s1.eux[s1.eux.length - 1] || '') && hits.sample === 0 && hits.rapide === 1 && hits.tour.length === 1 && hits.plain.length === 0 && hits.tour[0] - tT < 1500 && hits.tts >= 1 && s1.conv && s1.stops === 0 && s1.etat === 'listening' && s1.val === '', JSON.stringify([s1.moi.slice(-1), s1.eux.slice(-1), s1.etat, s1.stops, hits.sample, hits.rapide, hits.tour.map((x) => x - tT), hits.plain.length]));
    ok('mains libres : la réponse instantanée porte l\'étiquette « Instantané »', await v.evaluate(() => [...document.querySelectorAll('#chat .msg-mod')].some((x) => x.textContent === 'Instantané')));
    await v.screenshot({path: SH + 'mains-libres.png'});
    /* une longue réponse (lente) est coupée par sa voix : sa nouvelle phrase part à la place */
    tT = Date.now(); await v.evaluate(() => window.__talk(1800)); await v.waitForTimeout(4400);   /* 0.36.0 : « pas finie » (Smart Turn) : il attend 1,6 s de silence au lieu de 0,7 */
    const mid = await st(), tours = hits.tour.slice(1).map((x) => x - tT), plains = hits.plain.map((x) => x - tT);
    ok('mains libres : phrase « pas finie » (Smart Turn) : rien ne part à 0,7 s de silence ; elle part après 1,6 s, à Claude', tours.length === 1 && tours[0] < 2400 && plains.length === 1 && plains[0] >= 3000 && hits.sample === 1 && /lentement/i.test(mid.moi[mid.moi.length - 1]), JSON.stringify([tours, plains, hits.sample, mid.moi.slice(-1)]));
    await v.evaluate(() => window.__talk(900)); await v.waitForTimeout(4500); const s2 = await st();
    ok('mains libres : pendant que Claude répond (et parle), ta voix le coupe et ta nouvelle phrase part à la place', /lentement/i.test(mid.moi[mid.moi.length - 1]) && ['thinking', 'speaking', 'hearing', 'transcribing'].includes(mid.etat) && s2.moi.length === n0 + 3 && /quelle heure est-il/i.test(s2.moi[s2.moi.length - 1]) && hits.sample === 1 && hits.rapide === 3 && s2.conv, JSON.stringify([mid.etat, mid.moi.slice(-1), s2.moi.slice(-2), hits]));
    /* « c'est tout » : fin de la conversation, micro fermé ; l'orbe la reprend */
    await v.evaluate(() => window.__talk(3800)); await v.waitForTimeout(5200); const s3 = await st();
    ok('mains libres : « c\'est tout » termine la conversation et ferme le micro (rien n\'est envoyé à Claude)', !s3.conv && !s3.strip && s3.stops >= 1 && hits.sample === 1 && hits.rapide === 3 && s3.moi.length === s2.moi.length, JSON.stringify([s3.conv, s3.stops, hits, s3.moi.length, s3.etat, entendu]));
    /* après « c'est tout » : le micro du champ dicte une seule question ; l'orbe reprend la conversation continue (plus de bouton piège dans l'en-tête) */
    const s4 = await st(); await v.tap('#dict-btn'); await v.waitForTimeout(700); const dicte = await v.evaluate(() => window.JarvisVoice.dictating());
    await v.evaluate(() => { const n = document.querySelector('#chat .dict-no'); if (n) n.click(); }); await v.waitForTimeout(400);
    await v.tap('#chat .chat-head .btn.ghost'); await v.waitForTimeout(600); await v.tap('.talk-slot .jv-btn'); await v.waitForTimeout(1200); const s6 = await st();
    ok('mains libres : pas de bouton qui les coupe dans l\'en-tête ; le micro du champ dicte une question ; l\'orbe reprend la conversation continue', !s4.toggle && s4.dictBtn && dicte && s6.conv && /écoute/.test(s6.strip), JSON.stringify([s4.toggle, s4.dictBtn, dicte, s6.conv, s6.strip]));
    await v.tap('#chat .mains-fin').catch(() => {});
    await v.close(); }
  /* 0.33.0 : l'activité en direct — une mission lancée apparaît sur l'accueil (« En ce moment ») avec son plan et ce qu'elle fait, et sur l'orbe (pastille) ;
     elle en part une fois finie ; Suivi montre ses étapes */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('activité : ' + e.message));
    await q.goto(BASE + '/?serveur#accueil'); await q.waitForTimeout(3000);
    await q.evaluate(() => window.JarvisServeur.mission('planifie la comparaison des assurances habitation'));
    await q.waitForTimeout(1500);
    const a1 = await q.evaluate(() => { const c = document.getElementById('act-card'); return {vu: !!c && !c.hidden, txt: c ? c.textContent : '', badge: (document.querySelector('.jv-btn') || {dataset: {}}).dataset.act || '', etapes: c ? c.querySelectorAll('.act-etapes li').length : 0}; });
    await q.screenshot({path: SH + 'activite-en-direct.png'});
    ok('activité en direct : la mission apparaît sur l\'accueil avec son plan et ce qu\'elle fait à l\'instant, et l\'orbe porte une pastille', a1.vu && /Claude · Mission/.test(a1.txt) && /Recherche web : « assurance habitation T3/.test(a1.txt) && a1.etapes === 3 && a1.badge === '1', JSON.stringify([a1.badge, a1.etapes, a1.txt.slice(0, 200)]));
    await q.waitForTimeout(4500);
    const a2 = await q.evaluate(() => { const c = document.getElementById('act-card'); return {txt: c && !c.hidden ? c.textContent : '', badge: (document.querySelector('.jv-btn') || {dataset: {}}).dataset.act || ''}; });
    ok('activité en direct : la mission finie quitte « En ce moment » et la pastille de l\'orbe', !/Claude · Mission/.test(a2.txt) && !a2.badge, JSON.stringify(a2));
    await q.goto(BASE + '/?serveur#suivi'); await q.waitForTimeout(800);
    await q.evaluate(() => window.JarvisServeur.mission('planifie aussi le budget des vacances')); await q.waitForTimeout(400);
    await q.evaluate(() => { const b = document.querySelector('#missions'); if (b) b.scrollIntoView(); }); await q.waitForTimeout(1400);
    const a3 = await q.evaluate(() => { const it = [...document.querySelectorAll('#missions .mis-it')].find((x) => /budget des vacances/.test(x.textContent)); if (it) it.open = true; return it ? {etapes: it.querySelectorAll('.mis-etapes li').length, outil: (it.querySelector('.mis-outil') || {}).textContent || '', txt: it.textContent.slice(0, 160)} : null; });
    ok('missions : Suivi montre le plan de la mission en cours et ce qu\'elle fait à l\'instant', a3 && a3.etapes === 3 && /À l’instant : Recherche web/.test(a3.outil), JSON.stringify(a3));
    await q.close(); }
  /* 0.24.0 : chercher un produit à partir d'une idée, par le serveur (faux Claude) */
  { await p.goto(BASE + '/?serveur#achats'); await p.waitForTimeout(3500);
    await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
    await p.fill('#ix-idee', 'maison de poupée'); await p.fill('#ix-pour', 'fille de 3 ans'); await p.fill('#ix-max', '60'); await p.selectOption('#ix-n', '4');
    await p.tap('.idee-go'); await p.waitForTimeout(1500);
    const w = await p.evaluate(() => document.querySelector('.view-title').textContent);
    await p.waitForTimeout(9500);
    const r = await p.evaluate(() => ({cards: document.querySelectorAll('.idee-card').length, prix: [...document.querySelectorAll('.idee-prix b')].map((x) => parseFloat(x.textContent.replace(/\s/g, '').replace(',', '.'))), conseil: !!document.querySelector('.cmp-key'), age: (document.querySelector('.idee-age') || {}).textContent || ''}));
    ok('idées (serveur) : lancée depuis Achats, sa page attend puis montre les propositions dans le budget, au nombre demandé', /maison de poupée/i.test(w) && r.cards === 4 && r.prix.every((v) => v <= 60) && r.conseil && r.age === 'dès 3 ans', w + ' ' + JSON.stringify(r));
    const l = await p.evaluate(() => window.JarvisServeur.idees());
    ok('idées (serveur) : gardée sur le serveur, retrouvée dans « Mes recherches d\'idées »', l && l.recherches.some((x) => x.idee === 'maison de poupée' && x.statut === 'pret' && x.max === 60 && x.n === 4));
    await p.screenshot({path: SH + 'idees-serveur.png'}); }
  /* 0.28.0 : un événement sur plusieurs jours, créé depuis l'agenda, arrive chez Google en journées entières (fin au lendemain du dernier jour) */
  { const isoN = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    await p.goto(BASE + '/?serveur#agenda'); await p.waitForTimeout(3000);
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Nouvel événement important/.test(x.textContent)).click()); await p.waitForTimeout(600);
    await p.fill('.ev-form input[type=text]', 'Séjour de test'); await p.fill('.ev-form input[type=date]:not(.ev-fin)', isoN(3)); await p.fill('.ev-form .ev-fin', isoN(6)); await p.waitForTimeout(150);
    await p.evaluate(() => { const c = [...document.querySelectorAll('.ev-form .check input')]; if (c[1] && c[1].checked) c[1].click(); document.querySelector('.ev-form button[type=submit]').click(); }); await p.waitForTimeout(8000);
    const ev = (FG.events.primary || []).find((e) => e.summary === 'Séjour de test'), rows = await p.evaluate(() => [...document.querySelectorAll('.mlist .dl-row')].map((x) => x.textContent).filter((t) => /Séjour de test/.test(t)));
    const dansLeMois = [3, 4, 5, 6].filter((n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getMonth() === new Date().getMonth(); }).length;
    ok('plusieurs jours (serveur) : l\'événement part chez Google en journées entières, du premier jour au lendemain du dernier, en rouge, puis est relu sur chacun de ses jours', !!ev && ev.start.date === isoN(3) && ev.end.date === isoN(7) && String(ev.colorId) === '11' && !ev.start.dateTime && rows.length === dansLeMois, JSON.stringify([ev, rows, dansLeMois])); }
  /* 0.27.0 : mise à jour proposée au lancement (comme Panier). Second serveur sur un dépôt git de test en retard d'une version, relancé après
     son arrêt comme par systemd ; deux « appareils » : celui qui accepte, et un autre resté sur l'ancienne version. */
  { const R = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-maj-e2e-')), ORI = path.join(R, 'origine.git'), SRC = path.join(R, 'source'), CLO = path.join(R, 'serveur'), D2 = path.join(R, 'data');
    const GENV = {...process.env, GIT_AUTHOR_NAME: 'banc', GIT_AUTHOR_EMAIL: 'banc@exemple.invalid', GIT_COMMITTER_NAME: 'banc', GIT_COMMITTER_EMAIL: 'banc@exemple.invalid', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null'};
    const g = (cwd, ...a) => execFileSync('git', a, {cwd, stdio: ['ignore', 'pipe', 'pipe'], env: GENV}).toString().trim();
    const ecris = (f, t) => { fs.mkdirSync(path.dirname(path.join(SRC, f)), {recursive: true}); fs.writeFileSync(path.join(SRC, f), t); };
    const pousse = (m) => { g(SRC, 'add', '-A'); g(SRC, 'commit', '-q', '-m', m); g(SRC, 'push', '-q', 'origin', 'main'); };
    fs.mkdirSync(SRC, {recursive: true}); g(R, 'init', '-q', '--bare', '-b', 'main', ORI); g(SRC, 'init', '-q', '-b', 'main'); g(SRC, 'remote', 'add', 'origin', ORI);
    ecris('jarvis-os/server/server.mjs', "const VERSION = '1.0.0';\n"); pousse('départ'); g(R, 'clone', '-q', ORI, CLO);
    ecris('jarvis-os/server/server.mjs', "const VERSION = '9.9.9';\n"); pousse('nouvelle version');
    const P2 = PORT + 1001, B2 = 'http://127.0.0.1:' + P2, env2 = {...env, ...GENV, PORT: String(P2), JARVIS_DATA: D2, JARVIS_REPO: CLO, JARVIS_MAJ: '1', JARVIS_OS_DIR: path.join(HERE, '..')};   /* le dépôt de test ne sert qu'à git : l'app servie reste celle du banc */
    const code2 = execFileSync(process.execPath, [SRV + '/server.mjs', 'pair'], {env: env2}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
    let s2, fini = false, relances = 0;
    const lance2 = () => new Promise((z) => { s2 = spawn(process.execPath, [SRV + '/server.mjs'], {env: env2, stdio: ['ignore', 'pipe', 'pipe']}); s2.stdout.once('data', z); s2.once('exit', () => { if (!fini) { relances++; setTimeout(lance2, 1500); } }); });   /* « systemd » : relancé 1,5 s après son arrêt */
    await lance2();
    try {
    const tok2 = (await (await fetch(B2 + '/api/pair', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({code: code2, device: 'iPhone maj'})})).json()).token;
    const ouvre = async () => { const c = await b.newContext({...devices['iPhone 15 Pro Max']}); await c.addInitScript((t) => { try { localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: t})); } catch (e) { /* rien */ } }, tok2); const q = await c.newPage(); q.on('pageerror', (e) => errs.push('maj : ' + e.message)); await q.goto(B2 + '/?serveur#accueil'); return q; };
    const vue = (q) => q.evaluate(() => { const m = document.getElementById('maj'); return {ouvert: !!m && !m.hidden, etape: m && m.querySelector('.maj-card') ? m.querySelector('.maj-card').dataset.etape : '', txt: m ? m.textContent : ''}; });
    const autre = await ouvre(); await autre.waitForTimeout(3200); await autre.tap('#maj-non'); await autre.waitForTimeout(300); await autre.evaluate(() => { window.__marque = 'ancienne page'; });
    const q = await ouvre(); await q.waitForTimeout(3200); let v = await vue(q);
    ok('mise à jour : à l\'ouverture, l\'app annonce la nouvelle version (« Plus tard » ou « Mettre à jour »)', v.ouvert && v.etape === 'question' && /Nouvelle version disponible/.test(v.txt) && /JARVIS 9\.9\.9 est prêt/.test(v.txt) && /Plus tard/.test(v.txt) && /Mettre à jour/.test(v.txt), JSON.stringify(v));
    await q.screenshot({path: SH + 'maj-question.png'});
    await q.tap('#maj-non'); await q.waitForTimeout(300); await q.tap('.fav-row .tab[data-tab="agenda"]'); await q.waitForTimeout(2500); v = await vue(q);
    ok('mise à jour : « Plus tard » vaut pour l\'ouverture en cours (une seule vérification, au lancement)', !v.ouvert && relances === 0, JSON.stringify(v));
    await q.reload(); await q.waitForTimeout(3200); v = await vue(q); const avant = await (await fetch(B2 + '/api/health')).json();
    await q.evaluate(() => { window.__marque = 'avant la mise à jour'; }); await q.tap('#maj-oui'); await q.waitForTimeout(600); const cours = await vue(q);
    let recharge = false; for (let i = 0; i < 40 && !recharge; i++) { await q.waitForTimeout(500); recharge = await q.evaluate(() => !window.__marque && !!window.JarvisMaj).catch(() => false); }
    await q.waitForTimeout(2500); const apres = await (await fetch(B2 + '/api/health')).json(), fin = await q.evaluate(() => ({maj: !!(document.getElementById('maj') && !document.getElementById('maj').hidden), toast: [...document.querySelectorAll('#toasts *')].map((x) => x.textContent).join(' ')}));
    ok('mise à jour : la question revient à l\'ouverture suivante ; sur oui, le serveur redémarre une fois, l\'app attend le nouveau code puis se recharge seule, sans reposer la question', v.ouvert && cours.etape === 'cours' && recharge && relances === 1 && apres.commit && apres.commit !== avant.commit && !fin.maj && /JARVIS est à jour/.test(fin.toast), JSON.stringify([v.etape, cours, recharge, relances, avant.commit, apres.commit, fin]));
    await q.screenshot({path: SH + 'maj-faite.png'});
    /* l'autre appareil, resté sur l'ancienne version : au retour dans l'app, il se recharge seul, une fois, sans rien redémarrer */
    await autre.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); let r2 = false; for (let i = 0; i < 16 && !r2; i++) { await autre.waitForTimeout(500); r2 = await autre.evaluate(() => !window.__marque && !!window.JarvisMaj).catch(() => false); }
    await autre.waitForTimeout(2500); const a2 = await vue(autre);
    ok('mise à jour : l\'autre appareil, resté sur l\'ancienne version, se recharge seul à son retour dans l\'app, sans redémarrer le serveur', r2 && relances === 1 && !a2.ouvert, JSON.stringify([r2, relances, a2]));
    /* Réglages : le bouton force la vérification */
    await q.goto(B2 + '/?serveur#reglages'); await q.waitForTimeout(2500); await q.tap('#set-maj'); await q.waitForTimeout(1500);
    ok('mise à jour : Réglages, « Mettre à jour le serveur » force la vérification et dit que JARVIS est à jour', await q.evaluate(() => /JARVIS est à jour \(version /.test((document.querySelector('#set-maj + .set-msg') || {}).textContent || '')), await q.evaluate(() => [...document.querySelectorAll('.set-msg')].map((x) => x.textContent).join(' | ')));
    await q.context().close(); await autre.context().close();
    } finally { fini = true; try { s2.kill(); } catch (e) { /* rien */ } fs.rmSync(R, {recursive: true, force: true}); } }
} catch (e) { ok('exception', false, e.stack); }
ok('aucune erreur de page', !errs.length, errs.join(' | '));
console.log(out.join('\n')); const bad = out.filter((l) => l.startsWith('ÉCHEC')).length; console.log(bad ? bad + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications).');
await b.close(); srv.kill(); FG.close();
