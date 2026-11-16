/* Affiche le texte d'un onglet, pour lire ce que la page montre vraiment. */
const L = require('./lib');
(async () => {
  const file = process.argv[2] || 'jarvis.html', tabs = (process.argv[3] || 'demandes').split(','), scen = process.argv[4] ? JSON.parse(process.argv[4]) : {};
  const h = await L.open({file, time: process.argv[5] || '2026-11-14T22:00:00+01:00', scen});
  console.log('ENTETE:', await L.text(h, '#demo'), '||', (await L.text(h, '#status')).replace(/\n/g, ' · '));
  for (const t of tabs) { await L.tab(h, t); await L.tick(h, 500); console.log('\n===== ' + t + ' =====\n' + (await L.text(h)).replace(/\n{2,}/g, '\n')); }
  console.log('\nTOASTS:', await L.toasts(h), '\nERREURS:', h.errors, '\nECRITURES:', JSON.stringify(await L.writes(h)));
  await h.browser.close();
})().catch((e) => { console.error('ECHEC', e); process.exit(1); });
