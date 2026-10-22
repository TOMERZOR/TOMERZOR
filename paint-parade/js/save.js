// Player profile: progress, wallet, lives, settings. Stored on the device and
// migrated by version so updates never wipe anyone's progress.
const KEY = 'paintparade.save';
const VERSION = 1;
export const LIFE_MAX = 5;
export const LIFE_MS = 20 * 60 * 1000;

function fresh() {
  return {
    v: VERSION,
    level: 1,
    coins: 100,
    lives: LIFE_MAX,
    lifeTs: 0,            // when the next life started regenerating
    unlimitedUntil: 0,    // unlimited lives (starter pack)
    boosters: { slot: 0, grab: 0, rainbow: 0 },
    gallery: {},          // artId -> first completion timestamp
    albumsClaimed: {},
    streak: 0,            // wins in a row
    bestStreak: 0,
    daily: { last: '', days: 0, done: {} },
    settings: { sound: true, music: true, haptics: true, lang: '' },
    noAds: false,
    purchases: {},
    starterSeenAt: 0,
    starterBought: false,
    seen: {},             // tutorial tips already shown
    ads: { lastInterstitial: 0, freeCoinsDay: '', freeCoinsCount: 0 },
    stats: { wins: 0, fails: 0, played: 0, revives: 0, firstOpen: Date.now(), sessions: 0, splats: 0 },
  };
}

function merge(base, data) {
  for (const k of Object.keys(data || {})) {
    if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) && base[k] && typeof base[k] === 'object') merge(base[k], data[k]);
    else base[k] = data[k];
  }
  return base;
}

let state = fresh();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = merge(fresh(), JSON.parse(raw));
  } catch (e) { state = fresh(); }
  state.v = VERSION;
  tickLives();
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep playing */ }
}

export function get() { return state; }

export function reset() { state = fresh(); save(); return state; }

// ---- lives ----
export function hasUnlimited(now = Date.now()) { return state.unlimitedUntil > now; }

export function tickLives(now = Date.now()) {
  if (state.lives >= LIFE_MAX) { state.lifeTs = 0; return; }
  if (!state.lifeTs) state.lifeTs = now;
  const gained = Math.floor((now - state.lifeTs) / LIFE_MS);
  if (gained > 0) {
    state.lives = Math.min(LIFE_MAX, state.lives + gained);
    state.lifeTs = state.lives >= LIFE_MAX ? 0 : state.lifeTs + gained * LIFE_MS;
  }
}

export function nextLifeIn(now = Date.now()) {
  if (state.lives >= LIFE_MAX || !state.lifeTs) return 0;
  return Math.max(0, state.lifeTs + LIFE_MS - now);
}

export function loseLife(now = Date.now()) {
  if (hasUnlimited(now)) return;
  tickLives(now);
  if (state.lives >= LIFE_MAX) state.lifeTs = now;
  state.lives = Math.max(0, state.lives - 1);
}

export function addLives(k) { state.lives = Math.min(LIFE_MAX, state.lives + k); if (state.lives >= LIFE_MAX) state.lifeTs = 0; }

// ---- wallet ----
export function addCoins(k) { state.coins = Math.max(0, state.coins + k); }
export function spend(k) { if (state.coins < k) return false; state.coins -= k; return true; }

export function today(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
