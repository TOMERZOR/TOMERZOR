// Shared by the planner (studio) and the AR view: an item in a scene, with its soft floor shadow,
// dimension lines, walking-space zone and selection outline.
import * as THREE from 'three';
import { buildModel, cutoutImage, loadImage, disposeObject } from './models.js';
import { CATEGORIES, HANG_CENTER } from './catalog.js';
import { blobs } from './store.js';
import { len } from './units.js';
import { proxied } from './api.js';

export const ACCENT = new THREE.Color('#FF5A1F');
const M = v => v / 100;

// ---------- textures ----------
function softRectTexture(w, d) {
  const c = document.createElement('canvas');
  const ratio = w / d;
  c.width = ratio >= 1 ? 256 : Math.max(32, Math.round(256 * ratio));
  c.height = ratio >= 1 ? Math.max(32, Math.round(256 / ratio)) : 256;
  const x = c.getContext('2d');
  const pad = 0.16; // share of the texture taken by the blur on each side
  const blur = Math.min(c.width, c.height) * pad;
  x.filter = `blur(${blur * 0.55}px)`;
  x.fillStyle = 'rgba(0,0,0,1)';
  const rx = c.width * pad, ry = c.height * pad;
  x.beginPath();
  x.roundRect(rx, ry, c.width - 2 * rx, c.height - 2 * ry, Math.min(c.width, c.height) * 0.08);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makeShadow(item) {
  const W = M(item.dims.w), D = M(item.dims.d);
  const round = ['plant', 'lamp', 'decor'].includes(item.category) || item.shape === 'round';
  const sw = W * 1.45 + 0.08, sd = D * 1.45 + 0.08;
  let tex;
  if (round) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
  } else tex = softRectTexture(sw, sd);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: item.category === 'rug' ? 0.12 : 0.42, depthWrite: false, color: '#000' });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.renderOrder = -1;
  mesh.userData.helper = true;
  return mesh;
}

function pillTexture(text, { bg = 'rgba(20,23,26,0.86)', fg = '#fff', size = 44 } = {}) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const font = `600 ${size}px Rubik, system-ui, sans-serif`;
  x.font = font;
  const tw = Math.ceil(x.measureText(text).width);
  c.width = tw + size * 1.2; c.height = size * 1.7;
  x.font = font;
  x.fillStyle = bg;
  x.beginPath(); x.roundRect(0, 0, c.width, c.height, c.height / 2); x.fill();
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.direction = 'ltr';
  x.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { texture: t, aspect: c.width / c.height };
}

export function labelSprite(text, height = 0.055, opts) {
  const { texture, aspect } = pillTexture(text, opts);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }));
  s.scale.set(height * aspect, height, 1);
  s.renderOrder = 10;
  s.userData.helper = true;
  s.userData.labelHeight = height;
  return s;
}

export function setLabel(sprite, text, opts) {
  const { texture, aspect } = pillTexture(text, opts);
  sprite.material.map?.dispose();
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  const h = sprite.userData.labelHeight || 0.055;
  sprite.scale.set(h * aspect, h, 1);
}

// ---------- dimension lines ----------
const lineMat = new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.95 });
function segment(a, b) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(g, lineMat);
  l.renderOrder = 9;
  return l;
}
function measureLine(a, b, text, tick) {
  const grp = new THREE.Group();
  grp.add(segment(a, b));
  for (const p of [a, b]) grp.add(segment(p.clone().add(tick), p.clone().sub(tick)));
  const s = labelSprite(text);
  s.position.copy(a).add(b).multiplyScalar(0.5);
  grp.add(s);
  return grp;
}

function makeDims(item) {
  const W = M(item.dims.w), D = M(item.dims.d), H = M(item.dims.h);
  const wall = CATEGORIES[item.category]?.mount === 'wall';
  const g = new THREE.Group();
  g.userData.helper = true;
  const o = 0.06; // offset from the item
  const t = 0.025;
  const zFront = wall ? D + o : D / 2 + o;
  g.add(measureLine(new THREE.Vector3(-W / 2, wall ? -o : 0.01, zFront), new THREE.Vector3(W / 2, wall ? -o : 0.01, zFront), `${len(item.dims.w)}`, new THREE.Vector3(0, t, 0)));
  if (item.category !== 'rug') g.add(measureLine(new THREE.Vector3(W / 2 + o, 0, zFront - o), new THREE.Vector3(W / 2 + o, H, zFront - o), `${len(item.dims.h)}`, new THREE.Vector3(t, 0, 0)));
  if (!wall) g.add(measureLine(new THREE.Vector3(W / 2 + o, 0.01, -D / 2), new THREE.Vector3(W / 2 + o, 0.01, D / 2), `${len(item.dims.d)}`, new THREE.Vector3(t, 0, 0)));
  g.visible = false;
  return g;
}

// ---------- walking space ----------
const CLEAR_SIDES = {
  sofa: ['front'], armchair: ['front'], cabinet: ['front'], shelf: ['front'],
  bed: ['front', 'left', 'right'], table: ['front', 'back', 'left', 'right'], 'coffee-table': ['front', 'back', 'left', 'right'], chair: ['back'],
};
function stripeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,90,31,0.16)'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(255,90,31,0.35)'; x.lineWidth = 6;
  for (let i = -64; i < 128; i += 22) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 64, 0); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
let stripes = null;
function makeClearance(item) {
  const c = CATEGORIES[item.category]?.clearance || 0;
  const sides = CLEAR_SIDES[item.category];
  if (!c || !sides) return null;
  const W = M(item.dims.w), D = M(item.dims.d), C = M(c);
  stripes ||= stripeTexture();
  const g = new THREE.Group();
  g.userData.helper = true;
  const add = (w, d, x, z) => {
    const tex = stripes.clone(); tex.needsUpdate = true; tex.repeat.set(w / 0.18, d / 0.18);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.003, z); m.renderOrder = -1;
    g.add(m);
  };
  if (sides.includes('front')) add(W, C, 0, D / 2 + C / 2);
  if (sides.includes('back')) add(W, C, 0, -D / 2 - C / 2);
  if (sides.includes('left')) add(C, D, -W / 2 - C / 2, 0);
  if (sides.includes('right')) add(C, D, W / 2 + C / 2, 0);
  g.visible = false;
  return g;
}

// ---------- selection outline ----------
function makeRing(item) {
  const W = M(item.dims.w), D = M(item.dims.d);
  const wall = CATEGORIES[item.category]?.mount === 'wall';
  const pad = 0.04;
  const shape = new THREE.Shape();
  const w = W + pad * 2, d = (wall ? M(item.dims.h) : D) + pad * 2, r = Math.min(0.06, w / 4, d / 4);
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(-w / 2 + r, d / 2); shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, -d / 2 + r); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const pts = shape.getPoints(8);
  const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, 0, p.y)));
  const mat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, depthTest: false });
  const line = new THREE.LineLoop(geo, mat);
  line.renderOrder = 8;
  line.userData.helper = true;
  if (wall) { line.rotation.x = Math.PI / 2; line.position.set(0, M(item.dims.h) / 2, M(item.dims.d) + 0.01); }
  else line.position.y = 0.006;
  line.visible = false;
  return line;
}

// ---------- assets ----------
/** Loads what an item's model needs: its GLB file and/or its product photo (background removed). */
export async function itemAssets(item) {
  const out = { glb: null, image: null };
  if (item.model?.kind === 'glb') out.glb = await blobs.get(`glb:${item.id}`);
  const wantsImage = item.model?.kind === 'photo' || ['art', 'rug'].includes(item.category) && item.useImage !== false;
  if (wantsImage) {
    const stored = await blobs.get(`photo:${item.id}`);
    let img = null;
    if (stored) img = await loadImage(URL.createObjectURL(stored));
    else if (item.image) img = await loadImage(proxied(item.image));
    if (img) {
      if (item.model?.kind === 'photo') out.image = cutoutImage(img).canvas;
      else if (item.category === 'rug') out.photoForTexture = img;
      else out.image = img;
    }
  }
  return out;
}

/** A complete scene object for an item. `root.userData` holds the parts. */
export async function createItemObject(item, { assets } = {}) {
  const root = new THREE.Group();
  const model = await buildModel(item, assets || await itemAssets(item));
  model.userData.isModel = true;
  root.add(model);
  const shadow = CATEGORIES[item.category]?.mount === 'wall' ? null : makeShadow(item);
  if (shadow) root.add(shadow);
  const dims = makeDims(item);
  root.add(dims);
  const clearance = makeClearance(item);
  if (clearance) root.add(clearance);
  const ring = makeRing(item);
  root.add(ring);
  root.userData = { item, model, shadow, dims, clearance, ring, wall: CATEGORIES[item.category]?.mount === 'wall' };
  return root;
}

export function defaultY(item) {
  const cat = CATEGORIES[item.category];
  if (cat?.mount !== 'wall') return 0;
  return Math.max(0, M((HANG_CENTER[item.category] || 145) - item.dims.h / 2));
}

export function setSelected(root, on) {
  const u = root.userData;
  if (u.ring) u.ring.visible = on;
}

export function disposeItemObject(root) { disposeObject(root); }

// ---------- footprints and overlaps ----------
/** Four floor corners (x, z) of a floor item in world space. */
export function footprint(root) {
  const { item } = root.userData;
  const W = M(item.dims.w) / 2, D = M(item.dims.d) / 2;
  // from position and turn only, so the drop-in animation's scale doesn't shrink it
  const p = root.parent && !root.parent.isScene ? root.getWorldPosition(new THREE.Vector3()) : root.position;
  const rot = root.parent && !root.parent.isScene ? root.getWorldQuaternion(new THREE.Quaternion()) : root.quaternion;
  const e = new THREE.Euler().setFromQuaternion(rot, 'YXZ');
  const c = Math.cos(e.y), s = Math.sin(e.y);
  return [[-W, -D], [W, -D], [W, D], [-W, D]].map(([x, z]) => [p.x + x * c + z * s, p.z - x * s + z * c]);
}

function project(poly, ax) {
  let mn = Infinity, mx = -Infinity;
  for (const [x, z] of poly) { const p = x * ax[0] + z * ax[1]; if (p < mn) mn = p; if (p > mx) mx = p; }
  return [mn, mx];
}
/** True when two convex floor polygons overlap by more than `slack` metres. */
export function polygonsOverlap(a, b, slack = 0.01) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
      const ax = [-(z2 - z1), x2 - x1];
      const l = Math.hypot(ax[0], ax[1]) || 1; ax[0] /= l; ax[1] /= l;
      const [a0, a1] = project(a, ax), [b0, b1] = project(b, ax);
      if (a1 - slack <= b0 || b1 - slack <= a0) return false;
    }
  }
  return true;
}

/** Items that stand on the floor and can bump into each other (rugs and wall items can't). */
export const isSolid = root => !root.userData.wall && root.userData.item.category !== 'rug';

// ---------- environment ----------
export function addLights(scene, { shadows = true } = {}) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b2a6', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e5', 2.2);
  sun.position.set(2.5, 5, 3.5);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 6;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 20 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
  }
  scene.add(sun, sun.target);
  return { hemi, sun };
}
