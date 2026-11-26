/* JARVIS OS — la limite du forfait Claude (0.89.0, 26/11/2026). Ce matin-là, la limite de 5 heures du forfait partagé a coupé en même
   temps JARVIS, Hermes et les sessions ; sa demande : « Fais en sorte que la relance soit automatique ».
   - estLimite / limiteDe : reconnaître la limite dans une erreur de Claude Code et l'heure où elle se lève (« resets 10:40am (UTC) »,
     « resets Dec 2, 7pm (Europe/Paris) », « usage limit reached|<époque> », « retry-after: 120s ») ; sans heure : 30 minutes après.
     Les mêmes règles que jarvis-os/hermes/limite.py (le kit d'Hermes), au même banc d'exemples.
   - ecritureFaite : un travail coupé après avoir écrit (brouillon, ligne de Pilotage, mail) n'est jamais relancé tout seul.
   - createAvisRelance : les avis que root pose pour JARVIS (/var/lib/hermes-relance-avis, root, lisible par son groupe) quand une
     routine d'Hermes reste en échec après sa relance ; JARVIS les pousse une fois sur ses appareils. Lecture seule, jamais un lien. */
import fs from 'node:fs';
import path from 'node:path';

const LIMITE = /hit your [^\n]{0,40}?limit|usage limit|rate[ _-]?limit|limit reached|\b429\b|too many requests|out of (?:extra )?usage|resets?\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|limite d.utilisation/i;
const MOIS = {jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12};
const REPRISE = /resets?\s+(?:at\s+)?(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*\(([A-Za-z][A-Za-z0-9_+/-]{0,40})\))?/gi;
const EPOQUE = /limit reached\|(\d{10})\b/i, ATTENDRE = /retry[- ]after[:\s]+(\d{1,6})\s*s/i;
export const SANS_HEURE = 30 * 60000;
const LE_PLUS_LOIN = 8 * 864e5;

export const estLimite = (t) => LIMITE.test(String(t || ''));

/* l'écart d'un fuseau avec UTC à un instant donné (ms), sans bibliothèque */
function ecart(tz, ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'})
    .formatToParts(new Date(ms)).filter((x) => x.type !== 'literal').map((x) => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}
const zoneSure = (tz) => { if (!tz) return 'UTC'; try { new Intl.DateTimeFormat('en-US', {timeZone: tz}); return tz; } catch { return 'UTC'; } };
const partsDe = (tz, ms) => { const d = new Date(ms + ecart(tz, ms)); return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate()}; };
function heureMur(tz, y, mo, d, h, mi) {   /* l'instant (ms) d'une heure « au mur » dans un fuseau */
  const g = Date.UTC(y, mo - 1, d, h, mi);
  const a = g - ecart(tz, g);
  return g - ecart(tz, a);
}

/* l'heure (ms) où la limite annoncée dans le texte se lève ; quand = l'heure de l'échec (ms) ; null si rien de sûr */
export function repriseDe(texte, quand) {
  const t = String(texte || '');
  let m = t.match(EPOQUE);
  if (m) { const r = +m[1] * 1000; return r >= quand - 60000 && r <= quand + LE_PLUS_LOIN ? r : null; }
  m = t.match(ATTENDRE);
  if (m) return quand + +m[1] * 1000;
  for (const x of t.matchAll(REPRISE)) {
    let h = +x[3]; const mi = +(x[4] || 0), ap = (x[5] || '').toLowerCase();
    if (ap) { if (h < 1 || h > 12) continue; h = (h % 12) + (ap === 'pm' ? 12 : 0); }
    if (h > 23 || mi > 59) continue;
    const tz = zoneSure(x[6]), base = partsDe(tz, quand);
    let r;
    if (x[1]) {
      const mo = MOIS[x[1].slice(0, 3).toLowerCase()], j = +x[2];
      if (!(j >= 1 && j <= 31)) continue;
      r = heureMur(tz, base.y, mo, j, h, mi);
      if (r < quand - 864e5) r = heureMur(tz, base.y + 1, mo, j, h, mi);
    } else {
      r = heureMur(tz, base.y, base.m, base.d, h, mi);
      if (r <= quand - 60000) { const dm = partsDe(tz, quand + 864e5); r = heureMur(tz, dm.y, dm.m, dm.d, h, mi); }
    }
    if (r >= quand - 60000 && r <= quand + LE_PLUS_LOIN) return r;
  }
  return null;
}
/* null si ce n'est pas la limite ; sinon {reprise (ms), connue} */
export function limiteDe(texte, quand) {
  if (!estLimite(texte)) return null;
  const r = repriseDe(texte, quand);
  return {reprise: r || quand + SANS_HEURE, connue: !!r};
}
/* « 11 h 40 » le jour même, sinon « le 02/12 à 19 h 00 » (heure de Paris) */
export function heureParis(ms, maintenant = Date.now()) {
  const f = (o) => new Intl.DateTimeFormat('fr-FR', {timeZone: 'Europe/Paris', ...o}).format(new Date(ms));
  const jour = (x) => new Intl.DateTimeFormat('fr-CA', {timeZone: 'Europe/Paris'}).format(new Date(x));
  const hm = f({hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).replace(':', ' h ');
  return jour(ms) === jour(maintenant) ? hm : 'le ' + f({day: '2-digit', month: '2-digit'}) + ' à ' + hm;
}
/* un outil d'écriture a servi avant la coupure (brouillon, ligne de Pilotage, mail) : pas de relance automatique */
export const ecritureFaite = (used) => (used || []).some((n) => n !== 'TodoWrite' && /create|update|append|send|delete|trash|draft|write|edit|batch|reply|forward/i.test(String(n)));

/* lecture sûre d'un fichier de root : fichier ordinaire, jamais un lien, petit */
function lireSur(f, max = 8192) {
  let fd;
  try {
    fd = fs.openSync(f, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const st = fs.fstatSync(fd);
    if (!st.isFile() || st.size > max) return null;
    return JSON.parse(fs.readFileSync(fd, 'utf8'));
  } catch { return null; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* rien */ } }
}

export function createAvisRelance({dir, S, save, push, log = () => {}}) {
  S.avisRelanceVus = Array.isArray(S.avisRelanceVus) ? S.avisRelanceVus : [];
  async function tick() {
    let noms = [];
    try { noms = fs.readdirSync(dir).filter((n) => /^avis-\d{6,12}-[a-z0-9-]{0,60}\.json$/.test(n)).sort(); } catch { return 0; }
    let n = 0;
    for (const nom of noms) {
      if (S.avisRelanceVus.includes(nom)) continue;
      const a = lireSur(path.join(dir, nom));
      S.avisRelanceVus.push(nom); S.avisRelanceVus = S.avisRelanceVus.slice(-300);
      if (!a || typeof a !== 'object') continue;
      const titre = String(a.titre || 'Relance après la limite').replace(/\s+/g, ' ').slice(0, 120), texte = String(a.texte || '').replace(/\s+/g, ' ').slice(0, 400);
      log('[limite] avis de root : ' + titre);
      if (S.push && S.push.subs && S.push.subs.length) await push.send({title: titre, body: texte, url: '/#voir-sante', tag: 'relance-' + String(a.cle || nom).replace(/[^a-z0-9-]/gi, '-').slice(0, 60)}, {urgency: 'high'}).catch(() => {});
      n++;
    }
    if (n) save();
    return n;
  }
  /* le résumé de root (etat.json) : routines et tâches en attente de la levée, dernières relances (noms et heures) */
  const etat = () => { const e = lireSur(path.join(dir, 'etat.json'), 32768); return e && typeof e === 'object' ? e : null; };
  return {tick, etat};
}
