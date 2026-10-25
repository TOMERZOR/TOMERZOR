// The base, cell by cell (2 m per cell). North is row 0; the yard and the gate are in the south.
//  #  wall            .  corridor          +  open doorway
//  a,b,d  barracks    k  kitchenette       o  office          c  CCTV room
//  j  Yasmin's store  s  showers           e  equipment store g  generator room
//  m  the maze        i  isolation wing    n  Nevo's cell (behind glass)
//  W  observation window                   x  exit hall       y  yard
//  F  perimeter fence G  gate              z  road outside the gate
//  E J I X P  locked doors (equipment, Yasmin's store, isolation, exit, generator)
export const CELL = 2;
export const H = 2.7;

export const MAP = [
  '####################################',
  '#aaaaa#bbbbb#kkkkk#ooooo#cccc#jjjjj#',
  '#aaaaa#bbbbb#kkkkk#ooooo#cccc#jjjjj#',
  '#aaaaa#bbbbb#kkkkk#ooooo#cccc#jjjjj#',
  '###+#####+#####+#####+####+#####J###',
  '#..................................#',
  '#.########.#####E#####.###########.#',
  '#.#ssssss#.#eeeeeeeee#.#ggggggggg#.#',
  '#.#ssssss#.#eeeeeeeee#.#ggggggggg#.#',
  '#.+ssssss#.#eeeeeeeee#.Pggggggggg#.#',
  '#.#ssssss#.#eeeeeeeee#.#ggggggggg#.#',
  '#.#ssssss#.#eeeeeeeee#.#ggggggggg#.#',
  '#.########.###########.###########.#',
  '#..................................#',
  '###+#####+#######+##########I######',
  '#ddddd#ddddd#mmm#mmmm#iiiiiiiiiiii#',
  '#ddddd#ddddd#m#m#m##m#i#WWWWW#iiii#',
  '#ddddd#ddddd#m#mmm#mm#i#nnnnn#iiii#',
  '#ddddd#ddddd#m###m#m##i#nnnnn#iiii#',
  '#ddddd#ddddd#mmm#mmmm#i#nnnnn#iiii#',
  '#ddddd#ddddd###m##m#m#i#nnnnn#iiii#',
  '#ddddd#ddddd#mmmmmm#m#iiiiiiiiiiii#',
  '#################X##################',
  '################xxx#################',
  '################xxx#################',
  '################yyy#################',
  '###FyyyyyyyyyyyyyyyyyyyyyyyyyyyyF###',
  '###FyyyyyyyyyyyyyyyyyyyyyyyyyyyyF###',
  '###FyyyyyyyyyyyyyyyyyyyyyyyyyyyyF###',
  '###FyyyyyyyyyyyyyyyyyyyyyyyyyyyyF###',
  '###FyyyyyyyyyyyyyyyyyyyyyyyyyyyyF###',
  '###FyyyyyyyyyyyyyyyyyyyyyyyyyyyyF###',
  '###FFFFFFFFFFFFGGGGFFFFFFFFFFFFFF###',
  '###zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz###',
  '###zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz###',
  '####################################',
];

// Fix up row widths so a typo can never shift a whole row.
export const W = Math.max(...MAP.map(r => r.length));
export const D = MAP.length;
for (let i = 0; i < D; i++) MAP[i] = MAP[i].padEnd(W, '#');

export const ROOMS = {
  a: 'חדר 1 · המגורים שלך', b: 'חדר 2', d: 'חדר 4', k: 'מטבחון', o: 'משרד הרס״פ', c: 'חדר מצלמות',
  j: 'המחסן של יסמין', s: 'מקלחות', e: 'מחסן צל״ם', g: 'חדר גנרטור', m: '???', i: 'אגף בידוד',
  '.': 'מסדרון', '+': 'מסדרון', x: 'יציאה', y: 'חצר', z: 'בחוץ', n: 'תא 3',
};

const OUTDOOR = new Set(['y', 'z', 'G']);
const LOCKS = new Set(['E', 'J', 'I', 'X', 'P']);

// Door state: locked doors are solid until the story opens them.
export const locks = { E: true, J: true, I: true, X: true, P: false };

export function ch(x, z) {
  if (x < 0 || z < 0 || x >= W || z >= D) return '#';
  return MAP[z][x];
}
export function isOutdoor(c) { return OUTDOOR.has(c); }
export function isLock(c) { return LOCKS.has(c); }
export function isWallChar(c) { return c === '#' || c === 'F' || c === 'W'; }

// Can something stand in this cell (ignoring props)?
export function walkable(x, z) {
  const c = ch(x, z);
  if (isWallChar(c)) return false;
  if (c === 'n') return false;
  if (c === 'G') return !gateClosed.v;
  if (LOCKS.has(c)) return !locks[c];
  return true;
}
export const gateClosed = { v: true };

// Is this cell a solid block for light and line of sight? (The window lets sight through.)
export function opaque(x, z) {
  const c = ch(x, z);
  if (c === '#' || c === 'F') return c === '#';
  if (LOCKS.has(c)) return locks[c];
  return false;
}

export function toCell(v) { return Math.floor(v / CELL); }
export function cellCenter(x, z, out = { x: 0, z: 0 }) {
  out.x = (x + 0.5) * CELL; out.z = (z + 0.5) * CELL; return out;
}
export function roomAt(px, pz) { return ch(toCell(px), toCell(pz)); }

// Line of sight across the grid (DDA). Returns true if nothing opaque lies between.
export function lineOfSight(ax, az, bx, bz, solid = opaque) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(len / 0.25);
  let lx = -1, lz = -1;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = toCell(ax + (bx - ax) * t), z = toCell(az + (bz - az) * t);
    if (x === lx && z === lz) continue;
    lx = x; lz = z;
    if (solid(x, z)) return false;
  }
  return true;
}

// A* over walkable cells, 8-way without cutting corners.
export function findPath(sx, sz, tx, tz, canWalk = walkable) {
  if (!canWalk(tx, tz)) return null;
  const key = (x, z) => z * W + x;
  const open = new Map(), came = new Map(), g = new Map();
  const h = (x, z) => Math.hypot(x - tx, z - tz);
  const start = key(sx, sz);
  g.set(start, 0); open.set(start, h(sx, sz));
  let guard = 0;
  while (open.size && guard++ < 4000) {
    let cur = -1, best = Infinity;
    for (const [k, f] of open) if (f < best) { best = f; cur = k; }
    open.delete(cur);
    const cx = cur % W, cz = (cur / W) | 0;
    if (cx === tx && cz === tz) {
      const path = [[cx, cz]];
      let k = cur;
      while (came.has(k)) { k = came.get(k); path.push([k % W, (k / W) | 0]); }
      return path.reverse();
    }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (!canWalk(nx, nz)) continue;
      if (dx && dz && (!canWalk(cx + dx, cz) || !canWalk(cx, cz + dz))) continue;
      const nk = key(nx, nz);
      const ng = g.get(cur) + (dx && dz ? 1.414 : 1);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); came.set(nk, cur); open.set(nk, ng + h(nx, nz));
      }
    }
  }
  return null;
}

// Every walkable cell with its character, for spawning and patrols.
export function cellsOf(chars) {
  const out = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (chars.includes(MAP[z][x])) out.push([x, z]);
  return out;
}
