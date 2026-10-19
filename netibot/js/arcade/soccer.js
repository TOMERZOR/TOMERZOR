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
    this.score = [0, 0]; this.t = 0; this.started = false; this.over = false; this.lineT = 3; this.events = [];
    this.kickoff(0);
    this.ui();
    Arcade.buttons({ act: '🚀', run: 'בלם' });
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>⚽ כדורגל סופות</h2>
      <p class="ar-sub">את[ה/] בקבוצה ה${this.me.team === 0 ? 'כחולה 🔵 — תוקפים ימינה ➡️' : 'אדומה 🔴 — תוקפים שמאלה ⬅️'}. ${G.touch ? 'ג\'ויסטיק — לנהוג · 🚀 — טורבו · בלם' : 'חצים / WASD — לנהוג · E / רווח — טורבו'} · לנסוע לתוך הכדור כדי לבעוט. ${this.LEN / 60} דקות או ${this.WIN} שערים.</p>`);
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
      c.x = side * (14 + k * 6); c.z = (k % 2 ? 1 : -1) * k * 4; c.a = t === 0 ? 0 : Math.PI;
      c.v = 0; c.ix = c.iz = 0; c.spin = 0; c.boost = 1;
    });
    this.frozen = 1.2;
    void b; void conceded;
  },

  // ---------- each frame ----------
  update(dt) {
    if (this.started && !this.over) {
      this.t += dt;
      if (this.t >= this.LEN) this.finish();
    }
    this.frozen = Math.max(0, (this.frozen || 0) - dt);
    const live = this.started && !this.over && this.frozen <= 0;
    for (const c of this.cars) {
      if (c.peer) { this.remote(c, dt); continue; }
      if (!live) { c.v *= 0.9; this.moveCar(c, { steer: 0, thr: 0 }, dt); continue; }
      this.moveCar(c, c.isMe ? this.input() : this.bot(c), dt);
    }
    if (this.host) { if (live) this.physics(dt); }
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
    if (G.touchRun) thr = -1;
    return { steer: Math.max(-1, Math.min(1, steer)), thr };
  },
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
    c.x += Math.cos(c.a) * c.v * dt + c.ix * dt; c.z += Math.sin(c.a) * c.v * dt + c.iz * dt;
    c.ix *= Math.exp(-3 * dt); c.iz *= Math.exp(-3 * dt);
    // The walls: sandbags all round (the goal mouths are open, and shallow).
    const r = T.len * 0.42, lx = SOC_L - r + (Math.abs(c.z) < SOC_GOAL ? 2.4 : 0);
    if (Math.abs(c.x) > lx) { c.x = Math.sign(c.x) * lx; c.v *= -0.3; this.thud(c); }
    if (Math.abs(c.z) > SOC_W - r) { c.z = Math.sign(c.z) * (SOC_W - r); c.v *= 0.6; c.iz *= -0.5; this.thud(c); }
    c.boostT = Math.max(0, c.boostT - dt); c.boost = Math.min(1, c.boost + dt / 6);
    c.bumpT = Math.max(0, c.bumpT - dt);
  },
  thud(c) { if (c.isMe && c.bumpT <= 0) { c.bumpT = 0.4; Sound.bump(); if (Math.random() < 0.15) Arcade.say(fmt(pick(SOC_LINES.wall)), null, 1800); } },
  // The bots: an attacker goes for the ball from behind it (aiming at the goal), a defender
  // stays between the ball and its own goal.
  bot(c) {
    const b = this.b, gx = c.team === 0 ? SOC_L : -SOC_L, own = -gx;
    let tx, tz;
    if (c.role === 'defend' && Math.sign(b.x - own) * Math.sign(-own) < 0.5 && Math.abs(b.x - own) > 14) { tx = own * 0.7 + (b.x - own) * 0.25; tz = b.z * 0.5; }
    else {
      // A point just behind the ball, on the line from the goal through the ball.
      const dx = b.x - gx, dz = b.z, d = Math.hypot(dx, dz) || 1;
      tx = b.x + dx / d * 3.2; tz = b.z + dz / d * 3.2;
      if (Math.hypot(tx - c.x, tz - c.z) < 3.5) { tx = b.x; tz = b.z; }
    }
    let da = Math.atan2(tz - c.z, tx - c.x) - c.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const back = Math.abs(da) > 2.4 && Math.hypot(tx - c.x, tz - c.z) < 8;
    if (c.boost > 0.8 && Math.abs(da) < 0.2 && Math.hypot(b.x - c.x, b.z - c.z) < 12 && Math.random() < 0.02) { c.boostT = 0.9; c.boost -= 0.5; }
    return { steer: Math.max(-1, Math.min(1, (back ? -da : da) * 2.2)), thr: back ? -1 : Math.abs(da) > 1.4 ? 0.4 : 1 };
  },
  // The ball (on the host): gravity, bounces off the ground and walls, cars hit it.
  physics(dt) {
    const b = this.b;
    b.vy -= 22 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < SOC_R) { b.y = SOC_R; if (b.vy < -3) { b.vy *= -0.55; this.puff(b.x, b.z, 0xe6d2a6, 1.4); } else b.vy = 0; b.vx *= 1 - dt * 0.6; b.vz *= 1 - dt * 0.6; }
    // Into a goal?
    if (Math.abs(b.x) > SOC_L + SOC_R * 0.4 && Math.abs(b.z) < SOC_GOAL) { this.goal(b.x > 0 ? 0 : 1); return; }
    if (Math.abs(b.x) > SOC_L - SOC_R && Math.abs(b.z) >= SOC_GOAL - 0.3) { b.x = Math.sign(b.x) * (SOC_L - SOC_R); b.vx *= -0.75; this.bounce(); }
    if (Math.abs(b.x) > SOC_L + 2.6) { b.x = Math.sign(b.x) * (SOC_L + 2.6); b.vx *= -0.5; }
    if (Math.abs(b.z) > SOC_W - SOC_R) { b.z = Math.sign(b.z) * (SOC_W - SOC_R); b.vz *= -0.75; this.bounce(); }
    // A low ceiling over the pitch, and a speed limit, so it stays a game.
    if (b.y > 12) { b.y = 12; b.vy = -Math.abs(b.vy) * 0.5; }
    const v = Math.hypot(b.vx, b.vz); if (v > 38) { b.vx *= 38 / v; b.vz *= 38 / v; }
    for (const c of this.cars) c.kickT = Math.max(0, (c.kickT || 0) - dt);
    for (const c of this.cars) {
      const r = c.type.len * 0.45 + SOC_R, dx = b.x - c.x, dz = b.z - c.z, d = Math.hypot(dx, dz);
      if (d >= r || d < 0.01 || b.y > 3.6) continue;
      const nx = dx / d, nz = dz / d;
      b.x = c.x + nx * r; b.z = c.z + nz * r;
      const cvx = Math.cos(c.a) * c.v + c.ix, cvz = Math.sin(c.a) * c.v + c.iz;
      const rel = (cvx - b.vx) * nx + (cvz - b.vz) * nz;
      if (rel > 0 && !(c.kickT > 0)) {
        // One kick per touch: along the hit, a little up (more with the turbo).
        c.kickT = 0.18;
        const k = 1.3 + (c.boostT > 0 ? 0.45 : 0);
        b.vx += nx * rel * k; b.vz += nz * rel * k;
        b.vy = Math.max(b.vy, Math.min(7, rel * 0.22 + (c.boostT > 0 ? 3 : 0)));
        c.v *= 0.82;
        this.lastTouch = c;
        if (rel > 6) { this.puff(b.x, b.z, 0xffffff, 1); if (c.isMe || this.ctx.solo) Sound.synth.noise(0.12, 0.25, 900); }
        if (this.lineT <= 0 && rel > 10) { this.lineT = 7; Arcade.say(fmt(pick(SOC_LINES.kick)), null, 2400); }
      }
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
  bounce() { Sound.synth.tone(140, 0.08, 'sine', 0.06); },
  goal(team) {
    this.score[team]++;
    const own = this.lastTouch && this.lastTouch.team !== team;
    Sound.fanfare(); Sound.horn();
    Arcade.big(`⚽ גול! ${team === 0 ? '🔵' : '🔴'} ${this.score[0]}:${this.score[1]}`, 2000);
    Arcade.say(fmt(pick(own ? SOC_LINES.own : SOC_LINES.goal)), null, 3000);
    for (let i = 0; i < 40; i++) this.puff(this.b.x + (Math.random() - 0.5) * 4, this.b.z + (Math.random() - 0.5) * 6, [0xffd23f, 0xff4f6a, 0x4fd1ff, 0xffffff][i % 4], 1.4, 2 + Math.random() * 4);
    G.shake = 0.6;
    this.goalT = (this.goalT || 0) + 1;
    if (this.score[team] >= this.WIN) { this.finish(); return; }
    this.kickoff(team);
  },
  // A guest: the ball, the score and the bots from the host.
  followBall(dt) {
    const h = Arcade.others().find(o => o.host), s = h && h.s;
    if (!s || !s.b) return;
    const [x, y, z, vx, vy, vz] = s.b, b = this.b, k = Math.min(1, dt * 12);
    b.x += (x + vx * 0.08 - b.x) * k; b.y += (y - b.y) * k; b.z += (z + vz * 0.08 - b.z) * k;
    this.ball.position.set(b.x, b.y, b.z);
    if (s.sc && (s.sc[0] !== this.score[0] || s.sc[1] !== this.score[1])) { const team = s.sc[0] > this.score[0] ? 0 : 1; this.score = s.sc.slice(); Sound.fanfare(); Arcade.big(`⚽ גול! ${team === 0 ? '🔵' : '🔴'} ${this.score[0]}:${this.score[1]}`, 2000); this.kickoff(team); }
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
      cam.position.lerp(want, Math.min(1, dt * 4));
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
    const rows = [...this.cars].sort((x, y) => (this.score[y.team] - this.score[x.team])).map(c => ({ name: `${c.team === 0 ? '🔵' : '🔴'} ${c.name}`, value: `${this.score[c.team]}:${this.score[1 - c.team]}`, me: c.isMe }));
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
  leave() { this.clear(); this.el = null; this.over = false; this.resultsAt = null; },
};
Arcade.register(SoccerGame);
