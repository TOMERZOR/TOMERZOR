// Procedural low-poly models: people, houses, vans, props and carry items.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const M = opts.std ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial;
    const o = { color, ...opts };
    delete o.std;
    matCache.set(key, new M(o));
  }
  return matCache.get(key);
}

export function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Box with rounded edges: subdivide a box, then pull every vertex onto a rounded hull.
const rbCache = new Map();
export function roundedBox(w, h, d, r = 0.08, seg = 3) {
  const key = [w, h, d, r, seg].join(',');
  if (rbCache.has(key)) return rbCache.get(key);
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, v = new THREE.Vector3(), inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(
      Math.max(-inner.x, Math.min(inner.x, v.x)),
      Math.max(-inner.y, Math.min(inner.y, v.y)),
      Math.max(-inner.z, Math.min(inner.z, v.z)));
    const n = v.clone().sub(c);
    if (n.lengthSq() > 1e-9) v.copy(c).add(n.normalize().multiplyScalar(r));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  rbCache.set(key, g);
  return g;
}

const G = {
  sphere: new THREE.SphereGeometry(1, 18, 14),
  sphereLo: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  capsule: new THREE.CapsuleGeometry(1, 1, 6, 12),
};
const S = (geo, color, sx, sy, sz, opts) => { const m = mesh(geo, color, opts); m.scale.set(sx, sy ?? sx, sz ?? sx); return m; };

// ---------- Text on canvas ----------
export function textCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function rr(x, X, Y, W, H, R) {
  x.beginPath();
  x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R);
  x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath();
}

// ---------- People ----------
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xf3cfb3];
const HAIRS = [0x2b1b10, 0x4a2e1a, 0x111111, 0x8b5a2b, 0xd9b26f, 0x9a9a9a, 0xb03a2e];
const SHIRTS = [0xff6f61, 0x6ab04c, 0xf9ca24, 0x7ed6df, 0xe056fd, 0xff9ff3, 0x686de0, 0xffbe76, 0xbadc58, 0xf8a5c2];

export function makePerson(o = {}) {
  const skin = o.skin ?? SKINS[Math.floor(Math.random() * SKINS.length)];
  const shirt = o.shirt ?? SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const pants = o.pants ?? 0x3d4a5c;
  const hair = o.hair ?? HAIRS[Math.floor(Math.random() * HAIRS.length)];
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while walking
  root.add(body);

  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.15 * sx, 0.56, 0);
    const leg = S(G.capsule, pants, 0.12, 0.17, 0.12); leg.position.y = -0.26; hip.add(leg);
    const foot = mesh(roundedBox(0.2, 0.12, 0.3, 0.05), 0x3a2a20); foot.position.set(0, -0.5, 0.05); hip.add(foot);
    body.add(hip); legs.push(hip);
  }
  const torso = mesh(roundedBox(0.62, 0.6, 0.42, 0.16), shirt); torso.position.y = 0.9; body.add(torso);
  if (o.overalls) {
    const bib = mesh(roundedBox(0.44, 0.34, 0.08, 0.04), pants); bib.position.set(0, 0.86, 0.2); body.add(bib);
    for (const sx of [-1, 1]) { const st = S(G.box, pants, 0.07, 0.3, 0.05); st.position.set(0.17 * sx, 1.08, 0.2); body.add(st); }
  }
  const belly = S(G.sphere, shirt, 0.3, 0.28, 0.26); belly.position.set(0, 0.8, 0.12); body.add(belly);
  if (o.belt) {
    const belt = mesh(roundedBox(0.66, 0.1, 0.46, 0.04), 0x7a4a24); belt.position.y = 0.64; body.add(belt);
    const pouch = mesh(roundedBox(0.16, 0.18, 0.12, 0.04), 0x9c6633); pouch.position.set(0.3, 0.6, 0.14); body.add(pouch);
    const pouch2 = pouch.clone(); pouch2.position.x = -0.3; body.add(pouch2);
  }

  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  const skull = S(G.sphere, skin, 0.3, 0.3, 0.29); head.add(skull);
  const nose = S(G.sphere, skin, 0.07, 0.06, 0.07); nose.position.set(0, -0.02, 0.29); head.add(nose);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = S(G.sphere, 0x1b1b1b, 0.045, 0.06, 0.03); e.position.set(0.11 * sx, 0.06, 0.26); head.add(e); eyes.push(e);
    const brow = S(G.box, o.mustache ? 0x2b1b10 : hair, 0.1, 0.025, 0.03); brow.position.set(0.11 * sx, 0.15, 0.27); brow.rotation.z = -0.15 * sx; head.add(brow);
    const ear = S(G.sphere, skin, 0.06, 0.08, 0.04); ear.position.set(0.29 * sx, 0, 0); head.add(ear);
  }
  if (o.mustache) {
    for (const sx of [-1, 1]) {
      const m = S(G.capsule, 0x2b1b10, 0.035, 0.07, 0.035); m.rotation.z = Math.PI / 2 + 0.35 * sx; m.position.set(0.07 * sx, -0.09, 0.27); head.add(m);
    }
  }
  const mouth = S(G.sphere, 0x6b2a2a, 0.06, 0.025, 0.02); mouth.position.set(0, -0.15, 0.255); head.add(mouth);

  // hair or hat
  const style = o.hairStyle ?? ['short', 'bald', 'bun', 'curly', 'short', 'long'][Math.floor(Math.random() * 6)];
  if (!o.hat) {
    if (style === 'short' || style === 'bun' || style === 'long') {
      const cap = S(G.sphere, hair, 0.31, 0.2, 0.3); cap.position.set(0, 0.1, -0.02); head.add(cap);
      if (style === 'bun') { const b = S(G.sphere, hair, 0.13); b.position.set(0, 0.3, -0.12); head.add(b); }
      if (style === 'long') { const l = mesh(roundedBox(0.56, 0.42, 0.18, 0.08), hair); l.position.set(0, -0.08, -0.17); head.add(l); }
    } else if (style === 'curly') {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2; const c = S(G.sphereLo, hair, 0.11);
        c.position.set(Math.cos(a) * 0.2, 0.2 + Math.sin(i * 2.3) * 0.03, Math.sin(a) * 0.18 - 0.03); head.add(c);
      }
    } else {
      const fringe = S(G.sphere, hair, 0.31, 0.12, 0.28); fringe.position.set(0, -0.02, -0.06); head.add(fringe);
    }
  }
  if (o.hat) head.add(makeHat(o.hat, o.hatColor));

  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.38 * sx, 1.1, 0);
    const sleeve = S(G.sphere, shirt, 0.13); sh.add(sleeve);
    const arm = S(G.capsule, skin, 0.085, 0.2, 0.085); arm.position.y = -0.22; sh.add(arm);
    const hand = S(G.sphere, skin, 0.1); hand.position.y = -0.42; sh.add(hand);
    sh.rotation.z = 0.12 * sx;
    body.add(sh); arms.push(sh);
  }
  if (o.tool) { const t = makeTool(o.tool); t.position.y = -0.44; arms[1].add(t); }

  root.userData = { body, legs, arms, head, belly, eyes, torso, phase: Math.random() * 10, blink: 2 + Math.random() * 3 };
  return root;
}

function makeHat(kind, color) {
  const g = new THREE.Group();
  if (kind === 'cap') {
    const c = S(G.sphere, color, 0.315, 0.2, 0.31); c.position.y = 0.1; g.add(c);
    const brim = mesh(roundedBox(0.36, 0.04, 0.24, 0.02), color); brim.position.set(0, 0.08, 0.3); g.add(brim);
    const btn = S(G.sphere, 0xffffff, 0.04); btn.position.y = 0.3; g.add(btn);
  } else if (kind === 'helmet') {
    const c = S(G.sphere, color, 0.34, 0.25, 0.34); c.position.y = 0.1; g.add(c);
    const rim = S(G.cyl, color, 0.4, 0.03, 0.4); rim.position.y = 0.1; g.add(rim);
    const ridge = mesh(roundedBox(0.08, 0.06, 0.6, 0.03), color); ridge.position.y = 0.33; g.add(ridge);
  } else if (kind === 'beanie') {
    const c = S(G.sphere, color, 0.32, 0.26, 0.31); c.position.y = 0.12; g.add(c);
    const fold = S(G.cyl, color, 0.32, 0.08, 0.31); fold.position.y = 0.06; g.add(fold);
    const pom = S(G.sphereLo, 0xffffff, 0.08); pom.position.y = 0.4; g.add(pom);
  } else if (kind === 'paper') {
    const shape = new THREE.Shape(); shape.moveTo(-0.34, 0); shape.lineTo(0.34, 0); shape.lineTo(0, 0.34); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: false }); geo.translate(0, 0, -0.21);
    const c = mesh(geo, 0xffffff); c.position.y = 0.1; c.rotation.y = Math.PI / 2; g.add(c);
    const fold = mesh(roundedBox(0.7, 0.07, 0.44, 0.02), 0xf2f2f2); fold.position.y = 0.11; g.add(fold);
  } else if (kind === 'straw') {
    const brim = S(G.cyl, color, 0.52, 0.03, 0.52); brim.position.y = 0.12; g.add(brim);
    const top = S(G.cyl, color, 0.26, 0.2, 0.26); top.position.y = 0.23; g.add(top);
    const band = S(G.cyl, 0xd94f30, 0.265, 0.05, 0.265); band.position.y = 0.16; g.add(band);
  }
  return g;
}

function makeTool(kind) {
  const g = new THREE.Group();
  if (kind === 'plunger') {
    const st = S(G.cylLo, 0xb5835a, 0.03, 0.6, 0.03); st.position.y = -0.1; g.add(st);
    const cup = S(G.sphere, 0xd8342c, 0.13, 0.1, 0.13); cup.position.y = -0.42; g.add(cup);
  } else if (kind === 'screwdriver') {
    const h = S(G.cylLo, 0xf2c94c, 0.05, 0.16, 0.05); g.add(h);
    const s = S(G.cylLo, 0xcccccc, 0.015, 0.26, 0.015); s.position.y = -0.2; g.add(s);
  } else if (kind === 'keys') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 16), mat(0xcccccc)); g.add(ring);
    for (let i = 0; i < 3; i++) { const k = S(G.box, [0xd4af37, 0xc0c0c0, 0xb87333][i], 0.03, 0.16, 0.015); k.position.set((i - 1) * 0.05, -0.12, 0); k.rotation.z = (i - 1) * 0.3; g.add(k); }
  } else if (kind === 'roller') {
    const st = S(G.cylLo, 0x888888, 0.02, 0.32, 0.02); st.position.y = -0.1; g.add(st);
    const r = S(G.cyl, 0xf5f5f5, 0.07, 0.24, 0.07); r.rotation.z = Math.PI / 2; r.position.y = -0.3; g.add(r);
  } else if (kind === 'gauge') {
    const b = S(G.cyl, 0x2b2b2b, 0.1, 0.05, 0.1); b.rotation.x = Math.PI / 2; g.add(b);
    const f = S(G.cyl, 0xffffff, 0.08, 0.055, 0.08); f.rotation.x = Math.PI / 2; g.add(f);
  } else if (kind === 'shears') {
    for (const s of [-1, 1]) { const bl = S(G.box, 0xcfd8dc, 0.03, 0.36, 0.015); bl.rotation.z = 0.15 * s; bl.position.y = -0.2; g.add(bl); }
    const h = S(G.box, 0x2e7d32, 0.12, 0.08, 0.04); g.add(h);
  }
  return g;
}

// Walk / idle animation. speed in 0..1, t seconds.
export function animatePerson(p, dt, moving, opts = {}) {
  const u = p.userData;
  u.phase += dt * (moving ? 11 : 2) * (opts.rate ?? 1);
  const s = Math.sin(u.phase), c = Math.cos(u.phase);
  const k = moving ? 1 : 0;
  u.walkAmt = THREE.MathUtils.lerp(u.walkAmt ?? 0, k, Math.min(1, dt * 10));
  const w = u.walkAmt;
  if (opts.riding) {
    u.legs[0].rotation.x = u.legs[1].rotation.x = 0;
    u.body.position.y = 0.02 * Math.sin(u.phase * 0.5);
    u.arms[0].rotation.x = u.arms[1].rotation.x = -0.9;
  } else {
    u.legs[0].rotation.x = s * 0.75 * w;
    u.legs[1].rotation.x = -s * 0.75 * w;
    u.arms[0].rotation.x = opts.carry ? -0.5 : -s * 0.7 * w;
    u.arms[1].rotation.x = opts.carry ? -0.5 : s * 0.7 * w;
    u.body.position.y = Math.abs(c) * 0.08 * w + (1 - w) * Math.sin(u.phase) * 0.012;
  }
  u.body.rotation.z = s * 0.05 * w;
  u.head.rotation.y = opts.look ?? u.head.rotation.y * 0.9;
  // blink
  u.blink -= dt;
  const closed = u.blink < 0.12;
  if (u.blink < 0) u.blink = 2 + Math.random() * 4;
  for (const e of u.eyes) e.scale.y = closed ? 0.008 : 0.06;
}

// ---------- Carry items (one per profession) ----------
export function makeItem(kind) {
  const g = new THREE.Group();
  let h = 0.3;
  if (kind === 'plumber') {
    const p = S(G.cyl, 0xb0bec5, 0.11, 0.78, 0.11); p.rotation.z = Math.PI / 2; g.add(p);
    for (const sx of [-1, 1]) { const c = S(G.cyl, 0xff8a3d, 0.14, 0.12, 0.14); c.rotation.z = Math.PI / 2; c.position.x = 0.36 * sx; g.add(c); }
    h = 0.27;
  } else if (kind === 'electrician') {
    const core = S(G.cyl, 0xe53935, 0.17, 0.3, 0.17); core.rotation.z = Math.PI / 2; g.add(core);
    for (const sx of [-1, 1]) { const f = S(G.cyl, 0x8d6e63, 0.26, 0.04, 0.26); f.rotation.z = Math.PI / 2; f.position.x = 0.17 * sx; g.add(f); }
    h = 0.5;
  } else if (kind === 'locksmith') {
    const b = mesh(roundedBox(0.42, 0.22, 0.3, 0.07), 0xd4a72c, {}); g.add(b);
    const hole = S(G.cyl, 0x3b2a0a, 0.05, 0.02, 0.05); hole.rotation.x = Math.PI / 2; hole.position.z = 0.15; g.add(hole);
    const key = S(G.box, 0xdfe6e9, 0.04, 0.04, 0.2); key.position.set(0, 0, 0.24); g.add(key);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), mat(0xdfe6e9)); bow.position.z = 0.38; g.add(bow);
    h = 0.24;
  } else if (kind === 'renovator') {
    const colors = [0x4fc3f7, 0xff8a65, 0xaed581, 0xffd54f, 0xba68c8];
    const b = S(G.cyl, 0xf5f5f5, 0.2, 0.34, 0.2); g.add(b);
    const lid = S(G.cyl, colors[Math.floor(Math.random() * colors.length)], 0.21, 0.06, 0.21); lid.position.y = 0.18; g.add(lid);
    const drip = S(G.sphere, lid.material.color.getHex(), 0.05, 0.1, 0.05); drip.position.set(0.19, 0.08, 0.05); g.add(drip);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 6, 16, Math.PI), mat(0x777777)); hd.position.y = 0.2; g.add(hd);
    h = 0.4;
  } else if (kind === 'ac') {
    const b = S(G.cyl, 0x4dd0e1, 0.15, 0.36, 0.15); g.add(b);
    const top = S(G.sphere, 0x4dd0e1, 0.15, 0.08, 0.15); top.position.y = 0.18; g.add(top);
    const v = S(G.cylLo, 0x9e9e9e, 0.04, 0.1, 0.04); v.position.y = 0.27; g.add(v);
    const lbl = S(G.cyl, 0xffffff, 0.153, 0.12, 0.153); g.add(lbl);
    g.rotation.z = Math.PI / 2; h = 0.31;
    const w = new THREE.Group(); w.add(g); return Object.assign(w, { userData: { h } });
  } else if (kind === 'gardener') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.24, 12), mat(0xc8653a)); pot.castShadow = true; g.add(pot);
    const soil = S(G.cyl, 0x4e342e, 0.16, 0.02, 0.16); soil.position.y = 0.12; g.add(soil);
    for (let i = 0; i < 3; i++) { const l = S(G.sphereLo, [0x43a047, 0x66bb6a, 0x2e7d32][i], 0.12); l.position.set((i - 1) * 0.09, 0.24 + (i % 2) * 0.06, 0); g.add(l); }
    h = 0.42;
  }
  g.userData.h = h;
  return g;
}

// ---------- Coins ----------
let coinGeo, coinMat;
export function makeCoin() {
  coinGeo ??= new THREE.CylinderGeometry(0.2, 0.2, 0.07, 16);
  coinMat ??= new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.55, roughness: 0.3, emissive: 0x5a3a00, emissiveIntensity: 0.35 });
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.rotation.x = Math.PI / 2; m.castShadow = true;
  return m;
}

// ---------- Buildings ----------
const PASTELS = [0xffe0b2, 0xf8bbd0, 0xc5e1a5, 0xb3e5fc, 0xfff59d, 0xd1c4e9, 0xffccbc, 0xfffde7];
const ROOFS = [0xd84b3a, 0xc0392b, 0x3f6fb5, 0x8e5a3c, 0x2f8f6f, 0xe0823d];

function prismRoof(w, d, h, color) {
  const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, h); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2);
  const m = mesh(geo, color); m.rotation.y = Math.PI / 2; return m;
}

function windowMesh(w, h) {
  const g = new THREE.Group();
  const frame = mesh(roundedBox(w + 0.14, h + 0.14, 0.08, 0.03), 0xffffff); g.add(frame);
  const glass = mesh(roundedBox(w, h, 0.1, 0.02), 0x8fd3ff, { emissive: 0x1a4f7a, emissiveIntensity: 0.25 }); glass.position.z = 0.01; g.add(glass);
  const bar = S(G.box, 0xffffff, 0.05, h, 0.12); g.add(bar);
  const sill = S(G.box, 0xffffff, w + 0.3, 0.06, 0.18); sill.position.set(0, -h / 2 - 0.08, 0.05); g.add(sill);
  return g;
}

function solarHeater() {
  const g = new THREE.Group();
  const panel = mesh(roundedBox(1.2, 0.06, 0.9, 0.02), 0x1f3b73); panel.rotation.x = -0.5; panel.position.set(0, 0.35, 0.2); g.add(panel);
  const grid = S(G.box, 0x9fb7e0, 1.18, 0.065, 0.02); grid.rotation.x = -0.5; grid.position.set(0, 0.36, 0.2); g.add(grid);
  const tank = S(G.cyl, 0xf2f2f2, 0.24, 1.3, 0.24); tank.rotation.z = Math.PI / 2; tank.position.set(0, 0.65, -0.25); g.add(tank);
  for (const sx of [-1, 1]) { const leg = S(G.box, 0xaaaaaa, 0.05, 0.6, 0.05); leg.position.set(0.5 * sx, 0.3, -0.25); g.add(leg); }
  return g;
}

export function makeHouse(style, seed = Math.random()) {
  const rnd = mulberry(Math.floor(seed * 1e9));
  const g = new THREE.Group();
  const wall = PASTELS[Math.floor(rnd() * PASTELS.length)];
  const roof = ROOFS[Math.floor(rnd() * ROOFS.length)];
  let w, d, h;
  if (style === 'shikun') {
    w = 5.4; d = 4.4; h = 5.6;
    const base = mesh(roundedBox(w, h, d, 0.12), wall); base.position.y = h / 2; g.add(base);
    const stripe = S(G.box, 0xffffff, w + 0.04, 0.12, d + 0.04);
    for (const y of [1.9, 3.75]) { const s = stripe.clone(); s.position.y = y; g.add(s); }
    const parapet = mesh(roundedBox(w + 0.2, 0.3, d + 0.2, 0.06), 0xeeeeee); parapet.position.y = h + 0.1; g.add(parapet);
    for (let i = 0; i < 3; i++) { const sh = solarHeater(); sh.position.set(-1.6 + i * 1.6, h + 0.1, -0.6); sh.scale.setScalar(0.85); g.add(sh); }
    const ant = S(G.cylLo, 0x777777, 0.03, 1.2, 0.03); ant.position.set(2.2, h + 0.7, 1.4); g.add(ant);
    for (let fl = 0; fl < 3; fl++) {
      const y = 0.95 + fl * 1.85;
      for (const x of [-1.6, 1.6]) {
        if (fl === 0 && x > 0) continue;
        const wi = windowMesh(0.9, 0.85); wi.position.set(x, y, d / 2 + 0.02); g.add(wi);
      }
      if (fl > 0) {
        const bal = mesh(roundedBox(1.6, 0.12, 0.7, 0.04), 0xdddddd); bal.position.set(0.9, y - 0.6, d / 2 + 0.35); g.add(bal);
        const rail = mesh(roundedBox(1.6, 0.5, 0.06, 0.03), 0x9ccbe8, { transparent: true, opacity: 0.75 }); rail.position.set(0.9, y - 0.3, d / 2 + 0.68); g.add(rail);
        // laundry line, the most Israeli detail there is
        for (let k = 0; k < 4; k++) { const c = S(G.box, SHIRTS[Math.floor(rnd() * SHIRTS.length)], 0.22, 0.28, 0.03); c.position.set(0.3 + k * 0.38, y - 0.1, d / 2 + 0.72); g.add(c); }
      }
    }
  } else if (style === 'cottage') {
    w = 4.4; d = 3.8; h = 2.4;
    const base = mesh(roundedBox(w, h, d, 0.1), wall); base.position.y = h / 2; g.add(base);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.7, 4), mat(roof)); cone.castShadow = true;
    cone.rotation.y = Math.PI / 4; cone.scale.set(w / 4.6, 1, d / 4.6); cone.position.y = h + 0.85; g.add(cone);
    for (const x of [-1.25, 1.25]) { const wi = windowMesh(0.8, 0.75); wi.position.set(x, 1.35, d / 2 + 0.02); g.add(wi); }
    const sh = solarHeater(); sh.position.set(0.6, h + 0.6, -0.3); sh.scale.setScalar(0.7); g.add(sh);
  } else {
    w = 5; d = 4; h = 2.6;
    const base = mesh(roundedBox(w, h, d, 0.1), wall); base.position.y = h / 2; g.add(base);
    const r = prismRoof(w + 0.5, d + 0.6, 1.5, roof); r.position.y = h; g.add(r);
    const gable = prismRoof(w - 0.05, d - 0.05, 1.45, wall); gable.position.y = h; g.add(gable);
    const ch = mesh(roundedBox(0.45, 1.2, 0.45, 0.05), 0xa1665e); ch.position.set(1.4, h + 1.0, -0.6); g.add(ch);
    for (const x of [-1.45, 1.45]) { const wi = windowMesh(0.9, 0.8); wi.position.set(x, 1.4, d / 2 + 0.02); g.add(wi); }
    const sh = solarHeater(); sh.position.set(-1.2, h + 0.25, -1.1); sh.scale.setScalar(0.65); g.add(sh);
  }
  // door + step + lamp
  const door = mesh(roundedBox(0.95, 1.6, 0.12, 0.05), [0x8b5a2b, 0x2e7d32, 0x1565c0, 0xc62828][Math.floor(rnd() * 4)]);
  door.position.set(style === 'shikun' ? 1.6 : 0, 0.82, d / 2 + 0.04); g.add(door);
  const knob = S(G.sphere, 0xffd54f, 0.05); knob.position.set(door.position.x + 0.3, 0.8, d / 2 + 0.12); g.add(knob);
  const step = mesh(roundedBox(1.4, 0.14, 0.6, 0.04), 0xd7ccc8); step.position.set(door.position.x, 0.07, d / 2 + 0.3); g.add(step);
  const awn = mesh(roundedBox(1.3, 0.08, 0.5, 0.03), roof); awn.position.set(door.position.x, 1.8, d / 2 + 0.25); awn.rotation.x = 0.25; g.add(awn);
  // mailbox
  const mb = new THREE.Group();
  const post = S(G.box, 0x795548, 0.08, 0.8, 0.08); post.position.y = 0.4; mb.add(post);
  const box = mesh(roundedBox(0.36, 0.26, 0.24, 0.06), 0xe53935); box.position.y = 0.88; mb.add(box);
  mb.position.set(door.position.x - 1.4, 0, d / 2 + 1.5); g.add(mb);
  // bushes
  for (const x of [-w / 2 + 0.4, w / 2 - 0.4]) {
    const b = S(G.sphereLo, [0x5aa83a, 0x4c9a2f, 0x6dbb46][Math.floor(rnd() * 3)], 0.42, 0.38, 0.42); b.position.set(x, 0.3, d / 2 + 0.45); g.add(b);
  }
  g.userData = { w, d, h, door: new THREE.Vector3(door.position.x, 0, d / 2 + 1.35) };
  return g;
}

export function makeTree(kind = 'round', rnd = Math.random) {
  const g = new THREE.Group();
  if (kind === 'palm') {
    let y = 0, x = 0;
    for (let i = 0; i < 6; i++) { const s = S(G.cylLo, 0x9c7a4f, 0.13 - i * 0.008, 0.55, 0.13 - i * 0.008); s.position.set(x, y + 0.27, 0); s.rotation.z = -0.06 * i; g.add(s); y += 0.52; x += 0.035 * i; }
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.7, 4), mat(i % 2 ? 0x3f9b3a : 0x2f8a35)); leaf.castShadow = true;
      leaf.scale.z = 0.25; leaf.position.set(x, y, 0);
      leaf.rotation.set(0, (i / 7) * Math.PI * 2, 0); leaf.rotateX(1.95); leaf.translateY(-0.75);
      g.add(leaf);
    }
  } else {
    const t = S(G.cylLo, 0x8d5a3b, 0.16, 1.1, 0.16); t.position.y = 0.55; g.add(t);
    const greens = [0x5dbb3f, 0x4caf50, 0x7cc84a, 0x3e9f3a];
    for (let i = 0; i < 3; i++) {
      const s = 0.75 - i * 0.12;
      const b = S(G.sphereLo, greens[Math.floor(rnd() * greens.length)], s); b.position.set((rnd() - 0.5) * 0.5, 1.4 + i * 0.45, (rnd() - 0.5) * 0.5); g.add(b);
    }
    if (kind === 'lemon') for (let i = 0; i < 6; i++) { const l = S(G.sphereLo, 0xffe14d, 0.09); const a = rnd() * 6.28; l.position.set(Math.cos(a) * 0.65, 1.3 + rnd() * 0.8, Math.sin(a) * 0.65); g.add(l); }
  }
  return g;
}

export function makeVan(color, label) {
  const g = new THREE.Group();
  const body = mesh(roundedBox(2, 1.3, 3.4, 0.22), 0xf7f7f7); body.position.set(0, 1.0, -0.2); g.add(body);
  const cab = mesh(roundedBox(2, 1.0, 1.3, 0.25), 0xf7f7f7); cab.position.set(0, 0.85, 2.0); g.add(cab);
  const wind = mesh(roundedBox(1.7, 0.55, 0.1, 0.05), 0x7fc8f8, { emissive: 0x1a4f7a, emissiveIntensity: 0.3 }); wind.position.set(0, 1.05, 2.6); wind.rotation.x = -0.25; g.add(wind);
  const stripe = S(G.box, color, 2.04, 0.22, 3.0); stripe.position.set(0, 0.7, -0.2); g.add(stripe);
  const bumper = mesh(roundedBox(2.1, 0.25, 0.3, 0.08), 0x555555); bumper.position.set(0, 0.42, 2.65); g.add(bumper);
  for (const sx of [-1, 1]) {
    const hl = S(G.sphere, 0xfff3b0, 0.14, 0.1, 0.06, { emissive: 0xffe680, emissiveIntensity: 0.6 }); hl.position.set(0.7 * sx, 0.7, 2.66); g.add(hl);
    for (const z of [-1.3, 1.9]) { const wh = S(G.cyl, 0x222222, 0.4, 0.3, 0.4); wh.rotation.z = Math.PI / 2; wh.position.set(1.0 * sx, 0.4, z); g.add(wh); const hub = S(G.cyl, 0xbbbbbb, 0.18, 0.32, 0.18); hub.rotation.z = Math.PI / 2; hub.position.copy(wh.position); g.add(hub); }
  }
  // ladder on the roof
  for (const sx of [-1, 1]) { const r = S(G.box, 0xaaaaaa, 0.06, 0.06, 3.0); r.position.set(0.45 * sx, 1.72, -0.2); g.add(r); }
  for (let i = 0; i < 7; i++) { const r = S(G.box, 0xaaaaaa, 0.9, 0.05, 0.05); r.position.set(0, 1.72, -1.6 + i * 0.47); g.add(r); }
  // side sign
  const tex = textCanvas(512, 200, (x, W, H) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = '#' + color.toString(16).padStart(6, '0');
    x.font = '800 74px Fredoka, Rubik, sans-serif'; x.fillText(label, W / 2, 92);
    x.fillStyle = '#333'; x.font = '600 44px Fredoka, Rubik, sans-serif'; x.fillText('24/7 · 050-אולי', W / 2, 160);
  });
  for (const sx of [-1, 1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.05), new THREE.MeshLambertMaterial({ map: tex }));
    sign.position.set(1.011 * sx, 1.12, -0.25); sign.rotation.y = sx * Math.PI / 2; g.add(sign);
  }
  g.userData.sign = tex;
  return g;
}

export function makeCar(color) {
  const g = new THREE.Group();
  const body = mesh(roundedBox(1.5, 0.6, 2.8, 0.2), color); body.position.y = 0.55; g.add(body);
  const top = mesh(roundedBox(1.3, 0.55, 1.5, 0.2), color); top.position.set(0, 1.05, -0.15); g.add(top);
  const glass = mesh(roundedBox(1.32, 0.38, 1.3, 0.12), 0x9ad4f5); glass.position.set(0, 1.07, -0.15); g.add(glass);
  for (const sx of [-1, 1]) for (const z of [-0.9, 0.9]) { const w = S(G.cyl, 0x222222, 0.3, 0.24, 0.3); w.rotation.z = Math.PI / 2; w.position.set(0.72 * sx, 0.3, z); g.add(w); }
  return g;
}

export function makeCat(color) {
  const g = new THREE.Group();
  const body = S(G.capsule, color, 0.14, 0.3, 0.14); body.rotation.x = Math.PI / 2; body.position.y = 0.25; g.add(body);
  const head = S(G.sphere, color, 0.15); head.position.set(0, 0.4, 0.25); g.add(head);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), mat(color)); ear.position.set(0.08 * sx, 0.55, 0.25); g.add(ear);
    const eye = S(G.sphere, 0x111111, 0.025); eye.position.set(0.06 * sx, 0.42, 0.38); g.add(eye);
  }
  const tail = S(G.capsule, color, 0.035, 0.3, 0.035); tail.position.set(0, 0.4, -0.32); tail.rotation.x = -0.6; g.add(tail);
  for (let i = 0; i < 4; i++) { const l = S(G.cylLo, color, 0.04, 0.2, 0.04); l.position.set(i < 2 ? -0.08 : 0.08, 0.1, i % 2 ? 0.15 : -0.15); g.add(l); }
  g.userData.tail = tail;
  return g;
}

export function makeLamp() {
  const g = new THREE.Group();
  const p = S(G.cylLo, 0x37474f, 0.06, 3, 0.06); p.position.y = 1.5; g.add(p);
  const arm = S(G.box, 0x37474f, 0.06, 0.06, 0.6); arm.position.set(0, 2.95, 0.27); g.add(arm);
  const l = S(G.sphere, 0xfff6c8, 0.17, 0.1, 0.17, { emissive: 0xffe082, emissiveIntensity: 0.5 }); l.position.set(0, 2.88, 0.55); g.add(l);
  return g;
}

export function makeFalafel() {
  const g = new THREE.Group();
  const counter = mesh(roundedBox(2.4, 1.1, 1.2, 0.1), 0xffb74d); counter.position.y = 0.55; g.add(counter);
  const top = mesh(roundedBox(2.5, 0.1, 1.3, 0.04), 0xffffff); top.position.y = 1.12; g.add(top);
  for (const sx of [-1, 1]) { const p = S(G.cylLo, 0xeeeeee, 0.05, 1.4, 0.05); p.position.set(1.1 * sx, 1.8, 0.5); g.add(p); }
  const aw = mesh(roundedBox(2.7, 0.12, 1.6, 0.05), 0xe53935); aw.position.set(0, 2.5, 0.2); aw.rotation.x = 0.18; g.add(aw);
  for (let i = 0; i < 6; i++) { const s = S(G.box, 0xffffff, 0.44, 0.13, 1.6); s.position.set(-1.1 + i * 0.45, 2.5, 0.2); s.rotation.x = 0.18; if (i % 2) g.add(s); }
  for (let i = 0; i < 5; i++) { const b = S(G.sphereLo, 0x8d5524, 0.08); b.position.set(-0.5 + i * 0.22, 1.22, 0.1); g.add(b); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshLambertMaterial({
    map: textCanvas(512, 128, (x, W, H) => { x.fillStyle = '#fffbea'; x.fillRect(0, 0, W, H); x.fillStyle = '#c62828'; x.font = '800 78px Fredoka, Rubik, sans-serif'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('פלאפל אצל ג׳ורג׳', W / 2, 92); }) }));
  sign.position.set(0, 2.85, 1.0); sign.rotation.x = -0.2; g.add(sign);
  return g;
}

export function makeFence(len) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 0.6));
  for (let i = 0; i < n; i++) { const p = mesh(roundedBox(0.12, 0.7, 0.08, 0.03), 0xffffff); p.position.set(-len / 2 + (i + 0.5) * (len / n), 0.35, 0); g.add(p); }
  for (const y of [0.25, 0.55]) { const r = S(G.box, 0xffffff, len, 0.07, 0.05); r.position.y = y; g.add(r); }
  return g;
}

export function makeFlowers(rnd = Math.random) {
  const g = new THREE.Group();
  const cols = [0xff5c8a, 0xffd93d, 0xffffff, 0xb388ff, 0xff8a65];
  for (let i = 0; i < 6; i++) {
    const s = S(G.cylLo, 0x3f8f2f, 0.015, 0.3, 0.015); const x = (rnd() - 0.5) * 0.8, z = (rnd() - 0.5) * 0.8; s.position.set(x, 0.15, z); g.add(s);
    const f = S(G.sphereLo, cols[Math.floor(rnd() * cols.length)], 0.07); f.position.set(x, 0.32, z); g.add(f);
  }
  return g;
}

export function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
