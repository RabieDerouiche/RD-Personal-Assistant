/* JARVIS OS — Pilotage hébergé par JARVIS (0.88.0 ; son choix du 26/11/2026, QCM « JARVIS seule source »).
   Après l'arrêt de Grok Bot (3/12/2026), Pilotage ne sert plus qu'à JARVIS et à Hermes : ses onglets sont gardés ici, dans un fichier
   du serveur (pilotage.json, droits 600, écrit d'un coup : fichier à côté puis renommé, jamais lu à travers un lien), et le classeur
   Google devient une archive que plus rien n'écrit. Ce module imite les trois outils de Google Sheets qu'emploient l'app, le serveur et
   les outils d'Hermes (get_values, append_values, update_values), avec les mêmes plages A1 et des réponses de même forme : le reste du
   serveur ne change pas. Une valeur reste toujours un texte (« =… » n'est jamais une formule) ; seuls les deux calculs du classeur sont
   refaits, à la lecture : l'onglet « À toi » (Canal et Dossiers, formule du classeur reprise telle quelle) et la colonne D de Prix
   (« Seuil Bon prix » = prix de référence moins la remise de B1). Une copie chiffrée part chaque nuit dans Drive (createCopieDrive) :
   AES-256-GCM, clé tirée par scrypt d'une phrase de passe qu'il tape lui-même dans Termius ; sans la phrase, la copie est illisible. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const FORMAT = 'jarvis-pilotage', FORMAT_CLE = 'jarvis-pilotage-cle', FORMAT_COPIE = 'jarvis-pilotage-chiffre';
export const MAX_CELLULE = 50000, MAX_LIGNES = 20000, MAX_COLONNES = 52;   /* comme Google Sheets (50 000 caractères par case) ; colonnes A à AZ */
const MAX_OCTETS = +process.env.JARVIS_PILOTAGE_MAX_OCTETS || 32 * 1024 * 1024;
export const A_TOI = 'À toi';
const A_TOI_DEFAUT = [['Ce qui attend ta réponse'], ['Calculé à partir des onglets Canal (questions des bots) et Dossiers (colonne « En attente de ») : ne rien saisir ici. Réponds dans le chat du bot indiqué.'],
  ['Depuis le', 'Bot', 'Sujet', "Ce qu'on attend de toi"]];
export const SCRYPT = {N: 1 << 17, r: 8, p: 1};   /* 128 Mo de mémoire, environ une demi-seconde : à chaque essai de phrase */
const KDF_MAX = {N: 1 << 20, r: 16, p: 4};          /* une copie piégée ne doit pas faire tirer une clé sans fin */
export const COPIES_GARDEES = 30;

export class PilotageErreur extends Error { constructor(message, code = 'tool_error', status = 400) { super(message); this.code = code; this.status = status; } }
const err = (m, code, status) => new PilotageErreur(m, code, status);
const vide = (v) => v === undefined || v === null || v === '';

/* ---------- plages A1 (« 'À toi'!A3:D300 », « Journal!A1:H », « Canal!A:A », « Tâches!D5 », « Faits ») ---------- */
export const colN = (c) => [...String(c).toUpperCase()].reduce((n, x) => n * 26 + x.charCodeAt(0) - 64, 0) - 1;
export const colL = (i) => { let s = ''; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
/* le nom d'onglet tel que Google l'écrit dans ses réponses : entre apostrophes dès qu'il a autre chose que des lettres simples */
export const nomPlage = (nom) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nom) ? nom : "'" + String(nom).replace(/'/g, "''") + "'");
export function lirePlage(range) {
  const s = String(range ?? '').trim(); if (!s || s.length > 300) throw err('Plage illisible.');
  let nom, ref = '';
  if (s[0] === "'") {
    let i = 1, n = '';
    for (; i < s.length; i++) { if (s[i] === "'") { if (s[i + 1] === "'") { n += "'"; i++; continue; } break; } n += s[i]; }
    if (i >= s.length) throw err('Plage illisible : apostrophe non fermée.');
    nom = n; const reste = s.slice(i + 1);
    if (reste) { if (reste[0] !== '!') throw err('Plage illisible : ' + s.slice(0, 60)); ref = reste.slice(1); }
  } else { const k = s.lastIndexOf('!'); if (k < 0) nom = s; else { nom = s.slice(0, k); ref = s.slice(k + 1); } }
  if (!nom) throw err('Plage illisible : nom d’onglet absent.');
  if (!ref) return {nom, c1: 0, l1: 1, c2: Infinity, l2: Infinity};
  const m = /^([A-Za-z]{1,3})?(\d{1,7})?(?::([A-Za-z]{1,3})?(\d{1,7})?)?$/.exec(ref), deux = ref.includes(':');
  if (!m || (!m[1] && !m[2]) || (deux && !m[3] && !m[4]) || (!deux && !(m[1] && m[2]))) throw err('Plage illisible : ' + ref.slice(0, 30));
  let c1 = m[1] ? colN(m[1]) : 0, l1 = m[2] ? +m[2] : 1, c2 = deux ? (m[3] ? colN(m[3]) : Infinity) : c1, l2 = deux ? (m[4] ? +m[4] : Infinity) : l1;
  if (l1 < 1 || l2 < 1) throw err('Plage illisible : la première ligne est la ligne 1.');
  if (c2 < c1) [c1, c2] = [c2, c1]; if (l2 < l1) [l1, l2] = [l2, l1];
  return {nom, c1, l1, c2, l2};
}

/* ---------- les cases : toujours du texte, comme les valeurs affichées de Google (FORMATTED_VALUE) ---------- */
function cellule(v, saisie) {
  if (v === undefined || v === null) return undefined;   /* null : la case n'est pas touchée (comme Google) */
  if (typeof v === 'number') { if (!isFinite(v)) throw err('Valeur illisible (nombre infini).'); return String(v).replace('.', ','); }   /* un nombre s'affiche à la française */
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v !== 'string') throw err('Valeur illisible : texte, nombre ou vide seulement.');
  const t = saisie === 'RAW' ? v : v.replace(/^'/, '');   /* USER_ENTERED : l'apostrophe de tête force le texte chez Google, elle n'est pas gardée */
  if (t.length > MAX_CELLULE) throw err('Case trop longue : ' + MAX_CELLULE + ' caractères au plus.');
  return t;
}
function nettoyer(rows) {
  for (const r of rows) while (r.length && vide(r[r.length - 1])) r.pop();
  while (rows.length && !rows[rows.length - 1].length) rows.pop();
  return rows;
}
function tranche(grille, p) {
  const l2 = Math.min(p.l2, grille.length), out = [];
  for (let l = p.l1; l <= l2; l++) {
    const r = grille[l - 1] || [], c2 = Math.min(p.c2, r.length - 1), x = [];
    for (let c = p.c1; c <= c2; c++) x.push(r[c] ?? '');
    while (x.length && x[x.length - 1] === '') x.pop();
    out.push(x);
  }
  while (out.length && !out[out.length - 1].length) out.pop();
  return out;
}
const plageDite = (nom, p, grille) => {
  const larg = grille.reduce((n, r) => Math.max(n, r.length), 1), c2 = isFinite(p.c2) ? p.c2 : Math.max(p.c1, larg - 1), l2 = isFinite(p.l2) ? p.l2 : Math.max(p.l1, grille.length);
  return nomPlage(nom) + '!' + colL(p.c1) + p.l1 + ':' + colL(c2) + l2;
};
export const empreinte = (rows) => crypto.createHash('sha256').update(JSON.stringify(rows || [])).digest('hex').slice(0, 16);

/* ---------- « À toi » : la formule du classeur (onglet « À toi », B1 et A4), refaite à l'identique ----------
   Canal Pour = Rabie et Statut « À faire » → Date, De, Type, Message ; Dossiers « En attente de » contient « Rabie » et Statut ≠ « Fait »
   → Mis à jour le, Bot, Dossier, Prochaine étape ; Canal « Attend ton oui » → Date, le bot, Type, « Ton oui dans le chat de <bot> : Réponse ».
   Les lignes sans « Sujet » (3e colonne) sont écartées ; comparaisons sans la casse, comme Google. Ordre : par date (chronologique,
   que la date ait été écrite en texte ou en date), puis dans l'ordre du classeur. */
const egal = (a, b) => String(a ?? '').toLocaleLowerCase('fr') === String(b).toLocaleLowerCase('fr');
const contient = (t, m) => String(t ?? '').toLocaleLowerCase('fr').includes(String(m).toLocaleLowerCase('fr'));
const cleDate = (s) => { const t = String(s ?? ''), m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2})\D(\d{2}))?/.exec(t);
  return m ? [0, +m[3] * 1e8 + +m[2] * 1e6 + +m[1] * 1e4 + (+m[4] || 0) * 100 + (+m[5] || 0)] : t === '' ? [2, 0] : [1, t]; };
export function construireAtoi(store) {
  const o = store.onglets, canal = o.Canal || [], dos = o.Dossiers || [], st = o[A_TOI] || [], c = (r, i) => String(r[i] ?? '');
  const t = [];
  canal.slice(1).forEach((r) => { if (egal(r[2], 'Rabie') && egal(r[5], 'À faire')) t.push([c(r, 0), c(r, 1), c(r, 3), c(r, 4)]); });
  dos.slice(1).forEach((r) => { if (contient(r[4], 'Rabie') && !egal(r[1], 'Fait')) t.push([c(r, 8), c(r, 7), c(r, 0), c(r, 2)]); });
  canal.slice(1).forEach((r) => { if (egal(r[5], 'Attend ton oui')) { const qui = egal(r[2], 'Rabie') ? c(r, 1) : c(r, 2); t.push([c(r, 0), qui, c(r, 3), 'Ton oui dans le chat de ' + qui + ' : ' + c(r, 6)]); } });
  const r = t.map((x, i) => ({x, i, k: cleDate(x[0])})).filter((y) => y.x[2] !== '')
    .sort((a, b) => a.k[0] - b.k[0] || (a.k[0] === 1 ? String(a.k[1]).localeCompare(String(b.k[1]), 'fr') : a.k[1] - b.k[1]) || a.i - b.i).map((y) => y.x);
  let n = 0;   /* B1 : COUNTIFS(Canal Rabie, À faire) + COUNTIF(Attend ton oui) + Dossiers lignes 2 à 206 (« Rabie », pas Fait, Dossier rempli) */
  canal.slice(1).forEach((x) => { if (egal(x[2], 'Rabie') && egal(x[5], 'À faire')) n++; if (egal(x[5], 'Attend ton oui')) n++; });
  dos.slice(1, 206).forEach((x) => { if (contient(x[4], 'Rabie') && !egal(x[1], 'Fait') && !vide(x[0])) n++; });
  const l1 = [String((st[0] || [])[0] || A_TOI_DEFAUT[0][0]), n + ' en attente'];
  const l2 = st[1] && st[1].length ? st[1].slice(0, 4).map(String) : A_TOI_DEFAUT[1].slice(), l3 = st[2] && st[2].length ? st[2].slice(0, 4).map(String) : A_TOI_DEFAUT[2].slice();
  return nettoyer([l1, l2, l3, ...(r.length ? r : [["Rien ne t'attend."]])]);
}

/* ---------- Prix, colonne D : =IF(B="";"";ROUND(B*(1-$B$1);2)), au format du prix de référence ---------- */
export const nombre = (s) => { const t = String(s ?? '').replace(/[\s  €$]/g, '').replace(',', '.'); if (!/^-?\d+(\.\d+)?%?$/.test(t)) return null; const v = parseFloat(t); return t.endsWith('%') ? v / 100 : v; };
export function formatComme(n, modele, sepDefaut = ' ') {
  const m = String(modele ?? ''), dec = (/,(\d+)/.exec(m) || [])[1], nd = dec ? dec.length : 2;
  const sep = (/\d([^\d,])\d{3}(?:\D|$)/.exec(m) || [])[1] || sepDefaut, suf = (/\d(\D*)$/.exec(m) || [])[1] || '', pre = (/^([^\d-]*)/.exec(m) || [])[1] || '';
  const [ent, fr] = Math.abs(n).toFixed(nd).split('.');
  return (n < 0 ? '-' : '') + pre + ent.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (fr ? ',' + fr : '') + suf;
}
const arrondi2 = (x) => Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-7) / 100;
const FORMULE_PRIX_D = /^=IF\(B(\d+)\s*=\s*""\s*[;,]\s*""\s*[;,]\s*ROUND\(B\1\s*\*\s*\(1\s*-\s*\$B\$1\)\s*[;,]\s*2\)\)$/i;
function grillePrix(store) {
  const rows = (store.onglets.Prix || []).map((r) => r.slice()), cal = store.calcules && store.calcules.Prix;
  if (!cal) return rows;
  const remise = nombre((rows[0] || [])[1]), lignes = new Set(cal.lignes || []), jusqua = +cal.jusqua || 0;
  const sep = (rows.slice(3).map((r) => (/\d([^\d,])\d{3}(?:\D|$)/.exec(String(r[1] ?? '')) || [])[1]).find(Boolean)) || ' ';
  for (let l = 4; l <= rows.length; l++) {
    const r = rows[l - 1]; if (!r) continue;
    if (!(lignes.has(l) || (l > jusqua && vide(r[3]) && !vide(r[1])))) continue;
    const b = nombre(r[1]); while (r.length < 4) r.push('');
    r[3] = vide(r[1]) ? '' : b === null || remise === null ? '#VALUE!' : formatComme(arrondi2(b * (1 - remise)), r[1], sep);
  }
  return nettoyer(rows);
}
export function grille(store, nom) { return nom === A_TOI ? construireAtoi(store) : nom === 'Prix' ? grillePrix(store) : store.onglets[nom] || []; }

/* ---------- le magasin : construction (import), validation, fichier ---------- */
/* formules : {onglet: [[« D4 », « =IF(… »], …]} (lues dans le classeur à l'import) ; seules « À toi » et Prix D sont refaites, les autres
   sont gardées en valeur (dites dans le compte rendu de l'import) */
export function construireMagasin({onglets, ordre, formules = {}, source = '', at = Date.now()}) {
  const o = {}, noms = ordre && ordre.length ? ordre : Object.keys(onglets);
  for (const nom of noms) {
    const rows = (onglets[nom] || []).map((r) => (Array.isArray(r) ? r : []).map((v) => (vide(v) ? '' : String(v))));
    o[nom] = nettoyer(nom === A_TOI ? rows.slice(0, 3) : rows);
  }
  const prixD = [], figees = [];
  for (const [nom, liste] of Object.entries(formules || {})) for (const [a1, f] of liste || []) {
    if (nom === A_TOI) continue;
    const m = /^([A-Z]+)(\d+)$/.exec(a1), mf = FORMULE_PRIX_D.exec(String(f || ''));
    if (nom === 'Prix' && m && m[1] === 'D' && mf && mf[1] === m[2]) prixD.push(+m[2]); else figees.push(nom + '!' + a1);
  }
  const store = {format: FORMAT, v: 1, ordre: noms.slice(), onglets: o, calcules: {}, importe: {at, source, comptes: {}, empreintes: {}, figees: figees.slice(0, 200)}, local: null};
  if (prixD.length) store.calcules.Prix = {colonne: 'D', lignes: prixD.sort((a, b) => a - b), jusqua: (o.Prix || []).length};
  for (const nom of noms) { store.importe.comptes[nom] = o[nom].filter((r) => r.some((x) => x !== '')).length; store.importe.empreintes[nom] = empreinte(o[nom]); }
  return store;
}
export function validerMagasin(j) {
  if (!j || typeof j !== 'object' || j.format !== FORMAT || j.v !== 1 || !j.onglets || typeof j.onglets !== 'object' || Array.isArray(j.onglets)) throw err('Ce fichier n’est pas un magasin de Pilotage.');
  if (!j.importe || !j.importe.at) throw err('Magasin de Pilotage sans import.');
  const o = {};
  for (const [nom, rows] of Object.entries(j.onglets)) {
    if (!Array.isArray(rows) || rows.length > MAX_LIGNES || nom.length > 100) throw err('Magasin de Pilotage abîmé (onglet ' + nom.slice(0, 40) + ').');
    o[nom] = rows.map((r) => (Array.isArray(r) ? r.slice(0, MAX_COLONNES).map((v) => (vide(v) ? '' : String(v))) : []));
  }
  return {format: FORMAT, v: 1, ordre: Array.isArray(j.ordre) ? j.ordre.filter((x) => Object.hasOwn(o, x)) : Object.keys(o), onglets: o,
    calcules: j.calcules && typeof j.calcules === 'object' ? j.calcules : {}, importe: j.importe, local: j.local && j.local.depuis ? {depuis: +j.local.depuis} : null};
}
/* lu sans suivre de lien (O_NOFOLLOW), fichier ordinaire seulement */
export function lireFichierSur(f, max) {
  const fd = fs.openSync(f, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const st = fs.fstatSync(fd); if (!st.isFile()) throw err('pas un fichier ordinaire');
    if (max && st.size > max) throw err('fichier trop gros');
    const b = Buffer.alloc(st.size); let o = 0; while (o < st.size) { const n = fs.readSync(fd, b, o, st.size - o, o); if (!n) break; o += n; }
    return b.subarray(0, o);
  } finally { fs.closeSync(fd); }
}
/* écrit d'un coup : un fichier à côté (créé neuf, sans suivre de lien, 600, vidé sur le disque), puis renommé ; jamais par-dessus un lien */
export function ecrireFichierSur(f, contenu, mode = 0o600) {
  const tmp = path.join(path.dirname(f), '.' + path.basename(f) + '.' + process.pid + '.tmp');
  try { const st = fs.lstatSync(f); if (!st.isFile()) throw err(path.basename(f) + ' n’est pas un fichier ordinaire (lien ?) : rien n’est écrit.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  try { fs.unlinkSync(tmp); } catch { /* aucun reste */ }
  const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, mode);
  try { fs.writeSync(fd, typeof contenu === 'string' ? contenu : Buffer.from(contenu)); fs.fsyncSync(fd); } catch (e) { fs.closeSync(fd); try { fs.unlinkSync(tmp); } catch { /* rien */ } throw e; }
  fs.closeSync(fd); fs.chmodSync(tmp, mode); fs.renameSync(tmp, f);
}
export function lireMagasin(f) { return validerMagasin(JSON.parse(lireFichierSur(f, MAX_OCTETS * 2).toString('utf8'))); }
export function ecrireMagasin(f, store) { const t = JSON.stringify(store); if (t.length > MAX_OCTETS) throw err('Pilotage dépasse ' + Math.round(MAX_OCTETS / 1048576) + ' Mo : rien n’est écrit.'); ecrireFichierSur(f, t); return t; }

/* ---------- l'outil, pour le serveur ---------- */
export function createPilotageLocal({fichier, now = Date.now, log = () => {}}) {
  let mode = 'google', probleme = '', avertissement = '', store = null, texte = '';
  function demarrer(demande, marque) {
    mode = 'google'; probleme = ''; avertissement = ''; store = null; texte = '';
    if (!demande) return etat();
    let b;
    try { b = lireFichierSur(fichier, MAX_OCTETS * 2); }
    catch (e) {
      if (e.code === 'ENOENT' && !(marque && marque.depuis)) { avertissement = 'JARVIS_PILOTAGE=local, mais Pilotage n’est pas encore importé : il reste dans Google en attendant (node server.mjs pilotage importer).'; log('[pilotage] ' + avertissement); return etat(); }
      mode = 'erreur'; probleme = e.code === 'ENOENT' ? 'pilotage.json a disparu alors que JARVIS l’héberge' : e.code === 'ELOOP' ? 'pilotage.json est un lien' : 'pilotage.json illisible (' + (e.code || e.message) + ')';
      log('[pilotage] ' + probleme + ' : rien n’est lu ni écrit.'); return etat();
    }
    try { store = validerMagasin(JSON.parse(b.toString('utf8'))); } catch (e) { mode = 'erreur'; probleme = 'pilotage.json abîmé (' + e.message + ')'; store = null; log('[pilotage] ' + probleme); return etat(); }
    mode = 'local';
    if (!store.local) { store.local = {depuis: now()}; texte = ecrireMagasin(fichier, store); } else texte = JSON.stringify(store);
    return etat();
  }
  const actif = () => mode === 'local' || mode === 'erreur';
  const etat = () => ({mode, probleme, avertissement, depuis: store && store.local ? store.local.depuis : 0, importe: store ? store.importe.at : 0,
    onglets: store ? Object.fromEntries(store.ordre.map((n) => [n, grille(store, n).filter((r) => r.some((x) => x !== '')).length])) : {}, octets: texte.length});
  const trouver = (nom) => { const o = store.onglets; if (Object.hasOwn(o, nom)) return nom; const k = Object.keys(o).find((x) => x.toLocaleLowerCase('fr') === String(nom).toLocaleLowerCase('fr')); if (k) return k; throw err('Onglet inconnu dans Pilotage : ' + String(nom).slice(0, 60) + '.'); };
  /* une écriture : les valeurs sont toutes vérifiées avant d'écrire ; le fichier est réécrit aussitôt ; s'il ne peut pas l'être, rien ne change */
  function ecrire(nom, l1, c1, valeurs, saisie, p) {
    if (nom === A_TOI) throw err('« À toi » est calculé à partir du Canal et des Dossiers : personne n’y écrit.');
    if (!Array.isArray(valeurs) || !valeurs.length || !valeurs.every(Array.isArray)) throw err('« values » : un tableau de lignes.');
    if (l1 - 1 + valeurs.length > MAX_LIGNES) throw err('Onglet ' + nom + ' : ' + MAX_LIGNES + ' lignes au plus.');
    const bloc = valeurs.map((vr) => { if (c1 + vr.length > MAX_COLONNES) throw err('Onglet ' + nom + ' : colonnes A à ' + colL(MAX_COLONNES - 1) + ' seulement.'); return vr.map((v) => cellule(v, saisie)); });
    if (p && p.c2 !== undefined && isFinite(p.c2) && p.c2 > p.c1 && bloc.some((r) => c1 + r.length - 1 > p.c2)) throw err('Les valeurs dépassent la plage ' + colL(p.c1) + ':' + colL(p.c2) + '.');
    if (p && isFinite(p.l2) && p.l2 > p.l1 && l1 + bloc.length - 1 > p.l2) throw err('Les valeurs dépassent la plage (lignes ' + p.l1 + ' à ' + p.l2 + ').');
    const avant = texte, rows = store.onglets[nom]; let n = 0, w = 0;
    bloc.forEach((vr, i) => {
      const l = l1 - 1 + i; while (rows.length <= l) rows.push([]);
      const r = rows[l];
      vr.forEach((x, k) => { if (x === undefined) return; while (r.length < c1 + k) r.push(''); r[c1 + k] = x; n++;
        if (nom === 'Prix' && c1 + k === 3 && store.calcules.Prix) store.calcules.Prix.lignes = (store.calcules.Prix.lignes || []).filter((y) => y !== l + 1); });   /* écrire sur une formule la remplace, comme chez Google */
      w = Math.max(w, vr.length);
    });
    nettoyer(rows);
    try { texte = ecrireMagasin(fichier, store); }
    catch (e) { store = validerMagasin(JSON.parse(avant)); texte = avant; throw err('Pilotage n’a pas pu être écrit sur le serveur (' + e.message + ') : rien n’a changé.', 'tool_error', 503); }
    const plage = nomPlage(nom) + '!' + colL(c1) + l1 + ':' + colL(c1 + Math.max(w, 1) - 1) + (l1 + bloc.length - 1);
    return {updatedRange: plage, updatedRows: bloc.length, updatedColumns: w, updatedCells: n};
  }
  function tool(name, input) {
    const i = input || {};
    if (mode === 'erreur') throw err('Pilotage hébergé par JARVIS est indisponible : ' + probleme + '. Rien n’est lu ni écrit ; la session du serveur le restaure (docs/jarvis-os-reprise.md, « Pilotage hébergé par JARVIS »).', 'tool_error', 503);
    if (mode !== 'local') throw err('Pilotage n’est pas hébergé par JARVIS.', 'tool_error', 500);
    if (!['get_values', 'append_values', 'update_values'].includes(name)) throw err('Google Sheets · ' + name + ' : pas dans Pilotage hébergé par JARVIS.', 'not_in_manifest', 404);
    const p = lirePlage(i.range), nom = trouver(p.nom), saisie = i.valueInputOption === 'RAW' ? 'RAW' : 'USER_ENTERED';
    if (name === 'get_values') { const g = grille(store, nom); return {range: plageDite(nom, p, g), majorDimension: 'ROWS', values: tranche(g, p)}; }
    if (name === 'update_values') return {spreadsheetId: i.spreadsheetId, ...ecrire(nom, p.l1, p.c1, i.values, saisie, p)};
    /* append_values : après la dernière ligne remplie de l'onglet, à partir de la colonne de la plage */
    const u = ecrire(nom, store.onglets[nom].length + 1, p.c1, i.values, saisie, null);
    return {spreadsheetId: i.spreadsheetId, tableRange: plageDite(nom, {c1: 0, l1: 1, c2: Infinity, l2: Infinity}, store.onglets[nom]), updates: {spreadsheetId: i.spreadsheetId, ...u}};
  }
  /* une copie complète (sauvegarde chiffrée) : jamais l'objet vivant */
  const instantane = () => (texte ? JSON.parse(texte) : null);
  return {demarrer, actif, etat, tool, instantane, mode: () => mode};
}

/* ---------- la clé et les copies chiffrées ---------- */
const controle = (cle) => crypto.createHmac('sha256', cle).update('jarvis-pilotage-controle').digest('base64').slice(0, 16);
const kdfSur = (k) => !!k && k.algo === 'scrypt' && Number.isInteger(k.N) && k.N >= 1024 && k.N <= KDF_MAX.N && (k.N & (k.N - 1)) === 0 && Number.isInteger(k.r) && k.r >= 1 && k.r <= KDF_MAX.r && Number.isInteger(k.p) && k.p >= 1 && k.p <= KDF_MAX.p && typeof k.sel === 'string' && Buffer.from(k.sel, 'base64').length === 16;
export function deriverCle(phrase, sel, kdf = SCRYPT) {
  return crypto.scryptSync(Buffer.from(String(phrase).normalize('NFC'), 'utf8'), sel, 32, {N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 160 * kdf.N * kdf.r + 1048576});
}
/* la clé : tirée de sa phrase (12 caractères au moins), gardée sur le serveur (600) ; la phrase n'est jamais écrite */
export function creerCle(phrase, kdf = SCRYPT) {
  if (String(phrase).length < 12) throw err('La phrase de passe doit faire au moins 12 caractères.');
  const sel = crypto.randomBytes(16), cle = deriverCle(phrase, sel, kdf);
  return {format: FORMAT_CLE, v: 1, kdf: {algo: 'scrypt', N: kdf.N, r: kdf.r, p: kdf.p, sel: sel.toString('base64')}, cle: cle.toString('base64'), controle: controle(cle), at: Date.now()};
}
export function lireCle(f) {
  let j; try { j = JSON.parse(lireFichierSur(f, 4096).toString('utf8')); } catch (e) { if (e.code === 'ENOENT') throw err('Aucune phrase de passe posée pour les copies chiffrées.', 'sans_cle'); throw err('Fichier de clé illisible (' + (e.code || e.message) + ').', 'cle_abimee'); }
  const cle = j && j.format === FORMAT_CLE && kdfSur(j.kdf) ? Buffer.from(String(j.cle || ''), 'base64') : Buffer.alloc(0);
  if (cle.length !== 32 || controle(cle) !== j.controle) throw err('Fichier de clé abîmé : repose la phrase de passe.', 'cle_abimee');
  return {cle, kdf: j.kdf};
}
export function chiffrer(objet, {cle, kdf}, at = Date.now()) {
  const iv = crypto.randomBytes(12), entete = {format: FORMAT_COPIE, v: 1, kdf, at};
  const c = crypto.createCipheriv('aes-256-gcm', cle, iv); c.setAAD(Buffer.from(JSON.stringify(entete)));
  const donnees = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(JSON.stringify(objet)))), c.final()]);
  return Buffer.from(JSON.stringify({...entete, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), donnees: donnees.toString('base64')}));
}
/* avec sa phrase (restauration, sur ce serveur ou un autre) ou avec la clé du serveur ; phrase fausse ou copie retouchée : refusé */
export function dechiffrer(octets, {phrase, cle} = {}) {
  let j; try { j = JSON.parse(Buffer.from(octets).toString('utf8')); } catch { j = null; }
  if (!j || j.format !== FORMAT_COPIE || j.v !== 1 || !kdfSur(j.kdf) || typeof j.iv !== 'string' || typeof j.tag !== 'string' || typeof j.donnees !== 'string') throw err('Ce fichier n’est pas une copie chiffrée de Pilotage.');
  const k = cle || deriverCle(phrase ?? '', Buffer.from(j.kdf.sel, 'base64'), j.kdf), iv = Buffer.from(j.iv, 'base64'), tag = Buffer.from(j.tag, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw err('Copie chiffrée abîmée.');
  let plain;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, iv); d.setAAD(Buffer.from(JSON.stringify({format: j.format, v: j.v, kdf: j.kdf, at: j.at}))); d.setAuthTag(tag);
    plain = Buffer.concat([d.update(Buffer.from(j.donnees, 'base64')), d.final()]);
  } catch { throw err('Phrase de passe fausse, ou copie abîmée : rien n’est restauré.', 'phrase_fausse'); }
  return {at: j.at, store: validerMagasin(JSON.parse(zlib.gunzipSync(plain, {maxOutputLength: MAX_OCTETS * 2}).toString('utf8')))};
}
const ymdParis = (ms) => new Intl.DateTimeFormat('fr-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(ms));
export const nomCopie = (ms) => 'pilotage-' + ymdParis(ms) + '.jarvis';

/* ---------- la copie chiffrée de chaque nuit dans Drive (dossier « Sauvegardes JARVIS », 30 copies) ----------
   drive : {portee() → 'oui' | 'non' | 'inconnue', dossier(nom, parent), lister(id), envoyer({dossier, nom, octets}), jeter(id)} (google.mjs).
   La portée drive.file ne voit que les fichiers créés par JARVIS : le dossier est le sien (sous RD Assistant si Google l'accepte,
   sinon à la racine de son Drive). Sans phrase posée ou sans la portée : rien ne part, la santé du serveur le dit. */
export function createCopieDrive({pl, drive, cleFichier, parent, S, save, now = Date.now, garder = COPIES_GARDEES}) {
  S.sauvegarde = S.sauvegarde || {};
  async function envoyer() {
    const s = (S.sauvegarde.drive = S.sauvegarde.drive || {});
    if (pl.mode() !== 'local') return {ok: false, saute: true, error: 'Pilotage n’est pas hébergé par JARVIS.'};
    try {
      const cle = lireCle(cleFichier);
      if (drive.portee() === 'non') throw err('Google n’a pas donné à JARVIS le droit d’écrire ses propres fichiers dans Drive : Réglages, Google, « Reconnecter », et coche tout.', 'portee');
      const dossier = await drive.dossier('Sauvegardes JARVIS', parent), nom = nomCopie(now());
      const deja = await drive.lister(dossier.id);
      if (!deja.some((f) => f.name === nom)) { const x = pl.instantane(); if (!x) throw err('Pilotage hébergé vide : rien à copier.'); await drive.envoyer({dossier: dossier.id, nom, octets: chiffrer(x, cle, now())}); }
      const toutes = [...new Set([...deja.map((f) => f.name), nom])].sort(), trop = toutes.slice(0, Math.max(0, toutes.length - garder));
      for (const f of deja.filter((x) => trop.includes(x.name))) { try { await drive.jeter(f.id); } catch { /* reprise demain */ } }
      Object.assign(s, {at: now(), nom, error: '', code: '', racine: !!dossier.racine, copies: Math.min(toutes.length, garder)}); save();
      return {ok: true, nom, racine: !!dossier.racine, copies: s.copies};
    } catch (e) {
      const portee = e.code === 'portee' || e.code === 'not_granted';   /* Google refuse l'écriture : drive.file pas accordée */
      Object.assign(s, {essai: now(), error: portee ? 'Google refuse à JARVIS l’écriture de ses copies dans Drive : Réglages, Google, « Reconnecter », et coche tout.' : String(e.message || e).slice(0, 240), code: portee ? 'portee' : e.code || ''}); save();
      return {ok: false, error: s.error, code: s.code};
    }
  }
  /* pour la santé du serveur : null hors du mode local */
  function sante() {
    if (pl.mode() !== 'local') return null;
    const s = S.sauvegarde.drive || {};
    if (!fs.existsSync(cleFichier)) return {nom: 'Copie chiffrée de Pilotage', ok: false, detail: 'phrase de passe à poser : dans Termius, « sudo -iu jarvis node /opt/rd/jarvis-os/server/server.mjs pilotage cle ».'};
    if (s.code === 'portee' || drive.portee() === 'non') return {nom: 'Copie chiffrée de Pilotage', ok: false, detail: 'à relier : Réglages, Google, « Reconnecter » (coche tout), pour que JARVIS écrive ses copies dans Drive.'};
    if (s.error) return {nom: 'Copie chiffrée de Pilotage', ok: false, detail: s.error};
    if (!s.at) return null;   /* la première nuit n'est pas encore passée */
    const vieille = now() - s.at > 50 * 3600000;
    return {nom: 'Copie chiffrée de Pilotage', ok: !vieille, detail: vieille ? 'pas de copie dans Drive depuis plus de deux jours.' : 'à jour (Drive, « Sauvegardes JARVIS »' + (s.racine ? ', à la racine de ton Drive' : '') + ')'};
  }
  return {envoyer, sante};
}
