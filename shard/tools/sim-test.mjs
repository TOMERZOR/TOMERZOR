import * as planck from 'planck';
import { createSim, DT } from '../js/engine.js';
const level = { balls: 3, objects: [
  { t: 'shelf', x: 4.5, y: 6, w: 3, h: 0.25 },
  { t: 'glass', s: 'jar', x: 3.8, y: 6.125 + 0.35, w: 0.55, h: 0.7 },
  { t: 'glass', s: 'bottle', x: 4.5, y: 6.125 + 0.5, w: 0.4, h: 1.0 },
  { t: 'glass', s: 'orb', x: 5.2, y: 6.125 + 0.32, r: 0.32 },
  { t: 'bomb', x: 7.5, y: 0.34, r: 0.34 },
  { t: 'stone', x: 1.5, y: 0.4, w: 0.8, h: 0.8 },
]};
// stability
let sim = createSim(planck, level);
for (let i = 0; i < 240; i++) sim.step();
console.log('stable: glass', sim.st.glass);
let t0 = performance.now(), best = null;
for (let a = 20; a <= 160; a += 1) {
  sim = createSim(planck, level);
  for (let i = 0; i < 10; i++) sim.step();
  sim.fire(a * Math.PI / 180);
  let n = 0;
  for (let i = 0; i < 600 && !sim.st.lost; i++) { const ev = sim.step(); if (sim.st.balls === 0 && sim.st.live === 0 && sim.st.quietSteps > 30) break; }
  const broken = 3 - sim.st.glass;
  if (broken > 0) process.stdout.write(`${a}:${broken} `);
}
console.log('\nms', (performance.now() - t0).toFixed(0));
