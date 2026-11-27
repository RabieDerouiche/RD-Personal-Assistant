/* Banc des jours du mois (0.83.0) : node tests/jours.test.mjs. Aucun vrai Google, aucun vrai Claude ; agendas et jours inventés. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {lireTitre, bilan, resume, lireCorrections, appliquer, comprisDit, createJours, dernierJour, mailCraPhrases, mailCraRempli} from '../jours.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'jours-'));
/* les comptes rendus d'Hermes : jamais le vrai dossier du système (un banc d'Hermes lancé à côté y écrit) */
const SANS_RETOURS = path.join(DIR, 'sans-retours');
const jour = (d, titre, n = 1) => { const a = '2026-11-' + String(d).padStart(2, '0'); const b = new Date(Date.UTC(2026, 10, d + n)).toISOString().slice(0, 10); return {summary: titre, start: {date: a}, end: {date: b}, status: 'confirmed'}; };
const heure = (d, de, a, titre) => ({summary: titre, start: {dateTime: '2026-11-' + String(d).padStart(2, '0') + 'T' + de + ':00+01:00'}, end: {dateTime: '2026-11-' + String(d).padStart(2, '0') + 'T' + a + ':00+01:00'}, status: 'confirmed'});
const FER = [{summary: 'All Saints’ Day', description: 'Public holiday', start: {date: '2026-11-01'}, end: {date: '2026-11-02'}}, {summary: 'Armistice Day', description: 'Public holiday', start: {date: '2026-11-11'}, end: {date: '2026-11-12'}},
  {summary: 'Fête inventée', description: 'Observance\nTo hide observances…', start: {date: '2026-11-20'}, end: {date: '2026-11-21'}}];
/* un mois inventé (novembre 2026) : 2-3 sur site, 4-6 télétravail, 9 télétravail, 10 sur site, 11 férié, congé du jeudi 12 au vendredi 13 (un seul
   événement), 16 sur site, 17-18 télétravail, 19 sur site, 20 télétravail, 23 congé, 24 sur site, 25 télétravail, 26-27 rien (à confirmer), 30 télétravail ;
   un congé d'octobre qui finit la veille du 1er (fin exclue) */
const BASE = [jour(2, 'Hors Domicile'), jour(3, 'hors  domicile'), jour(4, 'Télétravail'), jour(5, 'télétravail '), jour(6, 'Télétravail'), jour(9, 'Télétravail'), jour(10, 'Hors Domicile'), jour(12, 'Congé', 2),
  jour(16, 'Hors Domicile'), jour(17, 'Télétravail'), jour(18, 'Télétravail'), jour(19, 'Hors Domicile'), jour(20, 'TELETRAVAIL'), jour(23, 'Congé'), jour(24, 'Hors Domicile'), jour(25, 'Télétravail'), jour(30, 'Télétravail'),
  {summary: 'Congé', start: {date: '2026-10-28'}, end: {date: '2026-11-01'}}];
try {
  /* ---------- les libellés ---------- */
  ok('libellés : les trois de la routine, casse, espaces et accents ignorés', lireTitre('Télétravail').type === 'T' && lireTitre(' hors  DOMICILE').type === 'S' && lireTitre('congés').type === 'C' && lireTitre('TELETRAVAIL').type === 'T');
  ok('libellés : demi-journée écrite (« Congé matin », « Télétravail après-midi »)', lireTitre('Congé matin').fraction === 'M' && lireTitre('Télétravail (après-midi)').fraction === 'A' && lireTitre('Congé demi-journée matin').fraction === 'M');
  ok('libellés : un rendez-vous quelconque n’est jamais une absence ; une demi-journée sans dire laquelle est ambiguë', lireTitre('Médecin') === null && lireTitre('Congé maternité de Léa') === null && lireTitre('Congé demi-journée') === null && lireTitre('Réunion sur site') === null);
  ok('dernier jour du mois (février 2028, novembre, décembre)', dernierJour(2028, 2) === 29 && dernierJour(2026, 11) === 30 && dernierJour(2026, 12) === 31);

  /* ---------- le bilan ---------- */
  const b = bilan({ym: '2026-11', presence: BASE, feriesAgenda: FER});
  const j = (d) => b.jours.find((x) => x.date === '2026-11-' + String(d).padStart(2, '0'));
  ok('bilan : 17 travaillés (9 télétravail, 6 sur site, 2 au lieu à venir : un jour sans congé est travaillé), 3 de congé, 1 férié, 21 jours ouvrés', b.totaux.travailles === 17 && b.totaux.aVenir === 2 && b.totaux.teletravail === 9 && b.totaux.surSite === 6 && b.totaux.conges === 3 && b.totaux.feries === 1 && b.totaux.ouvres === 21, JSON.stringify(b.totaux));
  ok('bilan : jeudi 26 et vendredi 27 sans indication : lieu jamais deviné ; oui possible (congés connus), pas complet (la note de télétravail attend)', b.aConfirmer.join() === '2026-11-26,2026-11-27' && !b.complet && b.validable && j(26).M === '?');
  ok('bilan : un congé sur deux jours (un seul événement, fin exclue) compte les deux ; celui d’octobre ne déborde pas', j(12).M === 'C' && j(13).A === 'C' && j(11).M === 'F' && j(2).M === 'S' && b.jours.length === 30);
  ok('bilan : la Toussaint un dimanche n’est pas un férié compté ; une « observance » n’est pas un férié', j(1).M === 'W' && !j(20).ferie && j(20).M === 'T');
  ok('résumé en une phrase, congés nommés', resume(b) === 'Novembre 2026 : 17 jours travaillés (9 en télétravail, 6 sur site, 2 lieu à venir), 3 de congé (jeudi 12, vendredi 13, lundi 23), 1 férié.', resume(b));
  const bn = bilan({ym: '2026-11', presence: BASE, feriesAgenda: FER, aujourdhui: '2026-11-27'});
  ok('un jour passé sans lieu ni congé est dit « lieu non noté » (le raccourci n’a pas tourné)', bn.nonNotes.join() === '2026-11-26' && /lieu non noté : jeudi 26/.test(resume(bn)), resume(bn));
  const b2 = bilan({ym: '2026-11', presence: [...BASE, jour(11, 'Télétravail'), jour(4, 'Hors Domicile'), jour(14, 'Télétravail'), jour(26, 'Médecin'), heure(27, '10:00', '11:00', 'Télétravail'), jour(16, 'Congé matin')], feriesAgenda: FER});
  const r = (d) => (b2.aResoudre.find((x) => x.date === '2026-11-' + String(d).padStart(2, '0')) || {}).raison || '';
  ok('à résoudre : présence un jour férié, deux indications opposées, présence un week-end', /férié/.test(r(11)) && /télétravail et sur site/.test(r(4)) && /week-end/.test(r(14)), JSON.stringify(b2.aResoudre));
  ok('à résoudre : un libellé ambigu ; une heure de passage n’est pas une journée', /ambigu « Médecin »/.test(r(26)) && /court/.test(r(27)), r(26) + ' | ' + r(27));
  const l16 = b2.jours.find((x) => x.date === '2026-11-16');
  ok('à résoudre : congé le matin et sur site toute la journée = présence sur un congé, le matin seulement', l16.M === 'X' && l16.A === 'S' && /congé/.test(r(16)));
  const b3 = bilan({ym: '2026-11', presence: [jour(11, 'Congé'), {summary: 'Télétravail', start: {dateTime: '2026-11-03T08:30:00+01:00'}, end: {dateTime: '2026-11-03T12:30:00+01:00'}}, {summary: 'Congé', start: {dateTime: '2026-11-03T13:30:00+01:00'}, end: {dateTime: '2026-11-03T18:00:00+01:00'}}], feriesAgenda: FER});
  const l3 = b3.jours.find((x) => x.date === '2026-11-03');
  ok('congé et férié le même jour : une journée, comptée fériée, et dit ; demi-journées horaires respectées', b3.jours.find((x) => x.date === '2026-11-11').M === 'F' && b3.remarques.some((x) => /congé et férié/.test(x)) && l3.M === 'T' && l3.A === 'C' && b3.totaux.teletravail === 0.5, JSON.stringify(l3));
  const b4 = bilan({ym: '2026-11', presence: [], feriesAgenda: []});
  ok('un férié de la loi absent de l’agenda des fériés : compté, et signalé', b4.jours.find((x) => x.date === '2026-11-11').ferie && b4.remarques.some((x) => /absent/.test(x)));

  /* ---------- les corrections ---------- */
  const c1 = lireCorrections('Jeudi 26 et vendredi 27 : télétravail', b);
  ok('correction : « jeudi 26 et vendredi 27 : télétravail »', c1.changements.length === 1 && c1.changements[0].dates.join() === '2026-11-26,2026-11-27' && c1.changements[0].code === 'T' && !c1.nonLu.length, JSON.stringify(c1));
  const c2 = lireCorrections('le reste du mois en télétravail', b);
  ok('correction : « le reste du mois en télétravail » = les jours à confirmer', c2.changements[0].dates.join() === '2026-11-26,2026-11-27' && c2.changements[0].code === 'T');
  const c3 = lireCorrections('du 26 au 27 sur site ; le 30 matin congé, après-midi télétravail', b);
  ok('correction : une période, puis une demi-journée et l’autre moitié dans la foulée', c3.changements.length === 3 && c3.changements[0].dates.length === 2 && c3.changements[0].code === 'S' && c3.changements[1].fractions.join() === 'M' && c3.changements[1].code === 'C' && c3.changements[2].fractions.join() === 'A' && c3.changements[2].dates.join() === '2026-11-30', JSON.stringify(c3));
  ok('correction : en clair, ce qui a été compris', comprisDit(c3.changements) === 'jeudi 26, vendredi 27 : sur site ; lundi 30 matin : congé ; lundi 30 après-midi : télétravail', comprisDit(c3.changements));
  const c4 = lireCorrections('le 26, le 27 : bureau. Le 3/12 télétravail', b);
  ok('correction : des dates puis le type ; une date d’un autre mois refusée, jamais reportée sur les dates d’avant', c4.changements.length === 1 && c4.changements[0].dates.join() === '2026-11-26,2026-11-27' && c4.changements[0].code === 'S' && c4.refus.length === 1, JSON.stringify(c4));
  const c5 = lireCorrections('je ne sais pas trop, à voir avec mon chef', b);
  ok('correction : une phrase sans date ni type n’est pas devinée', !c5.changements.length && c5.nonLu.length >= 1, JSON.stringify(c5));
  const c6 = lireCorrections('le 26 congé au lieu de télétravail', b);
  ok('correction : deux types dans un morceau : rien n’est deviné', !c6.changements.length && c6.nonLu.length === 1);
  const ap = appliquer({}, lireCorrections('les 26, 28 et 11 : télétravail', b).changements, b);
  ok('correction : un week-end et un férié sont refusés, le reste appliqué', ap.corrections['2026-11-26'].M.code === 'T' && !ap.corrections['2026-11-28'] && !ap.corrections['2026-11-11'] && ap.refus.length === 2, JSON.stringify(ap.refus));
  const bc = bilan({ym: '2026-11', presence: BASE, feriesAgenda: FER, corrections: appliquer({}, c1.changements, b).corrections});
  ok('bilan corrigé : complet, 17 travaillés dont 11 en télétravail, jours marqués « corrigé »', bc.complet && bc.totaux.travailles === 17 && bc.totaux.teletravail === 11 && bc.jours.find((x) => x.date === '2026-11-26').corrige);
  const bd = bilan({ym: '2026-11', presence: [...BASE, jour(26, 'Hors Domicile'), jour(27, 'Télétravail')], feriesAgenda: FER, corrections: appliquer({}, c1.changements, b).corrections});
  ok('agenda changé après sa correction : le jour qui dit autre chose est à résoudre ; celui qui dit pareil ne l’est pas', bd.aResoudre.length === 1 && bd.aResoudre[0].date === '2026-11-26' && /ta correction/.test(bd.aResoudre[0].raison) && bd.jours.find((x) => x.date === '2026-11-27').M === 'T', JSON.stringify(bd.aResoudre));

  /* ---------- le module : jours.json, routes, le 24 et le dernier jour ---------- */
  let T = Date.parse('2026-11-25T11:30:00Z');   /* mercredi 25, 12 h 30 à Paris */
  const pres = [...BASE]; const appels = {cal: 0, claude: 0, push: []};
  const CALS = [{id: 'fr.tn.official#holiday@group.v.calendar.google.com', summary: 'Jours fériés inventés'}, {id: 'p1@group.calendar.google.com', summary: 'Présence'}, {id: 'en-gb.french#holiday@group.v.calendar.google.com', summary: 'Holidays in France'}];
  let cals = CALS;
  const agenda = {lie: () => true, calendriers: async () => { appels.cal++; return cals; }, evenements: async (id) => (id === 'p1@group.calendar.google.com' ? pres : id.includes('french#holiday') ? FER : [{summary: 'Fête tunisienne inventée', description: 'Public holiday', start: {date: '2026-11-05'}, end: {date: '2026-11-06'}}])};
  const file = path.join(DIR, 'jours.json');
  const claude = async (prompt) => { appels.claude++; return {ok: true, text: '{"changements":[{"dates":["2026-11-26","2026-11-27"],"fraction":"journee","type":"teletravail"}],"incompris":""}'}; };
  const J = createJours({retours: SANS_RETOURS, file, agenda, claude, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  const q = (mois) => new URLSearchParams(mois ? {mois} : {});
  let rep = await J.traiter('GET', '/api/jours', async () => ({}), q());
  ok('module : GET lit les deux agendas et rend le bilan du mois en cours ; le férié tunisien est ignoré', rep.status === 200 && rep.body.mois === '2026-11' && rep.body.bilan.totaux.surSite === 6 && rep.body.agendas.feries === 'Holidays in France' && rep.body.etat === 'a_valider', JSON.stringify(rep.body.agendas));
  ok('module : jours.json en 600', (fs.statSync(file).mode & 0o777) === 0o600);
  ok('module : le bilan du 25 : lieu de jeudi 26 et vendredi 27 « à venir », oui possible (congés connus), pas encore complet', rep.body.bilan.validable && !rep.body.bilan.complet && rep.body.bilan.totaux.aVenir === 2 && rep.body.demande === false);
  const emp0 = rep.body.bilan.empreinte;
  rep = await J.traiter('POST', '/api/jours/confirmer', async () => ({mois: '2026-11', empreinte: emp0.replace('23CC', '23ww')}));
  ok('module : un oui sur des congés qui ont changé depuis l’affichage est refusé', rep.status === 409 && /congés ont changé/.test(rep.body.error));
  rep = await J.traiter('POST', '/api/jours/confirmer', async () => ({mois: '2026-11', empreinte: emp0}));
  ok('module : son oui sur ses congés, le lieu des derniers jours encore à venir : validé, congés gardés pour le CRA', rep.status === 200 && rep.body.etat === 'valide' && J.valides('2026-11').jours.length === 21 && J.valides('2026-11').conges.map((c) => c.date.slice(8)).join() === '12,13,23' && J.valides('2026-11').totaux.travailles === 17);
  rep = await J.traiter('POST', '/api/jours/corriger', async () => ({mois: '2026-11', texte: 'jeudi 26 et vendredi 27 : télétravail'}));
  ok('module : un lieu corrigé (règles, sans Claude) garde son oui ; le bilan devient complet', rep.status === 200 && rep.body.par === 'règles' && appels.claude === 0 && rep.body.etat === 'valide' && rep.body.bilan.complet && rep.body.compris === 'jeudi 26, vendredi 27 : télétravail', JSON.stringify({par: rep.body.par, c: rep.body.compris, e: rep.body.etat}));
  rep = await J.traiter('POST', '/api/jours/corriger', async () => ({mois: '2026-11', texte: 'lundi 30 : congé'}));
  ok('module : un congé ajouté par lui : son oui est à redonner (« à valider », pas « à revoir »)', rep.status === 200 && rep.body.etat === 'a_valider' && rep.body.demande === false, rep.body.etat);
  rep = await J.traiter('POST', '/api/jours/confirmer', async () => ({mois: '2026-11', empreinte: rep.body.bilan.empreinte}));
  ok('module : oui redonné : 4 jours de congé gardés', rep.status === 200 && J.valides('2026-11').conges.length === 4 && J.valides('2026-11').totaux.travailles === 16);
  rep = await J.traiter('POST', '/api/jours/corriger', async () => ({mois: '2026-11', texte: 'on verra plus tard avec lui'}));
  ok('module : une phrase que les règles ne lisent pas passe par Claude (une fois) ; un lieu seul ne retire pas son oui', rep.status === 200 && rep.body.par === 'Claude' && appels.claude === 1 && rep.body.etat === 'valide', JSON.stringify({s: rep.status, par: rep.body.par, e: rep.body.etat}));
  { const J9 = createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j9.json'), agenda: {...agenda, evenements: async (id) => (id.includes('french') ? FER : [...BASE, jour(11, 'Télétravail')])}, now: () => T});
    const r9 = await J9.traiter('GET', '/api/jours', async () => ({}), q('2026-11')), c9 = J9.confirmer('2026-11', r9.body.bilan.empreinte);
    ok('module : un conflit (présence notée un jour férié) bloque le oui', !r9.body.bilan.validable && !c9.ok && /à résoudre/.test(c9.error)); }
  { const J10 = createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j10.json'), agenda, now: () => T}), b0 = bilan({ym: '2026-11', presence: BASE, feriesAgenda: FER});
    J10.brut().mois['2026-11'] = {etat: 'valide', corrections: {}, historique: [], valide: {at: T, empreinte: 'ancienne forme', jours: b0.jours.filter((d) => d.ouvre).map((d) => ({date: d.date, M: d.M, A: d.A}))}};
    const x10 = await J10.lire('2026-11');
    ok('module : un oui donné avec la 0.83.0 (empreinte avec le lieu) reste valide après la mise à jour', x10.etat === 'valide', x10.etat); }
  /* le 24 est passé : le rattrapage envoie une notification le 25 ; une seule */
  const J2 = createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j2.json'), agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  await J2.tic(); await J2.tic();
  ok('le 24 manqué (serveur arrêté, ou mis à jour le 25) : une notification, une seule, qui ouvre le bilan', appels.push.length === 1 && /Tes jours de novembre/.test(appels.push[0].title) && appels.push[0].url === '/#voir-jours-2026-11' && /congés sert au CRA du 26/.test(appels.push[0].body), JSON.stringify(appels.push));
  T = Date.parse('2026-11-24T10:30:00Z');   /* le 24 à 11 h 30 : trop tôt */
  const J3 = createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j3.json'), agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  await J3.tic();
  ok('le 24 avant midi : rien', appels.push.length === 1);
  T = Date.parse('2026-11-24T11:01:00Z'); await J3.tic();
  ok('le 24 à midi : la notification part', appels.push.length === 2);
  /* le dernier jour : relu ; silencieux si rien n'a changé depuis son oui, notification si un jour a changé */
  T = Date.parse('2026-11-30T11:05:00Z');
  await J.tic();
  ok('le dernier jour, tout est connu et rien n’a changé depuis son oui : aucune notification (la note de télétravail part seule)', appels.push.length === 2 && J.etat('2026-11').etat === 'valide' && J.etat('2026-11').bilan.complet);
  const J4 = createJours({retours: SANS_RETOURS, file, agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  pres.push(jour(27, 'Hors Domicile'));
  J4.brut().mois['2026-11'].verifFin = ''; await J4.tic();
  ok('le dernier jour, son raccourci dit autre chose que sa correction : conflit, « à revoir », notification « ont changé depuis ton oui »', J4.etat('2026-11').etat === 'a_revoir' && /ont changé depuis ton oui/.test(appels.push[appels.push.length - 1].title), J4.etat('2026-11').etat);
  { const pres11 = [...BASE], ag11 = {...agenda, evenements: async (id) => (id.includes('french') ? FER : id.includes('tn.') ? [] : pres11)}, n0 = appels.push.length;
    T = Date.parse('2026-11-25T11:30:00Z');
    const J11 = createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j11.json'), agenda: ag11, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
    await J11.tic(); await J11.confirmer('2026-11', J11.etat('2026-11').bilan.empreinte);
    T = Date.parse('2026-11-30T11:05:00Z'); await J11.tic();
    const manque = appels.push[appels.push.length - 1];
    ok('le dernier jour, validé mais deux jours sans lieu ni congé : notification « un lieu manque », qui les nomme', appels.push.length === n0 + 2 && /un lieu manque/.test(manque.title) && /jeudi 26, vendredi 27/.test(manque.body) && J11.etat('2026-11').etat === 'valide', JSON.stringify(manque));
    pres11.push(jour(26, 'Télétravail'), jour(27, 'Hors Domicile')); J11.brut().mois['2026-11'].verifFin = ''; await J11.tic();
    ok('le dernier jour, les lieux notés ensuite par son raccourci : son oui tient, aucune notification de plus', appels.push.length === n0 + 2 && J11.etat('2026-11').etat === 'valide' && J11.etat('2026-11').bilan.complet); }
  /* ---------- 0.84.0 : le CRA de la semaine ---------- */
  { const SD = path.join(DIR, 'sem'); fs.mkdirSync(SD, {recursive: true}); const pushS = [];
    let presS = [...BASE];
    const agS = {...agenda, evenements: async (id, debut, fin) => (id.includes('french') ? FER : id.includes('tn.') ? [] : presS)};
    T = Date.parse('2026-11-26T11:05:00Z');   /* jeudi 26, midi : trop tôt pour le oui */
    const RT = path.join(SD, 'retours-root'), JS = createJours({file: path.join(SD, 'jours.json'), retours: RT, agenda: agS, claude, push: async (m) => { pushS.push(m); return []; }, now: () => T});
    let s = await JS.lireSemaine('2026-11-23');
    ok('semaine : lundi 23 congé (rien), mardi 24 sur site, mercredi 25 télétravail, jeudi 26 et vendredi 27 lieu pas noté : 1 (seule compte l’absence de congé)', s.jours.map((d) => d.q).join() === '0,1,1,1,1' && s.jours[3].lieu === '?' && !s.jours.some((d) => d.bloque), JSON.stringify(s.jours.map((d) => [d.date.slice(8), d.q, d.lieu])));
    let c = JS.confirmerSemaine('2026-11-23', s.empreinte);
    ok('semaine : pas de oui avant le vendredi', !c.ok && /vendredi/.test(c.error));
    T = Date.parse('2026-11-27T11:05:00Z');   /* vendredi 27, 12 h 05 */
    await JS.tic(); await JS.tic();
    const pc = pushS.filter((m) => /^cra-/.test(m.tag));
    ok('semaine : le vendredi à midi, une notification (une seule), qui ouvre la semaine', pc.length === 1 && /CRA de la semaine du lundi 23 au vendredi 27 novembre/.test(pc[0].title) && /4 jours travaillés ; rien : lundi 23 \(congé\)/.test(pc[0].body) && pc[0].url === '/#voir-cra-2026-11-23', JSON.stringify(pushS));
    const g = await JS.traiter('GET', '/api/jours', async () => ({}), q('2026-11'));
    ok('semaine : GET /api/jours la donne, « à confirmer » dans Pour moi', g.body.semaine && g.body.semaine.lundi === '2026-11-23' && g.body.semaine.demande && g.body.semaine.confirmable);
    c = JS.confirmerSemaine('2026-11-23', 'autre');
    ok('semaine : un oui sur une semaine qui a changé depuis l’affichage est refusé', !c.ok && /changé/.test(c.error));
    let r = await JS.traiter('POST', '/api/jours/semaine/corriger', async () => ({lundi: '2026-11-23', texte: 'jeudi 26 : congé'}));
    ok('semaine : « jeudi 26 : congé » : rien ce jour-là ; corrigé dans le mois aussi', r.status === 200 && r.body.jours.map((d) => d.q).join() === '0,1,1,0,1' && JS.brut().mois['2026-11'].corrections['2026-11-26'].M.code === 'C', JSON.stringify(r.body.jours && r.body.jours.map((d) => d.q)));
    r = await JS.traiter('POST', '/api/jours/semaine/confirmer', async () => ({lundi: '2026-11-23', empreinte: r.body.empreinte}));
    ok('semaine : oui donné : « valide », les quantités gardées pour root (jours.json)', r.status === 200 && r.body.etat === 'valide' && JSON.parse(fs.readFileSync(path.join(SD, 'jours.json'), 'utf8')).semaines['2026-11-23'].valide.jours.map((d) => d.q).join() === '0,1,1,0,1');
    /* le compte rendu d'Hermes, posé par root */
    fs.mkdirSync(RT, {recursive: true});
    fs.writeFileSync(path.join(RT, 'cra-2026-11-23.json'), JSON.stringify({semaine: '2026-11-23', resultat: 'soumise', texte: 'Trois jours saisis, semaine soumise.', premiere: true, at: T}));
    fs.mkdirSync(path.join(SD, 'portail-retours'), {recursive: true});   /* l'ancien dossier, dans les données de JARVIS : plus jamais lu */
    fs.writeFileSync(path.join(SD, 'portail-retours', 'cra-2026-11-09.json'), JSON.stringify({semaine: '2026-11-09', resultat: 'soumise', texte: 'x', premiere: true, at: T}));
    await JS.tic();
    const pr = pushS[pushS.length - 1], nPush = pushS.length;
    ok('semaine : le compte rendu d’Hermes (dossier de root) : « soumise », notification « première exécution : vérifie » ; l’ancien dossier des données de JARVIS ignoré', JS.etatSemaine('2026-11-23').etat === 'soumise' && /Première exécution d’Hermes/.test(pr.title) && /Vérifie sur le portail/.test(pr.body) && !JS.brut().semaines['2026-11-09'], JSON.stringify(pr));
    await JS.tic();
    ok('semaine : un compte rendu déjà lu (JARVIS ne peut pas l’effacer) ne se notifie pas deux fois', pushS.length === nPush && JS.brut().retoursLus['cra-2026-11-23.json'] === String(T), String(pushS.length - nPush));
    r = await JS.traiter('POST', '/api/jours/semaine/corriger', async () => ({lundi: '2026-11-23', texte: 'mardi 24 : congé'}));
    ok('semaine : une semaine soumise ne se corrige plus dans JARVIS', r.status === 400 && /déjà soumise/.test(r.body.error));
    fs.writeFileSync(path.join(RT, 'cra-2026-11-16.json'), JSON.stringify({semaine: '2026-11-16', at: T + 1, resultat: 'rien', texte: 'Une saisie existante diffère : rien changé.', premiere: false}));
    await JS.tic();
    ok('semaine : « rien saisi » : « à la main », notification « pas soumis »', JS.etatSemaine('2026-11-16').etat === 'a_la_main' && /pas soumis/.test(pushS[pushS.length - 1].title) && /À faire à la main/.test(pushS[pushS.length - 1].body));
    { await JS.lireSemaine('2026-11-16'); const e16 = JS.etatSemaine('2026-11-16'), v1 = JS.confirmerSemaine('2026-11-16', e16.empreinte), at1 = JS.brut().semaines['2026-11-16'].valide.at;
      ok('semaine : « à la main », un nouveau oui relance Hermes (nouvelle tentative : un autre instant de oui)', v1.ok && JS.etatSemaine('2026-11-16').etat === 'valide' && at1 > 0, JSON.stringify(v1)); }
    /* une demi-journée de congé bloque ; une semaine à cheval sur deux mois */
    presS = [...BASE, jour(26, 'Congé matin')];
    s = await (createJours({retours: SANS_RETOURS, file: path.join(SD, 'demi.json'), agenda: agS, now: () => T})).lireSemaine('2026-11-23');
    ok('semaine : une demi-journée de congé bloque la saisie automatique (la quantité n’est pas définie)', s.jours[3].q === null && /demi-journée/.test(s.jours[3].bloque), JSON.stringify(s.jours[3]));
    T = Date.parse('2026-12-04T11:05:00Z'); presS = [...BASE, {summary: 'Télétravail', start: {date: '2026-12-01'}, end: {date: '2026-12-05'}, status: 'confirmed'}];
    r = await JS.traiter('POST', '/api/jours/semaine/corriger', async () => ({lundi: '2026-11-30', texte: 'mardi 1er : congé'}));
    ok('semaine à cheval sur deux mois : « mardi 1er » est le 1er décembre ; la correction va dans le mois de décembre', r.status === 200 && r.body.jours.map((d) => d.q).join() === '1,0,1,1,1' && JS.brut().mois['2026-12'].corrections['2026-12-01'].M.code === 'C', JSON.stringify(r.body.error || r.body.jours.map((d) => d.q)));
    T = Date.parse('2026-11-30T11:05:00Z');
  }
  /* les agendas reconnus à leur identité réelle */
  cals = CALS.filter((c) => !c.id.includes('french'));
  const e1 = await (createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j5.json'), agenda, now: () => T})).lire('2026-11');
  cals = [...CALS, {id: 'p2@group.calendar.google.com', summary: 'présence'}];
  const e2 = await (createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j6.json'), agenda, now: () => T})).lire('2026-11');
  ok('agendas : sans l’agenda des fériés de France, ou avec deux « Présence » : une erreur dite, pas de bilan deviné', /fériés de France est introuvable/.test(e1.erreur) && !e1.bilan && /Deux agendas/.test(e2.erreur), e1.erreur + ' | ' + e2.erreur);
  cals = CALS;
  const J7 = createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j7.json'), agenda: {...agenda, lie: () => false}, now: () => T});
  rep = await J7.traiter('GET', '/api/jours', async () => ({}), q('2026-13'));
  ok('Google pas relié : GET répond sans bilan ; un mois mal écrit retombe sur le mois en cours', rep.status === 200 && rep.body.mois === '2026-11' && !rep.body.bilan);
  fs.writeFileSync(path.join(DIR, 'j8.json'), '{abîmé'); const J8 = createJours({retours: SANS_RETOURS, file: path.join(DIR, 'j8.json'), agenda, now: () => T});
  ok('jours.json abîmé : mis de côté, pas écrasé', fs.readdirSync(DIR).some((f) => /^j8-illisible-/.test(f)) && J8.etat('2026-11').etat === 'a_valider');
} catch (e) { ok('exception', false, (e && e.stack) || String(e)); }
fs.rmSync(DIR, {recursive: true, force: true});
/* ---------- 0.85.0 : les mails du mois préparés par JARVIS (jamais par Iris), en brouillon, avec son oui ---------- */
{ const RT2 = path.join(DIR, 'retours-mails'); fs.mkdirSync(RT2, {recursive: true});
  let Tm = Date.parse('2026-11-24T11:30:00Z');   /* mardi 24, 12 h 30 à Paris */
  const CALS2 = [{id: 'p1@group.calendar.google.com', summary: 'Présence'}, {id: 'en-gb.french#holiday@group.v.calendar.google.com', summary: 'Holidays in France'}];
  let pres2 = [...BASE];
  const ag2 = {lie: () => true, calendriers: async () => CALS2, evenements: async (id) => (id === 'p1@group.calendar.google.com' ? pres2 : FER)};
  const M2 = {crees: [], majs: [], push: [], deja: new Set(), modeles: {cra_client: {a: ['contact@exemple.invalid'], objet: 'CRA {MOIS} {ANNEE}', corps: 'Bonjour,\n\nJ’ai {JOURS} jours sur ce mois.\n{CONGES}\nMerci !'}, prolongation: {a: ['chargee@exemple.invalid'], objet: 'Prolongation de mission', corps: 'Ma mission se termine le {FIN} : peux-tu la prolonger ?'}}};
  const mails = {modeles: () => M2.modeles, brouillon: async (m) => { M2.crees.push(m); return {id: 'r' + M2.crees.length}; }, majBrouillon: async (m) => { if (m.draftId === 'parti') throw new Error('introuvable'); M2.majs.push(m); return {}; }, envoye: async (objet) => M2.deja.has(objet)};
  const JM = createJours({file: path.join(DIR, 'jm.json'), agenda: ag2, retours: RT2, mails, push: async (m) => { M2.push.push(m); return []; }, now: () => Tm});
  await JM.lire('2026-11'); await JM.tic();
  ok('mails du mois : rien avant son oui sur ses congés', M2.crees.length === 0);
  let e2 = JM.etat('2026-11'); JM.confirmer('2026-11', e2.bilan.empreinte); await JM.tic();
  const c0 = M2.crees[0] || {};
  ok('mail du CRA : après son oui, à partir du 24 : un brouillon (destinataire, objet, congés passés et à venir), notification qui ouvre le brouillon', M2.crees.length === 1 && c0.to.join() === 'contact@exemple.invalid' && c0.subject === 'CRA Novembre 2026' && /J’étais en congés du 12 au 13 et le 23 Novembre\./.test(c0.body) && M2.push.some((x) => x.url === '/#voir-brouillon-r1' && /Mail du CRA prêt/.test(x.title)), JSON.stringify([c0, M2.push.slice(-1)]));
  await JM.tic();
  ok('mail du CRA : un seul brouillon pour un même oui', M2.crees.length === 1 && M2.majs.length === 0);
  pres2 = [...BASE, jour(27, 'Congé')]; await JM.lire('2026-11'); e2 = JM.etat('2026-11'); const rc = JM.confirmer('2026-11', e2.bilan.empreinte); await JM.tic();
  ok('mail du CRA : ses congés changent puis nouveau oui : le même brouillon mis à jour (« Je serai en congé le 27 »)', rc.ok && M2.crees.length === 1 && M2.majs.length === 1 && M2.majs[0].draftId === 'r1' && /Je serai en congé le 27 Novembre\./.test(M2.majs[0].body), JSON.stringify([rc, M2.majs[0]]));
  JM.brut().mois['2026-11'].mailCra.draftId = 'parti'; pres2 = [...BASE]; await JM.lire('2026-11'); e2 = JM.etat('2026-11'); JM.confirmer('2026-11', e2.bilan.empreinte); const np = M2.push.length; await JM.tic();
  ok('mail du CRA : brouillon déjà parti et congés changés : rien de refait, il est prévenu', M2.crees.length === 1 && M2.push.length === np + 1 && /ont changé après le mail du CRA/.test(M2.push[M2.push.length - 1].title), JSON.stringify(M2.push.slice(-1)));
  /* la prolongation, d'après le compte rendu du CRA du mois (Hermes, le 26) */
  Tm = Date.parse('2026-11-26T11:30:00Z'); fs.writeFileSync(path.join(RT2, 'mois-2026-11.json'), JSON.stringify({resultat: 'validee', fin: '2026-11-30', at: Tm}));
  await JM.tic(); const pr = M2.crees[1] || {};
  ok('prolongation : fin de mission dans le mois : un brouillon à sa chargée de mission (date remplie), notification', pr.subject === 'Prolongation de mission' && /se termine le 30\/11\/2026/.test(pr.body) && pr.to.join() === 'chargee@exemple.invalid' && M2.push.some((x) => /Fin de mission le 30\/11\/2026 : mail de prolongation prêt/.test(x.title)), JSON.stringify(pr));
  await JM.tic(); ok('prolongation : un seul brouillon', M2.crees.length === 2);
  /* un autre mois : fin le mois suivant = simple alerte ; mail déjà envoyé depuis Gmail = rien */
  const JN = createJours({file: path.join(DIR, 'jn.json'), agenda: ag2, retours: RT2, mails, push: async (m) => { M2.push.push(m); return []; }, now: () => Tm});
  fs.writeFileSync(path.join(RT2, 'mois-2026-11.json'), JSON.stringify({resultat: 'validee', fin: '2026-12-31', at: Tm})); M2.deja.add('CRA Novembre 2026');
  await JN.lire('2026-11'); const e3 = JN.etat('2026-11'); JN.confirmer('2026-11', e3.bilan.empreinte); const n0 = M2.crees.length; await JN.tic();
  ok('mails du mois : un mail du même objet déjà envoyé (Gmail) n’est jamais refait ; fin le mois suivant : une alerte, pas de mail', M2.crees.length === n0 && JN.brut().mois['2026-11'].mailCra.envoye && M2.push.some((x) => x.title === 'Fin de mission le 31/12/2026'), JSON.stringify(M2.push.slice(-2)));
  /* la note de télétravail à blanc (Hermes, le dernier jour) : compte rendu sans montant, notifié une fois */
  fs.writeFileSync(path.join(RT2, 'teletravail-2026-11.json'), JSON.stringify({mois: '2026-11', resultat: 'blanc', jours: 10.5, texte: 'Note préparée, dépense remplie puis annulée sur le portail.', a_blanc: true, at: Tm}));
  const np2 = M2.push.length; await JM.tic(); await JM.tic();
  const ptt = M2.push.slice(np2);
  ok('télétravail : le compte rendu d’Hermes gardé (résultat, jours) et notifié une seule fois, sans montant', ptt.length === 1 && /Note de télétravail de novembre : prête à blanc/.test(ptt[0].title) && /10,5 jours/.test(ptt[0].body) && !/€/.test(ptt[0].body) && JM.brut().teletravail['2026-11'].resultat === 'blanc', JSON.stringify(ptt));
  fs.writeFileSync(path.join(RT2, 'teletravail-2026-11.json'), JSON.stringify({mois: '2026-11', resultat: 'arret', jours: null, texte: 'Arrêt : un jour ouvré n’a ni lieu ni congé noté.', at: Tm + 1000}));
  await JM.tic();
  ok('télétravail : un arrêt est notifié avec sa raison (Chronos le fera le 1er)', /arrêtée/.test(M2.push[M2.push.length - 1].title) && /ni lieu ni congé/.test(M2.push[M2.push.length - 1].body), JSON.stringify(M2.push.slice(-1)));
  /* 0.86.0 : les notes de frais d'Hermes en réel : la première de chaque sorte validée par lui (montants inventés) */
  { const NR = path.join(RT2, 'ndf-box-2026-11.json'), base = {sorte: 'box', mois: '2026-11', montant: 39, date: '2026-11-05', champs: [['Date', '05/11/2026'], ['Vendeur', 'Fournisseur inventé'], ['Montant TTC', '39,00']], justificatif: 'facture.pdf', taille: 1000, empreinte: 'abcdef0123456789abcdef0123456789'};
    fs.writeFileSync(NR, JSON.stringify({...base, etat: 'a_valider', texte: 'Préparée et vérifiée à blanc.', at: Tm + 2000}));
    const n0 = M2.push.length; await JM.tic(); await JM.tic();
    const pn = M2.push.slice(n0), v = JM.notesVues()[0] || {};
    ok('note à valider : gardée (champs, montant, empreinte), notifiée une fois, sans montant dans la notification, lien vers la note', pn.length === 1 && /Note de la box de novembre : à valider/.test(pn[0].title) && pn[0].url === '/#voir-note-box-2026-11' && !/39/.test(pn[0].body) && v.cle === 'box:2026-11' && v.montant === 39 && v.champs.length === 3 && !v.valide, JSON.stringify([pn, v]));
    let r = await JM.traiter('POST', '/api/jours/note/valider', async () => ({sorte: 'box', mois: '2026-11', empreinte: 'autre'}));
    ok('note : un oui sur une note qui a changé est refusé', r.status === 409 && /changé/.test(r.body.error));
    r = await JM.traiter('POST', '/api/jours/note/valider', async () => ({sorte: 'box', mois: '2026-11', empreinte: base.empreinte}));
    const jj = JSON.parse(fs.readFileSync(path.join(DIR, 'jm.json'), 'utf8'));
    ok('note : son oui gardé dans jours.json sur l’empreinte (lu par root), la note « validée »', r.status === 200 && r.body.note.valide && jj.notes['box:2026-11'].oui.empreinte === base.empreinte, JSON.stringify(r.body));
    const g = await JM.traiter('GET', '/api/jours/notes', async () => ({}));
    ok('notes : GET /api/jours/notes les rend (la plus récente d’abord)', g.status === 200 && g.body.notes[0].cle === 'box:2026-11' && g.body.notes[0].valide);
    fs.writeFileSync(NR, JSON.stringify({...base, etat: 'creee', premiere: true, texte: 'Créée sur le portail.', at: Tm + 3000}));
    await JM.tic();
    const pc = M2.push[M2.push.length - 1];
    ok('note créée par root : « Première exécution d’Hermes … créée », vérifie dans le portail', /Première exécution d’Hermes : Note de la box de novembre créée/.test(pc.title) && /Vérifie/.test(pc.body) && JM.notesVues()[0].etat === 'creee', JSON.stringify(pc));
    r = await JM.traiter('POST', '/api/jours/note/valider', async () => ({sorte: 'box', mois: '2026-11', empreinte: base.empreinte}));
    ok('note : une note créée ne se valide plus', r.status === 409 && /déjà créée/.test(r.body.error));
    fs.writeFileSync(path.join(RT2, 'ndf-autre-2026-11.json'), JSON.stringify({...base, sorte: 'autre', etat: 'a_valider', at: Tm + 4000}));
    fs.writeFileSync(path.join(RT2, 'ndf-claude-2026-11.json'), JSON.stringify({...base, sorte: 'claude', etat: 'echec', texte: 'Pas créée : alerte du portail.', at: Tm + 5000}));
    const n1 = M2.push.length; await JM.tic();
    ok('notes : une sorte inconnue ignorée ; un échec notifié « pas créée », à faire à la main', M2.push.length === n1 + 1 && /abonnement Claude de novembre : pas créée/.test(M2.push[M2.push.length - 1].title) && !JM.brut().notes['autre:2026-11'], JSON.stringify(M2.push.slice(-1)));
    fs.rmSync(path.join(RT2, 'ndf-autre-2026-11.json')); }
  const JO = createJours({file: path.join(DIR, 'jo.json'), agenda: ag2, retours: RT2, mails: {...mails, modeles: () => ({})}, push: async () => [], now: () => Tm});
  await JO.lire('2026-11'); JO.confirmer('2026-11', JO.etat('2026-11').bilan.empreinte); const n1 = M2.crees.length; await JO.tic();
  ok('mails du mois : sans modèle sur le serveur, rien n’est préparé', M2.crees.length === n1); }
/* ---------- 0.85.0 : le mail du CRA du client, au bon temps (sa remarque du 26/11/2026) — jours inventés ---------- */
{ const mois = (ym, codes) => { const [y, m] = ym.split('-').map(Number), out = []; for (let d = 1; d <= dernierJour(y, m); d++) { const s = ym + '-' + String(d).padStart(2, '0'), w = new Date(s + 'T12:00Z').getUTCDay(), c = codes[s]; out.push({date: s, M: w === 0 || w === 6 ? 'W' : c ? c[0] : 'T', A: w === 0 || w === 6 ? 'W' : c ? c[1] : 'T'}); } return out; };
  /* octobre 2026 inventé : congés lun 5 - mar 6, ven 16 et lun 19 (week-end entre), jeu 22 matin, jeu 29 - ven 30 ; un férié inventé le mer 14 entre deux congés */
  const J = mois('2026-10', {'2026-10-05': 'CC', '2026-10-06': 'CC', '2026-10-13': 'CC', '2026-10-14': 'FF', '2026-10-15': 'CC', '2026-10-16': 'CC', '2026-10-19': 'CC', '2026-10-22': 'CT', '2026-10-29': 'CC', '2026-10-30': 'CC'});
  const a = mailCraPhrases(J, '2026-10-24');
  ok('mail du CRA : jours travaillés sans arrondir (demi-journée), congés passés au passé, à venir au futur', a.joursDit === '12,5' && a.phrases[0] === 'J’étais en congés du 5 au 6, le 13, du 15 au 19 et le 22 (matin) Octobre.' && a.phrases[1] === 'Je serai en congés du 29 au 30 Octobre.', JSON.stringify(a));
  ok('mail du CRA : un week-end ne coupe pas une période (du 15 au 19), un férié la coupe (le 13, puis du 15…)', /le 13, du 15 au 19/.test(a.phrases[0]));
  const b = mailCraPhrases(J, '2026-10-29');
  ok('mail du CRA : envoyé le premier jour d’un congé : « Je suis en congés… »', b.phrases[1] === 'Je suis en congés du 29 au 30 Octobre.', JSON.stringify(b.phrases));
  const c = mailCraPhrases(J, '2026-11-02');
  ok('mail du CRA : envoyé après le mois : tout au passé, une seule phrase', c.phrases.length === 1 && /^J’étais en congés .* et du 29 au 30 Octobre\.$/.test(c.phrases[0]), JSON.stringify(c.phrases));
  const d = mailCraPhrases(mois('2026-10', {'2026-10-30': 'CC'}), '2026-10-24');
  ok('mail du CRA : un seul jour à venir : « Je serai en congé le 30 » (singulier)', d.phrases.length === 1 && d.phrases[0] === 'Je serai en congé le 30 Octobre.', JSON.stringify(d.phrases));
  const e = mailCraPhrases(mois('2026-10', {}), '2026-10-24');
  ok('mail du CRA : sans congé, aucune phrase de congé', e.phrases.length === 0 && e.texte === 'J’ai 22 jours sur ce mois.', JSON.stringify(e));
  const r = mailCraRempli({a: ['contact@exemple.invalid'], objet: 'CRA {MOIS} {ANNEE}', corps: 'Bonjour,\n\nJ’ai {JOURS} jours sur ce mois.\n{CONGES}\nMerci !'}, '2026-10', J, '2026-10-24');
  ok('mail du CRA : le modèle rempli (objet, nombre, phrases à leur place ; sans congé, la ligne disparaît)', r.objet === 'CRA Octobre 2026' && r.corps === 'Bonjour,\n\nJ’ai 12,5 jours sur ce mois.\n' + a.phrases.join('\n') + '\nMerci !' && mailCraRempli({corps: 'A\n{CONGES}\nB'}, '2026-10', mois('2026-10', {}), '2026-10-24').corps === 'A\nB', JSON.stringify(r)); }
/* ---------- 0.94.0 : les réponses aux mails du mois, suivies (détection active, une seule notification, redémarrage) — faux Gmail, tout inventé ---------- */
{ const RT3 = path.join(DIR, 'retours-suivi'); fs.mkdirSync(RT3, {recursive: true});
  let Ts = Date.parse('2026-11-26T14:00:00Z');   /* jeudi 26, 15 h à Paris */
  const MIN = 60e3, CALS3 = [{id: 'p1@group.calendar.google.com', summary: 'Présence'}, {id: 'en-gb.french#holiday@group.v.calendar.google.com', summary: 'Holidays in France'}];
  const ag3 = {lie: () => true, calendriers: async () => CALS3, evenements: async (id) => (id === 'p1@group.calendar.google.com' ? BASE : FER)};
  const MOI = 'moi@exemple.invalid', PDF = {filename: 'CRA signé.pdf', mimeType: 'application/pdf', size: 48213, attachmentId: 'piece-v1'}, IMG = {filename: 'image.png', mimeType: 'image/png', size: 900, attachmentId: 'image-v1'};
  const msg = (id, de, nom, objet, at, labelIds, attachments = [], snippet = '') => ({id, sender: de, addressDisplayNames: [{displayName: nom, emailAddress: de}], subject: objet, internalDate: String(at), labelIds, snippet, attachments});
  /* le faux Gmail : des fils entiers, une version par fil (historyId), les recherches et les lectures comptées */
  const G = {fils: {}, v: {}, recherches: [], lus: [], erreur: null, erreurEnvoye: null, deja: new Set()};
  const poser = (id, messages) => { G.fils[id] = {id, messages}; G.v[id] = (G.v[id] || 0) + 1; };
  const chercher = async (q) => { G.recherches.push(q); if (G.erreur) throw G.erreur;
    const s = q.match(/^subject:"([^"]+)"/), f = q.match(/^from:\(([^)]+)\) filename:pdf/);
    const ids = Object.values(G.fils).filter((x) => (s ? x.messages.some((m) => m.subject.toLowerCase().includes(s[1].toLowerCase())) : f ? x.messages.some((m) => f[1].split(' OR ').includes(m.sender) && m.attachments.some((p) => /pdf/.test(p.mimeType))) : false)).map((x) => x.id);
    return ids.length ? {threads: ids.map((id) => ({id, historyId: String(G.v[id])}))} : {}; };
  const MOD = {cra_client: {a: ['contact@exemple.invalid'], objet: 'CRA {MOIS} {ANNEE}', corps: 'Bonjour,\n\nJ’ai {JOURS} jours sur ce mois.\n{CONGES}\nMerci !'}, prolongation: {a: ['chargee@exemple.invalid'], objet: 'Prolongation de mission', corps: 'Ma mission se termine le {FIN}.'}};
  const X = {push: [], journal: [], log: [], crees: []};
  const mailsS = {modeles: () => MOD, brouillon: async (m) => { X.crees.push(m); return {id: 'b' + X.crees.length}; }, majBrouillon: async () => ({}),
    envoye: async (objet) => { if (G.erreurEnvoye) throw G.erreurEnvoye; return G.deja.has(objet); }, chercher, fil: async (id) => { G.lus.push(id); return JSON.parse(JSON.stringify(G.fils[id])); }, moi: () => MOI};
  const creer = (nom) => createJours({file: path.join(DIR, nom), agenda: ag3, retours: RT3, mails: mailsS, push: async (m) => { X.push.push(m); return []; }, ecrireJournal: async (l) => { X.journal.push(l); }, log: (t) => X.log.push(t), now: () => Ts});
  const reps = () => X.push.filter((p) => /^(CRA signé reçu|Réponse à ton mail)/.test(p.title));
  const lu = (nom) => JSON.parse(fs.readFileSync(path.join(DIR, nom), 'utf8')).mois['2026-11'];
  const JS = creer('js.json');
  await JS.lire('2026-11'); JS.confirmer('2026-11', JS.etat('2026-11').bilan.empreinte);
  fs.writeFileSync(path.join(RT3, 'mois-2026-11.json'), JSON.stringify({resultat: 'validee', fin: '2026-11-30', at: Ts}));
  await JS.tic();
  ok('suivi : les deux brouillons préparés gardent leur objet ; tant que rien n’est parti, une recherche par mail, ni envoi ni réponse', X.crees.length === 2 && lu('js.json').mailCra.objet === 'CRA Novembre 2026' && lu('js.json').mailProlong.objet === 'Prolongation de mission' && G.recherches.length === 2 && G.recherches[0] === 'subject:"CRA Novembre 2026" newer_than:50d' && !lu('js.json').suivi.cra.envoi && !reps().length, JSON.stringify(G.recherches));
  /* il envoie les deux mails */
  const tCra = Date.parse('2026-11-26T14:02:00Z'), tPro = Date.parse('2026-11-26T14:03:00Z');
  poser('fil-cra-0001', [msg('m1', MOI, 'Moi', 'CRA Novembre 2026', tCra, ['SENT'])]); poser('fil-pro-0001', [msg('p1', MOI, 'Moi', 'Prolongation de mission', tPro, ['SENT'])]);
  let r0 = G.recherches.length; await JS.tic();
  ok('suivi : pas plus d’un passage toutes les 5 minutes (le tic tourne chaque minute)', G.recherches.length === r0);
  Ts += 5 * MIN; r0 = G.recherches.length; await JS.tic();
  { const m = lu('js.json');
    ok('suivi : les mails partis sont vus, avec la vraie date de l’envoi ; les brouillons sont marqués envoyés ; aucune notification sans réponse', m.suivi.cra.envoi.at === tCra && m.suivi.cra.envoi.fil === 'fil-cra-0001' && m.suivi.prolongation.envoi.at === tPro && m.mailCra.envoye === true && m.mailProlong.envoye === true && !reps().length && m.historique.some((h) => /mail du CRA : envoyé le 26\/11 à 15:02/.test(h.quoi)), JSON.stringify(m.suivi));
    ok('suivi : 4 recherches Gmail au plus par passage (ici 3 : l’objet de chaque mail, et les PDF des destinataires du CRA)', G.recherches.length - r0 === 3 && G.recherches.slice(r0).some((q) => q === 'from:(contact@exemple.invalid) filename:pdf newer_than:50d'), JSON.stringify(G.recherches.slice(r0))); }
  /* les deux réponses arrivent : même fil avec le CRA en PDF (puis sa propre réponse, dernier message du fil) ; autre adresse, autre fil, « Re :objet » */
  const tR1 = Date.parse('2026-11-26T14:20:00Z'), tR2 = Date.parse('2026-11-26T14:25:00Z');
  poser('fil-cra-0001', [G.fils['fil-cra-0001'].messages[0], msg('m2', 'contact@exemple.invalid', 'Contact Client', 'Re: CRA Novembre 2026', tR1, ['INBOX', 'UNREAD'], [IMG, PDF], 'Bonjour, ci-joint le CRA sign&#233;.'), msg('m3', MOI, 'Moi', 'Re: CRA Novembre 2026', tR1 + MIN, ['SENT'], [], 'Merci !')]);
  poser('fil-pro-0002', [msg('p2', 'equipe@exemple.invalid', 'Équipe Missions', 'Re :Prolongation de mission', tR2, ['INBOX', 'UNREAD'], [IMG], 'Bonjour, nous regardons et revenons vers vous.')]);
  Ts += 5 * MIN; await JS.tic();
  { const m = lu('js.json'), c = m.suivi.cra.reponses[0] || {}, p = m.suivi.prolongation.reponses[0] || {}, n = reps();
    ok('détection active : la réponse dans le même fil (CRA en PDF) et celle d’un autre fil, d’une autre adresse (« Re :objet »), notées dans jours.json (qui, quand, message, fil, PDF, extrait, historique)', m.suivi.cra.reponses.length === 1 && c.id === 'm2' && c.fil === 'fil-cra-0001' && c.at === tR1 && c.pdf === true && c.nom === 'Contact Client' && c.de === 'contact@exemple.invalid' && c.extrait === 'Bonjour, ci-joint le CRA signé.' && m.suivi.cra.clos === 'pdf' && m.suivi.prolongation.reponses.length === 1 && p.id === 'p2' && p.fil === 'fil-pro-0002' && p.pdf === false && p.voie === 'objet'
      && m.historique.some((h) => /^CRA signé reçu : Contact Client, le 26\/11 à 15:20$/.test(h.quoi)) && m.historique.some((h) => /^réponse au mail de prolongation : Équipe Missions/.test(h.quoi)), JSON.stringify(m.suivi));
    ok('le CRA signé : jours.json garde de quoi retrouver le PDF sans le télécharger (message, pièce jointe, nom du fichier, taille) ; rien pour une image', c.pdfs.length === 1 && c.pdfs[0].message === 'm2' && c.pdfs[0].piece === 'piece-v1' && c.pdfs[0].nom === 'CRA signé.pdf' && c.pdfs[0].taille === 48213 && c.pdfs[0].type === 'application/pdf' && p.pdfs.length === 0, JSON.stringify([c.pdfs, p.pdfs]));
    ok('détection active : deux notifications, une par réponse (titre, expéditeur affiché et extrait, lien vers Travail)', n.length === 2 && n[0].title === 'CRA signé reçu de ton client' && n[0].body === 'Contact Client : Bonjour, ci-joint le CRA signé. À rattacher sur le portail.' && n[0].url === '/#travail' && n[0].tag === 'rep-cra-2026-11' && n[1].title === 'Réponse à ton mail de prolongation' && /^Équipe Missions : Bonjour, nous regardons/.test(n[1].body), JSON.stringify(n));
    ok('Journal de Pilotage : une ligne par réponse, sans nom, sans adresse, sans extrait du mail', X.journal.length === 2 && X.journal[0].sujet === 'CRA du mois : CRA signé reçu' && /^Réponse au mail « CRA Novembre 2026 » reçue le 26\/11 à 15:20, avec un PDF\. À rattacher sur le portail\.$/.test(X.journal[0].detail) && X.journal[1].sujet === 'Prolongation de mission : réponse reçue' && !/Contact|Équipe|@|Bonjour/.test(JSON.stringify(X.journal)), JSON.stringify(X.journal)); }
  /* les passages suivants : rien de renotifié ; le mail du CRA n'est plus cherché (CRA reçu) ; un fil inchangé n'est pas relu */
  Ts += 5 * MIN; r0 = G.recherches.length; let l0 = G.lus.length; await JS.tic(); Ts += 5 * MIN; await JS.tic();
  ok('une réponse déjà notée n’est jamais renotifiée ; le CRA reçu, son mail n’est plus cherché ; un fil que Gmail dit inchangé n’est pas relu', reps().length === 2 && X.journal.length === 2 && G.recherches.slice(r0).length === 2 && G.recherches.slice(r0).every((q) => /^subject:"Prolongation de mission"/.test(q)) && G.lus.length === l0, JSON.stringify([G.recherches.slice(r0), G.lus.length - l0]));
  /* un redémarrage : même fichier, mémoire vide */
  const JS2 = creer('js.json'); Ts += 5 * MIN; await JS2.tic();
  ok('redémarrage : le suivi reprend au premier passage, sans rien renotifier (tout est dans jours.json)', reps().length === 2 && X.journal.length === 2 && lu('js.json').suivi.prolongation.reponses.length === 1 && G.lus.length > l0);
  /* il lit la réponse dans Gmail, puis une seconde réponse arrive */
  poser('fil-pro-0002', [{...G.fils['fil-pro-0002'].messages[0], labelIds: ['INBOX']}]); Ts += 5 * MIN; await JS2.tic();
  ok('une réponse lue dans Gmail est notée « lue », sans notification', lu('js.json').suivi.prolongation.reponses[0].lu === true && reps().length === 2);
  poser('fil-pro-0002', [...G.fils['fil-pro-0002'].messages, msg('p3', 'chargee@exemple.invalid', 'Chargée', 'RE: Re :Prolongation de mission', Ts, ['INBOX', 'UNREAD'], [], 'La suite du message.')]); Ts += 5 * MIN; await JS2.tic(); Ts += 5 * MIN; await JS2.tic();
  ok('une nouvelle réponse au même mail : notifiée une fois, elle aussi', reps().length === 3 && reps()[2].title === 'Réponse à ton mail de prolongation' && /^Chargée : La suite/.test(reps()[2].body) && lu('js.json').suivi.prolongation.reponses.length === 2);
  { const a = JS2.rattacher('2026-10'), b = JS2.rattacher('2026-11');
    ok('« C’est rattaché » : gardé dans jours.json (refusé pour un mois sans CRA signé reçu)', !a.ok && b.ok && lu('js.json').suivi.cra.rattache > 0 && lu('js.json').historique.some((h) => /rattaché/.test(h.quoi))); }
  /* le quota de Gmail : une pause de 15 minutes, écrite une fois au journal du serveur */
  G.erreur = Object.assign(new Error('Quota exceeded for quota metric \'Queries\' and limit \'Queries per minute per user\''), {status: 429});
  Ts += 5 * MIN; r0 = G.recherches.length; const g0 = X.log.length; await JS2.tic(); Ts += 5 * MIN; await JS2.tic(); Ts += 5 * MIN; await JS2.tic();
  const dits = X.log.slice(g0).filter((t) => /suivi des réponses/.test(t));
  G.erreur = null; Ts += 6 * MIN; await JS2.tic();
  ok('quota de Gmail atteint : une seule recherche, le suivi attend 15 minutes, c’est écrit une fois au journal du serveur, puis il reprend', G.recherches.length - r0 === 2 && dits.length === 1 && /quota de Gmail, nouvel essai dans 15 minutes/.test(dits[0]) && lu('js.json').suivi.prolongation.erreur === '', JSON.stringify([G.recherches.length - r0, dits]));
  /* 45 jours après l'envoi : le suivi s'arrête */
  Ts += 46 * 864e5; await JS2.tic(); Ts += 5 * MIN; r0 = G.recherches.length; await JS2.tic(); Ts += 5 * MIN; await JS2.tic();
  ok('45 jours après l’envoi, le mail n’est plus suivi (plus aucune recherche)', G.recherches.length === r0, String(G.recherches.length - r0));
  /* rattrapage : un mail envoyé à la main (sans brouillon de JARVIS), des réponses déjà arrivées avant le premier passage */
  Ts = Date.parse('2026-11-27T12:30:00Z'); X.push.length = 0; X.journal.length = 0; G.deja.add('CRA Novembre 2026'); G.deja.add('Prolongation de mission');
  const JR = creer('jr.json'); await JR.lire('2026-11'); JR.confirmer('2026-11', JR.etat('2026-11').bilan.empreinte); const c0 = X.crees.length;
  await JR.tic(); await JR.tic();
  { const m = lu('jr.json');
    ok('rattrapage : mails envoyés à la main (« envoye » sans brouillon) et réponses déjà là : détectées et notifiées une fois dès le premier passage', X.crees.length === c0 && m.mailCra.envoye && !m.mailCra.draftId && m.suivi.cra.envoi.at === tCra && m.suivi.cra.reponses[0].pdf && m.suivi.prolongation.reponses.length === 2 && reps().length === 3 && reps()[0].title === 'CRA signé reçu de ton client', JSON.stringify([m.suivi, reps().map((p) => p.title)])); }
  /* l'ancienne voie : le CRA arrive dans un mail d'un autre objet, d'un destinataire du modèle, avec un PDF */
  for (const k of Object.keys(G.fils)) delete G.fils[k];
  poser('fil-cra-0001', [msg('m1', MOI, 'Moi', 'CRA Novembre 2026', tCra, ['SENT'])]);
  poser('fil-doc-0001', [msg('d0', 'contact@exemple.invalid', 'Contact Client', 'Un PDF d’avant', tCra - MIN, ['INBOX'], [PDF]), msg('d1', 'contact@exemple.invalid', 'Contact Client', 'Document signé', tCra + 30 * MIN, ['INBOX'], [PDF], 'Voici le document.')]);
  X.push.length = 0; const JV = creer('jv.json'); await JV.lire('2026-11'); JV.confirmer('2026-11', JV.etat('2026-11').bilan.empreinte); await JV.tic();
  ok('l’ancienne voie, corrigée : un PDF d’un destinataire du modèle arrivé après l’envoi, sous un autre objet, vaut « CRA signé reçu » (pas celui d’avant l’envoi)', lu('jv.json').suivi.cra.reponses.length === 1 && lu('jv.json').suivi.cra.reponses[0].id === 'd1' && lu('jv.json').suivi.cra.reponses[0].voie === 'destinataire' && reps().length === 1 && reps()[0].title === 'CRA signé reçu de ton client', JSON.stringify(lu('jv.json').suivi.cra));
  /* une réponse sans PDF au mail du CRA, puis le mois suivant : le mois d'avant reste suivi */
  for (const k of Object.keys(G.fils)) delete G.fils[k];
  poser('fil-cra-0001', [msg('m1', MOI, 'Moi', 'CRA Novembre 2026', tCra, ['SENT']), msg('m5', 'contact@exemple.invalid', 'Contact Client', 'RE: CRA Novembre 2026', tCra + 10 * MIN, ['INBOX', 'UNREAD'], [IMG], 'Je te l’envoie lundi.')]);
  X.push.length = 0; const JD = creer('jd.json'); await JD.lire('2026-11'); JD.confirmer('2026-11', JD.etat('2026-11').bilan.empreinte); await JD.tic();
  ok('mail du CRA : une réponse sans PDF (image de signature seule) est notifiée « sans le CRA », et le suivi continue', reps().length === 1 && reps()[0].title === 'Réponse à ton mail du CRA, sans le CRA' && !lu('jd.json').suivi.cra.clos && lu('jd.json').suivi.cra.reponses[0].pdf === false, JSON.stringify(reps()));
  Ts = Date.parse('2026-12-02T08:00:00Z'); poser('fil-cra-0001', [...G.fils['fil-cra-0001'].messages, msg('m6', 'contact@exemple.invalid', 'Contact Client', 'RE: CRA Novembre 2026', Ts - MIN, ['INBOX', 'UNREAD'], [PDF], 'Le voici.')]);
  await JD.tic();
  ok('le mois suivant : la réponse au mail du mois d’avant est encore détectée (notée dans le mois du mail, notifiée une fois)', reps().length === 2 && reps()[1].title === 'CRA signé reçu de ton client' && reps()[1].tag === 'rep-cra-2026-11' && lu('jd.json').suivi.cra.clos === 'pdf' && lu('jd.json').suivi.cra.reponses.length === 2, JSON.stringify(reps().map((p) => p.title)));
  { const s1 = await JD.suivre('2026-11'), s2 = JD.suivi('2026-10');
    ok('l’espace Travail lit le même état (suivre, suivi) ; un mois sans suivi rend un objet vide, sans le créer', s1.cra.reponses.length === 2 && JSON.stringify(s2) === '{}' && !JD.brut().mois['2026-10']); }
  /* une recherche « déjà envoyé ? » qui échoue n'est plus prise pour « pas envoyé » (un brouillon en double était préparé) */
  Ts = Date.parse('2026-11-26T14:00:00Z'); for (const k of Object.keys(G.fils)) delete G.fils[k]; G.deja.clear(); G.erreurEnvoye = Object.assign(new Error('Quota exceeded'), {status: 429});
  const JE = creer('je.json'); await JE.lire('2026-11'); JE.confirmer('2026-11', JE.etat('2026-11').bilan.empreinte); const c1 = X.crees.length, g1 = X.log.length;
  await JE.tic(); Ts += MIN; await JE.tic(); Ts += MIN; await JE.tic();
  const e1 = X.log.slice(g1).filter((t) => /mail du CRA impossible \(recherche du mail déjà envoyé impossible/.test(t)).length;
  G.erreurEnvoye = null; Ts += 5 * MIN; await JE.tic();
  ok('recherche « déjà envoyé ? » en échec (quota) : aucun brouillon préparé à tort, l’erreur écrite au journal du serveur, nouvel essai 5 minutes plus tard (pas chaque minute)', e1 === 1 && X.crees.length === c1 + 2 && !!lu('je.json').mailCra.draftId, JSON.stringify([e1, X.crees.length - c1])); }
/* ---------- 0.97.0 : le CRA signé gardé par JARVIS, vérifié à blanc par Hermes, déposé après son oui — faux Gmail, faux comptes rendus de root, tout inventé ---------- */
{ const crypto = await import('node:crypto');
  const {choisirPdf, verifierPdf, sansAdresse, tailleDite} = await import('../signe.mjs');
  let Ts = Date.parse('2026-11-26T14:00:00Z');   /* jeudi 26, 15 h à Paris */
  const MIN = 60e3, CALS = [{id: 'p1@group.calendar.google.com', summary: 'Présence'}, {id: 'en-gb.french#holiday@group.v.calendar.google.com', summary: 'Holidays in France'}];
  const ag = {lie: () => true, calendriers: async () => CALS, evenements: async (id) => (id === 'p1@group.calendar.google.com' ? BASE : FER)};
  const MOD = {cra_client: {a: ['contact@exemple.invalid'], objet: 'CRA {MOIS} {ANNEE}', corps: 'Bonjour'}};
  const PDF1 = Buffer.concat([Buffer.from('%PDF-1.4\n% CRA signé inventé du banc\n'), Buffer.alloc(3000, 0x20), Buffer.from('\n%%EOF\n')]), PDF2 = Buffer.from('%PDF-1.4\n% annexe inventée\n%%EOF\n');
  const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
  ok('signe.mjs : un seul PDF retenu, le plus gros qui n’est pas une image (une image nommée « .pdf » et une pièce sans identifiant sont écartées) ; aucun PDF : rien',
    choisirPdf([{filename: 'scan.pdf', mimeType: 'image/png', size: 9e6, attachmentId: 'i'}, {filename: 'annexe.pdf', mimeType: 'application/pdf', size: 10, attachmentId: 'a'}, {filename: 'CRA.PDF', mimeType: 'application/octet-stream', size: 500, attachmentId: 'b'}, {filename: 'x.pdf', mimeType: 'application/pdf', size: 9e9}]).piece.attachmentId === 'b'
    && choisirPdf([{filename: 'a.pdf', mimeType: 'application/pdf', size: 1, attachmentId: 'a'}, {filename: 'b.pdf', mimeType: 'application/pdf', size: 2, attachmentId: 'b'}]).autres === 1 && choisirPdf([{filename: 'image.png', mimeType: 'image/png', size: 1, attachmentId: 'i'}]) === null);
  ok('signe.mjs : vérification (« %PDF- », 15 Mo au plus, pas vide) ; taille dite ; un texte de root sans adresse, hôte ni adresse mail',
    verifierPdf(PDF1) === '' && /pas un PDF/.test(verifierPdf(Buffer.from('<html>'))) && /vide/.test(verifierPdf(Buffer.alloc(0))) && /15 Mo/.test(verifierPdf(Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(15 * 1024 * 1024)])))
    && tailleDite(48213) === '47 Ko' && tailleDite(2621440) === '2,5 Mo' && sansAdresse('Vu sur https://portail.exemple.invalid/cra?x=1 et intranet.exemple.invalid, écrire à a@exemple.invalid. 21,5 jours.') === 'Vu sur (adresse) et (adresse), écrire à (adresse) 21,5 jours.');
  /* une instance : son dossier de données à elle (le dossier de garde est à côté de jours.json), son faux Gmail, ses comptes rendus de root */
  const monter = (nom, {pieces = null, octets = null, lien = false} = {}) => {
    const dir = path.join(DIR, 'signe-' + nom), RT = path.join(dir, 'retours'); fs.mkdirSync(RT, {recursive: true});
    const X = {push: [], log: [], lectures: 0, pieces: [], erreurPiece: null, dir, RT, garde: path.join(dir, 'cra-signe')};
    if (lien) { fs.mkdirSync(path.join(dir, 'ailleurs')); fs.symlinkSync(path.join(dir, 'ailleurs'), X.garde); }
    const tEnvoi = Date.parse('2026-11-26T08:02:00Z'), tRep = Date.parse('2026-11-26T13:05:00Z');
    const pj = pieces || [{filename: 'image.png', mimeType: 'image/png', size: 900, id: 'img'}, {filename: 'annexe.pdf', mimeType: 'application/pdf', size: PDF2.length, id: 'annexe'}, {filename: 'CRA signé.pdf', mimeType: 'application/pdf', size: PDF1.length, id: 'cra'}];
    X.octets = octets || {cra: PDF1, annexe: PDF2};
    const msg = (id, de, nom2, objet, at, labelIds, attachments = []) => ({id, sender: de, addressDisplayNames: [{displayName: nom2, emailAddress: de}], subject: objet, internalDate: String(at), labelIds, snippet: 'Bonjour, ci-joint le CRA signé.', attachments});
    /* comme Gmail : l'identifiant d'une pièce jointe change à chaque lecture du fil ; seul celui de la dernière lecture est accepté */
    const fil = () => { X.lectures++; return {id: 'fil-cra-0001', messages: [msg('m-envoi', 'moi@exemple.invalid', 'Moi', 'CRA Novembre 2026', tEnvoi, ['SENT']),
      msg('m-rep', 'contact@exemple.invalid', 'Contact Client', 'RE: CRA Novembre 2026', tRep, ['INBOX'], pj.map((p) => ({filename: p.filename, mimeType: p.mimeType, size: p.size, attachmentId: p.id + '-v' + X.lectures})))]}; };
    const mails = {modeles: () => MOD, brouillon: async () => ({id: 'b1'}), majBrouillon: async () => ({}), envoye: async () => true, moi: () => 'moi@exemple.invalid',
      chercher: async (q) => (/^subject:"CRA Novembre 2026"/.test(q) ? {threads: [{id: 'fil-cra-0001', historyId: '1'}]} : {}), fil: async () => fil(),
      piece: async (message, piece) => { X.pieces.push(message + '/' + piece); if (X.erreurPiece) throw X.erreurPiece; const [id, v] = String(piece).split('-v'); if (message !== 'm-rep' || +v !== X.lectures || !X.octets[id]) throw new Error('pièce jointe introuvable'); return {size: X.octets[id].length, data: X.octets[id].toString('base64url')}; }};
    X.J = createJours({file: path.join(dir, 'jours.json'), agenda: ag, retours: RT, mails, push: async (m) => { X.push.push(m); return []; }, log: (t) => X.log.push(t), now: () => Ts});
    X.lu = () => JSON.parse(fs.readFileSync(path.join(dir, 'jours.json'), 'utf8')).mois['2026-11']; X.signe = () => X.lu().suivi.cra.signe || {};
    X.retour = (r) => fs.writeFileSync(path.join(RT, 'signe-2026-11.json'), JSON.stringify({mois: '2026-11', at: Ts, ...r}));
    X.moisValide = () => fs.writeFileSync(path.join(RT, 'mois-2026-11.json'), JSON.stringify({mois: '2026-11', resultat: 'validee', at: Ts}));
    X.avis = () => X.push.filter((p) => /^(Première exécution d’Hermes : )?CRA signé (prêt|de )/.test(p.title));
    X.fichiers = () => { try { return fs.readdirSync(X.garde); } catch { return []; } };
    return X;
  };
  const mode = (f) => (fs.lstatSync(f).mode & 0o777).toString(8);
  /* 1. la détection garde le PDF tout de suite */
  Ts = Date.parse('2026-11-26T14:00:00Z'); const A = monter('a'); await A.J.tic();
  { const g = A.signe(), f = path.join(A.garde, g.fichier || 'x'), rep = A.lu().suivi.cra.reponses[0];
    ok('CRA signé : à la détection, le message est relu (l’identifiant de pièce gardé est périmé), le plus gros PDF est téléchargé une fois et gardé avec son empreinte SHA-256',
      rep.pdfs[0].piece === 'annexe-v1' && A.pieces.join() === 'm-rep/cra-v2' && g.empreinte === sha(PDF1) && g.taille === PDF1.length && g.nom === 'CRA signé.pdf' && g.autres === 1 && g.message === 'm-rep' && fs.readFileSync(f).equals(PDF1), JSON.stringify([rep.pdfs, A.pieces, g]));
    ok('CRA signé : gardé sous le dossier de données (sous-dossier 700, fichier 600, nom tiré au sort) ; c’est dit dans l’historique, avec le PDF laissé de côté', mode(A.garde) === '700' && mode(f) === '600' && /^[0-9a-f]{32}\.pdf$/.test(g.fichier) && A.fichiers().length === 1
      && A.lu().historique.some((h) => /^CRA signé gardé pour le dépôt par Hermes \(3 Ko ; 1 autre PDF laissé de côté\)$/.test(h.quoi)), JSON.stringify([mode(A.garde), g.fichier, A.lu().historique.map((h) => h.quoi)]));
    ok('CRA signé : la notification de la réponse annonce la suite (« Hermes vérifie le portail, puis te demande ton oui »)', A.push.some((p) => p.title === 'CRA signé reçu de ton client' && /Hermes vérifie le portail, puis te demande ton oui pour le déposer\.$/.test(p.body)), JSON.stringify(A.push.map((p) => p.body))); }
  /* 2. où on en est, pour la carte de Travail : le CRA du mois pas encore validé par Hermes, puis validé, puis le compte rendu à blanc */
  { const v0 = A.J.signe('2026-11'); A.moisValide(); const v1 = A.J.signe('2026-11'), e = A.signe().empreinte;
    ok('CRA signé : tant que le CRA du mois n’est pas validé par Hermes, la carte attend ; ensuite « Hermes vérifie le portail » ; un mois sans CRA signé : rien', v0.etat === 'attend_cra' && v1.etat === 'verifie' && v1.nom === 'CRA signé.pdf' && v1.tailleDite === '3 Ko' && v1.empreinte === e && A.J.signe('2026-10') === null, JSON.stringify([v0, v1]));
    const o0 = A.J.ouiSigne('2026-11', e);
    ok('son oui : refusé tant qu’Hermes n’a pas rendu « pret »', !o0.ok && /pas encore vérifié/.test(o0.error) && !A.signe().oui, JSON.stringify(o0));
    A.retour({etat: 'pret', empreinte: 'f'.repeat(64), texte: 'Onglet trouvé.'}); Ts += MIN; await A.J.tic();
    ok('compte rendu de root pour une autre empreinte que le PDF gardé : ignoré (aucune notification, la carte ne bouge pas)', A.J.signe('2026-11').etat === 'verifie' && !A.avis().length);
    Ts += MIN; A.retour({etat: 'pret', empreinte: e, texte: 'Onglet « CRA signé du client » trouvé sur https://portail.exemple.invalid/activite ; aucun document déposé pour novembre.'}); await A.J.tic();
    const v2 = A.J.signe('2026-11'), n = A.avis();
    ok('compte rendu « pret » : la carte passe à « pret », une notification « CRA signé prêt à déposer : ton oui » (sans adresse du portail), lien vers Travail', v2.etat === 'pret' && n.length === 1 && n[0].title === 'CRA signé prêt à déposer : ton oui' && /« Oui, déposer », ou « Je le fais moi-même »/.test(n[0].body) && n[0].url === '/#travail' && !/exemple\.invalid/.test(JSON.stringify(A.signe().retour)), JSON.stringify([v2, n]));
    Ts += MIN; A.retour({etat: 'pret', empreinte: e, texte: 'Encore.'}); await A.J.tic();
    ok('un second « pret » pour le même fichier : pas de seconde notification', A.avis().length === 1); }
  /* 3. son oui, sur l'empreinte et le mois */
  { const e = A.signe().empreinte, r0 = A.J.ouiSigne('2026-11', 'a'.repeat(64)), r1 = A.J.ouiSigne('2026-10', e), r2 = await A.J.traiter('POST', '/api/jours/signe/valider', async () => ({mois: '2026-11', empreinte: e})), o = A.signe().oui || {};
    ok('son oui : refusé sur une autre empreinte ou un autre mois ; accepté par la route, gardé sur l’empreinte du PDF et le mois', !r0.ok && /a changé/.test(r0.error) && !r1.ok && r2.status === 200 && r2.body.ok && o.empreinte === e && o.mois === '2026-11' && o.at === Ts, JSON.stringify([r0, r1, r2, o]));
    const v = A.J.signe('2026-11'), m = A.J.moiSigne('2026-11');
    ok('son oui donné : la carte dit qu’Hermes dépose ; « Je le fais moi-même » n’est plus possible (le oui est parti)', v.etat === 'oui' && !m.ok && /déjà parti/.test(m.error), JSON.stringify([v, m]));
    /* le dépôt réel échoue : le PDF reste gardé, un nouveau oui est possible */
    Ts += 5 * MIN; A.retour({etat: 'echec', reel: true, empreinte: e, texte: 'Le portail a refusé le fichier.'}); await A.J.tic();
    const v3 = A.J.signe('2026-11'), n = A.avis();
    ok('dépôt en échec : « pas déposé : à faire à la main », la raison, le PDF reste gardé, l’étape n’est pas faite', v3.etat === 'echec' && v3.raison === 'Le portail a refusé le fichier.' && n[n.length - 1].title === 'CRA signé de novembre pas déposé : à faire à la main' && /Le PDF reste gardé\.$/.test(n[n.length - 1].body) && A.fichiers().length === 1 && !A.lu().suivi.cra.rattache, JSON.stringify([v3, n[n.length - 1]]));
    Ts += MIN; const r3 = A.J.ouiSigne('2026-11', e), o2 = A.signe().oui;
    ok('après un échec, un nouveau oui est un autre oui (son heure change : root fera une nouvelle tentative, une seule)', r3.ok && o2.at === Ts && A.J.signe('2026-11').etat === 'oui', JSON.stringify([r3, o2]));
    /* le dépôt réel réussit : première exécution */
    Ts += 5 * MIN; A.retour({etat: 'depose', reel: true, premiere: true, empreinte: e, texte: 'Déposé, visible dans la liste.'}); await A.J.tic();
    const s = A.lu().suivi.cra, v4 = A.J.signe('2026-11'), n2 = A.avis();
    ok('dépôt fait : étape « Rattaché » (le même état que « C’est rattaché », par Hermes), « Première exécution d’Hermes : CRA signé de novembre déposé — vérifie sur le portail », PDF gardé effacé', s.rattache === Ts && s.rattachePar === 'hermes' && v4.etat === 'fait' && v4.par === 'hermes' && n2[n2.length - 1].title === 'Première exécution d’Hermes : CRA signé de novembre déposé — vérifie sur le portail'
      && !A.fichiers().length && !s.signe.fichier && s.signe.pourquoi === 'dépôt fait', JSON.stringify([s.rattache, s.rattachePar, v4, n2[n2.length - 1], A.fichiers()]));
    const r4 = A.J.ouiSigne('2026-11', e), k = n2.length; Ts += MIN; await A.J.tic();
    ok('une fois déposé : plus de oui possible, rien n’est retéléchargé ni renotifié', !r4.ok && A.avis().length === k && A.pieces.length === 1 && !A.fichiers().length, JSON.stringify([r4, A.pieces])); }
  /* 4. les exécutions suivantes, « déjà sur le portail », « introuvable » */
  { Ts = Date.parse('2026-11-26T14:00:00Z'); const B = monter('b'); await B.J.tic(); B.moisValide(); const e = B.signe().empreinte;
    B.retour({etat: 'pret', empreinte: e, texte: 'Trouvé.'}); Ts += MIN; await B.J.tic(); B.J.ouiSigne('2026-11', e);
    Ts += MIN; B.retour({etat: 'depose', reel: true, premiere: false, empreinte: e, texte: 'Déposé.'}); await B.J.tic();
    ok('dépôt fait, pas la première fois : « CRA signé de novembre déposé »', B.avis().pop().title === 'CRA signé de novembre déposé' && B.lu().suivi.cra.rattachePar === 'hermes');
    Ts = Date.parse('2026-11-26T14:00:00Z'); const C = monter('c'); await C.J.tic(); C.moisValide();
    C.retour({etat: 'deja', empreinte: C.signe().empreinte, texte: 'Un CRA signé est déjà déposé pour novembre.'}); Ts += MIN; await C.J.tic();
    ok('à blanc, « déjà déposé » : rien à faire, l’étape est faite (vu par Hermes), le PDF gardé est effacé', C.lu().suivi.cra.rattachePar === 'portail' && C.J.signe('2026-11').etat === 'fait' && !C.fichiers().length && C.avis().pop().title === 'CRA signé de novembre : déjà sur le portail', JSON.stringify(C.avis()));
    Ts = Date.parse('2026-11-26T14:00:00Z'); const D2 = monter('d'); await D2.J.tic(); D2.moisValide(); const e2 = D2.signe().empreinte;
    D2.retour({etat: 'introuvable', empreinte: e2, texte: 'Aucun onglet de dépôt sur la page du mois.'}); Ts += MIN; await D2.J.tic();
    const v = D2.J.signe('2026-11'), o = D2.J.ouiSigne('2026-11', e2);
    ok('à blanc, « introuvable » : la carte le dit avec la raison, une notification « à déposer à la main », aucun oui possible, le PDF reste gardé', v.etat === 'introuvable' && v.raison === 'Aucun onglet de dépôt sur la page du mois.' && D2.avis().pop().title === 'CRA signé de novembre : à déposer à la main' && !o.ok && D2.fichiers().length === 1, JSON.stringify([v, o]));
    const m = await D2.J.traiter('POST', '/api/jours/signe/moi', async () => ({mois: '2026-11'})), o2 = D2.J.ouiSigne('2026-11', e2);
    ok('« Je le fais moi-même » : noté, plus de oui possible ; puis « C’est rattaché » efface le PDF gardé', m.status === 200 && D2.J.signe('2026-11').etat === 'moi' && !o2.ok && D2.J.rattacher('2026-11').ok && !D2.fichiers().length && D2.J.signe('2026-11').par === 'toi', JSON.stringify([m, o2])); }
  /* 5. le fichier gardé change après son affichage ; un lien à la place du dossier */
  { Ts = Date.parse('2026-11-26T14:00:00Z'); const E = monter('e'); await E.J.tic(); E.moisValide(); const g = E.signe();
    E.retour({etat: 'pret', empreinte: g.empreinte, texte: 'Trouvé.'}); Ts += MIN; await E.J.tic();
    fs.writeFileSync(path.join(E.garde, g.fichier), Buffer.concat([PDF1, Buffer.from('ajout')]));
    const o = E.J.ouiSigne('2026-11', g.empreinte);
    ok('son oui : refusé si le PDF gardé n’est plus celui qui lui a été montré (empreinte recalculée à l’instant du oui)', !o.ok && /plus celui/.test(o.error) && !E.signe().oui, JSON.stringify(o));
    Ts = Date.parse('2026-11-26T14:00:00Z'); const F = monter('f', {lien: true}); await F.J.tic(); Ts += 20 * MIN; await F.J.tic();
    ok('le dossier de garde est un lien : rien n’est écrit à travers, c’est écrit au journal du serveur, la carte reste à « JARVIS récupère le PDF »', !fs.readdirSync(path.join(F.dir, 'ailleurs')).length && !F.signe().fichier && F.J.signe('2026-11').etat === 'recupere' && F.log.some((t) => /pas encore gardé \(le dossier de garde du CRA signé n’est pas un vrai dossier\)/.test(t)), JSON.stringify([F.signe(), F.log])); }
  /* 6. ce qui n'est pas un PDF, ce qui est trop gros, un téléchargement en échec */
  { Ts = Date.parse('2026-11-26T14:00:00Z'); const G1 = monter('g', {octets: {cra: Buffer.from('<html>pas un PDF</html>'), annexe: PDF2}}); await G1.J.tic();
    ok('la pièce jointe ne commence pas par « %PDF- » : refusée, rien n’est gardé, la carte dit de le rattacher à la main', G1.J.signe('2026-11').etat === 'refuse' && /pas un PDF/.test(G1.J.signe('2026-11').raison) && !G1.fichiers().length && G1.pieces.length === 1, JSON.stringify(G1.signe()));
    Ts = Date.parse('2026-11-26T14:00:00Z'); const G2 = monter('h', {pieces: [{filename: 'CRA signé.pdf', mimeType: 'application/pdf', size: 16 * 1024 * 1024, id: 'cra'}]}); await G2.J.tic();
    ok('un PDF annoncé à plus de 15 Mo : refusé sans être téléchargé', G2.J.signe('2026-11').etat === 'refuse' && /15 Mo/.test(G2.J.signe('2026-11').raison) && !G2.pieces.length);
    Ts = Date.parse('2026-11-26T14:00:00Z'); const G3 = monter('i'); G3.erreurPiece = new Error('réseau coupé'); await G3.J.tic();
    const p0 = G3.pieces.length; Ts += 5 * MIN; await G3.J.tic(); const p1 = G3.pieces.length; G3.erreurPiece = null; Ts += 11 * MIN; await G3.J.tic();
    ok('téléchargement en échec : la carte le dit, nouvel essai 15 minutes plus tard (pas avant), puis le PDF est gardé', p0 === 1 && p1 === 1 && G3.pieces.length === 2 && G3.signe().empreinte === sha(PDF1) && G3.fichiers().length === 1 && G3.log.some((t) => /pas encore gardé \(réseau coupé\) : nouvel essai dans 15 minutes/.test(t)), JSON.stringify([p0, p1, G3.pieces.length, G3.signe()])); }
  /* 7. rattrapage d'une réponse notée avant la 0.97.0 ; 45 jours ; ce qui traîne dans le dossier */
  { Ts = Date.parse('2026-11-26T14:00:00Z'); const H = monter('j'), dir = H.dir;
    fs.writeFileSync(path.join(dir, 'jours.json'), JSON.stringify({version: 1, mois: {'2026-11': {etat: 'a_valider', corrections: {}, historique: [], suivi: {cra: {objet: 'CRA Novembre 2026', envoi: {id: 'm-envoi', fil: 'fil-cra-0001', at: Ts - 6 * 3600e3}, clos: 'pdf', lu: Ts - 3600e3,
      reponses: [{id: 'm-rep', fil: 'fil-cra-0001', at: Ts - 3600e3, de: 'contact@exemple.invalid', nom: 'Contact Client', pdf: true, pieces: 1, pdfs: [{message: 'm-rep', piece: 'cra-v0', nom: 'CRA signé.pdf', taille: PDF1.length, type: 'application/pdf'}], extrait: 'Bonjour', lu: true, voie: 'fil', vu: Ts - 3600e3, notifie: Ts - 3600e3}]}}}}}));
    const H2 = monter('j'); await H2.J.tic();
    ok('rattrapage : une réponse déjà notée (suivi clos, rien de gardé) : son PDF est gardé au premier passage, sans notification de plus', H2.signe().empreinte === sha(PDF1) && H2.fichiers().length === 1 && !H2.push.some((p) => /CRA signé/.test(p.title)), JSON.stringify([H2.signe(), H2.push]));
    fs.writeFileSync(path.join(H2.garde, '0'.repeat(32) + '.pdf'), PDF2); fs.writeFileSync(path.join(H2.garde, 'autre.txt'), 'x');
    Ts += 5 * MIN; await H2.J.tic();
    ok('ménage : un PDF qui traîne dans le dossier sans être gardé pour un mois est effacé ; rien d’autre n’est touché', H2.fichiers().sort().join() === [H2.signe().fichier, 'autre.txt'].sort().join(), H2.fichiers().join());
    Ts += 46 * 864e5; await H2.J.tic();
    ok('45 jours après : le PDF gardé est effacé, la carte revient à « à rattacher » (plus de oui possible)', !H2.fichiers().includes(H2.signe().fichier || 'x') && H2.signe().pourquoi === '45 jours' && H2.J.signe('2026-11').etat === 'efface' && !H2.J.ouiSigne('2026-11', sha(PDF1)).ok, JSON.stringify(H2.signe())); }
}
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
