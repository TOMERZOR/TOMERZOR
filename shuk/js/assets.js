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

// a reduced copy of a material's colour map, for models that only ever appear small on screen
const smallMaps = new WeakMap();
function smallMaterial(m, size) {
  const c = m.clone();
  const src = m.map;
  if (src && src.image && src.image.width > size) {
    let t = smallMaps.get(src);
    if (!t) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      cv.getContext('2d').drawImage(src.image, 0, 0, size, size);
      t = new THREE.CanvasTexture(cv);
      t.flipY = src.flipY; t.colorSpace = src.colorSpace; t.channel = src.channel;
      t.wrapS = src.wrapS; t.wrapT = src.wrapT; t.anisotropy = src.anisotropy;
      smallMaps.set(src, t);
    }
    c.map = t;
  }
  return c;
}

function prepScene(scene, { shadows = true, skinned = false } = {}) {
  scene.traverse(o => {
    if (o.isMesh) {
      if (o.material && o.material.map) o.material.map.anisotropy = 8;
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

  // Pedestrians reuse the playable characters, but at a fraction of the screen size: they get a 1024 copy of the
  // texture so only the runner keeps the full-resolution one on the GPU.
  pedTemplate(id) {
    const tpl = this.chars[id];
    if (!tpl) return null;
    if (!tpl.ped) {
      const scene = SkeletonUtils.clone(tpl.scene);
      scene.traverse(o => { if (o.isMesh && o.material) o.material = smallMaterial(o.material, 1024); });
      tpl.ped = { ...tpl, scene };
    }
    return tpl.ped;
  }

  // free the GPU copy of a character's full-resolution texture once the runner stops wearing it
  releaseCharacter(id) {
    const tpl = this.chars[id];
    if (!tpl) return;
    tpl.scene.traverse(o => { if (o.isMesh && o.material && o.material.map) o.material.map.dispose(); });
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

  // Static models (stalls, parked truck, obstacles): one mesh each, transform baked into the geometry.
  async prop(file) {
    const g = await loadGLTF(`models/${file}.glb`);
    g.scene.updateMatrixWorld(true);
    let mesh = null;
    g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    // these props are matte and cover a lot of the screen: plain diffuse shading costs a fraction of PBR
    const src = mesh.material;
    const material = new THREE.MeshLambertMaterial({ map: src.map, color: src.color, vertexColors: src.vertexColors });
    if (material.map) material.map.anisotropy = 8;
    src.dispose();
    return { geometry, material, size: geometry.boundingBox.getSize(new THREE.Vector3()) };
  }

  instanceNpc(tpl) {
    if (tpl.rigged) {
      const root = SkeletonUtils.clone(tpl.scene);
      return { root, mixer: new THREE.AnimationMixer(root), clips: tpl.clips };
    }
    return { root: tpl.scene.clone(), mixer: null, clips: null };
  }
}
