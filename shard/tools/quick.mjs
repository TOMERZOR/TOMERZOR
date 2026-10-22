import { rng, composeLevel } from './pieces.mjs';
import { stable, solve } from './solver.mjs';
for (let w = 0; w < 5; w++) {
  let ok = 0, unst = 0, uns = 0, t0 = performance.now();
  for (let seed = 1; seed <= 8; seed++) {
    const r = rng(seed * 7919 + w * 104729);
    const lv = composeLevel(r, w, r.int(1, 3));
    if (!lv) continue;
    if (!stable(lv)) { unst++; continue; }
    const s = solve(lv);
    if (!s) { uns++; continue; }
    ok++;
    console.log(`w${w} s${seed} ${lv.pieces.join('+')} par${s.par} win${(s.winFrac*100).toFixed(0)}% hit${(s.firstHitFrac*100).toFixed(0)}% combo${s.maxCombo} glass${s.glass} sims${s.sims}`);
  }
  console.log(`world ${w}: ok ${ok} unstable ${unst} unsolved ${uns} ${(performance.now()-t0|0)}ms`);
}
