/* JARVIS OS 0.22.0 : la voix refaite (retour du propriétaire, 18/11/2026 : « lente, entend mal, ne m'entend plus quand elle parle,
   la météo de lundi » ; choix QCM : Whisper sur le serveur, couper à la voix ou d'un appui, réponses instantanées puis Haiku).
   1. L'écoute : Whisper (faster-whisper), gratuit, gardé en mémoire sur le serveur par un petit programme Python, comme la voix Pierre.
   2. Les réponses instantanées, sans IA : heure, date, météo (Open-Meteo, gratuit, sans clé), agenda, ce qui attend sa réponse,
      où en est un bot. Le reste part à Claude (Haiku, Sonnet quand il dit « réfléchis »). */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const nrm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'");

/* ---------- 1. l'écoute ---------- */
/* mots que Whisper doit reconnaître (noms des bots, mots de JARVIS) : donnés en amorce, ils corrigent l'orthographe et l'écoute */
export const VOCAB = 'JARVIS, Claude, Iris, Chronos, Kairos, Ulysse, Athéna, Argus, Grok, Pilotage, Canal, CRA, agenda, météo, rendez-vous, échéance, il fait frais.';
/* phrases que Whisper invente sur un silence ou un bruit (connues en français) : jamais envoyées */
const HALLU = /amara\.org|sous-titr|merci d'avoir regard|abonnez-vous|n'oubliez pas de vous abonner|merci de votre attention|^\W*(merci|bonjour|au revoir)?\W*$/i;
export const halluc = (t) => HALLU.test(String(t || '').trim());

export function createEcoute({dir, py, helper, model, fakeHelper, log = () => {}}) {
  const ready = () => !!fakeHelper || (fs.existsSync(py) && fs.existsSync(path.join(dir, 'ok')));
  let H = null;
  function proc() {
    if (H && !H.dead) return H;
    const cmd = fakeHelper ? [process.execPath, [fakeHelper]] : [py, [helper, model, path.join(dir, 'models')]];
    const child = spawn(cmd[0], cmd[1], {stdio: ['pipe', 'pipe', 'pipe']});
    const h = {child, buf: '', waits: new Map(), dead: false, ready: false, err: ''};
    child.on('close', () => { h.dead = true; for (const w of h.waits.values()) w({ok: false, error: 'écoute arrêtée'}); h.waits.clear(); });
    child.on('error', () => { h.dead = true; });
    child.stderr.on('data', (d) => { h.err = (h.err + d).slice(-800); });
    child.stdout.on('data', (d) => {
      h.buf += d; let i;
      while ((i = h.buf.indexOf('\n')) >= 0) {
        const line = h.buf.slice(0, i); h.buf = h.buf.slice(i + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.ready) { h.ready = true; continue; }
        const w = h.waits.get(m.id); if (w) { h.waits.delete(m.id); w(m); }
      }
    });
    return (H = h);
  }
  /* au démarrage du serveur : le modèle se charge une fois (2 à 5 s), pas à la première phrase */
  const warm = () => { if (ready()) { try { proc(); } catch { /* rien */ } } };
  async function transcribe(wav, tmpDir) {
    if (!ready()) return {ok: false, error: 'ecoute_absente'};
    const h = proc(), id = crypto.randomUUID(), f = path.join(tmpDir, id + '.wav');
    fs.mkdirSync(tmpDir, {recursive: true}); fs.writeFileSync(f, wav);
    const t0 = Date.now();
    const r = await new Promise((resolve) => {
      const timer = setTimeout(() => { h.waits.delete(id); resolve({ok: false, error: 'trop long'}); }, 30000);
      h.waits.set(id, (m) => { clearTimeout(timer); resolve(m); });
      try { h.child.stdin.write(JSON.stringify({id, wav: f, prompt: VOCAB}) + '\n'); } catch { clearTimeout(timer); h.waits.delete(id); resolve({ok: false, error: 'écoute injoignable'}); }
    });
    fs.rm(f, {force: true}, () => {});
    if (!r.ok) { log('écoute : ' + (r.error || 'échec') + (h.err ? ' — ' + h.err.slice(-200) : '')); return {ok: false, error: r.error || 'échec'}; }
    const text = String(r.text || '').replace(/\s+/g, ' ').trim();
    return {ok: true, text: halluc(text) ? '' : text, ms: Date.now() - t0};
  }
  const stop = () => { if (H) { try { H.child.kill(); } catch { /* rien */ } H = null; } };
  return {ready, warm, transcribe, stop};
}

/* un WAV mono 16 bits envoyé par l'iPhone : contrôle minimal (en-tête, taille) */
export function wavOk(b) { return Buffer.isBuffer(b) && b.length > 44 && b.length < 3e6 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE'; }

/* ---------- 2. les réponses instantanées ---------- */
const BOTS = {iris: 'Iris', chronos: 'Chronos', kairos: 'Kairos', ulysse: 'Ulysse', athena: 'Athéna', argus: 'Argus'};
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/* le jour visé par la phrase : 0 aujourd'hui, 1 demain… ; soir ; week-end (samedi et dimanche) */
export function quand(t, dow) {
  const l = nrm(t), q = {jour: 0, soir: /\b(ce soir|cette nuit)\b/.test(l), we: false, dit: "aujourd'hui"};
  if (/apres[- ]demain/.test(l)) return {...q, jour: 2, dit: 'après-demain'};
  if (/\bdemain\b/.test(l)) return {...q, jour: 1, dit: 'demain'};
  if (/\b(ce |le )?week[- ]?end\b/.test(l)) { const n = (6 - dow + 7) % 7; return {...q, jour: n, we: true, dit: 'ce week-end'}; }
  const j = JOURS.findIndex((x) => new RegExp('\\b' + x + '\\b').test(l));
  if (j >= 0) { const n = (j - dow + 7) % 7; return {...q, jour: n, dit: n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : JOURS[j]}; }
  return q;
}
/* ce que demande la phrase, si le serveur sait y répondre seul ; null sinon (Claude répond) */
export function intention(text) {
  const l = nrm(text).replace(/[?!.,;]+/g, ' ').replace(/\s+/g, ' ').trim(), mots = l.split(' ').filter(Boolean).length;
  if (!l) return null;
  const court = mots <= 14;
  if (court && /\b(quelle heure|l'heure qu'il est|il est quelle heure)\b/.test(l)) return {kind: 'heure'};
  if (court && /\b(quel jour|quelle date|on est le combien|la date d'aujourd'hui|on est quel jour)\b/.test(l) && !/\b(rendez|agenda|meteo)/.test(l)) return {kind: 'date'};
  if (!/\b(notes? de frais|frais de|les frais)\b/.test(l) && /\b(meteo|quel temps|temps fait|il fait (beau|froid|chaud|frais|combien|quel)|fera(-t-il)? (beau|froid|chaud)|va (t'il |t il |-t-il )?pleuvoir|pleuvoir|pluie|parapluie|neige|neiger|temperature|degres|manteau|veste|frais dehors|du frais|fait frais|fait froid|soleil)\b/.test(l)) return {kind: 'meteo', court};
  if (court && /\b(mon agenda|mes rendez-vous|mes rendez vous|mon planning|mon programme|qu'est-ce que j'ai|qu'est ce que j'ai|j'ai quoi|ai-je quelque chose|j'ai des rendez)\b/.test(l)) return {kind: 'agenda'};
  if (court && /\b(qu'est-ce qui m'attend|qu'est ce qui m'attend|mes demandes|pour moi|ce que je dois faire|qu'est-ce que je dois faire|qu'est ce que je dois faire|ce qui m'attend|a faire pour moi)\b/.test(l)) return {kind: 'pourmoi'};
  const b = Object.keys(BOTS).find((k) => new RegExp('\\b' + k + '\\b').test(l));
  if (court && b && /\b(ou en est|des nouvelles|a repondu|a fini|qu'a fait|qu'est-ce que fait|quoi de neuf (chez|avec|du cote))\b/.test(l)) return {kind: 'bot', bot: b};
  return null;
}

/* Open-Meteo : codes du temps (WMO) en mots */
export function ciel(c) {
  c = +c;
  if (c === 0) return 'ciel dégagé'; if (c === 1) return 'plutôt dégagé'; if (c === 2) return 'partiellement nuageux'; if (c === 3) return 'ciel couvert';
  if (c === 45 || c === 48) return 'brouillard'; if (c >= 51 && c <= 55) return 'bruine'; if (c === 56 || c === 57) return 'bruine verglaçante';
  if (c === 61) return 'pluie faible'; if (c === 63) return 'pluie'; if (c === 65) return 'forte pluie'; if (c === 66 || c === 67) return 'pluie verglaçante';
  if (c >= 71 && c <= 75) return 'neige'; if (c === 77) return 'grains de neige'; if (c >= 80 && c <= 82) return 'averses'; if (c === 85 || c === 86) return 'averses de neige';
  if (c === 95) return 'orage'; if (c >= 96) return 'orage avec grêle'; return 'temps variable';
}
const deg = (x) => Math.round(+x) + (Math.abs(Math.round(+x)) > 1 ? ' degrés' : ' degré');
/* la phrase de la météo, à partir de la réponse d'Open-Meteo (fuseau de Paris) */
export function meteoPhrase(j, q, today, t) {
  const d = j && j.daily, cur = j && j.current;
  if (!d || !Array.isArray(d.time)) return null;
  const ymdAt = (n) => new Date(Date.UTC(today.y, today.m - 1, today.d + n)).toISOString().slice(0, 10);
  const conseil = (min, max, p) => { const c = []; if (p >= 50) c.push('Prends un parapluie.'); if (min <= 3 || (max <= 8 && /froid|frais|manteau|veste/.test(nrm(t)))) c.push('Couvre-toi bien.'); return c.length ? ' ' + c.join(' ') : ''; };
  const jour = (n, label) => {
    const i = d.time.indexOf(ymdAt(n)); if (i < 0) return null;
    const min = d.temperature_2m_min[i], max = d.temperature_2m_max[i], p = d.precipitation_probability_max ? +d.precipitation_probability_max[i] || 0 : 0;
    return {txt: label + ' : entre ' + Math.round(min) + ' et ' + deg(max) + ', ' + ciel(d.weather_code[i]) + (p >= 20 ? ', pluie probable à ' + p + ' %' : '') + '.', min, max, p};
  };
  if (q.we) {
    const a = jour(q.jour, 'Samedi'), b = jour(q.jour + 1, 'Dimanche'); if (!a) return null;
    return a.txt + (b ? ' ' + b.txt : '') + conseil(Math.min(a.min, b ? b.min : a.min), Math.max(a.max, b ? b.max : a.max), Math.max(a.p, b ? b.p : 0));
  }
  if (q.soir && j.hourly && Array.isArray(j.hourly.time)) {
    const ymd = ymdAt(q.jour), hs = j.hourly.time.map((x, i) => ({x, i})).filter((o) => o.x.slice(0, 10) === ymd && +o.x.slice(11, 13) >= 18 && +o.x.slice(11, 13) <= 23);
    if (hs.length) {
      const temps = hs.map((o) => +j.hourly.temperature_2m[o.i]), p = Math.max(...hs.map((o) => +(j.hourly.precipitation_probability || [])[o.i] || 0)), codes = hs.map((o) => +j.hourly.weather_code[o.i]);
      return (q.jour === 0 ? 'Ce soir' : q.dit.charAt(0).toUpperCase() + q.dit.slice(1) + ' soir') + ' : entre ' + Math.round(Math.min(...temps)) + ' et ' + deg(Math.max(...temps)) + ', ' + ciel(Math.max(...codes)) + (p >= 20 ? ', pluie probable à ' + p + ' %' : '') + '.' + conseil(Math.min(...temps), Math.max(...temps), p);
    }
  }
  const label = q.jour === 0 ? "Aujourd'hui" : q.jour === 1 ? 'Demain' : q.jour === 2 ? 'Après-demain' : q.dit.charAt(0).toUpperCase() + q.dit.slice(1);
  const a = jour(q.jour, label); if (!a) return null;
  const now = q.jour === 0 && cur && cur.temperature_2m != null ? 'En ce moment ' + deg(cur.temperature_2m) + (cur.apparent_temperature != null && Math.abs(cur.apparent_temperature - cur.temperature_2m) >= 2 ? ', ressenti ' + Math.round(cur.apparent_temperature) : '') + ', ' + ciel(cur.weather_code) + '. ' : '';
  return now + a.txt + conseil(a.min, a.max, a.p);
}
export function meteoUrl(base, lat, lon) {
  return base + '?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m'
    + '&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FParis&forecast_days=8';
}

/* l'heure et la date, dites comme on les dit */
export const heurePhrase = (t) => { const [H, M] = t.hm.split(':').map(Number); return 'Il est ' + H + ' h' + (M ? ' ' + String(M).padStart(2, '0') : '') + '.'; };
export const datePhrase = (d) => 'Nous sommes le ' + new Intl.DateTimeFormat('fr-FR', {timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).format(d) + '.';
