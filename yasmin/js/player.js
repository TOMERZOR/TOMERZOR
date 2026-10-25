// First-person player: keyboard/mouse and touch input, movement with stamina, head bob,
// the flashlight, hiding in lockers and picking what to interact with.
import * as THREE from 'three';
import { collide } from './world.js';
import { roomAt, isOutdoor, lineOfSight, toCell } from './map.js';

const EYE = 1.62, CROUCH = 1.08;

function cookieTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, '#f4f0e6'); gr.addColorStop(0.42, '#c9c3b6');
  gr.addColorStop(0.5, '#e9e4d8'); gr.addColorStop(0.62, '#6a665e'); gr.addColorStop(0.85, '#1c1b19'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  // smudges on the lens
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.beginPath(); g.arc(70 + Math.random() * 116, 70 + Math.random() * 116, 3 + Math.random() * 14, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Player {
  constructor(camera, scene, world, audio, quality) {
    this.cam = camera;
    this.world = world;
    this.audio = audio;
    this.pos = new THREE.Vector3(3.2, 0, 6.6);
    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector2();
    this.stamina = 1; this.staminaLock = 0;
    this.crouch = 0;
    this.bob = 0; this.stepAcc = 0;
    this.keys = {};
    this.locked = false; // pointer lock
    this.enabled = false;
    this.hasLight = false; this.lightOn = false; this.battery = 1; this.drain = 0;
    this.hidden = null;
    this.noise = 0;      // loudness of the last frame's movement, for Yasmin's ears
    this.moving = 0;
    this.running = false;
    this.sens = 1;
    this.shake = 0; this.roll = 0; this.fov = 72;
    this.lookAt = null;  // forced look target (cutscenes)
    this.touch = { mx: 0, my: 0, lookDX: 0, lookDY: 0, run: false };

    // flashlight
    const s = new THREE.SpotLight(0xfff1dc, 0, 24, 0.5, 0.55, 1.4);
    s.castShadow = true;
    const sm = quality === 'low' ? 512 : 1024;
    s.shadow.mapSize.set(sm, sm); s.shadow.camera.near = 0.2; s.shadow.camera.far = 24; s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02;
    s.map = cookieTex();
    scene.add(s); scene.add(s.target);
    this.flash = s;
    this.flashDir = new THREE.Vector3(0, 0, -1);
    this.bindInput();
  }

  bindInput() {
    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (this.enabled && this.onKey) this.onKey(e.code);
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('mousemove', e => {
      if (!this.locked || !this.enabled) return;
      this.look(e.movementX, e.movementY, 0.0022);
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement != null;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  look(dx, dy, k) {
    if (this.lookAt) return;
    this.yaw -= dx * k * this.sens;
    this.pitch -= dy * k * this.sens;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    if (this.hidden) {
      const base = this.hidden.ry;
      let d = this.yaw - base; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw = base + Math.max(-0.5, Math.min(0.5, d));
      this.pitch = Math.max(-0.35, Math.min(0.3, this.pitch));
    }
  }

  setLight(on) {
    if (!this.hasLight) return;
    this.lightOn = on && this.battery > 0.01;
    this.audio.click();
  }

  get eye() { return EYE - (EYE - CROUCH) * this.crouch; }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  update(dt, t) {
    const k = this.keys;
    let mx = 0, mz = 0;
    if (this.enabled && !this.hidden) {
      if (k.KeyW || k.ArrowUp) mz += 1;
      if (k.KeyS || k.ArrowDown) mz -= 1;
      if (k.KeyA || k.ArrowLeft) mx -= 1;
      if (k.KeyD || k.ArrowRight) mx += 1;
      mx += this.touch.mx; mz += this.touch.my;
    }
    if (this.enabled && (this.touch.lookDX || this.touch.lookDY)) {
      this.look(this.touch.lookDX, this.touch.lookDY, 0.0042);
      this.touch.lookDX = this.touch.lookDY = 0;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const wantCrouch = this.enabled && !this.hidden && (k.KeyC || k.ControlLeft || this.touch.crouch);
    this.crouch += ((wantCrouch ? 1 : 0) - this.crouch) * Math.min(1, dt * 8);
    const wantRun = this.enabled && (k.ShiftLeft || k.ShiftRight || this.touch.run) && mz > 0.2 && !wantCrouch;
    this.running = wantRun && this.stamina > 0.02 && this.staminaLock <= 0;
    let speed = this.running ? 4.9 : 2.5;
    speed *= 1 - this.crouch * 0.5;
    if (this.slow) speed *= this.slow;
    // stamina
    if (this.running && len > 0.1) { this.stamina -= dt / 6; if (this.stamina <= 0) { this.stamina = 0; this.staminaLock = 1.6; } }
    else { this.staminaLock -= dt; if (this.staminaLock <= 0) this.stamina = Math.min(1, this.stamina + dt / (this.moving > 0.1 ? 9 : 5)); }
    // velocity with a little inertia
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const tx = (mx * cy - mz * sy) * speed, tz = (-mx * sy - mz * cy) * speed;
    const acc = len > 0.05 ? 10 : 12;
    this.vel.x += (tx - this.vel.x) * Math.min(1, dt * acc);
    this.vel.y += (tz - this.vel.y) * Math.min(1, dt * acc);
    if (!this.hidden) {
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.y * dt;
      collide(this.world, this.pos, 0.3);
    }
    const sp = Math.hypot(this.vel.x, this.vel.y);
    this.moving = sp;
    // footsteps and head bob
    const outdoor = isOutdoor(roomAt(this.pos.x, this.pos.z));
    if (sp > 0.3 && !this.hidden) {
      const rate = this.running ? 2.7 : 1.85 * (1 - this.crouch * 0.3);
      this.bob += dt * rate * Math.PI * 2 * Math.min(1, sp / 2);
      this.stepAcc += dt * rate * Math.min(1.2, sp / 2.2);
      if (this.stepAcc >= 1) {
        this.stepAcc -= 1;
        const quiet = this.crouch > 0.5;
        this.audio.step({ run: this.running, outdoor, vol: quiet ? 0.35 : 1, wet: this.wetFeet > 0 });
        this.noise = this.running ? 15 : quiet ? 2.2 : 6.5;
        if (this.onStep) this.onStep(this.running);
      }
    } else { this.bob *= 0.9; }
    if (this.wetFeet > 0) this.wetFeet -= dt;
    // camera
    const bobY = Math.sin(this.bob) * (this.running ? 0.055 : 0.03) * Math.min(1, sp / 2);
    const bobX = Math.cos(this.bob * 0.5) * (this.running ? 0.04 : 0.022) * Math.min(1, sp / 2);
    this.roll += ((-mx * 0.02 - (this.running ? Math.sin(this.bob * 0.5) * 0.01 : 0)) - this.roll) * Math.min(1, dt * 6);
    const c = this.cam;
    let px = this.pos.x, py = this.eye + bobY, pz = this.pos.z;
    if (this.hidden) {
      const L = this.hidden; px = L.x - L.fwd.x * 0.08; pz = L.z - L.fwd.z * 0.08; py = 1.6;
    }
    // breathing sway when idle
    const breathe = Math.sin(t * 1.3) * 0.006 * (1 + (1 - this.stamina) * 3);
    if (this.lookAt) {
      const d = new THREE.Vector3().subVectors(this.lookAt, c.position);
      const ty = Math.atan2(-d.x, -d.z), tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
      let dy = ty - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 10); this.pitch += (tp - this.pitch) * Math.min(1, dt * 10);
    }
    const sh = this.shake;
    c.position.set(px + Math.cos(this.yaw) * bobX + (Math.random() - 0.5) * sh * 0.06, py + breathe + (Math.random() - 0.5) * sh * 0.06, pz - Math.sin(this.yaw) * bobX);
    c.rotation.order = 'YXZ';
    c.rotation.set(this.pitch + (Math.random() - 0.5) * sh * 0.02, this.yaw, this.roll + (Math.random() - 0.5) * sh * 0.03);
    this.shake = Math.max(0, this.shake - dt * 1.5);
    // FOV: wider when sprinting
    const tf = this.fov + (this.running ? 6 : 0) - this.crouch * 2;
    c.fov += (tf - c.fov) * Math.min(1, dt * 4); c.updateProjectionMatrix();

    // flashlight: lags slightly behind the view, flickers when the battery is low
    const f = this.forward(new THREE.Vector3());
    this.flashDir.lerp(f, Math.min(1, dt * 14)).normalize();
    const s = this.flash;
    s.position.set(c.position.x + Math.cos(this.yaw) * 0.18, c.position.y - 0.22, c.position.z - Math.sin(this.yaw) * 0.18);
    s.target.position.copy(s.position).addScaledVector(this.flashDir, 5);
    if (this.lightOn) {
      this.battery = Math.max(0, this.battery - dt * this.drain);
      if (this.battery <= 0) this.lightOn = false;
    }
    let li = this.lightOn ? 34 : 0;
    if (this.lightOn && this.battery < 0.2 && Math.sin(t * 37) * Math.sin(t * 5.3) > 0.6) li *= 0.15;
    if (this.flicker > 0) { this.flicker -= dt; if (Math.random() < 0.5) li *= 0.05; }
    s.intensity += (li - s.intensity) * Math.min(1, dt * 25);
    this.noise *= Math.pow(0.02, dt);
  }

  // Closest interactable in front of the player.
  pick(list) {
    const c = this.cam.position;
    const f = this.forward(new THREE.Vector3());
    let best = null, bestScore = -1;
    for (const it of list) {
      if (it.enabled === false || (it.enabled instanceof Function && !it.enabled())) continue;
      const ip = typeof it.pos === 'function' ? it.pos() : it.pos;
      const dx = ip.x - c.x, dy = ip.y - c.y, dz = ip.z - c.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > (it.range || 2.0)) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / d;
      if (dot < (d < 0.9 ? 0.55 : 0.8)) continue;
      if (!lineOfSight(c.x, c.z, ip.x, ip.z, (x, z) => {
        // walls only; the target's own cell may be a lock
        const tx = toCell(ip.x), tz = toCell(ip.z);
        if (x === tx && z === tz) return false;
        return this.world.solidAt ? this.world.solidAt(x, z) : false;
      })) continue;
      const score = dot - d * 0.1;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best;
  }
}
