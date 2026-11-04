// Talks to the network: the server when js/config.js has its address, otherwise the demo in
// this browser (js/local.js). Also keeps this phone's login (id + secret token).

import { config } from './config.js';
import { LocalApi } from './local.js';

const SESSION = 'hekerut.session';

export const demo = !config.server;

export function session() {
  try { return JSON.parse(localStorage.getItem(SESSION)) || null; } catch { return null; }
}
export function saveSession(s) {
  try { if (s) localStorage.setItem(SESSION, JSON.stringify(s)); else localStorage.removeItem(SESSION); } catch {}
}

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

class RemoteApi {
  constructor(base) { this.base = base.replace(/\/$/, ''); }
  async call(method, path, s, body) {
    let res;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.id}.${s.token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new HttpError(0, 'offline');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpError(res.status, data.error || 'error');
    return data;
  }
  me(s) { return this.call('GET', '/me', s); }
  register(body) { return this.call('POST', '/register', null, body); }
  update(s, body) { return this.call('PUT', '/me', s, body); }
  newKey(s) { return this.call('POST', '/me/key', s); }
  remove(s) { return this.call('DELETE', '/me', s); }
  view(s, id, key) { return this.call('GET', `/u/${encodeURIComponent(id)}${key ? `?k=${encodeURIComponent(key)}` : ''}`, s); }
  list(s, id, kind) { return this.call('GET', `/u/${encodeURIComponent(id)}/${kind}`, s); }
  search(s, q) { return this.call('GET', `/search?q=${encodeURIComponent(q)}`, s); }
  feed(s) { return this.call('GET', '/feed', s); }
  follow(s, id, key) { return this.call('POST', `/u/${encodeURIComponent(id)}/follow`, s, { key }); }
  unfollow(s, id) { return this.call('DELETE', `/u/${encodeURIComponent(id)}/follow`, s); }
  removeFollower(s, id) { return this.call('DELETE', `/u/${encodeURIComponent(id)}/follower`, s); }
  chapcha(s, id) { return this.call('POST', `/u/${encodeURIComponent(id)}/chapcha`, s); }
  createPost(s, body) { return this.call('POST', '/posts', s, body); }
  deletePost(s, id) { return this.call('DELETE', `/posts/${encodeURIComponent(id)}`, s); }
  like(s, id, on) { return this.call(on ? 'POST' : 'DELETE', `/posts/${encodeURIComponent(id)}/like`, s); }
  posts(s, before) { return this.call('GET', `/posts${before ? `?before=${before}` : ''}`, s); }
  userPosts(s, id, before) { return this.call('GET', `/u/${encodeURIComponent(id)}/posts${before ? `?before=${before}` : ''}`, s); }
  post(s, id) { return this.call('GET', `/posts/${encodeURIComponent(id)}`, s); }
  createStory(s, body) { return this.call('POST', '/stories', s, body); }
  tray(s) { return this.call('GET', '/stories', s); }
  seeStory(s, id) { return this.call('POST', `/stories/${encodeURIComponent(id)}/seen`, s); }
  storyViewers(s, id) { return this.call('GET', `/stories/${encodeURIComponent(id)}/viewers`, s); }
  deleteStory(s, id) { return this.call('DELETE', `/stories/${encodeURIComponent(id)}`, s); }
  likeStory(s, id, on) { return this.call(on ? 'POST' : 'DELETE', `/stories/${encodeURIComponent(id)}/like`, s); }
  chats(s) { return this.call('GET', '/chats', s); }
  chat(s, id, { before, after } = {}) { return this.call('GET', `/chats/${encodeURIComponent(id)}${before ? `?before=${before}` : after ? `?after=${after}` : ''}`, s); }
  send(s, id, body) { return this.call('POST', `/chats/${encodeURIComponent(id)}`, s, body); }
  pushKey() { return this.call('GET', '/push/key'); }
  subscribe(s, subscription) { return this.call('POST', '/push', s, { subscription }); }
  unsubscribe(s, endpoint) { return this.call('POST', '/push/remove', s, { endpoint }); }
  onChange() {}
  reset() {}
}

export const api = demo ? new LocalApi() : new RemoteApi(config.server);
