// World: tile map, collision and pathfinding. Scene3D draws it.
const T = { OUT: 0, SAND: 1, WALL: 2, FLOOR: 3, ROAD: 4, FENCE: 5, PAD: 6, GRASS: 7, TRACK: 8, GATE: 9 };
const TS = DATA.tile;

const World = {
  W: DATA.mapW,
  H: DATA.mapH,
  id: 'netivot',
  def: null,        // DATA.maps entry for the current site
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
  cache: {},

  // Switch to a site. Each site is built once and keeps its state (beds, launchers, containers).
  use(id) {
    if (!this.cache[id]) this.cache[id] = this.build(id);
    Object.assign(this, this.cache[id]);
    this.id = id;
    this.gateOpen = this.gateTarget = 0;
  },

  build(id) {
    const { W, H } = this;
    const site = {
      id, def: DATA.maps[id], grid: Array.from({ length: H }, () => new Array(W).fill(T.OUT)),
      objects: [], lamps: [], shelters: [], beds: [], lockers: [], launchers: [], baked: null,
      fence: DATA.maps[id].fence || [2, 2, 61, 41],
    };
    const g = site.grid;
    const fill = (x0, y0, x1, y1, t) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.inside(x, y)) g[y][x] = t;
    };
    const prop = (kind, tx, ty, tw, th, solid = true, extra = {}) => {
      const o = { kind, x: tx * TS, y: ty * TS, w: tw * TS, h: th * TS, solid, ...extra };
      site.objects.push(o);
      return o;
    };
    const lamp = (x, y) => site.lamps.push({ x: (x + 0.5) * TS, y: (y + 0.5) * TS, r: 150 });

    // Every site has a fenced rectangle with the gate at the bottom on the access road.
    const [fx0, fy0, fx1, fy1] = site.fence;
    fill(fx0, fy0, fx1, fy1, T.SAND);
    // Hafetz Haim is in the green Shfela near Gedera, not the desert.
    if (id === 'hq') fill(fx0 + 1, fy0 + 1, fx1 - 1, fy1 - 1, T.GRASS);
    for (let x = fx0; x <= fx1; x++) { g[fy0][x] = T.FENCE; g[fy1][x] = T.FENCE; }
    for (let y = fy0; y <= fy1; y++) { g[y][fx0] = T.FENCE; g[y][fx1] = T.FENCE; }
    fill(0, 42, W - 1, 44, T.ROAD);
    site.roads = DATA.maps[id].roads || [[29, 22, 32, 41], [4, 22, 59, 23]];
    for (const [x0, y0, x1, y1] of site.roads) fill(x0, y0, x1, y1, T.ROAD);
    for (let x = 29; x <= 32; x++) g[41][x] = T.GATE;

    const def = site.def;
    if (id === 'netivot') {
      fill(13, 9, 26, 13, T.GRASS);
      fill(13, 14, 26, 19, T.TRACK);
      fill(14, 15, 25, 18, T.GRASS);
      fill(35, 23, 42, 27, T.PAD);
      for (const L of def.launchers) fill(L.x - 1, L.y - 1, L.x + 3, L.y + 5, T.PAD);
    } else if (id === 'hq') {
      fill(5, 34, 16, 40, T.PAD);
      fill(20, 13, 23, 16, T.PAD);
    } else if (id === 'field') {
      for (const it of DATA.deploy) fill(it.x, it.y, it.x + it.w - 1, it.y + it.h - 1, T.PAD);
    }

    for (const b of def.buildings) {
      fill(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, T.FLOOR);
      for (let x = b.x; x < b.x + b.w; x++) { g[b.y][x] = T.WALL; g[b.y + b.h - 1][x] = T.WALL; }
      for (let y = b.y; y < b.y + b.h; y++) { g[y][b.x] = T.WALL; g[y][b.x + b.w - 1] = T.WALL; }
      for (const [dx, dy] of b.doors) g[dy][dx] = T.FLOOR;
      if (b.shelter) site.shelters.push({ id: b.id, x: (b.x + 1.5) * TS, y: (b.y + 1.5) * TS, door: { x: (b.doors[0][0] + 0.5) * TS, y: (b.doors[0][1] + 0.5) * TS } });
      if (b.w > 3) site.lamps.push({ x: (b.x + b.w / 2) * TS, y: (b.y + b.h / 2) * TS, r: Math.max(b.w, b.h) * TS * 0.6 });
    }

    // Bus stop for travelling between sites.
    const [sx, sy] = DATA.travelStop;
    prop('busstop', sx + 0.6, sy - 0.2, 1.4, 0.5, false);

    if (id === 'netivot') {
      // Two sleeping rooms, boys and girls: 8 beds and 3 lockers each.
      let bedIndex = 0, lockerIndex = 0;
      for (const [room, y0] of [['boys', 20], ['girls', 27]]) {
        for (const top of [true, false]) {
          for (const x of [16.2, 17.9, 19.6, 21.1]) site.beds.push(prop('bed', x, y0 + (top ? 1.05 : 4.05), 0.8, 1.9, true, { index: bedIndex++, messy: false, room, top }));
        }
        for (const dy of [1.1, 2.05, 4.05]) site.lockers.push(prop('locker', 14.05, y0 + dy, 0.7, 0.9, true, { open: false, index: lockerIndex++, room }));
      }
      prop('table', 21.1, 36.2, 1.6, 0.7);
      prop('table', 24.3, 36.2, 1.6, 0.7);
      prop('counter', 21.2, 38.35, 4.6, 0.5);
      // Kitchenette: fridge, stove, counter and a small table.
      prop('fridge', 14.1, 35.1, 0.9, 0.8);
      prop('stove', 15.2, 35.1, 1.0, 0.7);
      prop('counter', 16.3, 35.1, 1.6, 0.6);
      prop('table', 14.4, 37.1, 1.6, 0.7);
      prop('desk', 46.5, 32.3, 2, 0.8);
      prop('console', 36.2, 17.1, 5.6, 0.8);
      prop('console', 36.2, 19.0, 1.4, 1.6);
      prop('canisters', 45.8, 24.1, 3.9, 1.3);
      prop('canisters', 45.8, 27.5, 3.9, 1.3);
      prop('panel', 35.25, 38.95, 0.5, 0.35, false);
      prop('radar', 43.6, 17.4, 2, 2);
      prop('tower', 48.6, 37.3, 2, 2);
      prop('flag', 38.3, 23.1, 0.4, 0.4);
      for (let i = 0; i < 5; i++) prop('target', 14.6 + i * 2.6, 9.3, 0.9, 0.3, false, i ? {} : { berm: [20, 28] });
      prop('sign', 40, 43.2, 3, 0.6, false, { text: '← נתיבות 3 ק"מ' });
      prop('pullup', 14.2, 39.5, 1.8, 0.4, false);
      prop('generator', 45.2, 37.5, 1.6, 0.9);
      // The storeroom nobody has touched in years.
      for (const j of DATA.junk) site.objects.push({ kind: 'junk', junk: j.id, x: j.at[0] * TS, y: j.at[1] * TS, w: 0.9 * TS, h: 0.9 * TS, solid: false, gone: false });
      for (const [x, y] of [[27, 24], [33, 22], [43, 29], [27, 38], [34, 34], [48, 21], [25, 32]]) prop('palm', x + 0.25, y + 0.25, 0.5, 0.5, true);
      site.launchers = def.launchers.map(L => prop('launcher', L.x + 0.15, L.y, 2.7, 4.4, true, { id: L.id, name: L.name, ammo: 20, needsReload: false }));
      for (const [x, y] of [[28, 17], [33, 17], [28, 25], [33, 25], [28, 33], [33, 32], [28, 40], [33, 40], [23, 32], [27, 19],
        [43, 22], [43, 30], [34, 14], [45, 16], [41, 22], [19, 40], [37, 40], [47, 40]]) lamp(x, y);
    } else if (id === 'hq') {
      prop('console', 6.2, 6.1, 11.6, 0.8);
      prop('screens', 6.4, 5.2, 11.2, 0.4, false);
      prop('console', 8, 9.2, 6, 0.8);
      prop('desk', 24.5, 5.2, 3, 0.9);
      prop('flag', 29.4, 11.4, 0.4, 0.4);
      prop('desk', 33.4, 6.4, 2.2, 0.8);
      prop('counter', 42.2, 9.3, 7.6, 0.6);
      prop('canisters', 42.4, 5.1, 7.2, 0.8);
      prop('canisters', 57, 5.2, 2.6, 5.4);
      prop('bed', 6.3, 26.1, 0.8, 1.9, true, { messy: false });
      prop('bed', 8.3, 26.1, 0.8, 1.9, true, { messy: false });
      prop('counter', 15.4, 30.2, 8.4, 0.6);
      prop('table', 16.4, 27.4, 3, 0.7);
      prop('table', 20.4, 27.4, 3, 0.7);
      prop('console', 37.2, 26.1, 6.6, 0.8);
      for (let x = 48; x <= 56; x += 2) prop('bed', x + 0.1, 28.9, 0.8, 1.9, true, { messy: false });
      // A kitchenette corner in the barracks, and the canteen counter.
      prop('fridge', 57.1, 26.1, 0.9, 0.8);
      prop('stove', 55.9, 26.1, 1.0, 0.7);
      prop('counter', 39.2, 35.6, 3.6, 0.55);
      // Hidden behind the shelves of the rasap's storeroom. Nobody knows about it. Officially.
      prop('snackcab', 49.0, 6.6, 0.9, 1.2);
      prop('radar', 21, 14, 2, 2);
      prop('generator', 17.6, 13.2, 1.6, 0.9);
      prop('truck', 6, 35.2, 2.4, 4.6, true, { color: 0x56653a });
      prop('truck', 10, 35.2, 2.4, 4.6, true, { color: 0x4f5a3a });
      prop('sign', 40, 43.2, 3, 0.6, false, { text: '← גדרה 4 ק"מ' });
      for (const [x, y] of [[30, 13], [38, 13], [19, 21], [3, 24], [60, 20], [33, 18], [55, 34], [4, 18], [58, 13], [23, 38]]) prop('tree', x + 0.25, y + 0.25, 0.5, 0.5, true);
      for (const [x, y] of [[28, 21], [33, 21], [20, 21], [10, 21], [45, 21], [56, 21], [33, 30], [33, 38], [28, 40], [33, 40], [17, 34], [24, 12], [40, 12], [50, 33]]) lamp(x, y);
    } else if (id === 'field') {
      prop('sign', 40, 43.2, 3, 0.6, false, { text: 'אתר פריסה' });
      for (const [x, y] of [[28, 21], [33, 21], [33, 30], [33, 38], [28, 40]]) lamp(x, y);
      // Containers already placed on an earlier visit.
      for (const id2 of (G.state && G.state.deploy && G.state.deploy.placed) || []) this.placeContainer(site, DATA.deploy.find(d => d.id === id2));
    }
    this.bake(site);
    return site;
  },

  // Put a deployed container (or the launcher/shelter) on its pad in the field site.
  // The prop a deployed item becomes on its pad (also drawn hanging from the crane).
  containerObject(item) {
    const o = { kind: item.kind || 'container', deployId: item.id, label: item.name, color: item.color, x: (item.x + 0.3) * TS, y: (item.y + 0.3) * TS, w: (item.w - 0.6) * TS, h: (item.h - 0.6) * TS, solid: true };
    if (item.kind === 'launcher') Object.assign(o, { ammo: 20, needsReload: false, name: item.name, x: (item.x + 0.15) * TS, y: item.y * TS, w: 2.7 * TS, h: 4.4 * TS });
    return o;
  },
  placeContainer(site, item) {
    const s = site || this;
    if (s.objects.some(o => o.deployId === item.id)) return;
    const o = this.containerObject(item);
    s.objects.push(o);
    if (item.kind === 'launcher') s.launchers.push(o);
    if (item.kind === 'shelter') {
      // A field shelter is a solid block you can't stand in, so its door spot counts as cover.
      o.solid = true;
      s.shelters.push({ id: item.id, x: (item.x + item.w / 2) * TS, y: (item.y + item.h + 0.4) * TS, door: { x: (item.x + item.w / 2) * TS, y: (item.y + item.h + 0.4) * TS } });
    }
    return o;
  },

  inside(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; },
  tile(x, y) { return this.inside(x, y) ? this.grid[y][x] : T.OUT; },
  building(id) { return this.def.buildings.find(b => b.id === id); },

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
  bake(site) {
    const grid = site.grid;
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
    // Higgsfield textures for sand and asphalt, tiled across the whole map so tiles join seamlessly.
    const pattern = (img, tiles) => {
      if (!img) return null;
      const p = g.createPattern(img, 'repeat');
      if (p.setTransform) p.setTransform(new DOMMatrix().scale(tiles * TS / img.width));
      return p;
    };
    const sandP = pattern(Assets.images.sand, 5);
    const roadP = pattern(Assets.images.asphalt, 3);
    const grassP = pattern(Assets.images.grass, 4);
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const t = grid[y][x];
        const pal = colors[t];
        const green = site.id === 'hq' && (t === T.OUT || t === T.FENCE);
        const textured = t === T.GRASS || green ? grassP : (t === T.SAND || t === T.OUT || t === T.FENCE) ? sandP : (t === T.ROAD || t === T.GATE) ? roadP : null;
        g.fillStyle = textured || pal[Math.floor(rnd() * pal.length)];
        g.fillRect(x * TS, y * TS, TS, TS);
        if (textured && t === T.OUT) { g.fillStyle = green ? 'rgba(40,70,20,.12)' : 'rgba(110,80,40,.12)'; g.fillRect(x * TS, y * TS, TS, TS); }
        if (textured) continue;
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
    for (const [x0, y0, x1, y1] of site.roads) {
      g.beginPath();
      if (x1 - x0 >= y1 - y0) { g.moveTo(x0 * TS, (y0 + y1 + 1) / 2 * TS); g.lineTo((x1 + 1) * TS, (y0 + y1 + 1) / 2 * TS); }
      else { g.moveTo((x0 + x1 + 1) / 2 * TS, y0 * TS); g.lineTo((x0 + x1 + 1) / 2 * TS, (y1 + 1) * TS); }
      g.stroke();
    }
    g.setLineDash([]);

    if (site.id === 'netivot') {
      // Track lane line and parade ground border.
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.lineWidth = 2;
      g.strokeRect(13.5 * TS, 14.5 * TS, 13 * TS, 5 * TS);
      g.strokeStyle = '#f4f1e6';
      g.lineWidth = 3;
      g.strokeRect(35.2 * TS, 23.2 * TS, 7.6 * TS, 4.6 * TS);
    }
    if (site.id === 'field') {
      // Painted outlines where each container goes.
      g.setLineDash([12, 8]);
      g.strokeStyle = '#f2c14e';
      g.lineWidth = 4;
      for (const it of DATA.deploy) g.strokeRect(it.x * TS + 4, it.y * TS + 4, it.w * TS - 8, it.h * TS - 8);
      g.setLineDash([]);
    }

    // Walls with depth.
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const t = grid[y][x];
        if (t === T.WALL) {
          g.fillStyle = '#5d594f';
          g.fillRect(x * TS, y * TS, TS, TS);
          g.fillStyle = '#7d786b';
          g.fillRect(x * TS + 3, y * TS + 3, TS - 6, TS - 10);
        } else if (t === T.FENCE) {
          g.strokeStyle = '#6c6c6c';
          g.lineWidth = 2;
          g.beginPath();
          const horiz = y === site.fence[1] || y === site.fence[3];
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
    for (const b of site.def.buildings) {
      if (!b.shelter) continue;
      g.fillStyle = 'rgba(160,160,150,.35)';
      g.fillRect(b.x * TS, b.y * TS, b.w * TS, b.h * TS);
      g.fillStyle = '#e63b2e';
      g.fillRect((b.x + 1) * TS + 6, b.y * TS + 4, TS - 12, 6);
    }

    site.baked = c;
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
