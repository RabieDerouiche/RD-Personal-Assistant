/* Banc de l'administration des routines d'Hermes (0.96.0) : node jarvis-os/server/tests/hermes-admin.test.mjs — données inventées,
   aucun réseau, horloge du banc. Le module seul : ordres posés, plafonds, réponses de root revalidées, historique fusionné, erreur
   en détail. Les routes (appareil relié, invité, jeton MCP, Raccourci, notification) sont dans server.test.mjs ; l'écran, dans banc.cjs. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {createHermesRoutines, formeHoraire, momentDe} from '../hermes-routines.mjs';
import {createHermesAdmin, texteErreur} from '../hermes-admin.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info && !cond ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-admin-'));
const HD = path.join(DIR, 'etat'), HO = path.join(DIR, 'reveil', 'ordres');
let T = Date.UTC(2026, 10, 27, 13, 2, 0);   /* 27/11/2026, 14 h 02 à Paris */
const now = () => T, sec = () => Math.floor(T / 1000), iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const rt = (nom, libelle, plus = {}) => ({nom, libelle, moment: 'chaque jour à 9 h', mode: 'réel', posee: true, active: true, dernier: iso(T - 3600e3), resultat: 'ok', cause: null, prochain: iso(T + 3600e3),
  pause: null, en_cours: false, origine: 'chaque jour à 9 h', modifie: false, forme: {jours: 'tous', heures: ['09:00']}, evenement: false, ...plus});
const NOMS = {'veille-du-matin': 'Veille du matin', 'bilan-hebdo': 'Bilan de la semaine', reveil: 'Réveil', 'digest-ia': 'Digest IA et .NET', 'prix-suivis': 'Prix suivis', 'sorties-du-week-end': 'Sorties du week-end'};
let ROUT = Object.entries(NOMS).map(([n, l]) => rt(n, l));
const resume = (plus = {}) => { fs.mkdirSync(HD, {recursive: true}); fs.writeFileSync(path.join(HD, 'routines.json'), JSON.stringify({v: 1, at: sec(), liste: true, cron: true, passerelle: 'active', garde: {etat: 'actif', jusqua: null}, routines: ROUT, ...plus})); };
const root = (f, o) => fs.writeFileSync(path.join(HD, f), typeof o === 'string' ? o : JSON.stringify(o));
const poses = () => (fs.existsSync(HO) ? fs.readdirSync(HO).sort() : []);
const lu = (f) => JSON.parse(fs.readFileSync(path.join(HO, f), 'utf8'));
const vider = () => { for (const f of poses()) fs.rmSync(path.join(HO, f)); };
const neuf = (plus = {}) => { const S = {push: {subs: [1]}}, envois = [];
  const adm = createHermesAdmin({routines: createHermesRoutines({fichier: path.join(HD, 'routines.json'), now}), dossierEtat: HD, dossierOrdres: HO, S, save: () => {}, now, push: {send: async (m) => { envois.push(m); return [{ok: true}]; }},
    connues: () => NOMS, sain: (t) => !/solde|mensualité/i.test(t), attente: () => plus.attente || null});
  return {adm, S, envois}; };
/* root répond à un ordre posé */
const repond = (id, plus) => { const f = path.join(HD, 'ordres.json'), d = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {v: 1, ordres: []};
  d.ordres = d.ordres.filter((x) => x.id !== id).concat({id, traite: sec(), raison: null, reprise: null, fin: null, resultat: null, cause: null, ...plus}); root('ordres.json', d); };

try {
  /* ---------- la forme fermée d'un horaire ---------- */
  const f = (j, hs) => { const x = formeHoraire(j, hs); return x.ok ? x.jours + ' ' + x.heures.join(',') : x.code; };
  ok('horaire : formes valides (tous, ouvrés, jours choisis rangés du lundi au dimanche, sept jours = tous) ; la phrase est celle de root',
    f('tous', ['09:00']) === 'tous 09:00' && f('ouvres', ['07:40']) === 'ouvres 07:40' && f(['dim', 'lun', 'sam'], ['08:30']) === 'lun,sam,dim 08:30' && f(['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'], ['08:00']) === 'tous 08:00'
    && momentDe(formeHoraire('ouvres', ['07:40'])) === 'du lundi au vendredi à 7 h 40' && momentDe(formeHoraire('tous', ['09:15', '13:15', '18:15'])) === 'chaque jour à 9 h 15, 13 h 15 et 18 h 15' && momentDe(formeHoraire(['sam', 'dim'], ['08:30'])) === 'le samedi et le dimanche à 8 h 30');
  ok('horaire : deux heures rapprochées acceptées (9 h 00 et 9 h 15) ; deux heures identiques n’en font qu’une',
    f('tous', ['09:00', '09:15']) === 'tous 09:00,09:15' && momentDe(formeHoraire('tous', ['09:00', '09:15'])) === 'chaque jour à 9 h et 9 h 15' && f('tous', ['09:00', '09:00']) === 'tous 09:00' && f('tous', ['09:00', '09:30', '14:00', '14:30']) === 'tous 09:00,09:30,14:00,14:30');
  ok('horaire : heure hors du pas de 5, cinq heures, jour inconnu, heure impossible, expression libre, heures qui ne tiennent pas dans un seul horaire : refusés avec leur code',
    f('tous', ['09:07']) === 'pas' && f('tous', ['06:00', '09:00', '12:00', '15:00', '18:00']) === 'trop' && f(['lundi'], ['09:00']) === 'jours' && f('1-5', ['09:00']) === 'jours' && f('tous', ['24:00']) === 'heures' && f('tous', ['* * * * *']) === 'heures'
    && f('tous', '0 9 * * *') === 'heures' && f('tous', []) === 'heures' && f('tous', ['07:40', '13:15']) === 'forme');

  /* ---------- le texte d'une erreur relu par JARVIS ---------- */
  ok('erreur : le texte de root est rebordé (8 lignes, 160 caractères par ligne, 600 en tout) et remasqué (clé, porteur, adresse, chemin, URL)',
    texteErreur('ValueError: sk-PIEGE123456 Bearer abcdefPIEGE jean@exemple.fr /home/hermes/.hermes/x.py https://u:p@api.exemple.invalid/v1?cle=PIEGE') === 'ValueError: [clé masquée] Bearer [masqué] [adresse mail] x.py api.exemple.invalid'
    && texteErreur(Array.from({length: 20}, (_, i) => 'ligne ' + i + ' ' + 'mot '.repeat(80)).join('\n')).split('\n').length <= 8 && texteErreur('x'.repeat(5000)).length <= 600 && texteErreur('a\u0000b\u001b[31m\n\n c ') === 'a b [31m\nc', texteErreur('ValueError: sk-PIEGE123456 Bearer abcdefPIEGE jean@exemple.fr /home/hermes/.hermes/x.py https://u:p@api.exemple.invalid/v1?cle=PIEGE'));
  ok('erreur : pas une chaîne, vide, ou un mot réservé (rien de bancaire) : rien, ou « détail masqué »', texteErreur(null) === null && texteErreur({a: 1}) === null && texteErreur('  ') === null && texteErreur('Erreur : solde du compte', (t) => !/solde/.test(t)) === '(détail masqué : il contenait un mot réservé)');

  /* ---------- Hermes pas installé ---------- */
  let {adm, S, envois} = neuf();
  let d = adm.detail('reveil'), p = adm.poser({nom: 'reveil', action: 'lancer'});
  ok('Hermes pas installé (ni résumé, ni dossier des ordres) : la feuille le dit (« indisponible », avec la raison), un ordre répond 503 sans rien écrire',
    d.status === 200 && d.body.disponible === false && /n’existe pas sur ce serveur/.test(d.body.raison) && d.body.etat === 'inconnu' && d.body.historique.length === 0 && p.status === 503 && p.body.code === 'installation' && !fs.existsSync(HO) && !fs.existsSync(HO + '.tmp') && !S.hermesAdmin.ordres.length, JSON.stringify([d.body, p]));

  /* ---------- poser un ordre ---------- */
  fs.mkdirSync(HO, {recursive: true, mode: 0o700}); resume();
  ok('routine hors de la liste, nom piégé, action inconnue : refusés (400), rien n’est posé',
    adm.poser({nom: 'pirate', action: 'pause'}).status === 400 && adm.poser({nom: '../../etc/passwd', action: 'pause'}).status === 400 && adm.poser({nom: 'reveil', action: 'supprimer'}).status === 400 && adm.poser({nom: 'reveil'}).status === 400 && adm.poser(null).status === 400
    && adm.detail('pirate').status === 404 && adm.detail('../x').status === 404 && !poses().length);
  p = adm.poser({nom: 'veille-du-matin', action: 'lancer', commande: 'rm -rf /', at: 1}); let o1 = poses()[0], c1 = o1 ? lu(o1) : {};
  ok('« lancer » : un fichier d’ordre dans le dossier que root surveille : {id, routine, action, at} et rien d’autre (aucun champ de la demande recopié), nom « ordre-<id>.json », 600, écrit à côté puis glissé (rien de temporaire laissé)',
    p.status === 200 && poses().length === 1 && /^ordre-[a-f0-9]{16}\.json$/.test(o1) && JSON.stringify(Object.keys(c1)) === '["id","routine","action","at"]' && o1 === 'ordre-' + c1.id + '.json' && c1.routine === 'veille-du-matin' && c1.action === 'lancer' && c1.at === sec()
    && (fs.statSync(path.join(HO, o1)).mode & 0o777) === 0o600 && fs.readdirSync(HO + '.tmp').length === 0 && fs.statSync(path.join(HO, o1)).size < 512, JSON.stringify([p, poses(), c1]));
  d = adm.detail('veille-du-matin').body;
  ok('… la feuille : « Demandé à 14 h 02 — en attente du serveur… », pas fini', p.body.ordre.etat === 'posé' && d.ordre.etat === 'posé' && d.ordre.texte === 'Demandé à 14 h 02 — en attente du serveur…' && d.ordre.fini === false && d.etat === 'active', JSON.stringify(d.ordre));
  p = adm.poser({nom: 'veille-du-matin', action: 'pause'});
  ok('… un second ordre pour la même routine tant que root n’a pas répondu : refusé tout de suite (409), rien de posé', p.status === 409 && p.body.code === 'attente' && /attend déjà le serveur/.test(p.body.error) && poses().length === 1, JSON.stringify(p));
  repond(c1.id, {etat: 'en cours'}); d = adm.detail('veille-du-matin').body; let l = adm.liste();
  ok('root répond « en cours » : « Demandé à 14 h 02 — en cours… » ; la liste des routines le porte aussi (pastille)', d.ordre.etat === 'en cours' && d.ordre.texte === 'Demandé à 14 h 02 — en cours…' && d.peut.lancer === false && /déjà en cours/.test(d.peut.raison)
    && l.routines.find((x) => x.nom === 'veille-du-matin').ordre.etat === 'en cours' && !('ordre' in l.routines.find((x) => x.nom === 'reveil')), JSON.stringify([d.ordre, d.peut]));
  p = adm.poser({nom: 'veille-du-matin', action: 'lancer'});
  ok('… relancer pendant ce temps : refusé (un passage est déjà en cours)', p.status === 409 && p.body.code === 'en-cours', JSON.stringify(p));
  let n = await adm.tick();
  ok('… tant que le passage court : aucune notification', n === 0 && envois.length === 0);
  T += 4 * 60000; resume(); repond(c1.id, {etat: 'terminé', fin: iso(T - 5000), resultat: 'ok'});
  root('historique.json', {v: 1, at: sec(), routines: {'veille-du-matin': [{fin: iso(T - 5000), debut: iso(T - 225000), duree: 220, mode: 'réel', resultat: 'ok', cause: null, lance: 'jarvis', ordre: c1.id, erreur: null}]}});
  n = await adm.tick(); const n2 = await adm.tick(); d = adm.detail('veille-du-matin').body;
  ok('le passage lancé à la main se termine : UNE notification (« Hermes : « Veille du matin » terminée », réussie), qui ouvre sa feuille',
    n === 1 && n2 === 0 && envois.length === 1 && envois[0].title === 'Hermes : « Veille du matin » terminée' && envois[0].body === 'Lancée depuis JARVIS à 14 h 02 : réussie.' && envois[0].url === '/#voir-routine-veille-du-matin', JSON.stringify(envois));
  ok('… la feuille : « Lancée à 14 h 02, terminée à 14 h 05 : réussie. » ; l’historique dit « lancé à la main depuis JARVIS », la durée, le mode',
    d.ordre.etat === 'terminé' && d.ordre.texte === 'Lancée à 14 h 02, terminée à 14 h 05 : réussie.' && d.historique.length === 1 && d.historique[0].lanceDit === 'lancé à la main depuis JARVIS' && d.historique[0].duree === 220 && d.historique[0].mode === 'réel'
    && d.stats.passages === 1 && d.stats.taux === 100 && d.stats.dureeMoyenne === 220, JSON.stringify([d.ordre, d.historique, d.stats]));
  vider(); p = adm.poser({nom: 'veille-du-matin', action: 'lancer'});
  ok('relancer la même routine moins de 5 minutes après : refusé avec l’heure à partir de laquelle c’est possible', p.status === 409 && p.body.code === 'trop-tot' && /possible à 14 h 07/.test(p.body.error) && !poses().length, JSON.stringify(p));

  /* ---------- un passage en erreur : la notification sans le détail, la feuille avec ---------- */
  T += 60000; p = adm.poser({nom: 'prix-suivis', action: 'lancer'}); const c2 = lu(poses()[0]); vider();
  T += 3 * 60000; const finErr = iso(T - 2000);
  ROUT = ROUT.map((x) => (x.nom === 'prix-suivis' ? rt('prix-suivis', 'Prix suivis', {dernier: finErr, resultat: 'erreur', cause: 'réseau'}) : x)); resume();
  repond(c2.id, {etat: 'terminé', fin: finErr, resultat: 'erreur', cause: 'réseau', detail: 'ConnectError PIEGE'});
  root('historique.json', {v: 1, at: sec(), routines: {'prix-suivis': [
    {fin: iso(T - 86400e3), debut: iso(T - 86400e3 - 90e3), duree: 90, mode: 'réel', resultat: 'ok', cause: null, lance: 'programme', ordre: null, erreur: 'PIEGE : une réussite n’a pas d’erreur'},
    {fin: finErr, debut: iso(T - 62000), duree: 60, mode: 'réel', resultat: 'erreur', cause: 'réseau', lance: 'jarvis', ordre: c2.id, erreur: 'ConnectError: api.exemple.invalid a coupé\nFile "jobs.py", line 12', secret: 'PIEGE'},
    {fin: 'hier PIEGE', resultat: 'ok'}, {fin: iso(T), resultat: 'rm -rf PIEGE'}, 'PIEGE', null,
    {fin: iso(T - 7200e3), debut: 'PIEGE', duree: -5, mode: 'root', resultat: 'erreur', cause: 'RuntimeError PIEGE', lance: 'pirate', ordre: '../PIEGE', erreur: {texte: 'PIEGE'}}]}, 'pirate': [{fin: finErr, resultat: 'ok'}]});
  n = await adm.tick(); d = adm.detail('prix-suivis').body;
  ok('passage lancé à la main en erreur : la notification dit la catégorie, JAMAIS le détail de l’erreur', n === 1 && envois.length === 2 && envois[1].title === 'Hermes : « Prix suivis » en erreur'
    && envois[1].body === 'Lancée depuis JARVIS à 14 h 07 : en erreur (réseau). Le détail est dans sa feuille, dans JARVIS.' && !/ConnectError|exemple|jobs\.py|PIEGE/.test(JSON.stringify(envois)), JSON.stringify(envois[1]));
  ok('… la feuille : « L’erreur en détail » (la cause en clair, le texte nettoyé par root, quoi faire), l’état « en erreur »',
    d.etat === 'en erreur' && d.erreur && d.erreur.cause === 'réseau' && d.erreur.detail === 'ConnectError: api.exemple.invalid a coupé\nFile "jobs.py", line 12' && /Relance-la/.test(d.erreur.conseil) && d.erreur.relancer === true && d.erreur.quand === finErr, JSON.stringify(d.erreur));
  const hp = d.historique;
  ok('… historique piégé : chaque passage repasse par la liste blanche (date, mode, cause, « lancé », ordre ; une réussite n’a pas d’erreur ; entrées illisibles écartées ; champs en trop jamais rendus)',
    hp.length === 3 && hp[0].fin === finErr && hp[1].mode === 'double' && hp[1].cause === 'erreur' && hp[1].lance === 'programme' && hp[1].ordre === null && hp[1].debut === null && hp[1].duree === null && hp[1].erreur === null
    && hp[2].resultat === 'ok' && hp[2].erreur === null && !/PIEGE|pirate|secret/.test(JSON.stringify(d)) && d.stats.passages === 3 && d.stats.reussis === 1 && d.stats.taux === 33 && d.stats.dureeMoyenne === 75, JSON.stringify(hp));
  ok('… la liste des routines et la ligne de santé ne portent que la catégorie : jamais le détail', !/ConnectError|jobs\.py/.test(JSON.stringify([adm.liste(), createHermesRoutines({fichier: path.join(HD, 'routines.json'), now}).sante()])));
  d = neuf({attente: {attente: [{nom: 'prix-suivis', reprise: sec() + 3600}]}});
  ROUT = ROUT.map((x) => (x.nom === 'prix-suivis' ? rt('prix-suivis', 'Prix suivis', {dernier: finErr, resultat: 'erreur', cause: 'limite du forfait'}) : x)); resume();
  const dl = d.adm.detail('prix-suivis').body;
  ok('erreur « limite du forfait » avec une relance en attente : « reprise vers 15 h 10, elle repartira seule »', dl.erreur.cause === 'limite du forfait' && /reprise vers 15 h 10, elle repartira seule/.test(dl.erreur.conseil), JSON.stringify(dl.erreur));

  /* ---------- les refus de root, dits avec leur raison ---------- */
  T += 10 * 60000; resume(); vider();
  p = adm.poser({nom: 'reveil', action: 'pause'}); let c = lu(poses()[0]); vider(); repond(c.id, {etat: 'refusé', raison: 'hermes'});
  ok('refus de root : dit avec sa raison (« Refusé à … : Hermes a refusé. ») ; pas de notification', adm.detail('reveil').body.ordre.texte === 'Refusé à 14 h 20 : Hermes a refusé.' && (await adm.tick()) === 0, JSON.stringify(adm.detail('reveil').body.ordre));
  repond(c.id, {etat: 'refusé', raison: 'limite', reprise: iso(T + 3 * 3600e3)});
  ok('… limite du forfait : « reprise vers 17 h 20, elle repartira seule »', /^Refusé à 14 h 20 : la limite du forfait Claude est atteinte : reprise vers 17 h 20, elle repartira seule\.$/.test(adm.detail('reveil').body.ordre.texte), adm.detail('reveil').body.ordre.texte);
  repond(c.id, {etat: 'refusé', raison: '<img src=x onerror=alert(1)> PIEGE', reprise: 'demain PIEGE'});
  ok('… raison hors de la liste des codes connus : « Hermes a refusé », rien de recopié', adm.detail('reveil').body.ordre.texte === 'Refusé à 14 h 20 : Hermes a refusé.' && !/PIEGE|onerror/.test(JSON.stringify(adm.detail('reveil').body)));
  root('ordres.json', '{"v": 1, "ordres": [{"id": "' + c.id + '", "etat": "explosé"}, "PIEGE", {"id": "../x", "etat": "fait"}]}');
  ok('… réponse de root à l’état inconnu : ignorée (l’ordre reste « en attente »)', adm.detail('reveil').body.ordre.etat === 'posé');
  root('ordres.json', '{"v": 1, "ordres": ['); const coupe = adm.detail('reveil').body.ordre.etat; fs.rmSync(path.join(HD, 'ordres.json')); fs.writeFileSync(path.join(DIR, 'ailleurs.json'), JSON.stringify({v: 1, ordres: [{id: c.id, etat: 'fait'}]})); fs.symlinkSync(path.join(DIR, 'ailleurs.json'), path.join(HD, 'ordres.json'));
  ok('… réponses de root illisibles, ou remplacées par un lien : jamais suivies', coupe === 'posé' && adm.detail('reveil').body.ordre.etat === 'posé');
  fs.rmSync(path.join(HD, 'ordres.json')); T += 95000; resume();
  ok('root ne répond pas au bout de 90 secondes : « pas pris en compte : le serveur ne répond pas », et un nouvel ordre redevient possible', adm.detail('reveil').body.ordre.etat === 'sans réponse' && /pas pris en compte : le serveur ne répond pas/.test(adm.detail('reveil').body.ordre.texte) && adm.poser({nom: 'reveil', action: 'pause'}).status === 200);
  vider();

  /* ---------- les refus immédiats de JARVIS d'après le résumé ---------- */
  ({adm, S, envois} = neuf()); T += 3600e3;
  const etat = (plus, r = {}) => { ROUT = Object.entries(NOMS).map(([nm, lb]) => rt(nm, lb, r[nm] || {})); resume(plus); };
  etat({passerelle: 'arrêtée'}); const r1 = adm.poser({nom: 'reveil', action: 'lancer'}), r1b = adm.poser({nom: 'reveil', action: 'pause'});
  etat({garde: {etat: 'a arrêté Hermes', jusqua: null}}); const r2 = adm.poser({nom: 'digest-ia', action: 'lancer'});
  etat({}, {'bilan-hebdo': {active: false, prochain: null, pause: {depuis: iso(T - 3600e3), par: 'jarvis'}}, 'prix-suivis': {en_cours: true}, 'sorties-du-week-end': {posee: false, active: false}});
  const r3 = adm.poser({nom: 'bilan-hebdo', action: 'lancer'}), r4 = adm.poser({nom: 'prix-suivis', action: 'lancer'}), r5 = adm.poser({nom: 'sorties-du-week-end', action: 'pause'}), db = adm.detail('bilan-hebdo').body;
  ok('refus immédiats : passerelle arrêtée (« Hermes est arrêté »), garde du forfait, routine en pause, passage en cours, routine pas posée ; une pause reste possible Hermes arrêté',
    [r1, r2, r3, r4, r5].map((x) => x.status + ':' + x.body.code).join() === '409:passerelle,409:garde,409:pause,409:en-cours,409:pas-posee' && r1b.status === 200 && poses().length === 1, JSON.stringify([r1, r2, r3, r4, r5].map((x) => x.body)));
  ok('… la feuille d’une routine en pause : « en pause », depuis quand et par qui ; « Lancer » dit pourquoi il est refusé', db.etat === 'en pause' && db.routine.pause.par === 'jarvis' && db.routine.pause.depuis === iso(T - 3600e3) && db.peut.lancer === false && /reprends-la d’abord/.test(db.peut.raison), JSON.stringify([db.etat, db.routine.pause, db.peut]));
  vider();

  /* ---------- plafonds ---------- */
  ({adm, S, envois} = neuf()); etat({}); T = Date.UTC(2026, 10, 28, 7, 0, 0); resume();
  const lances = []; for (let i = 0; i < 13; i++) { const nm = Object.keys(NOMS)[i % 5]; const x = adm.poser({nom: nm, action: 'lancer'}); lances.push(x.status + (x.body.code ? ':' + x.body.code : '')); if (x.status === 200) repond(x.body.ordre.id, {etat: 'terminé', fin: iso(T), resultat: 'ok'}); T += 6 * 60000; resume(); }
  ok('plafond : 12 lancements par jour en tout, le treizième est refusé (« plafond du jour atteint »)', lances.slice(0, 12).every((x) => x === '200') && lances[12] === '409:plafond' && poses().length === 12, lances.join());
  T = Date.UTC(2026, 10, 29, 7, 0, 0); resume(); vider();
  ok('… le lendemain : de nouveau possible', adm.poser({nom: 'reveil', action: 'lancer'}).status === 200);
  ({adm, S, envois} = neuf()); vider(); const hs = [];
  for (let i = 0; i < 7; i++) { const x = adm.poser({nom: Object.keys(NOMS)[i % 5], action: 'horaire', jours: 'tous', heures: ['0' + (i + 1) + ':00']}); hs.push(x.status + (x.body.code ? ':' + x.body.code : '')); if (x.status === 200) repond(x.body.ordre.id, {etat: 'fait'}); T += 1000; }
  ok('plafond : 6 changements d’horaire par jour, le septième est refusé', hs.slice(0, 6).every((x) => x === '200') && hs[6] === '409:plafond', hs.join());
  ({adm, S, envois} = neuf()); vider();
  const x1 = adm.poser({nom: 'reveil', action: 'lancer'}); repond(x1.body.ordre.id, {etat: 'refusé', raison: 'passerelle'}); T += 1000;
  ok('un lancement refusé par root ne compte ni pour les 5 minutes ni pour le plafond', adm.poser({nom: 'reveil', action: 'lancer'}).status === 200);
  vider();

  /* ---------- l'horaire ---------- */
  ({adm, S, envois} = neuf()); T += 3600e3; resume();
  p = adm.poser({nom: 'veille-du-matin', action: 'horaire', jours: 'ouvres', heures: ['07:40', '07:40'], cronn: 'x'}); c = lu(poses()[0]); vider();
  ok('« horaire » : l’ordre porte la forme fermée (jours, heures dédoublonnées), jamais une expression ; le message de confirmation dit l’horaire en clair',
    p.status === 200 && JSON.stringify(Object.keys(c)) === '["id","routine","action","at","jours","heures"]' && c.jours === 'ouvres' && JSON.stringify(c.heures) === '["07:40"]' && p.body.ordre.moment === 'du lundi au vendredi à 7 h 40', JSON.stringify([p, c]));
  repond(c.id, {etat: 'fait'});
  ok('… root l’a fait : « Horaire changé — pris en compte à … : du lundi au vendredi à 7 h 40. »', /^Horaire changé — pris en compte à \d\d h \d\d : du lundi au vendredi à 7 h 40\.$/.test(adm.detail('veille-du-matin').body.ordre.texte), adm.detail('veille-du-matin').body.ordre.texte);
  const hr = [adm.poser({nom: 'reveil', action: 'horaire', cron: '* * * * *'}), adm.poser({nom: 'reveil', action: 'horaire', jours: 'tous', heures: ['09:00'], expr: '0 9 * * *'}), adm.poser({nom: 'reveil', action: 'horaire', jours: 'tous', heures: ['09:07']}),
    adm.poser({nom: 'reveil', action: 'horaire', jours: 'tous', heures: ['06:00', '09:00', '12:00', '15:00', '18:00']}), adm.poser({nom: 'reveil', action: 'horaire', jours: ['lundi'], heures: ['09:00']}), adm.poser({nom: 'reveil', action: 'horaire', jours: 'tous', heures: ['07:40', '13:15']}), adm.poser({nom: 'reveil', action: 'horaire'})];
  ok('… cron libre, heure hors pas, cinq heures, jour inconnu, heures qui ne tiennent pas dans un seul horaire, rien : refusés (400) avec leur raison, rien de posé',
    hr.map((x) => x.status + ':' + x.body.code).join() === '400:libre,400:libre,400:pas,400:trop,400:jours,400:forme,400:jours' && /même minute/.test(hr[5].body.error) && !poses().length, JSON.stringify(hr.map((x) => x.body)));
  p = adm.poser({nom: 'reveil', action: 'horaire', jours: 'tous', heures: ['09:15', '09:00']}); c = lu(poses()[0]); vider();
  ok('… deux heures rapprochées acceptées (9 h 00 et 9 h 15)', p.status === 200 && JSON.stringify(c.heures) === '["09:00","09:15"]' && p.body.ordre.moment === 'chaque jour à 9 h et 9 h 15');
  p = adm.poser({nom: 'digest-ia', action: 'horaire', origine: true, jours: 'tous', heures: ['10:00']}); c = lu(poses()[0]); vider(); repond(c.id, {etat: 'fait'});
  ok('… « Revenir à l’horaire d’origine » : l’ordre porte « origine » et rien d’autre', p.status === 200 && JSON.stringify(Object.keys(c)) === '["id","routine","action","at","origine"]' && c.origine === true && /^Horaire d’origine remis — pris en compte/.test(adm.detail('digest-ia').body.ordre.texte));

  /* ---------- tout mettre en pause, tout reprendre ---------- */
  ({adm, S, envois} = neuf()); etat({}, {'bilan-hebdo': {active: false, prochain: null, pause: {depuis: iso(T - 60000), par: 'jarvis'}}, 'sorties-du-week-end': {posee: false, active: false}});
  let tp = adm.tout('pause'), fichiers = poses().map(lu);
  ok('« Tout mettre en pause » : un ordre par routine posée et active (ni celle déjà en pause, ni celle pas posée)', tp.status === 200 && tp.body.faits.map((x) => x.nom).sort().join() === 'digest-ia,prix-suivis,reveil,veille-du-matin' && fichiers.length === 4 && fichiers.every((x) => x.action === 'pause'), JSON.stringify(tp.body));
  vider(); ({adm, S, envois} = neuf()); tp = adm.tout('reprendre'); fichiers = poses().map(lu);
  ok('« Tout reprendre » : seulement celle qui est en pause ; « tout lancer » n’existe pas', tp.body.faits.map((x) => x.nom).join() === 'bilan-hebdo' && fichiers.length === 1 && fichiers[0].action === 'reprendre' && adm.tout('lancer').status === 400 && adm.tout('horaire').status === 400 && poses().length === 1);
  vider(); fs.rmSync(path.join(HD, 'routines.json'));
  ok('… état des routines indisponible : refusé (rien à l’aveugle)', adm.tout('pause').status === 409 && !poses().length);

  /* ---------- ce qu'elle a fait : les résumés de routine_fin, gardés par JARVIS ---------- */
  ({adm, S, envois} = neuf()); etat({}); T += 3600e3; resume();
  for (let i = 0; i < 34; i++) { T += 1000; adm.noterResume('reveil', 'Passage ' + i + ' : deux courriers traités.'); }
  adm.noterResume('../x', 'PIEGE'); adm.noterResume('reveil', ' '); adm.noterResume('reveil', 'x'.repeat(900));
  ok('routine_fin : JARVIS garde les 30 derniers résumés par routine (300 caractères au plus), rien pour un nom qui n’en est pas un', S.hermesAdmin.resumes.reveil.length === 30 && S.hermesAdmin.resumes.reveil[29].texte.length === 300 && S.hermesAdmin.resumes.reveil[0].texte === 'Passage 5 : deux courriers traités.' && Object.keys(S.hermesAdmin.resumes).join() === 'reveil');
  ({adm, S, envois} = neuf()); const t0 = T;
  T = t0 + 60000; adm.noterResume('reveil', 'Premier : un courrier traité.'); T = t0 + 3600e3 + 50000; adm.noterResume('reveil', 'Deuxième : rien à traiter.'); T = t0 + 2 * 3600e3; adm.noterResume('reveil', 'Troisième : une ligne du Canal.');
  root('historique.json', {v: 1, at: sec(), routines: {reveil: [{fin: iso(t0 + 65000), debut: iso(t0 + 5000), duree: 60, mode: 'réel', resultat: 'ok', cause: null, lance: 'reveil', ordre: null, erreur: null},
    {fin: iso(t0 + 3600e3 + 55000), debut: null, duree: null, mode: 'réel', resultat: 'ok', cause: null, lance: 'programme', ordre: null, erreur: null}]}}); resume();
  d = adm.detail('reveil').body;
  ok('historique fusionné : chaque passage de root reçoit le résumé de routine_fin reçu pendant ce passage ; un résumé plus récent que le dernier passage connu de root est montré en attente ; « Ce qu’elle a fait » = le dernier',
    d.historique.length === 3 && d.historique[0].attente === true && d.historique[0].resume === 'Troisième : une ligne du Canal.' && d.historique[0].resultat === null && d.historique[1].resume === 'Deuxième : rien à traiter.' && d.historique[1].lanceDit === 'programmé'
    && d.historique[2].resume === 'Premier : un courrier traité.' && d.historique[2].lanceDit === 'réveil par JARVIS (courrier, Canal)' && d.resume.texte === 'Troisième : une ligne du Canal.' && d.stats.passages === 2, JSON.stringify(d.historique));
  root('historique.json', JSON.stringify({v: 1, routines: {reveil: []}}) + ' '.repeat(600000)); const gros = adm.detail('reveil').body; fs.rmSync(path.join(HD, 'historique.json')); fs.symlinkSync(path.join(DIR, 'ailleurs.json'), path.join(HD, 'historique.json'));
  ok('historique de root trop gros, ou remplacé par un lien : ignoré (les résumés de JARVIS restent)', gros.historique.every((x) => x.attente) && gros.historique.length === 3 && adm.detail('reveil').body.historique.length === 3);

  /* ---------- JARVIS n'écrit que des ordres ---------- */
  const src = fs.readFileSync(new URL('../hermes-admin.mjs', import.meta.url), 'utf8');
  ok('le module n’exécute rien (ni child_process, ni spawn, ni exec) et n’écrit que dans le dossier des ordres (jamais dans celui de root)', !/child_process|spawn|execFile|execSync/.test(src) && (src.match(/writeFileSync|renameSync|mkdirSync/g) || []).length === 3 && !/writeFileSync\([^)]*dossierEtat/.test(src));
  fs.rmSync(HO, {recursive: true, force: true}); fs.symlinkSync(DIR, HO);
  ok('dossier des ordres remplacé par un lien : rien n’est posé (503)', neuf().adm.poser({nom: 'reveil', action: 'pause'}).status === 503 && !fs.readdirSync(DIR).some((x) => /^ordre-/.test(x)));
} catch (e) { ok('exception', false, (e && e.stack) || String(e)); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
