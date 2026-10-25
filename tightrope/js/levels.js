// Every level. Lengths are metres of rope, speed is walking speed in m/s.
// instab: how fast a lean grows on its own (rad/s² per radian of lean).
// wind: steady wind, gust/gustEvery: gust strength and mean seconds between gusts.
// birdEvery: mean seconds between birds landing on the pole (0 = none).
// sway: how far the rope swings sideways (m). limit: share of the bucket you may spill.
export const LEVELS = [
  { id: 1, theme: 'morning', length: 36, speed: 1.35, instab: 0.9, wind: 0, gust: 0, gustEvery: 0, birdEvery: 0, sway: 0, limit: 0.4 },
  { id: 2, theme: 'morning', length: 50, speed: 1.4, instab: 1.05, wind: 0.12, gust: 0.55, gustEvery: 7, birdEvery: 0, sway: 0, limit: 0.36 },
  { id: 3, theme: 'noon', length: 60, speed: 1.45, instab: 1.2, wind: 0.15, gust: 0.85, gustEvery: 5.5, birdEvery: 0, sway: 0, limit: 0.34 },
  { id: 4, theme: 'noon', length: 66, speed: 1.45, instab: 1.25, wind: 0.12, gust: 0.6, gustEvery: 7, birdEvery: 7, sway: 0, limit: 0.32 },
  { id: 5, theme: 'sunset', length: 74, speed: 1.5, instab: 1.3, wind: 0.18, gust: 0.8, gustEvery: 6, birdEvery: 9, sway: 0.06, limit: 0.3 },
  { id: 6, theme: 'night', length: 80, speed: 1.5, instab: 1.4, wind: 0.18, gust: 0.95, gustEvery: 5, birdEvery: 0, sway: 0.07, limit: 0.3 },
  { id: 7, theme: 'snow', length: 86, speed: 1.45, instab: 1.45, wind: 0.4, gust: 0.95, gustEvery: 5.5, birdEvery: 0, sway: 0.07, limit: 0.28 },
  { id: 8, theme: 'canyon', length: 96, speed: 1.55, instab: 1.5, wind: 0.25, gust: 1.0, gustEvery: 5, birdEvery: 9, sway: 0.08, limit: 0.27 },
];
