// The repair itself: one short canvas mini-game per profession.
import { sfx, vibrate } from './audio.js';

const OUT = '#2b2233';
const TS = +new URLSearchParams(location.search).get('ts') || 1; // time scale, for testing
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

function rr(x, X, Y, W, H, R) {
  x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R);
  x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath();
}
function blob(x, cx, cy, r, fill, stroke = OUT, lw = 3) {
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill();
  if (stroke) { x.lineWidth = lw; x.strokeStyle = stroke; x.stroke(); }
}
function label(x, text, cx, cy, size = 22, color = '#fff', stroke = OUT) {
  x.font = `700 ${size}px Fredoka, Rubik, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  if (stroke) { x.lineWidth = size / 5; x.strokeStyle = stroke; x.lineJoin = 'round'; x.strokeText(text, cx, cy); }
  x.fillStyle = color; x.fillText(text, cx, cy);
}

// Coverage grid helper for paint / clean / mow
class Grid {
  constructor(x0, y0, w, h, nx, ny) { Object.assign(this, { x0, y0, w, h, nx, ny }); this.c = new Uint8Array(nx * ny); this.mask = new Uint8Array(nx * ny).fill(1); }
  stamp(px, py, r, v) {
    let changed = 0;
    const cw = this.w / this.nx, ch = this.h / this.ny;
    const i0 = Math.floor((px - r - this.x0) / cw), i1 = Math.floor((px + r - this.x0) / cw);
    const j0 = Math.floor((py - r - this.y0) / ch), j1 = Math.floor((py + r - this.y0) / ch);
    for (let j = Math.max(0, j0); j <= Math.min(this.ny - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(this.nx - 1, i1); i++) {
      const cx = this.x0 + (i + 0.5) * cw, cy = this.y0 + (j + 0.5) * ch;
      if ((cx - px) ** 2 + (cy - py) ** 2 <= r * r && this.mask[j * this.nx + i] && this.c[j * this.nx + i] !== v) { this.c[j * this.nx + i] = v; changed++; }
    }
    return changed;
  }
  frac(v) { let n = 0, t = 0; for (let i = 0; i < this.c.length; i++) if (this.mask[i]) { t++; if (this.c[i] === v) n++; } return n / t; }
}

// ---------------- Plumber: leaks, then the clog ----------------
function plumb(o) {
  const g = { time: 22 + o.skill * 1.5, hint: 'לחץ על הנזילות לפני שהכל מוצף!' };
  let W, H, pipes, leaks = [], fixed = 0, need, water = 0, spawnT = 0.3, phase = 'leaks', plunge = 0, lastY = null, dir = 0, find = null, drops = [], findT = 0;
  g.init = (w, h) => {
    W = w; H = h; need = Math.round(6 + o.diff * 6);
    pipes = [[[W * 0.12, H * 0.18], [W * 0.88, H * 0.18]], [[W * 0.2, H * 0.18], [W * 0.2, H * 0.62]], [[W * 0.2, H * 0.62], [W * 0.8, H * 0.62]], [[W * 0.8, H * 0.62], [W * 0.8, H * 0.18]], [[W * 0.5, H * 0.18], [W * 0.5, H * 0.45]], [[W * 0.5, H * 0.45], [W * 0.68, H * 0.45]]];
  };
  const spawn = () => {
    const p = pipes[Math.floor(Math.random() * pipes.length)], u = rnd(0.15, 0.85);
    const x = p[0][0] + (p[1][0] - p[0][0]) * u, y = p[0][1] + (p[1][1] - p[0][1]) * u;
    if (leaks.some(l => Math.hypot(l.x - x, l.y - y) < 40)) return;
    leaks.push({ x, y, a: rnd(-2.4, -0.7), t: 0, fixed: false }); sfx.splash();
  };
  g.update = dt => {
    if (phase === 'leaks') {
      spawnT -= dt;
      const open = leaks.filter(l => !l.fixed).length;
      if (spawnT < 0 && fixed + open < need && open < 2 + Math.round(o.diff * 2)) { spawn(); spawnT = rnd(0.5, 1.2) * (1.2 - o.diff * 0.5); }
      water = clamp(water + open * dt * (0.018 + o.diff * 0.012), 0, 1);
      for (const l of leaks) if (!l.fixed) { l.t += dt; if (Math.random() < 0.6) drops.push({ x: l.x, y: l.y, vx: Math.cos(l.a) * rnd(120, 200), vy: Math.sin(l.a) * rnd(120, 200), life: 1 }); }
      if (fixed >= need) { phase = 'clog'; g.hint = 'עכשיו הסתימה! החלק למעלה ולמטה מהר!'; sfx.pop(); }
      if (water >= 1) { g.result = 0.25; g.done = true; }
    } else if (phase === 'reveal') {
      findT += dt; if (findT > 2.2) g.done = true;
    }
    for (const d of drops) { d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
    drops = drops.filter(d => d.life > 0 && d.y < H * (1 - water * 0.55));
  };
  g.down = (x, y) => {
    if (phase === 'leaks') {
      for (const l of leaks) if (!l.fixed && Math.hypot(l.x - x, l.y - y) < 46) { l.fixed = true; fixed++; sfx.drop(); vibrate(15); return; }
    }
    lastY = y;
  };
  g.move = (x, y) => {
    if (phase !== 'clog' || lastY == null) return;
    const dy = y - lastY; lastY = y;
    const nd = Math.sign(dy);
    if (Math.abs(dy) > 2 && nd !== dir) { if (nd !== 0) { dir = nd; plunge += 0.09 - o.diff * 0.02; sfx.splash(); vibrate(8); } }
    if (plunge >= 1) { phase = 'reveal'; find = o.find; g.hint = ''; sfx.success(); g.result = clamp(1 - water * 0.9, 0.2, 1); g.finish = true; }
  };
  g.up = () => { lastY = null; };
  g.progress = () => phase === 'leaks' ? fixed / need * 0.8 : 0.8 + plunge * 0.2;
  g.draw = x => {
    // bathroom tiles
    x.fillStyle = '#d9f1fb'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#b4dcef'; x.lineWidth = 2;
    for (let i = 0; i < W; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (let j = 0; j < H; j += 40) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
    if (phase !== 'leaks') {
      // toilet + plunger
      const cx = W / 2, cy = H * 0.58;
      x.fillStyle = '#fff'; x.strokeStyle = OUT; x.lineWidth = 4;
      rr(x, cx - 60, cy - 150, 120, 80, 14); x.fill(); x.stroke();
      x.beginPath(); x.ellipse(cx, cy, 95, 55, 0, 0, Math.PI * 2); x.fill(); x.stroke();
      x.beginPath(); x.ellipse(cx, cy, 70, 36, 0, 0, Math.PI * 2); x.fillStyle = '#8fd3ff'; x.fill(); x.stroke();
      rr(x, cx - 50, cy + 40, 100, 70, 16); x.fillStyle = '#fff'; x.fill(); x.stroke();
      const bob = phase === 'clog' ? (dir > 0 ? 18 : -10) : -80;
      x.fillStyle = '#b5835a'; rr(x, cx - 7, cy - 200 + bob, 14, 170, 6); x.fill(); x.stroke();
      x.beginPath(); x.ellipse(cx, cy - 25 + bob, 42, 26, 0, Math.PI, 0); x.fillStyle = '#d8342c'; x.fill(); x.stroke();
      // pressure bar
      rr(x, 24, H - 50, W - 48, 22, 11); x.fillStyle = '#fff'; x.fill(); x.stroke();
      rr(x, 27, H - 47, (W - 54) * clamp(plunge, 0, 1), 16, 8); x.fillStyle = '#2ecc71'; x.fill();
      if (phase === 'reveal') {
        const s = clamp(findT * 3, 0, 1), bounce = Math.sin(findT * 8) * 4 * (1 - s);
        x.save(); x.translate(cx, H * 0.3 + bounce); x.scale(s, s);
        x.fillStyle = '#fffbe6'; x.strokeStyle = OUT; x.lineWidth = 4; rr(x, -W * 0.42, -60, W * 0.84, 120, 22); x.fill(); x.stroke();
        label(x, 'נמצא בצינור:', 0, -28, 22, '#e67e22', null);
        wrapText(x, find, 0, 16, W * 0.78, 24, OUT);
        x.restore();
      }
    } else {
      x.lineCap = 'round';
      for (const p of pipes) { x.strokeStyle = OUT; x.lineWidth = 30; x.beginPath(); x.moveTo(...p[0]); x.lineTo(...p[1]); x.stroke(); }
      for (const p of pipes) { x.strokeStyle = '#b0bec5'; x.lineWidth = 22; x.beginPath(); x.moveTo(...p[0]); x.lineTo(...p[1]); x.stroke(); x.strokeStyle = '#dfe7ea'; x.lineWidth = 6; x.beginPath(); x.moveTo(p[0][0], p[0][1] - 5); x.lineTo(p[1][0], p[1][1] - 5); x.stroke(); }
      for (const p of pipes) for (const pt of p) blob(x, pt[0], pt[1], 17, '#ff8a3d');
      for (const l of leaks) {
        if (l.fixed) {
          x.save(); x.translate(l.x, l.y); x.rotate(0.4);
          x.fillStyle = '#c9c9c9'; rr(x, -26, -10, 52, 20, 4); x.fill(); x.rotate(-0.8); rr(x, -26, -10, 52, 20, 4); x.fill(); x.restore();
        } else {
          const p = 1 + Math.sin(l.t * 14) * 0.15;
          blob(x, l.x, l.y, 16 * p, 'rgba(80,180,255,0.35)', null);
          blob(x, l.x, l.y, 8, '#2196f3', null);
          label(x, '!', l.x, l.y - 34 - Math.sin(l.t * 10) * 3, 26, '#ff3b30');
        }
      }
    }
    for (const d of drops) blob(x, d.x, d.y, 4, '#42a5f5', null);
    if (water > 0) {
      const top = H - water * H * 0.55;
      x.fillStyle = 'rgba(66,165,245,0.55)'; x.beginPath(); x.moveTo(0, H);
      for (let i = 0; i <= W; i += 10) x.lineTo(i, top + Math.sin(i * 0.05 + performance.now() / 300) * 5);
      x.lineTo(W, H); x.fill();
      if (water > 0.2) label(x, '🦆', W * 0.75 + Math.sin(performance.now() / 700) * 30, top - 6, 30, '#fff', null);
    }
  };
  return g;
}

function wrapText(x, text, cx, cy, maxW, size, color) {
  x.font = `700 ${size}px Fredoka, Rubik, sans-serif`; x.textAlign = 'center'; x.direction = 'rtl'; x.fillStyle = color; x.textBaseline = 'middle';
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  lines.forEach((l, i) => x.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * size * 1.2));
}

// ---------------- Electrician: connect the wires ----------------
function wires(o) {
  const COLS = [['#e74c3c', 'אדום'], ['#3498db', 'כחול'], ['#f1c40f', 'צהוב'], ['#2ecc71', 'ירוק'], ['#9b59b6', 'סגול'], ['#ff8c1a', 'כתום']];
  const NOTES = ['לא לגעת!!', 'אולי זה?', 'כחול=אדום (בערך)', 'של השכן', '???', 'פעם עבד'];
  const g = { time: 16 + o.skill * 1.5, hint: 'גרור כל חוט לצבע שלו. אל תתחשמל!' };
  let W, H, n, left, right, drag = null, zaps = 0, flash = 0, shake = 0, done = 0, bulb = 0;
  g.init = (w, h) => {
    W = w; H = h; n = 4 + Math.round(o.diff * 2);
    const ids = [...Array(n).keys()];
    const sh = [...ids].sort(() => Math.random() - 0.5);
    const top = H * 0.26, gap = (H * 0.68) / n;
    left = ids.map(i => ({ c: i, x: W * 0.14, y: top + gap * (i + 0.5), done: false }));
    const notes = [...NOTES].sort(() => Math.random() - 0.5);
    right = sh.map((c, i) => ({ c, x: W * 0.86, y: top + gap * (i + 0.5), note: i % 2 === 0 ? notes[i] : null }));
  };
  g.update = dt => { flash = Math.max(0, flash - dt * 3); shake = Math.max(0, shake - dt * 30); if (done === n) bulb = Math.min(1, bulb + dt * 2); };
  g.down = (x, y) => { const l = left.find(l => !l.done && Math.hypot(l.x - x, l.y - y) < 36); if (l) { drag = { l, x, y }; sfx.tap(); } };
  g.move = (x, y) => { if (drag) { drag.x = x; drag.y = y; } };
  g.up = () => {
    if (!drag) return;
    const r = right.find(r => Math.hypot(r.x - drag.x, r.y - drag.y) < 44);
    if (r && !r.taken) {
      if (r.c === drag.l.c) { drag.l.done = true; r.taken = true; drag.l.to = r; done++; sfx.click(); vibrate(15); if (done === n) { sfx.success(); g.result = clamp(1 - zaps * 0.22, 0.15, 1); g.finish = true; g.doneDelay = 0.9; } }
      else { zaps++; flash = 1; shake = 14; sfx.zap(); vibrate([40, 30, 60]); }
    }
    drag = null;
  };
  g.progress = () => done / n;
  g.draw = x => {
    x.save(); if (shake) x.translate(rnd(-shake, shake), rnd(-shake, shake));
    x.fillStyle = '#e8edf2'; x.fillRect(-20, -20, W + 40, H + 40);
    // panel
    x.fillStyle = '#c8d1db'; x.strokeStyle = OUT; x.lineWidth = 4; rr(x, 14, H * 0.2, W - 28, H * 0.76, 18); x.fill(); x.stroke();
    // bulb
    const bx = W / 2, by = H * 0.1;
    if (bulb) { const gr = x.createRadialGradient(bx, by, 4, bx, by, 90); gr.addColorStop(0, `rgba(255,240,140,${0.8 * bulb})`); gr.addColorStop(1, 'rgba(255,240,140,0)'); x.fillStyle = gr; x.fillRect(bx - 90, by - 90, 180, 180); }
    blob(x, bx, by, 24, bulb ? '#fff59d' : (Math.random() < 0.15 ? '#fff59d' : '#ddd'));
    x.fillStyle = '#888'; rr(x, bx - 12, by + 18, 24, 18, 4); x.fill(); x.stroke();
    x.lineCap = 'round';
    const wire = (ax, ay, bx2, by2, col) => {
      for (const [lw, c] of [[14, OUT], [9, col]]) { x.strokeStyle = c; x.lineWidth = lw; x.beginPath(); x.moveTo(ax, ay); x.bezierCurveTo(ax + 90, ay, bx2 - 90, by2, bx2, by2); x.stroke(); }
    };
    for (const l of left) if (l.done) wire(l.x, l.y, l.to.x, l.to.y, COLS[l.c][0]);
    if (drag) wire(drag.l.x, drag.l.y, drag.x, drag.y, COLS[drag.l.c][0]);
    for (const l of left) { x.fillStyle = '#555'; rr(x, l.x - 30, l.y - 14, 26, 28, 6); x.fill(); x.stroke(); blob(x, l.x, l.y, 15, COLS[l.c][0]); }
    for (const r of right) {
      blob(x, r.x, r.y, 20, '#f5f5f5'); blob(x, r.x, r.y, 12, COLS[r.c][0]);
      x.fillStyle = '#444'; rr(x, r.x + 18, r.y - 12, 18, 24, 5); x.fill();
      if (r.note) { x.save(); x.translate(r.x - 62, r.y - 22); x.rotate(-0.08); x.fillStyle = '#fff9c4'; rr(x, -48, -12, 96, 24, 4); x.fill(); label(x, r.note, 0, 1, 13, '#5d4037', null); x.restore(); }
    }
    x.restore();
    if (flash) { x.fillStyle = `rgba(255,245,120,${flash * 0.75})`; x.fillRect(0, 0, W, H); label(x, '⚡ זזזזזט! ⚡', W / 2, H / 2, 40, '#fff'); }
  };
  return g;
}

// ---------------- Locksmith: pick the pins ----------------
function lock(o) {
  const g = { time: 18 + o.skill * 1.5, hint: 'לחץ כשהפין הזוהר בקו הזהב. או... בעיטה.', kickable: true };
  let W, H, pins, cur = 0, miss = 0, flash = 0, shear, t = 0, rot = 0;
  g.init = (w, h) => {
    W = w; H = h; shear = H * 0.42;
    const n = 4 + Math.round(o.diff * 2);
    pins = [...Array(n)].map((_, i) => ({ x: W * 0.18 + (W * 0.64) * (i / (n - 1)), sp: rnd(2.2, 3.2) + o.diff * 1.6, ph: rnd(0, 6), set: false }));
  };
  const pinY = p => p.set ? shear : shear + Math.sin(t * p.sp + p.ph) * H * 0.12;
  g.update = dt => { t += dt; flash = Math.max(0, flash - dt * 3); if (g.finish) rot = Math.min(1, rot + dt * 2.5); };
  g.down = (x, y) => {
    if (g.finish) return;
    const p = pins[cur], d = Math.abs(pinY(p) - shear);
    if (d < H * (0.035 + o.skill * 0.005)) {
      p.set = true; sfx.pin(cur); vibrate(12); cur++;
      if (cur === pins.length) { sfx.click(); sfx.success(); g.result = clamp(1 - miss * 0.18, 0.2, 1); g.finish = true; g.doneDelay = 1; }
    } else {
      miss++; flash = 1; sfx.clunk(); vibrate(40);
      if (cur > 0) { pins[cur - 1].set = false; cur--; }
    }
  };
  g.progress = () => cur / pins.length;
  g.draw = x => {
    x.fillStyle = '#3b2f4a'; x.fillRect(0, 0, W, H);
    // brass cylinder body
    x.save(); x.translate(W / 2, shear); x.rotate(rot * 0.6); x.translate(-W / 2, -shear);
    x.fillStyle = '#d4a72c'; x.strokeStyle = OUT; x.lineWidth = 5; rr(x, W * 0.06, H * 0.2, W * 0.88, H * 0.5, 30); x.fill(); x.stroke();
    x.fillStyle = '#e8c35a'; rr(x, W * 0.08, shear + 6, W * 0.84, H * 0.26, 24); x.fill();
    x.restore();
    // shear line
    x.fillStyle = 'rgba(255,215,0,0.9)'; x.fillRect(W * 0.08, shear - 3, W * 0.84, 6);
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i], y = pinY(p);
      x.fillStyle = '#5c4613'; rr(x, p.x - 18, H * 0.22, 36, H * 0.46, 10); x.fill();
      // driver pin (top) and key pin (bottom), the gap between them must sit on the shear line
      const active = i === cur;
      x.fillStyle = p.set ? '#2ecc71' : active ? '#ff7043' : '#9e9e9e'; x.strokeStyle = OUT; x.lineWidth = 3;
      rr(x, p.x - 13, H * 0.23, 26, y - H * 0.23 - 4, 8); x.fill(); x.stroke();
      x.fillStyle = '#cfd8dc'; rr(x, p.x - 13, y + 4, 26, H * 0.12, 8); x.fill(); x.stroke();
      if (active && !g.finish) { const gr = x.createRadialGradient(p.x, y, 2, p.x, y, 40); gr.addColorStop(0, 'rgba(255,170,60,0.6)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = gr; x.fillRect(p.x - 40, y - 40, 80, 80); }
    }
    // the key
    x.fillStyle = '#dfe6e9'; x.strokeStyle = OUT; x.lineWidth = 3;
    rr(x, W * 0.12, H * 0.66, W * 0.7, 22, 6); x.fill(); x.stroke();
    x.beginPath(); x.arc(W * 0.86, H * 0.67, 34, 0, 7); x.fill(); x.stroke();
    blob(x, W * 0.86, H * 0.67, 12, '#3b2f4a');
    if (flash) { x.fillStyle = `rgba(255,60,60,${flash * 0.35})`; x.fillRect(0, 0, W, H); label(x, 'קליק... לא.', W / 2, H * 0.12, 30, '#fff'); }
    if (g.finish) label(x, '!נפתח', W / 2, H * 0.12, 40, '#2ecc71');
  };
  return g;
}

// ---------------- Renovator: paint the wall (and the customer changes their mind) ----------------
function paint(o) {
  const SHADES = [['#f6e7c8', 'לבן חם'], ['#a7d8f0', 'תכלת'], ['#f8b4c8', 'ורוד בייבי'], ['#c5e1a5', 'ירוק פיסטוק'], ['#ffe08a', 'צהוב שמש']];
  const g = { time: 20 + o.skill * 1.5, hint: 'צבע את כל הקיר. כן, גם את הפינות.' };
  let W, H, grid, pc, px, col, changed = false, colorId = 1, bubble = 0, last = null, brushT = 0, drops = [];
  const changes = o.diff > 0.25;
  g.init = (w, h) => {
    W = w; H = h;
    grid = new Grid(W * 0.08, H * 0.1, W * 0.84, H * 0.72, 28, 24);
    pc = document.createElement('canvas'); pc.width = W; pc.height = H; px = pc.getContext('2d');
    col = Math.floor(Math.random() * SHADES.length);
  };
  const stroke = (x, y) => {
    const r = 30 + o.skill * 2;
    px.fillStyle = SHADES[col][0]; px.beginPath();
    if (last) { px.lineCap = 'round'; px.strokeStyle = SHADES[col][0]; px.lineWidth = r * 2; px.beginPath(); px.moveTo(last[0], last[1]); px.lineTo(x, y); px.stroke(); }
    px.beginPath(); px.arc(x, y, r, 0, 7); px.fill();
    const steps = last ? Math.ceil(Math.hypot(x - last[0], y - last[1]) / 10) : 1;
    let ch = 0;
    for (let i = 0; i <= steps; i++) { const u = steps ? i / steps : 1; ch += grid.stamp(last ? last[0] + (x - last[0]) * u : x, last ? last[1] + (y - last[1]) * u : y, r, colorId); }
    if (ch && brushT <= 0) { sfx.brush(); brushT = 0.08; }
    if (Math.random() < 0.08) drops.push({ x, y: y + r, l: 0 });
    last = [x, y];
  };
  g.update = dt => {
    brushT -= dt; bubble = Math.max(0, bubble - dt);
    for (const d of drops) d.l = Math.min(40, d.l + dt * 20);
    const f = grid.frac(colorId);
    if (changes && !changed && f > 0.55) {
      changed = true; bubble = 2.6; colorId = 2;
      let n; do { n = Math.floor(Math.random() * SHADES.length); } while (n === col); col = n;
      sfx.fail(); vibrate(30);
      g.hint = `הלקוח: "רגע! אולי בכל זאת ${SHADES[col][1]}?"`;
    }
    if (f > 0.9 && !g.finish) { g.finish = true; g.result = 1; sfx.success(); g.doneDelay = 0.6; }
  };
  g.down = (x, y) => { last = null; stroke(x, y); };
  g.move = (x, y) => stroke(x, y);
  g.up = () => { last = null; };
  g.progress = () => grid.frac(colorId) / 0.9;
  g.draw = x => {
    x.fillStyle = '#d7ccc8'; x.fillRect(0, 0, W, H);
    // old wall with stains and scribbles
    x.fillStyle = '#b0a089'; rr(x, grid.x0, grid.y0, grid.w, grid.h, 8); x.fill();
    x.fillStyle = 'rgba(110,90,60,0.5)'; for (const [a, b, r] of [[0.3, 0.3, 50], [0.7, 0.6, 40], [0.45, 0.75, 30]]) { x.beginPath(); x.ellipse(grid.x0 + grid.w * a, grid.y0 + grid.h * b, r, r * 0.7, 0.4, 0, 7); x.fill(); }
    x.strokeStyle = '#e53935'; x.lineWidth = 4; x.beginPath(); x.moveTo(grid.x0 + 40, grid.y0 + grid.h - 60); x.quadraticCurveTo(grid.x0 + 80, grid.y0 + grid.h - 120, grid.x0 + 120, grid.y0 + grid.h - 50); x.stroke();
    label(x, 'יוסי + רינה', grid.x0 + grid.w * 0.62, grid.y0 + grid.h * 0.22, 20, '#1e88e5', null);
    x.save(); rr(x, grid.x0, grid.y0, grid.w, grid.h, 8); x.clip(); x.drawImage(pc, 0, 0);
    x.fillStyle = SHADES[col][0]; for (const d of drops) { rr(x, d.x - 4, d.y - 4, 8, d.l, 4); x.fill(); }
    x.restore();
    x.strokeStyle = OUT; x.lineWidth = 4; rr(x, grid.x0, grid.y0, grid.w, grid.h, 8); x.stroke();
    // floor + bucket
    x.fillStyle = '#8d6e63'; x.fillRect(0, H * 0.84, W, H * 0.16);
    x.fillStyle = '#fff'; x.strokeStyle = OUT; x.lineWidth = 3; rr(x, W * 0.08, H * 0.86, 56, 50, 8); x.fill(); x.stroke();
    x.fillStyle = SHADES[col][0]; rr(x, W * 0.08 + 4, H * 0.86 + 4, 48, 12, 5); x.fill();
    label(x, `צבע: ${SHADES[col][1]}`, W * 0.6, H * 0.91, 20, '#fff');
    if (bubble > 0) {
      const s = clamp(bubble * 3, 0, 1);
      x.save(); x.translate(W / 2, H * 0.4); x.scale(s, s);
      x.fillStyle = '#fff'; x.strokeStyle = OUT; x.lineWidth = 4; rr(x, -W * 0.4, -54, W * 0.8, 108, 20); x.fill(); x.stroke();
      wrapText(x, `רגע רגע! אולי בכל זאת ${SHADES[col][1]}? 🤔`, 0, 0, W * 0.7, 22, OUT);
      x.restore();
    }
  };
  return g;
}

// ---------------- AC tech: clean the filter, then fill gas ----------------
function ac(o) {
  const g = { time: 22 + o.skill * 1.5, hint: 'שפשף את האבק מהפילטר!' };
  let W, H, grid, dust, dx, phase = 'clean', needle = 0, holding = false, tries = 0, gasScore = 0, msg = '', msgT = 0, last = null, t = 0, hold = 0;
  let zone;
  g.init = (w, h) => {
    W = w; H = h;
    grid = new Grid(W * 0.1, H * 0.16, W * 0.8, H * 0.56, 24, 20);
    dust = document.createElement('canvas'); dust.width = W; dust.height = H; dx = dust.getContext('2d');
    dx.fillStyle = '#8d8478'; dx.fillRect(grid.x0, grid.y0, grid.w, grid.h);
    for (let i = 0; i < 400; i++) { dx.fillStyle = `rgba(${Math.random() < 0.5 ? '70,60,50' : '160,150,140'},0.5)`; dx.beginPath(); dx.arc(grid.x0 + Math.random() * grid.w, grid.y0 + Math.random() * grid.h, 3 + Math.random() * 12, 0, 7); dx.fill(); }
    const zw = 0.16 - o.diff * 0.06 + o.skill * 0.015; const zc = rnd(0.55, 0.75); zone = [zc - zw / 2, zc + zw / 2];
  };
  const rub = (x, y) => {
    const r = 26 + o.skill * 2;
    dx.globalCompositeOperation = 'destination-out';
    dx.lineCap = 'round'; dx.lineWidth = r * 2;
    if (last) { dx.beginPath(); dx.moveTo(last[0], last[1]); dx.lineTo(x, y); dx.stroke(); }
    dx.beginPath(); dx.arc(x, y, r, 0, 7); dx.fill();
    dx.globalCompositeOperation = 'source-over';
    const steps = last ? Math.ceil(Math.hypot(x - last[0], y - last[1]) / 10) : 1;
    let ch = 0; for (let i = 0; i <= steps; i++) { const u = i / steps; ch += grid.stamp(last ? last[0] + (x - last[0]) * u : x, last ? last[1] + (y - last[1]) * u : y, r, 1); }
    if (ch) sfx.brush();
    last = [x, y];
  };
  g.update = dt => {
    t += dt; msgT = Math.max(0, msgT - dt);
    if (phase === 'clean' && grid.frac(1) > 0.88) { phase = 'gas'; sfx.pop(); g.hint = 'החזק למילוי גז ושחרר באזור הירוק'; }
    if (phase === 'gas' && holding) {
      hold += dt; needle = clamp(needle + dt * (0.45 + o.diff * 0.35) * (1 + hold * 0.6), 0, 1.05);
      if (Math.random() < 0.3) sfx.hiss();
      if (needle >= 1.05) { holding = false; tries++; msg = '!פששש... יותר מדי גז'; msgT = 1.3; needle = 0; sfx.zap(); vibrate(60); if (tries >= 3) end(0.2); }
    } else if (phase === 'gas' && !holding && needle > 0 && !g.finish) needle = Math.max(0, needle - dt * 0.3);
  };
  const end = s => { gasScore = s; g.finish = true; g.result = clamp(0.35 + gasScore * 0.65 - tries * 0.1, 0.15, 1); g.doneDelay = 1.1; };
  g.down = (x, y) => { last = null; if (phase === 'clean') rub(x, y); else if (!g.finish) { holding = true; hold = 0; } };
  g.move = (x, y) => { if (phase === 'clean') rub(x, y); };
  g.up = () => {
    last = null;
    if (phase === 'gas' && holding) {
      holding = false;
      if (needle >= zone[0] && needle <= zone[1]) { msg = '!מושלם'; msgT = 2; sfx.success(); end(1 - tries * 0.25); }
      else { tries++; msg = needle < zone[0] ? 'עדיין חם פה...' : 'קצת יותר מדי'; msgT = 1.2; sfx.fail(); if (tries >= 3) end(0.3); else needle = 0; }
    }
  };
  g.progress = () => phase === 'clean' ? grid.frac(1) / 0.88 * 0.6 : 0.6 + (g.finish ? 0.4 : 0);
  g.draw = x => {
    x.fillStyle = '#e3f2fd'; x.fillRect(0, 0, W, H);
    if (phase === 'clean') {
      // the AC unit and a clean filter mesh under the dust
      x.fillStyle = '#fff'; x.strokeStyle = OUT; x.lineWidth = 4; rr(x, W * 0.05, H * 0.1, W * 0.9, H * 0.68, 22); x.fill(); x.stroke();
      x.fillStyle = '#cfe8f7'; rr(x, grid.x0, grid.y0, grid.w, grid.h, 10); x.fill();
      x.strokeStyle = '#9cc7e0'; x.lineWidth = 2;
      for (let i = grid.x0; i < grid.x0 + grid.w; i += 12) { x.beginPath(); x.moveTo(i, grid.y0); x.lineTo(i, grid.y0 + grid.h); x.stroke(); }
      for (let j = grid.y0; j < grid.y0 + grid.h; j += 12) { x.beginPath(); x.moveTo(grid.x0, j); x.lineTo(grid.x0 + grid.w, j); x.stroke(); }
      label(x, '🍕', grid.x0 + grid.w * 0.7, grid.y0 + grid.h * 0.35, 46, '#fff', null);
      label(x, '🦎', grid.x0 + grid.w * 0.25, grid.y0 + grid.h * 0.7, 40, '#fff', null);
      x.drawImage(dust, 0, 0);
      x.strokeStyle = OUT; x.lineWidth = 4; rr(x, grid.x0, grid.y0, grid.w, grid.h, 10); x.stroke();
      x.fillStyle = '#90a4ae'; rr(x, W * 0.1, H * 0.8, W * 0.8, 10, 5); x.fill();
      label(x, 'LG? SAMSUNG? תדיראן!', W / 2, H * 0.12, 16, '#90a4ae', null);
    } else {
      const cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.32;
      x.fillStyle = '#fff'; x.strokeStyle = OUT; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, R + 14, 0, 7); x.fill(); x.stroke();
      const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, ang = v => a0 + (a1 - a0) * v;
      for (const [s, e, c] of [[0, zone[0], '#ffcc80'], [zone[0], zone[1], '#2ecc71'], [zone[1], 1, '#ef5350']]) { x.strokeStyle = c; x.lineWidth = 22; x.beginPath(); x.arc(cx, cy, R - 10, ang(s), ang(e)); x.stroke(); }
      const a = ang(Math.min(1, needle)) + (holding ? rnd(-0.02, 0.02) : 0);
      x.strokeStyle = OUT; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16)); x.stroke();
      blob(x, cx, cy, 14, '#e53935');
      label(x, 'PSI', cx, cy + R * 0.45, 22, '#90a4ae', null);
      // the hold button
      const by = H * 0.86;
      x.fillStyle = holding ? '#0288d1' : '#29b6f6'; x.strokeStyle = OUT; x.lineWidth = 4; rr(x, W * 0.2, by - 32, W * 0.6, 64, 32); x.fill(); x.stroke();
      label(x, holding ? 'ממלא... 💨' : 'החזק למילוי', W / 2, by, 24, '#fff');
      label(x, `ניסיונות: ${3 - tries}`, W / 2, H * 0.08, 18, OUT, null);
    }
    if (msgT) label(x, msg, W / 2, H * 0.2, 30, '#fff');
  };
  return g;
}

// ---------------- Gardener: mow around the gnomes ----------------
function mow(o) {
  const g = { time: 20 + o.skill * 1.5, hint: 'כסח את הדשא. לא לדרוס גמדים!' };
  let W, H, grid, mx, my, tx, ty, gnomes = [], hits = 0, flash = 0, t = 0, msgT = 0, active = false, mowT = 0;
  g.init = (w, h) => {
    W = w; H = h;
    grid = new Grid(W * 0.05, H * 0.06, W * 0.9, H * 0.88, 22, 26);
    mx = tx = W / 2; my = ty = H * 0.9;
    const n = 2 + Math.round(o.diff * 3);
    for (let i = 0; i < n; i++) {
      let gx, gy, tries = 0;
      do { gx = rnd(W * 0.18, W * 0.82); gy = rnd(H * 0.18, H * 0.75); tries++; } while (tries < 40 && gnomes.some(q => Math.hypot(q.x - gx, q.y - gy) < 90));
      gnomes.push({ x: gx, y: gy, hit: 0 });
    }
    // gnome cells don't count
    for (const q of gnomes) { const cw = grid.w / grid.nx, ch = grid.h / grid.ny; for (let j = 0; j < grid.ny; j++) for (let i = 0; i < grid.nx; i++) { const cx = grid.x0 + (i + 0.5) * cw, cy = grid.y0 + (j + 0.5) * ch; if (Math.hypot(cx - q.x, cy - q.y) < 30) grid.mask[j * grid.nx + i] = 0; } }
  };
  g.update = dt => {
    t += dt; flash = Math.max(0, flash - dt * 2.5); msgT = Math.max(0, msgT - dt);
    const k = 1 - Math.exp(-dt * 12);
    const nx = mx + (tx - mx) * k, ny = my + (ty - my) * k;
    const steps = Math.ceil(Math.hypot(nx - mx, ny - my) / 8) || 1;
    let ch = 0;
    for (let i = 1; i <= steps; i++) ch += grid.stamp(mx + (nx - mx) * i / steps, my + (ny - my) * i / steps, 26 + o.skill * 2, 1);
    mx = nx; my = ny;
    if (ch) { mowT -= dt; if (mowT <= 0) { sfx.mow(); mowT = 0.07; } }
    for (const q of gnomes) {
      q.hit = Math.max(0, q.hit - dt);
      if (Math.hypot(q.x - mx, q.y - my) < 36 && !q.hit) { q.hit = 1.2; hits++; flash = 1; msgT = 1.2; sfx.clunk(); vibrate(50); tx = mx + (mx - q.x) * 1.5; ty = my + (my - q.y) * 1.5; }
    }
    if (grid.frac(1) > 0.9 && !g.finish) { g.finish = true; g.result = clamp(1 - hits * 0.2, 0.15, 1); sfx.success(); g.doneDelay = 0.6; }
  };
  g.down = (x, y) => { active = true; tx = x; ty = y - 50; };
  g.move = (x, y) => { if (active) { tx = clamp(x, 10, W - 10); ty = clamp(y - 50, 10, H - 10); } };
  g.up = () => { active = false; };
  g.progress = () => grid.frac(1) / 0.9;
  g.draw = x => {
    x.fillStyle = '#6d4c2f'; x.fillRect(0, 0, W, H);
    const cw = grid.w / grid.nx, ch = grid.h / grid.ny;
    for (let j = 0; j < grid.ny; j++) for (let i = 0; i < grid.nx; i++) {
      const cut = grid.c[j * grid.nx + i], X = grid.x0 + i * cw, Y = grid.y0 + j * ch;
      x.fillStyle = cut ? ((i % 2) ? '#9be15d' : '#8fd451') : '#3f9a2e'; x.fillRect(X, Y, cw + 0.5, ch + 0.5);
      if (!cut) { x.strokeStyle = '#2f7d22'; x.lineWidth = 2; x.beginPath(); const sw = Math.sin(t * 3 + i + j) * 2; x.moveTo(X + 4, Y + ch); x.lineTo(X + 6 + sw, Y + 2); x.moveTo(X + cw - 5, Y + ch); x.lineTo(X + cw - 7 + sw, Y + 4); x.stroke(); }
    }
    for (const q of gnomes) {
      const wob = q.hit ? Math.sin(t * 30) * 0.3 : 0;
      x.save(); x.translate(q.x, q.y); x.rotate(wob);
      x.fillStyle = '#1e88e5'; x.strokeStyle = OUT; x.lineWidth = 3; rr(x, -14, -6, 28, 26, 8); x.fill(); x.stroke();
      blob(x, 0, -14, 11, '#ffccbc');
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(-10, -10); x.lineTo(10, -10); x.lineTo(0, 8); x.fill();
      x.fillStyle = '#e53935'; x.beginPath(); x.moveTo(-13, -18); x.lineTo(13, -18); x.lineTo(0, -46); x.closePath(); x.fill(); x.stroke();
      x.restore();
      if (q.hit) label(x, '!אאוץ׳', q.x, q.y - 60, 20, '#fff');
    }
    // the mower
    x.save(); x.translate(mx, my);
    x.fillStyle = '#e53935'; x.strokeStyle = OUT; x.lineWidth = 4; rr(x, -26, -22, 52, 44, 12); x.fill(); x.stroke();
    blob(x, 0, 0, 12, '#333'); x.fillStyle = '#333'; x.fillRect(-4, 20, 8, 30);
    for (const [a, b] of [[-26, -18], [22, -18], [-26, 10], [22, 10]]) { x.fillStyle = '#222'; rr(x, a, b, 6, 10, 2); x.fill(); }
    x.restore();
    if (flash) { x.fillStyle = `rgba(255,80,80,${flash * 0.3})`; x.fillRect(0, 0, W, H); }
    if (msgT) label(x, 'דרסת גמד! הלקוח רואה הכל 👀', W / 2, H * 0.08, 20, '#fff');
  };
  return g;
}

const GAMES = { plumb, wires, lock, paint, ac, mow };

// ---------------- Shell ----------------
export function runMiniGame(kind, o) {
  return new Promise(resolve => {
    const el = document.getElementById('mg');
    const cv = el.querySelector('canvas');
    const hintEl = el.querySelector('.mg-hint');
    const bar = el.querySelector('.mg-time i');
    const prog = el.querySelector('.mg-prog i');
    const kick = el.querySelector('.mg-kick');
    el.querySelector('.mg-title').textContent = o.title;
    el.querySelector('.mg-cust').textContent = o.customer;
    el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');

    const g = GAMES[kind](o);
    kick.hidden = !g.kickable; // before measuring: the button takes room from the stage
    const wrap = el.querySelector('.mg-stage');
    // client size ignores the pop-in scale animation running on the card
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const x = cv.getContext('2d');

    g.init(W, H);
    let left = g.time, started = false, ended = false, last = performance.now(), countdown = 1.4, doneT = 0;

    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const down = e => { e.preventDefault(); if (!started || ended || g.finish && !g.kickable) return; cv.setPointerCapture?.(e.pointerId); g.down?.(...pos(e)); };
    const move = e => { e.preventDefault(); if (started && !ended) g.move?.(...pos(e)); };
    const up = e => { e.preventDefault(); if (started && !ended) g.up?.(...pos(e)); };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    kick.onclick = () => { if (!started || ended || g.finish) return; sfx.kick(); vibrate([80, 40, 80]); finish(0.35, { kicked: true }); };

    function finish(q, extra = {}) {
      if (ended) return; ended = true;
      setTimeout(() => {
        el.classList.remove('in'); el.classList.add('out');
        setTimeout(() => { el.hidden = true; cleanup(); resolve({ quality: q, ...extra }); }, 280);
      }, extra.kicked ? 500 : 250);
    }
    function cleanup() {
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
      cancelAnimationFrame(raf);
    }
    let raf;
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000) * TS; last = now;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!started) {
        countdown -= dt;
        g.draw(x);
        x.fillStyle = 'rgba(30,20,50,0.55)'; x.fillRect(0, 0, W, H);
        wrapText(x, g.hint, W / 2, H * 0.42, W * 0.8, 26, '#fff');
        label(x, countdown > 0.5 ? 'מוכן?' : '!קדימה', W / 2, H * 0.6, 44, '#ffd23a');
        if (countdown <= 0) started = true;
      } else {
        if (!ended) {
          if (!g.finish) left -= dt;
          g.update(dt);
          if (g.finish) { doneT += dt; if (doneT > (g.doneDelay ?? 0.4) && (!g.done && kind === 'plumb' ? false : true)) finish(g.result ?? 1); }
          if (g.done) finish(g.result ?? 0.3);
          if (left <= 0 && !g.finish) { sfx.fail(); finish(clamp(g.progress() * 0.75, 0.1, 0.7)); }
        } else g.update(dt);
        g.draw(x);
      }
      bar.style.transform = `scaleX(${clamp(left / g.time, 0, 1)})`;
      bar.parentElement.classList.toggle('low', left < 5);
      prog.style.transform = `scaleX(${clamp(g.progress(), 0, 1)})`;
      hintEl.textContent = g.hint;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
