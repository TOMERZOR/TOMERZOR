// Keeps the app on the phone so it opens instantly and without internet. Bump VERSION whenever a file changes.
const VERSION = 'mapel-v5';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'fonts/heebo-hebrew.woff2', 'fonts/heebo-latin.woff2', 'fonts/jakarta-latin.woff2',
  'js/app.js', 'js/store.js', 'js/schedule.js', 'js/export.js', 'js/xlsx.js', 'js/ui.js', 'js/icons.js', 'js/demo.js', 'js/paste.js',
  'img/icon.svg', 'img/icon-192.png', 'img/icon-512.png', 'img/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mapel-v') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Network first, so a new version shows up as soon as it's online; the cache when offline.
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
