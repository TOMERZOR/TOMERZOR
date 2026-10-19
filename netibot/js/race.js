// The driving commanders' race (תחרות מפקדי נסיעה): a world of its own, a desert circuit.
// The player is the driving commander in the passenger seat and gives the orders; the driver
// does the rest. Everyone picks a car, cars bump and knock each other off the line, and
// friends online join through an invite. Alone, three commanders from the cast race you.
// The track map, the cars and the horizon were made with Higgsfield (assets/race/, and the
// car models in assets/models/car_*.json); the road itself follows RACE_POINTS, which the
// map was painted over (tools: a guide image drawn from the same points).
const RACE_POINTS = [[0, -70], [60, -78], [100, -55], [108, -15], [82, 12], [48, 18], [30, 45], [52, 80], [25, 108], [-30, 104], [-60, 78], [-58, 40], [-92, 20], [-104, -25], [-72, -60]];
const RACE_MAP = { cx: 2.171, cz: 15.677, size: 280 };
const RACE_HALF = 8; // half the road's width, in meters
const RACE_LAPS = 3;
// top: m/s, acc: m/s², grip: turning, mass: who wins a bump, len: model length (m). The
// models were lifted facing +z; rotY turns them to face +x like everything else here.
const RACE_CARS = [
  { id: 'sufa', name: 'סופה', desc: 'זריזה בפניות', top: 33, acc: 15, grip: 1.15, mass: 1, len: 4.1, rotY: Math.PI / 2 },
  { id: 'hummer', name: 'האמר', desc: 'כבד. מעיף את כולם', top: 31, acc: 12.5, grip: 0.95, mass: 1.7, len: 4.8, rotY: Math.PI / 2 },
  { id: 'hilux', name: 'היילקס', desc: 'מאוזנת בכל', top: 34, acc: 14, grip: 1.0, mass: 1.25, len: 5.2, rotY: Math.PI / 2 },
  { id: 'van', name: 'ההסעה', desc: 'טסה בישורת, נוטה בסיבוב', top: 37, acc: 11.5, grip: 0.82, mass: 1.45, len: 5.6, rotY: Math.PI / 2 },
  { id: 'picanto', name: 'הפיקנטו של אמא', desc: 'קטנה, מהירה, עפה מכל מכה', top: 33, acc: 17, grip: 1.2, mass: 0.7, len: 3.6, rotY: Math.PI / 2 },
];
// What your driver says, and what the commanders shout.
const RACE_LINES = {
  go: ['סע! סע! סע!', 'גז, גז, גז!', 'חגורה? חגורה. סע!'],
  bump: ['הוא נכנס בי!!!', 'סליחה! ...לא באמת', 'מי לימד אותו לנהוג?!', 'זה לא נחשב תאונה, נכון?', 'בום! 💥'],
  sand: ['אני בחול!!! תכוון אותי!', 'זה לא כביש, זה חוף!', 'החול נכנס לי לנעליים!'],
  pass: ['עקפנו!!!', 'ביי ביי! 👋', 'מפקד נסיעה אגדי!'],
  passed: ['הוא עקף אותנו!', 'תן לי פקודה! מהר!', 'אני לא מאמין...'],
  boost: ['🗣️ "סע כבר!!!"', '🗣️ "גז!!! עכשיו!!!"', '🗣️ "יאללה, יאללה!!!"'],
  lap: ['עוד סיבוב!', 'הסיבוב האחרון! הכל או כלום!'],
  taunt: ['ימינה! ימינה!', 'זוז, זה תור שלי!', 'אני מפקד נסיעה כבר שנה!', 'חגורה!', 'תעקוף אותו!'],
};

const Race = {
  active: false,
  phase: null,     // 'pick' | 'lobby' | 'countdown' | 'race' | 'done'
  scene: null,
  cars: [],
  me: null,
  net: null,       // { id, host } when racing with friends online
  seenInvites: new Set(),

  // ---------- the track ----------
  samples: null,
  buildTrack() {
    if (this.samples) return;
    const P = RACE_POINTS, n = P.length, out = [];
    const cr = (a, b, c, d, t) => [0, 1].map(i => 0.5 * (2 * b[i] + (-a[i] + c[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t * t + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * t * t * t));
    for (let i = 0; i < n; i++) for (let k = 0; k < 40; k++) out.push(cr(P[(i - 1 + n) % n], P[i], P[(i + 1) % n], P[(i + 2) % n], k / 40));
    this.samples = out.map(([x, z], i) => {
      const [nx, nz] = out[(i + 1) % out.length];
      const a = Math.atan2(nz - z, nx - x);
      return { x, z, a };
    });
  },
  // The nearest point of the road to (x, z), searched around the last known one.
  nearest(x, z, from = null) {
    const S = this.samples, N = S.length;
    let best = 0, bd = Infinity;
    const scan = (i) => { const s = S[(i + N) % N], d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = (i + N) % N; } };
    if (from == null) for (let i = 0; i < N; i++) scan(i);
    else for (let i = from - 30; i <= from + 30; i++) scan(i);
    return { i: best, d: Math.sqrt(bd) };
  },

  // ---------- the world ----------
  build() {
    if (this.scene) return;
    this.buildTrack();
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x9fd0f2);
    sc.fog = new THREE.Fog(0xcfe3ee, 180, 520);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1400);
    sc.add(new THREE.HemisphereLight(0xe8f2ff, 0xc9a56a, 0.85));
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d4, 1.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
    sc.add(sun, sun.target);
    const tex = (src, rep = 1) => { const t = new THREE.TextureLoader().load(src); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; if (rep !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; };
    // The desert all around, then the Higgsfield map of the circuit on top.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: tex('assets/tex/sand.jpg', 60), color: 0xe9cf98, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.y = -0.06; sand.receiveShadow = true; sc.add(sand);
    const map = new THREE.Mesh(new THREE.PlaneGeometry(RACE_MAP.size, RACE_MAP.size), new THREE.MeshStandardMaterial({ map: tex('assets/race/map.jpg'), roughness: 0.95 }));
    map.rotation.x = -Math.PI / 2; map.position.set(RACE_MAP.cx, 0, RACE_MAP.cz); map.receiveShadow = true; sc.add(map);
    // The horizon, all the way around.
    const skyT = tex('assets/race/sky.jpg'); skyT.wrapS = THREE.RepeatWrapping; skyT.repeat.set(2, 1);
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(620, 620, 300, 48, 1, true), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false }));
    sky.position.set(RACE_MAP.cx, 110, RACE_MAP.cz); sc.add(sky);
    this.props();
    this.fx = { dust: [], stars: [], confetti: [] };
    this.dustTex = this.softTex('rgba(235,215,170,1)');
  },
  softTex(color) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  },
  // Tire walls on the outside of the bends, flags along the straights, and the start gate.
  props() {
    const S = this.samples, N = S.length, sc = this.scene;
    const black = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 });
    const tire = new THREE.TorusGeometry(0.42, 0.2, 8, 14);
    for (let i = 0; i < N; i += 7) {
      let turn = S[(i + 8) % N].a - S[(i - 8 + N) % N].a;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      if (Math.abs(turn) < 0.32) continue;
      const side = turn > 0 ? -1 : 1; // the outside of the bend
      const s = S[i], ox = -Math.sin(s.a) * side, oz = Math.cos(s.a) * side;
      for (let k = 0; k < 3; k++) {
        const t = new THREE.Mesh(tire, black);
        t.rotation.x = Math.PI / 2;
        t.position.set(s.x + ox * (RACE_HALF + 4), 0.2 + k * 0.38, s.z + oz * (RACE_HALF + 4));
        t.castShadow = true;
        sc.add(t);
      }
    }
    // Start gate: two posts and a checkered banner.
    const s0 = S[0], nx = -Math.sin(s0.a), nz = Math.cos(s0.a);
    const post = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    for (const k of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7, 10), post);
      p.position.set(s0.x + nx * k * (RACE_HALF + 1.2), 3.5, s0.z + nz * k * (RACE_HALF + 1.2));
      p.castShadow = true; sc.add(p);
    }
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
    const g = c.getContext('2d');
    for (let x = 0; x < 64; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); g.fillRect(x * 16, 96 + y * 16, 16, 16); }
    g.fillStyle = '#c0392b'; g.fillRect(0, 32, 1024, 64);
    g.fillStyle = '#fff'; g.font = '900 52px Rubik, Arial'; g.textAlign = 'center'; g.direction = 'rtl';
    g.fillText('🏁 תחרות מפקדי נסיעה 🏁', 512, 82);
    const bt = new THREE.CanvasTexture(c); bt.encoding = THREE.sRGBEncoding;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2 * RACE_HALF + 2.4, 2.2), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide }));
    banner.position.set(s0.x, 6.2, s0.z);
    banner.rotation.y = -s0.a - Math.PI / 2; // across the road, facing the cars coming in
    sc.add(banner);
    // Flags on the inside of the straights.
    const flagT = new THREE.TextureLoader().load('assets/race/flag.png');
    for (let i = 20; i < N; i += 60) {
      const s = S[i], fx = s.x - Math.sin(s.a) * (RACE_HALF + 3), fz = s.z + Math.cos(s.a) * (RACE_HALF + 3);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 5, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
      pole.position.set(fx, 2.5, fz); sc.add(pole);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), new THREE.MeshBasicMaterial({ map: flagT, side: THREE.DoubleSide, transparent: true }));
      f.position.set(fx + 0.8, 4.4, fz); f.userData.wave = i; sc.add(f);
      (this.flags = this.flags || []).push(f);
    }
  },

  // The car models load the first time someone races.
  loadCars() {
    if (this.carsLoading) return this.carsLoading;
    const loader = new THREE.GLTFLoader();
    this.carsLoading = Promise.all(RACE_CARS.map(c => new Promise(ok => {
      if (Assets.models['car_' + c.id]) return ok();
      loader.load(`assets/models/car_${c.id}.json`, (g) => {
        g.scene.traverse(o => { if (o.isMesh) { o.material.metalness = 0.1; o.material.roughness = 0.6; } });
        Assets.models['car_' + c.id] = g.scene;
        ok();
      }, undefined, () => ok());
    })));
    return this.carsLoading;
  },
  makeCar(type) {
    const root = new THREE.Group(), tilt = new THREE.Group();
    root.add(tilt);
    const m = Assets.model('car_' + type.id, { length: type.len, rotY: type.rotY });
    if (m) tilt.add(m);
    else {
      // Until the model is in: a box car.
      const body = new THREE.Mesh(new THREE.BoxGeometry(type.len, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x6b7a3a }));
      body.position.y = 0.9; body.castShadow = true; tilt.add(body);
    }
    this.shadowTex = this.shadowTex || this.softTex('rgba(0,0,0,0.55)');
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(type.len * 1.25, 2.9), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; root.add(shadow);
    this.scene.add(root);
    return { root, tilt };
  },

  // ---------- entering and leaving ----------
  // From the menu or the race spot: pick a car, then race the bots or friends.
  open(join = null) {
    if (this.active || G.alert || Boss.active || Story.ctl || Mini.active) { UI.toast('לא עכשיו', 'bad'); return; }
    this.active = true;
    this.phase = 'pick';
    this.net = join;
    this.build();
    this.loadCars();
    $('#hud').classList.add('hidden');
    $('#overlay').classList.add('hidden');
    // On the phone: the run button brakes and E is the commander's shout.
    $('#t-run').textContent = 'בלם';
    $('#t-act').textContent = '🗣️';
    $('#look').classList.add('hidden');
    Sound.music('boss');
    this.ui();
    this.pickScreen();
  },
  exit() {
    if (!this.active) return;
    Sound.engine(null);
    for (const c of this.cars) this.scene.remove(c.obj.root);
    for (const d of this.fx.dust) this.scene.remove(d.m);
    for (const s of [...this.fx.stars, ...this.fx.confetti]) this.scene.remove(s.m);
    for (const r of this.remoteCars.values()) this.scene.remove(r.obj.root);
    this.remoteCars.clear();
    this.fx.dust = []; this.fx.stars = []; this.fx.confetti = [];
    this.cars = []; this.me = null; this.net = null;
    this.active = false; this.phase = null;
    const u = $('#race'); if (u) u.remove();
    $('#hud').classList.remove('hidden');
    $('#overlay').classList.remove('hidden');
    $('#t-run').textContent = 'ריצה';
    $('#t-act').textContent = 'E';
    $('#look').classList.remove('hidden');
    UI.fade(() => {});
  },

  // ---------- UI ----------
  ui() {
    let u = $('#race');
    if (u) u.remove();
    u = document.createElement('div');
    u.id = 'race';
    u.innerHTML = `<div class="rc-hud hidden"><div class="rc-pos"></div><div class="rc-lap"></div><div class="rc-time"></div><div class="rc-spd"></div>
      <canvas class="rc-mini" width="150" height="150"></canvas>
      <button class="rc-boost">🗣️ צעקה<i><b></b></i></button><div class="rc-say hidden"></div></div>
      <div class="rc-cd hidden"></div><div class="rc-panel hidden"></div>
      <button class="rc-x" title="יציאה" aria-label="יציאה מהמירוץ">✕</button>`;
    document.body.appendChild(u);
    u.querySelector('.rc-x').addEventListener('click', () => this.exit());
    u.querySelector('.rc-boost').addEventListener('pointerdown', (e) => { e.preventDefault(); this.boost(); });
  },
  panel(html) {
    const p = $('#race .rc-panel');
    p.innerHTML = html;
    p.classList.toggle('hidden', !html);
    return p;
  },
  pickScreen() {
    const p = this.panel(`<img class="rc-banner" src="assets/race/intro.jpg" alt=""><h2>🏁 תחרות מפקדי נסיעה</h2>
      <p class="rc-sub">את[ה/] מפקד[/ת] הנסיעה: את[ה/] נותנ[/ת] פקודות (חצים / ג'ויסטיק), הנהג מבצע. 3 סיבובים. מותר להתנגש 😈</p>
      <div class="rc-cars">${RACE_CARS.map((c, i) => `<button class="rc-car" data-i="${i}"><img src="assets/race/car_${c.id}.webp" alt=""><b>${c.name}</b><i>${c.desc}</i>
        <span class="rc-stat">מהירות<s style="--v:${Math.round((c.top - 28) / 10 * 100)}%"></s></span><span class="rc-stat">תאוצה<s style="--v:${Math.round((c.acc - 10) / 8 * 100)}%"></s></span><span class="rc-stat">משקל<s style="--v:${Math.round(c.mass / 1.8 * 100)}%"></s></span></button>`).join('')}</div>`);
    p.innerHTML = fmt(p.innerHTML);
    p.querySelectorAll('.rc-car').forEach(b => b.addEventListener('click', () => this.chose(RACE_CARS[+b.dataset.i])));
  },
  async chose(type) {
    this.myType = type;
    Sound.pickup();
    if (this.net) { this.lobby(); return; }
    const online = Multi.on && Multi.peers.length;
    if (!online) { this.startSolo(); return; }
    const p = this.panel(`<h2>${type.name} ✔</h2><p class="rc-sub">עם מי מתחרים?</p>
      <div class="rc-row"><button class="btn" data-m="friends">👥 להזמין את כל מי שמחובר (${Multi.peers.length})</button><button class="btn ghost" data-m="bots">🤖 נגד מפקדים מהפלגה</button></div>`);
    p.querySelector('[data-m=friends]').addEventListener('click', () => { this.net = { id: Date.now(), host: true, startAt: performance.now() + 20000 }; this.lobby(); });
    p.querySelector('[data-m=bots]').addEventListener('click', () => this.startSolo());
  },

  // ---------- grid ----------
  addCar(type, opts) {
    const obj = this.makeCar(type);
    const c = { type, obj, x: 0, z: 0, a: 0, v: 0, ix: 0, iz: 0, spin: 0, steer: 0, thr: 0, idx: 0, lap: 0, half: false, fin: 0, bumpT: 0, boost: 0, boostT: 0, dustT: 0, ...opts };
    if (c.label) { c.tag = Scene3D.label(c.label, { bg: c.isMe ? 'rgba(242,193,46,.95)' : 'rgba(20,26,16,.82)', fg: c.isMe ? '#1b1b1b' : '#f4f1e6', size: 0.9 }); c.tag.position.y = 3.4; obj.root.add(c.tag); }
    this.cars.push(c);
    return c;
  },
  gridSpot(slot) {
    const N = this.samples.length;
    const s = this.samples[(N - 6 - Math.floor(slot / 2) * 12) % N];
    const side = slot % 2 ? 1 : -1;
    return { x: s.x - Math.sin(s.a) * side * 3.4, z: s.z + Math.cos(s.a) * side * 3.4, a: s.a, idx: this.samples.indexOf(s) };
  },
  place(c, slot) {
    const g = this.gridSpot(slot);
    Object.assign(c, { x: g.x, z: g.z, a: g.a, idx: g.idx, v: 0, lap: 0, half: false, crossed: false, prev: g.idx });
  },
  myLabel() { return `🗣️ ${fmt('{name}')}`; },
  startSolo() {
    this.net = null;
    this.clearCars();
    this.me = this.addCar(this.myType, { isMe: true, label: this.myLabel(), driver: pick(['driver1', 'driver2']) });
    // Three commanders from the cast, each in a different car.
    const cast = ROSTER.people.filter(p => p.map === 'netivot' && p.id.startsWith('p_'));
    const names = cast.length ? cast.sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.short) : ['בוט 1', 'בוט 2', 'בוט 3'];
    const others = RACE_CARS.filter(t => t !== this.myType).sort(() => Math.random() - 0.5);
    names.forEach((n, i) => this.addCar(others[i % others.length], { bot: true, label: `🗣️ ${n}`, skill: 0.86 + Math.random() * 0.1, lane: (Math.random() - 0.5) * 6 }));
    // The rivals in front, you at the back of the grid: everyone to overtake.
    [...this.cars.filter(c => c.bot), this.me].forEach((c, i) => this.place(c, i));
    this.countdown(performance.now() + 3600);
  },
  clearCars() { for (const c of this.cars) this.scene.remove(c.obj.root); this.cars = []; },

  // Online: wait at the start line for whoever joins, then everyone starts together.
  lobby() {
    this.phase = 'lobby';
    this.clearCars();
    this.me = this.addCar(this.myType, { isMe: true, label: this.myLabel(), driver: pick(['driver1', 'driver2']) });
    this.panel(`<h2>🏁 ממתינים למפקדים...</h2><p class="rc-sub rc-wait"></p><div class="rc-who"></div>`);
  },
  // Players in this race, me included, in grid order (by cast id, the same on every phone).
  racers() {
    const ids = Multi.peers.filter(p => p.race && this.net && p.race.id === this.net.id).map(p => p.who);
    return [...ids, Multi.as || 'me'].sort();
  },
  updateLobby() {
    const left = Math.max(0, (this.net.startAt - performance.now()) / 1000);
    const w = $('#race .rc-wait'), who = $('#race .rc-who');
    if (w) w.textContent = `המירוץ מתחיל בעוד ${Math.ceil(left)} שניות`;
    const peers = Multi.peers.filter(p => p.race && p.race.id === this.net.id);
    if (who) who.innerHTML = [`<span>🗣️ ${esc(G.profile.name)} · ${this.myType.name}</span>`, ...peers.map(p => `<span><bdi data-raw>${esc(p.name)}</bdi> · ${(RACE_CARS.find(t => t.id === p.race.car) || RACE_CARS[0]).name}</span>`)].join('');
    // A guest follows the host's clock.
    if (!this.net.host) {
      const h = Multi.peers.find(p => p.race && p.race.id === this.net.id && p.race.host);
      if (h && h.race.cd > 0) this.net.startAt = performance.now() + h.race.cd * 1000;
    }
    this.place(this.me, this.racers().indexOf(Multi.as || 'me'));
    if (left <= 3.5) {
      if (!peers.length) { UI.toast('אף אחד לא הצטרף — מתחרים נגד מפקדים מהפלגה', 'bad'); this.startSolo(); return; }
      this.countdown(this.net.startAt);
    }
  },
  presence() {
    if (!this.active || !this.net || !this.me) return null;
    const c = this.me;
    return { id: this.net.id, host: !!this.net.host, car: this.myType.id, x: Math.round(c.x * 10) / 10, z: Math.round(c.z * 10) / 10, a: Math.round(c.a * 100) / 100, v: Math.round(c.v), lap: c.lap, pr: Math.round(this.progress(c)), fin: c.fin ? Math.round(c.fin * 100) / 100 : 0, cd: this.net.host && this.phase === 'lobby' ? Math.round((this.net.startAt - performance.now()) / 100) / 10 : 0 };
  },
  // In the world: a friend's race invite pops up once.
  watch() {
    if (this.active || !Multi.on) return;
    const p = Multi.peers.find(q => q.race && q.race.host && q.race.cd > 3 && !this.seenInvites.has(q.race.id));
    if (!p) return;
    this.seenInvites.add(p.race.id);
    Sound.horn();
    UI.invite(`🏎️ הזמנה מ${p.name}: תחרות מפקדי נסיעה! מתחילים בעוד ${Math.round(p.race.cd)} שניות`, '🏁 להצטרף', () => {
      const q = Multi.peers.find(r => r.race && r.race.id === p.race.id);
      if (!q || q.race.cd < 2) { UI.toast('המירוץ כבר התחיל', 'bad'); return; }
      this.open({ id: q.race.id, host: false, startAt: performance.now() + q.race.cd * 1000 });
    });
  },

  // ---------- the start ----------
  countdown(at) {
    this.phase = 'countdown';
    this.startAt = at;
    this.lastBeep = null;
    this.panel('');
    $('#race .rc-hud').classList.remove('hidden');
    this.raceT = 0;
    this.say(pick(RACE_LINES.go), 'driver');
  },
  updateCountdown() {
    const left = (this.startAt - performance.now()) / 1000;
    const n = Math.ceil(left);
    const el = $('#race .rc-cd');
    if (n !== this.lastBeep && n <= 3) {
      this.lastBeep = n;
      el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
      el.textContent = n > 0 ? n : 'סע!';
      Sound.beep(n <= 0);
    }
    if (left <= 0) { this.phase = 'race'; setTimeout(() => el.classList.add('hidden'), 700); }
  },

  // ---------- driving ----------
  input() {
    const k = G.keys, st = G.stick;
    const key = (...c) => (c.some(x => k.has(x)) ? 1 : 0);
    let steer = key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA') + (st.x || 0);
    // Keyboard: up is gas. Touch: the driver keeps the gas down unless the stick pulls back.
    let thr = key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS');
    if (G.touch && !thr) thr = st.y > 0.45 ? -1 : 1;
    if (G.touchRun) thr = -1;
    steer = Math.max(-1, Math.min(1, steer));
    return { steer, thr };
  },
  boost() {
    const c = this.me;
    if (!c || this.phase !== 'race' || c.fin) return;
    if (c.boost < 1) { Sound.bad(); return; }
    c.boost = 0; c.boostT = 1.4;
    Sound.boost();
    this.say(pick(RACE_LINES.boost), 'me');
  },
  drive(c, dt, inp) {
    const T = c.type;
    c.steer += (inp.steer - c.steer) * Math.min(1, dt * 8);
    c.thr = inp.thr;
    const near = this.nearest(c.x, c.z, c.idx);
    c.idx = near.i;
    c.off = near.d > RACE_HALF + 0.5;
    let top = T.top * (c.skill || 1) * (c.off ? 0.55 : 1) * (c.boostT > 0 ? 1.3 : 1);
    if (c.thr > 0) c.v += c.thr * T.acc * (c.boostT > 0 ? 1.6 : 1) * Math.max(0, 1 - c.v / top) * dt;
    else if (c.thr < 0) c.v = Math.max(-8, c.v - (c.v > 0 ? 24 : 7) * dt);
    else c.v -= c.v * 0.6 * dt;
    if (c.v > top) c.v -= (c.v - top) * 2.2 * dt;
    // Steering: faster turns at speed, but less of them near top speed; the heavy ones lean.
    const sp = Math.min(1, Math.abs(c.v) / 10);
    c.a += c.steer * 1.85 * T.grip * sp * (1 - 0.3 * Math.min(1, c.v / T.top)) * Math.sign(c.v || 1) * dt + c.spin * dt;
    c.spin *= Math.exp(-4 * dt);
    c.x += Math.cos(c.a) * c.v * dt + c.ix * dt;
    c.z += Math.sin(c.a) * c.v * dt + c.iz * dt;
    const k = Math.exp(-3.2 * dt);
    c.ix *= k; c.iz *= k;
    // The desert edge: soft walls far off the road.
    if (near.d > RACE_HALF + 14) {
      const s = this.samples[near.i], dx = c.x - s.x, dz = c.z - s.z, d = Math.hypot(dx, dz);
      c.x = s.x + dx / d * (RACE_HALF + 14); c.z = s.z + dz / d * (RACE_HALF + 14);
      c.v *= 0.7;
    }
    c.boostT = Math.max(0, c.boostT - dt);
    c.boost = Math.min(1, c.boost + dt / 9);
    c.bumpT = Math.max(0, c.bumpT - dt);
    this.laps(c);
  },
  // Bots aim a little down the road, at their own lane, and lift on the sharp bends.
  botInput(c) {
    const S = this.samples, N = S.length, s = S[(c.idx + 12) % N];
    const tx = s.x - Math.sin(s.a) * c.lane, tz = s.z + Math.cos(s.a) * c.lane;
    let d = Math.atan2(tz - c.z, tx - c.x) - c.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const ahead = S[(c.idx + 30) % N].a - S[c.idx].a, sharp = Math.abs(Math.atan2(Math.sin(ahead), Math.cos(ahead)));
    let thr = sharp > 0.9 && c.v > 22 ? 0.2 : 1;
    // Keep the race close: the leaders ease off when far in front of the player.
    if (this.me && !this.me.fin && this.progress(c) - this.progress(this.me) > 60) thr = Math.min(thr, 0.4);
    if (c.boost >= 1 && Math.random() < 0.004 && this.phase === 'race') { c.boost = 0; c.boostT = 1.2; }
    return { steer: Math.max(-1, Math.min(1, d * 2.4)), thr };
  },
  // How far along the race a car is. The grid is just behind the line, so until a car first
  // crosses it, it's at the end of "lap minus one". A friend's car reports its own.
  progress(c) {
    if (c.ghost) return c.pr || 0;
    const N = this.samples.length;
    return c.lap * N + (!c.crossed && c.idx > N / 2 ? c.idx - N : c.idx);
  },
  laps(c) {
    const N = this.samples.length;
    const over = c.prev != null && c.prev > N * 0.85 && c.idx < N * 0.15;
    if (!c.crossed) { if (over) c.crossed = true; c.prev = c.idx; return; }
    if (c.idx > N * 0.45 && c.idx < N * 0.55) c.half = true;
    if (over && c.half && !c.fin) {
      c.lap++;
      c.half = false;
      if (c.lap >= RACE_LAPS) {
        c.fin = this.raceT;
        if (c.isMe) this.finish();
      } else if (c.isMe) {
        Sound.ding();
        this.say(c.lap === RACE_LAPS - 1 ? RACE_LINES.lap[1] : RACE_LINES.lap[0], 'driver');
      }
    }
    c.prev = c.idx;
  },

  // ---------- bumps ----------
  collide(dt) {
    const all = [...this.cars, ...this.remote()];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const A = all[i], B = all[j];
      if (A.ghost && B.ghost) continue;
      const ra = A.type.len * 0.42, rb = B.type.len * 0.42;
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d >= ra + rb || d < 0.001) continue;
      const nx = dx / d, nz = dz / d, over = ra + rb - d;
      const ma = A.type.mass, mb = B.type.mass, sum = ma + mb;
      const va = { x: Math.cos(A.a) * A.v + A.ix, z: Math.sin(A.a) * A.v + A.iz };
      const vb = { x: Math.cos(B.a) * B.v + B.ix, z: Math.sin(B.a) * B.v + B.iz };
      const rel = (vb.x - va.x) * nx + (vb.z - va.z) * nz;
      const j0 = Math.max(4, -rel * 1.5) * 2 / sum;
      // A remote car is moved by its own phone; here only the local ones get pushed.
      if (!A.ghost) { A.x -= nx * over * mb / sum; A.z -= nz * over * mb / sum; A.ix -= nx * j0 * mb; A.iz -= nz * j0 * mb; A.spin += (Math.random() - 0.5) * j0 * mb * 0.25; A.v *= 0.85; }
      if (!B.ghost) { B.x += nx * over * ma / sum; B.z += nz * over * ma / sum; B.ix += nx * j0 * ma; B.iz += nz * j0 * ma; B.spin += (Math.random() - 0.5) * j0 * ma * 0.25; B.v *= 0.85; }
      if (A.bumpT <= 0 || B.bumpT <= 0) {
        A.bumpT = B.bumpT = 0.45;
        this.star((A.x + B.x) / 2, (A.z + B.z) / 2);
        if (A.isMe || B.isMe) { Sound.bump(); this.shake = 0.5; this.say(pick(RACE_LINES.bump), 'driver'); }
      }
    }
  },
  // Friends' cars in this race, smoothed from their presence.
  remoteCars: new Map(),
  remote() {
    if (!this.net) return [];
    const out = [];
    for (const p of Multi.peers) {
      if (!p.race || p.race.id !== this.net.id) continue;
      let r = this.remoteCars.get(p.peer);
      const type = RACE_CARS.find(t => t.id === p.race.car) || RACE_CARS[0];
      if (!r || r.type !== type) {
        if (r) this.scene.remove(r.obj.root);
        r = { ghost: true, type, obj: this.makeCar(type), x: p.race.x, z: p.race.z, a: p.race.a, v: 0, ix: 0, iz: 0, bumpT: 0, lap: 0, idx: 0, fin: 0, name: p.name };
        r.tag = Scene3D.label(`🗣️ ${p.name}`, { size: 0.9 }); r.tag.position.y = 3.4; r.obj.root.add(r.tag);
        this.remoteCars.set(p.peer, r);
      }
      r.tx = p.race.x; r.tz = p.race.z; r.ta = p.race.a; r.v = p.race.v; r.lap = p.race.lap; r.pr = p.race.pr; r.fin = p.race.fin;
      r.idx = this.nearest(r.tx, r.tz, r.idx).i;
      out.push(r);
    }
    return out;
  },

  // ---------- each frame ----------
  frame(dt, t) {
    Multi.update(dt);
    if (this.phase === 'lobby') this.updateLobby();
    if (this.phase === 'countdown') this.updateCountdown();
    const racing = this.phase === 'race' || this.phase === 'done';
    if (racing) this.raceT += dt;
    for (const c of this.cars) {
      if (!racing) { c.v = 0; continue; }
      // Past the finish line the driver takes it easy on their own.
      if (c.isMe && c.fin && !c.autoLane) { c.autoLane = true; c.lane = 0; c.skill = 0.7; }
      this.drive(c, dt, c.bot || c.fin ? this.botInput(c) : this.input());
    }
    for (const [k, r] of this.remoteCars) {
      if (!Multi.peers.some(p => p.peer === k && p.race && this.net && p.race.id === this.net.id)) { this.scene.remove(r.obj.root); this.remoteCars.delete(k); continue; }
      if (r.tx == null) continue;
      const f = Math.min(1, dt * 10);
      r.x += (r.tx - r.x) * f; r.z += (r.tz - r.z) * f;
      let da = r.ta - r.a; da = Math.atan2(Math.sin(da), Math.cos(da)); r.a += da * f;
    }
    if (racing) this.collide(dt);
    this.overtakes();
    this.draw(dt, t);
    this.hud();
    if (this.me) Sound.engine(this.phase === 'pick' ? null : Math.min(1, Math.abs(this.me.v) / this.me.type.top));
    if (this.phase === 'done' && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  draw(dt, t) {
    const all = [...this.cars, ...this.remoteCars.values()];
    for (const c of all) {
      const { root, tilt } = c.obj;
      root.position.set(c.x, 0, c.z);
      root.rotation.y = -c.a;
      // Lean into the turn, squat on the gas, rattle off the road, wobble after a bump.
      const sp = Math.min(1, Math.abs(c.v) / c.type.top);
      const bump = c.bumpT > 0 ? Math.sin(c.bumpT * 40) * c.bumpT : 0;
      tilt.rotation.x = (c.steer || 0) * 0.09 * sp + bump * 0.5;
      tilt.rotation.z = (c.thr > 0 ? 0.025 : c.thr < 0 ? -0.04 : 0) * sp + bump * 0.3;
      tilt.position.y = (c.off ? Math.abs(Math.sin(t / 45)) * 0.12 : Math.abs(Math.sin(t / 70)) * 0.03) * sp + Math.max(0, bump) * 0.6;
      // Dust behind: thick in the sand, a puff when drifting, flames on a boost.
      c.dustT = (c.dustT || 0) - dt;
      const drift = Math.abs(c.steer || 0) > 0.7 && c.v > 20;
      if ((c.off || drift || c.boostT > 0) && c.v > 6 && c.dustT <= 0) {
        c.dustT = 0.04;
        this.puff(c.x - Math.cos(c.a) * c.type.len * 0.5, c.z - Math.sin(c.a) * c.type.len * 0.5, c.boostT > 0 ? 0xff9a3c : 0xe6d2a6, c.off ? 1.6 : 1);
        if (drift && c.isMe && Math.random() < 0.05) Sound.skid();
      }
    }
    for (const f of this.flags || []) f.rotation.y = Math.sin(t / 400 + f.userData.wave) * 0.4;
    // Dust and bump stars.
    for (const d of this.fx.dust) { d.t += dt; d.m.material.opacity = Math.max(0, 0.55 * (1 - d.t / 0.9)); d.m.scale.setScalar(d.s * (1 + d.t * 2.5)); d.m.position.y += dt * 0.6; }
    this.fx.dust = this.fx.dust.filter(d => { if (d.t < 0.9) return true; this.scene.remove(d.m); return false; });
    for (const s of this.fx.stars) { s.t += dt; s.m.position.y = 3.2 + s.t * 3; s.m.material.opacity = Math.max(0, 1 - s.t / 0.8); const k = 1 + Math.min(s.t * 6, 0.6); s.base = s.base || s.m.scale.clone(); s.m.scale.set(s.base.x * k, s.base.y * k, 1); }
    this.fx.stars = this.fx.stars.filter(s => { if (s.t < 0.8) return true; this.scene.remove(s.m); return false; });
    for (const f of this.fx.confetti) { f.m.position.y -= f.vy * dt; f.m.rotation.x += f.spin * dt; f.m.rotation.y += f.spin * 0.7 * dt; }
    this.fx.confetti = this.fx.confetti.filter(f => { if (f.m.position.y > 0) return true; this.scene.remove(f.m); return false; });
    // The chase camera: behind and above, wider and shakier as it speeds up.
    const c = this.me;
    if (c) {
      const cam = this.camera, back = 9, up = 4.6;
      const w = this.renderSize();
      if (cam.aspect !== w) { cam.aspect = w; }
      const want = new THREE.Vector3(c.x - Math.cos(c.a) * back, up, c.z - Math.sin(c.a) * back);
      if (this.phase === 'pick' || this.phase === 'lobby') { const r = performance.now() / 4000; want.set(c.x + Math.cos(r) * 12, 5, c.z + Math.sin(r) * 12); }
      cam.position.lerp(want, Math.min(1, dt * 5));
      this.shake = Math.max(0, (this.shake || 0) - dt * 1.5);
      if (this.shake) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake));
      cam.lookAt(c.x + Math.cos(c.a) * 6, 1.2, c.z + Math.sin(c.a) * 6);
      cam.fov = (w < 1 ? 74 : 62) + Math.min(1, Math.abs(c.v) / 35) * 12 + (c.boostT > 0 ? 6 : 0);
      cam.updateProjectionMatrix();
      this.sun.position.set(c.x + 30, 60, c.z + 20);
      this.sun.target.position.set(c.x, 0, c.z);
    }
  },
  renderSize() { const s = Scene3D.renderer.getSize(new THREE.Vector2()); return s.x / Math.max(1, s.y); },
  render() { Scene3D.renderer.render(this.scene, this.camera); },
  puff(x, z, color, size) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, color, transparent: true, depthWrite: false }));
    m.position.set(x + (Math.random() - 0.5) * 0.8, 0.5, z + (Math.random() - 0.5) * 0.8);
    this.scene.add(m);
    this.fx.dust.push({ m, t: 0, s: size });
    if (this.fx.dust.length > 120) { const d = this.fx.dust.shift(); this.scene.remove(d.m); }
  },
  star(x, z) {
    const m = Scene3D.label('💥 BUMP!', { bg: 'rgba(255,214,0,.95)', fg: '#b3001b', size: 0.8 });
    m.material.transparent = true;
    m.position.set(x, 3.2, z);
    this.scene.add(m);
    this.fx.stars.push({ m, t: 0 });
    for (let i = 0; i < 6; i++) this.puff(x, z, 0xffffff, 1.2);
  },

  // ---------- standings ----------
  standings() {
    const all = [...this.cars, ...this.remoteCars.values()];
    return all.sort((a, b) => (a.fin && b.fin ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : this.progress(b) - this.progress(a)));
  },
  overtakes() {
    if (this.phase !== 'race' || !this.me) return;
    const pos = this.standings().indexOf(this.me) + 1;
    if (this.lastPos && pos !== this.lastPos && this.raceT > 4) this.say(pick(pos < this.lastPos ? RACE_LINES.pass : RACE_LINES.passed), 'driver');
    this.lastPos = pos;
    // Now and then a rival commander shouts at their driver.
    this.tauntT = (this.tauntT || 6) - 1 / 60;
    if (this.tauntT <= 0) {
      this.tauntT = 6 + Math.random() * 6;
      const r = this.cars.filter(c => c.bot)[Math.floor(Math.random() * 3)];
      if (r && r.tag) { const b = Scene3D.label(pick(RACE_LINES.taunt), { bg: 'rgba(255,255,255,.95)', fg: '#1b1b1b', size: 0.9 }); b.position.y = 4.6; r.obj.root.add(b); setTimeout(() => r.obj.root.remove(b), 2200); }
    }
  },
  hud() {
    const h = $('#race .rc-hud');
    if (!h || h.classList.contains('hidden') || !this.me) return;
    const c = this.me, st = this.standings();
    h.querySelector('.rc-pos').innerHTML = `<b>${st.indexOf(c) + 1}</b>/${st.length}`;
    h.querySelector('.rc-lap').textContent = `סיבוב ${Math.min(RACE_LAPS, c.lap + 1)}/${RACE_LAPS}`;
    const tt = c.fin || Math.max(0, this.raceT);
    h.querySelector('.rc-time').textContent = `${Math.floor(tt / 60)}:${String(Math.floor(tt % 60)).padStart(2, '0')}.${Math.floor(tt * 10 % 10)}`;
    h.querySelector('.rc-spd').innerHTML = `${Math.round(Math.abs(c.v) * 3.6)}<small> קמ"ש</small>`;
    const b = h.querySelector('.rc-boost');
    b.classList.toggle('ready', c.boost >= 1);
    b.querySelector('b').style.width = `${Math.round(c.boost * 100)}%`;
    // The mini map: the road and everyone on it.
    const cv = h.querySelector('.rc-mini'), g = cv.getContext('2d');
    const S = this.samples, k = 150 / RACE_MAP.size, ox = (x) => 75 + (x - RACE_MAP.cx) * k, oz = (z) => 75 + (z - RACE_MAP.cz) * k;
    g.clearRect(0, 0, 150, 150);
    g.strokeStyle = 'rgba(40,40,44,.85)'; g.lineWidth = 6; g.lineJoin = 'round';
    g.beginPath(); S.forEach((s, i) => (i ? g.lineTo(ox(s.x), oz(s.z)) : g.moveTo(ox(s.x), oz(s.z)))); g.closePath(); g.stroke();
    for (const o of st) { g.fillStyle = o === c ? '#f2c12e' : o.ghost ? '#4fc3f7' : '#e74c3c'; g.beginPath(); g.arc(ox(o.x), oz(o.z), o === c ? 5 : 4, 0, 7); g.fill(); }
  },
  say(text, who) {
    const el = $('#race .rc-say');
    if (!el) return;
    const d = this.me && this.me.driver;
    el.innerHTML = who === 'me' ? fmt(text) : `<b>${fmt(d ? `{@${d}}` : 'הנהג')}:</b> ${fmt(text)}`;
    el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(this.sayT);
    this.sayT = setTimeout(() => el.classList.add('hidden'), 2600);
  },

  // ---------- the finish ----------
  finish() {
    this.phase = 'done';
    const pos = this.standings().indexOf(this.me) + 1;
    Sound.fanfare();
    this.confetti();
    const el = $('#race .rc-cd');
    el.textContent = pos === 1 ? '🏆 מקום ראשון!' : `🏁 מקום ${pos}`;
    el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
    const prize = [12, 6, 3, 1][pos - 1] || 1;
    G.state.money += prize;
    if (pos === 1) Game.achieve('race_win');
    this.prize = prize;
    this.resultsAt = performance.now() + 3500;
  },
  confetti() {
    const cols = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0xffffff];
    const c = this.me;
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.4), new THREE.MeshBasicMaterial({ color: cols[i % 5], side: THREE.DoubleSide, transparent: true }));
      m.position.set(c.x + (Math.random() - 0.5) * 10, 6 + Math.random() * 6, c.z + (Math.random() - 0.5) * 10);
      this.scene.add(m);
      this.fx.confetti.push({ m, vy: 2 + Math.random() * 2, spin: (Math.random() - 0.5) * 8 });
    }
  },
  results() {
    $('#race .rc-cd').classList.add('hidden');
    const st = this.standings();
    const row = (c, i) => `<tr class="${c === this.me ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td><bdi data-raw>${esc(c === this.me ? G.profile.name : c.ghost ? c.name : (c.label || '').replace('🗣️ ', ''))}</bdi></td><td>${c.type.name}</td><td>${c.fin ? c.fin.toFixed(1) + ' ש\'' : 'עוד נוסע…'}</td></tr>`;
    const p = this.panel(`<h2>🏁 תוצאות</h2><table class="rc-res">${st.map(row).join('')}</table>
      <p class="rc-sub">+${this.prize}₪ ${this.prize >= 12 ? '· מפקד[/ת] הנסיעה של הסוללה 🏆' : ''}</p>
      <div class="rc-row"><button class="btn" data-m="again">🔁 עוד מירוץ</button><button class="btn ghost" data-m="back">↩ חזרה לבסיס</button></div>`);
    p.innerHTML = fmt(p.innerHTML);
    p.querySelector('[data-m=again]').addEventListener('click', () => { $('#race .rc-hud').classList.add('hidden'); this.net = null; this.phase = 'pick'; this.pickScreen(); });
    p.querySelector('[data-m=back]').addEventListener('click', () => this.exit());
  },
};
