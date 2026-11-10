// Everything alive in the city: who is around, what they are doing, who is angry at whom.
import * as THREE from 'three';
import { Actor } from './character.js';
import { Vehicle, TrafficAI, ChaseAI, collideVehicles, collideVehicleActors } from './vehicle.js';
import { PEDS, CIV_MIX, TRAFFIC_MIX, PARKED_MIX, BARKS, ENEMIES, VEHICLES } from './defs.js';
import { Rng, clamp, dist2, wrapAngle } from '../core/util.js';
import { walkLoops, lanes, turfAt, blocks, inCity, nearestLane } from '../world/map.js';

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const HANG_PEDS = {
  kiosk: ['dod', 'youth', 'dalet', 'girl'], cafe: ['dod', 'dod', 'suit', 'savta'], food: ['youth', 'girl', 'dod', 'mom'], plaza: ['savta', 'mom', 'girl', 'dod', 'youth'],
  shuk: ['savta', 'mom', 'dod', 'girl', 'mom'], bus: ['mom', 'girl', 'savta', 'suit', 'youth'], queue: ['dod', 'savta', 'mom', 'suit', 'girl'],
  yard: ['dalet', 'dalet2', 'youth', 'dod'], court: ['dalet', 'dalet2', 'youth', 'youth'], gimel: ['gimel', 'gimel', 'gimel2'],
  work: ['worker', 'worker', 'dod'], wedding: ['suit', 'girl', 'mom', 'suit'], fence: ['dod', 'suit'],
};

export class World {
  constructor(game) {
    this.game = game;
    this.actors = []; this.vehicles = [];
    this.group = new THREE.Group(); game.gfx.scene.add(this.group);
    this.pedT = 0; this.carT = 0; this.parkT = 0; this.copT = 0;
    this.spotOwner = new Map();          // hang spot / seat -> actor
    this.parkOwner = new Map();          // parking spot -> vehicle
    this.cats = []; this.catT = 0;
    this.density = 1;                    // missions can thin the streets
    this.rng = new Rng(77);
    const b = game.bus;
    b.on('hurt', (victim, from, dmg, heavy) => this.onHurt(victim, from, dmg, heavy));
    b.on('ko', (victim, from) => this.onKO(victim, from));
    b.on('runover', (v, p) => { if (v.driver && v.driver.isPlayer && p.faction !== 'cop') this.game.wanted.crime('runover', p); });
  }

  // ---- queries -----------------------------------------------------------------
  nearestActor(from, range, cone, filter) {
    let best = null, bd = range * range;
    const fx = Math.sin(from.heading), fz = Math.cos(from.heading);
    for (const o of this.actors) {
      if (o === from || (filter && !filter(o))) continue;
      const dx = o.pos.x - from.pos.x, dz = o.pos.z - from.pos.z, d2 = dx * dx + dz * dz;
      if (d2 > bd) continue;
      if (cone !== undefined && d2 > 0.01) { const a = Math.abs(wrapAngle(Math.atan2(dx, dz) - from.heading)); if (a > cone) continue; }
      bd = d2; best = o;
    }
    void fx; void fz;
    return best;
  }
  vehicleNear(x, z, extra = 0) {
    let best = null, bd = 1e9;
    for (const v of this.vehicles) {
      const dx = x - v.pos.x, dz = z - v.pos.z;
      const f = dx * v.fx + dz * v.fz, s = -dx * v.fz + dz * v.fx;
      const ex = Math.max(0, Math.abs(f) - v.len / 2), es = Math.max(0, Math.abs(s) - v.wid / 2);
      const d = Math.hypot(ex, es);
      if (d < extra + 0.01 && d < bd) { bd = d; best = v; }
    }
    return best;
  }
  countFaction(f, x, z, r) { let n = 0; for (const a of this.actors) if (a.faction === f && !a.ko && dist2(a.pos.x, a.pos.z, x, z) < r * r) n++; return n; }

  // ---- spawning ------------------------------------------------------------------
  spawnPed(kind, x, z, heading = 0, opt = {}) {
    const def = PEDS[kind] || PEDS.dod;
    const a = new Actor(this.game, def.char, { tint: opt.tint !== undefined ? opt.tint : rnd(def.tints), hp: opt.hp || def.hp, faction: opt.faction || def.faction, dmg: def.dmg, scale: opt.scale || (0.96 + Math.random() * 0.08) });
    if (!a.ok) return null;
    a.kind = kind; a.brave = def.brave;
    a.ai = { mode: opt.mode || 'idle', t: 0, cool: Math.random(), barkT: 2 + Math.random() * 10, home: { x, z }, loop: null, wp: 0, dir: 1, target: null, slot: false, keep: !!opt.keep, script: null, speed: 1.25 + Math.random() * 0.4 };
    a.place(x, z, heading);
    this.group.add(a.root); this.actors.push(a);
    return a;
  }
  addActor(a) { this.group.add(a.root); this.actors.push(a); return a; }
  removeActor(a) {
    const i = this.actors.indexOf(a); if (i >= 0) this.actors.splice(i, 1);
    if (a.ai && a.ai.spotRef) { const n = (this.spotOwner.get(a.ai.spotRef) || 1) - 1; if (n > 0) this.spotOwner.set(a.ai.spotRef, n); else this.spotOwner.delete(a.ai.spotRef); }
    if (a.ai && a.ai.seatRef) this.spotOwner.delete(a.ai.seatRef);
    if (a.vehicle) { if (a.vehicle.driver === a) a.vehicle.driver = null; a.vehicle = null; }
    a.dispose();
  }
  spawnVehicle(type, x, z, yaw, opt = {}) {
    if (!VEHICLES[type]) type = 'sedan';
    const v = new Vehicle(this.game, type, Object.assign({ x, z, yaw }, opt));
    this.group.add(v.root); this.vehicles.push(v);
    return v;
  }
  removeVehicle(v) {
    const i = this.vehicles.indexOf(v); if (i >= 0) this.vehicles.splice(i, 1);
    for (const [k, o] of this.parkOwner) if (o === v) this.parkOwner.delete(k);
    if (v.driver && !v.driver.isPlayer) this.removeActor(v.driver);
    if (v.crew) for (const c of v.crew) if (this.actors.includes(c) && c.vehicle === v) this.removeActor(c);
    this.group.remove(v.root);
    v.root.traverse((o) => { if (o.isMesh && o.material && o.material !== this.game.mats.M.glow) { /* shared geometry stays */ if (o.material.dispose && o.material.userData.own) o.material.dispose(); } });
  }

  // put an NPC in the driving seat (model hidden for cars)
  seat(actor, v) { actor.vehicle = v; v.driver = actor; actor.root.visible = false; }
  // throw whoever is driving out onto the road
  eject(v, angry) {
    const d = v.driver; if (!d || d.isPlayer) return null;
    const p = v.doorPos({ x: 0, z: 0 }, -1);
    d.vehicle = null; v.driver = null; v.ai = null; d.visible = true; d.root.visible = true;
    d.place(p.x, p.z, v.yaw + Math.PI / 2);
    d.knockdown(null, false);
    d.ai.mode = angry && d.brave > 0.5 ? 'fight' : 'flee'; d.ai.target = this.game.player.actor; d.ai.t = 0; d.ai.threat = this.game.player.actor;
    this.game.ui.bark(d, rnd(BARKS.car));
    return d;
  }

  // ---- reactions -----------------------------------------------------------------
  onHurt(victim, from, dmg, heavy) {
    if (!from) return;
    const g = this.game, player = g.player.actor;
    if (victim !== player && Math.random() < 0.55) g.ui.bark(victim, rnd(victim.kind === 'savta' ? BARKS.savta : BARKS.hit));
    if (victim.ai && !victim.ko && victim.ai.mode !== 'script') {
      if (victim.brave >= 0.5 || victim.faction !== 'civ') this.aggro(victim, from);
      else { victim.ai.mode = 'flee'; victim.ai.threat = from; victim.ai.t = 0; }
    }
    // everyone nearby takes a side, runs, or films it
    for (const o of this.actors) {
      if (o === victim || o === from || !o.ai || o.ko || o.vehicle || o.ai.mode === 'script') continue;
      const d2 = o.dist2To(victim);
      if (d2 > 34 * 34) continue;
      if (o.faction === victim.faction && o.faction !== 'civ') { this.aggro(o, from); continue; }
      if (from.faction !== 'civ' && o.faction === from.faction) { if (victim.faction !== 'civ') this.aggro(o, victim); continue; }
      // a gang backs the player on its own turf against its enemies
      if (victim === player && (ENEMIES[o.faction] || []).includes(from.faction)) { this.aggro(o, from); if (Math.random() < 0.3) g.ui.bark(o, rnd(BARKS.dalet)); continue; }
      if (from === player && (ENEMIES[o.faction] || []).includes(victim.faction) && o.faction === 'dalet') { this.aggro(o, victim); continue; }
      if (o.faction === 'cop') { if (from === player) g.wanted.crime(victim.faction === 'cop' ? 'cop' : 'assault', victim); else if (victim === player) { /* cops ignore gang-on-player */ } continue; }
      if (o.faction === 'civ' && d2 < 18 * 18 && o.ai.mode !== 'flee' && o.ai.mode !== 'cheer') {
        if (o.brave > 0.4 && Math.random() < 0.6) { o.ai.mode = 'cheer'; o.ai.target = victim; o.ai.t = 0; }
        else { o.ai.mode = 'flee'; o.ai.threat = from; o.ai.t = 0; if (Math.random() < 0.3) g.ui.bark(o, rnd(BARKS.flee)); }
      }
    }
    if (from === player) {
      if (victim.faction === 'cop') g.wanted.crime('cop', victim);
      else if (victim.faction === 'civ' || victim.faction === 'guard') g.wanted.witness('assault', victim);
      // hitting a gang member on his own turf brings the whole block down on you
      const turf = turfAt(victim.pos.x, victim.pos.z);
      if (victim.faction === turf && (turf === 'gimel' || turf === 'dalet') && !this.mobT) this.mob(turf, victim.pos.x, victim.pos.z, from);
    }
  }
  onKO(victim, from) {
    const g = this.game;
    if (from && from === g.player.actor && victim.faction === 'civ') g.wanted.witness('assault', victim);
    for (const o of this.actors) if (o.ai && o.ai.target === victim && o.ai.mode === 'fight') { o.ai.target = null; }
  }
  aggro(a, target) {
    if (!a.ai || a.ko || a === target || a.ai.mode === 'script' || a.ai.noFight) return;
    if (a.ai.mode === 'fight' && a.ai.target && !a.ai.target.ko && a.ai.target !== target && Math.random() < 0.7) return;
    if (a.state === 'sit' || a.state === 'talk' || a.state === 'dance') a.setState('idle');
    a.ai.mode = 'fight'; a.ai.target = target; a.ai.t = 0;
  }
  // A pile-on: the block empties onto the street.
  mob(faction, x, z, target) {
    this.mobT = 25;
    const g = this.game, kinds = faction === 'gimel' ? ['gimel', 'gimel', 'gimel2'] : ['dalet', 'dalet2'];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, r = 16 + Math.random() * 12;
      let sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
      if (!g.physics.circleFree(sx, sz, 0.5)) continue;
      const p = this.spawnPed(rnd(kinds), sx, sz, 0); if (!p) continue;
      p.ai.mode = 'fight'; p.ai.target = target; p.ai.reinforce = true;
    }
    for (const o of this.actors) if (o.faction === faction && o.ai && !o.ko && o.dist2To(target) < 50 * 50) this.aggro(o, target);
    g.bus.emit('mob', faction);
    const f = this.actors.find((o) => o.faction === faction && !o.ko);
    if (f) g.ui.bark(f, rnd(BARKS[faction] || BARKS.gimel));
  }

  // ---- AI ---------------------------------------------------------------------------
  think(a, dt) {
    const ai = a.ai, g = this.game, w = a.wish;
    w.speed = 0; ai.t += dt;
    if (a.ko || a.vehicle || a.state === 'down' || a.state === 'getup') return;
    switch (ai.mode) {
      case 'walk': {
        const L = ai.loop; if (!L) { ai.mode = 'idle'; break; }
        const p = L[ai.wp], dx = p.x - a.pos.x, dz = p.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d < 1.4) {
          ai.wp = (ai.wp + ai.dir + L.length) % L.length;
          if (Math.random() < 0.28) {                // cross to the neighbouring block
            let best = null, bd = 30 * 30, bi = 0;
            for (const o of walkLoops) { if (o === L) continue; for (let i = 0; i < 4; i++) { const q = dist2(o[i].x, o[i].z, a.pos.x, a.pos.z); if (q < bd && q > 16) { bd = q; best = o; bi = i; } } }
            if (best) { ai.loop = best; ai.wp = bi; }
          }
          break;
        }
        w.x = dx / d; w.z = dz / d; w.speed = ai.speed;
        if (a.blocked && ai.t > 1) { ai.t = 0; ai.dir = -ai.dir; ai.wp = (ai.wp + ai.dir + L.length) % L.length; }
        break;
      }
      case 'hang': {
        const s = ai.spot;
        if (s) {
          const dx = s.x + (ai.ox || 0) - a.pos.x, dz = s.z + (ai.oz || 0) - a.pos.z, d = Math.hypot(dx, dz);
          if (d > 0.7) { w.x = dx / d; w.z = dz / d; w.speed = 1.3; }
          else if (s.seat) { if (a.state === 'idle') { a.heading = s.yaw; a.sit(true); } }
          else {
            if (s.yaw !== undefined && s.kind !== 'yard' && s.kind !== 'court') w.face = s.yaw + (s.kind === 'queue' ? 0 : Math.PI);
            else w.face = Math.atan2(s.x - a.pos.x, s.z - a.pos.z);
            if (a.state === 'idle' && ai.t > ai.nextGest) { ai.nextGest = ai.t + 4 + Math.random() * 9; if (Math.random() < 0.6) a.gesture(s.kind === 'wedding' && g.sky.night > 0.5 ? 'dance' : 'talk'); }
            else if ((a.state === 'talk' || a.state === 'dance') && ai.t > ai.nextGest - 2.5 && a.state !== 'dance') a.gesture('idle');
          }
        }
        break;
      }
      case 'flee': {
        const th = ai.threat;
        if (!th || ai.t > 9) { this.settle(a); break; }
        if (a.state === 'sit') a.setState('idle');
        const dx = a.pos.x - th.pos.x, dz = a.pos.z - th.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d > 45) { this.settle(a); break; }
        let ang = Math.atan2(dx, dz) + (ai.veer || 0);
        if (a.blocked) ai.veer = (ai.veer || 0) + (Math.random() < 0.5 ? 1 : -1) * 0.9;
        w.x = Math.sin(ang); w.z = Math.cos(ang); w.speed = a.kind === 'savta' ? 2.6 : 5.4;
        break;
      }
      case 'cheer': {
        const t = ai.target;
        if (!t || ai.t > 14 || a.dist2To(t) > 30 * 30) { this.settle(a); break; }
        const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d < 5) { w.x = -dx / d; w.z = -dz / d; w.speed = 2; } else if (d > 8) { w.x = dx / d; w.z = dz / d; w.speed = 1.6; }
        w.face = Math.atan2(dx, dz);
        break;
      }
      case 'fight': this.fight(a, dt); break;
      case 'follow': {
        const t = ai.leader; if (!t) { ai.mode = 'idle'; break; }
        const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz);
        if (t.vehicle) { if (d > 4) { w.x = dx / d; w.z = dz / d; w.speed = 5; } break; }
        if (d > 2.6) { w.x = dx / d; w.z = dz / d; w.speed = d > 7 ? 5.6 : 2.2; if (d > 40) a.place(t.pos.x - Math.sin(t.heading) * 2, t.pos.z - Math.cos(t.heading) * 2); }
        else w.face = Math.atan2(dx, dz);
        break;
      }
      case 'goto': {
        const p = ai.dest; if (!p) { ai.mode = 'idle'; break; }
        const dx = p.x - a.pos.x, dz = p.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d < (p.r || 1)) { ai.mode = ai.then || 'idle'; ai.arrived = true; break; }
        let ang = Math.atan2(dx, dz) + (ai.veer || 0);
        if (a.blocked) ai.veer = (ai.veer || 0) + 0.8; else ai.veer = (ai.veer || 0) * 0.96;
        w.x = Math.sin(ang); w.z = Math.cos(ang); w.speed = p.speed || 2;
        break;
      }
      default: break;      // idle / script: stand where you were put
    }
    // small talk
    ai.barkT -= dt;
    if (ai.barkT <= 0) {
      ai.barkT = 14 + Math.random() * 30;
      const pl = g.player.actor;
      if (a.dist2To(pl) < 12 * 12 && (ai.mode === 'hang' || ai.mode === 'walk') && !g.cutscene) {
        const set = ai.spot && ai.spot.kind === 'queue' ? BARKS.queue : BARKS.idle;
        g.ui.bark(a, rnd(set));
      }
    }
  }

  fight(a, dt) {
    const ai = a.ai, t = ai.target, w = a.wish, g = this.game;
    if (!t || t.ko || !this.actors.includes(t) || (t.vehicle && !t.vehicle.def.bike && a.faction !== 'cop')) {
      // look for the next enemy, otherwise calm down
      const next = this.nearestActor(a, 22, undefined, (o) => !o.ko && !o.vehicle && o.ai && o.ai.mode === 'fight' && o.faction !== a.faction && (ENEMIES[a.faction] || []).includes(o.faction));
      if (next) { ai.target = next; return; }
      // mission cast keeps hunting whoever of the crew is still standing
      if (ai.hunt && g.missions.ctx) { const t2 = g.missions.ctx.nearestCrew(a); if (t2 && !t2.ko && t2 !== t) { ai.target = t2; return; } }
      ai.target = null; ai.slot = false;
      if (ai.reinforce) { ai.mode = 'flee'; ai.threat = g.player.actor; ai.t = 2; ai.keep = false; } else this.settle(a);
      return;
    }
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
    if (d > 70 && a.faction !== 'cop') { this.settle(a); return; }
    // only a few people can swing at once; the rest circle and shout
    let ahead = 0;
    for (const o of this.actors) if (o !== a && o.ai && o.ai.mode === 'fight' && o.ai.target === t && !o.ko && o.dist2To(t) < d * d) ahead++;
    const active = ahead < (t.isPlayer ? g.tune.maxAttackers : 2);
    ai.cool -= dt;
    if (active) {
      if (d > 1.25) { w.x = dx / d; w.z = dz / d; w.speed = d > 5 ? 5.3 : 2.4; if (a.blocked) { w.x = dz / d; w.z = -dx / d; } }
      else {
        w.face = Math.atan2(dx, dz);
        if (ai.cool <= 0 && a.canAct) {
          a.attack(Math.random() < 0.72 ? 'punch' : 'kick');
          ai.cool = (a.faction === 'goon' ? 0.9 : 0.7) + Math.random() * (t.isPlayer ? g.tune.aiCooldown : 0.7);
        }
      }
    } else {
      const R = 3.3, ang = Math.atan2(-dx, -dz) + 0.5 * (a.id % 2 ? 1 : -1);
      const px = t.pos.x + Math.sin(ang) * R, pz = t.pos.z + Math.cos(ang) * R;
      const ex = px - a.pos.x, ez = pz - a.pos.z, e = Math.hypot(ex, ez);
      if (e > 0.5) { w.x = ex / e; w.z = ez / e; w.speed = d > 8 ? 5 : 1.7; }
      w.face = Math.atan2(dx, dz); a.combatT = 2;
      if (ai.cool <= -3 && Math.random() < 0.01) { g.ui.bark(a, rnd(BARKS[a.faction] || BARKS.cheer)); ai.cool = 0; }
    }
  }

  settle(a) {
    const ai = a.ai;
    ai.target = null; ai.threat = null; ai.veer = 0; ai.t = 0;
    if (ai.script) { ai.mode = 'script'; return; }
    if (ai.leader) { ai.mode = 'follow'; return; }
    if (ai.spot) ai.mode = 'hang'; else if (ai.loop) ai.mode = 'walk'; else ai.mode = 'idle';
  }

  // ---- population --------------------------------------------------------------------
  populate(dt) {
    const g = this.game, pl = g.player.pos, q = g.gfx.q, cam = g.gfx.camera;
    const night = g.sky.night, city = g.city;
    this.pedT -= dt; this.carT -= dt; this.parkT -= dt;
    if (this.mobT) { this.mobT -= dt; if (this.mobT <= 0) this.mobT = 0; }
    const fwdX = -Math.sin(g.cam.yaw), fwdZ = -Math.cos(g.cam.yaw);
    const visible = (x, z) => { const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz); return d < 26 || (d < 80 && (dx * fwdX + dz * fwdZ) / d > 0.55); };

    if (this.pedT <= 0) {
      this.pedT = 0.25;
      const want = Math.round(q.peds * (1 - night * 0.55) * this.density);
      let n = 0;
      for (let i = this.actors.length - 1; i >= 0; i--) {
        const a = this.actors[i]; if (!a.ai || a.ai.keep || a.remote) continue;
        const d2 = dist2(a.pos.x, a.pos.z, pl.x, pl.z);
        a.lod = d2 > 45 * 45 ? 1 : 0;
        if (d2 > 150 * 150 || (d2 > 95 * 95 && !visible(a.pos.x, a.pos.z) && a.ai.mode !== 'fight')) { this.removeActor(a); continue; }
        n++;
      }
      if (n < want) {
        // half the people stand around somewhere, the other half are on their way
        if (Math.random() < 0.55 && city.hang.length) {
          for (let tries = 0; tries < 6; tries++) {
            const s = rnd(city.hang);
            const d2 = dist2(s.x, s.z, pl.x, pl.z);
            if (d2 > 115 * 115 || d2 < 30 * 30 || visible(s.x, s.z)) continue;
            const used = this.spotOwner.get(s) || 0;
            const cap = s.kind === 'queue' || s.kind === 'bus' ? 1 : s.r > 3 ? 4 : 2;
            if (used >= cap) continue;
            if (s.kind === 'wedding' && night < 0.5) continue;
            const kind = rnd(HANG_PEDS[s.kind] || CIV_MIX);
            const a = Math.random() * 6.283, r = Math.random() * s.r;
            const p = this.spawnPed(kind, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, Math.random() * 6.28);
            if (!p) break;
            p.ai.mode = 'hang'; p.ai.spot = s; p.ai.ox = Math.cos(a) * r; p.ai.oz = Math.sin(a) * r; p.ai.nextGest = Math.random() * 6;
            this.spotOwner.set(s, used + 1); p.ai.spotRef = s;
            // sit if a free chair is right here
            for (const seat of city.seats) if (!this.spotOwner.get(seat) && dist2(seat.x, seat.z, s.x, s.z) < (s.r + 1.5) ** 2 && Math.random() < 0.6) { p.ai.spot = { x: seat.x, z: seat.z, yaw: seat.yaw, seat: true, kind: s.kind }; p.ai.ox = p.ai.oz = 0; this.spotOwner.set(seat, 1); p.ai.seatRef = seat; p.place(seat.x, seat.z, seat.yaw); break; }
            break;
          }
        } else {
          for (let tries = 0; tries < 6; tries++) {
            const li = Math.floor(Math.random() * walkLoops.length), L = walkLoops[li], i = Math.floor(Math.random() * 4), j = (i + 1) % 4, t = Math.random();
            const x = L[i].x + (L[j].x - L[i].x) * t + (Math.random() - 0.5) * 2, z = L[i].z + (L[j].z - L[i].z) * t + (Math.random() - 0.5) * 2;
            const d2 = dist2(x, z, pl.x, pl.z);
            if (d2 > 120 * 120 || d2 < 34 * 34 || visible(x, z) || !g.physics.circleFree(x, z, 0.5)) continue;
            const turf = turfAt(x, z);
            let kind = rnd(CIV_MIX);
            if (turf === 'gimel' && Math.random() < 0.35) kind = 'gimel'; else if (turf === 'dalet' && Math.random() < 0.18) kind = 'dalet';
            if (Math.random() < 0.035 && g.wanted.level === 0) kind = 'cop';
            const p = this.spawnPed(kind, x, z, 0);
            if (!p) break;
            p.ai.mode = 'walk'; p.ai.loop = L; p.ai.dir = Math.random() < 0.5 ? 1 : -1; p.ai.wp = p.ai.dir > 0 ? j : i;
            break;
          }
        }
      }
    }

    if (this.carT <= 0) {
      this.carT = 0.4;
      const want = Math.round(q.cars * (1 - night * 0.5) * this.density);
      let n = 0;
      for (let i = this.vehicles.length - 1; i >= 0; i--) {
        const v = this.vehicles[i];
        if (v.keep || v.driver === g.player.actor || v === g.player.lastVehicle) continue;
        const d2 = dist2(v.pos.x, v.pos.z, pl.x, pl.z);
        const traffic = v.ai instanceof TrafficAI;
        if (traffic) n++;
        const far = traffic ? 190 : (v.parked && !v.stolen ? 175 : 150);
        if (d2 > far * far || (v.despawn && !visible(v.pos.x, v.pos.z)) || (v.ai instanceof ChaseAI && d2 > 230 * 230)) { this.removeVehicle(v); continue; }
      }
      if (n < want) {
        for (let tries = 0; tries < 5; tries++) {
          const L = rnd(lanes), t = Math.random() * L.len;
          const x = L.ax + L.ux * t, z = L.az + L.uz * t, d2 = dist2(x, z, pl.x, pl.z);
          if (d2 > 170 * 170 || d2 < 70 * 70 || visible(x, z)) continue;
          if (this.vehicleNear(x, z, 9)) continue;
          const type = rnd(TRAFFIC_MIX);
          const v = this.spawnVehicle(type, x, z, Math.atan2(L.ux, L.uz));
          v.ai = new TrafficAI(v, L, t); v.vx = L.ux * L.speed * 0.6; v.vz = L.uz * L.speed * 0.6;
          const d = this.spawnPed(rnd(['dod', 'girl', 'suit', 'youth', 'mom']), x, z, 0); if (d) { d.ai.keep = true; this.seat(d, v); }
          break;
        }
      }
    }

    if (this.parkT <= 0) {
      this.parkT = 0.6;
      let count = 0;
      for (const v of this.vehicles) if (v.parked) count++;
      const spots = city.parking;
      for (let i = 0; i < 40 && count < g.tune.maxParked; i++) {
        const idx = Math.floor(Math.random() * spots.length), s = spots[idx];
        if (this.parkOwner.has(s)) continue;
        const d2 = dist2(s.x, s.z, pl.x, pl.z);
        if (d2 > 135 * 135 || d2 < 28 * 28) continue;
        const h = (idx * 2654435761) >>> 0;
        const special = { police: 'police', bus: 'bus', truck: 'truck', truckMoshav: 'truck', tractor: 'tractor' }[s.kind];
        if (!special && (h % 100) > 62) { this.parkOwner.set(s, null); continue; }      // empty bay, stays empty
        if (visible(s.x, s.z) && d2 < 70 * 70) continue;
        const type = special || (s.kind === 'lux' ? 'sedan' : PARKED_MIX[h % PARKED_MIX.length]);
        const tints = VEHICLES[type].tints;
        const v = this.spawnVehicle(type, s.x, s.z, s.yaw + (VEHICLES[type].bike ? 0.3 : 0), { parked: true, tint: s.kind === 'lux' ? 0x23262b : tints[(h >> 8) % tints.length] });
        if (s.kind === 'wreck') { v.hp = v.maxHp * 0.25; }
        this.parkOwner.set(s, v); count++;
      }
    }
  }

  update(dt) {
    const g = this.game;
    this.populate(dt);
    for (const a of this.actors) { if (a.ai && !a.isPlayer && !a.remote) this.think(a, dt); a.update(dt); }
    // people do not walk through each other
    const A = this.actors;
    for (let i = 0; i < A.length; i++) {
      const a = A[i]; if (a.vehicle || !a.root.visible) continue;
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j]; if (b.vehicle || !b.root.visible) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz, min = a.radius + b.radius;
        if (d2 >= min * min || d2 < 1e-6) continue;
        if (a.state === 'down' || b.state === 'down') continue;
        const d = Math.sqrt(d2), p = (min - d) / 2, nx = dx / d, nz = dz / d;
        const wa = a.remote ? 0 : a.isPlayer || a.state === 'sit' ? 0.25 : 1, wb = b.remote ? 0 : b.isPlayer || b.state === 'sit' ? 0.25 : 1, s = wa + wb || 1;
        a.pos.x -= nx * p * 2 * (wa / s); a.pos.z -= nz * p * 2 * (wa / s); b.pos.x += nx * p * 2 * (wb / s); b.pos.z += nz * p * 2 * (wb / s);
        const pl = a.isPlayer ? a : b.isPlayer ? b : null, o = pl === a ? b : a;
        if (pl && pl.speed > 4.2 && o.ai && o.ai.mode !== 'fight' && o.state === 'idle' && (o.ai.bumpT || 0) < g.time) { o.ai.bumpT = g.time + 5; g.ui.bark(o, rnd(BARKS.bump)); o.vel.x += nx * 2; o.vel.z += nz * 2; }
      }
    }
    for (const v of this.vehicles) { if (v.remoteDriver || v.ghost && v !== g.player.vehicle) { v.updateLights(dt, 0); continue; } if (v.ai && !v.wreck) v.ai.update(g, dt); else if (!v.driver) { v.in.throttle = 0; v.in.brake = 0.3; v.in.steer = 0; } v.update(dt); }
    collideVehicles(g, this.vehicles);
    collideVehicleActors(g, this.vehicles.filter((v) => !v.sleep), this.actors);
    for (const a of this.actors) if (a.vehicle) { a.pos.copy(a.vehicle.pos); a.heading = a.vehicle.yaw; }
    this.updateCats(dt);
  }

  // ---- street cats -------------------------------------------------------------------
  updateCats(dt) {
    const g = this.game, md = g.assets.models.p_cat, pl = g.player.pos;
    if (!md) return;
    this.catT -= dt;
    if (this.catT <= 0) {
      this.catT = 1.5;
      for (let i = this.cats.length - 1; i >= 0; i--) { const c = this.cats[i]; if (dist2(c.x, c.z, pl.x, pl.z) > 110 * 110) { this.group.remove(c.mesh); c.spot.used = false; this.cats.splice(i, 1); } }
      if (this.cats.length < 7) for (const s of g.city.cats) {
        if (s.used) continue;
        const d2 = dist2(s.x, s.z, pl.x, pl.z);
        if (d2 > 90 * 90 || d2 < 20 * 20 || !g.physics.circleFree(s.x, s.z, 0.3)) continue;
        const m = md.scene.clone(true), holder = new THREE.Group(), k = 0.42 / md.size.y;
        m.position.set(-md.centre.x, -md.minY, -md.centre.z); holder.add(m); holder.scale.setScalar(k);
        holder.position.set(s.x, 0.14, s.z); holder.rotation.y = Math.random() * 6.28;
        this.group.add(holder); s.used = true;
        this.cats.push({ mesh: holder, x: s.x, z: s.z, hx: s.x, hz: s.z, spot: s, run: 0, vx: 0, vz: 0 });
        break;
      }
    }
    for (const c of this.cats) {
      const dx = c.x - pl.x, dz = c.z - pl.z, d = Math.hypot(dx, dz);
      if (c.run <= 0 && d < 3.2 + g.player.speed * 0.4) { c.run = 1.4; const a = Math.atan2(dx, dz) + (Math.random() - 0.5); c.vx = Math.sin(a) * 7; c.vz = Math.cos(a) * 7; g.bus.emit('cat', c); }
      if (c.run > 0) {
        c.run -= dt; c.x += c.vx * dt; c.z += c.vz * dt;
        const p = { x: c.x, z: c.z }; if (g.physics.resolveCircle(p, 0.2, 0, 0.4)) { c.x = p.x; c.z = p.z; }
        c.mesh.position.set(c.x, 0.14 + Math.abs(Math.sin(c.run * 16)) * 0.12, c.z); c.mesh.rotation.y = Math.atan2(c.vx, c.vz);
      }
    }
  }

  clearAll() {
    for (const a of [...this.actors]) if (!a.isPlayer && !a.peerId) this.removeActor(a);
    for (const v of [...this.vehicles]) { v.keep = false; if (v.driver && v.driver.isPlayer) continue; this.removeVehicle(v); }
    this.spotOwner.clear(); this.parkOwner.clear();
  }
}
