// The schnitzel war (מלחמת שניצלים): lunch in the dining hall gets out of hand. Grab food off
// the tables (a schnitzel flies fast and straight, a pita curves like a frisbee, hummus
// splashes everyone around, a tomato is small and quick) and throw it at the others; dive
// (Shift / the run button) out of the way and hide behind the tables. Every hit leaves its
// mark on the uniform. Ninety seconds, most hits wins; the cook is not pleased.
// Online every throw goes to everyone, and each phone says when its own player got hit,
// so the score is what the victims report.

const FOOD_KINDS = {
  schnitzel: { img: 'assets/arcade/food_schnitzel.png', name: 'שניצל', speed: 24, arc: 2, pts: 1, splat: 0xc8902a, size: 0.8 },
  pita: { img: 'assets/arcade/food_pita.png', name: 'פיתה', speed: 18, arc: 1.4, pts: 1, curve: 1, splat: 0xe8d6a0, size: 0.85 },
  hummus: { img: 'assets/arcade/food_hummus.png', name: 'חומוס', speed: 15, arc: 4, pts: 1, area: 2.4, splat: 0xe8d090, size: 0.8 },
  tomato: { img: 'assets/arcade/food_tomato.png', name: 'עגבנייה', speed: 27, arc: 1.5, pts: 2, splat: 0xd8261f, size: 0.55 },
};
const FOOD_LINES = {
  start: ['הטבח: "מי שזורק אוכל — שוטף כלים!"', '{@p_miriam}: "חיים שלי, זה שניצל של אמא שלי!"', '{@rasap}: "כל שניצל רשום אצלי. תחתמו."'],
  hit: ['SPLAT! 🍅', 'בול בפרצוף!', 'חחחח!', 'טריים מהמטבח!'],
  got: ['אוי! הכומתה!', 'יש לי חומוס באוזן!', 'המדים!!! הרס"פית תהרוג אותי!'],
  cook: ['הטבח: "זה היה השניצל האחרון!!!"', 'הטבח: "אני רואה אתכם!!!"', 'הטבח: "מגב! מישהו! מגב!"', '{@inspector}: "מסדר ניקיון בחדר אוכל. אחרי זה. כולם."'],
};

const FoodGame = {
  id: 'food', name: 'מלחמת שניצלים', icon: '🍗',
  desc: 'קרב אוכל בחדר האוכל: שניצלים, פיתות, חומוס ועגבניות. לזרוק, להתחמק, להסתתר מאחורי השולחנות.',
  cover: 'assets/arcade/cover_food.jpg', solo: true, online: true, minOnline: 2,
  LEN: 90, W: 14, D: 10,

  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0xf2e6c8);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
    sc.add(new THREE.HemisphereLight(0xfff6e8, 0x6a5a40, 0.62));
    const key = new THREE.DirectionalLight(0xfff2dc, 0.55);
    key.position.set(6, 14, 8); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 40 });
    sc.add(key);
    // Neon tubes in the ceiling (only the row by the far wall: the camera looks down from above
    // the ceiling, so tubes over the middle of the hall would hang in mid-air).
    for (const x of [-8, 0, 8]) for (const z of [-7]) { const t = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.2), new THREE.MeshBasicMaterial({ color: 0xfffef0 })); t.position.set(x, 4.9, z); sc.add(t); }
    // The floor: tiles; the walls: painted, and the serving counter from Higgsfield.
    const tc = document.createElement('canvas'); tc.width = tc.height = 128;
    const tg = tc.getContext('2d');
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { tg.fillStyle = (x + y) % 2 ? '#a89a84' : '#bcae96'; tg.fillRect(x * 32, y * 32, 32, 32); }
    tg.strokeStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i <= 128; i += 32) { tg.beginPath(); tg.moveTo(i, 0); tg.lineTo(i, 128); tg.moveTo(0, i); tg.lineTo(128, i); tg.stroke(); }
    const ft = new THREE.CanvasTexture(tc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(9, 7);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 2 + 4, this.D * 2 + 4), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.35, metalness: 0.05 }));
    floor.material.roughness = 0.55; floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    const wallM = new THREE.MeshStandardMaterial({ color: 0xe8c98a, roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 2 + 4, 5), new THREE.MeshBasicMaterial({ map: Arcade.texture('assets/arcade/food_hall.jpg') }));
    back.position.set(0, 2.5, -this.D - 2); sc.add(back);
    for (const [x, z, ry, w] of [[-this.W - 2, 0, Math.PI / 2, this.D * 2 + 4], [this.W + 2, 0, -Math.PI / 2, this.D * 2 + 4], [0, this.D + 2, Math.PI, this.W * 2 + 4]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 5), wallM); m.position.set(x, 2.5, z); m.rotation.y = ry; sc.add(m);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 2 + 4, this.D * 2 + 4), new THREE.MeshStandardMaterial({ color: 0xf4f0e6 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 5; sc.add(ceil);
    // The cook behind the counter.
    this.splatTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = 20 + (k % 2 ? 8 : -2) + Math.random() * 6; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 3, 0, 7); g.fill(); } return new THREE.CanvasTexture(c); })();
    this.foodTex = {};
    for (const k in FOOD_KINDS) { const t = new THREE.TextureLoader().load(FOOD_KINDS[k].img); t.encoding = THREE.sRGBEncoding; this.foodTex[k] = t; }
    this.fx = [];
  },
  // Rows of tables (cover), and the food on them, which comes back after a while.
  layout(rnd) {
    for (const t of this.tables || []) this.scene.remove(t.g);
    this.tables = [];
    const spots = [[-8, -4], [0, -4.5], [8, -4], [-8, 3.5], [0, 4], [8, 3.5], [-4, 0], [4, 0]];
    for (const [x, z] of spots) {
      const g = Assets.model('arc_table', { length: 2.8 }) || (() => { const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 1.3), new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.4 })); b.position.y = 0.4; const gg = new THREE.Group(); gg.add(b); return gg; })();
      g.position.set(x, 0, z); g.rotation.y = rnd() < 0.5 ? 0 : Math.PI;
      this.scene.add(g);
      const kinds = Object.keys(FOOD_KINDS);
      this.tables.push({ g, x, z, w: 1.5, d: 0.75, food: kinds[Math.floor(rnd() * kinds.length)], back: 0, item: null });
    }
    for (const t of this.tables) this.setFood(t);
  },
  setFood(t) {
    if (t.item) t.g.remove(t.item);
    t.item = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.foodTex[t.food] }));
    t.item.scale.setScalar(0.9); t.item.position.set(0, 1.25, 0);
    t.g.add(t.item);
  },

  // ---------- a match ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    const rnd = Arcade.rng(ctx.seed);
    this.layout(rnd);
    if (!Assets.has('arc_table')) Arcade.loadModels(['arc_table']).then(() => { if (this.ctx === ctx) this.layout(Arcade.rng(ctx.seed)); });
    const list = ctx.solo
      ? [{ who: 'me', name: G.profile.name, isMe: true }, ...Arcade.bots(3, rnd).map(b => ({ who: b.id, name: fmt(`{@${b.id}}`), bot: true, aim: 0.45 + rnd() * 0.3 }))]
      : ctx.players.slice(0, 6).map(p => ({ who: p.isMe ? (Multi.as || 'me') : p.who, name: p.name, isMe: p.isMe, peer: p.peer }));
    const starts = [[0, 7], [-10, -7], [10, -7], [-11, 6], [11, 6], [0, -8]];
    this.ps = list.map((c, i) => {
      const m = Arcade.soldier(this.scene, Arcade.look(c.isMe ? null : (Cast.get(c.who) ? c.who : null)));
      m.root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.userData.c0 = o.material.color.clone(); } });
      const tag = Scene3D.label(c.isMe ? `⭐ ${c.name}` : c.name, { bg: c.isMe ? 'rgba(242,193,46,.95)' : 'rgba(20,26,16,.8)', fg: c.isMe ? '#1b1b1b' : '#f4f1e6', size: 0.45 });
      tag.position.y = 2.25; m.root.add(tag);
      const [x, z] = starts[i % starts.length];
      return { ...c, m, x, z, vx: 0, vz: 0, a: Math.atan2(-z, -x), hand: null, score: 0, hits: 0, mess: 0, dive: 0, diveCd: 0, stun: 0, throwCd: 0, think: 0 };
    });
    this.me = this.ps.find(p => p.isMe);
    this.shots = []; this.t = 0; this.started = false; this.over = false; this.hitBy = {}; this.lineT = 6; this.camSnap = true; this.lastRun = false; this.lastTR = G.touchRun; this.meSplat = 0;
    this.ui();
    Arcade.buttons({ act: '🍗', run: 'צלילה' });
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>🍗 מלחמת שניצלים</h2>
      <p class="ar-sub">לגשת לשולחן — לקחת אוכל · ${G.touch ? '🍗 — לזרוק (מכוון לבד למי שמולך) · צלילה — להתחמק' : 'E / רווח — לזרוק (מכוון לבד למי שמולך) · Shift — צלילה הצידה'} · ${this.LEN} שניות, מי שפגע הכי הרבה מנצח.</p>
      <p class="ar-sub">🍗 שניצל — מהיר וישר · 🫓 פיתה — מסתובבת בקשת · 🥣 חומוס — מתיז על כל מי שקרוב · 🍅 עגבנייה — קטנה ומהירה, שווה כפול</p>`);
    Sound.music('boss');
    Arcade.countdown(performance.now() + (ctx.solo ? 4600 : 3400), () => { Arcade.panel(''); this.started = true; Arcade.say(fmt(pick(FOOD_LINES.start)), null, 2600); }, '🍗!');
  },
  clear() {
    for (const p of this.ps || []) this.scene.remove(p.m.root);
    for (const s of this.shots || []) this.scene.remove(s.m);
    for (const f of this.fx || []) this.scene.remove(f.m);
    this.ps = []; this.shots = []; this.fx = [];
  },

  // ---------- each frame ----------
  update(dt) {
    if (this.started && !this.over) {
      this.t += dt;
      if (this.t >= this.LEN) this.finish();
    }
    for (const p of this.ps) {
      p.throwCd = Math.max(0, p.throwCd - dt); p.diveCd = Math.max(0, p.diveCd - dt); p.stun = Math.max(0, p.stun - dt); p.dive = Math.max(0, p.dive - dt);
      if (p.peer) { this.remote(p, dt); continue; }
      if (!this.started || this.over) continue;
      let ix = 0, iz = 0, dive = false;
      if (p.isMe) {
        // Shift dives as it goes down; the phone's button toggles, so every tap is a dive.
        const inp = Arcade.input(), sh = G.keys.has('ShiftLeft') || G.keys.has('ShiftRight');
        ix = inp.x; iz = -inp.y; dive = (sh && !this.lastRun) || G.touchRun !== this.lastTR;
        this.lastRun = sh; this.lastTR = G.touchRun;
      }
      else [ix, iz, dive] = this.bot(p, dt);
      if (dive && p.diveCd <= 0) { p.dive = 0.45; p.diveCd = 1.6; const l = Math.hypot(ix, iz) || 1; p.dvx = (ix || Math.cos(p.a + Math.PI / 2)) / l * 13; p.dvz = (iz || Math.sin(p.a + Math.PI / 2)) / l * 13; if (p.isMe) Sound.whoosh(); }
      const sp = p.stun > 0 ? 1.2 : 5.2;
      const l = Math.hypot(ix, iz);
      const tvx = l > 0.05 ? ix / Math.max(1, l) * sp : 0, tvz = l > 0.05 ? iz / Math.max(1, l) * sp : 0;
      p.vx += (tvx - p.vx) * Math.min(1, dt * 10); p.vz += (tvz - p.vz) * Math.min(1, dt * 10);
      const vx = p.dive > 0 ? p.dvx : p.vx, vz = p.dive > 0 ? p.dvz : p.vz;
      p.x += vx * dt; p.z += vz * dt;
      if (Math.hypot(p.vx, p.vz) > 0.4 && p.dive <= 0) p.a = Math.atan2(p.vz, p.vx);
      this.collide(p);
      // Grab food from a table you're next to.
      if (!p.hand) for (const t of this.tables) if (t.back <= 0 && Math.abs(p.x - t.x) < t.w + 0.7 && Math.abs(p.z - t.z) < t.d + 0.7) { p.hand = t.food; t.back = 3.5 + Math.random() * 2; t.item.visible = false; if (p.isMe) { Sound.pickup(); Arcade.big(`${{ schnitzel: '🍗', pita: '🫓', hummus: '🥣', tomato: '🍅' }[p.hand]} ${FOOD_KINDS[p.hand].name}`, 700); } break; }
    }
    // Food comes back on the tables.
    for (const t of this.tables) if (t.back > 0) { t.back -= dt; if (t.back <= 0) { const k = Object.keys(FOOD_KINDS); t.food = k[Math.floor(Math.random() * k.length)]; this.setFood(t); t.item.visible = true; } }
    this.updateShots(dt);
    this.remoteShots();
    this.lineT -= dt;
    if (this.lineT <= 0 && this.started && !this.over) { this.lineT = 8 + Math.random() * 6; Arcade.say(fmt(pick(FOOD_LINES.cook)), null, 2400); }
    this.animate(dt);
    this.hud();
    if (this.over && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  collide(p) {
    p.x = Math.max(-this.W, Math.min(this.W, p.x)); p.z = Math.max(-this.D, Math.min(this.D, p.z));
    for (const t of this.tables) {
      const dx = p.x - t.x, dz = p.z - t.z, ox = t.w + 0.35 - Math.abs(dx), oz = t.d + 0.35 - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) p.x += Math.sign(dx) * ox; else p.z += Math.sign(dz) * oz; }
    }
  },
  // The bots: get food, find someone, throw (not always well), dive when something's coming.
  bot(p, dt) {
    p.think -= dt;
    let dive = false;
    for (const s of this.shots) if (s.from !== p && !s.dead && Math.hypot(s.x - p.x, s.z - p.z) < 3.5 && Math.random() < dt * 4 * p.aim) dive = true;
    if (!p.hand) {
      const t = this.tables.filter(q => q.back <= 0).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (!t) return [0, 0, dive];
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      return [dx / d, dz / d, dive];
    }
    const target = this.ps.filter(q => q !== p && !q.out).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!target) return [0, 0, dive];
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
    if (d < 11 && p.throwCd <= 0 && p.think <= 0) { p.a = Math.atan2(dz, dx); this.throw(p, Math.random() < p.aim ? target : null, (Math.random() - 0.5) * (1.1 - p.aim) * 0.6); p.think = 1 + Math.random() * 1.3; }
    // Keep a fair distance and circle a little.
    const want = d > 8 ? 1 : d < 5 ? -1 : 0;
    return [dx / d * want + (-dz / d) * 0.5, dz / d * want + (dx / d) * 0.5, dive];
  },
  act() { if (this.started && !this.over && this.me && this.me.hand) this.throw(this.me); else if (this.me && !this.me.hand) Sound.synth.tone(200, 0.06, 'square', 0.03); },
  // A throw: aimed at whoever's most in front (a little help), arcing.
  throw(p, target = null, err = 0) {
    if (!p.hand || p.throwCd > 0) return;
    const kind = FOOD_KINDS[p.hand], k = p.hand;
    p.hand = null; p.throwCd = 0.45;
    if (!target) {
      let best = null, bs = -1;
      for (const q of this.ps) {
        if (q === p) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), dot = (dx * Math.cos(p.a) + dz * Math.sin(p.a)) / (d || 1);
        const sc = dot - d / 30;
        if (dot > 0.55 && d < 18 && sc > bs) { bs = sc; best = q; }
      }
      target = best;
    }
    let dx = Math.cos(p.a), dz = Math.sin(p.a), flight = 0.6;
    if (target) { const ex = target.x - p.x, ez = target.z - p.z, d = Math.hypot(ex, ez); flight = d / kind.speed; dx = (ex + target.vx * flight * 0.7) / d; dz = (ez + target.vz * flight * 0.7) / d; const l = Math.hypot(dx, dz); dx /= l; dz /= l; p.a = Math.atan2(dz, dx); }
    // A bot's hand isn't perfect.
    if (err) { const c = Math.cos(err), sn = Math.sin(err); [dx, dz] = [dx * c - dz * sn, dx * sn + dz * c]; }
    const s = { k, from: p, x: p.x + dx * 0.6, y: 1.4, z: p.z + dz * 0.6, vx: dx * kind.speed, vy: (-0.2 + 4.9 * Math.max(0.25, flight) ** 2) / Math.max(0.25, flight), vz: dz * kind.speed, t: 0, id: Math.floor(Math.random() * 1e9) };
    s.m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.foodTex[k] }));
    s.m.scale.setScalar(kind.size);
    this.scene.add(s.m);
    this.shots.push(s);
    p.throwT = 0.25;
    if (p.isMe || (target && target.isMe)) Sound.whoosh();
    if (p.isMe && this.ctx.net) (this.myThrows = this.myThrows || []).push({ id: s.id, k, x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10, vx: Math.round(s.vx * 10) / 10, vy: Math.round(s.vy * 10) / 10, vz: Math.round(s.vz * 10) / 10, at: performance.now() });
  },
  updateShots(dt) {
    for (const s of this.shots) {
      if (s.dead) continue;
      s.t += dt;
      const kind = FOOD_KINDS[s.k];
      if (kind.curve) { const c = Math.cos(dt * 2.2), sn = Math.sin(dt * 2.2), vx = s.vx * c - s.vz * sn; s.vz = s.vx * sn + s.vz * c; s.vx = vx; }
      s.vy -= 9.8 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.m.position.set(s.x, s.y, s.z);
      s.m.material.rotation += dt * 9;
      // Hit someone? (only the ones this phone moves count: online each phone judges its own)
      for (const q of this.ps) {
        if (q === s.from || q.peer || q.dive > 0) continue;
        if (Math.hypot(q.x - s.x, q.z - s.z) < (kind.area ? 0.75 : 0.6) && s.y < 2 && s.y > 0.2) { this.hit(s, q); break; }
      }
      if (s.dead) continue;
      // Tables and the floor stop it.
      for (const t of this.tables) if (Math.abs(s.x - t.x) < t.w && Math.abs(s.z - t.z) < t.d && s.y < 0.9) { this.splat(s.x, 0.9, s.z, kind.splat, 0.6); s.dead = true; Sound.splat(); break; }
      const wx = Math.abs(s.x) > this.W + 1.95, wz = Math.abs(s.z) > this.D + 1.95;
      if ((wx || wz) && s.y > 0.15) { this.wallSplat(s, kind); s.dead = true; Sound.splat(); }
      else if (s.y < 0.05) { this.splat(s.x, 0.02, s.z, kind.splat, kind.area ? 1.3 : 0.8, true); s.dead = true; Sound.splat(); if (kind.area) this.area(s); }
    }
    this.shots = this.shots.filter(s => { if (s.dead) this.scene.remove(s.m); return !s.dead; });
  },
  // Hummus splashes on everyone close by.
  area(s, skip = null) {
    for (const q of this.ps) if (q !== s.from && q !== skip && !q.peer && q.dive <= 0 && Math.hypot(q.x - s.x, q.z - s.z) < FOOD_KINDS.hummus.area) this.hit({ ...s, dead: false, splash: true }, q);
  },
  hit(s, q) {
    s.dead = true;
    const kind = FOOD_KINDS[s.k], from = s.from;
    q.mess = Math.min(1, q.mess + 0.12); q.stun = 0.35; q.hits++;
    q.vx += (s.vx || 0) * 0.15; q.vz += (s.vz || 0) * 0.15;
    this.splat(q.x, 1.3, q.z, kind.splat, 0.9);
    this.stain(q, kind.splat);
    // The score: the local thrower's, and online, the victim's phone tells the thrower.
    if (from && !from.peer) from.score += kind.pts;
    if (from && from.peer) { this.hitBy[from.who] = (this.hitBy[from.who] || 0) + kind.pts; }
    if (from && from.isMe) { Sound.splat(); Sound.synth.later(60, () => Sound.ding()); this.pop(q, `${pick(FOOD_LINES.hit)}${kind.pts > 1 ? ` ${kind.pts}+` : ''}`); }
    if (q.isMe) { Sound.splat(); G.shake = 0.35; this.meSplat = 1; if (Math.random() < 0.4) Arcade.say(pick(FOOD_LINES.got), null, 1600); }
    if (kind.area && !s.splash) this.area(s, q);
  },
  // Food thrown on the other phones.
  remoteShots() {
    if (!this.ctx.net) return;
    this.seen = this.seen || new Set();
    for (const o of Arcade.others()) for (const th of (o.s && o.s.th) || []) {
      const key = o.peer + th.id;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      const from = this.ps.find(p => p.peer === o.peer);
      const s = { k: th.k, from, x: th.x, y: 1.4, z: th.z, vx: th.vx, vy: th.vy, vz: th.vz, t: 0, id: th.id };
      s.m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.foodTex[th.k] || this.foodTex.pita }));
      s.m.scale.setScalar((FOOD_KINDS[th.k] || FOOD_KINDS.pita).size);
      this.scene.add(s.m); this.shots.push(s);
    }
  },
  remote(p, dt) {
    const o = Arcade.others().find(x => x.peer === p.peer), s = o && o.s;
    if (!s) return;
    const k = Math.min(1, dt * 10);
    p.vx = (s.x - p.x) / Math.max(dt, 0.016) * 0.1; p.vz = (s.z - p.z) / Math.max(dt, 0.016) * 0.1;
    p.x += (s.x - p.x) * k; p.z += (s.z - p.z) * k;
    let da = s.a - p.a; da = Math.atan2(Math.sin(da), Math.cos(da)); p.a += da * k;
    if ((s.mess || 0) > p.mess + 0.05) this.stain(p, [0xc8902a, 0xd8261f, 0xe8d090][Math.floor(Math.random() * 3)]);
    // They took food: the table closest to them is empty on this phone too.
    if (s.h && !p.hand) { const t = this.tables.filter(q => q.back <= 0).sort((a, c) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(c.x - p.x, c.z - p.z))[0]; if (t && Math.hypot(t.x - p.x, t.z - p.z) < 3.5) { t.back = 3.5 + Math.random() * 2; t.item.visible = false; } }
    p.mess = s.mess || 0; p.dive = s.dv ? 0.1 : 0; p.hand = s.h || null;
    // Their score: what every phone (mine included) says they hit.
    let sc = (this.hitBy[p.who] || 0);
    for (const q of Arcade.others()) if (q.s && q.s.hb && q.peer !== p.peer) sc += q.s.hb[p.who] || 0;
    p.score = sc;
  },
  myScore() {
    if (!this.ctx.net) return this.me.score;
    let sc = this.me.score;
    for (const q of Arcade.others()) if (q.s && q.s.hb) sc += q.s.hb[this.me.who] || 0;
    return sc;
  },

  // ---------- effects ----------
  splat(x, y, z, color, size, floor = false) {
    const m = floor ? new THREE.Mesh(new THREE.PlaneGeometry(size * 1.6, size * 1.6), new THREE.MeshBasicMaterial({ map: this.splatTex, color, transparent: true, depthWrite: false })) : new THREE.Sprite(new THREE.SpriteMaterial({ map: this.splatTex, color, transparent: true, depthWrite: false }));
    if (floor) { m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * Math.PI * 2; }
    else m.scale.setScalar(size);
    m.position.set(x, y + (floor ? 0.01 : 0), z);
    this.scene.add(m);
    if (floor) m.material.opacity = 0.9;
    this.fx.push({ m, t: 0, life: floor ? 25 : 0.5, floor });
    if (this.fx.filter(f => f.floor).length > 60) { const f = this.fx.find(f => f.floor); f.t = f.life; }
  },
  // Food on a wall: a splat on it, and a few drips running down.
  wallSplat(s, kind) {
    const wx = Math.abs(s.x) > this.W + 1.95, sx = Math.sign(s.x), sz = Math.sign(s.z);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: this.splatTex, color: kind.splat, transparent: true, depthWrite: false, opacity: 0.9 }));
    const y = Math.min(4.6, Math.max(0.4, s.y));
    if (wx) { m.position.set(sx * (this.W + 1.97), y, Math.max(-this.D - 1.5, Math.min(this.D + 1.5, s.z))); m.rotation.y = -sx * Math.PI / 2; }
    else { m.position.set(Math.max(-this.W - 1.5, Math.min(this.W + 1.5, s.x)), y, sz * (this.D + 1.97)); m.rotation.y = sz > 0 ? Math.PI : 0; }
    m.rotation.z = Math.random() * 6.3;
    this.scene.add(m);
    this.fx.push({ m, t: 0, life: 25, floor: true });
    if (this.fx.filter(f => f.floor).length > 70) { const f = this.fx.find(f => f.floor); f.t = Math.max(f.t, f.life - 0.5); }
  },
  // A stain that stays on someone's uniform (a few at most; the oldest goes).
  stain(q, color) {
    if (!q.m) return;
    q.stains = q.stains || [];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.splatTex, color, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2;
    sp.position.set(Math.cos(a) * 0.22, 0.85 + Math.random() * 0.8, Math.sin(a) * 0.22);
    sp.scale.setScalar(0.28 + Math.random() * 0.22);
    sp.material.rotation = Math.random() * 6.3;
    q.m.root.add(sp); q.stains.push(sp);
    if (q.stains.length > 9) q.m.root.remove(q.stains.shift());
  },
  pop(q, text) {
    const l = Scene3D.label(text, { bg: 'rgba(255,214,0,.95)', fg: '#b3001b', size: 0.5 });
    l.position.set(q.x, 2.6, q.z); this.scene.add(l);
    this.fx.push({ m: l, t: 0, life: 1, rise: true });
  },
  animate(dt) {
    const sauce = new THREE.Color(0xc8902a);
    for (const p of this.ps) {
      const v = Math.hypot(p.vx, p.vz);
      const win = this.over && this.ranking()[0] === p;
      if (win) Scene3D.animateSoldier(p.m, { x: p.x / S3, y: p.z / S3, angle: Math.PI / 2, speed: 0, dancing: true }, false, dt);
      else Arcade.pose(p.m, p.x, p.z, p.a, p.dive > 0 ? 0 : v, dt);
      p.m.root.rotation.z = p.dive > 0 ? 1.2 : 0;
      p.m.root.position.y = p.dive > 0 ? 0.3 : 0;
      p.throwT = Math.max(0, (p.throwT || 0) - dt);
      p.m.root.rotation.x = p.throwT > 0 ? 0.35 : p.stun > 0 ? -0.25 : 0;
      if (Math.abs((p.messShown || 0) - p.mess) > 0.03) { p.messShown = p.mess; p.m.root.traverse(o => { if (o.isMesh && o.userData.c0) o.material.color.copy(o.userData.c0).lerp(sauce, p.mess * 0.4); }); }
      // The food in hand floats over the head.
      if (p.hand !== p.handShown) {
        if (p.handSprite) p.m.root.remove(p.handSprite);
        p.handSprite = p.hand ? new THREE.Sprite(new THREE.SpriteMaterial({ map: this.foodTex[p.hand] })) : null;
        if (p.handSprite) { p.handSprite.scale.setScalar(0.45); p.handSprite.position.set(0.3, 1.3, 0.3); p.m.root.add(p.handSprite); }
        p.handShown = p.hand;
      }
    }
    for (const f of this.fx) {
      f.t += dt;
      if (f.floor) { if (f.life - f.t < 2) f.m.material.opacity = Math.max(0, (f.life - f.t) / 2) * 0.9; continue; }
      f.m.material.opacity = Math.max(0, 1 - f.t / f.life);
      if (f.rise) f.m.position.y += dt * 1.4; else f.m.scale.multiplyScalar(1 + dt * 2);
    }
    this.fx = this.fx.filter(f => { if (f.t < f.life) return true; this.scene.remove(f.m); return false; });
    // The camera: high behind you, the hall in view.
    const me = this.me, cam = this.camera;
    const want = new THREE.Vector3(me.x * 0.75, 7.2, me.z * 0.7 + 8.8);
    cam.position.lerp(want, this.camSnap ? 1 : Math.min(1, dt * 4));
    this.camSnap = false;
    if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake * 0.5; G.shake = Math.max(0, G.shake - dt); }
    cam.lookAt(me.x * 0.85, 0.6, me.z * 0.8 - 1.5);
    this.meSplat = Math.max(0, (this.meSplat || 0) - dt * 0.7);
  },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="fd"><div class="fd-time ar-chip"></div><div class="fd-hand ar-chip"></div><div class="fd-board"></div><div class="fd-splat hidden"></div></div>`);
    const h = $('#arcade .fd');
    this.el = { time: h.querySelector('.fd-time'), hand: h.querySelector('.fd-hand'), board: h.querySelector('.fd-board'), splat: h.querySelector('.fd-splat') };
  },
  ranking() {
    // Most hits first; on a tie, whoever got hit less (and the bots before you: a tie isn't a win).
    return [...this.ps].map(p => ({ p, s: p.isMe ? this.myScore() : p.score, h: p.peer ? p.mess * 8 : p.hits })).sort((a, b) => b.s - a.s || a.h - b.h || (a.p.isMe ? 1 : 0) - (b.p.isMe ? 1 : 0)).map(x => x.p);
  },
  hud() {
    const e = this.el, me = this.me;
    if (!e || !me) return;
    const left = Math.max(0, this.LEN - this.t);
    e.time.textContent = `⏱️ ${Math.ceil(left)}`;
    e.time.classList.toggle('low', left < 10);
    const icon = { schnitzel: '🍗', pita: '🫓', hummus: '🥣', tomato: '🍅' };
    e.hand.innerHTML = me.hand ? `${icon[me.hand]} ${FOOD_KINDS[me.hand].name} — ${G.touch ? '🍗' : 'E'} לזרוק!` : '🍽️ לגשת לשולחן';
    e.hand.classList.toggle('ready', !!me.hand);
    const html = this.ranking().map(p => `<div class="${p.isMe ? 'me' : ''}"><bdi data-raw>${esc(p.name)}</bdi><b>${p.isMe ? this.myScore() : p.score}</b></div>`).join('');
    if (e.board.innerHTML !== html) e.board.innerHTML = html;
    e.splat.classList.toggle('hidden', !(this.meSplat > 0.3));
  },
  finish() {
    this.over = true;
    Sound.whistle(); Sound.fanfare();
    const w = this.ranking()[0];
    Arcade.big(w === this.me ? '🏆 מלך השניצלים!' : `🏆 ${w.name}`, 1800);
    this.resultsAt = performance.now() + 3000;
  },
  results() {
    const rows = this.ranking().map(p => { const n = p.isMe ? this.myScore() : p.score; return { name: p.name, value: n === 1 ? 'פגיעה אחת' : `${n} פגיעות`, me: p.isMe }; });
    Arcade.results('🍗 מלחמת שניצלים', rows, { sub: fmt(pick(['הטבח: "כולם — שוטפים כלים. עכשיו."', '{@inspector}: "מסדר ניקיון בחדר אוכל. בעוד חמש דקות."', '{@rasap}: "שמונה שניצלים, שלוש פיתות וחומוס. מי חותם?"'])), img: 'assets/arcade/win_food.jpg' });
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  presence() {
    const me = this.me;
    if (!me) return null;
    const th = (this.myThrows || []).filter(t => performance.now() - t.at < 2500).map(({ at, ...t }) => t);
    return { x: Math.round(me.x * 10) / 10, z: Math.round(me.z * 10) / 10, a: Math.round(me.a * 100) / 100, mess: Math.round(me.mess * 10) / 10, dv: me.dive > 0 ? 1 : 0, h: me.hand, th, hb: this.hitBy };
  },
  leave() { this.clear(); this.el = null; this.hitBy = {}; this.myThrows = []; this.over = false; this.resultsAt = null; },
};
Arcade.register(FoodGame);
