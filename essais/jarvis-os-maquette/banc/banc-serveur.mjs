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
const env = {...process.env, JARVIS_VOIX_GOOGLE_URL: 'http://127.0.0.1:' + GVS.address().port, JARVIS_PUSH_ALLOW_HTTP: '1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', JARVIS_GOOGLE_FAKE: FG.url, PORT: String(PORT), JARVIS_DATA: DATA, CLAUDE_BIN: SRV + '/tests/fake-claude.mjs', JARVIS_TTS_HELPER: SRV + '/tests/fake-tts.mjs', JARVIS_STT_HELPER: SRV + '/tests/fake-stt.mjs', JARVIS_TOUR_HELPER: SRV + '/tests/fake-tour.mjs', JARVIS_RD_RACINE: 'rda', JARVIS_VOICE_MODEL: path.join(DATA, 'fausse-voix.onnx'), JARVIS_MAJ: '0',
  JARVIS_AUDIO_PY: process.execPath, JARVIS_AUDIO_HELPER: SRV + '/tests/fake-audio.mjs', JARVIS_FFMPEG: ''};   /* 0.64.0 : le faux convertisseur à la place de PyAV ; pas de ffmpeg */   /* 0.27.0 : pas de question de mise à jour pendant le banc (elle a son essai à part, sur un dépôt de test) */
fs.mkdirSync(DATA, {recursive: true}); fs.writeFileSync(path.join(DATA, 'fausse-voix.onnx'), 'faux');   /* 0.25.0 : la voix Pierre « installée » (fausse), pour la lecture des réponses */
const code = execFileSync(process.execPath, [SRV + '/server.mjs', 'pair'], {env}).toString().match(/: ([A-Z0-9]{4}-[A-Z0-9]{4})/)[1];
const srv = spawn(process.execPath, [SRV + '/server.mjs'], {env, stdio: ['ignore', 'pipe', 'pipe']}); await new Promise((r) => srv.stdout.once('data', r));
const out = [], errs = []; const ok = (n, c, i) => out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (i ? ' :: ' + i : ''));
const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']}); const ctx = await b.newContext({...devices['iPhone 15 Pro Max']});
await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.banc.reglages', 'entier'); } catch (e) { /* rien */ } });   /* Réglages a des onglets ; ce banc lit la page entière */
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.route(FG.url + '/auth**', (route) => { const u = new URL(route.request().url()); route.fulfill({status: 302, headers: {location: BASE + '/api/google/callback?state=' + u.searchParams.get('state') + '&code=CODE-OK'}}); });
try {
  await p.goto(BASE + '/?serveur#reglages'); await p.waitForTimeout(2500);
  ok('mode serveur choisi', await p.evaluate(() => window.__JARVIS_MODE === 'serveur' && !!window.JarvisServeur));
  await p.fill('#porte-code', code); await p.tap('#porte-relier'); await p.waitForTimeout(4500);   /* 0.82.0 : un appareil pas relié ne voit que la porte ; relié, la page se recharge */
  ok('iPhone relié par code', await p.evaluate(() => window.JarvisServeur.linked() && /relié à/.test(document.querySelector('.set-wrap').textContent)));
  await p.screenshot({path: SH + 'set-1.png'});
  const inputs = await p.$$('.set-card input'); await inputs[0].fill(FG.client.id); await inputs[1].fill(FG.client.secret);
  await p.tap('button:has-text("Enregistrer")'); await p.waitForTimeout(800);
  ok('identifiant Google enregistré', await p.evaluate(() => /Enregistré sur ton serveur/.test(document.querySelector('.set-wrap').textContent)));
  await p.tap('button:has-text("Connecter Google")'); await p.waitForTimeout(1500);
  ok('retour de Google : page « relié »', /Google est relié/.test(await p.textContent('body')), (await p.textContent('body')).slice(0, 80));
  await p.goto(BASE + '/?serveur#reglages'); await p.waitForTimeout(2500);
  ok('Réglages : compte Google affiché', await p.evaluate(() => /proprietaire@example\.org/.test(document.querySelector('.set-wrap').textContent)));
  /* 0.73.0 — lot C (« Retirer dans Réglages ») : la carte « Serveur JARVIS » liste les appareils reliés ; celui-ci, nommé par son genre, sans bouton */
  { const ap = await p.evaluate(() => [...document.querySelectorAll('.set-card .app-it')].map((x) => ({t: x.innerText.replace(/\s+/g, ' ').trim(), btn: x.querySelectorAll('button').length})));
    ok('Réglages (0.73.0) : appareils reliés : « JARVIS OS · iPhone · relié le … », « Cet appareil », sans « Retirer » sur le sien', ap.length === 1 && /^JARVIS OS · iPhone · relié le \d{1,2} \S+ à \d\dh\d\d Cet appareil$/.test(ap[0].t) && ap[0].btn === 0, JSON.stringify(ap)); }
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
  { await p.tap('.tab[data-tab="espaces"]').catch(() => p.click('.tab[data-tab="espaces"]')); await p.waitForTimeout(800);   /* refonte UX : Argent est une tuile d'Espaces */
    ok('Radar : le serveur répond, la rubrique Argent est une tuile d’Espaces', await p.evaluate(() => !!document.querySelector('.esp-tile[data-go="argent"]')));
    await p.tap('.tab[data-tab="accueil"]').catch(() => p.click('.tab[data-tab="accueil"]')); await p.waitForTimeout(600); }
  await p.screenshot({path: SH + 'os-live.png'});
  { await p.goto(BASE + '/?serveur#argent'); await p.waitForTimeout(9000);
    const a1 = await p.evaluate(() => ({props: [...document.querySelectorAll('.rad-prop')].map((x) => x.innerText.replace(/\s+/g, ' ')), defaut: !!document.querySelector('.rad-paie-defaut'), big: (document.querySelector('.rad-big') || {}).textContent || '', vide: /Rien de validé pour l’instant/.test((document.querySelector('.rad-hero p') || {}).textContent || '')}));
    ok('Radar (serveur) : la première ouverture lit les mails ; la facture mensuelle inventée devient une dépense à valider (48,20 € le 12) ; la paie pas encore réglée est signalée, et le total à 0 € expliqué (rien de validé)', a1.props.length === 1 && /Énergie Exemple/.test(a1.props[0]) && /le 12 de chaque mois/.test(a1.props[0]) && /48,20 €/.test(a1.props[0]) && a1.defaut && a1.vide, JSON.stringify(a1));
    await p.evaluate(() => { const b = document.querySelector('.rad-prop .row-actions button'); if (b) b.click(); }); await p.waitForTimeout(1500);
    const a2 = await p.evaluate(() => ({props: document.querySelectorAll('.rad-prop').length, rules: [...document.querySelectorAll('.rad-rule')].map((x) => x.innerText.replace(/\s+/g, ' '))}));
    await p.reload(); await p.waitForTimeout(4000);
    const a3 = await p.evaluate(() => document.querySelectorAll('.rad-rule').length);
    ok('Radar (serveur) : « Ajouter » la garde sur le serveur (« lu dans tes mails »), toujours là après un rechargement', a2.props === 0 && a2.rules.length === 1 && /Énergie Exemple/.test(a2.rules[0]) && /lu dans tes mails/.test(a2.rules[0]) && a3 === 1, JSON.stringify([a2, a3]));
    /* 0.46.0 : l'app plantait à l'ouverture d'Argent : chaque rendu relançait une lecture du serveur, sans fin */
    { let n = 0; const compte = (r) => { try { if (new URL(r.url()).pathname === '/api/radar') n++; } catch { /* rien */ } };
      p.on('request', compte); await p.waitForTimeout(8000); p.off('request', compte);
      ok('Radar (serveur) : la page ne relit pas le serveur en boucle (au plus une lecture en 8 s, lecture des mails finie)', n <= 1, n + ' lectures'); }
    /* 0.68.0 (ses retours du 23/11/2026) : le paiement en 4 fois inventé est un achat de « En plusieurs fois » ; « Tout relire » relit tout en le disant, puis donne son bilan */
    const pl = await p.evaluate(() => ({row: (document.querySelector('.rad-plans .rad-plan') || {}).innerText || '', h: (document.querySelector('.rad-plans .panel-h') || {}).innerText || ''}));
    ok('Radar 0.68 (serveur) : le paiement en 4 fois lu dans les mails est un achat de « En plusieurs fois » (PayPal, 1 sur 4 payée, 60 € restent)', /BOUTIQUE EXEMPLE/.test(pl.row) && /PayPal · 4 fois · 80,00 €/.test(pl.row) && /1 sur 4 payée/.test(pl.row) && /60,00 € restent/.test(pl.h), JSON.stringify(pl));
    await p.evaluate(() => document.querySelector('.rad-relire').click()); await p.waitForTimeout(500);
    const rl1 = await p.evaluate(() => ({scan: (document.querySelector('.rad-scan') || {}).innerText || '', toast: [...document.querySelectorAll('.toast')].map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')}));
    await p.waitForTimeout(9000);
    const rl2 = await p.evaluate(() => ({scan: (document.querySelector('.rad-scan') || {}).innerText || '', btn: (document.querySelector('.rad-relire') || {}).textContent || '', rules: document.querySelectorAll('.rad-rule').length, plans: document.querySelectorAll('.rad-plans .rad-plan').length}));
    ok('Radar 0.68 (serveur) : « Tout relire » relit les 13 mois en le disant, puis donne son bilan ; la dépense ajoutée et le paiement en 4 fois restent', (/Je relis tes 13 derniers mois/.test(rl1.scan) || /Relecture finie/.test(rl1.scan)) && /Je relis tes 13 derniers mois de mails/.test(rl1.toast)
      && /Relecture finie : \d+ mails lus/.test(rl2.scan) && /1 en plusieurs fois/.test(rl2.scan) && /Tout relire \(13 mois\)/.test(rl2.btn) && rl2.rules === 1 && rl2.plans >= 1, JSON.stringify([rl1, rl2]));
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
  await p.evaluate(() => [...document.querySelectorAll('.hud-act button')].find((x) => /Parler à JARVIS/.test(x.textContent)).click()); await p.waitForTimeout(800);   /* refonte UX : « Parler à JARVIS » sur l'écran de JARVIS */
  await p.fill('#chat-in', 'Fais un ordre de test pour Kairos'); await p.click('#chat .chat-row .btn.main'); await p.waitForTimeout(2500);
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
  /* 0.62.0 (son choix du 22/11/2026) : un proche reçoit un lien d'invitation, ouvre sa page sur son iPhone, envoie une tâche et voit son statut (prénoms inventés) */
  { const tk = await p.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken);
    const iv = await fetch(BASE + '/api/invites', {method: 'POST', headers: {authorization: 'Bearer ' + tk, 'content-type': 'application/json'}, body: JSON.stringify({nom: 'Lina'})}).then((x) => x.json());
    const ci = await b.newContext({...devices['iPhone 15 Pro Max']}), qi = await ci.newPage(); qi.on('pageerror', (e) => errs.push('invité : ' + e.message));
    await qi.goto(iv.lien + '&pour=Sami'); await qi.waitForTimeout(1500);
    const a0 = await qi.evaluate(() => ({titre: document.getElementById('titre').textContent, adresse: location.href, gardee: !!localStorage.getItem('jarvis.invite.cle'), siri: document.getElementById('adest').textContent, audio: !document.getElementById('siri-audio').hidden, dictee: !!document.getElementById('nomrac') && document.body.innerText.includes('Dicter le texte'), large: document.documentElement.scrollWidth <= innerWidth + 1}));
    await qi.fill('#texte', 'Acheter des couches pour demain'); await qi.click('#form button[type=submit]'); await qi.waitForTimeout(1500);
    const a1 = await qi.evaluate(() => ({msg: document.getElementById('msg').textContent, liste: [...document.querySelectorAll('#liste li')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())}));
    /* 0.73.0 (son choix du 23/11/2026, « Clé gardée après # ») : la clé reste après « # » (jamais envoyé au serveur), pour l'icône d'écran d'accueil */
    const cleLien = new URL(iv.lien).hash.match(/cle=([^&]+)/)[1];
    ok('invité : sa page s’ouvre par le lien (clé gardée dans son téléphone, et dans l’adresse après « # » depuis la 0.73.0), dit « Une tâche pour Sami », et d’abord « Dis Siri, envoie un message audio à Sami » (0.67, plus de dictée écrite) ; une tâche envoyée revient « C’est noté … pour demain » et s’affiche « À faire »',
      a0.titre === 'Une tâche pour Sami' && new URL(a0.adresse).hash === '#cle=' + cleLien + '&pour=Sami' && !new URL(a0.adresse).search && a0.gardee && a0.siri === 'Sami' && a0.audio && !a0.dictee && a0.large
      && a1.msg === 'C’est noté : « Acheter des couches pour demain », pour demain.' && a1.liste.length === 1 && /Acheter des couches pour demain/.test(a1.liste[0]) && /À faire/.test(a1.liste[0]), JSON.stringify([a0, a1]));
    await qi.screenshot({path: SH + 'invite.png'});
    /* rouverte sans rien après « # » (une icône d'avant, un favori) : la clé du téléphone est remise dans l'adresse, la page marche */
    const vus = []; qi.on('request', (r) => vus.push(r.url()));
    await qi.goto(BASE + '/invite/'); await qi.waitForTimeout(1500);
    const a2 = await qi.evaluate(() => ({adresse: location.href, titre: document.getElementById('titre').textContent, formulaire: !document.getElementById('envoi').hidden, sansCle: !document.getElementById('sans-cle').hidden, liste: document.querySelectorAll('#liste li').length}));
    ok('invité (0.73.0) : rouverte sans clé dans l’adresse, la clé gardée y est remise après « # » (avec « pour ») ; la page marche ; aucune requête ne porte la clé dans son adresse',
      new URL(a2.adresse).hash === '#cle=' + cleLien + '&pour=Sami' && a2.titre === 'Une tâche pour Sami' && a2.formulaire && !a2.sansCle && a2.liste === 1 && !vus.some((u) => u.includes(cleLien)), JSON.stringify([a2, vus.filter((u) => u.includes(cleLien))]));
    await ci.close();
    /* une icône posée sur l'écran d'accueil a un stockage vide : l'adresse seule (avec la clé après « # ») suffit */
    { const cv = await b.newContext({...devices['iPhone 15 Pro Max']}), qv = await cv.newPage(); qv.on('pageerror', (e) => errs.push('invité, icône : ' + e.message));
      await qv.goto(a2.adresse); await qv.waitForTimeout(1500);
      const a3 = await qv.evaluate(() => ({formulaire: !document.getElementById('envoi').hidden, titre: document.getElementById('titre').textContent, liste: document.querySelectorAll('#liste li').length}));
      ok('invité (0.73.0) : l’adresse gardée par l’icône d’écran d’accueil ouvre sa page sans rien dans le stockage (formulaire, « pour Sami », ses tâches)', a3.formulaire && a3.titre === 'Une tâche pour Sami' && a3.liste === 1, JSON.stringify(a3));
      await cv.close(); } }
  /* 0.64.0 (ses choix du 22/11/2026) : son message vocal, enregistré sur sa page (micro de test de Chromium), arrive dans JARVIS : sa voix joue
     d'elle-même, la fiche propose « C’est fait », « Dans 5 min », « Dans 15 min » ; elle voit « Faite ✓ » (prénoms inventés) */
  { const tk = await p.evaluate(() => JSON.parse(localStorage.getItem('jarvis.settings')).serverToken), AH = {authorization: 'Bearer ' + tk, 'content-type': 'application/json'};
    const iv = await fetch(BASE + '/api/invites', {method: 'POST', headers: AH, body: JSON.stringify({nom: 'Nour'})}).then((x) => x.json());
    const b2 = await chromium.launch({args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']});
    const ci = await b2.newContext({...devices['iPhone 15 Pro Max'], permissions: ['microphone']}), qi = await ci.newPage(); qi.on('pageerror', (e) => errs.push('invité vocal : ' + e.message));
    await qi.goto(iv.lien + '&pour=Sami'); await qi.waitForTimeout(1500);
    const v0 = await qi.evaluate(() => ({vocal: !document.getElementById('vocal').hidden, siri: document.getElementById('vnomrac').textContent, url: document.getElementById('vurl').textContent, dest: document.getElementById('vdest').textContent, encoder: !!document.getElementById('v-encoder'), etapes: [...document.querySelectorAll('ol li')].filter((li) => !li.hidden).every((li) => getComputedStyle(li).display === 'list-item'), large: document.documentElement.scrollWidth <= innerWidth + 1}));
    await qi.click('#enr'); await qi.waitForTimeout(2600); const enCours = await qi.evaluate(() => ({bouton: document.getElementById('enr').textContent, chrono: document.getElementById('chrono').textContent}));
    await qi.click('#enr'); await qi.waitForTimeout(2500);
    const v1 = await qi.evaluate(() => ({msg: document.getElementById('msg3').textContent, liste: [...document.querySelectorAll('#liste li')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())}));
    ok('vocal (sa page) : « Message pour Sami » vers /api/invite/vocal, sans étape AIFF (le son est gardé tel quel), étapes en liste numérotée (plus coupées en colonnes) ; le bouton enregistre (« ■ Envoyer », chrono), envoie sa voix, et la liste la marque 🎤',
      v0.vocal && v0.siri === 'Message pour Sami' && /\/api\/invite\/vocal$/.test(v0.url) && v0.dest === 'Sami' && !v0.encoder && v0.etapes && v0.large && enCours.bouton === '■ Envoyer' && /^● 0:0[2-3]$/.test(enCours.chrono)
      && /^Message vocal envoyé/.test(v1.msg) && v1.liste.length === 1 && /^🎤/.test(v1.liste[0]) && /À faire/.test(v1.liste[0]), JSON.stringify([v0, enCours, v1]));
    await qi.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); }); await qi.screenshot({path: SH + 'invite-vocal.png', fullPage: true});
    /* JARVIS ouvert : la page relit ce qu'elle a envoyé ; un lecteur espion note chaque son joué */
    const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('vocal reçu : ' + e.message));
    await q.addInitScript(() => { try { localStorage.removeItem('jarvis.recues.vues'); } catch (e) { /* rien */ } window.__joue = []; const o = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { if (/^blob:/.test(this.src)) window.__joue.push(this.src); return o.call(this); }; });
    await q.goto(BASE + '/?serveur'); await q.waitForTimeout(4500);
    const fiche = () => q.evaluate(() => { const s = document.getElementById('sheet'); return {ouverte: !!s && !s.hidden, kicker: ((s && s.querySelector('.sheet-kicker')) || {}).textContent || '', titre: ((s && s.querySelector('.sheet-title')) || {}).textContent || '', boutons: s ? [...s.querySelectorAll('button')].map((b) => b.textContent.trim()) : [], etat: ((s && s.querySelector('.rec-etat')) || {}).textContent || '', joue: window.__joue.length}; });
    const r0 = await fiche();
    ok('vocal (JARVIS ouvert) : sa voix joue d’elle-même, la fiche s’ouvre (« Écouter sa voix », « C’est fait », « Dans 5 min », « Dans 15 min ») et dit le prochain rappel',
      r0.ouverte && /^Message vocal de Nour · /.test(r0.kicker) && r0.boutons.some((x) => /^▶ Écouter sa voix/.test(x)) && ['C’est fait', 'Dans 5 min', 'Dans 15 min'].every((x) => r0.boutons.some((y) => y.startsWith(x))) && /^Rappel à \d\d:\d\d \(encore 6 au plus\)/.test(r0.etat) && r0.joue >= 1, JSON.stringify(r0));
    await q.screenshot({path: SH + 'vocal-recu.png'});
    await q.evaluate(() => { const b = [...document.querySelectorAll('#sheet button')].find((x) => x.textContent.trim().startsWith('C’est fait')); if (b) b.click(); }); await q.waitForTimeout(1500);
    let rc = await fetch(BASE + '/api/invites/recues', {headers: AH}).then((x) => x.json()); const fait = rc.recues.find((x) => x.nom === 'Nour' && x.vocal);
    await qi.reload(); await qi.waitForTimeout(1500); const v2 = await qi.evaluate(() => [...document.querySelectorAll('#liste li')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
    ok('vocal : « C’est fait » arrête les rappels ; sur sa page, « Faite ✓ »', fait && fait.fait === true && fait.rappel === null && /Faite ✓/.test(v2[0] || ''), JSON.stringify([fait, v2]));
    /* une tâche écrite, ouverte par la notification (#recue=…) : « Me la lire », puis « Dans 15 min » */
    await fetch(BASE + '/api/invite/tache', {method: 'POST', headers: {authorization: 'Bearer ' + iv.cle, 'content-type': 'application/json'}, body: JSON.stringify({texte: 'Rappelle le plombier'})});
    rc = await fetch(BASE + '/api/invites/recues', {headers: AH}).then((x) => x.json()); const pl = rc.recues.find((x) => x.texte === 'Rappelle le plombier');
    await q.evaluate((id) => { location.hash = '#recue=' + id; }, pl.id); await q.waitForTimeout(2000);
    const r1 = await fiche();
    await q.evaluate(() => { const b = [...document.querySelectorAll('#sheet button')].find((x) => x.textContent.trim().startsWith('Dans 15 min')); if (b) b.click(); }); await q.waitForTimeout(1500);
    rc = await fetch(BASE + '/api/invites/recues', {headers: AH}).then((x) => x.json()); const pl2 = rc.recues.find((x) => x.id === pl.id);
    ok('vocal : la notification ouvre la tâche (« Tâche de Nour », « Me la lire ») ; « Dans 15 min » repousse le rappel', r1.ouverte && /^Tâche de Nour · /.test(r1.kicker) && r1.titre === 'Rappelle le plombier' && r1.boutons.includes('🔊 Me la lire') && pl2 && pl2.rappel && Math.abs(pl2.rappel.prochain - Date.now() - 900000) < 15000, JSON.stringify([r1, pl2]));
    /* 0.67.0 : son message audio de Messages, posté par l'automatisation de son iPhone (qui l'a déjà joué) : JARVIS ouvre la fiche sans le rejouer */
    { const rk = await fetch(BASE + '/api/raccourci/cle', {method: 'POST', headers: AH, body: '{}'}).then((x) => x.json()), n = 16000, w = Buffer.alloc(44 + n * 2);
      w.write('RIFF', 0); w.writeUInt32LE(36 + n * 2, 4); w.write('WAVEfmt ', 8); w.writeUInt32LE(16, 16); w.writeUInt16LE(1, 20); w.writeUInt16LE(1, 22); w.writeUInt32LE(16000, 24); w.writeUInt32LE(32000, 28); w.writeUInt16LE(2, 32); w.writeUInt16LE(16, 34); w.write('data', 36); w.writeUInt32LE(n * 2, 40);
      await q.evaluate(() => { document.getElementById('sheet') && [...document.querySelectorAll('#sheet button')].find((x) => /Fermer/.test(x.textContent)) && [...document.querySelectorAll('#sheet button')].find((x) => /Fermer/.test(x.textContent)).click(); });
      const joue0 = await q.evaluate(() => window.__joue.length);
      const rp = await fetch(BASE + '/api/raccourci/message?de=Nour', {method: 'POST', headers: {authorization: 'Bearer ' + rk.cle, 'content-type': 'audio/wav'}, body: w}), rb = Buffer.from(await rp.arrayBuffer());
      await q.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await q.waitForTimeout(2500);
      const r3 = await fiche(), joue1 = await q.evaluate(() => window.__joue.length);
      ok('Messages 0.67 : son message audio relayé par l’automatisation revient tel quel ; JARVIS ouvre sa fiche (« Message vocal de Nour », « Écouter sa voix ») sans le rejouer (déjà entendu)',
        rp.status === 200 && rb.equals(w) && r3.ouverte && /^Message vocal de Nour · /.test(r3.kicker) && r3.boutons.some((x) => /^▶ Écouter sa voix/.test(x)) && joue1 === joue0, JSON.stringify([rp.status, r3, joue0, joue1]));
      await fetch(BASE + '/api/raccourci/retirer', {method: 'POST', headers: AH, body: '{}'}); }   /* la clé du Raccourci est créée plus loin, par sa carte (essai 0.13.0) */
    /* 0.69.0 (son retour du 23/11/2026 : « elle rouvre Jarvis sur la page déjà ouverte, pas sur l'alerte ») : l'iPhone ramène l'app au premier plan sans
       changer son adresse ; l'app retrouve la notification envoyée pendant son absence et ouvre ce qu'elle annonce, ou la montre en bandeau si elle était ouverte */
    { const fermer = () => q.evaluate(() => { const s = document.getElementById('sheet'), f = s && [...s.querySelectorAll('button')].find((x) => /Fermer/.test(x.textContent)); if (f) f.click(); });
      const cache = (v) => q.evaluate((v) => { Object.defineProperty(document, 'hidden', {configurable: true, get: () => v}); document.dispatchEvent(new Event('visibilitychange')); }, v);
      { const l0 = await fetch(BASE + '/api/notifs', {headers: AH}).then((x) => x.json()); await fetch(BASE + '/api/notifs/vue', {method: 'POST', headers: AH, body: JSON.stringify({ids: l0.notifs.map((x) => x.id)})}); }   /* les notifications des essais d'avant : déjà vues */
      await fermer(); await q.evaluate(() => { location.hash = '#accueil'; }); await q.waitForTimeout(800);
      await cache(true); await fetch(BASE + '/api/push/test', {method: 'POST', headers: AH, body: '{}'}); await cache(false); await q.waitForTimeout(3000);
      const n1 = await q.evaluate(() => ({hash: location.hash, carte: !!document.getElementById('notif-card'), cible: [...document.querySelectorAll('[data-vise]')].map((x) => x.id), toast: [...document.querySelectorAll('.toast')].map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')}));
      const l1 = await fetch(BASE + '/api/notifs', {headers: AH}).then((x) => x.json()), x1 = l1.notifs.find((x) => x.tag === 'essai');
      ok('notifications 0.69 : l’app déjà ouverte, ramenée au premier plan par une notification, ouvre ce qu’elle annonce (l’essai → la carte Notifications de Réglages, mise en évidence), le dit, et la marque vue',
        n1.hash === '#reglages' && n1.carte && n1.cible.includes('notif-card') && /Ouvert depuis ta notification/.test(n1.toast) && !!x1 && x1.url === '/#voir-reglages-notifs' && !!x1.vue, JSON.stringify([n1, x1]));
      /* l'app ouverte au premier plan : la notification arrive aussi en bandeau, « Voir » l'ouvre */
      await q.evaluate(() => { location.hash = '#accueil'; }); await q.waitForTimeout(800);
      await fetch(BASE + '/api/push/test', {method: 'POST', headers: AH, body: '{}'}); await q.evaluate(() => window.dispatchEvent(new Event('jv-notifs'))); await q.waitForTimeout(1500);
      const b1 = await q.evaluate(() => { const t = [...document.querySelectorAll('.toast.alert-t')].find((x) => /Les notifications marchent/.test(x.textContent)); const v = t && [...t.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Voir'); if (v) v.click(); return !!t; });
      await q.waitForTimeout(2000); const b2 = await q.evaluate(() => location.hash);
      ok('notifications 0.69 : app ouverte, la notification arrive en bandeau ; « Voir » ouvre ce qu’elle annonce', b1 && b2 === '#reglages', JSON.stringify([b1, b2]));
    }
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(3500);
    const r2 = await q.evaluate(() => { const c = document.querySelector('.invite-card'); if (c) c.scrollIntoView(); return c ? {rap: !!c.querySelector('#iv-rap') && c.querySelector('#iv-rap').checked, det: [...c.querySelectorAll('details summary')].map((x) => x.textContent), url: c.textContent.includes('/api/raccourci/message'), at: !!c.querySelector('#iv-at') && c.querySelector('#iv-at').checked} : null; });
    ok('vocal (Réglages) : rappels cochés ; « Sa voix, téléphone verrouillé (Messages) » (adresse de son automatisation, 0.67) ; messages audio en tâches cochés ; « Avec tes AirPods »', r2 && r2.rap && r2.det.includes('Sa voix, téléphone verrouillé (Messages)') && r2.det.includes('Avec tes AirPods') && r2.url && r2.at, JSON.stringify(r2));
    await q.evaluate(() => { const c = document.querySelector('.invite-card'); if (c) { c.querySelectorAll('details').forEach((d) => { d.open = true; }); c.scrollIntoView(); } }); await q.screenshot({path: SH + 'reglages-invite.png'});
    await q.close(); await ci.close(); await b2.close(); }
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
    // 0.73.0 — A5-mcp-memoire : l'app reçoit l'adresse où l'assistant sera renvoyé (un faux « Claude » renvoie ailleurs que claude.ai)
    { const em = await fetch(BASE + '/api/mcp', {headers: {authorization: 'Bearer ' + tk}}).then((x) => x.json());
      ok('MCP 0.70 : la demande en attente dit où l’assistant sera renvoyé (claude.ai), avec ses 4 chiffres', (em.demandes || []).length === 1 && em.demandes[0].retour === 'claude.ai' && em.demandes[0].chiffres === chiffres, JSON.stringify(em.demandes));
      const rv = await q.evaluate(() => [...document.querySelectorAll('#mcp-card .mcp-d .mcp-retour')].map((x) => x.textContent));
      ok('MCP 0.70 (lot C) : dans Réglages, la demande affiche son retour en une ligne, l’hôte seulement : « Retour vers claude.ai »', rv.length === 1 && rv[0] === 'Retour vers claude.ai', JSON.stringify(rv)); }
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
    /* 0.69.0 : la notification d'une mission ouvre sa fiche dépliée (adresse de la notification, au démarrage de l'app) ; l'identifiant quitte l'adresse, le reste demeure */
    { const mid = (ms.find((x) => /Compare trois box/.test(x.text)) || {}).id || '';
      await q.goto(BASE + '/?serveur&n=0123456789ab#voir-mission-' + mid); await q.waitForTimeout(4500);
      const m1 = await q.evaluate((id) => { const d = document.querySelector('.mis-it[data-mission="' + id + '"]'); return {hash: location.hash, search: location.search, ouverte: !!d && d.open}; }, mid);
      ok('notifications 0.69 : « /?n=…#voir-mission-<id> » ouvre Équipe sur la mission, sa fiche dépliée ; l’identifiant quitte l’adresse, « ?serveur » reste', !!mid && m1.hash === '#suivi' && m1.ouverte && m1.search === '?serveur', JSON.stringify([mid, m1])); }
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(3000); await q.evaluate(() => { const c = document.getElementById('mcp-card'); if (c) c.scrollIntoView(); }); await q.screenshot({path: SH + 'mcp-reglages.png'});
    /* 0.71.0 : « exécutants reliés » — Réglages crée un jeton fixe par assistant (son nom, son profil), le suspend, le reprend, le retire (confirmé) ;
       ce qu'un exécutant écrit apparaît sous « Derniers gestes des exécutants » */
    { const carte = () => q.evaluate(() => ({lignes: [...document.querySelectorAll('#mcp-card .mcp-jeton')].map((x) => x.textContent), msg: document.querySelector('#mcp-card .set-msg').textContent, bad: document.querySelector('#mcp-card .set-msg').classList.contains('is-bad'), gestes: (document.querySelector('#mcp-card .mcp-actes') || {}).textContent || ''}));
      const creer = async (nom, profil) => { await q.evaluate(() => { document.querySelector('#mcp-card .mcp-fixe').open = true; }); await q.fill('#mcp-card .mcp-form input', nom); await q.selectOption('#mcp-card .mcp-form select', profil); await q.waitForTimeout(150);
        await q.evaluate(() => document.querySelector('#mcp-card .mcp-form button[type=submit]').click()); await q.waitForTimeout(1200); return q.evaluate(() => (document.querySelector('#mcp-card .mcp-jeton-neuf') || {}).textContent || ''); };
      const bouton = (nom, re) => q.evaluate(([n, r]) => { const li = [...document.querySelectorAll('#mcp-card .mcp-jeton')].find((x) => x.querySelector('b').textContent === n), b = li && [...li.querySelectorAll('button')].find((x) => new RegExp(r).test(x.textContent)); if (b) b.click(); return !!b; }, [nom, re]);
      const appel = (jeton, name, args) => fetch(BASE + '/mcp', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + jeton}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name, arguments: args}})}).then(async (x) => ({status: x.status, j: await x.json().catch(() => ({}))}));
      const refus = await creer('Iris', 'executant'), c0 = await carte();
      const jl = await creer('Grok Bot', 'lecture'), jh = await creer('Hermes', 'executant'), dit = await q.evaluate(() => document.querySelector('#mcp-card .mcp-profil-dit').textContent), c1 = await carte();
      ok('exécutants 0.71 : Réglages crée un jeton fixe par assistant (nom, profil), montré une seule fois ; la liste dit le nom et le profil de chacun ; un exécutant au nom d\'un bot est refusé', refus === '' && c0.bad && /déjà pris/.test(c0.msg) && c0.lignes.length === 0 && /^jvf_/.test(jl) && /^jvf_/.test(jh) && jl !== jh && /^Exécutant : lit Pilotage, Gmail et l’agenda, écrit dans Pilotage, prépare des brouillons, te notifie\./.test(dit) && /Jeton de Hermes, montré une seule fois/.test(c1.msg) && !c1.bad && c1.lignes.length === 2
        && c1.lignes.some((x) => /^Grok Bot · Lecture et propositions/.test(x) && /SuspendreRetirer$/.test(x)) && c1.lignes.some((x) => /^Hermes · Exécutant : lit Pilotage, Gmail et l’agenda, écrit dans Pilotage, prépare des brouillons, te notifie/.test(x)) && /Derniers gestes des exécutants/.test(c1.gestes) && /Aucun pour l’instant/.test(c1.gestes), JSON.stringify([refus, c0.msg, dit, c1]));
      FG.onglets = {'État': [['Bot', 'Dernier passage', "Ce que j'ai fait", 'Prochain passage', 'Dernier tour de Gmail']]};
      const g1 = await appel(jh, 'pilotage_etat', {fait: 'Courrier du matin lu, un brouillon préparé'}), g2 = await appel(jl, 'pilotage_etat', {fait: 'Un jeton en lecture ne peut pas'}); await q.waitForTimeout(4500); const c2 = await carte();
      ok('exécutants 0.71 : ce qu\'Hermes écrit (sa ligne de l\'onglet État) apparaît de lui-même sous « Derniers gestes des exécutants » ; le jeton en lecture n\'a pas cet outil', g1.status === 200 && g1.j.result && !g1.j.result.isError && (FG.onglets['État'][1] || [])[0] === 'Hermes' && !!g2.j.error && FG.onglets['État'].length === 2 && /Hermes · onglet État/.test(c2.gestes) && /État : Courrier du matin lu, un brouillon préparé/.test(c2.gestes) && /dernier accès/.test(c2.lignes.find((x) => /^Hermes/.test(x)) || ''), JSON.stringify([g1.j, g2.j, c2]));
      await bouton('Hermes', '^Suspendre$'); await q.waitForTimeout(1000); const c3 = await carte(), s1 = await appel(jh, 'pilotage_etat', {fait: 'Pendant la suspension'}), s2 = await appel(jl, 'jarvis_memoire', {});
      await bouton('Hermes', '^Reprendre$'); await q.waitForTimeout(1000); const c4 = await carte(), s3 = await appel(jh, 'pilotage_lire', {onglet: 'État'});
      ok('exécutants 0.71 : « Suspendre » ferme Hermes (403) sans toucher à l\'autre jeton, la ligne le dit ; « Reprendre » le rouvre', /Hermes est suspendu/.test(c3.msg) && c3.lignes.some((x) => /^Hermes .*suspendu : ses appels sont refusés.*Reprendre/.test(x)) && s1.status === 403 && s2.status === 200 && /a de nouveau accès/.test(c4.msg) && c4.lignes.some((x) => /^Hermes .*SuspendreRetirer$/.test(x)) && s3.status === 200 && /L2 \| Bot: Hermes/.test(s3.j.result.content[0].text), JSON.stringify([c3, s1.status, s2.status, c4.msg, s3.status]));
      /* 0.72.0 : « profil veilleur » — Réglages propose le troisième profil et « Signe comme » (un des exécutants, le premier par défaut) ;
         ce que « Hermes Web » écrit est signé « Hermes » ; il n'a ni Gmail, ni le Canal, ni un autre onglet que Sources */
      { const signe = () => q.evaluate(() => { const b = document.querySelector('#mcp-card .mcp-signe'), s = b.querySelector('select'); return {cache: b.hidden, vu: b.offsetParent !== null, choix: [...s.options].map((o) => o.textContent), valeur: s.value, profils: [...document.querySelector('#mcp-card .mcp-form > select').options].map((o) => o.textContent), dit: document.querySelector('#mcp-card .mcp-profil-dit').textContent}; });
        await q.evaluate(() => { document.querySelector('#mcp-card .mcp-fixe').open = true; }); await q.fill('#mcp-card .mcp-form input', 'Hermes Web'); const v0 = await signe();
        await q.selectOption('#mcp-card .mcp-form > select', 'veilleur'); await q.waitForTimeout(150); const v1 = await signe(); await q.evaluate(() => document.querySelector('#mcp-card .mcp-signe').scrollIntoView({block: 'center'})); await q.screenshot({path: SH + 'mcp-veilleur.png'});
        await q.evaluate(() => document.querySelector('#mcp-card .mcp-form button[type=submit]').click()); await q.waitForTimeout(1200); const jv = await q.evaluate(() => (document.querySelector('#mcp-card .mcp-jeton-neuf') || {}).textContent || ''), cv1 = await carte();
        ok('veilleur 0.72 : Réglages propose le profil « Veilleur » (aucun accès aux mails, à l\'agenda ni aux dossiers) et, pour lui seul, « Signe comme » parmi les exécutants (le premier par défaut) ; la liste dit « signe comme Hermes »', v0.cache && !v0.vu && v0.profils.join() === 'Lecture et propositions,Exécutant,Veilleur' && !v1.cache && v1.vu && v1.choix.join() === 'Hermes,Son propre nom' && v1.valeur === 'Hermes' && /^Veilleur : lit l’onglet Sources, écrit sa ligne du Journal et de l’État, te notifie ; aucun accès à tes mails, ton agenda ni tes dossiers\./.test(v1.dit)
          && /^jvf_/.test(jv) && jv !== jh && /Jeton de Hermes Web \(il signe « Hermes »\), montré une seule fois/.test(cv1.msg) && !cv1.bad && cv1.lignes.length === 3 && cv1.lignes.some((x) => /^Hermes Web · Veilleur : lit l’onglet Sources, écrit sa ligne du Journal et de l’État, te notifie ; aucun accès à tes mails, ton agenda ni tes dossiers · signe comme Hermes/.test(x) && /SuspendreRetirer$/.test(x)) && !cv1.lignes.some((x) => /^(Hermes|Grok Bot) · .*signe comme/.test(x)), JSON.stringify([v0, v1, cv1]));
        const w1 = await appel(jv, 'pilotage_etat', {fait: 'Veille IA et .NET du lundi faite'}), w2 = await appel(jv, 'gmail_chercher', {requete: 'in:inbox'}), w3 = await appel(jv, 'canal_repondre', {ligne: 2, reponse: 'Essai du banc'}), w4 = await appel(jv, 'pilotage_lire', {onglet: 'État'}); await q.waitForTimeout(4500); const cv2 = await carte();
        await bouton('Hermes Web', '^Retirer$'); await q.waitForTimeout(700); await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Oui, retirer/.test(x.textContent)).click()); await q.waitForTimeout(1500); const cv3 = await carte(), w5 = await appel(jv, 'pilotage_etat', {fait: 'Après le retrait'}), w6 = await appel(jh, 'pilotage_lire', {onglet: 'État'});
        ok('veilleur 0.72 : ce que « Hermes Web » écrit est signé « Hermes » (la ligne d\'Hermes dans l\'État, aucune autre) et apparaît dans les gestes avec son jeton ; ni Gmail, ni Canal, ni un autre onglet que Sources ; « Retirer » le coupe seul', w1.status === 200 && w1.j.result && !w1.j.result.isError && FG.onglets['État'].length === 2 && FG.onglets['État'][1][0] === 'Hermes' && FG.onglets['État'][1][2] === 'Veille IA et .NET du lundi faite' && /Outil inconnu/.test((w2.j.error || {}).message || '') && /Outil inconnu/.test((w3.j.error || {}).message || '') && w4.j.result.isError === true && /Onglet inconnu : État\. Onglets lisibles : Sources\./.test(w4.j.result.content[0].text)
          && /Hermes \(jeton Hermes Web\) · onglet État/.test(cv2.gestes) && /État : Veille IA et \.NET du lundi faite/.test(cv2.gestes) && /Jeton de Hermes Web retiré/.test(cv3.msg) && cv3.lignes.length === 2 && !cv3.lignes.some((x) => /^Hermes Web/.test(x)) && w5.status === 401 && w6.status === 200, JSON.stringify([w1.j, w2.j, w3.j, w4.j, cv2.gestes, cv3, w5.status, w6.status])); }
      await q.evaluate(() => document.getElementById('mcp-card').scrollIntoView()); await q.screenshot({path: SH + 'mcp-executants.png'});
      await bouton('Hermes', '^Retirer$'); await q.waitForTimeout(700); const feuille = await q.evaluate(() => { const s = document.getElementById('sheet'); return s ? s.textContent : ''; }), c5 = await carte();
      await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Oui, retirer/.test(x.textContent)).click()); await q.waitForTimeout(1500); const c6 = await carte(), s4 = await appel(jh, 'jarvis_memoire', {}), s5 = await appel(jl, 'jarvis_memoire', {});
      ok('exécutants 0.71 : « Retirer » demande confirmation (rien n\'est retiré avant), puis coupe ce jeton-là seulement ; ses gestes restent affichés', /Retirer le jeton de Hermes \?/.test(feuille) && c5.lignes.length === 2 && c6.lignes.length === 1 && /^Grok Bot/.test(c6.lignes[0]) && /Jeton de Hermes retiré/.test(c6.msg) && s4.status === 401 && s5.status === 200 && /Hermes · onglet État/.test(c6.gestes), JSON.stringify([feuille.slice(0, 160), c5.lignes.length, c6, s4.status, s5.status]));
      const em = await fetch(BASE + '/api/mcp', {headers: {authorization: 'Bearer ' + tk}}).then((x) => x.json());
      for (const f of em.fixes || []) await fetch(BASE + '/api/mcp/retirer', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + tk}, body: JSON.stringify({id: f.id})});
      FG.onglets = null; }
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
    const bc = await q.evaluate(() => { const c = document.getElementById('brief-card'); return c && !c.hidden ? {t: c.textContent, rows: [...c.querySelectorAll('.bf-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim())} : {t: '', rows: []}; });
    /* 0.59.0 (« tout est dans un paragraphe, pas top à lire ») : une rubrique par ligne (le serveur les donne), la liste de ce qui t'attend, « Lire » */
    ok('brief du matin : sur l\'accueil en rubriques (Agenda, Pour toi en liste avec « Voir dans Pour moi »), avec « Lire », sans le paragraphe d\'avant', /Brief du matin/.test(bc.t) && /Lire/.test(bc.t) && !/Bonjour\. Nous sommes/.test(bc.t) && bc.rows.some((r) => /^AGENDA/i.test(r)) && bc.rows.some((r) => /pour toi/i.test(r) && /Voir dans Pour moi/.test(r)), JSON.stringify(bc.rows).slice(0, 300));
    /* un brief fait par un serveur plus ancien (texte seul) : ses rubriques retrouvées dans le texte (exemple inventé) */
    { const TX = "Bonjour. Nous sommes lundi 23 novembre. En ce moment 8 degrés, ressenti 5, bruine. Aujourd'hui : entre 7 et 10 degrés, pluie faible. Prends un parapluie. Rien dans ton agenda pour le reste de la journée. 3 choses pour toi : Garde du chat pendant les vacances ; Relance du syndic (02/01/2027) ; Révision de la voiture. Le détail est dans Pour moi. Échéances : demain, Contrôle technique.";
      await q.route('**/api/brief', (r) => r.fulfill({contentType: 'application/json', body: JSON.stringify({brief: {at: Date.now(), texte: TX}})}));
      await q.reload(); await q.waitForTimeout(2500);
      const fb = await q.evaluate(() => ({k: [...document.querySelectorAll('#brief-card .bf-k')].map((x) => x.textContent), b: (document.querySelector('#brief-card .bf-b > b') || {}).textContent, tip: (document.querySelector('#brief-card .bf-tip') || {}).textContent, li: [...document.querySelectorAll('#brief-card .bf-l li')].map((x) => x.textContent), em: (document.querySelector('#brief-card .bf-l em') || {}).textContent}));
      ok('brief du matin (texte seul, serveur plus ancien) : Météo « 8°, ressenti 5°, bruine » et « Prends un parapluie » à part, Agenda, 3 choses pour toi en liste, Échéances avec « Demain »', fb.k.join('|') === 'Météo|Agenda|3 choses pour toi|Échéances' && fb.b === '8°, ressenti 5°, bruine' && fb.tip === 'Prends un parapluie' && fb.li.length === 4 && fb.li[1] === 'Relance du syndic (02/01/2027)' && fb.em === 'Demain', JSON.stringify(fb));
      await q.unroute('**/api/brief'); }
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
    const vus = {prep: 0, sample: 0, conv: 0, oral: 0}; q.on('request', (r) => { const u = r.url(); if (/\/api\/sample\/prepare$/.test(u)) vus.prep++; if (/\/api\/sample$/.test(u)) { vus.sample++; try { const j = JSON.parse(r.postData() || '{}'); if (j.conv) vus.conv++; if (/À L'ORAL/.test(JSON.stringify(j.input || '') + (j.system || ''))) vus.oral++; } catch (e) { /* rien */ } } });
    await q.addInitScript(() => { try { const s0 = JSON.parse(localStorage.getItem('jarvis.settings') || '{}'); s0.orbe = 'dictee'; localStorage.setItem('jarvis.settings', JSON.stringify(s0)); } catch (e) { /* rien */ } });
    await q.goto(BASE + '/?serveur'); await q.waitForTimeout(3500);
    await q.evaluate(() => window.JarvisAsk()); await q.waitForTimeout(600);
    await q.evaluate(() => { const n = document.querySelector('#chat .dict-no'); if (n) n.click(); }); await q.waitForTimeout(1200);
    const derniere = () => q.evaluate(() => { const m = [...document.querySelectorAll('#chat .msg.them p')]; return m.length ? m[m.length - 1].textContent : ''; });
    await q.fill('#chat-in', 'Bonjour Claude'); await q.press('#chat-in', 'Enter'); await q.waitForTimeout(1500);
    const r1 = await derniere(), mod1 = await q.evaluate(() => { const m = [...document.querySelectorAll('#chat .msg.them .msg-mod')]; return m.length ? m[m.length - 1].textContent : ''; });
    ok('Claude instantané : Claude préparé à l\'ouverture de la discussion (avec son historique gardé dans le téléphone) ; la première question part seule, sans les données ; « Réfléchi » (par défaut, 0.63.0) l\'a confiée à Opus qui réfléchit, dit sous la réponse', vus.prep >= 1 && vus.conv >= 1 && /^Tu as dit : Bonjour Claude\. Session : reprise/.test(r1) && mod1 === 'Opus' && /effort : high, pensée : oui/.test(r1), JSON.stringify([vus, mod1, r1.slice(-120)]));
    await q.fill('#chat-in', 'Raconte lentement'); await q.press('#chat-in', 'Enter'); await q.waitForTimeout(1300);
    const enCours = await derniere(), arret = await q.evaluate(() => !!document.querySelector('#chat .chat-row .btn[aria-label="Arrêter"]'));
    const globeFlux = await q.evaluate(() => [(document.querySelector('#chat .chat-globe .holo-stage') || {dataset: {}}).dataset.s, (document.querySelector('.talk-slot .holo-stage') || {dataset: {}}).dataset.s, (document.querySelector('#chat .cl-state') || {}).textContent]);
    ok('refonte UX : pendant que la réponse s’écrit, le globe de la discussion et celui de la barre « répondent »', globeFlux[0] === 'speaking' && globeFlux[1] === 'speaking' && globeFlux[2] === 'Répond', JSON.stringify(globeFlux));
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
    ok('discussion écrite : consigne sobre, sans la personnalité de l\'oral (son choix : « la voix seulement »)', vus.sample >= 1 && vus.oral === 0, JSON.stringify(vus));
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
    ok('Suivi (Équipe, Demandes) : panneau « Missions de Claude », avant les relances ; l\'état des systèmes est dans Réglages', await q.evaluate(() => { const m = document.querySelector('.mis-panel'), hs = [...document.querySelectorAll('.panel h2')].map((x) => x.textContent); return !!m && /Aucune mission/.test(m.textContent) && hs.indexOf('Missions de Claude') >= 0 && hs.indexOf('Missions de Claude') < hs.indexOf('Relances') && hs.indexOf('État des systèmes') < 0; }));
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
    await q.evaluate(() => document.querySelector('.ux-seg [data-f="cout"]').click()); await q.waitForTimeout(600);   /* refonte UX : la consommation de Claude est sous « Coût » */
    ok('Équipe, Coût : « Claude cette semaine » par usage (missions, conversation…)', await q.evaluate(() => { const t = (document.querySelector('.conso-panel') || {}).textContent || ''; return document.querySelectorAll('.conso-panel tbody tr').length >= 2 && /Missions/.test(t) && /jetons sur/.test(t); }));
    await q.evaluate(() => document.querySelector('.ux-seg [data-f="dem"]').click()); await q.waitForTimeout(600);
    await q.evaluate(() => { const c = document.querySelector('.rel-panel'), sc = document.getElementById('scroller'); sc.scrollTop += c.getBoundingClientRect().top - 140; }); await q.waitForTimeout(300);
    await q.screenshot({path: SH + 'suivi-relances.png'});
    await q.evaluate(() => [...document.querySelectorAll('.rel-it:not(.is-done)')].find((x) => /Voir si le syndic a répondu/.test(x.textContent)).querySelector('button').click()); await q.waitForTimeout(1500);
    ok('Suivi : relance annulée', await q.evaluate(() => ![...document.querySelectorAll('.rel-it:not(.is-done)')].some((x) => /Voir si le syndic a répondu/.test(x.textContent))));
    /* 0.16.0 : santé du serveur dans « État des systèmes » (refonte UX : dans Réglages) */
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(2500);
    await q.evaluate(() => [...document.querySelectorAll('.sante-box button')].find((b) => /Vérifier maintenant/.test(b.textContent)).click()); await q.waitForTimeout(1500);
    ok('Réglages : santé du serveur (Google relié, Claude connecté), vérifiable à la demande', await q.evaluate(() => { const t = (document.querySelector('.sante-box') || {}).textContent || ''; return /Accès Google\s*relié/.test(t) && /Claude sur le serveur\s*connecté/.test(t) && document.querySelectorAll('.sante-box .sys-row.is-ok').length >= 2; }));
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
    const oral = []; v.on('request', (r) => { if (/\/api\/sample$/.test(r.url())) { try { const j = JSON.parse(r.postData() || '{}'), tout = JSON.stringify(j.input || ''); oral.push(/À L'ORAL/.test(tout) && tout.indexOf("À L'ORAL") < tout.indexOf('État de Pilotage')); } catch (e) { /* rien */ } } });   /* 21/11/2026 : sa personnalité à l'oral */
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
    ok('mains libres : la question lue à voix haute part avec la personnalité de JARVIS (« sarcastique assumé »), placée avant les données', oral.length >= 1 && oral.every(Boolean), JSON.stringify(oral));
    /* 0.60.0 (sa demande : « la gestion des tâches par la voix, pas besoin d'appui de bouton, il demande la validation oralement ; plus sharp ») */
    { const vreq = []; v.on('request', (r) => { if (/\/api\/sample$/.test(r.url())) { try { const j = JSON.parse(r.postData() || '{}'); vreq.push({tier: j.tier, voix: /EN CONVERSATION À LA VOIX/.test(j.system || ''), bouton: /attend son bouton|en attente de son bouton|touché « /.test(j.system || '')}); } catch (e) { /* rien */ } } });
      const dire = async (t, ms) => { await v.evaluate((x) => { const ta = document.getElementById('chat-in'); ta.value = x; document.querySelector('#chat .chat-row .btn.main').click(); }, t); await v.waitForTimeout(ms || 3500); };
      const etat = () => v.evaluate(() => ({cartes: [...document.querySelectorAll('#chat .msg.proposal')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), eux: [...document.querySelectorAll('#chat .msg.them p')].map((x) => x.textContent).slice(-3)}));
      await dire('Ajoute une tâche vocale : appeler le plombier jeudi'); const e1 = await etat(), q1 = vreq[vreq.length - 1] || {};
      ok('voix : une tâche dite à voix haute est faite aussitôt, sans bouton ; la question part en « voix » (Sonnet ou Opus, jamais Haiku) avec la consigne de la voix, sans « bouton »', e1.cartes.some((c) => /Tâche proposée/i.test(c) && /C'est parti/.test(c)) && q1.tier === 'voix' && q1.voix && !q1.bouton, JSON.stringify([e1.cartes, q1]));
      await dire('Envoie un ordre vocal pour Kairos'); const e2 = await etat(), nOui = hits.sample;
      await dire('Oui', 2500); const e3 = await etat();
      ok('voix : un ordre à un bot attend son « oui » dit à voix haute ; le « oui » l’envoie sans repasser par Claude et JARVIS le dit', e2.cartes.some((c) => /Ordre proposé à Kairos/i.test(c) && /Envoyer à Kairos/.test(c)) && hits.sample === nOui && e3.cartes.some((c) => /Ordre proposé à Kairos/i.test(c) && /Envoyé/.test(c)) && e3.eux.some((x) => /C’est parti : ordre envoyé à Kairos/.test(x)), JSON.stringify([e2.cartes.slice(-1), e3]));
      await dire('Envoie un ordre vocal pour Kairos'); const nNon = hits.sample; await dire('Non, laisse tomber', 2500); const e4 = await etat();
      const nSeul = hits.sample; await dire('Oui', 3500);
      ok('voix : « non » l’annule (rien ne part) ; un « oui » sans proposition en cours part à Claude', nSeul === nNon && e4.cartes.slice(-1).some((c) => /Abandonné/.test(c)) && e4.eux.some((x) => /j’annule/.test(x)) && hits.sample === nSeul + 1, JSON.stringify([e4, nNon, nSeul, hits.sample]));
      /* 0.61.0 : plus rapide (une action ne passe plus par les réponses instantanées, pas de ligne « Suite ») et les tâches entières à la voix */
      const r0 = hits.rapide; vreq.length = 0;
      const capt = []; v.on('request', (r) => { if (/\/api\/sample$/.test(r.url())) { try { const j = JSON.parse(r.postData() || '{}'); capt.push(/ajoute toujours une dernière ligne qui commence par « Suite/.test(JSON.stringify(j.input || ''))); } catch (e) { /* rien */ } } });
      await dire('Coche la tâche vocale, j’ai appelé le plombier'); const e5 = await etat();
      ok('voix (0.61.0) : une action part directement à Claude (pas de détour par les réponses instantanées), sans ligne « Suite » à écrire ; « j’ai appelé le plombier » coche la tâche aussitôt', hits.rapide === r0 && capt.length >= 1 && !capt.some(Boolean) && e5.cartes.some((c) => /Tâche à cocher/i.test(c) && /Appeler le plombier/.test(c) && /C'est parti/.test(c)), JSON.stringify([hits.rapide, r0, capt, e5.cartes.slice(-1)]));
      await dire('Ajoute une tâche vocale : appeler le plombier jeudi'); await dire('Reporte la tâche vocale à demain'); const e6 = await etat();
      await dire('Supprime la tâche vocale'); const e7 = await etat(); await dire('Oui vas-y merci', 2500); const e8 = await etat();
      await dire('Coche la tâche fantôme'); const e9 = await etat();
      ok('voix : reporter une tâche se fait aussitôt ; la supprimer attend un « oui vas-y merci » ; une tâche introuvable est dite, rien n’est coché', e6.cartes.some((c) => /Tâche à reporter/i.test(c) && /C'est parti/.test(c)) && e7.cartes.some((c) => /Tâche à supprimer/i.test(c) && /Supprimer/.test(c)) && e8.cartes.some((c) => /Tâche à supprimer/i.test(c) && /C'est parti/.test(c)) && e8.eux.some((x) => /tâche supprimée/.test(x)) && e9.eux.some((x) => /Je ne trouve pas la tâche « Repeindre la lune »/.test(x)), JSON.stringify([e6.cartes.slice(-1), e7.cartes.slice(-1), e8, e9.eux])); }
    await v.tap('#chat .mains-fin').catch(() => {});
    await v.close(); }
  // 0.73.0 — A6-voix
  /* mains libres : une phrase finie pendant que la précédente s'écrit encore (écoute lente) ne l'annule plus : les deux partent ensemble,
     dans l'ordre ; une lecture coupée (au fil de la réponse, ou « Écouter ») rend à l'iPhone les sons déjà préparés */
  { const w = await ctx.newPage(); w.on('pageerror', (e) => errs.push('A6-voix : ' + e.message));
    const samples = []; let lents = 0;
    await w.route('**/api/stt', async (route) => { const r = route.request(); if (!r.headers()['x-tour'] && lents++ === 0) await new Promise((z) => setTimeout(z, 6000)); route.continue().catch(() => {}); });   /* la 1re phrase s'écrit lentement */
    w.on('request', (r) => { if (/\/api\/sample$/.test(r.url())) samples.push(r.url()); });
    await w.addInitScript(() => {
      try { const s0 = JSON.parse(localStorage.getItem('jarvis.settings') || '{}'); s0.orbe = 'conversation'; localStorage.setItem('jarvis.settings', JSON.stringify(s0)); } catch (e) { /* rien */ }
      const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC(), osc = ac.createOscillator(), g = ac.createGain(), dest = ac.createMediaStreamDestination();
      g.gain.value = 0; osc.frequency.value = 220; osc.connect(g); g.connect(dest); osc.start();
      window.__talk = (ms) => { ac.resume(); const t0 = ac.currentTime + 0.02; g.gain.setValueAtTime(0.6, t0); g.gain.setValueAtTime(0, t0 + ms / 1000); };
      navigator.mediaDevices.getUserMedia = async () => { await ac.resume(); return dest.stream.clone(); };
    });
    await w.goto(BASE + '/?serveur#accueil'); await w.waitForTimeout(3000);
    await w.tap('.talk-slot .jv-btn'); await w.waitForTimeout(1500);
    const n0 = await w.evaluate(() => document.querySelectorAll('#chat .msg.me').length);
    await w.evaluate(() => window.__talk(1800)); await w.waitForTimeout(4300);   /* 1re phrase (« pas finie » pour Smart Turn) : elle part après 1,6 s de silence */
    await w.evaluate(() => window.__talk(1800)); await w.waitForTimeout(9500);   /* 2e phrase, finie avant que la 1re soit écrite */
    const moi = await w.evaluate(() => [...document.querySelectorAll('#chat .msg.me')].map((x) => x.textContent));
    ok('mains libres (0.73.0) : une phrase finie pendant que la précédente s’écrit encore ne l’annule plus : les deux partent ensemble, dans l’ordre, en une seule question', moi.length === n0 + 1 && (moi[n0].match(/raconte lentement ta journée/gi) || []).length === 2 && samples.length === 1, JSON.stringify([moi.slice(n0), samples.length, lents]));
    await w.tap('#chat .mains-fin').catch(() => {}); await w.waitForTimeout(500);
    const urls = await w.evaluate(async () => {
      const V = window.JarvisVoice, made = [], freed = new Set(), c0 = URL.createObjectURL, r0 = URL.revokeObjectURL, delai = (ms) => new Promise((z) => setTimeout(z, ms));
      URL.createObjectURL = (b) => { const u = c0.call(URL, b); made.push(u); return u; }; URL.revokeObjectURL = (u) => { freed.add(u); return r0.call(URL, u); };
      const texte = 'Première phrase assez longue pour partir seule à la voix. Deuxième phrase, elle aussi assez longue pour être préparée. Troisième phrase, préparée pendant que la première se lit.';
      const kind = V.sayKind(), fl = V.sayFlux({onStart: () => V.hush()}); fl.push(texte); fl.end();   /* coupée dès qu'elle commence : les trois sons sont déjà demandés */
      await Promise.race([fl.done, delai(4000)]);
      const p = V.say(texte); V.hush(); await Promise.race([p, delai(4000)]);
      await delai(2500);   /* les sons préparés arrivent après la coupure */
      URL.createObjectURL = c0; URL.revokeObjectURL = r0;
      return {kind, made: made.length, rendus: made.filter((u) => freed.has(u)).length};
    });
    ok('voix (0.73.0) : une lecture coupée (au fil de la réponse, ou « Écouter ») rend à l’iPhone tous les sons déjà préparés', urls.kind === 'serveur' && urls.made === 6 && urls.rendus === urls.made, JSON.stringify(urls));
    await w.close(); }
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
  // 0.73.0 — B3-page-5-pont
  /* missions relues toutes les 5 s pendant qu'une tourne (Équipe › Demandes), fiche dépliée gardée ; Réglages sans rebâtir Suivi ;
     la carte « Assistants reliés » relue au retour dans Réglages (missions servies par le banc, inventées) */
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('0.70 : ' + e.message));
    let lus = 0; const at0 = Date.now();
    await q.route('**/api/missions', (route) => { if (route.request().method() !== 'GET') return route.continue(); lus++;
      return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({missions: [{id: 'm-b3-cours', status: 'envoyee', text: 'Mission d’essai qui tourne', at: at0, etapes: [{t: 'Lire', s: 'fait'}, {t: 'Comparer', s: 'en cours'}], outil: 'Recherche web n° ' + lus},
        {id: 'm-b3-fini', status: 'terminee', text: 'Mission d’essai finie', at: at0 - 60000, done: at0 - 30000, result: 'Compte rendu d’essai.'}]})}); });
    await q.goto(BASE + '/?serveur#suivi'); await q.waitForTimeout(2500);
    await q.evaluate(() => { const d = document.querySelector('.mis-it[data-mission="m-b3-fini"]'); if (d) { d.open = true; d.querySelector('summary').focus(); } });   /* ouverte au doigt : le titre garde le focus */
    const n0 = lus; await q.waitForTimeout(11000);
    const mi = await q.evaluate(() => ({outil: (document.querySelector('.mis-it[data-mission="m-b3-cours"] .mis-outil') || {}).textContent || '', fini: !!(document.querySelector('.mis-it[data-mission="m-b3-fini"]') || {}).open}));
    ok('0.70 : missions : pendant qu’une mission tourne, Équipe › Demandes relit ses étapes toutes les 5 s (avant : figées) ; une fiche dépliée le reste', lus - n0 >= 2 && +((mi.outil.match(/(\d+)$/) || [])[1] || 0) > n0 && mi.fini, JSON.stringify({n0, lus, mi}));
    await q.close(); }
  { const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('0.70 : ' + e.message));
    const vus = {}; q.on('request', (r) => { try { const u = new URL(r.url()); if (r.method() === 'GET' && /^\/api\/(missions|relances|conso|sante|mcp)$/.test(u.pathname)) vus[u.pathname] = (vus[u.pathname] || 0) + 1; } catch (e) { /* rien */ } });
    await q.goto(BASE + '/?serveur#reglages'); await q.waitForTimeout(4000);
    const lecture = [], s0 = vus['/api/sante'] || 0;
    for (let i = 0; i < 3; i++) { lecture.push(await q.evaluate(() => { window.__uxRerender(); const s = document.querySelector('.sante-box'); return s ? s.textContent : ''; })); await q.waitForTimeout(500); }
    const sys = await q.evaluate(() => [...document.querySelectorAll('#view .panel h2')].filter((x) => /^État des systèmes/.test(x.textContent)).length);
    ok('0.70 : Réglages : « État des systèmes » (et la santé du serveur) sans rebâtir Suivi : aucune lecture des missions, relances ni consommation, la santé relue au plus toutes les 30 s, plus de « Lecture de l’état du serveur… » à chaque rafraîchissement', sys === 1 && (vus['/api/sante'] || 0) - s0 === 0 && !vus['/api/missions'] && !vus['/api/relances'] && !vus['/api/conso'] && lecture.every((t) => /Ton serveur/.test(t) && !/Lecture de l’état du serveur/.test(t)), JSON.stringify({sys, s0, vus, lecture: lecture.map((t) => t.slice(0, 50))}));
    const txt = await q.evaluate(() => (document.getElementById('mcp-card') || {}).textContent || '');
    await q.evaluate(() => document.querySelector('.tab[data-tab="agenda"]').click()); await q.waitForTimeout(500); const a0 = vus['/api/mcp'] || 0; await q.waitForTimeout(3500); const a1 = vus['/api/mcp'] || 0;
    await q.evaluate(() => document.querySelector('.tab[data-tab="espaces"]').click()); await q.waitForTimeout(700); await q.evaluate(() => document.querySelector('.esp-row[data-go="reglages"]').click()); await q.waitForTimeout(300);
    const m0 = vus['/api/mcp'] || 0; await q.waitForTimeout(9000); const m1 = vus['/api/mcp'] || 0;
    ok('0.70 : Réglages : revenu d’une autre rubrique, la carte « Assistants reliés » se relit de nouveau (aucun appel pendant qu’elle n’est pas à l’écran) ; elle renvoie à « Équipe, filtre Demandes », plus à Suivi', a1 === a0 && m1 - m0 >= 2 && /attend ton accord dans Équipe, filtre Demandes/.test(txt) && !/dans Suivi/.test(txt), JSON.stringify({a0, a1, m0, m1, txt: txt.slice(0, 200)}));
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
    const ouvre = async () => { const c = await b.newContext({...devices['iPhone 15 Pro Max']}); await c.addInitScript((t) => { try { localStorage.setItem('jarvis.banc.reglages', 'entier'); localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: t})); } catch (e) { /* rien */ } }, tok2); const q = await c.newPage(); q.on('pageerror', (e) => errs.push('maj : ' + e.message)); await q.goto(B2 + '/?serveur#accueil'); return q; };
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
