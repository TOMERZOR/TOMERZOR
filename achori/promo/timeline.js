// The promo's edit: when each shot starts, which frames it plays, and every sound cue.
// Shared by the picture (compose.html) and the soundtrack (soundtrack.js) so they can't drift.

export const FPS = 30;

export const T = {
  length: 30,
  cut: { open: 0, lior: 1.2, ofek: 4.2, duo: 5.8, ido: 7.6, wipe: 9.0, plan: 9.6, run: 12.4, mash: 12.9, scream: 15.4, multi: 16.9, slipper: 19.4, keyart: 21.2, end: 25.4 },
  drop: 12.4,
  logo: 22.4,
};

// [shot, from, to, source, first frame of the source]
export const SHOTS = [
  ['lior', T.cut.lior, T.cut.ofek, 'clips/A', 7],
  ['ofek', T.cut.ofek, T.cut.duo, 'clips/B', 96],
  ['duo', T.cut.duo, T.cut.ido, 'clips/C', 16],
  ['plan', T.cut.plan, T.cut.run, 'game/g1_plan', 1],
  ['run', T.cut.run, T.cut.mash, 'game/g2_run', 16],
  ['mash', T.cut.mash, T.cut.scream, 'game/g2_mash', 1],
  ['scream', T.cut.scream, T.cut.multi, 'game/g3_scream', 1],
  ['multi', T.cut.multi, T.cut.slipper, 'game/g4_multi', 1],
  ['slipper', T.cut.slipper, T.cut.keyart, 'clips/E', 3],
  ['keyart', T.cut.keyart, T.cut.end, 'clips/D', 10],
];

// moments inside the captured gameplay (frame numbers of the capture)
const MASH_TAPS = []; for (let f = 1; f <= 37; f += 2) MASH_TAPS.push(f);
const MASH_KILL = 38;
const MULTI_TAPS = [11, 14, 22, 25, 33, 36];
const MULTI_KILLS = [15, 26, 37];
const PLAN_TAPS = [[21, 'place'], [43, 'glue'], [65, 'place']];
const at = (cut, f) => cut + (f - 1) / FPS;

export const OPEN_TEXT = 'באתר בנייה אחד...';

export function sfxCues() {
  const c = [];
  [...OPEN_TEXT].forEach((ch, i) => { if (ch !== ' ') c.push([0.25 + i * 0.045, 'type']); });
  c.push([0.95, 'squeak', 1]);
  c.push([T.cut.lior - 0.05, 'swish']);
  c.push([2.05, 'pop']);
  c.push([2.9, 'slam']);
  c.push([3.35, 'squeak', 0.8]);
  c.push([T.cut.ofek - 0.1, 'whoosh']);
  c.push([T.cut.ofek + 0.05, 'scream']);
  c.push([T.cut.duo - 0.05, 'swish']);
  c.push([T.cut.duo + 0.15, 'pop']);
  c.push([T.cut.duo + 0.85, 'pop']);
  c.push([T.cut.ido - 0.08, 'whoosh']);
  c.push([T.cut.ido + 0.1, 'paper']);
  c.push([T.cut.ido + 0.6, 'stamp']);
  c.push([T.cut.wipe - 0.05, 'whoosh', 1.2]);
  c.push([T.cut.plan + 0.1, 'slam', 0.6]);
  for (const [f, what] of PLAN_TAPS) c.push([at(T.cut.plan, f), what]);
  c.push([T.drop + 0.05, 'slam']);
  c.push([T.cut.mash - 0.04, 'swish']);
  c.push([T.cut.mash, 'snap']);
  MASH_TAPS.forEach((f, n) => c.push([at(T.cut.mash, f), 'whack', n]));
  c.push([at(T.cut.mash, MASH_KILL), 'kill', true]);
  c.push([at(T.cut.mash, MASH_KILL) + 0.95, 'coin', 3]);
  c.push([T.cut.scream - 0.05, 'whoosh']);
  c.push([at(T.cut.scream, 7), 'scream']);
  c.push([T.cut.multi - 0.05, 'swish']);
  MULTI_TAPS.forEach((f, n) => c.push([at(T.cut.multi, f), 'whack', n * 2]));
  MULTI_KILLS.forEach((f, n) => {
    c.push([at(T.cut.multi, f), 'kill', false]);
    if (n > 0) c.push([at(T.cut.multi, f) + 0.02, 'multi', n + 1]);
    c.push([at(T.cut.multi, f) + 0.9, 'coin', n]);
  });
  c.push([T.cut.slipper - 0.06, 'whoosh']);
  c.push([T.cut.slipper + 0.02, 'slap']);
  c.push([T.cut.slipper + 0.25, 'boing']);
  c.push([T.cut.slipper + 0.6, 'tweet']);
  c.push([T.cut.keyart - 0.05, 'whoosh']);
  c.push([T.logo, 'slam']);
  c.push([T.logo + 0.35, 'slam']);
  c.push([T.logo + 0.7, 'boom', 1.2]);
  c.push([T.logo + 1.2, 'sparkle']);
  c.push([T.logo + 1.6, 'pop']);
  c.push([T.cut.end + 0.1, 'pop']);
  c.push([T.cut.end + 0.35, 'slam', 0.8]);
  [0.8, 1.0, 1.2].forEach((d) => c.push([T.cut.end + d, 'pop', 0.7]));
  c.push([T.cut.end + 1.6, 'ding']);
  c.push([T.cut.end + 2.2, 'squeak', 1.1]);
  return c.sort((a, b) => a[0] - b[0]);
}

// impacts that shake the picture: [time, strength]
export const SHAKES = [
  [2.9, 0.8], [T.cut.ofek + 0.05, 0.5], [T.cut.ido + 0.6, 0.9], [T.drop, 1.0],
  [at(T.cut.mash, MASH_KILL), 1.0], ...MULTI_KILLS.map((f) => [at(T.cut.multi, f), 0.7]),
  [T.cut.slipper + 0.02, 1.2], [T.logo, 0.6], [T.logo + 0.35, 0.6], [T.logo + 0.7, 1.0], [T.cut.end + 0.35, 0.5],
  ...MASH_TAPS.map((f) => [at(T.cut.mash, f), 0.18]),
];
export const FLASHES = [T.drop, at(T.cut.mash, MASH_KILL), T.cut.slipper + 0.02, T.logo + 0.7];
