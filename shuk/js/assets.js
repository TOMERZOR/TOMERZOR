// Model loading, the shared animation library and character instancing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CHARACTERS, NPC_TYPES } from './config.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltfCache = new Map();

export function loadGLTF(url) {
  if (!gltfCache.has(url)) {
    const p = new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    p.catch(() => gltfCache.delete(url)); // allow a retry after a network error
    gltfCache.set(url, p);
  }
  return gltfCache.get(url);
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image ' + url));
    im.src = url;
  });
}

function prepScene(scene, { shadows = true, skinned = false } = {}) {
  scene.traverse(o => {
    if (o.isMesh) {
      o.castShadow = shadows;
      o.receiveShadow = false;
      if (o.isSkinnedMesh) o.frustumCulled = false; // animated poses leave the bind-pose bounds
      const m = o.material;
      if (m && m.isMeshStandardMaterial) {
        m.roughness = Math.max(0.55, m.roughness ?? 1);
        m.metalness = Math.min(0.1, m.metalness ?? 0);
        m.envMapIntensity = 0.6;
      }
    }
  });
  return scene;
}

// Root motion and hip height handling for each clip of the shared library.
function cleanClip(clip, name) {
  const c = clip.clone();
  c.name = name;
  const hips = c.tracks.find(t => t.name === 'Hips.position');
  if (hips) {
    const v = hips.values, n = v.length / 3;
    const x0 = v[0], z0 = v[2];
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      switch (name) {
        case 'jump': v[k] = x0; v[k + 2] = z0; v[k + 1] = Math.min(v[k + 1], 93); break; // physics does the lift
        case 'roll': case 'stumble': case 'idle': case 'walk': v[k + 2] = z0; if (name !== 'walk') v[k] = x0; break;
        case 'dance': v[k + 2] = z0; v[k] = x0 + (v[k] - x0) * 0.5; break;
        case 'knock': v[k] = v[k] - x0; v[k + 2] = (v[k + 2] - z0) * 0.6 + 9.6; break;
        default: break;
      }
    }
  }
  return c;
}

export class Assets {
  constructor() {
    this.clips = {};          // name -> AnimationClip (reference skeleton)
    this.refHipsY = 93.5;
    this.chars = {};          // id -> template { scene, hipsY, clips }
    this.npcs = {};           // type -> template scene
  }

  async loadAnims(url) {
    const g = await loadGLTF(url);
    for (const a of g.animations) this.clips[a.name] = cleanClip(a, a.name);
    let hips = null;
    g.scene.traverse(o => { if (o.name === 'Hips') hips = o; });
    if (hips) this.refHipsY = hips.position.y;
  }

  // Clips with the hip translation scaled for a character of a different size.
  clipsFor(hipsY) {
    const ratio = hipsY / this.refHipsY;
    const out = {};
    for (const [name, clip] of Object.entries(this.clips)) {
      if (Math.abs(ratio - 1) < 0.02) { out[name] = clip; continue; }
      const c = clip.clone();
      const t = c.tracks.find(tr => tr.name === 'Hips.position');
      if (t) for (let i = 0; i < t.values.length; i++) t.values[i] *= ratio;
      out[name] = c;
    }
    return out;
  }

  async character(id) {
    if (this.chars[id]) return this.chars[id];
    const def = CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
    const g = await loadGLTF(def.model);
    prepScene(g.scene, { skinned: true });
    let hips = null;
    g.scene.traverse(o => { if (o.name === 'Hips') hips = o; });
    const hipsY = hips ? hips.position.y : this.refHipsY;
    const tpl = { id, scene: g.scene, hipsY, clips: this.clipsFor(hipsY) };
    this.chars[id] = tpl;
    return tpl;
  }

  instanceCharacter(tpl) {
    const root = SkeletonUtils.clone(tpl.scene);
    const mixer = new THREE.AnimationMixer(root);
    return { root, mixer, clips: tpl.clips };
  }

  async npc(type) {
    if (this.npcs[type]) return this.npcs[type];
    const def = NPC_TYPES[type];
    const g = await loadGLTF(def.model);
    prepScene(g.scene);
    let hipsY = this.refHipsY;
    g.scene.traverse(o => { if (o.name === 'Hips') hipsY = o.position.y; });
    const tpl = { type, scene: g.scene, rigged: !!def.rig, clips: def.rig ? this.clipsFor(hipsY) : null };
    this.npcs[type] = tpl;
    return tpl;
  }

  instanceNpc(tpl) {
    if (tpl.rigged) {
      const root = SkeletonUtils.clone(tpl.scene);
      return { root, mixer: new THREE.AnimationMixer(root), clips: tpl.clips };
    }
    return { root: tpl.scene.clone(), mixer: null, clips: null };
  }
}
