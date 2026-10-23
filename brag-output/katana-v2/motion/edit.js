// edit.js: when each piece of footage plays (screen time -> source seconds). Shared by film.js and the uses report.
'use strict';
const T = {
  s2: tb(6.5), aim: tb(8), fire: tb(12), a2in: tb(15), drop: tb(16),
  slam: tb(16.5), explode: tb(18), wordIn: tb(19.1), word: tb(20), crack: tb(23.5),
  s4: tb(24), s5: tb(28), s6: tb(30), s7: tb(32), s8: tb(34), s9: tb(36),
  s10: tb(40), s11: tb(44), s12: tb(48), s13: tb(56.5), s14: tb(60), end: FRAMES / FPS,
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
  s3: place('A2 shatter', 'p_A2', T.drop, T.s4 + 0.85, (t) => a2slow(Math.min(t, T.s4)), { blend: true }), // held while it breaks away
  s4: place('hero phone', 'g_hero', T.s4, T.s5, (t) => 2.35 + (t - T.s4) * 1.12),
  s5: place('B dawn', 'p_B', T.s5, T.s6, (t) => 0.98 + (t - T.s5)),
  s6: place('ember phone', 'g_ember', T.s6, T.s7, (t) => 2.95 + (t - T.s6)),
  s7: place('C ember', 'p_C', T.s7, T.s8, (t) => 1.25 + (t - T.s7)),
  s8: place('night phone', 'g_night', T.s8, T.s9, (t) => 3.2 + (t - T.s8)),
  s9: place('D night', 'p_D', T.s9, T.s10, (t) => 1.45 + (t - T.s9)),
  s10: [0, 1, 2, 3, 4].map((i) => place('map ' + i, 'g_map' + i, T.s10, T.s11, (t) => (i === 4 ? 40 / 30 : 0) + Math.max(0, t - T.s10 - 0.05 * i), { hold: true })),
  // the climax: one shot per beat, b48..b56 (the last one runs half a beat into the white-out)
  s12: [
    ['p_B', 2.1, 'world'], ['g_ember', 2.1, 'phone', 'ember', 0.3], ['p_C', 2.45, 'world'], ['g_night', 2.15, 'phone', 'night', -0.3],
    ['p_A2', 3.2, 'world'], ['g_hero', 4.55, 'phone', 'dawn', 0.26], ['p_D', 3.42, 'world'], ['g_ember', 4.7, 'phone', 'ember', -0.26],
    ['p_B', 2.68, 'world'],
  ].map(([clip, s0, kind, col, rot], i) => {
    const t0 = tb(48 + i), t1 = i === 8 ? T.s13 : tb(49 + i);
    return place(`climax b${48 + i}`, clip, t0, t1, (t) => s0 + (t - t0), { kind, col, rot, i });
  }),
  // the break: the shatter rewinds (late shards fly back in), a flash, then the whole glass city and the ball leaving
  s13a: place('A2 rewind', 'p_A2', T.s13, tb(58.8), (t) => 6.0 - 1.66 * E.inQuad(inv(T.s13, tb(58.8), t)), { blend: true }),
  s13b: place('A2 whole', 'p_A2', tb(58.8), T.s14, (t) => 0.45 - (t - tb(58.8)) * 0.78, { blend: true }),
  // frame 0 is the poster (players show it before playback): the wordmark over shatter frames used nowhere else
  poster: place('A2 poster', 'p_A2', 0, 1 / FPS, () => 3.75),
};
