// Everything that lasts between games: best score, level and XP, gems, the daily streak, daily
// missions, the lucky chest, skins and the garden. Kept in localStorage; if storage is blocked the
// game still plays, it just forgets.
const KEY = 'bloom.v1';

export const SKINS = [
  { id: 'jelly', name: 'ג׳לי', cost: 0, style: 'jelly', colors: ['#ff5d73', '#ffa83a', '#ffd93d', '#5bd66f', '#3bc4ff', '#7a6cff', '#e66bff'] },
  { id: 'candy', name: 'ממתקים', cost: 120, style: 'candy', colors: ['#ff4f9a', '#ff8a3d', '#ffe14a', '#3fe0a0', '#47b8ff', '#a774ff', '#ff6fd8'] },
  { id: 'pastel', name: 'פסטל', cost: 200, style: 'flat', colors: ['#f7a6b5', '#f9c99b', '#f6e6a0', '#b5e3b0', '#a9d6f2', '#c3b6f2', '#e8b5e8'] },
  { id: 'gem', name: 'אבני חן', cost: 350, style: 'gem', colors: ['#e0115f', '#ff7b00', '#ffc400', '#00b36b', '#0091e6', '#5b3cc4', '#c21bb5'] },
  { id: 'neon', name: 'ניאון', cost: 500, style: 'neon', colors: ['#ff2e6e', '#ff9f1c', '#f9f871', '#2bff88', '#22d3ff', '#8f5bff', '#ff4fff'], dark: true },
];

const defaults = () => ({
  best: 0, games: 0, xp: 300, level: 1, gems: 0, totalLines: 0,
  recent: [], // last 10 final scores
  streak: { count: 0, day: null, freezes: 1 },
  missions: null, // { day, list: [{ type, goal, progress, reward, done, claimed }], bonus }
  chest: { lines: 10 }, // the bar starts part-filled: a started bar gets finished
  skins: ['jelly'], skin: 'jelly',
  garden: [flowerSeed(1)], // one flower per level-up; the first one is a gift
  sound: true, haptics: true,
  saved: null, // the game in progress
});

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw ? { ...defaults(), ...raw } : defaults();
  } catch { return defaults(); }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
}

export const meta = () => state;

export function resetAll() { state = defaults(); save(); }

// ---- days ------------------------------------------------------------------------------------
export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dayNum = (s) => Math.round(new Date(`${s}T12:00:00`).getTime() / 86400000);

// ---- levels ----------------------------------------------------------------------------------
export const xpForLevel = (level) => Math.round(1200 * Math.pow(level, 1.25));

// Adds XP; returns the levels gained (each with its reward).
export function addXp(amount) {
  state.xp += amount;
  const ups = [];
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level++;
    const gems = 20 + state.level * 2;
    state.gems += gems;
    state.garden.push(flowerSeed(state.level));
    ups.push({ level: state.level, gems });
  }
  return ups;
}

function flowerSeed(level) {
  const h = (level * 2654435761) >>> 0;
  return { hue: h % 360, petals: 5 + (h >> 8) % 4, height: 0.55 + ((h >> 12) % 40) / 100, kind: (h >> 16) % 3 };
}

// ---- daily streak ----------------------------------------------------------------------------
// Opening the game on a new day gives a bonus that grows with the streak. Missing one day uses a
// freeze (you get one back every 7 days), so one busy day doesn't wipe weeks of streak.
export function checkStreak() {
  const t = today();
  const s = state.streak;
  if (s.day === t) return null;
  const gap = s.day ? dayNum(t) - dayNum(s.day) : 1;
  let usedFreeze = false;
  if (gap === 1) s.count++;
  else if (gap === 2 && s.freezes > 0) { s.freezes--; s.count++; usedFreeze = true; }
  else s.count = 1;
  s.day = t;
  if (s.count % 7 === 0 && s.freezes < 2) s.freezes++;
  const gems = Math.min(50, 5 * s.count);
  state.gems += gems;
  save();
  return { count: s.count, gems, usedFreeze };
}

// ---- daily missions --------------------------------------------------------------------------
const MISSION_TYPES = {
  lines: { text: (g) => `נקו ${g} שורות`, goals: [15, 25, 40], reward: 15 },
  combo: { text: (g) => `הגיעו לקומבו x${g}`, goals: [3, 4, 5], reward: 15 },
  score: { text: (g) => `${g.toLocaleString('he-IL')} נקודות במשחק אחד`, goals: [2000, 4000, 7000], reward: 20 },
  games: { text: (g) => `שחקו ${g} משחקים`, goals: [3, 4, 5], reward: 10 },
  multi: { text: (g) => `נקו ${g} שורות במהלך אחד`, goals: [2, 2, 3], reward: 15 },
  place: { text: (g) => `הניחו ${g} חלקים`, goals: [60, 100, 150], reward: 10 },
};

function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
}

export function missions() {
  const t = today();
  if (state.missions?.day === t) return state.missions;
  const rng = seeded(t);
  const types = Object.keys(MISSION_TYPES);
  const pick = [];
  while (pick.length < 3) { const k = types[Math.floor(rng() * types.length)]; if (!pick.includes(k)) pick.push(k); }
  const tier = Math.min(2, Math.floor((state.level - 1) / 4));
  state.missions = {
    day: t, bonus: false,
    list: pick.map((type) => ({ type, goal: MISSION_TYPES[type].goals[tier], progress: 0, reward: MISSION_TYPES[type].reward + tier * 5, done: false })),
  };
  save();
  return state.missions;
}

export const missionText = (m) => MISSION_TYPES[m.type].text(m.goal);

// Called during and after a game. `ev` holds running totals for the current game.
// Returns missions newly completed (rewards already added).
export function progressMissions(ev) {
  const ms = missions();
  const done = [];
  for (const m of ms.list) {
    if (m.done) continue;
    switch (m.type) {
      case 'lines': m.progress = Math.min(m.goal, (m.acc || 0) + (ev.lines || 0)); break;
      case 'place': m.progress = Math.min(m.goal, (m.acc || 0) + (ev.placements || 0)); break;
      case 'games': m.progress = Math.min(m.goal, (m.acc || 0) + (ev.finished ? 1 : 0)); break;
      case 'combo': m.progress = Math.max(m.progress, Math.min(m.goal, ev.maxCombo || 0)); break;
      case 'score': m.progress = Math.max(m.progress, Math.min(m.goal, ev.score || 0)); break;
      case 'multi': m.progress = Math.max(m.progress, Math.min(m.goal, ev.maxLines || 0)); break;
    }
    if (ev.finished && ['lines', 'place', 'games'].includes(m.type)) m.acc = m.progress;
    if (m.progress >= m.goal) { m.done = true; state.gems += m.reward; done.push(m); }
  }
  if (!ms.bonus && ms.list.every((m) => m.done)) { ms.bonus = true; state.gems += 40; done.push({ bonus: true, reward: 40 }); }
  save();
  return done;
}

// ---- lucky chest -----------------------------------------------------------------------------
// Fills with cleared lines. What's inside varies, so opening it never gets routine.
export const CHEST_LINES = 40;
export function addChestLines(n) {
  state.chest.lines += n;
  const opened = [];
  while (state.chest.lines >= CHEST_LINES) {
    state.chest.lines -= CHEST_LINES;
    const x = Math.random();
    const gems = x < 0.55 ? 15 + Math.floor(Math.random() * 10) : x < 0.88 ? 30 + Math.floor(Math.random() * 20) : 80 + Math.floor(Math.random() * 40);
    state.gems += gems;
    opened.push({ gems, jackpot: gems >= 80 });
  }
  return opened;
}

// ---- skins -----------------------------------------------------------------------------------
export const currentSkin = () => SKINS.find((s) => s.id === state.skin) || SKINS[0];
export function buySkin(id) {
  const s = SKINS.find((k) => k.id === id);
  if (!s || state.skins.includes(id) || state.gems < s.cost) return false;
  state.gems -= s.cost;
  state.skins.push(id);
  state.skin = id;
  save();
  return true;
}
export function selectSkin(id) { if (state.skins.includes(id)) { state.skin = id; save(); } }

// ---- finishing a game ------------------------------------------------------------------------
export function finishGame(score) {
  const prevBest = state.best;
  state.games++;
  state.recent = [...state.recent, score].slice(-10);
  const record = score > prevBest;
  if (record) state.best = score;
  save();
  return { prevBest, record };
}
