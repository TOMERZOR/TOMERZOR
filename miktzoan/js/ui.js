// DOM side of the game: HUD, world-anchored markers and bubbles, toasts, modals, joystick.
import * as THREE from 'three';
import { sfx, unlock } from './audio.js';

const $ = id => document.getElementById(id);
const v3 = new THREE.Vector3();

export class UI {
  constructor(world) {
    this.world = world;
    this.overlay = $('overlay');
    this.tracked = new Set(); // elements following a 3D point
    this.joy = { x: 0, y: 0, active: false, id: null, ox: 0, oy: 0 };
    this.keys = {};
    this.initJoystick();
  }

  // --- projection ---
  project(p, out = {}) {
    v3.copy(p).project(this.world.camera);
    out.x = (v3.x + 1) / 2 * window.innerWidth; out.y = (1 - v3.y) / 2 * window.innerHeight; out.behind = v3.z > 1;
    return out;
  }

  // --- HUD ---
  hud(show) { $('hud').hidden = !show; }
  setCoins(n, bump) { $('coins').textContent = Math.floor(n).toLocaleString('en-US'); if (bump) this.bump($('coins').parentElement); }
  setRating(r) { $('rating').textContent = r.toFixed(1); }
  setLevel(lvl, frac, title) { $('lvlNum').textContent = lvl; $('lvlBar').style.transform = `scaleX(${frac})`; $('lvlTitle').textContent = title; }
  setDay(day, frac) { $('dayLabel').textContent = `יום ${day}`; $('dayBar').style.transform = `scaleX(${frac})`; }
  bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  ribbon(text) {
    const r = $('ribbon');
    if (!text) { r.hidden = true; this._rib = null; return; }
    if (this._rib === text) return;
    this._rib = text; r.querySelector('span').textContent = text; r.hidden = false;
    r.style.animation = 'none'; void r.offsetWidth; r.style.animation = '';
  }

  // --- world anchored elements ---
  track(el, getPos, opts = {}) {
    const t = { el, getPos, ...opts };
    this.overlay.appendChild(el); this.tracked.add(t);
    return t;
  }
  untrack(t) { if (!t) return; this.tracked.delete(t); t.el.remove(); }
  updateTracked() {
    const W = window.innerWidth, H = window.innerHeight, o = {};
    for (const t of this.tracked) {
      const p = t.getPos(); if (!p) continue;
      this.project(p, o);
      if (t.edge) {
        const m = 46, top = 150;
        const off = o.behind || o.x < m || o.x > W - m || o.y < top || o.y > H - m - 20;
        t.el.classList.toggle('off', off);
        if (off) {
          const cx = W / 2, cy = (H + top) / 2;
          let dx = o.x - cx, dy = o.y - cy; if (o.behind) { dx = -dx; dy = -dy; }
          const s = Math.min((W / 2 - m) / Math.abs(dx || 1e-3), ((H - top) / 2 - m) / Math.abs(dy || 1e-3));
          o.x = cx + dx * s; o.y = cy + dy * s;
          t.el.querySelector('.jm-arrow').style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
        }
      }
      t.el.style.transform = `translate(${o.x.toFixed(1)}px,${o.y.toFixed(1)}px)`;
    }
  }

  bubble(getPos, text, dur = 2.5, cls = '') {
    const el = document.createElement('div'); el.className = 'bubble ' + cls;
    const inner = document.createElement('div'); inner.textContent = text; el.appendChild(inner);
    const t = this.track(el, getPos);
    if (dur > 0) setTimeout(() => { el.classList.add('out'); setTimeout(() => this.untrack(t), 260); }, dur * 1000);
    return t;
  }

  float(pos, text, cls = '') {
    const el = document.createElement('div'); el.className = 'float o ' + cls; el.textContent = text;
    const p = pos.clone();
    const t = this.track(el, () => p);
    setTimeout(() => this.untrack(t), 1100);
  }

  marker(getPos, icon) {
    const el = document.createElement('div'); el.className = 'jm';
    el.innerHTML = `<div class="jm-in"><div class="jm-arrow"></div><div class="jm-bub"><svg viewBox="0 0 66 66"><circle class="bg" cx="33" cy="33" r="29"/><circle class="fg" cx="33" cy="33" r="29" stroke-dasharray="182.2" stroke-dashoffset="0"/></svg><span>${icon}</span></div><div class="jm-need"></div></div>`;
    const t = this.track(el, getPos, { edge: true });
    t.fg = el.querySelector('.fg'); t.need = el.querySelector('.jm-need');
    return t;
  }
  updateMarker(t, frac, needText, ok) {
    t.fg.setAttribute('stroke-dashoffset', (182.2 * (1 - frac)).toFixed(1));
    t.el.classList.toggle('warn', frac < 0.5 && frac >= 0.25);
    t.el.classList.toggle('urgent', frac < 0.25);
    if (t._n !== needText) { t.need.textContent = needText; t._n = needText; }
    t.need.classList.toggle('ok', !!ok);
  }

  guide(getPos, icon = '⬇️') {
    const el = document.createElement('div'); el.className = 'guide'; el.textContent = icon;
    return this.track(el, getPos);
  }

  // --- toasts ---
  toast({ icon = '💬', name = '', text = '', cls = '', time = 'עכשיו', stars = 0, dur = 4.2 }) {
    const box = $('toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div'); el.className = 'toast ' + cls;
    const st = stars ? `<span class="st">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>` : `<small>${time}</small>`;
    el.innerHTML = `<div class="av">${icon}</div><div class="tx"><div class="nm"><span></span>${st}</div><div class="ms"></div></div>`;
    el.querySelector('.nm span').textContent = name; el.querySelector('.ms').textContent = text;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, dur * 1000);
  }

  // --- modal ---
  modal(html, bind) {
    return new Promise(resolve => {
      const m = $('modal'), card = m.querySelector('.card');
      card.innerHTML = html; m.hidden = false; m.classList.remove('out');
      card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
      const close = v => { sfx.tap(); m.classList.add('out'); setTimeout(() => { m.hidden = true; resolve(v); }, 240); };
      card.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => close(b.dataset.v), { once: true }));
      bind?.(card, close);
    });
  }

  // --- input ---
  initJoystick() {
    const joyEl = $('joy'), knob = joyEl.querySelector('.knob');
    const R = 52;
    const blocked = e => e.target.closest('button, .screen, #mg, #modal, .pill');
    window.addEventListener('pointerdown', e => {
      unlock();
      if (!this.enabled || blocked(e) || this.joy.active) return;
      Object.assign(this.joy, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
      joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.hidden = false;
      knob.style.transform = '';
    });
    window.addEventListener('pointermove', e => {
      if (!this.joy.active || e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { // drag the base along, like Hive Haul
        this.joy.ox += dx - dx / d * R; this.joy.oy += dy - dy / d * R; dx = dx / d * R; dy = dy / d * R;
        joyEl.style.left = this.joy.ox + 'px'; joyEl.style.top = this.joy.oy + 'px';
      }
      this.joy.x = dx / R; this.joy.y = dy / R;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    });
    const end = e => { if (e.pointerId !== this.joy.id) return; this.joy.active = false; this.joy.x = this.joy.y = 0; joyEl.hidden = true; };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    window.addEventListener('keydown', e => { this.keys[e.code] = true; unlock(); });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.joy.active = false; this.joy.x = this.joy.y = 0; joyEl.hidden = true; });
  }
  stopInput() { this.joy.active = false; this.joy.x = this.joy.y = 0; $('joy').hidden = true; this.keys = {}; }
  input() {
    let x = this.joy.x, y = this.joy.y;
    const k = this.keys;
    const kx = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
    const ky = (k.ArrowDown || k.KeyS ? 1 : 0) - (k.ArrowUp || k.KeyW ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); x = kx / l; y = ky / l; }
    const m = Math.hypot(x, y);
    if (m < 0.12) return { x: 0, y: 0, m: 0 };
    return { x, y, m: Math.min(1, m) };
  }
}
