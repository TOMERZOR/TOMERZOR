// "Average player" bot: aims only at glass it can see along the preview line, with hand
// error, no bank-shot planning. Estimates how often a level is cleared within its ball budget.
// usage: node playtest-bot.mjs [trials=6]
import * as planck from 'planck';
import { createSim, previewPath, ghostPath } from '../js/engine.js';
import { LEVELS } from '../js/levels.js';
import { rng } from './pieces.mjs';
import { runShots } from './solver.mjs';

// usage: node playtest-bot.mjs [trials=6] [--look 3] [--range 0:120]
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TRIALS = +(argv[0] && !argv[0].startsWith('--') ? argv[0] : 6);
const LOOK = +flag('look', 1);
const [R0, R1] = flag('range', '0:' + LEVELS.length).split(':').map(Number);
const DEG = Math.PI / 180;

// Trace a shot like a player imagines it: ballistic flight to the first contact and, when that is
// a wall, ceiling, shelf or pad, one mirror bounce to the next contact.
function trace(sim, angle, bounces) {
  const { Vec2 } = planck;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let x = sim.launcherX + dx * 1.08, y = 0.42 + dy * 1.08;
  let vx = dx * sim.speed, vy = dy * sim.speed;
  const dt = 1 / 30;
  for (let b = 0; b <= bounces; b++) {
    let hit = null;
    for (let t = 0; t < 1.8 && !hit; t += dt) {
      const nx = x + vx * dt, ny = y + vy * dt - 5 * dt * dt;
      sim.world.rayCast(Vec2(x, y), Vec2(nx, ny), (fix, point, normal, fraction) => {
        const e = fix.getBody().getUserData();
        if (!e || e.kind === 'shard' || e.kind === 'ball') return -1;
        if (!hit || fraction < hit.f) hit = { f: fraction, kind: e.kind, px: point.x, py: point.y, nx: normal.x, ny: normal.y };
        return fraction;
      });
      if (!hit) { x = nx; y = ny; vy -= 10 * dt; }
    }
    if (!hit) return null;
    if (hit.kind === 'glass' || hit.kind === 'bomb') return hit;
    if (!['frame', 'shelf', 'pad', 'mover', 'launcher'].includes(hit.kind)) return null;
    // mirror bounce
    const vn = vx * hit.nx + vy * hit.ny;
    vx -= 1.7 * vn * hit.nx; vy -= 1.7 * vn * hit.ny;
    x = hit.px + hit.nx * 0.31; y = hit.py + hit.ny * 0.31;
  }
  return null;
}

// look > 1: a thoughtful player. Before each shot it weighs `look` of the shots the guide offers, plays each out
// in its head (the real engine, from the shots taken so far) and takes the one that leaves the least glass, then
// fires it with the same hand error
export function playOnce(level, r, opts = {}) {
  const bounces = opts.bounces ?? 1;
  const look = opts.look ?? 1;
  const history = [];
  const sim = createSim(planck, level);
  for (let i = 0; i < 12; i++) sim.step();
  for (let guard = 0; guard < 6000; guard++) {
    if (sim.st.won) return { won: true, used: sim.st.used };
    if (sim.st.lost) return { won: false, used: sim.st.used };
    if (sim.st.balls > 0 && sim.st.live === 0 && sim.st.quietSteps > 15) {
      // aim where the on-screen guide shows glass: direct hits first, then one-bounce shots. Locked glass
      // is no target; while a key glass stands, a shot at it comes first, as the coach line says
      let good = [], bank = [], key = [], keyBank = [];
      const target = (h) => h && (h.kind === 'bomb' || (h.kind === 'glass' && !h.lock));
      for (let a = 8; a <= 172; a += 2) {
        const p = ghostPath(planck, sim, a * DEG, bounces);
        if (p.hit?.key) key.push(a);
        else if (target(p.hit)) good.push(a);
        else if (p.hit2?.key) keyBank.push(a);
        else if (target(p.hit2)) bank.push(a);
      }
      if (key.length) good = key;
      else if (keyBank.length) good = keyBank;
      else if (!good.length) good = bank;
      let pickA = good.length ? good[Math.floor(r() * good.length)] : 20 + r() * 140;
      if (look > 1 && good.length > 1) {
        const pool = good.slice(), seen = [];
        while (seen.length < look && pool.length) seen.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
        let best = Infinity;
        for (const a of seen) {
          const res = runShots(level, [...history, { a: a * DEG }]);
          const left = res.won ? -1 : res.glass;
          if (left < best) { best = left; pickA = a; }
        }
      }
      const fired = (pickA + (r() - 0.5) * 2) * DEG;
      history.push({ a: fired });
      sim.fire(fired);
    }
    sim.step();
  }
  return { won: sim.st.won, used: sim.st.used };
}

const rows = [];
if (process.argv[1].endsWith('playtest-bot.mjs')) for (const [i, lv] of LEVELS.entries()) {
  if (i < R0 || i >= R1) continue;
  let wins = 0, stars3 = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = rng(1000 + i * 97 + t);
    const res = playOnce(lv, r, { look: LOOK });
    if (res.won) { wins++; if (res.used <= lv.par) stars3++; }
  }
  rows.push({ id: lv.id, world: lv.world, par: lv.par, balls: lv.balls, clear: wins / TRIALS, three: stars3 / TRIALS });
}
for (let w = 0; w < 5 && rows.length; w++) {
  const ws = rows.filter((x) => x.world === w);
  const avg = ws.reduce((s, x) => s + x.clear, 0) / ws.length;
  const hard = ws.filter((x) => x.clear === 0).map((x) => x.id);
  console.log(`world ${w}: average clear ${(avg * 100).toFixed(0)}%, 3-star ${(ws.reduce((s, x) => s + x.three, 0) / ws.length * 100).toFixed(0)}%, never cleared: ${hard.length ? hard.join(' ') : 'none'}`);
}
if (rows.length) console.log(JSON.stringify(rows.map((x) => [x.id, Math.round(x.clear * 100)])));
