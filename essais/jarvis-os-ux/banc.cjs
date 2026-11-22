/* Banc de la maquette UX de JARVIS OS (21/11/2026), en émulation iPhone 15 Pro Max, avec de vrais gestes tactiles.
   Lancer : NODE_PATH=/opt/node-tools/node_modules node essais/jarvis-os-ux/banc.cjs   (Playwright requis)
   Captures dans le dossier temporaire du système (jarvis-os-ux). Sortie : une ligne OK/ÉCHEC par vérification. */
const {chromium, devices} = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..'), SH = path.join(os.tmpdir(), 'jarvis-os-ux'); fs.mkdirSync(SH, {recursive: true});
const TYPES = {'.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg'};
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); r.end(d); }); });
const out = []; let fails = 0; const ok = (n, c, i) => { out.push((c ? 'OK    ' : 'ÉCHEC ') + n + (i ? ' :: ' + i : '')); if (!c) fails++; };
srv.listen(0, async () => {
  const base = 'http://127.0.0.1:' + srv.address().port + '/jarvis-os-ux/';
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({...devices['iPhone 15 Pro Max']});
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts|net::ERR/.test(m.text())) errs.push(m.text()); });
  const cdp = await ctx.newCDPSession(p);
  const tt = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: /End|Cancel/.test(type) ? [] : [{x, y}]});
  const drag = async (x0, y0, x1, y1, n = 8) => { await tt('touchStart', x0, y0); for (let i = 1; i <= n; i++) { await tt('touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(16); } await tt('touchEnd'); await p.waitForTimeout(450); };
  let W = 0;
  const cur = () => p.evaluate(() => { const s = __UX.S; return s.stack[s.tab][s.stack[s.tab].length - 1]; });
  const sheetState = () => p.evaluate(() => __UX.S.sheet || 'fermée');
  const tapSel = async (sel) => { const r = await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({block: 'center'}); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, sel); if (!r) throw new Error('introuvable : ' + sel); await p.touchscreen.tap(r[0], r[1]); await p.waitForTimeout(450); };
  const noOverflow = () => p.evaluate(() => { const w = document.documentElement.clientWidth; const bad = [...document.querySelectorAll('#view *, .bar *, .top *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > w + 1 || r.left < -1); }).map((e) => e.className || e.tagName); return {scroll: document.documentElement.scrollWidth <= w, bad: bad.slice(0, 4)}; });
  const minFont = () => p.evaluate(() => Math.min(...[...document.querySelectorAll('#view *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))));
  try {
    await p.goto(base); await p.waitForTimeout(1200);
    W = await p.evaluate(() => innerWidth);   /* après le chargement : sur une page vide, l'émulation mobile donne 980 px */
    /* navigation : 5 portes, appui seulement */
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.bar .tab')].map((t) => [t.textContent.replace(/\d+$/, '').trim(), Math.round(t.getBoundingClientRect().height), Math.round(t.getBoundingClientRect().width)]));
    ok('barre : 4 onglets (Aujourd’hui, Pour moi, Agenda, Espaces) et l’orbe au centre, cibles de 44 px au moins', tabs.map((t) => t[0]).join(',') === 'Aujourd’hui,Pour moi,Agenda,Espaces' && tabs.every((t) => t[1] >= 44 && t[2] >= 44) && await p.evaluate(() => document.querySelector('.bar-in').children[2].classList.contains('orb-tab')), JSON.stringify(tabs));
    ok('plus de menu « Tout » ni de poignée', await p.evaluate(() => !document.querySelector('.all-sheet, .fav-handle')));
    /* retouches du 21/11 : orbe vivante, personnages, photos */
    const globe = (sel) => p.evaluate((s) => { const c = document.querySelector(s + ' canvas'); if (!c) return null; const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) lit++; return {w: c.width, cw: c.clientWidth, lit, url: c.toDataURL().length}; }, sel);
    const g1 = await globe('.orb-tab'), h1 = await globe('.home-globe'); await p.waitForTimeout(400); const g2 = await globe('.orb-tab');
    ok('orbe de la barre : le globe réseau, dessiné en haute résolution (2 à 3 pixels par point) et animé', g1 && g1.w >= g1.cw * 2 && g1.lit > 50 && g2.url !== g1.url, JSON.stringify([g1, g2 && g2.url]));
    ok('accueil : le globe sur son socle', h1 && h1.lit > 200, JSON.stringify(h1));
    await p.screenshot({path: path.join(SH, '1-aujourdhui.png')});
    const screens = [['auj', 'tab:auj'], ['moi', 'tab:moi'], ['agenda', 'tab:agenda'], ['espaces', 'tab:espaces']];
    for (const [id] of screens) {
      await tapSel('.bar .tab[data-tab="' + id + '"]'); await p.waitForTimeout(300);
      const o = await noOverflow(), f = await minFont();
      ok('écran ' + id + ' : ouvert, sans débordement ni défilement de côté, texte de 11 px au moins', await cur() === id && o.scroll && !o.bad.length && f >= 11, JSON.stringify({o, f}));
    }
    await p.screenshot({path: path.join(SH, '4-espaces.png')});
    ok('Espaces : tuiles Achats, Voyages et Sorties en photo', await p.evaluate(() => ['achats', 'voyages', 'sorties'].every((k) => { const i = document.querySelector('.tile[data-act="go:' + k + '"] img'); return i && i.complete && i.naturalWidth > 300; })));
    /* Espaces : tuiles vivantes, chaque domaine sur le même modèle */
    for (const k of ['argent', 'achats', 'voyages', 'sorties', 'papiers', 'equipe']) {
      await tapSel('.tile[data-act="go:' + k + '"]');
      const o = await noOverflow(), f = await minFont();
      const model = await p.evaluate(() => ({h1: !!document.querySelector('#view h1.lt'), hero: !!document.querySelector('#view .hero'), seg: document.querySelectorAll('#view .seg').length, rows: document.querySelectorAll('#view .row').length, back: !!document.querySelector('#lead .back')}));
      ok('Espaces → ' + k + ' : même modèle (titre, carte phare, un filtre, lignes), retour « ‹ Espaces », sans débordement', await cur() === k && model.h1 && model.hero && model.seg === 1 && model.rows >= 1 && model.back && o.scroll && !o.bad.length && f >= 11, JSON.stringify({model, o, f}));
      if (['achats', 'voyages', 'sorties'].includes(k)) { await p.waitForTimeout(300); ok(k + ' : grande photo, chargée, et des lignes illustrées', await p.evaluate(() => { const i = document.querySelector('#view .hero .photo img'); return i && i.complete && i.naturalWidth >= 600 && [...document.querySelectorAll('#view .list .ph img')].filter((x) => x.naturalWidth > 100).length >= 2; })); }
      if (k === 'achats') { ok('Achats : courbe des prix avec seuil et prix public, et les vendeurs', await p.evaluate(() => /Seuil 400/.test(document.querySelector('.chart').textContent) && /Public 449/.test(document.querySelector('.chart').textContent) && document.querySelectorAll('.vend > div').length === 3)); await p.screenshot({path: path.join(SH, '5-achats.png')}); }
      if (k === 'voyages') ok('Voyages : carte d’embarquement, météo probable, budget et temps forts', await p.evaluate(() => { const t = document.querySelector('#view .hero').textContent; return /PAR/.test(t) && /LIS/.test(t) && /pluie/.test(t) && /Budget/.test(t) && /Temps forts/i.test(t); }));
      if (k === 'equipe') { await p.waitForTimeout(400); ok('Équipe : les personnages des bots (sphère, silhouette) dans la constellation et la liste', await p.evaluate(() => { const c = [...document.querySelectorAll('#view .ava canvas')]; const drawn = c.filter((x) => { const d = x.getContext('2d').getImageData(x.width / 2 - 2, x.height / 2 - 2, 4, 4).data; return d[3] > 0; }); return c.length >= 15 && drawn.length >= 8 && drawn.includes(document.querySelector('.crew .ava.xl canvas')); }));   /* les personnages hors de l'écran ne sont dessinés qu'en y arrivant */ }
      if (k === 'equipe') await p.screenshot({path: path.join(SH, '6-equipe.png')});
      if (k === 'argent') { await drag(4, 400, 240, 410, 10); ok('glisser depuis le bord gauche : retour à Espaces', await cur() === 'espaces'); }
      else { await tapSel('#lead .back'); ok('« ‹ Espaces » : retour', await cur() === 'espaces'); }
    }
    /* filtres d'un domaine */
    await tapSel('.tile[data-act="go:achats"]'); await tapSel('.seg button[data-act="filt:b"]');
    ok('Achats : le filtre « Achetés » montre ses lignes', await p.evaluate(() => /Siège auto/.test(document.getElementById('view').textContent) && !/Casque Nova/.test(document.getElementById('view').textContent)));
    /* second appui sur l'onglet : retour en haut de la rubrique */
    await tapSel('.bar .tab[data-tab="espaces"]'); ok('second appui sur « Espaces » : retour à la racine', await cur() === 'espaces');
    /* Pour moi : une seule boîte, filtres comptés */
    await tapSel('.bar .tab[data-tab="moi"]');
    const segs = await p.evaluate(() => [...document.querySelectorAll('.seg button')].map((b) => b.textContent));
    ok('Pour moi : filtres Tout 12, Décider 5, À faire 4, Infos 3', segs.join('|') === 'Tout12|Décider5|À faire4|Infos3', segs.join('|'));
    await tapSel('.seg button[data-act="filt:decider"]');
    ok('Pour moi : « Décider » ne montre que les 5 décisions', await p.evaluate(() => document.querySelectorAll('#view .list .row').length === 5));
    await tapSel('.seg button[data-act="filt:tout"]');
    await p.screenshot({path: path.join(SH, '2-pour-moi.png')});
    /* une seule couche : la feuille du bas */
    await tapSel('.row[data-act="item:i1"]');
    ok('demande : s’ouvre en demi-feuille, action principale avec son coût, suivi par étapes, autres réponses repliées', await sheetState() === 'half' && await p.evaluate(() => { const s = document.getElementById('sheet'); return /1 passage/.test(s.querySelector('.btn.primary').textContent) && s.querySelectorAll('.track li').length === 4 && !s.querySelector('details.more').open; }));
    await p.screenshot({path: path.join(SH, '3-feuille.png')});
    let top = await p.evaluate(() => document.getElementById('sheet').getBoundingClientRect().top + 14);
    await drag(W / 2, top, W / 2, top - 160, 6);
    ok('feuille : tirée vers le haut, passe en plein écran', await sheetState() === 'full', JSON.stringify(await p.evaluate(() => [document.getElementById('sheet').className, Math.round(document.getElementById('sheet').getBoundingClientRect().top), innerHeight])) + ' départ ' + Math.round(top));
    top = await p.evaluate(() => document.getElementById('sheet').getBoundingClientRect().top + 14);
    await tt('touchStart', W / 2, top); await tt('touchMove', W / 2, top + 60); await tt('touchCancel'); await p.waitForTimeout(400);
    ok('feuille : un glissé interrompu par iOS la remet en place', await sheetState() === 'full' && await p.evaluate(() => !document.getElementById('sheet').style.transform));
    await drag(W / 2, top, W / 2, top + 150, 6);
    ok('feuille : tirée vers le bas depuis le plein écran, revient à moitié', await sheetState() === 'half');
    top = await p.evaluate(() => document.getElementById('sheet').getBoundingClientRect().top + 14);
    await Promise.all([tt('touchStart', W / 2, top), tt('touchMove', W / 2, top + 30), tt('touchMove', W / 2, top + 60), tt('touchMove', W / 2, top + 80), tt('touchEnd')]); await p.waitForTimeout(450);
    ok('feuille : un lancer vif vers le bas la ferme', await sheetState() === 'fermée');
    { const r = await p.evaluate(() => { const e = document.querySelector('.row[data-act="item:i2"]'); e.scrollIntoView({block: 'center'}); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await p.touchscreen.tap(r[0], r[1]); await p.waitForTimeout(150); await p.touchscreen.tap(W / 2, 120); await p.waitForTimeout(150); }
    ok('feuille : un appui impatient sur le fond pendant l’ouverture ne la referme pas', await sheetState() === 'half');
    await p.waitForTimeout(400); await p.touchscreen.tap(W / 2, 120); await p.waitForTimeout(400);
    ok('feuille : un appui sur le fond ensuite la ferme', await sheetState() === 'fermée');
    /* Claude : la même feuille, en plein écran, avec le contexte */
    await tapSel('.orb-tab');
    ok('orbe : Claude dans la même feuille, plein écran, « Tu regardes : Pour moi »', await sheetState() === 'full' && await p.evaluate(() => /Tu regardes : Pour moi/.test(document.getElementById('sheet').textContent)));
    const st = () => p.evaluate(() => [document.querySelector('#sheet .globe').dataset.s, document.querySelector('.orb-tab .globe').dataset.s, document.getElementById('cl-state').textContent]);
    const s0 = await st(); await p.evaluate(() => document.querySelector('.sugs button').click()); await p.waitForTimeout(500); const s1 = await st(); await p.waitForTimeout(1400); const s2 = await st(); await p.waitForTimeout(2500); const s3 = await st();
    ok('le globe de Claude vit : à l’écoute à l’ouverture, réfléchit, puis répond pendant que le texte s’écrit (la barre aussi), puis revient au repos', s0[0] === 'listening' && s1[0] === 'thinking' && s1[1] === 'thinking' && /Réfléchit/.test(s1[2]) && s2[0] === 'speaking' && /Répond/.test(s2[2]) && s3[0] === 'idle', JSON.stringify([s0, s1, s2, s3]));
    ok('Claude : une suggestion envoie la question et la réponse s’écrit', await p.evaluate(() => document.querySelectorAll('.msg.me').length === 1 && document.querySelector('.msg.ai').textContent.length > 40));
    await p.screenshot({path: path.join(SH, '7-claude.png')});
    await tapSel('#sheet .x'); ok('Claude : ✕ ferme', await sheetState() === 'fermée');
    /* recherche partout */
    await tapSel('#find'); await p.fill('#q', 'passeport'); await p.waitForTimeout(200);
    ok('recherche : « passeport » trouve le papier, sans accents ni majuscules', await p.evaluate(() => /Papiers · 1/.test(document.getElementById('q-r').textContent)));
    await p.fill('#q', 'syndic'); await p.waitForTimeout(200); await tapSel('#q-r .row');
    ok('recherche : un résultat de « Pour moi » ouvre sa feuille', await sheetState() === 'half' && await p.evaluate(() => !document.getElementById('search').classList.contains('on')));
    await tapSel('#sheet .x');
    /* la pastille de Grok ouvre Équipe */
    await tapSel('#grok'); ok('pastille « Grok » : ouvre Équipe (sous Espaces)', await cur() === 'equipe' && await p.evaluate(() => __UX.S.tab === 'espaces'));
    await tapSel('.seg button[data-act="filt:cout"]'); ok('Équipe : « Coût » montre les passages de la semaine par bot', await p.evaluate(() => document.querySelectorAll('.bar-l').length === 6));
    await tapSel('button[data-act="help"]'); ok('« ? » : ce qui change, en 6 points', await p.evaluate(() => document.querySelectorAll('#sheet .row').length === 6));
    await tapSel('#sheet .x'); await tapSel('#lead .back'); await tapSel('a[data-act="credits"]');
    ok('crédits : 15 photos avec auteur, licence libre et lien, et les silhouettes', await p.evaluate(() => { const r = [...document.querySelectorAll('#sheet a.row')]; return r.length === 15 && r.every((a) => /^https:/.test(a.href) && /CC|Domaine/.test(a.textContent)) && /game-icons/.test(document.getElementById('sheet').textContent); }));
    await p.screenshot({path: path.join(SH, '8-ce-qui-change.png')});
    ok('aucune erreur de page', !errs.length, errs.join(' | '));
  } catch (e) { ok('déroulé du banc', false, e.message); }
  console.log(out.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications). Captures : ' + SH);
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
});
