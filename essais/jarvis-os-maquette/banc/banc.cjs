/* Banc de la nouvelle app JARVIS OS (mode maquette, données d'exemple), en émulation iPhone 15 Pro Max.
   Lancer : NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-maquette/banc/banc.cjs   (Playwright requis)
   Captures dans le dossier temporaire du système (jarvis-os-banc). Sortie : une ligne OK/ÉCHEC par vérification. */
const {chromium, devices} = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..'), SH = path.join(os.tmpdir(), 'jarvis-os-banc'); fs.mkdirSync(SH, {recursive: true});
const TYPES = {'.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.css': 'text/css'};
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); r.end(d); }); });
const out = []; let fails = 0; const ok = (n, c, i) => { out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (i ? ' :: ' + i : '')); if (!c) fails++; };
srv.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const b = await chromium.launch(); const errs = [];
  const page = async (url) => { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(url + ' : ' + e.message)); await p.goto(base + url); await p.waitForTimeout(3500); return p; };
  try {
    /* accueil et thème */
    let p = await page('');
    ok('mode maquette sur un serveur local', await p.evaluate(() => window.__JARVIS_MODE === 'maquette'));
    ok('thème Hologramme par défaut', await p.evaluate(() => document.documentElement.classList.contains('theme-holo')));
    ok('accueil « Fil du jour » : à faire, aujourd\'hui, semaine, bientôt', await p.evaluate(() => ['À faire maintenant', "Aujourd'hui", 'Cette semaine', 'Bientôt'].every((t) => [...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === t))));
    ok('pastille « Grok en pause »', await p.evaluate(() => !!document.querySelector('.pause-pill')));
    await p.screenshot({path: path.join(SH, 'accueil.png')});
    /* barre du bas et toutes les rubriques */
    const bar = await p.evaluate(() => [...document.querySelectorAll('.fav-row .tab')].map((t) => t.dataset.tab));
    ok('Accueil et « Pour moi » dans les favoris par défaut', bar[0] === 'accueil' && bar[1] === 'demandes' && await p.evaluate(() => document.querySelector('.fav-row .tab[data-tab="demandes"]').textContent.includes('Pour moi')));
    ok('barre : 4 favoris et l\'orbe au centre', bar.length === 4 && await p.evaluate(() => !!document.querySelector('.talk-slot .jv-btn')), bar.join(','));
    await p.tap('.fav-handle'); await p.waitForTimeout(500);
    ok('« Tout » : toutes les rubriques', await p.evaluate(() => document.querySelectorAll('.all-grid .tab').length >= 11));
    await p.screenshot({path: path.join(SH, 'tout.png')});
    await p.tap('.all-grid .tab[data-tab="papiers"]'); await p.waitForTimeout(600);
    ok('rubrique ouverte depuis « Tout »', await p.evaluate(() => document.querySelector('.all-sheet').hidden && /papiers/i.test(document.getElementById('view-title').textContent)));
    /* page vocale */
    await p.tap('.talk-slot .jv-btn'); await p.waitForTimeout(1000);
    await p.evaluate(() => { const c = document.querySelector('.jv-comp'); if (c) c.hidden = false; });
    await p.fill('.jv-comp input', 'Bonjour'); await p.tap('.jv-comp button'); await p.waitForTimeout(1200);
    ok('page vocale : l\'échange reste à l\'écran', await p.evaluate(() => document.querySelectorAll('.jv-turn').length === 1 && /Bonjour/.test(document.querySelector('.jv-q').textContent)));
    await p.tap('.jv-x');
    /* achats */
    p = await page('#achats');
    ok('achats : mini-courbes, « Suivre un produit », « Ne plus suivre »', await p.evaluate(() => document.querySelectorAll('.pc').length > 0 && !!document.querySelector('.shop-add') && document.querySelectorAll('.fam-stop .btn').length > 0));
    await p.tap('.fam.is-big .fam-hit'); await p.waitForTimeout(800);
    ok('fiche achat : courbe complète avec seuils', await p.evaluate(() => !!document.querySelector('.pc.is-big') && document.querySelectorAll('.pc-lab').length >= 2));
    /* voyages, sorties */
    p = await page('#voyages');
    ok('voyages : carte d\'embarquement', await p.evaluate(() => document.querySelectorAll('.vp-codes').length > 0));
    p = await page('#sorties');
    ok('sorties : tuiles de date', await p.evaluate(() => document.querySelectorAll('.sor-date').length > 0));
    /* suivi, demandes, équipe : rien de perdu de l'ancien accueil */
    p = await page('#suivi');
    ok('suivi : en cours chez tes bots, avec étapes', await p.evaluate(() => !!document.querySelector('.pend-x .track')));
    p = await page('#demandes');
    ok('demandes : réponses reçues et courrier arrivé', await p.evaluate(() => [...document.querySelectorAll('.panel-h h2')].filter((x) => /Réponses reçues|Arrivés depuis/.test(x.textContent)).length === 2));
    p = await page('#equipe');
    ok('équipe : journal', await p.evaluate(() => [...document.querySelectorAll('.panel-h h2')].some((x) => /^Journal/.test(x.textContent))));
    p = await page('#reglages');
    ok('réglages en maquette : explication', await p.evaluate(() => /Maquette/.test(document.querySelector('.view-in').textContent)));
    p = await page('#automatisations');
    ok('automatisations : frise', await p.evaluate(() => document.querySelectorAll('.track').length > 0));
  } catch (e) { ok('exception', false, e.stack); }
  ok('aucune erreur de page', !errs.length, errs.join(' | '));
  console.log(out.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications). Captures : ' + SH);
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
});
