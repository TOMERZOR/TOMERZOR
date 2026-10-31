// Talks to the Living Room server (server/): reads product pages, proxies images and generates
// 3D models from photos. Without a server the app still works: items are added by photo or by hand.
const cfg = window.LIVINGROOM_CONFIG || {};
export const API = (cfg.api || '').replace(/\/$/, '');
export const hasServer = () => Boolean(API);

/** Remote images go through the server so they can be drawn on a canvas (most stores block that). */
export function proxied(url) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:') || !API) return url;
  try { if (new URL(url).origin === location.origin) return url; } catch { return url; }
  return `${API}/api/img?u=${encodeURIComponent(url)}`;
}

async function call(path, { method = 'GET', body, timeout = 45000 } = {}) {
  if (!API) throw Object.assign(new Error('no_server'), { code: 'no_server' });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `http_${res.status}`), { code: data.error || `http_${res.status}`, data });
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error('timeout'), { code: 'timeout' });
    throw e;
  } finally { clearTimeout(t); }
}

let healthP = null;
export function health() {
  if (!API) return Promise.resolve(null);
  healthP ||= call('/api/health', { timeout: 8000 }).catch(() => null);
  return healthP;
}

/** Reads a product page: name, photo, price, real dimensions, category, and a 3D model if the page has one. */
export const importUrl = url => call('/api/import', { method: 'POST', body: { url }, timeout: 90000 });

/** Starts an AI 3D model from a photo (a URL or a data: URL). Returns { task }. */
export const startModel = ({ imageUrl, imageData }) => call('/api/model', { method: 'POST', body: { imageUrl, imageData }, timeout: 60000 });
/** { status: queued|running|success|failed, progress: 0..100 } */
export const modelStatus = task => call(`/api/model/${encodeURIComponent(task)}`, { timeout: 20000 });
export const modelFileUrl = task => `${API}/api/model/${encodeURIComponent(task)}/file`;
export const remoteFileUrl = url => `${API}/api/file?u=${encodeURIComponent(url)}`;
