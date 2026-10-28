// The adaptive tray engine. Every time the tray empties it reads how the player is doing and
// picks the next three pieces. Nothing about the board is hidden or changed: only which
// pieces come next. It aims to keep the player in "flow":
//   - frustrated (board filling up, no clears for a while, a run of short games, thinking long)
//     → kinder trays: pieces that fit, that can complete lines, sometimes a whole-board clear;
//   - cruising (empty board, combo going) → tougher trays to build tension;
//   - close to their best → a helping hand so the record can fall (the biggest reward moment);
//   - a slow wave of tension and release across the game, and gentle fatigue in very long
//     games so sessions end while they are still fun.
import { N, fits, place, anyFit, placementsOf, linesWith, fillCount } from './board.js';
import { SHAPES } from './pieces.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

// How kind the next tray should be, 0..1, with the reasons (for the debug overlay and tests).
export function computeMercy(ctx) {
  const reasons = [];
  const add = (label, d) => { if (Math.abs(d) >= 0.005) reasons.push([label, d]); return d; };
  let m = 0.5;
  const fill = fillCount(ctx.grid) / (N * N);
  const games = ctx.gamesPlayed || 0;
  const placements = ctx.placements || 0;
  const msc = ctx.movesSinceClear || 0;

  if (games < 3 && placements < 90) m += add('שחקן חדש', 0.3 - games * 0.08);
  if (placements < 21) m += add('פתיחה', 0.18 * (1 - placements / 21));
  if (fill > 0.42) m += add('לוח עמוס', (fill - 0.42) * 1.5);
  if (msc >= 4) m += add('בלי ניקוי', (msc - 3) * 0.07);
  const recent = ctx.recentScores || [];
  if (recent.length >= 4) {
    const sorted = [...recent].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const last3 = recent.slice(-3);
    if (median > 0 && last3.reduce((a, b) => a + b, 0) / 3 < median * 0.6) m += add('רצף הפסדים', 0.15);
  }
  if ((ctx.thinkMs || 0) > 5000) m += add('מתלבט', 0.08);
  if (fill < 0.3 && (ctx.combo || 0) >= 2) m += add('שיוט', -0.2);
  const best = ctx.best || 0, score = ctx.score || 0;
  if (best > 0 && score >= best * 0.75 && score < best) m += add('מרדף שיא', 0.25);
  if (best > 0 && score > best * 1.15) m += add('אחרי שיא', -0.12);
  m += add('גל מתח', Math.sin((placements / 27) * Math.PI * 2) * 0.13);
  if (placements > 80) m += add('עייפות', -Math.min(0.6, (placements - 80) / 160));

  const rescue = !!ctx.rescue || msc >= 7;
  if (msc >= 7) reasons.push(['חלק מציל', 0]);
  if (ctx.rescue) { m = 1; reasons.push(['צ׳אנס נוסף', 0]); }
  return { mercy: clamp(m, 0, 1), reasons, rescue, fill };
}

function weightFor(shape, mercy) {
  // Kind trays favour easy shapes, tough trays favour awkward ones; at mercy 0.5 it's neutral.
  return shape.weight * (0.5 + shape.hard + (0.9 - 2 * shape.hard) * mercy);
}

function sample(rng, mercy) {
  let total = 0;
  for (const s of SHAPES) total += weightFor(s, mercy);
  let x = rng() * total;
  for (const s of SHAPES) { x -= weightFor(s, mercy); if (x <= 0) return s; }
  return SHAPES[SHAPES.length - 1];
}

// Can all pieces be placed, in some order? Gives up (and says yes) after `budget` tries.
function solvable(grid, pieces, budget = { n: 3000 }) {
  if (!pieces.length) return true;
  const tried = new Set();
  for (let i = 0; i < pieces.length; i++) {
    const s = pieces[i];
    if (tried.has(s.id)) continue;
    tried.add(s.id);
    const rest = pieces.filter((_, j) => j !== i);
    for (let r = 0; r + s.h <= N; r++) for (let c = 0; c + s.w <= N; c++) {
      if (!fits(grid, s, r, c)) continue;
      if (--budget.n < 0) return true;
      if (solvable(place(grid, s, r, c).grid, rest, budget)) return true;
    }
  }
  return false;
}

// Best number of lines a sensible player could clear with this tray (greedy, every order),
// and whether the board can be wiped clean along the way.
function greedy(grid, pieces) {
  let bestLines = 0, allClear = false;
  for (const order of ORDERS) {
    let g = grid, lines = 0, ok = true;
    for (const idx of order) {
      const s = pieces[idx];
      let pick = null, pickLines = -1, pickTouch = -1;
      for (const [r, c] of placementsOf(g, s)) {
        const { rows, cols } = linesWith(g, s, r, c);
        const l = rows.length + cols.length;
        if (l < pickLines) continue;
        const t = touch(g, s, r, c);
        if (l > pickLines || t > pickTouch) { pick = [r, c]; pickLines = l; pickTouch = t; }
      }
      if (!pick) { ok = false; break; }
      const res = place(g, s, pick[0], pick[1]);
      g = res.grid;
      lines += res.lines;
      if (res.lines && fillCount(g) === 0) allClear = true;
    }
    if (ok) bestLines = Math.max(bestLines, lines);
  }
  return { lines: bestLines, allClear };
}

// How snugly a placement sits: neighbouring blocks and walls.
function touch(g, s, r, c) {
  let t = 0;
  for (const [dr, dc] of s.cells) {
    const y = r + dr, x = c + dc;
    for (const [ny, nx] of [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]]) {
      if (ny < 0 || nx < 0 || ny >= N || nx >= N || g[ny * N + nx]) t++;
    }
  }
  return t;
}

function immediateClear(grid, pieces) {
  return pieces.some((s) => placementsOf(grid, s).some(([r, c]) => {
    const { rows, cols } = linesWith(grid, s, r, c);
    return rows.length + cols.length > 0;
  }));
}

// Shapes that would complete at least one line right now, weighted by how many.
function lineMakers(grid) {
  const out = [];
  for (const s of SHAPES) {
    let best = 0;
    for (const [r, c] of placementsOf(grid, s)) {
      const { rows, cols } = linesWith(grid, s, r, c);
      best = Math.max(best, rows.length + cols.length);
    }
    if (best) out.push({ s, lines: best });
  }
  return out;
}

function evaluate(grid, pieces) {
  const freedom = pieces.reduce((a, s) => a + Math.min(1, placementsOf(grid, s).length / 18), 0) / 3;
  const hard = pieces.reduce((a, s) => a + s.hard, 0) / 3;
  const g = greedy(grid, pieces);
  return { freedom, hard, lines: g.lines, allClear: g.allClear, now: immediateClear(grid, pieces), solvable: solvable(grid, pieces) };
}

export function makeTray(ctx, rng = Math.random) {
  const mood = computeMercy(ctx);
  const { mercy, rescue } = mood;
  const grid = ctx.grid;
  const makers = rescue || mercy > 0.6 ? lineMakers(grid) : [];
  // A full solve is required on kind trays, and usually on tough ones too; a truly mean tray
  // (no way to place all three) only happens when the engine is in its toughest mood.
  const mustSolve = mercy > 0.3 || rng() < 0.55 + mercy * 1.5;

  const candidates = [];
  const tries = 26;
  for (let k = 0; k < tries; k++) {
    const pieces = [];
    if (makers.length && (rescue || k % 2 === 0)) {
      const tot = makers.reduce((a, m) => a + m.lines, 0);
      let x = rng() * tot;
      pieces.push((makers.find((m) => (x -= m.lines) <= 0) || makers[0]).s);
    }
    while (pieces.length < 3) pieces.push(sample(rng, mercy));
    candidates.push(pieces);
  }

  let best = null;
  for (const pieces of candidates) {
    const st = evaluate(grid, pieces);
    if (mustSolve && !st.solvable) continue;
    if (rescue && !st.now) continue;
    const fams = new Set(pieces.map((s) => s.family)).size;
    const help = 0.45 * Math.min(1, st.lines / 3) + 0.25 * st.freedom + 0.2 * (st.now ? 1 : 0) + (st.allClear ? 0.6 : 0);
    const tension = 0.7 * st.hard + 0.3 * (1 - st.freedom);
    const u = mercy * help + (1 - mercy) * tension * 0.6 + rng() * 0.2 - (3 - fams) * 0.12;
    if (!best || u > best.u) best = { u, pieces, st };
  }
  if (!best) {
    // Nothing met the bar: fall back to the most placeable tray of small pieces.
    let fallback = null;
    for (let k = 0; k < 20; k++) {
      const pieces = [sample(rng, 1), sample(rng, 1), sample(rng, 1)];
      const st = evaluate(grid, pieces);
      const u = (st.solvable ? 2 : 0) + (st.now ? 1 : 0) + st.freedom;
      if (!fallback || u > fallback.u) fallback = { u, pieces, st };
    }
    best = fallback;
  }
  return { pieces: best.pieces, mercy, reasons: mood.reasons, stats: best.st };
}

// A plain random tray (for comparison in the simulations).
export function randomTray(rng = Math.random) {
  return { pieces: [sample(rng, 0.5), sample(rng, 0.5), sample(rng, 0.5)] };
}

export { anyFit };
