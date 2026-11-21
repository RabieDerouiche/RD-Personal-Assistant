/* Banc des garde-fous de la voix Google (0.47.0) : node tests/voix-google.test.mjs (un faux Google local, aucun vrai appel, aucun coût).
   Sa demande du 21/11/2026 : « qu'il ne commence pas à facturer et qu'on fasse le switch avant, c'est primordial, pas le droit à l'erreur ». */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import {createVoixGoogle, longueur, VOIX_CONSEILLEES} from '../voix-google.mjs';
import {diction} from '../voix.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'voixg-'));
/* faux Google : répond, échoue (500) ou traîne, selon MODE ; compte les synthèses */
const G = {mode: 'ok', synth: [], lent: 0};
const SRV = http.createServer(async (q, res) => { let b = ''; for await (const c of q) b += c;
  const send = (st, o) => { res.writeHead(st, {'content-type': 'application/json'}); res.end(JSON.stringify(o)); };
  if (q.url.startsWith('/v1/voices')) return send(200, {voices: ['Charon', 'Iapetus', 'Aoede', 'Algieba', 'Orus'].map((n) => ({name: 'fr-FR-Chirp3-HD-' + n}))});
  if (q.url === '/v1/text:synthesize') { G.synth.push(JSON.parse(b).input.text); if (G.lent) await new Promise((z) => setTimeout(z, G.lent));
    if (G.mode === 'panne') return send(500, {error: {message: 'panne simulée'}});
    if (G.mode === 'refus') return send(403, {error: {message: 'Cloud Text-to-Speech API has not been used in project 0 before or it is disabled.'}});
    return send(200, {audioContent: Buffer.from('RIFF....WAVE' + JSON.parse(b).input.text).toString('base64')}); }
  send(404, {}); });
await new Promise((z) => SRV.listen(0, '127.0.0.1', z)); const BASE = 'http://127.0.0.1:' + SRV.address().port;
let T = Date.parse('2026-11-21T15:00:00Z');   /* l'heure, réglée par le banc */
const fabrique = (nom, o = {}) => {
  const d = path.join(DIR, nom); fs.mkdirSync(d, {recursive: true});
  fs.writeFileSync(path.join(d, 'cle.json'), JSON.stringify({cle: 'cle-de-test-0123456789'}));
  const A = [], M = {c: o.miroir || null};
  const vg = createVoixGoogle({fichier: path.join(d, 'cle.json'), compteurFichier: path.join(d, 'compteur.json'), base: BASE, plafond: o.plafond || 1000, plafondJour: o.jour || 100000, now: () => T,
    alerte: (a) => A.push(a.titre), miroir: {lire: () => M.c, ecrire: (c) => { M.c = c; }}});
  return {vg, A, M, d, sortie: (i) => path.join(d, 'son-' + i + '.wav')};
};
try {
  ok('octets comptés : « é » en vaut 2, jamais moins que les caractères', longueur('Été déjà') === 12 && longueur('abc') === 3 && longueur('') === 0);
  /* 1. on compte avant d'appeler, en octets */
  { const {vg, sortie} = fabrique('octets'); const f = await vg.dire('Été déjà', '', sortie(1)); const e = vg.etat();
    ok('compte en octets ce qui part chez Google (12 pour « Été déjà »), une synthèse', !!f && e.caracteres === 12 && e.appels === 1 && e.aujourdhui === 12 && e.comptage === 'octets', JSON.stringify(e)); }
  /* 2. rien n'est rendu quand Google échoue ; ensuite Pierre parle un moment sans attendre Google (disjoncteur) ; « Vérifier » passe outre */
  { const {vg, sortie} = fabrique('panne'); G.mode = 'panne'; const n0 = G.synth.length; const info = {};
    const f1 = await vg.dire('Bonjour.', '', sortie(1), {info}); const e1 = vg.etat(); const info2 = {};
    const f2 = await vg.dire('Encore.', '', sortie(2), {info: info2}); const n1 = G.synth.length;
    ok('Google en panne : la phrase reste comptée (Google a pu la facturer) ; la suivante va à Pierre sans appeler Google', f1 === null && e1.caracteres === 8 && /erreur de Google : Google 500/.test(info.raison) && f2 === null && n1 - n0 === 1 && /Google en erreur/.test(info2.raison) && e1.horsErreurJusqu === T + 60e3, JSON.stringify([info, info2, e1.caracteres, n1 - n0]));
    G.mode = 'ok'; const f3 = await vg.dire('Vérifie.', '', sortie(3), {force: true}); const e3 = vg.etat();
    ok('« Vérifier » essaie quand même ; un succès relance Google tout de suite', !!f3 && e3.horsErreurJusqu === 0 && !!e3.dernierSucces && e3.caracteres === 8 + 9, JSON.stringify(e3));
    G.mode = 'panne'; await vg.dire('Un.', '', sortie(4)); T += 61e3; await vg.dire('Deux.', '', sortie(5)); const e4 = vg.etat();
    ok('pannes répétées : 1 minute, puis 2 minutes sans Google', e4.horsErreurJusqu === T + 120e3, String(e4.horsErreurJusqu - T)); G.mode = 'ok'; T += 3 * 60e3; }
  /* 3. deux phrases en même temps ne passent pas le plafond */
  { const {vg, sortie} = fabrique('ensemble', {plafond: 30}); const n0 = G.synth.length; G.lent = 150;
    const [a, b] = await Promise.all([vg.dire('x'.repeat(20), '', sortie(1)), vg.dire('y'.repeat(20), '', sortie(2))]); G.lent = 0; const e = vg.etat();
    ok('deux phrases à la fois, place pour une seule : une seule part chez Google, le compteur reste sous le plafond', [a, b].filter(Boolean).length === 1 && G.synth.length - n0 === 1 && e.caracteres === 20 && e.caracteres <= 30, JSON.stringify([a, b, e.caracteres])); }
  /* 4. jamais au-delà du plafond du mois ; alertes à 80 %, 95 %, puis pause jusqu'au 1er */
  { const {vg, A, sortie} = fabrique('plafond', {plafond: 100}); let tot = 0, i = 0;
    for (const n of [79, 1, 15, 4, 1, 1]) { const f = await vg.dire('z'.repeat(n), '', sortie(++i)); if (f) tot += n; }
    const e = vg.etat(), n0 = G.synth.length, f = await vg.dire('a', '', sortie(99)), n1 = G.synth.length;
    ok('plafond du mois : jamais dépassé (100 sur 100 : la dernière phrase qui ne tient pas reste à Pierre), alertes 80 % puis 95 %, puis pause ; plus rien ne part chez Google', tot === 100 && e.caracteres === 100 && A.join('|') === 'Voix Google : 80 % du plafond|Voix Google : 95 % du plafond|Voix Google en pause' && e.pause === true && f === null && n1 === n0, JSON.stringify([tot, e.caracteres, A, e.pause]));
    T = Date.parse('2026-12-01T07:59:00Z'); const g1 = vg.etat();   /* 23 h 59 le 30 novembre à Los Angeles */
    T = Date.parse('2026-12-01T08:01:00Z'); const g2 = vg.etat(), f2 = await vg.dire('Décembre.', '', sortie(100));   /* 0 h 01 le 1er décembre là-bas */
    ok('mois de facturation de Google (heure du Pacifique) : encore novembre à 8 h 59 à Paris le 1er, puis un nouveau mois', g1.mois === '2026-11' && g1.pause === true && g2.mois === '2026-12' && g2.caracteres === 0 && !!f2, JSON.stringify([g1.mois, g2.mois]));
    T = Date.parse('2026-11-21T18:00:00Z'); }
  /* 5. plafond du jour */
  { const {vg, A, sortie} = fabrique('jour', {plafond: 1000, jour: 25}); const f1 = await vg.dire('a'.repeat(15), '', sortie(1)), info = {}, f2 = await vg.dire('b'.repeat(15), '', sortie(2), {info}), f3 = await vg.dire('c'.repeat(15), '', sortie(3));
    const e = vg.etat(); T += 864e5; const f4 = await vg.dire('d'.repeat(15), '', sortie(4)); T -= 864e5;
    ok('plafond du jour : la boucle s\'arrête (une alerte, Pierre jusqu\'à demain), reprise le lendemain', !!f1 && f2 === null && f3 === null && /plafond du jour/.test(info.raison) && A.filter((x) => /jour/.test(x)).length === 1 && e.pauseJour === true && !!f4, JSON.stringify([info, A, e.aujourdhui])); }
  /* 6. compteur illisible : coupé par prudence jusqu'au mois suivant ; avec la copie de l'état du serveur, il repart de la plus haute */
  { const {vg, A, d, sortie} = fabrique('illisible'); fs.writeFileSync(path.join(d, 'compteur.json'), '{ abîmé'); const n0 = G.synth.length, info = {};
    const f = await vg.dire('Bonjour.', '', sortie(1), {info}), e = vg.etat(), f2 = await vg.dire('Encore.', '', sortie(2));
    ok('compteur illisible sans copie : Google coupé (une alerte), rien ne part, et ça tient', f === null && f2 === null && G.synth.length === n0 && /compteur illisible/.test(info.raison) && e.bloque === true && A.join('|') === 'Voix Google coupée', JSON.stringify([info, A, e.bloque])); }
  { const mois = '2026-11', {vg, d, sortie} = fabrique('copie', {plafond: 600, miroir: {mois, caracteres: 500, appels: 9, jour: '2026-11-21', jourOctets: 500}});
    fs.writeFileSync(path.join(d, 'compteur.json'), '{ abîmé'); const e = vg.etat(), f = await vg.dire('q'.repeat(90), '', sortie(1)), f2 = await vg.dire('q'.repeat(150), '', sortie(2)), e2 = vg.etat();
    ok('compteur illisible, mais copie lisible dans l\'état du serveur : on repart de la copie (500), le plafond tient (590, puis pause)', e.bloque === false && e.caracteres === 500 && !!f && f2 === null && e2.caracteres === 590 && e2.pause === true, JSON.stringify([e.caracteres, e2.caracteres])); }
  { const {vg, M, d, sortie} = fabrique('efface', {plafond: 600}); await vg.dire('w'.repeat(400), '', sortie(1)); fs.rmSync(path.join(d, 'compteur.json'));
    const e = vg.etat(), f = await vg.dire('w'.repeat(250), '', sortie(2));
    ok('compteur effacé : la copie de l\'état du serveur fait foi (400), rien au-delà du plafond', e.caracteres === 400 && f === null && M.c && M.c.caracteres === 400, JSON.stringify(e)); }
  { const {vg, d, sortie} = fabrique('max', {plafond: 1000, miroir: {mois: '2026-11', caracteres: 300, appels: 1, jour: 'x', jourOctets: 0}});
    fs.writeFileSync(path.join(d, 'compteur.json'), JSON.stringify({mois: '2026-11', caracteres: 700, appels: 5, jour: 'x', jourOctets: 0})); const e = vg.etat();
    ok('deux copies différentes : la plus haute fait foi', e.caracteres === 700 && e.appels === 5, JSON.stringify(e)); void sortie; }
  /* 7. une demande trop longue ne part pas ; sans clé, rien ne part */
  { const {vg, d, sortie} = fabrique('long'); const n0 = G.synth.length, info = {}; const f = await vg.dire('é'.repeat(2500), '', sortie(1), {info});
    fs.rmSync(path.join(d, 'cle.json')); const info2 = {}, f2 = await vg.dire('Bonjour.', '', sortie(2), {info: info2});
    ok('texte de plus de 4 800 octets refusé ; sans clé, rien ne part chez Google', f === null && /trop long/.test(info.raison) && f2 === null && /aucune clé/.test(info2.raison) && G.synth.length === n0 && vg.etat().caracteres === 0, JSON.stringify([info, info2])); }
  /* 8. Google qui ne répond pas : coupé à 15 s (ici simulé par une erreur), Pierre ensuite */
  { const {vg, sortie} = fabrique('refus'); G.mode = 'refus'; const info = {}; const f = await vg.dire('Bonjour.', '', sortie(1), {info}); G.mode = 'ok'; const e = vg.etat();
    ok('API pas activée (403) : l\'erreur exacte de Google est gardée pour Réglages', f === null && /has not been used in project/.test(e.erreur && e.erreur.message) && /Google 403/.test(info.raison), JSON.stringify(e.erreur)); }
  /* 9. les voix conseillées, et la diction de son nom */
  { const {vg} = fabrique('voix'); const v = await vg.voix();
    ok('voix : les conseillées pour JARVIS sont marquées (Charon, Iapetus, Algieba, Orus)', v.filter((x) => x.conseillee).map((x) => x.court).sort().join(',') === [...VOIX_CONSEILLEES].sort().join(',') && v.find((x) => x.court === 'Aoede').conseillee === false, JSON.stringify(v)); }
  ok('diction : J.A.R.V.I.S OS se dit « Jarvis O.S. », JARVIS se dit « Jarvis »', diction('Bienvenue dans J.A.R.V.I.S OS.') === 'Bienvenue dans Jarvis O.S.' && diction('JARVIS est à jour.') === 'Jarvis est à jour.', diction('Bienvenue dans J.A.R.V.I.S OS.'));
} catch (e) { ok('le banc a planté', false, String(e && e.stack || e)); }
finally { SRV.close(); fs.rmSync(DIR, {recursive: true, force: true}); }
for (const r of results) console.log(r);
console.log(fails ? fails + ' échec(s) sur ' + results.length + ' vérifications.' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
