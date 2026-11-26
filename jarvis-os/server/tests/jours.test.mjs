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
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
