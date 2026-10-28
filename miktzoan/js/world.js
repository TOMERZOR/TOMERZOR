// The neighbourhood: ground, roads, houses, base, ambient life, lights and camera.
import * as THREE from 'three';
import * as M from './models.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

export const RING = 11.6;      // half-size of the ring road (centre line)
const ROAD_W = 3.4;
export const BOUNDS = 27;

// Where customers live. rot turns the house so its door faces the road.
export const HOUSE_SLOTS = [
  { x: 0, z: -19.5, rot: 0, style: 'villa', unlock: 1 },
  { x: -19.5, z: -1, rot: Math.PI / 2, style: 'cottage', unlock: 1 },
  { x: 19.5, z: 1, rot: -Math.PI / 2, style: 'shikun', unlock: 1 },
  { x: 0, z: 19.5, rot: Math.PI, style: 'shikun', unlock: 2 },
  { x: -15, z: -19.5, rot: 0, style: 'cottage', unlock: 3 },
  { x: 15, z: -19.5, rot: 0, style: 'villa', unlock: 3 },
  { x: -15, z: 19.5, rot: Math.PI, style: 'villa', unlock: 4 },
  { x: 15, z: 19.5, rot: Math.PI, style: 'cottage', unlock: 5 },
];

export const BASE = {
  van: new THREE.Vector3(-6, 0, -4.2),
  pallet: new THREE.Vector3(-6, 0, -0.6),
  falafel: new THREE.Vector3(5.6, 0, -6.4),
  spawn: new THREE.Vector3(0, 0, 0.5),
  padsZ: 5.6,
};

export class World {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;

    const s = this.scene = new THREE.Scene();
    this.sky = new THREE.Color(0xbfe6ff);
    s.background = this.sky;
    s.fog = new THREE.Fog(this.sky, 70, 130);

    this.camera = new THREE.PerspectiveCamera(34, 1, 1, 300);
    this.camTarget = new THREE.Vector3();
    this.camShake = 0;

    this.hemi = new THREE.HemisphereLight(0xd8eeff, 0x86b25a, 1.25);
    s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    s.add(sun); s.add(sun.target);

    this.colliders = [];   // {minX,maxX,minZ,maxZ}
    this.circles = [];     // {x,z,r}
    this.houses = [];
    this.anim = [];        // ambient animation callbacks
    this.st = new THREE.Group(); // static scenery, merged into a few meshes by bake()
    s.add(this.st);
    this.buildGround();
    this.buildRoads();
    this.buildBase();
    this.buildHouses();
    this.buildNature();
    this.buildLife();
    this.bake();
    this.resize();
  }

  // Merge every static mesh into one mesh per material: thousands of draw calls become ~100.
  bake() {
    this.st.updateMatrixWorld(true);
    const buckets = new Map();
    this.st.traverse(o => {
      if (!o.isMesh) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(o.matrixWorld);
      const key = o.material.uuid + (o.castShadow ? 's' : '');
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
      buckets.get(key).geos.push(g);
    });
    this.scene.remove(this.st);
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, b.mat);
      m.castShadow = b.cast; m.receiveShadow = true;
      this.scene.add(m);
      for (const g of b.geos) g.dispose();
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // keep ~15 units across in portrait, ~19 units tall in landscape
    this.camDist = Math.max(10 / (2 * t * this.camera.aspect), 13.5 / (2 * t));
  }

  followCam(target, dt, snap) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    this.camTarget.lerp(target, k);
    const el = THREE.MathUtils.degToRad(52);
    const d = this.camDist;
    const shake = this.camShake > 0 ? (Math.random() - 0.5) * this.camShake : 0;
    this.camShake = Math.max(0, this.camShake - dt * 2);
    this.camera.position.set(this.camTarget.x + shake, this.camTarget.y + Math.sin(el) * d, this.camTarget.z + Math.cos(el) * d + shake);
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 0.6, this.camTarget.z);
    this.sun.position.set(this.camTarget.x + 14, 30, this.camTarget.z + 10);
    this.sun.target.position.copy(this.camTarget);
  }

  // day progress 0..1 tints the light from morning to sunset
  setDayTime(p) {
    const morning = new THREE.Color(0xfff1d6), noon = new THREE.Color(0xffffff), dusk = new THREE.Color(0xffa76b);
    const c = p < 0.5 ? morning.clone().lerp(noon, p * 2) : noon.clone().lerp(dusk, (p - 0.5) * 2);
    this.sun.color.copy(c);
    this.sun.intensity = 2.1 - Math.max(0, p - 0.75) * 2.2;
    const sky = new THREE.Color(0xbfe6ff).lerp(new THREE.Color(0xffc9a3), Math.max(0, p - 0.7) / 0.3);
    this.sky.copy(sky); this.scene.fog.color.copy(sky);
  }

  buildGround() {
    const tex = M.textCanvas(1024, 1024, (x, W, H) => {
      x.fillStyle = '#86c95a'; x.fillRect(0, 0, W, H);
      const rnd = M.mulberry(7);
      for (let i = 0; i < 260; i++) {
        const cx = rnd() * W, cy = rnd() * H, r = 20 + rnd() * 90;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        const c = rnd() < 0.5 ? '120,190,80' : '150,214,96';
        g.addColorStop(0, `rgba(${c},0.45)`); g.addColorStop(1, `rgba(${c},0)`);
        x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      x.strokeStyle = 'rgba(70,140,50,0.5)'; x.lineWidth = 2;
      for (let i = 0; i < 1400; i++) { const cx = rnd() * W, cy = rnd() * H; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + (rnd() - 0.5) * 6, cy - 6 - rnd() * 6); x.stroke(); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 6);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshLambertMaterial({ map: tex }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
    this.scene.add(g);
  }

  buildRoads() {
    const asphalt = M.textCanvas(256, 256, (x, W, H) => {
      x.fillStyle = '#5d6470'; x.fillRect(0, 0, W, H);
      const rnd = M.mulberry(3);
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rnd() * 0.05})`; x.fillRect(rnd() * W, rnd() * H, 2, 2); }
      x.fillStyle = '#f5f1e3'; x.fillRect(W / 2 - 5, 30, 10, 110);
    });
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
    const curbMat = M.mat(0xe8e2d4);
    const full = RING * 2 + ROAD_W;
    const strip = (cx, cz, len, horiz) => {
      const t = asphalt.clone(); t.needsUpdate = true; t.repeat.set(1, len / 3.4);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, len), new THREE.MeshLambertMaterial({ map: t }));
      m.rotation.x = -Math.PI / 2; if (horiz) m.rotation.z = Math.PI / 2;
      m.position.set(cx, 0.02, cz); m.receiveShadow = true; this.scene.add(m);
    };
    strip(0, -RING, full - ROAD_W, true); strip(0, RING, full - ROAD_W, true);
    strip(-RING, 0, full - ROAD_W, false); strip(RING, 0, full - ROAD_W, false);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_W), new THREE.MeshLambertMaterial({ color: 0x5d6470 }));
      c.rotation.x = -Math.PI / 2; c.position.set(RING * sx, 0.02, RING * sz); c.receiveShadow = true; this.scene.add(c);
    }
    // curbs on both sides of the ring
    for (const off of [-ROAD_W / 2 - 0.15, ROAD_W / 2 + 0.15]) {
      const r = RING + off, L = r * 2 + 0.3;
      for (const [x, z, w, d] of [[0, -r, L, 0.3], [0, r, L, 0.3], [-r, 0, 0.3, L], [r, 0, 0.3, L]]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), curbMat); c.position.set(x, 0.07, z); c.receiveShadow = true; this.st.add(c);
      }
    }
    // plaza tiles inside the ring (honeycomb, warm sand)
    // canvas sized to whole hex periods (3R wide, √3R tall) so the texture tiles without seams
    const R = 32, hgt = Math.sqrt(3) * R, TW = 6 * 3 * R, TH = Math.round(10 * hgt);
    const tiles = M.textCanvas(TW, TH, (x, W, H) => {
      x.fillStyle = '#f3d79a'; x.fillRect(0, 0, W, H);
      x.scale(1, H / (10 * hgt));
      for (let row = -1; row < H / hgt + 1; row++) for (let col = -1; col < W / (R * 1.5) + 1; col++) {
        const cx = col * R * 1.5, cy = row * hgt + (col % 2 ? hgt / 2 : 0);
        x.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; x.lineTo(cx + Math.cos(a) * (R - 2.5), cy + Math.sin(a) * (R - 2.5)); }
        x.closePath();
        const shade = ((((col % 6) + 6) % 6 * 7 + (((row % 10) + 10) % 10) * 13) % 5) * 4;
        x.fillStyle = `rgb(${250 - shade},${226 - shade},${168 - shade})`; x.fill();
        x.strokeStyle = 'rgba(200,160,90,0.55)'; x.lineWidth = 3; x.stroke();
      }
    });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(4, 4 * TW / TH);
    const inner = (RING - ROAD_W / 2 - 0.3) * 2;
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(inner, inner), new THREE.MeshLambertMaterial({ map: tiles }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; plaza.receiveShadow = true; this.scene.add(plaza);
  }

  buildBase() {
    // pallet where supplies appear
    const pallet = new THREE.Group();
    for (let i = 0; i < 5; i++) { const p = M.mesh(new THREE.BoxGeometry(2.0, 0.1, 0.32), 0xc8a165); p.position.set(0, 0.22, -0.8 + i * 0.4); pallet.add(p); }
    for (const x of [-0.85, 0, 0.85]) { const b = M.mesh(new THREE.BoxGeometry(0.2, 0.18, 1.9), 0xa9814d); b.position.set(x, 0.09, 0); pallet.add(b); }
    pallet.position.copy(BASE.pallet); this.st.add(pallet);
    this.pallet = pallet;
    this.colliders.push(box(BASE.pallet.x, BASE.pallet.z, 1.0, 1.0));

    // pickup zone marker
    this.pickupZone = dashedSquare(3.6, 0xffffff);
    this.pickupZone.position.set(BASE.pallet.x, 0.05, BASE.pallet.z); this.scene.add(this.pickupZone);

    const f = M.makeFalafel(); f.position.copy(BASE.falafel); this.st.add(f);
    this.colliders.push(box(BASE.falafel.x, BASE.falafel.z, 1.3, 0.7));
    const george = M.makePerson({ shirt: 0xffffff, hairStyle: 'bald', mustache: true });
    george.position.set(BASE.falafel.x, 0, BASE.falafel.z - 1.0); this.scene.add(george);
    this.anim.push(dt => M.animatePerson(george, dt, false));
    this.george = george;

    for (const [x, z] of [[8, -1.5], [-8.6, 7.8], [8.4, 8.4]]) { const t = M.makeTree(x > 0 && z < 0 ? 'lemon' : 'round'); t.position.set(x, 0, z); this.st.add(t); this.circles.push({ x, z, r: 0.45 }); }
    for (const [x, z] of [[-8.6, -8.6], [8.6, -8.8]]) { const l = M.makeLamp(); l.position.set(x, 0, z); this.st.add(l); this.circles.push({ x, z, r: 0.2 }); }
    const bench = new THREE.Group();
    const seat = M.mesh(M.roundedBox(1.8, 0.12, 0.5, 0.04), 0x8d5a3b); seat.position.y = 0.45; bench.add(seat);
    const back = M.mesh(M.roundedBox(1.8, 0.45, 0.1, 0.04), 0x8d5a3b); back.position.set(0, 0.75, -0.22); bench.add(back);
    for (const sx of [-1, 1]) { const l = M.mesh(new THREE.BoxGeometry(0.1, 0.45, 0.45), 0x37474f); l.position.set(0.75 * sx, 0.22, 0); bench.add(l); }
    bench.position.set(8, 0, 1.2); bench.rotation.y = -Math.PI / 2; this.st.add(bench);
    this.colliders.push(box(8, 1.2, 0.35, 1.0));
  }

  setVan(color, label) {
    if (this.van) this.scene.remove(this.van);
    const v = this.van = M.makeVan(color, label);
    v.position.copy(BASE.van); v.rotation.y = Math.PI; this.scene.add(v);
    if (!this.vanBox) { this.vanBox = box(BASE.van.x, BASE.van.z - 0.3, 1.05, 2.9); this.colliders.push(this.vanBox); }
  }

  buildHouses() {
    HOUSE_SLOTS.forEach((slot, i) => {
      const h = M.makeHouse(slot.style, i * 0.137 + 0.21);
      h.position.set(slot.x, 0, slot.z); h.rotation.y = slot.rot; this.st.add(h);
      const { w, d, door } = h.userData;
      const doorW = door.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rot).add(h.position);
      const horiz = Math.abs(Math.sin(slot.rot)) < 0.5;
      this.colliders.push(box(slot.x, slot.z, (horiz ? w : d) / 2 + 0.1, (horiz ? d : w) / 2 + 0.1));
      // little walkway from the door to the road
      const toRoad = new THREE.Vector3(Math.sin(slot.rot), 0, Math.cos(slot.rot));
      const startDist = d / 2 + 0.3, endDist = Math.abs((horiz ? slot.z : slot.x)) - RING - ROAD_W / 2;
      const len = endDist - startDist;
      const doorStep = h.userData.door.clone().setZ(d / 2 + 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rot).add(h.position);
      const path = new THREE.Mesh(new THREE.PlaneGeometry(1.3, len), M.mat(0xeadcc0));
      path.rotation.x = -Math.PI / 2; path.rotation.z = slot.rot;
      path.position.copy(doorStep).addScaledVector(toRoad, len / 2); path.position.y = 0.025;
      path.receiveShadow = true; this.st.add(path);
      // fence segments either side of the yard
      for (const side of [-1, 1]) {
        const f = M.makeFence(len - 0.4);
        const along = h.position.clone().addScaledVector(toRoad, startDist + len / 2);
        const sideV = new THREE.Vector3(Math.cos(slot.rot), 0, -Math.sin(slot.rot));
        f.position.copy(along).addScaledVector(sideV, side * (w / 2 + 0.3));
        f.rotation.y = slot.rot + Math.PI / 2; this.st.add(f);
      }
      const flowers = M.makeFlowers(); flowers.position.copy(h.position).addScaledVector(toRoad, d / 2 + 1.2).addScaledVector(new THREE.Vector3(Math.cos(slot.rot), 0, -Math.sin(slot.rot)), -w / 2 + 0.9); this.st.add(flowers);
      // houses whose door faces away from the camera fade out when the player walks behind them
      let fadeMats = null;
      if (Math.cos(slot.rot) < -0.5) {
        this.scene.add(h); // stays live (not baked) so it can fade
        fadeMats = [];
        h.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; fadeMats.push(o.material); } });
      }
      this.houses.push({ i, slot, group: h, door: doorW, facing: toRoad, lockSign: null, fadeMats, fade: 1, w, d });
    });
  }

  setLocks(level) {
    for (const h of this.houses) {
      const locked = level < h.slot.unlock;
      if (locked && !h.lockSign) {
        const tex = M.textCanvas(256, 160, (x, W, H) => {
          x.fillStyle = '#7b4a26'; M.rr(x, 4, 4, W - 8, H - 8, 18); x.fill();
          x.fillStyle = '#fff3d6'; M.rr(x, 14, 14, W - 28, H - 28, 12); x.fill();
          x.fillStyle = '#7b4a26'; x.textAlign = 'center'; x.direction = 'rtl';
          x.font = '800 44px Fredoka, Rubik, sans-serif'; x.fillText('🔒 רמה ' + h.slot.unlock, W / 2, 70);
          x.font = '600 28px Fredoka, Rubik, sans-serif'; x.fillText('לקוחות VIP', W / 2, 115);
        });
        const s = new THREE.Group();
        const post = M.mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), 0x7b4a26); post.position.y = 0.7; s.add(post);
        const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); board.position.y = 1.5; s.add(board);
        s.position.copy(h.door).addScaledVector(h.facing, 1.2);
        this.scene.add(s); h.lockSign = s;
      } else if (!locked && h.lockSign) {
        this.scene.remove(h.lockSign); h.lockSign = null;
      }
    }
  }

  buildNature() {
    const rnd = M.mulberry(42);
    const ok = (x, z) => {
      if (Math.abs(x) < RING + ROAD_W && Math.abs(z) < RING + ROAD_W) return false;
      for (const s of HOUSE_SLOTS) if (Math.abs(x - s.x) < 4.5 && Math.abs(z - s.z) < 4.5) return false;
      for (const s of HOUSE_SLOTS) { // keep the walkways clear
        const horiz = Math.abs(Math.sin(s.rot)) < 0.5;
        if (horiz && Math.abs(x - s.x) < 3.4 && Math.abs(z) < Math.abs(s.z)) return false;
        if (!horiz && Math.abs(z - s.z) < 3.4 && Math.abs(x) < Math.abs(s.x)) return false;
      }
      return true;
    };
    let placed = 0;
    for (let n = 0; n < 900 && placed < 70; n++) {
      const x = (rnd() - 0.5) * 66, z = (rnd() - 0.5) * 66;
      if (!ok(x, z)) continue;
      const kind = rnd() < 0.3 ? 'palm' : rnd() < 0.15 ? 'lemon' : 'round';
      const t = M.makeTree(kind, rnd); t.position.set(x, 0, z); t.rotation.y = rnd() * 6; t.scale.setScalar(0.85 + rnd() * 0.35);
      this.st.add(t); this.circles.push({ x, z, r: 0.45 }); placed++;
    }
    for (let n = 0; n < 60; n++) {
      const x = (rnd() - 0.5) * 60, z = (rnd() - 0.5) * 60; if (!ok(x, z)) continue;
      const f = M.makeFlowers(rnd); f.position.set(x, 0, z); this.st.add(f);
    }
    // lamps along the ring
    for (let i = -1; i <= 1; i += 2) for (const [x, z, r] of [[i * 6, -RING - 2.3, Math.PI], [i * 6, RING + 2.3, 0], [-RING - 2.3, i * 7, -Math.PI / 2], [RING + 2.3, i * 7, Math.PI / 2]]) {
      const l = M.makeLamp(); l.position.set(x, 0, z); l.rotation.y = r; this.st.add(l); this.circles.push({ x, z, r: 0.2 });
    }
  }

  buildLife() {
    // cars loop the ring
    const L = RING * 8;
    const cars = [0xe74c3c, 0x3498db, 0xf1c40f].map((c, i) => { const m = M.makeCar(c); this.scene.add(m); return { m, s: i * L / 3, v: 5 + i }; });
    const along = (s, lane) => {
      s = ((s % L) + L) % L; const R = RING + lane;
      const seg = Math.floor(s / (RING * 2)), u = (s % (RING * 2)) - RING;
      return [[u, -R, Math.PI / 2], [R, u, 0], [-u, R, -Math.PI / 2], [-R, -u, Math.PI]][seg];
    };
    this.cars = cars;
    this.anim.push((dt, t) => {
      for (const c of cars) {
        c.s += c.v * dt;
        const [x, z, r] = along(c.s, -0.8);
        c.m.position.set(x, 0, z);
        c.m.rotation.y = THREE.MathUtils.lerp(c.m.rotation.y, r, 0.25);
        if (Math.abs(c.m.rotation.y - r) > 3) c.m.rotation.y = r;
        c.m.position.y = Math.abs(Math.sin(t * 8 + c.s)) * 0.03;
      }
    });
    // street cats, a national treasure
    this.cats = [0xff9f43, 0x2d3436, 0xdfe6e9, 0xb2967d].map((c, i) => {
      const m = M.makeCat(c); const a = i * 1.7;
      m.position.set(Math.cos(a) * 15, 0, Math.sin(a) * 15); this.scene.add(m);
      return { m, target: m.position.clone(), wait: Math.random() * 3 };
    });
    this.anim.push((dt, t, player) => {
      for (const c of this.cats) {
        const flee = player && c.m.position.distanceTo(player) < 2.2;
        if (flee && !c.fleeing) { c.fleeing = 1.5; c.target.copy(c.m.position).add(c.m.position.clone().sub(player).setY(0).normalize().multiplyScalar(6)); clampV(c.target); this.onCat?.(c.m.position); }
        const d = c.target.clone().sub(c.m.position); d.y = 0;
        if (d.length() < 0.2) {
          c.fleeing = 0;
          c.wait -= dt; if (c.wait < 0) { c.wait = 2 + Math.random() * 5; c.target.set((Math.random() - 0.5) * 50, 0, (Math.random() - 0.5) * 50); clampV(c.target); }
          c.m.userData.tail.rotation.z = Math.sin(t * 3) * 0.4;
        } else {
          const sp = c.fleeing ? 7 : 1.6;
          d.normalize(); c.m.position.addScaledVector(d, Math.min(sp * dt, 99));
          c.m.rotation.y = Math.atan2(d.x, d.z);
          c.m.position.y = Math.abs(Math.sin(t * (c.fleeing ? 22 : 10))) * 0.06;
        }
      }
    });
  }

  update(dt, t, player) {
    for (const f of this.anim) f(dt, t, player);
    for (const h of this.houses) {
      if (!h.fadeMats) continue;
      const p = h.group.position;
      const behind = player && Math.abs(player.x - p.x) < h.w / 2 + 1.2 && player.z < p.z && player.z > p.z - h.d / 2 - 6.5;
      const target = behind ? 0.28 : 1;
      if (Math.abs(h.fade - target) < 0.005) continue;
      h.fade += (target - h.fade) * Math.min(1, dt * 8);
      for (const m of h.fadeMats) { m.opacity = h.fade; m.depthWrite = h.fade > 0.9; }
    }
  }

  // push a circle (x,z,r) out of every collider; returns the corrected vector
  collide(p, r) {
    for (const b of this.colliders) {
      const cx = Math.max(b.minX, Math.min(b.maxX, p.x)), cz = Math.max(b.minZ, Math.min(b.maxZ, p.z));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
        else { // inside: push out on the shortest axis
          const opts = [[b.minX - r - p.x, 0], [b.maxX + r - p.x, 0], [0, b.minZ - r - p.z], [0, b.maxZ + r - p.z]];
          opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1])); p.x += opts[0][0]; p.z += opts[0][1];
        }
      }
    }
    for (const c of this.circles) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
    p.x = Math.max(-BOUNDS, Math.min(BOUNDS, p.x)); p.z = Math.max(-BOUNDS, Math.min(BOUNDS, p.z));
    return p;
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

function clampV(v) { v.x = Math.max(-BOUNDS + 1, Math.min(BOUNDS - 1, v.x)); v.z = Math.max(-BOUNDS + 1, Math.min(BOUNDS - 1, v.z)); }
function box(x, z, hx, hz) { return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz }; }

export function dashedSquare(size, color) {
  const tex = M.textCanvas(256, 256, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    x.strokeStyle = '#ffffff'; x.lineWidth = 12; x.setLineDash([26, 18]); x.lineCap = 'round';
    M.rr(x, 12, 12, W - 24, H - 24, 34); x.stroke();
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color, opacity: 0.9, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function ringMarker(color) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
  fill.rotation.x = -Math.PI / 2; g.add(fill);
  g.userData = { ring, fill };
  return g;
}
