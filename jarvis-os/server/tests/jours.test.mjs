/* Banc des jours du mois (0.83.0) : node tests/jours.test.mjs. Aucun vrai Google, aucun vrai Claude ; agendas et jours inventés. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {lireTitre, bilan, resume, lireCorrections, appliquer, comprisDit, createJours, dernierJour} from '../jours.mjs';
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'jours-'));
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
  const J = createJours({file, agenda, claude, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
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
  { const J9 = createJours({file: path.join(DIR, 'j9.json'), agenda: {...agenda, evenements: async (id) => (id.includes('french') ? FER : [...BASE, jour(11, 'Télétravail')])}, now: () => T});
    const r9 = await J9.traiter('GET', '/api/jours', async () => ({}), q('2026-11')), c9 = J9.confirmer('2026-11', r9.body.bilan.empreinte);
    ok('module : un conflit (présence notée un jour férié) bloque le oui', !r9.body.bilan.validable && !c9.ok && /à résoudre/.test(c9.error)); }
  { const J10 = createJours({file: path.join(DIR, 'j10.json'), agenda, now: () => T}), b0 = bilan({ym: '2026-11', presence: BASE, feriesAgenda: FER});
    J10.brut().mois['2026-11'] = {etat: 'valide', corrections: {}, historique: [], valide: {at: T, empreinte: 'ancienne forme', jours: b0.jours.filter((d) => d.ouvre).map((d) => ({date: d.date, M: d.M, A: d.A}))}};
    const x10 = await J10.lire('2026-11');
    ok('module : un oui donné avec la 0.83.0 (empreinte avec le lieu) reste valide après la mise à jour', x10.etat === 'valide', x10.etat); }
  /* le 24 est passé : le rattrapage envoie une notification le 25 ; une seule */
  const J2 = createJours({file: path.join(DIR, 'j2.json'), agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  await J2.tic(); await J2.tic();
  ok('le 24 manqué (serveur arrêté, ou mis à jour le 25) : une notification, une seule, qui ouvre le bilan', appels.push.length === 1 && /Tes jours de novembre/.test(appels.push[0].title) && appels.push[0].url === '/#voir-jours-2026-11' && /congés sert au CRA du 26/.test(appels.push[0].body), JSON.stringify(appels.push));
  T = Date.parse('2026-11-24T10:30:00Z');   /* le 24 à 11 h 30 : trop tôt */
  const J3 = createJours({file: path.join(DIR, 'j3.json'), agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  await J3.tic();
  ok('le 24 avant midi : rien', appels.push.length === 1);
  T = Date.parse('2026-11-24T11:01:00Z'); await J3.tic();
  ok('le 24 à midi : la notification part', appels.push.length === 2);
  /* le dernier jour : relu ; silencieux si rien n'a changé depuis son oui, notification si un jour a changé */
  T = Date.parse('2026-11-30T11:05:00Z');
  await J.tic();
  ok('le dernier jour, tout est connu et rien n’a changé depuis son oui : aucune notification (la note de télétravail part seule)', appels.push.length === 2 && J.etat('2026-11').etat === 'valide' && J.etat('2026-11').bilan.complet);
  const J4 = createJours({file, agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  pres.push(jour(27, 'Hors Domicile'));
  J4.brut().mois['2026-11'].verifFin = ''; await J4.tic();
  ok('le dernier jour, son raccourci dit autre chose que sa correction : conflit, « à revoir », notification « ont changé depuis ton oui »', J4.etat('2026-11').etat === 'a_revoir' && /ont changé depuis ton oui/.test(appels.push[appels.push.length - 1].title), J4.etat('2026-11').etat);
  { const pres11 = [...BASE], ag11 = {...agenda, evenements: async (id) => (id.includes('french') ? FER : id.includes('tn.') ? [] : pres11)}, n0 = appels.push.length;
    T = Date.parse('2026-11-25T11:30:00Z');
    const J11 = createJours({file: path.join(DIR, 'j11.json'), agenda: ag11, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
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
    const JS = createJours({file: path.join(SD, 'jours.json'), agenda: agS, claude, push: async (m) => { pushS.push(m); return []; }, now: () => T});
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
    fs.mkdirSync(path.join(SD, 'portail-retours'), {recursive: true});
    fs.writeFileSync(path.join(SD, 'portail-retours', 'cra-2026-11-23.json'), JSON.stringify({semaine: '2026-11-23', resultat: 'soumise', texte: 'Trois jours saisis, semaine soumise.', premiere: true, at: T}));
    await JS.tic();
    const pr = pushS[pushS.length - 1];
    ok('semaine : le compte rendu d’Hermes : « soumise », notification « première exécution : vérifie », fichier retiré', JS.etatSemaine('2026-11-23').etat === 'soumise' && /Première exécution d’Hermes/.test(pr.title) && /Vérifie sur le portail/.test(pr.body) && !fs.existsSync(path.join(SD, 'portail-retours', 'cra-2026-11-23.json')), JSON.stringify(pr));
    r = await JS.traiter('POST', '/api/jours/semaine/corriger', async () => ({lundi: '2026-11-23', texte: 'mardi 24 : congé'}));
    ok('semaine : une semaine soumise ne se corrige plus dans JARVIS', r.status === 400 && /déjà soumise/.test(r.body.error));
    fs.writeFileSync(path.join(SD, 'portail-retours', 'cra-2026-11-16.json'), JSON.stringify({semaine: '2026-11-16', resultat: 'rien', texte: 'Une saisie existante diffère : rien changé.', premiere: false}));
    await JS.tic();
    ok('semaine : « rien saisi » : « à la main », notification « pas soumis »', JS.etatSemaine('2026-11-16').etat === 'a_la_main' && /pas soumis/.test(pushS[pushS.length - 1].title) && /À faire à la main/.test(pushS[pushS.length - 1].body));
    { await JS.lireSemaine('2026-11-16'); const e16 = JS.etatSemaine('2026-11-16'), v1 = JS.confirmerSemaine('2026-11-16', e16.empreinte), at1 = JS.brut().semaines['2026-11-16'].valide.at;
      ok('semaine : « à la main », un nouveau oui relance Hermes (nouvelle tentative : un autre instant de oui)', v1.ok && JS.etatSemaine('2026-11-16').etat === 'valide' && at1 > 0, JSON.stringify(v1)); }
    /* une demi-journée de congé bloque ; une semaine à cheval sur deux mois */
    presS = [...BASE, jour(26, 'Congé matin')];
    s = await (createJours({file: path.join(SD, 'demi.json'), agenda: agS, now: () => T})).lireSemaine('2026-11-23');
    ok('semaine : une demi-journée de congé bloque la saisie automatique (la quantité n’est pas définie)', s.jours[3].q === null && /demi-journée/.test(s.jours[3].bloque), JSON.stringify(s.jours[3]));
    T = Date.parse('2026-12-04T11:05:00Z'); presS = [...BASE, {summary: 'Télétravail', start: {date: '2026-12-01'}, end: {date: '2026-12-05'}, status: 'confirmed'}];
    r = await JS.traiter('POST', '/api/jours/semaine/corriger', async () => ({lundi: '2026-11-30', texte: 'mardi 1er : congé'}));
    ok('semaine à cheval sur deux mois : « mardi 1er » est le 1er décembre ; la correction va dans le mois de décembre', r.status === 200 && r.body.jours.map((d) => d.q).join() === '1,0,1,1,1' && JS.brut().mois['2026-12'].corrections['2026-12-01'].M.code === 'C', JSON.stringify(r.body.error || r.body.jours.map((d) => d.q)));
    T = Date.parse('2026-11-30T11:05:00Z');
  }
  /* les agendas reconnus à leur identité réelle */
  cals = CALS.filter((c) => !c.id.includes('french'));
  const e1 = await (createJours({file: path.join(DIR, 'j5.json'), agenda, now: () => T})).lire('2026-11');
  cals = [...CALS, {id: 'p2@group.calendar.google.com', summary: 'présence'}];
  const e2 = await (createJours({file: path.join(DIR, 'j6.json'), agenda, now: () => T})).lire('2026-11');
  ok('agendas : sans l’agenda des fériés de France, ou avec deux « Présence » : une erreur dite, pas de bilan deviné', /fériés de France est introuvable/.test(e1.erreur) && !e1.bilan && /Deux agendas/.test(e2.erreur), e1.erreur + ' | ' + e2.erreur);
  cals = CALS;
  const J7 = createJours({file: path.join(DIR, 'j7.json'), agenda: {...agenda, lie: () => false}, now: () => T});
  rep = await J7.traiter('GET', '/api/jours', async () => ({}), q('2026-13'));
  ok('Google pas relié : GET répond sans bilan ; un mois mal écrit retombe sur le mois en cours', rep.status === 200 && rep.body.mois === '2026-11' && !rep.body.bilan);
  fs.writeFileSync(path.join(DIR, 'j8.json'), '{abîmé'); const J8 = createJours({file: path.join(DIR, 'j8.json'), agenda, now: () => T});
  ok('jours.json abîmé : mis de côté, pas écrasé', fs.readdirSync(DIR).some((f) => /^j8-illisible-/.test(f)) && J8.etat('2026-11').etat === 'a_valider');
} catch (e) { ok('exception', false, (e && e.stack) || String(e)); }
fs.rmSync(DIR, {recursive: true, force: true});
console.log(results.join('\n'));
console.log((fails ? 'ÉCHECS : ' + fails : 'Tout est bon') + ' (' + results.length + ' vérifications)');
process.exit(fails ? 1 : 0);
