// Loads the generated models (assets/models), the shared animation clips (assets/anim)
// and retargets every clip onto every character skeleton.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export const CLIP_NAMES = ['idle', 'walk', 'run', 'jab', 'hook', 'kick', 'hit', 'knockdown', 'standup', 'sit', 'talk', 'jump', 'guard', 'dance'];
const LOOPING = { idle: 1, walk: 1, run: 1, sit: 1, talk: 1, guard: 1, dance: 1 };

export class Assets {
  constructor() {
    this.models = {};     // static/vehicle models: { scene, geometry, material, matrix, size, len, minY }
    this.chars = {};      // rigged characters: { scene, height, clips:{} }
    this.clipSrc = {};    // source skeleton + clip per animation
    this.failed = [];
  }

  async gltf(url) {
    try { return await loader.loadAsync(url); }
    catch (e) { console.warn('model failed', url, e && e.message); this.failed.push(url); return null; }
  }

  async load(list, onProgress) {
    let done = 0;
    const tick = () => { done++; if (onProgress) onProgress(done / list.length); };
    await Promise.all(list.map(async (it) => {
      if (it.type === 'model') await this.loadModel(it.name, it.url);
      else if (it.type === 'char') await this.loadChar(it.name, it.url, it);
      else if (it.type === 'clip') await this.loadClip(it.name, it.url);
      tick();
    }));
    this.retargetAll();
  }

  async loadModel(name, url) {
    const g = await this.gltf(url);
    if (!g) return;
    const scene = g.scene; scene.updateMatrixWorld(true);
    let mesh = null;
    scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return;
    // Bounding box in model space, respecting quantised attributes.
    const box = new THREE.Box3(), v = new THREE.Vector3(), pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
    const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        const m = o.material; if (m.map) m.map.anisotropy = 4;
        m.envMapIntensity = 1;
      }
    });
    // Geometry recentred on the footprint so callers can place it by its middle.
    const matrix = new THREE.Matrix4().makeTranslation(-centre.x, 0, -centre.z).multiply(mesh.matrixWorld);
    this.models[name] = {
      scene, mesh, geometry: mesh.geometry, material: mesh.material, matrix, size, centre,
      len: Math.max(size.x, size.z), minY: box.min.y, longX: size.x > size.z,
    };
  }

  async loadChar(name, url, opt) {
    const g = await this.gltf(url);
    if (!g) return;
    const scene = g.scene; scene.updateMatrixWorld(true);
    let skinned = null;
    scene.traverse((o) => {
      if (o.isSkinnedMesh) { skinned = o; o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
      if (o.isMesh && o.material) { o.material.roughness = 0.9; o.material.metalness = 0; o.material.envMapIntensity = 0.6; }
    });
    if (!skinned) { console.warn('no skin in', name); return; }
    const box = new THREE.Box3().setFromObject(scene);
    this.chars[name] = { scene, skinned, height: box.max.y - box.min.y, minY: box.min.y, clips: {}, opt: opt || {} };
  }

  async loadClip(name, url) {
    const g = await this.gltf(url);
    if (!g || !g.animations.length) return;
    this.clipSrc[name] = { scene: g.scene, clip: g.animations[g.animations.length - 1] };
  }

  instance(charName) {
    const c = this.chars[charName];
    if (!c) return null;
    const obj = SkeletonUtils.clone(c.scene);
    obj.traverse((o) => { if (o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; } });
    return obj;
  }

  // World-space retarget: the delta each source bone makes from its rest pose is replayed on the
  // target's rest pose. Works because every rig here is the same 24-bone humanoid bound in an A-pose.
  retargetAll() {
    const FPS = 30;
    const names = Object.keys(this.clipSrc);
    if (!names.length) return;
    const q = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const Y = new THREE.Quaternion(), Yi = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
    // Which way a rig faces, from its hip joints: forward = up × (left hip → right hip).
    const facing = (bones) => {
      const l = bones.LeftUpLeg, r = bones.RightUpLeg;
      if (!l || !r) return 0;
      const lr = r.getWorldPosition(new THREE.Vector3()).sub(l.getWorldPosition(new THREE.Vector3()));
      const f = new THREE.Vector3().crossVectors(UP, lr);
      return Math.atan2(f.x, f.z);
    };
    const bonesOf = (root) => { const m = {}; root.traverse((o) => { if (o.isBone) m[o.name] = o; }); return m; };
    const restOf = (bones) => {
      const r = {};
      for (const k in bones) { const b = bones[k]; r[k] = { local: b.quaternion.clone(), world: b.getWorldQuaternion(new THREE.Quaternion()), pos: b.position.clone() }; }
      return r;
    };
    for (const cn of Object.keys(this.chars)) {
      const ch = this.chars[cn];
      ch.scene.updateMatrixWorld(true);
      const tBones = bonesOf(ch.scene), tRest = restOf(tBones);
      const tHips = tBones.Hips;
      const order = []; ch.scene.traverse((o) => { if (o.isBone) order.push(o.name); });   // parents first
      const tHipsWorldY = tHips ? tHips.getWorldPosition(new THREE.Vector3()).y : 1;
      const rootScale = tHips && tHips.parent ? tHips.parent.getWorldScale(new THREE.Vector3()).y : 1;
      const tParentQ = tHips && tHips.parent ? tHips.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
      const tParentQi = tParentQ.clone().invert();
      ch.faceYaw = facing(tBones);
      for (const an of names) {
        const src = this.clipSrc[an];
        src.scene.updateMatrixWorld(true);
        if (!src.bones) {
          src.bones = {}; src.scene.traverse((o) => { if (o.name && tBones[o.name]) src.bones[o.name] = o; }); src.rest = restOf(src.bones);
          src.hipsY = src.bones.Hips ? src.bones.Hips.getWorldPosition(new THREE.Vector3()).y : 1;
          src.hipsRest = src.bones.Hips ? src.bones.Hips.position.clone() : new THREE.Vector3();
          src.parentScale = src.bones.Hips && src.bones.Hips.parent ? src.bones.Hips.parent.getWorldScale(new THREE.Vector3()).y : 1;
          src.parentQ = src.bones.Hips && src.bones.Hips.parent ? src.bones.Hips.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
          src.faceYaw = facing(src.bones);
          src.mixer = new THREE.AnimationMixer(src.scene);
          src.action = src.mixer.clipAction(src.clip); src.action.play();
        }
        const dur = src.clip.duration, n = Math.max(2, Math.round(dur * FPS) + 1);
        const times = new Float32Array(n);
        const tracks = {}, world = {};
        for (const bn of order) if (src.bones[bn]) tracks[bn] = new Float32Array(n * 4);
        const hipPos = new Float32Array(n * 3);
        const hp = new THREE.Vector3();
        const ratio = tHipsWorldY / src.hipsY;
        Y.setFromAxisAngle(UP, ch.faceYaw - src.faceYaw); Yi.copy(Y).invert();
        for (let f = 0; f < n; f++) {
          const t = Math.min(dur - 1e-4, (f / (n - 1)) * dur); times[f] = (f / (n - 1)) * dur;
          src.mixer.setTime(t); src.scene.updateMatrixWorld(true);
          for (const bn of order) {
            const sb = src.bones[bn]; if (!sb) continue;
            sb.getWorldQuaternion(q);
            // world delta from rest, applied to the target's rest orientation
            qa.copy(src.rest[bn].world).invert(); q.multiply(qa);
            q.premultiply(Y).multiply(Yi).multiply(tRest[bn].world);
            world[bn] = (world[bn] || new THREE.Quaternion()).copy(q);
            const parent = tBones[bn].parent;
            if (parent && parent.isBone && world[parent.name]) qb.copy(world[parent.name]).invert().multiply(q);
            else if (parent) { parent.getWorldQuaternion(qb).invert().multiply(q); }
            else qb.copy(q);
            const arr = tracks[bn]; arr[f * 4] = qb.x; arr[f * 4 + 1] = qb.y; arr[f * 4 + 2] = qb.z; arr[f * 4 + 3] = qb.w;
          }
          if (src.bones.Hips && tHips) {
            // hips travel, scaled by leg length; horizontal root motion is removed (the game moves the character)
            const keepXZ = (an === 'knockdown' || an === 'standup' || an === 'hit' || an === 'jab' || an === 'hook' || an === 'kick' || an === 'dance') ? 1 : 0;
            hp.copy(src.bones.Hips.position).sub(src.hipsRest).applyQuaternion(src.parentQ).multiplyScalar(src.parentScale * ratio);
            hp.applyQuaternion(Y); hp.x *= keepXZ; hp.z *= keepXZ;
            hp.applyQuaternion(tParentQi).divideScalar(rootScale);
            hipPos[f * 3] = tRest.Hips.pos.x + hp.x; hipPos[f * 3 + 1] = tRest.Hips.pos.y + hp.y; hipPos[f * 3 + 2] = tRest.Hips.pos.z + hp.z;
          }
        }
        const kf = [];
        for (const bn of Object.keys(tracks)) kf.push(new THREE.QuaternionKeyframeTrack(bn + '.quaternion', times, tracks[bn]));
        if (tHips && src.bones.Hips) kf.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipPos));
        const clip = new THREE.AnimationClip(an, dur, kf);
        clip.userData = { loop: !!LOOPING[an] };
        ch.clips[an] = clip;
      }
    }
    for (const an of names) { const s = this.clipSrc[an]; if (s.mixer) { s.mixer.stopAllAction(); s.mixer = null; } }
  }
}
