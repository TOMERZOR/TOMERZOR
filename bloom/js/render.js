// Canvas drawing: the garden bed, seeds (soft clay shapes, one shape per colour, joined to their
// same-colour neighbours), falling, blooming flowers, special flowers, weeds, the tray, the
// dragged bundle, and the juice (petals, glints, shockwaves, floating points, banners, shake).
import { COLS, ROWS, WEED, BOMB, RAINBOW, idx } from './board.js';

const TAU = Math.PI * 2;
const FONT = '"Outfit", system-ui, sans-serif';
const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Each colour has its own silhouette, so groups read by shape as well as colour.
function shapePath(c, shape, cx, cy, R) {
  c.beginPath();
  switch (shape) {
    case 1: { // rounded square
      const h = R * 0.8;
      rr(c, cx - h, cy - h, h * 2, h * 2, R * 0.38);
      return;
    }
    case 2: // drop
      c.moveTo(cx, cy - R * 0.98);
      c.bezierCurveTo(cx + R * 0.3, cy - R * 0.55, cx + R * 0.86, cy - R * 0.1, cx + R * 0.86, cy + R * 0.26);
      c.arc(cx, cy + R * 0.26, R * 0.86, 0, Math.PI);
      c.bezierCurveTo(cx - R * 0.86, cy - R * 0.1, cx - R * 0.3, cy - R * 0.55, cx, cy - R * 0.98);
      return;
    case 3: // leaf
      c.moveTo(cx - R * 0.86, cy + R * 0.86);
      c.quadraticCurveTo(cx - R * 0.95, cy - R * 0.95, cx + R * 0.86, cy - R * 0.86);
      c.quadraticCurveTo(cx + R * 0.95, cy + R * 0.95, cx - R * 0.86, cy + R * 0.86);
      return;
    case 4: // hexagon with soft corners
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU, a2 = (i + 1) / 6 * TAU, k = 0.92;
        const x1 = cx + Math.cos(a) * R * k, y1 = cy + Math.sin(a) * R * k;
        const x2 = cx + Math.cos(a2) * R * k, y2 = cy + Math.sin(a2) * R * k;
        if (i === 0) c.moveTo((x1 + x2) / 2, (y1 + y2) / 2);
        const a3 = (i + 2) / 6 * TAU;
        c.arcTo(x2, y2, (x2 + cx + Math.cos(a3) * R * k) / 2, (y2 + cy + Math.sin(a3) * R * k) / 2, R * 0.22);
      }
      c.closePath();
      return;
    case 5: // clover
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { c.moveTo(cx + dx * R * 0.42 + R * 0.5, cy + dy * R * 0.42); c.arc(cx + dx * R * 0.42, cy + dy * R * 0.42, R * 0.5, 0, TAU); }
      return;
    case 6: // star
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.5 : R; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      c.closePath();
      return;
    default:
      c.arc(cx, cy, R * 0.9, 0, TAU);
  }
}

// ---- seed sprites, cached per style / colour / shape / size ----------------------------------
const cache = new Map();
function seedSprite(style, color, shape, size, dpr) {
  const px = Math.max(4, Math.round(size * dpr));
  const k = `${style}|${color}|${shape}|${px}`;
  let cv = cache.get(k);
  if (cv) return cv;
  if (cache.size > 600) cache.clear();
  cv = document.createElement('canvas');
  const pad = Math.round(px * 0.25);
  cv.width = cv.height = px + pad * 2;
  const c = cv.getContext('2d');
  c.translate(pad, pad);
  const s = px, R = s * 0.42, cx = s / 2, cy = s / 2;

  if (color === 'weed') {
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.4)'; c.shadowBlur = s * 0.1; c.shadowOffsetY = s * 0.05;
    rr(c, s * 0.1, s * 0.14, s * 0.8, s * 0.76, s * 0.28);
    const g = c.createLinearGradient(0, s * 0.1, 0, s);
    g.addColorStop(0, '#5b6170'); g.addColorStop(1, '#2c2f3a');
    c.fillStyle = g; c.fill();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.08)';
    rr(c, s * 0.18, s * 0.2, s * 0.64, s * 0.18, s * 0.09); c.fill();
    c.strokeStyle = '#4ade80'; c.lineWidth = s * 0.06; c.lineCap = 'round';
    c.beginPath(); c.moveTo(s * 0.5, s * 0.55); c.lineTo(s * 0.5, s * 0.3); c.stroke();
    c.fillStyle = '#4ade80';
    c.beginPath(); c.ellipse(s * 0.6, s * 0.3, s * 0.11, s * 0.055, -0.6, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(s * 0.4, s * 0.36, s * 0.1, s * 0.05, 0.6, 0, TAU); c.fill();
    cache.set(k, cv);
    return cv;
  }

  if (style === 'neon') {
    c.shadowColor = color; c.shadowBlur = s * 0.22;
    shapePath(c, shape, cx, cy, R * 0.9);
    c.lineWidth = s * 0.07; c.strokeStyle = color; c.lineJoin = 'round'; c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = rgba(color.startsWith('#') ? color : '#888888', 0.16); c.fill();
    cache.set(k, cv);
    return cv;
  }

  // soft drop shadow under the body
  c.save();
  c.shadowColor = 'rgba(8,4,30,0.45)'; c.shadowBlur = s * 0.12; c.shadowOffsetY = s * 0.06;
  shapePath(c, shape, cx, cy, R);
  if (style === 'glass') {
    c.fillStyle = rgba(color, 0.55);
  } else if (style === 'flat') {
    c.fillStyle = color;
  } else {
    const g = c.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.1, cx, cy, R * 1.25);
    g.addColorStop(0, shade(color, 0.35)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.3));
    c.fillStyle = g;
  }
  c.fill();
  c.restore();

  c.save();
  shapePath(c, shape, cx, cy, R);
  c.clip();
  if (style === 'clay' || style === 'glass') {
    // soft light from the top left, a little occlusion bottom right
    const hl = c.createRadialGradient(cx - R * 0.35, cy - R * 0.5, 0, cx - R * 0.35, cy - R * 0.5, R * 0.95);
    hl.addColorStop(0, `rgba(255,255,255,${style === 'glass' ? 0.55 : 0.42})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.fillRect(0, 0, s, s);
    const sh = c.createRadialGradient(cx + R * 0.35, cy + R * 0.7, 0, cx + R * 0.35, cy + R * 0.7, R);
    sh.addColorStop(0, 'rgba(10,0,40,0.22)'); sh.addColorStop(1, 'rgba(10,0,40,0)');
    c.fillStyle = sh; c.fillRect(0, 0, s, s);
  } else if (style === 'flat') {
    c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0, cy + R * 0.45, s, s);
  } else if (style === 'gem') {
    const g = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    g.addColorStop(0, shade(color, 0.3)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.35));
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.moveTo(cx - R, cy - R * 0.2); c.lineTo(cx - R * 0.2, cy - R); c.lineTo(cx + R * 0.15, cy - R); c.lineTo(cx - R, cy + R * 0.15); c.fill();
  }
  c.restore();

  // rim light along the top edge
  c.save();
  shapePath(c, shape, cx, cy, R);
  const rim = c.createLinearGradient(0, cy - R, 0, cy + R * 0.2);
  rim.addColorStop(0, `rgba(255,255,255,${style === 'glass' ? 0.8 : 0.45})`); rim.addColorStop(1, 'rgba(255,255,255,0)');
  c.strokeStyle = rim; c.lineWidth = s * (style === 'glass' ? 0.045 : 0.03); c.lineJoin = 'round';
  c.stroke();
  c.restore();
  cache.set(k, cv);
  return cv;
}

function drawFlower(c, x, y, r, color, open, spin = 0) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + spin;
    c.save(); c.translate(x, y); c.rotate(a);
    const g = c.createLinearGradient(0, 0, r * 1.1 * open + 0.01, 0);
    g.addColorStop(0, shade(color, -0.05)); g.addColorStop(1, shade(color, 0.45));
    c.fillStyle = g;
    c.beginPath(); c.ellipse(r * 0.55 * open, 0, r * 0.55 * open + 0.01, r * 0.3 * open + 0.01, 0, 0, TAU); c.fill();
    c.restore();
  }
  c.fillStyle = '#fde68a';
  c.beginPath(); c.arc(x, y, r * 0.24 * (0.6 + 0.4 * open), 0, TAU); c.fill();
}

export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const L = { boardX: 0, boardY: 0, cell: 0, bw: 0, bh: 0, slots: [], trayCell: 0, trayY: 0 };
  const particles = [], floats = [], blooms = [], rings = [], falls = new Map(), pops = new Map();
  let banner = null, shake = null, flash = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const trayRows = 3.8; // tray height in cells
    let cell = Math.min((W - 28) / COLS, 56);
    if (cell * (ROWS + trayRows) + 34 > H) cell = (H - 34) / (ROWS + trayRows);
    L.cell = cell; L.bw = cell * COLS; L.bh = cell * ROWS;
    L.boardX = (W - L.bw) / 2;
    const free = H - L.bh - cell * trayRows;
    L.boardY = Math.max(10, free * 0.3);
    L.trayY = L.boardY + L.bh + 30 + (H - L.boardY - L.bh - 30) / 2;
    const trayW = Math.min(W - 20, L.bw + 8);
    const slotW = trayW / 3;
    L.trayCell = Math.min(cell * 0.7, slotW / 3.8);
    L.slots = [0, 1, 2].map((i) => ({ x: (W - trayW) / 2 + slotW * (i + 0.5), y: L.trayY, w: slotW, h: Math.min(cell * trayRows, H - L.boardY - L.bh - 30) }));
  }

  // ---- effects API --------------------------------------------------------------------------
  const cellCenter = (r, cc) => [L.boardX + (cc + 0.5) * L.cell, L.boardY + (r + 0.5) * L.cell];

  function bloom(cells, colors, now, power = 1) {
    let cr = 0, ccx = 0;
    for (const p of cells) { cr += p.r; ccx += p.c; }
    cr /= cells.length || 1; ccx /= cells.length || 1;
    const [rx, ry] = cellCenter(cr, ccx);
    rings.push({ x: rx, y: ry, t0: now + 120, r: L.cell * (1.2 + Math.sqrt(cells.length) * 0.6), color: '#ffffff' });
    for (const p of cells) {
      const delay = Math.hypot(p.r - cr, p.c - ccx) * 30;
      const col = p.color === WEED ? '#86efac' : colors[p.color - 1] || '#fff';
      blooms.push({ ...p, col, t0: now + delay });
      const [x, y] = cellCenter(p.r, p.c);
      const count = Math.round(3 + power * 1.5);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, sp = (60 + Math.random() * 190) * (0.7 + power * 0.25);
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, t0: now + delay + 240, life: 700 + Math.random() * 600, color: col, size: L.cell * (0.1 + Math.random() * 0.12), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, kind: i % 3 === 0 ? 'glint' : 'petal' });
      }
    }
  }
  function fall(list, now, dur = 230) { for (const m of list) falls.set(idx(m.to, m.c), { from: m.from, to: m.to, t0: now, dur: dur + Math.max(0, m.to - m.from) * 14 }); }
  function float(text, x, y, now, { color = '#fff', size = 1, dur = 1000 } = {}) { floats.push({ text, x, y, t0: now, dur, color, size }); }
  function setBanner(text, sub, now, color = '#fbbf24') { banner = { text, sub, t0: now, color }; }
  function setShake(mag, now) { if (!shake || mag > shake.mag * (1 - (now - shake.t0) / 400)) shake = { mag, t0: now }; }
  function setFlash(color, now) { flash = { color, t0: now }; }
  function pop(cells, now) { for (const [r, cc] of cells) pops.set(idx(r, cc), now); }

  // ---- drawing ------------------------------------------------------------------------------
  // `v` is a grid value: a colour index 1..7, WEED, or 'grey' for the game-over fade.
  function drawSeed(x, y, s, v, skin, alpha = 1, scale = 1) {
    const color = v === WEED ? 'weed' : v === 'grey' ? '#6b6890' : skin.colors[v - 1];
    const sp = seedSprite(skin.style, color, v === WEED ? 0 : (v === 'grey' ? 0 : v - 1), s, dpr);
    const ds = sp.width / dpr * scale;
    c.globalAlpha = alpha;
    c.drawImage(sp, x + s / 2 - ds / 2, y + s / 2 - ds / 2, ds, ds);
    c.globalAlpha = 1;
  }

  function drawSpecial(x, y, s, kind, now) {
    const cx = x + s / 2, cy = y + s / 2;
    if (kind === BOMB) {
      // a little sunflower badge
      const pulse = 1 + Math.sin(now / 170) * 0.07;
      c.save(); c.translate(cx, cy); c.scale(pulse, pulse); c.rotate(now / 2400);
      c.shadowColor = 'rgba(251,191,36,0.9)'; c.shadowBlur = s * 0.3;
      c.fillStyle = '#fde047';
      for (let i = 0; i < 10; i++) { c.save(); c.rotate(i / 10 * TAU); c.beginPath(); c.ellipse(s * 0.21, 0, s * 0.12, s * 0.055, 0, 0, TAU); c.fill(); c.restore(); }
      c.shadowBlur = 0;
      c.fillStyle = '#92400e';
      c.beginPath(); c.arc(0, 0, s * 0.11, 0, TAU); c.fill();
      c.restore();
    } else if (kind === RAINBOW) {
      c.save(); c.translate(cx, cy); c.rotate(now / 700);
      const g = c.createConicGradient ? c.createConicGradient(0, 0, 0) : null;
      if (g) { ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#f87171'].forEach((col, i) => g.addColorStop(i / 7, col)); c.strokeStyle = g; }
      else c.strokeStyle = '#fff';
      c.shadowColor = '#fff'; c.shadowBlur = s * 0.2;
      c.lineWidth = s * 0.09;
      c.beginPath(); c.arc(0, 0, s * 0.44, 0, TAU); c.stroke();
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.95)';
      c.beginPath(); c.arc(cx, cy, s * 0.09 + Math.sin(now / 200) * s * 0.02, 0, TAU); c.fill();
    }
  }

  function fallOffset(i, now) {
    const f = falls.get(i);
    if (!f) return 0;
    const t = (now - f.t0) / f.dur;
    if (t >= 1) { falls.delete(i); return 0; }
    if (t < 0) return f.from - f.to;
    return (f.from - f.to) * (1 - easeIn(t));
  }

  function drawPiece(piece, skin, x, y, s, alpha = 1) {
    piece.cells.forEach(([r, cc], i) => drawSeed(x + cc * s, y + r * s, s, piece.colors[i], skin, alpha));
  }

  function draw(st, now) {
    const skin = st.skin, colors = skin.colors;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (shake) {
      const k = 1 - (now - shake.t0) / 400;
      if (k <= 0) shake = null;
      else { sx = (Math.random() - 0.5) * shake.mag * k; sy = (Math.random() - 0.5) * shake.mag * k; }
    }
    c.save();
    c.translate(sx, sy);
    const { boardX: bx, boardY: by, cell, bw, bh } = L;
    const pulse = 0.5 + 0.5 * Math.sin(now / 110);

    // glass garden bed
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 40; c.shadowOffsetY = 18;
    rr(c, bx - 8, by - 8, bw + 16, bh + 16, 24);
    c.fillStyle = skin.dark ? 'rgba(6,6,16,0.85)' : 'rgba(255,255,255,0.045)';
    c.fill();
    c.restore();
    rr(c, bx - 8, by - 8, bw + 16, bh + 16, 24);
    const edge = c.createLinearGradient(0, by - 8, 0, by + bh + 8);
    edge.addColorStop(0, 'rgba(255,255,255,0.16)'); edge.addColorStop(1, 'rgba(255,255,255,0.04)');
    c.strokeStyle = edge; c.lineWidth = 1; c.stroke();
    const soil = c.createLinearGradient(0, by + bh * 0.55, 0, by + bh + 8);
    soil.addColorStop(0, 'rgba(52,211,153,0)'); soil.addColorStop(1, 'rgba(52,211,153,0.07)');
    c.fillStyle = soil; c.fill();

    // danger: a column near the top makes the top of the bed glow red
    if (st.danger > 0) {
      const a = st.danger * (0.28 + 0.16 * pulse);
      const g = c.createLinearGradient(0, by - 8, 0, by + cell * 3);
      g.addColorStop(0, `rgba(248,113,113,${a})`); g.addColorStop(1, 'rgba(248,113,113,0)');
      c.fillStyle = g; rr(c, bx - 8, by - 8, bw + 16, cell * 3 + 8, 24); c.fill();
    }
    // the column under the dragged bundle
    const d = st.drag;
    if (d && d.valid) {
      const g = c.createLinearGradient(0, by, 0, by + bh);
      g.addColorStop(0, 'rgba(167,139,250,0)'); g.addColorStop(1, 'rgba(167,139,250,0.16)');
      c.fillStyle = g; rr(c, bx + d.col * cell + 2, by, d.w * cell - 4, bh, 12); c.fill();
    }

    const g = st.grid, sp = st.spec;
    // empty spots: faint dots
    c.fillStyle = 'rgba(255,255,255,0.07)';
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) if (!g[idx(r, cc)]) { c.beginPath(); c.arc(bx + (cc + 0.5) * cell, by + (r + 0.5) * cell, cell * 0.05, 0, TAU); c.fill(); }

    c.save();
    rr(c, bx - 6, by - 6, bw + 12, bh + 12, 22); c.clip();
    // soft joins between same-colour neighbours, under the seeds
    const offs = new Float32Array(COLS * ROWS);
    for (let i = 0; i < COLS * ROWS; i++) if (g[i]) offs[i] = fallOffset(i, now);
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
      const i = idx(r, cc), v = g[i];
      if (!v || v === WEED || offs[i]) continue;
      c.fillStyle = rgba(colors[v - 1], 0.55);
      if (cc + 1 < COLS && g[i + 1] === v && !offs[i + 1]) { rr(c, bx + (cc + 0.5) * cell, by + (r + 0.3) * cell, cell, cell * 0.4, cell * 0.2); c.fill(); }
      if (r + 1 < ROWS && g[i + COLS] === v && !offs[i + COLS]) { rr(c, bx + (cc + 0.3) * cell, by + (r + 0.5) * cell, cell * 0.4, cell, cell * 0.2); c.fill(); }
    }
    const hot = st.preview ? new Set(st.preview) : null;
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
      const i = idx(r, cc), v = g[i];
      if (!v) continue;
      const x = bx + cc * cell, y = by + (r - offs[i]) * cell;
      let scale = 1;
      const pt = pops.get(i);
      if (pt !== undefined) {
        const t = (now - pt) / 300;
        if (t >= 1) pops.delete(i); else if (t > 0) scale = 1 + Math.sin(t * Math.PI) * 0.16;
      }
      const grey = st.overT && now - st.overT > (ROWS - 1 - r) * 60 + cc * 10;
      if (hot && hot.has(i)) scale *= 1.04 + pulse * 0.06;
      drawSeed(x, y, cell, grey && v !== WEED ? 'grey' : v, skin, 1, scale);
      if (sp[i]) drawSpecial(x, y, cell, sp[i], now);
      if (hot && hot.has(i)) {
        c.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.45})`; c.lineWidth = 2;
        c.beginPath(); c.arc(x + cell / 2, y + cell / 2, cell * 0.47, 0, TAU); c.stroke();
      }
    }
    // ghost: where each seed of the dragged bundle will land
    if (d && d.valid && d.landing) {
      for (const p of d.landing) {
        drawSeed(bx + p.c * cell, by + p.r * cell, cell, p.color, skin, 0.35 + pulse * 0.12);
        c.setLineDash([4, 4]); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(bx + (p.c + 0.5) * cell, by + (p.r + 0.5) * cell, cell * 0.44, 0, TAU); c.stroke(); c.setLineDash([]);
      }
    }
    // blooming flowers
    for (let k = blooms.length - 1; k >= 0; k--) {
      const b = blooms[k];
      const t = (now - b.t0) / 540;
      const [x, y] = cellCenter(b.r, b.c);
      if (t >= 1) { blooms.splice(k, 1); continue; }
      if (t < 0) { drawSeed(x - cell / 2, y - cell / 2, cell, b.color, skin); continue; }
      if (t < 0.22) drawSeed(x - cell / 2, y - cell / 2, cell, b.color, skin, 1, 1 + t * 1.1);
      else {
        const k2 = (t - 0.22) / 0.78;
        c.globalAlpha = 1 - easeIn(k2);
        drawFlower(c, x, y, cell * (0.55 + 0.35 * easeOut(k2)), b.col, easeOutBack(Math.min(1, k2 * 1.6)), k2 * 1.5);
        c.globalAlpha = 1;
      }
    }
    c.restore();

    // shockwave rings
    for (let k = rings.length - 1; k >= 0; k--) {
      const r0 = rings[k], t = (now - r0.t0) / 520;
      if (t >= 1) { rings.splice(k, 1); continue; }
      if (t < 0) continue;
      c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - t)})`; c.lineWidth = 3 * (1 - t) + 0.5;
      c.beginPath(); c.arc(r0.x, r0.y, r0.r * easeOut(t), 0, TAU); c.stroke();
    }

    // weed countdown: a pill under the bed
    if (st.weedIn != null) {
      const n = st.weedIn, soon = n <= 1;
      const text = soon ? 'Weeds next drop' : `Weeds in ${n}`;
      c.font = `600 ${Math.round(Math.max(12, cell * 0.27))}px ${FONT}`;
      const tw = c.measureText(text).width, ph = Math.max(24, cell * 0.5), pw = tw + ph + 16;
      const px = bx + bw / 2 - pw / 2, py = by + bh + 14;
      rr(c, px, py, pw, ph, ph / 2);
      c.fillStyle = soon ? `rgba(248,113,113,${0.18 + pulse * 0.12})` : 'rgba(255,255,255,0.06)'; c.fill();
      c.strokeStyle = soon ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'; c.lineWidth = 1; c.stroke();
      // sprout icon
      const ix = px + ph * 0.55, iy = py + ph / 2 + (soon ? Math.sin(now / 60) * 1.2 : 0);
      c.strokeStyle = '#6ee7a0'; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ix, iy + ph * 0.25); c.lineTo(ix, iy - ph * 0.02); c.stroke();
      c.fillStyle = '#6ee7a0';
      c.beginPath(); c.ellipse(ix + ph * 0.14, iy - ph * 0.12, ph * 0.15, ph * 0.08, -0.5, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(ix - ph * 0.12, iy - ph * 0.06, ph * 0.12, ph * 0.065, 0.5, 0, TAU); c.fill();
      c.fillStyle = soon ? '#fecaca' : 'rgba(240,236,255,0.75)';
      c.textAlign = 'left'; c.textBaseline = 'middle'; c.direction = 'ltr';
      c.fillText(text, px + ph + 4, py + ph / 2 + 1);
    }

    // tray: three soft pads
    L.slots.forEach((slot, i) => {
      const pad = Math.min(slot.w - 10, slot.h - 6);
      rr(c, slot.x - pad / 2, slot.y - pad / 2, pad, pad, 22);
      c.fillStyle = 'rgba(255,255,255,0.035)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1; c.stroke();
      const p = st.tray[i];
      if (!p || (d && d.slot === i)) return;
      const s = L.trayCell;
      const t = clamp01((now - (p.t0 || 0)) / 380);
      const scale = easeOutBack(t);
      if (scale <= 0.01) return;
      const pw = p.piece.w * s, ph = p.piece.h * s;
      const rt = p.rotT ? clamp01((now - p.rotT) / 200) : 1;
      c.save();
      c.translate(slot.x, slot.y + (1 - t) * 30);
      c.rotate(-(1 - easeOut(rt)) * Math.PI / 2);
      c.scale(scale, scale);
      drawPiece(p.piece, skin, -pw / 2, -ph / 2, s, p.fits ? 1 : 0.28);
      c.restore();
    });

    // the bundle being dragged, lifted with a shadow
    if (d) drawPiece(d.piece, skin, d.x, d.y, cell, 1);

    // particles
    for (let k = particles.length - 1; k >= 0; k--) {
      const p = particles[k];
      const age = now - p.t0;
      if (age < 0) continue;
      if (age > p.life) { particles.splice(k, 1); continue; }
      const t = age / 1000;
      const x = p.x + p.vx * t, y = p.y + p.vy * t + 380 * t * t;
      const a = 1 - age / p.life;
      if (p.kind === 'petal') {
        c.save(); c.translate(x, y); c.rotate(p.rot + p.vr * t);
        c.globalAlpha = a; c.fillStyle = p.color;
        c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU); c.fill();
        c.restore();
      } else {
        c.globalAlpha = a;
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(x, y, p.size * 0.35, 0, TAU); c.fill();
        c.globalAlpha = a * 0.3;
        c.beginPath(); c.arc(x, y, p.size * 0.9, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    }

    // floating points
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'ltr';
    for (let k = floats.length - 1; k >= 0; k--) {
      const f = floats[k];
      const t = (now - f.t0) / f.dur;
      if (t >= 1) { floats.splice(k, 1); continue; }
      if (t < 0) continue;
      const sc = t < 0.15 ? easeOutBack(t / 0.15) : 1;
      c.save();
      c.translate(f.x, f.y - easeOut(t) * cell * 1.3);
      c.scale(sc, sc);
      c.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      c.font = `800 ${Math.round(cell * 0.55 * f.size)}px ${FONT}`;
      c.shadowColor = 'rgba(10,5,40,0.55)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
      c.fillStyle = f.color; c.fillText(f.text, 0, 0);
      c.restore();
    }
    c.restore();

    // banner over the bed: clean type with a coloured glow
    if (banner) {
      const t = (now - banner.t0) / 1400;
      if (t >= 1) banner = null;
      else {
        const sc = t < 0.16 ? easeOutBack(t / 0.16) : 1 + (t - 0.16) * 0.05;
        const lift = t > 0.75 ? (t - 0.75) / 0.25 : 0;
        c.save();
        c.translate(W / 2, by + bh * 0.38 - lift * 20);
        c.scale(sc, sc);
        c.globalAlpha = 1 - lift;
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'ltr';
        const fs = Math.min(W / (banner.text.length * 0.56 + 1), cell * 1.35);
        c.font = `800 ${Math.round(fs)}px ${FONT}`;
        c.shadowColor = banner.color; c.shadowBlur = fs * 0.6;
        const gr = c.createLinearGradient(0, -fs / 2, 0, fs / 2);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, banner.color);
        c.fillStyle = gr; c.fillText(banner.text, 0, 0);
        c.shadowBlur = 0;
        if (banner.sub) {
          c.font = `600 ${Math.round(fs * 0.3)}px ${FONT}`;
          const sw = c.measureText(banner.sub).width + fs * 0.5, sh = fs * 0.5;
          rr(c, -sw / 2, fs * 0.55, sw, sh, sh / 2);
          c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
          c.fillStyle = '#fff'; c.fillText(banner.sub, 0, fs * 0.55 + sh / 2 + 1);
        }
        c.restore();
      }
    }
    if (flash) {
      const t = (now - flash.t0) / 450;
      if (t >= 1) flash = null;
      else { c.globalAlpha = (1 - t) * 0.28; c.fillStyle = flash.color; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    }
  }

  return { resize, draw, layout: L, bloom, fall, float, setBanner, setShake, setFlash, pop, cellCenter };
}

// Three seeds of a skin, for the skin picker.
export function previewSkin(cv, skin) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (skin.dark) { c.fillStyle = '#07070f'; rr(c, 0, 0, r.width, r.height, 12); c.fill(); }
  const s = Math.min(r.height * 0.8, r.width / 3.6);
  [0, 3, 5].forEach((ci, i) => {
    const sp = seedSprite(skin.style, skin.colors[ci], ci, s, dpr);
    const ds = sp.width / dpr;
    c.drawImage(sp, r.width / 2 + (i - 1) * s * 1.02 - ds / 2, r.height / 2 - ds / 2, ds, ds);
  });
}
