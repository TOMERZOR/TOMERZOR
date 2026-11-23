// juice.js: everything you can press answers back.
//
// One delegated listener drives every [data-juice] control:
//   candy  the thick "candy" buttons: the face sinks into its own shadow
//   ghost  outlined buttons
//   icon   round buttons (close, zoom, music, sound)
//   toggle round on/off buttons (music, sound): icon bounce + strike line
//   chip   map chips: squeeze, then a fill that spreads from the finger
//   card   mode cards: sink, 3D tilt under a mouse, the 3D art hops
//   seg    segmented control options
//   switch switches: the knob squashes as it goes
//
// The action never waits for the animation: a press acts at once and the
// motion runs alongside. States are classes (.is-pressed, .is-loading,
// .is-success, .is-error) so the look stays in CSS. Sound and haptics go
// through audio.sfx and haptic(), which follow the player's settings.

import { sfx } from "./audio.js";
import { haptic, reducedMotion } from "./ui.js";
import { CHECK_SVG } from "./icons.js";

const SEL = "[data-juice]";
const SPARKS = ["#FFFFFF", "#C8FF3D", "#FFD43B", "#3BE3A0"];
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

let current = null; // the press in progress: { el, id }
let started = false;
let attentionOff = false;
const attentionSet = new Set();

export function initJuice() {
  if (started) return;
  started = true;
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("pointermove", onMove, { passive: true, capture: true });
  document.addEventListener("pointerup", onUp, true);
  document.addEventListener("pointercancel", onCancel, true);
  document.addEventListener("pointerover", onOver, true);
  document.addEventListener("pointerout", onOut, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);
  setInterval(nudge, 4500);
}

const off = (el) => el.disabled || el.getAttribute("aria-disabled") === "true" || el.classList.contains("is-loading");
const faceOf = (el) => el.querySelector(":scope > .face") || el;
const depthOf = (el) => parseFloat(getComputedStyle(el).getPropertyValue("--depth")) || 0;
const isPrimary = (el) => el.classList.contains("c-lime") || el.classList.contains("c-sun");

// ---------- pointer ----------
function onDown(e) {
  attentionOff = true; // the first touch on a screen ends the "look here" nudges
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const el = e.target.closest?.(SEL);
  if (!el || off(el)) return;
  current = { el, id: e.pointerId };
  el._jx = e.clientX;
  el._jy = e.clientY;
  press(el);
}

function onMove(e) {
  if (current && e.pointerId === current.id) {
    // slid off the control: let go without a ripple (the click won't fire either)
    const r = current.el.getBoundingClientRect();
    const slop = 14;
    if (e.clientX < r.left - slop || e.clientX > r.right + slop || e.clientY < r.top - slop || e.clientY > r.bottom + slop) {
      unpress(current.el);
      current = null;
    }
    return;
  }
  if (e.pointerType === "mouse" && finePointer.matches) tilt(e);
}

function onUp(e) {
  if (!current || e.pointerId !== current.id) return;
  const { el } = current;
  current = null;
  release(el, e.clientX, e.clientY, true);
}

function onCancel(e) {
  if (current && e.pointerId === current.id) {
    unpress(current.el);
    current = null;
  }
}

function onOver(e) {
  if (e.pointerType !== "mouse" || !finePointer.matches) return;
  const el = e.target.closest?.(SEL);
  if (!el || off(el) || el.contains(e.relatedTarget)) return;
  if (el.dataset.juice === "candy") shine(el);
}

function onOut(e) {
  const el = e.target.closest?.('[data-juice="card"]');
  if (el && !el.contains(e.relatedTarget)) {
    el.classList.remove("is-tilting");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
  }
}

// A mode card leans toward the mouse (up to 6 degrees).
function tilt(e) {
  const el = e.target.closest?.('[data-juice="card"]');
  if (!el || off(el) || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  el.classList.add("is-tilting");
  el.style.setProperty("--rx", `${(-py * 12).toFixed(2)}deg`);
  el.style.setProperty("--ry", `${(px * 12).toFixed(2)}deg`);
}

// ---------- keyboard: Enter and Space show the press too ----------
function onKeyDown(e) {
  attentionOff = true;
  if ((e.key !== "Enter" && e.key !== " ") || e.repeat) return;
  const el = e.target.closest?.(SEL);
  if (!el || el !== e.target || off(el)) return;
  if (el.matches("input, textarea")) return;
  press(el);
  if (e.key === "Enter") setTimeout(() => el.classList.contains("is-pressed") && release(el, null, null, false), 90);
}

function onKeyUp(e) {
  if (e.key !== " ") return;
  const el = e.target.closest?.(SEL);
  if (el && el.classList.contains("is-pressed")) release(el, null, null, false);
}

// ---------- the press itself ----------
function press(el) {
  el.classList.add("is-pressed");
  el.style.willChange = "transform";
  const type = el.dataset.juice;
  if (type === "candy" || type === "ghost" || type === "icon" || type === "card") sfx.tap(isPrimary(el) ? 720 : 1100);
  haptic("tap");
}

function unpress(el) {
  el.classList.remove("is-pressed");
  setTimeout(() => (el.style.willChange = ""), 400);
}

function release(el, x, y, withRipple) {
  el.classList.remove("is-pressed");
  const type = el.dataset.juice;
  if (!reducedMotion()) {
    if (type === "candy" || type === "icon" || type === "toggle" || type === "card") springFace(el);
    else if (type === "chip") springScale(el, 0.94);
    else if (type === "ghost") springScale(el, 0.96);
    else if (type === "seg") springScale(el.firstElementChild || el, 0.94);
    else if (type === "tab") springScale(el.querySelector(".tab-disc") || el, 0.92);
    else if (type === "switch") el.querySelector(".knob")?.animate([{ scale: "1.15 0.88" }, { scale: "1 1" }], { duration: 300, easing: "ease-out" });
    if (type === "card") hop(el.querySelector(".art-hop"));
    if (type === "toggle") bounce(el.querySelector(".ic"));
    if (withRipple && x != null && (type === "candy" || type === "icon" || type === "toggle" || type === "card" || type === "ghost")) ripple(el, x, y);
  }
  setTimeout(() => (el.style.willChange = ""), 450);
}

// Back up on a spring: a small overshoot upward and a squash that is gone
// within 120ms.
function springFace(el) {
  const face = faceOf(el);
  const d = depthOf(el);
  const rest = finePointer.matches && el.matches(":hover") && !off(el) ? -2 : 0;
  face.animate([
    { translate: `0 ${Math.max(0, d - 1)}px`, scale: "0.98" },
    { translate: `0 ${rest - 2}px`, scale: "1.04 0.96", offset: 0.2 },
    { translate: `0 ${rest - 1}px`, scale: "1", offset: 0.32 },
    { translate: `0 ${rest + 0.6}px`, scale: "1", offset: 0.62 },
    { translate: `0 ${rest}px`, scale: "1" },
  ], { duration: 380, easing: "ease-out" });
}

function springScale(el, from) {
  el.animate([{ scale: String(from) }, { scale: "1.03", offset: 0.45 }, { scale: "1" }], { duration: 380, easing: "ease-out" });
}

function fxLayer(el) {
  const face = faceOf(el);
  let fx = face.querySelector(":scope > .fx");
  if (!fx) {
    fx = document.createElement("span");
    fx.className = "fx";
    fx.setAttribute("aria-hidden", "true");
    face.prepend(fx);
  }
  return fx;
}

// A circle of light from where the finger was.
function ripple(el, x, y) {
  const fx = fxLayer(el);
  const r = fx.getBoundingClientRect();
  const d = Math.max(r.width, r.height);
  const s = document.createElement("span");
  s.className = "ripple";
  s.style.cssText = `left:${x - r.left - d / 2}px;top:${y - r.top - d / 2}px;width:${d}px;height:${d}px`;
  fx.append(s);
  s.animate([{ transform: "scale(0)", opacity: 0.35 }, { transform: "scale(2.2)", opacity: 0 }], { duration: 450, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => s.remove();
}

// A diagonal glint that crosses the button once.
function shine(el) {
  if (reducedMotion()) return;
  const fx = fxLayer(el);
  if (fx.querySelector(".glint")) return;
  const g = document.createElement("span");
  g.className = "glint";
  fx.append(g);
  g.animate([{ transform: "translateX(-130%) skewX(-18deg)" }, { transform: "translateX(260%) skewX(-18deg)" }], { duration: 650, easing: "cubic-bezier(.4,0,.2,1)" }).onfinish = () => g.remove();
}

export function hop(art) {
  if (!art || reducedMotion()) return;
  art.animate([
    { translate: "0 0", scale: "1" },
    { translate: "0 -16px", scale: "1.1", offset: 0.4 },
    { translate: "0 0", scale: "1.12 0.9", offset: 0.75 },
    { translate: "0 0", scale: "1" },
  ], { duration: 520, easing: "ease-out" });
}

export function bounce(el) {
  if (!el || reducedMotion()) return;
  el.animate([{ scale: "0.7" }, { scale: "1.15", offset: 0.6 }, { scale: "1" }], { duration: 300, easing: "ease-out" });
}

export function popIn(el, delay = 0) {
  if (!el || reducedMotion()) return;
  el.animate([{ scale: "0.4", opacity: 0 }, { scale: "1.15", opacity: 1, offset: 0.6 }, { scale: "1", opacity: 1 }], { duration: 280, delay, easing: "ease-out", fill: "backwards" });
}

// Cards land one after another and settle at their own slant.
export function land(els, { stagger = 60, delay = 0 } = {}) {
  if (reducedMotion()) return;
  [...els].forEach((el, i) => {
    const t = parseFloat(el.style.getPropertyValue("--tilt")) || 0;
    el.animate([
      { translate: "0 -28px", scale: "0.9", rotate: `${-t}deg`, opacity: 0 },
      { translate: "0 5px", scale: "1.02", rotate: "0deg", opacity: 1, offset: 0.55 },
      { translate: "0 -1px", scale: "1", rotate: "0deg", opacity: 1, offset: 0.8 },
      { translate: "0 0", scale: "1", rotate: "0deg", opacity: 1 },
    ], { duration: 560, delay: delay + i * stagger, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" });
  });
}

// ---------- states ----------
export function loading(el, on = true) {
  if (!el) return;
  el.classList.toggle("is-loading", on);
  el.setAttribute("aria-busy", String(on));
  const face = faceOf(el);
  if (on && !face.querySelector(":scope > .dots")) {
    face.insertAdjacentHTML("beforeend", '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>');
  }
}

const escText = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "Locked ✓", "Copied", "Joined": mint, a check that writes itself, sparks.
export function success(el, label, { revert = 0, sound = true } = {}) {
  if (!el) return;
  const lbl = faceOf(el).querySelector(".lbl");
  if (lbl) {
    if (el._lbl == null) el._lbl = lbl.innerHTML;
    lbl.innerHTML = `${CHECK_SVG}${label != null ? `<span>${escText(label)}</span>` : lbl.innerHTML}`;
  }
  el.classList.remove("is-error", "is-loading");
  el.classList.add("is-success");
  if (sound) {
    sfx.lock();
    haptic("lock");
  }
  burst(el);
  clearTimeout(el._okT);
  if (revert) el._okT = setTimeout(() => clearSuccess(el), revert);
}

export function clearSuccess(el) {
  if (!el) return;
  el.classList.remove("is-success");
  const lbl = faceOf(el).querySelector(".lbl");
  if (lbl && el._lbl != null) lbl.innerHTML = el._lbl;
  el._lbl = null;
}

// A wrong code, no server, an empty name: a shake and a coral frame.
export function error(el, { sound = true } = {}) {
  if (!el) return;
  el.classList.remove("is-error");
  void el.offsetWidth;
  el.classList.add("is-error");
  if (sound) {
    sfx.error();
    haptic("warning");
  }
  if (!reducedMotion()) {
    el.animate([{ translate: "0 0" }, { translate: "-7px 0" }, { translate: "7px 0" }, { translate: "-5px 0" }, { translate: "5px 0" }, { translate: "-2px 0" }, { translate: "0 0" }], { duration: 360, easing: "ease-in-out" });
  }
  clearTimeout(el._errT);
  el._errT = setTimeout(() => el.classList.remove("is-error"), 1100);
}

// Eight little stars, 40-70px out from the middle.
export function burst(el, n = 8) {
  if (!el || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    s.className = "spark-fx";
    s.setAttribute("aria-hidden", "true");
    s.style.cssText = `left:${cx}px;top:${cy}px;color:${SPARKS[i % SPARKS.length]}`;
    document.body.append(s);
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const d = 40 + Math.random() * 30;
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d;
    s.animate([
      { transform: "translate(-50%, -50%) scale(.3) rotate(0deg)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(90deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy * 1.15}px)) scale(.2) rotate(140deg)`, opacity: 0 },
    ], { duration: 500, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => s.remove();
  }
}

// A chip that just got picked: lime pours in from where it was touched and
// its icon hops.
export function select(chip) {
  if (!chip) return;
  const fill = chip.querySelector(".chip-fill");
  if (fill && !reducedMotion()) {
    const r = chip.getBoundingClientRect();
    const x = (chip._jx ?? r.left + r.width / 2) - r.left;
    const y = (chip._jy ?? r.top + r.height / 2) - r.top;
    const R = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) + 2;
    fill.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)` }], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
    const ico = chip.querySelector(".chip-ico");
    ico?.animate([
      { translate: "0 0", scale: "1 1" },
      { translate: "0 -8px", scale: "1 1", offset: 0.45 },
      { translate: "0 0", scale: "1.15 0.85", offset: 0.75 },
      { translate: "0 0", scale: "1 1" },
    ], { duration: 440, easing: "ease-out" });
  }
  chip._jx = chip._jy = null;
}

// The bottom tab that just became active: its icon hops 6px.
export function navHop(tab) {
  if (!tab || reducedMotion()) return;
  tab.querySelector(".ic")?.animate([{ translate: "0 0" }, { translate: "0 -6px", offset: 0.4 }, { translate: "0 0" }], { duration: 380, easing: "ease-out" });
  tab.querySelector(".tab-lbl")?.animate([{ translate: "0 4px", opacity: 0.4 }, { translate: "0 0", opacity: 1 }], { duration: 300, easing: "ease-out" });
}

// ---------- "look here" for the one main button of a screen ----------
export function attention(el) {
  if (el) attentionSet.add(el);
}

export function resetAttention() {
  attentionOff = false;
  for (const el of attentionSet) if (!el.isConnected) attentionSet.delete(el);
}

function nudge() {
  if (attentionOff || reducedMotion() || document.hidden) return;
  for (const el of [...attentionSet]) {
    if (!el.isConnected) {
      attentionSet.delete(el);
      continue;
    }
    if (!el.offsetParent || off(el) || el.closest("[inert]")) continue;
    el.animate([{ scale: "1" }, { scale: "1.03" }, { scale: "1" }], { duration: 900, easing: "ease-in-out" });
    shine(el);
  }
}
