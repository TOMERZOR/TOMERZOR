// Phone tilt, from the gyroscope with the accelerometer as the slow reference.
//
// We track the "up" direction in the phone's own axes. Every motion event the
// gyroscope rotates it (fast, smooth, no shake from your hand's movement) and the
// accelerometer pulls it gently back toward measured gravity (so it never drifts).
// The tilt we want is how far the screen's left-right axis leans, which reads the
// same whether you hold the phone flat or upright like a steering wheel.
//
// Browsers disagree on a couple of sign conventions, so each is checked live:
// the accelerometer's sign against the orientation sensor, and the gyroscope's
// direction by running both directions and keeping the one that agrees with gravity.

export const tilt = {
  source: 'none',   // 'gyro' | 'accel' | 'orientation' | 'touch' | 'keys'
  raw: 0,           // radians, + = right edge down, before calibration
  angle: 0,         // after calibration and sensitivity
  rate: 0,          // rad/s
  offset: 0,
  sensitivity: 1,
  invert: false,
  lastEvent: 0,
};

const DEG = Math.PI / 180;
let hyp = null;          // two candidate up-vectors, gyro sign +1 and -1
let err = [0, 0];
let accSign = 1, accVote = 0;
let orient = null;       // last deviceorientation beta/gamma
let lastT = 0;
let prevRaw = null, prevRawT = 0;
let touch = null;        // { x0, angle }
let keys = 0;
let jumpReq = false, jumpAt = 0;

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

function screenAngle() {
  const a = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (window.orientation || 0);
  return a * DEG;
}

// Lateral tilt of the screen from an up-vector in device axes.
function lateral(u) {
  const a = screenAngle();
  const right = u[0] * Math.cos(a) - u[1] * Math.sin(a);
  return Math.asin(Math.max(-1, Math.min(1, -right)));
}

function setRaw(v, now) {
  if (prevRaw !== null && now > prevRawT) {
    const r = (v - prevRaw) / ((now - prevRawT) / 1000);
    tilt.rate += (r - tilt.rate) * 0.35;
  }
  prevRaw = v;
  prevRawT = now;
  tilt.raw = v;
  tilt.lastEvent = now;
}

function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  orient = { beta: e.beta * DEG, gamma: e.gamma * DEG };
  // Only used for steering when there is no motion data at all.
  if (tilt.source === 'none' || tilt.source === 'orientation') {
    const b = orient.beta, g = orient.gamma;
    const up = [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
    tilt.source = 'orientation';
    setRaw(lateral(up), performance.now());
  }
}

function onMotion(e) {
  const ag = e.accelerationIncludingGravity;
  if (!ag || ag.x == null) return;
  const now = performance.now();
  const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0;
  lastT = now;

  let a = norm([ag.x, ag.y, ag.z]);

  // Spec: at rest the reading points up. Some browsers report it pointing down.
  if (orient && Math.abs(orient.beta) < 60 * DEG) {
    const b = orient.beta, g = orient.gamma;
    const upO = [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
    const d = a[0] * upO[0] + a[1] * upO[1] + a[2] * upO[2];
    if (Math.abs(d) > 0.6) accVote = Math.max(-20, Math.min(20, accVote + Math.sign(d)));
    if (accVote <= -5) accSign = -1; else if (accVote >= 5) accSign = 1;
  }
  a = a.map((x) => x * accSign);

  const rr = e.rotationRate;
  const hasGyro = rr && rr.alpha != null && rr.beta != null && rr.gamma != null;

  // A quick flick of the top of the phone toward you is a jump: a fast turn
  // about the screen's left-right axis, which ordinary balancing never makes.
  if (hasGyro) {
    const a = screenAngle();
    const pitch = Math.abs(rr.beta * Math.cos(a) - rr.gamma * Math.sin(a));
    if (pitch > 260 && now - jumpAt > 600) {
      jumpAt = now;
      jumpReq = true;
    }
  }
  if (!hyp) hyp = [a.slice(), a.slice()];

  if (hasGyro && dt > 0) {
    const w = [rr.beta * DEG, rr.gamma * DEG, rr.alpha * DEG];
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const u = hyp[i];
      // A world-fixed vector seen from the phone turns opposite to the phone: du = u × ω dt.
      const p = norm([
        u[0] + s * (u[1] * w[2] - u[2] * w[1]) * dt,
        u[1] + s * (u[2] * w[0] - u[0] * w[2]) * dt,
        u[2] + s * (u[0] * w[1] - u[1] * w[0]) * dt,
      ]);
      const e2 = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 + (p[2] - a[2]) ** 2;
      err[i] += (e2 - err[i]) * 0.02;
      const k = 0.02;
      hyp[i] = norm([p[0] + (a[0] - p[0]) * k, p[1] + (a[1] - p[1]) * k, p[2] + (a[2] - p[2]) * k]);
    }
    const best = err[1] < err[0] * 0.6 ? 1 : 0;
    tilt.source = 'gyro';
    setRaw(lateral(hyp[best]), now);
  } else {
    // No gyroscope: smooth the accelerometer instead.
    const u = hyp[0];
    const k = 0.25;
    hyp[0] = hyp[1] = norm([u[0] + (a[0] - u[0]) * k, u[1] + (a[1] - u[1]) * k, u[2] + (a[2] - u[2]) * k]);
    tilt.source = 'accel';
    setRaw(lateral(hyp[0]), now);
  }
}

// Must be called from a tap: iOS only asks for motion access inside a user gesture.
export async function enableSensors() {
  const asks = [];
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    asks.push(DeviceMotionEvent.requestPermission().catch(() => 'denied'));
  }
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    asks.push(DeviceOrientationEvent.requestPermission().catch(() => 'denied'));
  }
  const res = await Promise.all(asks);
  if (res.some((r) => r === 'denied')) return 'denied';
  window.addEventListener('devicemotion', onMotion);
  window.addEventListener('deviceorientation', onOrientation);
  // Wait briefly to see whether this device actually sends anything.
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 700));
  return tilt.lastEvent > t0 ? 'ok' : 'none';
}

export function hasMotion() {
  return tilt.source === 'gyro' || tilt.source === 'accel' || tilt.source === 'orientation';
}

// A jump was asked for since the last call (flick, swipe up or the space bar).
export function consumeJump() {
  const j = jumpReq;
  jumpReq = false;
  return j;
}
export function requestJump() {
  jumpReq = true;
}

// Fallback controls: drag on the screen, or the arrow keys on a computer.
export function enableFallback(el) {
  el.addEventListener('pointerdown', (e) => {
    if (hasMotion()) return;
    touch = { x0: e.clientX, id: e.pointerId };
    tilt.source = 'touch';
  });
  el.addEventListener('pointermove', (e) => {
    if (!touch || e.pointerId !== touch.id) return;
    const span = Math.min(window.innerWidth, 500) * 0.4;
    setRaw(Math.max(-1, Math.min(1, (e.clientX - touch.x0) / span)) * 0.6, performance.now());
  });
  const end = (e) => {
    if (!touch || e.pointerId !== touch.id) return;
    touch = null;
    setRaw(0, performance.now());
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !e.repeat) { jumpReq = true; return; }
    if (e.key === 'ArrowLeft') keys = -1;
    else if (e.key === 'ArrowRight') keys = 1;
    else return;
    if (!hasMotion()) tilt.source = 'keys';
  });
  window.addEventListener('keyup', (e) => {
    if ((e.key === 'ArrowLeft' && keys < 0) || (e.key === 'ArrowRight' && keys > 0)) keys = 0;
  });
}

// Call once per frame. Returns the calibrated tilt in radians.
export function readTilt(dt) {
  if (tilt.source === 'keys') {
    // Keys ease the virtual tilt toward ±0.2 rad, like a hand would.
    const target = keys * 0.2;
    setRaw(tilt.raw + (target - tilt.raw) * Math.min(1, dt * 6), performance.now());
  }
  const calibrated = tilt.source === 'touch' || tilt.source === 'keys' ? tilt.raw : tilt.raw - tilt.offset;
  tilt.angle = calibrated * tilt.sensitivity * (tilt.invert ? -1 : 1);
  if (performance.now() - prevRawT > 120) tilt.rate *= 0.8;
  return tilt.angle;
}

export function rateNow() {
  return tilt.rate * tilt.sensitivity * (tilt.invert ? -1 : 1);
}

// Whatever angle the phone is held at now becomes level.
export function calibrate() {
  tilt.offset = tilt.raw;
}
