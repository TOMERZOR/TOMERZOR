// Sufa soccer (כדורגל סופות): two against two in the race's cars on a sand pitch walled in by
// sandbags, a ball twice the size of a person, goals of camo net, the platoon in the stands
// and the HQ clerk commentating without a breath. Drive into the ball to hit it; boost
// (E / the button) for a harder hit; the walls bounce. Three minutes or first to five.
// Alone: you and a teammate from the platoon against two more. Online: players split into
// the two teams in order; the host's phone moves the ball (and any bots) and the others
// follow it, each phone driving its own car.

const SOC_LINES = {
  kick: ['{@hamalist} (בקריינות): "והכדור אצל — רגע, איפה הכדור? שם! לא, שם!!!"', '{@hamalist}: "איזו מסירה!!! לא הייתה מסירה. אבל איזו!!!"', '{@hamalist}: "ואז הוא נוסע, והוא נוסע, ואז היא אמרה לי—"'],
  goal: ['{@hamalist}: "גוווווווווול!!! גול גול גול!!! אני צריכה מים!!!"', '{@hamalist}: "שער!!! שער של מפקד נסיעה!!!"', '{@commander}: "יפה! ...עכשיו לנקות את החול מהמנוע."'],
  own: ['{@hamalist}: "שער עצמי!!! הו לא!!! זה כל כך מביך!!! אני אספר לכולם!!!"'],
  wall: ['{@harasar}: "השקים! מי ממלא אותם מחדש?!"', '{@rasap}: "כל שק חתום אצלי."'],
};
const SOC_L = 30, SOC_W = 19, SOC_GOAL = 6.5, SOC_R = 1.6;

const SoccerGame = {
  id: 'soccer', name: 'כדורגל סופות', icon: '⚽',
  desc: 'שניים על שניים במכוניות של המירוץ, כדור ענק, שקי חול מסביב — ו{@hamalist} בקריינות.',
  cover: 'assets/arcade/cover_soccer.jpg', solo: true, online: true, minOnline: 2,
  LEN: 180, WIN: 5,

  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0xf2b06a);
    sc.fog = new THREE.Fog(0xf2c89a, 90, 300);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 700);
    sc.add(new THREE.HemisphereLight(0xffe8d0, 0xb88a4a, 0.85));
    const sun = this.sun = new THREE.DirectionalLight(0xffd8a8, 1.1);
    sun.position.set(-30, 40, 20); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 30, bottom: -30, near: 1, far: 120 });
    sc.add(sun);
    Arcade.sky(sc, 'assets/arcade/soccer_stands.jpg', { r: 160, h: 70, y0: -6, repeat: 4 });
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg', 40), color: 0xe9cf98, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.y = -0.02; sand.receiveShadow = true; sc.add(sand);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(SOC_L * 2 + 4, SOC_L * 2 + 4), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/arcade/soccer_pitch.jpg'), roughness: 1 }));
    pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; sc.add(pitch);
    // Sandbag walls around, with gaps for the goals.
    const bag = new THREE.MeshStandardMaterial({ color: 0xc8b07a, roughness: 1 });
    const wall = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), bag); m.position.set(x, 0.7, z); m.castShadow = m.receiveShadow = true; sc.add(m); };
    wall(0, -SOC_W - 0.7, SOC_L * 2 + 2.8, 1.4); wall(0, SOC_W + 0.7, SOC_L * 2 + 2.8, 1.4);
    for (const sx of [-1, 1]) { const len = SOC_W - SOC_GOAL; wall(sx * (SOC_L + 0.7), -(SOC_GOAL + len / 2), 1.4, len); wall(sx * (SOC_L + 0.7), SOC_GOAL + len / 2, 1.4, len); }
    // Flags on the walls.
    for (let i = 0; i < 12; i++) { const f = Scene3D.label('🇮🇱', { bg: 'rgba(0,0,0,0)', size: 1 }); f.position.set(-SOC_L + i * (SOC_L * 2 / 11), 2.4, i % 2 ? SOC_W + 1 : -SOC_W - 1); sc.add(f); }
    // The ball: white and black, big.
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d'); g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#1a1a1a'; for (let i = 0; i < 12; i++) { const x = (i % 6) * 44 + (i > 5 ? 22 : 0), y = i > 5 ? 90 : 34; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } g.fill(); }
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(SOC_R, 28, 18), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.45 }));
    this.ball.castShadow = true; sc.add(this.ball);
    this.soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.goals = [];
    this.fx = [];
  },
  addGoals() {
    for (const g of this.goals) this.scene.remove(g);
    this.goals = [];
    for (const sx of [-1, 1]) {
      const m = Assets.model('arc_goal', { length: SOC_GOAL * 2 + 1, rotY: Math.PI / 2 });
      const g = new THREE.Group();
      if (m) g.add(m);
      else { const net = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, SOC_GOAL * 2), new THREE.MeshStandardMaterial({ color: 0x4b5a2a, transparent: true, opacity: 0.6 })); net.position.y = 1.5; g.add(net); }
      g.position.set(sx * (SOC_L + 1.6), 0, 0); g.rotation.y = sx > 0 ? Math.PI : 0;
      this.scene.add(g); this.goals.push(g);
    }
  },

  // ---------- a match ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    this.addGoals();
    if (!Assets.has('arc_goal')) Arcade.loadModels(['arc_goal']).then(() => { if (this.ctx === ctx) this.addGoals(); });
    Race.loadModels().then(() => { if (this.ctx === ctx) for (const c of this.cars) this.dress(c); });
    const rnd = Arcade.rng(ctx.seed);
    this.host = ctx.solo || !!(ctx.net && ctx.net.host);
    const players = ctx.solo
      ? [{ who: 'me', name: G.profile.name, isMe: true }, ...Arcade.bots(3, rnd).map(b => ({ who: b.id, name: fmt(`{@${b.id}}`), bot: true }))]
      : ctx.players.slice(0, 6).map(p => ({ who: p.isMe ? (Multi.as || 'me') : p.who, name: p.name, isMe: p.isMe, peer: p.peer }));
    // Teams: blue (attacking +x) and red, alternating in order; alone, you and the first bot are blue.
    const cars = RACE_CARS;
    this.cars = players.map((p, i) => {
      const team = ctx.solo ? (i < 2 ? 0 : 1) : i % 2;
      const type = cars[(i + (p.isMe ? 0 : 1)) % cars.length];
      const c = { ...p, team, type, x: 0, z: 0, a: 0, v: 0, ix: 0, iz: 0, spin: 0, steer: 0, boost: 1, boostT: 0, bumpT: 0, skill: p.bot ? 0.78 + rnd() * 0.15 : 1, role: 'attack' };
      c.obj = this.makeCar(c);
      return c;
    });
    // Bots on the same team split: one attacks, one keeps goal.
    for (const team of [0, 1]) { const bots = this.cars.filter(c => c.team === team && c.bot); if (bots.length > 1) bots[1].role = 'defend'; else if (bots.length === 1 && this.cars.filter(c => c.team === team).length > 1) bots[0].role = 'defend'; }
    this.me = this.cars.find(c => c.isMe);
    this.score = [0, 0]; this.t = 0; this.started = false; this.over = false; this.lineT = 3; this.events = []; this.camSnap = true;
    this.kickoff(0);
    this.ui();
    Arcade.buttons({ act: '🚀', run: '⏪ רוורס' });
    this.revOff();
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>⚽ כדורגל סופות</h2>
      <p class="ar-sub">את[ה/] בקבוצה ה${this.me.team === 0 ? 'כחולה 🔵 — תוקפים ימינה ➡️' : 'אדומה 🔴 — תוקפים שמאלה ⬅️'}. ${G.touch ? 'ג\'ויסטיק — לנהוג (נוסעים לבד) · 🚀 — טורבו · ⏪ — רוורס' : 'חצים / WASD — לנהוג · E / רווח — טורבו'} · לנסוע לתוך הכדור כדי לבעוט. ${this.LEN / 60} דקות או ${this.WIN} שערים.</p>`);
    Sound.music('boss');
    Arcade.countdown(performance.now() + (ctx.solo ? 4600 : 3600), () => { Arcade.panel(''); this.started = true; Sound.whistle(); }, '⚽!');
  },
  clear() {
    for (const c of this.cars || []) this.scene.remove(c.obj.root);
    for (const f of this.fx || []) this.scene.remove(f.m);
    this.cars = []; this.fx = [];
  },
  makeCar(c) {
    const root = new THREE.Group(), tilt = new THREE.Group();
    root.add(tilt); this.scene.add(root);
    const flag = Scene3D.label(`${c.team === 0 ? '🔵' : '🔴'} ${c.isMe ? '⭐ ' : ''}${c.name}`, { bg: c.team === 0 ? 'rgba(47,127,224,.92)' : 'rgba(216,38,31,.92)', size: 0.75 });
    flag.position.y = 3.3; root.add(flag);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.6, 32), new THREE.MeshBasicMaterial({ color: c.team === 0 ? 0x2f7fe0 : 0xd8261f, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; root.add(ring);
    const o = { root, tilt };
    c.obj = o;
    this.dress(c);
    return o;
  },
  dress(c) {
    const { tilt } = c.obj;
    while (tilt.children.length) tilt.remove(tilt.children[0]);
    const m = Assets.model('car_' + c.type.id, { length: c.type.len, rotY: c.type.rotY });
    if (m) tilt.add(m);
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(c.type.len, 1.4, 2), new THREE.MeshStandardMaterial({ color: c.team ? 0xd8261f : 0x2f7fe0 })); b.position.y = 0.9; tilt.add(b); }
  },
  // Everyone to their half, the ball to the middle.
  kickoff(conceded) {
    const b = this.b = { x: 0, y: SOC_R, z: 0, vx: 0, vy: 0, vz: 0 };
    this.ball.position.set(0, SOC_R, 0);
    const byTeam = [0, 1].map(t => this.cars.filter(c => c.team === t));
    for (const t of [0, 1]) byTeam[t].forEach((c, k) => {
      const side = t === 0 ? -1 : 1;
      // The first in front at the circle; the others back and wide, out of the camera's way.
      c.x = side * (k ? 23 : 14); c.z = k ? (k % 2 ? 9 : -9) : 0; c.a = t === 0 ? 0 : Math.PI;
      c.v = 0; c.ix = c.iz = 0; c.spin = 0; c.boost = 1; c.steer = 0; c.rev = 0; c.stuckT = 0; c.boostT = 0;
    });
    this.frozen = 1.4; this.celebrate = 0; this.lastTouch = null; this.camSnap = true;
    void b; void conceded;
  },

  // ---------- each frame ----------
  update(dt) {
    this.dt = dt;
    if (this.started && !this.over) {
      this.t += dt;
      if (this.t >= this.LEN) this.finish();
    }
    // After a goal: a moment to celebrate (the ball in the net, everyone can still drive), then
    // everyone back to their half; at the whistle, play on.
    if (this.celebrate > 0) { this.celebrate -= dt; if (this.celebrate <= 0 && !this.over) this.kickoff(this.lastGoal); }
    const wasFrozen = this.frozen > 0;
    this.frozen = Math.max(0, (this.frozen || 0) - dt);
    if (wasFrozen && this.frozen <= 0 && this.started && !this.over && this.t > 1) { Sound.whistle(); Arcade.big('⚽!', 600); }
    const live = this.started && !this.over && this.frozen <= 0;
    for (const c of this.cars) {
      if (c.peer) { this.remote(c, dt); continue; }
      if (!live) { c.v *= Math.exp(-5 * dt); this.moveCar(c, { steer: 0, thr: 0 }, dt); continue; }
      this.moveCar(c, c.isMe ? this.input() : this.bot(c, dt), dt);
    }
    if (this.host) { if (live) { const n = dt > 0.025 ? 2 : 1; for (let i = 0; i < n; i++) this.physics(dt / n); } }
    else this.followBall(dt);
    this.lineT -= dt;
    this.animate(dt);
    this.hud();
    if (this.over && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  input() {
    const k = G.keys, st = G.stick, key = (...c) => (c.some(x => k.has(x)) ? 1 : 0);
    let steer = key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA') + (st.x || 0);
    let thr = key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS');
    if (G.touch && !thr) thr = st.y > 0.45 ? -1 : 1;
    // The phone's second button toggles (it's the world's run button): a tap puts the car in
    // reverse for a moment, or until it's tapped again.
    if (G.touchRun) {
      this.revT = (this.revT || 0) + (this.dt || 0);
      if (this.revT > 1.6) this.revOff(); else thr = -1;
    } else this.revT = 0;
    return { steer: Math.max(-1, Math.min(1, steer)), thr };
  },
  revOff() { G.touchRun = false; this.revT = 0; const r = $('#t-run'); if (r) r.classList.remove('on'); },
  act() { const c = this.me; if (!c || !this.started || this.over || c.boost < 0.3) return; c.boostT = 1.0; c.boost = Math.max(0, c.boost - 0.5); Sound.boost(); },
  moveCar(c, inp, dt) {
    const T = c.type;
    c.steer += (inp.steer - c.steer) * Math.min(1, dt * 8);
    const top = T.top * 0.8 * (c.skill || 1) * (c.boostT > 0 ? 1.45 : 1);
    if (inp.thr > 0) c.v += T.acc * (c.boostT > 0 ? 1.8 : 1) * Math.max(0, 1 - c.v / top) * dt;
    else if (inp.thr < 0) c.v = Math.max(-10, c.v - (c.v > 0 ? 26 : 9) * dt);
    else c.v -= c.v * 0.7 * dt;
    const sp = Math.min(1, Math.abs(c.v) / 8);
    c.a += c.steer * 2.1 * T.grip * sp * Math.sign(c.v || 1) * dt + c.spin * dt;
    c.spin *= Math.exp(-4 * dt);
    const r = T.len * 0.42, inMouth = Math.abs(c.x) > SOC_L - r + 0.01 && Math.abs(c.z) < SOC_GOAL;
    c.x += Math.cos(c.a) * c.v * dt + c.ix * dt; c.z += Math.sin(c.a) * c.v * dt + c.iz * dt;
    c.ix *= Math.exp(-3 * dt); c.iz *= Math.exp(-3 * dt);
    // The walls: sandbags all round (the goal mouths are open, and shallow). A car already in a
    // goal mouth is kept between its posts instead of jumping back onto the pitch.
    if (inMouth) {
      if (Math.abs(c.z) > SOC_GOAL - 1.1) { c.z = Math.sign(c.z) * (SOC_GOAL - 1.1); c.iz *= -0.5; this.thud(c); }
      if (Math.abs(c.x) > SOC_L - r + 2.4) { c.x = Math.sign(c.x) * (SOC_L - r + 2.4); c.v *= -0.3; c.ix *= -0.5; this.thud(c); }
    } else {
      const lx = SOC_L - r + (Math.abs(c.z) < SOC_GOAL - 1.1 ? 2.4 : 0);
      if (Math.abs(c.x) > lx) { c.x = Math.sign(c.x) * lx; c.v *= -0.3; c.ix *= -0.5; this.thud(c); }
    }
    if (Math.abs(c.z) > SOC_W - r) { c.z = Math.sign(c.z) * (SOC_W - r); c.v *= 0.6; c.iz *= -0.5; this.thud(c); }
    c.boostT = Math.max(0, c.boostT - dt); c.boost = Math.min(1, c.boost + dt / 6);
    c.bumpT = Math.max(0, c.bumpT - dt);
  },
  thud(c) { if (c.isMe && c.bumpT <= 0) { c.bumpT = 0.4; Sound.bump(); if (Math.random() < 0.15) Arcade.say(fmt(pick(SOC_LINES.wall)), null, 1800); } },
  // The bots. An attacker gets behind the ball (on the line from the goal it attacks, through
  // the ball) and drives through it; from the wrong side it swings round the ball instead of
  // pushing it home. A defender waits in front of its own goal and comes out when the ball is
  // in its half. Anyone who is stuck against a wall backs out.
  bot(c, dt = 1 / 60) {
    const b = this.b, dir = c.team === 0 ? 1 : -1, gx = dir * SOC_L, ox = -gx;
    const clampX = (x) => Math.max(-SOC_L + 2.5, Math.min(SOC_L - 2.5, x)), clampZ = (z) => Math.max(-SOC_W + 2.5, Math.min(SOC_W - 2.5, z));
    // Backing out of a wall (or another car) for a moment.
    if (c.rev > 0) { c.rev -= dt; return { steer: c.revSteer, thr: -1 }; }
    if (c.wantGo && Math.abs(c.v) < 2.5) c.stuckT = (c.stuckT || 0) + dt; else c.stuckT = 0;
    if (c.stuckT > 0.7) { c.stuckT = 0; c.rev = 0.6 + Math.random() * 0.4; c.revSteer = Math.random() < 0.5 ? -1 : 1; return { steer: c.revSteer, thr: -1 }; }
    // Where the ball will be in a moment.
    const lead = Math.min(0.7, Math.hypot(b.x - c.x, b.z - c.z) / 35);
    const px = clampX(b.x + b.vx * lead), pz = clampZ(b.z + b.vz * lead);
    const inOurHalf = (px - ox) * dir < SOC_L * 0.85;
    const mate = this.cars.find(o => o !== c && o.team === c.team);
    // The defender comes out when the ball is in our half, or when it's much closer than the teammate.
    const closer = mate && Math.hypot(px - c.x, pz - c.z) + 6 < Math.hypot(px - mate.x, pz - mate.z);
    let tx, tz, slow = false, hit = false;
    if (c.role === 'defend' && !inOurHalf && !closer) {
      tx = ox + dir * 6; tz = Math.max(-4, Math.min(4, pz * 0.35));
      slow = Math.hypot(tx - c.x, tz - c.z) < 4;
    } else {
      // From the goal we attack through the ball: the spot behind it.
      const az = Math.max(-3, Math.min(3, pz)), ux0 = px - gx, uz0 = pz - az, ul = Math.hypot(ux0, uz0) || 1, ux = ux0 / ul, uz = uz0 / ul;
      const bx = px + ux * 3.8, bz = pz + uz * 3.8;
      const along = (c.x - px) * -ux + (c.z - pz) * -uz; // > 0: the car is between the ball and the goal it attacks
      if (along > -1.5) {
        // Wrong side: around the ball, a car's length to the side of it.
        const side = (c.z - pz) * ux - (c.x - px) * uz >= 0 ? 1 : -1;
        tx = px + ux * 5 - uz * side * 6.5; tz = pz + uz * 5 + ux * side * 6.5;
      } else if (Math.hypot(bx - c.x, bz - c.z) < 4.5 || along < -2 && Math.abs(((c.x - px) * uz - (c.z - pz) * ux)) < 1.8) { tx = px; tz = pz; hit = true; }
      else { tx = bx; tz = bz; }
    }
    // Not going for the ball: keep out of its way (a car driving home through it scores for them).
    if (!hit) {
      const sx = tx - c.x, sz = tz - c.z, sl = Math.hypot(sx, sz) || 1, ex = sx / sl, ez = sz / sl;
      const tb = (b.x - c.x) * ex + (b.z - c.z) * ez, lat = (b.x - c.x) * -ez + (b.z - c.z) * ex;
      if (tb > 0 && tb < sl + 2 && Math.abs(lat) < 5.5) { const side = lat > 0 ? -1 : 1; tx = b.x + -ez * side * 7; tz = b.z + ex * side * 7; }
    }
    tx = clampX(tx); tz = clampZ(tz);
    let da = Math.atan2(tz - c.z, tx - c.x) - c.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const dist = Math.hypot(tx - c.x, tz - c.z), back = Math.abs(da) > 2.3 && dist < 7;
    const toBall = Math.hypot(b.x - c.x, b.z - c.z);
    if (c.boost > 0.7 && Math.abs(da) < 0.18 && toBall < 14 && hit && Math.random() < dt * 1.5) { c.boostT = 0.9; c.boost -= 0.5; }
    const thr = back ? -1 : slow ? (dist > 1.5 ? 0.3 : 0) : Math.abs(da) > 1.3 ? 0.35 : 1;
    c.wantGo = thr !== 0;
    return { steer: Math.max(-1, Math.min(1, (back ? -da : da) * 2.4)), thr };
  },
  // The ball (on the host): gravity, bounces off the ground, the walls, the posts and the nets;
  // the cars hit it.
  physics(dt) {
    const b = this.b;
    b.vy -= 22 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < SOC_R) { b.y = SOC_R; if (b.vy < -3) { b.vy *= -0.55; this.puff(b.x, b.z, 0xe6d2a6, 1.4); } else b.vy = 0; b.vx *= 1 - dt * 0.6; b.vz *= 1 - dt * 0.6; }
    // A low ceiling over the pitch.
    if (b.y > 12) { b.y = 12; b.vy = -Math.abs(b.vy) * 0.5; }
    this.walls();
    // Into a goal? (After a goal, the ball just rolls about in the net.)
    if (!this.celebrate && Math.abs(b.x) > SOC_L + 0.5 && Math.abs(b.z) < SOC_GOAL) { this.goal(b.x > 0 ? 0 : 1); return; }
    for (const c of this.cars) c.kickT = Math.max(0, (c.kickT || 0) - dt);
    for (const c of this.cars) {
      const r = c.type.len * 0.45 + SOC_R, dx = b.x - c.x, dz = b.z - c.z, d = Math.hypot(dx, dz);
      if (d >= r || d < 0.01 || b.y > 3.6) continue;
      const nx = dx / d, nz = dz / d;
      b.x = c.x + nx * r; b.z = c.z + nz * r;
      const hx = Math.cos(c.a), hz = Math.sin(c.a);
      const cvx = hx * c.v + c.ix, cvz = hz * c.v + c.iz;
      const rel = (cvx - b.vx) * nx + (cvz - b.vz) * nz;
      if (rel > 0) {
        // Along the hit, nudged the way the car points (so you can aim), a little up (more
        // with the turbo). A touch in a row only pushes; a fresh one kicks.
        const fresh = !(c.kickT > 0);
        c.kickT = 0.18;
        const front = Math.max(0, hx * nx + hz * nz);
        let kx = nx + hx * 0.4 * front, kz = nz + hz * 0.4 * front; const kl = Math.hypot(kx, kz); kx /= kl; kz /= kl;
        const k = fresh ? 1.3 + (c.boostT > 0 ? 0.45 : 0) : 1.02;
        b.vx += kx * rel * k; b.vz += kz * rel * k;
        if (fresh) b.vy = Math.max(b.vy, Math.min(8, rel * 0.22 + (c.boostT > 0 ? 3.5 : 0)));
        if (fresh) c.v *= 0.82;
        this.lastTouch = c;
        if (fresh && rel > 6) {
          this.puff(b.x, b.z, 0xffffff, 1);
          if (c.isMe || this.ctx.solo) Sound.synth.noise(0.12, Math.min(0.4, 0.12 + rel * 0.01), 900);
          if (c.isMe && rel > 16) G.shake = Math.max(G.shake || 0, 0.18);
        }
        if (this.lineT <= 0 && rel > 10) { this.lineT = 7; Arcade.say(fmt(pick(SOC_LINES.kick)), null, 2400); }
      }
    }
    const v = Math.hypot(b.vx, b.vz); if (v > 36) { b.vx *= 36 / v; b.vz *= 36 / v; }
    // A car pinning the ball against a wall: the wall wins, the car is pushed back and the
    // ball squirts up out of the squeeze.
    if (this.walls()) for (const c of this.cars) {
      const r = c.type.len * 0.45 + SOC_R, dx = b.x - c.x, dz = b.z - c.z, d = Math.hypot(dx, dz);
      if (d >= r || d < 0.01 || b.y > 3.6) continue;
      if (!c.peer) { c.x -= dx / d * (r - d); c.z -= dz / d * (r - d); c.v *= 0.5; }
      b.vy = Math.max(b.vy, 7);
    }
    // Cars bump each other a little.
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const A = this.cars[i], B = this.cars[j], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), r = (A.type.len + B.type.len) * 0.4;
      if (d >= r || d < 0.01) continue;
      const nx = dx / d, nz = dz / d, o = (r - d) / 2;
      if (!A.peer) { A.x -= nx * o; A.z -= nz * o; A.ix -= nx * 4; A.iz -= nz * 4; }
      if (!B.peer) { B.x += nx * o; B.z += nz * o; B.ix += nx * 4; B.iz += nz * 4; }
      if ((A.isMe || B.isMe) && A.bumpT <= 0) { A.bumpT = 0.4; Sound.bump(); }
    }
    this.ball.position.set(b.x, b.y, b.z);
  },
  // Keeps the ball inside: the side walls, the end walls beside the goals, the four posts, and
  // inside a goal its side and back nets. True if it touched anything.
  walls() {
    const b = this.b, R = SOC_R, sx = Math.sign(b.x) || 1, sz = Math.sign(b.z) || 1;
    let hit = false;
    const reflect = (nx, nz, e) => { const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz; if (vn < -4) this.bounce(); } hit = true; };
    if (Math.abs(b.z) > SOC_W - R) { b.z = sz * (SOC_W - R); reflect(0, -sz, 0.75); }
    // The posts.
    for (const pz of [-SOC_GOAL, SOC_GOAL]) {
      const dx = b.x - sx * SOC_L, dz = b.z - pz, d = Math.hypot(dx, dz), rr = R + 0.3;
      if (d < rr && d > 0.001) { b.x = sx * SOC_L + dx / d * rr; b.z = pz + dz / d * rr; reflect(dx / d, dz / d, 0.7); }
    }
    if (Math.abs(b.x) > SOC_L) {
      // In a goal: its side nets and back net.
      if (Math.abs(b.z) > SOC_GOAL - R) { b.z = sz * (SOC_GOAL - R); reflect(0, -sz, 0.3); }
      if (Math.abs(b.x) > SOC_L + 1.5) { b.x = sx * (SOC_L + 1.5); reflect(-sx, 0, 0.25); }
    } else if (Math.abs(b.x) > SOC_L - R && Math.abs(b.z) >= SOC_GOAL) { b.x = sx * (SOC_L - R); reflect(-sx, 0, 0.75); }
    return hit;
  },
  bounce() { Sound.synth.tone(140, 0.08, 'sine', 0.06); },
  goal(team) {
    this.score[team]++;
    const by = this.lastTouch, own = by && by.team !== team;
    this.lastGoal = team; this.celebrate = 2.6;
    Sound.fanfare(); Sound.horn(); Sound.synth.later(250, () => Sound.synth.noise(1.6, 0.18, 1400, 'bandpass')); // the stands
    Arcade.big(`⚽ גול! ${team === 0 ? '🔵' : '🔴'} ${this.score[0]}:${this.score[1]}`, 2200);
    Arcade.say(`${by ? `<b>${esc(by.name)}</b> · ` : ''}${fmt(pick(own ? SOC_LINES.own : SOC_LINES.goal))}`, null, 3000);
    this.confetti(this.b.x, this.b.z);
    G.shake = 0.6;
    this.b.vx *= 0.35; this.b.vz *= 0.35;
    if (this.score[team] >= this.WIN) this.finish();
  },
  confetti(x, z) { for (let i = 0; i < 40; i++) this.puff(x + (Math.random() - 0.5) * 4, z + (Math.random() - 0.5) * 6, [0xffd23f, 0xff4f6a, 0x4fd1ff, 0xffffff][i % 4], 1.4, 2 + Math.random() * 4); },
  // A guest: the ball, the score and the bots from the host.
  followBall(dt) {
    const h = Arcade.others().find(o => o.host), s = h && h.s;
    if (!s || !s.b) return;
    const [x, y, z, vx, vy, vz] = s.b, b = this.b, k = Math.min(1, dt * 12);
    b.x += (x + vx * 0.08 - b.x) * k; b.y += (y - b.y) * k; b.z += (z + vz * 0.08 - b.z) * k;
    b.vx = vx; b.vy = vy; b.vz = vz;
    this.ball.position.set(b.x, b.y, b.z);
    if (s.sc && (s.sc[0] !== this.score[0] || s.sc[1] !== this.score[1])) {
      const team = s.sc[0] > this.score[0] ? 0 : 1; this.score = s.sc.slice();
      Sound.fanfare(); G.shake = 0.6; this.confetti(b.x, b.z);
      Arcade.big(`⚽ גול! ${team === 0 ? '🔵' : '🔴'} ${this.score[0]}:${this.score[1]}`, 2200);
      // Back to our half when the host does (it celebrates as long).
      this.lastGoal = team; this.celebrate = 2.6;
    }
    if (s.over && !this.over) this.finish();
  },
  remote(c, dt) {
    const o = Arcade.others().find(x => x.peer === c.peer), s = o && o.s;
    if (!s || s.x == null) return;
    const k = Math.min(1, dt * 10);
    c.x += (s.x - c.x) * k; c.z += (s.z - c.z) * k;
    let da = s.a - c.a; da = Math.atan2(Math.sin(da), Math.cos(da)); c.a += da * k;
    c.v = s.v || 0; c.boostT = s.bt ? 0.2 : 0;
  },

  // ---------- drawing ----------
  puff(x, z, color, size, y = 0.6) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color, transparent: true, depthWrite: false }));
    m.position.set(x, y, z); m.scale.setScalar(size); this.scene.add(m);
    this.fx.push({ m, t: 0, s: size });
    if (this.fx.length > 120) { const f = this.fx.shift(); this.scene.remove(f.m); }
  },
  animate(dt) {
    const t = performance.now();
    for (const c of this.cars) {
      const { root, tilt } = c.obj;
      root.position.set(c.x, 0, c.z); root.rotation.y = -c.a;
      const sp = Math.min(1, Math.abs(c.v) / c.type.top);
      tilt.rotation.x = (c.steer || 0) * 0.08 * sp;
      tilt.position.y = Math.abs(Math.sin(t / 70)) * 0.03 * sp;
      if ((c.boostT > 0 || (Math.abs(c.steer) > 0.7 && c.v > 15)) && Math.random() < 0.5) this.puff(c.x - Math.cos(c.a) * c.type.len * 0.5, c.z - Math.sin(c.a) * c.type.len * 0.5, c.boostT > 0 ? 0xff9a3c : 0xe6d2a6, 1);
    }
    // The ball rolls.
    const b = this.b;
    this.ball.rotation.z -= (b.vx || 0) * dt / SOC_R; this.ball.rotation.x += (b.vz || 0) * dt / SOC_R;
    for (const f of this.fx) { f.t += dt; f.m.material.opacity = Math.max(0, 0.7 * (1 - f.t / 0.9)); f.m.scale.setScalar(f.s * (1 + f.t * 2)); f.m.position.y += dt * 0.8; }
    this.fx = this.fx.filter(f => { if (f.t < 0.9) return true; this.scene.remove(f.m); return false; });
    // The camera: behind your car, turned toward the ball (a ball cam, gently).
    const c = this.me, cam = this.camera;
    if (c) {
      const toB = Math.atan2(b.z - c.z, b.x - c.x);
      let da = toB - c.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      const ca = c.a + da * 0.55;
      const want = new THREE.Vector3(c.x - Math.cos(ca) * 11, 6.5, c.z - Math.sin(ca) * 11);
      cam.position.lerp(want, this.camSnap ? 1 : Math.min(1, dt * 4));
      this.camSnap = false;
      if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt); }
      cam.lookAt((c.x + b.x) / 2, 1.2, (c.z + b.z) / 2);
    }
  },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="sc"><div class="sc-board ar-chip"><span class="sc-b">0</span><span class="sc-t"></span><span class="sc-r">0</span></div><div class="sc-boost ar-chip">🚀<i><b></b></i></div><div class="sc-arrow"></div></div>`);
    const h = $('#arcade .sc');
    this.el = { b: h.querySelector('.sc-b'), r: h.querySelector('.sc-r'), t: h.querySelector('.sc-t'), boost: h.querySelector('.sc-boost b'), arrow: h.querySelector('.sc-arrow') };
  },
  hud() {
    const e = this.el, c = this.me;
    if (!e || !c) return;
    e.b.textContent = `🔵 ${this.score[0]}`; e.r.textContent = `${this.score[1]} 🔴`;
    const left = Math.max(0, this.LEN - this.t);
    e.t.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    e.boost.style.width = `${Math.round(c.boost * 100)}%`;
    // Which way to their goal, in case you lose it.
    const gx = c.team === 0 ? SOC_L : -SOC_L;
    let da = Math.atan2(-c.z, gx - c.x) - c.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    e.arrow.style.transform = `translateX(-50%) rotate(${da}rad)`;
  },
  finish() {
    if (this.over) return;
    this.over = true;
    Sound.whistle(); Sound.fanfare();
    const [b, r] = this.score, mine = this.me.team;
    Arcade.big(b === r ? '🤝 תיקו!' : (b > r ? 0 : 1) === mine ? '🏆 ניצחתם!' : '😩 הפסדתם', 2000);
    this.resultsAt = performance.now() + 3000;
  },
  results() {
    const [b, r] = this.score;
    const meFirst = b === r ? -1 : 1; // a draw isn't a win: then you're listed last
    const rows = [...this.cars].sort((x, y) => (this.score[y.team] - this.score[x.team]) || ((y.isMe ? 1 : 0) - (x.isMe ? 1 : 0)) * meFirst).map(c => ({ name: `${c.team === 0 ? '🔵' : '🔴'} ${c.name}`, value: `${this.score[c.team]}:${this.score[1 - c.team]}`, me: c.isMe }));
    const won = (b > r ? 0 : 1) === this.me.team && b !== r;
    Arcade.results(`⚽ כדורגל סופות · ${b}:${r}`, rows, { sub: fmt(won ? '{@hamalist}: "אלופים!!! אני הולכת לספר לכל הבסיס!!! לכל הגדוד!!!"' : '{@hamalist}: "היה משחק מטורף!!! ...מי ניצח? לא שמתי לב, דיברתי."'), img: 'assets/arcade/win_soccer.jpg', prize: won ? 10 : b === r ? 4 : 2 });
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  presence() {
    const c = this.me;
    if (!c) return null;
    const out = { x: Math.round(c.x * 10) / 10, z: Math.round(c.z * 10) / 10, a: Math.round(c.a * 100) / 100, v: Math.round(c.v), bt: c.boostT > 0 ? 1 : 0 };
    if (this.host) { const b = this.b; out.b = [b.x, b.y, b.z, b.vx, b.vy, b.vz].map(n => Math.round(n * 10) / 10); out.sc = this.score; out.over = this.over ? 1 : 0; }
    return out;
  },
  leave() { this.revOff(); this.clear(); this.el = null; this.over = false; this.resultsAt = null; },
};
Arcade.register(SoccerGame);
