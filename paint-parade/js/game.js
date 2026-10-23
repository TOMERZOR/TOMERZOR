// The play screen: runs the engine on a fixed clock, turns engine events into
// juice (projectiles, splats, pops, sounds, haptics) and handles taps.
import { createGame, step, launchLane, launchSlot, laneBlock, beltLoad, addSlot, addRainbow, revive, progress, WILD, freeSlots, exposure, exposedColors } from './engine.js';
import { computeLayout, trackPoint, laneSlotPos, slotPos, drawBackground, drawBoardFrame, drawBelt, drawBucket, makeBoardCache, paintCell, FX, rr, mix } from './render.js';
import { sfx } from './audio.js';
import { haptic, track } from './platform.js';
import { bestMove } from './bot.js';

// ?speed=4 runs the clock faster for automated playtests.
const QA_SPEED = Math.max(1, Math.min(8, Number(new URLSearchParams(location.search).get('speed')) || 1));

const THEMES = [
  ['#fbe9ff', '#ffe6d6', '#ff8ac6', '#ffd23f', '#5ccfff'],
  ['#e6f6ff', '#f1e8ff', '#5ccfff', '#9b5cff', '#3fcf6b'],
  ['#fff4dc', '#ffe3ec', '#ff9233', '#ff8ac6', '#ffd23f'],
  ['#e9fff1', '#e6f0ff', '#3fcf6b', '#5ccfff', '#b8ec4a'],
];

export class Game {
  constructor(canvas, hooks) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks; // { onWin, onFail, onProgress, onEvent, safe(), hud() }
    this.fx = new FX();
    this.running = false;
    this.paused = false;
    this.time = 0;
    this.grab = false;
    this.bound = (e) => this.onPointer(e);
    canvas.addEventListener('pointerdown', this.bound);
    this.loop = this.loop.bind(this);
  }

  start(level, opts = {}) {
    this.level = level;
    this.st = createGame(level);
    if (opts.extraSlots) addSlot(this.st, opts.extraSlots);
    this.maxCoats = this.st.coats.slice();
    this.vis = this.st.coats.slice();
    this.exp = exposure(level.w, level.h, level.cells, this.vis);
    this.awakeKey = -1;
    this.parksShown = 0;
    this.sleepyTold = false;
    this.heartT = 0;
    this.anims = new Map(); // cell -> pop start time
    this.shotAt = new Map(); // bucket -> last splash time (squash)
    this.lapShots = new Map(); // bucket -> splashes since launch
    this.milestone = 0;
    this.proj = [];
    this.fly = [];          // buckets hopping from lane/slot to the belt
    this.pops = [];
    this.parking = [];      // buckets sliding from the belt into a waiting spot
    this.slide = new Map(); // bucket -> drawn lane depth (eases toward the real one)
    this.winT = 0;
    this.combo = 0; this.lastSplat = 0;
    this.acc = 0;
    this.phase = 0;
    this.endT = 0;
    this.done = false;
    this.grab = false;
    this.hint = null; this.hintT = 0;
    this.idleT = 0;
    this.theme = THEMES[(level.level || 0) % THEMES.length];
    this.tickRate = Math.max(10, Math.min(24, this.st.L / 4.2)) * QA_SPEED;
    this.blinkSeed = Math.random() * 100;
    this.tutorial = opts.tutorial || null;
    this.resize();
    this.paused = false;
    if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this.loop); }
    this.hooks.onProgress && this.hooks.onProgress(0);
  }

  stop() { this.running = false; }

  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    this.dpr = dpr;
    if (!this.level) return;
    this.L = computeLayout(W, H, this.hooks.safe(), this.level, this.hooks.hud());
    this.cache = makeBoardCache(this.level, this.L, dpr);
    for (let i = 0; i < this.level.cells.length; i++) paintCell(this.cache, this.level, this.L, i, this.vis, this.maxCoats, this.exp);
  }

  // ------------------------------------------------------------ input
  onPointer(e) {
    if (!this.st || this.paused || this.done || this.st.status !== 'play') return;
    const r = this.cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const L = this.L;
    // waiting spots
    for (let i = 0; i < this.st.slots.length; i++) {
      const p = slotPos(L, i);
      if (Math.abs(x - p.x) < L.slotS * 0.62 && Math.abs(y - p.y) < L.slotS * 0.7) {
        if (!this.st.slots[i]) return;
        if (launchSlot(this.st, i)) this.afterLaunch();
        else this.blocked('full');
        return;
      }
    }
    // lanes
    if (y > L.lanesTop - 10 && y < L.lanesTop + L.rowsVisible * L.B * 0.9 + 16) {
      const li = Math.floor((x - L.lanesX0) / L.laneW);
      if (li < 0 || li >= this.st.lanes.length) return;
      if (this.grab) {
        const depth = Math.max(0, Math.min(this.st.lanes[li].length - 1, Math.floor((y - L.lanesTop) / (L.B * 0.9))));
        if (this.st.lanes[li][depth] && launchLane(this.st, li, depth)) {
          this.grab = false;
          this.hooks.onEvent && this.hooks.onEvent({ type: 'grabUsed' });
          this.afterLaunch();
        } else this.blocked('full');
        return;
      }
      const why = laneBlock(this.st, li);
      if (!why && launchLane(this.st, li)) this.afterLaunch();
      else if (why && why !== 'empty') this.blocked(why, li);
    }
  }

  afterLaunch() {
    sfx.launch(); haptic.light();
    this.hint = null; this.idleT = 0;
    this.hooks.onEvent && this.hooks.onEvent({ type: 'launch' });
  }

  blocked(why, li) {
    sfx.blocked(); haptic.medium();
    this.blockedT = this.time; this.blockedWhy = why; this.blockedLane = li;
    this.hooks.onEvent && this.hooks.onEvent({ type: 'blocked', why });
  }

  // ------------------------------------------------------------ boosters
  useSlot() { addSlot(this.st, 1); this.resizeKeep(); sfx.unlock(); haptic.success(); }
  useRainbow() { addRainbow(this.st, 12); sfx.unlock(); haptic.success(); }
  setGrab(on) { this.grab = on; }
  doRevive() { const ok = revive(this.st); if (ok) { this.resizeKeep(); this.paused = false; } return ok; }
  resizeKeep() {
    this.L = computeLayout(window.innerWidth, window.innerHeight, this.hooks.safe(), { ...this.level, slots: this.st.slots.length }, this.hooks.hud());
  }

  showHint() {
    const b = bestMove(this.st);
    if (b) { this.hint = b.m; this.hintT = this.time; }
  }

  // ------------------------------------------------------------ loop
  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.time += dt;
    this.dt = dt;
    const st = this.st;
    if (st.status === 'play') {
      this.acc += dt * this.tickRate;
      let guard = 0;
      while (this.acc >= 1 && guard++ < 4) {
        this.acc -= 1;
        step(st);
        this.handleEvents();
        if (st.status !== 'play') { this.acc = 0; break; }
      }
      this.phase += dt * this.tickRate;
      if (st.slots.length && freeSlots(st) <= 1 && this.time - this.heartT > 1.1) { this.heartT = this.time; sfx.heart(); }
      if (!this.sleepyTold && st.lanes.some((l) => l[0] && !l[0].hidden && !this.awake(l[0]))) { this.sleepyTold = true; this.hooks.onEvent && this.hooks.onEvent({ type: 'sleepyFront' }); }
      // tutorial / stuck hints
      if (st.belt.length === 0 && st.pending.length === 0) this.idleT += dt; else this.idleT = 0;
      if (this.tutorial && this.tutorial.hint && !this.hint && this.idleT > 0.6) this.showHint();
    } else this.handleEvents();
    // projectiles
    for (const p of this.proj) {
      p.t += dt;
      if (p.t >= p.dur && !p.landed) {
        p.landed = true;
        this.vis[p.cell]--;
        // repaint the splashed pixel and every pixel whose reachability changed
        const exp = exposure(this.level.w, this.level.h, this.level.cells, this.vis);
        for (let i = 0; i < exp.length; i++) if (exp[i] !== this.exp[i]) { this.exp[i] = exp[i]; if (i !== p.cell) paintCell(this.cache, this.level, this.L, i, this.vis, this.maxCoats, this.exp); }
        paintCell(this.cache, this.level, this.L, p.cell, this.vis, this.maxCoats, this.exp);
        this.anims.set(p.cell, this.time);
        const cx = this.L.bx + (p.cell % this.level.w + 0.5) * this.L.cs, cy = this.L.by + (Math.floor(p.cell / this.level.w) + 0.5) * this.L.cs;
        this.fx.splat(cx, cy, p.col, this.L.cs > 14 ? 6 : 4);
        if (this.L.cs >= 9) this.fx.ripple(cx, cy, p.col, this.L.cs * 1.1);
        if (this.time - this.lastSplat < 0.4) this.combo++; else this.combo = 0;
        this.lastSplat = this.time;
        sfx.splat(this.combo); haptic.tick();
      }
    }
    this.proj = this.proj.filter((p) => !p.landed);
    for (const f of this.fly) f.t += dt;
    this.fly = this.fly.filter((f) => f.t < f.dur);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.6);
    for (const p of this.parking) p.t += dt;
    this.parking = this.parking.filter((p) => p.t < p.dur);
    if (this.fireworks) {
      for (const f of this.fireworks) if (!f.done && this.time >= f.at) { f.done = true; this.fx.burst(f.x, f.y, f.cols, 30, 200 + Math.random() * 80); sfx.pop(); }
      this.fireworks = this.fireworks.filter((f) => !f.done);
    }
    for (const [i, t0] of this.anims) if (this.time - t0 > 0.25) this.anims.delete(i);
    this.fx.update(dt);
    // end of level once the last splash has landed
    if (!this.done && st.status === 'win' && this.proj.length === 0) {
      if (!this.endT) this.endT = this.time;
      if (this.time - this.endT > 0.35) { this.done = true; this.celebrate(); }
    }
  }

  handleEvents() {
    const st = this.st, L = this.L;
    for (const e of st.events) {
      if (e.type === 'shot') {
        const from = trackPoint(L, e.from);
        const cx = L.bx + (e.cell % this.level.w + 0.5) * L.cs, cy = L.by + (Math.floor(e.cell / this.level.w) + 0.5) * L.cs;
        const d = Math.hypot(cx - from.x, cy - from.y);
        this.proj.push({ x0: from.x, y0: from.y, x1: cx, y1: cy, t: 0, dur: Math.min(0.32, 0.08 + d / 1400), cell: e.cell, col: this.level.colors[e.c] });
        this.shotAt.set(e.id, this.time);
        this.lapShots.set(e.id, (this.lapShots.get(e.id) || 0) + 1);
        st.stats && (this.splats = (this.splats || 0) + 1);
        const pr = progress(st);
        this.hooks.onProgress && this.hooks.onProgress(pr);
        if (pr >= 0.5 && this.milestone < 1) { this.milestone = 1; this.fx.text(L.W / 2, L.by + L.bh / 2, this.hooks.t ? this.hooks.t('halfway') : 'Halfway!', '#ffffff', 26); }
      } else if (e.type === 'launch') {
        let from;
        if (e.lane >= 0) from = laneSlotPos(L, e.lane, 0);
        else if (e.slot >= 0) from = slotPos(L, e.slot);
        else from = { x: L.W / 2, y: L.H - 60 };
        this.fly.push({ id: e.id, x0: from.x, y0: from.y, t: 0, dur: 0.22 });
      } else if (e.type === 'pop') {
        const s = this.findShooterPos(e.id);
        if (s) {
          const b = this.lastBucket && this.lastBucket.get(e.id);
          this.pops.push({ x: s.x, y: s.y, t: 0, col: b ? this.colorOf(b) : '#ffffff', dir: Math.random() < 0.5 ? -1 : 1 });
          this.fx.sparkle(s.x, s.y - L.T * 0.3, 9, 70);
          this.fx.ring(s.x, s.y, '#ffffff', L.T * 0.9);
          const n = this.lapShots.get(e.id) || 0;
          if (n >= 12) this.fx.text(s.x, Math.max(L.top + 30, s.y - 18), n >= 30 ? 'AMAZING!' : n >= 20 ? 'GREAT!' : 'NICE!', n >= 30 ? '#ffd23f' : '#ffffff', n >= 30 ? 22 : 18);
        }
        sfx.pop(); haptic.light();
      } else if (e.type === 'park') {
        sfx.park();
        const sp = slotPos(L, e.slot);
        const from = this.lastPos && this.lastPos.get(e.id);
        if (from) this.parking.push({ id: e.id, x0: from.x, y0: from.y, slot: e.slot, t: 0, dur: 0.32 });
        if (this.parksShown++ < 4) this.fx.text(sp.x, sp.y - L.slotS * 0.7, this.hooks.t ? this.hooks.t('oops') : 'Oops!', '#ff4b5c', 18);
        if (freeSlots(st) <= 1) { sfx.warn(); haptic.medium(); this.dangerT = this.time; }
        this.hooks.onEvent && this.hooks.onEvent({ type: 'park', free: freeSlots(st) });
      } else if (e.type === 'reveal') {
        const p = laneSlotPos(L, e.lane, 0);
        this.fx.ring(p.x, p.y, '#ffd23f', 30); sfx.reveal();
      } else if (e.type === 'fail') {
        sfx.fail(); haptic.heavy(); this.fx.shake = 10;
        setTimeout(() => this.hooks.onFail && this.hooks.onFail(e.reason || this.st.failReason), 650);
      } else if (e.type === 'win') {
        this.hooks.onProgress && this.hooks.onProgress(1);
      }
    }
    st.events.length = 0;
  }

  findShooterPos(id) {
    // a bucket that just popped is gone from the engine; use its last belt position
    const s = this.lastPos && this.lastPos.get(id);
    return s || null;
  }

  celebrate() {
    const L = this.L;
    sfx.win(); haptic.success();
    this.fx.confetti(L.W * 0.25, L.by + L.bh * 0.6, 50, 1.2);
    this.fx.confetti(L.W * 0.75, L.by + L.bh * 0.6, 50, 1.2);
    this.fx.sparkle(L.bx + L.bw / 2, L.by + L.bh / 2, 16, Math.min(L.bw, L.bh) * 0.6);
    // three fireworks in the artwork's own colors
    const cols = this.level.colors.concat(['#ffffff']);
    this.fireworks = [0.15, 0.4, 0.65].map((dt, k) => ({ at: this.time + dt, x: L.bx + L.bw * (0.22 + 0.28 * k) + (Math.random() - 0.5) * 30, y: L.by + L.bh * (0.15 + Math.random() * 0.3), cols }));
    this.winT = this.time;
    track('level_win', { level: this.level.level, ticks: this.st.tick });
    setTimeout(() => this.hooks.onWin && this.hooks.onWin(this.st), 1500);
  }

  // ------------------------------------------------------------ draw
  draw() {
    const ctx = this.ctx, L = this.L, st = this.st;
    if (!L) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackground(ctx, L, this.time, this.theme);
    ctx.save();
    if (this.fx.shake > 0) ctx.translate((Math.random() - 0.5) * this.fx.shake, (Math.random() - 0.5) * this.fx.shake);
    const danger = st.status === 'play' && freeSlots(st) <= 1 && st.slots.length > 0;
    drawBelt(ctx, L, this.phase, danger && Math.sin(this.time * 8) > 0);
    ctx.save();
    if (this.winT) {
      const k = (this.time - this.winT) / 0.55;
      if (k < 1) {
        const z = 1 + Math.sin(k * Math.PI) * 0.06 * (1 - k * 0.5);
        const cx = L.bx + L.bw / 2, cy = L.by + L.bh / 2;
        ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy);
      }
    }
    drawBoardFrame(ctx, L);
    ctx.drawImage(this.cache.canvas, L.bx, L.by, L.bw, L.bh);
    // pop-in animation on freshly painted pixels
    for (const [i, t0] of this.anims) {
      const k = (this.time - t0) / 0.25;
      const s = 1 + Math.sin(k * Math.PI) * 0.45;
      const x = L.bx + (i % this.level.w + 0.5) * L.cs, y = L.by + (Math.floor(i / this.level.w) + 0.5) * L.cs;
      const c = this.level.colors[this.level.cells[i]];
      ctx.fillStyle = this.vis[i] <= 0 ? c : mix(c, '#f4f0fa', 0.45);
      const h = L.cs * s / 2;
      ctx.fillRect(x - h, y - h, h * 2, h * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
      ctx.fillRect(x - h, y - h, h * 2, h * 2);
    }
    // win shine sweep
    if (this.winT) {
      const k = (this.time - this.winT) / 0.9;
      if (k < 1) {
        ctx.save();
        ctx.beginPath(); ctx.rect(L.bx, L.by, L.bw, L.bh); ctx.clip();
        const x = L.bx - L.bw * 0.5 + (L.bw * 2) * k;
        const g = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(L.bx, L.by, L.bw, L.bh);
        ctx.restore();
      }
    }
    ctx.restore();
    this.drawProjectiles(ctx);
    this.drawBeltBuckets(ctx);
    this.drawSlots(ctx);
    this.drawLanes(ctx);
    this.drawParking(ctx);
    this.drawFly(ctx);
    this.drawCapacity(ctx);
    ctx.restore();
    this.fx.draw(ctx);
    this.drawHint(ctx);
  }

  drawProjectiles(ctx) {
    const r = Math.max(2.5, this.L.cs * 0.34);
    const at = (p, k) => ({ x: p.x0 + (p.x1 - p.x0) * k, y: p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 12 });
    ctx.lineCap = 'round';
    for (const p of this.proj) {
      const k = Math.min(1, p.t / p.dur);
      const h = at(p, k);
      // trail: three shrinking strokes behind the blob
      for (let j = 3; j >= 1; j--) {
        const t = at(p, Math.max(0, k - j * 0.09));
        ctx.globalAlpha = 0.55 - j * 0.13;
        ctx.strokeStyle = p.col; ctx.lineWidth = r * (2 - j * 0.42);
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(h.x, h.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // blob stretched along its flight
      const t = at(p, Math.max(0, k - 0.05));
      const ang = Math.atan2(h.y - t.y, h.x - t.x);
      const st = 1 + Math.min(0.6, Math.hypot(h.x - t.x, h.y - t.y) / (r * 3));
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.ellipse(0, 0, r * st, r / Math.sqrt(st), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(r * 0.2, -r * 0.35, r * 0.4, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  colorOf(s) { return s.c === WILD ? WILD : this.level.colors[s.c]; }

  // Which colors the belt can reach right now (cached until a pixel gets painted).
  awake(s) {
    if (this.awakeKey !== this.st.left) { this.awakeKey = this.st.left; this.awakeSet = exposedColors(this.st); }
    return s.c === WILD || this.awakeSet.has(s.c);
  }

  drawBeltBuckets(ctx) {
    const L = this.L, st = this.st;
    const size = L.T * 1.05;
    this.lastPos = this.lastPos || new Map();
    this.lastBucket = this.lastBucket || new Map();
    const alpha = st.status === 'play' ? this.acc : 0;
    for (const s of st.belt) {
      const f = s.steps === 0 ? 0 : s.p - 1 + alpha;
      const pt = trackPoint(L, f);
      this.lastPos.set(s.id, pt);
      this.lastBucket.set(s.id, s);
      if (this.isFlying(s.id)) continue;
      const bob = Math.sin(this.time * 10 + s.id) * 1.2;
      const k = this.time - (this.shotAt.get(s.id) || -9);
      const squash = k < 0.14 ? Math.sin(k / 0.14 * Math.PI) * 0.7 : 0;
      drawBucket(ctx, pt.x, pt.y - size * 0.05 + bob, size, this.colorOf(s), s.n, { blink: this.blink(s.id), look: 0, squash, sleepy: !this.awake(s), t: this.time + s.id });
    }
    // waiting to step on: stack them at the entry
    st.pending.forEach((s, k) => {
      if (this.isFlying(s.id)) return;
      const e = L.track[0];
      this.lastPos.set(s.id, e);
      drawBucket(ctx, e.x - k * 4, e.y - k * 6, size, this.colorOf(s), s.n, { blink: this.blink(s.id), sleepy: !this.awake(s), t: this.time + s.id });
    });
    // an emptied bucket hops off the belt, spins and vanishes in a puff
    for (const p of this.pops) {
      const k = p.t / 0.6;
      const x = p.x + p.dir * k * L.T * 0.9;
      const y = p.y - Math.sin(Math.min(1, k * 1.4) * Math.PI) * L.T * 1.3 + k * k * L.T * 0.6;
      const sz = size * (k < 0.15 ? 1 + k * 1.6 : 1.24 * (1 - (k - 0.15) / 0.85 * 0.8));
      drawBucket(ctx, x, y, sz, p.col, '', { rot: p.dir * k * Math.PI * 1.6, alpha: Math.min(1, (1 - k) * 2.2), blink: true });
      if (k < 0.35) {
        const a = 1 - k / 0.35;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, L.T * (0.5 + k * 2));
        g.addColorStop(0, `rgba(255,255,255,${0.85 * a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, L.T * (0.5 + k * 2), 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  isFlying(id) { return this.fly.some((f) => f.id === id); }

  drawFly(ctx) {
    const L = this.L, st = this.st;
    for (const f of this.fly) {
      const s = st.belt.find((b) => b.id === f.id) || st.pending.find((b) => b.id === f.id);
      if (!s) continue;
      const k = Math.min(1, f.t / f.dur);
      const e = L.track[0];
      const x = f.x0 + (e.x - f.x0) * k, y = f.y0 + (e.y - f.y0) * k - Math.sin(k * Math.PI) * 50;
      const size = L.B * (1 - k) + L.T * 1.05 * k;
      drawBucket(ctx, x, y, size, this.colorOf(s), s.n, { squash: Math.sin(k * Math.PI) * -0.6 });
    }
  }

  drawSlots(ctx) {
    const L = this.L, st = this.st;
    const danger = this.dangerT && this.time - this.dangerT < 1.2;
    for (let i = 0; i < st.slots.length; i++) {
      const p = slotPos(L, i);
      const s = L.slotS;
      // a recessed socket: dark inside, lit bottom rim
      const x0 = p.x - s / 2, y0 = p.y - s / 2, rad = s * 0.26;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      rr(ctx, x0 - 2, y0 - 1, s + 4, s + 5, rad + 2); ctx.fill();
      const g = ctx.createLinearGradient(0, y0, 0, y0 + s);
      g.addColorStop(0, 'rgba(52,30,96,0.42)'); g.addColorStop(0.35, 'rgba(70,44,120,0.24)'); g.addColorStop(1, 'rgba(90,60,150,0.14)');
      ctx.fillStyle = g; rr(ctx, x0, y0, s, s, rad); ctx.fill();
      ctx.save(); rr(ctx, x0, y0, s, s, rad); ctx.clip();
      ctx.strokeStyle = 'rgba(30,15,60,0.28)'; ctx.lineWidth = 6;
      rr(ctx, x0 - 2, y0 + 1, s + 4, s + 6, rad); ctx.stroke();
      ctx.restore();
      if (danger && !st.slots[i]) {
        ctx.strokeStyle = `rgba(255,75,92,${0.55 + 0.45 * Math.sin(this.time * 16)})`; ctx.lineWidth = 3;
        rr(ctx, x0, y0, s, s, rad); ctx.stroke();
      }
      const b = st.slots[i];
      if (b && !this.isFlying(b.id) && !this.parking.some((q) => q.id === b.id)) {
        const aw = this.awake(b);
        drawBucket(ctx, p.x, p.y + s * 0.04 + (aw ? Math.sin(this.time * 4 + i) * 1.2 : 0), s * 0.92, this.colorOf(b), b.n, { blink: this.blink(b.id), sleepy: !aw, t: this.time + b.id });
      }
    }
  }

  drawParking(ctx) {
    const L = this.L, st = this.st;
    for (const q of this.parking) {
      const b = st.slots[q.slot];
      if (!b || b.id !== q.id) continue;
      const k = Math.min(1, q.t / q.dur), e = 1 - Math.pow(1 - k, 3);
      const to = slotPos(L, q.slot);
      const x = q.x0 + (to.x - q.x0) * e, y = q.y0 + (to.y - q.y0) * e - Math.sin(k * Math.PI) * 30;
      const size = L.T * 1.05 + (L.slotS * 0.92 - L.T * 1.05) * e;
      const land = k > 0.8 ? Math.sin((k - 0.8) / 0.2 * Math.PI) * 0.6 : 0;
      drawBucket(ctx, x, y, size, this.colorOf(b), b.n, { squash: land, sleepy: !this.awake(b), t: this.time + b.id });
    }
  }

  drawLanes(ctx) {
    const L = this.L, st = this.st;
    const shake = this.blockedT && this.time - this.blockedT < 0.3 ? Math.sin((this.time - this.blockedT) * 60) * 4 : 0;
    for (let li = 0; li < st.lanes.length; li++) {
      const lane = st.lanes[li];
      const x = L.lanesX0 + L.laneW * (li + 0.5);
      // lane track
      const tw = L.laneW * 0.84, th = L.rowsVisible * L.B * 0.9 + 8, tx = x - tw / 2, ty = L.lanesTop - 6;
      const g = ctx.createLinearGradient(0, ty, 0, ty + th);
      g.addColorStop(0, 'rgba(60,36,110,0.2)'); g.addColorStop(1, 'rgba(60,36,110,0.04)');
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, tx - 1.5, ty, tw + 3, th + 3, 18); ctx.fill();
      ctx.fillStyle = g; rr(ctx, tx, ty, tw, th, 16); ctx.fill();
      const blockedHere = this.blockedLane === li && shake;
      for (let d = Math.min(lane.length, L.rowsVisible) - 1; d >= 0; d--) {
        const s = lane[d];
        let dd = this.slide.has(s.id) ? this.slide.get(s.id) : d;
        dd = Math.abs(dd - d) < 0.01 ? d : dd + (d - dd) * (1 - Math.exp(-(this.dt || 0.016) * 16));
        this.slide.set(s.id, dd);
        const p = laneSlotPos(L, li, dd);
        const front = d === 0;
        const why = front ? laneBlock(st, li) : 'x';
        const size = L.B * (front ? 1 : 0.9);
        const aw = s.hidden || this.awake(s);
        const bob = front && !why && aw ? Math.abs(Math.sin(this.time * 5 + li)) * -3 : 0;
        if (front && aw && !s.hidden && !why) {
          // soft glow under a bucket that can paint right now
          const gy = p.y + size * 0.4, pulse = 0.75 + 0.25 * Math.sin(this.time * 5 + li);
          const g = ctx.createRadialGradient(p.x, gy, 0, p.x, gy, size * 0.6);
          g.addColorStop(0, `rgba(255,248,200,${0.9 * pulse})`); g.addColorStop(1, 'rgba(255,248,200,0)');
          ctx.save(); ctx.translate(p.x, gy); ctx.scale(1, 0.3); ctx.translate(-p.x, -gy);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, gy, size * 0.6, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        drawBucket(ctx, p.x + (front && blockedHere ? shake : 0), p.y + bob, size, this.colorOf(s), s.n, { hidden: s.hidden, alpha: front ? 1 : 0.92 - d * 0.08, blink: this.blink(s.id), sleepy: !aw, t: this.time + s.id });
        if (s.twin) this.drawTwinLink(ctx, li, d, s);
        if (this.grab) {
          ctx.strokeStyle = `rgba(255,210,63,${0.6 + 0.4 * Math.sin(this.time * 8)})`; ctx.lineWidth = 3;
          rr(ctx, p.x - size * 0.45, p.y - size * 0.45, size * 0.9, size * 0.9, 12); ctx.stroke();
        }
      }
      if (lane.length > L.rowsVisible) {
        const p = laneSlotPos(L, li, L.rowsVisible - 1);
        const fs = Math.round(L.B * 0.22), y = p.y + L.B * 0.62, w = fs * 2.6, h = fs * 1.35;
        ctx.fillStyle = 'rgba(58,31,99,0.78)';
        rr(ctx, p.x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
        ctx.font = `700 ${fs}px Fredoka, system-ui, sans-serif`;
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+' + (lane.length - L.rowsVisible), p.x, y + 1);
      }
    }
  }

  drawTwinLink(ctx, li, d, s) {
    const st = this.st;
    const other = st.lanes[li + 1] && st.lanes[li + 1][d];
    if (!other || other.id !== s.twin) return;
    const a = laneSlotPos(this.L, li, d), b = laneSlotPos(this.L, li + 1, d);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(a.x + this.L.B * 0.3, a.y); ctx.lineTo(b.x - this.L.B * 0.3, b.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${Math.round(this.L.B * 0.3)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔗', (a.x + b.x) / 2, a.y);
  }

  drawCapacity(ctx) {
    const L = this.L, st = this.st;
    const used = beltLoad(st);
    const e = L.track[0];
    const full = used >= st.beltCap;
    const flash = this.blockedT && this.time - this.blockedT < 0.8 && this.blockedWhy === 'full';
    const r = L.T * 0.42;
    const w = Math.max(r * 4.6, 64), h = r * 1.5;
    const x = Math.max(w / 2 + 4, e.x + w * 0.2), y = e.y + L.T * 0.5 + h * 0.75 + 4;
    ctx.save();
    ctx.fillStyle = flash ? '#ff4b5c' : full ? '#6f39d6' : '#ffffff';
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(67,53,110,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `700 ${Math.round(h * 0.62)}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = flash || full ? '#fff' : '#43356e';
    ctx.fillText(`${this.hooks.t ? this.hooks.t('belt') : 'Belt'} ${used}/${st.beltCap}`, x, y + 1);
    if (flash) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#ff4b5c';
      ctx.fillText(this.hooks.t ? this.hooks.t('beltFull') : 'Belt full!', x + w / 2 + 6, y + 1);
    }
    ctx.restore();
  }

  drawHint(ctx) {
    const st = this.st, L = this.L;
    let target = null;
    if (this.tutorial && this.tutorial.pointLane !== undefined && st.status === 'play' && st.stats.launches === 0) target = laneSlotPos(L, this.tutorial.pointLane, 0);
    else if (this.hint) target = this.hint.kind === 'lane' ? laneSlotPos(L, this.hint.i, 0) : slotPos(L, this.hint.i);
    if (!target) return;
    const k = (Math.sin(this.time * 6) + 1) / 2;
    const x = target.x + 14, y = target.y + 18 + k * 10;
    ctx.save();
    ctx.font = `${Math.round(L.B * 0.75)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.95;
    ctx.fillText('👆', x, y + L.B * 0.2);
    ctx.restore();
  }

  blink(id) { return ((this.time + id * 1.7 + this.blinkSeed) % 4) < 0.12; }
}
