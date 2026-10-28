// Plays many games with simulated players of different skill, once with the adaptive engine and
// once with plain random trays, and prints how long games last.
//   node bloom/test/sim.mjs [gamesPerPlayer=12] [players=12]
import { N, emptyGrid, place, placementsOf, fillCount, anyFit } from '../js/board.js';
import { SHAPE_BY_ID } from '../js/pieces.js';
import { makeTray, randomTray } from '../js/engine.js';
import { scoreMove } from '../js/rules.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// How good a resulting board looks to a player: lines cleared, snug fit, no single-cell holes.
// Also keeps room for the big pieces and a smooth surface, the way experienced players do.
const BIG = [SHAPE_BY_ID.get('o3.0'), SHAPE_BY_ID.get('i5.0'), SHAPE_BY_ID.get('i5.1'), SHAPE_BY_ID.get('o2.0')];
function judge(before, res) {
  const g = res.grid;
  let holes = 0, edges = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = g[y * N + x] ? 1 : 0;
    if (x + 1 < N && v !== (g[y * N + x + 1] ? 1 : 0)) edges++;
    if (y + 1 < N && v !== (g[(y + 1) * N + x] ? 1 : 0)) edges++;
    if (v) continue;
    let closed = 0;
    for (const [ny, nx] of [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]]) if (ny < 0 || nx < 0 || ny >= N || nx >= N || g[ny * N + nx]) closed++;
    if (closed === 4) holes++;
  }
  let room = 0;
  for (const s of BIG) if (anyFit(g, s)) room += s.n >= 9 ? 4 : 2;
  return res.lines * 12 - holes * 5 - edges * 0.6 + room - fillCount(g) * 0.1;
}

function chooseMove(grid, tray, skill, rng) {
  const moves = [];
  tray.forEach((s, i) => {
    if (!s) return;
    for (const [r, c] of placementsOf(grid, s)) {
      const res = place(grid, s, r, c);
      moves.push({ i, r, c, res, v: judge(grid, res) });
    }
  });
  if (!moves.length) return null;
  moves.sort((a, b) => b.v - a.v);
  if (rng() < skill) return moves[0];
  return moves[Math.floor(rng() * Math.ceil(moves.length / 2))];
}

function playGame(player, useEngine, rng) {
  let grid = emptyGrid(), score = 0, combo = 0, msc = 0, placements = 0, trayIndex = 0, lines = 0, rescues = 0;
  for (;;) {
    const ctx = { grid, score, best: player.best, gamesPlayed: player.games, placements, movesSinceClear: msc, combo, recentScores: player.recent, trayIndex };
    const tray = (useEngine ? makeTray(ctx, rng) : randomTray(rng)).pieces.slice();
    trayIndex++;
    for (let k = 0; k < 3; k++) {
      const m = chooseMove(grid, tray, player.skill, rng);
      if (!m) return { score, placements, lines };
      const s = tray[m.i];
      tray[m.i] = null;
      grid = m.res.grid;
      const st = scoreMove({ combo, movesSinceClear: msc }, s.n, m.res.lines, m.res.lines && fillCount(grid) === 0);
      combo = st.combo; msc = st.movesSinceClear; score += st.points; lines += m.res.lines;
      placements++;
      if (placements > 600) return { score, placements, lines, capped: true };
    }
  }
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

const gamesPer = +(process.argv[2] || 12);
const playersPer = +(process.argv[3] || 12);
const skills = [['weak', 0.25], ['casual', 0.6], ['strong', 0.92]];

for (const [name, skill] of skills) {
  for (const useEngine of [false, true]) {
    const rng = mulberry32(1234 + Math.round(skill * 100));
    const len = [], scores = [], firstGame = [];
    let t0 = performance.now(), capped = 0;
    for (let p = 0; p < playersPer; p++) {
      const player = { skill, best: 0, games: 0, recent: [] };
      for (let g = 0; g < gamesPer; g++) {
        const res = playGame(player, useEngine, rng);
        if (res.capped) capped++;
        len.push(res.placements); scores.push(res.score);
        if (g === 0) firstGame.push(res.placements);
        player.best = Math.max(player.best, res.score);
        player.games++;
        player.recent = [...player.recent, res.score].slice(-10);
      }
    }
    const ms = performance.now() - t0;
    const short = len.filter((x) => x < 25).length / len.length;
    console.log(`${name.padEnd(7)} ${useEngine ? 'engine' : 'random'}  moves p10/med/p90 ${pct(len, 0.1)}/${pct(len, 0.5)}/${pct(len, 0.9)}  first game med ${pct(firstGame, 0.5)}  score med ${pct(scores, 0.5)}  short(<25) ${(short * 100).toFixed(0)}%  capped ${capped}  ${(ms / len.reduce((a, b) => a + b, 0) * 3).toFixed(1)}ms/tray`);
  }
}
