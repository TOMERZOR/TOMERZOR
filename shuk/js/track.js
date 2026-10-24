// Obstacles, coins and power-ups along the street: generation, movement, collisions.
//
// Positions along the street are absolute distances `d` (meters from the start).
// World z of anything = -(d - runD): the player stays at z = 0 and the world scrolls.
import * as THREE from 'three';
import { LANE_X, NPC_TYPES, CHARACTERS, PEDESTRIAN_SAY, SPEED, PLAYER_BOX } from './config.js';
import * as P from './props.js';
import { bubbleTexture } from './textures.js';
import { zoneAt } from './world.js';

const AHEAD = 170;
const BEHIND = 16;
const COIN_CAP = 420;

const PROPS = {
  crates:   { kind: 'low', w: 2.0, front: 0.42, back: 0.42, h: 0.88, make: P.makeCrates },
  melons:   { kind: 'low', w: 1.85, front: 0.6, back: 0.6, h: 0.95, make: P.makeMelons },
  sacks:    { kind: 'low', w: 1.9, front: 0.36, back: 0.36, h: 0.85, make: P.makeSacks },
  barrier:  { kind: 'low', w: 1.95, front: 0.2, back: 0.2, h: 0.97, make: P.makeBarrier },
  tefillin: { kind: 'low', w: 1.55, front: 0.4, back: 0.4, h: 0.98, make: P.makeTefillinTable },
  banner:   { kind: 'high', w: 2.3, front: 0.2, back: 0.2, y0: 1.12, h: 1.65, make: () => P.makeBanner(2.3) },
  rugs:     { kind: 'high', w: 2.3, front: 0.2, back: 0.2, y0: 1.15, h: 1.6, make: P.makeRugs },
  bannerWide: { kind: 'high', w: 7.4, front: 0.2, back: 0.2, y0: 1.12, h: 1.65, make: () => P.makeBanner(7.3) },
  truck:    { kind: 'platform', w: 2.15, front: 4.25, back: 6.15, h: 2.35, make: () => P.makeTruck(false) },
  truckR:   { kind: 'platform', w: 2.15, front: 4.25, back: 6.15, h: 2.35, ramp: 4.2, make: () => P.makeTruck(true) },
  van:      { kind: 'wall', w: 2.0, front: 2.55, back: 2.5, h: 2.6, make: P.makeVan, speed: 2.2 },
};
const LOWS = ['crates', 'melons', 'sacks', 'barrier'];
const HIGHS = ['banner', 'rugs'];
const POWER_TYPES = [['magnet', 0.34], ['x2', 0.26], ['sneakers', 0.2], ['hamsa', 0.2]];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = THREE.MathUtils.clamp;

export function speedAt(d) {
  return SPEED.start + (SPEED.max - SPEED.start) * (1 - Math.exp(-d / SPEED.rampDist));
}

export class Track {
  constructor(scene, assets, fx) {
    this.scene = scene; this.assets = assets; this.fx = fx;
    this.items = [];
    this.pools = new Map();
    this.coinMesh = P.makeCoinMesh(COIN_CAP);
    scene.add(this.coinMesh);
    this.coins = [];
    this.coinFree = [];
    this.bubbleTex = new Map();
    this.pedChars = [];           // playable character ids with loaded models usable as pedestrians
    this.events = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
  }

  // ---------- lifecycle ----------
  reset({ tutorial = false, playerChar = 'tzabar' } = {}) {
    for (const e of this.items) this.release(e);
    this.items.length = 0;
    for (const c of this.coins) this.coinFree.push(c);
    this.coins.length = 0;
    this.coinMesh.count = 0;
    this.genD = 55;
    this.safe = 1;
    this.prevEnd = 40;
    this.reserved = [0, 0, 0];
    this.nextPowerD = rnd(220, 320);
    this.tutorial = tutorial;
    this.tutorialStep = 0;
    this.playerChar = playerChar;
    this.rowCount = 0;
    this.events.length = 0;
    if (tutorial) this.genTutorial();
  }

  // ---------- pooling ----------
  async prewarm(types) {
    for (const t of types) {
      const objs = [];
      for (let i = 0; i < 2; i++) objs.push(await this.acquire(t));
      for (const o of objs) this.recycle(t, o);
    }
  }

  acquireSync(type) {
    const pool = this.pools.get(type);
    if (pool && pool.length) return pool.pop();
    return this.create(type);
  }
  async acquire(type) { return this.acquireSync(type); }
  recycle(type, obj) {
    obj.visible = false;
    if (!this.pools.has(type)) this.pools.set(type, []);
    this.pools.get(type).push(obj);
  }

  create(type) {
    let obj, mixer = null, def;
    if (PROPS[type]) {
      obj = PROPS[type].make();
      obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
      if (type === 'van') {
        // two Breslov dancers on the roof
        const tpl = this.assets.npcs.breslov;
        obj.userData.dancers = [];
        if (tpl) for (const x of [-0.45, 0.45]) {
          const inst = this.assets.instanceNpc(tpl);
          inst.root.position.set(x, 2.08, -0.6 + (x > 0 ? -0.6 : 0.2));
          inst.root.scale.setScalar(0.92);
          const a = inst.mixer.clipAction(inst.clips.dance); a.play(); a.time = Math.random() * 5;
          obj.add(inst.root);
          obj.userData.dancers.push(inst.mixer);
        }
      }
    } else if (type.startsWith('npc:')) {
      const tpl = this.assets.npcs[type.slice(4)];
      const inst = this.assets.instanceNpc(tpl);
      obj = new THREE.Group(); obj.add(inst.root);
      mixer = inst.mixer;
      if (mixer) {
        const def0 = NPC_TYPES[type.slice(4)];
        const a = mixer.clipAction(inst.clips[def0.rig]); a.play(); a.time = Math.random() * 3;
      }
      obj.userData.body = inst.root;
    } else if (type.startsWith('ped:')) {
      const tpl = this.assets.chars[type.slice(4)];
      const inst = this.assets.instanceCharacter(tpl);
      obj = new THREE.Group(); obj.add(inst.root);
      mixer = inst.mixer;
      obj.userData.walk = mixer.clipAction(inst.clips.walk);
      obj.userData.idle = mixer.clipAction(inst.clips.idle);
      obj.userData.body = inst.root;
    } else if (type.startsWith('pow:')) {
      obj = P.makePowerup(type.slice(4));
    }
    // speech bubble sprite (shared by every use of this object)
    if (type.startsWith('npc:') || type.startsWith('ped:') || type === 'van') {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      sp.scale.set(2.3, 0.72, 1);
      sp.visible = false;
      sp.renderOrder = 8;
      obj.add(sp);
      obj.userData.bubble = sp;
    }
    obj.userData.mixer = mixer;
    obj.userData.type = type;
    this.scene.add(obj);
    return obj;
  }

  release(e) {
    if (e.obj) {
      const b = e.obj.userData.bubble;
      if (b) b.visible = false;
      this.recycle(e.type, e.obj);
    }
    e.obj = null;
  }

  bubble(text) {
    let t = this.bubbleTex.get(text);
    if (!t) { t = bubbleTexture(text); this.bubbleTex.set(text, t); }
    return t;
  }

  // ---------- spawning ----------
  add(type, lane, d, extra = {}) {
    let def;
    if (PROPS[type]) def = PROPS[type];
    else if (type.startsWith('npc:')) { const n = NPC_TYPES[type.slice(4)]; def = { kind: 'wall', w: n.w, front: n.d / 2, back: n.d / 2, h: n.h, speed: n.speed, say: n.say, bob: n.bob }; }
    else if (type.startsWith('ped:')) def = { kind: 'wall', w: 0.8, front: 0.32, back: 0.32, h: 1.8, speed: extra.speed ?? rnd(1.1, 1.6), say: PEDESTRIAN_SAY };
    else if (type.startsWith('pow:')) def = { kind: 'power', w: 1.2, front: 0.6, back: 0.6, h: 2.0 };
    if (type.startsWith('npc:') && !this.assets.npcs[type.slice(4)]) return null;
    if (type.startsWith('ped:') && !this.assets.chars[type.slice(4)]) return null;
    const obj = this.acquireSync(type);
    obj.visible = true;
    const x = lane === -1 ? 0 : LANE_X[lane];
    const e = {
      type, kind: def.kind, lane, x, d, w: def.w, front: def.front, back: def.back, y0: def.y0 || 0, h: def.h,
      ramp: def.ramp || 0, speed: extra.speed ?? def.speed ?? 0, obj, grace: 0, passed: false, hit: false, dead: false,
      phase: Math.random() * 6, bob: def.bob, sayText: null, horn: type === 'npc:scooter', power: type.startsWith('pow:') ? type.slice(4) : null,
      tutorial: extra.tutorial || 0,
    };
    // movers start further away so they reach their row when the player does
    if (e.speed > 0 && extra.meetAt !== undefined) {
      const tReach = Math.max(0, (d - extra.meetAt) / Math.max(SPEED.start, extra.playerSpeed || SPEED.start));
      e.d = d + e.speed * tReach;
      this.reserved[lane] = Math.max(this.reserved[lane], e.d + e.back + 2);
    }
    if (def.say && Math.random() < (type === 'npc:breslov' || type === 'van' ? 0.9 : 0.5)) e.sayText = pick(def.say);
    if (type === 'van') e.sayText = 'נ נח נחמ נחמן מאומן!';
    const ud = obj.userData;
    if (ud.walk) {
      const walking = e.speed > 0;
      ud.walk.enabled = walking; ud.idle.enabled = !walking;
      (walking ? ud.walk : ud.idle).play(); (walking ? ud.idle : ud.walk).stop();
    }
    if (ud.bubble) {
      ud.bubble.visible = false;
      if (e.sayText) { ud.bubble.material.map = this.bubble(e.sayText); ud.bubble.material.needsUpdate = true; }
      ud.bubble.position.set(0, (type === 'van' ? 4.6 : def.h + 0.55), 0);
    }
    if (ud.cloth) ud.cloth.rotation.x = 0;
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    this.items.push(e);
    return e;
  }

  addCoin(lane, d, y = 0.75) {
    if (this.coins.length >= COIN_CAP) return;
    const c = this.coinFree.pop() || {};
    c.x = LANE_X[lane]; c.y = y; c.d = d; c.alive = true; c.magnet = false; c.lane = lane;
    this.coins.push(c);
  }

  coinLine(lane, d0, d1, y = 0.75) {
    if (d1 - d0 < 2) return;
    for (let d = d0; d <= d1; d += 2.2) this.addCoin(lane, d, y);
  }
  coinArc(lane, center, half = 5.2, peak = 2.2, base = 0.75) {
    for (let k = -half; k <= half + 0.01; k += 1.3) {
      const t = k / half;
      this.addCoin(lane, center + k, base + (peak - base + 0.4) * (1 - t * t));
    }
  }

  laneFree(lane, d) { return d > this.reserved[lane]; }

  pickWall(D, zoneId, lane, meetAt, pSpeed) {
    const diff = this.diff;
    const options = [['npc:vendor', 1], ['npc:chabad', 0.7], ['npc:breslov', zoneId === 'night' ? 1.3 : 0.6], ['npc:grandpa', 1], ['npc:moroccan', 1],
      ['npc:jack', 0.6 + diff * 0.6], ['ped', 1.6]];
    if (D > 700) options.push(['npc:scooter', 0.35 + diff * 0.5]);
    let total = options.reduce((s, o) => s + o[1], 0), r = Math.random() * total;
    let type = 'npc:vendor';
    for (const [t, w] of options) { if ((r -= w) <= 0) { type = t; break; } }
    if (type === 'ped') {
      const peds = this.pedChars.filter(id => id !== this.playerChar);
      if (!peds.length) type = 'npc:vendor';
      else {
        const walking = Math.random() < 0.7;
        return this.add('ped:' + pick(peds), lane, D, walking ? { meetAt, playerSpeed: pSpeed } : { speed: 0 });
      }
    }
    const e = this.add(type, lane, D, { meetAt, playerSpeed: pSpeed });
    return e || this.add('npc:vendor', lane, D);
  }

  genTutorial() {
    // 1: jump  2: roll  3: go left  4: go right
    const t = [[60, 'up'], [105, 'down'], [150, 'left'], [196, 'right']];
    for (const L of [0, 1, 2]) this.add(pick(LOWS), L, t[0][0], { tutorial: 1 });
    this.coinArc(1, t[0][0]);
    this.add('bannerWide', -1, t[1][0], { tutorial: 2 });
    this.coinLine(1, t[1][0] - 4, t[1][0] + 4, 0.55);
    this.add('npc:vendor', 1, t[2][0], { tutorial: 3 });
    this.add('npc:chabad', 2, t[2][0], { tutorial: 3 });
    this.coinLine(0, t[2][0] - 10, t[2][0] + 4);
    this.add('npc:grandpa', 0, t[3][0], { speed: 0, tutorial: 4 });
    this.add('npc:moroccan', 2, t[3][0], { speed: 0, tutorial: 4 });
    this.coinLine(1, t[3][0] - 10, t[3][0] + 6);
    this.tutorialRows = t;
    this.genD = 215; this.prevEnd = 205; this.safe = 1;
  }

  spawnRow(runD, pSpeed) {
    const D0 = this.genD;
    const s = speedAt(D0);
    const diff = this.diff = clamp((D0 - 120) / 5200, 0, 1);
    const { zone } = zoneAt(D0);
    const gap = s * THREE.MathUtils.lerp(1.5, 0.85, diff) + rnd(0, 5 - diff * 2.5);
    const D = D0 + gap;
    const meetAt = runD;
    let extraLen = 2;
    // safe lane: stay or step one lane
    let safe = this.safe;
    const r0 = Math.random();
    if (r0 < 0.3) safe = clamp(safe - 1, 0, 2); else if (r0 < 0.6) safe = clamp(safe + 1, 0, 2);
    // prefer a lane not reserved by a walker
    if (!this.laneFree(safe, D) && safe !== 1 && this.laneFree(1, D)) safe = 1;

    const lanesContent = ['', '', ''];
    const roll = Math.random();
    let pattern = 'basic';
    const can = name => ({
      jumpAll: D > 300, rollAll: D > 380, trucks: D > 230 && zone.id !== 'covered', van: D > 650 && zone.id !== 'covered',
      chabad: D > 150, crowd: D > 180,
    })[name];
    const weights = [['jumpAll', 0.07 + 0.06 * diff], ['rollAll', 0.06 + 0.06 * diff], ['trucks', 0.12], ['van', 0.06], ['chabad', 0.06], ['crowd', 0.08]];
    let acc = 0;
    for (const [name, w] of weights) { acc += w; if (roll < acc) { if (can(name)) pattern = name; break; } }

    const coinsPlan = { lane: safe, mode: 'line' };

    if (pattern === 'jumpAll') {
      for (const L of [0, 1, 2]) if (this.laneFree(L, D)) { this.add(pick(LOWS), L, D); lanesContent[L] = 'low'; }
      coinsPlan.mode = 'arc';
    } else if (pattern === 'rollAll' && [0, 1, 2].every(L => this.laneFree(L, D))) {
      this.add('bannerWide', -1, D);
      lanesContent[0] = lanesContent[1] = lanesContent[2] = 'high';
      coinsPlan.mode = 'under';
    } else if (pattern === 'trucks' && [0, 1, 2].every(L => this.laneFree(L, D - 5))) {
      const def = PROPS.truck;
      const rampLane = safe;
      this.add('truckR', rampLane, D + def.front);
      lanesContent[rampLane] = 'platform';
      const others = [0, 1, 2].filter(L => L !== rampLane);
      const second = pick(others);
      const r = Math.random();
      if (r < 0.5) { this.add('truck', second, D + def.front + rnd(-1, 2)); lanesContent[second] = 'platform'; }
      else if (r < 0.75) { this.pickWall(D, zone.id, second, meetAt, pSpeed); lanesContent[second] = 'wall'; }
      const third = others.find(L => L !== second);
      if (Math.random() < 0.5 + diff * 0.3) { this.add(Math.random() < 0.5 ? 'truck' : 'truckR', third, D + def.front + rnd(0, 3)); lanesContent[third] = 'platform'; }
      coinsPlan.mode = 'roof';
      extraLen = def.front + def.back + 4;
    } else if (pattern === 'van') {
      const lanes = [0, 1, 2].filter(L => L !== safe && this.laneFree(L, D));
      if (lanes.length) {
        const L = pick(lanes);
        this.add('van', L, D, { meetAt, playerSpeed: pSpeed });
        lanesContent[L] = 'wall';
      }
      extraLen = 5;
    } else if (pattern === 'chabad') {
      const L = safe;
      const L2 = L === 1 ? pick([0, 2]) : 1;
      if (this.laneFree(L, D) && this.laneFree(L2, D)) {
        this.add('tefillin', L, D); lanesContent[L] = 'low';
        this.add('npc:chabad', L2, D + 0.2); lanesContent[L2] = 'wall';
        coinsPlan.mode = 'arc';
      }
    } else if (pattern === 'crowd') {
      const lanes = [0, 1, 2].filter(L => L !== safe && this.laneFree(L, D));
      lanes.forEach((L, i) => { this.pickWall(D + i * rnd(3, 7), zone.id, L, meetAt, pSpeed); lanesContent[L] = 'wall'; });
      extraLen = 9;
    }

    if (pattern === 'basic' || lanesContent.every(c => !c)) {
      pattern = 'basic';
      const pBlock = 0.5 + 0.38 * diff;
      for (const L of [0, 1, 2]) {
        if (!this.laneFree(L, D)) continue;
        if (L === safe) {
          if (Math.random() < 0.22 + 0.4 * diff) {
            const low = Math.random() < 0.55;
            this.add(low ? pick(LOWS) : pick(HIGHS), L, D);
            lanesContent[L] = low ? 'low' : 'high';
            coinsPlan.mode = low ? 'arc' : 'under';
          }
          continue;
        }
        if (Math.random() < pBlock) {
          const r = Math.random();
          if (r < 0.66) { this.pickWall(D + rnd(-0.5, 0.5), zone.id, L, meetAt, pSpeed); lanesContent[L] = 'wall'; }
          else if (r < 0.84) { this.add(pick(LOWS), L, D); lanesContent[L] = 'low'; }
          else { this.add(pick(HIGHS), L, D); lanesContent[L] = 'high'; }
        }
      }
      if (lanesContent.every(c => !c)) {
        const L = [0, 1, 2].find(l => l !== safe && this.laneFree(l, D));
        if (L !== undefined) { this.pickWall(D, zone.id, L, meetAt, pSpeed); lanesContent[L] = 'wall'; }
      }
    }

    // coins along the safe path
    const cl = coinsPlan.lane;
    const coinStart = Math.max(this.prevEnd + 2.5, D - rnd(14, 22));
    if (this.laneFree(cl, coinStart)) {
      if (coinsPlan.mode === 'arc') { this.coinLine(cl, coinStart, D - 6.5); this.coinArc(cl, D); }
      else if (coinsPlan.mode === 'under') { this.coinLine(cl, coinStart, D + 3, 0.55); }
      else if (coinsPlan.mode === 'roof') {
        const def = PROPS.truck;
        this.coinLine(cl, D - 4, D - 0.8, 0.0); // on the ramp (y fixed below)
        for (const c of this.coins.slice(-3)) c.y = 0.75 + PROPS.truckR.h * Math.max(0, (c.d - (D - 4.2)) / 4.2);
        this.coinLine(cl, D + 0.6, D + def.front + def.back - 0.6, def.h + 0.75);
      } else if (Math.random() < 0.8) this.coinLine(cl, coinStart, D - 3);
    }
    // power-up
    if (D > this.nextPowerD && lanesContent[safe] === '' && this.laneFree(safe, D)) {
      const total = POWER_TYPES.reduce((s, p) => s + p[1], 0);
      let r = Math.random() * total, type = 'magnet';
      for (const [t, w] of POWER_TYPES) if ((r -= w) <= 0) { type = t; break; }
      // replace the coins right at the row with the power-up
      this.coins = this.coins.filter(c => !(c.lane === safe && Math.abs(c.d - D) < 2.5) || (this.coinFree.push(c), false));
      this.add('pow:' + type, safe, D);
      this.nextPowerD = D + rnd(260, 460);
    }

    this.safe = safe;
    this.prevEnd = D + extraLen;
    this.genD = D + extraLen;
    this.rowCount++;
  }

  // ---------- queries ----------
  groundAt(x, pd, py) {
    let g = 0;
    for (const e of this.items) {
      if (e.kind !== 'platform' || e.dead) continue;
      if (Math.abs(x - e.x) > e.w / 2 + 0.12) continue;
      const d0 = e.d - e.front, d1 = e.d + e.back;
      let top = -1;
      if (pd >= d0 - 0.3 && pd <= d1 + 0.3) top = e.h;
      else if (e.ramp && pd >= d0 - e.ramp && pd < d0 - 0.3) top = e.h * (pd - (d0 - e.ramp)) / e.ramp;
      if (top >= 0 && top <= py + 0.62 && top > g) g = top;
    }
    return g;
  }

  // ---------- per-frame ----------
  // Called once per fixed physics step. Returns nothing; pushes events into this.events.
  step(dt, runD, prevRunD, player, state) {
    const px = player.x, py = player.y, ph = player.height;
    const plx = player.lastX, ply = player.lastY;
    for (const e of this.items) {
      if (e.dead) continue;
      const prevD = e.d;
      if (e.speed > 0) e.d -= e.speed * dt;
      if (e.grace > 0) { e.grace -= dt; continue; }
      if (e.kind === 'power') {
        if (Math.abs(e.d - runD) < 0.9 && Math.abs(e.x - px) < 1.0 && py < 2.2) {
          e.dead = true; e.obj.visible = false;
          this.events.push({ t: 'power', power: e.power, x: e.x, y: 1.1 });
        }
        continue;
      }
      const d0 = e.d - e.front, d1 = e.d + e.back;
      const dOver = runD + PLAYER_BOX.halfD > d0 && runD - PLAYER_BOX.halfD < d1;
      if (!dOver) {
        if (!e.passed && d1 < runD - PLAYER_BOX.halfD) {
          e.passed = true;
          if (e.kind === 'wall' && !e.hit) this.events.push({ t: 'passed', e, near: Math.abs(e.x - px) < 2.7 && player.laneChangeT < 0.55 && Math.abs(e.x - px) > 1.2 });
        }
        continue;
      }
      const top = e.y0 + e.h;
      const xOver = Math.abs(px - e.x) < e.w / 2 + PLAYER_BOX.halfW;
      const yOver = py < top && py + ph > e.y0;
      if (!(xOver && yOver)) continue;
      // which way did we come in?
      const pd0 = prevD - e.front, pd1 = prevD + e.back;
      const prevDOver = prevRunD + PLAYER_BOX.halfD > pd0 && prevRunD - PLAYER_BOX.halfD < pd1;
      const prevXOver = Math.abs(plx - e.x) < e.w / 2 + PLAYER_BOX.halfW;
      let how = 'front';
      if (prevDOver && !prevXOver) how = 'side';
      else if (prevDOver && prevXOver) how = ply >= top - 0.05 ? 'top' : 'front';
      if (e.kind === 'platform') {
        if (how === 'top' || py >= top - 0.5) { this.events.push({ t: 'climb', e, y: top }); continue; }
      }
      this.events.push({ t: 'hit', e, how });
    }
    // coins
    const magnet = state.magnet;
    for (const c of this.coins) {
      if (!c.alive) continue;
      const dd = c.d - runD;
      if (magnet && dd < 16 && dd > -1.5) c.magnet = true;
      if (c.magnet) {
        const k = 1 - Math.exp(-dt * 14);
        c.x += (px - c.x) * k;
        c.y += (py + 1.0 - c.y) * k;
        c.d += (runD + 0.2 - c.d) * k;
      }
      if (Math.abs(c.d - runD) < 0.75 && Math.abs(c.x - px) < 0.9 && c.y > py - 0.35 && c.y < py + ph + 0.45) {
        c.alive = false;
        this.events.push({ t: 'coin', x: c.x, y: c.y, magnet: c.magnet });
      }
    }
  }

  // Visual update, generation and cleanup: once per rendered frame.
  update(dt, runD, pSpeed, time, player) {
    while (this.genD < runD + AHEAD) this.spawnRow(runD, pSpeed);
    // cleanup
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      if (e.d + e.back < runD - BEHIND || (e.dead && e.kind === 'power')) {
        this.release(e);
        this.items.splice(i, 1);
      }
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (!c.alive || c.d < runD - 3) { this.coinFree.push(c); this.coins.splice(i, 1); }
    }
    // entity visuals
    for (const e of this.items) {
      const o = e.obj;
      if (!o) continue;
      const z = -(e.d - runD);
      o.position.set(e.x, 0, z);
      const ahead = e.d - runD;
      const ud = o.userData;
      if (e.kind === 'power') {
        o.position.y = 1.1 + Math.sin(time * 3 + e.phase) * 0.12;
        ud.inner.rotation.y = time * 2.2;
        ud.glow.material.opacity = 0.55 + Math.sin(time * 5) * 0.2;
        continue;
      }
      if (e.dead) {
        // knocked aside by the hamsa shield
        e.flyT = (e.flyT || 0) + dt;
        o.position.x = e.x + e.flyDir * e.flyT * 9;
        o.position.y = e.flyT * 7 - e.flyT * e.flyT * 14;
        o.rotation.z = e.flyDir * e.flyT * 8;
        if (o.position.y < -3) o.visible = false;
        continue;
      }
      if (ud.mixer && ahead < 90 && ahead > -10) ud.mixer.update(dt);
      if (ud.dancers && ahead < 90) for (const m of ud.dancers) m.update(dt);
      const body = ud.body;
      if (body && e.bob) {
        const t = time * (e.speed > 0 ? 7 : 3) + e.phase;
        if (e.bob === 'shuffle') { body.position.y = Math.abs(Math.sin(t)) * 0.04; body.rotation.z = Math.sin(t) * 0.04; }
        else if (e.bob === 'sway') { body.rotation.y = Math.sin(t * 0.7) * 0.25; body.position.y = Math.abs(Math.sin(t)) * 0.02; }
        else if (e.bob === 'shout') { body.rotation.x = Math.max(0, Math.sin(t * 1.4)) * 0.08; body.scale.y = 1 + Math.max(0, Math.sin(t * 1.4)) * 0.025; }
        else if (e.bob === 'push') { body.position.y = Math.abs(Math.sin(t)) * 0.03; }
        else if (e.bob === 'ride') { body.rotation.z = Math.sin(t * 2.3) * 0.03; body.position.y = Math.sin(t * 9) * 0.01; }
      }
      if (ud.cloth) ud.cloth.rotation.x = Math.sin(time * 2.2 + e.phase) * 0.06;
      // speech bubbles for people ahead
      const b = ud.bubble;
      if (b && e.sayText) {
        const show = ahead > 7 && ahead < 48;
        b.visible = show;
        if (show) b.material.opacity = Math.min(1, (48 - ahead) / 8, (ahead - 7) / 4);
        if (show && !e.voiced && ahead < 30) { e.voiced = true; this.events.push({ t: 'voice', type: e.type, x: e.x }); }
      }
      if (e.horn && !e.honked && ahead < 30) { e.honked = true; this.events.push({ t: 'horn' }); }
    }
    // coins (instanced)
    const m = this._m, q = this._q, eu = this._e, p = this._p, s = this._s;
    let n = 0;
    for (const c of this.coins) {
      if (!c.alive) continue;
      const z = -(c.d - runD);
      if (z < -AHEAD - 10) continue;
      eu.set(0, time * 3.2 + c.d * 0.35, 0); q.setFromEuler(eu);
      p.set(c.x, c.y + Math.sin(time * 4 + c.d) * 0.06, z);
      m.compose(p, q, s);
      this.coinMesh.setMatrixAt(n++, m);
      if (n >= COIN_CAP) break;
    }
    this.coinMesh.count = n;
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  // remove obstacles near the player (used on revive)
  clearAround(runD, ahead = 40) {
    for (const e of this.items) {
      if (e.kind === 'power') continue;
      if (e.d - e.front < runD + ahead && e.d + e.back > runD - 5) { e.dead = true; e.flyDir = e.x >= 0 ? 1 : -1; e.flyT = 0; }
    }
  }

  knockAway(e, px) {
    e.dead = true; e.flyDir = e.x > px ? 1 : e.x < px ? -1 : (Math.random() < 0.5 ? -1 : 1); e.flyT = 0;
    if (e.obj && e.obj.userData.bubble) e.obj.userData.bubble.visible = false;
  }
}
