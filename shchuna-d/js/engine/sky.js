// Day/night cycle: sun and moon, sky dome, fog, ambient light, shadow frustum and the
// image-based lighting probe. One game hour is one real minute.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp, lerp, smoothstep } from '../core/util.js';

const C = (hex) => new THREE.Color(hex);
// Keyframes over the day: hour, sun colour, sun intensity, sky/ground hemisphere, fog, exposure.
const KEYS = [
  { h: 0,    sun: C(0x6f86c9), si: 0.75, sky: C(0x3d5290), gnd: C(0x23262f), fog: C(0x121b30), hi: 1.3, exp: 1.5 },
  { h: 4.6,  sun: C(0x6f86c9), si: 0.75, sky: C(0x3e5493), gnd: C(0x24272f), fog: C(0x131c31), hi: 1.3, exp: 1.5 },
  { h: 5.8,  sun: C(0xff9a5a), si: 1.2,  sky: C(0x7d8fb5), gnd: C(0x4a3f38), fog: C(0xc79a86), hi: 0.75, exp: 1.05 },
  { h: 7.2,  sun: C(0xffd9a8), si: 2.6,  sky: C(0xa9c4e6), gnd: C(0x7a6a55), fog: C(0xd8c6ae), hi: 0.95, exp: 0.98 },
  { h: 12.5, sun: C(0xfff3de), si: 3.4,  sky: C(0xbcd6f2), gnd: C(0x8f7d62), fog: C(0xd9d2c0), hi: 1.05, exp: 0.92 },
  { h: 16.5, sun: C(0xffe2b0), si: 3.0,  sky: C(0xb2cbe8), gnd: C(0x8a765a), fog: C(0xdccbb0), hi: 1.0,  exp: 0.95 },
  { h: 18.3, sun: C(0xff8a3c), si: 1.9,  sky: C(0x8f8fb0), gnd: C(0x5a4636), fog: C(0xd99468), hi: 0.8,  exp: 1.02 },
  { h: 19.4, sun: C(0xc8607a), si: 0.5,  sky: C(0x3c416e), gnd: C(0x24222b), fog: C(0x4a3a55), hi: 0.75, exp: 1.25 },
  { h: 20.5, sun: C(0x6f86c9), si: 0.75, sky: C(0x3d5290), gnd: C(0x23262f), fog: C(0x121b30), hi: 1.3, exp: 1.5 },
  { h: 24,   sun: C(0x6f86c9), si: 0.75, sky: C(0x3d5290), gnd: C(0x23262f), fog: C(0x121b30), hi: 1.3, exp: 1.5 },
];

export class SkySystem {
  constructor(gfx) {
    this.gfx = gfx;
    const scene = gfx.scene;
    this.hour = 16.2;            // golden afternoon by default
    this.day = 0;
    this.rate = 1 / 60;          // game hours per real second
    this.night = 0;              // 0 day .. 1 night, drives lamps and windows
    this.paused = false;

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd6f2, 0x8f7d62, 1);
    scene.add(this.hemi);

    this.sky = new Sky(); this.sky.scale.setScalar(4000);
    // the stock shader is tuned for half exposure; bring it down to sit with the scene
    // and at night swap its grey residue for a deep blue that is lighter towards the horizon
    this.sky.material.uniforms.uNight = { value: 0 };
    this.sky.material.fragmentShader = 'uniform float uNight;\n' + this.sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );',
      'float nUp = clamp( direction.y, 0.0, 1.0 ); vec3 nightCol = mix( vec3( 0.040, 0.058, 0.115 ), vec3( 0.008, 0.014, 0.042 ), pow( nUp, 0.45 ) );\n gl_FragColor = vec4( retColor * 0.36 * ( 1.0 - 0.8 * uNight ) + nightCol * uNight, 1.0 );');
    this.sky.material.depthWrite = false; this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.86;
    scene.add(this.sky);

    // Stars: a sphere of points that fades in with the night.
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, y = Math.random() * 0.95 + 0.03, r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * r * 1500; pos[i * 3 + 1] = y * 1500; pos[i * 3 + 2] = Math.sin(a) * r * 1500;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false; this.stars.renderOrder = -9;
    scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(26, 20, 14), new THREE.MeshBasicMaterial({ color: 0xf2f0e4, fog: false, transparent: true, opacity: 0 }));
    this.moon.renderOrder = -8; scene.add(this.moon);

    scene.fog = new THREE.FogExp2(0xd9d2c0, 0.0026);
    this.pmrem = new THREE.PMREMGenerator(gfx.renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new Sky(); this.envSky.scale.setScalar(1000); this.envScene.add(this.envSky);
    this.envRT = null; this._envHour = -99;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this._c = new THREE.Color();
    this.applyQuality();
    this.update(0, new THREE.Vector3());
  }

  applyQuality() {
    const q = this.gfx.q, s = this.sun.shadow;
    this.sun.castShadow = q.shadow > 0;
    if (q.shadow) {
      s.mapSize.set(q.shadow, q.shadow);
      const R = q.shadow >= 2048 ? 70 : 48;
      const c = s.camera; c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 420; c.updateProjectionMatrix();
      this.shadowR = R;
      if (s.map) { s.map.dispose(); s.map = null; }
    }
    this._envHour = -99;
  }

  clock() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  setHour(h) { this.hour = ((h % 24) + 24) % 24; this._envHour = -99; }

  update(dt, focus) {
    if (!this.paused) {
      this.hour += dt * this.rate;
      if (this.hour >= 24) { this.hour -= 24; this.day++; }
    }
    const h = this.hour;
    let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = clamp((h - a.h) / (b.h - a.h), 0, 1);

    // Sun path: rises in the east (+X), culminates to the south.
    const dayT = (h - 5.6) / (19.6 - 5.6);
    const isDay = dayT > 0 && dayT < 1;
    const ang = Math.PI * clamp(dayT, 0, 1);
    const elev = Math.sin(ang) * 1.12 + 0.03;
    if (isDay) this.sunDir.set(Math.cos(ang) * 0.95, elev, 0.42).normalize();
    else {
      const nt = h >= 19.6 ? (h - 19.6) / 10 : (h + 4.4) / 10;      // the moon crosses during the night
      const na = Math.PI * clamp(nt, 0, 1);
      this.sunDir.set(-Math.cos(na) * 0.8, Math.sin(na) * 0.9 + 0.25, -0.35).normalize();
    }
    this.night = 1 - smoothstep(5.2, 6.4, h) + smoothstep(18.6, 19.8, h);
    this.night = clamp(this.night, 0, 1);

    this.sun.color.copy(a.sun).lerp(b.sun, t);
    this.sun.intensity = lerp(a.si, b.si, t) * 0.66;
    this.hemi.color.copy(a.sky).lerp(b.sky, t);
    this.hemi.groundColor.copy(a.gnd).lerp(b.gnd, t);
    this.hemi.intensity = lerp(a.hi, b.hi, t) * (this.gfx.q.env ? 0.42 : 0.9);
    const fog = this.gfx.scene.fog;
    fog.color.copy(a.fog).lerp(b.fog, t);
    fog.density = lerp(0.00115, 0.00095, this.night) * (720 / this.gfx.q.far) ** 0.8;
    this.gfx.renderer.toneMappingExposure = lerp(a.exp, b.exp, t);
    if (this.gfx.bloom) this.gfx.bloom.strength = lerp(0.14, 0.34, this.night);

    // Sky dome follows the camera; the shader wants the real sun even at night (below horizon = dark).
    this.sky.position.copy(focus);
    const su = this.sky.material.uniforms;
    if (isDay) su.sunPosition.value.copy(this.sunDir);
    else su.sunPosition.value.set(this.sunDir.x * -1, -0.25, 0.2).normalize();
    su.rayleigh.value = lerp(1.6, 0.25, this.night);
    su.uNight.value = this.night;
    this.stars.position.copy(focus); this.stars.material.opacity = this.night * 0.9;
    this.moon.position.copy(focus).addScaledVector(this.sunDir, 1400);
    this.moon.material.opacity = isDay ? 0 : this.night;

    // Shadow frustum follows the player, snapped to texels so shadows do not swim.
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 200);
    if (this.sun.castShadow) {
      const texel = (this.shadowR * 2) / this.sun.shadow.mapSize.x;
      this.sun.target.position.x = Math.round(focus.x / texel) * texel;
      this.sun.target.position.z = Math.round(focus.z / texel) * texel;
      this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 200);
    }

    // Refresh the reflection probe when the light has moved on noticeably.
    if (this.gfx.q.env && Math.abs(h - this._envHour) > 0.35) {
      this._envHour = h;
      const eu = this.envSky.material.uniforms;
      eu.turbidity.value = su.turbidity.value; eu.rayleigh.value = su.rayleigh.value;
      eu.mieCoefficient.value = su.mieCoefficient.value; eu.mieDirectionalG.value = su.mieDirectionalG.value;
      eu.sunPosition.value.copy(su.sunPosition.value);
      const old = this.envRT;
      this.envRT = this.pmrem.fromScene(this.envScene, 0.02);
      this.gfx.scene.environment = this.envRT.texture;
      this.gfx.scene.environmentIntensity = lerp(0.5, 0.24, this.night);
      if (old) old.dispose();
    } else if (!this.gfx.q.env && this.gfx.scene.environment) this.gfx.scene.environment = null;
  }
}
