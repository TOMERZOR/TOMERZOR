// Everything you see in a fight: the arena, the two 3D fighters animated from
// the simulation state, the flying items, sparks and camera. Purely a view of
// the sim state: it can be thrown away and redrawn from any frame (rollback).

import * as THREE from "three";
import { GLTFLoader } from "../vendor/addons/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/addons/meshopt_decoder.module.js";
import { RoomEnvironment } from "../vendor/addons/RoomEnvironment.js";
import { clone as cloneSkinned } from "../vendor/addons/SkeletonUtils.js";
import { decodePack, buildClips } from "./anim.js";
import { MOVES, FIGHTERS, CONST } from "./sim.js";
import { CHARS, STAGES } from "./chars.js";
import { makeProp, makeChair, setBagTexture } from "./props.js";

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();

let pack = null;
const gltfCache = new Map();

export async function loadPack() {
  if (!pack) pack = decodePack(await (await fetch("models/anims.json")).json());
  return pack;
}
export function loadFighterModel(id) {
  if (!gltfCache.has(id)) gltfCache.set(id, loader.loadAsync(`models/${id}.glb`));
  return gltfCache.get(id);
}

// clip, start, impact start, impact end, end (seconds in the clip)
const MOVE_ANIM = {
  jab: ["jab", 0.35, 0.68, 0.68, 1.15],
  jab2: ["jab2", 0.3, 0.56, 0.56, 1.0],
  hook: ["hook", 0.1, 0.33, 0.33, 0.75],
  upper: ["upper", 0.1, 0.38, 0.38, 0.85],
  kick: ["kick", 0.3, 0.68, 0.68, 1.2],
  round: ["round", 0.7, 1.44, 1.44, 2.2],
  sweep: ["sweep", 0.95, 1.38, 1.38, 2.0],
  airp: ["jab", 0.5, 0.68, 0.68, 0.68],
  airk: ["kick", 0.45, 0.68, 0.68, 0.68],
  grab: ["overthrow", 0.8, 1.0, 1.1, 3.9],
  toss: ["pickthrow", 1.9, 2.55, 2.55, 3.4],
  chair: ["pickthrow", 0.45, 2.55, 2.55, 3.6],
  chairality: ["pickthrow", 0.45, 2.55, 2.55, 3.6],
  spin: ["hammer", 0.4, 1.0, 1.43, 1.87],
  nails: ["slash", 0.0, 0.3, 2.17, 2.8],
  flash: ["jab2", 0.3, 0.56, 0.56, 1.0],
  whip: ["round", 0.7, 1.2, 1.6, 2.2],
  fly: ["flykick", 1.1, 1.9, 2.4, 3.2],
  vape: ["block", 0.3, 0.76, 0.76, 1.3],
  scream: ["stomp", 0.0, 0.23, 0.4, 1.3],
  tiktok: ["dance", 2.0, 2.4, 5.0, 5.6],
};

// What each fighter holds while doing a move
function heldProp(chId, mv, sf) {
  const F = FIGHTERS[chId];
  const m = MOVES[mv];
  if (!m) return null;
  if (mv === "toss" && sf < m.s) return F.item === "blush" ? null : F.item;
  if ((mv === "chair" || mv === "chairality") && sf >= 9 && sf < m.s) return "chair";
  if (mv === "spin") return "bag";
  if (mv === "flash" || mv === "tiktok") return "phone";
  if (mv === "vape") return "vape";
  return null;
}

const ease = {
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) * (1 - x),
  inOut: (x) => x * x * (3 - 2 * x),
};
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// The walk clips are made in place at about 0.67 m/s; play them as fast as the
// fighter really moves so the feet stay planted.
const CLIP_WALK_SPEED = 0.67;
const WALK_RATE = { walkf: (CONST.WALK_F * 60 / 1000) / CLIP_WALK_SPEED, walkb: (CONST.WALK_B * 60 / 1000) / CLIP_WALK_SPEED };

// sf and frame may be fractional: the view runs between simulation frames
function poseFor(p, sf, frame) {
  const sec = (n) => n / 60;
  switch (p.st) {
    case "intro": return { clip: "stance", t: sec(frame), loop: true };
    case "idle": return { clip: "stance", t: sec(frame), loop: true };
    case "walkf": return { clip: "walkf", t: sec(sf) * WALK_RATE.walkf, loop: true };
    case "walkb": return { clip: "walkb", t: sec(sf) * WALK_RATE.walkb, loop: true };
    case "crouch": case "cblock": return { clip: "sweep", t: 1.05 };
    case "block": return { clip: "block", t: 0.76 };
    case "jump": return { clip: "jump", t: 0.45 + 0.7 * ease.inOut(clamp01(sf / 44)), root: true };
    // snap into the recoil, then hold it while the stun lasts
    case "hit": return { clip: "hit", t: 0.16 + 0.56 * ease.out(clamp01(sf / 9)) };
    case "dazed": return { clip: "hit", t: 0.55 + 0.18 * Math.sin(frame * 0.09) };
    // knocked into the air: lean back while rising, then the falling part of the clip
    case "air_hit": return p.vy > 0
      ? { clip: "knockdown", t: 0.22 + 0.2 * ease.out(clamp01(sf / 14)), root: true }
      : { clip: "knockdown", t: 1.5 + 0.5 * clamp01(1 - p.y / 900), root: true };
    case "down": return { clip: "knockdown", t: 2.0 + ease.out(clamp01(sf / 30)) * 0.22, root: true };
    case "ko": return { clip: "knockdown", t: 2.22, root: true };
    case "getup": return { clip: "jump", t: 0.28 * (1 - ease.inOut(clamp01(sf / 26))) };
    case "win": return { clip: "dance", t: sec(sf), loop: true };
    case "attack": {
      const m = MOVES[p.mv];
      const a = MOVE_ANIM[p.mv];
      if (!m || !a) return { clip: "stance", t: 0 };
      const [clip, t0, tA, tB, t1] = a;
      let t;
      // wind up slowly and snap into the hit; settle out of it
      if (sf < m.s) t = t0 + (tA - t0) * ease.in(sf / m.s);
      else if (sf < m.s + m.a) t = tA + (tB - tA) * ((sf - m.s) / Math.max(1, m.a));
      else t = tB + (t1 - tB) * ease.out(clamp01((sf - m.s - m.a) / Math.max(1, m.r)));
      return { clip, t, attack: true };
    }
  }
  return { clip: "stance", t: sec(frame), loop: true };
}

// how fast to crossfade into a pose (per second)
function blendRate(pose, st) {
  if (st === "hit" || st === "air_hit") return 30;
  if (pose.attack) return 22;
  if (st === "block" || st === "cblock" || st === "jump") return 16;
  return 9;
}

// A ribbon behind a striking hand or foot
class Trail {
  constructor(scene, color) {
    this.max = 16;
    this.pts = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.max * 2 * 3);
    this.alpha = new Float32Array(this.max * 2);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("a", new THREE.BufferAttribute(this.alpha, 1));
    const idx = [];
    for (let i = 0; i < this.max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) } },
      vertexShader: "attribute float a; varying float vA; void main(){ vA = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 color; varying float vA; void main(){ vec3 c = mix(color * 1.6, vec3(1.0), smoothstep(0.55, 1.0, vA)); gl_FragColor = vec4(c * vA, vA); }",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(dt, point) {
    for (const p of this.pts) p.age += dt;
    if (point) this.pts.unshift({ x: point.x, y: point.y, z: point.z + 0.05, age: 0 });
    this.pts = this.pts.filter((p) => p.age < 0.11).slice(0, this.max);
    const n = this.pts.length;
    for (let i = 0; i < this.max; i++) {
      const p = this.pts[Math.min(i, n - 1)];
      if (!p || n < 2) { this.alpha[i * 2] = this.alpha[i * 2 + 1] = 0; continue; }
      const q = this.pts[Math.min(i + 1, n - 1)], r = this.pts[Math.min(Math.max(i - 1, 0), n - 1)];
      let dx = r.x - q.x, dy = r.y - q.y;
      const l = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, i / Math.max(1, n - 1));
      const w = 0.05 * (1 - k * k);
      const nx = -dy / l * w, ny = dx / l * w;
      this.pos.set([p.x + nx, p.y + ny, p.z, p.x - nx, p.y - ny, p.z], i * 6);
      const al = i < n ? Math.pow(1 - k, 1.5) * (1 - p.age / 0.11) : 0;
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = al;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.a.needsUpdate = true;
  }
  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); }
}

const KICKS = new Set(["kick", "round", "sweep", "airk", "fly", "whip"]);
const NO_TRAIL = new Set(["grab", "toss", "chair", "chairality", "vape", "scream"]);

class Fighter3D {
  constructor(gltf, chIndex, side, mirrorTint) {
    this.ch = chIndex;
    this.root = new THREE.Group();
    const model = cloneSkinned(gltf.scene);
    this.model = model;
    this.mats = [];
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        o.frustumCulled = false;
        const m = o.material.clone();
        const mo = CHARS[chIndex].mat || {};
        m.roughness = mo.roughness ?? 0.72; m.metalness = mo.metalness ?? 0.0;
        m.envMapIntensity = mo.env ?? 0.55;
        if (mirrorTint) m.color = new THREE.Color(0.78, 0.86, 1.05);
        m.emissive = new THREE.Color(0, 0, 0);
        o.material = m;
        this.mats.push(m);
      }
    });
    this.root.add(model);
    this.bones = {};
    model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.clips = buildClips(pack, model);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const [n, c] of Object.entries(this.clips)) {
      const a = this.mixer.clipAction(c);
      a.play(); a.enabled = true; a.setEffectiveWeight(0);
      this.actions[n] = a;
    }
    this.cur = null; this.prev = null; this.blend = 0;
    this.yaw = side ? -Math.PI / 2 : Math.PI / 2;
    this.flash = 0;
    this.props = {};
    this.held = null;
    this.tmp = new THREE.Vector3();
    this.flinch = 0; this.flinchV = 0; this.shake = 0;
    this.trail = null;
  }

  prop(type) {
    if (!this.props[type]) {
      const m = makeProp(type);
      this.props[type] = m;
      this.root.parent.add(m);
      m.visible = false;
    }
    return this.props[type];
  }

  // p: sim state now, q: one frame before, alpha: how far between them we draw
  update(p, q, alpha, frame, dt, hitstop = 0) {
    const same = q && q.st === p.st && q.mv === p.mv && p.sf >= q.sf;
    const sf = same ? q.sf + (p.sf - q.sf) * alpha : p.sf;
    const lerp = (a, b) => (q && Math.abs(b - a) < 400 ? a + (b - a) * alpha : b);
    const px = lerp(q ? q.x : p.x, p.x), py = lerp(q ? q.y : p.y, p.y);
    const pose = poseFor(p, sf, frame);
    // crossfade between poses
    if (!this.cur || this.cur.clip !== pose.clip) {
      if (this.cur) { this.prev = { ...this.cur }; this.blend = 1; this.rate = blendRate(pose, p.st); }
    }
    this.cur = pose;
    this.blend = Math.max(0, this.blend - dt * (this.rate || 9));
    for (const a of Object.values(this.actions)) a.setEffectiveWeight(0);
    const set = (ps, w) => {
      const a = this.actions[ps.clip];
      if (!a) return;
      const d = a.getClip().duration;
      a.time = ps.loop ? ((ps.t % d) + d) % d : Math.min(d - 0.001, Math.max(0, ps.t));
      a.setEffectiveWeight(w);
    };
    const b = this.blend * this.blend * (3 - 2 * this.blend);
    if (this.prev && b > 0) { set(this.prev, b); set(pose, 1 - b); }
    else set(pose, 1);
    this.mixer.update(0);

    // place
    let y = py / 1000;
    if (pose.root) {
      const c = pack.clips[pose.clip];
      const k = Math.min(c.n - 1, Math.max(0, Math.round(pose.t * pack.fps)));
      const dy = (c.h[k * 3 + 1] / 8000) * 0.94;
      if (dy > 0) y -= dy * (this.prev && b > 0 ? 1 - b : 1);
    }
    // the one who got hit trembles while the action is frozen
    let jx = 0;
    if (this.shake > 0) {
      if (hitstop > 0) jx = Math.sin(performance.now() * 0.09) * 0.03 * this.shake;
      else this.shake = 0;
    }
    this.root.position.set(px / 1000 + jx, Math.max(-0.05, y), 0);
    const want = p.face > 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42;
    let d = want - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 14);
    this.root.rotation.y = this.yaw;

    // recoil: the whole body rocks back from the feet and springs upright
    this.flinchV += (-this.flinch * 260 - this.flinchV * 18) * dt;
    this.flinch += this.flinchV * dt;
    this.model.rotation.x = -0.2 * this.flinch;

    // hit flash
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    const fl = this.flash;
    for (const m of this.mats) m.emissive.setRGB(fl, fl * 0.55, fl * 0.45);

    this.root.updateMatrixWorld(true);

    // a streak behind the striking limb, from just before impact to just after
    let tp = null;
    if (p.st === "attack" && this.trail && !NO_TRAIL.has(p.mv)) {
      const m = MOVES[p.mv];
      if (sf >= m.s - 3 && sf < m.s + m.a + 3) {
        const names = KICKS.has(p.mv) ? ["RightFoot", "LeftFoot"] : ["RightHand", "LeftHand"];
        let best = -1e9;
        for (const n of names) {
          const bn = this.bones[n]; if (!bn) continue;
          bn.getWorldPosition(this.tmp);
          const ext = (this.tmp.x - this.root.position.x) * p.face + this.tmp.y * 0.3;
          if (ext > best) { best = ext; tp = this.tmp.clone(); }
        }
      }
    }
    if (this.trail) this.trail.update(dt, tp);

    // the item in her hand
    const hold = p.st === "attack" ? heldProp(this.ch, p.mv, p.sf) : null;
    if (this.held && this.held !== hold) this.props[this.held].visible = false;
    this.held = hold;
    if (hold) {
      const pr = this.prop(hold);
      pr.visible = true;
      const hand = this.bones.RightHand || this.bones.LeftHand;
      hand.getWorldPosition(this.tmp);
      pr.position.copy(this.tmp);
      if (hold === "chair") { pr.position.y += 0.05; pr.rotation.set(Math.PI, this.yaw, 0.3 * p.face); }
      else if (hold === "bag") { pr.position.y -= 0.12; pr.rotation.set(0, this.yaw, 0); }
      else pr.rotation.set(0.3, this.yaw + Math.PI / 2, 0);
    }
  }

  kick(amount) { this.flinchV += amount * 9; }

  headPos(v) { (this.bones.Head || this.model).getWorldPosition(v); return v; }
  chestPos(v) { (this.bones.Spine || this.model).getWorldPosition(v); return v; }
}

// ---------- impact sprites ----------
function ringTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 34, 64, 64, 62);
  r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.55, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function burstTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  g.translate(128, 128);
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, 70);
  glow.addColorStop(0, "rgba(255,255,255,1)"); glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.95)";
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.12;
    const len = i % 2 ? 80 : 124, w = i % 2 ? 7 : 11;
    g.save(); g.rotate(a);
    g.beginPath(); g.moveTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill();
    g.restore();
  }
  return new THREE.CanvasTexture(c);
}

// ---------- particles ----------
function dotTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.85)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

class Particles {
  constructor(scene, max = 900) {
    this.max = max;
    this.list = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("pcolor", new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute("size", new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTexture() }, scale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec4 pcolor; varying vec4 vC; uniform float scale;
        void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); if (gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.normalMat = mat.clone(); this.normalMat.blending = THREE.NormalBlending;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    // a second layer for non-glowing stuff (blood, smoke)
    const geo2 = new THREE.BufferGeometry();
    this.pos2 = new Float32Array(max * 3); this.col2 = new Float32Array(max * 4); this.size2 = new Float32Array(max);
    geo2.setAttribute("position", new THREE.BufferAttribute(this.pos2, 3));
    geo2.setAttribute("pcolor", new THREE.BufferAttribute(this.col2, 4));
    geo2.setAttribute("size", new THREE.BufferAttribute(this.size2, 1));
    this.points2 = new THREE.Points(geo2, this.normalMat);
    this.points2.frustumCulled = false;
    scene.add(this.points2);
  }
  burst(x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max * 2) this.list.shift();
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI;
      const sp = (o.speed || 3) * (0.4 + Math.random() * 0.8);
      const col = o.colors[Math.floor(Math.random() * o.colors.length)];
      this.list.push({
        x, y, z, vx: Math.cos(a) * Math.cos(e) * sp + (o.dir || 0) * sp * 0.6, vy: Math.sin(e) * sp + (o.up || 0), vz: Math.sin(a) * Math.cos(e) * sp * 0.5,
        life: o.life * (0.6 + Math.random() * 0.6), max: o.life, size: o.size * (0.6 + Math.random() * 0.8),
        r: col[0], g: col[1], b: col[2], glow: o.glow !== false, grav: o.grav ?? 9, drag: o.drag ?? 1.5, grow: o.grow || 0,
      });
    }
  }
  update(dt) {
    let i1 = 0, i2 = 0;
    const alive = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.grav * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01) { p.y = 0.01; p.vy *= -0.2; p.vx *= 0.5; }
      p.size += p.grow * dt;
      alive.push(p);
      const a = Math.min(1, p.life / p.max * 1.6);
      if (p.glow && i1 < this.max) {
        this.pos.set([p.x, p.y, p.z], i1 * 3); this.col.set([p.r, p.g, p.b, a], i1 * 4); this.size[i1] = p.size; i1++;
      } else if (!p.glow && i2 < this.max) {
        this.pos2.set([p.x, p.y, p.z], i2 * 3); this.col2.set([p.r, p.g, p.b, a], i2 * 4); this.size2[i2] = p.size; i2++;
      }
    }
    this.list = alive;
    const g1 = this.points.geometry, g2 = this.points2.geometry;
    g1.setDrawRange(0, i1); g2.setDrawRange(0, i2);
    for (const n of ["position", "pcolor", "size"]) { g1.attributes[n].needsUpdate = true; g2.attributes[n].needsUpdate = true; }
  }
}

// ---------- the renderer ----------
export class Arena {
  constructor(canvas) {
    const lowEnd = /iPhone|Android/.test(navigator.userAgent) && Math.min(screen.width, screen.height) < 400;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowEnd, powerPreference: "high-performance" });
    this.maxRatio = lowEnd ? 1.5 : 2;
    this.quality = 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 80);
    this.camera.position.set(0, 1.4, 6);
    this.particles = new Particles(this.scene);
    this.fighters = [];
    this.proj = new Map();   // sim projectile id -> mesh
    this.debris = [];        // chairs and items lying around after impact (render only)
    this.shake = 0;
    this.zoom = 0; this.zoomTarget = null;
    this.kickX = 0; this.kickZ = 0; this.kickV = [0, 0]; this.fovKick = 0;
    this.impacts = [];
    this.ringTex = ringTexture(); this.burstTex = burstTexture();
    this.camX = 0; this.camZ = 6;
    this.stageGroup = new THREE.Group();
    this.scene.add(this.stageGroup);
    this.time = 0;
    texLoader.load("img/monogram.webp", (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.5); setBagTexture(t); });
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  // 2: full, 1: fewer pixels, 0: fewer pixels and no shadows
  setQuality(level) {
    if (level === this.quality) return;
    this.quality = level;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, level === 2 ? this.maxRatio : level === 1 ? 1.25 : 1));
    if (this.key) this.key.castShadow = level > 0;
    this.resize();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  async setStage(idx) {
    const st = STAGES[idx % STAGES.length];
    this.stage = st;
    const g = this.stageGroup;
    while (g.children.length) g.remove(g.children[0]);
    this.scene.background = new THREE.Color(st.sky);
    this.scene.fog = new THREE.Fog(st.fog, 14, 34);
    const tex = await texLoader.loadAsync(st.img);
    tex.colorSpace = THREE.SRGBColorSpace;
    // backdrop: a wide, slightly curved wall far behind the fighters
    const W = 30, H = W * tex.image.height / tex.image.width;
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(22, 22, H, 48, 1, true, Math.PI - 0.7, 1.4),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false }),
    );
    back.position.set(0, H / 2 - H * (st.horizon || 0.5) + 1.7, 13.5);
    back.scale.x = -1;
    g.add(back);
    // floor: the bottom strip of the picture, continued toward the camera
    const fc = document.createElement("canvas"); fc.width = 512; fc.height = 256;
    const fx = fc.getContext("2d");
    const img = tex.image;
    fx.drawImage(img, 0, img.height * 0.86, img.width, img.height * 0.14, 0, 0, 512, 256);
    const ftex = new THREE.CanvasTexture(fc);
    ftex.colorSpace = THREE.SRGBColorSpace;
    ftex.wrapS = THREE.MirroredRepeatWrapping; ftex.wrapT = THREE.MirroredRepeatWrapping;
    ftex.repeat.set(3, 2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 26),
      new THREE.MeshStandardMaterial({ map: ftex, color: 0x9a9a9a, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.5 }),
    );
    floor.rotation.x = -Math.PI / 2; floor.position.z = -3;
    floor.receiveShadow = true;
    g.add(floor);
    // the ring of light on the floor where they fight
    const glowC = document.createElement("canvas"); glowC.width = glowC.height = 128;
    const gx = glowC.getContext("2d");
    const rg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, "rgba(255,255,255,0.35)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    gx.fillStyle = rg; gx.fillRect(0, 0, 128, 128);
    const spot = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, depthWrite: false, color: st.key, blending: THREE.AdditiveBlending }));
    spot.rotation.x = -Math.PI / 2; spot.position.y = 0.01;
    g.add(spot);
    // props on stage: stacks of Keter chairs
    const stacks = [[-6.2, -3.2, 5], [6.4, -3.6, 4], [-8.5, -6, 6], [8.8, -5.5, 3]];
    for (const [x, z, n] of stacks) {
      for (let i = 0; i < n; i++) {
        const c = makeChair();
        c.position.set(x + (i % 2) * 0.01, i * 0.12, z);
        c.rotation.y = 0.4 * Math.sign(-x);
        g.add(c);
      }
    }
    const ch = makeChair(); ch.position.set(-4.8, 0, -1.6); ch.rotation.set(0, 0.9, 0); g.add(ch);
    const ch2 = makeChair(); ch2.position.set(5.0, 0.22, -1.2); ch2.rotation.set(1.45, -0.6, 0.2); g.add(ch2);
    // lights
    g.add(new THREE.HemisphereLight(0xffffff, st.floor, 0.55));
    const key = new THREE.DirectionalLight(0xfff2e0, 2.8);
    key.position.set(2.5, 7, 6); key.castShadow = this.quality > 0;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 5, bottom: -1, near: 1, far: 20 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    g.add(key); g.add(key.target);
    this.key = key;
    const rim = new THREE.DirectionalLight(st.rim, 3.4); rim.position.set(-4, 3, -5); g.add(rim);
    const rim2 = new THREE.DirectionalLight(st.key, 2.4); rim2.position.set(5, 2.5, -4); g.add(rim2);
  }

  async setFighters(ch0, ch1) {
    await loadPack();
    for (const f of this.fighters) { this.scene.remove(f.root); for (const pr of Object.values(f.props)) this.scene.remove(pr); if (f.trail) f.trail.dispose(this.scene); }
    this.fighters = [];
    const [g0, g1] = await Promise.all([loadFighterModel(CHARS[ch0].id), loadFighterModel(CHARS[ch1].id)]);
    this.fighters = [new Fighter3D(g0, ch0, 0, false), new Fighter3D(g1, ch1, 1, ch0 === ch1)];
    for (const f of this.fighters) { this.scene.add(f.root); f.trail = new Trail(this.scene, CHARS[f.ch].color); }
    this.clearProjectiles();
  }

  clearProjectiles() {
    for (const m of this.proj.values()) this.scene.remove(m);
    this.proj.clear();
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.debris = [];
  }

  projectileMesh(q) {
    let m = this.proj.get(q.id);
    if (m) return m;
    if (q.t === "blush" || q.t === "cloud") {
      m = new THREE.Group();
      m.userData.cloud = true;
    } else {
      m = makeProp(q.t === "chair" ? "chair" : q.t);
      if (q.t === "chair") m.scale.setScalar(1.15);
    }
    m.userData.type = q.t;
    this.scene.add(m);
    this.proj.set(q.id, m);
    return m;
  }

  hit(i, big) { const f = this.fighters[i]; if (f) { f.flash = big ? 0.45 : 0.3; f.kick(big ? 1.4 : 0.9); f.shake = 1; } }
  blocked(i) { const f = this.fighters[i]; if (f) f.kick(0.45); }
  addShake(n) { this.shake = Math.max(this.shake, n); }

  // The moment a hit lands: a white starburst and a shockwave ring where it
  // connects, the camera jolts toward the hit and springs back, the lens punches in.
  // power: about 0.5 for a jab, 1 for a heavy hit, 2 for the chair
  impact(x, y, dir, power, color = 0xffffff) {
    const add = (tex, size, life, spin, col, grow) => {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
      m.position.set(x + dir * 0.05, y, 0.4);
      m.material.rotation = Math.random() * Math.PI * 2;
      m.scale.setScalar(size);
      m.renderOrder = 10;
      this.scene.add(m);
      this.impacts.push({ m, life, max: life, size, spin, grow });
    };
    add(this.burstTex, 0.22 + 0.14 * power, 0.07 + 0.02 * power, 0, 0xffffff, 0.4);
    add(this.burstTex, 0.18 + 0.1 * power, 0.09, 5, color, 0.8);
    add(this.ringTex, 0.1, 0.13 + 0.03 * power, 0, color, 3 + 2 * power);
    if (power >= 1) add(this.ringTex, 0.12, 0.2, 0, 0xffffff, 5 + 2 * power);
    this.kickV[0] += dir * 0.9 * power;
    this.kickV[1] -= 2.2 * power;
    this.fovKick = Math.min(4, this.fovKick + 1.4 * power);
    this.shake = Math.max(this.shake, 0.22 + 0.32 * power);
  }

  // a smaller jolt for a blocked hit: sparks against the guard, no lens punch
  guardImpact(x, y, dir) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ringTex, color: 0x8ac8ff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, 0.4); m.scale.setScalar(0.25); m.renderOrder = 10;
    this.scene.add(m);
    this.impacts.push({ m, life: 0.16, max: 0.16, size: 0.25, spin: 0, grow: 4 });
    this.kickV[0] += dir * 0.35;
    this.shake = Math.max(this.shake, 0.18);
  }

  // spill an item on the floor after it hits (render only)
  dropDebris(type, x, y, dir) {
    if (type === "blush" || type === "cloud") return;
    const mesh = makeProp(type);
    if (!mesh) return;
    if (type === "chair") mesh.scale.setScalar(1.15);
    mesh.position.set(x, y, 0.2);
    this.scene.add(mesh);
    this.debris.push({ mesh, vx: -dir * (1 + Math.random()), vy: 2.5, vz: (Math.random() - 0.5) * 2, rx: Math.random() * 8, rz: Math.random() * 8, life: 6 });
    while (this.debris.length > 10) { const d = this.debris.shift(); this.scene.remove(d.mesh); }
  }

  rainChairs(x) {
    for (let i = 0; i < 26; i++) {
      const mesh = makeChair();
      mesh.position.set(x + (Math.random() - 0.5) * 2.6, 6 + i * 0.55, (Math.random() - 0.5) * 1.6);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.scene.add(mesh);
      this.debris.push({ mesh, vx: (Math.random() - 0.5) * 0.6, vy: -2, vz: 0, rx: (Math.random() - 0.5) * 6, rz: (Math.random() - 0.5) * 6, life: 14, rain: 1 });
    }
    while (this.debris.length > 40) { const d = this.debris.shift(); this.scene.remove(d.mesh); }
  }

  // s: sim state, dt: seconds since last draw, focus: {x, y, k} camera punch-in
  // prev: a snapshot of the sim one frame earlier (snapshot()), alpha: 0..1 between them
  draw(s, dt, prev = null, alpha = 1) {
    this.time += dt;
    const frame = s.f - 1 + alpha;
    const [a, b] = s.p;
    for (let i = 0; i < 2; i++) if (this.fighters[i]) this.fighters[i].update(s.p[i], prev && prev.p[i], alpha, frame, dt, s.hs);
    const prevPr = prev ? prev.pr : null;

    // projectiles
    const seen = new Set();
    for (const q of s.pr) {
      seen.add(q.id);
      const m = this.projectileMesh(q);
      const o = prevPr && prevPr.get(q.id);
      const qx = o ? o.x + (q.x - o.x) * alpha : q.x, qy = o ? o.y + (q.y - o.y) * alpha : q.y;
      m.position.set(qx / 1000, qy / 1000, 0.15);
      const t = q.age - 1 + alpha;
      if (q.t === "chair") m.rotation.set(t * 0.12, 0, t * 0.25 * Math.sign(q.vx || 1));
      else if (q.t === "phone") m.rotation.set(t * 0.5, t * 0.3, t * 0.7);
      else if (q.t === "bag") m.rotation.set(0, t * 0.15, t * 0.35 * -Math.sign(q.vx));
      else if (!m.userData.cloud) m.rotation.set(t * 0.4, t * 0.2, t * 0.6);
      if (m.userData.cloud && (frame + q.id) % 2 === 0) {
        const pink = q.t === "blush";
        this.particles.burst(q.x / 1000, q.y / 1000, 0.15, pink ? 3 : 4, {
          colors: pink ? [[1, 0.45, 0.6], [1, 0.6, 0.75], [0.95, 0.3, 0.5]] : [[0.85, 0.85, 0.9], [0.7, 0.72, 0.8]],
          life: pink ? 0.5 : 1.2, size: pink ? 0.35 : 0.7, speed: pink ? 0.6 : 0.5, grav: -0.3, drag: 2, glow: pink, grow: 0.6,
        });
      }
    }
    for (const [id, m] of this.proj) if (!seen.has(id)) { this.scene.remove(m); this.proj.delete(id); }

    // debris
    for (const d of this.debris) {
      d.life -= dt;
      d.vy -= 9.8 * dt;
      d.mesh.position.x += d.vx * dt; d.mesh.position.y += d.vy * dt; d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += d.rx * dt; d.mesh.rotation.z += d.rz * dt;
      if (d.mesh.position.y < 0.05) { d.mesh.position.y = 0.05; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; d.rx *= 0.5; d.rz *= 0.5; if (Math.abs(d.vy) < 0.4) { d.vy = 0; d.rx = 0; d.rz = 0; } }
    }

    this.particles.update(dt);

    for (const im of this.impacts) {
      im.life -= dt;
      const k = 1 - Math.max(0, im.life) / im.max;
      im.m.scale.setScalar(im.size * (1 + im.grow * k));
      im.m.material.opacity = 0.9 * Math.max(0, 1 - k * k);
      im.m.material.rotation += im.spin * dt;
      if (im.life <= 0) { this.scene.remove(im.m); im.m.material.dispose(); }
    }
    this.impacts = this.impacts.filter((im) => im.life > 0);

    // camera jolt on a spring
    const springK = 220, damp = 16;
    this.kickV[0] += (-springK * this.kickX - damp * this.kickV[0]) * dt;
    this.kickV[1] += (-springK * this.kickZ - damp * this.kickV[1]) * dt;
    this.kickX += this.kickV[0] * dt; this.kickZ += this.kickV[1] * dt;
    this.fovKick = Math.max(0, this.fovKick - dt * 14);
    const fov = 30 - this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    // camera: frame both fighters, lean in on the action
    const ax = this.fighters[0] ? this.fighters[0].root.position.x : a.x / 1000, bx = this.fighters[1] ? this.fighters[1].root.position.x : b.x / 1000;
    const mid = (ax + bx) / 2;
    const gap = Math.abs(ax - bx);
    const aspect = this.camera.aspect;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const wantW = Math.max(4.4, gap + 2.8);
    const fitW = wantW / (2 * Math.tan(vfov / 2) * Math.max(0.6, aspect));
    const fitH = 2.7 / (2 * Math.tan(vfov / 2));
    let dist = Math.max(fitW, fitH);
    let tx = mid, ty = 1.05 + Math.max(a.y, b.y) / 3000;
    if (this.zoomTarget) {
      const z = this.zoomTarget;
      dist = dist * (1 - 0.42 * z.k);
      tx = tx + (z.x - tx) * z.k; ty = ty + (z.y - ty) * z.k;
    }
    this.camX += (tx - this.camX) * Math.min(1, dt * 6);
    this.camZ += (dist - this.camZ) * Math.min(1, dt * 4);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake;
    const jx = (Math.random() - 0.5) * 0.25 * sh, jy = (Math.random() - 0.5) * 0.2 * sh;
    this.camera.position.set(this.camX + jx + this.kickX, ty + 0.38 + jy, this.camZ + this.kickZ);
    this.camera.lookAt(this.camX + this.kickX * 0.5, ty, 0);
    if (this.key) { this.key.position.set(this.camX + 2.5, 7, 6); this.key.target.position.set(this.camX, 0, 0); }

    this.renderer.render(this.scene, this.camera);
  }

  // world position of a sim point, projected to screen pixels (for HUD effects)
  toScreen(xMm, yMm) {
    const v = new THREE.Vector3(xMm / 1000, yMm / 1000, 0).project(this.camera);
    const c = this.renderer.domElement;
    return [(v.x + 1) / 2 * c.clientWidth, (1 - v.y) / 2 * c.clientHeight];
  }
}

// What the view needs from the previous simulation frame to draw in between
export function snapshot(s) {
  return {
    f: s.f,
    p: s.p.map((q) => ({ st: q.st, mv: q.mv, sf: q.sf, x: q.x, y: q.y })),
    pr: new Map(s.pr.map((q) => [q.id, { x: q.x, y: q.y }])),
  };
}

// A lone fighter turning on a pedestal, for the character select screen.
export class Showcase {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x302040, 1.2));
    const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(2, 4, 5); this.scene.add(k);
    const r = new THREE.DirectionalLight(0xff66cc, 2.4); r.position.set(-3, 2, -3); this.scene.add(r);
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
    this.camera.position.set(0, 1.0, 4.4);
    this.camera.lookAt(0, 0.88, 0);
    this.slot = new THREE.Group();
    this.scene.add(this.slot);
    this.models = new Map();
    this.current = -1;
    this.t = 0;
  }
  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  async show(ch) {
    this.current = ch;
    await loadPack();
    if (!this.models.has(ch)) {
      const g = await loadFighterModel(CHARS[ch].id);
      const model = cloneSkinned(g.scene);
      model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = o.material.clone(); o.material.roughness = 0.7; o.material.metalness = 0; } });
      const clips = buildClips(pack, model);
      const mixer = new THREE.AnimationMixer(model);
      const act = mixer.clipAction(clips.stance); act.play();
      this.models.set(ch, { model, mixer });
    }
    if (this.current !== ch) return;
    while (this.slot.children.length) this.slot.remove(this.slot.children[0]);
    this.slot.add(this.models.get(ch).model);
    this.t = 0;
  }
  draw(dt) {
    this.t += dt;
    const m = this.models.get(this.current);
    if (m) { m.mixer.update(dt); this.slot.rotation.y = 0.5 + Math.sin(this.t * 0.6) * 0.6; }
    this.renderer.render(this.scene, this.camera);
  }
}
