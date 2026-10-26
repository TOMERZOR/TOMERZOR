// Plays every level many times with a simulated player, to check each one can be won
// with a sensible plan but not without one.
//   node achori/test/sim.mjs [level]
import { Game, TOOLS, COLS, ROWS, cellOf } from '../js/game.js';
import { LEVELS } from '../js/levels.js';

function rnd(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// A simulated player who taps held mice on the beat.
function gauss(R) { return Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R()); }

// sigma: how far off the beat a tap lands; aim: chance a tap on a running mouse lands.
export function play(level, placements, { sigma = 0.07, aim = 0.35, runTaps = 1.2, seed = 1, abilities = true } = {}) {
  const g = new Game(level, { seed });
  for (const [k, c, r] of placements) g.place(k, c, r);
  g.start();
  const R = rnd(seed * 97 + 3);
  const dt = 1 / 60;
  let cd = 0;
  for (let t = 0; t < 180 && g.phase === 'action'; t += dt) {
    g.update(dt);
    cd -= dt;
    const live = g.liveMice().filter((m) => m.state !== 'emerge' && m.state !== 'leaving' && m.state !== 'away');
    if (abilities) {
      const g0 = cellOf(g.goal);
      const danger = live.find((m) => !g.isHeld(m) && (m.carrying || Math.abs(m.x - g0.c) + Math.abs(m.z - g0.r) < 1.6));
      if (danger && g.abilities.ofek > 0) g.useAbility('ofek');
      else if (danger && g.abilities.shalev > 0) g.useAbility('shalev');
    }
    if (cd <= 0 && live.length) {
      const held = live.filter((m) => g.isHeld(m)).sort((a, b) => a.t - b.t);
      if (held.length) {
        // tap on the ring's beat, off by a human amount (gaussian, sigma seconds)
        const m = held[0];
        if (m._beat !== m.beatN) { m._beat = m.beatN; m._err = sigma * gauss(R); }
        if (m.beatT >= m.beatP + m._err) { g.whack(m, 1); cd = 0.05; } else cd = 0;
      } else {
        const m = live[Math.floor(R() * live.length)];
        g.whack(m, R() < aim ? 0.4 + 0.6 * R() : 0.34 * R());
        cd = (1 / runTaps) * (0.8 + 0.4 * R());
      }
    }
    g.drain();
  }
  return g;
}

function randomPlan(level, R) {
  const g = new Game(level);
  const out = [];
  const tools = level.tools;
  for (let tries = 0; tries < 200 && g.budget > 0; tries++) {
    const k = tools[Math.floor(R() * tools.length)];
    if (TOOLS[k].cost > g.budget) continue;
    // favour cells near the routes mice would take
    const routes = g.previewRoutes().flatMap((x) => x.path);
    let c, r;
    if (routes.length && R() < 0.75) { ({ c, r } = cellOf(routes[Math.floor(R() * routes.length)])); }
    else { c = Math.floor(R() * COLS); r = Math.floor(R() * ROWS); }
    if (!g.place(k, c, r)) out.push([k, c, r]);
  }
  return out;
}

if (process.argv[1].endsWith("sim.mjs")) main();
function main() {
const only = process.argv[2] ? [Number(process.argv[2]) - 1] : LEVELS.map((_, i) => i);
for (const li of only) {
  const level = LEVELS[li];
  const none = play(level, []);
  const R = rnd(li + 11);
  let best = null, wins = 0;
  const N = 400;
  for (let n = 0; n < N; n++) {
    const plan = randomPlan(level, R);
    let w = 0, stars = 0;
    for (let s = 1; s <= 3; s++) { const g = play(level, plan, { seed: s }); if (g.phase === 'won') { w++; stars += g.stars(); } }
    if (w === 3) wins++;
    const score = w * 10 + stars;
    if (!best || score > best.score) best = { score, plan, w, stars };
  }
  // the best plan again with a slower, clumsier player
  let slow = 0;
  for (let s = 1; s <= 10; s++) if (play(level, best.plan, { seed: s, sigma: 0.12, aim: 0.3 }).phase === 'won') slow++;
  console.log(`${li + 1}. ${level.name.padEnd(18)} no plan: ${none.phase.padEnd(4)}  random plans won ${(100 * wins / N).toFixed(0).padStart(3)}%  best plan stars ${(best.stars / 3).toFixed(1)}  slow player with best plan ${slow}/10`);
}
}
