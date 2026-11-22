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
    ok('accueil : écran de JARVIS (heure, globe, 4 relevés reliés au globe, phrase du jour, « Parler à JARVIS »), puis en un coup d’œil (mails, bons prix), à faire, aujourd\'hui, 14 prochains jours, à surveiller', await p.evaluate(() => !!document.querySelector('.hud .holo-stage canvas') && document.querySelectorAll('.hud .hud-ro').length === 4 && document.querySelectorAll('.hud-lines path').length === 4 && /^\d\d:\d\d\d\d$/.test(document.getElementById('hud-clock').textContent) && /Rabie\./.test(document.querySelector('.hud-say').textContent) && /Parler à JARVIS/.test(document.querySelector('.hud-act').textContent) && ['En un coup d’œil', 'À faire maintenant', "Aujourd'hui", 'Les 14 prochains jours', 'À surveiller'].every((t) => [...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === t)) && document.querySelectorAll('.kpi-t').length === 2 && !document.querySelector('#view .intent') && !document.querySelector('.hm-hello')));
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
    await p.goto(base + '#suivi'); await p.waitForTimeout(2500);
    ok('#suivi (liens des notifications) : Équipe, filtre Demandes, avec les panneaux de Suivi', await p.evaluate(() => location.hash === '#equipe' && document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f === 'dem' && !!document.querySelector('.pend-x') && [...document.querySelectorAll('#view h2')].some((x) => /Tes ordres/.test(x.textContent))));
    await p.goto(base + '#automatisations'); await p.waitForTimeout(2500);
    ok('#automatisations : Équipe, filtre Routines (frises de suivi de livraison)', await p.evaluate(() => location.hash === '#equipe' && document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f === 'rout' && document.querySelectorAll('.auto.card').length > 0));
    await p.evaluate(() => document.querySelector('.ux-seg [data-f="cout"]').click()); await p.waitForTimeout(400);
    ok('Équipe, filtre Coût : coût de la semaine et file d’attente', await p.evaluate(() => [...document.querySelectorAll('#view h2')].some((x) => /Coût de la semaine/.test(x.textContent)) && ![...document.querySelectorAll('#view h2')].some((x) => /En cours chez tes bots/.test(x.textContent))));
    await p.goto(base + '#reglages'); await p.waitForTimeout(2500);
    ok('Réglages : l’état des systèmes (venu de Suivi) en bas', await p.evaluate(() => [...document.querySelectorAll('#view h2')].some((x) => /État des systèmes/.test(x.textContent))));
    await p.goto(base + '#demandes'); await p.waitForTimeout(2500);
    { const segs = await p.evaluate(() => [...document.querySelectorAll('.ux-seg button')].map((b) => b.dataset.f).join(','));
      await p.evaluate(() => document.querySelector('.ux-seg [data-f="decider"]').click()); await p.waitForTimeout(400);
      ok('Pour moi : filtres Tout, Décider, À faire, Infos ; « Décider » ne garde que « À décider »', segs === 'tout,decider,faire,infos' && await p.evaluate(() => !document.getElementById('pm-dec').hidden && [...document.querySelectorAll('.pm-sec')].filter((x) => !x.hidden).length === 1 && !document.querySelector('.pm-sum:not([hidden])')), segs);
      await p.tap('.tab[data-tab="accueil"]'); await p.waitForTimeout(400); await p.tap('.tab[data-tab="demandes"]'); await p.waitForTimeout(500);
      ok('Pour moi rouvert : de nouveau sur « Tout »', await p.evaluate(() => document.querySelector('.ux-seg [aria-pressed="true"]').dataset.f === 'tout' && [...document.querySelectorAll('.pm-sec')].every((x) => !x.hidden))); }
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
      ok('brouillon lié : il quitte « Brouillons prêts à partir » (lien par l\'objet du fil et le n° de ticket)', await p.evaluate(() => ![...document.querySelectorAll('article')].some((x) => /Brouillon Gmail/.test(x.textContent) && /4521/.test(x.textContent))));
      await open('Résiliation StreamPlus');
      const f = await p.evaluate(() => ({t: document.getElementById('sheet').textContent, hist: [...document.querySelectorAll('#sheet .hist-l li')].map((x) => x.textContent)}));
      const v0 = await vis();
      ok('brouillon lié : une seule carte, « Envoyer ce mail » en premier, le mail dedans et l\'historique (dossier, brouillon)', v0[0] === 'Envoyer ce mail' && /contact@streamplus\.example/.test(f.t) && /Historique \(\d+\)/.test(f.t) && f.hist.some((x) => /Brouillon prêt dans Gmail : « Re: Votre demande a bien été reçue \(#4521\) »/.test(x)) && f.hist.some((x) => /Dossier : Ticket #4521/.test(x)) && !/Pourquoi : Brouillon\./.test(f.t), JSON.stringify([v0, f.hist]));
      await p.evaluate(() => [...document.querySelectorAll('#sheet .sheet-actions .btn')].find((x) => /^Envoyer ce mail/.test(x.textContent)).click()); await p.waitForTimeout(500);
      await p.evaluate(() => [...document.querySelectorAll('#sheet .btn')].find((x) => /^Oui : envoyer ce mail/.test(x.textContent)).click()); await p.waitForTimeout(800);
      const t1 = await p.evaluate(() => document.getElementById('sheet').textContent + ' || ' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join(' || '));
      await p.waitForTimeout(6500);
      const g = await p.evaluate(() => ({canal: (window.__G.Canal || []).slice(-3).map((r) => r.join(' ¦ ')), dos: (window.__G.Dossiers || []).find((r) => r[0] === 'Résiliation StreamPlus'), drafts: window.__MAIL.drafts.map((d) => d.id)}));
      ok('brouillon envoyé : le mail part, le dossier passe en attente de la réponse, une ligne pour Iris avec sa sonnette', /Dans 5 s/.test(t1) && /sonnette/.test(t1) && !g.drafts.includes('DRAFT3') && g.dos && g.dos[4] === 'contact@streamplus.example' && /^Attendre la réponse au mail du/.test(g.dos[2]) && g.canal.some((x) => /Rabie ¦ Iris ¦ Réponse ¦ Brouillon envoyé par Rabie depuis JARVIS le .* « Re: Votre demande a bien été reçue \(#4521\) » à contact@streamplus\.example \(« Résiliation StreamPlus »\)/.test(x)), JSON.stringify([t1.slice(0, 160), g]));
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
      ok('« Plus tard » est gratuit (aucun bot réveillé) et dans les gestes principaux ; plus de « Mettre de côté » en double', lt === 'gratuit' && await p.evaluate(() => !!document.querySelector('#sheet .sheet-pick') && !/Mettre de côté/.test(document.getElementById('sheet').textContent)), lt);
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
    ok('doublon 14 : sous « Tous », le produit à décider n\'est pas répété, une ligne y renvoie', await p.evaluate(() => { const pn = (t) => [...document.querySelectorAll('#view .panel')].find((x) => x.querySelector('h2').textContent.trim() === t); const top = pn('À décider maintenant'), all = pn('Tous mes achats'); const nm = (c) => (c.querySelector('b') || {}).textContent; const hot = [...top.querySelectorAll('.fam')].map(nm); return hot.length > 0 && ![...all.querySelectorAll('.fam')].some((c) => hot.includes(nm(c))) && /produit à décider, affiché plus haut/.test(all.textContent); }));
    await p.evaluate(() => [...document.querySelectorAll('.seg button')].find((b) => b.textContent === 'À décider').click()); await p.waitForTimeout(400);
    ok('doublon 14 : le filtre « À décider » montre toujours le produit', await p.evaluate(() => [...document.querySelectorAll('#view .panel')].find((x) => /Tous mes achats/.test(x.querySelector('h2').textContent)).querySelectorAll('.fam').length > 0));
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
      p = await page(''); await p.evaluate(() => [...document.querySelectorAll('.hud-act button')].find((x) => /Parler à JARVIS/.test(x.textContent)).click()); await p.waitForTimeout(900);   /* refonte UX : « Parler à JARVIS » sur l'écran de JARVIS */
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
    { p = await page('#achats');
      const f = await p.evaluate(() => { const b = document.querySelector('.idee-box'); return b && {idee: !!b.querySelector('#ix-idee'), pour: !!b.querySelector('#ix-pour'), min: !!b.querySelector('#ix-min'), max: !!b.querySelector('#ix-max'), n: b.querySelectorAll('#ix-n option').length, after: !!(b.closest('.idee-wrap') && b.closest('.idee-wrap').previousElementSibling && b.closest('.idee-wrap').previousElementSibling.classList.contains('shop-hero'))}; });
      ok('idées : « Trouver une idée » en haut d\'Achats : idée, pour qui, budget min et max, 1 à 20 propositions', f && f.idee && f.pour && f.min && f.max && f.n === 20 && f.after, JSON.stringify(f));
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
      p = await page('#achats');
      await p.fill('#ix-idee', 'Trottinette'); await p.fill('#ix-pour', 'garçon de 6 ans'); await p.fill('#ix-max', '50'); await p.selectOption('#ix-n', '3'); await p.click('.idee-go'); await p.waitForTimeout(500);
      const w = await p.evaluate(() => ({t: document.querySelector('.view-title').textContent, wait: !!document.querySelector('.cmp-wait .cmp-spin')}));
      await p.waitForTimeout(2800);
      const d = await p.evaluate(() => [...document.querySelectorAll('.idee-card:not(.is-presque) .idee-prix b')].map((x) => parseFloat(x.textContent.replace(/\s/g, '').replace(',', '.'))));
      ok('idées : une nouvelle recherche ouvre sa page (attente, puis propositions dans le budget, au nombre demandé)', /Trottinette/.test(w.t) && w.wait && d.length === 3 && d.every((v) => v <= 50), JSON.stringify(w) + ' ' + d.join(' '));
      await p.screenshot({path: path.join(SH, 'idees.png')});
      /* 0.29.0 : rien dans le budget, mais du « presque » : la recherche n'est plus « vide » ; la piste se relance et trouve */
      p = await page('#achats');
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
        && /2 échéances sous 7 jours/.test(r0.chips) && r0.segs.length === 5 && /^Fixes \(16\)$/.test(r0.segs[0]) && /^À venir \(6\)$/.test(r0.segs[1]) && r0.fixes === 1 && /^Navigo de .+ : reste en Liberté\+$/.test(r0.nav) && r0.large, JSON.stringify(r0));
      const avenir = () => p.evaluate(() => [...document.querySelectorAll('.rad-seg button')].find((x) => /^À venir/.test(x.textContent)).click()).then(() => p.waitForTimeout(400));
      await avenir();
      ok('Radar : à venir dans l\'ordre des dates ; le plus proche signalé, avec la hausse par rapport à l\'an dernier', await p.evaluate(() => { const c = [...document.querySelectorAll('.rad-due')], j = c.map((x) => +((x.querySelector('.ech-date span').textContent.match(/\d+/) || [0])[0]));
        return c.length === 6 && c[0].classList.contains('is-soon') && /dans 3 j/.test(c[0].textContent) && /\+33 % \(avant : 59,99 €\)/.test(c[0].textContent) && j.every((v, i) => !i || v >= j[i - 1]) && /montant à venir/.test(c[5].textContent); }));
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
  } catch (e) { ok('exception', false, e.stack); }
  ok('aucune erreur de page', !errs.length, errs.join(' | '));
  console.log(out.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + out.length + ' vérifications). Captures : ' + SH);
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
});
