// SHARD physics core. Shared by the game (browser) and the level solver (Node),
// so the planck module is passed in rather than imported.

export const DT = 1 / 60;
export const W = 9;            // design width in meters, walls at x=0 and x=W
export const H = 16;           // design height shown on every phone
export const CEIL = 14;        // ceiling height: the room is closed so shots ricochet
export const PIVOT_Y = 0.42;   // launcher pivot height
export const DOME_R = 0.7;     // launcher dome radius (centered on the floor)
export const BALL_R = 0.3;
export const SPEED = 19;
export const MUZZLE = 0.7 + 0.3 + 0.08; // ball spawn distance from the pivot
export const BREAK_SPEED = 4.2;     // glass vs anything but the ball
export const BALL_BREAK = 1.6;      // the steel ball cracks glass at almost any speed
export const BOMB_SPEED = 2.0;
export const PIERCE_KEEP = 0.88;
export const MIN_ANGLE = 0.12;
export const MAX_ANGLE = Math.PI - 0.12;

const CAT_STATIC = 0x0001, CAT_BALL = 0x0002, CAT_DYN = 0x0004, CAT_SHARD = 0x0008;
const MASK = {
  static: 0xffff,
  ball: CAT_STATIC | CAT_BALL | CAT_DYN,
  dyn: CAT_STATIC | CAT_BALL | CAT_DYN,
  shard: CAT_STATIC,
};

const MAT = {
  glass: { density: 1.0, friction: 0.45, restitution: 0.1 },
  stone: { density: 4.0, friction: 0.7, restitution: 0.05 },
  wood: { density: 0.6, friction: 0.6, restitution: 0.15 },
  bomb: { density: 1.2, friction: 0.5, restitution: 0.2 },
  shelf: { density: 0, friction: 0.5, restitution: 0.45 },
  pad: { density: 0, friction: 0.3, restitution: 1.15 },
  ball: { density: 6.0, friction: 0.3, restitution: 0.5 },
};

// ---------- shape helpers (local coordinates, counter-clockwise) ----------
export function boxPoly(w, h) {
  const x = w / 2, y = h / 2;
  return [[-x, -y], [x, -y], [x, y], [-x, y]];
}
export function chamferPoly(w, h, c) {
  const x = w / 2, y = h / 2;
  c = Math.min(c, x * 0.9, y * 0.9);
  return [[-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c]];
}
export function circlePoly(r, n = 10) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

// Physics polygons + drawing outline for each glass silhouette.
export function glassShape(o) {
  const w = o.w, h = o.h;
  switch (o.s) {
    case 'orb':
      return { circle: o.r, polys: [circlePoly(o.r, 10)], outline: circlePoly(o.r, 24) };
    case 'jar': {
      const p = chamferPoly(w, h, Math.min(w, h) * 0.22);
      return { polys: [p], outline: p };
    }
    case 'bottle': {
      const bh = h * 0.66, nh = h - bh, nw = w * 0.4;
      const body = chamferPoly(w, bh, w * 0.28).map(([x, y]) => [x, y - h / 2 + bh / 2]);
      const neck = boxPoly(nw, nh + 0.02).map(([x, y]) => [x, y + h / 2 - nh / 2]);
      const y0 = -h / 2, yb = -h / 2 + bh, c = w * 0.28;
      const outline = [
        [-w / 2 + c, y0], [w / 2 - c, y0], [w / 2, y0 + c], [w / 2, yb - c], [nw / 2, yb],
        [nw / 2, h / 2], [-nw / 2, h / 2], [-nw / 2, yb], [-w / 2, yb - c], [-w / 2, y0 + c],
      ];
      return { polys: [body, neck], outline };
    }
    case 'pane':
    case 'box':
    default: {
      const p = boxPoly(w, h);
      return { polys: [p], outline: p };
    }
  }
}

// ---------- simulation ----------
export function createSim(planck, level, opts = {}) {
  const { World, Vec2, Box, Circle, Polygon, Edge, RopeJoint } = planck;
  const world = new World({ gravity: Vec2(0, -10) });
  const visual = !!opts.visual;          // browser: spawn shards
  const rand = opts.random || Math.random;
  const startAwake = !!opts.awake;    // solver stability test wakes everything

  const ents = [];        // all entities (incl. static) for rendering
  let nextId = 1;
  const events = [];
  const queued = [];                // events raised between steps (fire)
  const pendingBreak = new Map();   // ent -> {x,y,vx,vy,speed}
  const pendingBomb = new Map();    // ent -> delay steps
  const damp = new Map();           // ball ent -> factor
  const shards = [];
  const ropes = [];
  const movers = [];

  const lx = level.launcher?.x ?? W / 2;
  const speed = level.speed ?? SPEED;
  const st = {
    step: 0, time: 0,
    balls: level.balls ?? 3, used: 0,
    glass: 0, won: false, lost: false,
    lastFire: -999, quietSteps: 0, sinceEmpty: 0,
    combo: 0, comboTimer: 0, maxCombo: 0, broken: 0,
  };

  function addEnt(e) { e.id = nextId++; e.alive = true; ents.push(e); e.body.setUserData(e); return e; }

  function fixtureDef(mat, cat, mask) {
    const m = MAT[mat];
    return { density: m.density, friction: m.friction, restitution: m.restitution, filterCategoryBits: cat, filterMaskBits: mask };
  }

  // walls and floor
  {
    const b = world.createBody({ type: 'static' });
    const fd = fixtureDef('shelf', CAT_STATIC, MASK.static);
    b.createFixture(Box(W / 2 + 6, 1, Vec2(W / 2, -1), 0), { ...fd, friction: 0.8, restitution: 0.12 });
    const wd = { ...fd, restitution: 0.72, friction: 0.2 };
    b.createFixture(Box(0.5, 20, Vec2(-0.5, 20), 0), wd);
    b.createFixture(Box(0.5, 20, Vec2(W + 0.5, 20), 0), wd);
    b.createFixture(Box(W / 2 + 1, 0.5, Vec2(W / 2, CEIL + 0.5), 0), wd);
    addEnt({ kind: 'frame', body: b });
    // launcher dome
    const d = world.createBody({ type: 'static', position: Vec2(lx, 0) });
    d.createFixture(Circle(DOME_R), fixtureDef('shelf', CAT_STATIC, MASK.static));
    addEnt({ kind: 'launcher', body: d, r: DOME_R });
  }

  const byIndex = [];
  for (const o of level.objects) byIndex.push(build(o));
  for (const o of level.objects) if (o.t === 'rope') buildRope(o);

  function build(o) {
    const pos = Vec2(o.x, o.y);
    const ang = o.a || 0;
    switch (o.t) {
      case 'shelf': case 'pad': {
        const b = world.createBody({ type: 'static', position: pos, angle: ang });
        const poly = o.round ? chamferPoly(o.w, o.h, o.h * 0.45) : boxPoly(o.w, o.h);
        b.createFixture(Polygon(poly.map(([x, y]) => Vec2(x, y))), fixtureDef(o.t, CAT_STATIC, MASK.static));
        return addEnt({ kind: o.t, body: b, polys: [poly], w: o.w, h: o.h });
      }
      case 'mover': {
        const b = world.createBody({ type: 'kinematic', position: pos, angle: ang });
        const poly = chamferPoly(o.w, o.h, o.h * 0.45);
        b.createFixture(Polygon(poly.map(([x, y]) => Vec2(x, y))), fixtureDef('shelf', CAT_STATIC, MASK.static));
        const e = addEnt({ kind: 'mover', body: b, polys: [poly], w: o.w, h: o.h, track: { x0: o.x, y0: o.y, dx: o.dx || 0, dy: o.dy || 0, spin: !!o.spin } });
        movers.push({ e, o, x0: o.x, y0: o.y, a0: ang });
        return e;
      }
      case 'glass': case 'stone': case 'wood': {
        const b = world.createBody({ type: 'dynamic', position: pos, angle: ang, awake: startAwake, angularDamping: 0.05 });
        let shape;
        if (o.t === 'glass') shape = glassShape(o);
        else if (o.s === 'orb') shape = { circle: o.r, polys: [circlePoly(o.r, 10)], outline: circlePoly(o.r, 24) };
        else {
          const p = o.t === 'stone' ? chamferPoly(o.w, o.h, Math.min(o.w, o.h) * 0.12) : boxPoly(o.w, o.h);
          shape = { polys: [p], outline: p };
        }
        const fd = fixtureDef(o.t, CAT_DYN, MASK.dyn);
        if (shape.circle) b.createFixture(Circle(shape.circle), fd);
        else for (const p of shape.polys) b.createFixture(Polygon(p.map(([x, y]) => Vec2(x, y))), fd);
        const e = addEnt({ kind: o.t, sub: o.s || 'box', body: b, polys: shape.polys, outline: shape.outline, circle: shape.circle, w: o.w, h: o.h });
        if (o.t === 'glass') { st.glass++; e.tint = o.tint || 0; }
        return e;
      }
      case 'bomb': {
        const b = world.createBody({ type: 'dynamic', position: pos, awake: startAwake });
        b.createFixture(Circle(o.r || 0.34), fixtureDef('bomb', CAT_DYN, MASK.dyn));
        return addEnt({ kind: 'bomb', body: b, circle: o.r || 0.34 });
      }
      case 'rope':
        return null;
      default:
        throw new Error('unknown object ' + o.t);
    }
  }

  // rope from a static anchor (x,y), or a link hanging from another body (from: index)
  function buildRope(o) {
    const target = byIndex[o.to];
    if (!target) return;
    const tb = target.body;
    const top = o.top ?? (target.circle ? target.circle : (target.h || 0.5) / 2);
    const la = Vec2(0, top);
    const wp = tb.getWorldPoint(la);
    let A = null, laA = Vec2(0, 0), bodyA, ax = o.x, ay = o.y;
    if (o.from != null) {
      A = byIndex[o.from];
      if (!A) return;
      const bot = A.circle ? A.circle : (A.h || 0.5) / 2;
      laA = Vec2(0, -bot);
      bodyA = A.body;
      const ap = bodyA.getWorldPoint(laA); ax = ap.x; ay = ap.y;
    } else {
      bodyA = world.createBody({ type: 'static', position: Vec2(o.x, o.y) });
    }
    const len = o.len ?? Math.hypot(wp.x - ax, wp.y - ay);
    const j = world.createJoint(new RopeJoint({ bodyA, bodyB: tb, localAnchorA: laA, localAnchorB: la, maxLength: len, collideConnected: false }));
    ropes.push({ joint: j, A, laA, ax, ay, target, la });
    target.roped = true;
  }

  // ---------- contacts ----------
  world.on('pre-solve', (contact, oldManifold) => {
    const fa = contact.getFixtureA(), fb = contact.getFixtureB();
    const ea = fa.getBody().getUserData(), eb = fb.getBody().getUserData();
    if (!ea || !eb || ea.kind === 'shard' || eb.kind === 'shard') return;
    const wm = contact.getWorldManifold(null);
    if (!wm || !wm.pointCount) return;
    let px = 0, py = 0;
    for (let i = 0; i < wm.pointCount; i++) { px += wm.points[i].x; py += wm.points[i].y; }
    px /= wm.pointCount; py /= wm.pointCount;
    const p = Vec2(px, py);
    const va = ea.body.getLinearVelocityFromWorldPoint(p);
    const vb = eb.body.getLinearVelocityFromWorldPoint(p);
    const rvx = vb.x - va.x, rvy = vb.y - va.y;
    const approach = -(rvx * wm.normal.x + rvy * wm.normal.y);
    if (approach <= 0.3) return;
    let broke = false;
    for (const [e, other] of [[ea, eb], [eb, ea]]) {
      if (!e.alive) continue;
      if (e.kind === 'glass' && approach > (other.kind === 'ball' ? BALL_BREAK : BREAK_SPEED)) {
        if (!pendingBreak.has(e)) {
          const ov = other.body.getLinearVelocity();
          pendingBreak.set(e, { x: px, y: py, vx: ov.x, vy: ov.y, speed: approach, by: other.kind });
          if (other.kind === 'ball') damp.set(other, (damp.get(other) || 1) * PIERCE_KEEP);
        }
        broke = true;
      } else if (e.kind === 'bomb' && approach > BOMB_SPEED) {
        if (!pendingBomb.has(e)) pendingBomb.set(e, 0);
      }
    }
    if (broke) contact.setEnabled(false);
    else if (approach > 1.2 && oldManifold && oldManifold.pointCount === 0) {
      events.push({ type: 'hit', x: px, y: py, speed: approach, a: ea.kind, b: eb.kind });
    }
  });

  // ---------- breaking ----------
  function breakGlass(e, info) {
    if (!e.alive) return;
    const b = e.body;
    const c = b.getWorldCenter();
    const v = b.getLinearVelocity();
    const ev = { type: 'break', x: info.x ?? c.x, y: info.y ?? c.y, cx: c.x, cy: c.y, speed: info.speed || 6, by: info.by, sub: e.sub, tint: e.tint };
    if (visual) ev.shards = spawnShards(e, info, v);
    removeEnt(e);
    st.glass--;
    st.broken++;
    st.combo = st.comboTimer > 0 ? st.combo + 1 : 1;
    st.comboTimer = 0.9;
    st.maxCombo = Math.max(st.maxCombo, st.combo);
    ev.combo = st.combo;
    ev.last = st.glass === 0;
    events.push(ev);
    if (st.glass === 0 && !st.won) { st.won = true; events.push({ type: 'win' }); }
  }

  function explode(e) {
    if (!e.alive) return;
    const c = e.body.getPosition();
    const R = 2.8;
    removeEnt(e);
    events.push({ type: 'explode', x: c.x, y: c.y, r: R });
    for (const o of ents) {
      if (!o.alive || o === e) continue;
      const b = o.body;
      if (b.getType() !== 'dynamic') continue;
      const oc = b.getWorldCenter();
      const dx = oc.x - c.x, dy = oc.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      if (o.kind === 'bomb') { if (!pendingBomb.has(o)) pendingBomb.set(o, 6); continue; }
      if (o.kind === 'glass' && d < R * 0.62) { pendingBreak.set(o, { x: oc.x, y: oc.y, vx: dx * 3, vy: dy * 3, speed: 9, by: 'bomb' }); continue; }
      const k = d < 1e-3 ? 0 : 1 / d;
      const dv = 2 + 10 * (1 - d / R);
      const m = b.getMass();
      b.setAwake(true);
      b.applyLinearImpulse(Vec2(dx * k * dv * m, (dy * k + 0.25) * dv * m), oc, true);
    }
  }

  function removeEnt(e) {
    if (!e.alive) return;
    e.alive = false;
    for (let i = ropes.length - 1; i >= 0; i--) if (ropes[i].target === e || ropes[i].A === e) ropes.splice(i, 1);
    world.destroyBody(e.body);
  }

  // ---------- shards (visual only: they collide with static geometry only) ----------
  function clip(poly, nx, ny, d) {
    // keep the side where n·p >= d
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  function area(p) {
    let s = 0;
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  function centroid(p) {
    let cx = 0, cy = 0, A = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const cr = a[0] * b[1] - b[0] * a[1];
      A += cr; cx += (a[0] + b[0]) * cr; cy += (a[1] + b[1]) * cr;
    }
    A /= 2;
    return A ? [cx / (6 * A), cy / (6 * A)] : p[0];
  }
  function simplify(p) {
    const out = [];
    for (const q of p) {
      const l = out[out.length - 1];
      if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.012) out.push(q);
    }
    if (out.length > 2) { const f = out[0], l = out[out.length - 1]; if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 0.012) out.pop(); }
    return out;
  }

  function spawnShards(e, info, v) {
    const b = e.body;
    const local = b.getLocalPoint(Vec2(info.x, info.y));
    let pieces = [];
    const cuts = 3 + (rand() < 0.5 ? 1 : 0);
    const base = rand() * Math.PI;
    for (const poly of e.polys) {
      let set = [poly];
      for (let i = 0; i < cuts; i++) {
        const t = base + (i / cuts) * Math.PI + (rand() - 0.5) * 0.5;
        const nx = Math.cos(t), ny = Math.sin(t);
        const d = local.x * nx + local.y * ny;
        const next = [];
        for (const s of set) {
          const p1 = clip(s, nx, ny, d), p2 = clip(s, -nx, -ny, -d);
          if (p1.length >= 3) next.push(p1);
          if (p2.length >= 3) next.push(p2);
        }
        set = next;
      }
      // one ring cut on big pieces
      const out = [];
      for (const s of set) {
        const A = Math.abs(area(s));
        if (A > 0.06) {
          const cc = centroid(s);
          const t = rand() * Math.PI;
          const nx = Math.cos(t), ny = Math.sin(t), d = cc[0] * nx + cc[1] * ny;
          const p1 = clip(s, nx, ny, d), p2 = clip(s, -nx, -ny, -d);
          if (p1.length >= 3) out.push(p1);
          if (p2.length >= 3) out.push(p2);
        } else out.push(s);
      }
      pieces.push(...out);
    }
    const res = [];
    const ang = b.getAngle();
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const bp = b.getPosition();
    for (let p of pieces) {
      p = simplify(p);
      if (p.length < 3) continue;
      const A = Math.abs(area(p));
      if (A < 0.0025 || p.length > 8) { res.push({ dust: true, x: bp.x + centroid(p)[0] * ca - centroid(p)[1] * sa, y: bp.y + centroid(p)[0] * sa + centroid(p)[1] * ca }); continue; }
      const cc = centroid(p);
      const lp = p.map(([x, y]) => [x - cc[0], y - cc[1]]);
      const wx = bp.x + cc[0] * ca - cc[1] * sa, wy = bp.y + cc[0] * sa + cc[1] * ca;
      const sb = world.createBody({ type: 'dynamic', position: Vec2(wx, wy), angle: ang, angularDamping: 0.3, linearDamping: 0.05 });
      try {
        sb.createFixture(Polygon(lp.map(([x, y]) => Vec2(x, y))), { density: 1, friction: 0.5, restitution: 0.25, filterCategoryBits: CAT_SHARD, filterMaskBits: MASK.shard });
      } catch (err) { world.destroyBody(sb); continue; }
      const dx = wx - info.x, dy = wy - info.y, dl = Math.hypot(dx, dy) || 1;
      const burst = 1.2 + rand() * 2.2 + Math.min(info.speed, 14) * 0.12;
      const carry = info.by === 'ball' ? 0.28 : 0.1;
      sb.setLinearVelocity(Vec2(v.x * 0.6 + (dx / dl) * burst + (info.vx || 0) * carry, v.y * 0.6 + (dy / dl) * burst + (info.vy || 0) * carry + 1.2));
      sb.setAngularVelocity((rand() - 0.5) * 18);
      const sh = { kind: 'shard', body: sb, polys: [lp], life: 1.6 + rand() * 1.4, age: 0, tint: e.tint, alive: true };
      sb.setUserData(sh);
      shards.push(sh);
      res.push(sh);
    }
    // global cap
    while (shards.length > 160) { const s = shards.shift(); if (s.alive) { s.alive = false; world.destroyBody(s.body); } }
    return res;
  }

  // ---------- API ----------
  function fire(angle) {
    if (st.balls <= 0 || st.won) return false;
    if (st.time - st.lastFire < 0.28) return false;
    angle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, angle));
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const m = MUZZLE;
    const b = world.createBody({ type: 'dynamic', bullet: true, position: Vec2(lx + dx * m, PIVOT_Y + dy * m), angularDamping: 0.6 });
    b.createFixture(Circle(BALL_R), fixtureDef('ball', CAT_BALL, MASK.ball));
    b.setLinearVelocity(Vec2(dx * speed, dy * speed));
    const e = addEnt({ kind: 'ball', body: b, circle: BALL_R, age: 0, slow: 0 });
    st.balls--; st.used++;
    st.lastFire = st.time;
    queued.push({ type: 'fire', angle, x: lx, y: PIVOT_Y, ball: e });
    return e;
  }

  function step(dt = DT) {
    events.length = 0;
    if (queued.length) { events.push(...queued); queued.length = 0; }
    st.step++;
    if (st.step % 240 === 0) { let k = 0; for (const e of ents) if (e.alive) ents[k++] = e; ents.length = k; }
    st.time += dt;
    // movers
    for (const m of movers) {
      const o = m.o, b = m.e.body, T = o.period || 4, t1 = st.time + dt;
      if (o.spin) b.setAngularVelocity(o.spin);
      if (o.dx || o.dy) {
        const ph = Math.sin((t1 / T) * Math.PI * 2 + (o.phase || 0));
        const tx = m.x0 + (o.dx || 0) * ph, ty = m.y0 + (o.dy || 0) * ph;
        const p = b.getPosition();
        b.setLinearVelocity(Vec2((tx - p.x) / dt, (ty - p.y) / dt));
      }
    }
    world.step(dt, 8, 3);
    // resolve breaks and bombs
    if (pendingBreak.size) {
      for (const [e, info] of pendingBreak) breakGlass(e, info);
      pendingBreak.clear();
    }
    if (pendingBomb.size) {
      for (const [e, d] of [...pendingBomb]) {
        if (d <= 0) { pendingBomb.delete(e); explode(e); }
        else pendingBomb.set(e, d - 1);
      }
      if (pendingBreak.size) { for (const [e, info] of pendingBreak) breakGlass(e, info); pendingBreak.clear(); }
    }
    if (damp.size) {
      for (const [e, f] of damp) if (e.alive) { const v = e.body.getLinearVelocity(); e.body.setLinearVelocity(Vec2(v.x * f, v.y * f)); }
      damp.clear();
    }
    if (st.comboTimer > 0) { st.comboTimer -= dt; if (st.comboTimer <= 0) st.combo = 0; }

    // balls lifecycle, out of bounds, settle detection
    let live = 0, moving = false;
    for (const e of ents) {
      if (!e.alive) continue;
      const b = e.body;
      if (b.getType() !== 'dynamic') continue;
      const p = b.getPosition();
      if (p.y < -4 || p.x < -3 || p.x > W + 3) {
        if (e.kind === 'glass') breakGlass(e, { x: p.x, y: p.y, speed: 5 });
        else { removeEnt(e); if (e.kind === 'ball') events.push({ type: 'ballGone' }); }
        continue;
      }
      const v = b.getLinearVelocity();
      const sp = Math.hypot(v.x, v.y);
      if (e.kind === 'ball') {
        e.age += dt;
        e.slow = sp < 0.7 ? e.slow + dt : 0;
        if (e.slow > 0.45 || e.age > 9) { e.fading = true; removeEnt(e); events.push({ type: 'ballGone', x: p.x, y: p.y }); continue; }
        live++;
        moving = true;
      } else if (b.isAwake() && (sp > 0.25 || Math.abs(b.getAngularVelocity()) > 0.4)) moving = true;
    }
    if (pendingBomb.size) moving = true;
    st.live = live;
    st.quietSteps = moving ? 0 : st.quietSteps + 1;
    if (!st.won && !st.lost && st.balls <= 0 && live === 0) {
      st.sinceEmpty += dt;
      if (st.quietSteps > 24 || st.sinceEmpty > 7) { st.lost = true; events.push({ type: 'lose' }); }
    } else st.sinceEmpty = 0;

    // shards aging (visual)
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.age += dt;
      if (s.age > s.life || !s.alive) {
        if (s.alive) { s.alive = false; world.destroyBody(s.body); }
        shards.splice(i, 1);
      }
    }
    return events;
  }

  function addBall() { st.balls++; st.lost = false; st.sinceEmpty = 0; }

  return {
    world, ents, shards, ropes, st, events, level, launcherX: lx, speed,
    fire, step, addBall,
    alive: () => ents.filter((e) => e.alive),
  };
}

// Trajectory preview: march the ballistic path until it meets a non-ball fixture. With bounces > 0
// the path carries on off static geometry (walls, ceiling, shelves, pads) like a pool-game guide line.
const BOUNCE_E = { frame: 0.72, shelf: 0.5, launcher: 0.5, mover: 0.5, pad: 1.15 };
export function previewPath(planck, sim, angle, maxT = 1.6, stepT = 1 / 30, bounces = 0) {
  const { Vec2 } = planck;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const m = MUZZLE;
  let x = sim.launcherX + dx * m, y = PIVOT_Y + dy * m;
  let vx = dx * sim.speed, vy = dy * sim.speed;
  const segs = [];
  let pts = [[x, y]], hit = null;
  for (let b = 0; b <= bounces; b++) {
    hit = null;
    for (let t = 0; t < (b ? maxT * 0.6 : maxT); t += stepT) {
      const nx = x + vx * stepT, nvy = vy - 10 * stepT, ny = y + vy * stepT - 5 * stepT * stepT;
      // the ball's width is approximated with three parallel rays
      let best = null;
      const len = Math.hypot(nx - x, ny - y) || 1;
      const ox = -(ny - y) / len * BALL_R * 0.9, oy = (nx - x) / len * BALL_R * 0.9;
      for (const [sx, sy] of [[0, 0], [ox, oy], [-ox, -oy]]) {
        sim.world.rayCast(Vec2(x + sx, y + sy), Vec2(nx + sx, ny + sy), (fix, point, normal, fraction) => {
          const e = fix.getBody().getUserData();
          if (!e || e.kind === 'shard' || e.kind === 'ball') return -1;
          if (!best || fraction < best.f) best = { f: fraction, px: point.x, py: point.y, nx: normal.x, ny: normal.y, kind: e.kind, center: sx === 0 && sy === 0 };
          return fraction;
        });
      }
      if (best) {
        let hx = x + (nx - x) * best.f, hy = y + (ny - y) * best.f;
        if (best.center) { hx = best.px + best.nx * BALL_R; hy = best.py + best.ny * BALL_R; }
        pts.push([hx, hy]);
        hit = { kind: best.kind, x: hx, y: hy, nx: best.nx, ny: best.ny };
        vy = vy - 10 * stepT * best.f;
        x = hx; y = hy;
        break;
      }
      x = nx; y = ny; vy = nvy;
      pts.push([x, y]);
    }
    segs.push({ pts, hit });
    const e = hit && BOUNCE_E[hit.kind];
    if (!hit || e === undefined || b === bounces) break;
    // mirror the velocity about the contact normal and carry on
    const vn = vx * hit.nx + vy * hit.ny;
    if (vn >= 0) break;
    vx -= (1 + e) * vn * hit.nx; vy -= (1 + e) * vn * hit.ny;
    x += hit.nx * 0.02; y += hit.ny * 0.02;
    pts = [[x, y]];
  }
  return { pts: segs[0].pts, hit: segs[0].hit, pts2: segs[1]?.pts || null, hit2: segs[1]?.hit || null };
}

// Exact aim guide: fly a ghost ball through a copy of the static geometry using the same physics,
// with every movable object as a sensor that ends the path. Stops at the first movable object, or
// after `bounces` bounces off static geometry.
export function ghostPath(planck, sim, angle, bounces = 1, maxSteps = 110) {
  const { World, Vec2, Circle } = planck;
  const g = new World({ gravity: Vec2(0, -10) });
  for (const e of sim.ents) {
    if (!e.alive || e.kind === 'ball') continue;
    const b = e.body;
    if (!b.getFixtureList()) continue;
    const solid = b.getType() !== 'dynamic';
    const gb = g.createBody({ type: 'static', position: b.getPosition(), angle: b.getAngle() });
    for (let f = b.getFixtureList(); f; f = f.getNext()) {
      gb.createFixture(f.getShape(), { density: 0, friction: f.getFriction(), restitution: f.getRestitution(), isSensor: !solid });
    }
    gb.setUserData({ kind: e.kind, solid });
  }
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const ball = g.createBody({ type: 'dynamic', bullet: true, position: Vec2(sim.launcherX + dx * MUZZLE, PIVOT_Y + dy * MUZZLE), angularDamping: 0.6 });
  ball.createFixture(Circle(BALL_R), { density: MAT.ball.density, friction: MAT.ball.friction, restitution: MAT.ball.restitution });
  ball.setLinearVelocity(Vec2(dx * sim.speed, dy * sim.speed));
  let touch = null;
  g.on('begin-contact', (c) => {
    if (touch) return;
    const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
    const other = a === ball ? b : b === ball ? a : null;
    if (!other) return;
    const ud = other.getUserData();
    if (!ud) return;
    const wm = c.getWorldManifold(null);
    const p = wm && wm.pointCount ? wm.points[0] : ball.getPosition();
    touch = { kind: ud.kind, solid: ud.solid, px: p.x, py: p.y };
  });
  const segs = [[]];
  let hits = [];
  const start = ball.getPosition();
  segs[0].push([start.x, start.y]);
  for (let i = 0; i < maxSteps; i++) {
    touch = null;
    g.step(DT, 8, 3);
    const p = ball.getPosition();
    segs[segs.length - 1].push([p.x, p.y]);
    if (touch) {
      hits.push({ kind: touch.kind, x: p.x, y: p.y });
      if (!touch.solid || segs.length > bounces || BOUNCE_KINDS.indexOf(touch.kind) < 0) break;
      segs.push([[p.x, p.y]]);
    }
  }
  return { pts: segs[0], hit: hits[0] || null, pts2: segs[1] || null, hit2: hits[1] || null };
}
const BOUNCE_KINDS = ['frame', 'shelf', 'launcher', 'mover', 'pad'];
