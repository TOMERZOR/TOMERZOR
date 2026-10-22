// Canvas drawing: layout, board, parade belt, buckets, particles.
import { trackLength, trackPos, WILD } from './engine.js';

export const PAPER = '#f4f0fa';
const INK = '#33264d';

export function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
export function shade(hex, k) { return k < 0 ? mix(hex, '#1a1030', -k) : mix(hex, '#ffffff', k); }

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export { rr };

// ---------------------------------------------------------------- layout
export function computeLayout(W, H, safe, level, hud) {
  const top = safe.top + hud.top;
  const bottom = H - safe.bottom - hud.bottom;
  const lanesN = level.lanes.length;
  const slotsN = level.slots;
  const tall = H > 760;
  const Bmax = Math.round(Math.max(40, Math.min(tall ? 60 : 52, (W - 40) / Math.max(4.4, lanesN * 1.35))));
  const rowsPref = H > 900 ? 4 : H > 740 ? 3 : 2;
  // Shrink buckets, belt and visible rows until the canvas gets a readable pixel size.
  const want = Math.min(11, Math.floor(Math.min((W - 90) / level.w, 22)));
  let best = null;
  for (let rows = rowsPref; rows >= 2 && !(best && best.ok); rows--) {
    for (let B = Bmax; B >= 34; B -= 4) {
      const r = fit(W, H, top, bottom, level, B, rows, slotsN);
      if (!best || r.cs > best.cs) best = r;
      if (r.cs >= want) { best = r; best.ok = true; break; }
    }
  }
  const { B, rowsVisible, slotS, T, cs } = best;
  const gap = 4;
  const lanesH = rowsVisible * B * 0.9 + 10;
  const slotsH = slotS + 22 + Math.round(T * 0.35);
  const availH = bottom - top - lanesH - slotsH - 2 * (T + gap) - 18;
  const bw = cs * level.w, bh = cs * level.h;
  const bx = Math.round((W - bw) / 2);
  const freeV = availH - bh;
  const by = Math.round(top + T + gap + 6 + Math.max(0, freeV * 0.35));
  const belt = { x: bx - gap - T, y: by - gap - T, w: bw + 2 * (gap + T), h: bh + 2 * (gap + T), T, r: T * 0.9 };
  const slotsY = belt.y + belt.h + 14 + slotS / 2 + Math.round(T * 0.35);
  const lanesTop = slotsY + slotS / 2 + 14;
  const laneW = Math.min(B * 1.4, (W - 24) / lanesN);
  const lanesX0 = (W - laneW * lanesN) / 2;
  const L = { W, H, cs, bx, by, bw, bh, belt, T, gap, B, rowsVisible, slotS, slotsY, lanesTop, laneW, lanesX0, lanesN, slotsN, top, bottom };
  L.track = buildTrack(L, level.w, level.h);
  return L;
}

function fit(W, H, top, bottom, level, B, rowsVisible, slotsN) {
  const lanesH = rowsVisible * B * 0.9 + 10;
  const slotS = Math.round(Math.min(B * 0.9, (W - 32) / (slotsN + 2) * 1.05));
  const T = Math.round(Math.max(22, Math.min(40, B * 0.66)));
  const slotsH = slotS + 22 + Math.round(T * 0.35);
  const gap = 4;
  const availW = W - 24 - 2 * (T + gap);
  const availH = bottom - top - lanesH - slotsH - 2 * (T + gap) - 18;
  const cs = Math.max(4, Math.min(34, Math.floor(Math.min(availW / level.w, availH / level.h) * 4) / 4));
  return { B, rowsVisible, slotS, T, cs };
}

function buildTrack(L, w, h) {
  const n = trackLength(w, h);
  const pts = new Array(n);
  const off = L.gap + L.T / 2;
  const left = L.bx - off, right = L.bx + L.bw + off, topY = L.by - off, botY = L.by + L.bh + off;
  for (let p = 0; p < n; p++) {
    const t = trackPos(w, h, p);
    let x, y;
    if (t.x < 0) x = left; else if (t.x >= w) x = right; else x = L.bx + (t.x + 0.5) * L.cs;
    if (t.y < 0) y = topY; else if (t.y >= h) y = botY; else y = L.by + (t.y + 0.5) * L.cs;
    pts[p] = { x, y };
  }
  return pts;
}

export function trackPoint(L, f) {
  const n = L.track.length;
  f = ((f % n) + n) % n;
  const i = Math.floor(f), j = (i + 1) % n, t = f - i;
  const a = L.track[i], b = L.track[j];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function laneSlotPos(L, li, depth) {
  return { x: L.lanesX0 + L.laneW * (li + 0.5), y: L.lanesTop + L.B * 0.5 + depth * L.B * 0.9 };
}

export function slotPos(L, si) {
  const n = L.slotsN;
  const gapS = L.slotS * 0.22;
  const total = n * L.slotS + (n - 1) * gapS;
  return { x: (L.W - total) / 2 + L.slotS / 2 + si * (L.slotS + gapS), y: L.slotsY };
}

// ---------------------------------------------------------------- background
export function drawBackground(ctx, L, t, theme) {
  const g = ctx.createLinearGradient(0, 0, 0, L.H);
  g.addColorStop(0, theme[0]); g.addColorStop(1, theme[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.W, L.H);
  // soft floating paint blobs
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 7; i++) {
    const x = (Math.sin(i * 12.9 + t * 0.05) * 0.5 + 0.5) * L.W;
    const y = ((i * 0.37 + t * 0.006 * (1 + i * 0.1)) % 1.2 - 0.1) * L.H;
    const r = 30 + (i % 3) * 22;
    ctx.fillStyle = theme[2 + (i % 3)] || '#fff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- board
export function makeBoardCache(level, L, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(L.bw * dpr); c.height = Math.ceil(L.bh * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas: c, ctx, dpr };
}

export function paintCell(cache, level, L, i, vis, maxCoats) {
  const ctx = cache.ctx, cs = L.cs;
  const x = (i % level.w) * cs, y = Math.floor(i / level.w) * cs;
  const c = level.cells[i];
  ctx.clearRect(x, y, cs, cs);
  if (c < 0) return;
  const col = level.colors[c];
  const left = vis[i];
  if (left <= 0) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, cs, cs);
    if (cs >= 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, y, cs, Math.max(1, cs * 0.14));
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x, y + cs - Math.max(1, cs * 0.12), cs, Math.max(1, cs * 0.12));
    }
    return;
  }
  const partial = maxCoats[i] > 1 && left < maxCoats[i];
  ctx.fillStyle = mix(col, PAPER, partial ? 0.45 : 0.76);
  ctx.fillRect(x, y, cs, cs);
  ctx.strokeStyle = 'rgba(51,38,77,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
  if (maxCoats[i] > 1 && !partial) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, cs, cs); ctx.clip();
    ctx.strokeStyle = mix(col, PAPER, 0.35);
    ctx.lineWidth = Math.max(1, cs * 0.14);
    for (let k = -cs; k < cs * 2; k += cs * 0.5) { ctx.beginPath(); ctx.moveTo(x + k, y + cs); ctx.lineTo(x + k + cs, y); ctx.stroke(); }
    ctx.restore();
  }
  if (cs >= 7) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, Math.max(1.4, cs * 0.17), 0, Math.PI * 2); ctx.fill();
  }
}

export function drawBoardFrame(ctx, L) {
  const pad = Math.max(3, L.cs * 0.35);
  ctx.save();
  ctx.shadowColor = 'rgba(51,38,77,0.18)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  rr(ctx, L.bx - pad, L.by - pad, L.bw + pad * 2, L.bh + pad * 2, 8);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e4dcef';
  ctx.fillRect(L.bx, L.by, L.bw, L.bh);
  // faint grid so empty space reads as canvas, not as white paint
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i <= L.bw / L.cs; i++) ctx.fillRect(L.bx + i * L.cs - 0.5, L.by, 1, L.bh);
  for (let j = 0; j <= L.bh / L.cs; j++) ctx.fillRect(L.bx, L.by + j * L.cs - 0.5, L.bw, 1);
}

// ---------------------------------------------------------------- belt
export function drawBelt(ctx, L, phase, danger) {
  const b = L.belt;
  ctx.save();
  // ring
  ctx.beginPath();
  rrPath(ctx, b.x, b.y, b.w, b.h, b.r);
  rrPath(ctx, b.x + b.T, b.y + b.T, b.w - 2 * b.T, b.h - 2 * b.T, Math.max(4, b.r - b.T * 0.7));
  ctx.fillStyle = danger ? '#5b2a4f' : '#43356e';
  ctx.fill('evenodd');
  // inner lip highlight
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); rrPath(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, b.r); ctx.stroke();
  // moving rollers along the centre line
  const n = L.track.length;
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  const step = 1.0;
  for (let f = phase % step; f < n; f += step) {
    const p = trackPoint(L, f);
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, L.T * 0.07), 0, Math.PI * 2); ctx.fill();
  }
  // entry marker
  const e = L.track[0];
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `700 ${Math.round(L.T * 0.36)}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.55;
  ctx.fillText('▶', e.x, e.y);
  ctx.restore();
}

function rrPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- bucket
const RAINBOW = ['#ff4b5c', '#ff9233', '#ffd23f', '#3fcf6b', '#5ccfff', '#9b5cff'];

export function drawBucket(ctx, x, y, s, col, n, o = {}) {
  // x, y = centre; s = size
  const hidden = o.hidden, rainbow = col === WILD;
  const base = hidden ? '#b9b2cc' : rainbow ? '#ffffff' : col;
  const sq = o.squash || 0; // -1..1
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(1 + sq * 0.12, 1 - sq * 0.12);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const wTop = s * 0.78, wBot = s * 0.6, top = -s * 0.28, bot = s * 0.42;
  // shadow
  ctx.fillStyle = 'rgba(30,18,60,0.22)';
  ctx.beginPath(); ctx.ellipse(0, bot + s * 0.04, wBot * 0.55, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  // handle
  ctx.strokeStyle = hidden ? '#8d86a3' : '#6b6290';
  ctx.lineWidth = Math.max(1.5, s * 0.055);
  ctx.beginPath(); ctx.arc(0, top, wTop * 0.44, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  // body
  ctx.beginPath();
  ctx.moveTo(-wTop / 2, top);
  ctx.lineTo(wTop / 2, top);
  ctx.lineTo(wBot / 2, bot - s * 0.05);
  ctx.quadraticCurveTo(wBot / 2, bot, wBot / 2 - s * 0.06, bot);
  ctx.lineTo(-wBot / 2 + s * 0.06, bot);
  ctx.quadraticCurveTo(-wBot / 2, bot, -wBot / 2, bot - s * 0.05);
  ctx.closePath();
  if (rainbow) {
    const g = ctx.createLinearGradient(-wTop / 2, 0, wTop / 2, 0);
    RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, shade(base, 0.12)); g.addColorStop(1, shade(base, -0.18));
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.strokeStyle = 'rgba(30,18,60,0.35)';
  ctx.stroke();
  // band
  ctx.fillStyle = 'rgba(30,18,60,0.13)';
  ctx.fillRect(-wBot / 2 - s * 0.02, bot - s * 0.15, wBot + s * 0.04, s * 0.07);
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(-wTop * 0.28, top + s * 0.22, s * 0.05, s * 0.15, 0.15, 0, Math.PI * 2); ctx.fill();
  // rim + paint surface
  ctx.fillStyle = hidden ? '#9f98b6' : rainbow ? '#ffd23f' : shade(base, -0.28);
  ctx.beginPath(); ctx.ellipse(0, top, wTop / 2 + s * 0.02, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hidden ? '#cfc9de' : rainbow ? '#ff8ac6' : shade(base, 0.18);
  ctx.beginPath(); ctx.ellipse(0, top + s * 0.005, wTop / 2 - s * 0.05, s * 0.065, 0, 0, Math.PI * 2); ctx.fill();
  // drip
  if (!hidden) {
    ctx.fillStyle = rainbow ? '#9b5cff' : shade(base, 0.05);
    ctx.beginPath();
    ctx.moveTo(wTop * 0.18, top + s * 0.04);
    ctx.quadraticCurveTo(wTop * 0.2, top + s * 0.2, wTop * 0.26, top + s * 0.2);
    ctx.arc(wTop * 0.25, top + s * 0.2, s * 0.04, 0, Math.PI);
    ctx.lineTo(wTop * 0.32, top + s * 0.04);
    ctx.fill();
  }
  // face
  const ey = top + s * 0.24, ex = s * 0.13;
  const blink = o.blink ? 0.15 : 1;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-ex, ey, s * 0.075, s * 0.09 * blink, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.075, s * 0.09 * blink, 0, 0, Math.PI * 2); ctx.fill();
  if (blink > 0.5) {
    ctx.fillStyle = INK;
    const lx = (o.look || 0) * s * 0.025;
    ctx.beginPath(); ctx.arc(-ex + lx, ey + s * 0.015, s * 0.042, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + lx, ey + s * 0.015, s * 0.042, 0, Math.PI * 2); ctx.fill();
  }
  // number / ?
  const label = hidden ? '?' : String(n);
  const fs = Math.round(s * (label.length > 2 ? 0.26 : 0.32));
  ctx.font = `700 ${fs}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.strokeStyle = 'rgba(30,18,60,0.75)';
  ctx.lineJoin = 'round';
  const ty = top + s * 0.5;
  ctx.strokeText(label, 0, ty);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, 0, ty);
  ctx.restore();
}

// ---------------------------------------------------------------- particles
export class FX {
  constructor() { this.parts = []; this.texts = []; this.shake = 0; }
  splat(x, y, col, k = 6) {
    for (let i = 0; i < k; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 120;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: 1.2 + Math.random() * 2.4, col, life: 0.45 + Math.random() * 0.3, t: 0, g: 380, kind: 'dot' });
    }
  }
  confetti(x, y, k = 40, spread = 1) {
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread, v = 180 + Math.random() * 320;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3 + Math.random() * 4, col: RAINBOW[i % RAINBOW.length], life: 1.4 + Math.random() * 0.8, t: 0, g: 420, kind: 'rect', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
    }
  }
  ring(x, y, col, r = 30) { this.parts.push({ x, y, col, life: 0.4, t: 0, kind: 'ring', r }); }
  text(x, y, s, col = '#fff', size = 18) {
    const half = s.length * size * 0.32 + 6;
    x = Math.max(half, Math.min(window.innerWidth - half, x));
    this.texts.push({ x, y, s, col, size, t: 0, life: 0.9 });
  }
  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      if (p.kind !== 'ring') { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.99; if (p.rot !== undefined) p.rot += p.vr * dt; }
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < t.life);
    this.shake = Math.max(0, this.shake - dt * 30);
  }
  draw(ctx) {
    for (const p of this.parts) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.5));
      if (p.kind === 'dot') { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      else if (p.kind === 'rect') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore(); }
      else if (p.kind === 'ring') { ctx.strokeStyle = p.col; ctx.lineWidth = 3 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + p.t / p.life), 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const a = 1 - t.t / t.life;
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `700 ${t.size}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,18,60,0.6)'; ctx.lineJoin = 'round';
      const y = t.y - t.t * 40;
      ctx.strokeText(t.s, t.x, y);
      ctx.fillStyle = t.col; ctx.fillText(t.s, t.x, y);
    }
    ctx.globalAlpha = 1;
  }
}

// Small static thumbnail of an artwork (for gallery / win card).
export function artThumb(level, size, painted = true, bg = null) {
  const c = document.createElement('canvas');
  const k = Math.max(1, Math.floor(size / Math.max(level.w, level.h)));
  c.width = level.w * k; c.height = level.h * k;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  for (let i = 0; i < level.cells.length; i++) {
    const v = level.cells[i];
    if (v < 0) continue;
    ctx.fillStyle = painted ? level.colors[v] : mix(level.colors[v], '#d9d3e6', 0.82);
    ctx.fillRect((i % level.w) * k, Math.floor(i / level.w) * k, k, k);
  }
  return c;
}
