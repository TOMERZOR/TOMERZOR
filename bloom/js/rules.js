// Scoring and combo rules, shared by the game and the simulations.

// A combo stays alive while every tray-length stretch of moves (3 placements) clears something.
export const COMBO_WINDOW = 3;
export const ALL_CLEAR_BONUS = 2000;

export const comboMult = (combo) => 1 + Math.max(0, combo - 1) * 0.5;

// 1 line 100, 2 lines 300, 3 lines 600, 4 lines 1000 ... times the combo multiplier.
export function clearPoints(lines, combo) {
  if (!lines) return 0;
  return Math.round((lines * (lines + 1) / 2) * 100 * comboMult(combo));
}

// Advances combo state for one placement. Returns the new { combo, movesSinceClear } and the points.
export function scoreMove({ combo, movesSinceClear }, cells, lines, allClear) {
  let next;
  if (lines) next = { combo: combo + 1, movesSinceClear: 0 };
  else next = { combo: movesSinceClear + 1 >= COMBO_WINDOW ? 0 : combo, movesSinceClear: movesSinceClear + 1 };
  const points = cells + clearPoints(lines, next.combo) + (allClear ? ALL_CLEAR_BONUS : 0);
  return { ...next, points };
}
