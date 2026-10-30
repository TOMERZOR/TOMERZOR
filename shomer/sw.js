// Caches the whole app on the first visit, so it then runs with no internet at all.
// Bump VERSION whenever a file changes.
const VERSION = 'shomer-v13';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css?v=3',
  'js/app.js?v=3',
  'js/motion.js',
  'js/link.js',
  'js/scan.js',
  'js/push.js',
  'js/config.js',
  'vendor/qrcode.js',
  'vendor/jsQR.js',
  'vendor/tf.min.js',
  'vendor/coco-ssd.min.js',
  'vendor/ssdlite/model.json',
  'vendor/ssdlite/group1-shard1of5',
  'vendor/ssdlite/group1-shard2of5',
  'vendor/ssdlite/group1-shard3of5',
  'vendor/ssdlite/group1-shard4of5',
  'vendor/ssdlite/group1-shard5of5',
  'img/icon.svg',
  'img/icon.png',
  'img/icon-512.png',
  'img/apple-touch-icon.png',
  'img/keepawake.mp4',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('shomer-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // The relay address is filled in after deploys, so fetch it fresh when online.
  if (new URL(e.request.url).pathname.endsWith('/js/config.js')) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: false }).then(hit => hit || fetch(e.request)));
});

// An alert from the camera, pushed through Apple/Google while Shomer is in the background or the
// phone is locked. Decrypted by the browser before it gets here.
self.addEventListener('push', e => {
  let data;
  try {
    data = e.data.json();
  } catch {
    data = { title: 'שומר', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(self.registration.showNotification(data.title || 'שומר', {
    body: data.body || '',
    tag: data.tag,
    icon: 'img/icon.png',
    badge: 'img/icon.png',
    requireInteraction: true,
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow('./');
  }));
});
