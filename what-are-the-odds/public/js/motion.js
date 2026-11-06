// Motion rules for the whole site, in one place:
//   entrances ease out, moves ease in and out, exits ease in and are 20% shorter,
//   nothing bounces, popovers start at 0.95 from their trigger, old and new states
//   overlap, colour and reveals use masks, icons crossfade with blur, things that
//   travel follow an arc, success pulses, and dragging past an end rubber-bands.
// Everything here does nothing when the person prefers reduced motion.

export const ENTER = 240;
export const EXIT = Math.round(ENTER * 0.8); // 192
export const MOVE = 260;
export const STAGGER = 30;
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_IN = "cubic-bezier(0.55, 0, 1, 0.45)";
export const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function run(el, frames, opts) {
  if (!el || reduced() || !el.animate) return Promise.resolve();
  return el.animate(frames, { fill: "none", ...opts }).finished.catch(() => {});
}

// Enter from where it was triggered (a small offset towards the trigger, ease-out).
export function enterFrom(el, { dy = -8, dx = 0, scale = 1, delay = 0, duration = ENTER } = {}) {
  return run(el, [
    { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    { opacity: 1, transform: "none" },
  ], { duration, delay, easing: EASE_OUT, fill: "backwards" });
}

// Leave back towards the trigger, 20% faster, ease-in.
export function exitTo(el, { dy = -8, dx = 0, scale = 1, duration = EXIT } = {}) {
  return run(el, [
    { opacity: 1, transform: "none" },
    { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
  ], { duration, easing: EASE_IN, fill: "forwards" });
}

// A popover grows from its trigger, starting at 0.95.
export function popIn(el, origin = "top") {
  if (!el) return Promise.resolve();
  el.style.transformOrigin = origin;
  return run(el, [{ opacity: 0, transform: "scale(0.95)" }, { opacity: 1, transform: "scale(1)" }], { duration: 200, easing: EASE_OUT, fill: "backwards" });
}

// Rows settle one after another, 30ms apart.
export function stagger(els, opts = {}) {
  return Promise.all([...els].map((el, i) => enterFrom(el, { dy: 6, ...opts, delay: (opts.delay || 0) + i * STAGGER })));
}

// Swap an element's content: old fades out blurred while the new fades in from blur.
export function crossfade(el, html) {
  if (!el) return;
  if (reduced() || !el.animate) { el.innerHTML = html; return; }
  const old = document.createElement("span");
  old.className = "xf-old";
  old.innerHTML = el.innerHTML;
  old.setAttribute("aria-hidden", "true");
  el.innerHTML = html;
  const fresh = document.createElement("span");
  fresh.className = "xf-new";
  while (el.firstChild) fresh.append(el.firstChild);
  el.append(fresh, old);
  el.classList.add("xf");
  old.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(4px)" }], { duration: EXIT, easing: EASE_IN, fill: "forwards" })
    .finished.catch(() => {}).then(() => old.remove());
  fresh.animate([{ opacity: 0, filter: "blur(4px)" }, { opacity: 1, filter: "blur(0)" }], { duration: ENTER, easing: EASE_OUT })
    .finished.catch(() => {}).then(() => {
      if (!fresh.isConnected) return;
      while (fresh.firstChild) el.insertBefore(fresh.firstChild, fresh);
      fresh.remove();
      el.classList.remove("xf");
    });
}

// Colour arrives as a circle growing from the point that was touched.
export function maskFrom(el, x, y, duration = 360) {
  if (!el) return Promise.resolve();
  const r = el.getBoundingClientRect();
  const cx = x == null ? r.width / 2 : x - r.left;
  const cy = y == null ? r.height / 2 : y - r.top;
  const end = Math.hypot(Math.max(cx, r.width - cx), Math.max(cy, r.height - cy));
  return run(el, [{ clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${end}px at ${cx}px ${cy}px)` }], { duration, easing: EASE_OUT });
}

// Text revealed by a mask that opens along the reading direction.
export function wipeIn(el, { delay = 0, duration = 320 } = {}) {
  if (!el) return Promise.resolve();
  const rtl = getComputedStyle(el).direction === "rtl";
  const from = rtl ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
  return run(el, [{ clipPath: from }, { clipPath: "inset(0 0 0 0)" }], { duration, delay, easing: EASE_OUT, fill: "backwards" });
}

// A short pulse to confirm something worked.
export function pulse(el) {
  return run(el, [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 420, easing: EASE_IN_OUT });
}

// Something that travels from one place to another follows an arc:
// x moves evenly while y eases out, so the path curves.
export function arc(fromEl, toEl, { color = "var(--accent)", size = 10 } = {}) {
  if (!fromEl || !toEl || reduced() || !document.body.animate) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const outer = document.createElement("div");
  const dot = document.createElement("div");
  outer.style.cssText = `position:fixed;left:${x0 - size / 2}px;top:${y0 - size / 2}px;width:${size}px;height:${size}px;pointer-events:none;z-index:30`;
  dot.style.cssText = `width:100%;height:100%;border-radius:50%;background:${color}`;
  outer.append(dot);
  document.body.append(outer);
  const duration = 620;
  outer.animate([{ transform: "translateX(0)" }, { transform: `translateX(${x1 - x0}px)` }], { duration, easing: EASE_IN_OUT, fill: "forwards" });
  return dot.animate([{ transform: "translateY(0)" }, { transform: `translateY(${y1 - y0}px)` }], { duration, easing: "cubic-bezier(0.3, 0, 0.9, 0.6)", fill: "forwards" })
    .finished.catch(() => {}).then(() => outer.remove());
}

// Overlap old and new: a snapshot of the old state fades out on top while the new one fades in.
export function overlapSwap(container, update) {
  if (!container || reduced()) { update(); return; }
  const r = container.getBoundingClientRect();
  const ghost = container.cloneNode(true);
  ghost.removeAttribute("id");
  ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;margin:0;pointer-events:none;z-index:5`;
  document.body.append(ghost);
  update();
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT, easing: EASE_IN, fill: "forwards" }).finished.catch(() => {}).then(() => ghost.remove());
}

// The old card flies off to one side (from wherever a drag left it) while the update
// puts the new card in place; the new one comes in from the other side.
export function flyOut(container, update, dir = -1, from = 0) {
  if (!container || reduced()) { update(); return null; }
  const r = container.getBoundingClientRect();
  const ghost = container.cloneNode(true);
  ghost.removeAttribute("id");
  ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  ghost.style.cssText = `position:fixed;left:${r.left - from}px;top:${r.top}px;width:${r.width}px;margin:0;pointer-events:none;z-index:5;transform:none`;
  document.body.append(ghost);
  update();
  const dist = innerWidth * 1.1;
  ghost.animate([
    { transform: `translateX(${from}px) rotate(${from * 0.04}deg)`, opacity: 1 },
    { transform: `translateX(${from + dir * dist}px) rotate(${dir * 9}deg)`, opacity: 0 },
  ], { duration: EXIT + 40, easing: EASE_IN, fill: "forwards" }).finished.catch(() => {}).then(() => ghost.remove());
  return ghost;
}

// Past the end of where something can go, it gives a little and springs back (no overshoot).
export function rubberNudge(el, dx = 4) {
  return run(el, [{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)`, offset: 0.35 }, { transform: "translateX(0)" }], { duration: 260, easing: EASE_OUT });
}

// Rubber band: how far something moves when dragged `over` pixels past its end.
export function rubber(over, dim) {
  const s = Math.sign(over);
  const x = Math.abs(over);
  return s * (1 - 1 / ((x * 0.55) / dim + 1)) * dim;
}

// Shared-element transitions (the same object grows into its next state) where the
// browser has View Transitions; otherwise just update.
export function morph(update) {
  if (reduced() || !document.startViewTransition) { update(); return; }
  document.startViewTransition(update);
}
