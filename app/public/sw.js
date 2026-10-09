/* Sidetable service worker (same shape as Amie's). The page: network first, so a new version shows up at once, and the
   cached copy when offline. Styles, icons and the manifest: cache first. Anything under /api/ is never cached, and the film streams straight from the server (byte ranges can't be cached).
   It also shows Sidetable's notifications, and a tap opens the app where the notification points. */
var CACHE = 'sixtop-v2';
var ASSETS = ['./', './app.css', './shared.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).catch(function () {})); self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })); self.clients.claim(); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var u = new URL(e.request.url); if (u.origin !== location.origin || u.pathname.indexOf('/api/') === 0 || u.pathname.indexOf('/video/') === 0 || u.pathname === '/admin') return;
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(function (res) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put('./', cp); }); return res; }).catch(function () { return caches.match('./'); })); return; }
  e.respondWith(fetch(e.request).then(function (res) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); return res; }).catch(function () { return caches.match(e.request); }));
});
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Sidetable', { body: d.body || 'Something new at your table.', icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', tag: d.tag || 'sixtop', renotify: d.tag === 'mutual' || d.tag === 'table', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if ('focus' in cs[i]) { cs[i].postMessage({ sixtopOpen: url }); return cs[i].focus(); }
    return clients.openWindow(url);
  }));
});
