/* JARVIS OS 0.25.0 : un seul Claude (choix du propriétaire, QCM du 19/11/2026). La conversation continue (micro toujours ouvert,
   coupure à la voix, cerveau à part qui ne voyait aucune de ses données) est retirée de la nouvelle app. Ce module ne garde que :
   - l'orbe de la barre du bas et le globe du thème Hologramme ;
   - la dictée d'UNE question (Whisper du serveur s'il est installé, sinon la reconnaissance de l'iPhone) : le micro s'ouvre,
     écoute une phrase, se referme ; le texte revient à la page, qui le met dans le champ de la discussion avec Claude ;
   - la lecture d'une réponse à voix haute (Pierre, la voix du serveur, phrase par phrase ; sinon la voix de l'iPhone).
   La page (essais/jarvis-os-maquette/index.html) décide de ce qu'ouvre l'orbe : la discussion avec Claude, qui a ses données. */
import {createOrb} from './orb';
import {createHolo, type HoloOpts} from './holo';
import {Ecoute, canEar} from './ecoute';
import {store} from './store';
import * as srv from './server';

const CSS = `
.jv-btn { position: fixed; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 60; width: 74px; height: 74px; border: 0; padding: 0; border-radius: 50%; background: radial-gradient(circle, rgba(10, 10, 30, .9) 55%, rgba(10, 10, 30, 0) 72%); cursor: pointer; }
.jv-btn .orb-stage { position: absolute; inset: -10px; pointer-events: none; overflow: hidden; border-radius: 50%; }
.jv-btn .orb-stage canvas { display: block; width: 100% !important; height: 100% !important; }
.jv-btn::after { content: ""; position: absolute; inset: 2px; border-radius: 50%; box-shadow: 0 0 0 1px rgba(180, 192, 255, .25), 0 8px 30px rgba(99, 102, 241, .45); animation: jvpulse 2.6s ease-in-out infinite; pointer-events: none; }
@keyframes jvpulse { 50% { box-shadow: 0 0 0 1px rgba(180, 192, 255, .35), 0 8px 44px rgba(124, 92, 255, .7); } }
.theme-holo .jv-btn { background: radial-gradient(circle, rgba(2, 8, 24, .95) 55%, rgba(2, 8, 24, 0) 72%); }
.theme-holo .jv-btn::after { box-shadow: 0 0 0 1px rgba(56, 189, 248, .5), 0 0 22px rgba(56, 189, 248, .45); animation: jvholo 2.6s ease-in-out infinite; }
@keyframes jvholo { 50% { box-shadow: 0 0 0 1px rgba(103, 232, 249, .75), 0 0 36px rgba(56, 189, 248, .7); } }
`;
const W = window as any;
const isHolo = () => document.documentElement.classList.contains('theme-holo');
const makeOrb = (o: HoloOpts) => (isHolo() ? createHolo(o) : createOrb());
function audioMode(t: 'playback' | 'play-and-record' | 'auto') { try { const s = W.navigator.audioSession; if (s && s.type !== t) s.type = t; } catch { /* navigateur sans réglage */ } }

/* ---------- la dictée d'une question ---------- */
export type DictState = 'listening' | 'hearing' | 'transcribing' | 'off' | 'error';
export interface DictOpts { onState?: (s: DictState, why?: string) => void; onPartial?: (t: string) => void; onLevel?: (x: number) => void }
const SR = (): any => W.SpeechRecognition || W.webkitSpeechRecognition || null;
/* avec quoi JARVIS t'écoute ici : Whisper du serveur, la reconnaissance de l'iPhone, ou rien (le micro du clavier reste) */
export const dictKind = (): 'whisper' | 'iphone' | null => (srv.serverEar() && canEar() ? 'whisper' : SR() ? 'iphone' : null);
let cur: {stop: (keep: boolean) => void} | null = null;
export const dictating = () => !!cur;
/* « j'ai fini » (keep) : ce qui est déjà dit part à l'écriture ; sinon tout est abandonné */
export function dictStop(keep = true) { if (cur) cur.stop(keep); }
/* à appeler pendant un appui (l'iPhone n'ouvre le micro qu'après un geste). Rend la phrase, ou '' s'il n'a rien dit. */
export function dictate(o: DictOpts = {}): Promise<string> {
  dictStop(false); hush(); prime();
  const st = (s: DictState, why?: string) => { try { if (o.onState) o.onState(s, why); } catch { /* rien */ } };
  const kind = dictKind();
  if (!kind) { st('error', "pas de micro pour cette page : touche le champ, puis le micro du clavier"); return Promise.resolve(''); }
  return kind === 'whisper' ? viaWhisper(o, st) : viaIphone(o, st);
}
function viaWhisper(o: DictOpts, st: (s: DictState, why?: string) => void): Promise<string> {
  return new Promise((resolve) => {
    let done = false, quiet = 0, me: {stop: (keep: boolean) => void};
    const end = (text: string, s: DictState = 'off', why?: string) => { if (done) return; done = true; clearTimeout(quiet); if (cur === me) cur = null; try { ear.close(); } catch { /* rien */ } st(s, why); resolve(text); };
    const ear = new Ecoute({
      stt: (w, sig) => srv.stt(w, sig),
      onState: (s, why) => {
        if (done || s === 'off' || s === 'paused') return;
        if (s === 'error') { end('', 'error', why || 'micro indisponible'); return; }
        if (s === 'hearing') clearTimeout(quiet);
        if (s === 'listening') arm();   /* un bruit, une phrase vide : il écoute encore */
        st(s);
      },
      onBargeStart: () => { /* sans objet : JARVIS ne parle pas pendant la dictée */ }, onBargeCancel: () => { /* idem */ },
      onUtterance: (t) => end(String(t || '').trim()),
      onLevel: (x) => { if (!done && o.onLevel) o.onLevel(x); }
    });
    ear.endMs = 1100;    /* une question dictée : on laisse le temps de reprendre son souffle */
    ear.maxMs = 30000;
    const arm = () => { clearTimeout(quiet); quiet = window.setTimeout(() => end('', 'off', 'rien entendu'), 12000); };
    me = {stop: (keep) => { if (keep && ear.flush()) return; end(''); }};
    cur = me;
    ear.start().then((ok) => { if (!ok && !done) end('', 'error', 'micro indisponible'); });
  });
}
function viaIphone(o: DictOpts, st: (s: DictState, why?: string) => void): Promise<string> {
  return new Promise((resolve) => {
    let rec: any, done = false, buf = '', tmp = '', err = '', started = false, me: {stop: (keep: boolean) => void};
    const end = (text: string, s: DictState = 'off', why?: string) => { if (done) return; done = true; clearTimeout(wd); if (cur === me) cur = null; audioMode('auto'); st(s, why); resolve(text); };
    try { rec = new (SR())(); } catch { st('error', "la reconnaissance vocale ne démarre pas"); resolve(''); return; }
    const wd = window.setTimeout(() => { if (!started && !done) { try { rec.abort(); } catch { /* rien */ } end('', 'error', 'le micro ne répond pas'); } }, 4000);
    audioMode('play-and-record');
    rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onstart = () => { started = true; clearTimeout(wd); st('listening'); };
    rec.onresult = (ev: any) => {
      let fin = '', t2 = '';
      for (let i = ev.resultIndex || 0; i < ev.results.length; i++) { const r = ev.results[i], t = r && r[0] ? r[0].transcript : ''; if (r && r.isFinal) fin += ' ' + t; else t2 += ' ' + t; }
      if (fin.trim()) buf = (buf + ' ' + fin).trim();
      tmp = t2.trim(); st('hearing');
      if (o.onPartial) o.onPartial((buf + ' ' + tmp).trim());
    };
    rec.onerror = (ev: any) => { err = (ev && ev.error) || 'erreur'; };
    rec.onend = () => { const text = (buf + ' ' + tmp).trim(); if (text) { end(text); return; } if (err && !/no-speech|aborted/.test(err)) { end('', 'error', err === 'not-allowed' ? 'micro refusé' : err); return; } end('', 'off', 'rien entendu'); };
    /* « j'ai fini » : l'iPhone rend la fin de la phrase puis s'arrête ; s'il ne répond pas en 1,5 s, on garde ce qui est déjà écrit */
    me = {stop: (keep) => { if (keep) { try { rec.stop(); } catch { end((buf + ' ' + tmp).trim()); return; } window.setTimeout(() => end((buf + ' ' + tmp).trim()), 1500); return; } try { rec.abort(); } catch { /* rien */ } end(''); }};
    cur = me;
    try { rec.start(); } catch (e: any) { end('', 'error', 'démarrage refusé (' + ((e && e.name) || 'erreur') + ')'); }
  });
}

/* ---------- la lecture d'une réponse ---------- */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const synth: SpeechSynthesis | null = W.speechSynthesis || null;
let audio: HTMLAudioElement | null = null, gen = 0, talking = false;
/* à appeler pendant un appui : sur iPhone, une page ne peut faire du son qu'après un geste */
export function prime() {
  try { if (!audio) audio = new Audio(); if (!talking) { audio.dataset.token = 'unlock'; audio.src = SILENT; audio.play().catch(() => {}); } } catch { /* rien */ }
  try { if (synth && !talking && !srv.serverVoice()) { synth.cancel(); const u = new W.SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = 'fr-FR'; synth.speak(u); } } catch { /* rien */ }
}
export const speaking = () => talking;
/* la voix qui lira : Pierre (serveur) ou celle de l'iPhone */
export const sayKind = (): 'serveur' | 'iphone' | null => (srv.serverVoice() ? 'serveur' : synth && W.SpeechSynthesisUtterance ? 'iphone' : null);
export function hush() { gen++; talking = false; try { if (audio) { audio.dataset.token = 'stop'; audio.pause(); } } catch { /* rien */ } try { if (synth) synth.cancel(); } catch { /* rien */ } }
/* en phrases : la première est dite pendant que les suivantes se préparent */
export const phrases = (text: string): string[] => {
  const out: string[] = []; let acc = '';
  for (const part of String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…:;])\s+/)) { acc = acc ? acc + ' ' + part : part; if (acc.length >= 40) { out.push(acc); acc = ''; } }
  if (acc) out.push(acc);
  return out;
};
function local(text: string, g: number): Promise<void> {
  return new Promise((resolve) => {
    if (!synth || !W.SpeechSynthesisUtterance) { resolve(); return; }
    const u = new W.SpeechSynthesisUtterance(text);
    const v = (() => { try { return synth.getVoices().filter((x) => /^fr/i.test(x.lang)).find((x) => (x.voiceURI || x.name) === store.settings.voiceURI); } catch { return undefined; } })();
    u.lang = v ? v.lang : 'fr-FR'; if (v) u.voice = v;
    let fin = false; const end = () => { if (fin) return; fin = true; resolve(); };
    u.onend = end; u.onerror = end;
    try { if (!synth.speaking) synth.cancel(); synth.speak(u); } catch { end(); return; }
    window.setTimeout(() => { if (g !== gen) end(); }, 400);
    window.setTimeout(end, Math.max(9000, text.length * 140));
  });
}
function play(url: string, g: number): Promise<boolean> {
  return new Promise((resolve) => {
    const a = audio; if (!a) { resolve(false); return; }
    const token = 'p' + Math.random().toString(36).slice(2); let started = false, fin = false;
    const end = (ok: boolean) => { if (fin) return; fin = true; clearInterval(watch); a.removeEventListener('ended', onEnd); a.removeEventListener('error', onErr); try { URL.revokeObjectURL(url); } catch { /* rien */ } resolve(ok); };
    const onEnd = () => { if (a.dataset.token === token) end(true); }, onErr = () => { if (a.dataset.token === token) end(started); };
    const watch = window.setInterval(() => { if (g !== gen || a.dataset.token !== token) end(true); }, 200);   /* coupé : on rend la main */
    a.addEventListener('ended', onEnd); a.addEventListener('error', onErr);
    a.dataset.token = token; a.src = url;
    a.play().then(() => { started = true; }, () => end(false));
  });
}
/* lit le texte ; la promesse se termine quand tout est dit ou coupé (hush) */
export async function say(text: string): Promise<void> {
  hush(); prime();   /* appelé pendant l'appui sur « Écouter » : le son est débloqué tout de suite, avant d'attendre la voix du serveur */
  const g = ++gen; const parts = phrases(text); if (!parts.length) return;
  talking = true; audioMode('playback');
  try {
    if (srv.serverVoice()) {
      if (!audio) { try { audio = new Audio(); } catch { audio = null; } }
      const urls = parts.map((p, i) => (i < 2 ? srv.ttsUrl(p).catch(() => null) : null) as Promise<string | null> | null);
      for (let i = 0; i < parts.length; i++) {
        if (g !== gen) return;
        if (i + 2 < parts.length && !urls[i + 2]) urls[i + 2] = srv.ttsUrl(parts[i + 2]).catch(() => null);
        const url = await (urls[i] || (urls[i] = srv.ttsUrl(parts[i]).catch(() => null)));
        if (g !== gen) { if (url) try { URL.revokeObjectURL(url); } catch { /* rien */ } return; }
        if (!url || !(await play(url, g))) { if (g !== gen) return; await local(parts[i], g); }
      }
    } else for (const p of parts) { if (g !== gen) return; await local(p, g); }
  } finally { if (g === gen) { talking = false; audioMode('auto'); } }
}

/* ---------- l'orbe et le globe ---------- */
/* le grand bouton orbe du bas : la page dit ce qu'il ouvre (la discussion avec Claude) */
export function mountButton(host: HTMLElement = document.body, onTap?: () => void) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'jv-btn'; b.setAttribute('aria-label', 'Demander à Claude');
  if (!document.getElementById('jv-css')) { const s = document.createElement('style'); s.id = 'jv-css'; s.textContent = CSS; document.head.append(s); }
  const o = makeOrb({nodes: 46}); b.append(o.el);
  b.onclick = () => { const f = onTap || W.JarvisAsk; if (typeof f === 'function') f(); };
  host.append(b);
  if (srv.linked()) srv.status().catch(() => {});
  return b;
}
/* un globe autonome (thème hologramme) pour l'accueil de la page */
export function holo(o: HoloOpts = {}) { return createHolo(o); }
/* l'état du serveur (écoute et voix installées) : relu à l'ouverture de la discussion */
export const refresh = () => (srv.linked() ? srv.status().then(() => true, () => false) : Promise.resolve(false));
W.JarvisVoice = {mountButton, holo, dictate, dictStop, dictating, dictKind, say, hush, speaking, sayKind, prime, refresh};
