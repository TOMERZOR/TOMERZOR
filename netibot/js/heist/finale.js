// The heist's finale: Gonni's battery at Palmachim, by the sea. In by the chosen approach
// (the main gate in Gonni shirts, a cut in the north-east fence, or the smokers' gap from the
// beach), past the guards to their command post (the שו"ב), the safe (the code from the photo
// on a keypad, or the drill — loud, and it overheats), the chain and the padlock, back to the
// getaway vehicle, and out through the base's gate.
// Seen long enough, a guard runs for the alarm button in the שו"ב: stop him and nobody knows.
// If he makes it: the siren, two more guards from the gate, three minutes before the
// military police turn up, and everyone shoots MILES. Still winnable — loud.
// Online the host runs the guards, the alarm, everyone's MILES hits, the safe and the loot.

const HS_SAFE = { x: -2.6, z: -12.5 }, HS_PANEL = { x: -10.3, z: -8.6 }, HS_DOOR = { x: -6, z: -6.5 };
const HS_SPAWN = { gate: [10, 36, 13.6, 38.5, -Math.PI / 2], fence: [27, -31, 31, -33, Math.PI], beach: [-44, 6, -46, 13, -Math.PI / 2] };
const HS_EXIT = { x: 10, z: 112 };
const HS_FIN_LINES = {
  td: ['💤 לילה טוב', '💤 *נרדם באמצע משפט*', '💤 חלום על שחרור', '💤 שינה מתוקה'],
  hit: ['📟 MILES: פגיעה!', '📟 *ביפ ביפ* — נפסל', '📟 "זה לא נחשב!" — נחשב.'],
  run: ['🚨 הוא רץ לשו"ב להפעיל אזעקה! לעצור אותו!', '🚨 ראו אותנו! הוא רץ ללחצן האזעקה!'],
  body: ['🚨 הוא מצא את מי שהפלנו — והוא רץ לאזעקה!'],
  hurt: ['📟 MILES צפצף עליך! −20', '📟 *ביפ* — פגעו בך'],
  shout: ['"פולשים!!!"', '"מי שם?! עצור!"', '"זה לא תרגיל! ...זה תרגיל?"', '"תעצרו! יש לי MILES!"'],
};

Heist.stages.fin = Object.assign(Object.create(HSStealth), {
  enter(opt) {
    const H = Heist;
    this.opt = opt;
    this.appr = opt.appr || 'fence';
    if (this.appr === 'gate' && !opt.uni) this.appr = 'fence';
    H.world({ bg: 0x0a1124, fog: [55, 210], rep: 70, size: 600, moon: 0.62 });
    this.gs = []; this.uses = []; this.live = false; this.over = 0;
    this.bounds = [-58, 50, -40, 124];
    this.build();
    this.makePlayers((i) => { const s = HS_SPAWN[this.appr]; return [s[0] + (i % 2) * 1.3 - 0.6, s[1] + Math.floor(i / 2) * 1.3]; }, true);
    for (const p of this.ps) { p.hp = 100; if (p.isMe || p.bot) H.arm(p.m, 'pistol'); else H.arm(p.m, 'pistol'); p.aimT = 0; }
    this.guards();
    this.dress();
    // The getaway vehicle, parked where we came in.
    const s = HS_SPAWN[this.appr];
    this.car = H.makeCar(opt.car || 'hilux');
    this.car.x = s[2]; this.car.z = s[3]; this.car.a = s[4];
    H.drawCar(this.car, 0, 0);
    this.st = { al: 0, at: 180, sf: 0, L: 0, B: 0, dr: '', inn: [], hp: {}, cut: this.appr === 'fence' ? 0 : 1, done: 0, bar: 1 };
    this.me2 = { tds: 0, shots: 0, hits: 0 };
    this.ammo = 12; this.fireCool = 0; this.T = 0; this.drill = { p: 0, heat: 0, jam: 0, nz: 0 }; this.alarmed = false; this.safeShown = false; this.mineCarry = 0;
    this.safeOpen = 0; this.el2 = undefined; this.hudOff = false; this.cutDone = false; this.barBroke = false; this.escSent = false; this.boarded = false;
    this.tracers = []; this.dropL = this.dropB = null; this.flashRed = 0; this.pad = null; this.nzT = 0;
    this.uses = this.makeUses();
    Sound.music('night');
    H.cam.position.set(s[0], 14, s[1] + 10); H.cam.lookAt(s[0], 0, s[1]);
    this.intro(this.introSeq(), () => { this.T = 0; Sound.music('tension'); });
  },

  // ---------- the map ----------
  build() {
    const H = Heist, sc = H.scene;
    // The sea and the beach to the west.
    const sea = this.sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 600), new THREE.MeshStandardMaterial({ color: 0x0f2a48, roughness: 0.18, metalness: 0.65, emissive: 0x06121f }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-182, 0.06, 40); sc.add(sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 600), new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35 }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(-52.2, 0.07, 40); sc.add(foam); this.foam = foam;
    H.col(-56, 40, 4, 600, 3);
    // The roads: the battery's gate down to the base's gate, the beach track.
    H.road(10, 22, 10, 124, 8); H.road(10, 30, 40, 30, 6, 0.025); H.road(40, 30, 40, -34, 6, 0.03); H.road(40, -34, 20, -34, 6, 0.025); H.road(10, 46, -44, 46, 6, 0.025); H.road(-44, 46, -46, 0, 6, 0.03);
    // The battery's fence; the north-east bit is the one we cut.
    H.fence(-34, 24, 34, 24, [[8, 12]]);
    H.fence(-34, -24, 24.5, -24); H.fence(27.5, -24, 34, -24);
    const n0 = sc.children.length, c0 = H.cols.length;
    H.fence(24.5, -24, 27.5, -24);
    this.cutBits = { meshes: sc.children.slice(n0), cols: H.cols.slice(c0) };
    H.fence(-34, -24, -34, 24, [[3.5, 7.5]]); H.fence(34, -24, 34, 24);
    // The gate booth, the barrier at the base's own gate down the road.
    const wall = H.mat(0xb8b2a0, { map: Arcade.texture('assets/heist/tex_concrete.jpg', 1) });
    H.box(14.5, 26.2, 2.4, 2.4, 2.6, wall); H.box(14.5, 26.2, 2.8, 2.8, 0.15, H.mat(0x6b6b60), { y: 2.6, col: false });
    const bl = new THREE.PointLight(0xffc870, 1.2, 12, 1.6); bl.position.set(13, 3, 24.5); sc.add(bl);
    H.box(15.5, HS_EXIT.z, 3, 3, 2.6, wall);
    const bar = this.barrier = new THREE.Group(); bar.position.set(14, 1.1, HS_EXIT.z);
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.16), H.mat(k % 2 ? 0xffffff : 0xd8261f)); s.position.x = -0.7 - k * 1.4; bar.add(s); }
    sc.add(bar);
    this.barCol = { x: 10, z: HS_EXIT.z, hw: 4.2, hd: 0.3, h: 1, off: true };
    H.cols.push(this.barCol);
    this.exitB = H.beacon(HS_EXIT.x, HS_EXIT.z + 4, 0x5adfff, 14); this.exitB.visible = false;
    // The command post: concrete, a door to the south, the console, the safe, a red light on the roof.
    const cw = H.mat(0xa8a497, { map: Arcade.texture('assets/heist/tex_concrete.jpg', 2) });
    H.box(-6, -13.5, 10, 0.3, 3, cw); H.box(-11, -10, 0.3, 7, 3, cw); H.box(-1, -10, 0.3, 7, 3, cw);
    H.box(-8.95, -6.5, 4.1, 0.3, 3, cw); H.box(-3.05, -6.5, 4.1, 0.3, 3, cw);
    H.box(-6, -6.5, 1.6, 0.3, 0.6, cw, { y: 2.4, col: false });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), H.mat(0x445a3a, { map: Arcade.texture('assets/heist/tex_floor.jpg', 3) }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(-6, 0.03, -10); fl.receiveShadow = true; sc.add(fl);
    const roof = this.roof = new THREE.Group(); sc.add(roof);
    H.box(-6, -10, 10.6, 7.6, 0.25, H.mat(0x8a877c, { map: Arcade.texture('assets/heist/tex_concrete.jpg', 3) }), { y: 3, col: false, parent: roof });
    const tag = Scene3D.label(fmt('📡 השו"ב של גוני'), { bg: 'rgba(20,26,16,.85)', size: 0.9 }); tag.position.set(-6, 5.4, -10); roof.add(tag);
    // A glow from the window over the console side.
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ color: 0x7affa8, transparent: true, opacity: 0.55 })); win.position.set(-3.6, 1.9, -6.33); sc.add(win);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), H.mat(0xdddddd, { side: THREE.DoubleSide }));
    dish.position.set(-3, 3.9, -11.5); dish.rotation.x = 2.3; roof.add(dish);
    for (const [x, h] of [[-9.6, 3.2], [-8.8, 2.4]]) { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, h, 5), H.mat(0x333333)); an.position.set(x, 3.1 + h / 2, -12.6); roof.add(an); }
    this.beaconM = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x661111, emissive: 0x220000 }));
    this.beaconM.position.set(-6, 3.35, -8.2); roof.add(this.beaconM);
    this.redL = new THREE.PointLight(0xff2010, 0, 40, 1.4); this.redL.position.set(-6, 4.2, -8.2); sc.add(this.redL);
    const con = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.5), new THREE.MeshBasicMaterial({ map: Arcade.texture('assets/heist/console.jpg') }));
    con.position.set(-6.8, 1.55, -13.33); sc.add(con);
    H.box(-6.8, -12.9, 5.8, 0.8, 0.85, H.mat(0x34373a));
    // The alarm button by the door: a red box with a light.
    H.box(HS_PANEL.x - 0.45, HS_PANEL.z, 0.3, 0.7, 0.6, H.mat(0x8a1010, { emissive: 0x330000 }), { y: 1.1, col: false });
    const pl = new THREE.PointLight(0xff4030, 0.6, 3); pl.position.set(HS_PANEL.x, 1.5, HS_PANEL.z); sc.add(pl);
    const lamp = new THREE.PointLight(0xc8ffd0, 0.9, 10, 1.6); lamp.position.set(-6, 2.7, -10); sc.add(lamp);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), H.mat(0x222222)); chair.position.set(-8, 0.25, -11.4); sc.add(chair);
    // The safe: a box with its door (it opens).
    this.safe = this.makeSafe(); this.safe.position.set(HS_SAFE.x, 0, HS_SAFE.z); sc.add(this.safe);
    H.col(HS_SAFE.x, HS_SAFE.z - 0.15, 0.95, 0.85, 1.3);
    // The bonus: the shekem's cash box on the console.
    this.cash = new THREE.Group();
    const cb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.3), H.mat(0x2a5aa8, { metalness: 0.4 })); cb.position.y = 0.1; this.cash.add(cb);
    const cbl = Scene3D.label('💵', { bg: 'rgba(0,0,0,0)', size: 0.5 }); cbl.position.y = 0.6; this.cash.add(cbl);
    this.cash.position.set(-9.2, 0.86, -12.9); sc.add(this.cash);
    // Low sandbags in front of the door, poles with lamps around the yard.
    H.col(-2.2, -4.4, 3.2, 1, 1.05);
    this.lamps = [];
    for (const [x, z] of [[-20, -18], [20, -18], [-24, 14], [26, 16], [0, 18], [6, -4], [-30, 0]]) { const l = new THREE.PointLight(0xffd890, 0.9, 17, 1.6); l.position.set(x, 5, z); sc.add(l); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6), H.mat(0x555a50)); pole.position.set(x, 2.6, z); sc.add(pole); this.lamps.push(l); }
    // Where the props stand (dress() puts the models in).
    this.props = [
      ['launcher', 17, -6, { depth: 7 }, 0, 3, 7, 3], ['launcher', 18, 12, { depth: 7 }, 0.2, 3, 7, 3], ['radar', -20, 14, { height: 4.5 }, 0, 3, 3, 3.5],
      ['generator', 4, 14, { length: 2.4 }, 0, 2.4, 1.4, 1.6], ['container', 2, -2, { size: [2.6, 2.6, 6.2] }, Math.PI / 2, 6.2, 2.6, 2.6], ['container', -22, -6, { size: [2.6, 2.6, 6.2] }, 0, 2.6, 6.2, 2.6],
      ['container', 28, -6, { size: [2.6, 2.6, 6.2] }, 0, 2.6, 6.2, 2.6], ['container', -14, 6, { size: [2.6, 2.6, 6.2] }, Math.PI / 2, 6.2, 2.6, 2.6], ['container', 8, -18, { size: [2.6, 2.6, 6.2] }, Math.PI / 2, 6.2, 2.6, 2.6],
      ['arc_sandbags', -2.2, -4.4, { length: 3.2 }, 0, 0, 0, 1], ['arc_sandbags', -11.75, -10.5, { length: 3.2 }, Math.PI / 2, 0, 0, 1], ['arc_sandbags', -0.25, -9.2, { length: 3.2 }, Math.PI / 2, 0, 0, 1], ['tower', 30, 20, { height: 7 }, 0, 0, 0, 7], ['palm', 4, 28, { height: 8 }, 0, 0, 0, 8], ['palm', 18, 29, { height: 7 }, 0, 0, 0, 7], ['palm', -40, 30, { height: 9 }, 0, 0, 0, 9], ['palm', -46, -12, { height: 8 }, 0, 0, 0, 8],
      ['truck', 26, 34, { length: 7, rotY: Math.PI / 2 }, 0, 7, 2.6, 3],
    ];
    for (const [, x, z, , , w, d, h] of this.props) if (w) H.col(x, z, w, d, h);
    this.decor = [];
  },
  makeSafe() {
    const H = Heist, g = new THREE.Group();
    const side = H.mat(0x5b6b3c, { map: Arcade.texture('assets/heist/safe_side.jpg'), metalness: 0.3, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.15, 0.8), side); body.position.y = 0.68; body.castShadow = true; g.add(body);
    const inside = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.05), new THREE.MeshStandardMaterial({ color: 0x2a2010, emissive: 0x5a3a08 })); inside.position.set(0, 0.68, 0.38); g.add(inside);
    for (const x of [-0.36, 0.36]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.7), side); leg.position.set(x, 0.06, 0); g.add(leg); }
    // The door hangs on its right hinge, facing +z (into the room).
    const hinge = this.safeHinge = new THREE.Group(); hinge.position.set(0.43, 0.68, 0.41); g.add(hinge);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.08, 0.08), [side, side, side, side, new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/heist/safe_door.jpg'), metalness: 0.3, roughness: 0.55 }), side]);
    door.position.set(-0.42, 0, 0.04); door.castShadow = true; hinge.add(door);
    const glow = this.safeGlow = new THREE.PointLight(0xffc040, 0, 3.5, 1.5); glow.position.set(0, 0.8, 0.7); g.add(glow);
    // The chain inside (the model when it's in).
    this.chainIn = new THREE.Group(); this.chainIn.position.set(0, 0.32, 0.05); g.add(this.chainIn);
    g.rotation.y = 0;
    return g;
  },
  dress() {
    const H = Heist;
    for (const o of this.decor || []) H.scene.remove(o);
    this.decor = [];
    for (const [name, x, z, fit, ry] of this.props) {
      const m = Assets.model(name, fit);
      if (!m) continue;
      m.position.set(x, 0, z); m.rotation.y = ry || 0; H.scene.add(m); this.decor.push(m);
    }
    // The chain: in the safe, and on whoever carries it.
    while (this.chainIn.children.length) this.chainIn.remove(this.chainIn.children[0]);
    const ch = Assets.model('hs_chain', { length: 0.6 }) || this.fakeChain();
    this.chainIn.add(ch);
    if (this.car && Assets.has(HS_CARS[this.car.type].model) && !this.car.root.children[0].children[0].isGroup) { const o = this.car; H.scene.remove(o.root); const c = H.makeCar(o.type); Object.assign(c, { x: o.x, z: o.z, a: o.a, v: o.v, hp: o.hp }); this.car = c; H.drawCar(c, 0, 0); }
    for (const p of this.ps || []) { H.arm(p.m, 'pistol'); this.carryProp(p, true); }
    for (const g of this.gs || []) if (g.rifle) H.arm(g.m, 'rifle');
  },
  fakeChain() {
    const g = new THREE.Group(), m = Heist.mat(0x9a9a9a, { metalness: 0.7, roughness: 0.3 });
    for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10), m); t.position.set(-0.25 + k * 0.1, 0.05, 0); t.rotation.y = k % 2 ? Math.PI / 2 : 0; g.add(t); }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.08), Heist.mat(0xd8a830, { metalness: 0.8, roughness: 0.25 })); lock.position.set(0.12, 0.12, 0.05); g.add(lock);
    return g;
  },
  // What a player carries, on their back.
  carryProp(p, rebuild = false) {
    const m = p.m;
    if (rebuild && m.carryM) { m.root.remove(m.carryM); m.carryM = null; m.carryK = null; }
    const want = p.carry || 0;
    if (m.carryK === want) return;
    if (m.carryM) m.root.remove(m.carryM);
    m.carryM = null; m.carryK = want;
    if (!want) return;
    const g = new THREE.Group();
    if (want === 'L') { const c = Assets.model('hs_chain', { length: 0.55 }) || this.fakeChain(); c.rotation.z = Math.PI / 2; g.add(c); g.position.set(-0.28, 1.15, 0); }
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.3), Heist.mat(0x2a5aa8, { metalness: 0.4 })); g.add(b); g.position.set(-0.26, 1.2, 0); }
    m.root.add(g); m.carryM = g;
  },
  drawCarry(p) { this.carryProp(p); },

  // ---------- the guards ----------
  guards() {
    const G2 = (o) => this.addGuard({ rifle: true, name: o.name || 'שומר מגוני', ...o });
    G2({ x: 10, z: 21.5, a: Math.PI / 2, R: 9, sweep: 0.6, name: 'השער' });
    G2({ x: -28, z: -21.5, path: [[-28, -21.5, 2], [28, -21.5, 2]], R: 9 });
    G2({ x: -14, z: -3, path: [[-14, -3, 1.2], [2, -3, 1.2], [2, -16, 1.2], [-14, -16, 1.2]], R: 9 });
    G2({ x: 11, z: -15, path: [[11, -15, 1.4], [11, 3, 1.4], [23, 3, 1.4], [23, -15, 1.4]], R: 9 });
    G2({ x: -26, z: 2, path: [[-26, 2, 2], [6, 2, 2]], R: 8.5 });
    G2({ x: -30, z: -14, path: [[-30, -14, 2.5], [-30, 18, 2.5]], R: 9 });
    this.addGuard({ x: -8, z: -11.6, a: -Math.PI / 2, sleep: true, R: 7, name: 'התורן (ישן)' });
    G2({ x: -20, z: 18.5, a: 0, R: 8, sweep: 1.0, name: 'הרדאר' });
    // Two more who come out of the gate when the alarm goes.
    for (let k = 0; k < 2; k++) { const g = G2({ x: 10 + k * 2, z: 26, a: -Math.PI / 2, R: 11, name: 'תגבורת' }); g.st = 'off'; }
  },
  // In Gonni shirts, walking calmly, you're one of them (until you're in the שו"ב with their chain).
  seenMul(g, p) {
    let k = 1;
    const inside = this.inside(p);
    if (this.opt.uni && !p.run && p.carry !== 'L' && !inside) k = 0.3;
    if (this.opt.uni && g.i === 0 && this.appr === 'gate' && !p.run) k = 0.06;
    if (p.carry === 'L') k *= 1.3;
    if (this.st.al) k *= 1.6;
    return k;
  },
  inside(p) { return p.x > -11 && p.x < -1 && p.z > -13.5 && p.z < -6.5; },
  // Seen: he runs for the alarm button.
  spotted(g, p) {
    if (this.st.al) { g.st = 'hunt'; return; }
    g.st = 'run'; g.runT = 0; g.sus = 1;
    void p;
    this.say(pick(HS_FIN_LINES.run), 'bad');
    Heist.pop(g.x, g.z, pick(HS_FIN_LINES.shout), { bg: 'rgba(255,248,230,.97)', y: 2.6 });
  },
  extraSim(g, dt, saw) {
    void saw;
    // A body in sight: that's the alarm too.
    if (!this.st.al && (g.st === 'patrol' || g.st === 'post' || g.st === 'inv')) {
      for (const b of this.gs) {
        if (b === g || b.st !== 'down' || b.found) continue;
        const d = Math.hypot(b.x - g.x, b.z - g.z);
        if (d > g.R * 0.8) continue;
        let da = Math.atan2(b.z - g.z, b.x - g.x) - g.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < g.half && Heist.los(g.x, g.z, b.x, b.z)) { b.found = true; g.st = 'run'; g.runT = 0; g.sus = 1; this.say(pick(HS_FIN_LINES.body), 'bad'); break; }
      }
    }
  },
  moveSpecial(g, dt, walkTo, turn) {
    if (g.st === 'run') {
      // To the door, in, to the button.
      g.runT += dt;
      const inside = this.inside(g);
      const tgt = inside || (Math.abs(g.x - HS_DOOR.x) < 1 && g.z < -5.2) ? (Math.hypot(g.x - HS_PANEL.x, g.z - HS_PANEL.z) < 3 || g.z < -7.2 ? HS_PANEL : { x: -6, z: -8 }) : { x: HS_DOOR.x, z: -4.6 };
      const before = { x: g.x, z: g.z };
      if (tgt === HS_PANEL && Math.hypot(g.x - HS_PANEL.x, g.z - HS_PANEL.z) < 0.8) { this.alarm(); return; }
      walkTo(tgt.x, tgt.z, 5);
      // Stuck on something: step aside.
      if (Math.hypot(g.x - before.x, g.z - before.z) < dt * 1.5) { g.x += Math.cos(g.a + Math.PI / 2) * dt * 3; g.z += Math.sin(g.a + Math.PI / 2) * dt * 3; Heist.collide(g, 0.3); }
      if (g.runT > 16) this.alarm(); // he radios it in
    } else if (g.st === 'hunt') {
      // Chase the nearest of us; shoot whoever's in sight.
      let best = null, bd = Infinity;
      for (const p of this.ps) { if (p.bot || p.down || p.hidden) continue; const d = Math.hypot(p.x - g.x, p.z - g.z); if (d < bd) { bd = d; best = p; } }
      if (!best) { g.v = 0; return; }
      const see = bd < 15 && Heist.los(g.x, g.z, best.x, best.z);
      if (see) { turn(Math.atan2(best.z - g.z, best.x - g.x), 5); if (bd > 6) { g.x += Math.cos(g.a) * 3.4 * dt; g.z += Math.sin(g.a) * 3.4 * dt; Heist.collide(g, 0.3); g.v = 3.4; } }
      else walkTo(best.x, best.z, 4);
      g.cool = (g.cool || 1 + Math.random()) - dt;
      if (see && g.cool <= 0) {
        g.cool = 1.2 + Math.random() * 0.8;
        this.tracer(g.x, g.z, best.x, best.z);
        Sound.shot();
        if (Math.random() < (bd < 8 ? 0.5 : 0.3)) this.hurt(best, 20);
      }
    }
  },
  // Host: a MILES hit on one of us.
  hurt(p, n) {
    const hp = Math.max(0, (this.st.hp[p.who] == null ? 100 : this.st.hp[p.who]) - n);
    this.st.hp[p.who] = hp;
    if (p.isMe) this.myHurt(hp);
    if (hp <= 0) this.drop(p);
  },
  myHurt(hp) {
    const me = this.mePl;
    if (hp < (me.hp || 100)) { Sound.bad(); G.shake = 0.3; this.flashRed = 1; if (hp > 0) Arcade.say(pick(HS_FIN_LINES.hurt), null, 1400); }
    me.hp = hp;
    if (hp <= 0 && !me.down) { me.down = true; Arcade.big('📟 נפסלת!', 1600); Arcade.say(Heist.ctx.solo ? '📟 MILES צפצף. מישהו מהצוות יבוא להחיות אותך...' : '📟 נפסלת! חבר מהצוות יכול להחיות אותך (להחזיק E לידך)', null, 3200); }
    if (hp > 0 && me.down) { me.down = false; Arcade.say('💪 קם[/ה]! בחזרה למשחק', null, 1600); }
  },
  // Host: whoever goes down drops what they carry.
  drop(p) {
    if (this.st.L === p.who) this.st.L = [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10];
    if (this.st.B === p.who) this.st.B = [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10];
  },
  alarm() {
    const H = Heist;
    if (this.st.al) return;
    this.st.al = 1; this.st.at = 180;
    for (const g of this.gs) { if (g.st === 'down') continue; if (g.st === 'off') { g.x = 10 + g.i - 8; g.z = 23; } g.st = 'hunt'; }
    this.onAlarm();
    void H;
  },
  // Everyone: the siren and the red light.
  onAlarm() {
    const H = Heist;
    if (this.alarmed) return;
    this.alarmed = true;
    Sound.startSiren(); Sound.music('boss'); G.shake = 0.5;
    Arcade.big('🚨 אזעקה!', 2000);
    this.barCol.off = false;
    const n = H.n;
    setTimeout(() => { if (H.n !== n || this.over) return; const [w, line] = pick(HS_BANTER.alarm); if (H.ctx.solo) Arcade.say(line, w, 3200); else Arcade.say('🚨 3 דקות עד שהמשטרה הצבאית מגיעה! לכספת — ולרכב!', null, 3600); }, 2200);
  },
  say(text, kind) { Arcade.say(fmt(text), null, kind === 'bad' ? 3000 : 2400); },
  tracer(x0, z0, x1, z1) {
    const H = Heist;
    const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0xff5040, transparent: true, opacity: 0.9 }));
    m.position.set((x0 + x1) / 2, 1.35, (z0 + z1) / 2); m.rotation.y = -a; H.scene.add(m);
    (this.tracers = this.tracers || []).push({ m, t: 0 });
  },

  // ---------- things to do ----------
  makeUses() {
    const H = Heist, st = () => this.st;
    const carrying = () => !!this.mineCarry;
    return [
      // The fence, with the cutters.
      { x: () => 26, z: () => -24, r: 2.2, hold: 2.4, label: 'לחתוך את הגדר', doing: '✂️ חותך[/ת]... קליק. קליק.', ok: () => !st().cut, on: () => { Sound.synth.noise(0.2, 0.2, 2500); if (H.host) this.onEv(H.me.who, 'cut', []); else { H.emit('cut'); this.cutFence(); } } },
      // The safe: the code from the photo, or the drill.
      { x: () => HS_SAFE.x, z: () => HS_SAFE.z + 0.9, r: 1.5, hold: this.opt.code ? 0 : 14, keep: true, label: this.opt.code ? 'להקיש את הקוד' : 'לקדוח בכספת', doing: '🔩 קודח[/ת]...', ok: () => !st().sf && !this.pad, on: () => { if (this.opt.code) this.openPad(); else this.safeOpened(); }, tick: (dt) => this.drillTick(dt) },
      // The chain and the padlock, the cash box.
      { x: () => HS_SAFE.x, z: () => HS_SAFE.z + 0.9, r: 1.6, label: 'לקחת את השרשרת והמנעול!', ok: () => st().sf && !st().L && !carrying(), on: () => this.take('L') },
      { x: () => -9.2, z: () => -12.2, r: 1.4, label: 'לקחת את קופת השק"ם 💵', ok: () => !st().B && !carrying(), on: () => this.take('B') },
      { x: () => (Array.isArray(st().L) ? st().L[0] : 999), z: () => (Array.isArray(st().L) ? st().L[1] : 999), r: 1.5, label: 'להרים את השרשרת', ok: () => Array.isArray(st().L) && !carrying(), on: () => this.take('L') },
      { x: () => (Array.isArray(st().B) ? st().B[0] : 999), z: () => (Array.isArray(st().B) ? st().B[1] : 999), r: 1.5, label: 'להרים את הקופה', ok: () => Array.isArray(st().B) && !carrying(), on: () => this.take('B') },
      // The car: the one with the chain drives; the rest get in.
      { x: () => this.car.x, z: () => this.car.z, r: 3.6, label: () => (this.mineCarry === 'L' ? 'לנהוג! 🚙' : 'לעלות לרכב'), ok: () => !this.mePl.hidden && (this.mineCarry === 'L' || !!st().dr), on: () => this.board() },
      // A friend who's been hit: back on their feet.
      { x: () => (this.downMate() || {}).x || 999, z: () => (this.downMate() || {}).z || 999, r: 1.6, hold: 2, label: 'להחיות', doing: '💪 מחייה...', ok: () => !!this.downMate(), on: () => { const q = this.downMate(); if (q) { if (H.host) this.onEv(H.me.who, 'rv', [q.who]); else H.emit('rv', q.who); } } },
    ];
  },
  downMate() { const me = this.mePl; return this.ps.find(p => !p.isMe && !p.bot && p.down && Math.hypot(p.x - me.x, p.z - me.z) < 1.6) || null; },
  drillTick(dt) {
    // The drill: heats up; past the red it jams (and screams). Let go to cool it.
    const d = this.drill;
    if (d.jam > 0) { this.holdT = Math.max(0, this.holdT - dt); return; }
    d.heat += dt * 0.28;
    d.nz -= dt;
    if (d.nz <= 0) { d.nz = 2.2; Sound.synth.noise(0.5, 0.12, 1800, 'bandpass'); this.emitNoise(HS_SAFE.x, HS_SAFE.z, 11); }
    if (d.heat >= 1) { d.jam = 2.2; d.heat = 0.7; Sound.bad(); Arcade.say('🔥 המקדחה נתקעה! לשחרר רגע...', null, 1800); this.emitNoise(HS_SAFE.x, HS_SAFE.z, 16); }
  },
  emitNoise(x, z, r) { const H = Heist; if (H.host) this.noise(x, z, r); else H.emit('nz', Math.round(x), Math.round(z), r); },
  cutFence() {
    if (this.cutDone) return;
    this.cutDone = true;
    for (const m of this.cutBits.meshes) { if (m.isMesh && m.geometry.type === 'PlaneGeometry') { m.rotation.x = -1.3; m.position.y = 0.4; } }
    for (const c of this.cutBits.cols) c.off = true;
    Heist.pop(26, -24, '✂️ פתוח!');
  },
  // The keypad: the code from the photo, a digit at a time.
  openPad() {
    const H = Heist;
    if (this.pad) return;
    const code = String(this.opt.code);
    const v = this.pad = document.createElement('div');
    v.className = 'hs-pad';
    v.innerHTML = `<div class="hs-pad-in"><div class="hs-note">📸 ${code}</div><div class="hs-screen">____</div><div class="hs-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '✕', 0, '⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div></div>`;
    $('#arcade').appendChild(v);
    this.padIn = '';
    v.querySelectorAll('[data-k]').forEach(b => b.onclick = (e) => { e.stopPropagation(); this.padKey(b.dataset.k); });
    void H;
  },
  key(e) {
    if (!this.pad) return;
    const m = /^(Digit|Numpad)(\d)$/.exec(e.code);
    if (m) this.padKey(m[2]);
    else if (e.code === 'Backspace') this.padKey('⌫');
    else if (e.code === 'Escape') this.padKey('✕');
  },
  padKey(k) {
    const code = String(this.opt.code);
    if (k === '✕') { this.closePad(); return; }
    if (k === '⌫') this.padIn = this.padIn.slice(0, -1);
    else {
      this.padIn += k;
      Sound.synth.tone(900 + (+k) * 60, 0.06, 'square', 0.04);
      if (!code.startsWith(this.padIn)) { Sound.bad(); this.pad.classList.add('bad'); setTimeout(() => this.pad && this.pad.classList.remove('bad'), 400); this.padIn = ''; }
      else if (this.padIn === code) { Sound.good(); this.closePad(); this.safeOpened(); return; }
    }
    this.pad.querySelector('.hs-screen').textContent = (this.padIn + '____').slice(0, 4);
  },
  closePad() { if (this.pad) this.pad.remove(); this.pad = null; },
  safeOpened() {
    const H = Heist;
    if (H.host) this.onEv(H.me.who, 'safe', []); else H.emit('safe');
    this.drill.p = 1;
  },
  take(k) {
    const H = Heist;
    if (H.host) this.onEv(H.me.who, 'pk', [k]); else { H.emit('pk', k); this.mineCarry = k; this.mePl.carry = k; }
    Sound.pickup();
  },
  board() {
    const H = Heist;
    if (H.host) this.onEv(H.me.who, 'bd', [this.mineCarry === 'L' ? 1 : 0]); else H.emit('bd', this.mineCarry === 'L' ? 1 : 0);
    this.mePl.hidden = true; this.boarded = true;
    Sound.gate();
  },
  // Host: what the others did.
  onEv(who, t, a) {
    const st = this.st, p = this.ps.find(q => q.who === who);
    if (this.over) return;
    if (t === 'td' || t === 'sh') {
      const g = this.gs[a[0] | 0];
      if (g && g.st !== 'down' && g.st !== 'off') { g.st = 'down'; g.v = 0; if (who !== Heist.me.who) Heist.pop(g.x, g.z, t === 'td' ? pick(HS_FIN_LINES.td) : pick(HS_FIN_LINES.hit)); }
    } else if (t === 'nz') this.noise(+a[0], +a[1], Math.min(20, +a[2] || 10));
    else if (t === 'cut') { st.cut = 1; this.cutFence(); }
    else if (t === 'safe') { if (!st.sf) { st.sf = 1; this.safeReveal(); } }
    else if (t === 'pk') {
      const k = a[0] === 'B' ? 'B' : 'L';
      const free = k === 'L' ? (st.sf && (!st.L || Array.isArray(st.L))) : (!st.B || Array.isArray(st.B));
      if (free && p) { st[k] = who; if (p.isMe) { this.mineCarry = k; p.carry = k; this.tookIt(k); } }
    } else if (t === 'bd') {
      if (!p) return;
      if (a[0] && st.L === who) st.dr = who;
      if (!st.inn.includes(who)) st.inn.push(who);
      // Alone: the platoon jumps in with you.
      if (Heist.ctx.solo && st.dr) for (const q of this.ps) if (q.bot && !st.inn.includes(q.who)) st.inn.push(q.who);
    } else if (t === 'rv') {
      const q = this.ps.find(x => x.who === a[0]);
      if (q && (st.hp[q.who] || 0) <= 0) { st.hp[q.who] = 60; if (q.isMe) this.myHurt(60); }
    } else if (t === 'esc') { if (st.dr === who) this.end(1); }
  },
  tookIt(k) {
    if (k === 'L') { Arcade.big('⛓️🔒 השרשרת אצלך!', 1800); Arcade.say('🚙 עכשיו — לרכב! (העמוד הכחול)', null, 3000); }
    else { Arcade.big('💵 הקופה של השק"ם!', 1400); }
  },

  // ---------- each frame ----------
  update(dt, t) {
    const H = Heist, me = this.mePl, st = this.st;
    if (!H.host) this.fromHost();
    if (this.live && !this.over) this.T += dt;
    // Host: the alarm clock; the MPs at zero.
    if (H.host && st.al && !this.over && this.live) { st.at -= dt; if (st.at <= 0) this.end(2); }
    if (st.al && !this.alarmed) this.onAlarm();
    if (st.cut && !this.cutDone) this.cutFence();
    if (st.sf && !this.safeShown) this.safeReveal();
    // Me: on foot, or in the car.
    me.down = (st.hp[me.who] != null ? st.hp[me.who] : 100) <= 0;
    me.hidden = st.inn.includes(me.who) || this.boarded;
    if (!me.hidden && !this.pad) this.moveMe(dt, this.mineCarry ? 0.88 : 1);
    else if (this.pad) { me.vx = me.vz = 0; me.v = 0; }
    me.carry = this.mineCarry || 0;
    this.movePeers(dt);
    for (const p of this.ps) if (!p.isMe && !p.bot) { p.down = (st.hp[p.who] != null ? st.hp[p.who] : 100) <= 0; p.hidden = st.inn.includes(p.who); p.carry = st.L === p.who ? 'L' : st.B === p.who ? 'B' : 0; }
    this.moveBots(dt);
    if (H.host && this.live && !this.over && !H.cine) this.simGuards(dt);
    this.drive(dt, t);
    this.shoot(dt);
    this.drawGuards(dt);
    this.drawPlayers(dt);
    this.drawWorld(dt, t);
    // E: a takedown first, then whatever's near.
    const tg = this.live && !this.over && !me.hidden && !me.down && !this.pad ? this.takedownTarget() : null;
    this.tdTarget = tg;
    if (tg) { H.hint(`${G.touch ? '' : 'E — '}להפיל בשקט 💤`); H.meter(null); }
    else if (!me.hidden && !this.over) this.updateUses(dt);
    else { H.hint(''); H.meter(null); }
    if (this.drill.jam > 0) this.drill.jam -= dt;
    if (!(this.useNow && this.useNow.tick && Arcade.input().held)) this.drill.heat = Math.max(0, this.drill.heat - dt * 0.35);
    if (this.useNow && this.useNow.tick && this.holdT > 0) H.meter(this.holdT / 14, `🔩 קודח[/ת]... 🌡️${'▮'.repeat(Math.round(this.drill.heat * 5))}${'▯'.repeat(5 - Math.round(this.drill.heat * 5))}${this.drill.jam > 0 ? ' 🔥 תקוע!' : ''}`);
    this.hud();
    if (this.live && !this.over && !st.al) H.banter(dt, this.gs.some(g => g.sus > 0.5) ? 'seen' : 'sneak', 26);
    H.updatePops(dt);
    // The camera: on me, on the car once we're in it, wider in the open.
    if (me.hidden && st.dr) H.chase(this.car, dt);
    else H.follow(me, dt, { up: this.inside(me) ? 10 : 12.5, back: this.inside(me) ? 7.5 : 9.5 });
  },
  // A guest: the host's word on the guards, the alarm, the safe, the loot, the car.
  fromHost() {
    const st = Heist.hostSt();
    if (!st) return;
    const before = this.gs.map(g => g.st);
    this.guardsIn(st.g);
    this.gs.forEach((g, i) => { if (g.st === 'run' && before[i] !== 'run') this.say(pick(HS_FIN_LINES.run), 'bad'); });
    for (const k of ['al', 'at', 'sf', 'L', 'B', 'dr', 'cut', 'bar']) if (st[k] !== undefined) this.st[k] = st[k];
    this.st.inn = Array.isArray(st.inn) ? st.inn : [];
    this.st.hp = st.hp && typeof st.hp === 'object' ? st.hp : {};
    const mine = this.st.L === Heist.me.who ? 'L' : this.st.B === Heist.me.who ? 'B' : 0;
    if (mine !== this.mineCarry) { if (mine && !this.mineCarry) this.tookIt(mine); this.mineCarry = mine; }
    if (this.mineCarry && this.st[this.mineCarry] !== Heist.me.who) this.mineCarry = 0;
    const hp = this.st.hp[Heist.me.who];
    if (hp != null && hp !== this.mePl.hp) this.myHurt(hp);
    if (st.done && !this.over) this.end(st.done);
  },
  // The platoon (alone): behind you, out of sight; in a firefight they shoot and pick you up.
  moveBots(dt) {
    const H = Heist, me = this.mePl;
    let k = 0;
    for (const p of this.ps) {
      if (!p.bot) continue;
      k++;
      if (this.st.inn.includes(p.who)) { p.hidden = true; continue; }
      p.hidden = false;
      let tx, tz;
      if (me.down) {
        // The nearest one comes to pick you up.
        const near = this.ps.filter(q => q.bot).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
        if (near === p) { tx = me.x + 0.8; tz = me.z; if (Math.hypot(p.x - me.x, p.z - me.z) < 1.3) { p.rvT = (p.rvT || 0) + dt; if (p.rvT > 2.5 && H.host) { p.rvT = 0; this.onEv(p.who, 'rv', [me.who]); Arcade.say(pick(['"קום[/י]! זה רק MILES!"', '"אני חובש[/ת] עכשיו. ככה זה עובד."', '"קדימה, לפני שהם רואים!"']), p.who, 2200); } } else p.rvT = 0; }
      }
      if (tx == null) {
        const back = me.a + Math.PI + (k - 2) * 0.55, dist = 1.8 + (k % 2) * 0.8;
        tx = me.x + Math.cos(back) * dist; tz = me.z + Math.sin(back) * dist;
        if (me.hidden) { tx = this.car.x; tz = this.car.z; }
      }
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      const sp = d > 4 ? 6 : d > 0.6 ? Math.min(3.6, d * 2) : 0;
      const ox = p.x, oz = p.z;
      if (sp) { p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; p.a = Math.atan2(dz, dx); }
      H.collide(p, 0.3, this.bounds);
      if (d > 14) { p.x = tx; p.z = tz; }
      p.v = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-3);
      p.run = false;
      // Firefight: they shoot back.
      if (this.st.al && H.host && this.live) {
        p.cool = (p.cool == null ? 1.5 + Math.random() * 2 : p.cool) - dt;
        if (p.cool <= 0) {
          p.cool = 2.2 + Math.random() * 1.4;
          const g = this.gs.filter(q => q.st === 'hunt' && Math.hypot(q.x - p.x, q.z - p.z) < 13 && H.los(p.x, p.z, q.x, q.z)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
          if (g) { p.a = Math.atan2(g.z - p.z, g.x - p.x); p.aimT = 0.6; this.tracer(p.x, p.z, g.x, g.z); Sound.shot(); if (Math.random() < 0.42) { g.st = 'down'; H.pop(g.x, g.z, pick(HS_FIN_LINES.hit)); } }
        }
      }
      p.aimT = Math.max(0, (p.aimT || 0) - dt);
    }
  },
  // F / a click / 🔫: the MILES pistol at whoever's in front of you.
  shoot(dt) {
    const H = Heist, me = this.mePl;
    this.fireCool -= dt;
    me.aimT = Math.max(0, (me.aimT || 0) - dt);
    H.fire(this.live && !this.over && !me.hidden && !me.down);
    const want = H.pressed('KeyF', 'Mouse0', 'Touch');
    if (!want || !this.live || this.over || me.hidden || me.down || this.pad || this.fireCool > 0 || H.cine) return;
    if (this.ammo <= 0) { Sound.synth.tone(300, 0.05, 'square', 0.03); Arcade.say('🔋 נגמרה הסוללה של ה־MILES', null, 1500); this.fireCool = 0.5; return; }
    this.fireCool = 0.45; this.ammo--; this.me2.shots++;
    let best = null, bs = Infinity;
    for (const g of this.gs) {
      if (g.st === 'down' || g.st === 'off') continue;
      const dx = g.x - me.x, dz = g.z - me.z, d = Math.hypot(dx, dz);
      if (d > 17) continue;
      let da = Math.atan2(dz, dx) - me.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > 0.9 || !H.los(me.x, me.z, g.x, g.z)) continue;
      const score = d + Math.abs(da) * 8;
      if (score < bs) { bs = score; best = g; }
    }
    Sound.shot(); me.aimT = 0.7;
    if (best) { me.a = Math.atan2(best.z - me.z, best.x - me.x); }
    const tx = best ? best.x : me.x + Math.cos(me.a) * 14, tz = best ? best.z : me.z + Math.sin(me.a) * 14;
    this.tracer(me.x, me.z, tx, tz);
    this.emitNoise(me.x, me.z, 14);
    if (best && Math.random() < (bs < 8 ? 0.95 : 0.7)) {
      this.me2.hits++;
      best.myDown = performance.now(); best.st = 'down';
      H.pop(best.x, best.z, pick(HS_FIN_LINES.hit));
      if (H.host) this.onEv(H.me.who, 'sh', [best.i]); else H.emit('sh', best.i);
    }
  },
  act() {
    const H = Heist;
    if (!this.live || this.over || this.pad) return;
    const g = this.tdTarget;
    if (g) {
      g.myDown = performance.now(); g.st = 'down';
      this.me2.tds++;
      Sound.synth.noise(0.15, 0.15, 600); Sound.pop();
      H.pop(g.x, g.z, pick(HS_FIN_LINES.td));
      if (H.host) this.onEv(H.me.who, 'td', [g.i]); else H.emit('td', g.i);
      return;
    }
    this.useTap();
  },
  // The getaway: whoever has the chain drives; out through the base's gate.
  drive(dt, t) {
    const H = Heist, c = this.car, st = this.st;
    const driving = st.dr && st.dr === H.me.who;
    if (driving && !this.over) {
      const hit = H.drive(c, dt, this.live ? H.carInput() : { steer: 0, thr: 0 }, this.bounds);
      if (hit > 4 && c.hitT <= 0) { c.hitT = 0.4; Sound.bump(); G.shake = 0.3; }
      Sound.engine(Math.min(1, Math.abs(c.v) / c.T.top) * (c.type === 'cart' ? 0.35 : 1));
      if (c.T.noise && Math.abs(c.v) > 3 && !st.al) { this.nzT = (this.nzT || 0) - dt; if (this.nzT <= 0) { this.nzT = 1; this.emitNoise(c.x, c.z, 9 * c.T.noise); } }
      // The barrier: down in an alarm. The hummer goes through it, the cart under it.
      if (!this.barCol.off && Math.abs(c.z - HS_EXIT.z) < 3.5 && Math.abs(c.x - HS_EXIT.x) < 5) {
        if (c.type === 'cart') this.barCol.off = true;
        else if (Math.abs(c.v) > (c.type === 'hummer' ? 6 : 10)) { this.barCol.off = true; this.barBroke = true; Sound.boom(); G.shake = 0.6; Arcade.big('💥 המחסום!', 1200); }
      }
      if (c.z > HS_EXIT.z + 3 && !this.escSent) { this.escSent = true; if (H.host) this.onEv(H.me.who, 'esc', []); else H.emit('esc'); }
    } else if (st.dr) {
      // Someone else drives: their car from their presence.
      const o = H.peers().find(q => q.who === st.dr);
      if (o && o.s.car) { H.smooth(c, { x: o.s.car[0], z: o.s.car[1], a: o.s.car[2] }, dt); c.v = o.s.car[3] || 0; }
    }
    H.drawCar(c, dt, t);
  },
  drawWorld(dt, t) {
    const H = Heist, st = this.st, me = this.mePl, s = t / 1000;
    this.roof.visible = !this.inside(me) || me.hidden;
    // The siren light.
    const al = !!st.al;
    this.redL.intensity = al ? 2.2 + Math.sin(s * 9) * 1.4 : 0;
    this.redL.position.x = -6 + Math.cos(s * 6) * 1.5; this.redL.position.z = -8.2 + Math.sin(s * 6) * 1.5;
    this.beaconM.material.emissive.setHex(al ? (Math.sin(s * 9) > 0 ? 0xff2010 : 0x440000) : 0x220000);
    if (H.scene.fog) H.scene.fog.color.setHex(al && Math.sin(s * 9) > 0.6 ? 0x2a0a10 : 0x0a1124);
    // The safe door.
    const open = st.sf ? 1 : 0;
    this.safeOpen = (this.safeOpen || 0) + (open - (this.safeOpen || 0)) * Math.min(1, dt * 2.2);
    this.safeHinge.rotation.y = this.safeOpen * 1.9;
    this.safeGlow.intensity = this.safeOpen * 1.6;
    this.chainIn.visible = !!st.sf && !st.L;
    this.cash.visible = !st.B;
    this.cash.rotation.y += dt;
    // Dropped loot on the ground.
    for (const k of ['L', 'B']) {
      const v = st[k], key = 'drop' + k;
      if (Array.isArray(v)) { if (!this[key]) { this[key] = k === 'L' ? (Assets.model('hs_chain', { length: 0.6 }) || this.fakeChain()) : this.cash.clone(); H.scene.add(this[key]); } this[key].position.set(v[0], 0.05, v[1]); this[key].visible = true; }
      else if (this[key]) this[key].visible = false;
    }
    // The barrier: up, unless there's an alarm (or it's in pieces).
    const up = this.barCol.off ? 1 : 0;
    this.barrier.visible = !this.barBroke;
    this.barrier.rotation.z += (-up * 1.35 - this.barrier.rotation.z) * Math.min(1, dt * 3);
    this.exitB.visible = !!st.L && !this.over;
    H.pulse(this.exitB, s);
    this.foam.position.x = -52.2 + Math.sin(s * 0.6) * 0.5;
    for (const tr of this.tracers || []) { tr.t += dt; tr.m.material.opacity = Math.max(0, 0.9 - tr.t * 6); }
    this.tracers = (this.tracers || []).filter(tr => { if (tr.t < 0.2) return true; H.scene.remove(tr.m); tr.m.geometry.dispose(); tr.m.material.dispose(); return false; });
    this.flashRed = Math.max(0, (this.flashRed || 0) - dt * 2);
    const a = $('#arcade'); if (a) a.style.boxShadow = this.flashRed > 0 ? `inset 0 0 ${80 * this.flashRed}px rgba(255,30,20,${0.7 * this.flashRed})` : '';
  },
  hud() {
    const H = Heist, st = this.st, me = this.mePl;
    if (this.hudOff) return;
    const goal = this.over ? '' : !st.cut && this.appr === 'fence' && !this.inside(me) && me.z < -20 ? '✂️ לחתוך את הגדר (הנקודה הצהובה)' : !st.sf ? '🔐 לשו"ב — לפתוח את הכספת' : !st.L ? '⛓️ לקחת את השרשרת מהכספת' : Array.isArray(st.L) ? '⛓️ השרשרת נפלה! להרים אותה' : st.L === H.me.who && !me.hidden ? '🚙 לרכב! (העמוד הכחול)' : st.dr ? '🏁 החוצה — דרך השער של הבסיס!' : `🚙 ${'מי שיש לו את השרשרת'} — לרכב`;
    H.obj(goal);
    const hp = Math.max(0, st.hp[me.who] == null ? 100 : st.hp[me.who]);
    const mm = Math.floor(Math.max(0, st.at) / 60), ss = String(Math.floor(Math.max(0, st.at) % 60)).padStart(2, '0');
    H.stat(`${st.al ? `🚨 <bdi dir="ltr">${mm}:${ss}</bdi>` : this.opt.uni ? '🎽 במדים' : '🤫 שקט'} · ❤️ ${hp} · 🔋 ${this.ammo}${this.mineCarry === 'L' ? ' · ⛓️' : this.mineCarry === 'B' ? ' · 💵' : ''}`);
    if (this.el2 !== st.al) { this.el2 = st.al; const e = Heist.el && Heist.el.stat; if (e) e.classList.toggle('hs-red', !!st.al); }
  },

  // ---------- the cinema ----------
  introSeq() {
    const H = Heist, solo = H.ctx.solo, who = (id) => (solo ? id : '');
    const s = HS_SPAWN[this.appr];
    const ap = { gate: 'במדים של גוני, מהשער הראשי. לחייך, לנופף, לא לרוץ.', fence: 'הגדר בצפון־מזרח, ליד המכולה. הקאטר אצלך. משם — ישר לשו"ב.', beach: 'מהחוף, דרך הפרצה של המעשנים. הנעליים יירטבו. זה המחיר.' }[this.appr];
    return [
      { img: 'assets/heist/arrive.jpg', text: 'פלמחים. 03:00. הים שקט. גוני — פחות. ' + HS_CARS[this.opt.car || 'hilux'].name + ' עוצר בלי אורות.', ms: 5000 },
      { shot: { from: [s[0] + 6, 18, s[1] + 16], to: [-2, 24, 30], at: [s[0], 0, s[1]], atEnd: [-4, 0, -6], dur: 7500 }, text: 'הסוללה של גוני. משגרים, רדאר, מכולות — ובאמצע, השו"ב.', icon: '🗺️' },
      { shot: { from: [-12, 4, 2], to: [-2, 3.5, 1], at: [-6, 1.2, -3], dur: 6500 }, who: who('p_shaked'), text: 'כל שומר — עם משולש. ירוק זה רגוע, אדום זה ראה אותך. ומי שרואה — רץ לשו"ב ללחוץ על האזעקה.' },
      { img: 'assets/heist/shov.jpg', who: who('p_liran'), text: 'השו"ב. בפנים: הכספת. ובכספת: השרשרת.' + (this.opt.code ? ` ויש לנו את הקוד: ${this.opt.code}.` : ' אין לנו קוד — אז מקדחים. בשקט. כמה שאפשר.') },
      { shot: { from: [-4.5, 2.2, -7.2], to: [-5.5, 2, -7.6], at: [-8, 0.8, -11.6], atEnd: [-3, 0.9, -12.5], dur: 6000 }, who: who('p_nevo'), text: 'מישהו ישן שם בפנים, על הכיסא. אני מזדהה איתו. לא להעיר.' },
      { shot: { from: [s[0] + 2.5, 2.2, s[1] + 4], to: [s[0] + 1.5, 2, s[1] + 3], at: [s[0], 1.3, s[1] - 4], dur: 6000 }, who: who('p_liran'), text: ap },
      { text: G.touch ? 'E מאחורי שומר — להפיל בשקט · 🔫 — MILES (רועש!) · להחזיק E — כספת וגדר' : 'E מאחורי שומר — להפיל בשקט · F / קליק — MILES (רועש!) · להחזיק E — כספת וגדר · Shift — ריצה (רועשת)', icon: '🎮', ms: 5200 },
    ];
  },
  // The safe's open: everyone sees it (the guards wait).
  safeReveal() {
    const H = Heist, n = H.n;
    if (this.safeShown) return;
    this.safeShown = true;
    Sound.ding();
    const solo = H.ctx.solo;
    const live = this.live;
    this.live = false;
    H.play([
      { shot: { from: [-0.9, 2.3, -8.4], to: [-1.6, 1.8, -9.6], at: [HS_SAFE.x, 0.8, HS_SAFE.z], dur: 3500 }, text: '*קליק.* ...*קליק.* ...*קלאנק.*', icon: '🔐', ms: 2600 },
      { img: 'assets/heist/safe_open.jpg', text: 'הדלת נפתחת. ושם, על שמיכה צבאית מקופלת... השרשרת. והמנעול. ✨', ms: 4200 },
      { who: solo ? 'p_shaked' : '', text: 'זה... באמת רק שרשרת ומנעול.', ms: 2600 },
      { who: solo ? 'p_liran' : '', text: 'זה לא "רק". זאת *השרשרת*. לקחת — ורצים לרכב!', ms: 3200 },
    ], { skip: true }).then(() => { if (H.n === n) this.live = live || true; });
  },
  end(how) {
    const H = Heist, n = H.n;
    if (this.over) return;
    this.over = how; this.st.done = how;
    Sound.engine(null);
    Sound.stopSiren();
    this.closePad();
    const solo = H.ctx.solo, al = !!this.st.al, T = this.T;
    if (H.host) {
      const p = H.save();
      p.runs = (p.runs || 0) + 1;
      if (how === 1) { p.wins = (p.wins || 0) + 1; p.best = p.best ? Math.min(p.best, Math.round(T)) : Math.round(T); p.tools = 0; p.car = 0; p.code = 0; p.uni = 0; }
      try { Game.save(); } catch (e) { /* no save in a test */ }
    }
    const win = how === 1;
    if (win) Sound.fanfare(); else Sound.bad();
    const left = H.crew.filter(c => !c.bot && !this.st.inn.includes(c.who));
    const seq = win ? [
      { img: 'assets/heist/escape.jpg', text: al ? 'המחסום מאחורינו. הצפירה מתרחקת. ...או שזה {@p_nevo} נוחר מאחורה.' : 'המחסום מאחורינו. אף אחד בגוני עוד לא יודע. הם יגלו בבוקר. במסדר. מול כולם.', ms: 5200 },
      { img: 'assets/heist/win.jpg', text: 'זריחה על החוף של פלמחים. השרשרת והמנעול של גוני — אצלנו.', ms: 4800 },
      { who: solo ? 'p_liran' : '', text: 'בכנס הגדוד הבא — היא על הצוואר של {name}. ואנחנו מחייכים. רק מחייכים.' },
      { who: solo ? 'p_nevo' : '', text: al ? 'תזכירו לי למה הייתה אזעקה? ...אה, נכון. בגללנו.' : 'בלי אזעקה. בלי שריטה. אני הולך לישון שלושה ימים.' },
    ] : [
      { img: 'assets/heist/fail.jpg', text: 'המשטרה הצבאית. פנסים בפרצוף. "ידיים על הראש". השרשרת נשארת בגוני.', ms: 5200 },
      { who: solo ? 'p_nevo' : '', text: 'רק שתדעו — אני ישנתי כל הערב. יש לי עדים. אתם.' },
      { who: solo ? 'p_shaked' : '', text: 'ההכנות עוד אצלנו. עוד ניסיון — ובשקט הפעם.' },
    ];
    setTimeout(() => {
      if (H.n !== n) return;
      H.play(seq).then(() => { if (H.n === n) this.results(win, left); });
    }, win ? 600 : 1600);
  },
  results(win, left) {
    const H = Heist, st = this.st, al = !!st.al;
    H.obj(''); H.stat(''); H.hint(''); H.meter(null); H.fire(false);
    this.hudOff = true;
    const bonus = st.B && !Array.isArray(st.B);
    const pot = win ? 30 + (al ? 0 : 20) + (bonus ? 10 : 0) : 0;
    const split = H.ctx.solo ? [0.55, 0.15, 0.15, 0.15] : H.crew.map(() => 1 / H.crew.length);
    const others = H.peers();
    const rows = H.crew.map((c, i) => {
      const sx = c.isMe ? [this.me2.tds, this.me2.hits] : ((others.find(o => o.who === c.who) || {}).s || {}).sx || [0, 0];
      const take = Math.round(pot * (split[i] || 0));
      const stay = left.some(q => q.who === c.who) && win;
      return { name: c.name, value: `${take}₪ · 💤 ${sx[0] || 0} · 📟 ${sx[1] || 0}${stay ? ' · 🚶 נשאר[/ה] מאחור' : ''}`, me: c.isMe, take };
    }).sort((a, b) => b.take - a.take);
    const mm = Math.floor(this.T / 60), ss = String(Math.floor(this.T % 60)).padStart(2, '0');
    const fun = win ? [
      `⏱ <bdi dir="ltr">${mm}:${ss}</bdi>`, al ? '🚨 עם אזעקה' : '🤫 בלי אזעקה — בונוס 20₪!', bonus ? '💵 קופת השק"ם — בונוס!' : '', `🍫 במבה שנאכלה בדרך: ${2 + (H.n * 7) % 5}`,
    ].filter(Boolean).join(' · ') : '🚓 המשטרה הצבאית הגיעה. ההכנות נשמרו — אפשר לנסות שוב.';
    const me = rows.find(r => r.me);
    if (win) Game.achieve && Game.achieve('arcade_win');
    Arcade.results(win ? '💰 השוד הצליח!' : '🚓 נתפסתם', rows, { sub: fmt(fun), img: win ? 'assets/heist/win.jpg' : 'assets/heist/fail.jpg', prize: me ? me.take : 0 });
  },
  mine() {
    const p = this.mePl;
    if (!p) return {};
    const o = { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, a: Math.round(p.a * 100) / 100, r: p.run ? 1 : 0, sx: [this.me2.tds, this.me2.hits] };
    if (this.st.dr === Heist.me.who) { const c = this.car; o.car = [Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10, Math.round(c.a * 100) / 100, Math.round(c.v)]; }
    return o;
  },
  hostOut() {
    const st = this.st;
    return { g: this.guardsOut(), al: st.al, at: Math.round(st.at), sf: st.sf, L: st.L, B: st.B, dr: st.dr, inn: st.inn, hp: st.hp, cut: st.cut, done: st.done };
  },
  leave() {
    const H = Heist;
    this.closePad();
    Sound.engine(null);
    Sound.stopSiren();
    const a = $('#arcade'); if (a) a.style.boxShadow = '';
    if (H.el && H.el.stat) H.el.stat.classList.remove('hs-red');
    this.dropL = this.dropB = null; this.tracers = []; this.cutDone = false; this.escSent = false; this.barBroke = false;
  },
});
