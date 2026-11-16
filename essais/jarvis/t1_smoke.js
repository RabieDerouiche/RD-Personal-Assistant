/* Tour complet : chaque onglet s'affiche, sans erreur ni débordement ; captures d'écran. */
const L = require('./lib');
const path = require('path');
(async () => {
  const file = process.argv[2] || 'jarvis.html', shots = process.argv[3] === 'shots';
  const h = await L.open({file, time: '2026-11-14T22:00:00+01:00'});
  const out = {};
  out.demo = await L.text(h, '#demo');
  out.status = await L.text(h, '#status');
  for (const t of ['accueil', 'demandes', 'agenda', 'achats', 'voyages', 'sorties', 'suivi', 'equipe']) {
    await L.tab(h, t);
    await L.tick(h, 600);
    const tx = await L.text(h);
    const of = await L.overflow(h);
    out[t] = {len: (tx || '').length, h2: await h.page.evaluate(() => Array.from(document.querySelectorAll('#view .panel-h h2')).map((x) => x.textContent)), of};
    if (shots) await h.page.screenshot({path: path.join(L.DIR, 'shots', file.replace('.html', '') + '-' + t + '.png'), fullPage: false});
  }
  out.toasts = await L.toasts(h);
  out.writes = await L.writes(h);
  out.errors = h.errors;
  console.log(JSON.stringify(out, null, 1));
  await h.browser.close();
})().catch((e) => { console.error('ECHEC', e); process.exit(1); });
