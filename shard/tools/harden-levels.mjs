// Makes the campaign harder without changing a single layout: some glass becomes frosted (two hits, the ball
// bounces off the first time) and some becomes locked behind a gold key glass. Each level tries variants from
// light to heavy until the "average player" bot (playtest-bot.mjs) clears it about as often as its place in the
// world's curve asks; every variant must stand still at rest and is solved with the real engine for its par and
// a robust proof. Dawn's first twelve levels and the first level of every world stay as they are.
// A level that is far harder than its slot asks before any change (the original calibration, made with a naive bot,
// missed it) gets one more spare ball instead, up to three, when that lands closer.
// usage: node harden-levels.mjs [--base levels-base.js] [--out ../js/levels.js] [--trials 20] [--look 3]
//        [--only w2-7,w3-4 [--keep ../js/levels.js]]   (--keep: levels not in --only come from this file, not the base)
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import * as planck from 'planck';
import { createSim, ghostPath } from '../js/engine.js';
import { stable, solve } from './solver.mjs';
import { playOnce } from './playtest-bot.mjs';
import { rng } from './pieces.mjs';

const DEG = Math.PI / 180;
const PER_WORLD = 24;
// how often the skilled bot (look 3) should clear a level on its first try: from just after a world's opening to
// its last level (the unhardened campaign measured 86-91% on the first halves of Dawn, Mint, Lilac and Ember)
const START = [0.85, 0.8, 0.76, 0.72, 0.68];
const END = [0.62, 0.55, 0.5, 0.46, 0.42];

export function rulesFor(w, i) {
  if (w === 0 && i < 12) return null; // Dawn's first half teaches the game
  if (i === 0) return null;            // a world's first level introduces its own mechanic, nothing else
  return { maxFrost: w === 0 ? 2 : w === 1 ? 3 : 4, lock: w >= 3 || (w === 2 && i >= 6) };
}
export function targetFor(w, i) {
  const i0 = w === 0 ? 12 : 1;
  const f = Math.max(0, (i - i0) / (PER_WORLD - 1 - i0));
  return START[w] + (END[w] - START[w]) * f + (i % 5 === 4 ? 0.12 : 0); // breathers stay breathers
}

// how often the bot clears a level within each ball budget: one run of trials at the level's full budget, and fewer
// balls read off the same runs (the bot plays the same shots whatever it has left, so a win that took n balls is a
// win with any budget of n or more)
function clearCurve(level, balls, trials, seed, look) {
  const used = [];
  for (let t = 0; t < trials; t++) {
    const r = playOnce({ ...level, balls }, rng(seed + t * 7919), { look });
    used.push(r.won ? r.used : Infinity);
  }
  return (b) => used.filter((u) => u <= b).length / trials;
}

// how often the aim guide lands on each glass object: directly (1) or after one bounce (0.4)
function visibility(level) {
  const sim = createSim(planck, { ...level, balls: 0 });
  const objOf = {};
  let id = 3; // entities 1 and 2 are the room and the launcher; every object but a rope adds one, in order
  level.objects.forEach((o, k) => { if (o.t !== 'rope') objOf[id++] = k; });
  const vis = {};
  for (let a = 8; a <= 172; a += 1) {
    const p = ghostPath(planck, sim, a * DEG, 1);
    if (p.hit?.kind === 'glass') vis[objOf[p.hit.id]] = (vis[objOf[p.hit.id]] || 0) + 1;
    else if (p.hit2?.kind === 'glass') vis[objOf[p.hit2.id]] = (vis[objOf[p.hit2.id]] || 0) + 0.4;
  }
  return vis;
}

// variants, roughly from light to heavy. Which piece turns frosted matters more than how many, so single frosts on
// the most-seen, a middling and a little-seen piece come first, then pairs, then lock sets: a visible but less
// obvious piece becomes the key and the most visible others are locked
function candidates(level, rules, r) {
  const glass = level.objects.map((o, k) => (o.t === 'glass' ? k : -1)).filter((k) => k >= 0);
  const vis = visibility(level);
  const order = glass.slice().sort((a, b) => (vis[b] || 0) - (vis[a] || 0) || a - b); // most seen first
  const n = glass.length, out = [], seen = new Set();
  const add = (frost, locks = [], key = -1) => {
    const id = [...frost].sort().join(',') + '|' + [...locks].sort().join(',') + '|' + key;
    if (!seen.has(id)) { seen.add(id); out.push({ frost, locks, key }); }
  };
  const rank = (f) => Math.min(n - 1, Math.round(f * (n - 1)));
  for (const f of [0, 0.5, 1]) add([order[rank(f)]]);
  if (rules.lock && n >= 4) {
    const shown = order.filter((k) => (vis[k] || 0) > 0);
    const pool = shown.slice(Math.floor(shown.length / 2));
    if (pool.length) {
      const key = r.pick(pool);
      const rest = order.filter((k) => k !== key);
      for (const m of [2, 3]) {
        if (m > rest.length - 1) continue;
        add([], rest.slice(0, m), key);
        if (m === 2 && rest.length > 3) add([rest[rest.length - 1]], rest.slice(0, 2), key);
      }
    }
  }
  if (rules.maxFrost >= 2 && n >= 3) {
    add([order[n - 1], order[n - 2]]);
    const m = Math.max(1, rank(0.5));
    add([order[m], order[m - 1]]);
    add([order[0], order[1]]);
  }
  if (rules.maxFrost >= 3 && n >= 5) add(order.slice(0, 3));
  return out.slice(0, 10);
}

function apply(level, c) {
  return {
    ...level,
    objects: level.objects.map((o, k) => {
      if (o.t !== 'glass') return o;
      const n = { ...o };
      if (c.frost.includes(k)) n.hp = 2;
      if (c.locks.includes(k)) n.lock = 1;
      if (k === c.key) n.key = 1;
      return n;
    }),
  };
}

// Each level keeps its own spare balls (the original calibration gave hard levels up to three) or gives up one of
// them, never going below one; and it may take frosted or locked glass. Whatever lands closest to the target wins,
// with a small preference for new glass over a lost ball, so the new mechanics actually show up.
function harden(job) {
  const { lv, w, i, trials, look } = job;
  const rules = rulesFor(w, i);
  const target = targetFor(w, i);
  const seed = 5000 + w * 1000 + i * 37;
  const spare = lv.balls - lv.par;
  const spares = spare > 1 ? [spare, spare - 1] : [spare];
  const baseCurve = clearCurve(lv, lv.par + spare, trials, seed, look);
  const res = { id: lv.id, w, i, target, spare, base: baseCurve(lv.par + spare), tried: [] };
  if (!rules) return { ...res, chosen: lv, clear: res.base, frost: 0, locks: 0 };
  const miss = (cl) => (cl < target ? (target - cl) * 1.3 : cl - target); // too hard costs a little more than too easy
  let best = { level: lv, clear: res.base, d: miss(res.base), frost: 0, locks: 0, glass: false };
  if (res.base <= target + 0.05) return ease();
  const offer = (level, curve, par, frost, locks, glass) => {
    for (const sp of spares) {
      const clear = curve(par + sp);
      const d = miss(clear) - (glass && clear <= res.base - 0.05 ? 0.03 : 0); // new glass is preferred only where it bites
      res.tried.push({ tag: `f${frost}l${locks}s${sp}`, par, clear });
      if (d < best.d) best = { level: { ...level, par, balls: par + sp }, clear, d, frost, locks, glass };
    }
  };
  offer(lv, baseCurve, lv.par, 0, 0, false);
  let tries = 0;
  for (const c of candidates(lv, rules, rng(seed))) {
    if ((best.glass && best.d <= 0.07) || tries >= 8) break; // close enough with new glass, or enough tries
    tries++;
    const L = apply(lv, c);
    const tag = `f${c.frost.length}l${c.locks.length}`;
    if (!stable(L)) { res.tried.push({ tag, why: 'unstable' }); continue; }
    const depth = Math.min(4, Math.max(3, lv.par + 2));
    const sol = solve(L, { maxDepth: depth, beam: 5 });
    if (!sol) { res.tried.push({ tag, why: `no ${depth}-shot solution` }); continue; }
    const level = { ...L, proof: sol.proof, win: Math.round(sol.winFrac * 1000) / 1000 };
    offer(level, clearCurve(level, sol.par + spare, trials, seed, look), sol.par, c.frost.length, c.locks.length, true);
  }
  return ease();
  // a spike: one more spare ball if it is still far harder than its slot asks
  function ease() {
    if (best.clear < target - 0.25 && !best.glass && spare < 3) {
      const clear = clearCurve(lv, lv.par + spare + 1, trials, seed + 1, look)(lv.par + spare + 1);
      res.tried.push({ tag: `f0l0s${spare + 1}`, par: lv.par, clear });
      if (miss(clear) < best.d) best = { level: { ...lv, balls: lv.par + spare + 1 }, clear, d: miss(clear), frost: 0, locks: 0, glass: false };
    }
    return { ...res, chosen: best.level, clear: best.clear, frost: best.frost, locks: best.locks };
  }
}

if (!isMainThread) {
  parentPort.on('message', (job) => {
    let out;
    try { out = harden(job); } catch (e) { out = { id: job.lv.id, error: String(e.stack || e), chosen: job.lv, clear: null }; }
    parentPort.postMessage({ k: job.k, out });
  });
} else {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
  const here = (p) => fileURLToPath(new URL(p, import.meta.url));
  const BASE = args.base ? new URL(args.base, pathToFileURL(process.cwd() + '/')).href : new URL('./levels-base.js', import.meta.url).href;
  const OUT = args.out || here('../js/levels.js');
  const TRIALS = +(args.trials || 20);
  const LOOK = +(args.look || 3);
  const only = args.only ? new Set(args.only.split(',')) : null;
  const { LEVELS, DAILY } = await import(BASE);
  const KEEP = args.keep ? (await import(new URL(args.keep, pathToFileURL(process.cwd() + '/')).href + '?t=' + Date.now())).LEVELS : null;
  const t0 = Date.now();
  const jobs = LEVELS.map((lv, k) => ({ k, lv, w: lv.world, i: k % PER_WORLD, trials: TRIALS, look: LOOK }))
    .filter((j) => !only || only.has(j.lv.id));
  const results = new Array(LEVELS.length).fill(null);
  // the slowest levels first, so the pool ends together
  jobs.sort((a, b) => (rulesFor(b.w, b.i) ? 1 : 0) - (rulesFor(a.w, a.i) ? 1 : 0) || b.k - a.k);
  await new Promise((resolve) => {
    let next = 0, active = 0, done = 0;
    const N = Math.min(os.cpus().length, jobs.length);
    if (!N) resolve();
    for (let n = 0; n < N; n++) {
      const wk = new Worker(fileURLToPath(import.meta.url));
      active++;
      const feed = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); else { wk.terminate(); if (--active === 0) resolve(); } };
      wk.on('message', ({ k, out }) => {
        results[k] = out; done++;
        const el = ((Date.now() - t0) / 1000) | 0;
        console.log(`[${el}s] ${done}/${jobs.length} ${out.id} target ${out.target?.toFixed(2)} bot ${out.base?.toFixed(2)} -> ${out.clear?.toFixed(2)} frost ${out.frost} locks ${out.locks} balls ${out.chosen?.balls - out.chosen?.par}/${out.spare} spare${out.error ? ' ERROR ' + out.error : ''}`);
        feed();
      });
      feed();
    }
  });
  const campaign = LEVELS.map((lv, k) => {
    const r = results[k];
    if (!r) return KEEP ? KEEP[k] : lv;
    const c = r.chosen;
    return { id: lv.id, world: lv.world, launcher: lv.launcher, par: c.par, balls: c.balls, proof: c.proof, win: c.win, pieces: lv.pieces, objects: c.objects };
  });
  const src = `// Generated by tools/gen-levels.mjs and made harder by tools/harden-levels.mjs. Every level carries a solver proof (aim angles in degrees).\n` +
    `export const LEVELS = ${JSON.stringify(campaign)};\n` +
    `export const DAILY = ${JSON.stringify(DAILY)};\n`;
  writeFileSync(OUT, src);
  // a partial run (--only with --keep) updates its rows in the existing report
  let rows = results.filter(Boolean).map(({ chosen, ...r }) => r);
  if (KEEP && existsSync(here('./harden-report.json'))) {
    const old = JSON.parse(readFileSync(here('./harden-report.json'), 'utf8')).filter((o) => !rows.some((r) => r.id === o.id));
    rows = [...old, ...rows];
  }
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  writeFileSync(here('./harden-report.json'), JSON.stringify(LEVELS.map((l) => byId[l.id]).filter(Boolean), null, 1));
  const lines = campaign.map((l, k) => {
    const r = byId[l.id], g = l.objects.filter((o) => o.t === 'glass');
    const frost = g.filter((o) => o.hp > 1).length, locks = g.filter((o) => o.lock).length;
    const was = LEVELS[k];
    const ds = (l.balls - l.par) - (was.balls - was.par);
    return `${l.id} par${l.par} balls${l.balls}${ds < 0 ? ' (one spare fewer)' : ds > 0 ? ' (one spare more)' : ''} glass${g.length}${frost ? ` frosted${frost}` : ''}${locks ? ` locked${locks}+key` : ''}` +
      (r ? ` bot ${Math.round(r.base * 100)}% -> ${Math.round(r.clear * 100)}% (target ${Math.round(r.target * 100)}%)` : '');
  });
  writeFileSync(here('./harden-report.txt'), lines.join('\n') + '\n');
  for (let w = 0; w < 5; w++) {
    const ws = rows.filter((r) => r.w === w).map((r) => ({ ...r, chosen: campaign.find((l) => l.id === r.id) }));
    if (!ws.length) continue;
    const avg = (f) => (ws.reduce((s, r) => s + f(r), 0) / ws.length * 100).toFixed(0);
    console.log(`world ${w}: bot clear ${avg((r) => r.base)}% -> ${avg((r) => r.clear)}% (target ${avg((r) => r.target)}%), frosted ${ws.reduce((s, r) => s + r.frost, 0)}, locked ${ws.reduce((s, r) => s + r.locks, 0)}, a spare fewer on ${ws.filter((r) => r.chosen.balls - r.chosen.par < r.spare).length}, a spare more on ${ws.filter((r) => r.chosen.balls - r.chosen.par > r.spare).length}`);
  }
  console.log(`wrote ${OUT} in ${((Date.now() - t0) / 1000) | 0}s`);
}
