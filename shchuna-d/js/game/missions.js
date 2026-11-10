// Mission runtime. A mission is an async function that awaits small steps on a context
// ("go there", "talk", "beat them") — the story file reads like a script. Failing a mission
// rejects whatever step is pending, the function unwinds, and everything it spawned is cleaned up.
import * as THREE from 'three';
import { POI, groundY } from '../world/map.js';
import { RouteAI } from './vehicle.js';
import { dist2, el, fmtMoney } from '../core/util.js';

class Abort extends Error { constructor(reason) { super(reason); this.abort = true; } }
const P = (p) => (typeof p === 'string' ? POI[p] : p);

export class Missions {
  constructor(game) {
    this.game = game;
    this.list = []; this.byId = {};
    this.done = new Set(); this.flags = {};
    this.active = null; this.ctx = null;
    this.waits = []; this.fails = [];
    this.starts = [];            // start markers for available missions
    this.beacons = [];
    this.target = null;          // current objective position, for the GPS line
    this.speakers = {};
    this.timer = null; this.busy = false;
    this.beaconGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xf5b301, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
  }

  register(list, speakers) { for (const m of list) { this.list.push(m); this.byId[m.id] = m; } Object.assign(this.speakers, speakers || {}); }
  gpsTarget() {
    if (this.target) return typeof this.target === 'function' ? this.target() : this.target;
    if (!this.active && this.starts.length && this.game.mode === 'story') return this.starts[0].pos;
    return null;
  }

  beacon(pos, r = 2.4, color = 0xf5b301) {
    const m = new THREE.Mesh(this.beaconGeo, this.beaconMat.clone());
    m.material.color.set(color); m.scale.set(r, 5.5, r); m.position.set(pos.x, groundY(pos.x, pos.z) + 2.75, pos.z); m.renderOrder = 4;
    this.game.gfx.scene.add(m); this.beacons.push(m); return m;
  }
  dropBeacon(m) { if (!m) return; this.game.gfx.scene.remove(m); const i = this.beacons.indexOf(m); if (i >= 0) this.beacons.splice(i, 1); }

  // ---- availability --------------------------------------------------------------
  refreshStarts() {
    for (const s of this.starts) { this.dropBeacon(s.beacon); this.game.ui.removeBlip(s.blip); this.game.ui.untrack(s.track); }
    this.starts = [];
    if (this.game.mode !== 'story' || this.active) return;
    for (const m of this.list) {
      if (m.online || this.done.has(m.id)) continue;
      if (m.after && !m.after.every((id) => this.done.has(id))) continue;
      const pos = P(m.at); if (!pos) continue;
      const s = { m, pos, beacon: this.beacon(pos, 1.8), blip: this.game.ui.addBlip(pos, '#f5b301', { shape: 'sq' }), track: this.game.ui.track(() => pos, m.giver || m.title) };
      this.starts.push(s);
      break;                                  // one story beat at a time
    }
  }
  next() { return this.starts.length ? this.starts[0].m : null; }

  // ---- running -------------------------------------------------------------------
  async start(m, opt = {}) {
    if (this.active || this.busy) return;
    const g = this.game;
    this.busy = true; this.active = m;
    for (const s of this.starts) { this.dropBeacon(s.beacon); g.ui.removeBlip(s.blip); g.ui.untrack(s.track); }
    this.starts = [];
    const ctx = this.ctx = new Ctx(this, m);
    g.bus.emit('missionStart', m);
    let result = 'pass', reason = '';
    try {
      if (!opt.quiet) g.ui.card(m.act || 'משימה', m.title, m.blurb || '');
      await m.run(ctx, opt);
    } catch (e) {
      if (e && e.abort) { result = 'fail'; reason = e.message; }
      else { console.error('mission error', e); result = 'fail'; reason = 'משהו השתבש'; }
    }
    this.lastResult = { id: m.id, result, reason };
    ctx.cleanup(result);
    this.waits.length = 0; this.fails.length = 0; this.target = null; this.timer = null;
    g.ui.objective(''); g.ui.hideDialog(); g.endCutscene(true);
    this.active = null; this.ctx = null;
    if (result === 'pass') {
      this.done.add(m.id);
      g.audio.jingle('pass');
      if (m.reward) g.player.addMoney(m.reward, 'mission');
      if (!m.silent) await g.ui.banner('', 'המשימה הושלמה', m.passLine || '', { reward: m.reward || 0, hold: 3400 });
      g.save();
    } else if (reason !== 'quit') {
      g.audio.jingle('fail');
      await g.ui.banner('bad', 'המשימה נכשלה', reason, { hold: 3000 });
    }
    this.busy = false;
    g.bus.emit('missionEnd', m, result);
    this.refreshStarts();
    if (opt.onEnd) opt.onEnd(result);
    return result;
  }
  fail(reason) {
    if (!this.active) return;
    const e = new Abort(reason || '');
    const w = this.waits; this.waits = [];
    for (const x of w) x.rej(e);
    this.pendingAbort = w.length ? null : e;
  }

  update(dt) {
    const g = this.game, pl = g.player;
    const t = g.time;
    for (const b of this.beacons) { b.rotation.y += dt * 0.6; b.material.opacity = 0.24 + Math.sin(t * 3) * 0.08; }
    if (this.active) {
      if (this.pendingAbort && this.waits.length) { const e = this.pendingAbort; this.pendingAbort = null; const w = this.waits; this.waits = []; for (const x of w) x.rej(e); return; }
      for (const f of this.fails) { const r = f.fn(); if (r) { this.fail(typeof r === 'string' ? r : f.reason); return; } }
      if (this.timer) { this.timer.t -= dt; if (this.timer.t <= 0) { const r = this.timer.reason; this.timer = null; this.fail(r); return; } }
      for (let i = this.waits.length - 1; i >= 0; i--) {
        const w = this.waits[i];
        if (!w) break;
        if (w.until !== undefined) { w.until -= dt; if (w.until <= 0) { this.waits.splice(i, 1); w.res(); } continue; }
        let v; try { v = w.fn(dt); } catch (e) { this.waits.splice(i, 1); w.rej(e); continue; }
        if (v) { this.waits.splice(i, 1); w.res(v); }
      }
      return;
    }
    if (this.busy || g.cutscene || g.mode !== 'story') return;
    // walking into the marker starts the mission
    for (const s of this.starts) {
      const d2 = dist2(pl.pos.x, pl.pos.z, s.pos.x, s.pos.z);
      if (d2 < 2.2 * 2.2 && !pl.vehicle && pl.actor.alive && g.wanted.level === 0) { this.start(s.m); return; }
      if (d2 < 9 * 9 && g.wanted.level > 0) g.ui.prompt('!', 'קודם תיפטר מהמשטרה');
      else if (d2 < 7 * 7 && pl.vehicle) g.ui.prompt('F', 'צא מהרכב כדי להתחיל');
    }
  }
  wait(fn) { return new Promise((res, rej) => { if (this.pendingAbort) { const e = this.pendingAbort; this.pendingAbort = null; rej(e); return; } this.waits.push({ fn, res, rej }); }); }
  sleep(sec) { return new Promise((res, rej) => { if (this.pendingAbort) { const e = this.pendingAbort; this.pendingAbort = null; rej(e); return; } this.waits.push({ until: sec, res, rej }); }); }

  save() { return { done: [...this.done], flags: this.flags }; }
  load(s) { this.done = new Set((s && s.done) || []); this.flags = (s && s.flags) || {}; }
}

class Ctx {
  constructor(ms, m) {
    this.ms = ms; this.game = ms.game; this.m = m;
    this.peds = []; this.cars = []; this.marks = []; this.blips = []; this.beacons = []; this.cleanups = [];
    this.player = ms.game.player;
    this.poi = POI;
  }
  get flags() { return this.ms.flags; }
  get online() { return this.game.mode === 'online'; }
  // ---- crew helpers: offline the crew is just the player ---------------------------------
  driving(v) { return this.player.vehicle === v || !!v.remoteDriver; }
  anyCrewNear(place, r, onFoot) {
    const p = place.x !== undefined ? place : P(place), g = this.game;
    if (!this.online) return dist2(g.player.pos.x, g.player.pos.z, p.x, p.z) < r * r && (!onFoot || !g.player.vehicle);
    if (dist2(g.player.pos.x, g.player.pos.z, p.x, p.z) < r * r && (!onFoot || !g.player.vehicle)) return true;
    for (const q of g.net.peers.values()) if (q.seen && dist2(q.actor.pos.x, q.actor.pos.z, p.x, p.z) < r * r && (!onFoot || !q.vinfo)) return true;
    return false;
  }
  crewAllDown() {
    if (!this.online) return false;
    if (!this.player.actor.ko) return false;
    for (const q of this.game.net.peers.values()) if (q.seen && !q.ko) return false;
    return true;
  }
  nearestCrew(from) {
    const g = this.game; let best = null, bd = 1e12;
    const list = this.online ? g.net.crewActors() : [g.player.actor];
    for (const a of list) { if (a.ko) continue; const d = dist2(a.pos.x, a.pos.z, from.pos.x, from.pos.z); if (d < bd) { bd = d; best = a; } }
    return best || g.player.actor;
  }
  P(p) { return P(p); }

  // ---- text and staging -------------------------------------------------------------
  async talk(lines, opt = {}) {
    const g = this.game, ui = g.ui, ms = this.ms;
    g.startCutscene();
    const actors = opt.actors || {};
    for (let i = 0; i < lines.length; i++) {
      const [k, text] = lines[i], sp = ms.speakers[k] || { name: k, color: '#f3efe6' };
      const who = actors[k] || (k === 'N' ? g.player.actor : null);
      // frame whoever is speaking, over the shoulder of whoever listens
      const other = k === 'N' ? (opt.with || Object.values(actors)[0]) : g.player.actor;
      if (who && other && who !== other && !g.player.vehicle) {
        const dx = who.pos.x - other.pos.x, dz = who.pos.z - other.pos.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
        const side = (i % 2 ? 1 : -1) * 0.9;
        g.cam.setShot({ pos: new THREE.Vector3(other.pos.x - nx * 1.3 + -nz * side, other.pos.y + 1.62, other.pos.z - nz * 1.3 + nx * side), look: new THREE.Vector3(who.pos.x, who.pos.y + who.height * 0.88, who.pos.z), fov: 34, cut: i > 0 });
        who.face(other.pos.x, other.pos.z); who.heading = Math.atan2(other.pos.x - who.pos.x, other.pos.z - who.pos.z);
        if (who.ai && who.state === 'idle') who.gesture('talk');
        if (other.ai && other.state === 'talk') other.gesture('idle');
        if (other === g.player.actor && !g.player.vehicle) other.heading = Math.atan2(dx, dz);
      }
      ui.dialog(sp.face, sp.name, text, sp.color);
      g.audio.blip(sp.pitch || 300, 0.04, 'triangle', 0.06);
      const auto = Math.max(2.4, text.length * 0.075) + 1.2;
      let t = 0, skip = false;
      await ms.wait((dt) => {
        t += dt;
        const inp = g.input.pressed;
        if (inp.skip) { skip = true; return true; }
        return (t > 0.35 && (inp.interact || inp.jump || inp.punch)) || (g.settings.autoAdvance && t > auto);
      });
      if (skip) break;
    }
    for (const k in actors) if (actors[k].state === 'talk') actors[k].gesture('idle');
    ui.hideDialog(); g.endCutscene();
  }
  say(k, text, dur) { const sp = this.ms.speakers[k] || { name: k }; this.game.ui.subtitle(sp.name, text, sp.color, dur); if (this.online) this.game.net.event({ k: 'say', who: sp.name, text, color: sp.color }); return this.ms.sleep(dur || Math.max(2.2, text.length * 0.062)); }
  line(k, text) { const sp = this.ms.speakers[k] || { name: k }; this.game.ui.subtitle(sp.name, text, sp.color); }
  sms(from, text) { this.game.ui.notify(text, 'sms', from); }
  note(text, kind) { this.game.ui.notify(text, kind || ''); if (this.online) this.game.net.event({ k: 'note', text, kind: kind || '' }); }
  wait(sec) { return this.ms.sleep(sec); }
  async fade(on, hold = 0.5) { this.game.fade(on); await this.ms.sleep(hold); }
  hour(h) { this.game.sky.setHour(h); }
  objective(html, opt) { this.game.ui.objective(html, opt); }

  // ---- objectives -------------------------------------------------------------------
  mark(pos, label, cls = '', color = '#f5b301') {
    const fn = typeof pos === 'function' ? pos : () => pos;
    const m = { track: this.game.ui.track(fn, label, cls), blip: this.game.ui.addBlip(fn, color) };
    this.marks.push(m); return m;
  }
  unmark(m) { if (!m) return; this.game.ui.untrack(m.track); this.game.ui.removeBlip(m.blip); const i = this.marks.indexOf(m); if (i >= 0) this.marks.splice(i, 1); }
  // Go to a place. opt: r, vehicle (a Vehicle the player must be driving), onFoot, slow, label, timer:{t,reason}
  async goto(place, text, opt = {}) {
    const g = this.game, pos = P(place), r = opt.r || 4;
    const b = this.ms.beacon(pos, Math.min(r, 5)); this.beacons.push(b);
    const mk = this.mark(pos, opt.label || '');
    this.ms.target = pos;
    try {
      await this.ms.wait(() => {
        const pl = g.player;
        g.ui.objective(text, this.hud(opt));
        if (opt.vehicle) {
          const v = opt.vehicle;
          if (!this.driving(v)) { g.ui.objective(opt.back || 'חזור לרכב', this.hud(opt)); this.ms.target = v.pos; return false; }
          this.ms.target = pos;
          return dist2(v.pos.x, v.pos.z, pos.x, pos.z) < r * r && (!opt.slow || v.speed < 3 || !!v.remoteDriver);
        }
        this.ms.target = pos;
        if (this.online) return this.anyCrewNear(pos, r, opt.onFoot);
        if (dist2(pl.pos.x, pl.pos.z, pos.x, pos.z) > r * r) return false;
        if (opt.onFoot && pl.vehicle) { g.ui.prompt('F', 'צא מהרכב'); return false; }
        if (opt.slow && pl.speed > 3) return false;
        return true;
      });
    } finally { this.unmark(mk); this.ms.dropBeacon(b); this.ms.target = null; }
  }
  hud(opt) { const o = {}; if (this.ms.timer) o.timer = this.ms.timer.t; if (opt && opt.meter) o.meter = opt.meter(); return o; }
  // Wait for a condition while showing an objective.
  async until(fn, text, opt = {}) {
    const g = this.game; if (opt.target) this.ms.target = opt.target;
    try { return await this.ms.wait((dt) => { if (text) g.ui.objective(typeof text === 'function' ? text() : text, this.hud(opt)); return fn(dt); }); }
    finally { this.ms.target = null; }
  }
  timer(sec, reason = 'נגמר הזמן') { this.ms.timer = sec ? { t: sec, reason } : null; }
  failIf(fn, reason) { const f = { fn, reason }; this.ms.fails.push(f); return f; }
  noFail(f) { const i = this.ms.fails.indexOf(f); if (i >= 0) this.ms.fails.splice(i, 1); }
  fail(reason) { this.ms.fail(reason); return this.ms.sleep(99); }

  // ---- cast --------------------------------------------------------------------------
  ped(kind, place, opt = {}) {
    const p = P(place), w = this.game.world;
    const a = w.spawnPed(kind, p.x + (opt.dx || 0), p.z + (opt.dz || 0), opt.heading !== undefined ? opt.heading : (p.yaw || 0), { keep: true, hp: opt.hp, faction: opt.faction, tint: opt.tint, mode: opt.mode || 'script', scale: opt.scale });
    if (!a) return null;
    a.ai.script = opt.mode ? null : true; a.story = true;
    if (opt.name) a.label = opt.name;
    if (opt.sit) a.sit(true);
    this.game.net.tag(a);
    this.peds.push(a); return a;
  }
  car(type, place, yaw, opt = {}) {
    const p = P(place);
    const v = this.game.world.spawnVehicle(type, p.x + (opt.dx || 0), p.z + (opt.dz || 0), yaw !== undefined ? yaw : (p.yaw || 0), { parked: opt.parked !== false, tint: opt.tint });
    v.keep = true; v.tagFree = !!opt.free; v.owned = !!opt.owned;
    this.game.net.tag(v);
    this.cars.push(v); return v;
  }
  drive(v, points, speed = 11, kind = 'dod') {
    const d = this.game.world.spawnPed(kind, v.pos.x, v.pos.z, 0, { keep: true });
    if (d) { this.game.world.seat(d, v); this.peds.push(d); }
    v.ai = new RouteAI(v, points.map(P), speed); v.parked = false; v.wake();
    return v.ai;
  }
  hostile(list, target) { for (const a of list) { if (!a || a.ko) continue; a.ai.script = null; a.ai.mode = 'fight'; a.ai.target = target || this.nearestCrew(a); a.ai.keep = true; } }
  follow(a, leader) { a.ai.script = null; a.ai.leader = leader || this.player.actor; a.ai.mode = 'follow'; }
  send(a, place, speed = 2, then = 'script') { const p = P(place); a.ai.script = null; a.ai.mode = 'goto'; a.ai.dest = { x: p.x, z: p.z, r: 1.2, speed }; a.ai.then = then; a.ai.arrived = false; if (a.state !== 'idle') a.setState('idle'); }
  // Beat everybody in the list.
  async fight(list, text, opt = {}) {
    const live = list.filter(Boolean);
    this.hostile(live, opt.target);
    const marks = live.map((a) => this.mark(() => (a.ko ? null : a.pos), '', 'foe', '#e5412d'));
    try { await this.until(() => live.every((a) => a.ko || !this.game.world.actors.includes(a)), () => `${text} <em class="num">${live.filter((a) => a.ko).length}/${live.length}</em>`); }
    finally { marks.forEach((m) => this.unmark(m)); }
  }
  near(a, b, r) { const pa = a.pos || P(a), pb = b.pos || P(b); return dist2(pa.x, pa.z, pb.x, pb.z) < r * r; }
  wanted(level) { if (level === 0) { this.game.wanted.clear(true); if (this.online) this.game.net.event({ k: 'want', lvl: 0 }); } else this.game.wanted.set(level); }
  // online the crew shakes the police together: the host's level is what counts
  async loseCops(text = 'התחמק מהמשטרה') { if (this.game.wanted.level > 0) await this.until(() => this.game.wanted.level === 0, text); }
  teleport(place, heading) { const p = P(place); this.player.teleport(p.x, p.z, heading !== undefined ? heading : (p.yaw || 0)); }
  money(n) { this.player.addMoney(n, 'mission'); }
  density(k) { this.game.world.density = k; }
  // Hold a position / fill a meter.
  async hold(place, text, seconds, opt = {}) {
    const pos = P(place), r = opt.r || 5; let t = 0;
    const b = this.ms.beacon(pos, Math.min(r, 5)); this.beacons.push(b);
    this.ms.target = pos;
    try {
      await this.ms.wait((dt) => {
        const pl = this.player;
        const inside = opt.vehicle ? (this.driving(opt.vehicle) && dist2(opt.vehicle.pos.x, opt.vehicle.pos.z, pos.x, pos.z) < r * r) : this.online ? this.anyCrewNear(pos, r, opt.onFoot) : (dist2(pl.pos.x, pl.pos.z, pos.x, pos.z) < r * r && (!opt.onFoot || !pl.vehicle));
        if (inside && (!opt.cond || opt.cond())) t += dt; else if (opt.decay) t = Math.max(0, t - dt * opt.decay);
        this.game.ui.objective(text, Object.assign(this.hud(), { meter: t / seconds }));
        return t >= seconds;
      });
    } finally { this.ms.dropBeacon(b); this.ms.target = null; }
  }
  async choice(title, options) {
    const g = this.game; g.startCutscene();
    const idx = await new Promise((res) => {
      const box = el('div', 'banner'); box.style.pointerEvents = 'auto';
      box.innerHTML = `<div><p style="font-size:1.3rem;margin-bottom:1.2rem">${title}</p><div style="display:flex;gap:1rem;justify-content:center"></div></div>`;
      options.forEach((o, i) => { const b = el('button', 'btn' + (i ? ' ghost' : ''), o); b.onclick = () => { box.remove(); res(i); }; box.querySelector('div > div').appendChild(b); });
      g.ui.over.appendChild(box); this.cleanups.push(() => box.remove());
      if (document.pointerLockElement) document.exitPointerLock();
    });
    g.endCutscene(); return idx;
  }

  cleanup(result) {
    const g = this.game, w = g.world;
    for (const m of [...this.marks]) this.unmark(m);
    for (const b of this.beacons) this.ms.dropBeacon(b);
    for (const fn of this.cleanups) { try { fn(); } catch (e) { /* already gone */ } }
    for (const a of this.peds) {
      if (!w.actors.includes(a)) continue;
      a.ai.keep = false; a.ai.script = null; a.ai.leader = null; a.story = false;
      if (a.vehicle) continue;
      if (a.state === 'sit' || a.state === 'talk' || a.state === 'dance') a.setState('idle');
      if (a.ai.mode === 'fight' && result === 'pass') { a.ai.mode = 'flee'; a.ai.threat = g.player.actor; a.ai.t = 0; }
      else if (a.ai.mode !== 'fight') { a.ai.mode = 'flee'; a.ai.threat = g.player.actor; a.ai.t = 5; }
    }
    for (const v of this.cars) { v.keep = false; if (v.ai instanceof RouteAI) { v.ai = null; v.despawn = true; } }
    w.density = 1; g.wanted.frozen = false; g.wanted.cap = 5;
    if (g.player.actor.ko && result !== 'pass') { /* respawn is handled by the game */ }
  }
}
export { fmtMoney };
