/* L'hologramme, d'après les maquettes choisies le 15/11/2026 : une sphère faite d'anneaux de lumière (parallèles pointillés,
   anneaux concentriques aux pôles), un cœur irisé bleu-violet, un halo et une poussière d'étoiles.
   Chaque état de JARVIS a son mouvement. Économe sur iPhone : densité limitée à 2, 30 images/s au repos, pause en arrière-plan. */
import * as THREE from 'three';

export type HoloState = 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'error';
interface Look { glow: number; wave: number; spin: number; swirl: number; a: THREE.Color; b: THREE.Color }
const C = (h: string) => new THREE.Color(h);
const LOOKS: Record<HoloState, Look> = {
  idle: {glow: 0.7, wave: 0.25, spin: 0.12, swirl: 0.04, a: C('#38bdf8'), b: C('#7c3aed')},
  listening: {glow: 1.15, wave: 1.0, spin: 0.2, swirl: 0.1, a: C('#22d3ee'), b: C('#6366f1')},
  thinking: {glow: 0.95, wave: 0.6, spin: 1.1, swirl: 0.5, a: C('#60a5fa'), b: C('#a855f7')},
  executing: {glow: 1.0, wave: 1.4, spin: 0.7, swirl: 0.9, a: C('#818cf8'), b: C('#c026d3')},
  speaking: {glow: 1.2, wave: 0.8, spin: 0.3, swirl: 0.15, a: C('#67e8f9'), b: C('#818cf8')},
  error: {glow: 0.8, wave: 0.15, spin: 0.05, swirl: 0.02, a: C('#fb7185'), b: C('#f59e0b')}
};

export interface Hologram { el: HTMLElement; set(s: HoloState): void; dispose(): void; webgl: boolean }

const glowTexture = () => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};

export function createHologram(size = 280): Hologram {
  const box = document.createElement('div');
  box.className = 'holo';
  let gl: THREE.WebGLRenderer;
  try { gl = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'}); }
  catch { box.classList.add('holo-css'); box.append(Object.assign(document.createElement('div'), {className: 'holo-orb'})); return {el: box, webgl: false, set(s) { box.dataset.s = s; }, dispose() {}}; }

  gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  gl.setSize(size, size);
  box.append(gl.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  cam.position.set(0, 0, 7.2);
  const root = new THREE.Group(); root.rotation.x = 0.42; scene.add(root);
  const add = THREE.AdditiveBlending;

  /* parallèles : points sur des cercles de latitude, dégradé du haut vers le bas */
  const R = 1.55, LAT = 22, PER = 150;
  const n = LAT * PER, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), lat = new Float32Array(n);
  let k = 0;
  for (let i = 1; i <= LAT; i++) {
    const phi = -Math.PI / 2 + (i / (LAT + 1)) * Math.PI, y = Math.sin(phi) * R, rr = Math.cos(phi) * R;
    for (let j = 0; j < PER; j++) { const th = (j / PER) * Math.PI * 2; pos[k * 3] = rr * Math.cos(th); pos[k * 3 + 1] = y; pos[k * 3 + 2] = rr * Math.sin(th); lat[k] = i / (LAT + 1); k++; }
  }
  const dotsG = new THREE.BufferGeometry();
  dotsG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dotsG.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dots = new THREE.Points(dotsG, new THREE.PointsMaterial({size: 0.03, vertexColors: true, transparent: true, opacity: 0.9, blending: add, depthWrite: false}));
  root.add(dots);

  /* quelques parallèles en trait plein, plus lumineux */
  const lines: THREE.LineLoop[] = [];
  [-0.62, -0.25, 0.12, 0.48].forEach((t) => {
    const phi = t * Math.PI / 2, y = Math.sin(phi) * R, rr = Math.cos(phi) * R * 1.004, pts: THREE.Vector3[] = [];
    for (let j = 0; j < 160; j++) { const th = (j / 160) * Math.PI * 2; pts.push(new THREE.Vector3(rr * Math.cos(th), y, rr * Math.sin(th))); }
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({transparent: true, opacity: 0.55, blending: add, depthWrite: false}));
    (l as any).userData.t = t; lines.push(l); root.add(l);
  });

  /* anneaux concentriques aux deux pôles (le haut et la face avant), comme des cibles lumineuses */
  const poles: THREE.Mesh[] = [];
  const pole = (dir: THREE.Vector3, count: number) => {
    const g = new THREE.Group(); g.lookAt(dir); g.position.copy(dir.clone().multiplyScalar(R * 0.995));
    for (let i = 0; i < count; i++) {
      const r = 0.06 + i * 0.13;
      const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.012 + (i === count - 1 ? 0.01 : 0), 96), new THREE.MeshBasicMaterial({transparent: true, opacity: 0.8 - i * 0.1, blending: add, depthWrite: false, side: THREE.DoubleSide}));
      (m as any).userData.i = i; poles.push(m); g.add(m);
    }
    root.add(g);
  };
  pole(new THREE.Vector3(0, 1, 0), 5);
  pole(new THREE.Vector3(0, -0.45, 0.89).normalize(), 6);

  /* le cœur irisé : Fresnel bleu-violet */
  const coreMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: add,
    uniforms: {uA: {value: C('#38bdf8')}, uB: {value: C('#7c3aed')}, uGlow: {value: 0.7}, uT: {value: 0}},
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uA; uniform vec3 uB; uniform float uGlow; uniform float uT; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0-max(dot(vN,vV),0.0), 2.4); float m = 0.5+0.5*sin(vP.y*2.2+uT*0.8); vec3 c = mix(uA,uB,m); gl_FragColor = vec4(c*(f*1.4+0.06)*uGlow, (f*0.85+0.05)*uGlow); }'
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.97, 64, 48), coreMat);
  root.add(core);

  /* halo et poussière */
  const tex = glowTexture();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, color: C('#4f46e5'), transparent: true, opacity: 0.55, blending: add, depthWrite: false}));
  halo.scale.set(6.2, 6.2, 1); scene.add(halo);
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, color: C('#7dd3fc'), transparent: true, opacity: 0.35, blending: add, depthWrite: false}));
  heart.scale.set(1.6, 1.6, 1); scene.add(heart);
  const DN = 500, dp = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 2.0 + Math.random() * 1.4, s = Math.sqrt(1 - u * u); dp[i * 3] = r * s * Math.cos(th); dp[i * 3 + 1] = r * u; dp[i * 3 + 2] = r * s * Math.sin(th); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({size: 0.02, color: C('#93c5fd'), transparent: true, opacity: 0.45, blending: add, depthWrite: false}));
  scene.add(dust);

  const cur: Look = {...LOOKS.idle, a: LOOKS.idle.a.clone(), b: LOOKS.idle.b.clone()};
  let target = LOOKS.idle, state: HoloState = 'idle', raf = 0, last = 0, t = 0, alive = true, talk = 0, talkT = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tmp = new THREE.Color();

  const frame = (now: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (state === 'idle' && now - last < 33) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const q = Math.min(1, dt * 3);
    cur.glow += (target.glow - cur.glow) * q; cur.wave += (target.wave - cur.wave) * q; cur.spin += (target.spin - cur.spin) * q; cur.swirl += (target.swirl - cur.swirl) * q;
    cur.a.lerp(target.a, q); cur.b.lerp(target.b, q);
    t += reduce ? dt * 0.25 : dt;
    if (state === 'speaking') { talkT -= dt; if (talkT <= 0) { talk = 0.35 + Math.random() * 0.65; talkT = 0.12 + Math.random() * 0.1; } } else talk *= 0.9;
    const amp = state === 'speaking' ? talk : 0;
    root.rotation.y += cur.spin * dt;
    const s = 1 + Math.sin(t * 1.8) * 0.012 + amp * 0.04; root.scale.setScalar(s);
    /* couleurs des points : dégradé et vague lumineuse qui parcourt les parallèles */
    for (let i = 0; i < n; i++) {
      const L = lat[i], w = 0.5 + 0.5 * Math.sin(L * 14 - t * (2 + cur.wave * 3));
      tmp.copy(cur.b).lerp(cur.a, L); const g = (0.35 + 0.65 * w * Math.min(1, cur.wave + 0.3)) * cur.glow + amp * 0.4;
      col[i * 3] = tmp.r * g; col[i * 3 + 1] = tmp.g * g; col[i * 3 + 2] = tmp.b * g;
    }
    (dotsG.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    lines.forEach((l) => { const m = l.material as THREE.LineBasicMaterial; m.color.copy(cur.b).lerp(cur.a, ((l as any).userData.t + 1) / 2); m.opacity = 0.35 + 0.35 * cur.glow; });
    poles.forEach((m) => { const i = (m as any).userData.i, mm = m.material as THREE.MeshBasicMaterial; const w = 0.5 + 0.5 * Math.sin(t * (2 + cur.wave * 4) - i * 0.9); mm.color.copy(cur.a).lerp(C('#ffffff'), 0.25 * w); mm.opacity = (0.35 + 0.55 * w) * Math.min(1.2, cur.glow) ; });
    coreMat.uniforms.uA.value.copy(cur.a); coreMat.uniforms.uB.value.copy(cur.b); coreMat.uniforms.uGlow.value = cur.glow + amp * 0.5; coreMat.uniforms.uT.value = t;
    (halo.material as THREE.SpriteMaterial).color.copy(cur.b); (halo.material as THREE.SpriteMaterial).opacity = 0.35 + 0.25 * cur.glow + amp * 0.2;
    (heart.material as THREE.SpriteMaterial).opacity = 0.2 + 0.2 * cur.glow + amp * 0.3;
    dust.rotation.y -= cur.swirl * dt * 0.6; dust.rotation.x = Math.sin(t * 0.2) * 0.1;
    gl.render(scene, cam);
  };
  raf = requestAnimationFrame(frame);
  const vis = () => { cancelAnimationFrame(raf); if (!document.hidden && alive) { last = 0; raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', vis);
  return {
    el: box, webgl: true,
    set(s) { state = s; target = LOOKS[s]; box.dataset.s = s; },
    dispose() { alive = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); gl.dispose(); }
  };
}
