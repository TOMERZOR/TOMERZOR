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
  if (!res.ok || !okPar) bad++;
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
