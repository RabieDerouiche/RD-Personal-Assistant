/* JARVIS OS 0.41.0 : les routines planifiées et le brief du matin (choix du propriétaire, QCM du 21/11/2026, « Routines planifiées » et
   « Brief du matin sans IA », après le rapport « Ce qui manque à JARVIS OS » : OpenClaw et Hermes Agent ont leur planificateur).
   Une routine = une mission qui revient (« chaque vendredi à 18 h, prépare les sorties du week-end »), écrite en une phrase dans JARVIS
   ou proposée par Claude dans la discussion (rien n'est programmé sans son bouton) ; ou le brief du matin, fait sans IA (météo, agenda,
   ce qui t'attend…), envoyé en notification. Heure de Paris ; un passage d'horloge toutes les 30 secondes ; une routine manquée
   (serveur redémarré) part dans les 2 heures qui suivent, jamais plus tard. */
import crypto from 'node:crypto';

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const nrm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'");
const hhmm = (h, m) => String(Math.min(23, +h)).padStart(2, '0') + ':' + String(Math.min(59, +m || 0)).padStart(2, '0');
const minutes = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };

/* le moment dans une phrase en français : {jours, jourDuMois, heure} (null là où rien n'est dit) */
function moment(seg) {
  const l = ' ' + nrm(seg) + ' ';
  let heure = null, jours = null, jourDuMois = null;
  const h = /(?:^|[\s,])(?:a|vers|des)?\s*(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?(?=[\s,.;]|$)/.exec(l);
  if (h && +h[1] <= 23) heure = hhmm(h[1], h[2]);
  else if (/\bmidi\b/.test(l)) heure = '12:00';
  else if (/\bminuit\b/.test(l)) heure = '00:00';
  else if (/\b(chaque|tous les|le) matin\b|\bmatins?\b/.test(l)) heure = '08:00';
  else if (/\b(chaque|tous les|le) soir\b|\bsoirs?\b/.test(l)) heure = '19:00';
  const mois = /\b(?:le\s+)?(1er|premier|\d{1,2})\s+(?:du mois|de chaque mois|de tous les mois)\b/.exec(l) || /\b(?:chaque|tous les) mois(?:,)?\s+le\s+(1er|premier|\d{1,2})\b/.exec(l);
  if (mois) jourDuMois = Math.max(1, Math.min(28, /^(1er|premier)$/.test(mois[1]) ? 1 : +mois[1]));
  else if (/\b(tous les jours|chaque jour|chaque matin|chaque soir|tous les matins|tous les soirs|quotidien(ne)?ment)\b/.test(l)) jours = [0, 1, 2, 3, 4, 5, 6];
  else if (/\b(en semaine|du lundi au vendredi|jours ouvres|jours de semaine)\b/.test(l)) jours = [1, 2, 3, 4, 5];
  else {
    const js = JOURS.map((j, i) => (new RegExp('\\b(chaque|tous les|le|les|et|,)\\s*' + j + 's?\\b').test(l) || new RegExp('\\b' + j + 's?\\s+et\\b').test(l) ? i : -1)).filter((i) => i >= 0);
    if (/\b(chaque|tous les|le) week-?ends?\b/.test(l)) js.push(6, 0);
    if (js.length) jours = [...new Set(js)].sort();
  }
  return {heure, jours, jourDuMois};
}
/* une phrase entière : le moment et la tâche ; la tâche est le morceau (séparé par une virgule) qui ne parle pas du moment */
export function lirePhrase(phrase) {
  const p = String(phrase || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (p.length < 6) return {erreur: 'Phrase trop courte.'};
  const segs = p.split(/\s*[,;:]\s*/).filter(Boolean);
  let best = -1, m0 = {heure: null, jours: null, jourDuMois: null};
  segs.forEach((s, i) => { const m = moment(s), score = (m.heure ? 1 : 0) + (m.jours || m.jourDuMois ? 2 : 0); if (score > 0 && (best < 0 || score > ((m0.heure ? 1 : 0) + (m0.jours || m0.jourDuMois ? 2 : 0)))) { best = i; m0 = m; } });
  let texte;
  if (segs.length > 1 && best >= 0) texte = segs.filter((_, i) => i !== best).join(', ');
  else {
    m0 = moment(p);
    texte = p.replace(/\b(tous les jours|chaque jour|chaque matin|chaque soir|tous les matins|tous les soirs|en semaine|du lundi au vendredi|chaque mois|tous les mois|le (?:1er|premier|\d{1,2}) (?:du mois|de chaque mois)|(?:chaque|tous les|le|les) (?:week-?ends?|lundis?|mardis?|mercredis?|jeudis?|vendredis?|samedis?|dimanches?))\b/gi, ' ')
      .replace(/(?:^|\s)(?:à|a|vers|dès)\s*\d{1,2}\s*(?:h|heures?|:)\s*(?:\d{2})?\b/gi, ' ').replace(/\b(midi|minuit)\b/gi, ' ');
  }
  texte = texte.replace(/^[\s,;:.-]*(et|puis)?\s*/i, '').replace(/\s+/g, ' ').trim();
  texte = texte.charAt(0).toUpperCase() + texte.slice(1);
  if (!m0.jours && !m0.jourDuMois) return {erreur: 'Je ne vois pas quand : dis par exemple « chaque vendredi à 18 h » ou « le 1er du mois ».', texte, heure: m0.heure};
  if (texte.length < 4) return {erreur: 'Je ne vois pas quoi faire.', jours: m0.jours, jourDuMois: m0.jourDuMois, heure: m0.heure};
  return {texte, jours: m0.jours, jourDuMois: m0.jourDuMois, heure: m0.heure || '08:00', heureDevinee: !m0.heure};
}
/* « 18 h », « 7 h 30 » */
export const heureDite = (hm) => String(hm).replace(':', ' h ').replace(/ h 00$/, ' h').replace(/^0(\d)/, '$1');
/* « chaque vendredi à 18 h », « du lundi au vendredi à 7 h 30 », « le 1er du mois à 9 h » */
export function quandDit(r) {
  const h = heureDite(r.heure);
  if (r.jourDuMois) return 'le ' + (r.jourDuMois === 1 ? '1er' : r.jourDuMois) + ' du mois à ' + h;
  const j = [...(r.jours || [])].sort();
  if (j.length === 7) return 'tous les jours à ' + h;
  if (j.join() === '1,2,3,4,5') return 'du lundi au vendredi à ' + h;
  if (j.join() === '0,6') return 'le week-end à ' + h;
  const noms = j.map((i) => JOURS[i]);
  return 'chaque ' + (noms.length > 1 ? noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1] : noms[0]) + ' à ' + h;
}

export function createRoutines({S, save, now, paris, lancer, log = () => {}}) {
  if (!Array.isArray(S.routines)) S.routines = [];
  const R = () => S.routines;
  const propre = (o) => {
    const jours = Array.isArray(o.jours) ? [...new Set(o.jours.map(Number).filter((x) => x >= 0 && x <= 6))].sort() : null;
    const jourDuMois = o.jourDuMois ? Math.max(1, Math.min(28, Math.round(+o.jourDuMois))) : null;
    const heure = /^\d{2}:\d{2}$/.test(String(o.heure || '')) && minutes(o.heure) < 1440 ? o.heure : null;
    return {jours: jourDuMois ? null : jours && jours.length ? jours : null, jourDuMois, heure};
  };
  function ajouter(o) {
    const genre = o.genre === 'brief' ? 'brief' : 'mission';
    let base = o;
    if (o.phrase && genre === 'mission') { base = lirePhrase(o.phrase); if (base.erreur) return {ok: false, error: base.erreur, lu: base}; }
    const q = propre(base), texte = genre === 'brief' ? 'Brief du matin' : String(base.texte || '').trim().slice(0, 600);
    if (!q.heure || (!q.jours && !q.jourDuMois)) return {ok: false, error: 'Il faut un jour et une heure.'};
    if (genre === 'mission' && texte.length < 4) return {ok: false, error: 'Il faut dire quoi faire.'};
    if (genre === 'brief') { const deja = R().find((x) => x.genre === 'brief'); if (deja) { Object.assign(deja, q, {actif: true}); save(); return {ok: true, routine: deja}; } }
    if (R().filter((x) => x.genre === 'mission').length >= 30) return {ok: false, error: 'Trente routines au plus.'};
    const r = {id: crypto.randomUUID().slice(0, 8), genre, texte, ...q, actif: true, cree: now(), source: o.source === 'claude' ? 'claude' : 'app', dernierJour: '', derniere: 0};
    R().push(r); save();
    return {ok: true, routine: r};
  }
  function modifier(id, o) {
    const r = R().find((x) => x.id === id); if (!r) return null;
    if (typeof o.actif === 'boolean') r.actif = o.actif;
    if (o.heure || o.jours || o.jourDuMois) { const q = propre({...r, ...o}); if (q.heure && (q.jours || q.jourDuMois)) Object.assign(r, q); }
    if (typeof o.texte === 'string' && r.genre === 'mission' && o.texte.trim().length >= 4) r.texte = o.texte.trim().slice(0, 600);
    save(); return r;
  }
  function supprimer(id) { const n = R().length; S.routines = R().filter((x) => x.id !== id); save(); return S.routines.length < n; }
  /* est-elle due maintenant ? (jour, heure passée de moins de 2 heures, pas déjà partie aujourd'hui) */
  function due(r, t) {
    if (!r.actif || r.dernierJour === t.ymd) return false;
    const dow = new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay();
    if (r.jourDuMois ? r.jourDuMois !== t.d : !(r.jours || []).includes(dow)) return false;
    const ecart = minutes(t.hm) - minutes(r.heure);
    return ecart >= 0 && ecart <= 120;
  }
  async function partir(r, force) {
    const t = paris(new Date(now()));
    r.dernierJour = t.ymd; r.derniere = now(); save();
    try { await lancer(r, force); } catch (e) { log('routine « ' + r.texte + ' » : ' + (e && e.message || e)); }
  }
  async function tick() { const t = paris(new Date(now())); for (const r of R().slice()) if (due(r, t)) await partir(r); }
  function maintenant(id) { const r = R().find((x) => x.id === id); if (!r) return false; partir(r, true); return true; }
  /* la prochaine fois (texte), pour l'app */
  function prochaine(r) {
    const t = paris(new Date(now()));
    for (let k = 0; k < 40; k++) {
      const d = new Date(Date.UTC(t.y, t.m - 1, t.d + k)), dow = d.getUTCDay(), jm = d.getUTCDate(), ymd = d.toISOString().slice(0, 10);
      const ok = r.jourDuMois ? r.jourDuMois === jm : (r.jours || []).includes(dow);
      if (!ok || (k === 0 && (minutes(t.hm) > minutes(r.heure) || r.dernierJour === ymd))) continue;
      return (k === 0 ? "aujourd'hui" : k === 1 ? 'demain' : JOURS[dow] + ' ' + jm) + ' à ' + heureDite(r.heure);
    }
    return '';
  }
  const liste = () => R().map((r) => ({...r, quand: quandDit(r), prochaine: r.actif ? prochaine(r) : ''}));
  let timer = null;
  const demarrer = (ms = 30000) => { if (timer) return; timer = setInterval(() => { tick().catch(() => {}); }, ms); if (timer.unref) timer.unref(); };
  return {liste, ajouter, modifier, supprimer, maintenant, tick, demarrer};
}
