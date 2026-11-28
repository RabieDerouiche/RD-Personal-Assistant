/* Banc du lot de fiabilité « voix et notifications » (0.73.0) : node tests/fiab-a6.test.mjs (aucun Claude, aucun vrai Google, aucun coût).
   Rappels du matin réessayés, réponses instantanées qui ne détournent plus une demande, pique muette sur une question grave, diction des
   degrés, jours visés (« demain soir », « lundi prochain »), son de Piper jamais tronqué, écoute figée relancée, sauvegarde sans boucle,
   envois sans délai infini, titre de la notification de santé. Exemples inventés seulement. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import crypto from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process'; import {fileURLToPath} from 'node:url';
import {createNotifier, parisMs} from '../notify.mjs';
import {intention, quand, diction, meteoPhrase, createEcoute, createTour} from '../voix.mjs';
import {pique} from '../humour.mjs';
import {createSauvegarde, ONGLETS} from '../sauvegarde.mjs';
import {createPush, b64u} from '../push.mjs';
import {createSante} from '../sante.mjs';
import {createVoixGoogle} from '../voix-google.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fiab-a6-'));
const attendre = (ms) => new Promise((z) => setTimeout(z, ms));
const nonRattrapees = []; process.on('uncaughtException', (e) => { nonRattrapees.push(String(e && (e.code || e.message) || e)); });
/* une date inventée, à Paris */
const fr = (ymd) => ymd.slice(8, 10) + '/' + ymd.slice(5, 7) + '/' + ymd.slice(0, 4);
const JOUR = '2026-11-24';
try {
  /* 1. voix-push#1 : rappels du matin et « Grok est reparti » réessayés après une lecture ratée de Pilotage */
  { let T = parisMs(JOUR, '08:01'), panne = true; const lus = [], sent = [];
    const S = {push: {subs: [{endpoint: 'x'}], prefs: {}}};
    const feuilles = {"'Échéances'!A1:H1000": [['Date', 'Sujet', 'Domaine', 'Rappels', 'Statut'], [fr(JOUR), 'Payer la cantine (essai)', 'Famille', '', 'À venir']],
      'Papiers!A1:G300': [['Document', 'Personne', 'Où il est', "Valable jusqu'au"], ['Carte d’essai', 'Lui', 'Drive', fr(JOUR)]],
      'Canal!A1:H3000': [['Date', 'De', 'Pour', 'Type', 'Message', 'Statut', 'Réponse', 'Objet'], ['24/11/2026', 'Rabie', 'Kairos', 'Ordre', 'Suis la carte', 'À faire', '', '']],
      'Tâches!A1:E500': [['Tâche', 'Pour', 'Échéance', 'Statut', 'Créée le']]};   /* 0.79.0 lit aussi les tâches (onglet vide ici) : ce banc ne le donnait pas et cassait depuis */
    const read = async (r) => { lus.push(r); if (panne) throw new Error('Google 503'); return feuilles[r]; };
    const N = createNotifier({S, save: () => {}, push: {send: async (m) => { sent.push(m); return [{ok: true}]; }}, read, linked: () => true, pause: async () => parisMs(JOUR, '08:00'), now: () => T});
    const a = await N.tick({only: 'digest'}); T += 5 * 60000; panne = false; const b = await N.tick({only: 'digest'}), lusB = lus.length;
    T += 6 * 60000; const c = await N.tick({only: 'digest'}); T += 15 * 60000; const d = await N.tick({only: 'digest'});
    ok('rappels du matin : une lecture ratée à 8 h 01 (Google 503) ne perd pas la journée : réessai 10 minutes après, rappel envoyé, une seule fois', a.digest.error && b.digest === null && lusB === 1 && c.digest && c.digest.sent === true && d.digest === null && sent.length === 1 && sent[0].title === '2 rappels du jour', JSON.stringify([a, b, c, d, sent.map((x) => x.title)]));
    ok('rappels du matin : le jour de fin d’un papier « valable jusqu’au » dit « dernier jour de validité », pas « n’est plus valable »', /Carte d’essai \(Lui\) : dernier jour de validité aujourd'hui/.test(sent[0].body) && !/plus valable/.test(sent[0].body), sent[0].body);
    panne = true; const r1 = await N.tick({only: 'resume'}); T += 3 * 60000; panne = false; const r2 = await N.tick({only: 'resume'}); T += 8 * 60000; const r3 = await N.tick({only: 'resume'}); const r4 = await N.tick({only: 'resume'});
    ok('« Grok est reparti » : une lecture ratée du Canal est réessayée 10 minutes après, la notification part, une seule fois', r1.resume.error && r2.resume === null && r3.resume && r3.resume.sent === true && r4.resume === null && sent.filter((x) => x.title === 'Grok est reparti').length === 1, JSON.stringify([r1, r2, r3, r4]));
    S.push.prefs = {rappels: false}; T = parisMs('2026-11-25', '08:05'); const lus0 = lus.length; const e = await N.tick({only: 'digest'}), e2 = await N.tick({only: 'digest'});
    ok('rappels du matin coupés dans Réglages : rien n’est lu, la journée est marquée faite', e.digest && e.digest.sent === false && e2.digest === null && lus.length === lus0, JSON.stringify([e, e2])); }

  /* 2. voix-push#2 : les réponses instantanées ne détournent plus une demande */
  { const faux = ['À quelle heure est mon rendez-vous chez le dentiste ?', 'Quel jour tombe Noël cette année ?', 'Rappelle-moi de prendre mon parapluie demain matin', 'Ajoute une veste à la liste de courses', 'Écris un mail pour moi à Paul', 'Trouve un restaurant pour moi et ma femme ce soir', 'Baisse la température du chauffage', "Qu'est-ce que j'ai oublié d'acheter ?",
      'Rappelle-moi à quelle heure part le train', 'Quelle heure est-il à New York ?', 'Quel jour passe le plombier ?', 'Jusqu’à quelle heure ouvre la pharmacie ?', 'Tu peux ajouter une veste à ma liste ?', 'Demande à Iris où en est le syndic', "Qu'est-ce que j'ai fait hier ?", 'Quel temps a-t-il fait hier ?'];
    const mal = faux.filter((t) => intention(t) !== null);
    ok('réponses instantanées : « à quelle heure… », « quel jour tombe… », un rappel, un ajout, un mail « pour moi », un réglage, un oubli, une autre ville, hier : Claude répond', !mal.length, JSON.stringify(mal.map((t) => [t, intention(t)])));
    const bons = [['Quelle heure est-il ?', 'heure'], ['Il est quelle heure ?', 'heure'], ['Quelle heure est-il, Jarvis ?', 'heure'], ['Tu as l’heure ?', 'heure'], ['On est quel jour ?', 'date'], ['Quel jour sommes-nous ?', 'date'], ["C'est quel jour aujourd'hui ?", 'date'], ['Il fait frais dehors ?', 'meteo'], ['Et demain, il va pleuvoir ?', 'meteo'], ['Je prends un parapluie demain ?', 'meteo'],
      ["Qu'est-ce que j'ai demain ?", 'agenda'], ["Qu'est-ce qui m'attend ?", 'pourmoi'], ['Il y a quelque chose pour moi ?', 'pourmoi'], ['Où en est Iris ?', 'bot']];
    const rate = bons.filter(([t, k]) => (intention(t) || {}).kind !== k);
    ok('réponses instantanées : l’heure, la date, la météo, l’agenda, ce qui t’attend et où en est un bot restent instantanés', !rate.length, JSON.stringify(rate.map(([t]) => [t, intention(t)])));
    const salut = [['Bonjour Jarvis, quelle heure est-il ?', 'heure'], ['Salut, il est quelle heure ?', 'heure'], ['Ok Jarvis quelle heure est il', 'heure'], ['Hé Jarvis, quelle heure est-il ?', 'heure'], ['Euh quelle heure est-il', 'heure'], ['Salut, on est quel jour ?', 'date'], ['Bonjour, quel jour sommes-nous ?', 'date'], ['Coucou Jarvis on est le combien', 'date'],
      ['Bonjour Jarvis', null], ['Salut Jarvis, à quelle heure part le train ?', null], ['Bonjour, quelle heure est-il à New York ?', null]];
    const rate2 = salut.filter(([t, k]) => ((intention(t) || {}).kind || null) !== k);
    ok('réponses instantanées : une salutation devant (« Bonjour Jarvis, quelle heure est-il ? », « Salut, on est quel jour ? ») garde la réponse instantanée ; « à quelle heure part… » ou une autre ville restent pour Claude', !rate2.length, JSON.stringify(rate2.map(([t]) => [t, intention(t)]))); }

  /* 3. voix-push#3 : pas de pique quand la question elle-même est grave */
  { const a = pique('meteo', 'Demain : entre 7 et 11 degrés, pluie probable à 80 %. Prends un parapluie.', '09:00', () => 0, "Quel temps fera-t-il demain pour l'enterrement de mon grand-père ?");
    const b = pique('heure', 'Il est 2 h 10.', '02:10', () => 0, 'Quelle heure est-il ? Je dois partir aux urgences avec mon fils');
    const c = pique('heure', 'Il est 14 h 05.', '14:05', () => 0, 'Quelle heure est-il ?'), d = pique('heure', 'Il est 14 h 05.', '14:05', () => 0);
    ok('humour : une question grave (enterrement, urgences avec son fils) n’a aucune pique, même si la réponse n’en dit rien ; une question ordinaire garde la sienne', a === 'Demain : entre 7 et 11 degrés, pluie probable à 80 %. Prends un parapluie.' && b === 'Il est 2 h 10.' && c.length > 'Il est 14 h 05.'.length && d.length > 'Il est 14 h 05.'.length, JSON.stringify([a, b, c, d])); }

  /* 4. voix-push#4 : diction des degrés */
  { const v = [['Entre 7° et 9° demain.', 'Entre 7 degrés et 9 degrés demain.'], ['Il fait 7°.', 'Il fait 7 degrés.'], ['Il fait 7°, ressenti 5°', 'Il fait 7 degrés, ressenti 5 degrés'], ['ressenti -3°.', 'ressenti -3 degrés.'], ['Il fait 1°', 'Il fait 1 degré'], ['7 °C dehors', '7 degrés dehors'], ['7° Celsius', '7 degrés Celsius']];
    const mal = v.filter(([a, b]) => diction(a) !== b);
    ok('diction : « 7° et 9° » garde ses espaces, « 7°. » est lu, « 1° » au singulier, « °C » et « Celsius »', !mal.length, JSON.stringify(mal.map(([a]) => [a, diction(a)]))); }

  /* 5. voix-push#9 : le jour visé */
  { const qs = quand('Il fera froid demain soir ?', 3), we = quand('Quel temps ce week-end ?', 0), weP = quand('Quel temps le week-end prochain ?', 0), lun = quand('Mon agenda lundi prochain', 1), lun0 = quand('Mon agenda lundi', 1), bs = quand('Bonsoir, quel temps demain ?', 2);
    const h = (d, hh, t, p, c) => ({x: d + 'T' + hh + ':00', t, p, c});
    const today = {y: 2026, m: 11, d: 25}, H = [h('2026-11-25', '19', 9, 0, 2), h('2026-11-26', '12', 11, 0, 1), h('2026-11-26', '19', 4, 60, 61), h('2026-11-26', '22', 3, 70, 61)];
    const j = {daily: {time: ['2026-11-25', '2026-11-26'], temperature_2m_min: [5, 2], temperature_2m_max: [10, 11], weather_code: [2, 61], precipitation_probability_max: [0, 70]}, hourly: {time: H.map((x) => x.x), temperature_2m: H.map((x) => x.t), precipitation_probability: H.map((x) => x.p), weather_code: H.map((x) => x.c)}};
    const ph = meteoPhrase(j, qs, today, 'Il fera froid demain soir ?');
    ok('jours : « demain soir » est un soir (la météo de 18 h à 23 h), « bonsoir » n’en est pas un', qs.jour === 1 && qs.soir === true && /^Demain soir : entre 3 et 4 degrés, pluie faible, pluie probable à 70 %\./.test(ph || '') && bs.soir === false, JSON.stringify([qs, ph, bs]));
    ok('jours : « ce week-end » dit un dimanche, c’est aujourd’hui ; « le week-end prochain », le samedi qui vient ; « lundi prochain » dit un lundi, dans 7 jours', we.jour === 0 && !we.we && weP.jour === 6 && weP.we && lun.jour === 7 && lun.dit === 'lundi prochain' && lun0.jour === 0, JSON.stringify([we, weP, lun, lun0])); }

  /* 6. voix-push#5 : Piper écrit à côté puis renomme (faux module « piper » : une phrase « PANNE » lève une erreur à mi-chemin) */
  { const py = spawnSync('python3', ['-c', 'import wave, json'], {encoding: 'utf8'});
    if (py.status !== 0) ok('Piper : python3 absent, essai sauté', true);
    else {
      const mod = path.join(DIR, 'pymod', 'piper'); fs.mkdirSync(mod, {recursive: true});
      fs.writeFileSync(path.join(mod, '__init__.py'), [
        'class SynthesisConfig:', '    def __init__(self, **k): pass',
        'class PiperVoice:', '    @staticmethod', '    def load(m): return PiperVoice()',
        '    def synthesize_wav(self, text, w, syn_config=None):', '        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)', '        w.writeframes(b"\\x00\\x01" * 5000)',
        '        if "PANNE" in text: raise RuntimeError("panne simulée")', '        w.writeframes(b"\\x00\\x01" * 5000)', ''].join('\n'));
      const child = spawn('python3', [path.join(HERE, '..', 'tts', 'piper_helper.py'), 'modele', ''], {env: {...process.env, PYTHONPATH: path.join(DIR, 'pymod')}, stdio: ['pipe', 'pipe', 'pipe']});
      let buf = ''; const msgs = []; child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { msgs.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
      const out1 = path.join(DIR, 'panne.wav'), out2 = path.join(DIR, 'bon.wav');
      child.stdin.write('pas du json\n'); child.stdin.write(JSON.stringify({id: 1, text: 'PANNE au milieu', out: out1}) + '\n'); child.stdin.write(JSON.stringify({id: 2, text: 'Bonjour.', out: out2}) + '\n');
      for (let k = 0; k < 100 && msgs.length < 4; k++) await attendre(50);
      child.stdin.end(); child.kill();
      const m1 = msgs.find((m) => m.id === 1), m2 = msgs.find((m) => m.id === 2), m0 = msgs.find((m) => !m.ready && m.id == null);
      ok('Piper : une phrase ratée à mi-chemin ne laisse aucun son (ni tronqué, ni « .part ») ; la suivante est écrite entière ; une ligne illisible est refusée sans arrêter la voix', msgs[0] && msgs[0].ready && m0 && m0.ok === false && m1 && m1.ok === false && !fs.existsSync(out1) && !fs.existsSync(out1 + '.part') && m2 && m2.ok === true && fs.existsSync(out2) && !fs.existsSync(out2 + '.part') && fs.statSync(out2).size > 20000, JSON.stringify(msgs)); } }

  /* 7. voix-push#7 + srv-a#7 : l'écoute et la fin de phrase figées sont relancées ; un EPIPE ne fait pas tomber le serveur */
  { const compteur = path.join(DIR, 'lances.txt'), fake = path.join(DIR, 'faux-moteur.mjs');
    /* faux moteur : la 1re fois qu'il est lancé, selon MODE, il ne répond pas (« fige »), ferme son entrée (« ferme ») ou ne finit jamais de charger (« charge ») ; ensuite il répond son pid */
    fs.writeFileSync(fake, `import fs from 'node:fs';
const f = process.env.CPT, n = (fs.existsSync(f) ? +fs.readFileSync(f, 'utf8') : 0) + 1; fs.writeFileSync(f, String(n));
const mode = n === 1 ? process.env.MODE : 'normal';
if (mode !== 'charge') console.log(JSON.stringify({ready: true}));
if (mode === 'ferme') process.stdin.destroy();
let buf = ''; process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\\n')) >= 0) { const r = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
  if (mode === 'normal') console.log(JSON.stringify({id: r.id, ok: true, text: 'pid ' + process.pid, p: 0.9})); } });
setInterval(() => {}, 1000);`);
    const essai = async (MODE, fab, appel, n) => { fs.writeFileSync(compteur, '0'); process.env.CPT = compteur; process.env.MODE = MODE; const o = fab(); o.warm(); await attendre(1000); const r = []; for (let k = 0; k < n; k++) r.push(await appel(o)); o.stop(); return {r, lances: +fs.readFileSync(compteur, 'utf8')}; };
    const wav = Buffer.concat([Buffer.from('RIFF0000WAVE'), Buffer.alloc(64)]), tmp = path.join(DIR, 'tmp');
    const E = () => createEcoute({dir: DIR, py: '', helper: '', model: 'x', fakeHelper: fake, delaiMs: 1500});
    const T2 = () => createTour({dir: DIR, py: '', helper: '', fakeHelper: fake, delaiMs: 800});
    const e1 = await essai('fige', E, (o) => o.transcribe(wav, tmp), 2);
    ok('écoute figée : « trop long » une fois, puis le programme est relancé et la phrase suivante est écrite', e1.r[0].ok === false && e1.r[0].error === 'trop long' && e1.r[1].ok === true && /^pid \d+$/.test(e1.r[1].text) && e1.lances === 2, JSON.stringify(e1));
    const e2 = await essai('charge', E, (o) => o.transcribe(wav, tmp), 2);
    ok('écoute qui charge encore son modèle : pas relancée en boucle (un seul programme)', e2.r.every((x) => x.error === 'trop long') && e2.lances === 1, JSON.stringify(e2));
    const e3 = await essai('ferme', E, (o) => o.transcribe(wav, tmp), 2);
    ok('écoute dont l’entrée est fermée (EPIPE) : le serveur ne tombe pas, la phrase suivante passe par un programme relancé', !nonRattrapees.length && e3.r[0].ok === false && e3.r[1].ok === true && e3.lances === 2, JSON.stringify([e3, nonRattrapees]));
    const t1 = await essai('fige', T2, (o) => o.verdict(wav, tmp), 3);
    ok('fin de phrase figée : relancée après deux « trop long » de suite (pas au premier), puis elle répond', t1.r[0].error === 'trop long' && t1.r[1].error === 'trop long' && t1.r[2].ok === true && t1.r[2].p === 0.9 && t1.lances === 2, JSON.stringify(t1));
    const t2 = await essai('ferme', T2, (o) => o.verdict(wav, tmp), 3);
    ok('fin de phrase dont l’entrée est fermée (EPIPE) : le serveur ne tombe pas', !nonRattrapees.length && t2.r[2].ok === true, JSON.stringify([t2, nonRattrapees])); }

  /* 8. voix-push#8 : sauvegarde sans boucle quand Pilotage est illisible, et jamais deux copies à la fois */
  { let T = parisMs(JOUR, '03:00'), lectures = 0, panne = true; const S = {};
    const sv = createSauvegarde({S, save: () => {}, read: async () => { lectures++; await attendre(2); if (panne) throw new Error('403'); return [['a'], ['b']]; }, linked: () => true, dir: path.join(DIR, 'sauv'), now: () => T});
    for (let k = 0; k < 5; k++) { await sv.tick(); T += 60000; }
    const cinq = lectures; T += 30 * 60000; await sv.tick(); const apres = lectures;
    ok('sauvegarde : Pilotage illisible : un essai, puis un toutes les 30 minutes (plus 19 lectures chaque minute) ; l’erreur est dite en français', cinq === ONGLETS.length && apres === 2 * ONGLETS.length && /Pilotage illisible/.test(S.sauvegarde.error), JSON.stringify([cinq, apres, S.sauvegarde.error]));
    panne = false; lectures = 0; T += 31 * 60000; const [a, b, c] = await Promise.all([sv.tick(), sv.tick(), sv.run()]);
    ok('sauvegarde : deux passages en même temps ne font qu’une copie (19 lectures) ; « Sauvegarder maintenant » reçoit la même', lectures === ONGLETS.length && a && a.ok && b === null && c === a, JSON.stringify([lectures, a, b])); }

  /* 9. voix-push#10 : un service de notifications qui ne répond pas ne bloque plus l'envoi */
  { const muet = http.createServer(() => { /* ne répond jamais */ }); await new Promise((z) => muet.listen(0, '127.0.0.1', z));
    const ec = crypto.createECDH('prime256v1'); ec.generateKeys(); const S = {}, P = createPush({S, save: () => {}, allowHttp: true, delaiMs: 300});
    const sub = P.subscribe({endpoint: 'http://127.0.0.1:' + muet.address().port + '/push/essai', keys: {p256dh: b64u(ec.getPublicKey()), auth: b64u(crypto.randomBytes(16))}}, 'essai');
    const t0 = Date.now(), r = await P.send({title: 'Essai', body: 'Bonjour', url: '/'}), dt = Date.now() - t0;
    muet.closeAllConnections(); muet.close();
    ok('notifications : un service qui ne répond pas est abandonné au délai (pas 5 minutes), avec une raison en français dans Réglages', sub.ok && dt < 3000 && r.length === 1 && r[0].ok === false && r[0].error === 'pas de réponse en 0,3 s' && /pas de réponse en 0,3 s/.test(S.push.last.detail), JSON.stringify([dt, r, S.push.last])); }

  /* 10. voix-push#10 (voix Google) : un jeton qui ne vient pas est abandonné ; un son est écrit d'un coup (pas de « .part » qui traîne) */
  { const g = http.createServer(async (q, res) => { let b = ''; for await (const c of q) b += c; if (q.url === '/token') return; /* muet */
      res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify({audioContent: Buffer.from('RIFF....WAVE' + JSON.parse(b).input.text).toString('base64')})); });
    await new Promise((z) => g.listen(0, '127.0.0.1', z)); const base = 'http://127.0.0.1:' + g.address().port, d = path.join(DIR, 'vg'); fs.mkdirSync(d);
    const {privateKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
    fs.writeFileSync(path.join(d, 'sa.json'), JSON.stringify({type: 'service_account', client_email: 'essai@exemple.invalid', private_key: privateKey.export({type: 'pkcs8', format: 'pem'}), token_uri: base + '/token'}));
    fs.writeFileSync(path.join(d, 'cle.json'), JSON.stringify({cle: 'cle-de-test-0123456789'}));
    const sa = createVoixGoogle({fichier: path.join(d, 'sa.json'), compteurFichier: path.join(d, 'c1.json'), base, delaiJeton: 300});
    const info = {}, t0 = Date.now(), f = await sa.dire('Bonjour.', '', path.join(d, 'a.wav'), {info}), dt = Date.now() - t0;
    ok('voix Google : un jeton de compte de service qui ne vient pas est abandonné au délai ; Pierre parle, la raison est dite en français', f === null && dt < 3000 && /jeton à temps \(0,3 s\)/.test(info.raison), JSON.stringify([dt, info]));
    const cle = createVoixGoogle({fichier: path.join(d, 'cle.json'), compteurFichier: path.join(d, 'c2.json'), base}), out = path.join(d, 'b.wav'), f2 = await cle.dire('Bonjour.', '', out);
    g.closeAllConnections(); g.close();
    ok('voix Google : le son est écrit à côté puis renommé (rien ne traîne, le cache ne voit jamais un son à moitié écrit)', f2 === out && fs.existsSync(out) && !fs.existsSync(out + '.part') && /Bonjour\./.test(fs.readFileSync(out, 'utf8')), String(f2)); }

  /* 11. voix-push#11 : titre de la notification de santé */
  { const sent = [], S = {push: {subs: [{}]}};
    const sa = createSante({S, save: () => {}, push: {send: async (m) => { sent.push(m); }}, checks: {google: async () => ({nom: 'Accès Google', ok: false, detail: 'à reconnecter'})}});
    await sa.tick();
    ok('santé : « JARVIS : accès Google » (le nom propre garde sa majuscule)', sent.length === 1 && sent[0].title === 'JARVIS : accès Google', JSON.stringify(sent)); }

  /* 12. srv-a#7 : un écouteur d'erreur sur l'entrée des programmes Python de l'écoute et de la fin de phrase */
  { const src = fs.readFileSync(path.join(HERE, '..', 'voix.mjs'), 'utf8');
    ok('écoute et fin de phrase : un écouteur d’erreur sur l’entrée de chaque programme Python', (src.match(/child\.stdin\.on\('error'/g) || []).length === 2); }
} catch (e) { ok('exception', false, e && e.stack); }
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s) sur ' + results.length + ' vérifications' : 'Tout passe (' + results.length + ' vérifications).');
fs.rmSync(DIR, {recursive: true, force: true});
process.exit(fails ? 1 : 0);
