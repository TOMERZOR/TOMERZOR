// Offline support: the whole game is cached on first visit, then served from cache
// while a fresh copy is fetched in the background.
const CACHE = 'bloom-v6';
const CORE = [
  './', './index.html', './css/style.css?v=4', './manifest.webmanifest?v=3',
  './js/main.js?v=4', './js/board.js', './js/pieces.js', './js/engine.js', './js/rules.js', './js/render.js',
  './js/garden.js', './js/audio.js', './js/meta.js', './icons/icon-192.png?v=3', './icons/icon-512.png?v=3',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
// Only our own old caches: other apps on the same site (github.io origin) keep theirs.
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('bloom-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
