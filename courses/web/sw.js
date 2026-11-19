/* Panier : l'app s'ouvre même sans réseau (au fond du magasin). Réseau d'abord pour le code, cache d'abord pour les photos ;
   jamais les données (api/), sauf les photos apprises (api/img/, immuables). */
const CODE = 'panier-code-v1', PHOTOS = 'panier-photos-v1';
const COEUR = ['./', 'app.css?v=1.0.0', 'app.js?v=1.0.0', 'catalogue.json', 'manifest.webmanifest', 'icon-192.png', 'icon-180.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CODE).then((c) => Promise.all(COEUR.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('panier-') && k !== CODE && k !== PHOTOS).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const estPhoto = (u) => /\/img\/[^/]+\.(webp|jpg|png)$/.test(u.pathname);
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (estPhoto(u)) { e.respondWith(caches.open(PHOTOS).then((c) => c.match(e.request, {ignoreSearch: !u.pathname.includes('/api/')}).then((m) => m || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })))); return; }
  if (u.pathname.includes('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copie = r.clone(); caches.open(CODE).then((c) => c.put(e.request, copie)).catch(() => {}); } return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: true}).then((m) => m || (e.request.mode === 'navigate' ? caches.match('./') : Response.error()))));
});
/* l'app envoie la liste des photos du catalogue : elles sont rangées en douceur, quatre à la fois */
self.addEventListener('message', (e) => {
  const d = e.data || {}; if (d.type !== 'photos' || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(PHOTOS).then(async (c) => {
    const file = d.urls.slice(0, 2000);
    const un = async () => { for (let u = file.shift(); u; u = file.shift()) { try { if (!(await c.match(u, {ignoreSearch: true}))) { const r = await fetch(u); if (r.ok) await c.put(u, r); } } catch (x) { return; } } };
    await Promise.all([un(), un(), un(), un()]);
  }));
});
