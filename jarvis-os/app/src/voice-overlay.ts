/* JARVIS OS : la page vocale (orbe, voile de soie, conversation continue), en module autonome pour la nouvelle app.
   Elle s'ouvre par le grand bouton orbe du bas. Avec le serveur relié : Claude en flux, voix Pierre ; sinon : réponses locales. */
import {createOrb, type OrbState} from './orb';
import {createHolo, type HoloOpts} from './holo';
import {Voice, canListen, canSpeak} from './voice';
import {think, resetBrain} from './brain';
import {store} from './store';
import * as srv from './server';

const CSS = `
.jv-btn { position: fixed; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 60; width: 74px; height: 74px; border: 0; padding: 0; border-radius: 50%; background: radial-gradient(circle, rgba(10, 10, 30, .9) 55%, rgba(10, 10, 30, 0) 72%); cursor: pointer; }
.jv-btn .orb-stage { position: absolute; inset: -10px; pointer-events: none; overflow: hidden; border-radius: 50%; }
.jv-btn .orb-stage canvas, .jv-stage canvas { display: block; width: 100% !important; height: 100% !important; }
.jv-btn::after { content: ""; position: absolute; inset: 2px; border-radius: 50%; box-shadow: 0 0 0 1px rgba(180, 192, 255, .25), 0 8px 30px rgba(99, 102, 241, .45); animation: jvpulse 2.6s ease-in-out infinite; pointer-events: none; }
@keyframes jvpulse { 50% { box-shadow: 0 0 0 1px rgba(180, 192, 255, .35), 0 8px 44px rgba(124, 92, 255, .7); } }
.jv { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; background: radial-gradient(120% 60% at 20% 0, #0b2027 0, #050509 50%); color: #eef1fb; font: 400 15px/1.5 Inter, system-ui, -apple-system, sans-serif; padding: calc(10px + env(safe-area-inset-top, 0px)) 16px calc(10px + env(safe-area-inset-bottom, 0px)); }
.jv[hidden] { display: none; }
.jv-top { display: flex; align-items: center; gap: 8px; color: #9aa3c2; font-size: 13px; }
.jv-dot { width: 8px; height: 8px; border-radius: 50%; background: #5b8cff; box-shadow: 0 0 10px #5b8cff; }
.jv-chip { margin-left: auto; font-size: 11.5px; color: #6ee7b7; border: 1px solid rgba(110, 231, 183, .35); border-radius: 999px; padding: 3px 10px; }
.jv-stage { position: relative; height: min(46dvh, 420px); margin: 0 -16px; }
.jv-stage .orb-stage { position: absolute; inset: 0; }
.jv-stage { transition: height .35s ease; }
.jv.is-talk .jv-stage { height: min(28dvh, 240px); }
.jv-cap { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 4px 4px 8px; }
.jv-me { margin: 0; font-size: 17px; font-style: italic; color: #fff; text-align: center; min-height: 24px; }
.jv-rep { margin: 0; color: #c7cce3; font-size: 16px; line-height: 1.55; }
.jv-hint { margin: 0; color: #646d8c; text-align: center; }
.jv-log { display: flex; flex-direction: column; gap: 12px; }
.jv-turn { display: flex; flex-direction: column; gap: 6px; }
.jv-q { align-self: flex-end; max-width: 85%; margin: 0; padding: 8px 12px; border-radius: 16px 16px 4px 16px; background: rgba(91, 140, 255, .18); color: #fff; font-size: 15px; }
.jv-a { margin: 0; color: #c7cce3; font-size: 16px; line-height: 1.55; white-space: pre-wrap; }
.jv-pill { align-self: center; display: inline-flex; align-items: center; gap: 8px; margin: -6px auto 6px; padding: 5px 14px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .14); background: rgba(255, 255, 255, .05); font-size: 13px; color: #c9c7e0; }
.jv-pill i { width: 8px; height: 8px; border-radius: 50%; background: #646d8c; }
.jv-pill[data-s="listening"] i { background: #22d3ee; box-shadow: 0 0 10px #22d3ee; animation: jvblink 1s ease-in-out infinite; }
.jv-pill[data-s="thinking"] i { background: #a855f7; box-shadow: 0 0 10px #a855f7; animation: jvblink .6s ease-in-out infinite; }
.jv-pill[data-s="speaking"] i { background: #60a5fa; box-shadow: 0 0 10px #60a5fa; }
.jv-pill[data-s="error"] i { background: #fb7185; }
@keyframes jvblink { 50% { opacity: .35; } }
.jv-sugg { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.jv-sugg[hidden] { display: none; }
.jv-sugg button { border: 1px solid rgba(255, 255, 255, .14); background: rgba(255, 255, 255, .05); color: #dfe6ff; border-radius: 14px; padding: 9px 10px; font-size: 13px; line-height: 1.3; font-family: inherit; text-align: center; }
.jv-title { font-weight: 600; letter-spacing: .02em; }
.jv-note { margin: 0; color: #fbbf24; text-align: center; font-size: 13.5px; }
.jv-comp { display: flex; gap: 8px; padding: 6px; border-radius: 18px; background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .12); margin-bottom: 10px; }
.jv-comp[hidden] { display: none; }
.jv-comp input { flex: 1; min-width: 0; border: 0; background: transparent; color: #fff; font-size: 16px; padding: 8px 10px; outline: none; }
.jv-comp button { border: 0; border-radius: 12px; padding: 0 14px; background: linear-gradient(135deg, #67e8f9, #a5b4fc 40%, #e9a8fb); color: #070a14; font-weight: 600; }
.jv-bar { display: flex; align-items: center; justify-content: center; gap: 40px; padding-top: 4px; }
.jv-side { width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .06); color: #c9c7e0; display: grid; place-items: center; }
.jv-mic { width: 80px; height: 80px; border-radius: 50%; border: 0; color: #fff; display: grid; place-items: center; background: linear-gradient(135deg, #22d3ee, #5b8cff 45%, #8b5cf6); box-shadow: 0 0 0 6px rgba(91, 140, 255, .12), 0 10px 40px rgba(91, 140, 255, .55); }
.jv-mic.on { animation: jvring 1.5s ease-in-out infinite; }
.jv-mic.say { background: linear-gradient(135deg, #a78bfa, #8b5cf6 50%, #d946ef); }
@keyframes jvring { 50% { box-shadow: 0 0 0 16px rgba(91, 140, 255, 0), 0 10px 40px rgba(91, 140, 255, .55); } }
/* thème hologramme (html.theme-holo) */
.theme-holo .jv-btn { background: radial-gradient(circle, rgba(2, 8, 24, .95) 55%, rgba(2, 8, 24, 0) 72%); }
.theme-holo .jv-btn::after { box-shadow: 0 0 0 1px rgba(56, 189, 248, .5), 0 0 22px rgba(56, 189, 248, .45); animation: jvholo 2.6s ease-in-out infinite; }
@keyframes jvholo { 50% { box-shadow: 0 0 0 1px rgba(103, 232, 249, .75), 0 0 36px rgba(56, 189, 248, .7); } }
.theme-holo .jv { background: radial-gradient(90% 46% at 50% 26%, #0b2d63 0, #04112b 45%, #02040d 100%); font-family: 'Exo 2', system-ui, sans-serif; }
.theme-holo .jv::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,.55), transparent 60%), radial-gradient(1px 1px at 78% 12%, rgba(255,255,255,.4), transparent 60%), radial-gradient(1.5px 1.5px at 88% 46%, rgba(125,211,252,.6), transparent 60%), radial-gradient(1px 1px at 22% 62%, rgba(255,255,255,.35), transparent 60%), radial-gradient(1px 1px at 60% 80%, rgba(255,255,255,.3), transparent 60%), radial-gradient(1.5px 1.5px at 40% 8%, rgba(168,85,247,.6), transparent 60%); }
.theme-holo .jv > * { position: relative; }
.theme-holo .jv-top { font: 600 11px Orbitron, Oxanium, sans-serif; letter-spacing: .18em; text-transform: uppercase; color: #7dd3fc; }
.theme-holo .jv-dot { background: #22d3ee; box-shadow: 0 0 12px #22d3ee; }
.theme-holo .jv-chip { font-family: 'Exo 2', sans-serif; letter-spacing: 0; text-transform: none; color: #67e8f9; border-color: rgba(103, 232, 249, .4); }
.theme-holo .jv-me { color: #e0f2fe; }
.theme-holo .jv-rep, .theme-holo .jv-a { color: #bfdbfe; }
.theme-holo .jv-q { background: rgba(14, 165, 233, .2); border: 1px solid rgba(56, 189, 248, .35); }
.theme-holo .jv-pill { font-family: Oxanium, 'Exo 2', sans-serif; letter-spacing: .06em; border-color: rgba(56, 189, 248, .45); background: rgba(8, 30, 70, .5); color: #bae6fd; box-shadow: 0 0 14px rgba(56, 189, 248, .18); }
.theme-holo .jv-sugg button { border-color: rgba(56, 189, 248, .4); background: rgba(8, 30, 70, .45); color: #e0f2fe; }
.theme-holo .jv-title { font: 700 13px Orbitron, Oxanium, sans-serif; letter-spacing: .22em; color: #a5f3fc; text-shadow: 0 0 8px rgba(56, 189, 248, .6); }
.theme-holo .jv-comp { background: rgba(8, 30, 70, .55); border-color: rgba(56, 189, 248, .45); box-shadow: 0 0 18px rgba(56, 189, 248, .18); }
.theme-holo .jv-comp button { background: linear-gradient(90deg, #0ea5e9, #6366f1 60%, #a855f7); color: #fff; }
.theme-holo .jv-side { border-color: rgba(56, 189, 248, .45); background: rgba(8, 30, 70, .5); color: #bae6fd; box-shadow: 0 0 14px rgba(56, 189, 248, .2); }
.theme-holo .jv-mic { background: radial-gradient(circle at 50% 35%, #38bdf8, #2563eb 55%, #6d28d9); box-shadow: 0 0 0 1px rgba(125, 211, 252, .8), 0 0 0 7px rgba(56, 189, 248, .14), 0 0 40px rgba(56, 189, 248, .6); }
.theme-holo .jv-mic.say { background: radial-gradient(circle at 50% 35%, #c084fc, #7c3aed 55%, #4c1d95); }
`;
const SVG = (d: string, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>', key: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 10.5h.01M11 10.5h.01M15 10.5h.01M8 14h8"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', speaker: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/>', stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>'};
const TXT: Record<OrbState, string> = {idle: 'En veille', listening: "Je t'écoute…", thinking: 'Je réfléchis…', executing: 'Mission préparée', speaking: 'Je réponds…', error: 'Micro indisponible'};

const isHolo = () => document.documentElement.classList.contains('theme-holo');
const makeOrb = (o: HoloOpts) => (isHolo() ? createHolo(o) : createOrb());
let root: HTMLElement, orb: ReturnType<typeof createOrb>, me: HTMLElement, rep: HTMLElement, note: HTMLElement, stateEl: HTMLElement, mic: HTMLButtonElement, comp: HTMLElement, input: HTMLInputElement, chip: HTMLElement, log: HTMLElement, cap: HTMLElement, sugg: HTMLElement;
const SUGG = ["Quoi de neuf aujourd'hui ?", "Qu'est-ce qui m'attend cette semaine ?", 'Où en sont mes achats ?', 'Une idée de sortie ce week-end ?'];
let fresh = true, sessionAt = 0, busy = false, gen = 0, ctl: AbortController | null = null;
/* 0.22.0 : ce que montre la pastille, selon l'écoute */
const VTXT: Record<string, string> = {listening: "Je t'écoute…", hearing: "Je t'entends…", transcribing: "J'écris ta phrase…", paused: 'Micro coupé · touche le micro', waiting: 'Je réfléchis…', speaking: 'Je réponds… (parle pour me couper)'};
const voice = new Voice({
  mode: () => store.settings.listenMode, voiceURI: () => store.settings.voiceURI, rate: () => store.settings.rate,
  tts: () => (srv.serverVoice() ? srv.ttsUrl : null),
  engine: () => (srv.serverEar() ? 'whisper' : 'iphone'), stt: (w, sig) => srv.stt(w, sig),
  onState: (s, why) => {
    const map: Record<string, OrbState> = {off: 'idle', listening: 'listening', hearing: 'listening', transcribing: 'thinking', paused: 'idle', waiting: 'thinking', speaking: 'speaking', error: 'error'};
    set(map[s]); if (VTXT[s] && voice.active) stateEl.textContent = VTXT[s];
    if (s === 'error' && why) note.textContent = 'Micro : ' + why + '. Touche le clavier pour écrire.'; if (s === 'listening' || s === 'hearing') note.textContent = '';
    if (s === 'hearing' || s === 'transcribing') { me.textContent = s === 'hearing' ? '…' : me.textContent || '…'; down(); }
    mic.className = 'jv-mic' + (s === 'listening' || s === 'hearing' ? ' on' : s === 'speaking' ? ' say' : '');
    mic.innerHTML = SVG(s === 'speaking' ? I.speaker : s === 'paused' || !voice.active ? I.mic : I.stop, 30);
    mic.setAttribute('aria-label', s === 'speaking' || s === 'waiting' ? 'Couper JARVIS' : s === 'paused' ? 'Rouvrir le micro' : voice.whisper ? 'Couper le micro' : 'Arrêter');
  },
  onPartial: (t) => { me.textContent = t; down(); },
  onUtterance: (t) => { ask(t, true); }
});
function set(s: OrbState) { orb.set(s); stateEl.textContent = TXT[s]; (stateEl.parentElement as HTMLElement).dataset.s = s; }
const down = () => { cap.scrollTop = cap.scrollHeight; };
/* chaque échange reste à l'écran : ta question, puis la réponse complète (sous-titres) */
function turn(q: string) { sugg.hidden = true; root.classList.add('is-talk'); const t = document.createElement('div'); t.className = 'jv-turn'; const a = document.createElement('p'); a.className = 'jv-q'; a.textContent = q; const b = document.createElement('p'); b.className = 'jv-a'; b.textContent = '…'; t.append(a, b); log.append(t); me.textContent = ''; rep = b; down(); }

/* 0.22.0 : « stop », « tais-toi » : JARVIS se tait et écoute ; « c'est tout », « au revoir » : la conversation se ferme */
const STOP = /^(stop|stoppe|chut|tais[- ]toi|silence|arr[eê]te|attends|pause)( jarvis)?[.!]*$/i, BYE = /^(merci,? )?(c'est tout|au revoir|bonne nuit|on arr[eê]te|termin[ée]e?|ferme)( merci)?( jarvis)?[.!]*$/i;
/* couper JARVIS : la réponse en cours (lue ou attendue) s'arrête, l'écoute reprend ; jamais la conversation entière */
function interrupt() { gen++; if (ctl) { ctl.abort(); ctl = null; } busy = false; voice.interrupt(); if (rep && rep.textContent === '…') rep.textContent = '(coupé)'; }
/* la position pour la météo : demandée une fois, arrondie au kilomètre, gardée sur l'iPhone 6 heures */
let pos: {lat: number; lon: number; at: number} | null = null;
try { pos = JSON.parse(localStorage.getItem('jarvis.pos') || 'null'); } catch { pos = null; }
function askPos() {
  if (pos && Date.now() - pos.at < 6 * 3600000) return;
  try { navigator.geolocation.getCurrentPosition((p) => { pos = {lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, at: Date.now()}; try { localStorage.setItem('jarvis.pos', JSON.stringify(pos)); } catch { /* rien */ } }, () => { /* refusée : la météo le dira */ }, {maximumAge: 3600000, timeout: 10000, enableHighAccuracy: false}); } catch { /* rien */ }
}
async function ask(text: string, byVoice: boolean) {
  const t0 = text.trim();
  if (BYE.test(t0)) { voice.speak('À plus tard.', () => close()); return; }
  if (STOP.test(t0)) { interrupt(); me.textContent = ''; return; }
  if (busy || ctl) interrupt();   /* une nouvelle phrase remplace la réponse en cours */
  const my = ++gen; busy = true; const c = new AbortController(); ctl = c;
  store.add({who: 'me', text, at: Date.now()});
  turn(text); set('thinking'); if (voice.active) voice.pause();   /* le micro Whisper reste ouvert : ta voix peut le couper pendant qu'il réfléchit */
  const live = (byVoice || voice.active) && (canSpeak() || srv.serverVoice());
  let said = 0, reply = '';
  if (srv.linked()) {
    const g = live ? voice.streamStart() : 0;
    const feed = (t: string, final: boolean) => { if (!live) return; const rest = t.slice(said); let cut = final ? rest.length : -1; if (!final) { const re = /[.!?…](\s|$)/g; let x; while ((x = re.exec(rest))) if (x.index >= 2) cut = x.index + 1; if (cut < 0 && said === 0 && rest.length > 70) { const k = rest.indexOf(', ', 35); if (k > 0 && k < 140) cut = k + 1; } }   /* 0.22.1 : une première phrase longue est dite dès sa première virgule */ if (cut > 0) { const part = rest.slice(0, cut).trim(); said += cut; if (part) voice.streamPart(part, g); } };
    try {
      const out = await srv.voix(text, {newSession: fresh, lat: pos ? pos.lat : undefined, lon: pos ? pos.lon : undefined}, (t) => { if (my !== gen) return; rep.textContent = t; down(); feed(t, false); }, c.signal);
      if (my !== gen) return;
      fresh = false; reply = out.reply; if (out.missions && out.missions.length) store.missions.push(...out.missions);
      rep.textContent = reply; down(); feed(reply, true);
    } catch (e) { if (my !== gen || c.signal.aborted) return; reply = (e as Error).message; rep.textContent = reply; if (live) voice.streamPart(reply, g); }
    if (ctl === c) ctl = null;
    if (live) voice.streamEnd(g); else { set('idle'); voice.idle(); }
  } else {
    const out = think(text, store.settings.route);
    if (out.missions?.length) store.missions.push(...out.missions);
    reply = out.reply; rep.textContent = reply; down();
    if (out.end) { voice.speak(reply, () => close()); busy = false; store.add({who: 'jarvis', text: reply, at: Date.now()}); return; }
    if (live) voice.speak(reply); else set('idle');
  }
  store.add({who: 'jarvis', text: reply, at: Date.now()});
  if (my === gen) busy = false;
}

function build() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  root = document.createElement('div'); root.className = 'jv'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Conversation avec JARVIS');
  root.innerHTML = `<div class="jv-top"><span class="jv-dot"></span><span class="jv-title">JARVIS</span><span class="jv-chip"></span></div>
    <div class="jv-stage"></div><div class="jv-pill" data-s="idle"><i></i><span class="jv-state">En veille</span></div>
    <div class="jv-cap"><div class="jv-sugg"></div><div class="jv-log"></div><p class="jv-me"></p><p class="jv-note"></p></div>
    <div class="jv-comp" hidden><input type="text" placeholder="Écris à JARVIS…" enterkeyhint="send" aria-label="Ta demande"><button type="button">Envoyer</button></div>
    <div class="jv-bar"><button type="button" class="jv-side jv-k" aria-label="Écrire">${SVG(I.key, 22)}</button><button type="button" class="jv-mic" aria-label="Parler">${SVG(I.mic, 30)}</button><button type="button" class="jv-side jv-x" aria-label="Fermer">${SVG(I.x, 22)}</button></div>`;
  document.body.append(root);
  orb = makeOrb({pedestal: true, nodes: 140}); root.querySelector('.jv-stage')!.append(orb.el);
  me = root.querySelector('.jv-me')!; log = root.querySelector('.jv-log')!; cap = root.querySelector('.jv-cap')!; sugg = root.querySelector('.jv-sugg')!; rep = document.createElement('p');
  SUGG.forEach((q) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = () => ask(q, voice.active); sugg.append(b); }); note = root.querySelector('.jv-note')!; stateEl = root.querySelector('.jv-state')!; chip = root.querySelector('.jv-chip')!;
  mic = root.querySelector('.jv-mic')!; comp = root.querySelector('.jv-comp')!; input = comp.querySelector('input')!;
  /* 0.22.0 : le micro n'est jamais bloqué. Il parle ou réfléchit : un appui le coupe et t'écoute. Il écoute : un appui coupe ou rouvre le micro
     (Whisper) ; la conversation ne se ferme qu'avec la croix ou « c'est tout ». */
  mic.onclick = () => {
    if (voice.state === 'speaking' || voice.state === 'waiting' || busy || voice.streaming) { interrupt(); return; }
    if (voice.active && voice.toggleMic()) return;
    if (voice.active) { voice.stop(); return; }
    start();
  };
  /* un appui n'importe où sur l'orbe ou le texte, pendant qu'il parle ou réfléchit : il se tait et t'écoute */
  const tapCut = (ev: Event) => { if ((ev.target as HTMLElement).closest('button, input, a')) return; if (voice.state === 'speaking' || voice.state === 'waiting' || busy || voice.streaming) interrupt(); };
  (root.querySelector('.jv-stage') as HTMLElement).addEventListener('click', tapCut); cap.addEventListener('click', tapCut);
  (root.querySelector('.jv-k') as HTMLElement).onclick = () => { comp.hidden = !comp.hidden; if (!comp.hidden) { voice.stop(); setTimeout(() => input.focus(), 50); } };
  (root.querySelector('.jv-x') as HTMLElement).onclick = close;
  /* l'iPhone verrouillé ou une autre app : le micro se ferme (l'iPhone le couperait de toute façon) */
  document.addEventListener('visibilitychange', () => { if (document.hidden && root && !root.hidden && voice.active) { interrupt(); voice.stop(); set('idle'); stateEl.textContent = 'En veille · touche le micro'; } });
  const send = () => { const v = input.value.trim(); if (!v) return; input.value = ''; ask(v, false); };
  comp.querySelector('button')!.onclick = send;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(); } });
}
function start() { note.textContent = ''; askPos(); if (srv.linked()) srv.prechauffe(); if (!canListen() && !srv.serverEar()) { note.textContent = 'Pas de reconnaissance vocale ici : touche le clavier pour écrire.'; comp.hidden = false; return; } fresh = true; sessionAt = Date.now(); voice.start(); }
export function open() {
  if (!root) build();
  root.hidden = false; orb.wave(true); me.textContent = ''; log.replaceChildren(); root.classList.remove('is-talk'); sugg.hidden = false; comp.hidden = true;
  chip.textContent = srv.linked() ? (srv.serverEar() ? 'Whisper · ' : '') + 'instantané + Haiku' : 'réponses locales';
  set('idle'); start();
}
export function close() { gen++; if (ctl) { ctl.abort(); ctl = null; } voice.stop(); resetBrain(); if (root) { root.hidden = true; orb.wave(false); } busy = false; void sessionAt; }
/* le grand bouton orbe du bas */
export function mountButton(host: HTMLElement = document.body) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'jv-btn'; b.setAttribute('aria-label', 'Parler à JARVIS');
  if (!document.getElementById('jv-css')) { const st = document.createElement('style'); st.id = 'jv-css'; st.textContent = CSS; document.head.append(st); }
  const o = makeOrb({nodes: 46}); b.append(o.el); b.onclick = open; host.append(b);
  if (srv.linked()) srv.status().catch(() => {});
  return b;
}
/* un globe autonome (thème hologramme) pour l'accueil de la page */
export function holo(o: HoloOpts = {}) { return createHolo(o); }
(window as any).JarvisVoice = {open, close, mountButton, holo};
