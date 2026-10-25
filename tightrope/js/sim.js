// Balance and water physics. No DOM here, so the tests can run it in Node.
//
// The walker is an inverted pendulum seen from behind: theta is his sideways lean
// (rad, + = to the right). The player's tilt u pushes him the way the phone tips.
// The container sits on his head; the liquid surface is a damped pendulum (psi,
// world angle, + = right side lower) that wants to lie perpendicular to the
// container's effective gravity. When the surface tilts past the rim relative to
// the container, liquid pours out. A fuller container spills sooner.
//
// On the rope: coins and water drops to grab by leaning, knots that jolt him,
// hurdles to jump, an ibex coming the other way, and rain clouds that refill.

export const GRAV = 9.81;
export const HEAD = 1.8;            // container height above the rope (m)
// Tunables (exported so the tests can try alternatives).
// Tuned against a population of simulated ordinary players (test/human.mjs):
// strong damping makes the phone steer how fast he leans rather than how hard
// he is pushed, which people with a 0.3 s reaction time handle well, and a lean
// drifts away on its own over a few seconds instead of one.
export const TUNE = {
  control: 8,       // rad/s² of lean per radian of phone tilt
  damp: 5,          // the walker's own steadiness
  freeboard: 0.02,  // extra room above the liquid (m)
  dist: 1.2,        // scale on wind, birds and other pushes
  instab: 1.2,      // scale on how fast a lean grows on its own
};
export const MAX_TILT = 0.6;        // input is clamped to about 34°
export const FALL_ANGLE = 0.95;     // past ~54° he is gone
const SLOSH_LEVER = 1.0;            // how much of the head's swing reaches the liquid
const JERK = 0.35;                  // a fast flick of the phone shakes the liquid directly
const STEP_LEN = 0.62;
const REACH = 1.95;                 // head (and container) distance from the feet
const RUN_SPEED = 1.7;
export const JUMP_TIME = 0.55;

// How each container and liquid behaves. freq/damp: slosh; freeboard, depth,
// radius: container shape (m); spill: how fast it pours; instab/speed: the
// carrier's balance and pace; fish: random kicks from inside.
export const LIQUIDS = {
  water: { freq: 7, damp: 2.0, freeboard: 0.028, depth: 0.2, radius: 0.16, spill: 1, instab: 1, speed: 1, fish: 0 },
  champagne: { freq: 10, damp: 2.6, freeboard: 0.022, depth: 0.16, radius: 0.13, spill: 0.75, instab: 0.95, speed: 1.05, fish: 0 },
  soup: { freq: 4.6, damp: 1.7, freeboard: 0.045, depth: 0.2, radius: 0.2, spill: 1.1, instab: 1.05, speed: 0.92, fish: 0 },
  fishbowl: { freq: 7.5, damp: 1.8, freeboard: 0.03, depth: 0.18, radius: 0.14, spill: 1, instab: 0.85, speed: 1.1, fish: 1 },
  honey: { freq: 5, damp: 7, freeboard: 0.03, depth: 0.2, radius: 0.15, spill: 0.4, instab: 1.2, speed: 0.85, fish: 0 },
};

export function rimAngle(fill, liq = LIQUIDS.water) {
  return Math.atan2(liq.freeboard + TUNE.freeboard + (1 - fill) * liq.depth, liq.radius);
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lay out what the walker meets along this rope.
function populate(s) {
  const L = s.level, r = s.r, len = L.length;
  s.items = [];
  s.knots = [];
  s.hurdles = [];
  s.ibexes = [];
  s.clouds = [];
  const free = (z, gap) => !s.hurdles.some((h) => Math.abs(h.z - z) < gap) && !s.knots.some((k) => Math.abs(k - z) < gap);
  // Coin runs: a short line drifting out to one side and back, at head height.
  for (let z = 6 + r() * 4; z < len - 5; z += 7 + r() * 6) {
    const side = r() < 0.5 ? -1 : 1;
    const reach = 0.25 + r() * (0.25 + 0.15 * Math.min(1, z / len));
    for (let i = 0; i < 4; i++) {
      const a = Math.sin((i / 3) * Math.PI);
      s.items.push({ kind: 'coin', z: z + i * 0.9, x: side * (0.12 + reach * a), taken: false });
    }
  }
  // Water drops refill the container, but sit far out: you lean a long way for them.
  for (let i = 0; i < (L.orbs || 0); i++) {
    const z = 10 + (len - 18) * (i + 0.5 + (r() - 0.5) * 0.6) / L.orbs;
    s.items.push({ kind: 'orb', z, x: (r() < 0.5 ? -1 : 1) * (0.55 + r() * 0.25), taken: false });
  }
  for (let i = 0; i < (L.hurdles || 0); i++) {
    const z = 12 + (len - 20) * (i + 0.3 + r() * 0.4) / L.hurdles;
    if (free(z, 4)) s.hurdles.push({ z, done: false, cleared: false });
  }
  for (let i = 0; i < (L.knots || 0); i++) {
    const z = 8 + (len - 14) * (i + r()) / L.knots;
    if (free(z, 3)) s.knots.push(z);
  }
  s.knots.sort((a, b) => a - b);
  for (let i = 0; i < (L.ibex || 0); i++) {
    // Where they meet; the ibex sets off from further along.
    const meet = len * (0.35 + 0.4 * (i + r()) / L.ibex);
    s.ibexes.push({ meet, z: meet + 18, x: 0, state: 'wait', side: 0, t: 0 });
  }
  for (let i = 0; i < (L.rain || 0); i++) {
    const z0 = 10 + (len - 26) * (i + 0.2 + r() * 0.6) / L.rain;
    s.clouds.push({ z0, z1: z0 + 9, phase: r() * 6.28 });
  }
}

// opts.liquid: a LIQUIDS entry. opts.carry: { fill, score, coins } from the
// previous rope in endless mode.
export function createSim(level, seed = 1, opts = {}) {
  const r = rng(seed);
  const carry = opts.carry || {};
  const s = {
    level, r, liq: opts.liquid || LIQUIDS.water,
    t: 0, z: 0.2, speed: 0, theta: 0, omega: 0, alpha: 0,
    psi: 0, psiV: 0, fill: carry.fill ?? 1, spillRate: 0, spillSide: 0, spilled: 0, refill: 0,
    state: 'walk', fail: null,
    stepPhase: 0, stepEvent: false, events: [],
    wind: 0, windPhase: [r() * 6.28, r() * 6.28],
    gust: null, nextGust: level.gustEvery ? 2.5 + level.gustEvery * (0.5 + r()) : Infinity,
    bird: null, nextBird: level.birdEvery ? 4 + level.birdEvery * (0.4 + r() * 0.6) : Infinity,
    nextFish: 3 + r() * 3,
    swayX: 0, swayA: 0, swayPhase: r() * 6.28,
    u: 0, maxLean: 0,
    running: false, air: 0, jumpCool: 0,
    score: carry.score || 0, coins: 0, steady: 0, mult: 1, bestMult: 1,
  };
  s.startFill = s.fill;
  populate(s);
  return s;
}

function gustValue(g, t) {
  if (!g || t < g.t0 || t > g.t0 + g.dur) return 0;
  const k = Math.sin(Math.PI * (t - g.t0) / g.dur);
  return g.amp * k * k;
}

// Seconds until the next gust starts (for the HUD warning), and its side.
export function gustWarning(s) {
  const g = s.gust;
  if (!g || s.t >= g.t0) return null;
  return { in: g.t0 - s.t, side: Math.sign(g.amp) };
}

function schedule(s) {
  const L = s.level, r = s.r;
  if (s.t >= s.nextGust - 1.4 && !s.gust) {
    const side = r() < 0.5 ? -1 : 1;
    s.gust = { t0: s.nextGust, dur: 1.6 + r() * 1.6, amp: side * L.gust * (0.7 + r() * 0.6) };
  }
  if (s.gust && s.t > s.gust.t0 + s.gust.dur) {
    s.gust = null;
    s.nextGust = s.t + L.gustEvery * (0.6 + r() * 0.8);
  }
  if (s.t >= s.nextBird && !s.bird) {
    s.bird = { side: r() < 0.5 ? -1 : 1, t0: s.t, land: 1.4, sit: 3 + r() * 2.2, leave: 1.1 };
  }
  if (s.bird && s.t > s.bird.t0 + s.bird.land + s.bird.sit + s.bird.leave) {
    s.bird = null;
    s.nextBird = s.t + L.birdEvery * (0.7 + r() * 0.6);
  }
}

// How much of the bird's weight is on the pole right now (0..1).
export function birdLoad(s) {
  const b = s.bird;
  if (!b) return 0;
  const a = s.t - b.t0 - b.land;
  if (a < 0 || a > b.sit) return 0;
  return Math.min(1, a / 0.3, (b.sit - a) / 0.3);
}

// Where the head (and the container on it) is, sideways from the rope.
export function headX(s) {
  return s.swayX + Math.sin(s.theta) * REACH;
}

// The rain stream under a cloud drifts slowly from side to side.
export function rainX(c, t) {
  return Math.sin(t * 0.55 + c.phase) * 0.45;
}

function kick(s, lean, slosh) {
  const side = s.r() < 0.5 ? -1 : 1;
  s.omega += side * lean;
  s.psiV += (s.r() < 0.5 ? -1 : 1) * slosh;
}

// One fixed physics step. u: player tilt (rad, calibrated), uRate: its rate (rad/s).
// input: { run, jump } — hold to run, jump is a one-shot request.
export function stepSim(s, dt, u, uRate, input = {}) {
  if (s.state !== 'walk') return;
  const L = s.level, liq = s.liq;
  s.t += dt;
  s.stepEvent = false;
  schedule(s);

  u = Math.max(-MAX_TILT, Math.min(MAX_TILT, u));
  s.u = u;
  uRate = Math.max(-8, Math.min(8, uRate));

  // Wind: a slow wander around the base strength plus gusts.
  const base = L.wind * (0.7 * Math.sin(0.21 * s.t + s.windPhase[0]) + 0.45 * Math.sin(0.57 * s.t + s.windPhase[1]));
  s.wind = base + gustValue(s.gust, s.t);

  // Rope swing under his feet, strongest mid-span.
  const span = Math.max(0, Math.min(1, s.z / L.length));
  const env = 4 * span * (1 - span);
  const w = 2 * Math.PI * 0.5;
  s.swayX = L.sway * env * Math.sin(w * s.t + s.swayPhase);
  const ropeAcc = s.air > 0 ? 0 : -w * w * s.swayX;

  const bird = birdLoad(s) * (s.bird ? s.bird.side : 0) * 0.75;

  s.alpha = L.instab * liq.instab * TUNE.instab * Math.sin(s.theta) + TUNE.control * u - TUNE.damp * s.omega
    + (s.wind + bird) * TUNE.dist - ropeAcc / HEAD;
  s.omega += s.alpha * dt;
  s.theta += s.omega * dt;
  s.maxLean = Math.max(s.maxLean, Math.abs(s.theta));

  // Walking: he slows down while he is leaning hard. Running is faster and bouncier.
  s.running = !!input.run;
  const ramp = Math.min(1, s.t / 1.2);
  const pace = L.speed * liq.speed * (s.running ? RUN_SPEED : 1);
  s.speed = pace * ramp * Math.max(0.12, 1 - Math.abs(s.theta) / 0.7);
  const z0 = s.z;
  s.z += s.speed * dt;

  // Jumping: a flick of the phone lifts him off the rope for a moment.
  s.jumpCool = Math.max(0, s.jumpCool - dt);
  if (input.jump && s.air <= 0 && s.jumpCool <= 0) {
    s.air = JUMP_TIME;
    s.jumpCool = 0.3;
    s.psiV += (s.r() - 0.5) * 0.8;
    s.events.push({ type: 'jump' });
  }
  if (s.air > 0) {
    s.air -= dt;
    if (s.air <= 0) {
      kick(s, 0.1, 0.7);
      s.events.push({ type: 'land' });
    }
  } else {
    const before = Math.floor(s.stepPhase);
    s.stepPhase += s.speed * dt / STEP_LEN;
    if (Math.floor(s.stepPhase) !== before) {
      s.stepEvent = true;
      s.omega += (s.r() - 0.5) * (0.07 + 0.05 * L.instab) * (s.running ? 1.8 : 1);
      if (s.running) s.psiV += (s.r() - 0.5) * 0.9;
    }
  }

  // Knots jolt him as he steps over them (in the air he sails past).
  for (const k of s.knots) {
    if (k > z0 && k <= s.z && s.air <= 0) {
      kick(s, 0.22, 0.7);
      s.events.push({ type: 'knot' });
    }
  }
  // Hurdles: jump them or trip.
  for (const h of s.hurdles) {
    if (h.done || s.z < h.z - 0.25) continue;
    h.done = true;
    if (s.air > 0) {
      h.cleared = true;
      s.score += 100 * s.mult;
      s.events.push({ type: 'hurdle', points: 100 * s.mult });
    } else {
      kick(s, 0.85, 2.4);
      s.steady = 0;
      s.events.push({ type: 'trip' });
    }
  }
  // The ibex walks toward him and squeezes past on the side he makes room on.
  for (const b of s.ibexes) {
    if (b.state === 'wait' && s.z > b.meet - 22) b.state = 'come';
    if (b.state === 'come') {
      b.z -= 0.9 * dt;
      if (b.z - s.z < 0.55) {
        if (Math.abs(s.theta) > 0.1) {
          b.side = -Math.sign(s.theta);
          s.score += 150 * s.mult;
          s.events.push({ type: 'ibexPass', points: 150 * s.mult });
        } else {
          b.side = s.r() < 0.5 ? -1 : 1;
          s.omega += -b.side * 0.7;
          s.psiV += -b.side * 1.6;
          s.steady = 0;
          s.events.push({ type: 'ibexBump' });
        }
        b.state = 'pass';
        b.t = 0;
      }
    } else if (b.state === 'pass') {
      b.t += dt;
      b.z -= 1.4 * dt;
      b.x = b.side * Math.min(0.8, b.t * 2.5);
      if (b.t > 4) b.state = 'gone';
    }
  }

  // Grabbing things with the head.
  const hx = headX(s);
  for (const it of s.items) {
    if (it.taken || it.z < z0 - 0.4 || it.z > s.z + 0.4) continue;
    if (Math.abs(it.z - s.z) < 0.4 && Math.abs(it.x - hx) < 0.26) {
      it.taken = true;
      if (it.kind === 'coin') {
        s.coins++;
        s.score += 25 * s.mult;
        s.events.push({ type: 'coin', x: it.x });
      } else {
        s.fill = Math.min(1, s.fill + 0.05);
        s.events.push({ type: 'orb', x: it.x });
      }
    }
  }
  // Rain refills while the container is under the stream.
  s.refill = 0;
  for (const c of s.clouds) {
    if (s.z < c.z0 || s.z > c.z1) continue;
    if (Math.abs(rainX(c, s.t) - hx) < 0.2) {
      s.refill = 0.06;
      s.fill = Math.min(1, s.fill + s.refill * dt);
    }
  }

  // Liquid.
  if (liq.fish) {
    s.nextFish -= dt;
    if (s.nextFish <= 0) {
      s.psiV += (s.r() < 0.5 ? -1 : 1) * (2 + s.r() * 1.5);
      s.nextFish = 3 + s.r() * 4;
      s.events.push({ type: 'fish' });
    }
  }
  const aB = SLOSH_LEVER * s.alpha + ropeAcc + JERK * uRate;
  const psiEq = Math.atan(aB / GRAV);
  s.psiV += (-liq.freq * liq.freq * (s.psi - psiEq) - liq.damp * s.psiV) * dt;
  s.psi += s.psiV * dt;
  const rel = s.psi - s.theta;
  const rim = rimAngle(s.fill, liq);
  const excess = Math.abs(rel) - rim;
  s.spillRate = 0;
  if (excess > 0 && s.fill > 0) {
    s.spillRate = (1.5 * excess + 6 * excess * excess) * liq.spill;
    s.fill = Math.max(0, s.fill - s.spillRate * dt);
    s.spillSide = rel > 0 ? -1 : 1;  // surface low on the right means it pours over the left rim
    s.psiV *= Math.exp(-6 * dt);
  }
  s.spilled = 1 - s.fill;

  // Perfect balance builds a multiplier; a wobble or a spill resets it.
  const lean = Math.abs(s.theta);
  if (lean < 0.07 && s.spillRate === 0) s.steady += dt;
  else if (lean > 0.14 || s.spillRate > 0) s.steady = 0;
  const mult = 1 + Math.min(4, Math.floor(s.steady / 3));
  if (mult > s.mult) s.events.push({ type: 'mult', mult });
  else if (mult < s.mult) s.events.push({ type: 'multLost' });
  s.mult = mult;
  s.bestMult = Math.max(s.bestMult, mult);
  s.score += (s.z - z0) * 10 * mult * (s.running ? 2 : 1);

  if (Math.abs(s.theta) > FALL_ANGLE) {
    s.state = 'fallen';
    s.fail = 'fall';
  } else if (s.spilled > L.limit) {
    s.state = 'failed';
    s.fail = 'spill';
  } else if (s.z >= L.length) {
    s.z = L.length;
    s.state = 'won';
  }
}

// Stars for a finished level: by how much water is left under the limit.
export function starsFor(level, spilled) {
  const r = spilled / level.limit;
  return r < 0.34 ? 3 : r < 0.67 ? 2 : 1;
}

// Points added at the end of a rope for the liquid still in the container.
export function finishBonus(s) {
  return Math.round(s.fill * 500);
}
