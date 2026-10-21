#!/usr/bin/env node
/**
 * A planner for rooms: finds a sequence of loops that clears a level with the
 * real rules, so new rooms can be checked and given a par automatically.
 *
 * Model: every echo loop walks to one pressure plate as early as it safely can
 * and holds it until the loop ends; the last loop walks to the exit. Each walk
 * is a breadth-first search over (x, y, tick, doors) using logic.js itself,
 * so drones, gates and mirror worlds all count. Rooms whose clever solution
 * needs an echo to do two things in one loop still get a (longer) plan here,
 * and keep a hand-recorded solution in solutions.js.
 *
 *   node echo/tools/plan.mjs            # plan every shipped room, compare with par
 *   node echo/tools/plan.mjs 2-4        # one room, print the logs
 */
import * as L from "../logic.js";

const cloneRun = (r) => ({
  ...r, actors: r.actors.map((a) => ({ ...a })), coins: r.coins.map((c) => ({ ...c })),
  doors: { ...r.doors }, plates: { ...r.plates }, drones: r.drones.map((d) => ({ ...d })), events: [],
});
const mask = (d) => (d.A ? 1 : 0) | (d.B ? 2 : 0) | (d.C ? 4 : 0);

const MIRROR = [0, 1, 0, 7, 0, 5, 0, 3, 0];
function isBlocked(run, x, y) {
  if (x < 0 || y < 0 || x >= L.COLS || y >= L.ROWS) return true;
  const ch = run.level.map[y][x];
  return ch === "#" || ("ABC".includes(ch) && !run.doors[ch]);
}
/**
 * All states a live hero can reach in a fresh loop after `prevLogs`. In a
 * mirror room the state also tracks where the echo this loop records would be
 * (its "shadow"), so a path that bumps a wall to steer the echo counts as a
 * different state from one that merely waits.
 */
function explore(level, prevLogs) {
  const start = L.createRun(level, [...prevLogs, ""]);
  const h0 = start.actors[start.actors.length - 1];
  const key = (r, h, sh) => `${h.x},${h.y},${r.tick},${mask(r.doors)}${sh ? `,${sh.x},${sh.y}` : ""}`;
  const seen = new Map(); const queue = [{ run: start, path: "", sh: level.mirror ? { x: h0.x, y: h0.y } : null }];
  seen.set(key(start, h0, queue[0].sh), { path: "", run: start });
  const found = [];
  while (queue.length) {
    const { run, path, sh } = queue.shift();
    if (run.tick >= L.LOOP_TICKS) continue;
    for (const d of [0, 1, 3, 5, 7]) {
      let nsh = sh;
      if (sh) { const md = MIRROR[d], [dx, dy] = L.DIRS[md]; nsh = isBlocked(run, sh.x + dx, sh.y + dy) ? sh : { x: sh.x + dx, y: sh.y + dy }; }
      const r = cloneRun(run); L.stepRun(r, d);
      const h = r.actors[r.actors.length - 1];
      if (r.dead) continue;
      const p = path + d;
      if (r.finished) { found.push({ exit: true, path: p, tick: r.tick }); continue; }
      const k = key(r, h, nsh); if (seen.has(k)) continue;
      seen.set(k, { path: p, run: r, sh: nsh }); queue.push({ run: r, path: p, sh: nsh });
    }
  }
  return { seen, found };
}

/** Does the loop recorded as `log` leave an echo standing on plate `k` from tick `from` to the end? */
function echoHolds(level, prevLogs, log, k, from) {
  const run = L.createRun(level, [...prevLogs, log, ""]); const i = prevLogs.length;
  for (let t = 0; t < L.LOOP_TICKS; t++) { L.stepRun(run, 0); const e = run.actors[i]; if (t + 1 >= from && level.map[e.y][e.x] !== k) return false; }
  return true;
}
/** The earliest-arriving loops whose echo holds plate `k` until the end. In a mirror room the echo
 *  walks a different path from the hero that recorded it, so every reachable state is a candidate. */
function holdPlans(level, prevLogs, seen, k, limit = 2) {
  const out = []; const ticksSeen = new Set();
  const cands = [...seen.values()].filter(({ run, sh }) => { const h = sh ?? run.actors[run.actors.length - 1]; return level.map[h.y][h.x] === k; }).sort((a, b) => a.run.tick - b.run.tick);
  for (const c of cands) {
    if (ticksSeen.has(c.run.tick)) continue;
    const log = c.path + "0".repeat(L.LOOP_TICKS - c.path.length);
    if (!echoHolds(level, prevLogs, log, k, c.run.tick) || !L.verifyLogs(level, [...prevLogs, log])) continue;
    ticksSeen.add(c.run.tick); out.push({ log, from: c.run.tick });
    if (out.length >= limit) break;
  }
  return out;
}

export function plan(level, maxEchoes = L.MAX_ECHOES, budgetMs = 15000) {
  const plates = [...new Set(level.map.join("").split("").filter((ch) => "abc".includes(ch)))];
  const t0 = Date.now(); let best = null;
  // Iterative deepening: the first depth with a plan is the par.
  for (let depth = 0; depth <= maxEchoes && !best; depth++) {
    const dfs = (prevLogs, held) => {
      if (best || Date.now() - t0 > budgetMs) return;
      const { seen, found } = explore(level, prevLogs);
      if (found.length) { found.sort((a, b) => a.tick - b.tick); best = [...prevLogs, found[0].path]; return; }
      if (prevLogs.length >= depth) return;
      for (const k of plates) for (const h of holdPlans(level, prevLogs, seen, k)) {
        if (held[k] !== undefined && held[k] <= h.from) continue;          // already held from earlier
        dfs([...prevLogs, h.log], { ...held, [k]: h.from }); if (best) return;
      }
    };
    dfs([], {});
  }
  return best;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2];
  for (const lv of L.LEVELS) {
    if (only && lv.id !== only) continue;
    const t0 = Date.now(); const logs = plan(lv);
    if (!logs) { console.log(`${lv.id}: NO PLAN (par ${lv.par})`); continue; }
    const res = L.simulate(lv, logs);
    console.log(`${lv.id}: ${logs.length - 1} echoes (par ${lv.par}) exit@${res.exitTick} ${res.ok && L.verifyLogs(lv, logs) ? "ok" : "BAD"} ${Date.now() - t0}ms${only ? " " + JSON.stringify(logs) : ""}`);
  }
}
