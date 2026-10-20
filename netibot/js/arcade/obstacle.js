// The battalion PT instructor's obstacle course (מסלול המכשולים של {@madag}): four lanes,
// a whistle, and a course of inflatables in the desert: tires, hurdles, a camo net to crawl
// under, a mud pit, a beam over the mud, a climbing wall, monkey bars and a water slide to
// the finish. Every lane is the same course (the shared seed shuffles the middle). You get
// muddier as you go. Alone against three from the platoon; online, everyone in their lane.

const OBST_LINES = {
  start: ['{@madag}: "*שורקת* על הקו! מי שאחרון — עושה את זה עוד פעם!"', '{@madag}: "שלושים שניות! ...טוב, ארבעים. אבל זה הגבול!"'],
  trip: ['אאוץ\'!', 'הצמיג!', '😵'],
  hurdle: ['בום! לקפוץ!', 'המשוכה ניצחה'],
  stuck: ['נתקע[/ה] ברשת! לזחול!', 'למטה! על הבטן!'],
  fall: ['🌊 שפלאש!', 'לבוץ!', 'הקורה ניצחה'],
  wall: ['לטפס! לטפס! לטפס!', 'יד, רגל, יד!'],
  finish: ['{@madag}: "*שריקה ארוכה* יפה! ...אבל יכולת יותר מהר."', '{@madag}: "זה מה שנקרא כושר קרבי!"'],
  dnf: ['{@madag}: "לא סיימת? אין דבר. מחר בחמש בבוקר — שוב."', '{@madag}: "המסלול לא הולך לשום מקום. גם את[ה/] לא, עד שתסיימ[/י]."'],
  crowd: ['{@p_shaked}: "יאללה, פוצ׳! עוד קצת! ברוקולי!"', '{@p_shaked}: "איזה פוצ׳ים אתם! לרוץ!"', '{@p_hila}: "קדימה!!! אני משוגעת עלייך!!!"', '{@p_liran}: "אוגה! אוגה! אוגה!"', '{@p_ofek}: "תשתה משהו! פחית?"'],
};
const OBST_LANES = [-4.8, -1.6, 1.6, 4.8];
// The obstacles are sized to the mocap clips (assets/models/anims.json): the jump in "wallGrab"
// hangs from a rail at 1.95 m on a 2.3 m wall, "barJump" hangs from a bar at 2.4 m (arms up, the
// boots clear of the mud), and "crawl" keeps the head under a net at 0.7 m. Each lane's wall, net
// and bars are drawn to the size of whoever runs in it (someone 1.5x gets a wall 1.5x as tall),
// so the clips meet them the same way; drive() then puts hands and feet on them exactly.
const OBST_WALL_H = 2.3, OBST_BAR_Y = 2.4, OBST_NET_Y = 0.7;
// Tires: two columns of small tires lying flat, a row every metre; the run through them is the
// run clip, its stride locked to the rows so each footfall lands in a tire (one every 2 m, left
// and right in turn).
const OBST_TIRE_DZ = 1.0, OBST_TIRE_DX = 0.32, OBST_STEP = 2.0;
const OBST_BEAM_TOP = 0.69; // the beam's upper surface
const OBST_FADE = 0.2;      // seconds to blend into or out of a clip
const OBST_CM = 0.0094;     // metres per centimetre of the recorded skeleton, on our soldiers
const OBST_CRAWL = 1.5;     // m/s on the belly
const OBST_CLIPS = ['wallGrab', 'wallClimb', 'crawl', 'hurdle', 'barJump', 'barSwing', 'barFall', 'vault'];
const OBST_LIMBS = { LA: 'LeftArm', LF: 'LeftForeArm', LH: 'LeftHand', RA: 'RightArm', RF: 'RightForeArm', RH: 'RightHand', LU: 'LeftUpLeg', LL: 'LeftLeg', LFt: 'LeftFoot', LT: 'LeftToeBase', RU: 'RightUpLeg', RL: 'RightLeg', RFt: 'RightFoot', RT: 'RightToeBase', Hips: 'Hips' };
const obstEase = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
// What the next obstacle wants, on the keyboard and on the phone's buttons.
const OBST_HINTS = {
  keys: { tires: '⬆️ לרוץ — צעד בתוך כל צמיג!', hurdles: 'רווח — לקפוץ מעל המשוכות!', net: '⬇️ להחזיק — לזחול מתחת לרשת!', mud: '🟫 בוץ! להמשיך לדחוף!', beam: '⬅️➡️ שיווי משקל!', wall: '🧱 קיר — רווח מהר!', climbing: '🧱 רווח! רווח! רווח!', bars: '🤸 מתח — רווח בקצב!', barring: '🤸 רווח! [אל תיפול/אל תיפלי]!', slide: '🛝 מגלשה!', finish: '🏁 קו הסיום!' },
  touch: { tires: '🕹️ למעלה — צעד בתוך כל צמיג!', hurdles: '🦘 קפיצה — מעל המשוכות!', net: '🐛 להחזיק זחילה — מתחת לרשת!', mud: '🟫 בוץ! להמשיך לדחוף!', beam: '🕹️ ימינה/שמאלה — שיווי משקל!', wall: '🧱 קיר — קפיצה מהר!', climbing: '🧱 קפיצה! קפיצה! קפיצה!', bars: '🤸 מתח — קפיצה בקצב!', barring: '🤸 קפיצה! [אל תיפול/אל תיפלי]!', slide: '🛝 מגלשה!', finish: '🏁 קו הסיום!' },
};

const ObstacleGame = {
  id: 'obstacle', name: 'מסלול המכשולים של {@madag}', icon: '🏃‍♂️',
  desc: 'צמיגים, משוכות, זחילה מתחת לרשת, בוץ, קורה, קיר, מתח וגלישה — מי ראשון בקו. [תתלכלך/תתלכלכי].',
  cover: 'assets/arcade/cover_obstacle.jpg', solo: true, online: true, minOnline: 2,

  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x7fb8ea);
    sc.fog = new THREE.Fog(0xd8e8f0, 90, 380);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.2, 900);
    sc.add(new THREE.HemisphereLight(0xeaf4ff, 0xc9a56a, 0.85));
    const sun = this.sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 25, bottom: -25, near: 1, far: 120 });
    sc.add(sun, sun.target);
    Arcade.sky(sc, 'assets/arcade/obstacle_sky.jpg', { r: 520, h: 300, y0: -24, repeat: 3 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg', 90), color: 0xe9cf98, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
    this.mat = {
      red: M(0xe8392b, { roughness: 0.35 }), yellow: M(0xf2c12e, { roughness: 0.35 }), blue: M(0x2f7fe0, { roughness: 0.35 }), tire: M(0x141414, { roughness: 0.95 }),
      mud: new THREE.MeshStandardMaterial({ color: 0x5c3816, roughness: 0.25, metalness: 0 }), wood: M(0x9a6a3a, { roughness: 0.85 }), steel: M(0xaaaaaa, { metalness: 0.6, roughness: 0.4 }),
      water: new THREE.MeshStandardMaterial({ color: 0x4fb4e8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }), rope: M(0xe8e0c8),
    };
    // The camo net: green and brown blotches, holes you can see through.
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    for (let i = 0; i < 90; i++) { g.fillStyle = ['#4b5a2a', '#6b5a3a', '#3a4522', '#8a7a4a'][i % 4]; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 12, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'destination-out';
    for (let x = 0; x < 128; x += 10) for (let y = 0; y < 128; y += 10) g.fillRect(x + 2, y + 2, 6, 6);
    const nt = new THREE.CanvasTexture(cv); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(2, 3);
    this.mat.net = new THREE.MeshStandardMaterial({ map: nt, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 });
    // Wooden planks for the wall.
    const wv = document.createElement('canvas'); wv.width = 128; wv.height = 128;
    const wg = wv.getContext('2d');
    for (let y = 0; y < 128; y += 16) { wg.fillStyle = ['#a8743e', '#9a6a36', '#b07c46'][(y / 16) % 3]; wg.fillRect(0, y, 128, 15); wg.fillStyle = 'rgba(0,0,0,.35)'; wg.fillRect(0, y + 15, 128, 1); }
    this.mat.planks = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(wv), roughness: 0.9 });
    this.soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.course = new THREE.Group(); sc.add(this.course);
    this.fx = [];
  },

  // ---------- the course ----------
  // Start with tires, end with the slide; the shared seed shuffles what's in between.
  plan(rnd) {
    const mid = ['hurdles', 'net', 'mud', 'beam', 'wall', 'bars'].sort(() => rnd() - 0.5);
    const order = ['tires', ...mid, 'slide'];
    const len = { tires: 14, hurdles: 18, net: 9, mud: 10, beam: 12, wall: 5, bars: 10, slide: 18 };
    let z = 8;
    return order.map(type => { const s = { type, z0: z, z1: z + len[type] }; z = s.z1 + 7; return s; }).concat([{ type: 'finish', z0: z, z1: z + 1 }]);
  },
  buildCourse() {
    const C = this.course, M = this.mat;
    while (C.children.length) C.remove(C.children[0]);
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, -z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; C.add(m); return m; };
    const lanesW = 13;
    // Lane ropes, start and finish lines.
    for (const x of [-6.4, -3.2, 0, 3.2, 6.4]) add(new THREE.BoxGeometry(0.06, 0.06, this.len + 14), M.rope, x, 0.3, this.len / 2);
    for (const s of this.sections) {
      for (let li = 0; li < OBST_LANES.length; li++) {
        const lx = OBST_LANES[li], sc = this.laneSc(li);
        if (s.type === 'tires') for (const z of this.tireRows(s)) for (const dx of [-OBST_TIRE_DX, OBST_TIRE_DX]) add(this.geo.tire, M.tire, lx + dx, 0.08, z, Math.PI / 2);
        else if (s.type === 'hurdles') for (const z of [s.z0 + 4, s.z0 + 10, s.z0 + 16]) {
          // An inflatable bar, red and yellow, on two fat posts.
          for (let k = 0; k < 4; k++) add(this.geo.bar, k % 2 ? M.yellow : M.red, lx - 0.9 + k * 0.6 + 0.3, 0.75, z, 0, 0, Math.PI / 2);
          for (const dx of [-1.25, 1.25]) add(this.geo.post, M.red, lx + dx, 0.45, z);
        }
        else if (s.type === 'net') {
          const NY = OBST_NET_Y * sc;
          const net = new THREE.Mesh(new THREE.PlaneGeometry(2.8, s.z1 - s.z0), M.net); net.rotation.x = -Math.PI / 2; net.position.set(lx, NY, -(s.z0 + s.z1) / 2); C.add(net);
          for (let z = s.z0; z <= s.z1 + 0.01; z += (s.z1 - s.z0) / 3) for (const dx of [-1.35, 1.35]) { const p = add(this.geo.pole, M.wood, lx + dx, NY / 2, z); p.scale.y = NY / 0.8; }
        }
        else if (s.type === 'mud' || s.type === 'beam' || s.type === 'bars') {
          const mud = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, s.z1 - s.z0), M.mud); mud.position.set(lx, 0.02, -(s.z0 + s.z1) / 2); mud.receiveShadow = true; C.add(mud);
          if (s.type === 'beam') { add(this.geo.beam(s.z1 - s.z0), M.wood, lx, 0.55, (s.z0 + s.z1) / 2, Math.PI / 2); for (const z of [s.z0, s.z1]) add(this.geo.pole, M.wood, lx, 0.3, z); }
          if (s.type === 'bars') {
            const Y = OBST_BAR_Y * sc;
            for (const dx of [-0.8, 0.8]) { add(new THREE.BoxGeometry(0.08, 0.08, s.z1 - s.z0), M.steel, lx + dx, Y + 0.06, (s.z0 + s.z1) / 2); for (const z of [s.z0, s.z1]) add(new THREE.CylinderGeometry(0.06, 0.06, Y + 0.1, 6), M.steel, lx + dx, (Y + 0.1) / 2, z); }
            for (const z of this.rungs(s)) add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), M.yellow, lx, Y, z, 0, 0, Math.PI / 2);
          }
        }
        else if (s.type === 'wall') {
          // A planked wall with a grab rail on the face (where the jump lands the hands) and
          // slats to climb by, capped on top.
          const H = OBST_WALL_H * sc, zc = s.z0 + 2;
          const w = add(new THREE.BoxGeometry(2.6, H, 0.3), M.planks, lx, H / 2, zc); w.userData.wall = true;
          add(new THREE.BoxGeometry(2.7, 0.08, 0.36), M.wood, lx, H + 0.04, zc);
          for (const y of [0.55, 1.05, 1.5, 1.95]) add(new THREE.BoxGeometry(2.4, 0.07, 0.07), y === 1.95 ? M.red : M.wood, lx, y * sc, zc - 0.18);
          for (const dx of [-1.25, 1.25]) add(new THREE.BoxGeometry(0.12, H + 0.15, 0.4), M.wood, lx + dx, (H + 0.15) / 2, zc);
        }
        else if (s.type === 'slide') {
          // Up the steps, down the inflatable slide into the pool.
          const L = s.z1 - s.z0, top = 3.2;
          for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(2.6, top * (k + 1) / 5, 0.8), M.blue, lx, top * (k + 1) / 10, s.z0 + 0.4 + k * 0.8);
          // (High end on the steps, low end at the pool: tipped back toward the start.)
          const ramp = add(new THREE.BoxGeometry(2.6, 0.3, Math.hypot(L - 6, top)), M.yellow, lx, top / 2, s.z0 + 4 + (L - 6) / 2, -Math.atan2(top, L - 6));
          for (const dx of [-1.35, 1.35]) add(new THREE.BoxGeometry(0.3, 0.6, Math.hypot(L - 6, top)), M.red, lx + dx, top / 2 + 0.3, s.z0 + 4 + (L - 6) / 2, -Math.atan2(top, L - 6));
          void ramp;
          const pool = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.25, 3), M.water); pool.position.set(lx, 0.12, -(s.z1 - 1)); C.add(pool);
        }
      }
      if (s.type === 'finish') {
        // The finish arch (Higgsfield) and a red ribbon across all lanes.
        const arch = Assets.model('arc_arch', { length: lanesW + 12 });
        if (arch) { arch.position.set(0, 0, -s.z0); C.add(arch); }
        this.ribbon = add(new THREE.BoxGeometry(lanesW, 0.12, 0.04), M.red, 0, 1.15, s.z0);
      }
    }
    // Wide enough that its posts stand outside the outer lanes, out of the camera's face.
    const startArch = Assets.model('arc_arch', { length: lanesW + 12 });
    if (startArch) { startArch.position.set(0, 0, -2); C.add(startArch); }
    // Bunting along the sides.
    for (const side of [-1, 1]) for (let z = 0; z < this.len + 10; z += 6) {
      const pole = add(this.geo.pole, M.wood, side * 7.6, 1.5, z); pole.scale.y = 3.5;
      const flag = add(new THREE.ConeGeometry(0.35, 0.6, 3), [M.red, M.yellow, M.blue][Math.floor(z / 6) % 3], side * 7.6, 2.8, z + 3, Math.PI, 0, 0);
      void flag;
    }
  },

  // ---------- a race ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    const rnd = Arcade.rng(ctx.seed);
    this.geo = this.geo || { tire: new THREE.TorusGeometry(0.25, 0.08, 8, 18), bar: new THREE.CylinderGeometry(0.22, 0.22, 0.62, 12), post: new THREE.CylinderGeometry(0.2, 0.24, 0.9, 10), pole: new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), beam: (l) => new THREE.CylinderGeometry(0.14, 0.14, l, 10) };
    this.sections = this.plan(rnd);
    this.len = this.sections[this.sections.length - 1].z0;
    const list = ctx.solo
      ? [{ who: null, name: G.profile.name, isMe: true }, ...Arcade.bots(3, rnd).map(b => ({ who: b.id, name: fmt(`{@${b.id}}`), bot: true, skill: 0.78 + rnd() * 0.17 }))]
      : ctx.players.slice(0, 4).map(p => ({ who: p.isMe ? null : (Cast.get(p.who) ? p.who : null), name: p.name, isMe: p.isMe, peer: p.peer }));
    this.rs = list.map((c, i) => {
      const m = Arcade.soldier(this.scene, c.isMe ? Arcade.look(null) : Arcade.look(c.who));
      // Each soldier gets their own copy of the materials, to get muddy.
      m.root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.userData.c0 = o.material.color.clone(); } });
      const tag = Scene3D.label(c.isMe ? `⭐ ${c.name}` : c.name, { bg: c.isMe ? 'rgba(242,193,46,.95)' : 'rgba(20,26,16,.8)', fg: c.isMe ? '#1b1b1b' : '#f4f1e6', size: 0.5 });
      tag.position.y = 2.3; m.root.add(tag);
      const r = { ...c, m, tag, lane: i, x: OBST_LANES[i], z: 0, y: 0, vy: 0, v: 0, mode: 'run', stun: 0, mud: 0, bal: 0, climb: 0, bar: 0, barT: 0, fin: 0, tripZ: -1, hitZ: -1, ry: 0, rz: 0, ak: null, at: 0, ar: 0, pins: {}, hop: null, ct: 0 };
      r.rig = this.rig(r);
      // Some of the platoon are drawn bigger than life; the clips' heights scale with them.
      r.sc = m.root.scale.y || 1;
      return r;
    });
    this.me = this.rs.find(r => r.isMe);
    // The course, once it's known who runs in which lane (their wall, net and bars fit them).
    const go = () => this.buildCourse();
    if (Assets.has('arc_arch')) go(); else { go(); Arcade.loadModels(['arc_arch']).then(() => { if (this.ctx === ctx) go(); }); }
    // The PT instructor at the finish, whistle in hand, and a few from the platoon cheering.
    this.madag = Arcade.soldier(this.scene, Arcade.look('madag'));
    this.fans = Arcade.bots(4, rnd).map((b, i) => ({ m: Arcade.soldier(this.scene, Arcade.look(b.id)), x: (i % 2 ? 8.6 : -8.6), z: 20 + i * 22 }));
    this.camY = null; this.camLift = 0; this.camera.position.set(0, 5.4, 9); if (this.camAt) this.camAt.set(0, 0.8, -10);
    this.t = 0; this.started = false; this.done = false; this.lastE = false; this.lineT = 5; this.ribbonCut = false; this.nagged = false; G.shake = 0;
    this.ui();
    Arcade.buttons({ act: 'קפיצה', run: 'זחילה' });
    this.bindCrawl();
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>🏃‍♂️ מסלול המכשולים של {@madag}</h2>
      <p class="ar-sub">${G.touch ? 'ג\'ויסטיק למעלה — לרוץ · קפיצה — לקפוץ/לטפס/להתקדם במתח · זחילה (להחזיק) — מתחת לרשת · ימינה/שמאלה — שיווי משקל על הקורה' : '⬆️ / W — לרוץ · רווח / E — לקפוץ, לטפס על הקיר, להתקדם במתח · ⬇️ / S (להחזיק) — לזחול מתחת לרשת · ⬅️ ➡️ — שיווי משקל על הקורה'}</p>`);
    Sound.music('day');
    Arcade.countdown(performance.now() + (ctx.solo ? 4800 : 3400), () => { Arcade.panel(''); this.started = true; Sound.whistle(); Arcade.say(fmt(pick(OBST_LINES.start)), null, 2600); }, '🏁!');
  },
  // The phone's second button is a toggle everywhere else (run); here it's held to crawl.
  bindCrawl() {
    const b = $('#t-run');
    this.crawlHeld = false;
    if (!b || this.crawlOn) return;
    this.runWas = G.touchRun;
    this.crawlOn = (e) => { this.crawlHeld = e.type === 'pointerdown'; G.touchRun = false; b.classList.toggle('on', this.crawlHeld); };
    for (const ev of ['pointerdown', 'pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, this.crawlOn);
  },
  unbindCrawl() {
    const b = $('#t-run');
    if (b && this.crawlOn) for (const ev of ['pointerdown', 'pointerup', 'pointercancel', 'pointerleave']) b.removeEventListener(ev, this.crawlOn);
    this.crawlOn = null; this.crawlHeld = false;
    G.touchRun = !!this.runWas;
    if (b) b.classList.toggle('on', G.touchRun);
  },
  clear() {
    for (const r of this.rs || []) this.scene.remove(r.m.root);
    if (this.madag) this.scene.remove(this.madag.root);
    for (const f of this.fans || []) this.scene.remove(f.m.root);
    for (const f of this.fx || []) this.scene.remove(f.m);
    this.rs = []; this.fans = []; this.fx = [];
  },
  sectionAt(z) { return this.sections.find(s => z >= s.z0 - 0.5 && z <= s.z1 + 0.5); },
  // The monkey bars' rungs, 1.1 m apart: one swing of "barSwing" carries the body about that far.
  rungs(s) { const out = []; for (let z = s.z0 + 0.5; z < s.z1; z += 1.1) out.push(z); return out; },
  tireRows(s) { const out = []; for (let z = s.z0 + 1; z < s.z1 - 0.4; z += OBST_TIRE_DZ) out.push(z); return out; },
  // How big the runner in a lane is drawn (their obstacles are sized to match).
  laneSc(li) { const r = this.rs && this.rs[li]; return Math.max(0.8, Math.min(1.6, (r && r.sc) || 1)); },

  // ---------- the mocap clips ----------
  // Every soldier gets the obstacle clips (retargeted onto their own rig by Assets.clipsFor) as
  // extra actions on the mixer that already plays their walk / run / idle. The game sets which
  // clip shows (r.ak) and where in it (r.at) each frame; drive() blends them in and out over
  // OBST_FADE and leaves the rest of the weight to the run. hurdle and barSwing have a second
  // copy so a swing (or a jump) can blend into the next one.
  rig(r) {
    const m = r.m;
    if (!m.mixer || !Assets.animLib || !Assets.models.soldier) return null;
    const clips = m.own && Assets.people[m.who] ? Assets.clipsFor(Assets.people[m.who].scene, m.who) : Assets.clipsFor(Assets.models.soldier, '_soldier');
    if (!clips || OBST_CLIPS.some(k => !clips[k])) return null;
    const hands = [Assets.bone(m.root, [/^lefthand$/i]), Assets.bone(m.root, [/^righthand$/i])];
    if (!hands[0] || !hands[1]) return null;
    this.twins = this.twins || new WeakMap();
    if (!this.twins.has(clips)) this.twins.set(clips, { hurdle2: clips.hurdle.clone(), barSwing2: clips.barSwing.clone(), ...(clips.run ? { tireRun: clips.run.clone() } : {}) });
    const all = { ...Object.fromEntries(OBST_CLIPS.map(k => [k, clips[k]])), ...this.twins.get(clips) };
    const b = {};
    for (const k in OBST_LIMBS) b[k] = Assets.bone(m.root, [new RegExp('^' + OBST_LIMBS[k] + '$', 'i')]);
    const R = { acts: {}, w: {}, t: {}, hands, b, ik: Object.values(b).every(Boolean), v: new THREE.Vector3(), u: new THREE.Vector3() };
    if (all.tireRun) R.gait = this.gait(m, all.tireRun, b);
    for (const k in all) {
      const a = m.mixer.clipAction(all[k]);
      a.play(); a.timeScale = 0; a.setEffectiveWeight(0);
      R.acts[k] = a; R.w[k] = 0; R.t[k] = 0;
    }
    return R;
  },
  // Where in the run clip each foot is planted (lowest), and how far ahead of the hips it is
  // then: the tire run locks the clip's phase to the rows so those footfalls land in the tires.
  gait(m, clip, b) {
    if (!b.LFt || !b.RFt) return null;
    const mx = new THREE.AnimationMixer(m.mixer.getRoot()), a = mx.clipAction(clip), v = new THREE.Vector3();
    a.play();
    const g = { D: clip.duration, L: { y: 9 }, R: { y: 9 } };
    for (let i = 0; i < 48; i++) {
      a.time = clip.duration * i / 48; mx.update(0); m.root.updateMatrixWorld(true);
      for (const [f, bone] of [['L', b.LFt], ['R', b.RFt]]) {
        m.root.worldToLocal(bone.getWorldPosition(v));
        if (v.y < g[f].y) g[f] = { y: v.y, t: a.time, fwd: v.x };
      }
    }
    mx.stopAllAction(); mx.uncacheRoot(mx.getRoot());
    return g;
  },
  // The run clip's time for a runner at z in the tires: the left foot down in a tire every 4 m,
  // starting on the first row; the right foot half a cycle later, 2 m on.
  tirePhase(r, s) {
    const g = r.rig && r.rig.gait;
    if (!g) return 0;
    const u = (r.z + g.L.fwd * (r.sc || 1) - (s.z0 + 1)) / (2 * OBST_STEP);
    return (((g.L.t + u * g.D) % g.D) + g.D) % g.D;
  },
  // How far forward the recorded hips travel in a clip by time t (metres): the clips arrive
  // pinned in place, so the game moves the soldier by this where the move carries them.
  rootFwd(key, t) {
    const c = Assets.animLib && Assets.animLib.clips[key];
    if (!c || !c.hips) return 0;
    const T = c.times, n = T.length;
    let i = 0;
    while (i < n - 2 && T[i + 1] < t) i++;
    const u = Math.max(0, Math.min(1, (t - T[i]) / ((T[i + 1] - T[i]) || 1)));
    return (c.hips[i * 3 + 2] + (c.hips[(i + 1) * 3 + 2] - c.hips[i * 3 + 2]) * u - c.hips[2]) * OBST_CM;
  },
  // One soldier's pose for this frame: the clip weights, the run underneath, and the root.
  // Where a clip holds on to something (r.pins[clip] = { z, y, w }: a bar, by both hands), the
  // root is moved so the hands are exactly there, so the swing carries the body under the bar.
  drive(r, dt) {
    const m = r.m, R = r.rig, k = r.ak;
    if (k) { R.t[k] = r.at; }
    let S = 0;
    for (const n in R.acts) {
      const goal = n === k ? 1 : 0, d = goal - R.w[n];
      R.w[n] += Math.sign(d) * Math.min(Math.abs(d), dt / OBST_FADE);
      S += R.w[n];
    }
    if (S > 1) { for (const n in R.w) R.w[n] /= S; S = 1; }
    for (const n in R.acts) {
      const a = R.acts[n];
      a.time = Math.max(0, Math.min(a.getClip().duration - 1e-3, R.t[n]));
      // The run's own weights always add up to one, so this gives each clip its share.
      a.setEffectiveWeight(R.w[n] > 1e-4 ? R.w[n] / Math.max(1e-3, 1 - S) : 0);
    }
    Arcade.pose(m, r.x, -r.z, -Math.PI / 2, r.mode === 'fallen' || r.mode === 'bars' ? 0 : r.v, dt);
    m.root.position.y = r.ry;
    m.root.rotation.x = r.sliding ? 0.7 : 0;
    m.root.rotation.z = r.mode === 'fallen' ? 1.4 : 0;
    // The wobble on the beam: a roll to the side (bal > 0 to the left), pivoting at the boots.
    if (m.lean) m.lean.rotation.x = r.mode === 'fallen' ? 0 : -r.bal * 0.45;
    if (r.mode === 'fallen') m.root.position.y -= 0.3;
    // Hanging on: where the pose has the hands, and how far to move to put them on the bar.
    let P = 0, tz = 0, ty = 0, pw = 0;
    for (const n in r.pins) { const p = r.pins[n], w = R.w[n]; if (p && w > 0) { P += w; tz += w * p.z; ty += w * p.y; pw += w * p.w; } }
    if (P > 1e-3 && !r.peer) {
      tz /= P; ty /= P; pw /= P;
      m.root.updateMatrixWorld(true);
      const h = R.hands[0].getWorldPosition(R.v).add(R.hands[1].getWorldPosition(R.u)).multiplyScalar(0.5).sub(m.root.position);
      const amt = pw * P;
      // (Never into the ground: someone that tall just stands under the bar with arms up.)
      m.root.position.y += (Math.max(0, ty - h.y) - m.root.position.y) * amt;
      m.root.position.z += (-tz - h.z - m.root.position.z) * amt;
    }
    if (R.ik) this.fit(r);
    r.rz = -m.root.position.z;
    r.rootY = m.root.position.y;
    // How fast the clip runs, for the others to carry it on between updates.
    if (k !== r.akPrev || r.atPrev == null || Math.abs(r.at - r.atPrev) > 0.5) r.atPrev = r.at;
    const rate = dt ? Math.max(-6, Math.min(6, (r.at - r.atPrev) / dt)) : 0;
    r.ar += (rate - r.ar) * Math.min(1, dt * 8);
    r.atPrev = r.at; r.akPrev = k;
  },

  // ---------- contacts ----------
  // After the mixer has posed a soldier: the corrections that put them on what they're on. The
  // root (height, how far from the wall, a lean) for your own soldier and the bots (the others
  // send theirs), and arms and legs (two-bone IK) for everyone. Course z is -world z throughout.
  fit(r) {
    const m = r.m, R = r.rig, B = R.b, k = r.ak || '', w = k ? R.w[k] || 0 : 0, sc = r.sc || 1, local = !r.peer;
    const s = this.sectionAt(r.z), V = THREE.Vector3;
    const P = (bone) => { const v = bone.getWorldPosition(new V()); v.z = -v.z; return v; };   // course coords
    const T = (x, y, z) => new V(x, y, -z);                                                     // back to world
    const lift = (dy, dz = 0) => { m.root.position.y += dy; m.root.position.z -= dz; m.root.updateMatrixWorld(true); };
    m.root.updateMatrixWorld(true);
    const q = this.sections.find(x => x.type === 'wall' && r.z > x.z0 - 1 && r.z < x.z1 + 2);
    if (q && (k === 'wallGrab' || k === 'wallClimb' || (k === 'vault' && r.mode === 'climb'))) {
      const H = OBST_WALL_H * sc, zc = q.z0 + 2, face = zc - 0.15, back = zc + 0.15, railY = 1.95 * sc + 0.035, railZ = zc - 0.2;
      if (k === 'wallClimb' && local) {
        // Hand over hand: the lower hand holds where the climb has got to (from the rail up to the
        // top edge), the body hangs from it, off the face.
        const lo = P(B.LH).y < P(B.RH).y ? B.LH : B.RH, h = P(lo), u = obstEase((r.ct || 0) / 1.5);
        const gy = railY + 0.03 * sc + (H - railY) * u;
        lift((gy - h.y) * w, (railZ - h.z) * w);
      }
      if (local && (k === 'wallGrab' || k === 'wallClimb')) {
        // Boots and knees against the planks, not in them: lean the body out from the grip.
        const grip = P(B.LH).add(P(B.RH)).multiplyScalar(0.5);
        let e = 0, low = grip.y;
        for (const bn of [B.LT, B.RT, B.LFt, B.RFt, B.LL, B.RL]) { const p = P(bn); const lim = face - (bn === B.LL || bn === B.RL ? 0.09 : 0.05) * sc; if (p.z - lim > e) { e = p.z - lim; low = p.y; } }
        if (e > 0) {
          const a = Math.min(0.4, Math.atan2(e, Math.max(0.3, grip.y - low))) * w;
          m.root.rotation.x -= a; m.root.updateMatrixWorld(true);
          const g2 = P(B.LH).add(P(B.RH)).multiplyScalar(0.5);
          lift(grip.y - g2.y, grip.z - g2.z);
        }
      }
      // Hands: on the face while climbing (no deeper than it), flat on the top once they're over
      // it or while pressing up onto it, and never inside the wall on the way down the far side.
      const press = k === 'vault' && P(B.Hips).z < face - 0.02;
      for (const [A, F, Hd] of [[B.LA, B.LF, B.LH], [B.RA, B.RF, B.RH]]) {
        const h = P(Hd), top = H + 0.08 + 0.045 * sc;   // (the cap is 8 cm thick)
        let t = null;
        if (press) t = new V(h.x, top, face + 0.1);
        else if (k !== 'vault' && h.y > H - 0.02 && h.z > face - 0.25) t = new V(h.x, top, Math.max(face + 0.07, Math.min(back - 0.05, h.z)));
        else if (k !== 'vault' && h.z > face - 0.04 && h.y > 0.9 * sc) t = new V(h.x, h.y, face - 0.04);
        else if (h.y < top && h.z > face - 0.04 && h.z < back + 0.04) {
          // Inside it: out by the nearest side.
          const dT = top - h.y, dF = h.z - (face - 0.04), dB = back + 0.04 - h.z, d = Math.min(dT, dF, dB);
          t = d === dT ? new V(h.x, top, h.z) : d === dF ? new V(h.x, h.y, face - 0.04) : new V(h.x, h.y, back + 0.09);
        }
        if (t) this.ik(A, F, Hd, T(t.x, t.y, t.z), press ? (1 - obstEase((m.root.position.y - (H - 1.45 * sc)) / (0.5 * sc))) * w : w);
      }
      // Boots: toes against the face, not through it, on the way up.
      if (k !== 'vault') for (const [U, L, Ft, Tt] of [[B.LU, B.LL, B.LFt, B.LT], [B.RU, B.RL, B.RFt, B.RT]]) {
        const tz = P(Tt).z - (face - 0.04 * sc);
        if (tz > 0) { const f = P(Ft); this.ik(U, L, Ft, T(f.x, f.y, f.z - tz), w); }
      }
    }
    // The crawl's recorded body lies a hand above the floor: down onto it.
    if (k === 'crawl' && local) lift(-0.075 * sc * w);
    // Over the hurdles: the recorded tuck, lifted just enough that no part of the legs (or the
    // hands) goes through the inflatable bar.
    if ((k === 'hurdle' || k === 'hurdle2') && local && s && s.type === 'hurdles') {
      let need = 0;
      const pts = [];
      for (const [a, b2] of [[B.Hips, B.LU], [B.LU, B.LL], [B.LL, B.LFt], [B.LFt, B.LT], [B.Hips, B.RU], [B.RU, B.RL], [B.RL, B.RFt], [B.RFt, B.RT], [B.LF, B.LH], [B.RF, B.RH]]) {
        const p0 = P(a), p1 = P(b2);
        for (let i = 0; i <= 3; i++) pts.push(p0.clone().lerp(p1, i / 3));
      }
      const rad = 0.22 + 0.1 * sc;
      for (const hz of [s.z0 + 4, s.z0 + 10, s.z0 + 16]) for (const p of pts) {
        const dz = p.z - hz;
        if (Math.abs(dz) < rad) need = Math.max(need, 0.75 + Math.sqrt(rad * rad - dz * dz) - p.y);
      }
      if (need > 0) lift(Math.min(0.9, need) * w);
    }
    // The beam: boots on its top, under the body, not either side of it.
    if (s && s.type === 'beam' && r.z > s.z0 - 0.3 && r.z < s.z1 && !k && r.mode === 'run' && r.y > 0.3) {
      const lx = r.x;
      for (const [U, L, Ft] of [[B.LU, B.LL, B.LFt], [B.RU, B.RL, B.RFt]]) {
        const f = P(Ft);
        if (f.y < OBST_BEAM_TOP + 0.35) this.ik(U, L, Ft, T(lx + (f.x - lx) * 0.35, Math.max(f.y, OBST_BEAM_TOP + 0.1 * sc), f.z), 1);
      }
    }
    // The tires: each boot comes down in the middle of the tire it's over (in from above, over
    // the rim, not through it), and the leg swings toward its own column of tires on the way.
    if (k === 'tireRun' && s && s.type === 'tires') {
      const rows = this.tireRows(s), rim = 0.16 + 0.03, hole = 0.25 - 0.08;
      for (const [U, L, Ft, side] of [[B.LU, B.LL, B.LFt, -1], [B.RU, B.RL, B.RFt, 1]]) {
        const f = P(Ft), cx = r.x + side * OBST_TIRE_DX;
        const c = rows.reduce((a, z) => (Math.abs(z - f.z - 0.05) < Math.abs(a - f.z - 0.05) ? z : a), rows[0]);
        const down = obstEase((0.24 * sc - f.y) / 0.1);
        const t = new V(f.x + (cx - f.x) * obstEase((0.7 - Math.abs(c - f.z)) / 0.35), f.y, f.z + (c - 0.05 * sc - f.z) * down);
        // Over the rubber (between the hole and the outside of the rim), the sole stays above it.
        const dh = Math.hypot(t.x - cx, t.z - (c - 0.05 * sc)), sole = t.y - 0.13 * sc;
        if (dh > hole * 0.6 && dh < 0.25 + 0.08 + 0.12 && sole < rim) t.y += rim - sole;
        this.ik(U, L, Ft, T(t.x, t.y, t.z), w);
      }
    }
    // Down the slide sitting: legs out in front along the slope, leaning back a little, the
    // seat on the surface.
    if (r.sliding && s && s.type === 'slide') {
      const L = s.z1 - s.z0, a = Math.atan2(3.2, L - 6), Q = THREE.Quaternion;
      m.root.rotation.x = -a + 0.12; m.root.updateMatrixWorld(true);
      for (const [U, L2] of [[B.LU, B.LL], [B.RU, B.RL]]) {
        // Thigh and shin straight out ahead (the run's knee bend taken out), heels just off the surface.
        const hipP = U.getWorldPosition(new V()), kn = L2.getWorldPosition(new V()), dn = kn.clone().sub(hipP).normalize();
        const want = new V(0, -Math.sin(a - 0.12 + 0.1), -Math.cos(a - 0.12 + 0.1));
        U.updateMatrixWorld(true);
        const qa = new Q().setFromUnitVectors(dn, want), bw = U.getWorldQuaternion(new Q()), pw = U.parent.getWorldQuaternion(new Q());
        U.quaternion.copy(pw.invert().multiply(qa.multiply(bw))); U.updateMatrixWorld(true);
        const kn2 = L2.getWorldPosition(new V()), ft = (U === B.LU ? B.LFt : B.RFt).getWorldPosition(new V());
        const dn2 = ft.clone().sub(kn2).normalize(), qb = new Q().setFromUnitVectors(dn2, want), bw2 = L2.getWorldQuaternion(new Q()), pw2 = L2.parent.getWorldQuaternion(new Q());
        L2.quaternion.copy(pw2.invert().multiply(qb.multiply(bw2))); L2.updateMatrixWorld(true);
      }
      if (local) {
        m.root.updateMatrixWorld(true);
        const hp = P(B.Hips), surf = 3.2 * (1 - (hp.z - s.z0 - 4) / (L - 6)) + 0.15 / Math.cos(a);
        lift(surf + 0.13 * sc - hp.y);
      }
    }
  },
  // Two-bone IK (shoulder-elbow-hand, hip-knee-ankle) in world space: bends the limb in the plane
  // it's already bent in so the end reaches t, by weight w.
  ik(a, b, c, t, w = 1) {
    if (!a || !b || !c || w <= 0.001) return;
    const V = THREE.Vector3, Q = THREE.Quaternion, cl = (x) => Math.max(-1, Math.min(1, x));
    const A = a.getWorldPosition(new V()), Bp = b.getWorldPosition(new V()), C = c.getWorldPosition(new V());
    const tg = C.clone().lerp(t, Math.min(1, w));
    const lab = A.distanceTo(Bp), lcb = Bp.distanceTo(C), lat = Math.max(0.01, Math.min(lab + lcb - 1e-3, A.distanceTo(tg)));
    const ac = C.clone().sub(A).normalize(), ab = Bp.clone().sub(A).normalize(), ba = ab.clone().negate(), bc = C.clone().sub(Bp).normalize();
    // (A straight limb has no bend plane: bend it toward the front.)
    const axis = new V().crossVectors(ac, ab);
    if (axis.lengthSq() < 1e-6) axis.crossVectors(ac, Math.abs(ac.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0));
    axis.normalize();
    const a0 = Math.acos(cl(ac.dot(ab))), b0 = Math.acos(cl(ba.dot(bc)));
    const a1 = Math.acos(cl((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat))), b1 = Math.acos(cl((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb)));
    const turn = (bone, q) => { const bw = bone.getWorldQuaternion(new Q()), pw = bone.parent.getWorldQuaternion(new Q()); bone.quaternion.copy(pw.invert().multiply(q.multiply(bw))); bone.updateMatrixWorld(true); };
    turn(a, new Q().setFromAxisAngle(axis, a1 - a0));
    turn(b, new Q().setFromAxisAngle(axis, b1 - b0));
    const C2 = c.getWorldPosition(new V()).sub(A).normalize();
    turn(a, new Q().setFromUnitVectors(C2, tg.clone().sub(A).normalize()));
  },

  // ---------- each frame ----------
  update(dt) {
    if (this.started && !this.done) this.t += dt;
    const inp = Arcade.input(), keys = G.keys;
    const crawl = !!(keys.has('ArrowDown') || keys.has('KeyS') || this.crawlHeld || (G.stick.y || 0) > 0.5);
    const pressed = inp.held && !this.lastE;
    this.lastE = inp.held;
    for (const r of this.rs) {
      if (r.peer) { this.remote(r, dt); continue; }
      if (!this.started || r.fin) { if (r.fin) { r.v *= 0.95; r.z += r.v * dt; } continue; }
      // Holding crawl moves you forward on its own (down and up would cancel on the keyboard).
      const c = r.isMe ? { fwd: crawl ? 0.9 : Math.max(0, inp.y), side: inp.x, crawl, jump: pressed } : this.bot(r, dt);
      this.step(r, c, dt);
    }
    this.lineT -= dt;
    if (this.lineT <= 0 && this.started && !this.done) { this.lineT = 6 + Math.random() * 5; Arcade.say(fmt(pick(OBST_LINES.crowd)), null, 2200); }
    // Finished when everyone (online too, so their time makes the table) is over the line, or
    // the timer runs long. If you're the
    // last one out there, she waits a bit, nags, and then calls it.
    if (!this.done && this.started && this.me.fin && (this.rs.every(r => r.fin) || this.t > this.me.fin + 12)) this.finish();
    const others = this.rs.filter(r => !r.isMe);
    if (!this.done && this.started && !this.me.fin && others.length && others.every(r => r.fin)) {
      const last = Math.max(...others.map(r => r.fin));
      if (!this.nagged && this.t > last + 12) { this.nagged = true; Arcade.say(fmt('{@madag}: "נו?! כולם כבר בשקם! עוד עשר שניות ואני סוגרת את המסלול!"'), null, 3200); Sound.whistle(); }
      if (this.t > last + 24) { Arcade.big('⏱️ נגמר הזמן', 1400); this.finish(); }
    }
    this.animate(dt);
    this.hud();
    if (this.done && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  // One soldier's step: what the section in front of them asks for. Besides the game state it
  // sets the clip to show (r.ak at time r.at, null for the run), where hands hold on (r.pins)
  // and the height the body is drawn at (r.ry; r.y is the height that clears obstacles).
  step(r, c, dt) {
    const s = this.sectionAt(r.z + 0.6), type = s ? s.type : 'run';
    r.stun = Math.max(0, r.stun - dt);
    r.ak = null;
    let top = 6.8;
    if (r.mode === 'fallen') { r.ry = 0; r.fallT -= dt; if (r.fallT <= 0) { r.mode = 'run'; r.z = r.respawnZ; r.y = 0; } return; }
    if (r.mode === 'climb') return this.wall(r, c, dt);
    if (r.mode === 'bars') return this.bars(r, c, dt);
    // Running: forward input, slowed by mud, a stumble; on the belly under the net.
    const want = c.fwd > 0.1 ? top * Math.min(1, c.fwd + 0.2) * (r.skill && !r.isMe ? r.skill : 1) : 0;
    let mult = 1;
    if (type === 'mud') { mult = 0.42; r.mud = Math.min(1, r.mud + dt * 0.15); }
    // High knees through the tires: a bit slower than the open track.
    if (type === 'tires' && r.z > s.z0 && r.z < s.z1 - 0.5) mult = 0.8;
    // The net: you can only get under it on your belly, and under it you stay down (forward or
    // crawl keeps you going; let go of both and you lie there).
    // (Down on the belly before the net's edge: the crawl reaches 0.75 m ahead of the hips.)
    const net = this.sections.find(q => q.type === 'net' && r.z > q.z0 - 2.2 && r.z < q.z1 + 0.25);
    const entry = net ? net.z0 - 1.1 * (r.sc || 1) : 0;
    const under = net && r.z > entry && r.z < net.z1 + 0.2;
    if (net && (under || (c.crawl && r.z > net.z0 - 2 && r.y <= 0.01))) {
      if (!r.crawl) { r.crawl = true; r.hop = null; r.v = Math.min(r.v, 2.2); r.ct = r.rig ? r.rig.acts.crawl.getClip().duration * 0.5 : 0; }
    } else r.crawl = false;
    if (r.stun > 0) mult = 0.1;
    if (r.crawl) r.v += ((c.crawl || c.fwd > 0.1 ? OBST_CRAWL * (r.skill && !r.isMe ? 0.75 + r.skill * 0.3 : 1) : 0) - r.v) * Math.min(1, dt * 5);
    else r.v += (want * mult - r.v) * Math.min(1, dt * 6);
    // Jumping. Over the hurdles it's the recorded jump, a whole flying tuck.
    if (c.jump && r.y <= 0.01 && !r.crawl) {
      r.vy = 5.6; Sound.synth.tone(400, 0.08, 'triangle', 0.04, 700);
      if (type === 'hurdles' && r.rig) {
        // The tuck in the clip (0.86 s) is timed to come over the bar ahead, whenever you took off.
        const hz = [s.z0 + 4, s.z0 + 10, s.z0 + 16].find(z => z > r.z + 0.2);
        r.hop = 0; r.hopAlt = !r.hopAlt; r.hopBar = Math.max(0.2, Math.min(0.55, hz != null ? (hz - r.z) / Math.max(3, r.v) : 0.47));
      }
    }
    r.vy -= 16 * dt; r.y = Math.max(0, r.y + r.vy * dt); if (r.y === 0) r.vy = 0;
    const z0 = r.z;
    r.z += r.v * dt;
    if (net && !r.crawl && z0 <= entry && r.z > entry - 0.05) {
      // Standing at the net: it doesn't let you through.
      r.z = Math.max(z0, entry - 0.05); r.v = Math.min(r.v, 0.5);
      if (r.isMe && !r.stuckSaid) { r.stuckSaid = true; Arcade.say(fmt(pick(OBST_LINES.stuck)), null, 1800); }
    } else if (!net) r.stuckSaid = false;
    r.ry = r.y;
    if (r.crawl) {
      // "Crawl_Backward" played backwards crawls forward, about 0.29 m a cycle.
      const D = r.rig ? r.rig.acts.crawl.getClip().duration : 1;
      r.ct = ((r.ct - dt * Math.min(4.2, r.v / 0.29)) % D + D) % D;
      r.ak = 'crawl'; r.at = r.ct; r.ry = 0;
    }
    if (r.hop != null) {
      // Takeoff to landing of the clip over the jump's 0.7 s in the air, then the stumble out.
      r.hop += dt;
      const tb = r.hopBar || 0.47;
      r.hopT = r.y > 0 || r.hop < 0.1 ? (r.hop < tb ? 0.3 + 0.56 * r.hop / tb : Math.min(1.14, 0.86 + 0.28 * (r.hop - tb) / Math.max(0.15, 0.7 - tb))) : Math.max(1.14, r.hopT || 1.14) + dt * 1.8;
      if (r.hopT >= 1.62 || r.crawl) r.hop = null;
      else { r.ak = r.hopAlt ? 'hurdle2' : 'hurdle'; r.at = r.hopT; r.ry = r.y * 0.5; }
    }
    // The wall and the monkey bars stop you where they start, however long the frame was.
    for (const q of this.sections) {
      if (q.type === 'wall' && z0 < q.z0 + 1.55 && r.z >= q.z0 + 1.55 && r.y < 2) {
        Object.assign(r, { mode: 'climb', wq: q, ph: 'grab', pt: 0, climb: 0, climbed: false, ct: 0, v: 0, vy: 0, y: 0, ry: 0, z: q.z0 + 1.55, hop: null });
        if (r.isMe) Arcade.say(fmt(pick(OBST_LINES.wall)), null, 1600);
        return;
      }
      if (q.type === 'bars' && z0 < q.z0 + 0.5 && r.z >= q.z0 + 0.5) {
        Object.assign(r, { mode: 'bars', barS: q, rungList: this.rungs(q), bk: 0, ph: 'jump', pt: 0, barT: 0, barQ: false, v: 0, vy: 0, y: 0, ry: 0, z: q.z0 + 0.5, hop: null, splashed: false });
        return;
      }
    }
    // The beam: keep your balance with left/right or fall in. (A hop up onto it from just
    // before its end, boots on its top.)
    const bm = this.sections.find(q => q.type === 'beam' && r.z > q.z0 - 0.7 && r.z <= q.z0);
    if (bm && !r.crawl && r.mode === 'run') { const h = (OBST_BEAM_TOP + 0.03) * obstEase((r.z - (bm.z0 - 0.7)) / 0.6); r.y = Math.max(r.y, h); r.ry = Math.max(r.ry, h); }
    if (type === 'beam' && r.z > s.z1 && r.z < s.z1 + 0.35 && r.mode === 'run') { r.y = Math.max(r.y, OBST_BEAM_TOP + 0.03); r.ry = Math.max(r.ry, OBST_BEAM_TOP + 0.03); }
    if (type === 'beam' && r.z > s.z0 && r.z < s.z1) {
      r.bal += (Math.sin(this.t * 2.3 + r.lane) * 0.9 + (Math.random() - 0.5) * 2.4) * dt * (0.5 + r.v / 7) - c.side * dt * 2.6;
      r.bal *= 1 - dt * 0.4;
      if (!r.beamAt || r.beamAt.s !== s) r.beamAt = { s, t: this.t };
      r.y = Math.max(r.y, OBST_BEAM_TOP + 0.03); r.ry = Math.max(r.ry, OBST_BEAM_TOP + 0.03);
      if (Math.abs(r.bal) > 1) this.fall(r, s.z0 - 0.4);
    } else r.bal *= 0.9;
    // Tires: the run clip, its stride locked to the rows (see tirePhase), each footfall in a tire.
    // Jump in there and you come down on a rim: a stumble.
    if (type === 'tires' && r.rig && r.rig.acts.tireRun && !r.ak && r.y <= 0.01 && r.v > 1.5 && r.z > s.z0 - 0.3 && r.z < s.z1 - 0.4) { r.ak = 'tireRun'; r.at = this.tirePhase(r, s); }
    if (type === 'tires' && r.vy < 0 && r.y > 0 && r.y + r.vy * dt <= 0 && r.z > s.z0 + 0.5 && r.z < s.z1 - 0.5) { r.stun = 0.45; r.v *= 0.3; if (r.isMe) { this.pop(r, pick(OBST_LINES.trip)); Sound.bump(); } }
    // Hurdles: into the bar — bounced back. (A jump peaks just under a meter; the bar's top is
    // at about that, and the feet tuck up, so anything over 0.6 clears it.)
    if (type === 'hurdles') for (const z of [s.z0 + 4, s.z0 + 10, s.z0 + 16]) if (z0 < z - 0.3 && r.z >= z - 0.3 && r.y < 0.6) { r.hitZ = z; r.z = z - 1.2; r.v = 0; r.stun = 0.6; r.hop = null; if (r.isMe) { this.pop(r, pick(OBST_LINES.hurdle)); Sound.bump(); G.shake = 0.3; } }
      else if (z0 < z - 0.3 && r.z >= z - 0.3 && r.isMe && r.hitZ !== z) { r.hitZ = z; Sound.synth.tone(660, 0.08, 'triangle', 0.04, 990); }
    // The slide: up the steps, then fast down into the pool.
    if (type === 'slide') {
      const L = s.z1 - s.z0, u = r.z - s.z0;
      // Up the five steps one at a time (each 0.8 m deep, 0.64 m up), on top of each one.
      if (u < 4) { const n = Math.floor((u + 0.25) / 0.8); r.y = Math.max(r.y, Math.min(3.2, 0.64 * (n + obstEase(((u + 0.25) - n * 0.8) / 0.25)))); }
      else if (u < L - 2) { r.y = 3.2 * (1 - (u - 4) / (L - 6)); r.v = Math.max(r.v, 11); r.sliding = true; }
      else if (r.sliding) { r.sliding = false; r.y = 0; this.splash(r); r.mud = Math.max(0, r.mud - 0.6); }
      r.ry = r.y;
    }
    if (r.z >= this.len && !r.fin) this.cross(r);
  },
  // The wall: jump and grab the rail ("wallGrab"), mash to climb hand over hand ("wallClimb",
  // as far up as you've mashed — stop and you slide back), pull up onto the top and leap down
  // the far side ("vault" starts standing on a ledge, so it starts on the wall's top).
  wall(r, c, dt) {
    // (ledge: the root's height with the vault's first pose standing on the top; the clip's hips
    // start 0.7 m above its boots.)
    const sc = r.sc || 1, q = r.wq, H = OBST_WALL_H * sc, face = q.z0 + 1.55, mid = q.z0 + 2, ledge = H - 0.7 * sc, wallF = q.z0 + 1.85;
    if (r.ph === 'grab' || r.ph === 'up') {
      r.climb = Math.min(1.05, Math.max(0, r.climb - dt * 0.12) + (c.jump ? 0.17 : 0));
      if (c.jump) Sound.synth.tone(300 + r.climb * 400, 0.04, 'square', 0.03);
      if (r.climb >= 1) r.climbed = true;
    }
    if (!r.rig) {
      // No clips: the old way, straight up the face.
      r.ry = r.y = Math.min(H, r.climb * H);
      if (r.climbed) { r.mode = 'run'; r.z = q.z0 + 2.6; r.v = 4; r.vy = 2; r.y = r.ry = H + 0.1; if (r.isMe) Sound.good(); }
      return;
    }
    r.pt += dt;
    if (r.ph === 'grab') {
      // The jump ends with both hands on the red rail (drive() moves the body so they are).
      r.ak = 'wallGrab'; r.at = Math.min(1.26, 0.12 + r.pt * 1.35); r.ry = 0;
      r.pins.wallGrab = { z: q.z0 + 1.8, y: 1.95 * sc + 0.065 * sc, w: obstEase((r.at - 0.5) / 0.2) };
      if (r.at >= 1.26) { r.ph = 'up'; r.pt = 0; r.ct = 0; }
    } else if (r.ph === 'up') {
      // Hand over hand ("wallClimb"); fit() hangs the body from the lower hand, which goes from
      // the rail to the top edge as far as you've mashed.
      r.ct += (1.5 * Math.min(1, r.climb) - r.ct) * Math.min(1, dt * 6);
      r.ak = 'wallClimb'; r.at = r.ct; r.ry = 0;
      if (r.climbed && r.ct > 1.4) { r.ph = 'top'; r.pt = 0; r.top0 = { y: r.rootY || 0, z: r.rz || face }; if (r.isMe) Sound.good(); }
    } else if (r.ph === 'top') {
      // Pressing up on the top edge: straight up in front of the face until the boots clear the
      // top, then forward onto it.
      const u = obstEase(r.pt / 0.36), v = obstEase((r.pt - 0.3) / 0.26), t0 = r.top0 || { y: 0.4, z: face };
      const zf = wallF - 0.28 * sc;
      r.ak = 'vault'; r.at = 0.12; r.ry = t0.y + (ledge - t0.y) * u; r.z = t0.z + (zf - t0.z) * u + (mid - zf) * v;
      if (r.pt >= 0.56) { r.ph = 'drop'; r.pt = 0; r.landed = false; }
    } else {
      r.ak = 'vault'; r.at = 0.12 + r.pt * 1.7;
      r.z = mid + (this.rootFwd('vault', r.at) - this.rootFwd('vault', 0.12)) * sc;
      r.ry = ledge * (1 - obstEase((r.at - 1.0) / 0.72));
      if (r.at >= 1.72 && !r.landed) { r.landed = true; if (r.isMe) { Sound.bump(); G.shake = 0.15; } }
      if (r.at >= 1.95) { r.mode = 'run'; r.y = r.ry = 0; r.v = 3.5; r.vy = 0; }
    }
    r.y = r.ry;
  },
  // Monkey bars: jump up to the first bar ("barJump", which ends hanging), then a press for
  // each swing to the next bar ("barSwing" from the grab to the far end of the swing, one bar's
  // length; the two copies blend swing into swing). Press while swinging and the next swing
  // follows on, faster the faster you press. Hang too long and the grip goes ("barFall", into
  // the mud, back to the start). After the last bar you let go and drop off.
  bars(r, c, dt) {
    const bs = r.barS, rungs = r.rungList, last = rungs.length - 1, BY = (OBST_BAR_Y - 0.06) * Math.max(0.8, Math.min(1.6, r.sc || 1));
    const rung = (k) => rungs[Math.max(0, Math.min(last, k))];
    if (!r.rig) {
      r.barT += dt; r.ry = r.y = 1.0;
      if (c.jump) { r.z += 1.1; r.barT = 0; Sound.synth.tone(520, 0.05, 'triangle', 0.04); }
      if (r.barT > 1.8) this.fall(r, bs.z0);
      else if (r.z > bs.z1) { r.mode = 'run'; r.y = r.ry = 0; r.z = bs.z1 + 0.6; }
      return;
    }
    r.pt += dt; r.ry = 0; r.y = 1.0;
    if (c.jump) {
      if (r.ph === 'jump' || r.ph === 'hang' || r.ph === 'swing') r.barQ = true;
      // The pace of the presses sets the pace of the swings.
      const gap = this.t - (r.pressAt || -9); r.pressAt = this.t;
      r.swRate = Math.max(1.5, Math.min(2.6, 1.23 / Math.max(0.47, gap)));
    }
    const swing = () => { r.ph = 'swing'; r.pt = 0; r.barQ = false; r.swAlt = !r.swAlt; r.barT = 0; r.swRate = r.swRate || 1.7; Sound.synth.tone(520, 0.05, 'triangle', 0.04); };
    if (r.ph === 'jump') {
      r.ak = 'barJump'; r.at = 0.15 + r.pt * 1.5; r.z = rung(0);
      r.pins.barJump = { z: rung(0), y: BY, w: obstEase((r.at - 0.5) / 0.25) };
      if (r.at >= 1.25) { r.ph = 'hang'; r.pt = 0; r.barT = 0; }
    } else if (r.ph === 'hang') {
      r.ak = 'barJump'; r.at = 1.25 + 0.2 * (1 - Math.cos(r.pt * 2.6)) / 2; r.z = rung(r.bk);
      r.pins.barJump = { z: rung(r.bk), y: BY, w: 1 };
      r.barT += dt;
      if (r.barQ) swing();
      else if (r.barT > 1.8) { r.ph = 'fall'; r.pt = 0; r.splashed = false; }
    } else if (r.ph === 'swing') {
      const key = r.swAlt ? 'barSwing2' : 'barSwing';
      r.ak = key; r.at = Math.min(1.85, 0.62 + r.pt * r.swRate);
      r.pins[key] = { z: rung(r.bk), y: BY, w: 1 };
      r.z = rung(r.bk) + (r.at - 0.62) / 1.23 * 1.1;
      if (r.at >= 1.85) {
        r.bk++;
        if (r.bk >= last) { r.ph = 'off'; r.pt = 0; }
        else if (r.barQ) swing();
        else { r.ph = 'hang'; r.pt = 0; r.barT = 0; }
      }
    } else {
      // Letting go: at the end of the bars, or the grip giving out.
      r.ak = 'barFall'; r.at = 0.25 + r.pt * 1.5; r.z = rung(r.bk);
      r.pins.barFall = { z: rung(r.bk), y: BY, w: 1 - obstEase((r.at - 0.3) / 0.25) };
      if (r.ph === 'fall' && r.at >= 0.56 && !r.splashed) {
        r.splashed = true; r.mud = Math.min(1, r.mud + 0.35); this.splash(r, 0x5a3a20);
        if (r.isMe) { this.pop(r, pick(OBST_LINES.fall)); G.shake = 0.4; }
      }
      if (r.at >= 1.2) {
        r.mode = 'run'; r.y = r.ry = 0; r.vy = 0;
        if (r.ph === 'fall') { r.z = bs.z0 - 0.4; r.v = 0; } else { r.z = rung(r.bk) + 0.15; r.v = 2.5; }
      }
    }
  },
  fall(r, z) {
    r.mode = 'fallen'; r.fallT = 1.2; r.respawnZ = z; r.y = 0; r.v = 0; r.bal = 0; r.mud = Math.min(1, r.mud + 0.35);
    this.splash(r, 0x5a3a20);
    if (r.isMe) { this.pop(r, pick(OBST_LINES.fall)); Sound.splat(); G.shake = 0.4; }
  },
  cross(r) {
    r.fin = this.t;
    if (this.ribbon && !this.ribbonCut) { this.ribbonCut = true; this.ribbon.visible = false; }
    if (r.isMe) {
      Sound.whistle(); Sound.fanfare();
      const place = this.rs.filter(q => q.fin).length;
      Arcade.big(place === 1 ? '🏆 ראשון!' : `🏁 מקום ${place}`, 1600);
      Arcade.say(fmt(pick(OBST_LINES.finish)), null, 2600);
      this.confetti();
    }
  },
  // The bots: run, jump the hurdles, crawl, balance, mash; now and then they mess up.
  bot(r, dt) {
    const s = this.sectionAt(r.z + 1.2), type = s ? s.type : 'run', k = r.skill;
    const c = { fwd: 0.85 + k * 0.15, side: 0, crawl: false, jump: false };
    // (Too close and the jump can't get up in time: the take-off window grows with speed.)
    if (type === 'hurdles') for (const z of [s.z0 + 4, s.z0 + 10, s.z0 + 16]) if (z - r.z > 0.9 + r.v * 0.08 && z - r.z < 2.4 && Math.random() < k * 0.6) c.jump = true;
    if (type === 'net') c.crawl = Math.random() < 0.97;
    if (type === 'beam') c.side = r.bal * (0.6 + k * 0.6) + (Math.random() - 0.5) * 0.4;
    if (r.mode === 'climb') c.jump = Math.random() < dt * (5 + k * 6);
    if (r.mode === 'bars') {
      // A beat on each bar before the next swing, and once in a while a long look down.
      if (r.ph === 'hang') { if (r.waitFor == null) r.waitFor = Math.random() < 0.07 * (1.25 - k) ? 2.2 : 0.12 + Math.random() * 0.4; c.jump = r.barT > r.waitFor; }
      else { r.waitFor = null; c.jump = Math.random() < dt * (2 + k * 2); }
    }
    return c;
  },
  remote(r, dt) {
    const o = Arcade.others().find(x => x.peer === r.peer), s = o && o.s;
    if (!s) return;
    const k = Math.min(1, dt * 10);
    // Their body where they drew it (hands on the bar included), and the clip they're in:
    // carried on at its own pace between updates, pulled back to theirs as each one comes.
    r.z += (s.z - r.z) * k; r.ry += ((s.y || 0) - r.ry) * k; r.y = r.ry;
    r.v = s.v || 0; r.mode = s.m || 'run'; r.crawl = !!s.c; r.mud = s.mud || 0; r.bal = s.b || 0; r.sliding = !!s.sl;
    if (s !== r.lastS) { r.lastS = s; r.sAge = 0; } else r.sAge += dt;
    const key = s.a && r.rig && r.rig.acts[s.a] ? s.a : null;
    if (key) {
      let want = (s.t || 0) + r.sAge * (s.r || 0);
      if (key === 'crawl') { const D = r.rig.acts.crawl.getClip().duration; want = ((want % D) + D) % D; }
      if (key !== r.ak || Math.abs(want - r.at) > 0.3) r.at = want;
      else r.at += (want - r.at) * Math.min(1, dt * 12);
    }
    r.ak = key;
    if (s.fin && !r.fin) r.fin = s.fin;
  },

  // ---------- effects ----------
  pop(r, text) {
    const l = Scene3D.label(text, { bg: 'rgba(255,214,0,.95)', fg: '#b3001b', size: 0.55 });
    l.position.set(r.x, r.y + 2.6, -r.z); this.scene.add(l);
    this.fx.push({ m: l, t: 0, rise: true, life: 1.2 });
  },
  splash(r, color = 0x8fd0ff) {
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color, transparent: true, depthWrite: false }));
      m.position.set(r.x + (Math.random() - 0.5), 0.4, -r.z + (Math.random() - 0.5)); m.scale.setScalar(0.4 + Math.random() * 0.4);
      this.scene.add(m);
      this.fx.push({ m, t: 0, v: new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.9 });
    }
    if (r.isMe) Sound.splat();
  },
  confetti() {
    const cols = [0xe8392b, 0xf2c12e, 0x2f7fe0, 0x3fae3a, 0xffffff];
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.32), new THREE.MeshBasicMaterial({ color: cols[i % 5], side: THREE.DoubleSide }));
      m.position.set((Math.random() - 0.5) * 12, 5 + Math.random() * 4, -this.len + (Math.random() - 0.5) * 4);
      this.scene.add(m);
      this.fx.push({ m, t: 0, v: new THREE.Vector3(0, -1.5 - Math.random(), 0), spin: (Math.random() - 0.5) * 8, life: 4 });
    }
  },

  // ---------- drawing ----------
  animate(dt) {
    const t = performance.now() / 1000;
    const mudC = new THREE.Color(0x5a3a20);
    for (const r of this.rs) {
      const m = r.m;
      // Someone just behind you would have their name tag filling the screen.
      if (r.tag && !r.isMe && this.me) r.tag.visible = r.z > this.me.z - 2;
      if (r.rig) this.drive(r, dt);
      else {
        // No clips loaded: the old poses, tipped and lifted by hand.
        const pose = r.mode === 'climb' || r.mode === 'bars' || r.mode === 'fallen' ? 0 : r.v;
        Arcade.pose(m, r.x, -r.z, -Math.PI / 2, pose, dt);
        m.root.position.y = r.ry + (r.mode === 'fallen' ? -0.3 : 0);
        m.root.rotation.x = r.crawl ? -1.35 : r.mode === 'climb' ? 0.15 : r.sliding ? 0.7 : 0;
        m.root.rotation.z = r.mode === 'fallen' ? 1.4 : r.bal * 0.45;
        if (r.crawl) m.root.position.y = 0.25;
        if (r.mode === 'bars') m.root.position.y = 0.4 + Math.sin(t * 8) * 0.05;
        r.rz = r.z; r.rootY = m.root.position.y;
      }
      // Mud: the uniform darkens toward brown as they go.
      if (Math.abs((r.mudShown || 0) - r.mud) > 0.02) {
        r.mudShown = r.mud;
        m.root.traverse(o => { if (o.isMesh && o.userData.c0) o.material.color.copy(o.userData.c0).lerp(mudC, r.mud * 0.75); });
      }
    }
    // The instructor faces the course; the fans dance.
    if (this.madag) { Scene3D.animateSoldier(this.madag, { x: 7.2 / S3, y: -(this.len + 1) / S3, angle: Math.PI / 2 + 0.4, speed: 0, dancing: this.done }, false, dt); }
    for (const f of this.fans) Scene3D.animateSoldier(f.m, { x: f.x / S3, y: -f.z / S3, angle: f.x > 0 ? Math.PI : 0, speed: 0, dancing: this.started }, false, dt);
    for (const f of this.fx) {
      f.t += dt;
      if (f.v) { f.v.y -= (f.spin ? 0 : 9) * dt; f.m.position.addScaledVector(f.v, dt); }
      if (f.spin) { f.m.rotation.x += f.spin * dt; f.m.rotation.y += f.spin * 0.6 * dt; }
      if (f.rise) f.m.position.y += dt * 1.4;
      if (f.m.material && f.m.material.opacity !== undefined && !f.spin) { f.m.material.transparent = true; f.m.material.opacity = Math.max(0, 1 - f.t / f.life); }
    }
    this.fx = this.fx.filter(f => { if (f.t < f.life) return true; this.scene.remove(f.m); return false; });
    this.follow(dt);
  },
  // The camera: close behind your own soldier and a little above, the next obstacle ahead; it
  // lifts and pulls back for the wall and the bars so the climb reads, and goes wide for the
  // 3-2-1 and once you're over the line.
  follow(dt) {
    const me = this.me, cam = this.camera;
    if (!me) return;
    const wide = !this.started || this.done || (me.fin && this.t > me.fin + 1.2);
    const pos = this.camWant || (this.camWant = new THREE.Vector3()), look = this.camAt || (this.camAt = new THREE.Vector3(0, 1, -10));
    const tgt = new THREE.Vector3();
    let k;
    if (!this.started) { pos.set(0, 5.4, 9); tgt.set(0, 0.8, -10); k = dt * 3; }
    // Over the line: pulled back and up behind you, through the arch: the instructor, the
    // confetti and whoever's in already.
    else if (wide) { pos.set(me.x * 0.5, 4.6, -me.z + 8.5); tgt.set(me.x * 0.3, 1.0, -me.z - 5); k = dt * 2.5; }
    else {
      const lift = (this.camLift = (this.camLift || 0) + (((me.mode === 'climb' && me.ph !== 'drop') || me.mode === 'bars' ? 1 : 0) - (this.camLift || 0)) * Math.min(1, dt * 3));
      this.camY = (this.camY == null ? 0 : this.camY) + ((me.mode === 'climb' || me.ry > 1 ? me.ry : me.ry * 0.8) - (this.camY || 0)) * Math.min(1, dt * 4);
      const back = 4.1 + lift * 1.5, up = 2.0 + lift * 1.0;
      pos.set(me.x * 0.85, this.camY + up, -me.z + back);
      tgt.set(me.x * 0.9, this.camY + 0.9 + lift * 0.8, -me.z - 6 + lift * 2.5);
      k = dt * 5;
    }
    this.camClear(pos, me);
    // Along the course it keeps up tightly (no lag at a sprint); up, down and sideways, softly.
    const kz = wide ? k : dt * 10;
    cam.position.x += (pos.x - cam.position.x) * Math.min(1, k); cam.position.y += (pos.y - cam.position.y) * Math.min(1, k); cam.position.z += (pos.z - cam.position.z) * Math.min(1, kz);
    this.camClear(cam.position, me);
    look.lerp(tgt, Math.min(1, k));
    if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake * 0.5; G.shake = Math.max(0, G.shake - dt); }
    cam.lookAt(look);
    if (me.tag) me.tag.visible = !!wide;
    this.sun.position.set(me.x + 12, 30, -me.z + 14); this.sun.target.position.set(me.x, 0, -me.z - 6);
  },
  // Keeps the camera out of the course: over a wall you've already crossed (or are on top of),
  // over the monkey bars, over the slide's steps and ramp.
  camClear(p, me) {
    const cz = -p.z;
    for (const q of this.sections) {
      if (q.type === 'wall') { const f = q.z0 + 1.85; if (me.z > f - 0.25 && me.ph !== 'grab' && me.ph !== 'up' && cz < f + 0.7 && cz > f - 6) p.y = Math.max(p.y, OBST_WALL_H * (me.sc || 1) + 1.1); }
      else if (q.type === 'bars' && cz > q.z0 - 0.4 && cz < q.z1 + 0.4) p.y = Math.max(p.y, OBST_BAR_Y * (me.sc || 1) + 0.6);
      else if (q.type === 'net' && cz > q.z0 - 0.4 && cz < q.z1 + 0.4) p.y = Math.max(p.y, OBST_NET_Y * (me.sc || 1) + 0.8);
      else if (q.type === 'slide') {
        // Up on the steps or on the ramp: stay over your head, so the steps behind don't fill the view.
        if (me.z > q.z0 && me.z < q.z1) p.y = Math.max(p.y, (me.rootY || 0) + 1.8);
        if (cz < q.z0 - 0.4 || cz > q.z1) continue;
        const L = q.z1 - q.z0, u = cz - q.z0, h = u < 4 ? 3.2 * Math.min(1, (u + 0.8) / 4) : 3.2 * Math.max(0, 1 - (u - 4) / (L - 6));
        p.y = Math.max(p.y, h + 1.2);
      }
    }
  },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="ob"><div class="ob-time ar-chip">0.0</div><div class="ob-bar"><i></i></div><div class="ob-hint"></div><div class="ob-mash hidden"><b></b></div><div class="ob-bal hidden"><i></i></div><div class="ob-tip hidden"></div></div>`);
    const h = $('#arcade .ob');
    this.el = { time: h.querySelector('.ob-time'), bar: h.querySelector('.ob-bar'), hint: h.querySelector('.ob-hint'), mash: h.querySelector('.ob-mash'), mashB: h.querySelector('.ob-mash b'), bal: h.querySelector('.ob-bal'), balI: h.querySelector('.ob-bal i'), tip: h.querySelector('.ob-tip') };
    // How the beam's balance works, under its meter: on a phone the joystick (left/right), on a
    // keyboard A/D or the arrows. Leaning one way, push the other (the meter shows the lean).
    this.el.tip.innerHTML = G.touch
      ? '<span class="ob-ico">🕹️</span><b>⬅️➡️</b><span>נוטים לצד? ג׳ויסטיק לצד השני</span>'
      : '<span class="ob-keys"><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd></span><span>נוטים לצד? לחצו לצד השני</span>';
    // Everyone's progress as dots on a bar.
    this.el.bar.innerHTML = this.rs.map((r, i) => `<span class="${r.isMe ? 'me' : ''}" data-i="${i}"></span>`).join('') + this.sections.map(s => `<em style="right:${(s.z0 / this.len * 100).toFixed(1)}%"></em>`).join('');
  },
  hud() {
    const e = this.el, me = this.me;
    if (!e || !me) return;
    const tt = me.fin || this.t;
    e.time.textContent = `⏱️ ${tt.toFixed(1)}`;
    e.bar.querySelectorAll('span').forEach(sp => { const r = this.rs[+sp.dataset.i]; sp.style.right = `${Math.min(100, r.z / this.len * 100)}%`; });
    const s = this.sectionAt(me.z + 2.5), over = me.ph === 'top' || me.ph === 'drop' || me.ph === 'off' || me.ph === 'fall', type = me.mode === 'climb' ? (over ? '' : 'climbing') : me.mode === 'bars' ? (over ? '' : 'barring') : s ? s.type : '';
    const hh = (G.touch ? OBST_HINTS.touch : OBST_HINTS.keys)[type] || '';
    if (e.hint.textContent !== fmt(hh)) { e.hint.textContent = fmt(hh); e.hint.classList.remove('pop'); void e.hint.offsetWidth; e.hint.classList.add('pop'); }
    e.mash.classList.toggle('hidden', me.mode !== 'climb' || me.ph === 'top' || me.ph === 'drop');
    if (me.mode === 'climb') e.mashB.style.width = `${Math.round(me.climb * 100)}%`;
    const onBeam = s && s.type === 'beam' && me.z > s.z0 && me.z < s.z1;
    e.bal.classList.toggle('hidden', !onBeam);
    // The marker sits on the side the body leans to (bal > 0 tips the soldier to the screen's left).
    if (onBeam) e.balI.style.left = `${50 - me.bal * 48}%`;
    // The tip: the first seconds on the beam, and again whenever the lean gets big.
    if (onBeam && Math.abs(me.bal) > 0.55) this.tipUntil = Math.max(this.tipUntil || 0, this.t + 2.2);
    const tipOn = onBeam && ((me.beamAt && this.t - me.beamAt.t < 3.2) || this.t < (this.tipUntil || 0));
    if (e.tip.classList.contains('hidden') === tipOn) e.tip.classList.toggle('hidden', !tipOn);
    if (!onBeam) this.tipUntil = 0;
  },
  finish() {
    this.done = true;
    this.resultsAt = performance.now() + 2600;
  },
  results() {
    const rows = [...this.rs].sort((a, b) => (a.fin && b.fin ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : b.z - a.z)).map(r => ({ name: r.name, value: r.fin ? `${r.fin.toFixed(1)} ש'` : `${Math.round(r.z)}/${Math.round(this.len)} מ'`, me: r.isMe }));
    const best = (G.state.obstacleBest = G.state.obstacleBest || 0);
    const nb = this.me.fin && (!best || this.me.fin < best);
    if (nb) G.state.obstacleBest = this.me.fin;
    // On a phone held sideways the table and the buttons need the room more than the picture.
    Arcade.buttons({ act: false, run: false });
    Arcade.results(`🏃‍♂️ מסלול המכשולים של ${fmt('{@madag}')}`, rows, { sub: `${nb ? '⏱️ שיא חדש! ' : best ? `השיא שלך: ${best.toFixed(1)} ש' · ` : ''}${fmt(pick(this.me.fin ? OBST_LINES.finish : OBST_LINES.dnf))}`, img: innerHeight < 500 ? null : 'assets/arcade/win_obstacle.jpg' });
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  // Where you're drawn (root z / y, hands on the bar included), your progress-related state,
  // and the clip you're in (a: name, t: time, r: its pace) so the others play the same move.
  presence() {
    const r = this.me, R2 = (x) => Math.round(x * 100) / 100;
    if (!r) return null;
    const y = r.mode === 'fallen' ? r.ry : (r.rootY != null ? r.rootY : r.ry);
    return { z: R2(r.rz != null ? r.rz : r.z), y: R2(y), v: Math.round(r.v * 10) / 10, m: r.mode, c: r.crawl ? 1 : 0, sl: r.sliding ? 1 : 0, mud: Math.round(r.mud * 10) / 10, b: Math.round(r.bal * 10) / 10, fin: r.fin ? Math.round(r.fin * 10) / 10 : 0, a: r.ak || 0, t: R2(r.at || 0), r: Math.round((r.ar || 0) * 10) / 10 };
  },
  act() {},
  leave() {
    // Left during the 3-2-1: drop the countdown, so it can't go off in the next game.
    if (Arcade.cdGo) { Arcade.cdAt = null; Arcade.cdGo = null; }
    this.unbindCrawl();
    this.clear(); this.el = null; this.ribbonCut = false; this.done = false; this.started = false; this.resultsAt = null;
  },
};
Arcade.register(ObstacleGame);
