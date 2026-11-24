/* Banc 0.73.0, lot B3 : le pont de la page (essais/jarvis-os-maquette/jarvis-serveur.js) et son service worker (sw.js), exécutés hors navigateur
   avec un faux fetch, un faux stockage et un faux « self ». Lancer : node jarvis-os/server/tests/fiab-b3.test.mjs (aucun réseau, aucun coût).
   Textes et montants inventés. */
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), APP = path.join(HERE, '..', '..', '..', 'essais', 'jarvis-os-maquette');
const PONT = fs.readFileSync(path.join(APP, 'jarvis-serveur.js'), 'utf8'), SW = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
const results = []; let fails = 0;
const ok = (name, cond, info) => { results.push((cond ? 'OK   ' : 'ÉCHEC') + ' ' + name + (info ? ' :: ' + info : '')); if (!cond) fails++; };
const tente = async (f) => { try { return {v: await f()}; } catch (e) { return {e}; } };

/* ---------- le pont, avec un fetch qu'on choisit ---------- */
function pont(fetchImpl, relie = true) {
  const store = {'jarvis.settings': JSON.stringify(relie ? {serverToken: 'jeton-essai'} : {})}, appels = [];
  const ctx = {location: {origin: 'https://jarvis.essai'}, localStorage: {getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; }},
    fetch: (u, o) => { appels.push({u: String(u), o}); return fetchImpl(String(u), o); }, TextDecoder, TextEncoder, setTimeout, clearTimeout, setInterval, clearInterval, URL, console};
  ctx.window = ctx; vm.runInNewContext(PONT, ctx); return {w: ctx, appels, store};
}
const rep = (status, corps) => Promise.resolve({status, ok: status >= 200 && status < 300, json: async () => { if (corps === undefined) throw new Error('corps vide'); return corps; }});
const coupe = () => Promise.reject(new TypeError('Load failed'));
const sse = (evts) => { const enc = new TextEncoder(), parts = evts.map(([e, d]) => enc.encode('event: ' + e + '\ndata: ' + JSON.stringify(d) + '\n\n')); let i = 0;
  return Promise.resolve({status: 200, body: {getReader: () => ({read: async () => (i < parts.length ? {value: parts[i++], done: false} : {done: true})})}}); };

try {
  /* pont-sw-voix#1 : une réponse qui n'est pas 200 n'est jamais un succès */
  { const m = await pont(() => rep(502)).w.claude.use('mcp'); const r = await tente(() => m.callTool('Google Sheets', 'append_values', {range: 'Canal!A1'}));
    ok('pont : un 502 sans corps (Caddy pendant un redémarrage) fait échouer l’écriture, avec un message clair (rien n’est fait)', !!r.e && r.e.code === 'upstream_error' && /indisponible \(502\)/.test(r.e.message) && /rien n’est fait/.test(r.e.message), JSON.stringify(r)); }
  { const m = await pont(() => rep(500, {error: 'Erreur du serveur.'})).w.claude.use('mcp'); const r = await tente(() => m.callTool('Gmail', 'send_message', {}));
    ok('pont : une erreur du serveur écrite en simple phrase garde sa phrase (plus « tool_error »)', !!r.e && r.e.code === 'tool_error' && r.e.message === 'Erreur du serveur.', JSON.stringify(r)); }
  { const m = await pont(() => rep(409, {error: {code: 'server_not_connected', message: 'Google n’est pas relié.'}})).w.claude.use('mcp'); const r = await tente(() => m.callTool('Google Sheets', 'get_values', {}));
    ok('pont : une erreur détaillée du serveur garde son code et son message', !!r.e && r.e.code === 'server_not_connected' && r.e.message === 'Google n’est pas relié.', JSON.stringify(r)); }
  { const m = await pont(() => rep(200, {payload: {values: [['a']]}})).w.claude.use('mcp'); const r = await tente(() => m.callTool('Google Sheets', 'get_values', {}));
    ok('pont : un succès (200) rend sa charge', !r.e && r.v && JSON.stringify(r.v.payload) === '{"values":[["a"]]}', JSON.stringify(r)); }
  { const m = await pont(coupe).w.claude.use('mcp'); const r = await tente(() => m.callTool('Google Sheets', 'get_values', {}));
    ok('pont : réseau coupé : « Serveur JARVIS injoignable. »', !!r.e && r.e.message === 'Serveur JARVIS injoignable.', JSON.stringify(r)); }
  { const P = pont(() => rep(502)), m = await P.w.claude.use('mcp'); const evts = [];
    const stop = m.watchTool('Google Sheets', 'get_values', {}, (x) => evts.push(x)); await new Promise((z) => setTimeout(z, 20)); stop();
    ok('pont : une lecture qui tombe sur un 502 remonte une erreur (le tableau déjà lu n’est plus remplacé par un tableau vide)', evts.length === 1 && evts[0].type === 'error' && evts[0].error.code === 'upstream_error', JSON.stringify(evts)); }

  /* pont-sw-voix#2 : l'abonnement refusé, et seulement lui */
  const ABO_VRAI = "You can't use your Claude subscription right now: your payment is past due. Update your billing details at claude.ai/settings/billing.";
  { const txt = 'Le mail de l’opérateur dit : « Your payment is past due ». Il te demande de régler 19,99 € avant vendredi (exemple inventé).', vus = [];
    const s = await pont(() => sse([['delta', {d: txt.slice(0, 40)}], ['delta', {d: txt.slice(40)}], ['done', {text: txt}]])).w.claude.use('sample');
    const r = await tente(() => s([{role: 'user', content: 'Résume ce mail'}], {onText: (o) => vus.push(o.text)}));
    ok('pont : une réponse qui cite « payment is past due » (un mail de relance) passe telle quelle et s’écrit pendant le flux', !r.e && r.v.text === txt && vus.length >= 2 && vus[vus.length - 1] === txt, JSON.stringify(r.e || '') + ' ' + vus.length); }
  { const txt = 'Pour gérer ton abonnement Claude, va sur claude.ai/settings/billing (Réglages, Facturation).';
    const s = await pont(() => sse([['delta', {d: txt}], ['done', {text: txt}]])).w.claude.use('sample'); const r = await tente(() => s([{role: 'user', content: 'Où gérer mon abonnement ?'}], {}));
    ok('pont : une réponse qui donne le lien de facturation passe telle quelle', !r.e && r.v.text === txt, JSON.stringify(r.e || '')); }
  { const s = await pont(() => sse([['delta', {d: ABO_VRAI}], ['done', {text: ABO_VRAI}]])).w.claude.use('sample'); const r = await tente(() => s([{role: 'user', content: 'Bonjour'}], {}));
    ok('pont : le vrai message de Claude Code (« can’t use your Claude subscription… past due ») devient l’erreur claire en français', !!r.e && /Claude ne peut plus utiliser ton abonnement/.test(r.e.message), JSON.stringify(r).slice(0, 160)); }
  { const s = await pont(() => rep(200, {text: ABO_VRAI})).w.claude.use('sample'); const r = await tente(() => s([{role: 'user', content: 'Bonjour'}], {}));
    const s2 = await pont(() => rep(502, {error: ABO_VRAI})).w.claude.use('sample'); const r2 = await tente(() => s2([{role: 'user', content: 'Bonjour'}], {}));
    ok('pont : le même message, en réponse entière ou en erreur, donne aussi l’erreur en français', !!r.e && /Claude ne peut plus/.test(r.e.message) && !!r2.e && /Claude ne peut plus/.test(r2.e.message), JSON.stringify([r, r2]).slice(0, 200)); }

  /* page-5#11 et pont-sw-voix#9 : Réglages et Radar, serveur injoignable ou qui redémarre */
  { const J = pont(coupe, false).w.JarvisServeur; const r = await J.pair('AB12-CD34');
    ok('pont : « Relier » hors réseau dit que le serveur est injoignable (au lieu de ne rien afficher)', r && r.ok === false && /injoignable/.test(r.error), JSON.stringify(r)); }
  { const J = pont(() => rep(502), false).w.JarvisServeur; const r = await J.pair('AB12-CD34');
    const J2 = pont(() => rep(400, {error: 'Code inconnu ou expiré.'}), false).w.JarvisServeur; const r2 = await J2.pair('AB12-CD34');
    ok('pont : « Relier » pendant un redémarrage le dit ; un code refusé garde le message du serveur', /indisponible/.test(r.error) && r2.error === 'Code inconnu ou expiré.', JSON.stringify([r, r2])); }
  { const J = pont(coupe).w.JarvisServeur, out = [];
    for (const f of [() => J.googleConfig('id-essai.apps.googleusercontent.com', 'secret-essai'), () => J.googleLink(), () => J.googleUnlink()]) { const r = await tente(f); out.push(r.e ? 'rejet' : r.v); }
    ok('pont : « Enregistrer », « Connecter Google » et « Déconnecter » hors réseau rendent un message (plus de promesse rejetée sans rien à l’écran)', out.every((x) => x && x.ok === false && /injoignable/.test(x.error)), JSON.stringify(out)); }
  { const J = pont(() => rep(502)).w.JarvisServeur, J2 = pont(() => rep(400, {ok: false, error: 'Identifiant invalide.'})).w.JarvisServeur;
    const a = await J.googleConfig('x', 'y'), b2 = await J2.googleConfig('x', 'y'), c = await pont(() => rep(200, {ok: true})).w.JarvisServeur.googleUnlink();
    ok('pont : Google pendant un redémarrage : « indisponible » ; un refus garde son message ; un succès reste un succès', a.ok === false && /indisponible/.test(a.error) && b2.error === 'Identifiant invalide.' && c.ok === true, JSON.stringify([a, b2, c])); }
  { const J = pont(coupe).w.JarvisServeur; const a = await tente(() => J.radarSet('paie', 28)), b2 = await tente(() => J.radarLire(true));
    ok('pont : Radar hors réseau : le message est en français (plus « Load failed »)', a.e && a.e.message === 'Serveur JARVIS injoignable' && b2.e && b2.e.message === 'Serveur JARVIS injoignable', JSON.stringify([a.e && a.e.message, b2.e && b2.e.message])); }
  { const J = pont(() => rep(502)).w.JarvisServeur; const a = await tente(() => J.radarSet('paie', 28)), b2 = await tente(() => J.radarLire(true));
    ok('pont : Radar pendant un redémarrage : « Serveur JARVIS indisponible »', a.e && a.e.message === 'Serveur JARVIS indisponible' && b2.e && b2.e.message === 'Serveur JARVIS indisponible', JSON.stringify([a.e && a.e.message, b2.e && b2.e.message])); }
  { const J = pont(coupe).w.JarvisServeur; const r = [await J.status(), await J.missions(), await J.mcp.etat(), await J.sante()];
    ok('pont : les lectures qui rendaient « rien » hors réseau le font toujours (aucun rejet nouveau)', r.every((x) => x === null), JSON.stringify(r)); }

  /* ---------- le service worker ---------- */
  function sw(o = {}) {
    const H = {}, journal = {skips: 0, effaces: [], gardes: [], ouverts: [], messages: [], focus: []};
    const fenetres = (o.fenetres || []).map((url) => ({url, focus: () => { journal.focus.push(url); return Promise.resolve(); }, postMessage: (m) => journal.messages.push([url, m])}));
    const self = {addEventListener: (t, f) => { H[t] = f; }, registration: {scope: 'https://jarvis.essai/', showNotification: () => Promise.resolve()},
      clients: {matchAll: () => Promise.resolve(fenetres), openWindow: (u) => { journal.ouverts.push(u); return Promise.resolve(); }, claim: () => Promise.resolve()}, skipWaiting: () => { journal.skips++; return Promise.resolve(); }};
    const copies = Object.assign({}, o.copies || {});
    const cle = (r) => new URL(typeof r === 'string' ? r : r.url, 'https://jarvis.essai/sw.js').href;
    const caches = {open: () => Promise.resolve({add: () => Promise.resolve(), put: (r) => { journal.gardes.push(cle(r)); return Promise.resolve(); }}),
      keys: () => Promise.resolve(o.caches || []), delete: (k) => { journal.effaces.push(k); return Promise.resolve(true); }, match: (r) => Promise.resolve(copies[cle(r)] || null)};
    vm.runInNewContext(SW, {self, caches, fetch: o.fetch || (() => Promise.resolve({ok: true, status: 200, clone: () => ({})})), URL, Promise, location: {origin: 'https://jarvis.essai'}});
    const attendre = async (t, ev) => { const w = []; H[t](Object.assign({waitUntil: (p) => w.push(p)}, ev || {})); await Promise.all(w); };
    const charger = async (url, mode) => { let rendu = null; H.fetch({request: {method: 'GET', url, mode: mode || 'navigate', clone: () => ({})}, respondWith: (p) => { rendu = p; }}); return rendu ? {r: await rendu} : null; };
    return {H, journal, attendre, charger};
  }
  { const S = sw({caches: ['jarvis-os-app-v3', 'jarvis-os-app-v4', 'jarvis-os-v3', 'jarvis-os-v4', 'panier-v2']}); await S.attendre('install'); const avant = S.journal.skips; await S.attendre('activate');
    ok('service worker : à l’activation, il n’efface que ses propres anciens caches (jarvis-os-app-v3) et le cache périmé jarvis-os-v3 de l’ancienne app (réponses de /api/), ni jarvis-os-v4 ni Panier', S.journal.effaces.join() === 'jarvis-os-app-v3,jarvis-os-v3' && avant === 0, JSON.stringify(S.journal)); }
  { const S = sw(); await S.attendre('install'); const a = S.journal.skips; S.H.message({data: {type: 'active'}});
    ok('service worker : jamais de relève à l’installation (seulement sur « active », app à l’arrière-plan)', a === 0 && S.journal.skips === 1, JSON.stringify(S.journal)); }
  { const S = sw(); await S.charger('https://jarvis.essai/?n=a1b2c3'); await S.charger('https://jarvis.essai/?n=d4e5f6#voir-brief'); await S.charger('https://jarvis.essai/'); await S.charger('https://jarvis.essai/jarvis-serveur.js', 'no-cors');
    await new Promise((z) => setTimeout(z, 10));
    ok('service worker : une page ouverte par une notification (« /?n=… ») n’est plus gardée en copie ; « / » et le code le sont', S.journal.gardes.join() === 'https://jarvis.essai/,https://jarvis.essai/jarvis-serveur.js', S.journal.gardes.join()); }
  { const S = sw({fetch: () => Promise.reject(new TypeError('hors ligne')), copies: {'https://jarvis.essai/': {page: 'derniere'}, 'https://jarvis.essai/index.html': {page: 'installation'}}});
    const r = await S.charger('https://jarvis.essai/?n=c3d4e5#argent');
    ok('service worker : hors ligne, une notification ouverte affiche quand même l’app (la dernière page gardée)', r && r.r && r.r.page === 'derniere', JSON.stringify(r)); }
  { const S = sw(), sans = [];
    for (const u of ['/courses', '/courses/liste', '/invite/', '/maquettes/ux/', '/api/notifs', '/ancienne/']) { if (!(await S.charger('https://jarvis.essai' + u))) sans.push(u); }
    ok('service worker : /courses, /invite, /maquettes, /api et /ancienne restent ignorés', sans.length === 6, sans.join(' ')); }
  { const S = sw({fenetres: ['https://jarvis.essai/ancienne/', 'https://jarvis.essai/maquettes/ux/']});
    await S.attendre('notificationclick', {notification: {close: () => {}, data: {url: '/?n=0a0b0c#recue=t1'}}});
    ok('service worker : app restée sur l’ancienne app ou une maquette : la notification ouvre l’app sur sa cible (pas la fenêtre qui l’ignore)', S.journal.ouverts.join() === 'https://jarvis.essai/?n=0a0b0c#recue=t1' && !S.journal.focus.length && !S.journal.messages.length, JSON.stringify(S.journal)); }
  { const S = sw({fenetres: ['https://jarvis.essai/ancienne/', 'https://jarvis.essai/#demandes']});
    await S.attendre('notificationclick', {notification: {close: () => {}, data: {url: '/#voir-recent'}}});
    ok('service worker : l’app ouverte reçoit l’adresse et revient au premier plan (pas l’ancienne app)', S.journal.focus.join() === 'https://jarvis.essai/#demandes' && S.journal.messages.length === 1 && S.journal.messages[0][0] === 'https://jarvis.essai/#demandes' && S.journal.messages[0][1].url === 'https://jarvis.essai/#voir-recent' && !S.journal.ouverts.length, JSON.stringify(S.journal)); }
} catch (e) { ok('exception', false, e && e.stack); }
console.log(results.join('\n')); console.log(fails ? fails + ' échec(s)' : 'Tout passe (' + results.length + ' vérifications).');
process.exit(fails ? 1 : 0);
