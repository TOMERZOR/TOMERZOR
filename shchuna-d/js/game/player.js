// Nehorai: turns input into intent for his Actor, or for the vehicle he is driving.
import { Actor } from './character.js';
import { clamp, damp } from '../core/util.js';
import { BARKS } from './defs.js';

const _d = { x: 0, z: 0 };

export class Player {
  constructor(game) {
    this.game = game;
    const a = this.actor = new Actor(game, 'hero', { hp: 100 });
    a.isPlayer = true; a.faction = 'player'; a.dmgMul = 1.25;
    game.world.addActor(a);
    this.pos = a.pos;
    this.stamina = 1; this.money = 0; this.armor = 0;
    this.vehicle = null; this.lastVehicle = null;
    this.lockT = 0;              // brief input lock while getting in/out
    this.regenT = 0;
    this.control = true;
    this.speed = 0;
    this.stats = { kos: 0, cars: 0, dist: 0, busted: 0, wasted: 0, earned: 0 };
    game.bus.on('hurt', (victim, from, dmg) => {
      if (victim === a) { this.regenT = 6; game.gfx.hurt = Math.min(1, game.gfx.hurt + dmg * 0.02); game.cam.shake(0.25); game.input.vibrate(40); }
      else if (from === a) { game.cam.shake(0.12); game.input.vibrate(15); }
    });
    game.bus.on('ko', (victim, from) => { if (from === a && victim !== a) this.stats.kos++; });
  }

  get hp() { return this.actor.hp; }
  get inVehicle() { return !!this.vehicle; }

  addMoney(n, why) {
    this.money = Math.max(0, Math.round(this.money + n));
    if (n > 0) this.stats.earned += n;
    this.game.bus.emit('money', n, why);
  }

  teleport(x, z, heading = 0) {
    if (this.vehicle) this.leaveVehicle(true);
    this.actor.place(x, z, heading); this.actor.revive(Math.max(0.2, this.actor.hp / this.actor.maxHp));
    this.game.cam.snap(heading + Math.PI);
  }

  tryEnter() {
    const g = this.game, a = this.actor;
    if (this.vehicle) {
      const v = this.vehicle;
      if (v.speed > 9) {                         // bail out at speed: it hurts
        this.leaveVehicle(false);
        a.takeHit(v.speed * 1.2, null, -v.fx, -v.fz, true, v.speed * 0.5);
        return;
      }
      this.leaveVehicle(false);
      return;
    }
    if (!a.canAct) return;
    let best = null, bd = 3.1;
    for (const v of g.world.vehicles) {
      if (v.wreck || v.locked) continue;
      const dx = a.pos.x - v.pos.x, dz = a.pos.z - v.pos.z;
      const f = dx * v.fx + dz * v.fz, s = -dx * v.fz + dz * v.fx;
      const d = Math.hypot(Math.max(0, Math.abs(f) - v.len / 2), Math.max(0, Math.abs(s) - v.wid / 2));
      if (d < bd) { bd = d; best = v; }
    }
    if (!best) return;
    this.enterVehicle(best);
  }

  enterVehicle(v, silent) {
    const g = this.game, a = this.actor;
    if (v.driver && v.driver !== a) {
      const d = g.world.eject(v, true);
      if (!silent) { g.wanted.crime('carjack', d); }
    } else if (!v.owned && !v.stolen && !silent && !v.tagFree) g.wanted.witness('theft', a);
    if (v.crew) { for (const c of v.crew) if (c.vehicle === v) { c.vehicle = null; c.visible = true; const p = v.doorPos({ x: 0, z: 0 }, -1); c.place(p.x, p.z, v.yaw); if (c.ai) { c.ai.mode = 'fight'; c.ai.target = a; } } v.crew = null; }
    v.ai = null; v.driver = a; v.parked = false; v.stolen = true; v.wake(); v.despawn = false;
    a.vehicle = v; this.vehicle = v; this.lastVehicle = v;
    a.setState('idle');
    if (v.def.bike) { a.sit(true); a.visible = true; } else a.visible = false;
    this.lockT = 0.45; this.stats.cars++;
    g.bus.emit('enterVehicle', v);
  }

  leaveVehicle(instant) {
    const g = this.game, a = this.actor, v = this.vehicle;
    if (!v) return;
    let p = v.doorPos(_d, 1);
    if (!g.physics.circleFree(p.x, p.z, 0.4)) p = v.doorPos(_d, -1);
    if (!g.physics.circleFree(p.x, p.z, 0.4)) { p.x = v.pos.x - v.fx * (v.len / 2 + 0.8); p.z = v.pos.z - v.fz * (v.len / 2 + 0.8); }
    v.driver = null; v.in.throttle = 0; v.in.steer = 0; v.in.brake = 0; v.in.hand = false; v.siren = false;
    a.vehicle = null; this.vehicle = null; a.visible = true; a.root.visible = true;
    a.setState('idle'); a.play('idle', 0.1, { restart: true });
    a.place(p.x, p.z, v.yaw);
    a.vel.set(v.vx * 0.5, 0, v.vz * 0.5);
    if (!instant) this.lockT = 0.3;
    g.bus.emit('leaveVehicle', v);
  }

  update(dt) {
    const g = this.game, inp = g.input, a = this.actor;
    if (this.lockT > 0) this.lockT -= dt;
    // slow natural recovery when left alone
    if (this.regenT > 0) this.regenT -= dt;
    else if (a.hp < a.maxHp * 0.5 && !a.ko) a.hp = Math.min(a.maxHp * 0.5, a.hp + dt * 2.5);
    g.gfx.hurt = damp(g.gfx.hurt, a.hp < 30 && !a.ko ? 0.35 : 0, 2.5, dt);

    const ctl = this.control && !g.cutscene && !a.ko && this.lockT <= 0;
    if (this.vehicle) {
      const v = this.vehicle, i = v.in;
      if (ctl) {
        let thr = Math.max(inp.move.y, 0), brk = Math.max(-inp.move.y, 0);
        if (inp.throttle > 0.05 || inp.brake > 0.05) { thr = inp.throttle; brk = inp.brake; }
        if (inp.touch) { thr = inp.down.gas ? 1 : 0; brk = inp.down.brakeBtn ? 1 : 0; }
        i.throttle = thr; i.brake = brk; i.steer = inp.move.x;
        i.hand = !!(inp.down.jump || inp.down.hand);
        if (inp.pressed.horn || inp.pressed.punch) g.bus.emit('honk', v);
        if (inp.pressed.kick && v.def.siren) v.siren = !v.siren;
        if (inp.pressed.enter) this.tryEnter();
        if (inp.pressed.radio) g.audio.nextRadio();
      } else { i.throttle = 0; i.brake = 1; i.steer = 0; i.hand = false; }
      this.speed = v.speed;
      this.stats.dist += v.speed * dt;
      if (v.wreck && ctl && v.speed < 1) { /* stuck in a dead car: the HUD prompts to get out */ }
      return;
    }

    const w = a.wish;
    if (ctl) {
      const mx = inp.move.x, my = inp.move.y, m = Math.hypot(mx, my);
      if (m > 0.12) {
        const yaw = g.cam.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const dx = fx * my + -fz * mx, dz = fz * my + fx * mx, l = Math.hypot(dx, dz);
        const sprint = (inp.down.sprint || inp.down.sprintStick) && this.stamina > 0.02 && m > 0.6;
        w.x = dx / l; w.z = dz / l;
        w.speed = sprint ? 6.6 : m > 0.6 ? 3.6 : 1.5;
        if (a.combatT > 0 && !sprint) w.speed = Math.min(w.speed, 3.0);
        if (sprint) this.stamina = Math.max(0, this.stamina - dt * 0.085); else this.stamina = Math.min(1, this.stamina + dt * 0.16);
      } else { w.speed = 0; this.stamina = Math.min(1, this.stamina + dt * 0.22); }
      if (inp.pressed.punch) a.attack('punch');
      if (inp.pressed.kick) a.attack('kick');
      if (inp.pressed.jump) a.jump();
      if (inp.pressed.enter) this.tryEnter();
    } else w.speed = 0;
    this.speed = a.speed || 0;
    this.stats.dist += this.speed * dt;
  }

  // serialised for saves
  save() { return { x: this.pos.x, z: this.pos.z, h: this.actor.heading, hp: this.actor.hp, money: this.money, armor: this.armor, stats: this.stats }; }
  load(s) {
    if (!s) return;
    this.money = s.money || 0; this.armor = s.armor || 0; Object.assign(this.stats, s.stats || {});
    this.actor.hp = clamp(s.hp || 100, 30, 100);
    this.actor.place(s.x, s.z, s.h || 0);
  }
}
export { BARKS };
