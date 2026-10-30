// Everything Mabat keeps is on this phone (localStorage): settings, the watchlist, positions and
// closed trades. The server gets only what it needs to ring alerts.

const KEY = 'mabat-v1';

export const DEFAULTS = {
  device: { id: null, push: false },
  prefs: { entries: true, near: false, scope: 'all', minScore: 70, bell: false, news: true, congress: true, positions: true },
  risk: { budget: null, riskPct: 1, maxPositionPct: 25, cashBufferPct: 10, fractional: true },
  sec: '',
  watch: [],
  positions: [],
  closed: [],
  onboarded: false,
  feedSeenAt: 0,
  scannerFilter: 'all',
};

const clone = v => JSON.parse(JSON.stringify(v));

export function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  const state = clone(DEFAULTS);
  for (const k of Object.keys(DEFAULTS)) {
    if (saved[k] === undefined) continue;
    state[k] = DEFAULTS[k] && typeof DEFAULTS[k] === 'object' && !Array.isArray(DEFAULTS[k]) ? { ...DEFAULTS[k], ...saved[k] } : saved[k];
  }
  return state;
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// What the server needs: alert settings, tickers to scan, and each position's stop and target.
export function serverPayload(state) {
  return {
    prefs: state.prefs,
    watch: state.watch,
    positions: state.positions.map(p => ({ id: p.id, t: p.t, entry: p.entry, stop: p.stop, t1: p.t1, t2: p.t2 ?? p.target, setup: p.setup, level: p.level, date: p.date })),
    sec: state.sec,
  };
}

// trader-tax: a holding of more than a year is long term.
export function taxTerm(date, until = Date.now()) {
  if (!date) return null;
  const start = new Date(`${date}T12:00:00Z`);
  const year = new Date(start);
  year.setUTCFullYear(year.getUTCFullYear() + 1);
  return until > year.getTime() ? 'long' : 'short';
}

export function daysHeld(date, until = Date.now()) {
  return date ? Math.max(0, Math.floor((until - Date.parse(`${date}T12:00:00Z`)) / 86400000)) : 0;
}

export function exportData(state) {
  const { watch, positions, closed, risk, prefs, sec } = state;
  return JSON.stringify({ app: 'mabat', version: 1, exported: new Date().toISOString(), watch, positions, closed, risk, prefs, sec }, null, 2);
}

export function importData(state, text) {
  const data = JSON.parse(text);
  if (data?.app !== 'mabat') throw new Error('not a Mabat backup');
  for (const k of ['watch', 'positions', 'closed']) if (Array.isArray(data[k])) state[k] = data[k];
  for (const k of ['risk', 'prefs']) if (data[k] && typeof data[k] === 'object') state[k] = { ...state[k], ...data[k] };
  if (typeof data.sec === 'string') state.sec = data.sec;
}
