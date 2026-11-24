/* JARVIS OS — ce que le serveur surveille pour prévenir le propriétaire (notifications), sans bot ni Claude :
   1. un bot a répondu dans le Canal, ou lui demande quelque chose (Canal relu toutes les 2 minutes) ;
   2. les rappels du matin (onglet Échéances : aujourd'hui, demain, dans 7 jours ; onglet Papiers : fin de validité à 90, 30, 7 jours et le jour même) ;
   3. Grok est reparti après une pause : combien de lignes attendent les bots (la sonnette reste un geste de l'app, avec ses 5 s pour annuler).
   Rien n'est lu s'il n'y a aucun appareil abonné ou si Google n'est pas relié. Lecture seule de Pilotage : le serveur n'écrit rien ici. */
import {BOT_IDS} from './bots.mjs';
const low = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const BOTS = BOT_IDS;
const OPEN = (st) => !['fait', 'annule', 'annulee'].includes(low(st));

/* date et heure de Paris, quel que soit le fuseau du serveur */
export function paris(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(d).map((x) => [x.type, x.value]));
  return {ymd: p.year + '-' + p.month + '-' + p.day, hm: p.hour + ':' + p.minute, y: +p.year, m: +p.month, d: +p.day};
}
/* une heure de Paris (AAAA-MM-JJ, HH:MM) en instant exact, changement d'heure compris */
export function parisMs(ymd, hm) {
  const [y, m, d] = ymd.split('-').map(Number), [H, M] = hm.split(':').map(Number), want = Date.UTC(y, m - 1, d, H, M); let t = want;
  for (let k = 0; k < 3; k++) { const p = paris(new Date(t)); t -= Date.UTC(p.y, p.m - 1, p.d, +p.hm.slice(0, 2), +p.hm.slice(3, 5)) - want; }
  return t;
}
/* ligne « Grok en pause jusqu'au » de l'onglet Faits (écrite par la page : « 17/11/2026 13h05 ») : instant de reprise, ou null
   (pas de ligne, valeur illisible, ou « reprise » / « sonnée » écrit à la place de la date) ; undefined si l'onglet n'a pas la ligne */
export function pauseDepuisFaits(rows) {
  const hd = (rows[0] || []).map(low), iF = hd.indexOf('fait'), iV = hd.indexOf('valeur');
  if (iF < 0 || iV < 0) return undefined;
  const r = rows.slice(1).find((x) => low(x[iF]) === "grok en pause jusqu'au"); if (!r) return undefined;
  const v = String(r[iV] || ''); if (/sonn|repris/i.test(v)) return null;
  const m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+?(\d{1,2})\s*[h:]\s*(\d{2})?)?/); if (!m) return null;
  return parisMs(m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'), (m[4] ? m[4].padStart(2, '0') : '12') + ':' + (m[5] || '00'));
}
/* nombre de jours entre aujourd'hui (Paris) et une date JJ/MM/AAAA trouvée dans le texte ; null si aucune */
export function daysTo(text, today) {
  const m = String(text || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return null;
  return Math.round((Date.UTC(+m[3], +m[2] - 1, +m[1]) - Date.UTC(today.y, today.m - 1, today.d)) / 864e5);
}
/* 0.20.0 (choix QCM du 18/11/2026 : « serveur + colonne Rappels ») : les paliers de la colonne Rappels d'Échéances, en dates (AAAA-MM-JJ).
   Comprend « 3 mois », « 1 semaine », « 60, 30 et 7 jours », « le jour même » et « vendredi d'avant » (le vendredi juste avant la date) ;
   ex. « 3 mois, 1 mois, 1 semaine avant, vendredi d'avant ». Le reste du texte (« pour le budget ») est ignoré. */
export function paliers(txt, dateFr) {
  const m = String(dateFr || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return [];
  const y = +m[3], mo = +m[2] - 1, d = +m[1], t = low(txt), out = new Set(), ymd = (x) => x.toISOString().slice(0, 10);
  for (const x of t.matchAll(/(\d+)\s*mois/g)) out.add(ymd(new Date(Date.UTC(y, mo - +x[1], d))));
  for (const x of t.matchAll(/(\d+)\s*semaines?/g)) out.add(ymd(new Date(Date.UTC(y, mo, d - 7 * +x[1]))));
  if (/jour/.test(t)) for (const x of t.matchAll(/(\d+)(?!\s*(?:mois|semaine|\d))/g)) out.add(ymd(new Date(Date.UTC(y, mo, d - +x[1]))));
  if (/jour meme/.test(t)) out.add(ymd(new Date(Date.UTC(y, mo, d))));
  if (/vendredi/.test(t)) { const e = new Date(Date.UTC(y, mo, d)), back = ((e.getUTCDay() - 5 + 7) % 7) || 7; out.add(ymd(new Date(Date.UTC(y, mo, d - back)))); }
  return [...out].sort();
}
const cols = (rows) => { const hd = (rows[0] || []).map(low); return (name) => hd.indexOf(name); };
const when = (n) => n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : 'Dans ' + n + ' jours';

export function createNotifier({S, save, push, read, linked, pause, now = () => Date.now(), everyMs = 120000}) {
  S.notify = Object.assign({canal: null, digest: '', resume: '', lastCanal: 0}, S.notify || {});
  const prefs = () => S.push.prefs || {};
  const ready = () => S.push.subs.length > 0 && linked();
  /* 0.73.0 : la journée (ou la reprise) n'est marquée faite qu'après des lectures de Pilotage réussies ; une lecture ratée (Google 503,
     réseau) est réessayée 10 minutes plus tard, au lieu de perdre les rappels du jour. En mémoire seulement : un redémarrage réessaie tout de suite. */
  const REESSAI = 10 * 60000; let digestEssai = 0, resumeEssai = 0;

  /* 1. le Canal : réponses des bots aux lignes du propriétaire ou de Claude, et nouvelles demandes des bots pour lui */
  function canalEvents(rows) {
    const c = cols(rows), iDe = c('de'), iPour = c('pour'), iSt = c('statut'), iRep = c('reponse'), iMsg = c('message'), iType = c('type'), iObj = c('objet'), iDate = c('date');
    if ([iDe, iPour, iSt, iRep, iMsg].some((i) => i < 0)) return {events: [], seen: S.notify.canal || {}, badge: null};
    const seen = {}, events = [], prev = S.notify.canal; let badge = 0;
    rows.slice(1).forEach((r, k) => {
      const de = low(r[iDe]), pour = low(r[iPour]), st = String(r[iSt] ?? ''), rep = String(r[iRep] ?? '').trim();
      if (pour === 'rabie' && ['a faire', ''].includes(low(st))) badge++;
      if (low(st) === 'attend ton oui') badge++;
      const toBot = BOTS.includes(pour) && ['rabie', 'claude'].includes(de), fromBot = pour === 'rabie' && BOTS.includes(de);
      if (!toBot && !fromBot) return;
      const key = (k + 2) + '|' + (r[iDate] || '') + '|' + String(r[iMsg] || '').slice(0, 40), now1 = {s: low(st), r: rep.slice(0, 200)};
      seen[key] = now1;
      if (!prev) return;   /* première lecture : on prend l'état tel quel, sans rien annoncer */
      const before = prev[key], what = String((iObj >= 0 && r[iObj]) || (iType >= 0 && r[iType]) || '').trim();
      if (toBot && before) {
        if (now1.s === 'attend ton oui' && before.s !== 'attend ton oui') events.push({bot: String(r[iPour]).trim(), kind: 'oui', what, text: rep, row: k + 2});
        else if (rep && now1.r !== before.r) events.push({bot: String(r[iPour]).trim(), kind: 'reponse', what, text: rep, row: k + 2});
      }
      if (fromBot && !before && OPEN(st)) events.push({bot: String(r[iDe]).trim(), kind: 'demande', what, text: String(r[iMsg] || '').trim(), row: k + 2});
    });
    return {events, seen, badge};
  }
  /* 18/11/2026 : l'adresse mène à la ligne du Canal (« /#voir-<ligne> ») ; l'app relit Pilotage et ouvre la réponse */
  function canalMessage(events, badge) {
    const line = (e) => e.bot + (e.kind === 'demande' ? ' te demande' : e.kind === 'oui' ? ' attend ton oui' : ' a répondu') + (e.what ? ' (' + e.what + ')' : '') + ' : ' + e.text.replace(/\s+/g, ' ').slice(0, 140);
    if (events.length === 1) { const e = events[0]; return {title: e.bot + (e.kind === 'demande' ? ' te demande' : e.kind === 'oui' ? ' attend ton oui' : ' a répondu'), body: (e.what ? e.what + ' : ' : '') + e.text.replace(/\s+/g, ' ').slice(0, 220), url: '/#voir-' + e.row, badge, tag: 'canal'}; }
    return {title: events.length + ' nouvelles de tes bots', body: events.slice(0, 3).map(line).join('\n') + (events.length > 3 ? '\n… et ' + (events.length - 3) + ' autres' : ''), url: '/#voir-recent', badge, tag: 'canal'};
  }
  async function checkCanal(force) {
    if (!force && now() - (S.notify.lastCanal || 0) < everyMs) return null;
    S.notify.lastCanal = now();
    const rows = await read('Canal!A1:H3000');
    const {events, seen, badge} = canalEvents(rows);
    S.notify.canal = seen; save();
    if (!events.length || prefs().bots === false) return {events: events.length, sent: false};
    await push.send(canalMessage(events, badge), {urgency: 'high'});
    return {events: events.length, sent: true};
  }

  /* 2. les rappels du matin, une fois par jour à l'heure choisie */
  async function checkDigest(force) {
    const t = paris(new Date(now()));
    if (!force && (S.notify.digest === t.ymd || t.hm < (prefs().heure || '08:00') || now() - digestEssai < REESSAI)) return null;
    digestEssai = now();
    if (prefs().rappels === false) { S.notify.digest = t.ymd; save(); return {lines: 0, sent: false}; }
    const lines = [];
    const ech = await read("'Échéances'!A1:H1000"), pap = await read('Papiers!A1:G300');
    S.notify.digest = t.ymd; save();
    const ce = cols(ech), iD = ce('date'), iS = ce('sujet'), iSt = ce('statut');
    if (iD >= 0 && iS >= 0) ech.slice(1).forEach((r) => { const n = daysTo(r[iD], t); if ([0, 1, 7].includes(n) && OPEN(iSt >= 0 ? r[iSt] : '')) lines.push({n, t: when(n) + ' : ' + String(r[iS]).trim()}); });
    /* 0.20.0 : et les paliers de la colonne Rappels (3 mois, 1 mois, 1 semaine, vendredi d'avant…), sans doublon avec les rappels ci-dessus */
    const iR = ce('rappels');
    if (iD >= 0 && iS >= 0 && iR >= 0) ech.slice(1).forEach((r) => { const n = daysTo(r[iD], t); if (n == null || n <= 1 || n === 7 || !OPEN(iSt >= 0 ? r[iSt] : '')) return; if (paliers(r[iR], r[iD]).includes(t.ymd)) lines.push({n, t: (n % 7 === 0 && n <= 56 ? 'Dans ' + n / 7 + ' semaine' + (n > 7 ? 's' : '') : n >= 28 && n <= 31 ? 'Dans 1 mois' : when(n)) + ' : ' + String(r[iS]).trim()}); });
    const cp = cols(pap), iDoc = cp('document'), iV = cp("valable jusqu'au"), iP = cp('personne');
    if (iDoc >= 0 && iV >= 0) pap.slice(1).forEach((r) => { const n = daysTo(r[iV], t); if ([0, 7, 30, 90].includes(n)) lines.push({n, t: String(r[iDoc]).trim() + (iP >= 0 && r[iP] ? ' (' + String(r[iP]).trim() + ')' : '') + (n === 0 ? " : dernier jour de validité aujourd'hui" : ' : expire dans ' + n + ' jours')}); });
    if (!lines.length) return {lines: 0, sent: false};
    lines.sort((a, b) => a.n - b.n);
    await push.send({title: lines.length === 1 ? 'Rappel du jour' : lines.length + ' rappels du jour', body: lines.slice(0, 5).map((x) => x.t).join('\n') + (lines.length > 5 ? '\n… et ' + (lines.length - 5) + ' autres' : ''), url: '/#voir-echeances', tag: 'rappels'});
    return {lines: lines.length, sent: true};
  }

  /* 3. fin de la pause de Grok (ligne « Grok en pause jusqu'au » de l'onglet Faits, sinon la date des réglages du serveur) : combien de lignes attendent les bots */
  async function checkResume(force) {
    const end = pause ? await pause() : (S.config && S.config.grokPauseUntil ? Date.parse(S.config.grokPauseUntil) : NaN), until = String(end);
    if (!end || isNaN(end) || end > now() || now() - end > 24 * 3600000 || (!force && (S.notify.resume === until || now() - resumeEssai < REESSAI))) return null;   /* une reprise de plus de 24 h n'est plus une nouvelle */
    resumeEssai = now();
    const rows = await read('Canal!A1:H3000');
    S.notify.resume = until; save();
    const c = cols(rows), iPour = c('pour'), iSt = c('statut');
    const per = {}; rows.slice(1).forEach((r) => { const p = low(r[iPour]); if (BOTS.includes(p) && low(r[iSt]) === 'a faire') per[String(r[iPour]).trim()] = (per[String(r[iPour]).trim()] || 0) + 1; });
    const n = Object.values(per).reduce((a, b) => a + b, 0);
    if (!n) return {lines: 0, sent: false};
    await push.send({title: 'Grok est reparti', body: n + (n > 1 ? ' lignes attendent' : ' ligne attend') + ' tes bots (' + Object.entries(per).map(([b, k]) => b + ' ' + k).join(', ') + '). Ouvre JARVIS pour envoyer la sonnette.', url: '/#demandes', tag: 'reprise'}, {urgency: 'high'});
    return {lines: n, sent: true};
  }

  async function tick(what = {}) {
    if (!ready()) return {skipped: true};
    const out = {};
    for (const [k, fn] of [['resume', checkResume], ['canal', checkCanal], ['digest', checkDigest]]) {
      if (what.only && what.only !== k) continue;
      try { out[k] = await fn(!!what.force); } catch (e) { out[k] = {error: String(e && e.message || e).slice(0, 160)}; }
    }
    return out;
  }
  return {tick, canalEvents, canalMessage};
}
