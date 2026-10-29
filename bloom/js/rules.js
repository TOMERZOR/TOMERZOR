// Scoring, shared by the game and the simulations.
import { MIN_GROUP } from './board.js';

export const CHAIN_MULT = [1, 1, 2, 3, 5, 8, 12, 16, 20];
export const chainMult = (chain) => CHAIN_MULT[Math.min(chain, CHAIN_MULT.length - 1)];
export const CLEAR_GARDEN_BONUS = 3000;

// One link of a chain: 10 a seed, +15 for every seed past four in a group, 20 a weed; then the
// chain multiplier (x2 for the second link, x3, x5, x8 ...).
export function stepPoints(step) {
  let p = 0;
  for (const g of step.groups) p += g.size * 10 + Math.max(0, g.size - MIN_GROUP) * 15;
  const inGroups = step.groups.reduce((a, g) => a + g.size, 0);
  p += Math.max(0, step.cleared.length - inGroups - step.weeds) * 10;
  p += step.weeds * 20;
  return p * chainMult(step.chain);
}
