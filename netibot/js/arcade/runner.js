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
    sc.fog = new THREE.Fog(0x0b1024, 30, 120);
    this.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 400);
    sc.add(new THREE.HemisphereLight(0x5d6aa8, 0x2a2018, 0.7));
    const moon = this.moon = new THREE.DirectionalLight(0xbcc8ff, 0.55);
    moon.position.set(-10, 30, 10); moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 20, bottom: -20, near: 1, far: 80 });
    sc.add(moon, moon.target);
    // The stars and the moon.
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 700; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.1, r = 300; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false }));
    sc.add(this.stars);
    const moonM = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
    moonM.position.set(-80, 120, -260); this.stars.add(moonM);
    // Shared pieces.
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
    this.mat = {
      sand: new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg'), color: 0x9a8a70, roughness: 1 }),
      path: new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/asphalt.jpg'), color: 0x8a8a8a, roughness: 0.95 }),
      crate: M(0x4f5d32), stripe: M(0xd8261f), white: M(0xf2f2f2), post: M(0x777777, { metalness: 0.5 }),
      lamp: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), rope: new THREE.LineBasicMaterial({ color: 0xdddddd }),
      sock: [M(0xf2f2f2), M(0x2f7fe0), M(0xd8261f), M(0x222222)], cont: M(0x56653a, { metalness: 0.2 }), ramp: M(0x6a6a5a, { metalness: 0.4 }),
    };
    this.mat.sand.map.wrapS = this.mat.sand.map.wrapT = THREE.RepeatWrapping; this.mat.sand.map.repeat.set(6, 30);
    this.mat.path.map.wrapS = this.mat.path.map.wrapT = THREE.RepeatWrapping; this.mat.path.map.repeat.set(2, 20);
    this.geo = { crate: new THREE.BoxGeometry(1.5, 0.9, 1.1), lampPole: new THREE.CylinderGeometry(0.08, 0.1, 5, 6), lampHead: new THREE.BoxGeometry(0.6, 0.25, 0.3), coin: new THREE.CylinderGeometry(0.42, 0.42, 0.1, 22) };
    const face = new THREE.TextureLoader().load('assets/race/coin.png'); face.encoding = THREE.sRGBEncoding;
    const fm = new THREE.MeshStandardMaterial({ map: face, metalness: 0.55, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.7, transparent: true });
    this.coinMats = [new THREE.MeshStandardMaterial({ color: 0xd9a92e, metalness: 0.8, roughness: 0.3, emissive: 0x4a3400 }), fm, fm];
    // The ammo-crate stencil.
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d'); g.fillStyle = '#4f5d32'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#3a4524'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 120);
    g.fillStyle = '#e8dcb0'; g.font = '900 40px Rubik, Arial'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('תחמושת', 128, 80);
    this.mat.crateFace = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.8 });
    this.glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.iconTex = {};
    for (const k in RUN_POWERS) { const t = new THREE.TextureLoader().load(RUN_POWERS[k].icon); t.encoding = THREE.sRGBEncoding; this.iconTex[k] = t; }
  },

  // ---------- a run ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    Arcade.loadModels(['arc_sandbags', 'arc_dumpster', 'car_van']).then(() => { this.modelsIn = true; });
    this.rnd = Arcade.rng(ctx.seed);
    this.chunks = []; this.obs = []; this.coins = []; this.powers = []; this.vans = [];
    this.genZ = 0; this.nextItemAt = 120 + this.rnd() * 60;
    this.p = { lane: 1, x: 0, y: 0, vy: 0, z: 0, slide: 0, ground: 0, dead: false, trips: 0, tripT: 0 };
    this.d = 0; this.speed = 10; this.coinsGot = 0; this.score = 0; this.power = {}; this.helmet = false;
    this.chaser = { gap: 6, z: 6 };
    this.lineT = 4; this.t = 0;
    this.stage = 'intro';
    this.me = Arcade.soldier(this.scene, Arcade.look(null));
    this.insp = Arcade.soldier(this.scene, Arcade.look('inspector'));
    // Her flashlight: a real spot light, and a cone of dusty light in front of her.
    const fl = this.flash = new THREE.SpotLight(0xfff2d0, 2.2, 30, 0.45, 0.5, 1.2);
    fl.position.set(0.3, 1.4, 0.3); this.insp.root.add(fl); this.insp.root.add(fl.target);
    fl.target.position.set(0, 0, 10);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.x = -Math.PI / 2; beam.position.set(0.3, 1.2, 4.8); this.insp.root.add(beam);
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
    this.chunks = []; this.obs = []; this.coins = []; this.powers = [];
  },

  // The opening: stills from Higgsfield, then the same moment in 3D, then run.
  async intro() {
    const real = Assets.scene('run_insp'), chase = Assets.scene('run_chase');
    this.booth = this.makeBooth();
    this.stage = 'cine'; this.cineT = 0;
    if (!this.ctx.solo) { this.cineT = 6.5; return; }
    await UI.cutscene([
      { img: 'assets/arcade/run_booth.jpg', who: '', text: '02:47. שמירה בש"ג. שקט. רק הזמזום של הפנס, והג\'וק שעושה סיבובים מסביבו. העיניים נעצמות... רק לשנייה...' },
      { img: 'assets/arcade/run_sleep.jpg', who: '', text: 'זזזז... חלום על שחרור, על שווארמה, על מיטה אמיתית... ופתאום — אור לבן בפרצוף.' },
      { img: real || 'assets/arcade/run_booth.jpg', who: '{@@inspector}', text: 'ישנת. בשמירה. בשמירה שלי. ...{name}, יש לך שלוש שניות.' },
      { img: chase || 'assets/arcade/cover_runner.jpg', who: '', text: 'שלוש שניות זה הרבה זמן. [רוץ/רוצי]!!! ⬅️ ➡️ להחליף נתיב · ⬆️ לקפוץ · ⬇️ להחליק. בטלפון — להחליק עם האצבע.' },
    ]);
    if (this.stage === 'cine') this.cineT = Math.max(this.cineT, 0);
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
    const z0 = this.genZ, L = 30, rnd = this.rnd, g = new THREE.Group();
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
        const lt = new THREE.PointLight(0xffd890, 1.4, 18, 1.6); lt.position.set(side * 3.6, 4.6, -(z0 + 15)); g.add(lt);
      }
    }
    this.scene.add(g);
    this.chunks.push({ g, z0, L });
    // Rows of obstacles, never all three lanes shut; coins in the open lanes.
    if (z0 >= 30) {
      const gap = Math.max(11, 17 - this.d / 250);
      for (let z = z0 + 4; z < z0 + L - 2; z += gap + rnd() * 5) this.row(z);
    }
    this.genZ += L;
  },
  row(z) {
    const rnd = this.rnd, kinds = [];
    const n = rnd() < 0.35 ? 1 : rnd() < 0.8 ? 2 : 3;
    const lanes = [0, 1, 2].sort(() => rnd() - 0.5).slice(0, n);
    let blockers = 0;
    for (const l of lanes) {
      let k = ['crate', 'bags', 'barrier', 'laundry', 'dumpster', 'container', 'van'][Math.floor(rnd() * 7)];
      if ((k === 'dumpster' || k === 'container' || k === 'van') && ++blockers >= 2 && n === 3) k = 'crate';
      if (k === 'van' && this.d < 150) k = 'dumpster';
      kinds.push([l, k]);
      this.obstacle(l, z, k);
    }
    // Coins in a free lane (or over a jumpable thing, in an arc).
    const free = [0, 1, 2].filter(l => !lanes.includes(l));
    const lane = free.length ? free[Math.floor(rnd() * free.length)] : kinds.find(([, k]) => k === 'crate' || k === 'bags')?.[0];
    if (lane != null && rnd() < 0.75) {
      const over = !free.includes(lane);
      for (let i = 0; i < 6; i++) this.coin(lane, z - 5 + i * 2, over ? 1 + Math.sin(i / 5 * Math.PI) * 1.6 : 1);
    }
    if (this.genZ + z > this.nextItemAt && free.length) {
      this.nextItemAt = z + 140 + rnd() * 120;
      const keys = Object.keys(RUN_POWERS);
      this.powerUp(free[0], z + 8, keys[Math.floor(rnd() * keys.length)]);
    }
  },
  obstacle(lane, z, kind) {
    const x = RUN_LANES[lane], g = new THREE.Group(), M = this.mat;
    let o = { lane, z, kind, w: 1.6, h: 1, len: 1.2, m: g };
    if (kind === 'crate') {
      const c = new THREE.Mesh(this.geo.crate, [M.crate, M.crate, M.crate, M.crate, M.crateFace, M.crateFace]); c.position.y = 0.45; g.add(c);
      o.h = 0.9; o.act = 'jump';
    } else if (kind === 'bags') {
      const s = Assets.has('arc_sandbags') ? Assets.model('arc_sandbags', { length: 2 }) : null;
      if (s) { s.rotation.y = 0; g.add(s); } else { const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0xb8a070 })); b.position.y = 0.4; g.add(b); }
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
      if (d) g.add(d); else { const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x2f5f3f })); b.position.y = 0.8; g.add(b); }
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
      if (v) g.add(v); else { const b = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 5.4), new THREE.MeshStandardMaterial({ color: 0xe8e3d3 })); b.position.y = 1; g.add(b); }
      for (const sx of [-0.6, 0.6]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); h.position.set(sx, 0.9, 2.75); g.add(h); }
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.8, 10, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.9, 7.8); g.add(beam);
      o.h = 2.3; o.len = 5.6; o.act = 'side'; o.move = 9; o.zc = 0;
    }
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    g.position.set(x, 0, -z);
    this.scene.add(g);
    this.obs.push(o);
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
  bind() {
    this.keysWas = new Set();
    this.onDown = (e) => { if (e.target.closest('button, .ar-panel, #screen')) return; this.sw = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    this.onUp = (e) => {
      if (!this.sw) return;
      const dx = e.clientX - this.sw.x, dy = e.clientY - this.sw.y;
      this.sw = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) { this.cmd('jump'); return; }
      if (Math.abs(dx) > Math.abs(dy)) this.cmd(dx > 0 ? 'right' : 'left');
      else this.cmd(dy < 0 ? 'jump' : 'slide');
    };
    addEventListener('pointerdown', this.onDown);
    addEventListener('pointerup', this.onUp);
  },
  unbind() { removeEventListener('pointerdown', this.onDown); removeEventListener('pointerup', this.onUp); },
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
    else if (c === 'slide') { p.slide = 0.75; if (p.y > p.ground + 0.1) p.vy = Math.min(p.vy, -14); Sound.synth.noise(0.25, 0.08, 1200, 'bandpass'); }
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
    if (t < 1.6) { this.inspAt = { x: -2.2, z: 1.8 + (1.6 - t) * 3 }; }
    else this.inspAt = { x: -1.2, z: 3.2 };
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
    this.d = Math.max(0, -p.z);
    for (const k in this.power) { if (this.power[k] > 0) { this.power[k] -= dt; if (this.power[k] <= 0) { delete this.power[k]; if (k === 'fly') p.vy = 0; } } }
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
    // The van drives at you.
    for (const o of this.obs) if (o.move && Math.abs(o.z - this.d) < 70) { o.z -= o.move * dt; o.m.position.z = -o.z; }
    this.hits();
    this.collect(dt);
    // The chase: she's a few meters back and closes in after each trip.
    p.tripT = Math.max(0, p.tripT - dt);
    if (p.tripT <= 0 && p.trips) p.trips = 0;
    const want = p.trips ? 2.2 : this.power.shoes || this.power.fly ? 14 : 8;
    this.chaser.gap += (want - this.chaser.gap) * Math.min(1, dt * (p.trips ? 3 : 0.4));
    this.inspAt = { x: p.x * 0.6, z: p.z + this.chaser.gap };
    this.lineT -= dt;
    if (this.lineT <= 0) { this.lineT = 6 + Math.random() * 5; this.bubble(fmt(pick(RUN_LINES.chase))); }
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
    const p = this.p, d = this.d, sliding = p.slide > 0, top = sliding ? 0.8 : 1.75;
    for (const o of this.obs) {
      if (o.done || o.lane !== p.lane && Math.abs(RUN_LANES[o.lane] - p.x) > 1.3) continue;
      const zc = o.zc || 0, front = o.z + zc * 0 , back = o.z + o.len;
      const z0 = o.top ? o.z : o.z - o.len / 2, z1 = o.top ? back : o.z + o.len / 2;
      if (d < z0 - 0.3 || d > z1 + 0.3) continue;
      const y0 = o.y0 || 0, y1 = o.top || o.h;
      // Standing on a roof is fine; running into its end isn't.
      if (o.top && p.y >= o.top - 0.35) continue;
      if (o.top && o.ramp && p.y >= p.ground - 0.1 && p.ground > 0.2) continue;
      if (p.y >= y1 - 0.05 || p.y + top <= y0) continue;
      // Sideways into something while changing lanes: a trip, not the end.
      if (Math.abs(RUN_LANES[o.lane] - p.x) > 0.7) { this.trip(o); continue; }
      if (this.power.shoes || this.power.fly) { o.done = true; this.smash(o); continue; }
      if (this.helmet) { this.helmet = false; o.done = true; this.smash(o); this.bubble('הקסדה הצילה אותך!', true); Sound.ding(); continue; }
      if ((o.act === 'jump' || o.act === 'slide') && !o.tripped && (o.act === 'jump' ? p.y > 0.3 : true)) { o.tripped = true; this.trip(o); continue; }
      this.caught(o);
      return;
    }
  },
  trip(o) {
    const p = this.p;
    o.tripped = true;
    if (p.trips && p.tripT > 0) { this.caught(o); return; }
    p.trips = 1; p.tripT = 8;
    Sound.bump(); G.shake = 0.4; this.shakeT = 0.4;
    // Stumbled sideways: back to where you came from.
    if (Math.abs(RUN_LANES[o.lane] - p.x) > 0.7) p.lane = RUN_LANES.indexOf(RUN_LANES.reduce((a, b) => Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
    this.bubble(fmt(pick(RUN_LINES.trip)));
    Arcade.say(fmt(pick(RUN_LINES.near)), null, 1800);
  },
  smash(o) {
    Sound.splat();
    o.m.traverse(m => { if (m.isMesh) m.visible = false; });
    for (let i = 0; i < 8; i++) this.debris(o.m.position.x, 0.8, o.m.position.z);
  },
  debris(x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), this.mat.crate);
    m.position.set(x, y, z); this.scene.add(m);
    (this.bits = this.bits || []).push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 8, 5 + Math.random() * 5, (Math.random() - 0.5) * 8), t: 0 });
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
      if (u.kind === 'fly') p.vy = 0;
      Sound.fanfare();
      Arcade.big(P.name, 1100);
      Arcade.say(fmt(P.say), null, 2600);
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
      Scene3D.animateSoldier(me, { x: 0, y: 4.3 / S3, angle: -Math.PI / 2, speed: 0 }, false, dt);
      me.root.position.y = 0.05; me.root.rotation.x = 0.25 + Math.sin(t * 1.5) * 0.04;
    } else {
      const sp = run ? this.speed : 0;
      Arcade.pose(me, p.x, p.z, -Math.PI / 2, run ? Math.min(9, sp) : 0, dt);
      me.root.position.y = p.y;
      me.root.rotation.x = p.slide > 0 ? -1.1 : this.power.fly ? -0.6 : this.stage === 'caught' ? 0.3 : 0;
    }
    me.root.visible = !(p.tripT > 6 && Math.floor(t * 12) % 2);
    // Her: walking up to the booth, then running behind you with the flashlight.
    const ia = this.inspAt || { x: -2.2, z: 6 };
    const irun = this.stage === 'run' || (this.stage === 'caught' && this.caughtT < 0.8);
    Arcade.pose(this.insp, ia.x, ia.z, this.stage === 'cine' && this.cineT < 2.9 ? -Math.PI / 2 + (this.cineT > 1.6 ? 0.6 : 0) : -Math.PI / 2, irun ? 8.5 : this.stage === 'cine' && this.cineT < 1.6 ? 3 : 0, dt);
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
    if (this.stage === 'cine' && this.cineT < 2.9) { const a = 0.7 - this.cineT * 0.22; want = new THREE.Vector3(Math.sin(a) * 4.6, 1.9 + this.cineT * 0.15, 4.3 - Math.cos(a) * 4.6); look = new THREE.Vector3(0, 1.0, 4.3); }
    else if (this.stage === 'caught' || this.stage === 'over') { want = new THREE.Vector3(p.x + 4, p.y + 2.4, p.z - 4); look = new THREE.Vector3(p.x, p.y + 1.1, p.z + 0.5); }
    else { want = new THREE.Vector3(p.x * 0.7, p.y * 0.6 + 3.4, p.z + 6.2); look = new THREE.Vector3(p.x * 0.85, p.y * 0.5 + 1.2, p.z - 6); }
    cam.position.lerp(want, Math.min(1, dt * (this.stage === 'run' ? 8 : 3)));
    this.look = this.look || look.clone();
    this.look.lerp(look, Math.min(1, dt * 8));
    if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake * 0.4; cam.position.y += (Math.random() - 0.5) * G.shake * 0.4; G.shake = Math.max(0, G.shake - dt * 1.5); }
    cam.lookAt(this.look);
    cam.fov = 64 + (this.power.shoes ? 8 : 0) + Math.min(8, (this.speed - 10) * 0.6);
    cam.updateProjectionMatrix();
    this.moon.position.set(p.x - 10, 30, p.z + 10); this.moon.target.position.set(p.x, 0, p.z - 6);
    this.stars.position.set(0, 0, p.z);
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
    this.el = { d: h.querySelector('.rn-d'), coins: h.querySelector('.rn-coins b'), pw: h.querySelector('.rn-pw'), board: h.querySelector('.rn-board'), danger: h.querySelector('.rn-danger') };
  },
  hud() {
    const e = this.el;
    if (!e) return;
    e.d.textContent = Math.floor(this.d);
    e.coins.textContent = this.coinsGot;
    let pw = '';
    for (const k in this.power) pw += `<span><img src="${RUN_POWERS[k].icon}" alt=""><i style="--p:${Math.max(0, this.power[k] / RUN_POWERS[k].dur * 100)}%"></i></span>`;
    if (this.helmet) pw += `<span><img src="${RUN_POWERS.helmet.icon}" alt=""></span>`;
    if (e.pw.innerHTML !== pw) e.pw.innerHTML = pw;
    e.danger.classList.toggle('hidden', !(this.p.trips && this.stage === 'run'));
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
  act() { this.cmd('jump'); },
  leave() {
    this.unbind();
    document.body.classList.remove('rn-on');
    clearTimeout(this.bubT);
    this.clear();
    for (const b of this.bits || []) this.scene.remove(b.m);
    this.bits = [];
    this.ghosts = new Map();
    this.shout = this.goNow = false;
    this.stage = null; this.el = null;
  },
};
Arcade.register(RunnerGame);
