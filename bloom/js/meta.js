// Everything that lasts between games: best score, level and XP, gems, the daily streak, daily
// missions, the lucky chest, skins and the garden. Kept in localStorage; if storage is blocked the
// game still plays, it just forgets.
const KEY = 'bloom.v2'; // v1 was the line-clearing prototype

export const SKINS = [
  { id: 'jelly', name: 'Clay', cost: 0, style: 'clay', colors: ['#ff5a6e', '#ff9f43', '#ffd23f', '#3ddc84', '#4cc9ff', '#a78bfa', '#f472b6'] },
  { id: 'candy', name: 'Glass', cost: 120, style: 'glass', colors: ['#ff6b8b', '#ffa94d', '#ffe066', '#51e5a8', '#5cd2ff', '#b197fc', '#f783ac'] },
  { id: 'pastel', name: 'Pastel', cost: 200, style: 'flat', colors: ['#f9a8b8', '#fdc49a', '#fbe7a1', '#a7e8bd', '#a5d8f5', '#c9b8f8', '#f5b5d8'] },
  { id: 'gem', name: 'Gems', cost: 350, style: 'gem', colors: ['#e11d48', '#ea580c', '#eab308', '#059669', '#0284c7', '#7c3aed', '#db2777'] },
  { id: 'neon', name: 'Neon', cost: 500, style: 'neon', colors: ['#ff2e6e', '#ff9f1c', '#f9f871', '#2bff88', '#22d3ff', '#a78bfa', '#ff4fff'], dark: true },
];

const defaults = () => ({
  best: 0, games: 0, xp: 300, level: 1, gems: 0, totalBlooms: 0,
  recent: [], // last 10 final scores
  streak: { count: 0, day: null, freezes: 1 },
  missions: null, // { day, list: [{ type, goal, progress, reward, done, claimed }], bonus }
  chest: { n: 8 }, // blooms towards the next chest; starts part-filled: a started bar gets finished
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
  blooms: { text: (g) => `Bloom ${g} groups`, goals: [12, 20, 30], reward: 15 },
  chain: { text: (g) => `Make a x${g} chain`, goals: [2, 3, 3], reward: 20 },
  score: { text: (g) => `Score ${g.toLocaleString('en-US')} in one game`, goals: [2500, 5000, 8000], reward: 20 },
  games: { text: (g) => `Play ${g} games`, goals: [3, 4, 5], reward: 10 },
  big: { text: (g) => `Bloom ${g} seeds at once`, goals: [6, 6, 8], reward: 15 },
  weeds: { text: (g) => `Pull ${g} weeds`, goals: [10, 20, 30], reward: 15 },
  specials: { text: (g) => `Grow ${g} special flower${g > 1 ? 's' : ''}`, goals: [1, 2, 3], reward: 20 },
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
    const acc = (key) => Math.min(m.goal, (m.acc || 0) + (ev[key] || 0));
    switch (m.type) {
      case 'blooms': m.progress = acc('blooms'); break;
      case 'weeds': m.progress = acc('weeds'); break;
      case 'specials': m.progress = acc('specials'); break;
      case 'games': m.progress = Math.min(m.goal, (m.acc || 0) + (ev.finished ? 1 : 0)); break;
      case 'chain': m.progress = Math.max(m.progress, Math.min(m.goal, ev.maxChain || 0)); break;
      case 'score': m.progress = Math.max(m.progress, Math.min(m.goal, ev.score || 0)); break;
      case 'big': m.progress = Math.max(m.progress, Math.min(m.goal, ev.maxGroup || 0)); break;
    }
    if (ev.finished && ['blooms', 'weeds', 'specials', 'games'].includes(m.type)) m.acc = m.progress;
    if (m.progress >= m.goal) { m.done = true; state.gems += m.reward; done.push(m); }
  }
  if (!ms.bonus && ms.list.every((m) => m.done)) { ms.bonus = true; state.gems += 40; done.push({ bonus: true, reward: 40 }); }
  save();
  return done;
}

// ---- lucky chest -----------------------------------------------------------------------------
// Fills with blooms. What's inside varies, so opening it never gets routine.
export const CHEST_GOAL = 30;
export function addChestBlooms(n) {
  state.chest.n += n;
  const opened = [];
  while (state.chest.n >= CHEST_GOAL) {
    state.chest.n -= CHEST_GOAL;
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
