/**
 * A recorded solution for every shipped room, as input macros.
 *
 * Each room lists its loops in order; the last one is the live hero's. A step
 * is ["R"|"L"|"U"|"D", cells] or ["W", seconds]. `logsFor` turns the macros
 * into the per-tick input strings the simulator replays, so the checks can
 * prove each map is solvable at (or under) its par with the real rules,
 * mirror and drones included.
 */
import { SPEED, TPS } from "./logic.js";

const DIR = { U: 1, R: 3, D: 5, L: 7 };

export function logsFor(solution) {
  return solution.map((loop) =>
    loop.map(([k, n]) => (k === "W" ? "0".repeat(Math.round(n * TPS)) : String(DIR[k]).repeat(Math.round(n / SPEED) + 1))).join(""),
  );
}

export const SOLUTIONS = {
  "1-1": [[["D", 8], ["R", 4]]],
  "1-2": [
    [["R", 2], ["D", 1]],
    [["R", 2], ["D", 8]],
  ],
  "1-3": [
    [["R", 2], ["D", 1]],
    [["W", 0.3], ["R", 2], ["D", 5], ["L", 2], ["D", 3]],
    [["W", 0.6], ["R", 2], ["D", 5], ["L", 2], ["D", 2], ["W", 0.8], ["R", 3], ["D", 1]],
  ],
  "1-4": [
    [["D", 2]],
    [["W", 0.4], ["R", 1], ["D", 1], ["R", 2], ["D", 1]],
    [["W", 0.9], ["R", 1], ["D", 1], ["R", 2], ["D", 7]],
  ],
  "2-1": [[["D", 8], ["R", 4]]],
  "2-2": [
    [["R", 2], ["D", 1]],
    [["R", 2], ["D", 4], ["W", 1], ["D", 4]],
  ],
  // Patrol lanes are crossed, never walked along; every loop here survives
  // when played live (tools/check-levels.mjs replays each one as the hero).
  "2-3": [
    [["R", 1], ["D", 1]],
    [["R", 1], ["D", 5], ["R", 2]],
    [["R", 1], ["W", 0.2], ["D", 8], ["R", 3]],
  ],
  // Plates b and c sit inside the patrols: step on, then end the loop at once.
  "2-4": [
    [["R", 1]],
    [["R", 1], ["W", 0.1], ["D", 4], ["R", 2], ["U", 1]],
    [["R", 1], ["D", 4], ["W", 0.8], ["D", 2], ["R", 2]],
    [["R", 1], ["D", 4], ["W", 2.9], ["D", 2], ["R", 3], ["D", 2]],
  ],
  // Mirror rooms: the hero's recording is replayed with left and right swapped.
  "3-1": [
    [["D", 3], ["R", 2]],
    [["D", 8]],
  ],
  "3-2": [
    [["L", 2], ["D", 3]],
    [["L", 1], ["D", 5], ["R", 1], ["D", 3]],
  ],
  "3-3": [
    [["D", 1], ["R", 2]],
    [["D", 1], ["L", 2], ["D", 7], ["R", 2]],
  ],
  "3-4": [
    [["L", 2]],
    [["W", 0.3], ["R", 2], ["D", 8]],
    [["R", 2]],
    [["W", 0.6], ["L", 2], ["D", 5], ["W", 1.4], ["R", 2], ["D", 3]],
  ],
};
