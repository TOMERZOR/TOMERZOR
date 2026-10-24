// The runner: lane movement, jumping, rolling, platforms and the animation state machine.
import * as THREE from 'three';
import { LANE_X, PHYS, PLAYER_BOX } from './config.js';

export class Player {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.root = new THREE.Group();          // moves in x/y; z stays 0 (the world scrolls)
    this.pivot = new THREE.Group();         // lean / roll tilt
    this.root.add(this.pivot);
    scene.add(this.root);
    this.model = null; this.mixer = null; this.actions = {}; this.current = null;
    this.charId = null;
    this.loadToken = 0;
    this.mode = 'menu'; this.faceTarget = Math.PI;
    // shield bubble (hamsa)
    const sg = new THREE.SphereGeometry(1.05, 24, 16);
    this.shieldMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, op: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float t; uniform float op; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float band = 0.5 + 0.5*sin(t*4.0 + vN.y*8.0); gl_FragColor = vec4(mix(vec3(0.25,0.6,1.0), vec3(1.0), f*0.6), (f*0.85 + band*0.08) * op); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.shield = new THREE.Mesh(sg, this.shieldMat);
    this.shield.position.y = 0.9; this.shield.scale.set(0.8, 1.05, 0.8);
    this.shield.visible = false;
    this.root.add(this.shield);
    this.reset();
  }

  async setCharacter(id) {
    const token = ++this.loadToken;
    const tpl = await this.assets.character(id);
    if (token !== this.loadToken) return; // a newer request superseded this one
    if (this.model) { this.pivot.remove(this.model); this.mixer.stopAllAction(); }
    const inst = this.assets.instanceCharacter(tpl);
    this.model = inst.root;
    this.model.rotation.y = Math.PI;       // models face +z; the runner faces down the street (-z)
    this.pivot.add(this.model);
    this.mixer = inst.mixer;
    this.actions = {};
    for (const [name, clip] of Object.entries(inst.clips)) this.actions[name] = this.mixer.clipAction(clip);
    const once = ['jump', 'roll', 'knock', 'stumble'];
    for (const n of once) if (this.actions[n]) { this.actions[n].setLoop(THREE.LoopOnce, 1); this.actions[n].clampWhenFinished = true; }
    this.charId = id;
    this.current = null;
    this.play(this.mode === 'dance' ? 'dance' : this.mode === 'menu' ? 'idle' : 'run', 0);
  }

  reset() {
    this.lane = 1; this.prevLane = 1; this.x = LANE_X[1]; this.y = 0; this.vy = 0;
    this.grounded = true; this.rollT = 0; this.rollQueued = false; this.stumbleT = 0;
    this.dead = false; this.airT = 0; this.coyote = 0; this.laneChangeT = 10;
    this.groundY = 0; this.onPlatform = false; this.superJump = false;
    this.jumpVisual = false; this.leanV = 0;
    this.root.position.set(this.x, 0, 0);
    this.pivot.rotation.set(0, 0, 0);
    this.lastX = this.x; this.lastY = 0;
  }

  get height() { return this.rollT > 0 ? PLAYER_BOX.rollHeight : PLAYER_BOX.height; }

  // ---- controls ----
  move(dir) {
    if (this.dead) return false;
    const nl = this.lane + dir;
    if (nl < 0 || nl > 2) return false;
    this.prevLane = this.lane; this.lane = nl; this.laneChangeT = 0;
    this.leanV = dir;
    return true;
  }

  jump(gravity) {
    if (this.dead) return false;
    if (!this.grounded && this.coyote <= 0) return false;
    const h = this.superJump ? PHYS.superJumpHeight : PHYS.jumpHeight;
    this.vy = Math.sqrt(2 * gravity * h);
    this.grounded = false; this.coyote = 0; this.rollT = 0; this.rollQueued = false;
    this.airT = 0;
    this.jumpVisual = true;
    this.play('jump', 0.08, { from: 0.5, dur: this.vy * 2 / gravity * 0.95, endAt: 1.12 });
    return true;
  }

  roll() {
    if (this.dead) return false;
    if (!this.grounded) { this.vy = Math.min(this.vy, -PHYS.fastFall); this.rollQueued = true; return 'fall'; }
    this.rollT = PHYS.rollTime;
    this.play('roll', 0.06, { from: 0.22, dur: PHYS.rollTime, endAt: 1.62 });
    return true;
  }

  bounceBack() {
    // side hit: return to the lane we came from
    const tmp = this.lane; this.lane = this.prevLane; this.prevLane = tmp;
    this.leanV = Math.sign(LANE_X[this.lane] - this.x) || 0;
  }

  stumble() {
    this.stumbleT = 0.55;
    if (this.grounded && this.rollT <= 0) this.play('stumble', 0.06, { from: 0.05, dur: 0.55, endAt: 0.9 });
  }

  die() {
    this.dead = true; this.rollT = 0;
    this.play('knock', 0.08, { from: 0, rate: 1.15 });
  }

  revive() {
    this.dead = false; this.stumbleT = 0; this.vy = 0; this.rollT = 0;
    this.play('run', 0.15);
  }

  // ---- physics (fixed step) ----
  step(dt, gravity, groundAt) {
    if (this.dead) {
      if (!this.grounded) { this.vy -= gravity * dt; this.y = Math.max(this.groundY, this.y + this.vy * dt); if (this.y <= this.groundY) this.grounded = true; }
      return;
    }
    this.lastX = this.x; this.lastY = this.y;
    // lateral: fast ease toward the lane centre
    const tx = LANE_X[this.lane];
    const k = 1 - Math.exp(-dt / (PHYS.laneTime * 0.33));
    let nx = this.x + (tx - this.x) * k;
    if (Math.abs(tx - nx) < 0.01) nx = tx;
    this.x = nx;
    this.laneChangeT += dt;

    // vertical
    const g = groundAt(this.x);
    this.groundY = g;
    if (this.grounded) {
      if (g > this.y + 0.62) { /* wall-like rise is handled by collisions */ }
      if (g >= this.y - 0.05 && g <= this.y + 0.62) { this.y = g; this.onPlatform = g > 0.05; }
      else if (g < this.y - 0.05) { this.grounded = false; this.coyote = 0.1; this.vy = 0; this.jumpVisual = false; this.play('jump', 0.15, { from: 0.85, rate: 0.6, endAt: 1.05 }); }
    }
    if (!this.grounded) {
      this.coyote -= dt;
      this.airT += dt;
      this.vy -= gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= g && this.vy <= 0) {
        this.y = g; this.vy = 0; this.grounded = true; this.onPlatform = g > 0.05;
        this.landed = true;
        if (this.rollQueued) { this.rollQueued = false; this.rollT = PHYS.rollTime; this.play('roll', 0.05, { from: 0.4, dur: PHYS.rollTime * 0.85, endAt: 1.62 }); }
        else if (this.rollT <= 0) this.play('run', 0.12);
      }
    }
    if (this.rollT > 0) { this.rollT -= dt; if (this.rollT <= 0 && this.grounded) this.play('run', 0.12); }
    if (this.stumbleT > 0) { this.stumbleT -= dt; if (this.stumbleT <= 0 && this.grounded && this.rollT <= 0) this.play('run', 0.15); }
  }

  // ---- animation ----
  play(name, fade = 0.12, opts = {}) {
    const a = this.actions[name];
    if (!a) return;
    if (this.current === a && !opts.from && a.isRunning()) return;
    a.reset();
    a.enabled = true;
    a.setEffectiveWeight(1);
    if (opts.from !== undefined) a.time = opts.from;
    let rate = opts.rate ?? 1;
    if (opts.dur && opts.endAt) rate = (opts.endAt - (opts.from || 0)) / opts.dur;
    a.setEffectiveTimeScale(rate);
    a.play();
    if (this.current && this.current !== a) this.current.crossFadeTo(a, fade, false);
    else if (!this.current) a.fadeIn(fade);
    this.current = a;
    this.currentName = name;
    this.clipEnd = opts.endAt ?? null;
  }

  setMode(mode) {
    this.mode = mode;
    this.faceTarget = mode === 'run' ? 0 : Math.PI;
    if (mode === 'menu') this.play('idle', 0.3);
    else if (mode === 'dance') this.play('dance', 0.3);
    else if (mode === 'run') this.play('run', 0.2);
  }

  update(dt, speed, time) {
    if (this.mixer) {
      if (this.currentName === 'run') this.current.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 15, 0.95, 1.55));
      // hold the airborne pose of the jump clip while still in the air
      if (this.currentName === 'jump' && !this.grounded && this.clipEnd && this.current.time > this.clipEnd) this.current.time = this.clipEnd;
      if ((this.currentName === 'roll' || this.currentName === 'stumble') && this.clipEnd && this.current.time > this.clipEnd) this.current.time = this.clipEnd;
      this.mixer.update(dt);
    }
    this.root.position.set(this.x, this.y, 0);
    // face the camera in menus, turn around to run
    const ft = this.faceTarget ?? 0;
    this.root.rotation.y += (ft - this.root.rotation.y) * Math.min(1, dt * 7);
    // lean into lane changes, settle when centred
    const dx = LANE_X[this.lane] - this.x;
    const lean = THREE.MathUtils.clamp(-dx * 0.22, -0.3, 0.3);
    this.pivot.rotation.z += (lean - this.pivot.rotation.z) * Math.min(1, dt * 14);
    this.pivot.rotation.y += ((-dx * 0.18) - this.pivot.rotation.y) * Math.min(1, dt * 12);
    // shield
    if (this.shield.visible) { this.shieldMat.uniforms.t.value = time; this.shield.rotation.y = time; }
  }

  setShield(opacity) {
    this.shield.visible = opacity > 0.01;
    this.shieldMat.uniforms.op.value = opacity;
  }
}
