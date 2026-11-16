/* Les personnages des agents, repris de la page Jarvis (salle de contrôle, v17.15) à la demande du propriétaire (15/11/2026) :
   une sphère irisée et fluide par agent, sa silhouette en hologramme dedans, l'emblème de son métier en badge,
   Claude couronné avec ses rayons d'or et l'équipe en orbite. En veille la sphère tourne lentement ; au travail elle
   s'anime ; quand l'agent attend ta réponse, un halo ambre respire ; quand il parle, sa surface ondule.
   Silhouettes : game-icons.net, licence CC BY 3.0 (auteurs : Lorc, Delapouite et contributeurs). */
import SIL_RAW from './sil.json';
import type {AgentId} from './agents';

export type Mode = 'veille' | 'travail' | 'demande';
/* identifiants internes de la page Jarvis : les anciens noms des bots */
const PAGE: Record<AgentId, string> = {claude: 'claude', jarvis: 'jarvis', iris: 'hydra', chronos: 'medusa', kairos: 'unicorn', ulysse: 'mermaid', athena: 'griffon', argus: 'cyclops'};
export const PAL: Record<string, [string, string, string, number]> = {
  jarvis: ['#4f46e5', '#06b6d4', '#f0abfc', 0.0], hydra: ['#0369a1', '#14b8a6', '#a5f3fc', 1.3], medusa: ['#6d28d9', '#c026d3', '#f5d0fe', 2.1],
  unicorn: ['#be185d', '#f59e0b', '#fde68a', 3.7], mermaid: ['#1d4ed8', '#06b6d4', '#6ee7b7', 4.4], griffon: ['#92400e', '#f59e0b', '#fef3c7', 5.9],
  cyclops: ['#7f1d1d', '#ef4444', '#fecdd3', 6.6], claude: ['#3b0764', '#f59e0b', '#fff1c1', 7.8]
};
export const colorOf = (id: AgentId) => PAL[PAGE[id]][1];
const EMB: Record<string, string[]> = {
  hydra: ['M4 7h16v11H4z', 'M4 7.5l8 6 8-6'],
  medusa: ['M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0', 'M9 2.8h6'],
  unicorn: ['M4 12.5V5h7.5L20 13.5 13.5 20z', 'M9.8 9a1.3 1.3 0 1 1-2.6 0a1.3 1.3 0 1 1 2.6 0'],
  mermaid: ['M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0', 'M12 6.8l2.1 5.2L12 17.2 9.9 12z', 'M12 2.6v1.6'],
  griffon: ['M12 6.5c-2-1.5-5-1.8-8-1v13c3-.8 6-.5 8 1 2-1.5 5-1.8 8-1v-13c-3-.8-6-.5-8 1z', 'M12 6.5v13'],
  cyclops: ['M2.8 12s3.5-6 9.2-6 9.2 6 9.2 6-3.5 6-9.2 6-9.2-6-9.2-6z'],
  claude: ['M4.5 17.5L3 8l5 4 4-6.5 4 6.5 5-4-1.5 9.5z', 'M5 20.5h14'],
  jarvis: ['M5 10v4', 'M8.5 7v10', 'M12 4v16', 'M15.5 7v10', 'M19 10v4']
};
const SIL = SIL_RAW as Record<string, {vb: number; d: string[]; crown?: string[]; mb?: number[]; mc?: number[]}>;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hex3 = (h: string) => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

const ORB = (() => {
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform vec3 uA,uB,uC;uniform float uEnergy,uVoice,uAsk,uSeed;uniform vec2 uLook;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}
void main(){
 vec2 uv=(gl_FragCoord.xy/uRes)*2.-1.;
 float t=uTime;float ang=atan(uv.y,uv.x);
 float wob=uVoice*.07*(noise(vec3(cos(ang)*2.2,sin(ang)*2.2,t*7.))-.35);
 float R=.74+.018*sin(t*1.2+uSeed)*(.5+uEnergy)+wob;
 float r=length(uv)/R;
 vec3 rgb=vec3(0.);float a=0.;
 float glow=exp(-max(r-1.,0.)*6.)*smoothstep(1.3,1.,r);
 vec3 gcol=mix(uB,vec3(1.,.64,.16),uAsk*.7);
 float ga=glow*(.2+.3*uEnergy+.22*uAsk*(.75+.25*sin(t*3.5)));
 float ring=uAsk*smoothstep(.022,.0,abs(r-1.15-.015*sin(t*3.)))*smoothstep(1.3,1.2,r)*(.3+.25*sin(t*3.));
 rgb=gcol*ga+vec3(1.,.72,.3)*ring;a=max(ga,ring);
 if(r<1.){
  float z=sqrt(1.-r*r);vec3 n=vec3(uv/R,z);
  float sp=.12+.6*uEnergy;
  vec3 p=n*1.35+vec3(uSeed,uSeed*.7,t*sp);
  vec3 q=vec3(fbm(p*.8),fbm(p*.8+vec3(5.2,1.3,2.8)),0.);
  float f=fbm(p*.7+1.6*q+vec3(0.,0.,t*sp*.5));
  float ph=(n.x*1.7+n.y*2.6+f*5.5)*1.6+t*(.35+1.3*uEnergy)+uVoice*3.*sin(t*8.);
  float silk=.5+.5*sin(ph);
  float fil=pow(.5+.5*sin(ph*2.2+f*3.),3.);
  vec3 c=mix(uA,uB,smoothstep(.15,.85,.5+.5*sin(f*4.+n.x*2.+t*.25)));
  c=mix(c,uC,silk*.38);
  c=mix(c,mix(uC,vec3(1.),.25),fil*.35);
  float fres=pow(1.-z,1.7);
  vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*1.2+silk*.25+t*.03));
  c=mix(c,irid,fres*.6);
  c*=.5+.6*z;
  c=mix(c,vec3(1.),.10*pow(z,3.));
  vec3 L=normalize(vec3(-.45+uLook.x*.35,.55+uLook.y*.35,.75));
  c+=vec3(1.)*pow(max(dot(n,L),0.),48.)*.5;
  c+=uC*fres*.4;
  c*=.66+.45*uEnergy+.25*uVoice;
  float edge=smoothstep(1.,.975,r);
  rgb=mix(rgb,c,edge);a=mix(a,1.,edge);
 }
 gl_FragColor=vec4(rgb,a);
}`;
  let gl: WebGLRenderingContext | null = null, ok = false; const U: Record<string, WebGLUniformLocation | null> = {};
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  try {
    gl = cv.getContext('webgl', {premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true});
    if (gl) {
      const sh = (type: number, src: string) => { const s = gl!.createShader(type)!; gl!.shaderSource(s, src); gl!.compileShader(s); if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(String(gl!.getShaderInfoLog(s))); return s; };
      const pr = gl.createProgram()!;
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uTime', 'uA', 'uB', 'uC', 'uEnergy', 'uVoice', 'uAsk', 'uSeed', 'uLook'].forEach((k) => { U[k] = gl!.getUniformLocation(pr, k); });
      gl.clearColor(0, 0, 0, 0); ok = true;
    }
  } catch { ok = false; }
  return {ok, draw(g: CanvasRenderingContext2D, px: number, pal: Pal, st: St) {
    const w = Math.min(512, px), G = gl!;
    G.viewport(0, 0, w, w); G.clear(G.COLOR_BUFFER_BIT);
    G.uniform2f(U.uRes, w, w); G.uniform1f(U.uTime, st.t);
    G.uniform3fv(U.uA, pal.a); G.uniform3fv(U.uB, pal.b); G.uniform3fv(U.uC, pal.c);
    G.uniform1f(U.uEnergy, st.energy); G.uniform1f(U.uVoice, st.voice); G.uniform1f(U.uAsk, st.ask);
    G.uniform1f(U.uSeed, pal.seed); G.uniform2f(U.uLook, st.look[0], st.look[1]);
    G.drawArrays(G.TRIANGLE_STRIP, 0, 4);
    g.clearRect(0, 0, px, px); g.drawImage(cv, 0, cv.height - w, w, w, 0, 0, px, px);
  }};
})();

type Pal = {a: number[]; b: number[]; c: number[]; seed: number; hex: [string, string, string, number]};
type St = {t: number; energy: number; voice: number; ask: number; look: number[]};
export interface Char { id: AgentId; el: HTMLElement; setMode(m: Mode): void; talk(sec: number): void; bump(): void }
interface C extends Char { pid: string; cv: HTMLCanvasElement; size: number; mode: Mode; pal: Pal; k: {w: number; a: number; z: number}; t0: number; talkUntil: number; voice: number; rx: number; look: number[]; vt: number; vis: boolean; rect: DOMRect | null; dpr: number; acc?: number; drawn?: boolean }

const CHARS = new Set<C>();
const POINTER = {x: 0, y: 0, t: -1e9};
const ptr = (e: PointerEvent) => { POINTER.x = e.clientX; POINTER.y = e.clientY; POINTER.t = performance.now(); };
window.addEventListener('pointermove', ptr, {passive: true});
window.addEventListener('pointerdown', ptr, {passive: true});
let clock = 0, lastTs = 0, rafId = 0, frameSkip = 0;
let modeOf: (id: AgentId) => Mode = () => 'veille';
export const setModeSource = (f: (id: AgentId) => Mode) => { modeOf = f; };

export function makeChar(id: AgentId, size = 64, mode: Mode = 'veille'): Char {
  const el = document.createElement('div');
  el.className = 'chr chr-' + id; el.style.setProperty('--sz', size + 'px');
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); el.append(cv);
  const pid = PAGE[id], P = PAL[pid] || PAL.claude;
  const ch: C = {id, pid, el, cv, size, mode, pal: {a: hex3(P[0]), b: hex3(P[1]), c: hex3(P[2]), seed: P[3], hex: P},
    k: {w: mode === 'travail' ? 1 : 0, a: mode === 'demande' ? 1 : 0, z: mode === 'veille' ? 1 : 0},
    t0: Math.random() * 20, talkUntil: -1, voice: 0, rx: 0, look: [0, 0], vt: 0, vis: true, rect: null, dpr: 0,
    setMode(m) { if (ch.mode !== m) { ch.mode = m; if (reduced) tick(ch, clock + 0.01, 0); wake(); } },
    talk(sec) { ch.talkUntil = clock + sec; wake(); },
    bump() { ch.rx = 1; wake(); }};
  CHARS.add(ch); tick(ch, clock + 0.01, 0); wake();
  return ch;
}

function tick(ch: C, now: number, dt: number) {
  const s = ch.size, cv = ch.cv, dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.round(s * dpr);
  if (ch.dpr !== dpr) { ch.dpr = dpr; cv.width = px; cv.height = px; }
  const g = cv.getContext('2d'); if (!g) return;
  const k = ch.k, m = ch.mode, e = Math.min(1, dt * 2.5);
  k.w += ((m === 'travail' ? 1 : 0) - k.w) * e; k.a += ((m === 'demande' ? 1 : 0) - k.a) * e; k.z += ((m === 'veille' ? 1 : 0) - k.z) * e;
  ch.rx = Math.max(0, ch.rx - dt * 1.5);
  const talking = now < ch.talkUntil;
  ch.voice += ((talking ? 0.65 + 0.35 * Math.abs(Math.sin(now * 11 + ch.t0)) : 0) - ch.voice) * Math.min(1, dt * 8);
  if (reduced) { k.w = m === 'travail' ? 1 : 0; k.a = m === 'demande' ? 1 : 0; k.z = m === 'veille' ? 1 : 0; ch.voice = 0; }
  let lx = Math.sin((now + ch.t0) * 0.4) * 0.4, ly = Math.cos((now + ch.t0) * 0.31) * 0.3;
  if (performance.now() - POINTER.t < 4000 && ch.rect) {
    const dx = POINTER.x - (ch.rect.left + ch.rect.width / 2), dy = POINTER.y - (ch.rect.top + ch.rect.height / 2), d = Math.hypot(dx, dy) || 1;
    lx = dx / Math.max(d, 120); ly = -dy / Math.max(d, 120);
  }
  ch.look[0] += (lx - ch.look[0]) * Math.min(1, dt * 4); ch.look[1] += (ly - ch.look[1]) * Math.min(1, dt * 4);
  const energy = 0.3 + 0.7 * k.w + 0.35 * k.a + 0.3 * ch.rx + 0.2 * ch.voice;
  const st: St = {t: (now + ch.t0) * (reduced ? 0 : 1), energy: Math.min(1.2, energy), voice: ch.voice, ask: k.a, look: ch.look};
  if (ORB.ok) ORB.draw(g, px, ch.pal, st); else flat(g, px, ch, st);
  if (ch.id === 'claude' && ch.size >= 40) aura(g, px, st, now + ch.t0);
  hologram(g, px, ch, st, now + ch.t0);
  cv.style.transform = reduced ? '' : 'scale(' + (1 + 0.06 * Math.sin(Math.min(1, ch.rx) * Math.PI)).toFixed(3) + ')';
}

const EMB_P: Record<string, Path2D[]> = {};
const embOf = (pid: string) => EMB_P[pid] || (EMB_P[pid] = (EMB[pid] || []).map((d) => new Path2D(d)));
function emblem(g: CanvasRenderingContext2D, px: number, ch: C, st: St, t: number) {
  const paths = embOf(ch.pid); if (!paths.length) return;
  const size = px * 0.36, sc = size / 24, cx = px / 2, cy = px / 2 + Math.sin(t * 1.3) * px * 0.012;
  g.save(); g.translate(cx - 12 * sc, cy - 12 * sc); g.scale(sc, sc);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.shadowColor = ch.pal.hex[2]; g.shadowBlur = Math.max(2, px * (0.05 + 0.05 * st.energy + 0.06 * st.voice));
  g.strokeStyle = 'rgba(255,255,255,' + (0.78 + 0.2 * Math.min(1, st.energy)).toFixed(2) + ')';
  g.lineWidth = Math.max(1.5, 2.1 * (48 / Math.max(48, px)) + 0.6);
  paths.forEach((p) => g.stroke(p));
  g.restore();
}
const SIL_P: Record<string, Path2D[] | null> = {}, SIL_X: Record<string, Path2D> = {};
const silOf = (pid: string) => {
  if (pid in SIL_P) return SIL_P[pid];
  const s = SIL[pid];
  if (!s) return (SIL_P[pid] = null);
  if (s.crown && typeof DOMMatrix === 'function') {
    try {
      const body = new Path2D(), crown = new Path2D();
      s.d.forEach((d) => body.addPath(new Path2D(d), new DOMMatrix(s.mb)));
      s.crown.forEach((d) => crown.addPath(new Path2D(d), new DOMMatrix(s.mc)));
      SIL_X[pid] = crown;
      return (SIL_P[pid] = [body]);
    } catch { /* sans couronne */ }
  }
  return (SIL_P[pid] = s.d.map((d) => new Path2D(d)));
};
function hologram(g: CanvasRenderingContext2D, px: number, ch: C, st: St, t: number) {
  const sil = silOf(ch.pid);
  if (!sil) { emblem(g, px, ch, st, t); return; }
  const c = px / 2, R = px * 0.37, H = ch.pal.hex;
  const dark = g.createRadialGradient(c, c, R * 0.15, c, c, R);
  dark.addColorStop(0, 'rgba(4,6,13,.62)'); dark.addColorStop(0.75, 'rgba(4,6,13,.38)'); dark.addColorStop(1, 'rgba(4,6,13,.08)');
  g.fillStyle = dark; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
  const size = px * (SIL_X[ch.pid] ? 0.58 : 0.5), sc = size / 512;
  const fx = c - size / 2 + ch.look[0] * px * 0.018, fy = c - size / 2 + Math.sin(t * 1.2) * px * 0.012 - ch.look[1] * px * 0.01;
  g.save();
  g.beginPath(); g.arc(c, c, R * 0.97, 0, Math.PI * 2); g.clip();
  g.translate(fx, fy); g.scale(sc, sc);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, H[2]); grad.addColorStop(1, H[1]);
  g.globalAlpha = Math.min(1, 0.6 + 0.3 * Math.min(1, st.energy) + 0.15 * st.voice);
  g.shadowColor = H[2]; g.shadowBlur = px * (0.05 + 0.05 * Math.min(1, st.energy) + 0.08 * st.voice);
  g.fillStyle = grad; sil.forEach((p) => g.fill(p)); g.shadowBlur = 0;
  if (!reduced) {
    g.save(); g.clip(sil[0]); g.globalAlpha = 0.22; g.fillStyle = '#04060d';
    const off = (t * (18 + 30 * st.energy)) % 22;
    for (let y = -22 + off; y < 512; y += 22) g.fillRect(0, y, 512, 5);
    g.restore();
  }
  const crown = SIL_X[ch.pid];
  if (crown) {
    const cg = g.createLinearGradient(0, 40, 0, 200);
    cg.addColorStop(0, '#fffbeb'); cg.addColorStop(0.45, '#fcd34d'); cg.addColorStop(1, '#f59e0b');
    g.globalAlpha = 1; g.shadowColor = '#fbbf24'; g.shadowBlur = px * (0.07 + 0.05 * Math.min(1, st.energy) + 0.08 * st.voice);
    g.fillStyle = cg; g.fill(crown); g.shadowBlur = 0;
  }
  g.restore();
  if (px >= 64) badge(g, px, ch, R);
}
function badge(g: CanvasRenderingContext2D, px: number, ch: C, R: number) {
  const paths = embOf(ch.pid); if (!paths.length) return;
  const c = px / 2, bx = c + R * 0.74, by = c + R * 0.74, br = px * 0.1;
  g.save();
  g.fillStyle = ch.pal.hex[1]; g.strokeStyle = '#04060d'; g.lineWidth = px * 0.02;
  g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill(); g.stroke();
  const sc = (br * 1.25) / 24;
  g.translate(bx - 12 * sc, by - 12 * sc); g.scale(sc, sc);
  g.lineWidth = 2.2; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#ffffff';
  paths.forEach((p) => g.stroke(p));
  g.restore();
}
const TEAM: AgentId[] = ['iris', 'chronos', 'kairos', 'ulysse', 'athena', 'argus'];
function aura(g: CanvasRenderingContext2D, px: number, st: St, t: number) {
  const c = px / 2, R = px * 0.37, tt = reduced ? 0 : t;
  g.save(); g.globalCompositeOperation = 'destination-over'; g.translate(c, c); g.rotate(tt * 0.05);
  for (let i = 0; i < 16; i++) {
    const an = (i / 16) * Math.PI * 2, w = i % 2 ? 0.05 : 0.085, len = R * (i % 2 ? 1.24 : 1.33);
    const gr = g.createLinearGradient(0, 0, Math.cos(an) * len, Math.sin(an) * len);
    gr.addColorStop(0.55, 'rgba(251,191,36,0)'); gr.addColorStop(0.8, 'rgba(251,191,36,' + (0.22 + 0.1 * Math.min(1, st.energy)).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(251,191,36,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an - w) * len, Math.sin(an - w) * len); g.lineTo(Math.cos(an + w) * len, Math.sin(an + w) * len); g.closePath(); g.fill();
  }
  g.restore();
  g.save();
  const rr = R * 1.2;
  g.strokeStyle = 'rgba(253,224,138,.5)'; g.lineWidth = Math.max(1, px * 0.006);
  g.setLineDash([px * 0.012, px * 0.018]); g.lineDashOffset = -tt * px * 0.02;
  g.beginPath(); g.arc(c, c, rr, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  TEAM.forEach((b, i) => {
    const an = tt * 0.25 + (i / TEAM.length) * Math.PI * 2 - Math.PI / 2, x = c + Math.cos(an) * rr, y = c + Math.sin(an) * rr;
    const m = modeOf(b), ask = m === 'demande', col = PAL[PAGE[b]][1];
    const rad = px * (0.024 + (m === 'travail' ? 0.005 * (1 + Math.sin(tt * 5 + i)) : 0));
    g.shadowColor = ask ? '#fbbf24' : col; g.shadowBlur = px * (ask ? 0.05 : 0.03);
    g.fillStyle = ask ? 'rgba(251,191,36,' + (0.75 + 0.25 * Math.sin(tt * 4)).toFixed(2) + ')' : col;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  });
  g.restore();
}
function flat(g: CanvasRenderingContext2D, px: number, ch: C, st: St) {
  const c = px / 2, R = px * 0.37, H = ch.pal.hex;
  g.clearRect(0, 0, px, px);
  const glow = g.createRadialGradient(c, c, R * 0.8, c, c, R * 1.5);
  glow.addColorStop(0, st.ask > 0.5 ? 'rgba(255,170,60,.35)' : H[1] + '55'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(c, c, R * 1.5, 0, Math.PI * 2); g.fill();
  const a = st.t * (0.2 + st.energy * 0.6);
  const body = g.createRadialGradient(c - R * 0.35 + Math.cos(a) * R * 0.2, c - R * 0.4 + Math.sin(a) * R * 0.2, R * 0.05, c, c, R);
  body.addColorStop(0, H[2]); body.addColorStop(0.45, H[1]); body.addColorStop(1, H[0]);
  g.fillStyle = body; g.beginPath(); g.arc(c, c, R * (1 + st.voice * 0.04 * Math.sin(st.t * 20)), 0, Math.PI * 2); g.fill();
}

function loop(ts: number) {
  rafId = 0;
  const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts; clock += dt;
  frameSkip = (frameSkip + 1) % 2;   /* 30 images par seconde suffisent, et ménagent la batterie */
  if (!frameSkip) CHARS.forEach((ch) => {
    if (!ch.el.isConnected) { ch.vt = 0; return; }
    ch.vt -= dt * 2;
    if (ch.vt <= 0) {
      ch.vt = 0.4;
      ch.vis = ch.el.getClientRects().length > 0;
      if (ch.vis) { ch.rect = ch.el.getBoundingClientRect(); ch.vis = ch.rect.bottom > -40 && ch.rect.top < innerHeight + 40; }
    }
    if (!ch.vis) return;
    /* les petites sphères des listes : 4 images par seconde suffisent, sauf quand elles parlent */
    if (ch.size < 56 && clock >= ch.talkUntil && !ch.rx) { ch.acc = (ch.acc || 0) + dt * 2; if (ch.acc < 0.25 && ch.drawn) return; tick(ch, clock, Math.min(0.25, ch.acc)); ch.acc = 0; ch.drawn = true; return; }
    tick(ch, clock, dt * 2);
  });
  if (!reduced && !document.hidden) rafId = requestAnimationFrame(loop);
}
const wake = () => { if (!reduced && !rafId && !document.hidden) { lastTs = 0; rafId = requestAnimationFrame(loop); } };
document.addEventListener('visibilitychange', wake);

/* un personnage par agent et par taille, réutilisé d'un affichage à l'autre (l'app redessine ses écrans) */
const CACHE = new Map<string, Char>();
export function charOf(id: AgentId, size: number, slot = ''): HTMLElement {
  const key = id + ':' + size + ':' + slot;
  let c = CACHE.get(key);
  if (!c) { c = makeChar(id, size, modeOf(id)); CACHE.set(key, c); }
  else c.setMode(modeOf(id));
  return c.el;
}
export function talkAll(id: AgentId, sec: number) { CACHE.forEach((c) => { if (c.id === id) c.talk(sec); }); }
export function refreshModes() { CACHE.forEach((c) => c.setMode(modeOf(c.id))); }
