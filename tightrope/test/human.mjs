// A population of simulated ordinary players, to judge whether the game is fair
// for normal people rather than for a perfect controller.
//
// Each "person" gets their own traits, drawn from ranges typical of people
// steering something on a screen with their hands:
// - reaction delay ~0.3 s between seeing a lean and the hand starting to move
// - corrections in discrete moves every 0.2-0.45 s, not continuously
// - leans under ~1.5° go unnoticed; speed of the lean is judged poorly
// - response strength that is personal and not optimal: people learn roughly
//   how strongly the game responds, then aim to undo a lean in 0.6-1.6 s
//   (some push too little, some too much)
// - the hand gets to a new angle in ~0.15 s, overshoots by a random amount,
//   shakes slightly (tremor), and the resting grip drifts slowly
// - jumps are timed by eye, with ~0.15 s of error
// - many go for coins; everyone makes room for the ibex, a bit late
//
// Run: node tightrope/test/human.mjs [--quick] for a per-level report;
// test/balance.mjs uses it to check the difficulty curve.
import { LEVELS } from '../js/levels.js';
import { createSim, stepSim, LIQUIDS, rng, TUNE } from '../js/sim.js';

const DT = 1 / 240;
const QUICK = process.argv.includes('--quick');
const PEOPLE = QUICK ? 16 : 40;

const gauss = (r) => {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export function makePerson(seed) {
  const r = rng(seed * 2654435761);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  return {
    r,
    delay: clamp(0.3 + gauss(r) * 0.05, 0.2, 0.45),
    interval: [0.2, 0.45],
    deadZone: clamp(0.026 + gauss(r) * 0.008, 0.01, 0.05),
    velGain: clamp(0.55 + gauss(r) * 0.2, 0.15, 1),
    // How fast they try to undo a lean (1/s), and how much they react to its speed.
    skill: clamp(1.0 + gauss(r) * 0.3, 0.6, 1.7),
    kdSkill: clamp(0.3 + gauss(r) * 0.1, 0.05, 0.6),
    hand: clamp(0.15 + gauss(r) * 0.03, 0.08, 0.25),
    motorNoise: clamp(0.18 + gauss(r) * 0.05, 0.05, 0.35),
    tremor: 0.006,
    drift: 0.02,
    maxTilt: clamp(0.45 + gauss(r) * 0.08, 0.3, 0.6),
    jumpErr: 0.15,
    greedy: r() < 0.6,
  };
}

export function playHuman(level, person, seed, liquid = LIQUIDS.water, carry) {
  const s = createSim(level, seed, { liquid, carry });
  const p = person, r = rng(seed * 7 + 3);
  const hist = [];
  let u = 0, prevU = 0, target = 0, nextMove = 0, bias = 0;
  let tremorPhase = r() * 6.28;
  const lag = Math.round(p.delay / DT);
  const jumpPlan = new Map();
  while (s.state === 'walk' && s.t < 400) {
    hist.push([s.theta, s.omega]);
    const [th, om] = hist[Math.max(0, hist.length - 1 - lag)];
    // Discrete corrections: a new aim every 0.2-0.45 s.
    if (s.t >= nextMove) {
      nextMove = s.t + p.interval[0] + r() * (p.interval[1] - p.interval[0]);
      let seen = th + gauss(r) * 0.01;
      if (Math.abs(seen) < p.deadZone) seen = 0;
      const seenVel = om * p.velGain + gauss(r) * 0.05;
      let aim = 0;
      // Make room for the ibex once it is close (a beat late).
      const ibex = s.ibexes.find((b) => b.state === 'come' && b.z - s.z < 1.8);
      if (ibex) aim = 0.2;
      // Go for a coin that is close and not too far out.
      if (p.greedy) {
        const coin = s.items.find((it) => it.kind === 'coin' && !it.taken && it.z - s.z > 0.5 && it.z - s.z < 2.5 && Math.abs(it.x) < 0.45);
        if (coin) aim = Math.asin(coin.x / 1.95) * 0.7;
      }
      // Tilt needed to undo the lean in about 1/skill seconds, for this game's response.
      const gain = TUNE.damp / TUNE.control;
      target = -(p.skill * gain * (seen - aim) + p.kdSkill * gain * seenVel);
      target *= 1 + gauss(r) * p.motorNoise;
      target = Math.max(-p.maxTilt, Math.min(p.maxTilt, target));
    }
    bias += gauss(r) * p.drift * Math.sqrt(DT);
    bias *= Math.exp(-DT / 8);
    tremorPhase += 2 * Math.PI * 9 * DT;
    const k = 1 - Math.exp(-DT / p.hand);
    u += (target - u) * k;
    const out = u + bias + Math.sin(tremorPhase) * p.tremor;
    const uRate = (out - prevU) / DT;
    prevU = out;
    // Jumps: timed by eye.
    let jump = false;
    for (const h of s.hurdles) {
      if (h.done) continue;
      if (!jumpPlan.has(h)) jumpPlan.set(h, 0.28 + gauss(r) * p.jumpErr);
      const timeTo = (h.z - 0.25 - s.z) / Math.max(0.3, s.speed);
      if (timeTo < jumpPlan.get(h) && !h.tried) { h.tried = true; jump = true; }
    }
    stepSim(s, DT, out, uRate, { jump });
  }
  return s;
}

export function survey(levels, liquid = LIQUIDS.water, people = PEOPLE, tries = 2) {
  return levels.map((L) => {
    let won = 0, n = 0, falls = 0, spilled = 0, big = 0, steps = 0;
    for (let i = 0; i < people; i++) {
      const person = makePerson(i + 1);
      for (let k = 0; k < tries; k++) {
        const s = playHuman(L, person, 1000 * i + 17 * k + L.id, liquid);
        n++;
        if (s.state === 'won') won++;
        if (s.fail === 'fall') falls++;
        spilled += s.spilled;
        big += s.maxLean > 0.35 ? 1 : 0;
      }
    }
    return { id: L.id, win: won / n, fall: falls / n, spilled: spilled / n, wild: big / n };
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  console.log(`${PEOPLE} simulated people, 2 tries each per level\n`);
  console.log('level   pass   falls   avg spilled   leaned >20°');
  const rows = survey(LEVELS);
  for (const r of rows) {
    console.log(`${String(r.id).padEnd(6)} ${(r.win * 100).toFixed(0).padStart(4)}%  ${(r.fall * 100).toFixed(0).padStart(5)}%  ${(r.spilled * 100).toFixed(1).padStart(10)}%  ${(r.wild * 100).toFixed(0).padStart(9)}%`);
  }
}
