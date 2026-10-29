// Canvas drawing: the garden bed, seeds (with bridges between same-colour neighbours so groups
// read at a glance), falling, blooming flowers, special flowers, weeds, the tray, the dragged
// bundle, and the juice (petals, sparks, floating points, banners, shake).
import { COLS, ROWS, WEED, BOMB, RAINBOW, idx } from './board.js';

const TAU = Math.PI * 2;
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

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ---- seed sprites, cached per style / colour / size ------------------------------------------
const cache = new Map();
function seedSprite(style, color, size, dpr) {
  const px = Math.max(4, Math.round(size * dpr));
  const k = `${style}|${color}|${px}`;
  let cv = cache.get(k);
  if (cv) return cv;
  if (cache.size > 500) cache.clear();
  cv = document.createElement('canvas');
  const pad = Math.round(px * 0.2);
  cv.width = cv.height = px + pad * 2;
  const c = cv.getContext('2d');
  c.translate(pad, pad);
  const s = px, R = s * 0.43, cx = s / 2, cy = s / 2;
  if (color === 'weed') {
    rr(c, s * 0.08, s * 0.1, s * 0.84, s * 0.82, s * 0.26);
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#6d6a5a'); g.addColorStop(1, '#3d3a30');
    c.fillStyle = g; c.fill();
    c.lineWidth = s * 0.04; c.strokeStyle = '#2a271f'; c.stroke();
    c.strokeStyle = '#4f8a2a'; c.lineWidth = s * 0.07; c.lineCap = 'round';
    for (const [x, a] of [[0.35, -0.5], [0.5, 0], [0.66, 0.45]]) {
      c.beginPath(); c.moveTo(s * x, s * 0.5); c.quadraticCurveTo(s * (x + a * 0.1), s * 0.3, s * (x + a * 0.25), s * 0.16); c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.beginPath(); c.ellipse(s * 0.38, s * 0.62, s * 0.18, s * 0.07, -0.3, 0, TAU); c.fill();
  } else if (style === 'jelly' || style === 'candy') {
    const g = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.1);
    g.addColorStop(0, shade(color, 0.55)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.35));
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    c.lineWidth = s * 0.04; c.strokeStyle = shade(color, -0.45); c.stroke();
    if (style === 'candy') {
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
      c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = s * 0.09;
      for (let i = -2; i < 3; i++) { c.beginPath(); c.moveTo(cx + i * s * 0.22 - s, cy + s); c.lineTo(cx + i * s * 0.22 + s, cy - s); c.stroke(); }
      c.restore();
    }
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.ellipse(cx - R * 0.25, cy - R * 0.45, R * 0.42, R * 0.2, -0.4, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.arc(cx + R * 0.38, cy - R * 0.38, R * 0.1, 0, TAU); c.fill();
  } else if (style === 'flat') {
    c.fillStyle = shade(color, -0.15);
    c.beginPath(); c.arc(cx, cy + s * 0.04, R, 0, TAU); c.fill();
    c.fillStyle = color;
    c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.arc(cx - R * 0.3, cy - R * 0.3, R * 0.25, 0, TAU); c.fill();
  } else if (style === 'gem') {
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
    for (let i = 0; i < 8; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % 8];
      const a = (i + 0.5) / 8 * TAU + TAU / 16;
      c.fillStyle = shade(color, -Math.sin(a) * 0.35 + Math.cos(a) * 0.1);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(x1, y1); c.lineTo(x2, y2); c.fill();
    }
    c.fillStyle = shade(color, 0.15);
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; c.lineTo(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55); } c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath(); c.moveTo(cx - R * 0.4, cy - R * 0.35); c.lineTo(cx - R * 0.05, cy - R * 0.5); c.lineTo(cx - R * 0.3, cy - R * 0.1); c.fill();
  } else { // neon
    c.shadowColor = color; c.shadowBlur = s * 0.25;
    c.lineWidth = s * 0.09; c.strokeStyle = color;
    c.beginPath(); c.arc(cx, cy, R * 0.86, 0, TAU); c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = shade(color, -0.6); c.fill();
    c.fillStyle = shade(color, 0.25); c.globalAlpha = 0.6;
    c.beginPath(); c.arc(cx, cy, R * 0.38, 0, TAU); c.fill(); c.globalAlpha = 1;
  }
  cache.set(k, cv);
  return cv;
}

function drawFlower(c, x, y, r, color, open, spin = 0) {
  // `open` 0..1: petals unfold from the seed
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + spin;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = i % 2 ? color : shade(color, 0.3);
    c.beginPath(); c.ellipse(r * 0.55 * open, 0, r * 0.55 * open + 0.01, r * 0.32 * open + 0.01, 0, 0, TAU); c.fill();
    c.restore();
  }
  c.fillStyle = '#ffd23d';
  c.beginPath(); c.arc(x, y, r * 0.28 * (0.6 + 0.4 * open), 0, TAU); c.fill();
}

export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const L = { boardX: 0, boardY: 0, cell: 0, bw: 0, bh: 0, slots: [], trayCell: 0, trayY: 0 };
  const particles = [], floats = [], blooms = [], falls = new Map(), pops = new Map();
  let banner = null, shake = null, flash = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const trayRows = 3.6; // tray height in cells
    let cell = Math.min((W - 24) / COLS, 58);
    if (cell * (ROWS + trayRows) + 30 > H) cell = (H - 30) / (ROWS + trayRows);
    L.cell = cell; L.bw = cell * COLS; L.bh = cell * ROWS;
    L.boardX = (W - L.bw) / 2;
    const free = H - L.bh - cell * trayRows;
    L.boardY = Math.max(10, free * 0.3);
    L.trayY = L.boardY + L.bh + 14 + (H - L.boardY - L.bh - 14) / 2;
    const trayW = Math.min(W - 12, L.bw + cell * 2);
    const slotW = trayW / 3;
    L.trayCell = Math.min(cell * 0.72, slotW / 3.6);
    L.slots = [0, 1, 2].map((i) => ({ x: (W - trayW) / 2 + slotW * (i + 0.5), y: L.trayY, w: slotW, h: Math.min(cell * trayRows, H - L.boardY - L.bh) }));
  }

  // ---- effects API --------------------------------------------------------------------------
  const cellCenter = (r, cc) => [L.boardX + (cc + 0.5) * L.cell, L.boardY + (r + 0.5) * L.cell];

  // Seeds that bloom: each opens into a flower in its colour, then bursts into petals.
  function bloom(cells, colors, now, power = 1) {
    let cr = 0, ccx = 0;
    for (const p of cells) { cr += p.r; ccx += p.c; }
    cr /= cells.length || 1; ccx /= cells.length || 1;
    for (const p of cells) {
      const delay = Math.hypot(p.r - cr, p.c - ccx) * 30;
      const col = p.color === WEED ? '#7a8a4a' : colors[p.color - 1] || '#fff';
      blooms.push({ ...p, col, t0: now + delay });
      const [x, y] = cellCenter(p.r, p.c);
      const count = Math.round(3 + power * 1.5);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, sp = (60 + Math.random() * 200) * (0.7 + power * 0.25);
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, t0: now + delay + 260, life: 700 + Math.random() * 600, color: col, size: L.cell * (0.12 + Math.random() * 0.14), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, kind: i % 3 === 0 ? 'spark' : 'petal' });
      }
    }
  }
  // Cells drawn sliding down from `from` rows to where they are now in the grid.
  function fall(list, now, dur = 230) { for (const m of list) falls.set(idx(m.to, m.c), { from: m.from, to: m.to, t0: now, dur: dur + Math.max(0, m.to - m.from) * 14 }); }
  function float(text, x, y, now, { color = '#fff', size = 1, dur = 1000 } = {}) { floats.push({ text, x, y, t0: now, dur, color, size }); }
  function setBanner(text, sub, now, color = '#ffe14a') { banner = { text, sub, t0: now, color }; }
  function setShake(mag, now) { if (!shake || mag > shake.mag * (1 - (now - shake.t0) / 400)) shake = { mag, t0: now }; }
  function setFlash(color, now) { flash = { color, t0: now }; }
  function pop(cells, now) { for (const [r, cc] of cells) pops.set(idx(r, cc), now); }

  // ---- drawing ------------------------------------------------------------------------------
  function drawSeed(x, y, s, color, style, alpha = 1, scale = 1) {
    const sp = seedSprite(style, color, s, dpr);
    const ds = sp.width / dpr * scale;
    c.globalAlpha = alpha;
    c.drawImage(sp, x + s / 2 - ds / 2, y + s / 2 - ds / 2, ds, ds);
    c.globalAlpha = 1;
  }

  function drawSpecial(x, y, s, kind, now) {
    const cx = x + s / 2, cy = y + s / 2;
    if (kind === BOMB) {
      const pulse = 1 + Math.sin(now / 160) * 0.08;
      c.save(); c.translate(cx, cy); c.scale(pulse, pulse);
      for (let i = 0; i < 8; i++) {
        c.save(); c.rotate(i / 8 * TAU + now / 1500);
        c.fillStyle = '#ffd23d';
        c.beginPath(); c.ellipse(s * 0.2, 0, s * 0.13, s * 0.06, 0, 0, TAU); c.fill();
        c.restore();
      }
      c.fillStyle = '#7a3e00';
      c.beginPath(); c.arc(0, 0, s * 0.11, 0, TAU); c.fill();
      c.restore();
    } else if (kind === RAINBOW) {
      const cols = ['#ff4d6d', '#ffa63d', '#ffe14a', '#4fe08a', '#3bc4ff', '#9b6cff'];
      c.save(); c.translate(cx, cy); c.rotate(now / 600);
      c.lineWidth = s * 0.08;
      cols.forEach((col, i) => { c.strokeStyle = col; c.beginPath(); c.arc(0, 0, s * 0.4, (i / 6) * TAU, ((i + 1) / 6) * TAU); c.stroke(); });
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath(); c.arc(cx, cy, s * 0.1 + Math.sin(now / 200) * s * 0.02, 0, TAU); c.fill();
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

  function drawPiece(piece, colors, x, y, s, style, alpha = 1) {
    piece.cells.forEach(([r, cc], i) => drawSeed(x + cc * s, y + r * s, s, colors[piece.colors[i] - 1], style, alpha));
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

    // garden bed
    rr(c, bx - 7, by - 7, bw + 14, bh + 14, 18);
    const bed = c.createLinearGradient(0, by, 0, by + bh);
    if (skin.dark) { bed.addColorStop(0, '#0b0b1e'); bed.addColorStop(1, '#14142e'); }
    else { bed.addColorStop(0, 'rgba(40,22,90,0.75)'); bed.addColorStop(1, 'rgba(70,38,40,0.85)'); }
    c.fillStyle = bed; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.1)'; c.stroke();
    for (let cc = 0; cc < COLS; cc++) {
      c.fillStyle = cc % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.05)';
      c.fillRect(bx + cc * cell, by, cell, bh);
    }
    // danger: a column near the top makes the sky glow red
    if (st.danger > 0) {
      const a = st.danger * (0.35 + 0.2 * Math.sin(now / 140));
      const g = c.createLinearGradient(0, by, 0, by + cell * 2.5);
      g.addColorStop(0, `rgba(255,40,70,${a})`); g.addColorStop(1, 'rgba(255,40,70,0)');
      c.fillStyle = g; c.fillRect(bx, by, bw, cell * 2.5);
    }
    // highlighted column under the dragged bundle
    const d = st.drag;
    if (d && d.valid) {
      c.fillStyle = 'rgba(255,255,255,0.07)';
      c.fillRect(bx + d.col * cell, by, d.w * cell, bh);
    }

    c.save();
    rr(c, bx - 4, by - 4, bw + 8, bh + 8, 14); c.clip();
    // bridges between same-colour neighbours, under the seeds
    const g = st.grid, sp = st.spec;
    const offs = new Float32Array(COLS * ROWS);
    for (let i = 0; i < COLS * ROWS; i++) if (g[i]) offs[i] = fallOffset(i, now);
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
      const i = idx(r, cc), v = g[i];
      if (!v || v === WEED || offs[i]) continue;
      const col = colors[v - 1];
      c.fillStyle = col;
      if (cc + 1 < COLS && g[i + 1] === v && !offs[i + 1]) c.fillRect(bx + (cc + 0.5) * cell, by + (r + 0.22) * cell, cell, cell * 0.56);
      if (r + 1 < ROWS && g[i + COLS] === v && !offs[i + COLS]) c.fillRect(bx + (cc + 0.22) * cell, by + (r + 0.5) * cell, cell * 0.56, cell);
    }
    const hot = st.preview ? new Set(st.preview) : null;
    const pulse = 0.5 + 0.5 * Math.sin(now / 90);
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
      const i = idx(r, cc), v = g[i];
      if (!v) continue;
      const x = bx + cc * cell, y = by + (r - offs[i]) * cell;
      let scale = 1;
      const pt = pops.get(i);
      if (pt !== undefined) {
        const t = (now - pt) / 280;
        if (t >= 1) pops.delete(i); else if (t > 0) scale = 1 + Math.sin(t * Math.PI) * 0.18;
      }
      const grey = st.overT && now - st.overT > (ROWS - 1 - r) * 60 + cc * 10;
      if (hot && hot.has(i)) scale *= 1.06 + pulse * 0.06;
      drawSeed(x, y, cell, v === WEED ? 'weed' : grey ? '#77758f' : colors[v - 1], skin.style, 1, scale);
      if (sp[i]) drawSpecial(x, y, cell, sp[i], now);
      if (hot && hot.has(i)) {
        c.save(); c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(255,255,255,${0.12 + pulse * 0.18})`;
        c.beginPath(); c.arc(x + cell / 2, y + cell / 2, cell * 0.44, 0, TAU); c.fill();
        c.restore();
      }
    }
    // ghost: where each seed of the dragged bundle will land
    if (d && d.valid && d.landing) {
      for (const p of d.landing) drawSeed(bx + p.c * cell, by + p.r * cell, cell, colors[p.color - 1], skin.style, 0.42 + pulse * 0.1);
    }
    // blooming flowers
    for (let k = blooms.length - 1; k >= 0; k--) {
      const b = blooms[k];
      const t = (now - b.t0) / 520;
      const [x, y] = cellCenter(b.r, b.c);
      if (t >= 1) { blooms.splice(k, 1); continue; }
      if (t < 0) { drawSeed(x - cell / 2, y - cell / 2, cell, b.color === WEED ? 'weed' : b.col, skin.style); continue; }
      if (t < 0.25) drawSeed(x - cell / 2, y - cell / 2, cell, b.color === WEED ? 'weed' : b.col, skin.style, 1, 1 + t * 1.2);
      else {
        const k2 = (t - 0.25) / 0.75;
        c.globalAlpha = 1 - easeIn(k2);
        drawFlower(c, x, y, cell * (0.55 + 0.35 * easeOut(k2)), b.col, easeOutBack(Math.min(1, k2 * 1.6)), k2 * 1.5);
        c.globalAlpha = 1;
      }
    }
    c.restore();

    // weed countdown under the bed
    if (st.weedIn != null) {
      const y = by + bh + 12, n = Math.min(st.weedIn, 9);
      c.textAlign = 'right'; c.textBaseline = 'middle'; c.direction = 'rtl';
      c.font = `800 ${Math.round(cell * 0.3)}px Rubik, system-ui, sans-serif`;
      c.fillStyle = n <= 1 ? `rgba(255,120,120,${0.7 + pulse * 0.3})` : 'rgba(255,255,255,0.7)';
      c.fillText(n <= 1 ? 'עשבים בתור הבא!' : `עשבים בעוד ${n}`, bx + bw, y);
      for (let i = 0; i < n; i++) {
        const x = bx + 6 + i * cell * 0.34, yy = y + (n <= 1 ? Math.sin(now / 60) * 2 : 0);
        c.strokeStyle = '#6fbf3a'; c.lineWidth = 2.5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, yy + 7); c.quadraticCurveTo(x - 1, yy, x + 4, yy - 6); c.stroke();
        c.fillStyle = '#8fdc4f'; c.beginPath(); c.ellipse(x + 4, yy - 4, 3.5, 2, -0.6, 0, TAU); c.fill();
      }
    }

    // tray
    st.tray.forEach((p, i) => {
      if (!p || (d && d.slot === i)) return;
      const slot = L.slots[i];
      const s = L.trayCell;
      const t = clamp01((now - (p.t0 || 0)) / 380);
      const scale = easeOutBack(t);
      if (scale <= 0.01) return;
      const pw = p.piece.w * s, ph = p.piece.h * s;
      const rt = p.rotT ? clamp01((now - p.rotT) / 180) : 1;
      c.save();
      c.translate(slot.x, slot.y + (1 - t) * 40);
      c.rotate(-(1 - easeOut(rt)) * Math.PI / 2);
      c.scale(scale, scale);
      drawPiece(p.piece, colors, -pw / 2, -ph / 2, s, skin.style, p.fits ? 1 : 0.3);
      c.restore();
    });

    // the bundle being dragged
    if (d) drawPiece(d.piece, colors, d.x, d.y, cell, skin.style, 1);

    // particles
    for (let k = particles.length - 1; k >= 0; k--) {
      const p = particles[k];
      const age = now - p.t0;
      if (age < 0) continue;
      if (age > p.life) { particles.splice(k, 1); continue; }
      const t = age / 1000;
      const x = p.x + p.vx * t, y = p.y + p.vy * t + 380 * t * t;
      c.save();
      c.translate(x, y);
      c.rotate(p.rot + p.vr * t);
      c.globalAlpha = 1 - age / p.life;
      if (p.kind === 'petal') {
        c.fillStyle = p.color;
        c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath(); c.ellipse(-p.size * 0.3, -p.size * 0.12, p.size * 0.35, p.size * 0.16, 0, 0, TAU); c.fill();
      } else {
        c.fillStyle = '#fff';
        c.beginPath();
        const r = p.size * 0.9;
        for (let j = 0; j < 4; j++) { const an = j * Math.PI / 2; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); c.lineTo(Math.cos(an + Math.PI / 4) * r * 0.3, Math.sin(an + Math.PI / 4) * r * 0.3); }
        c.fill();
      }
      c.restore();
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
      c.translate(f.x, f.y - easeOut(t) * cell * 1.4);
      c.scale(sc, sc);
      c.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      c.font = `900 ${Math.round(cell * 0.62 * f.size)}px "Rubik", system-ui, sans-serif`;
      c.lineWidth = cell * 0.14 * f.size; c.strokeStyle = 'rgba(30,10,60,0.85)'; c.lineJoin = 'round';
      c.strokeText(f.text, 0, 0);
      c.fillStyle = f.color; c.fillText(f.text, 0, 0);
      c.restore();
    }
    c.restore();

    // banner over the bed
    if (banner) {
      const t = (now - banner.t0) / 1300;
      if (t >= 1) banner = null;
      else {
        const sc = t < 0.18 ? easeOutBack(t / 0.18) : 1 + (t - 0.18) * 0.08;
        c.save();
        c.translate(W / 2, by + bh * 0.4);
        c.rotate(-0.06);
        c.scale(sc, sc);
        c.globalAlpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl';
        const fs = Math.min(W / (banner.text.length * 0.62 + 1), cell * 1.5);
        c.font = `900 ${Math.round(fs)}px "Rubik", system-ui, sans-serif`;
        c.lineJoin = 'round';
        c.lineWidth = fs * 0.22; c.strokeStyle = '#2a0d55'; c.strokeText(banner.text, 0, 0);
        const gr = c.createLinearGradient(0, -fs / 2, 0, fs / 2);
        gr.addColorStop(0, '#fff7c2'); gr.addColorStop(0.5, banner.color); gr.addColorStop(1, shade(banner.color, -0.25));
        c.fillStyle = gr; c.fillText(banner.text, 0, 0);
        if (banner.sub) {
          c.font = `800 ${Math.round(fs * 0.4)}px "Rubik", system-ui, sans-serif`;
          c.lineWidth = fs * 0.12; c.strokeText(banner.sub, 0, fs * 0.72);
          c.fillStyle = '#fff'; c.fillText(banner.sub, 0, fs * 0.72);
        }
        c.restore();
      }
    }
    if (flash) {
      const t = (now - flash.t0) / 450;
      if (t >= 1) flash = null;
      else { c.globalAlpha = (1 - t) * 0.35; c.fillStyle = flash.color; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
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
  if (skin.dark) { c.fillStyle = '#0a0a1c'; rr(c, 0, 0, r.width, r.height, 10); c.fill(); }
  const s = Math.min(r.height * 0.75, r.width / 4);
  [0, 3, 4].forEach((ci, i) => {
    const sp = seedSprite(skin.style, skin.colors[ci], s, dpr);
    const ds = sp.width / dpr;
    c.drawImage(sp, r.width / 2 + (i - 1) * s * 1.05 - ds / 2, r.height / 2 - ds / 2, ds, ds);
  });
}
