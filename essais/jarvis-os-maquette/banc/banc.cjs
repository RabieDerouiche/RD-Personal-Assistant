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
    /* accueil et thème */
    let p = await page('');
    ok('mode maquette sur un serveur local', await p.evaluate(() => window.__JARVIS_MODE === 'maquette'));
    ok('thème Hologramme par défaut', await p.evaluate(() => document.documentElement.classList.contains('theme-holo')));
    ok('accueil en tableau de bord : « Demander » en haut, 3 chiffres (pour toi, mails, bons prix), à faire, aujourd\'hui, 14 prochains jours, à surveiller (plus de « Bientôt »)', await p.evaluate(() => ['En un coup d’œil', 'À faire maintenant', "Aujourd'hui", 'Les 14 prochains jours', 'À surveiller'].every((t) => [...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === t)) && ![...document.querySelectorAll('.hm-h h2')].some((x) => x.textContent === 'Bientôt') && document.querySelectorAll('.kpi-t').length === 3 && !!document.querySelector('#view .intent') && document.querySelector('#view .intent').getBoundingClientRect().top < document.querySelector('.kpi-grid').getBoundingClientRect().top));
    ok('accueil : le résumé du jour donne la météo, et chaque chiffre ouvre sa rubrique', await p.evaluate(() => /(\d+° · \S+ · \d+ à \d+°|Demain : [^,]+, \d+ à \d+°)/.test((document.querySelector('.hm-hello small') || {}).textContent || '')));
    { await p.evaluate(() => [...document.querySelectorAll('.kpi-t')].find((x) => /bons? prix/.test(x.textContent)).click()); await p.waitForTimeout(500); const tab = await p.evaluate(() => location.hash); await p.goto(base + '#accueil'); await p.waitForTimeout(1500); ok('accueil : la tuile « bon prix » ouvre Achats', tab === '#achats', tab); }
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
    ok('CRA (oui attendu, texte vide dans À toi) : la demande lue dans le Canal, « Oui depuis JARVIS » (Charte, section 7), sa semaine', await p.evaluate(() => { const c = [...document.querySelectorAll('.pm-card')].find((x) => x.querySelector('.pm-title').textContent === 'CRA Allegis'); return !!c && /Soumettre le CRA Allegis/.test(c.textContent) && !!c.querySelector('.week') && [...c.querySelectorAll('.pm-row .btn')].some((b) => /^Oui depuis JARVIS/.test(b.textContent)); }));
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
    ok('équipe : passages des 24 heures avec « dans … »', await p.evaluate(() => { const r = [...document.querySelectorAll('.lf-r.is-soon')]; return r.length >= 1 && r.every((x) => /dans |maintenant/.test(x.textContent)); }));
    /* équipe harmonisée (16/11/2026) */
    ok('équipe : une seule grille de 6 cartes identiques, plus de liste des bots en double', await p.evaluate(() => { const m = [...document.querySelectorAll('.team .mate')]; return m.length === 6 && m.every((x) => x.querySelector('.mate-log span') && /^Prochain · /.test(x.querySelector('.mate-next small').textContent)) && !document.querySelector('.units'); }));
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
    ok('check-up : page vocale dans les polices de la charte (plus d\'Inter)', await p.evaluate(() => [...document.querySelectorAll('.jv, .jv *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).every((e) => /^("?Exo 2|"?Oxanium|Orbitron)/.test(getComputedStyle(e).fontFamily))));
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
    p = await page('#suivi');
    ok('doublon 16 : Suivi garde une ligne vers Papiers ; Équipe sans dépôt ; Papiers avec le dépôt', await p.evaluate(() => /papiers? suivis?/.test((document.querySelector('.pap-go') || {}).textContent || '') && ![...document.querySelectorAll('#view .pap-search, #view input[type="search"]')].some((x) => !x.closest('.hist-panel'))) && await (async () => { const q = await page('#equipe'); const e = await q.evaluate(() => ![...document.querySelectorAll('#view .panel h2')].some((x) => /Déposer un document/.test(x.textContent))); const r = await page('#papiers'); return e && await r.evaluate(() => [...document.querySelectorAll('#view .panel h2')].some((x) => /Déposer un document/.test(x.textContent))); })());
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
      await p.evaluate(() => [...document.querySelectorAll('.panel')].find((x) => /Tes ordres/.test(x.textContent)).querySelector('.canal-row').click()); await p.waitForTimeout(700);
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
      p = await page(''); await p.fill('.intent-input', 'Bonjour'); await p.press('.intent-input', 'Enter'); await p.waitForTimeout(900);
      const opened = await p.evaluate(() => !document.getElementById('chat').hidden);
      await drag(p, 215, 40, 0, 260, 350);
      ok('glisser : la discussion se ferme d\'un glissé vers le bas', opened && await p.evaluate(() => document.getElementById('chat').hidden));
      await p.tap('.talk-slot .jv-btn'); await p.waitForTimeout(900);
      const vOpen = await p.evaluate(() => { const j = document.querySelector('.jv'); return !!j && !j.hidden && getComputedStyle(j).display !== 'none'; });
      await drag(p, 215, 60, 0, 300, 350);
      ok('glisser : la page vocale se ferme d\'un glissé vers le bas', vOpen && await p.evaluate(() => { const j = document.querySelector('.jv'); return !j || j.hidden || getComputedStyle(j).display === 'none'; })); }
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
      const nums = await p.evaluate(() => { const k = [...document.querySelectorAll('.kpi-t')].find((x) => /pour toi/.test(x.textContent)); return [(document.querySelector('#status .st.is-demande') || {}).textContent, (document.querySelector('.tab[data-tab="demandes"] .badge') || {}).textContent, k ? k.querySelector('.kpi-n').textContent : '', document.getElementById('view').innerText]; });
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
      ok('Équipe : plus de doublon « Échanges récents », des chiffres d\'équipe (ordres en cours, réponses)', !/Échanges récents/.test(eq[0]) && /Tes ordres/.test(eq[0]) && /en cours/.test(eq[1]) && /répons/.test(eq[1]) && !/prix suivis|papiers/.test(eq[1]), eq.join(' :: ').replace(/\s+/g, ' ').slice(0, 160));
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
    /* 0.24.0 : trois thèmes (le classique est retiré) ; le bouton marche depuis n'importe quelle rubrique (avant : seulement depuis l'accueil) */
    { p = await page('?theme=actuel#achats');
      ok('thèmes : un ancien choix « actuel » (thème classique retiré) retombe sur Hologramme', await p.evaluate(() => document.documentElement.getAttribute('data-th') === 'holo' && document.documentElement.classList.contains('theme-holo')));
      await p.goto(base + '#achats'); await p.waitForTimeout(1500);
      await p.click('.fav-handle'); await p.waitForTimeout(600);
      const picks = await p.evaluate(() => [...document.querySelectorAll('.th-pick')].map((x) => x.textContent));
      ok('thèmes : trois choix avec leur aperçu (Hologramme, Ambre, Néon)', picks.join(',') === 'Hologramme,Ambre,Néon' && await p.evaluate(() => document.querySelectorAll('.th-pick .th-sw').length === 3), picks.join(','));
      await Promise.all([p.waitForNavigation({timeout: 8000}).catch(() => null), p.click('.th-pick:has-text("Ambre")')]); await p.waitForTimeout(1500);
      const am = await p.evaluate(() => ({th: document.documentElement.getAttribute('data-th'), cls: document.documentElement.className, hash: location.hash, c1: getComputedStyle(document.documentElement).getPropertyValue('--c1').trim(), warn: getComputedStyle(document.documentElement).getPropertyValue('--warn').trim(), meta: document.querySelector('meta[name="theme-color"]').content}));
      ok('thèmes : « Ambre » choisi depuis Achats s\'applique (rechargement, on reste dans Achats), palette ambrée, l\'urgent passe en cyan', am.th === 'ambre' && /theme-holo/.test(am.cls) && /theme-ambre/.test(am.cls) && am.hash === '#achats' && am.c1 === '251, 176, 36' && am.warn === '56, 189, 248' && am.meta === '#0a0602', JSON.stringify(am));
      await p.click('.fav-handle'); await p.waitForTimeout(600);
      await Promise.all([p.waitForNavigation({timeout: 8000}).catch(() => null), p.click('.th-pick:has-text("Néon")')]); await p.waitForTimeout(1500);
      const ne = await p.evaluate(() => ({th: document.documentElement.getAttribute('data-th'), c1: getComputedStyle(document.documentElement).getPropertyValue('--c1').trim(), muted: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()}));
      ok('thèmes : « Néon » (rose et cyan), ses couleurs l\'emportent sur les retouches d\'Hologramme', ne.th === 'neon' && ne.c1 === '236, 72, 153' && ne.muted === '#c9a3e6', JSON.stringify(ne));
      await p.screenshot({path: path.join(SH, 'theme-neon.png')});
      await p.evaluate(() => { try { localStorage.setItem('jarvis.theme', 'holo'); } catch (e) { /* rien */ } });
    }
    /* 0.24.0 : chercher un produit à partir d'une idée (ici, la recherche d'exemple et une recherche simulée) */
    { p = await page('#achats');
      const f = await p.evaluate(() => { const b = document.querySelector('.idee-box'); return b && {idee: !!b.querySelector('#ix-idee'), pour: !!b.querySelector('#ix-pour'), min: !!b.querySelector('#ix-min'), max: !!b.querySelector('#ix-max'), n: b.querySelectorAll('#ix-n option').length, after: !!(b.closest('.idee-wrap') && b.closest('.idee-wrap').previousElementSibling && b.closest('.idee-wrap').previousElementSibling.classList.contains('shop-hero'))}; });
      ok('idées : « Trouver une idée » en haut d\'Achats : idée, pour qui, budget min et max, 1 à 20 propositions', f && f.idee && f.pour && f.min && f.max && f.n === 20 && f.after, JSON.stringify(f));
      ok('idées : mes recherches (photo, pour qui, budget, nombre)', await p.evaluate(() => { const it = document.querySelector('.idee-it'); return !!it && /fille de 3 ans · 30 à 60 € · 6 propositions/.test(it.textContent) && !!it.querySelector('.idee-th.has-pic img'); }));
      await p.click('.idee-it'); await p.waitForTimeout(800);
      const pg = await p.evaluate(() => ({t: document.querySelector('.view-title').textContent, cards: document.querySelectorAll('.idee-card').length, first: (document.querySelector('.idee-rank') || {}).textContent, why: !!document.querySelector('.cmp-key'), warn: [...document.querySelectorAll('.idee-warn')].map((x) => x.textContent).join('|'), note: [...document.querySelectorAll('.idee-note')].map((x) => x.textContent).join('|'), bars: document.querySelectorAll('.idee-bar').length, links: document.querySelectorAll('.idee-card a.btn[target="_blank"]').length}));
      ok('idées : la page des propositions (meilleur choix en tête, conseil, photo, prix TTC avec vendeur et date, pourquoi, forces et limites, deux notes, lien vers le vendeur)', /Maison de poupée/.test(pg.t) && pg.cards === 6 && pg.first === 'Meilleur choix' && pg.why && pg.bars === 12 && pg.links === 6, JSON.stringify(pg));
      ok('idées : un prix différent sur la page du vendeur est signalé ; une page illisible aussi ; les hors budget sont comptés', /64,90/.test(pg.warn) && /non revérifié/.test(pg.note) && /hors de ton budget/.test(pg.note), pg.warn + ' / ' + pg.note);
      await p.click('.idee-tri button:has-text("Prix")'); await p.waitForTimeout(300);
      const px = await p.evaluate(() => [...document.querySelectorAll('.idee-prix b')].map((x) => parseFloat(x.textContent.replace(/\s/g, '').replace(',', '.'))));
      ok('idées : tri par prix', px.length === 6 && px.every((v, i) => !i || v >= px[i - 1]), px.join(' '));
      await p.click('.idee-card .btn:has-text("Suivre le prix")'); await p.waitForTimeout(700);
      const sv = await p.evaluate(() => [...document.querySelectorAll('.pick-form input')].map((x) => x.value));
      ok('idées : « Suivre le prix » ouvre la fiche pour Kairos préremplie (produit, lien, prix max = budget)', /Cottage en tissu Doudou/.test(sv[0]) && /^https:/.test(sv[1]) && sv[2] === '60', sv.join(' | '));
      p = await page('#achats');
      await p.fill('#ix-idee', 'Trottinette'); await p.fill('#ix-pour', 'garçon de 6 ans'); await p.fill('#ix-max', '50'); await p.selectOption('#ix-n', '3'); await p.click('.idee-go'); await p.waitForTimeout(500);
      const w = await p.evaluate(() => ({t: document.querySelector('.view-title').textContent, wait: !!document.querySelector('.cmp-wait .cmp-spin')}));
      await p.waitForTimeout(2800);
      const d = await p.evaluate(() => [...document.querySelectorAll('.idee-prix b')].map((x) => parseFloat(x.textContent.replace(/\s/g, '').replace(',', '.'))));
      ok('idées : une nouvelle recherche ouvre sa page (attente, puis propositions dans le budget, au nombre demandé)', /Trottinette/.test(w.t) && w.wait && d.length === 3 && d.every((v) => v <= 50), JSON.stringify(w) + ' ' + d.join(' '));
      await p.screenshot({path: path.join(SH, 'idees.png')});
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
