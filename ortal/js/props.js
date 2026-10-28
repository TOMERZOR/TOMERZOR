// The things that get thrown: a white plastic Keter chair, an iPhone 18 Pro Max,
// a monogram bag, a slide, a gold heel, a vape. Built from primitives so they
// cost nothing to download.

import * as THREE from "three";

const plastic = () => new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.38, metalness: 0 });

function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}
function cyl(r1, r2, h, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// The classic monobloc: seat, curved slatted back, armrests, four splayed legs.
export function makeChair() {
  const g = new THREE.Group();
  const mat = plastic();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.44), mat);
  seat.position.y = 0.44; seat.castShadow = true; g.add(seat);
  // seat front lip
  g.add(box(0.46, 0.06, 0.03, mat, 0, 0.42, 0.22));
  // legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cyl(0.022, 0.032, 0.45, mat, sx * 0.2, 0.22, sz * 0.19, sz * 0.08, 0, -sx * 0.08));
  }
  // back: frame + slats, slightly reclined
  const back = new THREE.Group();
  back.position.set(0, 0.46, -0.21); back.rotation.x = -0.18;
  back.add(box(0.46, 0.05, 0.03, mat, 0, 0.42, 0));
  for (const sx of [-1, 1]) back.add(box(0.035, 0.44, 0.03, mat, sx * 0.215, 0.21, 0));
  for (let i = -2; i <= 2; i++) back.add(box(0.045, 0.34, 0.02, mat, i * 0.075, 0.2, 0));
  g.add(back);
  // armrests
  for (const sx of [-1, 1]) {
    g.add(box(0.05, 0.03, 0.42, mat, sx * 0.25, 0.64, -0.01));
    g.add(box(0.03, 0.2, 0.03, mat, sx * 0.25, 0.54, 0.18));
  }
  g.userData.size = 0.9;
  return g;
}

// iPhone 18 Pro Max in "cosmic orange", with the camera plateau.
export function makePhone() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xe8742c, roughness: 0.3, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.08, metalness: 0.2, emissive: 0x101830, emissiveIntensity: 0.4 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.05, metalness: 0.9 });
  g.add(box(0.078, 0.165, 0.0085, body));
  g.add(box(0.072, 0.158, 0.001, glass, 0, 0, 0.0048));
  g.add(box(0.078, 0.04, 0.006, body, 0, 0.055, -0.007));
  for (const [x, y] of [[-0.022, 0.06], [0.0, 0.06], [0.022, 0.06]]) g.add(cyl(0.008, 0.008, 0.005, lens, x, y, -0.011, Math.PI / 2));
  g.userData.size = 0.17;
  return g;
}

let bagTex = null;
export function setBagTexture(tex) { bagTex = tex; }

// Monogram tote
export function makeBag() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: bagTex ? 0xffffff : 0x7a4a26, map: bagTex || null, roughness: 0.55 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xb5793e, roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.25, metalness: 0.9 });
  g.add(box(0.36, 0.26, 0.15, mat));
  g.add(box(0.37, 0.025, 0.155, trim, 0, 0.13, 0));
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 14, Math.PI), trim);
    h.position.set(sx * 0.09, 0.14, 0); g.add(h);
  }
  g.add(box(0.04, 0.03, 0.01, gold, 0, 0.09, 0.08));
  g.userData.size = 0.4;
  return g;
}

export function makeSlide() {
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 0.055, 0.13, 0, Math.PI * 2);
  const sole = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false }), black);
  sole.rotation.x = -Math.PI / 2; g.add(sole);
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 14, 1, true, -Math.PI / 2, Math.PI), black);
  strap.rotation.z = Math.PI / 2; strap.position.set(0, 0.025, -0.04); g.add(strap);
  g.userData.size = 0.28;
  return g;
}

export function makeHeel() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b84c, roughness: 0.3, metalness: 0.8 });
  g.add(box(0.07, 0.012, 0.13, gold, 0, 0.0, 0.06));
  g.add(box(0.07, 0.012, 0.09, gold, 0, 0.06, -0.06, 0.7));
  g.add(cyl(0.006, 0.01, 0.11, gold, 0, -0.05, -0.1));
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  toe.scale.set(0.8, 0.6, 1.4); toe.position.set(0, 0.005, 0.09); g.add(toe);
  g.userData.size = 0.25;
  return g;
}

export function makeVape() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a5cff, roughness: 0.3, metalness: 0.5 });
  g.add(box(0.025, 0.1, 0.012, mat));
  g.add(cyl(0.004, 0.006, 0.02, new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 0.06, 0));
  g.userData.size = 0.1;
  return g;
}

export function makeProp(type) {
  switch (type) {
    case "chair": return makeChair();
    case "phone": return makePhone();
    case "bag": return makeBag();
    case "slide": return makeSlide();
    case "heel": return makeHeel();
    case "vape": return makeVape();
  }
  return null;
}
