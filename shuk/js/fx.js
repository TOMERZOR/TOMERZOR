// Particles (one draw call), floating score popups and camera shake.
import * as THREE from 'three';
import { particleTexture, popupTexture } from './textures.js';

const MAX = 700;

export class FX {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: particleTexture() }, scale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
        uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false,
    });
    this.mat = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.parts = [];
    for (let i = 0; i < MAX; i++) this.parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, s: 0.2, s1: 0.2, r: 1, gC: 1, b: 1, drag: 0 });
    this.next = 0;
    this.popups = [];
    this.popCache = new Map();
    this.shakeT = 0; this.shakeAmp = 0;
  }

  setScale(h) { this.mat.uniforms.scale.value = h * 0.9; }

  emit(n, x, y, z, opts = {}) {
    const color = new THREE.Color(opts.color || '#fff');
    const colors = opts.colors ? opts.colors.map(c => new THREE.Color(c)) : null;
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.next];
      this.next = (this.next + 1) % MAX;
      const sp = opts.speed ?? 3;
      const a = Math.random() * Math.PI * 2, e = (opts.up ?? 0.5) + Math.random() * (1 - (opts.up ?? 0.5));
      p.x = x + (Math.random() - 0.5) * (opts.spread ?? 0.3);
      p.y = y + (Math.random() - 0.5) * (opts.spread ?? 0.3) * 0.6;
      p.z = z + (Math.random() - 0.5) * (opts.spread ?? 0.3);
      p.vx = Math.cos(a) * sp * (1 - e * 0.6); p.vz = Math.sin(a) * sp * (1 - e * 0.6) + (opts.vz ?? 0); p.vy = e * sp * (opts.lift ?? 1);
      p.g = opts.gravity ?? 6; p.drag = opts.drag ?? 1.5;
      p.max = p.life = (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.s = (opts.size ?? 0.18) * (0.6 + Math.random() * 0.8); p.s1 = opts.grow ? p.s * opts.grow : p.s * 0.3;
      const c = colors ? colors[Math.floor(Math.random() * colors.length)] : color;
      p.r = c.r; p.gC = c.g; p.b = c.b;
    }
  }

  // presets
  coinBurst(x, y, z) { this.emit(7, x, y, z, { colors: ['#fff6c2', '#ffd23f', '#ffffff'], speed: 2.6, life: 0.35, size: 0.16, gravity: 0, up: 0, spread: 0.2, drag: 3 }); }
  dust(x, y, z, n = 10) { this.emit(n, x, y + 0.1, z, { colors: ['#d8c7a8', '#c9b48e', '#e8dcc4'], speed: 2.2, life: 0.55, size: 0.35, grow: 2.2, gravity: -0.5, up: 0.1, spread: 0.6, drag: 3 }); }
  splat(x, y, z) { this.emit(26, x, y, z, { colors: ['#d62828', '#f77f00', '#ffd23f', '#a0703c', '#2d6a4f'], speed: 6, life: 0.9, size: 0.2, gravity: 14, up: 0.4, spread: 0.6, drag: 0.5 }); }
  sparkle(x, y, z, color) { this.emit(16, x, y, z, { color, speed: 3.5, life: 0.6, size: 0.22, gravity: -1, up: 0.2, spread: 0.4, drag: 2.5 }); }
  shield(x, y, z) { this.emit(40, x, y, z, { colors: ['#5aa9ff', '#ffffff', '#1d6fd8'], speed: 7, life: 0.7, size: 0.25, gravity: 0, up: 0, spread: 0.5, drag: 2 }); }
  confetti(x, y, z) { this.emit(60, x, y, z, { colors: ['#e63946', '#ffd23f', '#2a9d8f', '#1d6fd8', '#f15bb5', '#ffffff'], speed: 6, life: 1.6, size: 0.16, gravity: 6, up: 0.7, spread: 1, drag: 0.8 }); }

  popup(text, x, y, z, color = '#ffd23f', scale = 1) {
    const key = text + color;
    let tex = this.popCache.get(key);
    if (!tex) { tex = popupTexture(text, color); this.popCache.set(key, tex); if (this.popCache.size > 60) { const k = this.popCache.keys().next().value; this.popCache.get(k).dispose(); this.popCache.delete(k); } }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    sp.position.set(x, y, z);
    sp.scale.set(2.4 * scale, 0.6 * scale, 1);
    sp.renderOrder = 10;
    this.scene.add(sp);
    this.popups.push({ sp, t: 0, scale });
  }

  shake(amp, time = 0.35) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, time); }

  // world moves toward +z by `dz` this frame (particles live in world space)
  update(dt, dz) {
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.parts[i];
      if (p.life <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      alive++;
      p.life -= dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt + dz;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; }
      const t = 1 - Math.max(0, p.life) / p.max;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r; this.col[i * 3 + 1] = p.gC; this.col[i * 3 + 2] = p.b;
      this.size[i] = p.s + (p.s1 - p.s) * t;
      this.alpha[i] = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    }
    if (alive || this._wasAlive) {
      for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
    }
    this._wasAlive = alive > 0;
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.t += dt;
      p.sp.position.y += dt * 1.6;
      p.sp.position.z += dz * 0.85;
      const pop = Math.min(1, p.t / 0.12);
      const s = p.scale * (0.6 + 0.4 * pop + (p.t < 0.2 ? Math.sin(p.t / 0.2 * Math.PI) * 0.15 : 0));
      p.sp.scale.set(2.4 * s, 0.6 * s, 1);
      p.sp.material.opacity = p.t > 0.7 ? Math.max(0, 1 - (p.t - 0.7) / 0.35) : 1;
      if (p.t > 1.05) { this.scene.remove(p.sp); p.sp.material.dispose(); this.popups.splice(i, 1); }
    }
    if (this.shakeT > 0) this.shakeT -= dt; else this.shakeAmp = 0;
  }

  shakeOffset(out) {
    if (this.shakeT <= 0) { out.set(0, 0, 0); return out; }
    const a = this.shakeAmp * Math.min(1, this.shakeT / 0.2);
    out.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0);
    return out;
  }

  clear() {
    for (const p of this.parts) p.life = 0;
    for (const p of this.popups) { this.scene.remove(p.sp); p.sp.material.dispose(); }
    this.popups.length = 0;
    this.shakeT = 0;
  }
}
