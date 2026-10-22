// Brute-force solver: plays a level with the real engine and proves it can be cleared.
import * as planck from 'planck';
import { createSim } from '../js/engine.js';

const DEG = Math.PI / 180;
export const ANGLES = [];
for (let d = 7; d <= 173.01; d += 1.25) ANGLES.push(d * DEG);

const MAX_SETTLE = 480; // 8 s per shot

export function runShots(level, shots) {
  const sim = createSim(planck, { ...level, balls: 99 });
  for (let i = 0; i < 12; i++) sim.step();
  const after = [];
  for (const sh of shots) {
    for (let i = 0; i < (sh.wait || 0); i++) sim.step();
    sim.fire(sh.a);
    let n = 0;
    while (n++ < MAX_SETTLE) {
      sim.step();
      if (sim.st.won) break;
      if (sim.st.live === 0 && sim.st.quietSteps > 15) break;
    }
    after.push(sim.st.glass);
    if (sim.st.won) break;
  }
  return { glass: sim.st.glass, won: sim.st.won, after, maxCombo: sim.st.maxCombo, broken: sim.st.broken, time: sim.st.time };
}

export function hasMovers(level) { return level.objects.some((o) => o.t === 'mover'); }

// Stable: nothing breaks or wanders when the level sits untouched.
export function stable(level) {
  const sim = createSim(planck, { ...level, balls: 0 }, { awake: true });
  const g0 = sim.st.glass;
  const dyn = sim.ents.filter((e) => e.alive && e.body.getType() === 'dynamic');
  const p0 = dyn.map((e) => { const p = e.body.getPosition(); return [p.x, p.y, e.body.getAngle()]; });
  const movers = hasMovers(level);
  const steps = movers ? 600 : 200;
  for (let i = 0; i < steps; i++) {
    sim.step();
    if (sim.st.glass !== g0) return false;
  }
  for (let i = 0; i < dyn.length; i++) {
    const e = dyn[i];
    if (!e.alive) return false;
    const p = e.body.getPosition();
    const dy = p.y - p0[i][1], dx = p.x - p0[i][0], da = e.body.getAngle() - p0[i][2];
    if (movers) { if (dy < -0.25 || Math.abs(da) > 0.3) return false; }
    else if (Math.hypot(dx, dy) > 0.05 || Math.abs(da) > 0.06) return false;
  }
  return true;
}

function robust(level, shots, movers) {
  const last = shots[shots.length - 1];
  const variants = [];
  for (const d of [-0.6, -0.3, 0.3, 0.6]) variants.push({ a: last.a + d * DEG });
  if (movers) for (const w of [8, 16]) variants.push({ a: last.a, wait: (last.wait || 0) + w });
  for (const v of variants) {
    const r = runShots(level, [...shots.slice(0, -1), v]);
    if (!r.won) return false;
  }
  return true;
}

export function solve(level, { maxDepth = 3, beam = 5 } = {}) {
  const movers = hasMovers(level);
  const g0 = level.objects.filter((o) => o.t === 'glass').length;
  let frontier = [{ shots: [], glass: g0 }];
  let firstHitFrac = 0;
  let sims = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const cands = [];
    const winsByPrefix = [];
    for (const f of frontier) {
      let w = 0;
      for (const a of ANGLES) {
        const shots = [...f.shots, { a }];
        const r = runShots(level, shots);
        sims += depth;
        cands.push({ shots, ...r, parentGlass: f.glass });
        if (r.won) w++;
      }
      winsByPrefix.push(w);
    }
    if (depth === 1) firstHitFrac = cands.filter((c) => c.glass < g0).length / cands.length;
    const wins = cands.filter((c) => c.won).sort((a, b) => b.maxCombo - a.maxCombo);
    // prefer winners in the middle of a winning run (robust)
    for (const w of wins) {
      if (robust(level, w.shots, movers)) {
        return {
          par: depth, proof: w.shots.map((s) => Math.round(s.a / DEG * 100) / 100),
          winFrac: Math.max(...winsByPrefix) / ANGLES.length, firstHitFrac, maxCombo: w.maxCombo, sims, glass: g0,
        };
      }
    }
    // next frontier: least glass left, diverse
    cands.sort((a, b) => a.glass - b.glass || b.maxCombo - a.maxCombo);
    const next = [];
    for (const c of cands) {
      if (c.won || c.glass >= c.parentGlass) continue;
      const la = c.shots[c.shots.length - 1].a;
      if (next.some((n) => n.glass === c.glass && Math.abs(n.shots[n.shots.length - 1].a - la) < 5 * DEG && n.shots.length === c.shots.length && sameprefix(n, c))) continue;
      next.push(c);
      if (next.length >= beam) break;
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}
function sameprefix(a, b) {
  for (let i = 0; i < a.shots.length - 1; i++) if (a.shots[i].a !== b.shots[i].a) return false;
  return true;
}
