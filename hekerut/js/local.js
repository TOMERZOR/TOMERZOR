// Demo mode: the whole network runs in this browser, with a few made-up people, until the server
// (server/worker.js) is deployed and js/config.js points at it. Same logic, same answers.

import { Network, indexFields, cleanProfile } from './core.js';

const KEY = 'hekerut.demo.v1';

export class MemoryStore {
  constructor(data) {
    this.d = data || {};
    for (const k of ['users', 'photos', 'follows', 'events', 'media', 'posts', 'likes', 'stories', 'views']) this.d[k] ||= {};
    this.d.messages ||= [];
    this.d.seq ||= 0;
  }
  user(id) { return this.d.users[id] ? structuredClone(this.d.users[id]) : null; }
  putUser(u) { this.d.users[u.id] = structuredClone({ ...u, idx: indexFields(u.profile) }); }
  deleteUser(id) {
    delete this.d.users[id];
    delete this.d.photos[id];
    delete this.d.events[id];
    for (const k of Object.keys(this.d.follows)) if (k.startsWith(`${id}>`) || k.endsWith(`>${id}`)) delete this.d.follows[k];
    for (const list of Object.values(this.d.events)) for (let i = list.length - 1; i >= 0; i--) if (list[i].actor === id) list.splice(i, 1);
    for (const p of Object.values(this.d.posts)) if (p.uid === id) this.deletePost(p.id);
    for (const st of Object.values(this.d.stories)) if (st.uid === id) this.deleteStory(st.id);
    for (const [k, m] of Object.entries(this.d.media)) if (m.owner === id) delete this.d.media[k];
    for (const k of Object.keys(this.d.likes)) if (k.endsWith(`>${id}`)) delete this.d.likes[k];
    for (const k of Object.keys(this.d.views)) if (k.endsWith(`>${id}`)) delete this.d.views[k];
    this.d.messages = this.d.messages.filter(m => m.sender !== id && m.recipient !== id);
  }
  addMessage(m) { const n = ++this.d.seq; this.d.messages.push({ ...m, n, read: false }); return n; }
  messages(conv, limit, before, after) {
    return this.d.messages.filter(m => m.conv === conv && m.n < before && m.n > after).sort((a, b) => b.n - a.n).slice(0, limit).map(m => ({ ...m }));
  }
  hasMessageFrom(conv, sender) { return this.d.messages.some(m => m.conv === conv && m.sender === sender); }
  sentSince(uid, since) { return this.d.messages.filter(m => m.sender === uid && m.at > since).length; }
  markConvRead(conv, uid) { for (const m of this.d.messages) if (m.conv === conv && m.recipient === uid) m.read = true; }
  unreadMessages(uid) { return this.d.messages.filter(m => m.recipient === uid && !m.read).length; }
  convs(uid) {
    const by = new Map();
    for (const m of this.d.messages) {
      if (m.sender !== uid && m.recipient !== uid) continue;
      const c = by.get(m.conv) || { a: m.conv.split('|')[0], b: m.conv.split('|')[1], last: m, unread: 0 };
      if (m.n > c.last.n) c.last = m;
      if (m.recipient === uid && !m.read) c.unread++;
      by.set(m.conv, c);
    }
    return [...by.values()].map(c => ({ ...c, last: { ...c.last } }));
  }
  putMedia(id, owner, data) { this.d.media[id] = { owner, data }; }
  media(id) { return this.d.media[id]?.data || null; }
  deleteMedia(id) { delete this.d.media[id]; }
  putPost(p) { this.d.posts[p.id] = { ...p }; }
  post(id) { return this.d.posts[id] ? { ...this.d.posts[id] } : null; }
  deletePost(id) {
    delete this.d.posts[id];
    for (const k of Object.keys(this.d.likes)) if (k.startsWith(`${id}>`)) delete this.d.likes[k];
  }
  postsBy(uid, limit, before) { return Object.values(this.d.posts).filter(p => p.uid === uid && p.at < before).sort((a, b) => b.at - a.at).slice(0, limit).map(p => ({ ...p })); }
  postCount(uid) { return Object.values(this.d.posts).filter(p => p.uid === uid).length; }
  feedPosts(viewer, limit, before) {
    const ids = new Set([viewer, ...this.following(viewer)]);
    return Object.values(this.d.posts).filter(p => ids.has(p.uid) && p.at < before).sort((a, b) => b.at - a.at).slice(0, limit).map(p => ({ ...p }));
  }
  putLike(post, uid, at) { this.d.likes[`${post}>${uid}`] = at; }
  deleteLike(post, uid) { delete this.d.likes[`${post}>${uid}`]; }
  liked(post, uid) { return `${post}>${uid}` in this.d.likes; }
  likeAt(post, uid) { return this.d.likes[`${post}>${uid}`] ?? null; }
  likeCount(post) { return Object.keys(this.d.likes).filter(k => k.startsWith(`${post}>`)).length; }
  putStory(st) { this.d.stories[st.id] = { ...st }; }
  story(id) { return this.d.stories[id] ? { ...this.d.stories[id] } : null; }
  deleteStory(id) {
    delete this.d.stories[id];
    for (const k of Object.keys(this.d.views)) if (k.startsWith(`${id}>`)) delete this.d.views[k];
  }
  storiesBy(uid, since) { return Object.values(this.d.stories).filter(s => s.uid === uid && s.at > since).map(s => ({ ...s })); }
  storyFeed(viewer, since) {
    const ids = new Set([viewer, ...this.following(viewer)]);
    return Object.values(this.d.stories).filter(s => ids.has(s.uid) && s.at > since).sort((a, b) => a.at - b.at).map(s => ({ ...s }));
  }
  purgeStories(before, limit) {
    const old = Object.values(this.d.stories).filter(s => s.at <= before).slice(0, limit);
    for (const s of old) this.deleteStory(s.id);
    return old.map(s => s.media);
  }
  putView(story, uid, at) { const k = `${story}>${uid}`; if (!(k in this.d.views)) this.d.views[k] = at; }
  seen(story, uid) { return `${story}>${uid}` in this.d.views; }
  viewCount(story) { return Object.keys(this.d.views).filter(k => k.startsWith(`${story}>`)).length; }
  views(story) { return Object.entries(this.d.views).filter(([k]) => k.startsWith(`${story}>`)).map(([k, at]) => ({ uid: k.slice(story.length + 1), at })).sort((a, b) => b.at - a.at); }
  photo(id) { return this.d.photos[id] || null; }
  putPhoto(id, data) { if (data) this.d.photos[id] = data; else delete this.d.photos[id]; }
  follow(a, b) { return this.d.follows[`${a}>${b}`] || null; }
  putFollow(a, b, f) { this.d.follows[`${a}>${b}`] = f; }
  deleteFollow(a, b) { delete this.d.follows[`${a}>${b}`]; }
  following(a) { return Object.keys(this.d.follows).filter(k => k.startsWith(`${a}>`)).map(k => k.slice(a.length + 1)); }
  followers(b) { return Object.keys(this.d.follows).filter(k => k.endsWith(`>${b}`)).map(k => k.slice(0, -b.length - 1)); }
  search(n, limit) {
    return Object.values(this.d.users).filter(u => u.idx.name.includes(n) || u.idx.unit1 === n || u.idx.unit2 === n || u.idx.prep.includes(n))
      .slice(0, limit).map(u => structuredClone(u));
  }
  match(field, value, limit) {
    return Object.values(this.d.users).filter(u => u.idx[field] === value).slice(0, limit).map(u => u.id);
  }
  addEvent(to, e, max) {
    const list = (this.d.events[to] ||= []);
    list.unshift({ id: Math.random().toString(36).slice(2), read: false, ...e });
    list.length = Math.min(list.length, max);
  }
  events(to, limit) { return (this.d.events[to] || []).slice(0, limit).map(e => ({ ...e })); }
  unread(to) { return (this.d.events[to] || []).filter(e => !e.read).length; }
  markRead(to) { for (const e of this.d.events[to] || []) e.read = true; }
}

const rnd = n => {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map(b => abc[b % abc.length]).join('');
};

// Made-up people, so the demo has someone to meet. Names and paths are fictional.
const P = (name, g, age, city, corps, path, extra = {}) => cleanProfile({
  name, g, born: new Date().getFullYear() - age, city, unit: { corps, path }, status: 'active', vis: 'met', ...extra,
});
const DEMO = [
  ['d-noa', P('נועה לוי', 'f', 21, 'רעננה', 'artillery', ['215', '402', 'ב', '2'], { prep: { kind: 'mechina', name: 'מכינת רבין' }, tironut: 'שיזפון', draft: '2023-08', roles: [{ t: 'לוחמת', from: 2023, to: 2024 }, { t: 'מפקדת צוות', from: 2024 }], bio: 'קפה שחור, שקיעות בגולן וסוללה ב׳ לנצח 🧡' })],
  ['d-itay', P('איתי כהן', 'm', 22, 'חיפה', 'infantry', ['גולני', '13', 'ג', '1'], { prep: { kind: 'mechina', name: 'בני דוד – עלי' }, tironut: 'בסיס טירונים גולני', draft: '2022-11', status: 'released', release: '2025-07', roles: [{ t: 'לוחם', from: 2022, to: 2023 }, { t: 'מפקד כיתה', from: 2023, to: 2024 }, { t: 'סמל מחלקה', from: 2024, to: 2025 }], bio: 'משוחרר טרי, מחפש את הטרק הבא' })],
  ['d-shira', P('שירה מזרחי', 'f', 20, 'באר שבע', 'border', ['', 'קרקל', 'א', '3'], { prep: { kind: 'year', name: 'שנת שירות בתנועה' }, tironut: 'שיזפון', draft: '2024-03', roles: [{ t: 'לוחמת', from: 2024 }], bio: 'מדבר, ג׳יפים וחברות לחיים' })],
  ['d-omer', P('עומר פרץ', 'm', 21, 'רעננה', 'artillery', ['215', '402', 'א'], { prep: { kind: 'mechina', name: 'מכינת רבין' }, tironut: 'שיזפון', draft: '2023-08', roles: [{ t: 'לוחם', from: 2023, to: 2024 }, { t: 'קורס מ״כים', from: 2024, to: 2024 }, { t: 'מפקד צוות', from: 2024 }] })],
  ['d-yael', P('יעל אברהם', 'f', 23, 'תל אביב', 'intel', ['', '', 'מחקר'], { status: 'reserve', draft: '2021-08', release: '2023-08', roles: [{ t: 'מחקרנית', from: 2021, to: 2023 }], bio: 'במילואים ובתואר במקביל' })],
  ['d-daniel', P('דניאל שטרן', 'm', 22, 'מודיעין', 'armor', ['7', '75', 'ב', '2'], { prep: { kind: 'mechina', name: 'מכינת נחשון' }, tironut: 'שיזפון', draft: '2022-08', roles: [{ t: 'טען קשר', from: 2022, to: 2023 }, { t: 'מפקד טנק', from: 2023 }] })],
  ['d-maya', P('מאיה גולן', 'f', 21, 'חיפה', 'air', ['רמת דוד', '', 'מבצעים'], { prep: { kind: 'year', name: 'שנת שירות בצופים' }, draft: '2023-03', roles: [{ t: 'פקחית טיסה', from: 2023 }], bio: 'רואה הכל מלמעלה ✈️' })],
  ['d-amit', P('עמית ביטון', 'm', 20, 'אשדוד', 'infantry', ['גבעתי', 'צבר', 'ב'], { tironut: 'בסיס טירונים גבעתי', draft: '2024-08', roles: [{ t: 'לוחם', from: 2024 }] })],
  ['d-tamar', P('תמר רוזן', 'f', 22, 'ירושלים', 'artillery', ['282', '334', 'ג'], { prep: { kind: 'mechina', name: 'מכינת בית ישראל' }, tironut: 'שיזפון', draft: '2022-08', roles: [{ t: 'לוחמת', from: 2022, to: 2023 }, { t: 'קצינת סוללה', from: 2024 }] })],
  ['d-yonatan', P('יונתן אלון', 'm', 24, 'רעננה', 'infantry', ['צנחנים', '890', 'מסייעת'], { prep: { kind: 'mechina', name: 'עין פרת' }, status: 'reserve', draft: '2020-11', release: '2023-11', roles: [{ t: 'לוחם', from: 2020, to: 2021 }, { t: 'מ״מ', from: 2021, to: 2023 }] })],
];
const EDGES = [['d-noa', 'd-omer'], ['d-noa', 'd-tamar'], ['d-noa', 'd-shira'], ['d-omer', 'd-itay'], ['d-itay', 'd-daniel'], ['d-itay', 'd-yonatan'], ['d-shira', 'd-maya'], ['d-maya', 'd-yael'], ['d-daniel', 'd-amit'], ['d-tamar', 'd-yonatan'], ['d-yael', 'd-noa'], ['d-omer', 'd-yonatan'], ['d-amit', 'd-itay']];

function seed(store, now) {
  DEMO.forEach(([id, profile], i) => store.putUser({ id, token: rnd(32), key: rnd(12), profile, created: now - (40 - i) * 86400e3, updated: now - i * 3600e3, photoVer: 0 }));
  for (const [a, b] of EDGES) {
    store.putFollow(a, b, { met: true, at: now });
    store.putFollow(b, a, { met: true, at: now });
  }
  // A couple of text stories, so the demo's story row isn't empty.
  store.putStory({ id: 'st-noa', uid: 'd-noa', media: null, text: 'יום אחרון של קו בגולן 🧡', bg: 'b1', at: now - 2 * 3600e3 });
  store.putStory({ id: 'st-itay', uid: 'd-itay', media: null, text: 'חודש לשחרור.\nמי בא לטרק?', bg: 'b3', at: now - 5 * 3600e3 });
}

// Same calls as the server client in api.js, answered here.
export class LocalApi {
  constructor() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch {}
    this.store = new MemoryStore(data);
    this.net = new Network(this.store, { random: rnd });
    if (!data) { seed(this.store, Date.now()); this.save(); }
    this.listeners = new Set();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.store.d)); } catch {} }
  run(fn) {
    try {
      const out = structuredClone(fn());
      this.save();
      return Promise.resolve(out);
    } catch (e) { return Promise.reject(e); }
  }
  me(s) { return this.run(() => this.net.me(this.net.auth(s.id, s.token))); }
  register(body) { return this.run(() => this.net.register(body)); }
  update(s, body) { return this.run(() => this.net.update(this.net.auth(s.id, s.token), body)); }
  newKey(s) { return this.run(() => this.net.newKey(this.net.auth(s.id, s.token))); }
  remove(s) { return this.run(() => this.net.remove(this.net.auth(s.id, s.token))); }
  view(s, id, key) { return this.run(() => this.net.view(s ? this.net.auth(s.id, s.token) : null, id, key)); }
  list(s, id, kind) { return this.run(() => this.net.list(this.net.auth(s.id, s.token), id, kind)); }
  search(s, q) { return this.run(() => this.net.search(this.net.auth(s.id, s.token), q)); }
  feed(s) { return this.run(() => this.net.feed(this.net.auth(s.id, s.token))); }
  unfollow(s, id) { return this.run(() => this.net.unfollow(this.net.auth(s.id, s.token), id)); }
  removeFollower(s, id) { return this.run(() => this.net.removeFollower(this.net.auth(s.id, s.token), id)); }
  follow(s, id, key) {
    const out = this.run(() => this.net.follow(this.net.auth(s.id, s.token), id, key));
    // The made-up people follow back after a moment, so the demo shows what becoming friends looks like.
    if (id.startsWith('d-')) {
      setTimeout(() => {
        const me = this.store.user(s.id);
        const them = this.store.user(id);
        if (!me || !them || !this.store.follow(s.id, id) || this.store.follow(id, s.id)) return;
        this.net.follow(them, s.id);
        this.save();
        for (const fn of this.listeners) fn();
      }, 2600);
    }
    return out;
  }
  chapcha(s, id) { return this.run(() => this.net.chapcha(this.net.auth(s.id, s.token), id)); }
  createPost(s, body) { return this.run(() => this.net.createPost(this.net.auth(s.id, s.token), body)); }
  deletePost(s, id) { return this.run(() => this.net.deletePost(this.net.auth(s.id, s.token), id)); }
  like(s, id, on) { return this.run(() => this.net.like(this.net.auth(s.id, s.token), id, on)); }
  posts(s, before) { return this.run(() => this.net.posts(this.net.auth(s.id, s.token), before)); }
  userPosts(s, id, before) { return this.run(() => this.net.userPosts(this.net.auth(s.id, s.token), id, before)); }
  post(s, id) { return this.run(() => this.net.post(this.net.auth(s.id, s.token), id)); }
  createStory(s, body) { return this.run(() => this.net.createStory(this.net.auth(s.id, s.token), body)); }
  tray(s) { return this.run(() => this.net.tray(this.net.auth(s.id, s.token))); }
  seeStory(s, id) { return this.run(() => this.net.seeStory(this.net.auth(s.id, s.token), id)); }
  storyViewers(s, id) { return this.run(() => this.net.storyViewers(this.net.auth(s.id, s.token), id)); }
  deleteStory(s, id) { return this.run(() => this.net.deleteStory(this.net.auth(s.id, s.token), id)); }
  likeStory(s, id, on) { return this.run(() => this.net.likeStory(this.net.auth(s.id, s.token), id, on)); }
  chats(s) { return this.run(() => this.net.chats(this.net.auth(s.id, s.token))); }
  chat(s, id, opts) { return this.run(() => this.net.chat(this.net.auth(s.id, s.token), id, opts)); }
  send(s, id, body) {
    const out = this.run(() => this.net.send(this.net.auth(s.id, s.token), id, body));
    // The made-up people answer, so the demo shows a conversation.
    if (id.startsWith('d-')) {
      setTimeout(() => {
        const them = this.store.user(id);
        if (!them || !this.store.user(s.id)) return;
        const lines = ['היי! איזה כיף לשמוע ממך 😊', 'אחלה, נדבר בקרוב', 'חחח בדיוק חשבתי עלייך', 'מתי משתחררים? 🙃', 'סגור, נתאם'];
        try { this.net.send(them, s.id, { text: lines[Math.floor(Math.random() * lines.length)] }); this.save(); } catch {}
        for (const fn of this.listeners) fn('message');
      }, 2200);
    }
    return out;
  }
  pushKey() { return Promise.reject(Object.assign(new Error('demo'), { code: 'demo' })); }
  subscribe() { return Promise.resolve({ ok: true }); }
  unsubscribe() { return Promise.resolve({ ok: true }); }
  onChange(fn) { this.listeners.add(fn); }
  reset() { try { localStorage.removeItem(KEY); } catch {} }
}
