// The adaptive engine. Each time a slot in the tray empties it reads how the player is doing and
// picks the next seed bundle: its shape and the colour of every seed. It also paces the weeds.
// Nothing on the board is ever changed behind the player's back. The aim is "flow":
//   - struggling (garden filling up, nothing bloomed for a while, a run of short games,
//     thinking long) → kinder pieces: colours that complete groups already showing at the top,
//     single-colour bundles, small shapes, weeds held back;
//   - cruising (low garden, chains going) → tougher: mixed colours, wide shapes;
//   - close to their best → a helping hand so the record can fall;
//   - a slow wave of tension and release, and fatigue in very long games so they end while fun.
import { COLS, ROWS, WEED, cloneBoard, heights, canDrop, drop, resolve, rotations, pieceWidth, fillCount, idx } from './board.js';
import { SHAPES, SHAPE_BY_ID, makePiece } from './pieces.js';
import { stepPoints } from './rules.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// More colours means fewer matches: 4 for a brand-new player's opening, 6 deep into a game.
export const colorCount = (gamesPlayed, drops = 0) => (gamesPlayed < 2 && drops < 30 ? 4 : drops < 55 ? 5 : 6);

export function computeMercy(ctx) {
  const reasons = [];
  const add = (label, d) => { if (Math.abs(d) >= 0.005) reasons.push([label, d]); return d; };
  let m = 0.5;
  const fill = fillCount(ctx.board) / (COLS * ROWS);
  const top = Math.max(...heights(ctx.board)) / ROWS;
  const games = ctx.gamesPlayed || 0, drops = ctx.drops || 0, dry = ctx.dropsSinceBloom || 0;

  // Late in a game the help fades, so even a great run ends while it's still fun.
  const late = clamp((drops - 40) / 70, 0, 1);
  if (games < 3 && drops < 60) m += add('שחקן חדש', 0.3 - games * 0.08);
  if (drops < 12) m += add('פתיחה', 0.18 * (1 - drops / 12));
  if (fill > 0.4) m += add('גן עמוס', (fill - 0.4) * 1.3 * (1 - late * 0.8));
  if (top > 0.7) m += add('קרוב לתקרה', (top - 0.7) * 1.2 * (1 - late * 0.8));
  if (dry >= 3) m += add('בלי פריחה', (dry - 2) * 0.07 * (1 - late * 0.8));
  const recent = ctx.recentScores || [];
  if (recent.length >= 4) {
    const sorted = [...recent].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median > 0 && recent.slice(-3).reduce((a, b) => a + b, 0) / 3 < median * 0.6) m += add('רצף הפסדים', 0.15);
  }
  if ((ctx.thinkMs || 0) > 6000) m += add('מתלבט', 0.08);
  if (fill < 0.25 && (ctx.lastChain || 0) >= 2) m += add('שיוט', -0.2);
  const best = ctx.best || 0, score = ctx.score || 0;
  if (best > 0 && score >= best * 0.75 && score < best) m += add('מרדף שיא', 0.25);
  if (best > 0 && score > best * 1.15) m += add('אחרי שיא', -0.12);
  m += add('גל מתח', Math.sin((drops / 24) * Math.PI * 2) * 0.13);
  if (late > 0) m += add('עייפות', -late * 0.8);

  const rescue = !!ctx.rescue || (dry >= 6 && late < 0.5);
  if (dry >= 6 && late < 0.5) reasons.push(['חלק מציל', 0]);
  if (ctx.rescue) { m = 1; reasons.push(['צ׳אנס נוסף', 0]); }
  return { mercy: clamp(m, 0, 1), reasons, rescue, fill };
}

// How the weeds come: every `every` drops, `count` columns get a weed pushed in from below.
export function weedPlan(ctx, mercy) {
  const drops = ctx.drops || 0;
  let every = Math.max(3, 7 - Math.floor(drops / 15));
  if ((ctx.gamesPlayed || 0) < 2 && drops < 40) every += 2;
  if (mercy > 0.7) every += 1;
  const count = Math.min(7, 3 + Math.floor(drops / 20));
  return { every, count };
}

// Colours worth offering: seeds sitting on top of each column, weighted by the size of their group.
function usefulColors(b, K) {
  const w = new Array(K + 1).fill(0.2);
  const h = heights(b);
  for (let c = 0; c < COLS; c++) {
    if (!h[c] || h[c] >= ROWS) continue;
    const top = b.grid[idx(ROWS - h[c], c)];
    if (top && top !== WEED) w[top] += 1 + groupSize(b, ROWS - h[c], c);
  }
  return w;
}

function groupSize(b, r, c) {
  const col = b.grid[idx(r, c)];
  const seen = new Set([idx(r, c)]);
  const stack = [[r, c]];
  while (stack.length) {
    const [y, x] = stack.pop();
    for (const [ny, nx] of [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]]) {
      if (ny < 0 || nx < 0 || ny >= ROWS || nx >= COLS) continue;
      const n = idx(ny, nx);
      if (!seen.has(n) && b.grid[n] === col) { seen.add(n); stack.push([ny, nx]); }
    }
  }
  return seen.size;
}

function pickWeighted(rng, weights) {
  let tot = 0;
  for (const x of weights) tot += x;
  let x = rng() * tot;
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; }
  return weights.length - 1;
}

function sampleShape(rng, mercy) {
  return SHAPES[pickWeighted(rng, SHAPES.map((s) => s.w * (0.5 + s.hard + (0.9 - 2 * s.hard) * mercy)))];
}

function sampleColors(rng, n, K, mercy, useful) {
  const weights = useful.map((u, i) => (i === 0 ? 0 : 1 + u * mercy * 2));
  const first = pickWeighted(rng, weights) || 1;
  const colors = [first];
  for (let i = 1; i < n; i++) {
    // kind pieces are more often single-coloured; tough ones mix
    if (rng() < 0.2 + mercy * 0.45) colors.push(first);
    else colors.push(1 + Math.floor(rng() * K));
  }
  return noSelfBloom(colors, K, rng);
}

// A bundle must never bloom on its own: at most three seeds of one colour.
function noSelfBloom(colors, K, rng) {
  if (colors.length >= 4 && colors.every((c) => c === colors[0])) {
    const other = 1 + ((colors[0] - 1 + 1 + Math.floor(rng() * (K - 1))) % K);
    colors[colors.length - 1] = other;
  }
  return colors;
}

// Every placement of a piece: does it bloom, how big, how long a chain, how high the garden ends up.
export function evaluatePiece(b, piece) {
  let fits = false, bloom = false, bestPoints = 0, bestChain = 0, bestCleared = 0, lowest = ROWS;
  const h = heights(b);
  for (const p of rotations(piece)) {
    for (let c = 0; c + pieceWidth(p) <= COLS; c++) {
      if (!canDrop(b, p, c, h)) continue;
      fits = true;
      const t = cloneBoard(b);
      drop(t, p, c);
      const steps = resolve(t);
      const pts = steps.reduce((a, s) => a + stepPoints(s), 0);
      if (steps.length) bloom = true;
      bestPoints = Math.max(bestPoints, pts);
      bestChain = Math.max(bestChain, steps.length);
      bestCleared = Math.max(bestCleared, steps.reduce((a, s) => a + s.cleared.length, 0));
      lowest = Math.min(lowest, Math.max(...heights(t)));
    }
  }
  return { fits, bloom, bestPoints, bestChain, bestCleared, lowest };
}

export function makePieceFor(ctx, rng = Math.random) {
  const mood = computeMercy(ctx);
  const { mercy, rescue } = mood;
  const K = colorCount(ctx.gamesPlayed || 0, ctx.drops || 0);
  const useful = usefulColors(ctx.board, K);
  const candidates = [];
  for (let k = 0; k < 16; k++) {
    const shape = rescue && k % 2 === 0 ? SHAPE_BY_ID.get('pair') : sampleShape(rng, mercy);
    let colors = sampleColors(rng, shape.cells.length, K, rescue ? 1 : mercy, useful);
    if (rescue && k % 2 === 0) { const best = useful.indexOf(Math.max(...useful.slice(1)), 1); colors = colors.map(() => best); }
    candidates.push(makePiece(shape, colors));
  }
  let best = null;
  for (const piece of candidates) {
    const st = evaluatePiece(ctx.board, piece);
    if (!st.fits && mercy > 0.2) continue;
    if (rescue && !st.bloom) continue;
    const shape = SHAPE_BY_ID.get(piece.shape);
    const mixed = new Set(piece.colors).size > 1 ? 1 : 0;
    const help = 0.45 * (st.bloom ? 1 : 0) + 0.3 * Math.min(1, st.bestCleared / 8) + 0.15 * (st.bestChain >= 2 ? 1 : 0) + 0.1 * (1 - st.lowest / ROWS);
    const tension = 0.6 * shape.hard + 0.4 * mixed;
    const u = mercy * help + (1 - mercy) * tension * 0.6 + rng() * 0.2;
    if (!best || u > best.u) best = { u, piece, st };
  }
  if (!best) {
    // nothing met the bar: a single-colour pair in the most useful colour
    const c = useful.indexOf(Math.max(...useful.slice(1)), 1);
    const piece = makePiece(SHAPE_BY_ID.get('pair'), [c, c]);
    best = { piece, st: evaluatePiece(ctx.board, piece) };
  }
  return { piece: best.piece, mercy, reasons: mood.reasons, stats: best.st, weeds: weedPlan(ctx, mercy) };
}

// Plain random pieces (for comparison in the simulations).
export function randomPiece(K, rng = Math.random) {
  const shape = SHAPES[pickWeighted(rng, SHAPES.map((s) => s.w))];
  return makePiece(shape, noSelfBloom(shape.cells.map(() => 1 + Math.floor(rng() * K)), K, rng));
}
