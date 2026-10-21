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
  "1-1": [[["R", 8], ["D", 4]]],
  "1-2": [
    [["D", 2], ["R", 1]],
    [["D", 2], ["R", 8]],
  ],
  "1-3": [
    [["D", 2], ["R", 1]],
    [["W", 0.3], ["D", 2], ["R", 5], ["U", 2], ["R", 3]],
    [["W", 0.6], ["D", 2], ["R", 5], ["U", 2], ["R", 2], ["W", 0.8], ["D", 3], ["R", 1]],
  ],
  "1-4": [
    [["R", 2]],
    [["W", 0.4], ["D", 1], ["R", 1], ["D", 2], ["R", 1]],
    [["W", 0.9], ["D", 1], ["R", 1], ["D", 2], ["R", 7]],
  ],
  "2-1": [[["R", 8], ["D", 4]]],
  "2-2": [
    [["D", 2], ["R", 1]],
    [["D", 2], ["R", 4], ["W", 1], ["R", 4]],
  ],
  // Drone columns are crossed while the patrol is at the far end of its run.
  "2-3": [
    [["D", 1], ["R", 1]],
    [["W", 0.4], ["D", 1], ["R", 4], ["D", 2], ["R", 1]],
    [["W", 1.0], ["D", 1], ["R", 8], ["D", 3]],
  ],
  "2-4": [
    [["D", 1]],
    [["D", 1], ["R", 3], ["D", 2]],
    [["W", 1.0], ["D", 1], ["R", 6], ["D", 2]],
    [["W", 0.3], ["D", 1], ["R", 5], ["W", 0.8], ["R", 2], ["D", 1], ["W", 1.3], ["L", 1], ["D", 2], ["R", 2]],
  ],
  // Mirror rooms: the hero's recording is replayed with left and right swapped.
  "3-1": [
    [["D", 2], ["R", 3]],
    [["D", 2], ["W", 0.8], ["D", 3]],
  ],
  "3-2": [
    [["L", 3], ["D", 1]],
    [["L", 1], ["D", 2], ["R", 1], ["W", 0.5], ["D", 3]],
  ],
  "3-3": [
    [["D", 1], ["R", 3]],
    [["D", 1], ["L", 2], ["W", 0.4], ["D", 3], ["R", 2]],
  ],
  "3-4": [
    [["L", 3]],
    [["W", 0.6], ["R", 3], ["D", 4]],
    [["R", 3]],
    [["W", 1.2], ["L", 3], ["D", 4], ["R", 3]],
  ],
};
