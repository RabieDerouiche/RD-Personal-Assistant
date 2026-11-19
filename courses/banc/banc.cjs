/* Banc de Panier : deux iPhone simulés (Alex et Sam) sur le vrai serveur, fausses sources de photos et de prix.
   NODE_PATH=/opt/node-tools/node_modules node courses/banc/banc.cjs     (captures dans le dossier temporaire panier-banc) */
const {chromium} = require('playwright'); const {spawn} = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const RACINE = path.join(__dirname, '..'), OUT = path.join(os.tmpdir(), 'panier-banc'); fs.mkdirSync(OUT, {recursive: true});
const results = []; let fails = 0;
const ok = (nom, cond, info) => { results.push((cond ? 'OK    ' : 'ÉCHEC ') + nom + (cond || info == null ? '' : ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)))); if (!cond) fails++; };
const IPHONE = {viewport: {width: 393, height: 852}, deviceScaleFactor: +(process.env.DSF || 2), isMobile: true, hasTouch: true, locale: 'fr-FR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'};

(async () => {
  /* fausses sources : un produit « Kombucha » chez Open Food Facts (photo, prix), des photos au choix */
  const img = (n) => fs.readFileSync(path.join(RACINE, 'web', 'img', n + '.webp'));
  const SRC = http.createServer((q, r) => { const u = new URL(q.url, 'http://x'), B = 'http://127.0.0.1:' + SRC.address().port, j = (o) => { r.writeHead(200, {'content-type': 'application/json'}); r.end(JSON.stringify(o)); };
    if (u.pathname.startsWith('/img/')) { r.writeHead(200, {'content-type': 'image/webp'}); r.end(img(u.pathname.slice(5).replace('.webp', ''))); return; }
    if (u.pathname === '/off') return j(/kombucha/i.test(u.searchParams.get('q') || '') ? {hits: [{code: '3760000000017', product_name_fr: 'Kombucha gingembre', brands: ['Karma'], quantity: '75 cl', image_front_url: B + '/img/oranges.webp', unique_scans_n: 120, countries_tags: ['en:france'], categories_tags: ['en:beverages', 'en:kombuchas']}]} : {hits: []});
    if (u.pathname === '/prix') return j({items: u.searchParams.get('product_code') === '3760000000017' ? [{price: 3.4, currency: 'EUR'}, {price: 3.6, currency: 'EUR'}, {price: 3.5, currency: 'EUR'}] : []});
    if (u.pathname === '/wiki') return j({query: {pages: /tomate/i.test(u.searchParams.get('gsrsearch') || '') ? {1: {index: 1, title: 'Tomate', pageimage: 'T.jpg', thumbnail: {source: B + '/img/tomates-cerises.webp'}}} : {}}});
    if (u.pathname === '/commons') return j({query: {pages: {9: {index: 1, title: 'File:Autre.jpg', imageinfo: [{thumburl: B + '/img/citrons.webp', width: 1200, height: 900, mime: 'image/jpeg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Autre.jpg', extmetadata: {Artist: {value: 'Jeanne'}, LicenseShortName: {value: 'CC BY-SA 4.0'}}}]}}}});
    r.writeHead(404); r.end(); });
  await new Promise((z) => SRC.listen(0, '127.0.0.1', z)); const SB = 'http://127.0.0.1:' + SRC.address().port;
  const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'panier-banc-data-')), PORT = 18600 + Math.floor(Math.random() * 300), URL0 = 'http://127.0.0.1:' + PORT + '/courses/';
  const srv = spawn(process.execPath, [path.join(RACINE, 'server', 'courses.mjs')], {env: {...process.env, PANIER_DATA: DATA, PORT: String(PORT), PANIER_OFF_SEARCH: SB + '/off', PANIER_OFF_PRIX: SB + '/prix', PANIER_WIKI: SB + '/wiki', PANIER_COMMONS: SB + '/commons', PANIER_IMG_HOTES: '127.0.0.1:' + SRC.address().port, PANIER_IMG_HTTP: '1'}, stdio: ['ignore', 'ignore', 'inherit']});
  for (let i = 0; i < 60; i++) { try { if ((await fetch(URL0 + 'api/sante')).ok) break; } catch (e) { /* pas encore */ } await new Promise((r) => setTimeout(r, 100)); }
  const b = await chromium.launch(); const erreurs = [];
  const telephone = async (nom, opts = {}) => { const ctx = await b.newContext({...IPHONE, ...opts}); const p = await ctx.newPage();
    p.on('pageerror', (e) => erreurs.push(nom + ' : ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/401|net::ERR|Failed to load resource/.test(m.text())) erreurs.push(nom + ' : ' + m.text()); }); return {ctx, p}; };
  const photo = (p, n) => p.screenshot({path: path.join(OUT, n + '.png')});
  const large = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const etat = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__panier.etat)));
  const lignes = (p) => p.evaluate(() => [...document.querySelectorAll('#app .ligne')].map((l) => ({nom: l.querySelector('.nom').textContent, qte: l.querySelector('.qte').textContent, det: (l.querySelector('.det') || {}).textContent || '', pris: l.classList.contains('pris'), img: !!(l.querySelector('img') && l.querySelector('img').naturalWidth)})));
  const total = (p) => p.evaluate(() => document.querySelector('.bilan .total').textContent.replace(/\s/g, ' ').trim());
  const ajoute = async (p, q) => { if (!(await p.$('#q'))) await p.click('[data-act="ajouter"]'); await p.fill('#q', q); await p.waitForTimeout(150); await p.locator('#res [data-act="tuile"], #res [data-act="creer"]').first().click(); await p.waitForTimeout(120); };
  const fermeR = async (p) => { if (await p.$('#recherche')) await p.click('[data-act="fermeRecherche"]'); await p.waitForTimeout(150); };

  /* ---------- 1. premier téléphone : créer le foyer ---------- */
  const alex = await telephone('Alex'), A = alex.p;
  await A.goto(URL0); await A.waitForSelector('#go'); await A.waitForTimeout(500);
  ok('accueil : « Créer notre liste », six photos, pas de débordement', (await A.textContent('#go')) === 'Créer notre liste' && (await A.$$eval('.accueil .mosaique img', (x) => x.filter((i) => i.naturalWidth > 0).length)) === 6 && await large(A));
  await photo(A, '01-accueil');
  await A.click('#go'); ok('prénom vide : message, rien n\'est créé', /prénom/.test(await A.textContent('#err')));
  await A.fill('#prenom', 'Alex'); await A.click('#go'); await A.waitForSelector('.barrebas'); await A.waitForTimeout(300);
  ok('liste vide : invitation à ajouter, total à 0', /Rien à acheter/.test(await A.textContent('#app')) && /0,00 €/.test(await total(A)) && await large(A));

  /* ---------- 2. ajouter : souvent achetés, rayons, recherche ---------- */
  await A.click('[data-act="ajouter"]'); await A.waitForSelector('#q'); await A.waitForTimeout(900);
  const acc = await A.evaluate(() => ({tuiles: document.querySelectorAll('#res .grille .tuile').length, photos: [...document.querySelectorAll('#res .grille img')].filter((i) => i.naturalWidth > 0).length, rayons: document.querySelectorAll('#res .rayon').length, focus: document.activeElement.id}));
  ok('ajouter : « Souvent achetés » en photos, 17 rayons, clavier prêt', acc.tuiles === 12 && acc.photos >= 10 && acc.rayons === 17 && acc.focus === 'q' && await large(A), acc);
  await photo(A, '02-ajouter');
  await A.fill('#q', 'tomatte'); await A.waitForTimeout(200);
  ok('faute de frappe (« tomatte ») : Tomates trouvées quand même', /^Tomates/.test(await A.locator('#res .tuile b').first().textContent()), await A.locator('#res .tuile b').allTextContents());
  await A.locator('#res [data-act="tuile"]').first().click(); await A.waitForTimeout(200);
  ok('un appui ajoute, vide la recherche et garde le clavier', (await A.inputValue('#q')) === '' && (await etat(A)).lignes.length === 1 && await A.evaluate(() => document.activeElement.id === 'q'));
  await ajoute(A, '2 kg pommes de terre'); await ajoute(A, 'lait lactel'); await ajoute(A, 'oeufs'); await ajoute(A, '500g viande hachee'); await ajoute(A, 'baguette x3');
  { const e = await etat(A), l = (id) => e.lignes.find((x) => x.a === id) || {};
    ok('quantité écrite avec le nom : « 2 kg pommes de terre », « 500g viande hachee », « baguette x3 »', l('pommes-de-terre').q === 2 && l('pommes-de-terre').u === 'kg' && l('viande-hachee').q === 500 && l('viande-hachee').u === 'g' && l('baguette').q === 3, e.lignes.map((x) => [x.a, x.q, x.u]));
    ok('marque écrite avec le nom : « lait lactel » ajoute le lait, marque Lactel', l('lait').m === 'Lactel' && l('lait').q === 6 && l('lait').u === 'L', l('lait')); }
  await A.fill('#q', 'pom'); await A.waitForTimeout(250);
  ok('article déjà dans la liste : la tuile montre sa quantité et ses boutons − +', (await A.locator('.tuile.dedans .compte span').first().textContent()) === '2 kg');
  await A.locator('.tuile.dedans [data-act="tuilePlus"]').first().click(); await A.waitForTimeout(150);
  ok('+ sur la tuile : 2,5 kg', (await A.locator('.tuile.dedans .compte span').first().textContent()) === '2,5 kg');
  await photo(A, '03-recherche');
  await A.click('[data-act="efface"]'); await A.locator('.rayon', {hasText: 'Fromages'}).click(); await A.waitForTimeout(300);
  ok('un rayon : tous ses articles, en ordre alphabétique', (await A.locator('#res .tuile b').first().textContent()) === 'Babybel' && (await A.locator('#res .tuile').count()) >= 14);
  await A.locator('#res .tuile', {hasText: 'Comté'}).locator('[data-act="tuile"]').click(); await fermeR(A);

  /* ---------- 3. la liste : rayons, total, fiche ---------- */
  { const l = await lignes(A), t = await total(A), g = await A.$$eval('#app .groupe h2', (x) => x.map((h) => h.childNodes[1].textContent.trim()));
    /* tomates 1 kg × 3 + pommes de terre 2,5 × 1,6 + lait 6 × 1,1 + œufs 3,2 + viande 0,5 × 13 + baguettes 3 × 1,1 + comté 5 = 31,60 */
    ok('liste rangée par rayon dans l\'ordre du magasin, total estimé juste (31,60 €)', l.length === 7 && g.join() === 'Légumes,Boucherie et volaille,Crèmerie et œufs,Fromages,Boulangerie' && /31,60 €/.test(t) && await large(A), {g, t});
    ok('chaque ligne a sa photo, sa quantité et la marque choisie', l.filter((x) => x.img).length >= 5 && l.find((x) => x.nom === 'Lait').det === 'Lactel' && l.find((x) => x.nom === 'Baguette').qte === '× 3', l); }
  await photo(A, '04-liste');
  await A.locator('.ligne', {hasText: 'Pommes de terre'}).locator('[data-act="fiche"]').click(); await A.waitForSelector('.feuille .pas'); await A.waitForTimeout(250);
  await photo(A, '05-fiche');
  await A.click('[data-act="qPlus"]'); await A.click('[data-act="unite"][data-u="g"]'); await A.waitForTimeout(150);
  ok('fiche : + puis « en g » convertit la quantité (3 kg → 3000 g)', (await A.textContent('.feuille .pas .val')).replace(/\s/g, '') === '3000g', await A.textContent('.feuille .pas .val'));
  await A.click('[data-act="unite"][data-u="kg"]'); await A.fill('[data-ch="note"]', 'à chair ferme'); await A.press('[data-ch="note"]', 'Enter'); await A.click('[data-act="mag"][data-m="Grand Frais"]');
  await A.fill('[data-ch="prix"]', '1,2'); await A.press('[data-ch="prix"]', 'Enter'); await A.waitForTimeout(250);
  ok('fiche : précision, magasin, prix corrigé (1,20 € le kg) → coût de la ligne 3,60 €', /3,60 €/.test(await A.textContent('.feuille .cout')) && /Ton prix/.test(await A.textContent('.feuille .prixl')) && await large(A), await A.textContent('.feuille .cout'));
  await A.click('.feuille .btn[data-act="ferme"]'); await A.waitForTimeout(200);
  await A.locator('.ligne', {hasText: 'Lait'}).locator('[data-act="fiche"]').click(); await A.waitForSelector('.feuille .pas');
  ok('fiche du lait : marques proposées (Lactel choisie, Candia), unités L et cl', (await A.locator('.feuille [data-act="marque"].on').textContent()) === 'Lactel' && (await A.locator('.feuille [data-act="marque"]', {hasText: 'Candia'}).count()) === 1 && (await A.locator('.feuille [data-act="unite"]').count()) === 2);
  await A.fill('[data-ch="marque"]', 'Lait du Forez'); await A.press('[data-ch="marque"]', 'Enter'); await A.waitForTimeout(250);
  ok('autre marque saisie à la main : gardée et proposée', (await A.locator('.feuille [data-act="marque"].on').textContent()) === 'Lait du Forez');
  await A.click('.feuille .btn[data-act="ferme"]'); await A.waitForTimeout(150);

  /* ---------- 4. second téléphone : invitation, direct ---------- */
  await A.click('.rond[data-act="menu"]'); await A.waitForSelector('[data-act="inviter"]'); await photo(A, '06-menu'); await A.click('[data-act="inviter"]'); await A.waitForSelector('.codebox');
  const code = (await A.textContent('.codebox')).trim(), lien = await A.getAttribute('[data-act="partage"]', 'data-lien');
  ok('inviter : code à 6 chiffres et lien à envoyer', /^\d{6}$/.test(code) && lien === URL0 + '#inviter=' + code, lien);
  await photo(A, '07-inviter'); await A.evaluate(() => document.querySelectorAll('.voile').forEach((v) => v.click())); await A.waitForTimeout(200);
  const sam = await telephone('Sam'), S = sam.p;
  await S.goto(URL0); await S.waitForSelector('#go');
  ok('second téléphone sans lien : on lui demande un code', (await S.textContent('#go')) === 'Rejoindre la liste' && !!(await S.$('#code')));
  await S.goto(lien); await S.reload(); await S.waitForSelector('#code');
  ok('avec le lien : le code est déjà rempli', (await S.inputValue('#code')) === code);
  await S.fill('#prenom', 'Sam'); await S.click('#go'); await S.waitForSelector('.barrebas'); await S.waitForTimeout(500);
  ok('Sam voit la liste d\'Alex (7 articles, mêmes quantités)', (await lignes(S)).length === 7 && (await lignes(S)).find((x) => x.nom === 'Pommes de terre').qte === '3 kg' && !/inviter=/.test(S.url()), await lignes(S));
  await A.waitForFunction(() => /partagée avec Sam/.test(document.querySelector('#sync').textContent), null, {timeout: 5000}).catch(() => {});
  ok('chez Alex, sans rien toucher : « partagée avec Sam »', /partagée avec Sam/.test(await A.textContent('#sync')), await A.textContent('#sync'));
  await ajoute(S, 'bananes'); await fermeR(S);
  const vu = await A.waitForFunction(() => [...document.querySelectorAll('#app .ligne .nom')].some((n) => n.textContent === 'Bananes'), null, {timeout: 5000}).then(() => true).catch(() => false);
  ok('Sam ajoute des bananes : elles apparaissent chez Alex en direct, avec un message', vu && /Sam a ajouté Bananes/.test(await A.textContent('.toasts').catch(() => '')), await A.textContent('.toasts').catch(() => ''));
  await photo(A, '08-direct');
  await A.locator('.ligne', {hasText: 'Tomates'}).locator('[data-act="coche"]').click();
  const pris = await S.waitForFunction(() => [...document.querySelectorAll('#app .ligne.pris .nom')].some((n) => n.textContent === 'Tomates'), null, {timeout: 5000}).then(() => true).catch(() => false);
  ok('Alex prend les tomates : cochées chez Sam, le total « reste à prendre » baisse', pris && /sur 8 dans le panier/.test(await S.textContent('.bilan')) && /reste à prendre/.test(await S.textContent('.bilan')), await S.textContent('.bilan'));
  await S.click('[data-act="groupe"][data-g="magasin"]'); await S.waitForTimeout(200);
  { const g = await S.$$eval('#app .groupe h2', (x) => x.map((h) => h.childNodes[1].textContent.trim())); ok('« Par magasin » : Grand Frais, puis le reste', g.join() === 'Grand Frais,Peu importe où', g); }
  await photo(S, '09-par-magasin'); await S.click('[data-act="groupe"][data-g="rayon"]');

  /* ---------- 5. hors connexion (au fond du magasin) ---------- */
  await S.waitForTimeout(1200);   /* le service garde l'app */
  await sam.ctx.setOffline(true); await S.evaluate(() => dispatchEvent(new Event('offline')));
  await ajoute(S, 'citrons'); await fermeR(S); await S.locator('.ligne', {hasText: 'Bananes'}).locator('[data-act="coche"]').click(); await S.waitForTimeout(6500);
  ok('sans réseau : l\'ajout et la coche se font quand même, « à envoyer » affiché', (await lignes(S)).some((x) => x.nom === 'Citrons') && /Hors connexion · 2 changements à envoyer/.test(await S.textContent('#sync')), await S.textContent('#sync'));
  await photo(S, '10-hors-connexion');
  await S.reload().catch(() => {}); await S.waitForSelector('#app .ligne', {timeout: 5000}).catch(() => {});
  ok('sans réseau, app fermée puis rouverte : la liste est là, les changements en attente aussi', (await lignes(S)).some((x) => x.nom === 'Citrons') && (await S.evaluate(() => window.__panier.file.length)) === 2, await S.textContent('body').then((t) => t.slice(0, 120)));
  await sam.ctx.setOffline(false); await S.evaluate(() => dispatchEvent(new Event('online')));
  const sync = await A.waitForFunction(() => [...document.querySelectorAll('#app .ligne .nom')].some((n) => n.textContent === 'Citrons') && [...document.querySelectorAll('#app .ligne.pris .nom')].some((n) => n.textContent === 'Bananes'), null, {timeout: 9000}).then(() => true).catch(() => false);
  ok('réseau revenu : tout part seul, Alex reçoit les citrons et la coche', sync && (await S.evaluate(() => window.__panier.file.length)) === 0, await S.textContent('#sync'));

  /* ---------- 6. article inconnu : photo, prix et rayon trouvés seuls ---------- */
  await A.click('[data-act="ajouter"]'); await A.fill('#q', 'kombucha gingembre'); await A.waitForTimeout(250);
  ok('article absent du catalogue : « Ajouter « kombucha gingembre » » proposé', /Ajouter « kombucha gingembre »/.test(await A.textContent('#res .creer')));
  await photo(A, '11-article-inconnu');
  await A.click('[data-act="creer"]'); await fermeR(A);
  const appris = await S.waitForFunction(() => { const l = [...document.querySelectorAll('#app .ligne')].find((x) => x.querySelector('.nom').textContent === 'Kombucha gingembre'); return l && l.querySelector('img') && l.querySelector('img').naturalWidth > 0 && /api\/img\//.test(l.querySelector('img').src); }, null, {timeout: 8000}).then(() => true).catch(() => false);
  { const e = await etat(S), a = e.articles['x-kombucha-gingembre'] || {};
    ok('quelques secondes plus tard, chez les deux : photo du produit, prix relevé (3,50 €), rangé dans Boissons', appris && a.p === 3.5 && a.r === 'boissons' && a.src.t === 'off', a); }
  await A.waitForTimeout(400); await photo(A, '12-article-appris');
  await A.click('[data-act="ajouter"]'); await A.fill('#q', 'kombu'); await A.waitForTimeout(250);
  ok('l\'article appris est maintenant dans le catalogue du foyer (recherche « kombu »)', (await A.locator('#res .tuile b').first().textContent()) === 'Kombucha gingembre'); await fermeR(A);

  /* ---------- 7. changer une photo ---------- */
  await A.locator('.ligne', {hasText: 'Comté'}).locator('[data-act="fiche"]').click(); await A.waitForSelector('.feuille .fiche'); await A.click('.feuille [data-act="photo"]');
  await A.waitForSelector('.choixphoto button', {timeout: 6000}).catch(() => {}); await A.waitForTimeout(400);
  ok('« Changer la photo » : des photos au choix, l\'appareil photo et la photothèque', (await A.locator('.choixphoto button').count()) >= 1 && (await A.locator('input[type=file]').count()) === 2);
  await photo(A, '13-changer-photo');
  await A.locator('.choixphoto button').first().click();
  const change = await A.waitForFunction(() => { const i = document.querySelector('.feuille .fiche .photo img'); return i && /api\/img\//.test(i.src) && i.naturalWidth > 0; }, null, {timeout: 8000}).then(() => true).catch(() => false);
  ok('photo choisie : enregistrée, affichée chez les deux', change && await S.waitForFunction(() => { const l = [...document.querySelectorAll('#app .ligne')].find((x) => x.querySelector('.nom').textContent === 'Comté'); return l && /api\/img\//.test(l.querySelector('img').src); }, null, {timeout: 6000}).then(() => true).catch(() => false));
  await A.evaluate(() => document.querySelectorAll('.voile').forEach((v) => v.click())); await A.waitForTimeout(200);

  /* ---------- 8. retirer, annuler, terminer ---------- */
  await A.locator('.ligne', {hasText: 'Œufs'}).locator('[data-act="fiche"]').click(); await A.waitForSelector('.feuille .pas'); await A.click('.feuille [data-act="retire"]'); await A.waitForTimeout(300);
  const sansOeufs = !(await lignes(A)).some((x) => x.nom === 'Œufs'); await A.click('.toast button'); await A.waitForTimeout(300);
  ok('retirer un article, puis « Annuler » : il revient', sansOeufs && (await lignes(A)).some((x) => x.nom === 'Œufs'));
  await A.click('[data-act="terminer"]'); await A.waitForSelector('[data-act="termineOui"]'); await photo(A, '14-terminer');
  ok('terminer : 2 articles dans le panier, le reste gardé pour la prochaine fois', /2 articles dans le panier/.test(await A.textContent('.feuille')) && /restent sur la liste/.test(await A.textContent('.feuille')), await A.textContent('.feuille'));
  await A.click('[data-act="termineOui"]'); await A.waitForTimeout(500);
  { const l = await lignes(A); ok('panier vidé : tomates et bananes parties, plus rien de coché', !l.some((x) => x.nom === 'Tomates' || x.nom === 'Bananes' || x.pris) && l.length === 8, l.map((x) => x.nom)); }
  await A.click('[data-act="ajouter"]'); await A.waitForTimeout(300);
  ok('l\'app apprend les habitudes : tomates et bananes passent en tête de « Souvent achetés »', (await A.locator('#res .tuile b').allTextContents()).slice(0, 2).sort().join() === 'Bananes,Tomates', (await A.locator('#res .tuile b').allTextContents()).slice(0, 4)); await fermeR(A);

  /* ---------- 9. plusieurs listes ---------- */
  await A.click('.rond[data-act="menu"]'); await A.click('[data-act="nouvelleListe"]'); await A.waitForSelector('#rep'); await A.fill('#rep', 'Bricolage'); await A.click('[data-act="emoji"][data-e="🔨"]'); await A.click('[data-act="demandeOk"]'); await A.waitForTimeout(400);
  ok('nouvelle liste « Bricolage » : créée, ouverte, vide', /Bricolage/.test(await A.textContent('.tete .titre')) && (await lignes(A)).length === 0);
  await ajoute(A, 'ampoules'); await fermeR(A);
  await S.click('.rond[data-act="menu"]'); await S.waitForSelector('.feuille [data-act="liste"]');
  ok('Sam voit la nouvelle liste et son contenu dans le menu', /Bricolage/.test(await S.textContent('.feuille')) && /1 à prendre/.test(await S.locator('.feuille [data-act="liste"]', {hasText: 'Bricolage'}).textContent()), await S.textContent('.feuille').then((t) => t.slice(0, 160)));
  await S.evaluate(() => document.querySelectorAll('.voile').forEach((v) => v.click()));
  await A.click('.rond[data-act="menu"]'); await A.locator('.feuille [data-act="liste"]', {hasText: 'Courses'}).click(); await A.waitForTimeout(300);
  ok('retour à « Courses » : ses 8 articles, rien de mélangé', (await lignes(A)).length === 8 && !(await lignes(A)).some((x) => x.nom === 'Ampoules'));

  /* ---------- 10. durée, sombre, démonstration ---------- */
  await A.reload(); await A.waitForSelector('#app .ligne'); await A.waitForTimeout(400);
  ok('app fermée puis rouverte : toujours reliée, liste affichée', (await lignes(A)).length === 8 && /À jour/.test(await A.textContent('#sync')), await A.textContent('#sync'));
  const cibles = await A.evaluate(() => [...document.querySelectorAll('#app .coche, .barrebas .ajouter, .tete .rond')].map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  ok('boutons assez grands pour le pouce (40 px au moins)', cibles.length > 5 && Math.min(...cibles) >= 40, Math.min(...cibles));
  const nuit = await telephone('Nuit', {colorScheme: 'dark', storageState: await alex.ctx.storageState()}); await nuit.p.goto(URL0); await nuit.p.waitForSelector('#app .ligne'); await nuit.p.waitForTimeout(600);
  ok('mode sombre : fond sombre, texte clair, liste lisible', await nuit.p.evaluate(() => { const c = (s) => getComputedStyle(document.body)[s].match(/\d+/g).map(Number); return c('backgroundColor')[0] < 40 && c('color')[0] > 200; }));
  await photo(nuit.p, '15-sombre'); await nuit.ctx.close();
  /* page de démonstration : les mêmes fichiers sans serveur (GitHub Pages) */
  const STAT = http.createServer((q, r) => { const u = decodeURIComponent(new URL(q.url, 'http://x').pathname.replace(/^\/demo\//, '')) || 'index.html', f = path.join(RACINE, 'web', u.endsWith('/') ? u + 'index.html' : u);
    fs.readFile(f, (e, d) => { if (e || !f.startsWith(path.join(RACINE, 'web'))) { r.writeHead(404, {'content-type': 'text/html'}); r.end('<h1>404</h1>'); return; } r.writeHead(200, {'content-type': ({'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.webmanifest': 'application/manifest+json'})[path.extname(f)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise((z) => STAT.listen(0, '127.0.0.1', z));
  const demo = await telephone('Démo'), D = demo.p; await D.goto('http://127.0.0.1:' + STAT.address().port + '/demo/'); await D.waitForSelector('.barrebas', {timeout: 6000}).catch(() => {});
  await ajoute(D, 'tomates'); await ajoute(D, 'riz'); await fermeR(D);
  ok('sans serveur (page de démonstration) : l\'app marche seule, sur l\'appareil', /Démonstration/.test(await D.textContent('#sync')) && (await lignes(D)).length === 2 && /5,20 €/.test(await total(D)), await D.textContent('#sync').catch(() => 'pas démarrée'));
  await D.reload(); await D.waitForSelector('#app .ligne').catch(() => {}); ok('démonstration : la liste est gardée sur l\'appareil', (await lignes(D)).length === 2);
  ok('aucune erreur JavaScript pendant tout le parcours', erreurs.length === 0, erreurs.slice(0, 4));

  await b.close(); srv.kill(); SRC.close(); STAT.close();
  console.log(results.join('\n')); console.log('\n' + (results.length - fails) + ' / ' + results.length + ' vérifications réussies · captures : ' + OUT);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
