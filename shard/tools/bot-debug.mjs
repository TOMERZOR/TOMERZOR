import * as planck from 'planck';
import { createSim } from '../js/engine.js';
import { LEVELS } from '../js/levels.js';
const lv = LEVELS[+(process.argv[2] || 5)];
console.log(lv.id, 'par', lv.par, 'balls', lv.balls, 'glass', lv.objects.filter(o => o.t === 'glass').length, 'proof', lv.proof);
const sim = createSim(planck, lv);
for (let i = 0; i < 12; i++) sim.step();
let shots = 0;
for (let step = 0; step < 6000; step++) {
  if (sim.st.won || sim.st.lost) { console.log('end at step', step, 'won', sim.st.won, 'lost', sim.st.lost, 'glass', sim.st.glass, 'balls', sim.st.balls); break; }
  if (sim.st.balls > 0 && sim.st.live === 0 && sim.st.quietSteps > 15) {
    const a = (60 + shots * 15);
    sim.fire(a * Math.PI / 180); shots++;
    console.log('step', step, 'fire', a, 'glass', sim.st.glass, 'balls left', sim.st.balls);
  }
  sim.step();
}
