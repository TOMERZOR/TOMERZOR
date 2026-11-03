// היכרות בקליק — the network itself: profiles, follows, mutual connections and what two people
// have in common. Pure logic over a small synchronous store, so the same code runs on the
// Cloudflare server (server/worker.js, SQLite store) and in the browser's demo mode (js/local.js).

// ---------- Service data ----------

// Each corps names its own levels: artillery has a סוללה where infantry has a פלוגה, the air force
// has a טייסת. `sugg` offers a few common answers per level; everything stays free text.
export const CORPS = {
  infantry: { name: 'חי״ר', levels: ['חטיבה', 'גדוד', 'פלוגה', 'מחלקה', 'כיתה / צוות'], sugg: [['גולני', 'גבעתי', 'צנחנים', 'נח״ל', 'כפיר', 'קומנדו']] },
  armor: { name: 'שריון', levels: ['חטיבה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [['7', '188', '401', '460']] },
  artillery: { name: 'תותחנים', levels: ['חטיבה', 'גדוד', 'סוללה', 'מחלקה', 'צוות'], sugg: [['215', '282', '214']] },
  engineering: { name: 'הנדסה קרבית', levels: ['חטיבה / יחידה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [['יהל״ם']] },
  border: { name: 'הגנת גבולות', levels: ['מערך / חטיבה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [[], ['קרקל', 'ברדלס', 'אריות הירדן']] },
  recon: { name: 'איסוף קרבי', levels: ['חטיבה / יחידה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [] },
  intel: { name: 'מודיעין', levels: ['יחידה', 'בסיס / זרוע', 'מדור', 'צוות'], sugg: [] },
  air: { name: 'חיל האוויר', levels: ['בסיס / כנף', 'טייסת / יחידה', 'מדור', 'צוות'], sugg: [] },
  navy: { name: 'חיל הים', levels: ['בסיס / זרוע', 'שייטת / יחידה', 'ספינה / מדור', 'צוות'], sugg: [] },
  c4i: { name: 'תקשוב', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  homefront: { name: 'פיקוד העורף', levels: ['חטיבה / יחידה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [] },
  mp: { name: 'משטרה צבאית', levels: ['יחידה', 'בסיס', 'מחלקה', 'צוות'], sugg: [] },
  logistics: { name: 'טכנולוגיה ולוגיסטיקה', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  medical: { name: 'רפואה', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  education: { name: 'חינוך ונוער', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  other: { name: 'אחר', levels: ['יחידה', 'תת־יחידה', 'מדור', 'צוות'], sugg: [] },
};

export const STATUS = {
  pre: { m: 'לפני גיוס', f: 'לפני גיוס' },
  active: { m: 'בסדיר', f: 'בסדיר' },
  perm: { m: 'בקבע', f: 'בקבע' },
  reserve: { m: 'במילואים', f: 'במילואים' },
  released: { m: 'משוחרר', f: 'משוחררת', x: 'משוחרר/ת' },
};

export const PREP = { none: 'בלי', mechina: 'מכינה', year: 'שנת שירות' };

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const LIMITS = { name: 40, text: 40, bio: 120, roles: 12, photo: 90 * 1024 };

// ---------- Small helpers ----------

export const gen = (p, m, f, x = `${m}/${f}`) => (p?.g === 'f' ? f : p?.g === 'x' ? x : m);
export const statusLabel = p => { const s = STATUS[p?.status]; return s ? (s[p.g] || s.m) : ''; };
export const ageOf = (p, now = Date.now()) => (p?.born ? new Date(now).getFullYear() - p.born : null);
export const monthLabel = ym => { if (!/^\d{4}-\d{2}$/.test(ym || '')) return ''; const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };

// Compares free text loosely: "גדוד 13" and "13", "מכינת רבין" and "רבין", "נח"ל" and "נח״ל".
export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/["'״׳`’]/g, '')
    .replace(/[-–—_.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(מכינת|מכינה|מכינה קדם צבאית|חטיבת|חטיבה|גדוד|פלוגה|סוללה|מחלקה|בסיס|טייסת|שייטת|יחידת|יחידה|צוות|כיתה)\s+/, '');
}

const firstWord = label => label.split(' /')[0].trim();
const MASC = new Set(['גדוד', 'בסיס', 'צוות', 'מדור', 'מחוז', 'מערך']);
const sameWord = label => (MASC.has(firstWord(label)) ? 'אותו' : 'אותה');

// "13" under גדוד reads "גדוד 13", "ב" under סוללה reads "סוללה ב׳", "גולני" stays "גולני".
export function prettyLevel(label, value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const w = firstWord(label);
  if (/^\d+$/.test(v)) return `${w} ${v}`;
  if (/^[א-ת]['׳]?$/.test(v)) return `${w} ${v[0]}׳`;
  return v;
}

export function unitChain(p) {
  const c = CORPS[p?.unit?.corps];
  if (!c) return [];
  return (p.unit.path || []).map((v, i) => (v && c.levels[i] ? { label: c.levels[i], text: prettyLevel(c.levels[i], v) } : null)).filter(Boolean);
}

export function currentRole(p) {
  const roles = p?.roles || [];
  return roles.find(r => !r.to) || roles[roles.length - 1] || null;
}

// ---------- Validation ----------

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const year = v => { const n = parseInt(v, 10); return n >= 1940 && n <= 2100 ? n : null; };
const ym = v => (/^\d{4}-(0[1-9]|1[0-2])$/.test(v || '') ? v : '');

export function cleanProfile(input = {}) {
  const p = input || {};
  const corps = CORPS[p.unit?.corps] ? p.unit.corps : '';
  const levels = corps ? CORPS[corps].levels.length : 0;
  const path = Array.from({ length: levels }, (_, i) => str(p.unit?.path?.[i], LIMITS.text));
  while (path.length && !path[path.length - 1]) path.pop();
  const roles = (Array.isArray(p.roles) ? p.roles : []).slice(0, LIMITS.roles)
    .map(r => ({ t: str(r?.t, LIMITS.text), from: year(r?.from) || '', to: year(r?.to) || '' }))
    .filter(r => r.t);
  const prepKind = PREP[p.prep?.kind] ? p.prep.kind : 'none';
  return {
    name: str(p.name, LIMITS.name),
    g: ['m', 'f', 'x'].includes(p.g) ? p.g : 'm',
    born: year(p.born) || '',
    city: str(p.city, LIMITS.text),
    bio: str(p.bio, LIMITS.bio),
    prep: { kind: prepKind, name: prepKind === 'none' ? '' : str(p.prep?.name, LIMITS.text) },
    status: STATUS[p.status] ? p.status : 'active',
    draft: ym(p.draft),
    release: ym(p.release),
    unit: { corps, path },
    tironut: str(p.tironut, LIMITS.text),
    roles,
    vis: p.vis === 'all' ? 'all' : 'met',
  };
}

export function cleanPhoto(photo) {
  if (photo === null || photo === '') return null;
  if (typeof photo !== 'string') return undefined;
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > LIMITS.photo) throw new ApiError(400, 'photo');
  return photo;
}

export class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

// ---------- What two people have in common ----------

// A short list of the strongest things two profiles share, strongest first.
export function commonGround(a, b) {
  if (!a || !b) return [];
  const out = [];
  const push = (k, title, detail, w) => out.push({ k, title, detail, w });

  // The unit: the deepest level both share, walking down from the corps.
  if (a.unit?.corps && a.unit.corps === b.unit?.corps) {
    const c = CORPS[a.unit.corps];
    let depth = 0;
    const pa = a.unit.path || [], pb = b.unit.path || [];
    while (depth < c.levels.length && pa[depth] && norm(pa[depth]) === norm(pb[depth])) depth++;
    if (depth) {
      const label = c.levels[depth - 1];
      const chain = pa.slice(0, depth).map((v, i) => prettyLevel(c.levels[i], v)).join(' · ');
      push('unit', depth >= 3 ? `${sameWord(label)} ${firstWord(label)}!` : `${sameWord(label)} ${firstWord(label)}`, chain, 2 + depth * 2);
    } else {
      push('corps', `שניכם ב${c.name}`, '', 1);
    }
  }
  if (a.prep?.kind !== 'none' && a.prep?.kind === b.prep?.kind) {
    if (a.prep.name && norm(a.prep.name) === norm(b.prep.name)) push('prep', a.prep.kind === 'mechina' ? 'אותה מכינה' : 'אותה שנת שירות', a.prep.name, 6);
    else push('prep', a.prep.kind === 'mechina' ? 'שניכם עשיתם מכינה' : 'שניכם עשיתם שנת שירות', '', 1);
  }
  if (a.tironut && norm(a.tironut) === norm(b.tironut)) push('tironut', 'טירונות באותו מקום', a.tironut, 4);
  if (a.draft && a.draft === b.draft) push('draft', 'אותו מחזור גיוס', monthLabel(a.draft), 4);
  else if (a.draft && b.draft && a.draft.slice(0, 4) === b.draft.slice(0, 4)) push('draft', 'התגייסתם באותה שנה', a.draft.slice(0, 4), 2);
  if (a.city && norm(a.city) === norm(b.city)) push('city', 'מאותה עיר', a.city, 3);
  const rb = new Set((b.roles || []).map(r => norm(r.t)));
  const role = (a.roles || []).find(r => rb.has(norm(r.t)));
  if (role) push('role', 'אותו תפקיד', role.t, 2);

  return out.sort((x, y) => y.w - x.w);
}

export const commonScore = list => list.reduce((s, c) => s + c.w, 0);

// ---------- The network ----------
//
// store: a synchronous key/value-ish store (see MemoryStore in js/local.js and SqlStore in
// server/worker.js) with users, follows (a -> b, `met` when b's code was scanned) and events.
// opts: { now(), random(n) -> url-safe string of n chars, photoUrl(id, ver) }

const SUGGEST_MAX = 12;
const EVENTS_MAX = 60;

export class Network {
  constructor(store, opts) {
    this.s = store;
    this.now = opts.now || (() => Date.now());
    this.random = opts.random;
    this.photoUrl = opts.photoUrl || ((id, ver) => (ver ? this.s.photo(id) : null));
  }

  // --- Auth ---

  auth(id, token) {
    const u = id && this.s.user(id);
    if (!u || !token || !safeEqual(u.token, token)) throw new ApiError(401, 'auth');
    return u;
  }

  // --- Views of a person ---

  summary(u) {
    const p = u.profile;
    const role = currentRole(p);
    return {
      id: u.id,
      name: p.name,
      g: p.g,
      age: ageOf(p, this.now()),
      city: p.city,
      status: p.status,
      corps: p.unit.corps,
      top: p.unit.path[0] ? prettyLevel(CORPS[p.unit.corps]?.levels[0] || '', p.unit.path[0]) : '',
      prep: p.prep.kind !== 'none' ? p.prep.name || PREP[p.prep.kind] : '',
      role: role?.t || '',
      photo: this.photoUrl(u.id, u.photoVer),
    };
  }

  // The whole profile, for people who met them (scanned the code or were followed by them).
  full(u) {
    return { ...this.summary(u), profile: u.profile, joined: u.created };
  }

  canSeeFull(viewer, target, key) {
    if (viewer && viewer.id === target.id) return true;
    if (target.profile.vis === 'all') return true;
    if (key && safeEqual(target.key, key)) return true;
    if (!viewer) return false;
    if (this.s.follow(target.id, viewer.id)) return true;
    return !!this.s.follow(viewer.id, target.id)?.met;
  }

  rel(viewer, target) {
    if (!viewer || viewer.id === target.id) return { self: viewer?.id === target.id };
    const out = this.s.follow(viewer.id, target.id);
    const back = this.s.follow(target.id, viewer.id);
    return { following: !!out, followsMe: !!back, friends: !!out && !!back, met: !!out?.met || !!back?.met };
  }

  connections(id) {
    return new Set([...this.s.following(id), ...this.s.followers(id)]);
  }

  friendsOf(id) {
    const out = new Set(this.s.following(id));
    return new Set(this.s.followers(id).filter(x => out.has(x)));
  }

  // People both are connected to (either direction), friends of both first.
  mutual(aId, bId) {
    const a = this.connections(aId), b = this.connections(bId);
    const fa = this.friendsOf(aId), fb = this.friendsOf(bId);
    const ids = [...a].filter(x => b.has(x) && x !== aId && x !== bId);
    const users = ids.map(x => this.s.user(x)).filter(Boolean);
    users.sort((x, y) => (fa.has(y.id) && fb.has(y.id)) - (fa.has(x.id) && fb.has(x.id)) || x.profile.name.localeCompare(y.profile.name, 'he'));
    return users;
  }

  counts(id) {
    return { friends: this.friendsOf(id).size, followers: this.s.followers(id).length, following: this.s.following(id).length };
  }

  // --- Account ---

  register({ profile, photo } = {}) {
    const p = cleanProfile(profile);
    if (!p.name) throw new ApiError(400, 'name');
    const now = this.now();
    let id;
    do id = this.random(10).toLowerCase().replace(/[^a-z0-9]/g, 'x'); while (this.s.user(id));
    const u = { id, token: this.random(32), key: this.random(12), profile: p, created: now, updated: now, photoVer: 0 };
    const ph = cleanPhoto(photo);
    if (ph) { this.s.putPhoto(id, ph); u.photoVer = now; }
    this.s.putUser(u);
    return { id, token: u.token, key: u.key, me: this.me(u) };
  }

  me(u) {
    return { ...this.full(u), key: u.key, counts: this.counts(u.id), unread: this.s.unread(u.id) };
  }

  update(u, { profile, photo } = {}) {
    const before = u.profile;
    if (profile) {
      const p = cleanProfile(profile);
      if (!p.name) throw new ApiError(400, 'name');
      u.profile = p;
    }
    const ph = cleanPhoto(photo);
    if (ph === null) { this.s.putPhoto(u.id, null); u.photoVer = 0; }
    else if (ph) { this.s.putPhoto(u.id, ph); u.photoVer = this.now(); }
    u.updated = this.now();
    this.s.putUser(u);
    // A new current role is news for the people who follow them.
    const was = currentRole(before)?.t, is = currentRole(u.profile)?.t;
    if (profile && is && norm(is) !== norm(was)) {
      for (const f of this.s.followers(u.id).slice(0, 2000)) this.event(f, 'role', u.id, { t: is });
    }
    return this.me(u);
  }

  newKey(u) {
    u.key = this.random(12);
    this.s.putUser(u);
    return { key: u.key };
  }

  remove(u) {
    this.s.deleteUser(u.id);
    return { ok: true };
  }

  // --- Looking at someone ---

  view(viewer, id, key) {
    const t = this.s.user(id);
    if (!t) throw new ApiError(404, 'not_found');
    const full = this.canSeeFull(viewer, t, key);
    const out = {
      person: full ? this.full(t) : this.summary(t),
      level: full ? 'full' : 'summary',
      keyOk: !!key && safeEqual(t.key, key),
      rel: this.rel(viewer, t),
      counts: this.counts(t.id),
      mutual: [],
      mutualCount: 0,
      common: [],
    };
    if (viewer && viewer.id !== t.id) {
      const m = this.mutual(viewer.id, t.id);
      out.mutual = m.slice(0, 12).map(x => ({ ...this.summary(x), rel: this.rel(viewer, x) }));
      out.mutualCount = m.length;
      out.common = commonGround(viewer.profile, t.profile).slice(0, 6);
      if (!full) out.common = out.common.map(c => (c.k === 'unit' || c.k === 'tironut' || c.k === 'draft' ? { ...c, detail: '' } : c));
    }
    return out;
  }

  // --- Following ---

  follow(u, id, key) {
    if (id === u.id) throw new ApiError(400, 'self');
    const t = this.s.user(id);
    if (!t) throw new ApiError(404, 'not_found');
    const met = !!key && safeEqual(t.key, key);
    const had = this.s.follow(u.id, id);
    if (!had || (met && !had.met)) this.s.putFollow(u.id, id, { met: met || !!had?.met, at: had?.at || this.now() });
    if (!had) {
      const back = this.s.follow(id, u.id);
      this.event(id, back ? 'friend' : met ? 'scan' : 'follow', u.id);
    }
    return this.rel(u, t);
  }

  unfollow(u, id) {
    this.s.deleteFollow(u.id, id);
    const t = this.s.user(id);
    return t ? this.rel(u, t) : {};
  }

  removeFollower(u, id) {
    this.s.deleteFollow(id, u.id);
    const t = this.s.user(id);
    return t ? this.rel(u, t) : {};
  }

  list(viewer, id, kind) {
    const t = this.s.user(id);
    if (!t) throw new ApiError(404, 'not_found');
    if (!this.canSeeFull(viewer, t)) throw new ApiError(403, 'private');
    const ids = kind === 'followers' ? this.s.followers(id) : kind === 'following' ? this.s.following(id) : [...this.friendsOf(id)];
    return ids.map(x => this.s.user(x)).filter(Boolean)
      .sort((a, b) => a.profile.name.localeCompare(b.profile.name, 'he'))
      .map(x => ({ ...this.summary(x), rel: this.rel(viewer, x) }));
  }

  search(viewer, q) {
    const n = norm(q);
    if (n.length < 2) return [];
    return this.s.search(n, 30).filter(x => x.id !== viewer?.id).map(x => ({ ...this.summary(x), rel: this.rel(viewer, x) }));
  }

  // --- Home ---

  event(to, kind, actor, data = {}) {
    this.s.addEvent(to, { kind, actor, data, at: this.now() }, EVENTS_MAX);
  }

  feed(u) {
    const events = this.s.events(u.id, 40).map(e => {
      const a = this.s.user(e.actor);
      return a ? { ...e, actor: { ...this.summary(a), rel: this.rel(u, a) } } : null;
    }).filter(Boolean);
    this.s.markRead(u.id);
    return { events, suggestions: this.suggest(u), stories: this.stories(u) };
  }

  // Friends first, most recently updated first: the round avatars at the top of the home screen.
  stories(u) {
    return [...this.friendsOf(u.id)].map(x => this.s.user(x)).filter(Boolean)
      .sort((a, b) => b.updated - a.updated).slice(0, 20).map(x => this.summary(x));
  }

  // People they may know: friends of friends, and people from the same unit, mechina, tironut or city.
  suggest(u) {
    const mine = this.connections(u.id);
    const skip = new Set([u.id, ...this.s.following(u.id)]);
    const mutualCount = new Map();
    for (const c of [...this.friendsOf(u.id)].slice(0, 300)) {
      for (const x of this.connections(c)) if (!skip.has(x)) mutualCount.set(x, (mutualCount.get(x) || 0) + 1);
    }
    const p = u.profile;
    const like = [];
    if (p.unit.path[1]) like.push(['unit2', norm(p.unit.path[1])]);
    if (p.unit.path[0]) like.push(['unit1', norm(p.unit.path[0])]);
    if (p.prep.name) like.push(['prep', norm(p.prep.name)]);
    if (p.tironut) like.push(['tironut', norm(p.tironut)]);
    if (p.city) like.push(['city', norm(p.city)]);
    const ids = new Set(mutualCount.keys());
    for (const [field, value] of like) for (const x of this.s.match(field, value, 40)) if (!skip.has(x)) ids.add(x);
    const scored = [...ids].map(x => this.s.user(x)).filter(Boolean).map(x => {
      const common = commonGround(p, x.profile);
      const m = mutualCount.get(x.id) || 0;
      return { x, common, m, score: m * 3 + commonScore(common) + (this.s.follow(x.id, u.id) ? 6 : 0) };
    }).filter(r => r.score > 1);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, SUGGEST_MAX).map(({ x, common, m }) => ({
      ...this.summary(x),
      rel: this.rel(u, x),
      reason: m && (!common[0] || common[0].w < 6) ? `${m} ${m === 1 ? 'חבר משותף' : 'חברים משותפים'}` : common[0]?.title || '',
      mutualCount: m,
      known: mine.has(x.id),
    }));
  }
}

// Fields the stores index so `match` and `search` don't read every profile.
export function indexFields(p) {
  return {
    name: norm(p.name),
    unit1: p.unit.corps && p.unit.path[0] ? norm(p.unit.path[0]) : '',
    unit2: p.unit.corps && p.unit.path[1] ? norm(p.unit.path[1]) : '',
    prep: p.prep.name ? norm(p.prep.name) : '',
    tironut: norm(p.tironut),
    city: norm(p.city),
  };
}

function safeEqual(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
