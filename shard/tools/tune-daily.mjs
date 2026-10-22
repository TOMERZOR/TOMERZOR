// Daily puzzles keep streaks alive, so they must be clearable: give each one the fewest spare balls
// that let the average-player bot clear it at least half the time (up to par + 3), and drop the
// few that stay below 30%. usage: node tune-daily.mjs
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const TRIALS = 8;
const path = new URL('../js/levels.js', import.meta.url).pathname;

if (!isMainThread) {
  const { playOnce } = await import('./playtest-bot.mjs');
  const { rng } = await import('./pieces.mjs');
  parentPort.on('message', ({ i, lv }) => {
    let best = null;
    for (let extra = 1; extra <= 3; extra++) {
      const L = { ...lv, balls: lv.par + extra };
      let wins = 0;
      for (let t = 0; t < TRIALS; t++) if (playOnce(L, rng(5000 + i * 61 + t * 11)).won) wins++;
      best = { balls: L.balls, clear: wins / TRIALS };
      if (best.clear >= 0.5) break;
    }
    parentPort.postMessage({ i, ...best });
  });
} else {
  const mod = await import(path + '?t=' + Date.now());
  const LEVELS = mod.LEVELS, DAILY = mod.DAILY;
  const res = new Map();
  await new Promise((resolve) => {
    let next = 0, done = 0;
    const ws = [];
    for (let k = 0; k < Math.max(1, os.cpus().length); k++) {
      const w = new Worker(fileURLToPath(import.meta.url));
      ws.push(w);
      const feed = () => { if (next < DAILY.length) { const i = next++; w.postMessage({ i, lv: DAILY[i] }); } };
      w.on('message', (m) => { res.set(m.i, m); if (++done === DAILY.length) { ws.forEach((x) => x.terminate()); resolve(); } else feed(); });
      feed();
    }
  });
  const kept = [];
  DAILY.forEach((d, i) => { const r = res.get(i); if (r.clear >= 0.3) kept.push({ ...d, balls: r.balls, clear: r.clear }); });
  kept.forEach((d, i) => { d.id = `d-${i}`; });
  const avg = kept.reduce((s, d) => s + d.clear, 0) / kept.length;
  console.log(`daily: kept ${kept.length}/${DAILY.length}, average-player clear ${Math.round(avg * 100)}%, balls par+${[1, 2, 3].map((x) => kept.filter((d) => d.balls - d.par === x).length).join('/')}`);
  const head = readFileSync(path, 'utf8').split('\n')[0];
  writeFileSync(path, `${head}\nexport const LEVELS = ${JSON.stringify(LEVELS)};\nexport const DAILY = ${JSON.stringify(kept)};\n`);
}
