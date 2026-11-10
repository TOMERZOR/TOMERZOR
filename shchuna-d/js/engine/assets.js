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
    if (!cap || !img || Math.max(img.width, img.height) <= cap) return;
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
        for (let f = 0; f < n; f++) {
          times[f] = (f / (n - 1)) * dur;
          src.mixer.setTime(Math.min(dur - 1e-4, times[f])); src.scene.updateMatrixWorld(true);
          for (const bn of order) {
            const sb = src.bones[bn]; if (!sb) continue;
            sb.getWorldQuaternion(q);
            qa.copy(src.bindQ[bn]).invert(); q.multiply(qa);                 // world delta from bind
            q.premultiply(Y).multiply(Yi).multiply(tBindQ[bn]);              // turned to the target, applied to its bind
            (world[bn] || (world[bn] = new THREE.Quaternion())).copy(q);
            const parent = tBones[bn].parent;
            if (parent && parent.isBone && world[parent.name]) qb.copy(world[parent.name]).invert().multiply(q);
            else qb.copy(tParentQi).multiply(q);
            const arr = tracks[bn]; arr[f * 4] = qb.x; arr[f * 4 + 1] = qb.y; arr[f * 4 + 2] = qb.z; arr[f * 4 + 3] = qb.w;
          }
          // hips travel in metres, scaled by leg length; sideways root motion only where the move needs it
          hp.copy(src.bones.Hips.position).sub(src.hipsRest).applyQuaternion(src.parentQ).multiplyScalar(src.parentScale * ratio);
          hp.applyQuaternion(Y); hp.x *= keep; hp.z *= keep;
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
    }
    for (const an of names) { const s = this.clipSrc[an]; if (s.mixer) { s.mixer.stopAllAction(); s.mixer = null; } }
  }
}
