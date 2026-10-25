// Builds the base: walls, floors and ceilings with baked corner shading, doorways, furniture,
// fluorescent fixtures (with a small pool of real lights that follows the player), the yard and the gate.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP, W, D, CELL, H, ch, isOutdoor, isLock, locks, walkable } from './map.js';
import * as T from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Collects static geometry per material and merges it into one mesh each.
class Batcher {
  constructor() { this.buckets = new Map(); }
  add(geo, mat, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    const g = geo.clone();
    const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const geoN = g.index ? g.toNonIndexed() : g;
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(geoN);
  }
  build(parent, { cast = true, receive = true } = {}) {
    for (const [mat, list] of this.buckets) {
      const g = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.buckets.clear();
  }
}

// Quad soup with per-vertex colour (baked ambient occlusion).
class Soup {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  quad(a, b, c, d, n, uva, uvb, uvc, uvd, ca = 1, cb = 1, cc = 1, cd = 1) {
    const P = [a, b, c, a, c, d], U = [uva, uvb, uvc, uva, uvc, uvd], C = [ca, cb, cc, ca, cc, cd];
    for (let i = 0; i < 6; i++) {
      this.p.push(P[i].x, P[i].y, P[i].z); this.n.push(n.x, n.y, n.z);
      this.uv.push(U[i][0], U[i][1]); this.c.push(C[i], C[i], C[i]);
    }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.castShadow = true; m.matrixAutoUpdate = false;
    return m;
  }
}

const solidC = (c) => c === '#' || c === 'F';

export class World {
  constructor(scene, tex, models, quality) {
    this.scene = scene;
    this.tex = tex;
    this.models = models;
    this.quality = quality;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.colliders = [];          // {minX,maxX,minZ,maxZ}
    this.fixtures = [];           // ceiling lights
    this.doors = {};              // lock char -> {pivot, open, target}
    this.lockers = [];            // hiding spots
    this.dynamic = [];            // things with update(dt,t)
    this.power = true;
    this.alarm = 0;               // red alarm mode for the final chase
    this.decals = new THREE.Group(); this.root.add(this.decals);
    this.blockedAI = new Set();
    this.bounds = {};
  }

  addBox(minX, maxX, minZ, maxZ, aiBlock = false) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
    if (aiBlock) {
      for (let x = Math.floor(minX / CELL); x <= Math.floor(maxX / CELL); x++)
        for (let z = Math.floor(minZ / CELL); z <= Math.floor(maxZ / CELL); z++) {
          const cx = (x + 0.5) * CELL, cz = (z + 0.5) * CELL;
          if (cx > minX - 0.25 && cx < maxX + 0.25 && cz > minZ - 0.25 && cz < maxZ + 0.25) this.blockedAI.add(z * W + x);
        }
    }
  }

  materials() {
    const t = this.tex;
    const M = {};
    const std = (o) => new THREE.MeshStandardMaterial(o);
    t.wall.repeat.set(1, 1);
    M.wall = std({ map: t.wall, normalMap: t.wall_n, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.48, metalness: 0.35, vertexColors: true, envMapIntensity: 0.35 });
    M.wallB = std({ map: t.wall, normalMap: t.wall_n, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.48, metalness: 0.35, color: 0xbdbdb6, envMapIntensity: 0.35 });
    M.mazeWall = std({ map: t.wall, normalMap: t.wall_n, color: 0xd9c98c, roughness: 0.6, metalness: 0.2, vertexColors: true, envMapIntensity: 0.25 });
    M.extWall = std({ map: t.wall, normalMap: t.wall_n, color: 0x8d9089, roughness: 0.7, metalness: 0.25, vertexColors: true });
    M.floor = std({ map: t.floor, normalMap: t.floor_n, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: t.floor_r, roughness: 1, metalness: 0.0, vertexColors: true, envMapIntensity: 0.9 });
    M.mazeFloor = std({ map: t.floor, normalMap: t.floor_n, roughnessMap: t.floor_r, color: 0xc8b98a, roughness: 1, vertexColors: true, envMapIntensity: 0.7 });
    M.ceiling = std({ map: t.ceiling, normalMap: t.ceiling_n, roughness: 0.95, vertexColors: true, envMapIntensity: 0.2 });
    M.padded = std({ map: T.paddedTex(), roughness: 0.95, vertexColors: true });
    M.ground = std({ map: T.groundTex(), roughness: 0.92, color: 0x8a8a86 });
    M.ground.map.repeat.set(30, 30);
    M.metal = std({ color: 0x6d726c, roughness: 0.45, metalness: 0.7 });
    M.darkMetal = std({ color: 0x2c2f2c, roughness: 0.5, metalness: 0.7 });
    M.chrome = std({ color: 0xb8bcbc, roughness: 0.22, metalness: 1 });
    M.frame = std({ color: 0x9aa09a, roughness: 0.5, metalness: 0.5 });
    M.wood = std({ color: 0x7a5a3a, roughness: 0.75 });
    M.formica = std({ color: 0xc9c3b2, roughness: 0.55 });
    M.white = std({ color: 0xe7e3d8, roughness: 0.6 });
    M.plastic = std({ color: 0x2d3a2f, roughness: 0.6 });
    M.blanket = std({ map: T.fabricTex('#4b5330'), roughness: 0.95 });
    M.mattress = std({ map: T.fabricTex('#3b5163'), roughness: 0.9 });
    M.pillow = std({ map: T.fabricTex('#d8d4c8'), roughness: 0.9 });
    M.locker = std({ map: T.lockerTex(), roughness: 0.5, metalness: 0.55 });
    M.glass = new THREE.MeshPhysicalMaterial({ color: 0xaab8b6, roughness: 0.08, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.18, envMapIntensity: 1.2, depthWrite: false });
    M.tubeHousing = std({ color: 0xcfd2cc, roughness: 0.4, metalness: 0.6 });
    M.tube = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xe8f4ff, emissiveIntensity: 4, roughness: 1 });
    M.screen = new THREE.MeshStandardMaterial({ color: 0x050605, emissive: 0x0, roughness: 0.2 });
    M.rubber = std({ color: 0x111111, roughness: 0.9 });
    M.olive = std({ color: 0x4a5235, roughness: 0.85 });
    M.yellow = std({ color: 0xd6b31c, roughness: 0.5 });
    M.red = std({ color: 0x7a1010, roughness: 0.6 });
    M.mopString = std({ color: 0x8c8676, roughness: 1 });
    M.cardboard = std({ color: 0x8e6c45, roughness: 0.95 });
    M.tile = std({ color: 0xdfe3e0, roughness: 0.25, metalness: 0.05 });
    M.curtain = std({ color: 0x6f8f8a, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    M.fence = new THREE.MeshStandardMaterial({ map: T.chainLinkTex(), alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.8, color: 0xb0b4b4 });
    M.post = std({ color: 0x5c605c, roughness: 0.5, metalness: 0.7 });
    this.M = M;
    return M;
  }

  build() {
    const M = this.materials();
    this.buildShell();
    this.buildDoors();
    this.buildFixtures();
    this.furnish();
    this.buildOutside();
    this.buildSignage();
  }

  // Walls, floors and ceilings from the grid.
  buildShell() {
    const M = this.M;
    const soups = { wall: new Soup(), mazeWall: new Soup(), extWall: new Soup(), floor: new Soup(), mazeFloor: new Soup(), ceiling: new Soup(), padded: new Soup() };
    const open = (c) => !solidC(c);
    const solidForAO = (x, z) => { const c = ch(x, z); return solidC(c) || (isLock(c)); };
    const ao = (x, z) => { // vertex at grid corner (x,z): count solid cells around it
      let n = 0;
      for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) if (solidForAO(x + dx, z + dz)) n++;
      return [1, 0.82, 0.62, 0.5, 0.5][n];
    };
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const c = ch(x, z);
      if (!open(c)) continue;
      const x0 = x * CELL, x1 = x0 + CELL, z0 = z * CELL, z1 = z0 + CELL;
      const out = isOutdoor(c);
      // floor & ceiling (outdoor floor is the ground plane)
      if (!out) {
        const fs = c === 'm' ? soups.mazeFloor : soups.floor;
        const a00 = ao(x, z), a10 = ao(x + 1, z), a11 = ao(x + 1, z + 1), a01 = ao(x, z + 1);
        fs.quad(V(x0, 0, z0), V(x0, 0, z1), V(x1, 0, z1), V(x1, 0, z0), V(0, 1, 0),
          [x0 / 2, z0 / 2], [x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2], a00, a01, a11, a10);
        const cs = c === 'n' ? soups.padded : soups.ceiling;
        soups.ceiling === cs
          ? cs.quad(V(x0, H, z0), V(x1, H, z0), V(x1, H, z1), V(x0, H, z1), V(0, -1, 0), [x0 / 3, z0 / 3], [x1 / 3, z0 / 3], [x1 / 3, z1 / 3], [x0 / 3, z1 / 3], a00 * 0.9 + 0.1, a10 * 0.9 + 0.1, a11 * 0.9 + 0.1, a01 * 0.9 + 0.1)
          : cs.quad(V(x0, H, z0), V(x1, H, z0), V(x1, H, z1), V(x0, H, z1), V(0, -1, 0), [0, 0], [1, 0], [1, 1], [0, 1]);
      }
      // walls: 4 sides
      const sides = [
        [0, -1, V(x0, 0, z0), V(x1, 0, z0), V(0, 0, 1)],
        [0, 1, V(x1, 0, z1), V(x0, 0, z1), V(0, 0, -1)],
        [-1, 0, V(x0, 0, z1), V(x0, 0, z0), V(1, 0, 0)],
        [1, 0, V(x1, 0, z0), V(x1, 0, z1), V(-1, 0, 0)],
      ];
      for (const [dx, dz, a, b, n] of sides) {
        const nc = ch(x + dx, z + dz);
        let soup = null;
        if (nc === '#') {
          if (c === 'z') continue;
          soup = out ? soups.extWall : c === 'm' ? soups.mazeWall : c === 'n' ? soups.padded : soups.wall;
        } else if (c === 'n' && nc !== 'n' && nc !== 'W') soup = soups.padded;
        else if (nc === 'n' && c !== 'n' && c !== 'W') soup = soups.wall;
        else continue;
        const hh = out ? 6 : H;
        const u0 = (Math.abs(n.x) ? a.z : a.x) / 2, u1 = u0 + (n.z > 0 || n.x < 0 ? 1 : -1) * CELL / 2;
        const lo = 0.62, hi = 0.95;
        soup.quad(V(a.x, 0, a.z), V(b.x, 0, b.z), V(b.x, hh, b.z), V(a.x, hh, a.z), n,
          [u0, 0], [u1, 0], [u1, out ? 2.2 : 1], [u0, out ? 2.2 : 1], lo, lo, hi, hi);
      }
    }
    for (const [k, s] of Object.entries(soups)) if (s.p.length) this.root.add(s.mesh(M[k]));
    // window cells: sill, header and glass between the isolation corridor and Nevo's cell
    const b = new Batcher();
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (ch(x, z) === 'W') {
      const cx = (x + 0.5) * CELL, cz = (z + 0.5) * CELL;
      b.add(box, M.wallB, cx, 0.5, cz, 0, CELL, 1, 0.3);
      b.add(box, M.wallB, cx, H - 0.25, cz, 0, CELL, 0.5, 0.3);
      b.add(box, M.frame, cx, 1.02, cz, 0, CELL, 0.05, 0.36);
      if (x % 2 === 0) b.add(box, M.frame, x * CELL + 0.02, 1.6, cz, 0, 0.06, 1.2, 0.32);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(CELL, H - 1.5), M.glass);
      g.position.set(cx, 1 + (H - 1.5) / 2, cz); this.root.add(g);
    }
    b.build(this.root);
  }

  // Doorways in the wall rows: jambs, lintel, and real doors for the locked ones.
  buildDoors() {
    const M = this.M;
    const b = new Batcher();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const gap = 1.15, jw = (CELL - gap) / 2, dh = 2.15;
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const c = ch(x, z);
      if (c !== '+' && !isLock(c)) continue;
      const cx = (x + 0.5) * CELL, cz = (z + 0.5) * CELL;
      // passage runs along z if walls are left/right
      const alongZ = solidC(ch(x - 1, z)) && solidC(ch(x + 1, z));
      const mat = M.wallB;
      if (alongZ) {
        b.add(box, mat, x * CELL + jw / 2, H / 2, cz, 0, jw, H, CELL);
        b.add(box, mat, (x + 1) * CELL - jw / 2, H / 2, cz, 0, jw, H, CELL);
        b.add(box, mat, cx, (H + dh) / 2, cz, 0, gap, H - dh, CELL);
        b.add(box, M.frame, cx - gap / 2, dh / 2, z * CELL + 0.03, 0, 0.06, dh, 0.08);
        b.add(box, M.frame, cx + gap / 2, dh / 2, z * CELL + 0.03, 0, 0.06, dh, 0.08);
        b.add(box, M.frame, cx, dh, z * CELL + 0.03, 0, gap + 0.12, 0.06, 0.08);
        b.add(box, M.frame, cx - gap / 2, dh / 2, (z + 1) * CELL - 0.03, 0, 0.06, dh, 0.08);
        b.add(box, M.frame, cx + gap / 2, dh / 2, (z + 1) * CELL - 0.03, 0, 0.06, dh, 0.08);
        b.add(box, M.frame, cx, dh, (z + 1) * CELL - 0.03, 0, gap + 0.12, 0.06, 0.08);
        this.addBox(x * CELL, x * CELL + jw, z * CELL, (z + 1) * CELL);
        this.addBox((x + 1) * CELL - jw, (x + 1) * CELL, z * CELL, (z + 1) * CELL);
      } else {
        b.add(box, mat, cx, H / 2, z * CELL + jw / 2, 0, CELL, H, jw);
        b.add(box, mat, cx, H / 2, (z + 1) * CELL - jw / 2, 0, CELL, H, jw);
        b.add(box, mat, cx, (H + dh) / 2, cz, 0, CELL, H - dh, gap);
        b.add(box, M.frame, x * CELL + 0.03, dh / 2, cz - gap / 2, 0, 0.08, dh, 0.06);
        b.add(box, M.frame, x * CELL + 0.03, dh / 2, cz + gap / 2, 0, 0.08, dh, 0.06);
        b.add(box, M.frame, (x + 1) * CELL - 0.03, dh / 2, cz - gap / 2, 0, 0.08, dh, 0.06);
        b.add(box, M.frame, (x + 1) * CELL - 0.03, dh / 2, cz + gap / 2, 0, 0.08, dh, 0.06);
        this.addBox(x * CELL, (x + 1) * CELL, z * CELL, z * CELL + jw);
        this.addBox(x * CELL, (x + 1) * CELL, (z + 1) * CELL - jw, (z + 1) * CELL);
      }
      if (isLock(c)) {
        const labels = { E: 'מחסן צל״ם', J: 'אין כניסה', I: 'אגף בידוד', X: 'יציאה', P: 'גנרטור' };
        const mat2 = new THREE.MeshStandardMaterial({ map: T.doorTex(labels[c]), roughness: 0.5, metalness: 0.5 });
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(gap - 0.04, dh - 0.03, 0.05), [M.metal, M.metal, M.metal, M.metal, mat2, mat2]);
        const pivot = new THREE.Group();
        leaf.castShadow = leaf.receiveShadow = true;
        if (alongZ) { pivot.position.set(cx - gap / 2 + 0.02, 0, cz); leaf.position.set((gap - 0.04) / 2, dh / 2, 0); }
        else { pivot.position.set(cx, 0, cz + gap / 2 - 0.02); pivot.rotation.y = Math.PI / 2; leaf.position.set((gap - 0.04) / 2, dh / 2, 0); }
        // padlock/keypad
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.08), M.darkMetal);
        lock.position.set(gap - 0.18, dh / 2, 0.06); leaf.add(lock);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
        led.position.set(0, 0.05, 0.045); lock.add(led);
        pivot.add(leaf);
        this.root.add(pivot);
        this.doors[c] = { pivot, leaf, led, open: 0, target: locks[c] ? 0 : 1, base: pivot.rotation.y, x: cx, z: cz };
      }
    }
    b.build(this.root);
  }

  openDoor(c) {
    locks[c] = false;
    const d = this.doors[c];
    if (d) { d.target = 1; d.led.material.color.set(0x20ff40); }
  }

  // Fluorescent tubes on the ceiling. Real lights are pooled and follow the player.
  buildFixtures() {
    const M = this.M;
    const housing = new THREE.BoxGeometry(0.22, 0.07, 1.3);
    const tubeG = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8); tubeG.rotateX(Math.PI / 2);
    // housings are merged into one mesh; tubes are one instanced mesh whose per-instance colour is the brightness
    const hb = new Batcher();
    const add = (x, z, along = 'z', room) => {
      const ry = along === 'x' ? Math.PI / 2 : 0;
      hb.add(housing, M.tubeHousing, x, H - 0.04, z, ry);
      const f = { x, z, y: H - 0.15, ry, room, mode: 0, phase: Math.random() * 100, level: 1, on: true, emergency: false, base: 1 };
      const r = Math.random();
      f.mode = r < 0.12 ? 1 : r < 0.16 ? 2 : r < 0.2 ? 3 : 0; // flicker, strobe, dead
      if (room === 'm') f.mode = r < 0.5 ? 1 : 0;
      f.i = this.fixtures.length;
      this.fixtures.push(f);
      return f;
    };
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const c = ch(x, z);
      const cx = (x + 0.5) * CELL, cz = (z + 0.5) * CELL;
      if (c === '.') {
        const horiz = !walkable(x, z - 1) && !walkable(x, z + 1) || ch(x, z - 1) === '#' && ch(x, z + 1) === '#';
        if (horiz ? x % 3 === 1 : z % 3 === 1) add(cx, cz, horiz ? 'x' : 'z', c);
      } else if ('abdkocjsegi'.includes(c)) {
        if (x % 2 === 1 && z % 2 === 0) add(cx, cz, 'z', c);
      } else if (c === 'm' && (x + z) % 3 === 0) add(cx, cz, 'x', c);
      else if (c === 'x' && x === 17) add(cx, cz, 'z', c);
    }
    // the room with the cameras is dim: monitors light it
    for (const f of this.fixtures) if (f.room === 'c') f.mode = 3;
    for (const f of this.fixtures) f.mode0 = f.mode;
    hb.build(this.root, { cast: false, receive: false });
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
    this.tubes = new THREE.InstancedMesh(tubeG, tubeMat, this.fixtures.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    this.fixtures.forEach((f, i) => {
      q.setFromEuler(e.set(0, f.ry, 0));
      for (const k of [0, 1]) {
        const off = (k ? 0.05 : -0.05);
        m4.compose(new THREE.Vector3(f.x + Math.cos(f.ry) * off, H - 0.09, f.z - Math.sin(f.ry) * off), q, one);
        this.tubes.setMatrixAt(i * 2 + k, m4);
        this.tubes.setColorAt(i * 2 + k, new THREE.Color(1, 1, 1));
      }
    });
    this.tubes.frustumCulled = false;
    this.root.add(this.tubes);
    this._tc = new THREE.Color();
    // emergency red lights near key spots (used when the power is out)
    this.emergency = [];
    for (const [x, z] of [[3, 5], [16, 5], [30, 5], [2, 13], [17, 13], [30, 13], [28, 9], [17, 23], [10, 9]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1010, emissiveIntensity: 0 }));
      m.position.set((x + 0.5) * CELL, H - 0.25, (z + 0.5) * CELL);
      this.root.add(m);
      this.emergency.push({ x: m.position.x, z: m.position.z, y: H - 0.35, mesh: m });
    }
    // light pool
    const n = this.quality === 'low' ? 5 : 8;
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xdfeeff, 0, 10.5, 1.6);
      l.userData.target = null; l.userData.level = 0;
      this.scene.add(l); this.pool.push(l);
    }
  }

  // Extra light sources that share the pool: fridge, candles, monitors, the padded cell.
  addEmitter({ x, y, z, color = 0xffffff, power = 2, dist = 6, flicker = null, on = null }) {
    const e = { x, y, z, color, power, dist, flicker, onFn: on, emitter: true, level: 1, phase: Math.random() * 50 };
    this.emitters = this.emitters || [];
    this.emitters.push(e);
    return e;
  }

  fixtureLevel(f, t, threat) {
    if (!f.on) return 0;
    let lv = f.base;
    const n = Math.sin(t * 31 + f.phase) * Math.sin(t * 13.7 + f.phase * 2) + Math.sin(t * 7.1 + f.phase);
    if (f.mode === 1) lv *= n > 1.15 ? 0.05 : n > 0.9 ? 0.55 : 1;
    else if (f.mode === 2) lv *= (Math.sin(t * 18 + f.phase) > 0.3 && Math.sin(t * 2.3 + f.phase) > -0.2) ? 1 : 0.03;
    else if (f.mode === 3) lv = 0;
    if (threat > 0) {
      const q = Math.sin(t * 45 + f.phase * 3) + Math.sin(t * 23 + f.phase);
      if (q > 1.4 - threat * 1.5) lv *= 0.08;
    }
    return lv;
  }

  updateLights(dt, t, pp, yasmin) {
    if (this.blackoutT > 0) this.blackoutT -= dt;
    // fixture emissive and visibility
    const cand = [];
    this.tubes.instanceColor.needsUpdate = true;
    for (const f of this.fixtures) {
      let threat = 0;
      if (yasmin && yasmin.visible) {
        const d = Math.hypot(f.x - yasmin.position.x, f.z - yasmin.position.z);
        if (d < 7) threat = (1 - d / 7) * (yasmin.userData.aggro || 0.5);
      }
      const lv = this.power && !(this.blackoutT > 0) ? this.fixtureLevel(f, t, threat) : 0;
      f.level = lv;
      const b = 0.06 + lv * 4.2;
      if (this.alarm > 0) this._tc.setRGB(b, b * 0.68, b * 0.62); else this._tc.setRGB(b * 0.92, b * 0.97, b);
      this.tubes.setColorAt(f.i * 2, this._tc); this.tubes.setColorAt(f.i * 2 + 1, this._tc);
      const d = Math.hypot(f.x - pp.x, f.z - pp.z);
      if (d < 22) cand.push([d - lv * 2, f]);
    }
    for (const e of this.emitters || []) {
      let lv = e.onFn && !e.onFn() ? 0 : 1;
      if (e.flicker === 'candle') lv *= 0.75 + 0.25 * Math.sin(t * 11 + e.phase) * Math.sin(t * 7.3);
      if (e.flicker === 'bad') lv *= Math.sin(t * 9 + e.phase) * Math.sin(t * 2.1) > 0.75 ? 0.1 : 1;
      if (!e.outdoor && e.color !== 0xff8a3a && e.flicker !== 'candle' && !this.power && e.color !== 0x9fc4c8) lv = 0;
      e.level = lv;
      const d = Math.hypot(e.x - pp.x, e.z - pp.z);
      if (d < (e.outdoor ? 40 : 16) && lv > 0) cand.push([e.outdoor ? d - 30 : d - 4, e]);
    }
    const emerg = !this.power || this.alarm > 0;
    for (const e of this.emergency) {
      const k = emerg ? (0.6 + 0.4 * Math.sin(t * (this.alarm ? 9 : 2) + e.x)) : 0;
      e.mesh.material.emissiveIntensity = k * 6; e.level = k;
      if (emerg) { const d = Math.hypot(e.x - pp.x, e.z - pp.z); if (d < 24) cand.push([d - 3, e]); }
    }
    cand.sort((a, b) => a[0] - b[0]);
    const chosen = cand.slice(0, this.pool.length).map(c => c[1]);
    // keep lights on the fixtures they already serve, to avoid popping
    const free = [];
    for (const l of this.pool) {
      if (!l.userData.target || !chosen.includes(l.userData.target)) { free.push(l); l.userData.fadeOut = true; }
      else l.userData.fadeOut = false;
    }
    for (const f of chosen) {
      if (this.pool.some(l => l.userData.target === f && !l.userData.fadeOut)) continue;
      const l = free.find(l => l.userData.level < 0.05) || null;
      if (l) { l.userData.target = f; l.userData.fadeOut = false; l.position.set(f.x, f.y, f.z); }
    }
    for (const l of this.pool) {
      const f = l.userData.target;
      let want = 0;
      if (f && !l.userData.fadeOut) want = f.mesh ? f.level : f.level;
      const k = Math.min(1, dt * (want < l.userData.level ? 30 : 6));
      l.userData.level += (want - l.userData.level) * k;
      if (f && f.emitter) { l.color.setHex(f.color); l.intensity = l.userData.level * f.power * 3; l.distance = f.dist; }
      else if (f && f.mesh) { l.color.setHex(0xff2a1a); l.intensity = l.userData.level * 7; l.distance = 9; }
      else { l.color.setHex(this.alarm > 0 ? 0xffc8b8 : 0xdfeeff); l.intensity = l.userData.level * 11; l.distance = 10.5; }
    }
  }

  // ---------- Furniture ----------
  furnish() {
    const M = this.M;
    const b = new Batcher();
    this.batch = b;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    this.box = box; this.cyl = cyl;
    const room = (c) => {
      let x0 = 99, x1 = -1, z0 = 99, z1 = -1;
      for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (MAP[z][x] === c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      return { X0: x0 * CELL, X1: (x1 + 1) * CELL, Z0: z0 * CELL, Z1: (z1 + 1) * CELL };
    };
    // Barracks: room a (yours), b, and the two south rooms
    const A = { X0: 2, X1: 12, Z0: 2, Z1: 8 };
    const B = { X0: 14, X1: 24, Z0: 2, Z1: 8 };
    const C = { X0: 2, X1: 12, Z0: 30, Z1: 44 };
    const Dd = { X0: 14, X1: 24, Z0: 30, Z1: 44 };
    this.bounds = { A, B, C, D: Dd };
    // north rooms: door in the south wall middle (x+5..x+7 from X0)
    for (const R of [A, B]) {
      this.bunk(b, R.X0 + 1.2, R.Z0 + 0.5, 0);
      this.bunk(b, R.X1 - 1.2, R.Z0 + 0.5, 0);
      this.bunk(b, R.X0 + 1.2, R.Z1 - 0.5, Math.PI);
      this.bunk(b, R.X1 - 1.2, R.Z1 - 0.5, Math.PI);
      this.lockerRow(R.X0 + 0.32, R.Z0 + 2.4, 2, 'x+');
      this.lockerRow(R.X1 - 0.32, R.Z0 + 2.4, 2, 'x-');
    }
    for (const R of [C, Dd]) {
      for (let i = 0; i < 3; i++) {
        this.bunk(b, R.X0 + 1.2, R.Z0 + 1.6 + i * 4.2, Math.PI / 2, true);
        this.bunk(b, R.X1 - 1.2, R.Z0 + 1.6 + i * 4.2, -Math.PI / 2, true);
      }
      this.lockerRow(R.X0 + 4.2, R.Z1 - 0.32, 3, 'z-');
    }
    // the player's own bed: A, south-west lower bunk
    this.myBed = { x: A.X0 + 1.2, z: A.Z1 - 0.95 };

    // Kitchenette k: X 26..36, Z 2..8
    const K = room('k'); this.bounds.K = K;
    b.add(box, M.formica, K.X0 + 3.5, 0.45, K.Z0 + 0.35, 0, 5, 0.9, 0.65);          // counter base
    b.add(box, M.white, K.X0 + 3.5, 0.92, K.Z0 + 0.35, 0, 5.05, 0.05, 0.7);         // top
    b.add(box, M.chrome, K.X0 + 2.2, 0.9, K.Z0 + 0.35, 0, 0.6, 0.06, 0.45);          // sink
    b.add(box, M.chrome, K.X0 + 2.2, 1.12, K.Z0 + 0.1, 0, 0.04, 0.4, 0.04);           // tap
    b.add(box, M.formica, K.X0 + 3.5, 2.05, K.Z0 + 0.2, 0, 4, 0.7, 0.4);            // wall cabinets
    b.add(box, M.white, K.X0 + 5.2, 1.06, K.Z0 + 0.4, 0, 0.5, 0.3, 0.38);           // microwave
    b.add(box, M.darkMetal, K.X0 + 5.2, 1.06, K.Z0 + 0.6, 0, 0.32, 0.2, 0.01);
    b.add(cyl, M.chrome, K.X0 + 4.3, 1.1, K.Z0 + 0.35, 0, 0.18, 0.28, 0.18);         // kettle
    this.addBox(K.X0 + 1, K.X0 + 6, K.Z0, K.Z0 + 0.72);
    // table and chairs
    this.table(b, K.X0 + 5, K.Z0 + 3.6, 1.6, 0.9);
    for (const [dx, dz, r] of [[-0.5, -0.75, 0], [0.5, -0.75, 0], [-0.5, 0.75, Math.PI], [0.5, 0.75, Math.PI]]) this.chair(b, K.X0 + 5 + dx, K.Z0 + 3.6 + dz, r);
    // fridge (door open, set by the story) at the east wall
    this.fridgePos = { x: K.X1 - 0.5, z: K.Z0 + 1.2 };
    for (const [x, y, z, sx, sy, sz] of [[K.X1 - 0.1, 0.95, 0, 0.05, 1.9, 0.75], [K.X1 - 0.475, 0.95, -0.35, 0.75, 1.9, 0.05], [K.X1 - 0.475, 0.95, 0.35, 0.75, 1.9, 0.05], [K.X1 - 0.475, 1.875, 0, 0.75, 0.05, 0.75], [K.X1 - 0.475, 0.05, 0, 0.75, 0.1, 0.75]])
      b.add(box, M.white, x, y, K.Z0 + 1.2 + z, 0, sx, sy, sz);
    this.addBox(K.X1 - 0.9, K.X1, K.Z0 + 0.8, K.Z0 + 1.6, true);

    // Office o
    const O = room('o'); this.bounds.O = O;
    this.desk(b, O.X0 + 5, O.Z0 + 1.0, 0);
    this.chair(b, O.X0 + 5, O.Z0 + 1.9, Math.PI);
    b.add(box, M.metal, O.X0 + 0.4, 0.7, O.Z0 + 1.0, 0, 0.6, 1.4, 0.7);              // filing cabinets
    b.add(box, M.metal, O.X0 + 0.4, 0.7, O.Z0 + 1.8, 0, 0.6, 1.4, 0.7);
    this.addBox(O.X0, O.X0 + 0.75, O.Z0 + 0.6, O.Z0 + 2.2);
    b.add(box, M.wood, O.X1 - 0.3, 1.0, O.Z0 + 3, 0, 0.4, 2, 1.8);                  // bookshelf
    for (let i = 0; i < 4; i++) b.add(box, M.cardboard, O.X1 - 0.3, 0.3 + i * 0.48, O.Z0 + 2.6 + (i % 2) * 0.6, 0, 0.36, 0.28, 0.35);
    this.addBox(O.X1 - 0.5, O.X1, O.Z0 + 2.1, O.Z0 + 3.9);
    this.clock(O.X0 + 5, 2.0, O.Z0 + 0.02, 0);

    // CCTV room c: desk with monitors on the north wall
    const Cc = room('c'); this.bounds.Cc = Cc;
    b.add(box, M.formica, Cc.X0 + 4, 0.75, Cc.Z0 + 0.55, 0, 6.5, 0.05, 1.0);
    b.add(box, M.darkMetal, Cc.X0 + 4, 0.37, Cc.Z0 + 0.55, 0, 6.4, 0.74, 0.9);
    this.addBox(Cc.X0 + 0.7, Cc.X0 + 7.3, Cc.Z0, Cc.Z0 + 1.1);
    this.chair(b, Cc.X0 + 4, Cc.Z0 + 1.6, Math.PI);
    this.monitorSlots = [];
    for (let i = 0; i < 4; i++) {
      const mx = Cc.X0 + 1.6 + i * 1.6;
      b.add(box, M.plastic, mx, 1.25, Cc.Z0 + 0.3, 0, 1.25, 0.82, 0.12);
      b.add(box, M.plastic, mx, 0.85, Cc.Z0 + 0.35, 0, 0.12, 0.2, 0.12);
      this.monitorSlots.push({ x: mx, y: 1.25, z: Cc.Z0 + 0.37 });
    }
    for (let i = 0; i < 3; i++) {
      const mx = Cc.X0 + 2.4 + i * 1.6;
      b.add(box, M.plastic, mx, 2.05, Cc.Z0 + 0.3, 0, 1.25, 0.72, 0.12);
      this.monitorSlots.push({ x: mx, y: 2.05, z: Cc.Z0 + 0.37, small: true });
    }

    // Showers s: stalls on the east wall, sinks on the north
    const S = room('s'); this.bounds.S = S;
    for (let i = 0; i < 4; i++) {
      const sz = S.Z0 + 1.4 + i * 2.4;
      b.add(box, M.tile, S.X1 - 1.2, 1.0, sz - 1.2, 0, 2.4, 2.0, 0.05);
      b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), M.chrome, S.X1 - 0.3, 2.1, sz, 0, 1, 1, 1);
      b.add(box, M.chrome, S.X1 - 0.1, 2.1, sz, 0, 0.2, 0.03, 0.03);
      const cur = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8, 12, 1), M.curtain);
      const pa = cur.geometry.attributes.position;
      for (let k = 0; k < pa.count; k++) pa.setZ(k, Math.sin(pa.getX(k) * 7) * 0.06);
      cur.geometry.computeVertexNormals();
      cur.position.set(S.X1 - 2.4, 1.15, sz); cur.rotation.y = Math.PI / 2;
      if (i === 2) { cur.scale.x = 0.4; cur.position.z -= 0.7; }
      this.root.add(cur);
      this.addBox(S.X1 - 2.45, S.X1, sz - 1.23, sz - 1.17);
    }
    b.add(box, M.tile, S.X1 - 1.2, 1.0, S.Z1 - 0.2, 0, 2.4, 2.0, 0.05);
    for (let i = 0; i < 3; i++) {
      const sx = S.X0 + 1.2 + i * 1.3;
      b.add(box, M.white, sx, 0.82, S.Z0 + 0.3, 0, 0.6, 0.15, 0.45);
      b.add(box, M.chrome, sx, 1.0, S.Z0 + 0.08, 0, 0.04, 0.3, 0.04);
      b.add(box, M.chrome, sx, 1.55, S.Z0 + 0.03, 0, 0.55, 0.7, 0.02);       // mirror
    }
    this.addBox(S.X0 + 0.7, S.X0 + 4.6, S.Z0, S.Z0 + 0.55);

    // Equipment store e: rows of steel shelving with crates
    const E = room('e'); this.bounds.E = E;
    for (let r = 0; r < 3; r++) {
      const sz = E.Z0 + 2.2 + r * 3.0;
      for (const [x0, x1] of [[E.X0 + 0.6, E.X0 + 7.4], [E.X0 + 10.6, E.X1 - 0.6]]) this.shelf(b, x0, x1, sz);
    }

    // Generator room g
    const Gr = room('g'); this.bounds.G = Gr;
    const gx = Gr.X0 + 9, gz = Gr.Z0 + 5;
    b.add(box, M.olive, gx, 0.8, gz, 0, 3.2, 1.6, 1.6);
    b.add(box, M.darkMetal, gx, 0.08, gz, 0, 3.6, 0.16, 1.9);
    b.add(cyl, M.darkMetal, gx - 1.0, 1.9, gz, 0, 0.2, 0.9, 0.2);
    b.add(box, M.darkMetal, gx + 1.75, 1.0, gz, 0, 0.3, 1.2, 1.2);
    for (let i = 0; i < 6; i++) b.add(box, M.darkMetal, gx - 1.2 + i * 0.5, 1.2, gz + 0.81, 0, 0.3, 0.6, 0.02);
    this.addBox(gx - 1.9, gx + 1.95, gz - 0.95, gz + 0.95, true);
    for (const [px, pz] of [[Gr.X0 + 1, Gr.Z0 + 0.4], [Gr.X0 + 2, Gr.Z0 + 0.4], [Gr.X1 - 2, Gr.Z1 - 0.5]]) {
      b.add(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 14), M.red, px, 0.45, pz, 0, 1, 1, 1);
    }
    for (let i = 0; i < 5; i++) b.add(cyl, M.metal, Gr.X0 + 0.15, 2.2, Gr.Z0 + 1 + i * 0.25, 0, 0.08, 0.1, 0.08);
    b.add(new THREE.CylinderGeometry(0.07, 0.07, Gr.X1 - Gr.X0, 8), M.metal, (Gr.X0 + Gr.X1) / 2, 2.45, Gr.Z0 + 0.25, 0, 1, 1, 1, 0, Math.PI / 2);
    this.fusePanel = { x: Gr.X1 - 0.08, z: Gr.Z0 + 2.2 };
    b.add(box, M.darkMetal, Gr.X1 - 0.12, 1.45, Gr.Z0 + 2.2, 0, 0.2, 1.1, 0.9);
    this.leverPos = { x: Gr.X1 - 0.12, z: Gr.Z0 + 3.4 };
    b.add(box, M.yellow, Gr.X1 - 0.12, 1.3, Gr.Z0 + 3.4, 0, 0.18, 0.6, 0.35);

    // Isolation wing: medical desk + cabinet
    const I = { X0: 60, X1: 68, Z0: 30, Z1: 44 }; this.bounds.I = I;
    this.desk(b, I.X0 + 4, I.Z1 - 0.9, Math.PI);
    b.add(box, M.white, I.X1 - 0.35, 1.0, I.Z0 + 4.5, 0, 0.6, 2.0, 1.2);
    this.addBox(I.X1 - 0.7, I.X1, I.Z0 + 3.9, I.Z0 + 5.1);
    b.add(box, M.white, I.X0 + 2.2, 0.45, I.Z0 + 6, 0, 0.9, 0.5, 2.0);          // gurney
    b.add(box, M.pillow, I.X0 + 2.2, 0.75, I.Z0 + 6, 0, 0.85, 0.12, 1.9);
    for (const [dx, dz] of [[-0.4, -0.9], [0.4, -0.9], [-0.4, 0.9], [0.4, 0.9]]) b.add(cyl, M.chrome, I.X0 + 2.2 + dx, 0.2, I.Z0 + 6 + dz, 0, 0.04, 0.4, 0.04);
    this.addBox(I.X0 + 1.7, I.X0 + 2.7, I.Z0 + 5, I.Z0 + 7);

    // Yasmin's store j: mops everywhere, buckets, a shrine table
    const J = room('j'); this.bounds.J = J;
    for (let i = 0; i < 26; i++) {
      const along = i < 13;
      const px = along ? J.X0 + 0.5 + i * 0.7 : J.X1 - 0.25;
      const pz = along ? J.Z0 + 0.25 : J.Z0 + 0.8 + (i - 13) * 0.38;
      this.mop(b, px, pz, along ? 0.25 : 0, along ? 0 : -0.25);
    }
    this.table(b, J.X0 + 2.0, J.Z1 - 1.4, 2.2, 0.8);
    this.addBox(J.X0 + 0.2, J.X1 - 0.2, J.Z0, J.Z0 + 0.5);

    // Corridors: a few lockers to hide in, a bench, a fire extinguisher, a drinking fountain
    for (const [x, z, dir] of [[2.0 + 0.32, 13 * 2 + 0.5, 'x+'], [34 * 2 + 1.68, 11 * 2, 'x-'], [10 * 2 + 1.68, 9 * 2 + 1, 'x-'], [22 * 2 + 0.32, 8 * 2 + 1, 'x+'], [34 * 2 + 1.68, 13 * 2 + 1, 'x-']]) this.lockerRow(x, z, 1, dir, true);
    for (const [x, z] of [[12, 10.25], [40, 10.25], [58, 10.25], [26, 27.75], [50, 27.75]]) {
      b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12), M.red, x, 0.85, z, 0, 1, 1, 1);
      b.add(box, M.darkMetal, x, 1.15, z, 0, 0.08, 0.1, 0.08);
    }
    // hiding places in the dead-end rooms
    this.lockerRow(37, 14.32, 2, 'z+', true);          // equipment store, north wall
    this.lockerRow(60.32, 39.5, 2, 'x+', true);        // isolation wing office, west wall
    this.lockerRow(48.32, 21.4, 1, 'x+', true);        // generator room
    // a bench in the north corridor
    b.add(box, M.wood, 48, 0.45, 10.35, 0, 1.6, 0.06, 0.4);
    for (const dx of [-0.7, 0.7]) b.add(box, M.metal, 48 + dx, 0.22, 10.35, 0, 0.05, 0.44, 0.35);
    this.addBox(47.2, 48.8, 10.1, 10.6);

    // the maze has old furniture abandoned in it
    b.add(box, M.cardboard, 26.6, 0.3, 30.7, 0.3, 0.7, 0.6, 0.6);
    b.add(box, M.cardboard, 27.0, 0.85, 30.8, 0.1, 0.5, 0.5, 0.5);
    this.chair(b, 37.2, 42.6, 2.2);

    this.details(b);
    b.build(this.root);
  }

  // Pipes and a cable tray under the corridor ceilings, open door leaves, switches and boxes by the doors.
  details(b) {
    const M = this.M, box = this.box;
    const pipe = new THREE.CylinderGeometry(0.045, 0.045, CELL, 8); pipe.rotateZ(Math.PI / 2);
    const thin = new THREE.CylinderGeometry(0.025, 0.025, CELL, 6); thin.rotateZ(Math.PI / 2);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      if (ch(x, z) !== '.') continue;
      const cx = (x + 0.5) * CELL, cz = (z + 0.5) * CELL;
      const horiz = !walkable(x, z - 1) && !walkable(x, z + 1);
      const vert = !walkable(x - 1, z) && !walkable(x + 1, z);
      if (horiz) {
        b.add(pipe, M.darkMetal, cx, H - 0.14, z * CELL + 0.16, 0);
        b.add(thin, M.post, cx, H - 0.3, z * CELL + 0.12, 0);
        b.add(box, M.metal, cx, H - 0.1, (z + 1) * CELL - 0.25, 0, CELL, 0.03, 0.3);          // cable tray
        if (x % 2 === 0) b.add(box, M.darkMetal, cx, H - 0.06, z * CELL + 0.16, 0, 0.04, 0.12, 0.04); // clamp
      } else if (vert) {
        b.add(pipe, M.darkMetal, x * CELL + 0.16, H - 0.14, cz, Math.PI / 2);
        b.add(thin, M.post, x * CELL + 0.12, H - 0.3, cz, Math.PI / 2);
        b.add(box, M.metal, (x + 1) * CELL - 0.25, H - 0.1, cz, 0, 0.3, 0.03, CELL);
      }
    }
    // open door leaves and switches at the ordinary doorways
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      if (ch(x, z) !== '+') continue;
      const cx = (x + 0.5) * CELL, cz = (z + 0.5) * CELL;
      const alongZ = solidC(ch(x - 1, z)) && solidC(ch(x + 1, z));
      if (alongZ) {
        // which side is the room?
        const roomS = !'.+'.includes(ch(x, z + 1)) ? 1 : -1;
        const fz = roomS > 0 ? (z + 1) * CELL : z * CELL; // the room-side face of the wall
        b.add(box, M.metal, cx - 0.575 - 0.03, 1.07, fz + roomS * 0.56, 0, 0.04, 2.1, 1.08, 0, 0);
        this.addBox(cx - 0.63, cx - 0.57, Math.min(fz, fz + roomS * 1.1), Math.max(fz, fz + roomS * 1.1));
        // light switch on the corridor side
        const cside = roomS > 0 ? z * CELL - 0.012 : (z + 1) * CELL + 0.012;
        b.add(box, M.white, cx + 0.85, 1.25, cside, 0, 0.08, 0.12, 0.02);
        b.add(box, M.darkMetal, cx - 0.95, 2.3, cside, 0, 0.3, 0.22, 0.06);
      } else {
        const roomE = !'.+'.includes(ch(x + 1, z)) ? 1 : -1;
        const fx = roomE > 0 ? (x + 1) * CELL : x * CELL;
        b.add(box, M.metal, fx + roomE * 0.56, 1.07, cz - 0.575 - 0.03, 0, 1.08, 2.1, 0.04);
        this.addBox(Math.min(fx, fx + roomE * 1.1), Math.max(fx, fx + roomE * 1.1), cz - 0.63, cz - 0.57);
        const cside = roomE > 0 ? x * CELL - 0.012 : (x + 1) * CELL + 0.012;
        b.add(box, M.white, cside, 1.25, cz + 0.85, 0, 0.02, 0.12, 0.08);
      }
    }
  }

  bunk(b, x, z, rot, long = false) {
    const M = this.M, box = this.box, cyl = this.cyl;
    const L = 2.0, Wd = 0.9;
    const along = Math.abs(Math.sin(rot)) > 0.5; // bed length along z
    const lx = along ? Wd : L, lz = along ? L : Wd;
    // when placed against the north/south walls the bed's long side runs along x
    const px = x, pz = along ? z : z + (rot === 0 ? Wd / 2 : -Wd / 2);
    for (const [dx, dz] of [[-lx / 2, -lz / 2], [lx / 2, -lz / 2], [-lx / 2, lz / 2], [lx / 2, lz / 2]])
      b.add(box, M.frame, px + dx * 0.97, 0.9, pz + dz * 0.97, 0, 0.045, 1.8, 0.045);
    for (const y of [0.32, 1.25]) {
      b.add(box, M.frame, px, y, pz, 0, lx, 0.05, lz);
      b.add(box, M.mattress, px, y + 0.1, pz, 0, lx * 0.96, 0.14, lz * 0.96);
      // blanket folded over most of the mattress, pillow at the head
      if (along) {
        b.add(box, M.blanket, px, y + 0.19, pz + 0.2, 0, lx * 0.98, 0.04, lz * 0.7);
        b.add(box, M.pillow, px, y + 0.22, pz - lz * 0.38, 0, lx * 0.6, 0.1, 0.35);
      } else {
        b.add(box, M.blanket, px + 0.2, y + 0.19, pz, 0, lx * 0.7, 0.04, lz * 0.98);
        b.add(box, M.pillow, px - lx * 0.38, y + 0.22, pz, 0, 0.35, 0.1, lz * 0.6);
      }
    }
    // ladder
    if (along) for (let i = 0; i < 4; i++) b.add(box, M.frame, px + lx / 2, 0.45 + i * 0.3, pz + lz / 2 - 0.25, 0, 0.03, 0.03, 0.4);
    else for (let i = 0; i < 4; i++) b.add(box, M.frame, px + lx / 2 - 0.25, 0.45 + i * 0.3, pz + lz / 2, 0, 0.4, 0.03, 0.03);
    this.addBox(px - lx / 2, px + lx / 2, pz - lz / 2, pz + lz / 2, true);
  }

  lockerRow(x, z, n, dir, hideAll = false) {
    const M = this.M;
    const w = 0.62, d = 0.55, h = 1.95;
    for (let i = 0; i < n; i++) {
      let px = x, pz = z, ry = 0;
      if (dir === 'x+') { pz = z + i * w; ry = Math.PI / 2; px = x + d / 2 - 0.32; }
      if (dir === 'x-') { pz = z + i * w; ry = -Math.PI / 2; px = x - d / 2 + 0.32; }
      if (dir === 'z-') { px = x + i * w; ry = Math.PI; pz = z - d / 2 + 0.32; }
      if (dir === 'z+') { px = x + i * w; ry = 0; pz = z + d / 2 - 0.32; }
      const g = new THREE.Group();
      g.position.set(px, 0, pz); g.rotation.y = ry;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h, d), M.metal);
      body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
      const hinge = new THREE.Group(); hinge.position.set(-w / 2 + 0.02, 0, d / 2 + 0.01); g.add(hinge);
      const door = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.06, 0.025), [M.metal, M.metal, M.metal, M.metal, M.locker, M.metal]);
      door.position.set((w - 0.06) / 2, h / 2, 0); door.castShadow = true; hinge.add(door);
      this.root.add(g);
      const fwd = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
      const L = { group: g, hinge, open: 0, target: 0, x: px, z: pz, fwd, hide: hideAll || i % 2 === 1, ry };
      this.lockers.push(L);
      this.dynamic.push({ update: (dt) => { L.open += (L.target - L.open) * Math.min(1, dt * 7); L.hinge.rotation.y = -L.open * 1.9; } });
      const zd = dir === 'z-' || dir === 'z+';
      const hw = (zd ? w : d) / 2, hd = (zd ? d : w) / 2;
      this.addBox(px - hw, px + hw, pz - hd, pz + hd, true);
    }
  }

  table(b, x, z, w, d) {
    const M = this.M;
    b.add(this.box, M.formica, x, 0.74, z, 0, w, 0.04, d);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(this.box, M.metal, x + dx * (w / 2 - 0.06), 0.37, z + dz * (d / 2 - 0.06), 0, 0.04, 0.74, 0.04);
    this.addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, true);
  }
  chair(b, x, z, r) {
    const M = this.M;
    const s = Math.sin(r), c = Math.cos(r);
    b.add(this.box, M.plastic, x, 0.45, z, r, 0.42, 0.04, 0.42);
    b.add(this.box, M.plastic, x - s * 0.2, 0.7, z - c * 0.2, r, 0.42, 0.45, 0.04);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b.add(this.box, M.metal, x + dx, 0.22, z + dz, 0, 0.025, 0.45, 0.025);
  }
  desk(b, x, z, r) {
    const M = this.M;
    const w = 1.6, d = 0.8;
    const rot = Math.abs(Math.sin(r)) > 0.5;
    b.add(this.box, M.wood, x, 0.75, z, r, w, 0.05, d);
    b.add(this.box, M.darkMetal, x + (rot ? 0 : 0.55), 0.37, z + (rot ? 0.55 : 0), r, 0.45, 0.72, d - 0.05);
    b.add(this.box, M.darkMetal, x - (rot ? 0 : 0.75), 0.37, z - (rot ? 0.75 : 0), r, 0.04, 0.72, d - 0.05);
    this.addBox(x - (rot ? d : w) / 2, x + (rot ? d : w) / 2, z - (rot ? w : d) / 2, z + (rot ? w : d) / 2, true);
  }
  shelf(b, x0, x1, z) {
    const M = this.M;
    const w = x1 - x0, cx = (x0 + x1) / 2, d = 0.6;
    for (const y of [0.1, 0.75, 1.4, 2.05]) b.add(this.box, M.metal, cx, y, z, 0, w, 0.04, d);
    for (let x = x0; x <= x1 + 0.01; x += w / 3) for (const dz of [-d / 2, d / 2]) b.add(this.box, M.metal, x, 1.08, z + dz, 0, 0.05, 2.16, 0.05);
    let k = 0;
    for (const y of [0.12, 0.77, 1.42]) for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.75) {
      k++;
      if (k % 5 === 0) continue;
      const kind = k % 3;
      if (kind === 0) b.add(this.box, M.olive, x, y + 0.2, z, 0, 0.6, 0.38, 0.45);
      else if (kind === 1) b.add(this.box, M.cardboard, x, y + 0.17, z + 0.05, 0.1, 0.5, 0.32, 0.4);
      else { b.add(this.box, M.darkMetal, x, y + 0.15, z, 0, 0.3, 0.28, 0.2); b.add(this.box, M.darkMetal, x + 0.08, y + 0.45, z, 0, 0.02, 0.3, 0.02); }
    }
    this.addBox(x0 - 0.05, x1 + 0.05, z - d / 2, z + d / 2, true);
  }
  mop(b, x, z, tiltX = 0, tiltZ = 0) {
    const M = this.M;
    b.add(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 6), M.wood, x, 0.95, z, 0, 1, 1, 1, tiltX * 0.3, tiltZ * 0.3);
    b.add(new THREE.CylinderGeometry(0.06, 0.13, 0.32, 9), M.mopString, x - tiltZ * 0.2, 0.16, z + tiltX * 0.2, 0, 1, 1, 1);
  }
  clock(x, y, z, ry) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshStandardMaterial({ map: T.clockTex(), roughness: 0.4 }));
    m.position.set(x, y, z + 0.01); m.rotation.y = ry; this.root.add(m);
    const hand = (l, w) => { const h = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color: 0x111111 })); h.geometry.translate(0, l / 2, 0); h.position.set(x, y, z + 0.015); this.root.add(h); return h; };
    const hh = hand(0.09, 0.012), mm = hand(0.14, 0.008);
    this.dynamic.push({ update: (dt, t) => { const m = (this.clockMinutes || 0); mm.rotation.z = -m / 60 * Math.PI * 2; hh.rotation.z = -m / 720 * Math.PI * 2; } });
  }

  // ---------- Outside ----------
  buildOutside() {
    const M = this.M;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), M.ground);
    ground.rotation.x = -Math.PI / 2; ground.position.set(36, -0.01, 60); ground.receiveShadow = true;
    this.root.add(ground);
    // fence on the yard edges
    const b = new Batcher();
    const fenceH = 2.6;
    const fenceGeo = [];
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      if (ch(x, z) !== 'y') continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (ch(x + dx, z + dz) !== 'F') continue;
        const cx = (x + 0.5 + dx * 0.5) * CELL, cz = (z + 0.5 + dz * 0.5) * CELL;
        const g = new THREE.PlaneGeometry(CELL, fenceH);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 5.2);
        g.rotateY(dx ? Math.PI / 2 : 0); g.translate(cx, fenceH / 2, cz);
        fenceGeo.push(g);
        b.add(new THREE.CylinderGeometry(0.04, 0.04, fenceH + 0.5, 8), M.post, cx - (dz ? CELL / 2 : 0), (fenceH + 0.5) / 2, cz - (dx ? CELL / 2 : 0));
        // barbed wire on top: angled arm + coil
        const coil = new THREE.TorusGeometry(0.22, 0.008, 4, 16);
        for (let k = 0; k < 4; k++) b.add(coil, M.post, cx - (dz ? CELL / 2 - k * 0.5 : 0), fenceH + 0.35, cz - (dx ? CELL / 2 - k * 0.5 : 0), dx ? 0 : Math.PI / 2, 1, 1, 1, 0.3, 0);
        this.addBox(cx - (dx ? 0.05 : CELL / 2), cx + (dx ? 0.05 : CELL / 2), cz - (dz ? 0.05 : CELL / 2), cz + (dz ? 0.05 : CELL / 2));
      }
    }
    const fence = new THREE.Mesh(mergeGeometries(fenceGeo), M.fence);
    fence.castShadow = true; this.root.add(fence);
    // guard booth
    const box = this.box;
    b.add(box, M.white, 14, 1.3, 56, 0, 3, 2.6, 2.6);
    b.add(box, M.darkMetal, 14, 2.7, 56, 0, 3.4, 0.15, 3.0);
    b.add(box, M.glass, 14, 1.6, 57.31, 0, 2.2, 0.9, 0.02);
    this.addBox(12.5, 15.5, 54.7, 57.3, true);
    // parked jeep-ish shape and concrete barriers
    for (let i = 0; i < 4; i++) {
      b.add(box, M.formica, 46 + i * 1.6, 0.4, 59, 0, 1.4, 0.8, 0.5);
      b.add(box, M.formica, 46 + i * 1.6, 0.85, 59, 0, 0.3, 0.2, 0.3);
    }
    this.addBox(45.2, 52.2, 58.7, 59.3, true);
    // flood light poles
    this.flood = [];
    for (const [x, z, lit] of [[10, 53, 0], [62, 53, 0], [26, 63, 1], [48, 63, 1]]) {
      b.add(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), M.post, x, 3, z);
      b.add(box, M.darkMetal, x, 6, z + 0.2, 0, 0.6, 0.3, 0.4);
      const s = null;
      this.addEmitter({ x, y: 5.6, z: z + 0.4, color: 0xffe2b0, power: 70, dist: 30, outdoor: true, on: () => this.floodOn });
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ color: 0xffe9c0 }));
      lamp.position.set(x, 5.84, z + 0.41); lamp.rotation.x = 0.4; this.root.add(lamp);
      this.flood.push({ s, lamp, x, z });
    }
    b.build(this.root);
    // sliding gate
    const gate = new THREE.Group();
    const gw = 4 * CELL;
    const gplane = new THREE.PlaneGeometry(gw, fenceH);
    const uv = gplane.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 16, uv.getY(i) * 5.2);
    const gm = new THREE.Mesh(gplane, M.fence); gm.position.y = fenceH / 2; gate.add(gm);
    for (const y of [0.05, fenceH / 2, fenceH]) { const r = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.06, 0.06), M.post); r.position.y = y; gate.add(r); }
    for (let k = 0; k <= 4; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, fenceH, 0.06), M.post); r.position.set(-gw / 2 + k * gw / 4, fenceH / 2, 0); gate.add(r); }
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 12), M.chrome); chain.position.set(gw / 2 - 0.1, 1.1, 0.05); gate.add(chain);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), M.yellow); pad.position.set(gw / 2 - 0.1, 0.98, 0.07); gate.add(pad);
    gate.position.set(15 * CELL + gw / 2, 0, 32 * CELL + CELL / 2);
    gate.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.root.add(gate);
    this.gate = { group: gate, open: 0, target: 0, x0: gate.position.x };
    this.dynamic.push({ update: (dt) => { const g = this.gate; g.open += (g.target - g.open) * Math.min(1, dt * 0.6); g.group.position.x = g.x0 + g.open * (gw + 0.5); } });
    // moonlight for the yard
    this.moon = new THREE.DirectionalLight(0x8fa3c4, 0);
    this.moon.position.set(-40, 60, 120); this.moon.target.position.set(36, 0, 58);
    this.scene.add(this.moon); this.scene.add(this.moon.target);
    // sky: dark gradient, stars, a hazy moon
    const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          float y = max(vP.y, 0.0);
          vec3 c = mix(vec3(0.035,0.04,0.045), vec3(0.004,0.006,0.012), pow(y, 0.5));
          vec3 q = floor(vP * 420.0);
          float s = step(0.9975, h(q)) * smoothstep(0.05, 0.3, y);
          c += s * vec3(0.7);
          vec3 md = normalize(vec3(-0.4, 0.45, 0.8));
          float m = max(dot(vP, md), 0.0);
          c += vec3(0.6,0.62,0.66) * smoothstep(0.9993, 0.9996, m) + vec3(0.06,0.065,0.08) * pow(m, 60.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    sky.position.set(36, 0, 36);
    this.sky = sky;
    this.root.add(sky);
    const hills = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 30, 64, 1, true), new THREE.MeshBasicMaterial({ map: T.hillsTex(), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    hills.material.map.repeat.set(3, 1);
    hills.position.set(36, 12, 50); hills.renderOrder = -1;
    this.root.add(hills);
  }

  // Room plates, exit signs, posters and wall scrawls.
  buildSignage() {
    const plate = (text, x, y, z, ry, w = 0.8, opts) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), new THREE.MeshStandardMaterial({ map: T.signTex(text, opts), roughness: 0.5 }));
      m.position.set(x, y, z); m.rotation.y = ry; this.root.add(m); return m;
    };
    // plates above doors that face the north corridor (wall at z=10 faces +z... rooms' doors are at z=8..10)
    const north = [['חדר 1', 3], ['חדר 2', 9], ['מטבחון', 15], ['משרד רס״פ', 21], ['מצלמות', 26], ['מחסן ניקיון', 32]];
    for (const [t, x] of north) plate(t, (x + 0.5) * CELL, 2.35, 10.01, 0);
    plate('מחסן צל״ם', 33, 2.35, 12 - 0.01, Math.PI);
    plate('מקלחות', 4.01, 2.35, 19, Math.PI / 2);
    plate('גנרטור', 46 - 0.01, 2.35, 19, -Math.PI / 2);
    const south = [['חדר 4', 3], ['חדר 5', 9], ['???', 17], ['אגף בידוד', 28]];
    for (const [t, x] of south) plate(t, (x + 0.5) * CELL, 2.35, 28 - 0.01, Math.PI, 0.8, t === '???' ? { bg: '#3a3324' } : t === 'אגף בידוד' ? { bg: '#6b1414' } : undefined);
    // exit signs
    const ex = T.exitSignTex();
    const exitMat = new THREE.MeshStandardMaterial({ map: ex, emissive: 0xffffff, emissiveMap: ex, emissiveIntensity: 1.6 });
    for (const [x, z, ry] of [[35, 44.05, 0], [8, 10.02, 0], [55, 26 - 0.02, Math.PI]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22), exitMat);
      m.position.set(x, 2.45, z); m.rotation.y = ry; this.root.add(m);
    }
    // posters in the corridors
    const poster = (opts, x, y, z, ry, w = 0.55) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 1.37), new THREE.MeshStandardMaterial({ map: T.posterTex(opts), roughness: 0.8 }));
      m.position.set(x, y, z); m.rotation.y = ry; this.root.add(m); return m;
    };
    poster({ title: 'נוהל ניקיון', lines: ['1. ריצפה רטובה = ריצפה נקייה', '2. אין לרוץ במסדרון', '3. אין לדבר בזמן מסדר', '4. אין לבכות בזמן מסדר', '5. התורנית תמיד צודקת', '6. התורנית שומעת הכל'], stamp: 'מאושר' }, 13, 1.6, 10.01, 0);
    poster({ title: 'תורנות ניקיון', lines: ['ראשון — נבו', 'שני — נבו', 'שלישי — רועי', 'רביעי — מאיה', 'חמישי — נבו', 'שישי — אתה'], crossed: [0, 1, 2, 3, 4], accent: '#264d7a' }, 30.5, 1.6, 10.01, 0);
    poster({ title: 'הודעה', lines: ['חייל שנמצא עם', 'נעליים מלוכלכות', 'במסדרון — יטופל', 'באופן אישי ע״י', 'תורנית הניקיון.', '', 'יסמין'], stamp: 'דחוף' }, 57.5, 1.6, 26 - 0.01, Math.PI);
    poster({ title: 'נעדרים', lines: ['רועי — ממשמרת ג׳', 'מאיה — ממשמרת ד׳', 'נבו — הועבר לבידוד', '', 'מי שראה אותם', 'שלא יגיד כלום.'], accent: '#333', stamp: 'סודי' }, 41, 1.6, 26 - 0.01, Math.PI);
    // wall scrawls
    const scrawl = (text, x, y, z, ry, w = 2.2, o) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshStandardMaterial({ map: T.scrawlTex(text, o), transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(x, y, z); m.rotation.y = ry; this.root.add(m); return m;
    };
    scrawl('נקי. נקי. נקי. נקי.', 63, 1.5, 2.02, 0, 3);
    scrawl('אל תרוץ על הרטוב', 69.98, 1.4, 20, -Math.PI / 2, 2.4);
    scrawl('היא שומעת', 26.02, 1.3, 34, Math.PI / 2, 1.8);
    scrawl('47', 49.02, 1.6, 22, Math.PI / 2, 1.2, { size: 200 });
    scrawl('עוד מסדר', 41.98, 1.2, 38, -Math.PI / 2, 2.0);
    scrawl('תברח', 32.02, 1.5, 47, Math.PI / 2, 1.2, { color: 'rgba(20,20,20,0.85)' });
  }

  // Floor decals: blood, puddles and wet footprints.
  decal(tex, x, z, w, h, ry = 0, y = 0.004, opacity = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.15, metalness: 0, opacity, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = ry; m.position.set(x, y, z);
    m.receiveShadow = true;
    this.decals.add(m);
    return m;
  }
  wallDecal(tex, x, y, z, ry, w, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.set(x, y, z); m.rotation.y = ry; this.decals.add(m); return m;
  }

  update(dt, t, pp, yasmin) {
    this.updateLights(dt, t, pp, yasmin);
    for (const d of this.dynamic) d.update(dt, t);
    for (const k in this.doors) {
      const d = this.doors[k];
      d.open += (d.target - d.open) * Math.min(1, dt * 2.5);
      d.pivot.rotation.y = d.base - d.open * 1.6;
    }
    const outside = pp.z > 50;
    this.moon.intensity += ((outside ? 0.35 : 0) - this.moon.intensity) * Math.min(1, dt * 2);
    this.floodOn = outside;
  }
}

// Collision: push a circle out of walls and boxes.
// Is a straight walk from (x0,z0) to (x1,z1) clear of furniture, door frames and open doors for a body of radius r?
// (Slab test of the segment against every collider grown by r.)
export function clearLine(world, x0, z0, x1, z1, r) {
  const dx = x1 - x0, dz = z1 - z0;
  for (const b of world.colliders) {
    const minX = b.minX - r, maxX = b.maxX + r, minZ = b.minZ - r, maxZ = b.maxZ + r;
    if (Math.max(x0, x1) < minX || Math.min(x0, x1) > maxX || Math.max(z0, z1) < minZ || Math.min(z0, z1) > maxZ) continue;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (x0 < minX || x0 > maxX) continue; }
    else { let a = (minX - x0) / dx, c = (maxX - x0) / dx; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
    if (Math.abs(dz) < 1e-9) { if (z0 < minZ || z0 > maxZ) continue; }
    else { let a = (minZ - z0) / dz, c = (maxZ - z0) / dz; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); }
    if (t0 <= t1) return false;
  }
  return true;
}

export function collide(world, p, r) {
  const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
  for (let i = 0; i < 2; i++) {
    for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (walkable(x, z)) continue;
      pushBox(p, r, x * CELL, (x + 1) * CELL, z * CELL, (z + 1) * CELL);
    }
    for (const b of world.colliders) {
      if (p.x + r < b.minX || p.x - r > b.maxX || p.z + r < b.minZ || p.z - r > b.maxZ) continue;
      pushBox(p, r, b.minX, b.maxX, b.minZ, b.maxZ);
    }
  }
}
function pushBox(p, r, x0, x1, z0, z1) {
  const nx = Math.max(x0, Math.min(p.x, x1)), nz = Math.max(z0, Math.min(p.z, z1));
  const dx = p.x - nx, dz = p.z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2), k = (r - d) / d;
    p.x += dx * k; p.z += dz * k;
  } else {
    // centre inside the box: push out along the shortest axis
    const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, bb = z1 - p.z;
    const m = Math.min(l, rr, t, bb);
    if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r;
  }
}
