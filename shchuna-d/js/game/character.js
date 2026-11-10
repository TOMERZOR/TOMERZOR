// A person in the world: model, animation state machine, movement, fist fighting.
// The player and every NPC are Actors; what differs is who fills in `wish` each frame.
import * as THREE from 'three';
import { CHARS } from './defs.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/util.js';
import { groundY } from '../world/map.js';

const ATTACKS = {
  jab:  { clip: 'jab',  speed: 2.9, hitAt: 0.36, dmg: 11, reach: 1.45, push: 1.6, heavy: false },
  hook: { clip: 'hook', speed: 1.7, hitAt: 0.42, dmg: 15, reach: 1.5,  push: 2.4, heavy: false },
  kick: { clip: 'kick', speed: 3.0, hitAt: 0.42, dmg: 24, reach: 1.75, push: 5.5, heavy: true },
};
const WALK_REF = 1.45, RUN_REF = 6.2;
const _v = new THREE.Vector3();
let uid = 1;

export class Actor {
  constructor(game, charKey, opt = {}) {
    this.game = game; this.id = uid++;
    const def = CHARS[charKey] || CHARS.hero, asset = game.assets.chars[def.model];
    this.def = def; this.charKey = charKey;
    this.root = new THREE.Group();
    this.height = (opt.height || def.height) * (opt.scale || 1);
    this.radius = 0.34;
    this.ok = !!asset;
    if (asset) {
      const m = this.model = game.assets.instance(def.model);
      const k = this.height / asset.height;
      m.scale.setScalar(k); m.rotation.y = -asset.faceYaw; m.position.y = -asset.minY * k;
      this.root.add(m);
      if (opt.tint && opt.tint !== 0xffffff) {
        m.traverse((o) => { if (o.isSkinnedMesh) { o.material = o.material.clone(); o.material.color.set(opt.tint); } });
      }
      this.mixer = new THREE.AnimationMixer(m);
      this.clips = asset.clips; this.actions = {};
      this.mixer.addEventListener('finished', (e) => this.onClipEnd(e.action));
    }
    // soft contact shadow
    const sh = this.shadow = new THREE.Mesh(Actor.shadowGeo(), game.mats.M.shadow);
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.renderOrder = 1; this.root.add(sh);

    this.pos = this.root.position;
    this.heading = opt.heading || 0;
    this.vel = new THREE.Vector3();
    this.vy = 0; this.air = false;
    this.wish = { x: 0, z: 0, speed: 0, face: null };   // desired move direction (unit), speed m/s, optional facing
    this.maxHp = opt.hp || 100; this.hp = this.maxHp;
    this.faction = opt.faction || 'civ';
    this.dmgMul = opt.dmg || 1;
    this.state = 'idle';            // idle | attack | hit | down | getup | sit | talk | dance | jump | frozen
    this.stateT = 0; this.cur = null; this.curName = '';
    this.combatT = 0;               // >0: keeps the guard up
    this.stagger = 0; this.downT = 0; this.ko = false;
    this.attackDef = null; this.attackHit = false; this.combo = 0; this.comboT = 0;
    this.target = null;
    this.vehicle = null; this.visible = true;
    this.speedMul = def.speed || 1;
    this.isPlayer = false; this.invuln = 0;
    this.lod = 0; this._skip = 0;
    this.root.rotation.y = this.heading;
    this.play('idle', 0);
  }

  static shadowGeo() { return Actor._sg || (Actor._sg = new THREE.PlaneGeometry(1.25, 1.25)); }

  place(x, z, heading) {
    this.pos.set(x, groundY(x, z), z);
    if (heading !== undefined) { this.heading = heading; this.root.rotation.y = heading; }
    this.vel.set(0, 0, 0);
    return this;
  }

  play(name, fade = 0.18, opt = {}) {
    if (!this.mixer) return null;
    const clip = this.clips[name]; if (!clip) return null;
    if (this.curName === name && !opt.restart) { if (opt.speed) this.cur.timeScale = opt.speed; return this.cur; }
    let a = this.actions[name];
    if (!a) a = this.actions[name] = this.mixer.clipAction(clip);
    a.reset(); a.enabled = true;
    a.setLoop(opt.once ? THREE.LoopOnce : THREE.LoopRepeat, opt.once ? 1 : Infinity);
    a.clampWhenFinished = !!opt.once;
    a.timeScale = opt.speed || 1;
    if (opt.at) a.time = clip.duration * opt.at;
    if (this.cur && fade > 0) { a.crossFadeFrom(this.cur, fade, false); } else if (this.cur) this.cur.stop();
    a.play();
    this.cur = a; this.curName = name;
    return a;
  }

  onClipEnd(action) {
    if (action !== this.cur) return;
    if (this.state === 'attack' || this.state === 'hit' || this.state === 'jump') this.setState('idle');
    else if (this.state === 'getup') { this.setState('idle'); this.combatT = 3; }
  }

  setState(s) { this.state = s; this.stateT = 0; }
  get busy() { return this.state !== 'idle'; }
  get alive() { return !this.ko; }
  get canAct() { return this.state === 'idle' && !this.vehicle; }

  face(x, z) { this.wish.face = Math.atan2(x - this.pos.x, z - this.pos.z); }

  // ---- fighting ---------------------------------------------------------------
  attack(kind) {
    if (this.vehicle || this.ko) return false;
    if (this.state === 'attack') {
      // buffer the next blow of a combo once the current one has landed
      if (this.stateT > this.attackLen * 0.55) this.queued = kind;
      return false;
    }
    if (this.state !== 'idle') return false;
    if (kind === 'punch') { kind = this.combo % 2 ? 'hook' : 'jab'; }
    const a = ATTACKS[kind]; if (!a) return false;
    this.attackDef = a; this.attackHit = false; this.queued = null;
    const act = this.play(a.clip, 0.08, { once: true, speed: a.speed, restart: true });
    this.attackLen = act ? act.getClip().duration / a.speed : 0.5;
    this.setState('attack'); this.combatT = 6;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 1.4;
    // lock on to whoever is in front
    const t = this.game.world.nearestActor(this, 2.6, 1.9, (o) => o !== this && !o.ko && !o.vehicle && (this.isPlayer || o.faction !== this.faction));
    if (t) { this.heading = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z); this.target = t; }
    this.game.bus.emit('swing', this, kind);
    return true;
  }

  resolveAttack() {
    const a = this.attackDef, w = this.game.world;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let landed = false;
    for (const o of w.actors) {
      if (o === this || o.ko || o.vehicle || o.invuln > 0) continue;
      if (!this.isPlayer && o.faction === this.faction) continue;
      if (this.isPlayer && o.peerId) continue;                 // no friendly fire between crew
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > a.reach + o.radius || d < 0.01) continue;
      if ((dx * fx + dz * fz) / d < 0.45) continue;
      const finisher = this.combo >= 3 && !a.heavy;
      o.takeHit(a.dmg * this.dmgMul * (finisher ? 1.35 : 1), this, fx, fz, a.heavy || finisher, a.push);
      landed = true;
      if (!a.heavy) break;
    }
    // kicking a car dents its pride
    if (!landed) { const v = w.vehicleNear(this.pos.x + fx * 1.2, this.pos.z + fz * 1.2, 0.6); if (v) { v.kicked(this, a); landed = true; } }
    this.game.bus.emit(landed ? 'impact' : 'whiff', this, a);
  }

  takeHit(dmg, from, dx, dz, heavy, push = 2) {
    if (this.ko || this.invuln > 0) return;
    // somebody else's simulation owns this body: tell them, do not decide here
    if (this.onRemoteHit) { if (!this.peerId || this.game.net.isHost) this.onRemoteHit(dmg, heavy, dx, dz); this.game.bus.emit('hurt', this, from, 0, heavy); return; }
    this.hp -= dmg; this.combatT = 8; this.stagger += dmg * (heavy ? 2.2 : 1);
    this.vel.x += dx * push; this.vel.z += dz * push;
    this.game.bus.emit('hurt', this, from, dmg, heavy);
    if (this.vehicle) return;
    if (this.hp <= 0) { this.hp = 0; this.knockdown(from, true); return; }
    if (this.stagger > 42 || (heavy && Math.random() < 0.55)) { this.knockdown(from, false); return; }
    if (this.state !== 'down' && this.state !== 'getup') {
      this.heading = Math.atan2(-dx, -dz);
      this.play('hit', 0.06, { once: true, speed: 3.6, restart: true });
      this.setState('hit');
    }
  }

  knockdown(from, ko) {
    this.stagger = 0;
    this.play('knockdown', 0.08, { once: true, speed: 1.7, restart: true });
    this.setState('down');
    this.ko = !!ko; this.downT = ko ? (this.isPlayer ? 99 : 22) : 1.6 + Math.random();
    if (ko) this.game.bus.emit('ko', this, from);
  }

  revive(hpFrac = 1) { this.ko = false; this.hp = this.maxHp * hpFrac; this.stagger = 0; this.setState('idle'); this.play('idle', 0.2, { restart: true }); }

  sit(on = true) { if (on) { this.setState('sit'); this.play('sit', 0.25); } else if (this.state === 'sit') { this.setState('idle'); } }
  gesture(name) {
    if (this.state !== 'idle' && this.state !== 'talk' && this.state !== 'dance') return;
    if (name === 'talk' || name === 'dance') { this.setState(name); this.play(name, 0.3); }
    else { this.setState('idle'); }
  }
  jump() {
    if (!this.canAct || this.air) return;
    this.vy = 4.6; this.air = true; this.setState('jump');
    this.play('jump', 0.08, { once: true, speed: 2.4, restart: true, at: 0.15 });
  }

  // ---- per-frame --------------------------------------------------------------------
  update(dt) {
    this.stateT += dt;
    if (this.remote) { if (this.mixer && this.root.visible) this.mixer.update(dt); return; }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.combatT > 0) this.combatT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    this.stagger = Math.max(0, this.stagger - dt * 9);
    if (this.vehicle) { this.root.visible = this.visible && !!this.vehicle.def.bike; if (this.mixer && this.root.visible) this.mixer.update(dt); return; }
    this.root.visible = this.visible;

    const w = this.wish; let sp = 0, mx = 0, mz = 0;
    if (this.state === 'idle' || this.state === 'jump') { sp = w.speed * this.speedMul; mx = w.x; mz = w.z; }
    else if (this.state === 'attack') {
      const a = this.attackDef;
      if (this.stateT < this.attackLen * 0.4) { sp = 1.5; mx = Math.sin(this.heading); mz = Math.cos(this.heading); }
      if (!this.attackHit && this.stateT >= this.attackLen * a.hitAt) { this.attackHit = true; this.resolveAttack(); }
      if (this.queued && this.stateT > this.attackLen * 0.72) { const q = this.queued; this.setState('idle'); this.attack(q); }
    } else if (this.state === 'down') {
      this.downT -= dt;
      if (this.downT <= 0 && !this.isPlayer) {
        if (this.ko) { this.ko = false; this.hp = Math.max(this.hp, this.maxHp * 0.35); }
        this.play('standup', 0.15, { once: true, speed: 4.2, restart: true }); this.setState('getup');
      }
    }

    // velocity towards the wish, friction otherwise
    const tx = mx * sp, tz = mz * sp;
    const k = this.state === 'idle' || this.state === 'jump' ? 11 : 6;
    this.vel.x = damp(this.vel.x, tx, k, dt); this.vel.z = damp(this.vel.z, tz, k, dt);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.state === 'idle' || this.state === 'jump') {
      if (w.face !== null && w.face !== undefined) this.heading = dampAngle(this.heading, w.face, 9, dt);
      else if (sp > 0.2) this.heading = dampAngle(this.heading, Math.atan2(mx, mz), 11, dt);
    }
    w.face = null;
    if (speed > 0.01) {
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      const hit = this.game.physics.resolveCircle(this.pos, this.radius, this.pos.y, this.pos.y + 1.7);
      if (hit) { const vn = this.vel.x * hit.nx + this.vel.z * hit.nz; if (vn < 0) { this.vel.x -= hit.nx * vn; this.vel.z -= hit.nz * vn; } this.blocked = true; } else this.blocked = false;
    }
    // ground and jump
    const gy = groundY(this.pos.x, this.pos.z);
    if (this.air) { this.vy -= 13 * dt; this.pos.y += this.vy * dt; if (this.pos.y <= gy) { this.pos.y = gy; this.air = false; this.vy = 0; } }
    else this.pos.y = damp(this.pos.y, gy, 18, dt);
    this.root.rotation.y = this.heading;
    this.speed = speed;

    // locomotion clip follows the real speed so feet do not skate
    if (this.state === 'idle') {
      if (speed > 3.3) this.play('run', 0.2, { speed: clamp(speed / RUN_REF, 0.75, 1.45) });
      else if (speed > 0.25) this.play('walk', 0.22, { speed: clamp(speed / WALK_REF, 0.6, 2.2) });
      else this.play(this.combatT > 0 ? 'guard' : 'idle', 0.25);
    }
    if (this.mixer) {
      // far-away people animate at half rate
      if (this.lod > 0) { this._skip += dt; if (this._skip > 0.066) { this.mixer.update(this._skip); this._skip = 0; } }
      else this.mixer.update(dt);
    }
  }

  headPos(out = _v) { return out.set(this.pos.x, this.pos.y + this.height + 0.25, this.pos.z); }
  dist2To(o) { const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z; return dx * dx + dz * dz; }
  dispose() { if (this.root.parent) this.root.parent.remove(this.root); if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); } }
}
