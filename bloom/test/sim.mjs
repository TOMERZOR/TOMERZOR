// Plays many games with simulated players of different skill, once with the adaptive engine and
// once with plain random pieces, and prints how long games last.
//   node bloom/test/sim.mjs [gamesPerPlayer=8] [players=8]
import { COLS, ROWS, WEED, emptyBoard, seedGarden, cloneBoard, heights, canDrop, drop, resolve, rotations, pieceWidth, anyDrop, growWeeds, idx } from '../js/board.js';
import { makePieceFor, randomPiece, colorCount, weedPlan } from '../js/engine.js';
import { stepPoints } from '../js/rules.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// How a player sizes up a board: points now, low stacks, and same colours touching (set-ups).
function judge(b, pts) {
  const h = heights(b);
  let touch = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = b.grid[idx(r, c)];
    if (!v || v === WEED) continue;
    if (c + 1 < COLS && b.grid[idx(r, c + 1)] === v) touch++;
    if (r + 1 < ROWS && b.grid[idx(r + 1, c)] === v) touch++;
  }
  const maxH = Math.max(...h);
  return pts / 10 + touch * 1.5 - maxH * maxH * 0.35 - h.reduce((a, x) => a + x, 0) * 0.3;
}

function chooseMove(b, tray, skill, rng) {
  const moves = [];
  const h = heights(b);
  tray.forEach((piece, i) => {
    for (const p of rotations(piece)) for (let c = 0; c + pieceWidth(p) <= COLS; c++) {
      if (!canDrop(b, p, c, h)) continue;
      const t = cloneBoard(b);
      drop(t, p, c);
      const steps = resolve(t);
      const pts = steps.reduce((a, s) => a + stepPoints(s), 0);
      moves.push({ i, p, c, t, steps, pts, v: judge(t, pts) });
    }
  });
  if (!moves.length) return null;
  moves.sort((a, b) => b.v - a.v);
  if (rng() < skill) return moves[0];
  return moves[Math.floor(rng() * Math.ceil(moves.length / 2))];
}

function playGame(player, useEngine, rng) {
  let b = seedGarden(emptyBoard(), colorCount(player.games, 0), rng), score = 0, drops = 0, dry = 0, lastChain = 0, maxChain = 0;
  const ctx = () => ({ board: b, score, best: player.best, gamesPlayed: player.games, drops, dropsSinceBloom: dry, lastChain, recentScores: player.recent });
  const next = () => (useEngine ? makePieceFor(ctx(), rng) : { piece: randomPiece(colorCount(player.games, drops), rng), weeds: weedPlan(ctx(), 0.5) });
  const tray = [next().piece, next().piece, next().piece];
  let timer = weedPlan(ctx(), 0.5).every;
  for (;;) {
    if (!tray.some((p) => anyDrop(b, p))) return { score, drops, maxChain };
    const m = chooseMove(b, tray, player.skill, rng);
    b = m.t;
    score += m.pts;
    drops++;
    dry = m.steps.length ? 0 : dry + 1;
    lastChain = m.steps.length;
    maxChain = Math.max(maxChain, lastChain);
    const n = next();
    tray[m.i] = n.piece;
    if (--timer <= 0) {
      const cols = [...Array(COLS).keys()].sort(() => rng() - 0.5).slice(0, n.weeds.count);
      growWeeds(b, cols);
      timer = n.weeds.every;
    }
    if (drops > 500) return { score, drops, maxChain, capped: true };
  }
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

const gamesPer = +(process.argv[2] || 8);
const playersPer = +(process.argv[3] || 8);
for (const [name, skill] of [['weak', 0.25], ['casual', 0.6], ['strong', 0.92]]) {
  for (const useEngine of [false, true]) {
    const rng = mulberry32(99 + Math.round(skill * 100));
    const len = [], scores = [], chains = [];
    let capped = 0;
    const t0 = performance.now();
    for (let p = 0; p < playersPer; p++) {
      const player = { skill, best: 0, games: 0, recent: [] };
      for (let g = 0; g < gamesPer; g++) {
        const res = playGame(player, useEngine, rng);
        if (res.capped) capped++;
        len.push(res.drops); scores.push(res.score); chains.push(res.maxChain);
        player.best = Math.max(player.best, res.score);
        player.games++;
        player.recent = [...player.recent, res.score].slice(-10);
      }
    }
    const ms = performance.now() - t0;
    const short = len.filter((x) => x < 30).length / len.length;
    console.log(`${name.padEnd(7)} ${useEngine ? 'engine' : 'random'}  drops p10/med/p90 ${pct(len, 0.1)}/${pct(len, 0.5)}/${pct(len, 0.9)}  score med ${pct(scores, 0.5)}  best chain med ${pct(chains, 0.5)}  short(<30) ${(short * 100).toFixed(0)}%  capped ${capped}  ${(ms / len.reduce((a, b) => a + b, 0)).toFixed(1)}ms/drop`);
  }
}
