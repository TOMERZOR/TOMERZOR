// Replaces campaign levels the average player almost never clears (clear < 15%) with new levels
// that are solver-proven AND cleared by the average-player bot at least 30% of the time.
// usage: node replace-hard.mjs
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { rng, composeLevel } from './pieces.mjs';
import { stable, solve } from './solver.mjs';

const path = new URL('../js/levels.js', import.meta.url).pathname;
const TRIALS = 8;
const argv = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const THRESHOLD = +(argv.threshold || 0.15);
const DAILY_TARGET = +(argv.daily || 0);
const SEED_BASE = +(argv.seed || 900000); // use a fresh base per run, or the same candidates come back

if (!isMainThread) {
  const { playOnce } = await import('./playtest-bot.mjs');
  parentPort.on('message', (job) => {
    let res = null;
    try {
      const r = rng(job.seed);
      const lv = composeLevel(r, job.world, job.n, job.minGlass, r.chance(0.3));
      if (lv && stable(lv)) {
        const sol = solve(lv, { maxDepth: 3, beam: 5 });
        if (sol && sol.firstHitFrac >= 0.06 && (!job.daily || sol.par >= 2)) {
          const need = job.daily ? 0.5 : 0.3, maxExtra = job.daily ? 3 : 2;
          for (let extra = 1; extra <= maxExtra && !res; extra++) {
            const L = { ...lv, par: sol.par, balls: sol.par + extra };
            let wins = 0;
            for (let t = 0; t < TRIALS; t++) if (playOnce(L, rng(job.seed + t * 7)).won) wins++;
            if (wins / TRIALS >= need) res = { ...lv, sol, balls: L.balls, clear: wins / TRIALS };
          }
        }
      }
    } catch (e) { res = null; }
    parentPort.postMessage({ job, res });
  });
} else {
  const mod = await import(path + '?t=' + Date.now());
  const LEVELS = mod.LEVELS, DAILY = mod.DAILY;
  const hard = LEVELS.map((l, i) => i).filter((i) => i >= 3 && (LEVELS[i].clear ?? 1) < THRESHOLD);
  const dailyNeed = Math.max(0, DAILY_TARGET - DAILY.length);
  const dailyFound = [];
  const need = [0, 0, 0, 0, 0];
  for (const i of hard) need[LEVELS[i].world]++;
  console.log('replacing', hard.length, 'levels; per world', need.join(' '), '| new daily needed', dailyNeed);
  const found = [[], [], [], [], []];
  let seed = SEED_BASE, attempts = 0;
  const t0 = Date.now();
  const nextJob = () => {
    for (let w = 0; w < 5; w++) if (found[w].length < need[w]) {
      seed++;
      return { world: w, seed: (seed * 2654435761) % 4294967296, n: 2 + (seed % 2), minGlass: 5 + (seed % 3) };
    }
    if (dailyFound.length < dailyNeed) { seed++; return { world: seed % 5, daily: true, seed: (seed * 2246822519) % 4294967296, n: 2 + (seed % 2), minGlass: 6 }; }
    return null;
  };
  await new Promise((resolve) => {
    let active = 0;
    for (let k = 0; k < Math.max(1, os.cpus().length); k++) {
      const wk = new Worker(fileURLToPath(import.meta.url));
      const feed = () => { const j = nextJob(); if (!j) { wk.terminate(); if (--active === 0) resolve(); return; } wk.postMessage(j); };
      wk.on('message', ({ job, res }) => {
        attempts++;
        if (res && job.daily) { if (dailyFound.length < dailyNeed) dailyFound.push({ ...res, world: job.world }); }
        else if (res && found[job.world].length < need[job.world]) found[job.world].push(res);
        if (attempts % 10 === 0) console.log(`[${((Date.now() - t0) / 1000) | 0}s] attempts ${attempts} found ${found.map((f) => f.length).join('/')} daily ${dailyFound.length}/${dailyNeed}`);
        feed();
      });
      active++;
      feed();
    }
  });
  for (const i of hard) {
    const w = LEVELS[i].world;
    const n = found[w].shift();
    LEVELS[i] = { id: LEVELS[i].id, world: w, launcher: n.launcher, par: n.sol.par, balls: n.balls, proof: n.sol.proof, win: Math.round(n.sol.winFrac * 1000) / 1000, pieces: n.pieces, objects: n.objects, clear: n.clear };
  }
  for (const n of dailyFound) DAILY.push({ id: `d-${DAILY.length}`, world: n.world, launcher: n.launcher, par: n.sol.par, balls: n.balls, proof: n.sol.proof, win: Math.round(n.sol.winFrac * 1000) / 1000, pieces: n.pieces, objects: n.objects, clear: n.clear });
  const head = readFileSync(path, 'utf8').split('\n')[0];
  writeFileSync(path, `${head}\nexport const LEVELS = ${JSON.stringify(LEVELS)};\nexport const DAILY = ${JSON.stringify(DAILY)};\n`);
  console.log(`added ${dailyFound.length} daily levels`);
  console.log(`replaced ${hard.length} levels in ${((Date.now() - t0) / 1000) | 0}s (${attempts} attempts)`);
}
