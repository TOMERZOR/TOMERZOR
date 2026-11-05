// The company's data and every rule about it: soldiers, sites, and the events that say where each
// soldier is on each day. Kept in localStorage, on the phone only.

const KEY = 'mapel-v1';

/* ---------- Dates (local, as YYYY-MM-DD strings) ---------- */

export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const today = () => iso(new Date());
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const wd = s => parse(s).getDay();
export const dates = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i));
export const isWeekend = s => wd(s) === 5 || wd(s) === 6;

const WD = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const WDL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WEEKDAYS = WD;
export const fmtShort = s => { const d = parse(s); return `${d.getDate()}.${d.getMonth() + 1}`; };
export const fmtDay = s => `${WD[wd(s)]} ${fmtShort(s)}`;
export const fmtLong = s => `יום ${WDL[wd(s)]}, ${fmtShort(s)}`;
// LRI…PDI keeps a range of numbers in reading order inside Hebrew text
export const iso2 = t => `\u2066${t}\u2069`;
export const fmtRange = (a, b) => (a === b ? fmtShort(a) : iso2(`${fmtShort(a)}–${fmtShort(b)}`));
export const daysWord = n => (n === 1 ? 'יום אחד' : n === 2 ? 'יומיים' : `${n} ימים`);

/* ---------- Kinds of events ---------- */

// main: fills the whole day (one per soldier per day). The others sit on top of the day.
export const KINDS = {
  site:       { label: 'נוכחות', color: null,      main: true,  pri: 5 },
  home:       { label: 'בבית',   color: '#8e8e93', main: true,  pri: 3 },
  gimel:      { label: 'גימלים', color: '#ff3b30', main: true,  pri: 0 },
  leave:      { label: 'חופשה',  color: '#32ade6', main: true,  pri: 1 },
  course:     { label: 'קורס',   color: '#af52de', main: true,  pri: 2 },
  other:      { label: 'אחר',    color: '#a2845e', main: true,  pri: 4 },
  referral:   { label: 'הפניה',  color: '#ff9500', main: false },
  constraint: { label: 'אילוץ',  color: '#e6b800', main: false },
};
export const KIND_ORDER = ['site', 'home', 'gimel', 'referral', 'leave', 'course', 'constraint', 'other'];
export const isMain = k => !!KINDS[k]?.main;

export const SITE_COLORS = ['#007aff', '#34c759', '#5856d6', '#ff2d55', '#00c7be', '#248a3d', '#c75b12', '#3a5ba0'];

/* ---------- State ---------- */

export const uid = () => Math.random().toString(36).slice(2, 10);

function blank() {
  return {
    v: 1,
    unit: '',
    start: today(),
    days: 14,
    unassigned: 'home',          // a day with nothing on it: 'home' (shown as בבית) or 'blank'
    rules: { maxStreak: 7, minRest: 3 },
    sites: [],
    platoons: [],                // the פלגות, in the order the commander made them
    soldiers: [],
    events: [],
    onboarded: false,
  };
}

// Older data had no list of פלגות, only the name on each soldier: make the list from those.
function withPlatoons(st) {
  if (!Array.isArray(st.platoons)) st.platoons = [];
  for (const so of st.soldiers || []) {
    const p = (so.platoon || '').trim();
    if (p && !st.platoons.includes(p)) st.platoons.push(p);
  }
  return st;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withPlatoons({ ...blank(), ...JSON.parse(raw) });
  } catch {}
  return blank();
}

let state = load();
const subs = new Set();
let undoSnap = null;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export const get = () => state;
export const subscribe = f => { subs.add(f); return () => subs.delete(f); };
const emit = () => subs.forEach(f => f());

// Every change goes through here. undoable: keeps a copy of the state before, for the toast's undo.
export function commit(mut, { undoable = false } = {}) {
  undoSnap = undoable ? JSON.stringify(state) : null;
  const out = mut(state);
  save();
  emit();
  return out;
}
export function undo() {
  if (!undoSnap) return false;
  state = JSON.parse(undoSnap);
  undoSnap = null;
  save();
  emit();
  return true;
}
export function replaceAll(next) {
  state = withPlatoons({ ...blank(), ...next, onboarded: true });
  save();
  emit();
}
export function resetAll() {
  state = blank();
  save();
  emit();
}

/* ---------- Lookups ---------- */

export const siteById = (st, id) => st.sites.find(s => s.id === id);
export const soldierById = (st, id) => st.soldiers.find(s => s.id === id);
export const periodDates = st => dates(st.start, st.days);
export const needOn = (site, date) =>
  (isWeekend(date) && site.weekendNeed != null && site.weekendNeed !== '' ? +site.weekendNeed : +site.need) || 0;

export const platoonList = st => [...(st.platoons || [])];

// By פלגה (in the order they were made, no פלגה last), then by name.
export function sortedSoldiers(st) {
  const order = new Map(platoonList(st).map((p, i) => [p, i]));
  const rank = so => (so.platoon && order.has(so.platoon) ? order.get(so.platoon) : 1e6);
  return [...st.soldiers].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'he'));
}

export function addPlatoon(st, name) {
  const n = name.trim();
  if (n && !st.platoons.includes(n)) st.platoons.push(n);
  return n;
}
export function renamePlatoon(st, from, to) {
  const n = to.trim();
  st.platoons = st.platoons.map(p => (p === from ? n : p)).filter((p, i, a) => a.indexOf(p) === i);
  for (const so of st.soldiers) if (so.platoon === from) so.platoon = n;
}
export function removePlatoon(st, name) {
  st.platoons = st.platoons.filter(p => p !== name);
  for (const so of st.soldiers) if (so.platoon === name) so.platoon = '';
}

export function index(st) {
  const by = new Map();
  for (const e of st.events) {
    if (!by.has(e.soldierId)) by.set(e.soldierId, []);
    by.get(e.soldierId).push(e);
  }
  return by;
}

export function covers(e, date) {
  if (date < e.from) return false;
  if (e.to && date > e.to) return false;
  if (e.weekdays && e.weekdays.length && !e.weekdays.includes(wd(date))) return false;
  return true;
}

// Everything on one soldier's day: the main event, referrals and constraints.
export function dayOf(idx, sid, date) {
  let main = null;
  const refs = [], cons = [];
  for (const e of idx.get(sid) || []) {
    if (!covers(e, date)) continue;
    if (e.kind === 'referral') refs.push(e);
    else if (e.kind === 'constraint') cons.push(e);
    else if (!main || KINDS[e.kind].pri < KINDS[main.kind].pri || (KINDS[e.kind].pri === KINDS[main.kind].pri && main.auto && !e.auto)) main = e;
  }
  refs.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  return { main, refs, cons };
}

// How an event (or an empty day) looks: label and color.
export function look(st, main) {
  if (!main) return st.unassigned === 'home'
    ? { label: 'בבית', color: KINDS.home.color, idle: true, key: 'none' }
    : { label: '', color: null, idle: true, key: 'none' };
  if (main.kind === 'site') {
    const s = siteById(st, main.siteId);
    return { label: s ? s.name : 'אתר', color: s ? s.color : '#8e8e93', key: 'site:' + main.siteId };
  }
  if (main.kind === 'other') return { label: main.note || 'אחר', color: KINDS.other.color, key: 'other' };
  return { label: KINDS[main.kind].label, color: KINDS[main.kind].color, key: main.kind };
}

export function kindLabel(st, e) {
  if (e.kind === 'site') return siteById(st, e.siteId)?.name || 'נוכחות';
  return KINDS[e.kind].label;
}

// The hours of an event on one of its days. A multi-day event starts at `start` on its first day
// and ends at `end` on its last day.
export function timeText(e, date) {
  const single = e.from === e.to;
  const s = (single || date === e.from || e.weekdays?.length) ? e.start : '';
  const en = (single || date === e.to || e.weekdays?.length) ? e.end : '';
  if (s && en) return iso2(`${s}–${en}`);
  if (s) return `מ־${s}`;
  if (en) return `עד ${en}`;
  return '';
}

// Is the event going on at this exact moment?
export function activeAt(e, date, time) {
  if (!covers(e, date)) return false;
  const single = e.from === e.to || e.weekdays?.length;
  const s = (single || date === e.from) ? e.start : '';
  const en = (single || date === e.to) ? e.end : '';
  if (s && time < s) return false;
  if (en && time >= en) return false;
  return true;
}

export const eventDays = e => (e.to ? diffDays(e.from, e.to) + 1 : null);

/* ---------- Mutations (call inside commit) ---------- */

// Removes main events of a soldier from [from, to], splitting the ones that stick out.
export function carve(st, sid, from, to, exceptId) {
  const out = [];
  for (const e of st.events) {
    if (e.soldierId !== sid || e.id === exceptId || !isMain(e.kind) || e.to < from || e.from > to) { out.push(e); continue; }
    if (e.from < from) out.push({ ...e, to: addDays(from, -1), end: '' });
    if (e.to > to) out.push({ ...e, id: e.from < from ? uid() : e.id, from: addDays(to, 1), start: '' });
  }
  st.events = out;
}

// Joins back-to-back main events that are the same thing (so the list stays short).
export function mergeAdjacent(st, sid) {
  const mine = st.events.filter(e => e.soldierId === sid && isMain(e.kind)).sort((a, b) => a.from.localeCompare(b.from));
  const gone = new Set();
  let prev = null;
  for (const e of mine) {
    if (prev && prev.kind === e.kind && (prev.siteId || '') === (e.siteId || '') && (prev.note || '') === (e.note || '') &&
        !!prev.auto === !!e.auto && !prev.end && !e.start && addDays(prev.to, 1) === e.from) {
      prev.to = e.to;
      prev.end = e.end;
      gone.add(e.id);
      continue;
    }
    prev = e;
  }
  if (gone.size) st.events = st.events.filter(e => !gone.has(e.id));
}

export function addEvent(st, ev) {
  const e = { id: uid(), note: '', start: '', end: '', auto: false, ...ev };
  if (e.kind !== 'site') delete e.siteId;
  if (isMain(e.kind)) {
    if (!e.to) e.to = e.from;
    delete e.weekdays;
    carve(st, e.soldierId, e.from, e.to);
  }
  st.events.push(e);
  if (isMain(e.kind)) mergeAdjacent(st, e.soldierId);
  return e;
}

export function updateEvent(st, id, patch) {
  const i = st.events.findIndex(e => e.id === id);
  if (i < 0) return;
  const e = { ...st.events[i], ...patch, auto: false };
  if (e.kind !== 'site') delete e.siteId;
  st.events.splice(i, 1);
  if (isMain(e.kind)) {
    if (!e.to) e.to = e.from;
    delete e.weekdays;
    carve(st, e.soldierId, e.from, e.to);
  }
  st.events.push(e);
  if (isMain(e.kind)) mergeAdjacent(st, e.soldierId);
}

export function removeEvent(st, id) {
  st.events = st.events.filter(e => e.id !== id);
}

// Puts the same thing on many (soldier, day) cells, one event per run of days in a row.
export function applyCells(st, cells, payload) {
  const by = new Map();
  for (const c of cells) {
    if (!by.has(c.sid)) by.set(c.sid, []);
    by.get(c.sid).push(c.date);
  }
  let n = 0;
  for (const [sid, ds] of by) {
    ds.sort();
    let runStart = ds[0], prev = ds[0];
    const flush = () => { addEvent(st, { ...payload, soldierId: sid, from: runStart, to: prev }); n++; };
    for (let i = 1; i < ds.length; i++) {
      if (addDays(prev, 1) !== ds[i]) { flush(); runStart = ds[i]; }
      prev = ds[i];
    }
    flush();
  }
  return n;
}

// Clears the main event of each cell, and referrals that are on that day only.
export function clearCells(st, cells) {
  for (const c of cells) {
    carve(st, c.sid, c.date, c.date);
    st.events = st.events.filter(e => !(e.soldierId === c.sid && e.kind === 'referral' && e.from === c.date && e.to === c.date));
  }
}

export function removeSoldier(st, id) {
  st.soldiers = st.soldiers.filter(s => s.id !== id);
  st.events = st.events.filter(e => e.soldierId !== id);
}

export function removeSite(st, id) {
  st.sites = st.sites.filter(s => s.id !== id);
  st.events = st.events.filter(e => !(e.kind === 'site' && e.siteId === id));
}

/* ---------- Views over the data ---------- */

// Who is at each site on a day.
export function siteRoster(st, idx, date) {
  const map = new Map(st.sites.map(s => [s.id, []]));
  for (const so of st.soldiers) {
    const { main } = dayOf(idx, so.id, date);
    if (main?.kind === 'site' && map.has(main.siteId)) map.get(main.siteId).push({ soldier: so, ev: main });
  }
  return map;
}

// Things in the period that need the commander's attention.
export function problems(st) {
  const idx = index(st);
  const out = [];
  for (const d of periodDates(st)) {
    const roster = siteRoster(st, idx, d);
    for (const s of st.sites) {
      const need = needOn(s, d);
      const have = roster.get(s.id).length;
      if (have < need) out.push({ type: 'short', date: d, site: s, need, have });
    }
    for (const so of st.soldiers) {
      const x = dayOf(idx, so.id, d);
      if (x.main?.kind === 'site' && x.cons.length) out.push({ type: 'conflict', date: d, soldier: so, ev: x.main, con: x.cons[0] });
    }
  }
  return out;
}

// Presence (נוכחות) is being at a site. Over a weekend, Thursday to Saturday, it's a closing (סגירה):
// Friday and Saturday always, and Thursday when it goes on into Friday. Sunday is never a closing.
export function atSite(idx, sid, date) {
  const m = dayOf(idx, sid, date).main;
  return m?.kind === 'site' ? m : null;
}
export function isClosing(idx, sid, date) {
  if (!atSite(idx, sid, date)) return false;
  const w = wd(date);
  if (w === 5 || w === 6) return true;
  if (w === 4) return !!atSite(idx, sid, addDays(date, 1));
  return false;
}
export const presenceWord = (idx, sid, date) => (isClosing(idx, sid, date) ? 'סגירה' : 'נוכחות');

// What a presence event is called: סגירה when all of it is a weekend closing, otherwise נוכחות
// (with a note when part of it is a closing).
export function presenceTitle(idx, e) {
  const ds = dates(e.from, Math.min(60, diffDays(e.from, e.to) + 1));
  const n = ds.filter(d => isClosing(idx, e.soldierId, d)).length;
  if (!n) return 'נוכחות';
  return n === ds.length ? 'סגירה' : 'נוכחות, כולל סגירה';
}

// Days per kind for a soldier inside the period, and how many weekends they closed.
export function tally(st, idx, sid) {
  const t = { site: 0, home: 0, gimel: 0, leave: 0, course: 0, other: 0, none: 0, referral: 0, closings: 0 };
  const weekends = new Set();
  for (const d of periodDates(st)) {
    const x = dayOf(idx, sid, d);
    if (x.main) t[x.main.kind]++; else t.none++;
    t.referral += x.refs.length;
    if (x.main?.kind === 'site' && (wd(d) === 5 || wd(d) === 6)) weekends.add(wd(d) === 5 ? d : addDays(d, -1));
  }
  t.closings = weekends.size;
  return t;
}
