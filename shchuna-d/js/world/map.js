// The city plan of קריית שמש. Everything spatial derives from this file:
// roads, sidewalks, the traffic graph, zones, points of interest and the minimap.
// Units are metres. +X is east, +Z is south, Y is up.

export const XS = [-310, -190, -70, 50, 170, 300];   // north–south streets (x of the centre line)
export const ZS = [-300, -180, -60, 60, 180, 300];   // east–west streets (z of the centre line)
export const SIDEWALK = 3.6;
export const CURB = 0.14;
export const WORLD_HALF = 620;                       // hard edge of the playable square

const V_NAMES = ['דרך הנגב', 'רחוב הרצל', 'רחוב ז׳בוטינסקי', 'שדרות ירושלים', 'רחוב ההסתדרות', 'דרך המפעלים'];
const H_NAMES = ['רחוב העלייה', 'רחוב יהודה הלוי', 'רחוב הגפן', 'שדרות העצמאות', 'רחוב מבצע יונתן', 'דרך הדרום'];
const V_W = [10, 9, 9, 17, 9, 10];
const H_W = [10, 9, 9, 17, 9, 10];

export const roads = [];
XS.forEach((x, i) => roads.push({
  id: 'v' + i, name: V_NAMES[i], vertical: true, x, z0: ZS[0], z1: ZS[5], w: V_W[i], boulevard: V_W[i] > 12,
}));
ZS.forEach((z, j) => roads.push({
  id: 'h' + j, name: H_NAMES[j], vertical: false, z, x0: XS[0], x1: XS[5], w: H_W[j], boulevard: H_W[j] > 12,
}));
// Two roads that leave the grid: the moshav road east, and the highway south.
roads.push({ id: 'moshav', name: 'כביש המושב', vertical: false, z: ZS[0], x0: XS[5], x1: 590, w: 9, rural: true });
roads.push({ id: 'south', name: 'כביש 25', vertical: true, x: XS[3], z0: ZS[5], z1: 590, w: 17, boulevard: true, rural: true });

export const roadW = { v: V_W, h: H_W };

// Rectangles of carriageway, used for ground height, surfaces and AI.
export const roadRects = roads.map((r) => r.vertical
  ? { x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z0 - (r.rural ? 0 : H_W[0] / 2), z1: r.z1 + (r.rural ? 0 : H_W[5] / 2), r }
  : { x0: r.x0 - (r.rural ? 0 : V_W[0] / 2), x1: r.x1 + (r.rural ? 0 : V_W[5] / 2), z0: r.z - r.w / 2, z1: r.z + r.w / 2, r });

export function onRoad(x, z) {
  for (let i = 0; i < roadRects.length; i++) {
    const q = roadRects[i];
    if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) return q.r;
  }
  return null;
}

// Zone of every city block, row 0 is the northern row.
const ZONES = [
  ['gimel',  'gimel',   'industrial', 'industrial', 'gas'],
  ['gimel',  'court3',  'school',     'shikun',     'wedding'],
  ['shikun', 'home',    'center',     'shikun',     'civic'],
  ['shikun', 'park',    'shuk',       'shikun',     'site'],
  ['shikun', 'shikun',  'station',    'shikun',     'towers'],
];

export const blocks = [];
for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const x0 = XS[c] + V_W[c] / 2 + SIDEWALK, x1 = XS[c + 1] - V_W[c + 1] / 2 - SIDEWALK;
    const z0 = ZS[r] + H_W[r] / 2 + SIDEWALK, z1 = ZS[r + 1] - H_W[r + 1] / 2 - SIDEWALK;
    blocks.push({
      id: 'b' + c + r, c, r, zone: ZONES[r][c], x0, x1, z0, z1,
      cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0,
    });
  }
}
export const blockAt = (c, r) => blocks[r * 5 + c];
export function blockOf(x, z) {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (x >= b.x0 - SIDEWALK && x <= b.x1 + SIDEWALK && z >= b.z0 - SIDEWALK && z <= b.z1 + SIDEWALK) return b;
  }
  return null;
}

// Height of the walkable ground. Roads sit a curb below the pavement and the lots.
const CITY_E = XS[5] + V_W[5] / 2 + SIDEWALK, CITY_W = XS[0] - V_W[0] / 2 - SIDEWALK;
const CITY_S = ZS[5] + H_W[5] / 2 + SIDEWALK, CITY_N = ZS[0] - H_W[0] / 2 - SIDEWALK;
export function inCity(x, z) { return x >= CITY_W && x <= CITY_E && z >= CITY_N && z <= CITY_S; }
export function groundY(x, z) {
  if (!inCity(x, z)) return 0;
  return onRoad(x, z) ? 0 : CURB;
}

// Gang turf, by block zone. Used for ambient gang spawns and pile-ons.
export const TURF = {
  gimel: 'gimel', court3: 'gimel',
  home: 'dalet', park: 'dalet', shikun: 'dalet',
};
export function turfAt(x, z) {
  const b = blockOf(x, z);
  if (!b) return null;
  if (b.zone === 'shikun' && b.c >= 3) return null;      // the east side belongs to nobody
  return TURF[b.zone] || null;
}

export const DISTRICT_NAMES = {
  gimel: 'שכונה ג׳', court3: 'שכונה ג׳', industrial: 'אזור התעשייה', gas: 'צומת המושב',
  school: 'בית הספר', shikun: 'שכונה ד׳', wedding: 'אולמי ורסאי', home: 'שכונה ד׳ · הבלוקים',
  center: 'המרכז המסחרי', civic: 'קריית הממשלה', park: 'המגרש', shuk: 'השוק', site: 'פינוי־בינוי',
  station: 'התחנה המרכזית', towers: 'נווה יוקרה',
};
export function districtAt(x, z) {
  const b = blockOf(x, z);
  if (b) return DISTRICT_NAMES[b.zone] || 'קריית שמש';
  if (x > XS[5] + 20) return 'שדות המושב';
  if (z > ZS[5] + 20) return 'כביש 25';
  return 'קריית שמש';
}
export function streetAt(x, z) {
  let best = null, bd = 1e9;
  for (const r of roads) {
    const d = r.vertical
      ? (z >= r.z0 - 10 && z <= r.z1 + 10 ? Math.abs(x - r.x) : 1e9)
      : (x >= r.x0 - 10 && x <= r.x1 + 10 ? Math.abs(z - r.z) : 1e9);
    if (d < bd) { bd = d; best = r; }
  }
  return bd < 40 && best ? best.name : '';
}

// ---- Traffic graph -------------------------------------------------------
// Nodes are intersections; lanes are directed edges offset to the right of the centre line.
export const nodes = [];
const nodeIdx = {};
function addNode(x, z, key) {
  const n = { id: nodes.length, x, z, out: [] };
  nodes.push(n); nodeIdx[key] = n; return n;
}
for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) addNode(XS[i], ZS[j], i + ',' + j);
const nEast = addNode(585, ZS[0], 'east');
const nSouth = addNode(XS[3], 585, 'south');
export const nodeAt = (i, j) => nodeIdx[i + ',' + j];

export const lanes = [];
function addLane(a, b, road) {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  const off = road.w / 4;                         // drive on the right
  const rx = -uz, rz = ux;                        // right-hand normal for (ux,uz) with +Z south
  const lane = {
    id: lanes.length, a, b, road, len, ux, uz,
    ax: a.x + rx * off, az: a.z + rz * off, bx: b.x + rx * off, bz: b.z + rz * off,
    speed: road.boulevard ? 15 : road.rural ? 17 : 11,
  };
  lanes.push(lane); a.out.push(lane);
}
for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
  if (i < 5) { addLane(nodeAt(i, j), nodeAt(i + 1, j), roads[6 + j]); addLane(nodeAt(i + 1, j), nodeAt(i, j), roads[6 + j]); }
  if (j < 5) { addLane(nodeAt(i, j), nodeAt(i, j + 1), roads[i]); addLane(nodeAt(i, j + 1), nodeAt(i, j), roads[i]); }
}
addLane(nodeAt(5, 0), nEast, roads[12]); addLane(nEast, nodeAt(5, 0), roads[12]);
addLane(nodeAt(3, 5), nSouth, roads[13]); addLane(nSouth, nodeAt(3, 5), roads[13]);

export function nearestNode(x, z) {
  let best = nodes[0], bd = 1e12;
  for (const n of nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}
export function nearestLane(x, z) {
  let best = null, bd = 1e12, bt = 0;
  for (const l of lanes) {
    const t = Math.max(0, Math.min(l.len, (x - l.ax) * l.ux + (z - l.az) * l.uz));
    const px = l.ax + l.ux * t, pz = l.az + l.uz * t;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bd) { bd = d; best = l; bt = t; }
  }
  return { lane: best, t: bt, d: Math.sqrt(bd) };
}

// Breadth-first route over intersections; good enough for a 38 node graph.
export function routeNodes(from, to) {
  const prev = new Map(); prev.set(from, null);
  const q = [from];
  while (q.length) {
    const n = q.shift();
    if (n === to) break;
    for (const l of n.out) if (!prev.has(l.b)) { prev.set(l.b, l); q.push(l.b); }
  }
  const path = [];
  let cur = to;
  while (prev.get(cur)) { const l = prev.get(cur); path.unshift(l); cur = l.a; }
  return path;
}

// Sidewalk walking loops for pedestrians: the perimeter of every block.
export const walkLoops = blocks.map((b) => {
  const m = SIDEWALK / 2;
  return [
    { x: b.x0 - m, z: b.z0 - m }, { x: b.x1 + m, z: b.z0 - m },
    { x: b.x1 + m, z: b.z1 + m }, { x: b.x0 - m, z: b.z1 + m },
  ];
});

// Named places. Filled in by the city generator (shops, doors, parking) and read by missions.
export const POI = {};
export function setPOI(name, x, z, extra) { POI[name] = Object.assign({ x, z }, extra || {}); }
