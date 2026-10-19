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
    if (this.sun && typeof Settings !== 'undefined') this.sun.castShadow = Settings.shadows();
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
  // Add a Higgsfield-generated model to a group; returns false when it isn't loaded.
  addModel(g, name, fit) {
    const m = Assets.model(name, fit);
    if (!m) return false;
    g.add(m);
    return true;
  },

  // ---------- world construction ----------
  build() {
    if (this.root) this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.models = new Map();
    this.mealProps = [];
    this.mealShown = undefined;
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
    let sandTex = null;
    const green = World.id === 'hq';
    const groundImg = green ? Assets.images.grass : Assets.images.sand;
    if (groundImg) {
      sandTex = new THREE.Texture(groundImg);
      sandTex.needsUpdate = true;
      sandTex.encoding = THREE.sRGBEncoding;
      sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
      sandTex.repeat.set(1400 / 8, 1400 / 8);
      sandTex.anisotropy = 8;
    }
    const desert = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.mat(sandTex ? (green ? 0xc4d2a8 : 0xd8c9a8) : (green ? 0x6f8f45 : 0xc9ad78), { roughness: 1, map: sandTex }));
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
    const walls = [], shelters = [], windows = [];
    // The gate booth has windows on the gate side (west and south), to watch the road.
    const booth = World.def.buildings.find(b => b.id === 'booth');
    const isWindow = (x, y) => booth && x >= booth.x && x < booth.x + booth.w && y >= booth.y && y < booth.y + booth.h && (x === booth.x || y === booth.y + booth.h - 1);
    for (let y = 0; y < World.H; y++) for (let x = 0; x < World.W; x++) {
      if (World.grid[y][x] !== T.WALL) continue;
      (shelterTiles.has(x + ',' + y) ? shelters : isWindow(x, y) ? windows : walls).push([x, y]);
    }
    let wallTex = null;
    if (Assets.images.wall) {
      wallTex = new THREE.Texture(Assets.images.wall);
      wallTex.needsUpdate = true;
      wallTex.encoding = THREE.sRGBEncoding;
      wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
      wallTex.repeat.set(1, 1.4);
      wallTex.anisotropy = 4;
    }
    // The site's buildings are white army containers (corrugated steel); the shelters stay concrete.
    let boxTex = null;
    if (Assets.images.container) {
      boxTex = new THREE.Texture(Assets.images.container);
      boxTex.needsUpdate = true;
      boxTex.encoding = THREE.sRGBEncoding;
      boxTex.wrapS = boxTex.wrapT = THREE.RepeatWrapping;
      boxTex.anisotropy = 4;
    }
    this.boxTex = boxTex;
    const make = (list, h, color, textured, tex = wallTex) => {
      const mat = tex && textured ? this.mat(color, { roughness: 0.8, map: tex }) : this.mat(0xe4e1d6, { roughness: 0.9 });
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(2, h, 2), mat, list.length);
      const m = new THREE.Matrix4();
      list.forEach(([x, y], i) => { m.makeTranslation(x * 2 + 1, h / 2, y * 2 + 1); im.setMatrixAt(i, m); });
      im.castShadow = true;
      im.receiveShadow = true;
      this.root.add(im);
    };
    make(walls, WALL_H, 0xffffff, true, boxTex);
    make(shelters, SHELTER_H, 0xb4b2a8, true);
    if (windows.length) {
      const wm = boxTex ? this.mat(0xffffff, { roughness: 0.8, map: boxTex }) : this.mat(0xe4e1d6);
      const glass = new THREE.MeshStandardMaterial({ color: 0xbfd8e6, transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0.2, depthWrite: false });
      for (const [x, y] of windows) {
        this.box(2, 1.05, 2, wm, x * 2 + 1, 0.525, y * 2 + 1);
        this.box(2, 0.75, 2, wm, x * 2 + 1, WALL_H - 0.375, y * 2 + 1);
        const pane = this.box(1.96, WALL_H - 1.8, 0.04, glass, x * 2 + 1, 1.05 + (WALL_H - 1.8) / 2, y * 2 + 1);
        pane.castShadow = false;
        if (x === booth.x) pane.rotation.y = Math.PI / 2;
        this.box(2.02, 0.06, 2.02, this.mat(0x6f6a5c), x * 2 + 1, 1.08, y * 2 + 1);
      }
    }
    // Wall caps and red bands on shelters.
    const red = this.mat(0xd8392b);
    for (const b of World.def.buildings) {
      if (b.shelter) {
        this.box(b.w * 2, 0.35, 0.08, red, (b.x + b.w / 2) * 2, SHELTER_H - 0.4, b.y * 2 - 0.02);
        this.box(b.w * 2, 0.35, 0.08, red, (b.x + b.w / 2) * 2, SHELTER_H - 0.4, (b.y + b.h) * 2 + 0.02);
        // A roof slab half over the shelter keeps the inside visible from above.
        this.box(b.w * 2, 0.25, b.h * 2 * 0.45, this.mat(0x8a8980), (b.x + b.w / 2) * 2, SHELTER_H + 0.12, b.y * 2 + b.h * 2 * 0.225);
      } else {
        // Thin cap along the top of each container's walls.
        const cap = this.mat(0xcfcbc0, { metalness: 0.2 });
        const cx = (b.x + b.w / 2) * 2, cz = (b.y + b.h / 2) * 2;
        this.box(b.w * 2, 0.12, 2, cap, cx, WALL_H + 0.06, b.y * 2 + 1);
        this.box(b.w * 2, 0.12, 2, cap, cx, WALL_H + 0.06, (b.y + b.h) * 2 - 1);
        this.box(2, 0.12, b.h * 2, cap, b.x * 2 + 1, WALL_H + 0.06, cz);
        this.box(2, 0.12, b.h * 2, cap, (b.x + b.w) * 2 - 1, WALL_H + 0.06, cz);
      }
    }
    this.containerDetails(booth);
  },

  // Barred windows along the containers' outer walls, and a frame with a little awning and a
  // lamp over every door, like the site's real containers. Instanced: two draw calls a site.
  containerDetails(booth) {
    const wins = [], doors = [];
    const isWall = (x, y) => World.tile(x, y) === T.WALL;
    for (const b of World.def.buildings) {
      if (b.shelter || b === booth) continue;
      const sides = [
        { n: [0, -1], tiles: (i) => [b.x + i, b.y], len: b.w },
        { n: [0, 1], tiles: (i) => [b.x + i, b.y + b.h - 1], len: b.w },
        { n: [-1, 0], tiles: (i) => [b.x, b.y + i], len: b.h },
        { n: [1, 0], tiles: (i) => [b.x + b.w - 1, b.y + i], len: b.h },
      ];
      for (const s of sides) {
        let gap = 1;
        for (let i = 1; i < s.len - 1; i++) {
          const [x, y] = s.tiles(i);
          const [px, py] = s.tiles(i - 1), [nx, ny] = s.tiles(i + 1);
          // Outside the wall must be open ground (a neighbouring building would hide it).
          if (World.blockedTile(x + s.n[0], y + s.n[1])) { gap = 0; continue; }
          if (!isWall(x, y)) { doors.push({ x, y, n: s.n }); gap = 0; continue; }
          gap++;
          if (gap >= 3 && isWall(px, py) && isWall(nx, ny)) { wins.push({ x, y, n: s.n }); gap = 0; }
        }
      }
      for (const [x, y] of b.doors || []) if (!World.blockedTile(x, y)) {
        const n = y === b.y ? [0, -1] : y === b.y + b.h - 1 ? [0, 1] : x === b.x ? [-1, 0] : [1, 0];
        if (!doors.some(d => d.x === x && d.y === y)) doors.push({ x, y, n });
      }
    }
    const place = (im, list, h, out, extra) => {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1);
      list.forEach((w, i) => {
        e.set(extra || 0, Math.atan2(w.n[0], w.n[1]), 0, 'YXZ');
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(w.x * 2 + 1 + w.n[0] * (1 + out), h, w.y * 2 + 1 + w.n[1] * (1 + out)), q, sc);
        im.setMatrixAt(i, m);
      });
      this.root.add(im);
    };
    if (wins.length) {
      if (!this.winTex) this.winTex = this.canvasTex(128, 128, (c) => {
        c.fillStyle = '#f2f1ec'; c.fillRect(0, 0, 128, 128);
        c.fillStyle = '#4c5458'; c.fillRect(10, 10, 108, 108);
        c.fillStyle = 'rgba(190,210,220,.35)'; c.fillRect(10, 10, 52, 108);
        c.fillStyle = '#d9d7d0'; c.fillRect(62, 10, 4, 108);
        // The security grille: thin white diamonds.
        c.strokeStyle = '#f7f6f2'; c.lineWidth = 3;
        for (let k = -128; k < 256; k += 22) { c.beginPath(); c.moveTo(10 + k, 10); c.lineTo(10 + k + 108, 118); c.stroke(); c.beginPath(); c.moveTo(118 - k, 10); c.lineTo(118 - k - 108, 118); c.stroke(); }
        c.strokeStyle = '#f2f1ec'; c.lineWidth = 10; c.strokeRect(5, 5, 118, 118);
      });
      const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.25, 1.05), new THREE.MeshStandardMaterial({ map: this.winTex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }), wins.length);
      place(im, wins, 1.75, 0.012);
      const aw = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.04, 0.38), this.mat(0xe8e6df, { metalness: 0.25 }), wins.length);
      place(aw, wins, 2.42, 0.17, -0.3);
    }
    if (doors.length) {
      const frame = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 0.7, 0.12), this.mat(0xeae8e1, { map: this.boxTex }), doors.length);
      place(frame, doors, WALL_H - 0.35, -0.06);
      const aw = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.05, 0.6), this.mat(0xdedcd4, { metalness: 0.25 }), doors.length);
      place(aw, doors, 2.62, 0.28, -0.28);
      const lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c8, emissiveIntensity: 0.4 }), doors.length);
      place(lamp, doors, 2.42, 0.03);
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
    const [fx0, fy0, fx1, fy1] = World.fence;
    const a = fx0 * 2 + 1, b = fx1 * 2 + 1, top = fy0 * 2 + 1, bot = fy1 * 2 + 1;
    panel(a, top, b, top);
    panel(a, top, a, bot);
    panel(b, top, b, bot);
    panel(a, bot, 58, bot);
    panel(66, bot, b, bot);
    const posts = [];
    for (let x = fx0; x <= fx1; x++) { posts.push([x * 2 + 1, top]); if (x < 29 || x > 32) posts.push([x * 2 + 1, bot]); }
    for (let y = fy0 + 1; y < fy1; y++) { posts.push([a, y * 2 + 1]); posts.push([b, y * 2 + 1]); }
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

  // Food on a plate or a tray. Each meal has its own: omelette and salad in the morning,
  // schnitzel and puree at lunch, pasta and soup at dinner. updateMeals shows the right one.
  dish(parent, x, y, z, r, slot = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    const make = (parts) => { const k = new THREE.Group(); for (const p of parts) k.add(p); k.visible = false; g.add(k); return k; };
    const disc = (rr, h, color, dx = 0, dz = 0, dy = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, h, 12), this.mat(color)); m.position.set(dx, h / 2 + dy, dz); return m; };
    const ball = (rr, color, dx = 0, dz = 0) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rr, 8, 6), this.mat(color)); m.position.set(dx, rr * 0.6, dz); return m; };
    const v = slot % 3;
    g.userData.kinds = {
      breakfast: make(v === 0 ? [disc(r * 0.75, 0.025, 0xf2d04e), ball(r * 0.25, 0xd8261f, r * 0.5, r * 0.3), ball(r * 0.22, 0x5fae3a, -r * 0.5, -r * 0.3)]
        : v === 1 ? [ball(r * 0.4, 0xd9a35c, 0, 0), ball(r * 0.3, 0xf4efe4, r * 0.5, 0)] : [disc(r * 0.8, 0.03, 0xfaf6ea), ball(r * 0.25, 0x5fae3a, 0, 0)]),
      lunch: make(v === 0 ? [disc(r * 0.6, 0.03, 0xc98a3c, -r * 0.2), ball(r * 0.35, 0xf2ead2, r * 0.5, 0)]
        : v === 1 ? [disc(r * 0.8, 0.04, 0xeacb7a), ball(r * 0.2, 0x8a3a1a, 0, 0)] : [ball(r * 0.3, 0xe07a2c, -r * 0.3), ball(r * 0.3, 0x5fae3a, r * 0.3)]),
      dinner: make(v === 0 ? [disc(r * 0.7, 0.04, 0xf0c34e), ball(r * 0.18, 0xd8261f, 0, 0)]
        : v === 1 ? [disc(r * 0.75, 0.05, 0xc2462a)] : [ball(r * 0.35, 0xe8d9b0, 0, 0), ball(r * 0.2, 0x5fae3a, r * 0.5, 0)]),
    };
    return g;
  },
  updateMeals() {
    const c = G.state ? G.state.clock % 1440 : 0;
    const meal = c >= 6.5 * 60 && c < 10 * 60 ? 'breakfast' : c >= 11.5 * 60 && c < 15 * 60 ? 'lunch' : c >= 17 * 60 && c < 21 * 60 ? 'dinner' : null;
    if (meal === this.mealShown) return;
    this.mealShown = meal;
    for (const rec of this.mealProps) for (const d of rec.meals) for (const k in d.userData.kinds) d.userData.kinds[k].visible = k === meal;
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
          const top = o.top !== undefined ? o.top : o.y < 28 * TS;
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
          rec.meals = [];
          for (let i = 0; i < 4; i++) {
            const px = -w / 2 + 0.4 + i * (w - 0.8) / 3;
            this.cyl(0.13, 0.13, 0.03, this.mat(0xf1ece0), px, 0.81, 0, g);
            rec.meals.push(this.dish(g, px, 0.83, 0, 0.11));
          }
          this.mealProps.push(rec);
          break;
        case 'counter':
          this.box(w, 0.95, d, this.mat(0x9a9a92, { metalness: 0.3 }), 0, 0.475, 0, g);
          this.box(w, 0.05, d + 0.08, this.mat(0xc9c9c1, { metalness: 0.5, roughness: 0.4 }), 0, 0.97, 0, g);
          // A serving counter in a dining room carries trays of whatever is being served.
          if (World.def && World.def.buildings.some(b => b.id === 'dining' && o.x >= b.x * TS && o.x < (b.x + b.w) * TS && o.y >= b.y * TS && o.y < (b.y + b.h) * TS)) {
            rec.meals = [];
            const n = Math.max(2, Math.floor(w / 0.7));
            for (let i = 0; i < n; i++) {
              const px = -w / 2 + 0.35 + i * (w - 0.7) / Math.max(1, n - 1);
              this.box(0.5, 0.06, d * 0.7, this.mat(0xb8bcc0, { metalness: 0.6, roughness: 0.3 }), px, 1.02, 0, g);
              rec.meals.push(this.dish(g, px, 1.05, 0, 0.2, i));
            }
            this.mealProps.push(rec);
          }
          break;
        case 'shekemwall': {
          // The canteen's back wall: shelves of snacks and the drinks fridges (top of the picture).
          const img = Assets.images.shekem;
          let mat = this.mat(0xd8c9a0);
          if (img) {
            const tex = new THREE.Texture(img);
            tex.needsUpdate = true;
            tex.encoding = THREE.sRGBEncoding;
            tex.anisotropy = 4;
            tex.repeat.set(1, 350 / 576);
            tex.offset.set(0, 1 - 350 / 576);
            mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
          }
          const h = Math.min(WALL_H - 0.1, w * 350 / 1024);
          const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
          wall.position.set(0, h / 2 + 0.02, 0);
          wall.rotation.y = Math.PI;
          g.add(wall);
          break;
        }
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
          if (this.addModel(g, 'radar', { length: 4.6, rotY: 0.6 })) break;
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
          if (this.addModel(g, 'tower', { height: 7.6 })) break;
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
          if (o.berm) this.box(o.berm[1], 1.6, 1.2, this.mat(0xb89a62), o.berm[0] * 2 - cx, 0.8, -1.4, g);
          break;
        }
        case 'pergola': {
          this.pergola(g, w, d);
          break;
        }
        case 'idobox': {
          this.idoBox(g, w, d, o.face || 1);
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
        case 'generator': {
          this.addModel(g, 'generator', { length: Math.max(w, d) * 1.05, rotY: w > d ? 0 : Math.PI / 2 }) || this.box(w, 1.3, d, this.mat(0x4b5a2a), 0, 0.65, 0, g);
          break;
        }
        case 'palm': {
          const palm = Assets.model('palm', { height: 7 + (o.x % 3), rotY: o.y % 6 });
          if (palm) g.add(palm);
          break;
        }
        case 'busstop': {
          this.box(w, 0.08, 1.4, this.mat(0x3a6e8f), 0, 2.4, 0, g);
          for (const sx of [-w / 2 + 0.1, w / 2 - 0.1]) this.cyl(0.05, 0.05, 2.4, this.mat(0x888888), sx, 1.2, -0.5, g, 6);
          this.box(w * 0.9, 0.08, 0.4, this.mat(0x7a5a36), 0, 0.5, -0.4, g);
          const sign = this.label('🚌 תחנת הסעות', { bg: 'rgba(30,90,140,.92)', size: 0.75 });
          sign.position.set(0, 3.1, 0);
          g.add(sign);
          break;
        }
        case 'club': {
          // The club: an old container with a lit doorway, a neon sign and string lights.
          if (!this.addModel(g, 'container', { rotY: Math.PI / 2, size: [w, 2.6, d] })) this.box(w, 2.5, d, this.mat(0x4b5a2a, { roughness: 0.8, metalness: 0.2 }), 0, 1.25, 0, g);
          const glow = new THREE.MeshBasicMaterial({ color: 0x8a3cff });
          this.box(1.25, 2.15, 0.05, glow, 0, 1.075, d / 2 + 0.03, g);
          const frame = this.mat(0x2a2a2a, { metalness: 0.6 });
          for (const sx of [-1, 1]) this.box(0.08, 2.2, 0.1, frame, sx * 0.66, 1.1, d / 2 + 0.05, g);
          this.box(1.4, 0.1, 0.1, frame, 0, 2.2, d / 2 + 0.05, g);
          // The door swung open against the wall.
          const door = this.box(1.2, 2.1, 0.06, this.mat(0x56653a, { metalness: 0.4 }), 0, 1.05, 0, new THREE.Group());
          const hinge = new THREE.Group();
          hinge.position.set(0.66, 0, d / 2 + 0.06);
          door.position.set(0.6, 1.05, 0);
          hinge.add(door);
          hinge.rotation.y = -1.9;
          g.add(hinge);
          const light = new THREE.PointLight(0xb36bff, 1.4, 6, 2);
          light.position.set(0, 1.4, d / 2 + 0.8);
          g.add(light);
          // A doormat and a crate to sit on by the door.
          this.box(1.1, 0.03, 0.6, this.mat(0x7a2b2b), 0, 0.015, d / 2 + 0.4, g);
          this.box(0.55, 0.45, 0.45, this.mat(0x8a6a3a), -w / 2 + 0.6, 0.225, d / 2 + 0.5, g);
          // String lights along the top front edge, twinkling (update).
          const cols = [0xff4f6a, 0xffd23f, 0x4fd1ff, 0x7dff6a, 0xff8f3f];
          rec.bulbs = cols.map(c => new THREE.MeshBasicMaterial({ color: c }));
          const geo = new THREE.SphereGeometry(0.07, 8, 6);
          const n = 14;
          for (let i = 0; i < n; i++) {
            const t = i / (n - 1), x = -w / 2 + 0.15 + t * (w - 0.3);
            const bulb = new THREE.Mesh(geo, rec.bulbs[i % cols.length]);
            bulb.position.set(x, 2.55 - Math.sin(t * Math.PI * 3) ** 2 * 0.22, d / 2 + 0.1);
            g.add(bulb);
          }
          const sign = this.label('🎮 מועדון', { bg: 'rgba(110,40,180,.95)', size: 1.1 });
          sign.position.set(0, 3.5, 0);
          g.add(sign);
          rec.sign = sign;
          const sub = this.label('🕹️ משחקונים · E', { bg: 'rgba(20,20,30,.85)', fg: '#ffd23f', size: 0.55 });
          sub.position.set(0, 2.9, d / 2 + 0.2);
          g.add(sub);
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
          if (this.addModel(g, 'truck', { rotY: Math.PI / 2, depth: d })) break;
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
          if (Assets.has('container')) {
            this.addModel(g, 'container', { rotY: w > d ? Math.PI / 2 : 0, size: [w, 2.6, d] });
            const lb = this.label(o.label, { size: 0.8 });
            lb.position.set(0, 3.3, 0);
            g.add(lb);
            break;
          }
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
        case 'fridge': {
          this.box(w, 1.85, d, this.mat(0xe8ecef, { roughness: 0.4, metalness: 0.2 }), 0, 0.925, 0, g);
          this.box(0.04, 0.5, 0.05, this.mat(0x999999, { metalness: 0.7 }), w / 2 - 0.15, 1.2, d / 2 + 0.03, g);
          this.box(w * 0.98, 0.02, 0.02, this.mat(0xaaaaaa), 0, 1.25, d / 2 + 0.01, g);
          const mag = this.box(0.12, 0.12, 0.02, this.mat(0x2fa3d8), -0.15, 1.5, d / 2 + 0.02, g);
          void mag;
          break;
        }
        case 'stove': {
          this.box(w, 0.9, d, this.mat(0x2b2b2b, { metalness: 0.4 }), 0, 0.45, 0, g);
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.cyl(0.12, 0.12, 0.02, this.mat(0x111111), sx * w * 0.24, 0.91, sz * d * 0.22, g, 12);
          const pan = this.cyl(0.18, 0.15, 0.08, this.mat(0x555555, { metalness: 0.6 }), -w * 0.24, 0.96, -d * 0.22, g, 14);
          void pan;
          this.box(0.3, 0.03, 0.04, this.mat(0x333333), -w * 0.24 - 0.3, 0.98, -d * 0.22, g);
          break;
        }
        case 'junk': {
          rec.junk = g;
          const k = o.junk;
          if (k === 'crt') { this.box(0.55, 0.48, 0.5, this.mat(0xcfc8b0), 0, 0.24, 0, g); this.box(0.42, 0.34, 0.02, this.mat(0x223322, { emissive: 0x112211 }), 0, 0.26, 0.26, g); }
          else if (k === 'chair') { const seat = this.box(0.45, 0.06, 0.45, this.mat(0x5a3a22), 0, 0.42, 0, g); seat.rotation.z = 0.25; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1]]) this.box(0.05, 0.42, 0.05, this.mat(0x3a2a1a), sx * 0.18, 0.21, sz * 0.18, g); this.box(0.45, 0.45, 0.05, this.mat(0x5a3a22), 0, 0.7, -0.2, g); }
          else if (k === 'fax') { this.box(0.5, 0.2, 0.4, this.mat(0xd8d4c4), 0, 0.1, 0, g); this.box(0.3, 0.02, 0.3, this.mat(0xffffff), 0, 0.22, -0.05, g); }
          else if (k === 'papers') { for (let i = 0; i < 4; i++) { const p = this.box(0.42, 0.18, 0.3, this.mat(i % 2 ? 0xf2f0e6 : 0xe6e0c8), 0, 0.09 + i * 0.18, 0, g); p.rotation.y = i * 0.2; } }
          else if (k === 'cables') { this.box(0.6, 0.3, 0.45, this.mat(0x8a6a44), 0, 0.15, 0, g); for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 16), this.mat([0x111111, 0xd8392b, 0x2f6fd8][i])); t.position.set(-0.15 + i * 0.15, 0.34, 0); t.rotation.x = 1.2; g.add(t); } }
          else if (k === 'tent') { const t = this.cyl(0.22, 0.22, 1.2, this.mat(0x4b5a2a), 0, 0.22, 0, g, 10); t.rotation.z = Math.PI / 2; }
          else if (k === 'board') {
            const bt = this.canvasTex(128, 96, (c) => { c.fillStyle = '#f4f1e6'; c.fillRect(0, 0, 128, 96); c.strokeStyle = '#333'; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, i * 16); c.lineTo(128, i * 16); c.stroke(); } c.fillStyle = '#1f4fa8'; c.font = '800 14px Rubik'; c.textAlign = 'center'; c.fillText('שמירות', 64, 13); });
            const bm = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshStandardMaterial({ map: bt, side: THREE.DoubleSide }));
            bm.position.set(0, 0.7, 0); bm.rotation.y = -Math.PI / 2; g.add(bm);
            this.box(0.04, 0.7, 0.04, this.mat(0x6b4a2a), 0, 0.35, 0, g);
          }
          break;
        }
        case 'gymrack': {
          this.box(w, 0.08, d, this.mat(0x2a2a2a), 0, 0.9, 0, g);
          for (const sx of [-w / 2 + 0.1, w / 2 - 0.1]) this.box(0.08, 1.0, d, this.mat(0x2a2a2a), sx, 0.5, 0, g);
          for (let i = 0; i < 6; i++) { const r = 0.09 + (i % 3) * 0.03; const db = this.cyl(r, r, 0.12, this.mat(0x1a1a1a, { metalness: 0.6 }), -w / 2 + 0.35 + i * (w - 0.7) / 5, 0.98 + r, 0, g, 12); db.rotation.x = Math.PI / 2; }
          break;
        }
        case 'bench': {
          this.box(w, 0.1, d, this.mat(0x1f3a6a), 0, 0.45, 0, g);
          this.box(0.08, 0.42, 0.08, this.mat(0x333333), 0, 0.2, -d / 2 + 0.15, g);
          this.box(0.08, 0.42, 0.08, this.mat(0x333333), 0, 0.2, d / 2 - 0.15, g);
          const bar = this.cyl(0.02, 0.02, 1.4, this.mat(0xcccccc, { metalness: 0.8 }), 0, 1.0, -d / 2 + 0.2, g, 6); bar.rotation.z = Math.PI / 2;
          for (const sx of [-0.62, 0.62]) { const p = this.cyl(0.18, 0.18, 0.05, this.mat(0x111111), sx, 1.0, -d / 2 + 0.2, g, 14); p.rotation.z = Math.PI / 2; }
          break;
        }
        case 'treadmill': {
          this.box(w, 0.12, d, this.mat(0x222222), 0, 0.12, 0, g);
          this.box(w * 0.8, 0.02, d * 0.8, this.mat(0x111111), 0, 0.19, 0, g);
          for (const sx of [-w / 2 + 0.05, w / 2 - 0.05]) this.box(0.05, 1.1, 0.05, this.mat(0x555555, { metalness: 0.5 }), sx, 0.7, -d / 2 + 0.1, g);
          this.box(w, 0.25, 0.2, this.mat(0x333333), 0, 1.25, -d / 2 + 0.1, g);
          this.box(w * 0.5, 0.1, 0.02, new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x2a8fbf, emissiveIntensity: 0.8 }), 0, 1.3, -d / 2 + 0.21, g);
          break;
        }
        case 'pullup': {
          const steel = this.mat(0x6f6f6f, { metalness: 0.7, roughness: 0.35 });
          for (const sx of [-w / 2, w / 2]) this.cyl(0.05, 0.05, 2.5, steel, sx, 1.25, 0, g, 8);
          const bar = this.cyl(0.03, 0.03, w, steel, 0, 2.45, 0, g, 8);
          bar.rotation.z = Math.PI / 2;
          for (const sx of [-0.35, 0.35]) { const pl = this.cyl(0.22, 0.22, 0.05, this.mat(0x1d1d1d), sx, 0.03, 0.6, g, 16); void pl; }
          break;
        }
        case 'tree': {
          const h = 4.5 + (o.x % 3);
          this.cyl(0.14, 0.22, h * 0.55, this.mat(0x6b5236), 0, h * 0.27, 0, g, 7);
          const leaf = this.mat(0x4f7a2f);
          for (const [dx, dy, dz, r] of [[0, h * 0.7, 0, 1.4], [0.6, h * 0.6, 0.4, 1.0], [-0.5, h * 0.62, -0.4, 1.1], [0, h * 0.88, 0, 0.9]]) {
            const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf);
            m.position.set(dx, dy, dz);
            m.castShadow = true;
            g.add(m);
          }
          break;
        }
        case 'snackcab': {
          this.box(w, 1.6, d, this.mat(0x6b4a2a), 0, 0.8, 0, g);
          for (let i = 0; i < 3; i++) this.box(w * 0.9, 0.04, d * 0.9, this.mat(0x4a3220), 0, 0.4 + i * 0.4, 0, g);
          rec.cabDoor = this.box(0.04, 1.5, d * 0.95, this.mat(0x7a5a36), -w / 2 - 0.02, 0.8, 0, g);
          for (let i = 0; i < 6; i++) this.box(0.18, 0.22, 0.12, this.mat([0xd8392b, 0xf2c14e, 0x2f6fd8][i % 3]), -0.1 + (i % 2) * 0.2, 0.55 + Math.floor(i / 2) * 0.4, -0.3 + (i % 3) * 0.3, g);
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
    if (this.addModel(g, 'launcher', { depth: d })) {
      // The launch box points north (-z); interceptors leave from its top end.
      rec.muzzle = new THREE.Object3D();
      rec.muzzle.position.set(0, 5.2, -d / 2 + 1);
      g.add(rec.muzzle);
      rec.empty = this.label('ריק — להחליף מארז', { bg: 'rgba(230,59,46,.92)', size: 1.3 });
      rec.empty.position.set(0, 7, 0);
      g.add(rec.empty);
      return;
    }
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
    if (!rec.ammoCanvas) return;
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
      netivot: [['מרכז אתר', 38.8, 24.2, 3.2], ['מטווח', 20, 11.2, 2.8], ['מסלול כושר', 20, 16.7, 2], ['עמדת שמירה', 49.6, 38.3, 8]],
      hq: [['חניון נהגים', 10.5, 37, 5.5], ['מרכז אתר', 51, 14.4, 3.2]],
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
    // Netivot: dunes and the town to the south-east. Hafetz Haim: green Shfela hills,
    // orchards and the red roofs of Gedera.
    const green = World.id === 'hq';
    const dune = this.mat(green ? 0x7f9a55 : 0xc4a46c, { roughness: 1 });
    const rnd = mulberry(11);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 230 + rnd() * 90;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), dune);
      m.scale.set(40 + rnd() * 50, (green ? 14 : 8) + rnd() * 14, 30 + rnd() * 30);
      m.position.set(64 + Math.cos(a) * r, -2, 46 + Math.sin(a) * r);
      this.root.add(m);
    }
    this.town = [];
    const townMat = new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 0.9, emissive: 0xffc56b, emissiveIntensity: 0 });
    const roof = this.mat(0xb5532e);
    for (let i = 0; i < 60; i++) {
      const w = 6 + rnd() * 10, h = (green ? 5 : 6) + rnd() * (green ? 12 : 22), d = 6 + rnd() * 10;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), townMat);
      const x = 150 + rnd() * 170, z = 210 + rnd() * 110;
      m.position.set(x, h / 2, z);
      this.root.add(m);
      if (green && i % 2 === 0) {
        const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3.5, 4), roof);
        r.position.set(x, h + 1.7, z);
        r.rotation.y = Math.PI / 4;
        this.root.add(r);
      }
    }
    this.townMat = townMat;
    if (green) {
      // Orchards and eucalyptus rows around the base, as instanced meshes.
      const spots = [];
      for (let row = 0; row < 7; row++) for (let i = 0; i < 26; i++) spots.push([-20 + i * 7 + rnd() * 2, 100 + row * 7 + rnd() * 2, 2.6 + rnd()]);
      for (let i = 0; i < 40; i++) spots.push([-8 - rnd() * 40, -10 + i * 3.2 + rnd() * 2, 6 + rnd() * 4]);
      for (let i = 0; i < 40; i++) spots.push([136 + rnd() * 40, -10 + i * 3.2 + rnd() * 2, 6 + rnd() * 4]);
      for (let i = 0; i < 30; i++) spots.push([-10 + i * 5 + rnd() * 3, -12 - rnd() * 30, 5 + rnd() * 5]);
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.25, 1, 6), this.mat(0x6b5236), spots.length);
      const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.mat(0x4a7a2c), spots.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
      spots.forEach(([x, z, h], i) => {
        m.compose(pos.set(x, h * 0.3, z), q, sc.set(1, h * 0.6, 1)); trunks.setMatrixAt(i, m);
        m.compose(pos.set(x, h * 0.75, z), q, sc.set(h * 0.32, h * 0.36, h * 0.32)); crowns.setMatrixAt(i, m);
      });
      this.root.add(trunks, crowns);
    } else {
      const trunk = this.mat(0x7a5a36), leaf = this.mat(0x5d7a32);
      for (let i = 0; i < 12; i++) {
        const x = 4 + i * 11 + rnd() * 4, z = 92 + rnd() * 6;
        const palm = Assets.model('palm', { height: 6.5 + rnd() * 2, rotY: rnd() * 6 });
        if (palm) { palm.position.set(x, 0, z); this.root.add(palm); continue; }
        this.cyl(0.18, 0.28, 6, trunk, x, 3, z, null, 6);
        for (let k = 0; k < 6; k++) {
          const f = this.box(2.6, 0.08, 0.6, leaf, x, 6, z);
          f.rotation.y = k * Math.PI / 3;
          f.rotation.z = -0.35;
          f.position.x += Math.cos(k * Math.PI / 3) * 1.1;
          f.position.z -= Math.sin(k * Math.PI / 3) * 1.1;
        }
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
    if (Assets.has('soldier')) return this.makeRiggedSoldier(look, name);
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
    // Officer rank: blue shoulder boards with white bars ("ארונות"), or the major's leaf ("פלאפל").
    if (look.rank) {
      const blue = this.mat(0x1f4fa8, { roughness: 0.6 });
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666, roughness: 0.4 });
      for (const side of [-1, 1]) {
        const ep = new THREE.Group();
        ep.position.set(0, 1.505, side * 0.2);
        this.box(0.22, 0.04, 0.22, blue, 0, 0, 0, ep);
        if (look.rank === 'leaf') {
          const leaf = this.box(0.1, 0.016, 0.1, white, 0, 0.026, 0, ep);
          leaf.rotation.y = Math.PI / 4;
          this.box(0.016, 0.016, 0.07, white, 0, 0.026, side * 0.08, ep);
        } else {
          // A single bar sits at the outer end of the shoulder strap, away from the neck.
          if (look.rank === 1) this.box(0.17, 0.016, 0.04, white, 0, 0.026, side * 0.05, ep);
          else for (let i = 0; i < look.rank; i++) this.box(0.17, 0.016, 0.04, white, 0, 0.026, (i - (look.rank - 1) / 2) * 0.08, ep);
        }
        root.add(ep);
      }
    }
    const head0 = look.head || 'none';
    // Nobody wears the beret on their head on base; it stays folded away.
    parts.beret.visible = false;
    parts.helmet.visible = head0 === 'helmet';
    parts.cap.visible = false;
    this.carryProps(parts, root, 0.45, 1.15);
    if (name) {
      parts.tag = this.label(name, { size: 0.55 });
      parts.tag.position.set(0, 2.25, 0);
      root.add(parts.tag);
    }
    this.extras(parts, look, root);
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

  // Higgsfield-generated rigged soldier with a walk cycle. Headgear, hair bun, rank
  // and the carried canister are pinned to the skeleton so they move with it.
  // A cast member's own model finished loading: rebuild whoever is drawn as them.
  personReady(id) {
    const drop = (m) => { if (m && m.root.parent) m.root.parent.remove(m.root); };
    for (const [n, m] of this.models || []) if (m.who === id && !m.own) { drop(m); this.models.delete(n); }
    for (const [k, m] of this.remotes || []) if (m.who === id && !m.own) { drop(m); this.remotes.delete(k); }
    if (this.player && this.player.who === id && !this.player.own) { drop(this.player); this.player = null; }
  },

  makeRiggedSoldier(look, name) {
    const root = new THREE.Group();
    const made = Assets.soldier(look.id);
    const own = !!(look.id && Assets.people[look.id]);
    // The lean group tips the whole body forward when running, pivoting at the feet.
    const lean = new THREE.Group();
    root.add(lean);
    lean.add(made.object);
    const parts = { root, rigged: true, lean, who: look.id || null, own };
    // Idle, walk and run clips, blended by speed. A cast member's own skeleton gets the clips
    // moved onto it (Assets.clipsFor); without the library the old walk cycle is used.
    const clips = Assets.clipsFor(own ? Assets.people[look.id].scene : Assets.models.soldier, own ? look.id : '_soldier');
    if (clips || Assets.walkClip) {
      parts.mixer = new THREE.AnimationMixer(made.inner);
      const walkClip = clips ? (look.female && clips.walkF ? clips.walkF : clips.walk) : Assets.walkFor(look.id);
      parts.acts = { walk: parts.mixer.clipAction(walkClip) };
      if (clips && clips.run) parts.acts.run = parts.mixer.clipAction(clips.run);
      if (clips && clips.idle) parts.acts.idle = parts.mixer.clipAction(clips.idle);
      if (clips && clips.dance) parts.acts.dance = parts.mixer.clipAction(clips.dance);
      parts.w = { walk: 0, run: 0, idle: 1, dance: 0 };
      for (const k in parts.acts) { parts.acts[k].play(); parts.acts[k].setEffectiveWeight(k === 'idle' ? 1 : 0); }
      // Without an idle clip, standing is the first frame of the walk.
      if (!parts.acts.idle) parts.acts.walk.setEffectiveWeight(1);
      parts.action = parts.acts.walk;
    }
    root.updateMatrixWorld(true);
    const head = Assets.bone(made.inner, [/^head$/i, /head(?!.*end)/i, /neck/i]);
    const chest = Assets.bone(made.inner, [/spine0?2/i, /chest/i, /spine0?1/i, /spine/i]) || head;
    const headPos = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.55, 0);
    const top = 1.75;
    const pin = (bone, mesh) => { root.add(mesh); if (bone) bone.attach(mesh); return mesh; };
    const hair = this.mat(look.hair || '#2b1d12');

    parts.beret = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.06, 16), this.mat(0x8fa6c4));
    parts.beret.position.set(headPos.x - 0.01, top - 0.03, headPos.z - 0.02);
    parts.beret.rotation.x = -0.28;
    pin(head, parts.beret);
    parts.helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0x4f5e34));
    parts.helmet.position.set(headPos.x, top - 0.13, headPos.z);
    pin(head, parts.helmet);
    parts.cap = new THREE.Group();
    this.box(0.26, 0.08, 0.26, this.mat(0x3b4a2a), 0, 0, 0, parts.cap);
    this.box(0.14, 0.025, 0.22, this.mat(0x3b4a2a), 0.17, -0.03, 0, parts.cap);
    parts.cap.position.set(headPos.x, top - 0.05, headPos.z);
    pin(head, parts.cap);
    if (look.female && !own) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), hair);
      bun.position.set(headPos.x - 0.13, top - 0.13, headPos.z);
      pin(head, bun);
    }
    const h = look.head || 'none';
    parts.beret.visible = false;
    parts.helmet.visible = h === 'helmet';
    parts.cap.visible = false;

    if (look.rank && !own) {
      const blue = this.mat(0x1f4fa8, { roughness: 0.6 });
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666, roughness: 0.4 });
      for (const side of [-1, 1]) {
        const ep = new THREE.Group();
        ep.position.set(headPos.x - 0.02, 1.44, side * 0.17);
        this.box(0.14, 0.03, 0.15, blue, 0, 0, 0, ep);
        if (look.rank === 'leaf') {
          const leaf = this.box(0.08, 0.014, 0.08, white, 0, 0.022, 0, ep);
          leaf.rotation.y = Math.PI / 4;
        } else {
          if (look.rank === 1) this.box(0.12, 0.014, 0.03, white, 0, 0.022, side * 0.045, ep);
          else for (let i = 0; i < look.rank; i++) this.box(0.12, 0.014, 0.03, white, 0, 0.022, (i - (look.rank - 1) / 2) * 0.06, ep);
        }
        pin(chest, ep);
      }
    }
    this.carryProps(parts, root, 0.38, 1.1);
    pin(chest, parts.carry);

    if (!this.blobMat) this.blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), this.blobMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.03;
    root.add(blob);
    if (name) {
      parts.tag = this.label(name, { size: 0.55 });
      parts.tag.position.set(0, 2.15, 0);
      root.add(parts.tag);
    }
    this.extras(parts, look, root);
    // Start each soldier at a different point of the cycles.
    if (parts.acts) for (const k in parts.acts) parts.acts[k].time = Math.random() * parts.acts[k].getClip().duration;
    if (parts.mixer) parts.mixer.update(0);
    this.root.add(root);
    return parts;
  },

  // Everything a soldier can carry, hidden until needed: canister, catering crate, water,
  // outside food, a fire extinguisher, a squeegee.
  carryProps(parts, root, x, y) {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    root.add(g);
    const k = {};
    k.canister = this.box(0.5, 0.42, 0.62, this.mat(0x56653a), 0, 0, 0, g);
    k.crate = new THREE.Group();
    this.box(0.46, 0.3, 0.6, this.mat(0x2f6fb3), 0, 0, 0, k.crate);
    this.box(0.42, 0.05, 0.56, this.mat(0xe0b060), 0, 0.17, 0, k.crate);
    k.water = new THREE.Group();
    const bottle = this.mat(0x9fd3f0, { transparent: true, opacity: 0.75, roughness: 0.2 });
    for (let i = 0; i < 6; i++) this.cyl(0.07, 0.07, 0.34, bottle, -0.08 + (i % 2) * 0.16, 0, -0.16 + Math.floor(i / 2) * 0.16, k.water, 8);
    k.food = new THREE.Group();
    this.box(0.42, 0.06, 0.42, this.mat(0xd9b77a), 0, 0, 0, k.food);
    this.box(0.2, 0.01, 0.2, this.mat(0xc0392b), 0, 0.035, 0, k.food);
    k.ext = this.cyl(0.1, 0.1, 0.5, this.mat(0xd8261f, { metalness: 0.3 }), 0, 0, 0, g, 10);
    k.squeegee = new THREE.Group();
    const stick = this.cyl(0.02, 0.02, 1.5, this.mat(0x8a6a44), 0.45, -0.45, 0, k.squeegee, 6);
    stick.rotation.z = -1.0;
    this.box(0.08, 0.06, 0.5, this.mat(0x222222), 1.05, -0.98, 0, k.squeegee);
    for (const n of ['crate', 'water', 'food', 'squeegee']) g.add(k[n]);
    for (const n in k) k[n].visible = false;
    parts.carry = g;
    parts.carry.visible = false;
    parts.carryKinds = k;
  },
  setCarry(m, kind) {
    m.carry.visible = !!kind;
    const want = kind === true ? 'canister' : kind;
    for (const n in m.carryKinds) m.carryKinds[n].visible = n === want;
  },
  // Per-character extras: size (Arad is 1.5x everyone) and Nevo's loyal flies.
  extras(parts, look, root) {
    if (look.scale && look.scale !== 1) root.scale.setScalar(look.scale);
    if (look.flies) {
      parts.flies = new THREE.Group();
      parts.flies.position.y = 1.75;
      const fm = new THREE.MeshBasicMaterial({ color: 0x111111 });
      for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), fm);
        f.userData.a = i * 1.05;
        parts.flies.add(f);
      }
      root.add(parts.flies);
    }
  },
  setBubble(m, text, h = 2.8) {
    if (text === m.bubbleText) return;
    if (m.bubbleSprite) m.root.remove(m.bubbleSprite);
    m.bubbleSprite = null;
    if (text) {
      m.bubbleSprite = this.label(text, { bg: 'rgba(255,255,255,.95)', fg: '#1d1d10', size: 0.62 });
      m.bubbleSprite.position.set(0, h, 0);
      m.root.add(m.bubbleSprite);
    }
    m.bubbleText = text;
  },

  // Sitting on a bench: on top of the idle clip, thighs swing forward to horizontal, shins
  // back down, and the body drops so the hips rest on the seat.
  sitPose(m, ent) {
    if (!m.sitB) {
      const B = {};
      m.root.traverse(o => { if (o.isBone && /^(Hips|LeftUpLeg|RightUpLeg|LeftLeg|RightLeg)$/.test(o.name) && !B[o.name]) B[o.name] = o; });
      m.sitB = B;
    }
    const B = m.sitB;
    if (!B.LeftUpLeg || !B.LeftLeg) return;
    const V = THREE.Vector3, Q = THREE.Quaternion;
    m.root.updateMatrixWorld(true);
    if (!m.thighLen) m.thighLen = B.LeftUpLeg.getWorldPosition(new V()).distanceTo(B.LeftLeg.getWorldPosition(new V()));
    const axis = new V(-Math.sin(ent.angle), 0, Math.cos(ent.angle));
    const turn = (bone, a) => {
      const qd = new Q().setFromAxisAngle(axis, a);
      const bw = bone.getWorldQuaternion(new Q()), pw = bone.parent.getWorldQuaternion(new Q());
      bone.quaternion.copy(pw.invert().multiply(qd.multiply(bw)));
      bone.updateMatrixWorld(true);
    };
    for (const [up, low] of [['LeftUpLeg', 'LeftLeg'], ['RightUpLeg', 'RightLeg']]) {
      if (!B[up] || !B[low]) continue;
      turn(B[up], 1.45);
      turn(B[low], -1.45);
    }
    // Hips on the bench: about a hand above the seat.
    const hipsY = B.Hips ? B.Hips.getWorldPosition(new V()).y : m.thighLen;
    m.root.position.y -= hipsY - ((this.seatH || 0.45) + 0.08);
  },

  animateSoldier(m, ent, moving, dt) {
    if (m.flies) {
      const t = performance.now() / 1000;
      m.flies.children.forEach((f, i) => {
        const a = f.userData.a + t * (3 + i * 0.4);
        f.position.set(Math.cos(a) * (0.3 + 0.08 * Math.sin(t * 5 + i)), 0.15 + Math.sin(t * 7 + i) * 0.12, Math.sin(a) * 0.3);
      });
    }
    if (m.rigged) {
      m.root.position.set(ent.x * S3, 0, ent.y * S3);
      let d = -ent.angle - m.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      // While the game waits on a scene (dt 0) whoever was just placed turns at once.
      m.root.rotation.y += d * (dt ? Math.min(1, dt * 12) : 1);
      if (m.mixer) {
        // Weights glide between idle, walk and run; the stride follows the real speed. The
        // mixer poses every bone from the clips each frame, so nothing builds up while paused.
        const speed = ent.speed !== undefined ? ent.speed : ent.running ? 165 : moving ? 90 : 0;
        const running = moving && ent.running && m.acts.run;
        const dancing = ent.dancing && m.acts.dance && !moving;
        const want = dancing ? { dance: 1 } : { idle: moving ? 0 : 1, walk: moving && !running ? 1 : 0, run: running ? 1 : 0 };
        const k = Math.min(1, dt * 8);
        for (const n in m.acts) {
          m.w[n] += ((want[n] || 0) - m.w[n]) * k;
          m.acts[n].setEffectiveWeight(m.acts.idle || n !== 'walk' ? m.w[n] : 1);
        }
        m.acts.walk.timeScale = moving ? Math.max(0.5, speed / 90) * 1.15 : (m.acts.idle ? 1 : 0);
        if (m.acts.run) m.acts.run.timeScale = Math.max(0.6, speed / 165) * 1.0;
        if (!m.acts.idle && !moving) m.acts.walk.time = 0;
        m.mixer.update(dt);
        if (ent.sit || ent.sitting) this.sitPose(m, ent);
      }
      return;
    }
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
    if (this.addModel(g, 'pickup', { rotY: Math.PI / 2, length: 5.3, tint: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45) })) {
      this.root.add(g);
      return g;
    }
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
    if (item.catering && this.addModel(g, 'truck', { rotY: Math.PI, length: 9 })) {
      // Rafael's refrigerated catering box on the back, with the logo on both sides.
      const logo = this.canvasTex(256, 96, (c) => {
        c.fillStyle = '#f7f7f4'; c.fillRect(0, 0, 256, 96);
        c.fillStyle = '#c0392b'; c.fillRect(0, 70, 256, 14);
        c.fillStyle = '#1d4fa8'; c.font = '800 38px Rubik, Arial'; c.textAlign = 'center'; c.direction = 'rtl';
        c.fillText('רפאל קייטרינג', 128, 50);
      });
      const side = new THREE.MeshStandardMaterial({ map: logo, roughness: 0.6 });
      const white = this.mat(0xf4f4f0, { roughness: 0.6 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.7, 2.6), [white, white, white, white, side, side]);
      box.position.set(-1.6, 2.75, 0);
      box.castShadow = true;
      g.add(box);
      const lb = this.label(item.name, { size: 0.8 });
      lb.position.set(0, 4.6, 0);
      g.add(lb);
      this.root.add(g);
      return g;
    }
    // The site arrives the civilian way: a crane truck towing a flatbed trailer with the
    // container (or the launcher) on it. Front is +x. The Higgsfield model when it loaded,
    // otherwise built from boxes.
    const model = this.addModel(g, 'cranetruck', { rotY: Math.PI, length: 14 });
    if (!model) {
      const paint = this.mat(0xc23a2b, { metalness: 0.35, roughness: 0.45 });
      const steel = this.mat(0x2a2d30, { metalness: 0.5, roughness: 0.6 });
      const yellow = this.mat(0xe8b21e, { metalness: 0.3, roughness: 0.5 });
      const glass = this.mat(0x9fc3d8, { metalness: 0.6, roughness: 0.15 });
      const tyre = this.mat(0x161616);
      const wheel = (x, z, r = 0.52) => { const w = this.cyl(r, r, 0.42, tyre, x, r, z, g, 14); w.rotation.x = Math.PI / 2; };
      // Tractor: chassis, cab with windscreen, bumper, lights, fuel tanks.
      this.box(6.2, 0.45, 2.1, steel, 2.9, 0.95, 0, g);
      this.box(2.1, 2.5, 2.5, paint, 4.95, 2.4, 0, g);
      this.box(2.0, 0.5, 2.55, this.mat(0x8e2a1f), 4.95, 3.75, 0, g);
      this.box(0.06, 1.0, 2.2, glass, 6.02, 2.95, 0, g);
      for (const z of [-1.26, 1.26]) this.box(1.0, 0.8, 0.05, glass, 5.25, 2.95, z, g);
      this.box(0.25, 0.5, 2.5, steel, 6.05, 1.15, 0, g);
      const lamp = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff0b0, emissiveIntensity: 0.9 });
      for (const z of [-0.95, 0.95]) this.box(0.08, 0.22, 0.4, lamp, 6.1, 1.5, z, g);
      for (const z of [-1.1, 1.1]) { const t = this.cyl(0.32, 0.32, 1.1, this.mat(0xb8bcc0, { metalness: 0.8, roughness: 0.3 }), 3.3, 1.0, z, g, 12); t.rotation.z = Math.PI / 2; }
      wheel(4.9, -1.1); wheel(4.9, 1.1); wheel(1.6, -1.1); wheel(1.6, 1.1); wheel(0.4, -1.1); wheel(0.4, 1.1);
      // Loader crane behind the cab: turret, column and the folded knuckle boom.
      this.cyl(0.55, 0.65, 0.5, yellow, 3.4, 1.4, 0, g, 14);
      this.box(0.5, 1.8, 0.5, yellow, 3.4, 2.4, 0, g);
      const arm = this.box(0.35, 0.35, 3.6, yellow, 3.4, 3.35, 0, g);
      arm.rotation.x = 0.08;
      this.box(0.25, 0.25, 3.2, this.mat(0xd9a316), 3.4, 2.95, 0, g);
      // Fifth wheel and the trailer: deck, side rails, rear axles, a red-white tail.
      this.box(1.2, 0.2, 1.2, steel, 1.3, 1.25, 0, g);
      this.box(9.4, 0.32, 2.5, this.mat(0x3a3d40, { metalness: 0.4 }), -3.0, 1.35, 0, g);
      for (const z of [-1.22, 1.22]) this.box(9.4, 0.14, 0.08, yellow, -3.0, 1.55, z, g);
      for (const x of [-5.9, -4.8, -3.7]) { wheel(x, -1.1, 0.5); wheel(x, 1.1, 0.5); }
      for (let i = 0; i < 4; i++) this.box(0.05, 0.3, 0.6, this.mat(i % 2 ? 0xffffff : 0xd8261f), -7.72, 1.1, -0.9 + i * 0.6, g);
    }
    // The load on the trailer, lifted off by the crane (or raised in place, for the launcher).
    const load = new THREE.Group();
    if (model) load.position.set(-2.6, 1.55, 0); else load.position.set(-3.0, 1.51, 0);
    if (item.kind === 'launcher') {
      this.box(5.5, 1.5, 2.2, this.mat(0x4b5a2a), 0, 0.75, 0, load);
      for (const x of [-1.9, 0, 1.9]) this.box(0.12, 1.6, 2.3, this.mat(0x3c4822), x, 0.75, 0, load);
    } else {
      this.box(6.0, 2.4, 2.35, this.mat(item.color || 0x5d6b3e, { roughness: 0.7 }), 0, 1.2, 0, load);
      for (let i = -5; i <= 5; i++) this.box(0.05, 2.2, 2.4, this.mat(0x000000, { transparent: true, opacity: 0.12 }), i * 0.5, 1.2, 0, load);
    }
    g.add(load);
    g.userData.load = load;
    g.userData.craneX = model ? 3.1 : 3.4;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const lb = this.label(item.name, { size: 0.8 });
    lb.position.set(-1.4, 5.0, 0);
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
  greenPuff(px, py, size = 1) {
    this.puff(new THREE.Vector3(px * S3 - 0.3, 0.7 * size, py * S3), 0x8fbf3a, 0.5 * size);
  },
  puff(at, color = 0xdddddd, size = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
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
    if (this.tutCrate) this.tutCrate.userData.ring.scale.setScalar(1 + Math.sin(performance.now() / 220) * 0.14);
    if (this.camFlash && this.camFlash.visible) {
      this.camFlashT -= dt;
      const k = Math.max(0, this.camFlashT / 0.18);
      this.camFlash.material.opacity = k;
      this.camFlash.scale.setScalar(0.6 + (1 - k) * 1.4);
      this.camFlashL.intensity = k * 3;
      if (k <= 0) this.camFlash.visible = false;
    }
  },
  // Brown wooden pergola over a picnic table with a bench on each long side (the seats are
  // in World.seats): the Higgsfield model of the real one, or simple boxes until it loads.
  pergola(g, w, d) {
    // The model's table runs along x with the benches on either side, like the seats; scaled
    // so the bench is at sitting height (about half a metre).
    if (this.addModel(g, 'pergola', { size: [w, 2.0, d] })) { this.seatH = 0.56; return; }
    this.seatH = 0.45;
    const wood = this.mat(0x7a4a26, { roughness: 0.9 }), dark = this.mat(0x5e3519, { roughness: 0.9 });
    const hx = w / 2 - 0.08, hz = d / 2 - 0.08, ph = 2.15;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.box(0.12, ph, 0.12, wood, sx * hx, ph / 2, sz * hz, g);
      const br = this.box(0.06, 0.5, 0.06, wood, sx * hx, ph - 0.25, sz * (hz - 0.2), g);
      br.rotation.x = sz * 0.75;
    }
    for (const sz of [-1, 1]) this.box(w, 0.12, 0.1, dark, 0, ph, sz * hz, g);
    for (const sx of [-1, 1]) this.box(0.1, 0.12, d, dark, sx * hx, ph, 0, g);
    // The gable roof: two sloping planes of slats, ridge along x.
    const slope = 0.5, half = d / 2 + 0.25, len = half / Math.cos(slope);
    for (const sz of [-1, 1]) {
      const roof = new THREE.Group();
      roof.position.set(0, ph + 0.06 + Math.tan(slope) * half / 2, sz * half / 2);
      roof.rotation.x = sz * slope;
      for (let i = 0; i < 9; i++) this.box(w + 0.3, 0.04, len / 9 - 0.02, i % 2 ? wood : dark, 0, 0, -len / 2 + (i + 0.5) * len / 9, roof);
      g.add(roof);
    }
    this.box(w + 0.3, 0.1, 0.12, dark, 0, ph + 0.06 + Math.tan(slope) * half, 0, g);
    // Table and benches.
    const tw = w - 0.55;
    this.box(tw, 0.06, 0.75, wood, 0, 0.74, 0, g);
    for (const sx of [-1, 1]) { const l = this.box(0.06, 0.78, 0.06, dark, sx * (tw / 2 - 0.25), 0.38, 0, g); l.scale.z = 9; }
    for (const sz of [-1, 1]) {
      this.box(tw, 0.05, 0.3, wood, 0, 0.45, sz * 0.8, g);
      for (const sx of [-1, 1]) this.box(0.06, 0.45, 0.06, dark, sx * (tw / 2 - 0.15), 0.22, sz * 0.8, g);
    }
  },
  // A white corrugated container with barred windows and the battery's emblem painted on the
  // side (face: +1 = the side toward +z / south, -1 = north). The emblem is the real one,
  // from the encrypted scene art; without the key it's just the battery's name in paint.
  idoBox(g, w, d, face) {
    const h = 2.6;
    const wall = this.canvasTex(256, 64, (c) => {
      c.fillStyle = '#e9e6dc'; c.fillRect(0, 0, 256, 64);
      for (let x = 0; x < 256; x += 8) { c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(x, 0, 3, 64); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 4, 0, 2, 64); }
      c.fillStyle = 'rgba(120,80,40,.18)'; c.fillRect(0, 60, 256, 4);
    });
    wall.wrapS = THREE.RepeatWrapping;
    wall.repeat.set(w / 2.5, 1);
    const body = this.box(w, h, d, this.mat(0xffffff, { map: wall, roughness: 0.7 }), 0, h / 2 + 0.1, 0, g);
    body.castShadow = true;
    this.box(w + 0.12, 0.08, d + 0.25, this.mat(0x8f8a7c, { metalness: 0.3 }), 0, h + 0.16, 0, g);
    this.box(w + 0.05, 0.12, d + 0.05, this.mat(0x6f6d66), 0, 0.06, 0, g);
    // The painted side comes from the photo, windows and all (2.56:1, the wall's full height).
    const fz = face * (d / 2 + 0.01);
    const ph = h - 0.25;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(ph * 2.56, ph), new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
    plane.position.set(0, 0.1 + h / 2, fz + face * 0.012);
    if (face < 0) plane.rotation.y = Math.PI;
    g.add(plane);
    this.idoDecals = (this.idoDecals || []).filter(m => m.parent && m.parent.parent);
    this.idoDecals.push(plane);
    this.paintIdo(plane);
  },
  // The emblem when the scene art is in; else the name, hand-painted style.
  paintIdo(plane) {
    const url = Assets.scene('ido_logo');
    if (url && this.idoTex) { plane.material.map = this.idoTex; plane.material.needsUpdate = true; return; }
    if (url && !this.idoLoading) {
      this.idoLoading = true;
      const img = new Image();
      img.onload = () => {
        // Feather the photo's edges into the white wall.
        this.idoTex = this.canvasTex(1024, 400, (c, W, H) => {
          c.drawImage(img, 0, 0, W, H);
          c.globalCompositeOperation = 'destination-in';
          const gx = c.createLinearGradient(0, 0, W, 0);
          gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.06, '#000'); gx.addColorStop(0.94, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = gx; c.fillRect(0, 0, W, H);
          const gy = c.createLinearGradient(0, 0, 0, H);
          gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.08, '#000'); gy.addColorStop(0.92, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = gy; c.fillRect(0, 0, W, H);
        });
        for (const m of this.idoDecals || []) { m.material.map = this.idoTex; m.material.needsUpdate = true; }
      };
      img.src = url;
    }
    if (!plane.material.map) {
      if (!this.idoText) {
        this.idoText = this.canvasTex(1024, 400, (c, W, H) => {
          // Two barred windows and the battery's name.
          for (const x of [40, 770]) {
            c.fillStyle = '#d8d6cf'; c.fillRect(x - 6, 14, 226, 196);
            c.fillStyle = '#8d8a80'; c.fillRect(x, 20, 214, 184);
            c.strokeStyle = '#f2f0ea'; c.lineWidth = 6;
            for (let k = 0; k <= 4; k++) { c.beginPath(); c.moveTo(x + k * 53, 20); c.lineTo(x + k * 53, 204); c.stroke(); }
            c.beginPath(); c.moveTo(x, 112); c.lineTo(x + 214, 112); c.stroke();
          }
          c.fillStyle = '#4a4e57'; c.font = '900 150px Rubik, Arial'; c.textAlign = 'center'; c.direction = 'rtl';
          c.fillText('אידו אגדה', W / 2, H * 0.9);
        });
      }
      plane.material.map = this.idoText;
      plane.material.needsUpdate = true;
    }
  },
  idoLogoReady() { for (const m of this.idoDecals || []) this.paintIdo(m); },
  // The tutorial's practice crate: an olive ammo box with a bobbing glow ring.
  tutorialCrate(at) {
    if (this.tutCrate) { this.root.remove(this.tutCrate); this.tutCrate = null; }
    if (!at) return;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), this.mat(0x4b5a2a));
    box.position.y = 0.25;
    box.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.54), this.mat(0x3a4520));
    lid.position.y = 0.52;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.52), this.mat(0xf2c14e, { emissive: 0x6b4a0c }));
    band.position.y = 0.32;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 32), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(box, lid, band, ring);
    g.position.set(at.x * S3, 0, at.y * S3);
    g.userData.ring = ring;
    this.tutCrate = g;
    this.root.add(g);
  },
  // A camera's flash going off (a curious civilian photographing the site).
  cameraFlash(x, y) {
    if (!this.camFlash) {
      this.camFlash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: false }));
      this.camFlashL = new THREE.PointLight(0xf4f8ff, 0, 9, 2);
      this.scene.add(this.camFlash, this.camFlashL);
    }
    this.camFlash.position.set(x * S3, 1.45, y * S3 - 0.35);
    this.camFlashL.position.copy(this.camFlash.position);
    this.camFlash.visible = true;
    this.camFlashT = 0.18;
    Sound.click();
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
      else if (o.kind === 'radar' && r.dish) r.dish.rotation.y = now / 900;
      else if (o.kind === 'launcher') {
        this.drawAmmo(r);
        r.empty.visible = o.needsReload;
        if (o.needsReload) r.empty.material.opacity = 0.75 + Math.sin(now / 200) * 0.25;
      } else if (o.kind === 'club') {
        // The club's string lights twinkle and the sign breathes.
        r.bulbs.forEach((m, i) => m.color.setHSL(((i * 0.2 + now / 4000) % 1), 1, 0.45 + 0.2 * Math.sin(now / 180 + i * 2)));
        if (!r.signBase) r.signBase = r.sign.scale.clone();
        r.sign.scale.copy(r.signBase).multiplyScalar(1 + Math.sin(now / 400) * 0.03);
      } else if (o.kind === 'flag') {
        const pos = r.flag.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const bx = r.flagBase[i * 3];
          pos.array[i * 3 + 2] = Math.sin(now / 260 + bx * 3) * 0.12 * (bx + 0.85);
        }
        pos.needsUpdate = true;
      } else if (o.kind === 'console') r.screens.material.emissiveIntensity = 0.6 + Math.sin(now / 300) * 0.2;
      else if (o.kind === 'junk') r.g.visible = !o.gone;
      else if (o.kind === 'stove') {
        const left = Math.ceil(Events.cookLeft());
        const text = left ? `⏳ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
        if (text !== r.cdText) {
          if (r.cd) r.g.remove(r.cd);
          r.cd = text ? this.label(text, { bg: 'rgba(40,20,10,.85)', fg: '#ffcf5a', size: 0.6 }) : null;
          if (r.cd) { r.cd.position.set(0, 1.9, 0); r.g.add(r.cd); }
          r.cdText = text;
        }
      }
      else if (o.kind === 'snackcab') r.cabDoor.rotation.y = THREE.MathUtils.lerp(r.cabDoor.rotation.y, Boss.active || G.state.achievements.includes('boss') ? -1.4 : 0, Math.min(1, dt * 4));
    }
    this.gateArm.rotation.z = World.gateOpen * Math.PI / 2.2;

    // People.
    const pr = G.profile;
    // Playing as a cast member: their model. Otherwise the game's own soldier for boys or girls.
    const own = `player_${pr.gender === 'f' ? 'f' : 'm'}`;
    const want = ((Multi.on || (G.state && G.state.role)) && pr.as) || (Assets.people[own] ? own : null);
    if (this.player && (this.player.who !== want || (want && !this.player.own && Assets.people[want]))) { this.root.remove(this.player.root); this.player = null; }
    if (!this.player) {
      this.player = this.makeSoldier({ id: want, skin: pr.skin, hair: pr.hair, female: pr.gender === 'f', head: 'beret', uniform: 0x5b6b3c });
    }
    const pm = this.player;
    pm.beret.visible = false;
    pm.helmet.visible = !!G.alert;
    this.setCarry(pm, P.carry);
    this.setBubble(pm, P.bubble ? P.bubble.text : null);
    this.animateSoldier(pm, P, P.moving, dt);
    // In a boss fight: blinking while covered after a respawn, flat on the grass when down.
    if (Boss.active) {
      pm.root.visible = !(Boss.inv > 0.5 && Math.floor(now / 100) % 2);
      if (Boss.dead > 0 || (Boss.victory && Boss.deaths >= 3)) { pm.root.rotation.z = THREE.MathUtils.lerp(pm.root.rotation.z, Math.PI / 2, Math.min(1, dt * 8)); pm.root.position.y = 0.25; }
      else pm.root.rotation.z = 0;
    } else if (pm.root.rotation.z) pm.root.rotation.z = 0;

    const alive = new Set(G.npcs);
    for (const [n, m] of this.models) if (!alive.has(n)) { this.root.remove(m.root); this.models.delete(n); }
    for (const n of G.npcs) {
      let m = this.models.get(n);
      if (!m) { m = this.makeSoldier(n.look, n.short); this.models.set(n, m); m.last = { x: n.x, y: n.y }; }
      const moving = Math.hypot(n.x - m.last.x, n.y - m.last.y) > 0.01;
      m.last = { x: n.x, y: n.y };
      // Speech bubble over the head.
      this.setBubble(m, n.bubble ? n.bubble.text : null);
      if (G.alert && n.sheltering) { m.helmet.visible = true; m.beret.visible = m.cap.visible = false; }
      else { m.helmet.visible = n.look.head === 'helmet'; m.beret.visible = false; m.cap.visible = false; }
      this.animateSoldier(m, n, moving, dt);
      // Film mode: no name tags over the actors.
      const tag = m.tag || (m.parts && m.parts.tag);
      if (tag) tag.visible = !this.shot;
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

    this.updateRemotes(dt, now);
    this.updateEvents(dt, now);
    this.updateBoss(dt, now);
    this.updateDeployCtl(dt, now);

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
    this.updateMeals();
    this.updateCamera(dt);
  },

  // Deployment: the camera rides with the truck, the launch box swings up, and the crane
  // lowers its swinging load onto the marked pad.
  updateDeployCtl(dt, now) {
    const c = World.id === 'field' ? Story.ctl : null;
    const tr = Story.deployTruck;
    const hud = $('#ctl-hud');
    if (!c || !tr) {
      if (this.ctlFocus) { this.ctlFocus = null; this.dist = this.savedDist || this.dist; this.pitch = this.savedPitch || this.pitch; }
      if (this.crane) { this.root.remove(this.crane.group); this.props = this.props.filter(p => p !== this.crane.rec); this.root.remove(this.crane.rec.g); this.crane = null; }
      if (this.raiseBox) { this.raiseBox.parent && this.raiseBox.parent.remove(this.raiseBox); this.raiseBox = null; }
      hud.classList.add('hidden');
      return;
    }
    if (!this.ctlFocus) { this.savedDist = this.dist; this.savedPitch = this.pitch; }
    hud.classList.remove('hidden');
    const it = tr.item;
    if (c.mode === 'drive') {
      // Look past the load: high behind the trailer, aimed a little ahead of the cab.
      this.ctlFocus = { x: tr.x + Math.cos(tr.angle) * 4 / S3, y: tr.y + Math.sin(tr.angle) * 4 / S3 };
      // Swing in behind the truck.
      const want = Math.atan2(-Math.cos(tr.angle), -Math.sin(tr.angle));
      const d = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
      this.yaw += d * Math.min(1, dt * 2.5);
      this.dist += (19 - this.dist) * Math.min(1, dt * 3);
      this.pitch += (0.62 - this.pitch) * Math.min(1, dt * 3);
      hud.innerHTML = `<div class="t">🚛 ${it.name} — לנהוג עד הסימון הצהוב</div><div class="keys">${G.touch ? 'ג\'ויסטיק: למעלה נסיעה, למטה רוורס, הצדדים הגה' : '↑ נסיעה · ↓ רוורס/בלם · ← → הגה'} · לעצור ליד הסימון</div>`;
    } else if (c.mode === 'raise') {
      this.ctlFocus = { x: tr.x, y: tr.y };
      this.dist += (13 - this.dist) * Math.min(1, dt * 3);
      this.pitch += (0.3 - this.pitch) * Math.min(1, dt * 3);
      if (tr.mesh && !this.raiseBox) {
        if (tr.mesh.userData.load) tr.mesh.userData.load.visible = false;
        const pivot = new THREE.Group();
        pivot.position.set(-0.3, 1.55, 0);
        const box = new THREE.Group();
        this.box(5.4, 1.5, 2.3, this.mat(0x4b5a2a), -2.7, 0.75, 0, box);
        for (const x of [-0.8, -2.7, -4.6]) this.box(0.12, 1.6, 2.4, this.mat(0x3c4822), x, 0.75, 0, box);
        pivot.add(box);
        tr.mesh.add(pivot);
        this.raiseBox = pivot;
      }
      if (this.raiseBox) this.raiseBox.rotation.z = -c.angle * Math.PI / 180;
      const pct = (v) => (v / Story.RAISE.max * 100).toFixed(1);
      hud.innerHTML = `<div class="t">🚀 להזקיף את המשגר ל־${Story.RAISE.target} מעלות — עכשיו ${Math.round(c.angle)}</div>
        <div class="gauge"><div class="zone" style="left:${pct(Story.RAISE.lo)}%;width:${pct(Story.RAISE.hi - Story.RAISE.lo)}%"></div><div class="mark" style="left:${pct(Story.RAISE.target)}%">${Story.RAISE.target}°</div><div class="needle" style="left:${pct(c.angle)}%"></div></div>
        <div class="keys">${G.touch ? 'ג\'ויסטיק למעלה/למטה' : '↑ להרים · ↓ להוריד'} · להחזיק בירוק${c.holdT > 0 ? ' — ' + '■'.repeat(Math.ceil(c.holdT / 1.3 * 5)) : ''}</div>`;
    } else if (c.mode === 'crane') {
      this.ctlFocus = { x: c.cx, y: c.cy };
      this.dist += (15 - this.dist) * Math.min(1, dt * 3);
      this.pitch += (1.0 - this.pitch) * Math.min(1, dt * 3);
      if (!this.crane) {
        const o = World.containerObject(it);
        const rec = this.addProp(o);
        const group = new THREE.Group();
        // The truck's own loader crane: the column stands where the folded one is, the
        // boom reaches out over the load.
        if (tr.mesh && tr.mesh.userData.load) tr.mesh.userData.load.visible = false;
        this.box(0.5, 2.6, 0.5, this.mat(0xe8b21e, { metalness: 0.3 }), 0, 2.8, 0, group);
        const boom = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.4), this.mat(0xe8b21e, { metalness: 0.3 }));
        group.add(boom);
        const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 }));
        cable.frustumCulled = false;
        group.add(cable);
        const foot = new THREE.Mesh(new THREE.PlaneGeometry(o.w * S3, o.h * S3), new THREE.MeshBasicMaterial({ color: 0xe63b2e, transparent: true, opacity: 0.35, depthWrite: false }));
        foot.rotation.x = -Math.PI / 2;
        this.root.add(group, foot);
        const cx = (tr.mesh && tr.mesh.userData.craneX) || 0;
        group.position.set((tr.x + Math.cos(tr.angle) * cx / S3) * S3, 0, (tr.y + Math.sin(tr.angle) * cx / S3) * S3);
        this.crane = { rec, group, boom, cable, foot, o };
      }
      const cr = this.crane;
      const lx = c.cx * S3, lz = c.cy * S3, top = cr.rec.g.children.length ? 2.6 : 2.6;
      // The load hangs with its bottom at height c.h; its group origin is the bottom.
      cr.rec.g.position.set(lx, c.h, lz);
      const mtop = new THREE.Vector3(cr.group.position.x, 4.1, cr.group.position.z);
      const hook = new THREE.Vector3(c.hx * S3, Math.max(c.h + top + 1.2, 5.2), c.hy * S3);
      // Boom from the mast top to above the hook.
      const mid = mtop.clone().add(hook).multiplyScalar(0.5);
      cr.boom.position.copy(mid.sub(cr.group.position));
      cr.boom.scale.x = Math.max(0.1, mtop.distanceTo(hook));
      cr.boom.lookAt(hook);
      cr.boom.rotateY(Math.PI / 2);
      const pts = cr.cable.geometry.attributes.position;
      pts.setXYZ(0, hook.x - cr.group.position.x, hook.y, hook.z - cr.group.position.z);
      pts.setXYZ(1, lx - cr.group.position.x, c.h + top, lz - cr.group.position.z);
      pts.needsUpdate = true;
      cr.foot.position.set(lx, 0.06, lz);
      cr.foot.material.color.set(c.aligned ? 0x6cc24a : 0xe63b2e);
      hud.innerHTML = `<div class="t">🏗️ ${it.name} — גובה ${c.h.toFixed(1)} מ' ${c.aligned ? '· ✔ על הסימון' : '· לכוון לסימון הצהוב'}</div>
        <div class="keys">${G.touch ? 'ג\'ויסטיק — להזיז · E (להחזיק) — להוריד · "ריצה" — להרים' : 'חצים — להזיז · רווח/E (להחזיק) — להוריד · Shift — להרים'} · להוריד לאט כשהוא לא מתנדנד</div>`;
    }
  },

  // Other players in the room, drawn as soldiers with their name.
  updateRemotes(dt, now) {
    this.remotes = this.remotes || new Map();
    const list = Multi.on ? Multi.here() : [];
    const alive = new Set(list.map(p => p.peer));
    for (const [k, m] of this.remotes) if (!alive.has(k) || m.site !== World.id || m.root.parent !== this.root) { if (m.root.parent) m.root.parent.remove(m.root); this.remotes.delete(k); }
    for (const p of list) {
      let m = this.remotes.get(p.peer);
      if (!m) {
        const person = Cast.get(p.who) || {};
        const look = { id: p.who, skin: person.skin || DATA.skinTones[(p.who.length * 7) % 4], hair: person.hair || DATA.hairColors[(p.who.length * 3) % 3], head: person.head || 'none', female: !!person.female, rank: person.rank, scale: person.scale || 1, flies: !!person.flies };
        m = this.makeSoldier(look, '🌐 ' + (p.name || person.short || ''));
        m.site = World.id;
        this.remotes.set(p.peer, m);
      }
      this.setCarry(m, p.c);
      if (p.say && p.say.at !== m.sayAt) { m.sayAt = p.say.at; m.sayUntil = Math.abs(Date.now() - p.say.at) < 15000 ? now + 5000 : 0; m.sayText = p.say.text; }
      this.setBubble(m, m.sayUntil > now ? m.sayText : null);
      this.animateSoldier(m, { x: p.dx, y: p.dy, angle: p.a, running: p.r }, p.m, dt);
    }
  },

  // Event props: Rafael's truck, the food to hide from the battery commander, Amsalem's
  // extinguishers and the puddle.
  updateEvents(dt, now) {
    const r = World.id === 'netivot' ? Events.rafael : null;
    if (r) {
      if (!r.mesh) r.mesh = this.makeTruck({ name: '🚚 רפאל קייטרינג', color: 0xf2f2f2, catering: true });
      r.mesh.position.set(r.x * S3, 0, r.y * S3);
      r.mesh.rotation.y = -r.angle;
    }
    if (this.lastRafael && this.lastRafael !== r && this.lastRafael.mesh) { this.root.remove(this.lastRafael.mesh); this.lastRafael.mesh = null; }
    this.lastRafael = r;

    this.foodMeshes = this.foodMeshes || new Map();
    const b = World.id === 'netivot' && Events.baum;
    this.syncSmall(b ? b.food.filter(f => !f.hidden && !f.carried) : [], this.foodMeshes, (f) => {
      const g = new THREE.Group();
      const colors = { pizza: 0xd9b77a, shawarma: 0xe8d6a0, sushi: 0x222222, burger: 0x8a5a2a, chips: 0xd8392b, malawach: 0xe0b060 };
      this.box(0.45, f.id === 'pizza' ? 0.07 : 0.22, 0.4, this.mat(colors[f.id] || 0xcccccc), 0, 0.12, 0, g);
      const em = this.label(f.icon, { bg: 'rgba(0,0,0,0)', size: 0.9 });
      em.position.set(0, 0.75, 0);
      g.add(em);
      g.userData.bob = em;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 24), new THREE.MeshBasicMaterial({ color: 0xe63b2e, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      g.add(ring);
      g.userData.ring = ring;
      return g;
    }, now);

    this.choreMeshes = this.choreMeshes || new Map();
    const c = World.id === 'hq' && Events.chores;
    const items = c ? [...c.ext.filter(e => e !== c.carrying), c.puddle] : [];
    for (const [k, m] of this.choreMeshes) if (!items.includes(k)) { this.root.remove(m); this.choreMeshes.delete(k); }
    for (const it of items) {
      let m = this.choreMeshes.get(it);
      if (!m) {
        if (it === c.puddle) {
          m = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshStandardMaterial({ color: 0x5fa8d8, transparent: true, opacity: 0.65, roughness: 0.05, metalness: 0.3, depthWrite: false }));
          m.rotation.x = -Math.PI / 2;
          m.scale.set(1.3, 1, 1);
        } else {
          m = new THREE.Group();
          this.cyl(0.11, 0.11, 0.55, this.mat(0xd8261f, { metalness: 0.3 }), 0, 0.28, 0, m, 10);
          this.cyl(0.03, 0.03, 0.12, this.mat(0x222222), 0, 0.6, 0, m, 6);
        }
        this.root.add(m);
        this.choreMeshes.set(it, m);
      }
      m.position.set(it.x * S3, it === c.puddle ? 0.035 : 0, it.y * S3);
    }
  },

  // Hawk wings on a character's back (the root faces +x): layered feathers, darker at the
  // shoulder and pale at the tips. Returns the two wing pivots, which flap around x.
  addWings(root) {
    const dark = this.mat(0x4a2e16), mid = this.mat(0x8a5a2e), tip = this.mat(0xe3c79a);
    // One feather: a flat blade that narrows to a rounded tip.
    const feather = (len, w, m1, m2, parent) => {
      const f = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.5, len * 0.72, 6), m1);
      shaft.scale.x = 0.18; shaft.position.y = len * 0.36; f.add(shaft);
      const end = new THREE.Mesh(new THREE.SphereGeometry(w * 0.34, 8, 6), m2);
      end.scale.set(0.18, len * 0.5 / (w * 0.34), 1); end.position.y = len * 0.8; f.add(end);
      parent.add(f);
      return f;
    };
    return [-1, 1].map(side => {
      const pivot = new THREE.Group();
      pivot.position.set(-0.14, 1.3, side * 0.08);
      // Long flight feathers fanned from the wrist, upward and back; shorter coverts on top.
      for (let i = 0; i < 9; i++) {
        const a = -0.15 + i * 0.13, len = 0.75 + Math.sin(i / 8 * Math.PI) * 0.45;
        const f = feather(len, 0.2, i < 3 ? dark : mid, tip, pivot);
        f.rotation.set(side * (Math.PI / 2 - a), 0, -0.25 - i * 0.03);
        f.position.x = -0.01 * i;
      }
      for (let i = 0; i < 5; i++) {
        const f = feather(0.42, 0.22, dark, mid, pivot);
        f.rotation.set(side * (Math.PI / 2 - 0.5 - i * 0.18), 0, -0.2);
        f.position.x = 0.02;
      }
      root.add(pivot);
      return pivot;
    });
  },

  // The cheeseburger monster, his cheeseburgers, and the healthy food flying back.
  updateBoss(dt, now) {
    this.bossBits = this.bossBits || { burgers: new Map(), shots: new Map(), picks: new Map() };
    if (!Boss.active || World.id !== Boss.cfg.map) {
      if (this.bossMesh) { this.root.remove(this.bossMesh); this.bossMesh = null; this.bossGiant = null; this.bossWings = null; }
      for (const k of ['burgers', 'shots', 'picks']) { for (const m of this.bossBits[k].values()) this.root.remove(m); this.bossBits[k].clear(); }
      if (this.screechRing) { this.root.remove(this.screechRing); this.screechRing = null; }
      return;
    }
    if (this.bossMesh && this.bossMesh.userData.kind !== Boss.kind) { this.root.remove(this.bossMesh); this.bossMesh = null; this.bossGiant = null; }
    if (!this.bossMesh) this.bossWings = null;
    if (!this.bossMesh || this.bossMesh.parent !== this.root) {
      const g = new THREE.Group();
      g.userData.kind = Boss.kind;
      if (Boss.kind !== 'burger') {
        // A person boss: their own character, giant.
        const person = Cast.get(Boss.cfg.npc) || {};
        const look = { id: Boss.cfg.npc, skin: person.skin || '#d9a77c', hair: person.hair || '#2b1d12', head: person.head || 'beret', female: !!person.female, rank: person.rank };
        const m = this.makeSoldier(look, null);
        if (m.root.parent) m.root.parent.remove(m.root);
        m.root.scale.setScalar(2.6);
        this.bossGiant = m;
        g.add(m.root);
        if (Boss.kind === 'bar') this.bossWings = this.addWings(m.root);
      } else if (!this.addModel(g, 'burger', { height: 7 })) {
        const bun = this.mat(0xd99a3e), patty = this.mat(0x5a3218), cheese = this.mat(0xf2c12e), lettuce = this.mat(0x5fae3a);
        const top = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), bun);
        top.position.y = 4.2; g.add(top);
        this.cyl(2.7, 2.7, 0.3, lettuce, 0, 4.0, 0, g, 20);
        this.cyl(2.75, 2.75, 0.25, cheese, 0, 3.75, 0, g, 4);
        this.cyl(2.6, 2.6, 0.9, patty, 0, 3.2, 0, g, 20);
        this.cyl(2.5, 2.4, 1.0, bun, 0, 2.3, 0, g, 20);
        for (const sx of [-1, 1]) this.cyl(0.35, 0.4, 1.8, bun, sx * 1.2, 0.9, 0, g, 8);
        for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); e.position.set(sx * 0.9, 5.5, 2.0); g.add(e); }
      }
      this.bossMesh = g;
      this.root.add(g);
    }
    const bm = this.bossMesh;
    const P = G.player;
    if (this.bossGiant) {
      // The giant dances (the battery commander) or marches (the sergeant major) in place, facing the player.
      const gm = this.bossGiant;
      bm.position.set(Boss.x * S3, 0, Boss.y * S3);
      // Having won, every one of them breaks into the victory dance.
      const dance = Boss.kind === 'baum' || !!Boss.victory;
      this.animateSoldier(gm, { x: 0, y: 0, angle: Math.atan2(P.y - Boss.y, P.x - Boss.x), dancing: dance, speed: 60 }, !dance, dt);
      gm.root.position.set(0, 0, 0);
      const k = 1 + Boss.flash * 0.08;
      bm.scale.set(k, 1 / k, k);
      if (this.bossWings) {
        // She hovers over the lawn, flapping; harder while she screeches.
        const t = now / 1000, fast = Boss.screech ? 16 : 7;
        bm.position.y = 0.9 + Math.sin(t * 2.2) * 0.35;
        this.bossWings.forEach((w, i) => { w.rotation.x = (i ? 1 : -1) * (0.15 + Math.sin(t * fast) * 0.55); });
      }
    } else {
      bm.position.set(Boss.x * S3, Math.abs(Math.sin(now / 260)) * 0.25, Boss.y * S3);
      bm.rotation.y = Math.atan2(P.x - Boss.x, P.y - Boss.y);
      // The cheeseburger's victory dance: hops, spins and wiggles.
      if (Boss.victory) {
        const t = now / 1000;
        bm.position.y = Math.abs(Math.sin(t * 6)) * 1.4;
        bm.rotation.y = t * 4;
        bm.rotation.z = Math.sin(t * 9) * 0.18;
      } else bm.rotation.z = 0;
      const k = 1 + Boss.flash * 0.12;
      bm.scale.set(k, 1 / k, k);
    }
    if (Boss.bubble !== this.bossBubbleRef) {
      if (this.bossBubble) bm.remove(this.bossBubble);
      this.bossBubble = Boss.bubble ? this.label(Boss.bubble.text, { bg: 'rgba(255,240,200,.97)', fg: '#5a1a0a', size: 1.6 }) : null;
      if (this.bossBubble) { this.bossBubble.position.set(0, 8.4, 0); bm.add(this.bossBubble); }
      this.bossBubbleRef = Boss.bubble;
    }
    const sync = (list, map, make, place) => {
      const alive = new Set(list);
      for (const [o, m] of map) if (!alive.has(o)) { this.root.remove(m); map.delete(o); }
      for (const o of list) {
        let m = map.get(o);
        if (!m) { m = make(o); this.root.add(m); map.set(o, m); }
        place(o, m);
      }
    };
    const smallBurger = () => {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0xd99a3e));
      top.position.y = 0.06; g.add(top);
      this.cyl(0.33, 0.33, 0.06, this.mat(0xf2c12e), 0, 0.03, 0, g, 4);
      this.cyl(0.31, 0.31, 0.12, this.mat(0x5a3218), 0, -0.05, 0, g, 12);
      this.cyl(0.3, 0.28, 0.1, this.mat(0xd99a3e), 0, -0.15, 0, g, 12);
      return g;
    };
    // What the bosses throw: cheeseburgers, gefilte fish, uniform reports, sentences.
    const projectile = (b) => {
      if (Boss.kind === 'burger') return smallBurger();
      if (b && b.text) return this.label(b.text, { bg: 'rgba(255,255,255,.95)', fg: '#c2185b', size: 1.1 });
      const g = new THREE.Group();
      if (Boss.kind === 'baum') {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), this.mat(0xd8c7a0));
        f.scale.set(1.3, 0.55, 0.8); g.add(f);
        const c = this.cyl(0.08, 0.08, 0.03, this.mat(0xe8781f), 0, 0.17, 0, g, 10); void c;
      } else {
        this.box(0.42, 0.02, 0.56, this.mat(0xf6f3ea), 0, 0, 0, g);
        this.box(0.3, 0.022, 0.05, this.mat(0xc0392b), 0, 0.001, -0.18, g);
      }
      return g;
    };
    const poster = (img, w, h, frame) => {
      const g = new THREE.Group();
      const im = Assets.images[img];
      let mat = this.mat(0xffffff);
      if (im) { const t = new THREE.Texture(im); t.needsUpdate = true; t.encoding = THREE.sRGBEncoding; mat = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }); }
      if (frame) this.box(w + 0.06, h + 0.06, 0.03, this.mat(frame, { metalness: 0.5 }), 0, 0, -0.02, g);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      g.add(pl);
      return g;
    };
    const healthy = (kind) => {
      const g = new THREE.Group();
      if (kind.id === 'karaoke') {
        this.box(0.36, 0.26, 0.22, this.mat(0x222222), 0, 0, 0, g);
        this.cyl(0.05, 0.035, 0.26, this.mat(0xd63384, { metalness: 0.4 }), 0.12, 0.22, 0, g, 8);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), this.mat(0xcfcfcf, { metalness: 0.7 })); b.position.set(0.12, 0.38, 0); g.add(b);
        for (const x of [-0.09, 0.05]) { const sp = this.cyl(0.06, 0.06, 0.02, this.mat(0x555555), x - 0.03, 0, 0.115, g, 12); sp.rotation.x = Math.PI / 2; }
      } else if (kind.id === 'seeds') {
        this.box(0.26, 0.32, 0.1, this.mat(0xf2c12e), 0, 0, 0, g);
        for (let i = 0; i < 6; i++) { const sd = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), this.mat(0x111111)); sd.scale.set(1, 0.5, 1.6); sd.position.set(-0.08 + (i % 3) * 0.08, 0.2, -0.03 + Math.floor(i / 3) * 0.06); g.add(sd); }
      } else if (kind.id === 'bibi') g.add(poster('bibi', 0.46, 0.46, null));
      else if (kind.id === 'babasali') g.add(poster('babasali', 0.34, 0.45, 0xc9a227));
      else if (kind.id === 'boots') { for (const x of [-0.1, 0.1]) { this.box(0.14, 0.24, 0.16, this.mat(0x0c0c0c, { metalness: 0.6, roughness: 0.15 }), x, 0, 0, g); this.box(0.14, 0.08, 0.3, this.mat(0x0c0c0c, { metalness: 0.6, roughness: 0.15 }), x, -0.08, 0.08, g); } }
      else if (kind.id === 'beret') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 8), this.mat(kind.color)); b.scale.set(1, 0.3, 1); g.add(b); }
      else if (kind.id === 'razor') { this.box(0.06, 0.32, 0.04, this.mat(0x2f6fb5), 0, 0, 0, g); this.box(0.2, 0.05, 0.05, this.mat(0xd8d8d8, { metalness: 0.8 }), 0, 0.17, 0, g); }
      else if (kind.id === 'belt') { this.box(0.34, 0.02, 0.22, this.mat(0xe9edf2), 0, 0, 0, g); this.box(0.1, 0.022, 0.13, this.mat(0x8a6a4a), -0.09, 0.002, 0, g); this.box(0.14, 0.022, 0.03, this.mat(0x2f6fb3), 0.07, 0.002, 0.05, g); this.box(0.14, 0.022, 0.02, this.mat(0x777777), 0.07, 0.002, -0.02, g); }
      else if (kind.id === 'ritalin') { this.cyl(0.1, 0.1, 0.24, this.mat(kind.color, { roughness: 0.3 }), 0, 0, 0, g, 12); this.cyl(0.11, 0.11, 0.07, this.mat(0xf6f3ea), 0, 0.15, 0, g, 12); this.box(0.205, 0.1, 0.01, this.mat(0xf6f3ea), 0, 0, 0.1, g); }
      else if (kind.id === 'sedative') { this.cyl(0.07, 0.07, 0.22, this.mat(kind.color, { roughness: 0.2 }), 0, 0, 0, g, 10); this.cyl(0.04, 0.04, 0.06, this.mat(0x999999, { metalness: 0.6 }), 0, 0.14, 0, g, 8); const mo = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), this.mat(0xf2c12e)); mo.position.set(0, 0.02, 0.07); g.add(mo); }
      else if (kind.id === 'muzzle') {
        for (const [r, y] of [[0.16, 0], [0.12, 0.12]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 16), this.mat(kind.color)); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const s = this.box(0.03, 0.14, 0.03, this.mat(kind.color), Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14, g); void s; }
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 16, Math.PI), this.mat(0x3a2414)); strap.position.y = 0.05; g.add(strap);
      }
      else if (kind.id === 'broccoli') {
        this.cyl(0.06, 0.08, 0.3, this.mat(0x9fcf6a), 0, -0.1, 0, g, 6);
        for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), this.mat(kind.color)); b.position.set(Math.cos(i * 1.3) * 0.12, 0.1 + (i % 2) * 0.06, Math.sin(i * 1.3) * 0.12); g.add(b); }
      } else if (kind.id === 'ricecake') this.cyl(0.24, 0.24, 0.08, this.mat(kind.color), 0, 0, 0, g, 16);
      else if (kind.id === 'carrot') { const c = this.cyl(0.07, 0.01, 0.42, this.mat(kind.color), 0, 0, 0, g, 8); c.rotation.z = 1.2; this.cyl(0.05, 0.02, 0.12, this.mat(0x4f9e33), -0.22, 0.08, 0, g, 6).rotation.z = 1.2; void c; }
      else if (kind.id === 'apple') { const a = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), this.mat(kind.color)); g.add(a); this.cyl(0.015, 0.015, 0.1, this.mat(0x5a3a1a), 0, 0.18, 0, g, 5); }
      else if (kind.id === 'cucumber') { const c = this.cyl(0.07, 0.07, 0.4, this.mat(kind.color), 0, 0, 0, g, 10); c.rotation.z = Math.PI / 2; }
      else { this.box(0.4, 0.07, 0.14, this.mat(0x2f2f2f), 0, 0, 0, g); this.box(0.2, 0.072, 0.142, this.mat(0xf2c14e), 0, 0, 0, g); }
      return g;
    };
    sync([...Boss.burgers, ...(Boss.remoteBurgers || [])], this.bossBits.burgers, projectile, (b, m) => {
      const t = Math.min(1, b.t / b.dur);
      if (b.text) {
        // A straight shot, mouth to target.
        m.visible = b.t >= 0;
        const k = Math.max(0, t);
        m.position.set((b.x0 + (b.x1 - b.x0) * k) * S3, 4.6 - k * 3.4, (b.y0 + (b.y1 - b.y0) * k) * S3);
        return;
      }
      m.position.set((b.x0 + (b.x1 - b.x0) * t) * S3, 4 + Math.sin(t * Math.PI) * 5 - t * 3.6, (b.y0 + (b.y1 - b.y0) * t) * S3);
      m.rotation.x = t * 9;
    });
    sync([...Boss.shots, ...(Boss.remoteShots || [])], this.bossBits.shots, (s) => healthy(s.kind), (s, m) => {
      m.position.set(s.x * S3, 1.4 + Math.sin(Math.min(1, s.t * 2) * Math.PI) * 1.5, s.y * S3);
      m.rotation.set(s.t * 12, s.t * 7, 0);
    });
    // The hawk's cry: a red warning circle while she rears up, then the shock spreading out.
    const ring = Boss.screech || Boss.slam;
    if (ring && !this.screechRing) {
      const g = new THREE.Group();
      const warn = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      const wave = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xfff1c1, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      for (const r of [warn, wave]) { r.rotation.x = -Math.PI / 2; g.add(r); }
      g.userData = { warn, wave };
      this.screechRing = g;
      this.root.add(g);
    }
    if (this.screechRing) {
      const s = ring;
      if (!s) { this.root.remove(this.screechRing); this.screechRing = null; }
      else {
        const R = (s.R || 6 * TS) * S3, { warn, wave } = this.screechRing.userData;
        this.screechRing.position.set(s.x * S3, 0.08, s.y * S3);
        warn.scale.setScalar(R);
        warn.material.opacity = 0.35 + Math.abs(Math.sin(now / 90)) * 0.45;
        wave.visible = s.r > 0;
        wave.scale.setScalar(Math.max(0.01, s.r * S3));
        wave.material.opacity = 0.9 - Math.min(1, s.r / (s.R || 6 * TS)) * 0.6;
        // A slam's warning circle fills in as it's about to land.
        if (s.slam) { warn.material.color.setHex(0xff2a1a); warn.scale.setScalar(R * (0.3 + 0.7 * Math.min(1, s.t / s.warn))); }
      }
    }
    sync(Boss.pickups, this.bossBits.picks, (p) => {
      const g = healthy(p.kind);
      g.scale.setScalar(1.6);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: 0x6cc24a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.45;
      g.add(ring);
      return g;
    }, (p, m) => { m.position.set(p.x * S3, 0.5 + Math.sin(now / 300 + p.x) * 0.1, p.y * S3); m.rotation.y = now / 700; });
  },

  syncSmall(list, map, make, now) {
    const alive = new Set(list);
    for (const [k, m] of map) if (!alive.has(k)) { this.root.remove(m); map.delete(k); }
    for (const it of list) {
      let m = map.get(it);
      if (!m) { m = make(it); m.position.set(it.x * S3, 0, it.y * S3); this.root.add(m); map.set(it, m); }
      if (m.userData.ring) m.userData.ring.material.opacity = 0.35 + Math.sin(now / 250) * 0.25;
      if (m.userData.bob) m.userData.bob.position.y = 0.75 + Math.sin(now / 300) * 0.08;
    }
  },

  // Orbit camera behind the player. When a wall sits between the player and
  // the camera, the camera tilts up to look over it instead of clipping.
  // A film-style shot that holds the camera instead of following the player: it eases in
  // from wherever the camera was, then drifts slowly from `from` to `end` (a dolly) while
  // looking at `at`. Positions are in metres: { from: [x, y, z], end?, at: [x, y, z], dur }.
  setShot(s) {
    if (!s) { this.shot = null; this.camX = undefined; return; }
    const c = this.camera;
    this.shot = { ...s, t0: performance.now(), p0: c.position.clone(), l0: this.shotLook ? this.shotLook.clone() : null };
  },
  shotCamera() {
    const s = this.shot, c = this.camera;
    const now = performance.now();
    const k = Math.min(1, (now - s.t0) / (s.dur || 6000));
    const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const pos = V(s.from).lerp(V(s.end || s.from), k);
    const at = V(s.at).lerp(V(s.atEnd || s.at), k);
    // The cut itself: a quick ease from the last framing (0.45 s), like a whip pan.
    const e = Math.min(1, (now - s.t0) / 450);
    const ee = e * e * (3 - 2 * e);
    if (s.cut === false && ee < 1) {
      pos.lerpVectors(s.p0, pos, ee);
      if (s.l0) at.lerpVectors(s.l0, at, ee);
    }
    c.position.copy(pos);
    c.lookAt(at);
    this.shotLook = at;
  },

  // On a gate shift, inside the booth: first person, looking out of the window at the road.
  fps() {
    const gs = Story.gateShift;
    return !!(gs && World.id === 'netivot' && !Boss.active && Math.hypot(G.player.x - SPOTS.booth.x, G.player.y - SPOTS.booth.y) < TS * 0.75);
  },
  fpsCamera() {
    const P = G.player, c = this.camera;
    if (!this.inFps) {
      this.inFps = true;
      this.fpsSaved = this.pitch;
      // Face the gate and the road.
      const dx = SPOTS.gate.x - P.x, dz = (SPOTS.gate.y + 2.2 * TS) - P.y;
      this.yaw = Math.atan2(dx, dz) + Math.PI;
      this.pitch = 0.42;
    }
    const look = -(this.pitch - 0.42) * 0.9;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    c.position.set(P.x * S3, 1.66, P.y * S3);
    c.lookAt(P.x * S3 + fx * 4, 1.66 + Math.tan(look) * 4, P.y * S3 + fz * 4);
  },

  updateCamera(dt) {
    if (this.shot) { this.shotCamera(); return; }
    const fps = this.fps();
    if (this.player) this.player.root.visible = !fps;
    if (fps) { this.fpsCamera(); return; }
    if (this.inFps) { this.inFps = false; this.camX = undefined; this.pitch = this.fpsSaved || 0.3; }
    // At the deployment controls the camera follows the truck or the crane load instead.
    const P = this.ctlFocus || G.player;
    // Look slightly past the right shoulder, like most third-person games.
    const B = this.basis();
    // The camera trails the soldier slightly, which reads smoother than a rigid follow.
    const fx = P.x * S3, fz = P.y * S3;
    if (this.camX === undefined || Math.hypot(fx - this.camX, fz - this.camZ) > 6) { this.camX = fx; this.camZ = fz; }
    const k = Math.min(1, dt * 12);
    this.camX += (fx - this.camX) * k;
    this.camZ += (fz - this.camZ) * k;
    const tx = this.camX + B.rx * 0.45, tz = this.camZ + B.rz * 0.45, ty = 1.55;
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
    this.effPitch += (need - this.effPitch) * (dt ? Math.min(1, dt * 6) : 1);
    const p = this.effPitch;
    const c = this.camera;
    c.position.set(tx + sx * Math.cos(p) * this.dist, ty + Math.sin(p) * this.dist, tz + sz * Math.cos(p) * this.dist);
    if (G.shake > 0 && Settings.v.shake) c.position.add(new THREE.Vector3((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake));
    c.lookAt(tx, ty + 0.2, tz);
  },

  render() { this.renderer.render(this.scene, this.camera); },

  // Unit vectors on the ground for camera-relative movement (in world px axes).
  basis() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    return { fx, fz, rx: -fz, rz: fx };
  },
};
