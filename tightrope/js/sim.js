// Balance and water physics. No DOM here, so the tests can run it in Node.
//
// The walker is an inverted pendulum seen from behind: theta is his sideways lean
// (rad, + = to the right). The player's tilt u pushes him the way the phone tips.
// The bucket sits on his head; the water surface is a damped pendulum (psi, world
// angle, + = right side lower) that wants to lie perpendicular to the bucket's
// effective gravity. When the surface tilts past the rim relative to the bucket,
// water pours out. A fuller bucket has less freeboard, so it spills sooner.

export const GRAV = 9.81;
export const HEAD = 1.8;            // bucket height above the rope (m)
export const CONTROL = 5;           // rad/s² of lean per radian of phone tilt
export const DAMP = 1.6;            // the walker's own steadiness
export const MAX_TILT = 0.6;        // input is clamped to about 34°
export const FALL_ANGLE = 0.95;     // past ~54° he is gone
export const BUCKET = { radius: 0.16, depth: 0.2, freeboard: 0.028 };
const SLOSH_FREQ = 7;               // rad/s, about 1.1 Hz
const SLOSH_DAMP = 2.0;
const SLOSH_LEVER = 1.0;           // how much of the head's swing reaches the water (the neck absorbs some)
const JERK = 0.35;                  // a fast flick of the phone shakes the water directly
const STEP_LEN = 0.62;

export function rimAngle(fill) {
  return Math.atan2(BUCKET.freeboard + (1 - fill) * BUCKET.depth, BUCKET.radius);
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

export function createSim(level, seed = 1) {
  const r = rng(seed);
  const s = {
    level, r,
    t: 0, z: 0.2, speed: 0, theta: 0, omega: 0, alpha: 0,
    psi: 0, psiV: 0, fill: 1, spillRate: 0, spillSide: 0, spilled: 0,
    state: 'walk', fail: null,
    stepPhase: 0, stepEvent: false,
    wind: 0, windPhase: [r() * 6.28, r() * 6.28],
    gust: null, nextGust: level.gustEvery ? 2.5 + level.gustEvery * (0.5 + r()) : Infinity,
    bird: null, nextBird: level.birdEvery ? 4 + level.birdEvery * (0.4 + r() * 0.6) : Infinity,
    swayX: 0, swayA: 0, swayPhase: r() * 6.28,
    u: 0, maxLean: 0,
  };
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

// One fixed physics step. u: player tilt (rad, calibrated), uRate: its rate (rad/s).
export function stepSim(s, dt, u, uRate) {
  if (s.state !== 'walk') return;
  const L = s.level;
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
  const ropeAcc = -w * w * s.swayX;

  const bird = birdLoad(s) * (s.bird ? s.bird.side : 0) * 0.75;

  s.alpha = L.instab * Math.sin(s.theta) + CONTROL * u - DAMP * s.omega
    + s.wind + bird - ropeAcc / HEAD;
  s.omega += s.alpha * dt;
  s.theta += s.omega * dt;
  s.maxLean = Math.max(s.maxLean, Math.abs(s.theta));

  // Walking: he slows down while he is leaning hard.
  const ramp = Math.min(1, s.t / 1.2);
  s.speed = L.speed * ramp * Math.max(0.12, 1 - Math.abs(s.theta) / 0.7);
  s.z += s.speed * dt;
  const before = Math.floor(s.stepPhase);
  s.stepPhase += s.speed * dt / STEP_LEN;
  if (Math.floor(s.stepPhase) !== before) {
    s.stepEvent = true;
    s.omega += (s.r() - 0.5) * (0.07 + 0.05 * L.instab);
  }

  // Water.
  const aB = SLOSH_LEVER * s.alpha + ropeAcc + JERK * uRate;
  const psiEq = Math.atan(aB / GRAV);
  s.psiV += (-SLOSH_FREQ * SLOSH_FREQ * (s.psi - psiEq) - SLOSH_DAMP * s.psiV) * dt;
  s.psi += s.psiV * dt;
  const rel = s.psi - s.theta;
  const rim = rimAngle(s.fill);
  const excess = Math.abs(rel) - rim;
  s.spillRate = 0;
  if (excess > 0 && s.fill > 0) {
    s.spillRate = 1.5 * excess + 6 * excess * excess;
    s.fill = Math.max(0, s.fill - s.spillRate * dt);
    s.spillSide = rel > 0 ? -1 : 1;  // surface low on the right means it pours over the left rim
    s.psiV *= Math.exp(-6 * dt);
  }
  s.spilled = 1 - s.fill;

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
