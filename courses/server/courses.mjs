/* Panier — le serveur de la liste de courses du foyer (Node 22, aucune dépendance, aucun appel à Claude ni à un bot).
   Monté dans le serveur JARVIS OS sous /courses/ (createCourses), ou seul : `node courses.mjs` (PORT, défaut 8790).
   Il garde les listes, synchronise les téléphones en direct (flux SSE), et alimente seul le catalogue (enrichir.mjs).
   `node courses.mjs code` : un code d'invitation de secours (si plus aucun appareil n'est relié). */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEnrichir, slug, mots} from './enrichir.mjs';

export const VERSION = '1.0.0';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};
const COULEURS = ['#1f8a5b', '#e0653a', '#3b6fd4', '#b2489c', '#c79a1b', '#2a9aa8'];
const MAGASINS = ['Grand Frais', 'Fresh', 'Boucherie', 'Auchan', 'Carrefour', 'Intermarché', 'Leclerc', 'Lidl', 'Marché'];
const UNITES = ['kg', 'g', 'L', 'cl', 'pièce', 'paquet', 'bouteille', 'boîte', 'pot', 'sachet', 'barquette', 'botte', 'lot', 'rouleau', 'tranche'];
const now = () => Date.now();
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const txt = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, min, max, def) => { const x = +String(v).replace(',', '.'); return isFinite(x) && x >= min && x <= max ? Math.round(x * 1000) / 1000 : def; };
const idOk = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(s);
const cleMarque = (a, m) => a + '|' + slug(m);

export function createCourses(opts = {}) {
  const env = opts.env || process.env;
  const DATA = opts.data || env.PANIER_DATA || path.join(os.homedir(), '.jarvis', 'courses');
  const WEB = opts.web || env.PANIER_WEB || path.join(HERE, '..', 'web');
  const BASE = opts.base == null ? '/courses' : opts.base;
  const log = opts.log || ((m) => console.log('[courses] ' + m));
  const FILE = path.join(DATA, 'etat.json'), IMG = path.join(DATA, 'img'), CODE = path.join(DATA, 'code.json');
  fs.mkdirSync(IMG, {recursive: true, mode: 0o700});

  /* ---------- catalogue de base (lu pour deviner le rayon d'un article inconnu) ---------- */
  let CAT = {rayons: [], articles: []};
  try { CAT = JSON.parse(fs.readFileSync(path.join(WEB, 'catalogue.json'), 'utf8')); } catch (e) { log('catalogue illisible : ' + e.message); }
  const BASE_ART = new Map(CAT.articles.map((a) => [a.id, a])), RAYONS = new Set(CAT.rayons.map((r) => r.id));
  const rayonsMots = new Map();
  { const votes = new Map();
    for (const a of CAT.articles) for (const m of new Set(mots(a.nom + ' ' + (a.k || '')))) { const v = votes.get(m) || {}; v[a.r] = (v[a.r] || 0) + 1; votes.set(m, v); }
    for (const [m, v] of votes) { const e = Object.entries(v).sort((a, b) => b[1] - a[1]); if (e.length === 1 || e[0][1] > e[1][1]) rayonsMots.set(m, e[0][0]); } }
  const E = createEnrichir({env, dir: IMG, rayonsMots});

  /* ---------- état ---------- */
  const vide = () => ({v: 1, rev: 1, foyer: {cree: 0, membres: []}, invitations: [], listes: [{id: 'courses', nom: 'Courses', icone: '🛒'}, {id: 'achats', nom: 'Achats', icone: '🛍️'}],
    lignes: {}, articles: {}, marques: {}, memo: {}, magasins: MAGASINS.slice(), ops: [], essais: {}, journal: []});
  let S = vide();
  try { if (fs.existsSync(FILE)) S = {...vide(), ...JSON.parse(fs.readFileSync(FILE, 'utf8'))}; } catch (e) {
    /* fichier abîmé : on le met de côté, jamais écrasé en silence */
    try { fs.renameSync(FILE, FILE + '.abime-' + now()); } catch (x) { /* rien */ } log('état illisible, mis de côté : ' + e.message); }
  let timer = null, dernierJour = '';
  function ecris() {
    timer = null;
    try { const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(S), {mode: 0o600}); fs.renameSync(tmp, FILE);
      /* une copie par jour, sept gardées : l'app se répare seule d'une mauvaise manipulation */
      const jour = new Date().toISOString().slice(0, 10);
      if (jour !== dernierJour) { dernierJour = jour; const d = path.join(DATA, 'copies'); fs.mkdirSync(d, {recursive: true, mode: 0o700}); const f = path.join(d, 'etat-' + jour + '.json');
        if (!fs.existsSync(f)) { fs.copyFileSync(FILE, f); for (const vieux of fs.readdirSync(d).filter((x) => /^etat-.*\.json$/.test(x)).sort().slice(0, -7)) fs.unlinkSync(path.join(d, vieux)); } }
    } catch (e) { log('écriture ratée : ' + e.message); }
  }
  const save = () => { if (!timer) timer = setTimeout(ecris, 250); };

  /* ---------- flux en direct ---------- */
  const flux = new Set();
  function diffuse(info) { const m = 'event: rev\ndata: ' + JSON.stringify({rev: S.rev, ...info}) + '\n\n'; for (const c of flux) { try { c.res.write(m); } catch (e) { flux.delete(c); } } }
  const coeur = setInterval(() => { for (const c of flux) { try { c.res.write(': .\n\n'); } catch (e) { flux.delete(c); } } }, 25000); coeur.unref();
  function change(info) { S.rev++; save(); diffuse(info || {}); }

  /* ---------- foyer, appareils, invitations ---------- */
  const echecs = [];   /* codes faux : au-delà de 12 en une heure, plus aucun essai */
  const bloque = () => { const t = now() - 3600000; while (echecs.length && echecs[0] < t) echecs.shift(); return echecs.length >= 12; };
  function jeton(req) {
    const h = req.headers.authorization || ''; if (h.startsWith('Bearer ')) return h.slice(7).trim();
    const c = /(?:^|;\s*)panier=([A-Za-z0-9_-]{20,})/.exec(req.headers.cookie || ''); return c ? c[1] : '';
  }
  function membreDe(req, url) {
    const t = jeton(req) || (url && url.searchParams.get('jeton')) || ''; if (!t) return null; const h = sha(t);
    for (const m of S.foyer.membres) { const a = (m.appareils || []).find((x) => x.h === h); if (a) { if (now() - (a.vu || 0) > 3600000) { a.vu = now(); save(); } return m; } }
    return null;
  }
  function ouvre(req, res, prenom) {
    prenom = txt(prenom, 24) || 'Moi';
    let m = S.foyer.membres.find((x) => x.prenom.toLowerCase() === prenom.toLowerCase());
    if (!m) { m = {id: 'm' + crypto.randomBytes(4).toString('hex'), prenom, couleur: COULEURS[S.foyer.membres.length % COULEURS.length], appareils: [], cree: now()}; S.foyer.membres.push(m); }
    const t = crypto.randomBytes(24).toString('base64url');
    m.appareils.push({h: sha(t), cree: now(), vu: now(), nom: txt(req.headers['user-agent'], 200).replace(/.*\((iPhone|iPad|Macintosh|Android|Windows|Linux)[^)]*\).*/, '$1').slice(0, 20)});
    if (m.appareils.length > 8) m.appareils = m.appareils.slice(-8);
    cookie(req, res, t); return {jeton: t, moi: {id: m.id, prenom: m.prenom}};
  }
  function cookie(req, res, t) {
    const https = (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https' || (req.socket && req.socket.encrypted);
    res.setHeader('set-cookie', 'panier=' + t + '; Path=' + (BASE || '/') + '; Max-Age=' + (t ? 34560000 : 0) + '; HttpOnly; SameSite=Lax' + (https ? '; Secure' : ''));
  }
  function inviter() {
    S.invitations = S.invitations.filter((i) => i.expire > now() && i.reste > 0);
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); S.invitations.push({h: sha(code), expire: now() + 3600000, reste: 4}); save();
    return {code, expire: now() + 3600000};
  }
  function codeBon(code) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return false; const h = sha(code);
    const i = S.invitations.find((x) => x.h === h && x.expire > now() && x.reste > 0); if (i) { i.reste--; return true; }
    /* code de secours posé par `node courses.mjs code` */
    try { const c = JSON.parse(fs.readFileSync(CODE, 'utf8')); if (c.h === h && c.expire > now()) { fs.unlinkSync(CODE); return true; } } catch (e) { /* aucun */ }
    return false;
  }

  /* ---------- alimentation automatique : photo, prix, rayon ---------- */
  const file = []; let occupe = false;
  function aEnrichir(cle, nom, marque) {
    const vu = S.essais[cle]; if (vu && now() - vu < 7 * 86400000) return;
    if (file.some((f) => f.cle === cle)) return;
    S.essais[cle] = now(); file.push({cle, nom, marque}); tourne();
  }
  async function tourne() {
    if (occupe) return; occupe = true;
    while (file.length) {
      const f = file.shift();
      try {
        const r = await E.enrichis(f.nom, f.marque), [aid] = f.cle.split('|');
        if (f.marque) {
          if (r.img || r.p) { S.marques[f.cle] = {...(S.marques[f.cle] || {}), ...(r.img ? {img: r.img, src: r.src} : {}), ...(r.p ? {p: r.p} : {}), marque: f.marque, code: r.code, nom: r.produit, le: now()}; change({quoi: 'photo'}); }
        } else {
          const a = S.articles[aid]; if (a) {
            if (r.img && !a.img) { a.img = r.img; a.src = r.src; }
            if (r.p && !a.pFixe) a.p = r.p;
            if (r.r && RAYONS.has(r.r) && !a.rFixe) a.r = r.r;
            if (r.code) a.code = r.code; if (r.produit) a.produit = r.produit;
            a.pret = 1; change({quoi: 'photo'});
          }
        }
      } catch (e) { log('enrichissement raté (' + f.cle + ') : ' + e.message); }
    }
    occupe = false;
  }

  /* ---------- opérations (rejouables : une opération déjà vue, reconnue à son oid, est ignorée) ---------- */
  const article = (id) => S.articles[id] || BASE_ART.get(id) || null;
  function ligneSaine(l, m) {
    if (!l || !idOk(l.id) || !S.listes.some((x) => x.id === l.l)) return null;
    const a = l.a && idOk(l.a) ? article(l.a) : null, nom = txt(l.nom, 60) || (a && a.nom);
    if (!nom) return null;
    return {id: l.id, l: l.l, a: a ? l.a : null, nom, m: txt(l.m, 40), q: num(l.q, 0.001, 9999, 1), u: UNITES.includes(l.u) ? l.u : ((a && a.u) || 'pièce'), note: txt(l.note, 140), mag: txt(l.mag, 30), par: m.id, le: now(), c: 0};
  }
  function souvenir(l) { if (!l.a) return; const s = S.memo[l.a] || (S.memo[l.a] = {n: 0}); s.m = l.m || ''; s.mag = l.mag || ''; s.q = l.q; s.u = l.u; s.le = now(); }
  function applique(op, m) {
    const t = op.t;
    if (t === 'ligne.ajoute') {
      const l = ligneSaine(op.ligne, m); if (!l) return 'ligne refusée';
      if (S.lignes[l.id]) return null;
      const meme = Object.values(S.lignes).find((x) => x.l === l.l && !x.c && x.a && x.a === l.a && slug(x.m) === slug(l.m) && x.u === l.u);
      if (meme) { meme.q = num(meme.q + l.q, 0.001, 9999, meme.q); meme.le = now(); if (l.note && !meme.note) meme.note = l.note; souvenir(meme); return {resume: m.prenom + ' a ajouté ' + l.nom}; }
      if (Object.keys(S.lignes).length >= 600) return 'liste pleine';
      S.lignes[l.id] = l; souvenir(l);
      if (l.a && l.m && !S.marques[cleMarque(l.a, l.m)]) aEnrichir(cleMarque(l.a, l.m), l.nom, l.m);
      return {resume: m.prenom + ' a ajouté ' + l.nom};
    }
    if (t === 'ligne.modifie') {
      const l = S.lignes[op.id], c = op.champs || {}; if (!l) return null;
      if ('q' in c) l.q = num(c.q, 0.001, 9999, l.q);
      if ('u' in c && UNITES.includes(c.u)) l.u = c.u;
      if ('m' in c) l.m = txt(c.m, 40);
      if ('note' in c) l.note = txt(c.note, 140);
      if ('mag' in c) l.mag = txt(c.mag, 30);
      if ('nom' in c && !l.a) l.nom = txt(c.nom, 60) || l.nom;
      if ('p' in c) { const p = c.p === null || c.p === '' ? null : num(c.p, 0, 9999, null); if (p == null) delete l.p; else l.p = p; }
      l.le = now(); souvenir(l);
      if (l.a && l.m && !S.marques[cleMarque(l.a, l.m)]) aEnrichir(cleMarque(l.a, l.m), l.nom, l.m);
      return {};
    }
    if (t === 'ligne.coche') { const l = S.lignes[op.id]; if (!l) return null; l.c = op.coche ? {par: m.id, le: now()} : 0; return {resume: op.coche ? m.prenom + ' a pris ' + l.nom : ''}; }
    if (t === 'ligne.supprime') { const l = S.lignes[op.id]; if (!l) return null; delete S.lignes[op.id]; return {resume: m.prenom + ' a retiré ' + l.nom}; }
    if (t === 'liste.termine') {
      const pris = Object.values(S.lignes).filter((x) => x.l === op.liste && x.c); if (!pris.length) return null;
      for (const l of pris) { if (l.a) { const s = S.memo[l.a] || (S.memo[l.a] = {n: 0}); s.n = (s.n || 0) + 1; s.achat = now(); } delete S.lignes[l.id]; }
      S.journal.push({le: now(), par: m.id, liste: op.liste, n: pris.length, total: num(op.total, 0, 99999, 0)}); if (S.journal.length > 200) S.journal = S.journal.slice(-200);
      return {resume: m.prenom + ' a terminé les courses (' + pris.length + ')'};
    }
    if (t === 'liste.decoche') { for (const l of Object.values(S.lignes)) if (l.l === op.liste && l.c) l.c = 0; return {}; }
    if (t === 'liste.cree') { const id = op.id, nom = txt(op.nom, 30); if (!idOk(id) || !nom || S.listes.some((x) => x.id === id) || S.listes.length >= 12) return null; S.listes.push({id, nom, icone: txt(op.icone, 4) || '📝'}); return {resume: m.prenom + ' a créé la liste ' + nom}; }
    if (t === 'liste.renomme') { const l = S.listes.find((x) => x.id === op.id), nom = txt(op.nom, 30); if (!l || !nom) return null; l.nom = nom; if (op.icone) l.icone = txt(op.icone, 4); return {}; }
    if (t === 'liste.supprime') { if (S.listes.length < 2 || !S.listes.some((x) => x.id === op.id)) return null; S.listes = S.listes.filter((x) => x.id !== op.id); for (const l of Object.values(S.lignes)) if (l.l === op.id) delete S.lignes[l.id]; return {}; }
    if (t === 'article.cree') {
      const a = op.article || {}, nom = txt(a.nom, 60); if (!idOk(a.id) || !a.id.startsWith('x-') || !nom) return 'article refusé';
      if (!S.articles[a.id]) { if (Object.keys(S.articles).length >= 3000) return 'catalogue plein';
        S.articles[a.id] = {perso: 1, id: a.id, nom, r: RAYONS.has(a.r) ? a.r : (E.rayon(null, nom) || 'divers'), u: UNITES.includes(a.u) ? a.u : 'pièce', q: num(a.q, 0.001, 9999, 1), par: m.id, le: now()};
        aEnrichir(a.id, nom, ''); }
      return {};
    }
    if (t === 'article.modifie') {
      const c = op.champs || {}, base = BASE_ART.get(op.id); let a = S.articles[op.id];
      if (!a && !base) return null; if (!a) a = S.articles[op.id] = {};
      if ('p' in c) { const p = c.p === null || c.p === '' ? null : num(c.p, 0, 9999, null); if (p == null) { delete a.p; delete a.pFixe; } else { a.p = p; a.pFixe = 1; } }
      if ('r' in c && RAYONS.has(c.r)) { a.r = c.r; a.rFixe = 1; }
      if ('nom' in c && a.perso) a.nom = txt(c.nom, 60) || a.nom;
      if ('u' in c && UNITES.includes(c.u) && a.perso) a.u = c.u;
      if (c.img === null) { delete a.img; delete a.src; }
      if (op.marque && 'pm' in c) { const k = cleMarque(op.id, op.marque), v = S.marques[k] || (S.marques[k] = {marque: txt(op.marque, 40)}); const p = c.pm === null ? null : num(c.pm, 0, 9999, null); if (p == null) delete v.p; else { v.p = p; v.pFixe = 1; } }
      return {};
    }
    if (t === 'article.supprime') { const a = S.articles[op.id]; if (!a || !a.perso) return null; if (Object.values(S.lignes).some((l) => l.a === op.id)) return null; delete S.articles[op.id]; delete S.memo[op.id]; return {}; }
    if (t === 'magasin.ajoute') { const n = txt(op.nom, 30); if (!n || S.magasins.some((x) => x.toLowerCase() === n.toLowerCase()) || S.magasins.length >= 30) return null; S.magasins.push(n); return {}; }
    if (t === 'magasin.retire') { if (!S.magasins.includes(op.nom)) return null; S.magasins = S.magasins.filter((x) => x !== op.nom); return {}; }
    return 'opération inconnue';
  }
  function etat(m) {
    return {rev: S.rev, version: VERSION, moi: {id: m.id, prenom: m.prenom}, membres: S.foyer.membres.map((x) => ({id: x.id, prenom: x.prenom, couleur: x.couleur, appareils: (x.appareils || []).length})),
      listes: S.listes, lignes: Object.values(S.lignes), articles: S.articles, marques: S.marques, memo: S.memo, magasins: S.magasins, journal: S.journal.slice(-12)};
  }

  /* ---------- HTTP ---------- */
  const json = (res, st, o) => { res.writeHead(st, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); res.end(JSON.stringify(o)); };
  function corps(req, max) {
    return new Promise((ok, ko) => { let n = 0; const b = [];
      /* trop gros : on cesse de garder, on laisse finir l'envoi pour pouvoir répondre 413 (coupé net au-delà de 5 Mo) */
      req.on('data', (d) => { n += d.length; if (n > 5e6) { ko(new Error('trop gros')); req.destroy(); } else if (n <= max) b.push(d); });
      req.on('end', () => { if (n > max) return ko(new Error('trop gros')); try { ok(b.length ? JSON.parse(Buffer.concat(b).toString('utf8')) : {}); } catch (e) { ko(new Error('JSON illisible')); } });
      req.on('error', ko); });
  }
  function statique(res, racine, rel, cache) {
    let f = path.normalize(path.join(racine, rel)); if (!f.startsWith(path.normalize(racine) + path.sep) && f !== path.normalize(racine)) { res.writeHead(403); res.end(); return; }
    if (rel.endsWith('/') || rel === '') f = path.join(f, 'index.html');
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404, {'content-type': 'text/plain; charset=utf-8'}); res.end('Introuvable.'); return; }
      res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': cache || (/\.(webp|png|jpg|svg)$/.test(f) ? 'public, max-age=2592000' : 'no-cache'), 'x-content-type-options': 'nosniff'}); res.end(d); });
  }

  async function api(req, res, url, p) {
    const post = req.method === 'POST';
    /* une écriture vient forcément de l'app (JSON) : un formulaire d'un autre site est refusé */
    if (post && !/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, {erreur: 'JSON attendu.'});
    if (p === '/api/sante') return json(res, 200, {ok: true, version: VERSION, foyer: S.foyer.membres.length > 0, catalogue: CAT.articles.length});
    if (p === '/api/foyer/creer' && post) {
      if (S.foyer.membres.length) return json(res, 409, {erreur: 'Le foyer existe déjà : demande un code d\'invitation.'});
      const b = await corps(req, 2000); S.foyer.cree = now(); const r = ouvre(req, res, b.prenom); change({}); log('foyer créé'); return json(res, 200, r);
    }
    if (p === '/api/foyer/rejoindre' && post) {
      if (bloque()) return json(res, 429, {erreur: 'Trop d\'essais : réessaie dans une heure.'});
      const b = await corps(req, 2000);
      if (!codeBon(b.code)) { echecs.push(now()); return json(res, 403, {erreur: 'Code inconnu ou expiré.'}); }
      const r = ouvre(req, res, b.prenom); change({resume: r.moi.prenom + ' a rejoint la liste'}); return json(res, 200, r);
    }
    const m = membreDe(req, url);
    if (!m) return json(res, 401, {erreur: 'Appareil non relié.', foyer: S.foyer.membres.length > 0});
    if (p === '/api/etat') { const t = jeton(req); if (t && !/panier=/.test(req.headers.cookie || '')) cookie(req, res, t); return json(res, 200, etat(m)); }
    if (p === '/api/flux') {
      res.writeHead(200, {'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no', connection: 'keep-alive'});
      res.write('retry: 4000\nevent: rev\ndata: ' + JSON.stringify({rev: S.rev}) + '\n\n');
      const c = {res, m: m.id}; flux.add(c); req.on('close', () => flux.delete(c)); return;
    }
    if (p === '/api/ops' && post) {
      const b = await corps(req, 200000), ops = Array.isArray(b.ops) ? b.ops.slice(0, 300) : [], refus = []; let n = 0, resume = '';
      for (const op of ops) {
        /* oid : l'identifiant de l'opération elle-même (id désigne la ligne, la liste ou l'article visé) */
        if (!op || !idOk(String(op.oid || ''))) { refus.push({oid: op && op.oid, raison: 'identifiant'}); continue; }
        if (S.ops.includes(op.oid)) continue;
        const r = applique(op, m); S.ops.push(op.oid);
        if (typeof r === 'string') refus.push({oid: op.oid, raison: r}); else if (r) { n++; if (r.resume) resume = r.resume; }
      }
      if (S.ops.length > 800) S.ops = S.ops.slice(-600);
      if (n) change({par: m.id, resume: n > 1 && resume ? resume + ' (+' + (n - 1) + ')' : resume}); else save();
      return json(res, 200, {rev: S.rev, refus, etat: etat(m)});
    }
    if (p === '/api/foyer/inviter' && post) return json(res, 200, inviter());
    if (p === '/api/foyer/prenom' && post) { const b = await corps(req, 2000), n = txt(b.prenom, 24); if (!n) return json(res, 400, {erreur: 'Prénom vide.'}); m.prenom = n; change({}); return json(res, 200, {ok: true}); }
    if (p === '/api/foyer/retirer' && post) {
      const b = await corps(req, 2000), x = S.foyer.membres.find((y) => y.id === b.id); if (!x) return json(res, 404, {erreur: 'Inconnu.'});
      if (x.id === m.id) { const h = sha(jeton(req)); x.appareils = x.appareils.filter((a) => a.h !== h); cookie(req, res, ''); } else x.appareils = [];
      if (!x.appareils.length && S.foyer.membres.length > 1) S.foyer.membres = S.foyer.membres.filter((y) => y.id !== x.id);
      change({}); return json(res, 200, {ok: true});
    }
    if (p === '/api/photos') { const nom = txt(url.searchParams.get('nom'), 60), marque = txt(url.searchParams.get('marque'), 40); if (!nom) return json(res, 400, {erreur: 'Nom vide.'}); return json(res, 200, {photos: await E.candidates(nom, marque)}); }
    if (p === '/api/photo' && post) {
      const b = await corps(req, 900000), id = String(b.article || ''), base = BASE_ART.get(id); let a = S.articles[id];
      if (!a && !base) return json(res, 404, {erreur: 'Article inconnu.'});
      let img; try { img = b.data ? E.depuisData(b.data) : await E.telecharge(String(b.url || '')); } catch (e) { return json(res, 400, {erreur: 'Photo refusée : ' + e.message + '.'}); }
      const src = b.data ? {t: 'perso'} : {t: txt(b.src, 10) || 'web', credit: txt(b.credit, 90), page: /^https:\/\//.test(b.page || '') ? txt(b.page, 300) : ''};
      const marque = txt(b.marque, 40);
      if (marque) { const k = cleMarque(id, marque); S.marques[k] = {...(S.marques[k] || {}), marque, img, src, le: now()}; } else { if (!a) a = S.articles[id] = {}; a.img = img; a.src = src; }
      change({quoi: 'photo'}); return json(res, 200, {ok: true, img});
    }
    return json(res, 404, {erreur: 'Inconnu.'});
  }

  /* point d'entrée : renvoie true si la requête était pour Panier */
  async function handle(req, res, url) {
    url = url || new URL(req.url, 'http://x'); let p = url.pathname;
    if (BASE) { if (p === BASE) { res.writeHead(301, {location: BASE + '/' + url.search}); res.end(); return true; } if (!p.startsWith(BASE + '/')) return false; p = p.slice(BASE.length); }
    try {
      if (p.startsWith('/api/img/')) { const n = p.slice(9); if (!/^[a-f0-9]{20}\.(jpg|png|webp)$/.test(n)) { res.writeHead(404); res.end(); return true; } statique(res, IMG, n, 'public, max-age=31536000, immutable'); return true; }
      if (p.startsWith('/api/')) { await api(req, res, url, p); return true; }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return true; }
      let rel; try { rel = decodeURIComponent(p); } catch (e) { rel = '/'; }
      if (rel.split('/').includes('..')) { res.writeHead(403); res.end(); return true; }
      statique(res, WEB, rel.replace(/^\//, ''));
    } catch (e) { log('erreur : ' + e.message); if (!res.headersSent) json(res, e.message === 'trop gros' ? 413 : e.message === 'JSON illisible' ? 400 : 500, {erreur: 'Erreur du serveur.'}); else res.end(); }
    return true;
  }
  function close() { clearInterval(coeur); if (timer) { clearTimeout(timer); ecris(); } for (const c of flux) { try { c.res.end(); } catch (e) { /* rien */ } } flux.clear(); }
  return {handle, close, version: VERSION, _etat: () => S};
}

/* ---------- seul, hors de JARVIS OS ---------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const DATA = process.env.PANIER_DATA || path.join(os.homedir(), '.jarvis', 'courses');
  if (process.argv[2] === 'code') {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); fs.mkdirSync(DATA, {recursive: true, mode: 0o700});
    fs.writeFileSync(path.join(DATA, 'code.json'), JSON.stringify({h: sha(code), expire: Date.now() + 1800000}), {mode: 0o600});
    console.log('Code d\'invitation de secours : ' + code + ' (30 minutes, un seul appareil)');
  } else {
    const C = createCourses({data: DATA}), PORT = +(process.env.PORT || 8790), HOST = process.env.HOST || '127.0.0.1';
    const srv = http.createServer(async (req, res) => { const u = new URL(req.url, 'http://x'); if (u.pathname === '/') { res.writeHead(302, {location: '/courses/'}); res.end(); return; } if (!(await C.handle(req, res, u))) { res.writeHead(404); res.end(); } });
    srv.listen(PORT, HOST, () => console.log('Panier ' + VERSION + ' sur http://' + HOST + ':' + PORT + '/courses/'));
    for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { C.close(); process.exit(0); });
  }
}
