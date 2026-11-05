// היכרות בקליק — the network itself: profiles, follows, mutual connections and what two people
// have in common. Pure logic over a small synchronous store, so the same code runs on the
// Cloudflare server (server/worker.js, SQLite store) and in the browser's demo mode (js/local.js).

// ---------- Service data ----------

// Each corps names its own levels: artillery has a סוללה where infantry has a פלוגה, the air force
// has a טייסת. `sugg` offers a few common answers per level; everything stays free text.
export const CORPS = {
  infantry: { name: 'חי״ר', levels: ['חטיבה', 'גדוד', 'פלוגה', 'מחלקה', 'כיתה / צוות'], sugg: [['גולני', 'גבעתי', 'צנחנים', 'נח״ל', 'כפיר', 'קומנדו', 'ביסלמ״ח']] },
  armor: { name: 'שריון', levels: ['חטיבה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [['7', '188', '401', '460']] },
  artillery: { name: 'תותחנים', levels: ['חטיבה', 'גדוד', 'סוללה', 'מחלקה', 'צוות'], sugg: [['215', '282', '214']] },
  engineering: { name: 'הנדסה קרבית', levels: ['חטיבה / יחידה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [['יהל״ם']] },
  border: { name: 'הגנת גבולות', levels: ['מערך / חטיבה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [[], ['קרקל', 'ברדלס', 'אריות הירדן']] },
  recon: { name: 'איסוף קרבי', levels: ['חטיבה / יחידה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [] },
  intel: { name: 'מודיעין', levels: ['יחידה', 'בסיס / זרוע', 'מדור', 'צוות'], sugg: [] },
  air: { name: 'חיל האוויר', levels: ['בסיס / כנף', 'טייסת / יחידה', 'מדור', 'צוות'], sugg: [] },
  // Air defense is part of the air force, picked as a second step after choosing חיל האוויר.
  airdef: { name: 'הגנ״א', full: 'חיל האוויר · הגנ״א', parent: 'air', levels: ['גדוד', 'סוללה', 'פלגה', 'צוות'], sugg: [] },
  navy: { name: 'חיל הים', levels: ['בסיס / זרוע', 'שייטת / יחידה', 'ספינה / מדור', 'צוות'], sugg: [] },
  c4i: { name: 'תקשוב', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  homefront: { name: 'פיקוד העורף', levels: ['חטיבה / יחידה', 'גדוד', 'פלוגה', 'מחלקה', 'צוות'], sugg: [] },
  mp: { name: 'משטרה צבאית', levels: ['יחידה', 'בסיס', 'מחלקה', 'צוות'], sugg: [] },
  logistics: { name: 'טכנולוגיה ולוגיסטיקה', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  medical: { name: 'רפואה', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  education: { name: 'חינוך ונוער', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  staff: { name: 'מטכ״ל ויחידות מיוחדות', levels: ['יחידה', 'צוות', 'תת־צוות'], sugg: [] },
  magav: { name: 'מג״ב', levels: ['מחוז / יחידה', 'פלוגה', 'מחלקה', 'צוות'], sugg: [] },
  manpower: { name: 'כוח אדם ושלישות', levels: ['יחידה', 'בסיס', 'מדור', 'צוות'], sugg: [] },
  rabbinate: { name: 'רבנות צבאית', levels: ['יחידה', 'בסיס', 'מדור'], sugg: [] },
  spokes: { name: 'דובר צה״ל', levels: ['יחידה', 'מדור', 'צוות'], sugg: [] },
  other: { name: 'אחר', levels: ['יחידה', 'תת־יחידה', 'מדור', 'צוות'], sugg: [] },
};

// ---------- Berets ----------
//
// The color of each corps' and brigade's beret. Infantry brigades each have their own; corps
// without one of their own wear olive. Anyone can pick their beret by hand in the profile, for
// units this list doesn't know or a beret that differs.
export const BERETS = {
  olive: { name: 'זית', color: '#6b6b3a' },
  brown: { name: 'חומה', color: '#6e4527' },
  red: { name: 'אדומה', color: '#b0202c' },
  purple: { name: 'סגולה', color: '#6b2c94' },
  lime: { name: 'ירוקה בהירה', color: '#78b83a' },
  camo: { name: 'מנומרת', color: '#5d6b3a', camo: true },
  black: { name: 'שחורה', color: '#1d1d1f' },
  turquoise: { name: 'טורקיז', color: '#169c9c' },
  silver: { name: 'אפורה בהירה', color: '#9aa1a8' },
  sand: { name: 'בצבע חול', color: '#c2a36a' },
  darkgreen: { name: 'ירוקה כהה', color: '#1f4a2c' },
  navy: { name: 'כחולה כהה', color: '#1b2a4e' },
  darkgrey: { name: 'אפורה כהה', color: '#4a4f57' },
  blue: { name: 'כחולה', color: '#2457a8' },
  sky: { name: 'תכלת כהה', color: '#3b7ea6' },
  orange: { name: 'כתומה', color: '#e2742a' },
};
const CORPS_BERET = {
  armor: 'black', artillery: 'turquoise', engineering: 'silver', recon: 'sand', intel: 'darkgreen', air: 'darkgrey',
  airdef: 'darkgrey', navy: 'navy', c4i: 'sky', homefront: 'orange', mp: 'blue', magav: 'darkgreen', staff: 'red',
};
const BRIGADE_BERET = [[/גולני/, 'brown'], [/צנחנ/, 'red'], [/גבעתי/, 'purple'], [/נחל/, 'lime'], [/כפיר/, 'camo'], [/קומנדו|עוז|89/, 'red']];

// The beret key for a profile: the one picked by hand, else the brigade's, else the corps'.
export function beretOf(p) {
  if (BERETS[p?.beret]) return p.beret;
  const corps = p?.unit?.corps;
  if (!corps) return '';
  if (corps === 'infantry') {
    const top = norm(p.unit.path?.[0]);
    for (const [re, k] of BRIGADE_BERET) if (re.test(top)) return k;
    return 'olive';
  }
  return CORPS_BERET[corps] || 'olive';
}

export const STATUS = {
  pre: { m: 'לפני גיוס', f: 'לפני גיוס' },
  active: { m: 'בסדיר', f: 'בסדיר' },
  perm: { m: 'בקבע', f: 'בקבע' },
  reserve: { m: 'במילואים', f: 'במילואים' },
  released: { m: 'משוחרר', f: 'משוחררת', x: 'משוחרר/ת' },
};

export const corpsName = k => CORPS[k]?.full || CORPS[k]?.name || '';
export const corpsFamily = k => CORPS[k]?.parent || k;

export const PREP = { none: 'בלי', mechina: 'מכינה', year: 'שנת שירות' };

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

const LIMITS = { name: 40, text: 40, bio: 120, roles: 12, photo: 90 * 1024 };

// ---------- Small helpers ----------

export const gen = (p, m, f, x = `${m}/${f}`) => (p?.g === 'f' ? f : p?.g === 'x' ? x : m);
export const statusLabel = p => { const s = STATUS[p?.status]; return s ? (s[p.g] || s.m) : ''; };
export const ageOf = (p, now = Date.now()) => (p?.born ? new Date(now).getFullYear() - p.born : null);
export const monthLabel = ym => {
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(ym || '')) return '';
  const [y, m, d] = ym.split('-');
  return `${d ? `${+d} ב` : ''}${MONTHS[+m - 1]} ${y}`;
};

// ---------- How long the service is, and how much is left ----------

// Months of regular service: men 2 years 8 months, women 2 years, and women in combat roles
// (דין אישה כדין גבר) 2 years 8 months like men.
export const TRACKS = {
  m32: { months: 32, label: 'בן', len: 'שנתיים ו־8 חודשים' },
  f24: { months: 24, label: 'בת', len: 'שנתיים' },
  f32: { months: 32, label: 'בת לוחמת', len: 'שנתיים ו־8 חודשים', note: 'דין אישה כדין גבר' },
};
export const trackOf = p => (TRACKS[p?.track] ? p.track : p?.g === 'f' ? 'f24' : 'm32');

const DAY_MS = 86400e3;
const utcDay = (y, m, d) => Date.UTC(y, m - 1, d);
const ymd = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

// From the draft date (a month alone counts from the 1st) and the track: days served (פז״ם),
// days left, the expected release date and how far along. `today` is the phone's local date.
export function serviceClock(p, now = Date.now()) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(p?.draft || '');
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +(m[3] || 1)];
  const months = TRACKS[trackOf(p)].months;
  const start = utcDay(y, mo, d);
  // Same day of the month, `months` later; a day the month doesn't have falls on its last day.
  const ey = y + Math.floor((mo - 1 + months) / 12), em = ((mo - 1 + months) % 12) + 1;
  const end = utcDay(ey, em, Math.min(d, new Date(Date.UTC(ey, em, 0)).getUTCDate()));
  const local = new Date(now);
  const today = utcDay(local.getFullYear(), local.getMonth() + 1, local.getDate());
  const total = Math.round((end - start) / DAY_MS);
  const served = Math.round((today - start) / DAY_MS);
  return {
    track: trackOf(p),
    start: ymd(start),
    end: ymd(end),
    total,
    served: Math.max(0, Math.min(served, total)),
    left: Math.max(0, Math.round((end - today) / DAY_MS)),
    untilDraft: served < 0 ? -served : 0,
    pct: Math.max(0, Math.min(1, served / total)),
    done: today >= end,
  };
}

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

// The role of today: an ongoing role (not a course) first, then the one that ended last.
export function currentRole(p) {
  const roles = (p?.roles || []).filter(r => r.kind !== 'course');
  const list = roles.length ? roles : p?.roles || [];
  return list.find(r => !r.to) || [...list].sort((a, b) => monthKey(b.to || b.from) - monthKey(a.to || a.from))[0] || null;
}

// 'YYYY' or 'YYYY-MM' as a month number (a year alone counts from its January); 0 when empty.
export const monthKey = ym => { const m = /^(\d{4})(?:-(\d{2}))?/.exec(String(ym || '')); return m ? +m[1] * 12 + (m[2] ? +m[2] - 1 : 0) : 0; };
export const ymOf = k => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;
const SHORT_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
// "אוג׳ 24" for a month, "2024" for a year alone.
export const shortYm = ym => { const m = /^(\d{4})(?:-(\d{2}))?/.exec(String(ym || '')); return !m ? '' : m[2] ? `${SHORT_MONTHS[+m[2] - 1]} ${m[1].slice(2)}` : m[1]; };
export const rangeLabel = r => (r.from || r.to ? `${shortYm(r.from) || '?'} – ${r.to ? shortYm(r.to) : 'היום'}` : '');

// ---------- Validation ----------

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
// Like str, but keeps line breaks (captions and story text).
const para = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const year = v => { const n = parseInt(v, 10); return n >= 1940 && n <= 2100 ? n : null; };
const ym = v => (/^\d{4}-(0[1-9]|1[0-2])$/.test(v || '') ? v : '');
// A month or a year, from older profiles that kept only the year (as a number).
const monthOrYear = v => { const t = String(v ?? '').trim(); return ym(t) || (/^(19[4-9]\d|20\d\d)$/.test(t) ? t : ''); };
const ymdOrYm = v => {
  if (ym(v)) return v;
  const m = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})$/.exec(v || '');
  return m && +m[3] >= 1 && +m[3] <= new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate() ? v : '';
};

export function cleanProfile(input = {}) {
  const p = input || {};
  const corps = CORPS[p.unit?.corps] ? p.unit.corps : '';
  const levels = corps ? CORPS[corps].levels.length : 0;
  const path = Array.from({ length: levels }, (_, i) => str(p.unit?.path?.[i], LIMITS.text));
  while (path.length && !path[path.length - 1]) path.pop();
  // Roles and courses: from and to are a month ('YYYY-MM') or a year ('YYYY'); no `to` means still
  // in it. `place` says where a course was; `unit` is the unit it was in, when not the main one.
  const roles = (Array.isArray(p.roles) ? p.roles : []).slice(0, LIMITS.roles)
    .map(r => {
      const uc = CORPS[r?.unit?.corps] ? r.unit.corps : '';
      const upath = uc ? Array.from({ length: CORPS[uc].levels.length }, (_, i) => str(r.unit.path?.[i], LIMITS.text)) : [];
      while (upath.length && !upath[upath.length - 1]) upath.pop();
      return {
        t: str(r?.t, LIMITS.text),
        kind: r?.kind === 'course' || (!r?.kind && /^קורס/.test(String(r?.t || '').trim())) ? 'course' : 'role',
        from: monthOrYear(r?.from),
        to: monthOrYear(r?.to),
        place: str(r?.place, LIMITS.text),
        unit: uc ? { corps: uc, path: upath } : null,
      };
    })
    .filter(r => r.t)
    .sort((a, b) => (monthKey(a.from) || 1e9) - (monthKey(b.from) || 1e9));
  const prepKind = PREP[p.prep?.kind] ? p.prep.kind : 'none';
  return {
    name: str(p.name, LIMITS.name),
    g: ['m', 'f', 'x'].includes(p.g) ? p.g : 'm',
    born: year(p.born) || '',
    city: str(p.city, LIMITS.text),
    bio: str(p.bio, LIMITS.bio),
    prep: { kind: prepKind, name: prepKind === 'none' ? '' : str(p.prep?.name, LIMITS.text) },
    status: STATUS[p.status] ? p.status : 'active',
    draft: ymdOrYm(p.draft),
    release: ym(p.release),
    // A track that doesn't fit the chosen form of address falls back to the default for it.
    track: TRACKS[p.track] && !(p.g === 'm' && p.track[0] === 'f') && !(p.g === 'f' && p.track[0] === 'm') ? p.track : '',
    unit: { corps, path },
    tironut: str(p.tironut, LIMITS.text),
    roles,
    vis: p.vis === 'all' ? 'all' : 'met',
    beret: BERETS[p.beret] ? p.beret : '',
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
  } else if (a.unit?.corps && corpsFamily(a.unit.corps) === corpsFamily(b.unit?.corps)) {
    push('corps', `שניכם ב${CORPS[corpsFamily(a.unit.corps)].name}`, '', 1);
  }
  if (a.prep?.kind !== 'none' && a.prep?.kind === b.prep?.kind) {
    if (a.prep.name && norm(a.prep.name) === norm(b.prep.name)) push('prep', a.prep.kind === 'mechina' ? 'אותה מכינה' : 'אותה שנת שירות', a.prep.name, 6);
    else push('prep', a.prep.kind === 'mechina' ? 'שניכם עשיתם מכינה' : 'שניכם עשיתם שנת שירות', '', 1);
  }
  if (a.tironut && norm(a.tironut) === norm(b.tironut)) push('tironut', 'טירונות באותו מקום', a.tironut, 4);
  if (a.draft && a.draft.slice(0, 7) === b.draft?.slice(0, 7)) push('draft', 'אותו מחזור גיוס', monthLabel(a.draft.slice(0, 7)), 4);
  else if (a.draft && b.draft && a.draft.slice(0, 4) === b.draft.slice(0, 4)) push('draft', 'התגייסתם באותה שנה', a.draft.slice(0, 4), 2);
  if (a.city && norm(a.city) === norm(b.city)) push('city', 'מאותה עיר', a.city, 3);
  // The same course in the same month: probably the same cohort.
  const sameCourse = (a.roles || []).find(r => r.kind === 'course' && r.from && (b.roles || []).some(x => x.kind === 'course' && norm(x.t) === norm(r.t) && x.from === r.from));
  if (sameCourse) push('course', 'אותו מחזור קורס!', `${sameCourse.t} · ${shortYm(sameCourse.from)}`, 7);
  const rb = new Set((b.roles || []).map(r => norm(r.t)));
  const role = (a.roles || []).find(r => rb.has(norm(r.t)) && r !== sameCourse);
  if (role) push('role', role.kind === 'course' ? 'אותו קורס' : 'אותו תפקיד', role.t, 2);

  return out.sort((x, y) => y.w - x.w);
}

export const commonScore = list => list.reduce((s, c) => s + c.w, 0);

// ---------- The network ----------
//
// store: a synchronous key/value-ish store (see MemoryStore in js/local.js and SqlStore in
// server/worker.js) with users, follows (a -> b, `met` when b's code was scanned) and events.
// opts: { now(), random(n) -> url-safe string of n chars, photoUrl(id, ver) }

const SUGGEST_MAX = 12;
const CHAT_PAGE = 40;
const CHAPCHA_GAP = 6 * 3600e3;
const MESSAGES_PER_MINUTE = 30;
export const convId = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const DAY = 86400e3;
const PAGE = 12;
const GRID_PAGE = 24;
const POSTS_PER_HOUR = 20;
const STORIES_PER_DAY = 30;
const MEDIA_MAX = 420 * 1024;
export const STORY_BG = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'];

const clampRatio = (r, min, max) => { const n = Number(r); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 1000) / 1000)) : 1; };

export function cleanImage(img) {
  if (typeof img !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > MEDIA_MAX) throw new ApiError(400, 'image');
  return img;
}
const EVENTS_MAX = 60;

export class Network {
  constructor(store, opts) {
    this.s = store;
    this.now = opts.now || (() => Date.now());
    this.random = opts.random;
    this.photoUrl = opts.photoUrl || ((id, ver) => (ver ? this.s.photo(id) : null));
    this.mediaUrl = opts.mediaUrl || (id => (id ? this.s.media(id) : null));
    // notify(userId, { title, body, url, tag }): a phone notification, sent by the server after the request.
    this.notify = opts.notify || (() => {});
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
      beret: beretOf(p),
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
    return { friends: this.friendsOf(id).size, followers: this.s.followers(id).length, following: this.s.following(id).length, posts: this.s.postCount(id) };
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
    return { ...this.full(u), key: u.key, counts: this.counts(u.id), unread: this.s.unread(u.id), unreadChats: this.s.unreadMessages(u.id) };
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
    // New followers reach the phone too; likes and role news stay in the activity tab.
    const a = (kind === 'follow' || kind === 'scan' || kind === 'friend') && this.s.user(actor);
    if (a) {
      const n = a.profile.name.split(' ')[0];
      const body = kind === 'friend' ? `${n} ${gen(a.profile, 'עקב', 'עקבה')} אחריך בחזרה. אתם חברים עכשיו`
        : kind === 'scan' ? `${n} ${gen(a.profile, 'סרק', 'סרקה')} את הקוד שלך ${gen(a.profile, 'ועוקב', 'ועוקבת')} אחריך`
          : `${n} ${gen(a.profile, 'התחיל', 'התחילה')} לעקוב אחריך`;
      this.notify(to, { title: kind === 'friend' ? 'חבר חדש' : 'עוקב חדש', body, url: `#u/${actor}`, tag: `f-${actor}` });
    }
  }

  // --- צ׳פחה: a quick hello, one per person every 6 hours ---

  chapcha(u, id) {
    const t = this.s.user(id);
    if (!t || t.id === u.id) throw new ApiError(404, 'not_found');
    const r = this.rel(u, t);
    if (!r.following && !r.followsMe && !r.met) throw new ApiError(403, 'private');
    const key = `cp:${id}`;
    const last = this.s.likeAt(key, u.id);
    const now = this.now();
    if (last && now - last < CHAPCHA_GAP) return { ok: false, next: last + CHAPCHA_GAP };
    this.s.deleteLike(key, u.id);
    this.s.putLike(key, u.id, now);
    this.s.addEvent(id, { kind: 'chapcha', actor: u.id, data: {}, at: now }, EVENTS_MAX);
    const n = u.profile.name.split(' ')[0];
    this.notify(id, { title: `${n} ${gen(u.profile, 'שלח', 'שלחה')} לך צ׳פחה 🤜`, body: `להחזיר ${gen(u.profile, 'לו', 'לה', 'לו/לה')} צ׳פחה?`, url: `#u/${u.id}`, tag: `cp-${u.id}` });
    return { ok: true, next: now + CHAPCHA_GAP };
  }

  // --- Chats ---
  //
  // You can write to friends, to people you met (scanned or were scanned), to people who follow
  // you, and to anyone who already wrote to you. Strangers can't open a chat.

  canChat(u, t) {
    if (!t || u.id === t.id) return false;
    const r = this.rel(u, t);
    return r.friends || r.met || r.followsMe || this.s.hasMessageFrom(convId(u.id, t.id), t.id);
  }

  messageView(u, m) {
    return { id: m.n, text: m.text, at: m.at, mine: m.sender === u.id, read: !!m.read, ...(m.meta?.story ? { story: true } : {}) };
  }

  chats(u) {
    return this.s.convs(u.id).map(c => {
      const other = c.a === u.id ? c.b : c.a;
      const t = this.s.user(other);
      return t ? { other: { ...this.summary(t), rel: this.rel(u, t) }, last: this.messageView(u, c.last), unread: c.unread } : null;
    }).filter(Boolean).sort((x, y) => y.last.at - x.last.at);
  }

  // Newest first; `after` (a message id) returns only newer ones, for checking while the chat is open.
  chat(u, id, { before = Infinity, after = 0 } = {}) {
    const t = this.s.user(id);
    if (!t) throw new ApiError(404, 'not_found');
    const conv = convId(u.id, id);
    const list = this.s.messages(conv, CHAT_PAGE, before, after);
    this.s.markConvRead(conv, u.id);
    return {
      other: { ...this.summary(t), rel: this.rel(u, t) },
      canSend: this.canChat(u, t),
      messages: list.map(m => this.messageView(u, m)),
      next: !after && list.length === CHAT_PAGE ? list[list.length - 1].n : null,
    };
  }

  send(u, id, { text, story } = {}) {
    const t = this.s.user(id);
    if (!t) throw new ApiError(404, 'not_found');
    if (!this.canChat(u, t)) throw new ApiError(403, 'cant_chat');
    const body = para(text, 1000);
    if (!body) throw new ApiError(400, 'empty');
    const now = this.now();
    if (this.s.sentSince(u.id, now - 60e3) >= MESSAGES_PER_MINUTE) throw new ApiError(429, 'slow_down');
    const m = { conv: convId(u.id, id), sender: u.id, recipient: id, text: body, at: now, meta: story ? { story: true } : null };
    m.n = this.s.addMessage(m);
    const n = u.profile.name.split(' ')[0];
    this.notify(id, { title: story ? `${n} ${gen(u.profile, 'הגיב', 'הגיבה')} לסטורי שלך` : n, body: body.slice(0, 140), url: `#chat/${u.id}`, tag: `m-${u.id}` });
    return this.messageView(u, m);
  }

  feed(u) {
    const events = this.s.events(u.id, 40).map(e => {
      const a = this.s.user(e.actor);
      return a ? { ...e, actor: { ...this.summary(a), rel: this.rel(u, a) } } : null;
    }).filter(Boolean);
    this.s.markRead(u.id);
    return { events, suggestions: this.suggest(u), stories: this.stories(u), tray: this.tray(u), posts: this.posts(u) };
  }

  // --- Posts ---
  //
  // A post is a photo with a caption. Posts and stories are seen by the same people who see the
  // full path: the author, people they follow, and people who met them (or everyone, with vis 'all').

  canSee(viewer, author, cache) {
    if (viewer?.id === author.id) return true;
    const k = author.id;
    if (cache && cache.has(k)) return cache.get(k);
    const ok = this.canSeeFull(viewer, author);
    cache?.set(k, ok);
    return ok;
  }

  postView(viewer, p, author = this.s.user(p.uid)) {
    if (!author) return null;
    return {
      id: p.id,
      author: this.summary(author),
      image: this.mediaUrl(p.media),
      ratio: p.ratio,
      caption: p.caption,
      at: p.at,
      likes: this.s.likeCount(p.id),
      liked: !!viewer && this.s.liked(p.id, viewer.id),
      mine: viewer?.id === p.uid,
    };
  }

  createPost(u, { image, caption, ratio } = {}) {
    const img = cleanImage(image);
    const now = this.now();
    if (this.s.postsBy(u.id, 25, Infinity).filter(p => now - p.at < 3600e3).length >= POSTS_PER_HOUR) throw new ApiError(429, 'slow_down');
    const media = this.random(16);
    this.s.putMedia(media, u.id, img);
    const p = { id: this.random(12), uid: u.id, media, ratio: clampRatio(ratio, 0.8, 1.91), caption: para(caption, 500), at: now };
    this.s.putPost(p);
    return this.postView(u, p, u);
  }

  deletePost(u, id) {
    const p = this.s.post(id);
    if (!p || p.uid !== u.id) throw new ApiError(404, 'not_found');
    this.s.deletePost(id);
    this.s.deleteMedia(p.media);
    return { ok: true };
  }

  like(u, id, on) {
    const p = this.s.post(id);
    const a = p && this.s.user(p.uid);
    if (!a) throw new ApiError(404, 'not_found');
    if (!this.canSee(u, a)) throw new ApiError(403, 'private');
    const had = this.s.liked(id, u.id);
    if (on && !had) {
      this.s.putLike(id, u.id, this.now());
      if (p.uid !== u.id) this.event(p.uid, 'like', u.id, { post: id });
    }
    if (!on && had) this.s.deleteLike(id, u.id);
    return { liked: !!on, likes: this.s.likeCount(id) };
  }

  // Posts by the people they follow, and their own, newest first.
  posts(u, before = Infinity) {
    const raw = this.s.feedPosts(u.id, PAGE, before || Infinity);
    const seen = new Map(), users = new Map();
    const items = raw.map(p => {
      const a = users.get(p.uid) || this.s.user(p.uid);
      if (!a) return null;
      users.set(p.uid, a);
      return this.canSee(u, a, seen) ? this.postView(u, p, a) : null;
    }).filter(Boolean);
    return { items, next: raw.length === PAGE ? raw[raw.length - 1].at : null };
  }

  userPosts(viewer, id, before = Infinity) {
    const a = this.s.user(id);
    if (!a) throw new ApiError(404, 'not_found');
    if (!this.canSee(viewer, a)) throw new ApiError(403, 'private');
    const raw = this.s.postsBy(id, GRID_PAGE, before || Infinity);
    return { items: raw.map(p => this.postView(viewer, p, a)), next: raw.length === GRID_PAGE ? raw[raw.length - 1].at : null };
  }

  post(viewer, id) {
    const p = this.s.post(id);
    const a = p && this.s.user(p.uid);
    if (!a) throw new ApiError(404, 'not_found');
    if (!this.canSee(viewer, a)) throw new ApiError(403, 'private');
    return this.postView(viewer, p, a);
  }

  // --- Stories: a photo or a line of text, gone after 24 hours ---

  storyView(viewer, st) {
    const mine = viewer?.id === st.uid;
    return {
      id: st.id, image: st.media ? this.mediaUrl(st.media) : null, text: st.text, bg: st.bg, at: st.at,
      seen: mine || (!!viewer && this.s.seen(st.id, viewer.id)),
      liked: !!viewer && !mine && this.s.liked(`st:${st.id}`, viewer.id),
      ...(mine ? { views: this.s.viewCount(st.id), likes: this.s.likeCount(`st:${st.id}`) } : {}),
    };
  }

  createStory(u, { image, text, bg } = {}) {
    const now = this.now();
    for (const m of this.s.purgeStories(now - DAY, 100)) if (m) this.s.deleteMedia(m);
    if (this.s.storiesBy(u.id, now - DAY).length >= STORIES_PER_DAY) throw new ApiError(429, 'slow_down');
    const t = para(text, 200);
    if (!image && !t) throw new ApiError(400, 'empty');
    let media = null;
    if (image) { media = this.random(16); this.s.putMedia(media, u.id, cleanImage(image)); }
    const st = { id: this.random(12), uid: u.id, media, text: t, bg: STORY_BG.includes(bg) ? bg : STORY_BG[0], at: now };
    this.s.putStory(st);
    return this.storyView(u, st);
  }

  // The round avatars at the top of the home screen: their own first, then unseen, then seen.
  tray(u) {
    const since = this.now() - DAY;
    const groups = new Map();
    for (const st of this.s.storyFeed(u.id, since)) {
      if (!groups.has(st.uid)) groups.set(st.uid, []);
      groups.get(st.uid).push(st);
    }
    const seen = new Map();
    const out = [];
    for (const [uid, list] of groups) {
      const a = uid === u.id ? u : this.s.user(uid);
      if (!a || !this.canSee(u, a, seen)) continue;
      const stories = list.sort((x, y) => x.at - y.at).map(st => this.storyView(u, st));
      out.push({ author: this.summary(a), mine: uid === u.id, stories, seen: stories.every(x => x.seen), last: stories[stories.length - 1].at });
    }
    return out.sort((x, y) => y.mine - x.mine || x.seen - y.seen || y.last - x.last);
  }

  seeStory(u, id) {
    const st = this.s.story(id);
    if (!st || st.at < this.now() - DAY) throw new ApiError(404, 'not_found');
    if (st.uid !== u.id) this.s.putView(id, u.id, this.now());
    return { ok: true };
  }

  storyViewers(u, id) {
    const st = this.s.story(id);
    if (!st || st.uid !== u.id) throw new ApiError(404, 'not_found');
    return this.s.views(id).map(v => { const x = this.s.user(v.uid); return x ? { ...this.summary(x), at: v.at } : null; }).filter(Boolean);
  }

  // A heart on someone's story (stored with the post likes, as st:<id>); the author gets one event.
  likeStory(u, id, on) {
    const st = this.s.story(id);
    const a = st && st.at > this.now() - DAY && this.s.user(st.uid);
    if (!a) throw new ApiError(404, 'not_found');
    if (st.uid === u.id || !this.canSee(u, a)) throw new ApiError(403, 'private');
    const key = `st:${id}`;
    const had = this.s.liked(key, u.id);
    if (on && !had) { this.s.putLike(key, u.id, this.now()); this.event(st.uid, 'story_like', u.id, { story: id }); }
    if (!on && had) this.s.deleteLike(key, u.id);
    return { liked: !!on };
  }

  deleteStory(u, id) {
    const st = this.s.story(id);
    if (!st || st.uid !== u.id) throw new ApiError(404, 'not_found');
    this.s.deleteStory(id);
    this.s.deletePost(`st:${id}`);
    if (st.media) this.s.deleteMedia(st.media);
    return { ok: true };
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
