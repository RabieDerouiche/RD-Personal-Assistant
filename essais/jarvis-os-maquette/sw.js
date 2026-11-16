/* JARVIS OS : garde l'app pour l'ouvrir vite depuis l'écran d'accueil. Réseau d'abord, cache en secours ; jamais les données (/api/). */
const CACHE = 'jarvis-os-app-v1';
const CORE = ['./', './index.html', './jarvis-voix.js', './jarvis-serveur.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/ancienne/')) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); } return r; })
    .catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))));
});
