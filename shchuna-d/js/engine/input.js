// One input state for keyboard + mouse, gamepad and touch. Gameplay reads actions, never devices.
import { clamp } from '../core/util.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump', KeyF: 'enter', KeyE: 'interact', Enter: 'interact',
  KeyJ: 'punch', KeyK: 'kick', KeyQ: 'radio', KeyM: 'map', Escape: 'pause', KeyP: 'pause', KeyT: 'phone', KeyH: 'horn', KeyC: 'look',
  KeyR: 'skip', Tab: 'phone',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.move = { x: 0, y: 0 };        // x: strafe right, y: forward
    this.look = { x: 0, y: 0 };        // accumulated camera deltas for this frame (radians)
    this.down = {};                    // action -> held
    this.pressed = {};                 // action -> went down this frame
    this._queued = {};
    this.keys = {};
    this.touch = false;
    this.locked = false;
    this.enabled = true;
    this.sens = 1;
    this.invertY = false;
    this.gamepadIndex = -1;
    this._padPrev = {};
    this.stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookTouch = { id: -1, x: 0, y: 0 };
    this.btnHeld = {};
    this.lastDevice = 'kb';

    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (!typing && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
      if (!this.keys[e.code]) this._queued[a] = true;
      this.keys[e.code] = true; this.lastDevice = 'kb';
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.btnHeld = {}; this.stick.id = -1; this.stick.x = this.stick.y = 0; });

    canvas.addEventListener('mousedown', (e) => {
      if (this.touch) return;
      if (!this.locked && this.wantLock) { this.lock(); return; }
      if (e.button === 0) { this._queued.punch = true; this.keys.Mouse0 = true; }
      if (e.button === 2) { this._queued.kick = true; this.keys.Mouse2 = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.keys.Mouse0 = false; if (e.button === 2) this.keys.Mouse2 = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.x -= e.movementX * 0.0024 * this.sens;
      this.look.y -= e.movementY * 0.0024 * this.sens * (this.invertY ? -1 : 1);
    });
    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = -1; });
    this.wantLock = false;
  }

  // Take the mouse for the camera. Only works inside a click or key press, and the browser may still
  // say no (it does for a second after Esc); the next click on the view asks again.
  lock() {
    if (this.touch || this.locked || !this.canvas.requestPointerLock) return;
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not now */ }
  }

  // Touch layer: built by the HUD, which hands us the elements.
  bindTouch(root, stickEl, knobEl, buttons) {
    this.touch = true; this.lastDevice = 'touch';
    const R = 56;
    const setKnob = () => { knobEl.style.transform = `translate(${this.stick.x * R}px, ${-this.stick.y * R}px)`; };
    root.addEventListener('touchstart', (e) => {
      if (this.tapAdvances) { this._queued.interact = true; e.preventDefault(); return; }   // any tap moves a dialogue on
      for (const t of e.changedTouches) {
        const el = t.target.closest ? t.target.closest('[data-act]') : null;
        if (el) { const a = el.dataset.act; this.btnHeld[a] = t.identifier; this._queued[a] = true; el.classList.add('on'); continue; }
        if (t.clientX < window.innerWidth * 0.42 && this.stick.id < 0) {
          this.stick.id = t.identifier; this.stick.ox = t.clientX; this.stick.oy = t.clientY; this.stick.x = this.stick.y = 0;
          stickEl.style.left = t.clientX + 'px'; stickEl.style.top = t.clientY + 'px'; stickEl.classList.add('on'); setKnob();
        } else if (this.lookTouch.id < 0) { this.lookTouch.id = t.identifier; this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    root.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          let dx = (t.clientX - this.stick.ox) / R, dy = (this.stick.oy - t.clientY) / R;
          const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
          this.stick.x = dx; this.stick.y = dy; setKnob();
        } else if (t.identifier === this.lookTouch.id) {
          this.look.x -= (t.clientX - this.lookTouch.x) * 0.0052 * this.sens;
          this.look.y -= (t.clientY - this.lookTouch.y) * 0.0042 * this.sens * (this.invertY ? -1 : 1);
          this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) { this.stick.id = -1; this.stick.x = this.stick.y = 0; stickEl.classList.remove('on'); setKnob(); }
        if (t.identifier === this.lookTouch.id) this.lookTouch.id = -1;
        for (const a in this.btnHeld) if (this.btnHeld[a] === t.identifier) { delete this.btnHeld[a]; const el = buttons[a]; if (el) el.classList.remove('on'); }
      }
    };
    root.addEventListener('touchend', end); root.addEventListener('touchcancel', end);
  }

  // Call once at the start of every frame.
  poll(dt) {
    const d = this.down, k = this.keys;
    for (const a in d) d[a] = false;
    for (const code in k) if (k[code]) { const a = KEYMAP[code]; if (a) d[a] = true; }
    if (k.Mouse0) d.punch = true; if (k.Mouse2) d.kick = true;
    for (const a in this.btnHeld) d[a] = true;
    let mx = (d.right ? 1 : 0) - (d.left ? 1 : 0), my = (d.up ? 1 : 0) - (d.down ? 1 : 0);
    if (this.stick.id >= 0) { mx = this.stick.x; my = this.stick.y; if (Math.hypot(mx, my) > 0.92) d.sprintStick = true; }

    // gamepad (standard mapping)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = this.gamepadIndex >= 0 ? pads[this.gamepadIndex] : null;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if (lx || ly) { mx = lx; my = -ly; this.lastDevice = 'pad'; }
      this.look.x -= rx * 2.6 * dt * this.sens; this.look.y -= ry * 1.9 * dt * this.sens * (this.invertY ? -1 : 1);
      const B = { 0: 'jump', 1: 'kick', 2: 'punch', 3: 'enter', 4: 'radio', 5: 'look', 8: 'map', 9: 'pause', 10: 'sprint', 12: 'phone', 14: 'horn', 15: 'interact' };
      for (const i in B) {
        const on = gp.buttons[i] && gp.buttons[i].pressed, a = B[i];
        if (on) { d[a] = true; this.lastDevice = 'pad'; }
        if (on && !this._padPrev[i]) this._queued[a] = true;
        this._padPrev[i] = on;
      }
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0;
      this.throttle = rt; this.brake = lt;
      if (rt > 0.1) d.sprint = true;
      d.accel = rt > 0.1; d.brakeBtn = lt > 0.1;
      if (gp.buttons[0] && gp.buttons[0].pressed) d.interactPad = true;
    } else { this.throttle = 0; this.brake = 0; }

    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    this.move.x = mx; this.move.y = my;
    const p = this.pressed;
    for (const a in p) p[a] = false;
    if (this.enabled) for (const a in this._queued) p[a] = true;
    else { if (this._queued.pause) p.pause = true; if (this._queued.skip) p.skip = true; if (this._queued.interact) p.interact = true; if (this._queued.jump) p.jump = true; if (this._queued.punch) p.punch = true; }
    this._queued = {};
    this.look.x = clamp(this.look.x, -0.6, 0.6); this.look.y = clamp(this.look.y, -0.6, 0.6);
  }
  endFrame() { this.look.x = 0; this.look.y = 0; }
  vibrate(ms) { if (navigator.vibrate && this.touch) { try { navigator.vibrate(ms); } catch (e) { /* not allowed */ } } }
}
