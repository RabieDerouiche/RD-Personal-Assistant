/* Thème « hologramme » (image du propriétaire, 16/11/2026) : un globe de réseau bleu néon (points reliés, cœur lumineux,
   anneau en orbite) posé sur un socle d'anneaux concentriques. Canvas 2D, sans bibliothèque ; même interface que l'orbe.
   Refonte UX (22/11/2026) : vivant (réfléchit : paquets de lumière sur le réseau ; parle : cœur qui bat et couronne d'ondes ;
   écoute : ondes ; repos : respiration) et, option « hud », l'écran de JARVIS de l'accueil (anneaux gradués, arcs, balayage, poussière).
   0.56.0 (« ralentissements sur la page d'accueil », mesuré : 11 images par seconde au repos, processeur ralenti comme un téléphone) :
   moteur réécrit pour la vitesse : tout ce qui ne change pas d'une image à l'autre (anneaux, graduations, arcs, balayage, halo,
   poussière) est dessiné une fois dans des calques que l'affichage fait tourner lui-même (animations du navigateur, sans calcul) ;
   seul le réseau du globe est redessiné, avec des taches de lumière toutes prêtes ; 2 pixels par point au plus ; 30 images par
   seconde au repos, 60 quand il écoute, réfléchit ou parle ; la couleur de l'état passe par un filtre (pas de recalcul). */
import type {Orb, OrbState} from './orb';

/* l'état change la teinte (filtre de l'écran, animé), la vitesse et l'amplitude ; le dessin garde ses couleurs de base */
const LOOK: Record<OrbState, {f: string; spd: number; amp: number}> = {
  idle: {f: 'none', spd: 1, amp: 0},
  listening: {f: 'hue-rotate(-12deg) saturate(1.25) brightness(1.08)', spd: 1.5, amp: 0.5},
  thinking: {f: 'hue-rotate(68deg) saturate(1.3) brightness(1.06)', spd: 3.2, amp: 0.25},
  executing: {f: 'hue-rotate(-55deg) saturate(1.2)', spd: 2, amp: 0.3},
  speaking: {f: 'hue-rotate(22deg) saturate(1.25) brightness(1.12)', spd: 1.8, amp: 1},
  error: {f: 'hue-rotate(150deg) saturate(1.4)', spd: 0.6, amp: 0}
};
const A = [56, 189, 248], B = [99, 102, 241], WHITE = [225, 247, 255];
export interface HoloOpts { pedestal?: boolean; nodes?: number; ring?: boolean; voice?: boolean; hud?: boolean }
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const layer = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return [c, c.getContext('2d') as CanvasRenderingContext2D]; };
/* une tache de lumière (point, paquet, étincelle) : dessinée une fois, posée autant de fois qu'il faut */
function glow(r: number, core: number[], edge: number[], hard = 0.18): HTMLCanvasElement {
  const [c, g] = layer(r * 2, r * 2), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(core, 1)); gr.addColorStop(hard, rgba(core, 0.85)); gr.addColorStop(0.45, rgba(edge, 0.28)); gr.addColorStop(1, rgba(edge, 0));
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
}
let cssDone = false;
function css() {
  if (cssDone || typeof document === 'undefined') return; cssDone = true;
  const s = document.createElement('style');
  s.textContent = '.holo-stage{position:relative}.holo-stage .hl{position:absolute;inset:0;pointer-events:none;transition:filter .7s ease}.holo-stage .hl>i{position:absolute;display:block;transition:opacity .6s ease}.holo-stage .hl canvas{display:block;width:100%;height:100%}.holo-stage>canvas{position:absolute;inset:0;width:100%;height:100%;transition:filter .7s ease}'
    + (Object.keys(LOOK) as OrbState[]).filter((k) => k !== 'idle').map((k) => '.holo-stage[data-s="' + k + '"]>canvas,.holo-stage[data-s="' + k + '"] .hl{filter:' + LOOK[k].f + '}').join('')
    + '.holo-stage[data-s="thinking"] .hl .arc,.holo-stage[data-s="speaking"] .hl .arc{opacity:1}.holo-stage[data-s="speaking"] .hl .swp{opacity:1}';
  document.head.append(s);
}

export function createHolo(o: HoloOpts = {}): Orb {
  css();
  const el = document.createElement('div'); el.className = 'orb-stage holo-stage'; el.dataset.s = 'idle';
  const deco = document.createElement('div'); deco.className = 'hl'; el.append(deco);   /* calques qui tournent seuls */
  const cv = document.createElement('canvas'); el.append(cv);
  const g = cv.getContext('2d');
  let state: OrbState = 'idle', waveOn = false;
  const ANIMS: {a: Animation; base: number; kind: string}[] = [];
  const rate = () => { const L = LOOK[state]; ANIMS.forEach((x) => { try { x.a.updatePlaybackRate(x.kind === 'arc' ? L.spd * (state === 'thinking' ? 1.6 : 1) : L.spd); } catch (e) { /* rien */ } }); };
  const api: Orb = {el, webgl: false, set(s) { state = s; el.dataset.s = s; rate(); }, wave(on) { waveOn = on; }};
  if (!g) return api;
  const N = o.nodes ?? 130, ped = !!o.pedestal, ring = o.ring !== false, voiceRing = o.voice !== false, hud = !!o.hud;
  /* réseau : points sur la sphère (spirale de Fibonacci), chacun relié à ses 3 plus proches voisins */
  const P: number[][] = [];
  for (let i = 0; i < N; i++) { const y = 1 - (2 * i + 1) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963; P.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
  const E: [number, number][] = [], seen = new Set<string>();
  P.forEach((p, i) => {
    P.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2] as [number, number]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3)
      .forEach(([j]) => { const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); E.push([i, j]); } });
  });
  const NB: number[][] = P.map(() => []); E.forEach(([a, b], n) => { NB[a].push(n); NB[b].push(n); });
  const RAYS = Array.from({length: Math.max(4, Math.round(N / 10))}, (_, i) => (i * 7919) % N);
  const PK = Array.from({length: 14}, (_, i) => ({e: (i * 37) % E.length, u: (i * 0.13) % 1}));
  const S = P.map(() => [0, 0, 0]);
  let t = 0, last = performance.now(), live = 0, think = 0, talk = 0, w = 0, hgt = 0, dpr = 1, vis = true, frame = 0, R0 = 0, spd = 1;
  let SP: Record<string, HTMLCanvasElement> = {};
  const voice = (x: number) => { const syl = Math.max(0, Math.sin(x * 7.3) * 0.6 + Math.sin(x * 3.1 + 1) * 0.5 + 0.25); const breath = Math.sin(x * 0.9) > -0.75 ? 1 : 0.15; return Math.min(1, syl * breath * (0.75 + 0.25 * Math.sin(x * 23))); };
  /* un calque : dessiné une fois, centré sur le globe, tourné par le navigateur (period en secondes ; négatif : sens inverse) */
  function deck(cls: string, D: number, cyCss: number, paint: (g1: CanvasRenderingContext2D, c: number) => void, period: number, alpha: number, kind = '') {
    const wrap = document.createElement('i'); wrap.className = cls; const cs = D / dpr;
    wrap.style.cssText = 'width:' + cs + 'px;height:' + cs + 'px;left:calc(50% - ' + cs / 2 + 'px);top:' + (cyCss - cs / 2) + 'px;opacity:' + alpha;
    const [c1, g1] = layer(D, D); g1.translate(D / 2, D / 2); paint(g1, D / 2); wrap.append(c1); deco.append(wrap);
    if (period && !reduced && c1.animate) { const a = c1.animate([{transform: 'rotate(0deg)'}, {transform: 'rotate(' + (period > 0 ? 360 : -360) + 'deg)'}], {duration: Math.abs(period) * 1000, iterations: Infinity}); ANIMS.push({a, base: period, kind}); }
    return wrap;
  }
  function build(W: number, H: number) {
    const R = R0, cyCss = (ped ? H * 0.42 : H / 2) / dpr;
    SP = {dotF: glow(Math.max(3, 4.6 * dpr), WHITE, A, 0.22), dotB: glow(Math.max(2, 3 * dpr), A, B, 0.1), spark: glow(7 * dpr, [245, 252, 255], A, 0.15), pk: glow(6 * dpr, [245, 235, 255], A, 0.12), core: glow(Math.ceil(R * 0.5), [240, 250, 255], A, 0.08)};
    ANIMS.forEach((x) => x.a.cancel()); ANIMS.length = 0; deco.replaceChildren();
    /* halo et verre (respire) */
    const hD = Math.ceil(R * 3.9);
    const halo = deck('hal', hD, cyCss, (g1, c) => { let gr = g1.createRadialGradient(0, 0, R * 0.6, 0, 0, c); gr.addColorStop(0, rgba(A, 0.3)); gr.addColorStop(1, rgba(B, 0)); g1.fillStyle = gr; g1.fillRect(-c, -c, c * 2, c * 2);
      gr = g1.createRadialGradient(0, 0, R * 0.2, 0, 0, R); gr.addColorStop(0, rgba(B, 0.05)); gr.addColorStop(0.75, rgba(A, 0.08)); gr.addColorStop(1, rgba(A, 0.34)); g1.fillStyle = gr; g1.beginPath(); g1.arc(0, 0, R, 0, Math.PI * 2); g1.fill(); g1.lineWidth = 1.2 * dpr; g1.strokeStyle = rgba(A, 0.55); g1.stroke(); }, 0, 1);
    if (!reduced && halo.animate) halo.animate([{opacity: 0.82}, {opacity: 1}], {duration: 2300, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out'});
    if (ped) {
      const pr = R * 1.55, py = R * 1.42, pD = Math.ceil(pr * 2.4);
      const pd = deck('ped', pD, cyCss + py / dpr, (g1) => { g1.save(); g1.scale(1, 0.24); const gr = g1.createRadialGradient(0, 0, 0, 0, 0, pr * 1.1); gr.addColorStop(0, rgba(A, 0.35)); gr.addColorStop(0.6, rgba(B, 0.12)); gr.addColorStop(1, rgba(B, 0)); g1.fillStyle = gr; g1.beginPath(); g1.arc(0, 0, pr * 1.1, 0, Math.PI * 2); g1.fill(); g1.restore();
        [1, 0.78, 0.56, 0.34].forEach((f, i) => { g1.lineWidth = (i === 0 ? 2 : 1.3) * dpr; g1.strokeStyle = rgba(i % 2 ? B : A, 0.75 - i * 0.12); g1.beginPath(); g1.ellipse(0, 0, pr * f, pr * f * 0.24, 0, 0, Math.PI * 2); g1.stroke(); }); }, 0, 1);
      void pd;
    }
    if (hud) {
      const D = Math.ceil(R * 4.4);
      deck('rng', D, cyCss, (g1) => { g1.lineWidth = 1 * dpr; [[1.38, 0.28], [1.98, 0.14]].forEach(([f, a]) => { g1.strokeStyle = rgba(A, a); g1.beginPath(); g1.arc(0, 0, R * f, 0, Math.PI * 2); g1.stroke(); });
        [0, 1, 2, 3].forEach((q) => { const an = q * Math.PI / 2 + Math.PI / 4, x = Math.cos(an) * R * 1.98, y = Math.sin(an) * R * 1.98; g1.fillStyle = rgba(A, 0.2); g1.beginPath(); g1.arc(x, y, 7 * dpr, 0, Math.PI * 2); g1.fill(); g1.fillStyle = rgba(A, 0.95); g1.beginPath(); g1.arc(x, y, 2.6 * dpr, 0, Math.PI * 2); g1.fill(); }); }, 0, 1);
      deck('tck', D, cyCss, (g1) => { const rt = R * 1.62; g1.lineWidth = 1.1 * dpr; for (let i = 0; i < 120; i++) { const an = (i / 120) * Math.PI * 2, long = i % 5 === 0, l = long ? R * 0.1 : R * 0.045; g1.strokeStyle = rgba(long ? A : B, long ? 0.75 : 0.42); g1.beginPath(); g1.moveTo(Math.cos(an) * rt, Math.sin(an) * rt); g1.lineTo(Math.cos(an) * (rt + l), Math.sin(an) * (rt + l)); g1.stroke(); } }, 52, 1);
      const arcs = (list: [number, number, number, number[]][]) => (g1: CanvasRenderingContext2D) => { g1.lineCap = 'round'; list.forEach(([rf, len, lw, col], n) => { g1.lineWidth = lw * dpr; g1.strokeStyle = rgba(col, 0.9); const st = n * 2.1; g1.beginPath(); g1.arc(0, 0, R * rf, st, st + len); g1.stroke(); g1.beginPath(); g1.arc(0, 0, R * rf, st + Math.PI, st + Math.PI + len * 0.5); g1.stroke(); }); };
      deck('arc', D, cyCss, arcs([[1.84, 0.9, 3, A], [1.84, 0.45, 3, B], [2.1, 0.6, 1.6, B]]), -18, 0.65, 'arc');
      deck('arc', D, cyCss, arcs([[1.48, 1.4, 2, A]]), 12.5, 0.65, 'arc');
      deck('swp', D, cyCss, (g1) => { const anyG = g1 as any; if (!anyG.createConicGradient) return; const cg = anyG.createConicGradient(0, 0, 0) as CanvasGradient; cg.addColorStop(0, rgba(A, 0.34)); cg.addColorStop(0.08, rgba(A, 0)); cg.addColorStop(1, rgba(A, 0)); g1.fillStyle = cg; g1.beginPath(); g1.arc(0, 0, R * 1.98, 0, Math.PI * 2); g1.arc(0, 0, R * 1.05, 0, Math.PI * 2, true); g1.fill(); }, 7, 0.75);
      const dust = (seed: number) => (g1: CanvasRenderingContext2D) => { for (let i = 0; i < 26; i++) { const k = (i * 37 + seed * 11) % 100, an = i * 2.39 + seed, rr = R * (1.25 + k / 100 * 0.9), z = ((i * 71 + seed) % 100) / 100; g1.fillStyle = rgba(z > 0.5 ? A : B, 0.55 + 0.4 * z); g1.beginPath(); g1.arc(Math.cos(an) * rr, Math.sin(an) * rr * 0.92, (0.8 + z * 1.4) * dpr, 0, Math.PI * 2); g1.fill(); } };
      deck('dst', D, cyCss, dust(1), 90, 0.85); deck('dst', D, cyCss, dust(7), -125, 0.7);
    }
    rate();
  }
  /* écran de JARVIS : le réseau n'est redessiné que sur la zone du globe (pas sur tout l'écran) */
  const size = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2); w = el.clientWidth; hgt = el.clientHeight;
    const Wf = Math.max(1, Math.round(w * dpr)), Hf = Math.max(1, Math.round(hgt * dpr));
    R0 = Math.min(Wf, Hf * (ped ? 0.78 : 1)) * (hud ? 0.235 : ped ? 0.3 : ring ? 0.3 : 0.34);
    if (hud) { const D = Math.ceil(R0 * 3.3); cv.width = D; cv.height = D; const cs = D / dpr; cv.style.cssText = 'inset:auto;width:' + cs + 'px;height:' + cs + 'px;left:calc(50% - ' + cs / 2 + 'px);top:' + (Hf / 2 / dpr - cs / 2) + 'px'; }
    else { cv.width = Wf; cv.height = Hf; cv.style.cssText = ''; }
    if (w && hgt) build(Wf, Hf);
  };
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(el);
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { vis = es[es.length - 1].isIntersecting; ANIMS.forEach((x) => { try { if (vis) x.a.play(); else x.a.pause(); } catch (e) { /* rien */ } }); }).observe(el);
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const put = (img: HTMLCanvasElement, x: number, y: number, alpha: number) => { g.globalAlpha = alpha; g.drawImage(img, x - img.width / 2, y - img.height / 2); };
  const draw = (now: number) => {
    requestAnimationFrame(draw);
    if (document.hidden || !el.isConnected || !vis) { last = now; return; }
    if (!cv.width || cv.width === 1 || el.clientWidth !== w || el.clientHeight !== hgt) size();
    if (!R0) return;
    const busy = state !== 'idle' || waveOn;
    if (!busy && (frame++ & 1)) return;   /* 30 images par seconde au repos */
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const Lk = LOOK[state], k = 1 - Math.pow(0.02, dt);
    spd = lerp(spd, Lk.spd, k); think = lerp(think, state === 'thinking' ? 1 : 0, k * 1.5); talk = lerp(talk, state === 'speaking' ? 1 : 0, k * 1.5);
    const vv = voice(t * 1.6);
    live = state === 'speaking' ? lerp(live, 0.25 + vv * 0.9, 0.3) : lerp(live, Lk.amp, k);
    t += dt * (reduced ? 0.15 : spd);
    const W = cv.width, H = cv.height, breathe = state === 'idle' ? 0.012 * Math.sin(t * 1.4) : 0;
    const R = R0 * (1 + breathe + live * 0.035 * Math.sin(t * 9)), cx = W / 2, cy = ped && !hud ? H * 0.42 : H / 2;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = 1;
    const tilt = -0.32, orx = R * 1.5, ory = R * 0.36;
    const orbit = (from: number, to: number, a: number) => { g.save(); g.translate(cx, cy); g.rotate(tilt); g.lineWidth = 1.4 * dpr; g.strokeStyle = rgba(A, a); g.beginPath(); g.ellipse(0, 0, orx, ory, 0, from, to); g.stroke(); g.restore(); };
    if (ring) orbit(Math.PI, Math.PI * 2, 0.22);
    if (voiceRing && talk > 0.02) {
      for (let pass = 0; pass < 2; pass++) {
        g.beginPath();
        for (let i = pass; i < 72; i += 2) { const an = (i / 72) * Math.PI * 2 + t * 0.25, env = voice(t * 1.6 + i * 0.09) * (0.55 + 0.45 * Math.sin(i * 0.7 + t * 5)), r0 = R * 1.12, r1 = r0 + R * (0.06 + 0.32 * env) * talk; g.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); g.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); }
        g.lineWidth = 2 * dpr; g.strokeStyle = rgba(pass ? A : B, 0.75 * talk); g.stroke();
      }
    }
    const ay = t * 0.32, ax = 0.38 + 0.06 * Math.sin(t * 0.4), ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax), RR = R * 0.94;
    for (let i = 0; i < N; i++) { const p = P[i], x1 = ca * p[0] + sa * p[2], z1 = -sa * p[0] + ca * p[2], y2 = cb * p[1] - sb * z1, z2 = sb * p[1] + cb * z1, f = 2.6 / (2.6 - z2), s = S[i]; s[0] = cx + x1 * RR * f; s[1] = cy + y2 * RR * f; s[2] = z2; }
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      for (const [i, j] of E) { const zm = (S[i][2] + S[j][2]) / 2; if ((zm > 0) !== (pass === 1)) continue; g.moveTo(S[i][0], S[i][1]); g.lineTo(S[j][0], S[j][1]); }
      g.lineWidth = (pass ? 1.1 : 0.8) * dpr; g.strokeStyle = rgba(pass ? A : B, pass ? 0.5 + live * 0.2 + think * 0.15 : 0.16); g.stroke();
    }
    g.beginPath();
    RAYS.forEach((i, n) => { const s = S[i]; if (s[2] < -0.2) return; g.moveTo(cx, cy); g.quadraticCurveTo(cx + (s[0] - cx) * 0.3 + R * 0.12 * Math.sin(n), cy + (s[1] - cy) * 0.7, s[0], s[1]); });
    g.lineWidth = 0.9 * dpr; g.strokeStyle = rgba(A, (0.16 + 0.1 * Math.sin(t * 3)) * (0.6 + live)); g.stroke();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) { const s = S[i], img = s[2] > 0 ? SP.dotF : SP.dotB; g.globalAlpha = s[2] > 0 ? 0.55 + s[2] * 0.45 : 0.5 + s[2] * 0.4; g.drawImage(img, s[0] - img.width / 2, s[1] - img.height / 2); }
    if (think > 0.02) {
      PK.forEach((q, n) => {
        q.u += dt * 2.2;
        if (q.u >= 1) { q.u = 0; const j = E[q.e][1], nx = NB[j].filter((m) => m !== q.e); q.e = nx.length ? nx[(n + Math.floor(t * 10)) % nx.length] : (q.e * 13 + 7) % E.length; }
        const [i, j] = E[q.e], a = S[i], b = S[j]; if ((a[2] + b[2]) / 2 < -0.1) return;
        put(SP.pk, a[0] + (b[0] - a[0]) * q.u, a[1] + (b[1] - a[1]) * q.u, think);
      });
    }
    put(SP.core, cx, cy, 1); if (live > 0.05) { const sc = 1 + live * 0.5; g.save(); g.translate(cx, cy); g.scale(sc, sc); g.globalAlpha = 0.5 * live; g.drawImage(SP.core, -SP.core.width / 2, -SP.core.height / 2); g.restore(); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (ring) {
      orbit(0, Math.PI, 0.55);
      const u = t * 0.9, ex = Math.cos(u) * orx, ey = Math.sin(u) * ory, rx = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), ry = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
      if (Math.sin(u) > 0 || Math.hypot(rx - cx, ry - cy) > R) { g.globalCompositeOperation = 'lighter'; put(SP.spark, rx, ry, 1); g.globalCompositeOperation = 'source-over'; }
    }
    if (state === 'listening' || (waveOn && state === 'speaking')) { g.globalAlpha = 1; for (let n = 0; n < 3; n++) { const ph = (t * 0.7 + n / 3) % 1; g.lineWidth = 1.4 * dpr; g.strokeStyle = rgba(A, 0.4 * (1 - ph)); g.beginPath(); g.arc(cx, cy, R * (1.02 + ph * 0.55), 0, Math.PI * 2); g.stroke(); } }
    g.globalAlpha = 1;
  };
  requestAnimationFrame(draw);
  return api;
}
