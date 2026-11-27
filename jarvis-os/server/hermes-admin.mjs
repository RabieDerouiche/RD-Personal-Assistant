/* JARVIS OS — administrer les routines d'Hermes depuis JARVIS (0.96.0, 27/11/2026). Sa demande : « Les routines, on doit être capable de
   les relancer depuis JARVIS, soit car elles sont en erreur, ou car on a modifié quelque chose, ou tout simplement pour avoir une nouvelle
   recherche ; […] pour chaque routine je dois avoir une popup où je peux arrêter une routine jusqu'à nouvel ordre, la relancer, avoir
   l'historique, et si jamais il y a une erreur voir l'erreur en détail », puis : changer son horaire.
   JARVIS N'EXÉCUTE RIEN. Il pose un petit fichier d'ordre ({id, routine, action, at}, et pour « horaire » une forme fermée : des jours et
   des heures, jamais une expression cron) dans /var/lib/jarvis-reveil/ordres ; root le surveille (hermes-ordres.path), le revalide et agit
   (jarvis-os/hermes/ordres.py). Root écrit en retour, dans le dossier du résumé (/var/lib/hermes-relance-etat, lecture seule pour JARVIS) :
   le résultat de chaque ordre (ordres.json), l'historique des 30 derniers passages de chaque routine (historique.json) avec, pour un
   passage en erreur, le texte de l'erreur nettoyé. Ici :
   - tout ce qui vient de root est revalidé (liste blanche de formes, taille bornée, jamais un lien), comme hermes-routines.mjs ;
   - les mêmes plafonds que root (1 lancement par routine toutes les 5 minutes, 12 par jour, 6 changements d'horaire par jour), pour
     répondre tout de suite ; root reste le seul juge ;
   - JARVIS garde de son côté le résumé que chaque passage réel donne par routine_fin (les 30 derniers par routine) : « ce qu'elle a fait » ;
   - l'erreur en détail ne sort QUE par la route de la feuille (appareil relié, verrou passé) : jamais dans une notification, ni dans la
     santé, ni par un outil MCP, ni dans le Journal de Pilotage ;
   - aucun outil MCP n'appelle ce module : un ordre ne passe que par l'app (Hermes ne peut pas se relancer lui-même). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {heureParis} from './limite.mjs';
import {lireSur, NOM, ISO, CAUSES, MODES, formeHoraire, momentDe} from './hermes-routines.mjs';

export const ACTIONS = ['lancer', 'pause', 'reprendre', 'horaire'];
const ETATS = ['fait', 'refusé', 'en cours', 'terminé', 'sans suite'];
const LANCES = {programme: 'programmé', jarvis: 'lancé à la main depuis JARVIS', limite: 'relancé après la limite du forfait', reveil: 'réveil par JARVIS (courrier, Canal)', main: 'lancé à la main sur le serveur'};
const ID = /^[a-f0-9]{16}$/;
export const ECART_LANCER = 5 * 60000, LANCERS_JOUR = 12, HORAIRES_JOUR = 6, SANS_REPONSE = 90000;
const HISTO_MAX = 30, RESUMES_MAX = 30, ORDRES_MAX = 60;
/* les raisons d'un refus, en clair (les codes de root, liste fermée ; un code inconnu devient « refusé ») */
const RAISONS = {
  illisible: 'ordre illisible pour le serveur', routine: 'routine inconnue du serveur (relancer install.sh d’Hermes)', action: 'action inconnue du serveur', vieux: 'ordre arrivé trop tard (plus de 10 minutes)',
  rejoue: 'ordre déjà traité', 'pas-posee': 'la routine n’est pas posée chez Hermes', passerelle: 'Hermes est arrêté', garde: 'le garde du forfait a arrêté Hermes',
  limite: 'la limite du forfait Claude est atteinte', 'en-cours': 'un passage de cette routine est déjà en cours', pause: 'la routine est en pause : reprends-la d’abord',
  'trop-tot': 'déjà lancée il y a moins de 5 minutes', plafond: 'plafond du jour atteint', hermes: 'Hermes a refusé', jours: 'jours inconnus', heures: 'heures illisibles (une à quatre)',
  pas: 'minutes hors du pas de 5', trop: 'quatre passages par jour au plus', forme: 'ces heures ne tiennent pas dans un seul horaire : même minute (9 h 15 et 13 h 15) ou même heure (9 h 00 et 9 h 15)',
  libre: 'expression libre refusée : des jours et des heures seulement', attente: 'un ordre pour cette routine attend déjà le serveur', indisponible: 'l’état des routines est indisponible', installation: 'le dossier des ordres n’existe pas sur ce serveur (relancer install.sh d’Hermes)'};
const CONSEILS = {
  'limite du forfait': 'La limite du forfait Claude a coupé ce passage. Elle repart seule, une fois, après la levée de la limite ; tu peux aussi la relancer.',
  'réseau': 'Le réseau ou le service a coupé pendant le passage. Relance-la : c’est en général passager.',
  'résultat non envoyé': 'Le passage s’est fait, mais son compte rendu n’est pas parti sur Telegram. Regarde « Ce qu’elle a fait » : inutile de relancer pour ça.',
  'arrêtée à la main': 'Ce passage a été arrêté à la main. Relance-la si tu en as besoin.',
  erreur: 'Erreur pendant le passage. Si elle se répète, change ce qu’il faut puis relance-la.'};

const parmi = (v, liste, defaut) => (liste.includes(v) ? v : defaut);
const date = (v) => (typeof v === 'string' && ISO.test(v) && !isNaN(Date.parse(v)) ? v : null);
const ent = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
const ymd = (ms) => new Intl.DateTimeFormat('fr-CA', {timeZone: 'Europe/Paris'}).format(new Date(ms));

/* le texte d'une erreur écrit par root : déjà nettoyé là-bas (ordres.py, nettoyer_erreur), rebordé ici, et remasqué pour le peu qui
   ressemblerait encore à un secret (défense en profondeur : JARVIS ne suppose rien de ce qu'il lit) */
export function texteErreur(v, sain = () => true) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const lignes = v.slice(0, 2000).replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g, ' ').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8)
    .map((l) => l.replace(/\b[A-Za-z][a-z0-9+.-]{1,15}:\/\/[^\s<>"'`«»]+/g, (m) => { try { return new URL(m).hostname || '[adresse web]'; } catch { return '[adresse web]'; } }).replace(/\bsk-[A-Za-z0-9_-]{4,}/g, '[clé masquée]').replace(/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{4,}/gi, '$1 [masqué]').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, '[adresse mail]')
      .replace(/(?:\/(?:home|etc|root))(?:\/[^\s:"'`,;()[\]<>«»]+)+/g, (m) => m.split('/').pop() || '[chemin]').slice(0, 160));
  const t = lignes.join('\n').slice(0, 600);
  if (!t) return null;
  return sain(t) ? t : '(détail masqué : il contenait un mot réservé)';
}

export function createHermesAdmin({routines, dossierEtat, dossierOrdres, S, save, now = () => Date.now(), push = null, connues = () => ({}), sain = () => true, attente = () => null, log = () => {}}) {
  const A = () => { if (!S.hermesAdmin || typeof S.hermesAdmin !== 'object') S.hermesAdmin = {}; const a = S.hermesAdmin; if (!Array.isArray(a.ordres)) a.ordres = []; if (!a.resumes || typeof a.resumes !== 'object') a.resumes = {}; return a; };
  const h = (ms) => heureParis(ms, now()).replace(/^(\d)/, 'à $1');
  const libelle = (nom) => connues()[nom] || nom;

  /* ---------- ce que JARVIS garde lui-même : le résumé de routine_fin de chaque passage réel (déjà filtré : rien de bancaire) ---------- */
  function noterResume(nom, texte) {
    if (typeof nom !== 'string' || !NOM.test(nom)) return;
    const a = A(), t = String(texte || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (t.length < 2) return;
    a.resumes[nom] = [...(Array.isArray(a.resumes[nom]) ? a.resumes[nom] : []), {at: now(), texte: t}].slice(-RESUMES_MAX);
    save();
  }
  const resumesDe = (nom) => (Array.isArray(A().resumes[nom]) ? A().resumes[nom] : []).filter((x) => x && Number.isFinite(x.at) && typeof x.texte === 'string');

  /* ---------- ce que root écrit, revalidé ---------- */
  function passage(x) {
    if (!x || typeof x !== 'object' || !date(x.fin)) return null;
    const resultat = parmi(x.resultat, ['ok', 'erreur'], null);
    if (!resultat) return null;
    const debut = date(x.debut) && Date.parse(x.debut) <= Date.parse(x.fin) ? x.debut : null, lance = parmi(x.lance, Object.keys(LANCES), 'programme');
    return {fin: x.fin, debut, duree: debut ? ent(x.duree, 0, 86400) : null, mode: parmi(x.mode, MODES, 'double'), resultat, cause: resultat === 'erreur' ? parmi(x.cause, CAUSES, 'erreur') : null,
      lance, lanceDit: LANCES[lance], ordre: typeof x.ordre === 'string' && ID.test(x.ordre) ? x.ordre : null, erreur: resultat === 'erreur' ? texteErreur(x.erreur, sain) : null};
  }
  function historiqueRoot(nom) {
    const l = lireSur(path.join(dossierEtat, 'historique.json'), 524288);
    const r = l.ok && l.json && typeof l.json === 'object' && l.json.v === 1 && l.json.routines && typeof l.json.routines === 'object' && !Array.isArray(l.json.routines) ? l.json.routines[nom] : null;
    return (Array.isArray(r) ? r : []).slice(-HISTO_MAX).map(passage).filter(Boolean).sort((a, b) => Date.parse(a.fin) - Date.parse(b.fin));
  }
  function ordresRoot() {
    const l = lireSur(path.join(dossierEtat, 'ordres.json'), 65536), m = new Map();
    const o = l.ok && l.json && typeof l.json === 'object' && l.json.v === 1 && Array.isArray(l.json.ordres) ? l.json.ordres : [];
    for (const x of o.slice(-80)) {
      if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !ID.test(x.id)) continue;
      const etat = parmi(x.etat, ETATS, null); if (!etat) continue;
      m.set(x.id, {etat, raison: etat === 'refusé' ? (typeof x.raison === 'string' && Object.hasOwn(RAISONS, x.raison) ? x.raison : 'hermes') : null, traite: ent(x.traite, 1.5e9, 4.2e9), reprise: date(x.reprise), fin: date(x.fin),
        resultat: parmi(x.resultat, ['ok', 'erreur'], null), cause: parmi(x.cause, CAUSES, null)});
    }
    return m;
  }

  /* ---------- un ordre posé par JARVIS, vu avec la réponse de root ---------- */
  function vu(o, root) {
    const r = root.get(o.id), t = now(), quand = h(o.at);
    const base = {id: o.id, routine: o.routine, action: o.action, at: o.at, origine: !!o.origine, moment: o.moment || null};
    if (!r) return t - o.at > SANS_REPONSE
      ? {...base, etat: 'sans réponse', fini: true, texte: 'Demandé ' + quand + ', pas pris en compte : le serveur ne répond pas (session Serveur JARVIS, diagnostic.sh d’Hermes : la surveillance des ordres).'}
      : {...base, etat: 'posé', fini: false, texte: 'Demandé ' + quand + ' — en attente du serveur…'};
    if (r.etat === 'refusé') {
      const rep = r.reprise ? (r.raison === 'limite' ? ' : reprise vers ' + heureParis(Date.parse(r.reprise), t) + ', elle repartira seule' : ' : possible ' + h(Date.parse(r.reprise))) : '';
      return {...base, etat: 'refusé', fini: true, raison: r.raison, texte: 'Refusé ' + quand + ' : ' + RAISONS[r.raison] + rep + '.'};
    }
    if (r.etat === 'en cours') return {...base, etat: 'en cours', fini: false, texte: 'Demandé ' + quand + ' — en cours…'};
    if (r.etat === 'terminé') return {...base, etat: 'terminé', fini: true, resultat: r.resultat, cause: r.cause, fin: r.fin,
      texte: 'Lancée ' + quand + ', terminée ' + (r.fin ? h(Date.parse(r.fin)) : '') + ' : ' + (r.resultat === 'erreur' ? 'en erreur (' + (r.cause || 'erreur') + ').' : 'réussie.')};
    if (r.etat === 'sans suite') return {...base, etat: 'sans suite', fini: true, texte: 'Lancée ' + quand + ' : aucun passage vu au bout d’une heure (regarde l’état d’Hermes).'};
    const fait = {pause: 'En pause depuis ' + heureParis(o.at, t) + ', jusqu’à nouvel ordre.', reprendre: 'Reprise ' + quand + '.', horaire: o.origine ? 'Horaire d’origine remis — pris en compte ' + quand + '.' : 'Horaire changé — pris en compte ' + quand + (o.moment ? ' : ' + o.moment : '') + '.'};
    return {...base, etat: 'fait', fini: true, texte: fait[o.action] || 'Fait ' + quand + '.'};
  }
  const derniers = (nom, root) => { const l = A().ordres.filter((o) => o.routine === nom); return l.length ? vu(l[l.length - 1], root) : null; };

  /* ---------- les plafonds, côté JARVIS (root reste le seul juge : ici, on répond tout de suite) ---------- */
  function refusRapide(nom, action, r, root) {
    const t = now(), miens = A().ordres, tenus = miens.filter((o) => (root.get(o.id) || {}).etat !== 'refusé'), jour = ymd(t);
    const der = miens.filter((o) => o.routine === nom).pop();
    if (der && !vu(der, root).fini && t - der.at < SANS_REPONSE && !root.get(der.id)) return {code: 'attente'};
    if (r && r.disponible) {
      const x = r.routines.find((y) => y.nom === nom);
      if (!x || !x.posee) return {code: 'pas-posee'};
      if (action === 'lancer') {
        if (r.garde.etat === 'a arrêté Hermes') return {code: 'garde'};
        if (r.passerelle !== 'active') return {code: 'passerelle'};
        if (x.pause || !x.active) return {code: 'pause'};
        if (x.enCours) return {code: 'en-cours'};
      }
    }
    if (action === 'lancer') {
      const enCours = tenus.filter((o) => o.routine === nom && o.action === 'lancer' && ['posé', 'en cours'].includes(vu(o, root).etat)).pop();
      if (enCours) return {code: 'en-cours'};
      const lances = tenus.filter((o) => o.action === 'lancer'), mien = lances.filter((o) => o.routine === nom).pop();
      if (mien && t - mien.at < ECART_LANCER) return {code: 'trop-tot', reprise: mien.at + ECART_LANCER};
      if (lances.filter((o) => ymd(o.at) === jour).length >= LANCERS_JOUR) return {code: 'plafond'};
    }
    if (action === 'horaire' && tenus.filter((o) => o.action === 'horaire' && ymd(o.at) === jour).length >= HORAIRES_JOUR) return {code: 'plafond'};
    return null;
  }
  const dire = (x) => RAISONS[x.code] + (x.reprise ? ' : possible ' + h(x.reprise) : '') + '.';

  /* ---------- poser un ordre : un petit fichier, écrit à côté puis glissé d'un coup dans le dossier que root surveille ---------- */
  function ecrire(ordre) {
    let d;
    try { d = fs.lstatSync(dossierOrdres); } catch { return 'installation'; }
    if (d.isSymbolicLink() || !d.isDirectory()) return 'installation';
    const tmpDir = dossierOrdres + '.tmp', tmp = path.join(tmpDir, 'ordre-' + ordre.id + '.json');
    try {
      fs.mkdirSync(tmpDir, {recursive: true, mode: 0o700});
      if (fs.lstatSync(tmpDir).isSymbolicLink()) return 'installation';
      fs.writeFileSync(tmp, JSON.stringify(ordre), {mode: 0o600, flag: 'wx'});
      fs.renameSync(tmp, path.join(dossierOrdres, 'ordre-' + ordre.id + '.json'));
      return null;
    } catch (e) { try { fs.rmSync(tmp, {force: true}); } catch { /* rien */ } log('[hermes] ordre impossible à poser (' + ((e && e.code) || e) + ')'); return 'installation'; }
  }
  /* {status, body} : 200 {ok, ordre}, 400 forme, 409 refus avec sa raison, 503 dossier absent */
  function poser(b) {
    const nom = String((b && b.nom) || ''), action = String((b && b.action) || '');
    if (!NOM.test(nom) || !Object.hasOwn(connues(), nom)) return {status: 400, body: {error: 'Routine inconnue.', code: 'routine'}};
    if (!ACTIONS.includes(action)) return {status: 400, body: {error: 'Action inconnue (lancer, pause, reprendre, horaire).', code: 'action'}};
    const ordre = {id: crypto.randomBytes(8).toString('hex'), routine: nom, action, at: Math.floor(now() / 1000)}, garde = {id: ordre.id, routine: nom, action, at: now()};
    if (action === 'horaire') {
      if (b.cron !== undefined || b.expr !== undefined || b.schedule !== undefined) return {status: 400, body: {error: 'Refusé : ' + RAISONS.libre + '.', code: 'libre'}};
      if (b.origine === true) { ordre.origine = true; garde.origine = true; }
      else {
        const f = formeHoraire(b.jours, b.heures);
        if (!f.ok) return {status: 400, body: {error: 'Refusé : ' + RAISONS[f.code] + '.', code: f.code}};
        ordre.jours = f.jours; ordre.heures = f.heures; garde.moment = momentDe(f);
      }
    }
    const r = routines.lire(), root = ordresRoot(), refus = refusRapide(nom, action, r, root);
    if (refus) return {status: 409, body: {error: 'Refusé : ' + dire(refus), code: refus.code}};
    const pb = ecrire(ordre);
    if (pb) return {status: 503, body: {error: 'Ordre impossible à poser : ' + RAISONS[pb] + '.', code: pb}};
    const a = A(); a.ordres = [...a.ordres, garde].slice(-ORDRES_MAX); save();
    log('[hermes] ordre posé : ' + action + ' ' + nom);
    return {status: 200, body: {ok: true, ordre: vu(garde, root)}};
  }
  /* « Tout mettre en pause » / « Tout reprendre » : un ordre par routine posée qui n'y est pas déjà ; jamais « lancer » */
  function tout(action) {
    if (!['pause', 'reprendre'].includes(action)) return {status: 400, body: {error: 'Seulement « pause » ou « reprendre ».', code: 'action'}};
    const r = routines.lire();
    if (!r.disponible) return {status: 409, body: {error: 'Refusé : ' + RAISONS.indisponible + ' (' + r.raison + ').', code: 'indisponible'}};
    const cibles = r.routines.filter((x) => x.posee && (action === 'pause' ? !x.pause && x.active : !!x.pause || !x.active)), faits = [], refus = [];
    for (const x of cibles) { const p = poser({nom: x.nom, action}); (p.status === 200 ? faits : refus).push({nom: x.nom, libelle: x.libelle, ...(p.status === 200 ? {} : {raison: p.body.error})}); }
    return {status: 200, body: {ok: true, action, faits, refus}};
  }

  /* ---------- la feuille d'une routine ---------- */
  function detail(nom) {
    if (typeof nom !== 'string' || !NOM.test(nom) || !Object.hasOwn(connues(), nom)) return {status: 404, body: {error: 'Routine inconnue.'}};
    const r = routines.lire(), t = now(), root = ordresRoot();
    const x = r.disponible ? r.routines.find((y) => y.nom === nom) || null : null;
    const histo = historiqueRoot(nom), res = resumesDe(nom);
    /* le résumé de routine_fin rejoint son passage : reçu entre le début du passage (ou 30 minutes avant sa fin) et 2 minutes après sa fin */
    const pris = new Set();
    for (const p of histo) {
      const fin = Date.parse(p.fin), deb = p.debut ? Date.parse(p.debut) : fin - 30 * 60000;
      const c = res.filter((y) => y.at >= deb - 5000 && y.at <= fin + 120000 && !pris.has(y)).pop();
      p.resume = c ? c.texte : null; if (c) pris.add(c);
    }
    const dernierFin = histo.length ? Date.parse(histo[histo.length - 1].fin) : 0;
    const enAttente = res.filter((y) => !pris.has(y) && y.at > dernierFin + 120000).map((y) => ({fin: new Date(y.at).toISOString().replace(/\.\d{3}Z$/, 'Z'), debut: null, duree: null, mode: 'réel', resultat: null, cause: null, lance: null, lanceDit: null, ordre: null, erreur: null, resume: y.texte, attente: true}));
    const passages = [...histo, ...enAttente].slice(-HISTO_MAX).reverse();
    const finis = histo.length, reussis = histo.filter((p) => p.resultat === 'ok').length, durees = histo.map((p) => p.duree).filter((d) => d !== null);
    /* l'erreur en détail : seulement si le DERNIER passage a échoué ; le texte nettoyé par root, s'il a celui de ce passage */
    let erreur = null;
    if (x && x.resultat === 'erreur') {
      const p = x.dernier ? histo.find((q) => Math.abs(Date.parse(q.fin) - Date.parse(x.dernier)) <= 30000 && q.resultat === 'erreur') : null;
      const att = (((attente() || {}).attente) || []).find((y) => y && y.nom === nom && Number.isFinite(y.reprise) && y.reprise * 1000 > t);
      erreur = {cause: x.cause, quand: x.dernier, detail: p ? p.erreur : null,
        conseil: x.cause === 'limite du forfait' && att ? 'La limite du forfait Claude a coupé ce passage : reprise vers ' + heureParis(att.reprise * 1000, t) + ', elle repartira seule.' : CONSEILS[x.cause] || CONSEILS.erreur,
        relancer: x.cause !== 'résultat non envoyé'};
    }
    const refus = refusRapide(nom, 'lancer', r, root);
    return {status: 200, body: {
      disponible: !!r.disponible, raison: r.disponible ? null : r.raison, at: r.at || null, passerelle: r.passerelle || null, garde: r.garde || null,
      routine: x || {nom, libelle: libelle(nom), posee: false, active: false, moment: '', mode: 'double', dernier: null, resultat: 'jamais', cause: null, prochain: null, pause: null, enCours: false, origine: '', modifie: false, forme: null, evenement: false},
      etat: !x ? 'inconnu' : !x.posee ? 'pas posée' : x.pause || !x.active ? 'en pause' : x.enCours ? 'en cours' : x.resultat === 'erreur' ? 'en erreur' : 'active',
      ordre: derniers(nom, root), peut: {lancer: !refus, raison: refus ? dire(refus) : null},
      resume: res.length ? {at: res[res.length - 1].at, texte: res[res.length - 1].texte} : null,
      historique: passages, stats: {passages: finis, reussis, taux: finis ? Math.round((reussis / finis) * 100) : null, dureeMoyenne: durees.length ? Math.round(durees.reduce((s, d) => s + d, 0) / durees.length) : null},
      erreur, plafonds: {lancersParJour: LANCERS_JOUR, ecartMinutes: ECART_LANCER / 60000, horairesParJour: HORAIRES_JOUR}}};
  }

  /* la liste (GET /api/hermes/routines) : le résumé de 0.92.0, avec pour chaque routine son dernier ordre encore en route */
  function liste() {
    const r = routines.lire();
    if (!r.disponible || !A().ordres.length) return r;
    const root = ordresRoot();
    return {...r, routines: r.routines.map((x) => { const o = derniers(x.nom, root); return o && !o.fini ? {...x, ordre: {action: o.action, etat: o.etat, texte: o.texte}} : x; })};
  }

  /* ---------- la fin d'un passage lancé à la main : une notification, sans le détail de l'erreur ---------- */
  async function tick() {
    const a = A(), suivis = a.ordres.filter((o) => o.action === 'lancer' && !o.notifie && now() - o.at < 3 * 3600e3);
    if (!suivis.length) return 0;
    const root = ordresRoot(); let n = 0;
    for (const o of suivis) {
      const v = vu(o, root);
      if (!['terminé', 'sans suite'].includes(v.etat)) { if (v.etat === 'refusé' || v.etat === 'sans réponse') o.notifie = true; continue; }
      o.notifie = true; n++;
      const lib = libelle(o.routine), ok = v.etat === 'terminé' && v.resultat === 'ok';
      const corps = v.etat === 'sans suite' ? 'Lancée depuis JARVIS ' + h(o.at) + ' : aucun passage vu au bout d’une heure.'
        : 'Lancée depuis JARVIS ' + h(o.at) + ' : ' + (ok ? 'réussie.' : 'en erreur (' + (v.cause || 'erreur') + '). Le détail est dans sa feuille, dans JARVIS.');
      if (push && S.push && S.push.subs && S.push.subs.length) await push.send({title: 'Hermes : « ' + lib + ' » ' + (ok ? 'terminée' : v.etat === 'sans suite' ? 'sans suite' : 'en erreur'), body: corps, url: '/#voir-routine-' + o.routine, tag: 'hermes-ordre-' + o.id}, {urgency: 'normal'}).catch(() => {});
    }
    save();
    return n;
  }

  /* ---------- les routes (toutes derrière `authed` : un appareil relié, verrou passé) ---------- */
  async function traiter(req, p, url, {readBody}) {
    if (p === '/api/hermes/routine' && req.method === 'GET') return detail(String(url.searchParams.get('nom') || ''));
    if (p === '/api/hermes/routine/ordre' && req.method === 'POST') return poser(await readBody(req));
    if (p === '/api/hermes/routines/ordre' && req.method === 'POST') { const b = await readBody(req); return tout(String((b && b.action) || '')); }
    return null;
  }
  return {traiter, detail, poser, tout, liste, tick, noterResume, resumesDe};
}
