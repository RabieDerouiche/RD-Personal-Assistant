/* Service worker : garde l'app pour l'ouvrir vite depuis l'écran d'accueil. Réseau d'abord, cache en secours. */
/* 0.70.0 : cache v4 (l'ancien v3 gardait des réponses de /api/, effacé à l'activation) ; à l'activation, seuls ses propres anciens caches
   (jarvis-os-v3…) sont effacés, jamais ceux de la nouvelle app (jarvis-os-app-…) ni de Panier ; les réponses de /api/ ne sont plus gardées */
const CACHE = 'jarvis-os-v4';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => /^jarvis-os-v\d+$/.test(k) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))));
});
