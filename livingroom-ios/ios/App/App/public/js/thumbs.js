// Renders a small picture of an item's 3D model (for cards), one at a time on a shared renderer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createItemObject, addLights, disposeItemObject } from './scene-kit.js';
import { CATEGORIES } from './catalog.js';
import { blobs } from './store.js';

let ctx = null;
function setup() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 300;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  addLights(scene);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  ctx = { canvas, renderer, scene, camera, floor };
  return ctx;
}

let queue = Promise.resolve();
const cache = new Map();

const pause = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 200 }) : setTimeout(r, 40)));

/** A picture of the item. Ready-made items use pictures shipped with the app; others are rendered once and kept. */
export function thumbnail(item) {
  if (item.starter && !item.updatedAt) return Promise.resolve(`img/starters/${item.id.replace(/^starter_/, '')}.webp`);
  const key = `${item.id}:${item.updatedAt || 0}:${item.model?.kind}:${item.color}:${item.dims.w}x${item.dims.d}x${item.dims.h}`;
  if (cache.has(key)) return cache.get(key);
  const p = queue = queue.then(async () => {
    const stored = await blobs.get(`thumb:${key}`).catch(() => null);
    if (stored) return stored;
    // one picture at a time, with a breather in between so taps aren't held up
    await pause();
    const url = await render(item);
    if (url) blobs.put(`thumb:${key}`, url).catch(() => {});
    return url;
  }).catch(() => null);
  cache.set(key, p);
  return p;
}

async function render(item) {
  const { renderer, scene, camera, canvas, floor } = ctx || setup();
  const root = await createItemObject(item);
  scene.add(root);
  const wall = CATEGORIES[item.category]?.mount === 'wall';
  floor.visible = !wall;
  const box = new THREE.Box3().setFromObject(root.userData.model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.12, size.length() / 2);
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.8;
  const dir = wall ? new THREE.Vector3(0.35, 0.1, 1).normalize() : item.category === 'rug' ? new THREE.Vector3(0.4, 1.4, 1).normalize() : new THREE.Vector3(0.75, 0.45, 1).normalize();
  camera.position.copy(center).add(dir.multiplyScalar(dist));
  camera.lookAt(center);
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/webp', 0.9);
  scene.remove(root);
  disposeItemObject(root);
  return url;
}
