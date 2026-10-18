// World: tile map, collision and pathfinding. Scene3D draws it.
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
    const lampTiles = [[28, 21], [33, 21], [20, 21], [10, 21], [45, 21], [56, 21], [33, 30], [33, 38], [28, 40], [33, 40],
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

    this.baked = c;
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
