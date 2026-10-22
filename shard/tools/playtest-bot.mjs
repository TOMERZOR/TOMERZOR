// "Average player" bot: aims only at glass it can see along the preview line, with hand
// error, no bank-shot planning. Estimates how often a level is cleared within its ball budget.
// usage: node playtest-bot.mjs [trials=6]
import * as planck from 'planck';
import { createSim, previewPath } from '../js/engine.js';
import { LEVELS } from '../js/levels.js';
import { rng } from './pieces.mjs';

const TRIALS = +(process.argv[2] || 6);
const DEG = Math.PI / 180;

function playOnce(level, r) {
  const sim = createSim(planck, level);
  for (let i = 0; i < 12; i++) sim.step();
  let continues = 0;
  for (let guard = 0; guard < 4000; guard++) {
    if (sim.st.won) return { won: true, used: sim.st.used, continues };
    if (sim.st.lost) return { won: false, used: sim.st.used, continues };
    if (sim.st.balls > 0 && sim.st.live === 0 && sim.st.quietSteps > 15) {
      // look along a fan of angles, keep the ones whose first contact is glass or a bomb
      const good = [];
      for (let a = 8; a <= 172; a += 2) {
        const p = previewPath(planck, sim, a * DEG);
        if (p.hit && (p.hit.kind === 'glass' || p.hit.kind === 'bomb')) good.push(a);
      }
      const pickA = good.length ? good[Math.floor(r() * good.length)] : 20 + r() * 140;
      sim.fire((pickA + (r() - 0.5) * 2) * DEG);
    }
    sim.step();
  }
  return { won: sim.st.won, used: sim.st.used, continues };
}

const rows = [];
for (const [i, lv] of LEVELS.entries()) {
  let wins = 0, stars3 = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = rng(1000 + i * 97 + t);
    const res = playOnce(lv, r);
    if (res.won) { wins++; if (res.used <= lv.par) stars3++; }
  }
  rows.push({ id: lv.id, world: lv.world, par: lv.par, balls: lv.balls, clear: wins / TRIALS, three: stars3 / TRIALS });
}
for (let w = 0; w < 5; w++) {
  const ws = rows.filter((x) => x.world === w);
  const avg = ws.reduce((s, x) => s + x.clear, 0) / ws.length;
  const hard = ws.filter((x) => x.clear === 0).map((x) => x.id);
  console.log(`world ${w}: average clear ${(avg * 100).toFixed(0)}%, 3-star ${(ws.reduce((s, x) => s + x.three, 0) / ws.length * 100).toFixed(0)}%, never cleared: ${hard.length ? hard.join(' ') : 'none'}`);
}
console.log(JSON.stringify(rows.map((x) => [x.id, Math.round(x.clear * 100)])));
