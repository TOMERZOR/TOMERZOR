// Hand-made opening levels: each teaches one idea. Proofs are solved at build time.
const jar = (x, sy, w = 0.56, h = 0.7, tint = 0) => ({ t: 'glass', s: 'jar', x, y: sy + h / 2 + 0.004, w, h, tint });
const big = (x, sy, tint) => ({ t: 'glass', s: 'box', x, y: sy + 0.4 + 0.004, w: 0.8, h: 0.8, tint });
const box = (x, sy, s = 0.66, tint = 2) => ({ t: 'glass', s: 'box', x, y: sy + s / 2 + 0.004, w: s, h: s, tint });
const shelf = (x, y, w) => ({ t: 'shelf', x, y, w, h: 0.22, round: true });
const T = 0.11;
// hanging glass: returns [glass, rope] with the rope pointing at the glass just before it
function hang(objs, g) { objs.push(g, { t: 'rope', x: g.x, y: 14, to: objs.length }); return objs; }
const orb = (x, y, r = 0.34, tint = 0) => ({ t: 'glass', s: 'orb', x, y, r, tint });
const hjar = (x, y, tint = 0) => ({ t: 'glass', s: 'jar', x, y, w: 0.68, h: 0.86, tint });

function line(angleDeg, ds, make) {
  const objs = [];
  const a = angleDeg * Math.PI / 180;
  ds.forEach((d, i) => hang(objs, make(Math.round((4.5 + Math.cos(a) * d) * 100) / 100, Math.round((0.42 + Math.sin(a) * d) * 100) / 100, i)));
  return objs;
}

export const TUTORIAL = [
  // 1: pull back, release. A string of glass beads straight above the cannon.
  { launcher: { x: 4.5 }, pieces: ['tutorial-aim'], objects: [
    orb(4.5, 11.3, 0.44, 0), { t: 'rope', x: 4.5, y: 14, to: 0 },
    orb(4.5, 9.5, 0.44, 1), { t: 'rope', from: 0, to: 2 },
    orb(4.5, 7.7, 0.44, 2), { t: 'rope', from: 2, to: 4 },
  ] },
  // 2: line them up. The ball pierces glass.
  { launcher: { x: 4.5 }, pieces: ['tutorial-pierce'], objects: line(64, [3.6, 5.0, 6.4, 7.8], (x, y, i) => hjar(x, y, i % 3)) },
  // 3: knock it down, falling glass shatters. A low, narrow shelf keeps the pyramid in view of the cannon
  // (tuned with the average-player bot: 83% clear, two thirds in one shot)
  { launcher: { x: 4.5 }, pieces: ['tutorial-pyramid'], objects: [shelf(6.4, 3.8, 1.7),
    big(6.0, 3.8 + T, 0), big(6.82, 3.8 + T, 1), big(6.41, 3.8 + T + 0.808, 2)] },
];
