/* La boucle vocale, validée sur l'iPhone le 15/11/2026 (essais/voix-pwa) : écoute, envoi quand on se tait,
   réponse lue, écoute qui repart seule. Ajouts : relance après une coupure du micro, coupure de la parole, choix de la voix. */
import {Ecoute, canEar} from './ecoute';
/* 0.22.0 : « hearing » (il t'entend parler), « transcribing » (Whisper écrit ta phrase), « paused » (micro coupé par toi) */
export type VoiceState = 'off' | 'listening' | 'hearing' | 'transcribing' | 'paused' | 'waiting' | 'speaking' | 'error';
interface Rec { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void;
  onstart: (() => void) | null; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; }

const W = window as any;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const SR: (new () => Rec) | null = W.SpeechRecognition || W.webkitSpeechRecognition || null;
const synth: SpeechSynthesis | null = W.speechSynthesis || null;
export const canListen = () => !!SR;
/* Safari (iOS 17+) : le mode audio de la page. Pendant l'écoute, l'iPhone passe en mode « appel » (micro + son, volume faible) ;
   s'il y reste quand JARVIS parle, la voix baisse. On le remet en « lecture » pour parler, en « appel » pour écouter. */
function audioMode(t: 'playback' | 'play-and-record' | 'auto') { try { const s = (navigator as any).audioSession; if (s && s.type !== t) s.type = t; } catch { /* navigateur sans réglage : rien */ } }
export const canSpeak = () => !!(synth && W.SpeechSynthesisUtterance);

export function frenchVoices(): SpeechSynthesisVoice[] {
  try { return (synth ? synth.getVoices() : []).filter((v) => /^fr/i.test(v.lang)); } catch { return []; }
}

export interface VoiceOpts {
  mode: () => 'phrase' | 'continu';
  voiceURI: () => string;
  rate: () => number;
  onState: (s: VoiceState, why?: string) => void;
  onPartial: (text: string) => void;
  onUtterance: (text: string) => void;   /* une phrase complète de l'utilisateur */
  onLog?: (t: string) => void;
  tts?: () => ((text: string) => Promise<string | null>) | null;
  /* 0.22.0 : l'écoute Whisper du serveur (micro continu, coupure à la voix) ; sinon la reconnaissance de l'iPhone */
  engine?: () => 'whisper' | 'iphone';
  stt?: (wav: Blob, signal: AbortSignal) => Promise<string> }

export class Voice {
  private rec: Rec | null = null;
  private on = false;
  private buf = '';
  private tmp = '';
  private timer = 0;
  private fails = 0;
  private quick = 0;
  private startedAt = 0;
  private speakingNow = false;
  private q: {text: string; url: Promise<string | null> | null}[] = []; private qBusy = false; private qOpen = false; private qEnd: (() => void) | null = null; private gen = 0; private audio: HTMLAudioElement | null = null;
  state: VoiceState = 'off';
  autoRestarts = 0;
  private ear: Ecoute | null = null; private ducked = false;
  constructor(private o: VoiceOpts) {}

  get active() { return this.on; }
  get whisper() { return !!this.ear; }
  get paused() { return !!(this.ear && this.ear.paused); }
  private set(s: VoiceState, why?: string) {
    this.state = s;
    if (this.ear) this.ear.busy = s === 'speaking' ? 'speaking' : s === 'waiting' ? 'thinking' : this.speakingNow ? 'speaking' : 'idle';
    this.o.onState(s, why);
  }
  /* l'écoute Whisper : ses états, et ta voix qui coupe JARVIS */
  private makeEar() {
    return new Ecoute({
      stt: (w, sig) => this.o.stt!(w, sig),
      onState: (s, why) => {
        if (s === 'off') return;
        if (s === 'error') { this.ear = null; this.log('écoute Whisper : ' + (why || 'erreur') + ' ; écoute de l\'iPhone à la place'); if (SR && this.on) this.listen(false); else this.fail(why || 'micro indisponible'); return; }
        if (s === 'paused') { this.set('paused'); return; }
        if (s === 'hearing') { if (!this.speakingNow || this.ducked) this.set('hearing'); return; }
        if (s === 'transcribing') { if (this.state === 'hearing' || this.state === 'listening') this.set('transcribing'); return; }
        if (s === 'listening' && !this.speakingNow && ['hearing', 'transcribing', 'paused', 'listening', 'off'].includes(this.state)) this.set('listening');
      },
      onBargeStart: () => { if (this.speakingNow) this.duck(); },
      onBargeCancel: () => { if (this.ducked) this.unduck(); },
      onUtterance: (t) => { if (this.ducked || this.speakingNow || this.streaming) this.hush(); this.ducked = false; this.set('waiting'); this.o.onUtterance(t); }
    });
  }
  /* sa voix commence pendant que JARVIS parle : on suspend la phrase ; si ce n'était qu'un bruit, elle reprend */
  private duck() { this.ducked = true; try { if (this.audio && !this.audio.paused) this.audio.pause(); } catch { /* rien */ } try { if (synth && synth.speaking) synth.pause(); } catch { /* rien */ } this.set('hearing'); }
  private unduck() {
    this.ducked = false;
    try { const t = this.audio && this.audio.dataset.token; if (this.audio && this.audio.paused && t && t !== 'stop' && t !== 'unlock') this.audio.play().catch(() => {}); } catch { /* rien */ }
    try { if (synth && synth.paused) synth.resume(); } catch { /* rien */ }
    this.set(this.speakingNow ? 'speaking' : 'listening');
  }
  /* ton appui sur le micro pendant l'écoute : coupe ou rouvre le micro, sans fermer la conversation */
  toggleMic() { if (!this.ear) return false; this.ear.pause(!this.ear.paused); return true; }
  private log(t: string) { if (this.o.onLog) this.o.onLog(t); }

  /* à appeler depuis un appui : ouvre le micro et la voix du téléphone */
  start() {
    if (!SR) { this.set('error', "Pas de reconnaissance vocale ici : écris ta demande."); return; }
    this.on = true; this.fails = 0; this.quick = 0;
    try { if (synth) { synth.cancel(); const u = new W.SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } } catch { /* rien */ }
    /* la voix du serveur passe par un lecteur audio, débloqué ici, pendant l'appui */
    try { if (!this.audio) this.audio = new Audio(); this.audio.dataset.token = 'unlock'; this.audio.src = SILENT; this.audio.play().catch(() => {}); } catch { /* rien */ }
    if (this.o.engine && this.o.engine() === 'whisper' && this.o.stt && canEar()) {
      if (!this.ear) this.ear = this.makeEar();
      const ear = this.ear;
      ear.start().then((ok) => { if (!ok && this.ear === ear) { this.ear = null; if (this.on && SR) this.listen(false); } });
      return;
    }
    this.listen(false);
  }
  stop() {
    this.on = false; clearTimeout(this.timer);
    if (this.ear) { const e = this.ear; this.ear = null; e.stop(); }
    const r = this.rec; this.rec = null; try { if (r) r.abort(); } catch { /* rien */ }
    this.hush(); this.set('off'); audioMode('auto');
  }
  /* coupe la parole de JARVIS et réécoute */
  interrupt() { this.hush(); if (this.ear) { this.ear.cancelSend(); if (this.ear.paused) this.ear.pause(false); this.set('listening'); return; } if (this.on) this.listen(true); }
  /* entre deux tours (pendant que le cerveau réfléchit) */
  pause() { clearTimeout(this.timer); if (this.ear) { if (this.on) this.set('waiting'); return; } const r = this.rec; this.rec = null; try { if (r) r.abort(); } catch { /* rien */ } if (this.on) this.set('waiting'); }
  /* la réponse est finie (ou coupée) sans rien à dire : on réécoute */
  idle() { if (!this.on) return; if (this.ear) { if (!this.speakingNow) this.set(this.ear.paused ? 'paused' : 'listening'); return; } this.listen(true); }

  hush() { this.ducked = false; try { if (this.audio) { this.audio.dataset.token = 'stop'; this.audio.pause(); } } catch { /* rien */ } this.gen++; this.speakingNow = false; this.q = []; this.qBusy = false; this.qOpen = false; this.qEnd = null; try { if (synth) synth.cancel(); } catch { /* rien */ } }

  listen(auto: boolean) {
    if (this.ear) { if (this.on && !this.speakingNow) this.set(this.ear.paused ? 'paused' : 'listening'); return; }   /* Whisper : le micro est déjà ouvert */
    if (!this.on || this.speakingNow || !SR || this.rec) return;   /* jamais deux micros à la fois */
    clearTimeout(this.timer);
    let rec: Rec;
    try { rec = new SR(); } catch (e: any) { this.fail('création impossible : ' + (e && e.message)); return; }
    this.rec = rec; this.buf = ''; this.tmp = ''; this.startedAt = Date.now();
    audioMode('play-and-record');
    rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = this.o.mode() === 'continu'; rec.maxAlternatives = 1;
    let started = false, err = '';
    const wd = window.setTimeout(() => { if (this.rec === rec && !started) { this.rec = null; try { rec.abort(); } catch { /* rien */ } if (auto) this.autoRestartFail(); this.fail("l'écoute ne démarre pas"); } }, 4000);
    rec.onstart = () => { if (this.rec !== rec) return; started = true; clearTimeout(wd); this.fails = 0; if (auto) this.autoRestarts++; this.set('listening'); this.log(auto ? 'écoute relancée seule' : 'écoute ouverte'); };
    rec.onresult = (ev: any) => {
      if (this.rec !== rec) return;
      let fin = '', tmp = '';
      for (let i = ev.resultIndex || 0; i < ev.results.length; i++) { const r = ev.results[i]; const t = r && r[0] ? r[0].transcript : ''; if (r.isFinal) fin += ' ' + t; else tmp += ' ' + t; }
      if (fin.trim()) this.buf = (this.buf + ' ' + fin).trim();
      this.tmp = tmp.trim();
      this.o.onPartial((this.buf + ' ' + this.tmp).trim());
      if (this.o.mode() === 'continu') { clearTimeout(this.timer); this.timer = window.setTimeout(() => { if (this.rec === rec && this.buf) { try { rec.stop(); } catch { /* rien */ } } }, 1400); }
    };
    rec.onerror = (ev: any) => { if (this.rec === rec) { err = (ev && ev.error) || 'inconnue'; this.log('erreur : ' + err); } };
    rec.onend = () => {
      clearTimeout(wd);
      if (this.rec !== rec) return;
      this.rec = null; clearTimeout(this.timer);
      const text = (this.buf + ' ' + this.tmp).trim();
      if (!this.on) return;
      if (text) { this.quick = 0; this.o.onPartial(''); this.set('waiting'); this.o.onUtterance(text); return; }
      if (/not-allowed|service-not-allowed|language-not-supported/.test(err)) { if (auto) this.autoRestartFail(); this.fail(err === 'not-allowed' ? 'micro refusé' : err); return; }
      /* micro pris un instant (appel, autre app) ou réseau : on réessaie, trois fois au plus */
      if (/audio-capture|network/.test(err)) { if (++this.fails > 3) { this.fail(err); return; } this.timer = window.setTimeout(() => this.listen(true), 800 * this.fails); return; }
      this.quick = Date.now() - this.startedAt < 1200 ? this.quick + 1 : 0;
      if (this.quick >= 3) { this.fail("l'écoute s'arrête aussitôt"); return; }
      this.timer = window.setTimeout(() => this.listen(true), 300);
    };
    try { rec.start(); } catch (e: any) { clearTimeout(wd); this.rec = null; this.fail('démarrage refusé (' + ((e && e.name) || 'erreur') + ')'); }
  }
  private autoRestartFail() { this.log('relance sans appui refusée'); }
  private fail(why: string) { this.on = false; this.rec = null; if (this.ear) { const e = this.ear; this.ear = null; e.stop(); } this.hush(); this.set('error', why); }

  /* lecture au fil de l'eau : chaque phrase est dite dès qu'elle arrive ; l'écoute reprend quand tout est dit */
  /* chaque réponse a son numéro : ce qui reste d'une session coupée ou d'une ancienne réponse n'a plus d'effet */
  streamStart(): number { this.gen++; this.q = []; this.qBusy = false; this.qOpen = true; this.qEnd = null; return this.gen; }
  streamPart(text: string, g: number) {
    if (g !== this.gen || !this.qOpen || !text.trim()) return;
    const f = this.o.tts ? this.o.tts() : null;
    if (!f && !canSpeak()) return;
    this.q.push({text, url: f ? f(text).catch(() => null) : null});   /* la voix du serveur prépare la phrase tout de suite */
    this.pump();
  }
  streamEnd(g: number, then?: () => void) { if (g !== this.gen) return; this.qOpen = false; this.qEnd = then || null; this.pump(); }
  get streaming() { return this.qOpen || this.qBusy || this.q.length > 0; }
  private pump() {
    if (this.qBusy) return;
    const next = this.q.shift();
    if (next === undefined) {
      if (this.qOpen) return;   /* la suite n'est pas encore arrivée */
      const cb = this.qEnd; this.qEnd = null; this.speakingNow = false; if (cb) cb();
      if (this.on) window.setTimeout(() => this.listen(true), 450);
      return;
    }
    this.qBusy = true; this.speakingNow = true; this.set('speaking'); if (!this.ear) audioMode('playback');   /* Whisper : le micro reste ouvert (« lecture et enregistrement ») */
    const g = this.gen;
    this.utter(next, () => { if (g !== this.gen) return; this.qBusy = false; this.pump(); });
  }
  private utter(item: {text: string; url: Promise<string | null> | null}, done: () => void) {
    if (!item.url || !this.audio) { this.utterLocal(item.text, done); return; }
    const g = this.gen, a = this.audio;
    item.url.then((url) => {
      if (g !== this.gen) return;
      if (!url) { this.utterLocal(item.text, done); return; }
      const token = 'p' + Math.random().toString(36).slice(2);
      let fin = false; const end = () => { if (fin) return; fin = true; a.removeEventListener('ended', onEnd); a.removeEventListener('error', onErr); URL.revokeObjectURL(url); done(); };
      const onEnd = () => { if (a.dataset.token === token) end(); };
      let started = false; const onPlay = () => { if (a.dataset.token === token) started = true; };
      /* repli sur la voix de l'iPhone seulement si le son n'a jamais démarré ; sinon on passe simplement à la suite */
      const onErr = () => { if (a.dataset.token !== token || fin) return; if (started) { end(); return; } fin = true; a.removeEventListener('ended', onEnd); a.removeEventListener('error', onErr); a.removeEventListener('playing', onPlay); URL.revokeObjectURL(url); this.utterLocal(item.text, done); };
      a.addEventListener('ended', onEnd); a.addEventListener('error', onErr); a.addEventListener('playing', onPlay);
      a.dataset.token = token; a.dataset.text = item.text; a.src = url;
      a.play().then(() => { started = true; }, onErr);
    });
  }
  private utterLocal(text: string, done: () => void) {
    if (!canSpeak()) { done(); return; }
    const u = new W.SpeechSynthesisUtterance(text.replace(/[*_#>`]/g, ' '));
    const v = frenchVoices().find((x) => (x.voiceURI || x.name) === this.o.voiceURI());
    u.lang = v ? v.lang : 'fr-FR'; if (v) u.voice = v;
    u.rate = Math.min(1.5, Math.max(0.7, this.o.rate()));
    let fin = false; const end = () => { if (fin) return; fin = true; done(); };
    u.onend = end; u.onerror = end;
    /* Safari sur iPhone : la voix peut rester bloquée après l'écoute du micro ; une remise à zéro juste avant de parler la débloque */
    try { if (!synth!.speaking) synth!.cancel(); synth!.speak(u); } catch { end(); return; }
    /* filet de sécurité large : sur iPhone, « speaking » peut être faux pendant que la voix parle ; finir trop tôt rouvrait le micro et l'iPhone baissait le son */
    window.setTimeout(end, Math.max(9000, text.length * 140));
  }

  /* lit la réponse, puis réécoute si la conversation est ouverte */
  speak(text: string, then?: () => void) {
    if (this.o.tts && this.o.tts()) { const g = this.streamStart(); this.streamPart(text, g); this.streamEnd(g, then); return; }
    const after = () => { this.speakingNow = false; if (then) then(); if (this.on) window.setTimeout(() => this.listen(true), 450); };
    if (!canSpeak() || !text.trim()) { after(); return; }
    const u = new W.SpeechSynthesisUtterance(text.replace(/[*_#>`]/g, ' '));
    const v = frenchVoices().find((x) => (x.voiceURI || x.name) === this.o.voiceURI());
    u.lang = v ? v.lang : 'fr-FR'; if (v) u.voice = v;
    u.rate = Math.min(1.5, Math.max(0.7, this.o.rate()));
    let done = false; const fin = () => { if (done) return; done = true; after(); };
    u.onend = fin; u.onerror = fin;
    this.speakingNow = true; this.set('speaking'); if (!this.ear) audioMode('playback');
    try { synth!.cancel(); synth!.speak(u); } catch { fin(); return; }
    /* filet de sécurité large, comme pour la lecture au fil de l'eau : sur iPhone, « speaking » peut être faux pendant que la voix parle ;
       finir à 5 s rouvrait le micro en pleine phrase et l'iPhone baissait le son (retour du 16/11/2026) */
    window.setTimeout(fin, Math.max(9000, text.length * 140));
  }
}
