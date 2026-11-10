// Third-person camera: orbit on foot, chase in a vehicle, scripted shots in cutscenes.
import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, wrapAngle } from '../core/util.js';

const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();

export class GameCamera {
  constructor(game) {
    this.game = game; this.cam = game.gfx.camera;
    this.yaw = Math.PI; this.pitch = 0.18;      // camera sits at target + (sin yaw, ·, cos yaw) * dist
    this.dist = 4.4; this.target = new THREE.Vector3(); this.idleLook = 0;
    this.trauma = 0; this.fov = 58;
    this.shot = null;           // { pos, look, fov } for cutscenes
    this.shotBlend = 0;
    this.pos = new THREE.Vector3(0, 5, 5);
    this.meshT = 0; this.meshHit = 99;
  }
  snap(yaw) { this.yaw = yaw; this.pitch = 0.18; this.hard = true; this.meshT = 0; }
  shake(a) { this.trauma = Math.min(1, this.trauma + a); }
  setShot(shot) { this.shot = shot; if (shot && shot.cut) this.shotBlend = 1; }

  update(dt) {
    const g = this.game, pl = g.player, inp = g.input, cam = this.cam;
    const v = pl.vehicle;
    const free = !g.cutscene || !this.shot;
    if (free && !g.paused) { this.yaw = wrapAngle(this.yaw + inp.look.x); this.pitch = clamp(this.pitch + inp.look.y * -1, -0.25, 1.05); }
    if (Math.abs(inp.look.x) + Math.abs(inp.look.y) > 0.0005) this.idleLook = 0; else this.idleLook += dt;

    let wantDist, height, fov = 58;
    if (v) {
      wantDist = 4.2 + v.len * 1.05; height = v.def.hgt * 0.75 + 0.5;
      const sp = v.speed;
      fov = 58 + clamp(sp / v.def.top, 0, 1) * 13;
      // swing back behind the car once the stick is left alone
      if (this.idleLook > 0.9 && sp > 2) {
        const back = v.yaw + Math.PI + (v.vf < -1 ? Math.PI : 0);
        this.yaw = dampAngle(this.yaw, back, 2.4 + sp * 0.06, dt);
        this.pitch = damp(this.pitch, 0.2, 2, dt);
      }
      _t.set(v.pos.x, v.pos.y + height, v.pos.z);
    } else {
      const a = pl.actor;
      wantDist = a.combatT > 0 ? 4.9 : 4.3; height = 1.5;
      _t.set(a.pos.x, a.pos.y + height, a.pos.z);
      if (this.idleLook > 2.2 && pl.speed > 3 && inp.touch) this.yaw = dampAngle(this.yaw, a.heading + Math.PI, 1.2, dt);
    }
    if (this.hard) { this.target.copy(_t); this.hard = false; this.dist = wantDist; }
    else { this.target.x = damp(this.target.x, _t.x, 16, dt); this.target.z = damp(this.target.z, _t.z, 16, dt); this.target.y = damp(this.target.y, _t.y, 9, dt); }

    const cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
    _d.set(Math.sin(this.yaw) * cp, sp2, Math.cos(this.yaw) * cp);
    // pull in when a wall is in the way
    const hit = g.physics.raycast(this.target.x, this.target.y, this.target.z, _d.x, _d.y, _d.z, wantDist + 0.3);
    // station roofs, shop awnings and bus shelters are meshes without a box; asked a few times a second
    this.meshT -= dt;
    if (this.meshT <= 0) { this.meshT = 0.06; this.meshHit = g.city.rayModels(this.target, _d, wantDist + 0.3); }
    let d = Math.min(wantDist, hit - 0.3, this.meshHit - 0.3);
    const groundClear = (this.target.y - 0.35) / Math.max(0.05, -_d.y);
    if (_d.y < 0 && d > groundClear) d = groundClear;
    d = Math.max(0.7, d);
    this.dist = d < this.dist ? d : damp(this.dist, d, 4, dt);
    _p.copy(this.target).addScaledVector(_d, this.dist);

    if (this.shot) {
      this.shotBlend = Math.min(1, this.shotBlend + dt * 1.6);
      const k = this.shotBlend * this.shotBlend * (3 - 2 * this.shotBlend);
      _p.lerp(this.shot.pos, k);
      _t.copy(this.target).lerp(this.shot.look, k);
      fov = lerp(fov, this.shot.fov || 42, k);
    } else {
      this.shotBlend = Math.max(0, this.shotBlend - dt * 2);
      _t.copy(this.target);
    }
    this.pos.copy(_p);
    cam.position.copy(_p);
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * (g.settings.shake ? 1 : 0), t = g.time * 37;
      cam.position.x += Math.sin(t * 1.3) * 0.12 * s; cam.position.y += Math.sin(t * 1.7 + 1) * 0.1 * s; cam.position.z += Math.cos(t * 1.1) * 0.12 * s;
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
    }
    cam.lookAt(_t);
    this.fov = damp(this.fov, fov, 4, dt);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}

// One pooled point cloud for smoke, dust and impact puffs.
export class Fx {
  constructor(game, n = 160) {
    this.game = game; this.n = n; this.i = 0;
    this.p = new Float32Array(n * 3); this.c = new Float32Array(n * 4); this.s = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.vel = new Float32Array(n * 3); this.grow = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.c, 4));
    geo.setAttribute('size', new THREE.BufferAttribute(this.s, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { scale: { value: 600 } },
      vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)); gl_FragColor = vec4(vC.rgb, vC.a * a); }',
    });
    this.mesh = new THREE.Points(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    game.gfx.scene.add(this.mesh);
  }
  emit(x, y, z, vx, vy, vz, size, grow, life, r, g, b, a) {
    const i = this.i; this.i = (i + 1) % this.n;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.s[i] = size; this.grow[i] = grow; this.life[i] = life; this.max[i] = life;
    this.c[i * 4] = r; this.c[i * 4 + 1] = g; this.c[i * 4 + 2] = b; this.c[i * 4 + 3] = a;
  }
  smoke(x, y, z, shade = 0.4) { this.emit(x, y, z, (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6, 0.5, 1.4, 1.6, shade, shade, shade, 0.5); }
  dust(x, y, z) { this.emit(x, y, z, (Math.random() - 0.5) * 1.5, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 1.5, 0.5, 1.6, 0.9, 0.78, 0.7, 0.58, 0.32); }
  puff(x, y, z) { for (let k = 0; k < 5; k++) this.emit(x, y, z, (Math.random() - 0.5) * 2.4, Math.random() * 1.6, (Math.random() - 0.5) * 2.4, 0.18, 0.9, 0.35, 1, 0.95, 0.8, 0.8); }
  update(dt) {
    const h = this.game.gfx.renderer.domElement.height;
    this.mesh.material.uniforms.scale.value = h * 0.9;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.c[i * 4 + 3] !== 0) this.c[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      this.p[i * 3] += this.vel[i * 3] * dt; this.p[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.s[i] += this.grow[i] * dt;
      this.c[i * 4 + 3] *= Math.max(0, 1 - dt * (1.6 / this.max[i]));
      if (this.life[i] <= 0) this.c[i * 4 + 3] = 0;
    }
    const a = this.mesh.geometry.attributes; a.position.needsUpdate = true; a.color.needsUpdate = true; a.size.needsUpdate = true;
  }
}
