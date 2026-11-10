// Arcade vehicle: one rigid body on the ground plane, three (or more) collision circles
// along its length, a tiny tyre model with a handbrake, and the three AI drivers
// (traffic, police pursuit, scripted route).
import * as THREE from 'three';
import { VEHICLES } from './defs.js';
import { clamp, damp, wrapAngle, lerp } from '../core/util.js';
import { groundY, nearestLane, nearestNode, routeNodes, WORLD_HALF } from '../world/map.js';

const _p = { x: 0, z: 0, y: 0 };
let vid = 1;
const glowGeo = new THREE.PlaneGeometry(1, 1);

export class Vehicle {
  constructor(game, type, opt = {}) {
    this.game = game; this.id = vid++; this.type = type;
    const def = this.def = VEHICLES[type];
    const md = game.assets.models[def.model];
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    this.len = def.len; this.wid = def.wid;
    if (md) {
      const m = this.mesh = md.scene.clone(true);
      const k = def.len / md.len;
      const holder = new THREE.Group();
      holder.add(m);
      m.position.set(-md.centre.x, -md.minY, -md.centre.z);
      holder.scale.setScalar(k);
      holder.rotation.y = (md.longX ? Math.PI / 2 : 0) + (FRONT_FIX[def.model] || 0);
      this.body.add(holder);
      this.wid = Math.min(def.wid, Math.min(md.size.x, md.size.z) * k + 0.05);
      const tint = opt.tint !== undefined ? opt.tint : def.tints[Math.floor(Math.random() * def.tints.length)];
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        o.material = o.material.clone();
        if (tint !== 0xffffff) o.material.color.set(tint);
        o.material.roughness = Math.min(o.material.roughness, 0.55); o.material.envMapIntensity = 1.3;
        this.mat = o.material;
      });
    } else {
      const g = new THREE.Mesh(new THREE.BoxGeometry(def.wid, def.hgt * 0.7, def.len), new THREE.MeshStandardMaterial({ color: 0x888888 }));
      g.position.y = def.hgt * 0.45; this.body.add(g);
    }
    this.buildLights();
    this.pos = this.root.position;
    this.yaw = opt.yaw || 0;
    this.vx = 0; this.vz = 0; this.yawRate = 0; this.steer = 0;
    this.in = { throttle: 0, brake: 0, steer: 0, hand: false, horn: false };
    this.maxHp = 100 * (def.tough || 1); this.hp = this.maxHp;
    this.mass = def.mass;
    this.driver = null; this.ai = null; this.parked = !!opt.parked; this.sleep = !!opt.parked;
    this.locked = false; this.wreck = false; this.siren = false; this.stolen = false;
    this.tag = opt.tag || null;
    // collision circles along the spine
    const r = this.wid / 2, n = Math.max(2, Math.round(def.len / this.wid));
    this.r = r; this.circ = [];
    for (let i = 0; i < n; i++) this.circ.push(n === 1 ? 0 : -def.len / 2 + r + ((def.len - 2 * r) * i) / (n - 1));
    this.roll = 0; this.pitch = 0; this.lastVf = 0; this.smokeT = 0; this.skid = 0;
    this.pos.set(opt.x || 0, groundY(opt.x || 0, opt.z || 0), opt.z || 0);
    this.root.rotation.y = this.yaw;
    this.idleT = 0;
  }

  buildLights() {
    const def = this.def, w = this.wid || def.wid, hl = def.len / 2;
    const mk = (color, x, y, z, s) => {
      const m = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: this.game.mats.M.glow.map, fog: false }));
      m.position.set(x, y, z); m.scale.setScalar(s); this.body.add(m); return m;
    };
    const y = def.bike ? 0.85 : def.hgt * 0.42;
    this.head = [mk(0xfff2d0, w * 0.33, y, hl + 0.03, 0.55), mk(0xfff2d0, -w * 0.33, y, hl + 0.03, 0.55)];
    this.tail = [mk(0xff2010, w * 0.34, y, -hl - 0.03, 0.42), mk(0xff2010, -w * 0.34, y, -hl - 0.03, 0.42)];
    this.tail.forEach((t) => { t.rotation.y = Math.PI; });
    if (def.bike) { this.head[1].visible = false; this.tail[1].visible = false; this.head[0].position.x = 0; this.tail[0].position.x = 0; }
    const pool = this.pool = new THREE.Mesh(glowGeo, this.game.mats.M.glow.clone());
    pool.material.color.set(0xfff0cc); pool.material.vertexColors = false;
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.06, hl + 5.5); pool.scale.set(7.5, 12, 1); pool.renderOrder = 3;
    this.root.add(pool);
    if (def.siren) {
      this.beacon = [mk(0x2060ff, 0.35, def.hgt + 0.02, 0, 1.3), mk(0xff2030, -0.35, def.hgt + 0.02, 0, 1.3)];
      this.beacon.forEach((b) => { b.rotation.x = -Math.PI / 2; });
    }
    if (def.roofSign) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), new THREE.MeshBasicMaterial({ color: def.roofSign }));
      s.position.set(0, def.hgt + 0.06, 0.1); this.body.add(s);
    }
  }

  get fx() { return Math.sin(this.yaw); }
  get fz() { return Math.cos(this.yaw); }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get vf() { return this.vx * this.fx + this.vz * this.fz; }
  doorPos(out, side = 1) {
    // driver's door is on the left of the car (right-hand traffic)
    const rx = -this.fz, rz = this.fx;
    const s = this.def.bike ? 0.75 : this.wid / 2 + 0.6;
    out.x = this.pos.x - rx * s * side + this.fx * (this.def.seat[2] * 0.3); out.z = this.pos.z - rz * s * side + this.fz * (this.def.seat[2] * 0.3);
    return out;
  }
  wake() { this.sleep = false; this.idleT = 0; }

  damage(d, by) {
    if (this.wreck) return;
    this.hp -= d / (this.def.tough || 1);
    if (this.hp <= 0) { this.hp = 0; this.wreck = true; this.game.bus.emit('wreck', this, by); }
  }
  kicked(by, a) { this.wake(); this.vx += Math.sin(by.heading) * 0.6 / this.mass; this.vz += Math.cos(by.heading) * 0.6 / this.mass; this.damage(2, by); this.game.bus.emit('carKick', this, by); }

  update(dt) {
    const g = this.game, def = this.def;
    if (this.sleep) { this.updateLights(dt, 0); return; }
    const inp = this.in, fx = this.fx, fz = this.fz, rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * rx + this.vz * rz;
    const alive = !this.wreck && (this.driver || this.ai);
    const thr = alive ? inp.throttle : 0, brk = alive ? inp.brake : (this.driver || this.ai ? 0 : 0.25);
    const top = def.top * (this.hp < this.maxHp * 0.3 ? 0.6 : 1) * (g.onPavedAt(this.pos.x, this.pos.z) ? 1 : 0.72);
    if (thr > 0) vf += def.acc * thr * Math.max(0, 1 - (vf / top) ** 2) * dt * (vf < 0 ? 2 : 1);
    if (brk > 0) {
      if (vf > 0.6) vf = Math.max(0, vf - 15 * brk * dt);
      else if (alive && (inp.rev || (this.driver && this.driver.isPlayer))) vf -= def.acc * 0.6 * brk * Math.max(0, 1 - (vf / (-top * 0.32)) ** 2) * dt;      // reverse
      else vf = damp(vf, 0, 3, dt);
    }
    vf -= vf * (0.06 + Math.abs(vf) * 0.0028) * dt;
    if (!thr && !brk) vf = damp(vf, 0, 0.25, dt);
    // tyres: sideways speed bleeds off by grip; the handbrake lets go of the rear
    const grip = def.grip * (inp.hand ? 1.7 : 8.5) * (g.onPavedAt(this.pos.x, this.pos.z) ? 1 : 0.7);
    const vlBefore = vl; vl *= Math.exp(-grip * dt);
    this.skid = Math.abs(vlBefore) > 3.2 || (inp.hand && Math.abs(vf) > 6) ? 1 : 0;
    // steering gets lighter with speed
    const sMax = lerp(0.62, 0.12, clamp(Math.abs(vf) / top, 0, 1) ** 0.7);
    this.steer = damp(this.steer, clamp(inp.steer, -1, 1) * sMax, 9, dt);
    const wb = def.len * 0.58;
    let yr = -(vf * Math.tan(this.steer)) / wb;
    if (inp.hand) yr *= 1.45;
    if (def.bike) yr *= 1.25;
    this.yawRate = yr;
    this.yaw = wrapAngle(this.yaw + yr * dt);
    const nfx = Math.sin(this.yaw), nfz = Math.cos(this.yaw);
    this.vx = nfx * vf + -nfz * vl; this.vz = nfz * vf + nfx * vl;
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;

    this.collideStatic(dt);
    const lim = WORLD_HALF - 6;
    if (Math.abs(this.pos.x) > lim) { this.pos.x = Math.sign(this.pos.x) * lim; this.vx *= -0.3; }
    if (Math.abs(this.pos.z) > lim) { this.pos.z = Math.sign(this.pos.z) * lim; this.vz *= -0.3; }

    // body: lean, squat, curb bump
    const gy = groundY(this.pos.x + nfx * def.len * 0.3, this.pos.z + nfz * def.len * 0.3), gy2 = groundY(this.pos.x - nfx * def.len * 0.3, this.pos.z - nfz * def.len * 0.3);
    this.pos.y = damp(this.pos.y, (gy + gy2) / 2, 14, dt);
    const acc = (vf - this.lastVf) / Math.max(dt, 1e-3); this.lastVf = vf;
    const latAcc = yr * vf;
    this.roll = damp(this.roll, def.bike ? clamp(-latAcc * 0.05, -0.55, 0.55) : clamp(latAcc * 0.006, -0.07, 0.07), 6, dt);
    this.pitch = damp(this.pitch, clamp(-acc * 0.004, -0.05, 0.05) + Math.atan2(gy2 - gy, def.len * 0.6), 7, dt);
    this.body.rotation.set(this.pitch, 0, this.roll);
    this.root.rotation.y = this.yaw;

    if (!this.driver && !this.ai && Math.hypot(this.vx, this.vz) < 0.05) { this.idleT += dt; if (this.idleT > 2) { this.sleep = true; this.vx = this.vz = 0; } } else this.idleT = 0;
    this.updateLights(dt, brk);
    if (this.hp < this.maxHp * 0.35) { this.smokeT -= dt; if (this.smokeT <= 0) { this.smokeT = this.wreck ? 0.08 : 0.2; g.fx.smoke(this.pos.x + nfx * def.len * 0.4, this.pos.y + def.hgt * 0.55, this.pos.z + nfz * def.len * 0.4, this.wreck ? 0.12 : 0.4); } }
    if (this.skid && Math.abs(vf) > 4) g.fx.dust(this.pos.x - nfx * def.len * 0.35, this.pos.y + 0.1, this.pos.z - nfz * def.len * 0.35);
  }

  updateLights(dt, brk) {
    const n = this.game.sky.night, on = (this.driver || this.ai) && !this.wreck ? 1 : 0;
    const h = on * (0.25 + n * 0.75), t = on * (0.2 + n * 0.5) + (brk > 0.05 ? 0.6 : 0);
    this.head[0].material.opacity = this.head[1].material.opacity = h * 0.9;
    this.tail[0].material.opacity = this.tail[1].material.opacity = Math.min(1, t);
    this.pool.material.opacity = on * n * 0.3; this.pool.visible = on * n > 0.02;
    if (this.beacon) {
      const s = this.siren ? 1 : 0, ph = (this.game.time * 5.2) % 1;
      this.beacon[0].material.opacity = s * (ph < 0.5 ? 1 : 0.08); this.beacon[1].material.opacity = s * (ph >= 0.5 ? 1 : 0.08);
    }
  }

  collideStatic(dt) {
    const ph = this.game.physics, fx = this.fx, fz = this.fz;
    let px = 0, pz = 0, hits = 0, torque = 0;
    for (let i = 0; i < this.circ.length; i++) {
      const o = this.circ[i];
      _p.x = this.pos.x + fx * o; _p.z = this.pos.z + fz * o;
      const sx = _p.x, sz = _p.z;
      const h = ph.resolveCircle(_p, this.r, this.pos.y + 0.25, this.pos.y + 1.4);
      if (!h) continue;
      const dx = _p.x - sx, dz = _p.z - sz; px += dx; pz += dz; hits++;
      const vn = this.vx * h.nx + this.vz * h.nz;
      if (vn < 0) {
        const imp = -vn;
        this.vx -= h.nx * vn * 1.25; this.vz -= h.nz * vn * 1.25;
        torque += (fx * h.nz - fz * h.nx) * o * imp * 0.02;
        if (imp > 2.2) { this.damage((imp - 2) * 3.2, null); this.game.bus.emit('crash', this, imp, null); }
      }
    }
    if (hits) { this.pos.x += px / hits; this.pos.z += pz / hits; this.yaw += clamp(torque, -0.08, 0.08); }
  }
}

// Each generated model has its own idea of which end is the front; this turns them all to +Z.
export const FRONT_FIX = {
  v_sedan: 0, v_hatch: Math.PI, v_pickup: Math.PI, v_van: Math.PI, v_police: Math.PI, v_armored: 0, v_truck: Math.PI, v_bus: 0, v_tractor: 0, v_moped: Math.PI,
};

// ---- Vehicle against vehicle and against people -------------------------------------------
export function collideVehicles(game, list) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (a.sleep && b.sleep) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, reach = (a.len + b.len) / 2 + 0.4;
      if (dx * dx + dz * dz > reach * reach) continue;
      for (const oa of a.circ) for (const ob of b.circ) {
        const ax = a.pos.x + a.fx * oa, az = a.pos.z + a.fz * oa, bx = b.pos.x + b.fx * ob, bz = b.pos.z + b.fz * ob;
        const ex = bx - ax, ez = bz - az, d = Math.hypot(ex, ez), min = a.r + b.r;
        if (d >= min || d < 1e-4) continue;
        const nx = ex / d, nz = ez / d, pen = min - d;
        const ma = a.mass, mb = b.mass, tot = ma + mb;
        a.pos.x -= nx * pen * (mb / tot); a.pos.z -= nz * pen * (mb / tot);
        b.pos.x += nx * pen * (ma / tot); b.pos.z += nz * pen * (ma / tot);
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) {
          const jimp = -(1.25) * rv / (1 / ma + 1 / mb);
          a.vx -= (jimp / ma) * nx; a.vz -= (jimp / ma) * nz; b.vx += (jimp / mb) * nx; b.vz += (jimp / mb) * nz;
          a.yaw += clamp((a.fx * nz - a.fz * nx) * oa * rv * 0.012 * (mb / tot), -0.06, 0.06);
          b.yaw -= clamp((b.fx * nz - b.fz * nx) * ob * rv * 0.012 * (ma / tot), -0.06, 0.06);
          const imp = -rv;
          if (imp > 1.8) {
            a.damage(imp * 2.4 * (mb / tot) * 2, b.driver); b.damage(imp * 2.4 * (ma / tot) * 2, a.driver);
            game.bus.emit('crash', a, imp, b);
          }
          a.wake(); b.wake();
        }
      }
    }
  }
}

export function collideVehicleActors(game, vehicles, actors) {
  for (const v of vehicles) {
    const sp = v.speed;
    for (const p of actors) {
      if (p.vehicle) continue;
      const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z, reach = v.len / 2 + 1;
      if (dx * dx + dz * dz > reach * reach) continue;
      for (const o of v.circ) {
        const cx = v.pos.x + v.fx * o, cz = v.pos.z + v.fz * o;
        const ex = p.pos.x - cx, ez = p.pos.z - cz, d = Math.hypot(ex, ez), min = v.r + p.radius;
        if (d >= min || d < 1e-4) continue;
        const nx = ex / d, nz = ez / d;
        p.pos.x += nx * (min - d); p.pos.z += nz * (min - d);
        const rel = (v.vx - p.vel.x) * nx + (v.vz - p.vel.z) * nz;
        if (rel > 3.2 && !p.ko && p.invuln <= 0 && p.air === false) {
          p.invuln = 0.6;
          p.takeHit(Math.min(140, rel * rel * 0.55), v.driver, nx, nz, true, rel * 0.75);
          v.vx *= 0.94; v.vz *= 0.94;
          game.bus.emit('runover', v, p, rel);
        }
        break;
      }
    }
  }
}

// ---- Drivers ---------------------------------------------------------------------
function steerTo(v, tx, tz) {
  const want = Math.atan2(tx - v.pos.x, tz - v.pos.z);
  return clamp(-wrapAngle(want - v.yaw) * 2.2, -1, 1);
}
function blockedAhead(game, v, range) {
  const fx = v.fx, fz = v.fz;
  for (const o of game.world.vehicles) {
    if (o === v) continue;
    const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z, f = dx * fx + dz * fz;
    if (f < 0.5 || f > range + o.len / 2) continue;
    if (Math.abs(-dx * fz + dz * fx) < (v.wid + o.wid) / 2 + 0.25) return f;
  }
  for (const p of game.world.actors) {
    if (p.vehicle) continue;
    const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z, f = dx * fx + dz * fz;
    if (f < 0.5 || f > range) continue;
    if (Math.abs(-dx * fz + dz * fx) < v.wid / 2 + 0.5) return f;
  }
  return -1;
}

// Follows the lane graph, picks a turn at every junction, brakes for whatever is in front.
export class TrafficAI {
  constructor(v, lane, t) { this.v = v; this.lane = lane; this.t = t; this.cruise = lane.speed * (0.8 + Math.random() * 0.3) * (v.def.top < 28 ? 0.85 : 1); this.stuck = 0; this.panic = 0; this.honkT = 0; }
  update(game, dt) {
    const v = this.v, L = this.lane;
    this.t = clamp((v.pos.x - L.ax) * L.ux + (v.pos.z - L.az) * L.uz, 0, L.len);
    if (this.t > L.len - 9) {
      // choose the next road: no U-turns unless it is a dead end
      const out = L.b.out.filter((n) => n.b !== L.a);
      const straight = out.find((n) => n.ux * L.ux + n.uz * L.uz > 0.9);
      this.lane = (straight && Math.random() < 0.55) ? straight : (out.length ? out[Math.floor(Math.random() * out.length)] : L.b.out[0]);
      this.t = 0; this.cruise = this.lane.speed * (0.8 + Math.random() * 0.3) * (v.def.top < 28 ? 0.85 : 1);
    }
    const N = this.lane, look = 7 + v.speed * 0.5;
    const tt = Math.min(N.len, Math.max(0, (v.pos.x - N.ax) * N.ux + (v.pos.z - N.az) * N.uz) + look);
    const tx = N.ax + N.ux * tt, tz = N.az + N.uz * tt;
    v.in.steer = steerTo(v, tx, tz);
    let want = this.cruise * (Math.abs(v.in.steer) > 0.5 ? 0.45 : 1);
    if (this.panic > 0) { this.panic -= dt; want = v.def.top * 0.8; }
    const gap = blockedAhead(game, v, 5 + v.speed * 1.1);
    if (gap >= 0 && this.panic <= 0) {
      want = gap < 6 ? 0 : want * 0.4;
      if (v.speed < 0.4) { this.stuck += dt; if (this.stuck > 4 && this.honkT <= 0) { game.bus.emit('honk', v); this.honkT = 3 + Math.random() * 4; } } else this.stuck = 0;
    } else this.stuck = 0;
    this.honkT -= dt;
    const vf = v.vf;
    v.in.throttle = vf < want ? clamp((want - vf) * 0.5, 0.15, 1) : 0;
    v.in.brake = vf > want + 1.5 ? clamp((vf - want) * 0.25, 0.2, 1) : (want === 0 ? 1 : 0);
    v.in.hand = false;
    // a car wedged for a long time gives up and is recycled by the spawner
    if (this.stuck > 14) v.despawn = true;
  }
}

// Hunts a target: along the road graph while far away, straight at it when close.
export class ChaseAI {
  constructor(v, target) { this.v = v; this.target = target; this.path = []; this.repath = 0; this.stuck = 0; this.rev = 0; }
  update(game, dt) {
    const v = this.v, t = this.target(), tp = t.pos;
    const dx = tp.x - v.pos.x, dz = tp.z - v.pos.z, d = Math.hypot(dx, dz);
    let tx = tp.x, tz = tp.z;
    if (d > 55) {
      this.repath -= dt;
      if (this.repath <= 0 || !this.path.length) { this.path = routeNodes(nearestNode(v.pos.x, v.pos.z), nearestNode(tp.x, tp.z)); this.repath = 2.5; }
      if (this.path.length) {
        let L = this.path[0];
        const tt = (v.pos.x - L.ax) * L.ux + (v.pos.z - L.az) * L.uz;
        if (tt > L.len - 8 && this.path.length > 1) { this.path.shift(); L = this.path[0]; }
        const t2 = clamp((v.pos.x - L.ax) * L.ux + (v.pos.z - L.az) * L.uz + 12, 0, L.len);
        tx = L.ax + L.ux * t2; tz = L.az + L.uz * t2;
      }
    } else if (t.vx !== undefined) { tx += t.vx * 0.5; tz += t.vz * 0.5; }
    if (this.rev > 0) { this.rev -= dt; v.in.throttle = 0; v.in.brake = 1; v.in.rev = true; v.in.steer = -steerTo(v, tx, tz); return; }
    v.in.rev = false;
    v.in.steer = steerTo(v, tx, tz);
    const sharp = Math.abs(v.in.steer) > 0.75;
    const want = d < 9 && (t.speed || 0) < 2 ? 0 : (sharp ? 9 : v.def.top);
    const vf = v.vf;
    v.in.throttle = vf < want ? 1 : 0; v.in.brake = vf > want + 3 || want === 0 ? 1 : 0; v.in.hand = sharp && vf > 14;
    if (v.speed < 0.6 && want > 0) { this.stuck += dt; if (this.stuck > 1.6) { this.rev = 1.4; this.stuck = 0; } } else this.stuck = 0;
    this.near = d;
  }
}

// Drives a fixed list of world points (mission targets, getaways).
export class RouteAI {
  constructor(v, points, speed, loop) { this.v = v; this.points = points; this.i = 0; this.speed = speed; this.loop = loop; this.done = false; this.hold = false; }
  update(game, dt) {
    const v = this.v;
    if (this.done || this.hold) { v.in.throttle = 0; v.in.brake = 1; return; }
    const p = this.points[this.i];
    const d = Math.hypot(p.x - v.pos.x, p.z - v.pos.z);
    if (d < 7) { this.i++; if (this.i >= this.points.length) { if (this.loop) this.i = 0; else { this.done = true; return; } } }
    v.in.steer = steerTo(v, p.x, p.z);
    let want = this.speed * (Math.abs(v.in.steer) > 0.5 ? 0.5 : 1);
    const gap = blockedAhead(game, v, 5 + v.speed);
    if (gap >= 0 && gap < 7 && !this.pushy) want = 0;
    const vf = v.vf;
    v.in.throttle = vf < want ? clamp((want - vf) * 0.5, 0.2, 1) : 0; v.in.brake = vf > want + 2 || want === 0 ? 1 : 0;
  }
}
export { nearestLane };
