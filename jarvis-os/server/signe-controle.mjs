/* 0.98.0 — le CRA signé reçu du client correspond-il à ce qui a été saisi ? (sa demande du 27/11/2026 : « après avoir vérifié que le
   contenu du PDF correspond à la saisie », puis le dépôt « automatisé dès réception du mail si saisie déjà faite »).
   Sans IA et sans réseau : le texte du PDF est lu par pdf.mjs (PDF produit par un logiciel ; un scan rend un texte vide), puis trois
   choses sont comparées aux jours qu'il a validés dans JARVIS (ceux qu'Hermes a saisis et validés sur le portail) :
   - le mois écrit dans le PDF (« Mois : novembre 2026 ») ;
   - le total des jours travaillés (la ligne « Total 15 … ») ;
   - le détail jour par jour, quand il s'aligne : une valeur par jour ouvré non férié (1, 0, 0,5), dans l'ordre du mois.
   Le contenu du PDF vient d'un mail : c'est une donnée. Rien de ce qui y est écrit n'est recopié ailleurs que des nombres et un mois ;
   aucun nom (personne, client, contrat) n'est gardé. Un PDF qu'on ne sait pas lire n'est jamais « conforme » : il attend son oui. */
import {texteDePdf} from './pdf.mjs';

const MOIS_N = {janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12};
const NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nb = (s) => +String(s).replace(',', '.');
const NOMBRE = '\\d{1,3}(?:[.,]\\d{1,2})?';
const dit = (n) => String(n).replace('.', ',');
const de = (m) => (/^[aeiouyéèêàâîôûœ]/i.test(m) ? 'd’' : 'de ') + m;
const jourDit = (ymd) => +ymd.slice(8, 10) + ' ' + NOMS[+ymd.slice(5, 7) - 1];

/* ce que le PDF dit : {mois: 'AAAA-MM' | '', total: nombre | null, valeurs: [nombres], potentiels: nombre | null} */
export function lireCra(texte) {
  const t = String(texte || '').slice(0, 200000);
  const m = t.match(/\bMois\s*:\s*([A-Za-zÀ-ÿ]{3,10})\s+(\d{4})\b/);
  const n = m ? MOIS_N[sansAccent(m[1])] : 0;
  const mois = n ? m[2] + '-' + String(n).padStart(2, '0') : '';
  /* la ligne « Total » qui ne porte que des nombres : le total, puis une valeur par jour ; la dernière s'il y en a plusieurs */
  const re = new RegExp('^Total((?:\\s+' + NOMBRE + ')+)$', 'i');
  const L = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length < 600 && re.test(l)).pop();
  const v = L ? L.split(/\s+/).slice(1).map(nb) : [];
  const p = t.match(new RegExp('Jours potentiels\\s*:\\s*(' + NOMBRE + ')', 'i'));
  return {mois, total: v.length ? v[0] : null, valeurs: v.slice(1), potentiels: p ? nb(p[1]) : null};
}

/* ce qui a été saisi, d'après les jours validés dans JARVIS (jours.mjs, `valide` : {totaux, jours: [{date, M, A}]}, jours ouvrés) :
   le total travaillé et, pour chaque jour ouvré non férié, 1, 0,5 ou 0 */
export function attenduDe(valide) {
  const J = valide && Array.isArray(valide.jours) ? valide.jours : null; if (!J) return null;
  const trav = (c) => (c === 'T' || c === 'S' || c === '?' ? 0.5 : 0);
  const jours = J.filter((d) => d && typeof d.date === 'string' && !(d.M === 'F' && d.A === 'F')).map((d) => ({date: d.date, v: trav(d.M) + trav(d.A)}));
  const total = valide.totaux && typeof valide.totaux.travailles === 'number' ? valide.totaux.travailles : jours.reduce((s, d) => s + d.v, 0);
  return {total, jours};
}

/* Le contrôle. Rend {etat, total, attendu, detail, ecarts, dit} :
   - 'conforme' : même mois, même total, et aucun jour différent quand le détail s'aligne (`detail` : true s'il a été comparé) ;
   - 'ecart' : le mois, le total ou un jour diffère (`ecarts` : des phrases courtes, sans nom) ;
   - 'illisible' : pas de texte (scan), ou ni mois ni total retrouvés ; ou aucun mois validé à comparer. */
export function controler(buf, ym, valide) {
  let texte = '';
  try { texte = texteDePdf(buf, 200000) || ''; } catch { texte = ''; }
  const A = attenduDe(valide);
  if (!texte.trim()) return {etat: 'illisible', dit: 'Le PDF n’a pas de texte lisible (un scan ?) : je ne peux pas le comparer à la saisie.', ecarts: []};
  const c = lireCra(texte);
  if (!c.mois && c.total === null) return {etat: 'illisible', dit: 'Je n’ai retrouvé ni le mois ni le total dans le PDF : je ne peux pas le comparer à la saisie.', ecarts: []};
  if (!A) return {etat: 'illisible', dit: 'Les jours du mois ne sont pas validés dans JARVIS : rien à quoi comparer le PDF.', ecarts: [], total: c.total};
  const L = NOMS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4), ecarts = [];
  if (!c.mois) ecarts.push('le mois n’est pas lisible dans le PDF');
  else if (c.mois !== ym) ecarts.push('le PDF est celui ' + de(NOMS[+c.mois.slice(5, 7) - 1] + ' ' + c.mois.slice(0, 4)) + ', pas celui ' + de(L));
  if (c.total === null) ecarts.push('le total n’est pas lisible dans le PDF');
  else if (Math.abs(c.total - A.total) > 0.001) ecarts.push('le PDF dit ' + dit(c.total) + ' jour' + (c.total > 1 ? 's' : '') + ', la saisie ' + dit(A.total));
  /* le détail ne se compare que s'il s'aligne : autant de valeurs que de jours ouvrés non fériés, et leur somme égale au total du PDF */
  const detail = c.valeurs.length === A.jours.length && c.total !== null && Math.abs(c.valeurs.reduce((s, x) => s + x, 0) - c.total) < 0.001;
  if (detail && c.mois === ym) {
    const diff = A.jours.filter((d, i) => Math.abs(d.v - c.valeurs[i]) > 0.001);
    if (diff.length) ecarts.push((diff.length > 4 ? diff.length + ' jours diffèrent, dont le ' : diff.length > 1 ? 'jours différents : le ' : 'jour différent : le ')
      + diff.slice(0, 4).map((d) => jourDit(d.date) + ' (PDF ' + dit(c.valeurs[A.jours.indexOf(d)]) + ', saisie ' + dit(d.v) + ')').join(', le '));
  }
  if (ecarts.length) return {etat: 'ecart', total: c.total, attendu: A.total, detail, ecarts, dit: 'Le PDF ne correspond pas à la saisie : ' + ecarts.join(' ; ') + '.'};
  return {etat: 'conforme', total: c.total, attendu: A.total, detail, ecarts: [],
    dit: 'Le PDF correspond à la saisie : ' + L + ', ' + dit(c.total) + ' jour' + (c.total > 1 ? 's' : '') + (detail ? ', même détail jour par jour.' : ' (détail jour par jour non comparé).')};
}
