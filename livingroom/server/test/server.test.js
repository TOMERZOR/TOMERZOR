import test from 'node:test';
import assert from 'node:assert/strict';
import { dimsFromText, extractProduct, toCm } from '../src/extract.js';
import { normalizeTask, findModelUrl } from '../src/tripo.js';
import worker, { safeUrl, buildItem } from '../src/index.js';

test('lengths convert to cm', () => {
  assert.equal(toCm('200'), 200);
  assert.equal(toCm('2', 'm'), 200);
  assert.equal(toCm('850', 'mm'), 85);
  assert.equal(Math.round(toCm('78.7', 'in')), 200);
  assert.equal(toCm({ value: 90, unitCode: 'CMT' }), 90);
  assert.equal(toCm({ value: 0.9, unitCode: 'MTR' }), 90);
});

test('dimensions in Hebrew text', () => {
  const d = dimsFromText('ספה תלת מושבית. מידות: רוחב: 220 ס"מ, עומק: 95 ס"מ, גובה: 82 ס"מ. משלוח חינם');
  assert.deepEqual([d.w, d.d, d.h], [220, 95, 82]);
});

test('dimensions as W x D x H', () => {
  const d = dimsFromText('Overall: W 200 x D 90 x H 85 cm');
  assert.deepEqual([d.w, d.d, d.h], [200, 90, 85]);
  const e = dimsFromText('Size 180 x 40 x 52 cm, oak veneer');
  assert.deepEqual([e.w, e.d, e.h], [180, 40, 52]);
  const f = dimsFromText('Dimensions: 78.7" x 35.4" x 33.5"');
  assert.deepEqual([f.w, f.d, f.h].map(Math.round), [200, 90, 85]);
});

test('product page with JSON-LD', () => {
  const html = `<html><head><title>Oslo Sofa | Store</title>
    <meta property="og:image" content="https://cdn.example.com/oslo-og.jpg">
    <meta property="og:site_name" content="Example Home">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Oslo 3-seat sofa","image":["https://cdn.example.com/oslo.jpg"],
      "brand":{"@type":"Brand","name":"Nord"},"offers":{"@type":"Offer","price":"4890","priceCurrency":"ILS"},
      "width":{"@type":"QuantitativeValue","value":222,"unitCode":"CMT"},"depth":{"value":96,"unitCode":"CMT"},"height":{"value":0.8,"unitCode":"MTR"}}</script>
    </head><body><model-viewer src="/models/oslo.glb"></model-viewer></body></html>`;
  const p = extractProduct(html, 'https://example.com/p/oslo');
  assert.equal(p.name, 'Oslo 3-seat sofa');
  assert.equal(p.brand, 'Nord');
  assert.equal(p.store, 'Example Home');
  assert.equal(p.price, 4890);
  assert.equal(p.currency, 'ILS');
  assert.deepEqual(p.dims, { w: 222, d: 96, h: 80 });
  assert.equal(p.images[0], 'https://cdn.example.com/oslo.jpg');
  assert.equal(p.models[0], 'https://example.com/models/oslo.glb');
});

test('buildItem prefers what Claude read, falls back to the page', () => {
  const page = { name: 'Oslo sofa', images: ['https://cdn.example.com/a.jpg'], dims: { w: 222, d: null, h: 80 }, dimsFound: true, price: 4890, currency: 'ILS', store: 'example.com', models: [] };
  const a = buildItem({ url: 'https://example.com/p', page, ai: null });
  assert.equal(a.category, 'sofa');
  assert.deepEqual(a.dims, { w: 222, d: null, h: 80 });
  assert.equal(a.dimsSource, 'partial');
  const b = buildItem({ url: 'https://example.com/p', page, ai: { name: 'ספת אוסלו', category: 'sofa', width_cm: 222, depth_cm: 96, height_cm: 80, dims_source: 'page', color_hex: '#5E7C93', price: 0, currency: '', image_url: 'https://evil.example/x.jpg', note: '' } });
  assert.deepEqual(b.dims, { w: 222, d: 96, h: 80 });
  assert.equal(b.name, 'ספת אוסלו');
  assert.equal(b.color, '#5e7c93');
  assert.equal(b.image, 'https://cdn.example.com/a.jpg', 'an image not on the page is ignored');
  assert.equal(b.source.price, 4890);
});

test('safeUrl blocks private addresses', () => {
  assert.ok(safeUrl('https://www.ikea.com/il/he/p/x'));
  for (const bad of ['http://localhost/x', 'http://127.0.0.1/', 'http://10.0.0.3/', 'http://192.168.1.1/', 'file:///etc/passwd', 'http://[::1]/', 'https://a.b:22/', 'http://169.254.169.254/latest']) assert.equal(safeUrl(bad), null, bad);
});

test('Tripo task status is normalised', () => {
  assert.deepEqual(normalizeTask({ status: 'running', progress: 42 }), { status: 'running', progress: 42, glb: null, preview: null });
  const done = normalizeTask({ status: 'success', output: { pbr_model: 'https://tripo-data.example/m.glb?sig=1', rendered_image: 'https://tripo-data.example/r.webp' } });
  assert.equal(done.status, 'success');
  assert.equal(done.glb, 'https://tripo-data.example/m.glb?sig=1');
  assert.equal(done.preview, 'https://tripo-data.example/r.webp');
  assert.equal(normalizeTask({ status: 'SUCCESS', output: {} }).status, 'failed');
  assert.equal(normalizeTask({ status: 'queued' }).status, 'queued');
  assert.equal(findModelUrl({ result: [{ files: { glb: { url: 'https://x.example/a.glb' } } }] }), 'https://x.example/a.glb');
});

// ---------- the worker, with the network mocked ----------
const realFetch = globalThis.fetch;
function mockFetch(routes) {
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    for (const [pattern, handler] of routes) if (u.match(pattern)) return handler(u, init);
    return new Response('not found', { status: 404 });
  };
}
const env = { ALLOWED_ORIGINS: '*', TRIPO_API_KEY: 'test-key' };
const call = (path, init) => worker.fetch(new Request(`https://api.test${path}`, init), env);

test('import reads a page without AI', async () => {
  mockFetch([[/shop\.example/, () => new Response(`<html><head><meta property="og:title" content="Round coffee table"><meta property="og:image" content="https://shop.example/t.jpg"></head><body>Dimensions: 90 x 90 x 38 cm</body></html>`, { headers: { 'content-type': 'text/html' } })]]);
  try {
    const res = await call('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://shop.example/table' }) });
    assert.equal(res.status, 200);
    const { item } = await res.json();
    assert.equal(item.category, 'coffee-table');
    assert.deepEqual(item.dims, { w: 90, d: 90, h: 38 });
    assert.equal(item.image, 'https://shop.example/t.jpg');
  } finally { globalThis.fetch = realFetch; }
});

test('import of a blocked page without AI says so', async () => {
  mockFetch([[/shop\.example/, () => new Response('Access denied', { status: 403 })]]);
  try {
    const res = await call('/api/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://shop.example/x' }) });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, 'page_blocked');
  } finally { globalThis.fetch = realFetch; }
});

test('3D model: upload, start, poll, download', async () => {
  const seen = [];
  mockFetch([
    [/cdn\.example\/photo\.jpg/, () => new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } })],
    [/openapi\.tripo3d\.ai\/v3\/files/, (u, init) => { seen.push(['upload', init.headers.authorization, init.body instanceof FormData]); return Response.json({ code: 0, data: { file_token: 'file_abc' } }); }],
    [/openapi\.tripo3d\.ai\/v3\/generation\/image-to-model/, (u, init) => { seen.push(['task', JSON.parse(init.body)]); return Response.json({ code: 0, data: { task_id: '0f9c5b62-1111-2222-3333-444455556666' } }); }],
    [/openapi\.tripo3d\.ai\/v3\/tasks\//, () => Response.json({ code: 0, data: { status: 'success', progress: 100, output: { pbr_model: 'https://tripo-data.example/m.glb' } } })],
    [/tripo-data\.example\/m\.glb/, () => new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46]))],
  ]);
  try {
    const start = await call('/api/model', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl: 'https://cdn.example/photo.jpg' }) });
    assert.equal(start.status, 200);
    const { task } = await start.json();
    assert.equal(task, '0f9c5b62-1111-2222-3333-444455556666');
    assert.deepEqual(seen[0], ['upload', 'Bearer test-key', true]);
    assert.deepEqual(seen[1][1].file, { file_token: 'file_abc' });
    const st = await (await call(`/api/model/${task}`)).json();
    assert.deepEqual([st.status, st.progress, st.ready], ['success', 100, true]);
    const file = await call(`/api/model/${task}/file`);
    assert.equal(file.headers.get('content-type'), 'model/gltf-binary');
    assert.equal((await file.arrayBuffer()).byteLength, 4);
  } finally { globalThis.fetch = realFetch; }
});

test('3D model: no credit on the Tripo account', async () => {
  mockFetch([
    [/openapi\.tripo3d\.ai\/v3\/files/, () => Response.json({ code: 0, data: { file_token: 'file_abc' } })],
    [/image-to-model/, () => Response.json({ code: 2010, message: "You don't have enough credit" }, { status: 403 })],
  ]);
  try {
    const res = await call('/api/model', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageData: 'data:image/png;base64,iVBORw0KGgo=' }) });
    assert.equal(res.status, 402);
    assert.equal((await res.json()).error, 'no_credit');
  } finally { globalThis.fetch = realFetch; }
});

test('image proxy refuses non-images and adds CORS', async () => {
  mockFetch([
    [/cdn\.example\/a\.jpg/, () => new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/jpeg' } })],
    [/cdn\.example\/page/, () => new Response('<html>', { headers: { 'content-type': 'text/html' } })],
  ]);
  try {
    const ok = await call('/api/img?u=' + encodeURIComponent('https://cdn.example/a.jpg'), { headers: { origin: 'https://tomerzor.github.io' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('access-control-allow-origin'), '*');
    const bad = await call('/api/img?u=' + encodeURIComponent('https://cdn.example/page'));
    assert.equal(bad.status, 415);
  } finally { globalThis.fetch = realFetch; }
});
