// The race's maps (js/race.js): four places, three tracks each (easy, medium, hard: more
// bends, narrower roads, faster rivals). Each is a real 3D place, not a picture around you:
// a height field with hills and terraces, a road laid on it with its own grade, a sky dome
// with a sun and clouds, and far mountains under the fog.
//  - הנגב (near Netivot): the original painted circuit, and dunes for the harder tracks.
//  - חצור: an air base: a runway, hangars, parked jets, a tower, golden fields.
//  - הר איתן (the Jerusalem hills): pine forest, limestone, terraces, a mountain road with rails.
//  - מצפה נפתוח (the Jerusalem hills): over the valley of Lifta, with the city and the
//    Chords Bridge across it.
// Ground textures, the pine and the coin are from Higgsfield (assets/tex, assets/models).
const RACE_LEVELS = [
  { name: 'קל', stars: '★', skill: [0.8, 0.87], smooth: 6 },
  { name: 'בינוני', stars: '★★', skill: [0.87, 0.93], smooth: 5 },
  { name: 'קשה', stars: '★★★', skill: [0.93, 0.99], smooth: 5 },
];
const RACE_MAPS = [
  {
    id: 'negev', name: 'הנגב', emoji: '🏜️', desc: 'דיונות, דקלים וחול בכל מקום. המסלול המקורי ליד נתיבות.',
    ground: 'assets/tex/sand.jpg', tint: 0xe9cf98, amp: 6, scale: 110, terrace: 0, wall: 14,
    sky: { top: 0x3f86d8, horizon: 0xe8dcc0, fog: 0xe6d8bc }, sun: [0.5, 0.55, -0.3],
    levels: [
      { pts: null, half: 8, painted: true },
      { pts: [[0, -95], [70, -98], [118, -66], [104, -26], [128, 16], [112, 70], [62, 64], [30, 100], [-34, 104], [-52, 62], [-100, 48], [-122, -4], [-90, -40], [-58, -88]], half: 7 },
      { pts: [[0, -104], [80, -104], [124, -76], [70, -56], [60, -30], [116, -14], [128, 48], [78, 48], [52, 96], [0, 70], [-30, 108], [-96, 96], [-74, 46], [-126, 16], [-112, -50], [-50, -44], [-52, -96]], half: 6.2 },
    ],
  },
  {
    id: 'hatzor', name: 'חצור', emoji: '✈️', desc: 'בסיס חיל האוויר: מסלול המראה, האנגרים ומטוסים חונים. ישורות ארוכות.',
    ground: 'assets/tex/field.jpg', tint: 0xffffff, amp: 0.8, scale: 160, terrace: 0, wall: 14,
    sky: { top: 0x4a8fe0, horizon: 0xdfe8ee, fog: 0xd8e2e8 }, sun: [-0.4, 0.62, -0.35],
    levels: [
      { pts: [[-150, -45], [150, -45], [178, -20], [178, 20], [150, 45], [-150, 45], [-178, 20], [-178, -20]], half: 9 },
      { pts: [[-160, -70], [140, -70], [176, -40], [150, -6], [60, -6], [36, 24], [70, 52], [160, 52], [180, 84], [150, 110], [-150, 110], [-182, 80], [-150, 46], [-120, 20], [-170, -10], [-186, -46]], half: 7.8 },
      { pts: [[-160, -80], [150, -80], [182, -52], [160, -22], [90, -30], [70, 0], [110, 24], [170, 30], [186, 70], [150, 108], [60, 100], [30, 70], [-20, 100], [-130, 110], [-180, 74], [-140, 40], [-180, 0], [-130, -24], [-186, -50]], half: 6.6 },
    ],
  },
  {
    id: 'eitan', name: 'הר איתן', emoji: '🌲', desc: 'בהרי ירושלים: יער אורנים, טרסות של אבן וכביש הררי עם מעקות.',
    ground: 'assets/tex/jlm_ground.jpg', tint: 0xffffff, amp: 34, scale: 240, terrace: 3, wall: 1.6, rails: true, forest: 1,
    sky: { top: 0x3a7fd0, horizon: 0xdde6ea, fog: 0xc8d4da }, sun: [0.45, 0.5, 0.4],
    levels: [
      { pts: [[0, -110], [70, -104], [110, -70], [96, -24], [118, 22], [96, 74], [40, 96], [-10, 72], [-56, 104], [-104, 70], [-96, 18], [-120, -30], [-90, -86], [-48, -104]], half: 7.5 },
      { pts: [[0, -112], [64, -110], [110, -80], [96, -34], [124, 10], [106, 64], [52, 72], [32, 108], [-34, 110], [-60, 66], [-108, 50], [-120, -6], [-84, -36], [-104, -84], [-54, -104]], half: 6.6 },
      { pts: [[0, -118], [66, -116], [118, -92], [70, -70], [118, -44], [126, 8], [78, 14], [110, 60], [70, 106], [20, 74], [-14, 112], [-70, 104], [-50, 64], [-110, 58], [-126, 0], [-76, -14], [-118, -56], [-90, -100], [-44, -90]], half: 5.8 },
    ],
  },
  {
    id: 'naftoah', name: 'מצפה נפתוח', emoji: '🏙️', desc: 'בהרי ירושלים, מעל ליפתא: הבתים העתיקים למטה, העיר וגשר המיתרים באופק.',
    ground: 'assets/tex/jlm_ground.jpg', tint: 0xf4e8dc, amp: 30, scale: 220, terrace: 3, wall: 1.6, rails: true, forest: 0.6, city: true, tiltX: 0.1,
    sky: { top: 0x5a86c8, horizon: 0xf2ddc4, fog: 0xe4d2c0 }, sun: [0.75, 0.32, 0.1],
    levels: [
      { pts: [[-20, -100], [60, -108], [110, -70], [96, -10], [118, 50], [70, 98], [0, 90], [-60, 108], [-110, 60], [-96, 0], [-118, -58], [-80, -96]], half: 7.5 },
      { pts: [[-20, -108], [54, -112], [104, -84], [70, -48], [110, -14], [120, 42], [78, 70], [86, 108], [20, 104], [-20, 70], [-70, 104], [-114, 72], [-92, 24], [-124, -24], [-104, -80], [-64, -104]], half: 6.6 },
      { pts: [[-24, -116], [50, -118], [106, -96], [62, -72], [108, -50], [124, -4], [80, 6], [124, 46], [110, 96], [56, 108], [40, 64], [0, 100], [-50, 110], [-38, 64], [-100, 80], [-126, 30], [-80, 6], [-124, -30], [-112, -90], [-70, -112]], half: 5.8 },
    ],
  },
];

// Smooth noise for the hills: the same everywhere for one map, so every phone sees one place.
const RNoise = {
  hash(x, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  },
  value(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = this.hash(xi, zi), b = this.hash(xi + 1, zi), c = this.hash(xi, zi + 1), d = this.hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  },
  fbm(x, z, oct = 5) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * (this.value(x * f + i * 17.3, z * f - i * 9.1) * 2 - 1); f *= 2.03; a *= 0.5; }
    return s;
  },
};
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const RaceWorld = {
  // ---------- the track ----------
  // Points → a closed Catmull-Rom curve; the new tracks are then resampled every 1.5 m and
  // smoothed, so no bend is sharper than a car can take (the hard ones still have hairpins).
  samplesFor(pts, painted, smooth) {
    const n = pts.length, raw = [];
    const cr = (a, b, c, d, t) => [0, 1].map(i => 0.5 * (2 * b[i] + (-a[i] + c[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t * t + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * t * t * t));
    for (let i = 0; i < n; i++) for (let k = 0; k < 40; k++) raw.push(cr(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n], k / 40));
    let out = raw;
    if (!painted) {
      const L = raw.map((p, i) => Math.hypot(raw[(i + 1) % raw.length][0] - p[0], raw[(i + 1) % raw.length][1] - p[1]));
      const total = L.reduce((a, b) => a + b, 0), N = Math.round(total / 1.5);
      out = []; let k = 0, pos = 0;
      for (let m = 0; m < N; m++) {
        const t = m * total / N;
        while (pos + L[k] < t) { pos += L[k]; k++; }
        const u = L[k] ? (t - pos) / L[k] : 0, a = raw[k], b = raw[(k + 1) % raw.length];
        out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
      }
      for (let pass = 0; pass < 3; pass++) {
        const M = out.length, w = smooth;
        out = out.map((_, i) => { let x = 0, z = 0; for (let j = -w; j <= w; j++) { const q = out[(i + j + M) % M]; x += q[0]; z += q[1]; } return [x / (2 * w + 1), z / (2 * w + 1)]; });
      }
    }
    return out.map(([x, z], i) => { const [nx, nz] = out[(i + 1) % out.length]; return { x, z, a: Math.atan2(nz - z, nx - x), y: 0 }; });
  },

  // The hills: noise, terraces on the slopes, and for Naftoah the slope down to the valley.
  heightFn(map) {
    if (!map.amp) return () => 0;
    return (x, z) => {
      let h = map.amp * RNoise.fbm(x / map.scale, z / map.scale, 5);
      if (map.id === 'negev') h += 2.5 * Math.sin(x / 23 + Math.sin(z / 41) * 2) * RNoise.value(x / 60, z / 60);
      if (map.tiltX) h -= x * map.tiltX;
      if (map.terrace) { const q = Math.floor(h / map.terrace) * map.terrace, f = (h - q) / map.terrace; h = q + map.terrace * smoothstep(0.55, 1, f) * 0.85 + (h - q) * 0.15; }
      return h;
    };
  },

  build(mapId, lv) {
    const map = RACE_MAPS.find(m => m.id === mapId) || RACE_MAPS[0], L = map.levels[lv] || map.levels[0];
    const painted = !!L.painted;
    const S = this.samplesFor(L.pts || RACE_POINTS, painted, RACE_LEVELS[lv].smooth);
    const H = painted ? () => 0 : this.heightFn(map);
    const W = { map, lv, half: L.half, wall: L.half + (painted ? 14 : map.wall), samples: S, painted, H, rails: !!map.rails };
    // The road's own grade: the hills under it, smoothed so it climbs and dips like a road.
    let ys = S.map(s => H(s.x, s.z));
    for (let pass = 0; pass < 8; pass++) { const M = ys.length; ys = ys.map((_, i) => { let t = 0; for (let j = -14; j <= 14; j++) t += ys[(i + j + M) % M]; return t / 29; }); }
    S.forEach((s, i) => { s.y = ys[i]; });
    // A grid of the road's samples, to find the road near any point quickly.
    const cell = 12, grid = new Map();
    S.forEach((s, i) => { const k = Math.floor(s.x / cell) + ',' + Math.floor(s.z / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
    W.nearRoad = (x, z) => {
      const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
      let best = -1, bd = Infinity;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const l = grid.get((cx + dx) + ',' + (cz + dz));
        if (l) for (const i of l) { const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
      }
      return { i: best, d: best < 0 ? 999 : Math.sqrt(bd) };
    };
    // The ground: the hills, pressed flat to the road's height near it.
    W.ground = (x, z) => {
      const n = W.nearRoad(x, z), h = H(x, z);
      if (n.i < 0) return h;
      return S[n.i].y + (h - S[n.i].y) * smoothstep(L.half + 1.5, L.half + 22, n.d) - (n.d < L.half + 1.5 ? 0.04 : 0);
    };
    // The road's height at a car: between the two nearest samples.
    W.roadY = (i, x, z) => {
      const N = S.length, a = S[i], b = S[(i + 1) % N];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1, t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / (len * len)));
      return a.y + (b.y - a.y) * t;
    };
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const s of S) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    W.bounds = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, size: Math.max(x1 - x0, z1 - z0) + 30, x0, x1, z0, z1 };
    if (painted) W.bounds = { cx: RACE_MAP.cx, cz: RACE_MAP.cz, size: RACE_MAP.size };
    this.scene(W);
    return W;
  },

  // ---------- the place ----------
  tex(src, rep = 1) {
    const t = new THREE.TextureLoader().load(src);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rep !== 1) t.repeat.set(rep, rep);
    return t;
  },
  soft(color) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  },
  scene(W) {
    const map = W.map, sc = W.scene = new THREE.Scene(), S = W.samples;
    const fogC = new THREE.Color(map.sky.fog);
    sc.background = fogC.clone();
    sc.fog = new THREE.Fog(fogC, 160, W.painted ? 900 : 1500);
    W.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 4000);
    sc.add(new THREE.HemisphereLight(0xe8f2ff, map.id === 'hatzor' ? 0xb8a060 : 0x9a7a58, 0.75));
    const sunDir = new THREE.Vector3(...map.sun).normalize();
    const sun = W.sun = new THREE.DirectionalLight(0xfff0d4, 1.15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
    sun.userData.dir = sunDir;
    sc.add(sun, sun.target);
    const T = {}, time = (k, f) => { const t0 = performance.now(); f(); T[k] = Math.round(performance.now() - t0); };
    time('sky', () => this.sky(W, sunDir));
    if (W.painted) time('painted', () => this.painted(W));
    else { time('terrain', () => this.terrain(W)); time('road', () => this.road(W)); }
    time('far', () => this.far(W));
    time('start', () => { this.startLine(W); this.battery(W); });
    if (map.id === 'negev' && !W.painted) time('negev', () => this.negevDecor(W));
    if (map.id === 'hatzor') time('hatzor', () => this.hatzorDecor(W));
    if (map.forest) time('forest', () => this.forest(W));
    if (map.city) time('city', () => this.city(W));
    if (W.rails) time('rails', () => this.rails(W));
    W.timing = T;
    W.pickups = [];
  },
  // The sky: a dome that follows the camera, blue above, hazy at the horizon, a sun, clouds.
  sky(W, sunDir) {
    const c = W.map.sky;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(c.top) }, horizon: { value: new THREE.Color(c.horizon) }, sunDir: { value: sunDir }, low: { value: new THREE.Color(c.fog) } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 low; uniform vec3 sunDir; varying vec3 vDir;
        void main() { float h = vDir.y; vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.5)); col = mix(col, low, smoothstep(0.02, -0.12, h));
        float s = max(dot(vDir, normalize(sunDir)), 0.0); col += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 2.0 + pow(s, 24.0) * 0.28 + pow(s, 4.0) * 0.08);
        gl_FragColor = vec4(col, 1.0); }`,
    });
    W.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
    W.sky.renderOrder = -1;
    W.scene.add(W.sky);
    // Clouds: soft billboards high up, drifting slowly.
    const ct = this.soft('rgba(255,255,255,0.9)');
    W.clouds = [];
    const rnd = Arcade.rng(W.map.id.length * 977 + 3);
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.75 }));
        s.scale.set(140 + rnd() * 120, 60 + rnd() * 40, 1);
        s.position.set((k - 1.5) * 70 + rnd() * 30, rnd() * 20, rnd() * 30);
        g.add(s);
      }
      const a = rnd() * Math.PI * 2, r = 700 + rnd() * 1300;
      g.position.set(W.bounds.cx + Math.cos(a) * r, 280 + rnd() * 220, W.bounds.cz + Math.sin(a) * r);
      W.scene.add(g); W.clouds.push(g);
    }
  },
  // The original desert circuit: its painted map on the sand.
  painted(W) {
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: this.tex('assets/tex/sand.jpg', 50), color: 0xe9cf98, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.y = -0.06; sand.receiveShadow = true; W.scene.add(sand);
    const map = new THREE.Mesh(new THREE.PlaneGeometry(RACE_MAP.size, RACE_MAP.size), new THREE.MeshStandardMaterial({ map: this.tex('assets/race/map.jpg'), roughness: 0.95 }));
    map.material.map.wrapS = map.material.map.wrapT = THREE.ClampToEdgeWrapping;
    map.rotation.x = -Math.PI / 2; map.position.set(RACE_MAP.cx, 0, RACE_MAP.cz); map.receiveShadow = true; W.scene.add(map);
    // Tire walls on the bends, like before.
    const N = S_len(W), black = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 }), tire = new THREE.TorusGeometry(0.42, 0.2, 8, 14);
    const S = W.samples;
    for (let i = 0; i < N; i += 7) {
      let turn = S[(i + 8) % N].a - S[(i - 8 + N) % N].a;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      if (Math.abs(turn) < 0.32) continue;
      const side = turn > 0 ? -1 : 1, s = S[i], ox = -Math.sin(s.a) * side, oz = Math.cos(s.a) * side;
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(tire, black);
        t.rotation.x = Math.PI / 2;
        t.position.set(s.x + ox * (W.half + 4), 0.2 + k * 0.38, s.z + oz * (W.half + 4));
        t.castShadow = true; W.scene.add(t);
      }
    }
  },
  // The near ground: 900 m around the track, every 5 m, pressed to the road.
  terrain(W) {
    const size = 900, seg = 180, b = W.bounds;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + b.cx, z = pos.getZ(i) + b.cz;
      pos.setXYZ(i, x, W.ground(x, z), z);
      uv.setXY(i, x / 9, z / 9);
    }
    geo.computeVertexNormals();
    // Light and shade: darker in hollows and on steep sides, a little color noise.
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), slope = 1 - nrm.getY(i);
      const v = 0.82 + RNoise.value(x / 14, z / 14) * 0.22 - slope * 0.5;
      const green = W.map.forest ? RNoise.value(x / 40 + 7, z / 40) * 0.12 : 0;
      col[i * 3] = v * (1 - green); col[i * 3 + 1] = v; col[i * 3 + 2] = v * (1 - green * 1.4);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshStandardMaterial({ map: this.tex(W.map.ground), color: W.map.tint, vertexColors: true, roughness: 1 });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    W.scene.add(m);
    W.groundMat = mat;
  },
  // The far land under the fog: mountains rising toward the horizon all around.
  far(W) {
    const b = W.bounds, size = 6000, seg = 110;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv, map = W.map;
    const hillAmp = map.id === 'hatzor' ? 70 : map.id === 'negev' ? 60 : 260;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + b.cx, z = pos.getZ(i) + b.cz, r = Math.hypot(x - b.cx, z - b.cz);
      let h = W.painted ? 0 : W.H(x, z);
      h += hillAmp * smoothstep(500, 2200, r) * (0.55 + RNoise.fbm(x / 700, z / 700, 4));
      if (r < 470) h -= 6;
      pos.setXYZ(i, x, h, z);
      uv.setXY(i, x / 30, z / 30);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: this.tex(W.painted ? 'assets/tex/sand.jpg' : map.ground), color: map.tint, roughness: 1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = -0.3;
    W.scene.add(m);
  },
  // The road: asphalt with white edges and a dashed middle, gravel shoulders under it.
  roadTex() {
    if (this.roadT) return this.roadT;
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    const draw = (img) => {
      g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, 256, 512);
      if (img) { g.globalAlpha = 0.95; g.drawImage(img, 0, 0, 256, 256); g.drawImage(img, 0, 256, 256, 256); g.globalAlpha = 1; }
      g.fillStyle = 'rgba(245,245,240,.92)'; g.fillRect(10, 0, 9, 512); g.fillRect(237, 0, 9, 512);
      g.fillStyle = 'rgba(255,210,60,.9)'; g.fillRect(124, 40, 8, 200); g.fillRect(124, 296, 8, 200);
      if (this.roadT) this.roadT.needsUpdate = true;
    };
    draw(null);
    const img = new Image(); img.onload = () => draw(img); img.src = 'assets/tex/road.jpg';
    this.roadT = new THREE.CanvasTexture(c);
    this.roadT.encoding = THREE.sRGBEncoding; this.roadT.anisotropy = 8; this.roadT.wrapT = THREE.RepeatWrapping;
    return this.roadT;
  },
  ribbon(W, inner, outer, lift, mat, vScale) {
    const S = W.samples, N = S.length, pos = [], uv = [], idx = [];
    let dist = 0;
    for (let i = 0; i <= N; i++) {
      const s = S[i % N], p = S[(i - 1 + N) % N];
      if (i) dist += Math.hypot(s.x - p.x, s.z - p.z);
      const nx = -Math.sin(s.a), nz = Math.cos(s.a);
      for (const [o, u] of [[inner, 0], [outer, 1]]) {
        const x = s.x + nx * o, z = s.z + nz * o;
        pos.push(x, s.y + lift, z); uv.push(u, dist / vScale);
      }
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    W.scene.add(m);
    return m;
  },
  road(W) {
    const h = W.half;
    const shoulder = new THREE.MeshStandardMaterial({ map: this.tex('assets/tex/sand.jpg'), color: W.map.id === 'hatzor' ? 0xb0a890 : 0xb8a88c, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, side: THREE.DoubleSide });
    this.ribbon(W, -h - 1.8, h + 1.8, 0.03, shoulder, 6);
    const road = new THREE.MeshStandardMaterial({ map: this.roadTex(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
    this.ribbon(W, -h, h, 0.06, road, 12);
  },
  // Guard rails on the mountain roads: posts, a steel band, and the cars bounce off them.
  rails(W) {
    const S = W.samples, N = S.length, off = W.half + 1.3;
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const s = S[i % N], nx = -Math.sin(s.a) * side, nz = Math.cos(s.a) * side;
        pos.push(s.x + nx * off, s.y + 0.5, s.z + nz * off, s.x + nx * off, s.y + 0.82, s.z + nz * off);
        if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      W.scene.add(new THREE.Mesh(geo, steel));
      const n = Math.floor(N / 3), post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), new THREE.MeshStandardMaterial({ color: 0x8a8e92, metalness: 0.5 }), n);
      const m4 = new THREE.Matrix4();
      for (let k = 0; k < n; k++) { const s = S[k * 3]; m4.makeTranslation(s.x - Math.sin(s.a) * side * (off + 0.08), s.y + 0.45, s.z + Math.cos(s.a) * side * (off + 0.08)); post.setMatrixAt(k, m4); }
      W.scene.add(post);
    }
  },
  // The start: a checkered line across the road and a banner on two posts.
  startLine(W) {
    const s0 = W.samples[0], nx = -Math.sin(s0.a), nz = Math.cos(s0.a), sc = W.scene;
    const ck = document.createElement('canvas'); ck.width = 256; ck.height = 32;
    const cg = ck.getContext('2d');
    for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { cg.fillStyle = (x + y) % 2 ? '#111' : '#fff'; cg.fillRect(x * 8, y * 8, 8, 8); }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W.half * 2, 1.6), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(ck), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3 }));
    line.rotation.set(-Math.PI / 2, 0, -s0.a - Math.PI / 2);
    line.position.set(s0.x, s0.y + 0.08, s0.z); sc.add(line);
    const post = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    for (const k of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7, 10), post);
      p.position.set(s0.x + nx * k * (W.half + 1.2), s0.y + 3.5, s0.z + nz * k * (W.half + 1.2));
      p.castShadow = true; sc.add(p);
    }
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
    const g = c.getContext('2d');
    for (let x = 0; x < 64; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); g.fillRect(x * 16, 96 + y * 16, 16, 16); }
    g.fillStyle = '#c0392b'; g.fillRect(0, 32, 1024, 64);
    g.fillStyle = '#fff'; g.font = '900 52px Rubik, Arial'; g.textAlign = 'center'; g.direction = 'rtl';
    g.fillText(`🏁 תחרות מפקדי נסיעה · ${W.map.name} 🏁`, 512, 82);
    const bt = new THREE.CanvasTexture(c); bt.encoding = THREE.sRGBEncoding;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2 * W.half + 2.4, 2.2), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide }));
    banner.position.set(s0.x, s0.y + 6.2, s0.z);
    banner.rotation.y = -s0.a - Math.PI / 2;
    sc.add(banner);
  },
  // An Iron Dome launcher and its radar by the start, on every map: it's their race, after all.
  battery(W) {
    const S = W.samples, s = S[Math.floor(S.length * 0.04)], side = 1, off = W.half + (W.rails ? 9 : 16);
    const x = s.x - Math.sin(s.a) * side * off, z = s.z + Math.cos(s.a) * side * off;
    const L = Assets.model('launcher', { depth: 8 });
    if (L) { L.position.set(x, W.ground(x, z), z); L.rotation.y = -s.a + 0.6; W.scene.add(L); }
    const R = Assets.model('radar', { length: 5 });
    if (R) { const x2 = x + Math.cos(s.a) * 14, z2 = z + Math.sin(s.a) * 14; R.position.set(x2, W.ground(x2, z2), z2); R.rotation.y = 1.2; W.scene.add(R); }
  },
  // Scatter n things on the ground, away from the road (min..max meters from it).
  scatter(W, n, rnd, min, max, range = 420) {
    const out = [], b = W.bounds;
    for (let tries = 0; out.length < n && tries < n * 20; tries++) {
      const x = b.cx + (rnd() - 0.5) * range * 2, z = b.cz + (rnd() - 0.5) * range * 2;
      const r = W.nearRoad(x, z);
      if (r.d < min || r.d > max) continue;
      out.push({ x, z, y: W.ground(x, z) });
    }
    return out;
  },
  // A tree model as one geometry, for instancing: its mesh baked, standing on y=0, 1 m tall.
  treeGeo() {
    if (this.pine !== undefined) return this.pine;
    const src = Assets.models.race_pine;
    this.pine = null;
    if (!src) return null;
    src.updateMatrixWorld(true);
    src.traverse(o => { if (o.isMesh && !this.pine) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.computeBoundingBox(); const bb = g.boundingBox; g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); const h = bb.max.y - bb.min.y; g.scale(1 / h, 1 / h, 1 / h); this.pine = { geo: g, mat: o.material }; } });
    return this.pine;
  },
  // Pines: the Higgsfield model up close (how many depends on the device), simple cones
  // farther out, and limestone rocks.
  forest(W) {
    const rnd = Arcade.rng(W.map.id.length * 131 + W.lv), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const q0 = Settings.v.quality, near = q0 === 'low' ? 0 : q0 === 'high' ? 60 : G.touch ? 16 : 36;
    const dens = W.map.forest;
    const tree = this.treeGeo();
    const spots = this.scatter(W, Math.round((near + 520) * dens), rnd, W.half + 5, 400);
    const close = tree ? spots.filter(p => W.nearRoad(p.x, p.z).d < 45).slice(0, near) : [];
    const rest = spots.filter(p => !close.includes(p));
    if (close.length) {
      const im = new THREE.InstancedMesh(tree.geo, tree.mat, close.length);
      close.forEach((p, i) => { const h = 8 + rnd() * 7; e.set(0, rnd() * 6.28, 0); q.setFromEuler(e); m4.compose(v.set(p.x, p.y - 0.3, p.z), q, sc.set(h * (0.9 + rnd() * 0.3), h, h * (0.9 + rnd() * 0.3))); im.setMatrixAt(i, m4); });
      im.castShadow = !G.touch; im.receiveShadow = true;
      W.scene.add(im);
    }
    this.pines(W, rest, rnd);
    // Limestone rocks in the terra rossa.
    const rocks = this.scatter(W, 260, rnd, W.half + 3, 300);
    const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xb4ab9a, roughness: 0.95, flatShading: true }), rocks.length);
    rocks.forEach((p, i) => { const k = 0.3 + rnd() * 0.9; rm.setColorAt(i, new THREE.Color().setHSL(0.1, 0.12, 0.5 + rnd() * 0.25)); e.set(rnd(), rnd() * 6, rnd()); q.setFromEuler(e); m4.compose(v.set(p.x, p.y, p.z), q, sc.set(k * 1.4, k * 0.7, k)); rm.setMatrixAt(i, m4); });
    if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
    rm.castShadow = !G.touch; rm.receiveShadow = true;
    W.scene.add(rm);
  },
  // Pines as pictures on two crossed planes: cheap, and from a few meters away they read as
  // the real tree, each a little different in size and shade.
  pines(W, spots, rnd, size = 1) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    if (!this.pineBB) {
      const t = new THREE.TextureLoader().load('assets/race/pine_bb.png'); t.encoding = THREE.sRGBEncoding;
      const geo = new THREE.BufferGeometry(), P = [], U = [], I = [];
      for (let k = 0; k < 2; k++) {
        const a0 = k * Math.PI / 2, cx = Math.cos(a0) * 0.5, cz = Math.sin(a0) * 0.5, o = k * 4;
        P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(24).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      geo.setIndex(I);
      this.pineBB = { geo, mat: new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }) };
    }
    const bb = new THREE.InstancedMesh(this.pineBB.geo, this.pineBB.mat, spots.length);
    spots.forEach((p, i) => { const h = (7 + rnd() * 8) * size; e.set(0, rnd() * 6.28, 0); q.setFromEuler(e); m4.compose(v.set(p.x, p.y - 0.3, p.z), q, sc.set(h, h, h)); bb.setMatrixAt(i, m4); bb.setColorAt(i, new THREE.Color().setHSL(0.25, 0.15, 0.65 + rnd() * 0.3)); });
    if (bb.instanceColor) bb.instanceColor.needsUpdate = true;
    bb.castShadow = !G.touch;
    W.scene.add(bb);
  },
  // Naftoah: Jerusalem across the valley (light stone houses on the hills, a few towers and the
  // Chords Bridge), and the old stone houses of Lifta on the slope below the road.
  city(W) {
    const b = W.bounds, rnd = Arcade.rng(4242), stone = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.9 });
    const n = 1600, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stone, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    let k = 0;
    for (; k < n; k++) {
      const a = -0.9 + rnd() * 1.8, r = 850 + rnd() * 900;
      const x = b.cx + Math.cos(a) * r, z = b.cz + Math.sin(a) * r;
      const w = 7 + rnd() * 9, h = 6 + rnd() * 10 + (rnd() < 0.015 ? 45 : 0), y = W.H(x, z) + 140 * smoothstep(500, 2200, Math.hypot(x - b.cx, z - b.cz)) * 0.55 - 2;
      e.set(0, rnd() * 3, 0); q.setFromEuler(e);
      m4.compose(v.set(x, y + h / 2, z), q, s.set(w, h, w * (0.7 + rnd() * 0.6)));
      im.setMatrixAt(k, m4);
      im.setColorAt(k, new THREE.Color().setHSL(0.11, 0.25 + rnd() * 0.15, 0.78 + rnd() * 0.12));
    }
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    W.scene.add(im);
    // The Chords Bridge: a leaning white pylon and its cables.
    const bx = b.cx + 1150, bz = b.cz - 160, by = W.H(bx, bz) + 30;
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.4 });
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(4, 118, 4), white);
    pylon.position.set(bx, by + 55, bz); pylon.rotation.z = -0.22; W.scene.add(pylon);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 360), white);
    deck.position.set(bx + 6, by, bz); deck.rotation.y = 0.15; W.scene.add(deck);
    const top = new THREE.Vector3(bx + 12, by + 112, bz), pts = [];
    for (let i = -10; i <= 10; i++) { if (!i) continue; pts.push(top, new THREE.Vector3(bx + 6 + Math.sin(0.15) * i * 16, by + 1, bz + Math.cos(0.15) * i * 16)); }
    W.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff })));
    // Lifta: stone houses with dark arched doorways on the slope.
    const old = new THREE.MeshStandardMaterial({ color: 0xcdbb98, roughness: 1, flatShading: true }), dark = new THREE.MeshBasicMaterial({ color: 0x2a2018 });
    for (const p of this.scatter(W, 22, rnd, W.half + 14, 90).filter(p => p.x > b.cx)) {
      const g = new THREE.Group(), w = 5 + rnd() * 4, h = 3.5 + rnd() * 2.5;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), old); box.position.y = h / 2; box.castShadow = box.receiveShadow = true; g.add(box);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(w * 0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), old); dome.position.y = h; g.add(dome);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.8), dark); door.position.set(0, 0.9, w * 0.4 + 0.01); g.add(door);
      const arch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10, 0, Math.PI), dark); arch.position.set(0, 1.8, w * 0.4 + 0.01); g.add(arch);
      g.position.set(p.x, p.y - 0.3, p.z); g.rotation.y = rnd() * 6;
      W.scene.add(g);
    }
  },
  // Hatzor: the runway beside the track, hangars, parked jets, the control tower, fields.
  hatzorDecor(W) {
    const b = W.bounds, sc = W.scene, rnd = Arcade.rng(77);
    // Everything sits just off this track's own edges: the runway on one side, the hangars on the other.
    const north = b.z1 + 24, south = b.z0 - 45;
    const asphalt = new THREE.MeshStandardMaterial({ map: this.tex('assets/tex/road.jpg', 1), color: 0x8a8a8e, roughness: 0.9 });
    asphalt.map.repeat.set(4, 60);
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(50, 2200), asphalt);
    rw.rotation.set(-Math.PI / 2, 0, Math.PI / 2); rw.position.set(b.cx, 0.02, south); rw.receiveShadow = true; sc.add(rw);
    // Runway markings: the centerline dashes and the threshold stripes.
    const white = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    for (let x = -1050; x < 1050; x += 60) { const d = new THREE.Mesh(new THREE.PlaneGeometry(30, 1.2), white); d.rotation.x = -Math.PI / 2; d.position.set(b.cx + x, 0.04, south); sc.add(d); }
    for (const end of [-1, 1]) for (let k = -5; k <= 5; k++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.6), white); t.rotation.x = -Math.PI / 2; t.position.set(b.cx + end * 1060, 0.04, south + k * 3.8); sc.add(t); }
    // Hangars: arched roofs in a row, their doors toward the track.
    const roof = new THREE.MeshStandardMaterial({ color: 0xa8a492, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide });
    // A concrete apron in front of the hangars.
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(380, 90), new THREE.MeshStandardMaterial({ map: this.tex('assets/tex/road.jpg', 1), color: 0xb8b4ac, roughness: 0.95 }));
    apron.material.map.repeat.set(20, 5);
    apron.rotation.x = -Math.PI / 2; apron.position.set(b.cx - 102, 0.03, north + 25); apron.receiveShadow = true; sc.add(apron);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 40, 20, 1, true, 0, Math.PI), roof);
      shell.rotation.set(0, 0, Math.PI / 2); shell.rotation.order = 'ZYX'; shell.rotation.x = Math.PI / 2;
      shell.castShadow = shell.receiveShadow = true; g.add(shell);
      const back = new THREE.Mesh(new THREE.CircleGeometry(14, 20, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x7a806a })); back.position.z = -20; g.add(back);
      const door = new THREE.Mesh(new THREE.CircleGeometry(13.5, 20, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a2e30 })); door.position.z = 19.9; g.add(door);
      g.position.set(b.cx - 240 + i * 55, 0, north + 50); g.rotation.y = Math.PI;
      sc.add(g);
    }
    // Jets parked on the apron (a fuselage, a nose, wings and a fin), gray.
    const gray = new THREE.MeshStandardMaterial({ color: 0x8f969c, roughness: 0.45, metalness: 0.4 });
    const jet = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 14, 10), gray); body.rotation.z = Math.PI / 2; g.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 10), gray); nose.rotation.z = -Math.PI / 2; nose.position.x = 9; g.add(nose);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a5a7a, metalness: 0.6, roughness: 0.2 })); canopy.scale.set(2.2, 1, 1); canopy.position.set(5, 0.6, 0); g.add(canopy);
      const wingS = new THREE.Shape(); wingS.moveTo(2, 0); wingS.lineTo(-3, 5); wingS.lineTo(-4.5, 5); wingS.lineTo(-3.5, 0); wingS.lineTo(-4.5, -5); wingS.lineTo(-3, -5); wingS.closePath();
      const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingS, { depth: 0.15, bevelEnabled: false }), gray); wing.rotation.x = Math.PI / 2; g.add(wing);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 0.15), gray); fin.position.set(-5.5, 1.8, 0); fin.rotation.z = 0.35; g.add(fin);
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      g.position.y = 1.6;
      return g;
    };
    for (let i = 0; i < 6; i++) { if (i === 3) continue; const j = jet(); j.scale.setScalar(1.35); j.position.set(b.cx - 240 + i * 55, 2.1, north + 14); j.rotation.y = Math.PI / 2 + (rnd() - 0.5) * 0.3; sc.add(j); }
    // The control tower.
    const tower = new THREE.Group(), conc = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.9 });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 6), conc); shaft.position.y = 11; tower.add(shaft);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5.5, 5, 8), new THREE.MeshStandardMaterial({ color: 0x5a8aa8, metalness: 0.7, roughness: 0.15 })); cab.position.y = 24.5; tower.add(cab);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.8, 8), conc); lid.position.y = 27.4; tower.add(lid);
    tower.traverse(o => { if (o.isMesh) o.castShadow = true; });
    tower.position.set(b.cx + 110, 0, north + 40); sc.add(tower);
    // Rows of trees along the base fence (the pine pictures), and hay bales in the fields.
    const rows = [];
    for (let i = 0; i < 46; i++) rows.push({ x: b.cx - 430 + i * 19, z: south - 45 });
    for (let i = 0; i < 26; i++) rows.push({ x: b.x1 + 50, z: south + i * 19 });
    this.pines(W, rows.map(p => ({ ...p, y: 0 })), rnd, 0.95);
    const m4 = new THREE.Matrix4();
    const hay = this.scatter(W, 60, rnd, W.half + 25, 220).filter(p => p.z < north - 10 && p.z > south + 40);
    const hm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0xd8b860, roughness: 1 }), hay.length);
    hay.forEach((p, i) => { m4.makeRotationZ(Math.PI / 2).setPosition(p.x, 0.9, p.z); hm.setMatrixAt(i, m4); });
    hm.castShadow = true; sc.add(hm);
  },
  // The dunes: palms in clumps, dry bushes.
  negevDecor(W) {
    const rnd = Arcade.rng(919), sc = W.scene;
    for (const p of this.scatter(W, 36, rnd, W.half + 10, 160)) {
      const m = Assets.model('palm', { height: 7 + rnd() * 5 });
      if (!m) break;
      m.position.set(p.x, p.y - 0.2, p.z); m.rotation.y = rnd() * 6; sc.add(m);
    }
    const bush = this.scatter(W, 300, rnd, W.half + 3, 300);
    const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x7a7a4a, roughness: 1, flatShading: true }), bush.length);
    const m4 = new THREE.Matrix4();
    bush.forEach((p, i) => { const k = 0.4 + rnd() * 0.8; m4.makeScale(k * 1.3, k * 0.7, k * 1.3).setPosition(p.x, p.y + 0.2, p.z); bm.setMatrixAt(i, m4); });
    bm.castShadow = true; sc.add(bm);
  },
};
function S_len(W) { return W.samples.length; }
