/* Panier — outil des photos du catalogue de base (à lancer à la main, jamais par le serveur).
   1. node photos.mjs cherche [id…]   : candidates Wikimedia Commons par article (page de recherche d'images, une requête par article),
                                        vignettes dans le dossier de travail (PANIER_PHOTOS, défaut : dossier temporaire).
   2. python3 planches.py             : planches contact à regarder ; on note le choix dans choix-photos.json ({"id": "c3"}, ou "c3@haut" pour le cadre).
      Une recherche à refaire : PANIER_Q="lamb chops" node photos.mjs cherche cotes-d-agneau
   3. node photos.mjs applique        : télécharge la photo choisie (960 px), python3 planches.py finales la recadre en carré 400 px WebP
                                        dans courses/web/img/, et écrit courses/web/credits.json (auteur, licence, source).
   Les photos gardées sont sous licence libre (Commons) : le crédit est obligatoire, l'app l'affiche dans Réglages. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {lire} from './construire.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = process.env.PANIER_PHOTOS || path.join(os.tmpdir(), 'panier-photos');
const UA = 'PanierCatalogue/0.1 (outil de catalogue, usage ponctuel)';
const API = 'https://commons.wikimedia.org/w/api.php';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.join(WORK, 'v'), {recursive: true}); fs.mkdirSync(path.join(WORK, 'hd'), {recursive: true});
const CAND = path.join(WORK, 'candidates.json'), CHOIX = path.join(HERE, 'choix-photos.json');
const cand = fs.existsSync(CAND) ? JSON.parse(fs.readFileSync(CAND, 'utf8')) : {};
const texte = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
async function api(params) {
  const u = API + '?' + new URLSearchParams({format: 'json', ...params});
  for (let i = 0; i < 12; i++) {
    const r = await fetch(u, {headers: {'user-agent': UA}}).catch(() => null);
    if (r && r.ok) return r.json();
    await pause(r && r.status === 429 ? 4000 + i * 4000 : 4000);
  }
  throw new Error('API Commons injoignable');
}
/* La page de recherche d'images de Commons porte ses résultats en JSON (40 par page) : elle répond sans le bridage de l'API,
   très serré depuis une adresse partagée. L'auteur et la licence sont demandés à l'API pour les seules photos choisies. */
async function recherche(q) {
  const u = 'https://commons.wikimedia.org/w/index.php?' + new URLSearchParams({search: q + ' filetype:bitmap', title: 'Special:MediaSearch', type: 'image'});
  let h = '';
  for (let i = 0; i < 6 && !h; i++) { const r = await fetch(u, {headers: {'user-agent': UA}}).catch(() => null); if (r && r.ok) h = await r.text(); else await pause(4000 + i * 3000); }
  const d = h.indexOf('"sdmsInitialSearchResults":'); if (d < 0) throw new Error('page de recherche illisible');
  let i = h.indexOf('{', d), n = 0, chaine = false, fin = -1;
  for (let k = i; k < h.length; k++) { const c = h[k]; if (chaine) { if (c === '\\') k++; else if (c === '"') chaine = false; } else if (c === '"') chaine = true; else if (c === '{') n++; else if (c === '}' && --n === 0) { fin = k; break; } }
  const res = JSON.parse(h.slice(i, fin + 1)).results || {};
  return Object.values(res).sort((a, b) => a.index - b.index).map((p) => { const im = (p.imageinfo || [])[0] || {};
    return {titre: p.title, w: im.width, h: im.height, mime: im.mime || p.extension || '', hd: String(im.thumburl || '').split('?')[0].replace(/\/\d+px-([^/]+)$/, '/960px-$1'), page: p.canonicalurl}; })
    .filter((c) => /\.(jpe?g|png)$/i.test(c.titre) && c.w >= 1000 && c.h >= 700 && c.w / c.h > 0.62 && c.w / c.h < 1.9 && /\/thumb\//.test(c.hd));
}
/* auteur et licence des photos choisies (API, 40 titres par appel) */
async function credits(titres) {
  const out = {};
  for (let k = 0; k < titres.length; k += 40) {
    const j = await api({action: 'query', titles: titres.slice(k, k + 40).join('|'), prop: 'imageinfo', iiprop: 'extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName'});
    const norm = {}; for (const x of (j.query && j.query.normalized) || []) norm[x.to] = x.from;
    for (const p of Object.values((j.query && j.query.pages) || {})) { const m = ((p.imageinfo || [])[0] || {}).extmetadata || {}; out[norm[p.title] || p.title] = out[p.title] = {auteur: texte(m.Artist && m.Artist.value), licence: texte(m.LicenseShortName && m.LicenseShortName.value)}; }
    await pause(1500);
  }
  return out;
}
async function charge(url, fichier) {
  if (fs.existsSync(fichier) && fs.statSync(fichier).size > 500) return true;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, {headers: {'user-agent': UA}}).catch(() => null);
    if (r && r.ok) { fs.writeFileSync(fichier, Buffer.from(await r.arrayBuffer())); return true; }
    if (r && r.status === 404) return false;
    await pause(r && r.status === 429 ? 3000 + i * 3000 : 2000);
  }
  return false;
}
const vignette = (hd) => hd.replace(/\/\d+px-([^/]+)$/, '/330px-$1');
const mode = process.argv[2], ids = process.argv.slice(3);
const {articles} = lire();
if (mode === 'cherche') {
  for (const a of articles) {
    if (ids.length ? !ids.includes(a.id) : cand[a.id]) continue;
    const q = process.env.PANIER_Q || a.photo, vus = new Set(), liste = [];
    try { for (const c of await recherche(q)) { if (!vus.has(c.titre) && liste.length < 10) { vus.add(c.titre); liste.push(c); } }
    } catch (e) { console.log('ÉCHEC ' + a.id + ' : ' + e.message); await pause(30000); continue; }
    let n = 0; for (const [i, c] of liste.entries()) { if (await charge(vignette(c.hd), path.join(WORK, 'v', a.id + '-' + i + '.jpg'))) n++; await pause(120); }
    cand[a.id] = liste; fs.writeFileSync(CAND, JSON.stringify(cand));
    console.log(a.id + ' : ' + liste.length + ' candidates, ' + n + ' vignettes'); await pause(600);
  }
} else if (mode === 'applique') {
  const choix = JSON.parse(fs.readFileSync(CHOIX, 'utf8')), sortie = {}, gardes = []; let n = 0;
  for (const a of articles) {
    if (ids.length && !ids.includes(a.id)) continue;
    const ch = choix[a.id]; if (!ch) continue;
    const m = /^c(\d+)(?:@(.+))?$/.exec(ch), c = m && (cand[a.id] || [])[+m[1]];
    if (!c) { console.log('choix introuvable : ' + a.id); continue; }
    const f = path.join(WORK, 'hd', a.id + '.jpg'), marque = f + '.titre';
    if (fs.existsSync(marque) && fs.readFileSync(marque, 'utf8') !== c.titre) fs.rmSync(f, {force: true});
    if (!(await charge(c.hd, f))) { console.log('téléchargement raté : ' + a.id); continue; }
    fs.writeFileSync(marque, c.titre); gardes.push({a, c, cadre: (m && m[2]) || ''}); n++; await pause(150);
  }
  const cr = await credits(gardes.filter((g) => !g.c.licence).map((g) => g.c.titre));
  for (const g of gardes) { const x = cr[g.c.titre] || {}, licence = g.c.licence || x.licence || '';
    if (!licence || /fair use|non-free/i.test(licence)) { console.log('licence inconnue, photo écartée : ' + g.a.id); continue; }
    g.c.licence = licence; g.c.auteur = g.c.auteur || x.auteur || 'inconnu';
    sortie[g.a.id] = {titre: g.c.titre.replace(/^File:/, ''), auteur: g.c.auteur, licence, page: g.c.page, cadre: g.cadre}; }
  fs.writeFileSync(path.join(WORK, 'credits-travail.json'), JSON.stringify(sortie, null, 1));
  console.log(Object.keys(sortie).length + ' photos prêtes sur ' + n + ' ; lancer : python3 planches.py finales');
} else console.log('Usage : node photos.mjs cherche|applique [id…]   (dossier de travail : ' + WORK + ')');
