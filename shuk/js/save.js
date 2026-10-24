// Persistent progress in localStorage. Every access is guarded: private mode or
// blocked storage must never break the game, it just won't remember anything.
import { STORE_KEY, MISSIONS, POWERUPS } from './config.js';

const defaults = () => ({
  v: 1,
  coins: 0,
  best: 0,
  owned: ['tzabar'],
  selected: 'tzabar',
  upgrades: Object.fromEntries(Object.keys(POWERUPS).map(k => [k, 0])),
  level: 1, // mission level; score multiplier = level
  missions: null,
  settings: { music: true, sfx: true, haptics: true, quality: 'auto' },
  stats: { runs: 0, coins: 0, dist: 0 },
  tutorialDone: false,
});

let state = defaults();

export function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const d = defaults();
      state = { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, stats: { ...d.stats, ...(s.stats || {}) },
        upgrades: { ...d.upgrades, ...(s.upgrades || {}) } };
      if (!Array.isArray(state.owned) || !state.owned.includes('tzabar')) state.owned = ['tzabar', ...(state.owned || [])];
      if (!state.owned.includes(state.selected)) state.selected = 'tzabar';
      state.coins = Math.max(0, Math.floor(+state.coins || 0));
      state.best = Math.max(0, Math.floor(+state.best || 0));
      state.level = Math.max(1, Math.floor(+state.level || 1));
    }
  } catch (e) { state = defaults(); }
  const valid = m => m && Number.isInteger(m.i) && MISSIONS[m.i] && Number.isFinite(m.target) && m.target > 0 && Number.isFinite(m.progress);
  if (!Array.isArray(state.missions) || state.missions.length !== 3 || !state.missions.every(valid)) newMissionSet();
  return state;
}

export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

export function get() { return state; }

export function reset() { state = defaults(); newMissionSet(); save(); }

// Three missions per level, different stats, targets scale with level.
export function newMissionSet() {
  const lvl = state.level;
  const pool = MISSIONS.map((m, i) => i);
  const picks = [];
  // deterministic-ish shuffle seeded by level so a set feels stable
  let seed = lvl * 9301 + 49297;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  while (picks.length < 3 && pool.length) {
    const j = Math.floor(rnd() * pool.length);
    picks.push(pool.splice(j, 1)[0]);
  }
  state.missions = picks.map(i => {
    const m = MISSIONS[i];
    let target = Math.round(m.base * Math.pow(m.grow, lvl - 1));
    if (m.cap) target = Math.min(m.cap, Math.max(m.base, Math.round(m.base + (lvl - 1) / 3)));
    if (m.max) target = Math.min(m.max, target);
    if (target > 50) target = Math.round(target / 10) * 10;
    return { i, target, progress: 0, done: false };
  });
}
