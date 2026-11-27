/* JARVIS OS : garde l'app pour l'ouvrir vite depuis l'écran d'accueil. Réseau d'abord, cache en secours ; jamais les données (/api/).
   Depuis 0.12.0 : notifications envoyées par le serveur (format « déclaratif » de Safari, lu aussi ici) et pastille sur l'icône.
   0.27.0 (comme Panier, après son incident du 19/11/2026) : une nouvelle version de ce service ne prend JAMAIS la place de l'ancienne pendant
   qu'une page charge (plus de skipWaiting à l'installation) : elle attend que l'app passe à l'arrière-plan (message « active ») ou soit fermée.
   L'ancien service suffit entre-temps : le code vient d'abord du réseau. Une erreur 5xx (le serveur redémarre) retombe sur la copie gardée.
   0.73.0 : une adresse avec « ?… » (une notification ouvre « /?n=<id>#… ») n'est plus gardée : chaque ouverture ajoutait une copie de la page
   (1,16 Mo), sans limite ; v4 efface celles déjà gardées. Ce service n'efface que ses propres caches (« jarvis-os-app-… »), plus jarvis-os-v3,
   périmé (l'ancienne app y gardait des réponses de /api/) ; jamais jarvis-os-v4 ni Panier, qui partagent le même stockage du domaine. */
const CACHE = 'jarvis-os-app-v4';
const CORE = ['./', './index.html', './jarvis-voix.js', './jarvis-serveur.js', './sceller.mjs', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))); });
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'active') self.skipWaiting(); });   /* l'app est à l'arrière-plan : la relève peut se faire */
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => (k.startsWith('jarvis-os-app-') && k !== CACHE) || k === 'jarvis-os-v3').map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
/* 0.91.0 : le menu Partager du système (Web Share Target du manifeste : Android ; Safari sur iPhone ne l'offre pas aux apps web, un Raccourci
   le remplace). Le partage arrive ici en POST, sans le jeton de l'appareil : le serveur ne peut donc pas le recevoir lui-même. Ce service
   garde les fichiers (PDF, images, 25 Mo et 5 au plus) dans un cache à part, puis rouvre l'app, qui les envoie avec son jeton (Papiers ›
   Déposer) et les retire du cache. Ce cache n'est jamais effacé par « activate » (son nom ne commence pas par « jarvis-os-app- »). */
const PARTAGE = 'jarvis-os-partage';
const partageRecu = async (req) => {
  let n = 0;
  try {
    const f = await req.formData(), c = await caches.open(PARTAGE);
    for (const x of f.getAll('fichiers')) {
      if (!x || typeof x === 'string' || !x.size || x.size > 25 * 1024 * 1024 || n >= 5) continue;
      await c.put(new Request(new URL('partage-recu/' + Date.now() + '-' + n, self.registration.scope).href), new Response(x, {headers: {'content-type': x.type || 'application/octet-stream', 'x-nom': encodeURIComponent(x.name || '')}})); n++;
    }
  } catch (er) { n = 0; }
  return Response.redirect(new URL(n ? './#voir-papiers-depot' : './#voir-papiers-partage-vide', self.registration.scope).href, 303);
};
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.origin === location.origin && /\/partage$/.test(u.pathname) && u.pathname === new URL('partage', self.registration.scope).pathname) { e.respondWith(partageRecu(e.request)); return; }
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/ancienne/') || u.pathname.startsWith('/courses') || u.pathname.startsWith('/maquettes') || u.pathname.startsWith('/invite')) return;   /* /maquettes : les maquettes servies par le serveur (0.53.0) ; /invite : la page d'un proche (0.62.0) ; /courses : l'app Panier, qui a son propre service */
  /* une navigation sans copie à elle (« /?n=… ») prend la dernière page ouverte (« ./ », relue à chaque lancement), sinon celle de l'installation */
  const garde = () => caches.match(e.request).then((m) => m || (e.request.mode === 'navigate' ? caches.match('./').then((x) => x || caches.match('./index.html')) : null));
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { if (!u.search) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); } return r; } return r.status >= 500 ? garde().then((m) => m || r) : r; })
    .catch(() => garde().then((m) => m || caches.match('./index.html'))));
});
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {notification: {title: 'J.A.R.V.I.S OS', body: e.data ? e.data.text() : ''}}; }
  const n = d.notification || d, url = n.navigate || n.url || '/', badge = n.app_badge != null ? Number(n.app_badge) : null, nav = self.navigator;
  e.waitUntil(Promise.all([
    self.registration.showNotification(n.title || 'J.A.R.V.I.S OS', {body: n.body || '', tag: n.tag || undefined, data: {url}, icon: 'icon-192.png', lang: 'fr-FR'}),
    badge != null && nav && 'setAppBadge' in nav ? (badge > 0 ? nav.setAppBadge(badge) : nav.clearAppBadge()).catch(() => null) : null]));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((cs) => {
    /* 18/11/2026 : l'app déjà ouverte reçoit l'adresse (« /#voir-<ligne du Canal> ») : elle relit Pilotage et ouvre la réponse.
       0.73.0 : seulement une fenêtre sur la page de l'app (pas l'ancienne app, une maquette ou la page d'un proche, qui n'écoutent pas ce message) */
    const racine = new URL(self.registration.scope).pathname;
    const app = (x) => { try { const p = new URL(x.url).pathname; return p === racine || p === racine + 'index.html'; } catch (er) { return false; } };
    const c = cs.find((x) => 'focus' in x && app(x));
    if (c) { try { c.postMessage({type: 'jarvis-notif', url}); } catch (x) { /* rien */ } return c.focus().catch(() => null); }
    return self.clients.openWindow(url);
  }));
});
