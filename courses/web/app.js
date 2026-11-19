/* Panier — la liste de courses du foyer (PWA, sans bibliothèque).
   L'app marche d'abord sur le téléphone : chaque geste s'applique tout de suite, part au serveur dès qu'il y a du réseau
   (file d'opérations rejouables), et l'autre téléphone le voit en direct. Sans serveur (GitHub Pages) : mode démonstration, sur l'appareil seul. */
(() => {
'use strict';
const V = '1.0.0', LS = 'panier-v1', API = 'api/';
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const plat = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').toLowerCase();
const slug = (s) => plat(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'au', 'aux', 'en', 'et', 'a', 'd', 'l']);
const sing = (m) => (m.length > 3 ? m.replace(/(s|x)$/, '') : m);
const mots = (s) => plat(s).split(/[^a-z0-9]+/).filter((m) => m.length > 1 && !VIDES.has(m)).map(sing);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const svg = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
const I = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'), moins: svg('<path d="M5 12h14"/>'), coche: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  loupe: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'), croix: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'), bas: svg('<path d="M6 9l6 6 6-6"/>'), photo: svg('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  corbeille: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'), partage: svg('<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>'), points: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
};
const EMO = {fruits: '🍎', legumes: '🥕', 'boucherie-et-volaille': '🥩', 'charcuterie-et-traiteur': '🥓', poissonnerie: '🐟', 'cremerie-et-oeufs': '🥛', fromages: '🧀', boulangerie: '🥖', 'epicerie-salee': '🍝',
  'epicerie-sucree': '🍫', boissons: '🥤', surgeles: '❄️', bebe: '🍼', 'hygiene-et-beaute': '🧴', 'entretien-et-maison': '🧽', animaux: '🐾', divers: '🧺'};
const MASSE = ['kg', 'g'], VOLUME = ['L', 'cl'];
const fam = (u) => (MASSE.includes(u) ? 'masse' : VOLUME.includes(u) ? 'volume' : 'compte');
const nb = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const euro = (x) => (Math.round(x * 100) / 100).toFixed(2).replace('.', ',') + ' €';
const qteTxt = (q, u) => (u === 'pièce' ? '× ' + nb(q) : nb(q) + ' ' + u + (fam(u) === 'compte' && q >= 2 && !/[sx]$/.test(u) ? 's' : ''));

/* ---------- mémoire du téléphone ---------- */
let M = {jeton: '', etat: null, file: [], prefs: {groupe: 'rayon', liste: 'courses', panier: true}, local: false};
try { const m = JSON.parse(localStorage.getItem(LS) || 'null'); if (m && typeof m === 'object') M = {...M, ...m, prefs: {...M.prefs, ...(m.prefs || {})}}; } catch (e) { /* mémoire vide */ }
const sauve = () => { try { localStorage.setItem(LS, JSON.stringify(M)); } catch (e) { /* mémoire pleine : l'app continue */ } };
let CAT = {v: '', rayons: [], articles: []}, BASE = new Map(), INDEX = [], indexRev = -1;
let enLigne = true, enVol = false, source = null, neufs = new Set();

/* ---------- catalogue, articles, prix ---------- */
const art = (id) => { const b = BASE.get(id), s = M.etat && M.etat.articles[id]; return b || s ? {...(b || {}), ...(s || {}), id} : null; };
const variante = (id, m) => (m && M.etat && M.etat.marques[id + '|' + slug(m)]) || null;
function image(a, marque) {
  const v = variante(a.id, marque);
  if (v && v.img) return {src: API + 'img/' + v.img, prod: !!(v.src && v.src.t === 'off')};
  if (a.img) return {src: API + 'img/' + a.img, prod: !!(a.src && a.src.t === 'off')};
  if (a.i) return {src: 'img/' + a.id + '.webp?v=' + CAT.v};
  return {cherche: !!(a.perso && !a.pret && !M.local)};
}
function photo(a, marque, cls) {
  const im = a ? image(a, marque) : {};
  return '<span class="photo ' + (cls || '') + (im.prod ? ' prod' : '') + (im.cherche ? ' cherche' : '') + '">' + (EMO[a && a.r] || '🧺') + (im.src ? '<img src="' + esc(im.src) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span>';
}
/* prix à l'unité de base de l'article (kg, litre ou unité de comptage) et d'où il vient */
function prixUnite(a, marque) {
  const v = variante(a.id, marque);
  if (v && v.p != null && fam(a.u) === 'compte') return {p: v.p, src: v.pFixe ? 'toi' : 'releve', marque: true};
  if (a.p != null) return {p: a.p, src: a.pFixe ? 'toi' : a.perso ? 'releve' : 'estime'};
  return {p: null, src: ''};
}
function cout(l) {
  const a = l.a && art(l.a); if (!a) return null; const {p} = prixUnite(a, l.m); if (p == null) return null;
  const fl = fam(l.u), fa = fam(a.u), q = fl === 'masse' ? (l.u === 'g' ? l.q / 1000 : l.q) : fl === 'volume' ? (l.u === 'cl' ? l.q / 100 : l.q) : l.q;
  if (fl === fa) return q * p;
  if (a.pp && fl === 'compte' && fa === 'masse') return q * a.pp * p;
  if (a.pp && fl === 'masse' && fa === 'compte') return (q / a.pp) * p;
  return null;
}
const unites = (a) => { const f = fam(a.u); return f === 'masse' ? (a.pp ? ['kg', 'g', 'pièce'] : MASSE) : f === 'volume' ? VOLUME : (a.pp ? [a.u, 'kg', 'g'] : [a.u]); };
const mini = (u) => (u === 'kg' ? 0.25 : u === 'g' ? 50 : u === 'L' ? 0.5 : u === 'cl' ? 25 : 1);
function pas(q, u, sens) {
  const s = u === 'kg' ? (sens > 0 ? (q < 1 ? 0.25 : 0.5) : (q <= 1 ? 0.25 : 0.5)) : u === 'g' ? (sens > 0 ? (q < 250 ? 50 : 100) : (q <= 250 ? 50 : 100)) : u === 'L' ? (sens > 0 ? (q < 1 ? 0.5 : 1) : (q <= 1 ? 0.5 : 1)) : u === 'cl' ? 25 : 1;
  return Math.round((q + sens * s) * 1000) / 1000;
}
function convertis(q, de, vers, a) {
  if (de === vers) return q; const fd = fam(de), fv = fam(vers); let x = q;
  if (fd === fv) x = de === 'kg' ? q * 1000 : de === 'g' ? q / 1000 : de === 'L' ? q * 100 : de === 'cl' ? q / 100 : q;
  else if (a.pp && fd === 'masse') x = Math.max(1, Math.round((de === 'g' ? q / 1000 : q) / a.pp));
  else if (a.pp && fv === 'masse') { const kg = q * a.pp; x = vers === 'g' ? Math.max(50, Math.round(kg * 20) * 50) : Math.max(0.25, Math.round(kg * 4) / 4); }
  return Math.round(x * 1000) / 1000;
}

/* ---------- recherche ---------- */
function indexe() {
  const cle = M.etat ? M.etat.rev + ':' + CAT.articles.length + ':' + Object.keys(M.etat.articles).length : ''; if (!M.etat || indexRev === cle) return; indexRev = cle;
  const ids = new Set([...BASE.keys(), ...Object.keys(M.etat.articles).filter((k) => M.etat.articles[k].perso)]);
  INDEX = [...ids].map((id) => { const a = art(id); return {a, n: plat(a.nom).trim(), tn: mots(a.nom), tk: mots(a.k || ''), m: a.m || []}; });
}
const dist1 = (a, b) => { if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; };
function analyse(txt) {
  let t = txt.trim(), q = null, u = null, m;
  if ((m = /^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|cl|x)?\s+(.+)$/i.exec(t))) { q = +m[1].replace(',', '.'); u = m[2]; t = m[3]; }
  else if ((m = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|cl)$/i.exec(t))) { q = +m[2].replace(',', '.'); u = m[3]; t = m[1]; }
  else if ((m = /^(.+?)\s*x\s*(\d+)$/i.exec(t))) { q = +m[2]; t = m[1]; }
  u = u ? ({kg: 'kg', g: 'g', gr: 'g', l: 'L', cl: 'cl'})[u.toLowerCase()] || null : null;
  return {texte: t.trim(), q: q > 0 && q < 10000 ? q : null, u};
}
function cherche(texte) {
  indexe(); const tq = plat(texte).split(/[^a-z0-9]+/).filter((t) => t && !VIDES.has(t)).map(sing), plein = plat(texte).trim(); if (!tq.length) return [];
  const out = [];
  for (const x of INDEX) {
    let score = 0, marque = '', ok = true;
    for (const t of tq) {
      if (x.tn.some((w) => w.startsWith(t))) score += 10 + (x.tn[0].startsWith(t) ? 4 : 0);
      else if (x.tk.some((w) => w.startsWith(t))) score += 5;
      else { const b = t.length >= 3 && x.m.find((mq) => plat(mq).split(/[^a-z0-9]+/).some((w) => w.startsWith(t)));
        if (b) { score += 3; marque = b; } else if (t.length >= 5 && x.tn.concat(x.tk).some((w) => dist1(t, w.slice(0, t.length)) || dist1(t, w))) score += 4; else { ok = false; break; } }
    }
    if (!ok) continue;
    if (x.n === plein || x.tn.join(' ') === tq.join(' ')) score += 50; else if (x.n.startsWith(plein)) score += 20;
    const s = M.etat.memo[x.a.id]; score += Math.min(10, ((s && s.n) || 0) * 2) + (x.a.top ? 2 : 0) - x.tn.length * 0.5;
    out.push({a: x.a, score, marque});
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 36);
}

/* ---------- opérations : les mêmes règles que le serveur, appliquées tout de suite ---------- */
function rejoue(E, op) {
  const moi = E.moi.id, L = E.lignes, t = op.t, trouve = (id) => L.find((x) => x.id === id);
  if (t === 'ligne.ajoute') { const n = op.ligne; if (trouve(n.id)) return;
    const meme = L.find((x) => x.l === n.l && !x.c && x.a && x.a === n.a && slug(x.m) === slug(n.m) && x.u === n.u);
    if (meme) { meme.q = Math.round((meme.q + n.q) * 1000) / 1000; meme.le = Date.now(); } else L.push({note: '', mag: '', m: '', c: 0, ...n, par: moi, le: Date.now()});
    const s = E.memo[n.a] || (E.memo[n.a] = {n: 0}); s.m = n.m || ''; s.mag = n.mag || ''; s.q = n.q; s.u = n.u; }
  else if (t === 'ligne.modifie') { const l = trouve(op.id); if (l) { Object.assign(l, op.champs); const s = E.memo[l.a] || (E.memo[l.a] = {n: 0}); s.m = l.m || ''; s.mag = l.mag || ''; s.q = l.q; s.u = l.u; } }
  else if (t === 'ligne.coche') { const l = trouve(op.id); if (l) l.c = op.coche ? {par: moi, le: Date.now()} : 0; }
  else if (t === 'ligne.supprime') E.lignes = L.filter((x) => x.id !== op.id);
  else if (t === 'liste.termine') { for (const l of L) if (l.l === op.liste && l.c && l.a) { const s = E.memo[l.a] || (E.memo[l.a] = {n: 0}); s.n = (s.n || 0) + 1; } E.lignes = L.filter((x) => !(x.l === op.liste && x.c)); }
  else if (t === 'liste.decoche') { for (const l of L) if (l.l === op.liste) l.c = 0; }
  else if (t === 'liste.cree') { if (!E.listes.some((x) => x.id === op.id)) E.listes.push({id: op.id, nom: op.nom, icone: op.icone || '📝'}); }
  else if (t === 'liste.renomme') { const l = E.listes.find((x) => x.id === op.id); if (l) { l.nom = op.nom; if (op.icone) l.icone = op.icone; } }
  else if (t === 'liste.supprime') { if (E.listes.length > 1) { E.listes = E.listes.filter((x) => x.id !== op.id); E.lignes = L.filter((x) => x.l !== op.id); } }
  else if (t === 'article.cree') { if (!E.articles[op.article.id]) E.articles[op.article.id] = {perso: 1, r: 'divers', u: 'pièce', q: 1, ...op.article}; }
  else if (t === 'article.modifie') { const c = op.champs, a = E.articles[op.id] || (E.articles[op.id] = {});
    if ('p' in c) { if (c.p == null) { delete a.p; delete a.pFixe; } else { a.p = c.p; a.pFixe = 1; } }
    if ('r' in c) { a.r = c.r; a.rFixe = 1; } if (c.img === null) { delete a.img; delete a.src; }
    if (op.marque && 'pm' in c) { const k = op.id + '|' + slug(op.marque), v = E.marques[k] || (E.marques[k] = {}); if (c.pm == null) delete v.p; else { v.p = c.pm; v.pFixe = 1; } } }
  else if (t === 'magasin.ajoute') { if (!E.magasins.includes(op.nom)) E.magasins.push(op.nom); }
  else if (t === 'magasin.retire') E.magasins = E.magasins.filter((x) => x !== op.nom);
}
function fais(...ops) {
  for (const op of ops) { op.oid = uid('o'); rejoue(M.etat, op); if (!M.local) M.file.push(op); }
  M.etat.rev += M.local ? 1 : 0; sauve(); rendu(); pousse();
}
async function appel(chemin, corps) {
  const r = await fetch(API + chemin, {method: corps ? 'POST' : 'GET', credentials: 'same-origin', headers: {...(corps ? {'content-type': 'application/json'} : {}), ...(M.jeton ? {authorization: 'Bearer ' + M.jeton} : {})}, body: corps ? JSON.stringify(corps) : undefined});
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) { const e = new Error((j && j.erreur) || 'Erreur ' + r.status); e.status = r.status; e.j = j; throw e; }
  return j;
}
function pose(etat) { M.etat = etat; for (const op of M.file) rejoue(M.etat, op); sauve(); rendu(); }
async function pousse() {
  if (enVol || M.local || !M.file.length || !M.etat) return; enVol = true; majSync();
  const lot = M.file.slice(0, 100), ids = new Set(lot.map((o) => o.oid));
  try { const r = await appel('ops', {ops: lot}); M.file = M.file.filter((o) => !ids.has(o.oid)); enLigne = true; enVol = false; pose(r.etat); if (M.file.length) pousse(); }
  catch (e) { enVol = false;
    if (e.status === 401) return quitte(true);
    if (e.status && e.status < 500 && e.status !== 429) { M.file = M.file.filter((o) => !ids.has(o.oid)); sauve(); tire(); }   /* lot refusé : jamais rejoué en boucle */
    else { enLigne = false; setTimeout(pousse, 6000); } }
  majSync();
}
async function tire() {
  if (M.local || enVol || !M.etat) return;
  try { const e = await appel('etat'); enLigne = true; if (!enVol) pose(e); } catch (e) { if (e.status === 401) return quitte(true); enLigne = false; }
  majSync();
}
function flux() {
  if (M.local || source || !M.etat || document.hidden) return;
  try { source = new EventSource(API + 'flux'); } catch (e) { return; }
  source.addEventListener('rev', (ev) => { let d = {}; try { d = JSON.parse(ev.data); } catch (e) { /* rien */ } enLigne = true; majSync();
    if (d.rev > M.etat.rev || (d.rev && d.rev < M.etat.rev - 5)) { if (d.resume && d.par && d.par !== M.etat.moi.id) { const mb = M.etat.membres.find((x) => x.id === d.par); toast(esc(d.resume), {membre: mb}); } tire(); } });
  source.onerror = () => { if (source && source.readyState === 2) { source = null; } };
}
const coupeFlux = () => { if (source) { source.close(); source = null; } };
setInterval(() => { if (!document.hidden && M.etat && !M.local) { if (!source) flux(); if (!source || !enLigne) tire(); pousse(); } }, 20000);
document.addEventListener('visibilitychange', () => { if (document.hidden) coupeFlux(); else if (M.etat) { tire(); flux(); pousse(); veille(); } });
addEventListener('online', () => { tire(); flux(); pousse(); }); addEventListener('offline', () => { enLigne = false; majSync(); });

/* ---------- messages ---------- */
function toast(html, o = {}) {
  let z = $('.toasts'); if (!z) { z = document.createElement('div'); z.className = 'toasts'; document.body.append(z); }
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = (o.membre ? pastille(o.membre) : '') + '<span>' + html + '</span>' + (o.annule ? '<button>Annuler</button>' : '');
  if (o.annule) t.querySelector('button').onclick = () => { o.annule(); sors(); };
  const sors = () => { t.classList.add('sort'); setTimeout(() => t.remove(), 260); };
  z.append(t); while (z.children.length > 1) z.firstChild.remove(); setTimeout(sors, o.annule ? 4500 : 2600);
}
const pastille = (m, cls) => (m ? '<span class="pastille ' + (cls || '') + '" style="background:' + esc(m.couleur || '#888') + '">' + esc((m.prenom || '?').slice(0, 1).toUpperCase()) + '</span>' : '');
let verrou = null;
async function veille() { try { if (!verrou && 'wakeLock' in navigator && M.etat && M.etat.lignes.some((l) => l.c)) { verrou = await navigator.wakeLock.request('screen'); verrou.addEventListener('release', () => { verrou = null; }); } } catch (e) { /* refusé : sans gravité */ } }

/* ---------- écran principal ---------- */
const liste = () => M.etat.listes.find((x) => x.id === M.prefs.liste) || M.etat.listes[0];
const lignes = () => { const id = liste().id; return M.etat.lignes.filter((l) => l.l === id); };
function ligneHtml(l) {
  const a = l.a && art(l.a), c = cout(l), mb = M.etat.membres.length > 1 && M.etat.membres.find((x) => x.id === l.par), det = [l.m, l.note].filter(Boolean).join(' · ');
  return '<div class="ligne' + (l.c ? ' pris' : '') + (neufs.has(l.id) ? ' neuf' : '') + '" data-l="' + esc(l.id) + '"><button class="corps" data-act="fiche" aria-label="Régler ' + esc(l.nom) + '">' + photo(a, l.m) +
    '<span class="txt"><div class="nom">' + esc(l.nom) + '</div>' + (det ? '<div class="det">' + esc(det) + '</div>' : '') +
    '<div class="bas"><span class="qte n">' + esc(qteTxt(l.q, l.u)) + '</span>' + (c != null ? '<span class="px n">≈ ' + euro(c) + '</span>' : '') + (l.mag && M.prefs.groupe !== 'magasin' ? '<span class="mag">' + esc(l.mag) + '</span>' : '') + (mb ? pastille(mb, 'p') : '') + '</div></span></button>' +
    '<button class="coche" data-act="coche" aria-label="' + (l.c ? 'Remettre ' : 'Prendre ') + esc(l.nom) + '" aria-pressed="' + (l.c ? 'true' : 'false') + '"><i>' + I.coche + '</i></button></div>';
}
function rListe() {
  const E = M.etat, li = liste(), tout = lignes(), reste = tout.filter((l) => !l.c), pris = tout.filter((l) => l.c);
  let total = 0, aPrendre = 0, sans = 0; for (const l of tout) { const c = cout(l); if (c == null) sans++; else { total += c; if (!l.c) aPrendre += c; } }
  const groupes = [];
  if (M.prefs.groupe === 'magasin') { for (const mg of [...E.magasins, '']) { const g = reste.filter((l) => (E.magasins.includes(l.mag) ? l.mag : '') === mg); if (g.length) groupes.push({nom: mg || 'Peu importe où', emo: mg ? '🏪' : '🧺', l: g}); } }
  else { const ordre = CAT.rayons.map((r) => r.id); for (const r of CAT.rayons) { const g = reste.filter((l) => { const a = l.a && art(l.a), id = a && ordre.includes(a.r) ? a.r : 'divers'; return id === r.id; }); if (g.length) groupes.push({nom: r.nom, emo: EMO[r.id] || '🧺', l: g}); } }
  for (const g of groupes) g.l.sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
  const top = CAT.articles.filter((a) => a.top && a.i).slice(0, 6);
  $('#app').innerHTML =
    '<header class="tete"><button class="titre" data-act="menu" aria-label="Listes et réglages"><span>' + esc(li.icone || '') + '</span><span class="nom">' + esc(li.nom) + '</span>' + I.bas + '</button>' +
    '<span class="pastilles" data-act="menu">' + E.membres.slice(0, 4).map((m) => pastille(m)).join('') + '</span><button class="rond" data-act="menu" aria-label="Menu">' + I.points + '</button></header>' +
    '<div class="etatsync" id="sync"></div>' +
    '<section class="bilan" aria-label="Estimation"><div class="ligne1"><div class="total n"><small>≈</small>' + euro(pris.length ? aPrendre : total) + '</div><div class="combien">' + (tout.length ? (pris.length ? pris.length + ' sur ' + tout.length + ' dans le panier' : tout.length + ' article' + (tout.length > 1 ? 's' : '')) : 'Liste vide') + '</div></div>' +
    '<div class="barre"><i style="width:' + (tout.length ? Math.round((pris.length / tout.length) * 100) : 0) + '%"></i></div>' +
    '<div class="sous"><span>' + (pris.length ? 'reste à prendre · total ≈ ' + euro(total) : 'estimation du total') + '</span><span>' + (sans ? sans + ' sans prix' : '') + '</span></div></section>' +
    (tout.length ? '<div class="outils"><div class="segments" role="tablist"><button data-act="groupe" data-g="rayon" class="' + (M.prefs.groupe !== 'magasin' ? 'on' : '') + '">Par rayon</button><button data-act="groupe" data-g="magasin" class="' + (M.prefs.groupe === 'magasin' ? 'on' : '') + '">Par magasin</button></div>' +
      (pris.length ? '<button class="fin" data-act="terminer">Terminer (' + pris.length + ')</button>' : '') + '</div>' : '') +
    (tout.length ? '' : '<div class="vide"><div class="mosaique">' + top.map((a) => photo(a)).join('') + '</div><h3>Rien à acheter pour l\'instant</h3><p>Touche « Ajouter un article » : tout le foyer voit la liste en direct.</p></div>') +
    groupes.map((g) => '<section class="groupe"><h2><span>' + g.emo + '</span>' + esc(g.nom) + '<span class="cpt">' + g.l.length + '</span></h2><div class="bloc">' + g.l.map(ligneHtml).join('') + '</div></section>').join('') +
    (tout.length && !reste.length ? '<div class="vide"><h3>Tout est dans le panier 🎉</h3><p>Touche « Terminer » pour vider la liste.</p></div>' : '') +
    (pris.length ? '<button class="replie' + (M.prefs.panier ? ' ouvert' : '') + '" data-act="panier">' + I.chevron + 'Dans le panier · ' + pris.length + '</button>' + (M.prefs.panier ? '<div class="bloc">' + pris.sort((x, y) => (y.c.le || 0) - (x.c.le || 0)).map(ligneHtml).join('') + '</div>' : '') : '');
  neufs.clear(); majSync();
}
function majSync() {
  const z = $('#sync'); if (!z || !M.etat) return;
  const n = M.file.length, cls = M.local ? 'hors' : !enLigne ? 'hors' : n || enVol ? 'attente' : '';
  z.className = 'etatsync ' + cls;
  z.innerHTML = '<i></i>' + (M.local ? 'Démonstration : la liste reste sur cet appareil' : !enLigne ? 'Hors connexion' + (n ? ' · ' + n + ' changement' + (n > 1 ? 's' : '') + ' à envoyer' : ' · la liste reste utilisable') : n || enVol ? 'Envoi…' : (M.etat.membres.length > 1 ? 'À jour · partagée avec ' + M.etat.membres.filter((m) => m.id !== M.etat.moi.id).map((m) => esc(m.prenom)).join(', ') : 'À jour · pas encore partagée (Menu, Inviter)'));
}

/* ---------- ajouter : recherche, rayons, souvent achetés ---------- */
let R = null;   /* {q, rayon} quand la recherche est ouverte */
function ouvreRecherche() {
  if (R) return; R = {q: '', rayon: null};
  const d = document.createElement('div'); d.className = 'plein'; d.id = 'recherche';
  d.innerHTML = '<div class="haut"><label class="champ">' + I.loupe + '<input id="q" type="search" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Tomates, 2 kg de carottes, lait Lactel…" aria-label="Chercher un article"><button class="efface" data-act="efface" hidden aria-label="Effacer">' + I.croix + '</button></label><button class="ferme" data-act="fermeRecherche">OK</button></div><div class="defile" id="res"></div>';
  document.body.append(d); const q = $('#q');
  q.addEventListener('input', () => { R.q = q.value; R.rayon = null; rResultats(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const p = $('#res [data-act="tuile"], #res [data-act="creer"]'); if (p && R.q.trim()) p.click(); else if (!R.q.trim()) fermeRecherche(); } });
  rResultats(); setTimeout(() => q.focus(), 60);
}
function fermeRecherche() { const d = $('#recherche'); if (d) d.remove(); R = null; }
function dansListe(id) { return lignes().find((l) => l.a === id && !l.c); }
function tuile(a, marque) {
  const l = dansListe(a.id), s = M.etat.memo[a.id], m = marque || (s && s.m) || '', pu = prixUnite(a, m), f = fam(a.u);
  const sous = l && l.m ? l.m : m ? m : pu.p != null ? '≈ ' + euro(pu.p) + (f === 'masse' ? ' / kg' : f === 'volume' ? ' / L' : '') : '';
  return '<div class="tuile' + (l ? ' dedans' : '') + '" data-a="' + esc(a.id) + '" data-m="' + esc(marque || '') + '"><button class="zone" data-act="tuile" aria-label="' + (l ? 'Régler ' : 'Ajouter ') + esc(a.nom) + '">' + photo(a, l ? l.m : m) + '<span class="lib"><b>' + esc(a.nom) + '</b><span>' + esc(sous) + '&nbsp;</span></span></button>' +
    (l ? '<div class="compte n"><button data-act="tuileMoins" aria-label="Moins">' + (l.q <= mini(l.u) ? I.corbeille : I.moins) + '</button><span>' + esc(qteTxt(l.q, l.u)) + '</span><button data-act="tuilePlus" aria-label="Plus">' + I.plus + '</button></div>' : '<span class="plus">' + I.plus + '</span>') + '</div>';
}
function rResultats() {
  const z = $('#res'); if (!z || !R) return; indexe();
  const ef = $('#recherche .efface'); if (ef) ef.hidden = !R.q;
  if (R.rayon) {
    const r = CAT.rayons.find((x) => x.id === R.rayon), as = INDEX.map((x) => x.a).filter((a) => a.r === R.rayon).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    z.innerHTML = '<div class="sec"><span>' + (EMO[R.rayon] || '') + ' ' + esc(r ? r.nom : '') + '</span><button data-act="rayons">Tous les rayons</button></div><div class="grille">' + as.map((a) => tuile(a)).join('') + '</div>'; return;
  }
  const A = analyse(R.q);
  if (!A.texte) {
    const memo = M.etat.memo, freq = INDEX.map((x) => x.a).filter((a) => (memo[a.id] && memo[a.id].n) || a.top).sort((a, b) => ((memo[b.id] && memo[b.id].n) || 0) - ((memo[a.id] && memo[a.id].n) || 0) || (b.top || 0) - (a.top || 0)).slice(0, 12);
    z.innerHTML = '<div class="sec">Souvent achetés</div><div class="grille">' + freq.map((a) => tuile(a)).join('') + '</div><div class="sec">Rayons</div><div class="rayons">' +
      CAT.rayons.map((r) => { const ex = CAT.articles.find((a) => a.r === r.id && a.i) || {r: r.id}; return '<button class="rayon" data-act="rayon" data-r="' + r.id + '">' + photo(ex) + '<span>' + esc(r.nom) + '</span></button>'; }).join('') + '</div>' +
      '<p class="astuce">Écris la quantité avec le nom : « 2 kg pommes de terre », « lait x6 ».</p>'; return;
  }
  const res = cherche(A.texte), exact = res.some((x) => plat(x.a.nom).trim() === plat(A.texte).trim());
  z.innerHTML = (res.length ? '<div class="grille">' + res.map((x) => tuile(x.a, x.marque)).join('') + '</div>' : '') +
    (exact ? '' : '<button class="creer" data-act="creer"><span class="photo">' + I.plus + '</span><span><b>Ajouter « ' + esc(A.texte) + ' »</b><span>Nouvel article : sa photo et son prix sont cherchés tout seuls</span></span></button>') +
    (res.length ? '' : '<p class="astuce">Aucun article du catalogue ne correspond.</p>');
}
function ajoute(a, o = {}) {
  const s = M.etat.memo[a.id] || {}, u = o.u && unites(a).includes(o.u) ? o.u : (!o.q && s.u && unites(a).includes(s.u) ? s.u : a.u);
  const l = {id: uid('l'), l: liste().id, a: a.id, nom: a.nom, m: o.m != null ? o.m : (s.m || ''), q: o.q || (u === s.u && s.q) || (u === a.u ? a.q : mini(u)) || 1, u, note: '', mag: s.mag || ''};
  neufs.add(l.id); fais({t: 'ligne.ajoute', ligne: l}); return l;
}

/* ---------- feuilles ---------- */
const piles = [];
function feuille(cle, rend, o = {}) {
  const v = document.createElement('div'); v.className = 'voile'; v.dataset.cle = cle;
  v.innerHTML = '<div class="feuille" role="dialog" aria-modal="true"><div class="poignee" data-act="ferme"><i></i></div><div class="contenu"></div></div>';
  const f = {cle, v, rend, o, peint() { const c = $('.contenu', v), ac = document.activeElement; if (ac && c.contains(ac) && /INPUT|SELECT/.test(ac.tagName)) { f.sale = true; return; } const y = c.scrollTop; c.innerHTML = rend(); c.scrollTop = y; f.sale = false; }};
  v.addEventListener('click', (e) => { if (e.target === v) ferme(); });
  v.addEventListener('focusout', () => setTimeout(() => { if (f.sale) f.peint(); }, 50));
  document.body.append(v); piles.push(f); f.peint(); return f;
}
function ferme() { const f = piles.pop(); if (f) { f.v.remove(); if (f.o.fin) f.o.fin(); } }
const fermeTout = () => { while (piles.length) ferme(); };

/* fiche d'une ligne : quantité, marque, précision, magasin, prix, photo */
function ouvreFiche(id) {
  feuille('fiche', () => {
    const l = M.etat.lignes.find((x) => x.id === id); if (!l) { setTimeout(ferme, 0); return ''; }
    const a = art(l.a) || {id: l.a, nom: l.nom, u: l.u, r: 'divers'}, c = cout(l), pu = prixUnite(a, l.m), f = fam(a.u), us = unites(a), v = variante(a.id, l.m);
    const connues = Object.keys(M.etat.marques).filter((k) => k.startsWith(a.id + '|')).map((k) => M.etat.marques[k].marque).filter(Boolean);
    const marques = [...new Set([l.m, ...(a.m || []), (M.etat.memo[a.id] || {}).m, ...connues].filter(Boolean))].slice(0, 8);
    const base = f === 'masse' ? 'kg' : f === 'volume' ? 'L' : a.u, quoi = pu.src === 'toi' ? 'Ton prix' : pu.src === 'releve' ? 'Prix relevé en magasin' : pu.src === 'estime' ? 'Prix estimé' : 'Prix inconnu';
    return '<div class="fiche"><button class="photo' + (image(a, l.m).prod ? ' prod' : '') + '" data-act="photo" aria-label="Changer la photo">' + (EMO[a.r] || '🧺') + (image(a, l.m).src ? '<img src="' + esc(image(a, l.m).src) + '" alt="">' : '') + '<span class="app">' + I.photo + '</span></button>' +
      '<div style="min-width:0;flex:1"><h3>' + esc(l.nom) + '</h3><label class="ray">' + (EMO[a.r] || '') + ' <select data-ch="rayon" aria-label="Rayon" style="border:0;background:none;font-weight:600;color:inherit;max-width:170px">' + CAT.rayons.map((r) => '<option value="' + r.id + '"' + (r.id === a.r ? ' selected' : '') + '>' + esc(r.nom) + '</option>').join('') + '</select></label>' +
      '<div class="cout n">' + (c != null ? '≈ ' + euro(c) : '—') + (v && v.nom ? '<small>' + esc(v.nom) + '</small>' : '') + '</div></div></div>' +
      '<div class="etq">Quantité</div><div class="pas"><button data-act="qMoins" aria-label="Moins">' + (l.q <= mini(l.u) ? I.corbeille : I.moins) + '</button><div class="val n">' + nb(l.q) + '<small>' + esc(l.u === 'pièce' ? (l.q >= 2 ? 'pièces' : 'pièce') : l.u + (fam(l.u) === 'compte' && l.q >= 2 && !/[sx]$/.test(l.u) ? 's' : '')) + '</small></div><button class="plus" data-act="qPlus" aria-label="Plus">' + I.plus + '</button></div>' +
      (us.length > 1 ? '<div class="puces" style="margin-top:10px">' + us.map((u) => '<button class="puce fine' + (u === l.u ? ' on' : '') + '" data-act="unite" data-u="' + esc(u) + '">' + (u === 'pièce' ? 'à la pièce' : 'en ' + esc(u)) + '</button>').join('') + '</div>' : '') +
      '<div class="etq">Marque</div><div class="puces">' + marques.map((m) => '<button class="puce' + (slug(m) === slug(l.m) ? ' on' : '') + '" data-act="marque" data-m="' + esc(m) + '">' + esc(m) + '</button>').join('') + '<button class="puce' + (l.m ? '' : ' on') + '" data-act="marque" data-m="">Peu importe</button></div>' +
      '<input class="saisie" style="margin-top:10px" data-ch="marque" placeholder="Autre marque…" autocomplete="off" autocapitalize="words" enterkeyhint="done" aria-label="Autre marque">' +
      '<div class="etq">Précision</div><input class="saisie" data-ch="note" value="' + esc(l.note) + '" placeholder="Bien mûres, bio, 500 g, sans sucre…" autocomplete="off" enterkeyhint="done" aria-label="Précision">' +
      '<div class="etq">Où l\'acheter</div><div class="puces">' + M.etat.magasins.map((m) => '<button class="puce fine' + (m === l.mag ? ' on' : '') + '" data-act="mag" data-m="' + esc(m) + '">' + esc(m) + '</button>').join('') + '<button class="puce fine' + (l.mag ? '' : ' on') + '" data-act="mag" data-m="">Peu importe</button></div>' +
      '<div class="etq">Prix</div><label class="prixl"><span class="q"><b>' + quoi + '</b>' + (pu.marque ? esc(l.m) + ', ' : '') + 'par ' + esc(base) + (pu.src === 'estime' ? ' · corrige-le si besoin' : '') + '</span><input data-ch="prix" class="n" inputmode="decimal" value="' + (pu.p != null ? nb(pu.p) : '') + '" placeholder="—" aria-label="Prix par ' + esc(base) + '"><span>€</span></label>' +
      '<div class="actions"><button class="btn rouge" data-act="retire" aria-label="Retirer de la liste">' + I.corbeille + '</button><button class="btn" data-act="ferme">C\'est bon</button></div>';
  }, {}).id = id;
}
const ficheId = () => { const f = piles.find((x) => x.cle === 'fiche'); return f && f.id; };
const ligneDe = (id) => M.etat.lignes.find((x) => x.id === id);
function retire(id) { const l = ligneDe(id); if (!l) return; const copie = {...l, id: uid('l')}; fais({t: 'ligne.supprime', id}); toast('Retiré : ' + esc(l.nom), {annule: () => fais({t: 'ligne.ajoute', ligne: copie})}); }
function quantite(id, sens) { const l = ligneDe(id); if (!l) return; const q = pas(l.q, l.u, sens); if (q < mini(l.u)) { if (ficheId() === id) ferme(); return retire(id); } fais({t: 'ligne.modifie', id, champs: {q}}); }

/* choisir une autre photo : candidates des sources libres, appareil photo, photothèque */
function ouvrePhoto(id) {
  const l = ligneDe(id), a = l && art(l.a); if (!a) return;
  if (M.local) return toast('Les photos se changent une fois l\'app installée sur ton serveur.');
  let photos = null, erreur = '', envoi = false;
  const f = feuille('photo', () => '<h3>Photo de ' + esc(a.nom) + (l.m ? ' · ' + esc(l.m) : '') + '</h3>' +
    '<div class="actions" style="margin:0 0 14px"><label class="btn clair">' + I.photo + ' Prendre une photo<input type="file" accept="image/*" capture="environment" data-ch="fichier" hidden></label><label class="btn clair">Mes photos<input type="file" accept="image/*" data-ch="fichier" hidden></label></div>' +
    (envoi ? '<p class="petit">Enregistrement de la photo…</p>' : erreur ? '<p class="petit">' + esc(erreur) + '</p>' : photos == null ? '<p class="petit">Recherche de photos…</p>' : photos.length ? '<div class="choixphoto">' + photos.map((p, i) => '<button class="' + (p.src === 'off' ? 'off' : '') + '" data-act="choisitPhoto" data-i="' + i + '" aria-label="' + esc(p.titre) + '"><img src="' + esc(p.url) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"><span class="src">' + (p.src === 'off' ? 'produit' : 'photo') + '</span></button>').join('') + '</div><p class="petit">Photos libres de Wikimedia Commons et d\'Open Food Facts.</p>' : '<p class="petit">Aucune photo trouvée : prends-la toi-même.</p>') +
    (!l.m && art(a.id).img && BASE.get(a.id) && BASE.get(a.id).i ? '<div class="actions"><button class="btn clair" data-act="photoOrigine">Remettre la photo d\'origine</button></div>' : ''));
  f.envoie = async (corps) => { envoi = true; f.peint(); try { await appel('photo', {article: a.id, marque: l.m || '', ...corps}); await tire(); ferme(); toast('Photo changée'); } catch (e) { envoi = false; erreur = e.message || 'Photo refusée.'; f.peint(); } };
  f.photos = () => photos;
  appel('photos?nom=' + encodeURIComponent(a.nom) + '&marque=' + encodeURIComponent(l.m || '')).then((r) => { photos = r.photos || []; f.peint(); }).catch(() => { photos = []; erreur = 'Recherche impossible sans connexion.'; f.peint(); });
}
function reduis(fichier) {   /* photo du téléphone → carré 480 px, JPEG léger */
  return new Promise((ok, ko) => { const u = URL.createObjectURL(fichier), im = new Image();
    im.onload = () => { const c = document.createElement('canvas'), s = Math.min(im.naturalWidth, im.naturalHeight); c.width = c.height = 480;
      c.getContext('2d').drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, 480, 480); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.82)); };
    im.onerror = () => { URL.revokeObjectURL(u); ko(new Error('Photo illisible')); }; im.src = u; });
}

/* menu : listes, foyer, magasins, réglages */
function ouvreMenu() {
  feuille('menu', () => { const E = M.etat, autonome = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return '<h3>Nos listes</h3><div class="bloc">' + E.listes.map((x) => { const n = E.lignes.filter((l) => l.l === x.id && !l.c).length; return '<button class="item' + (x.id === liste().id ? ' on' : '') + '" data-act="liste" data-id="' + esc(x.id) + '"><span class="e">' + esc(x.icone || '📝') + '</span><span class="t">' + esc(x.nom) + '</span><span class="d">' + (n ? n + ' à prendre' : 'vide') + (x.id === liste().id ? ' ' + I.coche : '') + '</span></button>'; }).join('') +
      '<button class="item" data-act="nouvelleListe"><span class="e">＋</span><span class="t">Nouvelle liste<small>Bricolage, pharmacie, cadeaux, tâches…</small></span></button></div>' +
      '<div class="etq">Le foyer</div><div class="bloc">' + E.membres.map((m) => '<div class="item">' + pastille(m) + '<span class="t">' + esc(m.prenom) + (m.id === E.moi.id ? '<small>toi, sur cet appareil</small>' : '') + '</span></div>').join('') +
      (M.local ? '' : '<button class="item" data-act="inviter"><span class="e">💌</span><span class="t">Inviter quelqu\'un<small>Un code à lui envoyer, valable une heure</small></span><span class="d">' + I.chevron + '</span></button>') + '</div>' +
      '<div class="etq">Réglages</div><div class="bloc"><button class="item" data-act="magasins"><span class="e">🏪</span><span class="t">Nos magasins<small>' + esc(E.magasins.slice(0, 4).join(', ')) + '…</small></span><span class="d">' + I.chevron + '</span></button>' +
      '<button class="item" data-act="listeRegle"><span class="e">✏️</span><span class="t">Renommer ou supprimer « ' + esc(liste().nom) + ' »</span><span class="d">' + I.chevron + '</span></button>' +
      (lignes().some((l) => l.c) ? '<button class="item" data-act="decoche"><span class="e">↩️</span><span class="t">Tout remettre à prendre</span></button>' : '') +
      (M.local ? '' : '<button class="item" data-act="prenom"><span class="e">🙂</span><span class="t">Mon prénom<small>' + esc(E.moi.prenom) + '</small></span><span class="d">' + I.chevron + '</span></button>') +
      (autonome ? '' : '<button class="item" data-act="installer"><span class="e">📲</span><span class="t">Mettre l\'app sur l\'écran d\'accueil</span><span class="d">' + I.chevron + '</span></button>') +
      '<button class="item" data-act="credits"><span class="e">📷</span><span class="t">Crédits des photos</span><span class="d">' + I.chevron + '</span></button>' +
      (M.local ? '' : '<button class="item" data-act="quitter"><span class="e">🚪</span><span class="t">Délier cet appareil</span></button>') + '</div>' +
      '<p class="petit" style="text-align:center">Panier ' + V + ' · ' + CAT.articles.length + ' articles au catalogue' + (Object.values(E.articles).filter((a) => a.perso).length ? ' + ' + Object.values(E.articles).filter((a) => a.perso).length + ' ajoutés par vous' : '') + '</p>'; });
}
function demande(titre, o) {   /* petite feuille de saisie */
  const st = {emoji: o.emoji || (o.emojis && o.emojis[0])};
  const f = feuille('demande', () => '<h3>' + esc(titre) + '</h3>' + (o.aide ? '<p class="petit" style="margin:-6px 2px 12px">' + esc(o.aide) + '</p>' : '') + (o.emojis ? '<div class="puces" style="margin-bottom:12px">' + o.emojis.map((e) => '<button class="puce' + (e === st.emoji ? ' on' : '') + '" data-act="emoji" data-e="' + e + '">' + e + '</button>').join('') + '</div>' : '') +
    '<input class="saisie" id="rep" value="' + esc(o.valeur || '') + '" placeholder="' + esc(o.indice || '') + '" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" maxlength="' + (o.max || 30) + '">' +
    '<div class="actions">' + (o.supprime ? '<button class="btn rouge" data-act="demandeSuppr">' + I.corbeille + '</button>' : '') + '<button class="btn" data-act="demandeOk">' + esc(o.bouton || 'Enregistrer') + '</button></div>');
  f.st = st; f.ok = o.ok; f.suppr = o.supprime;
  const inp = $('#rep', f.v); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('[data-act="demandeOk"]', f.v).click(); }); setTimeout(() => inp.focus(), 80); return f;
}

/* ---------- gestes ---------- */
const ACT = {
  menu: ouvreMenu, ferme, ajouter: ouvreRecherche, fermeRecherche,
  groupe: (el) => { M.prefs.groupe = el.dataset.g; sauve(); rListe(); },
  panier: () => { M.prefs.panier = !M.prefs.panier; sauve(); rListe(); },
  fiche: (el) => ouvreFiche(el.closest('[data-l]').dataset.l),
  coche: (el) => { const z = el.closest('[data-l]'), l = ligneDe(z.dataset.l); if (!l) return; z.classList.toggle('pris', !l.c); if (!l.c) z.classList.add('part');
    setTimeout(() => { fais({t: 'ligne.coche', id: l.id, coche: !l.c}); veille(); }, l.c ? 0 : 240); },
  terminer: () => { const pris = lignes().filter((l) => l.c), total = pris.reduce((s, l) => s + (cout(l) || 0), 0), reste = lignes().length - pris.length;
    feuille('fin', () => '<h3>Courses terminées ?</h3><div class="bloc"><div class="item"><span class="e">🧺</span><span class="t">' + pris.length + ' article' + (pris.length > 1 ? 's' : '') + ' dans le panier<small>retirés de la liste</small></span><span class="d n">≈ ' + euro(total) + '</span></div>' + (reste ? '<div class="item"><span class="e">⏳</span><span class="t">' + reste + ' restent sur la liste<small>pour la prochaine fois</small></span></div>' : '') + '</div><div class="actions"><button class="btn clair" data-act="ferme">Pas encore</button><button class="btn" data-act="termineOui">Vider le panier</button></div>').total = total; },
  termineOui: () => { const f = piles[piles.length - 1]; fais({t: 'liste.termine', liste: liste().id, total: Math.round((f.total || 0) * 100) / 100}); fermeTout(); toast('Panier vidé. À la prochaine !'); },
  decoche: () => { fais({t: 'liste.decoche', liste: liste().id}); fermeTout(); },
  efface: () => { const q = $('#q'); q.value = ''; R.q = ''; rResultats(); q.focus(); },
  rayon: (el) => { R.rayon = el.dataset.r; rResultats(); $('#res').scrollTop = 0; },
  rayons: () => { R.rayon = null; rResultats(); },
  tuile: (el) => { const t = el.closest('.tuile'), a = art(t.dataset.a), l = dansListe(a.id); if (l) return ouvreFiche(l.id);
    const A = analyse(R.q), tape = !!A.texte, l2 = ajoute(a, {q: A.q, u: A.u, m: t.dataset.m || undefined});
    if (tape) { toast('Ajouté : ' + esc(a.nom) + ' · ' + esc(qteTxt(l2.q, l2.u))); const q = $('#q'); q.value = ''; R.q = ''; rResultats(); q.focus(); } },
  tuilePlus: (el) => { const l = dansListe(el.closest('.tuile').dataset.a); if (l) quantite(l.id, 1); },
  tuileMoins: (el) => { const l = dansListe(el.closest('.tuile').dataset.a); if (l) quantite(l.id, -1); },
  creer: () => { const A = analyse(R.q), nom = A.texte.slice(0, 60).replace(/^./, (c) => c.toUpperCase()), id = 'x-' + slug(nom); if (!slug(nom)) return;
    const u = A.u || 'pièce', a = {id, nom, u: fam(u) === 'compte' ? 'pièce' : (u === 'g' ? 'kg' : u === 'cl' ? 'L' : u), q: 1};
    const ops = []; if (!art(id)) ops.push({t: 'article.cree', article: a});
    const l = {id: uid('l'), l: liste().id, a: id, nom, m: '', q: A.q || 1, u, note: '', mag: ''}; neufs.add(l.id); fais(...ops, {t: 'ligne.ajoute', ligne: l});
    toast('Ajouté : ' + esc(nom) + (M.local ? '' : ' · photo en cours')); const q = $('#q'); q.value = ''; R.q = ''; rResultats(); q.focus(); },
  qPlus: () => quantite(ficheId(), 1), qMoins: () => quantite(ficheId(), -1),
  unite: (el) => { const l = ligneDe(ficheId()), a = art(l.a); fais({t: 'ligne.modifie', id: l.id, champs: {u: el.dataset.u, q: convertis(l.q, l.u, el.dataset.u, a)}}); },
  marque: (el) => fais({t: 'ligne.modifie', id: ficheId(), champs: {m: el.dataset.m}}),
  mag: (el) => fais({t: 'ligne.modifie', id: ficheId(), champs: {mag: el.dataset.m}}),
  retire: () => { const id = ficheId(); ferme(); retire(id); },
  photo: () => ouvrePhoto(ficheId()),
  photoOrigine: () => { const l = ligneDe(ficheId()); if (l) fais({t: 'article.modifie', id: l.a, champs: {img: null}}); ferme(); },
  choisitPhoto: (el) => { const f = piles[piles.length - 1], p = f.photos()[+el.dataset.i]; if (p) f.envoie({url: p.url, src: p.src, credit: p.credit, page: p.page}); },
  liste: (el) => { M.prefs.liste = el.dataset.id; sauve(); fermeTout(); rendu(); scrollTo(0, 0); },
  nouvelleListe: () => demande('Nouvelle liste', {indice: 'Bricolage, pharmacie, cadeaux…', bouton: 'Créer', emojis: ['📝', '🛍️', '🔨', '💊', '🎁', '🧹', '🌱', '🎒'], ok: (nom, f) => { const id = 'l-' + (slug(nom) || 'liste') + '-' + Math.random().toString(36).slice(2, 5); fais({t: 'liste.cree', id, nom, icone: f.emoji}); M.prefs.liste = id; sauve(); fermeTout(); rendu(); }}),
  listeRegle: () => { const li = liste(); demande('La liste « ' + li.nom + ' »', {valeur: li.nom, emojis: [...new Set([li.icone, '🛒', '🛍️', '📝', '🔨', '💊', '🎁', '🧹', '🌱'])], emoji: li.icone, ok: (nom, f) => { fais({t: 'liste.renomme', id: li.id, nom, icone: f.emoji}); fermeTout(); },
    supprime: M.etat.listes.length > 1 ? () => { if (confirm('Supprimer la liste « ' + li.nom + ' » et ses articles ?')) { fais({t: 'liste.supprime', id: li.id}); M.prefs.liste = M.etat.listes[0].id; sauve(); fermeTout(); rendu(); } } : null}); },
  emoji: (el) => { const f = piles[piles.length - 1]; f.st.emoji = el.dataset.e; el.parentNode.querySelectorAll('.puce').forEach((b) => b.classList.toggle('on', b === el)); },
  demandeOk: () => { const f = piles[piles.length - 1], v = $('#rep', f.v).value.trim(); if (v) f.ok(v, f.st); },
  demandeSuppr: () => { const f = piles[piles.length - 1]; if (f.suppr) f.suppr(); },
  prenom: () => demande('Mon prénom', {valeur: M.etat.moi.prenom, max: 24, ok: async (nom) => { try { await appel('foyer/prenom', {prenom: nom}); await tire(); fermeTout(); } catch (e) { toast(esc(e.message)); } }}),
  magasins: () => feuille('magasins', () => '<h3>Nos magasins</h3><p class="petit" style="margin:-6px 2px 12px">Ils servent à ranger la liste « Par magasin ». Touche un magasin pour le retirer.</p><div class="puces">' + M.etat.magasins.map((m) => '<button class="puce" data-act="magasinRetire" data-m="' + esc(m) + '">' + esc(m) + ' ' + I.croix + '</button>').join('') + '</div><input class="saisie" style="margin-top:14px" data-ch="magasin" placeholder="Ajouter un magasin…" autocomplete="off" autocapitalize="words" enterkeyhint="done"><div class="actions"><button class="btn" data-act="ferme">C\'est bon</button></div>'),
  magasinRetire: (el) => fais({t: 'magasin.retire', nom: el.dataset.m}),
  inviter: async () => { let r; try { r = await appel('foyer/inviter', {}); } catch (e) { return toast('Impossible sans connexion.'); }
    const lien = location.origin + location.pathname + '#inviter=' + r.code;
    feuille('invite', () => '<h3>Inviter dans le foyer</h3><div class="codebox n">' + r.code + '</div><p class="petit">Envoie-lui le lien : il ouvre Panier, demande son prénom et ce code. Valable une heure, pour 4 appareils (téléphone, tablette, et l\'app une fois sur l\'écran d\'accueil).</p><div class="actions"><button class="btn" data-act="partage" data-lien="' + esc(lien) + '" data-code="' + r.code + '">' + I.partage + ' Envoyer le lien</button></div>'); },
  partage: async (el) => { const d = {title: 'Panier', text: 'Rejoins notre liste de courses. Code : ' + el.dataset.code, url: el.dataset.lien};
    try { if (navigator.share) await navigator.share(d); else { await navigator.clipboard.writeText(d.text + ' ' + d.url); toast('Lien copié'); } } catch (e) { /* partage annulé */ } },
  installer: () => feuille('install', () => '<h3>Sur l\'écran d\'accueil</h3><div class="bloc"><div class="item"><span class="e">1</span><span class="t">Ouvre cette page dans Safari</span></div><div class="item"><span class="e">2</span><span class="t">Touche Partager<small>le carré avec la flèche vers le haut</small></span></div><div class="item"><span class="e">3</span><span class="t">« Sur l\'écran d\'accueil », puis Ajouter</span></div></div><p class="petit">Si l\'app installée demande un code : Menu, « Inviter quelqu\'un » depuis cette page, et saisis-le avec le même prénom.</p><div class="actions"><button class="btn" data-act="ferme">Compris</button></div>'),
  credits: async () => { let cr = {}; try { cr = await (await fetch('credits.json')).json(); } catch (e) { /* hors connexion */ }
    const appris = Object.values(M.etat.articles).concat(Object.values(M.etat.marques)).filter((x) => x.src && x.src.page);
    feuille('credits', () => '<h3>Crédits des photos</h3><p class="petit" style="margin-top:-6px">Photos sous licence libre de <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>, recadrées en carré. Photos de produits et prix relevés : <a href="https://fr.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> et Open Prices (ODbL, CC BY-SA).</p><p class="credits">' +
      Object.keys(cr).map((k) => { const a = BASE.get(k); return '<a href="' + esc(cr[k].page) + '" target="_blank" rel="noopener">' + esc(a ? a.nom : k) + '</a> : ' + esc(cr[k].auteur) + ' (' + esc(cr[k].licence) + ')'; }).join(' · ') + (appris.length ? ' · ' + appris.map((x) => '<a href="' + esc(x.src.page) + '" target="_blank" rel="noopener">' + esc(x.nom || 'photo ajoutée') + '</a> : ' + esc(x.src.credit || '')).join(' · ') : '') + '</p>'); },
  quitter: async () => { if (!confirm('Délier cet appareil ? La liste reste chez les autres.')) return; try { await appel('foyer/retirer', {id: M.etat.moi.id}); } catch (e) { /* déjà délié */ } quitte(); },
};
document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const f = ACT[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); } });
document.addEventListener('change', async (e) => { const el = e.target, ch = el.dataset && el.dataset.ch; if (!ch) return; const id = ficheId(), l = id && ligneDe(id);
  if (ch === 'marque' && l) { const v = el.value.trim().slice(0, 40); el.value = ''; if (v) fais({t: 'ligne.modifie', id, champs: {m: v}}); }
  else if (ch === 'note' && l) fais({t: 'ligne.modifie', id, champs: {note: el.value.trim().slice(0, 140)}});
  else if (ch === 'rayon' && l) fais({t: 'article.modifie', id: l.a, champs: {r: el.value}});
  else if (ch === 'prix' && l) { const a = art(l.a), x = el.value.trim() === '' ? null : +el.value.replace(',', '.').replace(/[^0-9.]/g, ''); if (x !== null && !(x >= 0 && x < 10000)) return;
    const parMarque = l.m && fam(a.u) === 'compte' && variante(a.id, l.m) && variante(a.id, l.m).p != null;
    fais(parMarque ? {t: 'article.modifie', id: a.id, marque: l.m, champs: {pm: x}} : {t: 'article.modifie', id: a.id, champs: {p: x}}); }
  else if (ch === 'magasin') { const v = el.value.trim().slice(0, 30); el.value = ''; if (v) fais({t: 'magasin.ajoute', nom: v}); }
  else if (ch === 'fichier' && el.files && el.files[0]) { const f = piles[piles.length - 1]; try { f.envoie({data: await reduis(el.files[0])}); } catch (x) { toast('Photo illisible.'); } }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && /^(marque|note|prix|magasin)$/.test(e.target.dataset.ch || '')) e.target.blur(); if (e.key === 'Escape') { if (piles.length) ferme(); else if (R) fermeRecherche(); } });

/* ---------- accueil : créer le foyer ou le rejoindre ---------- */
function rAccueil(foyer, msg) {
  const top = CAT.articles.filter((a) => a.top && a.i).slice(0, 6), code = (/inviter=(\d{6})/.exec(location.hash) || [])[1] || '';
  const rejoindre = foyer || !!code;
  $('#app').innerHTML = ''; let z = $('#accueil'); if (!z) { z = document.createElement('div'); z.id = 'accueil'; z.className = 'accueil'; document.body.append(z); }
  z.innerHTML = '<div class="mosaique">' + top.map((a) => photo(a)).join('') + '</div><h1>Pa<em>nier</em></h1><p>La liste de courses de la maison, à plusieurs, en direct.</p>' +
    '<input class="saisie" id="prenom" placeholder="Ton prénom" autocomplete="given-name" autocapitalize="words" maxlength="24" enterkeyhint="next">' +
    (rejoindre ? '<input class="saisie n" id="code" placeholder="Code d\'invitation (6 chiffres)" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="' + esc(code) + '">' : '') +
    '<button class="btn" id="go">' + (rejoindre ? 'Rejoindre la liste' : 'Créer notre liste') + '</button><div class="err" id="err" role="alert">' + esc(msg || '') + '</div>' +
    (rejoindre ? '<p class="petit" style="text-align:center">Le code se trouve dans Panier, chez la personne déjà reliée : Menu, « Inviter quelqu\'un ».</p>' : '');
  $('#go').onclick = async () => { const prenom = $('#prenom').value.trim(), c = rejoindre ? $('#code').value.replace(/\D/g, '') : ''; if (!prenom) return ($('#err').textContent = 'Écris ton prénom.'); if (rejoindre && c.length !== 6) return ($('#err').textContent = 'Le code a 6 chiffres.');
    $('#go').disabled = true;
    try { const r = await appel(rejoindre ? 'foyer/rejoindre' : 'foyer/creer', rejoindre ? {prenom, code: c} : {prenom}); M.jeton = r.jeton; M.file = []; M.etat = await appel('etat'); sauve(); history.replaceState(null, '', location.pathname); z.remove(); demarre(); if (!rejoindre) setTimeout(() => toast('Liste créée. Invite ton foyer depuis le menu.'), 500); }
    catch (e) { $('#go').disabled = false; if (e.status === 409) return rAccueil(true, 'Le foyer existe déjà : il faut un code.'); $('#err').textContent = e.status ? e.message : 'Serveur injoignable : réessaie.'; } };
}
function quitte(perdu) { coupeFlux(); M.jeton = ''; M.etat = null; M.file = []; sauve(); fermeTout(); fermeRecherche(); const b = $('.barrebas'); if (b) b.remove(); rAccueil(true, perdu ? 'Cet appareil n\'est plus relié : demande un nouveau code.' : ''); }

function rendu() {
  if (!M.etat) return; if (!M.etat.listes.some((x) => x.id === M.prefs.liste)) M.prefs.liste = M.etat.listes[0].id;
  rListe(); if (R) rResultats(); for (const f of piles) if (f.cle !== 'demande') f.peint();
}
function demarre() {
  if (!$('.barrebas')) { const b = document.createElement('div'); b.className = 'barrebas'; b.innerHTML = '<div class="dedans"><button class="ajouter" data-act="ajouter">' + I.loupe + '<span>Ajouter un article…</span><span class="plus">' + I.plus + '</span></button></div>'; document.body.append(b); }
  rendu(); tire(); flux(); pousse(); veille();
}
const etatLocal = () => ({rev: 1, version: V, moi: {id: 'moi', prenom: 'Moi'}, membres: [{id: 'moi', prenom: 'Moi', couleur: '#1f8a5b'}], listes: [{id: 'courses', nom: 'Courses', icone: '🛒'}, {id: 'achats', nom: 'Achats', icone: '🛍️'}], lignes: [], articles: {}, marques: {}, memo: {},
  magasins: ['Grand Frais', 'Fresh', 'Boucherie', 'Auchan', 'Carrefour', 'Intermarché', 'Leclerc', 'Lidl', 'Marché'], journal: []});
async function lance() {
  try { CAT = await (await fetch('catalogue.json')).json(); BASE = new Map(CAT.articles.map((a) => [a.id, a])); } catch (e) { /* hors connexion sans cache : la liste s'affiche quand même */ }
  if (M.etat) demarre();   /* la liste gardée s'affiche tout de suite */
  if (M.local) return;
  let sante = null, joint = false;
  try { const r = await fetch(API + 'sante', {cache: 'no-store'}); joint = true; if (r.ok) sante = await r.json().catch(() => null); } catch (e) { /* pas de réseau */ }
  if (!joint) { enLigne = false; if (!M.etat) { $('#app').innerHTML = '<div class="vide"><h3>Pas de connexion</h3><p>Panier s\'ouvrira dès que le réseau revient.</p></div>'; setTimeout(lance, 4000); } else majSync(); return; }
  if (!sante || !sante.ok) { if (!M.etat) { M.local = true; M.etat = etatLocal(); sauve(); demarre(); } return; }   /* pas de serveur (page de démonstration) */
  try { const e = await appel('etat'); const z = $('#accueil'); if (z) z.remove(); const neuf = !M.etat; pose(e); if (neuf) demarre(); }
  catch (e) { if (e.status === 401) { M.etat = null; M.file = []; sauve(); const b = $('.barrebas'); if (b) b.remove(); rAccueil(e.j && e.j.foyer); } }
}
lance();
if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  navigator.serviceWorker && navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
    /* les photos du catalogue sont gardées sur le téléphone : la liste reste belle sans réseau, au fond du magasin */
    setTimeout(() => { if (reg.active && CAT.articles.length) reg.active.postMessage({type: 'photos', urls: CAT.articles.filter((a) => a.i).map((a) => 'img/' + a.id + '.webp?v=' + CAT.v)}); }, 5000);
  }).catch(() => {});
}
window.__panier = {get etat() { return M.etat; }, get file() { return M.file; }, V};
})();
