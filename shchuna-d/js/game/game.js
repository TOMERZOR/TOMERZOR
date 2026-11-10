// The game object: owns every system, runs the frame, handles death, arrest, saving.
import * as THREE from 'three';
import { Gfx } from '../engine/renderer.js';
import { SkySystem } from '../engine/sky.js';
import { LampLights } from '../engine/lamps.js';
import { Physics } from '../engine/physics.js';
import { Assets, CLIP_NAMES } from '../engine/assets.js';
import { Input } from '../engine/input.js';
import { GameAudio } from '../engine/audio.js';
import { createMaterials, loadFonts } from '../world/textures.js';
import { CityBuilder } from '../world/city.js';
import { POI, onRoad, inCity } from '../world/map.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Wanted } from './wanted.js';
import { GameCamera, Fx } from './camera.js';
import { Missions } from './missions.js';
import { Hud } from '../ui/hud.js';
import { Menu } from '../ui/menu.js';
import { STORY, SPEAKERS, setupWorldSpots } from './story.js';
import { Online } from '../net/online.js';
import { CHARS, VEHICLES } from './defs.js';
import { Bus, clamp, dist2 } from '../core/util.js';

const SAVE_KEY = 'shchunaD.save.v1', SET_KEY = 'shchunaD.settings.v1';
const TIPS = ['סבתות על ספסלים רואות הכול. באמת הכול.', 'צ׳קלקה אחת זה שיחה. חמש זה מסוק.', 'פלאפל מחזיר בריאות. מדעית.', 'ברכב: רווח לבלם יד, Q לרדיו.', 'בשכונה ג׳ לא מרימים יד. אלא אם באת עם חברים.', 'המשטרה מאבדת אותך כשאף שוטר לא רואה אותך.', 'אפשר לישון בבית כדי לשמור ולהעביר את הזמן.'];

export class Game {
  constructor() {
    this.bus = new Bus();
    this.time = 0; this.playing = false; this.paused = false; this.cutscene = false; this.mode = 'menu';
    this.settings = Object.assign({ quality: 'auto', shake: true, pops: true, autoAdvance: false, sens: 1, invertY: false, master: 0.9, music: 0.6, sfx: 0.9, fps: false }, this.readJSON(SET_KEY) || {});
    this.tune = { maxAttackers: 2, aiCooldown: 1.1, maxParked: 22 };
    this.spots = [];             // things to interact with: { pos, r, text, action, cond }
    this.q = new URLSearchParams(location.search);
    this.dev = this.q.has('dev');
    this._acc = 0; this._last = 0; this._fps = 60; this.timeScale = 1;
  }

  readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  async boot() {
    const fill = document.getElementById('boot-fill'), tip = document.getElementById('boot-tip');
    const prog = (p, t) => { fill.style.width = Math.round(p * 100) + '%'; if (t) tip.textContent = t; };
    tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    const canvas = document.getElementById('view');
    this.gfx = new Gfx(canvas);
    const qn = this.q.get('q') || (this.settings.quality === 'auto' ? Gfx.autoQuality() : this.settings.quality);
    this.gfx.setQuality(qn);
    this.tune.maxParked = { low: 12, medium: 18, high: 24, ultra: 30 }[this.gfx.qName] || 18;
    this.input = new Input(canvas); this.input.sens = this.settings.sens; this.input.invertY = this.settings.invertY;
    this.audio = new GameAudio(this); Object.assign(this.audio.vol, { master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx });
    prog(0.05);
    await loadFonts();
    this.assets = new Assets();
    const list = [];
    const models = new Set(Object.values(VEHICLES).map((v) => v.model).concat(['p_dumpster', 'p_chair', 'p_atm', 'p_cat']));
    for (const m of models) list.push({ type: 'model', name: m, url: `assets/models/${m}.glb` });
    for (const m of new Set(Object.values(CHARS).map((c) => c.model))) list.push({ type: 'char', name: m, url: `assets/models/${m}.glb` });
    for (const c of CLIP_NAMES) list.push({ type: 'clip', name: c, url: `assets/anim/${c}.glb` });
    await this.assets.load(list, (p) => prog(0.05 + p * 0.6));
    prog(0.68, 'בונה את הבלוקים…');
    await new Promise((r) => setTimeout(r, 30));
    this.mats = await createMaterials(this.gfx);
    this.physics = new Physics();
    this.city = new CityBuilder(this.gfx, this.mats, this.physics, this.assets.models).build();
    this.gfx.scene.add(this.city.group);
    prog(0.86, 'מעיר את השכנים…');
    await new Promise((r) => setTimeout(r, 30));
    this.sky = new SkySystem(this.gfx);
    this.lampLights = new LampLights(this.gfx.scene, this.city.lamps);
    this.lampLights.setCount(this.gfx.q.lamps);
    this.fx = new Fx(this);
    this.world = new World(this);
    this.cam = new GameCamera(this);
    this.wanted = new Wanted(this);
    this.player = new Player(this);
    this.ui = new Hud(this);
    this.missions = new Missions(this);
    this.missions.register(STORY, SPEAKERS);
    this.net = new Online(this);
    this.menu = new Menu(this);
    setupWorldSpots(this);
    if (this.input.touch || 'ontouchstart' in window || navigator.maxTouchPoints > 0) { if (matchMedia('(pointer: coarse)').matches || this.q.has('touch')) this.ui.buildTouch(); }
    this.bus.on('ko', (victim, from) => { if (victim === this.player.actor) this.onPlayerDown(from); });
    this.bus.on('wreck', (v) => { if (v === this.player.vehicle) this.ui.notify('הרכב גמור. צא ממנו.', 'bad'); this.fx.puff(v.pos.x, v.pos.y + 1, v.pos.z); });
    this.bus.on('wanted', (lvl, before) => { if (lvl > before && lvl === 1) this.ui.notify('המשטרה מחפשת אותך. תיעלם להם מהעיניים.', 'cop'); });
    this.bus.on('crash', (v, imp) => { if (v === this.player.vehicle && imp > 4) { this.cam.shake(clamp(imp / 20, 0.1, 0.7)); this.input.vibrate(60); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.playing && !this.paused && !this.net.active) this.menu.pause(); });
    prog(1);
    // menu backdrop: the block at golden hour
    const h = POI.home || { x: -130, z: 0 };
    this.player.actor.place(h.x, h.z + 1, 0);
    this.sky.setHour(17.4); this.sky.paused = true;
    this.menuCam = { a: 0.6 };
    this._last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    await new Promise((r) => setTimeout(r, 350));
    document.getElementById('boot').classList.add('out');
    setTimeout(() => { const b = document.getElementById('boot'); if (b) b.remove(); }, 800);
    this.menu.main();
    window.__game = this;
    if (this.q.has('play')) this.newGame(this.q.get('play'));
  }

  hasSave() { return !!this.readJSON(SAVE_KEY); }
  save() {
    if (this.mode !== 'story') return;
    this.writeJSON(SAVE_KEY, { v: 1, player: this.player.save(), hour: this.sky.hour, day: this.sky.day, story: this.missions.save(), at: Date.now() });
  }
  saveSettings() {
    this.writeJSON(SET_KEY, this.settings);
    this.input.sens = this.settings.sens; this.input.invertY = this.settings.invertY;
    Object.assign(this.audio.vol, { master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx }); this.audio.applyVolume();
  }
  applyQuality(name) {
    this.settings.quality = name; this.saveSettings();
    const q = name === 'auto' ? Gfx.autoQuality() : name;
    this.gfx.setQuality(q); this.sky.applyQuality(); this.lampLights.setCount(this.gfx.q.lamps);
  }

  fade(on) { document.getElementById('fade').classList.toggle('on', on); }
  startCutscene() { this.cutscene = true; this.input.enabled = false; this.ui.cinema(true); this.ui.prompt('', ''); }
  endCutscene(force) { if (!this.cutscene && !force) return; this.cutscene = false; this.input.enabled = true; this.cam.setShot(null); this.ui.cinema(false); }

  // ---- modes --------------------------------------------------------------------------
  resetWorld() {
    this.world.clearAll(); this.wanted.clear(true); this.wanted.hide();
    if (this.player.vehicle) this.player.leaveVehicle(true);
    this.player.actor.revive(1); this.player.control = true;
    this.sky.paused = false;
  }
  async newGame(skipTo) {
    this.fade(true); await new Promise((r) => setTimeout(r, 450));
    this.resetWorld(); this.mode = 'story';
    this.missions.load(null); this.player.money = 40; this.player.stats = { kos: 0, cars: 0, dist: 0, busted: 0, wasted: 0, earned: 0 };
    const s = POI.busArrive; this.player.actor.place(s.x, s.z, 0); this.cam.snap(Math.PI);
    this.sky.setHour(16.6); this.sky.day = 0;
    if (skipTo && skipTo !== '1') { for (const m of STORY) { if (m.id === skipTo) break; this.missions.done.add(m.id); } const h = POI.home; this.player.actor.place(h.x, h.z + 2, 0); this.player.money = 2500; }
    this.enterPlay();
    this.missions.refreshStarts();
    this.fade(false);
    if (!skipTo) { const first = this.missions.next(); if (first) this.missions.start(first); }
  }
  async continueGame() {
    const s = this.readJSON(SAVE_KEY); if (!s) return this.newGame();
    this.fade(true); await new Promise((r) => setTimeout(r, 450));
    this.resetWorld(); this.mode = 'story';
    this.missions.load(s.story); this.player.load(s.player); this.sky.setHour(s.hour || 12); this.sky.day = s.day || 0;
    const h = POI.home; this.player.actor.place(h.x, h.z + 2, 0); this.cam.snap(Math.PI);
    this.enterPlay(); this.missions.refreshStarts(); this.fade(false);
  }
  enterPlay() {
    this.playing = true; this.paused = false; this.menu.close(); this.ui.show(true);
    this.input.wantLock = !this.input.touch; this.audio.music(null);
    this.ui.zoneName = '';
  }
  toMenu() {
    if (this.missions.active) this.missions.fail('quit');
    this.net.leave();
    this.playing = false; this.paused = false; this.mode = 'menu'; this.ui.show(false); this.ui.objective('');
    this.resetWorld(); this.missions.refreshStarts();
    const h = POI.home; this.player.actor.place(h.x, h.z + 1, 0); this.sky.setHour(17.4); this.sky.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.wantLock = false; this.audio.stopRadio();
    this.menu.main();
  }

  // ---- being knocked out ----------------------------------------------------------------
  async onPlayerDown(from) {
    if (this._down) return; this._down = true;
    const g = this, pl = this.player;
    const copNear = this.world.actors.some((a) => a.faction === 'cop' && !a.ko && dist2(a.pos.x, a.pos.z, pl.pos.x, pl.pos.z) < 16 * 16);
    const busted = this.wanted.level > 0 && (copNear || (from && from.faction === 'cop'));
    if (this.missions.active && this.mode !== 'online') this.missions.fail(busted ? 'נעצרת' : 'איבדת את ההכרה');
    this.input.enabled = false;
    await new Promise((r) => setTimeout(r, 1400));
    this.fade(true);
    await this.ui.banner(busted ? 'busted' : 'bad', busted ? 'נעצרת' : 'התעלפת', busted ? 'ערבות, עורך דין, וטופס אחד שאף אחד לא מוצא.' : 'התעוררת בבית. אמא לא שואלת שאלות. היא רק מסתכלת.', { hold: 2800 });
    const fee = Math.min(busted ? 1500 : 600, Math.round(pl.money * (busted ? 0.12 : 0.06)));
    if (fee > 0) pl.addMoney(-fee, 'fee');
    if (busted) pl.stats.busted++; else pl.stats.wasted++;
    this.wanted.clear(true);
    if (pl.vehicle) pl.leaveVehicle(true);
    const p = this.mode === 'online' ? { x: POI.plaza.x, z: POI.plaza.z + 3 } : busted ? POI.police : POI.home;
    pl.actor.revive(busted ? 0.7 : 0.6); pl.actor.place(p.x, p.z + 1.5, 0); this.cam.snap(Math.PI);
    this.sky.setHour((this.sky.hour + 5) % 24);
    this.input.enabled = true; this._down = false;
    this.fade(false);
    this.save();
  }

  onPavedAt(x, z) { return inCity(x, z) || !!onRoad(x, z); }
  underCover(x, z) { return this.physics.raycast(x, 2.2, z, 0, 1, 0, 30) < 29; }

  // ---- interaction spots ---------------------------------------------------------------
  addSpot(s) { this.spots.push(s); return s; }
  removeSpot(s) { const i = this.spots.indexOf(s); if (i >= 0) this.spots.splice(i, 1); }
  updateSpots() {
    const pl = this.player, inp = this.input;
    let best = null, bd = 1e9;
    if (!this.cutscene && pl.actor.alive) for (const s of this.spots) {
      if (s.cond && !s.cond()) continue;
      const p = typeof s.pos === 'function' ? s.pos() : s.pos; if (!p) continue;
      const d2 = dist2(p.x, p.z, pl.pos.x, pl.pos.z), r = s.r || 2.2;
      if (d2 < r * r && d2 < bd && (!pl.vehicle || s.vehicle)) { bd = d2; best = s; }
    }
    if (best) {
      this.ui.prompt(inp.lastDevice === 'pad' ? 'A' : inp.touch ? '●' : 'E', typeof best.text === 'function' ? best.text() : best.text);
      if (inp.pressed.interact || (inp.lastDevice === 'pad' && inp.pressed.jump)) { this.audio.click(); best.action(); }
      return;
    }
    // otherwise: the car door
    if (!pl.vehicle && !this.cutscene && pl.actor.alive) {
      const a = pl.actor; let near = null;
      for (const v of this.world.vehicles) { if (v.wreck) continue; const dx = a.pos.x - v.pos.x, dz = a.pos.z - v.pos.z; const f = dx * v.fx + dz * v.fz, s = -dx * v.fz + dz * v.fx; if (Math.hypot(Math.max(0, Math.abs(f) - v.len / 2), Math.max(0, Math.abs(s) - v.wid / 2)) < 2.4) { near = v; break; } }
      if (near) { this.ui.prompt(inp.lastDevice === 'pad' ? 'Y' : inp.touch ? 'רכב' : 'F', (near.driver ? 'קח את ה' : 'היכנס ל') + near.def.name); return; }
    } else if (pl.vehicle && pl.vehicle.wreck) { this.ui.prompt(inp.touch ? 'רכב' : 'F', 'צא מהרכב'); return; }
    if (!this.missions.active || !this.ui.promptKey.startsWith('!')) this.ui.prompt('', '');
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this._last) / 1000; this._last = now;
    if (dt > 1) dt = 0.016;                       // the tab was away
    dt = Math.min(dt, 0.2);
    this._fps += (1 / Math.max(dt, 1e-3) - this._fps) * 0.05;
    this.input.poll(dt);
    this.menu.tick(dt);
    if (this.playing) {
      if (this.input.pressed.pause && !this.cutscene) { if (this.paused) this.menu.resume(); else this.menu.pause(); }
      else if (this.input.pressed.map && !this.paused && !this.cutscene) this.menu.pause('map');
      else if (this.input.pressed.phone && !this.paused && !this.cutscene) this.menu.phone();
    }
    if (this.playing && !this.paused) {
      // the simulation advances in steps of at most 1/30 s so slow frames stay stable
      const sim = dt * this.timeScale, steps = Math.min(this.timeScale > 1 ? 60 : 6, Math.max(1, Math.ceil(sim * 30))), h = sim / steps;
      for (let i = 0; i < steps; i++) {
        this.time += h;
        this.player.update(h);
        this.world.update(h);
        this.wanted.update(h);
        this.missions.update(h);
        this.net.update(h);
        if (i === 0) { this.updateSpots(); const p = this.input.pressed; for (const k in p) p[k] = false; }
      }
      this.cam.update(dt);
      this.fx.update(dt);
      this.ui.update(dt);
      this.sky.update(dt, this.gfx.camera.position);
    } else if (!this.playing) {
      // slow orbit around the block behind the menu
      this.time += dt;
      this.menuCam.a += dt * 0.03;
      const h = POI.home || { x: -130, z: 0 }, c = this.gfx.camera;
      c.position.set(h.x + Math.sin(this.menuCam.a) * 46, 13 + Math.sin(this.menuCam.a * 0.7) * 3, h.z + 24 + Math.cos(this.menuCam.a) * 30);
      c.lookAt(h.x, 6, h.z - 6);
      this.world.update(dt); this.fx.update(dt);
      this.sky.update(dt, c.position);
    } else { this.ui.update(0); }
    this.mats.setNight(this.sky.night);
    this.lampLights.update(dt, this.playing ? this.player.pos : this.gfx.camera.position, this.sky.night);
    this.audio.update(dt);
    this.gfx.render(dt);
    this.input.endFrame();
    if (this.settings.fps || this.dev) this.menu.debug(this._fps);
  }
}
