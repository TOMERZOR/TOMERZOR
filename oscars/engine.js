// Engine: every frame is a pure function of time. Scenes register their DOM, their update(lt)
// function, their sound cues and their particle bursts while the timeline is built; render(t)
// then only sets styles and draws the canvases. Nothing animates on its own, so any frame can be
// rendered in any order (the renderer splits the video between several browsers).
"use strict";

const W = 1920, H = 1080;
const BEAT = 0.5; // 120 BPM: one beat is half a second, a bar is two seconds

// ---------------------------------------------------------------- math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  lin: (x) => x,
  inQ: (x) => x * x,
  outQ: (x) => 1 - (1 - x) * (1 - x),
  ioQ: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inC: (x) => x * x * x,
  outC: (x) => 1 - Math.pow(1 - x, 3),
  ioC: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  outBounce: (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  },
};
// in/out envelope: 0 before a, ramps to 1 by a+fi, holds, ramps back to 0 between b-fo and b
const env = (t, a, b, fi = 0.3, fo = 0.3, ei = E.outC, eo = E.inQ) =>
  t < a || t > b ? 0 : Math.min(ei(seg(t, a, a + fi)), 1 - eo(seg(t, b - fo, b)));

function rng(seed) { // mulberry32
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// smooth deterministic noise in [-1, 1]
const noise1 = (x, seed = 0) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3) * 2 - 1, hash(i + 1 + seed * 57.3) * 2 - 1, u);
};

// ---------------------------------------------------------------- DOM helpers
function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
// set a style property only when it changed (keeps style recalcs cheap)
function css(e, props) {
  const c = e.__c || (e.__c = {});
  for (const k in props) {
    const v = props[k];
    if (c[k] !== v) { c[k] = v; e.style[k] = v; }
  }
}
const tf = (x = 0, y = 0, s = 1, r = 0, extra = "") =>
  `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${(+s).toFixed(4)}) rotate(${r.toFixed(2)}deg)${extra}`;
// show/hide + opacity in one call
function vis(e, o) {
  css(e, { opacity: o <= 0.001 ? "0" : o >= 0.999 ? "1" : o.toFixed(3), visibility: o <= 0.001 ? "hidden" : "visible" });
}

const ICON_URL = {};
function iconURL(name) {
  if (!ICON_URL[name]) {
    const svg = window.ICONS[name];
    if (!svg) throw new Error("missing icon " + name);
    ICON_URL[name] = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  }
  return ICON_URL[name];
}
function icon(name, size, parent, cls = "") {
  const i = el("img", "ico " + cls, parent);
  i.src = iconURL(name);
  i.style.width = i.style.height = size + "px";
  PRELOAD.push(i);
  return i;
}
const PRELOAD = [];
function img(src, cls, parent) {
  const i = el("img", cls, parent);
  i.src = src;
  PRELOAD.push(i);
  return i;
}

// fit a single line: largest font size (<= max) whose width is <= maxW
function fitLine(e, maxW, max, min = 20) {
  let lo = min, hi = max;
  e.style.whiteSpace = "nowrap";
  e.style.fontSize = hi + "px";
  if (e.scrollWidth <= maxW) return hi;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    e.style.fontSize = mid + "px";
    if (e.scrollWidth <= maxW) lo = mid; else hi = mid;
  }
  e.style.fontSize = lo + "px";
  return lo;
}
// fit wrapped text into a box: largest font size whose height fits
function fitBox(e, maxW, maxH, max, min = 24) {
  e.style.width = maxW + "px";
  let lo = min, hi = max;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    e.style.fontSize = mid + "px";
    if (e.scrollHeight <= maxH && e.scrollWidth <= maxW + 1) lo = mid; else hi = mid;
  }
  e.style.fontSize = lo + "px";
  return lo;
}

// ---------------------------------------------------------------- timeline
const SCENES = [];
const CUES = []; // [name, time, gain]
const MARKS = []; // music sections: [type, time]
const BURSTS = []; // particle bursts (canvas, top layer)
let CURSOR = 0;

function cue(name, t, gain = 1) { CUES.push([name, +t.toFixed(3), +gain.toFixed(3)]); }
function mark(type, t) { MARKS.push([type, +t.toFixed(3)]); }

// add a scene of length dur at the cursor. build(root, t0) returns {update(lt, t)} and may
// register cues relative to t0. env (optional) sets the shared background for this scene.
const qb = (d) => Math.max(BEAT, Math.round(d / BEAT) * BEAT); // durations snap to the beat grid
function scene(name, dur, build, opts = {}) {
  dur = Math.ceil(dur / BEAT - 1e-6) * BEAT; // every scene starts on a beat, so the music stays in sync
  const t0 = CURSOR;
  const root = el("div", "scene " + (opts.cls || ""), document.getElementById("content"));
  root.dataset.name = name;
  root.style.display = "block"; // visible while building so text can be measured
  const s = { name, t0, t1: t0 + dur, root, opts };
  Object.assign(s, build(root, t0, dur) || {});
  root.style.display = "none";
  s.__on = false;
  SCENES.push(s);
  CURSOR += dur;
  return s;
}

// ---------------------------------------------------------------- shared environment
// Each frame starts from these defaults; the active scene overrides what it needs.
const ENV0 = () => ({
  tint: "#120d06", tint2: "#030202", glow: 0.6, glowColor: "255,190,90", glowY: 0.42,
  beams: 0, beamColor: "255,226,160", bokeh: 0.5, bokehColor: "255,200,110",
  shake: 0, zoom: 1, bars: 0, flash: 0, flashColor: "255,255,255", grain: 0.035, vignette: 0.75,
  wipe: null, rays: 0, raysColor: "255,210,120", stars: 0, fade: 0, sepia: 0, hue: 0,
});
let ENV = ENV0();

// global transitions at scene boundaries: drawn on top of everything
const TRANS = []; // {t, kind, colors}
function transition(t, kind = "wipe", colors) { TRANS.push({ t, kind, colors }); }

// ---------------------------------------------------------------- particles
// A burst is analytic: every particle's position is a closed-form function of its age.
const CONF_COLORS = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f8f9fa", "#ffb703", "#c77dff", "#ff8fab"];
function burst(t0, opts) {
  const b = Object.assign({ t0, x: W / 2, y: H / 2, n: 120, kind: "confetti", life: 4.5, speed: 1300, spread: Math.PI * 2,
    angle: -Math.PI / 2, gravity: 1400, colors: CONF_COLORS, size: 1, seed: Math.floor(t0 * 1000) % 100000 }, opts);
  const r = rng(b.seed + 7);
  b.parts = Array.from({ length: b.n }, () => {
    const a = b.angle + (r() - 0.5) * b.spread;
    const v = b.speed * (0.35 + r() * 0.75);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: b.colors[Math.floor(r() * b.colors.length)], w: (8 + r() * 12) * b.size,
      h: (12 + r() * 16) * b.size, rot: r() * 6.28, vr: (r() - 0.5) * 18, ph: r() * 6.28, drag: 1.4 + r() * 1.6, life: b.life * (0.7 + r() * 0.3) };
  });
  BURSTS.push(b);
  return b;
}

function drawBursts(ctx, t) {
  for (const b of BURSTS) {
    const age = t - b.t0;
    if (age < 0 || age > b.life) continue;
    for (const p of b.parts) {
      if (age > p.life) continue;
      // velocity decays with drag (air), gravity pulls; terminal flutter for confetti
      const k = p.drag, e = Math.exp(-k * age);
      const x = b.x + (p.vx / k) * (1 - e) + (b.kind === "confetti" ? Math.sin(age * 4 + p.ph) * 26 : 0);
      const term = b.gravity / k;
      const y = b.y + ((p.vy - term) / k) * (1 - e) + term * age;
      const fade = 1 - seg(age, p.life * 0.75, p.life);
      if (x < -60 || x > W + 60 || y > H + 60) continue;
      ctx.globalAlpha = fade;
      if (b.kind === "confetti") {
        const rot = p.rot + p.vr * age;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(1, Math.cos(age * 7 + p.ph));
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 4, p.w, p.h / 2);
        ctx.restore();
      } else if (b.kind === "spark") { // glowing gold sparks with a short trail
        const s = p.w * 0.35 * (1 - seg(age, 0, p.life));
        const vx = p.vx * Math.exp(-k * age), vy = (p.vy - term) * Math.exp(-k * age) + term;
        const g = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
        g.addColorStop(0, "rgba(255,250,220,1)");
        g.addColorStop(0.35, "rgba(255,205,90,0.85)");
        g.addColorStop(1, "rgba(255,160,40,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, s * 3, 0, 6.29);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,220,140,0.6)";
        ctx.lineWidth = s * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - vx * 0.03, y - vy * 0.03);
        ctx.stroke();
      } else if (b.kind === "firework") {
        const s = 2.2 + p.w * 0.12;
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(x, y, s * (1 - seg(age, 0, p.life) * 0.6), 0, 6.29);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- background canvas
const BOKEH = (() => {
  const r = rng(99);
  return Array.from({ length: 46 }, () => ({ x: r() * W, y: r() * H, s: 10 + r() * 60, sp: 8 + r() * 26, ph: r() * 6.28, a: 0.15 + r() * 0.5 }));
})();
const STARS = (() => {
  const r = rng(5);
  return Array.from({ length: 160 }, () => ({ x: r() * W, y: r() * H, s: 0.6 + r() * 2.2, ph: r() * 6.28, f: 0.5 + r() * 2 }));
})();

function drawBack(ctx, t, e) {
  ctx.clearRect(0, 0, W, H);
  // base gradient
  const g = ctx.createRadialGradient(W / 2, H * e.glowY, 50, W / 2, H * 0.55, W * 0.75);
  g.addColorStop(0, e.tint);
  g.addColorStop(1, e.tint2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (e.glow > 0) {
    const gg = ctx.createRadialGradient(W / 2, H * e.glowY, 0, W / 2, H * e.glowY, 760);
    gg.addColorStop(0, `rgba(${e.glowColor},${0.32 * e.glow})`);
    gg.addColorStop(1, `rgba(${e.glowColor},0)`);
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = "lighter";
  if (e.stars > 0) {
    for (const s of STARS) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.f * 2 + s.ph);
      ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.75 * tw) * e.stars})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }
  if (e.rays > 0) { // rotating god rays behind the hero
    ctx.save();
    ctx.translate(W / 2, H * e.glowY);
    ctx.rotate(t * 0.18);
    const n = 18;
    for (let i = 0; i < n; i++) {
      ctx.rotate((Math.PI * 2) / n);
      const rg = ctx.createLinearGradient(0, 0, 0, -1300);
      rg.addColorStop(0, `rgba(${e.raysColor},${0.22 * e.rays})`);
      rg.addColorStop(1, `rgba(${e.raysColor},0)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-70, -1300);
      ctx.lineTo(70, -1300);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  if (e.beams > 0) { // stage spotlights sweeping from the top
    const defs = [[0.18, 0.9, 0], [0.82, 1.1, 2], [0.5, 0.7, 4]];
    for (const [px, sp, ph] of defs) {
      const ang = Math.sin(t * 0.55 * sp + ph) * 0.38;
      ctx.save();
      ctx.translate(W * px, -60);
      ctx.rotate(ang);
      const bg = ctx.createLinearGradient(0, 0, 0, H * 1.25);
      bg.addColorStop(0, `rgba(${e.beamColor},${0.42 * e.beams})`);
      bg.addColorStop(1, `rgba(${e.beamColor},0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.lineTo(260, H * 1.25);
      ctx.lineTo(-260, H * 1.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  if (e.bokeh > 0) {
    for (const b of BOKEH) {
      const y = ((b.y - t * b.sp) % (H + 200) + H + 200) % (H + 200) - 100;
      const x = b.x + Math.sin(t * 0.4 + b.ph) * 30;
      const a = b.a * e.bokeh * (0.6 + 0.4 * Math.sin(t * 1.3 + b.ph));
      const bg = ctx.createRadialGradient(x, y, 0, x, y, b.s);
      bg.addColorStop(0, `rgba(${e.bokehColor},${a * 0.55})`);
      bg.addColorStop(0.6, `rgba(${e.bokehColor},${a * 0.25})`);
      bg.addColorStop(1, `rgba(${e.bokehColor},0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, b.s, 0, 6.29);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

// transitions: angled color panels sweep right-to-left (the reading direction), covering the cut
function drawTrans(ctx, t) {
  for (const tr of TRANS) {
    const a = t - tr.t;
    if (tr.kind === "wipe") {
      if (a < -0.42 || a > 0.42) continue;
      const cols = tr.colors || ["#f2c14e", "#1b1206", "#ffffff"];
      for (let i = 0; i < 3; i++) {
        // each panel enters from the right, covers, and exits to the left; staggered
        const p = seg(a, -0.42 + i * 0.06, 0.42 - (2 - i) * 0.06);
        const x = lerp(W + 400, -W - 900, E.ioC(p));
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath();
        ctx.moveTo(x + 300, 0);
        ctx.lineTo(x + 300 + W + 300, 0);
        ctx.lineTo(x + W + 300, H);
        ctx.lineTo(x, H);
        ctx.closePath();
        ctx.fill();
      }
    } else if (tr.kind === "flash") {
      if (a < -0.05 || a > 0.5) continue;
      const o = a < 0 ? seg(a, -0.05, 0) : 1 - E.outQ(seg(a, 0, 0.5));
      ctx.fillStyle = `rgba(255,255,255,${o})`;
      ctx.fillRect(0, 0, W, H);
    } else if (tr.kind === "iris") { // black circle closes then opens
      if (a < -0.35 || a > 0.35) continue;
      const p = a < 0 ? E.inC(seg(a, -0.35, 0)) : 1 - E.outC(seg(a, 0, 0.35));
      const R = lerp(1300, 0, p);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(W / 2, H / 2, Math.max(R, 0.1), 0, 6.29, true);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- render
let backCtx, topCtx, transCtx, grainEl, flashEl, worldEl, barsEls;
function setupRender() {
  backCtx = document.getElementById("back").getContext("2d");
  topCtx = document.getElementById("top").getContext("2d");
  transCtx = document.getElementById("trans").getContext("2d");
  grainEl = document.getElementById("grain");
  flashEl = document.getElementById("flash");
  worldEl = document.getElementById("world");
  barsEls = [document.getElementById("barT"), document.getElementById("barB")];
  // film grain texture made once from a seeded generator
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d"), d = x.createImageData(256, 256), r = rng(3);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  grainEl.style.backgroundImage = `url(${c.toDataURL()})`;
}

function render(t) {
  ENV = ENV0();
  for (const s of SCENES) {
    const on = t >= s.t0 && t < s.t1;
    if (on !== s.__on) { s.root.style.display = on ? "block" : "none"; s.__on = on; }
    if (on && s.update) s.update(t - s.t0, t);
  }
  drawBack(backCtx, t, ENV);
  topCtx.clearRect(0, 0, W, H);
  drawBursts(topCtx, t);
  transCtx.clearRect(0, 0, W, H);
  drawTrans(transCtx, t);
  // camera shake + zoom on the world layer
  const sh = ENV.shake;
  const sx = sh ? noise1(t * 28, 1) * 18 * sh : 0, sy = sh ? noise1(t * 28, 2) * 14 * sh : 0;
  css(worldEl, { transform: `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) scale(${(ENV.zoom * (1 + 0.03 * Math.min(1, sh))).toFixed(4)})` });
  const fi = Math.floor(t * 12); // grain moves at 12 fps: film feel without bloating the file
  css(grainEl, { opacity: ENV.grain.toFixed(3), backgroundPosition: `${Math.floor(hash(fi) * 256)}px ${Math.floor(hash(fi + 9) * 256)}px` });
  css(document.getElementById("vignette"), { opacity: ENV.vignette.toFixed(3) });
  css(flashEl, { opacity: ENV.flash.toFixed(3), background: `rgb(${ENV.flashColor})` });
  const bh = (ENV.bars * 120).toFixed(1) + "px";
  css(barsEls[0], { height: bh });
  css(barsEls[1], { height: bh });
  css(document.getElementById("fade"), { opacity: ENV.fade.toFixed(3) });
  css(document.getElementById("world"), { filter: ENV.sepia ? `sepia(${ENV.sepia.toFixed(2)})` : "none" });
}
