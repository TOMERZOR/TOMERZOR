/**
 * ECHO — the rules.
 *
 * Two layers live here, both pure and deterministic:
 *
 *   1. The loop simulation (`createRun` / `stepRun` / `simulate`): a 10-second
 *      loop at 30 ticks per second, in which the live hero and every recorded
 *      echo move through the same room at once. The client steps it to draw
 *      the game; the room steps it again to verify a submitted clear, so the
 *      same code is the authority on both sides.
 *
 *   2. The meta game (`setup` / `validateAction` / `applyAction` / `viewFor`):
 *      one profile per player (coins, gems, stars, streak, skins, pass XP) and
 *      the shared daily board. A clear is accepted only when replaying its
 *      input logs reaches the exit.
 *
 * No imports, no clocks, no randomness: the only time this file knows about is
 * the `day` number the client sends, and the only randomness is the seeded
 * generator used for the daily room.
 */

export const meta = { game: "ECHO", minPlayers: 1, maxPlayers: 500 };

// ── constants ──────────────────────────────────────────────────────────────

export const TPS = 30;
export const LOOP_TICKS = 300;         // 10 seconds
export const MAX_ECHOES = 6;           // loops per level, hero included: 7
export const COLS = 7;
export const ROWS = 11;
export const SPEED = 4.6 / TPS;        // cells per tick
export const HERO_HALF = 0.3;          // collision half-size (smaller than the sprite)
export const DRONE_SPEED = 2.4 / TPS;
export const DRONE_RADIUS = 0.62;

/** 0 = still, 1 = up, then clockwise. Diagonals are normalised. */
export const DIRS = [
  [0, 0], [0, -1], [0.7071, -0.7071], [1, 0], [0.7071, 0.7071],
  [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071],
];
const MIRROR_DIR = [0, 1, 8, 7, 6, 5, 4, 3, 2];

// ── levels ─────────────────────────────────────────────────────────────────
//
//   #  wall        .  floor        S  start        E  exit
//   a b c  pressure plates         A B C  doors that stay open while a matching
//                                         plate is held down
//   o  coin
//
// Drones patrol back and forth: from (x,y) along (dx,dy) for n cells.

export const WORLDS = [
  { id: 1, key: "lab", bg: "bg_lab" },
  { id: 2, key: "observatory", bg: "bg_obs" },
  { id: 3, key: "mirror", bg: "bg_lab", mirror: true },
];

export const LEVELS = [
  // ── World 1: the lab. Teaches plates, doors and holding a door with an echo.
  // `par` is the number of echoes a clean solution needs; at or under it is
  // three stars. Every map here has a recorded solution in solutions.js that
  // the checks replay through the simulator, so a room never ships unsolvable.
  {
    id: "1-1", world: 1, par: 0,
    map: [
      "#######",
      "#S....#",
      "#.....#",
      "#.....#",
      "#.....#",
      "#..o..#",
      "#.....#",
      "#.....#",
      "#.....#",
      "#....E#",
      "#######",
    ],
  },
  {
    id: "1-2", world: 1, par: 1,
    map: [
      "#######",
      "#S....#",
      "#..a..#",
      "#.....#",
      "#.....#",
      "###A###",
      "#.....#",
      "#.o...#",
      "#.....#",
      "#..E..#",
      "#######",
    ],
  },
  {
    // Two plates in sequence: the exit chamber only opens from above.
    id: "1-3", world: 1, par: 2,
    map: [
      "#######",
      "#S....#",
      "#..a.o#",
      "#.....#",
      "###A###",
      "#.....#",
      "#.....#",
      "#o.####",
      "#..B..#",
      "#b.#E.#",
      "#######",
    ],
  },
  {
    // The second plate sits right behind the first door: one echo per gate.
    id: "1-4", world: 1, par: 2,
    map: [
      "#######",
      "#S.#..#",
      "#..A.o#",
      "#a.#b.#",
      "####B##",
      "#.....#",
      "#.....#",
      "#.o...#",
      "#.....#",
      "#...E.#",
      "#######",
    ],
  },
  // ── World 2: the observatory. Drones patrol; only the live hero can die.
  {
    id: "2-1", world: 2, par: 0,
    map: [
      "#######",
      "#S....#",
      "#.....#",
      "#.....#",
      "#.....#",
      "#..o..#",
      "#.....#",
      "#.....#",
      "#.....#",
      "#....E#",
      "#######",
    ],
    drones: [{ x: 1, y: 5, dx: 1, dy: 0, n: 4, phase: 0 }],
  },
  {
    id: "2-2", world: 2, par: 1,
    map: [
      "#######",
      "#S....#",
      "#..a..#",
      "#.....#",
      "#.....#",
      "###A###",
      "#.....#",
      "#.o...#",
      "#.....#",
      "#..E..#",
      "#######",
    ],
    drones: [{ x: 1, y: 7, dx: 1, dy: 0, n: 4, phase: 2 }],
  },
  {
    id: "2-3", world: 2, par: 2,
    map: [
      "#######",
      "#S....#",
      "#.a..o#",
      "#.....#",
      "##A####",
      "#.....#",
      "#...b.#",
      "#.....#",
      "#o..###",
      "#...BE#",
      "#######",
    ],
    drones: [
      { x: 1, y: 5, dx: 1, dy: 0, n: 4, phase: 0 },
      { x: 1, y: 8, dx: 1, dy: 0, n: 2, phase: 3 },
    ],
  },
  {
    // World 2's exam: three gates, two drones, the last plate under a patrol.
    id: "2-4", world: 2, par: 3,
    map: [
      "#######",
      "#Sa...#",
      "#.....#",
      "##A####",
      "#...b.#",
      "#o....#",
      "##B####",
      "#...cC#",
      "#.o.#.#",
      "#...#E#",
      "#######",
    ],
    drones: [
      { x: 1, y: 4, dx: 1, dy: 0, n: 4, phase: 1 },
      { x: 1, y: 7, dx: 1, dy: 0, n: 4, phase: 5 },
    ],
  },
  // ── World 3: the mirror lab. Echoes move mirrored left/right.
  {
    // Teach the mirror: run right to the coin and your echo lands on the plate.
    id: "3-1", world: 3, par: 1, mirror: true,
    map: [
      "#######",
      "#..S..#",
      "#.....#",
      "#.....#",
      "#a...o#",
      "#.....#",
      "#.....#",
      "#.....#",
      "###A###",
      "###E###",
      "#######",
    ],
  },
  {
    id: "3-2", world: 3, par: 1, mirror: true,
    map: [
      "#######",
      "#..S..#",
      "#.....#",
      "#..#..#",
      "#o.#.a#",
      "#..#..#",
      "#.....#",
      "#.....#",
      "###A###",
      "###E###",
      "#######",
    ],
  },
  {
    id: "3-3", world: 3, par: 1, mirror: true,
    map: [
      "#######",
      "#..S..#",
      "#a...b#",
      "#A###B#",
      "#.....#",
      "#.....#",
      "#..o..#",
      "#.....#",
      "#.....#",
      "#..E..#",
      "#######",
    ],
    drones: [{ x: 1, y: 5, dx: 1, dy: 0, n: 4, phase: 0 }],
  },
  {
    // World 3's exam: every plate is reached by its mirror image.
    id: "3-4", world: 3, par: 3, mirror: true,
    map: [
      "#######",
      "#a.S.b#",
      "#.....#",
      "#A###B#",
      "#.#.#.#",
      "#.#.#.#",
      "#.C.#.#",
      "#.#.#.#",
      "#.#.#.#",
      "#c#E#o#",
      "#######",
    ],
    drones: [{ x: 1, y: 2, dx: 1, dy: 0, n: 4, phase: 4 }],
  },
];

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

// ── seeded randomness (daily room, editor shuffles) ────────────────────────

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** The same room for everyone on a given day: a base level, mirrored on odd
 *  days, with drones shifted so the timing feels new. */
export function dailyLevel(day) {
  const r = rng(day * 2654435761 + 7);
  const pool = LEVELS.filter((l) => l.world !== 3);
  const base = pool[Math.floor(r() * pool.length)];
  const flip = day % 2 === 1;
  const map = base.map.map((row) => (flip ? row.split("").reverse().join("") : row));
  const drones = (base.drones || []).map((d) => ({
    ...d,
    x: flip ? COLS - 1 - d.x - (d.dx > 0 ? d.n : 0) : d.x,
    phase: (d.phase + Math.floor(r() * 6)) % 8,
  }));
  if (!drones.length) {
    drones.push({ x: 5, y: 1, dx: 0, dy: 1, n: 4, phase: Math.floor(r() * 6) });
  }
  return { id: "daily", world: base.world, par: base.par, map, drones, mirror: false, day };
}

// ── level encoding (editor share codes) ────────────────────────────────────

export function encodeLevel(level) {
  const d = (level.drones || []).map((x) => [x.x, x.y, x.dx, x.dy, x.n, x.phase].join(",")).join(";");
  return `${level.mirror ? "M" : "N"}${level.par || 3}|${level.map.join("/")}|${d}`;
}

export function decodeLevel(code) {
  if (typeof code !== "string" || code.length > 400) return null;
  const parts = code.split("|");
  if (parts.length < 2) return null;
  const head = parts[0];
  const map = parts[1].split("/");
  if (map.length !== ROWS || map.some((r) => r.length !== COLS || /[^#.SEabcABCo]/.test(r))) return null;
  const starts = map.join("").split("S").length - 1;
  const exits = map.join("").split("E").length - 1;
  if (starts !== 1 || exits !== 1) return null;
  const drones = [];
  if (parts[2]) {
    for (const seg of parts[2].split(";")) {
      const v = seg.split(",").map(Number);
      if (v.length !== 6 || v.some((n) => !Number.isInteger(n))) return null;
      const [x, y, dx, dy, n, phase] = v;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS || n < 1 || n > 10) return null;
      if (!((Math.abs(dx) === 1 && dy === 0) || (Math.abs(dy) === 1 && dx === 0))) return null;
      drones.push({ x, y, dx, dy, n, phase: ((phase % 8) + 8) % 8 });
    }
    if (drones.length > 4) return null;
  }
  const par = Math.min(6, Math.max(1, parseInt(head.slice(1), 10) || 3));
  return { id: "custom", world: 1, par, map, drones, mirror: head[0] === "M" };
}

// ── simulation ─────────────────────────────────────────────────────────────

function findChar(map, ch) {
  for (let y = 0; y < map.length; y++) {
    const x = map[y].indexOf(ch);
    if (x >= 0) return { x: x + 0.5, y: y + 0.5 };
  }
  return { x: 1.5, y: 1.5 };
}

/**
 * Build a run: every log in `logs` becomes an actor; the LAST one is the live
 * hero. A log is a string of digits 0-8, one per tick; a missing tick is 0.
 */
export function createRun(level, logs) {
  const start = findChar(level.map, "S");
  const actors = logs.map((log, i) => ({
    x: start.x, y: start.y, dir: 0, alive: true, done: false,
    hero: i === logs.length - 1, log: log || "", trail: [],
  }));
  const coins = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) if (level.map[y][x] === "o") coins.push({ x: x + 0.5, y: y + 0.5, taken: false });
  }
  return {
    level, tick: 0, actors, coins, taken: 0,
    doors: { A: false, B: false, C: false },
    plates: { a: false, b: false, c: false },
    drones: (level.drones || []).map((d) => ({ ...d, px: d.x + 0.5, py: d.y + 0.5 })),
    exit: findChar(level.map, "E"),
    events: [], finished: false, exitTick: -1, dead: false, deadTick: -1,
  };
}

function blockedAt(run, x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
  const ch = run.level.map[cy][cx];
  if (ch === "#") return true;
  if (ch === "A" || ch === "B" || ch === "C") return !run.doors[ch];
  return false;
}

function boxFree(run, x, y) {
  const h = HERO_HALF;
  return !blockedAt(run, x - h, y - h) && !blockedAt(run, x + h, y - h)
    && !blockedAt(run, x - h, y + h) && !blockedAt(run, x + h, y + h);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Axis-separated movement with corner assist: when a step is blocked only
 * because the hero is slightly off the corridor's centre line, it is nudged
 * toward the centre instead of stopping dead. Thumbs on glass are not precise,
 * and a one-cell doorway should not need pixel aim.
 */
function moveActor(run, a, dirIdx) {
  a.dir = dirIdx;
  if (!dirIdx) return;
  const [dx, dy] = DIRS[dirIdx];
  if (dx) {
    const nx = a.x + dx * SPEED;
    if (boxFree(run, nx, a.y)) a.x = nx;
    else if (!dy) {
      const cy = Math.floor(a.y) + 0.5;
      if (boxFree(run, nx, cy)) {
        a.y += clamp(cy - a.y, -SPEED, SPEED);
        if (boxFree(run, nx, a.y)) a.x = nx;
      }
    }
  }
  if (dy) {
    const ny = a.y + dy * SPEED;
    if (boxFree(run, a.x, ny)) a.y = ny;
    else if (!dx) {
      const cx = Math.floor(a.x) + 0.5;
      if (boxFree(run, cx, ny)) {
        a.x += clamp(cx - a.x, -SPEED, SPEED);
        if (boxFree(run, a.x, ny)) a.y = ny;
      }
    }
  }
}

function dronePos(d, tick) {
  const t = tick * DRONE_SPEED + d.phase;
  const p = t % (2 * d.n);
  const k = p <= d.n ? p : 2 * d.n - p;
  return { px: d.x + 0.5 + d.dx * k, py: d.y + 0.5 + d.dy * k };
}

/**
 * Advance one tick. `heroDir` is the live input (0-8); echoes read their logs.
 * Events for this tick are left in `run.events` (replaced every tick) so the
 * client can play sounds and particles.
 */
export function stepRun(run, heroDir) {
  const ev = [];
  run.events = ev;
  if (run.finished || run.dead || run.tick >= LOOP_TICKS) return run;
  const mirror = !!run.level.mirror;
  const last = run.actors.length - 1;

  for (let i = 0; i < run.actors.length; i++) {
    const a = run.actors[i];
    if (!a.alive || a.done) continue;
    let d = 0;
    if (i === last) d = heroDir | 0;
    else {
      const c = a.log.charCodeAt(run.tick) - 48;
      d = c >= 0 && c <= 8 ? c : 0;
      if (mirror) d = MIRROR_DIR[d];
    }
    moveActor(run, a, d);
    if (run.tick % 3 === 0) {
      a.trail.push(a.x, a.y);
      if (a.trail.length > 24) a.trail.splice(0, 2);
    }
  }

  // Plates and doors, from where everyone is standing now.
  const pressed = { a: false, b: false, c: false };
  for (const a of run.actors) {
    if (!a.alive || a.done) continue;
    const ch = run.level.map[Math.floor(a.y)][Math.floor(a.x)];
    if (pressed[ch] === false) pressed[ch] = true;
  }
  for (const k of ["a", "b", "c"]) {
    if (pressed[k] && !run.plates[k]) ev.push({ t: "plate", k });
    const door = k.toUpperCase();
    if (pressed[k] !== run.doors[door]) ev.push({ t: pressed[k] ? "open" : "close", k: door });
    run.doors[door] = pressed[k];
  }
  run.plates = pressed;

  // Coins: anyone can take one.
  for (const c of run.coins) {
    if (c.taken) continue;
    for (const a of run.actors) {
      if (!a.alive || a.done) continue;
      const dx = a.x - c.x, dy = a.y - c.y;
      if (dx * dx + dy * dy < 0.45 * 0.45) {
        c.taken = true; run.taken++;
        ev.push({ t: "coin", x: c.x, y: c.y, hero: a.hero });
        break;
      }
    }
  }

  // Drones: only the live hero can be caught.
  for (const d of run.drones) {
    const p = dronePos(d, run.tick);
    d.px = p.px; d.py = p.py;
    const h = run.actors[last];
    if (h.alive && !h.done) {
      const dx = h.x - d.px, dy = h.y - d.py;
      if (dx * dx + dy * dy < DRONE_RADIUS * DRONE_RADIUS) {
        h.alive = false; run.dead = true; run.deadTick = run.tick;
        ev.push({ t: "dead", x: h.x, y: h.y });
      }
    }
  }

  // Exit: the live hero finishes the level.
  const h = run.actors[last];
  if (h.alive && !h.done) {
    const dx = h.x - run.exit.x, dy = h.y - run.exit.y;
    if (dx * dx + dy * dy < 0.42 * 0.42) {
      h.done = true; run.finished = true; run.exitTick = run.tick;
      ev.push({ t: "exit", x: h.x, y: h.y });
    }
  }

  run.tick++;
  return run;
}

/** Replay a full set of logs and report whether the last one reaches the exit. */
export function simulate(level, logs) {
  const run = createRun(level, logs);
  const hero = logs[logs.length - 1] || "";
  for (let t = 0; t < LOOP_TICKS && !run.finished && !run.dead; t++) {
    const c = hero.charCodeAt(t) - 48;
    stepRun(run, c >= 0 && c <= 8 ? c : 0);
  }
  return { ok: run.finished, exitTick: run.exitTick, coins: run.taken, dead: run.dead, echoes: logs.length - 1 };
}

/**
 * True when every loop could really have been recorded: the live hero of loop
 * i must survive until its own log ends, because a loop that dies is never
 * saved as an echo. `simulate` only runs the last loop live, so without this a
 * forged log could walk straight through a drone.
 */
export function verifyLogs(level, logs) {
  for (let i = 0; i < logs.length; i++) {
    const run = createRun(level, logs.slice(0, i + 1));
    const log = logs[i];
    for (let t = 0; t < Math.min(log.length, LOOP_TICKS) && !run.finished; t++) {
      const c = log.charCodeAt(t) - 48;
      stepRun(run, c >= 0 && c <= 8 ? c : 0);
      if (run.dead) return false;
    }
  }
  return true;
}

export function starsFor(level, echoes) {
  if (echoes <= level.par) return 3;
  if (echoes <= level.par + 1) return 2;
  return 1;
}

// ── economy ────────────────────────────────────────────────────────────────

export const SKINS = {
  cyan: { coins: 0, color: "#39e6ff" },
  magenta: { coins: 300, color: "#ff4fd8" },
  lime: { coins: 300, color: "#b6ff3c" },
  gold: { coins: 800, color: "#ffc93c" },
  white: { gems: 40, color: "#f4f7ff" },
  rainbow: { gems: 120, color: "rainbow" },
};

/** Store-front products. In this prototype a "purchase" is granted on trust;
 *  a shipping build verifies the App Store receipt before applying it. */
export const IAP = {
  starter: { price: "$1.99", gems: 120, coins: 500, skin: "gold", once: true },
  gems_small: { price: "$0.99", gems: 100 },
  gems_big: { price: "$4.99", gems: 600 },
  noads: { price: "$3.99", noads: true, once: true },
  pass: { price: "$4.99", pass: true, once: true },
};

export const PASS_TIERS = [
  { xp: 0, coins: 50 }, { xp: 60, coins: 100 }, { xp: 140, gems: 10 }, { xp: 240, coins: 200 },
  { xp: 360, skin: "lime" }, { xp: 500, gems: 20 }, { xp: 660, coins: 400 }, { xp: 840, gems: 30 },
  { xp: 1040, skin: "magenta" }, { xp: 1260, gems: 60, skin: "rainbow" },
];

export const AD_COINS = 30;
export const ADS_PER_DAY = 5;

export function newProfile(pid) {
  return {
    pid, name: "", coins: 0, gems: 0, stars: {}, best: {}, skin: "cyan", skins: ["cyan"],
    streak: 0, lastDay: 0, adsDay: 0, adsToday: 0, passXp: 0, pass: false, noads: false,
    claimedTiers: 0, owned: [], clears: 0,
  };
}

export function totalStars(profile) {
  let n = 0;
  for (const k in profile.stars) n += profile.stars[k];
  return n;
}

/** A world opens once the previous one has enough stars. */
export function worldUnlocked(profile, worldId) {
  if (worldId === 1) return true;
  return totalStars(profile) >= (worldId - 1) * 7;
}

// ── meta game contract ─────────────────────────────────────────────────────

export function setup(players) {
  return { players: {}, daily: { day: 0, board: [] }, seats: [...players] };
}

const isInt = (n) => Number.isInteger(n) && n >= 0;
const LOG_RE = /^[0-8]{0,300}$/;

function levelForAction(action) {
  if (action.level === "daily") return isInt(action.day) ? dailyLevel(action.day) : null;
  if (typeof action.level === "string" && action.level.startsWith("custom:")) {
    return decodeLevel(action.level.slice(7));
  }
  return levelById(action.level);
}

export function validateAction(state, playerId, action) {
  if (!action || typeof action !== "object") return { ok: false, error: "bad action" };
  const p = state.players[playerId] || newProfile(playerId);
  switch (action.t) {
    case "day":
      if (!isInt(action.day) || action.day < p.lastDay) return { ok: false, error: "bad day" };
      return { ok: true };
    case "complete": {
      const level = levelForAction(action);
      if (!level) return { ok: false, error: "unknown level" };
      if (!Array.isArray(action.logs) || action.logs.length < 1 || action.logs.length > MAX_ECHOES + 1) {
        return { ok: false, error: "bad logs" };
      }
      if (action.logs.some((l) => typeof l !== "string" || !LOG_RE.test(l))) return { ok: false, error: "bad log" };
      if (action.level === "daily" && (!isInt(action.day) || action.day < state.daily.day)) {
        return { ok: false, error: "stale day" };
      }
      const res = simulate(level, action.logs);
      if (!res.ok) return { ok: false, error: "the exit was not reached" };
      if (!verifyLogs(level, action.logs)) return { ok: false, error: "a loop could not have been played" };
      return { ok: true };
    }
    case "buy": {
      const s = SKINS[action.item];
      if (!s) return { ok: false, error: "unknown item" };
      if (p.skins.includes(action.item)) return { ok: false, error: "already owned" };
      if (s.coins !== undefined && p.coins < s.coins) return { ok: false, error: "not enough coins" };
      if (s.gems !== undefined && p.gems < s.gems) return { ok: false, error: "not enough gems" };
      return { ok: true };
    }
    case "equip":
      if (!p.skins.includes(action.skin)) return { ok: false, error: "skin not owned" };
      return { ok: true };
    case "iap": {
      const sku = IAP[action.sku];
      if (!sku) return { ok: false, error: "unknown product" };
      if (sku.once && p.owned.includes(action.sku)) return { ok: false, error: "already owned" };
      return { ok: true };
    }
    case "ad":
      if (!isInt(action.day)) return { ok: false, error: "bad day" };
      if (p.adsDay === action.day && p.adsToday >= ADS_PER_DAY) return { ok: false, error: "no more ads today" };
      return { ok: true };
    case "claim_pass": {
      const tier = PASS_TIERS[p.claimedTiers];
      if (!tier) return { ok: false, error: "all tiers claimed" };
      if (p.passXp < tier.xp) return { ok: false, error: "not enough xp" };
      if (!p.pass && p.claimedTiers >= 2) return { ok: false, error: "pass required" };
      return { ok: true };
    }
    case "name":
      if (typeof action.name !== "string" || action.name.length > 16) return { ok: false, error: "bad name" };
      return { ok: true };
    default:
      return { ok: false, error: "unknown action" };
  }
}

function grant(p, reward) {
  if (reward.coins) p.coins += reward.coins;
  if (reward.gems) p.gems += reward.gems;
  if (reward.skin && !p.skins.includes(reward.skin)) p.skins = [...p.skins, reward.skin];
  if (reward.noads) p.noads = true;
  if (reward.pass) p.pass = true;
}

export function applyAction(state, playerId, action) {
  const prev = state.players[playerId] || newProfile(playerId);
  const p = { ...prev, stars: { ...prev.stars }, best: { ...prev.best } };
  let daily = state.daily;

  switch (action.t) {
    case "day": {
      if (action.day > p.lastDay) {
        p.streak = action.day === p.lastDay + 1 ? p.streak + 1 : 1;
        p.lastDay = action.day;
        p.coins += Math.min(p.streak, 7) * 10;
        p.lastBonus = Math.min(p.streak, 7) * 10;
      }
      break;
    }
    case "complete": {
      const level = levelForAction(action);
      const res = simulate(level, action.logs);
      const stars = starsFor(level, res.echoes);
      const key = action.level === "daily" ? `daily-${action.day}` : action.level;
      const custom = key.startsWith("custom");
      const first = !custom && !p.best[key];
      // Editor rooms are a test bench: they pay nothing, or a one-cell room
      // would be an endless coin and XP farm.
      const reward = custom ? 0 : 20 + res.coins * 10 + (first ? 50 : 0) + (action.level === "daily" ? 40 : 0);
      p.coins += reward;
      p.lastReward = reward;
      if (!custom) {
        p.clears += 1;
        p.passXp += 10 * stars + res.coins * 2;
        p.stars[key] = Math.max(p.stars[key] || 0, stars);
        const b = p.best[key];
        if (!b || res.echoes < b.echoes || (res.echoes === b.echoes && res.exitTick < b.ticks)) {
          p.best[key] = { echoes: res.echoes, ticks: res.exitTick, coins: res.coins };
        }
      }
      if (action.level === "daily") {
        const board = action.day > daily.day ? [] : [...daily.board];
        const entry = { pid: playerId, name: p.name || "", echoes: res.echoes, ticks: res.exitTick, coins: res.coins };
        const i = board.findIndex((e) => e.pid === playerId);
        if (i < 0) board.push(entry);
        else if (entry.echoes < board[i].echoes || (entry.echoes === board[i].echoes && entry.ticks < board[i].ticks)) board[i] = entry;
        board.sort((x, y) => x.echoes - y.echoes || x.ticks - y.ticks);
        daily = { day: Math.max(daily.day, action.day), board: board.slice(0, 50) };
      }
      break;
    }
    case "buy": {
      const s = SKINS[action.item];
      if (s.coins) p.coins -= s.coins;
      if (s.gems) p.gems -= s.gems;
      p.skins = [...p.skins, action.item];
      p.skin = action.item;
      break;
    }
    case "equip":
      p.skin = action.skin;
      break;
    case "iap": {
      const sku = IAP[action.sku];
      grant(p, sku);
      if (sku.once) p.owned = [...p.owned, action.sku];
      if (sku.skin) p.skin = sku.skin;
      break;
    }
    case "ad":
      if (p.adsDay !== action.day) { p.adsDay = action.day; p.adsToday = 0; }
      p.adsToday += 1;
      p.coins += AD_COINS;
      break;
    case "claim_pass":
      grant(p, PASS_TIERS[p.claimedTiers]);
      p.claimedTiers += 1;
      break;
    case "name":
      p.name = action.name;
      break;
  }
  return { ...state, players: { ...state.players, [playerId]: p }, daily };
}

/** The room never ends: it is a save file with a scoreboard attached. */
export function isGameOver() {
  return { over: false };
}

export function viewFor(state, playerId) {
  return {
    profile: state.players[playerId] || newProfile(playerId),
    daily: state.daily,
  };
}
