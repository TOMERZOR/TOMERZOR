// One level session: physics stepping, slingshot input, juice and event fan-out.
import * as planck from './vendor/planck.js';
import { createSim, ghostPath, DT, W, MIN_ANGLE, MAX_ANGLE } from './engine.js';
import * as sfxReal from './audio.js';
import * as hapReal from './haptics.js';

const DEG = Math.PI / 180;
let quiet = false; // home-screen demo plays silently
// sounds can be silenced (home demo) and logged (trailer capture: window.__sfxLog)
const mute = (m) => new Proxy(m, {
  get: (t, k) => {
    const fn = t[k];
    if (typeof fn !== 'function') return fn;
    return (...a) => {
      if (window.__sfxLog && !quiet) window.__sfxLog.push({ k, a, t: window.__simClock || 0 });
      return quiet ? undefined : fn(...a);
    };
  },
});
const sfx = mute(sfxReal), hap = mute(hapReal);
const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createGame({ canvas, renderer, getSkin, onWin, onLose, onFirstShot, onBreak }) {
  let sim = null, level = null;
  let angle = 70 * DEG, aiming = false, aim = null, aimDirty = true;
  let start = null, cur = null, pointerId = null;
  let acc = 0, timeScale = 1, slowT = 0, shake = 0, shakeT = 0, flash = 0;
  let paused = false, ended = false, winTimer = -1, loseShown = false;
  let loadK = 1, hintAngle = null, recoil = 0;
  let lastHitSound = 0, lastHap = 0;
  let fired = 0, loads = 0;
  let stopT = 0, stopBudget = 0; // hit-stop: a brief freeze that gives impacts weight

  function load(lv, opts = {}) {
    level = lv;
    quiet = !!opts.quiet;
    sim = createSim(planck, lv, { visual: true });
    sim.__pal = opts.palette;
    const intro = renderer.setSim(sim);
    // a soft run of glass notes as the level assembles
    const token = ++loads, notes = Math.min(intro.n, 6);
    if (!quiet && notes && !calm()) for (let j = 0; j < notes; j++) {
      const at = intro.delay + (notes > 1 ? (j * (intro.n - 1)) / (notes - 1) : 0) * intro.step;
      setTimeout(() => { if (token === loads) sfx.tink(j); }, at * 1000);
    }
    angle = (lv.launcher?.x ?? 4.5) < 4.5 ? 60 * DEG : (lv.launcher?.x ?? 4.5) > 4.5 ? 120 * DEG : 80 * DEG;
    aiming = false; aim = null; aimDirty = true;
    acc = 0; timeScale = 1; slowT = 0; shake = 0; flash = 0; stopT = 0; stopBudget = 0;
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
      // a hint line is magnetic: close enough snaps exactly onto the proven angle
      if (hintAngle != null && Math.abs(a - hintAngle) < 1.5 * DEG) {
        if (angle !== hintAngle) hap.light();
        a = hintAngle;
      }
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
          stopBudget = 0.24;
          const m = 1.05;
          renderer.muzzle(sim.launcherX + Math.cos(ev.angle) * m, 0.42 + Math.sin(ev.angle) * m, ev.angle);
          ev.ball.trail = [];
          break;
        }
        case 'break': {
          const size = ev.sub === 'orb' ? 0.55 : ev.sub === 'pane' ? 0.5 : ev.sub === 'bottle' ? 0.7 : 0.65;
          const power = Math.min(1, ev.speed / 14);
          sfx.shatter(ev.cx / W, size, power, ev.combo);
          const rgb = sim.__pal?.glass?.[(ev.tint || 0) % 3] || [200, 230, 255];
          renderer.shatter(ev.x, ev.y, rgb, power, ev.last);
          renderer.combo(ev.combo, ev.cx, ev.cy);
          renderer.punch(ev.cx, ev.cy, Math.min(1, 0.35 + power * 0.3 + ev.combo * 0.08));
          // touch escalates with the chain, without buzzing on every piece of a collapse
          const now = performance.now();
          if (now - lastHap > 55) { lastHap = now; if (ev.combo >= 6) hap.heavy(); else if (ev.combo >= 3 || power > 0.6) hap.medium(); else hap.light(); }
          if (ev.combo >= 3) { shake = Math.max(shake, 0.04 + Math.min(0.06, ev.combo * 0.008)); shakeT = 0.16; }
          if (!ev.last && (ev.combo >= 3 || power > 0.75)) hitStop(0.03 + Math.min(0.04, ev.combo * 0.006));
          onBreak?.(ev);
          if (ev.last) {
            slowT = 1.0; timeScale = 0.2; flash = 0.22;
            hap.heavy(); sfx.slowmo();
            renderer.focus(ev.cx, ev.cy, 1.06, 1.05);
            renderer.ring(ev.cx, ev.cy, 3.2, sim.__pal?.accent || '#fff', 0.9, 0.12);
            renderer.sparkle(ev.cx, ev.cy, 14);
          }
          break;
        }
        case 'explode': {
          sfx.boom(ev.x / W); hap.heavy();
          shake = 0.28; shakeT = 0.4; flash = Math.max(flash, 0.16);
          hitStop(0.06);
          renderer.explosion(ev.x, ev.y, ev.r, !!sim.__pal?.dark);
          renderer.ring(ev.x, ev.y, ev.r, sim.__pal?.accent || '#FF4D3D', 0.5, 0.25);
          renderer.ring(ev.x, ev.y, ev.r * 0.7, 'rgba(255,255,255,0.9)', 0.35, 0.12);
          renderer.punch(ev.x, ev.y, 1);
          break;
        }
        case 'hit': {
          const now = performance.now();
          if (now - lastHitSound > 45) { lastHitSound = now; sfx.hit(ev.a, ev.b, ev.speed, ev.x / W); }
          if (ev.a === 'ball' || ev.b === 'ball') {
            if (ev.speed > 4) renderer.ballHit(ev.x, ev.y, ev.speed);
            if (ev.speed > 6) renderer.sparks(ev.x, ev.y, 4 + Math.min(4, (ev.speed - 6) | 0), 2.5 + ev.speed * 0.15);
          }
          if (ev.a === 'pad' || ev.b === 'pad') { renderer.ring(ev.x, ev.y, 0.8, sim.__pal?.accent || '#fff', 0.3, 0.08); renderer.padHit(ev.x, ev.y); hap.light(); }
          break;
        }
        case 'ballGone':
          if (ev.x != null) renderer.burst(ev.x, ev.y, 6, 'rgba(255,255,255,0.7)', 1.5, 0.05, 0.4);
          break;
        case 'win':
          if (quiet) break; // the home-screen demo never reports results
          winTimer = 1.25;
          // glass that kept rolling after a lose can still finish the level: the win replaces the lose
          if (loseShown) { ended = false; loseShown = false; }
          break;
        case 'lose':
          if (quiet || loseShown) break;
          loseShown = true; ended = true;
          {
            // the lose sheet belongs to this session only, and only if nothing won in the meantime
            const s = sim;
            setTimeout(() => { if (sim !== s || s.st.won || paused) return; sfx.lose(); hap.warning(); onLose?.(); }, 250);
          }
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
      if (stopT > 0) stopT -= dtReal; else acc += dtReal * timeScale;
      let n = 0;
      while (acc >= DT && n < 4) {
        snapshot();
        handle(sim.step());
        acc -= DT; n++;
      }
      if (n === 4) acc = 0;
      if (winTimer > 0) {
        winTimer -= dtReal;
        if (winTimer <= 0 && !ended && !quiet) { ended = true; sfx.win(); hap.success(); onWin?.(result()); }
      }
      // trails; premium balls leave a glitter of sparkles while they fly
      const sparkly = getSkin().sparkle;
      for (const e of sim.ents) {
        if (!e.alive || e.kind !== 'ball' || !e.trail) continue;
        const p = e.body.getPosition();
        e.trail.push([p.x, p.y]);
        if (e.trail.length > 12) e.trail.shift();
        if (sparkly && Math.random() < 0.3) renderer.sparkle(p.x, p.y, 1);
      }
      if (loadK < 1) loadK = Math.min(1, loadK + dtReal * 3.5);
      recoil = Math.max(0, recoil - dtReal * 6);
    }
    if (shakeT > 0) shakeT -= dtReal; else shake *= 0.85;
    flash = Math.max(0, flash - dtReal * 1.6);
    if (aiming && aimDirty) { aim = ghostPath(planck, sim, angle, 1); aimDirty = false; }
    const still = calm();
    const sx = !still && shake > 0.001 ? (Math.random() - 0.5) * shake * renderer.scale : 0;
    const sy = !still && shake > 0.001 ? (Math.random() - 0.5) * shake * renderer.scale : 0;
    renderer.setFlash(still ? flash * 0.3 : flash);
    renderer.draw(sim, {
      alpha: paused ? 1 : acc / DT, fxDt: paused ? 0 : dtReal * Math.max(timeScale, 0.35),
      aim: aiming ? aim : null, angle, skin: getSkin(), loadK, hintAngle,
      shakeX: sx, shakeY: sy, recoil, hideLauncher: quiet, calm: still,
    });
  }

  function hitStop(d) {
    if (quiet || calm()) return;
    d = Math.min(d, stopBudget);
    if (d <= 0) return;
    stopT = Math.max(stopT, d); stopBudget -= d;
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
    // capture tooling: show the aim line without a finger, then fire
    debugAim(a) { if (a == null) { aiming = false; return; } aiming = true; angle = a; aimDirty = true; },
    debugFire() { aiming = false; shoot(); },
    get fired() { return fired; },
    // a result is decided (win slow-mo or lose pending): pausing or restarting now would lose it
    get busy() { return !!sim && (ended || sim.st.won || sim.st.lost || winTimer > 0); },
  };
}
