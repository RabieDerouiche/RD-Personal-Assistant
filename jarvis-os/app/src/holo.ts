/* Thème « hologramme » (image du propriétaire, 16/11/2026) : un globe de réseau bleu néon (points reliés, cœur lumineux,
   anneau en orbite) posé sur un socle d'anneaux concentriques. Canvas 2D, sans bibliothèque ; même interface que l'orbe. */
import type {Orb, OrbState} from './orb';

type RGB = [number, number, number];
const COL: Record<OrbState, {a: RGB; b: RGB; spd: number; amp: number}> = {
  idle: {a: [56, 189, 248], b: [99, 102, 241], spd: 1, amp: 0},
  listening: {a: [34, 211, 238], b: [56, 189, 248], spd: 1.5, amp: 0.5},
  thinking: {a: [168, 85, 247], b: [99, 102, 241], spd: 3, amp: 0.25},
  executing: {a: [52, 211, 153], b: [56, 189, 248], spd: 2, amp: 0.3},
  speaking: {a: [96, 165, 250], b: [168, 85, 247], spd: 1.8, amp: 1},
  error: {a: [251, 113, 133], b: [245, 158, 11], spd: 0.6, amp: 0}
};
export interface HoloOpts { pedestal?: boolean; nodes?: number; ring?: boolean }

export function createHolo(o: HoloOpts = {}): Orb {
  const N = o.nodes ?? 130, ped = !!o.pedestal, ring = o.ring !== false;
  const el = document.createElement('div'); el.className = 'orb-stage holo-stage';
  const cv = document.createElement('canvas'); el.append(cv);
  const g = cv.getContext('2d');
  let state: OrbState = 'idle', waveOn = false;
  if (!g) return {el, webgl: false, set(s) { state = s; el.dataset.s = s; }, wave(on) { waveOn = on; }};
  /* points répartis sur la sphère (spirale de Fibonacci), reliés à leurs 3 plus proches voisins */
  const P: number[][] = [];
  for (let i = 0; i < N; i++) { const y = 1 - (2 * i + 1) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963; P.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
  const E: [number, number][] = []; const seen = new Set<string>();
  P.forEach((p, i) => {
    P.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2] as [number, number]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3)
      .forEach(([j]) => { const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); E.push([i, j]); } });
  });
  const RAYS = Array.from({length: Math.max(4, Math.round(N / 10))}, (_, i) => (i * 7919) % N);
  const cur = {a: [...COL.idle.a], b: [...COL.idle.b], spd: 1};
  let t = 0, last = performance.now(), live = 0, w = 0, hgt = 0, dpr = 1, frame = 0, vis = true;
  const size = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); w = el.clientWidth; hgt = el.clientHeight; cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(hgt * dpr)); };
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(el);
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { vis = es[es.length - 1].isIntersecting; }).observe(el);
  const rgba = (c: number[], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const draw = (now: number) => {
    requestAnimationFrame(draw);
    if (document.hidden || !el.isConnected || !vis) { last = now; return; }
    if (!cv.width || cv.width === 1 || el.clientWidth !== w || el.clientHeight !== hgt) size();
    const L = COL[state], calm = state === 'idle' && !waveOn;
    if (calm && (frame++ & 1)) return;   /* 30 images par seconde au repos */
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const k = 1 - Math.pow(0.02, dt);
    for (let i = 0; i < 3; i++) { cur.a[i] = lerp(cur.a[i], L.a[i], k); cur.b[i] = lerp(cur.b[i], L.b[i], k); }
    cur.spd = lerp(cur.spd, L.spd, k);
    live = state === 'speaking' ? lerp(live, 0.35 + Math.random() * 0.8, 0.25) : lerp(live, L.amp, k);
    t += dt * cur.spd;
    const W = cv.width, H = cv.height, A = cur.a, B = cur.b;
    const R = Math.min(W, H * (ped ? 0.78 : 1)) * (ped ? 0.3 : ring ? 0.31 : 0.36) * (1 + live * 0.04 * Math.sin(t * 9));
    const cx = W / 2, cy = ped ? H * 0.42 : H / 2;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
    /* halo autour du globe */
    const halo = Math.min(R * 1.9, Math.min(W, H) * 0.5 - 1);
    let gr = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, Math.max(R * 0.7, halo));
    gr.addColorStop(0, rgba(A, 0.22 + live * 0.12)); gr.addColorStop(1, rgba(B, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, Math.max(R * 0.7, halo), 0, Math.PI * 2); g.fill();
    /* socle : anneaux concentriques et faisceau */
    if (ped) {
      const py = cy + R * 1.42, pr = R * 1.55;
      gr = g.createLinearGradient(0, cy, 0, py); gr.addColorStop(0, rgba(A, 0)); gr.addColorStop(1, rgba(A, 0.16 + live * 0.1));
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx - R * 0.55, cy + R * 0.6); g.lineTo(cx + R * 0.55, cy + R * 0.6); g.lineTo(cx + pr * 0.62, py); g.lineTo(cx - pr * 0.62, py); g.closePath(); g.fill();
      g.save(); g.translate(cx, py); g.scale(1, 0.24);
      gr = g.createRadialGradient(0, 0, 0, 0, 0, pr * 1.1); gr.addColorStop(0, rgba(A, 0.35)); gr.addColorStop(0.6, rgba(B, 0.12)); gr.addColorStop(1, rgba(B, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, pr * 1.1, 0, Math.PI * 2); g.fill();
      g.restore();
      [1, 0.78, 0.56, 0.34].forEach((f, i) => {
        g.lineWidth = (i === 0 ? 2 : 1.3) * dpr; g.strokeStyle = rgba(i % 2 ? B : A, 0.75 - i * 0.12);
        g.beginPath(); g.ellipse(cx, py, pr * f, pr * f * 0.24, 0, 0, Math.PI * 2); g.stroke();
      });
      const ph = (t * 0.6) % 1, pf = 0.34 + ph * 0.8; g.lineWidth = 1.5 * dpr; g.strokeStyle = rgba(A, 0.5 * (1 - ph));
      g.beginPath(); g.ellipse(cx, py, pr * pf, pr * pf * 0.24, 0, 0, Math.PI * 2); g.stroke();
    }
    /* orbite (moitié arrière) */
    const tilt = -0.32, orx = R * 1.5, ory = R * 0.36;
    const orbit = (from: number, to: number, a: number) => {
      g.save(); g.translate(cx, cy); g.rotate(tilt); g.lineWidth = 1.4 * dpr; g.strokeStyle = rgba(A, a);
      g.beginPath(); g.ellipse(0, 0, orx, ory, 0, from, to); g.stroke(); g.restore();
    };
    if (ring) orbit(Math.PI, Math.PI * 2, 0.22);
    /* corps du globe : bord lumineux (effet de verre) */
    gr = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    gr.addColorStop(0, rgba(B, 0.05)); gr.addColorStop(0.75, rgba(A, 0.08)); gr.addColorStop(1, rgba(A, 0.32 + live * 0.15));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = 1.2 * dpr; g.strokeStyle = rgba(A, 0.55); g.stroke();
    /* réseau : rotation, perspective */
    const ay = t * 0.32, ax = 0.38 + 0.06 * Math.sin(t * 0.4), ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
    const S = P.map(([x, y, z]) => { const x1 = ca * x + sa * z, z1 = -sa * x + ca * z; const y2 = cb * y - sb * z1, z2 = sb * y + cb * z1; const f = 2.6 / (2.6 - z2); return [cx + x1 * R * f * 0.94, cy + y2 * R * f * 0.94, z2]; });
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (const [i, j] of E) { const zm = (S[i][2] + S[j][2]) / 2; if ((zm > 0) !== (pass === 1)) continue; g.moveTo(S[i][0], S[i][1]); g.lineTo(S[j][0], S[j][1]); }
      g.lineWidth = (pass ? 1.1 : 0.8) * dpr; g.strokeStyle = rgba(pass ? A : B, pass ? 0.5 + live * 0.2 : 0.16); g.stroke();
    }
    /* rayons du cœur vers quelques points, qui scintillent */
    RAYS.forEach((i, n) => {
      const s = S[i]; if (s[2] < -0.2) return; const fl = 0.5 + 0.5 * Math.sin(t * 3 + n * 1.7);
      g.lineWidth = 0.9 * dpr; g.strokeStyle = rgba(A, (0.08 + 0.25 * fl) * (0.6 + live));
      g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + (s[0] - cx) * 0.3 + R * 0.12 * Math.sin(n), cy + (s[1] - cy) * 0.7, s[0], s[1]); g.stroke();
    });
    /* points */
    for (const s of S) {
      const fr = s[2] > 0, r0 = (fr ? 1.6 : 1) * dpr * (0.8 + s[2] * 0.3);
      g.fillStyle = rgba(A, fr ? 0.18 : 0.06); g.beginPath(); g.arc(s[0], s[1], r0 * 3.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = fr ? 'rgba(220,245,255,.95)' : rgba(A, 0.45); g.beginPath(); g.arc(s[0], s[1], r0, 0, Math.PI * 2); g.fill();
    }
    /* cœur */
    const cr = R * (0.3 + live * 0.12 + 0.03 * Math.sin(t * 2));
    gr = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
    gr.addColorStop(0, 'rgba(240,250,255,.95)'); gr.addColorStop(0.25, rgba(A, 0.65)); gr.addColorStop(1, rgba(B, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
    /* orbite (moitié avant) et l'étincelle qui y circule */
    if (ring) {
      orbit(0, Math.PI, 0.55);
      const u = t * 0.9, ex = Math.cos(u) * orx, ey = Math.sin(u) * ory, rx = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), ry = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
      if (Math.sin(u) > 0 || Math.hypot(rx - cx, ry - cy) > R) {
        gr = g.createRadialGradient(rx, ry, 0, rx, ry, 7 * dpr); gr.addColorStop(0, 'rgba(240,250,255,1)'); gr.addColorStop(1, rgba(A, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(rx, ry, 7 * dpr, 0, Math.PI * 2); g.fill();
      }
    }
    /* écoute : ondes qui partent du globe */
    if (state === 'listening' || waveOn && state === 'speaking') {
      for (let n = 0; n < 2; n++) { const ph = (t * 0.7 + n / 2) % 1; g.lineWidth = 1.3 * dpr; g.strokeStyle = rgba(A, 0.35 * (1 - ph)); g.beginPath(); g.arc(cx, cy, R * (1.02 + ph * 0.5), 0, Math.PI * 2); g.stroke(); }
    }
    g.globalCompositeOperation = 'source-over';
  };
  requestAnimationFrame(draw);
  return {el, webgl: false, set(s) { state = s; el.dataset.s = s; }, wave(on) { waveOn = on; }};
}
