// GeoGuessr-style scoring: up to 5,000 points a round, falling off smoothly
// with how far off the guess was.
//
// Trips run from a 10-minute walk to a 40-hour drive, so the error is
// measured as a ratio rather than in minutes: being 6 minutes off a
// 1-hour drive costs the same as being 1.5 hours off a 15-hour one.
// A small constant (5 minutes, 2 km) keeps short trips from being brutal.

export const MAX_ROUND = 5000;
const K = 2.5;
const SOFT = { time: 5, distance: 2 };

export function roundScore(guess, actual, measure = "time") {
  if (guess == null || !Number.isFinite(guess) || guess < 0) return 0;
  const diff = Math.abs(guess - actual);
  if (measure === "time" ? diff <= 1 : diff <= 0.1) return MAX_ROUND;
  if (diff / actual <= 0.005) return MAX_ROUND;
  const c = SOFT[measure] ?? 5;
  const e = Math.abs(Math.log((guess + c) / (actual + c)));
  return Math.max(0, Math.round(MAX_ROUND * Math.exp(-K * e)));
}

// Words for the reveal, by score.
export function verdict(score) {
  if (score >= 5000) return "perfect";
  if (score >= 4500) return "amazing";
  if (score >= 3800) return "great";
  if (score >= 2800) return "good";
  if (score >= 1500) return "ok";
  return "miss";
}

// Signed relative error, for "12% over" labels.
export function relError(guess, actual) {
  if (guess == null || !actual) return null;
  return (guess - actual) / actual;
}

// Streak mode: the run continues while you stay within this score.
export const STREAK_PASS = 2800;

// Duels, the GeoGuessr way: both start with 6,000 health. After each round
// the lower score loses the difference, times a multiplier that grows from
// round 4 so a game can't drag on forever.
export const DUEL_HP = 6000;
export function duelMultiplier(round) {
  return round <= 3 ? 1 : 1 + (round - 3) * 0.5;
}
