// State and the rules about doses. Everything lives on the phone (localStorage); the reminder
// server only gets times and random ids (see push.js).

const KEY = 'remind.v1';

export const SLOTS = {
  morning: { label: 'בוקר', icon: 'sunrise', time: '08:00' },
  noon: { label: 'צהריים', icon: 'sun', time: '13:00' },
  evening: { label: 'ערב', icon: 'moon', time: '20:00' },
};

export const FORMS = {
  tablet: { label: 'כדור', icon: 'tablet', unit: 'כדור', units: 'כדורים' },
  capsule: { label: 'קפסולה', icon: 'capsule', unit: 'קפסולה', units: 'קפסולות' },
  liquid: { label: 'סירופ', icon: 'bottle', unit: 'מ״ל', units: 'מ״ל' },
  drops: { label: 'טיפות', icon: 'drop', unit: 'טיפה', units: 'טיפות' },
  inhaler: { label: 'משאף', icon: 'inhaler', unit: 'שאיפה', units: 'שאיפות' },
  injection: { label: 'זריקה', icon: 'syringe', unit: 'זריקה', units: 'זריקות' },
};

export const FOOD = {
  any: 'לא משנה',
  before: 'לפני האוכל',
  with: 'עם האוכל',
  after: 'אחרי האוכל',
};

export const COLORS = ['#0A84FF', '#30B0C7', '#34C759', '#FF9F0A', '#FF453A', '#FF375F', '#BF5AF2', '#8E8E93'];
export const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// How long after its time a dose counts as "now", and when it counts as missed.
export const DUE_BEFORE = 30;
export const MISSED_AFTER = 120;

export function defaults() {
  return {
    onboarded: false,
    profile: {
      name: '',
      slots: {
        morning: { on: true, time: '08:00' },
        noon: { on: true, time: '13:00' },
        evening: { on: true, time: '20:00' },
      },
      nag: 15,
      textSize: 'l',
      theme: 'auto',
      contact: { name: '', phone: '' },
    },
    meds: [],
    log: {},
    device: { id: null, push: false },
  };
}

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === 'object') {
      const base = defaults();
      return { ...base, ...saved, profile: { ...base.profile, ...saved.profile, slots: { ...base.profile.slots, ...saved.profile?.slots } }, device: { ...base.device, ...saved.device } };
    }
  } catch {}
  return defaults();
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

// ---------- Dates ----------

const pad = n => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (key, n) => { const d = parseDate(key); d.setDate(d.getDate() + n); return dateKey(d); };
export const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
export const nowMinutes = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
export const clock = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('');

export function prettyDate(key) {
  const d = parseDate(key);
  return `יום ${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]}`;
}

export function relativeDay(key) {
  const today = dateKey();
  if (key === today) return 'היום';
  if (key === addDays(today, -1)) return 'אתמול';
  if (key === addDays(today, 1)) return 'מחר';
  return prettyDate(key);
}

export function inMinutes(diff) {
  if (diff < 1) return 'עכשיו';
  if (diff < 60) return diff === 1 ? 'בעוד דקה' : `בעוד ${diff} דקות`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  const hours = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  return m ? `בעוד ${hours} ו־${m} דק׳` : `בעוד ${hours}`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'בוקר טוב';
  if (h >= 12 && h < 17) return 'צהריים טובים';
  if (h >= 17 && h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

// ---------- Doses ----------

export function slotTime(state, slot) {
  return SLOTS[slot] ? state.profile.slots[slot]?.time || SLOTS[slot].time : slot;
}

export function slotTitle(slot) {
  return SLOTS[slot]?.label || `בשעה ${slot}`;
}

export function slotIcon(slot) {
  if (SLOTS[slot]) return SLOTS[slot].icon;
  const m = minutes(slot);
  return m < 11 * 60 ? 'sunrise' : m < 17 * 60 ? 'sun' : 'moon';
}

export function activeOn(med, date) {
  if (med.start && date < med.start) return false;
  if (med.until && date > med.until) return false;
  if (med.deleted && date >= med.deleted) return false;
  if (med.days && !med.days.includes(parseDate(date).getDay())) return false;
  return true;
}

export const doseKey = (med, slot) => `${med.id}@${slot}`;

// The doses of a day, grouped by time: [{ time, slot, doses: [{ key, med, slot, time }] }].
export function dayPlan(state, date) {
  const groups = new Map();
  for (const med of state.meds) {
    if (!activeOn(med, date)) continue;
    for (const slot of med.times) {
      const time = slotTime(state, slot);
      // A medicine added today doesn't owe the doses whose window had already closed.
      if (med.created && date === med.start && minutes(time) + MISSED_AFTER < nowMinutes(new Date(med.created))) continue;
      if (!groups.has(time)) groups.set(time, { time, slot, doses: [] });
      const g = groups.get(time);
      if (SLOTS[slot]) g.slot = slot;
      g.doses.push({ key: doseKey(med, slot), med, slot, time });
    }
  }
  return [...groups.values()].sort((a, b) => minutes(a.time) - minutes(b.time));
}

export const takenAt = (state, date, key) => state.log[date]?.[key] || null;

// 'taken' | 'due' | 'missed' | 'upcoming' | 'late' (past its time but still in the window)
export function status(state, date, dose, now = new Date()) {
  if (takenAt(state, date, dose.key)) return 'taken';
  const today = dateKey(now);
  if (date < today) return 'missed';
  if (date > today) return 'upcoming';
  const diff = nowMinutes(now) - minutes(dose.time);
  if (diff > MISSED_AFTER) return 'missed';
  if (diff > 0) return 'late';
  if (diff >= -DUE_BEFORE) return 'due';
  return 'upcoming';
}

export function daySummary(state, date) {
  let total = 0;
  let taken = 0;
  for (const g of dayPlan(state, date)) {
    for (const d of g.doses) {
      total++;
      if (takenAt(state, date, d.key)) taken++;
    }
  }
  return { total, taken };
}

// The next group of doses that still needs taking: today from now on, otherwise tomorrow's first.
export function nextUp(state, now = new Date()) {
  const today = dateKey(now);
  for (const g of dayPlan(state, today)) {
    const pending = g.doses.filter(d => !takenAt(state, today, d.key));
    if (pending.length && minutes(g.time) - nowMinutes(now) > -MISSED_AFTER) return { date: today, group: g, pending };
  }
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    const g = dayPlan(state, date)[0];
    if (g) return { date, group: g, pending: g.doses };
  }
  return null;
}

export function doseText(med) {
  const form = FORMS[med.form] || FORMS.tablet;
  const n = Number(med.amount) || 1;
  if (form.unit === 'מ״ל') return `${n} מ״ל`;
  if (n === 0.5) return `חצי ${form.unit}`;
  if (n === 1) return `${form.unit} ${med.form === 'tablet' ? 'אחד' : 'אחת'}`;
  return `${n} ${form.units}`;
}

export function scheduleText(state, med) {
  const times = med.times.map(s => (SLOTS[s] ? SLOTS[s].label : s)).join(', ');
  const days = !med.days || med.days.length === 7 ? 'כל יום' : med.days.map(d => WEEKDAYS[d] + '׳').join(' ');
  return `${times} · ${days}`;
}

// Days of stock left, at today's rate. null when not tracked.
export function stockDays(state, med) {
  if (med.stock == null) return null;
  const perDay = med.times.length * (Number(med.amount) || 1) * (med.days ? med.days.length / 7 : 1);
  return perDay ? Math.floor(med.stock / perDay) : null;
}

// ---------- History ----------

export function streak(state, now = new Date()) {
  let date = dateKey(now);
  const today = daySummary(state, date);
  // Today counts only once it's complete; an unfinished today doesn't break the streak.
  let n = today.total && today.taken === today.total ? 1 : 0;
  for (let i = 0; i < 365; i++) {
    date = addDays(date, -1);
    const s = daySummary(state, date);
    if (!s.total) {
      if (!state.meds.some(m => !m.start || m.start <= date)) break;
      continue;
    }
    if (s.taken < s.total) break;
    n++;
  }
  return n;
}

export function adherence(state, days, now = new Date()) {
  let total = 0;
  let taken = 0;
  const today = dateKey(now);
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -i);
    for (const g of dayPlan(state, date)) {
      for (const d of g.doses) {
        // Today's doses that aren't due yet don't count against.
        if (date === today && status(state, date, d, now) === 'upcoming') continue;
        total++;
        if (takenAt(state, date, d.key)) taken++;
      }
    }
  }
  return total ? Math.round((taken / total) * 100) : null;
}

// ---------- What the reminder server gets ----------

export function serverSchedule(state) {
  const groups = new Map();
  const today = dateKey();
  for (const med of state.meds) {
    if (med.deleted || (med.until && med.until < today)) continue;
    for (const slot of med.times) {
      const t = slotTime(state, slot);
      if (!groups.has(t)) groups.set(t, { t, items: [] });
      const item = { k: doseKey(med, slot), d: med.days || null };
      if (med.start) item.s = med.start;
      if (med.until) item.u = med.until;
      groups.get(t).items.push(item);
    }
  }
  return [...groups.values()];
}

export function serverTaken(state) {
  const out = {};
  const today = dateKey();
  for (const date of [addDays(today, -1), today]) out[date] = Object.keys(state.log[date] || {});
  return out;
}
