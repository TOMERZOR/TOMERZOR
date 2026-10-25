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
  '#ddddd#ddddd#mmmmm#mm#iiiiiiiiiiii#',
  '#ddddd#ddddd#m#####m##i#WWWWW#iiii#',
  '#ddddd#ddddd#mmm#mmmm#i#nnnnn#iiii#',
  '#ddddd#ddddd###m#m##m#i#nnnnn#iiii#',
  '#ddddd#ddddd#mmmmmm#m#i#nnnnn#iiii#',
  '#ddddd#ddddd#m####m#m#i#nnnnn#iiii#',
  '#ddddd#ddddd#mmm#mmmm#iiiiiiiiiiii#',
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

// A* over walkable cells, 8-way without cutting corners. Binary heap open set.
const gScore = new Float32Array(W * D), came = new Int32Array(W * D), stamp = new Int32Array(W * D), closed = new Int32Array(W * D);
let run = 0;
export function findPath(sx, sz, tx, tz, canWalk = walkable) {
  if (!canWalk(tx, tz)) return null;
  run++;
  const heap = [], fs = [];
  const push = (k, f) => {
    let i = heap.length; heap.push(k); fs.push(f);
    while (i > 0) { const p = (i - 1) >> 1; if (fs[p] <= f) break; heap[i] = heap[p]; fs[i] = fs[p]; i = p; }
    heap[i] = k; fs[i] = f;
  };
  const pop = () => {
    const top = heap[0], lk = heap.pop(), lf = fs.pop();
    if (heap.length) {
      let i = 0; const n = heap.length;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && fs[c + 1] < fs[c]) c++;
        if (fs[c] >= lf) break;
        heap[i] = heap[c]; fs[i] = fs[c]; i = c;
      }
      heap[i] = lk; fs[i] = lf;
    }
    return top;
  };
  const h = (x, z) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const start = sz * W + sx;
  stamp[start] = run; gScore[start] = 0; came[start] = -1;
  push(start, h(sx, sz));
  let guard = 0;
  while (heap.length && guard++ < 6000) {
    const cur = pop();
    if (closed[cur] === run) continue;
    closed[cur] = run;
    const cx = cur % W, cz = (cur / W) | 0;
    if (cx === tx && cz === tz) {
      const path = [];
      for (let k = cur; k !== -1; k = came[k]) path.push([k % W, (k / W) | 0]);
      return path.reverse();
    }
    const gc = gScore[cur];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (!canWalk(nx, nz)) continue;
      if (dx && dz && (!canWalk(cx + dx, cz) || !canWalk(cx, cz + dz))) continue;
      const nk = nz * W + nx;
      if (closed[nk] === run) continue;
      const ng = gc + (dx && dz ? 1.414 : 1);
      if (stamp[nk] !== run || ng < gScore[nk]) {
        stamp[nk] = run; gScore[nk] = ng; came[nk] = cur;
        push(nk, ng + h(nx, nz));
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
