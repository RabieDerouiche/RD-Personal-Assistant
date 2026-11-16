const L = require('./lib');
(async () => {
  const file = process.argv[2] || 'v175.html';
  let h = await L.open({file, time: '2026-11-14T22:00:00+01:00'});
  const v = await L.text(h);
  console.log('MAILS:', (v.match(/Reçus après son dernier tour de Gmail[^\n]*/) || ['?'])[0].slice(0, 120), '| fils:', (v.match(/\d+ fils? · boîte principale/) || ['?'])[0]);
  console.log('JOURNAL:', (v.match(/Journal\n[\s\S]{0,260}/) || ['?'])[0].replace(/\n+/g, ' | '));
  console.log('PUCE:', (v.match(/Cette semaine : [\s\S]{0,60}/) || ['?'])[0].replace(/\n+/g, ' '));
  await L.tab(h, 'demandes');
  console.log('OUI:', ((await L.text(h)).match(/Un seul message à Argus[\s\S]{0,200}/) || ['?'])[0].replace(/\n+/g, ' | '));
  await L.tab(h, 'achats');
  console.log('PAUSE:', ((await L.text(h)).match(/Lecteur enfant[\s\S]{0,400}/) || ['?'])[0].split('\n').filter((x) => /pause/i.test(x)).join(' | '));
  console.log('VERDICT:', ((await L.text(h)).match(/Robot Alpha X7 à[^\n]*/) || ['?'])[0].slice(0, 150));
  await L.tab(h, 'agenda');
  console.log('EVENEMENTS:', ((await L.text(h)).match(/Mes événements importants[\s\S]{0,200}/) || ['?'])[0].replace(/\n+/g, ' | '));
  console.log('ERREURS:', h.errors);
  await h.browser.close();
  h = await L.open({file, time: '2026-11-14T22:00:00+01:00', scen: {active: true, bells: true}});
  await L.tab(h, 'achats');
  await h.page.evaluate(() => { const c = Array.from(document.querySelectorAll('#view article')).find((a) => /Robot Alpha X7/.test(a.innerText)); Array.from(c.querySelectorAll('button')).find((b) => /^Vérifier le prix maintenant/.test(b.innerText.trim())).click(); });
  await L.tick(h, 7000);
  await h.page.evaluate(() => { const g = window.__G['Canal']; const r = g[g.length - 1]; r[5] = 'Fait'; r[6] = 'Prix inchangé : 1 449 €.'; });
  let seen = [];
  for (let i = 0; i < 14; i++) { await L.tick(h, 2500); const t = await L.toasts(h); t.forEach((x) => { if (!seen.includes(x)) seen.push(x); }); }
  console.log('REPONSE DU BOT:', seen.map((x) => x.slice(0, 120)), '| en-tête:', await L.text(h, '#demo'));
  console.log('ERREURS:', h.errors);
  await h.browser.close();
})().catch((e) => { console.error('ECHEC', e); process.exit(1); });
