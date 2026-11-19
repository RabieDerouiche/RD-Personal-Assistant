/* Banc du serveur Panier : node courses/server/tests/courses.test.mjs
   Aucune vraie source : faux Open Food Facts, faux Open Prices, faux Wikipédia, faux Commons, fausses images (serveur local). */
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), SERVEUR = path.join(HERE, '..', 'courses.mjs'), RACINE = path.join(HERE, '..', '..', '..');
const results = []; let fails = 0;
const ok = (nom, cond, info) => { results.push((cond ? 'OK    ' : 'ÉCHEC ') + nom + (cond || info == null ? '' : ' :: ' + (typeof info === 'string' ? info : JSON.stringify(info)))); if (!cond) fails++; };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const attends = async (f, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await f(); if (v) return v; await pause(80); } return null; };

/* ---------- fausses sources ---------- */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1500, 7), Buffer.from([0xff, 0xd9])]);
const vues = [];
const SRC = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x'), B = 'http://127.0.0.1:' + SRC.address().port; vues.push(u.pathname + u.search);
  const j = (o) => { r.writeHead(200, {'content-type': 'application/json'}); r.end(JSON.stringify(o)); };
  if (u.pathname.startsWith('/img/')) { if (u.pathname.includes('html')) { r.writeHead(200, {'content-type': 'text/html'}); r.end('<html>'); return; } if (u.pathname.includes('redir')) { r.writeHead(302, {location: 'http://example.com/x.jpg'}); r.end(); return; }
    r.writeHead(200, {'content-type': 'image/jpeg'}); r.end(Buffer.concat([JPEG, Buffer.from(u.pathname)])); return; }
  if (u.pathname === '/off') { const q2 = u.searchParams.get('q') || '';
    if (/kikkoman/i.test(q2)) return j({hits: [
      {code: '1111111111111', product_name: 'Sauce soja sucrée', brands: ['Autre'], image_front_url: B + '/img/autre.jpg', unique_scans_n: 900, countries_tags: ['en:france'], categories_tags: ['en:sauces']},
      {code: '8715035110106', product_name_fr: 'Sauce soja', brands: ['Kikkoman'], image_front_url: B + '/img/kikkoman.jpg', unique_scans_n: 50, quantity: '150 ml', countries_tags: ['en:france'], categories_tags: ['en:groceries', 'en:sauces', 'en:soy-sauces']},
      {code: '2222222222222', product_name: 'Sauce soja', brands: ['Kikkoman'], unique_scans_n: 5000, countries_tags: ['en:france']}]});
    if (/granola/i.test(q2)) return j({hits: [{code: '3333333333333', product_name: 'Granola chocolat au lait', brands: ['LU'], image_front_url: B + '/img/granola.jpg', unique_scans_n: 300, countries_tags: ['en:france'], categories_tags: ['en:snacks', 'en:biscuits']}]});
    return j({hits: []}); }
  if (u.pathname === '/prix') { const c = u.searchParams.get('product_code');
    if (c === '8715035110106') return j({items: [{price: 3.1, currency: 'EUR'}, {price: 2.9, currency: 'EUR'}, {price: 9.99, currency: 'EUR', price_is_discounted: true}, {price: 3.5, currency: 'EUR'}, {price: 4, currency: 'USD'}]});
    return j({items: []}); }
  if (u.pathname === '/wiki') { const q2 = u.searchParams.get('gsrsearch') || '';
    if (/sauce soja/i.test(q2)) return j({query: {pages: {1: {index: 2, title: 'Poulet à la sauce soja', pageimage: 'Poulet.jpg', thumbnail: {source: B + '/img/poulet.jpg?utm=1'}}, 2: {index: 1, title: 'Sauce de soja', pageimage: 'Soy_sauce.jpg', thumbnail: {source: B + '/img/soja.jpg?utm=1'}}}}});
    return j({query: {pages: {}}}); }
  if (u.pathname === '/commons') return j({query: {pages: {9: {index: 1, title: 'File:Soy sauce bottle.jpg', imageinfo: [{thumburl: B + '/img/commons.jpg?x=1', width: 1200, height: 900, mime: 'image/jpeg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Soy_sauce_bottle.jpg', extmetadata: {Artist: {value: '<a href="x">Jeanne</a>'}, LicenseShortName: {value: 'CC BY-SA 4.0'}}}]}}}});
  r.writeHead(404); r.end();
});
await new Promise((z) => SRC.listen(0, '127.0.0.1', z)); const SB = 'http://127.0.0.1:' + SRC.address().port;

/* ---------- le serveur ---------- */
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'panier-')), PORT = 19000 + Math.floor(Math.random() * 900), BASE = 'http://127.0.0.1:' + PORT + '/courses';
const env = {...process.env, PANIER_DATA: DATA, PORT: String(PORT), PANIER_OFF_SEARCH: SB + '/off', PANIER_OFF_PRIX: SB + '/prix', PANIER_WIKI: SB + '/wiki', PANIER_COMMONS: SB + '/commons', PANIER_IMG_HOTES: '127.0.0.1:' + SRC.address().port, PANIER_IMG_HTTP: '1', PANIER_DELAI_MS: '3000'};
let proc = null;
const lance = async () => { proc = spawn(process.execPath, [SERVEUR], {env, stdio: ['ignore', 'pipe', 'pipe']}); proc.stderr.on('data', (d) => process.stderr.write(d));
  await attends(async () => { try { return (await fetch(BASE + '/api/sante')).ok; } catch (e) { return false; } }); };
const arrete = () => new Promise((z) => { proc.on('exit', z); proc.kill('SIGTERM'); });
const req = async (chemin, o = {}) => { const r = await fetch(BASE + chemin, {method: o.corps !== undefined || o.post ? 'POST' : 'GET', redirect: 'manual', headers: {...(o.corps !== undefined ? {'content-type': o.type || 'application/json'} : {}), ...(o.jeton ? {authorization: 'Bearer ' + o.jeton} : {}), ...(o.cookie ? {cookie: o.cookie} : {})}, body: o.corps !== undefined ? (typeof o.corps === 'string' ? o.corps : JSON.stringify(o.corps)) : undefined});
  let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch (e) { /* pas du JSON */ } return {st: r.status, j, t, h: r.headers}; };
let nop = 0; const ops = (jeton, ...liste) => req('/api/ops', {jeton, corps: {ops: liste.map((o) => ({oid: 'op' + (++nop), ...o}))}});

await lance();
{ const s = await req('/api/sante'); ok('santé : serveur prêt, catalogue chargé, pas encore de foyer', s.st === 200 && s.j.ok && s.j.foyer === false && s.j.catalogue > 250, s.j); }
{ const e = await req('/api/etat'); ok('sans appareil relié : 401, et l\'app sait qu\'aucun foyer n\'existe', e.st === 401 && e.j.foyer === false, e.j); }
{ const r = await req('/api/foyer/creer', {corps: 'prenom=Pirate', type: 'application/x-www-form-urlencoded'}); ok('un formulaire d\'un autre site est refusé (JSON exigé)', r.st === 415, r.st); }
const c1 = await req('/api/foyer/creer', {corps: {prenom: '  Alex  '}}); const A = c1.j && c1.j.jeton, ck = (c1.h.get('set-cookie') || '');
ok('créer le foyer : jeton rendu, cookie HttpOnly limité à /courses', c1.st === 200 && A && A.length >= 30 && /panier=/.test(ck) && /HttpOnly/.test(ck) && /SameSite=Lax/.test(ck) && /Path=\/courses/.test(ck) && c1.j.moi.prenom === 'Alex', ck);
{ const r = await req('/api/foyer/creer', {corps: {prenom: 'Intrus'}}); ok('un second « créer » est refusé : le foyer existe', r.st === 409, r.st); }
{ const e = await req('/api/etat', {cookie: 'panier=' + A}); ok('le cookie seul suffit (app installée sur l\'écran d\'accueil)', e.st === 200 && e.j.moi.prenom === 'Alex' && e.j.listes.length === 2 && e.j.magasins.includes('Grand Frais'), e.st); }

/* invitations */
const inv = await req('/api/foyer/inviter', {jeton: A, corps: {}});
ok('inviter : code à 6 chiffres, valable une heure', inv.st === 200 && /^\d{6}$/.test(inv.j.code) && inv.j.expire > Date.now() + 3500000, inv.j);
{ const faux = inv.j.code === '000000' ? '111111' : '000000'; const r = await req('/api/foyer/rejoindre', {corps: {prenom: 'Sam', code: faux}}); ok('mauvais code : refusé', r.st === 403, r.st); }
const c2 = await req('/api/foyer/rejoindre', {corps: {prenom: 'Sam', code: inv.j.code}}); const B = c2.j && c2.j.jeton;
ok('bon code : le second téléphone rejoint le foyer', c2.st === 200 && B && c2.j.moi.prenom === 'Sam', c2.j);
{ const c3 = await req('/api/foyer/rejoindre', {corps: {prenom: 'alex', code: inv.j.code}}); const e = await req('/api/etat', {jeton: c3.j.jeton});
  ok('même prénom depuis un autre appareil : même personne, deux appareils', c3.st === 200 && e.j.membres.length === 2 && e.j.membres.find((m) => m.prenom === 'Alex').appareils === 2, e.j && e.j.membres); }

/* flux en direct : Sam écoute */
const recus = []; const ctl = new AbortController();
fetch(BASE + '/api/flux', {headers: {cookie: 'panier=' + B}, signal: ctl.signal}).then(async (r) => { const dec = new TextDecoder(); for await (const c of r.body) recus.push(dec.decode(c)); }).catch(() => {});
await attends(() => recus.length > 0);
ok('flux : ouvert par le cookie, la révision arrive tout de suite', /event: rev/.test(recus.join('')), recus.join('').slice(0, 80));

/* opérations */
{ const r = await ops(A, {t: 'ligne.ajoute', ligne: {id: 'l1', l: 'courses', a: 'pommes-de-terre', q: 2, u: 'kg'}}, {t: 'ligne.ajoute', ligne: {id: 'l2', l: 'courses', a: 'lait', q: 6, u: 'L', m: 'Lactel', mag: 'Auchan'}});
  const l = r.j.etat.lignes; ok('ajouter deux articles du catalogue : nom, unité et auteur posés par le serveur', r.st === 200 && l.length === 2 && l[0].nom === 'Pommes de terre' && l[0].par === c1.j.moi.id && l[1].m === 'Lactel', l);
  const vu = await attends(() => /a ajouté Lait/.test(recus.join(''))); ok('l\'autre téléphone est prévenu en direct (« Alex a ajouté… »)', !!vu, recus.join('').slice(-200)); }
{ const r = await ops(B, {t: 'ligne.ajoute', ligne: {id: 'l3', l: 'courses', a: 'pommes-de-terre', q: 1, u: 'kg'}}); const l = r.j.etat.lignes.filter((x) => x.a === 'pommes-de-terre');
  ok('même article ajouté par l\'autre : une seule ligne, quantités additionnées', l.length === 1 && l[0].q === 3, l); }
{ const avant = (await req('/api/etat', {jeton: A})).j; const r = await req('/api/ops', {jeton: A, corps: {ops: [{oid: 'op1', t: 'ligne.ajoute', ligne: {id: 'l1', l: 'courses', a: 'pommes-de-terre', q: 2, u: 'kg'}}]}});
  ok('opération rejouée (réseau coupé puis revenu) : ignorée, rien en double', r.j.etat.lignes.length === avant.lignes.length && r.j.etat.lignes.find((x) => x.a === 'pommes-de-terre').q === 3 && r.j.rev === avant.rev, r.j.rev + ' / ' + avant.rev); }
{ const r = await ops(A, {t: 'ligne.ajoute', ligne: {id: 'l9', l: 'courses', a: 'article-inconnu', q: 1}}, {t: 'ligne.ajoute', ligne: {id: 'l10', l: 'pas-une-liste', a: 'lait'}}, {t: 'nimporte'}, {t: 'ligne.modifie', id: 'l1', champs: {q: -5, u: 'tonne', note: 'x'.repeat(500)}});
  const l = r.j.etat.lignes.find((x) => x.id === 'l1'); ok('opérations invalides refusées, valeurs absurdes écartées, texte borné', r.j.refus.length === 3 && l.q === 3 && l.u === 'kg' && l.note.length === 140, {refus: r.j.refus, l}); }
{ const r = await ops(A, {t: 'ligne.modifie', id: 'l1', champs: {q: 500, u: 'g', mag: 'Grand Frais', note: 'à chair ferme'}}, {t: 'ligne.coche', id: 'l1', coche: true}); const l = r.j.etat.lignes.find((x) => x.id === 'l1');
  ok('modifier puis cocher : quantité, magasin, précision, « pris par »', l.q === 500 && l.u === 'g' && l.mag === 'Grand Frais' && l.c && l.c.par === c1.j.moi.id, l); }
{ const r = await ops(B, {t: 'liste.termine', liste: 'courses', total: 1.2}); const e = r.j.etat;
  ok('terminer les courses : les articles pris quittent la liste, les autres restent, l\'habitude est notée', e.lignes.length === 1 && e.lignes[0].a === 'lait' && e.memo['pommes-de-terre'].n === 1 && e.memo.lait.m === 'Lactel' && e.journal.length === 1 && e.journal[0].n === 1, e.memo); }
{ const r = await ops(A, {t: 'liste.cree', id: 'l-brico', nom: 'Bricolage', icone: '🔨'}, {t: 'magasin.ajoute', nom: 'Biocoop'}, {t: 'magasin.retire', nom: 'Lidl'}, {t: 'article.modifie', id: 'lait', champs: {p: 1.25}});
  const e = r.j.etat; ok('nouvelle liste, magasins, prix corrigé par le foyer', e.listes.length === 3 && e.magasins.includes('Biocoop') && !e.magasins.includes('Lidl') && e.articles.lait.p === 1.25 && e.articles.lait.pFixe === 1, e.articles); }

/* alimentation automatique */
{ await ops(A, {t: 'article.cree', article: {id: 'x-sauce-soja', nom: 'Sauce soja'}}, {t: 'ligne.ajoute', ligne: {id: 'l20', l: 'courses', a: 'x-sauce-soja', q: 1}});
  const a = await attends(async () => { const e = (await req('/api/etat', {jeton: A})).j; return e.articles['x-sauce-soja'].pret ? e.articles['x-sauce-soja'] : null; });
  ok('article inconnu : photo trouvée seule (Wikipédia, l\'article qui porte ce nom, pas « Poulet à la sauce soja »)', a && /^[a-f0-9]{20}\.jpg$/.test(a.img || '') && a.src.t === 'wiki' && a.r === 'epicerie-salee', a);
  const im = a && await fetch(BASE + '/api/img/' + a.img); const b = im && Buffer.from(await im.arrayBuffer());
  ok('la photo apprise est servie depuis le serveur, gardée longtemps par le téléphone', im && im.status === 200 && im.headers.get('content-type') === 'image/jpeg' && /immutable/.test(im.headers.get('cache-control')) && b.includes('/img/soja.jpg'), im && im.status);
  const vuAvant = recus.join(''); ok('les téléphones sont prévenus quand la photo arrive', /"quoi":"photo"/.test(vuAvant), vuAvant.slice(-150)); }
{ await ops(A, {t: 'ligne.modifie', id: 'l20', champs: {m: 'Kikkoman'}});
  const v = await attends(async () => (await req('/api/etat', {jeton: A})).j.marques['x-sauce-soja|kikkoman']);
  ok('marque inconnue : photo du produit de cette marque (pas le plus scanné d\'une autre marque, pas celui sans photo)', v && v.code === '8715035110106' && v.src.t === 'off' && v.marque === 'Kikkoman', v);
  ok('prix relevé en magasin : médiane des prix en euros, promotions et autres monnaies écartées', v && v.p === 3.1, v && v.p); }
{ await ops(A, {t: 'article.cree', article: {id: 'x-granola', nom: 'Granola'}});
  const a = await attends(async () => { const x = (await req('/api/etat', {jeton: A})).j.articles['x-granola']; return x.pret ? x : null; });
  ok('article de marque sans page Wikipédia : photo et rayon pris chez Open Food Facts', a && a.src && a.src.t === 'off' && a.r === 'epicerie-sucree', a); }
{ const n = vues.length; await ops(A, {t: 'article.cree', article: {id: 'x-truc-introuvable', nom: 'Truc introuvable'}}); await pause(700); const a = (await req('/api/etat', {jeton: A})).j.articles['x-truc-introuvable'];
  ok('rien trouvé : l\'article reste utilisable, sans photo, rangé dans Divers', a && a.pret === 1 && !a.img && a.r === 'divers' && vues.length > n, a); }
{ const p = await req('/api/photos?nom=Sauce%20soja&marque=Kikkoman', {jeton: A}); const l = (p.j && p.j.photos) || [];
  ok('« Changer la photo » : candidates des trois sources, la marque d\'abord', p.st === 200 && l.length >= 4 && l[0].src === 'off' && l.some((x) => x.src === 'wiki') && l.some((x) => x.src === 'commons' && /Jeanne · CC BY-SA 4.0/.test(x.credit)), l);
  const bon = await req('/api/photo', {jeton: A, corps: {article: 'pommes-de-terre', url: SB + '/img/commons.jpg', src: 'commons', credit: 'Jeanne · CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:X.jpg'}});
  const e = (await req('/api/etat', {jeton: A})).j; ok('photo choisie pour un article du catalogue : enregistrée avec son crédit', bon.st === 200 && e.articles['pommes-de-terre'].img === bon.j.img && e.articles['pommes-de-terre'].src.credit === 'Jeanne · CC BY-SA 4.0', bon.j);
  const mauvais = await req('/api/photo', {jeton: A, corps: {article: 'lait', url: 'http://169.254.169.254/latest/meta-data'}}), html = await req('/api/photo', {jeton: A, corps: {article: 'lait', url: SB + '/img/html'}}), redir = await req('/api/photo', {jeton: A, corps: {article: 'lait', url: SB + '/img/redir.jpg'}});
  ok('le serveur ne télécharge que des images des sites autorisés (adresse interne, page web, redirection : refusées)', mauvais.st === 400 && html.st === 400 && redir.st === 400, [mauvais.st, html.st, redir.st]);
  const data = 'data:image/jpeg;base64,' + JPEG.toString('base64'), perso = await req('/api/photo', {jeton: B, corps: {article: 'lait', marque: 'Lactel', data}}), faux = await req('/api/photo', {jeton: B, corps: {article: 'lait', data: 'data:image/jpeg;base64,' + Buffer.from('<script>alert(1)</script>'.repeat(40)).toString('base64')}});
  const e2 = (await req('/api/etat', {jeton: A})).j; ok('photo prise avec le téléphone : gardée pour la marque ; un faux fichier est refusé', perso.st === 200 && e2.marques['lait|lactel'].src.t === 'perso' && faux.st === 400, [perso.st, faux.st]);
  const r = await ops(A, {t: 'article.modifie', id: 'pommes-de-terre', champs: {img: null}}); ok('« Remettre la photo d\'origine »', !r.j.etat.articles['pommes-de-terre'].img, r.j.etat.articles['pommes-de-terre']); }

/* fichiers */
{ const i = await req('/'), sw = await req('/sw.js'), cat = await req('/catalogue.json'), tr = await req('/..%2fserver/courses.mjs'), tr2 = await req('/api/img/..%2f..%2fetat.json'), sans = await fetch('http://127.0.0.1:' + PORT + '/courses', {redirect: 'manual'});
  ok('l\'app est servie sous /courses/ (page, service, catalogue), rien en dehors du dossier', i.st === 200 && /<title>Panier/.test(i.t) && sw.st === 200 && cat.j.articles.length > 250 && tr.st >= 403 && tr2.st === 404 && sans.status === 301, [i.st, sw.st, tr.st, tr2.st, sans.status]); }

/* durée : redémarrage, fichier d'état */
await pause(400); ctl.abort(); await arrete();
{ const f = path.join(DATA, 'etat.json'), brut = fs.readFileSync(f, 'utf8'), mode = (fs.statSync(f).mode & 0o777).toString(8);
  ok('état sur disque : droits 600, aucun jeton en clair, une copie du jour', mode === '600' && !brut.includes(A) && !brut.includes(B) && !brut.includes(inv.j.code) && fs.readdirSync(path.join(DATA, 'copies')).length === 1, mode); }
await lance();
{ const e = await req('/api/etat', {jeton: B}); ok('après un redémarrage : appareils toujours reliés, liste et photos intactes', e.st === 200 && e.j.lignes.some((l) => l.a === 'lait') && e.j.articles['x-sauce-soja'].img && e.j.listes.length === 3, e.st); }
{ execFileSync(process.execPath, [SERVEUR, 'code'], {env}); const c = JSON.parse(fs.readFileSync(path.join(DATA, 'code.json'), 'utf8'));
  ok('code de secours (`node courses.mjs code`) : posé pour 30 minutes, en empreinte', c.h.length === 64 && c.expire > Date.now() + 1700000, c.expire); }
{ const r = await req('/api/foyer/retirer', {jeton: B, corps: {id: c2.j.moi.id}}), e = await req('/api/etat', {jeton: B}), a = await req('/api/etat', {jeton: A});
  ok('délier un appareil : il n\'a plus accès, les autres gardent la liste', r.st === 200 && e.st === 401 && e.j.foyer === true && a.st === 200 && a.j.membres.length === 1, [r.st, e.st, a.st]); }
{ let dernier = 0; for (let i = 0; i < 13; i++) dernier = (await req('/api/foyer/rejoindre', {corps: {prenom: 'X', code: String(100000 + i)}})).st;
  const inv2 = await req('/api/foyer/inviter', {jeton: A, corps: {}}), apres = await req('/api/foyer/rejoindre', {corps: {prenom: 'X', code: inv2.j.code}});
  ok('codes essayés au hasard : au-delà de 12 erreurs, plus aucun essai pendant une heure (même avec le bon code)', dernier === 429 && apres.st === 429, [dernier, apres.st]); }
{ const gros = await req('/api/ops', {jeton: A, corps: {ops: [{oid: 'g1', t: 'ligne.modifie', id: 'l1', champs: {note: 'x'.repeat(300000)}}]}}); ok('corps trop gros : refusé (413), rien d\'appliqué', gros.st === 413, gros.st); }
await arrete();

/* monté dans le serveur JARVIS OS */
{ const D2 = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-panier-')), P2 = PORT + 1;
  const j = spawn(process.execPath, [path.join(RACINE, 'jarvis-os', 'server', 'server.mjs')], {env: {...env, JARVIS_DATA: D2, PORT: String(P2), HOST: '127.0.0.1', JARVIS_NOTIFY_TICK_MS: '3600000', JARVIS_SANTE_TICK_MS: '3600000', CLAUDE_BIN: '/bin/false'}, stdio: 'ignore'});
  const pret = await attends(async () => { try { return (await fetch('http://127.0.0.1:' + P2 + '/courses/api/sante')).ok; } catch (e) { return false; } }, 9000);
  const s = pret && await (await fetch('http://127.0.0.1:' + P2 + '/courses/api/sante')).json(), jv = pret && await (await fetch('http://127.0.0.1:' + P2 + '/api/health')).json(), page = pret && await (await fetch('http://127.0.0.1:' + P2 + '/courses/')).text(), racine = pret && await (await fetch('http://127.0.0.1:' + P2 + '/')).text();
  const cr = pret && await fetch('http://127.0.0.1:' + P2 + '/courses/api/foyer/creer', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{"prenom":"Alex"}'});
  ok('dans le serveur JARVIS : Panier répond sous /courses/, JARVIS reste à la racine, données à part', !!pret && s.ok && jv.ok && /<title>Panier/.test(page) && !/<title>Panier/.test(racine) && cr.status === 200 && await attends(() => fs.existsSync(path.join(D2, 'courses', 'etat.json'))) && (jv.paired === false), {s, jv});
  j.kill('SIGTERM'); }
SRC.close();
console.log(results.join('\n')); console.log('\n' + (results.length - fails) + ' / ' + results.length + ' vérifications réussies');
process.exit(fails ? 1 : 0);
