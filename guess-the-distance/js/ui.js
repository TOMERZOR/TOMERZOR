// Small DOM and feel helpers: element building, count-ups, toasts,
// confetti, haptics, the segmented control and the switch.

import { getLang } from "./i18n.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function html(str) {
  const t = document.createElement("template");
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Desktop layout (sidebar, side panel in games, keyboard hints) from 1024px.
const desktopQuery = matchMedia("(min-width: 1024px)");
export const isDesktop = () => desktopQuery.matches;
export function onDesktopChange(fn) {
  desktopQuery.addEventListener?.("change", fn);
}

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
export const reducedMotion = () => motionQuery.matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);
const numFmt = (v) => Math.round(v).toLocaleString(getLang() === "he" ? "he-IL" : "en-US");

// Count a number up, calling onTick with progress so sounds can follow.
// Plain-text numbers keep the width of their final value while they count,
// so the digits never shift sideways (tabular figures do the rest).
export function countUp(el, to, { from = 0, ms = 1200, format = numFmt, onTick, html: asHtml = false } = {}) {
  return new Promise((resolve) => {
    if (!asHtml) {
      const wide = String(format(Math.max(Math.abs(to), Math.abs(from)))).length;
      el.style.minWidth = `${wide}ch`;
    }
    if (reducedMotion() || ms <= 0) {
      el[asHtml ? "innerHTML" : "textContent"] = format(to);
      resolve();
      return;
    }
    const t0 = performance.now();
    let lastStep = -1;
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const v = from + (to - from) * easeOutQuint(p);
      el[asHtml ? "innerHTML" : "textContent"] = format(v);
      const step = Math.floor(p * 18);
      if (onTick && step !== lastStep && p < 1) {
        lastStep = step;
        onTick(p);
      }
      if (p < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

// A toast: a pill sticker that drops in from the top.
let toastTimer;
export function toast(msg, ms = 2400, { tone = "cloud" } = {}) {
  let el = $(".toast");
  if (!el) {
    el = html('<div class="toast" role="status" aria-live="polite"><span class="toast-face"></span></div>');
    document.body.append(el);
  }
  el.className = `toast c-${tone}`;
  el.firstElementChild.textContent = msg;
  el.classList.remove("on");
  void el.offsetWidth;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), ms);
}

// Haptics. Android gets navigator.vibrate. iPhones ignore vibrate, but
// Safari 18+ plays the system haptic tick when a native switch toggles, so
// on iOS we toggle a hidden <input type="checkbox" switch> instead.
let hapticsOn = true;
let iosSwitch = null;
let lastHaptic = 0;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function setHaptics(on) {
  hapticsOn = on;
}

function iosTick() {
  if (!iosSwitch) {
    iosSwitch = document.createElement("label");
    iosSwitch.setAttribute("aria-hidden", "true");
    iosSwitch.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}

// pattern: milliseconds, or [on, off, on, ...] like navigator.vibrate.
// Named feels: "tick" (wheel notch), "tap", "lock", "success", "warning", "heavy".
const FEELS = { tick: 4, tap: 8, lock: [10, 40, 12], success: [12, 60, 12, 60, 24], warning: [18, 70, 18], heavy: [40, 30, 70] };
export function haptic(pattern = "tap") {
  if (!hapticsOn) return;
  const p = typeof pattern === "string" ? FEELS[pattern] ?? 8 : pattern;
  const now = performance.now();
  // a flick through the wheel shouldn't buzz continuously
  if (pattern === "tick" && now - lastHaptic < 28) return;
  lastHaptic = now;
  if (!isIOS && navigator.vibrate) {
    try { navigator.vibrate(p); } catch {}
    return;
  }
  if (!isIOS) return;
  const pulses = Array.isArray(p) ? p : [p];
  let at = 0;
  pulses.forEach((ms, i) => {
    if (i % 2 === 0) setTimeout(iosTick, at);
    at += ms;
  });
}

// Confetti, drawn on one full-screen canvas, in the game's palette.
export const PARTY = ["#C8FF3D", "#FFD43B", "#6FC8FF", "#3BE3A0", "#19C6C6", "#FF8A2A", "#FF5A4E", "#FFFFFF"];
export function confetti({ count = 140, colors = PARTY, origin = { x: 0.5, y: 0.35 } } = {}) {
  if (reducedMotion()) return;
  let cv = $("#fx");
  if (!cv) {
    cv = html('<canvas id="fx" aria-hidden="true"></canvas>');
    document.body.append(cv);
  }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const v = 7 + Math.random() * 10;
    const roll = Math.random();
    return {
      x: origin.x * W, y: origin.y * H,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 7 + Math.random() * 6, h: 9 + Math.random() * 10,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)],
      shape: roll < 0.25 ? "dot" : roll < 0.4 ? "star" : "card",
    };
  });
  const star = (s) => {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rad = k % 2 ? s * 0.32 : s;
      const ang = (k * Math.PI) / 4;
      ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
  };
  const t0 = performance.now();
  const frame = (now) => {
    const age = now - t0;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 2600);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.shape === "dot") {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "star") star(p.w * 0.75);
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (age < 2700) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(frame);
}

// The segmented control: a thick rail with a small sticker for a thumb. The
// thumb slides on a spring and stretches a little on the way.
// options: [[value, label], ...]
export function segmented(el, options, value, onChange, { label = "" } = {}) {
  el.classList.add("seg");
  el.setAttribute("role", "radiogroup");
  if (label) el.setAttribute("aria-label", label);
  el.innerHTML = `<span class="seg-thumb" aria-hidden="true"></span>` + options.map(([v, l]) => `<button type="button" role="radio" data-juice="seg" data-v="${esc(v)}"><span>${esc(l)}</span></button>`).join("");
  const thumb = el.firstElementChild;
  let placed = false;
  const place = (animate) => {
    const btn = el.querySelector(`button[data-v="${CSS.escape(value)}"]`) || el.querySelector("button");
    if (!btn || !btn.offsetWidth) return;
    const from = thumb.style.translate;
    thumb.style.width = `${btn.offsetWidth}px`;
    thumb.style.translate = `${btn.offsetLeft}px 0`;
    if (animate && placed && from && from !== thumb.style.translate && !reducedMotion()) {
      thumb.animate([{ scale: "1 1" }, { scale: "1.12 1", offset: 0.45 }, { scale: "1 1" }], { duration: 450, easing: "ease-out" });
    }
    thumb.classList.toggle("ready", true);
    placed = true;
  };
  const set = (v, fire) => {
    value = v;
    el.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.v === v;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    place(fire);
    if (fire) onChange(v);
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && b.dataset.v !== value) set(b.dataset.v, true);
  });
  // arrow keys move between options, like a native radio group
  el.addEventListener("keydown", (e) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const rtl = getComputedStyle(el).direction === "rtl";
    let step = keys[e.key];
    if (rtl && (e.key === "ArrowRight" || e.key === "ArrowLeft")) step = -step;
    const i = options.findIndex(([x]) => x === value);
    const next = options[(i + step + options.length) % options.length][0];
    set(next, true);
    el.querySelector(`button[data-v="${CSS.escape(next)}"]`)?.focus();
  });
  set(value, false);
  // first layout (and fonts) can land after this call
  requestAnimationFrame(() => place(false));
  document.fonts?.ready.then(() => place(false));
  if ("ResizeObserver" in window) new ResizeObserver(() => place(false)).observe(el);
  return { set: (v) => set(v, false) };
}

// A switch with a candy knob.
export function switchHtml(id, on, labelledBy) {
  return `<button class="switch" type="button" role="switch" data-juice="switch" aria-checked="${on}" id="${id}" ${labelledBy ? `aria-labelledby="${labelledBy}"` : ""}><span class="knob"></span></button>`;
}

// A light tap on every button-like control that juice.js doesn't already
// handle, in one place.
export function tapHaptics(root = document) {
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button, .chip, [role=switch], [role=tab], [role=radio]");
    if (t && !t.disabled && !t.closest(".wheel") && !t.closest("[data-juice]")) haptic("tap");
  }, true);
}
