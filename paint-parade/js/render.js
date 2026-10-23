// Canvas drawing: layout, board, parade belt, buckets, particles.
import { trackLength, trackPos, WILD } from './engine.js';
import { IMG, assetsReady, tintedBucket } from './assets.js';

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
  const rowsPref = H > 800 ? 4 : H > 700 ? 3 : 2;
  // Shrink buckets, belt and visible rows until the canvas gets a readable pixel size.
  // Buckets stay thumb-sized (>= 46px) if at all possible: hide a row before shrinking them further.
  const want = Math.min(11, Math.floor(Math.min((W - 90) / level.w, 22)));
  let best = null;
  for (const minB of [Math.min(46, Bmax), 34]) {
    for (let rows = rowsPref; rows >= 2 && !(best && best.ok); rows--) {
      for (let B = Bmax; B >= minB; B -= 2) {
        const r = fit(W, H, top, bottom, level, B, rows, slotsN);
        if (!best || r.cs > best.cs) best = r;
        if (r.cs >= want) { best = r; best.ok = true; break; }
      }
    }
    if (best.ok) break;
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
  const T = Math.round(Math.max(22, Math.min(34, B * 0.58)));
  const slotsH = slotS + 22 + Math.round(T * 0.35);
  const gap = 4;
  const availW = W - 14 - 2 * (T + gap);
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
  const im = IMG.bg_play;
  if (im) {
    // cover-fit the painted studio, then a soft veil so the board reads first
    const s = Math.max(L.W / im.naturalWidth, L.H / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (L.W - w) / 2, (L.H - h) / 2, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, L.H);
    g.addColorStop(0, 'rgba(255,248,255,0.30)');
    g.addColorStop(0.45, 'rgba(255,248,255,0.12)');
    g.addColorStop(1, 'rgba(250,240,255,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.W, L.H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, L.H);
    g.addColorStop(0, theme[0]); g.addColorStop(1, theme[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.W, L.H);
  }
  // drifting dust motes in the window light
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const x = ((i * 97.3 + t * (6 + (i % 5) * 2)) % (L.W + 40)) - 20;
    const y = (i * 61.7 + Math.sin(t * 0.6 + i) * 18 + L.H * 0.05) % L.H;
    const a = 0.25 + 0.25 * Math.sin(t * 1.3 + i * 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff8e6';
    ctx.beginPath(); ctx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2); ctx.fill();
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

function tile(ctx, x, y, s, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, s, s, r); else ctx.rect(x, y, s, s);
}

// Pixels are little glossy tiles: vivid once painted, matte paper while grey.
export function paintCell(cache, level, L, i, vis, maxCoats, exp) {
  const ctx = cache.ctx, cs = L.cs;
  const x = (i % level.w) * cs, y = Math.floor(i / level.w) * cs;
  const c = level.cells[i];
  ctx.clearRect(x, y, cs, cs);
  if (c < 0) return;
  const col = level.colors[c];
  const left = vis[i];
  const g = cs >= 9 ? Math.max(0.6, cs * 0.07) : 0;
  const s = cs - g * 2, tx = x + g, ty = y + g, r = cs >= 9 ? cs * 0.2 : 0;
  if (left <= 0) {
    const gr = ctx.createLinearGradient(0, ty, 0, ty + s);
    gr.addColorStop(0, shade(col, 0.2)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.16));
    ctx.fillStyle = gr;
    tile(ctx, tx, ty, s, r); ctx.fill();
    if (cs >= 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      tile(ctx, tx + s * 0.14, ty + s * 0.1, s * 0.42, r * 0.6); ctx.fill();
    }
    return;
  }
  const partial = maxCoats[i] > 1 && left < maxCoats[i];
  const ready = !exp || exp[i];
  ctx.fillStyle = mix(col, PAPER, partial ? 0.38 : ready ? 0.55 : 0.86);
  tile(ctx, tx, ty, s, r); ctx.fill();
  if (ready && cs >= 6) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(1, cs * 0.09);
    tile(ctx, tx + ctx.lineWidth / 2, ty + ctx.lineWidth / 2, s - ctx.lineWidth, r); ctx.stroke();
  }
  if (maxCoats[i] > 1 && !partial) {
    ctx.save();
    tile(ctx, tx, ty, s, r); ctx.clip();
    ctx.strokeStyle = mix(col, PAPER, 0.3);
    ctx.lineWidth = Math.max(1, cs * 0.14);
    for (let k = -cs; k < cs * 2; k += cs * 0.5) { ctx.beginPath(); ctx.moveTo(x + k, y + cs); ctx.lineTo(x + k + cs, y); ctx.stroke(); }
    ctx.restore();
  }
  if (cs >= 7) {
    ctx.fillStyle = ready ? col : mix(col, PAPER, 0.55);
    ctx.beginPath(); ctx.arc(x + cs / 2, y + cs / 2, Math.max(1.4, cs * (ready ? 0.2 : 0.11)), 0, Math.PI * 2); ctx.fill();
    if (ready && cs >= 10) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(x + cs / 2 - cs * 0.06, y + cs / 2 - cs * 0.06, cs * 0.06, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// A painter's frame: warm wood with a gold lip around a paper canvas.
export function drawBoardFrame(ctx, L) {
  const pad = Math.max(7, L.cs * 0.75);
  const x = L.bx - pad, y = L.by - pad, w = L.bw + pad * 2, h = L.bh + pad * 2;
  ctx.save();
  ctx.shadowColor = 'rgba(60,30,80,0.35)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 9;
  const wood = ctx.createLinearGradient(0, y, 0, y + h);
  wood.addColorStop(0, '#f0c48e'); wood.addColorStop(0.5, '#d29457'); wood.addColorStop(1, '#a8673a');
  ctx.fillStyle = wood;
  rr(ctx, x, y, w, h, pad * 0.9); ctx.fill();
  ctx.restore();
  // bevel
  ctx.strokeStyle = 'rgba(255,236,200,0.8)'; ctx.lineWidth = 2;
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, pad * 0.85); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,45,20,0.35)'; ctx.lineWidth = 1.5;
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, pad * 0.9); ctx.stroke();
  // gold lip
  const lip = Math.max(2, pad * 0.28);
  ctx.fillStyle = '#ffd77a';
  rr(ctx, L.bx - lip, L.by - lip, L.bw + lip * 2, L.bh + lip * 2, lip * 1.5); ctx.fill();
  ctx.strokeStyle = '#c98d1c'; ctx.lineWidth = 1;
  rr(ctx, L.bx - lip, L.by - lip, L.bw + lip * 2, L.bh + lip * 2, lip * 1.5); ctx.stroke();
  // paper
  const paper = ctx.createLinearGradient(L.bx, L.by, L.bx + L.bw, L.by + L.bh);
  paper.addColorStop(0, '#fffaf1'); paper.addColorStop(1, '#f1e8da');
  ctx.fillStyle = paper;
  ctx.fillRect(L.bx, L.by, L.bw, L.bh);
  ctx.fillStyle = 'rgba(130,95,60,0.06)';
  for (let i = 1; i < L.bw / L.cs; i++) ctx.fillRect(L.bx + i * L.cs - 0.5, L.by, 1, L.bh);
  for (let j = 1; j < L.bh / L.cs; j++) ctx.fillRect(L.bx, L.by + j * L.cs - 0.5, L.bw, 1);
  // inner shadow so the canvas sits inside the frame
  const sh = ctx.createLinearGradient(0, L.by, 0, L.by + Math.min(18, L.bh * 0.1));
  sh.addColorStop(0, 'rgba(90,50,20,0.18)'); sh.addColorStop(1, 'rgba(90,50,20,0)');
  ctx.fillStyle = sh; ctx.fillRect(L.bx, L.by, L.bw, Math.min(18, L.bh * 0.1));
}

// ---------------------------------------------------------------- belt
export function drawBelt(ctx, L, phase, danger) {
  const b = L.belt;
  const rail = Math.max(3, b.T * 0.16);
  ctx.save();
  // metal rails (outer ring)
  ctx.shadowColor = 'rgba(40,20,70,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.beginPath();
  rrPath(ctx, b.x, b.y, b.w, b.h, b.r);
  rrPath(ctx, b.x + b.T, b.y + b.T, b.w - 2 * b.T, b.h - 2 * b.T, Math.max(4, b.r - b.T * 0.7));
  const metal = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  metal.addColorStop(0, danger ? '#ffb3bd' : '#efeaf8'); metal.addColorStop(0.5, danger ? '#e0607a' : '#b9b0d3'); metal.addColorStop(1, danger ? '#b33a55' : '#8a80a8');
  ctx.fillStyle = metal;
  ctx.fill('evenodd');
  ctx.restore();
  // rubber belt surface between the rails
  ctx.save();
  ctx.beginPath();
  rrPath(ctx, b.x + rail, b.y + rail, b.w - 2 * rail, b.h - 2 * rail, Math.max(4, b.r - rail));
  rrPath(ctx, b.x + b.T - rail, b.y + b.T - rail, b.w - 2 * (b.T - rail), b.h - 2 * (b.T - rail), Math.max(3, b.r - b.T * 0.6));
  const rub = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  rub.addColorStop(0, '#4b4170'); rub.addColorStop(1, '#2e2648');
  ctx.fillStyle = rub;
  ctx.fill('evenodd');
  ctx.clip('evenodd');
  // moving treads: short ribs across the belt, sliding with the parade
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = Math.max(1.5, b.T * 0.08);
  const n = L.track.length;
  const half = b.T / 2;
  for (let f = (phase % 0.5) - 0.5; f < n; f += 0.5) {
    const p = trackPoint(L, f);
    if (p.y > L.by + L.bh || p.y < L.by) { if (p.x < L.bx || p.x > L.bx + L.bw) continue; ctx.beginPath(); ctx.moveTo(p.x, p.y - half); ctx.lineTo(p.x, p.y + half); ctx.stroke(); }
    else if (p.x < L.bx || p.x > L.bx + L.bw) { ctx.beginPath(); ctx.moveTo(p.x - half, p.y); ctx.lineTo(p.x + half, p.y); ctx.stroke(); }
  }
  ctx.restore();
  // rail highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); rrPath(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, b.r); ctx.stroke();
  // corner rollers
  const off = L.gap + L.T / 2;
  const corners = [[L.bx - off, L.by - off], [L.bx + L.bw + off, L.by - off], [L.bx + L.bw + off, L.by + L.bh + off], [L.bx - off, L.by + L.bh + off]];
  for (const [cx, cy] of corners) {
    const R = b.T * 0.36;
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.6, '#f2c14e'); g.addColorStop(1, '#b8861b');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,10,0.6)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const a = phase * 0.9 + k * (Math.PI * 2 / 3);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.75, cy + Math.sin(a) * R * 0.75); ctx.stroke();
    }
  }
  // entry chevrons
  const e = L.track[0];
  ctx.save();
  ctx.translate(e.x + b.T * 0.55, e.y);
  ctx.fillStyle = '#fff';
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = 0.25 + 0.6 * ((Math.sin(phase * 1.5 - k) + 1) / 2);
    const xx = k * b.T * 0.22;
    ctx.beginPath(); ctx.moveTo(xx, -b.T * 0.16); ctx.lineTo(xx + b.T * 0.14, 0); ctx.lineTo(xx, b.T * 0.16); ctx.closePath(); ctx.fill();
  }
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
  if (!assetsReady()) return drawBucketVector(ctx, x, y, s, col, n, o);
  const hidden = o.hidden, rainbow = col === WILD;
  const spr = rainbow && IMG.rainbow ? IMG.rainbow : tintedBucket(hidden ? '#cdc6dd' : rainbow ? '#ffffff' : col);
  const sq = o.squash || 0;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(1 + sq * 0.12, 1 - sq * 0.12);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const H = s * 1.12, W = H * (spr.width / spr.height);
  const top = s * 0.46 - H;
  // contact shadow
  ctx.fillStyle = 'rgba(30,18,60,0.25)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.47, s * 0.3, s * 0.065, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(spr, -W / 2, top, W, H);
  if (o.glow) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (o.alpha ?? 1) * 0.18 * o.glow;
    ctx.drawImage(spr, -W / 2, top, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = o.alpha !== undefined ? o.alpha : 1;
  }
  // face
  const ey = top + H * 0.62, ex = s * 0.135;
  if (o.sleepy && !hidden) {
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.6, s * 0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-ex, ey - s * 0.03, s * 0.065, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey - s * 0.03, s * 0.065, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    const zt = ((o.t || 0) * 0.8) % 1;
    ctx.globalAlpha *= 1 - zt * 0.6;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.font = `700 ${Math.round(s * (0.22 + zt * 0.08))}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const zx = W * 0.38 + zt * s * 0.1, zy = top + H * 0.12 - zt * s * 0.2;
    ctx.strokeText('z', zx, zy); ctx.fillText('z', zx, zy);
    ctx.globalAlpha = o.alpha !== undefined ? o.alpha : 1;
  } else {
    const blink = o.blink ? 0.12 : 1;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(30,18,60,0.55)'; ctx.lineWidth = Math.max(1, s * 0.018);
    for (const sx of [-ex, ex]) { ctx.beginPath(); ctx.ellipse(sx, ey, s * 0.085, s * 0.1 * blink, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (blink > 0.5) {
      const lx = (o.look || 0) * s * 0.025;
      ctx.fillStyle = INK;
      for (const sx of [-ex, ex]) { ctx.beginPath(); ctx.arc(sx + lx, ey + s * 0.018, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff';
      for (const sx of [-ex, ex]) { ctx.beginPath(); ctx.arc(sx + lx - s * 0.018, ey - s * 0.004, s * 0.017, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // number
  const label = hidden ? '?' : String(n);
  const fs = Math.round(s * (label.length > 2 ? 0.27 : 0.33));
  ctx.font = `700 ${fs}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, s * 0.085);
  ctx.strokeStyle = 'rgba(30,18,60,0.85)';
  const ty = top + H * 0.86;
  ctx.strokeText(label, 0, ty);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, 0, ty);
  ctx.restore();
}

function drawBucketVector(ctx, x, y, s, col, n, o = {}) {
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
  if (o.sleepy && !hidden) {
    // closed eyes + floating z: "my color is buried, I can't paint yet"
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-ex, ey - s * 0.02, s * 0.06, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey - s * 0.02, s * 0.06, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    const zt = ((o.t || 0) * 0.8) % 1;
    ctx.globalAlpha *= 1 - zt * 0.6;
    ctx.fillStyle = INK;
    ctx.font = `700 ${Math.round(s * (0.2 + zt * 0.08))}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('z', wTop * 0.42 + zt * s * 0.1, top - s * 0.05 - zt * s * 0.22);
    ctx.globalAlpha = o.alpha !== undefined ? o.alpha : 1;
  }
  const blink = o.sleepy && !hidden ? 0 : o.blink ? 0.15 : 1;
  ctx.fillStyle = '#fff';
  if (blink > 0) {
    ctx.beginPath(); ctx.ellipse(-ex, ey, s * 0.075, s * 0.09 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.075, s * 0.09 * blink, 0, 0, Math.PI * 2); ctx.fill();
  }
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
  // a thin ring of paint that spreads where a splash lands
  ripple(x, y, col, r = 12) { this.parts.push({ x, y, col, life: 0.32, t: 0, kind: 'ripple', r }); }
  // twinkling four-point stars
  sparkle(x, y, k = 8, spread = 60, cols = ['#ffffff', '#fff3b0', '#ffd23f']) {
    for (let i = 0; i < k; i++) {
      const a = Math.random() * Math.PI * 2, v = spread * (0.5 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spread * 0.4, r: 3 + Math.random() * 4, col: cols[i % cols.length], life: 0.6 + Math.random() * 0.4, t: 0, g: 60, kind: 'star', rot: Math.random() * 3, vr: (Math.random() - 0.5) * 6, drag: 0.94 });
    }
  }
  // firework: a ring of glowing sparks that fall and fade
  burst(x, y, cols = RAINBOW, k = 34, v0 = 260) {
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + Math.random() * 0.2, v = v0 * (0.75 + Math.random() * 0.35);
      this.parts.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + Math.random() * 1.6, col: cols[i % cols.length], life: 0.9 + Math.random() * 0.4, t: 0, g: 160, kind: 'spark', drag: 0.955 });
    }
    this.parts.push({ x, y, col: '#ffffff', life: 0.25, t: 0, kind: 'flash', r: v0 * 0.22 });
  }
  text(x, y, s, col = '#fff', size = 18) {
    const half = s.length * size * 0.32 + 6;
    x = Math.max(half, Math.min(window.innerWidth - half, x));
    this.texts.push({ x, y, s, col, size, t: 0, life: 1.0 });
  }
  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      if (p.vx === undefined) continue;
      if (p.kind === 'spark') { p.px = p.x; p.py = p.y; }
      const drag = p.drag || 0.99;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= drag; if (p.drag) p.vy *= drag;
      if (p.rot !== undefined) p.rot += p.vr * dt;
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
      else if (p.kind === 'ripple') {
        const k = p.t / p.life, e = 1 - (1 - k) * (1 - k);
        ctx.globalAlpha = a * 0.9; ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1, 2.6 * a);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.3 + e), 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'star') {
        const tw = 0.6 + 0.4 * Math.sin(p.t * 30 + p.r);
        starPath(ctx, p.x, p.y, p.r * tw * (a < 0.3 ? a / 0.3 : 1), p.rot);
        ctx.fillStyle = p.col; ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = p.col; ctx.lineCap = 'round'; ctx.lineWidth = p.r * (0.5 + a * 0.8);
        ctx.beginPath(); ctx.moveTo(p.px - (p.x - p.px) * 2, p.py - (p.y - p.py) * 2); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.55 * a, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'flash') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (1 + p.t / p.life));
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const a = 1 - t.t / t.life;
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `700 ${t.size}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,18,60,0.6)'; ctx.lineJoin = 'round';
      const y = t.y - Math.max(0, t.t - 0.15) * 46;
      const k = Math.min(1, t.t / 0.28);
      const sc = k < 1 ? 0.3 + 0.7 * (1 + 1.6 * Math.pow(k - 1, 3) + 0.6 * Math.pow(k - 1, 2)) : 1;
      ctx.save(); ctx.translate(t.x, y); ctx.scale(sc, sc);
      ctx.strokeText(t.s, 0, 0);
      ctx.fillStyle = t.col; ctx.fillText(t.s, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function starPath(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + i * Math.PI / 4, rr2 = i % 2 ? r * 0.38 : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
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
