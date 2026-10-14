/* Service worker : notifications push et mise en cache légère de la coque de l'application. */
const CACHE = 'autoveille-v2';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord pour tout ; la coque en secours quand le réseau est coupé.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then((res) => {
    if (res.ok && SHELL.includes(url.pathname)) caches.open(CACHE).then((c) => c.put(event.request, res.clone()));
    return res;
  }).catch(() => caches.match(event.request).then((hit) => hit || caches.match('/index.html'))));
});

self.addEventListener('push', (event) => {
  let data = { title: 'AutoVeille', body: 'Nouvelle annonce', url: '/' };
  try { data = { ...data, ...event.data.json() }; } catch { /* texte brut */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.vehicleId ? `vehicle-${data.vehicleId}` : undefined,
    data: { url: data.url },
  }).then(() => self.clients.matchAll({ type: 'window' })).then((clients) => clients.forEach((c) => c.postMessage({ type: 'refresh' }))));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const c of clients) {
      if ('focus' in c) { c.navigate ? c.navigate(url) : null; return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
