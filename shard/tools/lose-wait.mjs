// How long a player waits for "Out of balls": plays every campaign level with misses and near misses and times
// the last shot to the lose, as the engine calls it (the ball has stopped and everything is still) and as the game
// now calls it (the replay that runs ahead shows no glass can change any more: see game.js).
//   node lose-wait.mjs [trials per level]
import * as planck from 'planck';
import { createSim, MIN_ANGLE, MAX_ANGLE, DT } from '../js/engine.js';
import { LEVELS } from '../js/levels.js';

const LOSE_AFTER_SHOT = 60, LOSE_AFTER_GLASS = 45; // as in game.js
const TRIALS = +(process.argv[2] || 6);
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const rows = [];
for (const lv of LEVELS) {
  for (let t = 0; t < TRIALS; t++) {
    const sim = createSim(planck, lv);
    let step = 0, fired = 0, lastShot = 0, lastGlass = -1, lose = -1, won = false;
    // half the plays aim near the proof (near misses that move things), half anywhere
    const near = t % 2 === 0 && lv.proof?.length;
    while (step < 60 * 40) {
      // the next ball goes when the last one is gone and a human beat has passed
      if (fired < lv.balls && sim.st.live === 0 && (fired === 0 || step - lastShot > 40) && sim.st.quietSteps > 10) {
        const a = near ? (lv.proof[Math.min(fired, lv.proof.length - 1)] + (rand() - 0.5) * 16) * Math.PI / 180 : MIN_ANGLE + rand() * (MAX_ANGLE - MIN_ANGLE);
        if (sim.fire(a)) { fired++; lastShot = sim.st.step; }
      }
      const evs = sim.step();
      step++;
      for (const e of evs) {
        if (e.type === 'break' || e.type === 'crack' || e.type === 'unlock') lastGlass = sim.st.step;
        if (e.type === 'win') won = true;
        if (e.type === 'lose') lose = sim.st.step;
      }
      if (won || lose >= 0) break;
    }
    if (won || lose < 0) continue;
    const early = Math.min(lose, Math.max(lastGlass + LOSE_AFTER_GLASS, lastShot + LOSE_AFTER_SHOT));
    rows.push({ id: lv.id, w: lv.world, before: (lose - lastShot) * DT, after: (early - lastShot) * DT });
  }
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const fmt = (a) => `median ${q(a, 0.5).toFixed(2)}s  p90 ${q(a, 0.9).toFixed(2)}s  max ${Math.max(...a).toFixed(2)}s`;
const show = (name, rs) => {
  if (!rs.length) return;
  console.log(`${name.padEnd(8)} n=${String(rs.length).padStart(3)}  before: ${fmt(rs.map((r) => r.before))}  |  now: ${fmt(rs.map((r) => r.after))}`);
};
console.log('last shot to "Out of balls" (the sheet itself follows 0.25 s later)');
show('all', rows);
for (let w = 0; w < 5; w++) show('world ' + (w + 1), rows.filter((r) => r.w === w));
