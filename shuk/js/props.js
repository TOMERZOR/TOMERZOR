// Procedural obstacle props, power-up pickups and the 10-shekel coin.
import * as THREE from 'three';
import { Bag, rnd, pick, box, sph, cyl, cone } from './geo.js';
import { bannerTexture, vanTexture, truckTexture, coinTextures, glowTexture, FONT_HEAD } from './textures.js';

let M = null; // shared materials
function mats() {
  if (M) return M;
  M = {
    vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
    vcShiny: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2 }),
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
export function makeCrates() {
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

export function makeMelons() {
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
  x.fillStyle = '#ffd23f'; x.font = `56px ${FONT_HEAD}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.fillText('תפילין', 128, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  sign.position.set(0, 0.68, 0.395);
  g.add(sign);
  return g;
}

// ---------- high obstacles (roll under) ----------
const BANNERS = [['!מבצע! 3 ב־10', '#d62828', '#fff3b0'], ['כל הקילו ב־10!', '#ffd23f', '#9d0208'], ['חלבה ב־20!', '#6b2b7a', '#ffe9b0'], ['שבת שלום!', '#1d4ed8', '#ffffff'],
  ['תותים מתוקים!', '#e63946', '#ffffff'], ['רק היום!', '#2a9d8f', '#fff3b0']];
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
export function makePowerup(type) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const glow = new THREE.Sprite(mats().glow.clone());
  glow.scale.set(1.9, 1.9, 1);
  g.add(glow);
  const b = new Bag();
  if (type === 'magnet') {
    b.add(new THREE.TorusGeometry(0.3, 0.11, 8, 18, Math.PI), '#e63946', 0, 0.06, 0, 0, 0, Math.PI);
    for (const x of [-0.3, 0.3]) { b.add(cyl(0.11, 0.11, 0.18, 10), '#e63946', x, 0.06 - 0.09, 0); b.add(cyl(0.112, 0.112, 0.16, 10), '#e8edf2', x, -0.17, 0); }
    glow.material.color.set('#ff6b6b');
  } else if (type === 'x2') {
    // rugelach: crescent of rolled dough with chocolate swirl
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + i * 0.7 / 6), r = 0.28;
      const s = 1 - Math.abs(i - 3) * 0.13;
      b.add(sph(0.13 * s, 10, 7), i % 2 ? '#7b3f12' : '#d08a3c', Math.cos(a) * r, Math.sin(a) * r - 0.1, 0, 0, 0, a, 1.2, 1, 1);
    }
    glow.material.color.set('#ffb347');
    const tag = textSprite('×2', '#ffd23f');
    tag.position.set(0, 0.52, 0); tag.scale.set(0.7, 0.35, 1);
    g.add(tag);
  } else if (type === 'sneakers') {
    for (const x of [-0.17, 0.17]) {
      b.add(box(0.2, 0.16, 0.48), '#2a9df4', x, 0.06, 0);
      b.add(box(0.22, 0.06, 0.5), '#ffffff', x, -0.04, 0.01);
      b.add(sph(0.1, 8, 6).scale(1, 0.8, 1.2), '#2a9df4', x, 0.1, 0.18);
      for (let k = 0; k < 3; k++) b.add(new THREE.TorusGeometry(0.07, 0.018, 5, 10), '#d0d5da', x, -0.12 - k * 0.06, 0, Math.PI / 2, 0, 0);
      b.add(box(0.21, 0.03, 0.05), '#ffd23f', x, 0.15, 0.05);
    }
    glow.material.color.set('#4fc3ff');
  } else if (type === 'hamsa') {
    const shape = hamsaShape();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 });
    geo.translate(0, 0, -0.04);
    b.add(geo, '#1d6fd8', 0, -0.05, 0, 0, 0, 0, 0.9, 0.9, 1);
    b.add(cyl(0.11, 0.11, 0.03, 16), '#ffffff', 0, -0.05, 0.065, Math.PI / 2, 0, 0);
    b.add(cyl(0.065, 0.065, 0.035, 16), '#3fa7ff', 0, -0.05, 0.07, Math.PI / 2, 0, 0);
    b.add(cyl(0.03, 0.03, 0.04, 12), '#0b1d3a', 0, -0.05, 0.075, Math.PI / 2, 0, 0);
    glow.material.color.set('#5aa9ff');
  }
  const m = new THREE.Mesh(b.build(), mats().vcShiny);
  m.castShadow = true;
  inner.add(m);
  g.userData.inner = inner;
  g.userData.glow = glow;
  return g;
}

function hamsaShape() {
  const s = new THREE.Shape();
  // symmetric hamsa: wrist at bottom, three middle fingers, two outward-curling thumbs
  s.moveTo(-0.16, -0.42);
  s.quadraticCurveTo(-0.3, -0.3, -0.36, -0.1);
  s.quadraticCurveTo(-0.46, 0.0, -0.42, 0.1);
  s.quadraticCurveTo(-0.34, 0.12, -0.27, 0.02);
  s.lineTo(-0.25, 0.32); s.quadraticCurveTo(-0.2, 0.42, -0.14, 0.32);
  s.lineTo(-0.1, 0.06);
  s.lineTo(-0.08, 0.42); s.quadraticCurveTo(0, 0.52, 0.08, 0.42);
  s.lineTo(0.1, 0.06);
  s.lineTo(0.14, 0.32); s.quadraticCurveTo(0.2, 0.42, 0.25, 0.32);
  s.lineTo(0.27, 0.02);
  s.quadraticCurveTo(0.34, 0.12, 0.42, 0.1);
  s.quadraticCurveTo(0.46, 0.0, 0.36, -0.1);
  s.quadraticCurveTo(0.3, -0.3, 0.16, -0.42);
  s.closePath();
  return s;
}

export function textSprite(text, color = '#fff', stroke = '#2b1606') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.font = `96px ${FONT_HEAD}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 14; x.strokeStyle = stroke; x.lineJoin = 'round'; x.strokeText(text, 128, 68);
  x.fillStyle = color; x.fillText(text, 128, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
}

// ---------- coin ----------
export function makeCoinMesh(capacity) {
  const { face, edge } = coinTextures();
  // the cylinder cap's UVs come out a quarter turn off once the coin is stood up
  face.center.set(0.5, 0.5);
  face.rotation = Math.PI / 2;
  const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.07, 28, 1);
  geo.rotateX(Math.PI / 2);
  const faceMat = new THREE.MeshStandardMaterial({ map: face, metalness: 0.55, roughness: 0.32, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.28 });
  const edgeMat = new THREE.MeshStandardMaterial({ map: edge, metalness: 0.7, roughness: 0.3, emissive: '#b9c2c9', emissiveIntensity: 0.15 });
  const mesh = new THREE.InstancedMesh(geo, [edgeMat, faceMat, faceMat], capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}
