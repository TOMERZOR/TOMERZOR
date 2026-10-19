// Red alert musical chairs (צבע אדום — כיסאות מוזיקליים): lunch at the picnic tables in the
// middle of the battery, music on. Then the siren, and there's always one shelter too few.
// Run (Shift / the run button), shove whoever's in your way (E), get through a door before it
// shuts. Whoever's left outside does push-ups on the side for the rest of the game; a shelter
// is closed for renovations each round, until one soldier is left. Now and then it's only a
// motorbike going by on the road — the doors stay shut, and the jumpy ones look silly.
// Online the host's phone is the referee: it calls the siren and says who got which shelter,
// and everyone else follows its word.

const ALERT_LINES = {
  calm: ['{@p_miriam}: "חיים שלי, מי רוצה עוד שניצל?"', '{@p_shaked}: "יש פה ברוקולי? למה אין פה ברוקולי?! הפוצ׳ים שלי רעבים!"', '{@p_nevo}: "*אוכל עם הידיים*"', '{@p_arad}: "💨 ...זה לא אני."', '{@hamalist}: "ואז היא אמרה לי — רגע, זה אוכל? אני אוכלת ומדברת!"'],
  siren: ['{@ops}: "צבע אדום! צבע אדום!"', '{@commander}: "למיגוניות! עכשיו!!!"', '{@medic1}: "בלי לדחוף! ...אוקיי, עם לדחוף."'],
  fake: ['🏍️ ...זה היה רק אופנוע.', '{@p_liran}: "אוגה? ...אה. אופנוע."', '{@sergeant}: "מלכים, זה טרקטורון. תירגעו."'],
  out: ['{@commander}: "נשאר[/ה] בחוץ?! עשר שכיבות סמיכה. עכשיו."', '{@harasar}: "בחוץ בצבע אדום? דו"ח. ועוד דו"ח."', '{@madag}: "*שורקת* שכיבות סמיכה! אחת! שתיים!"', '{@medic1}: "ה[וא/יא] בסדר! ...רק נעלב[/ה]."'],
  jumpy: ['{@sergeant}: "לאן רצת? זה אופנוע. לשבת."', '{@p_liran}: "חחחח ראיתם [אותו/אותה] רץ[/ה]?"', '{@commander}: "תירגע[/י]. זה רק אופנוע."'],
  stay: ['{@commander}: "לשבת ליד השולחן! אין אזעקה!"', '{@sergeant}: "מי קם באמצע ארוחה?!"'],
  pushups: ['{@madag}: "יפה! עוד עשר!"', '{@commander}: "ככה! זה קצב!"', '{@harasar}: "לא סופר. מההתחלה."'],
  meOut: ['[נשארת/נשארת] בחוץ! עשר שכיבות סמיכה, ואת[ה/] [צופה/צופה] משם.'],
  push: ['💪 דחיפה!', '🤚 זוז!', '🫸 תור!'],
  shut: ['🔒 תפוס!', '🚪 מלא!'],
};

// [m/f] text about someone in the game: their own gender, not the player's.
const alertAbout = (p, text) => {
  const female = p.isMe ? (G.profile || {}).gender === 'f' : !!(Cast.get(p.who) || {}).female;
  return fmt(String(text).replace(/\[([^\/\]]*)\/([^\]]*)\]/g, (_, m, f) => (female ? f : m)));
};

const AlertGame = {
  id: 'alert', name: 'צבע אדום — כיסאות מוזיקליים', icon: '🚨',
  desc: 'אוכלים בשולחנות, ופתאום אזעקה — ותמיד יש מיגונית אחת פחות. לרוץ, לדחוף (E), ולא להישאר בחוץ.',
  cover: 'assets/arcade/cover_alert.jpg', solo: true, online: true, minOnline: 2,
  R: 12.5,    // the shelters stand on a circle this far from the middle

  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x9fd0f2);
    sc.fog = new THREE.Fog(0xcfe3ee, 60, 180);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.3, 500);
    sc.add(new THREE.HemisphereLight(0xe8f2ff, 0xc9a56a, 0.8));
    const sun = new THREE.DirectionalLight(0xfff0d4, 1.1);
    sun.position.set(18, 40, 14); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 });
    sc.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg', 30), color: 0xe9cf98, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(7.5, 40), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/asphalt.jpg', 4), color: 0xb0aca4, roughness: 0.95 }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; pad.receiveShadow = true; sc.add(pad);
    // The battery around: containers and palms, a launcher on the hill.
    const deco = () => {
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2 + 0.2, r = 29 + (i % 3) * 3;
        const c = Assets.model('container', { size: [2.6, 2.6, 6.2] });
        if (c) { c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); c.rotation.y = -a; sc.add(c); }
      }
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, p = Assets.model('palm', { height: 8 + (i % 3) }); if (p) { p.position.set(Math.cos(a) * 24, 0, Math.sin(a) * 24); sc.add(p); } }
      const L = Assets.model('launcher', { depth: 8 }); if (L) { L.position.set(-40, 0, -34); L.rotation.y = 0.6; sc.add(L); }
    };
    deco();
    this.fx = [];
    this.dust = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(235,215,170,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  },
  // The shelters were built before their model was in: build them again, as they are.
  reshape() {
    this.shelterModel = true;
    const n = this.shelters.length;
    this.shelters = this.shelters.map(s => { this.scene.remove(s.g); const t = this.makeShelter(s.i, n); t.who = s.who; t.gone = s.gone; t.g.visible = !s.gone; this.lamp(t, this.st && this.st.ph === 'siren'); return t; });
  },
  // A shelter facing the middle, with a lamp (red: shut, green: open) and a sign.
  makeShelter(i, n) {
    const a = i / n * Math.PI * 2, x = Math.cos(a) * this.R, z = Math.sin(a) * this.R;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    // The model's door is on its +z face: turn it toward the middle.
    g.rotation.y = Math.atan2(-x, -z);
    const m = Assets.model('arc_shelter', { length: 3.4 });
    if (m) g.add(m);
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3.2), new THREE.MeshStandardMaterial({ color: 0xcfc8b8 })); b.position.y = 1.3; g.add(b); }
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lampMat); lamp.position.set(0, 3.25, 1.2); g.add(lamp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dust, color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); glow.scale.setScalar(1.6); glow.position.copy(lamp.position); g.add(glow);
    const sign = Scene3D.label(`מיגונית ${i + 1}`, { bg: 'rgba(216,38,31,.92)', size: 0.6 }); sign.position.set(0, 3.9, 0); g.add(sign);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
    // Where you stand to get in: just in front of the door.
    const dx = -x / this.R, dz = -z / this.R;
    return { i, g, lamp, glow, lampMat, x, z, door: { x: x + dx * 2.6, z: z + dz * 2.6 }, who: null, gone: false };
  },

  // ---------- a game ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    Arcade.loadModels(['arc_shelter', 'arc_table']).then(() => { if (this.ctx !== ctx) return; if (!this.tablesIn) this.tables(); if (!this.shelterModel) this.reshape(); });
    this.shelterModel = Assets.has('arc_shelter');
    if (Assets.has('arc_table')) this.tables();
    const rnd = this.rnd = Arcade.rng(ctx.seed);
    this.host = ctx.solo || !!(ctx.net && ctx.net.host);
    const list = ctx.solo
      ? [{ who: 'me', name: G.profile.name, isMe: true }, ...Arcade.bots(5, rnd).map(b => ({ who: b.id, name: fmt(`{@${b.id}}`), bot: true, react: 0.25 + rnd() * 0.5, speed: 0.88 + rnd() * 0.11 }))]
      : ctx.players.map(p => ({ who: p.isMe ? (Multi.as || 'me') : p.who, name: p.name, isMe: p.isMe, peer: p.peer }));
    this.ps = list.map((c, i) => {
      const m = Arcade.soldier(this.scene, c.isMe ? Arcade.look(null) : Arcade.look(Cast.get(c.who) ? c.who : null));
      const tag = Scene3D.label(c.isMe ? `⭐ ${c.name}` : c.name, { bg: c.isMe ? 'rgba(242,193,46,.95)' : 'rgba(20,26,16,.8)', fg: c.isMe ? '#1b1b1b' : '#f4f1e6', size: 0.5 });
      tag.position.y = 2.3; m.root.add(tag);
      return { ...c, m, tag, x: 0, z: 0, vx: 0, vz: 0, a: 0, ix: 0, iz: 0, stun: 0, pushCd: 0, inside: -1, out: false, stamina: 1, seat: i };
    });
    this.me = this.ps.find(p => p.isMe);
    this.round = 0; this.order = []; this.done = false; this.resultsAt = null; this.events = []; this.seen = new Set();
    this.pushups = 0; this.hostSeen = performance.now(); this.stayT = 0;
    this.st = { r: 0, ph: 'calm', occ: {}, out: [], shel: this.ps.length - 1 };
    this.shelters = [];
    for (let i = 0; i < this.ps.length - 1; i++) this.shelters.push(this.makeShelter(i, this.ps.length - 1));
    this.ui();
    Arcade.buttons({ act: '🤚', run: 'ריצה' });
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>🚨 צבע אדום — כיסאות מוזיקליים</h2>
      <p class="ar-sub">אוכלים ליד השולחנות. כשיש אזעקה — לרוץ לדלת של מיגונית פנויה (המנורה ירוקה). יש תמיד אחת פחות ממספר השחקנים! מי שנשאר בחוץ — שכיבות סמיכה בצד.</p>
      <p class="ar-sub">${G.touch ? 'ג\'ויסטיק — ללכת · ריצה — לרוץ · 🤚 — לדחוף' : 'WASD / חצים — ללכת · Shift — ריצה · E / רווח — לדחוף'} · ואם זה רק אופנוע — לא לזוז 😅</p>`);
    this.newRound(true);
    Arcade.countdown(performance.now() + (ctx.solo ? 4200 : 3200), () => { Arcade.panel(''); this.started = true; this.t = 0; }, '🍽️!');
  },
  clear() {
    for (const p of this.ps || []) this.scene.remove(p.m.root);
    for (const s of this.shelters || []) this.scene.remove(s.g);
    for (const f of this.fx || []) this.scene.remove(f.m);
    this.ps = []; this.shelters = []; this.fx = []; this.started = false;
  },
  tables() {
    this.tablesIn = true;
    for (let i = 0; i < 3; i++) {
      const t = Assets.model('arc_table', { length: 2.6 });
      if (!t) return;
      const a = i / 3 * Math.PI * 2;
      t.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2); t.rotation.y = -a + Math.PI / 2;
      this.scene.add(t);
    }
  },
  // Everyone still in back to the tables; the calm before the next siren.
  newRound(first = false) {
    const alive = this.ps.filter(p => !p.out);
    alive.forEach((p, k) => {
      const a = k / alive.length * Math.PI * 2 + 0.3, r = 5.6;
      p.x = Math.cos(a) * r; p.z = Math.sin(a) * r; p.a = a + Math.PI; p.inside = -1; p.vx = p.vz = p.ix = p.iz = 0; p.stun = 0;
      p.m.root.visible = true; p.wander = { x: p.x, z: p.z, t: 0 };
    });
    for (const s of this.shelters) { s.who = null; this.lamp(s, false); }
    for (const p of this.ps) p.laughed = false;
    this.st.occ = {}; this.st.ph = 'calm'; this.fakeEnd = 0;
    // When the siren goes (or a motorbike), from the seed so every phone agrees.
    this.calmLen = 4 + this.rnd() * 5;
    this.fake = !first && this.rnd() < 0.3 ? 1.5 + this.rnd() * (this.calmLen - 2) : 0;
    this.t = 0; this.sirenT = 0; this.fakeDone = false;
    Sound.music('day');
    this.lineT = 1.5;
  },
  lamp(s, open) {
    const c = open ? 0x3cff6a : 0xff2a1a;
    s.lampMat.color.setHex(c); s.glow.material.color.setHex(c);
  },

  // ---------- each frame ----------
  update(dt) {
    if (!this.started) { this.animate(dt); this.hud(); return; }
    // Out and watching the bots alone: the rest of the game goes by faster.
    if (this.ctx.solo && this.me && this.me.out && !this.done) dt *= 2;
    this.t += dt;
    if (!this.host) this.follow();
    else this.referee(dt);
    this.move(dt);
    this.animate(dt);
    this.hud();
    if (this.done && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  // The host's phone runs the round: the siren, the doors, and who's left outside.
  referee(dt) {
    const st = this.st;
    if (st.ph === 'calm') {
      this.lineT -= dt;
      if (this.lineT <= 0) { this.lineT = 3 + Math.random() * 3; Arcade.say(fmt(pick(ALERT_LINES.calm)), null, 2400); }
      if (this.fake && !this.fakeDone && this.t > this.fake) { this.fakeDone = true; this.motorbike(); st.fakeAt = (st.fakeAt || 0) + 1; }
      // Don't let the siren come right on the heels of a motorbike: give the table a moment.
      if (this.fakeDone && this.t > this.fake + 0.5 && this.calmLen < this.fake + 2.5) this.calmLen = this.fake + 2.5;
      if (this.t > this.calmLen) { st.ph = 'siren'; st.sAt = (st.sAt || 0) + 1; this.siren(); }
    } else if (st.ph === 'siren') {
      this.sirenT += dt;
      // Doors: whoever reached a free one first (on their own phone) gets it.
      for (const p of this.ps) {
        if (p.out || p.inside < 0) continue;
        const key = p.inside;
        if (st.occ[key] == null) st.occ[key] = p.who;
        else if (st.occ[key] !== p.who && this.ps.find(q => q.who === st.occ[key] && q.inside === key)) { if (p.isMe || p.bot) this.bounce(p); p.inside = -1; }
      }
      const free = this.shelters.filter(s => !s.gone && st.occ[s.i] == null);
      const outside = this.ps.filter(p => !p.out && !Object.values(st.occ).includes(p.who));
      if (!free.length || !outside.length || this.sirenT > 14) {
        // The ones still outside (the last one, or anyone if time ran out) are out.
        for (const p of outside) this.eliminate(p);
        st.ph = 'out'; this.outT = 0;
        if (!outside.length) Sound.stopSiren();
      }
    } else if (st.ph === 'out') {
      this.outT += dt;
      if (this.outT > 3.2) this.nextRound();
    }
  },
  // A guest follows the host's state: the siren, the doors, who's out.
  follow() {
    const h = Arcade.others().find(o => o.host), s = h && h.s;
    if (!s || !s.st) {
      // The host left: the game can't go on without its referee.
      if (!this.done && performance.now() - this.hostSeen > 6000) { UI.toast('המארח יצא מהמשחק', 'bad'); const me = this.me; if (me && !me.out) this.st.win = me.who; this.finish(); }
      return;
    }
    this.hostSeen = performance.now();
    const st = s.st;
    if (st.fakeAt && st.fakeAt !== this.st.fakeAt) { this.st.fakeAt = st.fakeAt; this.motorbike(); }
    if (st.r !== this.st.r) { this.st.r = st.r; this.closeOne(st.gone); if (st.open != null) this.shelters.forEach(x => { if (x.i >= st.open) this.closeOne(x.i); }); this.newRound(); }
    if (st.ph === 'siren' && this.st.ph !== 'siren') { this.st.ph = 'siren'; this.siren(); }
    this.st.occ = st.occ || {};
    for (const p of this.ps) if (p.isMe && p.inside >= 0 && this.st.occ[p.inside] && this.st.occ[p.inside] !== p.who) { this.bounce(p); p.inside = -1; }
    for (const w of st.out || []) { const p = this.ps.find(q => q.who === w); if (p && !p.out) this.eliminate(p); }
    if (st.ph === 'out' && this.st.ph !== 'out') { this.st.ph = 'out'; }
    if (st.win && !this.done) { this.st.win = st.win; this.finish(); }
  },
  siren() {
    Sound.music('tension');
    Sound.startSiren();
    Arcade.big('🚨 צבע אדום!', 1500);
    Arcade.say(fmt(pick(ALERT_LINES.siren)), null, 2600);
    for (const s of this.shelters) if (!s.gone) this.lamp(s, true);
    this.flashT = 1;
    // The bots react, some faster than others.
    for (const p of this.ps) if (p.bot) p.goAt = this.t + p.react;
  },
  motorbike() {
    // A motorbike on the road: it sounds like the siren for a second.
    Sound.synth.tone(380, 0.9, 'sawtooth', 0.05, 760);
    Sound.synth.later(500, () => Sound.synth.noise(0.6, 0.1, 400));
    Arcade.big('🏍️ ...?', 1100);
    for (const p of this.ps) if (p.bot && Math.random() < 0.45) { p.jumpy = 1.2; }
    // Whoever runs for a door now gets laughed at (and has spent their breath).
    this.fakeEnd = this.t + 2.2;
    for (const p of this.ps) p.r0 = Math.hypot(p.x, p.z);
    setTimeout(() => this.ctx && Arcade.say(fmt(pick(ALERT_LINES.fake)), null, 2400), 900);
  },
  bounce(p) {
    // Someone beat you to the door: thrown back out.
    const s = this.shelters[p.inside] || this.nearestShelter(p);
    if (s) { p.x = s.door.x * 1.12; p.z = s.door.z * 1.12; }
    p.m.root.visible = true; p.stun = 0.5;
    if (p.isMe) { Arcade.big(pick(ALERT_LINES.shut), 900); Sound.bad(); }
  },
  eliminate(p) {
    if (p.out) return;
    p.out = true; p.inside = -1; p.outRound = this.st.r + 1;
    this.order.push(p);
    if (!this.st.out.includes(p.who)) this.st.out.push(p.who);
    // To the side, for push-ups: a row on the right, heads toward the yard.
    const k = this.order.length;
    p.x = 15.8; p.z = 1 + k * 1.3; p.a = Math.PI;
    p.m.root.visible = true;
    Sound.stopSiren();
    Sound.whistle();
    if (p.isMe) {
      Arcade.big('😩 [נשארת/נשארת] בחוץ!', 1800); Arcade.say(fmt(pick(ALERT_LINES.meOut)), null, 3000); Sound.bad(); G.shake = 0.6;
      Arcade.buttons({ act: '💪', run: false });
      if (this.ctx.solo) setTimeout(() => this.me && this.me.out && !this.done && Arcade.say(G.touch ? '💪 — שכיבת סמיכה · ⏩ הסיבובים הבאים מהר יותר' : 'E / רווח — שכיבת סמיכה · ⏩ הסיבובים הבאים מהר יותר', null, 3200), 3200);
    } else Arcade.say(`${alertAbout(p, pick(ALERT_LINES.out))} <b><bdi data-raw>${esc(p.name)}</bdi></b> 😅`, null, 2600);
    this.pop(p, '😩');
  },
  // Next round: everyone out of the shelters, one shelter closed for renovations.
  nextRound() {
    const alive = this.ps.filter(p => !p.out);
    if (alive.length <= 1) { this.st.win = alive[0] ? alive[0].who : 1; this.finish(); return; }
    const open = this.shelters.filter(s => !s.gone);
    const gone = open.slice(-1)[0];
    this.st.ph = 'between';
    this.st.r++; this.st.gone = gone ? gone.i : -1;
    this.closeOne(this.st.gone);
    // Always one shelter fewer than those still in (if two went out at once, close more).
    for (const s of open.slice(alive.length - 1)) this.closeOne(s.i);
    this.st.open = alive.length - 1;
    UI.fade(() => this.newRound());
  },
  closeOne(i) {
    const s = this.shelters[i];
    if (!s || s.gone) return;
    s.gone = true;
    // Closed: a cloud of dust and a sign.
    for (let k = 0; k < 12; k++) this.puff(s.x + (Math.random() - 0.5) * 3, s.z + (Math.random() - 0.5) * 3, 1.6);
    s.g.visible = false;
    const sign = Scene3D.label('🚧 סגור לשיפוצים', { bg: 'rgba(242,193,46,.95)', fg: '#1b1b1b', size: 0.7 });
    sign.position.set(s.x, 1.2, s.z); this.scene.add(sign);
    this.fx.push({ m: sign, keep: true });
    Sound.boom();
  },
  nearestShelter(p, free = false) {
    let best = null, bd = Infinity;
    for (const s of this.shelters) {
      if (s.gone || (free && this.st.occ[s.i] != null)) continue;
      const d = Math.hypot(s.door.x - p.x, s.door.z - p.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  },

  // ---------- moving ----------
  move(dt) {
    const st = this.st, siren = st.ph === 'siren';
    for (const p of this.ps) {
      p.pushCd = Math.max(0, p.pushCd - dt);
      p.stun = Math.max(0, p.stun - dt);
      if (p.peer) { this.remote(p, dt); continue; }
      if (p.out || p.inside >= 0) continue;
      let ix = 0, iz = 0, run = false;
      if (p.isMe) {
        const inp = Arcade.input();
        ix = inp.x; iz = -inp.y; run = inp.run;
      } else if (p.bot) [ix, iz, run] = this.botMove(p, dt);
      if (p.stun > 0) { ix = iz = 0; }
      // Running costs stamina; it comes back when walking.
      if (run && p.stamina > 0.05 && (ix || iz)) p.stamina = Math.max(0, p.stamina - dt * 0.28);
      else p.stamina = Math.min(1, p.stamina + dt * 0.18);
      const speed = (run && p.stamina > 0.05 ? 8.2 : 4.6) * (p.speed || 1);
      const l = Math.hypot(ix, iz);
      const tvx = l > 0.05 ? ix / Math.max(1, l) * speed : 0, tvz = l > 0.05 ? iz / Math.max(1, l) * speed : 0;
      p.vx += (tvx - p.vx) * Math.min(1, dt * 10); p.vz += (tvz - p.vz) * Math.min(1, dt * 10);
      p.x += (p.vx + p.ix) * dt; p.z += (p.vz + p.iz) * dt;
      p.ix *= Math.exp(-5 * dt); p.iz *= Math.exp(-5 * dt);
      if (Math.hypot(p.vx, p.vz) > 0.3) p.a = Math.atan2(p.vz, p.vx);
      // Keep off the shelters' walls and inside the yard.
      for (const s of this.shelters) { if (s.gone) continue; const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz); if (d < 2.3) { p.x = s.x + dx / d * 2.3; p.z = s.z + dz / d * 2.3; } }
      const r = Math.hypot(p.x, p.z); if (r > 22) { p.x *= 22 / r; p.z *= 22 / r; }
      // Lunch is at the tables: no waiting by a door before the siren.
      if (!siren && r > 7.2) {
        p.x *= 7.2 / r; p.z *= 7.2 / r;
        if (p.isMe && (this.stayT -= dt) <= 0 && st.ph === 'calm') { this.stayT = 5; Arcade.say(fmt(pick(ALERT_LINES.stay)), null, 2000); }
      }
      // A motorbike, and off you ran: everyone laughs.
      if (this.fakeEnd && this.t < this.fakeEnd && !p.laughed && r > (p.r0 || 0) + 1.2 && r > 6.6) {
        p.laughed = true;
        this.pop(p, '😅 אופנוע!');
        if (p.isMe) { Arcade.say(fmt(pick(ALERT_LINES.jumpy)), null, 2400); Sound.bad(); }
        else if (Math.random() < 0.5) Arcade.say(alertAbout(p, pick(ALERT_LINES.jumpy)), null, 2200);
      }
      // At a door when the siren's on: in.
      if (siren) {
        for (const s of this.shelters) {
          if (s.gone || Math.hypot(s.door.x - p.x, s.door.z - p.z) > 1.1) continue;
          if (st.occ[s.i] != null && st.occ[s.i] !== p.who) continue;
          p.inside = s.i; p.m.root.visible = false;
          if (this.host) st.occ[s.i] = p.who;
          s.who = p.who;
          this.puff(s.door.x, s.door.z, 0.8);
          Sound.synth.tone(220, 0.15, 'square', 0.05);
          if (p.isMe) { Arcade.big('✅ בפנים!', 1000); Sound.good(); }
          break;
        }
      }
    }
    // Soldiers don't walk through each other.
    const live = this.ps.filter(p => !p.out && p.inside < 0);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const A = live[i], B = live[j], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d > 0.8 || d < 0.001) continue;
      const k = (0.8 - d) / 2;
      if (!A.peer) { A.x -= dx / d * k; A.z -= dz / d * k; }
      if (!B.peer) { B.x += dx / d * k; B.z += dz / d * k; }
    }
    // Online: shoves from the others.
    if (this.ctx.net) for (const o of Arcade.others()) for (const e of (o.s && o.s.ev) || []) {
      const key = o.peer + e.id;
      if ((this.seen = this.seen || new Set()).has(key)) continue;
      this.seen.add(key);
      if (e.to === (Multi.as || 'me')) this.shoved(this.me, e.dx, e.dz);
    }
  },
  botMove(p, dt) {
    const st = this.st;
    if (st.ph === 'siren' && this.t >= (p.goAt || 0)) {
      // To the nearest free door; shove anyone in the way near it.
      const s = this.nearestShelter(p, true);
      if (!s) return [0, 0, false];
      const dx = s.door.x - p.x, dz = s.door.z - p.z, d = Math.hypot(dx, dz);
      const rival = this.ps.find(q => q !== p && !q.out && q.inside < 0 && Math.hypot(q.x - p.x, q.z - p.z) < 1.4);
      if (rival && p.pushCd <= 0 && Math.random() < dt * 3) this.push(p);
      return [dx / d, dz / d, true];
    }
    if (p.jumpy > 0) { p.jumpy -= dt; const s = this.nearestShelter(p); if (s) { const dx = s.door.x - p.x, dz = s.door.z - p.z, d = Math.hypot(dx, dz); return [dx / d * 0.8, dz / d * 0.8, true]; } }
    // Lunch: drift around the tables.
    const w = p.wander;
    w.t -= dt;
    if (w.t <= 0) { const a = Math.random() * Math.PI * 2, r = 4.5 + Math.random() * 2.5; w.x = Math.cos(a) * r; w.z = Math.sin(a) * r; w.t = 2 + Math.random() * 3; }
    const dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
    return d > 0.6 ? [dx / d * 0.45, dz / d * 0.45, false] : [0, 0, false];
  },
  // E: a shove for whoever's right in front.
  act() {
    const me = this.me;
    if (!me || !this.started) return;
    if (me.out && !this.done) { this.pushup(); return; }
    if (!me.out && me.inside < 0) this.push(me);
  },
  // Out: your own push-ups, one per press (the others just count theirs).
  pushup() {
    const t = performance.now();
    if (t - (this.lastPush || 0) < 220) return;
    this.lastPush = t;
    this.pushups++; this.me.pushDip = 1;
    Sound.synth.tone(300 + Math.min(this.pushups, 30) * 12, 0.08, 'triangle', 0.06);
    if (this.pushups % 10 === 0) { this.pop(this.me, `💪 ${this.pushups}`); Arcade.say(fmt(pick(ALERT_LINES.pushups)), null, 2000); Sound.good(); }
  },
  push(p) {
    if (p.pushCd > 0 || p.stun > 0) return;
    p.pushCd = 1.1;
    const fx = Math.cos(p.a), fz = Math.sin(p.a);
    let hit = null, bd = 1.8;
    for (const q of this.ps) {
      if (q === p || q.out || q.inside >= 0) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.3) { bd = d; hit = q; }
    }
    p.pushT = 0.3;
    if (p.isMe || (hit && hit.isMe)) Sound.synth.noise(0.15, 0.2, 600);
    if (!hit) return;
    const dx = hit.x - p.x, dz = hit.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (hit.peer) (this.events = this.events || []).push({ id: Math.floor(Math.random() * 1e9), to: hit.who, dx: Math.round(dx / d * 100) / 100, dz: Math.round(dz / d * 100) / 100, at: performance.now() });
    else this.shoved(hit, dx / d, dz / d);
    if (p.isMe) this.pop(hit, pick(ALERT_LINES.push));
  },
  shoved(q, dx, dz) {
    q.ix += dx * 9; q.iz += dz * 9; q.stun = 0.55;
    this.puff(q.x, q.z, 0.7);
    if (q.isMe) { Sound.bump(); G.shake = 0.4; }
  },
  remote(p, dt) {
    const o = Arcade.others().find(x => x.peer === p.peer), s = o && o.s;
    if (!o) { if (!p.gone) { p.gone = true; this.eliminate(p); } return; }
    if (!s) return;
    p.tx = s.x; p.tz = s.z;
    const k = Math.min(1, dt * 10);
    p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
    let da = s.a - p.a; da = Math.atan2(Math.sin(da), Math.cos(da)); p.a += da * k;
    p.inside = s.in == null ? -1 : s.in;
    p.m.root.visible = p.inside < 0;
    p.rv = s.v || 0;
  },
  pop(p, text) {
    const l = Scene3D.label(text, { bg: 'rgba(255,214,0,.95)', fg: '#b3001b', size: 0.6 });
    l.position.set(p.x, 2.6, p.z); this.scene.add(l);
    this.fx.push({ m: l, t: 0, rise: true });
  },
  puff(x, z, s) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dust, transparent: true, depthWrite: false }));
    m.position.set(x, 0.5, z); m.scale.setScalar(s); this.scene.add(m);
    this.fx.push({ m, t: 0, puff: s });
  },

  // ---------- drawing ----------
  animate(dt) {
    const t = performance.now() / 1000;
    for (const p of this.ps) {
      const v = p.peer ? p.rv || 0 : Math.hypot(p.vx, p.vz);
      if (p.out && !(this.done && this.st.win === p.who)) {
        // Push-ups at the side (yours go down when you press).
        Arcade.pose(p.m, p.x, p.z, p.a, 0, dt);
        p.m.root.rotation.x = 0; p.m.root.position.y = 0.06;
        let down;
        if (p.isMe && !p.peer) { p.pushDip = Math.max(0, (p.pushDip || 0) - dt * 4); down = Math.sin(p.pushDip * Math.PI); }
        else down = Math.abs(Math.sin(t * 3 + p.seat));
        // The model faces its own +x, so a tip about z is face-down.
        p.m.root.rotation.z = -1.22 - down * 0.2;
        continue;
      }
      p.m.root.rotation.x = 0;
      const dancing = this.done && this.st.win === p.who;
      if (dancing) Scene3D.animateSoldier(p.m, { x: p.x / S3, y: p.z / S3, angle: Math.PI / 2, speed: 0, dancing: true }, false, dt);
      else Arcade.pose(p.m, p.x, p.z, p.a, v, dt);
      p.m.root.position.y = 0;
      // Rocked back by a shove, leaning into one of your own.
      p.m.root.rotation.z = p.stun > 0 ? 0.35 : p.pushT > 0 ? -0.3 : 0;
      p.pushT = Math.max(0, (p.pushT || 0) - dt);
    }
    for (const f of this.fx) {
      if (f.keep) continue;
      f.t += dt;
      if (f.puff) { f.m.scale.setScalar(f.puff * (1 + f.t * 2)); f.m.material.opacity = Math.max(0, 0.7 * (1 - f.t / 0.9)); }
      if (f.rise) f.m.position.y += dt * 1.5;
    }
    this.fx = this.fx.filter(f => { if (f.keep || f.t < (f.puff ? 0.9 : 1.2)) return true; this.scene.remove(f.m); return false; });
    // Lamps: green while a shelter's free in the siren, red once someone's in (or no siren).
    for (const s of this.shelters) {
      if (s.gone) continue;
      const open = this.st.ph === 'siren' && this.st.occ[s.i] == null;
      if (s.open !== open) { s.open = open; this.lamp(s, open); }
      s.glow.material.opacity = open ? 0.5 + Math.sin(t * 10) * 0.4 : 0.6;
    }
    // The camera: high behind you, looking at the yard; it follows you a little.
    const me = this.me, cam = this.camera;
    const fx = me && !me.out ? me.x * 0.45 : 0, fz = me && !me.out ? me.z * 0.45 : 0;
    const want = new THREE.Vector3(fx, 21, fz + 22);
    cam.position.lerp(want, Math.min(1, dt * 3));
    if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt); }
    cam.lookAt(fx, 0, fz + 1);
    this.flashT = Math.max(0, (this.flashT || 0) - dt * 0.6);
  },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="al"><div class="al-top ar-chip"></div><div class="al-st ar-chip"><span>🏃</span><i><b></b></i></div><div class="al-red hidden"></div></div>`);
    const h = $('#arcade .al');
    this.el = { top: h.querySelector('.al-top'), st: h.querySelector('.al-st b'), red: h.querySelector('.al-red') };
  },
  hud() {
    const e = this.el;
    if (!e) return;
    const alive = this.ps.filter(p => !p.out).length, free = this.shelters.filter(s => !s.gone).length;
    const ph = this.st.ph;
    const taken = Object.keys(this.st.occ).length, me = this.me;
    const tail = me && me.out ? ` · 💪 ${this.pushups}${this.ctx.solo ? ' ⏩' : ''}` : '';
    const html = this.done ? '🏆' : ph === 'siren' ? `🚨 ${Math.max(0, free - taken)} פנויות · ${Math.max(0, alive - taken)} בחוץ${tail}` : `🍽️ ${alive} שחקנים · ${free} מיגוניות${tail}`;
    if (e.top.innerHTML !== html) e.top.innerHTML = html;
    if (this.me) e.st.style.width = Math.round(this.me.stamina * 100) + '%';
    e.red.classList.toggle('hidden', ph !== 'siren' || this.done);
  },
  finish() {
    if (this.done) return;
    this.done = true;
    Sound.stopSiren();
    Sound.fanfare();
    const win = this.ps.find(p => p.who === this.st.win && !p.out) || this.ps.find(p => !p.out);
    if (win) { this.st.win = win.who; win.x = 0; win.z = 0; win.inside = -1; win.m.root.visible = true; win.m.root.rotation.set(0, 0, 0); this.order.push(win); this.puff(0, 0, 2.4); }
    // Whoever's still standing (a guest whose host left) after the winner.
    for (const p of this.ps) if (!this.order.includes(p)) this.order.splice(Math.max(0, this.order.length - 1), 0, p);
    Arcade.big(win && win.isMe ? '🏆 שרדת!' : `🏆 ${win ? win.name : ''}`, 1800);
    if (win && win.isMe) G.shake = 0.5;
    this.resultsAt = performance.now() + 3200;
  },
  results() {
    const rows = [...this.order].reverse().map((p, i) => ({ name: p.name, value: (i === 0 && !p.out ? alertAbout(p, '🏆 שרד[/ה] הכל') : !p.out ? alertAbout(p, 'נשאר[/ה] במשחק') : alertAbout(p, `נפסל[/ה] בסיבוב ${p.outRound || 1}`)) + (p.isMe && this.pushups ? ` · 💪 ${this.pushups}` : ''), me: p.isMe }));
    const sub = this.order[this.order.length - 1] === this.me ? fmt('{@commander}: "הכי מהיר[/ה] למיגונית בסוללה. ככה זה צריך להיות."') : fmt('{@madag}: "*שורקת* כל מי שנשאר בחוץ — עוד עשר!"');
    Arcade.results('🚨 צבע אדום — כיסאות מוזיקליים', rows, { sub, img: 'assets/arcade/win_alert.jpg' });
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  presence() {
    const me = this.me;
    if (!me) return null;
    const ev = (this.events || []).filter(e => performance.now() - e.at < 2500).map(({ at, ...e }) => e);
    const out = { x: Math.round(me.x * 10) / 10, z: Math.round(me.z * 10) / 10, a: Math.round(me.a * 100) / 100, v: Math.round(Math.hypot(me.vx, me.vz) * 10) / 10, in: me.inside, ev };
    if (this.host) out.st = { r: this.st.r, ph: this.st.ph, occ: this.st.occ, out: this.st.out, gone: this.st.gone, open: this.st.open, fakeAt: this.st.fakeAt, win: this.st.win };
    return out;
  },
  leave() {
    Sound.stopSiren();
    this.clear();
    this.done = false; this.resultsAt = null; this.events = []; this.el = null;
  },
};
Arcade.register(AlertGame);
