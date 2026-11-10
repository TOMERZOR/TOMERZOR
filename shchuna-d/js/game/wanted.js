// Police attention. Heat rises with crimes that somebody saw, the level is its whole part
// (shown as blue beacons in the HUD), and it clears once nobody in uniform has seen you for a while.
import * as THREE from 'three';
import { ChaseAI } from './vehicle.js';
import { BARKS } from './defs.js';
import { dist2, clamp } from '../core/util.js';
import { lanes, POI } from '../world/map.js';

const HEAT = { assault: 0.55, theft: 0.5, carjack: 1.0, runover: 1.0, cop: 1.6, heist: 2 };
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export class Wanted {
  constructor(game) {
    this.game = game;
    this.heat = 0; this.level = 0; this.evade = 0; this.seen = false; this.flash = false;
    this.spawnT = 0; this.pending = []; this.cap = 5; this.frozen = false;
    this.heli = null; this.heliA = 0;
    this.units = [];             // police vehicles we sent
  }

  crime(type, victim) {
    if (this.frozen) return;
    const add = HEAT[type] || 0.5;
    const before = this.level;
    this.heat = clamp(Math.max(this.heat, Math.floor(this.heat) + 0.01) + add, 0, this.cap + 0.99);
    if (this.heat < 1) this.heat = 1;
    this.level = Math.min(this.cap, Math.floor(this.heat));
    this.evade = 12 + this.level * 5; this.seen = true;
    if (this.level > before) this.game.bus.emit('wanted', this.level, before);
  }
  // A crime in front of ordinary people: it counts if a cop is close, otherwise someone may phone it in.
  witness(type, victim) {
    if (this.frozen) return;
    const g = this.game, p = g.player.pos;
    for (const a of g.world.actors) if (a.faction === 'cop' && !a.ko && dist2(a.pos.x, a.pos.z, p.x, p.z) < 45 * 45 && g.physics.los(a.pos.x, a.pos.z, p.x, p.z)) { this.crime(type, victim); return; }
    let seenBy = 0;
    for (const a of g.world.actors) if (a.faction === 'civ' && !a.ko && a !== victim && dist2(a.pos.x, a.pos.z, p.x, p.z) < 22 * 22) seenBy++;
    if (seenBy && Math.random() < Math.min(0.75, 0.22 * seenBy) && !this.pending.length) this.pending.push({ t: 3.5 + Math.random() * 3, type, victim });
  }
  set(level) { this.heat = level + 0.2; const b = this.level; this.level = level; this.evade = 14 + level * 6; this.seen = true; if (level !== b) this.game.bus.emit('wanted', level, b); }
  clear(quiet) {
    const b = this.level; this.heat = 0; this.level = 0; this.pending.length = 0; this.flash = false;
    for (const v of this.units) { v.siren = false; v.keep = false; if (v.ai instanceof ChaseAI) { v.despawn = true; v.ai = null; v.in.throttle = 0; v.in.brake = 1; v.in.steer = 0; v.in.rev = false; v.in.hand = false; } }
    this.units.length = 0;
    for (const a of this.game.world.actors) if (a.faction === 'cop' && a.ai && a.ai.mode === 'fight') { a.ai.keep = false; this.game.world.settle(a); }
    if (b > 0 && !quiet) this.game.bus.emit('wanted', 0, b);
  }

  update(dt) {
    const g = this.game, pl = g.player, p = pl.pos, w = g.world;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i]; q.t -= dt;
      if (q.t <= 0) { this.pending.splice(i, 1); g.ui.notify('מישהו התקשר למשטרה', 'cop'); this.crime(q.type, q.victim); }
    }
    if (this.level <= 0) { if (this.heli) this.heli.visible = false; return; }

    // can any officer see him?
    let seen = false;
    for (const a of w.actors) {
      if (a.faction !== 'cop' || a.ko) continue;
      const d2 = dist2(a.pos.x, a.pos.z, p.x, p.z);
      if (d2 < 60 * 60 && (d2 < 14 * 14 || g.physics.los(a.pos.x, a.pos.z, p.x, p.z))) { seen = true; break; }
    }
    if (!seen) for (const v of this.units) { if (v.wreck) continue; const d2 = dist2(v.pos.x, v.pos.z, p.x, p.z); if (d2 < 70 * 70 && (d2 < 18 * 18 || g.physics.los(v.pos.x, v.pos.z, p.x, p.z, 1.2))) { seen = true; break; } }
    if (this.level >= 4) seen = seen || !g.underCover(p.x, p.z);      // the helicopter sees everything in the open
    this.seen = seen;
    if (seen) this.evade = 12 + this.level * 5;
    else { this.evade -= dt; if (this.evade <= 0) { this.clear(); g.ui.notify('איבדת אותם', 'ok'); return; } }
    this.flash = !seen;

    // send units
    this.spawnT -= dt;
    this.units = this.units.filter((v) => w.vehicles.includes(v));
    if (this.spawnT <= 0) {
      this.spawnT = 2.2;
      let foot = 0;
      for (const a of w.actors) if (a.faction === 'cop' && !a.ko && a.ai && dist2(a.pos.x, a.pos.z, p.x, p.z) < 80 * 80) { foot++; if (a.ai.mode !== 'fight' && !a.vehicle) { w.aggro(a, pl.actor); a.ai.keep = true; if (Math.random() < 0.5) g.ui.bark(a, rnd(BARKS.cop)); } }
      const wantCars = [0, 0, 1, 2, 3, 4][this.level], wantFoot = [0, 2, 2, 3, 4, 4][this.level];
      const live = this.units.filter((v) => !v.wreck && v.ai).length;
      if (live < wantCars) this.sendCar();
      else if (foot < wantFoot && live === 0 && !pl.vehicle) this.sendFoot();
    }
    // officers get out when they have boxed him in on foot
    for (const v of this.units) {
      if (!v.ai || v.wreck || !v.crew) continue;
      const d2 = dist2(v.pos.x, v.pos.z, p.x, p.z);
      if (d2 < 11 * 11 && v.speed < 3.5 && (!pl.vehicle || pl.vehicle.speed < 2.5)) {
        v.ai = null; v.in.throttle = 0; v.in.brake = 1;
        v.crew.forEach((c, i) => {
          const d = v.doorPos({ x: 0, z: 0 }, i ? -1 : 1);
          c.vehicle = null; c.visible = true; c.place(d.x, d.z, v.yaw); w.aggro(c, pl.actor); c.ai.keep = true;
        });
        g.ui.bark(v.crew[0], rnd(BARKS.cop)); v.crew = null; v.driver = null;
      }
    }
    this.updateHeli(dt);
  }

  sendCar() {
    const g = this.game, p = g.player.pos, w = g.world;
    for (let tries = 0; tries < 8; tries++) {
      const L = rnd(lanes), t = Math.random() * L.len, x = L.ax + L.ux * t, z = L.az + L.uz * t;
      const d2 = dist2(x, z, p.x, p.z);
      if (d2 < 85 * 85 || d2 > 170 * 170 || w.vehicleNear(x, z, 8)) continue;
      const v = w.spawnVehicle('police', x, z, Math.atan2(L.ux, L.uz));
      v.siren = true; v.keep = true; v.owned = true;
      v.ai = new ChaseAI(v, () => g.player.vehicle || g.player.actor);
      v.crew = [];
      for (let i = 0; i < 2; i++) { const c = w.spawnPed('cop', x, z, 0); if (c) { c.ai.keep = true; c.vehicle = v; c.visible = false; v.crew.push(c); } }
      v.driver = v.crew[0] || null;
      this.units.push(v);
      return;
    }
  }
  sendFoot() {
    const g = this.game, p = g.player.pos, w = g.world;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * 6.283, r = 38 + Math.random() * 16, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!g.physics.circleFree(x, z, 0.5) || g.physics.los(x, z, p.x, p.z)) continue;
      const c = w.spawnPed('cop', x, z, 0); if (!c) return;
      c.ai.keep = true; w.aggro(c, g.player.actor);
      return;
    }
  }

  updateHeli(dt) {
    const g = this.game, p = g.player.pos;
    if (this.level < 4) { if (this.heli) this.heli.visible = false; return; }
    if (!this.heli) {
      const h = this.heli = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 4.2), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.5 }));
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 4), body.material); tail.position.set(0, 0.3, -3.6);
      const rotor = this.rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.3), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6 }));
      rotor.position.y = 1; h.add(body, tail, rotor);
      const beam = this.beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), g.mats.M.glow.clone());
      beam.material.color.set(0xcfe2ff); beam.material.vertexColors = false; beam.material.opacity = 0.75;
      beam.rotation.x = -Math.PI / 2; beam.scale.set(16, 16, 1); beam.renderOrder = 4;
      g.gfx.scene.add(h); g.gfx.scene.add(beam);
    }
    this.heli.visible = true; this.beam.visible = g.sky.night > 0.2;
    this.heliA += dt * 0.35;
    this.heli.position.set(p.x + Math.cos(this.heliA) * 26, 46, p.z + Math.sin(this.heliA) * 26);
    this.heli.rotation.y = -this.heliA; this.rotor.rotation.y += dt * 30;
    this.beam.position.set(p.x + Math.sin(g.time * 0.7) * 2.5, 0.2, p.z + Math.cos(g.time * 0.9) * 2.5);
  }
  hide() { if (this.heli) { this.heli.visible = false; this.beam.visible = false; } }
}
export { POI };
