// היכרות בקליק server (Cloudflare Worker). Holds the profiles, who follows whom and the activity
// feed. All of it lives in one Durable Object with SQLite, so mutual connections are a quick
// lookup. The rules (who sees the full service path, what counts as mutual, what two people have
// in common) are in ../js/core.js, shared with the app's demo mode.
//
// Routes (Authorization: Bearer <id>.<token> where marked *):
//   GET    /health
//   POST   /register             { profile, photo? } -> { id, token, key, me }
//   GET    /me *                 own profile, key, counts, unread
//   PUT    /me *                 { profile?, photo? (data URL, or null to remove) }
//   POST   /me/key *             a new QR code (the old one stops opening the full profile)
//   DELETE /me *                 delete the account
//   GET    /u/<id>[?k=<key>]     a profile; the full path with the key or once connected
//   GET    /u/<id>/<friends|followers|following> *
//   POST   /u/<id>/follow *      { key? } (the key marks that they met, i.e. scanned the code)
//   DELETE /u/<id>/follow *
//   DELETE /u/<id>/follower *    remove someone who follows you
//   POST   /u/<id>/chapcha *     a צ׳פחה (quick hello), one every 6 hours
//   GET    /search?q= *
//   GET    /feed *               activity, people you may know, friends' stories
//   GET    /p/<id>               profile photo
//   GET    /posts[?before=] *    posts by people you follow, and yours
//   POST   /posts *              { image (data URL), caption, ratio }
//   GET    /posts/<id> *  · DELETE /posts/<id> *  · POST|DELETE /posts/<id>/like *
//   GET    /u/<id>/posts[?before=] *
//   GET    /stories *            the story tray (24 hours)
//   POST   /stories *            { image? , text?, bg }
//   DELETE /stories/<id> *  · POST /stories/<id>/seen *  · GET /stories/<id>/viewers *  · POST|DELETE /stories/<id>/like *
//   GET    /m/<id>               a post or story image
//   GET    /chats *              conversations: the other person, the last message, unread
//   GET    /chats/<id>[?before=|?after=] *   messages, newest first (and marks them read)
//   POST   /chats/<id> *         { text, story? }
//   GET    /push/key             the server's VAPID public key
//   POST   /push *               { subscription }  ·  POST /push/remove * { endpoint }

import { Network, ApiError, indexFields } from '../js/core.js';

const MAX_BODY = 600 * 1024;
const REGISTER_PER_HOUR = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'hekerut-api' });
    const stub = env.NETWORK.get(env.NETWORK.idFromName('main'));
    return stub.fetch(req);
  },
};

const finite = n => (Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER);

export function randomString(n) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const out = [];
  while (out.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) if (b < 248 && out.length < n) out.push(abc[b % 62]);
  }
  return out.join('');
}

// ---------- Storage ----------

export class SqlStore {
  constructor(sql) {
    this.sql = sql;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, token TEXT, key TEXT, profile TEXT, created INTEGER, updated INTEGER, photo_ver INTEGER,
        name_n TEXT, unit1 TEXT, unit2 TEXT, prep TEXT, tironut TEXT, city TEXT);
      CREATE INDEX IF NOT EXISTS users_unit1 ON users(unit1);
      CREATE INDEX IF NOT EXISTS users_unit2 ON users(unit2);
      CREATE INDEX IF NOT EXISTS users_prep ON users(prep);
      CREATE INDEX IF NOT EXISTS users_tironut ON users(tironut);
      CREATE INDEX IF NOT EXISTS users_city ON users(city);
      CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, data TEXT);
      CREATE TABLE IF NOT EXISTS follows (a TEXT, b TEXT, met INTEGER, at INTEGER, PRIMARY KEY (a, b));
      CREATE INDEX IF NOT EXISTS follows_b ON follows(b);
      CREATE TABLE IF NOT EXISTS events (n INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, kind TEXT, actor TEXT, data TEXT, at INTEGER, read INTEGER DEFAULT 0);
      CREATE INDEX IF NOT EXISTS events_uid ON events(uid, n);
      CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, owner TEXT, data TEXT);
      CREATE INDEX IF NOT EXISTS media_owner ON media(owner);
      CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, uid TEXT, media TEXT, ratio REAL, caption TEXT, at INTEGER);
      CREATE INDEX IF NOT EXISTS posts_uid ON posts(uid, at);
      CREATE INDEX IF NOT EXISTS posts_at ON posts(at);
      CREATE TABLE IF NOT EXISTS likes (post TEXT, uid TEXT, at INTEGER, PRIMARY KEY (post, uid));
      CREATE INDEX IF NOT EXISTS likes_uid ON likes(uid);
      CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, uid TEXT, media TEXT, text TEXT, bg TEXT, at INTEGER);
      CREATE INDEX IF NOT EXISTS stories_uid ON stories(uid, at);
      CREATE INDEX IF NOT EXISTS stories_at ON stories(at);
      CREATE TABLE IF NOT EXISTS views (story TEXT, uid TEXT, at INTEGER, PRIMARY KEY (story, uid));
      CREATE INDEX IF NOT EXISTS views_uid ON views(uid);
      CREATE TABLE IF NOT EXISTS messages (n INTEGER PRIMARY KEY AUTOINCREMENT, conv TEXT, sender TEXT, recipient TEXT, text TEXT, at INTEGER, read INTEGER DEFAULT 0, meta TEXT);
      CREATE INDEX IF NOT EXISTS messages_conv ON messages(conv, n);
      CREATE INDEX IF NOT EXISTS messages_recipient ON messages(recipient, read);
      CREATE INDEX IF NOT EXISTS messages_sender ON messages(sender, at);
      CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, uid TEXT, p256dh TEXT, auth TEXT, at INTEGER);
      CREATE INDEX IF NOT EXISTS subs_uid ON subs(uid);
      CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
    `);
  }
  rows(q, ...args) { return this.sql.exec(q, ...args).toArray(); }
  toUser(r) {
    return r ? { id: r.id, token: r.token, key: r.key, profile: JSON.parse(r.profile), created: r.created, updated: r.updated, photoVer: r.photo_ver } : null;
  }
  user(id) { return this.toUser(this.rows('SELECT * FROM users WHERE id = ?', id)[0]); }
  putUser(u) {
    const i = indexFields(u.profile);
    this.sql.exec(`INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      u.id, u.token, u.key, JSON.stringify(u.profile), u.created, u.updated, u.photoVer || 0, i.name, i.unit1, i.unit2, i.prep, i.tironut, i.city);
  }
  deleteUser(id) {
    this.sql.exec('DELETE FROM users WHERE id = ?', id);
    this.sql.exec('DELETE FROM photos WHERE id = ?', id);
    this.sql.exec('DELETE FROM follows WHERE a = ? OR b = ?', id, id);
    this.sql.exec('DELETE FROM events WHERE uid = ? OR actor = ?', id, id);
    this.sql.exec('DELETE FROM likes WHERE uid = ? OR post IN (SELECT id FROM posts WHERE uid = ?)', id, id);
    this.sql.exec('DELETE FROM views WHERE uid = ? OR story IN (SELECT id FROM stories WHERE uid = ?)', id, id);
    this.sql.exec('DELETE FROM posts WHERE uid = ?', id);
    this.sql.exec('DELETE FROM stories WHERE uid = ?', id);
    this.sql.exec('DELETE FROM media WHERE owner = ?', id);
    this.sql.exec('DELETE FROM messages WHERE sender = ? OR recipient = ?', id, id);
    this.sql.exec('DELETE FROM subs WHERE uid = ?', id);
  }
  putMedia(id, owner, data) { this.sql.exec('INSERT OR REPLACE INTO media VALUES (?, ?, ?)', id, owner, data); }
  media(id) { return this.rows('SELECT data FROM media WHERE id = ?', id)[0]?.data || null; }
  deleteMedia(id) { this.sql.exec('DELETE FROM media WHERE id = ?', id); }
  putPost(p) { this.sql.exec('INSERT OR REPLACE INTO posts VALUES (?, ?, ?, ?, ?, ?)', p.id, p.uid, p.media, p.ratio, p.caption, p.at); }
  post(id) { return this.rows('SELECT * FROM posts WHERE id = ?', id)[0] || null; }
  deletePost(id) {
    this.sql.exec('DELETE FROM posts WHERE id = ?', id);
    this.sql.exec('DELETE FROM likes WHERE post = ?', id);
  }
  postsBy(uid, limit, before) { return this.rows('SELECT * FROM posts WHERE uid = ? AND at < ? ORDER BY at DESC LIMIT ?', uid, finite(before), limit); }
  postCount(uid) { return this.rows('SELECT COUNT(*) AS c FROM posts WHERE uid = ?', uid)[0].c; }
  feedPosts(viewer, limit, before) {
    return this.rows('SELECT * FROM posts WHERE (uid = ? OR uid IN (SELECT b FROM follows WHERE a = ?)) AND at < ? ORDER BY at DESC LIMIT ?', viewer, viewer, finite(before), limit);
  }
  putLike(post, uid, at) { this.sql.exec('INSERT OR IGNORE INTO likes VALUES (?, ?, ?)', post, uid, at); }
  deleteLike(post, uid) { this.sql.exec('DELETE FROM likes WHERE post = ? AND uid = ?', post, uid); }
  liked(post, uid) { return this.rows('SELECT 1 AS x FROM likes WHERE post = ? AND uid = ?', post, uid).length > 0; }
  likeAt(post, uid) { return this.rows('SELECT at FROM likes WHERE post = ? AND uid = ?', post, uid)[0]?.at ?? null; }
  likeCount(post) { return this.rows('SELECT COUNT(*) AS c FROM likes WHERE post = ?', post)[0].c; }
  putStory(st) { this.sql.exec('INSERT OR REPLACE INTO stories VALUES (?, ?, ?, ?, ?, ?)', st.id, st.uid, st.media, st.text, st.bg, st.at); }
  story(id) { return this.rows('SELECT * FROM stories WHERE id = ?', id)[0] || null; }
  deleteStory(id) {
    this.sql.exec('DELETE FROM stories WHERE id = ?', id);
    this.sql.exec('DELETE FROM views WHERE story = ?', id);
  }
  storiesBy(uid, since) { return this.rows('SELECT * FROM stories WHERE uid = ? AND at > ?', uid, since); }
  storyFeed(viewer, since) {
    return this.rows('SELECT * FROM stories WHERE (uid = ? OR uid IN (SELECT b FROM follows WHERE a = ?)) AND at > ? ORDER BY at ASC LIMIT 600', viewer, viewer, since);
  }
  purgeStories(before, limit) {
    const old = this.rows('SELECT id, media FROM stories WHERE at <= ? LIMIT ?', before, limit);
    for (const r of old) this.deleteStory(r.id);
    return old.map(r => r.media);
  }
  putView(story, uid, at) { this.sql.exec('INSERT OR IGNORE INTO views VALUES (?, ?, ?)', story, uid, at); }
  seen(story, uid) { return this.rows('SELECT 1 AS x FROM views WHERE story = ? AND uid = ?', story, uid).length > 0; }
  viewCount(story) { return this.rows('SELECT COUNT(*) AS c FROM views WHERE story = ?', story)[0].c; }
  views(story) { return this.rows('SELECT uid, at FROM views WHERE story = ? ORDER BY at DESC LIMIT 500', story); }
  toMessage(r) { return { ...r, read: !!r.read, meta: r.meta ? JSON.parse(r.meta) : null }; }
  addMessage(m) {
    this.sql.exec('INSERT INTO messages (conv, sender, recipient, text, at, meta) VALUES (?, ?, ?, ?, ?, ?)', m.conv, m.sender, m.recipient, m.text, m.at, m.meta ? JSON.stringify(m.meta) : null);
    return this.rows('SELECT last_insert_rowid() AS n')[0].n;
  }
  messages(conv, limit, before, after) {
    return this.rows('SELECT * FROM messages WHERE conv = ? AND n < ? AND n > ? ORDER BY n DESC LIMIT ?', conv, finite(before), after || 0, limit).map(r => this.toMessage(r));
  }
  hasMessageFrom(conv, sender) { return this.rows('SELECT 1 AS x FROM messages WHERE conv = ? AND sender = ? LIMIT 1', conv, sender).length > 0; }
  sentSince(uid, since) { return this.rows('SELECT COUNT(*) AS c FROM messages WHERE sender = ? AND at > ?', uid, since)[0].c; }
  markConvRead(conv, uid) { this.sql.exec('UPDATE messages SET read = 1 WHERE conv = ? AND recipient = ? AND read = 0', conv, uid); }
  unreadMessages(uid) { return this.rows('SELECT COUNT(*) AS c FROM messages WHERE recipient = ? AND read = 0', uid)[0].c; }
  convs(uid) {
    const rows = this.rows(`SELECT m.*, (SELECT COUNT(*) FROM messages u WHERE u.conv = m.conv AND u.recipient = ? AND u.read = 0) AS unread_n
      FROM messages m JOIN (SELECT conv, MAX(n) AS n FROM messages WHERE sender = ? OR recipient = ? GROUP BY conv) last ON last.n = m.n
      ORDER BY m.n DESC LIMIT 200`, uid, uid, uid);
    return rows.map(r => { const [a, b] = r.conv.split('|'); return { a, b, last: this.toMessage(r), unread: r.unread_n }; });
  }
  putSub(uid, sub) { this.sql.exec('INSERT OR REPLACE INTO subs VALUES (?, ?, ?, ?, ?)', sub.endpoint, uid, sub.keys.p256dh, sub.keys.auth, Date.now()); }
  deleteSub(endpoint) { this.sql.exec('DELETE FROM subs WHERE endpoint = ?', endpoint); }
  subsOf(uid) { return this.rows('SELECT * FROM subs WHERE uid = ? ORDER BY at DESC LIMIT 10', uid).map(r => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } })); }
  setting(k) { const r = this.rows('SELECT v FROM settings WHERE k = ?', k)[0]; return r ? JSON.parse(r.v) : null; }
  putSetting(k, v) { this.sql.exec('INSERT OR REPLACE INTO settings VALUES (?, ?)', k, JSON.stringify(v)); }
  photo(id) { return this.rows('SELECT data FROM photos WHERE id = ?', id)[0]?.data || null; }
  putPhoto(id, data) {
    if (data) this.sql.exec('INSERT OR REPLACE INTO photos VALUES (?, ?)', id, data);
    else this.sql.exec('DELETE FROM photos WHERE id = ?', id);
  }
  follow(a, b) {
    const r = this.rows('SELECT met, at FROM follows WHERE a = ? AND b = ?', a, b)[0];
    return r ? { met: !!r.met, at: r.at } : null;
  }
  putFollow(a, b, f) { this.sql.exec('INSERT OR REPLACE INTO follows VALUES (?, ?, ?, ?)', a, b, f.met ? 1 : 0, f.at); }
  deleteFollow(a, b) { this.sql.exec('DELETE FROM follows WHERE a = ? AND b = ?', a, b); }
  following(a) { return this.rows('SELECT b FROM follows WHERE a = ?', a).map(r => r.b); }
  followers(b) { return this.rows('SELECT a FROM follows WHERE b = ?', b).map(r => r.a); }
  search(n, limit) {
    const like = `%${n.replace(/[%_\\]/g, c => `\\${c}`)}%`;
    return this.rows(`SELECT * FROM users WHERE name_n LIKE ? ESCAPE '\\' OR unit1 = ? OR unit2 = ? OR prep LIKE ? ESCAPE '\\' LIMIT ?`, like, n, n, like, limit).map(r => this.toUser(r));
  }
  match(field, value, limit) {
    if (!['unit1', 'unit2', 'prep', 'tironut', 'city'].includes(field) || !value) return [];
    return this.rows(`SELECT id FROM users WHERE ${field} = ? ORDER BY updated DESC LIMIT ?`, value, limit).map(r => r.id);
  }
  addEvent(to, e, max) {
    this.sql.exec('INSERT INTO events (uid, kind, actor, data, at) VALUES (?, ?, ?, ?, ?)', to, e.kind, e.actor, JSON.stringify(e.data || {}), e.at);
    this.sql.exec('DELETE FROM events WHERE uid = ? AND n NOT IN (SELECT n FROM events WHERE uid = ? ORDER BY n DESC LIMIT ?)', to, to, max);
  }
  events(to, limit) {
    return this.rows('SELECT * FROM events WHERE uid = ? ORDER BY n DESC LIMIT ?', to, limit)
      .map(r => ({ id: String(r.n), kind: r.kind, actor: r.actor, data: JSON.parse(r.data || '{}'), at: r.at, read: !!r.read }));
  }
  unread(to) { return this.rows('SELECT COUNT(*) AS c FROM events WHERE uid = ? AND read = 0', to)[0].c; }
  markRead(to) { this.sql.exec('UPDATE events SET read = 1 WHERE uid = ? AND read = 0', to); }
}

// ---------- Routes ----------

export async function handle(req, net, limiter, push = noPush) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const m = req.method;

  if (m === 'GET' && (parts[0] === 'p' || parts[0] === 'm') && parts.length === 2) {
    const data = parts[0] === 'p' ? net.s.photo(parts[1]) : net.s.media(parts[1]);
    if (!data) return new Response('not found', { status: 404, headers: CORS });
    const [head, b64] = data.split(',');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return new Response(bytes, { headers: { ...CORS, 'Content-Type': head.slice(5, head.indexOf(';')), 'Cache-Control': 'public, max-age=31536000, immutable' } });
  }

  let body = {};
  if (m === 'POST' || m === 'PUT') {
    const text = await req.text();
    if (text.length > MAX_BODY) throw new ApiError(413, 'too_big');
    try { body = text ? JSON.parse(text) : {}; } catch { throw new ApiError(400, 'json'); }
  }

  const authHeader = req.headers.get('Authorization') || '';
  const [aid, atoken] = authHeader.replace(/^Bearer\s+/i, '').split('.');
  const viewer = () => (aid ? net.auth(aid, atoken) : null);
  const me = () => net.auth(aid, atoken);

  if (m === 'POST' && parts[0] === 'register' && parts.length === 1) {
    if (!limiter(req.headers.get('CF-Connecting-IP') || 'local')) throw new ApiError(429, 'slow_down');
    return json(net.register(body));
  }
  if (parts[0] === 'me') {
    if (parts.length === 1 && m === 'GET') return json(net.me(me()));
    if (parts.length === 1 && m === 'PUT') return json(net.update(me(), body));
    if (parts.length === 1 && m === 'DELETE') return json(net.remove(me()));
    if (parts[1] === 'key' && m === 'POST') return json(net.newKey(me()));
  }
  if (parts[0] === 'u' && parts[1]) {
    const id = parts[1];
    if (parts.length === 2 && m === 'GET') return json(net.view(viewer(), id, url.searchParams.get('k') || ''));
    if (parts.length === 3 && m === 'GET' && ['friends', 'followers', 'following'].includes(parts[2])) return json(net.list(me(), id, parts[2]));
    if (parts[2] === 'follow' && m === 'POST') return json(net.follow(me(), id, String(body.key || '')));
    if (parts[2] === 'follow' && m === 'DELETE') return json(net.unfollow(me(), id));
    if (parts[2] === 'follower' && m === 'DELETE') return json(net.removeFollower(me(), id));
    if (parts[2] === 'chapcha' && m === 'POST') return json(net.chapcha(me(), id));
  }
  if (parts[0] === 'posts') {
    const before = Number(url.searchParams.get('before')) || Infinity;
    if (parts.length === 1 && m === 'GET') return json(net.posts(me(), before));
    if (parts.length === 1 && m === 'POST') return json(net.createPost(me(), body));
    if (parts.length === 2 && m === 'GET') return json(net.post(me(), parts[1]));
    if (parts.length === 2 && m === 'DELETE') return json(net.deletePost(me(), parts[1]));
    if (parts[2] === 'like' && (m === 'POST' || m === 'DELETE')) return json(net.like(me(), parts[1], m === 'POST'));
  }
  if (parts[0] === 'stories') {
    if (parts.length === 1 && m === 'GET') return json(net.tray(me()));
    if (parts.length === 1 && m === 'POST') return json(net.createStory(me(), body));
    if (parts.length === 2 && m === 'DELETE') return json(net.deleteStory(me(), parts[1]));
    if (parts[2] === 'seen' && m === 'POST') return json(net.seeStory(me(), parts[1]));
    if (parts[2] === 'viewers' && m === 'GET') return json(net.storyViewers(me(), parts[1]));
    if (parts[2] === 'like' && (m === 'POST' || m === 'DELETE')) return json(net.likeStory(me(), parts[1], m === 'POST'));
  }
  if (parts[0] === 'u' && parts[1] && parts[2] === 'posts' && m === 'GET') return json(net.userPosts(me(), parts[1], Number(url.searchParams.get('before')) || Infinity));
  if (parts[0] === 'chats') {
    if (parts.length === 1 && m === 'GET') return json(net.chats(me()));
    if (parts.length === 2 && m === 'GET') return json(net.chat(me(), parts[1], { before: Number(url.searchParams.get('before')) || Infinity, after: Number(url.searchParams.get('after')) || 0 }));
    if (parts.length === 2 && m === 'POST') return json(net.send(me(), parts[1], { text: body.text, story: !!body.story }));
  }
  if (parts[0] === 'push') {
    if (parts[1] === 'key' && m === 'GET') return json({ key: (await push.keys()).publicKey });
    if (parts.length === 1 && m === 'POST') { push.subscribe(me(), body.subscription); return json({ ok: true }); }
    if (parts[1] === 'remove' && m === 'POST') { me(); net.s.deleteSub(String(body.endpoint || '')); return json({ ok: true }); }
  }
  if (parts[0] === 'search' && m === 'GET') return json(net.search(me(), url.searchParams.get('q') || ''));
  if (parts[0] === 'feed' && m === 'GET') return json(net.feed(me()));
  throw new ApiError(404, 'route');
}

export function makeLimiter(perHour, now = () => Date.now()) {
  const hits = new Map();
  return key => {
    const t = now();
    const list = (hits.get(key) || []).filter(x => t - x < 3600e3);
    if (list.length >= perHour) { hits.set(key, list); return false; }
    list.push(t);
    hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

export class NetworkDO {
  constructor(ctx) {
    this.ctx = ctx;
    this.store = new SqlStore(ctx.storage.sql);
    this.limiter = makeLimiter(REGISTER_PER_HOUR);
    this.origin = '';
    this.push = new Pusher(this.store);
    this.net = new Network(this.store, {
      random: randomString,
      photoUrl: (id, ver) => (ver ? `${this.origin}/p/${id}?v=${ver}` : null),
      mediaUrl: id => (id ? `${this.origin}/m/${id}` : null),
      notify: (to, note) => this.push.queue(to, note),
    });
  }
  async fetch(req) {
    this.origin = new URL(req.url).origin;
    try {
      return await handle(req, this.net, this.limiter, this.push);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.code }, e.status);
      console.error(e);
      return json({ error: 'server' }, 500);
    } finally {
      // Notifications go out after the answer, so sending a message stays quick.
      const sending = this.push.flush();
      if (sending) this.ctx.waitUntil(sending);
    }
  }
}

// ---------- Phone notifications (Web Push: RFC 8291 encryption, RFC 8292 VAPID) ----------

const SITE = 'https://hekerut.moffy-app.workers.dev';
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const noPush = { keys: async () => ({ publicKey: '' }), subscribe() {}, queue() {}, flush() { return null; } };

const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)), c => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

export async function encryptPayload(subscription, text) {
  const uaPublic = unb64u(subscription.keys.p256dh);
  const authSecret = unb64u(subscription.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic, cipher);
}

export function validSubscription(sub) {
  try {
    const u = new URL(sub.endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some(r => r.test(u.hostname)) && /^[A-Za-z0-9_-]{80,100}$/.test(sub.keys.p256dh) && /^[A-Za-z0-9_-]{16,32}$/.test(sub.keys.auth);
  } catch { return false; }
}

export class Pusher {
  constructor(store) { this.s = store; this.pending = []; }
  // One VAPID key pair for the whole server, made on first use and kept in the database.
  async keys() {
    let k = this.s.setting('vapid');
    if (!k) {
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      k = { privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey), publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)) };
      this.s.putSetting('vapid', k);
    }
    return k;
  }
  subscribe(u, sub) {
    if (!validSubscription(sub)) throw new ApiError(400, 'subscription');
    this.s.putSub(u.id, sub);
  }
  queue(to, note) { this.pending.push({ to, note }); }
  flush() {
    if (!this.pending.length) return null;
    const jobs = this.pending;
    this.pending = [];
    return (async () => {
      const keys = await this.keys();
      for (const { to, note } of jobs) {
        for (const sub of this.s.subsOf(to)) {
          try {
            const status = await sendPush(sub, keys, note);
            if (status === 404 || status === 410) this.s.deleteSub(sub.endpoint);
          } catch (e) { console.error('push', e); }
        }
      }
    })();
  }
}

async function sendPush(subscription, keys, note) {
  const privateKey = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(subscription.endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SITE })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(`${header}.${claims}`));
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${header}.${claims}.${b64u(sig)}, k=${keys.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
      ...(note.tag ? { Topic: note.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
    },
    body: await encryptPayload(subscription, JSON.stringify(note)),
  });
  return res.status;
}
