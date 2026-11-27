/* JARVIS OS — « Hermes et ses routines » en direct (0.92.0, 26/11/2026). Sa remarque : dans l'app, la page ne montrait qu'une ligne
   périmée de l'onglet Routines de Pilotage. Les vraies routines sont dans le cron d'Hermes (jobs.json, chez l'utilisateur hermes, que
   JARVIS ne peut pas lire). Root (hermes-relance, toutes les 10 minutes ; jarvis-os/hermes/limite.py) en écrit un résumé assaini dans
   /var/lib/hermes-relance-etat/routines.json (root et groupe de JARVIS, 750 et 640). Ici, JARVIS le lit, en lecture seule :
   - jamais à travers un lien (ni le fichier, ni son dossier), fichier ordinaire, taille bornée ;
   - le JSON est revalidé champ par champ (liste blanche de formes : noms, mots connus, dates ISO) : rien d'autre ne sort d'ici ;
   - résumé absent, illisible ou plus vieux que 30 minutes : « indisponible », avec la raison ; jamais une liste périmée.
   JARVIS n'écrit jamais dans ce dossier. */
import fs from 'node:fs';
import path from 'node:path';
import {heureParis} from './limite.mjs';

export const RESUME_VIEUX = 30 * 60000;   /* la minuterie passe toutes les 10 minutes : au-delà de 30, le résumé ne dit plus rien de sûr */
const TAILLE_MAX = 32768, ROUTINES_MAX = 40;
export const NOM = /^[a-z0-9][a-z0-9-]{1,39}$/;
const LIBELLE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 .'’-]{2,60}$/, MOMENT = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 ,*/-]{2,90}$/;
export const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const PASSERELLES = ['active', 'arrêtée', 'plantée', 'démarre', 'inconnue'], GARDES = ['actif', 'coupé', 'a arrêté Hermes', 'arrêté'];
export const MODES = ['réel', 'double'], CAUSES = ['limite du forfait', 'réseau', 'résultat non envoyé', 'arrêtée à la main', 'erreur'];
const RESULTATS = ['ok', 'erreur', 'jamais'];

/* 0.96.0 : la forme fermée d'un horaire (ordre « horaire » de l'app ; mêmes règles que root, jarvis-os/hermes/ordres.py) : des jours
   (« tous », « ouvres » du lundi au vendredi, ou une liste de jours) et une à quatre heures « HH:MM », minutes par pas de 5. Deux heures
   identiques n'en font qu'une. Un horaire d'Hermes n'a qu'une liste de minutes et une liste d'heures : les passages partagent donc la même
   minute (9 h 15 et 13 h 15) ou tiennent dans la même heure (9 h 00 et 9 h 15). JARVIS n'envoie jamais d'expression cron. */
export const JOURS_CODES = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const JOURS_NOMS = {lun: 'lundi', mar: 'mardi', mer: 'mercredi', jeu: 'jeudi', ven: 'vendredi', sam: 'samedi', dim: 'dimanche'};
export function formeHoraire(jours, heures) {
  let j;
  if (jours === 'tous' || jours === 'ouvres') j = jours;
  else if (Array.isArray(jours) && jours.length >= 1 && jours.length <= 7 && jours.every((x) => typeof x === 'string' && JOURS_CODES.includes(x))) { j = JOURS_CODES.filter((x) => jours.includes(x)); if (j.length === 7) j = 'tous'; }
  else return {ok: false, code: 'jours'};
  if (!Array.isArray(heures) || heures.length < 1 || heures.length > 12 || !heures.every((x) => typeof x === 'string' && /^\d{2}:\d{2}$/.test(x))) return {ok: false, code: 'heures'};
  const hs = [...new Set(heures)].sort();
  if (hs.some((x) => +x.slice(0, 2) > 23 || +x.slice(3) > 59)) return {ok: false, code: 'heures'};
  if (hs.some((x) => +x.slice(3) % 5)) return {ok: false, code: 'pas'};
  if (hs.length > 4) return {ok: false, code: 'trop'};
  if (new Set(hs.map((x) => x.slice(0, 2))).size * new Set(hs.map((x) => x.slice(3))).size !== hs.length) return {ok: false, code: 'forme'};
  return {ok: true, jours: j, heures: hs};
}
const suite = (m) => (m.length === 1 ? m[0] : m.slice(0, -1).join(', ') + ' et ' + m[m.length - 1]);
/* « du lundi au vendredi à 7 h 40 » : la même phrase que root (moment_lisible), pour l'aperçu et le message de confirmation */
export function momentDe(f) {
  const quand = 'à ' + suite(f.heures.map((x) => +x.slice(0, 2) + ' h' + (+x.slice(3) ? ' ' + x.slice(3) : '')));
  if (f.jours === 'tous') return 'chaque jour ' + quand;
  if (f.jours === 'ouvres') return 'du lundi au vendredi ' + quand;
  return suite(f.jours.map((x) => 'le ' + JOURS_NOMS[x])) + ' ' + quand;
}

const parmi = (v, liste, defaut) => (liste.includes(v) ? v : defaut);
const date = (v) => (typeof v === 'string' && ISO.test(v) && !isNaN(Date.parse(v)) ? v : null);

/* lecture sûre d'un fichier de root : {ok, json} ou {ok: false, code} ; jamais un lien, fichier ordinaire, petit */
export function lireSur(fichier, tailleMax = TAILLE_MAX) {
  let fd;
  try {
    const d = fs.lstatSync(path.dirname(fichier));
    if (d.isSymbolicLink() || !d.isDirectory()) return {ok: false, code: 'lien'};
  } catch (e) { return {ok: false, code: e && e.code === 'ENOENT' ? 'dossier' : 'droits'}; }
  try {
    fd = fs.openSync(fichier, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const st = fs.fstatSync(fd);
    if (!st.isFile()) return {ok: false, code: 'illisible'};
    if (st.size > tailleMax) return {ok: false, code: 'gros'};
    return {ok: true, json: JSON.parse(fs.readFileSync(fd, 'utf8'))};
  } catch (e) {
    const c = e && e.code;
    return {ok: false, code: c === 'ENOENT' ? 'absent' : c === 'ELOOP' || c === 'EMLINK' ? 'lien' : c === 'EACCES' || c === 'EPERM' ? 'droits' : 'illisible'};
  } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* rien */ } }
}

const RAISONS = {
  dossier: 'le résumé des routines n’existe pas sur ce serveur (Hermes n’y est pas installé, ou son install.sh n’a pas été relancé depuis la 0.92.0)',
  absent: 'le résumé des routines n’est pas encore écrit (il vient au prochain passage de la relance d’Hermes, toutes les 10 minutes)',
  lien: 'le résumé des routines est un lien : refusé',
  droits: 'JARVIS n’a pas le droit de lire le résumé des routines (dossier de root, groupe de JARVIS)',
  gros: 'le résumé des routines est trop gros : refusé',
  illisible: 'le résumé des routines est illisible',
  liste: 'la liste des routines manque du côté de root (relancer install.sh d’Hermes)',
  cron: 'le cron d’Hermes est illisible pour root (jobs.json)'
};

/* une routine du résumé, revalidée ; null si son nom n'en est pas un */
function routine(x) {
  if (!x || typeof x !== 'object' || typeof x.nom !== 'string' || !NOM.test(x.nom)) return null;
  const resultat = parmi(x.resultat, RESULTATS, 'jamais'), posee = x.posee === true, active = posee && x.active === true;
  /* 0.96.0 : la pause et qui l'a posée, un passage en cours, l'horaire d'origine et s'il a été changé, sa forme (pour « Changer l'horaire ») */
  const pz = x.pause && typeof x.pause === 'object' && !Array.isArray(x.pause) ? {depuis: date(x.pause.depuis), par: parmi(x.pause.par, ['jarvis', 'hermes'], 'hermes')} : null;
  const f = x.forme && typeof x.forme === 'object' ? formeHoraire(x.forme.jours, x.forme.heures) : {ok: false};
  const plus = {pause: posee ? pz : null, enCours: posee && x.en_cours === true, origine: typeof x.origine === 'string' && MOMENT.test(x.origine) ? x.origine : '', modifie: x.modifie === true,
    forme: f.ok ? {jours: f.jours, heures: f.heures} : null, evenement: x.evenement === true};
  return {
    nom: x.nom,
    libelle: typeof x.libelle === 'string' && LIBELLE.test(x.libelle) ? x.libelle : x.nom,
    moment: typeof x.moment === 'string' && MOMENT.test(x.moment) ? x.moment : '',
    mode: parmi(x.mode, MODES, 'double'),
    posee, active,
    dernier: resultat === 'jamais' ? null : date(x.dernier),
    resultat,
    cause: resultat === 'erreur' ? parmi(x.cause, CAUSES, 'erreur') : null,
    prochain: active ? date(x.prochain) : null,
    ...plus
  };
}

export function createHermesRoutines({fichier, now = () => Date.now()}) {
  const non = (code, raison, plus = {}) => ({disponible: false, code, raison: raison || RAISONS[code] || RAISONS.illisible, ...plus});
  /* ce que l'app affiche : {disponible: true, at (ms), passerelle, garde, routines} ou {disponible: false, code, raison} */
  function lire() {
    const l = lireSur(fichier);
    if (!l.ok) return non(l.code);
    const d = l.json;
    if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1 || !Number.isInteger(d.at) || d.at < 1.5e9 || d.at > 4.2e9 || !Array.isArray(d.routines)) return non('illisible');
    const at = d.at * 1000, t = now();
    if (at > t + 5 * 60000) return non('illisible', 'le résumé des routines porte une date à venir : refusé');
    const g = d.garde && typeof d.garde === 'object' ? d.garde : {};
    const etat = {at, passerelle: parmi(d.passerelle, PASSERELLES, 'inconnue'),
      garde: {etat: parmi(g.etat, GARDES, 'inconnu'), jusqua: typeof g.jusqua === 'string' && JOUR.test(g.jusqua) ? g.jusqua : null}};
    if (t - at > RESUME_VIEUX) return non('vieux', 'dernière écriture du résumé ' + heureParis(at, t).replace(/^(\d)/, 'à $1') + ' : plus de 30 minutes (la relance d’Hermes, hermes-relance, ne passe plus)', {at});
    if (d.liste === false) return non('liste', '', etat);
    if (d.cron === false) return non('cron', '', etat);
    const vus = new Set(), routines = [];
    for (const x of d.routines.slice(0, ROUTINES_MAX)) { const r = routine(x); if (r && !vus.has(r.nom)) { vus.add(r.nom); routines.push(r); } }
    return {disponible: true, ...etat, routines};
  }
  /* la ligne de la santé du serveur : une information, jamais une notification ; rien à dire là où Hermes n'est pas installé */
  function sante() {
    const r = lire();
    if (!r.disponible && r.code === 'dossier') return null;
    if (!r.disponible) return {nom: 'Routines d’Hermes', ok: false, detail: 'résumé indisponible : ' + r.raison + '.', pousser: false};
    const n = r.routines.length, err = r.routines.filter((x) => x.resultat === 'erreur'), pause = r.routines.filter((x) => !x.active).length;   /* la santé ne dit que la catégorie d'une erreur, jamais son détail (0.96.0) */
    const d = [n + ' routine' + (n > 1 ? 's' : '') + ' en direct' + (pause ? ' (' + pause + ' pas active' + (pause > 1 ? 's' : '') + ')' : ''), 'dernière écriture ' + heureParis(r.at, now()).replace(/^(\d)/, 'à $1'),
      err.length ? 'en erreur au dernier passage : ' + err.slice(0, 4).map((x) => x.libelle + ' (' + x.cause + ')').join(', ') : '',
      r.passerelle !== 'active' ? 'passerelle ' + r.passerelle : '', r.garde.etat === 'a arrêté Hermes' ? 'le garde du forfait a arrêté Hermes' : ''].filter(Boolean);
    return {nom: 'Routines d’Hermes', ok: true, detail: d.join(' ; ') + '.', pousser: false};
  }
  return {lire, sante};
}
