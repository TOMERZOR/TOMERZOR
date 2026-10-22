// Offline support: the whole game is cached on first visit, then served from cache
// while a fresh copy is fetched in the background.
const CACHE = 'paintparade-v1.0.0';
const CORE = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/game.js', './js/engine.js', './js/render.js', './js/audio.js', './js/platform.js',
  './js/save.js', './js/i18n.js', './js/levels.js', './js/levels-data.js', './js/levelgen.js', './js/art.js', './js/bot.js',
  './fonts/fredoka-latin.woff2', './fonts/fredoka-hebrew.woff2', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
