// Game rules with no DOM or rendering, so tests can play whole levels in Node.
// The floor is a COLS x ROWS grid. Mice come up out of burrows (cells), run to the
// food, grab a pita and run back to the nearest burrow. You place blocks to shape
// their route, and traps that hold a mouse still long enough to whack it to death.

export const COLS = 7;
export const ROWS = 9;

export const TOOLS = {
  block: { cost: 1 },
  snap: { cost: 3 },
  bucket: { cost: 4 },
  glue: { cost: 2 },
  cheese: { cost: 1 },
};

export const MICE = {
  lior: { radius: 0.42 },
  minion: { radius: 0.34 },
  fat: { radius: 0.44 },
  fast: { radius: 0.3 },
  orel: { radius: 0.42 },
};

// bosses come back out of another burrow when they get away, the rest are gone
export const BOSSES = new Set(['lior', 'orel']);

// Turbo: a combo this long charges it; firing it rains hits on a mouse
export const TURBO = { need: 20, hits: 12, every: 0.07, dmg: 2 };
// items you get a few of per level, used during the action
export const ITEMS = {
  spray: { radius: 1.45, dur: 3.2, dps: 1.2, slow: 0.45 }, // a poison cloud
  potion: { dur: 5.5, dmg: 1, every: 0.4 }, // the mouse turns on its friends
  tile: { delay: 0.6, dmg: 3, stun: 0.7 }, // a floor tile drops on every mouse
};

const HELD = new Set(['caught', 'glued', 'eating', 'stunned', 'bucketed']);
// what a kill is worth before the combo bonus
export const POINTS = { lior: 1000, orel: 700, minion: 150, fat: 400, fast: 300 };
const SMELL = 4; // cheese pulls a mouse when it is at most this many steps away
const SEEN_COST = 7; // extra path cost a smart mouse gives a cell with a visible trap

export const idx = (c, r) => r * COLS + c;
export const cellOf = (i) => ({ c: i % COLS, r: Math.floor(i / COLS) });
export const inside = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export class Game {
  constructor(level, opts = {}) {
    this.level = level;
    this.rand = rng(opts.seed ?? 7);
    this.events = [];
    this.time = 0;
    this.phase = 'plan'; // plan, action, won, lost
    this.budget = level.budget;
    this.food = level.food;
    this.foodMax = level.food;
    this.cells = new Array(COLS * ROWS).fill(null); // {kind, fixed?, uses?, sprung?}
    this.holes = level.holes.map(([c, r]) => idx(c, r));
    this.goal = idx(level.goal[0], level.goal[1]);
    for (const [c, r, look] of level.rocks || []) this.cells[idx(c, r)] = { kind: 'rock', fixed: true, look: look || 0 };
    for (const [kind, c, r] of level.preset || []) this.cells[idx(c, r)] = this.makeItem(kind, true);
    this.mice = [];
    this.spawnQueue = level.waves.map((w, n) => ({ ...w, n })).sort((a, b) => a.t - b.t);
    this.nextId = 1;
    this.abilities = { ofek: level.ofek || 0, shalev: level.shalev || 0, shaked: level.shaked || 0 };
    this.combo = 0;
    this.comboT = 0;
    this.stats = { hits: 0, misses: 0, kills: 0, bestCombo: 0, stolen: 0, recovered: 0, bestStreak: 0 };
    this.score = 0;
    this.streak = 0;
    this.streakT = 0;
    this.liorRespawns = 0;
    this.turbo = { charge: 0, ready: false, active: null };
    const items = level.items || {};
    this.items = { spray: items.spray || 0, potion: items.potion || 0, tile: items.tile || 0 };
    this.clouds = [];
    this.tiles = [];
  }

  emit(type, data = {}) { this.events.push({ ...data, type }); }
  drain() { const e = this.events; this.events = []; return e; }

  makeItem(kind, fixed = false) {
    const it = { kind, fixed };
    if (kind === 'glue') it.uses = 2;
    return it;
  }

  // ---------- placing ----------
  blocks(i) { const it = this.cells[i]; return !!it && (it.kind === 'rock' || it.kind === 'block'); }

  canPlace(kind, c, r) {
    if (this.phase !== 'plan' && this.phase !== 'action') return 'phase';
    if (!inside(c, r)) return 'outside';
    const i = idx(c, r);
    if (this.cells[i]) return 'taken';
    if (i === this.goal) return 'goal';
    if (this.holes.includes(i)) return 'hole';
    if (TOOLS[kind].cost > this.budget) return 'money';
    for (const m of this.mice) if (m.alive && this.mouseCells(m).includes(i)) return 'mouse';
    if (kind === 'block') {
      this.cells[i] = { kind: 'block' };
      const ok = this.allConnected();
      this.cells[i] = null;
      if (!ok) return 'sealed';
    }
    return null;
  }

  place(kind, c, r) {
    const why = this.canPlace(kind, c, r);
    if (why) return why;
    this.cells[idx(c, r)] = this.makeItem(kind);
    this.budget -= TOOLS[kind].cost;
    this.emit('placed', { kind, c, r });
    return null;
  }

  remove(c, r) {
    if (this.phase !== 'plan' || !inside(c, r)) return false;
    const i = idx(c, r);
    const it = this.cells[i];
    if (!it || it.fixed) return false;
    this.cells[i] = null;
    this.budget += TOOLS[it.kind].cost;
    this.emit('removed', { kind: it.kind, c, r });
    return true;
  }

  mouseCells(m) {
    const out = [m.cell];
    if (m.next != null) out.push(m.next);
    return out;
  }

  // Every burrow and every mouse must still be able to reach the food.
  allConnected() {
    const from = this.reachable(this.goal);
    for (const h of this.holes) if (!from[h]) return false;
    for (const m of this.mice) if (m.alive && m.cell != null && !from[m.cell]) return false;
    return true;
  }

  reachable(start) {
    const seen = new Uint8Array(COLS * ROWS);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
      const i = q.pop();
      for (const j of this.neighbours(i)) if (!seen[j] && !this.blocks(j)) { seen[j] = 1; q.push(j); }
    }
    return seen;
  }

  neighbours(i) {
    const { c, r } = cellOf(i);
    const out = [];
    if (r > 0) out.push(i - COLS);
    if (r < ROWS - 1) out.push(i + COLS);
    if (c > 0) out.push(i - 1);
    if (c < COLS - 1) out.push(i + 1);
    return out;
  }

  stepCost(j, smart) {
    let k = 1;
    const it = this.cells[j];
    if (smart && it && (it.kind === 'snap' || it.kind === 'glue' || it.kind === 'bucket')) k += SEEN_COST;
    return k;
  }

  // Dijkstra from a cell to any of the targets. Ties break the same way every time,
  // so the route shown while planning is the route the mouse really takes.
  route(from, targets, smart) {
    const N = COLS * ROWS;
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const goalSet = new Set(targets);
    dist[from] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) return null;
      if (goalSet.has(u)) {
        const path = [];
        for (let v = u; v !== from; v = prev[v]) path.push(v);
        path.reverse();
        return { path, cost: dist[u], end: u };
      }
      done[u] = 1;
      for (const v of this.neighbours(u)) {
        if (done[v] || this.blocks(v)) continue;
        const d = dist[u] + this.stepCost(v, smart);
        if (d < dist[v] - 1e-9) { dist[v] = d; prev[v] = u; }
      }
    }
  }

  // What the planning screen draws: the way a mouse from each burrow would run.
  previewRoutes() {
    const smart = this.level.smart;
    return this.holes.map((h) => {
      // step cell by cell and choose again at every cell, exactly as a running mouse does,
      // so a cheese it smells halfway there shows up as a detour
      const cells = [h];
      const eaten = new Set();
      let at = h;
      for (let guard = 0; guard < COLS * ROWS * 3 && at !== this.goal; guard++) {
        const t = this.chooseTarget(at, smart, eaten);
        if (!t || !t.path.length) break;
        at = t.path[0];
        cells.push(at);
        const it = this.cells[at];
        if (it && it.kind === 'cheese') eaten.add(at);
      }
      return { hole: h, path: cells };
    });
  }

  chooseTarget(from, smart, eaten) {
    const cheeses = [];
    this.cells.forEach((it, i) => { if (it && it.kind === 'cheese' && i !== from && !(eaten && eaten.has(i))) cheeses.push(i); });
    if (cheeses.length) {
      const toCheese = this.route(from, cheeses, false);
      if (toCheese && toCheese.path.length <= SMELL) return toCheese;
    }
    return this.route(from, [this.goal], smart);
  }

  // ---------- running a level ----------
  start() {
    if (this.phase !== 'plan') return;
    this.phase = 'action';
    this.emit('start');
  }

  spawn(w) {
    const def = this.level[w.type];
    const hole = this.holes[w.hole % this.holes.length];
    const m = {
      id: this.nextId++, type: w.type, alive: true,
      hp: def.hp, hpMax: def.hp, speed: def.speed,
      cell: hole, next: null, x: 0, z: 0,
      state: 'emerge', t: 0.55, carrying: false, hole,
      face: 1, dash: 0, stumble: 0, heldMax: 0, trapCell: null,
      smart: !!this.level.smart, confusedDir: null,
    };
    const p = cellOf(hole);
    m.x = p.c; m.z = p.r;
    this.mice.push(m);
    this.emit('spawn', { id: m.id, mouse: m.type, hole });
    return m;
  }

  update(dt) {
    if (this.phase !== 'action') return;
    this.time += dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; if (!this.turbo.ready) this.turbo.charge = 0; } }
    if (this.streakT > 0) this.streakT -= dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.time) this.spawn(this.spawnQueue.shift());
    for (const m of this.mice) this.updateMouse(m, dt);
    this.updateTurbo(dt);
    this.updateItems(dt);
    this.mice = this.mice.filter((m) => !(m.gone));
    this.checkEnd();
  }

  checkEnd() {
    if (this.phase !== 'action') return;
    const carrying = this.mice.some((m) => m.alive && m.carrying);
    if (this.food <= 0 && !carrying) {
      this.phase = 'lost';
      this.emit('lost');
      return;
    }
    const pending = this.spawnQueue.length > 0 || this.mice.some((m) => m.alive || m.respawnIn > 0);
    if (!pending) {
      this.phase = 'won';
      this.bonus = { food: this.food * 500, money: this.budget * 50 };
      this.score += this.bonus.food + this.bonus.money;
      this.emit('won', { stars: this.stars() });
    }
  }

  stars() {
    const lost = this.foodMax - this.food;
    return lost === 0 ? 3 : lost === 1 ? 2 : 1;
  }

  hold(m, state, t, cell) {
    m.state = state;
    m.t = t;
    m.heldMax = t;
    m.trapCell = cell;
  }

  updateMouse(m, dt) {
    if (m.respawnIn > 0) {
      m.respawnIn -= dt;
      if (m.respawnIn <= 0) this.respawnBoss(m);
      return;
    }
    if (!m.alive) {
      m.deadT = (m.deadT || 0) + dt;
      if (m.deadT > 2.6) m.gone = true;
      return;
    }
    if (m.dash > 0) m.dash -= dt;
    if (m.stumbleCd > 0) m.stumbleCd -= dt;
    if (m.gas > 0) m.gas -= dt;
    // the turbo flurry pins it in place, trap timer and all
    if (m.turboLock > 0) { m.turboLock -= dt; return; }
    if (m.charmed > 0) {
      m.charmed -= dt;
      if (m.charmed <= 0) { m.charmed = 0; this.emit('charmEnd', { id: m.id }); }
    }
    if (m.state === 'emerge') {
      m.t -= dt;
      if (m.t <= 0) { m.state = 'run'; this.plan(m); }
      return;
    }
    if (HELD.has(m.state)) {
      m.t -= dt;
      if (m.t <= 0) this.release(m);
      return;
    }
    if (m.stumble > 0) { m.stumble -= dt; return; }
    if (m.charmed > 0 && m.state !== 'leaving' && this.charmAttack(m, dt)) return;
    if (m.state === 'confused') {
      m.t -= dt;
      if (m.t <= 0) { m.state = m.carrying ? 'flee' : 'run'; if (m.next == null) this.plan(m); return; }
    }
    if (m.state === 'leaving') {
      m.t -= dt;
      if (m.t <= 0) this.escape(m);
      return;
    }
    this.move(m, dt);
  }

  speedOf(m) {
    let s = m.speed;
    if (m.dash > 0) s *= 1.7;
    if (m.state === 'confused') s *= 0.55;
    if (m.carrying) s *= 0.9;
    if (m.gas > 0) s *= ITEMS.spray.slow;
    if (m.charmed > 0) s *= 1.15;
    return s;
  }

  move(m, dt) {
    let left = this.speedOf(m) * dt;
    for (let guard = 0; guard < 4 && left > 0; guard++) {
      if (m.next == null) { this.plan(m); if (m.next == null) return; }
      const t = cellOf(m.next);
      const dx = t.c - m.x, dz = t.r - m.z;
      const d = Math.hypot(dx, dz);
      if (dx > 0.01) m.face = 1; else if (dx < -0.01) m.face = -1;
      if (d <= left) {
        m.x = t.c; m.z = t.r;
        m.cell = m.next;
        m.next = null;
        left -= d;
        if (this.arrive(m)) return;
      } else {
        m.x += (dx / d) * left;
        m.z += (dz / d) * left;
        return;
      }
    }
  }

  // Called when a mouse reaches the centre of a cell. Returns true if it stopped.
  arrive(m) {
    const i = m.cell;
    const it = this.cells[i];
    if (m.state === 'confused' || m.charmed > 0) return false;
    if (it && it.kind === 'snap' && !it.sprung) {
      it.sprung = true;
      this.hold(m, 'caught', this.level.snapHold, i);
      this.emit('snap', { id: m.id });
      this.damage(m, 2, 'snap');
      return true;
    }
    if (it && it.kind === 'bucket' && !it.sprung) {
      it.sprung = true;
      this.hold(m, 'bucketed', this.level.bucketHold, i);
      this.emit('bucket', { id: m.id });
      return true;
    }
    if (it && it.kind === 'glue' && !it.spent) {
      it.uses -= 1;
      this.hold(m, 'glued', this.level.glueHold, i);
      this.emit('glued', { id: m.id });
      if (it.uses <= 0) it.spent = true;
      return true;
    }
    if (it && it.kind === 'cheese' && !m.carrying) {
      this.cells[i] = null;
      this.hold(m, 'eating', this.level.cheeseHold, i);
      this.emit('eat', { id: m.id });
      return true;
    }
    if (i === this.goal && !m.carrying && m.state === 'run') {
      if (this.food > 0) {
        this.food -= 1;
        m.carrying = true;
        this.stats.stolen += 1;
        this.emit('steal', { id: m.id, food: this.food });
      }
      m.state = 'flee';
      this.plan(m);
      return false;
    }
    if (m.state === 'flee' && this.holes.includes(i)) {
      m.state = 'leaving';
      m.t = 0.35;
      return true;
    }
    return false;
  }

  // is another mouse still stuck on this cell's trap? (two can share a glue tray)
  othersOn(cell, m) {
    return this.mice.some((o) => o !== m && o.alive && o.trapCell === cell && HELD.has(o.state));
  }

  release(m) {
    const it = m.trapCell != null ? this.cells[m.trapCell] : null;
    if ((m.state === 'caught' || m.state === 'bucketed') && it && (it.kind === 'snap' || it.kind === 'bucket')) { this.cells[m.trapCell] = null; this.emit('broke', { id: m.id }); }
    if (m.state === 'glued' && it && it.spent && !this.othersOn(m.trapCell, m)) this.cells[m.trapCell] = null;
    const was = m.state;
    m.state = m.carrying ? 'flee' : 'run';
    m.trapCell = null;
    if (was === 'caught' || was === 'glued' || was === 'bucketed') { m.dash = 0.9; this.emit('free', { id: m.id }); }
    if (m.next == null) this.plan(m);
  }

  plan(m) {
    let t;
    if (m.charmed > 0) {
      // chase the nearest other mouse; with nobody to fight, keep away from the food
      const v = this.charmVictim(m);
      const r = v ? this.route(m.cell, [v.next != null && v.next !== m.cell ? v.next : v.cell], false) : null;
      if (r && r.path.length) { m.next = r.path[0]; return; }
      if (v) { m.next = null; return; }
    }
    if (m.state === 'confused' || m.charmed > 0) {
      const opts = this.neighbours(m.cell).filter((j) => !this.blocks(j));
      // walk away from the food
      const g = cellOf(this.goal);
      opts.sort((a, b) => {
        const A = cellOf(a), B = cellOf(b);
        return (Math.abs(B.c - g.c) + Math.abs(B.r - g.r)) - (Math.abs(A.c - g.c) + Math.abs(A.r - g.r)) || a - b;
      });
      m.next = opts.length ? opts[0] : null;
      return;
    }
    if (m.state === 'flee') t = this.route(m.cell, this.holes, m.smart);
    else t = this.chooseTarget(m.cell, m.smart, null);
    if (!t) { m.next = null; return; }
    if (!t.path.length) { // already standing on the target
      this.arrive(m);
      return;
    }
    m.next = t.path[0];
  }

  escape(m) {
    m.alive = false;
    if (m.carrying) this.emit('escaped', { id: m.id, mouse: m.type, x: m.x, z: m.z });
    m.carrying = false;
    this.emit('left', { id: m.id, x: m.x, z: m.z });
    if (BOSSES.has(m.type)) {
      // the bosses always come back for more: same mouse, same wounds, another burrow.
      m.state = 'away';
      m.respawnIn = this.level.liorReturn || 2.5;
      this.liorRespawns += 1;
    } else {
      m.gone = true;
    }
  }

  respawnBoss(m) {
    const n = Math.floor(this.rand() * this.holes.length);
    const hole = this.holes[n];
    // back in the burrow he licks his wounds: half of what you did to him heals
    m.hp = Math.min(m.hpMax, m.hp + Math.ceil((m.hpMax - m.hp) / 2));
    Object.assign(m, {
      alive: true, state: 'emerge', t: 0.55, carrying: false, hole, cell: hole, next: null,
      dash: 0, stumble: 0, trapCell: null, respawnIn: 0, deadT: 0,
    });
    const p = cellOf(hole);
    m.x = p.c; m.z = p.r;
    this.emit('spawn', { id: m.id, mouse: m.type, hole, back: true });
  }

  // ---------- the player's hand ----------
  isHeld(m) { return HELD.has(m.state); }

  // A tap on a mouse. `exact` is how close to its centre the tap landed, 0..1 (1 = dead centre).
  whack(m, exact = 1) {
    if (this.phase !== 'action' || !m.alive || m.state === 'emerge' || m.state === 'leaving') return null;
    let dmg = 1;
    if (this.combo >= 12) dmg = 2;
    if (!this.isHeld(m)) {
      if (exact < 0.35) { this.miss(m); return 'dodge'; }
      // one stumble, then he is wise to it for a moment and bolts instead
      if (m.stumbleCd > 0) m.dash = 0.45;
      else { m.stumble = 0.38; m.stumbleCd = 1.3; }
    }
    this.combo += 1;
    this.comboT = 0.75;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.stats.hits += 1;
    this.score += 10 * dmg;
    this.chargeTurbo();
    this.damage(m, dmg, 'whack');
    return 'hit';
  }

  // ---------- turbo ----------
  chargeTurbo() {
    const tb = this.turbo;
    if (tb.ready || tb.active) return;
    tb.charge = Math.min(1, this.combo / TURBO.need);
    if (this.combo >= TURBO.need) { tb.ready = true; tb.charge = 1; this.emit('turboReady'); }
  }

  turboTarget() {
    const live = this.mice.filter((m) => m.alive && m.state !== 'emerge' && m.state !== 'leaving' && m.state !== 'away');
    if (!live.length) return null;
    const held = live.filter((m) => HELD.has(m.state)).sort((a, b) => a.t - b.t);
    if (held.length) return held[0];
    const g = cellOf(this.goal);
    return live.sort((a, b) => (Math.abs(a.x - g.c) + Math.abs(a.z - g.r) - (a.carrying ? 3 : 0)) - (Math.abs(b.x - g.c) + Math.abs(b.z - g.r) - (b.carrying ? 3 : 0)))[0];
  }

  useTurbo() {
    const tb = this.turbo;
    if (this.phase !== 'action' || !tb.ready || tb.active) return false;
    const m = this.turboTarget();
    if (!m) return false;
    tb.ready = false;
    tb.charge = 0;
    tb.active = { left: TURBO.hits, t: 0, id: m.id };
    this.emit('turbo', { id: m.id });
    return true;
  }

  updateTurbo(dt) {
    const a = this.turbo.active;
    if (!a) return;
    a.t -= dt;
    while (a.t <= 0 && a.left > 0) {
      let m = this.mice.find((q) => q.id === a.id && q.alive && q.state !== 'leaving' && q.state !== 'away');
      if (!m) { m = this.turboTarget(); if (!m) { a.left = 0; break; } a.id = m.id; }
      m.turboLock = TURBO.every * 3;
      a.left -= 1;
      a.t += TURBO.every;
      this.score += 15;
      this.emit('turboHit', { id: m.id, left: a.left });
      this.damage(m, TURBO.dmg, 'turbo');
    }
    if (a.left <= 0) { this.turbo.active = null; this.emit('turboEnd'); }
  }

  // ---------- items ----------
  hittable(m) { return m.alive && m.state !== 'emerge' && m.state !== 'leaving' && m.state !== 'away'; }

  useSpray(c, r) {
    if (this.phase !== 'action' || !(this.items.spray > 0) || !inside(c, r)) return false;
    this.items.spray -= 1;
    this.clouds.push({ x: c, z: r, t: ITEMS.spray.dur });
    this.emit('spray', { x: c, z: r });
    return true;
  }

  usePotion(m) {
    if (this.phase !== 'action' || !(this.items.potion > 0) || !m || !this.hittable(m)) return false;
    this.items.potion -= 1;
    m.charmed = ITEMS.potion.dur;
    m.attackCd = 0.2;
    if (!HELD.has(m.state) && m.state !== 'confused' && m.next == null) this.plan(m);
    this.emit('charm', { id: m.id });
    return true;
  }

  useTile() {
    if (this.phase !== 'action' || !(this.items.tile > 0)) return false;
    const ids = this.mice.filter((m) => this.hittable(m)).map((m) => m.id);
    if (!ids.length) return false;
    this.items.tile -= 1;
    this.tiles.push({ t: ITEMS.tile.delay, ids });
    this.emit('tile', { ids });
    return true;
  }

  charmVictim(m) {
    let best = null, bd = Infinity;
    for (const o of this.mice) {
      if (o === m || !this.hittable(o) || o.charmed > 0) continue;
      const d = Math.hypot(o.x - m.x, o.z - m.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // a charmed mouse next to another one beats it up; returns true while it is fighting
  charmAttack(m, dt) {
    if (HELD.has(m.state)) return false;
    const v = this.charmVictim(m);
    if (!v || Math.hypot(v.x - m.x, v.z - m.z) > 0.95) return false;
    m.attackCd = (m.attackCd || 0) - dt;
    if (v.x > m.x + 0.01) m.face = 1; else if (v.x < m.x - 0.01) m.face = -1;
    if (m.attackCd <= 0) {
      m.attackCd = ITEMS.potion.every;
      if (!HELD.has(v.state)) v.stumble = Math.max(v.stumble || 0, 0.3);
      this.emit('charmHit', { id: m.id, victim: v.id });
      this.damage(v, ITEMS.potion.dmg, 'charm');
    }
    // stay put only when standing on a cell centre, so it never stops between cells
    return m.next == null;
  }

  updateItems(dt) {
    for (const c of this.clouds) {
      c.t -= dt;
      for (const m of this.mice) {
        if (!this.hittable(m) || Math.hypot(m.x - c.x, m.z - c.z) > ITEMS.spray.radius) continue;
        m.gas = 0.25;
        m.gasAcc = (m.gasAcc || 0) + ITEMS.spray.dps * dt;
        while (m.gasAcc >= 1 && m.alive) { m.gasAcc -= 1; this.damage(m, 1, 'gas'); }
      }
    }
    this.clouds = this.clouds.filter((c) => c.t > 0);
    for (const tl of this.tiles) {
      tl.t -= dt;
      if (tl.t > 0) continue;
      const hit = [];
      for (const id of tl.ids) {
        const m = this.mice.find((q) => q.id === id);
        if (!m || !this.hittable(m)) continue;
        hit.push({ id, x: m.x, z: m.z });
        this.damage(m, ITEMS.tile.dmg, 'tile');
        if (m.alive && !HELD.has(m.state)) this.hold(m, 'stunned', ITEMS.tile.stun, m.trapCell);
      }
      this.emit('tileHit', { hits: hit });
    }
    this.tiles = this.tiles.filter((tl) => tl.t > 0);
  }

  miss(m) {
    this.stats.misses += 1;
    this.combo = 0;
    if (!this.turbo.ready) this.turbo.charge = 0;
    if (m && m.alive && !this.isHeld(m)) { m.dash = 0.5; this.emit('dodge', { id: m.id }); }
  }

  damage(m, n, how) {
    m.hp = Math.max(0, m.hp - n);
    this.emit('hit', { id: m.id, n, how, hp: m.hp, combo: this.combo });
    if (m.hp <= 0) this.kill(m);
  }

  kill(m) {
    m.alive = false;
    m.state = 'dead';
    m.deadT = 0;
    // points, with a bonus for the combo that finished it and for kills in quick succession
    this.streak = this.streakT > 0 ? this.streak + 1 : 1;
    this.streakT = 2.6;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
    const pts = Math.round((POINTS[m.type] || 100) * (1 + Math.min(this.combo, 30) / 15) * this.streak / 10) * 10;
    this.score += pts;
    this.stats.kills += 1;
    if (m.trapCell != null) {
      const it = this.cells[m.trapCell];
      if (it && (it.kind === 'snap' || it.kind === 'bucket')) this.cells[m.trapCell] = null;
      if (it && it.kind === 'glue' && it.spent && !this.othersOn(m.trapCell, m)) this.cells[m.trapCell] = null;
    }
    if (m.carrying) {
      m.carrying = false;
      this.food += 1;
      this.stats.recovered += 1;
      this.emit('recovered', { id: m.id, food: this.food });
    }
    this.emit('kill', { id: m.id, mouse: m.type, pts, streak: this.streak });
  }

  useAbility(name) {
    if (this.phase !== 'action' || !(this.abilities[name] > 0)) return false;
    const live = this.mice.filter((m) => m.alive && m.state !== 'emerge' && m.state !== 'leaving');
    this.abilities[name] -= 1;
    if (name === 'ofek') {
      for (const m of live) {
        // already held: hold longer (and stretch the ring with it); otherwise freeze
        if (HELD.has(m.state)) { m.t += 1.2; m.heldMax = Math.max(m.heldMax, m.t); }
        else this.hold(m, 'stunned', 1.5, m.trapCell);
      }
    } else if (name === 'shaked') {
      // she complains to Ido's battalion until they refund something
      this.budget += 3;
    } else if (name === 'shalev') {
      for (const m of live) {
        if (this.isHeld(m)) continue;
        m.state = 'confused';
        m.t = 3.2;
      }
    }
    this.emit('ability', { name });
    return true;
  }

  liveMice() { return this.mice.filter((m) => m.alive); }
}
