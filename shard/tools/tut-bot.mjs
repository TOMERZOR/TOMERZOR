import { TUTORIAL } from './tutorial.mjs';
import { stable, solve } from './solver.mjs';
import { playOnce } from './playtest-bot.mjs';
import { rng } from './pieces.mjs';
const which = process.argv[2] ? [+process.argv[2]] : [0, 1, 2];
for (const i of which) {
  const t = TUTORIAL[i];
  const s = solve(t);
  const lv = { ...t, par: s.par, balls: s.par + 2 };
  let wins = 0; const N = 20;
  for (let k = 0; k < N; k++) if (playOnce(lv, rng(500 + k)).won) wins++;
  console.log(`tutorial ${i + 1}: stable ${stable(t)} par ${s.par} win ${(s.winFrac * 100).toFixed(0)}% proof ${s.proof} | average-player clears ${Math.round(wins / N * 100)}% (balls ${lv.balls})`);
}
