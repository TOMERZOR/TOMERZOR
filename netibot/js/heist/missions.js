// Two of the heist's preps that aren't about sneaking past guards:
//  - the safe code (קוד הכספת): a photo through the window of the sticky note on the Johnny
//    duty officer's screen, ducking whenever his chair squeaks round;
//  - the getaway vehicle (רכב מילוט): pick one of three, then drive it to the hideout
//    without wrecking it (or running anyone over).
// Also the driving itself (Heist.makeCar / Heist.drive), used again for the finale's escape.

// ---------- driving ----------
Object.assign(Heist, {
  makeCar(type) {
    const T = HS_CARS[type] || HS_CARS.hilux;
    const root = new THREE.Group(), tilt = new THREE.Group();
    root.add(tilt);
    const m = Assets.model(T.model, { length: T.len, rotY: Math.PI / 2 });
    if (m) tilt.add(m);
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(T.len, 1.5, 2.1), this.mat(type === 'cart' ? 0xeeeeee : 0x8a8456)); b.position.y = 0.9; b.castShadow = true; tilt.add(b); }
    const lights = [];
    for (const s of [-0.55, 0.55]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0 })); l.position.set(T.len / 2 - 0.05, 0.85, s); tilt.add(l); lights.push(l); }
    const beam = new THREE.SpotLight(0xfff0c8, 1.4, 26, 0.5, 0.6, 1.2); beam.position.set(T.len / 2, 1, 0); beam.target.position.set(T.len / 2 + 10, 0, 0); tilt.add(beam); tilt.add(beam.target);
    this.scene.add(root);
    return { root, tilt, T, type, x: 0, z: 0, a: 0, v: 0, steer: 0, hp: T.armor, hitT: 0 };
  },
  carInput() {
    const k = G.keys, st = G.stick;
    const key = (...c) => (c.some(x => k.has(x)) ? 1 : 0);
    let steer = key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA') + (st.x || 0);
    let thr = key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS');
    if (G.touch && !thr) thr = (st.y || 0) > 0.45 ? -1 : (Math.abs(st.x || 0) > 0.05 || (st.y || 0) < -0.2 ? 1 : 0);
    if (G.touchRun || k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Space')) thr = -1;
    return { steer: Math.max(-1, Math.min(1, steer)), thr };
  },
  // One step of a car: gas, steering, the walls. Returns how hard it hit something (0 = nothing).
  drive(c, dt, inp, bounds) {
    const T = c.T;
    c.steer += (inp.steer - c.steer) * Math.min(1, dt * 7);
    if (inp.thr > 0) c.v += T.acc * Math.max(0, 1 - c.v / T.top) * dt;
    else if (inp.thr < 0) c.v = Math.max(-6, c.v - (c.v > 0 ? 20 : 6) * dt);
    else c.v -= c.v * 0.7 * dt;
    const sp = Math.min(1, Math.abs(c.v) / 8);
    c.a += c.steer * 1.9 * T.grip * sp * Math.sign(c.v || 1) * dt;
    const ox = c.x, oz = c.z;
    c.x += Math.cos(c.a) * c.v * dt; c.z += Math.sin(c.a) * c.v * dt;
    // The car as two circles, front and back.
    let hit = 0;
    const r = type => (type === 'cart' ? 0.8 : 1.15);
    for (const s of [0.28, -0.28]) {
      const p = { x: c.x + Math.cos(c.a) * T.len * s, z: c.z + Math.sin(c.a) * T.len * s };
      const bx = p.x, bz = p.z;
      this.collide(p, r(c.type));
      const dx = p.x - bx, dz = p.z - bz;
      if (dx || dz) { c.x += dx; c.z += dz; hit = Math.max(hit, Math.abs(c.v)); }
    }
    if (bounds) { const bx = c.x, bz = c.z; c.x = Math.max(bounds[0], Math.min(bounds[1], c.x)); c.z = Math.max(bounds[2], Math.min(bounds[3], c.z)); if (bx !== c.x || bz !== c.z) hit = Math.max(hit, Math.abs(c.v) * 0.5); }
    if (hit > 0) { c.v *= hit > 6 ? -0.25 : 0.4; if (Math.hypot(c.x - ox, c.z - oz) < 0.01) c.v *= 0.5; }
    c.hitT = Math.max(0, c.hitT - dt);
    return hit;
  },
  drawCar(c, dt, t) {
    c.root.position.set(c.x, 0, c.z);
    c.root.rotation.y = -c.a;
    const sp = Math.min(1, Math.abs(c.v) / c.T.top);
    c.tilt.rotation.x = (c.steer || 0) * 0.07 * sp + (c.hitT > 0 ? Math.sin(c.hitT * 40) * c.hitT * 0.3 : 0);
    c.tilt.position.y = Math.abs(Math.sin(t / 60)) * 0.03 * sp;
    void dt;
  },
  chase(c, dt) {
    if (!this.cam || this.shot) return;
    const back = c.T.len + 5.5, up = 4.4 + c.T.len * 0.3;
    const want = new THREE.Vector3(c.x - Math.cos(c.a) * back, up, c.z - Math.sin(c.a) * back);
    this.cam.position.lerp(want, Math.min(1, dt * 3.5));
    if (G.shake > 0) { this.cam.position.x += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt); }
    this.cam.lookAt(c.x + Math.cos(c.a) * 5, 1.1, c.z + Math.sin(c.a) * 5);
  },
});

// ---------- the safe code: a photo through the window ----------
Heist.stages.code = {
  enter(opt) {
    const H = Heist;
    const code = this.code = String(opt.code || (1000 + Math.floor(Math.random() * 9000)));
    if (H.host && !opt.code) { H.opt = { code }; }
    const sc = H.world({ bg: 0x070a14, fog: null, ground: null, sky: null, moon: 0.2 });
    // Outside: the wall with the window, dark; inside: the room, the console, the officer.
    const wall = H.mat(0x5e5c55, { map: Arcade.texture('assets/heist/tex_concrete.jpg', 2) });
    H.box(-5.2, 0.5, 7.6, 0.3, 5, wall, { col: false }); H.box(5.2, 0.5, 7.6, 0.3, 5, wall, { col: false });
    H.box(0, 0.5, 2.8, 0.3, 0.95, wall, { col: false }); H.box(0, 0.5, 2.8, 0.3, 2.7, wall, { y: 2.3, col: false });
    // The window frame, and a crack in the glass.
    const frame = H.mat(0x3a3d36, { metalness: 0.4 });
    H.box(0, 0.66, 2.9, 0.08, 0.08, frame, { y: 2.26, col: false }); H.box(0, 0.66, 2.9, 0.08, 0.08, frame, { y: 0.95, col: false });
    H.box(-1.42, 0.66, 0.08, 0.08, 1.4, frame, { y: 0.95, col: false }); H.box(1.42, 0.66, 0.08, 0.08, 1.4, frame, { y: 0.95, col: false });
    const sill = H.box(0, 0.75, 3.0, 0.25, 0.08, H.mat(0x6a675e), { y: 0.95, col: false }); void sill;
    // Dirty glass.
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.35), new THREE.MeshStandardMaterial({ color: 0x9ab0c0, transparent: true, opacity: 0.12, roughness: 0.2, metalness: 0.3 }));
    glass.position.set(0, 1.62, 0.5); sc.add(glass);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), H.mat(0x445a3a, { map: Arcade.texture('assets/heist/tex_floor.jpg', 3) }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -3); sc.add(floor);
    const rwall = H.mat(0xa8a69c, { map: Arcade.texture('assets/heist/tex_concrete.jpg', 2) });
    H.box(0, -6.2, 8, 0.2, 3.2, rwall, { col: false }); H.box(-3.8, -3, 0.2, 7, 3.2, rwall, { col: false }); H.box(3.8, -3, 0.2, 7, 3.2, rwall, { col: false });
    H.box(0, -3, 8, 7, 0.2, rwall, { y: 3.2, col: false });
    // The console along the back wall, and the monitor with the note.
    const con = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), new THREE.MeshBasicMaterial({ map: Arcade.texture('assets/heist/console.jpg') }));
    con.position.set(0, 1.55, -6.08); sc.add(con);
    H.box(0, -5.6, 4.6, 1.0, 0.85, H.mat(0x3a3d40), { col: false });
    const mon = H.box(1.1, -5.4, 0.9, 0.12, 0.6, H.mat(0x1a1c1e), { y: 1.0, col: false }); void mon;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ color: 0x3aff8a })); scr.position.set(1.1, 1.3, -5.33); sc.add(scr);
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = '#ffe14a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e8c832'; g.fillRect(0, 0, 128, 14);
    g.fillStyle = '#1a2a6a'; g.font = '700 22px Rubik, Arial'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('כספת!!', 64, 38);
    g.font = '900 38px Rubik, Arial'; g.direction = 'ltr'; g.fillText(code, 64, 84); g.font = '700 15px Rubik, Arial'; g.direction = 'rtl'; g.fillText('לא לגלות לאף אחד', 64, 112);
    const note = this.note = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    note.position.set(1.62, 1.42, -5.3); note.rotation.z = -0.12; sc.add(note);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 10), H.mat(0xffffff)); mug.position.set(-0.6, 0.91, -5.4); sc.add(mug);
    const lamp = new THREE.PointLight(0xd8ffd8, 1.0, 9, 1.5); lamp.position.set(0, 2.8, -3.5); sc.add(lamp);
    const scrGlow = new THREE.PointLight(0x5aff9a, 0.6, 4); scrGlow.position.set(0.4, 1.4, -4.8); sc.add(scrGlow);
    // The officer in his chair, his back to the window.
    const chair = this.chair = new THREE.Group(); sc.add(chair);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), H.mat(0x222222)); seat.position.y = 0.5; chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), H.mat(0x222222)); back.position.set(0, 0.8, 0.3); chair.add(back);
    chair.position.set(0.5, 0, -4.4);
    const off = this.off = H.soldier({ id: null, skin: DATA.skinTones[1], hair: DATA.hairColors[0], head: 'none', female: false, rank: 2 }, null);
    this.offA = -Math.PI / 2; // facing the console (−z)
    // Outside: a bit of the night behind you, the sea glow.
    const out = new THREE.PointLight(0x3050a0, 0.5, 10); out.position.set(0, 2, 3); sc.add(out);
    H.cam.fov = 50;
    this.yaw = 0; this.pitch = 0; this.duck = 0; this.focus = 0; this.seen = 0; this.strikes = 0;
    this.ph = 'work'; this.phT = 4 + Math.random() * 2; this.turn = 0; this.done = 0; this.live = false; this.flash = 0;
    this.ui();
    const n = H.n;
    H.play([
      { img: 'assets/heist/prep_code.jpg', who: Cast.get('p_choco') ? 'p_choco' : '', text: 'קצין התורן של ג׳וני? הוא כותב את הקוד של הכספת על פתק צהוב ומדביק על המסך. כולם יודעים. חוץ ממנו.' },
      { shot: { from: [0, 1.6, 3.4], to: [0, 1.55, 2.4], at: [0.6, 1.3, -5], dur: 6000 }, who: H.ctx.solo ? 'p_shaked' : '', text: 'כל כמה שניות הכיסא שלו חורק — והוא מסתובב לחלון. כשהוא חורק: להתכופף!' },
      { shot: { from: [0, 1.55, 2.4], to: [0.3, 1.5, 1.6], at: [1.62, 1.42, -5.3], dur: 5000 }, text: G.touch ? '🕹️ לכוון · להחזיק E — לצלם כשהפתק בעיגול · ריצה — להתכופף' : '⬅️➡️⬆️⬇️ לכוון · להחזיק E — לצלם כשהפתק בעיגול · Shift — להתכופף', icon: '📸' },
    ]).then(() => { if (H.n === n) this.live = true; });
  },
  ui() {
    const a = $('#arcade');
    const v = document.createElement('div');
    v.className = 'hs-cam'; v.innerHTML = '<div class="hs-ret"><i></i></div><div class="hs-rec">● REC</div><div class="hs-flash"></div>';
    a.appendChild(v); this.view = v;
  },
  update(dt) {
    const H = Heist;
    if (!H.host) { const st = H.hostSt(); if (st && st.done && !this.done) this.win(); }
    const inp = this.live && !this.done ? Arcade.input() : { x: 0, y: 0, run: false, held: false };
    // Aim (the phone in your hands), duck under the sill.
    this.yaw = Math.max(-0.42, Math.min(0.42, this.yaw - inp.x * dt * 0.9));
    this.pitch = Math.max(-0.25, Math.min(0.22, this.pitch + inp.y * dt * 0.7));
    const duck = !!inp.run;
    this.duck += ((duck ? 1 : 0) - this.duck) * Math.min(1, dt * 9);
    // The officer: works, squeaks, turns round, stares, turns back.
    this.phT -= dt;
    if (this.live && !this.done) {
      if (this.ph === 'work' && this.phT <= 0) { this.ph = 'tell'; this.phT = 0.95; Sound.synth.tone(1400, 0.35, 'sawtooth', 0.025, 900); Sound.synth.tone(700, 0.3, 'square', 0.015, 500); Arcade.say('🪑 *חריקה*', null, 900); }
      else if (this.ph === 'tell' && this.phT <= 0) { this.ph = 'look'; this.phT = 1.8 + Math.random() * 1.4; }
      else if (this.ph === 'look' && this.phT <= 0) { this.ph = 'work'; this.phT = 3.2 + Math.random() * 3.5; }
    }
    this.turn += ((this.ph === 'look' ? 1 : 0) - this.turn) * Math.min(1, dt * (this.ph === 'look' ? 7 : 4));
    const fa = this.offA + this.turn * Math.PI;
    this.chair.rotation.y = -fa - Math.PI / 2;
    Scene3D.animateSoldier(this.off, { x: 0.5 / S3, y: -4.4 / S3, angle: fa, speed: 0, sit: true }, false, dt);
    // Seen through the window when he's looking and you're not down.
    if (this.ph === 'look' && this.turn > 0.7 && this.duck < 0.5 && !this.done) {
      this.seen += dt;
      if (this.seen > 0.35) this.spotted();
    } else this.seen = Math.max(0, this.seen - dt);
    // The camera: your eyes, behind the phone.
    const cam = H.cam;
    if (!H.shot) {
      cam.position.set(0.15, 1.6 - this.duck * 1.0, 2.3);
      cam.rotation.order = 'YXZ'; cam.rotation.set(this.pitch - this.duck * 0.35, this.yaw, 0);
    }
    cam.updateMatrixWorld();
    // The note in the circle, steady, E held: focus.
    const p = this.note.position.clone().project(cam);
    const s = Scene3D.renderer.getSize(new THREE.Vector2());
    const dpx = Math.hypot(p.x * s.x / 2, p.y * s.y / 2), rad = Math.min(s.x, s.y) * 0.11;
    const inRing = p.z < 1 && dpx < rad && this.duck < 0.3;
    if (this.live && !this.done && inp.held && inRing) this.focus = Math.min(1, this.focus + dt / 1.3);
    else this.focus = Math.max(0, this.focus - dt * (inp.held ? 0.6 : 1.5));
    if (this.focus >= 1 && !this.done) this.snap();
    if (this.view) {
      this.view.classList.toggle('on', !H.cine);
      this.view.classList.toggle('in', inRing);
      this.view.querySelector('.hs-ret i').style.transform = `scale(${1 - this.focus * 0.55})`;
      this.flash = Math.max(0, this.flash - dt * 2.5);
      this.view.querySelector('.hs-flash').style.opacity = this.flash;
    }
    H.obj(this.done ? '✅ יש תמונה!' : `📸 לצלם את הפתק · ${'❌'.repeat(this.strikes)}${'⬜'.repeat(Math.max(0, 3 - this.strikes))}`);
    H.stat(this.ph === 'look' && this.turn > 0.4 ? '👀 הוא מסתכל!' : this.ph === 'tell' ? '🪑 חורק!' : this.duck > 0.5 ? '🫣 מתכופף[/ת]' : '☕ עובד');
    H.hint(this.done || !this.live ? '' : this.duck > 0.5 ? '' : inRing ? (G.touch ? 'להחזיק E — לצלם' : 'להחזיק E — לצלם') : 'לכוון את העיגול לפתק הצהוב');
  },
  spotted() {
    const H = Heist;
    this.seen = 0; this.strikes++;
    this.ph = 'work'; this.phT = 3.5;
    Sound.bad(); G.shake = 0.3;
    Arcade.big('👀 הוא ראה אותך!', 1300);
    Arcade.say(pick(['קצין התורן: "מי שם?! ...חתול. בטח חתול."', 'קצין התורן: "שוב הג\'וק הזה בחלון?"', 'קצין התורן: "אני רואה אותך! ...אני רואה את ההשתקפות שלי. בסדר."']), null, 2600);
    if (this.strikes >= 3) {
      this.done = 2;
      const n = H.n;
      setTimeout(() => {
        if (H.n !== n) return;
        H.play([{ img: 'assets/heist/fail.jpg', name: 'קצין התורן', icon: '🎖️', text: 'שלוש פעמים פרצוף בחלון. אני לא חתול. גם אתם לא. לכו לישון.' }, { who: H.ctx.solo ? 'p_liran' : '', text: 'עוד ניסיון. הפעם — להתכופף כשזה חורק. זה כל הסוד.' }]).then(() => { if (H.n === n && H.host) H.go('code'); });
      }, 900);
    }
  },
  snap() {
    const H = Heist;
    this.flash = 1;
    Sound.synth.noise(0.12, 0.25, 4000); Sound.synth.tone(1800, 0.05, 'square', 0.05);
    if (H.host) this.win(); else H.emit('photo');
    this.done = 1;
  },
  onEv(who, t) { if (t === 'photo' && !this.done) { this.done = 1; this.win(); } },
  win() {
    const H = Heist;
    if (this.won) return;
    this.won = true; this.done = 1;
    if (H.host) H.prepDone('code', this.code);
    Sound.fanfare();
    Arcade.big(`📸 ${this.code}`, 2000);
    const n = H.n;
    setTimeout(() => {
      if (H.n !== n) return;
      H.play([
        { shot: { from: [0.9, 1.5, -3.6], to: [1.25, 1.45, -4.6], at: [1.62, 1.42, -5.3], dur: 4000 }, text: `הפתק: "כספת!! ${this.code} — לא לגלות לאף אחד". ...טוב שלא גילה.`, icon: '📸' },
        { who: H.ctx.solo ? 'p_nevo' : '', text: 'בתמונה רואים גם את האצבע שלך. אבל גם את הקוד. נחשב.' },
      ]).then(() => { if (H.n === n && H.host) H.go('board'); });
    }, 1400);
  },
  act() {},
  mine() { return { dn: this.done ? 1 : 0 }; },
  hostOut() { return { done: this.won ? 1 : 0 }; },
  leave() { if (this.view) this.view.remove(); this.view = null; this.won = false; if (Heist.cam) Heist.cam.rotation.order = 'XYZ'; },
};

// ---------- the getaway vehicle: pick one, then drive it to the hideout ----------
// The course: from the battery's motor pool, out the back road, round the dunes, to the old
// container where the crew hides things.
const HS_ROUTE = [[0, 0], [0, -40], [-22, -66], [-22, -100], [12, -128], [44, -120], [58, -150], [40, -182]];
Heist.stages.car = {
  enter(opt) {
    const H = Heist;
    this.type = opt.car || null;
    if (!this.type) { this.pick(); return; }
    this.course();
  },
  // The car cards (the host picks; everyone else waits).
  pick() {
    const H = Heist;
    H.world({ bg: 0x241a2a, fog: [40, 160], moon: 0.7 });
    const shed = H.mat(0x8a8f8a, { metalness: 0.4, roughness: 0.5 });
    H.box(0, -3, 18, 8, 0.15, shed, { y: 3.6, col: false });
    for (const x of [-9, -3, 3, 9]) for (const z of [-6.8, 0.8]) H.box(x, z, 0.15, 0.15, 3.6, shed, { col: false });
    this.show = Object.keys(HS_CARS).map((id, i) => { const c = H.makeCar(id); c.x = (i - 1) * 6; c.z = -3; c.a = Math.PI / 2 + 0.5; H.drawCar(c, 0, 0); const l = new THREE.PointLight(0xffd090, 1.1, 8, 1.6); l.position.set(c.x, 3.3, -3); H.scene.add(l); return c; });
    H.cam.position.set(0, 3.2, 9); H.cam.lookAt(0, 1.0, -3);
    this.t = 0;
    const host = H.host;
    const card = (c) => `<div class="hs-car" data-c="${c.id}"><img src="${c.img}" alt=""><b>${c.name}</b><i>${c.desc}</i>
      <div class="hs-bars"><span>מהירות</span><u style="--v:${c.stats[0] * 20}%"></u><span>שריון</span><u style="--v:${c.stats[1] * 20}%"></u><span>שקט</span><u style="--v:${c.stats[2] * 20}%"></u></div>
      ${host ? '<button class="btn small">✔ זה הרכב</button>' : ''}</div>`;
    const box = H.board(`<div class="hs-bd hs-pick"><div class="hs-bhead"><h2>🚙 רכב מילוט — לבחור</h2><p>${host ? 'כל רכב — יתרונות וחסרונות. אחר כך — לנהוג בו למחבוא.' : '⏳ המארח/ת בוחר[/ת]...'}</p></div>
      <div class="hs-cars">${Object.values(HS_CARS).map(card).join('')}</div><div class="hs-go"><button class="btn ghost" data-back>↩ ללוח</button></div></div>`);
    if (!box) return;
    box.querySelector('[data-back]').onclick = () => { Sound.click(); if (H.host) H.go('board'); };
    if (!host) { box.querySelector('[data-back]').remove(); return; }
    box.querySelectorAll('.hs-car').forEach(el => el.onclick = () => { Sound.horn(); H.go('car', { car: el.dataset.c }); });
  },
  course() {
    const H = Heist;
    H.world({ bg: 0x1a1730, fog: [50, 190], rep: 60, size: 520, moon: 0.75 });
    this.bounds = [-60, 110, -215, 25];
    // The road: asphalt strips between the points; cones and soldiers along it.
    for (let i = 0; i < HS_ROUTE.length - 1; i++) { const [x0, z0] = HS_ROUTE[i], [x1, z1] = HS_ROUTE[i + 1]; H.road(x0, z0, x1, z1, 9, 0.02 + i * 0.002); }
    const rnd = Arcade.rng(H.n * 77 + 5);
    this.cones = [];
    const cone = H.mat(0xff6a1a), white = H.mat(0xffffff);
    for (let i = 1; i < HS_ROUTE.length - 1; i++) {
      const [x0, z0] = HS_ROUTE[i], [x1, z1] = HS_ROUTE[i + 1];
      for (let k = 0; k < 3; k++) {
        const f = 0.25 + k * 0.25 + (rnd() - 0.5) * 0.1, side = rnd() < 0.5 ? -1 : 1, a = Math.atan2(z1 - z0, x1 - x0);
        const x = x0 + (x1 - x0) * f - Math.sin(a) * side * (1 + rnd() * 2), z = z0 + (z1 - z0) * f + Math.cos(a) * side * (1 + rnd() * 2);
        const g = new THREE.Group(); const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 10), cone); c1.position.y = 0.38; g.add(c1); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 10), white); b.position.y = 0.4; g.add(b);
        g.position.set(x, 0, z); H.scene.add(g);
        this.cones.push({ g, x, z, hit: false, vx: 0, vz: 0, vy: 0 });
      }
    }
    // Things you can't drive through: containers along the way, the motor pool shed, the hideout.
    this.walls = [[10, -20, 2.6, 6.2], [-10, -52, 6.2, 2.6], [-34, -84, 2.6, 6.2], [-9, -84, 2.6, 6.2], [28, -112, 6.2, 2.6], [50, -136, 2.6, 6.2], [26, -160, 6.2, 2.6]];
    for (const [x, z, w, d] of this.walls) H.col(x, z, w, d, 2.6);
    this.decor = [];
    // People crossing (don't).
    this.walkers = [[-11, -58], [-22, -110], [46, -128]].map(([x, z], i) => {
      const m = H.soldier(Arcade.look(i === 0 && Cast.get('harasar') ? 'harasar' : null), i === 0 ? fmt('{@harasar}') : null);
      return { m, x, z, x0: x, t: i * 2, hit: 0 };
    });
    const [ex, ez] = HS_ROUTE[HS_ROUTE.length - 1];
    this.goal = { x: ex, z: ez };
    H.col(ex, ez - 6, 6.2, 2.6, 2.6);
    this.beam = H.beacon(ex, ez, 0x5adfff, 12);
    // Checkpoints: the route's points (rings you drive through).
    this.cps = HS_ROUTE.slice(1).map(([x, z]) => ({ x, z }));
    this.cpI = 0;
    this.cpRing = H.beacon(this.cps[0].x, this.cps[0].z, 0xffd34a, 5);
    this.car = H.makeCar(this.type);
    this.car.a = -Math.PI / 2;
    this.others = new Map();
    this.t = 0; this.time = 60; this.live = false; this.arrived = false; this.over = 0; this.hits = 0; this.near = 0;
    this.st = { arr: [], done: 0 };
    this.dress();
    H.cam.position.set(0, 6, 10); H.cam.lookAt(0, 1, -5);
    Sound.music('deploy');
    const T = HS_CARS[this.type], n = H.n;
    H.play([
      { img: 'assets/heist/prep_car.jpg', who: H.ctx.solo ? 'p_liran' : '', text: `${T.name}. ${T.desc}` },
      { shot: { from: [6, 3, 4], to: [-4, 2.4, 3], at: [0, 1, -1], dur: 5000 }, who: H.ctx.solo ? 'p_shaked' : '', text: 'למחבוא — המכולה הישנה בדיונות. לעבור בטבעות הצהובות, לא לדרוס אף אחד, ולא לשרוט. הרס"פית סופרת שריטות.' },
      { shot: { from: [0, 5, 9], to: [0, 4.6, 8], at: [0, 1, -6], dur: 4000 }, text: G.touch ? '🕹️ להטות — הגה · הגז אוטומטי · משיכה אחורה או ריצה — ברקס' : '⬆️ גז · ⬅️➡️ הגה · ⬇️ / רווח — ברקס', icon: '🚙' },
    ]).then(() => { if (H.n !== n) return; Arcade.countdown(performance.now() + 3200, () => { this.live = true; Sound.horn(); }, 'סע!'); });
  },
  dress() {
    const H = Heist;
    if (!this.walls) return;
    for (const o of this.decor || []) H.scene.remove(o);
    this.decor = [];
    for (const [x, z, w] of this.walls) { const m = Assets.model('container', { size: [2.6, 2.6, 6.2] }); if (m) { m.position.set(x, 0, z); m.rotation.y = w > 3 ? Math.PI / 2 : 0; H.scene.add(m); this.decor.push(m); } else this.decor.push(H.box(x, z, w, w > 3 ? 2.6 : 6.2, 2.6, H.mat(0x5b6b3c), { col: false })); }
    const h = Assets.model('container', { size: [2.6, 2.6, 6.2] }); if (h) { h.position.set(this.goal.x, 0, this.goal.z - 6); h.rotation.y = Math.PI / 2; H.scene.add(h); this.decor.push(h); }
    for (const [x, z] of [[14, -60], [-36, -120], [70, -150], [-30, -30]]) { const p = Assets.model('palm', { height: 8 }); if (p) { p.position.set(x, 0, z); H.scene.add(p); this.decor.push(p); } }
    const r = Assets.model('radar', { height: 5 }); if (r) { r.position.set(22, 0, 8); H.scene.add(r); this.decor.push(r); }
    // A fresh car once the models are in.
    if (this.car && !this.car.root.children[0].children[0]?.isGroup && Assets.has(HS_CARS[this.type].model)) { const o = this.car; H.scene.remove(o.root); const c = H.makeCar(this.type); Object.assign(c, { x: o.x, z: o.z, a: o.a, v: o.v, hp: o.hp }); this.car = c; }
  },
  update(dt, t) {
    const H = Heist;
    if (!this.car) {
      // The picker: the cars turn slowly in their lamps.
      this.t += dt;
      for (const c of this.show || []) { c.a += dt * 0.25; H.drawCar(c, dt, t); }
      return;
    }
    if (!H.host) { const st = H.hostSt(); if (st && st.done && !this.over) this.finish(st.done); }
    const c = this.car;
    if (this.live && !this.arrived && !this.over) {
      this.time -= dt;
      const hit = H.drive(c, dt, H.carInput(), this.bounds);
      if (hit > 3 && c.hitT <= 0) { c.hitT = 0.5; c.hp -= hit > 9 ? 2 : 1; this.hits++; Sound.bump(); G.shake = 0.35; Arcade.say(pick(['💥 שריטה! הרס"פית תדע.', '💥 אאוץ\'. זה היה חדש?', '💥 זה לא נחשב. נכון?']), null, 1600); if (c.hp <= 0) this.wreck(); }
      Sound.engine(Math.min(1, Math.abs(c.v) / c.T.top) * (c.type === 'cart' ? 0.4 : 1));
      // The checkpoints, in order.
      const cp = this.cps[this.cpI];
      if (cp && Math.hypot(c.x - cp.x, c.z - cp.z) < 7) {
        this.cpI++; Sound.ding();
        if (this.cpI < this.cps.length) { this.cpRing.position.set(this.cps[this.cpI].x, 0, this.cps[this.cpI].z); this.time += 4; Arcade.big('4+ ⏱', 600); }
        else this.cpRing.visible = false;
      }
      if (this.cpI >= this.cps.length && Math.hypot(c.x - this.goal.x, c.z - this.goal.z) < 6) this.arrive();
      if (this.time <= 0) this.wreck(true);
    } else if (!this.live || this.over || this.arrived) { c.v *= Math.exp(-3 * dt); if (Math.abs(c.v) > 0.2) { c.x += Math.cos(c.a) * c.v * dt; c.z += Math.sin(c.a) * c.v * dt; } Sound.engine(null); }
    // Cones fly, people jump out of the way.
    for (const k of this.cones) {
      if (!k.hit && Math.hypot(k.x - c.x, k.z - c.z) < 1.4 && Math.abs(c.v) > 2) { k.hit = true; k.vx = Math.cos(c.a) * c.v * 0.6 + (Math.random() - 0.5) * 4; k.vz = Math.sin(c.a) * c.v * 0.6 + (Math.random() - 0.5) * 4; k.vy = 5; Sound.pop(); this.near++; }
      if (k.hit && k.g.position.y > -1) { k.vy -= 15 * dt; k.g.position.x += k.vx * dt; k.g.position.z += k.vz * dt; k.g.position.y = Math.max(0, k.g.position.y + k.vy * dt); k.g.rotation.x += dt * 8; if (k.g.position.y === 0) { k.vx *= 0.9; k.vz *= 0.9; } }
    }
    for (const w of this.walkers) {
      w.t += dt;
      const x = w.x0 + Math.sin(w.t * 0.5) * 5;
      const vx = Math.cos(w.t * 0.5) * 2.5;
      if (w.hit > 0) { w.hit -= dt; }
      else { w.x = x; if (Math.hypot(w.x - c.x, w.z - c.z) < 2.2 && Math.abs(c.v) > 3) { w.hit = 2; w.x += Math.sign(w.x - c.x || 1) * 2.5; c.hp -= 1; this.hits++; Sound.whistle(); Arcade.say(w.m.tag ? fmt('{@harasar}: "דרסת לי את הנעל!!! אני רושם את המספר!"') : pick(['"היי!!! יש פה אנשים!"', '"מה את[ה/] עושה?! זה מעבר חציה!"']), null, 2600); if (c.hp <= 0) this.wreck(); } }
      Arcade.pose(w.m, w.x, w.z, vx > 0 ? 0 : Math.PI, w.hit > 0 ? 6 : Math.abs(vx), dt);
    }
    // The others' cars (online), drawn from their presence.
    for (const o of H.peers()) {
      const s = o.s;
      if (!s || !s.car) continue;
      let r = this.others.get(o.who);
      if (!r) { r = H.makeCar(this.type); r.x = s.car[0]; r.z = s.car[1]; r.a = s.car[2]; this.others.set(o.who, r); const l = Scene3D.label(o.name, { size: 0.45 }); l.position.y = 2.6; r.root.add(l); }
      H.smooth(r, { x: s.car[0], z: s.car[1], a: s.car[2] }, dt);
      r.v = s.car[3] || 0;
      H.drawCar(r, dt, t);
    }
    H.drawCar(c, dt, t);
    H.pulse(this.cpRing, t / 1000); H.pulse(this.beam, t / 1000);
    H.chase(c, dt);
    H.updatePops(dt);
    H.obj(this.arrived ? '✅ במחבוא!' : `🚙 למחבוא · טבעת ${Math.min(this.cpI + 1, this.cps.length)}/${this.cps.length}`);
    H.stat(`⏱ ${Math.max(0, Math.ceil(this.time))} · 🛡️ ${'■'.repeat(Math.max(0, c.hp))}${'□'.repeat(Math.max(0, c.T.armor - Math.max(0, c.hp)))}`);
    // Host: everyone's in (or the host is, and the rest had their chance).
    if (H.host && !this.over) {
      const all = H.crew.filter(q => !q.bot);
      const inn = all.filter(q => q.isMe ? this.arrived : this.st.arr.includes(q.who));
      if (inn.length === all.length || (this.arrived && (this.arrT = (this.arrT || 0) + dt) > 20)) this.finish(1);
    }
  },
  arrive() {
    const H = Heist;
    if (this.arrived) return;
    this.arrived = true;
    Sound.fanfare(); Arcade.big('🏁 במחבוא!', 1600);
    if (!H.host) H.emit('arr');
  },
  wreck(timeout = false) {
    const H = Heist;
    if (this.over) return;
    if (!H.host && !H.ctx.solo) { this.arrived = true; Arcade.big(timeout ? '⏱ נגמר הזמן' : '💥 הרכב גמור', 1600); H.emit('arr'); return; }
    this.finish(2, timeout);
  },
  onEv(who, t) { if (t === 'arr' && !this.st.arr.includes(who)) this.st.arr.push(who); },
  finish(how, timeout = false) {
    const H = Heist;
    if (this.over) return;
    this.over = how; this.st.done = how;
    Sound.engine(null);
    const n = H.n, T = HS_CARS[this.type];
    if (how === 1) {
      if (H.host) H.prepDone('car', this.type);
      const clean = this.hits === 0;
      setTimeout(() => { if (H.n !== n) return; H.play([
        { img: 'assets/heist/prep_car.jpg', who: H.ctx.solo ? 'p_nevo' : '', text: clean ? `${T.name} במחבוא. בלי שריטה אחת. אני לא מאמין. מי את[ה/]?` : `${T.name} במחבוא. עם ${this.hits} שריטות ו${this.near} קונוסים פחות. נגיד שזה "בלאי סביר".` },
      ]).then(() => { if (H.n === n && H.host) H.go('board'); }); }, 1500);
    } else {
      Sound.bad();
      setTimeout(() => { if (H.n !== n) return; H.play([
        { img: 'assets/heist/fail.jpg', who: Cast.get('rasap') ? 'rasap' : '', text: timeout ? 'שעה וחצי לנסוע 300 מטר? החזירו את הרכב. עכשיו.' : 'מה עשיתם לרכב?! ...אל תענו. אני כבר יודעת. מחר — רישום תקלות.' },
      ]).then(() => { if (H.n === n && H.host) H.go('car', { car: this.type }); }); }, 1200);
    }
  },
  act() {},
  mine() { const c = this.car; return c ? { car: [Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10, Math.round(c.a * 100) / 100, Math.round(c.v)] } : {}; },
  hostOut() { return { done: this.st ? this.st.done : 0 }; },
  leave() { Sound.engine(null); Heist.board(null); this.car = null; this.show = null; this.walls = null; this.others = new Map(); },
};
