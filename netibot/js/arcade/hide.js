// Night inspection hide-and-seek (מחבואים בביקורת לילה): after lights-out the sergeant major
// comes round with a flashlight. Fifteen seconds while he counts against the container, then
// he looks. Hide behind a container, under a picnic table, in a dumpster, behind the sandbags
// (E at a spot, E again to come out), or sneak about picking up the snacks hidden around the
// yard for points — but anything in his flashlight's beam is caught, and running makes noise
// he hears. He checks the hiding places too, the bad ones first. Last one standing (or all
// still hidden when time's up) wins; snacks break ties.
// Online the host's phone runs him and says who was caught; everyone hides on their own.

const HIDE_LINES = {
  count: ['אחת...', 'שתיים...', 'שלוש...', 'ארבע...', 'חמש... אני שומע אתכם!', 'שש...', 'שבע...', 'שמונה... מי לא מוכן — דו"ח!', 'תשע...', 'עשר!!! מתחיל!'],
  look: ['מי פה?!', 'אני רואה נעליים...', 'שמעתי משהו!', 'יציאה! ביקורת לילה!', 'מישהו אכל פה במבה...'],
  found: ['תפסתי!!! דו"ח!', 'מה את[ה/] עושה בפח?!', 'שעת לילה! למיטה! ...אחרי השכיבות.', 'חשבת שלא אראה? יש לי פנס!'],
  snack: ['{@deputy_rasap}: "זה... הבמבה שלי."', '{@p_ofek}: "פחית! שלי!"', '{@p_nevo}: "*מוצא חטיף בכיס*"'],
};
// Where you can hide: q is how well (he finds the bad ones faster).
const HIDE_SPOTS = [
  { kind: 'container', x: -10, z: -6, q: 0.85, name: 'מאחורי המכולה' }, { kind: 'container', x: 9, z: -9, q: 0.85, name: 'מאחורי המכולה' },
  { kind: 'container', x: 12, z: 7, q: 0.85, name: 'מאחורי המכולה' }, { kind: 'dumpster', x: -4, z: 10, q: 0.75, name: 'בפח' },
  { kind: 'dumpster', x: 15, z: -1, q: 0.75, name: 'בפח' }, { kind: 'table', x: 2, z: 3, q: 0.45, name: 'מתחת לשולחן' },
  { kind: 'table', x: -7, z: 4, q: 0.45, name: 'מתחת לשולחן' }, { kind: 'bags', x: 5, z: -13, q: 0.65, name: 'מאחורי השקים' },
  { kind: 'bags', x: -14, z: 9, q: 0.65, name: 'מאחורי השקים' }, { kind: 'palm', x: -2, z: -4, q: 0.25, name: 'מאחורי הדקל' },
  { kind: 'palm', x: 8, z: 12, q: 0.25, name: 'מאחורי הדקל' }, { kind: 'container', x: -15, z: -12, q: 0.85, name: 'מאחורי המכולה' },
];

const HideGame = {
  id: 'hide', name: 'מחבואים — ביקורת לילה', icon: '🔦',
  desc: '{@harasar} עושה סיבוב לילה עם פנס. להתחבא, לחמוק בשקט, לאסוף חטיפים — ולא להיתפס באור.',
  cover: 'assets/arcade/cover_hide.jpg', solo: true, online: true, minOnline: 2,
  HIDE: 15, SEEK: 65,

  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x0a1028);
    sc.fog = new THREE.Fog(0x0a1028, 30, 150);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.2, 600);
    sc.add(new THREE.HemisphereLight(0x5a6aa8, 0x1a140c, 0.5));
    const moon = new THREE.DirectionalLight(0xaab8ff, 0.45);
    moon.position.set(-20, 30, -10); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
    sc.add(moon);
    Arcade.sky(sc, 'assets/arcade/hide_sky.jpg', { r: 260, h: 140, y0: -14, repeat: 3 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg', 24), color: 0x8a7a64, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
    // String lights over the middle, a lamp by the gate, the fence around.
    const bulbs = [0xffd27a, 0xff8a6a, 0x8ad0ff];
    for (let i = 0; i < 24; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: bulbs[i % 3] })); b.position.set(-12 + i, 3.4 - Math.sin(i / 24 * Math.PI) * 0.6, 0); sc.add(b); }
    const lamp = new THREE.PointLight(0xffd890, 1.1, 16, 1.6); lamp.position.set(-18, 4, 16); sc.add(lamp);
    const fence = new THREE.MeshStandardMaterial({ color: 0x555a50, metalness: 0.4, roughness: 0.7, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    for (const [x, z, ry] of [[0, -21, 0], [0, 21, 0], [-21, 0, Math.PI / 2], [21, 0, Math.PI / 2]]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(42, 2.2), fence); f.position.set(x, 1.1, z); f.rotation.y = ry; sc.add(f); }
    this.soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.props = new THREE.Group(); sc.add(this.props);
    this.fx = [];
  },
  // The hiding places, with what they are; rebuilt when the models arrive.
  dress() {
    const P = this.props;
    while (P.children.length) P.remove(P.children[0]);
    for (const s of HIDE_SPOTS) {
      let m = null;
      if (s.kind === 'container') m = Assets.model('container', { size: [2.6, 2.6, 6.2] });
      else if (s.kind === 'dumpster') m = Assets.model('arc_dumpster', { length: 2, rotY: Math.PI / 2 });
      else if (s.kind === 'table') m = Assets.model('arc_table', { length: 2.6 });
      else if (s.kind === 'bags') m = Assets.model('arc_sandbags', { length: 3.2 });
      else if (s.kind === 'palm') m = Assets.model('palm', { height: 7 });
      if (!m) { m = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x4f5d32 })); m.position.y = 0.8; }
      const g = new THREE.Group(); g.add(m); g.position.set(s.x, 0, s.z);
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      P.add(g);
    }
  },

  // ---------- a game ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    this.dress();
    if (!Assets.has('arc_dumpster') || !Assets.has('arc_table') || !Assets.has('arc_sandbags')) Arcade.loadModels(['arc_dumpster', 'arc_table', 'arc_sandbags']).then(() => { if (this.ctx === ctx) this.dress(); });
    const rnd = this.rnd = Arcade.rng(ctx.seed);
    this.host = ctx.solo || !!(ctx.net && ctx.net.host);
    this.spots = HIDE_SPOTS.map((s, i) => ({ ...s, i, who: null, checked: 0 }));
    const list = ctx.solo
      ? [{ who: 'me', name: G.profile.name, isMe: true }, ...Arcade.bots(4, rnd).map(b => ({ who: b.id, name: fmt(`{@${b.id}}`), bot: true, nerve: rnd() }))]
      : ctx.players.map(p => ({ who: p.isMe ? (Multi.as || 'me') : p.who, name: p.name, isMe: p.isMe, peer: p.peer }));
    this.ps = list.map((c, i) => {
      const m = Arcade.soldier(this.scene, Arcade.look(c.isMe ? null : (Cast.get(c.who) ? c.who : null)));
      const tag = Scene3D.label(c.isMe ? `⭐ ${c.name}` : c.name, { bg: c.isMe ? 'rgba(242,193,46,.95)' : 'rgba(20,26,16,.8)', fg: c.isMe ? '#1b1b1b' : '#f4f1e6', size: 0.42 });
      tag.position.y = 2.2; m.root.add(tag); m.tag = tag;
      const a = i / list.length * Math.PI * 2;
      return { ...c, m, x: Math.cos(a) * 3, z: Math.sin(a) * 3 + 2, vx: 0, vz: 0, a: 0, spot: -1, caught: false, snacks: 0, noise: 0, lit: 0 };
    });
    this.me = this.ps.find(p => p.isMe);
    // The seeker, his flashlight a real light, and its beam in the air.
    this.sk = { m: Arcade.soldier(this.scene, Arcade.look('harasar')), x: -18, z: -17, a: Math.PI / 4, target: null, check: 0, look: 0, chase: null };
    const fl = this.light = new THREE.SpotLight(0xfff2d0, 3, 22, 0.42, 0.45, 1.1);
    fl.castShadow = !G.touch; fl.shadow.mapSize.set(512, 512);
    fl.position.set(0.35, 1.45, 0.25); this.sk.m.root.add(fl); this.sk.m.root.add(fl.target); fl.target.position.set(0, 0, 10);
    const beam = this.beam = new THREE.Mesh(new THREE.ConeGeometry(3.6, 11, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.x = -Math.PI / 2 + 0.12; beam.position.set(0.35, 1.0, 5.6); this.sk.m.root.add(beam);
    // Snacks hidden about.
    this.snacks = [];
    for (let i = 0; i < 9; i++) {
      const x = (rnd() - 0.5) * 34, z = (rnd() - 0.5) * 34;
      const sp = Scene3D.label(['🍫', '🥨', '🥫', '🍪'][i % 4], { bg: 'rgba(0,0,0,0)', size: 0.7 });
      sp.position.set(x, 0.6, z); this.scene.add(sp);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 })); glow.scale.setScalar(1.4); glow.position.set(x, 0.4, z); this.scene.add(glow);
      this.snacks.push({ x, z, sp, glow, got: false });
    }
    this.phase = 'hide'; this.t = 0; this.counted = -1; this.started = false; this.over = false; this.lineT = 4;
    this.st = { caught: [], sk: null };
    this.ui();
    Arcade.buttons({ act: 'להתחבא', run: 'ריצה' });
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>🔦 מחבואים — ביקורת לילה</h2>
      <p class="ar-sub">יש לך ${this.HIDE} שניות להתחבא. ${G.touch ? '"להתחבא" ליד מכולה, פח, שולחן או שקים — ושוב כדי לצאת.' : 'E ליד מכולה, פח, שולחן או שקים — להתחבא, ושוב E — לצאת.'} מי שבאור של הפנס — נתפס. ריצה עושה רעש.</p>
      <p class="ar-sub">🍫 חטיפים מפוזרים בחצר — שווים נקודות. שווה את הסיכון?</p>`);
    Sound.music('night');
    Arcade.countdown(performance.now() + (ctx.solo ? 4600 : 3400), () => { Arcade.panel(''); this.started = true; this.t = 0; }, '🙈!');
  },
  clear() {
    for (const p of this.ps || []) this.scene.remove(p.m.root);
    if (this.sk) this.scene.remove(this.sk.m.root);
    for (const s of this.snacks || []) { this.scene.remove(s.sp); this.scene.remove(s.glow); }
    for (const f of this.fx || []) this.scene.remove(f.m);
    this.ps = []; this.snacks = []; this.fx = []; this.sk = null;
  },

  // ---------- each frame ----------
  update(dt) {
    if (this.started && !this.over) {
      this.t += dt;
      if (this.phase === 'hide') {
        const n = Math.floor(this.t / (this.HIDE / 10));
        if (n !== this.counted && n < 10) { this.counted = n; this.bubble(HIDE_LINES.count[n]); Sound.synth.tone(240 + n * 20, 0.15, 'triangle', 0.05); }
        if (this.t >= this.HIDE) { this.phase = 'seek'; this.t = 0; Sound.whistle(); Arcade.big('🔦 מחפש!', 1400); Sound.music('tension'); }
      } else if (this.t >= this.SEEK) this.finish();
    }
    if (!this.host) this.follow();
    for (const p of this.ps) {
      if (p.peer) { this.remote(p, dt); continue; }
      if (!this.started || p.caught || this.over) continue;
      let ix = 0, iz = 0, run = false;
      if (p.isMe) { const inp = Arcade.input(); ix = inp.x; iz = -inp.y; run = inp.run; }
      else [ix, iz, run] = this.bot(p, dt);
      if (p.spot >= 0) { ix = iz = 0; }
      const sp = run ? 6.8 : 3.4, l = Math.hypot(ix, iz);
      const tvx = l > 0.05 ? ix / Math.max(1, l) * sp : 0, tvz = l > 0.05 ? iz / Math.max(1, l) * sp : 0;
      p.vx += (tvx - p.vx) * Math.min(1, dt * 10); p.vz += (tvz - p.vz) * Math.min(1, dt * 10);
      p.x += p.vx * dt; p.z += p.vz * dt;
      if (Math.hypot(p.vx, p.vz) > 0.3) p.a = Math.atan2(p.vz, p.vx);
      p.x = Math.max(-20, Math.min(20, p.x)); p.z = Math.max(-20, Math.min(20, p.z));
      this.block(p);
      // Running is loud.
      p.noise = Math.max(0, p.noise - dt) + (run && l > 0.1 ? dt * 2 : 0);
      for (const s of this.snacks) if (!s.got && Math.hypot(s.x - p.x, s.z - p.z) < 1) { s.got = true; s.sp.visible = s.glow.visible = false; p.snacks++; if (p.isMe) { Sound.coin(); Arcade.say(fmt(pick(HIDE_LINES.snack)), null, 2000); } }
    }
    if (this.host && this.started && !this.over) this.seeker(dt);
    this.animate(dt);
    this.hud();
    if (this.over && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  // Things you can't walk through.
  block(p) {
    for (const s of this.spots) {
      const r = s.kind === 'container' ? [1.4, 3.2] : s.kind === 'palm' ? [0.4, 0.4] : s.kind === 'table' ? [0, 0] : [1.1, 0.7];
      const dx = p.x - s.x, dz = p.z - s.z, ox = r[0] + 0.3 - Math.abs(dx), oz = r[1] + 0.3 - Math.abs(dz);
      if (r[0] && ox > 0 && oz > 0 && p.spot !== s.i) { if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz; }
    }
  },
  spotNear(p) {
    let best = null, bd = 2.6;
    for (const s of this.spots) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd && (s.who == null || s.who === p.who)) { bd = d; best = s; } }
    return best;
  },
  // E: into the nearest hiding place, or out of it.
  act() {
    const p = this.me;
    if (!p || p.caught || !this.started || this.over) return;
    if (p.spot >= 0) { const s = this.spots[p.spot]; s.who = null; p.spot = -1; p.x = s.x + 2.2; Sound.synth.noise(0.2, 0.05, 900); return; }
    const s = this.spotNear(p);
    if (!s) { Sound.synth.tone(200, 0.06, 'square', 0.03); return; }
    this.hideIn(p, s);
  },
  hideIn(p, s) {
    s.who = p.who; p.spot = s.i; p.vx = p.vz = 0;
    // Tucked in behind it (on the far side from the middle).
    const l = Math.hypot(s.x, s.z) || 1, back = s.kind === 'table' ? 0 : s.kind === 'container' ? 2.1 : 1.1;
    p.x = s.x + s.x / l * back; p.z = s.z + s.z / l * back;
    if (p.isMe) { Sound.synth.noise(0.2, 0.05, 900); Arcade.big(`🙈 ${s.name}`, 900); }
  },

  // ---------- the seeker (the host's phone) ----------
  seeker(dt) {
    const sk = this.sk;
    if (this.phase === 'hide') { sk.x = -18; sk.z = -17; sk.a = -3 * Math.PI / 4; sk.v = 0; this.st.sk = [sk.x, sk.z, sk.a]; return; }
    // Catch anyone out in the open in the beam (or anyone right next to him).
    for (const p of this.ps) {
      if (p.caught) continue;
      const dx = p.x - sk.x, dz = p.z - sk.z, d = Math.hypot(dx, dz);
      let da = Math.atan2(dz, dx) - sk.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      const inBeam = d < 11 && Math.abs(da) < 0.42;
      p.lit = inBeam && p.spot < 0 ? 1 : 0;
      if ((inBeam && p.spot < 0) || d < 1.2) { this.catch(p); continue; }
      // Noise draws him over.
      if (p.noise > 0.4 && p.spot < 0 && (!sk.target || !sk.target.noise)) sk.target = { x: p.x, z: p.z, noise: true };
    }
    // Where next: a noise, the hiding places (the bad ones first), now and then the yard.
    if (!sk.target) {
      const cand = this.spots.filter(s => Date.now() - (s.checked || 0) > 9000);
      if (cand.length && Math.random() < 0.8) { cand.sort((a, b) => (a.q + Math.hypot(a.x - sk.x, a.z - sk.z) / 40) - (b.q + Math.hypot(b.x - sk.x, b.z - sk.z) / 40)); const s = cand[Math.floor(Math.random() * Math.min(3, cand.length))]; sk.target = { x: s.x, z: s.z, spot: s }; }
      else sk.target = { x: (Math.random() - 0.5) * 34, z: (Math.random() - 0.5) * 34 };
    }
    const tg = sk.target, dx = tg.x - sk.x, dz = tg.z - sk.z, d = Math.hypot(dx, dz);
    tg.age = (tg.age || 0) + dt;
    if (tg.age > 12 && sk.check <= 0) { sk.target = null; return; }
    if (sk.check > 0) {
      // Searching a hiding place: a look around with the light.
      sk.check -= dt;
      sk.a += Math.sin(this.t * 3) * dt * 2.2;
      if (sk.check <= 0) {
        const s = tg.spot;
        if (s) {
          s.checked = Date.now();
          const p = s.who != null && this.ps.find(q => q.who === s.who && !q.caught);
          if (p && Math.random() > s.q * 0.7) this.catch(p);
          else if (p && p.isMe) Arcade.say('😮‍💨 הוא עבר לידך...', null, 1600);
        }
        sk.target = null;
      }
    } else if (d < (tg.spot ? (tg.spot.kind === 'container' ? 3.6 : 2.6) : 1.2)) { sk.check = tg.spot ? 1.6 : 0.8; this.lineT -= 1; if (this.lineT <= 0) { this.lineT = 3; this.bubble(pick(HIDE_LINES.look)); } }
    else {
      const sp = tg.noise ? 3.6 : 2.4;
      const want = Math.atan2(dz, dx);
      let da = want - sk.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      sk.a += da * Math.min(1, dt * 4) + Math.sin(this.t * 1.7) * dt * 0.6;
      sk.x += Math.cos(sk.a) * sp * dt; sk.z += Math.sin(sk.a) * sp * dt;
      sk.v = sp;
      // Walk round the props.
      for (const s of this.spots) { const r = s.kind === 'container' ? 3 : s.kind === 'table' ? 0 : 1.3; if (!r) continue; const ex = sk.x - s.x, ez = sk.z - s.z, e = Math.hypot(ex, ez); if (e < r && e > 0.01) { sk.x = s.x + ex / e * r; sk.z = s.z + ez / e * r; } }
    }
    if (sk.check > 0) sk.v = 0;
    this.st.sk = [Math.round(sk.x * 10) / 10, Math.round(sk.z * 10) / 10, Math.round(sk.a * 100) / 100, sk.v ? 1 : 0];
  },
  catch(p) {
    if (p.caught) return;
    p.caught = true;
    if (p.spot >= 0) { this.spots[p.spot].who = null; p.spot = -1; }
    if (!this.st.caught.includes(p.who)) this.st.caught.push(p.who);
    // Out to the wall for push-ups.
    const k = this.st.caught.length;
    p.x = -16 + k * 1.6; p.z = 18.5;
    this.bubble(fmt(pick(HIDE_LINES.found)));
    Sound.whistle();
    if (p.isMe) { Arcade.big('🔦 נתפסת!', 1600); Sound.bad(); G.shake = 0.5; }
    else Arcade.say(`🔦 <bdi data-raw>${esc(p.name)}</bdi> נתפס[/ה]!`, null, 2000);
    if (this.ps.every(q => q.caught)) this.finish();
  },
  // The bots: run to a hiding place while he counts; the brave ones go for snacks.
  bot(p, dt) {
    if (p.spot >= 0) {
      // Now and then the brave ones slip out for a snack, if he's far.
      if (this.phase === 'seek' && Math.random() < dt * 0.05 * p.nerve && Math.hypot(this.sk.x - p.x, this.sk.z - p.z) > 14) { this.spots[p.spot].who = null; p.spot = -1; p.out = 3; }
      return [0, 0, false];
    }
    if (p.out > 0) {
      p.out -= dt;
      const s = this.snacks.find(q => !q.got);
      if (s && p.out > 1) { const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz); return [dx / d, dz / d, false]; }
    }
    if (!p.goal || (p.goal.who != null && p.goal.who !== p.who)) {
      const free = this.spots.filter(s => s.who == null);
      free.sort((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) - a.q * 8) - (Math.hypot(b.x - p.x, b.z - p.z) - b.q * 8));
      p.goal = free[Math.floor(Math.random() * Math.min(2, free.length))];
    }
    const s = p.goal;
    if (!s) return [0, 0, false];
    const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz);
    if (d < 2.4) { this.hideIn(p, s); p.goal = null; return [0, 0, false]; }
    return [dx / d, dz / d, this.phase === 'hide'];
  },
  follow() {
    const h = Arcade.others().find(o => o.host), s = h && h.s;
    if (!s || !s.st) return;
    if (s.st.sk) { const [x, z, a, v] = s.st.sk; this.sk.tx = x; this.sk.tz = z; this.sk.ta = a; this.sk.v = v ? 2.4 : 0; }
    for (const w of s.st.caught || []) { const p = this.ps.find(q => q.who === w); if (p && !p.caught) this.catch(p); }
    if (s.st.over && !this.over) this.finish();
  },
  remote(p, dt) {
    const o = Arcade.others().find(x => x.peer === p.peer), s = o && o.s;
    if (!o) { if (!p.caught) this.catch(p); return; }
    if (!s) return;
    const k = Math.min(1, dt * 10);
    p.vx = (s.x - p.x) * 2; p.vz = (s.z - p.z) * 2;
    p.x += (s.x - p.x) * k; p.z += (s.z - p.z) * k;
    let da = s.a - p.a; da = Math.atan2(Math.sin(da), Math.cos(da)); p.a += da * k;
    if (s.sp !== p.spot) { if (p.spot >= 0 && this.spots[p.spot]) this.spots[p.spot].who = null; p.spot = s.sp; if (p.spot >= 0 && this.spots[p.spot]) this.spots[p.spot].who = p.who; }
    p.noise = s.n || 0; p.snacks = s.sn || 0;
  },

  // ---------- drawing ----------
  bubble(text) {
    if (this.bub) this.sk.m.root.remove(this.bub);
    this.bub = Scene3D.label(text, { bg: 'rgba(255,248,230,.97)', fg: '#3a1a0a', size: 0.5 });
    this.bub.position.y = 2.35; this.sk.m.root.add(this.bub);
    clearTimeout(this.bubT); this.bubT = setTimeout(() => { if (this.bub && this.sk) { this.sk.m.root.remove(this.bub); this.bub = null; } }, 2200);
  },
  animate(dt) {
    const t = performance.now() / 1000, sk = this.sk;
    if (!sk) return;
    if (!this.host && sk.tx != null) { const k = Math.min(1, dt * 8); sk.x += (sk.tx - sk.x) * k; sk.z += (sk.tz - sk.z) * k; let da = sk.ta - sk.a; da = Math.atan2(Math.sin(da), Math.cos(da)); sk.a += da * k; }
    Arcade.pose(sk.m, sk.x, sk.z, sk.a, sk.v || 0, dt);
    this.beam.material.opacity = this.phase === 'seek' ? 0.09 : 0.03;
    this.light.intensity = this.phase === 'seek' ? 3 : 0.6;
    for (const p of this.ps) {
      const v = Math.hypot(p.vx, p.vz);
      const hidden = p.spot >= 0;
      if (p.caught) { Arcade.pose(p.m, p.x, p.z, -Math.PI / 2, 0, dt); p.m.root.rotation.z = -1.25; p.m.root.position.y = 0.32 + Math.abs(Math.sin(t * 3 + p.x)) * 0.22; continue; }
      const win = this.over && this.ranking()[0] === p;
      if (win) Scene3D.animateSoldier(p.m, { x: p.x / S3, y: p.z / S3, angle: Math.PI / 2, speed: 0, dancing: true }, false, dt);
      else Arcade.pose(p.m, p.x, p.z, p.a, v, dt);
      p.m.root.rotation.z = 0;
      // Crouched when hidden; the others' hidden soldiers are hard to see (but you see yours).
      p.m.root.rotation.x = hidden ? -0.5 : 0;
      p.m.root.position.y = hidden ? -0.35 : 0;
      p.m.root.visible = !hidden || p.isMe || this.over;
      p.m.tag.visible = !hidden || p.isMe;
    }
    for (const s of this.snacks) if (!s.got) { s.sp.position.y = 0.6 + Math.sin(t * 3 + s.x) * 0.1; s.glow.material.opacity = 0.35 + Math.sin(t * 4 + s.z) * 0.2; }
    // The camera: high behind you; the whole yard when you've been caught.
    const me = this.me, cam = this.camera;
    const fx = me.caught ? 0 : me.x, fz = me.caught ? 0 : me.z;
    const want = new THREE.Vector3(fx * 0.8, me.caught ? 30 : 13, fz * 0.8 + (me.caught ? 22 : 12));
    cam.position.lerp(want, Math.min(1, dt * 3));
    if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt); }
    cam.lookAt(fx * 0.9, 0, fz * 0.9 - 1);
  },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="hd"><div class="hd-top ar-chip"></div><div class="hd-me ar-chip"></div><div class="hd-lit hidden">🔦 רואים אותך!</div><div class="hd-hint"></div></div>`);
    const h = $('#arcade .hd');
    this.el = { top: h.querySelector('.hd-top'), me: h.querySelector('.hd-me'), lit: h.querySelector('.hd-lit'), hint: h.querySelector('.hd-hint') };
  },
  hud() {
    const e = this.el, me = this.me;
    if (!e || !me) return;
    const left = this.phase === 'hide' ? this.HIDE - this.t : this.SEEK - this.t;
    const alive = this.ps.filter(p => !p.caught).length;
    e.top.innerHTML = this.over ? '🏆' : this.phase === 'hide' ? `🙈 להתחבא! ${Math.ceil(Math.max(0, left))}` : `🔦 ${Math.ceil(Math.max(0, left))} · ${alive} עוד מסתתרים`;
    e.me.innerHTML = `🍫 ${me.snacks}${me.caught ? ' · 😩 נתפסת' : me.spot >= 0 ? ` · 🙈 ${this.spots[me.spot].name}` : ''}`;
    e.lit.classList.toggle('hidden', !(me.lit && !me.caught));
    const near = !me.caught && me.spot < 0 && this.spotNear(me);
    const hint = me.caught || this.over ? '' : me.spot >= 0 ? `${G.touch ? '"להתחבא"' : 'E'} — לצאת` : near ? `${G.touch ? '"להתחבא"' : 'E'} — ${near.name}` : '';
    if (e.hint.textContent !== hint) e.hint.textContent = hint;
  },
  ranking() {
    return [...this.ps].sort((a, b) => (a.caught === b.caught ? b.snacks - a.snacks : a.caught ? 1 : -1) || (this.st.caught.indexOf(b.who) - this.st.caught.indexOf(a.who)));
  },
  finish() {
    if (this.over) return;
    this.over = true; this.st.over = 1;
    Sound.fanfare();
    const free = this.ps.filter(p => !p.caught);
    Arcade.big(free.includes(this.me) ? '🏆 שרדת את הביקורת!' : free.length ? `🏆 ${free.length} שרדו` : '🔦 הוא תפס את כולם', 1800);
    this.bubble(free.length ? 'טוב... הלילה הייתם טובים. למיטות!' : 'כולם! עשר שכיבות סמיכה! ...ואז לישון.');
    this.resultsAt = performance.now() + 3000;
  },
  results() {
    const rows = this.ranking().map(p => ({ name: p.name, value: `${p.caught ? '🔦 נתפס[/ה]' : '🙈 שרד[/ה]'} · 🍫 ${p.snacks}`, me: p.isMe }));
    Arcade.results('🔦 מחבואים — ביקורת לילה', rows, { sub: fmt('{@harasar}: "' + pick(['בפעם הבאה — אני מביא פנס גדול יותר.', 'ומי אכל את הבמבה של {@deputy_rasap}?!', 'שמעתי את כולכם. כמעט.']) + '"'), img: 'assets/arcade/win_hide.jpg' });
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  presence() {
    const me = this.me;
    if (!me) return null;
    const out = { x: Math.round(me.x * 10) / 10, z: Math.round(me.z * 10) / 10, a: Math.round(me.a * 100) / 100, sp: me.spot, n: Math.round(me.noise * 10) / 10, sn: me.snacks };
    if (this.host) out.st = { sk: this.st.sk, caught: this.st.caught, over: this.st.over || 0 };
    return out;
  },
  leave() { clearTimeout(this.bubT); this.bub = null; this.clear(); this.el = null; this.over = false; this.resultsAt = null; },
};
Arcade.register(HideGame);
