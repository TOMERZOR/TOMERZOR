// Level schedule: the difficulty curve, the generator settings per level, and
// the candidate selection that keeps every level solvable and on-target.
import { ART } from './art.js';
import { buildLevel, hashStr } from './levelgen.js';
import { playSmart, playRandom } from './bot.js';

// Artwork order for the first pass through the library (easy → rich).
export const ART_ORDER = [
  'heart', 'cherry', 'strawberry', 'chick', 'tulip', 'cookie', 'moon', 'note', 'carrot', 'diamond',
  'crown', 'leaf', 'cactus', 'icecream', 'clover', 'sun', 'pumpkin', 'umbrella', 'star', 'whale',
  'bunny', 'pig', 'lollipop', 'rocket', 'mushroom', 'panda', 'fish', 'cat', 'crab', 'house',
  'gift', 'ghost', 'rose', 'bee', 'cloud', 'teddy', 'puppy', 'tree', 'balloon', 'octopus',
  'frog', 'potion', 'alien', 'castle', 'dino', 'cupcake', 'watermelon', 'ball', 'owl', 'sunflower',
  'pizza', 'gamepad', 'car', 'planet', 'robot', 'donut', 'boat', 'butterfly', 'rainbow', 'cake',
];

const BG = ['c', 'w', 'l', 'p', 't', 'y', 'e', 'P'];

export function levelTag(i) {
  if (i >= 18 && i % 10 === 8) return 'super';
  if (i >= 6 && i % 5 === 1) return 'hard';
  return 'normal';
}

// Target "random player" win rate per tag: lower = harder.
const TARGET = { tutorial: 1, normal: 0.8, hard: 0.45, super: 0.2 };

export function levelSpec(i) {
  const tag = i <= 3 ? 'tutorial' : levelTag(i);
  const pass = Math.floor((i - 1) / ART_ORDER.length);
  const artId = ART_ORDER[(i - 1) % ART_ORDER.length];
  const art = ART.find((a) => a.id === artId);
  const w = Math.max(...art.rows.map((r) => r.length));
  const spec = { i, tag, art: artId, seed: hashStr(artId + ':' + i), lanes: 2, slots: 5, beltCap: 5, noise: 0, scale: 1, bg: null, hidden: 0, coat: 0, twins: 0 };
  if (i === 1) Object.assign(spec, { lanes: 1, beltCap: 3, chunk: 9 });
  else if (i <= 5) Object.assign(spec, { lanes: 2, chunk: 10 });
  else Object.assign(spec, { lanes: 3 });
  // Size: bigger canvases arrive gradually; a background makes pictures deeper.
  if (i >= 12 && (i % 3 !== 0 || pass > 0)) spec.scale = w <= 16 ? 2 : 1;
  if (i >= 9 && (i % 2 === 0 || tag !== 'normal' || pass > 0)) spec.bg = BG[(i + pass) % BG.length];
  if (i >= 34 && tag === 'super') spec.lanes = 4;
  if (i >= 45 && i % 4 === 0) spec.lanes = 4;
  if (tag === 'hard') { spec.slots = 4; spec.bg = spec.bg || BG[i % BG.length]; if (i >= 12) spec.scale = w <= 16 ? 2 : 1; }
  if (tag === 'super') { spec.slots = 4; spec.beltCap = 4; spec.bg = spec.bg || BG[i % BG.length]; spec.scale = w <= 16 ? 2 : 1; spec.chunk = 34; }
  spec.noise = tag === 'tutorial' ? 0 : tag === 'hard' ? 3 : tag === 'super' ? 4.5 : Math.min(2, 0.4 + i / 30);
  if (i >= 9) spec.hidden = Math.min(0.35, 0.12 + (i - 9) / 150);
  if (i >= 15 && i % 3 === 0) spec.coat = 0.15;
  if (i >= 22 && i % 2 === 1) spec.twins = 1 + (i % 5 === 1 ? 1 : 0);
  if (i % 10 === 9 && i > 10) { spec.noise = 0.3; spec.hidden = 0; } // breather after super
  if (pass > 0) { spec.noise += 0.5; spec.hidden = Math.min(0.4, spec.hidden + 0.05); }
  spec.target = TARGET[tag];
  return spec;
}

function shooterTarget(px, spec) {
  const chunk = spec.chunk || (px > 600 ? 30 : px > 380 ? 24 : px > 200 ? 16 : 11);
  return Math.max(3, Math.round(px / chunk));
}

export function evaluate(level, games = 16) {
  const smart = playSmart(level);
  if (!smart.win) return { ok: false };
  let wins = 0;
  for (let s = 1; s <= games; s++) if (playRandom(level, s * 7919).win) wins++;
  return { ok: true, rand: wins / games, ticks: smart.st.tick, maxSlots: smart.st.stats.maxSlots };
}

// Builds the level for a spec, trying several seeds and keeping the one whose
// difficulty lands closest to the target while the smart bot still wins.
export function makeLevel(spec, { candidates = spec.tag === 'normal' ? 6 : 14, games = 16 } = {}) {
  let best = null;
  for (let attempt = 0; attempt < 3 && !best; attempt++) {
    const noise = spec.noise * (attempt === 0 ? 1 : attempt === 1 ? 0.5 : 0);
    for (let k = 0; k < candidates; k++) {
      const opts = { ...spec, noise, seed: (spec.seed + k * 101 + attempt * 7) >>> 0 };
      const probe = buildLevel({ ...opts, shooters: 1 });
      const px = probe.cells.reduce((s, c, i) => s + (c >= 0 ? (probe.coats ? probe.coats[i] : 1) : 0), 0);
      opts.shooters = shooterTarget(px, spec);
      const lv = buildLevel(opts);
      const ev = evaluate(lv, games);
      if (!ev.ok) continue;
      const d = Math.abs(ev.rand - spec.target);
      if (!best || d < best.d) best = { d, lv, ev };
    }
  }
  if (!best) {
    // Last resort: generous spots.
    const lv = buildLevel({ ...spec, noise: 0, slots: spec.slots + 2, shooters: 6 });
    best = { lv, ev: evaluate(lv, games) };
  }
  return { ...best.lv, tag: spec.tag, level: spec.i, rand: best.ev.rand, ticks: best.ev.ticks };
}

// ---- compact encoding for the shipped data file ----
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
export function encodeLevel(lv) {
  return {
    i: lv.level, a: lv.art, t: lv.tag, w: lv.w, h: lv.h, k: lv.keys.join(''),
    g: lv.cells.map((c) => (c < 0 ? '.' : DIG[c])).join(''),
    ...(lv.coats ? { o: lv.coats.map((c) => c).join('') } : {}),
    l: lv.lanes.map((lane) => lane.map((s) => [s.c, s.n, (s.hidden ? 1 : 0) | (s.twin ? s.twin << 1 : 0)])),
    s: lv.slots, b: lv.beltCap, p: lv.spacing, r: Math.round(lv.rand * 100),
  };
}

export function decodeLevel(d, PALETTE) {
  const keys = [...d.k];
  const cells = [...d.g].map((ch) => (ch === '.' ? -1 : DIG.indexOf(ch)));
  const art = ART.find((a) => a.id === d.a);
  return {
    level: d.i, art: d.a, name: art ? art.name : d.a, album: art ? art.album : '', tag: d.t,
    w: d.w, h: d.h, cells, keys, colors: keys.map((k) => PALETTE[k].hex),
    coats: d.o ? [...d.o].map(Number) : undefined,
    lanes: d.l.map((lane) => lane.map(([c, n, f]) => ({ c, n, hidden: !!(f & 1), twin: f >> 1 }))),
    slots: d.s, beltCap: d.b, spacing: d.p || 2, rand: d.r / 100,
  };
}
