// One run: physics stepping, scoring, power-ups, stumbles and the chaser, missions, camera.
import * as THREE from 'three';
import { PHYS, POWERUPS, MISSIONS, REVIVE_COST, MAX_MULT, ZONES, LEVEL_REWARD } from './config.js';
import { speedAt } from './track.js';
import { zoneAt } from './world.js';
import { sfx, setMusicIntensity } from './audio.js';
import { haptic } from './haptics.js';
import * as Save from './save.js';

const STEP = 1 / 120;

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, camera, world, track, player, fx, ui, assets
    this.state = 'menu';
    this.time = 0;
    this.camPos = new THREE.Vector3(0, 3.4, 6.4);
    this.camLook = new THREE.Vector3(0, 1.2, -7);
    this._shake = new THREE.Vector3();
    this.run = null;
    this.chaser = null;
    this.menuT = 0;
  }

  async initChaser() {
    const tpl = await this.assets.npc('moroccan');
    const inst = this.assets.instanceNpc(tpl);
    const g = new THREE.Group();
    g.add(inst.root);
    inst.root.rotation.y = Math.PI;
    g.visible = false;
    this.scene.add(g);
    const run = inst.mixer.clipAction(tpl.clips.run);
    run.play();
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.track.bubble('עצור! העגבניות שלי!'), transparent: true, depthWrite: false, toneMapped: false }));
    bubble.scale.set(1.35, 0.42, 1);
    bubble.position.set(0, 1.9, 0);
    bubble.renderOrder = 9;
    g.add(bubble);
    this.chaser = { obj: g, mixer: inst.mixer, dist: 14, x: 0, bubble };
  }

  // ---------- run lifecycle ----------
  startRun() {
    const s = Save.get();
    const tutorial = !s.tutorialDone;
    this.run = {
      d: 0, prevD: 0, speed: tutorial ? 11.5 : speedAt(0), score: 0, coins: 0, combo: 0, comboT: 0,
      mult: Math.min(MAX_MULT, s.level), time: 0, chaserT: 0, invuln: 1.2, acc: 0,
      powers: { magnet: 0, x2: 0, sneakers: 0, hamsa: 0 },
      stats: { coins: 0, dist: 0, jumps: 0, rolls: 0, score: 0, powerups: 0, dodgeNpc: 0, roofs: 0, zones: 1, magnetCoins: 0, nearMiss: 0, runs: 1 },
      zoneIndex: 0, revives: 0, tutorial, tutorialStep: 0, missionFlags: new Set(), roofed: new Set(), slow: 0,
    };
    this.fx.clear();
    this.player.reset();
    this.player.setMode('run');
    this.track.reset({ tutorial, playerChar: s.selected });
    this.world.reset(0);
    this.world.snapTheme(ZONES[0].theme);
    this.chaser && (this.chaser.obj.visible = false, this.chaser.dist = 14);
    this.state = 'playing';
    this.ui.showHUD(this.run);
    this.ui.zoneBanner(ZONES[0].name, ZONES[0].sub);
    if (tutorial) this.ui.hint(null);
  }

  powerDuration(type) {
    const lvl = Save.get().upgrades[type] || 0;
    return POWERUPS[type].base + POWERUPS[type].step * lvl;
  }

  // ---------- input ----------
  action(a) {
    const r = this.run;
    if (this.state !== 'playing' || !r) return;
    const p = this.player;
    if (p.dead) return;
    if (a === 'left' || a === 'right') {
      if (p.move(a === 'left' ? -1 : 1)) { sfx.swipe(a === 'left' ? -1 : 1); haptic('lane'); }
    } else if (a === 'up') {
      if (p.jump(this.gravity())) {
        r.stats.jumps++;
        if (p.superJump) sfx.superJump(); else sfx.jump();
        haptic('jump');
        this.fx.dust(p.x, p.y, 0, 6);
      }
    } else if (a === 'down') {
      const res = p.roll();
      if (res) { r.stats.rolls += res === true ? 1 : 0; sfx.roll(); haptic('roll'); if (res === true) this.fx.dust(p.x, p.y, 0.3, 8); }
    }
    if (r.tutorial && this.ui.hintShown === a) { this.ui.hint(null); r.slow = 0; }
  }

  gravity() {
    const sn = (this.run.speed - 13) / 21;
    return PHYS.gravity * (0.92 + 0.3 * THREE.MathUtils.clamp(sn, 0, 1)) * (this.player.superJump ? 0.8 : 1);
  }

  // ---------- frame ----------
  update(dt) {
    this.time += dt;
    if (this.state === 'playing' || this.state === 'dying') this.updateRun(dt);
    else if (this.state === 'over' || this.state === 'revive') this.updateFrozen(dt);
    else this.updateMenu(dt);
    this.fx.update(dt, this.state === 'playing' ? (this.run ? this.run.speed * dt * this.timeScale() : 0) : 0);
  }

  timeScale() { return this.run && this.run.slow > 0 ? 0.35 : 1; }

  updateRun(dtReal) {
    const r = this.run, p = this.player;
    const dt = dtReal * (this.state === 'playing' ? this.timeScale() : 1);
    if (this.state === 'playing') {
      r.time += dt;
      const target = r.tutorial ? 11.5 : speedAt(r.d);
      r.speed += (target - r.speed) * Math.min(1, dt * 1.5);
      r.acc += dt;
      let steps = 0;
      while (r.acc >= STEP && steps < 12) {
        r.acc -= STEP; steps++;
        this.physicsStep(STEP);
        if (this.state !== 'playing') break;
      }
      if (steps >= 12) r.acc = 0;
      this.processTimers(dt);
      this.tutorialHints();
    } else {
      // dying: world stops, death animation plays
      p.step(dt, this.gravity(), () => p.groundY);
    }
    p.superJump = r.powers.sneakers > 0;
    this.track.update(dt, r.d, r.speed, this.time, p);
    p.update(dtReal, this.state === 'playing' ? r.speed : 0, this.time);
    this.world.update(dt, r.d, p.root.position, this.time);
    this.updateChaser(dtReal);
    this.updateCamera(dtReal);
    // shield visual
    const hamsa = r.powers.hamsa;
    p.setShield(hamsa > 0 ? (hamsa < 2 ? 0.5 + 0.5 * Math.sin(this.time * 18) : 1) : 0);
    setMusicIntensity(THREE.MathUtils.clamp((r.speed - 13) / 21, 0, 1));
    this.ui.updateHUD(r, this.powerList());
  }

  physicsStep(dt) {
    const r = this.run, p = this.player;
    r.prevD = r.d;
    r.d += r.speed * dt;
    const grav = this.gravity();
    p.step(dt, grav, x => this.track.groundAt(x, r.d, p.y));
    if (p.landed) { p.landed = false; sfx.land(); haptic('land'); this.fx.dust(p.x, p.y, 0, 7); }
    this.track.step(dt, r.d, r.prevD, p, { magnet: r.powers.magnet > 0 });
    const mul = r.mult * (r.powers.x2 > 0 ? 2 : 1);
    r.score += r.speed * dt * 0.5 * mul;
    for (const ev of this.track.events) this.handleEvent(ev, mul);
    this.track.events.length = 0;
    if (r.invuln > 0) r.invuln -= dt;
  }

  handleEvent(ev, mul) {
    const r = this.run, p = this.player;
    switch (ev.t) {
      case 'coin':
        r.coins++; r.stats.coins++; r.combo++; r.comboT = 0.6;
        if (ev.magnet) r.stats.magnetCoins++;
        r.score += 5 * mul;
        sfx.coin(r.combo); haptic('coin');
        this.fx.coinBurst(ev.x, ev.y, 0.1);
        break;
      case 'power': {
        const type = ev.power;
        r.powers[type] = this.powerDuration(type);
        r.stats.powerups++;
        sfx.powerup(); haptic('power');
        this.fx.sparkle(ev.x, ev.y, 0, POWERUPS[type].color);
        this.fx.popup(POWERUPS[type].name, p.x, 3.2, -1.5, POWERUPS[type].color, 1);
        this.ui.toast(POWERUPS[type].name + '!', POWERUPS[type].desc);
        break;
      }
      case 'climb':
        if (p.y < ev.y || !p.grounded) { p.y = ev.y; p.vy = 0; if (!p.grounded) { p.grounded = true; p.landed = true; if (p.rollT <= 0) p.play('run', 0.1); } }
        if (!r.roofed.has(ev.e)) { r.roofed.add(ev.e); r.stats.roofs++; }
        break;
      case 'hit':
        this.onHit(ev.e, ev.how);
        break;
      case 'passed':
        if (ev.e.type.startsWith('npc:') || ev.e.type.startsWith('ped:') || ev.e.type === 'van') {
          r.stats.dodgeNpc++;
          if (ev.near) {
            r.stats.nearMiss++;
            r.score += 25 * mul;
            this.fx.popup('כמעט!', p.x, 2.6, -1, '#7df9ff', 0.8);
          }
        }
        break;
      case 'horn': sfx.horn(); break;
      case 'tutorialDone':
        if (ev.step > r.tutorialStep) r.tutorialStep = ev.step;
        if (ev.step >= 4 && !Save.get().tutorialDone) { Save.get().tutorialDone = true; Save.save(); r.tutorial = false; this.ui.hint(null); this.ui.toast('מעולה!', 'עכשיו זה אמיתי. בהצלחה!'); }
        break;
    }
  }

  onHit(e, how) {
    const r = this.run, p = this.player;
    if (r.invuln > 0 || e.hit) { if (e.kind !== 'platform') e.grace = 0.3; return; }
    // the hamsa protects from anything once
    if (r.powers.hamsa > 0) {
      r.powers.hamsa = 0;
      sfx.shieldBreak(); haptic('shield');
      this.fx.shield(p.x, p.y + 1, 0);
      this.fx.shake(0.25, 0.3);
      r.invuln = 0.8;
      if (e.kind === 'platform') { p.y = e.h; p.vy = 0; p.grounded = true; }
      else { this.track.knockAway(e, p.x); this.fx.splat(e.x, 0.8, -0.5); }
      this.ui.toast('החמסה שמרה עליך!', '');
      return;
    }
    e.hit = true;
    const side = how === 'side';
    const fatal = !side && (e.kind === 'wall' || e.kind === 'platform');
    if (fatal) return this.crash(e);
    // a stumble: low/high obstacles get knocked over, side hits bounce you back
    if (side) { p.bounceBack(); e.grace = 0.6; e.hit = false; }
    else { this.track.knockAway(e, p.x); this.fx.splat(e.x, 0.6, -0.3); }
    this.stumble(e);
  }

  stumble(e) {
    const r = this.run, p = this.player;
    sfx.stumble(); haptic('stumble');
    this.fx.shake(0.18, 0.3);
    if (r.chaserT > 0) { this.crash(e, true); return; }
    p.stumble();
    r.chaserT = 7;
    r.invuln = 0.5;
    sfx.whistle();
    this.ui.toast('אוי! סבתא רודפת אחריך!', 'עוד מכה אחת והיא תופסת אותך');
  }

  crash(e, caught = false) {
    const r = this.run, p = this.player;
    p.die();
    sfx.crash(); haptic('crash');
    this.fx.shake(0.45, 0.55);
    this.fx.splat(p.x, 1, -0.6);
    this.state = 'dying';
    r.deathCause = caught ? 'caught' : (e && e.type) || 'wall';
    if (caught && this.chaser) r.chaserT = 3; // keep her on screen
    setTimeout(() => this.afterDeath(), 1300);
  }

  afterDeath() {
    if (this.state !== 'dying') return;
    const r = this.run;
    const cost = REVIVE_COST[Math.min(r.revives, REVIVE_COST.length - 1)];
    if (r.revives < REVIVE_COST.length && Save.get().coins >= cost) {
      this.state = 'revive';
      this.ui.reviveOffer(cost, ok => { if (ok) this.revive(cost); else this.finishRun(); });
    } else this.finishRun();
  }

  revive(cost) {
    const r = this.run, p = this.player;
    const s = Save.get();
    s.coins -= cost; Save.save();
    r.revives++;
    this.track.clearAround(r.d, 45);
    p.revive();
    r.chaserT = 0; r.invuln = 2.0;
    r.speed = Math.max(13, r.speed * 0.75);
    this.state = 'playing';
    sfx.powerup(); haptic('power');
    this.ui.showHUD(r);
  }

  finishRun() {
    const r = this.run, s = Save.get();
    this.state = 'over';
    r.stats.dist = Math.floor(r.d);
    r.stats.score = Math.floor(r.score);
    const earned = r.coins * 10;
    s.coins += earned;
    s.stats.runs++; s.stats.coins += r.coins; s.stats.dist += Math.floor(r.d);
    const newBest = Math.floor(r.score) > s.best;
    if (newBest) s.best = Math.floor(r.score);
    const missionNews = this.applyMissions(r.stats);
    Save.save();
    this.ui.gameOver({ score: Math.floor(r.score), dist: Math.floor(r.d), coins: r.coins, earned, newBest, best: s.best, missions: missionNews, cause: r.deathCause });
  }

  // progress missions with this run's stats; returns info for the UI
  applyMissions(stats, live = false) {
    const s = Save.get();
    const completed = [];
    for (const m of s.missions) {
      if (m.done) continue;
      const def = MISSIONS[m.i];
      const val = stats[def.stat] || 0;
      const prog = def.single ? Math.max(m.progress, val) : m.progress + val;
      if (live) { if (prog >= m.target) completed.push(m); continue; }
      m.progress = Math.min(m.target, prog);
      if (m.progress >= m.target) { m.done = true; completed.push(m); }
    }
    let leveled = null;
    if (!live && s.missions.every(m => m.done)) {
      const reward = LEVEL_REWARD * s.level;
      s.level = Math.min(MAX_MULT, s.level + 1);
      s.coins += reward;
      Save.newMissionSet();
      leveled = { level: s.level, reward };
    }
    return { completed, leveled };
  }

  processTimers(dt) {
    const r = this.run;
    for (const k of Object.keys(r.powers)) {
      if (r.powers[k] > 0) {
        r.powers[k] -= dt;
        if (r.powers[k] <= 0) { r.powers[k] = 0; sfx.powerEnd(); }
      }
    }
    if (r.comboT > 0) { r.comboT -= dt; if (r.comboT <= 0) r.combo = 0; }
    if (r.chaserT > 0) r.chaserT -= dt;
    // zones
    const z = zoneAt(r.d);
    if (z.index !== r.zoneIndex) {
      r.zoneIndex = z.index;
      r.stats.zones = Math.max(r.stats.zones, z.index + 1);
      const loop = z.loop > 0 ? ` · סיבוב ${z.loop + 1}` : '';
      this.ui.zoneBanner(z.zone.name, z.zone.sub + loop);
      sfx.zone(); haptic('power');
    }
    // live mission completion toasts
    const s = Save.get();
    r.stats.dist = Math.floor(r.d); r.stats.score = Math.floor(r.score);
    for (const m of s.missions) {
      if (m.done || r.missionFlags.has(m)) continue;
      const def = MISSIONS[m.i];
      const val = r.stats[def.stat] || 0;
      const prog = def.single ? Math.max(m.progress, val) : m.progress + val;
      if (prog >= m.target) { r.missionFlags.add(m); sfx.mission(); haptic('power'); this.ui.toast('משימה הושלמה!', def.text(m.target)); }
    }
  }

  powerList() {
    const r = this.run;
    return Object.entries(r.powers).filter(([, t]) => t > 0).map(([k, t]) => ({ k, t, max: this.powerDuration(k) }));
  }

  tutorialHints() {
    const r = this.run;
    if (!r.tutorial || !this.track.tutorialRows) return;
    for (let i = 0; i < this.track.tutorialRows.length; i++) {
      const [d, a] = this.track.tutorialRows[i];
      if (r.tutorialStep > i) continue;
      const ahead = d - r.d;
      if (ahead < 16 && ahead > 2 && !this.ui.hintShown && r.tutorialStep === i) { this.ui.hint(a); r.slow = 1; }
      if (ahead <= 0.5 && this.ui.hintShown === a) { this.ui.hint(null); r.slow = 0; }
      break;
    }
  }

  // ---------- chaser (the grandma whose tomatoes you knocked over) ----------
  updateChaser(dt) {
    const c = this.chaser, r = this.run, p = this.player;
    if (!c) return;
    const active = r && r.chaserT > 0;
    const caught = this.state === 'dying' && r.deathCause === 'caught';
    const target = caught ? 0.7 : active ? 1.75 : 16;
    if ((active || caught) && c.dist > 4.6) c.dist = 4.6; // pop in at the edge of the camera's view
    c.dist += (target - c.dist) * Math.min(1, dt * (active ? 2.5 : 0.8));
    c.obj.visible = c.dist < 14;
    if (!c.obj.visible) return;
    const side = p.lane === 2 ? -0.75 : 0.75;
    c.x += (p.x + side - c.x) * Math.min(1, dt * 5);
    c.obj.position.set(c.x, 0, c.dist);
    c.bubble.material.opacity = THREE.MathUtils.clamp((8 - c.dist) / 4, 0, 1);
    c.bubble.position.x = -Math.sign(side) * 0.55;
    c.mixer.update(dt * (this.state === 'playing' ? 1.25 : 0.6));
  }

  // ---------- camera ----------
  updateCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    const aspect = cam.aspect;
    const portrait = aspect < 1;
    const back = portrait ? 4.9 : 5.0;
    const height = portrait ? 3.05 : 2.85;
    const tx = p.x * 0.82, ty = height + p.y * 0.62, tz = back;
    const k = 1 - Math.exp(-dt * 9);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * (1 - Math.exp(-dt * 5));
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camLook.set(p.x * 0.9, 1.15 + p.y * 0.62, -10);
    this.fx.shakeOffset(this._shake);
    cam.position.copy(this.camPos).add(this._shake);
    cam.lookAt(this.camLook);
  }

  // after a crash: the street stays put while menus are shown over it
  updateFrozen(dt) {
    this.player.update(dt, 0, this.time);
    this.updateChaser(dt);
    this.updateCamera(dt);
  }

  // ---------- menu scene ----------
  updateMenu(dt) {
    this.menuT += dt;
    const p = this.player;
    p.update(dt, 0, this.time);
    this.world.update(dt, 0, p.root.position, this.time);
    // slow orbit in front of the character
    const a = Math.sin(this.menuT * 0.25) * 0.35;
    const cam = this.camera;
    const portrait = cam.aspect < 1;
    const dist = portrait ? 4.6 : 3.9;
    cam.position.set(p.x + Math.sin(a) * dist, 1.45, Math.cos(a) * dist);
    cam.lookAt(p.x, portrait ? 1.15 : 1.05, 0);
    if (this.chaser) this.chaser.obj.visible = false;
  }
}
