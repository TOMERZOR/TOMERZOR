import { writeFileSync } from 'node:fs';
import { TUTORIAL } from './tutorial.mjs';
import { solve } from './solver.mjs';
const L = TUTORIAL.map((t, i) => { const s = solve(t); return { id: `w0-${i + 1}`, world: 0, launcher: t.launcher, par: s.par, balls: s.par + 2, proof: s.proof, win: s.winFrac, pieces: t.pieces, objects: t.objects }; });
const more = [];
for (let w = 0; w < 5; w++) for (let k = 0; k < 24; k++) more.push({ ...L[k % 3], id: `w${w}-${k + 1}`, world: w });
for (let i = 0; i < 3; i++) more[i] = L[i];
writeFileSync('../js/levels.js', `export const LEVELS = ${JSON.stringify(more)};\nexport const DAILY = ${JSON.stringify(L)};\n`);
console.log('dev levels written');
