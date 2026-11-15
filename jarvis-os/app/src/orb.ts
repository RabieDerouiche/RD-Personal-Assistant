/* L'orbe de JARVIS (captures du propriétaire, 15/11/2026) : une sphère de verre sombre aux rubans de lumière,
   un liseré bleu-violet, et en session vocale un voile de soie violet dessous. Un seul shader WebGL, sans bibliothèque. */
export type OrbState = 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'error';
type Look = {a: number[]; b: number[]; spd: number; amp: number};
const LOOK: Record<OrbState, Look> = {
  idle: {a: [0.36, 0.56, 1.0], b: [0.47, 0.25, 0.95], spd: 1, amp: 0},
  listening: {a: [0.25, 0.78, 1.0], b: [0.36, 0.42, 1.0], spd: 1.7, amp: 0.55},
  thinking: {a: [0.7, 0.55, 1.0], b: [0.9, 0.3, 0.75], spd: 3.2, amp: 0.25},
  executing: {a: [0.3, 0.9, 0.7], b: [0.36, 0.42, 1.0], spd: 2.2, amp: 0.3},
  speaking: {a: [0.42, 0.68, 1.0], b: [0.66, 0.34, 1.0], spd: 1.9, amp: 1},
  error: {a: [1.0, 0.45, 0.52], b: [0.96, 0.6, 0.1], spd: 0.6, amp: 0}
};
export interface Orb { el: HTMLElement; set(s: OrbState): void; wave(on: boolean): void; webgl: boolean }

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `precision highp float;
uniform vec2 R;uniform float T;uniform vec3 A;uniform vec3 B;uniform float AMP;uniform float W;uniform vec2 C;uniform float RAD;
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
 vec2 px=gl_FragCoord.xy;vec2 q=px/R;vec3 col=vec3(0.);
 if(W>.001){vec3 s=vec3(0.);
  for(int i=0;i<8;i++){float fi=float(i);
   float c=.22+.016*fi+.075*sin(q.x*2.3+T*.33+fi*.42)+.035*sin(q.x*5.1-T*.25+fi*.85);
   float d=q.y-c;float th=.005+.0035*fi;
   float sh=.2+.8*pow(.5+.5*sin(q.x*3.1-T*.45+fi*.75),3.);
   s+=mix(B,A,fi/7.)*(exp(-d*d/(th*th))*sh*.9+exp(-d*d/.004)*.07*sh);}
  col+=s*W*(.45+.55*smoothstep(0.,.25,q.x)*smoothstep(1.,.75,q.x));}
 vec2 p=(px-C)/RAD;float pul=1.+AMP*.05*sin(T*8.5);p/=pul;float r=length(p);
 float vg=smoothstep(0.,.14,q.x)*smoothstep(1.,.86,q.x)*smoothstep(0.,.14,q.y)*smoothstep(1.,.86,q.y);
 col+=mix(B,A,.4)*exp(-max(r-1.,0.)*3.4)*(.4+AMP*.3)*vg;
 float e=0.;
 if(r<1.){float z=sqrt(1.-r*r);vec3 n=vec3(p,z);float t=T*.2;float ca=cos(t),sa=sin(t);
  vec3 sp=vec3(ca*n.x-sa*n.z,n.y,sa*n.x+ca*n.z);float f=n3(sp*1.7+vec3(0.,T*.11,0.));
  float g=sin((sp.x*1.+sp.y*1.5+f*2.3)*2.1+T*.6);float g2=sin((sp.y*1.3-sp.x*1.1+f*1.9)*1.7-T*.45);
  float side=smoothstep(-.5,.9,dot(n,normalize(vec3(.55,-.45,.7))));
  float rib=(exp(-abs(g)*5.5)+.4*exp(-abs(g2)*8.))*(.15+.85*side);float fr=pow(1.-z,2.6);
  vec3 c=mix(vec3(.004,.005,.025),B*.12,.5+.5*n.y);
  c+=rib*mix(A,vec3(.86,.94,1.),.35)*(.25+.75*z)*1.25;
  c+=fr*mix(B,A,.5+.5*n.y)*1.6;
  c+=A*exp(-length(p-vec2(.1,-.6))*2.8)*.45;
  vec3 L=normalize(vec3(-.45,.6,.75));c+=vec3(pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),36.))*.7;
  e=smoothstep(1.,.985,r);col=mix(col,c,e);}
 float a=max(e,clamp(max(col.r,max(col.g,col.b))*1.3,0.,1.));
 gl_FragColor=vec4(col,a);}`;

export function createOrb(): Orb {
  const el = document.createElement('div'); el.className = 'orb-stage';
  const cv = document.createElement('canvas'); el.append(cv);
  let gl: WebGLRenderingContext | null = null;
  try { gl = cv.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: false}); } catch { gl = null; }
  let state: OrbState = 'idle', waveOn = false;
  if (!gl) { el.classList.add('orb-css'); el.append(Object.assign(document.createElement('div'), {className: 'orb-ball'})); return {el, webgl: false, set(s) { el.dataset.s = s; }, wave(on) { el.classList.toggle('waving', on); }}; }
  const sh = (t: number, src: string) => { const s = gl!.createShader(t)!; gl!.shaderSource(s, src); gl!.compileShader(s); return s; };
  const pr = gl.createProgram()!; gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl!.getUniformLocation(pr, n);
  const u = {R: U('R'), T: U('T'), A: U('A'), B: U('B'), AMP: U('AMP'), W: U('W'), C: U('C'), RAD: U('RAD')};
  const cur = {a: [...LOOK.idle.a], b: [...LOOK.idle.b], spd: 1, amp: 0, w: 0, cy: 0.5};
  let t = 0, last = performance.now(), live = 0, w = 0, hgt = 0, dpr = 1, frame = 0;
  const size = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); w = el.clientWidth; hgt = el.clientHeight; cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(hgt * dpr)); };
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(el);
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const draw = (now: number) => {
    requestAnimationFrame(draw);
    if (document.hidden || !el.isConnected) { last = now; return; }
    if (!cv.width || cv.width === 1 || el.clientWidth !== w || el.clientHeight !== hgt) size();
    const L = LOOK[state], calm = state === 'idle' && !waveOn;
    if (calm && (frame++ & 1)) return;   /* 30 images par seconde au repos */
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const k = 1 - Math.pow(0.02, dt);
    for (let i = 0; i < 3; i++) { cur.a[i] = lerp(cur.a[i], L.a[i], k); cur.b[i] = lerp(cur.b[i], L.b[i], k); }
    cur.spd = lerp(cur.spd, L.spd, k); cur.w = lerp(cur.w, waveOn ? 1 : 0, k * 0.8); cur.cy = lerp(cur.cy, waveOn ? 0.6 : 0.5, k);
    live = state === 'speaking' ? lerp(live, 0.4 + Math.random() * 0.8, 0.25) : lerp(live, L.amp, k);
    t += dt * cur.spd;
    gl!.viewport(0, 0, cv.width, cv.height);
    gl!.uniform2f(u.R, cv.width, cv.height); gl!.uniform1f(u.T, t); gl!.uniform3fv(u.A, cur.a); gl!.uniform3fv(u.B, cur.b);
    gl!.uniform1f(u.AMP, live); gl!.uniform1f(u.W, cur.w);
    gl!.uniform2f(u.C, cv.width / 2, cv.height * cur.cy); gl!.uniform1f(u.RAD, Math.min(cv.width, cv.height) * (waveOn ? 0.27 : 0.33));
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  };
  requestAnimationFrame(draw);
  return {el, webgl: true, set(s) { state = s; el.dataset.s = s; }, wave(on) { waveOn = on; }};
}
