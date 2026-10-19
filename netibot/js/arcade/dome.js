// Iron Dome (כיפת ברזל): a night shift at the battery. Rockets arc over the city from both
// sides; the ones heading for houses glow red, the ones falling in open ground trail gray
// smoke and should be left alone (every interceptor costs a fortune). Aim and fire: the
// interceptor homes in, and the sky lights up. Drones are worth more; pigeons are worth less
// than nothing. Three waves, a city to keep standing, sixteen interceptors and a reload.
// Online everyone defends their own copy of the same night (the waves come from the shared
// seed), and the scores race each other live.

const DOME_LINES = {
  wave: ['{@ops}: "שיגורים מעזה! כל העמדות — כוננות!"', '{@hamalist}: "רקטה! עוד רקטה! ועוד אחת! ואז היא אמרה לי—"', '{@ops}: "מטח! מטח! כולם לעמדות!"'],
  hit: ['{@p_liran}: "אוגה!!! בום!"', '{@p_ofek}: "הכי מבצעי בסוללה!"', '{@sergeant}: "מלך[/ה]! 👑"', '{@ops}: "יירוט מוצלח!"', '{@hamalist}: "וואו!!! ראית?! ראית?!"'],
  combo: ['{@p_ofek}: "רצף! אני רושם את זה בתחקיר — לטובה!"', '{@commander}: "...לא רע. בכלל לא רע."', '{@p_liran}: "אוגה אוגה אוגה!!!"'],
  waste: ['{@commander}: "שטח פתוח! חבל על התמיר! מאה אלף דולר!!!"', '{@bc}: "אני מכניסה את זה לאקסל. לעמודה האדומה."', '{@ops}: "זה נופל בחולות! למה יירטת?!"'],
  bird: ['{@p_liran}: "זאת יונה!!! אוגה... 😢"', '{@friend}: "זה לא באג, זאת באמת יונה."', '{@commander}: "יירטת יונה?! ...יונה?!"'],
  city: ['{@ops}: "נפילה בשטח בנוי!"', '{@medic1}: "כולם בסדר? שתיתם מים?"', '{@commander}: "שם היה צריך יירוט!"'],
  reload: ['{@sergeant}: "מחליפים מארז! מהר, מלכים!"', '{@p_arad}: "*מרים מארז לבד* ...תודה, תודה."', '{@harasar}: "מארז בלי חוגר? ...טוב, אין זמן."'],
  drone: ['{@ops}: "כטב"ם! כטב"ם נמוך מערב!"', '{@hamalist}: "יש פה משהו שמזמזם!!!"'],
};
// The waves: when (seconds into the wave) each threat appears, from the shared seed.
const DOME_WAVES = [
  { len: 26, rockets: 11, salvo: 0, grads: 0, drones: 0, birds: 1, open: 0.35 },
  { len: 28, rockets: 12, salvo: 1, grads: 5, drones: 1, birds: 1, open: 0.35 },
  { len: 30, rockets: 12, salvo: 2, grads: 7, drones: 2, birds: 2, open: 0.3 },
];

const DomeGame = {
  id: 'dome', name: 'כיפת ברזל — משמרת לילה', icon: '🛡️',
  desc: 'רקטות על העיר: [מיירטים/מיירטות] את מה שבדרך לבתים, לא מבזבזים תמיר על שטח פתוח. ויונים — לא יורים ביונים.',
  cover: 'assets/arcade/cover_dome.jpg', solo: true, online: true, minOnline: 2,
  MAG: 16,

  // ---------- the world ----------
  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    // The color at the top of the night panorama, so the sky above it carries on seamlessly.
    sc.background = new THREE.Color(0.102, 0.145, 0.44);
    sc.fog = new THREE.Fog(0x2a1d40, 220, 700);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2000);
    this.hemi = new THREE.HemisphereLight(0x8f86d8, 0x3a2418, 0.75);
    sc.add(this.hemi);
    const moon = new THREE.DirectionalLight(0xffd6b0, 0.7);
    moon.position.set(-40, 60, 30);
    sc.add(moon);
    Arcade.sky(sc, 'assets/arcade/dome_city.jpg', { r: 420, h: 230, y0: -18, repeat: 3 });
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg', 90), color: 0x6a5a48, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sc.add(sand);
    // The battery in the foreground: two launchers and the radar, sandbags, a light mast.
    this.launchers = [];
    for (const [x, z, r] of [[-11, 6, 0.18], [12, 8, -0.22]]) {
      const g = new THREE.Group();
      g.position.set(x, 0, z); g.rotation.y = r;
      const m = Assets.model('launcher', { depth: 8 });
      if (m) g.add(m);
      else {
        const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x56653a }));
        box.position.set(0, 3, 0); box.rotation.x = 0.7; g.add(box);
      }
      const muzzle = new THREE.Object3D(); muzzle.position.set(0, 5.4, -3); g.add(muzzle);
      sc.add(g);
      this.launchers.push({ g, muzzle });
    }
    const radar = Assets.model('radar', { length: 5, rotY: 0.6 });
    if (radar) { radar.position.set(24, 0, -4); sc.add(radar); }
    this.addBags();
    // Floodlights on the battery.
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff1c1 });
    for (const x of [-20, 4, 22]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      pole.position.set(x, 3.5, -2); sc.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.3), lampM); lamp.position.set(x, 7.1, -2); sc.add(lamp);
    }
    // Shared bits for the effects.
    const soft = (inner, outer = 'rgba(255,255,255,0)') => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
      gr.addColorStop(0, inner); gr.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, outer);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    };
    this.tex = { smoke: soft('rgba(255,255,255,1)'), glow: soft('rgba(255,240,210,1)') };
    // A pool of sprites for smoke, sparks and flashes.
    this.pool = [];
    for (let i = 0; i < 420; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.smoke, transparent: true, depthWrite: false }));
      s.visible = false; sc.add(s);
      this.pool.push({ s, live: false });
    }
    this.rocketGeo = { body: new THREE.CylinderGeometry(0.16, 0.16, 1.5, 8), nose: new THREE.ConeGeometry(0.16, 0.45, 8), fin: new THREE.BoxGeometry(0.02, 0.35, 0.3) };
  },

  // Sandbags in front of the battery, once their model is in.
  addBags() {
    if (this.bags || !Assets.has('arc_sandbags')) return;
    this.bags = Assets.model('arc_sandbags', { length: 7 });
    this.bags.position.set(-1, 0, 16);
    this.scene.add(this.bags);
  },
  // A rocket: the Higgsfield model when it loaded, a cylinder with fins otherwise; +z forward.
  makeRocket(kind) {
    const g = new THREE.Group();
    const size = kind === 'grad' ? 1.6 : 2.4;
    const m = Assets.model('arc_rocket', { depth: size });
    if (m) { m.position.y = -0.25; m.rotation.y = this.flip ? Math.PI : 0; g.add(m); }
    else {
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f86, roughness: 0.6 });
      const b = new THREE.Mesh(this.rocketGeo.body, mat); b.rotation.x = Math.PI / 2; g.add(b);
      const n = new THREE.Mesh(this.rocketGeo.nose, new THREE.MeshStandardMaterial({ color: 0x7a2a1a })); n.rotation.x = Math.PI / 2; n.position.z = 0.95; g.add(n);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: kind === 'open' ? 0xbfb6a8 : 0xff7a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(kind === 'open' ? 2.2 : 3.6); glow.position.z = -size / 2; g.add(glow);
    this.scene.add(g);
    return g;
  },
  makeDrone() {
    const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 2.4, 8), mat); body.rotation.x = Math.PI / 2; g.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.06, 0.6), mat); g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.35), mat); tail.position.z = -1.1; g.add(tail);
    const blink = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xff2a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    blink.scale.setScalar(1.6); blink.position.y = 0.3; g.add(blink);
    g.userData.blink = blink;
    this.scene.add(g);
    return g;
  },
  makeBird() {
    const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.8, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat); body.scale.set(0.8, 0.8, 1.4); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a90a8 })); head.position.set(0, 0.15, 0.45); g.add(head);
    const wings = [];
    for (const sx of [-1, 1]) {
      const w = new THREE.Group(); w.position.x = sx * 0.2;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), mat); p.position.x = sx * 0.55; p.rotation.x = -Math.PI / 2; w.add(p);
      g.add(w); wings.push(w);
    }
    g.userData.wings = wings;
    g.scale.setScalar(2.2);
    this.scene.add(g);
    return g;
  },
  makeInterceptor() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4 }));
    b.rotation.x = Math.PI / 2; g.add(b);
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    n.rotation.x = Math.PI / 2; n.position.z = 1; g.add(n);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xfff6d8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(3); glow.position.z = -0.9; g.add(glow);
    this.scene.add(g);
    return g;
  },

  // ---------- particles ----------
  part(pos, o) {
    let p = this.pool.find(q => !q.live);
    if (!p) { p = this.pool[this.poolI = ((this.poolI || 0) + 1) % this.pool.length]; }
    const s = p.s, m = s.material;
    p.live = true; s.visible = true;
    s.position.copy(pos);
    m.map = o.glow ? this.tex.glow : this.tex.smoke;
    m.blending = o.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.color.setHex(o.color || 0xffffff);
    m.opacity = o.alpha == null ? 0.6 : o.alpha;
    m.needsUpdate = true;
    Object.assign(p, { t: 0, life: o.life || 1, size: o.size || 1, grow: o.grow || 0, a0: m.opacity, v: o.v ? o.v.clone() : null, g: o.g || 0 });
    s.scale.setScalar(p.size);
    return p;
  },
  updateParts(dt) {
    for (const p of this.pool) {
      if (!p.live) continue;
      p.t += dt;
      if (p.t >= p.life) { p.live = false; p.s.visible = false; continue; }
      const k = p.t / p.life;
      if (p.v) { p.v.y -= p.g * dt; p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 1.2); }
      p.s.scale.setScalar(p.size * (1 + p.grow * k));
      p.s.material.opacity = p.a0 * (1 - k) * (k < 0.08 ? k / 0.08 : 1);
    }
  },
  explode(pos, big = 1) {
    this.part(pos, { glow: true, color: 0xffc46a, size: 6 * big, grow: 3, life: 0.45, alpha: 1 });
    this.part(pos, { glow: true, color: 0xffffff, size: 3 * big, grow: 1.5, life: 0.2, alpha: 1 });
    for (let i = 0; i < 18; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(14 + Math.random() * 22);
      this.part(pos, { glow: true, color: [0xffd27a, 0xff8a3a, 0xfff2c0][i % 3], size: 0.9, life: 0.7 + Math.random() * 0.6, alpha: 1, v, g: 9 });
    }
    for (let i = 0; i < 5; i++) {
      const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3));
      this.part(p, { color: 0x6a6070, size: 4, grow: 2.2, life: 2.6, alpha: 0.55, v: new THREE.Vector3(0, 1.2, 0) });
    }
    this.flash = Math.max(this.flash, 0.6 * big);
    // The boom arrives after the light: sound travels slower than the flash.
    const d = pos.distanceTo(this.camera.position);
    Sound.synth.later(Math.min(1400, d / 340 * 1000), () => { if (this.active) Sound.boom(); });
  },

  // ---------- a round ----------
  enter(ctx) {
    this.ctx = ctx;
    this.active = true;
    this.build();
    Arcade.loadModels(['arc_rocket', 'arc_sandbags']).then(() => this.addBags());
    this.clear();
    const rnd = this.rnd = Arcade.rng(ctx.seed);
    this.plan = this.schedule(rnd);
    this.threats = []; this.shots = []; this.smoke = [];
    this.city = 100; this.score = 0; this.hits = 0; this.wasted = 0; this.combo = 0; this.best = 0;
    this.ammo = this.MAG; this.reloadT = 0;
    this.wave = -1; this.t = -1; this.started = false; this.over = false;
    this.flash = 0; this.shake = 0; this.lineT = 0;
    this.ret = { x: innerWidth / 2, y: innerHeight * 0.38 };
    this.bots = ctx.solo ? Arcade.bots(3, rnd).map(b => ({ ...b, name: fmt(`{@${b.id}}`), skill: 0.55 + rnd() * 0.35, score: 0 })) : [];
    this.ui();
    this.bind();
    Arcade.buttons({ act: '🚀', run: false });
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>🛡️ כיפת ברזל — משמרת לילה</h2>
      <p class="ar-sub">🔴 <b>רקטה אדומה</b> בדרך לבתים — ליירט! · ⚪ <b>עשן אפור</b> נופלת בשטח פתוח — לא לגעת · ✈️ כטב"ם שווה כפול · 🕊️ יונה — לא יורים ביונים!</p>
      <p class="ar-sub">${G.touch ? 'נוגעים ברקטה כדי לשגר, או מכוונים בג\'ויסטיק ו־🚀' : 'עכבר: מכוונים ולוחצים · או חצים + רווח/E · R — טעינה'}</p>`);
    Sound.music('tension');
    Arcade.countdown(performance.now() + (ctx.solo ? 5200 : 3600), () => { Arcade.panel(''); this.started = true; this.nextWave(); }, '🚀!');
  },
  clear() {
    for (const o of [...(this.threats || []), ...(this.shots || [])]) this.scene.remove(o.obj);
    for (const p of this.pool || []) { p.live = false; p.s.visible = false; }
    this.threats = []; this.shots = [];
  },
  // Every threat of the night, in order: { at (s into the wave), kind, from, to, T }.
  schedule(rnd) {
    return DOME_WAVES.map((w, wi) => {
      const list = [];
      const add = (kind, at) => {
        const side = rnd() < 0.5 ? -1 : 1;
        const open = kind !== 'drone' && kind !== 'bird' && rnd() < w.open;
        // Houses lie across the middle of the horizon; open ground off to the far sides.
        const tx = open ? side * (-1) * (150 + rnd() * 90) : (rnd() - 0.5) * 230;
        const tz = -150 - rnd() * 70;
        const from = { x: side * (230 + rnd() * 80), y: 70 + rnd() * 40, z: -210 - rnd() * 90 };
        if (kind === 'drone') { from.y = 26 + rnd() * 10; from.z = -120 - rnd() * 40; }
        if (kind === 'bird') { from.y = 30 + rnd() * 20; from.z = -70 - rnd() * 50; }
        const T = kind === 'grad' ? 5.2 + rnd() * 1.2 : kind === 'drone' ? 15 + rnd() * 4 : kind === 'bird' ? 12 : 7 + rnd() * 2;
        list.push({ at, kind, open, from, to: { x: kind === 'bird' ? -side * 260 : tx, y: kind === 'bird' ? from.y + 10 : 0, z: kind === 'bird' ? from.z - 30 : tz }, T, h: kind === 'drone' || kind === 'bird' ? 0 : 50 + rnd() * 45, id: wi * 100 + list.length });
      };
      for (let i = 0; i < w.rockets; i++) add('rocket', 1 + (i / w.rockets) * (w.len - 6) + rnd() * 1.5);
      for (let i = 0; i < w.grads; i++) add('grad', 3 + rnd() * (w.len - 8));
      for (let s = 0; s < w.salvo; s++) { const at = 6 + rnd() * (w.len - 12); for (let i = 0; i < 5; i++) add(i % 2 ? 'grad' : 'rocket', at + i * 0.35); }
      for (let i = 0; i < w.drones; i++) add('drone', 4 + rnd() * (w.len - 18));
      for (let i = 0; i < w.birds; i++) add('bird', 2 + rnd() * (w.len - 10));
      return list.sort((a, b) => a.at - b.at);
    });
  },
  nextWave() {
    this.wave++;
    if (this.wave >= DOME_WAVES.length) { this.finish(); return; }
    this.t = -2.5; this.queue = [...this.plan[this.wave]];
    Arcade.big(`גל ${this.wave + 1}/${DOME_WAVES.length}`, 1800);
    Arcade.say(fmt(pick(DOME_LINES.wave)), null, 3000);
    Sound.startSiren();
    Sound.synth.later(2600, () => Sound.stopSiren());
  },

  // ---------- input ----------
  bind() {
    this.onMove = (e) => { if (e.pointerType === 'mouse') { this.ret.x = e.clientX; this.ret.y = e.clientY; this.mouse = true; } };
    this.onDown = (e) => {
      if (!this.started || this.over || e.target.closest('button, .ar-panel, #touch')) return;
      this.ret.x = e.clientX; this.ret.y = e.clientY;
      this.fireAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 150 : 110);
    };
    addEventListener('pointermove', this.onMove);
    addEventListener('pointerdown', this.onDown);
  },
  unbind() { removeEventListener('pointermove', this.onMove); removeEventListener('pointerdown', this.onDown); },
  act() { if (this.started && !this.over) this.fireAt(this.ret.x, this.ret.y, 140); },
  // Where a 3D point lands on the screen.
  screen(v) {
    const p = v.clone().project(this.camera), r = Scene3D.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, front: p.z < 1 };
  },
  // The threat nearest a point on the screen (within r px), preferring one nobody's chasing.
  pickAt(x, y, r) {
    let best = null, bd = r;
    for (const th of this.threats) {
      if (th.dead) continue;
      const s = this.screen(th.obj.position);
      if (!s.front) continue;
      const d = Math.hypot(s.x - x, s.y - y) + (th.chased ? 40 : 0);
      if (d < bd) { bd = d; best = th; }
    }
    return best;
  },
  fireAt(x, y, r) {
    if (this.reloadT > 0) { Sound.synth.tone(180, 0.08, 'square', 0.05); return; }
    if (this.ammo <= 0) { this.reload(); return; }
    const th = this.pickAt(x, y, r);
    if (!th) { Sound.synth.tone(240, 0.05, 'square', 0.04); this.ping(x, y, 'miss'); return; }
    this.ammo--;
    th.chased = (th.chased || 0) + 1;
    const L = this.launchers[this.shots.length % 2 === 0 ? (th.obj.position.x < 0 ? 0 : 1) : (th.obj.position.x < 0 ? 1 : 0)];
    const pos = L.muzzle.getWorldPosition(new THREE.Vector3());
    const obj = this.makeInterceptor();
    obj.position.copy(pos);
    const v = new THREE.Vector3(0, 60, -25);
    this.shots.push({ obj, v, target: th, t: 0 });
    for (let i = 0; i < 8; i++) this.part(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2)), { color: 0xd8d0c8, size: 3, grow: 2, life: 1.8, alpha: 0.6, v: new THREE.Vector3((Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 6) });
    this.part(pos, { glow: true, color: 0xffe2a0, size: 5, grow: 1, life: 0.25, alpha: 1 });
    Sound.launch();
    this.shake = Math.max(this.shake, 0.25);
    this.ping(x, y, 'lock');
    if (this.ammo === 0) this.reload();
  },
  reload() {
    if (this.reloadT > 0 || this.ammo === this.MAG) return;
    this.reloadT = 3.2;
    Arcade.say(fmt(pick(DOME_LINES.reload)), null, 2600);
    Sound.synth.tone(140, 0.15, 'square', 0.06);
    Sound.synth.later(900, () => Sound.synth.tone(220, 0.1, 'square', 0.06));
  },
  // A ring where you tapped: locked on, or nothing there.
  ping(x, y, kind) {
    const el = document.createElement('div');
    el.className = 'dm-ping ' + kind;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    const hud = $('#arcade .ar-hud');
    if (hud) { hud.appendChild(el); setTimeout(() => el.remove(), 600); }
  },

  // ---------- each frame ----------
  update(dt) {
    const inp = Arcade.input();
    // The stick and the arrows move the sight.
    if (Math.abs(inp.x) > 0.05 || Math.abs(inp.y) > 0.05) {
      this.ret.x = Math.max(20, Math.min(innerWidth - 20, this.ret.x + inp.x * 700 * dt));
      this.ret.y = Math.max(20, Math.min(innerHeight - 20, this.ret.y - inp.y * 700 * dt));
      this.mouse = true;
    }
    if (G.keys.has('KeyR')) this.reload();
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.ammo = this.MAG; Sound.synth.tone(660, 0.08, 'square', 0.06); Sound.synth.later(90, () => Sound.synth.tone(990, 0.1, 'square', 0.06)); } }
    if (this.started && !this.over) {
      this.t += dt;
      while (this.queue.length && this.queue[0].at <= this.t) this.spawn(this.queue.shift());
      if (!this.queue.length && !this.threats.some(th => !th.dead) && this.t > 2) this.nextWave();
      // The bots score as the night goes on.
      for (const b of this.bots) if (Math.random() < dt * 0.55 * b.skill) b.score += 100;
    }
    this.updateThreats(dt);
    this.updateShots(dt);
    this.updateParts(dt);
    this.lineT -= dt;
    // The night sky lights up on every explosion.
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.hemi.intensity = 0.75 + this.flash * 1.2;
    this.scene.background.setRGB(0.102 + this.flash * 0.25, 0.145 + this.flash * 0.15, 0.44 + this.flash * 0.1);
    this.camUpdate(dt);
    this.hud();
    if (this.over && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  spawn(p) {
    const obj = p.kind === 'drone' ? this.makeDrone() : p.kind === 'bird' ? this.makeBird() : this.makeRocket(p.open ? 'open' : p.kind);
    const th = { ...p, obj, age: 0, smokeT: 0 };
    th.p0 = new THREE.Vector3(p.from.x, p.from.y, p.from.z);
    th.p1 = new THREE.Vector3(p.to.x, p.to.y, p.to.z);
    this.place(th, 0);
    this.threats.push(th);
    if (p.kind === 'drone') { Arcade.say(fmt(pick(DOME_LINES.drone)), null, 2400); Sound.synth.tone(110, 1.2, 'sawtooth', 0.02, 130); }
    else if (p.kind !== 'bird') Sound.synth.tone(900, 0.12, 'sine', 0.02, 1400);
  },
  // Where a threat is at age t: a ballistic arc for rockets, a straight line for the rest.
  place(th, t) {
    const u = Math.min(1, t / th.T), pos = th.obj.position;
    pos.lerpVectors(th.p0, th.p1, u);
    pos.y += th.h * 4 * u * (1 - u);
    if (th.kind === 'drone') pos.y += Math.sin(t * 1.3) * 1.5;
    if (th.kind === 'bird') pos.y += Math.sin(t * 2.4) * 3;
    const u2 = Math.min(1, (t + 0.05) / th.T), next = new THREE.Vector3().lerpVectors(th.p0, th.p1, u2);
    next.y += th.h * 4 * u2 * (1 - u2);
    if (u2 > u) th.obj.lookAt(next);
  },
  updateThreats(dt) {
    for (const th of this.threats) {
      if (th.dead) continue;
      th.age += dt;
      this.place(th, th.age);
      // Smoke behind rockets: thick and dark over houses, thin and gray over the dunes.
      if (th.kind !== 'bird') {
        th.smokeT -= dt;
        if (th.smokeT <= 0) {
          th.smokeT = th.kind === 'drone' ? 0.14 : 0.05;
          this.part(th.obj.position, th.open || th.kind === 'drone' ? { color: 0x9a9690, size: 1.6, grow: 2.2, life: 1.3, alpha: 0.32 } : { color: 0xb8a8a0, size: 2, grow: 2.6, life: 1.6, alpha: 0.5 });
        }
      } else {
        const w = th.obj.userData.wings, f = Math.sin(th.age * 14) * 0.7;
        w[0].rotation.z = f; w[1].rotation.z = -f;
      }
      if (th.kind === 'drone') th.obj.userData.blink.visible = Math.floor(th.age * 3) % 2 === 0;
      if (th.age >= th.T) this.land(th);
    }
    this.threats = this.threats.filter(th => !th.gone);
  },
  // A threat got through: on the houses, the city takes it; in the dunes, nothing happens.
  land(th) {
    th.dead = true; th.gone = true;
    this.scene.remove(th.obj);
    if (th.kind === 'bird') return;
    const pos = th.obj.position.clone(); pos.y = 1;
    if (th.open) {
      for (let i = 0; i < 4; i++) this.part(pos, { color: 0xb8a080, size: 6, grow: 2, life: 2, alpha: 0.4, v: new THREE.Vector3(0, 3, 0) });
      return;
    }
    const dmg = th.kind === 'drone' ? 15 : th.kind === 'grad' ? 8 : 11;
    this.city = Math.max(0, this.city - dmg);
    this.combo = 0;
    this.explode(pos, 1.6);
    for (let i = 0; i < 8; i++) this.part(pos.clone().add(new THREE.Vector3(0, i * 2, 0)), { color: 0x2a2420, size: 8, grow: 2.5, life: 5 + i * 0.3, alpha: 0.5, v: new THREE.Vector3(0, 4, 0) });
    this.shake = Math.max(this.shake, 0.6);
    Sound.bad();
    this.cityHit = 1;
    if (this.lineT <= 0) { this.lineT = 3; Arcade.say(fmt(pick(DOME_LINES.city)), null, 2400); }
    if (this.city <= 0) this.finish();
  },
  updateShots(dt) {
    for (const s of this.shots) {
      s.t += dt;
      const pos = s.obj.position, th = s.target;
      // Up out of the launcher first, then homing: aim at where the threat is about to be.
      if (s.t > 0.3 && th && !th.dead) {
        const d = th.obj.position.distanceTo(pos), lead = d / 160;
        const ahead = th.obj.position.clone();
        if (th.age + lead < th.T) { const tmp = th.obj.position.clone(); this.place(th, th.age + lead); ahead.copy(th.obj.position); th.obj.position.copy(tmp); this.place(th, th.age); }
        const want = ahead.sub(pos).normalize().multiplyScalar(160);
        s.v.lerp(want, Math.min(1, dt * 5));
        if (d < 5) { this.intercept(s, th); continue; }
      } else if (s.t > 0.3) s.v.multiplyScalar(1 + dt * 0.3);
      else s.v.y += 80 * dt;
      pos.addScaledVector(s.v, dt);
      s.obj.lookAt(pos.clone().add(s.v));
      s.smokeT = (s.smokeT || 0) - dt;
      if (s.smokeT <= 0) { s.smokeT = 0.025; this.part(pos, { color: 0xf2f0ea, size: 1.1, grow: 2.2, life: 1.4, alpha: 0.55 }); }
      if (s.t > 4.5 || pos.y < 0) { s.done = true; this.part(pos, { glow: true, color: 0xffd27a, size: 3, grow: 1, life: 0.3, alpha: 1 }); }
    }
    this.shots = this.shots.filter(s => { if (s.done) this.scene.remove(s.obj); return !s.done; });
  },
  intercept(s, th) {
    s.done = true;
    th.dead = true; th.gone = true;
    this.scene.remove(th.obj);
    this.explode(th.obj.position.clone(), th.kind === 'drone' ? 1.4 : 1);
    if (th.kind === 'bird') {
      // Feathers, and a very disappointed battery.
      for (let i = 0; i < 14; i++) this.part(th.obj.position, { color: 0xffffff, size: 0.8, life: 2.5, alpha: 0.9, v: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 4, (Math.random() - 0.5) * 8), g: 2 });
      this.score = Math.max(0, this.score - 150); this.combo = 0; this.wasted++;
      this.floater('-150 🕊️', th.obj.position, '#ff6a5a');
      Arcade.say(fmt(pick(DOME_LINES.bird)), null, 3000);
      Sound.synth.later(300, () => { Sound.synth.tone(600, 0.15, 'sine', 0.05, 400); Sound.synth.later(160, () => Sound.synth.tone(500, 0.2, 'sine', 0.05, 300)); });
      return;
    }
    if (th.open) {
      this.score = Math.max(0, this.score - 50); this.combo = 0; this.wasted++;
      this.floater('-50 💸', th.obj.position, '#ff6a5a');
      Arcade.say(fmt(pick(DOME_LINES.waste)), null, 3000);
      return;
    }
    this.hits++; this.combo++; this.best = Math.max(this.best, this.combo);
    const pts = (th.kind === 'drone' ? 250 : th.kind === 'grad' ? 120 : 100) + Math.min(5, this.combo - 1) * 20;
    this.score += pts;
    this.floater(`+${pts}${this.combo >= 3 ? ` ×${this.combo}` : ''}`, th.obj.position, '#ffd23f');
    if (this.combo === 5 || this.combo === 10) { Arcade.big(`🔥 רצף ${this.combo}!`, 1100); Arcade.say(fmt(pick(DOME_LINES.combo)), null, 2600); Sound.fanfare(); }
    else if (this.lineT <= 0 && Math.random() < 0.35) { this.lineT = 2.5; Arcade.say(fmt(pick(DOME_LINES.hit)), null, 2000); }
  },
  // "+120" floating up where it happened.
  floater(text, pos, color) {
    const s = this.screen(pos), hud = $('#arcade .ar-hud');
    if (!hud || !s.front) return;
    const el = document.createElement('div');
    el.className = 'dm-float'; el.textContent = text; el.style.color = color;
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    hud.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  },
  camUpdate(dt) {
    const cam = this.camera;
    this.shake = Math.max(0, this.shake - dt * 1.4);
    // Behind the battery, looking up over the city; the sight pulls the view a little.
    const nx = (this.ret.x / innerWidth - 0.5), ny = (this.ret.y / innerHeight - 0.5);
    this.camLook = this.camLook || new THREE.Vector3(0, 40, -150);
    const want = new THREE.Vector3(nx * 40, 42 - ny * 18, -150);
    this.camLook.lerp(want, Math.min(1, dt * 1.5));
    cam.position.set(0 + (Math.random() - 0.5) * this.shake, 7 + (Math.random() - 0.5) * this.shake, 30);
    cam.lookAt(this.camLook);
  },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="dm">
      <div class="dm-top ar-chip"><span class="dm-score">0</span><span class="dm-wave"></span></div>
      <div class="dm-city ar-chip"><span>🏙️ העיר</span><i><b></b></i></div>
      <div class="dm-ammo ar-chip"><span class="dm-tubes"></span><span class="dm-rel hidden">טוען...</span></div>
      <canvas class="dm-radar" width="150" height="150"></canvas>
      <div class="dm-board"></div>
      <div class="dm-ret hidden"></div><div class="dm-lock hidden"></div>
      <div class="dm-tags"></div></div>`);
    const h = $('#arcade .dm');
    this.el = { score: h.querySelector('.dm-score'), wave: h.querySelector('.dm-wave'), city: h.querySelector('.dm-city b'), cityBox: h.querySelector('.dm-city'), tubes: h.querySelector('.dm-tubes'), rel: h.querySelector('.dm-rel'), radar: h.querySelector('.dm-radar'), board: h.querySelector('.dm-board'), ret: h.querySelector('.dm-ret'), lock: h.querySelector('.dm-lock'), tags: h.querySelector('.dm-tags') };
  },
  hud() {
    const e = this.el;
    if (!e) return;
    e.score.textContent = `⭐ ${this.score}`;
    e.wave.textContent = this.wave >= 0 ? `גל ${Math.min(this.wave + 1, DOME_WAVES.length)}/${DOME_WAVES.length}` : '';
    e.city.style.width = this.city + '%';
    e.cityBox.classList.toggle('low', this.city < 35);
    if (this.cityHit) { this.cityHit = 0; e.cityBox.classList.remove('hit'); void e.cityBox.offsetWidth; e.cityBox.classList.add('hit'); }
    const tubes = this.reloadT > 0 ? '' : '▮'.repeat(this.ammo) + '<s>' + '▮'.repeat(this.MAG - this.ammo) + '</s>';
    if (e.tubes.innerHTML !== tubes) e.tubes.innerHTML = tubes;
    e.rel.classList.toggle('hidden', !(this.reloadT > 0));
    if (this.reloadT > 0) e.rel.textContent = `🔄 טוען מארז... ${this.reloadT.toFixed(1)}`;
    // The sight follows the mouse (or the stick); the threat it would pick gets a ring.
    e.ret.classList.toggle('hidden', !this.mouse || !this.started || this.over);
    e.ret.style.transform = `translate(${this.ret.x}px, ${this.ret.y}px)`;
    const aim = this.mouse && this.started && !this.over ? this.pickAt(this.ret.x, this.ret.y, 110) : null;
    e.lock.classList.toggle('hidden', !aim);
    if (aim) { const s = this.screen(aim.obj.position); e.lock.style.transform = `translate(${s.x}px, ${s.y}px)`; e.lock.classList.toggle('bad', !!(aim.open || aim.kind === 'bird')); }
    // A small tag on each threat: houses or dunes, drone, pigeon.
    let tags = '';
    for (const th of this.threats) {
      if (th.dead || th.age < 0.3) continue;
      const s = this.screen(th.obj.position);
      if (!s.front || s.x < -20 || s.x > innerWidth + 20 || s.y < -20 || s.y > innerHeight) continue;
      const icon = th.kind === 'bird' ? '🕊️' : th.kind === 'drone' ? '✈️' : th.open ? '🏜️' : '🏙️';
      tags += `<span class="dm-tag ${th.open || th.kind === 'bird' ? 'safe' : 'threat'}${th.chased ? ' chased' : ''}" style="transform:translate(${Math.round(s.x)}px,${Math.round(s.y - 26)}px)">${icon}</span>`;
    }
    e.tags.innerHTML = tags;
    this.drawRadar();
    // The others' scores (online), or the platoon's (alone).
    const rows = this.ctx.solo ? this.bots.map(b => ({ name: b.name, score: b.score })) : Arcade.others().map(o => ({ name: o.name, score: (o.s && o.s.sc) || 0, city: o.s && o.s.c }));
    rows.push({ name: G.profile.name, score: this.score, me: true });
    rows.sort((a, b) => b.score - a.score);
    const html = rows.slice(0, 5).map(r => `<div class="${r.me ? 'me' : ''}"><bdi data-raw>${esc(r.name)}</bdi><b>${r.score}</b></div>`).join('');
    if (e.board.innerHTML !== html) e.board.innerHTML = html;
  },
  // The radar in the corner: the city's sector, the sweep, and every threat as a blip.
  drawRadar() {
    const c = this.el.radar, g = c.getContext('2d'), R = 72, cx = 75, cy = 140;
    g.clearRect(0, 0, 150, 150);
    g.fillStyle = 'rgba(6,24,16,.85)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * 1.85, Math.PI * 1.08, Math.PI * 1.92); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(80,255,150,.35)'; g.lineWidth = 1;
    for (const k of [0.6, 1.2, 1.8]) { g.beginPath(); g.arc(cx, cy, R * k, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
    // Houses in the middle, dunes at the sides.
    g.strokeStyle = 'rgba(255,90,70,.55)'; g.lineWidth = 6;
    g.beginPath(); g.arc(cx, cy, R * 1.2, Math.PI * 1.5 - 0.42, Math.PI * 1.5 + 0.42); g.stroke();
    const sweep = Math.PI * 1.08 + ((performance.now() / 1400) % 1) * Math.PI * 0.84;
    g.strokeStyle = 'rgba(80,255,150,.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sweep) * R * 1.85, cy + Math.sin(sweep) * R * 1.85); g.stroke();
    for (const th of this.threats) {
      if (th.dead) continue;
      const p = th.obj.position, x = cx + p.x / 300 * R * 1.6, y = cy + (p.z - 30) / 300 * R * 1.6;
      g.fillStyle = th.kind === 'bird' ? '#ffffff' : th.kind === 'drone' ? '#ffd23f' : th.open ? '#9a9a9a' : '#ff4a3a';
      g.beginPath(); g.arc(x, y, th.kind === 'drone' ? 4 : 3, 0, 7); g.fill();
    }
    for (const s of this.shots) { const p = s.obj.position; g.fillStyle = '#7dff9a'; g.fillRect(cx + p.x / 300 * R * 1.6 - 1, cy + (p.z - 30) / 300 * R * 1.6 - 1, 2, 2); }
  },

  finish() {
    if (this.over) return;
    this.over = true;
    Sound.stopSiren();
    for (const th of this.threats) if (!th.dead) { th.dead = true; th.gone = true; this.scene.remove(th.obj); }
    // What's left of the city, and what was left in the launchers, count too.
    this.bonus = this.city * 5;
    this.score += this.bonus;
    Arcade.big(this.city > 0 ? '🛡️ הלילה עבר!' : '💥 העיר נפגעה', 1800);
    if (this.city > 0) { Sound.fanfare(); for (let i = 0; i < 6; i++) Sound.synth.later(i * 260, () => this.active && this.explode(new THREE.Vector3((Math.random() - 0.5) * 160, 50 + Math.random() * 40, -160), 0.7)); }
    this.resultsAt = performance.now() + 2600;
  },
  results() {
    const rows = this.ctx.solo
      ? [...this.bots.map(b => ({ name: b.name, value: b.score + Math.round(b.skill * 300), me: false })), { name: G.profile.name, value: this.score, me: true }]
      : [...Arcade.others().map(o => ({ name: o.name, value: (o.s && o.s.sc) || 0, me: false })), { name: G.profile.name, value: this.score, me: true }];
    rows.sort((a, b) => b.value - a.value);
    rows.forEach(r => { r.value = `${r.value} נק'`; });
    const sub = `🎯 ${this.hits} יירוטים · 🔥 רצף ${this.best} · 🏙️ העיר ${this.city}% (+${this.bonus})${this.wasted ? ` · 💸 ${this.wasted} מיותרים` : ''}`;
    Arcade.results('🛡️ כיפת ברזל — משמרת לילה', rows, { sub, img: 'assets/arcade/win_dome.jpg' });
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  presence() { return { sc: this.score, c: this.city, n: this.hits, w: this.wave }; },
  leave() {
    this.active = false;
    this.unbind();
    Sound.stopSiren();
    this.clear();
    this.el = null;
  },
};
Arcade.register(DomeGame);
