// Generates every campaign and daily level, each with a robust solver proof.
// usage: node gen-levels.mjs [--pool 44] [--daily 100] [--out ../js/levels.js]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { rng, composeLevel } from './pieces.mjs';
import { stable, solve } from './solver.mjs';
import { TUTORIAL } from './tutorial.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const POOL = +(args.pool || 44);
const DAILY = +(args.daily || 100);
const OUT = args.out || new URL('../js/levels.js', import.meta.url).pathname;
const PER_WORLD = +(args.per || 24);

function evaluate(job) {
  const r = rng(job.seed);
  const lv = composeLevel(r, job.world, job.n, job.minGlass || 3, r.chance(0.3));
  if (!lv) return null;
  if (!stable(lv)) return null;
  const sol = solve(lv, { maxDepth: 3, beam: 5 });
  if (!sol) return null;
  if (sol.firstHitFrac < 0.06) return null;
  if (job.daily && sol.par < 2) return null;
  if (!job.easyOk && sol.par === 1 && sol.winFrac > 0.45) return null;
  return { ...lv, sol, seed: job.seed, world: job.world };
}

if (!isMainThread) {
  parentPort.on('message', (job) => {
    let res = null;
    try { res = evaluate(job); } catch (e) { res = null; }
    parentPort.postMessage({ job, res });
  });
} else {
  const N = Math.max(1, os.cpus().length);
  const workers = [];
  const pools = [[], [], [], [], []];
  const daily = [];
  let seed = 1000;
  let attempts = 0, t0 = Date.now();

  function nextJob() {
    for (let w = 0; w < 5; w++) {
      if (pools[w].length < POOL) {
        const k = pools[w].length;
        const f = k / POOL;
        const n = f < 0.2 ? (seed % 2 ? 1 : 2) : f < 0.55 ? 2 + (seed % 2) : 2 + (seed % 3);
        const minGlass = f < 0.2 ? 3 : f < 0.55 ? 5 : 7;
        return { world: w, seed: seed++ * 2654435761 % 4294967296, n, minGlass, easyOk: w === 0 && k < POOL * 0.3 };
      }
    }
    if (daily.length < DAILY) return { world: seed % 5, seed: seed++ * 2246822519 % 4294967296, n: 2 + (seed % 2), minGlass: 6, daily: true };
    return null;
  }
  const done = () => pools.every((p) => p.length >= POOL) && daily.length >= DAILY;

  await new Promise((resolve) => {
    let active = 0;
    for (let i = 0; i < N; i++) {
      const wk = new Worker(fileURLToPath(import.meta.url));
      workers.push(wk);
      const feed = () => {
        const j = nextJob();
        if (!j) { if (--active === 0) resolve(); return; }
        wk.postMessage(j);
      };
      wk.on('message', ({ job, res }) => {
        attempts++;
        if (res) {
          if (job.daily) { if (daily.length < DAILY) daily.push(res); }
          else if (pools[job.world].length < POOL) pools[job.world].push(res);
        }
        if (attempts % 10 === 0) {
          const el = ((Date.now() - t0) / 1000) | 0;
          console.log(`[${el}s] attempts ${attempts} pools ${pools.map((p) => p.length).join('/')} daily ${daily.length}`);
        }
        if (done()) { if (--active === 0) resolve(); return; }
        feed();
      });
      active++;
      feed();
    }
  });
  for (const w of workers) w.terminate();

  // ---- build the campaign with a difficulty curve ----
  const diff = (l) => l.sol.par * 1.0 + (1 - l.sol.winFrac) * 0.9 + l.sol.glass * 0.035 - l.sol.firstHitFrac * 0.4;
  const campaign = [];
  for (let w = 0; w < 5; w++) {
    const pool = pools[w].sort((a, b) => diff(a) - diff(b));
    const used = new Set();
    const picked = [];
    const per = Math.min(PER_WORLD, pool.length);
    for (let i = 0; i < per; i++) {
      let q = Math.pow(i / Math.max(1, per - 1), 1.05);
      if (i % 5 === 4) q -= 0.18; // breather
      if (i === per - 1) q = 1;
      let idx = Math.round(Math.max(0, Math.min(1, q)) * (pool.length - 1));
      let best = -1, bd = 1e9;
      for (let k = 0; k < pool.length; k++) {
        if (used.has(k)) continue;
        let d = Math.abs(k - idx);
        if (picked.length && pool[k].pieces[0] === picked[picked.length - 1].pieces[0]) d += 2.5;
        if (d < bd) { bd = d; best = k; }
      }
      used.add(best);
      picked.push(pool[best]);
    }
    // keep monotone-ish ordering inside the curve except breathers
    picked.forEach((l, i) => campaign.push(pack(l, w, i)));
  }
  // tutorial replaces the first levels of Dawn
  TUTORIAL.forEach((t, i) => {
    if (!stable(t)) throw new Error('tutorial ' + i + ' unstable');
    const sol = solve(t, { maxDepth: 3, beam: 5 });
    if (!sol) throw new Error('tutorial ' + i + ' unsolved');
    console.log('tutorial', i + 1, 'par', sol.par, 'win', sol.winFrac.toFixed(2), 'proof', sol.proof.join(','));
    campaign[i] = pack({ ...t, sol }, 0, i);
  });

  const dailyOut = daily.map((l, i) => pack(l, l.world, i, true));
  const src = `// Generated by tools/gen-levels.mjs. Every level carries a solver proof (aim angles in degrees).\n` +
    `export const LEVELS = ${JSON.stringify(campaign)};\n` +
    `export const DAILY = ${JSON.stringify(dailyOut)};\n`;
  writeFileSync(OUT, src);
  const stats = campaign.map((l) => `${l.id} par${l.par} balls${l.balls} glass${l.objects.filter((o) => o.t === 'glass').length} win${Math.round(l.win * 100)}% ${l.pieces?.join('+') || 'tutorial'}`);
  writeFileSync(new URL('./levels-report.txt', import.meta.url), stats.join('\n') + '\n');
  console.log(`wrote ${campaign.length} levels + ${dailyOut.length} daily in ${((Date.now() - t0) / 1000) | 0}s, ${attempts} attempts`);
}

function pack(l, w, i, isDaily) {
  const extra = isDaily ? 1 : (w === 0 && i < 8 ? 2 : 1);
  return {
    id: isDaily ? `d-${i}` : `w${w}-${i + 1}`,
    world: w,
    launcher: l.launcher,
    par: l.sol.par,
    balls: l.sol.par + extra,
    proof: l.sol.proof,
    win: Math.round(l.sol.winFrac * 1000) / 1000,
    pieces: l.pieces,
    objects: l.objects,
  };
}
