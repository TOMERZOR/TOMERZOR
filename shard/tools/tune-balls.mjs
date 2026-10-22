// Calibrates the campaign with the average-player bot (it aims with the same guide line players see):
// 1. resets ball counts to par + 1 (par + 2 early in Dawn),
// 2. adds a spare ball where the bot clears less often than the target (up to par + 3),
// 3. re-orders each world from easiest to hardest by measured clear rate, with breathers.
// Parallel over CPU cores. usage: node tune-balls.mjs [trials=8]
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const TRIALS = +(process.argv[2] || 8);
const path = new URL('../js/levels.js', import.meta.url).pathname;
const PER_WORLD = 24, TUTORIAL = 3;

if (!isMainThread) {
  const { playOnce } = await import('./playtest-bot.mjs');
  const { rng } = await import('./pieces.mjs');
  parentPort.on('message', ({ i, lv }) => {
    let wins = 0;
    for (let t = 0; t < TRIALS; t++) if (playOnce(lv, rng(7000 + i * 131 + t * 17 + lv.balls * 3)).won) wins++;
    parentPort.postMessage({ i, clear: wins / TRIALS });
  });
} else {
  const mod = await import(path + '?t=' + Date.now());
  let LEVELS = mod.LEVELS;
  const DAILY = mod.DAILY;
  const run = async (list) => {
    const N = Math.max(1, os.cpus().length);
    const out = new Map();
    if (!list.length) return out;
    await new Promise((resolve) => {
      let next = 0, done = 0;
      const ws = [];
      for (let k = 0; k < N; k++) {
        const w = new Worker(fileURLToPath(import.meta.url), { argv: [String(TRIALS)] });
        ws.push(w);
        const feed = () => { if (next < list.length) { const i = list[next++]; w.postMessage({ i, lv: LEVELS[i] }); } };
        w.on('message', ({ i, clear }) => { out.set(i, clear); if (++done === list.length) { ws.forEach((x) => x.terminate()); resolve(); } else feed(); });
        feed();
      }
    });
    return out;
  };
  const target = (i) => {
    const w = Math.floor(i / PER_WORLD), k = i % PER_WORLD;
    if (w === 0) return k < 12 ? 0.6 : 0.45;
    return 0.35;
  };
  LEVELS.forEach((l, i) => { l.balls = l.par + (l.world === 0 && i % PER_WORLD < 8 ? 2 : 1); });
  let clear = await run(LEVELS.map((_, i) => i));
  for (let round = 0; round < 2; round++) {
    const todo = LEVELS.map((_, i) => i).filter((i) => clear.get(i) < target(i) && LEVELS[i].balls < LEVELS[i].par + 3);
    if (!todo.length) break;
    for (const i of todo) LEVELS[i].balls++;
    const again = await run(todo);
    for (const [i, c] of again) clear.set(i, c);
    console.log(`round ${round + 1}: +1 ball on ${todo.length} levels`);
  }
  // re-order each world by measured clear rate (easiest first), with a breather every 5th level
  const out = [];
  for (let w = 0; w < 5; w++) {
    const idx = LEVELS.map((_, i) => i).filter((i) => LEVELS[i].world === w);
    const fixed = w === 0 ? idx.slice(0, TUTORIAL) : [];
    const rest = idx.filter((i) => !fixed.includes(i)).sort((a, b) => clear.get(b) - clear.get(a));
    const ordered = [];
    const pool = [...rest];
    while (pool.length) {
      const pos = fixed.length + ordered.length + 1;
      // breather: every 5th slot takes an easy level from later in the queue
      if (pos % 5 === 0 && pool.length > 3) ordered.push(pool.splice(Math.floor(pool.length * 0.15), 1)[0]);
      else ordered.push(pool.shift());
    }
    [...fixed, ...ordered].forEach((i, k) => out.push({ ...LEVELS[i], id: `w${w}-${k + 1}`, clear: Math.round(clear.get(i) * 100) / 100 }));
  }
  for (let w = 0; w < 5; w++) {
    const ws = out.filter((l) => l.world === w);
    console.log(`world ${w + 1}: average-player clear ${Math.round(ws.reduce((s, l) => s + l.clear, 0) / ws.length * 100)}% | first five ${ws.slice(0, 5).map((l) => Math.round(l.clear * 100)).join(' ')} | last five ${ws.slice(-5).map((l) => Math.round(l.clear * 100)).join(' ')} | balls par+${[1, 2, 3].map((d) => ws.filter((l) => l.balls - l.par === d).length).join('/')}`);
  }
  const head = readFileSync(path, 'utf8').split('\n')[0];
  writeFileSync(path, `${head}\nexport const LEVELS = ${JSON.stringify(out)};\nexport const DAILY = ${JSON.stringify(DAILY)};\n`);
  console.log('levels.js updated: tuned ball counts and difficulty order');
}
