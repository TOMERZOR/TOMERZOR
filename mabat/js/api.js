// Talking to the market server. The last board is kept so the app opens instantly and offline.

import { config } from './config.js';

const BOARD_CACHE = 'mabat-board';

// For local testing only: ?server=http://127.0.0.1:8787
function serverUrl() {
  try {
    const q = new URLSearchParams(location.search).get('server');
    if (q && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(q)) sessionStorage.setItem('mabat-server', q);
    return sessionStorage.getItem('mabat-server') || config.server;
  } catch {
    return config.server;
  }
}

export const server = serverUrl();
export const hasServer = () => !!server;

async function call(path, init) {
  if (!server) throw Object.assign(new Error('no server'), { noServer: true });
  const res = await fetch(`${server}${path}`, { cache: 'no-store', ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

export function cachedBoard() {
  try { return JSON.parse(localStorage.getItem(BOARD_CACHE) || 'null'); } catch { return null; }
}

export async function board() {
  const data = await call('/board');
  try { localStorage.setItem(BOARD_CACHE, JSON.stringify(data)); } catch {}
  return data;
}

const details = new Map();
export async function detail(t, fresh = false) {
  const hit = details.get(t);
  if (!fresh && hit && Date.now() - hit.at < 45000) return hit.data;
  const data = await call(`/t/${encodeURIComponent(t)}`);
  details.set(t, { at: Date.now(), data });
  return data;
}
export const peekDetail = t => details.get(t)?.data || null;

export const search = q => call(`/search?q=${encodeURIComponent(q)}`).then(d => d.results || []);
export const deviceKey = id => call(`/d/${id}/key`);
export const deviceGet = id => call(`/d/${id}`);
export const deviceTest = id => call(`/d/${id}/test`, { method: 'POST' });
export const deviceDelete = id => call(`/d/${id}`, { method: 'DELETE' });
export const devicePut = (id, body) => call(`/d/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
