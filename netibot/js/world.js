// World: tile map, collision, pathfinding and rendering of the base.
const T = { OUT: 0, SAND: 1, WALL: 2, FLOOR: 3, ROAD: 4, FENCE: 5, PAD: 6, GRASS: 7, TRACK: 8, GATE: 9 };
const TS = DATA.tile;

const World = {
  W: DATA.mapW,
  H: DATA.mapH,
  grid: [],
  objects: [],      // solid or decorative props, in px
  lamps: [],        // light sources for night time
  shelters: [],     // inner tile centers of shelters, in px
  beds: [],
  lockers: [],
  launchers: [],
  gateOpen: 0,      // 0 = closed, 1 = fully open
  gateTarget: 0,
  baked: null,

  build() {
    const { W, H } = this;
    this.grid = Array.from({ length: H }, () => new Array(W).fill(T.OUT));
    const fill = (x0, y0, x1, y1, t) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inside(x, y)) this.grid[y][x] = t;
    };
    this.objects = [];
    this.lamps = [];
    this.shelters = [];
    this.beds = [];
    this.lockers = [];

    // Base ground and fence.
    fill(2, 2, 61, 41, T.SAND);
    for (let x = 2; x <= 61; x++) { this.grid[2][x] = T.FENCE; this.grid[41][x] = T.FENCE; }
    for (let y = 2; y <= 41; y++) { this.grid[y][2] = T.FENCE; this.grid[y][61] = T.FENCE; }

    // Roads: outside highway, gate road and the inner road.
    fill(0, 42, W - 1, 44, T.ROAD);
    fill(29, 22, 32, 41, T.ROAD);
    fill(4, 22, 59, 23, T.ROAD);
    for (let x = 29; x <= 32; x++) this.grid[41][x] = T.GATE;

    // Training areas.
    fill(18, 3, 33, 11, T.GRASS);
    fill(6, 15, 30, 20, T.TRACK);
    fill(7, 16, 29, 19, T.GRASS);
    fill(34, 25, 44, 30, T.PAD);
    fill(44, 26, 49, 28, T.PAD);

    for (const L of DATA.launchers) fill(L.x - 1, L.y - 1, L.x + 3, L.y + 5, T.PAD);

    // Buildings.
    for (const b of DATA.buildings) {
      fill(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, T.FLOOR);
      for (let x = b.x; x < b.x + b.w; x++) { this.grid[b.y][x] = T.WALL; this.grid[b.y + b.h - 1][x] = T.WALL; }
      for (let y = b.y; y < b.y + b.h; y++) { this.grid[y][b.x] = T.WALL; this.grid[y][b.x + b.w - 1] = T.WALL; }
      for (const [dx, dy] of b.doors) this.grid[dy][dx] = T.FLOOR;
      if (b.shelter) this.shelters.push({ id: b.id, x: (b.x + 1.5) * TS, y: (b.y + 1.5) * TS, door: { x: (b.doors[0][0] + 0.5) * TS, y: (b.doors[0][1] + 0.5) * TS } });
    }

    const prop = (kind, tx, ty, tw, th, solid = true, extra = {}) => {
      const o = { kind, x: tx * TS, y: ty * TS, w: tw * TS, h: th * TS, solid, ...extra };
      this.objects.push(o);
      return o;
    };

    // Barracks interior: two rows of beds and lockers.
    let bedIndex = 0;
    for (const row of [25, 29.9]) {
      for (let x = 7; x <= 17; x += 2) {
        const b = prop('bed', x + 0.1, row + 0.05, 0.8, 1.9, true, { index: bedIndex++, messy: false });
        this.beds.push(b);
      }
    }
    for (let y = 27; y <= 29; y++) this.lockers.push(prop('locker', 6.05, y + 0.05, 0.7, 0.9, true, { open: false, index: y - 27 }));

    // Dining hall.
    prop('table', 6.3, 36.6, 2.4, 0.7);
    prop('table', 10.3, 36.6, 2.4, 0.7);
    prop('counter', 6.2, 38.25, 7.6, 0.6);
    // Kantina counter.
    prop('counter', 18.2, 37.3, 3.6, 0.55);
    // Office desk.
    prop('desk', 46, 35.5, 2, 0.8);
    // Hamal consoles.
    prop('console', 6.2, 6.1, 6.6, 0.8);
    prop('console', 6.2, 8.6, 1.4, 1.6);
    // Depot canister stacks.
    prop('canisters', 52.6, 25.1, 5.2, 1.4);
    prop('canisters', 52.6, 28.5, 5.2, 1.3);
    // Booth panel.
    prop('panel', 35.25, 38.95, 0.5, 0.35, false);
    // Radar dish, guard tower, flagpole, shooting targets.
    prop('radar', 15, 6, 2, 2);
    prop('tower', 58, 37, 2, 2);
    prop('flag', 39.3, 25.1, 0.4, 0.4);
    for (let i = 0; i < 5; i++) prop('target', 19.5 + i * 3, 3.3, 0.9, 0.3, false);
    prop('sign', 40, 43.2, 3, 0.6, false, { text: '← נתיבות 3 ק"מ' });

    this.launchers = DATA.launchers.map(L => {
      const o = prop('launcher', L.x + 0.15, L.y, 2.7, 4.4, true, { id: L.id, name: L.name, ammo: 20, needsReload: false, angle: 0 });
      return o;
    });

    // Street lamps.
    const lampTiles = [[28, 22], [33, 22], [20, 22], [10, 22], [45, 22], [56, 22], [33, 30], [33, 38], [28, 40], [33, 41],
      [21, 29], [21, 34], [43, 32], [49, 31], [12, 33], [40, 10], [47, 10], [54, 10], [14, 12], [36, 24], [44, 24], [57, 35]];
    for (const [x, y] of lampTiles) this.lamps.push({ x: (x + 0.5) * TS, y: (y + 0.5) * TS, r: 150 });
    for (const b of DATA.buildings) if (b.w > 3) this.lamps.push({ x: (b.x + b.w / 2) * TS, y: (b.y + b.h / 2) * TS, r: Math.max(b.w, b.h) * TS * 0.6 });

    this.bake();
  },

  inside(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; },
  tile(x, y) { return this.inside(x, y) ? this.grid[y][x] : T.OUT; },
  building(id) { return DATA.buildings.find(b => b.id === id); },

  blockedTile(tx, ty) {
    if (!this.inside(tx, ty)) return true;
    const t = this.grid[ty][tx];
    if (t === T.WALL || t === T.FENCE) return true;
    if (t === T.GATE && this.gateOpen < 0.9) return true;
    return false;
  },

  // Circle-vs-world test used by everything that walks or drives.
  blocked(x, y, r) {
    const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS);
    const y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.blockedTile(tx, ty)) continue;
        const cx = Math.max(tx * TS, Math.min(x, (tx + 1) * TS));
        const cy = Math.max(ty * TS, Math.min(y, (ty + 1) * TS));
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
      }
    }
    for (const o of this.objects) {
      if (!o.solid) continue;
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
    return false;
  },

  move(e, dx, dy) {
    let moved = false;
    if (dx && !this.blocked(e.x + dx, e.y, e.r)) { e.x += dx; moved = true; }
    if (dy && !this.blocked(e.x, e.y + dy, e.r)) { e.y += dy; moved = true; }
    e.x = Math.max(e.r, Math.min(this.W * TS - e.r, e.x));
    e.y = Math.max(e.r, Math.min(this.H * TS - e.r, e.y));
    return moved;
  },

  // Breadth-first search on tiles; returns px waypoints (tile centers).
  path(fx, fy, tx, ty) {
    const sx = Math.floor(fx / TS), sy = Math.floor(fy / TS);
    const gx = Math.floor(tx / TS), gy = Math.floor(ty / TS);
    if (sx === gx && sy === gy) return [{ x: tx, y: ty }];
    const prev = new Int32Array(this.W * this.H).fill(-1);
    const start = sy * this.W + sx;
    prev[start] = start;
    const q = [start];
    const solidObj = (cx, cy) => this.objects.some(o => o.solid && cx * TS + TS / 2 > o.x && cx * TS + TS / 2 < o.x + o.w && cy * TS + TS / 2 > o.y && cy * TS + TS / 2 < o.y + o.h);
    while (q.length) {
      const cur = q.shift();
      const cx = cur % this.W, cy = (cur / this.W) | 0;
      if (cx === gx && cy === gy) break;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + ax, ny = cy + ay;
        if (!this.inside(nx, ny)) continue;
        const ni = ny * this.W + nx;
        if (prev[ni] !== -1 || this.blockedTile(nx, ny) || solidObj(nx, ny)) continue;
        prev[ni] = cur;
        q.push(ni);
      }
    }
    const goal = gy * this.W + gx;
    if (prev[goal] === -1) return null;
    const pts = [];
    for (let c = goal; c !== start; c = prev[c]) pts.push({ x: (c % this.W) * TS + TS / 2, y: ((c / this.W) | 0) * TS + TS / 2 });
    pts.reverse();
    pts[pts.length - 1] = { x: tx, y: ty };
    return pts;
  },

  inShelter(x, y) {
    return this.shelters.some(s => Math.abs(s.x - x) < TS * 0.75 && Math.abs(s.y - y) < TS * 0.75);
  },

  nearestShelter(x, y) {
    let best = null, bd = Infinity;
    for (const s of this.shelters) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  },

  // Pre-render static ground into one big canvas.
  bake() {
    const c = document.createElement('canvas');
    c.width = this.W * TS;
    c.height = this.H * TS;
    const g = c.getContext('2d');
    const rnd = mulberry(7);
    const colors = {
      [T.OUT]: ['#c9ad78', '#c4a771', '#cdb27f'],
      [T.SAND]: ['#e2cd9c', '#dcc694', '#e6d3a6'],
      [T.FLOOR]: ['#bfbcb0', '#c4c1b5', '#bab7aa'],
      [T.ROAD]: ['#4a4a48', '#474745', '#4d4d4b'],
      [T.PAD]: ['#a7a59c', '#a2a097', '#acaaa1'],
      [T.GRASS]: ['#9fae6a', '#99a864', '#a5b470'],
      [T.TRACK]: ['#b4654a', '#ae6046', '#b96a4f'],
      [T.GATE]: ['#4a4a48'],
      [T.WALL]: ['#6e6a5e'],
      [T.FENCE]: ['#e2cd9c'],
    };
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const t = this.grid[y][x];
        const pal = colors[t];
        g.fillStyle = pal[Math.floor(rnd() * pal.length)];
        g.fillRect(x * TS, y * TS, TS, TS);
        if (t === T.SAND || t === T.OUT) {
          g.fillStyle = 'rgba(120,90,40,.12)';
          for (let i = 0; i < 3; i++) g.fillRect(x * TS + rnd() * TS, y * TS + rnd() * TS, 2, 2);
          if (rnd() < 0.03) drawShrub(g, x * TS + rnd() * TS, y * TS + rnd() * TS, rnd);
        }
        if (t === T.FLOOR) {
          g.strokeStyle = 'rgba(0,0,0,.06)';
          g.strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1);
        }
      }
    }
    // Road markings.
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.setLineDash([18, 16]);
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 43.5 * TS); g.lineTo(this.W * TS, 43.5 * TS); g.stroke();
    g.beginPath(); g.moveTo(31 * TS, 22 * TS); g.lineTo(31 * TS, 41 * TS); g.stroke();
    g.beginPath(); g.moveTo(4 * TS, 23 * TS); g.lineTo(60 * TS, 23 * TS); g.stroke();
    g.setLineDash([]);

    // Track lane line.
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 2;
    g.strokeRect(6.5 * TS, 15.5 * TS, 24 * TS, 5 * TS);

    // Walls with depth.
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const t = this.grid[y][x];
        if (t === T.WALL) {
          g.fillStyle = '#5d594f';
          g.fillRect(x * TS, y * TS, TS, TS);
          g.fillStyle = '#7d786b';
          g.fillRect(x * TS + 3, y * TS + 3, TS - 6, TS - 10);
        } else if (t === T.FENCE) {
          g.strokeStyle = '#6c6c6c';
          g.lineWidth = 2;
          g.beginPath();
          const horiz = y === 2 || y === 41;
          if (horiz) { g.moveTo(x * TS, y * TS + TS / 2); g.lineTo(x * TS + TS, y * TS + TS / 2); }
          else { g.moveTo(x * TS + TS / 2, y * TS); g.lineTo(x * TS + TS / 2, y * TS + TS); }
          g.stroke();
          g.strokeStyle = 'rgba(80,80,80,.55)';
          g.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            g.beginPath();
            if (horiz) { g.moveTo(x * TS + i * 10, y * TS + 12); g.lineTo(x * TS + i * 10 + 10, y * TS + 28); }
            else { g.moveTo(x * TS + 12, y * TS + i * 10); g.lineTo(x * TS + 28, y * TS + i * 10 + 10); }
            g.stroke();
          }
          g.fillStyle = '#555';
          g.fillRect(x * TS + TS / 2 - 3, y * TS + TS / 2 - 3, 6, 6);
        }
      }
    }

    // Shelter roofs are concrete coloured so they stand out.
    for (const b of DATA.buildings) {
      if (!b.shelter) continue;
      g.fillStyle = 'rgba(160,160,150,.35)';
      g.fillRect(b.x * TS, b.y * TS, b.w * TS, b.h * TS);
      g.fillStyle = '#e63b2e';
      g.fillRect((b.x + 1) * TS + 6, b.y * TS + 4, TS - 12, 6);
    }

    // Parade ground border.
    g.strokeStyle = '#f4f1e6';
    g.lineWidth = 3;
    g.strokeRect(35 * TS, 26 * TS, 9 * TS, 4 * TS);

    // Labels.
    g.textAlign = 'center';
    g.direction = 'rtl';
    const label = (text, x, y, size = 15) => {
      g.font = `800 ${size}px Rubik, Arial`;
      const w = g.measureText(text).width + 16;
      g.fillStyle = 'rgba(20,26,16,.75)';
      roundRect(g, x - w / 2, y - size, w, size + 10, 6);
      g.fill();
      g.fillStyle = '#f4f1e6';
      g.fillText(text, x, y);
    };
    for (const b of DATA.buildings) label(b.name, (b.x + b.w / 2) * TS, b.y * TS - 6, b.shelter ? 12 : 15);
    label('רחבת מסדרים', 39.5 * TS, 31.6 * TS);
    label('מטווח', 25.5 * TS, 12.6 * TS);
    label('מסלול כושר', 18 * TS, 18.3 * TS);
    label('עמדת שמירה', 59 * TS, 36.6 * TS, 13);
    label('כביש 25', 8 * TS, 45.6 * TS, 13);
    this.baked = c;
  },

  render(ctx, cam, now) {
    ctx.drawImage(this.baked, cam.x, cam.y, cam.w, cam.h, 0, 0, cam.w, cam.h);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    for (const o of this.objects) {
      if (o.x + o.w < cam.x - 60 || o.x > cam.x + cam.w + 60 || o.y + o.h < cam.y - 100 || o.y > cam.y + cam.h + 60) continue;
      drawProp(ctx, o, now);
    }
    drawGate(ctx, this.gateOpen);
    ctx.restore();
  },
};

// ---------- drawing helpers ----------
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawShrub(g, x, y, rnd) {
  g.fillStyle = '#7d8a4a';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(x + (rnd() - 0.5) * 10, y + (rnd() - 0.5) * 10, 4 + rnd() * 4, 0, Math.PI * 2);
    g.fill();
  }
}

function drawGate(ctx, open) {
  const x = 29 * TS, y = 41 * TS + TS / 2;
  ctx.fillStyle = '#555';
  ctx.fillRect(x - 10, y - 10, 14, 20);
  ctx.save();
  ctx.translate(x - 3, y);
  ctx.rotate(-open * Math.PI / 2.2);
  const len = 4 * TS;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#f4f1e6' : '#e63b2e';
    ctx.fillRect(i * len / 8, -4, len / 8, 8);
  }
  ctx.restore();
}

function drawProp(ctx, o, now) {
  const { x, y, w, h } = o;
  switch (o.kind) {
    case 'bed':
      ctx.fillStyle = '#3b4a2a';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = o.messy ? '#5d6e3d' : '#566a35';
      if (o.messy) {
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 18);
        ctx.lineTo(x + w - 4, y + 12);
        ctx.lineTo(x + w - 2, y + h - 6);
        ctx.lineTo(x + 6, y + h - 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e9e4d4';
        ctx.fillRect(x + 8, y + 6, w - 14, 10);
      } else {
        ctx.fillRect(x + 2, y + 16, w - 4, h - 18);
        ctx.fillStyle = '#e9e4d4';
        ctx.fillRect(x + 4, y + 3, w - 8, 11);
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.moveTo(x + 2, y + 30); ctx.lineTo(x + w - 2, y + 30); ctx.stroke();
      }
      break;
    case 'locker':
      ctx.fillStyle = o.open ? '#8b8f84' : '#6f7469';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#3f433a';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = '#d8d8d0';
      ctx.fillRect(x + w - 8, y + h / 2 - 2, 4, 4);
      break;
    case 'table':
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#e9e4d4';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 12 + i * 22, y + h / 2, 5, 0, 7); ctx.fill(); }
      break;
    case 'counter':
      ctx.fillStyle = '#9a9a92';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#c4c4bc';
      ctx.fillRect(x, y, w, 5);
      break;
    case 'desk':
      ctx.fillStyle = '#7a5a36';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#222';
      ctx.fillRect(x + 10, y + 6, 18, 12);
      break;
    case 'console':
      ctx.fillStyle = '#2c3328';
      ctx.fillRect(x, y, w, h);
      for (let i = 0; i < Math.floor(w / 22); i++) {
        ctx.fillStyle = (Math.floor(now / 400) + i) % 3 ? '#46d16b' : '#1f6f35';
        ctx.fillRect(x + 6 + i * 22, y + 6, 14, 9);
      }
      break;
    case 'canisters':
      for (let i = 0; i < Math.floor(w / 26); i++) {
        ctx.fillStyle = '#5a6a3a';
        ctx.fillRect(x + i * 26, y, 23, h);
        ctx.strokeStyle = '#2f3a1e';
        ctx.strokeRect(x + i * 26 + 0.5, y + 0.5, 22, h - 1);
        ctx.fillStyle = '#c9c18a';
        ctx.fillRect(x + i * 26 + 4, y + 6, 14, 4);
      }
      break;
    case 'panel':
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = World.gateOpen > 0.5 ? '#46d16b' : '#e63b2e';
      ctx.fillRect(x + 4, y + 3, 6, 6);
      break;
    case 'radar': {
      const cx = x + w / 2, cy = y + h / 2;
      ctx.fillStyle = '#6f746a';
      ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(now / 900);
      ctx.fillStyle = '#d8d8d0';
      ctx.fillRect(-30, -6, 60, 12);
      ctx.fillStyle = '#9aa0a8';
      ctx.fillRect(-30, -6, 60, 4);
      ctx.restore();
      break;
    }
    case 'tower':
      ctx.fillStyle = '#5a5246';
      ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
      ctx.fillStyle = '#7b7264';
      ctx.fillRect(x, y, w, 10);
      ctx.fillRect(x, y + h - 10, w, 10);
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(x + w / 2 - 6, y + h - 4, 12, 10);
      break;
    case 'flag': {
      ctx.fillStyle = '#888';
      ctx.fillRect(x + 4, y - 60, 4, 64);
      const wave = Math.sin(now / 300) * 4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 8, y - 60, 40, 26 + wave * 0.2);
      ctx.fillStyle = '#1d4fa8';
      ctx.fillRect(x + 8, y - 57, 40, 3);
      ctx.fillRect(x + 8, y - 40 + wave * 0.2, 40, 3);
      ctx.strokeStyle = '#1d4fa8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 28, y - 53); ctx.lineTo(x + 22, y - 43); ctx.lineTo(x + 34, y - 43); ctx.closePath();
      ctx.moveTo(x + 28, y - 40); ctx.lineTo(x + 22, y - 50); ctx.lineTo(x + 34, y - 50); ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'target':
      ctx.fillStyle = '#e9e4d4';
      ctx.fillRect(x, y - 30, w, 34);
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(x + w / 2, y - 18, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#e63b2e';
      ctx.beginPath(); ctx.arc(x + w / 2, y - 18, 4, 0, 7); ctx.fill();
      break;
    case 'sign':
      ctx.fillStyle = '#1e6b3c';
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 14px Rubik, Arial';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(o.text, x + w / 2, y + h - 6);
      break;
    case 'launcher':
      drawLauncher(ctx, o, now);
      break;
  }
}

function drawLauncher(ctx, o, now) {
  const { x, y, w, h } = o;
  // Truck chassis.
  ctx.fillStyle = '#3f4a2a';
  ctx.fillRect(x + 6, y, w - 12, h);
  ctx.fillStyle = '#2a2f22';
  for (const wy of [y + 20, y + h - 40, y + h - 20]) {
    ctx.fillRect(x, wy, 8, 16);
    ctx.fillRect(x + w - 8, wy, 8, 16);
  }
  // Cab.
  ctx.fillStyle = '#56653a';
  ctx.fillRect(x + 10, y + h - 44, w - 20, 40);
  ctx.fillStyle = '#9fc3d8';
  ctx.fillRect(x + 16, y + h - 14, w - 32, 7);
  // Canister pack.
  ctx.fillStyle = o.needsReload ? '#6b6b5c' : '#5a6a3a';
  ctx.fillRect(x + 12, y + 6, w - 24, h - 58);
  ctx.strokeStyle = '#2f3a1e';
  ctx.lineWidth = 1;
  const cols = 5, rows = 4;
  const cw = (w - 28) / cols, ch = (h - 66) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      ctx.fillStyle = idx < o.ammo ? '#c9c18a' : '#262a1f';
      ctx.beginPath();
      ctx.arc(x + 14 + c * cw + cw / 2, y + 10 + r * ch + ch / 2, Math.min(cw, ch) / 2 - 2, 0, 7);
      ctx.fill();
    }
  }
  if (o.needsReload) {
    ctx.fillStyle = `rgba(230,59,46,${0.5 + Math.sin(now / 200) * 0.3})`;
    ctx.font = '800 13px Rubik, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ריק', x + w / 2, y + h / 2 - 20);
  }
}

// Top-down soldier. opts: skin, hair, head ('beret'|'helmet'|'cap'|'none'), carry, tint, female.
function drawSoldier(ctx, x, y, angle, walk, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(2, 4, 15, 11, 0, 0, 7); ctx.fill();
  ctx.rotate(angle);
  const swing = Math.sin(walk) * 5;
  // Arms.
  ctx.fillStyle = opts.uniform || '#4b5a2a';
  ctx.beginPath(); ctx.ellipse(4 + swing, -12, 5, 4, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4 - swing, 12, 5, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = opts.skin || '#d9a77c';
  ctx.beginPath(); ctx.arc(8 + swing, -12, 3, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(8 - swing, 12, 3, 0, 7); ctx.fill();
  // Body.
  ctx.fillStyle = opts.uniform || '#4b5a2a';
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 14, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (opts.carry) {
    ctx.fillStyle = '#5a6a3a';
    ctx.fillRect(6, -13, 18, 26);
    ctx.strokeStyle = '#2f3a1e';
    ctx.strokeRect(6, -13, 18, 26);
    ctx.fillStyle = '#c9c18a';
    ctx.fillRect(10, -9, 10, 3);
  }
  // Head.
  ctx.fillStyle = opts.hair || '#2b1d12';
  ctx.beginPath(); ctx.arc(-1, 0, 8.5, 0, 7); ctx.fill();
  if (opts.female && opts.head !== 'helmet') {
    ctx.beginPath(); ctx.arc(-9, 0, 4, 0, 7); ctx.fill();
  }
  ctx.fillStyle = opts.skin || '#d9a77c';
  ctx.beginPath(); ctx.arc(2, 0, 6, -Math.PI / 2, Math.PI / 2); ctx.fill();
  if (opts.head === 'beret') {
    ctx.fillStyle = '#8fa6c4';
    ctx.beginPath(); ctx.ellipse(-2, -2, 9, 8, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#c9a54a';
    ctx.beginPath(); ctx.arc(2, -5, 2, 0, 7); ctx.fill();
  } else if (opts.head === 'helmet') {
    ctx.fillStyle = '#56653a';
    ctx.beginPath(); ctx.arc(-1, 0, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a4527';
    ctx.stroke();
  } else if (opts.head === 'cap') {
    ctx.fillStyle = '#3b4a2a';
    ctx.beginPath(); ctx.arc(-1, 0, 8.5, 0, 7); ctx.fill();
    ctx.fillRect(4, -6, 7, 12);
  }
  ctx.restore();
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(-30, -15, 64, 34);
  ctx.fillStyle = car.color;
  roundRect(ctx, -32, -17, 64, 34, 7);
  ctx.fill();
  ctx.fillStyle = '#1d2a33';
  ctx.fillRect(4, -13, 13, 26);
  ctx.fillRect(-24, -12, 9, 24);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(-14, -13, 18, 26);
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(29, -13, 3, 6);
  ctx.fillRect(29, 7, 3, 6);
  ctx.restore();
}
