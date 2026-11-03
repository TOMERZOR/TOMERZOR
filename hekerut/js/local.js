// Demo mode: the whole network runs in this browser, with a few made-up people, until the server
// (server/worker.js) is deployed and js/config.js points at it. Same logic, same answers.

import { Network, indexFields, cleanProfile } from './core.js';

const KEY = 'hekerut.demo.v1';

export class MemoryStore {
  constructor(data) {
    this.d = data || { users: {}, photos: {}, follows: {}, events: {} };
  }
  user(id) { return this.d.users[id] ? structuredClone(this.d.users[id]) : null; }
  putUser(u) { this.d.users[u.id] = structuredClone({ ...u, idx: indexFields(u.profile) }); }
  deleteUser(id) {
    delete this.d.users[id];
    delete this.d.photos[id];
    delete this.d.events[id];
    for (const k of Object.keys(this.d.follows)) if (k.startsWith(`${id}>`) || k.endsWith(`>${id}`)) delete this.d.follows[k];
    for (const list of Object.values(this.d.events)) for (let i = list.length - 1; i >= 0; i--) if (list[i].actor === id) list.splice(i, 1);
  }
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
  onChange(fn) { this.listeners.add(fn); }
  reset() { try { localStorage.removeItem(KEY); } catch {} }
}
