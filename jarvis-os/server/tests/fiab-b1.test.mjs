/* Banc du lot B1-page-1-2 (0.70.0) : node tests/fiab-b1.test.mjs (aucun réseau, aucun vrai Google ni Claude, aucun coût ; données inventées).
   La page (essais/jarvis-os-maquette/index.html) est un seul script : on y prend quelques fonctions pures, par leur nom, pour les essayer ici,
   et on vérifie le contrat avec le serveur : les messages d'erreur que la page reprend tels quels viennent de google.mjs, en français. */
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import {fileURLToPath} from 'node:url';
import {createGoogle} from '../google.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), PAGE = path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette', 'index.html');
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const html = fs.readFileSync(PAGE, 'utf8'), lignes = html.split('\n');
/* une déclaration de la page (« const nom = … » ou « function nom(… ») : sa ligne, ou, si elle s'ouvre sur « { », jusqu'à l'accolade fermante au même retrait */
function prendre(nom) {
  const re = new RegExp('^( *)(?:const ' + nom + ' = |function ' + nom + '\\()');
  const i = lignes.findIndex((l) => re.test(l)); if (i < 0) throw new Error('introuvable dans la page : ' + nom);
  const ind = re.exec(lignes[i])[1], net = (l) => l.replace(/\s*\/\*.*\*\/\s*$/, ''), l0 = net(lignes[i]);
  if (!/\{$/.test(l0)) { let k = i; while (!/;$/.test(net(lignes[k])) && k < i + 20) k++; return lignes.slice(i, k + 1).join('\n'); }   /* sur une ou plusieurs lignes, jusqu'au « ; » */
  const j = lignes.findIndex((l, k) => k > i && new RegExp('^' + ind + '\\};?(\\s*/\\*.*\\*/)?\\s*$').test(l)); if (j < 0) throw new Error('fin introuvable : ' + nom);
  return lignes.slice(i, j + 1).join('\n');
}
const NOMS = ['pad2', 'isoOf', 'rel', 'late', 'lvExplain', 'radD', 'radDim', 'radYmd', 'RAD_HOL', 'radFeries', 'radOuvre', 'radShift', 'radPalier', 'radOcc', 'bfDe', 'soldesDe', 'depuisN', 'lienSur', 'lienMots', 'lienEch'];
const page = (SRV_OS, S) => vm.runInNewContext('"use strict"; const SRV_OS = ' + JSON.stringify(SRV_OS) + ', S = ' + JSON.stringify(S || {}) + ';\n' + NOMS.map(prendre).join('\n')
  + '\n' + prendre('NATSAY') + '\n({' + NOMS.concat('NATSAY').join(', ') + '})', {});
try {
  const P = page(true), M = page(false);
  /* pont-sw-voix#3 : sur son serveur, les erreurs Google se règlent dans les Réglages de JARVIS, pas dans Claude ; le texte du serveur est repris */
  const G = createGoogle({S: {}, save: () => {}});
  const err = async (f) => { try { await f(); return null; } catch (e) { return e; } };
  const e1 = await err(() => G.tool('Google Sheets', 'get_values', {spreadsheetId: 'x', range: 'Canal!A1:H2'})), e2 = await err(() => G.tool('Google Drive', 'outil_inconnu', {}));
  const t1 = P.lvExplain({code: e1 && e1.code, message: e1 && e1.message, server: 'Google Sheets'}), t2 = P.lvExplain({code: e2 && e2.code, message: e2 && e2.message}, 'Google Drive');
  const t3 = P.lvExplain({code: 'needs_reauth', message: 'Token has been expired or revoked.', server: 'Google Sheets'}), t4 = P.lvExplain({code: 'not_granted', server: 'Google Agenda'});
  ok('B1 pont-sw-voix#3 : Google pas relié (google.mjs) : la page reprend le message du serveur, sans point final ni « dans Claude (Réglages, Connecteurs) »', e1 && e1.code === 'server_not_connected' && t1 === 'Google n’est pas relié à JARVIS (Réglages, Connecter Google)', JSON.stringify([e1 && e1.code, t1]));
  ok('B1 pont-sw-voix#3 : outil pas encore relié (not_in_manifest) : le message du serveur, en français', e2 && e2.code === 'not_in_manifest' && t2 === e2.message.replace(/\.$/, '') && !/Claude/.test(t2), t2);
  ok('B1 pont-sw-voix#3 : accès Google révoqué (needs_reauth) ou incomplet (not_granted) : « Réglages de JARVIS, Connecter Google », jamais le message anglais de Google', t3 === 'Google est à reconnecter : Réglages de JARVIS, « Connecter Google »' && /Réglages de JARVIS/.test(t4) && !/expired|Claude \(/.test(t3 + t4), JSON.stringify([t3, t4]));
  ok('B1 pont-sw-voix#3 : hors serveur (ancienne page dans Claude), les conseils d’avant restent', M.lvExplain({code: 'needs_reauth', server: 'Google Sheets'}) === 'reconnecte Google Sheets dans Claude (Réglages, Connecteurs)' && M.lvExplain({code: 'server_not_connected', message: 'x', server: 'Gmail'}) === 'ajoute Gmail dans Claude (Réglages, Connecteurs)');
  /* page-2#3 : la facture du mois ne remplace qu'UN prélèvement de son mois (les mêmes cas que le serveur, radar.mjs, lot A3) */
  const vu = (f, a, b) => P.radOcc(f, a, b).map((o) => P.radYmd(o.date) + ' ' + o.x.montant).join(' | ');
  const box = {service: 'Box Exemple', jour: 31, montant: 40, rythme: 'mensuel', prochain: {date: '2026-11-02', montant: 52}};
  const nov = vu(box, P.radD(2026, 10, 1), P.radD(2026, 10, 30)), nov30 = vu({...box, prochain: {date: '2026-11-30', montant: 45}}, P.radD(2026, 10, 1), P.radD(2026, 10, 30));
  ok('B1 page-2#3 : le 31 octobre (samedi) reporté au lundi 2 novembre, facture « 52 € le 02/11 » : novembre compte 52 € le 2 et 40 € le 30 (avant : 52 € deux fois)', nov === '2026-11-02 52 | 2026-11-30 40', nov);
  ok('B1 page-2#3 : la facture « 45 € le 30/11 » remplace celle du 30, pas celle du 2', nov30 === '2026-11-02 40 | 2026-11-30 45', nov30);
  const f28 = {service: 'Mobile Exemple', jour: 28, montant: 40, rythme: 'mensuel', prochain: {date: '2027-03-01', montant: 50}};
  const mars = vu(f28, P.radD(2027, 1, 20), P.radD(2027, 2, 31)), apres = vu(f28, P.radD(2027, 2, 2), P.radD(2027, 2, 31));
  ok('B1 page-2#3 : prélèvement du 28 (dimanche 28 février reporté au 1er mars ; 28 et 29 mars : dimanche et lundi de Pâques), facture du 01/03 : 50 € le 1er, 40 € le 30', mars === '2027-03-01 50 | 2027-03-30 40', mars);
  ok('B1 page-2#3 : vu après le 1er mars, la facture déjà passée ne déplace pas le prélèvement du 30 (40 €, toujours compté)', apres === '2027-03-30 40', apres);
  /* page-2#8 : Black Friday (lendemain du 4e jeudi de novembre) et soldes d'hiver (2e mercredi de janvier, ou le 1er si le 2e tombe après le 12) */
  const jm = (d) => P.radYmd(d).slice(5);
  const bf = [2025, 2026, 2027, 2028].map((y) => jm(P.bfDe(y))).join(' '), so = [2025, 2026, 2027, 2028].map((y) => jm(P.soldesDe(y))).join(' ');
  ok('B1 page-2#8 : Black Friday 2025 à 2028 : 28/11, 27/11, 26/11, 24/11 ; soldes d’hiver : 8/01, 7/01, 6/01, 12/01', bf === '11-28 11-27 11-26 11-24' && so === '01-08 01-07 01-06 01-12', bf + ' / ' + so);
  /* page-1#8, page-1#9 : les dates passées et les durées en français correct */
  const dits = ['moi', 'bot', 'suivi', 'offre', 'fin', 'date'].flatMap((nature) => [-3, -1].map((n) => P.NATSAY({nature, n})));
  ok('B1 page-1#8 : une échéance passée se dit au passé (plus « C’est à toi de jouer, il y a 3 jours », « je relance hier », « C’est il y a 3 jours »)', dits.every((t) => t && !/, il y a|, hier|relance (il y a|hier)|^C'est (il y a|hier)|se termine (il y a|hier)|expire (il y a|hier)/.test(t)) && dits[0] === "C'est à toi de jouer : en retard de 3 jours." && dits[1] === "C'est à toi de jouer : en retard de 1 jour.", JSON.stringify(dits));
  ok('B1 page-1#9 : « depuis hier », « depuis aujourd’hui », « depuis 12 jours » (plus « depuis 1 jours », « depuis 0 jours »)', P.depuisN(-1) === 'depuis hier' && P.depuisN(0) === "depuis aujourd'hui" && P.depuisN(-12) === 'depuis 12 jours');
  /* page-1#2 : seul un lien http(s) s'ouvre ; le lien d'une échéance vient de sa remarque, du papier ou du prix suivi qui lui correspond */
  ok('B1 page-1#2 : un lien « javascript: » ou vide ne s’ouvre jamais ; un lien en fin de phrase est nettoyé', P.lienSur('javascript:alert(1)') === '' && P.lienSur('') === '' && P.lienSur('voir https://exemple.fr/offre). Merci') === 'https://exemple.fr/offre' && P.lienSur('Marque Alpha https://example.org/x7') === 'https://example.org/x7');
  const Q = page(true, {papiers: [{name: 'Attestation assurance', url: 'https://drive.google.com/file/d/essai/view'}, {name: 'Passeport', url: ''}], prix: [{name: 'Robot Alpha X7', offer: {text: 'Robot Alpha : offre de lancement : cadeau'}, last: {where: 'Marque Alpha https://example.org/x7'}}]});
  ok('B1 page-1#2 : fin de validité → le papier du même nom ; offre → le prix suivi lié ; sinon rien (pas de bouton qui ne fait rien)', Q.lienEch({title: "Fin de validité de l'attestation d'assurance", note: ''}, 'fin') === 'https://drive.google.com/file/d/essai/view'
    && Q.lienEch({title: 'Robot Alpha : offre de lancement', note: 'cadeau'}, 'offre') === 'https://example.org/x7' && Q.lienEch({title: 'Black Friday', note: 'Offres à surveiller'}, 'offre') === '' && Q.lienEch({title: 'Fin de validité du passeport', note: ''}, 'fin') === ''
    && Q.lienEch({title: 'Black Friday', note: 'page https://exemple.fr/bf'}, 'offre') === 'https://exemple.fr/bf');
} catch (e) { ok('exception', false, e.stack); }
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
