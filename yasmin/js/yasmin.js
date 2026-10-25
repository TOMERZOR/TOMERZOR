// Yasmin: the rigged model with her mop and bucket, and the hunter AI.
// States: idle, patrol, investigate, chase, search, locker (pulling you out), scripted, gone.
import * as THREE from 'three';
import { CELL, W, toCell, cellCenter, findPath, walkable, lineOfSight, opaque, cellsOf, roomAt, isOutdoor } from './map.js';
import { collide } from './world.js';

const tmp = new THREE.Vector3();

export class Yasmin {
  constructor(scene, gltf, world, audio, tex) {
    this.world = world; this.audio = audio;
    this.group = new THREE.Group();
    this.model = gltf.scene;
    this.group.add(this.model);
    scene.add(this.group);
    this.model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const m = o.material;
        m.roughness = 0.75; m.metalness = 0; m.envMapIntensity = 0.4;
        // slightly sickly, wet look
        m.color = new THREE.Color(0.86, 0.88, 0.84);
      }
      if (o.isBone) this.bones = this.bones || {}, this.bones[o.name] = o;
    });
    // strip root motion so the AI drives position
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const c = clip.clone();
      const hips = c.tracks.find(t => t.name.endsWith('Hips.position'));
      if (hips) { const v = hips.values; const x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }
      this.actions[c.name] = this.mixer.clipAction(c);
    }
    this.cur = null;
    this.play('idle', 0);
    this.mixer.update(0.01);
    this.model.updateMatrixWorld(true);
    // stand on the floor: put the lowest toe at ground level
    const toe = this.bones.LeftToeBase || this.bones.LeftFoot;
    if (toe) { toe.getWorldPosition(tmp); this.model.position.y = -tmp.y + 0.04; }
    this.attachProps(tex);
    // eye-shine: barely visible until the flashlight hits her in the dark
    this.eyes = [];
    if (this.bones.Head) {
      const sm = new THREE.SpriteMaterial({ color: 0xffd8a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const s of [-1, 1]) {
        const e = new THREE.Sprite(sm); e.scale.setScalar(4.5);
        e.position.set(s * 3.3, 9.5, 9); this.bones.Head.add(e); this.eyes.push(e);
      }
      this.eyeMat = sm;
    }
    this.position = this.group.position;
    this.dir = 0;            // facing yaw
    this.state = 'gone';
    this.visible = false; this.group.visible = false;
    this.path = null; this.pathT = 0; this.wp = 0;
    this.speed = 0; this.walkSpeed = 1.3; this.runSpeed = 3.9;
    this.awareness = 0;
    this.lastSeen = new THREE.Vector3();
    this.lostT = 0; this.searchT = 0; this.stateT = 0;
    this.voiceCd = 6; this.humCd = 10;
    this.stepAcc = 0;
    this.footprints = []; this.lastPrint = new THREE.Vector3(); this.printSide = 1;
    this.patrolCells = cellsOf('.+abdkocsegmi');
    this.night = 1; this.aggro = 0.5;
    this.group.userData = this.group.userData || {};
    this.bucketLoop = null;
    this.onCaught = null; this.onSpot = null; this.onLost = null;
    this.sawHide = null;
    this.canWalk = (x, z) => walkable(x, z) && !this.world.blockedAI.has(z * W + x);
  }

  attachProps(tex) {
    const M = this.world.M;
    // mop: wooden handle with a wet string head
    const mop = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.45, 8), M.wood);
    stick.position.y = -0.35; mop.add(stick);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x6e665a, roughness: 0.6 });
    const head = new THREE.Group(); head.position.y = -1.08; mop.add(head);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, r = 0.03 + (i % 3) * 0.02;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.32, 4), headMat);
      s.position.set(Math.cos(a) * r, -0.13, Math.sin(a) * r); s.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
      head.add(s);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), M.darkMetal); head.add(cap);
    mop.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // small yellow bucket with a wire handle
    const bucket = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8b21c, roughness: 0.45, side: THREE.DoubleSide }));
    body.position.y = -0.3; bucket.add(body);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), body.material); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.44; bucket.add(bottom);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), new THREE.MeshStandardMaterial({ color: 0x3a120c, roughness: 0.05, metalness: 0.2 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.21; bucket.add(water);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 4, 20, Math.PI), M.chrome); handle.position.y = -0.16; bucket.add(handle);
    bucket.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const s = 100; // bones live under an armature scaled by 0.01
    if (this.bones.RightHand) {
      mop.scale.setScalar(s); mop.rotation.set(Math.PI + 0.15, 0, 0.1); mop.position.set(0, 7, 2);
      this.bones.RightHand.add(mop);
    }
    if (this.bones.LeftHand) {
      bucket.scale.setScalar(s); bucket.rotation.set(Math.PI, 0, 0); bucket.position.set(0, 9, 0);
      this.bones.LeftHand.add(bucket);
    }
    this.mop = mop; this.bucket = bucket;
  }

  play(name, fade = 0.35, speed = 1) {
    const a = this.actions[name];
    if (!a) return;
    a.timeScale = speed;
    if (this.cur === a) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (name === 'scream') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    if (this.cur) this.cur.fadeOut(fade);
    this.cur = a; this.curName = name;
  }

  setNight(n) {
    this.night = n;
    this.walkSpeed = [0, 1.2, 1.3, 1.4, 1.5, 1.7][n];
    this.runSpeed = [0, 3.6, 3.9, 4.1, 4.35, 4.7][n];
    this.aggro = [0, 0.35, 0.5, 0.65, 0.8, 1][n];
    this.group.userData.aggro = this.aggro;
  }

  spawn(x, z, state = 'patrol', dir = 0) {
    this.position.set(x, 0, z);
    this.dir = dir; this.group.rotation.y = dir;
    this.visible = true; this.group.visible = true;
    this.setState(state);
    this.awareness = 0;
    this.path = null;
  }
  hide() {
    this.visible = false; this.group.visible = false; this.state = 'gone';
    if (this.bucketLoop) { this.bucketLoop.stop(0.2); this.bucketLoop = null; }
  }

  setState(s) {
    this.state = s; this.stateT = 0;
    if (s === 'chase') { this.play('run', 0.25); }
    else if (s === 'patrol' || s === 'investigate' || s === 'search' || s === 'locker') this.play('walk', 0.4);
    else if (s === 'idle' || s === 'scripted') this.play('idle', 0.4);
  }

  goTo(x, z) {
    const sx = toCell(this.position.x), sz = toCell(this.position.z);
    let tx = toCell(x), tz = toCell(z);
    if (!this.canWalk(tx, tz)) {
      // nearest walkable cell
      let best = null, bd = 1e9;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (this.canWalk(tx + dx, tz + dz)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [tx + dx, tz + dz]; } }
      if (!best) return false;
      [tx, tz] = best;
    }
    const p = findPath(sx, sz, tx, tz, (cx, cz) => this.canWalk(cx, cz) || (cx === sx && cz === sz));
    if (!p) return false;
    this.path = p.map(([cx, cz]) => cellCenter(cx, cz));
    // last point: the exact target if it's in the target cell
    if (toCell(x) === tx && toCell(z) === tz) this.path[this.path.length - 1] = { x, z };
    this.wp = Math.min(1, this.path.length - 1);
    return true;
  }

  // Can she see the player right now?
  sees(player) {
    if (player.hidden) return 0;
    const pp = player.pos;
    const dx = pp.x - this.position.x, dz = pp.z - this.position.z;
    const d = Math.hypot(dx, dz);
    let range = 7.5;
    if (player.lightOn) range = 22;
    else if (this.litAt(pp.x, pp.z)) range = 16;
    if (isOutdoor(roomAt(pp.x, pp.z))) range = Math.max(range, 18);
    range *= 1 - player.crouch * 0.35;
    if (d > range) return 0;
    const fx = Math.sin(this.dir), fz = Math.cos(this.dir);
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (d > 2.2 && dot < 0.35) return 0;
    if (!lineOfSight(this.position.x, this.position.z, pp.x, pp.z, opaque)) return 0;
    return 1 - d / range * 0.7;
  }
  litAt(x, z) {
    for (const l of this.world.pool) if (l.intensity > 2 && Math.hypot(l.position.x - x, l.position.z - z) < 3.5) return true;
    return false;
  }

  speak(name, opts = {}) {
    if (this.voiceCd > 0 && !opts.force) return;
    this.voiceCd = opts.cd ?? 7;
    if (this.voice) this.voice.stop(0.1);
    tmp.set(this.position.x, 1.6, this.position.z);
    this.voice = this.audio.play(name, { pos: tmp.clone(), volume: opts.volume ?? 1.3, verb: 0.45, ref: 3 });
  }

  update(dt, t, player, game) {
    this.voiceCd -= dt; this.humCd -= dt;
    this.stateT += dt;
    if (!this.visible) { this.mixer.update(dt); return; }
    const pp = player.pos;
    const dist = Math.hypot(pp.x - this.position.x, pp.z - this.position.z);
    const see = this.state === 'scripted' ? 0 : this.sees(player);
    let move = 0;

    switch (this.state) {
      case 'patrol': {
        move = this.walkSpeed;
        if (!this.path || this.wp >= this.path.length) {
          // director: drift toward the player when she has been far away
          let target;
          if (dist > 18 && Math.random() < 0.35 + this.aggro * 0.4) {
            const near = this.patrolCells.filter(([x, z]) => { const c = cellCenter(x, z); const d = Math.hypot(c.x - pp.x, c.z - pp.z); return d > 6 && d < 14; });
            target = near[Math.floor(Math.random() * near.length)];
          }
          if (!target) target = this.patrolCells[Math.floor(Math.random() * this.patrolCells.length)];
          const c = cellCenter(target[0], target[1]);
          if (!this.goTo(c.x, c.z)) this.path = null;
          if (Math.random() < 0.3) { this.setState('idle'); this.idleFor = 2 + Math.random() * 3; }
        }
        if (this.humCd < 0 && Math.random() < 0.01) { this.humCd = 25; this.speak(Math.random() < 0.5 ? 'y_hum' : Math.random() < 0.5 ? 'y_misdar' : 'y_where', { cd: 9 }); }
        this.hear(player);
        break;
      }
      case 'idle': {
        if (this.stateT > (this.idleFor || 2)) this.setState('patrol');
        this.dir += Math.sin(t * 0.7) * dt * 0.6;
        this.hear(player);
        break;
      }
      case 'investigate': {
        move = this.walkSpeed * 1.35;
        if (!this.path || this.wp >= this.path.length) {
          if (this.stateT > 1) { this.setState('search'); this.searchT = 4 + this.aggro * 4; }
        }
        this.hear(player);
        break;
      }
      case 'search': {
        move = this.walkSpeed;
        this.searchT -= dt;
        if (!this.path || this.wp >= this.path.length) {
          // sniff around the last known position, check nearby lockers
          const L = this.world.lockers.find(l => Math.hypot(l.x - this.lastSeen.x, l.z - this.lastSeen.z) < 4 && Math.random() < 0.3);
          if (L && player.hidden === L && Math.random() < 0.25 + this.aggro * 0.3) { this.checkLocker(L); break; }
          const a = Math.random() * 6.28, r = 2 + Math.random() * 5;
          this.goTo(this.lastSeen.x + Math.cos(a) * r, this.lastSeen.z + Math.sin(a) * r);
        }
        if (this.searchT < 0) { this.setState('patrol'); this.path = null; if (Math.random() < 0.6) this.speak('y_lost'); game && game.onLostPlayer && game.onLostPlayer(); }
        this.hear(player);
        break;
      }
      case 'chase': {
        move = this.runSpeed * (this.night === 5 && game && game.finale ? 1.05 : 1);
        if (see > 0) { this.lastSeen.set(pp.x, 0, pp.z); this.lostT = 0; }
        else this.lostT += dt;
        if (player.hidden) {
          if (this.sawHide === player.hidden) { this.checkLocker(player.hidden); break; }
          if (this.lostT < 0.4) this.lostT = 0.4;
        }
        this.pathT -= dt;
        if (this.pathT < 0) {
          this.pathT = 0.25;
          const tgt = this.lostT < 0.6 || (game && game.finale) ? pp : this.lastSeen;
          this.goTo(tgt.x, tgt.z);
        }
        // direct run when in sight and close
        if (see > 0 && dist < 6) this.path = [{ x: pp.x, z: pp.z }], this.wp = 0;
        if (dist < 1.05 && see > 0) { this.catch(player, game); return; }
        const giveUp = (game && game.finale) ? 99 : 3.2 + this.aggro * 2.5;
        if (this.lostT > giveUp) { this.setState('search'); this.searchT = 6 + this.aggro * 6; this.path = null; this.goTo(this.lastSeen.x, this.lastSeen.z); }
        if (this.voiceCd < 0 && Math.random() < 0.02) this.speak('y_chase', { cd: 8 });
        break;
      }
      case 'locker': {
        move = this.walkSpeed * 1.6;
        const L = this.lockerTarget;
        const dx = L.x + L.fwd.x * 0.75 - this.position.x, dz = L.z + L.fwd.z * 0.75 - this.position.z;
        if (Math.hypot(dx, dz) < 0.45) {
          move = 0;
          this.dir = Math.atan2(-L.fwd.x, -L.fwd.z);
          if (!this.lockerBeat) { this.lockerBeat = 1; this.speak('y_locker', { force: true, cd: 10 }); this.play('idle', 0.3); }
          if (this.stateT > 2.8) {
            if (player.hidden === L) { L.target = 1; this.audio.play('sfx_locker', { pos: new THREE.Vector3(L.x, 1, L.z), volume: 1.2 }); this.catch(player, game, true); return; }
            this.setState('patrol'); this.path = null;
          }
        }
        break;
      }
      case 'scripted': {
        if (this.script) this.script(dt, t);
        move = this.scriptMove || 0;
        break;
      }
    }

    // noticing the player
    if (['patrol', 'idle', 'investigate', 'search'].includes(this.state)) {
      if (see > 0) {
        this.awareness += dt * (0.8 + see * 3.5) * (0.7 + this.aggro * 0.6);
        // turn toward
        if (this.awareness > 0.4) this.faceTo(pp.x, pp.z, dt * 3);
        if (this.awareness >= 1) this.startChase(player, game);
      } else this.awareness = Math.max(0, this.awareness - dt * 0.25);
    }
    if (this.state === 'chase' && player.hidden && see === 0 && this.lostT < 0.3 && this.sawHide == null) {
      // she was looking when the locker closed
      if (this.lastSeenHide) this.sawHide = player.hidden;
    }

    // movement along the path
    this.speed += (move - this.speed) * Math.min(1, dt * 4);
    if (this.path && this.wp < this.path.length && this.speed > 0.05) {
      // skip ahead to the furthest waypoint in a straight line
      while (this.wp + 1 < this.path.length && lineOfSight(this.position.x, this.position.z, this.path[this.wp + 1].x, this.path[this.wp + 1].z, (x, z) => !this.canWalk(x, z))) this.wp++;
      const w = this.path[this.wp];
      const dx = w.x - this.position.x, dz = w.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) this.wp++;
      else {
        this.faceTo(w.x, w.z, dt * (this.state === 'chase' ? 9 : 4));
        const step = Math.min(d, this.speed * dt);
        // move toward facing (slightly) and waypoint (mostly)
        this.position.x += dx / d * step; this.position.z += dz / d * step;
        collide(this.world, this.position, 0.26);
      }
    }
    this.group.rotation.y = this.dir;
    // animation speed follows movement
    if (this.curName === 'walk') this.cur.timeScale = Math.max(0.3, this.speed / 1.25);
    if (this.curName === 'run') this.cur.timeScale = Math.max(0.5, this.speed / 4.0);
    if (this.speed < 0.2 && (this.curName === 'walk' || this.curName === 'run') && this.state !== 'chase') this.play('idle', 0.4);
    if (this.speed > 0.4 && this.curName === 'idle' && this.state !== 'scripted') this.play(this.state === 'chase' ? 'run' : 'walk', 0.3);
    this.mixer.update(dt);

    // footsteps, the squeaky bucket, wet prints
    if (this.speed > 0.3) {
      this.stepAcc += dt * (this.state === 'chase' ? 2.9 : 1.7) * Math.min(1.3, this.speed / (this.state === 'chase' ? 4 : 1.3));
      if (this.stepAcc > 1) {
        this.stepAcc -= 1;
        this.audio.step({ run: this.state === 'chase', heavy: true, pos: new THREE.Vector3(this.position.x, 0.1, this.position.z), outdoor: isOutdoor(roomAt(this.position.x, this.position.z)), wet: true, vol: 1.3 });
        this.dropPrint();
      }
    }
    const wantBucket = this.speed > 0.3 && this.state !== 'chase';
    if (wantBucket && !this.bucketLoop) this.bucketLoop = this.audio.play('sfx_bucket', { pos: this.position.clone().setY(0.5), loop: true, volume: 0.9, verb: 0.3, ref: 2.5 });
    if (!wantBucket && this.bucketLoop) { this.bucketLoop.stop(0.3); this.bucketLoop = null; }
    if (this.bucketLoop && this.bucketLoop.panner) this.audio.setPos(this.bucketLoop.panner, tmp.set(this.position.x, 0.5, this.position.z));
    if (this.voice && this.voice.panner) this.audio.setPos(this.voice.panner, tmp.set(this.position.x, 1.6, this.position.z));
    // eye-shine when lit by the flashlight in the dark
    if (this.eyeMat) {
      let k = 0;
      if (player.lightOn && dist < 16) {
        const f = player.flashDir;
        tmp.set(this.position.x - player.cam.position.x, 1.55 - player.cam.position.y, this.position.z - player.cam.position.z).normalize();
        const dot = tmp.dot(f);
        if (dot > 0.9 && !this.litAt(this.position.x, this.position.z)) k = (dot - 0.9) * 10 * 0.8;
      }
      this.eyeMat.opacity += (k - this.eyeMat.opacity) * Math.min(1, dt * 8);
    }
    // footprints dry out
    for (const fp of this.footprints) { fp.age += dt; fp.mesh.material.opacity = Math.max(0, 0.85 - fp.age / 40); }
  }

  faceTo(x, z, k) {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    let d = target - this.dir; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.dir += d * Math.min(1, k);
  }

  hear(player) {
    if (player.noise < 0.5 || player.hidden) return;
    const d = Math.hypot(player.pos.x - this.position.x, player.pos.z - this.position.z);
    const los = lineOfSight(this.position.x, this.position.z, player.pos.x, player.pos.z, opaque);
    const eff = d * (los ? 1 : 1.6);
    if (eff < player.noise * (0.8 + this.aggro * 0.5)) {
      this.lastSeen.set(player.pos.x + (Math.random() - 0.5) * 3, 0, player.pos.z + (Math.random() - 0.5) * 3);
      if (this.state !== 'investigate' || this.stateT > 1.5) {
        this.setState('investigate');
        this.goTo(this.lastSeen.x, this.lastSeen.z);
        if (Math.random() < 0.5) this.speak('y_hear', { cd: 10 });
      }
    }
  }
  noiseAt(x, z, loud) { // doors, lockers, items — heard if close enough
    if (!this.visible || ['chase', 'scripted', 'locker'].includes(this.state)) return;
    const d = Math.hypot(x - this.position.x, z - this.position.z);
    if (d < loud) { this.lastSeen.set(x, 0, z); this.setState('investigate'); this.goTo(x, z); }
  }

  startChase(player, game) {
    if (this.state === 'chase') return;
    this.setState('chase');
    this.awareness = 1; this.lostT = 0; this.sawHide = null;
    this.lastSeen.set(player.pos.x, 0, player.pos.z);
    this.speak(Math.random() < 0.6 ? 'y_spot' : 'y_chase', { force: true, cd: 6 });
    if (this.onSpot) this.onSpot();
  }
  checkLocker(L) {
    this.lockerTarget = L; this.lockerBeat = 0;
    this.setState('locker');
    this.goTo(L.x + L.fwd.x * 0.75, L.z + L.fwd.z * 0.75);
  }
  catch(player, game, fromLocker = false) {
    this.state = 'caught';
    if (this.bucketLoop) { this.bucketLoop.stop(0.1); this.bucketLoop = null; }
    if (this.onCaught) this.onCaught(fromLocker);
  }

  dropPrint() {
    if (this.position.distanceTo(this.lastPrint) < 0.6) return;
    if (isOutdoor(roomAt(this.position.x, this.position.z))) return;
    this.lastPrint.copy(this.position);
    this.printSide = -this.printSide;
    const side = this.printSide * 0.12;
    const x = this.position.x + Math.cos(this.dir) * side, z = this.position.z - Math.sin(this.dir) * side;
    let fp = this.footprints.length >= 70 ? this.footprints.shift() : null;
    if (!fp) {
      const m = this.world.decal(this.printTex, x, z, 0.16, 0.32, 0, 0.005, 0.85);
      fp = { mesh: m, age: 0 };
    }
    fp.mesh.position.set(x, 0.005 + Math.random() * 0.001, z);
    fp.mesh.rotation.z = this.dir;
    fp.age = 0;
    this.footprints.push(fp);
  }
}
