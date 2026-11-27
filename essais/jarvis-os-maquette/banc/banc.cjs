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
  /* 17/11/2026 : la pause de Grok de la maquette se déduisait d'une activité « d'hier » ; du mardi 12h47 au mercredi, elle était donc « finie »
     et la sonnette automatique de reprise masquait des boutons. Le banc pose une pause explicite (onglet Faits), la même quel que soit le jour. */
  const PAUSE_INIT = () => { let v; const d = new Date(Date.now() + 2 * 864e5), p2 = (n) => String(n).padStart(2, '0'); const until = p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' 12h47';
    Object.defineProperty(window, '__SCEN', {configurable: true, get: () => v, set: (x) => { v = Object.assign({pauseUntil: until}, x || {}); }}); };
  /* une page avec un scénario de la maquette en plus (micro, voix) */
  const pageWith = async (scen, url) => { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT); await ctx.addInitScript((sc) => { const d = Object.getOwnPropertyDescriptor(window, '__SCEN'); Object.defineProperty(window, '__SCEN', {configurable: true, get: d.get, set: (x) => d.set.call(window, Object.assign({}, sc, x || {}))}); }, scen); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(url + ' : ' + e.message)); await p.goto(base + url); await p.waitForTimeout(3500); return p; };
  const page = async (url) => { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(url + ' : ' + e.message)); await p.goto(base + url); await p.waitForTimeout(3500); return p; };
  /* 0.87.0 : Achats en un seul filtre ; « Trouver une idée » et « Mes recherches » sont sous « Idées » */
  const versIdees = async (q) => { await q.evaluate(() => { const x = document.querySelector('#view .dm-seg [data-f="idees"]'); if (x) x.click(); }); await q.waitForTimeout(400); };
  try {
    /* service worker (0.12.0) : notification reçue, pastille, appui qui ouvre la bonne rubrique ; exécuté hors navigateur avec un faux « self » */
    { const vm = require('vm'), H = {}, shown = [], badges = [], opened = [], waits = [];
      const self = {addEventListener: (t, f) => { H[t] = f; }, registration: {scope: 'https://jarvis.essai/', showNotification: (t, o) => { shown.push([t, o]); return Promise.resolve(); }},
        navigator: {setAppBadge: (n) => { badges.push(n); return Promise.resolve(); }, clearAppBadge: () => { badges.push(0); return Promise.resolve(); }},
        clients: {matchAll: () => Promise.resolve([]), openWindow: (u) => { opened.push(u); return Promise.resolve(); }, claim: () => Promise.resolve()}, skipWaiting: () => Promise.resolve()};
      vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), {self, caches: {open: () => Promise.resolve({add: () => Promise.resolve()}), keys: () => Promise.resolve([])}, fetch: () => Promise.reject(new Error('x')), URL, Promise});
      H.push({data: {json: () => ({web_push: 8030, notification: {title: 'Iris a répondu', body: 'Prix relevés', navigate: '/#demandes', app_badge: '2', tag: 'canal'}})}, waitUntil: (p) => waits.push(p)});
      await Promise.all(waits);
      H.notificationclick({notification: {close: () => {}, data: shown[0] && shown[0][1].data}, waitUntil: (p) => waits.push(p)}); await Promise.all(waits);
      ok('service worker : notification affichée, pastille à 2, un appui ouvre « Pour moi »', shown.length === 1 && shown[0][0] === 'Iris a répondu' && shown[0][1].body === 'Prix relevés' && badges[0] === 2 && opened[0] === 'https://jarvis.essai/#demandes', JSON.stringify({shown, badges, opened})); }
      /* 0.27.0 (comme Panier) : jamais de relève pendant un chargement (pas de skipWaiting à l'installation), seulement quand l'app est à
         l'arrière-plan (message « active ») ; une erreur 5xx du serveur qui redémarre retombe sur la copie gardée */
      { let skips = 0; const vm = require('vm'), H2 = {}, gardes = {'https://jarvis.essai/index.html': {ok: true, status: 200, copie: true}};
        const self2 = {addEventListener: (t, f) => { H2[t] = f; }, registration: {scope: 'https://jarvis.essai/'}, clients: {claim: () => Promise.resolve()}, skipWaiting: () => { skips++; return Promise.resolve(); }};
        const cachesF = {open: () => Promise.resolve({add: () => Promise.resolve(), put: () => Promise.resolve()}), keys: () => Promise.resolve([]), match: (r) => Promise.resolve(gardes[typeof r === 'string' ? 'https://jarvis.essai/index.html' : r.url] || null)};
        let rep = {ok: false, status: 502}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), {self: self2, caches: cachesF, fetch: () => Promise.resolve(rep), URL, Promise, location: {origin: 'https://jarvis.essai'}});
        const w2 = []; H2.install({waitUntil: (p) => w2.push(p)}); await Promise.all(w2); const apresInstall = skips;
        H2.message({data: {type: 'autre'}}); const apresAutre = skips; H2.message({data: {type: 'active'}});
        let rendu = null; H2.fetch({request: {method: 'GET', url: 'https://jarvis.essai/index.html', mode: 'navigate', clone: () => ({})}, respondWith: (p) => { rendu = p; }}); const r502 = await rendu;
        rep = {ok: false, status: 404}; H2.fetch({request: {method: 'GET', url: 'https://jarvis.essai/index.html', mode: 'navigate'}, respondWith: (p) => { rendu = p; }}); const r404 = await rendu;
        ok('service worker : pas de relève pendant un chargement (seulement sur « active », à l\'arrière-plan) ; un serveur qui redémarre (502) rend la copie gardée, pas une page d\'erreur', apresInstall === 0 && apresAutre === 0 && skips === 1 && r502 && r502.copie === true && r404.status === 404, JSON.stringify({apresInstall, apresAutre, skips, r502, r404})); }
    /* accueil et thème */
    let p = await page('');
    ok('mode maquette sur un serveur local', await p.evaluate(() => window.__JARVIS_MODE === 'maquette'));
    ok('thème Hologramme par défaut', await p.evaluate(() => document.documentElement.classList.contains('theme-holo')));
    ok('nom : J.A.R.V.I.S OS (titre de la page, nom à l\'installation, manifeste) ; plus de « Jarvis v17 copie » à l\'écran', await p.evaluate(async () => document.title === 'J.A.R.V.I.S OS' && (document.querySelector('meta[name="apple-mobile-web-app-title"]') || {}).content === 'J.A.R.V.I.S OS' && (await fetch('manifest.webmanifest').then((r) => r.json())).name === 'J.A.R.V.I.S OS' && !/v17 copie/i.test(document.body.innerText)));
    /* refonte UX (22/11/2026) : l'accueil s'ouvre sur l'écran de JARVIS (heure, globe et ses anneaux, 4 relevés reliés, phrase du jour) ; « pour toi » y est ; mails et bons prix restent en chiffres */
    ok('accueil : écran de JARVIS (heure, globe, 4 relevés reliés au globe, phrase du jour ; 0.87.0 : plus de bouton « Parler à JARVIS », l’orbe suffit), puis en un coup d’œil (mails, bons prix), à faire, aujourd\'hui, 14 prochains jours, à surveiller', await p.evaluate(() => !!document.querySelector('.hud .holo-stage canvas') && document.querySelectorAll('.hud .hud-ro').length === 4 && document.querySelectorAll('.hud-lines path').length === 4 && /^\d\d:\d\d\d\d$/.test(document.getElementById('hud-clock').textContent) && /Rabie\./.test(document.querySelector('.hud-say').textContent) && !document.querySelector('.hud-act') && ![...document.querySelectorAll('#view button')].some((x) => /Parler à JARVIS/.test(x.textContent)) && ['En un coup d’œil', 'À faire maintenant', "Aujourd'hui", 'Les 14 prochains jours', 'À surveiller'].every((t) => [...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === t)) && document.querySelectorAll('.kpi-t').length === 2 && !document.querySelector('#view .intent') && !document.querySelector('.hm-hello')));
    ok('accueil : la météo dans son relevé ; « Pour toi » compte comme l\'en-tête et ouvre Pour moi', await p.evaluate(() => /\d+°/.test(document.querySelector('.hud-ro.q-tr').textContent) && document.querySelector('.hud-ro.q-bl b').textContent.startsWith(String(document.querySelector('#status .st.is-demande b') ? document.querySelector('#status .st.is-demande b').textContent : document.querySelector('.tab[data-tab="demandes"] .badge').textContent))));
    { await p.evaluate(() => document.querySelector('.hud-ro.q-bl').click()); await p.waitForTimeout(500); const tab = await p.evaluate(() => location.hash); await p.goto(base + '#accueil'); await p.waitForTimeout(1500); ok('accueil : le relevé « Pour toi » ouvre Pour moi', tab === '#demandes', tab); }
    { await p.evaluate(() => [...document.querySelectorAll('.kpi-t')].find((x) => /bons? prix/.test(x.textContent)).click()); await p.waitForTimeout(500); const tab = await p.evaluate(() => location.hash); await p.goto(base + '#accueil'); await p.waitForTimeout(1500); ok('accueil : la tuile « bon prix » ouvre Achats', tab === '#achats', tab); }
    /* 0.25.0 : en-tête sur une ligne, la pause dite une fois (la pastille de l'en-tête, qui ouvre le détail) */
    ok('en-tête sur une ligne : JARVIS, l\'état, la loupe et la mise à jour à la même hauteur ; plus d\'horloge ni de « 0 au travail », « en veille »', await p.evaluate(() => { const y = (e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; }, a = y(document.querySelector('.brand b')), b = y(document.getElementById('status')), c = y(document.getElementById('gs-btn')), d = y(document.querySelector('.refresh-btn'));
      const hid = (id) => getComputedStyle(document.getElementById(id)).display === 'none'; return Math.max(a, b, c, d) - Math.min(a, b, c, d) < 12 && hid('clock') && hid('today') && !document.querySelector('#status .st.is-veille') && ![...document.querySelectorAll('#status .st.is-travail')].some((x) => /^0\b/.test(x.textContent.trim())) && document.querySelector('.top').getBoundingClientRect().height < 62; }),
      JSON.stringify(await p.evaluate(() => [document.querySelector('.top').getBoundingClientRect().height, [...document.querySelectorAll('#status .st')].map((x) => x.textContent)])));
    ok('pause de Grok dite une fois : pastille de l\'en-tête seulement (plus de pastille sur l\'accueil)', await p.evaluate(() => !!document.querySelector('#status .st.is-pause') && !document.querySelector('.pause-pill') && !document.querySelector('#dir .pause-b')));
    await p.tap('#status .st.is-pause'); await p.waitForTimeout(500);
    ok('pause de Grok : la pastille de l\'en-tête ouvre le détail (file d\'attente, date de reprise, « Grok est reparti »)', await p.evaluate(() => { const s = document.getElementById('sheet'); return !s.hidden && /La pause de Grok/.test(s.textContent) && /Grok est reparti/.test(s.textContent) && /file d'attente/.test(s.textContent); }));
    await p.evaluate(() => [...document.querySelectorAll('#sheet button')].find((x) => /^Fermer$/.test(x.textContent.trim())).click()); await p.waitForTimeout(400);
    ok('accueil : un rendez-vous écrit dans l\'agenda et dans Échéances n\'apparaît qu\'une fois dans « Les 14 prochains jours »', await p.evaluate(() => { const h2 = [...document.querySelectorAll('.hm-h h2')].find((x) => /14 prochains/.test(x.textContent)); return [...h2.closest('section').querySelectorAll('.hm-row')].filter((r) => /notaire/i.test(r.textContent)).length === 1; }));
    await p.screenshot({path: path.join(SH, 'accueil.png')});
    /* refonte UX (22/11/2026, maquette validée) : 5 portes fixes ; plus de favoris ni de « Tout » ; Espaces mène aux domaines, « ‹ Espaces » et le bord gauche en reviennent */
    const bar = await p.evaluate(() => [...document.querySelectorAll('.fav-row .tab')].map((t) => t.dataset.tab));
    ok('barre : Aujourd’hui, Pour moi, l’orbe, Agenda, Espaces ; plus de poignée « Tout » ni de favoris', bar.join(',') === 'accueil,demandes,agenda,espaces' && await p.evaluate(() => !!document.querySelector('.fav-row > .talk-slot .jv-btn') && document.querySelector('.fav-row').children[3].classList.contains('talk-slot') && !document.querySelector('.fav-handle, .all-sheet') && /Aujourd’hui/.test(document.querySelector('.tab[data-tab="accueil"]').textContent)), bar.join(','));
    await p.tap('.tab[data-tab="espaces"]'); await p.waitForTimeout(600);
    ok('Espaces : une tuile vivante par domaine (Argent, Achats, Voyages, Sorties, Papiers, Équipe) et Réglages', await p.evaluate(() => location.hash === '#espaces' && ['argent', 'achats', 'voyages', 'sorties', 'papiers', 'equipe'].every((k) => document.querySelector('.esp-tile[data-go="' + k + '"] .esp-v')) && !!document.querySelector('.esp-row[data-go="reglages"]') && /\d/.test(document.querySelector('.esp-tile[data-go="argent"] .esp-v').textContent)));
    await p.screenshot({path: path.join(SH, 'espaces.png')});
    await p.tap('.esp-tile[data-go="papiers"]'); await p.waitForTimeout(600);
    ok('domaine ouvert depuis Espaces : Espaces reste allumé, « ‹ Espaces » dans l’en-tête', await p.evaluate(() => /papiers/i.test(document.getElementById('view-title').textContent) && document.querySelector('.tab[data-tab="espaces"]').getAttribute('aria-current') === 'page' && !document.getElementById('nav-back').hidden && /Espaces/.test(document.getElementById('nav-back').textContent)));
    { const cdp = await p.context().newCDPSession(p); const tt = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: /End|Cancel/.test(type) ? [] : [{x, y}]});
      await tt('touchStart', 4, 400); for (let i = 1; i <= 8; i++) { await tt('touchMove', 4 + i * 28, 404); await p.waitForTimeout(16); } await tt('touchEnd'); await p.waitForTimeout(600);
      ok('glisser depuis le bord gauche : retour à Espaces', await p.evaluate(() => location.hash === '#espaces'));
      await p.tap('.esp-tile[data-go="achats"]'); await p.waitForTimeout(500); await p.tap('.tab[data-tab="espaces"]'); await p.waitForTimeout(500);
      ok('onglet Espaces touché depuis un domaine : retour à Espaces', await p.evaluate(() => location.hash === '#espaces')); }
    /* l'app fluide (22/11/2026) : l'ancienne page part dans le sens du geste pendant que la nouvelle arrive ; le titre suit ; rien n'en reste ; les chiffres comptent sans valeur fausse */
    { await p.goto(base + '#espaces'); await p.waitForTimeout(2500);
      const probe = () => p.evaluate(() => { const g = document.querySelector('.ux-ghost'); return {g: g ? g.className.replace('ux-ghost ', '') : '', ids: g ? g.querySelectorAll('[id]').length : 0, inn: [...document.querySelector('#view .view-in').classList].filter((c) => /^ux-in-/.test(c)).join(''), t: [...document.getElementById('view-title').classList].filter((c) => /^ux-in-/.test(c)).join('')}; });
      const seq = [];
      for (const [act, want] of [[() => p.evaluate(() => document.querySelector('.esp-tile[data-go="achats"]').click()), 'push'], [() => p.evaluate(() => document.getElementById('nav-back').click()), 'pop'], [() => p.evaluate(() => document.querySelector('.tab[data-tab="demandes"]').click()), 'left'], [() => p.evaluate(() => document.querySelector('.ux-seg [data-f="decider"]').click()), 'fade']]) {
        await act(); await p.waitForTimeout(40); const a = await probe(); await p.waitForTimeout(700); const z = await p.evaluate(() => document.querySelectorAll('.ux-ghost').length); seq.push(want + ':' + a.g + '/' + a.inn + '/' + a.ids + '/' + z); }
      ok('fluidité : entrer, revenir, changer d’onglet, changer de filtre : l’ancienne page part dans le bon sens pendant que la nouvelle arrive, sans identifiant en double, et rien n’en reste', seq.join(' ') === 'push:ux-out-push/ux-in-push/0/0 pop:ux-out-pop/ux-in-pop/0/0 left:ux-out-left/ux-in-left/0/0 fade:ux-out-fade/ux-in-fade/0/0', seq.join(' '));
      await p.evaluate(() => document.querySelector('.tab[data-tab="espaces"]').click()); await p.waitForTimeout(40);
      ok('fluidité : le titre de la page glisse avec elle', /^ux-in-right$/.test((await probe()).t), JSON.stringify(await probe()));
      await p.waitForTimeout(700); await p.evaluate(() => document.querySelector('.tab[data-tab="accueil"]').click());
      const vals = []; for (let i = 0; i < 12; i++) { vals.push(await p.evaluate(() => (document.querySelector('.hud-ro.q-bl b') || {}).textContent || '')); await p.waitForTimeout(80); }
      ok('fluidité : « Pour toi » compte jusqu’à sa valeur, jamais négatif, puis s’arrête sur la vraie valeur', vals.every((x) => !/^-/.test(x)) && vals[vals.length - 1] === vals[vals.length - 2] && /^\d+ décisions?$/.test(vals[vals.length - 1]), vals.join(' | '));
      await p.evaluate(() => document.querySelector('.talk-slot .jv-btn').click()); await p.waitForTimeout(700); await p.evaluate(() => document.querySelector('#chat .chat-head button').click()); await p.waitForTimeout(40);
      const sink = await p.evaluate(() => document.querySelectorAll('.ux-ov-out').length); await p.waitForTimeout(500);
      ok('fluidité : la discussion redescend en s’effaçant, puis disparaît ; le ciel vit derrière', sink === 1 && await p.evaluate(() => !document.querySelector('.ux-ov-out') && document.getElementById('chat').hidden && !!document.querySelector('.ux-sky i'))); }
    /* 0.57.0 : l'effet « waouh » et la vitesse */
    { await p.goto(base + '#espaces'); await p.waitForTimeout(2500);
      await p.tap('.esp-tile[data-go="achats"]'); await p.waitForTimeout(60);
      const z = await p.evaluate(() => { const v = document.querySelector('#view .view-in'); return {cls: [...v.classList].filter((c) => /^ux-in-/.test(c)).join(''), zt: v.style.getPropertyValue('--zt'), g: (document.querySelector('.ux-ghost') || {}).className}; });
      ok('waouh : une tuile touchée s’ouvre en page depuis la tuile (zoom découpé), l’ancienne page recule', z.cls === 'ux-in-zoom' && /px$/.test(z.zt) && /ux-out-zoom/.test(z.g || ''), JSON.stringify(z));
      await p.waitForTimeout(900);
      ok('waouh : lumière sur la page (reflets qui balaient, bord néon tournant sur la carte phare, 3 au plus), cartes inclinables, titre holographique', await p.evaluate(() => document.querySelectorAll('#view .ux-shine').length > 0 && document.querySelectorAll('#view .ux-neon').length >= 1 && document.querySelectorAll('#view .ux-neon').length <= 3 && document.querySelectorAll('#view .ux-tiltable').length > 0 && !!document.querySelector('.ux-floor i')));
      { const el = await p.$('#view .shop-hero'); const bb = await el.boundingBox(); await p.mouse.move(bb.x + bb.width * 0.85, bb.y + bb.height * 0.2); await p.mouse.down(); await p.waitForTimeout(200);
        const tf = await p.evaluate(() => document.querySelector('#view .shop-hero').style.transform); await p.mouse.up(); await p.waitForTimeout(700);
        ok('waouh : la carte s’incline vers le doigt (3D) puis revient', /perspective\(700px\) rotateX\(.+\) rotateY\(.+\)/.test(tf) && await p.evaluate(() => !document.querySelector('#view .shop-hero').style.transform), tf); }
      await p.goto(base); await p.waitForTimeout(2500);
      ok('vitesse : le globe de l’écran de JARVIS en calques que l’affichage fait tourner (pas de redessin), 2 pixels par point au plus', await p.evaluate(() => { const st = document.querySelector('.hud-core .holo-stage'), c = st && st.querySelector(':scope > canvas'); return !!st && st.querySelectorAll('.hl > i').length >= 7 && document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.hud-core .hl')).length >= 5 && c.width <= Math.ceil(st.clientWidth * 2) + 2; }));
      await p.evaluate(() => document.querySelector('.talk-slot .jv-btn').click()); await p.waitForTimeout(80);
      ok('waouh : l’orbe s’ouvre en cercle de lumière sur la discussion', await p.evaluate(() => { const c = document.getElementById('chat'); return !c.hidden && c.classList.contains('ux-circ') && /px$/.test(c.style.getPropertyValue('--ox')); }));
      await p.waitForTimeout(800); await p.evaluate(() => document.querySelector('#chat .chat-head button').click()); await p.waitForTimeout(60);
      ok('waouh : elle se referme dans l’orbe', await p.evaluate(() => !!document.querySelector('.ux-ov-out.ux-circ-out')));
      await p.goto(base + '#demandes'); await p.waitForTimeout(2500);
      const rv = await p.evaluate(() => document.querySelectorAll('#view .ux-rv').length);
      await p.evaluate(() => { const sc = document.getElementById('scroller'); sc.scrollTop = sc.scrollHeight; }); await p.waitForTimeout(1300);
      const vis = await p.evaluate(() => [...document.querySelectorAll('#view .ux-rv:not(.ux-rv-on)')].filter((x) => { const r = x.getBoundingClientRect(); return r.height && r.bottom > 90 && r.top < innerHeight * 0.9; }).length);
      ok('waouh : les blocs plus bas apparaissent en 3D quand on y arrive (aucun bloc caché dans l’écran)', rv > 0 && vis === 0, 'en attente au départ : ' + rv + ', cachés à l’écran : ' + vis); }
    /* 0.58.0 : fini les blocs bleus (son choix : verre noir, une couleur par rubrique, bord irisé sur les cartes phares) */
    { await p.goto(base + '#espaces'); await p.waitForTimeout(1800);
      const c = await p.evaluate(() => { const bg = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundImage : ''; }; return {tile: bg('.esp-tile[data-go="sorties"]'), pg: document.documentElement.style.getPropertyValue('--pg'), top: getComputedStyle(document.querySelector('.top')).backgroundColor}; });
      await p.goto(base + '#argent'); await p.waitForTimeout(1800);
      const a = await p.evaluate(() => ({hero: getComputedStyle(document.querySelector('#view .rad-hero')).backgroundImage, pg: document.documentElement.style.getPropertyValue('--pg')}));
      ok('cartes : plus de bleu marine (verre presque noir), la couleur de la rubrique (rose pour Sorties), une teinte de fond par page (Argent en vert), le bord irisé sur la carte phare',
        /rgb\(21, 23, 31\)/.test(c.tile) && /0\.95\d*,? 0\.44\d*,? 0\.71|244, 114, 182/.test(c.tile) && c.pg === '#22d3ee' && a.pg === '#34d399' && /conic-gradient/.test(a.hero) && !/rgb\(4, 11, 31\)/.test(c.top), JSON.stringify({tile: c.tile.slice(0, 160), top: c.top, pg: [c.pg, a.pg]})); }
    /* 0.59.0 (son retour du 22/11 : chargement de l'accueil, appuis sur la barre qui buggent) */
    { const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      ok('démarrage : ni « Maquette » ni « Vue d’ensemble » avant que l’app soit prête, une lueur à la place, l’orbe de la barre esquissée', /<p class="demo" id="demo"><\/p>/.test(html) && /<h1 class="view-title" id="view-title"><\/h1>/.test(html) && /#view:empty \{/.test(html) && /\.talk-slot:not\(:has\(\.jv-btn\)\)::before/.test(html));
      await p.goto(base + '#agenda'); await p.waitForTimeout(1500);
      const hit = await p.evaluate(() => { const t = document.querySelector('.tab[data-tab="espaces"]'), row = document.querySelector('.fav-row').getBoundingClientRect(), r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, row.top + 3); return {ok: !!(e && e.closest('.tab[data-tab="espaces"]')), h: Math.round(r.height)}; });
      ok('barre : un appui tout en haut de l’onglet compte (avant : 12 px morts au-dessus de chaque onglet)', hit.ok && hit.h >= 60, JSON.stringify(hit));
      /* 0.65.0 : seul un second appui sur le MÊME onglet pendant sa transition est ignoré ; un autre onglet répond tout de suite */
      await p.evaluate(() => { window.__g = 0; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains('ux-ghost')) window.__g++; }))).observe(document.body, {childList: true});
        document.querySelector('.tab[data-tab="espaces"]').click(); setTimeout(() => document.querySelector('.tab[data-tab="espaces"]').click(), 90); }); await p.waitForTimeout(1000);
      const deux = await p.evaluate(() => ({cur: (document.querySelector('.tab[aria-current="page"]') || {dataset: {}}).dataset.tab, g: window.__g}));
      await p.evaluate(() => { document.querySelector('.tab[data-tab="accueil"]').click(); setTimeout(() => document.querySelector('.tab[data-tab="agenda"]').click(), 120); }); await p.waitForTimeout(1000);
      ok('barre : un second appui sur le même onglet pendant sa transition est ignoré ; un autre onglet touché aussitôt répond tout de suite (0.65.0)', deux.cur === 'espaces' && deux.g === 1 && await p.evaluate(() => (document.querySelector('.tab[aria-current="page"]') || {dataset: {}}).dataset.tab === 'agenda'), JSON.stringify(deux)); }
    /* 0.65.0 (son retour : « au chargement, toujours du clignotement sur l'accueil ; les menus, Espaces, pas réactifs des fois ») */
    { await p.goto(base + '#espaces'); await p.waitForTimeout(2000);
      ok('barre : hors de la zone qui défile (sur iPhone, un appui pendant que la page glisse ne sert plus seulement à l’arrêter)', await p.evaluate(() => document.getElementById('tabs').parentElement === document.body && !document.getElementById('scroller').contains(document.getElementById('tabs'))));
      /* doigt posé sur une tuile pendant que des données arrivent : la page n'est pas remplacée sous le doigt ; l'appui ouvre la tuile ; un seul rafraîchissement ensuite */
      const c = await p.context().newCDPSession(p); const r = await p.evaluate(() => { const b = document.querySelector('.esp-tile[data-go="sorties"]').getBoundingClientRect(); window.__t0 = document.querySelector('.esp-tile[data-go="sorties"]'); return [b.left + b.width / 2, b.top + b.height / 2]; });
      await c.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: r[0], y: r[1]}]}); await p.waitForTimeout(60);
      const pendant = await p.evaluate(() => { window.__uxRerender(); window.__uxRerender(); return document.querySelector('.esp-tile[data-go="sorties"]') === window.__t0; });
      await c.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await p.waitForTimeout(1400);
      ok('données qui arrivent pendant un appui : la page n’est pas remplacée sous le doigt, l’appui ouvre la tuile (Sorties), le rafraîchissement suit', pendant && await p.evaluate(() => /sorties/.test(location.hash) || /Sorties/.test(document.getElementById('view-title').textContent)), String(pendant));
      await p.goto(base); await p.waitForTimeout(2500);
      const cal = await p.evaluate(() => { const v = document.getElementById('view'); window.__uxRerender(); const lignes = document.querySelectorAll('.hud-lines path').length; const an = v.getAnimations({subtree: true}).filter((a) => a.effect.getTiming().iterations === Infinity && a instanceof CSSAnimation); return {lignes, n: an.length, cales: an.filter((a) => a.startTime === 0).length}; });
      ok('accueil rafraîchi : les lignes de l’écran de JARVIS là tout de suite, les animations en boucle reprennent où elles en étaient (calées sur l’horloge de la page)', cal.lignes >= 3 && cal.n > 0 && cal.cales === cal.n, JSON.stringify(cal)); }
    { const ctxR = await b.newContext({...devices['iPhone 15 Pro Max'], reducedMotion: 'reduce'}); const q = await ctxR.newPage(); await q.goto(base + '#espaces'); await q.waitForTimeout(2500);
      await q.evaluate(() => document.querySelector('.esp-tile[data-go="achats"]').click()); await q.waitForTimeout(40);
      ok('fluidité : « réduire les animations » de l’iPhone respecté (aucun calque, aucun glissé)', await q.evaluate(() => !document.querySelector('.ux-ghost') && !document.querySelector('#view .view-in.ux-in'))); await ctxR.close(); }
    await p.goto(base + '#suivi'); await p.waitForTimeout(2500);
    ok('#suivi (liens des notifications) : Équipe, filtre Demandes, avec les panneaux de Suivi ; l’adresse reste #suivi', await p.evaluate(() => location.hash === '#suivi' && document.getElementById('view-title').textContent === 'Les bots' && document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f === 'dem' && !!document.querySelector('.pend-x') && [...document.querySelectorAll('#view h2')].some((x) => /Tes ordres/.test(x.textContent))));
    await p.goto(base + '#automatisations'); await p.waitForTimeout(2500);
    ok('#automatisations : Équipe, filtre Routines (frises de suivi de livraison)', await p.evaluate(() => location.hash === '#automatisations' && document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f === 'rout' && document.querySelectorAll('.auto.card').length > 0));
    await p.evaluate(() => document.querySelector('.ux-seg [data-f="cout"]').click()); await p.waitForTimeout(400);
    ok('Équipe, filtre Coût : coût de la semaine et file d’attente', await p.evaluate(() => [...document.querySelectorAll('#view h2')].some((x) => /Coût de la semaine/.test(x.textContent)) && ![...document.querySelectorAll('#view h2')].some((x) => /En cours chez tes bots/.test(x.textContent))));
    await p.goto(base + '#reglages'); await p.waitForTimeout(2500);
    ok('Réglages : l’état des systèmes (venu de Suivi) en bas', await p.evaluate(() => [...document.querySelectorAll('#view h2')].some((x) => /État des systèmes/.test(x.textContent))));
    await p.goto(base + '#demandes'); await p.waitForTimeout(2500);
    { const segs = await p.evaluate(() => [...document.querySelectorAll('.ux-seg button')].map((b) => b.dataset.f).join(','));
      await p.evaluate(() => document.querySelector('.ux-seg [data-f="decider"]').click()); await p.waitForTimeout(400);
      ok('Pour moi : filtres Tout, Décider, À faire, Infos ; « Décider » ne garde que « À décider »', segs === 'tout,decider,faire,infos' && await p.evaluate(() => !document.getElementById('pm-dec').hidden && [...document.querySelectorAll('.pm-sec')].filter((x) => !x.hidden).length === 1 && !document.querySelector('.pm-sum:not([hidden])')), segs);
      await p.tap('.tab[data-tab="accueil"]'); await p.waitForTimeout(400); await p.tap('.tab[data-tab="demandes"]'); await p.waitForTimeout(500);
      ok('Pour moi rouvert : de nouveau sur « Tout » (0.86 : tout ce qui attend ta réponse ; les réponses des bots restent sous « Infos »)', await p.evaluate(() => document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f === 'tout' && [...document.querySelectorAll('.pm-sec')].every((x) => x.id === 'pm-rep' ? x.hidden : !x.hidden))); }
    // 0.73.0 — B3-page-5-pont
    /* Pour moi en filtres, recherche, Équipe, Athéna sans accent, brief, langue, CSS du menu « Tout », page d'un proche */
    { const ctxF = async (init) => { const c = await b.newContext({...devices['iPhone 15 Pro Max']}); await c.addInitScript(PAUSE_INIT); if (init) await c.addInitScript(init); const q = await c.newPage(); q.on('pageerror', (e) => errs.push('0.70 : ' + e.message)); return q; };
      const filtre = (q, k) => q.evaluate((f) => document.querySelector('.ux-seg [data-f="' + f + '"]').click(), k).then(() => q.waitForTimeout(500));
      const etat = (q) => q.evaluate(() => {
        const vis = (id) => { const x = document.getElementById(id); return !!x && !x.hidden && !!x.offsetParent; }, nb = (id, sel) => { const x = document.getElementById(id); return x && !x.hidden ? x.querySelectorAll(sel).length : 0; };
        const chiffre = (f) => { const bt = document.querySelector('.ux-seg [data-f="' + f + '"]'), bb = bt && bt.querySelector('b'); return bb ? +bb.textContent : 0; };
        return {f: (document.querySelector('.ux-seg [aria-pressed="true"]') || {dataset: {}}).dataset.f, vis: ['pm-dec', 'pm-todo', 'pm-proj', 'pm-rep', 'pm-wait', 'pm-mail', 'pm-taches'].filter(vis),
          montres: nb('pm-dec', '.pm-list > *') + nb('pm-todo', '.pm-list > *') + nb('pm-proj', '.pm-list > *') + nb('pm-rep', '.pm-list > .pm-rep') + nb('pm-wait', '.cote-it') + nb('pm-mail', 'li.tri') + nb('pm-taches', '.card.item, .rec-it'),
          chiffres: {decider: chiffre('decider'), faire: chiffre('faire'), infos: chiffre('infos')}, vide: [...document.querySelectorAll('#view .empty')].filter((x) => !x.hidden && x.offsetParent).map((x) => x.textContent)}; });
      let q = await ctxF();
      ok('0.70 : la page se déclare en français (lecteur d’écran, césure)', await (async () => { await q.goto(base + '#demandes'); await q.waitForTimeout(2500); return q.evaluate(() => document.documentElement.lang === 'fr'); })());
      const e0 = {}; for (const k of ['decider', 'faire', 'infos']) { await filtre(q, k); e0[k] = await etat(q); }
      ok('0.70 : Pour moi : « En attente, plus tard, en rappel » n’apparaît que sous « À faire » (plus sous Décider ni Infos)', !e0.decider.vis.includes('pm-wait') && !e0.infos.vis.includes('pm-wait') && e0.faire.vis.includes('pm-wait') && e0.decider.vis.join() === 'pm-dec' && e0.infos.vis.join() === 'pm-rep', JSON.stringify([e0.decider.vis, e0.faire.vis, e0.infos.vis]));
      ok('0.70 : Pour moi : le chiffre de chaque filtre compte exactement ce qu’il montre (« À faire » : demandes, tâches, courrier, cartes de côté)', ['decider', 'faire', 'infos'].every((k) => e0[k].chiffres[k] === e0[k].montres && e0[k].montres > 0) && e0.faire.vis.includes('pm-taches') && e0.faire.vis.includes('pm-mail'), JSON.stringify(Object.fromEntries(Object.entries(e0).map(([k, v]) => [k, [v.chiffres[k], v.montres]]))));
      await filtre(q, 'decider'); await q.evaluate(() => { location.hash = '#voir-cote'; }); await q.waitForTimeout(1500);
      const vc = await q.evaluate(() => { const x = document.getElementById('pm-wait'), r = x && x.getBoundingClientRect(); return {f: document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f, vis: !!x && !x.hidden, dans: !!r && r.bottom > 0 && r.top < innerHeight, hash: location.hash}; });
      ok('0.70 : « Voir » (#voir-cote, #voir-recent…) depuis Pour moi déjà filtré sur Décider : la liste entière revient et la section est à l’écran', vc.f === 'tout' && vc.vis && vc.dans && vc.hash === '#demandes', JSON.stringify(vc));
      /* recherche partout : une tâche s'ouvre dans Pour moi, centrée et mise en évidence */
      await q.goto(base + '#accueil'); await q.waitForTimeout(2000);
      await q.tap('#gs-btn'); await q.waitForTimeout(300); await q.fill('#gs-in', 'plombier'); await q.waitForTimeout(300);
      await q.evaluate(() => [...document.querySelectorAll('#gsearch .gs-grp')].find((x) => /^Mes tâches/.test(x.querySelector('h3').textContent)).querySelector('.gs-row').click()); await q.waitForTimeout(1500);
      const rt = await q.evaluate(() => { const v = document.querySelector('[data-vise]'), r = v && v.getBoundingClientRect(); return {hash: location.hash, f: (document.querySelector('.ux-seg [aria-pressed="true"]') || {dataset: {}}).dataset.f, dans: !!v && !!v.closest('#pm-taches') && /plombier/i.test(v.textContent) && r.top >= 60 && r.bottom <= innerHeight}; });
      ok('0.70 : recherche : une tâche touchée ouvre Pour moi (sur « Tout ») sur cette tâche, à l’écran (avant : Équipe › Demandes, sans la tâche)', rt.hash === '#demandes' && rt.f === 'tout' && rt.dans, JSON.stringify(rt));
      await q.tap('#gs-btn'); await q.waitForTimeout(300); await q.fill('#gs-in', 'suivi'); await q.waitForTimeout(300);
      ok('0.70 : recherche : « suivi » trouve la rubrique sous son nom d’aujourd’hui (« Équipe › Demandes »), plus « Suivi »', await q.evaluate(() => { const r = [...document.querySelectorAll('#gsearch .gs-grp')].find((x) => /^Rubriques/.test(x.querySelector('h3').textContent)); const t = r ? [...r.querySelectorAll('.gs-row')].map((x) => x.textContent) : []; return t.some((x) => /^Équipe › Demandes/.test(x)) && !t.some((x) => /^Suivi/.test(x)); }));
      await q.fill('#gs-in', 'budget'); await q.waitForTimeout(300);
      ok('0.70 : recherche : les rubriques Argent et Espaces se trouvent aussi (« budget » mène à Argent)', await q.evaluate(() => { const r = [...document.querySelectorAll('#gsearch .gs-grp')].find((x) => /^Rubriques/.test(x.querySelector('h3').textContent)); return !!r && [...r.querySelectorAll('.gs-row')].some((x) => /^Argent/.test(x.textContent)); }));
      await q.tap('#gsearch .gs-x'); await q.waitForTimeout(200);
      /* Équipe : les chiffres mènent où ils disent */
      await q.goto(base + '#equipe'); await q.waitForTimeout(2500);
      await q.evaluate(() => [...document.querySelectorAll('#view .stats .stat')].find((x) => /ordres? en cours/.test(x.textContent)).click()); await q.waitForTimeout(1200);
      const so = await q.evaluate(() => { const pn = [...document.querySelectorAll('#dir .panel')].find((x) => /^Tes ordres/.test((x.querySelector('h2') || {}).textContent || '')), r = pn && pn.getBoundingClientRect(); return {f: document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f, hash: location.hash, dans: !!r && r.top < innerHeight && r.bottom > 0}; });
      await filtre(q, 'bots');   /* Équipe garde son filtre : retour sur « Bots », où sont les chiffres */
      await q.waitForFunction(() => [...document.querySelectorAll('#view .stats .stat')].some((x) => /passages? cette semaine/.test(x.textContent)), null, {timeout: 8000}).catch(() => null);   /* le Journal est lu un peu après */
      const aPass = await q.evaluate(() => { const s = [...document.querySelectorAll('#view .stats .stat')].find((x) => /passages? cette semaine/.test(x.textContent)); if (s) s.click(); return !!s; }); await q.waitForTimeout(800);
      const sp = await q.evaluate(() => ({f: document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f, cout: [...document.querySelectorAll('#view h2')].some((x) => /Coût de la semaine/.test(x.textContent))}));
      ok('0.70 : Équipe : « ordres en cours » ouvre Demandes sur « Tes ordres » ; « passages cette semaine » ouvre le filtre Coût', so.f === 'dem' && so.hash === '#suivi' && so.dans && aPass && sp.f === 'cout' && sp.cout, JSON.stringify([so, aPass, sp]));
      /* brief : « Voir dans Pour moi › » garde la police de son parent, comme avant (son ancien style de police, mal écrit, était ignoré : pas de
         changement visuel sans son accord) ; plus de style du menu « Tout » ; l'indicateur de la barre sous l'onglet allumé */
      const st = await q.evaluate(() => { const bt = document.createElement('button'); bt.className = 'bf-go'; bt.textContent = 'Voir dans Pour moi ›'; document.body.append(bt); const c = getComputedStyle(bt), bc = getComputedStyle(document.body), f = c.fontWeight + ' ' + c.fontSize, fb = bc.fontWeight + ' ' + bc.fontSize; bt.remove();
        let propre = 0; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.selectorText === '.bf-go' && !r.style.fontWeight && !r.style.fontSize && !r.style.font) propre++; } catch (e) { /* feuille externe */ } }
        let mort = 0; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (/all-sheet|all-panel|all-grid|all-close|fav-handle|fav-pick|is-elsewhere/.test(r.cssText)) mort++; } catch (e) { /* feuille externe */ } }
        const ind = document.querySelector('.fav-ind'), t = document.querySelector('.fav-row .tab[aria-current="page"]'), ri = ind && ind.getBoundingClientRect(), rt2 = t && t.getBoundingClientRect();
        return {f, fb, propre, mort, ind: !!ri && !!rt2 && Math.abs((ri.left + ri.width / 2) - (rt2.left + rt2.width / 2)) < 12 && getComputedStyle(ind).opacity === '1'}; });
      ok('0.70 : brief : « Voir dans Pour moi › » garde la police héritée, comme avant (pas de gras ni de 13,5 px) ; le style mort du menu « Tout » est retiré, la barre garde son indicateur', st.f === st.fb && st.propre === 1 && st.mort === 0 && st.ind, JSON.stringify(st));
      await q.context().close();
      /* un filtre vide le dit en une phrase (ici : aucune réponse de bot ces 3 derniers jours) */
      q = await ctxF(() => { let g; Object.defineProperty(window, '__G', {configurable: true, get: () => g, set: (v) => { (v['Canal'] || []).forEach((r, i) => { if (i) r[6] = ''; }); g = v; }}); });
      await q.goto(base + '#demandes'); await q.waitForTimeout(2500); await filtre(q, 'infos');
      const ev = await etat(q);
      ok('0.70 : Pour moi : un filtre vide (Infos sans réponse) le dit en une phrase, sans chiffre sur le filtre', ev.f === 'infos' && !ev.vis.length && ev.vide.length === 1 && /^Aucune réponse de tes bots ces 3 derniers jours\.$/.test(ev.vide[0]) && ev.chiffres.infos === 0, JSON.stringify(ev));
      await q.context().close();
      /* un bot qui écrit « Athena » sans accent dans État et Routines reste Athéna (plus de bot fantôme) */
      q = await ctxF(() => { let g; Object.defineProperty(window, '__G', {configurable: true, get: () => g, set: (v) => { ['État', 'Routines'].forEach((k) => (v[k] || []).forEach((r) => { if (r[0] === 'Athéna') r[0] = 'Athena'; })); g = v; }}); });
      await q.goto(base + '#equipe'); await q.waitForTimeout(3000);
      const at = await q.evaluate(() => [...document.querySelectorAll('.team .mate')].map((m) => ({n: m.querySelector('b').textContent, p: m.querySelector('.pill').textContent})));
      ok('0.70 : « Athena » sans accent dans Pilotage : toujours 7 bots, et la carte d’Athéna n’est plus « Pas encore dans Pilotage »', at.length === 7 && !at.some((x) => x.n === 'Athena') && at.some((x) => x.n === 'Athéna' && !/Pas encore dans Pilotage/.test(x.p)), JSON.stringify(at));
      await q.context().close();
      /* page d'un proche : « Envoyer » ne part qu'une fois, même touché deux fois sur un réseau lent */
      q = await ctxF(); let posts = 0;
      await q.route('**/api/invite/**', async (route) => { if (/\/api\/invite\/tache$/.test(route.request().url())) { posts++; await new Promise((z) => setTimeout(z, 1200)); return route.fulfill({status: 200, contentType: 'text/plain; charset=utf-8', body: 'Envoyée : il la voit tout de suite.'}); }
        return route.fulfill({status: 200, contentType: 'application/json', body: '{"taches":[]}'}); });
      await q.goto(base + 'invite/#cle=cle-essai-0123&pour=Sami'); await q.waitForTimeout(1200);
      await q.evaluate(() => document.querySelector('#form button[type=submit]').click()); await q.waitForTimeout(200);
      const vide = await q.evaluate(() => document.getElementById('msg').textContent);
      await q.fill('#texte', 'Acheter du pain'); await q.evaluate(() => { const bt = document.querySelector('#form button[type=submit]'); bt.click(); bt.click(); bt.click(); }); await q.waitForTimeout(300);
      const pendant = await q.evaluate(() => document.querySelector('#form button[type=submit]').disabled); await q.waitForTimeout(1800);
      const fin = await q.evaluate(() => ({msg: document.getElementById('msg').textContent, actif: !document.querySelector('#form button[type=submit]').disabled, texte: document.getElementById('texte').value}));
      ok('0.70 : page d’un proche : trois appuis rapides sur « Envoyer » = une seule tâche ; le bouton est grisé pendant l’envoi, puis revient ; vide, elle dit quoi faire', posts === 1 && pendant && fin.actif && /Envoyée/.test(fin.msg) && fin.texte === '' && /Écris d’abord la tâche/.test(vide), JSON.stringify({posts, pendant, fin, vide}));
      await q.context().close(); }
    await p.goto(base); await p.waitForTimeout(2500);
    /* 0.25.0, un seul Claude : l'orbe ouvre la discussion avec Claude (celle qui a ses données) ; plus de page vocale ni de « Conversation » en continu */
    await p.tap('.talk-slot .jv-btn'); await p.waitForTimeout(1000);
    ok('orbe : ouvre la discussion avec Claude, sans page vocale ni mode « Conversation »', await p.evaluate(() => !document.getElementById('chat').hidden && !document.querySelector('.jv') && !!document.querySelector('#chat .lire-toggle') && ![...document.querySelectorAll('#chat .chat-head button')].some((x) => /Conversation|Fil/.test(x.textContent)) && /Claude/.test(document.querySelector('#chat .chat-id b').textContent)));
    ok('orbe sans micro (maquette) : pas de bouton micro, le clavier de l\'iPhone est proposé', await p.evaluate(() => !document.getElementById('dict-btn') && /micro du clavier/.test((document.querySelector('#chat .dict-note') || {}).textContent || '')));
    await p.fill('#chat-in', 'Bonjour'); await p.tap('#chat .chat-row .btn.main'); await p.waitForTimeout(1500);
    ok('orbe : la question écrite part à Claude avec l\'heure, la météo, l\'agenda, les tâches, les sorties et les voyages', await p.evaluate(() => { const s = window.__samples[window.__samples.length - 1]; return [...document.querySelectorAll('#chat .msg.me')].some((m) => /Bonjour/.test(m.textContent)) && document.querySelectorAll('#chat .msg.them').length >= 2 && s && s.ctx.length === 6; }), JSON.stringify(await p.evaluate(() => (window.__samples[window.__samples.length - 1] || {}).ctx)));
    await p.tap('#chat .chat-head .icon-btn'); await p.waitForTimeout(300);
    /* la dictée d'une question (fausse reconnaissance de l'iPhone) : l'orbe écoute, la phrase arrive dans le champ, rien ne part sans « Envoyer » */
    { const q = await pageWith({ear: 'ok', tts: 'ok'}, '');
      await q.tap('.talk-slot .jv-btn'); await q.waitForTimeout(500);
      const ecoute = await q.evaluate(() => ({strip: !!document.querySelector('#chat .dict-strip'), txt: (document.querySelector('#chat .dict-txt') || {}).textContent, on: (document.getElementById('dict-btn') || {className: ''}).className.includes('is-on'), sugg: !!document.querySelector('#chat .chat-form .sugg')}));
      ok('dictée : l\'orbe ouvre Claude et écoute tout de suite (bandeau « Je t\'écoute », micro allumé)', ecoute.strip && /écoute/.test(ecoute.txt) && ecoute.on && !ecoute.sugg, JSON.stringify(ecoute));
      await q.evaluate(() => window.__say.push("qu'est-ce que j'ai demain")); await q.waitForTimeout(1300);
      const pret = await q.evaluate(() => ({v: document.getElementById('chat-in').value, note: (document.querySelector('#chat .dict-note') || {}).textContent, strip: !!document.querySelector('#chat .dict-strip'), moi: document.querySelectorAll('#chat .msg.me').length}));
      ok('dictée : la phrase arrive dans le champ, à relire ; rien ne part tout seul', pret.v === "Qu'est-ce que j'ai demain" && /Relis/.test(pret.note || '') && !pret.strip && pret.moi === 0, JSON.stringify(pret));
      await q.screenshot({path: path.join(SH, 'dictee.png')});
      await q.tap('#chat .lire-toggle'); await q.waitForTimeout(200);
      await q.tap('#chat .chat-row .btn.main'); await q.waitForTimeout(1800);
      const lu = await q.evaluate(() => ({moi: [...document.querySelectorAll('#chat .msg.me')].map((m) => m.textContent), voix: window.__voice.slice(), lire: localStorage.getItem('jarvis.lire'), press: document.querySelector('#chat .lire-toggle').getAttribute('aria-pressed')}));
      ok('lecture : « Lecture : oui » retenu, la réponse est lue à voix haute sans autre appui', lu.moi.length === 1 && lu.lire === 'oui' && lu.press === 'true' && lu.voix.some((x) => /^claude:fr:Voici ma réponse/.test(x)), JSON.stringify(lu));
      /* « j'ai fini » d'un appui, puis annuler */
      await q.tap('#dict-btn'); await q.waitForTimeout(400);
      await q.tap('#chat .dict-no'); await q.waitForTimeout(800); await q.evaluate(() => window.__say.push('phrase dite après « Annuler » : elle ne doit pas arriver')); await q.waitForTimeout(700);
      ok('dictée : « Annuler » referme le micro sans rien écrire', await q.evaluate(() => !document.querySelector('#chat .dict-strip') && !document.getElementById('dict-btn').className.includes('is-on') && window.__ear.includes('abort') && document.getElementById('chat-in').value === ''), JSON.stringify(await q.evaluate(() => [document.getElementById('chat-in').value, window.__ear])));
      await q.context().close(); }
    /* 0.28.0 : un événement sur plusieurs jours (formulaire « Jusqu'au », affichage sur chaque jour, lecture de l'agenda Google) */
    { const q = await page('#agenda'); const isoN = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      await q.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Nouvel événement important/.test(x.textContent)).click()); await q.waitForTimeout(600);
      await q.fill('.ev-form input[type=text]', 'Visite des grands-parents'); await q.fill('.ev-form input[type=date]:not(.ev-fin)', isoN(2)); await q.fill('.ev-form input[type=time]', '10:00');
      await q.fill('.ev-form .ev-fin', isoN(1)); await q.waitForTimeout(150); const avantDebut = await q.evaluate(() => ({note: document.querySelector('.ev-fin-note').textContent, bad: document.querySelector('.ev-fin-note').classList.contains('is-bad')}));
      await q.evaluate(() => document.querySelector('.ev-form button[type=submit]').click()); await q.waitForTimeout(300); const refuse = await q.evaluate(() => !!document.querySelector('.ev-form'));
      await q.fill('.ev-form .ev-fin', isoN(4)); await q.waitForTimeout(150);
      const f = await q.evaluate(() => ({note: document.querySelector('.ev-fin-note').textContent, heure: document.querySelector('.ev-form input[type=time]').disabled, hv: document.querySelector('.ev-form input[type=time]').value}));
      ok('plusieurs jours : « Jusqu\'au » dans le formulaire ; une fin avant le début est refusée ; avec une fin, 3 jours en journées entières (l\'heure ne sert plus)', /avant le début/.test(avantDebut.note) && avantDebut.bad && refuse && /^3 jours, en journées entières/.test(f.note) && f.heure && f.hv === '', JSON.stringify([avantDebut, refuse, f]));
      await q.screenshot({path: path.join(SH, 'plusieurs-jours-formulaire.png')});
      await q.evaluate(() => document.querySelector('.ev-form button[type=submit]').click()); await q.waitForTimeout(1000);
      const vue = () => q.evaluate(() => ({liste: [...document.querySelectorAll('.ech-date.is-multi')].map((x) => x.textContent), mois: [...document.querySelectorAll('.mlist .dl-row')].map((x) => x.textContent).filter((t) => /grands-parents/.test(t)), toast: (document.getElementById('toasts') || {}).textContent || ''}));
      const a1 = await vue();
      ok('plusieurs jours : l\'événement est listé avec sa période et apparaît sur chacun de ses trois jours dans le mois', a1.liste.length === 1 && /au .+3 jours/.test(a1.liste[0]) && a1.mois.length === 3 && /jour 1\/3/.test(a1.mois[0]) && /jour 3\/3/.test(a1.mois[2]) && / du .+ au /.test(a1.toast), JSON.stringify(a1));
      await q.waitForTimeout(7000);   /* les 5 secondes d'annulation passées : l'événement part dans l'agenda (faux), puis est relu */
      const ev = await q.evaluate(() => (window.__calls || []).filter((c) => c.tool === 'create_event').map((c) => c.input).pop()), a2 = await vue();
      ok('plusieurs jours : écrit dans l\'agenda en journées entières, fin au lendemain du dernier jour (règle de Google), et relu sur ses trois jours', !!ev && ev.allDay === true && ev.startTime.slice(0, 10) === isoN(2) && ev.endTime.slice(0, 10) === isoN(5) && a2.mois.length === 3 && a2.liste.length === 1, JSON.stringify([ev, a2]));
      await q.evaluate(() => [...document.querySelectorAll('.mlist .dl-row')].filter((x) => /grands-parents/.test(x.textContent))[1].click()); await q.waitForTimeout(700);
      ok('plusieurs jours : la feuille donne la période entière (du … au …, 3 jours)', await q.evaluate(() => /Du .+ au .+ · 3 jours, journées entières/.test(document.getElementById('sheet').textContent)));
      await q.screenshot({path: path.join(SH, 'plusieurs-jours.png')});
      await q.context().close(); }
    { const q = await pageWith({multi: true}, '#agenda');
      const m = await q.evaluate(() => { const rows = [...document.querySelectorAll('.mlist .dl-row')].map((x) => x.textContent); const k = (t) => rows.filter((r) => r.indexOf(t) >= 0); return {cousins: k('Vacances chez les cousins'), salon: k('Salon professionnel'), soir: k('Soirée théâtre'), stage: k('Stage déjà commencé'), multi: [...document.querySelectorAll('.ech-date.is-multi')].length}; });
      const fin = new Date(); fin.setDate(fin.getDate() + 13); const memeMois = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getMonth() === new Date().getMonth(); };
      ok('plusieurs jours : un événement de l\'agenda Google sur 3 journées entières est lu sur 3 jours (pas 4), un événement à heures sur deux jours aussi ; une soirée qui finit à minuit reste sur un jour', (!memeMois(3) || m.cousins.length === 3) && (!memeMois(11) || m.salon.length === 2) && (!memeMois(12) || (m.soir.length === 1 && /20h00/.test(m.soir[0]))) && m.multi >= 3, JSON.stringify(m));
      await q.goto(base + '#accueil'); await q.waitForTimeout(1200);
      const h1 = await q.evaluate(() => ({jour: (document.querySelector('.tl-day') || {}).textContent || '', suite: [...document.querySelectorAll('.hm-row')].map((r) => r.textContent).filter((t) => /cousins/.test(t))}));
      ok('plusieurs jours : l\'accueil montre aujourd\'hui un événement déjà commencé (« jusqu\'à … ») et annonce la période de celui qui arrive', /Stage déjà commencé \(jusqu'à /.test(h1.jour) && h1.suite.length === 1 && /jusqu'à .+3 jours/.test(h1.suite[0]), JSON.stringify(h1));
      await q.context().close(); }
    /* 0.26.0 : Plutus (bot ajouté le 20/11/2026) et les bots à venir */
    { const q = await page('#equipe');
      const t0 = await q.evaluate(() => [...document.querySelectorAll('.team .mate')].map((m) => ({n: m.querySelector('b').textContent, t: m.querySelector('.mate-t').textContent, p: m.querySelector('.pill').textContent, neuf: m.classList.contains('is-new')})));
      const pl = t0.find((x) => x.n === 'Plutus');
      ok('Plutus : dans l\'équipe ; sans ligne dans Pilotage, sa carte le dit (« Pas encore dans Pilotage »), pas celles des autres', !!pl && pl.t === 'Générateur de revenus' && /Pas encore dans Pilotage/.test(pl.p) && pl.neuf && t0.filter((x) => x.neuf).length === 1, JSON.stringify(t0));
      await q.evaluate(() => [...document.querySelectorAll('.team .mate')].find((m) => m.querySelector('b').textContent === 'Plutus').click()); await q.waitForTimeout(900);
      const pg = await q.evaluate(() => { const n = document.getElementById('bot-new'); return {hero: document.querySelector('.hero-id').textContent, ex: /ex-Plutus/.test(document.querySelector('.hero-id').textContent), txt: n ? n.textContent : '', btn: n ? [...n.querySelectorAll('button')].map((b) => b.textContent) : []}; });
      ok('Plutus : sa page explique pourquoi rien ne remonte et donne la phrase à coller dans son chat (État, Routines, Sonnette, « Via chat », Journal, aucune donnée bancaire)', /dieu de la richesse/.test(pg.hero) && !pg.ex && ['onglet État', 'onglet Routines', 'Sonnette Plutus', '« Via chat »', 'onglet Journal', 'Aucune donnée bancaire'].every((k) => pg.txt.includes(k)) && pg.btn.some((b) => /Copier la phrase/.test(b)), JSON.stringify(pg).slice(0, 300));
      await q.screenshot({path: path.join(SH, 'plutus-a-brancher.png')});
      await q.context().close(); }
    { const q = await pageWith({newBots: true}, '#equipe');
      const t1 = await q.evaluate(() => [...document.querySelectorAll('.team .mate')].map((m) => ({n: m.querySelector('b').textContent, t: m.querySelector('.mate-t').textContent, p: m.querySelector('.pill').textContent, neuf: m.classList.contains('is-new')})));
      const pl = t1.find((x) => x.n === 'Plutus'), mi = t1.find((x) => x.n === 'Midas'), ir = t1.find((x) => x.n === 'Iris');
      ok('nouveaux bots : Plutus inscrit dans Pilotage n\'a plus l\'avis et sa question lui est attribuée (pas à Iris)', !!pl && !pl.neuf && /Te demande/.test(pl.p) && /Te demande · 8/.test(ir.p), JSON.stringify(t1));
      ok('nouveaux bots : un bot inconnu de la page mais présent dans État et Routines (« Midas ») rejoint l\'équipe seul ; un nom vu seulement dans le Canal (« Pegasus ») non', t1.length === 8 && !!mi && mi.t === 'Nouveau bot' && !mi.neuf && !t1.some((x) => x.n === 'Pegasus'), t1.map((x) => x.n).join(', '));
      await q.evaluate(() => [...document.querySelectorAll('.team .mate')].find((m) => m.querySelector('b').textContent === 'Plutus').click()); await q.waitForTimeout(900);
      const pg = await q.evaluate(() => ({neuf: !!document.getElementById('bot-new'), txt: document.getElementById('dir').textContent.replace(/\s+/g, ' ')}));
      ok('Plutus inscrit : sa page montre son dernier passage, ses routines et son fil du Canal', !pg.neuf && /Dernier passage\d{2}\/\d{2} · 08h05/.test(pg.txt) && /Point du matin · Lun-ven 8h/.test(pg.txt) && /Sonnette Plutus/.test(pg.txt) && /Piste freelance/.test(pg.txt), pg.txt.slice(0, 300));
      await q.screenshot({path: path.join(SH, 'plutus-inscrit.png')});
      await q.goto(base + '#demandes'); await q.waitForTimeout(1500);
      const pm = await q.evaluate(() => [...document.querySelectorAll('.pm-card')].filter((c) => /freelance/i.test(c.textContent)).map((c) => c.querySelector('.pm-who').textContent));
      ok('Plutus : sa question arrive dans « Pour moi » sous son nom', pm.length === 1 && /^Plutus/.test(pm[0]), JSON.stringify(pm));
      await q.tap('#gs-btn'); await q.waitForTimeout(300); await q.fill('#gs-in', 'revenus'); await q.waitForTimeout(300);
      ok('Plutus : la recherche trouve ce qu\'il a répondu', await q.evaluate(() => [...document.querySelectorAll('#gsearch .gs-row')].some((r) => /Plutus/.test(r.textContent))));
      await q.tap('#gsearch .gs-x'); await q.tap('.talk-slot .jv-btn'); await q.waitForTimeout(800); await q.fill('#chat-in', 'Où en est Plutus ?'); await q.tap('#chat .chat-row .btn.main'); await q.waitForTimeout(1500);
      ok('Plutus : Claude reçoit la vraie liste de l\'équipe (Plutus et Midas compris)', await q.evaluate(() => { const s = window.__samples[window.__samples.length - 1]; return /Argus, Plutus, Midas\)/.test(s.first); }), await q.evaluate(() => (window.__samples[window.__samples.length - 1] || {}).first));
      await q.context().close(); }
    /* 0.25.0 : la recherche partout (loupe de l'en-tête), dans ce que la page a déjà lu */
    { const q = await page('#accueil');
      await q.tap('#gs-btn'); await q.waitForTimeout(300); await q.fill('#gs-in', 'notaire'); await q.waitForTimeout(300);
      const r1 = await q.evaluate(() => ({rows: [...document.querySelectorAll('#gsearch .gs-grp .gs-row')].map((r) => r.textContent), grp: [...document.querySelectorAll('#gsearch .gs-grp h3')].map((x) => x.firstChild.textContent), mark: !!document.querySelector('#gsearch .gs-row mark'), pap: !!document.querySelector('#gsearch .gs-pap')}));
      ok('recherche : « notaire » trouve le rendez-vous une seule fois, surligné, avec le lien vers les papiers', r1.rows.length === 1 && /notaire/i.test(r1.rows[0]) && r1.grp[0] === 'Agenda et échéances' && r1.mark && r1.pap, JSON.stringify(r1));
      await q.fill('#gs-in', 'robot'); await q.waitForTimeout(300);
      const r2 = await q.evaluate(() => [...document.querySelectorAll('#gsearch .gs-grp h3')].map((x) => x.firstChild.textContent));
      ok('recherche : « robot » ressort dans plusieurs rubriques (Pour moi, Achats, échanges avec les bots…)', ['Pour moi', 'Achats', 'Échanges avec les bots'].every((g) => r2.includes(g)), r2.join(' | '));
      await q.screenshot({path: path.join(SH, 'recherche.png')});
      await q.evaluate(() => [...document.querySelectorAll('#gsearch .gs-grp')].find((g) => /^Achats/.test(g.querySelector('h3').textContent)).querySelector('.gs-row').click()); await q.waitForTimeout(700);
      ok('recherche : un appui ouvre l\'élément là où il vit (la fiche de l\'achat)', await q.evaluate(() => document.getElementById('gsearch').hidden && location.hash === '#achats' && /Robot Alpha/.test(document.getElementById('dir').textContent) && /Tous les achats/.test(document.getElementById('dir').textContent)), await q.evaluate(() => location.hash));
      await q.tap('#gs-btn'); await q.waitForTimeout(300); await q.fill('#gs-in', 'passeport'); await q.waitForTimeout(300);
      await q.evaluate(() => document.querySelector('#gsearch .gs-pap').click()); await q.waitForTimeout(900);
      ok('recherche : « dans mes papiers » ouvre Papiers avec le mot déjà cherché', await q.evaluate(() => location.hash === '#papiers' && (document.querySelector('.pap-search') || {}).value === 'passeport'));
      await q.tap('#gs-btn'); await q.waitForTimeout(300); await q.fill('#gs-in', 'zzzqqq'); await q.waitForTimeout(300);
      ok('recherche : rien trouvé est dit clairement, « Fermer » referme', await q.evaluate(() => /Rien pour « zzzqqq »/.test(document.getElementById('gs-res').textContent)) && await (async () => { await q.tap('#gsearch .gs-x'); await q.waitForTimeout(200); return q.evaluate(() => document.getElementById('gsearch').hidden); })());
      await q.context().close(); }
    /* 0.25.0 : « Pour moi », une par une */
    { const q = await page('#demandes');
      const top = await q.evaluate(() => { const b = document.getElementById('fc-start'), r = b && b.getBoundingClientRect(); return {btn: !!b, y: r ? r.bottom : 9999, banner: !!document.querySelector('#dir .view-in > .pause-b'), vh: innerHeight}; });
      ok('Pour moi : « Traiter une par une » visible dès l\'ouverture, sans le grand cadre de pause au-dessus', top.btn && top.y < top.vh * 0.5 && !top.banner, JSON.stringify(top));
      await q.tap('#fc-start'); await q.waitForTimeout(500);
      const st = () => q.evaluate(() => ({count: (document.querySelector('.fc-count') || {}).textContent, done: (document.querySelector('.fc-done') || {}).textContent, cards: document.querySelectorAll('.fc-view .card, .fc-view article').length, t: (document.querySelector('.fc-view .pm-title') || {}).textContent, prog: (document.querySelector('.fc-prog i') || {style: {}}).style.width, badge: (document.querySelector('.tab[data-tab="demandes"] .badge') || {}).textContent}));
      const a0 = await st(), n0 = +a0.count.split(' sur ')[1];
      ok('une par une : une seule demande à l\'écran, « 1 sur N », la barre du bas reste', /^1 sur \d+$/.test(a0.count) && n0 >= 10 && await q.evaluate(() => document.querySelectorAll('.fc-view .fc-card, .fc-view > .card, .fc-view > article').length === 1 && !!document.querySelector('.fav-bar') && !document.getElementById('fc-start')), JSON.stringify(a0));
      for (let i = 0; i < 3; i++) { await q.tap('.fc-nav .btn:last-child'); await q.waitForTimeout(300); }
      const a1 = await st();
      ok('une par une : « Passer » avance sans rien écrire (4 sur N, rien de traité)', a1.count === '4 sur ' + n0 && !a1.done && a1.badge === a0.badge, JSON.stringify(a1));
      await q.evaluate(() => [...document.querySelectorAll('.fc-view .pm-tile')].find((x) => /^Oui/.test(x.textContent)).click()); await q.waitForTimeout(900);
      const a2 = await st();
      ok('une par une : après une réponse, la suivante prend la place (4 sur N-1, « 1 traitée »), sans feuille « Et ensuite ? », avec « Annuler »', a2.count === '4 sur ' + (n0 - 1) && /^1 traitée$/.test(a2.done) && a2.t !== a1.t && await q.evaluate(() => document.getElementById('sheet').hidden && [...document.querySelectorAll('.toast button')].some((b) => /Annuler/.test(b.textContent))), JSON.stringify([a1.t, a2]));
      await q.screenshot({path: path.join(SH, 'une-par-une.png')});
      await q.tap('.fc-nav .btn:first-child'); await q.waitForTimeout(300);
      ok('une par une : « Précédente » revient en arrière', (await st()).count === '3 sur ' + (n0 - 1));
      for (let i = 0; i < n0 + 2; i++) { const more = await q.evaluate(() => { const b = document.querySelector('.fc-nav .btn:last-child'); if (b) b.click(); return !!b; }); if (!more) break; await q.waitForTimeout(100); }
      ok('une par une : au bout de la liste, le bilan (traitées, restantes) et le retour à la liste', await q.evaluate(() => /Tu as fait le tour/.test(document.querySelector('.fc-end').textContent) && /1 demande traitée/.test(document.querySelector('.fc-end').textContent)));
      await q.evaluate(() => [...document.querySelectorAll('.fc-end button')].find((b) => /Revenir/.test(b.textContent)).click()); await q.waitForTimeout(400);
      ok('une par une : retour à toute la liste', await q.evaluate(() => !document.querySelector('.fc-view') && !!document.getElementById('fc-start') && !!document.getElementById('pm-dec')));
      await q.tap('#fc-start'); await q.waitForTimeout(300); await q.tap('.fav-row .tab[data-tab="agenda"]'); await q.waitForTimeout(500); await q.tap('.fav-row .tab[data-tab="demandes"]'); await q.waitForTimeout(500);
      ok('une par une : changer de rubrique referme le mode (au retour, toute la liste)', await q.evaluate(() => !document.querySelector('.fc-view') && !!document.getElementById('fc-start')));
      await q.context().close(); }
    { const q = await page('#agenda');
      ok('agenda : le rendez-vous écrit aussi dans Échéances n\'est listé qu\'une fois dans le mois, avec le bot qui le suit', await q.evaluate(() => { const rows = [...document.querySelectorAll('#dir .mlist .dl-row')].filter((r) => /notaire/i.test(r.textContent)); return rows.length === 1 && /14h30/.test(rows[0].textContent) && /Iris/.test(rows[0].textContent); }));
      await q.context().close(); }
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
    /* 18/11/2026 (retour du propriétaire) : « À faire » sans les sorties passées, filtre « Expirées » ; pastille à texte long dans sa forme */
    ok('sorties : « À faire » ne compte pas les expirées, filtre « Expirées » à part', await p.evaluate(() => { const seg = [...document.querySelectorAll('.seg button')].map((x) => x.textContent); return seg[0] === 'À faire (3)' && seg[1] === 'Expirées (2)' && ![...document.querySelectorAll('.sor')].some((x) => x.classList.contains('is-exp')); }), await p.evaluate(() => [...document.querySelectorAll('.seg button')].map((x) => x.textContent).join(', ')));
    ok('sorties : texte long d\'une pastille sur plusieurs lignes, dans sa forme (coins de 13 px) et dans la carte', await p.evaluate(() => { const ch = [...document.querySelectorAll('.sor-chip')], tall = ch.filter((c) => c.getBoundingClientRect().height > 30); return tall.length >= 1 && ch.every((c) => c.scrollWidth <= c.clientWidth + 1 && c.getBoundingClientRect().right <= c.closest('.sor-in').getBoundingClientRect().right && getComputedStyle(c).borderTopLeftRadius === '13px'); }));
    await p.evaluate(() => [...document.querySelectorAll('.seg button')].find((x) => /^Expirées/.test(x.textContent)).click()); await p.waitForTimeout(500);
    ok('sorties : filtre « Expirées » : les 2 sorties passées, rien d\'autre', await p.evaluate(() => { const c = [...document.querySelectorAll('.sor')]; return c.length === 2 && c.every((x) => x.classList.contains('is-exp')); }));
    /* suivi, demandes, équipe : rien de perdu de l'ancien accueil */
    p = await page('#suivi');
    ok('suivi : en cours chez tes bots, avec étapes', await p.evaluate(() => !!document.querySelector('.pend-x .track')));
    p = await page('#demandes');
    ok('demandes : réponses reçues dans « À décider », courrier arrivé replié dans « Courrier à trier »', await p.evaluate(() => /Réponse reçue/.test((document.getElementById('pm-dec') || {}).textContent || '') && [...document.querySelectorAll('details.pm-sec')].some((x) => /Courrier à trier/.test(x.querySelector('summary').textContent) && /Arrivés depuis/.test(x.textContent))));
    /* 18/11/2026 (retour du propriétaire : « cet onglet est très mal fait ») : résumé, sections, cartes illustrées, historique parti dans Suivi */
    ok('Pour moi : résumé, « À décider » et « À faire », plus d\'historique du Canal ni de paragraphe d\'explication', await p.evaluate(() => !!document.querySelector('.pm-sum') && !!document.getElementById('pm-dec') && !!document.getElementById('pm-todo') && !document.querySelector('#dir .hist-panel') && !document.querySelector('#dir p.lead')));
    ok('CRA (oui attendu, texte vide dans À toi) : la demande lue dans le Canal, « Oui depuis JARVIS » (Charte, section 7), sa semaine', await p.evaluate(() => { const c = [...document.querySelectorAll('.pm-card')].find((x) => x.querySelector('.pm-title').textContent === 'CRA client'); return !!c && /Soumettre le CRA client/.test(c.textContent) && !!c.querySelector('.week') && [...c.querySelectorAll('.pm-row .btn')].some((b) => /^Oui depuis JARVIS/.test(b.textContent)); }));
    ok('Pour moi : chaque demande a son image (mail, semaine, oui/non, choix, étapes ou échéancier)', await p.evaluate(() => { const c = [...document.querySelectorAll('.pm-card')]; const kinds = new Set(c.flatMap((x) => [...x.querySelectorAll('.pm-viz > *')].map((v) => v.classList[0] || v.className))); return c.length >= 8 && ['pm-mail', 'pm-yn', 'pm-opts', 'pm-tl'].every((k) => kinds.has(k)) && c.filter((x) => x.querySelector('.pm-viz')).length >= c.length * 0.7; }), await p.evaluate(() => [...document.querySelectorAll('.pm-card')].map((x) => x.querySelector('.pm-title').textContent + ':' + [...x.querySelectorAll('.pm-viz > *')].map((v) => v.classList[0] || v.className).join('+')).join(' | ')));
    /* 18/11/2026 (retour du propriétaire, choix QCM « Court, selon la demande ») : feuille d'une demande raccourcie, « Revérifie » selon le sujet */
    { await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
      await p.evaluate(() => { const c = [...document.querySelectorAll('article')].find((x) => /Date du bail/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }); await p.waitForTimeout(900);
      const f = await p.evaluate(() => ({vis: [...document.querySelectorAll('#sheet .sheet-actions > div:not(.sa-more) .btn')].map((x) => x.firstChild.textContent.trim()), more: [...document.querySelectorAll('#sheet .sa-more .btn')].map((x) => x.firstChild.textContent.trim()), sum: (document.querySelector('#sheet .sa-more summary') || {}).textContent || '', open: (document.querySelector('#sheet .sa-more') || {}).open, txt: document.getElementById('sheet').textContent, inp: !!document.querySelector('#sheet .free-row')}));
      ok('demande : 3 réponses en haut (C\'est fait, Revérifie dans mes papiers, Plus tard), le reste replié', f.vis.join('|') === "C'est fait|Revérifie dans mes papiers|Plus tard" && f.open === false && f.sum === 'Autres réponses (5)' && ['Prépare-moi tout', 'Non, pas besoin', 'Non, plutôt…', 'Revérifie dans mes mails', 'Confier à un autre bot'].every((x) => f.more.includes(x)), JSON.stringify(f.vis) + ' / ' + JSON.stringify(f.more));
      ok('demande : sans doublons (ni « Explique-moi », ni « Autre chose ? », ni « Écrire à Iris ») ; second avis et discussion de Claude gardés', !/Explique-moi|Écrire à Iris/.test(f.txt) && !f.inp && /Un second avis de Claude|Aide à la décision/.test(f.txt) && /Discuter avec Claude/.test(f.txt));
      const n0 = await p.evaluate(() => document.querySelectorAll('#toasts .toast').length);
      await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Revérifie dans mes papiers/.test(x.textContent)).click()); await p.waitForTimeout(700);
      const ts = await p.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
      ok('demande : « Revérifie dans mes papiers » (maquette) explique ce que fait le serveur, rien n\'est écrit dans le Canal', /Revérification \(maquette\)/.test(ts) && /écrit à Iris et la sonne/.test(ts) && !/Dans 5 s/.test(ts) && await p.evaluate(() => document.getElementById('sheet').hidden), ts.slice(0, 200));
      await p.evaluate(() => { const c = [...document.querySelectorAll('article')].find((x) => /Dates du voyage/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }); await p.waitForTimeout(900);
      const g = await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions > div:not(.sa-more) .btn')].map((x) => x.firstChild.textContent.trim()).join('|'));
      ok('demande : sujet sans papier ni mail (dates du voyage) : pas de « Revérifie » en haut', !/Revérifie/.test(g) && /^Répondre à Ulysse/.test(g), g);
      await p.evaluate(() => document.querySelector('#sheet .sheet-close').click()); await p.waitForTimeout(400); }
    /* 18/11/2026 (retour du propriétaire) : brouillon et demande du même sujet = une seule carte avec son historique ; envoi = dossier à jour, ligne et sonnette pour Iris */
    { const open = async (re) => { await p.evaluate((src) => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const c = [...document.querySelectorAll('article')].find((x) => new RegExp(src).test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }, re); await p.waitForTimeout(900); };
      const vis = () => p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions > div:not(.sa-more) .btn')].map((x) => x.firstChild.textContent.trim()));
      const close = () => p.evaluate(() => { const b = document.querySelector('#sheet .sheet-close'); if (b) b.click(); }).then(() => p.waitForTimeout(400));
      ok('brouillon lié : il quitte « Brouillons prêts à partir » (lien par l\'objet du fil et le n° de ticket)', await p.evaluate(() => ![...document.querySelectorAll('article')].some((x) => /Brouillon prêt/.test(x.textContent) && /4521/.test(x.textContent))));
      await open('Résiliation StreamPlus');
      const f = await p.evaluate(() => ({t: document.getElementById('sheet').textContent, hist: [...document.querySelectorAll('#sheet .hist-l li')].map((x) => x.textContent)}));
      const v0 = await vis();
      ok('brouillon lié : une seule carte, « Envoyer ce mail » en premier, le mail dedans et l\'historique (dossier, brouillon)', v0[0] === 'Envoyer ce mail' && /contact@streamplus\.example/.test(f.t) && /Historique \(\d+\)/.test(f.t) && f.hist.some((x) => /Brouillon prêt dans Gmail : « Re: Votre demande a bien été reçue \(#4521\) »/.test(x)) && f.hist.some((x) => /Dossier : Ticket #4521/.test(x)) && !/Pourquoi : Brouillon\./.test(f.t), JSON.stringify([v0, f.hist]));
      await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Envoyer ce mail/.test(x.textContent)).click()); await p.waitForTimeout(500);
      await p.evaluate(() => [...document.querySelectorAll('#sheet .btn')].find((x) => /^Oui : envoyer ce mail/.test(x.textContent)).click()); await p.waitForTimeout(800);
      const t1 = await p.evaluate(() => document.getElementById('sheet').textContent + ' || ' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
      await p.waitForTimeout(6500);
      const g = await p.evaluate(() => ({canal: (window.__G.Canal || []).slice(-3).map((r) => r.join(' ¦ ')), dos: (window.__G.Dossiers || []).find((r) => r[0] === 'Résiliation StreamPlus'), drafts: window.__MAIL.drafts.map((d) => d.id)}));
      /* 0.85.0 (sa règle du 26/11/2026) : JARVIS envoie lui-même ; ni ligne ni sonnette pour Iris */
      ok('brouillon envoyé : le mail part par JARVIS, le dossier passe en attente de la réponse, aucune ligne ni sonnette pour un bot', /Dans 5 s/.test(t1) && !/sonnette/.test(t1) && !/ligne pour Iris|réveille/.test(t1) && !g.drafts.includes('DRAFT3') && g.dos && g.dos[4] === 'contact@streamplus.example' && /^Attendre la réponse au mail du/.test(g.dos[2]) && !g.canal.some((x) => /Brouillon envoyé par Rabie/.test(x)), JSON.stringify([t1.slice(0, 200), g]));
      /* demande dépassée : Expirée, C'est fait / Clôturer / J'ai fait…, sans « Plus tard » ; offre terminée dans le texte : Expirée en partie */
      await open('Offre de bienvenue'); const v1 = await vis(), m1 = await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim()));
      ok('demande dépassée : « Expirée », Clôturer (suggéré) / C\'est fait / J\'ai fait…, sans « Plus tard », clôture au prochain passage', v1.join('|') === "Clôturer|C'est fait|J'ai fait…" && !m1.includes('Plus tard') && await p.evaluate(() => /Expirée/.test(document.querySelector('#sheet .sheet-kicker').textContent) && /prochain passage/.test(document.querySelector('#sheet .sheet-actions').textContent)), JSON.stringify([v1, m1]));
      await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => x.firstChild.textContent.trim() === 'Clôturer').click()); await p.waitForTimeout(700);
      const t2 = await p.evaluate(() => document.getElementById('sheet').textContent + ' || ' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
      ok('demande dépassée : « Clôturer » écrit pour Iris sans sonnette', /Dans 5 s/.test(t2) && /prochain passage \(sans sonnette\)/.test(t2) && !/puis la sonnette/.test(t2), t2.slice(0, 300));
      await p.waitForTimeout(5800); await close();
      await open("Rachat de l'abonnement"); const v2 = await vis();
      ok('offre terminée dans le texte : « Expirée en partie », « Clôturer la partie expirée » en premier, le reste de la demande gardé', v2[0] === 'Clôturer la partie expirée' && v2.includes("J'ai fait…") && v2.includes("C'est fait") && !v2.includes('Plus tard'), JSON.stringify(v2)); await close();
      /* fermeture de crèche : la décision attend « en rappel » jusqu'à 1 mois avant ; « Mettre de côté » */
      ok('décision liée à une fermeture de crèche : en rappel jusqu\'à 1 mois avant, avec ses paliers', await p.evaluate(() => ![...document.querySelectorAll('article')].some((x) => /Garde pendant la fermeture/.test(x.textContent)) && [...document.querySelectorAll('.cote-it')].some((x) => /Garde pendant la fermeture/.test(x.textContent) && /En rappel · revient le/.test(x.textContent) && /vendredi d'avant/.test(x.textContent))));
      await open('Passeport'); const lt = await p.evaluate(() => { const b = [...document.querySelectorAll('#sheet .sheet-actions > div:not(.sa-more) .btn')].find((x) => /^Plus tard/.test(x.textContent)); const c = b && b.querySelector('.cost'); b.click(); return c ? c.textContent : ''; }); await p.waitForTimeout(600);
      ok('« Plus tard » ne réveille aucun bot (0.86 : plus de badge « gratuit ») et dans les gestes principaux ; plus de « Mettre de côté » en double', lt === '' && await p.evaluate(() => !!document.querySelector('#sheet .sheet-pick') && !/Mettre de côté/.test(document.getElementById('sheet').textContent)), lt);
      await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-pick .btn')].find((x) => /Sans date/.test(x.textContent)).click()); await p.waitForTimeout(800);
      const c1 = await p.evaluate(() => ({card: [...document.querySelectorAll('article')].some((x) => /^IrisÀ faire/.test(x.textContent) && /Passeport/.test(x.textContent)), cote: [...document.querySelectorAll('.cote-it')].map((x) => x.textContent)}));
      ok('« Plus tard » sans date : la carte quitte Pour moi pour « En attente, plus tard, en rappel », sans ligne pour un bot', !c1.card && c1.cote.some((x) => /^Passeport/.test(x) && /Plus tard, sans date · rappel chaque dimanche à 18 h/.test(x)), JSON.stringify(c1));
      /* 18/11/2026 : un appui sur la carte de côté l'ouvre (rappel de ce que c'est), avec « Remettre dans Pour moi » */
      await p.evaluate(() => [...document.querySelectorAll('.cote-it')].find((x) => /^Passeport/.test(x.textContent)).querySelector('.cote-tx').click()); await p.waitForTimeout(900);
      const cs = await p.evaluate(() => { const s = document.getElementById('sheet'); return s && !s.hidden ? s.innerText : ''; });
      ok('carte de côté : un appui l\'ouvre (de côté, pourquoi, « Remettre dans Pour moi »)', /De côté/i.test(cs) && /Passeport/.test(cs) && /Remettre dans Pour moi/.test(cs), cs.replace(/\s+/g, ' ').slice(0, 120));
      await p.evaluate(() => document.getElementById('sheet-back').click()); await p.waitForTimeout(400);
      await p.evaluate(() => [...[...document.querySelectorAll('.cote-it')].find((x) => /^Passeport/.test(x.textContent)).querySelectorAll('button')].find((b) => b.textContent === 'Remettre').click()); await p.waitForTimeout(500);
      /* réponse mémorisée : la carte ne revient pas à la relecture de Pilotage avant le passage du bot ; une tâche en retard n'est pas « Expirée » */
      await open('Formulaire de la mutuelle'); const v3 = await vis(), k3 = await p.evaluate(() => document.querySelector('#sheet .sheet-kicker').textContent);
      ok('tâche en retard (sans offre) : pas « Expirée », « Plus tard » toujours là', !/Expirée/.test(k3) && v3.includes('Plus tard') && v3.includes("C'est fait"), JSON.stringify([k3, v3]));
      const y0 = await p.evaluate(() => { const s2 = document.getElementById('sheet'), a = s2.querySelector('.sheet-actions .btn'); return Math.round(a.getBoundingClientRect().top - s2.getBoundingClientRect().top); });
      await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^C'est fait/.test(x.textContent)).click()); await p.waitForTimeout(6200);
      await p.reload(); await p.waitForTimeout(3000);
      const rp = await p.evaluate(() => ({card: [...document.querySelectorAll('article')].some((x) => /Formulaire de la mutuelle/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)), pan: [...document.querySelectorAll('.cote-it')].map((x) => x.textContent)}));
      ok('réponse donnée : la carte reste cachée au rechargement, « en attente du passage » du bot', !rp.card && rp.pan.some((x) => /^Formulaire de la mutuelle/.test(x) && /Répondu le .* en attente du passage de Iris/.test(x)), JSON.stringify(rp));
      ok('feuille : les gestes en haut, visibles sans faire défiler (premier bouton à moins de 400 px du haut de la feuille)', y0 > 0 && y0 < 400, String(y0));
      ok('« Remettre » : la carte revient dans Pour moi', await p.evaluate(() => [...document.querySelectorAll('article')].some((x) => /Passeport/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)) && ![...document.querySelectorAll('.cote-it')].some((x) => /^Passeport/.test(x.textContent)))); }
    p = await page('#equipe');
    ok('équipe : « En ce moment », fil en direct (maintenant, bientôt, plus tôt = Journal)', await p.evaluate(() => { const f = document.querySelector('.lf'); const hs = f ? [...f.querySelectorAll('.lf-h')].map((x) => x.textContent) : []; return !!f && hs.join(',') === 'Maintenant,Bientôt,Plus tôt' && /En direct/.test(f.textContent) && f.querySelectorAll('.lf-r.is-past').length >= 3 && f.querySelectorAll('.lf-r.is-wait').length >= 1 && ![...document.querySelectorAll('.panel-h h2')].some((x) => /^Journal/.test(x.textContent)); }));
    /* 20/11/2026 : indépendant du jour. Du vendredi après-midi au samedi, aucune routine d'exemple ne tombe dans les 24 heures : le bloc « Bientôt » le dit (« Aucun passage prévu dans les 24 heures »), ce qui est juste */
    ok('équipe : passages des 24 heures avec « dans … » (ou « Aucun passage prévu » quand rien ne tombe d\'ici demain)', await p.evaluate(() => { const r = [...document.querySelectorAll('.lf-r.is-soon')], vide = [...document.querySelectorAll('.lf-calm')].some((x) => /Aucun passage prévu dans les 24 heures/.test(x.textContent)); return r.length ? r.every((x) => /dans |maintenant/.test(x.textContent)) : vide; }));
    /* équipe harmonisée (16/11/2026) */
    ok('équipe : une seule grille de 7 cartes identiques (Plutus compris), plus de liste des bots en double', await p.evaluate(() => { const m = [...document.querySelectorAll('.team .mate')]; return m.length === 7 && m.every((x) => x.querySelector('.mate-log span') && /^Prochain · /.test(x.querySelector('.mate-next small').textContent)) && !document.querySelector('.units'); }));
    ok('équipe : texte en Exo 2, plus de police machine à écrire', await p.evaluate(() => /Exo 2/.test(getComputedStyle(document.querySelector('.mate-log')).fontFamily) && /Oxanium/.test(getComputedStyle(document.querySelector('.mate b')).fontFamily)));
    ok('équipe : l\'ambre ne remplit plus les cartes', await p.evaluate(() => { const d = document.querySelector('.mate[data-mode="demande"]'); return !!d && !/251, 191, 36, 0\.12/.test(getComputedStyle(d).backgroundImage); }));
    ok('équipe : « Te demande » une seule fois par carte', await p.evaluate(() => [...document.querySelectorAll('.mate[data-mode="demande"]')].every((x) => !/^Te demande/.test(x.querySelector('.mate-log span').textContent))));
    await p.screenshot({path: path.join(SH, 'equipe.png')});
    await p.evaluate(() => document.querySelector('.ux-seg [data-f="dem"]').click()); await p.waitForTimeout(500);   /* refonte UX : tes ordres sont dans Équipe, filtre Demandes */
    ok('équipe : tes ordres en lignes, pastilles de chiffres sans débordement', await p.evaluate(() => { const st = document.querySelector('.stats') || document.createElement('div'); const t = [...document.querySelectorAll('.panel')].find((x) => x.querySelector('h2') && /^Tes ordres/.test(x.querySelector('h2').textContent)); return !!t && t.querySelectorAll('.canal-row').length > 0 && !/\[object/.test(t.textContent) && !!st && st.scrollWidth <= st.clientWidth + 1; }));

    await p.evaluate(() => [...document.querySelectorAll('.panel')].find((x) => x.querySelector('h2') && /^Tes ordres/.test(x.querySelector('h2').textContent)).querySelector('.canal-row').click()); await p.waitForTimeout(700);
    ok('équipe : un ordre s\'ouvre avec ses gestes', await p.evaluate(() => { const s = document.getElementById('sheet'); return !!s && !s.hidden && /Relancer|Merci/.test(s.textContent); }));
    /* papiers lus dans le Drive (16/11/2026) */
    p = await page('#papiers');
    ok('papiers : tuiles par personne et par thème, lues dans le Drive', await p.evaluate(() => { const h = [...document.querySelectorAll('.hm-h h2')].map((x) => x.textContent); return h.includes('Par personne') && h.includes('Par thème') && document.querySelectorAll('.pt').length >= 8 && /\d+ documents/.test(document.querySelector('.pap-n').textContent); }));
    ok('papiers : le propriétaire en premier, puis les autres personnes par ordre alphabétique', await p.evaluate(() => { const h2 = [...document.querySelectorAll('.hm-h h2')].find((x) => x.textContent === 'Par personne'); const names = [...h2.closest('section').querySelectorAll('.pt b')].map((x) => x.textContent); return names.join(',') === 'Lui,Léa,Sarah'; }), await p.evaluate(() => [...document.querySelectorAll('.pt b')].map((x) => x.textContent).join(',')));
    ok('papiers : papiers privés masqués par défaut', await p.evaluate(() => ![...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === 'Papiers privés') && /Afficher les papiers privés/.test(document.querySelector('.pap-priv').textContent)));
    await p.fill('.pap-search', 'passeport'); await p.waitForTimeout(300);
    ok('papiers : recherche instantanée avec le chemin du dossier', await p.evaluate(() => { const r = [...document.querySelectorAll('.pap-res .pf')]; return r.length >= 3 && r.every((x) => /passeport/i.test(x.textContent)) && r.some((x) => / › /.test(x.textContent)) && r.every((x) => /^https:\/\/drive\.google\.com\//.test(x.href)); }));
    /* 0.15.0 : recherche dans le texte des documents (lu par Google), sous les noms */
    await p.fill('.pap-search', 'loyer'); await p.waitForTimeout(1400);
    ok('papiers : recherche dans le texte des documents (« loyer » trouve les quittances)', await p.evaluate(() => { const hd = document.querySelector('.pap-txt-h'), r = [...document.querySelectorAll('.pap-res-txt .pf')]; return !!hd && /Dans le texte des documents · \d+/.test(hd.textContent) && r.length > 0 && r.every((x) => /quittance/i.test(x.textContent)) && !/null|undefined/.test(document.querySelector('.pap-res').textContent); }));
    await p.screenshot({path: path.join(SH, 'papiers-texte.png')});
    await p.fill('.pap-search', ''); await p.waitForTimeout(200);
    await p.evaluate(() => [...document.querySelectorAll('.pt')].find((b) => /Logement/.test(b.textContent)).click()); await p.waitForTimeout(500);
    ok('papiers : un dossier montre ses sous-dossiers en sections', await p.evaluate(() => document.querySelectorAll('.pap-sec').length >= 3 && /Logement/.test(document.querySelector('.pap-h').textContent) && !/\[object/.test(document.getElementById('view').innerText)));
    await p.screenshot({path: path.join(SH, 'papiers.png')});
    p = await page('#papiers');
    await p.evaluate(() => document.querySelector('.pap-priv').click()); await p.waitForTimeout(800);
    ok('papiers : papiers privés affichés à la demande (gardé dans le téléphone)', await p.evaluate(() => [...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === 'Papiers privés') && localStorage.getItem('jarvis.papiers.prive') === '1'));
    ok('papiers : dates de validité de Pilotage gardées, avec leurs gestes (venus de Suivi)', await p.evaluate(() => !!document.querySelector('.pap-dates') && document.querySelectorAll('.pap-dates .card').length > 0 && /Où est-il/.test(document.querySelector('.pap-dates').textContent) && !document.querySelector('.pap-dates input')));
    /* voyages plus riches (16/11/2026) : Wikipédia et Open-Meteo simulés, aucun appel réel */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('voyages : ' + e.message));
      await q.route('https://fr.wikipedia.org/**', (r) => r.fulfill({status: 200, headers: {'access-control-allow-origin': '*'}, contentType: 'application/json', body: JSON.stringify({type: 'standard', originalimage: {source: 'https://photo.essai/img.png', width: 960}})}));
      await q.route('https://photo.essai/**', (r) => r.fulfill({status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'icon-192.png'))}));
      await q.route('https://geocoding-api.open-meteo.com/**', (r) => r.fulfill({status: 200, headers: {'access-control-allow-origin': '*'}, contentType: 'application/json', body: JSON.stringify({results: [{name: new URL(r.request().url()).searchParams.get('name') || 'Tunis', latitude: 36.8, longitude: 10.18}]})}));
      await q.route('https://archive-api.open-meteo.com/**', (r) => r.fulfill({status: 200, headers: {'access-control-allow-origin': '*'}, contentType: 'application/json', body: JSON.stringify({daily: {time: Array.from({length: 16}, (_, i) => '2026-03-' + String(5 + i).padStart(2, '0')), temperature_2m_max: Array(16).fill(19), temperature_2m_min: Array(16).fill(11), precipitation_sum: [0, 0, 3, 0, 0, 0, 1.5, 0, 0, 0, 0, 0, 0, 2, 0, 0]}})}));
      await q.goto(base + '#voyages'); await q.waitForTimeout(3500);
      ok('voyages : photo de la destination en bandeau sur chaque projet', await q.evaluate(() => document.querySelectorAll('.voy .vh').length >= 2 && document.querySelectorAll('.voy .vh.has-img').length >= 1));
      await q.evaluate(() => document.querySelector('.voy .fam-hit').click()); await q.waitForTimeout(1200);
      ok('voyage : photo en grand, carte d\'embarquement, carnet à préparer', await q.evaluate(() => !!document.querySelector('.vh.is-big h2') && /TUNIS/i.test(document.querySelector('.vh-k').textContent) && !!document.querySelector('.vp-codes') && !!document.querySelector('.cn-cta .btn')));
      ok('voyage : météo attendue (l\'an dernier aux mêmes dates)', await q.evaluate(() => { const c = document.querySelector('.clim'); return !!c && !c.hidden && /11° à 19°/.test(c.textContent) && /3 jours de pluie/.test(c.textContent); }));
      await q.evaluate(() => document.querySelector('.cn-cta .btn').click()); await q.waitForTimeout(1200);
      ok('voyage : carnet préparé par Claude (temps forts, itinéraire, à savoir)', await q.evaluate(() => document.querySelectorAll('.tf').length >= 4 && document.querySelectorAll('.it > li').length >= 3 && document.querySelectorAll('.as li').length >= 3 && (window.__samples || []).some((x) => /agent de voyage/.test(x.first))));
      await q.screenshot({path: path.join(SH, 'voyage.png'), fullPage: true});
      await q.reload(); await q.waitForTimeout(3000); await q.evaluate(() => document.querySelector('.voy .fam-hit').click()); await q.waitForTimeout(800);
      ok('voyage : carnet gardé dans le téléphone', await q.evaluate(() => document.querySelectorAll('.tf').length >= 4 && !document.querySelector('.cn-cta')));
      await q.reload(); await q.waitForTimeout(3000);
      await q.evaluate(() => document.querySelectorAll('.voy .fam-hit')[1].click()); await q.waitForTimeout(800);
      ok('voyage : budget par poste face au maximum', await q.evaluate(() => document.querySelectorAll('.bd-l li').length >= 2 && /Total .*reste/.test(document.querySelector('.bd-t').textContent) && !!document.querySelector('.bd-max')));
      await ctx.close(); }
    p = await page('#voyages');
    await p.evaluate(() => document.querySelector('.voy .fam-hit').click()); await p.waitForTimeout(800);
    ok('voyage sans réseau : la page reste entière (photo de secours, pas de météo)', await p.evaluate(() => !!document.querySelector('.vh.is-big') && !!document.querySelector('.vp-codes')));
    /* check-up du 16/11/2026 : défauts 1 à 13 corrigés */
    p = await page('#equipe');
    await p.evaluate(() => document.querySelector('.team .mate').click()); await p.waitForTimeout(800);
    ok('check-up : page d\'un bot, prochain passage calculé (jamais une date passée)', await p.evaluate(() => { const d = [...document.querySelectorAll('.pgrid > div')].find((x) => /Prochain passage/.test(x.textContent)); return !!d && /^(aujourd'hui|demain|lun|mar|mer|jeu|ven|sam|dim|\d\d\/\d\d) \d\dh\d\d · /.test(d.querySelector('dd').textContent); }));
    ok('check-up : « Toi » dans le fil d\'un bot, « en attente du … »', await p.evaluate(() => { const t = document.getElementById('view').innerText; return !/\brabie →/.test(t) && !/en attente de (le|les) /.test(t) && /Toi → /.test(t); }));
    ok('check-up : page profonde, la date laisse la place au logo', await p.evaluate(() => getComputedStyle(document.getElementById('today')).display === 'none' && document.querySelector('.brand').scrollWidth <= document.querySelector('.brand').clientWidth + 1));
    p = await page('#automatisations');
    ok('check-up : automatisations, dernier passage repris de l\'onglet État', await p.evaluate(() => !/pas encore vu dans le journal/.test(document.querySelector('.auto.card').textContent)));
    ok('check-up : en-tête qui défile avec un fondu au lieu d\'être coupé', await p.evaluate(() => { const s = document.getElementById('status'); return getComputedStyle(s).overflowX === 'auto' && (s.scrollWidth <= s.clientWidth + 2 || s.classList.contains('is-more')); }));
    p = await page('');
    ok('check-up : frise, aucun repère horaire sous l\'heure actuelle', await p.evaluate(() => { const n = document.querySelector('.tl-now small').getBoundingClientRect(); return [...document.querySelectorAll('.tl-tick small')].every((t) => { const r = t.getBoundingClientRect(); return r.right < n.left || r.left > n.right; }); }));
    ok('check-up : texte secondaire lisible (gris assez clair)', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dim').trim().toLowerCase() === '#8aa9d1'));
    await p.tap('.talk-slot .jv-btn'); await p.waitForTimeout(900);
    ok('check-up : la discussion ouverte par l\'orbe dans les polices de la charte (plus d\'Inter)', await p.evaluate(() => { const els = [...document.querySelectorAll('#chat, #chat *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())); return els.length > 5 && els.every((e) => /^("?Exo 2|"?Oxanium|Orbitron)/.test(getComputedStyle(e).fontFamily)); }));
    p = await page('#demandes');
    /* 17/11/2026 : routine conforme à la fiche → « Oui depuis JARVIS » (ligne Réponse + sonnette) ; le reste garde la phrase à coller */
    ok('oui : « Oui depuis JARVIS » pour une demande de routine (carte seule), phrase à coller pour les oui groupés d\'Argus', await p.evaluate(() => { const u = [...document.querySelectorAll('.pm-card')].find((c) => /Ulysse/.test(c.textContent) && /Ton oui/i.test(c.textContent)), a = [...document.querySelectorAll('.card.item')].find((c) => c.querySelector('.yes-l') && /Argus/.test(c.textContent)); const b = u && [...u.querySelectorAll('.pm-row .btn')].find((x) => /^Oui depuis JARVIS/.test(x.textContent)); return !!b && /1 passage|à la reprise/.test(b.textContent) && !!a && !a.querySelector('.yes-jarvis') && /Copier/.test(a.textContent) && ![...document.querySelectorAll('.card.item')].some((c) => c.querySelector('.yes-l') && /Ulysse/.test(c.textContent)); }));
    await p.evaluate(() => { const u = [...document.querySelectorAll('.pm-card')].find((c) => /Ulysse/.test(c.textContent) && /Ton oui/i.test(c.textContent)); [...u.querySelectorAll('.pm-row .btn')].find((x) => /^Oui depuis JARVIS/.test(x.textContent)).click(); }); await p.waitForTimeout(1200);
    const ysheet = await p.evaluate(() => (document.getElementById('sheet').hidden ? '' : document.getElementById('sheet').textContent) + ' ' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' '));
    await p.waitForTimeout(5600);
    ok('oui depuis JARVIS : une ligne pour Ulysse dans le Canal (5 s pour annuler), la demande quitte la liste', /une ligne pour Ulysse dans le Canal/.test(ysheet) && await p.evaluate(() => ![...document.querySelectorAll('.pm-card')].some((c) => /Ulysse/.test(c.textContent) && /Ton oui/i.test(c.textContent))), ysheet.slice(0, 160));
    ok('check-up : phrase des oui groupés sans police machine à écrire', await p.evaluate(() => [...document.querySelectorAll('.yes-p')].every((e) => /Exo 2/.test(getComputedStyle(e).fontFamily))));
    /* doublons 14 à 16 (choix du 16/11/2026) */
    p = await page('#achats');
    /* 0.87.0 : Achats en un seul filtre (À décider, Suivis, Idées, Achetés) ; le doublon 14 tient toujours : le produit à décider n'est que sous « À décider » */
    ok('doublon 14 : le produit à décider est sous « À décider » (le filtre ouvert), pas répété sous « Suivis »', await p.evaluate(() => { const pn = (t) => [...document.querySelectorAll('#view .panel')].find((x) => x.querySelector('h2').textContent.trim() === t); const top = pn('À décider maintenant'), all = pn('Suivis'); const nm = (c) => (c.querySelector('b') || {}).textContent; const hot = [...top.querySelectorAll('.fam')].map(nm); return hot.length > 0 && !top.hidden && !!all && all.hidden && ![...all.querySelectorAll('.fam')].some((c) => hot.includes(nm(c))); }));
    await p.evaluate(() => document.querySelector('#view .dm-seg [data-f="suivi"]').click()); await p.waitForTimeout(400);
    ok('0.87 : Achats, « Suivis » : les autres produits, sans le filtre d’avant ni le renvoi « affiché plus haut » ; « À décider » caché', await p.evaluate(() => { const pn = (t) => [...document.querySelectorAll('#view .panel')].find((x) => x.querySelector('h2').textContent.trim() === t); const all = pn('Suivis'), top = pn('À décider maintenant'); return !!all && !all.hidden && all.querySelectorAll('.fam').length > 0 && !all.querySelector(':scope > .seg, .ach-up') && !!top && top.hidden && document.querySelectorAll('#view .dm-seg').length === 1; }));
    p = await page('#voyages');
    await p.evaluate(() => document.querySelector('.voy .fam-hit').click()); await p.waitForTimeout(800);
    ok('doublon 15 : « Valider ces dates » une seule fois, le conseil renvoie aux dates proposées', await p.evaluate(() => [...document.querySelectorAll('#view button')].filter((x) => /Valider ces dates/.test(x.innerText)).length === 1 && !!document.querySelector('.verdict .verdict-go') && !!document.getElementById('plan-dates')));
    p = await page('#espaces');   /* refonte UX : plus de Suivi ; Papiers est une tuile d'Espaces */
    ok('doublon 16 : Papiers est une tuile d’Espaces (plus de ligne dans Suivi) ; Équipe sans dépôt ; Papiers avec le dépôt', await p.evaluate(() => /suivis?/.test((document.querySelector('.esp-tile[data-go="papiers"]') || {}).textContent || '') && !document.querySelector('#view .pap-search')) && await (async () => { const q = await page('#suivi'); const e = await q.evaluate(() => ![...document.querySelectorAll('#view .panel h2')].some((x) => /Déposer un document/.test(x.textContent))); const r = await page('#papiers'); return e && await r.evaluate(() => [...document.querySelectorAll('#view .panel h2')].some((x) => /Déposer un document/.test(x.textContent))); })());
    /* marges d'un vrai iPhone (capture du 17/11/2026) : barre d'état 59 px, barre d'accueil 34 px. L'en-tête ne cache plus le haut de la page. */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('marges : ' + e.message));
      const c = await ctx.newCDPSession(q); await c.send('Emulation.setSafeAreaInsetsOverride', {insets: {top: 59, bottom: 34, left: 0, right: 0}});
      await q.goto(base + '?theme=holo#accueil'); await q.waitForTimeout(3000);
      const m = await q.evaluate(() => { const t = document.querySelector('.top').getBoundingClientRect(), v = document.getElementById('view'), first = {getBoundingClientRect: () => ({top: v.getBoundingClientRect().top + parseFloat(getComputedStyle(v).paddingTop || '0')})}, fav = document.querySelector('.fav-bar').getBoundingClientRect();
        return {top: Math.round(t.top), bottom: Math.round(t.bottom), first: Math.round(first.getBoundingClientRect().top), fav: Math.round(fav.bottom), ih: innerHeight}; });
      ok('iPhone réel : l\'en-tête sous la zone floutée par iOS (1,4 × la barre d\'état : 83 px) ne cache pas le haut de la page ; barre du bas au ras de l\'écran', m.top === 83 && m.first >= m.bottom && m.fav === m.ih, JSON.stringify(m));
      await q.evaluate(() => { document.getElementById('scroller').scrollTop = 400; }); await q.waitForTimeout(300);
      ok('iPhone réel : en défilant, l\'en-tête reste sous la zone floutée, sur une bande opaque', await q.evaluate(() => Math.round(document.querySelector('.top').getBoundingClientRect().top) === 83 && Math.round(parseFloat(getComputedStyle(document.body, '::before').height)) === 83));
      await ctx.close(); }
    /* 17/11/2026 (captures du propriétaire) : bouton rouge lisible en thème Hologramme ; notification fermée d'un appui */
    { p = await page('?theme=holo#equipe');
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
      const st = await p.evaluate(() => { const b = document.createElement('button'); b.className = 'btn danger-fill'; b.textContent = 'Oui : supprimer'; document.body.append(b); const cs = getComputedStyle(b); const r = {fg: cs.color, bg: cs.backgroundImage !== 'none' ? (cs.backgroundImage.match(/rgba?\([^)]+\)/) || [cs.backgroundColor])[0] : cs.backgroundColor}; b.remove(); return r; });
      const L1 = lum(st.fg), L2 = lum(st.bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      ok('Hologramme : « Oui : supprimer » lisible (contraste ≥ 3)', ratio >= 3, JSON.stringify(st) + ' ' + ratio.toFixed(2));
      await p.evaluate(() => { const b = document.querySelector('.ux-seg [data-f="dem"]'); if (b) b.click(); }); await p.waitForTimeout(500);   /* refonte UX : tes ordres sont sous « Demandes » */
      await p.evaluate(() => [...document.querySelectorAll('.panel')].find((x) => x.querySelector('h2') && /^Tes ordres/.test(x.querySelector('h2').textContent)).querySelector('.canal-row').click()); await p.waitForTimeout(700);
      for (let k = 0; k < 3 && !(await p.$('#toasts .toast')); k++) { await p.evaluate(() => { const b = document.querySelector('#sheet:not([hidden]) .sa-main .btn, #sheet:not([hidden]) .btn.main'); if (b) b.click(); }); await p.waitForTimeout(900); }
      const had = !!(await p.$('#toasts .toast'));
      if (had) { await p.click('#toasts .toast .toast-x'); await p.waitForTimeout(450); }
      ok('notification de la page : croix « Fermer », fermée tout de suite', had && await p.evaluate(() => !document.querySelector('#toasts .toast:not(.out)')), 'toast vu : ' + had); }
    /* glisser vers le bas ferme la fenêtre (demande du 16/11/2026) : vrais gestes tactiles */
    { const drag = async (q, x, y, dx, dy, ms) => { const c = await q.context().newCDPSession(q); await c.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y}]}); for (let i = 1; i <= 8; i++) { await c.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x + dx * i / 8, y: y + dy * i / 8}]}); await q.waitForTimeout(ms / 8); } await c.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await q.waitForTimeout(900); };
      p = await page('#agenda'); await p.tap('.agw-d'); await p.waitForTimeout(700);
      /* attendre la fin de l'animation d'ouverture : sinon le point de départ, mesuré trop tôt, tombe sur le champ du bas (où le geste est ignoré exprès) */
      await p.waitForFunction(() => { const s = document.getElementById('sheet'), t = s.getBoundingClientRect().top; const ok = s.classList.contains('on') && t < innerHeight * 0.6 && window.__sheetTop === t; window.__sheetTop = t; return ok; }, null, {polling: 150, timeout: 5000});
      const box = await p.evaluate(() => { const r = document.getElementById('sheet').getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + 40, tag: (document.elementFromPoint(r.left + r.width / 2, r.top + 40) || {}).tagName}; });
      await drag(p, box.x, box.y, 0, 35, 500);
      const shortOk = await p.evaluate(() => !document.getElementById('sheet').hidden && !document.getElementById('sheet').style.transform);
      await drag(p, box.x - 80, box.y + 30, 170, 15, 300);
      const sideOk = await p.evaluate(() => !document.getElementById('sheet').hidden);
      await drag(p, box.x, box.y, 0, 220, 350);
      /* boutons d'une feuille tous pareils (retour du 17/11/2026) */
      { const q = await page('#demandes');
        await q.evaluate(() => { const c = [...document.querySelectorAll('article')].find((x) => /Passeport/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }); await q.waitForTimeout(900);
        const m = await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => { const r = x.getBoundingClientRect(), cs = getComputedStyle(x), c = x.querySelector('.cost'); return {rad: cs.borderRadius, pl: cs.paddingLeft, gap: c ? r.right - c.getBoundingClientRect().right : 0}; }));
        ok('feuille : boutons de même forme et même marge, coût calé à droite', m.length >= 5 && new Set(m.map((x) => x.rad + x.pl)).size === 1 && m.every((x) => x.gap <= 40), JSON.stringify(m)); }
      ok('glisser : la feuille du bas se ferme (pas sur un petit glissé ni un glissé de côté)', shortOk && sideOk && await p.evaluate(() => document.getElementById('sheet').hidden), shortOk + ' ' + sideOk + ' ' + box.tag);
      p = await page(''); await p.evaluate(() => document.querySelector('.talk-slot .jv-btn').click()); await p.waitForTimeout(900);   /* 0.87.0 : l'orbe de la barre (plus de bouton « Parler à JARVIS ») */
      const opened = await p.evaluate(() => !document.getElementById('chat').hidden);
      await drag(p, 215, 40, 0, 260, 350);
      ok('glisser : la discussion se ferme d\'un glissé vers le bas', opened && await p.evaluate(() => document.getElementById('chat').hidden));
      await p.tap('.talk-slot .jv-btn'); await p.waitForTimeout(900);
      const vOpen = await p.evaluate(() => !document.getElementById('chat').hidden);
      await drag(p, 215, 40, 0, 260, 350);
      ok('glisser : la discussion ouverte par l\'orbe se ferme d\'un glissé vers le bas', vOpen && await p.evaluate(() => document.getElementById('chat').hidden)); }
    /* Face ID pour les papiers privés (0.14.0) : authentificateur virtuel du navigateur, sur « localhost » (Face ID refuse une adresse IP) */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('faceid : ' + e.message));
      const cdp = await ctx.newCDPSession(q); await cdp.send('WebAuthn.enable'); await cdp.send('WebAuthn.addVirtualAuthenticator', {options: {protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true}});
      const lb = base.replace('127.0.0.1', 'localhost');
      await q.goto(lb + '#papiers'); await q.waitForTimeout(2500);
      await q.evaluate(() => document.querySelector('.face-set').click()); await q.waitForTimeout(1200);
      const on = await q.evaluate(() => !!localStorage.getItem('jarvis.faceid') && !!document.querySelector('.face-note'));
      await q.evaluate(() => localStorage.setItem('jarvis.papiers.prive', '1')); await q.reload(); await q.waitForTimeout(2800);
      const locked = await q.evaluate(() => !!document.querySelector('.face-open') && ![...document.querySelectorAll('.hm-h')].some((x) => /Papiers privés/.test(x.textContent) && x.parentElement.querySelector('.pt')));
      await q.evaluate(() => document.querySelector('.face-open').click()); await q.waitForTimeout(1200);
      const open = await q.evaluate(() => !document.querySelector('.face-open') && [...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === 'Papiers privés') && document.querySelectorAll('.pt').length > 8);
      ok('Face ID : activé dans Papiers, papiers privés verrouillés au retour, ouverts après Face ID', on && locked && open, [on, locked, open].join(' '));
      await ctx.close(); }
    // 0.73.0 — B1-page-1-2
    /* 0.73.0 — B1-page-1-2 (fiabilité et petits conforts) : jour qui change, boutons qui ouvrent un lien, erreurs de la discussion, échéances
       et dossiers, Papiers (lecture en échec, réponse en retard, clavier, Face ID), Radar, Achats, adresses, sphères. Données inventées. */
    { const p2 = (n) => String(n).padStart(2, '0'), frD = (n, an) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); if (an) d.setFullYear(d.getFullYear() + an); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); };
      const isoD = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
      const vis = (q, hd) => q.evaluate((x) => { Object.defineProperty(document, 'hidden', {configurable: true, get: () => x}); Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => (x ? 'hidden' : 'visible')}); document.dispatchEvent(new Event('visibilitychange')); }, hd);
      /* page-1#1, page-2#4, page-4#2 : app ouverte lundi 23h59, reprise mardi 8h, sans rechargement par iOS */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 jour : ' + e.message));
        await q.clock.setFixedTime(new Date('2026-11-23T23:59:00')); await q.goto(base); await q.waitForTimeout(3000);
        const jour = () => q.evaluate(() => ({mark: window.__b1jour || 0, hud: (document.querySelector('.hud-date') || {}).textContent || '', today: document.getElementById('today').textContent, sheet: !document.getElementById('sheet').hidden}));
        await q.evaluate(() => { window.__b1jour = 1; }); const j0 = await jour();
        await q.evaluate(() => document.querySelector('#status .st.is-pause').click()); await q.waitForTimeout(500);
        await vis(q, true); await q.clock.setFixedTime(new Date('2026-11-24T08:00:00')); await vis(q, false); await q.waitForTimeout(2000);
        const j1 = await jour();
        await q.keyboard.press('Escape'); await q.waitForTimeout(500); await vis(q, true); await vis(q, false); await q.waitForTimeout(3500);
        const j2 = await jour();
        ok('0.73.0 — B1 : app restée ouverte passé minuit, reprise le matin : pas rechargée sous une feuille ouverte ; au retour suivant, rechargée sur le nouveau jour (« Mardi 24 novembre », plus lundi 23)', /lundi 23 novembre/i.test(j0.hud) && j1.mark === 1 && j1.sheet && j2.mark === 0 && /mardi 24 novembre/i.test(j2.hud), JSON.stringify([j0, j1, j2]));
        /* une écriture « Dans 5 s » en attente quand l'app passe derrière : le rechargement attend qu'elle soit partie */
        await q.evaluate(() => { window.__b1jour = 2; document.getElementById('gs-btn').click(); }); await q.waitForTimeout(300); await q.fill('#gs-in', 'attestation école'); await q.waitForTimeout(400);
        await q.evaluate(() => { const r = [...document.querySelectorAll('#gsearch .gs-row')].find((y) => /Envoyer l.attestation/.test(y.textContent)); if (r) r.click(); }); await q.waitForTimeout(1500);
        await q.evaluate(() => { const x = [...document.querySelectorAll('#sheet button')].find((y) => /^C'est fait/.test(y.textContent.trim())); if (x) x.click(); }); await q.waitForTimeout(400);
        await vis(q, true); await q.clock.setFixedTime(new Date('2026-11-25T08:00:00')); await vis(q, false); await q.waitForTimeout(2000);
        const w1 = await jour(); await q.waitForTimeout(5000);
        const w2 = await q.evaluate(() => ({mark: window.__b1jour || 0, ecrit: (window.__calls || []).some((c) => c.tool === 'update_values' && /^'?Échéances'?!/.test(c.input.range || '') && /"Fait"/.test(JSON.stringify(c.input.values)))}));
        await q.waitForTimeout(23000); const w3 = await jour();
        ok('0.73.0 — B1 : une écriture « Dans 5 s » encore en attente au changement de jour : la page attend qu’elle soit partie (statut « Fait » écrit), puis se recharge sur le nouveau jour', w1.mark === 2 && w2.mark === 2 && w2.ecrit && w3.mark === 0 && /\b25\b/.test(w3.today) && /nov/.test(w3.today), JSON.stringify([w1, w2, w3]));
        await ctx.close(); }
      /* page#3 : une question tapée dans la discussion, puis la discussion fermée sans l'envoyer (le brouillon est gardé hors du champ) :
         passé minuit, le retour ne recharge pas la page et le texte reste ; une fois vidé, le retour suivant passe au nouveau jour */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 brouillon : ' + e.message));
        await q.clock.setFixedTime(new Date('2026-11-23T23:50:00')); await q.goto(base + '#accueil'); await q.waitForTimeout(3000);
        await q.evaluate(() => { window.__b1jour = 3; });
        await q.tap('.talk-slot .jv-btn'); await q.waitForTimeout(900); await q.fill('#chat-in', 'Une longue question pour Claude, pas encore envoyée (essai)'); await q.keyboard.press('Escape'); await q.waitForTimeout(600);
        const ferme = await q.evaluate(() => document.getElementById('chat').hidden);
        await vis(q, true); await q.clock.setFixedTime(new Date('2026-11-24T08:00:00')); await vis(q, false); await q.waitForTimeout(2500);
        const d1 = await q.evaluate(() => ({mark: window.__b1jour || 0, brouillon: (document.getElementById('chat-in') || {}).value || ''}));
        await q.evaluate(() => { const c = document.getElementById('chat-in'); if (c) c.value = ''; }); await vis(q, true); await vis(q, false); await q.waitForTimeout(3500);
        const d2 = await q.evaluate(() => ({mark: window.__b1jour || 0, hud: (document.querySelector('.hud-date') || {}).textContent || ''}));
        ok('0.73.0 — B1 : un brouillon laissé dans la discussion fermée, passé minuit : pas de rechargement au retour, le texte reste ; vidé, la page passe au nouveau jour au retour suivant',
          ferme && d1.mark === 3 && /longue question/.test(d1.brouillon) && d2.mark === 0 && /mardi 24 novembre/i.test(d2.hud), JSON.stringify([ferme, d1, d2]));
        await ctx.close(); }
      /* échéances, dossiers, liens, page d'un bot, Achats, Papiers, adresses : sur les données d'exemple en direct, plus quelques lignes inventées */
      { const q = await page('#agenda'); const e0 = errs.length;
        await q.evaluate((r) => { const G = window.__G;
          G['Échéances'].push([r.d3, "Renouveler l'assurance habitation (essai)", 'Famille', '', 'À venir', 'Iris', '', 'À faire par moi'], [r.dm5, 'Fin de validité du badge (essai)', 'Papiers', '', 'À venir', 'Iris', '', 'Fin de validité']);
          G['Dossiers'].push(['Dossier sans date (essai)', 'En attente', 'Attendre la réponse', '', 'le syndic', '', '', 'Iris', '', ''], ['Toit qui fuit (essai)', 'En attente', 'Attendre la réponse', '', 'le syndic', r.dm12, '', 'Iris', r.dm12, '']);
          G['Canal'].push([r.d0, 'Iris', 'Tous', 'Question', 'Une question pour toute l’équipe (essai).', 'Fait', 'Réponse d’essai pour toute l’équipe.', '']);
          G['Prix'].push(['Bouilloire Essai Z', '', '', '', '', 'Fnac', '', '45', r.d0 + ' 09h00', 'Fnac', 'Suivi', '', '']);
          window.__ouv = []; window.open = (u) => { window.__ouv.push(String(u)); return null; };
          location.hash = '#voir-recent'; }, {d0: frD(0), d3: frD(3), dm5: frD(-5), dm12: frD(-12)});
        await q.waitForTimeout(2500); await q.evaluate(() => { location.hash = '#agenda'; }); await q.waitForTimeout(1200);
        const ouvre = async (cherche, ligne) => { await q.keyboard.press('Escape'); await q.waitForTimeout(250); await q.evaluate(() => document.getElementById('gs-btn').click()); await q.waitForTimeout(300); await q.fill('#gs-in', cherche); await q.waitForTimeout(400);
          await q.evaluate((x) => { const r = [...document.querySelectorAll('#gsearch .gs-row')].find((y) => y.textContent.includes(x)); if (r) r.click(); }, ligne); await q.waitForTimeout(2600);
          return q.evaluate(() => { const s = document.getElementById('sheet'); return s.hidden ? null : {say: (s.querySelector('.sheet-say') || {}).textContent || '', smart: (s.querySelector('.smart') || {}).textContent || '', txt: s.innerText.replace(/\s+/g, ' '), btns: [...s.querySelectorAll('button')].map((x) => x.textContent.trim())}; }); };
        const clic = (re) => q.evaluate((src) => { const r = new RegExp(src), x = [...document.querySelectorAll('#sheet button')].find((y) => r.test(y.textContent.trim())); if (x) x.click(); return !!x; }, re);
        /* page-1#8 : une date passée se dit au passé */
        const s1 = await ouvre('attestation école', "Envoyer l'attestation");
        ok('0.73.0 — B1 : une échéance « à faire par moi » en retard se dit au passé (« C’est à toi de jouer : en retard de 2 jours. », plus « …, il y a 2 jours »)', !!s1 && s1.say === "C'est à toi de jouer : en retard de 2 jours.", JSON.stringify(s1 && s1.say));
        /* page-1#7 : pas de « Fin de validité dans -5 j » */
        const s2 = await ouvre('badge essai', 'badge');
        ok('0.73.0 — B1 : une fin de validité passée n’a plus de conseil « Fin de validité dans -5 j » ; la feuille dit « Expirée depuis le… »', !!s2 && !/-\d/.test(s2.smart) && /Expirée depuis le/.test(s2.say), JSON.stringify(s2 && [s2.smart, s2.say]));
        /* page-1#9 : dossier sans date de dernier contact, et « du syndic » */
        const s3 = await ouvre('Dossier sans date', 'Dossier sans date');
        const s4 = await ouvre('Toit qui fuit', 'Toit qui fuit');
        ok('0.73.0 — B1 : dossier sans « Dernier contact » : ni « depuis 0 jours », ni date inventée, ni conseil ; un dossier vieux de 12 jours : « Sans nouvelles du syndic depuis 12 jours »', !!s3 && s3.say === "J'attends le syndic." && !/\b[01] jours|depuis le/.test(s3.txt) && !s3.smart && !!s4 && /Sans nouvelles du syndic depuis 12 jours/.test(s4.smart), JSON.stringify([s3 && [s3.say, s3.smart], s4 && s4.smart]));
        /* page-1#2 : « Ouvrir le document » et « Voir l'offre » ouvrent le lien ; sans lien, pas de bouton qui ne fait rien */
        const s5 = await ouvre('validité attestation assurance', "validité de l'attestation"); const o5 = await clic('^Ouvrir le document'); await q.waitForTimeout(400);
        const s6 = await ouvre('Robot Alpha offre lancement', 'offre de lancement'); const o6 = await clic("^Voir l'offre"); await q.waitForTimeout(400);
        const s7 = await ouvre('Black Friday', 'Black Friday');
        const ouv = await q.evaluate(() => window.__ouv.slice());
        ok('0.73.0 — B1 : « Ouvrir le document » (fin de validité) ouvre le lien Drive du papier ; « Voir l’offre » ouvre la page du vendeur du prix suivi ; une offre sans lien n’a plus de « Voir l’offre » qui ne fait rien', !!s5 && o5 && !!s6 && o6 && ouv[0] === 'https://drive.google.com/file/d/abc/view' && ouv[1] === 'https://example.org/x7' && !!s7 && !s7.btns.some((x) => /^Voir l'offre/.test(x)), JSON.stringify([o5, o6, ouv, s7 && s7.btns]));
        /* page-1#4 : « Prévoir la prochaine » ajoute une ligne neuve dans Échéances (même jour l'an prochain), sans ligne Canal ni écriture sur l'ancienne */
        await ouvre('Renouveler assurance habitation', 'Renouveler'); const c0 = await q.evaluate(() => window.__calls.length);
        const f1 = await clic("^C'est fait"); await q.waitForTimeout(700); const f2 = await clic('^Prévoir la prochaine'); await q.waitForTimeout(6500);
        const nx = await q.evaluate((c0) => window.__calls.slice(c0).map((c) => ({tool: c.tool, range: c.input.range || '', v: JSON.stringify(c.input.values || '')})), c0);
        const app = nx.filter((c) => c.tool === 'append_values' && /Renouveler l'assurance habitation/.test(c.v));
        ok('0.73.0 — B1 : « C’est fait » puis « Prévoir la prochaine » : une ligne neuve dans Échéances, le même jour l’an prochain, et aucune ligne Canal pour le bot', f1 && f2 && app.length === 1 && /^'?Échéances'?!A1/.test(app[0].range) && app[0].v.includes(frD(3, 1)) && /À venir/.test(app[0].v), JSON.stringify(nx));
        /* page-2#5 : une ligne du Canal pour « Tous » ne fait plus planter la page d'Iris */
        await q.keyboard.press('Escape'); await q.evaluate(() => { location.hash = '#equipe'; }); await q.waitForTimeout(1200);
        await q.evaluate(() => { const f = document.querySelector('.ux-seg [data-f="bots"]'); if (f) f.click(); }); await q.waitForTimeout(700);
        await q.evaluate(() => { const m = [...document.querySelectorAll('.team .mate')].find((x) => x.querySelector('b').textContent === 'Iris'); if (m) m.click(); }); await q.waitForTimeout(1200);
        ok('0.73.0 — B1 : la page d’Iris s’ouvre même avec une ligne du Canal « Pour : Tous » qui a une réponse (« Réponse de Tous »)', await q.evaluate(() => /Iris/.test(document.getElementById('view-title').textContent) && /Réponse de Tous/.test(document.getElementById('view').textContent)) && errs.length === e0, errs.slice(e0).join(' | '));
        /* page-2#10 : un produit sans seuils */
        await q.evaluate(() => { location.hash = '#achats'; }); await q.waitForTimeout(1500);
        const bo = await q.evaluate(() => { const c = [...document.querySelectorAll('#view .fam')].find((x) => /Bouilloire/.test(x.textContent)); return c ? {g: !!c.querySelector('.gauge'), t: c.innerText.replace(/\s+/g, ' ')} : null; });
        ok('0.73.0 — B1 : un produit suivi sans seuils : pas de jauge « Achat ≤ 0,00 € », et « Seuils pas encore fixés » au lieu de « Au-dessus de tes seuils »', !!bo && !bo.g && /Seuils pas encore fixés/.test(bo.t) && !/≤ 0,00|Au-dessus de tes seuils/.test(bo.t), JSON.stringify(bo));
        /* page-1#2 : « Ouvrir » d'un papier de Pilotage ouvre son lien Drive */
        await q.evaluate(() => { location.hash = '#papiers'; }); await q.waitForTimeout(1500);
        const op = await q.evaluate(() => { window.__ouv = []; const c = [...document.querySelectorAll('.pap-dates .card')].find((x) => /Attestation assurance/.test(x.textContent)); const bt = c && [...c.querySelectorAll('button')].find((y) => /^Ouvrir/.test(y.textContent.trim()) && !/^Ouvrir le/.test(y.textContent.trim())); if (bt) bt.click(); return !!bt; });
        await q.waitForTimeout(500);
        const op2 = await q.evaluate(() => ({ouv: window.__ouv.slice(), toast: document.getElementById('toasts').textContent}));
        ok('0.73.0 — B1 : Papiers, « Ouvrir » ouvre le lien Drive de l’onglet Papiers (plus seulement « Document ouvert : rien à écrire »)', op && op2.ouv.length === 1 && op2.ouv[0] === 'https://drive.google.com/file/d/abc/view' && !/Rien à écrire/.test(op2.toast), JSON.stringify(op2));
        /* page-2#14 : « 1 suivi » */
        await q.evaluate(() => { window.__G['Papiers'].splice(2); location.hash = '#voir-recent'; }); await q.waitForTimeout(2500); await q.evaluate(() => { location.hash = '#espaces'; }); await q.waitForTimeout(1200);
        ok('0.73.0 — B1 : Espaces, un seul papier suivi : « 1 suivi » (plus « 1 suivis »)', await q.evaluate(() => document.querySelector('.esp-tile[data-go="papiers"] .esp-v').textContent === '1 suivi'), await q.evaluate(() => document.querySelector('.esp-tile[data-go="papiers"] .esp-v').textContent));
        /* page-2#11 : « #__proto__ », « #constructor », « #toString » ne font plus planter le rendu */
        await q.context().close();
        const e1 = errs.length, q1 = await page('#__proto__');
        const a1 = await q1.evaluate(() => ({hud: !!document.querySelector('.hud'), t: document.getElementById('view-title').textContent}));
        await q1.context().close(); const q2 = await page('#constructor'); await q2.evaluate(() => { location.hash = '#toString'; }); await q2.waitForTimeout(800);
        const a2 = await q2.evaluate(() => ({hud: !!document.querySelector('.hud'), t: document.getElementById('view-title').textContent}));
        ok('0.73.0 — B1 : les adresses #__proto__, #constructor et #toString mènent à l’accueil, sans erreur ni titre « [object Object] »', a1.hud && a2.hud && !/object/i.test(a1.t + a2.t) && errs.length === e1, JSON.stringify([a1, a2, errs.slice(e1)]));
        await q2.context().close(); }
      /* page-1#3, pont-sw-voix#3, page-1#6 : la discussion (Claude simulé : un refus du serveur, puis deux échéances proposées) */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
        await ctx.addInitScript(() => { let c; Object.defineProperty(window, 'claude', {configurable: true, get: () => c, set: (v) => { const use0 = v.use; c = Object.assign({}, v, {use: async (n) => { const r = await use0(n); if (n !== 'sample' || !r) return r;
          const s = async (input, opts) => { const last = String((input[input.length - 1] || {}).content || '');
            if (/abonnement refus/.test(last)) throw {code: 'tool_error', message: 'Claude ne peut plus utiliser ton abonnement sur le serveur (essai) : vérifie la facturation.'};
            if (/promo du robot/.test(last)) { const t = (opts.tools || []).find((x) => x.name === 'ajouter_echeance');
              if (t) { await t.execute({sujet: 'Fin de la promo du robot (essai)', date: window.__b1iso, nature: 'Offre', remarque: 'vue en magasin'}); await t.execute({sujet: 'Inscription à la cantine (essai)', date: window.__b1iso, nature: 'Un bot s’en occupe', bot: 'Iris', remarque: 'avant la rentrée'}); }
              const tx = 'Je te propose ces deux échéances.'; if (opts.onText) opts.onText({text: tx, delta: tx}); return {text: tx}; }
            return r(input, opts); };
          return Object.assign(s, {limits: r.limits, json: r.json}); }}); }}); });
        const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 discussion : ' + e.message));
        await q.goto(base); await q.waitForTimeout(3500); await q.evaluate((iso) => { window.__b1iso = iso; }, isoD(7));
        await q.tap('.talk-slot .jv-btn'); await q.waitForTimeout(1000);
        const dern = () => q.evaluate(() => { const m = [...document.querySelectorAll('#chat .msg.them p')]; return m.length ? m[m.length - 1].textContent : ''; });
        await q.fill('#chat-in', 'Test : abonnement refusé ?'); await q.tap('#chat .chat-row .btn.main'); await q.waitForTimeout(1500);
        const r1 = await dern();
        ok('0.73.0 — B1 : discussion, le message français du serveur (abonnement refusé) est dit tel quel, plus « Réponse interrompue : réessaie. »', /ne peut plus utiliser ton abonnement sur le serveur \(essai\)/.test(r1) && !/interrompue/.test(r1), r1);
        await q.fill('#chat-in', 'Rappelle-moi la fin de la promo du robot'); await q.tap('#chat .chat-row .btn.main'); await q.waitForTimeout(1800);
        const pr = await q.evaluate(() => [...document.querySelectorAll('#chat .msg.proposal.is-act')].map((x) => x.innerText.replace(/\s+/g, ' ')));
        const c0 = await q.evaluate(() => window.__calls.length);
        await q.evaluate(() => { const x = [...document.querySelectorAll('#chat .msg.proposal.is-act')].find((y) => /promo du robot/.test(y.textContent)); if (x) x.querySelector('.btn.main').click(); }); await q.waitForTimeout(6500);
        const ap = await q.evaluate((c0) => window.__calls.slice(c0).filter((c) => c.tool === 'append_values' && /promo du robot/.test(JSON.stringify(c.input.values))).map((c) => c.input.values[0]), c0);
        ok('0.73.0 — B1 : outil ajouter_echeance, nature « Offre » (valeur de Pilotage) et « Un bot s’en occupe » (apostrophe typographique) reconnues ; l’offre arrive dans Échéances en « Offre », domaine Achats', pr.length === 2 && /Offre qui se termine/.test(pr[0]) && /Un bot s'en occupe/.test(pr[1]) && ap.length === 1 && ap[0].includes('Offre') && ap[0].includes('Achats') && !ap[0].includes('À faire par moi'), JSON.stringify([pr, ap]));
        await ctx.close(); }
      /* page-2#1 : une lecture du Drive en échec ne se relance plus en boucle ; « Réessayer » relance une fois */
      { const q = await pageWith({fail: {folder_tree: 'tool_error'}}, '#papiers');
        const n1 = await q.evaluate(() => window.__calls.filter((c) => c.tool === 'folder_tree').length), carte = await q.evaluate(() => !!document.querySelector('.pap-note') && /Réessayer/.test(document.querySelector('.pap-note').textContent));
        await q.evaluate(() => { const x = [...document.querySelectorAll('.pap-note button')].find((y) => /Réessayer/.test(y.textContent)); if (x) x.click(); }); await q.waitForTimeout(1500);
        const n2 = await q.evaluate(() => window.__calls.filter((c) => c.tool === 'folder_tree').length);
        ok('0.73.0 — B1 : Papiers, Drive illisible : une seule lecture (plus de boucle), la carte « Drive illisible » et « Réessayer » s’affichent ; « Réessayer » relance une seule lecture', n1 === 1 && carte && n2 === 2 && await q.evaluate(() => !!document.querySelector('.pap-note')), JSON.stringify([n1, carte, n2]));
        await q.context().close(); }
      /* page-2#13 et page-2#6 : l'arbre du Drive qui arrive pendant une recherche ne ferme pas le clavier ; une réponse arrivée en retard est ignorée */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
        await ctx.addInitScript(() => { window.__lent = {pub: 3000, prive: 0}; let c; Object.defineProperty(window, 'claude', {configurable: true, get: () => c, set: (v) => { const use0 = v.use; c = Object.assign({}, v, {use: async (n) => { const r = await use0(n); if (n !== 'mcp' || !r) return r;
          const ct = r.callTool; return Object.assign({}, r, {callTool: (sv, t, i) => { const pr = ct(sv, t, i); if (t !== 'folder_tree') return pr; const ms = ((i && i.roots) || []).some((x) => x.key === 'prive') ? window.__lent.prive : window.__lent.pub; return pr.then((x) => new Promise((z) => setTimeout(() => z(x), ms))); }}); }}); }}); });
        const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 papiers lents : ' + e.message));
        await q.goto(base + '#papiers'); await q.waitForTimeout(1500);
        const avant = await q.evaluate(() => { const i = document.querySelector('.pap-search'); i.__b1 = 1; i.focus(); return !document.querySelector('.pt:not(.is-ghost)'); });
        await q.keyboard.type('passeport', {delay: 40}); await q.waitForTimeout(3000);
        const kb = await q.evaluate(() => ({meme: !!(document.activeElement && document.activeElement.__b1 === 1), val: document.activeElement && document.activeElement.value, res: document.querySelectorAll('.pap-res .pf').length, tuiles: document.querySelectorAll('.pt:not(.is-ghost)').length}));
        ok('0.73.0 — B1 : Papiers, l’arbre du Drive arrive pendant la saisie : le champ garde le clavier (même élément, même texte) et les résultats s’affichent', avant && kb.meme && kb.val === 'passeport' && kb.res >= 3, JSON.stringify(kb));
        await q.evaluate(() => { document.activeElement.blur(); }); await q.fill('.pap-search', ''); await q.waitForTimeout(300);
        await q.evaluate(() => { window.__lent = {pub: 50, prive: 900}; document.querySelector('.pap-priv').click(); }); await q.waitForTimeout(150);
        await q.evaluate(() => document.querySelector('.pap-priv').click()); await q.waitForTimeout(1600);
        const pv = await q.evaluate(() => ({h: [...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === 'Papiers privés'), t: [...document.querySelectorAll('.pt b')].some((x) => /Impôts|Banque/.test(x.textContent)), lien: (document.querySelector('.pap-priv') || {}).textContent || ''}));
        ok('0.73.0 — B1 : Papiers, « Afficher » puis aussitôt « Masquer » les papiers privés : la lecture des privés arrivée en retard est ignorée (rien de privé affiché)', !pv.h && !pv.t && /Afficher les papiers privés/.test(pv.lien), JSON.stringify(pv));
        await ctx.close(); }
      /* page-2#2 : Face ID ne se contourne plus (recherche, recherche partout, « Retirer », dossier resté ouvert) */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 faceid : ' + e.message));
        const cdp = await ctx.newCDPSession(q); await cdp.send('WebAuthn.enable'); const {authenticatorId} = await cdp.send('WebAuthn.addVirtualAuthenticator', {options: {protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true}});
        const lb = base.replace('127.0.0.1', 'localhost');
        await q.goto(lb + '#papiers'); await q.waitForTimeout(2500);
        await q.evaluate(() => document.querySelector('.face-set').click()); await q.waitForTimeout(1200);
        await q.evaluate(() => localStorage.setItem('jarvis.papiers.prive', '1')); await q.reload(); await q.waitForTimeout(2800);
        await q.fill('.pap-search', 'impot'); await q.waitForTimeout(500);
        const f1 = await q.evaluate(() => document.querySelectorAll('.pap-res .pf').length);
        await q.fill('.pap-search', ''); await q.waitForTimeout(200);
        await q.evaluate(() => document.getElementById('gs-btn').click()); await q.waitForTimeout(300); await q.fill('#gs-in', 'impot'); await q.waitForTimeout(400);
        const f2 = await q.evaluate(() => [...document.querySelectorAll('#gsearch .gs-grp .gs-row')].filter((r) => /imp[ôo]t/i.test(r.textContent)).length);
        await q.evaluate(() => { const x = document.querySelector('#gsearch .gs-x'); if (x) x.click(); }); await q.waitForTimeout(300);
        await cdp.send('WebAuthn.setUserVerified', {authenticatorId, isUserVerified: false});
        await q.evaluate(() => { const x = document.querySelector('.face-note button'); if (x) x.click(); }); await q.waitForTimeout(2500);
        const f3 = await q.evaluate(() => !!localStorage.getItem('jarvis.faceid') && !!document.querySelector('.face-open'));
        await cdp.send('WebAuthn.setUserVerified', {authenticatorId, isUserVerified: true});
        await q.evaluate(() => document.querySelector('.face-open').click()); await q.waitForTimeout(1500);
        await q.evaluate(() => { const t = [...document.querySelectorAll('.pt')].find((x) => /Impôts/.test(x.textContent)); if (t) t.click(); }); await q.waitForTimeout(800);
        const f4 = await q.evaluate(() => /Impôts/.test((document.querySelector('.pap-h') || {}).textContent || ''));
        await q.evaluate(() => { location.hash = '#accueil'; }); await q.waitForTimeout(800);
        await q.clock.setFixedTime(new Date(Date.now() + 6 * 60000)); await q.evaluate(() => { location.hash = '#papiers'; }); await q.waitForTimeout(1200);
        const f5 = await q.evaluate(() => !document.querySelector('.pap-h') && !!document.querySelector('.face-open'));
        ok('0.73.0 — B1 : Face ID, papiers privés verrouillés : absents de la recherche de Papiers et de la recherche partout ; « Retirer » demande Face ID (refusé : la protection reste) ; un dossier privé resté ouvert ne se rouvre pas une fois le verrou revenu', f1 === 0 && f2 === 0 && f3 && f4 && f5, JSON.stringify([f1, f2, f3, f4, f5]));
        await ctx.close(); }
      /* page-2#3, page-2#14, page-2#9 : Radar, la facture du mois ne compte qu'une fois ; « Fixes (N) » = la liste ; abonnement trimestriel */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
        await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.radar.reste', JSON.stringify({jusqua: 'paie', rev: {jour: 5, avance: true}, fx: [
          {id: 'tb1', service: 'Box essai', cat: 'Abonnements', montant: 40, jour: 28, rythme: 'mensuel', source: 'toi', prochain: {date: '2027-03-01', montant: 50}},
          {id: 'tb2', service: 'Ancien forfait essai', cat: 'Autres', montant: 10, jour: 3, rythme: 'mensuel', source: 'toi', fin: '2027-01-31'}]})); } catch (e) { /* rien */ } });
        const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 radar : ' + e.message));
        await q.clock.setFixedTime(new Date('2027-02-20T10:00:00')); await q.goto(base + '#argent'); await q.waitForTimeout(3000);
        const rd = await q.evaluate(() => { const pn = [...document.querySelectorAll('.rad-fixes .panel')].find((x) => /^D’ici/.test((x.querySelector('h2') || {}).textContent || ''));
          return {rows: pn ? [...pn.querySelectorAll('.rad-fx')].map((x) => x.innerText.replace(/\s+/g, ' ')).filter((t) => /Box essai/.test(t)) : null, seg: (document.querySelector('.rad-seg button') || {}).textContent, liste: ([...document.querySelectorAll('.rad-fixes .panel h2')].find((x) => /^Mes dépenses fixes/.test(x.textContent)) || {}).textContent}; });
        ok('0.73.0 — B1 : Radar, prélèvement du 28 reporté au 1er mars (week-end) et facture de mars annoncée : comptée une seule fois (50 € le 01/03, plus deux fois) ; « Fixes (1) » comme « Mes dépenses fixes (1) » (une dépense finie ne compte plus)', !!rd.rows && rd.rows.length === 1 && /01\/03/.test(rd.rows[0]) && /50,00/.test(rd.rows[0]) && rd.seg === 'Fixes (1)' && rd.liste === 'Mes dépenses fixes (1)', JSON.stringify(rd));
        await q.evaluate(() => { window.__RADAR.abonnements.push({service: 'Assurance essai', cat: 'Assurances', prix: 45, rythme: 'trimestriel'}); const x = [...document.querySelectorAll('.rad-seg button')].find((y) => /^Abonnements/.test(y.textContent)); if (x) x.click(); }); await q.waitForTimeout(800);
        const ab = await q.evaluate(() => ([...document.querySelectorAll('.rad-abo')].find((x) => /Assurance essai/.test(x.textContent)) || {}).innerText || '');
        ok('0.73.0 — B1 : Radar, un abonnement trimestriel de 45 € : « 45,00 € par trimestre » et « 180,00 € par an » (plus « par mois »)', /45,00\s€ par trimestre/.test(ab) && /180,00\s€ par an/.test(ab), ab.replace(/\s+/g, ' '));
        await ctx.close(); }
      /* page-2#8 : « Mettre en pause » propose le vrai Black Friday et les soldes à venir */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 pause : ' + e.message));
        await q.clock.setFixedTime(new Date('2026-11-24T10:00:00')); await q.goto(base + '#achats'); await q.waitForTimeout(3000);
        await q.evaluate(() => { const f = [...document.querySelectorAll('#view .fam')].find((x) => /Robot Alpha/.test(x.textContent)); if (f) f.querySelector('.fam-hit').click(); }); await q.waitForTimeout(1000);
        await q.evaluate(() => { const x = [...document.querySelectorAll('#view button')].find((y) => /^Mettre en pause/.test(y.textContent.trim())); if (x) x.click(); }); await q.waitForTimeout(1000);
        const ch = await q.evaluate(() => { const s = document.getElementById('sheet'); return s.hidden ? '' : s.innerText.replace(/\s+/g, ' '); });
        ok('0.73.0 — B1 : Achats, « Mettre en pause » le 24/11/2026 : « Jusqu’au Black Friday (27/11) » et « Jusqu’aux soldes de janvier (06/01) » (plus le 23/11 écrit en dur)', /Jusqu'au Black Friday \(27\/11\)/.test(ch) && /Jusqu'aux soldes de janvier \(06\/01\)/.test(ch) && !/23\/11/.test(ch), ch.slice(0, 300));
        await ctx.close(); }
      /* page-1#5 : « Réduire les animations » : aucune sphère gardée en mémoire */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max'], reducedMotion: 'reduce'}); await ctx.addInitScript(PAUSE_INIT); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 sphères : ' + e.message));
        await q.goto(base + '#equipe'); await q.waitForTimeout(2500);
        for (const t of ['accueil', 'demandes', 'equipe', 'accueil', 'equipe']) { await q.evaluate((x) => { location.hash = '#' + x; }, t); await q.waitForTimeout(500); }
        const ns = await q.evaluate(() => ({n: window.__nSpheres(), vues: document.querySelectorAll('.chr canvas').length}));
        ok('0.73.0 — B1 : « Réduire les animations » : les sphères s’affichent, aucune n’est gardée pour une animation qui ne tourne pas (fuite de canevas)', ns.n === 0 && ns.vues > 0, JSON.stringify(ns));
        await ctx.close(); }
      /* page-1#11 : contexte WebGL perdu (iOS, mémoire) : les sphères restent dessinées, puis le globe revient */
      { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
        await ctx.addInitScript(() => { const g0 = HTMLCanvasElement.prototype.getContext; window.__gls = []; HTMLCanvasElement.prototype.getContext = function (t, o) { const c = g0.call(this, t, o); if (t === 'webgl' && c && !this.isConnected && this.width === 512 && !window.__gls.includes(c)) window.__gls.push(c); return c; }; });
        const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('B1 webgl : ' + e.message));
        await q.goto(base + '#equipe'); await q.waitForTimeout(2500);
        const px = () => q.evaluate(() => { const cv = document.querySelector('.team .mate .chr canvas'); if (!cv) return -1; const g = cv.getContext('2d'), d = g.getImageData(Math.round(cv.width * 0.5), Math.round(cv.height * 0.24), 1, 1).data; return d[3]; });
        const w0 = await q.evaluate(() => window.__gls.length), a0 = await px();
        await q.evaluate(() => { window.__b1ext = window.__gls[0] && window.__gls[0].getExtension('WEBGL_lose_context'); if (window.__b1ext) window.__b1ext.loseContext(); }); await q.waitForTimeout(700);
        const a1 = await px();
        await q.evaluate(() => { if (window.__b1ext) window.__b1ext.restoreContext(); }); await q.waitForTimeout(900);
        const a2 = await px();
        /* avant : après la perte, seule la silhouette restait (pixel à moitié transparent, alpha 105), même une fois le contexte rendu */
        ok('0.73.0 — B1 : contexte WebGL perdu : les sphères restent pleines (dessin simple), puis le globe revient avec le contexte', w0 === 1 && a0 >= 250 && a1 >= 250 && a2 >= 250, JSON.stringify({w0, a0, a1, a2}));
        await ctx.close(); }
    }
    /* 18/11/2026, passe globale : notifications (lien profond, bandeau qui se ferme, « Voir »), compteurs, Équipe, champs date */
    { p = await page('#accueil');
      const row = await p.evaluate(() => { let k = -1; window.__G['Canal'].forEach((x, i) => { if (i && x[1] === 'Rabie' && x[6]) k = i; }); return k + 1; });
      const nums = await p.evaluate(() => { const k = document.querySelector('.hud-ro.q-bl b'); return [(document.querySelector('#status .st.is-demande') || {}).textContent, (document.querySelector('.tab[data-tab="demandes"] .badge') || {}).textContent, k ? (k.textContent.match(/^\d+/) || [''])[0] : '', document.getElementById('view').innerText];   /* refonte UX : « pour toi » est le relevé de l'écran de JARVIS */ });
      const n0 = (nums[0].match(/^(\d+) pour toi$/) || [])[1];
      ok('compteurs : un seul « pour toi », le même dans l\'en-tête, la pastille et l\'accueil', n0 != null && nums[1] === n0 && nums[2] === n0, nums.slice(0, 3).join(' / '));
      ok('accueil : jamais « J-- » (voyage en cours ou passé)', !/J--/.test(nums[3]));
      p = await page('#voir-' + row);
      const sh = await p.evaluate(() => { const s = document.getElementById('sheet'); return [location.hash, s && !s.hidden ? s.innerText : '']; });
      ok('notification : « /#voir-<ligne du Canal> » ouvre ton ordre et la réponse du bot, l\'adresse revient à Pour moi', sh[0] === '#demandes' && /Ton ordre/i.test(sh[1]), sh[0] + ' ' + sh[1].slice(0, 80));
      await p.evaluate(() => document.getElementById('sheet-back').click()); await p.waitForTimeout(400);
      const add = (txt) => p.evaluate((t) => { const c = window.__G['Canal']; c.push([c[c.length - 1][0], 'Rabie', 'Iris', 'Ordre', t, 'À faire', '', '']); location.hash = '#voir-recent'; return c.length; }, txt);
      const answer = (r, txt) => p.evaluate(([rr, t]) => { const x = window.__G['Canal'][rr - 1]; x[5] = 'Fait'; x[6] = t; location.hash = '#voir-recent'; }, [r, txt]);
      const r1 = await add('Cherche le bail'); await p.waitForTimeout(1500); await answer(r1, 'Bail trouvé dans Logement.'); await p.waitForTimeout(2200);
      const a1 = await p.evaluate(() => [...document.querySelectorAll('.alert-t:not(.out)')].map((t) => t.innerText).join(' | '));
      await p.evaluate(() => { const v = [...document.querySelectorAll('.alert-t .btn')].find((x) => x.textContent === 'Voir'); if (v) v.click(); }); await p.waitForTimeout(2200);   /* la bulle du bot s'écrit lettre à lettre */
      const v1 = await p.evaluate(() => { const s = document.getElementById('sheet'); return [s && !s.hidden ? s.innerText : '', document.querySelectorAll('.alert-t:not(.out)').length]; });
      ok('notification dans l\'app : « Iris a répondu », « Voir » ouvre sa réponse et ferme le bandeau', /Iris a répondu/.test(a1) && /Bail trouvé dans Logement/.test(v1[0]) && v1[1] === 0, a1.slice(0, 80) + ' :: ' + v1[1] + ' ' + v1[0].slice(0, 120));
      await p.evaluate(() => document.getElementById('sheet-back').click()); await p.waitForTimeout(400);
      const r2 = await add('Cherche la quittance'); await p.waitForTimeout(1500); await answer(r2, 'Quittance de mai trouvée.'); await p.waitForTimeout(2200);
      const a2 = await p.evaluate(() => document.querySelectorAll('.alert-t:not(.out)').length);
      await p.evaluate(() => { const x = document.querySelector('.alert-t:not(.out) .toast-x'); if (x) x.click(); }); await p.waitForTimeout(500);
      const gone = await p.evaluate(() => [document.querySelectorAll('.alert-t:not(.out)').length, document.getElementById('sheet').hidden]);
      ok('notification dans l\'app : la croix la ferme sans rien ouvrir', a2 === 1 && gone[0] === 0 && gone[1] === true, a2 + ' ' + gone.join(' '));
      const rep = await p.evaluate(() => { const x = document.getElementById('pm-rep'); return x ? x.innerText : ''; });
      ok('Pour moi : « Réponses de tes bots » (3 derniers jours), la plus récente en tête', /Réponses de tes bots/.test(rep) && rep.indexOf('Quittance de mai trouvée') >= 0 && rep.indexOf('Quittance de mai trouvée') < rep.indexOf('Bail trouvé'), rep.slice(0, 120));
      const wait = await p.evaluate(() => { const x = document.getElementById('pm-wait'); return x ? (x.tagName !== 'DETAILS' || x.open) : null; });
      ok('Pour moi : « En attente, plus tard, en rappel » ouvert par défaut', wait === true, String(wait));
      p = await page('#equipe');
      const eq = await p.evaluate(() => [[...document.querySelectorAll('#view .panel h2')].map((x) => x.textContent).join(' | '), (document.querySelector('#view .stats') || {}).innerText || '']);
      ok('Équipe : plus de doublon « Échanges récents », des chiffres d\'équipe (ordres en cours, réponses)', !/Échanges récents/.test(eq[0]) && !/Tes ordres/.test(eq[0]) /* refonte UX : sous « Demandes » */ && /en cours/.test(eq[1]) && /répons/.test(eq[1]) && !/prix suivis|papiers/.test(eq[1]), eq.join(' :: ').replace(/\s+/g, ' ').slice(0, 160));
      p = await page('#agenda');
      const di = await p.evaluate(() => { const x = document.querySelector('input.inp[type="date"]'); if (!x) return null; const c = getComputedStyle(x); return c.minWidth + ' ' + c.appearance; });
      ok('Agenda : le champ date ne peut plus sortir de sa carte sur iPhone (largeur min. 0, sans apparence native)', di === '0px none', String(di)); }
    /* 18/11/2026 : une échéance « Un bot s'en occupe » que le bot a faite (son Journal) sans passer sa ligne à « Fait » s'affiche faite */
    { p = await page('#agenda');
      await p.evaluate(() => { const G = window.__G, d = new Date(), p2 = (n) => String(n).padStart(2, '0'), dd = p2(d.getDate()) + '/' + p2(d.getMonth() + 1), fr = dd + '/' + d.getFullYear();
        G['Échéances'].push([fr, 'Timesheet Démo de la semaine du ' + dd, 'Travail', '', 'À venir', 'Chronos', '', "Un bot s'en occupe"], [fr, 'CRA Autre client du mois', 'Travail', '', 'À venir', 'Chronos', '', "Un bot s'en occupe"]);
        G['Journal'].push([fr + ' ' + p2(Math.max(0, d.getHours() - 1)) + 'h05', 'Chronos', 'ETAT', 'CRA Démo semaine du ' + dd, 'Soumis, en attente de validation.']);
        location.hash = '#voir-recent'; });
      await p.waitForTimeout(2500); await p.evaluate(() => { location.hash = '#agenda'; }); await p.waitForTimeout(1500);
      const rows = await p.evaluate(() => [...document.querySelectorAll('#view .dl-row, #view .agt-row')].map((x) => x.innerText.replace(/\s+/g, ' ')));
      const done = rows.some((t) => /Timesheet Démo .* · fait ✓/.test(t)), other = rows.some((t) => /CRA Autre client du mois/.test(t) && !/fait ✓/.test(t));
      await p.evaluate(() => { const x = [...document.querySelectorAll('#view .dl-row, #view .agt-row')].find((y) => /Timesheet Démo/.test(y.innerText)); if (x) x.click(); }); await p.waitForTimeout(1500);
      const sh = await p.evaluate(() => { const s = document.getElementById('sheet'); return s && !s.hidden ? s.innerText : ''; });
      ok('Agenda : une échéance qu\'un bot a faite (son Journal) s\'affiche « fait ✓ », sa feuille dit « Fait par Chronos » et propose « Oui, c\'est fait » (gratuit) ; une autre du même bot reste à venir', done && other && /Fait par Chronos/i.test(sh) && /Oui, c'est fait/.test(sh) && !/Fais-le maintenant/.test(sh), [done, other, sh.replace(/\s+/g, ' ').slice(0, 120)].join(' | ')); }
    /* 0.23.0 : comparatif des variantes (préparé par Claude ; ici, celui des données d'exemple) */
    { p = await page('#achats');
      const lead = await p.evaluate(() => [...document.querySelectorAll('.fam-rqp')].map((x) => x.textContent).join(' | '));
      const pic = await p.evaluate(() => { const c = [...document.querySelectorAll('.fam-hit')].find((x) => /Beta/.test(x.textContent)); return !!(c && c.querySelector('.fam-ic.has-pic img')); });
      ok('Achats : la carte d\'un produit montre sa photo', pic);
      await p.evaluate(() => [...document.querySelectorAll('.fam-hit')].find((x) => /Beta/.test(x.textContent)).click()); await p.waitForTimeout(1200);
      const cp = await p.evaluate(() => { const pn = [...document.querySelectorAll('.panel')].find((x) => /^Le comparatif/.test((x.querySelector('h2') || {}).textContent || '')); return pn ? {t: pn.innerText, bars: pn.querySelectorAll('.cmp-bar').length, best: pn.querySelectorAll('.cmp-bar.is-best').length, pics: pn.querySelectorAll('.cmp-pic img').length, ex: document.querySelectorAll('.var-x').length, exT: (document.querySelector('.var-x') || {}).innerText || ''} : null; });
      ok('Achats : chaque produit dit son meilleur rapport qualité/prix', /Meilleur rapport qualité\/prix : (Absolute|Submarine) \(\d/.test(lead), lead);
      ok('Achats : comparatif clair (résumé, différence qui compte, photos, schéma par critère, qualité/prix au prix du jour, conseil, sources)', cp && /La différence qui compte/.test(cp.t) && /Rapport qualité\/prix/.test(cp.t) && /Le conseil de Claude/.test(cp.t) && cp.bars >= 8 && cp.best >= 2 && cp.pics === 2, JSON.stringify(cp && {bars: cp.bars, best: cp.best, pics: cp.pics}));
      const bars = await p.evaluate(() => { const c = [...document.querySelectorAll('.cmp-crit')].find((x) => /^Prix du jour/.test(x.textContent)); return c ? [...c.querySelectorAll('.cmp-bar')].map((b) => ({v: b.querySelector('.cmp-v').textContent, w: b.querySelector('.cmp-track i').getBoundingClientRect().width, best: b.classList.contains('is-best')})) : []; });
      ok('Achats : la barre est la valeur (le prix le plus bas a la barre la plus courte, en vert)', bars.length === 2 && bars[0].best && !bars[1].best && bars[0].w < bars[1].w && +bars[0].v < +bars[1].v, JSON.stringify(bars));
      ok('Achats : sous chaque variante, pour qui, à quoi elle sert, forces et limites, les deux notes', cp && cp.ex === 2 && /Pour qui/.test(cp.exT) && /À quoi elle sert/.test(cp.exT) && /Qualité\/prix \d/.test(cp.exT) && /Qualité \d/.test(cp.exT), cp && cp.exT.replace(/\s+/g, ' ').slice(0, 140)); }
    /* 0.24.0 (19/11/2026) : Hologramme seul (classique retiré, Ambre et Néon essayés puis retirés à sa demande) */
    { p = await page('#achats');
      await p.evaluate(() => { try { localStorage.setItem('jarvis.theme', 'neon'); } catch (e) { /* rien */ } }); await p.reload(); await p.waitForTimeout(2000);
      const th = await p.evaluate(() => ({cls: document.documentElement.className, th: document.documentElement.getAttribute('data-th'), c1: getComputedStyle(document.documentElement).getPropertyValue('--c1').trim(), jv: getComputedStyle(document.documentElement).getPropertyValue('--jv1').trim()}));
      ok('thème : Hologramme seul, un ancien choix (classique, Ambre, Néon) retombe sur Hologramme', th.cls === 'theme-holo' && th.th === 'holo' && th.c1 === '56, 189, 248' && th.jv === '', JSON.stringify(th));
      await p.click('.tab[data-tab="espaces"]'); await p.waitForTimeout(600);
      ok('thème : plus de ligne « Thème » (un seul thème)', await p.evaluate(() => !document.querySelector('.theme-row, .th-pick') && !!document.querySelector('.esp-grid')));
    }
    /* 0.24.0 : chercher un produit à partir d'une idée (ici, la recherche d'exemple et une recherche simulée) */
    { p = await page('#achats'); await versIdees(p);
      const f = await p.evaluate(() => { const b = document.querySelector('.idee-box'); return b && {idee: !!b.querySelector('#ix-idee'), pour: !!b.querySelector('#ix-pour'), min: !!b.querySelector('#ix-min'), max: !!b.querySelector('#ix-max'), n: b.querySelectorAll('#ix-n option').length, after: !!(b.closest('.idee-wrap') && b.closest('.idee-wrap').previousElementSibling && b.closest('.idee-wrap').previousElementSibling.classList.contains('dm-seg') && b.closest('.idee-wrap').offsetParent !== null)}; });
      ok('idées : « Trouver une idée » sous le filtre « Idées » d\'Achats (0.87.0) : idée, pour qui, budget min et max, 1 à 20 propositions', f && f.idee && f.pour && f.min && f.max && f.n === 20 && f.after, JSON.stringify(f));
      ok('idées : mes recherches (photo, pour qui, budget, nombre)', await p.evaluate(() => { const it = document.querySelector('.idee-it'); return !!it && /fille de 3 ans · 30 à 60 € · 6 propositions/.test(it.textContent) && !!it.querySelector('.idee-th.has-pic img'); }));
      await p.click('.idee-it'); await p.waitForTimeout(800);
      const pg = await p.evaluate(() => ({t: document.querySelector('.view-title').textContent, cards: document.querySelectorAll('.idee-card:not(.is-presque)').length, first: (document.querySelector('.idee-rank') || {}).textContent, why: !!document.querySelector('.cmp-key'), warn: [...document.querySelectorAll('.idee-warn')].map((x) => x.textContent).join('|'), note: [...document.querySelectorAll('.idee-note')].map((x) => x.textContent).join('|'), bars: document.querySelectorAll('.idee-card:not(.is-presque) .idee-bar').length, links: document.querySelectorAll('.idee-card:not(.is-presque) a.btn[target="_blank"]').length,
        presque: [...document.querySelectorAll('.idee-card.is-presque')].map((c) => c.querySelector('.idee-ecart').textContent + ' · ' + c.querySelector('.idee-nom').textContent), pistes: [...document.querySelectorAll('.idee-piste')].map((b) => b.textContent)}));
      ok('idées : la page des propositions (meilleur choix en tête, conseil, photo, prix TTC avec vendeur et date, pourquoi, forces et limites, deux notes, lien vers le vendeur)', /Maison de poupée/.test(pg.t) && pg.cards === 6 && pg.first === 'Meilleur choix' && pg.why && pg.bars === 12 && pg.links === 6, JSON.stringify(pg));
      ok('idées : un prix différent sur la page du vendeur est signalé ; une page illisible aussi', /64,90/.test(pg.warn) && /non revérifié/.test(pg.note), pg.warn + ' / ' + pg.note);
      /* 0.29.0 (son retour : « archi nulle, ça ne trouve que dalle ») : ce qui manque de peu n'est plus jeté, et les pistes de Claude se relancent d'un appui */
      ok('idées : « Presque » montre ce qui manque de peu, avec l\'écart ; « Pour en trouver plus » donne les pistes de Claude', pg.presque.length === 1 && /^10 € au-dessus · Maison lumineuse Étoile/.test(pg.presque[0]) && pg.pistes.length === 2 && /Monte le maximum à 70 €/.test(pg.pistes[0]) && /Relancer : Maison de poupée · 30 à 70 €/.test(pg.pistes[0]), JSON.stringify([pg.presque, pg.pistes]));
      await p.click('.idee-tri button:has-text("Prix")'); await p.waitForTimeout(300);
      const px = await p.evaluate(() => [...document.querySelectorAll('.idee-card:not(.is-presque) .idee-prix b')].map((x) => parseFloat(x.textContent.replace(/\s/g, '').replace(',', '.'))));
      ok('idées : tri par prix', px.length === 6 && px.every((v, i) => !i || v >= px[i - 1]), px.join(' '));
      await p.click('.idee-card .btn:has-text("Suivre le prix")'); await p.waitForTimeout(700);
      const sv = await p.evaluate(() => [...document.querySelectorAll('.pick-form input')].map((x) => x.value));
      ok('idées : « Suivre le prix » ouvre la fiche pour Kairos préremplie (produit, lien, prix max = budget)', /Cottage en tissu Doudou/.test(sv[0]) && /^https:/.test(sv[1]) && sv[2] === '60', sv.join(' | '));
      p = await page('#achats'); await versIdees(p);
      await p.fill('#ix-idee', 'Trottinette'); await p.fill('#ix-pour', 'garçon de 6 ans'); await p.fill('#ix-max', '50'); await p.selectOption('#ix-n', '3'); await p.click('.idee-go'); await p.waitForTimeout(500);
      const w = await p.evaluate(() => ({t: document.querySelector('.view-title').textContent, wait: !!document.querySelector('.cmp-wait .cmp-spin')}));
      await p.waitForTimeout(2800);
      const d = await p.evaluate(() => [...document.querySelectorAll('.idee-card:not(.is-presque) .idee-prix b')].map((x) => parseFloat(x.textContent.replace(/\s/g, '').replace(',', '.'))));
      ok('idées : une nouvelle recherche ouvre sa page (attente, puis propositions dans le budget, au nombre demandé)', /Trottinette/.test(w.t) && w.wait && d.length === 3 && d.every((v) => v <= 50), JSON.stringify(w) + ' ' + d.join(' '));
      await p.screenshot({path: path.join(SH, 'idees.png')});
      /* 0.29.0 : rien dans le budget, mais du « presque » : la recherche n'est plus « vide » ; la piste se relance et trouve */
      p = await page('#achats'); await versIdees(p);
      await p.fill('#ix-idee', 'Maison de poupée'); await p.fill('#ix-max', '30'); await p.selectOption('#ix-n', '4'); await p.click('.idee-go'); await p.waitForTimeout(3300);
      const v0 = await p.evaluate(() => ({vide: (document.querySelector('.idee-vide') || {}).textContent || '', titres: [...document.querySelectorAll('.panel-h h2')].map((x) => x.textContent), presque: [...document.querySelectorAll('.idee-card.is-presque .idee-ecart')].map((x) => x.textContent), pistes: [...document.querySelectorAll('.idee-piste b')].map((x) => x.textContent)}));
      ok('idées : rien dans le budget n\'est plus un échec muet : « Rien qui coche tout », puis le plus proche (5 € au-dessus) et une piste', /n’a rien trouvé qui respecte/.test(v0.vide) && v0.titres.includes('Presque') && v0.presque.length === 1 && /^5 € au-dessus$/.test(v0.presque[0]) && /Monte le maximum à 35 €/.test(v0.pistes[0] || ''), JSON.stringify(v0));
      await p.screenshot({path: path.join(SH, 'idees-presque.png')});
      await p.click('.idee-piste'); await p.waitForTimeout(3300);
      const v1 = await p.evaluate(() => ({t: document.querySelector('.view-title').textContent, sub: (document.querySelector('.idee-hero small') || {}).textContent || '', prix: [...document.querySelectorAll('.idee-card:not(.is-presque) .idee-prix b')].map((x) => x.textContent)}));
      ok('idées : une piste se relance d\'un appui (même idée, maximum monté à 35 €) et trouve', /Maison de poupée/.test(v1.t) && /jusqu’à 35 €/.test(v1.sub) && v1.prix.length === 1 && /34,90/.test(v1.prix[0]), JSON.stringify(v1));
      await p.click('.back-link'); await p.waitForTimeout(500);
      ok('idées : dans « Mes recherches », la recherche sans rien dans le budget dit « Rien dans ton budget · 1 presque »', await p.evaluate(() => [...document.querySelectorAll('.idee-it .idee-st')].some((x) => /^Rien dans ton budget · 1 presque/.test(x.textContent))), await p.evaluate(() => [...document.querySelectorAll('.idee-it .idee-st')].map((x) => x.textContent).join(' | ')));
    }
    /* 19/11/2026 (capture : « 186 320 € TTC » pour une sortie à 18 €) : prix écrit en phrase, trajet en une ligne */
    { p = await page('#sorties');
      await p.evaluate(() => { const G = window.__G, d = new Date(Date.now() + 10 * 864e5), p2 = (n) => String(n).padStart(2, '0'), fr = p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear();
        G['Sorties'].push(['Lumières de test', 'Ville test', fr, fr, '18 € TTC au guichet (tarif unique 6 € × 3 personnes) ou 19,50 € TTC en ligne (6 € + 0,50 € de frais × 3)', 'Voiture : 5,7 km, 9 min depuis la mairie (itinéraire OSRM). Transports : bus 1, 14 min tout compris dont 7 min de bus (Rome2Rio, https://exemple.fr).', 'à partir de 3 ans', '', 'Proposée', fr, 'Ulysse', ''],
          ['Conte de test', 'Ville test', fr, fr, '0 € TTC (accès libre sur réservation)', '', '', '', 'Proposée', fr, 'Ulysse', '']);
        location.hash = '#voir-recent'; });
      await p.waitForTimeout(2500); await p.evaluate(() => { location.hash = '#sorties'; }); await p.waitForTimeout(1500);
      const t = await p.evaluate(() => [...document.querySelectorAll('#view .mchips')].map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | '));
      ok('Sorties : un prix écrit en phrase donne son premier montant (« 18 € TTC au guichet », pas « 186 320 € »), 0 € = « Gratuit », trajet en une ligne', /18 € TTC au guichet/.test(t) && !/186/.test(t) && /Gratuit/.test(t) && /Voiture 9 min \(5,7 km\) · transports 14 min/.test(t) && !/rome2rio/i.test(t), t.slice(0, 200)); }
    /* Radar (maquette du 21/11/2026, rubrique Argent) : prélèvements à venir, alertes, abonnements, total du mois, conseil Navigo ; données d'exemple */
    { p = await page('#argent');
      const r0 = await p.evaluate(() => ({t: document.getElementById('view-title').textContent, k: (document.querySelector('.rad-hero .rad-k') || {}).textContent || '', big: (document.querySelector('.rad-hero .rad-big') || {}).textContent || '',
        chips: (document.querySelector('.rad-hero .mchips') || {}).textContent || '', segs: [...document.querySelectorAll('.rad-seg button')].map((x) => x.textContent), fixes: document.querySelectorAll('.rad-fixes').length,
        nav: (document.querySelector('.rad-nav b') || {}).textContent || '', large: document.documentElement.scrollWidth <= innerWidth + 1}));
      ok('Radar : la rubrique Argent s\'ouvre sur le reste à payer d\'ici la paie, 5 filtres (Fixes d\'abord), le conseil Navigo, sans déborder', r0.t === 'Argent' && /^Reste à payer d’ici ta paie du \S+ \d\d\/\d\d$/.test(r0.k) && /^\d[\d\s]*,\d\d €$/.test(r0.big)
        && /2 échéances sous 7 jours/.test(r0.chips) && /En plusieurs fois : 59,10 €/.test(r0.chips) && r0.segs.length === 5 && /^Fixes \(16\)$/.test(r0.segs[0]) && /^À venir \(7\)$/.test(r0.segs[1]) && r0.fixes === 1 && /^Navigo de .+ : reste en Liberté\+$/.test(r0.nav) && r0.large, JSON.stringify(r0));
      const avenir = () => p.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^À venir/.test(x.textContent)).click()).then(() => p.waitForTimeout(400));
      await avenir();
      ok('Radar : à venir dans l\'ordre des dates ; le plus proche signalé, avec la hausse par rapport à l\'an dernier', await p.evaluate(() => { const c = [...document.querySelectorAll('.rad-due')], j = c.map((x) => +((x.querySelector('.ech-date span').textContent.match(/\d+/) || [0])[0]));
        return c.length === 7 && c[0].classList.contains('is-soon') && /dans 3 j/.test(c[0].textContent) && /\+33 % \(avant : 59,99 €\)/.test(c[0].textContent) && j.every((v, i) => !i || v >= j[i - 1]) && /montant à venir/.test(c[6].textContent); }));
      /* 0.68.0 : une échéance d'un paiement en plusieurs fois : son achat (PayPal, 4 fois, ce qui reste), « Voir le paiement » ; ni « Je garde » ni « Résilier » */
      ok('Radar 0.68 : dans « À venir », l’échéance d’un paiement en 4 fois dit son achat et ce qui reste, avec « Voir le paiement » (plus « Je garde », « Comparer », « Résilier »)', await p.evaluate(() => { const c = document.querySelector('.rad-due-ech'); if (!c) return false; const b = [...c.querySelectorAll('.row-actions button')].map((x) => x.textContent.trim());
        return /Paiement en 4 fois · PayPal/i.test(c.querySelector('.nature').textContent) && /Boutique/.test(c.textContent) && /reste 59,10 € sur 118,20 €/.test(c.textContent) && /Échéance 4 sur 4/.test(c.textContent) && b.join() === 'Voir le paiement' && !/Je garde|Résilier|Comparer/.test(c.textContent); }));
      await p.evaluate(() => [...document.querySelectorAll('.rad-due')][0].querySelector('.row-actions button').click()); await p.waitForTimeout(500);
      const r1 = await p.evaluate(() => ({kept: document.querySelector('.rad-due').classList.contains('is-kept') && /gardé/.test(document.querySelector('.rad-due .nature').textContent), toast: [...document.querySelectorAll('.toast')].some((x) => /Gardé/.test(x.textContent))}));
      await p.reload(); await p.waitForTimeout(1800); await avenir();
      const r2 = await p.evaluate(() => ({kept: document.querySelector('.rad-due').classList.contains('is-kept'), p: document.querySelector('.rad-hero .mchips').textContent}));
      ok('Radar : « Je garde » marque le prélèvement, prévient, et tient après un rechargement (plus qu\'une échéance à surveiller dans les 7 jours)', r1.kept && r1.toast && r2.kept && /1 échéance sous 7 jours/.test(r2.p), JSON.stringify([r1, r2]));
      await p.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^Alertes/.test(x.textContent)).click()); await p.waitForTimeout(400);
      ok('Radar : 4 alertes, une icône par type (paiement échoué, essai, hausse, montant inhabituel) ; plus d\'alerte sur la facture mobile (seul le prix de l\'abonnement compte)', await p.evaluate(() => { const a = [...document.querySelectorAll('.rad-alert')];
        return a.length === 4 && ['echec', 'essai', 'hausse', 'inhabituel'].every((k) => a.some((x) => x.classList.contains('is-' + k))) && !a.some((x) => /facture mobile/i.test(x.textContent)) && a.every((x) => x.querySelector('.hm-ic svg')) && /avant : 48,20 €/.test(a[3].textContent); }));
      await p.evaluate(() => document.querySelector('.rad-alert .row-actions button').click()); await p.waitForTimeout(400);
      ok('Radar : « Vu » retire l\'alerte et met les compteurs à jour', await p.evaluate(() => document.querySelectorAll('.rad-alert').length === 3 && [...document.querySelectorAll('.rad-seg button')].some((x) => x.textContent === 'Alertes (3)') && /3 alertes/.test(document.querySelector('.rad-hero .mchips').textContent)));
      /* 0.68.0 (« j'ai supprimé toutes les alertes par erreur… j'arrive plus à les récupérer ») : « Déjà vues » et « Remettre », et « Annuler » dans la notification */
      const vu1 = await p.evaluate(() => ({s: (document.querySelector('.rad-vues summary') || {}).textContent || '', annuler: [...document.querySelectorAll('.toast')].some((x) => /Vu/.test(x.textContent) && /Annuler/.test(x.textContent))}));
      await p.evaluate(() => { const d = document.querySelector('.rad-vues'); d.open = true; d.dispatchEvent(new Event('toggle')); }); await p.waitForTimeout(300);
      const vu2 = await p.evaluate(() => [...document.querySelectorAll('.rad-vues .rad-alert')].map((x) => x.innerText.replace(/\s+/g, ' ')));
      await p.evaluate(() => [...document.querySelectorAll('.rad-vues .rad-alert .row-actions button')].find((x) => /Remettre/.test(x.textContent)).click()); await p.waitForTimeout(400);
      const vu3 = await p.evaluate(() => document.querySelectorAll('.rad-alert').length === 4 && !document.querySelector('.rad-vues') && /4 alertes/.test(document.querySelector('.rad-hero .mchips').textContent));
      ok('Radar 0.68 : une alerte vue reste dans « Déjà vues (1) » (« Annuler » dans la notification) ; « Remettre » la rend (4 alertes)', vu1.s === 'Déjà vues (1)' && vu1.annuler && vu2.length === 1 && /Remettre/.test(vu2[0]) && /Paiement échoué/.test(vu2[0]) && vu3, JSON.stringify([vu1, vu2, vu3]));
      await p.evaluate(() => document.querySelector('.rad-alert .row-actions button').click()); await p.waitForTimeout(300);
      await p.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^Abonnements/.test(x.textContent)).click()); await p.waitForTimeout(400);
      ok('Radar : abonnements rangés par catégorie, total juste (991,60 € par an, 82,63 € par mois), aucune ligne ne déborde', await p.evaluate(() => { const v = document.getElementById('view').getBoundingClientRect();
        return /9 abonnements : 991,60 € par an, soit 82,63 € par mois/.test(document.querySelector('.rad-tot').textContent) && document.querySelectorAll('#view .panel').length === 4 && document.querySelectorAll('.rad-abo').length === 9
          && [...document.querySelectorAll('.rad-abo')].every((x) => x.getBoundingClientRect().right <= v.right + 1) && /119,88 € par an/.test(document.querySelector('.rad-abo').textContent); }));
      await p.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => x.textContent === 'Le mois').click()); await p.waitForTimeout(400);
      ok('Radar : le mois, un poste par barre, la plus longue pour le plus gros poste, comparé au mois précédent', await p.evaluate(() => { const b = [...document.querySelectorAll('.rad-bar')], w = b.map((x) => parseFloat(x.querySelector('.rad-bar-t i').style.width));
        return b.length === 5 && w[0] === 100 && w.every((v, i) => !i || v <= w[i - 1]) && /641,37 €, contre 598,20 € .+ \(\+7 %\)/.test(document.getElementById('view').textContent) && /10 commandes, 21,16 € en moyenne/.test(b[1].textContent); }));
      await p.screenshot({path: path.join(SH, 'radar-mois.png')});
      await p.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^À venir/.test(x.textContent)).click()); await p.waitForTimeout(400);
      await p.evaluate(() => [...document.querySelectorAll('.rad-due')][1].querySelectorAll('.row-actions button')[1].click()); await p.waitForTimeout(800);
      ok('Radar : « Comparer avec Claude » ouvre la discussion avec la question déjà écrite (rien n\'est envoyé)', await p.evaluate(() => { const ta = document.getElementById('chat-in'); return !!ta && /Compare pour moi « Assistant IA » \(21,60 €, mensuel\)/.test(ta.value); }));
      p = await page('');
      await p.tap('.tab[data-tab="espaces"]'); await p.waitForTimeout(600);
      ok('Radar : la rubrique Argent est une tuile d’Espaces (maquette)', await p.evaluate(() => !!document.querySelector('.esp-tile[data-go="argent"]')));
      p = await page('#argent'); await p.screenshot({path: path.join(SH, 'radar.png')}); }
    /* 0.69.0 (son retour du 23/11/2026 : « elle rouvre Jarvis sur la page déjà ouverte, pas sur l'alerte ») : une notification ouvre ce qu'elle annonce,
       mis en évidence : l'alerte du Radar, les dates clés, l'état des systèmes ; l'app déjà ouverte reçoit l'adresse du service worker */
    { const q = await page('#voir-radar-ra1');
      const etat = () => q.evaluate(() => ({hash: location.hash, seg: (document.querySelector('.rad-seg button[aria-pressed="true"]') || {}).textContent || '', cible: [...document.querySelectorAll('[data-vise]')].map((x) => x.getAttribute('data-alerte') || ((x.querySelector('h2') || {}).textContent || '').trim() || x.id)}));
      const a = await etat();
      await q.evaluate(() => { location.hash = '#voir-echeances'; }); await q.waitForTimeout(1300); const c1 = await etat();
      await q.evaluate(() => { location.hash = '#voir-sante'; }); await q.waitForTimeout(1300); const c2 = await etat();
      await q.evaluate(() => { location.hash = '#accueil'; }); await q.waitForTimeout(1000);
      await q.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.dispatchEvent(new MessageEvent('message', {data: {type: 'jarvis-notif', url: '/?n=abcdef012345#voir-radar-ra2'}}))); await q.waitForTimeout(1300); const c3 = await etat();
      ok('Notifications 0.69 : « #voir-radar-<alerte> » ouvre Argent sur l’alerte, mise en évidence ; « #voir-echeances » les dates clés ; « #voir-sante » l’état des systèmes ; app déjà ouverte : l’adresse transmise par le service worker ouvre l’alerte',
        a.hash === '#argent' && /^Alertes/.test(a.seg) && a.cible.includes('ra1') && c1.hash === '#agenda' && c1.cible.some((x) => /Dates clés/.test(x)) && c2.hash === '#reglages' && c2.cible.some((x) => /État des systèmes/.test(x)) && c3.hash === '#argent' && c3.cible.includes('ra2') && !c3.cible.includes('ra1'), JSON.stringify([a, c1, c2, c3])); }
    /* Reste à payer (21/11/2026 ; ses choix : dans JARVIS, ses dépenses seulement, notification la veille + la page Radar). Date fixée au lundi
       23/11/2026 : paie le 28 (un samedi : avancée au vendredi 27) ; prélèvements du week-end et des jours fériés décalés au jour ouvré suivant. */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT); const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('reste à payer : ' + e.message));
      await q.clock.setFixedTime(new Date('2026-11-23T10:00:00')); await q.goto(base + '#argent'); await q.waitForTimeout(3000);
      const rs = () => q.evaluate(() => ({k: document.querySelector('.rad-k').textContent, big: document.querySelector('.rad-big').textContent, p: document.querySelector('.rad-hero p').textContent,
        prog: document.querySelector('.rad-prog-l').textContent, w: document.querySelector('.rad-prog i').style.width, rows: [...document.querySelectorAll('.rad-fixes > .panel:first-child .rad-fx')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
        deja: (document.querySelector('.rad-deja summary') || {}).textContent || '', rules: document.querySelectorAll('.rad-rule').length, seg: (document.querySelector('.rad-seg button') || {}).textContent, large: document.documentElement.scrollWidth <= innerWidth + 1}));
      const ra = await rs();
      ok('Reste à payer : d\'ici la paie du 28 avancée au vendredi 27/11, 140,03 € en 4 prélèvements (celui du dimanche 22 part le lundi 23 ; l\'échéance d\'un paiement en 4 fois comptée) ; 1 435,07 € déjà prélevés depuis la paie du 28/10', ra.k === 'Reste à payer d’ici ta paie du ven. 27/11' && ra.big === '140,03 €'
        && /^4 prélèvements · prochain : Livraison de repas, abonnement, aujourd’hui, 5,99 €$/.test(ra.p) && /depuis ta paie du mer\. 28\/10 : 1\s435,07 €$/.test(ra.prog) && ra.w === '91%' && ra.rows.length === 4
        && /^lun\. 23\/11 Livraison de repas, abonnement Abonnements · décalé du dim\. 22\/11 5,99 €$/.test(ra.rows[0]) && /^mer\. 25\/11 Paiement en 4 fois : Boutique Ponctuel · annoncé par mail 29,55 €$/.test(ra.rows[1]) && /^jeu\. 26\/11 Console de jeux/.test(ra.rows[3])
        && /^Déjà prélevé \(12\) : 1\s435,07 €$/.test(ra.deja) && ra.rules === 16 && ra.large, JSON.stringify(ra));
      /* 0.68.0 (« les paiements en plusieurs fois ne sont pas bien gérés… rien ne s'affiche ») : un achat par ligne, sa fiche, « Plus à payer » et « Remettre » */
      const pl0 = await q.evaluate(() => ({h: (document.querySelector('.rad-plans .panel-h') || {}).innerText || '', row: (document.querySelector('.rad-plans .rad-plan') || {}).innerText || '', fin: (document.querySelector('.rad-plans-fin summary') || {}).textContent || ''}));
      await q.evaluate(() => document.querySelector('.rad-plans .rad-plan').click()); await q.waitForTimeout(800);
      const pl1 = await q.evaluate(() => ({l: [...document.querySelectorAll('.rad-plan-l li')].map((x) => x.textContent), b: [...document.querySelectorAll('.rad-plan-sheet button')].map((x) => x.textContent.trim())}));
      await q.evaluate(() => [...document.querySelectorAll('.rad-plan-sheet button')].find((x) => /Plus à payer/.test(x.textContent)).click()); await q.waitForTimeout(800);
      const pl2 = await rs(), pl2b = await q.evaluate(() => ({act: document.querySelectorAll('.rad-plans .rad-plan:not(.is-retire):not(.is-fini)').length, ret: document.querySelectorAll('.rad-plan.is-retire').length, chip: !!document.querySelector('.rad-chip-plans')}));
      await q.evaluate(() => document.querySelector('.rad-plan.is-retire').click()); await q.waitForTimeout(800);
      await q.evaluate(() => [...document.querySelectorAll('.rad-plan-sheet button')].find((x) => /Remettre/.test(x.textContent)).click()); await q.waitForTimeout(800);
      const pl3 = await rs();
      ok('Radar 0.68 : « En plusieurs fois » : l’achat (PayPal, 4 fois, 2 sur 4 payées, 59,10 € restent) ; sa fiche liste les 4 échéances ; « Plus à payer » sort l’échéance du reste à payer (110,48 €), « Remettre » la rend (140,03 €)',
        /^En plusieurs fois \(1\)\s+59,10 € restent$/.test(pl0.h) && /Boutique/.test(pl0.row) && /PayPal · 4 fois · 118,20 €/.test(pl0.row) && /2 sur 4 payées/.test(pl0.row) && /Terminés ou plus à payer \(1\)/.test(pl0.fin)
        && pl1.l.length === 4 && pl1.l.filter((x) => /payée/.test(x)).length === 2 && pl1.b.includes('Plus à payer') && pl2.big === '110,48 €' && !pl2.rows.some((x) => /Boutique/.test(x)) && pl2b.act === 0 && pl2b.ret === 1 && !pl2b.chip
        && pl3.big === '140,03 €' && pl3.rows.some((x) => /Paiement en 4 fois : Boutique/.test(x)), JSON.stringify([pl0, pl1, pl2.big, pl2b, pl3.big]));
      await q.evaluate(() => [...document.querySelectorAll('.rad-notif button')].find((x) => /exemple/.test(x.textContent)).click()); await q.waitForTimeout(500);
      const ex = await q.evaluate(() => [...document.querySelectorAll('.toast')].map((x) => x.textContent).join(' | '));
      ok('Reste à payer : l\'exemple de notification part la veille (mar. 24/11 à 19 h), avec tous les prélèvements d\'au moins 20 € du lendemain et le reste d\'ici la paie', /mar\. 24\/11 à 19 h : « Demain : 2 prélèvements \(Paiement en 4 fois : Boutique, 29,55 € ; Complémentaire santé, 24,50 €\)\. Reste à payer d’ici ta paie du ven\. 27\/11 : 134,04 €\. »/.test(ex), ex);
      await q.evaluate(() => [...document.querySelectorAll('.rad-to button')][1].click()); await q.waitForTimeout(400);
      const rb = await rs();
      ok('Reste à payer : « Jusqu\'à la fin du mois » donne 161,63 € (le prélèvement du dimanche 29 part le lundi 30) et 1 413,47 € déjà prélevés depuis le 1er novembre', rb.k === 'Reste à payer d’ici la fin du mois (lun. 30/11)' && rb.big === '161,63 €' && rb.rows.length === 5
        && /^lun\. 30\/11 Assistant IA .*décalé du dim\. 29\/11/.test(rb.rows[4]) && /depuis le 1er novembre : 1\s413,47 €$/.test(rb.prog), JSON.stringify(rb));
      const ajoute = async (nom, mt, j) => { await q.evaluate(() => [...document.querySelectorAll('.rad-act button')][0].click()); await q.waitForTimeout(700);
        await q.fill('.rad-form input[type="text"]', nom); await q.fill('.rad-form input[inputmode="decimal"]', mt); await q.fill('.rad-form input[type="number"]', j);
        await q.evaluate(() => document.querySelector('.rad-form button[type="submit"]').click()); await q.waitForTimeout(700); };
      await ajoute('Salle de sport', '29,90', '26');
      const rc = await rs(); await q.reload(); await q.waitForTimeout(2500); const rd = await rs();
      ok('Reste à payer : une dépense fixe ajoutée (29,90 € le 26) compte tout de suite (191,53 €) ; l\'ajout et « fin du mois » tiennent après un rechargement', rc.big === '191,53 €' && rc.rules === 17 && rd.big === '191,53 €' && /fin du mois/.test(rd.k) && rd.seg === 'Fixes (17)', JSON.stringify([rc, rd]));
      await q.evaluate(() => [...document.querySelectorAll('.rad-to button')][0].click()); await q.waitForTimeout(300);
      await q.evaluate(() => [...document.querySelectorAll('.rad-act button')][1].click()); await q.waitForTimeout(700);
      await q.selectOption('.rad-form select', 'dernier'); await q.evaluate(() => document.querySelector('.rad-form button[type="submit"]').click()); await q.waitForTimeout(700);
      const re = await rs();
      ok('Reste à payer : paie au dernier jour du mois (lundi 30/11) : le reste court jusqu\'au 30 (191,53 €)', re.k === 'Reste à payer d’ici ta paie du lun. 30/11' && re.big === '191,53 €', JSON.stringify(re));
      await q.evaluate(() => [...document.querySelectorAll('.rad-rule')].find((x) => /Salle de sport/.test(x.textContent)).click()); await q.waitForTimeout(700);
      await q.evaluate(() => [...document.querySelectorAll('.rad-form button')].find((x) => /Retirer/.test(x.textContent)).click()); await q.waitForTimeout(700);
      const rf = await rs();
      ok('Reste à payer : « Retirer cette dépense » l\'enlève du calcul (161,63 € d\'ici la paie du 30/11)', rf.big === '161,63 €' && rf.rules === 16, JSON.stringify(rf));
      await ajoute('Cotisation', '40', '11');
      const fer = await q.evaluate(() => { document.querySelector('.rad-deja').open = true; return [...document.querySelectorAll('.rad-deja .rad-fx')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()); });
      ok('Reste à payer : un prélèvement prévu le 11 novembre (férié) part le jeudi 12', fer.some((x) => /^jeu\. 12\/11 Cotisation Autres · décalé du mer\. 11\/11 40,00 €$/.test(x)), JSON.stringify(fer));
      /* les dépenses trouvées dans ses mails : « Ajouter » (Stockage en ligne, le 14 : un samedi, donc le lundi 16, déjà passé) et « Pas une dépense fixe » */
      const pr0 = await q.evaluate(() => [...document.querySelectorAll('.rad-prop')].map((x) => x.innerText.replace(/\s+/g, ' ')));
      await q.evaluate(() => [...document.querySelectorAll('.rad-prop')].find((x) => /Stockage en ligne/.test(x.textContent)).querySelector('.row-actions button').click()); await q.waitForTimeout(600);
      await q.evaluate(() => [...[...document.querySelectorAll('.rad-prop')].find((x) => /Club de sport/.test(x.textContent)).querySelectorAll('.row-actions button')].find((b) => /Pas une/.test(b.textContent)).click()); await q.waitForTimeout(600);
      const pr1 = await q.evaluate(() => { document.querySelector('.rad-deja').open = true; return {props: document.querySelectorAll('.rad-prop').length, rules: document.querySelectorAll('.rad-rule').length, deja: [...document.querySelectorAll('.rad-deja .rad-fx')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())}; });
      /* 0.49.0 : une dépense dont le montant n'est que dans la pièce jointe : « montant à compléter », « Ajouter » ouvre la feuille */
      await q.evaluate(() => [...document.querySelectorAll('.rad-prop')].find((x) => /Garde d’enfant/.test(x.textContent)).querySelector('.row-actions button').click()); await q.waitForTimeout(700);
      const vide = await q.evaluate(() => document.querySelector('.rad-form input[inputmode="decimal"]').value);
      await q.fill('.rad-form input[inputmode="decimal"]', '310'); await q.evaluate(() => document.querySelector('.rad-form button[type="submit"]').click()); await q.waitForTimeout(700);
      await q.reload(); await q.waitForTimeout(2500);
      const pr2 = await q.evaluate(() => ({props: document.querySelectorAll('.rad-prop').length, rules: [...document.querySelectorAll('.rad-rule')].map((x) => x.innerText.replace(/\s+/g, ' '))}));
      ok('Reste à payer : 3 dépenses trouvées dans les mails à valider ; « Ajouter » la range (déjà prélevée le lundi 16), « Pas une dépense fixe » l\'écarte, et c\'est gardé après un rechargement',
        pr0.length === 3 && pr0.some((x) => /Stockage en ligne/.test(x) && /le 14 de chaque mois · vue 12 fois, depuis 11\/2025/.test(x)) && pr1.props === 1 && pr1.rules === 18 && pr1.deja.some((x) => /^lun\. 16\/11 Stockage en ligne Abonnements · décalé du sam\. 14\/11 1,99 €$/.test(x)), JSON.stringify([pr0, pr1]));
      ok('Reste à payer : une dépense « montant à compléter » (vers le 5 de chaque mois) s\'ajoute en saisissant son montant (310 €)', pr0.some((x) => /Garde d’enfant/.test(x) && /vers le 5 de chaque mois/.test(x) && /montant à compléter/.test(x)) && vide === '' && pr2.props === 0 && pr2.rules.length === 19
        && pr2.rules.some((x) => /Garde d’enfant \(exemple\) .*310,00 €/.test(x)), JSON.stringify([vide, pr2]));
      /* 0.50.0 : la preuve de chaque proposition (dernier mail) ; les raccourcis pour ce qu'aucun mail n'annonce */
      ok('Reste à payer : chaque dépense proposée montre son dernier mail (objet et date)', pr0.every((x) => /Dernier mail : « .+ », le \d\d\/\d\d/.test(x)), JSON.stringify(pr0));
      const rac0 = await q.evaluate(() => [...document.querySelectorAll('.rad-raccourci')].map((x) => x.textContent));
      await q.evaluate(() => [...document.querySelectorAll('.rad-raccourci')].find((x) => /Mutuelle/.test(x.textContent)).click()); await q.waitForTimeout(700);
      const nomPre = await q.evaluate(() => document.querySelector('.rad-form input[type="text"]').value);
      await q.fill('.rad-form input[inputmode="decimal"]', '24'); await q.fill('.rad-form input[type="number"]', '3'); await q.evaluate(() => document.querySelector('.rad-form button[type="submit"]').click()); await q.waitForTimeout(700);
      const rac1 = await q.evaluate(() => ({chips: [...document.querySelectorAll('.rad-raccourci')].map((x) => x.textContent), rules: [...document.querySelectorAll('.rad-rule')].map((x) => x.innerText.replace(/\s+/g, ' '))}));
      ok('Reste à payer : raccourcis « sans mail » (crédit déjà là : pas proposé ; « + Mutuelle » ouvre la feuille au nom écrit, et disparaît une fois ajoutée)', !rac0.some((x) => /Crédit immobilier/.test(x)) && rac0.some((x) => /Mutuelle/.test(x)) && nomPre === 'Mutuelle'
        && !rac1.chips.some((x) => /Mutuelle/.test(x)) && rac1.rules.some((x) => /^Mutuelle le 3 de chaque mois · ajouté par toi 24,00 €$/.test(x)), JSON.stringify([rac0, nomPre, rac1.chips]));
      await q.screenshot({path: path.join(SH, 'radar-reste.png')}); await ctx.close(); }
    /* 0.51.0 : la facture du mois annoncée remplace l'habituel ; une dépense qui commence plus tard (impôts mensualisés) ne compte pas avant
       (lundi 23/11/2026, paie du 28 avancée au 27 ; dépenses d'exemple posées dans le téléphone) */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.radar.reste', JSON.stringify({jusqua: 'paie', fx: [
        {id: 'td', service: 'Impôts (exemple)', cat: 'Impôts', montant: 90, jour: 25, rythme: 'mensuel', source: 'mail', debut: '2027-01-15'},
        {id: 'tp', service: 'Téléphone (exemple)', cat: 'Télécoms', montant: 16, jour: 25, rythme: 'mensuel', source: 'mail', estime: true, variable: true, prochain: {date: '2026-11-26', montant: 87.5}}]})); } catch (e) { /* rien */ } });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('radar 0.51 : ' + e.message));
      await q.clock.setFixedTime(new Date('2026-11-23T10:00:00')); await q.goto(base + '#argent'); await q.waitForTimeout(3000);
      const r = await q.evaluate(() => ({big: document.querySelector('.rad-big').textContent, rows: [...document.querySelectorAll('.rad-fixes > .panel:first-child .rad-fx')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
        rules: [...document.querySelectorAll('.rad-rule')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), large: document.documentElement.scrollWidth <= innerWidth + 1}));
      ok('Radar 0.51 : la facture du mois annoncée (87,50 € le 26/11) remplace l\'habituel (16 €, estimé) ; une dépense qui commence en janvier ne compte pas en novembre et le dit (« à partir du 15/01/2027 »)',
        r.big === '117,05 €' && r.rows.some((x) => /Téléphone \(exemple\)/.test(x) && /87,50 €/.test(x) && !/≈/.test(x)) && !r.rows.some((x) => /Impôts/.test(x)) && r.rules.some((x) => /Impôts \(exemple\)/.test(x) && /à partir du 15\/01\/2027/.test(x))
        && r.rules.some((x) => /Téléphone \(exemple\)/.test(x) && /facture du mois : 87,50 €/.test(x)) && r.large, JSON.stringify(r));
      await q.screenshot({path: path.join(SH, 'radar-051.png')}); await ctx.close(); }
    /* 0.52.0 : une paie qui arrive « entre le 5 et le 10 » (jeudi 03/12/2026) : le reste à payer court jusqu'au 10 et le dit */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.radar.reste', JSON.stringify({jusqua: 'paie', rev: {jour: 10, des: 5, avance: true}})); } catch (e) { /* rien */ } });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('radar 0.52 : ' + e.message));
      await q.clock.setFixedTime(new Date('2026-12-03T10:00:00')); await q.goto(base + '#argent'); await q.waitForTimeout(3000);
      const r = await q.evaluate(() => ({k: document.querySelector('.rad-k').textContent, paie: [...document.querySelectorAll('.rad-act button')].map((x) => x.textContent).find((x) => /Ma paie/.test(x)) || ''}));
      await q.evaluate(() => [...document.querySelectorAll('.rad-act button')].find((x) => /Ma paie/.test(x.textContent)).click()); await q.waitForTimeout(600);
      const f = await q.evaluate(() => ({labels: [...document.querySelectorAll('.rad-form .pick-label')].map((x) => x.textContent), des: (document.querySelectorAll('.rad-form select')[1] || {}).value}));
      ok('Radar 0.52 : paie « entre le 5 et le 10 » : « Reste à payer d’ici ta paie (au plus tard le jeu. 10/12) », « Ma paie : entre le 5 et le 10 », la fiche propose « Ils peuvent arriver plus tôt » (dès le 5)',
        r.k === 'Reste à payer d’ici ta paie (au plus tard le jeu. 10/12)' && /entre le 5 et le 10/.test(r.paie) && f.labels.includes('Ils peuvent arriver plus tôt') && f.des === '5', JSON.stringify([r, f]));
      await ctx.close(); }
    /* 0.56.0 : une dépense dont les factures ont cessé : l'alerte « Plus de facture » propose Retirer ou Garder ; Retirer la sort du reste à payer
       (lundi 23/11/2026, paie du 28 avancée au 27 ; dépense et alerte d'exemple) */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.radar.reste', JSON.stringify({jusqua: 'paie', fx: [{id: 'fs', service: 'Salle (exemple)', cat: 'Autres', montant: 29.9, jour: 26, rythme: 'mensuel', source: 'mail'}]})); } catch (e) { /* rien */ } });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('radar 0.56 : ' + e.message));
      await q.clock.setFixedTime(new Date('2026-11-23T10:00:00')); await q.goto(base + '#argent'); await q.waitForTimeout(3000);
      await q.evaluate(() => { window.__RADAR.alertes.push({id: 'zfs', date: '2026-11-23', type: 'silence', titre: 'Plus de facture', service: 'Salle (exemple)', montant: 29.9, fixe: 'fs', dernier: '2026-08-05', texte: 'Dernière facture le 05/08. Toujours d’actualité ?'}); });
      const av = await q.evaluate(() => ({big: document.querySelector('.rad-big').textContent, rows: [...document.querySelectorAll('.rad-fixes > .panel:first-child .rad-fx')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())}));
      await q.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^Alertes/.test(x.textContent)).click()); await q.waitForTimeout(600);
      const al = await q.evaluate(() => { const a = document.querySelector('.rad-alert.is-silence'); return a ? {t: a.innerText.replace(/\s+/g, ' '), b: [...a.querySelectorAll('.row-actions button')].map((x) => x.textContent.trim())} : null; });
      await q.evaluate(() => [...document.querySelectorAll('.rad-alert.is-silence .row-actions button')].find((x) => /Retirer/.test(x.textContent)).click()); await q.waitForTimeout(700);
      const toast1 = await q.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
      await q.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^Fixes/.test(x.textContent)).click()); await q.waitForTimeout(600);
      const ap = await q.evaluate(() => ({big: document.querySelector('.rad-big').textContent, rules: [...document.querySelectorAll('.rad-rule')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), alerte: !!document.querySelector('.rad-alert.is-silence')}));
      ok('Radar 0.56 : « Plus de facture » propose Retirer ou Garder ; « Retirer » sort la dépense du reste à payer (29,90 € de moins) et de la liste, et l’alerte disparaît',
        av.rows.some((x) => /Salle \(exemple\)/.test(x)) && !!al && /Toujours d’actualité/.test(al.t) && al.b.some((x) => /Retirer/.test(x)) && al.b.some((x) => /Garder/.test(x)) && /Retirée/.test(toast1)
        && !ap.rules.some((x) => /Salle \(exemple\)/.test(x)) && !ap.alerte && av.big !== ap.big, JSON.stringify([av, al, toast1, ap]));
      /* 0.68.0 : « Retirer » par erreur se défait : « Tes réponses », « Annuler » ; la dépense et l'alerte reviennent */
      await q.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^Alertes/.test(x.textContent)).click()); await q.waitForTimeout(500);
      const tr = await q.evaluate(() => ({s: (document.querySelector('.rad-traitees summary') || {}).textContent || '', t: ((document.querySelector('.rad-tr') || {}).textContent || '').replace(/\s+/g, ' ')}));
      await q.evaluate(() => [...document.querySelectorAll('.rad-tr button')].find((x) => /Annuler/.test(x.textContent)).click()); await q.waitForTimeout(700);
      const an = await q.evaluate(() => ({alerte: !!document.querySelector('.rad-alert.is-silence'), tr: !!document.querySelector('.rad-traitees')}));
      await q.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^Fixes/.test(x.textContent)).click()); await q.waitForTimeout(500);
      const an2 = await q.evaluate(() => ({big: document.querySelector('.rad-big').textContent, rules: [...document.querySelectorAll('.rad-rule')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())}));
      ok('Radar 0.68 : « Retirer » par erreur : « Tes réponses (1) » dit « retirée » ; « Annuler » remet la dépense (reste à payer d’avant) et l’alerte revient',
        tr.s === 'Tes réponses (1)' && /Plus de facture · Salle \(exemple\)/.test(tr.t) && /retirée/.test(tr.t) && an.alerte && !an.tr && an2.big === av.big && an2.rules.some((x) => /Salle \(exemple\)/.test(x)), JSON.stringify([tr, an, an2.big, av.big]));
      await ctx.close(); }
    /* 0.66.0 (sa demande : « mon assurance emprunteur n'est pas fixe, le contrat d'adhésion a toutes les infos ») : l'alerte « Montants de ton contrat »
       propose Appliquer ; la dépense suit alors le tableau (montant du mois, prochains changements, dernier prélèvement) ; données d'exemple */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.radar.reste', JSON.stringify({jusqua: 'mois', fx: [{id: 'fa', service: 'Assurance de prêt (exemple)', cat: 'Assurances', montant: 31.2, jour: 5, rythme: 'mensuel', source: 'toi'}]})); } catch (e) { /* rien */ } });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('radar 0.66 : ' + e.message));
      await q.clock.setFixedTime(new Date('2026-11-23T10:00:00')); await q.goto(base + '#argent'); await q.waitForTimeout(3000);
      await q.evaluate(() => { window.__RADAR.alertes.push({id: 'cfa', date: '2026-11-23', type: 'calendrier', titre: 'Montants de ton contrat', service: 'Assurance de prêt (exemple)', montant: 30.9, avant: 31.2, fixe: 'fa',
        calendrier: {paliers: [{du: '2025-09', montant: 61.2}, {du: '2025-10', montant: 31.2}, {du: '2026-08', montant: 32.5}, {du: '2026-09', montant: 35.9}, {du: '2026-10', montant: 30.9}, {du: '2027-08', montant: 32.1}, {du: '2027-09', montant: 36.4}],
          jour: 5, debut: '2025-09-05', fin: '2047-12-05', contrat: {objet: 'Votre contrat (exemple)', date: '2025-07-30'}}, texte: 'Le tableau de ton contrat donne le montant de chaque mois : 30,90 € ce mois-ci, puis 32,10 € en août 2027 (il change encore ensuite), jusqu’en décembre 2047. Appliquer ces montants ?'}); });
      await q.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^Alertes/.test(x.textContent)).click()); await q.waitForTimeout(600);
      const al = await q.evaluate(() => { const a = document.querySelector('.rad-alert.is-calendrier'); return a ? {t: a.innerText.replace(/\s+/g, ' '), b: [...a.querySelectorAll('.row-actions button')].map((x) => x.textContent.trim())} : null; });
      await q.screenshot({path: path.join(SH, 'radar-066-alerte.png')});
      await q.evaluate(() => [...document.querySelectorAll('.rad-alert.is-calendrier .row-actions button')].find((x) => /Appliquer/.test(x.textContent)).click()); await q.waitForTimeout(700);
      const toast1 = await q.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
      await q.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^Fixes/.test(x.textContent)).click()); await q.waitForTimeout(600);
      const rule = await q.evaluate(() => [...document.querySelectorAll('.rad-rule')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()).find((x) => /Assurance de prêt/.test(x)) || '');
      await q.evaluate(() => [...document.querySelectorAll('.rad-rule')].find((x) => /Assurance de prêt/.test(x.textContent)).click()); await q.waitForTimeout(900);
      const fiche = await q.evaluate(() => { const s = document.getElementById('sheet'), pal = s.querySelector('.rad-pal'), mt = [...s.querySelectorAll('.rad-form input.inp')][1];
        return {pal: pal ? [...pal.querySelectorAll('li')].map((x) => x.textContent) : [], lu: pal ? (pal.querySelector('.muted') || {}).textContent : '', ro: !!(mt && mt.readOnly), v: mt ? mt.value : '', suit: pal ? !!pal.querySelector('input[type=checkbox]:checked') : false}; });
      await q.screenshot({path: path.join(SH, 'radar-066-fiche.png')});
      await q.evaluate(() => { const f = document.querySelector('#sheet .rad-form'); f.requestSubmit(); }); await q.waitForTimeout(600);
      const garde = await q.evaluate(() => { try { const fx = JSON.parse(localStorage.getItem('jarvis.radar.reste') || '{}').fx || []; const a = fx.find((x) => x.id === 'fa'); return a ? {n: (a.paliers || []).length, fin: a.fin, m: a.montant} : null; } catch (e) { return null; } });
      ok('Radar 0.66 : « Montants de ton contrat » propose Appliquer ou Garder mon montant ; Appliquer : la dépense suit le tableau (30,90 € ce mois-ci, « selon ton contrat »), sa fiche montre les prochains changements et le dernier prélèvement, montant non modifiable tant qu’elle le suit, et l’enregistrer garde le tableau',
        !!al && /30,90 € ce mois-ci/.test(al.t) && al.b.includes('Appliquer') && al.b.includes('Garder mon montant') && /Montants appliqués/.test(toast1) && /selon ton contrat/.test(rule) && /30,90/.test(rule)
        && fiche.pal[0] === 'Ce mois-ci : 30,90 €' && fiche.pal.includes('Dès août 2027 : 32,10 €') && fiche.pal.includes('Dès septembre 2027 : 36,40 €') && fiche.pal.includes('Dernier prélèvement : décembre 2047') && /Votre contrat \(exemple\)/.test(fiche.lu)
        && fiche.ro && fiche.v === '30,90' && fiche.suit && !!garde && garde.n === 7 && garde.fin === '2047-12-05' && garde.m === 30.9, JSON.stringify([al, toast1, rule, fiche, garde]));
      await ctx.close(); }
    // 0.73.0 — B2-page-3-4
    /* lot B2 (pages 3 et 4) : fonctions pures relues dans index.html et jouées hors navigateur, puis les gestes dans la maquette */
    { const vm = require('vm'), HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const fnSrc = (start) => { const i = HTML.indexOf(start); if (i < 0) throw new Error('introuvable : ' + start); return HTML.slice(i, HTML.indexOf('\n  }\n', i) + 4); };
      const lineSrc = (start) => { const i = HTML.indexOf(start); if (i < 0) throw new Error('introuvable : ' + start); return HTML.slice(i, HTML.indexOf('\n', i)); };
      const run = (src, ctx) => { vm.runInNewContext(src, ctx); return ctx.out; };
      const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      /* page-4#9 : « Revérifier demain à 9 h » vise le lendemain civil, même la nuit d'un changement d'heure (fuseau de Paris) */
      { const code = 'const vm = require("vm"), R = Date, res = []; for (const t of ["2027-03-27T23:30:00", "2026-10-25T00:30:00", "2026-12-31T22:00:00"]) { const now = new R(t).getTime(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } } const c = {Date: D, String}; vm.runInNewContext(' + JSON.stringify(lineSrc('  const demain9 = ')) + ' + "; out = demain9();", c); res.push(c.out); } console.log(JSON.stringify(res));';
        const r = JSON.parse(require('child_process').execFileSync(process.execPath, ['-e', code], {env: Object.assign({}, process.env, {TZ: 'Europe/Paris'})}).toString());
        ok('0.73.0 : « Revérifier demain à 9 h » vise le lendemain, même la nuit des changements d\'heure (samedi 27/03 23 h 30, dimanche 25/10 0 h 30, 31/12)', r.join(' ') === '2027-03-28T09:00 2026-10-26T09:00 2027-01-01T09:00', r.join(' ')); }
      /* page-3#7 : la météo d'un voyage porte sur le voyage, pas sur la date où les dates ont été fixées ; voyage à cheval sur deux années */
      { const src = fnSrc('  function voyRange(v) {'), f = (t) => { const r = run(src + '; out = voyRange({when: ' + JSON.stringify(t) + '});', {TODAY: new Date(2026, 10, 23, 12)}); return r ? r.map(iso).join('→') : null; };
        const a = f('Fixées par Ulysse le 16/11/2026 : aller le 27/02/2027, retour le 06/03/2027'), c = f('du 26/12 au 02/01/2027'), d = f('aller le 05/03/2027, retour le 20/03/2027'), e = f('Départ fixé le 12/03/2027, retour le 20/03/2027'), g = f('aller le 26/12/2026, retour le 02/01');
        ok('0.73.0 : météo du voyage sur la bonne période (« Fixées le 16/11 : aller le 27/02, retour le 06/03 » ; « du 26/12 au 02/01/2027 » ; « Départ fixé le 12/03 » garde son départ)', a === '2027-02-27→2027-03-06' && c === '2026-12-26→2027-01-02' && d === '2027-03-05→2027-03-20' && e === '2027-03-12→2027-03-20' && g === '2026-12-26→2027-01-02', [a, c, d, e, g].join(' | ')); }
      /* page-3#8 : « Oui depuis JARVIS » jamais pour supprimer, arrêter ou mettre en pause une routine */
      { const src = lineSrc('  function isRoutineDem(d)'), f = (ask) => run(src + '; out = isRoutineDem(' + JSON.stringify({kind: 'oui', title: 'Routines (exemple)', ask, f: {}}) + ');', {});
        const r = [f('Crée ta routine Sonnette Ulysse'), f('Supprimer la routine Pegasus'), f('Arrêter la routine du soir'), f('Mets ta routine du soir en pause'), f('Désactiver la routine X')];
        ok('0.73.0 : « Oui depuis JARVIS » pour créer une routine, jamais pour la supprimer, l\'arrêter, la désactiver ou la mettre en pause', r.join(',') === 'true,false,false,false,false', r.join(',')); }
      /* page-3#9 : dates sans année au passage du Nouvel An (semaine du CRA, rappel de fermeture, offre terminée) */
      { const base0 = lineSrc('  const nearYear = '), pad2 = (n) => String(n).padStart(2, '0');
        const h0 = (tag, attrs, ...kids) => ({tag, attrs: attrs || {}, kids, append(...k) { this.kids.push(...k); }});
        const T4 = new Date(2027, 0, 4, 12), dayDiff = (x) => { const q = x.split('-').map(Number); return Math.round((new Date(q[0], q[1] - 1, q[2], 12) - T4) / 864e5); };
        const cra = run(base0 + '\n' + fnSrc('  function craWeek(d) {') + '; out = craWeek({title: "CRA client semaine du 28/12", ask: "", f: {}}).kids[0].attrs.text;',
          {TODAY: T4, pad2, dayDiff, h: h0, S: {presence: {}}, holiday: () => null, isoOf: iso, day: (n) => new Date(2027, 0, 4 + n, 12), fmt: () => 'lun', short: (n) => String(n), longDay: () => '', closeSheet: () => {}, openItem: () => {}});
        const rap = run(base0 + '\n' + fnSrc('  function rappelOf(d) {') + '; const r = rappelOf({id: "a:x", title: "Garde pendant la fermeture", ask: "Fermeture de la crèche du 24/12 au 02/01/2027"}); out = r ? r.e.iso : null;',
          {TODAY: new Date(2026, 9, 1, 12), pad2, lsGet: () => [], RAPPEL_SORTIS: 'x', S: {echeances: [{iso: '2026-12-24', title: 'Fermeture de la crèche', rem: '1 mois avant, la semaine d’avant'}]}});
        const exp = run(base0 + '\n' + lineSrc('  const OFFRE = ') + '\n' + fnSrc('  function expOf(d) {') + '; out = !!expOf({live: true, due: null, title: "Offre de bienvenue", ask: "Activer l\'offre de bienvenue, terminée le 15/12"});',
          {TODAY: new Date(2027, 0, 5, 12), pad2, expAcked: () => false, short: String});
        ok('0.73.0 : au Nouvel An, « semaine du 28/12 » lue le 4 janvier est la semaine passée ; « du 24/12 au 02/01/2027 » commence en 2026 ; « terminée le 15/12 » lue en janvier est expirée', cra === 'Ta présence, semaine du -7' && rap === '2026-12-24' && exp === true, [cra, rap, exp].join(' | ')); }
      /* page-3#12 : les échecs de Claude dits en français */
      { const f = (e) => run(fnSrc('  function aiErr(e) {') + '; out = aiErr(' + e + ');', {});
        const r = [f('new SyntaxError("JSON Parse error: Unexpected identifier")'), f('{code: "réponse illisible"}'), f('{code: "tool_error", message: "Serveur JARVIS injoignable."}'), f('{code: "tool_error"}'), f('{code: "tool_error", message: "tool_error"}')];
        ok('0.73.0 : échec du carnet ou de l\'aide à la décision en français (ni message JSON anglais, ni « tool_error »)', r.join(' | ') === 'réponse illisible | réponse illisible | Serveur JARVIS injoignable | Claude ne répond pas pour l’instant | Claude ne répond pas pour l’instant', r.join(' | ')); }
      /* page-4#1 et page-4#5 : « pas encore soumis » n'est pas « fait » ; le Journal (5000 lignes) n'est mis en forme qu'une fois pour toutes les échéances */
      { let calls = 0; const now = new Date().toISOString(), rows = [];
        for (let i = 0; i < 4999; i++) rows.push({'Bot': 'Athéna', 'Date et heure': now, 'Sujet': 'Veille', 'Détail': 'Envoyée.'});
        rows.push({'Bot': 'Chronos', 'Date et heure': now, 'Sujet': 'CRA client novembre', 'Détail': 'pas encore soumis, le portail est en panne'});
        const ctx = {pad2: (n) => String(n).padStart(2, '0'), BOT: {medusa: {name: 'Chronos'}}, HIST_VIDES: new Set(), day: (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; }, LV: {t: {jour: {rows}}}, S: {canal: [], activite: []},
          lvBot: (x) => { calls++; return x === 'Chronos' ? 'medusa' : 'griffon'; }, lvStamp: (s) => (s ? new Date(s) : null), fmt: () => '01/01', lvName: () => 'Chronos', lvFrIso: () => null, N: () => 0};
        const src = [lineSrc('  const nrm = '), lineSrc('  const ECH_FAIT = '), lineSrc('  const ECH_NEG = '), lineSrc('  const ECH_VIDES = '), lineSrc('  const ECH_JR = '), fnSrc('  function echJr() {'), fnSrc('  function echDone(e, jr0) {')].join('\n');
        vm.runInNewContext(src + '\n; this.echDone = echDone;', ctx);
        const es = [...Array(10)].map((_, i) => ({bot: 'medusa', nature: 'bot', n: 0, title: i ? 'Échéance numéro ' + i : 'CRA client novembre'}));
        const neg = es.map((e) => ctx.echDone(e)), calls1 = calls;
        ctx.LV.t.jour = {rows: rows.slice(0, 4999).concat([{'Bot': 'Chronos', 'Date et heure': now, 'Sujet': 'CRA client novembre', 'Détail': 'Soumis sur le portail.'}])};
        const pos = ctx.echDone(es[0]);
        ok('0.73.0 : échéance « faite par le bot » : « pas encore soumis » ne compte pas, « soumis sur le portail » oui ; le Journal de 5000 lignes mis en forme une seule fois pour 10 échéances', neg.every((x) => x === null) && calls1 === 5000 && !!pos && /Soumis sur le portail/.test(pos.text), JSON.stringify({neg: neg.filter(Boolean).length, calls1, pos: pos && pos.text})); } }
    /* 0.85.0 (son retour du 26/11/2026) : le brouillon en tête comme un vrai mail, complété ou modifié ici, puis envoyé par JARVIS, jamais par Iris */
    { const q = await page('#demandes');
      const btn = (re, sel) => q.evaluate(([src, s]) => { const b = [...document.querySelectorAll(s || '#sheet .sheet-actions .btn')].find((x) => new RegExp(src).test(x.textContent)); if (!b) return false; b.click(); return true; }, [re, sel]);
      const champ = (o) => q.evaluate((o) => { for (const [id, v] of Object.entries(o)) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); } }, o);
      await q.evaluate(() => { const c = [...document.querySelectorAll('article.draft-card')].find((x) => /Sans destinataire/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^Compléter/.test(x.textContent)).click(); }); await q.waitForTimeout(700);
      const v = await q.evaluate(() => ({acts: [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim()), t: document.getElementById('sheet').textContent, mailAvant: !!document.querySelector('#sheet .mailx + .sheet-actions')}));
      ok('brouillon sans destinataire : le mail d\'abord, « Ajouter un destinataire » en premier, rien pour Iris ni de payant', v.mailAvant && v.acts[0] === 'Ajouter un destinataire' && !v.acts.includes('Envoyer ce mail') && !/Iris/.test(v.t) && !/passage/.test(v.t) && /Texte sans destinataire/.test(v.t), JSON.stringify(v).slice(0, 400));
      await btn('^Ajouter un destinataire'); await q.waitForTimeout(400);
      const f = await q.evaluate(() => ({form: !!document.querySelector('#sheet form.mailx.is-edit'), to: (document.getElementById('mx-to') || {}).value, body: (document.getElementById('mx-body') || {}).value, acts: document.querySelectorAll('#sheet .sheet-actions .btn').length}));
      ok('brouillon : la modification ouvre À, Cc, Objet et Texte remplis, sans les boutons d\'envoi de l\'ancien texte', f.form && f.to === '' && /Texte sans destinataire/.test(f.body) && f.acts === 0, JSON.stringify(f));
      await champ({'mx-to': 'pas-une-adresse'}); await btn('^Enregistrer sans envoyer', '#sheet .mailx-btns .btn'); await q.waitForTimeout(400);
      const e1 = await q.evaluate(() => ({err: (document.querySelector('#sheet .mailx-err') || {}).textContent || '', majs: (window.__MAIL.majs || []).length}));
      ok('brouillon : une adresse à corriger est dite, rien n\'est enregistré', /Adresse à corriger : pas-une-adresse/.test(e1.err) && e1.majs === 0, JSON.stringify(e1));
      await champ({'mx-to': 'gestion@syndic-dupont.example; copro@example.org', 'mx-subject': 'Relance syndic : dégât des eaux', 'mx-body': 'Bonjour,\nJe me permets de vous relancer.\nJe serai absent le 30 novembre.\nCordialement'});
      await btn('^Enregistrer sans envoyer', '#sheet .mailx-btns .btn'); await q.waitForTimeout(700);
      const e2 = await q.evaluate(() => ({maj: (window.__MAIL.majs || []).slice(-1)[0], titre: document.getElementById('sheet-title').textContent, lu: !document.querySelector('#sheet form.mailx'), body: (document.querySelector('#sheet .mailx-body') || {}).textContent || '', chips: [...document.querySelectorAll('#sheet .mailx-chip')].map((x) => x.textContent), acts: [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim()), toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '), sends: (window.__calls || []).filter((c) => c.tool === 'send_message').length}));
      ok('brouillon : « Enregistrer sans envoyer » le remplace dans Gmail (deux destinataires, objet, texte) ; la feuille montre le nouveau mail, « Envoyer ce mail » puis « Modifier » ; rien ne part', e2.maj && e2.maj.draftId === 'DRAFT2' && e2.maj.to.join() === 'gestion@syndic-dupont.example,copro@example.org' && e2.maj.subject === 'Relance syndic : dégât des eaux' && /absent le 30 novembre/.test(e2.maj.body) && e2.lu && /absent le 30 novembre/.test(e2.body) && e2.chips.length === 2 && e2.titre === 'Relance syndic : dégât des eaux' && e2.acts[0] === 'Envoyer ce mail' && e2.acts[1] === 'Modifier' && /Brouillon enregistré/.test(e2.toasts) && e2.sends === 0, JSON.stringify(e2).slice(0, 500));
      await btn('^Modifier'); await q.waitForTimeout(300);
      await q.evaluate(() => { const e = document.getElementById('mx-body'); e.value = e.value.replace('Cordialement', 'Bien à vous'); e.dispatchEvent(new Event('input')); });
      await btn('^Enregistrer et envoyer', '#sheet .mailx-btns .btn'); await q.waitForTimeout(700);
      const c1 = await q.evaluate(() => ({confirm: [...document.querySelectorAll('#sheet .btn')].some((x) => /^Oui : envoyer ce mail/.test(x.textContent)), body: (document.querySelector('#sheet .mailx-body') || {}).textContent || '', majs: (window.__MAIL.majs || []).length}));
      ok('brouillon : « Enregistrer et envoyer » enregistre, puis demande la même confirmation, le nouveau texte sous les yeux', c1.confirm && /Bien à vous/.test(c1.body) && c1.majs === 2, JSON.stringify(c1).slice(0, 300));
      const avant = await q.evaluate(() => window.__G.Canal.length);
      await btn('^Oui : envoyer ce mail', '#sheet .btn'); await q.waitForTimeout(6500);
      const s1 = await q.evaluate(() => ({sends: (window.__calls || []).filter((c) => c.tool === 'send_message').map((c) => c.input.draftId), drafts: window.__MAIL.drafts.map((d) => d.id), canal: window.__G.Canal.length, toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || ')}));
      ok('brouillon : envoyé par JARVIS (le brouillon modifié), aucune ligne dans le Canal, aucune sonnette', s1.sends.join() === 'DRAFT2' && !s1.drafts.includes('DRAFT2') && s1.canal === avant && !/sonnette/.test(s1.toasts), JSON.stringify(s1).slice(0, 400));
      /* un brouillon lié à une demande : « Modifier le mail » ouvre la même modification */
      await q.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const c = [...document.querySelectorAll('article')].find((x) => /Relance syndic/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }); await q.waitForTimeout(900);
      const dm = await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim()));
      await btn('^Modifier le mail'); await q.waitForTimeout(500);
      const dm2 = await q.evaluate(() => ({to: (document.getElementById('mx-to') || {}).value, sujet: (document.getElementById('mx-subject') || {}).value}));
      ok('demande avec brouillon : « Envoyer ce mail » puis « Modifier le mail », qui ouvre le brouillon en modification', dm[0] === 'Envoyer ce mail' && dm[1] === 'Modifier le mail' && dm2.to === 'gestion@syndic-dupont.example' && dm2.sujet === 'Relance syndic', JSON.stringify([dm, dm2]));
      await q.context().close(); }
    /* 0.85.0 : l'espace « Travail » (maquette : window.__TRAVAIL, même forme que GET /api/travail) */
    { const q = await page('#espaces');
      const tile = await q.evaluate(() => { const b = document.querySelector('.esp-tile[data-go="travail"]'); return b ? b.textContent : ''; });
      ok('Travail : une tuile dans Espaces, la première', /Travail/.test(tile) && await q.evaluate(() => document.querySelector('.esp-grid').firstElementChild.dataset.go === 'travail'), tile);
      await q.evaluate(() => document.querySelector('.esp-tile[data-go="travail"]').click()); await q.waitForTimeout(800);
      const v = await q.evaluate(() => ({titres: [...document.querySelectorAll('.trv-card h3')].map((x) => x.textContent), frise: document.querySelectorAll('.trv-ev').length, etapes: document.querySelectorAll('.trv-card[data-trv="mois"] .trv-et > div').length, fait: document.querySelectorAll('.trv-card[data-trv="mois"] .trv-et .fait').length, barre: (document.querySelector('.trv-card[data-trv="mois"] .trv-barre') || {}).getAttribute('aria-label')}));
      ok('Travail : une carte par routine avec son titre précis, « Ce qui vient », les étapes et la barre d’avancement', v.titres.includes('Abonnement Claude') && v.titres.includes('CRA du client (hebdo)') && v.titres.length === 7 && v.frise === 3 && v.etapes === 5 && v.fait === 3 && v.barre === '3 étapes sur 5', JSON.stringify(v));
      await q.evaluate(() => document.querySelector('.ux-seg button[data-f="cra"]').click()); await q.waitForTimeout(400);
      const c = await q.evaluate(() => [...document.querySelectorAll('.trv-card h3')].map((x) => x.textContent));
      ok('Travail : le filtre « CRA » ne garde que les deux CRA', c.length === 2 && c.every((x) => /CRA/.test(x)), JSON.stringify(c));
      await q.evaluate(() => document.querySelector('.trv-card[data-trv="mois"]').click()); await q.waitForTimeout(700);
      const s = await q.evaluate(() => ({titre: document.getElementById('sheet-title').textContent, mails: document.querySelectorAll('#sheet .trv-mails > div').length, acts: [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim())}));
      ok('Travail : le détail en feuille du bas (étapes, mails envoyés, « Voir mes jours du mois »)', s.titre === 'CRA de la société de portage' && s.mails === 1 && s.acts[0] === 'Voir mes jours du mois', JSON.stringify(s));
      await q.context().close(); }
    /* 0.94.0 : les réponses aux deux mails du mois (scénario « reponses ») : la carte « CRA du mois », sa feuille, la ligne de « Pour moi » */
    { const q = await pageWith({reponses: true}, '#travail'); await q.waitForTimeout(1200);
      const c = await q.evaluate(() => { const k = document.querySelector('.trv-card[data-trv="mois"]'); return {fait: k.querySelectorAll('.trv-et .fait').length, encours: (k.querySelector('.trv-et .encours') || {}).textContent || '', toi: k.classList.contains('toi'), alerte: [...k.querySelectorAll('.trv-alerte')].map((x) => x.textContent), mails: [...k.querySelectorAll('.trv-mails > .trv-mail')].map((m) => ({t: m.querySelector('.trv-mail-t').textContent, rep: [...m.querySelectorAll('.trv-rep')].map((x) => x.textContent)})), liens: k.querySelectorAll('a').length}; });
      ok('0.94 : carte « CRA du mois » : 4 étapes faites, « Rattaché » en cours, « CRA signé reçu : à rattacher » en « À toi », l’alerte de fin de mission dit « réponse reçue … : à lire »', c.fait === 4 && /Rattaché/.test(c.encours) && c.toi && c.alerte.some((x) => /Fin de mission le 30\/11\/2026\. Réponse à ton mail de prolongation reçue le 26\/11 à 16 h 20 : à lire\./.test(x)) && c.alerte.some((x) => /^À toi : CRA signé reçu : à rattacher sur le portail/.test(x)), JSON.stringify(c));
      ok('0.94 : carte : chaque mail « envoyé le … », puis « Réponse de <nom> le … », PDF signalé, extrait de 160 caractères au plus ; aucun lien dans la carte (c’est un bouton)', c.mails.length === 2 && /CRA Novembre 2026 » · envoyé le 26\/11 à 09 h 02/.test(c.mails[0].t) && /CRA signé reçu$/.test(c.mails[0].t) && /^Réponse de Contact Client le 26\/11 à 14 h 05PDF« Bonjour, ci-joint le CRA signé/.test(c.mails[0].rep[0]) && /^Réponse de Équipe Missions le 26\/11 à 16 h 20« /.test(c.mails[1].rep[0]) && (c.mails[1].rep[0].match(/« (.*) »$/) || ['', ''])[1].length === 160 && c.liens === 0, JSON.stringify(c.mails));
      await q.evaluate(() => document.querySelector('.trv-card[data-trv="mois"]').click()); await q.waitForTimeout(700);
      const s = await q.evaluate(() => ({acts: [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim()), liens: [...document.querySelectorAll('#sheet .trv-mails a.trv-ouvrir')].map((a) => a.textContent + ' ' + a.getAttribute('href') + ' ' + a.target + ' ' + a.rel), rep: document.querySelectorAll('#sheet .trv-rep').length}));
      ok('0.94 : feuille : « C’est rattaché » en premier ; « Ouvrir le mail » sur la réponse (le fil dans Gmail, nouvel onglet) ; une adresse qui n’est pas http(s) ne donne aucun bouton', s.acts[0] === 'C’est rattaché' && s.rep === 2 && s.liens.length === 1 && s.liens[0] === 'Ouvrir le mail https://mail.google.com/mail/#all/filcra0001 _blank noopener', JSON.stringify(s));
      await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^C’est rattaché/.test(x.textContent)).click()); await q.waitForTimeout(900);
      const r = await q.evaluate(() => { const k = document.querySelector('.trv-card[data-trv="mois"]'); return {fait: k.querySelectorAll('.trv-et .fait').length, toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || ')}; });
      ok('0.94 : « C’est rattaché » : l’étape « Rattaché » passe à faite (5 sur 5)', r.fait === 5 && /CRA signé rattaché/.test(r.toasts), JSON.stringify(r));
      await q.context().close(); }
    { const q = await pageWith({reponses: true}, '#demandes'); await q.waitForTimeout(2600);
      const l = await q.evaluate(() => [...document.querySelectorAll('.pm-travail')].map((x) => ({t: x.firstElementChild.textContent, toi: x.classList.contains('toi')})));
      ok('0.94 : « Pour moi » : la ligne de Travail dit ce qui attend (« CRA signé reçu : à rattacher », la réponse à lire), une seule ligne', l.length === 1 && l[0].toi && l[0].t === 'CRA signé reçu : à rattacher · Réponse à ton mail de prolongation : à lire', JSON.stringify(l));
      await q.evaluate(() => document.querySelector('.pm-travail').click()); await q.waitForTimeout(900);
      ok('0.94 : cette ligne ouvre l’espace Travail', await q.evaluate(() => location.hash === '#travail' && !!document.querySelector('.trv-card[data-trv="mois"]')));
      await q.context().close(); }
    /* 0.97.0 : le CRA signé déposé sur le portail par Hermes après son oui (scénarios « reponses » + « signe ») : la carte « CRA du mois », sa feuille, la ligne de « Pour moi » */
    { const carte = (q) => q.evaluate(() => { const k = document.querySelector('.trv-card[data-trv="mois"]'); return {fait: k.querySelectorAll('.trv-et .fait').length, bloque: (k.querySelector('.trv-et .bloque') || {}).textContent || '', alerte: [...k.querySelectorAll('.trv-alerte')].map((x) => x.textContent), signe: [...k.querySelectorAll('.trv-signe')].map((x) => x.getAttribute('data-signe') + ' ' + x.textContent), liens: k.querySelectorAll('a').length}; });
      const feuille = async (q) => { await q.evaluate(() => document.querySelector('.trv-card[data-trv="mois"]').click()); await q.waitForTimeout(700);
        return q.evaluate(() => ({acts: [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim()), signe: [...document.querySelectorAll('#sheet .trv-signe')].map((x) => x.getAttribute('data-signe') + ' ' + [...x.querySelectorAll('p')].map((p) => p.textContent).join(' | ')), lien: [...document.querySelectorAll('#sheet .trv-signe a.trv-ouvrir')].map((a) => a.textContent + ' ' + a.getAttribute('href'))})); };
      const appui = async (q, re) => { await q.evaluate((src) => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => new RegExp(src).test(x.textContent)).click(), re); await q.waitForTimeout(700); };
      const toasts = (q) => q.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
      let q = await pageWith({reponses: true, signe: 'pret'}, '#travail'); await q.waitForTimeout(1200);
      const c = await carte(q), s = await feuille(q);
      ok('0.97 : CRA signé prêt : la carte dit « À toi : CRA signé reçu : Hermes le dépose sur le portail ? » avec le fichier et sa taille ; « Rattaché » reste en cours', c.fait === 4 && c.alerte.some((x) => /^À toi : CRA signé reçu : Hermes le dépose sur le portail \? « CRA signé\.pdf », 47 Ko\. Il a trouvé où le déposer \(essai à blanc : rien n’est déposé\)\./.test(x)) && c.liens === 0, JSON.stringify(c));
      ok('0.97 : feuille : « Oui, déposer » puis « Je le fais moi-même » (plus de « C’est rattaché » tant qu’il n’a pas choisi) ; le fichier, sa taille et « Ouvrir le mail »', s.acts[0] === 'Oui, déposer' && s.acts[1] === 'Je le fais moi-même' && !s.acts.includes('C’est rattaché') && s.signe.length === 1 && s.signe[0] === 'pret Fichier : CRA signé.pdf · 47 Ko' && s.lien.join() === 'Ouvrir le mail https://mail.google.com/mail/#all/filcra0001', JSON.stringify(s));
      await appui(q, '^Oui, déposer'); await q.waitForTimeout(2200);   /* la question s'écrit lettre à lettre */
      const conf = await q.evaluate(() => ({texte: document.getElementById('sheet').textContent.replace(/\s+/g, ' '), oui: [...document.querySelectorAll('#sheet .sa-main .btn.danger-fill')].map((x) => x.textContent), fichier: !!document.querySelector('#sheet .trv-signe')}));
      ok('0.97 : « Oui, déposer » demande une confirmation, en un appui : « Hermes dépose « CRA signé.pdf » (47 Ko) sur le portail ? », le fichier reste affiché, bouton « Oui, déposer »', /Hermes dépose « CRA signé\.pdf » \(47 Ko\) sur le portail \?/.test(conf.texte) && conf.oui.join() === 'Oui, déposer' && conf.fichier, JSON.stringify([conf.oui, conf.fichier]));
      await q.evaluate(() => document.querySelector('#sheet .sa-main .btn.danger-fill').click()); await q.waitForTimeout(900);
      const c2 = await carte(q), t2 = await toasts(q), s2 = await feuille(q);
      ok('0.97 : son oui donné : « Ton oui est noté : Hermes dépose… » dans la carte, plus de « À toi » pour le CRA signé, plus aucun bouton de dépôt', /Ton oui est noté/.test(t2) && c2.signe.length === 1 && /^oui Ton oui est noté : Hermes dépose le CRA signé sur le portail/.test(c2.signe[0]) && !c2.alerte.some((x) => /CRA signé/.test(x)) && !s2.acts.some((x) => /déposer|moi-même|rattaché/i.test(x)), JSON.stringify([t2, c2, s2.acts]));
      await q.context().close();
      q = await pageWith({reponses: true, signe: 'pret'}, '#travail'); await q.waitForTimeout(1200); await feuille(q); await appui(q, '^Je le fais moi-même'); await q.waitForTimeout(400);
      const c3 = await carte(q), t3 = await toasts(q), s3 = await feuille(q);
      ok('0.97 : « Je le fais moi-même » : l’ancien chemin revient (« à rattacher sur le portail », « C’est rattaché » en premier)', /Dépose-le sur le portail, puis « C’est rattaché »/.test(t3) && c3.alerte.some((x) => /^À toi : CRA signé reçu : à rattacher sur le portail/.test(x)) && s3.acts[0] === 'C’est rattaché' && !s3.acts.includes('Oui, déposer'), JSON.stringify([t3, c3.alerte, s3.acts]));
      await q.context().close();
      q = await pageWith({reponses: true, signe: 'pret'}, '#demandes'); await q.waitForTimeout(2600);
      const l = await q.evaluate(() => [...document.querySelectorAll('.pm-travail')].map((x) => ({t: x.firstElementChild.textContent, toi: x.classList.contains('toi')})));
      ok('0.97 : « Pour moi » : la ligne de Travail dit « CRA signé reçu : Hermes le dépose sur le portail ? »', l.length === 1 && l[0].toi && l[0].t === 'CRA signé reçu : Hermes le dépose sur le portail ? · Réponse à ton mail de prolongation : à lire', JSON.stringify(l));
      await q.context().close();
      q = await pageWith({reponses: true, signe: 'verifie'}, '#travail'); await q.waitForTimeout(1200);
      const c4 = await carte(q), s4 = await feuille(q);
      ok('0.97 : tant qu’Hermes vérifie le portail : la carte le dit sans rien lui demander pour le CRA signé ; « C’est rattaché » reste possible, pas de « Oui, déposer »', c4.signe.join() === 'verifie CRA signé reçu : Hermes vérifie le portail…' && !c4.alerte.some((x) => /CRA signé/.test(x)) && s4.acts[0] === 'C’est rattaché' && !s4.acts.includes('Oui, déposer') && /^verifie CRA signé reçu : Hermes vérifie le portail… \| Fichier : CRA signé\.pdf · 47 Ko$/.test(s4.signe[0]), JSON.stringify([c4, s4]));
      await q.context().close();
      q = await pageWith({reponses: true, signe: 'echec'}, '#travail'); await q.waitForTimeout(1200);
      const c5 = await carte(q), s5 = await feuille(q);
      ok('0.97 : dépôt en échec : « CRA signé pas déposé : à faire à la main » avec la raison, étape « Rattaché » bloquée ; « Réessayer avec Hermes » et « C’est rattaché »', /Rattaché/.test(c5.bloque) && c5.alerte.some((x) => /^À toi : CRA signé pas déposé : à faire à la main\. Le portail a refusé le fichier\. Le PDF reste gardé\./.test(x)) && s5.acts[0] === 'Réessayer avec Hermes' && s5.acts[1] === 'C’est rattaché', JSON.stringify([c5, s5.acts]));
      await q.context().close();
      q = await pageWith({reponses: true, signe: 'fait'}, '#travail'); await q.waitForTimeout(1200);
      const c6 = await carte(q), s6 = await feuille(q);
      ok('0.97 : déposé par Hermes : 5 étapes sur 5, « CRA signé déposé sur le portail par Hermes le 27/11 à 14 h 05. », plus aucun bouton de dépôt ni de rattachement', c6.fait === 5 && c6.signe.join() === 'fait CRA signé déposé sur le portail par Hermes le 27/11 à 14 h 05.' && !c6.alerte.some((x) => /CRA signé/.test(x)) && !s6.acts.some((x) => /déposer|moi-même|rattaché/i.test(x)), JSON.stringify([c6, s6.acts]));
      await q.context().close(); }
    { const q = await page('#demandes'); await q.waitForTimeout(2400);
      ok('0.94 : sans rien qui attend dans Travail, « Pour moi » n’a pas de ligne de Travail en plus', await q.evaluate(() => document.querySelectorAll('.pm-travail.toi').length === 0));
      await q.context().close(); }
    /* 0.86.0 : une note de frais d'Hermes à valider (la première de sa sorte) : dans « Pour moi », la note entière, « Valider et créer » */
    { const q = await pageWith({notes: true}, '#demandes');
      await q.waitForTimeout(800);
      const c = await q.evaluate(() => ({panel: [...document.querySelectorAll('#view h2')].some((x) => /Notes de frais à valider/.test(x.textContent)), card: !!document.querySelector('article.ndf-card[data-note="box:2026-11"]'), first: (document.querySelector('#view h2') || {}).textContent || ''}));
      ok('note à valider : en tête de « Pour moi », sa carte (montant, « Relire et valider »)', c.panel && c.card && /Notes de frais à valider/.test(c.first), JSON.stringify(c));
      await q.evaluate(() => [...document.querySelector('article.ndf-card').querySelectorAll('button')].find((x) => /^Relire et valider/.test(x.textContent)).click()); await q.waitForTimeout(700);
      const s = await q.evaluate(() => ({titre: document.getElementById('sheet-title').textContent, acts: [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim()), champs: [...document.querySelectorAll('#sheet .ndf-box dt')].map((x) => x.textContent), montant: (document.querySelector('#sheet .ndf-sum b') || {}).textContent || '', pj: (document.querySelector('#sheet .ndf-pj') || {}).textContent || ''}));
      ok('note à valider : la feuille montre la note entière (champs, montant, justificatif) avant « Valider et créer »', s.titre === 'Note de la box de novembre' && s.acts[0] === 'Valider et créer' && s.champs.includes('Vendeur') && s.champs.includes('Montant TTC') && /39,00/.test(s.montant) && /facture\.pdf/.test(s.pj), JSON.stringify(s));
      await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Valider et créer/.test(x.textContent)).click()); await q.waitForTimeout(400);
      const conf = await q.evaluate(() => [...document.querySelectorAll('#sheet .btn')].some((x) => /^Oui : valider et créer/.test(x.textContent)));
      await q.evaluate(() => { const b = [...document.querySelectorAll('#sheet .btn')].find((x) => /^Oui : valider et créer/.test(x.textContent)); if (b) b.click(); }); await q.waitForTimeout(900);
      const f = await q.evaluate(() => ({toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '), card: !!document.querySelector('article.ndf-card')}));
      ok('note à valider : « Valider et créer » demande confirmation, puis la note quitte « Pour moi » (Hermes la crée)', conf && /Note validée/.test(f.toasts) && !f.card, JSON.stringify(f));
      await q.evaluate(() => { location.hash = '#voir-note-box-2026-11'; }); await q.waitForTimeout(900);
      ok('note : le lien d’une notification (#voir-note-…) ouvre la note', await q.evaluate(() => !document.getElementById('sheet').hidden && document.getElementById('sheet-title').textContent === 'Note de la box de novembre'));
      await q.context().close(); }
    { const q = await pageWith({draftPj: true}, '#demandes');
      await q.evaluate(() => { const c = [...document.querySelectorAll('article.draft-card')].find((x) => /Dossier location/.test(x.textContent)); if (c) [...c.querySelectorAll('button')].find((x) => /^Relire et envoyer/.test(x.textContent)).click(); }); await q.waitForTimeout(700);
      const pj = await q.evaluate(() => ({acts: [...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.firstChild.textContent.trim()), note: (document.querySelector('#sheet .mailx-note') || {}).textContent || '', pj: (document.querySelector('#sheet .mailx-pj') || {}).textContent || ''}));
      ok('brouillon avec pièce jointe : montrée, « Modifier » absent, la note dit d\'ouvrir Gmail', !pj.acts.includes('Modifier') && pj.acts[0] === 'Envoyer ce mail' && /pièce jointe/.test(pj.note) && /dossier\.pdf/.test(pj.pj), JSON.stringify(pj));
      await q.context().close(); }
    /* page-3#1 : Gmail refuse l'envoi : ni ligne « Brouillon envoyé », ni dossier « en attente », ni sonnette ; le brouillon et la demande restent */
    { const q = await pageWith({fail: {send_message: 'tool_error'}}, '#demandes');
      await q.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const c = [...document.querySelectorAll('article')].find((x) => /Résiliation StreamPlus/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }); await q.waitForTimeout(900);
      const avant = await q.evaluate(() => ({canal: window.__G.Canal.length, dos: JSON.stringify(window.__G.Dossiers.find((r) => r[0] === 'Résiliation StreamPlus'))}));
      await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Envoyer ce mail/.test(x.textContent)).click()); await q.waitForTimeout(500);
      const t0 = await q.evaluate(() => Date.now());
      await q.evaluate(() => [...document.querySelectorAll('#sheet .btn')].find((x) => /^Oui : envoyer ce mail/.test(x.textContent)).click()); await q.waitForTimeout(6500);
      const r = await q.evaluate((t) => ({writes: (window.__calls || []).filter((c) => c.t >= t && /append_values|update_values/.test(c.tool)).map((c) => c.input.range), sends: (window.__calls || []).filter((c) => c.t >= t && c.tool === 'send_message').length,
        canal: window.__G.Canal.length, dos: JSON.stringify(window.__G.Dossiers.find((x) => x[0] === 'Résiliation StreamPlus')), toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '),
        card: [...document.querySelectorAll('article')].some((x) => /Résiliation StreamPlus/.test(x.textContent)), drafts: window.__MAIL.drafts.map((d) => d.id)}), t0);
      ok('0.73.0 : envoi refusé par Gmail : rien d\'autre n\'est écrit (ni Canal, ni dossier, ni sonnette), « Mail non envoyé », la demande et le brouillon restent', !r.writes.length && r.sends === 1 && r.canal === avant.canal && r.dos === avant.dos && /Mail non envoyé/.test(r.toasts) && /aucune sonnette/.test(r.toasts) && r.card && r.drafts.includes('DRAFT3'), JSON.stringify(r).slice(0, 400));
      await q.context().close(); }
    /* page-3#2, page-3#4, page-3#5, page-3#11, page-3#12 dans Pour moi */
    { const q = await page('#demandes');
      const ouvre = async (re) => { await q.evaluate(() => { const s = document.querySelector('#sheet:not([hidden]) .sheet-close'); if (s) s.click(); }); await q.waitForTimeout(400);
        await q.evaluate((src) => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const c = [...document.querySelectorAll('article')].find((x) => new RegExp(src).test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }, re); await q.waitForTimeout(900);
        return q.evaluate(() => [...document.querySelectorAll('#sheet button')].map((x) => x.textContent.trim())); };
      /* page-3#11 : la remise à zéro dite avec ses minutes */
      await q.tap('#status .st.is-pause'); await q.waitForTimeout(500);
      await q.evaluate(() => { const b = [...document.querySelectorAll('#sheet button')].find((x) => /^Changer la date/.test(x.textContent.trim())); if (b) b.click(); }); await q.waitForTimeout(700);
      const ps = await q.evaluate(() => document.getElementById('sheet').innerText.replace(/\s+/g, ' '));
      ok('0.73.0 : la fenêtre « Pause de Grok » donne l\'heure de la remise à zéro avec ses minutes (12h47)', /Chaque \S+ à 12h47 \(prochaine :/.test(ps), (ps.match(/Remise à zéro.{0,60}/) || [''])[0]);
      /* page-3#12 : l'aide à la décision dit « probable », pas « Likely » */
      await ouvre('Passeport'); await q.evaluate(() => [...document.querySelectorAll('#sheet button')].find((x) => /second avis de Claude|Aide à la décision/.test(x.textContent)).click()); await q.waitForTimeout(1500);
      const aid = await q.evaluate(() => (document.querySelector('#sheet .aid') || {}).textContent || '');
      ok('0.73.0 : aide à la décision en français : « (probable) », jamais « (Likely) »', /\(probable\)/.test(aid) && !/Likely/.test(aid), aid.slice(0, 160));
      /* page-3#2 : un « Lien : javascript:… » écrit par un bot n'a pas de bouton ; un lien https en a un */
      await q.evaluate(() => { const G = window.__G, d0 = G['À toi'][3][0]; G['À toi'].push([d0, 'Iris', 'Lien piégé (exemple)', 'À faire : Confirmer le rendez-vous | Lien : javascript:alert(1)'], [d0, 'Iris', 'Lien sûr (exemple)', 'À faire : Confirmer le rendez-vous | Lien : https://exemple.fr/rdv']); location.hash = '#voir-recent'; });
      await q.waitForTimeout(2500);
      const bad = await ouvre('Lien piégé \\(exemple\\)'), good = await ouvre('Lien sûr \\(exemple\\)');
      ok('0.73.0 : « Lien : javascript:… » d\'une demande : aucun bouton « Ouvrir le lien » ; un lien https garde le sien', !bad.some((x) => /^Ouvrir le lien/.test(x)) && good.some((x) => /^Ouvrir le lien/.test(x)), JSON.stringify([bad.slice(0, 4), good.slice(0, 4)]));
      await q.evaluate(() => { const s = document.querySelector('#sheet:not([hidden]) .sheet-close'); if (s) s.click(); }); await q.waitForTimeout(400);
      /* page-3#5 : « Rien à faire » puis « Annuler » : le mail revient ; « Supprimer ce brouillon » puis « Annuler » : le brouillon revient */
      const tri = () => q.evaluate(() => [...document.querySelectorAll('#pm-mail li.tri b')].map((x) => x.textContent));
      const m0 = await tri();
      await q.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); [...document.querySelector('#pm-mail li.tri').querySelectorAll('button')].find((x) => /^Rien à faire/.test(x.textContent)).click(); }); await q.waitForTimeout(600);
      const m1 = await tri();
      await q.evaluate(() => document.querySelector('#toasts .toast-undo').click()); await q.waitForTimeout(800);
      const m2 = await tri(), hid = await q.evaluate(() => localStorage.getItem('jarvis.mails.tries') || '[]');
      const annul = () => q.evaluate(() => { const b = [...document.querySelectorAll('#toasts .toast-undo, #sheet button')].find((x) => /^Annuler$/.test(x.textContent.trim())); if (b) b.click(); return !!b; });
      const brou = () => q.evaluate(() => [...document.querySelectorAll('article')].some((x) => /Brouillon prêt/.test(x.textContent) && /Texte sans destinataire/.test(x.textContent)));
      const b0 = await brou();
      await q.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const c = [...document.querySelectorAll('article')].find((x) => /Brouillon prêt/.test(x.textContent) && /Texte sans destinataire/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^Supprimer/.test(x.textContent.trim())).click(); }); await q.waitForTimeout(900);
      await q.evaluate(() => { const b = [...document.querySelectorAll('#sheet .btn')].find((x) => /^Oui : supprimer/.test(x.textContent)); if (b) b.click(); }); await q.waitForTimeout(700);
      const b1 = await brou(), un = await annul(); await q.waitForTimeout(900); const b2 = await brou();
      ok('0.73.0 : « Annuler » après « Rien à faire » fait revenir le mail (plus caché sur l\'appareil) ; après « Supprimer ce brouillon », le brouillon revient', m0.length >= 2 && m1.length === m0.length - 1 && m2.join('|') === m0.join('|') && hid === '[]' && b0 && !b1 && un && b2, JSON.stringify({m0, m1, m2, hid, b0, b1, un, b2}));
      /* page-3#4 : la ligne de la tâche a bougé (tri, suppression) : rien n'est écrit sur la ligne d'une autre tâche */
      await q.evaluate(() => { const T = window.__G['Tâches'], a = T[1]; T[1] = T[2]; T[2] = a; });
      const t0 = await q.evaluate(() => Date.now());
      await q.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const c = [...document.querySelectorAll('#pm-taches article')].find((x) => /Appeler le plombier/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^C'est fait/.test(x.textContent.trim())).click(); });
      await q.waitForTimeout(6500);
      const tk = await q.evaluate((t) => ({upd: (window.__calls || []).filter((c) => c.t >= t && c.tool === 'update_values' && /Tâches/.test(c.input.range)).length, st: window.__G['Tâches'].slice(1).map((x) => x[1] + ':' + x[3]), toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || ')}), t0);
      ok('0.73.0 : Tâches : « C\'est fait » vérifie que la ligne n\'a pas bougé (rien écrit sur une autre tâche)', tk.upd === 0 && /la ligne a bougé/.test(tk.toasts) && tk.st.filter((x) => /:Fait$/.test(x)).join() === 'Vieille tâche:Fait', JSON.stringify(tk).slice(0, 300));
      await q.context().close(); }
    /* page-3#3 et page-3#6 : un voyage mis en pause puis repris garde son étape ; une case cochée reste cochée après la relecture */
    { let q = await page('#voyages');
      const voy = (re) => q.evaluate((src) => [...document.querySelectorAll('.voy .fam-hit')].find((x) => new RegExp(src).test(x.textContent)).click(), re).then(() => q.waitForTimeout(800));
      const statut = () => q.evaluate(() => window.__G['Voyages'].find((r) => r[0] === 'Lisbonne')[1]);
      const btn = (re) => q.evaluate((src) => { const b = [...document.querySelectorAll('#view button')].find((x) => new RegExp(src).test(x.innerText)); if (b) b.click(); return !!b; }, re);
      await voy('Lisbonne'); const p1 = await btn('^Mettre en pause'); await q.waitForTimeout(6500); const s1 = await statut();
      await q.waitForTimeout(1200); const p2 = await btn('^Reprendre le projet'); await q.waitForTimeout(6500); const s2 = await statut();
      ok('0.73.0 : voyage mis en pause puis repris : « En pause (Options) », puis « Options » de nouveau (plus « Dates »)', p1 && p2 && s1 === 'En pause (Options)' && s2 === 'Options', JSON.stringify([p1, s1, p2, s2]));
      await q.context().close(); q = await page('#voyages'); await voy('Tunisie');
      const t = await q.evaluate(() => { const li = [...document.querySelectorAll('ul.checks li:not(.is-done)')].find((x) => /passeports/i.test(x.textContent)); li.querySelector('.chk').click(); return li.querySelector('.chk-t').textContent; });
      await q.waitForTimeout(7500);
      const ck = await q.evaluate((tt) => ({todo: [...document.querySelectorAll('ul.checks li:not(.is-done) .chk-t')].map((x) => x.textContent).includes(tt), mem: localStorage.getItem('jarvis.voy.coches') || ''}), t);
      ok('0.73.0 : voyage : une case cochée de « Ce qui attend » ne se décoche plus à la relecture du Canal', !ck.todo && ck.mem.includes(t), JSON.stringify(ck));
      await q.context().close(); }
    /* page-3#10 : deux fins de pause dans la même page ouverte : la sonnette est proposée les deux fois */
    { const q = await page('#demandes');
      const st = (ms) => { const d = new Date(ms), p2 = (n) => String(n).padStart(2, '0'); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + 'h' + p2(d.getMinutes()); };
      const fin = (v) => q.evaluate((vv) => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); window.__G['Faits'].find((x) => x[1] === "Grok en pause jusqu'au")[2] = vv; location.hash = '#voir-recent'; }, v);
      const toasts = () => q.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
      await fin(st(Date.now() - 3 * 3600000)); await q.waitForTimeout(2000); const a1 = await toasts();
      await q.waitForTimeout(6000); const v1 = await q.evaluate(() => window.__G['Faits'].find((x) => x[1] === "Grok en pause jusqu'au")[2]);
      await fin(st(Date.now() - 3600000)); await q.waitForTimeout(2000); const a2 = await toasts();
      await q.evaluate(() => { const b = document.querySelector('#toasts .toast-undo'); if (b) b.click(); });
      ok('0.73.0 : Grok repart deux fois dans la même page ouverte : la sonnette de reprise est proposée les deux fois', /Grok est reparti/.test(a1) && /^Reprise sonnée le/.test(v1) && /Grok est reparti/.test(a2), JSON.stringify([a1.slice(0, 90), v1, a2.slice(0, 90)]));
      await q.context().close(); }
    /* page-4#1 : une échéance que le Journal dit « pas encore soumise » n'est pas « faite » */
    { const q = await page('#agenda');
      await q.evaluate(() => { const G = window.__G, d = new Date(), p2 = (n) => String(n).padStart(2, '0'), dd = p2(d.getDate()) + '/' + p2(d.getMonth() + 1), fr = dd + '/' + d.getFullYear();
        G['Échéances'].push([fr, 'Timesheet Négatif de la semaine du ' + dd, 'Travail', '', 'À venir', 'Chronos', '', "Un bot s'en occupe"]);
        G['Journal'].push([fr + ' ' + p2(Math.max(0, d.getHours() - 1)) + 'h05', 'Chronos', 'ETAT', 'Timesheet Négatif semaine du ' + dd, 'Pas encore soumis, le portail est en panne.']);
        location.hash = '#voir-recent'; });
      await q.waitForTimeout(2500); await q.evaluate(() => { location.hash = '#agenda'; }); await q.waitForTimeout(1500);
      const rows = await q.evaluate(() => [...document.querySelectorAll('#view .dl-row, #view .agt-row')].map((x) => x.innerText.replace(/\s+/g, ' ')).filter((t) => /Timesheet Négatif/.test(t)));
      ok('0.73.0 : Journal « Pas encore soumis » : l\'échéance reste à venir (plus « fait ✓ »)', rows.length > 0 && rows.every((t) => !/fait ✓/.test(t)), rows.join(' | ').slice(0, 160));
      await q.context().close(); }
    /* page-4#3 : aucune lecture ne réussit (serveur sans iPhone relié) : l'accueil le dit et cesse d'écrire */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { const si = window.setInterval, ci = window.clearInterval; window.__iv = new Set(); window.setInterval = function (f, ms, ...a) { const id = si.call(window, f, ms, ...a); if (ms === 34) window.__iv.add(id); return id; }; window.clearInterval = function (id) { window.__iv.delete(id); return ci.call(window, id); }; });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('accueil sans lecture : ' + e.message)); await q.goto(base + '?serveur#accueil'); await q.waitForTimeout(6500);
      const r = await q.evaluate(() => ({n: window.__iv.size, tiles: [...document.querySelectorAll('.hud-ro')].map((x) => x.innerText.replace(/\s+/g, ' ')), say: (document.querySelector('.hud-say') || {}).textContent || ''}));
      ok('0.73.0 : accueil sans aucune lecture réussie : « lecture impossible » (agenda, pour toi), la phrase le dit, plus de minuterie qui tourne', r.n === 0 && r.tiles.some((x) => /^AGENDA — lecture impossible/.test(x)) && r.tiles.some((x) => /^POUR TOI — lecture impossible/.test(x)) && /Je n’arrive pas à lire/.test(r.say), JSON.stringify(r).slice(0, 300));
      await q.context().close(); }
    /* page-4#4 : le Canal arrive bien avant « À toi » : aucune alerte « Nouvelle demande » au lancement */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { let real; Object.defineProperty(window, 'claude', {configurable: true, get: () => real, set: (v) => { real = {use: async (n) => { const x = await v.use(n); if (n !== 'mcp' || !x) return x;
        return Object.assign({}, x, {watchTool: (server, tool, input, handler, opts) => { if (!/À toi/.test((input && input.range) || '')) return x.watchTool(server, tool, input, handler, opts); let stop = null, dead = false; const t = setTimeout(() => { if (!dead) stop = x.watchTool(server, tool, input, handler, opts); }, 1500); return () => { dead = true; clearTimeout(t); if (stop) stop(); }; }}); }}; }}); });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('alertes au lancement : ' + e.message)); await q.goto(base + '#accueil'); await q.waitForTimeout(5500);
      const n = await q.evaluate(() => [...document.querySelectorAll('.alert-t')].map((x) => x.innerText.replace(/\s+/g, ' ')));
      ok('0.73.0 : lancement avec « À toi » lu 1,5 s après le Canal : aucune alerte « Nouvelle demande » en rafale', n.length === 0, n.join(' | ').slice(0, 200));
      await ctx.close(); }
    /* page-4#6, page-4#7, srv-a#9 : la discussion ouvre Papiers et Pour moi ; État des systèmes ; sonnette suivie du point final */
    { const q = await page('#accueil');
      const dis = async (t) => { if (await q.evaluate(() => document.getElementById('chat').hidden)) { await q.tap('.talk-slot .jv-btn'); await q.waitForTimeout(900); } await q.fill('#chat-in', t); await q.tap('#chat .chat-row .btn.main'); await q.waitForTimeout(1500); return q.evaluate(() => [location.hash, !!document.getElementById('pm-taches')]); };
      const h1 = await dis('Ouvre mes papiers'), h2 = await dis('Ouvre mes tâches');
      ok('0.73.0 : « Ouvre mes papiers » mène à Papiers, « Ouvre mes tâches » à Pour moi (Mes tâches)', h1[0] === '#papiers' && h2[0] === '#demandes' && h2[1], JSON.stringify([h1, h2]));
      await q.evaluate(() => { const x = document.querySelector('#chat:not([hidden]) .chat-head .icon-btn'); if (x) x.click(); window.__G['Faits'].push(['Assistants', 'Sonnette Chronos', 'Ma sonnette : bots+chronos@mail.grokbot.com.', '', '']); location.hash = '#voir-recent'; }); await q.waitForTimeout(2500);
      await q.evaluate(() => { location.hash = '#reglages'; }); await q.waitForTimeout(1500);
      const t = await q.evaluate(() => document.getElementById('view').innerText.replace(/\s+/g, ' '));
      ok('0.73.0 : État des systèmes : la voix nommée comme sur l\'iPhone (Contenu énoncé), plus « Read & Speak » ni « téléphone »', /Voix Voix de l'iPhone \(Réglages, Accessibilité, Contenu énoncé\)/.test(t) && !/Read & Speak|du téléphone/.test(t), (t.match(/Micro .{0,140}/) || [''])[0]);
      ok('0.73.0 : sonnette écrite dans une phrase qui finit par un point : l\'adresse est reconnue (1 bot en direct)', /Sonnettes 1 bot en direct, les autres par Iris/.test(t), (t.match(/Sonnettes .{0,60}/) || [''])[0]);
      await q.context().close(); }
    /* page-4#10 : « Courrier à trier » compte tous les mails, pas les 8 affichés */
    { const q = await page('#demandes');
      await q.evaluate(() => { const M = window.__MAIL, t = M.inbox[1]; for (let i = 0; i < 9; i++) { const c = JSON.parse(JSON.stringify(t)); c.id = 'tx' + i; (c.messages || []).forEach((m) => { m.id = 'mx' + i; m.threadId = 'tx' + i; m.subject = 'Exemple ' + i; m.internalDate = String(Date.now() - 600000 * (i + 1)); }); M.inbox.push(c); } location.hash = '#voir-courrier'; });
      await q.waitForTimeout(2500);
      const r = await q.evaluate(() => ({sum: (document.querySelector('#pm-mail summary .aside') || {}).textContent || '', fils: (document.querySelector('#pm-mail .live-mail .panel-h .aside') || {}).textContent || '', li: document.querySelectorAll('#pm-mail li.tri').length}));
      const n1 = +(r.sum.match(/^(\d+) mails$/) || [])[1], n2 = +(r.fils.match(/^(\d+) fils/) || [])[1];
      ok('0.73.0 : « Courrier à trier » annonce le même nombre que le panneau (plus de plafond à 8)', r.li === 8 && n1 > 8 && n1 === n2, JSON.stringify(r));
      await q.context().close(); }
    /* page-4#11 et page-4#12 : accords (« sa sonnette », « 1 terminée ») ; deux réponses d'Iris ensemble : un bandeau qui les compte */
    { const q = await page('#accueil');
      const rows = await q.evaluate(() => { const c = window.__G['Canal'], d = c[c.length - 1][0]; c.push([d, 'Rabie', 'Iris', 'Ordre', 'Cherche le bail (exemple)', 'À faire', '', ''], [d, 'Rabie', 'Iris', 'Ordre', 'Cherche la quittance (exemple)', 'À faire', '', '']); location.hash = '#voir-recent'; return [c.length - 1, c.length]; });
      await q.waitForTimeout(2200);
      await q.evaluate((rr) => { const c = window.__G['Canal']; rr.forEach((r, i) => { c[r - 1][5] = 'Fait'; c[r - 1][6] = i ? 'Quittance trouvée (exemple).' : 'Bail trouvé (exemple).'; }); document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); location.hash = '#voir-recent'; }, rows);
      await q.waitForTimeout(2500);
      const a = await q.evaluate(() => [...document.querySelectorAll('.alert-t:not(.out)')].map((t) => t.innerText.replace(/\s+/g, ' ')));
      ok('0.73.0 : deux réponses d\'Iris dans la même relecture : un seul bandeau « Iris a répondu » qui dit « 2 réponses »', a.length === 1 && /Iris a répondu/.test(a[0]) && /2 réponses/.test(a[0]), a.join(' | ').slice(0, 200));
      await q.evaluate(() => { document.querySelectorAll('.alert-t').forEach((t) => t.remove()); const c = window.__G['Canal']; c.forEach((r, i) => { if (i && /^À faire/.test(r[5]) && !['Iris', 'Kairos'].includes(r[2])) r[5] = 'Fait'; }); location.hash = '#voir-recent'; }); await q.waitForTimeout(2500);
      await q.evaluate(() => { location.hash = '#equipe'; }); await q.waitForTimeout(1200); await q.evaluate(() => document.querySelector('.ux-seg [data-f="cout"]').click()); await q.waitForTimeout(800);
      const fq = await q.evaluate(() => { const pn = [...document.querySelectorAll('.panel')].find((x) => /^File d'attente des bots/.test((x.querySelector('h2') || {}).textContent || '')); return pn ? pn.innerText.replace(/\s+/g, ' ') : ''; });
      await q.evaluate(() => { const c = window.__G['Canal']; let one = false; c.forEach((r, i) => { if (!i || (r[1] !== 'Rabie' && r[2] !== 'Rabie')) return; if (!one && /^Fait/.test(r[5])) { one = true; return; } r[5] = 'Attend ton oui'; }); location.hash = '#voir-recent'; }); await q.waitForTimeout(2500);
      await q.evaluate(() => { location.hash = '#suivi'; }); await q.waitForTimeout(1500);
      const hc = await q.evaluate(() => ([...document.querySelectorAll('.aside')].find((x) => / en cours · \d+ terminées?$/.test(x.textContent)) || {}).textContent || '');
      ok('0.73.0 : accords : « Kairos n\'a pas encore sa sonnette … qui lui relaie », « 1 terminée »', /Kairos n'a pas encore sa sonnette : un mail réveille Iris, qui lui relaie le mot « Canal »\./.test(fq) && / · 1 terminée$/.test(hc), JSON.stringify([(fq.match(/Kairos n'a.{0,90}/) || [''])[0], hc]));
      await q.context().close(); }
    /* page-4#13 (décision du propriétaire) : un appui sur MÉTÉO redemande la position quand elle a plus de 3 h */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max'], geolocation: {latitude: 43.3, longitude: 5.37}, permissions: ['geolocation']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.pos', JSON.stringify({lat: 48.85, lon: 2.35, at: Date.now() - 864e5})); } catch (e) { /* rien */ } });
      const urls = []; await ctx.route('https://api.open-meteo.com/**', (r) => { urls.push(r.request().url()); r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({current: {temperature_2m: 18, apparent_temperature: 17, weather_code: 0}, daily: {time: ['a', 'b'], weather_code: [0, 1], temperature_2m_min: [12, 11], temperature_2m_max: [20, 19], precipitation_probability_max: [0, 10]}})}); });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('météo : ' + e.message)); await q.goto(base + '#accueil'); await q.waitForTimeout(3500);
      await q.evaluate(() => { delete window.__METEO; }); const n0 = urls.length;
      await q.evaluate(() => document.querySelector('.hud-ro.q-tr').click()); await q.waitForTimeout(2000);
      const r = await q.evaluate(() => { try { return JSON.parse(localStorage.getItem('jarvis.pos')); } catch (e) { return null; } }), got = urls.slice(n0);
      ok('0.73.0 : MÉTÉO touchée avec une position de la veille : la position est redemandée et la météo relue au nouvel endroit', got.some((u) => /latitude=43\.3&longitude=5\.37/.test(u)) && r && r.lat === 43.3 && Date.now() - r.at < 120000, JSON.stringify({got: got.map((u) => u.slice(0, 80)), r}));
      await ctx.close(); }
    // 0.73.0 — C (décisions du 23/11/2026)
    /* srv-routes#3 « Retirer dans Réglages » : la liste des appareils reliés dans la carte « Serveur JARVIS » (serveur simulé : ses réponses
       sont écrites ici ; le vrai serveur a son banc, jarvis-os/server/tests/fiab-c.test.mjs). Noms et dates inventés. */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: 'jeton-essai'})); } catch (e) { /* rien */ } });
      const T = new Date(2026, 10, 23, 14, 5).getTime(), AP = [{id: 'aaaaaaaaaaaa', nom: 'JARVIS OS · iPhone', at: T, moi: true}, {id: 'bbbbbbbbbbbb', nom: 'JARVIS OS · iPad', at: T - 864e5, moi: false}], retraits = [];
      await ctx.route(base + 'api/**', async (r) => { const u = new URL(r.request().url()), j = (s, o) => r.fulfill({status: s, contentType: 'application/json', body: JSON.stringify(o)});
        if (u.pathname === '/api/appareils') return j(200, {appareils: AP});
        if (u.pathname === '/api/appareils/retirer') { const bd = JSON.parse(r.request().postData() || '{}'); retraits.push(bd.id); const i = AP.findIndex((x) => x.id === bd.id); const n = AP[i].nom; AP.splice(i, 1); return j(200, {ok: true, nom: n, notifications: 1, raccourci: true, appareils: AP}); }
        return j(404, {error: 'Adresse inconnue du serveur.'}); });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('appareils : ' + e.message)); await q.goto(base + '?serveur#reglages'); await q.waitForTimeout(3500);
      const lis = () => q.evaluate(() => [...document.querySelectorAll('.set-card .app-it')].map((x) => ({t: x.innerText.replace(/\s+/g, ' ').trim(), btn: [...x.querySelectorAll('button')].map((y) => y.textContent.trim())})));
      const l0 = await lis(), carte = await q.evaluate(() => { const c = [...document.querySelectorAll('.set-card')].find((x) => /^Serveur JARVIS/.test(x.textContent)); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
      ok('0.73.0 — C : Réglages, carte « Serveur JARVIS » : les appareils reliés (nom, « relié le … »), « Cet appareil » sans bouton sur le sien, « Retirer » sur l’autre ; « Délier cet iPhone » reste',
        l0.length === 2 && /^JARVIS OS · iPhone · relié le 23 novembre( 2026)? à 14h05 Cet appareil$/.test(l0[0].t) && !l0[0].btn.length && /^JARVIS OS · iPad · relié le 22 novembre/.test(l0[1].t) && l0[1].btn.join() === 'Retirer' && /Délier cet iPhone/.test(carte), JSON.stringify([l0, carte]));
      await q.evaluate(() => [...document.querySelectorAll('.app-it')][1].querySelector('button').click()); await q.waitForTimeout(700);
      const conf = await q.evaluate(() => { const s = document.getElementById('sheet'); return s && !s.hidden ? s.innerText.replace(/\s+/g, ' ') : ''; }), avant = retraits.length;
      await q.waitForFunction(() => /« Recréer la clé »\)\./.test(document.getElementById('sheet').innerText), null, {timeout: 6000}).catch(() => null);   /* la phrase s'écrit peu à peu (environ 2 s) */
      const confTout = await q.evaluate(() => { const s = document.getElementById('sheet'); return s && !s.hidden ? s.innerText.replace(/\s+/g, ' ') : ''; });
      await q.evaluate(() => { const x = [...document.querySelectorAll('#sheet button')].find((y) => /Oui, retirer/.test(y.textContent)); if (x) x.click(); }); await q.waitForTimeout(1800);
      const l1 = await lis(), dit = await q.evaluate(() => [...document.querySelectorAll('.set-wrap .set-msg')].map((x) => x.textContent).join(' | '));
      ok('0.73.0 — C : « Retirer » demande d’abord confirmation (« Retirer « JARVIS OS · iPad » ? », rien ne part avant), puis le retire et le dit ; la liste ne garde que cet appareil',
        /Retirer « JARVIS OS · iPad » \?/.test(conf) && /Oui, retirer/.test(conf) && avant === 0 && retraits.join() === 'bbbbbbbbbbbb' && /« JARVIS OS · iPad » est retiré/.test(dit) && l1.length === 1 && /Cet appareil$/.test(l1[0].t), JSON.stringify([conf.slice(0, 200), retraits, dit, l1]));
      ok('0.73.0 — C : « Retirer » dit que la clé du raccourci « Jarvis » marche encore et renvoie à « Recréer la clé » (confirmation et message, le serveur ayant une clé)',
        /sa clé marche encore : recrée-la aussi \(carte « Siri et bouton Action », « Recréer la clé »\)/.test(confTout) && /S’il avait ton raccourci « Jarvis », recrée sa clé : carte « Siri et bouton Action », « Recréer la clé »/.test(dit), JSON.stringify([confTout.slice(0, 400), dit]));
      await q.screenshot({path: path.join(SH, 'reglages-appareils.png')});
      /* doc-ouverts#3 « Feuille Pendant ton absence » : de retour au premier plan, une notification de 20 minutes (envoyée pendant l'absence,
         pas encore vue) est proposée dans la feuille, rien ne bouge sans son geste ; une seule de 5 minutes s'ouvre directement, comme avant */
      const vis = (hd) => q.evaluate((x) => { Object.defineProperty(document, 'hidden', {configurable: true, get: () => x}); Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => (x ? 'hidden' : 'visible')}); document.dispatchEvent(new Event('visibilitychange')); }, hd);
      let NOTIFS = [], vues = [];
      await ctx.route(base + 'api/notifs**', async (r) => { const u = new URL(r.request().url()); if (u.pathname === '/api/notifs/vue') { vues.push(...(JSON.parse(r.request().postData() || '{}').ids || [])); return r.fulfill({status: 200, contentType: 'application/json', body: '{"ok":true}'}); } return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({notifs: NOTIFS})}); });
      const etatN = () => q.evaluate(() => { const s = document.getElementById('sheet'); return {hash: location.hash, feuille: s && !s.hidden ? s.innerText.replace(/\s+/g, ' ') : '', toast: [...document.querySelectorAll('.toast')].map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')}; });
      const fermer = () => q.evaluate(() => { const s = document.getElementById('sheet'), f = s && [...s.querySelectorAll('button')].find((x) => /Fermer/.test(x.textContent)); if (f) f.click(); document.querySelectorAll('.toast').forEach((t) => t.remove()); });
      const H0 = new Date(2026, 10, 24, 10, 0).getTime();
      await fermer(); await q.clock.setFixedTime(new Date(H0)); await q.evaluate(() => { location.hash = '#reglages'; }); await q.waitForTimeout(600);
      await vis(true); await q.clock.setFixedTime(new Date(H0 + 25 * 60e3)); NOTIFS = [{id: 'n20', at: H0 + 5 * 60e3, title: 'Paiement refusé (essai)', body: 'Abonnement Exemple', url: '/#agenda'}];
      await vis(false); await q.waitForTimeout(2000); const r20 = await etatN();
      ok('0.73.0 — C : notification de 20 minutes au retour : la feuille « Pendant ton absence » la propose, la page ne bouge pas toute seule', /pendant ton absence/i.test(r20.feuille) && /1 notification\b/.test(r20.feuille) && /Paiement refusé \(essai\)/.test(r20.feuille) && r20.hash === '#reglages' && vues.includes('n20'), JSON.stringify(r20));
      await q.evaluate(() => { const x = [...document.querySelectorAll('#sheet .notif-row')].find((y) => /Paiement refusé/.test(y.textContent)); if (x) x.click(); }); await q.waitForTimeout(1200);
      const r20b = await etatN();
      ok('0.73.0 — C : un appui sur la notification de la feuille ouvre ce qu’elle annonce', r20b.hash === '#agenda' && !r20b.feuille, JSON.stringify(r20b));
      await fermer(); await q.evaluate(() => { location.hash = '#reglages'; }); await q.waitForTimeout(800);
      const H1 = H0 + 40 * 60e3; await q.clock.setFixedTime(new Date(H1)); await vis(true); await q.clock.setFixedTime(new Date(H1 + 10 * 60e3));
      NOTIFS = [{id: 'n5', at: H1 + 5 * 60e3, title: 'Rappel (essai)', body: '', url: '/#agenda'}, {id: 'n20', at: H0 + 5 * 60e3, title: 'Paiement refusé (essai)', body: '', url: '/#agenda', vue: H0 + 26 * 60e3}];
      await vis(false); await q.waitForTimeout(2000); const r5 = await etatN();
      ok('0.73.0 — C : une seule notification de 5 minutes au retour : ouverte directement (comme avant), et dite', r5.hash === '#agenda' && !r5.feuille && /Ouvert depuis ta notification/.test(r5.toast), JSON.stringify(r5));
      await ctx.close(); }
    /* page#1 : l'app laissée ouverte la nuit (chargée le 24 à 23h50), deux notifications à 7h30 et 7h40, retour le 25 à 8h00, serveur lent
       (300 ms) : la feuille « Pendant ton absence » s'ouvre et la page ne se recharge pas avant (avant : rechargée à 0,6 s, tout était perdu) ;
       fermée, le retour suivant passe au nouveau jour. page#2 : une fiche ouverte avant l'absence n'est pas remplacée : un bandeau à toucher,
       et les notifications ne sont marquées vues qu'une fois la feuille montrée. Titres inventés. */
    { const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT);
      await ctx.addInitScript(() => { try { localStorage.setItem('jarvis.settings', JSON.stringify({serverToken: 'jeton-essai'})); } catch (e) { /* rien */ } });
      let NOTIFS = []; const vues = [];
      await ctx.route(base + 'api/**', async (r) => { const u = new URL(r.request().url()), j = (st, o) => r.fulfill({status: st, contentType: 'application/json', body: JSON.stringify(o)});
        if (u.pathname === '/api/notifs/vue') { vues.push(...(JSON.parse(r.request().postData() || '{}').ids || [])); return j(200, {ok: true}); }
        if (u.pathname === '/api/notifs') { await new Promise((z) => setTimeout(z, 300)); return j(200, {notifs: NOTIFS}); }
        if (u.pathname === '/api/appareils') return j(200, {appareils: [{id: 'aaaaaaaaaaaa', nom: 'JARVIS OS · iPhone', at: new Date(2026, 10, 20, 9, 0).getTime(), moi: true}]});
        return j(404, {error: 'Adresse inconnue du serveur.'}); });
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('nuit : ' + e.message));
      const vis = (hd) => q.evaluate((x) => { Object.defineProperty(document, 'hidden', {configurable: true, get: () => x}); Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => (x ? 'hidden' : 'visible')}); document.dispatchEvent(new Event('visibilitychange')); }, hd);
      const etatN = () => q.evaluate(() => { const s = document.getElementById('sheet'); return {mark: window.__nuit || 0, hash: location.hash, feuille: s && !s.hidden ? s.innerText.replace(/\s+/g, ' ') : '', toast: [...document.querySelectorAll('.toast')].map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | '), today: document.getElementById('today').textContent}; });
      await q.clock.setFixedTime(new Date(2026, 10, 24, 23, 50)); await q.goto(base + '?serveur#reglages'); await q.waitForTimeout(3500);
      await q.evaluate(() => { window.__nuit = 1; });
      await vis(true); await q.clock.setFixedTime(new Date(2026, 10, 25, 8, 0));
      NOTIFS = [{id: 'nn2', at: new Date(2026, 10, 25, 7, 40).getTime(), title: 'Kairos : prix en baisse (essai)', body: '', url: '/#achats'}, {id: 'nn1', at: new Date(2026, 10, 25, 7, 30).getTime(), title: 'Iris a répondu (essai)', body: '', url: '/#demandes'}];
      await vis(false); await q.waitForTimeout(2500); const n1 = await etatN();
      ok('0.73.0 : app ouverte toute la nuit, deux notifications à 7h30 et 7h40, retour à 8h00 (serveur lent) : la feuille « Pendant ton absence » s’ouvre, sans rechargement de minuit avant',
        n1.mark === 1 && n1.hash === '#reglages' && /pendant ton absence/i.test(n1.feuille) && /2 notifications/.test(n1.feuille) && /Iris a répondu \(essai\)/.test(n1.feuille) && vues.includes('nn1') && vues.includes('nn2'), JSON.stringify([n1, vues]));
      await q.keyboard.press('Escape'); await q.waitForTimeout(500); await vis(true); await vis(false); await q.waitForTimeout(3500); const n2 = await etatN();
      ok('0.73.0 : la feuille fermée, au retour suivant la page passe au nouveau jour (le 25)', n2.mark === 0 && /\b25\b/.test(n2.today), JSON.stringify(n2));
      await q.evaluate(() => { const x = [...document.querySelectorAll('.set-card button')].find((y) => /Délier cet iPhone/.test(y.textContent)); if (x) x.click(); }); await q.waitForTimeout(700);
      const avantF = (await etatN()).feuille, H = new Date(2026, 10, 25, 9, 0).getTime(), v0 = vues.length;
      await q.clock.setFixedTime(new Date(H)); await vis(true); await q.clock.setFixedTime(new Date(H + 40 * 60e3));
      NOTIFS = [{id: 'nb2', at: H + 30 * 60e3, title: 'Rappel (essai 2)', body: '', url: '/#agenda'}, {id: 'nb1', at: H + 20 * 60e3, title: 'Iris a répondu (essai 2)', body: '', url: '/#demandes'}];
      await vis(false); await q.waitForTimeout(2000); const p1 = await etatN();
      ok('0.73.0 : une fiche ouverte avant l’absence (« Délier cet iPhone ? ») reste ; un bandeau « Pendant ton absence · 2 notifications » s’affiche à la place de la feuille, rien n’est encore marqué vu',
        /Délier cet iPhone/.test(avantF) && /Délier cet iPhone/.test(p1.feuille) && /Pendant ton absence/.test(p1.toast) && /2 notifications : touche pour les voir/.test(p1.toast) && vues.length === v0, JSON.stringify([avantF.slice(0, 60), p1, vues.slice(v0)]));
      await q.evaluate(() => { const t = [...document.querySelectorAll('.alert-t')].find((x) => /Pendant ton absence/.test(x.textContent)), v = t && [...t.querySelectorAll('button')].find((y) => y.textContent.trim() === 'Voir'); if (v) v.click(); }); await q.waitForTimeout(900);
      const p2 = await etatN();
      ok('0.73.0 : « Voir » sur ce bandeau montre la feuille « Pendant ton absence » ; elles sont marquées vues à ce moment-là', /pendant ton absence/i.test(p2.feuille) && /2 notifications/.test(p2.feuille) && /Rappel \(essai 2\)/.test(p2.feuille) && vues.slice(v0).sort().join() === 'nb1,nb2', JSON.stringify([p2, vues.slice(v0)]));
      await ctx.close(); }
    /* page-5#1 « Oui à la voix seulement » : en discussion écrite, un « oui » tapé n'exécute pas la proposition de Claude : il part à Claude, et le
       bouton de la carte reste la seule validation (en mains libres, le « oui » l'exécute toujours : banc-serveur.mjs, « voix : un ordre à un bot… ») */
    { const q = await page('#accueil');
      const dis = async (t) => { if (await q.evaluate(() => document.getElementById('chat').hidden)) { await q.tap('.talk-slot .jv-btn'); await q.waitForTimeout(900); } await q.fill('#chat-in', t); await q.tap('#chat .chat-row .btn.main'); await q.waitForTimeout(1800); };
      const etat = () => q.evaluate(() => ({n: (window.__samples || []).length, dernier: ((window.__samples || []).slice(-1)[0] || {}).last || '', cartes: [...document.querySelectorAll('#chat .msg.proposal')].map((x) => x.innerText.replace(/\s+/g, ' ')), eux: [...document.querySelectorAll('#chat .msg.them')].map((x) => x.innerText.replace(/\s+/g, ' ')).slice(-2)}));
      await dis('Prépare un ordre pour Iris'); const e1 = await etat(); await dis('oui'); const e2 = await etat(), canal = await q.evaluate(() => (window.__calls || []).filter((c) => c.tool === 'append_values' && /Canal/.test((c.input && c.input.range) || '')).length);
      ok('0.73.0 — C : discussion écrite : « Prépare un ordre pour Iris » puis « oui » tapé : la carte reste ouverte (« Envoyer à Iris »), rien n’est écrit dans le Canal, et le « oui » part à Claude',
        e1.cartes.some((c) => /Iris/.test(c) && /Envoyer à Iris/.test(c)) && e2.cartes.some((c) => /Envoyer à Iris/.test(c)) && !e2.cartes.some((c) => /Envoyé/.test(c)) && e2.n === e1.n + 1 && /\boui\b/i.test(e2.dernier) && !e2.eux.some((x) => /C’est parti/.test(x)) && canal === 0, JSON.stringify([e1.n, e2.n, e2.dernier.slice(-40), e2.cartes.slice(-1), e2.eux, canal]));
      await q.context().close(); }
    /* B3 (reste) : Équipe › Coût ne construit plus tout l'ancien Suivi (missions, relances, santé…) pour n'en garder que le coût */
    { const q = await page('#equipe'); await q.evaluate(() => document.querySelector('.ux-seg [data-f="cout"]').click()); await q.waitForTimeout(900);
      const t = await q.evaluate(() => [...document.querySelectorAll('#view .panel h2, #view section > header h2')].map((x) => x.textContent.trim()));
      ok('0.73.0 — C : Équipe › Coût ne montre que le coût (Coût de la semaine, file d’attente des bots, Claude cette semaine)', t.length > 0 && t.every((x) => /^(Coût de la semaine|File d'attente des bots|Claude cette semaine)/.test(x)), JSON.stringify(t));
      await q.context().close(); }
    /* aucune rubrique n'affiche de texte cassé */
    const broken = [];
    for (const t of ['accueil', 'demandes', 'agenda', 'suivi', 'achats', 'voyages', 'sorties', 'papiers', 'argent', 'equipe', 'automatisations', 'reglages']) {
      p = await page('#' + t);
      if (await p.evaluate(() => /\[object \w+\]|\bundefined\b|\bNaN\b/.test(document.getElementById('view').innerText))) broken.push(t);
    }
    ok('aucune rubrique n\'affiche « [object …] », « undefined » ou « NaN »', !broken.length, broken.join(', '));
    p = await page('#reglages');
    ok('réglages en maquette : explication', await p.evaluate(() => /Maquette/.test(document.querySelector('.view-in').textContent)));
    p = await page('#automatisations');
    ok('automatisations : frise', await p.evaluate(() => document.querySelectorAll('.track').length > 0));
    /* 0.83.0 : les jours du mois (« Hermes remplace Chronos », étape 2) : la carte de « Pour moi », ouverte par sa notification ; Confirmer seulement
       quand tout est connu ; « Corriger » en une phrase ; sans bilan (maquette de base), rien de nouveau dans Pour moi */
    { const JOURS_INIT = () => {
        const SEMJ = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], code = {2: 'S', 3: 'S', 4: 'T', 5: 'T', 6: 'T', 9: 'T', 10: 'S', 11: 'F', 12: 'C', 13: 'C', 16: 'S', 17: 'T', 18: 'T', 19: 'S', 20: 'T', 23: 'C', 24: 'S', 25: 'T', 30: 'T'};   /* un mois inventé */
        const jours = []; for (let d = 1; d <= 30; d++) { const dt = new Date(Date.UTC(2026, 10, d)), dow = dt.getUTCDay(), ouvre = dow >= 1 && dow <= 5, c = ouvre ? (code[d] || '?') : 'W';
          jours.push({date: '2026-11-' + String(d).padStart(2, '0'), jour: SEMJ[dow] + ' ' + (d === 1 ? '1er' : d), ouvre, ferie: d === 11 ? 'Armistice Day' : null, cal: {M: c, A: c}, M: c, A: c, corrige: false}); }
        window.__JOURS = {mois: '2026-11', libelle: 'novembre 2026', aujourdhui: '2026-11-25', etat: 'a_valider', demande: true, texte: 'Novembre 2026 : 17 jours travaillés (9 en télétravail, 6 sur site, 2 lieu à venir), 3 de congé (jeudi 12, vendredi 13, lundi 23), 1 férié.', erreur: '', corrections: 0, valide: null,
          bilan: {mois: '2026-11', jours, totaux: {teletravail: 9, surSite: 6, conges: 3, feries: 1, ouvres: 21, aConfirmer: 2, aResoudre: 0, aVenir: 2, travailles: 17}, conges: [{date: '2026-11-12', fraction: null}, {date: '2026-11-13', fraction: null}, {date: '2026-11-23', fraction: null}],
            aConfirmer: ['2026-11-26', '2026-11-27'], nonNotes: [], aResoudre: [], remarques: [], validable: true, complet: false, empreinte: 'x'}}; };
      const ctx = await b.newContext({...devices['iPhone 15 Pro Max']}); await ctx.addInitScript(PAUSE_INIT); await ctx.addInitScript(JOURS_INIT);
      const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push('jours : ' + e.message)); await q.goto(base + '#voir-jours-2026-11'); await q.waitForTimeout(3500);
      const lu = () => q.evaluate(() => { const c = document.getElementById('pm-jours'), cf = c && c.querySelector('.jrs-confirmer');
        return {tab: (document.querySelector('.tab[aria-current="page"], .tab.is-on') || {}).dataset ? (document.querySelector('.tab[aria-current="page"], .tab.is-on') || {}).dataset.tab : '', vu: !!c && c.offsetParent !== null, vise: !!c && c.hasAttribute('data-vise'),
          titre: c ? c.querySelector('h2').textContent : '', jours: c ? c.querySelectorAll('.jrs-j').length : 0, q: c ? c.querySelectorAll('.jrs-v').length : 0, conf: cf ? {dis: cf.disabled, t: cf.textContent} : null,
          txt: c ? c.textContent : '', dec: ([...document.querySelectorAll('.ux-seg button')].find((x) => x.dataset.f === 'decider') || {}).textContent || '', large: document.documentElement.scrollWidth <= window.innerWidth + 1}; });
      const a = await lu();
      ok('jours : la notification ouvre « Pour moi » sur la carte, mise en évidence ; 21 jours ouvrés, congés nommés, 2 au lieu à venir ; « Confirmer mes congés » ouvert (le lieu n’est pas nécessaire au CRA) ; compté dans « Décider »', a.vu && a.vise && a.titre === 'Tes jours de novembre 2026' && a.jours === 21 && a.q === 2 && a.conf && !a.conf.dis && a.conf.t === 'Confirmer mes congés' && /jeudi 12, vendredi 13, lundi 23/.test(a.txt) && /Lieu à venir : jeudi 26, vendredi 27/.test(a.txt) && /Décider\s*[1-9]/.test(a.dec) && a.large, JSON.stringify({...a, txt: a.txt.slice(0, 200)}));
      await q.screenshot({path: path.join(SH, 'jours-1.png')});
      await q.click('#pm-jours .jrs-corriger'); await q.waitForTimeout(400);
      await q.fill('#pm-jours .jrs-txt', 'jeudi 26 et vendredi 27 : télétravail'); await q.click('#pm-jours .jrs-envoyer'); await q.waitForTimeout(800);
      const c = await lu();
      ok('jours : « Corriger » ouvre un champ ; la phrase envoyée, le bilan corrigé est remontré (« Compris : … »), plus de lieu à venir', /Compris : jeudi 26, vendredi 27 : télétravail/.test(c.txt) && c.q === 0 && c.conf && !c.conf.dis && /Effacer mes corrections/.test(c.txt) && !/Lieu à venir/.test(c.txt), JSON.stringify({...c, txt: c.txt.slice(0, 200)}));
      await q.click('#pm-jours .jrs-confirmer'); await q.waitForTimeout(800);
      const d = await lu();
      ok('jours : « Confirmer » : congés validés, dit, plus de bouton Confirmer', /sont validés pour le CRA/.test(d.txt) && !d.conf && /congés validés/.test(d.txt), d.txt.slice(0, 200));
      await q.screenshot({path: path.join(SH, 'jours-2.png')});
      /* 0.84.0 : le CRA de la semaine, ouvert par sa notification ; « Confirmer et soumettre » ; un jour bloqué ferme le bouton */
      const CRA_INIT = (bloque) => { const j = (d, n, q, lieu, bl) => ({date: '2026-11-' + d, jour: n, M: lieu === 'C' ? 'C' : 'T', A: lieu === 'C' ? 'C' : 'T', q, lieu, bloque: bl || ''});
        const s = {lundi: '2026-11-23', libelle: 'du lundi 23 au vendredi 27 novembre', etat: 'a_valider', demande: true, confirmable: true, empreinte: 'e', erreur: '', valide: null, retour: null,
          jours: [j(23, 'lundi 23', 0, 'C'), j(24, 'mardi 24', 1, 'S'), j(25, 'mercredi 25', 1, 'T'), bloque ? j(26, 'jeudi 26', null, '', 'demi-journée de congé : à saisir à la main') : j(26, 'jeudi 26', 1, '?'), j(27, 'vendredi 27', 1, 'T')]};
        s.bloque = !!bloque; window.__JOURS = {mois: '2026-11', libelle: 'novembre 2026', etat: 'valide', demande: false, semaine: s, bilan: null}; };
      for (const bl of [false, true]) {
        const cx = await b.newContext({...devices['iPhone 15 Pro Max']}); await cx.addInitScript(PAUSE_INIT); await cx.addInitScript(CRA_INIT, bl);
        const w = await cx.newPage(); w.on('pageerror', (e) => errs.push('cra : ' + e.message)); await w.goto(base + '#voir-cra-2026-11-23'); await w.waitForTimeout(3500);
        const v = await w.evaluate(() => { const c = document.getElementById('pm-cra'), cf = c && c.querySelector('.cra-confirmer');
          return {vu: !!c && c.offsetParent !== null, vise: !!c && c.hasAttribute('data-vise'), jours: c ? c.querySelectorAll('.cra-j').length : 0, uns: c ? c.querySelectorAll('.cra-j.is-1').length : 0, conf: cf ? {dis: cf.disabled, t: cf.textContent} : null, txt: c ? c.textContent : '', large: document.documentElement.scrollWidth <= window.innerWidth + 1}; });
        if (!bl) {
          ok('cra : la notification ouvre « Pour moi » sur la semaine, mise en évidence ; 5 jours, 4 à « 1 » ; « Confirmer et soumettre » ouvert', v.vu && v.vise && v.jours === 5 && v.uns === 4 && v.conf && !v.conf.dis && v.conf.t === 'Confirmer et soumettre' && /rien/.test(v.txt) && v.large, JSON.stringify({...v, txt: v.txt.slice(0, 160)}));
          await w.screenshot({path: path.join(SH, 'cra-1.png')});
          await w.click('#pm-cra .cra-confirmer'); await w.waitForTimeout(800);
          const v2 = await w.evaluate(() => document.getElementById('pm-cra').textContent);
          ok('cra : « Confirmer et soumettre » : confirmé, Hermes s’en occupe, plus de bouton', /Confirmé : Hermes saisit et soumet/.test(v2) && !/Confirmer et soumettre/.test(v2), v2.slice(0, 200));
        } else ok('cra : un jour bloqué (demi-journée de congé) ferme le bouton et le dit', v.conf && v.conf.dis && /demi-journée de congé/.test(v.txt), JSON.stringify(v.conf));
        await cx.close();
      }
      const e0 = errs.length, r = await page('#demandes');
      ok('jours : sans bilan (maquette de base), rien de nouveau dans « Pour moi »', await r.evaluate(() => !document.getElementById('pm-jours')) && errs.length === e0, errs.slice(e0).join(' | ')); }
    /* 0.86.0 : refonte UX du 26/11 (« encombré, pas super simple ni intuitif ») et la fin de Grok Bot (interrupteur « Grok Bot arrêté le » de Faits) */
    { const q = await page('#demandes');
      const u = await q.evaluate(() => ({rep: (document.getElementById('pm-rep') || {}).hidden, gratuit: [...document.querySelectorAll('#view .cost')].filter((x) => /gratuit/.test(x.textContent)).length,
        fc: (() => { const b = document.getElementById('fc-start'); return b ? Math.round(b.getBoundingClientRect().height) : 0; })(), aide: /un appui ouvre le détail/.test(document.getElementById('view').textContent)}));
      ok('0.86 : Pour moi « Tout » : ce qui attend ta réponse (les réponses des bots sous « Infos »), plus de badge « gratuit », « Traiter une par une » sur une ligne, plus de phrase d’aide', u.rep === true && u.gratuit === 0 && u.fc > 0 && u.fc < 56 && !u.aide, JSON.stringify(u));
      await q.evaluate(() => document.querySelector('.ux-seg [data-f="infos"]').click()); await q.waitForTimeout(500);
      ok('0.86 : Pour moi « Infos » : les réponses des bots', await q.evaluate(() => { const r = document.getElementById('pm-rep'); return !!r && !r.hidden && !!r.offsetParent; }));
      await q.evaluate(() => document.querySelector('.ux-seg [data-f="faire"]').click()); await q.waitForTimeout(500);
      const t = await q.evaluate(() => { const d = document.querySelector('#pm-taches details.nt-fold'); return d ? {open: d.open, sum: d.querySelector('summary').textContent} : null; });
      ok('0.86 : Mes tâches : « Nouvelle tâche » replié derrière un bouton', !!t && t.open === false && /Nouvelle tâche/.test(t.sum), JSON.stringify(t));
      await q.context().close(); }
    { const q = await page('#espaces');
      const e = await q.evaluate(() => ({lead: !!document.querySelector('#view .esp-lead'), eqRow: !!document.querySelector('.esp-row[data-go="equipe"]'), eqTile: !!document.querySelector('.esp-tile[data-go="equipe"]'), reg: !!document.querySelector('.esp-row[data-go="reglages"]')}));
      ok('0.86 : Espaces : une seule porte vers Équipe (la tuile), Réglages gardé, plus de phrase d’introduction', !e.lead && !e.eqRow && e.eqTile && e.reg, JSON.stringify(e));
      await q.evaluate(() => { location.hash = '#equipe'; }); await q.waitForTimeout(1200);
      ok('0.86 : Grok actif : Équipe inchangée (les bots, le filtre Coût)', await q.evaluate(() => /Les bots/.test(document.querySelector('.view-title').textContent) && !!document.querySelector('.ux-seg [data-f="cout"]')));
      await q.context().close(); }
    { const q = await pageWith({grokOff: true}, '#equipe');
      const g = await q.evaluate(() => ({titre: document.querySelector('.view-title').textContent, seg: [...document.querySelectorAll('#view .ux-seg button')].map((x) => x.firstChild.textContent), routines: [...document.querySelectorAll('.hmh-r li b')].map((x) => x.textContent), pause: /Grok en pause/.test(document.getElementById('status') ? document.getElementById('status').textContent : '')}));
      ok('0.86 : Grok arrêté : Équipe devient « Hermes et ses routines » (sa carte, ses routines ; depuis 0.92.0 en direct, plus celles de Pilotage), plus de coût de Grok, plus de « Grok en pause »', g.titre === 'Hermes et ses routines' && g.seg.join() === 'Hermes,Demandes,Routines' && g.routines.join() === 'Veille du matin,Bilan de la semaine,Réveil,Digest IA et .NET,Prix suivis,Sorties du week-end' && !g.pause, JSON.stringify(g));
      await q.evaluate(() => { location.hash = '#espaces'; }); await q.waitForTimeout(1200);
      ok('0.86 : Grok arrêté : la tuile d’Espaces dit Hermes et ses routines', await q.evaluate(() => { const t = document.querySelector('.esp-tile[data-go="equipe"]'); return !!t && /Hermes/.test(t.textContent) && /6 routines/.test(t.textContent); }));
      await q.evaluate(() => { location.hash = '#demandes'; }); await q.waitForTimeout(1500);
      const d = await q.evaluate(() => ({oui: /dans son chat|Tes oui à donner dans Grok/i.test(document.getElementById('view').textContent), couts: [...document.querySelectorAll('#view .cost')].map((x) => x.textContent).filter((x) => /passage|chat Grok|reprise/.test(x))}));
      ok('0.86 : Grok arrêté : Pour moi sans « oui à donner dans Grok » ni badge de passage, de chat ou de reprise', !d.oui && !d.couts.length, JSON.stringify(d));
      await q.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const c = [...document.querySelectorAll('article')].find((x) => /Dates du voyage/.test(x.textContent) && /Plus…|Ouvrir ›/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }); await q.waitForTimeout(900);
      await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Répondre/.test(x.textContent)).click()); await q.waitForTimeout(500);
      const avant = await q.evaluate(() => ({canal: window.__G.Canal.length, sends: (window.__calls || []).filter((c) => c.tool === 'send_message').length}));
      await q.evaluate(() => { const t = document.querySelector('#sheet .sheet-pick textarea'); t.value = 'Plutôt début avril.'; t.closest('form').requestSubmit(); }); await q.waitForTimeout(900);
      const eff = await q.evaluate(() => document.getElementById('sheet').textContent + ' || ' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
      await q.waitForTimeout(6000);
      const apres = await q.evaluate(() => ({ligne: (window.__G.Canal[window.__G.Canal.length - 1] || []).join(' ¦ '), canal: window.__G.Canal.length, sends: (window.__calls || []).filter((c) => c.tool === 'send_message').length}));
      ok('0.86 : Grok arrêté : répondre à un bot écrit une ligne pour Hermes, lue à son prochain passage, sans sonnette', apres.canal === avant.canal + 1 && / ¦ Rabie ¦ Hermes ¦ /.test(apres.ligne) && /Plutôt début avril/.test(apres.ligne) && apres.sends === avant.sends && /pour Hermes/.test(eff) && !/sonnette/.test(eff), JSON.stringify([apres, eff.slice(0, 200)]));
      await q.context().close(); }
    /* 0.87.0 : suite de la refonte UX (ses choix au QCM du 26/11/2026) : Achats, Voyages, Argent, Papiers sur le modèle de la maquette (carte phare,
       un seul filtre collé sous l'en-tête, le secondaire replié en bas) ; plus de rubrique par-dessus ; la discussion en feuille du bas ; Grok arrêté :
       les cartes des anciens bots confiées à Hermes, Routines d'Hermes et de JARVIS seulement */
    { const q = await page('#achats');
      const a = await q.evaluate(() => { const s = document.querySelector('#view .dm-seg'); return {apres: !!s && !!s.previousElementSibling && s.previousElementSibling.matches('.shop-hero'), seg: [...document.querySelectorAll('#view .dm-seg button')].map((x) => x.firstChild.textContent), on: (document.querySelector('#view .dm-seg [aria-pressed="true"]') || {dataset: {}}).dataset.f, sticky: s ? getComputedStyle(s).position : '', idees: document.querySelector('#view .idee-wrap').offsetParent === null, plus: [...document.querySelectorAll('#view details.dm-plus')].map((x) => (x.open ? 'ouvert ' : '') + x.querySelector('summary').textContent).join()}; });
      ok('0.87 : Achats : la carte de Kairos, puis un seul filtre collé (À décider, Suivis, Idées, Achetés), ouvert sur « À décider » ; les autres veilles repliées en bas', a.apres && a.seg.join() === 'À décider,Suivis,Idées,Achetés' && a.on === 'dec' && a.sticky === 'sticky' && a.idees && /^Autres veilles de Kairos/.test(a.plus), JSON.stringify(a));
      ok('0.87 : Grok actif : les noms des bots restent (« Kairos suit » dans Achats, une carte de Chronos dans Pour moi)', await q.evaluate(() => /Kairos suit/.test(document.querySelector('.shop-hero').textContent)) && await (async () => { const z = await page('#demandes'); const r2 = await z.evaluate(() => [...document.querySelectorAll('.pm-card')].some((c) => /CRA client/.test(c.textContent) && /^Chronos/.test(c.querySelector('.pm-who').textContent)) && !document.querySelector('.pm-travail')); await z.context().close(); return r2; })());
      await versIdees(q);
      ok('0.87 : Achats, « Idées » : « Trouver une idée » et mes recherches, rien d’autre', await q.evaluate(() => document.querySelector('#view .idee-wrap').offsetParent !== null && !document.querySelector('#view .fam')?.offsetParent && !!document.querySelector('#ix-idee')));
      await q.evaluate(() => document.querySelector('#view .dm-seg [data-f="fini"]').click()); await q.waitForTimeout(400);
      ok('0.87 : Achats, « Achetés » : les achetés ou retirés', await q.evaluate(() => { const p2 = [...document.querySelectorAll('#view .panel')].find((x) => /^Achetés ou retirés$/.test(x.querySelector('h2').textContent)); return !!p2 && p2.offsetParent !== null && p2.querySelectorAll('.fam').length > 0; }));
      await q.evaluate(() => { location.hash = '#voyages'; }); await q.waitForTimeout(1300);
      const v = await q.evaluate(() => { const pn = (t) => [...document.querySelectorAll('#view .panel')].find((x) => x.querySelector('h2').textContent.trim() === t); return {seg: [...document.querySelectorAll('#view .dm-seg button')].map((x) => x.firstChild.textContent), hero: !!document.querySelector('#view .trip-hero + .dm-seg'), projets: pn('Tes projets').offsetParent !== null, envies: pn('Tes envies').offsetParent === null, regles: [...document.querySelectorAll('#view details.dm-plus summary')].map((x) => x.textContent).join()}; });
      ok('0.87 : Voyages : le prochain départ, puis Projets · Envies ; les règles repliées en bas', v.hero && v.seg.join() === 'Projets,Envies' && v.projets && v.envies && /Tes règles de voyage/.test(v.regles), JSON.stringify(v));
      await q.evaluate(() => { location.hash = '#argent'; }); await q.waitForTimeout(1500);
      const g = await q.evaluate(() => { const d = [...document.querySelectorAll('#view details.dm-plus')].find((x) => /notifications/i.test(x.querySelector('summary').textContent)), c = document.querySelector('.rad-courantes'); return {sticky: getComputedStyle(document.querySelector('.rad-seg')).position, plie: !!d && !d.open && !!d.querySelector('.rad-notif') && !!d.querySelector('.rad-sans-mail'), courantes: !!c && c.offsetParent !== null, act: !!document.querySelector('.rad-act') && document.querySelector('.rad-act').offsetParent !== null}; });
      ok('0.87 : Argent : le filtre du Radar collé sous l’en-tête ; ajouts rapides et notifications repliés en bas ; dépenses courantes et « Ajouter une dépense fixe » visibles', g.sticky === 'sticky' && g.plie && g.courantes && g.act, JSON.stringify(g));
      await q.evaluate(() => { location.hash = '#papiers'; }); await q.waitForTimeout(1800);
      const vu = () => q.evaluate(() => { const sec = (t) => [...document.querySelectorAll('#view .hm-h h2, #view .panel-h h2')].find((x) => x.textContent === t); const vis = (t) => { const x = sec(t); return !!x && x.closest('section').offsetParent !== null; };
        return {hero: !!document.querySelector('.pap-hero .pap-search') && !!document.querySelector('.pap-hero .pap-quick'), seg: [...document.querySelectorAll('#view .dm-seg button')].map((x) => x.firstChild.textContent), on: (document.querySelector('#view .dm-seg [aria-pressed="true"]') || {dataset: {}}).dataset.f, pers: vis('Par personne'), theme: vis('Par thème'), dates: vis('Dates de validité et pièces à fournir'), dep: vis('Déposer un document')}; });
      const pa = await vu();
      ok('0.87 : Papiers : la recherche en carte phare, puis Personnes · Thèmes · Validité · Déposer, ouvert sur Personnes', pa.hero && pa.seg.join() === 'Personnes,Thèmes,Validité,Déposer' && pa.on === 'personnes' && pa.pers && !pa.theme && !pa.dates && !pa.dep, JSON.stringify(pa));
      await q.fill('.pap-search', 'passeport'); await q.waitForTimeout(300);
      const s1 = await q.evaluate(() => ({seg: document.querySelector('#view .dm-seg').hidden, res: document.querySelectorAll('.pap-res .pf').length}));
      await q.fill('.pap-search', ''); await q.waitForTimeout(300);
      const s2 = await q.evaluate(() => !document.querySelector('#view .dm-seg').hidden);
      ok('0.87 : Papiers : une recherche montre ses résultats, sans le filtre ; il revient quand le champ se vide', s1.seg && s1.res >= 3 && s2, JSON.stringify([s1, s2]));
      await q.evaluate(() => document.querySelector('#view .dm-seg [data-f="themes"]').click()); await q.waitForTimeout(500);
      const pt = await vu();
      await q.evaluate(() => document.querySelector('#view .dm-seg [data-f="validite"]').click()); await q.waitForTimeout(500);
      const pv = await vu();
      ok('0.87 : Papiers : « Thèmes » (thèmes, vrac, privés) et « Validité » (dates de Pilotage, avec leurs gestes)', pt.theme && !pt.pers && pv.dates && !pv.theme && !pv.dep, JSON.stringify([pt, pv]));
      /* étape 7 : « Le scanner et le ranger » ouvre Papiers › Déposer (une page de la pile, plus une rubrique par-dessus) */
      await q.evaluate(() => { const c = [...document.querySelectorAll('.pap-dates .card')].find((x) => /Passeport/.test(x.textContent)); [...c.querySelectorAll('button')].find((y) => /Plus/.test(y.textContent)).click(); }); await q.waitForTimeout(800);
      await q.evaluate(() => [...document.querySelectorAll('#sheet button')].find((y) => /Le scanner et le ranger/.test(y.textContent)).click()); await q.waitForTimeout(1500);
      const dp = await vu();
      ok('0.87 : étape 7 : « Le scanner et le ranger » ouvre Papiers › Déposer, plus de rubrique par-dessus (#app)', dp.on === 'depot' && dp.dep && !dp.dates && await q.evaluate(() => document.getElementById('app').hidden && document.getElementById('sheet').hidden && location.hash === '#papiers'), JSON.stringify(dp));
      /* étape 7 : la discussion, feuille du bas plein écran */
      await q.evaluate(() => document.querySelector('.talk-slot .jv-btn').click()); await q.waitForTimeout(900);
      const ch = await q.evaluate(() => { const c = document.getElementById('chat'), s = getComputedStyle(c), hd = getComputedStyle(c.querySelector('.chat-head'), '::before'); return {open: !c.hidden, top: c.getBoundingClientRect().top, rad: s.borderTopLeftRadius, poignee: hd.content !== 'none' && hd.width === '40px', bas: Math.round(c.getBoundingClientRect().bottom) === innerHeight}; });
      ok('0.87 : étape 7 : la discussion est une feuille du bas plein écran (bord arrondi, poignée, jusqu’en bas)', ch.open && ch.top >= 8 && ch.rad === '24px' && ch.poignee && ch.bas, JSON.stringify(ch));
      await q.context().close(); }
    { const q = await pageWith({grokOff: true, depot: false}, '#demandes');   /* 0.91.0 : « depot: false » = serveur pas encore à jour : Papiers › Déposer garde la carte « À trier » vérifiée plus bas */
      await q.waitForTimeout(2500);
      const r = await q.evaluate(() => { const atoi = (window.__G['À toi'] || []).slice(3).filter((x) => x[2] && x[3] && /^(Iris|Kairos|Ulysse|Athéna|Argus|Plutus)\b/.test(x[1]) && !/^Ton oui dans le chat/.test(x[3])), rep = window.__G.Canal.filter((x) => x[2] === 'Hermes' && x[3] === 'Reprise');   /* « À toi » : Depuis le, Bot, Sujet, Ce qu'on attend de toi */
        return {atoi: atoi.length, rep: rep.length, sujets: atoi.every((x) => rep.some((y) => y[7] === x[2])), forme: rep.every((y) => y[1] === 'Rabie' && y[5] === 'À faire' && /^À faire : reprends la demande d(’|e )\S+ à Rabie \(« .+ »\) : .+ \| Pourquoi : Grok Bot est arrêté/.test(y[4]) && /rien de sortant sans son oui/.test(y[4])), elision: rep.some((y) => /demande d’Iris/.test(y[4])),
          who: [...document.querySelectorAll('.pm-card .pm-who')].map((x) => x.textContent.split(' · ')[0]), boutons: [...document.querySelectorAll('.pm-card button')].map((b) => b.textContent).filter((t) => /Iris|Chronos|Kairos|Ulysse|Athéna|Argus|Plutus/.test(t))}; });
      ok('0.87 : Grok arrêté : chaque demande ouverte d’un ancien bot devient une ligne « Reprise » pour Hermes (sujet en Objet, rien de sortant sans son oui) ; les cartes disent « Hermes »', r.atoi > 3 && r.rep === r.atoi && r.sujets && r.forme && r.elision && r.who.length > 3 && r.who.every((x) => x === 'Hermes') && !r.boutons.length, JSON.stringify(r));
      await q.evaluate(() => { location.hash = '#accueil'; }); await q.waitForTimeout(1200); await q.evaluate(() => { location.hash = '#demandes'; }); await q.waitForTimeout(3000);
      ok('0.87 : Grok arrêté : la reprise ne s’écrit qu’une fois (relectures de Pilotage)', await q.evaluate(() => window.__G.Canal.filter((x) => x[2] === 'Hermes' && x[3] === 'Reprise').length) === r.rep);
      /* ses décisions du 26/11/2026 (par le coordinateur) : 1. les cartes de Chronos quittent Pour moi, une ligne mène à Travail ; 2. Papiers › Déposer sans bot ;
         3. ce qui dit qui fait quoi aujourd'hui dit Hermes, l'historique garde son nom ; Hermes reconnu partout (plus « Iris » pour une ligne d'Hermes) */
      const ch = await q.evaluate(() => ({cartes: [...document.querySelectorAll('.pm-card')].filter((c) => /CRA client/.test(c.textContent)).length, ligne: [...document.querySelectorAll('.pm-travail')].map((x) => x.textContent.replace('›', '').trim()), repCra: window.__G.Canal.some((x) => x[2] === 'Hermes' && x[3] === 'Reprise' && /CRA/.test(x[7]))}));
      await q.evaluate(() => document.querySelector('.pm-travail').click()); await q.waitForTimeout(1200);
      const tr = await q.evaluate(() => location.hash);
      ok('0.87 : Grok arrêté : les cartes de Chronos quittent Pour moi (pas confiées à Hermes) ; une seule ligne « CRA et notes de frais : voir Travail » ouvre Travail', ch.cartes === 0 && ch.ligne.length === 1 && ch.ligne[0] === 'CRA et notes de frais : voir Travail' && !ch.repCra && tr === '#travail', JSON.stringify([ch, tr]));
      await q.evaluate(() => { location.hash = '#papiers'; }); await q.waitForTimeout(2200);
      await q.evaluate(() => document.querySelector('#view .dm-seg [data-f="depot"]').click()); await q.waitForTimeout(500);
      const dep = await q.evaluate(() => { const pn = [...document.querySelectorAll('#view .panel')].find((x) => /Déposer un document/.test(x.querySelector('h2').textContent)); return pn ? pn.innerText.replace(/\s+/g, ' ') : ''; });
      await q.evaluate(() => [...document.querySelectorAll('#view button')].find((x) => /Ouvrir « À trier »/.test(x.textContent)).click()); await q.waitForTimeout(800);
      const atr = await q.evaluate(() => (document.querySelector('.pap-h') || {}).textContent || '');
      ok('0.87 : Grok arrêté : Papiers › Déposer : le fichier va dans « À trier », il le range lui-même (JARVIS plus tard), aucun bot nommé ; « Ouvrir « À trier » » ouvre le dossier', /Le fichier va dans « À trier »/.test(dep) && /Range-le toi-même pour l’instant/.test(dep) && /le rangement par JARVIS viendra plus tard/.test(dep) && !/\b(Iris|Chronos|Kairos|Ulysse|Athéna|Argus|Plutus|Grok)\b/.test(dep) && /À trier/.test(atr), dep.slice(0, 300) + ' / ' + atr);
      await q.evaluate(() => { location.hash = '#accueil'; }); await q.waitForTimeout(1500);
      const acc = await q.evaluate(() => document.getElementById('view').innerText.replace(/\s+/g, ' '));
      await q.evaluate(() => { location.hash = '#agenda'; }); await q.waitForTimeout(1500);
      const ag = await q.evaluate(() => ({t: document.getElementById('view').innerText.replace(/\s+/g, ' '), seuls: [...document.querySelectorAll('#view *')].filter((x) => x.children.length === 0 && /^(Iris|Chronos|Kairos|Ulysse|Athéna|Argus|Plutus)$/.test(x.textContent.trim())).length}));
      await q.evaluate(() => { location.hash = '#suivi'; }); await q.waitForTimeout(1500);
      const dm = await q.evaluate(() => [...document.querySelectorAll('#view .canal-row')].map((r) => r.innerText.replace(/\s+/g, ' ')).filter((t) => /reprends la demande/.test(t)));
      const QUI = /\b(Iris|Chronos|Kairos|Ulysse|Athéna|Argus|Plutus)( s’en occupe| suit\b| · (à faire|en retard))|Préparer avec (Iris|Chronos|Kairos|Ulysse|Athéna|Argus|Plutus)/;
      ok('0.87 : Grok arrêté : qui fait quoi aujourd’hui dit Hermes (accueil, Agenda) ; l’historique garde son nom (« proposée par Ulysse ») ; une ligne pour Hermes s’affiche « Hermes » (plus « Iris ») dans Équipe › Demandes', !QUI.test(acc) && /Hermes (s’en occupe|suit)/.test(acc) && /proposée par Ulysse/.test(acc) && !QUI.test(ag.t) && ag.seuls === 0 && /Préparer avec Hermes/.test(ag.t) && dm.length > 3 && dm.every((t) => /Hermes · À faire/.test(t) && !/Iris · À faire/.test(t)), JSON.stringify({acc: (acc.match(QUI) || [])[0], ag: (ag.t.match(QUI) || [])[0], seuls: ag.seuls, dm: dm.slice(0, 2)}));
      await q.evaluate(() => { location.hash = '#demandes'; }); await q.waitForTimeout(1500);
      await q.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const c = [...document.querySelectorAll('article.pm-card')].find((x) => /Dates du voyage/.test(x.textContent)); [...c.querySelectorAll('button')].find((x) => /^(Plus…|Ouvrir ›)$/.test(x.textContent.trim())).click(); }); await q.waitForTimeout(900);
      ok('0.87 : Grok arrêté : la feuille d’une carte d’Ulysse dit Hermes (« Répondre à Hermes »)', await q.evaluate(() => { const t = document.getElementById('sheet').innerText; return /HERMES|Hermes/.test(t) && /Répondre à Hermes/.test(t) && !/Ulysse/.test([...document.querySelectorAll('#sheet .sheet-actions .btn')].map((x) => x.textContent).join()); }));
      await q.evaluate(() => { const b = document.querySelector('#sheet .sheet-close'); if (b) b.click(); location.hash = '#automatisations'; }); await q.waitForTimeout(1500);
      const ro = await q.evaluate(() => ({aj: [...document.querySelectorAll('.auto-jump .aj b')].map((x) => x.textContent), titres: [...document.querySelectorAll('#view h3, #view .auto h3, #view [id^="auto-"] h2')].map((x) => x.textContent).filter((x) => /^(Iris|Chronos|Kairos|Ulysse|Athéna|Argus)$/.test(x))}));
      ok('0.87 : Grok arrêté : Équipe › Routines ne montre que celles d’Hermes et de JARVIS', ro.aj.join() === 'Hermes' && !ro.titres.length, JSON.stringify(ro));
      await q.evaluate(() => { location.hash = ''; }); await q.waitForTimeout(1500);
      ok('0.87 : Grok arrêté : la phrase de l’accueil ne dit plus « Tes bots sont au travail » ; « En ce moment » sans les lignes « Reprise »', await q.evaluate(() => /Hermes et JARVIS font tes routines\./.test(document.querySelector('.hud-say').textContent) && !/Tes bots sont au travail/.test(document.querySelector('.hud-say').textContent) && !/reprends la demande/.test(document.getElementById('view').textContent)));
      await q.context().close(); }
    /* ================= 0.91.0 : rangement des papiers par JARVIS (Papiers › Déposer ; données inventées de window.__DEPOT) ================= */
    { const versDepot = async (q) => { await q.evaluate(() => document.querySelector('#view .dm-seg [data-f="depot"]').click()); await q.waitForTimeout(900); };
      const lu = (q) => q.evaluate(() => { const pn = [...document.querySelectorAll('#view .panel')].find((x) => /Déposer un document/.test(x.querySelector('h2').textContent)), c = [...document.querySelectorAll('.dep-item')];
        return {txt: pn ? pn.innerText.replace(/\s+/g, ' ') : '', champ: (() => { const f = document.querySelector('.dep-jarvis input[type=file]'); return f ? f.accept : ''; })(), puce: (document.querySelector('#view .dm-seg [data-f="depot"] b') || {}).textContent || '',
          cartes: c.map((x) => ({nom: x.querySelector('.dep-recu-t b').textContent, dossier: x.querySelector('.dep-dossier').selectedOptions[0].textContent, fichier: x.querySelector('.dep-nom').value + x.querySelector('.dep-ext').textContent, raison: x.querySelector('.dep-raison').textContent, meta: x.querySelector('.dep-recu-t small').textContent})),
          options: c[0] ? [...c[0].querySelectorAll('.dep-dossier option')].map((o) => o.textContent) : [], ranges: [...document.querySelectorAll('.dep-ranges .pf')].map((x) => x.innerText.replace(/\s+/g, ' ')), toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || ')}; });
      const sansToasts = (q) => q.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
      const q = await page('#papiers'); await versDepot(q);
      const d0 = await lu(q);
      ok('0.91 : Papiers › Déposer : « JARVIS range tes papiers », un vrai champ fichier (PDF, images), rien ne part avant son oui ; plus aucun bot nommé ; le filtre porte le nombre en attente', /JARVIS range tes papiers/.test(d0.txt) && /Rien ne part dans ton Drive avant ton oui/.test(d0.txt) && /application\/pdf/.test(d0.champ) && /image\/heic/.test(d0.champ)
        && !/\b(Iris|Chronos|Kairos|Ulysse|Athéna|Argus|Plutus|Grok|Canal)\b/.test(d0.txt) && !/Range-le toi-même/.test(d0.txt) && d0.puce === '2' && /Gardé 30 jours sur ton serveur, puis effacé/.test(d0.txt), JSON.stringify([d0.txt.slice(0, 260), d0.champ, d0.puce]));
      ok('0.91 : ce qui attend : le dossier proposé (choisi dans l’arbre de Papiers, sans « Papiers privés »), le nom modifiable avec l’extension fixe, la raison, la date limite ; un dépôt par le Raccourci est dit',
        d0.cartes.length === 2 && d0.cartes[0].nom === 'Quittance novembre.pdf' && d0.cartes[0].dossier === 'Logement' && d0.cartes[0].fichier === 'Quittance de loyer 2026-11.pdf' && /Reconnu : quittance de loyer/.test(d0.cartes[0].raison) && /gardé jusqu’au \d\d\/\d\d/.test(d0.cartes[0].meta)
        && d0.cartes[1].dossier === 'À trier' && /par le Raccourci/.test(d0.cartes[1].meta) && /image n’est pas lue/.test(d0.cartes[1].raison) && d0.options.includes('Lui › Identité et séjour') && d0.options.includes('Papiers') && !d0.options.some((o) => /priv|Impôts|Banque|Salaires/i.test(o)), JSON.stringify([d0.cartes, d0.options.length]));
      await q.setInputFiles('.dep-jarvis input[type=file]', [{name: 'Passeport scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 exemple inventé')}, {name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('pas un papier')}]); await q.waitForTimeout(1500);
      const d1 = await lu(q);
      ok('0.91 : déposer un PDF par le champ fichier : il s’ajoute à la liste avec sa proposition (« Lui › Identité et séjour », « Passeport Lui.pdf ») ; un fichier qui n’est ni PDF ni image est refusé et le dit',
        d1.cartes.length === 3 && d1.cartes[0].nom === 'Passeport scan.pdf' && d1.cartes[0].dossier === 'Lui › Identité et séjour' && d1.cartes[0].fichier === 'Passeport Lui.pdf' && d1.puce === '3' && /Pas déposé/.test(d1.toasts) && /notes\.txt/.test(d1.toasts) && /ni un PDF ni une image/.test(d1.toasts), JSON.stringify([d1.cartes.map((x) => x.nom), d1.puce, d1.toasts]));
      /* il corrige (dossier dans l'arbre, nom), puis son oui */
      await sansToasts(q);
      await q.evaluate(() => { const c = [...document.querySelectorAll('.dep-item')].find((x) => /Quittance novembre/.test(x.textContent)), s = c.querySelector('.dep-dossier'); s.value = [...s.options].find((o) => o.textContent === 'Logement › Locations 2018-2022').value; s.dispatchEvent(new Event('change', {bubbles: true})); });
      await q.fill('.dep-item:nth-of-type(2) .dep-nom', 'Quittance corrigée 2026-11'); await q.waitForTimeout(200);
      const avantOui = await q.evaluate(() => window.__DEPOT.etat().then((e) => e.ranges.length));
      await q.evaluate(() => [...document.querySelectorAll('.dep-item')].find((x) => /Quittance novembre/.test(x.textContent)).querySelector('.dep-oui').click()); await q.waitForTimeout(1500);
      const d2 = await lu(q);
      ok('0.91 : il corrige le dossier et le nom, puis « Oui, ranger ici » : rien n’était parti avant ; le fichier est rangé là où il a dit, sous son nom, sort de la liste et passe dans « Rangés récemment »',
        avantOui === 0 && d2.cartes.length === 2 && !d2.cartes.some((x) => /Quittance novembre/.test(x.nom)) && /Rangé dans ton Drive/.test(d2.toasts) && /Quittance corrigée 2026-11\.pdf/.test(d2.toasts) && /Logement › Locations 2018-2022/.test(d2.toasts) && d2.ranges.length === 1 && /Quittance corrigée 2026-11/.test(d2.ranges[0]) && /Locations 2018-2022/.test(d2.ranges[0]) && d2.puce === '2', JSON.stringify([d2.cartes.map((x) => x.nom), d2.toasts, d2.ranges]));
      await q.evaluate(() => document.querySelector('#view .dm-seg [data-f="themes"]').click()); await q.waitForTimeout(900);
      await q.fill('.pap-search', 'Quittance corrigée'); await q.waitForTimeout(700);
      ok('0.91 : le fichier rangé apparaît dans Papiers (l’arbre est relu)', await q.evaluate(() => [...document.querySelectorAll('.pap-res .pf')].some((x) => /Quittance corrigée 2026-11/.test(x.textContent) && /Locations 2018-2022/.test(x.textContent))));
      await q.fill('.pap-search', ''); await q.waitForTimeout(300); await versDepot(q); await sansToasts(q);
      await q.evaluate(() => [...document.querySelectorAll('.dep-item')].find((x) => /IMG_4521/.test(x.textContent)).querySelector('.dep-non').click()); await q.waitForTimeout(400);
      const conf = await q.evaluate(() => ({b: [...document.querySelectorAll('.dep-item')].find((x) => /IMG_4521/.test(x.textContent)).querySelector('.dep-non').textContent, n: document.querySelectorAll('.dep-item').length}));
      await q.evaluate(() => [...document.querySelectorAll('.dep-item')].find((x) => /IMG_4521/.test(x.textContent)).querySelector('.dep-non').click()); await q.waitForTimeout(1200);
      const d3 = await lu(q);
      ok('0.91 : « Retirer » demande un second appui (« Retirer pour de bon ? »), puis efface le fichier en attente sans rien ranger', conf.b === 'Retirer pour de bon ?' && conf.n === 2 && d3.cartes.length === 1 && /Retiré/.test(d3.toasts) && /rien n’est parti dans ton Drive/.test(d3.toasts) && d3.ranges.length === 1, JSON.stringify([conf, d3.cartes.map((x) => x.nom), d3.toasts]));
      const aide = await q.evaluate(() => { const a = document.querySelector('.dep-aide'); a.querySelector('summary').click(); return a.innerText.replace(/\s+/g, ' '); });
      ok('0.91 : « Depuis le menu Partager de l’iPhone » : le Raccourci (Safari n’offre pas le partage aux apps de l’écran d’accueil), son adresse /api/raccourci/depot, et la réserve sur les noms de menus', /Safari sur iPhone ne laisse pas/.test(aide) && /Raccourci/.test(aide) && /\/api\/raccourci\/depot/.test(aide) && /peuvent changer selon la version d’iOS/.test(aide) && /Android/.test(aide), aide.slice(0, 300));
      await q.context().close();
      /* la portée « drive » pas accordée : il peut déposer, la validation dit quoi faire */
      const r = await pageWith({depotPortee: 'non'}, '#papiers'); await versDepot(r);
      const p0 = await lu(r);
      await r.evaluate(() => document.querySelector('.dep-item .dep-oui').click()); await r.waitForTimeout(1200);
      const p1 = await lu(r);
      ok('0.91 : sans la portée Google « drive » : l’écran dit « Reconnecte Google une fois » (Réglages, Google, Reconnecter), le dépôt reste possible ; « Oui, ranger ici » le redit et le fichier attend toujours', /Reconnecte Google une fois/.test(p0.txt) && /Réglages, Google, Reconnecter/.test(p0.txt) && /Tu peux déjà déposer/.test(p0.txt) && !!p0.champ && p0.cartes.length === 2 && /Reconnecte Google une fois/.test(p1.toasts) && p1.cartes.length === 2 && !p1.ranges.length, JSON.stringify([p0.txt.slice(0, 300), p1.toasts]));
      await r.context().close();
      /* serveur pas encore à jour, Grok PAS arrêté : la carte « À trier » de la 0.87.0, jamais l'ancien « Iris range » (chemin cassé depuis l'arrêt de Grok) */
      const s = await pageWith({depot: false}, '#papiers'); await versDepot(s);
      const v0 = await lu(s);
      ok('0.91 : serveur pas encore à jour (pas de dépôt), même sans arrêt de Grok : la carte « À trier » ; plus aucun chemin par Iris ni par le Canal', /Le fichier va dans « À trier »/.test(v0.txt) && !/\b(Iris|Canal|sonnette)\b/.test(v0.txt) && !/Envoyer à Iris|Iris range/.test(v0.txt) && !v0.champ, v0.txt.slice(0, 300));
      await s.context().close();
      /* l'adresse d'une notification ou du partage : « /#voir-papiers-depot » ouvre Papiers › Déposer */
      const u = await page('#voir-papiers-depot'); await u.waitForTimeout(1500);
      const h0 = await u.evaluate(() => ({hash: location.hash, on: (document.querySelector('#view .dm-seg [aria-pressed="true"]') || {dataset: {}}).dataset.f, vu: !!document.querySelector('.dep-jarvis') && document.querySelector('.dep-jarvis').offsetParent !== null}));
      await u.evaluate(() => { location.hash = '#accueil'; }); await u.waitForTimeout(900); await u.evaluate(() => { location.hash = '#voir-papiers-partage-vide'; }); await u.waitForTimeout(1500);
      const h1 = await u.evaluate(() => ({hash: location.hash, toasts: [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || ')}));
      ok('0.91 : « #voir-papiers-depot » (notification du Raccourci, retour du partage) ouvre Papiers › Déposer ; « #voir-papiers-partage-vide » dit que le partage n’est pas arrivé', h0.hash === '#papiers' && h0.on === 'depot' && h0.vu && h1.hash === '#papiers' && /Partage pas reçu/.test(h1.toasts), JSON.stringify([h0, h1]));
      await u.context().close();
      /* le service worker : le partage du système (POST multipart sur « partage ») est gardé dans un cache à part puis renvoyé à l'app ; hors navigateur */
      { const vm = require('vm'), H = {}, mis = []; let skips = 0, vides = 0;
        const self3 = {addEventListener: (t, f) => { H[t] = f; }, registration: {scope: 'https://jarvis.essai/'}, clients: {claim: () => Promise.resolve()}, skipWaiting: () => { skips++; return Promise.resolve(); }};
        const cachesF = {open: (n) => Promise.resolve({add: () => Promise.resolve(), put: (rq, rp) => { mis.push({cache: n, url: rq.url || String(rq), nom: rp.headers.get('x-nom'), type: rp.headers.get('content-type')}); return Promise.resolve(); }}), keys: () => Promise.resolve(['jarvis-os-partage', 'jarvis-os-app-v1']), delete: (k) => { if (k === 'jarvis-os-partage') vides++; return Promise.resolve(true); }, match: () => Promise.resolve(null)};
        vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), {self: self3, caches: cachesF, fetch: () => Promise.reject(new Error('réseau')), URL, Promise, Request, Response, Date, encodeURIComponent, location: {origin: 'https://jarvis.essai'}});
        const w = []; H.install({waitUntil: (x) => w.push(x)}); H.activate({waitUntil: (x) => w.push(x)}); await Promise.all(w);
        const fichier = new File([Buffer.from('%PDF-1.4 exemple')], 'Reçu crèche.pdf', {type: 'application/pdf'}), gros = {name: 'gros.pdf', type: 'application/pdf', size: 26 * 1024 * 1024};
        let rendu = null; const ev = (method, url, files) => ({request: {method, url, mode: 'navigate', formData: () => Promise.resolve({getAll: (k) => (k === 'fichiers' ? files : [])}), clone: () => ({})}, respondWith: (x) => { rendu = x; }});
        H.fetch(ev('POST', 'https://jarvis.essai/partage', [fichier, 'du texte', gros])); const rp = await rendu;
        rendu = null; H.fetch(ev('POST', 'https://jarvis.essai/partage', [])); const rv = await rendu;
        rendu = null; H.fetch(ev('POST', 'https://jarvis.essai/api/depot', [fichier])); const api = rendu;
        rendu = null; H.fetch(ev('POST', 'https://jarvis.essai/courses/partage', [fichier])); const courses = rendu;
        ok('0.91 : service worker : le partage du système est gardé dans le cache « jarvis-os-partage » (nom et type, un fichier de plus de 25 Mo écarté), puis l’app est rouverte sur Papiers › Déposer ; sans fichier : « partage vide » ; /api/ et /courses ne sont pas touchés ; ni skipWaiting à l’installation, ni cache du partage effacé à l’activation',
          mis.length === 1 && mis[0].cache === 'jarvis-os-partage' && /^https:\/\/jarvis\.essai\/partage-recu\//.test(mis[0].url) && decodeURIComponent(mis[0].nom) === 'Reçu crèche.pdf' && mis[0].type === 'application/pdf' && rp.status === 303 && rp.headers.get('location') === 'https://jarvis.essai/#voir-papiers-depot'
          && rv.status === 303 && rv.headers.get('location') === 'https://jarvis.essai/#voir-papiers-partage-vide' && api === null && courses === null && skips === 0 && vides === 0, JSON.stringify([mis, rp.status, rp.headers.get('location'), rv.headers.get('location'), api, courses, skips, vides]));
        const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8')), st = mf.share_target || {};
        ok('0.91 : manifeste : « share_target » en POST multipart vers « ./partage », fichiers PDF et images sous le nom « fichiers »', st.action === './partage' && st.method === 'POST' && st.enctype === 'multipart/form-data' && st.params.files[0].name === 'fichiers' && st.params.files[0].accept.includes('application/pdf') && st.params.files[0].accept.includes('image/heic') && mf.start_url === './' && mf.scope === './', JSON.stringify(st)); }
    }
    /* 0.92.0 : « Hermes et ses routines » en direct (le résumé du cron d'Hermes ; données inventées de la maquette), ou « indisponible » */
    { const q = await pageWith({grokOff: true}, '#equipe');
      const p = await q.evaluate(() => { const dl = {}; document.querySelectorAll('.hm-hermes .hmh-l div').forEach((d) => { dl[d.querySelector('dt').textContent] = d.querySelector('dd').textContent; });
        const li = (n) => { const x = document.querySelector('#hr-routines li[data-hr="' + n + '"]'); return x ? {ko: x.classList.contains('ko'), t: [...x.querySelectorAll('b, .pill, small')].map((y) => y.textContent).join(' | ')} : null; };
        return {dl, n: document.querySelectorAll('#hr-routines li.hr-li').length, modes: [...document.querySelectorAll('#hr-routines .hr-mode')].map((x) => x.textContent).join(), aside: document.querySelector('#hr-routines .panel-h .aside').textContent,
          veille: li('veille-du-matin'), prix: li('prix-suivis'), digest: li('digest-ia'), vue: document.getElementById('view').innerText}; });
      ok('0.92 : page Hermes en direct : sa carte dit la passerelle, le garde du forfait, le dernier et le prochain passage ; de Pilotage il ne reste que sa dernière note, datée',
        p.dl['Passerelle'] === 'en marche' && p.dl['Garde du forfait'] === 'coupé jusqu’au 3 décembre' && /^(aujourd’hui|hier) à \d\d:\d\d · [^·]+ · (réussi|en erreur : limite du forfait)$/.test(p.dl['Dernier passage'] || '') && /^(aujourd’hui|demain) à \d\d:\d\d · [^·]+$/.test(p.dl['Prochain'] || '') && /^Veille du matin faite \(Pilotage, /.test(p.dl['Sa dernière note'] || '') && Object.keys(p.dl).length === 5, JSON.stringify(p.dl));
      ok('0.92 : page Hermes en direct : six routines (libellé, moment, mode réel ou en double, dernier passage et résultat, prochain passage), l’heure du résumé',
        p.n === 6 && p.modes === 'réel,réel,réel,en double,réel,réel' && /^6 · à jour à \d\d:\d\d$/.test(p.aside) && !!p.veille && !p.veille.ko && /^Veille du matin \| réel \| Du lundi au vendredi à 7 h 40 \| Dernier passage : .+ à 07:40 · réussi \| Prochain passage : .+ à 07:40$/.test(p.veille.t), JSON.stringify([p.n, p.modes, p.aside, p.veille]));
      ok('0.92 : une routine en erreur dit sa catégorie (« limite du forfait »), jamais un texte d’erreur ; une routine en pause le dit ; plus aucune ligne de l’onglet Routines de Pilotage',
        !!p.prix && p.prix.ko && /Dernier passage : .+ à 09:00 · en erreur : limite du forfait \|/.test(p.prix.t) && !!p.digest && /\| en double \|/.test(p.digest.t) && /Dernier passage : jamais passée \| Prochain passage : en pause$/.test(p.digest.t) && !/Semaine à venir|Dim 18h10|Lun-ven 7h40/.test(p.vue), JSON.stringify([p.prix, p.digest]));
      await q.evaluate(() => { location.hash = '#espaces'; }); await q.waitForTimeout(1200);
      const tu = await q.evaluate(() => [...document.querySelectorAll('.esp-tile[data-go="equipe"] .esp-n, .esp-tile[data-go="equipe"] .esp-v, .esp-tile[data-go="equipe"] .esp-s')].map((x) => x.textContent).join(' | '));
      ok('0.92 : la tuile d’Espaces : le nombre de routines en direct et ce qui cloche d’abord', tu === 'Hermes | 6 routines | en erreur : Prix suivis', tu);
      await q.evaluate(() => { location.hash = '#automatisations'; }); await q.waitForTimeout(1500);
      const ro = await q.evaluate(() => ({aj: [...document.querySelectorAll('.auto-jump .aj')].map((x) => x.innerText.replace(/\s+/g, ' ')), cartes: [...document.querySelectorAll('#auto-hermes article.auto')].map((x) => x.dataset.hr), pills: [...document.querySelectorAll('#auto-hermes article.auto .pill')].map((x) => x.textContent).join(),
        aside: document.querySelector('#auto-hermes .panel-h .aside').textContent, prix: [...document.querySelectorAll('#auto-hermes article[data-hr="prix-suivis"] .trk b, #auto-hermes article[data-hr="prix-suivis"] .trk small')].map((x) => x.textContent).join(' | '), vue: document.getElementById('view').innerText}));
      ok('0.92 : Équipe › Routines : les lignes d’Hermes viennent du direct (panneau « Hermes », six cartes suivies comme une livraison), plus de Pilotage',
        ro.aj.length === 1 && /^Hermes\s+6 routines · (aujourd’hui|demain) à \d\d:\d\d$/.test(ro.aj[0]) && ro.cartes.join() === 'veille-du-matin,bilan-hebdo,reveil,digest-ia,prix-suivis,sorties-du-week-end' && ro.pills === 'En réel,En réel,En réel,En pause,En réel,En réel' && /^en direct · à jour à \d\d:\d\d$/.test(ro.aside)
        && /^Programmée \| Chaque jour à 9 h \| Dernier passage \| .+ à 09:00 · en erreur : limite du forfait \| Prochain passage \| .+ à 09:00$/.test(ro.prix) && !/Semaine à venir|Dim 18h10|Aucune routine lue dans Pilotage/.test(ro.vue), JSON.stringify({...ro, vue: ro.vue.length}));
      await q.context().close(); }
    { const q = await pageWith({grokOff: true, hermesIndispo: true}, '#equipe');
      const p = await q.evaluate(() => { const dl = {}; document.querySelectorAll('.hm-hermes .hmh-l div').forEach((d) => { dl[d.querySelector('dt').textContent] = d.querySelector('dd').textContent; });
        return {dl, n: document.querySelectorAll('#view .hr-li, #view .hmh-r li').length, msg: (document.querySelector('#hr-routines .hr-indispo') || {textContent: ''}).textContent, aside: document.querySelector('#hr-routines .panel-h .aside').textContent, vue: document.getElementById('view').innerText}; });
      ok('0.92 : résumé indisponible : la page dit « indisponible » avec la raison, aucune routine affichée, jamais la liste périmée de Pilotage',
        p.n === 0 && /^Routines d’Hermes indisponibles : dernière écriture du résumé à 07 h 52 : plus de 30 minutes/.test(p.msg) && p.aside === 'indisponible' && /^indisponible : dernière écriture/.test(p.dl['En direct'] || '') && !p.dl['Dernier passage'] && !p.dl['Prochain'] && !/Semaine à venir|Prix suivis|Dim 18h10/.test(p.vue), JSON.stringify({...p, vue: p.vue.length}));
      await q.evaluate(() => { location.hash = '#espaces'; }); await q.waitForTimeout(1200);
      const tu = await q.evaluate(() => [...document.querySelectorAll('.esp-tile[data-go="equipe"] .esp-n, .esp-tile[data-go="equipe"] .esp-v, .esp-tile[data-go="equipe"] .esp-s')].map((x) => x.textContent).join(' | '));
      await q.evaluate(() => { location.hash = '#automatisations'; }); await q.waitForTimeout(1500);
      const ro = await q.evaluate(() => ({n: document.querySelectorAll('#auto-hermes article.auto').length, msg: (document.querySelector('#auto-hermes .hr-indispo') || {textContent: ''}).textContent, aj: [...document.querySelectorAll('.auto-jump .aj')].map((x) => x.innerText.replace(/\s+/g, ' ')).join(), vue: document.getElementById('view').innerText}));
      ok('0.92 : résumé indisponible : la tuile d’Espaces et Équipe › Routines le disent aussi (« Indisponible », la raison), sans aucune ligne de Pilotage pour Hermes',
        /^Hermes \| Indisponible \| dernière écriture du résumé à 07 h 52 : plus de 30 minutes/.test(tu) && !/routine/.test(tu) && ro.n === 0 && /indisponibles : dernière écriture/.test(ro.msg) && /^Hermes\s+indisponible$/.test(ro.aj) && !/Semaine à venir|Prix suivis|Veille du matin/.test(ro.vue), JSON.stringify([tu, {...ro, vue: ro.vue.length}]));
      await q.context().close(); }
    /* 0.96.0 : administrer les routines d'Hermes (sa demande du 27/11/2026) : la feuille d'une routine, lancer, mettre en pause, reprendre,
       changer l'horaire, l'historique, l'erreur en détail, tout mettre en pause ; la maquette joue JARVIS et root (données inventées) */
    { const q = await pageWith({grokOff: true}, '#equipe');
      const feuille = () => q.evaluate(() => { const s = document.getElementById('sheet'), g = (c) => { const x = s.querySelector('[data-ra="' + c + '"]'); return x ? x.textContent : null; };
        const faits = {}; s.querySelectorAll('.ra-faits div').forEach((d) => { faits[d.querySelector('dt').textContent] = d.querySelector('dd').textContent; });
        return {ouverte: !s.hidden && !!s.querySelector('#ra'), titre: (s.querySelector('.sheet-title') || {}).textContent, kicker: (s.querySelector('.sheet-kicker') || {}).textContent, etat: g('etat'), codeEtat: (s.querySelector('[data-ra="etat"]') || {dataset: {}}).dataset.etat, faits,
          ordre: g('ordre'), etatOrdre: (s.querySelector('[data-ra="ordre"]') || {dataset: {}}).dataset.etat || null, refus: g('refus'), pourquoi: g('pourquoi'), evenement: g('evenement'), stats: g('stats'), apercu: g('apercu'),
          boutons: [...s.querySelectorAll('.ra button[data-ra]')].map((x) => x.dataset.ra + (x.disabled ? ' (inactif)' : '')), sections: [...s.querySelectorAll('[data-ra-sec]')].map((x) => x.dataset.raSec).join(),
          erreur: s.querySelector('[data-ra-sec="erreur"]') ? s.querySelector('[data-ra-sec="erreur"]').innerText : null, fait: s.querySelector('[data-ra-sec="fait"]').innerText, passages: [...s.querySelectorAll('.ra-hist .ra-p')].map((x) => x.querySelector('.ra-pb').innerText.replace(/\s*\n\s*/g, ' | ')), detailPassage: [...s.querySelectorAll('.ra-pd')].map((x) => x.innerText).join(' / ')}; });
      const ouvrir = async (nom) => { await q.evaluate(() => { const b = document.querySelector('#sheet .sheet-close'); if (b && !document.getElementById('sheet').hidden) b.click(); }); await q.waitForTimeout(400); await q.click('#hr-routines li[data-hr="' + nom + '"]'); await q.waitForTimeout(700); };
      const appui = async (cle) => { await q.click('#sheet .ra [data-ra="' + cle + '"]'); await q.waitForTimeout(250); };
      const li = await q.evaluate(() => [...document.querySelectorAll('#hr-routines li[data-hr]')].map((x) => x.dataset.hr + ':' + (x.getAttribute('role') || '') + ':' + (x.getAttribute('tabindex') || '') + ':' + ((x.querySelector('.ra-pst') || {}).textContent || '')).join(' ; '));
      ok('0.96 : dans la liste, chaque routine s’ouvre d’un appui (bouton accessible au clavier) et porte une pastille quand elle est en pause ou en erreur (« En pause », « En erreur »), rien quand elle est simplement active',
        li === 'veille-du-matin:button:0: ; bilan-hebdo:button:0: ; reveil:button:0: ; digest-ia:button:0:En pause ; prix-suivis:button:0:En erreur ; sorties-du-week-end:button:0:', li);
      await ouvrir('veille-du-matin'); let f = await feuille();
      ok('0.96 : toucher une routine ouvre SA feuille (la feuille du bas) : son nom, son état en clair, son moment, son mode, dernier et prochain passage',
        f.ouverte && f.titre === 'Veille du matin' && f.kicker === 'Routine d’Hermes' && f.etat === 'Active' && f.codeEtat === 'active' && f.faits['Quand'] === 'Du lundi au vendredi à 7 h 40' && f.faits['Mode'] === 'en réel' && /à 07:40 · réussi$/.test(f.faits['Dernier']) && /à 07:40$/.test(f.faits['Prochain']), JSON.stringify(f));
      ok('0.96 : la feuille : les gestes (Lancer maintenant, Mettre en pause), puis « Ce qu’elle a fait » (le dernier compte rendu), « Changer l’horaire », « Historique » ; pas d’« erreur en détail » quand tout va bien',
        f.boutons.slice(0, 2).join() === 'lancer,pause' && f.sections === 'fait,horaire,historique' && f.erreur === null && /Trois mails à voir signalés, agenda du jour relu/.test(f.fait), JSON.stringify([f.boutons, f.sections, f.fait]));
      ok('0.96 : historique : les passages (date, résultat, durée, comment il a été lancé), le taux de réussite et la durée moyenne', f.passages.length === 6 && /^.+ à 07:4\d \| réussi \| \d+ min( \d\d)? · programmé$/.test(f.passages[0]) && /^6 passages · 100 % réussis · durée moyenne \d+ min( \d\d)?$/.test(f.stats), JSON.stringify([f.passages, f.stats]));
      await q.click('#sheet .ra-hist .ra-p:first-child .ra-pb'); await q.waitForTimeout(250); f = await feuille();
      ok('0.96 : toucher un passage montre ce qu’il a fait (son compte rendu)', /Trois mails à voir signalés/.test(f.detailPassage), f.detailPassage);
      /* lancer : confirmation en un appui, « Demandé à … — en cours… », puis le résultat */
      await appui('lancer'); let c = await feuille();
      await appui('lancer-oui'); const d1 = await feuille(); await q.waitForTimeout(1700); const d2 = await feuille(); await q.waitForTimeout(4200); const d3 = await feuille();
      ok('0.96 : « Lancer maintenant » : un premier appui demande confirmation (« Confirmer : lancer maintenant », « Annuler »), rien n’est parti', c.boutons.includes('lancer-oui') && c.boutons.includes('lancer-non') && c.ordre === null, JSON.stringify(c.boutons));
      ok('0.96 : … confirmé : « Demandé à … — en attente du serveur… » puis « — en cours… » (les gestes sont inactifs pendant ce temps), puis le résultat « Lancée à …, terminée à … : réussie. »',
        /^Demandé à \d\d h \d\d — en attente du serveur…$/.test(d1.ordre) && /^Demandé à \d\d h \d\d — en cours…$/.test(d2.ordre) && d2.codeEtat === 'en cours' && d2.boutons.includes('lancer (inactif)') && /^Lancée à \d\d h \d\d, terminée à \d\d h \d\d : réussie\.$/.test(d3.ordre) && d3.etatOrdre === 'terminé' && d3.codeEtat === 'active', JSON.stringify([d1.ordre, d2.ordre, d2.boutons, d3.ordre]));
      ok('0.96 : … le passage est dans l’historique (« lancé à la main depuis JARVIS »), « Ce qu’elle a fait » est à jour', d3.passages.length === 7 && /réussi \| 3 s · lancé à la main depuis JARVIS$/.test(d3.passages[0]) && /Passage lancé à la main/.test(d3.fait) && /^7 passages/.test(d3.stats), JSON.stringify([d3.passages[0], d3.fait]));
      ok('0.96 : relancer moins de 5 minutes après n’est pas possible : « Lancer maintenant » est inactif et dit pourquoi (« déjà lancée il y a moins de 5 minutes : possible à … »)', d3.boutons.includes('lancer (inactif)') && /^« Lancer maintenant » : déjà lancée il y a moins de 5 minutes : possible à \d\d h \d\d\.$/.test(d3.pourquoi || ''), JSON.stringify([d3.boutons, d3.pourquoi]));
      /* pause (second appui de confirmation), la pastille dans la liste, reprendre */
      await appui('pause'); c = await feuille(); await appui('pause-oui'); await q.waitForTimeout(1900); const p1 = await feuille();
      const pst = await q.evaluate(() => { const x = document.querySelector('#hr-routines li[data-hr="veille-du-matin"]'); return (x.querySelector('.ra-pst') || {}).textContent + ' | ' + x.querySelector('.hr-p').textContent; });
      ok('0.96 : « Mettre en pause » : un second appui confirme (« Confirmer la pause, jusqu’à nouvel ordre ») ; la feuille dit « En pause depuis … , depuis JARVIS — jusqu’à nouvel ordre », plus de prochain passage, « Lancer » inactif avec sa raison, « Reprendre » à la place',
        c.boutons.includes('pause-oui') && /^En pause depuis aujourd’hui à \d\d:\d\d, depuis JARVIS — jusqu’à nouvel ordre$/.test(p1.etat) && p1.faits['Prochain'] === 'aucun : en pause' && /^En pause depuis \d\d h \d\d, jusqu’à nouvel ordre\.$/.test(p1.ordre) && p1.boutons.slice(0, 2).join() === 'lancer (inactif),reprendre' && /en pause : reprends-la d’abord/.test(p1.pourquoi || ''), JSON.stringify(p1));
      ok('0.96 : … et la routine en pause se voit d’un coup d’œil dans la liste (pastille « En pause », prochain passage : en pause)', pst === 'En pause | Prochain passage : en pause', pst);
      await appui('reprendre'); await q.waitForTimeout(1900); const p2 = await feuille();
      ok('0.96 : « Reprendre » : la routine est de nouveau active, avec son prochain passage', p2.etat === 'Active' && /^Reprise à \d\d h \d\d\.$/.test(p2.ordre) && /à 07:40$/.test(p2.faits['Prochain']) && /^lancer( \(inactif\))?,pause$/.test(p2.boutons.slice(0, 2).join()), JSON.stringify([p2.etat, p2.ordre, p2.faits]));
      /* changer l'horaire : des jours et des heures, aperçu en clair, confirmation, retour à l'origine */
      await q.click('#sheet .ra-hor > summary'); await q.waitForTimeout(250); const h0 = await feuille();
      const reglages = () => q.evaluate(() => ({jours: [...document.querySelectorAll('#sheet [data-ra-jours][aria-pressed="true"]')].map((x) => x.dataset.raJours).join(), heures: [...document.querySelectorAll('#sheet [data-ra-heure]')].map((x) => x.dataset.raHeure).join(), sem: [...document.querySelectorAll('#sheet [data-ra-jour][aria-pressed="true"]')].map((x) => x.dataset.raJour).join(), minutes: [...document.querySelector('#sheet .ra-h select:nth-of-type(2)').options].map((x) => x.value).join()}));
      const g0 = await reglages();
      ok('0.96 : « Changer l’horaire » : prérempli avec l’horaire en vigueur (du lundi au vendredi, 07:40), minutes par pas de 5, aperçu en clair ; le bouton est inactif tant que rien ne change',
        g0.jours === 'ouvres' && g0.heures === '07:40' && g0.minutes === '00,05,10,15,20,25,30,35,40,45,50,55' && h0.apercu === 'Aperçu : du lundi au vendredi à 7 h 40.' && h0.boutons.includes('horaire (inactif)') && !h0.boutons.includes('origine'), JSON.stringify([g0, h0.apercu, h0.boutons]));
      await q.click('#sheet [data-ra-jours="tous"]'); await q.waitForTimeout(150); await q.click('#sheet [data-ra="heure-plus"]'); await q.waitForTimeout(150);
      await q.selectOption('#sheet .ra-h:nth-child(2) select:nth-of-type(1)', '13'); await q.waitForTimeout(150); await q.selectOption('#sheet .ra-h:nth-child(2) select:nth-of-type(2)', '15'); await q.waitForTimeout(200); const h1 = await feuille();
      ok('0.96 : … des heures qui ne tiennent pas dans un seul horaire (7 h 40 et 13 h 15) : dit clairement, rien à demander', /^Ces heures ne tiennent pas dans un seul horaire : garde la même minute/.test(h1.apercu) && !h1.boutons.some((x) => /^horaire/.test(x)), JSON.stringify([h1.apercu, h1.boutons]));
      await q.selectOption('#sheet .ra-h:nth-child(2) select:nth-of-type(1)', '07'); await q.waitForTimeout(150); await q.selectOption('#sheet .ra-h:nth-child(2) select:nth-of-type(2)', '55'); await q.waitForTimeout(200); const h2 = await feuille();
      await appui('horaire'); const h3 = await feuille(); await appui('horaire-oui'); await q.waitForTimeout(1900); const h4 = await feuille();
      ok('0.96 : … deux heures rapprochées acceptées (7 h 40 et 7 h 55, tous les jours) : aperçu « chaque jour à 7 h 40 et 7 h 55 », confirmation en un appui',
        h2.apercu === 'Aperçu : chaque jour à 7 h 40 et 7 h 55.' && h2.boutons.includes('horaire') && h3.boutons.includes('horaire-oui'), JSON.stringify([h2.apercu, h2.boutons, h3.boutons]));
      ok('0.96 : … « Horaire changé — pris en compte à … », le moment dit « horaire modifié ; à l’origine : … », le prochain passage est recalculé, « Revenir à l’horaire d’origine » apparaît',
        /^Horaire changé — pris en compte à \d\d h \d\d : chaque jour à 7 h 40 et 7 h 55\.$/.test(h4.ordre) && h4.faits['Quand'] === 'Chaque jour à 7 h 40 et 7 h 55 (horaire modifié ; à l’origine : du lundi au vendredi à 7 h 40)' && /à 07:(40|55)$/.test(h4.faits['Prochain']), JSON.stringify([h4.ordre, h4.faits]));
      await q.evaluate(() => { const d = document.querySelector('#sheet .ra-hor'); if (!d.open) d.querySelector('summary').click(); }); await q.waitForTimeout(250); const h5 = await feuille();
      await appui('origine'); await appui('origine-oui'); await q.waitForTimeout(1900); const h6 = await feuille();
      ok('0.96 : … « Revenir à l’horaire d’origine » (confirmé) : l’horaire d’origine est remis', h5.boutons.includes('origine') && /^Horaire d’origine remis — pris en compte à \d\d h \d\d\.$/.test(h6.ordre) && h6.faits['Quand'] === 'Du lundi au vendredi à 7 h 40', JSON.stringify([h5.boutons, h6.ordre, h6.faits]));
      /* une routine en erreur : l'erreur en détail ; le réveil : lancé aussi sur un événement */
      await ouvrir('prix-suivis'); const e1 = await feuille();
      ok('0.96 : une routine en erreur : « L’erreur en détail » avec la cause en clair, ce qu’il peut faire (« reprise vers 17 h 40, elle repartira seule ») et le texte de l’erreur',
        e1.titre === 'Prix suivis' && /^En erreur au dernier passage : limite du forfait$/.test(e1.etat) && e1.sections === 'erreur,fait,horaire,historique' && /^L’ERREUR EN DÉTAIL\n+Limite du forfait · .+ à 09:0\d\n+La limite du forfait Claude a coupé ce passage : reprise vers 17 h 40, elle repartira seule\.\n+RuntimeError: You've hit your 5-hour limit/i.test(e1.erreur || '')
        && /en erreur : limite du forfait/.test(e1.passages[0]) && /83 % réussis/.test(e1.stats), JSON.stringify([e1.etat, e1.sections, e1.erreur, e1.passages[0], e1.stats]));
      await q.click('#sheet .ra-hist .ra-p:first-child .ra-pb'); await q.waitForTimeout(250); const e2 = await feuille();
      ok('0.96 : … toucher le passage en erreur dans l’historique montre aussi son erreur', /RuntimeError: You've hit your 5-hour limit/.test(e2.detailPassage), e2.detailPassage);
      await ouvrir('reveil'); const v1 = await feuille(); await q.click('#sheet .ra-hor > summary'); await q.waitForTimeout(250);
      const v2 = await q.evaluate(() => [...document.querySelectorAll('#sheet .ra-hor .ra-note')].map((x) => x.textContent).join(' '));
      ok('0.96 : le réveil : la feuille dit qu’il se lance aussi sur un événement, et « Changer l’horaire » que l’horaire ne change que ses passages programmés ; un passage « réveil par JARVIS » est dans son historique',
        /^Se lance aussi sur un événement : un courrier qui arrive, une ligne du Canal\.$/.test(v1.evenement || '') && /l’horaire ne change que ses passages programmés/.test(v2) && v1.passages.some((x) => /réveil par JARVIS \(courrier, Canal\)$/.test(x)), JSON.stringify([v1.evenement, v2, v1.passages]));
      await ouvrir('digest-ia'); const g1 = await feuille();
      ok('0.96 : une routine en pause et en double : « En pause depuis hier …, depuis JARVIS », « Reprendre », et pas de compte rendu attendu en double', /^En pause depuis hier à \d\d:\d\d, depuis JARVIS — jusqu’à nouvel ordre$/.test(g1.etat) && g1.boutons.slice(0, 2).join() === 'lancer (inactif),reprendre' && /En double, la routine ne rend pas compte ici/.test(g1.fait) && g1.faits['Mode'] === 'en double (à blanc : rien n’est envoyé)', JSON.stringify([g1.etat, g1.boutons, g1.fait, g1.faits]));
      /* la carte d'Hermes : tout mettre en pause, tout reprendre */
      await q.evaluate(() => { document.querySelector('#sheet .sheet-close').click(); }); await q.waitForTimeout(500);
      const t0 = await q.evaluate(() => [...document.querySelectorAll('.hm-hermes .ra-tout button')].map((x) => x.textContent).join());
      await q.click('.hm-hermes [data-ra="tout-pause"]'); await q.waitForTimeout(200); const t1 = await q.evaluate(() => [...document.querySelectorAll('.hm-hermes .ra-tout button')].map((x) => x.textContent).join());
      await q.click('.hm-hermes [data-ra="tout-pause-oui"]'); await q.waitForTimeout(6500);
      const t2 = await q.evaluate(() => ({msg: (document.querySelector('.hm-hermes [data-ra="tout-msg"]') || {}).textContent, pst: [...document.querySelectorAll('#hr-routines li[data-hr]')].map((x) => (x.querySelector('.ra-pst') || {}).textContent || '-').join(), boutons: [...document.querySelectorAll('.hm-hermes .ra-tout button')].map((x) => x.textContent).join()}));
      ok('0.96 : la carte d’Hermes : « Tout mettre en pause » et « Tout reprendre » ; un appui demande confirmation avec le nombre de routines (« Confirmer : 5 routines »)', t0 === 'Tout mettre en pause,Tout reprendre' && /^Confirmer : 5 routines,Annuler/.test(t1), JSON.stringify([t0, t1]));
      ok('0.96 : … confirmé : « Pause demandée pour 5 routines. », les six routines portent la pastille « En pause », il ne reste que « Tout reprendre »', t2.msg === 'Pause demandée pour 5 routines.' && t2.pst === 'En pause,En pause,En pause,En pause,En pause,En pause' && t2.boutons === 'Tout reprendre', JSON.stringify(t2));
      /* Équipe › Routines : les cartes d'Hermes s'ouvrent aussi ; une notification « #voir-routine-<nom> » ouvre la feuille */
      await q.evaluate(() => { location.hash = '#automatisations'; }); await q.waitForTimeout(1500);
      await q.click('#auto-hermes article[data-hr="bilan-hebdo"]'); await q.waitForTimeout(700); const a1 = await feuille();
      ok('0.96 : Équipe › Routines : toucher une carte d’Hermes ouvre la même feuille', a1.ouverte && a1.titre === 'Bilan de la semaine' && a1.codeEtat === 'en pause', JSON.stringify([a1.titre, a1.codeEtat]));
      await q.evaluate(() => { document.querySelector('#sheet .sheet-close').click(); }); await q.waitForTimeout(400);
      await q.evaluate(() => { location.hash = '#voir-routine-reveil'; }); await q.waitForTimeout(2200); const n1 = await feuille();
      ok('0.96 : la notification de fin d’un passage lancé à la main (#voir-routine-<nom>) ouvre « Hermes et ses routines » et la feuille de la routine', n1.ouverte && n1.titre === 'Réveil', JSON.stringify([n1.ouverte, n1.titre]));
      await q.screenshot({path: path.join(SH, '096-feuille-routine.png')});
      await q.context().close(); }
    { const q = await pageWith({grokOff: true, hermesRefus: true}, '#equipe');
      await q.click('#hr-routines li[data-hr="bilan-hebdo"]'); await q.waitForTimeout(700); await q.click('#sheet .ra [data-ra="lancer"]'); await q.waitForTimeout(250); await q.click('#sheet .ra [data-ra="lancer-oui"]'); await q.waitForTimeout(4200);
      const r = await q.evaluate(() => { const x = document.querySelector('#sheet [data-ra="ordre"]'); return x ? {t: x.textContent, e: x.dataset.etat, ko: x.classList.contains('ko')} : null; });
      ok('0.96 : un refus du serveur (root) est dit avec sa raison : « Refusé à … : la limite du forfait Claude est atteinte : reprise vers 17 h 40, elle repartira seule. »', !!r && r.e === 'refusé' && r.ko && /^Refusé à \d\d h \d\d : la limite du forfait Claude est atteinte : reprise vers 17 h 40, elle repartira seule\.$/.test(r.t), JSON.stringify(r));
      await q.context().close(); }
    { const q = await pageWith({grokOff: true, hermesIndispo: true}, '#equipe');
      const n = await q.evaluate(() => ({ouvrables: document.querySelectorAll('#view .ra-ouvre').length, tout: document.querySelectorAll('.hm-hermes .ra-tout').length}));
      ok('0.96 : résumé indisponible : aucune routine à ouvrir, pas de « Tout mettre en pause » (rien à l’aveugle)', n.ouvrables === 0 && n.tout === 0, JSON.stringify(n));
      await q.context().close(); }
    /* ================= 0.93.0 : trois retours de l'app ================= */
    /* 1. Argent : « Déjà dépensé ce mois » et l'historique mois par mois (données d'exemple, même forme que le serveur) */
    { const q = await page('#argent'); await q.waitForTimeout(800);
      const hero = await q.evaluate(() => { const b = document.querySelector('.rad-hero .rad-deja-mois'), D = window.__RADAR.mois.depense; return {t: b ? b.textContent : '', sous: !!(b && b.previousElementSibling && b.previousElementSibling.classList.contains('rad-prog-l')), nw: b ? b.querySelectorAll('.nw').length : 0, total: D.total, somme: Math.round((D.fixes + D.plans + D.courantes) * 100) / 100}; });
      const eurM = (n) => Number(n).toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace(/[   ]/g, ' ') + ' €', plat = (t) => String(t).replace(/[  ]/g, ' ');
      ok('0.93 : Argent : la grande carte dit « Déjà dépensé en <mois> : <total> » sous « Déjà prélevé », montant insécable, égal aux dépenses fixes passées + dépenses courantes notées',
        /^Déjà dépensé en \S+ : /.test(hero.t) && plat(hero.t).includes(eurM(hero.total)) && hero.sous && hero.nw === 1 && hero.total === hero.somme && hero.total > 0, JSON.stringify(hero));
      await q.evaluate(() => document.querySelector('.rad-hero .rad-deja-mois').click()); await q.waitForTimeout(900);
      const dep = await q.evaluate(() => { const c = document.querySelector('#view .rad-mois .rad-depense'), D = window.__RADAR.mois.depense; if (!c) return null; c.querySelector('details').open = true;
        return {t: c.innerText, big: c.querySelector('.rad-big').textContent, lignes: c.querySelectorAll('.rad-dep-r').length, n: D.lignes.length, nF: D.nFixes, nN: D.nNotes, mois: [...document.querySelectorAll('#view .ux-seg button, #view .rad-seg button')].some((b) => /Le mois/.test(b.textContent) && b.getAttribute('aria-pressed') === 'true'),
          apresVivre: !!(c.previousElementSibling && /rad-vivre|rad-mois-dont|lead/.test(c.previousElementSibling.className))}; });
      ok('0.93 : Argent › Le mois : la carte « Déjà dépensé » avec le détail (dépenses fixes déjà passées, dépenses courantes notées, comptées jusqu’à hier), une ligne par dépense, rien d’absent affiché',
        !!dep && dep.mois && plat(dep.big) === eurM(hero.total) && new RegExp('de dépenses fixes déjà passées \\(' + dep.nF + '\\)').test(dep.t) && new RegExp('de dépenses courantes notées \\(' + dep.nN + '\\)').test(dep.t) && /jusqu’à hier \(\d\d\/\d\d\)/.test(dep.t)
        && dep.lignes === dep.n && dep.n > 0 && /Le détail \(\d+\)/.test(dep.t) && !/null|undefined|NaN/.test(dep.t) && dep.apresVivre, JSON.stringify(dep && {...dep, t: dep.t.slice(0, 300)}));
      const hist = await q.evaluate(() => { const p = document.querySelector('#view .rad-hist'); if (!p) return null; const rows = [...p.querySelectorAll('.rad-hm')];
        return {titre: p.querySelector('h2').textContent, aside: p.querySelector('.aside').textContent, n: rows.length, mois: rows.map((r) => r.dataset.mois), cours: rows[0].classList.contains('is-cours') && /en cours/.test(rows[0].textContent), six: /Six derniers mois/.test(document.querySelector('#view').textContent), plus: (p.querySelector('.rad-hist-plus') || {}).textContent,
          gardes: window.__RADAR.mois.historique.filter((g) => !g.estime).length, insecables: rows.every((r) => !!r.querySelector('summary .rad-evo-v .nw'))}; });
      const cur = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
      ok('0.93 : Argent : l’historique remplace « Six derniers mois » : le mois en cours en tête (en direct), puis les mois clos du plus récent au plus ancien (12 affichés, « Tous les mois » pour le reste), 24 mois gardés',
        !!hist && hist.titre === 'Historique' && hist.aside === '24 mois gardés' && hist.gardes >= 24 && hist.n === 13 && hist.mois[0] === cur && hist.cours && hist.mois.every((m, i, l) => !i || l[i - 1] > m) && !hist.six && hist.plus === 'Tous les mois (26)' && hist.insecables, JSON.stringify(hist));
      await q.evaluate(() => document.querySelector('#view .rad-hist-plus').click()); await q.waitForTimeout(600);
      const tous = await q.evaluate(() => { const rows = [...document.querySelectorAll('#view .rad-hist .rad-hm')]; return {n: rows.length, estimes: rows.filter((r) => r.classList.contains('is-estime') && /≈/.test(r.querySelector('summary').textContent)).length, recon: rows.filter((r) => /reconstitué/.test(r.querySelector('summary').textContent)).length, note: document.querySelector('#view .rad-hist .rad-evo-note').textContent, plus: document.querySelector('#view .rad-hist-plus').textContent}; });
      ok('0.93 : Argent : « Tous les mois » montre les 26 mois (24 gardés dont un « reconstitué », 2 plus anciens « ≈ » estimés) et le dit', tous.n === 27 && tous.estimes === 2 && tous.recon === 1 && /24 mois au moins/.test(tous.note) && /« ≈ »/.test(tous.note) && tous.plus === 'Seulement les 12 derniers mois', JSON.stringify(tous));
      await q.evaluate(() => document.querySelectorAll('#view .rad-hist .rad-hm')[2].querySelector('summary').click()); await q.waitForTimeout(500);
      const det = await q.evaluate(() => { const r = document.querySelectorAll('#view .rad-hist .rad-hm')[2], g = window.__RADAR.mois.historique[1]; return {open: r.open, mois: r.dataset.mois === g.mois, t: r.querySelector('.rad-hm-b').innerText, postes: r.querySelectorAll('.rad-hm-p li').length, n: g.postes.length}; });
      await q.evaluate(() => document.querySelector('#view .rad-hist-plus').click()); await q.waitForTimeout(600);
      const reste = await q.evaluate(() => { const r = document.querySelectorAll('#view .rad-hist .rad-hm')[2]; return !!r && r.open && document.querySelectorAll('#view .rad-hist .rad-hm').length === 13; });
      ok('0.93 : Argent : un mois s’ouvre sur son détail (dépenses fixes payées, dépenses courantes notées sur le budget prévu, reste à vivre, postes, « Bilan gardé le … ») et reste ouvert quand la liste se redessine',
        det.open && det.mois && /Dépenses fixes payées/.test(det.t) && /Dépenses courantes notées/.test(det.t) && /sur 520,00\s€ prévus/.test(plat(det.t)) && /Reste à vivre/.test(det.t) && /paie de 3 000,00 €/.test(plat(det.t)) && /Bilan gardé le \d\d\/\d\d\/\d{4} : il ne change plus\./.test(det.t) && det.postes === det.n && det.n >= 5 && reste, JSON.stringify({...det, t: det.t.slice(0, 260), reste}));
      await q.context().close(); }
    /* 2. Agenda, Grok arrêté : JARVIS ou Hermes à la place des bots (feuille d'un jour, fiches, légende) */
    { const BOTS_RE = /Iris|Chronos|Kairos|Ulysse|Athéna|Argus|Plutus/, VIEUX = /par le Canal, réponse à son passage|Un bot s'en occupe|Un bot suit|Confier à un autre bot/;
      /* le jour d'une échéance d'exemple : dans le mois affiché, sinon le mois d'avant ou d'après (le banc ne dépend pas de la date) */
      const jourDe = async (q, re) => { for (const sens of [null, 'Mois suivant', 'Mois précédent', 'Mois précédent']) { if (sens) { await q.evaluate((s) => document.querySelector('.cal-head button[aria-label="' + s + '"]').click(), sens); await q.waitForTimeout(500); }
        const i = await q.evaluate((src) => [...document.querySelectorAll('#view .mg-d')].findIndex((x) => new RegExp(src).test(x.getAttribute('aria-label') || '')), re.source); if (i >= 0) { await q.evaluate((i) => document.querySelectorAll('#view .mg-d')[i].click(), i); await q.waitForTimeout(900); return true; } } return false; };
      const feuille = (q) => q.evaluate(() => { const s = document.getElementById('sheet'), hd = s.querySelector('.sheet-head .chr'); return {t: s.innerText, avatar: hd ? hd.className : '', lignes: [...s.querySelectorAll('.day-list .dl-row')].map((r) => [r.querySelector('span:not(.dl-ic)').textContent, (r.querySelector('small') || {}).textContent || '']), actions: [...s.querySelectorAll('.sheet-actions .btn')].map((b) => b.childNodes[0].textContent.trim()), talk: [...s.querySelectorAll('.sheet-after .talk > button b')].map((b) => b.textContent)}; });
      const fermer = (q) => q.evaluate(() => { const b = document.querySelector('#sheet .sheet-close'); if (b) b.click(); });
      const q = await pageWith({grokOff: true}, '#agenda'); await q.waitForTimeout(1500);
      await q.evaluate(() => { const d = document.querySelector('#view details.lg-fold'); if (d) d.open = true; }); await q.waitForTimeout(300);
      const vue = await q.evaluate(() => ({t: document.getElementById('view').innerText, lg: [...document.querySelectorAll('#view .cal-legend .lg-t')].map((x) => x.textContent), puces: [...document.querySelectorAll('#view .cal-legend .lg-row')][1] ? [...[...document.querySelectorAll('#view .cal-legend .lg-row')][1].querySelectorAll('.lg-chip span:not(.mg-ic)')].map((x) => x.textContent) : []}));
      ok('0.93 : Agenda, Grok arrêté : plus aucun nom de bot ni « Un bot s’en occupe » dans la vue ; la légende dit « Fait par Hermes » avec une seule ligne (plus les sept bots)',
        !BOTS_RE.test(vue.t) && !VIEUX.test(vue.t) && vue.lg.includes('Fait par Hermes, rien à faire pour toi') && !vue.lg.some((x) => /un bot/i.test(x)) && vue.puces.length === 1 && /^Hermes · /.test(vue.puces[0]), JSON.stringify({noms: (vue.t.match(BOTS_RE) || [])[0], lg: vue.lg, puces: vue.puces}));
      await q.evaluate(() => [...document.querySelectorAll('#view .cal-legend .lg-row')][1].querySelector('.lg-chip').click()); await q.waitForTimeout(500);
      const filtre = await q.evaluate(() => ({on: (document.querySelector('#view .lg-on') || {}).textContent, hits: document.querySelectorAll('#view .mg-d.is-hit').length, n: +(([...document.querySelectorAll('#view .cal-legend .lg-row')][1].querySelector('.lg-chip b') || {}).textContent || 0)}));
      await q.evaluate(() => [...document.querySelectorAll('#view .cal-legend .lg-row')][1].querySelector('.lg-chip').click()); await q.waitForTimeout(400);
      ok('0.93 : Agenda, Grok arrêté : la ligne « Hermes » de la légende surligne les jours de ce qu’il suit (« Filtre : Hermes »)', filtre.on === 'Filtre : Hermes' && (filtre.n === 0 ? filtre.hits === 0 : filtre.hits >= 1), JSON.stringify(filtre));
      /* la feuille d'un jour : avatar de JARVIS, « Écrire à Hermes », « Voir Travail » ; à côté d'un prix suivi : « Hermes suit » */
      const aOffre = await jourDe(q, /Fin de l'offre de lancement/), fo = await feuille(q);
      ok('0.93 : Agenda, Grok arrêté : la feuille d’un jour montre l’avatar de JARVIS (plus Chronos), « Écrire à Hermes » (plus « Écrire à Chronos par le Canal »), « Voir Travail » pour le CRA et les notes de frais ; à côté de l’offre que suivait Kairos : « Hermes suit »',
        aOffre && /chr-claude/.test(fo.avatar) && !/chr-medusa/.test(fo.avatar) && fo.talk.join() === 'Discuter avec Claude,Écrire à Hermes,Voir Travail' && !BOTS_RE.test(fo.t) && !VIEUX.test(fo.t) && fo.lignes.some((l) => /Fin de l'offre de lancement/.test(l[0]) && l[1] === 'Hermes suit'), JSON.stringify({...fo, t: fo.t.slice(0, 200)}));
      /* la fiche de cette échéance, ouverte depuis la feuille du jour */
      await q.evaluate(() => [...document.querySelectorAll('#sheet .day-list button.dl-row')].find((r) => /Fin de l'offre de lancement/.test(r.textContent)).click()); await q.waitForTimeout(900);
      const fe = await q.evaluate(() => { const s = document.getElementById('sheet'), d = s.querySelector('details.sheet-det'); if (d) d.open = true; const hd = s.querySelector('.sheet-head .chr'); return {t: s.innerText, avatar: hd ? hd.className : '', talk: [...s.querySelectorAll('.sheet-after .talk > button b')].map((b) => b.textContent)}; });
      ok('0.93 : Agenda, Grok arrêté : la fiche d’une échéance que suivait Kairos : avatar d’Hermes, « Suivi par : Hermes suit », « Écrire à Hermes », plus de « Confier à un autre bot »',
        /chr-hermes/.test(fe.avatar) && /suivi par\s*Hermes suit/i.test(fe.t) && fe.talk.join() === 'Discuter avec Claude,Écrire à Hermes' && !BOTS_RE.test(fe.t) && !VIEUX.test(fe.t), JSON.stringify({...fe, t: fe.t.slice(0, 300)}));
      /* « Écrire à Hermes » depuis la fiche : une ligne pour Hermes dans le Canal, le sujet de la fiche en Objet, sans sonnette */
      await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-after .talk > button')].find((b) => /Écrire à Hermes/.test(b.textContent)).click()); await q.waitForTimeout(700);
      const eh = await q.evaluate(() => { const s = document.getElementById('sheet'), hd = s.querySelector('.sheet-head .chr'); return {titre: s.querySelector('.sheet-title').textContent, avatar: hd ? hd.className : ''}; });
      await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Écrire/.test(x.textContent)).click()); await q.waitForTimeout(500);
      const avantE = await q.evaluate(() => ({canal: window.__G.Canal.length, sends: (window.__calls || []).filter((c) => c.tool === 'send_message').length}));
      await q.evaluate(() => { const t = document.querySelector('#sheet .sheet-pick textarea'); t.value = 'Garde un œil dessus.'; t.closest('form').requestSubmit(); }); await q.waitForTimeout(6800);
      const apresE = await q.evaluate(() => ({l: window.__G.Canal[window.__G.Canal.length - 1] || [], canal: window.__G.Canal.length, sends: (window.__calls || []).filter((c) => c.tool === 'send_message').length}));
      ok('0.93 : Agenda, Grok arrêté : « Écrire à Hermes » depuis une fiche écrit une ligne pour Hermes dans le Canal (le sujet de la fiche dans le message et dans l’Objet), sans sonnette',
        eh.titre === 'Écrire à Hermes' && /chr-hermes/.test(eh.avatar) && apresE.canal === avantE.canal + 1 && apresE.l[1] === 'Rabie' && apresE.l[2] === 'Hermes' && /À propos de « Fin de l'offre de lancement » : Garde un œil dessus\./.test(apresE.l[4]) && apresE.l[7] === "Fin de l'offre de lancement" && apresE.sends === avantE.sends, JSON.stringify([eh, apresE]));
      await fermer(q); await q.waitForTimeout(500);
      /* le CRA : « Hermes · voir Travail » dans la feuille du jour, « Voir Travail » en tête de la fiche */
      const aCra = await jourDe(q, /CRA client de la semaine/), fc = await feuille(q);
      await q.evaluate(() => [...document.querySelectorAll('#sheet .day-list button.dl-row')].find((r) => /CRA client de la semaine/.test(r.textContent)).click()); await q.waitForTimeout(900);
      const fcra = await q.evaluate(() => { const s = document.getElementById('sheet'), d = s.querySelector('details.sheet-det'); if (d) d.open = true; const hd = s.querySelector('.sheet-head .chr'); return {t: s.innerText, avatar: hd ? hd.className : '', kicker: s.querySelector('.sheet-kicker').textContent, mains: [...s.querySelectorAll('.sheet-actions .sa-main .btn')].map((b) => [b.childNodes[0].textContent.trim(), b.classList.contains('main')]), talk: [...s.querySelectorAll('.sheet-after .talk > button b')].map((b) => b.textContent)}; });
      ok('0.93 : Agenda, Grok arrêté : le CRA que faisait Chronos : « Hermes · voir Travail » dans la feuille du jour ; sa fiche dit « Hermes s’en occupe », « Suivi par : Hermes, sur le portail (espace Travail) », avec « Voir Travail » en action principale',
        aCra && fc.lignes.some((l) => /CRA client de la semaine/.test(l[0]) && l[1] === 'Hermes · voir Travail') && /chr-hermes/.test(fcra.avatar) && /^Hermes s'en occupe · /i.test(fcra.kicker) && /suivi par\s*Hermes, sur le portail \(espace Travail\)/i.test(fcra.t) && fcra.mains[0][0] === 'Voir Travail' && fcra.mains[0][1] && fcra.mains.filter((m) => m[1]).length === 1
        && fcra.talk.join() === 'Discuter avec Claude,Écrire à Hermes,Voir Travail' && !BOTS_RE.test(fcra.t) && !VIEUX.test(fcra.t), JSON.stringify({l: fc.lignes, ...fcra, t: fcra.t.slice(0, 200)}));
      await q.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Voir Travail/.test(x.textContent)).click()); await q.waitForTimeout(900);
      ok('0.93 : Agenda, Grok arrêté : « Voir Travail » ferme la fiche et ouvre l’espace Travail', await q.evaluate(() => location.hash === '#travail' && document.getElementById('sheet').hidden), await q.evaluate(() => location.hash));
      await q.evaluate(() => { location.hash = '#agenda'; }); await q.waitForTimeout(900);
      /* un événement de son agenda : avatar de JARVIS, « Écrire à Hermes » (plus « Écrire à Iris ») */
      const aEv = await jourDe(q, /Dentiste/);
      await q.evaluate(() => [...document.querySelectorAll('#sheet .day-list button.dl-row')].find((r) => /Dentiste/.test(r.textContent)).click()); await q.waitForTimeout(900);
      const fev = await q.evaluate(() => { const s = document.getElementById('sheet'), hd = s.querySelector('.sheet-head .chr'); return {t: s.innerText, avatar: hd ? hd.className : '', talk: [...s.querySelectorAll('.sheet-after .talk > button b')].map((b) => b.textContent)}; });
      ok('0.93 : Agenda, Grok arrêté : la fiche d’un événement : avatar de JARVIS, « Écrire à Hermes » (plus « Écrire à Iris par le Canal »)', aEv && /chr-claude/.test(fev.avatar) && fev.talk.join() === 'Discuter avec Claude,Écrire à Hermes' && !/Écrire à Iris/.test(fev.t) && !VIEUX.test(fev.t), JSON.stringify({...fev, t: fev.t.slice(0, 200)}));
      await q.context().close();
      /* tant que Grok n'est pas arrêté, l'ancien affichage reste */
      const q0 = await page('#agenda'); await q0.waitForTimeout(800);
      await q0.evaluate(() => { const d = document.querySelector('#view details.lg-fold'); if (d) d.open = true; }); await q0.waitForTimeout(300);
      const lg0 = await q0.evaluate(() => ({lg: [...document.querySelectorAll('#view .cal-legend .lg-t')].map((x) => x.textContent), puces: [...document.querySelectorAll('#view .cal-legend .lg-row')][1].querySelectorAll('.lg-chip').length}));
      const a0 = await jourDe(q0, /Fin de l'offre de lancement/), f0 = await feuille(q0);
      ok('0.93 : Agenda, Grok en service : rien ne change (avatar de Chronos, « Écrire à Chronos » par le Canal, « Kairos » à côté de l’offre, la légende des sept bots)',
        a0 && /chr-medusa/.test(f0.avatar) && f0.talk.join() === 'Discuter avec Claude,Écrire à Chronos' && /par le Canal, réponse à son passage/.test(f0.t) && f0.lignes.some((l) => /Fin de l'offre de lancement/.test(l[0]) && l[1] === 'Kairos') && lg0.lg.includes('Fait par un bot, rien à faire pour toi') && lg0.puces === 7, JSON.stringify({...f0, t: f0.t.slice(0, 160), lg0}));
      await q0.context().close(); }
    /* 3. Pour moi : une seule carte par sujet lié */
    { const base0 = await (async () => { const z = await page('#demandes'); await z.waitForTimeout(800); const n = await z.evaluate(() => +document.querySelector('.tab[data-tab="demandes"] .badge').textContent); await z.context().close(); return n; })();
      const q = await pageWith({sujets: true}, '#demandes'); await q.waitForTimeout(1500);
      const cartes = () => q.evaluate(() => [...document.querySelectorAll('#view .pm-card')].map((c) => ({t: c.querySelector('.pm-title').textContent, de: (c.querySelector('.pm-sj-de') || {}).textContent || '', sec: (c.closest('.pm-sec') || {}).id, pill: (c.querySelector('.pm-head .pill') || {}).textContent || '', sujet: c.dataset.sujet || '', n: +(c.dataset.n || 0), lies: [...c.querySelectorAll('.pm-lie')].map((l) => [l.querySelector('b').textContent, l.querySelector('small').textContent, l.classList.contains('is-urgent')]), titreLies: (c.querySelector('.pm-lies-t') || {}).textContent || ''})));
      const C1 = await cartes(), de = (re) => C1.filter((c) => re.test(c.t) || re.test(c.de) || c.lies.some((l) => re.test(l[0])));
      const sin = de(/Sinistre inondations|Devis du plombier|Relancer l'assureur|Passage de l'expert/);
      const brSin = await q.evaluate(() => [...document.querySelectorAll('#view .draft-card')].filter((c) => /Déclaration de sinistre/.test(c.textContent)).length);
      ok('0.93 : Pour moi : le sinistre tient en une seule carte, au nom du dossier : la demande la plus urgente en tête (« Devis du plombier », venue du Canal, liée par son Objet), et dedans la demande du dossier, le brouillon prêt (lié par les mots de son objet : plus de carte « Brouillon prêt » à part) et ses deux échéances (liées par le nom entre parenthèses)',
        sin.length === 1 && brSin === 0 && sin[0].t === 'Sinistre inondations (appartement)' && sin[0].de === 'Devis du plombier' && sin[0].sujet === 'Sinistre inondations (appartement)' && sin[0].n === 5 && sin[0].titreLies === 'Aussi dans ce sujet · 4'
        && sin[0].lies.map((l) => l[0]).join(' | ') === "Déclarer le sinistre à l'assureur depuis son appli | Déclaration de sinistre : inondations dans l'appartement | Relancer l'assureur (Sinistre inondations) | Passage de l'expert (sinistre inondations)" && /^À faire · Iris/.test(sin[0].lies[0][1])
        && sin[0].lies[1][1] === 'Brouillon prêt · à sinistres@assureur.example' && /^À faire par toi · demain$/.test(sin[0].lies[2][1]), JSON.stringify([sin, brSin]));
      ok('0.93 : Pour moi : la plus urgente décide de la place et de la couleur : la carte est sous « À décider » (la question du devis) et sa pastille dit « Dans 1 j » (la relance de demain, avant le devis à 2 jours), ligne en ambre',
        sin.length === 1 && sin[0].sec === 'pm-dec' && sin[0].pill === 'Dans 1 j' && sin[0].lies[2][2] === true && sin[0].lies[3][2] === false, JSON.stringify(sin[0] && [sin[0].sec, sin[0].pill, sin[0].lies.map((l) => l[2])]));
      /* un sujet sans demande : deux brouillons et une échéance d'un dossier qui attend quelqu'un d'autre ; une réponse reçue et l'échéance de son dossier */
      const sans = await q.evaluate(() => { const lies = (c) => [...c.querySelectorAll('.pm-lie')].map((l) => [l.querySelector('b').textContent, l.querySelector('small').textContent]);
        const br = [...document.querySelectorAll('#view .draft-card')].filter((c) => /caution|recours/i.test(c.textContent)), rp = [...document.querySelectorAll('#view .card.item')].filter((c) => /Réponse reçue/.test((c.querySelector('.item-bot') || {}).textContent || '') && /Dégât des eaux/.test(c.textContent));
        return {br: br.map((c) => ({sujet: c.dataset.sujet || '', nom: (c.querySelector('.pm-sj-nom') || {}).textContent || '', t: c.querySelector('.item-title').textContent, lies: lies(c), boutons: [...c.querySelectorAll('.row-actions .btn')].length})), rp: rp.map((c) => ({sujet: c.dataset.sujet || '', lies: lies(c), boutons: [...c.querySelectorAll('.row-actions .btn, .row-actions a')].length}))}; });
      ok('0.93 : Pour moi : un sujet sans demande tient aussi en une carte : les deux brouillons du dossier « Remboursement de la caution » (l’un lié par son objet, l’autre par le début de son texte) et son échéance sous le premier brouillon, qui garde ses boutons et porte le nom du dossier',
        sans.br.length === 1 && sans.br[0].sujet === 'Remboursement de la caution (ancien logement)' && sans.br[0].nom === 'Remboursement de la caution (ancien logement)' && sans.br[0].boutons >= 1 && sans.br[0].lies.length === 2 && sans.br[0].lies[0][1] === 'Brouillon prêt · à bailleur@delta.example'
        && [sans.br[0].t, sans.br[0].lies[0][0]].sort().join(' | ') === 'Dernier courrier avant recours | Relance : remboursement de la caution' && sans.br[0].lies[1][0] === 'Point sur le remboursement de la caution', JSON.stringify(sans.br));
      ok('0.93 : Pour moi : la réponse reçue sur le dossier « Dégât des eaux » porte l’échéance de ce dossier (« Passage de l’expert (Dégât des eaux) »), dans la même carte, avec ses boutons',
        sans.rp.length === 1 && sans.rp[0].sujet === 'Dégât des eaux' && sans.rp[0].lies.length === 1 && sans.rp[0].lies[0][0] === "Passage de l'expert (Dégât des eaux)" && sans.rp[0].boutons >= 1, JSON.stringify(sans.rp));
      const exp = de(/Prestimo/);
      ok('0.93 : Pour moi : le rachat de crédit tient en une seule carte, même si le dossier attend quelqu’un d’autre : deux demandes du Canal (un nom raccourci entre parenthèses, « (rachat Prestimo) », et les mêmes mots que le dossier) et l’échéance de l’offre',
        exp.length === 1 && exp[0].t === 'Rachat du crédit Prestimo (organisme Alpha)' && exp[0].de === 'Offre de prêt Gamma (rachat Prestimo)' && exp[0].n === 3 && exp[0].lies.map((l) => l[0]).join(' | ') === "Pièces pour le rachat du crédit Prestimo | Fin de l'offre de prêt Gamma (rachat Prestimo)" && exp[0].pill === 'Dans 3 j', JSON.stringify(exp));
      const ass = C1.filter((c) => /ssurance/.test(c.t));
      ok('0.93 : Pour moi : les faux amis restent séparés : « Assurance habitation », « Assurance auto » et « Attestation d’assurance » font trois cartes ; le renouvellement de l’assurance auto ne va qu’avec elle ; « Assurance : point annuel » ne va avec aucune',
        ass.map((c) => c.t).sort().join(' | ') === "Assurance auto | Assurance habitation | Attestation d'assurance" && ass.find((c) => c.t === 'Assurance auto').lies.map((l) => l[0]).join() === "Renouvellement de l'assurance auto" && ass.find((c) => c.t === 'Assurance habitation').lies.length === 0
        && !C1.some((c) => c.lies.some((l) => /point annuel/.test(l[0]))) && ass.every((c) => !c.de), JSON.stringify(ass.map((c) => [c.t, c.lies.map((l) => l[0])])));
      /* les comptes : la pastille compte les sujets ; un filtre compte ce qu'il montre */
      const cpt = await q.evaluate(() => { const n = (f) => +((document.querySelector('#view .ux-seg [data-f="' + f + '"] b') || {}).textContent || 0); return {badge: +document.querySelector('.tab[data-tab="demandes"] .badge').textContent, entete: (document.querySelector('#status .st.is-demande') || {}).textContent || '', dec: n('decider'), faire: n('faire')}; });
      await q.evaluate(() => document.querySelector('#view .ux-seg [data-f="decider"]').click()); await q.waitForTimeout(500);
      const vusDec = await q.evaluate(() => ['pm-dec', 'pm-cra', 'pm-jours'].reduce((s, id) => { const x = document.getElementById(id); return s + (x && !x.hidden ? x.querySelectorAll(id === 'pm-jours' ? '.jours-card' : id === 'pm-cra' ? '.cra-card' : '.pm-list > *').length : 0); }, 0));
      await q.evaluate(() => document.querySelector('#view .ux-seg [data-f="tout"]').click()); await q.waitForTimeout(500);
      ok('0.93 : Pour moi : le compte « pour toi » compte les sujets (7 demandes et 3 brouillons de plus, dont 2 demandes et 2 brouillons rangés dans la carte de leur sujet : + 6), le même dans l’en-tête et la pastille ; le filtre « Décider » compte ce qu’il montre',
        cpt.badge === base0 + 6 && new RegExp('^\\s*' + cpt.badge + ' pour toi').test(cpt.entete) && cpt.dec === vusDec && cpt.dec > 0, JSON.stringify({base0, ...cpt, vusDec}));
      /* chaque élément garde sa feuille et ses actions */
      await q.evaluate(() => [...document.querySelectorAll('#view .pm-sujet[data-sujet^="Sinistre"] .pm-lie')].find((l) => /Déclarer le sinistre/.test(l.textContent)).click()); await q.waitForTimeout(900);
      const fd = await q.evaluate(() => { const s = document.getElementById('sheet'); return {ouvert: !s.hidden, titre: s.querySelector('.sheet-title').textContent, actions: [...s.querySelectorAll('.sheet-actions .btn')].map((b) => b.childNodes[0].textContent.trim()), lies: [...s.querySelectorAll('.pm-lie b')].map((b) => b.textContent)}; });
      await q.evaluate(() => document.querySelector('#sheet .sheet-close').click()); await q.waitForTimeout(500);
      await q.evaluate(() => [...document.querySelectorAll('#view .pm-sujet[data-sujet^="Sinistre"] .pm-lie')].find((l) => /Relancer l'assureur/.test(l.textContent)).click()); await q.waitForTimeout(900);
      const fe2 = await q.evaluate(() => { const s = document.getElementById('sheet'); return {titre: s.querySelector('.sheet-title').textContent, actions: [...s.querySelectorAll('.sheet-actions .btn')].map((b) => b.childNodes[0].textContent.trim())}; });
      await q.evaluate(() => document.querySelector('#sheet .sheet-close').click()); await q.waitForTimeout(500);
      await q.evaluate(() => [...document.querySelectorAll('#view .pm-sujet[data-sujet^="Sinistre"] .pm-lie')].find((l) => /Déclaration de sinistre/.test(l.textContent)).click()); await q.waitForTimeout(900);
      const fb = await q.evaluate(() => { const s = document.getElementById('sheet'); return {titre: s.querySelector('.sheet-title').textContent, kicker: s.querySelector('.sheet-kicker').textContent, actions: [...s.querySelectorAll('.sheet-actions .btn')].map((b) => b.childNodes[0].textContent.trim())}; });
      await q.evaluate(() => document.querySelector('#sheet .sheet-close').click()); await q.waitForTimeout(500);
      ok('0.93 : Pour moi : le brouillon rangé dans la carte s’ouvre sur sa feuille de brouillon (relire, envoyer)', /Déclaration de sinistre/.test(fb.titre) && /^Brouillon/.test(fb.kicker) && fb.actions.length >= 1, JSON.stringify(fb));
      ok('0.93 : Pour moi : un élément rangé dans la carte s’ouvre sur sa propre feuille, avec ses actions : la demande du dossier (ses réponses, et les autres éléments du sujet dessous), l’échéance (« C’est fait », « Reporter »)',
        fd.ouvert && fd.titre === 'Sinistre inondations (appartement)' && fd.actions.length >= 2 && fd.lies.join(' | ') === "Devis du plombier | Déclaration de sinistre : inondations dans l'appartement | Relancer l'assureur (Sinistre inondations) | Passage de l'expert (sinistre inondations)"
        && fe2.titre === "Relancer l'assureur (Sinistre inondations)" && fe2.actions.includes("C'est fait") && fe2.actions.includes('Reporter'), JSON.stringify([fd, fe2]));
      /* une notification « #voir-<ligne> » ouvre toujours le bon élément, même rangé dans la carte d'un autre */
      const rangs = await q.evaluate(() => ({pieces: window.__G.Canal.findIndex((r) => r[3] === 'Pièces pour le rachat du crédit Prestimo') + 1, devis: window.__G.Canal.findIndex((r) => r[3] === 'Devis du plombier') + 1}));
      await q.evaluate((r) => { location.hash = '#voir-' + r; }, rangs.pieces); await q.waitForTimeout(2500);
      const v1 = await q.evaluate(() => { const s = document.getElementById('sheet'); return {ouvert: !s.hidden, titre: (s.querySelector('.sheet-title') || {}).textContent, actions: s.querySelectorAll('.sheet-actions .btn').length}; });
      await q.evaluate(() => { const b = document.querySelector('#sheet .sheet-close'); if (b) b.click(); }); await q.waitForTimeout(500);
      await q.evaluate((r) => { location.hash = '#voir-' + r; }, rangs.devis); await q.waitForTimeout(2500);
      const v2 = await q.evaluate(() => { const s = document.getElementById('sheet'); return {ouvert: !s.hidden, titre: (s.querySelector('.sheet-title') || {}).textContent}; });
      await q.evaluate(() => { const b = document.querySelector('#sheet .sheet-close'); if (b) b.click(); }); await q.waitForTimeout(500);
      ok('0.93 : Pour moi : « #voir-<ligne> » ouvre le bon élément : la demande « Pièces… » rangée dans la carte du rachat, et « Devis du plombier » en tête de la carte du sinistre',
        rangs.pieces > 1 && rangs.devis > 1 && v1.ouvert && v1.titre === 'Pièces pour le rachat du crédit Prestimo' && v1.actions >= 1 && v2.ouvert && v2.titre === 'Devis du plombier', JSON.stringify([rangs, v1, v2]));
      /* « une par une » : chaque élément y passe, un à un (rien n'est rangé) */
      const nAv = (await cartes()).length;
      await q.evaluate(() => document.getElementById('fc-start').click()); await q.waitForTimeout(700);
      const fcn = await q.evaluate(() => ({compte: (document.querySelector('.fc-count') || {}).textContent || '', lies: document.querySelectorAll('#view .pm-lies').length}));
      await q.evaluate(() => document.querySelector('.fc-close').click()); await q.waitForTimeout(600);
      ok('0.93 : Pour moi : « Traiter une par une » passe chaque élément un à un (les deux demandes rangées y sont, sans liste « Aussi dans ce sujet ») ; au retour, les cartes par sujet reviennent',
        /^1 sur \d+$/.test(fcn.compte) && fcn.lies === 0 && (await cartes()).length === nAv && (await cartes()).filter((c) => c.sujet).length >= 3, JSON.stringify(fcn));
      /* l'accueil : un sujet n'y est qu'une fois, et le même compte */
      await q.evaluate(() => { location.hash = ''; }); await q.waitForTimeout(1500);
      /* le chiffre de l'accueil compte jusqu'à sa valeur (0.55.0) : attendre qu'il y soit, pas un délai fixe (lu trop tôt : « 5 », « 14 » pour 23) */
      await q.waitForFunction((n) => ((document.querySelector('.hud-ro.q-bl b') || {}).textContent || '').startsWith(String(n)), cpt.badge, {timeout: 8000}).catch(() => {});
      const acc = await q.evaluate(() => ({t: document.getElementById('view').innerText, hud: (document.querySelector('.hud-ro.q-bl b') || {}).textContent || ''}));
      ok('0.93 : accueil : le même compte « pour toi » que la pastille ; un sujet n’y est pas deux fois', acc.hud.startsWith(String(cpt.badge)) && (acc.t.match(/Devis du plombier|Déclarer le sinistre/g) || []).length <= 1 && (acc.t.match(/Offre de prêt Gamma|Pièces pour le rachat/g) || []).length <= 1, JSON.stringify([acc.hud, cpt.badge]));
      /* la règle seule (noms inventés) */
      const regle = await q.evaluate(() => { const L = window.__sujets93.lier, D = ['Sinistre inondations (appartement)', 'Rachat du crédit Prestimo (organisme Alpha)', 'Assurance habitation', 'Assurance auto'], N = ['Naturalisation (Alice)', 'Naturalisation (Bob)'], F = ['Fermeture du compte Alpha (02/01)', 'Garde pendant la fermeture de la crèche du 15 au 19/02'];
        return {objet: L('Question', 'Sinistre inondations (appartement)', D), objetSans: L('Question', 'sinistre INONDATIONS', D), paren: L('Relancer l’assureur (Sinistre inondations)', '', D), court: L('Fin de l’offre de prêt Gamma (rachat Prestimo)', '', D), guill: L('Représenter le dossier « Assurance auto »', '', D), message: L('Info', '', D, 'Choix pour « Assurance habitation » : la formule de base (voir assurance auto)'),
          mots: L('Pièces pour le rachat du crédit Prestimo', '', D), inverse: L('Inondations appartement', '', D), seul: L('Assurance', '', D), communs: L('Dossier assurance : relance et rappel', '', D), voisin: L('Attestation d’assurance', '', D), bon: L('Renouvellement de l’assurance auto', '', D), heure: L('Rendez-vous (14h30)', '', D), rien: L('Rendez-vous notaire', '', D),
          natVague: L('Naturalisation', '', N), natQui: L('Test de langue pour la naturalisation de Bob', '', N), natNom: L('Représenter le dossier « Naturalisation (Alice) »', '', N), natPar: L('Rendez-vous en préfecture (naturalisation)', '', N),
          ferm: L('Fermeture de la crèche du 21 au 25/12', '', F), fermBon: L('Fermeture du compte Alpha : vider le compte avant', '', F), gardeAutre: L('Garde pendant la fermeture de la crèche du 12 au 16/04', '', F), gardeMeme: L('Qui garde ? Garde pendant la fermeture de la crèche (du 15 au 19/02)', '', F), vides: window.__sujets93.mots('Relance du dossier : rappel de la demande, 3e point'), sens: window.__sujets93.mots('Rachat du crédit Prestimo (organisme Alpha) du 12/03')}; });
      ok('0.93 : la règle : lien explicite d’abord (l’Objet du Canal, le nom entre parenthèses ou entre « », avec ou sans la parenthèse du dossier ; dans un message, seulement entre « »), puis un nom raccourci entre parenthèses, puis les mêmes mots significatifs',
        regle.objet === 'Sinistre inondations (appartement)' && regle.objetSans === 'Sinistre inondations (appartement)' && regle.paren === 'Sinistre inondations (appartement)' && regle.court === 'Rachat du crédit Prestimo (organisme Alpha)' && regle.guill === 'Assurance auto' && regle.message === 'Assurance habitation'
        && regle.mots === 'Rachat du crédit Prestimo (organisme Alpha)' && regle.bon === 'Assurance auto' && regle.natQui === 'Naturalisation (Bob)' && regle.natNom === 'Naturalisation (Alice)' && regle.fermBon === 'Fermeture du compte Alpha (02/01)' && regle.gardeMeme === 'Garde pendant la fermeture de la crèche du 15 au 19/02', JSON.stringify(regle));
      ok('0.93 : la règle, faux amis : dans le doute, rien n’est réuni (un mot commun à deux dossiers, « assurance » seul, un mot trop commun des suivis, un libellé plus court que le nom du dossier, deux dossiers au même nom à une parenthèse près, une fermeture qui n’est pas celle du dossier, la même garde à d’autres dates, une heure entre parenthèses)',
        regle.seul === null && regle.communs === null && regle.voisin === null && regle.inverse === null && regle.heure === null && regle.rien === null && regle.natVague === null && regle.natPar === null && regle.ferm === null && regle.gardeAutre === null && regle.vides.length === 0 && regle.sens.join() === 'rachat,credit,prestimo,organisme,alpha', JSON.stringify(regle));
      await q.context().close();
      /* Grok arrêté : la carte du sujet et ses lignes disent Hermes */
      const g = await pageWith({sujets: true, grokOff: true}, '#demandes'); await g.waitForTimeout(2500);
      const sg = await g.evaluate(() => { const c = document.querySelector('#view .pm-sujet[data-sujet^="Sinistre"]'); return c ? {who: c.querySelector('.pm-who').textContent, lies: [...c.querySelectorAll('.pm-lie small')].map((x) => x.textContent), n: document.querySelectorAll('#view .pm-sujet[data-sujet^="Sinistre"]').length} : null; });
      ok('0.93 : Pour moi, Grok arrêté : la carte du sujet et ses lignes disent Hermes (plus Iris)', !!sg && sg.n === 1 && /^Hermes · /.test(sg.who) && /^À faire · Hermes/.test(sg.lies[0]) && !sg.lies.some((x) => /Iris/.test(x)), JSON.stringify(sg));
      await g.context().close();
      /* la ligne de Travail du bloc 0.94.0 (réponses aux mails du mois) reste une ligne à part : le regroupement ne la range pas et ne la casse pas */
      const w = await pageWith({sujets: true, reponses: true}, '#demandes'); await w.waitForTimeout(2500);
      const lt = await w.evaluate(() => ({l: [...document.querySelectorAll('#view .pm-travail')].map((x) => ({t: x.firstElementChild.textContent, toi: x.classList.contains('toi'), dans: !!x.closest('.pm-sujet, .pm-card, .pm-lies'), parent: x.parentElement.className})), sin: document.querySelectorAll('#view .pm-sujet[data-sujet^="Sinistre"]').length, sujets: document.querySelectorAll('#view .pm-sujet').length}));
      ok('0.93 : Pour moi : avec les sujets regroupés, la ligne de Travail (0.94.0 : « CRA signé reçu : à rattacher · … ») reste une seule ligne à part, hors de toute carte de sujet',
        lt.l.length === 1 && lt.l[0].toi && lt.l[0].t === 'CRA signé reçu : à rattacher · Réponse à ton mail de prolongation : à lire' && !lt.l[0].dans && lt.sin === 1 && lt.sujets >= 5, JSON.stringify(lt));
      await w.context().close(); }
  } catch (e) { ok('exception', false, e.stack); }
  ok('aucune erreur de page', !errs.length, errs.join(' | '));
  console.log(out.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications). Captures : ' + SH);
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
});
