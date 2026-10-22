// Clear rate per world for a direct-only player vs one who also banks off one wall.
import { LEVELS } from '../js/levels.js';
import { playOnce } from './playtest-bot.mjs';
import { rng } from './pieces.mjs';
const N = +(process.argv[2] || 4);
for (const bounces of [0, 1]) {
  const per = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0];
  for (const [i, lv] of LEVELS.entries()) {
    let w = 0;
    for (let t = 0; t < N; t++) if (playOnce(lv, rng(31 + i * 7 + t), { bounces }).won) w++;
    per[lv.world] += w / N; cnt[lv.world]++;
  }
  console.log(`${bounces ? 'banks off one wall' : 'direct shots only '}: ` + per.map((v, w) => `W${w + 1} ${Math.round(v / cnt[w] * 100)}%`).join('  '));
}
