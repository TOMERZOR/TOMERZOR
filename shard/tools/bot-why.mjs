// Why does the average-player bot lose? Inspect what's left when it runs out of balls.
import * as planck from 'planck';
import { createSim, previewPath } from '../js/engine.js';
import { LEVELS } from '../js/levels.js';
import { rng } from './pieces.mjs';
const DEG = Math.PI / 180;
let games = 0, losses = 0, leftTotal = 0, visibleLeft = 0, noTarget = 0, shots = 0, wasted = 0;
for (const [i, lv] of LEVELS.entries()) {
  for (let t = 0; t < 3; t++) {
    const r = rng(77 + i * 13 + t);
    const sim = createSim(planck, lv);
    for (let k = 0; k < 12; k++) sim.step();
    games++;
    for (let step = 0; step < 6000; step++) {
      if (sim.st.won || sim.st.lost) break;
      if (sim.st.balls > 0 && sim.st.live === 0 && sim.st.quietSteps > 15) {
        const good = [];
        for (let a = 8; a <= 172; a += 2) { const p = previewPath(planck, sim, a * DEG); if (p.hit && (p.hit.kind === 'glass' || p.hit.kind === 'bomb')) good.push(a); }
        if (!good.length) noTarget++;
        const g0 = sim.st.glass;
        const a = good.length ? good[Math.floor(r() * good.length)] : 20 + r() * 140;
        sim.fire((a + (r() - 0.5) * 2) * DEG);
        shots++;
        // measure what this shot broke
        let s2 = 0; while (s2++ < 600 && !(sim.st.live === 0 && sim.st.quietSteps > 15) && !sim.st.won) sim.step();
        if (sim.st.glass === g0) wasted++;
        continue;
      }
      sim.step();
    }
    if (!sim.st.won) {
      losses++; leftTotal += sim.st.glass;
      // how many of the leftovers can the player see right now?
      const seen = new Set();
      for (let a = 8; a <= 172; a += 1) { const p = previewPath(planck, sim, a * DEG); if (p.hit && p.hit.kind === 'glass') seen.add(Math.round(p.pts[p.pts.length - 1][0] * 2) + ',' + Math.round(p.pts[p.pts.length - 1][1] * 2)); }
      if (seen.size) visibleLeft++;
    }
  }
}
console.log({ games, losses, avgLeftWhenLost: (leftTotal / losses).toFixed(1), lossesWithVisibleGlass: visibleLeft, shots, shotsThatBrokeNothing: wasted, shotsWithNoVisibleTarget: noTarget });
