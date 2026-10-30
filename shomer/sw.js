// Caches the whole app on the first visit, so it then runs with no internet at all.
// Bump VERSION whenever a file changes.
const VERSION = 'shomer-v11';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css?v=3',
  'js/app.js?v=3',
  'js/motion.js',
  'js/link.js',
  'js/scan.js',
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
  e.respondWith(caches.match(e.request, { ignoreSearch: false }).then(hit => hit || fetch(e.request)));
});
