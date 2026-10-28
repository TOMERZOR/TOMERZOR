// Controllers: keyboard (two layouts), gamepads and the touch pad on phones.
// Each turns into the same bitmask the simulation reads (IN in sim.js).

import { IN } from "./sim.js";

const down = new Set();
window.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  down.add(e.code);
  if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => down.delete(e.code));
window.addEventListener("blur", () => down.clear());

// layout A: WASD + J K L I O (also space = block)
const A = { up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], P: ["KeyJ", "KeyF"], K: ["KeyK", "KeyG"], S: ["KeyL", "KeyH"], B: ["KeyI", "Space", "ShiftLeft"], X: ["KeyO", "KeyY"] };
// layout B: arrows + numpad (or , . / ; ')
const B = { up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"], P: ["Numpad1", "Comma"], K: ["Numpad2", "Period"], S: ["Numpad3", "Slash"], B: ["Numpad0", "ShiftRight", "Semicolon"], X: ["Numpad5", "Quote", "Enter"] };

function readLayout(L) {
  const any = (ks) => ks.some((k) => down.has(k));
  let v = 0;
  if (any(L.up)) v |= IN.UP; if (any(L.down)) v |= IN.DOWN;
  if (any(L.left)) v |= IN.LEFT; if (any(L.right)) v |= IN.RIGHT;
  if (any(L.P)) v |= IN.P; if (any(L.K)) v |= IN.K; if (any(L.S)) v |= IN.S; if (any(L.B)) v |= IN.B; if (any(L.X)) v |= IN.X;
  return v;
}

function readPad(i) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && pads[i];
  if (!p) return 0;
  const b = (n) => p.buttons[n] && p.buttons[n].pressed;
  let v = 0;
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  if (b(12) || ay < -0.5) v |= IN.UP; if (b(13) || ay > 0.5) v |= IN.DOWN;
  if (b(14) || ax < -0.5) v |= IN.LEFT; if (b(15) || ax > 0.5) v |= IN.RIGHT;
  if (b(2)) v |= IN.P; if (b(0)) v |= IN.K; if (b(1)) v |= IN.S; if (b(3)) v |= IN.X;
  if (b(4) || b(5) || b(6) || b(7)) v |= IN.B;
  return v;
}

// ---------- touch ----------
let touchBits = 0;
let stickBits = 0;
let tapped = 0; // presses not yet seen by the game, so a very quick tap still counts
export function setupTouch(root) {
  const stick = root.querySelector(".stick");
  const knob = root.querySelector(".knob");
  let stickId = null, cx = 0, cy = 0;
  const R = () => stick.getBoundingClientRect().width / 2;
  const move = (x, y) => {
    const dx = x - cx, dy = y - cy;
    const r = R();
    const len = Math.hypot(dx, dy);
    const k = len > r ? r / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    let v = 0;
    const dead = r * 0.28;
    if (len > dead) {
      const ang = Math.atan2(dy, dx);
      const s = Math.sin(ang), c = Math.cos(ang);
      if (c > 0.42) v |= IN.RIGHT; if (c < -0.42) v |= IN.LEFT;
      if (s > 0.5) v |= IN.DOWN; if (s < -0.62) v |= IN.UP;
    }
    stickBits = v;
  };
  const zone = root.querySelector(".stickzone");
  zone.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    stickId = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch {}
    const r = stick.getBoundingClientRect();
    // the stick jumps to where the thumb lands (within the zone)
    const zr = zone.getBoundingClientRect();
    const x = Math.min(zr.right - r.width / 2, Math.max(zr.left + r.width / 2, e.clientX));
    const y = Math.min(zr.bottom - r.height / 2, Math.max(zr.top + r.height / 2, e.clientY));
    stick.style.left = (x - zr.left - r.width / 2) + "px";
    stick.style.top = (y - zr.top - r.height / 2) + "px";
    cx = x; cy = y;
    move(e.clientX, e.clientY);
  });
  zone.addEventListener("pointermove", (e) => { if (e.pointerId === stickId) move(e.clientX, e.clientY); });
  const end = (e) => { if (e.pointerId !== stickId) return; stickId = null; stickBits = 0; knob.style.transform = ""; };
  zone.addEventListener("pointerup", end); zone.addEventListener("pointercancel", end);

  for (const btn of root.querySelectorAll("[data-btn]")) {
    const bit = IN[btn.dataset.btn];
    const press = (e) => { e.preventDefault(); touchBits |= bit; tapped |= bit; btn.classList.add("on"); if (navigator.vibrate) navigator.vibrate(8); };
    const rel = (e) => { e.preventDefault(); touchBits &= ~bit; btn.classList.remove("on"); };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", rel); btn.addEventListener("pointercancel", rel); btn.addEventListener("pointerleave", rel);
  }
  root.addEventListener("contextmenu", (e) => e.preventDefault());
}

// slot: "solo" (everything controls you), "p1", "p2" (local versus)
export function readInput(slot) {
  const t = tapped; tapped = 0;
  if (slot === "p1") return readLayout(A) | readPad(0) | touchBits | stickBits | t;
  if (slot === "p2") return readLayout(B) | readPad(1);
  return readLayout(A) | readLayout(B) | readPad(0) | readPad(1) | touchBits | stickBits | t;
}

export function anyKey() { return down.size > 0; }
export function clearTouch() { touchBits = 0; stickBits = 0; tapped = 0; }
