/* JARVIS OS : garde l'app pour l'ouvrir vite depuis l'écran d'accueil. Réseau d'abord, cache en secours ; jamais les données (/api/).
   Depuis 0.12.0 : notifications envoyées par le serveur (format « déclaratif » de Safari, lu aussi ici) et pastille sur l'icône. */
const CACHE = 'jarvis-os-app-v2';
const CORE = ['./', './index.html', './jarvis-voix.js', './jarvis-serveur.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/ancienne/')) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); } return r; })
    .catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html'))));
});
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {notification: {title: 'JARVIS', body: e.data ? e.data.text() : ''}}; }
  const n = d.notification || d, url = n.navigate || n.url || '/', badge = n.app_badge != null ? Number(n.app_badge) : null, nav = self.navigator;
  e.waitUntil(Promise.all([
    self.registration.showNotification(n.title || 'JARVIS', {body: n.body || '', tag: n.tag || undefined, data: {url}, icon: 'icon-192.png', lang: 'fr-FR'}),
    badge != null && nav && 'setAppBadge' in nav ? (badge > 0 ? nav.setAppBadge(badge) : nav.clearAppBadge()).catch(() => null) : null]));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((cs) => {
    /* 18/11/2026 : l'app déjà ouverte reçoit l'adresse (« /#voir-<ligne du Canal> ») : elle relit Pilotage et ouvre la réponse */
    const c = cs.find((x) => 'focus' in x);
    if (c) { try { c.postMessage({type: 'jarvis-notif', url}); } catch (x) { /* rien */ } return c.focus().catch(() => null); }
    return self.clients.openWindow(url);
  }));
});
