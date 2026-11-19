/* Panier — construit courses/web/catalogue.json à partir de catalogue.txt (source lisible, une ligne par article).
   Usage : node courses/catalogue/construire.mjs   (aucune dépendance). Les photos sont dans courses/web/img/<id>.webp (outil photos.mjs). */
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), WEB = path.join(HERE, '..', 'web');
export const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/Œ/g, 'oe').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function lire() {
  const rayons = [], articles = []; let rayon = null;
  for (const brut of fs.readFileSync(path.join(HERE, 'catalogue.txt'), 'utf8').split('\n')) {
    const l = brut.trim(); if (!l) continue;
    if (l.startsWith('#')) { const m = /^#\s+([^.:|]{2,40})$/.exec(l); if (m && !/^(Catalogue|Une ligne|Après)/.test(m[1])) { rayon = {id: slug(m[1]), nom: m[1].trim()}; rayons.push(rayon); } continue; }
    const c = l.split('|').map((x) => x.trim()); if (c.length < 4 || !rayon) throw new Error('Ligne illisible : ' + l);
    const top = c[0].startsWith('*'), nom = c[0].replace(/^\*/, ''), [u, pp] = c[1].split('/');
    const a = {id: slug(nom), nom, r: rayon.id, u, q: +c[2], p: +c[3]};
    if (pp) a.pp = +pp; if (top) a.top = 1; if (c[4]) a.k = c[4]; if (c[5]) a.m = c[5].split(';').map((x) => x.trim()).filter(Boolean);
    a.photo = c[6] || nom;
    if (!a.id || !isFinite(a.q) || !isFinite(a.p)) throw new Error('Article invalide : ' + l);
    if (articles.some((x) => x.id === a.id)) throw new Error('Doublon : ' + a.id);
    articles.push(a);
  }
  return {rayons, articles};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {rayons, articles} = lire(), img = path.join(WEB, 'img'); let sans = 0;
  const out = articles.map((a) => { const {photo, ...x} = a; if (fs.existsSync(path.join(img, a.id + '.webp'))) x.i = 1; else sans++; return x; });
  rayons.push({id: 'divers', nom: 'Divers'});
  const corps = JSON.stringify({v: new Date().toISOString().slice(0, 10), rayons, articles: out});
  fs.writeFileSync(path.join(WEB, 'catalogue.json'), corps);
  console.log(articles.length + ' articles, ' + rayons.length + ' rayons, ' + sans + ' sans photo, ' + Math.round(corps.length / 1024) + ' Ko');
}
