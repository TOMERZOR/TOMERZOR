// Keeps the game on the device. Every file is stored under the hash the deploy wrote for it in
// asset-manifest.json, so a start downloads only what changed since the last one, and with no
// network at all the last version still runs. Copies of the game that ship without a manifest
// (the phone apps, a plain static host) are left alone: every request goes to the network.
const CACHE = 'shchuna-d-2';
const SCOPE = new URL('./', self.location.href).pathname;
let manifest = null, checked = 0;

async function readManifest(fresh) {
  if (manifest && !(fresh && Date.now() - checked > 15000)) return manifest;
  const cache = await caches.open(CACHE);
  try {
    const r = await fetch('asset-manifest.json', { cache: 'no-store' });
    if (r.ok) {
      const next = await r.json(), changed = !manifest || manifest.build !== next.build;
      manifest = next; checked = Date.now();
      await cache.put('asset-manifest.json', new Response(JSON.stringify(next), { headers: { 'content-type': 'application/json' } }));
      if (changed) prune(cache, next);
      return manifest;
    }
  } catch (e) { /* offline: use what we have */ }
  if (!manifest) { const r = await cache.match('asset-manifest.json'); if (r) manifest = await r.json(); }
  checked = Date.now();
  return manifest;
}

// Drops stored files whose hash is no longer the current one.
async function prune(cache, m) {
  for (const req of await cache.keys()) {
    const u = new URL(req.url), h = u.searchParams.get('h'); if (!h) continue;
    if (m.files[decodeURIComponent(u.pathname.slice(SCOPE.length))] !== h) cache.delete(req);
  }
}

async function serve(req, path) {
  const m = await readManifest(req.mode === 'navigate');
  const h = m && m.files[path];
  if (!h) return fetch(req);
  const cache = await caches.open(CACHE), key = path + '?h=' + h;
  const hit = await cache.match(key);
  if (hit) return hit;
  // The host answers "index.html" with a redirect to the folder, and a page may not be loaded from a
  // redirected response: ask for the folder itself, and hand on a plain copy of whatever comes back.
  let res = await fetch(path === 'index.html' ? './' : path, { cache: 'no-cache' });
  if (res.redirected) res = new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
  if (res.status === 200) cache.put(key, res.clone()).catch(() => { /* disk full: still playable from the network */ });
  return res;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE) || req.headers.has('range')) return;
  const path = decodeURIComponent(url.pathname.slice(SCOPE.length)) || 'index.html';
  if (path === 'asset-manifest.json' || path === 'sw.js' || path === 'health' || path === 'ws' || path.startsWith('ws/')) return;
  // whatever goes wrong in here, the network still gets its chance
  e.respondWith(serve(req, path).catch(() => fetch(req)));
});
