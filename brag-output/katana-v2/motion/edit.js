// edit.js: when each piece of footage plays (screen time -> source seconds). Shared by film.js and the uses report.
// v2: slower. The gameplay gets its own section: three real levels played in full, large, with captions.
'use strict';
const T = {
  s2: tb(6.5), aim: tb(8), fire: tb(12), a2in: tb(15), drop: tb(16),
  slam: tb(16.5), explode: tb(18), wordIn: tb(19.1), word: tb(20), crack: tb(23.5),
  play: tb(24), dawn: tb(41), ember: tb(44), emberW: tb(53), night: tb(56.5), nightW: tb(64),
  worlds: tb(68), balls: tb(76), rewind: tb(84), logo: tb(88), sub: tb(92), end: FRAMES / FPS,
};
const ZOOM_IN = 0.27; // phone -> world zoom-through, seconds before the cut
const PL = [];
function place(label, clip, t0, t1, src, o = {}) { const p = { label, clip, t0, t1, src, ...o }; PL.push(p); return p; }
// A2 after the impact: real speed easing into 0.45x slow motion
const a2slow = (t) => { const d = Math.max(0, t - T.drop); return 1.125 + 0.45 * d + 0.55 * 0.18 * (1 - Math.exp(-d / 0.18)); };

const P = {
  s1: [
    place('A1 glide a', 'p_A1', 0, tb(2.5), (t) => 0.1 + t),
    place('A1 glide b', 'p_A1', tb(2.5), tb(4.5), (t) => 1.55 + (t - tb(2.5))),
    place('A1 glide c', 'p_A1', tb(4.5), T.s2, (t) => 2.7 + (t - tb(4.5))),
  ],
  s2: place('A1 roll', 'p_A1', T.s2, T.a2in, (t) => 4.15 + (t - T.s2)),
  s2b: place('A2 approach', 'p_A2', T.a2in, T.drop, (t) => 1.125 - (T.drop - t)),
  s3: place('A2 shatter', 'p_A2', T.drop, T.play + 0.85, (t) => a2slow(Math.min(t, T.play)), { blend: true }), // held while it breaks away
  // how to play: level 4 (Dawn) from the last pieces landing, through the aim, the shot and the chain, to the level-clear sheet
  play1: place('level 4 (dawn)', 'g_hero2', T.play, T.dawn, (t) => 0.75 + (t - T.play)),
  dawn: place('B dawn', 'p_B', T.dawn, T.ember, (t) => 0.98 + (t - T.dawn)),
  // level 82 (Ember): the aim settles, the shot, the bombs, the last pieces
  play2: place('level 82 (ember)', 'g_ember2', T.ember, T.emberW, (t) => 2.3 + (t - T.ember)),
  emberW: place('C ember', 'p_C', T.emberW, T.night, (t) => 1.25 + (t - T.emberW)),
  // level 112 (Night): the third pendant breaks on the second drop
  play3: place('level 112 (night)', 'g_night2', T.night, T.nightW, (t) => 2.708 + (t - T.night)),
  nightW: place('D night', 'p_D', T.nightW, T.worlds, (t) => 1.6 + (t - T.nightW)),
  maps: [0, 1, 2, 3, 4].map((i) => place('map ' + i, 'g_map' + i, T.worlds, T.balls, (t) => (i === 4 ? 40 / 30 : 0) + Math.max(0, t - T.worlds - 0.05 * i), { hold: true })),
  // the shatter rewinds (late shards fly back in), a flash, then the whole glass city and the ball leaving
  rw1: place('A2 rewind', 'p_A2', T.rewind, tb(86.4), (t) => 6.0 - 1.66 * E.inQuad(inv(T.rewind, tb(86.4), t)), { blend: true }),
  rw2: place('A2 whole', 'p_A2', tb(86.4), T.logo, (t) => 0.45 - (t - tb(86.4)) * 0.58, { blend: true }),
  // frame 0 is the poster (players show it before playback): the wordmark over shatter frames used nowhere else
  poster: place('A2 poster', 'p_A2', 0, 1 / FPS, () => 3.75),
};
