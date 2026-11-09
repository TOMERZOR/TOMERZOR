// Living Room server (Cloudflare Worker).
//   GET  /api/health              what is configured
//   POST /api/import {url}        reads a product page: name, photo, price, real dimensions, category, 3D model link
//   GET  /api/img?u=URL           a store photo with CORS headers, so the app can cut it out on a canvas
//   GET  /api/file?u=URL          a 3D model file linked from a store page (GLB/glTF), with CORS headers
//   POST /api/model {imageUrl|imageData}   starts an AI 3D model of a product photo (Tripo)
//   GET  /api/model/:task         its progress
//   GET  /api/model/:task/file    the finished GLB
// Bindings (all optional): ANTHROPIC_API_KEY, TRIPO_API_KEY (secrets), LIVINGROOM_KV (daily limits),
// ALLOWED_ORIGINS, DAILY_IMPORTS, DAILY_MODELS, LIVINGROOM_MODEL, LIVINGROOM_EFFORT, TRIPO_MODEL.
import { extractProduct } from './extract.js';
import { aiExtract, CATEGORIES, DEFAULT_MODEL } from './ai.js';
import { uploadImage, createTask, getTask, TripoError } from './tripo.js';

const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const MAX_PAGE = 3_000_000;
const MAX_IMAGE = 12_000_000;
const MAX_MODEL = 60_000_000;

// ---------- CORS ----------
const allowedOrigins = env => (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
function originAllowed(request, env) {
  const origin = request.headers.get('origin');
  const allowed = allowedOrigins(env);
  if (allowed.includes('*') || origin === null) return true;
  return origin !== 'null' && allowed.includes(origin);
}
function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = allowedOrigins(env);
  const h = { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'origin' };
  if (allowed.includes('*')) h['access-control-allow-origin'] = '*';
  else if (origin && origin !== 'null' && allowed.includes(origin)) h['access-control-allow-origin'] = origin;
  return h;
}
const json = (data, status, cors) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors } });

// ---------- safety ----------
/** Only public http(s) URLs: no localhost, private IPs or odd ports. */
export function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  if (u.port && !['80', '443', '8080'].includes(u.port)) return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return null;
  }
  if (h.includes(':')) return null; // IPv6 literals
  return u;
}

async function readLimited(res, max) {
  const len = Number(res.headers.get('content-length') || 0);
  if (len && len > max) throw Object.assign(new Error('too_large'), { code: 'too_large' });
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { reader.cancel(); throw Object.assign(new Error('too_large'), { code: 'too_large' }); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

async function fetchWithTimeout(url, init = {}, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { redirect: 'follow', ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

// ---------- daily limits (per visitor, when LIVINGROOM_KV is bound) ----------
async function takeQuota(env, request, kind, limit) {
  const max = parseInt(limit || '0', 10);
  if (!env.LIVINGROOM_KV || !max) return true;
  const ip = request.headers.get('cf-connecting-ip') || 'anon';
  const day = new Date().toISOString().slice(0, 10);
  const key = `q:${kind}:${day}:${ip}`;
  const n = parseInt((await env.LIVINGROOM_KV.get(key)) || '0', 10);
  if (n >= max) return false;
  await env.LIVINGROOM_KV.put(key, String(n + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

// ---------- import ----------
const clampDim = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0.5 && n < 2000 ? Math.round(n * 10) / 10 : fallback;
};

function guessCategory(text) {
  const t = ` ${String(text || '').toLowerCase()} `;
  const table = [
    ['coffee-table', ['coffee table', 'side table', 'שולחן קפה', 'שולחן סלון', 'שולחן צד']],
    ['sofa', ['sofa', 'couch', 'sectional', 'loveseat', 'ספה', 'ספת']],
    ['armchair', ['armchair', 'lounge chair', 'accent chair', 'recliner', 'כורסה', 'כורסא']],
    ['chair', ['chair', 'stool', 'כיסא', 'כסא', 'שרפרף']],
    ['bed', ['bed ', 'bed,', 'מיטה', 'מיטת']],
    ['table', ['dining table', 'desk', 'table', 'שולחן']],
    ['shelf', ['bookcase', 'bookshelf', 'shelf', 'shelving', 'ספרייה', 'ספריה', 'מדף']],
    ['cabinet', ['sideboard', 'dresser', 'cabinet', 'tv stand', 'tv unit', 'chest of', 'wardrobe', 'שידה', 'מזנון', 'ארון', 'קומודה']],
    ['lamp', ['lamp', 'pendant', 'chandelier', 'מנורה', 'מנורת', 'גוף תאורה']],
    ['plant', ['plant', 'monstera', 'ficus', 'צמח', 'עציץ']],
    ['rug', ['rug', 'carpet', 'שטיח']],
    ['mirror', ['mirror', 'מראה']],
    ['tv', [' tv ', 'television', 'oled', 'qled', 'טלוויזיה']],
    ['art', ['poster', 'print', 'painting', 'canvas', 'wall art', 'פוסטר', 'הדפס', 'ציור', 'תמונה']],
    ['decor', ['vase', 'candle', 'sculpture', 'אגרטל', 'פסל', 'נר']],
  ];
  for (const [cat, words] of table) if (words.some(w => t.includes(w))) return cat;
  return 'object';
}

/** Merges what the page says with what Claude read, into the item the app stores. */
export function buildItem({ url, page, ai }) {
  const name = (ai?.name || page?.name || '').trim() || (() => { try { return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '').replace(/[-_]+/g, ' ').slice(0, 60); } catch { return ''; } })();
  const category = CATEGORIES.includes(ai?.category) ? ai.category : guessCategory(`${page?.name || ''} ${page?.description || ''} ${url}`);
  const pd = page?.dims || {};
  const dims = {
    w: clampDim(ai?.width_cm, clampDim(pd.w, null)),
    d: clampDim(ai?.depth_cm, clampDim(pd.d, null)),
    h: clampDim(ai?.height_cm, clampDim(pd.h, null)),
  };
  const images = page?.images || [];
  const image = (ai?.image_url && (images.includes(ai.image_url) || !images.length) && safeUrl(ai.image_url)) ? ai.image_url : images[0] || null;
  const price = ai?.price > 0 ? ai.price : page?.price ?? null;
  const currency = (ai?.currency || page?.currency || '').toUpperCase() || null;
  let dimsSource = ai?.dims_source || (page?.dimsFound ? 'page' : null);
  if (!dims.w || !dims.d || !dims.h) dimsSource = dimsSource === 'page' ? 'partial' : dimsSource;
  const hex = /^#[0-9a-f]{6}$/i.test(ai?.color_hex || '') ? ai.color_hex.toLowerCase() : null;
  return {
    name: name.slice(0, 80),
    category,
    dims,
    dimsSource,
    note: ai?.note || null,
    color: hex,
    image,
    images: images.slice(0, 6),
    modelUrl: page?.models?.find(m => /\.glb(\?|$)/i.test(m)) || null,
    source: { url, store: page?.store || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } })(), price, currency, brand: page?.brand || null },
    ai: Boolean(ai),
  };
}

async function handleImport(request, env, cors) {
  const body = await request.json().catch(() => null);
  const u = safeUrl(body?.url);
  if (!u) return json({ error: 'bad_url' }, 400, cors);
  if (!(await takeQuota(env, request, 'import', env.DAILY_IMPORTS))) return json({ error: 'daily_limit' }, 429, cors);
  let page = null;
  let blocked = null;
  try {
    const res = await fetchWithTimeout(u.href, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'he-IL,he;q=0.9,en;q=0.8' } }, 12000);
    if (!res.ok) blocked = `http_${res.status}`;
    else if (!/html|xml/i.test(res.headers.get('content-type') || '')) blocked = 'not_html';
    else {
      const html = new TextDecoder().decode(await readLimited(res, MAX_PAGE));
      page = extractProduct(html, res.url || u.href);
      // pages that are just a bot wall
      if (!page.name && !page.images.length) { blocked = 'empty'; page = null; }
    }
  } catch (e) {
    blocked = e.code || (e.name === 'AbortError' ? 'timeout' : 'fetch_failed');
  }
  let ai = null;
  if (env.ANTHROPIC_API_KEY) {
    try {
      const r = await aiExtract({ url: u.href, page, env });
      if (r && !r.refused) ai = r;
    } catch (e) {
      console.error('ai_extract failed', e?.status, e?.message);
    }
  }
  if (!page && !ai) return json({ error: 'page_blocked', detail: blocked }, 422, cors);
  const item = buildItem({ url: u.href, page, ai });
  console.log(JSON.stringify({ event: 'import', host: u.hostname, blocked, ai: Boolean(ai), dims: item.dims, category: item.category }));
  return json({ item, blocked }, 200, cors);
}

// ---------- proxies ----------
async function handleProxy(request, env, cors, kind) {
  const u = safeUrl(new URL(request.url).searchParams.get('u'));
  if (!u) return json({ error: 'bad_url' }, 400, cors);
  let res;
  try {
    res = await fetchWithTimeout(u.href, { headers: { 'user-agent': UA, accept: kind === 'img' ? 'image/avif,image/webp,image/*,*/*;q=0.8' : '*/*', referer: u.origin + '/' } }, 20000);
  } catch { return json({ error: 'fetch_failed' }, 502, cors); }
  if (!res.ok) return json({ error: `http_${res.status}` }, 502, cors);
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (kind === 'img' && !type.startsWith('image/')) return json({ error: 'not_image' }, 415, cors);
  if (kind === 'file' && !(/\.(glb|gltf)(\?|$)/i.test(u.pathname) || /model\/gltf|octet-stream/.test(type))) return json({ error: 'not_model' }, 415, cors);
  const max = kind === 'img' ? MAX_IMAGE : MAX_MODEL;
  const len = Number(res.headers.get('content-length') || 0);
  if (len > max) return json({ error: 'too_large' }, 413, cors);
  return new Response(res.body, {
    status: 200,
    headers: { 'content-type': kind === 'img' ? type : (type.includes('gltf') ? type : 'model/gltf-binary'), 'cache-control': 'public, max-age=86400', ...cors },
  });
}

// ---------- AI 3D models ----------
function dataUrlBytes(s) {
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: m[1] === 'image/jpg' ? 'image/jpeg' : m[1] };
}

async function handleModelStart(request, env, cors) {
  if (!env.TRIPO_API_KEY) return json({ error: 'models_not_configured' }, 503, cors);
  const body = await request.json().catch(() => null);
  let img = null;
  if (body?.imageData) {
    img = dataUrlBytes(body.imageData);
    if (!img || img.bytes.length > MAX_IMAGE) return json({ error: 'bad_image' }, 400, cors);
  } else {
    const u = safeUrl(body?.imageUrl);
    if (!u) return json({ error: 'bad_url' }, 400, cors);
    try {
      const res = await fetchWithTimeout(u.href, { headers: { 'user-agent': UA, accept: 'image/png,image/jpeg,image/webp,image/*', referer: u.origin + '/' } }, 20000);
      const type = (res.headers.get('content-type') || '').toLowerCase().split(';')[0];
      if (!res.ok || !type.startsWith('image/')) return json({ error: 'bad_image' }, 400, cors);
      img = { bytes: await readLimited(res, MAX_IMAGE), mime: /png|webp/.test(type) ? type : 'image/jpeg' };
    } catch { return json({ error: 'bad_image' }, 400, cors); }
  }
  if (!(await takeQuota(env, request, 'model', env.DAILY_MODELS))) return json({ error: 'daily_limit' }, 429, cors);
  try {
    const token = await uploadImage(img.bytes, img.mime, env);
    const task = await createTask(token, env);
    console.log(JSON.stringify({ event: 'model_start', task }));
    return json({ task }, 200, cors);
  } catch (e) {
    if (e instanceof TripoError) return json({ error: e.code }, e.code === 'no_credit' ? 402 : 502, cors);
    throw e;
  }
}

async function handleModelStatus(task, env, cors) {
  if (!env.TRIPO_API_KEY) return json({ error: 'models_not_configured' }, 503, cors);
  if (!/^[\w-]{6,80}$/.test(task)) return json({ error: 'bad_task' }, 400, cors);
  try {
    const t = await getTask(task, env);
    return json({ status: t.status, progress: t.progress, preview: t.preview, ready: Boolean(t.glb) }, 200, cors);
  } catch (e) {
    if (e instanceof TripoError) return json({ error: e.code }, 502, cors);
    throw e;
  }
}

async function handleModelFile(task, env, cors) {
  if (!env.TRIPO_API_KEY) return json({ error: 'models_not_configured' }, 503, cors);
  if (!/^[\w-]{6,80}$/.test(task)) return json({ error: 'bad_task' }, 400, cors);
  const t = await getTask(task, env).catch(() => null);
  if (!t?.glb) return json({ error: 'not_ready' }, 409, cors);
  const res = await fetchWithTimeout(t.glb, {}, 30000).catch(() => null);
  if (!res?.ok) return json({ error: 'download_failed' }, 502, cors);
  return new Response(res.body, { status: 200, headers: { 'content-type': 'model/gltf-binary', 'cache-control': 'private, max-age=3600', ...cors } });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!originAllowed(request, env)) return json({ error: 'forbidden_origin' }, 403, cors);
    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/api/health' && request.method === 'GET') {
        return json({ service: 'livingroom', ai: Boolean(env.ANTHROPIC_API_KEY), model: env.LIVINGROOM_MODEL || DEFAULT_MODEL, models3d: Boolean(env.TRIPO_API_KEY), limits: Boolean(env.LIVINGROOM_KV) }, 200, cors);
      }
      if (pathname === '/api/import' && request.method === 'POST') return await handleImport(request, env, cors);
      if (pathname === '/api/img' && request.method === 'GET') return await handleProxy(request, env, cors, 'img');
      if (pathname === '/api/file' && request.method === 'GET') return await handleProxy(request, env, cors, 'file');
      if (pathname === '/api/model' && request.method === 'POST') return await handleModelStart(request, env, cors);
      const m = pathname.match(/^\/api\/model\/([^/]+)(\/file)?$/);
      if (m && request.method === 'GET') return m[2] ? await handleModelFile(decodeURIComponent(m[1]), env, cors) : await handleModelStatus(decodeURIComponent(m[1]), env, cors);
      return json({ error: 'not_found' }, 404, cors);
    } catch (err) {
      console.error('request failed', err?.message);
      return json({ error: 'server_error' }, 500, cors);
    }
  },
};
