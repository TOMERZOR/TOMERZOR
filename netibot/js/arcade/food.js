// The schnitzel war (מלחמת שניצלים): lunch in the dining hall gets out of hand. Grab food off
// the tables (a schnitzel flies fast and straight, a pita curves like a frisbee, hummus
// splashes everyone around, a tomato is small and quick) and throw it at the others; roll
// (Shift / the roll button) out of the way — food thrown at you mid-roll goes right past —
// and hide behind the tables. Every hit leaves its mark on the uniform. Ninety seconds, most
// hits wins; the cook is not pleased.
// Online every throw goes to everyone, and each phone says when its own player got hit,
// so the score is what the victims report; a roll is sent as a counter, so the others see
// the whole somersault however often the presence comes.

const FOOD_KINDS = {
  schnitzel: { img: 'assets/arcade/food_schnitzel.png', name: 'שניצל', speed: 24, arc: 2, pts: 1, splat: 0xc8902a, size: 0.8 },
  pita: { img: 'assets/arcade/food_pita.png', name: 'פיתה', speed: 18, arc: 1.4, pts: 1, curve: 1, splat: 0xe8d6a0, size: 0.85 },
  hummus: { img: 'assets/arcade/food_hummus.png', name: 'חומוס', speed: 15, arc: 4, pts: 1, area: 2.4, splat: 0xe8d090, size: 0.8 },
  tomato: { img: 'assets/arcade/food_tomato.png', name: 'עגבנייה', speed: 27, arc: 1.5, pts: 2, splat: 0xd8261f, size: 0.55 },
};
// The combat roll: how long it lasts, how much of it food can't touch you, the wait before
// the next one, and its speed from the push-off to the landing (m/s).
const FOOD_ROLL = { t: 0.6, safe: 0.45, cd: 1.5, v0: 11.5, v1: 5 };
// The tuck while rolling (the same as the runner's forward roll): the back and head bend
// forward (radians about the body's left-right axis, on top of the pose), each limb is aimed
// outright in the body's own frame (forward, up, out to its side): knees to the chest, heels
// to the seat, arms round the shins. Bones a model doesn't have are skipped.
const FOOD_TUCK = [
  ['Spine02', -0.3], ['Spine01', -0.3], ['Spine', -0.25], ['Spine1', -0.3], ['Spine2', -0.3],
  ['neck', -0.25], ['Neck', -0.25], ['Head', -0.35],
];
const FOOD_LOW = ['Head', 'Hips', 'Spine', 'Spine01', 'Spine1', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot', 'LeftArm', 'RightArm'];
const FOOD_AIM = [
  ['UpLeg', 'Leg', 0.55, 0.83, 0.12], ['Leg', 'Foot', -0.45, -0.89, 0.05],
  ['Arm', 'ForeArm', 0.5, -0.8, 0.25], ['ForeArm', 'Hand', 0.35, -0.94, -0.35],
];
const FOOD_ICON = { schnitzel: '🍗', pita: '🫓', hummus: '🥣', tomato: '🍅' };
const FOOD_TIP = { schnitzel: 'מהיר וישר', pita: 'מסתובבת בקשת', hummus: 'מתיז מסביב', tomato: 'שווה כפול' };
const FOOD_LINES = {
  start: ['הטבח: "מי שזורק אוכל — שוטף כלים!"', '{@p_miriam}: "חיים שלי, זה שניצל של אמא שלי!"', '{@rasap}: "כל שניצל רשום אצלי. תחתמו."'],
  hit: ['SPLAT! 🍅', 'בול בפרצוף!', 'חחחח!', 'טריים מהמטבח!'],
  got: ['אוי! הכומתה!', 'יש לי חומוס באוזן!', 'המדים!!! הרס"פית תהרוג אותי!'],
  cook: ['הטבח: "זה היה השניצל האחרון!!!"', 'הטבח: "אני רואה אתכם!!!"', 'הטבח: "מגב! מישהו! מגב!"', '{@inspector}: "מסדר ניקיון בחדר אוכל. אחרי זה. כולם."'],
};

const FoodGame = {
  id: 'food', name: 'מלחמת שניצלים', icon: '🍗',
  desc: 'קרב אוכל בחדר האוכל: שניצלים, פיתות, חומוס ועגבניות. לזרוק, להתגלגל הצידה, להסתתר מאחורי השולחנות.',
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
    // A soft round puff, for the dust a roll kicks up.
    this.dustTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.fx = []; this.puffs = [];
    this.tmp = { v: new THREE.Vector3(), w: new THREE.Vector3(), y: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion(), flat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2) };
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
      return { ...c, m, tag, x, z, vx: 0, vz: 0, a: Math.atan2(-z, -x), hand: null, score: 0, hits: 0, mess: 0, roll: 0, rollT: 0, rollCd: 0, rolls: 0, rdx: 1, rdz: 0, stun: 0, throwCd: 0, think: 0 };
    });
    this.me = this.ps.find(p => p.isMe);
    this.shots = []; this.t = 0; this.started = false; this.over = false; this.hitBy = {}; this.lineT = 6; this.camSnap = true; this.lastRun = false; this.meSplat = 0;
    // The phone's second button is a toggle everywhere else; here every tap is a roll.
    G.touchRun = false; this.lastTR = false;
    this.ui();
    Arcade.buttons({ act: '🍽️', run: 'גלגול' });
    document.body.classList.add('fd-on');
    this.btn = { act: $('#t-act'), run: $('#t-run'), hand: undefined, cd: -1 };
    if (this.btn.run) this.btn.run.classList.remove('on');
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>🍗 מלחמת שניצלים</h2>
      <p class="ar-sub">לגשת לשולחן — לקחת אוכל · ${G.touch ? 'כפתור האוכל — לזרוק (מכוון לבד למי שמולך) · גלגול — להתגלגל לכיוון הג\'ויסטיק, אוכל עובר דרכך' : 'E / רווח — לזרוק (מכוון לבד למי שמולך) · Shift — גלגול לכיוון ההליכה, אוכל עובר דרכך'} · ${this.LEN} שניות, מי שפגע הכי הרבה מנצח.</p>
      <p class="ar-sub">🍗 שניצל — מהיר וישר · 🫓 פיתה — מסתובבת בקשת · 🥣 חומוס — מתיז על כל מי שקרוב · 🍅 עגבנייה — קטנה ומהירה, שווה כפול</p>`);
    Sound.music('boss');
    Arcade.countdown(performance.now() + (ctx.solo ? 4600 : 3400), () => { Arcade.panel(''); this.started = true; Arcade.say(fmt(pick(FOOD_LINES.start)), null, 2600); }, '🍗!');
  },
  clear() {
    for (const p of this.ps || []) this.scene.remove(p.m.root);
    for (const s of this.shots || []) this.scene.remove(s.m);
    for (const f of this.fx || []) this.scene.remove(f.m);
    for (const u of this.puffs || []) { this.scene.remove(u.s); u.s.material.dispose(); }
    this.ps = []; this.shots = []; this.fx = []; this.puffs = [];
  },

  // ---------- each frame ----------
  update(dt) {
    if (this.started && !this.over) {
      this.t += dt;
      if (this.t >= this.LEN) this.finish();
    }
    for (const p of this.ps) {
      p.throwCd = Math.max(0, p.throwCd - dt); p.rollCd = Math.max(0, p.rollCd - dt); p.stun = Math.max(0, p.stun - dt);
      if (p.roll > 0) { p.rollT += dt; p.roll = Math.max(0, p.roll - dt); if (p.roll <= 0) this.puff(p.x, p.z, p.rdx, p.rdz, 4); }
      if (p.peer) { this.remote(p, dt); continue; }
      if (!this.started || this.over) continue;
      let ix = 0, iz = 0, roll = null;
      if (p.isMe) {
        // Shift rolls as it goes down; on the phone every tap of the button is a roll.
        const inp = Arcade.input(), sh = G.keys.has('ShiftLeft') || G.keys.has('ShiftRight');
        const tap = G.touchRun !== this.lastTR;
        if (tap) { G.touchRun = false; if (this.btn && this.btn.run) this.btn.run.classList.remove('on'); }
        ix = inp.x; iz = -inp.y;
        if ((sh && !this.lastRun) || tap) roll = [ix, iz];
        this.lastRun = sh; this.lastTR = G.touchRun;
      }
      else [ix, iz, roll] = this.bot(p, dt);
      if (roll && p.rollCd <= 0 && p.roll <= 0) this.startRoll(p, roll[0], roll[1]);
      const sp = p.stun > 0 ? 1.2 : 5.2;
      const l = Math.hypot(ix, iz);
      const tvx = l > 0.05 ? ix / Math.max(1, l) * sp : 0, tvz = l > 0.05 ? iz / Math.max(1, l) * sp : 0;
      if (p.roll > 0) {
        // Mid-roll you go where the roll goes: fast off the push, slowing to the landing.
        const k = Math.min(1, p.rollT / FOOD_ROLL.t), v = FOOD_ROLL.v0 + (FOOD_ROLL.v1 - FOOD_ROLL.v0) * k;
        p.vx = p.rdx * v; p.vz = p.rdz * v;
      } else { p.vx += (tvx - p.vx) * Math.min(1, dt * 10); p.vz += (tvz - p.vz) * Math.min(1, dt * 10); }
      p.x += p.vx * dt; p.z += p.vz * dt;
      if (Math.hypot(p.vx, p.vz) > 0.4 && p.roll <= 0) p.a = Math.atan2(p.vz, p.vx);
      this.collide(p);
      // Grab food from a table you're next to.
      if (!p.hand) for (const t of this.tables) if (t.back <= 0 && Math.abs(p.x - t.x) < t.w + 0.7 && Math.abs(p.z - t.z) < t.d + 0.7) { p.hand = t.food; t.back = 3.5 + Math.random() * 2; t.item.visible = false; if (p.isMe) { Sound.pickup(); this.got(p.hand); } break; }
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
  // The bots: get food, find someone, throw (not always well), and now and then roll out of
  // the way of something that's about to hit them (sideways off its line).
  bot(p, dt) {
    p.think -= dt;
    let roll = null;
    if (p.rollCd <= 0 && p.roll <= 0) for (const s of this.shots) {
      if (s.from === p || s.dead || (s.eyed && s.eyed.has(p))) continue;
      const rx = p.x - s.x, rz = p.z - s.z, v2 = s.vx * s.vx + s.vz * s.vz;
      if (v2 < 1) continue;
      // When it passes closest, and how close: only the ones about to land on them.
      const tc = (rx * s.vx + rz * s.vz) / v2;
      if (tc < 0 || tc > 0.38) continue;
      const mx = rx - s.vx * tc, mz = rz - s.vz * tc;
      if (Math.hypot(mx, mz) > 1.3) continue;
      (s.eyed = s.eyed || new Set()).add(p);
      if (Math.random() < 0.15 + 0.4 * p.aim) {
        const sv = Math.sqrt(v2); let ox = -s.vz / sv, oz = s.vx / sv;
        if (ox * mx + oz * mz < 0) { ox = -ox; oz = -oz; }
        roll = [ox, oz];
        break;
      }
    }
    if (!p.hand) {
      const t = this.tables.filter(q => q.back <= 0).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (!t) return [0, 0, roll];
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      return [dx / d, dz / d, roll];
    }
    const target = this.ps.filter(q => q !== p && !q.out).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!target) return [0, 0, roll];
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
    if (d < 11 && p.throwCd <= 0 && p.think <= 0 && p.roll <= 0) { p.a = Math.atan2(dz, dx); this.throw(p, Math.random() < p.aim ? target : null, (Math.random() - 0.5) * (1.1 - p.aim) * 0.6); p.think = 1 + Math.random() * 1.3; }
    // Keep a fair distance and circle a little.
    const want = d > 8 ? 1 : d < 5 ? -1 : 0;
    return [dx / d * want + (-dz / d) * 0.5, dz / d * want + (dx / d) * 0.5, roll];
  },
  // A combat roll the way (dx, dz) — straight ahead with no direction — a tucked somersault.
  startRoll(p, dx, dz) {
    const l = Math.hypot(dx, dz);
    if (l < 0.15) { dx = Math.cos(p.a); dz = Math.sin(p.a); } else { dx /= l; dz /= l; }
    p.roll = FOOD_ROLL.t; p.rollT = 0; p.rollCd = FOOD_ROLL.cd; p.rdx = dx; p.rdz = dz;
    p.a = Math.atan2(dz, dx); p.rolls = (p.rolls || 0) + 1;
    this.puff(p.x, p.z, dx, dz, 7);
    if (p.isMe) Sound.whoosh();
  },
  // Food can't touch you for most of a roll.
  safe(q) { return q.roll > 0 && q.rollT < FOOD_ROLL.safe; },
  act() { if (this.started && !this.over && this.me && this.me.hand) this.throw(this.me); else if (this.me && !this.me.hand) Sound.synth.tone(200, 0.06, 'square', 0.03); },
  // A throw: aimed at whoever's most in front (a little help), arcing.
  throw(p, target = null, err = 0) {
    if (!p.hand || p.throwCd > 0 || p.roll > 0) return;
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
        if (q === s.from || q.peer) continue;
        if (Math.hypot(q.x - s.x, q.z - s.z) < (kind.area ? 0.75 : 0.6) && s.y < 2 && s.y > 0.2) {
          // Mid-roll it goes right past (once a shot, a little "missed!" over your head).
          if (this.safe(q)) { if (!(s.missed = s.missed || new Set()).has(q)) { s.missed.add(q); q.dodges = (q.dodges || 0) + 1; if (q.isMe) { this.pop(q, '😎 התחמקות!', true); Sound.synth.tone(880, 0.07, 'triangle', 0.04); } } continue; }
          this.hit(s, q); break;
        }
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
    for (const q of this.ps) if (q !== s.from && q !== skip && !q.peer && !this.safe(q) && Math.hypot(q.x - s.x, q.z - s.z) < FOOD_KINDS.hummus.area) this.hit({ ...s, dead: false, splash: true }, q);
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
    p.mess = s.mess || 0; p.hand = s.h || null;
    // Their rolls: a counter that goes up with each one (and its direction); from an older
    // version without it, the start of its dive flag.
    if (s.rn != null) {
      if (p.rnSeen == null) p.rnSeen = s.rn;
      else if (s.rn !== p.rnSeen) { p.rnSeen = s.rn; const a = s.ra != null ? s.ra : s.a; this.startRoll(p, Math.cos(a), Math.sin(a)); }
    } else {
      if (s.dv && !p.dvWas && p.roll <= 0) this.startRoll(p, Math.cos(s.a), Math.sin(s.a));
      p.dvWas = !!s.dv;
    }
    if (p.roll > 0) p.a = Math.atan2(p.rdz, p.rdx);

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
  pop(q, text, cool = false) {
    const l = Scene3D.label(text, cool ? { bg: 'rgba(20,60,90,.9)', fg: '#bfefff', size: 0.42 } : { bg: 'rgba(255,214,0,.95)', fg: '#b3001b', size: 0.5 });
    l.position.set(q.x, 2.6, q.z); this.scene.add(l);
    this.fx.push({ m: l, t: 0, life: 1, rise: true });
  },
  // A little cloud of dust where a roll starts (and a smaller one where it lands), left
  // behind as you go.
  puff(x, z, dx, dz, n) {
    if (!this.dustTex) return;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, color: 0xcdbd9a, transparent: true, opacity: 0.5, depthWrite: false }));
      s.position.set(x + (Math.random() - 0.5) * 0.8, 0.12 + Math.random() * 0.25, z + (Math.random() - 0.5) * 0.8);
      this.scene.add(s);
      this.puffs.push({ s, t: 0, life: 0.45 + Math.random() * 0.3, r: 0.7 + Math.random() * 0.5, v: new THREE.Vector3(-dx * 2 + (Math.random() - 0.5) * 2.6, 0.4 + Math.random() * 0.8, -dz * 2 + (Math.random() - 0.5) * 2.6) });
    }
  },
  // The roll on the model: a tucked forward somersault around the body's middle, which rolls
  // along the floor; it opens up for the last bit of the turn, to land on the feet.
  // Returns whether it's showing (false: standing as usual).
  rollPose(p, dt) {
    const m = p.m, R = m.rollA || (m.rollA = { a: 0, w: 0 }), TAU = Math.PI * 2, T = FOOD_ROLL.t;
    let left;   // how much of the turn is still to go (radians)
    if (p.roll > 0) { R.a = -TAU * Math.min(1, p.rollT / T); left = TAU * p.roll / T; }
    else if (R.a < 0) { R.a -= dt * TAU / T * 1.2; left = R.a + TAU; if (left <= 0) { R.a = 0; left = 0; } }
    else left = 0;
    const want = R.a < 0 && left > 0.9 ? 1 : 0;
    R.w += (want - R.w) * Math.min(1, dt * (want ? 22 : 9));
    if (R.w < 0.01 && R.a === 0) { R.w = 0; return false; }
    const w = R.w, root = m.root, V = this.tmp;
    if (m.rigged && m.mixer) this.tuck(m, w);
    if (m.hipY == null) m.hipY = 0.95;
    // Turn around the ball's middle (from the hips standing to the tucked body's own centre,
    // w of the way): the model's forward is its +x, so the turn is about its own z.
    const s = root.scale.y, bc = m.ballC || { x: 0.1, y: 0.55 }, br = m.ballR || 0.5;
    const cx = bc.x * w * s, cy = (m.hipY + (bc.y - m.hipY) * w) * s, h = (m.hipY + (br - m.hipY) * w) * s;
    root.rotation.z = R.a;
    const c = V.v.set(cx, cy, 0).applyEuler(root.rotation);
    root.position.set(p.x - c.x, h - c.y, p.z - c.z);
    // Then exactly on the floor: whatever's lowest right now just touches it.
    const B = m.tuckB;
    if (B && w > 0.02) {
      root.updateMatrixWorld(true);
      let low = Infinity;
      for (const n of FOOD_LOW) if (B[n]) low = Math.min(low, B[n].getWorldPosition(c).y);
      if (low < Infinity) root.position.y += (0.11 * s - low) * w;
    }
    return true;
  },
  // Knees up, heels in, back rounded, head down, arms round the shins — w of the way. The
  // bones it moves are kept, to put back before the next frame's pose (while the pose is held
  // still the mixer doesn't rewrite a bone it thinks hasn't changed, and the tuck would pile up).
  tuck(m, w) {
    if (!m.tuckB) {
      const B = {};
      m.root.traverse(o => { if (o.isBone && !B[o.name]) B[o.name] = o; });
      m.tuckB = B;
      const r = m.root, ry = r.position.y, rz = r.rotation.z;
      r.position.y = 0; r.rotation.z = 0; r.updateMatrixWorld(true);
      if (B.Hips) m.hipY = B.Hips.getWorldPosition(new THREE.Vector3()).y / (r.scale.y || 1);
      r.position.y = ry; r.rotation.z = rz;
    }
    const B = m.tuckB, Q = THREE.Quaternion;
    const q = this.tq || (this.tq = { d: new Q(), b: new Q(), p: new Q(), axis: new THREE.Vector3() });
    m.root.updateMatrixWorld(true);
    // The body's own left-right axis, in the world: turning round it moves things forward.
    q.axis.set(0, 0, 1).applyQuaternion(m.root.getWorldQuaternion(q.b));
    const turn = (name, a) => {
      const bone = B[name];
      if (!bone || !bone.parent) return;
      q.d.setFromAxisAngle(q.axis, a * w);
      bone.getWorldQuaternion(q.b); bone.parent.getWorldQuaternion(q.p);
      bone.quaternion.copy(q.p.invert().multiply(q.d.multiply(q.b)));
      bone.updateMatrixWorld(true);
    };
    const save = m.tuckSave || (m.tuckSave = []);
    save.length = 0;
    for (const [n] of FOOD_TUCK) if (B[n]) save.push([B[n], B[n].quaternion.clone()]);
    for (const side of ['Left', 'Right']) for (const [n] of FOOD_AIM) if (B[side + n]) save.push([B[side + n], B[side + n].quaternion.clone()]);
    for (const [n, a] of FOOD_TUCK) turn(n, a);
    const V = this.tv || (this.tv = { a: new THREE.Vector3(), b: new THREE.Vector3(), want: new THREE.Vector3(), rq: new Q(), id: new Q() });
    m.root.getWorldQuaternion(V.rq);
    const hips = B.Hips && B.Hips.getWorldPosition(new THREE.Vector3());
    for (const side of ['Left', 'Right']) {
      const sh = B[side + 'UpLeg'];
      if (!sh || !hips) continue;
      const out = Math.sign(sh.getWorldPosition(V.a).sub(hips).applyQuaternion(V.rq.clone().invert()).z) || (side === 'Left' ? 1 : -1);
      for (const [n, c, fx, fy, fz] of FOOD_AIM) {
        const bone = B[side + n], kid = B[side + c];
        if (!bone || !kid || !bone.parent) continue;
        bone.getWorldPosition(V.a); kid.getWorldPosition(V.b);
        const cur = V.b.sub(V.a).normalize();
        V.want.set(fx, fy, fz * out).normalize().applyQuaternion(V.rq);
        q.d.setFromUnitVectors(cur, V.want);
        q.d.slerp(V.id, 1 - w);
        bone.getWorldQuaternion(q.b); bone.parent.getWorldQuaternion(q.p);
        bone.quaternion.copy(q.p.invert().multiply(q.d.multiply(q.b)));
        bone.updateMatrixWorld(true);
      }
    }
    // Fully tucked the first time: where the ball's middle is (in the model's own frame) and
    // how big it is.
    if (w > 0.98 && !m.ballC) {
      const pts = ['Head', 'Hips', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot', 'LeftHand', 'RightHand', 'Spine'].filter(n => B[n]).map(n => m.root.worldToLocal(B[n].getWorldPosition(new THREE.Vector3())));
      if (pts.length >= 5) {
        const c = pts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
        m.ballC = { x: c.x, y: c.y };
        m.ballR = Math.max(0.35, Math.min(0.7, pts.reduce((mx, v) => Math.max(mx, Math.hypot(v.x - c.x, v.y - c.y)), 0) * 0.8 + 0.06));
      }
    }
  },
  untuck(m) {
    if (!m.tuckSave || !m.tuckSave.length) return;
    for (const [bone, q] of m.tuckSave) bone.quaternion.copy(q);
    m.tuckSave.length = 0;
  },
  // While the body turns over, the name tag and the food in hand stay up over the head, and
  // the soft shadow stays on the floor; standing, they go back where they were.
  upright(p, on) {
    const r = p.m.root, V = this.tmp;
    if (on) r.updateMatrixWorld(true);
    for (const c of [p.tag, p.handSprite]) {
      if (!c) continue;
      const home = c.userData.home || (c.userData.home = c.position.clone());
      if (!on) { c.position.copy(home); continue; }
      V.w.set(home.x * r.scale.x, home.y * r.scale.y, home.z * r.scale.z).applyAxisAngle(V.y, r.rotation.y);
      V.w.x += p.x; V.w.z += p.z;
      c.position.copy(r.worldToLocal(V.w));
    }
    const b = p.m.blob === undefined ? (p.m.blob = r.children.find(o => o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry') || null) : p.m.blob;
    if (!b) return;
    const bh = b.userData.home || (b.userData.home = { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() });
    if (!on) { b.position.copy(bh.p); b.quaternion.copy(bh.q); b.scale.copy(bh.s); return; }
    b.position.copy(r.worldToLocal(V.w.set(p.x, 0.03, p.z)));
    b.quaternion.copy(r.getWorldQuaternion(V.q).invert().multiply(V.flat));
    b.scale.copy(bh.s);
  },
  animate(dt) {
    const sauce = new THREE.Color(0xc8902a);
    for (const p of this.ps) {
      const v = Math.hypot(p.vx, p.vz);
      const win = this.over && this.ranking()[0] === p;
      // Mid-roll the pose holds still (the tuck goes on top of it) and faces the roll at once.
      const rolling = p.roll > 0 || (p.m.rollA && p.m.rollA.a < 0);
      this.untuck(p.m);
      if (win) Scene3D.animateSoldier(p.m, { x: p.x / S3, y: p.z / S3, angle: Math.PI / 2, speed: 0, dancing: true }, false, dt);
      else Arcade.pose(p.m, p.x, p.z, p.a, rolling ? 0 : v, rolling ? 0 : dt);
      const r = p.m.root;
      r.rotation.x = 0; r.rotation.z = 0; r.position.y = 0;
      p.throwT = Math.max(0, (p.throwT || 0) - dt);
      const shown = !win && this.rollPose(p, dt);
      // Leaning into a throw, or back from a hit (about the body's own left-right axis).
      if (!shown) r.rotation.z = p.throwT > 0 ? -0.3 : p.stun > 0 ? 0.22 : 0;
      if (shown || p.uprightOn) { this.upright(p, shown); p.uprightOn = shown; }
      if (Math.abs((p.messShown || 0) - p.mess) > 0.03) { p.messShown = p.mess; p.m.root.traverse(o => { if (o.isMesh && o.userData.c0) o.material.color.copy(o.userData.c0).lerp(sauce, p.mess * 0.4); }); }
      // The food in hand floats over the head.
      if (p.hand !== p.handShown) {
        if (p.handSprite) p.m.root.remove(p.handSprite);
        p.handSprite = p.hand ? new THREE.Sprite(new THREE.SpriteMaterial({ map: this.foodTex[p.hand] })) : null;
        if (p.handSprite) { p.handSprite.scale.setScalar(0.45); p.handSprite.position.set(0.3, 1.3, 0.3); p.m.root.add(p.handSprite); }
        p.handShown = p.hand;
      }
    }
    for (const u of this.puffs) { u.t += dt; const k = u.t / u.life; u.s.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - dt * 3); u.s.scale.setScalar(u.r * (0.5 + k * 1.4)); u.s.material.opacity = 0.55 * (1 - k) * (1 - k); }
    this.puffs = this.puffs.filter(u => { if (u.t >= u.life) { this.scene.remove(u.s); u.s.material.dispose(); return false; } return true; });

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
  // The clock; what's in your hand and the roll's wait (one row, off to the edge: at the
  // bottom, on a phone under the clock); a small note there when you pick something up; the
  // scores; sauce round the edges of the screen when you're hit.
  ui() {
    Arcade.hud(`<div class="fd"><div class="fd-time ar-chip"></div><div class="fd-bar"><div class="fd-hand ar-chip"></div><div class="fd-roll ar-chip"><i></i><span>🤸 Shift</span></div></div><div class="fd-got hidden"></div><div class="fd-board"></div><div class="fd-splat hidden"></div></div>`);
    const h = $('#arcade .fd');
    this.el = { time: h.querySelector('.fd-time'), hand: h.querySelector('.fd-hand'), roll: h.querySelector('.fd-roll'), rollBar: h.querySelector('.fd-roll i'), got: h.querySelector('.fd-got'), board: h.querySelector('.fd-board'), splat: h.querySelector('.fd-splat') };
    this.rollShown = -1;
  },
  // Picked something up: a small note by the hand chip for a moment (not over the hall), and
  // the throw button turns into it.
  got(k) {
    const e = this.el && this.el.got;
    if (e) {
      e.innerHTML = `<b>${FOOD_ICON[k]} ${FOOD_KINDS[k].name}</b> · ${FOOD_TIP[k]}`;
      e.classList.remove('hidden', 'show'); void e.offsetWidth; e.classList.add('show');
      clearTimeout(this.gotT); this.gotT = setTimeout(() => e.classList.add('hidden'), 1500);
    }
    const a = this.btn && this.btn.act;
    if (a) { a.classList.remove('fd-new'); void a.offsetWidth; a.classList.add('fd-new'); }
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
    const hand = me.hand ? `${FOOD_ICON[me.hand]} ${FOOD_KINDS[me.hand].name} — ${G.touch ? '' : 'E '}לזרוק!` : '🍽️ לגשת לשולחן';
    if (e.hand.textContent !== hand) e.hand.textContent = hand;
    e.hand.classList.toggle('ready', !!me.hand);
    // The roll's wait: filling up on the chip, and a dark wedge going round the phone's button.
    const cd = Math.ceil(me.rollCd / FOOD_ROLL.cd * 40) / 40;
    if (cd !== this.rollShown) {
      this.rollShown = cd;
      if (e.rollBar) e.rollBar.style.width = `${Math.round((1 - cd) * 100)}%`;
      if (e.roll) e.roll.classList.toggle('ready', cd <= 0);
      const run = this.btn && this.btn.run;
      if (run) { run.style.setProperty('--fd-cd', cd); run.classList.toggle('fd-cool', cd > 0); }
    }
    // The throw button shows what you'd throw.
    const b = this.btn;
    if (b && b.act && b.hand !== me.hand) { b.hand = me.hand; b.act.textContent = me.hand ? FOOD_ICON[me.hand] : '🍽️'; b.act.classList.toggle('fd-empty', !me.hand); }
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
    // dv: rolling now (what older versions read as a dive); rn / ra: how many rolls so far and
    // the last one's direction, so the others play each one whole.
    return { x: Math.round(me.x * 10) / 10, z: Math.round(me.z * 10) / 10, a: Math.round(me.a * 100) / 100, mess: Math.round(me.mess * 10) / 10, dv: me.roll > 0 ? 1 : 0, rn: me.rolls || 0, ra: Math.round(Math.atan2(me.rdz, me.rdx) * 100) / 100, h: me.hand, th, hb: this.hitBy };
  },
  leave() {
    this.clear(); this.el = null; this.hitBy = {}; this.myThrows = []; this.over = false; this.resultsAt = null;
    clearTimeout(this.gotT);
    document.body.classList.remove('fd-on');
    const b = this.btn;
    if (b) { if (b.run) { b.run.style.removeProperty('--fd-cd'); b.run.classList.remove('fd-cool', 'on'); } if (b.act) b.act.classList.remove('fd-empty', 'fd-new'); }
    this.btn = null; G.touchRun = false;
  },

};
Arcade.register(FoodGame);
