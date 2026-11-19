/* JARVIS OS 0.22.0 : l'écoute refaite (retour du 18/11/2026 : « il entend mal, il coupe le début, il ne m'entend plus quand il parle »).
   Le micro reste ouvert pendant toute la conversation, avec l'annulation d'écho de l'iPhone. Un détecteur de voix (niveau sonore,
   bruit de fond appris) repère le début et la fin de chaque phrase, garde 450 ms d'avance pour ne jamais couper le début,
   puis envoie la phrase (WAV 16 kHz) à Whisper sur le serveur. Pendant que JARVIS parle ou réfléchit, ta voix le coupe
   (seuil plus haut et plus long, pour ne pas se déclencher sur son écho) ; si ce n'était qu'un bruit, il reprend. */
export type EarState = 'listening' | 'hearing' | 'transcribing' | 'paused' | 'off' | 'error';
export interface EarOpts {
  stt: (wav: Blob, signal: AbortSignal) => Promise<string>;
  onState: (s: EarState, why?: string) => void;
  onBargeStart: () => void;   /* sa voix commence pendant que JARVIS parle ou réfléchit */
  onBargeCancel: () => void;  /* ce n'était rien (bruit, écho) */
  onUtterance: (text: string) => void;
  onLevel?: (x: number) => void;
}
const W = window as any;
export const canEar = () => !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && (W.AudioContext || W.webkitAudioContext));

/* WAV mono 16 bits à 16 kHz (ce que Whisper attend), à partir des échantillons du micro */
export function toWav16k(chunks: Float32Array[], sr: number): Blob {
  const len = chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(len); let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(all[i]));
  const gain = peak > 0 && peak < 0.35 ? Math.min(4, 0.6 / peak) : 1;   /* voix faible : remontée, sans saturer */
  const ratio = sr / 16000, n = Math.max(0, Math.floor(len / ratio)), pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.min(len - 1, Math.max(a, Math.floor((i + 1) * ratio) - 1)); let s = 0;
    for (let k = a; k <= b; k++) s += all[k];
    const v = Math.max(-1, Math.min(1, (s / (b - a + 1)) * gain)); pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const h = new DataView(new ArrayBuffer(44)), w = (p: number, t: string) => { for (let i = 0; i < t.length; i++) h.setUint8(p + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); h.setUint32(4, 36 + pcm.byteLength, true); w(8, 'WAVE'); w(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, 16000, true); h.setUint32(28, 32000, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, 'data'); h.setUint32(40, pcm.byteLength, true);
  return new Blob([h.buffer, pcm.buffer], {type: 'audio/wav'});
}

export class Ecoute {
  private ctx: AudioContext | null = null; private stream: MediaStream | null = null; private node: ScriptProcessorNode | null = null; private src: MediaStreamAudioSourceNode | null = null;
  private floor = -58; private inSpeech = false; private voiced = 0; private silence = 0; private speechMs = 0; private totalMs = 0;
  private chunks: Float32Array[] = []; private pre: Float32Array[] = []; private preLen = 0; private barge = false; private sending: AbortController | null = null;
  /* ce que fait JARVIS : « speaking » (il parle : seuil plus haut, contre son écho), « thinking » (il réfléchit), « idle » */
  busy: 'idle' | 'speaking' | 'thinking' = 'idle';
  paused = false;
  endMs = 700;   /* silence qui termine une phrase (0.22.1 : 0,7 s au lieu de 0,8) */
  maxMs = 20000;   /* durée maximale d'une phrase */
  private sr = 16000;
  private closing = false;   /* fermé pendant que l'iPhone ouvrait le micro : le micro ne doit pas rester ouvert */
  constructor(private o: EarOpts) {}
  get on() { return !!this.stream; }

  /* à appeler pendant l'appui : l'iPhone n'ouvre le son et le micro qu'après un geste */
  async start(): Promise<boolean> {
    if (this.stream) return true;
    this.closing = false;
    const AC = W.AudioContext || W.webkitAudioContext; if (!AC || !navigator.mediaDevices) return false;
    try { if (!this.ctx) this.ctx = new AC(); this.ctx!.resume().catch(() => {}); } catch { return false; }
    try { const s = W.navigator.audioSession; if (s) s.type = 'play-and-record'; } catch { /* Safari plus ancien */ }
    let st: MediaStream;
    try { st = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1} as any}); }
    catch (e: any) { if (!this.closing) this.o.onState('error', e && e.name === 'NotAllowedError' ? 'micro refusé' : 'micro indisponible'); return false; }
    /* 0.22.1 : la page vocale a été fermée pendant que l'iPhone ouvrait le micro (autorisation, lenteur) : on le referme aussitôt */
    if (this.closing) { try { st.getTracks().forEach((t) => t.stop()); } catch { /* rien */ } return false; }
    this.stream = st;
    const ctx = this.ctx!;
    this.src = ctx.createMediaStreamSource(this.stream);
    this.node = ctx.createScriptProcessor(1024, 1, 1);
    this.node.onaudioprocess = (ev) => { try { this.frame(ev.inputBuffer.getChannelData(0), ctx.sampleRate); } catch { /* une trame ratée */ } };
    this.src.connect(this.node); this.node.connect(ctx.destination);   /* sortie muette : nécessaire pour que le nœud tourne */
    this.reset(); this.o.onState('listening');
    return true;
  }
  stop() {
    this.closing = true;
    this.cancelSend(); this.reset();
    try { this.node && this.node.disconnect(); this.src && this.src.disconnect(); } catch { /* rien */ }
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch { /* rien */ }
    this.node = null; this.src = null; this.stream = null;
    try { const s = W.navigator.audioSession; if (s) s.type = 'auto'; } catch { /* rien */ }
    this.o.onState('off');
  }
  /* 0.25.0 (dictée d'une question) : micro fermé et contexte audio rendu ; l'iPhone n'en accorde que quelques-uns à une page */
  close() { this.stop(); try { if (this.ctx) this.ctx.close().catch(() => {}); } catch { /* rien */ } this.ctx = null; }
  pause(p: boolean) { this.paused = p; this.reset(); this.o.onState(p ? 'paused' : 'listening'); }
  cancelSend() { if (this.sending) { this.sending.abort(); this.sending = null; } }
  private tick() {
    const c = this.ctx; if (!c) return;
    try { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 1180; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.09); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.1); } catch { /* rien */ }
  }
  private reset() { this.inSpeech = false; this.voiced = 0; this.silence = 0; this.speechMs = 0; this.totalMs = 0; this.chunks = []; this.pre = []; this.preLen = 0; this.barge = false; }

  private frame(x: Float32Array, sr: number) {
    if (this.paused || !this.stream) return;
    this.sr = sr;
    let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
    const db = 20 * Math.log10(Math.sqrt(s / x.length) + 1e-9), ms = (x.length / sr) * 1000, copy = new Float32Array(x);
    if (this.o.onLevel) this.o.onLevel(Math.max(0, Math.min(1, (db + 60) / 45)));
    const strict = this.busy === 'speaking';
    const on = Math.max(this.floor + (strict ? 18 : 11), strict ? -42 : -54), off = this.floor + (strict ? 10 : 6);
    if (!this.inSpeech) {
      this.pre.push(copy); this.preLen += copy.length;
      while (this.pre.length > 1 && this.preLen - this.pre[0].length > sr * 0.45) this.preLen -= this.pre.shift()!.length;
      if (db > on) {
        this.voiced += ms;
        if (this.voiced >= (strict ? 280 : 110)) {
          this.inSpeech = true; this.chunks = this.pre; this.pre = []; this.preLen = 0; this.silence = 0; this.speechMs = this.voiced; this.totalMs = this.voiced;
          this.barge = this.busy !== 'idle'; if (this.barge) this.o.onBargeStart();
          this.o.onState('hearing');
        }
      } else {
        this.voiced = Math.max(0, this.voiced - ms);
        if (db < this.floor + 6) this.floor = Math.min(-30, Math.max(-80, this.floor * 0.96 + db * 0.04));   /* bruit de fond appris en continu */
      }
      return;
    }
    this.chunks.push(copy); this.totalMs += ms;
    if (db > off) { this.silence = 0; this.speechMs += ms; } else this.silence += ms;
    if (this.silence >= this.endMs || this.totalMs > this.maxMs) this.finish(sr);
  }
  /* 0.25.0 (dictée d'une question) : « j'ai fini » d'un appui : la phrase en cours part tout de suite ; faux s'il n'a encore rien dit */
  flush(): boolean { if (!this.inSpeech || !this.stream) return false; this.finish(this.sr); return true; }
  private finish(sr: number) {
    const chunks = this.chunks, wasBarge = this.barge, speech = this.speechMs;
    this.reset();
    if (speech < 260) { if (wasBarge) this.o.onBargeCancel(); this.o.onState('listening'); return; }   /* un clic, une toux */
    const ctl = new AbortController(); this.cancelSend(); this.sending = ctl;
    this.tick();   /* 0.22.1 : un petit son discret : « je t'ai entendu » */
    this.o.onState('transcribing');
    this.o.stt(toWav16k(chunks, sr), ctl.signal).then((t) => {
      if (this.sending !== ctl) return; this.sending = null;
      const text = String(t || '').trim();
      if (!text) { if (wasBarge) this.o.onBargeCancel(); this.o.onState('listening'); return; }
      this.o.onUtterance(text);
    }, () => { if (this.sending !== ctl) return; this.sending = null; if (wasBarge) this.o.onBargeCancel(); this.o.onState('listening'); });
  }
}
