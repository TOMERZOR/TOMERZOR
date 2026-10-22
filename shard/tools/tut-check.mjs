import { TUTORIAL } from './tutorial.mjs';
import { stable, solve } from './solver.mjs';
TUTORIAL.forEach((t, i) => { const st = stable(t); const s = st && solve(t); console.log(i + 1, 'stable', st, s && { par: s.par, win: s.winFrac.toFixed(2), hit: s.firstHitFrac.toFixed(2), proof: s.proof, combo: s.maxCombo }); });
