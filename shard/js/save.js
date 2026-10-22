// Local save with versioning and a backup copy, resilient to quota and private mode.
const KEY = 'shard.save', BAK = 'shard.save.bak', VERSION = 1;

export function defaults() {
  return {
    v: VERSION,
    stars: {},            // levelId -> best stars
    coins: 0,
    skin: 'steel',
    owned: ['steel'],
    settings: { sfx: true, music: true, haptics: true },
    noAds: false,
    hints: {},            // world -> free hint used
    daily: { last: null, streak: 0, best: 0, done: {} },
    stats: { shots: 0, glass: 0, clears: 0, bestCombo: 0, played: 0 },
    ads: { clearsSince: 0, lastAt: 0 },
    starterSeen: false,
    tutorialDone: false,
    reviewAsked: false,
    reminders: undefined, // undefined = never asked
    created: Date.now(),
  };
}

function migrate(d) {
  const base = defaults();
  if (!d || typeof d !== 'object') return base;
  const out = { ...base, ...d };
  for (const k of ['settings', 'daily', 'stats', 'ads']) out[k] = { ...base[k], ...(d[k] || {}) };
  if (!Array.isArray(out.owned)) out.owned = ['steel'];
  if (!out.owned.includes('steel')) out.owned.unshift('steel');
  if (!Number.isFinite(out.coins) || out.coins < 0) out.coins = 0;
  out.v = VERSION;
  return out;
}

function read(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

let data = migrate(read(KEY) || read(BAK));
let timer = null;

export const save = {
  get d() { return data; },
  flush() {
    clearTimeout(timer); timer = null;
    try {
      const raw = JSON.stringify(data);
      localStorage.setItem(KEY, raw);
      localStorage.setItem(BAK, raw);
    } catch (e) { /* storage full or blocked: keep playing in memory */ }
  },
  touch() { if (!timer) timer = setTimeout(() => save.flush(), 250); },
  reset() { data = defaults(); save.flush(); },
};
window.addEventListener('pagehide', () => save.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) save.flush(); });

export function totalStars() { return Object.values(data.stars).reduce((s, v) => s + v, 0); }
export function worldStars(levels, w) { return levels.filter((l) => l.world === w).reduce((s, l) => s + (data.stars[l.id] || 0), 0); }
