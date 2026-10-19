// "Escape from the inspector" (בורחים מ{@inspector}): an endless runner in the style of
// Subway Surfers. It opens on a cinematic: the night guard post, you nodding off, a
// flashlight in your face, and the platoon's cleaning-inspection queen standing over you.
// Then you run: three lanes between the battery's containers, jumping crates and sandbags,
// sliding under barriers and {@p_nevo}'s laundry line, dodging dumpsters, containers (with
// ramps to run along their roofs) and the shuttle van coming the other way. She chases you
// the whole way; trip twice and she's got you. Shekel coins, and power-ups on the ground:
// נעלי מד"ס (speed, and nothing stops you), {@p_ofek}'s energy drink (you fly), a magnet, a
// helmet (one free hit), double coins and spring boots.
// Alone it's for the high score; online everyone runs the same course (from the shared seed)
// and sees the others as ghosts in their lanes.
// The cinematic's stills, the cover and the item icons are from Higgsfield; the ones that
// show the real inspector travel encrypted with the cast (Assets.scene('run_insp' | 'run_chase')).

const RUN_LANES = [-2.3, 0, 2.3];
const RUN_TRIP = 6;   // seconds a stumble counts: a second one in that time and she's got you
const RUN_ROLL = 0.75;   // seconds a slide lasts: one forward roll
const RUN_DAWN_T = 72;   // seconds of running from night to full daylight
// The sunrise, by how far along it is (0 night … 1 day): the sky's three rings (zenith,
// a band over the horizon, the horizon itself, which the fog takes too), the hemisphere
// light, the sun's light, how far the lamps are still on, the stars, and the sun's height.
const RUN_DAWN = [
  { k: 0.00, zen: 0x0b1024, mid: 0x0f1733, hor: 0x161e3e, hs: 0x5d6aa8, hg: 0x2a2018, hi: 0.70, sc: 0xbcc8ff, si: 0.55, lamp: 1, stars: 1, sunY: -45, sunO: 0 },
  { k: 0.12, zen: 0x0f1a3e, mid: 0x1c2452, hor: 0x3a2d52, hs: 0x7a86c2, hg: 0x3a2e20, hi: 1.00, sc: 0xc8ccf0, si: 0.70, lamp: 1, stars: 0.85, sunY: -32, sunO: 0 },
  { k: 0.30, zen: 0x1c2f6c, mid: 0x6b3f7a, hor: 0xd8703a, hs: 0x9099c8, hg: 0x4e3c2a, hi: 1.10, sc: 0xffc39a, si: 0.80, lamp: 0.75, stars: 0.35, sunY: -9, sunO: 0.7 },
  { k: 0.55, zen: 0x4878c8, mid: 0xe89a7a, hor: 0xffb270, hs: 0xa9c1e8, hg: 0x7a6248, hi: 1.15, sc: 0xffdcb0, si: 1.05, lamp: 0.2, stars: 0, sunY: 16, sunO: 1 },
  { k: 0.80, zen: 0x5c98e0, mid: 0xb9cde6, hor: 0xf2d4aa, hs: 0xbfd8f4, hg: 0x8f7a5c, hi: 1.20, sc: 0xfff0d8, si: 1.15, lamp: 0, stars: 0, sunY: 42, sunO: 1 },
  { k: 1.00, zen: 0x5aa2ec, mid: 0xa8cbe8, hor: 0xdde8ee, hs: 0xcfe4ff, hg: 0x9a8468, hi: 1.25, sc: 0xfff6e8, si: 1.20, lamp: 0, stars: 0, sunY: 72, sunO: 0.9 },
];
// The tuck. The back and head bend forward (turns in radians about the body's left-right
// axis, on top of the run pose); each limb is aimed outright, in the body's own frame
// (forward, up, out to its side), so it comes out the same whatever stride the run was in:
// knees to the chest, heels to the seat, arms round the shins.
// (Our models name the spine Spine02 / Spine01 / Spine and the neck "neck"; Mixamo ones,
// Spine / Spine1 / Spine2 and "Neck". Whatever a model doesn't have is skipped.)
const RUN_TUCK = [
  ['Spine02', -0.3], ['Spine01', -0.3], ['Spine', -0.25], ['Spine1', -0.3], ['Spine2', -0.3],
  ['neck', -0.25], ['Neck', -0.25], ['Head', -0.35],
];
const RUN_LOW = ['Head', 'Hips', 'Spine', 'Spine01', 'Spine1', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot', 'LeftArm', 'RightArm'];
const RUN_AIM = [
  ['UpLeg', 'Leg', 0.55, 0.83, 0.12], ['Leg', 'Foot', -0.45, -0.89, 0.05],
  ['Arm', 'ForeArm', 0.5, -0.8, 0.25], ['ForeArm', 'Hand', 0.35, -0.94, -0.35],
];
const RUN_POWERS = {
  shoes: { icon: 'assets/arcade/run_sneakers.png', name: 'נעלי מד"ס', dur: 7, say: '{@madag}: "נעלי מד״ס! עכשיו את[ה/] טס[/ה]!"' },
  fly: { icon: 'assets/arcade/run_energy.png', name: 'פחית אנרגיה', dur: 6.5, say: '{@p_ofek}: "הפחית שלי!!! ...טוב, תשאיר[/י] לי חצי."' },
  magnet: { icon: 'assets/arcade/run_magnet.png', name: 'מגנט', dur: 10, say: '{@rasap}: "כל השקלים אלייך. ...תחתמ[/י] עליהם אחר כך."' },
  helmet: { icon: 'assets/arcade/run_helmet.png', name: 'קסדה', dur: 0, say: '{@harasar}: "קסדה! סוף סוף מישהו בתלבושת מלאה."' },
  x2: { icon: 'assets/arcade/run_x2.png', name: 'כפול מטבעות', dur: 15, say: '{@bc}: "כפול! אני מעדכנת את האקסל."' },
  spring: { icon: 'assets/arcade/run_spring.png', name: 'מגפי קפיץ', dur: 10, say: '{@p_liran}: "אוגה! קופץ גבוה כמו מיירט!"' },
};
const RUN_LINES = {
  chase: ['{name}!!! לעצור!!!', 'ישנת בשמירה?! ישנת בשמירה!!!', 'אני רואה אבק על הנעליים שלך מפה!', 'מסדר ניקיון! על כל הבסיס! עכשיו!', 'את[ה/] לא בורח[/ת] ממני! אף אחד לא בורח ממני!', 'יש לי פנס ויש לי זמן!'],
  trip: ['חחח! כמעט!', 'עוד מעידה אחת — ואת[ה/] שלי!', 'אני מתקרבת...'],
  caught: ['תפסתי!!! מסדר ניקיון. על כל הבסיס. עם מברשת שיניים.', 'ישנת בשמירה, ועכשיו גם רצת. שתי עבירות. שבועיים ריתוק.', 'נו באמת. חשבת שתברח[/י] ממני?'],
  coins: ['{@sergeant}: "יאללה מלכים! עוד שקל ועוד שקל!"', '{@p_miriam}: "חיים שלי, זה כסף לרוגלך!"'],
  near: ['{@p_hila}: "היא מאחוריך!!! רוץ[/י]!!!"', '{@friend}: "תקפוץ! תקפוץ!"'],
};

const RunnerGame = {
  id: 'runner', name: 'בורחים מ{@inspector}', icon: '🏃',
  desc: 'נרדמת בשמירה — ו{@inspector} תפסה אותך עם פנס. לרוץ! לקפוץ, להחליק, לאסוף שקלים ונעלי מד"ס.',
  cover: 'assets/arcade/cover_runner.jpg', solo: true, online: true, minOnline: 2,

  // ---------- the world ----------
  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x0b1024);
    sc.fog = new THREE.Fog(0x161e3e, 30, 120);
    this.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 400);
    this.hemi = new THREE.HemisphereLight(0x5d6aa8, 0x2a2018, 0.7);
    sc.add(this.hemi);
    // The moon's light, which turns into the sun's as the morning comes.
    const sun = this.sunLight = new THREE.DirectionalLight(0xbcc8ff, 0.55);
    sun.position.set(-10, 30, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 20, bottom: -20, near: 1, far: 80 });
    sc.add(sun, sun.target);
    // The sky: a dome of three colour rings (the horizon, a band over it, the zenith) that
    // the sunrise repaints each frame — far cheaper than a sky shader on a phone.
    const dg = new THREE.CylinderGeometry(330, 330, 260, 32, 10, true);
    dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dg.attributes.position.count * 3), 3));
    this.dome = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.dome.position.y = 90;   // from 40 m under the horizon to 220 m over it
    this.dome.renderOrder = -1;
    sc.add(this.dome);
    // Each vertex's height over the horizon (0 … 1) and how much it faces the sunrise, once.
    const dp = dg.attributes.position;
    this.domeV = [];
    for (let i = 0; i < dp.count; i++) {
      const x = dp.getX(i), y = dp.getY(i) + 90, z = dp.getZ(i), r = Math.hypot(x, z) || 1;
      this.domeV.push({ e: Math.max(0, Math.atan2(y - 3, r)) / (Math.PI / 2), f: Math.max(0, (-z / r) * 0.92 + (x / r) * 0.12) });
    }
    // The stars and the moon, which fade out; the sun, which comes up ahead.
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 700; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.1, r = 300; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true }));
    sc.add(this.stars);
    const moonM = this.moonM = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, transparent: true }));
    moonM.position.set(-80, 120, -260); this.stars.add(moonM);
    this.glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const glow = (s, c, o) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: c, opacity: o, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); m.scale.set(s, s, 1); m.renderOrder = -1; return m; };
    // The sun: a wide warm haze and a bright core, coming up ahead and a little to the right.
    this.sun = new THREE.Group();
    this.sunHaze = glow(170, 0xff8a50, 0.55); this.sunCore = glow(34, 0xfff0c0, 1);
    this.sun.add(this.sunHaze, this.sunCore);
    this.sun.position.set(40, -45, -280); this.sun.visible = false;
    this.stars.add(this.sun);
    this.dawn = {};
    for (const n of ['zen', 'mid', 'hor', 'hs', 'hg', 'sc']) this.dawn[n] = new THREE.Color();
    this.tmpC = new THREE.Color(); this.tmpC2 = new THREE.Color();
    this.lampK = 1;
    // Shared pieces.
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    this.mat = {
      sand: new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg'), color: 0x9a8a70, roughness: 1 }),
      path: new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/asphalt.jpg'), color: 0x8a8a8a, roughness: 0.95 }),
      crate: M(0x4f5d32), stripe: M(0xd8261f), white: M(0xf2f2f2), post: M(0x777777, { metalness: 0.5 }),
      lamp: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), rope: new THREE.LineBasicMaterial({ color: 0xdddddd }),
      sock: [M(0xf2f2f2), M(0x2f7fe0), M(0xd8261f), M(0x222222)], cont: M(0x56653a, { metalness: 0.2 }), ramp: M(0x6a6a5a, { metalness: 0.4 }),
      gold: new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    };
    this.mat.sand.map.wrapS = this.mat.sand.map.wrapT = THREE.RepeatWrapping; this.mat.sand.map.repeat.set(6, 30);
    this.mat.path.map.wrapS = this.mat.path.map.wrapT = THREE.RepeatWrapping; this.mat.path.map.repeat.set(2, 20);
    this.geo = { crate: new THREE.BoxGeometry(1.5, 0.9, 1.1), lampPole: new THREE.CylinderGeometry(0.08, 0.1, 5, 6), lampHead: new THREE.BoxGeometry(0.6, 0.25, 0.3), coin: new THREE.CylinderGeometry(0.42, 0.42, 0.1, 22), bit: new THREE.BoxGeometry(0.2, 0.2, 0.2) };
    const face = new THREE.TextureLoader().load('assets/race/coin.png'); face.encoding = THREE.sRGBEncoding;
    const fm = new THREE.MeshStandardMaterial({ map: face, metalness: 0.55, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.7, transparent: true });
    this.coinMats = [new THREE.MeshStandardMaterial({ color: 0xd9a92e, metalness: 0.8, roughness: 0.3, emissive: 0x4a3400 }), fm, fm];
    // The ammo-crate stencil.
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d'); g.fillStyle = '#4f5d32'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#3a4524'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 120);
    g.fillStyle = '#e8dcb0'; g.font = '900 40px Rubik, Arial'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('תחמושת', 128, 80);
    this.mat.crateFace = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.8 });
    this.iconTex = {};
    for (const k in RUN_POWERS) { const t = new THREE.TextureLoader().load(RUN_POWERS[k].icon); t.encoding = THREE.sRGBEncoding; this.iconTex[k] = t; }
  },

  // ---------- a run ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    Arcade.loadModels(['arc_sandbags', 'arc_dumpster', 'car_van']).then(() => { this.modelsIn = true; this.upgrade(); });
    this.rnd = Arcade.rng(ctx.seed);
    this.chunks = []; this.obs = []; this.coins = []; this.powers = []; this.segs = [];
    this.genZ = 0; this.nextItemAt = 90 + this.rnd() * 50; this.laneBusy = [0, 0, 0]; this.lastVanZ = -99;
    this.p = { lane: 1, x: 0, y: 0, vy: 0, z: 0, slide: 0, rollT: 0, ground: 0, dead: false, trips: 0, tripT: 0 };
    this.d = 0; this.prevD = 0; this.speed = 10; this.coinsGot = 0; this.score = 0; this.power = {}; this.helmet = false; this.grace = 0;
    // Night again: the time run so far drives the sunrise.
    this.runT = 0; this.day = -1;
    this.chaser = { gap: 6, z: 6 };
    this.lineT = 4; this.t = 0; this.fovKick = 0;
    // A rematch starts clean: the opening's one-time beats, the camera, the bits in the air.
    this.shout = this.goNow = false; this.look = null; this.inspX = null; this.flyCam = 0; this.bestSaid = false; G.shake = 0;
    for (const b of this.bits || []) this.scene.remove(b.m);
    this.bits = [];
    for (const u of this.puffs || []) this.scene.remove(u.s);
    this.puffs = [];
    this.stage = 'intro';
    this.me = Arcade.soldier(this.scene, Arcade.look(null));
    this.insp = Arcade.soldier(this.scene, Arcade.look('inspector'));
    // Her flashlight: a real spot light, and a cone of dusty light in front of her.
    const fl = this.flash = new THREE.SpotLight(0xfff2d0, 2.2, 30, 0.45, 0.5, 1.2);
    // (A soldier's model faces its local +x.)
    fl.position.set(0.3, 1.4, 0.3); this.insp.root.add(fl); this.insp.root.add(fl.target);
    fl.target.position.set(10, 0, 0);
    const beam = this.beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.z = Math.PI / 2; beam.position.set(4.8, 1.2, 0.3); this.insp.root.add(beam);
    this.sky(0);
    this.ghosts = new Map();
    for (let i = 0; i < 4; i++) this.genChunk();
    this.ui();
    this.bind();
    Arcade.buttons({ act: false, run: false });
    document.body.classList.add('rn-on');
    this.intro();
  },
  clear() {
    for (const c of this.chunks || []) { this.scene.remove(c.g); }
    for (const o of [...(this.obs || []), ...(this.coins || []), ...(this.powers || [])]) if (o.m) this.scene.remove(o.m);
    if (this.me) this.scene.remove(this.me.root);
    if (this.insp) this.scene.remove(this.insp.root);
    for (const g of (this.ghosts || new Map()).values()) this.scene.remove(g.m.root);
    if (this.booth) { this.scene.remove(this.booth); this.booth = null; }
    for (const k of ['zzz', 'wake']) if (this[k]) { this.scene.remove(this[k]); this[k] = null; }
    if (this.bub && this.insp) this.insp.root.remove(this.bub);
    this.bub = null;
    this.chunks = []; this.obs = []; this.coins = []; this.powers = [];
  },

  // The opening: stills from Higgsfield, then the same moment in 3D, then run.
  async intro() {
    const real = Assets.scene('run_insp'), chase = Assets.scene('run_chase');
    this.booth = this.makeBooth();
    this.stage = 'cine'; this.cineT = 0;
    if (!this.ctx.solo) { this.cineT = 6.5; return; }
    // A rematch goes straight to the booth: you've seen the stills.
    if (this.seenIntro) return;
    this.seenIntro = true;
    this.inCut = true;
    await UI.cutscene([
      { img: 'assets/arcade/run_booth.jpg', who: '', text: '02:47. שמירה בש"ג. שקט. רק הזמזום של הפנס, והג\'וק שעושה סיבובים מסביבו. העיניים נעצמות... רק לשנייה...' },
      { img: 'assets/arcade/run_sleep.jpg', who: '', text: 'זזזז... חלום על שחרור, על שווארמה, על מיטה אמיתית... ופתאום — אור לבן בפרצוף.' },
      { img: real || 'assets/arcade/run_booth.jpg', who: '{@@inspector}', text: 'ישנת. בשמירה. בשמירה שלי. ...{name}, יש לך שלוש שניות.' },
      { img: chase || 'assets/arcade/cover_runner.jpg', who: '', text: 'שלוש שניות זה הרבה זמן. [רוץ/רוצי]!!! ⬅️ ➡️ להחליף נתיב · ⬆️ לקפוץ · ⬇️ להחליק. בטלפון — להחליק עם האצבע.' },
    ]);
    this.inCut = false;
  },
  makeBooth() {
    // The guard booth the run starts from, a few meters behind the start line, and a chair.
    const g = new THREE.Group(), wall = new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/wall.jpg'), color: 0xd8c49a, roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.15), wall); back.position.set(0, 1.3, 1.2); g.add(back);
    for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 2.4), wall); s.position.set(sx * 1.2, 1.3, 0); g.add(s); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 2.8), wall); roof.position.y = 2.65; g.add(roof);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), this.mat.lamp); bulb.position.set(0, 2.45, 0); g.add(bulb);
    const lt = new THREE.PointLight(0xffd890, 1.2, 9); lt.position.set(0, 2.3, 0); g.add(lt);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), this.mat.white); chair.position.set(0, 0.45, 0.4); g.add(chair);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(0, 0, 4);
    this.scene.add(g);
    this.zzz = Scene3D.label('💤 זזז...', { bg: 'rgba(30,40,80,.85)', size: 0.6 }); this.zzz.position.set(0, 2.1, 4.3); this.scene.add(this.zzz);
    return g;
  },

  // ---------- the course ----------
  // 30 m at a time: the ground, the battery on both sides, and a few rows of obstacles.
  genChunk() {
    const z0 = this.genZ, L = 30, rnd = this.rnd, g = new THREE.Group(), lamps = [];
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, L), this.mat.sand); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.01, -(z0 + L / 2)); ground.receiveShadow = true; g.add(ground);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(7.6, L), this.mat.path); path.rotation.x = -Math.PI / 2; path.position.set(0, 0, -(z0 + L / 2)); path.receiveShadow = true; g.add(path);
    // The battery: containers, sandbags, lamps, a launcher now and then.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const z = -(z0 + 4 + k * 15 + rnd() * 4), kind = rnd();
        if (kind < 0.55) { const c = Assets.model('container', { size: [2.6, 2.6, 6.2] }); if (c) { c.rotation.y = 0; c.position.set(side * (7 + rnd() * 1.5), 0, z); g.add(c); } }
        else if (kind < 0.8 && Assets.has('arc_sandbags')) { const s = Assets.model('arc_sandbags', { length: 4 }); s.position.set(side * 5.6, 0, z); s.rotation.y = Math.PI / 2; g.add(s); }
        else if (kind < 0.9 && Assets.has('launcher')) { const l = Assets.model('launcher', { depth: 7 }); l.position.set(side * 12, 0, z); l.rotation.y = side * 0.4; g.add(l); }
        else if (Assets.has('palm')) { const p = Assets.model('palm', { height: 7 + rnd() * 3 }); p.position.set(side * 8, 0, z); g.add(p); }
      }
      // A lamp post with warm light every chunk, alternating sides.
      if ((Math.round(z0 / 30) % 2 === 0) === (side > 0)) {
        const pole = new THREE.Mesh(this.geo.lampPole, this.mat.post); pole.position.set(side * 4.6, 2.5, -(z0 + 15)); g.add(pole);
        const head = new THREE.Mesh(this.geo.lampHead, this.mat.lamp); head.position.set(side * 4.2, 5, -(z0 + 15)); g.add(head);
        // On at night, off by day (sky() dims them with the sunrise).
        const lt = new THREE.PointLight(0xffd890, 1.4 * this.lampK, 18, 1.6); lt.position.set(side * 3.6, 4.6, -(z0 + 15)); g.add(lt); lamps.push(lt);
      }
    }
    this.scene.add(g);
    this.chunks.push({ g, z0, L, lamps });
    // Rows of obstacles, never all three lanes shut; coins in the open lanes.
    if (z0 >= 30) {
      const gap = Math.max(11, 17 - this.d / 250);
      for (let z = z0 + 4; z < z0 + L - 2; z += gap + rnd() * 5) this.row(z);
    }
    this.genZ += L;
  },
  // A row never leaves you without a way through: a lane still taken by a container from an
  // earlier row counts as blocked, and when every lane has something in it, at most one of
  // them is a wall (the rest you jump or slide).
  row(z) {
    const rnd = this.rnd, kinds = [], SIDE = ['dumpster', 'container', 'van'];
    const busy = [0, 1, 2].filter(l => this.laneBusy[l] > z - 6);
    const open = [0, 1, 2].filter(l => !busy.includes(l));
    const n = Math.min(open.length, rnd() < 0.35 ? 1 : rnd() < 0.8 ? 2 : 3);
    const lanes = open.sort(() => rnd() - 0.5).slice(0, n);
    const maxSide = busy.length + n >= 3 ? 1 : 2;
    let side = busy.length;
    for (const l of lanes) {
      let k = ['crate', 'bags', 'barrier', 'laundry', 'dumpster', 'container', 'van'][Math.floor(rnd() * 7)];
      if (k === 'van' && (z < 300 || !this.vanOk(l, z))) k = 'dumpster';
      if (SIDE.includes(k) && side + 1 > maxSide) k = rnd() < 0.5 ? 'crate' : 'barrier';
      if (SIDE.includes(k)) side++;
      kinds.push([l, k]);
      this.obstacle(l, z, k);
    }
    // Coins in a free lane (or over a jumpable thing, in an arc).
    const free = open.filter(l => !lanes.includes(l));
    const lane = free.length ? free[Math.floor(rnd() * free.length)] : kinds.find(([, k]) => k === 'crate' || k === 'bags')?.[0];
    if (lane != null && rnd() < 0.75) {
      const over = !free.includes(lane);
      for (let i = 0; i < 6; i++) this.coin(lane, z - 5 + i * 2, over ? 1 + Math.sin(i / 5 * Math.PI) * 1.6 : 1);
    }
    if (z > this.nextItemAt && free.length) {
      this.nextItemAt = z + 130 + rnd() * 110;
      const keys = Object.keys(RUN_POWERS);
      this.powerUp(free[0], z + 8, keys[Math.floor(rnd() * keys.length)]);
    }
  },
  // The van drives at you for its last ~35 m: its lane there must be empty, and the other two
  // lanes must never both be walls at the same spot.
  vanOk(l, z) {
    if (z - this.lastVanZ < 50) return false;
    const a = z - 40, b = z + 3, near = this.segs.filter(g => g.z1 > a - 2 && g.z0 < b);
    if (near.some(g => g.lane === l)) return false;
    const walls = near.filter(g => g.side);
    return !walls.some(g => walls.some(h => h.lane !== g.lane && h.z0 < g.z1 + 2 && g.z0 < h.z1 + 2));
  },
  obstacle(lane, z, kind) {
    const x = RUN_LANES[lane], g = new THREE.Group(), M = this.mat;
    let o = { lane, z, kind, w: 1.6, h: 1, len: 1.2, m: g };
    if (kind === 'crate') {
      const c = new THREE.Mesh(this.geo.crate, [M.crate, M.crate, M.crate, M.crate, M.crateFace, M.crateFace]); c.position.y = 0.45; g.add(c);
      o.h = 0.9; o.act = 'jump';
    } else if (kind === 'bags') {
      const s = Assets.has('arc_sandbags') ? Assets.model('arc_sandbags', { length: 2 }) : null;
      if (s) { s.rotation.y = 0; g.add(s); } else { const b = o.fb = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0xb8a070 })); b.position.y = 0.4; g.add(b); }
      o.h = 0.9; o.act = 'jump';
    } else if (kind === 'barrier') {
      // A red-and-white boom at chest height: slide under it.
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.5, 0.15), M.post); p.position.set(sx * 0.95, 0.75, 0); g.add(p); }
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.22, 0.12), i % 2 ? M.white : M.stripe); b.position.set(-0.83 + i * 0.33, 1.3, 0); g.add(b); }
      o.y0 = 1.05; o.h = 1.5; o.act = 'slide'; o.len = 0.4;
    } else if (kind === 'laundry') {
      // {@p_nevo}'s socks on a line: also slide under.
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), M.post); p.position.set(sx * 1.05, 0.8, 0); g.add(p); }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.05, 1.5, 0), new THREE.Vector3(0, 1.38, 0), new THREE.Vector3(1.05, 1.5, 0)]), M.rope));
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.05), M.sock[i % 4]); s.position.set(-0.8 + i * 0.4, 1.2, 0); s.rotation.z = (Math.random() - 0.5) * 0.4; g.add(s); }
      const tag = Scene3D.label('🧦', { bg: 'rgba(0,0,0,0)', size: 0.5 }); tag.position.y = 1.85; g.add(tag);
      o.y0 = 1.05; o.h = 1.6; o.act = 'slide'; o.len = 0.3;
    } else if (kind === 'dumpster') {
      const d = Assets.has('arc_dumpster') ? Assets.model('arc_dumpster', { length: 1.9, rotY: Math.PI / 2 }) : null;
      if (d) g.add(d); else { const b = o.fb = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x2f5f3f })); b.position.y = 0.8; g.add(b); }
      o.h = 1.7; o.len = 1.6; o.act = 'side';
    } else if (kind === 'container') {
      // A container across the lane, a ramp in front of some: run up and along the roof.
      const c = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.6, 12), M.cont); c.position.set(0, 1.3, -6); c.castShadow = c.receiveShadow = true; g.add(c);
      for (let i = 0; i < 12; i++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(2.34, 2.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x48552f })); rib.position.set(0, 1.3, -0.5 - i); g.add(rib); }
      o.h = 2.6; o.len = 12; o.top = 2.6; o.act = 'side'; o.zc = -6;
      if (this.rnd() < 0.55) {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 6), M.ramp);
        ramp.rotation.x = Math.atan2(2.6, 6); ramp.position.set(0, 1.3, 2.9); g.add(ramp);
        o.ramp = 6;
      }
    } else if (kind === 'van') {
      const v = Assets.has('car_van') ? Assets.model('car_van', { length: 5.6, rotY: Math.PI }) : null;
      if (v) g.add(v); else { const b = o.fb = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 5.4), new THREE.MeshStandardMaterial({ color: 0xe8e3d3 })); b.position.y = 1; g.add(b); }
      for (const sx of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); h.position.set(sx, 0.9, 2.75); g.add(h); }
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.8, 10, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.9, 7.8); g.add(beam);
      o.h = 2.3; o.len = 5.6; o.act = 'side'; o.move = 9; o.zc = 0;
    }
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    g.position.set(x, 0, -z);
    this.scene.add(g);
    this.obs.push(o);
    // What the course planner remembers: where each thing stands, and how long a lane stays taken.
    const z0 = o.top ? z - (o.ramp || 0) : z - o.len / 2, z1 = o.top ? z + o.len : z + o.len / 2;
    this.segs.push({ lane, z0, z1, side: o.act === 'side' });
    if (this.segs.length > 80) this.segs.shift();
    if (o.top) this.laneBusy[lane] = Math.max(this.laneBusy[lane], z1);
    if (kind === 'van') this.lastVanZ = z;
  },
  // The first stretch is laid out before the models have loaded: their stand-in boxes get
  // the real sandbags, dumpster and van as soon as they're in.
  upgrade() {
    const MODEL = { bags: ['arc_sandbags', { length: 2 }], dumpster: ['arc_dumpster', { length: 1.9, rotY: Math.PI / 2 }], van: ['car_van', { length: 5.6, rotY: Math.PI }] };
    for (const o of this.obs || []) {
      if (!o.fb || !MODEL[o.kind] || !Assets.has(MODEL[o.kind][0])) continue;
      const m = Assets.model(...MODEL[o.kind]);
      if (!m) continue;
      if (o.kind === 'bags') m.rotation.y = 0;
      m.traverse(x => { if (x.isMesh) { x.castShadow = true; if (o.done) x.visible = false; } });
      o.m.remove(o.fb); o.m.add(m); o.fb = null;
    }
  },
  coin(lane, z, y) {
    const m = new THREE.Mesh(this.geo.coin, this.coinMats);
    m.rotation.x = Math.PI / 2;
    m.position.set(RUN_LANES[lane], y, -z);
    this.scene.add(m);
    this.coins.push({ lane, z, y, m });
  },
  powerUp(lane, z, kind) {
    const g = new THREE.Group();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.iconTex[kind], transparent: true })); s.scale.set(1.3, 1.3, 1); g.add(s);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffe08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); glow.scale.setScalar(2.6); g.add(glow);
    g.position.set(RUN_LANES[lane], 1.3, -z);
    this.scene.add(g);
    this.powers.push({ lane, z, kind, m: g });
  },

  // ---------- input ----------
  // Swipes (a finger or the mouse): the move fires as soon as the finger has gone far enough,
  // not when it lifts, so it feels instant; a tap is a jump.
  bind() {
    this.keysWas = new Set();
    const swipe = (dx, dy) => {
      if (Math.abs(dx) > Math.abs(dy)) this.cmd(dx > 0 ? 'right' : 'left');
      else this.cmd(dy < 0 ? 'jump' : 'slide');
    };
    this.onDown = (e) => { if (e.target.closest('button, .ar-panel, #screen')) return; this.sw = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false }; };
    this.onMove = (e) => {
      const s = this.sw;
      if (!s || s.id !== e.pointerId || s.fired) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.hypot(dx, dy) >= 28) { s.fired = true; swipe(dx, dy); }
    };
    this.onUp = (e) => {
      const s = this.sw;
      if (!s || s.id !== e.pointerId) return;
      this.sw = null;
      if (s.fired) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.hypot(dx, dy) < 18) this.cmd('jump'); else swipe(dx, dy);
    };
    this.onCancel = () => { this.sw = null; };
    addEventListener('pointerdown', this.onDown);
    addEventListener('pointermove', this.onMove);
    addEventListener('pointerup', this.onUp);
    addEventListener('pointercancel', this.onCancel);
  },
  unbind() { removeEventListener('pointerdown', this.onDown); removeEventListener('pointermove', this.onMove); removeEventListener('pointerup', this.onUp); removeEventListener('pointercancel', this.onCancel); },
  keys() {
    const k = G.keys, now = new Set();
    const map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'slide', KeyS: 'slide' };
    for (const code in map) if (k.has(code)) { now.add(code); if (!this.keysWas.has(code)) this.cmd(map[code]); }
    this.keysWas = now;
  },
  // The lanes are seen from behind: "right" on the screen is +x.
  cmd(c) {
    if (this.stage !== 'run') return;
    const p = this.p;
    if (c === 'left' && p.lane > 0) { p.lane--; this.whoosh(); }
    else if (c === 'right' && p.lane < 2) { p.lane++; this.whoosh(); }
    else if (c === 'jump' && p.y <= p.ground + 0.05 && !this.power.fly) { p.vy = this.power.spring ? 16.5 : 10.5; p.slide = 0; Sound.synth.tone(380, 0.12, 'triangle', 0.06, 760); }
    else if (c === 'slide') {
      // A forward roll. Asked again mid-roll: finish this turn, then one more.
      if (p.slide > 0) p.slide = RUN_ROLL - (p.rollT % RUN_ROLL) + RUN_ROLL;
      else { p.slide = RUN_ROLL; p.rollT = 0; if (p.y <= p.ground + 0.1) this.puff(p.x, p.y, p.z); }
      if (p.y > p.ground + 0.1) p.vy = Math.min(p.vy, -14);
      Sound.synth.noise(0.25, 0.08, 1200, 'bandpass');
    }
  },
  whoosh() { Sound.synth.noise(0.12, 0.05, 2200, 'bandpass'); },

  // ---------- each frame ----------
  update(dt) {
    this.t += dt;
    this.keys();
    if (this.stage === 'cine') this.updateCine(dt);
    else if (this.stage === 'run') this.updateRun(dt);
    else if (this.stage === 'caught') this.updateCaught(dt);
    this.animate(dt);
    this.hud();
    if (this.stage === 'over' && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  // The 3D part of the opening: asleep in the booth, her flashlight, the jump, the run.
  updateCine(dt) {
    if (UI.busy) return;
    this.cineT += dt;
    const t = this.cineT, p = this.p;
    // She walks in from the dark to the booth's open front and shines it in your face.
    if (t < 1.6) { const k = t / 1.6; this.inspAt = { x: -4 + k * 3.3, z: 1.6 + k * 0.7 }; }
    else this.inspAt = { x: -0.7, z: 2.3 };
    if (t > 1.7 && !this.shout) { this.shout = true; Arcade.say(fmt('{@inspector}: "{name}!!! ישנת בשמירה?!"'), null, 2400); Sound.whistle(); this.zzz.visible = false; this.wake = Scene3D.label('❗', { bg: 'rgba(216,38,31,.95)', size: 0.8 }); this.wake.position.set(0, 2.3, 4.3); this.scene.add(this.wake); }
    if (t > 2.9 && !this.goNow) {
      this.goNow = true;
      if (this.wake) { this.scene.remove(this.wake); this.wake = null; }
      Arcade.big('רוץ!!!', 900);
      // Out of the booth in a cloud of dust; the booth stays behind, out of the camera's way.
      if (this.booth) { this.scene.remove(this.booth); this.booth = null; }
      for (let i = 0; i < 10; i++) this.debris((Math.random() - 0.5) * 2, 0.4, 4 + (Math.random() - 0.5) * 2);
      Sound.music('boss');
      this.stage = 'run'; p.z = 3.4;
    }
  },
  updateRun(dt) {
    const p = this.p;
    // Faster and faster; the sneakers and the energy drink go faster still.
    this.speed = Math.min(22, 10 + this.d / 110) * (this.power.shoes ? 1.35 : 1) * (this.power.fly ? 1.2 : 1);
    p.z -= this.speed * dt;
    this.prevD = this.d;
    this.d = Math.max(0, -p.z);
    this.grace = Math.max(0, this.grace - dt);
    this.fovKick = Math.max(0, this.fovKick - dt * 12);
    for (const k in this.power) {
      if (this.power[k] > 0) {
        this.power[k] -= dt;
        if (this.power[k] <= 0) {
          delete this.power[k];
          Sound.synth.tone(700, 0.25, 'triangle', 0.05, 240);
          // Coming down from the energy drink (or out of the sneakers' rush): a moment to land.
          if (k === 'fly') { p.vy = 0; this.grace = 1.6; }
          if (k === 'shoes') this.grace = 0.8;
        }
      }
    }
    // Sideways: glide toward the lane.
    p.x += (RUN_LANES[p.lane] - p.x) * Math.min(1, dt * 14);
    // What's under the feet: the ground, a container roof, a ramp.
    p.ground = this.groundAt(p.x, -p.z);
    if (this.power.fly) { p.y += (6 - p.y) * Math.min(1, dt * 3); p.vy = 0; }
    else {
      p.vy -= 32 * dt; p.y += p.vy * dt;
      if (p.y <= p.ground) { if (p.vy < -6) Sound.step(); p.y = p.ground; p.vy = 0; }
    }
    p.slide = Math.max(0, p.slide - dt);
    p.rollT = p.slide > 0 ? p.rollT + dt : 0;
    this.runT += dt;
    this.sky(this.runT / RUN_DAWN_T);
    // The van drives at you.
    for (const o of this.obs) if (o.move && Math.abs(o.z - this.d) < 70) { o.z -= o.move * dt; o.m.position.z = -o.z; }
    this.hits();
    this.collect(dt);
    // The chase: she's a few meters back and closes in after each trip.
    p.tripT = Math.max(0, p.tripT - dt);
    if (p.tripT <= 0 && p.trips) p.trips = 0;
    const want = p.trips ? 2.8 : this.power.shoes || this.power.fly ? 14 : 8;
    this.chaser.gap += (want - this.chaser.gap) * Math.min(1, dt * (p.trips ? 3 : 0.4));
    // Off to one side, so when she's right on you she doesn't hide you from the camera.
    const side = p.lane === 2 ? -1.3 : 1.3;
    this.inspX = (this.inspX == null ? p.x : this.inspX) + (p.x + side - (this.inspX == null ? p.x : this.inspX)) * Math.min(1, dt * 4);
    this.inspAt = { x: this.inspX, z: p.z + this.chaser.gap };
    // She's behind the camera most of the time, so her shouting comes as a line on the screen;
    // when she's right on you, over her head.
    this.lineT -= dt;
    if (this.lineT <= 0) { this.lineT = 6 + Math.random() * 5; const l = pick(RUN_LINES.chase); if (p.trips) this.bubble(fmt(l)); else Arcade.say(l, 'inspector', 2200); }
    const best = G.state.runnerBest || 0;
    if (!this.bestSaid && best > 200 && this.score > best) { this.bestSaid = true; Arcade.big('🏆 שיא!', 1000); Sound.ding(); }
    // New ground ahead, old behind.
    while (this.genZ < this.d + 150) this.genChunk();
    while (this.chunks.length && this.chunks[0].z0 + this.chunks[0].L < this.d - 25) this.scene.remove(this.chunks.shift().g);
    const behind = (o) => o.z + (o.len || 1) < this.d - 15;
    this.obs = this.obs.filter(o => { if (behind(o)) { this.scene.remove(o.m); return false; } return true; });
    this.coins = this.coins.filter(c => { if (c.z < this.d - 10) { this.scene.remove(c.m); return false; } return true; });
    this.powers = this.powers.filter(c => { if (c.z < this.d - 10) { this.scene.remove(c.m); return false; } return true; });
    this.score = Math.floor(this.d) + this.coinsGot * 10;
  },
  // A container roof (and the ramp up to it) is ground too.
  groundAt(x, d) {
    let g = 0;
    for (const o of this.obs) {
      if (!o.top || Math.abs(RUN_LANES[o.lane] - x) > 1.1) continue;
      const front = o.z, back = o.z + o.len;
      if (d >= front && d <= back) g = Math.max(g, o.top);
      else if (o.ramp && d >= front - o.ramp && d < front) g = Math.max(g, o.top * (1 - (front - d) / o.ramp));
    }
    return g;
  },
  hits() {
    const p = this.p, d = this.d, d0 = this.prevD, sliding = p.slide > 0, top = sliding ? 0.8 : 1.75;
    const safe = this.power.shoes || this.power.fly || this.grace > 0;
    for (const o of this.obs) {
      if (o.done || o.ignore > this.t || o.lane !== p.lane && Math.abs(RUN_LANES[o.lane] - p.x) > 1.3) continue;
      const z0 = o.top ? o.z : o.z - o.len / 2, z1 = o.top ? o.z + o.len : o.z + o.len / 2;
      // Swept: at full speed on a slow phone one frame can be longer than a barrier is thick.
      if (d < z0 - 0.3 || d0 > z1 + 0.3) continue;
      const y0 = o.y0 || 0, y1 = o.top || o.h;
      // Standing on a roof is fine; running into its end isn't.
      if (o.top && p.y >= o.top - 0.35) continue;
      if (o.top && o.ramp && p.y >= p.ground - 0.1 && p.ground > 0.2) continue;
      if (p.y >= y1 - 0.05 || p.y + top <= y0) continue;
      // Sideways into something while changing lanes: bounced back to your lane, a stumble.
      if (Math.abs(RUN_LANES[o.lane] - p.x) > 0.7) { if (!safe) this.trip(o, true); continue; }
      if (safe) { o.done = true; this.smash(o); continue; }
      if (this.helmet) { this.helmet = false; o.done = true; this.smash(o); this.bubble('הקסדה הצילה אותך!', true); Sound.ding(); continue; }
      // Something low or a line to duck: you knock it over and stumble. A wall: she's got you.
      if (o.act === 'jump' || o.act === 'slide') { this.trip(o, false); if (this.stage !== 'run') return; continue; }
      this.caught(o);
      return;
    }
  },
  // A stumble: she closes right in. A second one before you've got away — caught.
  trip(o, sideways) {
    const p = this.p;
    o.ignore = this.t + 0.6;
    if (p.trips && p.tripT > 0) { this.caught(o); return; }
    p.trips = 1; p.tripT = RUN_TRIP;
    Sound.bump(); Sound.whistle(); G.shake = 0.5;
    if (sideways) {
      // Back to the lane you came from.
      p.lane = RUN_LANES.indexOf(RUN_LANES.reduce((a, b) => Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
      if (p.lane === o.lane) p.lane = o.lane + (p.x > RUN_LANES[o.lane] ? 1 : -1);
    } else { o.done = true; this.smash(o, true); }
    this.bubble(fmt(pick(RUN_LINES.trip)));
    Arcade.say(fmt(pick(RUN_LINES.near)), null, 1800);
  },
  smash(o, quiet = false) {
    if (!quiet) { Sound.splat(); G.shake = Math.max(G.shake, 0.25); }
    o.m.traverse(m => { if (m.isMesh || m.isSprite || m.isLine) m.visible = false; });
    for (let i = 0; i < 8; i++) this.debris(o.m.position.x, 0.8, o.m.position.z);
  },
  debris(x, y, z, mat = this.mat.crate) {
    const m = new THREE.Mesh(this.geo.bit, mat);
    m.position.set(x, y, z); this.scene.add(m);
    (this.bits = this.bits || []).push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 8, 5 + Math.random() * 5, (Math.random() - 0.5) * 8), t: 0 });
  },
  // A little cloud of dust where a roll starts, left behind as you go.
  puff(x, y, z) {
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this.dustCol || 0xb8a47c, transparent: true, opacity: 0.5, depthWrite: false }));
      s.position.set(x + (Math.random() - 0.5) * 0.9, y + 0.15 + Math.random() * 0.3, z - 0.3 + (Math.random() - 0.5) * 0.8);
      this.scene.add(s);
      this.puffs.push({ s, t: 0, life: 0.45 + Math.random() * 0.25, r: 0.8 + Math.random() * 0.6, v: new THREE.Vector3((Math.random() - 0.5) * 3, 0.5 + Math.random(), -this.speed * 0.5 + Math.random() * 2) });
    }
  },
  // The sunrise at k (0 night … 1 day): the sky, the fog, the two lights, the lamps and her
  // flashlight going out, the stars fading and the sun coming up. Only colours and numbers,
  // and one small buffer of sky colours — nothing a phone would feel.
  sky(k) {
    k = Math.max(0, Math.min(1, k));
    if (this.day >= 0 && Math.abs(k - this.day) < 0.003 && (k < 1 || this.day === 1)) return;
    this.day = k;
    let i = 0;
    while (i < RUN_DAWN.length - 2 && k > RUN_DAWN[i + 1].k) i++;
    const A = RUN_DAWN[i], Bk = RUN_DAWN[i + 1], f = Math.min(1, (k - A.k) / (Bk.k - A.k));
    const D = this.dawn, n = (key) => A[key] + (Bk[key] - A[key]) * f;
    for (const c of ['zen', 'mid', 'hor', 'hs', 'hg', 'sc']) D[c].setHex(A[c]).lerp(this.tmpC.setHex(Bk[c]), f);
    // The glow over the horizon ahead, strongest while the sun is coming up.
    const glowK = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (k - 0.14) / 0.72)))) * 0.85;
    const glowC = this.tmpC2.setHex(0xff8c4a);
    const col = this.dome.geometry.attributes.color, V = this.domeV, c = this.tmpC;
    for (let j = 0; j < V.length; j++) {
      const { e, f: face } = V[j];
      if (e < 0.07) c.copy(D.hor).lerp(D.mid, e / 0.07);
      else c.copy(D.mid).lerp(D.zen, Math.min(1, (e - 0.07) / 0.38));
      const g = glowK * face * face * face * Math.max(0, 1 - e / 0.22);
      if (g > 0) c.lerp(glowC, Math.min(1, g));
      // (The keys are sRGB, like any colour picker; the renderer wants linear.)
      c.convertSRGBToLinear();
      col.setXYZ(j, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    // The fog is the horizon ahead, so the far end of the track melts into the sky.
    const fog = this.scene.fog.color.copy(D.hor).lerp(glowC, Math.min(1, glowK * 0.78));
    this.scene.background.copy(fog);   // the clear colour isn't converted: it stays sRGB
    fog.convertSRGBToLinear();
    this.scene.fog.near = 30 + k * 15; this.scene.fog.far = 120 + k * 40;
    this.hemi.color.copy(D.hs); this.hemi.groundColor.copy(D.hg); this.hemi.intensity = n('hi');
    this.sunLight.color.copy(D.sc); this.sunLight.intensity = n('si');
    // Moonlight from high behind on the left; sunlight from ahead on the right, climbing.
    const sw = Math.min(1, Math.max(0, (k - 0.25) / 0.35));
    this.lightOff = this.lightOff || new THREE.Vector3();
    this.lightOff.set(-10 + 32 * sw, 30 - 16 * sw + 22 * sw * k, 10 - 32 * sw + 14 * sw * k);
    // The lamps (and the lamp heads' glow) go off, the flashlight stops mattering.
    const lamp = this.lampK = n('lamp');
    for (const ch of this.chunks || []) for (const lt of ch.lamps || []) lt.intensity = 1.4 * lamp;
    this.mat.lamp.color.setHex(0x8f8c84).lerp(this.tmpC.setHex(0xffe2a0), lamp);
    if (this.flash) { this.flash.intensity = 2.2 * (0.3 + 0.7 * lamp); this.beam.material.opacity = 0.05 * lamp; }
    const st = n('stars');
    this.stars.material.opacity = st; this.moonM.material.opacity = st; this.moonM.visible = st > 0.01;
    // The sun: low, big and orange, then up, smaller-looking and white.
    const so = n('sunO');
    this.sun.visible = so > 0.01;
    this.sun.position.y = n('sunY');
    this.sunCore.material.opacity = so; this.sunHaze.material.opacity = 0.55 * so * (1 - 0.5 * k);
    this.sunCore.material.color.setHex(0xffa860).lerp(this.tmpC.setHex(0xfff8e8), Math.min(1, k * 1.4));
    this.sunHaze.material.color.setHex(0xff6a30).lerp(this.tmpC.setHex(0xffe6b8), k);
    // Dust looks like dust in the light it's in.
    this.dustCol = this.tmpC.setHex(0x4a4a58).lerp(this.tmpC2.setHex(0xd2bd92), Math.min(1, k * 1.6)).getHex();
  },
  collect(dt) {
    const p = this.p, mag = this.power.magnet;
    for (const c of this.coins) {
      if (c.got) continue;
      const dz = c.z - this.d, dx = c.m.position.x - p.x, dy = c.y - (p.y + 0.9);
      if (mag && Math.abs(dz) < 14 && dz > -1) {
        // The magnet pulls them in.
        c.m.position.x -= dx * Math.min(1, dt * 8); c.y -= dy * Math.min(1, dt * 8); c.z -= dz * Math.min(1, dt * 6);
        c.m.position.y = c.y; c.m.position.z = -c.z;
      }
      if (Math.abs(dz) < 0.9 && Math.abs(dx) < 0.9 && Math.abs(dy) < 1.2) {
        c.got = true; this.scene.remove(c.m);
        this.coinsGot += this.power.x2 ? 2 : 1;
        Sound.synth.tone(1320 + (this.coinsGot % 5) * 90, 0.06, 'square', 0.04);
        if (this.coinsGot % 50 === 0) Arcade.say(fmt(pick(RUN_LINES.coins)), null, 2000);
      }
    }
    for (const u of this.powers) {
      if (u.got || Math.abs(u.z - this.d) > 1.2 || Math.abs(RUN_LANES[u.lane] - p.x) > 1 || Math.abs(1.3 - (p.y + 0.9)) > 1.6) continue;
      u.got = true; this.scene.remove(u.m);
      const P = RUN_POWERS[u.kind];
      if (u.kind === 'helmet') this.helmet = true; else this.power[u.kind] = P.dur;
      if (u.kind === 'fly') { p.vy = 0; this.skyCoins(); }
      Sound.fanfare(); Sound.boost();
      this.fovKick = 14; G.shake = Math.max(G.shake, 0.2);
      for (let i = 0; i < 14; i++) this.debris(p.x, p.y + 1, p.z - 1, this.mat.gold);
      Arcade.big(P.name, 1100);
      Arcade.say(fmt(P.say), null, 2600);
    }
  },
  // Up on the energy drink: a trail of shekels in the air, weaving between the lanes.
  skyCoins() {
    const len = RUN_POWERS.fly.dur * this.speed * 1.2 - 14;
    let lane = this.p.lane;
    for (let i = 0, z = this.d + 14; z < this.d + len; i++, z += 2.4) {
      if (i && i % 7 === 0) lane = Math.max(0, Math.min(2, lane + (this.rnd() < 0.5 ? -1 : 1)));
      this.coin(lane, z, 6.8);
    }
  },
  bubble(text, good = false) {
    if (this.bub) this.insp.root.remove(this.bub);
    this.bub = Scene3D.label(text, { bg: good ? 'rgba(125,255,106,.95)' : 'rgba(255,248,230,.97)', fg: '#3a1a0a', size: 0.55 });
    this.bub.position.y = 2.4;
    this.insp.root.add(this.bub);
    clearTimeout(this.bubT);
    this.bubT = setTimeout(() => { if (this.bub) { this.insp.root.remove(this.bub); this.bub = null; } }, 2600);
  },
  // Got you: she grabs your collar, the camera comes around, and that's the run.
  caught(o) {
    this.stage = 'caught'; this.caughtT = 0;
    Sound.bump(); Sound.bad(); G.shake = 0.8;
    this.p.vy = 0;
    Arcade.big('נתפסת!', 1600);
    this.bubble(fmt(pick(RUN_LINES.caught)));
    Sound.music('tension');
  },
  updateCaught(dt) {
    this.caughtT += dt;
    const p = this.p;
    this.chaser.gap += (0.9 - this.chaser.gap) * Math.min(1, dt * 4);
    this.inspAt = { x: p.x + 0.5, z: p.z + this.chaser.gap };
    if (this.caughtT > 2.6 && this.stage !== 'over') {
      this.stage = 'over';
      const best = (G.state.runnerBest = G.state.runnerBest || 0);
      this.newBest = this.score > best;
      if (this.newBest) G.state.runnerBest = this.score;
      this.resultsAt = performance.now() + (this.ctx.solo ? 600 : 2500);
    }
  },

  animate(dt) {
    const p = this.p, t = this.t, me = this.me, run = this.stage === 'run';
    // You: asleep on the chair, then running, jumping, sliding, flying.
    if (this.stage === 'cine' && this.cineT < 2.9) {
      // Asleep on the chair, the head nodding; bolt upright at her shout.
      Scene3D.animateSoldier(me, { x: 0, y: 4.3 / S3, angle: -Math.PI / 2, speed: 0, sit: true }, false, dt);
      me.root.rotation.x = this.shout ? -0.05 : 0.12 + Math.sin(t * 1.5) * 0.05;
    } else {
      const sp = run ? this.speed : 0;
      // Mid-roll the run cycle holds still (the tuck goes on top of it).
      const rolling = me.roll && me.roll.a < 0;
      this.untuck(me);
      Arcade.pose(me, p.x, p.z, -Math.PI / 2, run ? Math.min(9, sp) : 0, rolling ? 0 : dt);
      me.root.position.y = p.y;
      me.root.rotation.x = this.power.fly ? -0.6 : this.stage === 'caught' ? 0.3 : 0;
      this.roll(me, dt);
      this.blob(me);
    }
    me.root.visible = !((p.tripT > RUN_TRIP - 1.5 || this.grace > 0) && Math.floor(t * 12) % 2);
    // Her: walking up to the booth, then running behind you with the flashlight.
    const ia = this.inspAt || { x: -4, z: 1.6 };
    const irun = this.stage === 'run' || (this.stage === 'caught' && this.caughtT < 0.8);
    const cine = this.stage === 'cine' && this.cineT < 2.9;
    Arcade.pose(this.insp, ia.x, ia.z, cine ? (this.cineT < 1.6 ? 0.3 : Math.PI / 2 - 0.25) : -Math.PI / 2, irun ? 8.5 : cine && this.cineT < 1.6 ? 2.2 : 0, dt);
    this.zzz && (this.zzz.position.y = 2.1 + Math.sin(t * 2) * 0.1);
    // Bits flying off smashed things.
    for (const b of this.bits || []) { b.t += dt; b.v.y -= 20 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 9; }
    this.bits = (this.bits || []).filter(b => { if (b.t > 1.2) { this.scene.remove(b.m); return false; } return true; });
    for (const c of this.coins) c.m.rotation.z = t * 4;
    for (const u of this.powers) u.m.position.y = 1.3 + Math.sin(t * 3 + u.z) * 0.2;
    // Friends' ghosts in their own lanes.
    for (const o of Arcade.others()) {
      if (!o.s) continue;
      let gh = this.ghosts.get(o.peer);
      if (!gh) { gh = { m: Arcade.soldier(this.scene, Arcade.look(Cast.get(o.who) ? o.who : null)) }; gh.m.root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.45; } }); const tag = Scene3D.label(o.name, { size: 0.5 }); tag.position.y = 2.3; gh.m.root.add(tag); this.ghosts.set(o.peer, gh); }
      gh.x = (gh.x == null ? o.s.x : gh.x + (o.s.x - gh.x) * Math.min(1, dt * 8));
      Arcade.pose(gh.m, gh.x, -o.s.d, -Math.PI / 2, o.s.dead ? 0 : 8, dt);
      gh.m.root.position.y = o.s.y || 0;
    }
    // The camera: behind and above, swinging in from the booth at the start.
    const cam = this.camera;
    let want, look;
    if (this.stage === 'cine' && this.cineT < 2.9) { const a = 0.42 - this.cineT * 0.12; want = new THREE.Vector3(Math.sin(a) * 4.6, 1.9 + this.cineT * 0.15, 4.3 - Math.cos(a) * 4.6); look = new THREE.Vector3(0, 1.0, 4.3); }
    else if (this.stage === 'caught' || this.stage === 'over') { want = new THREE.Vector3(p.x + 4, p.y + 2.4, p.z - 4); look = new THREE.Vector3(p.x, p.y + 1.1, p.z + 0.5); }
    else {
      // Up on the energy drink the camera goes up with you, so you see the shekels in the air.
      const f = this.flyCam = (this.flyCam || 0) + ((this.power.fly ? 1 : 0) - (this.flyCam || 0)) * Math.min(1, dt * 2.5);
      want = new THREE.Vector3(p.x * 0.7, p.y * (0.6 + f * 0.4) + 3.4 - f * 1, p.z + 6.2); look = new THREE.Vector3(p.x * 0.85, p.y * (0.5 + f * 0.45) + 1.2, p.z - 6);
    }
    cam.position.lerp(want, Math.min(1, dt * (this.stage === 'run' ? 8 : 3)));
    this.look = this.look || look.clone();
    this.look.lerp(look, Math.min(1, dt * 8));
    if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake * 0.4; cam.position.y += (Math.random() - 0.5) * G.shake * 0.4; G.shake = Math.max(0, G.shake - dt * 1.5); }
    cam.lookAt(this.look);
    cam.fov = 64 + (this.power.shoes ? 8 : 0) + Math.min(8, (this.speed - 10) * 0.6) + this.fovKick;
    cam.updateProjectionMatrix();
    // The light comes from the moon, high behind on the left, then from the sun, low ahead.
    const o = this.lightOff;
    this.sunLight.position.set(p.x + o.x, o.y, p.z + o.z); this.sunLight.target.position.set(p.x, 0, p.z - 6);
    this.stars.position.set(0, 0, p.z);
    this.dome.position.z = p.z;
    for (const u of this.puffs) { u.t += dt; const k = u.t / u.life; u.s.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - dt * 3); u.s.scale.setScalar(u.r * (0.5 + k * 1.4)); u.s.material.opacity = 0.55 * (1 - k) * (1 - k); }
    this.puffs = this.puffs.filter(u => { if (u.t >= u.life) { this.scene.remove(u.s); u.s.material.dispose(); return false; } return true; });
  },

  // The slide is a forward roll: you tuck into a ball (knees to the chest, arms round the
  // shins, chin down) and turn once around your middle while still running forward. Cut short
  // by a jump, the turn finishes in the air — a flip.
  roll(me, dt) {
    const p = this.p, R = me.roll = me.roll || { a: 0, w: 0 }, TAU = Math.PI * 2;
    let left;   // how much of the turn is still to go (radians)
    if (p.slide > 0 && this.stage === 'run') { R.a = -TAU * (p.rollT / RUN_ROLL); left = TAU * p.slide / RUN_ROLL; }
    else if (R.a < 0) {
      const end = -TAU * Math.ceil(-R.a / TAU - 1e-4);
      R.a -= dt * TAU / RUN_ROLL * 1.2;
      left = R.a - end;
      if (R.a <= end) { R.a = 0; left = 0; }
    } else left = 0;
    // Tucked while turning; opening up for the last bit of it, to land on your feet.
    const want = R.a < 0 && left > 0.9 ? 1 : 0;
    R.w += (want - R.w) * Math.min(1, dt * (want ? 22 : 9));
    if (R.w < 0.01 && R.a === 0) { R.w = 0; return; }
    const w = R.w, root = me.root;
    if (me.rigged && me.mixer) this.tuck(me, w);
    // Turn around the middle of the ball, which rolls on the ground (or wherever you are):
    // from the hips standing to the tucked body's own centre, w of the way.
    if (me.hipY == null) me.hipY = 0.95;
    const s = root.scale.y, bc = me.ballC || { x: 0.1, y: 0.55 }, br = me.ballR || 0.5;
    const cx = bc.x * w * s, cy = (me.hipY + (bc.y - me.hipY) * w) * s, h = (me.hipY + (br - me.hipY) * w) * s;
    root.rotation.x = R.a;
    const c = this.tmpV || (this.tmpV = new THREE.Vector3());
    c.set(cx, cy, 0).applyEuler(root.rotation);
    root.position.y = p.y + h - c.y;
    root.position.z = p.z - c.z;
    // Then exactly on the ground: whatever's lowest right now (head, back, seat, boots) just
    // touches it, so the ball neither sinks nor floats as it turns.
    const B = me.tuckB;
    if (B && w > 0.02) {
      root.updateMatrixWorld(true);
      let low = Infinity;
      for (const n of RUN_LOW) if (B[n]) low = Math.min(low, B[n].getWorldPosition(c).y);
      if (low < Infinity) root.position.y += (p.y + 0.11 * s - low) * w;
    }
  },
  // The soft shadow stays on the ground under you (it's part of the model, so it would ride
  // up with a jump and turn over with a roll), a little smaller the higher you are.
  blob(me) {
    const b = me.blob === undefined ? (me.blob = me.root.children.find(o => o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry') || null) : me.blob;
    if (!b) return;
    const p = this.p, r = me.root, V = this.tv2 || (this.tv2 = { v: new THREE.Vector3(), q: new THREE.Quaternion(), flat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2) });
    r.updateMatrixWorld(true);
    b.position.copy(r.worldToLocal(V.v.set(p.x, p.ground + 0.03, p.z)));
    b.quaternion.copy(r.getWorldQuaternion(V.q).invert().multiply(V.flat));
    b.scale.setScalar(Math.max(0.45, 1 - (p.y - p.ground) * 0.12) / (r.scale.y || 1));
  },
  // Knees up, heels in, back rounded, head down, arms wrapped round the shins — w of the way.
  tuck(me, w) {
    if (!me.tuckB) {
      const B = {};
      me.root.traverse(o => { if (o.isBone && !B[o.name]) B[o.name] = o; });
      me.tuckB = B;
      // The hips' height standing, to turn the ball around its middle.
      const r = me.root, ry = r.position.y, rx = r.rotation.x;
      r.position.y = 0; r.rotation.x = 0; r.updateMatrixWorld(true);
      if (B.Hips) me.hipY = B.Hips.getWorldPosition(new THREE.Vector3()).y / (r.scale.y || 1);
      r.position.y = ry; r.rotation.x = rx;
    }
    const B = me.tuckB, Q = THREE.Quaternion;
    const q = this.tq || (this.tq = { d: new Q(), b: new Q(), p: new Q(), axis: new THREE.Vector3() });
    // The body's own left-right axis: turning round it moves things forward or back.
    q.axis.set(1, 0, 0);
    me.root.updateMatrixWorld(true);
    const turn = (name, a) => {
      const bone = B[name];
      if (!bone || !bone.parent) return;
      q.d.setFromAxisAngle(q.axis, a * w);
      bone.getWorldQuaternion(q.b); bone.parent.getWorldQuaternion(q.p);
      bone.quaternion.copy(q.p.invert().multiply(q.d.multiply(q.b)));
      bone.updateMatrixWorld(true);
    };
    // Kept, to put back before the next frame's pose: with the run cycle held still the mixer
    // doesn't rewrite a bone it thinks hasn't changed, and the tuck would pile up.
    const save = me.tuckSave || (me.tuckSave = []);
    save.length = 0;
    for (const [n] of RUN_TUCK) if (B[n]) save.push([B[n], B[n].quaternion.clone()]);
    for (const side of ['Left', 'Right']) for (const [n] of RUN_AIM) if (B[side + n]) save.push([B[side + n], B[side + n].quaternion.clone()]);
    for (const [n, a] of RUN_TUCK) turn(n, a);
    // The limbs: from where the run had them to where the tuck wants them, w of the way.
    const V = this.tv || (this.tv = { a: new THREE.Vector3(), b: new THREE.Vector3(), want: new THREE.Vector3(), rq: new Q(), id: new Q() });
    me.root.getWorldQuaternion(V.rq);
    const hips = B.Hips && B.Hips.getWorldPosition(new THREE.Vector3());
    for (const side of ['Left', 'Right']) {
      // Which way is out to this side, in the body's frame (its +z or -z).
      const sh = B[side + 'UpLeg'];
      if (!sh || !hips) continue;
      const out = Math.sign(sh.getWorldPosition(V.a).sub(hips).applyQuaternion(V.rq.clone().invert()).z) || (side === 'Left' ? 1 : -1);
      for (const [n, c, fx, fy, fz] of RUN_AIM) {
        const bone = B[side + n], kid = B[side + c];
        if (!bone || !kid || !bone.parent) continue;
        bone.getWorldPosition(V.a); kid.getWorldPosition(V.b);
        const cur = V.b.sub(V.a).normalize();
        V.want.set(fx, fy, fz * out).normalize().applyQuaternion(V.rq);
        q.d.setFromUnitVectors(cur, V.want);
        q.d.slerp(V.id, 1 - w);
        bone.getWorldQuaternion(q.b); bone.parent.getWorldQuaternion(q.p);
        bone.quaternion.copy(q.p.invert().multiply(q.d.multiply(q.b)));
        bone.updateMatrixWorld(true);
      }
    }
    // Fully tucked the first time: where the ball's middle is (in the model's own frame,
    // forward and up) and how big it is, from the head, hips, knees, feet and hands.
    if (w > 0.98 && !me.ballC) {
      const pts = ['Head', 'Hips', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot', 'LeftHand', 'RightHand', 'Spine'].filter(n => B[n]).map(n => me.root.worldToLocal(B[n].getWorldPosition(new THREE.Vector3())));
      if (pts.length >= 5) {
        const c = pts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
        // The lowest point when the ball is upright, plus a little for the boots' soles.
        me.ballC = { x: c.x, y: c.y };
        me.ballR = Math.max(0.35, Math.min(0.7, pts.reduce((m, v) => Math.max(m, Math.hypot(v.x - c.x, v.y - c.y)), 0) * 0.8 + 0.06));
      }
    }
  },
  untuck(me) {
    if (!me.tuckSave || !me.tuckSave.length) return;
    for (const [bone, q] of me.tuckSave) bone.quaternion.copy(q);
    me.tuckSave.length = 0;
  },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="rn">
      <div class="rn-score ar-chip"><b class="rn-d">0</b><small>מ'</small></div>
      <div class="rn-coins ar-chip">🪙 <b>0</b></div>
      <div class="rn-pw"></div>
      <div class="rn-board"></div>
      <div class="rn-danger hidden"></div></div>`);
    const h = $('#arcade .rn');
    this.el = { root: h, d: h.querySelector('.rn-d'), coins: h.querySelector('.rn-coins b'), pw: h.querySelector('.rn-pw'), board: h.querySelector('.rn-board'), danger: h.querySelector('.rn-danger') };
  },
  hud() {
    const e = this.el;
    if (!e) return;
    e.d.textContent = Math.floor(this.d);
    e.coins.textContent = this.coinsGot;
    // The power-ups you have: built when the set changes, the time left filled in each frame.
    const ks = Object.keys(this.power), set = ks.join() + (this.helmet ? ',helmet' : '');
    if (e.pwSet !== set) {
      e.pwSet = set;
      e.pw.innerHTML = [...ks, ...(this.helmet ? ['helmet'] : [])].map(k => `<span data-k="${k}"><img src="${RUN_POWERS[k].icon}" alt=""><i></i></span>`).join('');
    }
    for (const sp of e.pw.children) {
      const k = sp.dataset.k;
      if (k === 'helmet' || this.power[k] == null) continue;
      sp.lastChild.style.setProperty('--p', `${Math.max(0, Math.round(this.power[k] / RUN_POWERS[k].dur * 100))}%`);
      sp.classList.toggle('end', this.power[k] < 1.6);
    }
    e.danger.classList.toggle('hidden', !(this.p.trips && this.stage === 'run'));
    e.root.classList.toggle('over', this.stage === 'over' || (this.stage === 'cine' && UI.busy));
    const rows = Arcade.others().map(o => ({ name: o.name, d: (o.s && o.s.d) || 0, dead: o.s && o.s.dead }));
    if (rows.length) {
      rows.push({ name: G.profile.name, d: Math.floor(this.d), me: true });
      rows.sort((a, b) => b.d - a.d);
      const html = rows.map(r => `<div class="${r.me ? 'me' : ''}${r.dead ? ' dead' : ''}"><bdi data-raw>${esc(r.name)}</bdi><b>${r.d}מ'</b></div>`).join('');
      if (e.board.innerHTML !== html) e.board.innerHTML = html;
    }
  },
  results() {
    const me = { name: G.profile.name, value: `${this.score} נק' · ${Math.floor(this.d)}מ' · 🪙${this.coinsGot}`, me: true, n: this.score };
    const rows = this.ctx.solo ? [me] : [...Arcade.others().map(o => ({ name: o.name, value: `${(o.s && o.s.sc) || 0} נק' · ${(o.s && o.s.d) || 0}מ'`, n: (o.s && o.s.sc) || 0 })), me];
    rows.sort((a, b) => b.n - a.n);
    const prize = Math.floor(this.coinsGot / 5) + (rows[0] === me && rows.length > 1 ? 10 : 0);
    const sub = `${this.newBest ? '🏆 שיא חדש! ' : `השיא שלך: ${G.state.runnerBest || 0} · `}${fmt('{@inspector}')}: "${fmt(pick(['בפעם הבאה — לא לישון בשמירה.', 'את[ה/] מהיר[/ה]. אבל אני עקשנית.', 'מסדר ניקיון בעוד עשר דקות. גם לך.']))}"`;
    Arcade.results('🏃 בורחים מ' + fmt('{@inspector}'), rows, { sub, img: 'assets/arcade/cover_runner.jpg', prize });
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  presence() { return { d: Math.floor(this.d), sc: this.score, x: Math.round(this.p.x * 10) / 10, y: Math.round(this.p.y * 10) / 10, dead: this.stage === 'caught' || this.stage === 'over' ? 1 : 0 }; },
  // Space is read with the arrows (keys()); E and Enter jump too. The action button is hidden here.
  act() { if (!G.keys.has('Space')) this.cmd('jump'); },
  leave() {
    // Left in the middle of the stills: close them too (each click is the next slide).
    for (let i = 0; i < 6 && this.inCut && $('#screen .cutscene'); i++) $('#screen .cutscene').click();
    this.inCut = false;
    this.seenIntro = false;   // back from the hub next time: the stills again
    this.unbind();
    document.body.classList.remove('rn-on');
    clearTimeout(this.bubT);
    this.clear();
    for (const b of this.bits || []) this.scene.remove(b.m);
    this.bits = [];
    for (const u of this.puffs || []) this.scene.remove(u.s);
    this.puffs = [];
    this.ghosts = new Map();
    this.shout = this.goNow = false;
    this.stage = null; this.el = null;
  },
};
Arcade.register(RunnerGame);
