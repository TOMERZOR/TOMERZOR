// Keeps Mabat on the phone so it opens instantly, and shows the alerts the market server pushes.
// Bump VERSION whenever a file changes.
const VERSION = 'mabat-v1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'fonts/heebo-hebrew.woff2',
  'fonts/heebo-latin.woff2',
  'js/app.js',
  'js/api.js',
  'js/chart.js',
  'js/config.js',
  'js/icons.js',
  'js/push.js',
  'js/store.js',
  'img/icon.svg',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('mabat-v') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // The server address is filled in after deploys, so fetch it fresh when online.
  if (new URL(e.request.url).pathname.endsWith('/js/config.js')) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});

self.addEventListener('push', e => {
  let msg;
  try { msg = e.data.json(); } catch { msg = { type: 'test', title: 'מבט', body: 'התראה חדשה' }; }
  e.waitUntil((async () => {
    // iPhone requires a visible notification for every push.
    await self.registration.showNotification(msg.title || 'מבט', {
      body: msg.body || '',
      tag: msg.type === 'test' ? 'test' : `${msg.type}-${msg.t || ''}-${msg.id || ''}`,
      icon: 'img/icon-192.png',
      badge: 'img/icon-192.png',
      data: { t: msg.t || null, url: msg.url || null },
      requireInteraction: msg.type === 'enter' || msg.type === 'stop',
    });
    for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'refresh' });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { t, url } = e.notification.data || {};
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c);
    if (open) {
      if (t) open.postMessage({ type: 'open', t });
      return open.focus();
    }
    if (url && !t) return self.clients.openWindow(url);
    return self.clients.openWindow(t ? `./?t=${encodeURIComponent(t)}#today` : './#updates');
  }));
});
