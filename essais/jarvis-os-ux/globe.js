/* Le globe de JARVIS pour la maquette UX (21/11/2026) : le globe réseau de l'app (jarvis-os/app/src/holo.ts : points reliés,
   cœur lumineux, orbite, socle d'anneaux), porté tel quel en JavaScript, avec en plus, à la demande du propriétaire
   (« l'orbe doit être vivante, bien animée, en haute résolution, qu'elle donne l'air de parler à une IA ») :
   - haute résolution (jusqu'à 3 pixels par point, comme l'écran de l'iPhone) ;
   - « réfléchit » : des paquets de lumière courent le long du réseau, le globe tourne plus vite, en violet ;
   - « parle » : le cœur bat au rythme d'une voix et une couronne d'ondes tourne autour du globe ;
   - « écoute » : des ondes partent du globe ; au repos, il respire.
   - « hud » (accueil, retour du 22/11 : « pas assez impressionnant, futuriste, vivant ») : anneaux gradués qui tournent en sens
     contraires, arcs de données, balayage radar, poussière de lumière en orbite ; tout suit l'état du globe.
   UXGlobe.create({pedestal, ring, nodes, voice, hud}) → {el, set(état)} ; états : idle, listening, thinking, speaking. */
(function () {
  'use strict';
  const COL = {
    idle: {a: [56, 189, 248], b: [99, 102, 241], spd: 1, amp: 0},
    listening: {a: [34, 211, 238], b: [56, 189, 248], spd: 1.5, amp: 0.5},
    thinking: {a: [168, 85, 247], b: [99, 102, 241], spd: 3.2, amp: 0.25},
    speaking: {a: [96, 165, 250], b: [168, 85, 247], spd: 1.8, amp: 1}
  };
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function create(o) {
    o = o || {};
    const N = o.nodes || 130, ped = !!o.pedestal, ring = o.ring !== false, voiceRing = o.voice !== false, hud = !!o.hud;
    const DUST = hud ? Array.from({length: 46}, (_, i) => ({r: 1.25 + ((i * 37) % 100) / 100 * 0.9, a: i * 2.39, s: 0.05 + ((i * 53) % 100) / 1000, z: ((i * 71) % 100) / 100})) : [];
    const el = document.createElement('div'); el.className = 'globe';
    const cv = document.createElement('canvas'); el.append(cv);
    const g = cv.getContext('2d');
    let state = 'idle';
    const api = {el, set(s) { if (COL[s]) { state = s; el.dataset.s = s; } }, get state() { return state; }};
    if (!g) return api;
    /* points sur la sphère (spirale de Fibonacci), reliés à leurs 3 plus proches voisins */
    const P = [];
    for (let i = 0; i < N; i++) { const y = 1 - (2 * i + 1) / N, r = Math.sqrt(1 - y * y), th = i * 2.399963; P.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
    const E = [], seen = new Set();
    P.forEach((p, i) => {
      P.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3)
        .forEach(([j]) => { const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); E.push([i, j]); } });
    });
    const RAYS = Array.from({length: Math.max(4, Math.round(N / 10))}, (_, i) => (i * 7919) % N);
    /* paquets de lumière (réflexion) : chacun suit une arête, puis une autre */
    const PK = Array.from({length: 14}, (_, i) => ({e: (i * 37) % E.length, u: Math.random()}));
    const cur = {a: COL.idle.a.slice(), b: COL.idle.b.slice(), spd: 1};
    let t = 0, last = performance.now(), live = 0, think = 0, talk = 0, w = 0, hgt = 0, dpr = 1, vis = true;
    const size = () => { dpr = Math.min(window.devicePixelRatio || 1, 3); w = el.clientWidth; hgt = el.clientHeight; cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(hgt * dpr)); };
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(el);
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { vis = es[es.length - 1].isIntersecting; }).observe(el);
    const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
    const lerp = (a, b, k) => a + (b - a) * k;
    /* une « voix » : plusieurs sinus et un peu de bruit, avec des syllabes et des respirations */
    const voice = (x) => { const syl = Math.max(0, Math.sin(x * 7.3) * 0.6 + Math.sin(x * 3.1 + 1) * 0.5 + 0.25); const breath = Math.sin(x * 0.9) > -0.75 ? 1 : 0.15; return Math.min(1, syl * breath * (0.75 + 0.25 * Math.sin(x * 23))); };
    const draw = (now) => {
      requestAnimationFrame(draw);
      if (document.hidden || !el.isConnected || !vis) { last = now; return; }
      if (!cv.width || cv.width === 1 || el.clientWidth !== w || el.clientHeight !== hgt) size();
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const L = COL[state], k = 1 - Math.pow(0.02, dt);
      for (let i = 0; i < 3; i++) { cur.a[i] = lerp(cur.a[i], L.a[i], k); cur.b[i] = lerp(cur.b[i], L.b[i], k); }
      cur.spd = lerp(cur.spd, L.spd, k);
      think = lerp(think, state === 'thinking' ? 1 : 0, k * 1.5);
      talk = lerp(talk, state === 'speaking' ? 1 : 0, k * 1.5);
      const vv = voice(t * 1.6);
      live = state === 'speaking' ? lerp(live, 0.25 + vv * 0.9, 0.3) : lerp(live, L.amp, k);
      t += dt * (reduced ? 0.15 : cur.spd);
      const W = cv.width, H = cv.height, A = cur.a, B = cur.b;
      const breathe = state === 'idle' ? 0.012 * Math.sin(t * 1.4) : 0;
      const R = Math.min(W, H * (ped ? 0.78 : 1)) * (hud ? 0.235 : ped ? 0.3 : ring ? 0.3 : 0.34) * (1 + breathe + live * 0.035 * Math.sin(t * 9));
      const cx = W / 2, cy = ped ? H * 0.42 : H / 2;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      /* halo */
      const halo = Math.min(R * 1.9, Math.min(W, H) * 0.5 - 1);
      let gr = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, Math.max(R * 0.7, halo));
      gr.addColorStop(0, rgba(A, 0.24 + live * 0.14 + 0.04 * Math.sin(t * 1.4))); gr.addColorStop(1, rgba(B, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, Math.max(R * 0.7, halo), 0, Math.PI * 2); g.fill();
      /* écran de JARVIS : anneaux gradués, arcs, balayage, poussière */
      if (hud) {
        const ring0 = (rad, a) => { g.lineWidth = 1 * dpr; g.strokeStyle = rgba(A, a); g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke(); };
        ring0(R * 1.38, 0.28); ring0(R * 1.98, 0.14);
        /* graduations : 120 traits, un sur cinq plus long, qui tournent lentement */
        const rt = R * 1.62, rot = t * 0.12;
        g.lineWidth = 1.1 * dpr;
        for (let i = 0; i < 120; i++) {
          const an = rot + (i / 120) * Math.PI * 2, long = i % 5 === 0, l = long ? R * 0.1 : R * 0.045;
          g.strokeStyle = rgba(long ? A : B, long ? 0.75 : 0.4);
          g.beginPath(); g.moveTo(cx + Math.cos(an) * rt, cy + Math.sin(an) * rt); g.lineTo(cx + Math.cos(an) * (rt + l), cy + Math.sin(an) * (rt + l)); g.stroke();
        }
        /* arcs de données, en sens contraires, plus vifs quand JARVIS réfléchit ou parle */
        const arcs = [[1.84, 0.9, -0.35, 3 * dpr, A], [1.84, 0.45, -0.35, 3 * dpr, B], [1.48, 1.4, 0.5, 2 * dpr, A], [2.1, 0.6, 0.22, 1.6 * dpr, B]];
        arcs.forEach(([rf, len, sp, lw, c], n) => {
          const st = t * sp * (1 + think * 1.5) + n * 2.1; g.lineWidth = lw; g.strokeStyle = rgba(c, 0.55 + 0.35 * Math.max(think, talk)); g.lineCap = 'round';
          g.beginPath(); g.arc(cx, cy, R * rf, st, st + len); g.stroke();
          g.beginPath(); g.arc(cx, cy, R * rf, st + Math.PI, st + Math.PI + len * 0.5); g.stroke();
        });
        g.lineCap = 'butt';
        /* balayage radar */
        if (g.createConicGradient) {
          const sw = t * 0.9, cg = g.createConicGradient(sw, cx, cy);
          cg.addColorStop(0, rgba(A, 0.22 + 0.15 * talk)); cg.addColorStop(0.08, rgba(A, 0)); cg.addColorStop(1, rgba(A, 0));
          g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, R * 1.98, 0, Math.PI * 2); g.arc(cx, cy, R * 1.05, 0, Math.PI * 2, true); g.fill();
        }
        /* repères cardinaux */
        [0, 1, 2, 3].forEach((q) => { const an = q * Math.PI / 2 + Math.PI / 4; const x = cx + Math.cos(an) * R * 1.98, y = cy + Math.sin(an) * R * 1.98; g.fillStyle = rgba(A, 0.9); g.beginPath(); g.arc(x, y, 2.6 * dpr, 0, Math.PI * 2); g.fill(); g.fillStyle = rgba(A, 0.2); g.beginPath(); g.arc(x, y, 7 * dpr, 0, Math.PI * 2); g.fill(); });
        /* poussière de lumière en orbite */
        DUST.forEach((d) => { const an = d.a + t * d.s * (1 + think); const rr = R * d.r * (1 + 0.02 * Math.sin(t + d.a)); const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.92; const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + d.a * 3)); g.fillStyle = rgba(d.z > 0.5 ? A : B, tw * 0.8); g.beginPath(); g.arc(x, y, (0.8 + d.z * 1.4) * dpr, 0, Math.PI * 2); g.fill(); });
      }
      /* socle */
      if (ped) {
        const py = cy + R * 1.42, pr = R * 1.55;
        gr = g.createLinearGradient(0, cy, 0, py); gr.addColorStop(0, rgba(A, 0)); gr.addColorStop(1, rgba(A, 0.16 + live * 0.1));
        g.fillStyle = gr; g.beginPath(); g.moveTo(cx - R * 0.55, cy + R * 0.6); g.lineTo(cx + R * 0.55, cy + R * 0.6); g.lineTo(cx + pr * 0.62, py); g.lineTo(cx - pr * 0.62, py); g.closePath(); g.fill();
        g.save(); g.translate(cx, py); g.scale(1, 0.24);
        gr = g.createRadialGradient(0, 0, 0, 0, 0, pr * 1.1); gr.addColorStop(0, rgba(A, 0.35)); gr.addColorStop(0.6, rgba(B, 0.12)); gr.addColorStop(1, rgba(B, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, pr * 1.1, 0, Math.PI * 2); g.fill(); g.restore();
        [1, 0.78, 0.56, 0.34].forEach((f, i) => { g.lineWidth = (i === 0 ? 2 : 1.3) * dpr; g.strokeStyle = rgba(i % 2 ? B : A, 0.75 - i * 0.12); g.beginPath(); g.ellipse(cx, py, pr * f, pr * f * 0.24, 0, 0, Math.PI * 2); g.stroke(); });
        const ph = (t * 0.6) % 1, pf = 0.34 + ph * 0.8; g.lineWidth = 1.5 * dpr; g.strokeStyle = rgba(A, 0.5 * (1 - ph));
        g.beginPath(); g.ellipse(cx, py, pr * pf, pr * pf * 0.24, 0, 0, Math.PI * 2); g.stroke();
      }
      /* orbite, moitié arrière */
      const tilt = -0.32, orx = R * 1.5, ory = R * 0.36;
      const orbit = (from, to, a) => { g.save(); g.translate(cx, cy); g.rotate(tilt); g.lineWidth = 1.4 * dpr; g.strokeStyle = rgba(A, a); g.beginPath(); g.ellipse(0, 0, orx, ory, 0, from, to); g.stroke(); g.restore(); };
      if (ring) orbit(Math.PI, Math.PI * 2, 0.22);
      /* parle : couronne d'ondes autour du globe */
      if (voiceRing && talk > 0.02) {
        const n = 72;
        for (let i = 0; i < n; i++) {
          const an = (i / n) * Math.PI * 2 + t * 0.25, env = voice(t * 1.6 + i * 0.09) * (0.55 + 0.45 * Math.sin(i * 0.7 + t * 5));
          const r0 = R * 1.12, r1 = r0 + R * (0.06 + 0.32 * env) * talk;
          g.lineWidth = 2 * dpr; g.strokeStyle = rgba(i % 2 ? A : B, (0.25 + 0.55 * env) * talk);
          g.beginPath(); g.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); g.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); g.stroke();
        }
      }
      /* corps de verre */
      gr = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
      gr.addColorStop(0, rgba(B, 0.05)); gr.addColorStop(0.75, rgba(A, 0.08)); gr.addColorStop(1, rgba(A, 0.32 + live * 0.15));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      g.lineWidth = 1.2 * dpr; g.strokeStyle = rgba(A, 0.55); g.stroke();
      /* réseau en rotation, avec perspective */
      const ay = t * 0.32, ax = 0.38 + 0.06 * Math.sin(t * 0.4), ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
      const S = P.map(([x, y, z]) => { const x1 = ca * x + sa * z, z1 = -sa * x + ca * z; const y2 = cb * y - sb * z1, z2 = sb * y + cb * z1; const f = 2.6 / (2.6 - z2); return [cx + x1 * R * f * 0.94, cy + y2 * R * f * 0.94, z2]; });
      for (let pass = 0; pass < 2; pass++) {
        g.beginPath();
        for (const [i, j] of E) { const zm = (S[i][2] + S[j][2]) / 2; if ((zm > 0) !== (pass === 1)) continue; g.moveTo(S[i][0], S[i][1]); g.lineTo(S[j][0], S[j][1]); }
        g.lineWidth = (pass ? 1.1 : 0.8) * dpr; g.strokeStyle = rgba(pass ? A : B, pass ? 0.5 + live * 0.2 + think * 0.15 : 0.16); g.stroke();
      }
      /* réfléchit : des paquets de lumière courent sur le réseau */
      if (think > 0.02) {
        PK.forEach((q) => {
          q.u += dt * 2.2; if (q.u >= 1) { q.u = 0; const [, j] = E[q.e]; const nx = E.findIndex(([a, b], n) => n !== q.e && (a === j || b === j) && Math.random() > 0.3); q.e = nx >= 0 ? nx : (q.e * 13 + 7) % E.length; }
          const [i, j] = E[q.e], a = S[i], b = S[j]; if ((a[2] + b[2]) / 2 < -0.1) return;
          const x = a[0] + (b[0] - a[0]) * q.u, y = a[1] + (b[1] - a[1]) * q.u;
          const pg = g.createRadialGradient(x, y, 0, x, y, 6 * dpr); pg.addColorStop(0, rgba([245, 235, 255], 0.95 * think)); pg.addColorStop(1, rgba(A, 0));
          g.fillStyle = pg; g.beginPath(); g.arc(x, y, 6 * dpr, 0, Math.PI * 2); g.fill();
        });
      }
      /* rayons du cœur */
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
      /* cœur : bat avec la voix */
      const cr = R * (0.3 + live * 0.16 + 0.03 * Math.sin(t * 2));
      gr = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      gr.addColorStop(0, 'rgba(240,250,255,.95)'); gr.addColorStop(0.25, rgba(A, 0.65)); gr.addColorStop(1, rgba(B, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
      /* orbite, moitié avant, et son étincelle */
      if (ring) {
        orbit(0, Math.PI, 0.55);
        const u = t * 0.9, ex = Math.cos(u) * orx, ey = Math.sin(u) * ory, rx = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), ry = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        if (Math.sin(u) > 0 || Math.hypot(rx - cx, ry - cy) > R) { gr = g.createRadialGradient(rx, ry, 0, rx, ry, 7 * dpr); gr.addColorStop(0, 'rgba(240,250,255,1)'); gr.addColorStop(1, rgba(A, 0)); g.fillStyle = gr; g.beginPath(); g.arc(rx, ry, 7 * dpr, 0, Math.PI * 2); g.fill(); }
      }
      /* écoute : ondes qui partent du globe */
      if (state === 'listening') for (let n = 0; n < 3; n++) { const ph = (t * 0.7 + n / 3) % 1; g.lineWidth = 1.4 * dpr; g.strokeStyle = rgba(A, 0.4 * (1 - ph)); g.beginPath(); g.arc(cx, cy, R * (1.02 + ph * 0.55), 0, Math.PI * 2); g.stroke(); }
      g.globalCompositeOperation = 'source-over';
    };
    requestAnimationFrame(draw);
    return api;
  }
  window.UXGlobe = {create};
})();
