// One level session: physics stepping, slingshot input, juice and event fan-out.
import * as planck from './vendor/planck.mjs';
import { createSim, previewPath, DT, W, MIN_ANGLE, MAX_ANGLE } from './engine.js';
import * as sfxReal from './audio.js';
import * as hapReal from './haptics.js';

const DEG = Math.PI / 180;
let quiet = false; // home-screen demo plays silently
const mute = (m) => new Proxy(m, { get: (t, k) => (quiet && typeof t[k] === 'function' ? () => {} : t[k]) });
const sfx = mute(sfxReal), hap = mute(hapReal);

export function createGame({ canvas, renderer, getSkin, onWin, onLose, onFirstShot, onBreak }) {
  let sim = null, level = null;
  let angle = 70 * DEG, aiming = false, aim = null, aimDirty = true;
  let start = null, cur = null, pointerId = null;
  let acc = 0, timeScale = 1, slowT = 0, shake = 0, shakeT = 0, flash = 0;
  let paused = false, ended = false, winTimer = -1, loseShown = false;
  let loadK = 1, hintAngle = null, recoil = 0;
  let lastHitSound = 0;
  let fired = 0;

  function load(lv, opts = {}) {
    level = lv;
    quiet = !!opts.quiet;
    sim = createSim(planck, lv, { visual: true });
    sim.__pal = opts.palette;
    renderer.setSim(sim);
    angle = (lv.launcher?.x ?? 4.5) < 4.5 ? 60 * DEG : (lv.launcher?.x ?? 4.5) > 4.5 ? 120 * DEG : 80 * DEG;
    aiming = false; aim = null; aimDirty = true;
    acc = 0; timeScale = 1; slowT = 0; shake = 0; flash = 0;
    paused = false; ended = false; winTimer = -1; loseShown = false;
    hintAngle = opts.hint != null ? opts.hint : null;
    fired = 0; recoil = 0; loadK = 1;
    if (hintAngle != null) angle = hintAngle;
  }

  // ---------- input ----------
  function pos(ev) {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }
  function onDown(ev) {
    if (!sim || quiet || paused || ended || sim.st.won || sim.st.balls <= 0) return;
    if (pointerId !== null) return;
    pointerId = ev.pointerId;
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    start = pos(ev); cur = start;
    aiming = true; aimDirty = true;
    sfx.resumeAudio();
    ev.preventDefault();
  }
  function pullVector() {
    const dx = start[0] - cur[0], dy = cur[1] - start[1];
    return [dx, dy, Math.hypot(dx, dy)];
  }
  function onMove(ev) {
    if (ev.pointerId !== pointerId || !aiming) return;
    cur = pos(ev);
    const [dx, dy, len] = pullVector();
    if (len > 10) {
      let a = Math.atan2(dy, dx);
      if (a < 0) a = a < -Math.PI / 2 ? MAX_ANGLE : MIN_ANGLE;
      a = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, a));
      if (Math.abs(a - angle) > 0.0005) {
        if (Math.floor(a / (2 * DEG)) !== Math.floor(angle / (2 * DEG))) hap.selection();
        angle = a; aimDirty = true;
      }
    }
    ev.preventDefault();
  }
  function onUp(ev) {
    if (ev.pointerId !== pointerId) return;
    pointerId = null;
    if (!aiming) return;
    aiming = false;
    const [, , len] = pullVector();
    if (len >= 26 && !paused && !ended) shoot();
    start = cur = null;
  }
  function onCancel(ev) { if (ev.pointerId === pointerId) { pointerId = null; aiming = false; start = cur = null; } }
  canvas.addEventListener('pointerdown', onDown, { passive: false });
  canvas.addEventListener('pointermove', onMove, { passive: false });
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('lostpointercapture', onCancel);

  function shoot() {
    const e = sim.fire(angle);
    if (!e) return;
    fired++;
    hintAngle = null;
    loadK = 0; recoil = 1;
    if (fired === 1) onFirstShot?.();
  }

  // ---------- events ----------
  function handle(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'fire': {
          sfx.fire(); hap.light();
          const m = 1.1;
          renderer.ring(sim.launcherX + Math.cos(ev.angle) * m, 0.42 + Math.sin(ev.angle) * m, 0.7, 'rgba(255,255,255,0.8)', 0.3, 0.07);
          ev.ball.trail = [];
          break;
        }
        case 'break': {
          const size = ev.sub === 'orb' ? 0.55 : ev.sub === 'pane' ? 0.5 : ev.sub === 'bottle' ? 0.7 : 0.65;
          sfx.shatter(ev.cx / W, size, Math.min(1, ev.speed / 14), ev.combo);
          hap.medium();
          const rgb = sim.__pal?.glass?.[(ev.tint || 0) % 3] || [200, 230, 255];
          renderer.burst(ev.cx, ev.cy, 14, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.9)`, 4.5, 0.07, 0.8);
          renderer.burst(ev.cx, ev.cy, 6, 'rgba(255,255,255,0.95)', 3, 0.05, 0.6);
          renderer.sparkle(ev.cx, ev.cy, 5);
          renderer.ring(ev.cx, ev.cy, 0.9, 'rgba(255,255,255,0.85)', 0.35, 0.06);
          if (ev.combo >= 2) renderer.text(ev.cx, ev.cy + 0.6, '×' + ev.combo, sim.__pal?.accent || '#FF7A59', 0.42 + Math.min(0.35, ev.combo * 0.04), 0.9);
          if (ev.combo >= 3) { shake = Math.max(shake, 0.05 + ev.combo * 0.01); shakeT = 0.18; }
          onBreak?.(ev);
          if (ev.last) {
            slowT = 1.0; timeScale = 0.2; flash = 0.35;
            hap.heavy();
            renderer.ring(ev.cx, ev.cy, 3.2, sim.__pal?.accent || '#fff', 0.9, 0.12);
            renderer.sparkle(ev.cx, ev.cy, 14);
          }
          break;
        }
        case 'explode': {
          sfx.boom(ev.x / W); hap.heavy();
          shake = 0.28; shakeT = 0.4; flash = Math.max(flash, 0.2);
          renderer.ring(ev.x, ev.y, ev.r, sim.__pal?.accent || '#FF4D3D', 0.5, 0.25);
          renderer.ring(ev.x, ev.y, ev.r * 0.7, 'rgba(255,255,255,0.9)', 0.35, 0.12);
          renderer.burst(ev.x, ev.y, 26, sim.__pal?.accent || '#FF4D3D', 7, 0.1, 0.7, 0.4);
          renderer.burst(ev.x, ev.y, 16, 'rgba(60,50,60,0.35)', 3, 0.18, 1.0, -0.05);
          break;
        }
        case 'hit': {
          const now = performance.now();
          if (now - lastHitSound > 45) { lastHitSound = now; sfx.hit(ev.a, ev.b, ev.speed, ev.x / W); }
          if ((ev.a === 'ball' || ev.b === 'ball') && ev.speed > 6) renderer.burst(ev.x, ev.y, 3, 'rgba(255,255,255,0.8)', 2, 0.04, 0.3);
          if (ev.a === 'pad' || ev.b === 'pad') { renderer.ring(ev.x, ev.y, 0.8, sim.__pal?.accent || '#fff', 0.3, 0.08); hap.light(); }
          break;
        }
        case 'ballGone':
          if (ev.x != null) renderer.burst(ev.x, ev.y, 6, 'rgba(255,255,255,0.7)', 1.5, 0.05, 0.4);
          break;
        case 'win':
          winTimer = 1.25;
          break;
        case 'lose':
          if (!loseShown) { loseShown = true; ended = true; setTimeout(() => { sfx.lose(); onLose?.(); }, 250); }
          break;
      }
    }
  }

  function frame(dtReal) {
    if (!sim) return;
    dtReal = Math.min(dtReal, 0.05);
    if (!paused) {
      if (slowT > 0) {
        slowT -= dtReal;
        timeScale = slowT > 0.35 ? 0.2 : 0.2 + (1 - slowT / 0.35) * 0.8;
        if (slowT <= 0) timeScale = 1;
      }
      acc += dtReal * timeScale;
      let n = 0;
      while (acc >= DT && n < 4) {
        snapshot();
        handle(sim.step());
        acc -= DT; n++;
      }
      if (n === 4) acc = 0;
      if (winTimer > 0) {
        winTimer -= dtReal;
        if (winTimer <= 0 && !ended) { ended = true; sfx.win(); hap.success(); onWin?.(result()); }
      }
      // trails
      for (const e of sim.ents) {
        if (!e.alive || e.kind !== 'ball' || !e.trail) continue;
        const p = e.body.getPosition();
        e.trail.push([p.x, p.y]);
        if (e.trail.length > 12) e.trail.shift();
      }
      if (loadK < 1) loadK = Math.min(1, loadK + dtReal * 3.5);
      recoil = Math.max(0, recoil - dtReal * 6);
    }
    if (shakeT > 0) shakeT -= dtReal; else shake *= 0.85;
    flash = Math.max(0, flash - dtReal * 1.6);
    if (aiming && aimDirty) { aim = previewPath(planck, sim, angle); aimDirty = false; }
    const sx = shake > 0.001 ? (Math.random() - 0.5) * shake * renderer.scale : 0;
    const sy = shake > 0.001 ? (Math.random() - 0.5) * shake * renderer.scale : 0;
    renderer.setFlash(flash);
    renderer.draw(sim, {
      alpha: paused ? 1 : acc / DT, fxDt: paused ? 0 : dtReal * Math.max(timeScale, 0.35),
      aim: aiming ? aim : null, angle, skin: getSkin(), loadK, hintAngle,
      shakeX: sx, shakeY: sy, recoil, hideLauncher: quiet,
    });
  }

  function snapshot() {
    for (const e of sim.ents) {
      if (!e.alive) continue;
      const t = e.body.getType();
      if (t === 'static') continue;
      const p = e.body.getPosition();
      e.px = p.x; e.py = p.y; e.pa = e.body.getAngle();
    }
    for (const e of sim.shards) {
      if (!e.alive) continue;
      const p = e.body.getPosition();
      e.px = p.x; e.py = p.y; e.pa = e.body.getAngle();
    }
  }

  function result() {
    const used = sim.st.used;
    const par = level.par ?? used;
    const stars = used <= par ? 3 : used === par + 1 ? 2 : 1;
    return { used, par, stars, maxCombo: sim.st.maxCombo, broken: sim.st.broken };
  }

  return {
    load, frame,
    get sim() { return sim; },
    get level() { return level; },
    setPalette(p) { if (sim) sim.__pal = p; },
    pause() { paused = true; aiming = false; pointerId = null; },
    resume() { paused = false; },
    get paused() { return paused; },
    addBall() { sim.addBall(); ended = false; loseShown = false; },
    showHint(a) { hintAngle = a; angle = a; aimDirty = true; },
    get fired() { return fired; },
  };
}
