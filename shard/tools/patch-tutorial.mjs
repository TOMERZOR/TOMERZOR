// Re-solves the hand-made tutorial levels and swaps them into js/levels.js (campaign levels 1-3).
import { readFileSync, writeFileSync } from 'node:fs';
import { TUTORIAL } from './tutorial.mjs';
import { stable, solve } from './solver.mjs';
const path = new URL('../js/levels.js', import.meta.url).pathname;
const mod = await import(path + '?t=' + Date.now());
const LEVELS = mod.LEVELS, DAILY = mod.DAILY;
TUTORIAL.forEach((t, i) => {
  if (!stable(t)) throw new Error('tutorial ' + (i + 1) + ' unstable');
  const s = solve(t, { maxDepth: 3, beam: 5 });
  if (!s) throw new Error('tutorial ' + (i + 1) + ' unsolved');
  LEVELS[i] = { id: `w0-${i + 1}`, world: 0, launcher: t.launcher, par: s.par, balls: s.par + 2, proof: s.proof, win: Math.round(s.winFrac * 1000) / 1000, pieces: t.pieces, objects: t.objects };
  console.log('tutorial', i + 1, 'par', s.par, 'proof', s.proof.join(','));
});
const head = readFileSync(path, 'utf8').split('\n')[0];
writeFileSync(path, `${head}\nexport const LEVELS = ${JSON.stringify(LEVELS)};\nexport const DAILY = ${JSON.stringify(DAILY)};\n`);
console.log('levels.js updated');
