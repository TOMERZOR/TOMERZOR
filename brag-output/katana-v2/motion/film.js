// film.js: the SHARD launch film, drawn from time alone (window.hfPage contract).
'use strict';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const F = mk(), X = mk(), Z = mk();
const fx = F.getContext('2d'), xx = X.getContext('2d'), zx = Z.getContext('2d');
const COL = {
  light: ['#ffffff', '#e6e6eb'], dawn: ['#fff3ea', '#f3c3ab'], ember: ['#ffd6c4', '#e98d70'], night: ['#33467c', '#0a1124'],
  ink: '#1d1d1f', gray: '#a1a1a6',
};
const TX = {}, FR = {}, IMG = {};

// ---------------------------------------------------------------- set-up (fonts, text art, fracture patterns)
function textArt(str, size, track, fill) {
  const m = mk(8, 8).getContext('2d');
  font(m, size, 900); m.letterSpacing = `${track * size}px`;
  const w = Math.ceil(m.measureText(str).width + size * 0.5), h = Math.ceil(size * 1.3);
  const cvs = mk(w, h), c = cvs.getContext('2d');
  font(c, size, 900); c.letterSpacing = `${track * size}px`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillStyle = fill(c, h); c.fillText(str, w / 2 + (track * size) / 2, size * 1.0);
  return cvs;
}
function inked(cvs, shards) { // keep the shards that cover letter pixels
  const d = cvs.getContext('2d').getImageData(0, 0, cvs.width, cvs.height).data;
  const a = (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= cvs.width || y >= cvs.height ? 0 : d[(y * cvs.width + x) * 4 + 3]; };
  return shards.filter((s) => { if (a(s.c[0], s.c[1]) > 8) return true; return s.p.some(([x, y]) => a(lerp(x, s.c[0], 0.35), lerp(y, s.c[1], 0.35)) > 8); });
}
function crackArt(art, shards, color, width) { // every shard edge, kept inside the letters
  const cvs = mk(art.width, art.height), c = cvs.getContext('2d');
  c.lineWidth = width; c.strokeStyle = color; c.lineJoin = 'round';
  shards.forEach((sh) => { polyPath(c, sh.p); c.stroke(); });
  c.globalCompositeOperation = 'destination-in'; c.drawImage(art, 0, 0);
  return cvs;
}
async function init() {
  await Promise.all([document.fonts.load('900 100px Nunito'), document.fonts.load('800 40px Nunito')]);
  const glassFill = (c, h) => vgrad(c, 0, h, [[0, '#ffffff'], [0.55, '#eef4ff'], [1, '#ffffff']]);
  TX.shatter = textArt('SHATTER.', 200, 0.06, glassFill);
  TX.word = textArt('SHARD', 236, 0.1, glassFill);
  for (const k of ['shatter', 'word']) {
    const c = TX[k], w = c.width, h = c.height;
    FR[k] = inked(c, fracture([0, 0, w, h], w * 0.5, h * 0.5, k === 'word' ? 21 : 33, { radial: 8, rings: [h * 0.18, h * 0.42, h * 0.75, w * 0.22, w * 0.4], maxArea: (w * h) / 95, extra: 2 }));
  }
  FR.frame = fracture([0, 0, W, H], 960, 520, 7, { radial: 10, rings: [80, 190, 340, 540, 780, 1080], maxArea: 36000, extra: 2 });
  FR.frameSorted = [...FR.frame].sort((a, b) => a.r2 - b.r2);
  TX.shatterCr = crackArt(TX.shatter, FR.shatter, 'rgb(150,205,255)', 2.6);
  TX.wordCr = crackArt(TX.word, FR.word, 'rgb(190,225,255)', 2.2);
  const names = ['steel', 'chalk', 'coral', 'jade', 'cobalt', 'marble', 'gold', 'obsidian', 'moon', 'sunset', 'aurora', 'prism'];
  IMG.balls = await Promise.all(names.map((n) => loadImg(`assets/balls/${n}.png`)));
  IMG.icon = await loadImg('assets/icon.png');
  // glass particles for the logo burst
  const R = rng(99), pal = ['#96CDFF', '#FFBEC8', '#BEAFFF', '#ffffff', '#BFF0E0'];
  FR.burst = Array.from({ length: 90 }, () => {
    const n = 3 + Math.floor(R() * 2), r = 6 + R() * 26, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + R() * 0.9; pts.push([Math.cos(a) * r * (0.5 + R() * 0.6), Math.sin(a) * r * (0.5 + R() * 0.6)]); }
    return { pts, a: R() * Math.PI * 2, v: 0.35 + R() * 0.75, spin: (R() - 0.5) * 9, col: pal[Math.floor(R() * pal.length)], z: R() };
  });
}

// ---------------------------------------------------------------- typography
// a word that slams in: big scale spring, quick fade, slight shadow
function slam(c, str, x, y, o) {
  const dt = o.t - o.t0; if (dt < 0) return;
  const ko = o.out != null ? E.inCubic(inv(o.out, o.out + 0.26, o.t)) : 0; if (ko >= 0.999) return;
  c.save(); font(c, o.size, 900); c.letterSpacing = `${((o.track ?? -0.01) * o.size).toFixed(2)}px`; c.textAlign = 'center';
  const s = (1 + (o.from ?? 0.42) * (1 - spring(dt, o.f || 2.8, 0.52))) * (1 + ko * 0.06);
  c.globalAlpha = clamp(dt / 0.05) * (1 - ko);
  if (ko > 0.01) c.filter = `blur(${(ko * 16).toFixed(1)}px)`;
  c.shadowColor = o.shadow || 'rgba(0,0,0,0.35)'; c.shadowBlur = o.size * 0.3;
  c.translate(x, y - o.size * 0.35); c.scale(s, s); c.fillStyle = o.color || '#fff'; c.fillText(str, 0, o.size * 0.35);
  c.restore();
}
// frosted-glass letters: the picture behind them, blurred and lifted, a milky body, a rim light and a moving glint
function glassWord(c, str, x, y, o) {
  const k = E.outExpo(inv(o.t0, o.t0 + 0.8, o.t)); if (k <= 0.001) return;
  const ko = o.out != null ? E.inCubic(inv(o.out, o.out + 0.28, o.t)) : 0; if (ko >= 0.999) return;
  const size = o.size, asc = size * 0.95, desc = size * 0.32, dy = (1 - k) * (asc + desc) * 0.9, blur = (1 - k) * 14 + ko * 18;
  const line = (cc) => { cc.beginPath(); cc.rect(0, y - asc - 6, W, asc + desc + 12); cc.clip(); };
  const setup = (cc) => { font(cc, size, 900); cc.letterSpacing = `${(-0.015 * size).toFixed(2)}px`; cc.textAlign = 'center'; cc.textBaseline = 'alphabetic'; };
  zx.save(); zx.globalCompositeOperation = 'copy'; zx.fillStyle = 'rgba(0,0,0,0)'; zx.fillRect(0, 0, W, H); zx.restore();
  zx.save(); line(zx); setup(zx); if (blur > 0.25) zx.filter = `blur(${blur.toFixed(2)}px)`; zx.fillStyle = '#fff'; zx.fillText(str, x, y + dy); zx.restore();
  zx.save(); zx.globalCompositeOperation = 'source-in'; zx.filter = 'blur(10px) brightness(2.8) saturate(1.25)'; zx.drawImage(c.canvas, 0, 0); zx.restore();
  zx.save(); zx.globalCompositeOperation = 'source-atop';
  zx.fillStyle = 'rgba(235,242,255,0.5)'; zx.fillRect(0, 0, W, H);
  const gx = lerp(x - 700, x + 700, E.inOutSine(inv(o.t0 + 0.25, o.t0 + 1.35, o.t)));
  const g = zx.createLinearGradient(gx - 160, y - asc, gx + 160, y + desc);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  zx.fillStyle = g; zx.fillRect(0, 0, W, H); zx.restore();
  const a = clamp(k * 1.6) * (1 - ko);
  c.save(); c.globalAlpha = a; c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 30; c.drawImage(Z, 0, 0); c.restore();
  c.save(); c.globalAlpha = a; line(c); setup(c); if (blur > 0.25) c.filter = `blur(${blur.toFixed(2)}px)`;
  c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.strokeText(str, x, y + dy); c.restore();
}
function sweep(c, art, x, y, k, s = 1) { // glint across text art (top-left at x, y)
  if (k <= 0 || k >= 1) return;
  const w = art.width, h = art.height, S = mk.sweep || (mk.sweep = mk(1400, 420)), sc = S.getContext('2d');
  sc.save(); sc.globalCompositeOperation = 'copy'; sc.drawImage(art, 0, 0); sc.globalCompositeOperation = 'source-in';
  const gx = lerp(-0.3, 1.3, k) * w, g = sc.createLinearGradient(gx - 140, 0, gx + 140, h);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(160,210,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  sc.fillStyle = g; sc.fillRect(0, 0, w, h); sc.restore();
  c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(S, 0, 0, w, h, x, y, w * s, h * s); c.restore();
}

// ---------------------------------------------------------------- shots
async function sc1(c, t) { // the glass world in near silence: three punch-in cuts on the stabs
  const i = t < tb(2.5) ? 0 : t < tb(4.5) ? 1 : 2, p = P.s1[i];
  const dim = tw(t, 0.15, 0.75, 1, 0.6, E.inOutSine);
  c.save(); c.filter = `brightness(${dim.toFixed(3)})`;
  await footage(c, p.clip, p.src(t), { z: [1.0, 1.1, 1.2][i] * (1 + 0.02 * (t - p.t0)), ph: '#0a0d16' });
  c.restore();
  const g = c.createRadialGradient(W / 2, 560, 0, W / 2, 560, 760); g.addColorStop(0, `rgba(0,0,0,${(0.42 * (1 - dim) / 0.4).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  vignette(c, 0.55);
  headline(c, 'Everything here', W / 2, 500, { t, t0: 0.3, size: 124, out: 2.84, shadow: 'rgba(0,0,0,0.35)' });
  glassWord(c, 'is glass.', W / 2, 655, { t, t0: tb(2.5), size: 124, out: 2.84 });
}
function reticle(c, t) { // target brackets lock onto the glass needle on Aim., flash and collapse on Fire.
  const k = E.outExpo(inv(T.aim + 0.1, T.aim + 0.75, t)), kf = inv(T.fire, T.fire + 0.35, t);
  if (k <= 0 || kf >= 1) return;
  const cx = 960, cy = 255, s = lerp(260, 92, k) * (1 - 0.6 * E.inCubic(kf)), L = 26, a = clamp(k * 1.5) * (1 - kf);
  c.save(); c.globalAlpha = a; c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = cx + sx * s, y = cy + sy * s;
    c.beginPath(); c.moveTo(x, y - sy * L); c.lineTo(x, y); c.lineTo(x - sx * L, y); c.stroke();
  }
  const pulse = 0.5 + 0.5 * Math.sin((t - T.aim) * 9);
  c.globalAlpha = a * (0.35 + 0.35 * pulse) + kf * 0.8 * (1 - kf); c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
  c.restore();
}
async function sc2(c, t) { // the ball: Aim. Fire.
  await footage(c, P.s2.clip, P.s2.src(t), { z: 1.03 + 0.025 * (t - T.s2), ph: '#0a0d16' });
  vignette(c, 0.5);
  reticle(c, t);
  headline(c, 'Aim.', 520, 330, { t, t0: T.aim, size: 156, out: tb(11.5), shadow: 'rgba(0,0,0,0.35)' });
  slam(c, 'Fire.', 1400, 330, { t, t0: T.fire, size: 156, out: tb(14.6) });
}
async function sc2b(c, t) { await footage(c, 'p_A2', P.s2b.src(t)); vignette(c, 0.5); }

const ST = { x: W / 2, y: 585 }, WM = { x: W / 2, y: 545 };
function shatterText(c, t) {
  if (t < T.slam || t > T.explode + 0.9) return;
  const art = TX.shatter, w = art.width, h = art.height;
  c.save();
  if (t < T.explode) {
    const s = 1 + 0.5 * (1 - spring(t - T.slam, 2.9, 0.5));
    c.globalAlpha = clamp((t - T.slam) / 0.05);
    c.translate(ST.x, ST.y); c.scale(s, s); c.translate(-w / 2, -h / 2);
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 50; c.drawImage(art, 0, 0); c.shadowColor = 'transparent';
    const kc = inv(T.explode - 0.2, T.explode, t);
    if (kc > 0) { c.beginPath(); c.arc(w / 2, h / 2, E.outCubic(kc) * w * 0.62, 0, Math.PI * 2); c.clip(); c.globalCompositeOperation = 'lighter'; c.drawImage(TX.shatterCr, 0, 0); }
  } else {
    const k = inv(T.explode, T.explode + 0.85, t);
    c.translate(ST.x - w / 2, ST.y - h / 2);
    for (const sh of FR.shatter) {
      const dir = Math.atan2(sh.c[1] - h / 2, sh.c[0] - w / 2) + (sh.r1 - 0.5) * 0.8;
      const dist = (70 + 420 * sh.r2) * E.outCubic(k) * (0.6 + sh.d / w);
      drawShard(c, art, sh, Math.cos(dir) * dist, Math.sin(dir) * dist + 320 * k * k, (sh.r3 - 0.5) * 3.2 * E.outCubic(k),
        1 + 0.45 * sh.r4 * k, 1 - E.inQuad(inv(0.15, 1, k)), 0, k * 7);
    }
    if (k < 0.25) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k / 0.25; c.drawImage(TX.shatterCr, 0, 0); }
  }
  c.restore();
}
function wordmark(c, t, x = WM.x, y = WM.y, t0 = T.wordIn, t1 = T.word, scale = 1) {
  if (t < t0) return;
  const art = TX.word, w = art.width, h = art.height, k = E.outQuint(inv(t0, t1, t));
  c.save(); c.translate(x, y); c.scale(scale, scale); c.translate(-w / 2, -h / 2);
  if (t < t1) {
    for (const sh of FR.word) {
      const dir = Math.atan2(sh.c[1] - h / 2, sh.c[0] - w / 2) + (sh.r1 - 0.5) * 1.2, dist = (380 + 1000 * sh.r2) * (1 - k);
      drawShard(c, art, sh, Math.cos(dir) * dist, Math.sin(dir) * dist, (sh.r3 - 0.5) * 5 * (1 - k), 1 + 2.2 * sh.r4 * (1 - k), clamp(k * 2.2), 0, (1 - k) * 12);
    }
  } else {
    c.shadowColor = 'rgba(120,180,255,0.35)'; c.shadowBlur = 40 * decay(t, t1, 0.5) + 18; c.drawImage(art, 0, 0); c.shadowColor = 'transparent';
    const ke = 1 - inv(t1, t1 + 0.45, t);
    if (ke > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = ke; c.drawImage(TX.wordCr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    c.setTransform(1, 0, 0, 1, 0, 0);
    sweep(c, art, x - (w / 2) * scale, y - (h / 2) * scale, inv(t1 + 0.1, t1 + 0.9, t), scale);
  }
  c.restore();
}
async function sc3(c, t) { // impact on the drop, slow-motion shatter, SHATTER. breaks, SHARD assembles
  const dof = tw(t, T.wordIn - 0.2, T.word, 0, 7, E.inOutCubic);
  c.save(); if (dof > 0.2) c.filter = `blur(${dof.toFixed(2)}px)`;
  await footage(c, 'p_A2', P.s3.src(t), { blend: true, z: 1 + 0.05 * E.outCubic(inv(T.drop, T.play, t)) + (dof > 0.2 ? 0.02 : 0) });
  c.restore();
  if (dof > 0) { c.fillStyle = `rgba(0,0,0,${((0.3 * dof) / 7).toFixed(3)})`; c.fillRect(0, 0, W, H); }
  vignette(c, 0.5);
  shatterText(c, t);
  wordmark(c, t);
  headline(c, 'The physics puzzle game.', W / 2, 712, { t, t0: tb(20.6), size: 46, weight: 800, color: 'rgba(255,255,255,0.82)', track: 0.01, out: T.crack - 0.06, outDur: 0.18 });
}
function cracks(c, t) { // the whole frame cracks from the centre before it breaks away
  const r = 2300 * E.outCubic(inv(T.crack, T.play - 0.03, t));
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineWidth = 1.7;
  for (const sh of FR.frame) { const a = clamp((r - sh.d) / 140) * 0.75; if (a > 0.01) { c.strokeStyle = `rgba(210,232,255,${a.toFixed(3)})`; polyPath(c, sh.p); c.stroke(); } }
  c.restore();
}
function shatterOut(c, src, t) {
  for (const sh of FR.frameSorted) {
    const q = clamp((t - T.play - sh.d / 4200) / 0.42);
    if (q >= 1) continue;
    const dir = Math.atan2(sh.c[1] - 520, sh.c[0] - 960) + (sh.r1 - 0.5) * 0.5, dist = (140 + sh.d * 1.25) * E.outCubic(q);
    drawShard(c, src, sh, Math.cos(dir) * dist, Math.sin(dir) * dist + 200 * q * q, (sh.r3 - 0.5) * 2.4 * q,
      1 + (0.4 + 2.2 * sh.r2) * E.inQuad(q), 1 - E.inQuad(q), 0.4 * (1 - q), q * 10);
  }
}
const BOKEH = (() => { const R = rng(4242); return Array.from({ length: 16 }, () => ({ x: R() * W, y: R() * H, r: 26 + R() * 80, a: R() * 6.28, spin: (R() - 0.5) * 0.7, vx: (R() - 0.5) * 50, vy: -14 - R() * 30, z: R(), n: 3 + Math.floor(R() * 3), seed: Math.floor(R() * 1e6) })); })();
const TONE = { light: '#8fa6d6', dawn: '#ffffff', ember: '#fff1e6', night: '#a9bcff' };
function bokeh(c, t, col, front) { // drifting glass flakes, soft focus; front ones larger and blurrier
  for (const b of BOKEH) {
    if ((b.z > 0.78) !== !!front) continue;
    const span = (v, m) => (((v % m) + m) % m) - 200;
    const x = span(b.x + b.vx * t, W + 400), y = span(b.y + b.vy * t, H + 400), s = front ? 1.8 : 0.6 + b.z * 0.6;
    c.save(); c.globalAlpha = front ? 0.22 : 0.16 + 0.22 * b.z; c.filter = `blur(${(front ? 16 : 1.5 + (1 - b.z) * 7).toFixed(1)}px)`;
    c.translate(x, y); c.rotate(b.a + b.spin * t); c.scale(s, s);
    const R = rng(b.seed); c.beginPath();
    for (let k = 0; k < b.n; k++) { const ang = (k / b.n) * 6.283 + R() * 0.8, rr = b.r * (0.6 + R() * 0.5); k ? c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : c.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
    c.closePath(); c.fillStyle = TONE[col] || '#fff'; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke(); c.restore();
  }
}
function stage(c, cols, cx = W / 2, cy = H * 0.42) {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, W * 0.72);
  g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
}
// a pose track: keys [[t, {x, y, h, r, l}], ...], eased between neighbours
function track(keys, t) {
  if (t <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i], [t1, b] = keys[i + 1];
    if (t < t1) { const k = E.inOutCubic(inv(t0, t1, t)), o = {}; for (const key in a) o[key] = lerp(a[key], b[key] ?? a[key], k); return o; }
  }
  return { ...keys[keys.length - 1][1] };
}
// the player's finger, drawn on the phone screen: it presses, pulls back against the aim (the game is a slingshot:
// pulling down-left aims up-right) while the game's own aim line swings, and lifts on the shot
function finger(c, clip, src, x0, y0, w, h) {
  const A = AIMS[clip]; if (!A) return;
  const fr = src * FPS, down = A.a0 - 4, up = A.fire;
  if (fr < down || fr > up + 10) return;
  const s = w / 392, i = Math.round(fr) - A.a0, ang = A.a[Math.max(0, Math.min(A.a.length - 1, i))];
  const L = 112 * E.outCubic(clamp((fr - A.a0) / 14)) * s;
  const px = x0 + 0.6 * w, py = y0 + 0.6 * h, fx = px - Math.cos(ang) * L, fy = py + Math.sin(ang) * L;
  const press = E.outBack(clamp((fr - down) / 6)), rel = clamp((fr - up) / 10), r = 25 * s;
  c.save();
  if (rel <= 0) {
    c.globalAlpha = 0.55; c.setLineDash([5 * s, 6 * s]); c.lineWidth = 3 * s; c.strokeStyle = '#ffffff';
    c.beginPath(); c.moveTo(px, py); c.lineTo(fx, fy); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 0.7; c.lineWidth = 2.5 * s; c.beginPath(); c.arc(px, py, 7 * s, 0, Math.PI * 2); c.stroke();
  }
  c.globalAlpha = (1 - rel) * clamp(press);
  c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 14 * s; c.shadowOffsetY = 3 * s;
  c.beginPath(); c.arc(fx, fy, r * press * (1 + 0.7 * E.outCubic(rel)), 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); c.shadowColor = 'transparent';
  c.lineWidth = 5 * s; c.strokeStyle = 'rgba(40,40,60,0.18)'; c.stroke();
  c.lineWidth = 3 * s; c.strokeStyle = 'rgba(255,255,255,0.98)'; c.stroke();
  c.restore();
}
// a caption block: a small eyebrow over one or two lines, each line rising in from its own mask
function caption(c, t, o) {
  const x = o.x ?? 1100, y = o.y ?? 560, size = o.size ?? 90, color = o.color ?? COL.ink;
  if (o.eyebrow) headline(c, o.eyebrow, x, y - size * 1.25, { t, t0: o.t0, size: 28, weight: 800, track: 0.16, color: o.eyeColor ?? '#86868b', align: 'left', out: o.t1, outDur: 0.25 });
  for (const [i, line] of o.text.split('\n').entries())
    headline(c, line, x, y + i * size * 1.06, { t, t0: o.t0 + 0.07 * i, size, color, align: 'left', out: o.t1, outDur: 0.25 });
}
// a real level on a phone: the camera follows a pose track, the screen carries the finger, captions sit beside it,
// and in the last ZOOM_IN seconds the phone squares up and flies at the camera (zoom-through to the world it rhymes with)
async function gameShot(c, t, o) {
  stage(c, COL[o.col]); bokeh(c, t, o.col, false);
  const p = o.p, src = p.src(t), im = await frame(p.clip, src);
  let { x, y, h, r } = track(o.keys, t);
  const zk = E.inExpo(inv(p.t1 - ZOOM_IN, p.t1, t));
  if (zk > 0) { x = lerp(x, W / 2, zk); y = lerp(y, H / 2, zk); r *= 1 - zk; h = lerp(h, 4500, zk); }
  const screen = (sc, x0, y0, w, hh) => { sc.drawImage(im, x0, y0, w, hh); finger(sc, p.clip, src, x0, y0, w, hh); };
  phone(c, screen, { x, y, h, rotY: r, shadow: o.col === 'night' ? 0 : 0.18 * (1 - zk) });
  for (const cap of o.caps) caption(c, t, { color: o.ink, eyeColor: o.eye, ...cap });
}
const PLAY1 = {
  p: P.play1, col: 'light', keys: [
    [T.play, { x: 700, y: 610, h: 930, r: -0.34 }], [T.play + 0.6, { x: 700, y: 545, h: 980, r: -0.12 }], [12.25, { x: 700, y: 545, h: 980, r: -0.1 }],
    [12.95, { x: 640, y: 350, h: 1590, r: -0.05 }], [17.8, { x: 640, y: 345, h: 1640, r: -0.04 }], [18.5, { x: 700, y: 545, h: 1000, r: -0.1 }], [T.dawn, { x: 700, y: 545, h: 1010, r: -0.08 }],
  ],
  caps: [
    { eyebrow: 'HOW TO PLAY', text: 'Pull back\nto aim.', t0: 12.0, t1: 14.0 },
    { text: 'Let go.', t0: 14.06, t1: 15.0 },
    { text: 'Break all\nthe glass.', t0: 15.05, t1: 17.0 },
    { text: 'Clear it in\none shot.', t0: 17.05, t1: T.dawn - ZOOM_IN - 0.1 },
  ],
};
PLAY1.caps[0].eyebrowOut = true;
const PLAY2 = {
  p: P.play2, col: 'ember', keys: [[T.ember, { x: 640, y: 500, h: 1250, r: 0.22 }], [T.ember + 0.55, { x: 640, y: 478, h: 1290, r: 0.06 }], [T.emberW - ZOOM_IN, { x: 640, y: 478, h: 1330, r: 0.04 }]],
  caps: [{ eyebrow: 'WORLD 4 · EMBER', text: 'Bombs set off\nchain reactions.', t0: T.ember + 0.3, t1: T.emberW - ZOOM_IN - 0.1 }],
};
const PLAY3 = {
  p: P.play3, col: 'night', ink: '#ffffff', eye: '#a1a8c3', keys: [[T.night, { x: 640, y: 460, h: 1340, r: -0.22 }], [T.night + 0.55, { x: 640, y: 440, h: 1380, r: -0.06 }], [T.nightW - ZOOM_IN, { x: 640, y: 440, h: 1420, r: -0.04 }]],
  caps: [
    { eyebrow: 'WORLD 5 · NIGHT', text: 'Bounce shots\noff the walls.', t0: T.night + 0.12, t1: 29.2 },
    { text: 'Last piece?\nSlow motion.', t0: 29.25, t1: T.nightW - ZOOM_IN - 0.1 },
  ],
};
// the eyebrow stays up through every caption of a level
for (const S of [PLAY1, PLAY3]) { const first = S.caps[0], last = S.caps[S.caps.length - 1]; S.caps = [{ eyebrow: first.eyebrow, text: '', t0: first.t0, t1: last.t1 }, ...S.caps.map((q) => ({ ...q, eyebrow: undefined }))]; }
const scPlay1 = (c, t) => gameShot(c, t, PLAY1);
const scPlay2 = (c, t) => gameShot(c, t, PLAY2);
const scPlay3 = (c, t) => gameShot(c, t, PLAY3);
async function world(c, t, p, o = {}) { // a generated world arriving from a zoom-through (decelerating zoom-out)
  const zin = o.zoomIn ? 0.3 * (1 - E.outExpo(inv(p.t0, p.t0 + 0.55, t))) : 0;
  await footage(c, p.clip, p.src(t), { z: (1 + zin) * (1.02 + 0.025 * (t - p.t0)), ph: o.ph || '#334', blend: p.blend });
  vignette(c, 0.42);
}
const scDawn = (c, t) => world(c, t, P.dawn, { zoomIn: true });
const scEmberW = (c, t) => world(c, t, P.emberW, { zoomIn: true, ph: '#c96' });
async function scNightW(c, t) {
  await world(c, t, P.nightW, { zoomIn: true });
  headline(c, 'One perfect shot.', W / 2, 940, { t, t0: tb(64.5), size: 100, out: T.worlds - 0.2, shadow: 'rgba(0,0,0,0.45)' });
}
async function scWorlds(c, t) { // five worlds, 120 levels
  stage(c, COL.light, W / 2, H * 0.6);
  const ims = await Promise.all(P.maps.map((p) => frame(p.clip, p.src(t))));
  const drift = 1 + 0.035 * E.inOutSine(inv(T.worlds, T.balls, t));
  c.save(); c.translate(W / 2, H / 2 + 60); c.scale(drift, drift); c.translate(-W / 2, -H / 2 - 60);
  for (const i of [0, 4, 1, 3, 2]) {
    const d = i - 2, sp = spring(t - T.worlds - 0.045 * Math.abs(d) - 0.02, 1.9, 0.68);
    phone(c, ims[i], { x: 960 + d * 330, y: lerp(1500, 655 + Math.abs(d) * 14, sp), h: 610, rotY: -d * 0.2, roll: d * 0.02, shadow: 0.16 });
  }
  c.restore();
  const size = 92, yT = 205;
  font(c, size, 900); c.letterSpacing = `${(-0.015 * size).toFixed(2)}px`;
  const wa = c.measureText('5 worlds.').width, wb = c.measureText('120 levels.').width, gap = size * 0.32, total = wa + gap + wb;
  c.letterSpacing = '0px';
  const ks = E.inOutCubic(inv(tb(69.75), tb(70.2), t)), xa = lerp(W / 2, W / 2 - total / 2 + wa / 2, ks);
  headline(c, '5 worlds.', xa, yT, { t, t0: tb(68.3), size, color: COL.ink });
  const n = Math.round(120 * E.outCubic(inv(tb(70), tb(70) + 0.55, t)));
  headline(c, `${n} levels.`, W / 2 - total / 2 + wa + gap, yT, { t, t0: tb(70), size, color: COL.ink, align: 'left' });
}
async function scBalls(c, t) { // twelve balls in orbit, collapsing into a flash at the end
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 760); g.addColorStop(0, 'rgba(70,88,150,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const dt = t - T.balls, arrive = E.outExpo(inv(0, 0.75, dt)), implode = E.inExpo(inv(T.rewind - 0.32, T.rewind, t));
  const items = IMG.balls.map((im, i) => {
    const th = (i / 12) * Math.PI * 2 + dt * 0.7 + (1 - arrive) * 2.2, R = lerp(2.2, 1, arrive) * (1 - implode), z = Math.sin(th);
    return { im, x: W / 2 + Math.cos(th) * 720 * R, y: H / 2 + 30 + z * 225 * R, z, s: (0.72 + 0.4 * (z + 1) / 2) * lerp(0.5, 1, arrive) };
  }).sort((a, b) => a.z - b.z);
  const draw = (b) => { const s = 190 * b.s; c.save(); c.globalAlpha = 0.5 + 0.5 * (b.z + 1) / 2; if (b.z < -0.2) c.filter = `blur(${((-b.z - 0.2) * 3).toFixed(1)}px)`; c.drawImage(b.im, b.x - s / 2, b.y - s / 2, s, s); c.restore(); };
  items.filter((b) => b.z < 0).forEach(draw);
  headline(c, '12 balls.', W / 2, H / 2 + 52, { t, t0: tb(76.5), size: 136, out: T.rewind - 0.35 });
  items.filter((b) => b.z >= 0).forEach(draw);
}
async function scRewind(c, t) { // the shatter rewinds into the whole glass city
  const p = t < P.rw2.t0 ? P.rw1 : P.rw2;
  await footage(c, 'p_A2', p.src(t), { blend: true, z: 1.03 });
  vignette(c, 0.5);
}
function iconAt(c, x, y, size, a = 1) {
  c.save(); c.globalAlpha = a; c.shadowColor = 'rgba(120,170,255,0.35)'; c.shadowBlur = size * 0.35;
  c.beginPath(); c.roundRect(x - size / 2, y - size / 2, size, size, size * 0.2237); c.fillStyle = '#1c2340'; c.fill(); c.shadowColor = 'transparent';
  c.clip(); c.drawImage(IMG.icon, x - size / 2, y - size / 2, size, size);
  c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.18)'; c.stroke();
  c.restore();
}
async function scLogo(c, t) { // the logo lands; the subline comes in on the music's last hit
  const dt = t - T.logo;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const blobs = [['150,205,255', 560, 470], ['255,190,200', 1360, 520], ['190,175,255', 960, 300]];
  blobs.forEach(([rgb, bx, by], i) => {
    const x = bx + Math.sin(dt * 0.6 + i * 2) * 40, y = by + Math.cos(dt * 0.5 + i) * 30, g = c.createRadialGradient(x, y, 0, x, y, 620);
    g.addColorStop(0, `rgba(${rgb},${(0.2 * clamp(dt / 0.6)).toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  const IX = W / 2, IY = 395;
  const kw = inv(0, 0.8, dt);
  if (kw < 1) { c.save(); c.lineWidth = lerp(12, 1, kw); c.strokeStyle = `rgba(200,225,255,${(0.6 * (1 - kw)).toFixed(3)})`; c.beginPath(); c.arc(IX, IY, 150 + 950 * E.outCubic(kw), 0, Math.PI * 2); c.stroke(); c.restore(); }
  const kb = E.outExpo(inv(0, 1.6, dt));
  for (const b of FR.burst) {
    const r = 120 + 980 * b.v * kb, a = 1 - inv(0.35, 1.6, dt);
    if (a <= 0) break;
    c.save(); c.globalAlpha = a * (0.55 + 0.45 * b.z); c.translate(IX + Math.cos(b.a) * r, IY + Math.sin(b.a) * r * 0.82 + 90 * dt * dt); c.rotate(b.spin * kb); c.scale(0.7 + b.z * 0.8, 0.7 + b.z * 0.8);
    c.beginPath(); b.pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath();
    c.fillStyle = b.col; c.globalAlpha *= 0.75; c.fill(); c.globalAlpha /= 0.75; c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke(); c.restore();
  }
  const s = 1 + 1.3 * (1 - spring(dt, 2.3, 0.6));
  iconAt(c, IX, IY, 260 * s, clamp(dt / 0.04));
  wordmark(c, t, W / 2, 700, tb(88.4), tb(89.4), 0.62);
  headline(c, 'Coming soon to iPhone & Android.', W / 2, 838, { t, t0: T.sub, size: 46, weight: 800, color: COL.gray, track: 0 });
  const fo = inv(T.end - 0.85, T.end, t); if (fo > 0) { c.fillStyle = `rgba(0,0,0,${fo.toFixed(3)})`; c.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- transitions and the frame
const SCENES = [[0, sc1], [T.s2, sc2], [T.a2in, sc2b], [T.drop, sc3], [T.play, scPlay1], [T.dawn, scDawn], [T.ember, scPlay2], [T.emberW, scEmberW],
  [T.night, scPlay3], [T.nightW, scNightW], [T.worlds, scWorlds], [T.balls, scBalls], [T.rewind, scRewind], [T.logo, scLogo]];
const TRANS = new Map([
  [T.dawn, { kind: 'zoom', pre: ZOOM_IN }], [T.ember, { kind: 'whip', pre: 0.11, post: 0.15, dir: 1 }],
  [T.emberW, { kind: 'zoom', pre: ZOOM_IN }], [T.night, { kind: 'whip', pre: 0.11, post: 0.15, dir: -1 }],
  [T.nightW, { kind: 'zoom', pre: ZOOM_IN }], [T.worlds, { kind: 'vwhip', pre: 0.11, post: 0.16, dir: 1 }],
  [T.balls, { kind: 'push', pre: 0.22 }],
]);
function smear(c, src, n, at) { for (let i = 0; i < n; i++) { c.save(); c.globalAlpha = i === 0 ? 1 : 1 / (i + 1); at(c, i / (n - 1)); c.drawImage(src, 0, 0); c.restore(); } }
const wrapX = (c, src, ox) => { ox = ((ox % W) + W) % W; c.drawImage(src, ox - W, 0); c.drawImage(src, ox, 0); };
const wrapY = (c, src, oy) => { oy = ((oy % H) + H) % H; c.drawImage(src, 0, oy - H); c.drawImage(src, 0, oy); };
function whip(c, src, off, amt, vert) {
  for (let i = 0; i < 8; i++) { c.save(); c.globalAlpha = i === 0 ? 1 : 1 / (i + 1); const o = off + amt * (i / 7 - 0.5); vert ? wrapY(c, src, o) : wrapX(c, src, o); c.restore(); }
}
async function scene(i, c, t) { c.save(); await SCENES[i][1](c, t); c.restore(); }
function clear(c, col = '#000') { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.fillStyle = col; c.fillRect(0, 0, W, H); }
async function compose(t) {
  clear(fx);
  let i = 0; while (i + 1 < SCENES.length && t >= SCENES[i + 1][0]) i++;
  const start = SCENES[i][0], next = SCENES[i + 1] ? SCENES[i + 1][0] : Infinity;
  const tin = TRANS.get(start), tout = TRANS.get(next);
  if (t >= T.crack && t < T.play) { await scene(i, fx, t); cracks(fx, t); return; }
  if (t >= T.play && t < T.play + 0.85) { clear(xx); await scene(i - 1, xx, t); await scene(i, fx, t); shatterOut(fx, X, t); return; }
  if (tout && t >= next - tout.pre) {
    const k = inv(next - tout.pre, next, t);
    clear(xx); await scene(i, xx, t);
    if (tout.kind === 'zoom') smear(fx, X, 7, (c, u) => { const s = 1 + 0.22 * k * u; c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); });
    else if (tout.kind === 'push') { clear(fx); smear(fx, X, 7, (c, u) => { const s = 1 + 0.6 * E.inCubic(k) + 0.12 * k * u; c.globalAlpha *= 1 - k; c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); }); }
    else whip(fx, X, -tout.dir * (tout.kind === 'vwhip' ? H : W) * 0.55 * E.inCubic(k), 420 * k, tout.kind === 'vwhip');
    return;
  }
  if (tin && tin.post && t < start + tin.post) {
    const k = inv(start, start + tin.post, t);
    clear(xx); await scene(i, xx, t);
    whip(fx, X, tin.dir * (tin.kind === 'vwhip' ? H : W) * 0.55 * (1 - E.outCubic(k)), 420 * (1 - k), tin.kind === 'vwhip');
    return;
  }
  await scene(i, fx, t);
}
function postFx(t) {
  let sx = 0, sy = 0, z = 1, ca = 0, fl = 0;
  const shake = (t0, amp, tau, f, seed) => { const d = decay(t, t0, tau); if (d > 0.004) { sx += noise1(seed, (t - t0) * f) * amp * d; sy += noise1(seed + 50, (t - t0) * f) * amp * d; } };
  fl += 0.9 * decay(t, T.drop, 0.09); shake(T.drop, 30, 0.3, 26, 3); z += 0.07 * decay(t, T.drop, 0.25); ca += 12 * decay(t, T.drop, 0.2);
  shake(T.slam, 10, 0.14, 22, 5);
  shake(T.explode, 11, 0.2, 22, 7); ca += 7 * decay(t, T.explode, 0.15);
  z += 0.03 * decay(t, T.word, 0.18);
  shake(T.play, 13, 0.2, 22, 9); ca += 8 * decay(t, T.play, 0.14); fl += 0.22 * decay(t, T.play, 0.06);
  for (const tn of [T.dawn, T.emberW, T.nightW]) fl += 0.5 * decay(t, tn, 0.07);
  shake(23.62, 7, 0.18, 24, 31); // the bombs go off in level 82
  z += 0.025 * decay(t, tb(60), 0.2); // the second drop lands on the ball's second wall bounce
  fl += t < T.rewind ? 0.9 * E.inQuad(inv(T.rewind - 0.2, T.rewind, t)) : 0.9 * decay(t, T.rewind, 0.12);
  const tf = tb(86.4); fl += t < tf ? 0.85 * E.inQuad(inv(tf - 0.1, tf, t)) : 0.85 * decay(t, tf, 0.09);
  fl += 0.6 * decay(t, T.logo, 0.12); shake(T.logo, 24, 0.26, 24, 11); ca += 9 * decay(t, T.logo, 0.2);
  z += (Math.abs(sx) + Math.abs(sy)) * 2.4 / W;
  return { sx, sy, z, ca, fl: clamp(fl), bl: 1 - E.outCubic(inv(0, 0.4, t)) };
}
function chroma(c, src, a) {
  const s = (a * 2) / W;
  [['#ff0000', 1 + s], ['#00ff00', 1], ['#0000ff', 1 - s]].forEach(([col, sc], i) => {
    zx.save(); zx.globalCompositeOperation = 'copy'; zx.drawImage(src, 0, 0); zx.globalCompositeOperation = 'multiply'; zx.fillStyle = col; zx.fillRect(0, 0, W, H); zx.restore();
    c.save(); c.globalCompositeOperation = i ? 'lighter' : 'source-over'; c.translate(W / 2, H / 2); c.scale(sc, sc); c.translate(-W / 2, -H / 2); c.drawImage(Z, 0, 0); c.restore();
  });
}
async function poster(c) {
  c.save(); c.filter = 'blur(7px)'; await footage(c, 'p_A2', P.poster.src(0), { z: 1.04 }); c.restore();
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 0, W, H); vignette(c, 0.5);
  wordmark(c, T.word + 2, WM.x, WM.y);
  headline(c, 'The physics puzzle game.', W / 2, 712, { t: 99, t0: 0, size: 46, weight: 800, color: 'rgba(255,255,255,0.82)', track: 0.01 });
}
async function drawFrame(t) {
  if (t < 0.5 / FPS) { clear(fx); await poster(fx); clear(ctx); ctx.drawImage(F, 0, 0); return; }
  await compose(t);
  const p = postFx(t);
  clear(ctx);
  ctx.save(); ctx.translate(W / 2 + p.sx, H / 2 + p.sy); ctx.scale(p.z, p.z); ctx.translate(-W / 2, -H / 2);
  if (p.ca > 0.6) chroma(ctx, F, p.ca); else ctx.drawImage(F, 0, 0);
  ctx.restore();
  if (p.fl > 0.003) { ctx.fillStyle = `rgba(255,255,255,${p.fl.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  if (p.bl > 0.003) { ctx.fillStyle = `rgba(0,0,0,${p.bl.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
}

window.hfPage = { width: W, height: H, fps: FPS, frames: FRAMES, audio: 'audio/mix.m4a', ready: init(), render: (t) => drawFrame(t) };
