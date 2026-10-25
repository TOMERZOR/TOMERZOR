// Game rules with no DOM or rendering, so tests can play whole levels in Node.
// The floor is a COLS x ROWS grid. Mice come up out of burrows (cells), run to the
// food, grab a pita and run back to the nearest burrow. You place blocks to shape
// their route, and traps that hold a mouse still long enough to whack it to death.

export const COLS = 7;
export const ROWS = 9;

export const TOOLS = {
  block: { cost: 1 },
  snap: { cost: 3 },
  glue: { cost: 2 },
  cheese: { cost: 1 },
};

export const MICE = {
  lior: { radius: 0.42 },
  minion: { radius: 0.34 },
};

const HELD = new Set(['caught', 'glued', 'eating', 'stunned']);
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
    this.stats = { hits: 0, misses: 0, kills: 0, bestCombo: 0, stolen: 0, recovered: 0 };
    this.liorRespawns = 0;
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
    if (smart && it && (it.kind === 'snap' || it.kind === 'glue')) k += SEEN_COST;
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
      const t = this.chooseTarget(h, smart, null);
      if (!t) return { hole: h, path: [] };
      const cells = [h];
      let at = h;
      let leg = t;
      // follow cheese detours on the way, the way a mouse would
      const eaten = new Set();
      for (let guard = 0; guard < 6 && leg; guard++) {
        cells.push(...leg.path);
        at = leg.end;
        if (at === this.goal) break;
        eaten.add(at);
        leg = this.chooseTarget(at, smart, eaten);
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
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.time) this.spawn(this.spawnQueue.shift());
    for (const m of this.mice) this.updateMouse(m, dt);
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
      if (m.respawnIn <= 0) this.respawnLior(m);
      return;
    }
    if (!m.alive) {
      m.deadT = (m.deadT || 0) + dt;
      if (m.deadT > 2.6) m.gone = true;
      return;
    }
    if (m.dash > 0) m.dash -= dt;
    if (m.stumbleCd > 0) m.stumbleCd -= dt;
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
    if (m.state === 'confused') return false;
    if (it && it.kind === 'snap' && !it.sprung) {
      it.sprung = true;
      this.hold(m, 'caught', this.level.snapHold, i);
      this.emit('snap', { id: m.id });
      this.damage(m, 2, 'snap');
      return true;
    }
    if (it && it.kind === 'glue') {
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

  release(m) {
    const it = m.trapCell != null ? this.cells[m.trapCell] : null;
    if (m.state === 'caught' && it && it.kind === 'snap') { this.cells[m.trapCell] = null; this.emit('broke', { id: m.id }); }
    if (m.state === 'glued' && it && it.spent) this.cells[m.trapCell] = null;
    const was = m.state;
    m.state = m.carrying ? 'flee' : 'run';
    m.trapCell = null;
    if (was === 'caught' || was === 'glued') { m.dash = 0.9; this.emit('free', { id: m.id }); }
    if (m.next == null) this.plan(m);
  }

  plan(m) {
    let t;
    if (m.state === 'confused') {
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
    if (m.carrying) this.emit('escaped', { id: m.id, mouse: m.type });
    m.carrying = false;
    this.emit('left', { id: m.id });
    if (m.type === 'lior') {
      // Lior always comes back for more: same mouse, same wounds, another burrow.
      m.state = 'away';
      m.respawnIn = this.level.liorReturn || 2.5;
      this.liorRespawns += 1;
    } else {
      m.gone = true;
    }
  }

  respawnLior(m) {
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
    this.damage(m, dmg, 'whack');
    return 'hit';
  }

  miss(m) {
    this.stats.misses += 1;
    this.combo = 0;
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
    this.stats.kills += 1;
    if (m.trapCell != null) {
      const it = this.cells[m.trapCell];
      if (it && it.kind === 'snap') this.cells[m.trapCell] = null;
      if (it && it.kind === 'glue' && it.spent) this.cells[m.trapCell] = null;
    }
    if (m.carrying) {
      m.carrying = false;
      this.food += 1;
      this.stats.recovered += 1;
      this.emit('recovered', { id: m.id, food: this.food });
    }
    this.emit('kill', { id: m.id, mouse: m.type });
  }

  useAbility(name) {
    if (this.phase !== 'action' || !(this.abilities[name] > 0)) return false;
    const live = this.mice.filter((m) => m.alive && m.state !== 'emerge' && m.state !== 'leaving');
    this.abilities[name] -= 1;
    if (name === 'ofek') {
      for (const m of live) {
        if (m.state === 'caught' || m.state === 'glued') m.t += 1.2;
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
