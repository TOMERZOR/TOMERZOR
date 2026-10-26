// Plays thousands of random games (random plans, random taps, random abilities, items
// placed mid-action) and checks the rules never get into a broken state.
//   node achori/test/fuzz.mjs [games per level=150]
import { Game, TOOLS, COLS, ROWS, cellOf, idx } from '../js/game.js';
import { LEVELS } from '../js/levels.js';

const N = Number(process.argv[2] || 150);
let seed = 12345;
const R = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = (a) => a[Math.floor(R() * a.length)];
const KNOWN = new Set(['placed', 'removed', 'start', 'spawn', 'snap', 'bucket', 'glued', 'eat', 'hit', 'beat', 'offbeat', 'dodge', 'free', 'broke', 'steal', 'recovered', 'escaped', 'left', 'kill', 'ability', 'won', 'lost']);
const HELD_TRAP = { caught: 'snap', glued: 'glue', bucketed: 'bucket', eating: null };
let failures = 0;
const seen = new Map(); // each kind of failure is printed once, then counted

function fail(level, n, t, msg, m) {
  failures++;
  seen.set(msg, (seen.get(msg) || 0) + 1);
  if (seen.get(msg) === 1) console.log(`FAIL level ${level + 1} game ${n} t=${t.toFixed(2)}: ${msg}`, m ? JSON.stringify({ id: m.id, type: m.type, state: m.state, x: m.x, z: m.z, cell: m.cell, next: m.next, t: m.t, trapCell: m.trapCell, hp: m.hp }) : '');
}

for (let li = 0; li < LEVELS.length; li++) {
  const level = LEVELS[li];
  let won = 0, lost = 0, maxT = 0;
  for (let n = 0; n < N; n++) {
    const g = new Game(level, { seed: n + 1 });
    // a random plan, sometimes with removals
    for (let k = 0; k < 40; k++) {
      const c = Math.floor(R() * COLS), r = Math.floor(R() * ROWS);
      if (R() < 0.15) g.remove(c, r); else g.place(pick(level.tools), c, r);
    }
    if (g.budget < 0) fail(li, n, 0, 'budget below zero in plan');
    g.start();
    const dt = 1 / 60;
    let t = 0;
    const style = R(); // how aggressive this player is
    for (; t < 600 && g.phase === 'action'; t += dt) {
      g.update(dt);
      const live = g.mice.filter((m) => m.alive);
      if (live.length && R() < 0.08 + style * 0.3) g.whack(pick(live), R());
      if (R() < 0.002) g.useAbility(pick(['ofek', 'shalev', 'shaked']));
      if (R() < 0.01) g.place(pick(level.tools), Math.floor(R() * COLS), Math.floor(R() * ROWS));
      if (R() < 0.01) g.miss(live.length ? pick(live) : null);
      for (const e of g.drain()) if (!KNOWN.has(e.type)) fail(li, n, t, 'unknown event ' + e.type);
      // ----- invariants -----
      if (g.budget < 0) fail(li, n, t, 'budget below zero');
      const carried = g.mice.filter((m) => m.alive && m.carrying).length;
      if (g.food < 0 || g.food + carried > g.foodMax) fail(li, n, t, `food ${g.food} + carried ${carried} > ${g.foodMax}`);
      if (!Number.isFinite(g.score)) fail(li, n, t, 'score not finite');
      for (const m of g.mice) {
        if (!Number.isFinite(m.x) || !Number.isFinite(m.z) || !Number.isFinite(m.hp)) { fail(li, n, t, 'NaN in mouse', m); continue; }
        if (m.x < -0.001 || m.z < -0.001 || m.x > COLS - 1 + 0.001 || m.z > ROWS - 1 + 0.001) fail(li, n, t, 'mouse off the grid', m);
        if (m.hp < 0 || m.hp > m.hpMax) fail(li, n, t, 'hp out of range', m);
        if (!m.alive) continue;
        const onX = Math.abs(m.x - Math.round(m.x)) < 1e-6, onZ = Math.abs(m.z - Math.round(m.z)) < 1e-6;
        if (!onX && !onZ) fail(li, n, t, 'mouse moving diagonally', m);
        const here = idx(Math.round(m.x), Math.round(m.z));
        if (onX && onZ && g.blocks(here)) fail(li, n, t, 'mouse standing inside a block', m);
        if (m.cell != null && g.blocks(m.cell)) fail(li, n, t, 'mouse cell is a block', m);
        if (m.next != null && g.blocks(m.next)) fail(li, n, t, 'mouse heading into a block', m);
        if (m.next != null) {
          const a = cellOf(m.cell), b = cellOf(m.next);
          if (Math.abs(a.c - b.c) + Math.abs(a.r - b.r) !== 1) fail(li, n, t, 'next cell is not a neighbour', m);
        }
        const want = HELD_TRAP[m.state];
        if (want) {
          const it = g.cells[m.trapCell];
          if (m.trapCell == null || !it || it.kind !== want) fail(li, n, t, `held in ${m.state} but the ${want} is gone`, m);
        }
        if (g.isHeld(m) && !(m.t > -0.05)) fail(li, n, t, 'held timer below zero', m);
      }
    }
    if (g.phase === 'action') fail(li, n, t, 'game never ended (10 minutes)');
    if (g.phase === 'won') {
      won++;
      if (g.mice.some((m) => m.alive)) fail(li, n, t, 'won with mice still alive');
      if (g.spawnQueue.length) fail(li, n, t, 'won with mice still to come');
    }
    if (g.phase === 'lost') lost++;
    maxT = Math.max(maxT, t);
  }
  console.log(`${String(li + 1).padStart(2)}. ${level.name.padEnd(26)} won ${won} lost ${lost} longest ${maxT.toFixed(0)}s`);
}
// The dotted route shown while planning must be the route the mouse really runs.
// Blocks and cheese only (traps would stop it on the way), one mouse from each burrow.
let routesChecked = 0;
for (let li = 0; li < LEVELS.length; li++) {
  for (let n = 0; n < 60; n++) {
    const level = { ...LEVELS[li], budget: 30, tools: ['block', 'cheese'] };
    for (let h = 0; h < level.holes.length; h++) {
      const plan = new Game(level, { seed: n });
      for (let k = 0; k < 14; k++) plan.place(R() < 0.5 ? 'block' : 'cheese', Math.floor(R() * COLS), Math.floor(R() * ROWS));
      const shown = plan.previewRoutes()[h].path;
      const g = new Game({ ...level, waves: [{ t: 0, type: 'minion', hole: h }] }, { seed: n });
      g.cells = plan.cells.map((c) => (c ? { ...c } : c));
      g.start();
      const ran = [g.holes[h]];
      for (let t = 0; t < 60 && g.phase === 'action'; t += 1 / 60) {
        g.update(1 / 60);
        const m = g.mice[0];
        if (!m) break;
        if (m.cell !== ran[ran.length - 1]) ran.push(m.cell);
        if (m.carrying || m.cell === g.goal) break;
      }
      routesChecked++;
      if (shown.join() !== ran.join()) fail(li, n, 0, 'planning route differs from the real run: shown ' + shown.join(' ') + ' | ran ' + ran.join(' '));
    }
  }
}
console.log(`routes checked: ${routesChecked}`);

for (const [msg, n] of seen) console.log(`  ${n}× ${msg}`);
console.log(failures ? `${failures} FAILURES` : 'all invariants held');
process.exit(failures ? 1 : 0);
