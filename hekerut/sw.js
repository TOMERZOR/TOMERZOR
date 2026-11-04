// Keeps the app on the phone so it opens instantly, even without internet. The network itself
// (profiles, follows) comes from the server and isn't cached here. Bump VERSION whenever a file changes.
const VERSION = 'hekerut-v8';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'fonts/heebo-hebrew.woff2',
  'fonts/heebo-latin.woff2',
  'fonts/jakarta-latin.woff2',
  'js/app.js',
  'js/api.js',
  'js/core.js',
  'js/local.js',
  'js/icons.js',
  'js/qr.js',
  'js/create.js',
  'js/imagefx.js',
  'js/push.js',
  'js/config.js',
  'vendor/qrcode.js',
  'vendor/jsQR.js',
  'img/icon.svg',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never gets stored with old files.
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('hekerut-v') && k !== VERSION).map(k => caches.delete(k))))
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

// Phone notifications from the server: new messages and new followers.
self.addEventListener('push', e => {
  let n = {};
  try { n = e.data.json(); } catch {}
  e.waitUntil((async () => {
    // Skip a message notification when that chat is open on screen right now.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (n.url && wins.some(w => w.visibilityState === 'visible' && w.focused && new URL(w.url).hash === n.url)) return;
    try { if (self.navigator.setAppBadge) await self.navigator.setAppBadge(); } catch {}
    await self.registration.showNotification(n.title || 'היכרות בקליק', {
      body: n.body || '',
      icon: 'img/icon-192.png',
      badge: 'img/icon-192.png',
      tag: n.tag || undefined,
      renotify: !!n.tag,
      lang: 'he',
      dir: 'rtl',
      data: { url: n.url || '#home' },
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(`./${e.notification.data?.url || '#home'}`, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(c => 'focus' in c);
    if (win) { win.postMessage({ type: 'open', url: e.notification.data?.url }); return win.focus(); }
    return self.clients.openWindow(target);
  }));
});
