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
    /* agenda plus vivant (16/11/2026) */
    p = await page('#agenda');
    ok('agenda : carte « Aujourd\'hui » (date, présence, événements du jour)', await p.evaluate(() => { const c = document.querySelector('.agt'); return !!c && c.querySelector('.agt-date b').textContent === String(new Date().getDate()) && /Télétravail/.test(c.querySelector('.agt-pr').textContent) && c.querySelectorAll('.agt-row').length >= 2; }));
    ok('agenda : « Maintenant » placé entre les heures du jour', await p.evaluate(() => { const l = [...document.querySelectorAll('.agt-list > *')]; const i = l.findIndex((x) => x.classList.contains('agt-now')); return i >= 0 && l.slice(0, i).every((x) => !x.querySelector('.agt-t.is-day')); }));
    ok('agenda : bande des 7 prochains jours, week-end teinté', await p.evaluate(() => document.querySelectorAll('.agw-d').length === 7 && document.querySelectorAll('.agw-d.is-we').length === 2 && document.querySelectorAll('.agw-dots i').length > 0));
    ok('agenda : légende repliée par défaut', await p.evaluate(() => { const d = document.querySelector('.lg-fold'); return !!d && !d.open && /Légende et filtres/.test(d.querySelector('summary').textContent); }));
    ok('agenda : grille en couleurs vives, aujourd\'hui en dégradé', await p.evaluate(() => { const dark = ['#0f766e', '#6d28d9', '#be185d', '#1d4ed8', '#b45309', '#b91c1c']; const ics = [...document.querySelectorAll('.mgrid .mg-ic[style]')]; const t = document.querySelector('.mgrid .mg-d.is-today'); return ics.length > 0 && ics.every((x) => !dark.some((c) => x.getAttribute('style').includes(c))) && !!t && /gradient/.test(getComputedStyle(t).backgroundImage); }));
    ok('agenda : liste du mois avec une barre de couleur par type', await p.evaluate(() => { const r = [...document.querySelectorAll('.mrow .dl-row')]; return r.length > 0 && r.every((x) => /--kc:/.test(x.getAttribute('style') || '')); }));
    await p.screenshot({path: path.join(SH, 'agenda.png')});
    await p.tap('.agw-d'); await p.waitForTimeout(700);
    ok('agenda : un appui sur un jour de la bande ouvre ce jour', await p.evaluate(() => { const s = document.getElementById('sheet'); const d = new Date(); d.setDate(d.getDate() + 1); return !!s && !s.hidden && s.textContent.includes(d.toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'})) && /Télétravail/.test(s.textContent); }));
    await p.evaluate(() => { if (typeof closeSheet === 'function') closeSheet(true); });
    p = await page('#agenda');
    await p.evaluate(() => { document.querySelector('.lg-fold summary').click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.lg-chip').click()); await p.waitForTimeout(500);
    ok('agenda : un filtre garde la légende ouverte et s\'affiche', await p.evaluate(() => { const d = document.querySelector('.lg-fold'); return d.open && !!d.querySelector('.lg-on') && document.querySelectorAll('.mg-d.is-dim').length > 0; }));
    p = await page('#agenda');
    await p.evaluate(() => [...document.querySelectorAll('.seg button')].find((b) => b.textContent === 'Année').click()); await p.waitForTimeout(500);
    ok('agenda : vue Année inchangée (petites cases sans fond)', await p.evaluate(() => { const c = document.querySelector('.mini .mg-d:not(.is-today):not(.has)'); return !!c && getComputedStyle(c).backgroundImage === 'none' && parseFloat(getComputedStyle(c).minHeight || '0') === 0; }));
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
    /* équipe harmonisée (16/11/2026) */
    ok('équipe : une seule grille de 6 cartes identiques, plus de doublon « En ce moment »', await p.evaluate(() => { const m = [...document.querySelectorAll('.team .mate')]; return m.length === 6 && m.every((x) => x.querySelector('.mate-log span') && /^Prochain · /.test(x.querySelector('.mate-next small').textContent)) && ![...document.querySelectorAll('.panel-h h2')].some((x) => x.textContent === 'En ce moment'); }));
    ok('équipe : texte en Exo 2, plus de police machine à écrire', await p.evaluate(() => /Exo 2/.test(getComputedStyle(document.querySelector('.mate-log')).fontFamily) && /Oxanium/.test(getComputedStyle(document.querySelector('.mate b')).fontFamily)));
    ok('équipe : l\'ambre ne remplit plus les cartes', await p.evaluate(() => { const d = document.querySelector('.mate[data-mode="demande"]'); return !!d && !/251, 191, 36, 0\.12/.test(getComputedStyle(d).backgroundImage); }));
    ok('équipe : « Te demande » une seule fois par carte', await p.evaluate(() => [...document.querySelectorAll('.mate[data-mode="demande"]')].every((x) => !/^Te demande/.test(x.querySelector('.mate-log span').textContent))));
    ok('équipe : tes ordres en lignes, pastilles de chiffres sans débordement', await p.evaluate(() => { const st = document.querySelector('.stats'); const t = [...document.querySelectorAll('.panel')].find((x) => /Tes ordres/.test(x.textContent)); return !!t && t.querySelectorAll('.canal-row').length > 0 && !/\[object/.test(t.textContent) && !!st && st.scrollWidth <= st.clientWidth + 1; }));
    await p.screenshot({path: path.join(SH, 'equipe.png')});
    await p.evaluate(() => [...document.querySelectorAll('.panel')].find((x) => /Tes ordres/.test(x.textContent)).querySelector('.canal-row').click()); await p.waitForTimeout(700);
    ok('équipe : un ordre s\'ouvre avec ses gestes', await p.evaluate(() => { const s = document.getElementById('sheet'); return !!s && !s.hidden && /Relancer|Merci/.test(s.textContent); }));
    /* papiers lus dans le Drive (16/11/2026) */
    p = await page('#papiers');
    ok('papiers : tuiles par personne et par thème, lues dans le Drive', await p.evaluate(() => { const h = [...document.querySelectorAll('.hm-h h2')].map((x) => x.textContent); return h.includes('Par personne') && h.includes('Par thème') && document.querySelectorAll('.pt').length >= 8 && /\d+ documents/.test(document.querySelector('.pap-n').textContent); }));
    ok('papiers : papiers privés masqués par défaut', await p.evaluate(() => ![...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === 'Papiers privés') && /Afficher les papiers privés/.test(document.querySelector('.pap-priv').textContent)));
    await p.fill('.pap-search', 'passeport'); await p.waitForTimeout(300);
    ok('papiers : recherche instantanée avec le chemin du dossier', await p.evaluate(() => { const r = [...document.querySelectorAll('.pap-res .pf')]; return r.length >= 3 && r.every((x) => /passeport/i.test(x.textContent)) && r.some((x) => / › /.test(x.textContent)) && r.every((x) => /^https:\/\/drive\.google\.com\//.test(x.href)); }));
    await p.fill('.pap-search', ''); await p.waitForTimeout(200);
    await p.evaluate(() => [...document.querySelectorAll('.pt')].find((b) => /Logement/.test(b.textContent)).click()); await p.waitForTimeout(500);
    ok('papiers : un dossier montre ses sous-dossiers en sections', await p.evaluate(() => document.querySelectorAll('.pap-sec').length >= 3 && /Logement/.test(document.querySelector('.pap-h').textContent) && !/\[object/.test(document.getElementById('view').innerText)));
    await p.screenshot({path: path.join(SH, 'papiers.png')});
    p = await page('#papiers');
    await p.evaluate(() => document.querySelector('.pap-priv').click()); await p.waitForTimeout(800);
    ok('papiers : papiers privés affichés à la demande (gardé dans le téléphone)', await p.evaluate(() => [...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === 'Papiers privés') && localStorage.getItem('jarvis.papiers.prive') === '1'));
    ok('papiers : dates de validité de Pilotage gardées', await p.evaluate(() => !!document.querySelector('.pap-dates') && document.querySelectorAll('.pap-dates .pap').length > 0));
    /* aucune rubrique n'affiche de texte cassé */
    const broken = [];
    for (const t of ['accueil', 'demandes', 'agenda', 'suivi', 'achats', 'voyages', 'sorties', 'papiers', 'equipe', 'automatisations', 'reglages']) {
      p = await page('#' + t);
      if (await p.evaluate(() => /\[object \w+\]|\bundefined\b|\bNaN\b/.test(document.getElementById('view').innerText))) broken.push(t);
    }
    ok('aucune rubrique n\'affiche « [object …] », « undefined » ou « NaN »', !broken.length, broken.join(', '));
    p = await page('#reglages');
    ok('réglages en maquette : explication', await p.evaluate(() => /Maquette/.test(document.querySelector('.view-in').textContent)));
    p = await page('#automatisations');
    ok('automatisations : frise', await p.evaluate(() => document.querySelectorAll('.track').length > 0));
  } catch (e) { ok('exception', false, e.stack); }
  ok('aucune erreur de page', !errs.length, errs.join(' | '));
  console.log(out.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications). Captures : ' + SH);
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
});
