// 3D third-person view of the base, built with Three.js on top of the tile world.
// Game logic still runs in world px (TS px per 2 m tile); this file only draws it.
const S3 = 2 / TS; // metres per world px
const WALL_H = 3;
const SHELTER_H = 2.4;

const Scene3D = {
  yaw: 0,          // camera orbit angle around the player (0 = camera south of player)
  pitch: 0.3,
  effPitch: 0.3,
  dist: 5.2,
  lastLook: 0,
  sky: [],
  models: new Map(),
  trashMeshes: new Map(),
  dustMeshes: new Map(),
  lampLights: [],
  lightTimer: 0,

  init(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    r.outputEncoding = THREE.sRGBEncoding;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
    this.scene.fog = new THREE.Fog(0x9fc9ee, 90, 260);

    this.hemi = new THREE.HemisphereLight(0xdfeaff, 0xb59a6a, 0.8);
    this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d4, 1.05);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 160 });
    sun.shadow.bias = -0.0006;
    this.scene.add(sun, sun.target);

    this.playerLight = new THREE.PointLight(0xfff2d0, 0, 12, 2);
    this.scene.add(this.playerLight);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight(0xffc98a, 0, 18, 2);
      this.lampLights.push(l);
      this.scene.add(l);
    }
    this.flash = new THREE.PointLight(0xffd27a, 0, 120, 2);
    this.scene.add(this.flash);
  },

  resize(w, h, dpr) {
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 74 : 62;
    this.camera.updateProjectionMatrix();
  },

  // ---------- helpers ----------
  mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.04, ...opts });
  },
  box(w, h, d, material, x = 0, y = 0, z = 0, parent = null) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || this.root).add(m);
    return m;
  },
  cyl(rt, rb, h, material, x = 0, y = 0, z = 0, parent = null, seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || this.root).add(m);
    return m;
  },
  canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  },
  label(text, { bg = 'rgba(20,26,16,.82)', fg = '#f4f1e6', size = 1 } = {}) {
    const font = '800 44px Rubik, Arial';
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    const tw = Math.ceil(probe.measureText(text).width) + 36;
    const tex = this.canvasTex(tw, 64, (g, w, h) => {
      g.fillStyle = bg;
      roundRect(g, 0, 0, w, h, 14);
      g.fill();
      g.font = font;
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.direction = 'rtl';
      g.fillText(text, w / 2, 47);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(tw / 64 * 0.62 * size, 0.62 * size, 1);
    s.renderOrder = 5;
    return s;
  },
  at(px, py) { return { x: px * S3, z: py * S3 }; },

  // ---------- world construction ----------
  build() {
    if (this.root) this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.models = new Map();
    this.trashMeshes = new Map();
    this.dustMeshes = new Map();
    this.player = null;
    this.lastCar = null;
    this.bermBuilt = false;
    const sc = this.root;
    const W = World.W * 2, H = World.H * 2;

    // Ground: the baked tile map as a texture, plus open desert around it.
    const gtex = new THREE.CanvasTexture(World.baked);
    gtex.encoding = THREE.sRGBEncoding;
    gtex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(W / 2, 0, H / 2);
    ground.receiveShadow = true;
    sc.add(ground);
    const desert = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.mat(0xc9ad78, { roughness: 1 }));
    desert.rotation.x = -Math.PI / 2;
    desert.position.set(W / 2, -0.03, H / 2);
    desert.receiveShadow = true;
    sc.add(desert);

    this.buildWalls();
    this.buildFence();
    this.buildProps();
    this.buildLabels();
    this.buildLamps();
    this.buildHorizon();

    // Objective marker.
    this.marker = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0xf2c14e }));
    cone.rotation.x = Math.PI;
    this.marker.add(cone);
    this.markerRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    this.markerRing.rotation.x = -Math.PI / 2;
    sc.add(this.marker, this.markerRing);
    this.markerCone = cone;
  },

  buildWalls() {
    const shelterTiles = new Set();
    for (const b of World.def.buildings) if (b.shelter) {
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) shelterTiles.add(x + ',' + y);
    }
    const walls = [], shelters = [];
    for (let y = 0; y < World.H; y++) for (let x = 0; x < World.W; x++) {
      if (World.grid[y][x] !== T.WALL) continue;
      (shelterTiles.has(x + ',' + y) ? shelters : walls).push([x, y]);
    }
    const make = (list, h, color) => {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(2, h, 2), this.mat(color, { roughness: 0.95 }), list.length);
      const m = new THREE.Matrix4();
      list.forEach(([x, y], i) => { m.makeTranslation(x * 2 + 1, h / 2, y * 2 + 1); im.setMatrixAt(i, m); });
      im.castShadow = true;
      im.receiveShadow = true;
      this.root.add(im);
    };
    make(walls, WALL_H, 0xd9cfb6);
    make(shelters, SHELTER_H, 0x9b9a90);
    // Wall caps and red bands on shelters.
    const red = this.mat(0xd8392b);
    for (const b of World.def.buildings) {
      if (b.shelter) {
        this.box(b.w * 2, 0.35, 0.08, red, (b.x + b.w / 2) * 2, SHELTER_H - 0.4, b.y * 2 - 0.02);
        this.box(b.w * 2, 0.35, 0.08, red, (b.x + b.w / 2) * 2, SHELTER_H - 0.4, (b.y + b.h) * 2 + 0.02);
        // A roof slab half over the shelter keeps the inside visible from above.
        this.box(b.w * 2, 0.25, b.h * 2 * 0.45, this.mat(0x8a8980), (b.x + b.w / 2) * 2, SHELTER_H + 0.12, b.y * 2 + b.h * 2 * 0.225);
      } else {
        // Thin darker cap along the top of each building's walls.
        const cap = this.mat(0xa59b84);
        const cx = (b.x + b.w / 2) * 2, cz = (b.y + b.h / 2) * 2;
        this.box(b.w * 2, 0.12, 2, cap, cx, WALL_H + 0.06, b.y * 2 + 1);
        this.box(b.w * 2, 0.12, 2, cap, cx, WALL_H + 0.06, (b.y + b.h) * 2 - 1);
        this.box(2, 0.12, b.h * 2, cap, b.x * 2 + 1, WALL_H + 0.06, cz);
        this.box(2, 0.12, b.h * 2, cap, (b.x + b.w) * 2 - 1, WALL_H + 0.06, cz);
      }
    }
  },

  buildFence() {
    const wire = this.canvasTex(64, 64, (g) => {
      g.strokeStyle = 'rgba(70,70,70,.95)';
      g.lineWidth = 2;
      for (let i = -64; i < 128; i += 16) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke();
        g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke();
      }
      g.fillStyle = '#555';
      g.fillRect(0, 0, 64, 3);
      g.fillRect(0, 61, 64, 3);
    });
    wire.wrapS = THREE.RepeatWrapping;
    const fenceH = 2.4;
    const panel = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const t = wire.clone();
      t.needsUpdate = true;
      t.repeat.set(len / 2, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, fenceH), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.4 }));
      m.position.set((x0 + x1) / 2, fenceH / 2, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      this.root.add(m);
      // Barbed wire along the top.
      const bw = this.cyl(0.05, 0.05, len, this.mat(0x777777), (x0 + x1) / 2, fenceH + 0.15, (z0 + z1) / 2, null, 5);
      bw.rotation.z = Math.PI / 2;
      bw.rotation.y = m.rotation.y;
      bw.castShadow = false;
    };
    const a = 5, b = 123, top = 5, bot = 83;
    panel(a, top, b, top);
    panel(a, top, a, bot);
    panel(b, top, b, bot);
    panel(a, bot, 58, bot);
    panel(66, bot, b, bot);
    const posts = [];
    for (let x = 2; x <= 61; x++) { posts.push([x * 2 + 1, top]); if (x < 29 || x > 32) posts.push([x * 2 + 1, bot]); }
    for (let y = 3; y <= 40; y++) { posts.push([a, y * 2 + 1]); posts.push([b, y * 2 + 1]); }
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, fenceH + 0.3, 6), this.mat(0x5d5d5d, { metalness: 0.5 }), posts.length);
    const m = new THREE.Matrix4();
    posts.forEach(([x, z], i) => { m.makeTranslation(x, (fenceH + 0.3) / 2, z); im.setMatrixAt(i, m); });
    im.castShadow = true;
    this.root.add(im);

    // Gate barrier: post plus a red/white arm that lifts.
    this.box(0.5, 1.2, 0.5, this.mat(0x555555), 57.6, 0.6, 83);
    this.gateArm = new THREE.Group();
    this.gateArm.position.set(57.8, 1.05, 83);
    const stripes = this.canvasTex(256, 16, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1e6' : '#e63b2e'; g.fillRect(i * 32, 0, 32, 16); } });
    this.box(8, 0.16, 0.16, new THREE.MeshStandardMaterial({ map: stripes }), 4, 0, 0, this.gateArm);
    this.root.add(this.gateArm);
  },

  buildProps() {
    this.props = [];
    for (const o of World.objects) this.addProp(o);
  },

  addProp(o) {
    {
      const cx = (o.x + o.w / 2) * S3, cz = (o.y + o.h / 2) * S3, w = o.w * S3, d = o.h * S3;
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      this.root.add(g);
      const rec = { o, g };
      switch (o.kind) {
        case 'bed': {
          const frame = this.mat(0x4a5340, { metalness: 0.4 });
          this.box(w, 0.32, d, frame, 0, 0.16, 0, g);
          this.box(w * 0.96, 0.14, d * 0.96, this.mat(0x6b7a4b), 0, 0.39, 0, g);
          const top = o.y < 28 * TS;
          const end = top ? -d / 2 + 0.28 : d / 2 - 0.28;
          this.box(w * 0.78, 0.12, 0.34, this.mat(0xf1ece0), 0, 0.52, end, g);
          rec.neat = this.box(w * 0.98, 0.06, d * 0.62, this.mat(0x55663a), 0, 0.49, -end * 0.35, g);
          rec.messy = new THREE.Group();
          const m1 = this.box(w * 0.9, 0.18, d * 0.45, this.mat(0x6b7f45), 0.05, 0.55, 0, rec.messy);
          m1.rotation.set(0.25, 0.6, 0.15);
          const m2 = this.box(w * 0.7, 0.14, d * 0.3, this.mat(0x5f7140), -0.1, 0.6, -end * 0.4, rec.messy);
          m2.rotation.set(-0.2, -0.5, 0.1);
          g.add(rec.messy);
          break;
        }
        case 'locker': {
          this.box(w, 1.9, d, this.mat(0x7a7f72, { metalness: 0.5, roughness: 0.5 }), 0, 0.95, 0, g);
          rec.door = new THREE.Group();
          rec.door.position.set(w / 2 + 0.02, 0, -d / 2);
          this.box(0.04, 1.8, d, this.mat(0x8d9284, { metalness: 0.5, roughness: 0.5 }), 0, 0.95, d / 2, rec.door);
          this.box(0.05, 0.12, 0.05, this.mat(0xdddddd), 0.03, 1.0, d * 0.85, rec.door);
          g.add(rec.door);
          break;
        }
        case 'table':
          this.box(w, 0.08, d, this.mat(0x8a6a44), 0, 0.75, 0, g);
          this.box(w * 0.9, 0.7, 0.12, this.mat(0x5a4630), 0, 0.36, 0, g);
          for (let i = 0; i < 4; i++) this.cyl(0.13, 0.13, 0.03, this.mat(0xf1ece0), -w / 2 + 0.4 + i * (w - 0.8) / 3, 0.81, 0, g);
          break;
        case 'counter':
          this.box(w, 0.95, d, this.mat(0x9a9a92, { metalness: 0.3 }), 0, 0.475, 0, g);
          this.box(w, 0.05, d + 0.08, this.mat(0xc9c9c1, { metalness: 0.5, roughness: 0.4 }), 0, 0.97, 0, g);
          break;
        case 'desk':
          this.box(w, 0.75, d, this.mat(0x7a5a36), 0, 0.375, 0, g);
          this.box(0.6, 0.4, 0.06, this.mat(0x222222), 0, 0.98, -0.1, g);
          break;
        case 'console': {
          this.box(w, 1.0, d, this.mat(0x2c3328), 0, 0.5, 0, g);
          rec.screens = this.box(w * 0.92, 0.35, 0.05, new THREE.MeshStandardMaterial({ color: 0x0f3d1d, emissive: 0x2fbf5a, emissiveIntensity: 0.8 }), 0, 1.25, d * 0.2, g);
          rec.screens.rotation.x = -0.3;
          break;
        }
        case 'canisters': {
          const n = Math.max(1, Math.floor(o.w / 26));
          const seg = w / n;
          const cm = this.mat(0x56653a);
          for (let i = 0; i < n; i++) for (let l = 0; l < 2; l++) {
            this.box(seg * 0.92, 0.7, d * 0.95, cm, -w / 2 + seg * (i + 0.5), 0.35 + l * 0.72, 0, g);
          }
          break;
        }
        case 'panel':
          this.box(0.35, 1.1, 0.25, this.mat(0x333333), 0, 0.55, 0, g);
          rec.light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe63b2e }));
          rec.light.position.set(0, 1.18, 0);
          g.add(rec.light);
          break;
        case 'radar': {
          this.box(w * 0.7, 1.2, d * 0.7, this.mat(0x6f746a), 0, 0.6, 0, g);
          this.cyl(0.15, 0.2, 2.2, this.mat(0x8b8f88, { metalness: 0.6 }), 0, 2.3, 0, g);
          rec.dish = new THREE.Group();
          rec.dish.position.y = 3.5;
          const dish = this.box(3.2, 1.3, 0.16, this.mat(0xd8d8d0, { metalness: 0.3 }), 0, 0, 0, rec.dish);
          dish.rotation.x = -0.25;
          g.add(rec.dish);
          break;
        }
        case 'tower': {
          const leg = this.mat(0x5a5246, { metalness: 0.4 });
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.cyl(0.1, 0.12, 4.6, leg, sx * (w / 2 - 0.3), 2.3, sz * (d / 2 - 0.3), g, 6);
          this.box(w + 0.6, 0.2, d + 0.6, this.mat(0x7b7264), 0, 4.6, 0, g);
          this.box(w, 1.2, 0.1, this.mat(0x6d6559), 0, 5.3, -d / 2, g);
          this.box(0.1, 1.2, d, this.mat(0x6d6559), -w / 2, 5.3, 0, g);
          this.box(0.1, 1.2, d, this.mat(0x6d6559), w / 2, 5.3, 0, g);
          this.box(w + 0.8, 0.15, d + 0.8, this.mat(0x4d473e), 0, 6.5, 0, g);
          for (const sx of [-1, 1]) this.cyl(0.05, 0.05, 2, this.mat(0x333333), sx * 1.5, 6, sx * 1.5, g, 4);
          for (let i = 0; i < 9; i++) this.box(0.6, 0.05, 0.05, this.mat(0x3a3a3a), 0, 0.4 + i * 0.5, d / 2 + 0.15, g);
          break;
        }
        case 'flag': {
          this.cyl(0.05, 0.07, 7, this.mat(0xb0b0b0, { metalness: 0.7, roughness: 0.3 }), 0, 3.5, 0, g, 8);
          const ft = this.canvasTex(220, 160, (c) => {
            c.fillStyle = '#fff'; c.fillRect(0, 0, 220, 160);
            c.fillStyle = '#1d4fa8'; c.fillRect(0, 16, 220, 22); c.fillRect(0, 122, 220, 22);
            c.strokeStyle = '#1d4fa8'; c.lineWidth = 7;
            c.beginPath(); c.moveTo(110, 52); c.lineTo(84, 97); c.lineTo(136, 97); c.closePath();
            c.moveTo(110, 108); c.lineTo(84, 63); c.lineTo(136, 63); c.closePath(); c.stroke();
          });
          rec.flag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2, 8, 1), new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide }));
          rec.flag.position.set(0.88, 6.3, 0);
          rec.flagBase = rec.flag.geometry.attributes.position.array.slice();
          g.add(rec.flag);
          break;
        }
        case 'target': {
          this.cyl(0.04, 0.04, 1.4, this.mat(0x6b4a2a), 0, 0.7, 0, g, 5);
          const tt = this.canvasTex(128, 128, (c) => {
            c.fillStyle = '#e9e4d4'; c.fillRect(0, 0, 128, 128);
            for (const [r, col] of [[56, '#222'], [40, '#e9e4d4'], [26, '#222'], [10, '#e63b2e']]) { c.fillStyle = col; c.beginPath(); c.arc(64, 64, r, 0, 7); c.fill(); }
          });
          const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshStandardMaterial({ map: tt, side: THREE.DoubleSide }));
          board.position.set(0, 1.6, 0);
          board.castShadow = true;
          g.add(board);
          // Earth berm behind the targets.
          if (!this.bermBuilt) { this.bermBuilt = true; this.box(32, 1.6, 1.2, this.mat(0xb89a62), 25.5 * 2 - cx, 0.8, -1.4, g); }
          break;
        }
        case 'sign': {
          const st = this.canvasTex(256, 64, (c) => {
            c.fillStyle = '#1e6b3c'; c.fillRect(0, 0, 256, 64);
            c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(4, 4, 248, 56);
            c.fillStyle = '#fff'; c.font = '800 30px Rubik, Arial'; c.textAlign = 'center'; c.direction = 'rtl';
            c.fillText(o.text, 128, 43);
          });
          const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshStandardMaterial({ map: st, side: THREE.DoubleSide }));
          board.position.set(0, 2.4, 0);
          g.add(board);
          for (const sx of [-1.6, 1.6]) this.cyl(0.05, 0.05, 2.4, this.mat(0x888888), sx, 1.2, 0, g, 6);
          break;
        }
        case 'launcher':
          this.buildLauncher(rec, w, d);
          break;
        case 'busstop': {
          this.box(w, 0.08, 1.4, this.mat(0x3a6e8f), 0, 2.4, 0, g);
          for (const sx of [-w / 2 + 0.1, w / 2 - 0.1]) this.cyl(0.05, 0.05, 2.4, this.mat(0x888888), sx, 1.2, -0.5, g, 6);
          this.box(w * 0.9, 0.08, 0.4, this.mat(0x7a5a36), 0, 0.5, -0.4, g);
          const sign = this.label('🚌 תחנת הסעות', { bg: 'rgba(30,90,140,.92)', size: 0.75 });
          sign.position.set(0, 3.1, 0);
          g.add(sign);
          break;
        }
        case 'books': {
          for (let i = 0; i < 4; i++) this.box(0.35, 0.08, 0.26, this.mat([0xb33a2e, 0x2e6fb3, 0xe0c040, 0x3a8f4f][i]), (i - 1.5) * 0.12, 0.04 + i * 0.08, 0, g);
          const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffd590, emissiveIntensity: 1 }));
          lampM.position.set(0.4, 0.4, 0);
          g.add(lampM);
          break;
        }
        case 'screens': {
          const sm = new THREE.MeshStandardMaterial({ color: 0x0b2a3a, emissive: 0x2a8fd0, emissiveIntensity: 0.7 });
          for (let i = 0; i < 4; i++) this.box(w / 4 - 0.2, 1.2, 0.08, sm, -w / 2 + w / 8 + i * w / 4, 2.1, 0, g);
          rec.screens = { material: sm };
          break;
        }
        case 'truck': {
          const tm = this.mat(o.color || 0x56653a);
          this.box(w * 0.85, 0.5, d, this.mat(0x23281d), 0, 0.85, 0, g);
          this.box(w * 0.85, 1.7, 1.9, tm, 0, 2, d / 2 - 0.95, g);
          this.box(w * 0.85, 1.6, d - 2.4, tm, 0, 1.9, -1.1, g);
          for (const z of [-d / 2 + 0.9, d / 2 - 1]) for (const sx of [-1, 1]) {
            const wh = this.cyl(0.5, 0.5, 0.4, this.mat(0x1b1b1b), sx * w * 0.44, 0.5, z, g, 12);
            wh.rotation.z = Math.PI / 2;
          }
          break;
        }
        case 'container': {
          const tex = this.canvasTex(128, 64, (c) => {
            const col = '#' + new THREE.Color(o.color || 0x5d6b3e).getHexString();
            c.fillStyle = col; c.fillRect(0, 0, 128, 64);
            c.fillStyle = 'rgba(0,0,0,.18)';
            for (let x = 0; x < 128; x += 8) c.fillRect(x, 0, 3, 64);
          });
          tex.wrapS = THREE.RepeatWrapping;
          tex.repeat.set(Math.max(1, w / 2), 1);
          this.box(w, 2.5, d, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.2 }), 0, 1.25, 0, g);
          this.box(0.9, 1.9, 0.06, this.mat(0x3a3a3a), 0, 0.95, d / 2 + 0.03, g);
          const lb = this.label(o.label, { size: 0.8 });
          lb.position.set(0, 3.2, 0);
          g.add(lb);
          break;
        }
        case 'shelter': {
          this.box(w, 2.4, d, this.mat(0x9b9a90, { roughness: 0.95 }), 0, 1.2, 0, g);
          this.box(w + 0.05, 0.35, d + 0.05, this.mat(0xd8392b), 0, 2.0, 0, g);
          this.box(1.1, 1.8, 0.06, this.mat(0x222222), 0, 0.9, d / 2 + 0.03, g);
          const lb = this.label('מיגונית', { bg: 'rgba(200,45,35,.9)', size: 0.8 });
          lb.position.set(0, 3.2, 0);
          g.add(lb);
          break;
        }
      }
      this.props.push(rec);
      return rec;
    }
  },

  buildLauncher(rec, w, d) {
    const g = rec.g;
    const olive = this.mat(0x4b5a2a);
    const dark = this.mat(0x23281d);
    this.box(w * 0.78, 0.5, d, dark, 0, 0.95, 0, g);
    for (const z of [-d / 2 + 1.2, -d / 2 + 2.6, d / 2 - 1.4]) for (const sx of [-1, 1]) {
      const wh = this.cyl(0.55, 0.55, 0.45, this.mat(0x1b1b1b), sx * (w * 0.39 + 0.1), 0.55, z, g, 14);
      wh.rotation.z = Math.PI / 2;
    }
    this.box(w * 0.74, 1.7, 1.9, olive, 0, 2.05, d / 2 - 0.95, g);
    this.box(w * 0.66, 0.6, 0.05, this.mat(0x9fc3d8, { metalness: 0.6, roughness: 0.2 }), 0, 2.45, d / 2 + 0.01, g);
    // Launch box on a hinge behind the cab, raised toward the north.
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.45, d / 2 - 2.1);
    pivot.rotation.x = 0.62;
    g.add(pivot);
    this.box(w * 0.76, 2.3, 5.4, olive, 0, 1.15, -2.7, pivot);
    for (const z of [-0.6, -2.7, -4.8]) this.box(w * 0.8, 2.4, 0.12, this.mat(0x3c4822), 0, 1.15, z, pivot);
    rec.ammoCanvas = document.createElement('canvas');
    rec.ammoCanvas.width = 256; rec.ammoCanvas.height = 128;
    rec.ammoTex = new THREE.CanvasTexture(rec.ammoCanvas);
    rec.ammoTex.encoding = THREE.sRGBEncoding;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.74, 2.2), new THREE.MeshStandardMaterial({ map: rec.ammoTex }));
    face.position.set(0, 1.15, -5.41);
    face.rotation.y = Math.PI;
    pivot.add(face);
    rec.muzzle = new THREE.Object3D();
    rec.muzzle.position.set(0, 1.2, -5.6);
    pivot.add(rec.muzzle);
    rec.empty = this.label('ריק — להחליף מארז', { bg: 'rgba(230,59,46,.92)', size: 1.3 });
    rec.empty.position.set(0, 6.2, 0);
    g.add(rec.empty);
    rec.ammoKey = '';
  },

  drawAmmo(rec) {
    const o = rec.o;
    const key = o.ammo + ':' + o.needsReload;
    if (key === rec.ammoKey) return;
    rec.ammoKey = key;
    const g = rec.ammoCanvas.getContext('2d');
    g.fillStyle = '#3c4822';
    g.fillRect(0, 0, 256, 128);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const i = r * 5 + c;
      g.fillStyle = i < o.ammo ? '#d6cd94' : '#141710';
      g.beginPath(); g.arc(28 + c * 50, 17 + r * 31, 13, 0, 7); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 2; g.stroke();
    }
    rec.ammoTex.needsUpdate = true;
  },

  buildLabels() {
    this.fadeLabels = [];
    for (const b of World.def.buildings) {
      const s = this.label(b.name, b.shelter ? { bg: 'rgba(200,45,35,.9)', size: 0.8 } : {});
      s.position.set((b.x + b.w / 2) * 2, b.shelter ? SHELTER_H + 1.0 : WALL_H + 1.3, (b.y + b.h / 2) * 2);
      this.root.add(s);
      this.fadeLabels.push(s);
    }
    const areas = {
      netivot: [['רחבת מסדרים', 39.5, 28, 2.4], ['מטווח', 25.5, 10.5, 2.8], ['מסלול כושר', 18, 18, 2], ['עמדת שמירה', 59, 38, 8]],
      hq: [['חניון נהגים', 10.5, 37, 5.5]],
      field: DATA.deploy.map(d => [d.name, d.x + d.w / 2, d.y + d.h / 2, 1.2]),
    }[World.id];
    for (const [t, x, y, h] of areas) {
      const s = this.label(t, { size: 0.85 });
      s.position.set(x * 2, h, y * 2);
      this.root.add(s);
      this.fadeLabels.push(s);
    }
    if (World.id !== 'netivot') return;
    // Training board.
    const b = SPOTS.board;
    const g = new THREE.Group();
    g.position.set(b.x * S3, 0, b.y * S3 - 0.5);
    const bt = this.canvasTex(128, 80, (c) => {
      c.fillStyle = '#e9e4d4'; c.fillRect(0, 0, 128, 80);
      c.fillStyle = '#333'; c.font = '800 22px Rubik, Arial'; c.textAlign = 'center'; c.direction = 'rtl';
      c.fillText('אימונים', 64, 32); c.font = '600 14px Rubik, Arial'; c.fillText('מטווח · כושר · טעינה', 64, 58);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ map: bt, side: THREE.DoubleSide }));
    board.position.y = 1.5;
    g.add(board);
    for (const sx of [-0.6, 0.6]) this.cyl(0.04, 0.04, 1.5, this.mat(0x6b4a2a), sx, 0.75, 0, g, 5);
    this.root.add(g);
  },

  buildLamps() {
    const pool = this.canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,214,150,1)');
      gr.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
    this.pools = [];
    this.bulbs = [];
    const pole = this.mat(0x5d5d5d, { metalness: 0.6 });
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffd590, emissiveIntensity: 0 });
    this.poolMat = new THREE.MeshBasicMaterial({ map: pool, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const L of World.lamps) {
      const x = L.x * S3, z = L.y * S3, r = L.r * S3;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.6, r * 1.6), this.poolMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.04, z);
      this.root.add(p);
      if (L.r > 160) continue;
      this.cyl(0.07, 0.09, 4.6, pole, x, 2.3, z, null, 6);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.bulbMat);
      bulb.position.set(x, 4.6, z);
      this.root.add(bulb);
      this.bulbs.push({ x, z });
    }
  },

  buildHorizon() {
    // Distant dunes, the town of Netivot to the south-east, a few palms.
    const dune = this.mat(0xc4a46c, { roughness: 1 });
    const rnd = mulberry(11);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 230 + rnd() * 90;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), dune);
      m.scale.set(40 + rnd() * 50, 8 + rnd() * 14, 30 + rnd() * 30);
      m.position.set(64 + Math.cos(a) * r, -2, 46 + Math.sin(a) * r);
      this.root.add(m);
    }
    this.town = [];
    const townMat = new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 0.9, emissive: 0xffc56b, emissiveIntensity: 0 });
    for (let i = 0; i < 60; i++) {
      const w = 6 + rnd() * 10, h = 6 + rnd() * 22, d = 6 + rnd() * 10;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), townMat);
      m.position.set(150 + rnd() * 170, h / 2, 210 + rnd() * 110);
      this.root.add(m);
    }
    this.townMat = townMat;
    const trunk = this.mat(0x7a5a36), leaf = this.mat(0x5d7a32);
    for (let i = 0; i < 12; i++) {
      const x = 4 + i * 11 + rnd() * 4, z = 92 + rnd() * 6;
      this.cyl(0.18, 0.28, 6, trunk, x, 3, z, null, 6);
      for (let k = 0; k < 6; k++) {
        const f = this.box(2.6, 0.08, 0.6, leaf, x, 6, z);
        f.rotation.y = k * Math.PI / 3;
        f.rotation.z = -0.35;
        f.position.x += Math.cos(k * Math.PI / 3) * 1.1;
        f.position.z -= Math.sin(k * Math.PI / 3) * 1.1;
      }
    }
    // Stars for the night sky.
    const pts = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const a = rnd() * Math.PI * 2, e = 0.12 + rnd() * 1.3;
      pts.set([64 + Math.cos(a) * Math.cos(e) * 500, Math.sin(e) * 500, 46 + Math.sin(a) * Math.cos(e) * 500], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    this.root.add(this.stars);
  },

  // ---------- characters and vehicles ----------
  makeSoldier(look, name) {
    const root = new THREE.Group();
    const uni = this.mat(look.uniform || 0x56653a);
    const skin = this.mat(look.skin || '#d9a77c');
    const hair = this.mat(look.hair || '#2b1d12');
    const boot = this.mat(0x2a2620);
    const parts = { root };
    const limb = (x, y, z, w, h, d, mat, bootH = 0) => {
      const p = new THREE.Group();
      p.position.set(x, y, z);
      this.box(w, h, d, mat, 0, -h / 2, 0, p);
      if (bootH) this.box(w + 0.04, bootH, d + 0.08, boot, 0.04, -h + bootH / 2 - 0.02, 0, p);
      root.add(p);
      return p;
    };
    parts.legL = limb(0, 0.86, 0.11, 0.2, 0.84, 0.18, uni, 0.16);
    parts.legR = limb(0, 0.86, -0.11, 0.2, 0.84, 0.18, uni, 0.16);
    this.box(0.28, 0.62, 0.48, uni, 0, 1.17, 0, root);
    this.box(0.3, 0.08, 0.5, this.mat(0x2e2a20), 0, 0.88, 0, root);
    parts.armL = limb(0, 1.44, 0.31, 0.13, 0.62, 0.13, uni);
    parts.armR = limb(0, 1.44, -0.31, 0.13, 0.62, 0.13, uni);
    for (const a of [parts.armL, parts.armR]) this.box(0.1, 0.1, 0.1, skin, 0, -0.66, 0, a);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skin);
    head.position.set(0.01, 1.66, 0);
    head.castShadow = true;
    root.add(head);
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.158, 16, 12, Math.PI / 2, Math.PI), hair);
    hairM.position.set(0, 1.68, 0);
    root.add(hairM);
    if (look.female) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), hair);
      bun.position.set(-0.17, 1.7, 0);
      root.add(bun);
    }
    parts.beret = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.07, 16), this.mat(0x8fa6c4));
    parts.beret.position.set(-0.01, 1.8, -0.03);
    parts.beret.rotation.x = -0.28;
    parts.beret.scale.set(1.05, 1, 1.1);
    root.add(parts.beret);
    parts.helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0x4f5e34));
    parts.helmet.position.set(0, 1.7, 0);
    root.add(parts.helmet);
    parts.cap = new THREE.Group();
    this.box(0.3, 0.1, 0.3, this.mat(0x3b4a2a), 0, 1.8, 0, parts.cap);
    this.box(0.16, 0.03, 0.26, this.mat(0x3b4a2a), 0.2, 1.76, 0, parts.cap);
    root.add(parts.cap);
    const head0 = look.head || 'none';
    parts.beret.visible = head0 === 'beret';
    parts.helmet.visible = head0 === 'helmet';
    parts.cap.visible = head0 === 'cap';
    parts.carry = this.box(0.55, 0.45, 0.7, this.mat(0x56653a), 0.45, 1.15, 0, root);
    parts.carry.visible = false;
    if (name) {
      parts.tag = this.label(name, { size: 0.55 });
      parts.tag.position.set(0, 2.25, 0);
      root.add(parts.tag);
    }
    // Soldiers use a soft blob instead of real shadow casting: far fewer draw calls with a crowd.
    root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    if (!this.blobMat) this.blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), this.blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.03;
    root.add(blob);
    this.root.add(root);
    return parts;
  },

  animateSoldier(m, ent, moving, dt) {
    m.root.position.set(ent.x * S3, 0, ent.y * S3);
    const target = -ent.angle;
    let d = target - m.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.root.rotation.y += d * Math.min(1, dt * 12);
    m.swing = (m.swing || 0) + ((moving ? 1 : 0) - (m.swing || 0)) * Math.min(1, dt * 8);
    const s = Math.sin(ent.walk) * 0.6 * m.swing;
    m.legL.rotation.z = s;
    m.legR.rotation.z = -s;
    if (m.carry.visible) { m.armL.rotation.z = m.armR.rotation.z = 1.25; }
    else { m.armL.rotation.z = -s * 0.8; m.armR.rotation.z = s * 0.8; }
    m.root.position.y = Math.abs(Math.sin(ent.walk)) * 0.04 * m.swing;
  },

  makeCar(color) {
    const g = new THREE.Group();
    const body = this.mat(color, { metalness: 0.35, roughness: 0.5 });
    this.box(4.3, 0.85, 1.9, body, 0, 0.75, 0, g);
    this.box(2.3, 0.7, 1.75, body, -0.35, 1.5, 0, g);
    this.box(2.32, 0.5, 1.6, this.mat(0x1d2a33, { metalness: 0.6, roughness: 0.2 }), -0.35, 1.52, 0, g);
    for (const x of [-1.35, 1.35]) for (const z of [-0.9, 0.9]) {
      const wh = this.cyl(0.38, 0.38, 0.3, this.mat(0x1a1a1a), x, 0.38, z, g, 12);
      wh.rotation.x = Math.PI / 2;
    }
    for (const z of [-0.65, 0.65]) this.box(0.06, 0.18, 0.35, new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff0b0, emissiveIntensity: 0.9 }), 2.16, 0.85, z, g);
    this.root.add(g);
    return g;
  },

  makeTruck(item) {
    const g = new THREE.Group();
    const olive = this.mat(0x56653a);
    this.box(9, 0.5, 2.4, this.mat(0x23281d), 0, 0.9, 0, g);
    this.box(2, 2.1, 2.4, olive, 3.6, 2.1, 0, g);
    this.box(0.05, 0.8, 2, this.mat(0x9fc3d8, { metalness: 0.6, roughness: 0.2 }), 4.62, 2.5, 0, g);
    for (const x of [-3.2, -1.8, 3.4]) for (const z of [-1.15, 1.15]) {
      const wh = this.cyl(0.55, 0.55, 0.4, this.mat(0x1b1b1b), x, 0.55, z, g, 12);
      wh.rotation.x = Math.PI / 2;
    }
    const load = item.kind === 'launcher'
      ? this.box(5.5, 1.6, 2.2, olive, -1.4, 2.0, 0, g)
      : this.box(5.8, 2.3, 2.3, this.mat(item.color || 0x5d6b3e), -1.4, 2.35, 0, g);
    void load;
    const lb = this.label(item.name, { size: 0.8 });
    lb.position.set(-1.4, 4.4, 0);
    g.add(lb);
    this.root.add(g);
    return g;
  },

  // ---------- red alert sky ----------
  spawnThreat(L) {
    const rocket = {
      kind: 'rocket',
      pos: new THREE.Vector3(-45, 24 + Math.random() * 12, 15 + Math.random() * 60),
      vel: new THREE.Vector3(26 + Math.random() * 8, -1.2, (Math.random() - 0.5) * 6),
    };
    this.addTrail(rocket, 0x7a6e60);
    this.sky.push(rocket);
    const rec = this.props.find(p => p.o === L);
    setTimeout(() => {
      if (!G.alert && !rocket.alive) return;
      Sound.launch();
      const start = new THREE.Vector3();
      if (rec && rec.muzzle) rec.muzzle.getWorldPosition(start); else start.set(170, 2, 15 + Math.random() * 60);
      const it = { kind: 'interceptor', pos: start, vel: new THREE.Vector3(0, 30, -10), target: rocket };
      this.addTrail(it, 0xf2f2f2);
      this.sky.push(it);
      this.puff(start);
    }, 500 + Math.random() * 600);
    rocket.alive = true;
  },
  addTrail(s, color) {
    const n = 60;
    const geo = new THREE.BufferGeometry();
    s.trailPts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) s.trailPts.set([s.pos.x, s.pos.y, s.pos.z], i * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(s.trailPts, 3));
    s.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, fog: false }));
    s.line.frustumCulled = false;
    this.scene.add(s.line);
    s.head = new THREE.Mesh(new THREE.SphereGeometry(s.kind === 'rocket' ? 0.5 : 0.4, 8, 6), new THREE.MeshBasicMaterial({ color: s.kind === 'rocket' ? 0xff6a3a : 0xffffff, fog: false }));
    this.scene.add(s.head);
  },
  puff(at) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6, depthWrite: false }));
    m.position.copy(at);
    this.scene.add(m);
    this.sky.push({ kind: 'smoke', mesh: m, t: 0 });
  },
  updateSky(dt) {
    for (const s of this.sky) {
      if (s.kind === 'smoke' || s.kind === 'boom') {
        s.t += dt;
        const k = s.kind === 'boom' ? 1.6 : 2.5;
        s.mesh.scale.setScalar(1 + s.t * (s.kind === 'boom' ? 14 : 3));
        s.mesh.material.opacity = Math.max(0, (s.kind === 'boom' ? 0.95 : 0.6) * (1 - s.t / k));
        if (s.t > k) { s.dead = true; this.scene.remove(s.mesh); }
        continue;
      }
      if (s.kind === 'rocket') {
        s.pos.addScaledVector(s.vel, dt);
        if (s.pos.x > 260 || s.pos.y < 0) s.dead = true;
      } else {
        const tg = s.target;
        const to = tg.pos.clone().sub(s.pos);
        const dist = to.length();
        if (!tg.alive || tg.dead) { s.dead = true; }
        else if (dist < 3) {
          s.dead = true;
          tg.dead = true;
          tg.alive = false;
          this.boom(tg.pos);
        } else {
          s.vel.lerp(to.normalize().multiplyScalar(85), Math.min(1, dt * 3));
          s.pos.addScaledVector(s.vel, dt);
        }
      }
      const a = s.trailPts;
      a.copyWithin(3, 0, a.length - 3);
      a[0] = s.pos.x; a[1] = s.pos.y; a[2] = s.pos.z;
      s.line.geometry.attributes.position.needsUpdate = true;
      s.head.position.copy(s.pos);
      if (s.dead) {
        s.alive = false;
        this.scene.remove(s.head);
        const line = s.line;
        setTimeout(() => this.scene.remove(line), 1500);
      }
    }
    this.sky = this.sky.filter(s => !s.dead);
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 12);
  },
  boom(at) {
    Sound.boom();
    G.state.stats.intercepts++;
    G.shake = 0.5;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
    m.position.copy(at);
    this.scene.add(m);
    this.sky.push({ kind: 'boom', mesh: m, t: 0 });
    this.flash.position.copy(at);
    this.flash.intensity = 6;
  },
  clearSky() {
    for (const s of this.sky) {
      if (s.mesh) this.scene.remove(s.mesh);
      if (s.head) this.scene.remove(s.head);
      if (s.line) this.scene.remove(s.line);
    }
    this.sky = [];
  },

  // ---------- per-frame sync ----------
  update(dt, now) {
    const P = G.player;
    const night = Game.darkness() / 0.62;

    // Sky colour and lights by time of day.
    const day = new THREE.Color(0x9fc9ee), dusk = new THREE.Color(0xe7a774), dark = new THREE.Color(0x0b1430);
    const h = (G.state.clock % 1440) / 60;
    const sky = night > 0.5 ? dusk.clone().lerp(dark, (night - 0.5) * 2) : day.clone().lerp(dusk, night * 2 * ((h > 12) ? 1 : 0.5));
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    this.sun.intensity = 0.95 * (1 - night) + 0.05;
    this.hemi.intensity = 0.68 * (1 - night) + 0.18;
    this.hemi.color.set(night > 0.5 ? 0x7f8fbf : 0xdfeaff);
    const sunAng = (h - 6) / 13 * Math.PI;
    this.sun.position.set(P.x * S3 + Math.cos(sunAng) * 40, 30 + Math.sin(Math.max(0.2, sunAng)) * 30, P.y * S3 - 25);
    this.sun.target.position.set(P.x * S3, 0, P.y * S3);
    this.stars.material.opacity = Math.max(0, night - 0.4) * 1.6;
    this.poolMat.opacity = night * 0.55;
    this.bulbMat.emissiveIntensity = night * 2;
    this.townMat.emissiveIntensity = night * 0.35;
    this.playerLight.intensity = night * 0.9;
    this.playerLight.position.set(P.x * S3, 2.5, P.y * S3);
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.4;
      const near = this.bulbs.map(b => ({ b, d: (b.x - P.x * S3) ** 2 + (b.z - P.y * S3) ** 2 })).sort((a, b) => a.d - b.d);
      this.lampLights.forEach((l, i) => { const n = near[i]; if (n) l.position.set(n.b.x, 4.3, n.b.z); });
    }
    this.lampLights.forEach(l => l.intensity = night * 1.6);

    // Props.
    for (const r of this.props) {
      const o = r.o;
      if (o.kind === 'bed') { r.messy.visible = o.messy; r.neat.visible = !o.messy; }
      else if (o.kind === 'locker') r.door.rotation.y = THREE.MathUtils.lerp(r.door.rotation.y, o.open ? -1.8 : 0, Math.min(1, dt * 8));
      else if (o.kind === 'panel') r.light.material.color.set(World.gateOpen > 0.5 ? 0x46d16b : 0xe63b2e);
      else if (o.kind === 'radar') r.dish.rotation.y = now / 900;
      else if (o.kind === 'launcher') {
        this.drawAmmo(r);
        r.empty.visible = o.needsReload;
        if (o.needsReload) r.empty.material.opacity = 0.75 + Math.sin(now / 200) * 0.25;
      } else if (o.kind === 'flag') {
        const pos = r.flag.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const bx = r.flagBase[i * 3];
          pos.array[i * 3 + 2] = Math.sin(now / 260 + bx * 3) * 0.12 * (bx + 0.85);
        }
        pos.needsUpdate = true;
      } else if (o.kind === 'console') r.screens.material.emissiveIntensity = 0.6 + Math.sin(now / 300) * 0.2;
    }
    this.gateArm.rotation.z = World.gateOpen * Math.PI / 2.2;

    // People.
    const pr = G.profile;
    if (!this.player) {
      this.player = this.makeSoldier({ skin: pr.skin, hair: pr.hair, female: pr.gender === 'f', head: 'beret', uniform: 0x5b6b3c });
    }
    const pm = this.player;
    pm.beret.visible = !G.alert;
    pm.helmet.visible = !!G.alert;
    pm.carry.visible = !!P.carry;
    this.animateSoldier(pm, P, P.moving, dt);

    const alive = new Set(G.npcs);
    for (const [n, m] of this.models) if (!alive.has(n)) { this.root.remove(m.root); this.models.delete(n); }
    for (const n of G.npcs) {
      let m = this.models.get(n);
      if (!m) { m = this.makeSoldier(n.look, n.short); this.models.set(n, m); m.last = { x: n.x, y: n.y }; }
      const moving = Math.hypot(n.x - m.last.x, n.y - m.last.y) > 0.01;
      m.last = { x: n.x, y: n.y };
      // Speech bubble over the head.
      const bt = n.bubble ? n.bubble.text : null;
      if (bt !== m.bubbleText) {
        if (m.bubbleSprite) m.root.remove(m.bubbleSprite);
        m.bubbleSprite = null;
        if (bt) {
          m.bubbleSprite = this.label(bt, { bg: 'rgba(255,255,255,.95)', fg: '#1d1d10', size: 0.62 });
          m.bubbleSprite.position.set(0, 2.8, 0);
          m.root.add(m.bubbleSprite);
        }
        m.bubbleText = bt;
      }
      if (G.alert && n.sheltering) { m.helmet.visible = true; m.beret.visible = m.cap.visible = false; }
      else { m.helmet.visible = n.look.head === 'helmet'; m.beret.visible = n.look.head === 'beret'; m.cap.visible = n.look.head === 'cap'; }
      this.animateSoldier(m, n, moving, dt);
    }

    // Gate car.
    const car = Story.gateShift && Story.gateShift.car;
    if (car) {
      if (!car.mesh) car.mesh = this.makeCar(new THREE.Color(car.color));
      car.mesh.visible = !car.hidden;
      car.mesh.position.set(car.x * S3, 0, car.y * S3);
      car.mesh.rotation.y = -car.angle;
    }
    if (this.lastCar && this.lastCar !== car && this.lastCar.mesh) this.root.remove(this.lastCar.mesh);
    this.lastCar = car;

    // Deployment trucks carrying containers.
    const tr = World.id === 'field' ? Story.deployTruck : null;
    if (tr) {
      if (!tr.mesh) tr.mesh = this.makeTruck(tr.item);
      tr.mesh.position.set(tr.x * S3, 0, tr.y * S3);
      tr.mesh.rotation.y = -tr.angle;
    }
    if (this.lastTruck && this.lastTruck !== tr && this.lastTruck.mesh) this.root.remove(this.lastTruck.mesh);
    this.lastTruck = tr;

    const here = World.id === 'netivot';
    this.syncSmall(here ? Story.trash : [], this.trashMeshes, (t) => {
      const g = new THREE.Group();
      const mats = [0xe7e2d4, 0x3a6ea5, 0xb33a2e];
      const item = t.kind === 0
        ? new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.mat(mats[0]))
        : new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, t.kind === 1 ? 0.22 : 0.34, 10), this.mat(mats[t.kind], { metalness: 0.5 }));
      item.position.y = 0.15;
      if (t.kind) { item.rotation.z = Math.PI / 2; item.position.y = 0.08; }
      item.castShadow = true;
      g.add(item);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 24), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      g.add(ring);
      g.userData.ring = ring;
      return g;
    }, now);
    this.syncSmall(here ? Story.dust : [], this.dustMeshes, () => {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.16 + Math.random() * 0.1, 10), new THREE.MeshBasicMaterial({ color: 0x6e5a3c, transparent: true, opacity: 0.6, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(Math.sin(i * 2.1) * 0.35, 0.03, Math.cos(i * 1.7) * 0.3);
        g.add(m);
      }
      return g;
    }, now);

    // Objective marker.
    const tgt = Game.objectiveTarget();
    this.marker.visible = this.markerRing.visible = !!tgt;
    if (tgt) {
      const col = G.alert ? 0xe63b2e : 0xf2c14e;
      this.markerCone.material.color.set(col);
      this.markerRing.material.color.set(col);
      this.marker.position.set(tgt.x * S3, 2.9 + Math.sin(now / 220) * 0.2, tgt.y * S3);
      this.marker.rotation.y = now / 600;
      this.markerRing.position.set(tgt.x * S3, 0.05, tgt.y * S3);
      this.markerRing.scale.setScalar(1 + Math.sin(now / 250) * 0.12);
    }

    // Big signs fade out when the camera is right next to them.
    for (const s of this.fadeLabels) {
      const d = s.position.distanceTo(this.camera.position);
      s.material.opacity = Math.max(0, Math.min(1, (d - 6) / 8));
      s.visible = s.material.opacity > 0.02;
    }

    this.updateSky(dt);
    this.updateCamera(dt);
  },

  syncSmall(list, map, make, now) {
    const alive = new Set(list);
    for (const [k, m] of map) if (!alive.has(k)) { this.root.remove(m); map.delete(k); }
    for (const it of list) {
      let m = map.get(it);
      if (!m) { m = make(it); m.position.set(it.x * S3, 0, it.y * S3); this.root.add(m); map.set(it, m); }
      if (m.userData.ring) m.userData.ring.material.opacity = 0.35 + Math.sin(now / 250) * 0.25;
    }
  },

  // Orbit camera behind the player. When a wall sits between the player and
  // the camera, the camera tilts up to look over it instead of clipping.
  updateCamera(dt) {
    const P = G.player;
    // Look slightly past the right shoulder, like most third-person games.
    const B = this.basis();
    const tx = P.x * S3 + B.rx * 0.45, tz = P.y * S3 + B.rz * 0.45, ty = 1.55;
    const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw);
    let need = this.pitch;
    const horiz = this.dist * Math.cos(this.pitch);
    for (let s = 0.4; s < horiz; s += 0.25) {
      const tile = World.tile(Math.floor((tx + sx * s) / 2), Math.floor((tz + sz * s) / 2));
      if (tile === T.WALL) {
        const lineH = ty + s * Math.tan(this.pitch);
        if (lineH < WALL_H + 0.3) need = Math.max(need, Math.atan2(WALL_H + 0.6 - ty, s));
        break;
      }
    }
    need = Math.min(need, 1.38);
    this.effPitch += (need - this.effPitch) * Math.min(1, dt * 6);
    const p = this.effPitch;
    const c = this.camera;
    c.position.set(tx + sx * Math.cos(p) * this.dist, ty + Math.sin(p) * this.dist, tz + sz * Math.cos(p) * this.dist);
    if (G.shake > 0) c.position.add(new THREE.Vector3((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake));
    c.lookAt(tx, ty + 0.2, tz);
  },

  render() { this.renderer.render(this.scene, this.camera); },

  // Unit vectors on the ground for camera-relative movement (in world px axes).
  basis() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    return { fx, fz, rx: -fz, rz: fx };
  },
};
