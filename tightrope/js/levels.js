// Every level. Lengths are metres of rope, speed is walking speed in m/s.
// instab: how fast a lean grows on its own (rad/s² per radian of lean).
// wind: steady wind, gust/gustEvery: gust strength and mean seconds between gusts.
// birdEvery: mean seconds between birds landing on the pole (0 = none).
// sway: how far the rope swings sideways (m). limit: share of the bucket you may spill.
// On the rope: orbs (water drops that refill), knots, hurdles to jump, ibex coming
// the other way, rain clouds. Coins are laid out on every rope.
export const LEVELS = [
  { id: 1, theme: 'morning', length: 36, speed: 1.35, instab: 1.05, wind: 0, gust: 0, gustEvery: 0, birdEvery: 0, sway: 0, limit: 0.4, orbs: 0, knots: 0, hurdles: 0, ibex: 0, rain: 0 },
  { id: 2, theme: 'morning', length: 50, speed: 1.4, instab: 1.05, wind: 0.12, gust: 0.55, gustEvery: 7, birdEvery: 0, sway: 0, limit: 0.36, orbs: 1, knots: 2, hurdles: 0, ibex: 0, rain: 0 },
  { id: 3, theme: 'noon', length: 60, speed: 1.45, instab: 1.2, wind: 0.15, gust: 0.85, gustEvery: 5.5, birdEvery: 0, sway: 0, limit: 0.34, orbs: 1, knots: 2, hurdles: 1, ibex: 0, rain: 0 },
  { id: 4, theme: 'noon', length: 66, speed: 1.45, instab: 1.25, wind: 0.12, gust: 0.6, gustEvery: 7, birdEvery: 7, sway: 0, limit: 0.34, orbs: 2, knots: 3, hurdles: 2, ibex: 0, rain: 1 },
  { id: 5, theme: 'sunset', length: 74, speed: 1.5, instab: 1.3, wind: 0.15, gust: 0.7, gustEvery: 6, birdEvery: 9, sway: 0.06, limit: 0.34, orbs: 2, knots: 3, hurdles: 2, ibex: 1, rain: 0 },
  { id: 6, theme: 'night', length: 80, speed: 1.5, instab: 1.4, wind: 0.18, gust: 1.05, gustEvery: 5, birdEvery: 0, sway: 0.07, limit: 0.32, orbs: 2, knots: 4, hurdles: 2, ibex: 1, rain: 1 },
  { id: 7, theme: 'snow', length: 86, speed: 1.45, instab: 1.45, wind: 0.4, gust: 1.0, gustEvery: 5.5, birdEvery: 0, sway: 0.07, limit: 0.3, orbs: 2, knots: 4, hurdles: 3, ibex: 1, rain: 1 },
  { id: 8, theme: 'canyon', length: 96, speed: 1.55, instab: 1.5, wind: 0.25, gust: 0.95, gustEvery: 5, birdEvery: 9, sway: 0.08, limit: 0.32, orbs: 3, knots: 5, hurdles: 3, ibex: 2, rain: 1 },
];

const ENDLESS_THEMES = ['morning', 'noon', 'sunset', 'night', 'snow', 'canyon'];

// Endless mode: rope after rope, each a little harder. The container carries
// over between ropes; the run ends when less than 40% is left.
export function endlessRope(n) {
  const c = (v, max) => Math.min(max, v);
  return {
    id: 'E' + (n + 1), endless: true, rope: n + 1,
    theme: ENDLESS_THEMES[n % ENDLESS_THEMES.length],
    length: c(70 + 5 * n, 100),
    speed: c(1.4 + 0.02 * n, 1.6),
    instab: c(1.0 + 0.1 * n, 2.4),
    wind: c(0.05 * n, 0.5),
    gust: c(0.4 + 0.1 * n, 1.4),
    gustEvery: Math.max(4.5, 7 - 0.3 * n),
    birdEvery: n >= 2 ? 9 : 0,
    sway: c(0.02 * n, 0.09),
    limit: 0.6,
    orbs: 3, knots: c(2 + n, 5), hurdles: c(1 + Math.floor(n / 2), 3),
    ibex: n >= 2 ? 1 : 0, rain: n >= 4 ? 2 : 1,
  };
}
