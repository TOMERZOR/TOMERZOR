// The play screen: runs the engine on a fixed clock, turns engine events into
// juice (projectiles, splats, pops, sounds, haptics) and handles taps.
import { createGame, step, launchLane, launchSlot, laneBlock, beltLoad, addSlot, addRainbow, revive, progress, WILD, freeSlots } from './engine.js';
import { computeLayout, trackPoint, laneSlotPos, slotPos, drawBackground, drawBoardFrame, drawBelt, drawBucket, makeBoardCache, paintCell, FX, rr, mix } from './render.js';
import { sfx } from './audio.js';
import { haptic, track } from './platform.js';
import { bestMove } from './bot.js';

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
    this.anims = new Map(); // cell -> pop start time
    this.proj = [];
    this.fly = [];          // buckets hopping from lane/slot to the belt
    this.pops = [];
    this.combo = 0; this.lastSplat = 0;
    this.acc = 0;
    this.phase = 0;
    this.endT = 0;
    this.done = false;
    this.grab = false;
    this.hint = null; this.hintT = 0;
    this.idleT = 0;
    this.theme = THEMES[(level.level || 0) % THEMES.length];
    this.tickRate = Math.max(10, Math.min(24, this.st.L / 4.2));
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
    for (let i = 0; i < this.level.cells.length; i++) paintCell(this.cache, this.level, this.L, i, this.vis, this.maxCoats);
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
        paintCell(this.cache, this.level, this.L, p.cell, this.vis, this.maxCoats);
        this.anims.set(p.cell, this.time);
        const cx = this.L.bx + (p.cell % this.level.w + 0.5) * this.L.cs, cy = this.L.by + (Math.floor(p.cell / this.level.w) + 0.5) * this.L.cs;
        this.fx.splat(cx, cy, p.col, this.L.cs > 14 ? 6 : 4);
        if (this.time - this.lastSplat < 0.4) this.combo++; else this.combo = 0;
        this.lastSplat = this.time;
        sfx.splat(this.combo); haptic.tick();
      }
    }
    this.proj = this.proj.filter((p) => !p.landed);
    for (const f of this.fly) f.t += dt;
    this.fly = this.fly.filter((f) => f.t < f.dur);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.5);
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
        st.stats && (this.splats = (this.splats || 0) + 1);
        this.hooks.onProgress && this.hooks.onProgress(progress(st));
      } else if (e.type === 'launch') {
        let from;
        if (e.lane >= 0) from = laneSlotPos(L, e.lane, 0);
        else if (e.slot >= 0) from = slotPos(L, e.slot);
        else from = { x: L.W / 2, y: L.H - 60 };
        this.fly.push({ id: e.id, x0: from.x, y0: from.y, t: 0, dur: 0.22 });
      } else if (e.type === 'pop') {
        const s = this.findShooterPos(e.id);
        if (s) {
          this.pops.push({ x: s.x, y: s.y, t: 0 });
          this.fx.confetti(s.x, s.y, 14, 2);
          this.fx.ring(s.x, s.y, '#ffffff', 26);
        }
        sfx.pop(); haptic.light();
      } else if (e.type === 'park') {
        sfx.park();
        if (freeSlots(st) <= 1) { sfx.warn(); this.dangerT = this.time; }
        this.hooks.onEvent && this.hooks.onEvent({ type: 'park', free: freeSlots(st) });
      } else if (e.type === 'reveal') {
        const p = laneSlotPos(L, e.lane, 0);
        this.fx.ring(p.x, p.y, '#ffd23f', 30); sfx.reveal();
      } else if (e.type === 'fail') {
        sfx.fail(); haptic.heavy(); this.fx.shake = 10;
        setTimeout(() => this.hooks.onFail && this.hooks.onFail(), 650);
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
    this.winT = this.time;
    track('level_win', { level: this.level.level, ticks: this.st.tick });
    setTimeout(() => this.hooks.onWin && this.hooks.onWin(this.st), 1100);
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
    this.drawProjectiles(ctx);
    this.drawBeltBuckets(ctx);
    this.drawSlots(ctx);
    this.drawLanes(ctx);
    this.drawFly(ctx);
    this.drawCapacity(ctx);
    ctx.restore();
    this.fx.draw(ctx);
    this.drawHint(ctx);
  }

  drawProjectiles(ctx) {
    for (const p of this.proj) {
      const k = Math.min(1, p.t / p.dur);
      const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 10;
      const r = Math.max(2.5, this.L.cs * 0.32);
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
  }

  colorOf(s) { return s.c === WILD ? WILD : this.level.colors[s.c]; }

  drawBeltBuckets(ctx) {
    const L = this.L, st = this.st;
    const size = L.T * 1.05;
    this.lastPos = this.lastPos || new Map();
    const alpha = st.status === 'play' ? this.acc : 0;
    for (const s of st.belt) {
      const f = s.steps === 0 ? 0 : s.p - 1 + alpha;
      const pt = trackPoint(L, f);
      this.lastPos.set(s.id, pt);
      if (this.isFlying(s.id)) continue;
      const bob = Math.sin(this.time * 10 + s.id) * 1.2;
      drawBucket(ctx, pt.x, pt.y - size * 0.05 + bob, size, this.colorOf(s), s.n, { blink: this.blink(s.id), look: 0 });
    }
    // waiting to step on: stack them at the entry
    st.pending.forEach((s, k) => {
      if (this.isFlying(s.id)) return;
      const e = L.track[0];
      this.lastPos.set(s.id, e);
      drawBucket(ctx, e.x - k * 4, e.y - k * 6, size, this.colorOf(s), s.n, { blink: this.blink(s.id) });
    });
    for (const p of this.pops) {
      const k = p.t / 0.5;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, L.T * (0.4 + k), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
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
      ctx.fillStyle = 'rgba(67,53,110,0.14)';
      rr(ctx, p.x - s / 2, p.y - s / 2, s, s, s * 0.28); ctx.fill();
      ctx.strokeStyle = danger && !st.slots[i] ? `rgba(255,75,92,${0.5 + 0.5 * Math.sin(this.time * 16)})` : 'rgba(67,53,110,0.22)';
      ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      rr(ctx, p.x - s / 2 + 1, p.y - s / 2 + 1, s - 2, s - 2, s * 0.28); ctx.stroke();
      ctx.setLineDash([]);
      const b = st.slots[i];
      if (b && !this.isFlying(b.id)) drawBucket(ctx, p.x, p.y + s * 0.04, s * 0.92, this.colorOf(b), b.n, { blink: this.blink(b.id) });
    }
  }

  drawLanes(ctx) {
    const L = this.L, st = this.st;
    const shake = this.blockedT && this.time - this.blockedT < 0.3 ? Math.sin((this.time - this.blockedT) * 60) * 4 : 0;
    for (let li = 0; li < st.lanes.length; li++) {
      const lane = st.lanes[li];
      const x = L.lanesX0 + L.laneW * (li + 0.5);
      // lane track
      ctx.fillStyle = 'rgba(67,53,110,0.08)';
      rr(ctx, x - L.laneW * 0.42, L.lanesTop - 6, L.laneW * 0.84, L.rowsVisible * L.B * 0.9 + 8, 16); ctx.fill();
      const blockedHere = this.blockedLane === li && shake;
      for (let d = Math.min(lane.length, L.rowsVisible) - 1; d >= 0; d--) {
        const s = lane[d];
        const p = laneSlotPos(L, li, d);
        const front = d === 0;
        const why = front ? laneBlock(st, li) : 'x';
        const size = L.B * (front ? 1 : 0.9);
        const bob = front && !why ? Math.sin(this.time * 4 + li) * 1.5 : 0;
        drawBucket(ctx, p.x + (front && blockedHere ? shake : 0), p.y + bob, size, this.colorOf(s), s.n, { hidden: s.hidden, alpha: front ? 1 : 0.92 - d * 0.08, blink: this.blink(s.id) });
        if (s.twin) this.drawTwinLink(ctx, li, d, s);
        if (this.grab) {
          ctx.strokeStyle = `rgba(255,210,63,${0.6 + 0.4 * Math.sin(this.time * 8)})`; ctx.lineWidth = 3;
          rr(ctx, p.x - size * 0.45, p.y - size * 0.45, size * 0.9, size * 0.9, 12); ctx.stroke();
        }
      }
      if (lane.length > L.rowsVisible) {
        const p = laneSlotPos(L, li, L.rowsVisible - 1);
        ctx.font = `700 ${Math.round(L.B * 0.24)}px Fredoka, system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(51,38,77,0.55)'; ctx.textAlign = 'center';
        ctx.fillText('+' + (lane.length - L.rowsVisible), p.x, p.y + L.B * 0.62);
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
    const w = Math.max(r * 2.6, 34), h = r * 1.5;
    const x = e.x - w * 0.15, y = e.y + L.T * 0.5 + h * 0.75 + 4;
    ctx.save();
    ctx.fillStyle = flash ? '#ff4b5c' : full ? '#6f39d6' : '#ffffff';
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(67,53,110,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `700 ${Math.round(h * 0.62)}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = flash || full ? '#fff' : '#43356e';
    ctx.fillText(`${used}/${st.beltCap}`, x, y + 1);
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
