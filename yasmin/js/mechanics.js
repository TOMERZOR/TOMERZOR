// Stealth tools and hazards: throwing empty bottles to lure Yasmin away, and the wet floor
// she leaves behind when she mops (with a yellow sign) — running across it splashes loudly.
import * as THREE from 'three';
import { walkable, toCell, roomAt, isOutdoor } from './map.js';
import * as T from './textures.js';

function signTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c812'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#111';
  // the slipping man in a triangle
  g.beginPath(); g.moveTo(128, 30); g.lineTo(226, 200); g.lineTo(30, 200); g.closePath(); g.lineWidth = 12; g.strokeStyle = '#111'; g.stroke();
  g.beginPath(); g.arc(140, 92, 12, 0, 7); g.fill();
  g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(132, 106); g.lineTo(112, 150); g.lineTo(150, 180); g.moveTo(112, 150); g.lineTo(84, 176); g.moveTo(126, 118); g.lineTo(160, 128); g.moveTo(126, 118); g.lineTo(96, 120); g.stroke();
  g.font = '900 52px Heebo, Arial'; g.textAlign = 'center'; g.direction = 'rtl';
  g.fillText('זהירות!', 128, 268);
  g.font = '800 40px Heebo, Arial';
  g.fillText('רצפה רטובה', 128, 322);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Mechanics {
  constructor(game) {
    this.g = game;
    this.flying = [];
    this.wet = [];       // {x, z, r, age, mesh, sign}
    this.splashCd = 0;
  }

  init() {
    const W = this.g.world;
    this.bottleMat = new THREE.MeshPhysicalMaterial({ color: 0xc8d6d0, roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false });
    this.capMat = new THREE.MeshStandardMaterial({ color: 0xb01818, roughness: 0.5 });
    this.signMat = new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.5, side: THREE.DoubleSide });
    this.puddle = T.puddleTex(false);
    this.root = W.root;
  }

  bottleMesh() {
    if (!this.bottleMat) this.init();
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.22, 10), this.bottleMat); body.position.y = 0.11; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.035, 0.06, 10), this.bottleMat); neck.position.y = 0.25; g.add(neck);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 10), this.capMat); cap.position.y = 0.29; g.add(cap);
    return g;
  }

  throwBottle() {
    const g = this.g, P = g.player;
    if (P.bottles <= 0 || P.hidden) return false;
    P.bottles--;
    const m = this.bottleMesh();
    const cam = P.cam;
    const f = P.forward(new THREE.Vector3());
    m.position.copy(cam.position).addScaledVector(f, 0.4); m.position.y -= 0.15;
    this.root.add(m);
    const v = f.clone().multiplyScalar(11); v.y += 2.6;
    this.flying.push({ m, v, spin: new THREE.Vector3(Math.random() * 12, Math.random() * 8, Math.random() * 12), bounced: 0, t: 0 });
    g.audio.noise(0.15, { type: 'bandpass', f: 900, q: 1, vol: 0.12, f2: 400 }); // whoosh
    return true;
  }

  land(b) {
    const g = this.g, p = b.m.position;
    g.audio.play('sfx_bottle', { pos: p.clone(), volume: 1.5, verb: 0.5 });
    // Yasmin goes to look — even mid-chase if she has lost sight of you
    const Y = g.yasmin;
    if (Y.visible) {
      const d = Math.hypot(p.x - Y.position.x, p.z - Y.position.z);
      if (Y.state === 'chase' && Y.lostT > 0.5 && d < 26) { Y.lastSeen.set(p.x, 0, p.z); Y.lostT = 3; Y.setState('investigate'); Y.goTo(p.x, p.z); }
      else Y.noiseAt(p.x, p.z, 24);
    }
  }

  // Yasmin mops a patch of floor: puddle decal plus a yellow sign.
  mopPatch(x, z) {
    if (isOutdoor(roomAt(x, z))) return;
    const W = this.g.world;
    if (this.wet.some(w => Math.hypot(w.x - x, w.z - z) < 2)) return;
    if (this.wet.length >= 7) this.removeWet(this.wet[0]);
    const mesh = W.decal(this.puddle, x, z, 2.4, 1.8, Math.random() * 3, 0.006, 1);
    mesh.material.roughness = 0.04; mesh.material.metalness = 0; mesh.material.opacity = 0.7;
    const sign = new THREE.Group();
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.62), this.signMat);
      p.position.set(0, 0.3, s * 0.1); p.rotation.x = s * 0.32; if (s > 0) p.rotation.y = Math.PI;
      p.castShadow = true; sign.add(p);
    }
    // put the sign at the edge of the patch, off the middle of the corridor
    sign.position.set(x + 0.9, 0, z + 0.4); sign.rotation.y = Math.random() * 6;
    W.root.add(sign);
    this.wet.push({ x, z, r: 1.15, age: 0, mesh, sign });
  }
  removeWet(w) {
    this.g.world.decals.remove(w.mesh); this.g.world.root.remove(w.sign);
    this.wet.splice(this.wet.indexOf(w), 1);
  }
  clear() {
    while (this.wet.length) this.removeWet(this.wet[0]);
    for (const b of this.flying) this.root.remove(b.m);
    this.flying = [];
  }
  onWet(x, z) { return this.wet.some(w => Math.hypot(w.x - x, w.z - z) < w.r); }

  update(dt) {
    const g = this.g, P = g.player;
    // bottles in flight
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const b = this.flying[i];
      b.t += dt;
      b.v.y -= 9.8 * dt;
      const p = b.m.position;
      const nx = p.x + b.v.x * dt, nz = p.z + b.v.z * dt;
      if (!walkable(toCell(nx), toCell(p.z))) { b.v.x *= -0.4; this.bounce(b); }
      if (!walkable(toCell(p.x), toCell(nz))) { b.v.z *= -0.4; this.bounce(b); }
      p.x += b.v.x * dt; p.z += b.v.z * dt; p.y += b.v.y * dt;
      if (p.y > 2.6) { p.y = 2.6; b.v.y = -Math.abs(b.v.y) * 0.3; }
      b.m.rotation.x += b.spin.x * dt; b.m.rotation.z += b.spin.z * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        if (!b.bounced++) this.land(b);
        b.v.multiplyScalar(0.35); b.v.y = Math.abs(b.v.y) * 0.4;
        if (b.bounced > 3) { b.m.rotation.set(Math.PI / 2, b.m.rotation.y, 0); p.y = 0.04; this.flying.splice(i, 1); this.settle(b.m); }
      }
      if (b.t > 6) { this.flying.splice(i, 1); this.settle(b.m); }
    }
    // wet floor dries out; running on it splashes
    for (let i = this.wet.length - 1; i >= 0; i--) {
      const w = this.wet[i]; w.age += dt;
      if (w.age > 100) { w.mesh.material.opacity = Math.max(0, 1 - (w.age - 100) / 10); if (w.age > 110) this.removeWet(w); }
    }
    this.splashCd -= dt;
    P.wetFeet = Math.max(P.wetFeet || 0, 0);
    if (!P.hidden && P.moving > 0.5 && this.onWet(P.pos.x, P.pos.z)) {
      P.wetFeet = 4;
      if (this.splashCd < 0) {
        this.splashCd = P.running ? 0.28 : 0.6;
        const loud = P.running ? 1 : 0.4;
        g.audio.noise(0.25, { type: 'bandpass', f: 1300, q: 1.2, vol: 0.35 * loud, a: 0.005, f2: 500, verb: 0.4 });
        g.audio.noise(0.12, { type: 'highpass', f: 3500, vol: 0.15 * loud, verb: 0.3 });
        if (P.running) { P.noise = Math.max(P.noise, 20); P.slow = 0.75; setTimeout(() => P.slow = 1, 400); if (!this.warned) { this.warned = true; g.ui.toast('אל תרוץ על הרטוב!'); } }
        else P.noise = Math.max(P.noise, 5);
      }
    }
  }
  bounce(b) { if (b.bounced === 0 && b.t > 0.05) { this.g.audio.noise(0.06, { type: 'highpass', f: 2500, vol: 0.2, pos: b.m.position.clone() }); } }
  settle(m) { setTimeout(() => this.root.remove(m), 20000); }
}
