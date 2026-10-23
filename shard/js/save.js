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
    pending: {},          // productId -> time a purchase went pending
    txns: [],             // store transactions already granted
    reviewAsked: false,
    crystals: 0,          // star crystals shattered (one fills every CRYSTAL_STARS stars)
    perfTier: 0,          // adaptive quality tier this device settled on (0 = full)
    worldsSeen: [],       // worlds whose title card has played
    tipsSeen: [],         // new glass types already explained by the coach (frost, lock)
    mapAt: 0,             // the level the map last showed as next (the ball hops on from there)
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
  if (!out.pending || typeof out.pending !== 'object' || Array.isArray(out.pending)) out.pending = {};
  if (!Array.isArray(out.txns)) out.txns = [];
  // (8) a save from before crystals existed starts with one full crystal, not a backlog of them
  if (d.crystals === undefined && out.stars && typeof out.stars === 'object') {
    const total = Object.values(out.stars).reduce((a, v) => a + (+v || 0), 0);
    out.crystals = Math.max(0, Math.floor(total / 15) - 1);
  }
  if (!Number.isInteger(out.crystals) || out.crystals < 0) out.crystals = 0;
  if (!Array.isArray(out.worldsSeen)) out.worldsSeen = [];
  if (!Array.isArray(out.tipsSeen)) out.tipsSeen = [];
  // a save from before the map has no idea where the ball was: its first visit shows it in place, without a hop
  if (d.mapAt === undefined || !Number.isInteger(out.mapAt) || out.mapAt < 0) out.mapAt = undefined;
  if (!Number.isInteger(out.perfTier) || out.perfTier < 0 || out.perfTier > 3) out.perfTier = 0;
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
