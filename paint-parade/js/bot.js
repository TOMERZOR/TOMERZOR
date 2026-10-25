// Bots that play Paint Parade through the real engine. Used to verify that every
// level is solvable, to measure difficulty, and in-game for the tutorial hint.
import { createGame, step, launchLane, launchSlot, laneBlock, beltLoad, freeSlots, exposedColors, exposure, WILD } from './engine.js';

export function cloneState(st) {
  const c = {
    ...st,
    cells: st.cells, // never mutated
    coats: st.coats.slice(),
    lanes: st.lanes.map((l) => l.map((s) => ({ ...s }))),
    slots: st.slots.map((s) => (s ? { ...s } : null)),
    belt: st.belt.map((s) => ({ ...s })),
    pending: st.pending.map((s) => ({ ...s })),
    stats: { ...st.stats },
    events: [],
    stuck: st.stuck ? { ...st.stuck } : null,
  };
  return c;
}

// Every move available right now: {kind:'lane'|'slot', i}.
export function legalMoves(st) {
  const out = [];
  if (st.status !== 'play') return out;
  st.lanes.forEach((lane, i) => { if (!laneBlock(st, i)) out.push({ kind: 'lane', i }); });
  if (beltLoad(st) < st.beltCap && st.taps > 0) st.slots.forEach((s, i) => { if (s) out.push({ kind: 'slot', i }); });
  return out;
}

export function applyMove(st, m) {
  return m.kind === 'lane' ? launchLane(st, m.i) : launchSlot(st, m.i);
}

// Score a move by simulating forward until the launched bucket(s) finish a lap.
function scoreMove(st, m) {
  const c = cloneState(st);
  const shooter = m.kind === 'lane' ? c.lanes[m.i][0] : c.slots[m.i];
  const id = shooter.id, ammo = shooter.n;
  const before = c.left;
  applyMove(c, m);
  let shots = 0, parked = false, popped = false;
  const limit = c.L * 2 + c.spacing * (c.pending.length + 2) + 4;
  for (let t = 0; t < limit && c.status === 'play'; t++) {
    step(c);
    for (const e of c.events) {
      if (e.id !== id) continue;
      if (e.type === 'shot') shots++;
      if (e.type === 'pop') popped = true;
      if (e.type === 'park') parked = true;
    }
    c.events.length = 0;
    if (popped || parked) break;
  }
  if (c.status === 'win') return { score: 1e9, shots, popped: true, parked: false };
  if (c.status === 'fail') return { score: -1e9, shots, popped, parked };
  const free = freeSlots(c);
  let score = shots * 10 + (before - c.left);
  if (popped) score += 40 + ammo;
  if (m.kind === 'slot') score += 25; // frees a spot
  if (shots === 0) score -= 150;        // a move that paints nothing only shuffles buckets around
  if (parked) score -= free <= 1 ? 400 : free <= 2 ? 120 : 30;
  return { score, shots, popped, parked };
}

export function bestMove(st) {
  const moves = legalMoves(st);
  let best = null;
  for (const m of moves) {
    const r = scoreMove(st, m);
    if (!best || r.score > best.r.score) best = { m, r };
  }
  return best;
}

// Smart greedy player. Launches only when a move is useful, or when nothing is
// moving and something has to go.
// Nothing painted for four laps = this player is going in circles: count it as a loss.
function stalled(st, mem) {
  if (st.left !== mem.left) { mem.left = st.left; mem.t = st.tick; return false; }
  return st.tick - mem.t > st.L * 4 + 40;
}

// frugal: only spend a tap on a bucket that will empty in this lap (unless nothing moves).
export function playSmart(level, { maxTicks = 20000, revives = 0, frugal = false } = {}) {
  const st = createGame(level);
  let revivesLeft = revives;
  const mem = { left: -1, t: 0 };
  for (let t = 0; t < maxTicks; t++) {
    if (stalled(st, mem)) break;
    if (st.status === 'fail') {
      if (revivesLeft-- > 0) { reviveState(st); continue; }
      break;
    }
    if (st.status === 'win') break;
    // Decide (at most a couple of launches per tick, like a fast human).
    for (let k = 0; k < 2; k++) {
      const b = bestMove(st);
      if (!b) break;
      const idle = st.belt.length === 0 && st.pending.length === 0;
      if (frugal ? (b.r.popped || idle) : (b.r.shots > 0 || idle)) applyMove(st, b.m); else break;
    }
    step(st);
    st.events.length = 0;
  }
  return { win: st.status === 'win', st };
}

function reviveState(st) {
  // mirror engine.revive without importing to keep the bot independent of UI flows
  st.slots.push(null, null);
  const s = st.stuck; st.stuck = null;
  if (s) st.slots[st.slots.indexOf(null)] = s;
  st.status = 'play';
  st.stats.revives++;
}

// Impatient random player: taps something whenever it can, a little at random.
export function playRandom(level, seed = 1, { maxTicks = 20000, tapChance = 0.12 } = {}) {
  const st = createGame(level);
  let r = seed >>> 0 || 1;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const mem = { left: -1, t: 0 };
  for (let t = 0; t < maxTicks && st.status === 'play'; t++) {
    if (stalled(st, mem)) break;
    const idle = st.belt.length === 0 && st.pending.length === 0;
    if (idle || rnd() < tapChance) {
      const moves = legalMoves(st);
      if (moves.length) applyMove(st, moves[Math.floor(rnd() * moves.length)]);
    }
    step(st);
    st.events.length = 0;
  }
  return { win: st.status === 'win', st };
}

// A button masher: taps whatever can be tapped, as fast as the game allows.
export function playSpam(level, seed = 1, { maxTicks = 20000 } = {}) {
  const st = createGame(level);
  let r = seed >>> 0 || 1;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const mem = { left: -1, t: 0 };
  for (let t = 0; t < maxTicks && st.status === 'play'; t++) {
    if (stalled(st, mem)) break;
    const moves = legalMoves(st);
    if (moves.length) {
      const lanes = moves.filter((m) => m.kind === 'lane');
      const pool = lanes.length && rnd() < 0.75 ? lanes : moves;
      applyMove(st, pool[Math.floor(rnd() * pool.length)]);
    }
    step(st);
    st.events.length = 0;
  }
  return { win: st.status === 'win', st };
}

// A casual player who reads the board: sends awake buckets (color reachable),
// usually the one whose color shows the most pixels for its number, and only
// sends a sleepy one when nothing is moving.
export function playAwake(level, seed = 1, { maxTicks = 20000, tapChance = 0.1, focus = 0.7 } = {}) {
  const st = createGame(level);
  let r = seed >>> 0 || 1;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const mem = { left: -1, t: 0 };
  for (let t = 0; t < maxTicks && st.status === 'play'; t++) {
    if (stalled(st, mem)) break;
    const idle = st.belt.length === 0 && st.pending.length === 0;
    if (idle || rnd() < tapChance) {
      const moves = legalMoves(st);
      if (moves.length) {
        const exp = exposure(st.w, st.h, st.cells, st.coats);
        const seen = {};
        for (let i = 0; i < exp.length; i++) if (exp[i]) seen[st.cells[i]] = (seen[st.cells[i]] || 0) + 1;
        const bucket = (m) => (m.kind === 'lane' ? st.lanes[m.i][0] : st.slots[m.i]);
        const value = (m) => { const b = bucket(m); return b.c === WILD ? 99 : (seen[b.c] || 0) / Math.max(1, b.n); };
        const awake = moves.filter((m) => value(m) > 0);
        let pick = null;
        if (awake.length) {
          if (rnd() < focus) pick = awake.reduce((a, b) => (value(b) > value(a) ? b : a));
          else pick = awake[Math.floor(rnd() * awake.length)];
          // with a tap budget, a thinking player waits until a bucket can do real work
          if (Number.isFinite(st.taps) && !idle && value(pick) < 0.6) pick = null;
        } else if (idle) pick = moves[Math.floor(rnd() * moves.length)];
        if (pick) applyMove(st, pick);
      }
    }
    step(st);
    st.events.length = 0;
  }
  return { win: st.status === 'win', st };
}
