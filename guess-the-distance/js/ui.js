// Small DOM and feel helpers: element building, count-ups, toasts,
// confetti, haptics, segmented controls.

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

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);

// Count a number up, calling onTick with progress so sounds can follow.
export function countUp(el, to, { from = 0, ms = 1200, format = (v) => Math.round(v).toLocaleString(getLang() === "he" ? "he-IL" : "en-US"), onTick, html: asHtml = false } = {}) {
  return new Promise((resolve) => {
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

let toastTimer;
export function toast(msg, ms = 2400) {
  let el = $(".toast");
  if (!el) {
    el = html('<div class="toast glass" role="status" aria-live="polite"></div>');
    document.body.append(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add("on"));
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

// Confetti, drawn on one full-screen canvas.
export function confetti({ count = 140, colors = ["#ff2d87", "#ffcc00", "#34c759", "#0a84ff", "#af52de", "#ff9500"], origin = { x: 0.5, y: 0.35 } } = {}) {
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
    return {
      x: origin.x * W, y: origin.y * H,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 10,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)],
      round: Math.random() < 0.3,
    };
  });
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
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (age < 2700) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(frame);
}

// iOS-style segmented control. options: [[value, label], ...]
export function segmented(el, options, value, onChange) {
  el.classList.add("segmented");
  el.setAttribute("role", "radiogroup");
  el.innerHTML = `<span class="thumb"></span>` + options.map(([v, l]) => `<button type="button" role="radio" data-v="${esc(v)}">${esc(l)}</button>`).join("");
  const thumb = el.firstElementChild;
  const set = (v, fire) => {
    value = v;
    const btns = $$("button", el);
    btns.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === v)));
    const i = Math.max(0, options.findIndex(([x]) => x === v));
    const pct = 100 / options.length;
    thumb.style.width = `calc(${pct}% - ${6 / options.length}px)`;
    thumb.style.insetInlineStart = `calc(${pct * i}% + 3px - ${(i * 6) / options.length}px)`;
    if (fire) onChange(v);
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && b.dataset.v !== value) set(b.dataset.v, true);
  });
  set(value, false);
  return { set: (v) => set(v, false) };
}

// A tiny press-and-feel helper for big buttons.
export function onTap(el, fn) {
  el.addEventListener("click", (e) => fn(e));
}

// A light tap on every button-like control, in one place.
export function tapHaptics(root = document) {
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button, .chip, .art-card, [role=switch], [role=tab], [role=radio]");
    if (t && !t.disabled && !t.closest(".wheel")) haptic("tap");
  }, true);
}
