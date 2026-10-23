// lib.js: timing, easing, seeded noise, frame loading, drawing helpers, glass fracture and the 3D phone.
'use strict';
const W = 1920, H = 1080, FPS = 30, FRAMES = 987;
const BEAT = 0.48388, B0 = -0.0016;
const tb = (b) => B0 + b * BEAT; // music beat -> seconds (Take this Higher, 124 BPM)

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const E = {
  lin: (k) => k,
  inQuad: (k) => k * k,
  outQuad: (k) => 1 - (1 - k) * (1 - k),
  inCubic: (k) => k * k * k,
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  outQuint: (k) => 1 - Math.pow(1 - k, 5),
  inExpo: (k) => (k <= 0 ? 0 : Math.pow(2, 10 * k - 10)),
  outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inOutExpo: (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2),
  outBack: (k) => { const s = 1.4; return 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2); },
};
const tw = (t, t0, t1, a, b, e = E.outCubic) => lerp(a, b, e(inv(t0, t1, t)));
// damped spring 0 -> 1, dt seconds after release (f Hz, z damping ratio)
function spring(dt, f = 2.2, z = 0.55) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z * w / wd) * Math.sin(wd * dt));
}
const decay = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (seed, n) => rng((seed * 9973 + n * 7919 + 13) >>> 0)() * 2 - 1;
function noise1(seed, x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(seed, i), hash(seed, i + 1), u); }

// ---------------------------------------------------------------- frames
const _img = new Map();
function loadImg(url) {
  let p = _img.get(url);
  if (!p) {
    p = new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('image failed: ' + url));
      im.src = url;
    }).then((im) => im.decode().then(() => im));
    _img.set(url, p);
    if (_img.size > 140) _img.delete(_img.keys().next().value);
  }
  return p;
}
const has = (clip) => !!CLIPS[clip];
const fidx = (clip, sec) => { const c = CLIPS[clip]; return clamp(Math.floor(sec * c.fps + 1e-4), 0, c.n - 1); };
const furl = (clip, i) => `../plates/${CLIPS[clip].dir}/${String(i).padStart(5, '0')}.jpg`;
async function frame(clip, sec) { return loadImg(furl(clip, fidx(clip, sec))); }
// slow motion: the two source frames around sec and the blend weight
async function frame2(clip, sec) {
  const c = CLIPS[clip], x = clamp(sec * c.fps, 0, c.n - 1), i = Math.floor(x + 1e-4), j = Math.min(c.n - 1, i + 1);
  const [a, b] = await Promise.all([loadImg(furl(clip, i)), loadImg(furl(clip, j))]);
  return { a, b, k: j === i ? 0 : clamp(x - i) };
}

// ---------------------------------------------------------------- canvas helpers
function mk(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// draw an image covering the rect; z = zoom about the focus point (fx, fy in 0..1), ox/oy pixel offset
function cover(c, im, x, y, w, h, o = {}) {
  const iw = im.width, ih = im.height, s = Math.max(w / iw, h / ih) * (o.z || 1);
  const dw = iw * s, dh = ih * s, fx = o.fx ?? 0.5, fy = o.fy ?? 0.5;
  c.drawImage(im, x + (w - dw) * fx + (o.ox || 0), y + (h - dh) * fy + (o.oy || 0), dw, dh);
}
// footage frame (optionally blended for slow motion) covering the full frame
async function footage(c, clip, sec, o = {}) {
  if (!has(clip)) { c.fillStyle = o.ph || '#223'; c.fillRect(0, 0, W, H); return; }
  if (o.blend) {
    const f = await frame2(clip, sec);
    cover(c, f.a, 0, 0, W, H, o);
    if (f.k > 0.02) { c.save(); c.globalAlpha = f.k; cover(c, f.b, 0, 0, W, H, o); c.restore(); }
  } else cover(c, await frame(clip, sec), 0, 0, W, H, o);
}
function font(c, size, weight = 900) { c.font = `${weight} ${size}px Nunito`; }
function vgrad(c, y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(([k, col]) => g.addColorStop(k, col)); return g; }
function vignette(c, a = 0.45, inner = 0.45) {
  const g = c.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

// Headline with a mask reveal: rises from below its line box, blur to sharp; exits with blur and a slight scale.
// o: size, weight, color, t, t0, dur, out, outDur, align ('center'|'left'|'right'), track (em), shadow
function headline(c, str, x, y, o) {
  const k = E.outExpo(inv(o.t0, o.t0 + (o.dur || 0.7), o.t));
  if (k <= 0.001) return 0;
  const ko = o.out != null ? E.inCubic(inv(o.out, o.out + (o.outDur || 0.28), o.t)) : 0;
  if (ko >= 0.999) return 0;
  c.save();
  font(c, o.size, o.weight || 900);
  c.letterSpacing = `${((o.track ?? -0.015) * o.size).toFixed(2)}px`;
  c.textAlign = o.align || 'center';
  c.textBaseline = 'alphabetic';
  const w = c.measureText(str).width, asc = o.size * 0.95, desc = o.size * 0.32;
  const left = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
  if (!o.nomask) { c.beginPath(); c.rect(left - o.size, y - asc - 6, w + o.size * 2, asc + desc + 12); c.clip(); }
  const blur = (1 - k) * 14 + ko * 18;
  if (blur > 0.25) c.filter = `blur(${blur.toFixed(2)}px)`;
  c.globalAlpha = clamp(k * 1.6) * (1 - ko) * (o.alpha ?? 1);
  if (o.shadow) { c.shadowColor = o.shadow; c.shadowBlur = o.size * 0.35; }
  c.translate(x, y + (o.nomask ? 0 : (1 - k) * (asc + desc) * 0.9));
  const s = (1 + ko * 0.05) * (o.scale || 1);
  if (s !== 1) c.scale(s, s);
  c.fillStyle = o.color || '#fff';
  c.fillText(str, 0, 0);
  c.restore();
  return w;
}

// ---------------------------------------------------------------- glass fracture
function clipPoly(p, nx, ny, d) { // keep the side where nx*x + ny*y <= d
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const k = da / (da - db); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out;
}
function split(p, px, py, ang) {
  const nx = Math.cos(ang), ny = Math.sin(ang), d = nx * px + ny * py;
  return [clipPoly(p, nx, ny, d), clipPoly(p, -nx, -ny, -d)].filter((q) => q.length >= 3 && Math.abs(polyArea(q)) > 4);
}
function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function centroid(p) { let x = 0, y = 0; p.forEach((q) => { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
// Radial cracks from (cx, cy), then concentric rings, then random splits of the largest pieces.
function fracture(rect, cx, cy, seed, o = {}) {
  const R = rng(seed), [x0, y0, x1, y1] = rect;
  let polys = [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
  const n = o.radial || 9, a0 = R() * Math.PI;
  for (let i = 0; i < n; i++) { const ang = a0 + ((i + (R() - 0.5) * 0.7) * Math.PI) / n; polys = polys.flatMap((p) => split(p, cx, cy, ang)); }
  const rings = o.rings || [90, 220, 400, 640, 950];
  polys = polys.flatMap((p) => {
    const [mx, my] = centroid(p), ang = Math.atan2(my - cy, mx - cx);
    let parts = [p];
    for (const r0 of rings) {
      const r = r0 * (0.75 + R() * 0.5), px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
      parts = parts.flatMap((q) => split(q, px, py, ang + (R() - 0.5) * 0.9));
    }
    return parts;
  });
  for (let pass = 0; pass < (o.extra || 1); pass++) {
    const lim = o.maxArea || 26000;
    polys = polys.flatMap((p) => { if (Math.abs(polyArea(p)) < lim) return [p]; const [mx, my] = centroid(p); return split(p, mx + (R() - 0.5) * 20, my + (R() - 0.5) * 20, R() * Math.PI); });
  }
  return polys.map((p, i) => {
    const [mx, my] = centroid(p);
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    p.forEach(([x, y]) => { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); });
    const d = Math.hypot(mx - cx, my - cy);
    return { p, c: [mx, my], b: [bx0, by0, bx1, by1], d, r1: R(), r2: R(), r3: R(), r4: R(), i };
  });
}
function polyPath(c, p) { c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]); c.closePath(); }
// one shard of src, moved: (dx, dy) offset, rotation rot about its centroid, scale s, alpha a; edge highlight e
function drawShard(c, src, sh, dx, dy, rot, s, a, e = 0.3, blur = 0) {
  if (a <= 0.003) return;
  const [mx, my] = sh.c, [bx0, by0, bx1, by1] = sh.b;
  c.save();
  c.globalAlpha = a;
  c.translate(mx + dx, my + dy); c.rotate(rot); c.scale(s, s); c.translate(-mx, -my);
  polyPath(c, sh.p);
  c.save(); c.clip();
  if (blur > 0.3) c.filter = `blur(${blur.toFixed(1)}px)`;
  const pad = 2, sx = Math.max(0, bx0 - pad), sy = Math.max(0, by0 - pad), sw = Math.min(src.width, bx1 + pad) - sx, sh2 = Math.min(src.height, by1 + pad) - sy;
  if (sw > 0 && sh2 > 0) c.drawImage(src, sx, sy, sw, sh2, sx, sy, sw, sh2);
  c.restore();
  if (e > 0) { c.lineWidth = 1.6 / s; c.strokeStyle = `rgba(255,255,255,${e})`; c.lineJoin = 'round'; c.stroke(); }
  c.restore();
}

// ---------------------------------------------------------------- the phone
// Flat front view: titanium body, rim, the screen (game frame), Dynamic Island and a moving glare.
const PB = { w: 640, scr: 0.034, rad: 0.165 };
PB.sw = PB.w - 2 * Math.round(PB.w * PB.scr);
PB.sh = Math.round((PB.sw * 1600) / 744);
PB.h = PB.sh + (PB.w - PB.sw);
const _flat = mk(PB.w, PB.h), _side = mk(PB.w, PB.h);
(function sideBody() {
  const c = _side.getContext('2d'), r = PB.w * PB.rad;
  c.fillStyle = vgrad(c, 0, PB.h, [[0, '#5a5c63'], [0.5, '#2c2d31'], [1, '#4b4d53']]);
  c.beginPath(); c.roundRect(0, 0, PB.w, PB.h, r); c.fill();
})();
function phoneFlat(screen, glare = 0.5, dim = 0) {
  const c = _flat.getContext('2d'), r = PB.w * PB.rad, ins = (PB.w - PB.sw) / 2, sr = r - ins;
  c.clearRect(0, 0, PB.w, PB.h);
  // body + rim
  c.fillStyle = '#0b0b0d'; c.beginPath(); c.roundRect(0, 0, PB.w, PB.h, r); c.fill();
  c.lineWidth = 5; c.strokeStyle = vgrad(c, 0, PB.h, [[0, '#9a9ca3'], [0.25, '#55575d'], [0.6, '#8d8f96'], [1, '#4a4c52']]);
  c.beginPath(); c.roundRect(2.5, 2.5, PB.w - 5, PB.h - 5, r - 2.5); c.stroke();
  // screen
  c.save(); c.beginPath(); c.roundRect(ins, ins, PB.sw, PB.sh, sr); c.clip();
  if (typeof screen === 'function') screen(c, ins, ins, PB.sw, PB.sh);
  else if (screen) c.drawImage(screen, ins, ins, PB.sw, PB.sh);
  if (dim > 0) { c.fillStyle = `rgba(0,0,0,${dim})`; c.fillRect(ins, ins, PB.sw, PB.sh); }
  // glare band that slides with the turn
  const gx = lerp(-0.6, 1.6, glare) * PB.w;
  const g = c.createLinearGradient(gx - 260, 0, gx + 260, PB.h * 0.35);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(ins, ins, PB.sw, PB.sh);
  c.restore();
  // Dynamic Island
  const iw = PB.sw * 0.3, ih = PB.sw * 0.088;
  c.fillStyle = '#000'; c.beginPath(); c.roundRect((PB.w - iw) / 2, ins + PB.sw * 0.03, iw, ih, ih / 2); c.fill();
  return _flat;
}
// Perspective draw of a flat canvas turned by rotY about its vertical axis (column strips), then rolled.
function warp(c, flat, cx, cy, scale, rotY, roll = 0, persp = 2600, strips = 150, dx = 0) {
  const fw = flat.width, fh = flat.height, ct = Math.cos(rotY), st = Math.sin(rotY);
  c.save(); c.translate(cx, cy); if (roll) c.rotate(roll);
  for (let i = 0; i < strips; i++) {
    const u0 = (i / strips - 0.5) * fw * scale, u1 = ((i + 1) / strips - 0.5) * fw * scale;
    const p0 = persp / (persp + u0 * st), p1 = persp / (persp + u1 * st);
    const x0 = u0 * ct * p0, x1 = u1 * ct * p1, hh = fh * scale * (p0 + p1) / 2;
    c.drawImage(flat, (i / strips) * fw, 0, fw / strips, fh, Math.min(x0, x1) + dx, -hh / 2, Math.abs(x1 - x0) + 0.7, hh);
  }
  c.restore();
}
// Full phone: soft shadow, side thickness, front. h = on-screen body height at rotY 0.
function phone(c, screen, o) {
  const scale = o.h / PB.h, rotY = o.rotY || 0, roll = o.roll || 0;
  if (o.shadow) {
    c.save(); c.globalAlpha = o.shadow; c.filter = `blur(${(o.h * 0.05).toFixed(1)}px)`; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(o.x + o.h * 0.04, o.y + o.h * 0.53, PB.w * scale * 0.55, o.h * 0.035, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  const th = PB.w * 0.05 * Math.abs(Math.sin(rotY)) * scale;
  for (let k = 1; k <= 4; k++) warp(c, _side, o.x, o.y, scale, rotY, roll, 2600, 60, -Math.sign(rotY || 1) * th * (k / 4));
  warp(c, phoneFlat(screen, o.glare ?? clamp(0.5 + rotY), o.dim || 0), o.x, o.y, scale, rotY, roll);
}
