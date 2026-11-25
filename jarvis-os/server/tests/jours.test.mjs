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
  ok('bilan : 15 travaillés (9 télétravail, 6 sur site), 3 de congé, 1 férié, 21 jours ouvrés', b.totaux.travailles === 15 && b.totaux.teletravail === 9 && b.totaux.surSite === 6 && b.totaux.conges === 3 && b.totaux.feries === 1 && b.totaux.ouvres === 21, JSON.stringify(b.totaux));
  ok('bilan : jeudi 26 et vendredi 27 sans indication sont « à confirmer », jamais devinés ; le bilan n’est pas complet', b.aConfirmer.join() === '2026-11-26,2026-11-27' && !b.complet && j(26).M === '?');
  ok('bilan : un congé sur deux jours (un seul événement, fin exclue) compte les deux ; celui d’octobre ne déborde pas', j(12).M === 'C' && j(13).A === 'C' && j(11).M === 'F' && j(2).M === 'S' && b.jours.length === 30);
  ok('bilan : la Toussaint un dimanche n’est pas un férié compté ; une « observance » n’est pas un férié', j(1).M === 'W' && !j(20).ferie && j(20).M === 'T');
  ok('résumé en une phrase', resume(b) === 'Novembre 2026 : 15 jours travaillés (9 en télétravail, 6 sur site), 3 de congé, 1 férié ; à confirmer : jeudi 26, vendredi 27.', resume(b));
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
  rep = await J.traiter('POST', '/api/jours/confirmer', async () => ({mois: '2026-11', empreinte: rep.body.bilan.empreinte}));
  ok('module : un bilan incomplet ne se confirme pas', rep.status === 409 && /confirmer ou à résoudre/.test(rep.body.error));
  rep = await J.traiter('POST', '/api/jours/corriger', async () => ({mois: '2026-11', texte: 'jeudi 26 et vendredi 27 : télétravail'}));
  ok('module : correction lue par les règles (sans Claude), bilan complet remontré', rep.status === 200 && rep.body.par === 'règles' && appels.claude === 0 && rep.body.bilan.complet && rep.body.compris === 'jeudi 26, vendredi 27 : télétravail', JSON.stringify({par: rep.body.par, c: rep.body.compris}));
  const emp = rep.body.bilan.empreinte;
  rep = await J.traiter('POST', '/api/jours/confirmer', async () => ({mois: '2026-11', empreinte: emp.replace('26TT', '26SS')}));
  ok('module : un oui sur un bilan qui a changé depuis son affichage est refusé', rep.status === 409 && /changé/.test(rep.body.error));
  rep = await J.traiter('POST', '/api/jours/confirmer', async () => ({mois: '2026-11', empreinte: emp}));
  ok('module : oui donné, état « validé », jours gardés pour le CRA', rep.status === 200 && rep.body.etat === 'valide' && J.valides('2026-11').jours.length === 21 && J.valides('2026-11').totaux.travailles === 17);
  rep = await J.traiter('POST', '/api/jours/corriger', async () => ({mois: '2026-11', texte: 'on verra plus tard avec lui'}));
  ok('module : une phrase que les règles ne lisent pas passe par Claude (une fois), et le bilan redevient à valider', rep.status === 200 && rep.body.par === 'Claude' && appels.claude === 1 && rep.body.etat === 'a_valider', JSON.stringify({s: rep.status, par: rep.body.par, e: rep.body.etat}));
  await J.confirmer('2026-11', J.etat('2026-11').bilan.empreinte);
  /* le 24 est passé : le rattrapage envoie une notification le 25 ; une seule */
  const J2 = createJours({file: path.join(DIR, 'j2.json'), agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  await J2.tic(); await J2.tic();
  ok('le 24 manqué (serveur arrêté, ou mis à jour le 25) : une notification, une seule, qui ouvre le bilan', appels.push.length === 1 && /Tes jours de novembre/.test(appels.push[0].title) && appels.push[0].url === '/#voir-jours-2026-11' && /À valider dans JARVIS/.test(appels.push[0].body), JSON.stringify(appels.push));
  T = Date.parse('2026-11-24T10:30:00Z');   /* le 24 à 11 h 30 : trop tôt */
  const J3 = createJours({file: path.join(DIR, 'j3.json'), agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  await J3.tic();
  ok('le 24 avant midi : rien', appels.push.length === 1);
  T = Date.parse('2026-11-24T11:01:00Z'); await J3.tic();
  ok('le 24 à midi : la notification part', appels.push.length === 2);
  /* le dernier jour : relu ; silencieux si rien n'a changé depuis son oui, notification si un jour a changé */
  T = Date.parse('2026-11-30T11:05:00Z');
  await J.tic();
  ok('le dernier jour, rien de changé depuis son oui : aucune notification', appels.push.length === 2 && J.etat('2026-11').etat === 'valide');
  const J4 = createJours({file, agenda, push: async (m) => { appels.push.push(m); return []; }, now: () => T});
  pres.push(jour(27, 'Hors Domicile'));
  J4.brut().mois['2026-11'].verifFin = ''; await J4.tic();
  ok('le dernier jour, un jour changé depuis son oui : « à revoir », notification « ont changé »', J4.etat('2026-11').etat === 'a_revoir' && /ont changé/.test(appels.push[appels.push.length - 1].title), J4.etat('2026-11').etat);
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
