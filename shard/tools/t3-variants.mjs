import { stable, solve } from './solver.mjs';
import { playOnce } from './playtest-bot.mjs';
import { rng } from './pieces.mjs';
const T = 0.11;
const box = (x, sy, s = 0.66, tint = 2) => ({ t: 'glass', s: 'box', x, y: sy + s / 2 + 0.004, w: s, h: s, tint });
const shelf = (x, y, w) => ({ t: 'shelf', x, y, w, h: 0.22, round: true });
function pyramid(cx, sy, shelfW, lx = 4.5) {
  const g = 0.68;
  return { launcher: { x: lx }, objects: [shelf(cx, sy, shelfW),
    box(cx - g, sy + T, 0.66, 0), box(cx, sy + T, 0.66, 1), box(cx + g, sy + T, 0.66, 2),
    box(cx - g / 2, sy + T + 0.668, 0.66, 1), box(cx + g / 2, sy + T + 0.668, 0.66, 2), box(cx, sy + T + 1.336, 0.66, 0)] };
}
function pyr2(cx, sy, shelfW, size = 0.66, rows = 3, lx = 4.5) {
  const g = size + 0.02, objs = [shelf(cx, sy, shelfW)];
  let top = sy + T;
  for (let r = 0; r < rows; r++) { const n = rows - r; for (let k = 0; k < n; k++) objs.push(box(cx + (k - (n - 1) / 2) * g, top, size, (r + k) % 3)); top += size + 0.008; }
  return { launcher: { x: lx }, objects: objs };
}
const variants = {};
for (const cx of [6.1, 6.4, 6.7]) for (const sy of [3.0, 3.4, 3.8]) variants[`C6_x${cx}_y${sy}`] = pyr2(cx, sy, 1.7, 0.8, 2);
for (const [name, lv] of Object.entries(variants)) {
  if (!stable(lv)) { console.log(name, 'unstable'); continue; }
  const s = solve(lv);
  if (!s) { console.log(name, 'unsolved'); continue; }
  const L = { ...lv, par: s.par, balls: s.par + 2 };
  let wins = 0, ones = 0; const N = 30;
  for (let k = 0; k < N; k++) { const r = playOnce(L, rng(900 + k)); if (r.won) { wins++; if (r.used === 1) ones++; } }
  console.log(`${name}: par ${s.par} solverWin ${(s.winFrac * 100).toFixed(0)}% hit ${(s.firstHitFrac * 100).toFixed(0)}% | bot clears ${Math.round(wins / N * 100)}% (one-shot ${ones}/${N}) balls ${L.balls}`);
}
