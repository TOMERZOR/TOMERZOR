// Keeps Living Room on the phone so it opens instantly, also offline.
// Bump VERSION whenever a file changes.
const VERSION = 'livingroom-v3';
const FILES = [
  './',
  'css/app.css',
  'fonts/rubik-hebrew-wght-normal.woff2',
  'fonts/rubik-latin-wght-normal.woff2',
  'img/apple-touch-icon.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png',
  'img/icon.svg',
  'index.html',
  'js/api.js',
  'js/app.js',
  'js/ar.js',
  'js/catalog.js',
  'js/config.js',
  'js/icons.js',
  'js/models.js',
  'js/scene-kit.js',
  'js/store.js',
  'js/studio.js',
  'js/thumbs.js',
  'js/units.js',
  'manifest.webmanifest',
  'vendor/qrcode.mjs',
  'vendor/three/addons/controls/OrbitControls.js',
  'vendor/three/addons/environments/RoomEnvironment.js',
  'vendor/three/addons/exporters/USDZExporter.js',
  'vendor/three/addons/geometries/RoundedBoxGeometry.js',
  'vendor/three/addons/libs/fflate.module.js',
  'vendor/three/addons/loaders/GLTFLoader.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js',
  'vendor/three/addons/utils/SkeletonUtils.js',
  'vendor/three/addons/webxr/XREstimatedLight.js',
  'vendor/three/three.module.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('livingroom-v') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // the server address is filled in after deploys, so fetch it fresh when online
  if (url.pathname.endsWith('/js/config.js')) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
