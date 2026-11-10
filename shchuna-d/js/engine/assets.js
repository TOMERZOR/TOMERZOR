// Loads the generated models (assets/models), the shared animation clips (assets/anim)
// and retargets every clip onto every character skeleton.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export const CLIP_NAMES = ['idle', 'walk', 'run', 'jab', 'hook', 'kick', 'hit', 'knockdown', 'standup', 'sit', 'talk', 'jump', 'guard', 'dance'];
const LOOPING = { idle: 1, walk: 1, run: 1, sit: 1, talk: 1, guard: 1, dance: 1 };
// Some generated clips start turned away from where the character is heading; degrees to turn them back.
const TURN = { jump: 40, talk: 16, hit: 28 };

export class Assets {
  constructor() {
    this.models = {};     // static/vehicle models: { scene, geometry, material, matrix, size, len, minY }
    this.chars = {};      // rigged characters: { scene, height, clips:{} }
    this.clipSrc = {};    // source skeleton + clip per animation
    this.failed = [];
  }

  // Textures ship GPU-compressed (KTX2): they stay compressed in video memory, which is what lets a
  // phone hold the whole town at full resolution.
  useKTX2(renderer) {
    const k = new KTX2Loader().setTranscoderPath(new URL('../../vendor/addons/libs/basis/', import.meta.url).href).detectSupport(renderer);
    loader.setKTX2Loader(k);
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
        this.capTexture(m, /^b_shops/.test(name) ? this.texCap * 2 : this.texCap);
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

  // On a phone the whole town's textures at full size do not fit the memory a web view is given.
  // Each map is redrawn at most `cap` pixels wide and the original bitmap is released.
  capTexture(mat, cap) {
    const t = mat && mat.map, img = t && t.image;
    if (!cap || !img || t.isCompressedTexture || Math.max(img.width, img.height) <= cap) return;
    const k = cap / Math.max(img.width, img.height), cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, cv.width, cv.height);
    if (img.close) img.close();
    t.image = cv; t.needsUpdate = true;
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

  // Standing still, built from the bind pose: arms lowered out of the A-pose, slow breathing, the head
  // drifting a little. (The generated "idle" is a fighter's split stance turned 43 degrees off the heading
  // that looks back over its shoulder, so everybody twisted aside whenever they stopped walking.)
  standClip(order, bones, bindQ, bindP, parentQi, hipsRest, faceYaw) {
    const dur = 6, n = 61, times = new Float32Array(n), tracks = {}, hip = new Float32Array(n * 3);
    const U = new THREE.Vector3(0, 1, 0), F = new THREE.Vector3(Math.sin(faceYaw), 0, Math.cos(faceYaw));
    const Lv = bindP.LeftArm.clone().sub(bindP.RightArm).setY(0).normalize();        // the model's own left
    const rest = {};
    for (const [side, sg] of [['Left', 1], ['Right', -1]]) {
      const arm = side + 'Arm', fore = side + 'ForeArm';
      if (!bindP[arm] || !bindP[fore]) continue;
      const hang = U.clone().multiplyScalar(-Math.cos(0.15)).addScaledVector(Lv, sg * Math.sin(0.15)).addScaledVector(F, 0.03).normalize();
      rest[arm] = new THREE.Quaternion().setFromUnitVectors(bindP[fore].clone().sub(bindP[arm]).normalize(), hang);
      rest[fore] = new THREE.Quaternion().setFromAxisAngle(Lv, 0.2);                 // elbows a little bent
    }
    for (const bn of order) tracks[bn] = new Float32Array(n * 4);
    const D = {}, world = {}, e = new THREE.Quaternion(), q = new THREE.Quaternion(), ID = new THREE.Quaternion();
    for (let f = 0; f < n; f++) {
      const t = f / (n - 1), breath = Math.sin(t * Math.PI * 4), sway = Math.sin(t * Math.PI * 2);
      times[f] = t * dur;
      const live = { Spine02: [F, 0.008 * sway], Spine01: [Lv, 0.013 * breath], neck: [Lv, -0.009 * breath], Head: [U, 0.05 * Math.sin(t * Math.PI * 2 + 1)] };
      for (const bn of order) {
        const parent = bones[bn].parent, pn = parent && parent.isBone && D[parent.name] ? parent.name : null;
        const d = (D[bn] || (D[bn] = new THREE.Quaternion())).copy(pn ? D[pn] : ID);
        if (rest[bn]) d.premultiply(rest[bn]);
        if (live[bn]) d.premultiply(e.setFromAxisAngle(live[bn][0], live[bn][1]));
        const w = (world[bn] || (world[bn] = new THREE.Quaternion())).copy(d).multiply(bindQ[bn]);
        if (pn) q.copy(world[pn]).invert().multiply(w); else q.copy(parentQi).multiply(w);
        const arr = tracks[bn]; arr[f * 4] = q.x; arr[f * 4 + 1] = q.y; arr[f * 4 + 2] = q.z; arr[f * 4 + 3] = q.w;
      }
      hip[f * 3] = hipsRest.x; hip[f * 3 + 1] = hipsRest.y; hip[f * 3 + 2] = hipsRest.z;
    }
    const kf = Object.keys(tracks).map((bn) => new THREE.QuaternionKeyframeTrack(bn + '.quaternion', times, tracks[bn]));
    kf.push(new THREE.VectorKeyframeTrack('Hips.position', times, hip));
    const clip = new THREE.AnimationClip('idle', dur, kf);
    clip.userData = { loop: true };
    return clip;
  }

  // World-space retarget. Every rig here is the same 24-bone humanoid bound in an A-pose, but each
  // was rigged separately and faces its own way, so for every frame the rotation a source bone has
  // made away from its BIND pose (in world space, turned to the target's facing) is replayed on the
  // target bone's bind pose. Bind poses come from the inverse bind matrices, never from node transforms.
  retargetAll() {
    const FPS = 30, names = Object.keys(this.clipSrc);
    if (!names.length) return;
    const q = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const Y = new THREE.Quaternion(), Yi = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
    const facing = (L, R) => { const f = new THREE.Vector3().crossVectors(UP, R.clone().sub(L)); return Math.atan2(f.x, f.z); };
    const keepXZ = { knockdown: 1, standup: 1, hit: 1, jab: 1, hook: 1, kick: 1, dance: 1 };

    // source skeletons: bind pose was stored in userData by tools/build-assets.mjs
    for (const an of names) {
      const src = this.clipSrc[an]; src.scene.updateMatrixWorld(true);
      src.bones = {}; src.bindQ = {}; src.bindP = {};
      src.scene.traverse((o) => { if (o.userData && o.userData.bq) { src.bones[o.name] = o; src.bindQ[o.name] = new THREE.Quaternion().fromArray(o.userData.bq); src.bindP[o.name] = new THREE.Vector3().fromArray(o.userData.bp); } });
      const hips = src.bones.Hips; src.ok = !!(hips && src.bones.LeftUpLeg && src.bones.RightUpLeg);
      if (!src.ok) { console.warn('clip without bind data', an); continue; }
      src.parentInv = new THREE.Matrix4().copy(hips.parent.matrixWorld).invert();
      src.parentQ = hips.parent.getWorldQuaternion(new THREE.Quaternion());
      src.parentScale = hips.parent.getWorldScale(new THREE.Vector3()).y;
      src.hipsRest = src.bindP.Hips.clone().applyMatrix4(src.parentInv);        // hips bind position, parent-local
      src.hipsY = src.bindP.Hips.y;
      src.faceYaw = facing(src.bindP.LeftUpLeg, src.bindP.RightUpLeg);
      src.mixer = new THREE.AnimationMixer(src.scene); src.mixer.clipAction(src.clip).play();
    }

    for (const cn of Object.keys(this.chars)) {
      const ch = this.chars[cn]; ch.scene.updateMatrixWorld(true);
      const tBones = {}, tBindQ = {}, tBindP = {};
      ch.scene.traverse((o) => {
        if (!o.isBone || !o.userData || !o.userData.bq) return;
        tBones[o.name] = o; tBindQ[o.name] = new THREE.Quaternion().fromArray(o.userData.bq); tBindP[o.name] = new THREE.Vector3().fromArray(o.userData.bp);
      });
      const tHips = tBones.Hips;
      if (!tHips || !tBindP.LeftUpLeg) { console.warn('unexpected skeleton', cn); continue; }
      const order = []; ch.scene.traverse((o) => { if (o.isBone && tBones[o.name]) order.push(o.name); });      // parents first
      const tParentInv = new THREE.Matrix4().copy(tHips.parent.matrixWorld).invert();
      const tParentQi = tHips.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const rootScale = tHips.parent.getWorldScale(new THREE.Vector3()).y;
      const tHipsRest = tBindP.Hips.clone().applyMatrix4(tParentInv);
      ch.faceYaw = facing(tBindP.LeftUpLeg, tBindP.RightUpLeg);
      // the model's lowest point in its bind pose, for standing it on the ground
      for (const an of names) {
        const src = this.clipSrc[an]; if (!src.ok) continue;
        const dur = src.clip.duration, n = Math.max(2, Math.round(dur * FPS) + 1);
        const times = new Float32Array(n), tracks = {}, world = {};
        for (const bn of order) if (src.bones[bn]) tracks[bn] = new Float32Array(n * 4);
        const hipPos = new Float32Array(n * 3), hp = new THREE.Vector3();
        const ratio = tBindP.Hips.y / src.hipsY, keep = keepXZ[an] ? 1 : 0;
        Y.setFromAxisAngle(UP, ch.faceYaw - src.faceYaw); Yi.copy(Y).invert();
        const turn = TURN[an] ? new THREE.Quaternion().setFromAxisAngle(UP, TURN[an] * Math.PI / 180) : null;
        for (let f = 0; f < n; f++) {
          times[f] = (f / (n - 1)) * dur;
          src.mixer.setTime(Math.min(dur - 1e-4, times[f])); src.scene.updateMatrixWorld(true);
          for (const bn of order) {
            const sb = src.bones[bn]; if (!sb) continue;
            sb.getWorldQuaternion(q);
            qa.copy(src.bindQ[bn]).invert(); q.multiply(qa);                 // world delta from bind
            q.premultiply(Y).multiply(Yi).multiply(tBindQ[bn]);              // turned to the target, applied to its bind
            if (turn) q.premultiply(turn);
            (world[bn] || (world[bn] = new THREE.Quaternion())).copy(q);
            const parent = tBones[bn].parent;
            if (parent && parent.isBone && world[parent.name]) qb.copy(world[parent.name]).invert().multiply(q);
            else qb.copy(tParentQi).multiply(q);
            const arr = tracks[bn]; arr[f * 4] = qb.x; arr[f * 4 + 1] = qb.y; arr[f * 4 + 2] = qb.z; arr[f * 4 + 3] = qb.w;
          }
          // hips travel in metres, scaled by leg length; sideways root motion only where the move needs it
          hp.copy(src.bones.Hips.position).sub(src.hipsRest).applyQuaternion(src.parentQ).multiplyScalar(src.parentScale * ratio);
          hp.applyQuaternion(Y); if (turn) hp.applyQuaternion(turn); hp.x *= keep; hp.z *= keep;
          hp.applyQuaternion(tParentQi).divideScalar(rootScale);
          hipPos[f * 3] = tHipsRest.x + hp.x; hipPos[f * 3 + 1] = tHipsRest.y + hp.y; hipPos[f * 3 + 2] = tHipsRest.z + hp.z;
        }
        const kf = [];
        for (const bn of Object.keys(tracks)) kf.push(new THREE.QuaternionKeyframeTrack(bn + '.quaternion', times, tracks[bn]));
        kf.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipPos));
        const clip = new THREE.AnimationClip(an, dur, kf);
        clip.userData = { loop: !!LOOPING[an] };
        ch.clips[an] = clip;
      }
      ch.clips.idle = this.standClip(order, tBones, tBindQ, tBindP, tParentQi, tHipsRest, ch.faceYaw);
    }
    for (const an of names) { const s = this.clipSrc[an]; if (s.mixer) { s.mixer.stopAllAction(); s.mixer = null; } }
  }
}
