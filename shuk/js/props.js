// Procedural obstacle props, power-up pickups and the 10-shekel coin.
import * as THREE from 'three';
import { Bag, rnd, pick, box, sph, cyl, cone } from './geo.js';
import { T } from './i18n.js';
import { bannerTexture, vanTexture, truckTexture, coinTextures, glowTexture, blobTexture, softRectTexture, melonTexture, rugTexture, FONT_HEAD } from './textures.js';

// Contact shadows: a soft dark patch on the ground under anything standing on it. Unlike the sun's shadow
// map these never switch off and never miss the feet, which is what makes characters feel grounded.
let blobGeo = null;
const blobMats = {};
export function makeContactShadow(w, d, { square = false, opacity = 0.5 } = {}) {
  if (!blobGeo) { blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2); }
  const key = (square ? 's' : 'r') + opacity;
  if (!blobMats[key]) blobMats[key] = new THREE.MeshBasicMaterial({ map: square ? softRectTexture() : blobTexture(), color: '#1a1208', transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(blobGeo, blobMats[key]);
  m.scale.set(w, 1, d);
  m.position.y = 0.015;
  m.renderOrder = 1;
  m.castShadow = false; m.receiveShadow = false;
  return m;
}

let M = null; // shared materials
function mats() {
  if (M) return M;
  M = {
    vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
    glow: new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  };
  return M;
}

function meshFrom(bag, mat, shadow = true) {
  const m = new THREE.Mesh(bag.build(), mat);
  m.castShadow = shadow; m.receiveShadow = shadow;
  return m;
}

const PRODUCE_COLS = [['#d62828', '#e63946'], ['#f77f00', '#fb8b24'], ['#ffd23f', '#f6e05e'], ['#2d6a4f', '#40916c'], ['#9d0208', '#ae2012'], ['#5a189a', '#3c096c']];

// ---------- low obstacles (jump over) ----------
// Generated obstacle models, filled in by main.js once loaded. Their fronts face +x with the width along z,
// so they are turned to face the runner and stretched to the obstacle's collision box.
export const MODEL_PROPS = {};
function modelProp(name, w, h, d) {
  const m = MODEL_PROPS[name];
  const mesh = new THREE.Mesh(m.geometry, m.material);
  mesh.rotation.y = -Math.PI / 2;
  mesh.scale.set(d / m.size.x, h / m.size.y, w / m.size.z);
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

export function makeCrates() {
  if (MODEL_PROPS.crates) return modelProp('crates', 1.95, 0.85, 1.0);
  const b = new Bag();
  const cols = 3, w = 0.62;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < cols - layer; i++) {
      const x = (i - (cols - layer - 1) / 2) * (w + 0.04), y = layer * 0.38;
      b.add(box(w, 0.36, 0.8), '#b07d45', x, y + 0.18, 0, 0, rnd(-0.06, 0.06), 0, 1, 1, 1, 0.2);
      for (const yy of [0.06, 0.3]) b.add(box(w + 0.02, 0.05, 0.82), '#8a5a2e', x, y + yy, 0);
      if (layer === 1 || i === 0 || i === cols - 1) {
        const col = pick(PRODUCE_COLS);
        for (let k = 0; k < 6; k++) b.add(sph(0.085), pick(col), x + rnd(-0.2, 0.2), y + 0.38 + 0.06, rnd(-0.28, 0.28), 0, 0, 0, 1, 1, 1, 0.2);
      }
    }
  }
  return meshFrom(b, mats().vc);
}

// a watermelon that has escaped the pile and is rolling down the lane at you
let melonMat = null;
export function makeRollingMelon() {
  if (!melonMat) melonMat = new THREE.MeshLambertMaterial({ map: melonTexture() });
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), melonMat);
  ball.scale.set(1, 0.92, 1.18);
  ball.position.y = 0.4;
  g.add(ball);
  g.userData.roll = ball;
  return g;
}

// the flying rug under the runner: a subdivided plane whose cloth ripples every frame
export function makeCarpet() {
  const geo = new THREE.PlaneGeometry(1.15, 1.75, 8, 12);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: rugTexture(), side: THREE.DoubleSide }));
  mesh.userData.base = Float32Array.from(geo.attributes.position.array);
  mesh.castShadow = true;
  return mesh;
}
export function waveCarpet(mesh, t) {
  const pos = mesh.geometry.attributes.position, base = mesh.userData.base;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], z = base[i * 3 + 2];
    pos.array[i * 3 + 1] = Math.sin(z * 3.2 + t * 9) * 0.06 + Math.sin(x * 5 + t * 6) * 0.02 + (z > 0.7 ? (z - 0.7) * 0.35 : 0);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

export function makeMelons() {
  if (MODEL_PROPS.melons) return modelProp('melons', 1.75, 1.15, 1.2);
  const b = new Bag();
  b.add(box(1.8, 0.14, 1.15), '#c19a6b', 0, 0.07, 0);
  for (const x of [-0.75, 0, 0.75]) b.add(box(0.12, 0.1, 1.15), '#8a6a45', x, 0.05, 0);
  for (let l = 0; l < 3; l++) for (let i = 0; i < 4 - l; i++) for (let j = 0; j < 3 - l; j++) {
    b.add(sph(0.2, 10, 7).scale(1.25, 1, 1), l % 2 ? '#2d6a4f' : '#3a7d44', (i - (3 - l) / 2) * 0.42, 0.33 + l * 0.27, (j - (2 - l) / 2) * 0.36, 0, rnd(0, 3), 0, 1, 1, 1, 0.12);
  }
  return meshFrom(b, mats().vc);
}

export function makeSacks() {
  const b = new Bag();
  const cols = ['#c8a165', '#b08968', '#d4b483'];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.48;
    b.add(sph(0.3, 8, 6).scale(0.8, 1.15, 0.75), pick(cols), x, 0.34, 0, 0, 0, rnd(-0.15, 0.15), 1, 1, 1, 0.1);
    b.add(cyl(0.08, 0.12, 0.12, 6), '#9c7a4e', x, 0.72, 0);
    b.add(sph(0.12, 6, 4).scale(1, 0.4, 1), pick(['#f1e3c6', '#8e5a2b', '#c0392b', '#f1c40f']), x, 0.79, 0);
  }
  return meshFrom(b, mats().vc);
}

export function makeBarrier() {
  const b = new Bag();
  for (const x of [-0.85, 0.85]) {
    b.add(box(0.08, 0.95, 0.08), '#8d99ae', x, 0.475, 0);
    b.add(box(0.5, 0.05, 0.08), '#8d99ae', x, 0.03, 0);
  }
  for (let i = 0; i < 6; i++) b.add(box(0.3, 0.32, 0.06), i % 2 ? '#1d4ed8' : '#f8fafc', -0.75 + i * 0.3, 0.75, 0);
  b.add(box(1.85, 0.06, 0.07), '#1d4ed8', 0, 0.92, 0);
  b.add(box(1.85, 0.06, 0.07), '#1d4ed8', 0, 0.58, 0);
  return meshFrom(b, mats().vc);
}

export function makeTefillinTable() {
  const g = new THREE.Group();
  const b = new Bag();
  b.add(box(1.5, 0.05, 0.75), '#f8f9fa', 0, 0.86, 0);
  b.add(box(1.52, 0.4, 0.02), '#ffffff', 0, 0.66, 0.38);
  for (const x of [-0.68, 0.68]) for (const z of [-0.3, 0.3]) b.add(box(0.04, 0.86, 0.04), '#adb5bd', x, 0.43, z);
  for (let i = 0; i < 3; i++) {
    b.add(box(0.12, 0.12, 0.12), '#111', -0.4 + i * 0.4, 0.95, -0.05);
    b.add(box(0.03, 0.01, 0.45), '#111', -0.4 + i * 0.4 + 0.08, 0.89, 0.12);
  }
  b.add(box(0.3, 0.22, 0.04), '#1e3a8a', 0.5, 1.0, -0.2, -0.3, 0, 0);
  g.add(meshFrom(b, mats().vc));
  // sign
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#ffd23f'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#1e3a8a'; x.fillRect(6, 6, 244, 84);
  x.fillStyle = '#ffd23f'; x.font = `700 56px ${FONT_HEAD}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.fillText('תפילין', 128, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  sign.position.set(0, 0.68, 0.395);
  g.add(sign);
  return g;
}

// ---------- high obstacles (roll under) ----------
const BANNERS = T.banners;
let bannerTexCache = null;
export function makeBanner(width = 2.3) {
  if (!bannerTexCache) bannerTexCache = BANNERS.map(([t, bg, fg]) => bannerTexture(t, bg, fg));
  const g = new THREE.Group();
  const b = new Bag();
  for (const x of [-width / 2, width / 2]) {
    b.add(cyl(0.05, 0.06, 2.75, 8), '#5b5f63', x, 1.375, 0);
    b.add(cyl(0.16, 0.18, 0.1, 10), '#3d4246', x, 0.05, 0);
  }
  b.add(box(width, 0.05, 0.05), '#5b5f63', 0, 2.7, 0);
  g.add(meshFrom(b, mats().vc));
  const tex = pick(bannerTexCache);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.12, 1.25, 8, 1), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  cloth.position.set(0, 1.86, 0); cloth.castShadow = true;
  // bunting triangles under the cloth
  const bt = new Bag();
  const n = Math.floor(width / 0.28);
  for (let i = 0; i < n; i++) bt.add(cone(0.12, 0.22, 3).rotateX(Math.PI), i % 2 ? '#ffd23f' : '#ffffff', -width / 2 + 0.2 + i * (width - 0.4) / (n - 1), 1.14, 0, 0, 0, 0, 1, 1, 0.25);
  g.add(meshFrom(bt, mats().vc, false));
  g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}

export function makeRugs() {
  const g = new THREE.Group();
  const b = new Bag();
  for (const x of [-1.15, 1.15]) b.add(cyl(0.05, 0.05, 2.9, 8), '#6b4423', x, 1.45, 0);
  b.add(cyl(0.025, 0.025, 2.35, 6), '#3d2b1f', 0, 2.8, 0, 0, 0, Math.PI / 2);
  g.add(meshFrom(b, mats().vc));
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const pal = pick([['#9d0208', '#e9c46a', '#1d3557'], ['#264653', '#e76f51', '#f4a261'], ['#6a040f', '#f1faee', '#457b9d']]);
  x.fillStyle = pal[0]; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = pal[1]; x.lineWidth = 6; x.strokeRect(8, 8, 240, 112);
  x.fillStyle = pal[2];
  for (let i = 0; i < 5; i++) { x.save(); x.translate(40 + i * 44, 64); x.rotate(Math.PI / 4); x.fillRect(-14, -14, 28, 28); x.restore(); }
  x.fillStyle = pal[1]; for (let i = 0; i < 26; i++) x.fillRect(4 + i * 9.6, 120, 4, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6, 6, 1), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
  rug.position.set(0, 1.98, 0); rug.castShadow = true;
  g.add(rug);
  g.userData.cloth = rug;
  return g;
}

// ---------- platforms & vehicles ----------
let truckTex = null, vanTex = null;
export function makeTruck(withRamp, rampLen = 4.2) {
  if (!truckTex) truckTex = truckTexture();
  const g = new THREE.Group();
  const L = 8.5, W = 2.15, H = 2.35;
  const b = new Bag();
  // cargo box (local: z=0 is the box centre, -z is further from the player)
  b.add(box(W, 0.35, L + 1.6), '#2b2d42', 0, 0.45, -0.8);           // chassis
  for (const z of [1.8, -1.6, -L / 2 - 1.2]) for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) b.add(cyl(0.42, 0.42, 0.32, 14), '#1b1b1b', x, 0.42, z, 0, 0, Math.PI / 2);
  b.add(box(W, H - 0.62, L), '#f1f3f4', 0, 0.62 + (H - 0.62) / 2, 0);
  b.add(box(W + 0.04, 0.08, L + 0.04), '#2f8f3a', 0, H, 0);                // roof rim
  b.add(box(W - 0.1, 0.02, 0.06), '#999', 0, H - 0.6, L / 2 + 0.01);
  // rear doors facing the player
  b.add(box(0.03, H - 0.8, 0.03), '#9aa0a6', 0, 1.5, L / 2 + 0.02);
  for (const x of [-0.5, 0.5]) b.add(box(0.05, 0.6, 0.05), '#5f6368', x, 1.4, L / 2 + 0.03);
  b.add(box(W, 0.12, 0.2), '#ffd23f', 0, 0.75, L / 2 + 0.1);
  for (const x of [-0.85, 0.85]) b.add(box(0.2, 0.1, 0.05), '#e63946', x, 0.95, L / 2 + 0.03);
  // cab further away
  b.add(box(W, 1.7, 1.7), '#2f8f3a', 0, 1.35, -L / 2 - 1.0);
  b.add(box(W - 0.2, 0.7, 0.05), '#9bd1ff', 0, 1.75, -L / 2 - 1.86);
  if (withRamp) {
    const ang = Math.atan2(H, rampLen);
    const len = Math.hypot(H, rampLen);
    b.add(box(1.5, 0.08, len), '#b07d45', 0, H / 2, L / 2 + rampLen / 2, ang, 0, 0);
    for (let i = 0; i < 7; i++) b.add(box(1.5, 0.04, 0.06), '#8a5a2e', 0, H / 2 - (i - 3) * (H / 8), L / 2 + rampLen / 2 + (i - 3) * (rampLen / 8) + 0.0, 0, 0, 0);
    for (const x of [-0.7, 0.7]) b.add(box(0.06, 0.12, len), '#7a4f2a', x, H / 2 + 0.06, L / 2 + rampLen / 2, ang, 0, 0);
  }
  const body = meshFrom(b, mats().vc);
  g.add(body);
  // painted sides
  const sideMat = new THREE.MeshLambertMaterial({ map: truckTex });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.2, H - 0.75), sideMat);
    p.position.set(s * (W / 2 + 0.01), 0.62 + (H - 0.62) / 2, 0); p.rotation.y = s * Math.PI / 2;
    if (s < 0) p.scale.x = -1;
    g.add(p);
  }
  // fruit crates on the roof edges
  const r = new Bag();
  for (let i = 0; i < 3; i++) {
    const z = -L / 2 + 1.2 + i * 2.6;
    r.add(box(0.5, 0.25, 0.4), '#b07d45', W / 2 - 0.35, H + 0.17, z);
    for (let k = 0; k < 4; k++) r.add(sph(0.08), pick(pick(PRODUCE_COLS)), W / 2 - 0.35 + rnd(-0.12, 0.12), H + 0.36, z + rnd(-0.1, 0.1));
  }
  g.add(meshFrom(r, mats().vc));
  return g;
}

export function makeVan() {
  if (!vanTex) vanTex = vanTexture();
  const g = new THREE.Group();
  const L = 5.0, W = 2.0, H = 2.05;
  const b = new Bag();
  b.add(box(W, H - 0.45, L - 1.0), '#f7f7f2', 0, 0.45 + (H - 0.45) / 2, -0.5);
  b.add(box(W, 1.15, 1.2), '#f7f7f2', 0, 0.45 + 0.575, L / 2 - 0.6);           // bonnet + cab front
  b.add(box(W - 0.1, 0.55, 0.05), '#7ec8e3', 0, 1.45, L / 2 - 0.95, -0.35, 0, 0);  // windscreen
  b.add(box(W + 0.02, 0.25, 0.1), '#c0c0c0', 0, 0.55, L / 2 + 0.02);               // bumper
  for (const x of [-0.7, 0.7]) b.add(sph(0.12, 8, 6).scale(1, 0.7, 0.3), '#fffbe0', x, 0.85, L / 2 + 0.01);
  for (const z of [L / 2 - 1.0, -L / 2 + 0.7]) for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) b.add(cyl(0.36, 0.36, 0.28, 14), '#1b1b1b', x, 0.36, z, 0, 0, Math.PI / 2);
  // roof speakers
  for (const x of [-0.5, 0.5]) { b.add(box(0.5, 0.45, 0.45), '#222', x, H + 0.23, L / 2 - 1.3); b.add(cyl(0.16, 0.16, 0.04, 12), '#555', x, H + 0.23, L / 2 - 1.07, Math.PI / 2, 0, 0); }
  // roof rack
  b.add(box(W - 0.2, 0.06, L - 1.6), '#444', 0, H + 0.02, -0.9);
  g.add(meshFrom(b, mats().vc));
  const sideMat = new THREE.MeshLambertMaterial({ map: vanTex });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(L - 1.2, H - 0.7), sideMat);
    p.position.set(s * (W / 2 + 0.01), 0.5 + (H - 0.5) / 2, -0.45); p.rotation.y = s * Math.PI / 2;
    if (s < 0) p.scale.x = -1;
    g.add(p);
  }
  return g;
}

// ---------- power-ups ----------
// The pickups are the rendered 3D icons from the UI kit, shown as glowing billboards that flip like coins.
const iconTex = {};
export function powerIconTexture(type) {
  if (!iconTex[type]) {
    const t = new THREE.TextureLoader().load(`img/ui/ico_${type}.webp`);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    iconTex[type] = t;
  }
  return iconTex[type];
}
const GLOW_COL = { magnet: '#ff6b6b', x2: '#ffb347', sneakers: '#4fc3ff', hamsa: '#5aa9ff', carpet: '#ff7a59', bag: '#ffd23f' };
export function makePowerup(type) {
  const g = new THREE.Group();
  const glow = new THREE.Sprite(mats().glow.clone());
  glow.material.color.set(GLOW_COL[type] || '#fff');
  glow.scale.set(2.3, 2.3, 1);
  g.add(glow);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: powerIconTexture(type), transparent: true, alphaTest: 0.02, toneMapped: false }));
  icon.scale.set(1.25, 1.25, 1);
  icon.renderOrder = 3;
  g.add(icon);
  g.userData.inner = icon;
  g.userData.glow = glow;
  return g;
}

// ---------- coin ----------
export function makeCoinMesh(capacity) {
  const { edge } = coinTextures();
  // generated 10-shekel face; the cylinder cap's UVs come out a quarter turn off once the coin is stood up
  const face = new THREE.TextureLoader().load('img/coin_face.webp');
  face.colorSpace = THREE.SRGBColorSpace;
  face.anisotropy = 4;
  face.center.set(0.5, 0.5);
  face.rotation = Math.PI / 2;
  const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.07, 28, 1);
  geo.rotateX(Math.PI / 2);
  // a warm tint keeps the silver ring reading as treasure at running speed
  const faceMat = new THREE.MeshStandardMaterial({ map: face, color: '#fff0c4', metalness: 0.55, roughness: 0.32, emissive: '#ffe9b0', emissiveMap: face, emissiveIntensity: 0.24 });
  const edgeMat = new THREE.MeshStandardMaterial({ map: edge, metalness: 0.7, roughness: 0.3, emissive: '#b9c2c9', emissiveIntensity: 0.15 });
  const mesh = new THREE.InstancedMesh(geo, [edgeMat, faceMat, faceMat], capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}
