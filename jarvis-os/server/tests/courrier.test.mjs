/* Banc du courrier traité à son arrivée et du réveil d'Hermes (routines de Grok Bot reprises, 26/11/2026) :
   node jarvis-os/server/tests/courrier.test.mjs — données inventées */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {adressesDe, surveilles, createCourrier, createReveil} from '../courrier.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'courrier-'));
try {
  ok('adresses : mails et domaines d\'une case, sans doublon ni texte autour', JSON.stringify(adressesDe('noreply@exemple.fr ; agence-exemple.com (filtre prio) et alerts@keepa.com, keepa.com')) === JSON.stringify(['noreply@exemple.fr', 'alerts@keepa.com', 'agence-exemple.com', 'keepa.com']), JSON.stringify(adressesDe('noreply@exemple.fr ; agence-exemple.com (filtre prio) et alerts@keepa.com, keepa.com')));
  const EXP = [['Qui', 'Adresse ou domaine', 'Sujet', 'Bot', 'Alias', 'Urgence', 'Remarque'],
    ['Agence inventée', 'agence-exemple.fr', 'Logement', 'Iris', 'prio', 'Immédiat (à l\'arrivée)', ''],
    ['Alertes inventées', 'alertes@prix-exemple.com', 'Prix', 'Kairos', 'prix', 'Immédiat', ''],
    ['Factures inventées', 'factures@exemple.com', 'Facture', 'Chronos', 'ndf', 'Immédiat', ''],
    ['Lettre inventée', 'lettre@exemple.org', 'Lettre', 'Iris', '', 'Lot du matin', '']];
  const sv = surveilles(EXP);
  ok('surveillés : Iris et Kairos en « Immédiat » seulement (ni Chronos, ni le lot du matin)', sv.length === 2 && sv[0].bot === 'Iris' && sv[0].adresses[0] === 'agence-exemple.fr' && sv[1].bot === 'Kairos' && sv[1].qui === 'Alertes inventées', JSON.stringify(sv));
  let t = Date.parse('2026-11-26T09:00:00Z'); const S = {}; let sauve = 0, reveils = [], requetes = [], lus = 0, fils = [];
  const msg = (id, de, objet, at, labelIds = ['INBOX']) => ({id, threadId: 'f' + id, sender: de, subject: objet, internalDate: String(at), labelIds});
  const C = createCourrier({S, save: () => { sauve++; }, now: () => t, chercher: async (q) => { requetes.push(q); return {threads: fils}; }, lireExpediteurs: async () => { lus++; return EXP; }, reveiller: (r) => reveils.push(r)});
  fils = [{id: 'fA', messages: [msg('a1', 'contact@agence-exemple.fr', 'Ancien', t - 3600e3)]}];
  let r = await C.tic();
  ok('premier passage : rien d\'ancien n\'est repris, la requête cherche les expéditeurs surveillés des 2 derniers jours', r.nouveaux === 0 && C.aTraiter().length === 0 && /^newer_than:2d \{from:agence-exemple\.fr from:alertes@prix-exemple\.com\}$/.test(requetes[0]) && reveils.length === 0 && S.courrier.depuis === t, JSON.stringify([r, requetes]));
  t += 300e3;
  fils = [{id: 'fA', messages: [msg('a1', 'contact@agence-exemple.fr', 'Ancien', t - 3900e3), msg('a2', 'Agence <gestion@agence-exemple.fr>'.replace(/^.*</, '').replace('>', ''), 'Avis d\'échéance', t - 60e3)]},
    {id: 'fB', messages: [msg('b1', 'alertes@prix-exemple.com', 'Baisse de prix', t - 30e3)]},
    {id: 'fC', messages: [msg('c1', 'contact@agence-exemple.fr', 'Question', t - 50e3), msg('c2', 'proprietaire@example.org', 'Re: Question', t - 20e3, ['SENT'])]},
    {id: 'fD', messages: [msg('d1', 'pirate@autre-exemple.net', 'Faux', t - 10e3)]}];
  r = await C.tic(); const l = C.aTraiter();
  ok('nouveaux : le dernier message d\'un fil d\'un expéditeur surveillé (sous-domaine compris), avec le bot dont c\'était le travail ; ni sa propre réponse, ni un inconnu ; Hermes réveillé une fois', r.nouveaux === 2 && l.length === 2 && l[0].id === 'a2' && l[0].bot === 'Iris' && l[0].objet === 'Avis d\'échéance' && l[1].id === 'b1' && l[1].bot === 'Kairos' && reveils.join() === 'courrier' && lus === 1, JSON.stringify([r, l, reveils]));
  t += 300e3; r = await C.tic();
  ok('un mail déjà repéré ne revient pas ; Expéditeurs relu au plus toutes les 30 minutes', r.nouveaux === 0 && C.aTraiter().length === 2 && reveils.length === 1 && lus === 1, JSON.stringify([r, lus]));
  /* 0.94.0 : le fil lu message par message : un brouillon ou un tiers en dernier ne cache plus le mail de l'expéditeur surveillé */
  { t += 300e3; const n0 = C.aTraiter().length;
    fils = [{id: 'fE', messages: [msg('e1', 'contact@agence-exemple.fr', 'Relance', t - 200e3), msg('e2', 'proprietaire@example.org', 'Re: Relance', t - 60e3, ['DRAFT'])]},                 /* un brouillon de réponse, dernier du fil */
      {id: 'fF', messages: [msg('f1', 'contact@agence-exemple.fr', 'À tous', t - 190e3), msg('f2', 'voisin@autre-exemple.net', 'Re: À tous', t - 50e3)]},                                 /* un tiers en copie a répondu après */
      {id: 'fG', messages: [msg('g1', 'contact@agence-exemple.fr', 'Déjà répondu', t - 180e3), msg('g2', 'moi@example.org', 'Re: Déjà répondu', t - 40e3, [])]},                          /* sa réponse, reconnue à son adresse (sans étiquette) */
      {id: 'fH', messages: [msg('h1', 'contact@agence-exemple.fr', 'Suite', t - 170e3), msg('h2', 'proprietaire@example.org', 'Re: Suite', t - 100e3, ['SENT']), msg('h3', 'contact@agence-exemple.fr', 'Re: Suite', t - 30e3)]}];   /* il a répondu, l'expéditeur a réécrit */
    const C4 = createCourrier({S, save: () => {}, now: () => t, chercher: async () => ({threads: fils}), lireExpediteurs: async () => EXP, reveiller: (z) => reveils.push(z), moi: () => 'Moi@example.org'});
    const r4 = await C4.tic(), l4 = C4.aTraiter().slice(n0).map((z) => z.id); t += 300e3; const r5 = await C4.tic();
    ok('fil lu message par message : un brouillon ou un tiers en dernier ne cache plus le mail surveillé ; sa propre réponse après (étiquette SENT ou son adresse) veut dire « déjà répondu » ; l’expéditeur qui réécrit après sa réponse revient ; rien deux fois', r4.nouveaux === 3 && l4.join() === 'e1,f1,h3' && r5.nouveaux === 0, JSON.stringify([r4, l4, r5]));
    C4.traite('e1', 'vu'); C4.traite('f1', 'vu'); C4.traite('h3', 'vu'); t -= 600e3; }
  const x = C.traite('a2', 'Dossier mis à jour, échéance posée.'), y = C.traite('inconnu', 'x');
  ok('traité : il sort de la file, avec ce qui a été fait ; un identifiant inconnu ne change rien', x && x.etat === 'traite' && /Dossier mis à jour/.test(x.resume) && y === null && C.aTraiter().length === 1 && C.aTraiter()[0].id === 'b1', JSON.stringify([x, C.aTraiter()]));
  t += 31 * 60e3; await C.tic();
  ok('Expéditeurs relu après 30 minutes', lus === 2);
  const C2 = createCourrier({S: {}, save: () => {}, now: () => t, chercher: async () => { throw new Error('Gmail indisponible'); }, lireExpediteurs: async () => EXP}), r2 = await C2.tic();
  const C3 = createCourrier({S: {}, save: () => {}, now: () => t, chercher: async () => { throw new Error('jamais'); }, lireExpediteurs: async () => EXP, actif: () => false}), r3 = await C3.tic();
  ok('une erreur de Gmail est gardée (dite à Hermes), sans planter ; inactif (Google non relié, aucun exécutant) : rien n\'est cherché', r2.nouveaux === 0 && /Gmail indisponible/.test(C2.etat().erreur) && r3.nouveaux === 0 && !('erreur' in r3), JSON.stringify([r2, C2.etat().erreur, r3]));
  /* le réveil : un fichier touché, une fois par minute au plus, sans consigne */
  const F = path.join(DIR, 'sonnette'); let tr = 1000; const notes = [];
  const R = createReveil({fichier: F, fs, now: () => tr, log: (m) => notes.push(m)});
  const a = R('courrier'), b = R('canal'); tr += 61e3; const c = R('canal'), lu = JSON.parse(fs.readFileSync(F, 'utf8'));
  const R2 = createReveil({fichier: path.join(DIR, 'absent', 'sonnette'), fs, now: () => tr, log: (m) => notes.push(m)}), d = R2('courrier'), e = R2('courrier');
  ok('réveil : le fichier porte la raison et l\'heure seulement, une fois par minute au plus ; un dossier absent est dit une fois dans le journal, sans planter', a === true && b === false && c === true && lu.raison === 'canal' && lu.at === tr && Object.keys(lu).join() === 'raison,at' && d === false && e === false && notes.length === 1 && /réveil d’Hermes impossible/.test(notes[0]), JSON.stringify([a, b, c, lu, notes]));
} catch (err) { ok('exception', false, (err && err.stack) || String(err)); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
