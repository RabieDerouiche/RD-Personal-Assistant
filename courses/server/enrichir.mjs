/* Panier — ce qui alimente le catalogue tout seul, sans Claude ni bot : photo, prix et rayon d'un article ou d'une marque inconnus.
   Sources libres et gratuites, sans clé : Open Food Facts (produits de marque, photos d'emballage), Open Prices (prix relevés en magasin),
   Wikipédia et Wikimedia Commons (photos de produits bruts). Node 22, aucune dépendance. Les adresses se remplacent pour le banc (PANIER_*). */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const plat = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').toLowerCase();
export const slug = (s) => plat(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'au', 'aux', 'en', 'et', 'a', 'd', 'l', 'pour', 'sans', 'avec', 'the', 'of']);
/* mots utiles d'un nom, sans accent ni pluriel : « Pommes de terre » → pomme, terre */
export const mots = (s) => plat(s).split(/[^a-z0-9]+/).filter((m) => m.length > 1 && !VIDES.has(m)).map((m) => (m.length > 3 ? m.replace(/(s|x)$/, '') : m));

/* rayon d'après les catégories Open Food Facts (du plus précis au plus large) */
const RAYON_OFF = [
  [/baby|bebe|infant/, 'bebe'], [/frozen|surgele/, 'surgeles'], [/pet-food|cat-food|dog-food/, 'animaux'],
  [/cheese|fromage/, 'fromages'], [/fish|seafood|poisson/, 'poissonnerie'],
  [/hams|sausages|charcuter|prepared-meats|cured/, 'charcuterie-et-traiteur'], [/meats|poultr|viande/, 'boucherie-et-volaille'],
  [/dairies|dairy|milk|yogurt|egg|cream|butter/, 'cremerie-et-oeufs'], [/bread|viennoiser|pain/, 'boulangerie'],
  [/beverage|drink|water|juice|soda|boisson/, 'boissons'],
  [/biscuit|chocolat|sweet|candy|confection|jam|honey|breakfast|cereal|dessert|sugar|coffee|tea|spread|snacks-sucre/, 'epicerie-sucree'],
  [/fruits?$|fresh-fruits/, 'fruits'], [/vegetables?$|fresh-vegetables/, 'legumes'],
  [/sauce|condiment|pasta|rice|canned|oil|spice|salt|soup|snack|legume|grocer|meal|plant-based/, 'epicerie-salee'],
];

export function createEnrichir(opts = {}) {
  const env = opts.env || process.env;
  const SRC = {
    off: env.PANIER_OFF_SEARCH || 'https://search.openfoodfacts.org/search',
    prix: env.PANIER_OFF_PRIX || 'https://prices.openfoodfacts.org/api/v1/prices',
    wiki: env.PANIER_WIKI || 'https://fr.wikipedia.org/w/api.php',
    commons: env.PANIER_COMMONS || 'https://commons.wikimedia.org/w/api.php',
  };
  /* seuls ces sites peuvent fournir une image (le serveur ne télécharge jamais une adresse quelconque) */
  const HOTES = (env.PANIER_IMG_HOTES || 'images.openfoodfacts.org,static.openfoodfacts.org,upload.wikimedia.org,thumb.wikimedia.org').split(',').map((s) => s.trim()).filter(Boolean);
  const HTTP_OK = env.PANIER_IMG_HTTP === '1';   /* banc seulement : sources locales en http */
  const UA = 'Panier/1.0 (application familiale de liste de courses' + (env.PANIER_CONTACT ? '; ' + env.PANIER_CONTACT : '') + ')';
  const dir = opts.dir, rayonsMots = opts.rayonsMots || new Map(), DELAI = +(env.PANIER_DELAI_MS || 7000);
  if (dir) fs.mkdirSync(dir, {recursive: true, mode: 0o700});

  async function getJson(url) {
    const r = await fetch(url, {headers: {'user-agent': UA, accept: 'application/json'}, signal: AbortSignal.timeout(DELAI)});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  const sain = (s, n) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 120);
  const hoteOk = (u) => { try { const x = new URL(u); return (x.protocol === 'https:' || (HTTP_OK && x.protocol === 'http:')) && HOTES.includes(x.host); } catch (e) { return false; } };

  /* Open Food Facts : les produits qui collent au nom (et à la marque), le plus scanné d'abord */
  async function produits(nom, marque) {
    const q = (nom + ' ' + (marque || '')).trim();
    const j = await getJson(SRC.off + '?' + new URLSearchParams({q, langs: 'fr', page_size: '24', fields: 'code,product_name,product_name_fr,brands,image_front_url,unique_scans_n,categories_tags,quantity,countries_tags'}));
    const mq = mots(nom), mm = mots(marque);
    return (j.hits || []).map((h) => {
      const marques = [].concat(h.brands || []).join(', '), titre = h.product_name_fr || h.product_name || '', t = new Set(mots(titre + ' ' + marques)), tm = new Set(mots(marques));
      const img = h.image_front_url || '', n = mq.filter((m) => t.has(m)).length, nm = mm.filter((m) => tm.has(m) || t.has(m)).length;
      let score = (mq.length ? n / mq.length : 0) * 4 + Math.min(3, Math.log10(1 + (h.unique_scans_n || 0)));
      if (mm.length) score += nm === mm.length ? 5 : nm ? 1 : -3;
      if ((h.countries_tags || []).includes('en:france')) score += 1.5;
      return {code: String(h.code || ''), nom: sain(titre, 80), marque: sain(marques, 60), img, quantite: sain(h.quantity, 30), cats: h.categories_tags || [], score, tout: n === mq.length, marqueOk: !mm.length || nm === mm.length};
    }).filter((p) => p.img && hoteOk(p.img) && p.score > 2).sort((a, b) => b.score - a.score);
  }
  /* Open Prices : prix médian des derniers relevés en euros */
  async function prix(code) {
    if (!/^\d{6,14}$/.test(code)) return null;
    const j = await getJson(SRC.prix + '?' + new URLSearchParams({product_code: code, currency: 'EUR', order_by: '-date', size: '15'}));
    const v = (j.items || []).filter((x) => x.currency === 'EUR' && x.price > 0 && x.price < 500 && !x.price_is_discounted).map((x) => +x.price).sort((a, b) => a - b);
    if (!v.length) return null;
    return Math.round((v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) * 100) / 100;
  }
  /* Wikipédia : la photo de l'article qui porte ce nom */
  async function wiki(nom) {
    const j = await getJson(SRC.wiki + '?' + new URLSearchParams({action: 'query', format: 'json', generator: 'search', gsrsearch: nom, gsrlimit: '4', prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '500', redirects: '1'}));
    const mq = mots(nom);
    return Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index).filter((p) => p.thumbnail && p.thumbnail.source && !/\.svg/i.test(p.pageimage || '')).map((p) => {
      const t = new Set(mots(p.title)), n = mq.filter((m) => t.has(m)).length;
      return {url: p.thumbnail.source.split('?')[0], src: 'wiki', titre: sain(p.title, 80), credit: 'Wikimedia Commons', page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(p.pageimage || ''), proche: mq.length > 0 && n === mq.length && t.size <= mq.length};
    }).filter((c) => hoteOk(c.url));
  }
  /* Wikimedia Commons : d'autres photos libres, pour le choix à la main */
  async function commons(nom) {
    const j = await getJson(SRC.commons + '?' + new URLSearchParams({action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrsearch: nom + ' filetype:bitmap', gsrlimit: '10', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '500', iiextmetadatafilter: 'Artist|LicenseShortName'}));
    return Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index).map((p) => { const i = (p.imageinfo || [])[0] || {}, m = i.extmetadata || {};
      return {url: String(i.thumburl || '').split('?')[0], src: 'commons', titre: sain(p.title, 80).replace(/^File:/, ''), credit: sain(m.Artist && m.Artist.value, 60) + ' · ' + sain(m.LicenseShortName && m.LicenseShortName.value, 30), page: i.descriptionurl || '', w: i.width, h: i.height, mime: i.mime}; })
      .filter((c) => /jpeg|png|webp/.test(c.mime || '') && c.w >= 400 && c.w / c.h > 0.5 && c.w / c.h < 2.2 && hoteOk(c.url)).map(({w, h, mime, ...c}) => c);
  }
  const calme = (p) => p.catch(() => []);
  /* toutes les photos possibles, pour « Changer la photo » */
  async function candidates(nom, marque) {
    const [p, w, c] = await Promise.all([calme(produits(nom, marque)), calme(wiki(nom)), calme(commons(nom))]);
    const off = p.slice(0, 6).map((x) => ({url: x.img, src: 'off', titre: [x.nom, x.marque, x.quantite].filter(Boolean).join(' · '), credit: 'Open Food Facts · CC BY-SA', page: 'https://fr.openfoodfacts.org/produit/' + x.code, code: x.code}));
    const tout = marque ? off.concat(w, c) : w.filter((x) => x.proche).concat(off, w.filter((x) => !x.proche), c);
    const vus = new Set(); return tout.filter((x) => !vus.has(x.url) && vus.add(x.url)).slice(0, 12);
  }
  function rayon(cats, nom) {
    for (const tag of [...(cats || [])].reverse()) { for (const [re, r] of RAYON_OFF) if (re.test(tag)) return r; }
    const votes = {}; for (const m of mots(nom)) { const r = rayonsMots.get(m); if (r) votes[r] = (votes[r] || 0) + 1; }
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
  }
  /* télécharge une image d'un site autorisé dans le dossier des photos apprises ; renvoie son nom de fichier */
  async function telecharge(url) {
    if (!hoteOk(url)) throw new Error('Site non autorisé');
    const r = await fetch(url, {headers: {'user-agent': UA}, redirect: 'error', signal: AbortSignal.timeout(DELAI * 2)});
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) throw new Error('Image refusée');
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 800 || b.length > 900000) throw new Error('Taille refusée');
    return ecris(b, type);
  }
  function ecris(b, type) {
    const nom = crypto.createHash('sha256').update(b).digest('hex').slice(0, 20) + ({'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'})[type];
    fs.writeFileSync(path.join(dir, nom), b, {mode: 0o600}); return nom;
  }
  /* photo prise ou choisie sur le téléphone (déjà réduite par l'app) : data:image/jpeg;base64,… */
  function depuisData(data) {
    const m = /^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ''));
    if (!m) throw new Error('Photo illisible');
    const b = Buffer.from(m[2], 'base64'), sig = b.subarray(0, 12).toString('latin1');
    const ok = (m[1] === 'image/jpeg' && b[0] === 0xff && b[1] === 0xd8) || (m[1] === 'image/png' && sig.startsWith('\x89PNG')) || (m[1] === 'image/webp' && sig.startsWith('RIFF') && sig.endsWith('WEBP'));
    if (!ok || b.length < 500 || b.length > 600000) throw new Error('Photo refusée');
    return ecris(b, m[1]);
  }
  /* article ou marque inconnus : la meilleure photo, le prix s'il existe, le rayon probable */
  async function enrichis(nom, marque) {
    const out = {};
    const [p, w] = await Promise.all([calme(produits(nom, marque)), marque ? Promise.resolve([]) : calme(wiki(nom))]);
    const proche = w.find((x) => x.proche), prod = p.find((x) => x.marqueOk && (x.tout || marque)) || null;
    const choix = marque ? prod : (proche || prod || w[0] || null);
    if (prod) { out.code = prod.code; out.produit = [prod.nom, prod.quantite].filter(Boolean).join(' · '); out.cats = prod.cats;
      if (!marque && prod.marque && choix === prod) out.marqueTrouvee = prod.marque.split(',')[0].trim(); }
    if (choix) {
      const estProd = choix === prod;
      try { out.img = await telecharge(estProd ? choix.img : choix.url);
        out.src = estProd ? {t: 'off', credit: 'Open Food Facts · CC BY-SA', page: 'https://fr.openfoodfacts.org/produit/' + prod.code} : {t: choix.src, credit: choix.credit, page: choix.page}; } catch (e) { /* pas de photo : l'app garde son illustration */ }
    }
    if (prod && (marque || choix === prod)) { try { const v = await prix(prod.code); if (v) out.p = v; } catch (e) { /* pas de prix relevé */ } }
    const r = rayon(marque || choix === prod ? out.cats : null, nom); if (r) out.r = r;
    return out;
  }
  return {produits, prix, wiki, commons, candidates, rayon, telecharge, depuisData, enrichis, hoteOk};
}
