// Canvas drawing: the board, the tray, the piece being dragged and all the juice (pops, petals,
// sparks, floating points, banners, shake).
import { N } from './board.js';

const TAU = Math.PI * 2;
const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
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

// ---- block sprites, cached per style / colour / size ------------------------------------------
const cache = new Map();
function blockSprite(style, color, size, dpr) {
  const px = Math.max(4, Math.round(size * dpr));
  const k = `${style}|${color}|${px}`;
  let cv = cache.get(k);
  if (cv) return cv;
  if (cache.size > 400) cache.clear();
  cv = document.createElement('canvas');
  const pad = Math.round(px * 0.25);
  cv.width = cv.height = px + pad * 2;
  const c = cv.getContext('2d');
  c.translate(pad, pad);
  const s = px, m = s * 0.04;
  if (style === 'jelly') {
    rr(c, m, m, s - 2 * m, s - 2 * m, s * 0.2);
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, shade(color, 0.35)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.3));
    c.fillStyle = g; c.fill();
    c.lineWidth = s * 0.05; c.strokeStyle = shade(color, -0.4); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath(); c.ellipse(s * 0.42, s * 0.27, s * 0.26, s * 0.11, -0.25, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath(); c.arc(s * 0.74, s * 0.24, s * 0.05, 0, TAU); c.fill();
  } else if (style === 'candy') {
    rr(c, m, m, s - 2 * m, s - 2 * m, s * 0.32);
    const g = c.createRadialGradient(s * 0.35, s * 0.3, s * 0.05, s * 0.5, s * 0.5, s * 0.7);
    g.addColorStop(0, shade(color, 0.5)); g.addColorStop(0.6, color); g.addColorStop(1, shade(color, -0.35));
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = s * 0.1;
    for (let i = -1; i < 3; i++) { c.beginPath(); c.moveTo(i * s * 0.4, s); c.lineTo(i * s * 0.4 + s, 0); c.stroke(); }
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath(); c.ellipse(s * 0.33, s * 0.28, s * 0.14, s * 0.08, -0.6, 0, TAU); c.fill();
  } else if (style === 'flat') {
    rr(c, m, m, s - 2 * m, s - 2 * m, s * 0.24);
    c.fillStyle = color; c.fill();
    c.save(); c.clip();
    c.fillStyle = shade(color, -0.12); c.fillRect(0, s * 0.8, s, s * 0.2);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, 0, s, s * 0.12);
    c.restore();
  } else if (style === 'gem') {
    const i = s * 0.22;
    c.fillStyle = shade(color, 0.35); c.beginPath(); c.moveTo(m, m); c.lineTo(s - m, m); c.lineTo(s - i, i); c.lineTo(i, i); c.fill();
    c.fillStyle = shade(color, 0.15); c.beginPath(); c.moveTo(m, m); c.lineTo(i, i); c.lineTo(i, s - i); c.lineTo(m, s - m); c.fill();
    c.fillStyle = shade(color, -0.35); c.beginPath(); c.moveTo(m, s - m); c.lineTo(i, s - i); c.lineTo(s - i, s - i); c.lineTo(s - m, s - m); c.fill();
    c.fillStyle = shade(color, -0.2); c.beginPath(); c.moveTo(s - m, m); c.lineTo(s - m, s - m); c.lineTo(s - i, s - i); c.lineTo(s - i, i); c.fill();
    const g = c.createLinearGradient(i, i, s - i, s - i);
    g.addColorStop(0, shade(color, 0.2)); g.addColorStop(1, color);
    c.fillStyle = g; c.fillRect(i, i, s - 2 * i, s - 2 * i);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.moveTo(i, i); c.lineTo(i + s * 0.22, i); c.lineTo(i, i + s * 0.22); c.fill();
  } else { // neon
    rr(c, s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.16);
    c.shadowColor = color; c.shadowBlur = s * 0.25;
    c.lineWidth = s * 0.09; c.strokeStyle = color; c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = shade(color, -0.55); c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
    rr(c, s * 0.28, s * 0.28, s * 0.44, s * 0.44, s * 0.08);
    c.fillStyle = shade(color, 0.2); c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
  }
  cache.set(k, cv);
  return cv;
}

export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const L = { boardX: 0, boardY: 0, cell: 0, size: 0, slots: [], trayCell: 0, trayY: 0 };
  const particles = [], floats = [], clears = [], pops = new Map();
  let banner = null, shake = null, flash = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const pad = 14;
    const trayRatio = 3.4; // tray height in board cells
    let size = Math.min(W - pad * 2, 520);
    let cell = size / N;
    if (size + cell * trayRatio + 16 > H) { size = (H - 16) / (1 + trayRatio / N); cell = size / N; }
    L.size = size; L.cell = cell;
    L.boardX = (W - size) / 2;
    const free = H - size - cell * trayRatio;
    L.boardY = Math.max(6, free * 0.25);
    L.trayY = L.boardY + size + 4 + (H - L.boardY - size - 4) / 2;
    const trayW = Math.min(W - 12, size + cell * 2);
    const slotW = trayW / 3;
    L.trayCell = Math.min(cell * 0.56, slotW / 5.8);
    L.slots = [0, 1, 2].map((i) => ({ x: (W - trayW) / 2 + slotW * (i + 0.5), y: L.trayY, w: slotW, h: cell * trayRatio }));
  }

  // ---- effects API --------------------------------------------------------------------------
  const cellCenter = (r, cc) => [L.boardX + (cc + 0.5) * L.cell, L.boardY + (r + 0.5) * L.cell];

  function burst(cells, colors, now, power = 1) {
    // Cells pop in a wave from where the piece landed; each throws petals and sparks.
    let cr = 0, ccx = 0;
    for (const p of cells) { cr += p.r; ccx += p.c; }
    cr /= cells.length || 1; ccx /= cells.length || 1;
    for (const p of cells) {
      const d = Math.hypot(p.r - cr, p.c - ccx);
      const delay = d * 28;
      clears.push({ ...p, t0: now + delay });
      const [x, y] = cellCenter(p.r, p.c);
      const col = colors[p.color - 1] || '#fff';
      const count = Math.round(3 + power * 2);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, sp = (60 + Math.random() * 220) * (0.7 + power * 0.3);
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, t0: now + delay, life: 700 + Math.random() * 500, color: col, size: L.cell * (0.12 + Math.random() * 0.14), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, kind: i % 3 === 0 ? 'spark' : 'petal' });
      }
    }
  }

  function float(text, x, y, now, { color = '#fff', size = 1, dur = 1000 } = {}) { floats.push({ text, x, y, t0: now, dur, color, size }); }
  function setBanner(text, sub, now, color = '#ffe14a') { banner = { text, sub, t0: now, color }; }
  function setShake(mag, now) { if (!shake || mag > shake.mag * (1 - (now - shake.t0) / 400)) shake = { mag, t0: now }; }
  function setFlash(color, now) { flash = { color, t0: now }; }
  function pop(cells, now) { for (const [r, cc] of cells) pops.set(r * N + cc, now); }
  const busy = (now) => clears.some((p) => now - p.t0 < 380) || particles.length > 0 || floats.length > 0;

  // ---- drawing ------------------------------------------------------------------------------
  function drawBlock(x, y, s, color, style, alpha = 1, scale = 1) {
    const sp = blockSprite(style, color, s, dpr);
    const pad = (sp.width / dpr - s) / 2;
    const ds = sp.width / dpr * scale;
    c.globalAlpha = alpha;
    c.drawImage(sp, x + s / 2 - ds / 2, y + s / 2 - ds / 2, ds, ds);
    c.globalAlpha = 1;
    return pad;
  }

  function drawPiece(shape, color, x, y, s, style, alpha = 1, scale = 1) {
    for (const [r, cc] of shape.cells) drawBlock(x + cc * s, y + r * s, s, color, style, alpha, scale);
  }

  function draw(st, now) {
    const skin = st.skin;
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

    // board panel
    const { boardX: bx, boardY: by, cell, size } = L;
    rr(c, bx - 6, by - 6, size + 12, size + 12, 16);
    c.fillStyle = skin.dark ? 'rgba(5,5,20,0.85)' : 'rgba(20,14,60,0.55)';
    c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.08)'; c.stroke();
    for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) {
      rr(c, bx + cc * cell + 2, by + r * cell + 2, cell - 4, cell - 4, cell * 0.16);
      c.fillStyle = (r + cc) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.075)';
      c.fill();
    }

    // drag preview: lines that would clear light up in the piece's colour
    const d = st.drag;
    const previewLines = d && d.valid && d.lines ? d.lines : null;
    const lineSet = new Set();
    if (previewLines) {
      for (const row of previewLines.rows) for (let j = 0; j < N; j++) lineSet.add(row * N + j);
      for (const col of previewLines.cols) for (let j = 0; j < N; j++) lineSet.add(j * N + col);
    }

    // blocks
    const overT = st.overT;
    for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) {
      const i = r * N + cc, v = st.grid[i];
      if (!v) continue;
      let col = skin.colors[v - 1];
      let scale = 1;
      const pt = pops.get(i);
      if (pt !== undefined) {
        const t = (now - pt) / 260;
        if (t >= 1) pops.delete(i); else scale = 0.8 + 0.2 * easeOutBack(clamp01(t)) + Math.sin(t * Math.PI) * 0.06;
      }
      if (lineSet.has(i)) col = d.color;
      if (overT && now - overT > i * 14) col = '#77758f';
      drawBlock(bx + cc * cell, by + r * cell, cell, col, skin.style, 1, scale);
    }
    if (previewLines) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 90);
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,255,255,${0.08 + pulse * 0.12})`;
      for (const i of lineSet) {
        const r = Math.floor(i / N), cc = i % N;
        rr(c, bx + cc * cell + 2, by + r * cell + 2, cell - 4, cell - 4, cell * 0.16); c.fill();
      }
      c.restore();
    }

    // ghost of where the piece will land
    if (d && d.valid) {
      for (const [r, cc] of d.shape.cells) {
        const x = bx + (d.c + cc) * cell, y = by + (d.r + r) * cell;
        if (lineSet.has((d.r + r) * N + d.c + cc)) continue;
        drawBlock(x, y, cell, d.color, skin.style, 0.38);
      }
      for (const [r, cc] of d.shape.cells) if (lineSet.has((d.r + r) * N + d.c + cc)) drawBlock(bx + (d.c + cc) * cell, by + (d.r + r) * cell, cell, d.color, skin.style, 1);
    }

    // clearing cells: flash white, swell, shrink away
    for (let k = clears.length - 1; k >= 0; k--) {
      const p = clears[k];
      const t = (now - p.t0) / 380;
      const x = bx + p.c * cell, y = by + p.r * cell;
      if (t < 0) { drawBlock(x, y, cell, skin.colors[p.color - 1], skin.style); continue; }
      if (t >= 1) { clears.splice(k, 1); continue; }
      const scale = t < 0.3 ? 1 + t * 0.6 : (1.18) * (1 - easeOut((t - 0.3) / 0.7));
      drawBlock(x, y, cell, skin.colors[p.color - 1], skin.style, 1, scale);
      if (t < 0.5) {
        c.globalAlpha = (1 - t / 0.5) * 0.8;
        c.fillStyle = '#fff';
        rr(c, x + cell * 0.5 - cell * scale * 0.42, y + cell * 0.5 - cell * scale * 0.42, cell * scale * 0.84, cell * scale * 0.84, cell * 0.18); c.fill();
        c.globalAlpha = 1;
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
      const pw = p.shape.w * s, ph = p.shape.h * s;
      const x = slot.x - pw / 2, y = slot.y - ph / 2 + (1 - t) * 40;
      c.save();
      c.translate(slot.x, slot.y);
      c.scale(scale, scale);
      c.translate(-slot.x, -slot.y);
      drawPiece(p.shape, p.color, x, y, s, skin.style, p.fits ? 1 : 0.32);
      c.restore();
    });

    // the dragged piece follows the finger
    if (d) {
      const s = cell * (d.scale || 1);
      drawPiece(d.shape, d.color, d.x, d.y, s, skin.style, 1, 1.0);
    }

    // particles
    for (let k = particles.length - 1; k >= 0; k--) {
      const p = particles[k];
      const age = now - p.t0;
      if (age < 0) continue;
      if (age > p.life) { particles.splice(k, 1); continue; }
      const t = age / 1000;
      const x = p.x + p.vx * t, y = p.y + p.vy * t + 380 * t * t;
      const a = 1 - age / p.life;
      c.save();
      c.translate(x, y);
      c.rotate(p.rot + p.vr * t);
      c.globalAlpha = a;
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
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.direction = 'ltr';
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

    // banner: praise word over the board
    if (banner) {
      const t = (now - banner.t0) / 1300;
      if (t >= 1) banner = null;
      else {
        const sc = t < 0.18 ? easeOutBack(t / 0.18) * 1.0 : 1 + (t - 0.18) * 0.08;
        c.save();
        c.translate(W / 2, by + size * 0.42);
        c.rotate(-0.06);
        c.scale(sc, sc);
        c.globalAlpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl';
        const fs = Math.min(W / (banner.text.length * 0.62 + 1), cell * 1.5);
        c.font = `900 ${Math.round(fs)}px "Rubik", system-ui, sans-serif`;
        c.lineJoin = 'round';
        c.lineWidth = fs * 0.22; c.strokeStyle = '#2a0d55'; c.strokeText(banner.text, 0, 0);
        const g = c.createLinearGradient(0, -fs / 2, 0, fs / 2);
        g.addColorStop(0, '#fff7c2'); g.addColorStop(0.5, banner.color); g.addColorStop(1, shade(banner.color.startsWith('#') ? banner.color : '#ffaa00', -0.25));
        c.fillStyle = g; c.fillText(banner.text, 0, 0);
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

  return { resize, draw, layout: L, burst, float, setBanner, setShake, setFlash, pop, busy, cellCenter, size: () => ({ W, H }) };
}

// A row of three blocks, for the skin picker.
export function previewSkin(cv, skin) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (skin.dark) { c.fillStyle = '#0a0a1c'; rr(c, 0, 0, r.width, r.height, 10); c.fill(); }
  const s = Math.min(r.height * 0.7, r.width / 4.2);
  [0, 3, 5].forEach((ci, i) => {
    const sp = blockSprite(skin.style, skin.colors[ci], s, dpr);
    const ds = sp.width / dpr;
    c.drawImage(sp, r.width / 2 + (i - 1) * s * 1.1 - ds / 2, r.height / 2 - ds / 2, ds, ds);
  });
}
