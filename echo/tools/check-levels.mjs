#!/usr/bin/env node
/**
 * Replays every room's recorded solution through the real simulator and
 * reports which ones reach the exit, how many echoes they used against par,
 * and where a failing run got stuck. Run from anywhere:
 *
 *   node echo/tools/check-levels.mjs
 */
import * as L from "../logic.js";
import { SOLUTIONS, logsFor } from "../solutions.js";

let bad = 0;
for (const lv of L.LEVELS) {
  const sol = SOLUTIONS[lv.id];
  if (!sol) { console.log(`${lv.id}: NO SOLUTION RECORDED`); bad++; continue; }
  const logs = logsFor(sol);
  const res = L.simulate(lv, logs);
  const echoes = logs.length - 1;
  const okPar = echoes <= lv.par;
  // Every loop must be playable live: a route that walks into a drone could
  // never have been recorded, even if the final composite reaches the exit.
  const live = L.verifyLogs(lv, logs);
  if (!live) console.log(`${lv.id}: a recorded loop dies when played live`);
  // A door right next to its own plate can be walked through alone (step on
  // the plate, then into the doorway, which never shuts on an occupant).
  for (let y = 0; y < lv.map.length; y++) for (let x = 0; x < lv.map[y].length; x++) {
    const ch = lv.map[y][x]; if (!"abc".includes(ch)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (lv.map[y + dy]?.[x + dx] === ch.toUpperCase()) { console.log(`${lv.id}: door ${ch.toUpperCase()} touches its plate at (${x},${y}); it can be passed alone`); bad++; }
  }
  // Patrols must stay on the floor.
  for (const d of lv.drones || []) for (let k = 0; k <= d.n; k++) {
    const x = d.x + d.dx * k, y = d.y + d.dy * k;
    if (lv.map[y]?.[x] === "#" || lv.map[y]?.[x] === undefined) { console.log(`${lv.id}: drone path enters a wall at (${x},${y})`); bad++; break; }
  }
  if (!res.ok || !okPar || !live) bad++;
  let where = "";
  if (!res.ok) {
    const run = L.createRun(lv, logs);
    const hero = logs[logs.length - 1];
    for (let t = 0; t < L.LOOP_TICKS && !run.finished && !run.dead; t++) {
      const c = hero.charCodeAt(t) - 48;
      L.stepRun(run, c >= 0 && c <= 8 ? c : 0);
    }
    where = " | actors: " + run.actors.map((a) => `(${a.x.toFixed(1)},${a.y.toFixed(1)})`).join(" ") + ` doors ${JSON.stringify(run.doors)}` + (run.dead ? ` DEAD@${run.deadTick}` : "");
  }
  console.log(`${lv.id}: ${res.ok ? "ok " : "FAIL"} echoes ${echoes}/par ${lv.par}${okPar ? "" : " (over par)"} exit@${res.exitTick} coins ${res.coins}${where}`);
}
// Daily rooms for the next weeks must at least be well-formed.
for (let d = 20740; d < 20800; d++) {
  const lv = L.dailyLevel(d);
  if (!L.decodeLevel(L.encodeLevel(lv))) { console.log(`daily ${d}: malformed`); bad++; }
}
console.log(bad ? `\n${bad} problem(s)` : "\nall rooms solvable");
process.exit(bad ? 1 : 0);
