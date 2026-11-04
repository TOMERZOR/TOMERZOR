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
//   GET    /search?q= *
//   GET    /feed *               activity, people you may know, friends' stories
//   GET    /p/<id>               profile photo
//   GET    /posts[?before=] *    posts by people you follow, and yours
//   POST   /posts *              { image (data URL), caption, ratio }
//   GET    /posts/<id> *  · DELETE /posts/<id> *  · POST|DELETE /posts/<id>/like *
//   GET    /u/<id>/posts[?before=] *
//   GET    /stories *            the story tray (24 hours)
//   POST   /stories *            { image? , text?, bg }
//   DELETE /stories/<id> *  · POST /stories/<id>/seen *  · GET /stories/<id>/viewers *
//   GET    /m/<id>               a post or story image

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

export async function handle(req, net, limiter) {
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
  }
  if (parts[0] === 'u' && parts[1] && parts[2] === 'posts' && m === 'GET') return json(net.userPosts(me(), parts[1], Number(url.searchParams.get('before')) || Infinity));
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
    this.store = new SqlStore(ctx.storage.sql);
    this.limiter = makeLimiter(REGISTER_PER_HOUR);
    this.origin = '';
    this.net = new Network(this.store, {
      random: randomString,
      photoUrl: (id, ver) => (ver ? `${this.origin}/p/${id}?v=${ver}` : null),
      mediaUrl: id => (id ? `${this.origin}/m/${id}` : null),
    });
  }
  async fetch(req) {
    this.origin = new URL(req.url).origin;
    try {
      return await handle(req, this.net, this.limiter);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.code }, e.status);
      console.error(e);
      return json({ error: 'server' }, 500);
    }
  }
}
