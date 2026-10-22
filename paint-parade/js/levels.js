// Level schedule: the difficulty curve, the generator settings per level, and
// the candidate selection that keeps every level solvable and on-target.
import { ART } from './art.js';
import { buildLevel, hashStr } from './levelgen.js';
import { playSmart, playRandom, playAwake } from './bot.js';

// Artwork order for the first pass through the library (easy → rich).
export const ART_ORDER = [
  'heart', 'cherry', 'strawberry', 'chick', 'tulip', 'cookie', 'moon', 'note', 'carrot', 'diamond',
  'crown', 'leaf', 'cactus', 'icecream', 'clover', 'sun', 'pumpkin', 'umbrella', 'star', 'whale',
  'bunny', 'pig', 'lollipop', 'rocket', 'mushroom', 'panda', 'fish', 'cat', 'crab', 'house',
  'gift', 'ghost', 'rose', 'bee', 'cloud', 'teddy', 'puppy', 'tree', 'balloon', 'octopus',
  'frog', 'potion', 'alien', 'castle', 'dino', 'cupcake', 'watermelon', 'ball', 'owl', 'sunflower',
  'pizza', 'gamepad', 'car', 'planet', 'robot', 'donut', 'boat', 'butterfly', 'rainbow', 'cake',
  'candycane', 'toast', 'egg', 'snowflake', 'milk', 'fries', 'bell', 'partyhat', 'sushi', 'mitten',
  'avocado', 'ornament', 'coffee', 'popsicle', 'snowman', 'taco', 'gingerbread', 'firework', 'xmastree', 'burger',
];

const BG = ['c', 't', 'w', 'l', 'p', 'y'];

export function levelTag(i) {
  if (i >= 18 && i % 10 === 8) return 'super';
  if (i >= 6 && i % 5 === 1) return 'hard';
  if (i > 10 && i % 10 === 9) return 'breather';
  return 'normal';
}

// Difficulty is measured with two simulated players on the real engine:
//  - "awake": reads the board and only sends buckets whose color is reachable
//    (a casual thinking player, a lower bound for a real human)
//  - "random": taps whatever is tappable (a spammer)
// Every level must be solved by the smart bot; then we pick the version where
// thinking pays off: awake wins at least `awake`, random lands near `random`.
const GOALS = {
  tutorial: { awake: 1, random: 1 },
  intro: { awake: 0.95, random: 0.55 },
  normal: { awake: 0.85, random: 0.3 },
  breather: { awake: 0.95, random: 0.6 },
  hard: { awake: 0.6, random: 0.1 },
  super: { awake: 0.4, random: 0.02 },
};

function bgFor(art, i) {
  const used = new Set(art.rows.join(''));
  for (let k = 0; k < BG.length; k++) { const c = BG[(i + k) % BG.length]; if (!used.has(c)) return c; }
  return null;
}

export function levelSpec(i) {
  const tag = i === 1 ? 'tutorial' : i <= 3 ? 'intro' : levelTag(i);
  const pass = Math.floor((i - 1) / ART_ORDER.length);
  const artId = ART_ORDER[(i - 1) % ART_ORDER.length];
  const art = ART.find((a) => a.id === artId);
  const w = Math.max(...art.rows.map((r) => r.length));
  const spec = { i, tag, art: artId, seed: hashStr(artId + ':' + i), lanes: 3, slots: 3, beltCap: 3, noise: 1.5, scale: 1, bg: null, hidden: 0, coat: 0, twins: 0 };
  if (i === 1) Object.assign(spec, { lanes: 1, slots: 4, noise: 0, chunk: 9 });
  else if (i === 2) Object.assign(spec, { lanes: 2, noise: 2.5, chunk: 9 });
  else if (i === 3) Object.assign(spec, { lanes: 2, bg: bgFor(art, i), noise: 2, chunk: 12 });
  else {
    // Filled backgrounds turn every picture into layers that must be peeled in order.
    if (tag !== 'breather') spec.bg = bgFor(art, i + pass);
    if (i >= 10 && (i % 3 !== 0 || pass > 0 || tag === 'hard' || tag === 'super')) spec.scale = w <= 16 ? 2 : 1;
    if (tag === 'hard') spec.noise = 2.5;
    if (tag === 'super') Object.assign(spec, { noise: 3, beltCap: 2, chunk: 30 });
    if (tag === 'breather') Object.assign(spec, { noise: 0.5, slots: 4 });
    if (i >= 30 && (tag === 'super' || i % 4 === 0)) spec.lanes = 4;
  }
  if (i >= 9 && tag !== 'breather') spec.hidden = Math.min(0.35, 0.12 + (i - 9) / 150);
  if (i >= 15 && i % 3 === 0) spec.coat = 0.15;
  if (i >= 22 && i % 2 === 1) spec.twins = 1 + (i % 5 === 1 ? 1 : 0);
  if (pass > 0 && tag !== 'breather') spec.noise += 0.5;
  spec.goal = GOALS[tag];
  return spec;
}

function shooterTarget(px, spec) {
  const chunk = spec.chunk || (px > 600 ? 30 : px > 380 ? 24 : px > 200 ? 16 : 11);
  return Math.max(3, Math.round(px / chunk));
}

export function evaluate(level, games = 10) {
  const smart = playSmart(level);
  if (!smart.win) return { ok: false };
  let aw = 0, rw = 0;
  for (let s = 1; s <= games; s++) {
    if (playAwake(level, s * 7919).win) aw++;
    if (playRandom(level, s * 104729).win) rw++;
  }
  return { ok: true, awake: aw / games, rand: rw / games, ticks: smart.st.tick };
}

function score(ev, goal) {
  // Unfair (thinking doesn't win) is the worst; then spamming must not pay; then hit the target.
  const gap = ev.awake - ev.rand;
  const wantGap = Math.min(0.35, goal.awake - goal.random);
  return Math.max(0, goal.awake - ev.awake) * 3 + Math.max(0, wantGap - gap) * 2 + Math.abs(ev.rand - goal.random);
}

// Builds the level for a spec: tries noise/seed variants and keeps the one that
// best rewards thinking while staying fair.
export function makeLevel(spec, { candidates = 24, games = 16 } = {}) {
  let best = null;
  const noises = [spec.noise, spec.noise + 1, Math.max(0, spec.noise - 1), spec.noise + 2];
  const sizes = spec.tag === 'tutorial' || spec.tag === 'breather' ? [1] : [1, 1.4, 1.8];
  for (let k = 0; k < candidates; k++) {
    const opts = { ...spec, noise: noises[k % noises.length], seed: (spec.seed + k * 101) >>> 0 };
    const probe = buildLevel({ ...opts, shooters: 1 });
    const px = probe.cells.reduce((q, c, i) => q + (c >= 0 ? (probe.coats ? probe.coats[i] : 1) : 0), 0);
    // Bigger buckets (fewer, larger numbers) can't finish early, so order matters more.
    opts.shooters = Math.max(3, Math.round(shooterTarget(px, spec) / sizes[Math.floor(k / noises.length) % sizes.length]));
    const lv = buildLevel(opts);
    const ev = evaluate(lv, games);
    if (!ev.ok) continue;
    const sc = score(ev, spec.goal);
    if (!best || sc < best.sc) best = { sc, lv, ev };
  }
  if (!best) {
    // Last resort: calm order and an extra spot.
    const lv = buildLevel({ ...spec, noise: 0, slots: spec.slots + 1, shooters: 8 });
    best = { lv, ev: evaluate(lv, games) };
  }
  return { ...best.lv, tag: spec.tag, level: spec.i, rand: best.ev.rand ?? 1, awake: best.ev.awake ?? 1, ticks: best.ev.ticks };
}

// ---- compact encoding for the shipped data file ----
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
export function encodeLevel(lv) {
  return {
    i: lv.level, a: lv.art, t: lv.tag, w: lv.w, h: lv.h, k: lv.keys.join(''),
    g: lv.cells.map((c) => (c < 0 ? '.' : DIG[c])).join(''),
    ...(lv.coats ? { o: lv.coats.map((c) => c).join('') } : {}),
    l: lv.lanes.map((lane) => lane.map((s) => [s.c, s.n, (s.hidden ? 1 : 0) | (s.twin ? s.twin << 1 : 0)])),
    s: lv.slots, b: lv.beltCap, p: lv.spacing, r: Math.round(lv.rand * 100), aw: Math.round((lv.awake ?? 1) * 100),
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
    slots: d.s, beltCap: d.b, spacing: d.p || 2, rand: d.r / 100, awake: (d.aw ?? 100) / 100,
  };
}
