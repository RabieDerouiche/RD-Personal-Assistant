/* JARVIS OS 0.22.0 : la voix refaite (retour du propriétaire, 18/11/2026 : « lente, entend mal, ne m'entend plus quand elle parle,
   la météo de lundi » ; choix QCM : Whisper sur le serveur, couper à la voix ou d'un appui, réponses instantanées puis Haiku).
   1. L'écoute : Whisper (faster-whisper), gratuit, gardé en mémoire sur le serveur par un petit programme Python, comme la voix Pierre.
   2. Les réponses instantanées, sans IA : heure, date, météo (Open-Meteo, gratuit, sans clé), agenda, ce qui attend sa réponse,
      où en est un bot. Le reste part à Claude (Haiku, Sonnet quand il dit « réfléchis »). */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {BOT_NOMS} from './bots.mjs';

export const nrm = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'");

/* ---------- 1. l'écoute ---------- */
/* mots que Whisper doit reconnaître (noms des bots, mots de JARVIS) : donnés en amorce, ils corrigent l'orthographe et l'écoute */
export const VOCAB = 'JARVIS, Claude, Iris, Chronos, Kairos, Ulysse, Athéna, Argus, Plutus, Grok, Pilotage, Canal, CRA, agenda, météo, rendez-vous, échéance, il fait frais.';
/* phrases que Whisper invente sur un silence ou un bruit (connues en français) : jamais envoyées */
const HALLU = /amara\.org|sous-titr|merci d'avoir regard|abonnez-vous|n'oubliez pas de vous abonner|merci de votre attention|^\W*(merci|bonjour|au revoir)?\W*$/i;
export const halluc = (t) => HALLU.test(String(t || '').trim());

/* 0.32.0 : le moteur d'écoute. Parakeet (NVIDIA) une fois installé par install/ecoute.sh (marque parakeet/ok et parakeet/variante.json),
   sinon Whisper ; JARVIS_ECOUTE_MOTEUR=whisper garde Whisper. Variante « int8 » (sherpa-onnx, serveur de 4 Go) ou « fine »
   (encodeur requantifié, onnx-asr, 8 Go et plus) : mesures dans stt/parakeet_helper.py et docs/jarvis-os.md (0.32.0). */
export function choixEcoute(dir, env = process.env) {
  if (env.JARVIS_ECOUTE_MOTEUR === 'whisper') return {moteur: 'whisper'};
  try {
    if (fs.existsSync(path.join(dir, 'parakeet', 'ok'))) {
      const v = JSON.parse(fs.readFileSync(path.join(dir, 'parakeet', 'variante.json'), 'utf8'));
      if (v && ['sherpa', 'onnxasr'].includes(v.engine) && /^[a-z0-9]+$/.test(String(v.variante || ''))) return {moteur: 'parakeet', engine: v.engine, variante: v.variante, modelDir: path.join(dir, 'parakeet', v.variante)};
    }
  } catch { /* marque illisible : Whisper */ }
  return {moteur: 'whisper'};
}
export function createEcoute({dir, py, helper, parakeetHelper, model, fakeHelper, log = () => {}, delaiMs = 30000}) {
  const ready = () => !!fakeHelper || (fs.existsSync(py) && (fs.existsSync(path.join(dir, 'ok')) || choixEcoute(dir).moteur === 'parakeet'));
  let H = null;
  function proc() {
    if (H && !H.dead) return H;
    const c = choixEcoute(dir);
    const cmd = fakeHelper ? [process.execPath, [fakeHelper]] : c.moteur === 'parakeet' && parakeetHelper ? [py, [parakeetHelper, c.engine, c.modelDir]] : [py, [helper, model, path.join(dir, 'models')]];
    const child = spawn(cmd[0], cmd[1], {stdio: ['pipe', 'pipe', 'pipe']});
    const h = {child, buf: '', waits: new Map(), dead: false, ready: false, err: ''};
    child.on('close', () => { h.dead = true; for (const w of h.waits.values()) w({ok: false, error: 'écoute arrêtée'}); h.waits.clear(); });
    child.on('error', () => { h.dead = true; });
    child.stdin.on('error', () => { /* 0.70.0 : écoute déjà arrêtée (EPIPE) : le serveur ne doit pas tomber ; « close » rend les attentes */ });
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
      /* 0.70.0 : 30 s sans réponse : le programme est figé (ou débordé) ; il est relancé à la phrase suivante, s'il avait fini de charger
         son modèle (sinon il charge encore : on le laisse finir) */
      const timer = setTimeout(() => { h.waits.delete(id); if (h.ready) { try { h.child.kill('SIGKILL'); } catch { /* rien */ } if (H === h) H = null; } resolve({ok: false, error: 'trop long'}); }, delaiMs);
      h.waits.set(id, (m) => { clearTimeout(timer); resolve(m); });
      try { h.child.stdin.write(JSON.stringify({id, wav: f, prompt: VOCAB}) + '\n'); } catch { clearTimeout(timer); h.waits.delete(id); resolve({ok: false, error: 'écoute injoignable'}); }
    });
    fs.rm(f, {force: true}, () => {});
    if (!r.ok) { log('écoute : ' + (r.error || 'échec') + (h.err ? ' — ' + h.err.slice(-200) : '')); return {ok: false, error: r.error || 'échec'}; }
    const text = String(r.text || '').replace(/\s+/g, ' ').trim();
    return {ok: true, text: halluc(text) ? '' : text, ms: Date.now() - t0};
  }
  const stop = () => { if (H) { try { H.child.kill(); } catch { /* rien */ } H = null; } };
  /* ce qui écoute : « parakeet » (et sa variante) ou « whisper » ; le faux moteur du banc se dit Whisper, sauf JARVIS_FAUX_MOTEUR */
  const moteur = () => { if (fakeHelper) return {moteur: process.env.JARVIS_FAUX_MOTEUR || 'whisper'}; const c = choixEcoute(dir); return c.moteur === 'parakeet' ? {moteur: 'parakeet', variante: c.variante} : {moteur: 'whisper', modele: model}; };
  return {ready, warm, transcribe, stop, moteur};
}

/* 0.36.0 : la fin de phrase reconnue à la voix (Smart Turn v3.2, stt/tour_helper.py), installée par install/ecoute.sh (marque tour/ok).
   Un petit programme Python garde le modèle (8,7 Mo) en mémoire ; verdict(wav) → {ok, p} (probabilité que la phrase soit finie).
   JARVIS_TOUR_HELPER : faux modèle du banc. */
export function createTour({dir, py, helper, fakeHelper, log = () => {}, delaiMs = 3000}) {
  const model = path.join(dir, 'tour', 'smart-turn-v3.2-cpu.onnx');
  const ready = () => !!fakeHelper || (fs.existsSync(py) && fs.existsSync(path.join(dir, 'tour', 'ok')) && fs.existsSync(model));
  let H = null;
  function proc() {
    if (H && !H.dead) return H;
    const child = fakeHelper ? spawn(process.execPath, [fakeHelper], {stdio: ['pipe', 'pipe', 'pipe']}) : spawn(py, [helper, model], {stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env, JARVIS_TOUR_THREADS: process.env.JARVIS_TOUR_THREADS || '1'}});
    const h = {child, buf: '', waits: new Map(), dead: false, ready: false, lents: 0, err: ''};
    child.on('close', () => { h.dead = true; for (const w of h.waits.values()) w({ok: false, error: 'fin de phrase arrêtée'}); h.waits.clear(); });
    child.on('error', () => { h.dead = true; });
    child.stdin.on('error', () => { /* 0.70.0 : programme déjà arrêté (EPIPE) : le serveur ne doit pas tomber ; « close » rend les attentes */ });
    child.stderr.on('data', (d) => { h.err = (h.err + d).slice(-800); });
    child.stdout.on('data', (d) => {
      h.buf += d; let i;
      while ((i = h.buf.indexOf('\n')) >= 0) {
        const line = h.buf.slice(0, i); h.buf = h.buf.slice(i + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.ready) { h.ready = true; continue; }
        h.lents = 0;
        const w = h.waits.get(m.id); if (w) { h.waits.delete(m.id); w(m); }
      }
    });
    return (H = h);
  }
  const warm = () => { if (ready()) { try { proc(); } catch { /* rien */ } } };
  async function verdict(wav, tmpDir) {
    if (!ready()) return {ok: false, error: 'fin_de_phrase_absente'};
    const h = proc(), id = crypto.randomUUID(), f = path.join(tmpDir, 'tour-' + id + '.wav');
    fs.mkdirSync(tmpDir, {recursive: true}); fs.writeFileSync(f, wav);
    const r = await new Promise((resolve) => {
      /* au-delà de 3 s, la phrase part comme avant ; 0.70.0 : deux fois de suite sans réponse (programme figé), il est relancé à la pause suivante */
      const timer = setTimeout(() => { h.waits.delete(id); if (h.ready && ++h.lents >= 2) { try { h.child.kill('SIGKILL'); } catch { /* rien */ } if (H === h) H = null; } resolve({ok: false, error: 'trop long'}); }, delaiMs);
      h.waits.set(id, (m) => { clearTimeout(timer); resolve(m); });
      try { h.child.stdin.write(JSON.stringify({id, wav: f}) + '\n'); } catch { clearTimeout(timer); h.waits.delete(id); resolve({ok: false, error: 'fin de phrase injoignable'}); }
    });
    fs.rm(f, {force: true}, () => {});
    if (!r.ok || typeof r.p !== 'number') { log('fin de phrase : ' + (r.error || 'échec') + (h.err ? ' — ' + h.err.slice(-200) : '')); return {ok: false, error: r.error || 'échec'}; }
    return {ok: true, p: Math.max(0, Math.min(1, r.p)), ms: r.ms};
  }
  const stop = () => { if (H) { try { H.child.kill(); } catch { /* rien */ } H = null; } };
  return {ready, warm, verdict, stop};
}

/* un WAV mono 16 bits envoyé par l'iPhone : contrôle minimal (en-tête, taille) */
export function wavOk(b) { return Buffer.isBuffer(b) && b.length > 44 && b.length < 3e6 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE'; }

/* ---------- 2. les réponses instantanées ---------- */
const BOTS = BOT_NOMS;
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/* le jour visé par la phrase : 0 aujourd'hui, 1 demain… ; soir ; week-end (samedi et dimanche).
   0.70.0 : « demain soir » est un soir ; « ce week-end » dit un dimanche, c'est aujourd'hui ; « lundi prochain » dit un lundi, c'est dans 7 jours */
export function quand(t, dow) {
  const l = nrm(t), prochain = /\bprochaine?\b/.test(l), q = {jour: 0, soir: /\b(soir|soiree|cette nuit)\b/.test(l), we: false, dit: "aujourd'hui"};
  if (/apres[- ]demain/.test(l)) return {...q, jour: 2, dit: 'après-demain'};
  if (/\bdemain\b/.test(l)) return {...q, jour: 1, dit: 'demain'};
  if (/\b(ce |le )?week[- ]?end\b/.test(l)) {
    if (dow === 0 && !prochain) return q;
    let n = (6 - dow + 7) % 7; if (prochain && n === 0) n = 7;
    return {...q, jour: n, we: true, dit: prochain ? 'le week-end prochain' : 'ce week-end'};
  }
  const j = JOURS.findIndex((x) => new RegExp('\\b' + x + '\\b').test(l));
  if (j >= 0) { let n = (j - dow + 7) % 7; if (prochain && n === 0) n = 7; return {...q, jour: n, dit: n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : n === 7 ? JOURS[j] + ' prochain' : JOURS[j]}; }
  return q;
}
/* 0.70.0 : une phrase qui demande d'agir (rappel, ajout, achat, message, réglage…) n'a jamais de réponse instantanée : Claude s'en occupe */
const ORDRE = /^(rappelle|ajoute|rajoute|achete|commande|note|mets|envoie|ecris|cherche|trouve|reserve|baisse|monte|regle|allume|eteins|prepare|redige|fais|lance|supprime|enleve|retire|annule|deplace|programme|planifie|cree|demande|relance|previens|reponds)\b|^dis (a|au|aux)\b|\b(rappeler|ajouter|rajouter|noter|acheter|commander|reserver)\b/;
/* 0.70.0 : l'heure et la date d'ici et de maintenant, demandées seules : pas « à quelle heure part… », « quel jour tombe… », l'heure d'une autre ville */
const DEBUT = "^((et|alors|bon|dis|dis-moi|dis moi|donne-moi|donne moi|tu as|t'as|as-tu|tu sais|sais-tu|c'est quoi|tu peux me dire|peux-tu me dire|peux tu me dire) )?";
const FIN = "( maintenant| en ce moment| exactement| deja| la| aujourd'hui| d'aujourd'hui| du jour)?$";
const HEURE = new RegExp(DEBUT + "(quelle heure|quelle heure (est-il|est il|il est|c'est)|(il est|c'est) quelle heure|l'heure qu'il est|l'heure)" + FIN);
const DATE = new RegExp(DEBUT + "(quel jour|quelle date|quelle est la date|(on est|nous sommes|c'est) quel jour|(on est|nous sommes) le combien|quel jour (on est|est-on|est on|sommes-nous|sommes nous|nous sommes|est-il|est il|c'est)|quelle date (on est|est-on|est on|sommes-nous|sommes nous|nous sommes|est-il|est il|c'est)|la date)" + FIN);
/* ce que demande la phrase, si le serveur sait y répondre seul ; null sinon (Claude répond). 0.70.0 : une salutation (« Bonjour Jarvis, quelle heure
   est-il ? ») ou un « euh » devant n'empêchent pas la réponse instantanée */
export function intention(text) {
  const l = nrm(text).replace(/[?!.,;]+/g, ' ').replace(/\s+/g, ' ').trim(), mots = l.split(' ').filter(Boolean).length;
  if (!l || ORDRE.test(l)) return null;
  const court = mots <= 14, passe = /\b(hier|avant-hier)\b/.test(l), seul = l.replace(/\b(jarvis|bonjour|bonsoir|salut|coucou|hello|hey|he|eh|euh|ok|okay|oui|stp|svp|s'il te plait|s'il vous plait|merci)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (court && HEURE.test(seul)) return {kind: 'heure'};
  if (court && DATE.test(seul)) return {kind: 'date'};
  if (!passe && !/\b(notes? de frais|frais de|les frais)\b/.test(l) && !/\b(liste|courses|panier|chauffage|thermostat|radiateur|clim|climatisation|four|frigo|congelateur|bain|piscine)\b/.test(l) && /\b(meteo|quel temps|temps fait|il fait (beau|froid|chaud|frais|combien|quel)|fera(-t-il)? (beau|froid|chaud)|va (t'il |t il |-t-il )?pleuvoir|pleuvoir|pluie|parapluie|neige|neiger|temperature|degres|manteau|veste|frais dehors|du frais|fait frais|fait froid|soleil)\b/.test(l)) return {kind: 'meteo', court};
  if (court && !passe && /\b(mon agenda|mes rendez-vous|mes rendez vous|mon planning|mon programme|qu'est-ce que j'ai|qu'est ce que j'ai|j'ai quoi|ai-je quelque chose|j'ai des rendez)\b/.test(l)
    && !/\b(oublie|perdu|rate|loupe|manque|mange|bu|dit|ecrit|envoye|recu|gagne|paye|depense|vu|lu|appris|casse|fait (de|du|des|avec|a)|mal|malade|fievre|liste|courses|panier)\b/.test(l)) return {kind: 'agenda'};
  if (court && /\b(qu'est-ce qui m'attend|qu'est ce qui m'attend|mes demandes|quoi de neuf pour moi|rien pour moi|quelque chose pour moi|ce que je dois faire|qu'est-ce que je dois faire|qu'est ce que je dois faire|ce qui m'attend|a faire pour moi)\b/.test(l)) return {kind: 'pourmoi'};
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

/* 0.22.1 : la diction de Pierre (Piper lit « 18 h 49 » « dix-huit ache », « 7° », « 30 % », « 18/11 » chiffre par chiffre) : écrit comme on le dit.
   0.70.0 : « 7° et 9° » ne colle plus le mot suivant (on lisait « degréset »), « 7°. » est lu aussi, « 1° » et « -1° » font « degré » au singulier */
const MOIS_DIT = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const diction = (t) => String(t || '')
  .replace(/\bJ\.A\.R\.V\.I\.S\b\.?/g, 'Jarvis').replace(/\bJARVIS\b/g, 'Jarvis').replace(/\bJarvis\s+OS\b\.?/g, 'Jarvis O.S.')   /* 0.47.0 : son nom, J.A.R.V.I.S OS, se dit « Jarvis O.S. » (Google épelait les majuscules) */
  .replace(/(\d),00(?!\d)/g, '$1')
  .replace(/\b(\d{1,2})\s*h\s*(\d{2})\b/g, (m, H, M) => H + (+H > 1 ? ' heures' : ' heure') + (M === '00' ? '' : ' ' + +M))
  .replace(/\b(\d{1,2})\s*h\b(?![\wÀ-ÿ'])/g, (m, H) => H + (+H > 1 ? ' heures' : ' heure'))
  .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m, d, mo, y) => (+mo >= 1 && +mo <= 12 ? (+d === 1 ? '1er' : +d) + ' ' + MOIS_DIT[+mo - 1] + ' ' + y : m))
  .replace(/\b(\d{1,2})\/(\d{1,2})\b/g, (m, d, mo) => (+mo >= 1 && +mo <= 12 && +d <= 31 ? (+d === 1 ? '1er' : +d) + ' ' + MOIS_DIT[+mo - 1] : m))
  .replace(/(-?\d+)\s*°(?:\s*C(?![A-Za-zÀ-ÿ]))?/g, (m, d) => d + (Math.abs(+d) >= 2 ? ' degrés' : ' degré')).replace(/(\d)\s*%/g, '$1 pour cent').replace(/(\d)\s*€/g, '$1 euros')
  .replace(/\bJ-(\d+)\b/g, 'dans $1 jours').replace(/\bRDV\b/gi, 'rendez-vous').replace(/(\d)\s*km\b/g, '$1 kilomètres').replace(/(\d)\s*min\b/g, '$1 minutes')
  .replace(/(\d)[\s\u202f\u00a0](?=\d{3}\b)/g, '$1').replace(/[«»"]/g, ' ').replace(/\s*;\s*/g, '. ').replace(/\s+([.,:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
