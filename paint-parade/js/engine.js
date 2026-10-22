// Paint Parade — deterministic game rules. No DOM here: the same file runs in the
// browser, in the Node tests and in the level-verifying bot.

export const WILD = -2; // rainbow bucket: paints any color

// Belt geometry. Positions run counter-clockwise around a W×H canvas:
// 0 = bottom-left corner (entry/exit), bottom side looks up, right side looks
// left, top side looks down, left side looks right.
export function trackLength(w, h) { return 2 * w + 2 * h + 4; }

export function trackPos(w, h, p) {
  // Returns belt cell {x, y} (grid coords, may be -1 or w/h) and the line of
  // sight {dx, dy, line} where line is the column/row index, or null at corners.
  const L = trackLength(w, h);
  p = ((p % L) + L) % L;
  if (p === 0) return { x: -1, y: h, look: null };
  if (p <= w) return { x: p - 1, y: h, look: { dx: 0, dy: -1 } };
  if (p === w + 1) return { x: w, y: h, look: null };
  if (p <= w + h + 1) { const y = h - 1 - (p - (w + 2)); return { x: w, y, look: { dx: -1, dy: 0 } }; }
  if (p === w + h + 2) return { x: w, y: -1, look: null };
  if (p <= 2 * w + h + 2) { const x = w - 1 - (p - (w + h + 3)); return { x, y: -1, look: { dx: 0, dy: 1 } }; }
  if (p === 2 * w + h + 3) return { x: -1, y: -1, look: null };
  const y = p - (2 * w + h + 4);
  return { x: -1, y, look: { dx: 1, dy: 0 } };
}

// First still-unpainted pixel seen from belt position p, or -1.
export function lineTarget(st, p) {
  const t = trackPos(st.w, st.h, p);
  if (!t.look) return -1;
  let x = t.x + t.look.dx, y = t.y + t.look.dy;
  while (x >= 0 && y >= 0 && x < st.w && y < st.h) {
    const i = y * st.w + x;
    if (st.cells[i] >= 0 && st.coats[i] > 0) return i;
    x += t.look.dx; y += t.look.dy;
  }
  return -1;
}

// level: { w, h, cells:number[] (color index or -1), coats?:number[] (1|2),
//          lanes:[[{c, n, hidden?, twin?}]], slots, beltCap, spacing? }
export function createGame(level) {
  const n = level.w * level.h;
  const st = {
    w: level.w, h: level.h, L: trackLength(level.w, level.h),
    cells: Int8Array.from(level.cells),
    coats: new Uint8Array(n),
    left: 0,           // coats still to paint
    total: 0,
    lanes: [],
    slots: new Array(level.slots ?? 5).fill(null),
    belt: [],          // shooters on the belt, oldest first
    pending: [],       // shooters waiting to step onto the belt
    beltCap: level.beltCap ?? 5,
    spacing: level.spacing ?? 2,
    tick: 0,
    status: 'play',    // play | win | fail
    nextId: 1,
    events: [],
    stats: { laps: 0, wasted: 0, parks: 0, maxSlots: 0, shots: 0, launches: 0, revives: 0 },
  };
  for (let i = 0; i < n; i++) {
    if (st.cells[i] >= 0) {
      st.coats[i] = level.coats ? (level.coats[i] || 1) : 1;
      st.left += st.coats[i];
    }
  }
  st.total = st.left;
  const twinIds = new Map();
  st.lanes = level.lanes.map((lane) => lane.map((s) => {
    const sh = { id: st.nextId++, c: s.c, n: s.n, hidden: !!s.hidden, twin: 0, p: 0, steps: 0, shotThisLap: 0 };
    if (s.twin) {
      if (twinIds.has(s.twin)) { const other = twinIds.get(s.twin); sh.twin = other.id; other.twin = sh.id; }
      else twinIds.set(s.twin, sh);
    }
    return sh;
  }));
  for (const lane of st.lanes) if (lane[0]) lane[0].hidden = false;
  return st;
}

function emit(st, e) { st.events.push(e); }

export function beltLoad(st) { return st.belt.length + st.pending.length; }

export function freeSlots(st) { let k = 0; for (const s of st.slots) if (!s) k++; return k; }

function findInLanes(st, id) {
  for (let li = 0; li < st.lanes.length; li++) {
    const idx = st.lanes[li].findIndex((s) => s.id === id);
    if (idx >= 0) return { li, idx };
  }
  return null;
}

// Can the bucket at the front of lane li go now? Returns a reason string or ''.
export function laneBlock(st, li) {
  const lane = st.lanes[li];
  if (!lane || !lane.length) return 'empty';
  const s = lane[0];
  let need = 1;
  if (s.twin) {
    const where = findInLanes(st, s.twin);
    if (where && where.idx !== 0) return 'twin';
    if (where) need = 2;
  }
  if (beltLoad(st) + need > st.beltCap) return 'full';
  return '';
}

function revealFront(st, li) {
  const f = st.lanes[li][0];
  if (f && f.hidden) { f.hidden = false; emit(st, { type: 'reveal', id: f.id, lane: li }); }
}

export function launchLane(st, li, grabIndex = 0) {
  if (st.status !== 'play') return false;
  const lane = st.lanes[li];
  if (!lane || !lane[grabIndex]) return false;
  if (grabIndex > 0) {
    // Grabber booster: pull any bucket (twins come along with their partner).
    const s = lane[grabIndex];
    if (beltLoad(st) + (s.twin ? 2 : 1) > st.beltCap) return false;
    lane.splice(grabIndex, 1);
    s.hidden = false;
    queueLaunch(st, s, li);
    if (s.twin) {
      const where = findInLanes(st, s.twin);
      if (where) { const t = st.lanes[where.li].splice(where.idx, 1)[0]; t.hidden = false; queueLaunch(st, t, where.li); revealFront(st, where.li); }
    }
    revealFront(st, li);
    return true;
  }
  if (laneBlock(st, li)) return false;
  const s = lane.shift();
  queueLaunch(st, s, li);
  if (s.twin) {
    const where = findInLanes(st, s.twin);
    if (where) { const t = st.lanes[where.li].shift(); queueLaunch(st, t, where.li); revealFront(st, where.li); }
  }
  revealFront(st, li);
  return true;
}

export function launchSlot(st, si) {
  if (st.status !== 'play') return false;
  const s = st.slots[si];
  if (!s || beltLoad(st) + 1 > st.beltCap) return false;
  st.slots[si] = null;
  queueLaunch(st, s, -1, si);
  return true;
}

function queueLaunch(st, s, lane, slot = -1) {
  s.p = 0; s.steps = 0; s.shotThisLap = 0;
  st.pending.push(s);
  st.stats.launches++;
  emit(st, { type: 'launch', id: s.id, c: s.c, n: s.n, lane, slot });
}

// Adds a rainbow bucket straight to the front of the belt queue (booster).
export function addRainbow(st, shots = 12) {
  const s = { id: st.nextId++, c: WILD, n: shots, hidden: false, twin: 0, p: 0, steps: 0, shotThisLap: 0 };
  st.pending.unshift(s);
  emit(st, { type: 'launch', id: s.id, c: WILD, n: shots, lane: -2, slot: -1 });
  return s;
}

export function addSlot(st, k = 1) { for (let i = 0; i < k; i++) st.slots.push(null); }

// Revive after a fail: two more spots, the stuck bucket parks in one.
export function revive(st) {
  if (st.status !== 'fail') return false;
  addSlot(st, 2);
  const s = st.stuck;
  st.stuck = null;
  if (s) park(st, s);
  st.status = 'play';
  st.stats.revives++;
  emit(st, { type: 'revive' });
  return true;
}

function park(st, s) {
  const i = st.slots.indexOf(null);
  if (i < 0) return false;
  st.slots[i] = s;
  st.stats.parks++;
  const used = st.slots.length - freeSlots(st);
  if (used > st.stats.maxSlots) st.stats.maxSlots = used;
  emit(st, { type: 'park', id: s.id, slot: i });
  return true;
}

function fire(st, s) {
  const i = lineTarget(st, s.p);
  if (i < 0) return;
  const c = st.cells[i];
  if (s.c !== WILD && s.c !== c) return;
  st.coats[i]--;
  st.left--;
  s.n--;
  s.shotThisLap++;
  st.stats.shots++;
  emit(st, { type: 'shot', id: s.id, cell: i, c, from: s.p, done: st.coats[i] === 0 });
}

// One simulation step: every bucket moves one belt cell and may splash once.
export function step(st) {
  if (st.status !== 'play') return;
  st.tick++;
  // Move buckets on the belt (oldest first keeps spacing stable).
  const still = [];
  for (const s of st.belt) {
    s.p = (s.p + 1) % st.L;
    s.steps++;
    if (s.steps >= st.L) {
      // Lap complete.
      st.stats.laps++;
      if (s.shotThisLap === 0) st.stats.wasted++;
      s.shotThisLap = 0;
      if (s.n <= 0) { emit(st, { type: 'pop', id: s.id }); continue; }
      if (!park(st, s)) {
        st.status = 'fail';
        st.stuck = s;
        st.belt = still.concat(st.belt.slice(st.belt.indexOf(s) + 1));
        emit(st, { type: 'fail', id: s.id });
        return;
      }
      continue;
    }
    fire(st, s);
    if (s.n <= 0) { emit(st, { type: 'pop', id: s.id }); continue; }
    still.push(s);
    if (st.left === 0) break;
  }
  if (st.left === 0) {
    st.belt = still;
    st.status = 'win';
    emit(st, { type: 'win' });
    return;
  }
  st.belt = still;
  // Step a waiting bucket onto the entry if there is room behind the last one.
  if (st.pending.length) {
    const last = st.belt[st.belt.length - 1];
    if (!last || last.steps >= st.spacing) {
      const s = st.pending.shift();
      s.p = 0; s.steps = 0;
      st.belt.push(s);
      fire(st, s);
      if (st.left === 0) { st.status = 'win'; emit(st, { type: 'win' }); }
    }
  }
}

export function progress(st) { return st.total ? 1 - st.left / st.total : 1; }

// Everything still holding paint, used for accounting checks.
export function ammoByColor(st) {
  const m = {};
  const add = (s) => { if (s) m[s.c] = (m[s.c] || 0) + s.n; };
  st.lanes.forEach((l) => l.forEach(add));
  st.slots.forEach(add); st.belt.forEach(add); st.pending.forEach(add);
  if (st.stuck) add(st.stuck);
  return m;
}

export function coatsByColor(st) {
  const m = {};
  for (let i = 0; i < st.cells.length; i++) if (st.cells[i] >= 0 && st.coats[i] > 0) m[st.cells[i]] = (m[st.cells[i]] || 0) + st.coats[i];
  return m;
}

// Pixels the belt can reach right now: the first still-grey pixel of every row and
// column, seen from each side. Everything else is buried behind another color.
export function exposure(w, h, cells, coats) {
  const exp = new Uint8Array(w * h);
  const look = (x, y, dx, dy) => {
    while (x >= 0 && y >= 0 && x < w && y < h) {
      const i = y * w + x;
      if (cells[i] >= 0 && coats[i] > 0) { exp[i] = 1; return; }
      x += dx; y += dy;
    }
  };
  for (let x = 0; x < w; x++) { look(x, h - 1, 0, -1); look(x, 0, 0, 1); }
  for (let y = 0; y < h; y++) { look(w - 1, y, -1, 0); look(0, y, 1, 0); }
  return exp;
}

export function exposedColors(st) {
  const e = exposure(st.w, st.h, st.cells, st.coats);
  const out = new Set();
  for (let i = 0; i < e.length; i++) if (e[i]) out.add(st.cells[i]);
  return out;
}

// A bucket is awake when some pixel of its color is reachable (rainbow always is).
export function isAwake(st, s, exposed = exposedColors(st)) { return s.c === WILD || exposed.has(s.c); }

export function isIdle(st) {
  return st.belt.length === 0 && st.pending.length === 0;
}
