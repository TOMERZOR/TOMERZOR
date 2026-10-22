// How well does the one-bounce guide predict the real ball? Compare predicted and actual
// second contact (kind and position) over many random shots in the real levels.
import * as planck from 'planck';
import { createSim, previewPath, ghostPath } from '../js/engine.js';
import { LEVELS } from '../js/levels.js';
import { rng } from './pieces.mjs';
const r = rng(4242);
const errs = []; let same = 0, n = 0, firstOk = 0;
for (let k = 0; k < 400; k++) {
  const lv = LEVELS[Math.floor(r() * LEVELS.length)];
  const sim = createSim(planck, { ...lv, balls: 9 });
  for (let i = 0; i < 12; i++) sim.step();
  const a = (12 + r() * 156) * Math.PI / 180;
  const p = ghostPath(planck, sim, a, 1);
  if (!p.hit || !p.hit2) continue;
  // actual: record the ball's contacts in order
  const contacts = [];
  const ball = sim.fire(a);
  for (let s = 0; s < 200 && contacts.length < 2; s++) {
    const evs = sim.step();
    for (const ev of evs) {
      if (ev.type === 'hit' && (ev.a === 'ball' || ev.b === 'ball')) contacts.push({ kind: ev.a === 'ball' ? ev.b : ev.a, x: ev.x, y: ev.y });
      if (ev.type === 'break' && ev.by === 'ball') contacts.push({ kind: 'glass', x: ev.x, y: ev.y });
    }
  }
  if (contacts.length < 2) continue;
  n++;
  // contact points are on surfaces; the guide reports ball centers: compare within a ball radius
  const d1 = Math.hypot(contacts[0].x - p.hit.x, contacts[0].y - p.hit.y);
  if (d1 < 0.6) firstOk++;
  const d2 = Math.hypot(contacts[1].x - p.hit2.x, contacts[1].y - p.hit2.y);
  errs.push(d2);
  const k2 = (x) => (x === 'bomb' ? 'glass' : x);
  if (k2(contacts[1].kind) === k2(p.hit2.kind)) same++;
}
errs.sort((a, b) => a - b);
console.log(`shots ${n}: first contact within 0.6 m: ${(firstOk / n * 100).toFixed(0)}%; second contact same kind: ${(same / n * 100).toFixed(0)}%; second contact error median ${errs[errs.length >> 1].toFixed(2)} m, p75 ${errs[Math.floor(errs.length * 0.75)].toFixed(2)} m, within 0.6 m: ${(errs.filter((e) => e < 0.6).length / n * 100).toFixed(0)}%`);
