// The driving commanders' race (תחרות מפקדי נסיעה): a world of its own. The player is the
// driving commander in the passenger seat and gives the orders; the driver does the rest.
// Four maps with three tracks each (js/racemaps.js), a garage of eight cars in four tiers that
// open up with the player's rank (the higher, the faster), bumps that knock rivals off
// the line, and Mario Kart style pickups on the road: spinning shekel coins (up to ten, each
// a little more speed) and floating jerrycans that hand out a power-up. Friends online join
// through an invite; alone, three commanders from the cast race you, in cars of your tier.
// The cars, the coin, the jerrycan and the pine are Higgsfield models (assets/models/); the
// original desert circuit's map was painted over RACE_POINTS.
const RACE_POINTS = [[0, -70], [60, -78], [100, -55], [108, -15], [82, 12], [48, 18], [30, 45], [52, 80], [25, 108], [-30, 104], [-60, 78], [-58, 40], [-92, 20], [-104, -25], [-72, -60]];
const RACE_MAP = { cx: 2.171, cz: 15.677, size: 280 };
const RACE_LAPS = 3;
// The garage opens up with the rank: a tier per rank, two cars each (the weaker first), from the
// slow and sturdy ones a corporal gets to the officers' beast. Playing as a cast member uses their
// rank. Lap times (negev, easy, the bot brain at full skill): ~80s, ~73s, ~65s, ~57-59s.
const RACE_RANKS = ['rabat', 'samal', 'samar', '1', '2', '3', 'leaf'];
const RACE_TIERS = [
  { tier: 0, unlock: 'rabat', name: 'רכבי הפלגה', desc: 'איטיים, אבל סוחבים הכל' },
  { tier: 1, unlock: 'samal', name: 'רכבי הסמלים', desc: 'יותר כוח, יותר משקל' },
  { tier: 2, unlock: 'samar', name: 'רכבי המפקדים', desc: 'מהירים באמת. להחזיק חזק' },
  { tier: 3, unlock: '1', name: 'רכבי הקצינים', desc: 'מפלצות. שהרס"פית לא תשמע' },
];
// top: m/s, acc: m/s², grip: turning, mass: who wins a bump, len: model length (m). The
// models were lifted facing +z; rotY turns them to face +x like everything else here.
// model: which of the five models (assets/models/car_<model>.json) it is; paint: how it's
// repainted (tint multiplies the texture, hue turns it, stripes are projected onto the body).
const RACE_CARS = [
  { id: 'van', name: 'ההסעה', desc: 'איטית, כבדה, לא זזה ממכה', tier: 0, top: 29, acc: 10, grip: 0.85, mass: 1.5, len: 5.6, rotY: Math.PI / 2 },
  { id: 'picanto', name: 'הפיקנטו של אמא', desc: 'קטנה, זריזה, עפה מכל מכה', tier: 0, top: 27, acc: 14, grip: 1.2, mass: 0.7, len: 3.6, rotY: Math.PI / 2 },
  { id: 'hummer', name: 'האמר', desc: 'כבד. מעיף את כולם', tier: 1, top: 32, acc: 13, grip: 0.95, mass: 1.8, len: 4.8, rotY: Math.PI / 2 },
  { id: 'hilux', name: 'היילקס', desc: 'מאוזנת בכל', tier: 1, top: 33, acc: 13.5, grip: 1.0, mass: 1.25, len: 5.2, rotY: Math.PI / 2 },
  { id: 'sufa', name: 'סופה', desc: 'מהירה וזריזה בפניות', tier: 2, top: 36, acc: 16, grip: 1.15, mass: 1.0, len: 4.1, rotY: Math.PI / 2 },
  { id: 'jeep_cmd', name: 'הג\'יפ של המג"ד', desc: 'שחור, מהיר, ועם חלונות כהים', tier: 2, model: 'hilux', paint: { tint: 0x33363c, badge: ['מג"ד', '#1c2a4f', '#ffffff'] }, top: 39, acc: 16, grip: 1.12, mass: 1.7, len: 5.2, rotY: Math.PI / 2 },
  { id: 'picanto_t', name: 'פיקנטו טורבו', desc: 'של אמא, אחרי שהקצין "שיפר" אותה', tier: 3, model: 'picanto', paint: { hue: 205, tint: 0xd8e4ff, stripes: '#ffffff', badge: ['TURBO', '#ffffff', '#1f4fd0'] }, top: 39, acc: 19, grip: 1.3, mass: 0.75, len: 3.6, rotY: Math.PI / 2 },
  { id: 'sufa_gt', name: 'סופה GT', desc: 'המפלצת. פסי מירוץ ושום רחמים', tier: 3, model: 'sufa', paint: { tint: 0x40423f, sat: 0.3, stripes: '#f2c12e', badge: ['GT', '#f2c12e', '#151515'] }, top: 46, acc: 21, grip: 1.3, mass: 1.1, len: 4.1, rotY: Math.PI / 2 },
];
for (const c of RACE_CARS) { c.model = c.model || c.id; c.unlock = RACE_TIERS[c.tier].unlock; }
// What a jerrycan gives. w: how likely, by place (leader … last), so the last gets the good stuff.
const RACE_ITEMS = [
  { id: 'turbo', icon: '⛽', name: 'דלק טורבו', w: [1, 3, 5] },
  { id: 'oil', icon: '🛢️', name: 'כתם שמן', w: [4, 3, 1] },
  { id: 'mega', icon: '📢', name: 'המגפון של המפקדת', w: [2, 3, 3] },
  { id: 'shield', icon: '🛡️', name: 'חגורת בטיחות', w: [3, 2, 1] },
  { id: 'burger', icon: '🍔', name: 'צ\'יזבורגר מעופף', w: [0, 2, 4] },
];
// What your driver says, and what the commanders shout.
const RACE_LINES = {
  go: ['סע! סע! סע!', 'גז, גז, גז!', 'חגורה? חגורה. סע!'],
  bump: ['הוא נכנס בי!!!', 'סליחה! ...לא באמת', 'מי לימד אותו לנהוג?!', 'זה לא נחשב תאונה, נכון?', 'בום! 💥'],
  sand: ['אני בחול!!! תכוון אותי!', 'זה לא כביש, זה חוף!', 'החול נכנס לי לנעליים!'],
  rail: ['המעקה!!! המעקה!!!', 'שריטה. הרס"פית תהרוג אותנו.', 'זה בסדר, זה רק הצבע...'],
  pass: ['עקפנו!!!', 'ביי ביי! 👋', 'מפקד נסיעה אגדי!'],
  passed: ['הוא עקף אותנו!', 'תן לי פקודה! מהר!', 'אני לא מאמין...'],
  boost: ['🗣️ "סע כבר!!!"', '🗣️ "גז!!! עכשיו!!!"', '🗣️ "יאללה, יאללה!!!"'],
  lap: ['עוד סיבוב!', 'הסיבוב האחרון! הכל או כלום!'],
  taunt: ['ימינה! ימינה!', 'זוז, זה תור שלי!', 'אני מפקד נסיעה כבר שנה!', 'חגורה!', 'תעקוף אותו!'],
  coins: ['כסף! תאסוף, תאסוף!', 'עשרה שקלים! זה שתי כוסות קפה בש"ק!', 'מלא כסף! יש לנו פלאפל הערב!'],
  oilHit: ['שמן?! מי שפך פה שמן?!', 'אנחנו מסתובבים!!!', 'הההההה!!! 🌀'],
  item: { turbo: '⛽ "מלא! עכשיו לטוס!"', oil: '🛢️ "שישתזפו בשמן מאחורינו"', mega: '📢 "כולם — זוזו!!!"', shield: '🛡️ "חגורה! עכשיו אף אחד לא מזיז אותנו"', burger: '🍔 "צ\'יזבורגרו שולח ד"ש!"' },
  burgerHit: ['צ\'יזבורגר בשמשה!!! אני לא רואה כלום!', 'זה... רוטב אלף האיים?!'],
};

const Race = {
  active: false,
  phase: null,     // 'map' | 'pick' | 'lobby' | 'countdown' | 'race' | 'done'
  scene: null,
  cars: [],
  me: null,
  net: null,       // { id, host, map, lv } when racing with friends online
  seenInvites: new Set(),
  mapId: 'negev', lv: 0,

  // ---------- the world ----------
  // Builds (or reuses) a map's world; the old one is freed, apart from the shared models.
  useWorld(mapId, lv) {
    if (this.W && this.W.map.id === mapId && this.W.lv === lv) return;
    if (this.W) this.disposeWorld(this.W);
    const W = this.W = RaceWorld.build(mapId, lv);
    this.scene = W.scene; this.camera = W.camera; this.sun = W.sun; this.samples = W.samples;
    this.half = W.half;
    const S = W.samples;
    let len = 0;
    for (let i = 0; i < S.length; i++) len += Math.hypot(S[(i + 1) % S.length].x - S[i].x, S[(i + 1) % S.length].z - S[i].z);
    this.sp = len / S.length;
    this.trackLen = len;
    this.fx = { dust: [], stars: [], confetti: [], oil: [], burgers: [], drops: [] };
    this.dustTex = this.dustTex || this.softTex('rgba(235,215,170,1)');
    this.pickups();
  },
  disposeWorld(W) {
    const shared = new Set();
    const mark = (o) => o.traverse(m => { if (m.geometry) shared.add(m.geometry); const ms = m.material ? [].concat(m.material) : []; for (const x of ms) { shared.add(x); if (x.map) shared.add(x.map); } });
    for (const k in Assets.models) mark(Assets.models[k]);
    if (RaceWorld.pine) { shared.add(RaceWorld.pine.geo); shared.add(RaceWorld.pine.mat); }
    if (RaceWorld.roadT) shared.add(RaceWorld.roadT);
    for (const k in this.paints || {}) { const c = this.paints[k]; if (c.map) shared.add(c.map); if (c.stripes) shared.add(c.stripes); for (const g of c.geos ? c.geos.values() : []) shared.add(g); }
    if (RaceWorld.pineBB) { shared.add(RaceWorld.pineBB.geo); shared.add(RaceWorld.pineBB.mat); shared.add(RaceWorld.pineBB.mat.map); }
    W.scene.traverse(o => {
      if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
      for (const m of o.material ? [].concat(o.material) : []) { if (shared.has(m)) continue; if (m.map && !shared.has(m.map)) m.map.dispose(); m.dispose(); }
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
  ahead(m) { return Math.max(1, Math.round(m / this.sp)); },
  softTex(color) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  },

  // ---------- coins and jerrycans ----------
  // Rows of coins every ~65 m, weaving across the road; a line of jerrycans every ~200 m.
  // Placed from the map's own seed, so everyone online sees them in the same places.
  pickups() {
    const W = this.W, S = this.samples, N = S.length, rnd = Arcade.rng(W.map.id.length * 7919 + W.lv * 31 + 7);
    this.items = [];
    if (!this.coinGeo) {
      this.coinGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.14, 28);
      const face = new THREE.TextureLoader().load('assets/race/coin.png'); face.encoding = THREE.sRGBEncoding;
      const faceM = new THREE.MeshStandardMaterial({ map: face, metalness: 0.55, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.6, transparent: true });
      this.coinMats = [new THREE.MeshStandardMaterial({ color: 0xd9a92e, metalness: 0.8, roughness: 0.3, emissive: 0x4a3400 }), faceM, faceM];
      this.glowTex = this.softTex('rgba(255,214,90,1)');
    }
    const add = (kind, i, lat) => {
      const s = S[i % N], g = new THREE.Group();
      if (kind === 'coin') {
        const m = new THREE.Mesh(this.coinGeo, this.coinMats); m.rotation.x = Math.PI / 2; m.castShadow = true; g.add(m);
      } else {
        const m = Assets.model('race_fuel', { height: 1.25 });
        if (m) { m.position.y = -0.62; g.add(m); }
        else { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.4), new THREE.MeshStandardMaterial({ color: 0xd8261f })); g.add(b); }
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffe08a, transparent: true, depthWrite: false, opacity: 0.55 }));
        glow.scale.setScalar(3); g.add(glow);
      }
      const x = s.x - Math.sin(s.a) * lat, z = s.z + Math.cos(s.a) * lat;
      g.position.set(x, s.y + 1.25, z);
      this.scene.add(g);
      this.items.push({ kind, i: i % N, x, z, y: s.y + 1.25, obj: g, off: 0, ph: rnd() * 6 });
    };
    const step = this.ahead(65), half = this.half;
    for (let i = this.ahead(45), k = 0; i < N - this.ahead(20); i += step, k++) {
      const lat0 = (rnd() - 0.5) * half * 1.1, drift = (rnd() - 0.5) * half * 0.5;
      for (let j = 0; j < 4; j++) add('coin', i + j * this.ahead(5), Math.max(-half * 0.75, Math.min(half * 0.75, lat0 + drift * j)));
    }
    const fstep = this.ahead(200);
    for (let i = this.ahead(120); i < N - this.ahead(30); i += fstep) for (const f of [-0.55, -0.18, 0.18, 0.55]) add('fuel', i, f * half * 1.5);
  },
  updatePickups(dt, t) {
    const all = this.cars;
    for (const p of this.items) {
      if (p.off > 0) { p.off -= dt; if (p.off <= 0) { p.obj.visible = true; p.obj.scale.setScalar(0.01); } continue; }
      p.obj.rotation.y = t / 380 + p.ph;
      p.obj.position.y = p.y + Math.sin(t / 300 + p.ph) * 0.18;
      if (p.obj.scale.x < 1) p.obj.scale.setScalar(Math.min(1, p.obj.scale.x + dt * 4));
      if (this.phase !== 'race' && this.phase !== 'done') continue;
      for (const c of all) {
        if (Math.abs(c.x - p.x) > 2.6 || Math.abs(c.z - p.z) > 2.6) continue;
        if (Math.hypot(c.x - p.x, c.z - p.z) > (p.kind === 'coin' ? 2.1 : 2.5)) continue;
        p.off = p.kind === 'coin' ? 7 : 4;
        p.obj.visible = false;
        if (p.kind === 'coin') this.gotCoin(c, p);
        else this.gotFuel(c, p);
        break;
      }
    }
  },
  gotCoin(c, p) {
    if (c.coins >= 10) { if (c.isMe) Sound.synth.tone(1200, 0.04, 'square', 0.03); return; }
    c.coins++;
    if (!c.isMe) return;
    Sound.coin();
    this.sparkle(p.x, p.y, p.z, 0xffd23f);
    if (c.coins === 10) this.say(pick(RACE_LINES.coins), 'driver');
  },
  gotFuel(c, p) {
    if (c.item || c.rolling > 0) return;
    // The roulette: a second of spinning icons, then the item (better for the back of the pack).
    const st = this.standings(), place = st.indexOf(c), n = Math.max(1, st.length - 1), band = place / n < 0.34 ? 0 : place / n < 0.67 ? 1 : 2;
    const total = RACE_ITEMS.reduce((a, it) => a + it.w[band], 0);
    let r = Math.random() * total, got = RACE_ITEMS[0];
    for (const it of RACE_ITEMS) { r -= it.w[band]; if (r <= 0) { got = it; break; } }
    c.next = got;
    c.rolling = c.isMe ? 1.1 : 0.01;
    if (c.isMe) { Sound.pickup(); this.sparkle(p.x, p.y, p.z, 0xff5a3a); }
    if (c.bot) c.useAt = this.raceT + 1.5 + Math.random() * 4;
  },
  sparkle(x, y, z, color) {
    for (let i = 0; i < 6; i++) this.puff(x + (Math.random() - 0.5), z + (Math.random() - 0.5), color, 0.5, y);
  },

  // ---------- power-ups ----------
  useItem(c) {
    const it = c.item;
    if (!it) return false;
    c.item = null;
    if (c.isMe) { this.say(RACE_LINES.item[it.id], 'me'); this.ev({ k: it.id }); }
    if (it.id === 'turbo') { c.boostT = 2.4; c.turbo = true; if (c.isMe) Sound.boost(); }
    else if (it.id === 'shield') { c.shieldT = 7; if (c.isMe) Sound.ding(); }
    else if (it.id === 'oil') this.dropOil(c.x - Math.cos(c.a) * (c.type.len * 0.7 + 1.5), c.z - Math.sin(c.a) * (c.type.len * 0.7 + 1.5), c);
    else if (it.id === 'mega') this.megaphone(c.x, c.z, c);
    else if (it.id === 'burger') {
      // At the car just ahead (or, for the leader, nobody: it flies off down the road).
      const st = this.standings(), target = st[st.indexOf(c) - 1] || null;
      this.throwBurger(c.x, c.z, c, target);
    }
    return true;
  },
  dropOil(x, z, owner, remote = false) {
    const n = this.nearest(x, z, owner && owner.idx != null ? owner.idx : null);
    const y = this.W.roadY(n.i, x, z) + 0.09;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    if (!this.oilTex) {
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      gr.addColorStop(0, 'rgba(10,8,12,.95)'); gr.addColorStop(0.7, 'rgba(30,20,40,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, r = 22 + Math.sin(k * 2.7) * 8; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill();
      this.oilTex = new THREE.CanvasTexture(c);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshStandardMaterial({ map: this.oilTex, transparent: true, roughness: 0.05, metalness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
    this.scene.add(m);
    this.fx.oil.push({ m, x, z, t: 0, owner, grace: remote ? 0 : 1.2 });
    if (!remote) Sound.splat();
  },
  megaphone(x, z, from) {
    // A ring of sound pushes everyone around away and shakes them up.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, (from && from.y || 0) + 1, z);
    this.scene.add(ring);
    this.fx.stars.push({ m: ring, t: 0, ring: true });
    Sound.horn(); Sound.screech && Sound.synth.tone(320, 0.5, 'sawtooth', 0.06, 200);
    for (const c of this.cars) {
      if (c === from) continue;
      const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
      if (d > 20 || d < 0.01) continue;
      if (c.shieldT > 0) continue;
      const k = (1 - d / 20) * 16;
      c.ix += dx / d * k; c.iz += dz / d * k; c.v *= 0.5; c.spin += (Math.random() - 0.5) * 3;
      this.star(c.x, c.z, '📢!!!');
      if (c.isMe) { this.shake = 0.6; this.say('האוזניים!!! מי צועק?!', 'driver'); }
    }
  },
  throwBurger(x, z, from, target, remote = false) {
    const m = new THREE.Group();
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd99a3e }));
    bun.position.y = 0.1; m.add(bun);
    const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.18, 14), new THREE.MeshStandardMaterial({ color: 0x5a3218 })); m.add(patty);
    const cheese = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: 0xf2c12e })); cheese.position.y = 0.1; cheese.rotation.y = 0.6; m.add(cheese);
    const low = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.2, 14), new THREE.MeshStandardMaterial({ color: 0xd99a3e })); low.position.y = -0.15; m.add(low);
    m.position.set(x, (from && from.y || 0) + 1.6, z);
    this.scene.add(m);
    this.fx.burgers.push({ m, target, t: 0, idx: from ? from.idx : this.nearest(x, z).i, remote });
    Sound.whoosh();
  },
  // A car hit by oil or a burger: it spins, slows and drops coins.
  spinOut(c, why) {
    if (c.shieldT > 0) { if (c.isMe) Sound.ding(); return; }
    c.spin += (Math.random() < 0.5 ? -1 : 1) * 7; c.v *= 0.35; c.slipT = 1.2;
    this.loseCoins(c, why === 'burger' ? 3 : 2);
    if (c.isMe) { this.shake = 0.7; Sound.bump(); this.say(pick(why === 'burger' ? RACE_LINES.burgerHit : RACE_LINES.oilHit), 'driver'); if (why === 'burger') this.splatT = 2.2; }
  },
  loseCoins(c, n) {
    const k = Math.min(c.coins, n);
    c.coins -= k;
    for (let i = 0; i < k; i++) {
      const m = new THREE.Mesh(this.coinGeo, this.coinMats);
      m.position.set(c.x, (c.y || 0) + 1.2, c.z);
      this.scene.add(m);
      this.fx.drops.push({ m, vx: (Math.random() - 0.5) * 8, vy: 6 + Math.random() * 3, vz: (Math.random() - 0.5) * 8, t: 0, y0: c.y || 0 });
    }
  },
  updateFx(dt) {
    // Oil: anyone who drives over it (after a moment, so you don't slip on your own) spins.
    for (const o of this.fx.oil) {
      o.t += dt; o.grace -= dt;
      if (o.t > 30) { o.dead = true; continue; }
      for (const c of this.cars) {
        if ((o.grace > 0 && c === o.owner) || Math.hypot(c.x - o.x, c.z - o.z) > 2.2) continue;
        this.spinOut(c, 'oil'); o.dead = true; break;
      }
    }
    this.fx.oil = this.fx.oil.filter(o => { if (o.dead) { this.scene.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); } return !o.dead; });
    // Burgers chase their target along the road.
    for (const b of this.fx.burgers) {
      b.t += dt;
      const T = b.target, m = b.m;
      let tx, tz, ty;
      if (T) { tx = T.x; tz = T.z; ty = (T.y || 0) + 1.4; }
      else { b.idx = (b.idx + this.ahead(50 * dt)) % this.samples.length; const s = this.samples[b.idx]; tx = s.x; tz = s.z; ty = s.y + 1.6; }
      const dx = tx - m.position.x, dz = tz - m.position.z, d = Math.hypot(dx, dz), step = 55 * dt;
      if (d < 2.4 && T) { b.dead = true; if (!T.ghost) this.spinOut(T, 'burger'); this.star(T.x, T.z, '🍔 SPLAT!'); continue; }
      m.position.x += dx / (d || 1) * Math.min(step, d); m.position.z += dz / (d || 1) * Math.min(step, d);
      m.position.y += (ty - m.position.y) * Math.min(1, dt * 4);
      m.rotation.y += dt * 9; m.rotation.x = Math.sin(b.t * 7) * 0.4;
      if (b.t > 7) b.dead = true;
    }
    this.fx.burgers = this.fx.burgers.filter(b => { if (b.dead) this.scene.remove(b.m); return !b.dead; });
    for (const d of this.fx.drops) {
      d.t += dt; d.vy -= 18 * dt;
      d.m.position.x += d.vx * dt; d.m.position.z += d.vz * dt; d.m.position.y = Math.max(d.y0 + 0.1, d.m.position.y + d.vy * dt);
      d.m.rotation.x += dt * 12; d.m.rotation.z += dt * 7;
      if (d.t > 1.4) d.dead = true;
    }
    this.fx.drops = this.fx.drops.filter(d => { if (d.dead) this.scene.remove(d.m); return !d.dead; });
  },
  // Online: what this player just did (an oil drop, a megaphone, a burger), for the others.
  ev(e) {
    const c = this.me;
    this.events = (this.events || []).filter(x => performance.now() - x.at < 4000);
    const out = { id: Math.floor(Math.random() * 1e9), k: e.k, x: Math.round(c.x * 10) / 10, z: Math.round(c.z * 10) / 10, a: Math.round(c.a * 100) / 100, at: performance.now() };
    if (e.k === 'burger') { const st = this.standings(), t = st[st.indexOf(c) - 1]; out.w = t && t.who ? t.who : ''; }
    this.events.push(out);
  },
  remoteEvents() {
    if (!this.net) return;
    this.seenEv = this.seenEv || new Set();
    for (const p of Multi.peers) {
      if (!p.race || p.race.id !== this.net.id || !Array.isArray(p.race.ev)) continue;
      const r = this.remoteCars.get(p.peer);
      for (const e of p.race.ev) {
        const key = p.peer + ':' + e.id;
        if (this.seenEv.has(key)) continue;
        this.seenEv.add(key);
        if (e.k === 'oil') this.dropOil(e.x - Math.cos(e.a) * 4, e.z - Math.sin(e.a) * 4, r || null, true);
        else if (e.k === 'mega') this.megaphone(e.x, e.z, r || null);
        else if (e.k === 'burger') this.throwBurger(e.x, e.z, r || null, e.w === (Multi.as || 'me') ? this.me : this.remoteCars.get(([...Multi.peers].find(q => q.who === e.w) || {}).peer) || null, true);
      }
    }
  },

  // ---------- entering and leaving ----------
  // From the club or the menu: pick a map and a track, then a car, then race the bots or friends.
  open(join = null) {
    if (this.active || G.alert || Boss.active || Story.ctl || Mini.active) { UI.toast('לא עכשיו', 'bad'); return; }
    this.active = true;
    this.net = join;
    this.loadModels();
    $('#hud').classList.add('hidden');
    $('#overlay').classList.add('hidden');
    // On the phone: the run button brakes and E is the commander's shout (or the power-up).
    $('#t-run').textContent = 'בלם';
    G.touchRun = false; $('#t-run').classList.remove('on');
    $('#t-act').textContent = '🗣️';
    $('#look').classList.add('hidden');
    Sound.music('boss');
    this.ui();
    if (join) { this.mapId = join.map || 'negev'; this.lv = join.lv || 0; this.loading(() => this.pickScreen()); }
    else this.mapScreen();
  },
  exit() {
    if (!this.active) return;
    Sound.engine(null);
    this.clearCars();
    if (this.fx) {
      for (const d of [...this.fx.dust, ...this.fx.stars, ...this.fx.confetti, ...this.fx.oil, ...this.fx.burgers, ...this.fx.drops]) this.scene.remove(d.m);
      this.fx = { dust: [], stars: [], confetti: [], oil: [], burgers: [], drops: [] };
    }
    for (const r of this.remoteCars.values()) this.scene.remove(r.obj.root);
    this.remoteCars.clear();
    this.me = null; this.net = null; this.events = [];
    this.active = false; this.phase = null;
    const u = $('#race'); if (u) u.remove();
    $('#hud').classList.remove('hidden');
    $('#overlay').classList.remove('hidden');
    $('#t-run').textContent = 'ריצה';
    G.touchRun = false; $('#t-run').classList.remove('on');
    $('#t-act').textContent = 'E';
    $('#look').classList.remove('hidden');
    UI.fade(() => {});
  },
  // The car models, the jerrycan and the pine load the first time someone races.
  loadModels() {
    if (this.modelsLoading) return this.modelsLoading;
    const loader = new THREE.GLTFLoader();
    const names = [...new Set(RACE_CARS.map(c => 'car_' + c.model)), 'race_fuel', 'race_pine'];
    const models = names.map(n => new Promise(ok => {
      if (Assets.models[n]) return ok();
      loader.load(`assets/models/${n}.json`, (g) => {
        g.scene.traverse(o => { if (o.isMesh) { o.material.metalness = 0.1; o.material.roughness = n === 'race_pine' ? 0.95 : 0.6; } });
        Assets.models[n] = g.scene;
        ok();
      }, undefined, () => ok());
    }));
    // The repainted cars' pictures for the pick screen: the base car's picture, recoloured.
    this.thumbs = this.thumbs || {};
    const thumbs = RACE_CARS.filter(c => c.paint).map(c => new Promise(ok => {
      const img = new Image();
      img.onload = () => { try { this.thumbs[c.id] = this.recolor(img, c.paint, true).toDataURL('image/png'); } catch (e) { /* keep the base picture */ } ok(); };
      img.onerror = () => ok();
      img.src = `assets/race/car_${c.model}.webp`;
    }));
    this.modelsLoading = Promise.all([...models, ...thumbs]);
    return this.modelsLoading;
  },
  // A picture (or a model's texture) repainted: the hue turned, the colour washed out or
  // tinted, pixel by pixel. thumb: the pick screen's picture, whose white background (what's
  // white and reaches the edge) stays white, and which gets the car's sticker in the corner.
  recolor(img, paint, thumb = false) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
    const t = new THREE.Color(paint.tint == null ? 0xffffff : paint.tint);
    // The CSS hue-rotate matrix, then saturation, then the tint.
    const a = (paint.hue || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), s = paint.sat == null ? 1 : paint.sat;
    const M = [0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
      0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
      0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072];
    const w = c.width, h = c.height, bg = thumb ? new Uint8Array(w * h) : null;
    if (thumb) {
      const white = (k) => px[k * 4] > 251 && px[k * 4 + 1] > 251 && px[k * 4 + 2] > 251;
      const stack = [];
      for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
      while (stack.length) {
        const k = stack.pop();
        if (bg[k] || !white(k)) continue;
        bg[k] = 1;
        const x = k % w;
        if (x > 0) stack.push(k - 1);
        if (x < w - 1) stack.push(k + 1);
        if (k >= w) stack.push(k - w);
        if (k < w * (h - 1)) stack.push(k + w);
      }
    }
    for (let i = 0; i < px.length; i += 4) {
      if (bg && bg[i >> 2]) continue;
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      let R = M[0] * r + M[1] * gg + M[2] * b, G1 = M[3] * r + M[4] * gg + M[5] * b, B = M[6] * r + M[7] * gg + M[8] * b;
      const l = 0.213 * R + 0.715 * G1 + 0.072 * B;
      R = (l + (R - l) * s) * t.r; G1 = (l + (G1 - l) * s) * t.g; B = (l + (B - l) * s) * t.b;
      px[i] = R < 0 ? 0 : R > 255 ? 255 : R; px[i + 1] = G1 < 0 ? 0 : G1 > 255 ? 255 : G1; px[i + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
    }
    g.putImageData(d, 0, 0);
    if (thumb && paint.badge) this.sticker(g, w, h, paint.badge);
    return c;
  },
  // The sticker on a repainted car's picture: a tilted label with a strip of checkers.
  sticker(g, w, h, [text, bgc, fg]) {
    const k = w / 400, fs = Math.round(30 * k);
    g.save();
    g.font = `900 ${fs}px Rubik, Arial, sans-serif`;
    const tw = g.measureText(text).width, bw = tw + fs * 1.5, bh = fs * 1.35;
    g.translate(w * 0.05 + bw / 2, h * 0.1 + bh / 2);
    g.rotate(-0.12);
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6 * k; g.shadowOffsetY = 2 * k;
    g.fillStyle = bgc;
    g.beginPath(); g.moveTo(-bw / 2 + 6 * k, -bh / 2); g.arcTo(bw / 2, -bh / 2, bw / 2, bh / 2, 6 * k); g.arcTo(bw / 2, bh / 2, -bw / 2, bh / 2, 6 * k); g.arcTo(-bw / 2, bh / 2, -bw / 2, -bh / 2, 6 * k); g.arcTo(-bw / 2, -bh / 2, bw / 2, -bh / 2, 6 * k); g.fill();
    g.shadowColor = 'transparent';
    // Checkers down the sticker's left end.
    const sq = bh / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? fg : bgc; g.fillRect(-bw / 2 + 4 * k + j * sq, -bh / 2 + i * sq, sq, sq); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, sq, fs * 0.05);
    g.restore();
  },
  // A repainted car: its model's texture recoloured once (cached), then racing stripes laid over
  // the body: a second copy of the body whose texture is projected from above, so the stripes
  // run down the bonnet, the roof and the boot whatever the model's own mapping.
  paintCar(m, type) {
    const P = type.paint;
    this.paints = this.paints || {};
    // The meshes first: the stripes added below are meshes too, and must not be painted again.
    const meshes = [];
    m.traverse(o => { if (o.isMesh) meshes.push(o); });
    meshes.forEach(o => {
      const src = o.material;
      let cached = this.paints[type.id];
      if (!cached) {
        cached = this.paints[type.id] = {};
        if (src.map && src.map.image && (P.hue != null || P.sat != null)) {
          try {
            const tex = new THREE.CanvasTexture(this.recolor(src.map.image, P));
            tex.flipY = src.map.flipY; tex.encoding = src.map.encoding; tex.wrapS = src.map.wrapS; tex.wrapT = src.map.wrapT;
            cached.map = tex;
          } catch (e) { /* a plain tint then */ }
        }
        if (P.stripes) {
          const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
          const g = cv.getContext('2d');
          g.fillStyle = P.stripes;
          g.fillRect(30, 103, 452, 20); g.fillRect(30, 133, 452, 20);
          g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(30, 123, 452, 10);
          cached.stripes = new THREE.CanvasTexture(cv);
          cached.stripes.flipY = false;
        }
      }
      o.material = src.clone();
      // The recoloured texture carries the tint already; a plain tint is just the material's colour.
      if (cached.map) o.material.map = cached.map;
      else if (P.tint != null) o.material.color = new THREE.Color(P.tint).convertSRGBToLinear();
      if (!cached.stripes) return;
      cached.geos = cached.geos || new Map();
      let geo = cached.geos.get(o.geometry);
      if (!geo) {
        geo = o.geometry.clone();
        geo.computeBoundingBox();
        const bb = geo.boundingBox, pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
        // The model faces +z before rotY: length along z, width along x.
        for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z || 1); uv[i * 2 + 1] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1); }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        cached.geos.set(o.geometry, geo);
      }
      // The models come without normals (flat shaded); the stripes have to be lit the same way.
      const deco = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: cached.stripes, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.4, metalness: 0.2, flatShading: !geo.attributes.normal }));
      deco.scale.setScalar(1.004);
      o.add(deco);
    });
  },

  // ---------- ranks and the garage ----------
  myRank() { return String(typeof playerRank === 'function' ? playerRank() : (G.state && G.state.rank) || 'rabat'); },
  rankIdx(r) { const i = RACE_RANKS.indexOf(String(r)); return i < 0 ? 0 : i; },
  unlocked(type) { return this.rankIdx(this.myRank()) >= this.rankIdx(type.unlock); },
  myTier() { return RACE_TIERS.filter(t => this.rankIdx(this.myRank()) >= this.rankIdx(t.unlock)).length - 1; },
  bestCar() { const open = RACE_CARS.filter(t => this.unlocked(t)); return open[open.length - 1] || RACE_CARS[0]; },
  // What opened since the last visit to the garage (a promotion in between), remembered in the
  // save. Everything ever opened stays seen, so playing as an officer and back doesn't repeat it;
  // the first visit counts only the starters as seen, so a sergeant hears about their new cars.
  newlyUnlocked() {
    const have = RACE_CARS.filter(t => this.unlocked(t)).map(t => t.id);
    const seen = Array.isArray(G.state.raceSeen) ? G.state.raceSeen : RACE_CARS.filter(t => t.tier === 0).map(t => t.id);
    const fresh = have.filter(id => !seen.includes(id));
    G.state.raceSeen = [...new Set([...seen, ...have])];
    return fresh;
  },
  // Three rivals' cars: mostly your own tier, some from the one below, and now and then one
  // from the tier above, to chase. Different cars where there are enough, never three alike.
  botCars(n) {
    const tier = this.myTier(), count = {}, out = [];
    const use = (c) => { count[c.id] = (count[c.id] || 0) + 1; return c; };
    if (this.myType) use(this.myType);
    for (let i = 0; i < n; i++) {
      const r = Math.random(), want = r < 0.15 ? tier + 1 : r < 0.72 ? tier : tier - 1;
      const t = Math.max(0, Math.min(RACE_TIERS.length - 1, want));
      const all = RACE_CARS.filter(c => c.tier === t), free = all.filter(c => !count[c.id]), twice = all.filter(c => (count[c.id] || 0) < 2);
      out.push(use(pick(free.length ? free : twice.length ? twice : all)));
    }
    return out;
  },
  // A toast inside the race's own layer (the game's toasts live in the HUD, hidden here).
  toast(text, kind = '') {
    const u = $('#race');
    if (!u) return;
    u.querySelectorAll('.rc-toast').forEach(x => x.remove());
    const t = document.createElement('div');
    t.className = `rc-toast ${kind}`;
    t.innerHTML = fmt(text);
    u.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  },
  // Building a map takes a moment: a panel, then the world, then what comes next.
  loading(then) {
    const map = RACE_MAPS.find(m => m.id === this.mapId);
    this.panel(`<h2>${map.emoji} ${map.name}</h2><p class="rc-sub">${RACE_LEVELS[this.lv].stars} ${RACE_LEVELS[this.lv].name} · בונים את המסלול...</p><div class="rc-spin"></div>`);
    this.loadModels().then(() => setTimeout(() => { if (!this.active) return; this.useWorld(this.mapId, this.lv); then(); }, 30));
  },
  makeCar(type) {
    const root = new THREE.Group(), tilt = new THREE.Group();
    root.rotation.order = 'YXZ';
    root.add(tilt);
    const m = Assets.model('car_' + type.model, { length: type.len, rotY: type.rotY });
    if (m) { if (type.paint) this.paintCar(m, type); tilt.add(m); }
    else {
      // Until the model is in: a box car.
      const body = new THREE.Mesh(new THREE.BoxGeometry(type.len, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x6b7a3a }));
      body.position.y = 0.9; body.castShadow = true; tilt.add(body);
    }
    this.shadowTex = this.shadowTex || this.softTex('rgba(0,0,0,0.55)');
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(type.len * 1.25, 2.9), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.05; root.add(shadow);
    // The seat-belt shield: a bubble around the car while it lasts.
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(type.len * 0.62, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6ad0ff, transparent: true, opacity: 0.22, depthWrite: false }));
    bubble.position.y = 1; bubble.scale.y = 0.7; bubble.visible = false; root.add(bubble);
    this.scene.add(root);
    return { root, tilt, bubble };
  },

  // ---------- UI ----------
  ui() {
    let u = $('#race');
    if (u) u.remove();
    u = document.createElement('div');
    u.id = 'race';
    u.innerHTML = `<div class="rc-hud hidden"><div class="rc-pos"></div><div class="rc-lap"></div><div class="rc-time"></div><div class="rc-spd"></div>
      <div class="rc-coins"></div><canvas class="rc-mini" width="150" height="150"></canvas>
      <button class="rc-boost"><span class="rc-item"></span><span class="rc-lbl">🗣️ צעקה</span><i><b></b></i></button><div class="rc-say hidden"></div><div class="rc-splat hidden"></div></div>
      <div class="rc-cd hidden"></div><div class="rc-panel hidden"></div>
      <button class="rc-x" title="יציאה" aria-label="יציאה מהמירוץ">✕</button>`;
    document.body.appendChild(u);
    u.querySelector('.rc-x').addEventListener('click', () => this.exit());
    u.querySelector('.rc-boost').addEventListener('pointerdown', (e) => { e.preventDefault(); this.boost(); });
  },
  panel(html) {
    const p = $('#race .rc-panel');
    p.innerHTML = html ? fmt(html) : '';
    p.classList.toggle('hidden', !html);
    return p;
  },
  // Step one: where to race, and how hard.
  mapScreen() {
    this.phase = 'map';
    $('#race .rc-hud').classList.add('hidden');
    const best = (G.state.raceBest = G.state.raceBest || {});
    const p = this.panel(`<img class="rc-banner" src="assets/race/intro.jpg" alt=""><h2>🏁 תחרות מפקדי נסיעה</h2>
      <p class="rc-sub">[בחר/בחרי] מפה ורמה. ככל שהרמה קשה יותר — יותר פניות, כביש צר יותר, ומפקדים מהירים יותר.</p>
      <div class="rc-maps">${RACE_MAPS.map(m => `<div class="rc-map"><img src="assets/race/map_${m.id}.jpg" alt=""><div class="rc-mi"><b>${m.emoji} ${m.name}</b><i>${m.desc}</i>
        <div class="rc-lvls">${RACE_LEVELS.map((l, i) => `<button class="rc-lv lv${i}" data-m="${m.id}" data-l="${i}">${l.stars} ${l.name}${best[m.id + i] ? ` <small>🏆${best[m.id + i].toFixed(1)}</small>` : ''}</button>`).join('')}</div></div></div>`).join('')}</div>`);
    p.querySelectorAll('.rc-lv').forEach(b => b.addEventListener('click', () => { Sound.click(); this.mapId = b.dataset.m; this.lv = +b.dataset.l; this.loading(() => this.pickScreen()); }));
  },
  pickScreen() {
    this.phase = 'pick';
    const map = RACE_MAPS.find(m => m.id === this.mapId);
    // The garage: a column per rank, the locked ones greyed out; what a promotion just opened glows.
    const rank = this.myRank(), fresh = this.newlyUnlocked(), thumbs = this.thumbs || {};
    const bar = (v) => `${Math.round(Math.max(4, Math.min(100, v * 100)))}%`;
    const car = (c) => {
      const open = this.unlocked(c), isNew = fresh.includes(c.id);
      return `<button class="rc-car ${open ? '' : 'locked'} ${isNew ? 'new' : ''}" data-id="${c.id}" ${open ? '' : 'aria-disabled="true"'}>
        ${isNew ? '<em class="rc-new">חדש!</em>' : ''}<img src="${thumbs[c.id] || `assets/race/car_${c.model}.webp`}" alt=""><b>${open ? '' : '🔒 '}${c.name}</b><i>${open ? c.desc : `נפתח בדרגת ${RANKS[c.unlock]}`}</i>
        <span class="rc-stat">מהירות<s style="--v:${bar((c.top - 24) / 21)}"></s></span><span class="rc-stat">תאוצה<s style="--v:${bar((c.acc - 8) / 13)}"></s></span><span class="rc-stat">משקל<s style="--v:${bar(c.mass / 1.9)}"></s></span></button>`;
    };
    const tiers = RACE_TIERS.map(t => { const open = this.rankIdx(rank) >= this.rankIdx(t.unlock); return `<div class="rc-tier ${open ? '' : 'locked'}"><div class="rc-th">${open ? '' : '🔒 '}${rankIcon(t.unlock)} <b>${t.name}</b><i>${open ? t.desc : `מדרגת ${RANKS[t.unlock]}`}</i></div>${RACE_CARS.filter(c => c.tier === t.tier).map(car).join('')}</div>`; }).join('');
    const p = this.panel(`<h2>${map.emoji} ${map.name} · ${RACE_LEVELS[this.lv].stars} ${RACE_LEVELS[this.lv].name}</h2>
      <p class="rc-sub">את[ה/] מפקד[/ת] הנסיעה: את[ה/] נותנ[/ת] פקודות (חצים / ג'ויסטיק), הנהג מבצע. 3 סיבובים. 🪙 מטבעות = מהירות · ⛽ ג'ריקן = הפתעה (E / 🗣️ להשתמש). מותר להתנגש 😈</p>
      <p class="rc-rank">${rankIcon(rank)} <span>הדרגה שלך: <b>${RANKS[rank] || rank}</b></span> · <span>${this.myTier() < RACE_TIERS.length - 1 ? `הרכבים הבאים נפתחים בדרגת ${RANKS[RACE_TIERS[this.myTier() + 1].unlock]}` : 'כל המוסך פתוח 🔑'}</span>${this.net ? '' : ' · <span>המפקדים מהפלגה נוהגים ברכבים מהרמה שלך (ולפעמים מעליה 😈)</span>'}</p>
      <div class="rc-tiers">${tiers}</div>
      ${this.net ? '' : '<div class="rc-row"><button class="btn ghost small" data-m="maps">↩ מפה אחרת</button></div>'}`);
    p.querySelectorAll('.rc-car').forEach(b => b.addEventListener('click', () => this.chose(RACE_CARS.find(c => c.id === b.dataset.id))));
    const back = p.querySelector('[data-m=maps]');
    if (back) back.addEventListener('click', () => this.mapScreen());
    if (fresh.length) {
      Sound.fanfare();
      this.toast(`🔓 ${fresh.length > 1 ? 'רכבים חדשים במוסך' : 'רכב חדש במוסך'}: ${fresh.map(id => RACE_CARS.find(c => c.id === id).name).join(', ')}!`, 'ach');
      const first = p.querySelector('.rc-car.new'); if (first) setTimeout(() => first.scrollIntoView({ block: 'nearest' }), 50);
    }
    // Behind the panel: the camera circles the start line, the best car you have on it.
    this.clearCars();
    this.me = this.addCar(this.bestCar(), { isMe: true });
    this.place(this.me, 0);
  },
  async chose(type) {
    if (!type) return;
    if (!this.unlocked(type)) { Sound.bad(); this.toast(`🔒 ${type.name} — נפתח בדרגת ${RANKS[type.unlock]}`, 'bad'); return; }
    this.myType = type;
    Sound.pickup();
    if (this.net) { this.lobby(); return; }
    const online = Multi.on && Multi.peers.length;
    if (!online) { this.startSolo(); return; }
    const p = this.panel(`<h2>${type.name} ✔</h2><p class="rc-sub">עם מי מתחרים?</p>
      <div class="rc-row"><button class="btn" data-m="friends">👥 להזמין את כל מי שמחובר (${Multi.peers.length})</button><button class="btn ghost" data-m="bots">🤖 נגד מפקדים מהפלגה</button></div>`);
    p.querySelector('[data-m=friends]').addEventListener('click', () => { this.net = { id: Date.now(), host: true, startAt: performance.now() + 20000, map: this.mapId, lv: this.lv }; this.lobby(); });
    p.querySelector('[data-m=bots]').addEventListener('click', () => this.startSolo());
  },

  // ---------- grid ----------
  addCar(type, opts) {
    const obj = this.makeCar(type);
    const c = { type, obj, x: 0, z: 0, y: 0, a: 0, v: 0, ix: 0, iz: 0, spin: 0, steer: 0, thr: 0, idx: 0, lap: 0, half: false, fin: 0, bumpT: 0, boost: 0, boostT: 0, dustT: 0, coins: 0, item: null, rolling: 0, shieldT: 0, slipT: 0, railT: 0, ...opts };
    if (c.label) { c.tag = Scene3D.label(c.label, { bg: c.isMe ? 'rgba(242,193,46,.95)' : 'rgba(20,26,16,.82)', fg: c.isMe ? '#1b1b1b' : '#f4f1e6', size: 0.9 }); c.tag.position.y = 3.4; obj.root.add(c.tag); }
    this.cars.push(c);
    return c;
  },
  gridSpot(slot) {
    const N = this.samples.length;
    const s = this.samples[(N - this.ahead(8) - Math.floor(slot / 2) * this.ahead(13)) % N];
    const side = slot % 2 ? 1 : -1, off = Math.min(3.4, this.half * 0.5);
    return { x: s.x - Math.sin(s.a) * side * off, z: s.z + Math.cos(s.a) * side * off, a: s.a, idx: this.samples.indexOf(s) };
  },
  place(c, slot) {
    const g = this.gridSpot(slot);
    Object.assign(c, { x: g.x, z: g.z, a: g.a, idx: g.idx, v: 0, lap: 0, half: false, crossed: false, prev: g.idx, y: this.W.roadY(g.idx, g.x, g.z) });
  },
  myLabel() { return `🗣️ ${fmt('{name}')}`; },
  // A car you may drive: the one picked, unless the rank no longer allows it (playing as someone else).
  myCar() { if (!this.myType || !this.unlocked(this.myType)) this.myType = this.bestCar(); return this.myType; },
  startSolo() {
    this.net = null;
    this.myCar();
    this.clearCars();
    this.me = this.addCar(this.myType, { isMe: true, who: Multi.as || 'me', label: this.myLabel(), driver: pick(['driver1', 'driver2']) });
    // Three commanders from the cast, in cars of your tier (one may have sneaked a better one);
    // faster on the harder tracks.
    const cast = ROSTER.people.filter(p => p.map === 'netivot' && p.id.startsWith('p_'));
    const names = cast.length ? cast.sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.short) : ['בוט 1', 'בוט 2', 'בוט 3'];
    const cars = this.botCars(names.length);
    const [s0, s1] = RACE_LEVELS[this.lv].skill;
    names.forEach((n, i) => this.addCar(cars[i], { bot: true, label: `🗣️ ${n}`, skill: s0 + Math.random() * (s1 - s0), lane: (Math.random() - 0.5) * this.half * 0.8 }));
    // The rivals in front, you at the back of the grid: everyone to overtake.
    [...this.cars.filter(c => c.bot), this.me].forEach((c, i) => this.place(c, i));
    this.countdown(performance.now() + 3600);
  },
  clearCars() { for (const c of this.cars) this.scene.remove(c.obj.root); this.cars = []; },

  // Online: wait at the start line for whoever joins, then everyone starts together.
  lobby() {
    this.phase = 'lobby';
    this.myCar();
    this.clearCars();
    this.me = this.addCar(this.myType, { isMe: true, who: Multi.as || 'me', label: this.myLabel(), driver: pick(['driver1', 'driver2']) });
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
    const map = RACE_MAPS.find(m => m.id === this.mapId);
    if (w) w.textContent = `${map.emoji} ${map.name} · ${RACE_LEVELS[this.lv].name} — המירוץ מתחיל בעוד ${Math.ceil(left)} שניות`;
    const peers = Multi.peers.filter(p => p.race && p.race.id === this.net.id);
    if (who) who.innerHTML = [`<span>🗣️ ${esc(G.profile.name)} · ${this.myType.name}</span>`, ...peers.map(p => `<span><bdi data-raw>${esc(p.name)}</bdi> · ${(RACE_CARS.find(t => t.id === p.race.car) || RACE_CARS[0]).name}</span>`)].join('');
    // A guest follows the host's clock.
    if (!this.net.host) {
      const h = Multi.peers.find(p => p.race && p.race.id === this.net.id && p.race.host);
      if (h && h.race.cd > 0) this.net.startAt = performance.now() + h.race.cd * 1000;
    }
    this.place(this.me, this.racers().indexOf(Multi.as || 'me'));
    if (left <= 3.5) {
      if (!peers.length) { this.toast('אף אחד לא הצטרף — מתחרים נגד מפקדים מהפלגה', 'bad'); this.startSolo(); return; }
      this.countdown(this.net.startAt);
    }
  },
  presence() {
    if (!this.active || !this.net || !this.me || !this.myType) return null;
    const c = this.me;
    const ev = (this.events || []).filter(e => performance.now() - e.at < 4000).slice(-4).map(({ at, ...e }) => e);
    return { id: this.net.id, host: !!this.net.host, map: this.mapId, lv: this.lv, car: this.myCar().id, x: Math.round(c.x * 10) / 10, z: Math.round(c.z * 10) / 10, a: Math.round(c.a * 100) / 100, v: Math.round(c.v), lap: c.lap, pr: Math.round(this.progress(c)), fin: c.fin ? Math.round(c.fin * 100) / 100 : 0, sh: c.shieldT > 0 ? 1 : 0, ev, cd: this.net.host && this.phase === 'lobby' ? Math.round((this.net.startAt - performance.now()) / 100) / 10 : 0 };
  },
  // In the world: a friend's race invite pops up once.
  watch() {
    if (this.active || !Multi.on) return;
    const p = Multi.peers.find(q => q.race && q.race.host && q.race.cd > 3 && !this.seenInvites.has(q.race.id));
    if (!p) return;
    this.seenInvites.add(p.race.id);
    Sound.horn();
    const map = RACE_MAPS.find(m => m.id === p.race.map) || RACE_MAPS[0];
    UI.invite(`🏎️ הזמנה מ${p.name}: תחרות מפקדי נסיעה ב${map.name}! מתחילים בעוד ${Math.round(p.race.cd)} שניות`, '🏁 להצטרף', () => {
      const q = Multi.peers.find(r => r.race && r.race.id === p.race.id);
      if (!q || q.race.cd < 2) { UI.toast('המירוץ כבר התחיל', 'bad'); return; }
      this.open({ id: q.race.id, host: false, startAt: performance.now() + q.race.cd * 1000, map: q.race.map, lv: q.race.lv || 0 });
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
  // E / the button: the power-up if you have one, otherwise the commander's shout.
  boost() {
    const c = this.me;
    if (!c || this.phase !== 'race' || c.fin) return;
    if (c.rolling > 0) return;
    if (this.useItem(c)) return;
    if (c.boost < 1) { Sound.bad(); return; }
    c.boost = 0; c.boostT = 1.4;
    Sound.boost();
    this.say(pick(RACE_LINES.boost), 'me');
  },
  drive(c, dt, inp) {
    const T = c.type, W = this.W;
    // Spinning on oil: no steering for a moment.
    if (c.slipT > 0) { c.slipT -= dt; inp = { steer: 0, thr: 0 }; }
    c.steer += (inp.steer - c.steer) * Math.min(1, dt * 8);
    c.thr = inp.thr;
    const near = this.nearest(c.x, c.z, c.idx);
    c.idx = near.i;
    c.off = near.d > this.half + 0.5;
    // Every coin is a little more top speed (ten at most).
    let top = T.top * (c.skill || 1) * (1 + c.coins * 0.012) * (c.off ? 0.55 : 1) * (c.boostT > 0 ? (c.turbo ? 1.4 : 1.3) : 1);
    if (c.thr > 0) c.v += c.thr * T.acc * (c.boostT > 0 ? 1.6 : 1) * Math.max(0, 1 - c.v / top) * dt;
    else if (c.thr < 0) c.v = Math.max(-8, c.v - (c.v > 0 ? 24 : 7) * dt);
    else c.v -= c.v * 0.6 * dt;
    if (c.v > top) c.v -= (c.v - top) * 2.2 * dt;
    // Uphill slows, downhill speeds up a little.
    const s0 = this.samples[c.idx], s1 = this.samples[(c.idx + 2) % this.samples.length];
    const grade = (s1.y - s0.y) / Math.max(0.5, Math.hypot(s1.x - s0.x, s1.z - s0.z));
    c.v -= grade * 9.8 * 0.35 * dt * Math.sign(Math.cos(c.a - s0.a));
    // Steering: faster turns at speed, but less of them near top speed; the heavy ones lean.
    const sp = Math.min(1, Math.abs(c.v) / 10);
    c.a += c.steer * 1.85 * T.grip * sp * (1 - 0.3 * Math.min(1, c.v / T.top)) * Math.sign(c.v || 1) * dt + c.spin * dt;
    c.spin *= Math.exp(-4 * dt);
    c.x += Math.cos(c.a) * c.v * dt + c.ix * dt;
    c.z += Math.sin(c.a) * c.v * dt + c.iz * dt;
    const k = Math.exp(-3.2 * dt);
    c.ix *= k; c.iz *= k;
    // The edge: guard rails on the mountain roads (they bounce you back), soft desert far off.
    const n2 = this.nearest(c.x, c.z, c.idx);
    if (n2.d > W.wall) {
      const s = this.samples[n2.i], dx = c.x - s.x, dz = c.z - s.z, d = Math.hypot(dx, dz);
      c.x = s.x + dx / d * W.wall; c.z = s.z + dz / d * W.wall;
      if (W.rails) {
        // Glance off the rail: lose speed, turn back along the road.
        let da = s.a - c.a; da = Math.atan2(Math.sin(da), Math.cos(da));
        c.a += da * 0.35; c.v *= 0.82; c.ix -= dx / d * 3; c.iz -= dz / d * 3;
        if (c.isMe && c.railT <= 0) { c.railT = 0.8; Sound.bump(); this.shake = 0.35; for (let i = 0; i < 5; i++) this.puff(c.x, c.z, 0xffd27a, 0.4, (c.y || 0) + 0.8); if (Math.random() < 0.35) this.say(pick(RACE_LINES.rail), 'driver'); }
      } else c.v *= 0.7;
    }
    c.railT = Math.max(0, c.railT - dt);
    // Height: on the road its own grade, off it the hills.
    const n3 = this.nearest(c.x, c.z, c.idx);
    c.y = n3.d < this.half + 1 ? W.roadY(n3.i, c.x, c.z) : W.ground(c.x, c.z);
    const fx = Math.cos(c.a) * 1.6, fz = Math.sin(c.a) * 1.6;
    c.pitch = Math.atan2(W.ground(c.x + fx, c.z + fz) - W.ground(c.x - fx, c.z - fz), 3.2);
    c.boostT = Math.max(0, c.boostT - dt);
    if (c.boostT <= 0) c.turbo = false;
    c.shieldT = Math.max(0, c.shieldT - dt);
    c.boost = Math.min(1, c.boost + dt / 9);
    c.bumpT = Math.max(0, c.bumpT - dt);
    if (c.rolling > 0) { c.rolling -= dt; if (c.rolling <= 0) { c.item = c.next; c.next = null; if (c.isMe) Sound.ding(); } }
    if (c.bot && c.item && this.raceT > (c.useAt || 0)) this.useItem(c);
    this.laps(c);
  },
  // Bots aim a little down the road, at their own lane, and lift on the sharp bends.
  botInput(c) {
    const S = this.samples, N = S.length, s = S[(c.idx + this.ahead(16)) % N];
    const tx = s.x - Math.sin(s.a) * c.lane, tz = s.z + Math.cos(s.a) * c.lane;
    let d = Math.atan2(tz - c.z, tx - c.x) - c.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    // How sharp the bend ahead is (looking further the faster it goes), and how fast this car
    // can take it: the grippier, the faster. Too fast: off the gas until it fits.
    const look = this.ahead(36 + Math.max(0, c.v - 24) * 0.8);
    const ahead = S[(c.idx + look) % N].a - S[c.idx].a, sharp = Math.abs(Math.atan2(Math.sin(ahead), Math.cos(ahead)));
    const vc = (sharp > 0.9 ? 25 : sharp > 0.6 ? 31 : sharp > 0.4 ? 38 : 99) * c.type.grip;
    let thr = c.v > vc + 4 ? 0 : c.v > vc ? 0.3 : 1;
    // Keep the race close: the leaders ease off when far in front of the player.
    if (this.me && !this.me.fin && this.progress(c) - this.progress(this.me) > this.ahead(70)) thr = Math.min(thr, 0.4);
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
      // The seat belt makes a car a wall.
      const ma = A.type.mass * (A.shieldT > 0 || A.sh ? 4 : 1), mb = B.type.mass * (B.shieldT > 0 || B.sh ? 4 : 1), sum = ma + mb;
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
        // A hard knock shakes a coin loose (unless belted in).
        if (Math.abs(rel) > 6) { if (!A.ghost && !(A.shieldT > 0)) this.loseCoins(A, 1); if (!B.ghost && !(B.shieldT > 0)) this.loseCoins(B, 1); }
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
        r = { ghost: true, type, obj: this.makeCar(type), x: p.race.x, z: p.race.z, y: 0, a: p.race.a, v: 0, ix: 0, iz: 0, bumpT: 0, lap: 0, idx: 0, fin: 0, name: p.name, who: p.who };
        r.tag = Scene3D.label(`🗣️ ${p.name}`, { size: 0.9 }); r.tag.position.y = 3.4; r.obj.root.add(r.tag);
        this.remoteCars.set(p.peer, r);
      }
      r.tx = p.race.x; r.tz = p.race.z; r.ta = p.race.a; r.v = p.race.v; r.lap = p.race.lap; r.pr = p.race.pr; r.fin = p.race.fin; r.sh = p.race.sh;
      r.idx = this.nearest(r.tx, r.tz, r.idx).i;
      out.push(r);
    }
    return out;
  },

  // ---------- each frame ----------
  frame(dt, t) {
    Multi.update(dt);
    if (!this.W) return;
    if (this.phase === 'lobby') this.updateLobby();
    if (this.phase === 'countdown') this.updateCountdown();
    const racing = this.phase === 'race' || this.phase === 'done';
    if (racing) this.raceT += dt;
    for (const c of this.cars) {
      if (!racing) { c.v = 0; if (this.W) c.y = this.W.roadY(c.idx, c.x, c.z); continue; }
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
      r.y = this.W.ground(r.x, r.z);
    }
    if (racing) { this.collide(dt); this.remoteEvents(); }
    this.updatePickups(dt, t);
    this.updateFx(dt);
    this.overtakes();
    this.draw(dt, t);
    this.hud();
    if (this.me && this.phase !== 'map' && this.phase !== 'pick') Sound.engine(Math.min(1, Math.abs(this.me.v) / this.me.type.top));
    else Sound.engine(null);
    if (this.phase === 'done' && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  draw(dt, t) {
    const all = [...this.cars, ...this.remoteCars.values()];
    for (const c of all) {
      const { root, tilt, bubble } = c.obj;
      root.position.set(c.x, c.y || 0, c.z);
      root.rotation.y = -c.a;
      root.rotation.z = c.pitch || 0;
      // Lean into the turn, squat on the gas, rattle off the road, wobble after a bump.
      const sp = Math.min(1, Math.abs(c.v) / c.type.top);
      const bump = c.bumpT > 0 ? Math.sin(c.bumpT * 40) * c.bumpT : 0;
      tilt.rotation.x = (c.steer || 0) * 0.09 * sp + bump * 0.5;
      tilt.rotation.z = (c.thr > 0 ? 0.025 : c.thr < 0 ? -0.04 : 0) * sp + bump * 0.3;
      tilt.position.y = (c.off ? Math.abs(Math.sin(t / 45)) * 0.12 : Math.abs(Math.sin(t / 70)) * 0.03) * sp + Math.max(0, bump) * 0.6;
      bubble.visible = c.shieldT > 0 || !!c.sh;
      if (bubble.visible) bubble.material.opacity = 0.16 + Math.sin(t / 90) * 0.08;
      // Dust behind: thick off the road, a puff when drifting, flames on a boost.
      c.dustT = (c.dustT || 0) - dt;
      const drift = Math.abs(c.steer || 0) > 0.7 && c.v > 20;
      if ((c.off || drift || c.boostT > 0) && c.v > 6 && c.dustT <= 0) {
        c.dustT = 0.04;
        const ground = this.W.map.id === 'hatzor' || this.W.map.forest ? 0xc8b49a : 0xe6d2a6;
        this.puff(c.x - Math.cos(c.a) * c.type.len * 0.5, c.z - Math.sin(c.a) * c.type.len * 0.5, c.boostT > 0 ? (c.turbo ? 0x6ad0ff : 0xff9a3c) : ground, c.off ? 1.6 : 1, (c.y || 0) + 0.5);
        if (drift && c.isMe && Math.random() < 0.05) Sound.skid();
      }
    }
    // Dust and bump stars.
    for (const d of this.fx.dust) { d.t += dt; d.m.material.opacity = Math.max(0, 0.55 * (1 - d.t / 0.9)); d.m.scale.setScalar(d.s * (1 + d.t * 2.5)); d.m.position.y += dt * 0.6; }
    this.fx.dust = this.fx.dust.filter(d => { if (d.t < 0.9) return true; this.scene.remove(d.m); return false; });
    for (const s of this.fx.stars) {
      s.t += dt;
      if (s.ring) { s.m.scale.setScalar(1 + s.t * 40); s.m.material.opacity = Math.max(0, 0.8 * (1 - s.t / 0.6)); continue; }
      s.m.position.y = s.y0 + s.t * 3; s.m.material.opacity = Math.max(0, 1 - s.t / 0.8); const k = 1 + Math.min(s.t * 6, 0.6); s.base = s.base || s.m.scale.clone(); s.m.scale.set(s.base.x * k, s.base.y * k, 1);
    }
    this.fx.stars = this.fx.stars.filter(s => { if (s.t < 0.8) return true; this.scene.remove(s.m); return false; });
    for (const f of this.fx.confetti) { f.m.position.y -= f.vy * dt; f.m.rotation.x += f.spin * dt; f.m.rotation.y += f.spin * 0.7 * dt; }
    this.fx.confetti = this.fx.confetti.filter(f => { if (f.m.position.y > f.floor) return true; this.scene.remove(f.m); return false; });
    // The chase camera: behind and above, wider and shakier as it speeds up.
    const c = this.me, W = this.W;
    if (c) {
      const cam = this.camera, back = 9, up = 4.6;
      const w = this.renderSize();
      if (cam.aspect !== w) { cam.aspect = w; }
      const cy = c.y || 0;
      const want = new THREE.Vector3(c.x - Math.cos(c.a) * back, cy + up, c.z - Math.sin(c.a) * back);
      if (this.phase === 'map' || this.phase === 'pick' || this.phase === 'lobby') { const r = performance.now() / 4000; want.set(c.x + Math.cos(r) * 13, cy + 5, c.z + Math.sin(r) * 13); }
      // Never under the hill behind the car.
      want.y = Math.max(want.y, W.ground(want.x, want.z) + 1.8);
      cam.position.lerp(want, Math.min(1, dt * 5));
      this.shake = Math.max(0, (this.shake || 0) - dt * 1.5);
      if (this.shake && Settings.v.shake) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake));
      cam.lookAt(c.x + Math.cos(c.a) * 6, cy + 1.2, c.z + Math.sin(c.a) * 6);
      cam.fov = (w < 1 ? 74 : 62) + Math.min(1, Math.abs(c.v) / 35) * 12 + (c.boostT > 0 ? (c.turbo ? 10 : 6) : 0);
      cam.updateProjectionMatrix();
      const d = this.sun.userData.dir;
      this.sun.position.set(c.x + d.x * 120, cy + d.y * 120, c.z + d.z * 120);
      this.sun.target.position.set(c.x, cy, c.z);
      W.sky.position.copy(cam.position);
      for (const cl of W.clouds) { cl.position.x += dt * 3; }
    }
  },
  renderSize() { const s = Scene3D.renderer.getSize(new THREE.Vector2()); return s.x / Math.max(1, s.y); },
  render() { if (this.scene && this.camera) Scene3D.renderer.render(this.scene, this.camera); },
  puff(x, z, color, size, y = 0.5) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, color, transparent: true, depthWrite: false }));
    m.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8);
    this.scene.add(m);
    this.fx.dust.push({ m, t: 0, s: size });
    if (this.fx.dust.length > 140) { const d = this.fx.dust.shift(); this.scene.remove(d.m); }
  },
  star(x, z, text = '💥 BUMP!') {
    const m = Scene3D.label(text, { bg: 'rgba(255,214,0,.95)', fg: '#b3001b', size: 0.8 });
    m.material.transparent = true;
    const y0 = this.W ? this.W.ground(x, z) + 3.2 : 3.2;
    m.position.set(x, y0, z);
    this.scene.add(m);
    this.fx.stars.push({ m, t: 0, y0 });
    for (let i = 0; i < 6; i++) this.puff(x, z, 0xffffff, 1.2, y0 - 2.6);
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
    const coins = `🪙 <b>${c.coins}</b><small>/10</small>`;
    const ce = h.querySelector('.rc-coins');
    if (ce.innerHTML !== coins) { ce.innerHTML = coins; ce.classList.remove('pop'); void ce.offsetWidth; ce.classList.add('pop'); }
    ce.classList.toggle('full', c.coins >= 10);
    // The button: the power-up (or the roulette spinning), otherwise the shout.
    const b = h.querySelector('.rc-boost'), it = h.querySelector('.rc-item'), lbl = h.querySelector('.rc-lbl');
    const icon = c.rolling > 0 ? RACE_ITEMS[Math.floor(performance.now() / 80) % RACE_ITEMS.length].icon : c.item ? c.item.icon : '';
    if (it.textContent !== icon) it.textContent = icon;
    lbl.textContent = c.item ? c.item.name : c.rolling > 0 ? '...' : '🗣️ צעקה';
    b.classList.toggle('has-item', !!(c.item || c.rolling > 0));
    b.classList.toggle('ready', c.boost >= 1 || !!c.item);
    b.querySelector('b').style.width = `${Math.round(c.boost * 100)}%`;
    $('#t-act').textContent = c.item ? c.item.icon : '🗣️';
    const sp = h.querySelector('.rc-splat');
    this.splatT = Math.max(0, (this.splatT || 0) - 1 / 30);
    sp.classList.toggle('hidden', !(this.splatT > 0));
    // The mini map: the road and everyone on it.
    const cv = h.querySelector('.rc-mini'), g = cv.getContext('2d');
    const S = this.samples, B = this.W.bounds, k = 150 / B.size, ox = (x) => 75 + (x - B.cx) * k, oz = (z) => 75 + (z - B.cz) * k;
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
    // The prize, the harder the track the more; and the coins you held, half a shekel each.
    const prize = Math.round(([12, 6, 3, 1][pos - 1] || 1) * (1 + this.lv * 0.5)) + Math.floor(this.me.coins / 2);
    G.state.money += prize;
    if (pos === 1) Game.achieve('race_win');
    const key = this.mapId + this.lv, best = (G.state.raceBest = G.state.raceBest || {});
    this.newBest = !best[key] || this.me.fin < best[key];
    if (this.newBest) best[key] = this.me.fin;
    this.prize = prize;
    this.resultsAt = performance.now() + 3500;
  },
  confetti() {
    const cols = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0xffffff];
    const c = this.me;
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.4), new THREE.MeshBasicMaterial({ color: cols[i % 5], side: THREE.DoubleSide, transparent: true }));
      m.position.set(c.x + (Math.random() - 0.5) * 10, (c.y || 0) + 6 + Math.random() * 6, c.z + (Math.random() - 0.5) * 10);
      this.scene.add(m);
      this.fx.confetti.push({ m, vy: 2 + Math.random() * 2, spin: (Math.random() - 0.5) * 8, floor: c.y || 0 });
    }
  },
  results() {
    $('#race .rc-cd').classList.add('hidden');
    const st = this.standings();
    const row = (c, i) => `<tr class="${c === this.me ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td><bdi data-raw>${esc(c === this.me ? G.profile.name : c.ghost ? c.name : (c.label || '').replace('🗣️ ', ''))}</bdi></td><td>${c.type.name}</td><td>${c.fin ? c.fin.toFixed(1) + ' ש\'' : 'עוד נוסע…'}</td></tr>`;
    const map = RACE_MAPS.find(m => m.id === this.mapId);
    const p = this.panel(`<h2>🏁 ${map.emoji} ${map.name} · ${RACE_LEVELS[this.lv].name}</h2><table class="rc-res">${st.map(row).join('')}</table>
      <p class="rc-sub">+${this.prize}₪ (🪙 ${this.me.coins} מטבעות) ${this.newBest ? '· ⏱️ שיא חדש במסלול!' : ''} ${this.prize >= 12 ? '· מפקד[/ת] הנסיעה של הסוללה 🏆' : ''}</p>
      <div class="rc-row"><button class="btn" data-m="again">🔁 עוד מירוץ</button><button class="btn ghost" data-m="maps">🗺️ מפה אחרת</button><button class="btn ghost" data-m="back">↩ חזרה לבסיס</button></div>`);
    p.querySelector('[data-m=again]').addEventListener('click', () => { $('#race .rc-hud').classList.add('hidden'); this.net = null; this.resetRace(); this.pickScreen(); });
    p.querySelector('[data-m=maps]').addEventListener('click', () => { this.net = null; this.resetRace(); this.mapScreen(); });
    p.querySelector('[data-m=back]').addEventListener('click', () => this.exit());
  },
  // Between races on the same track: the pickups back, effects cleared.
  resetRace() {
    for (const p of this.items) { p.off = 0; p.obj.visible = true; p.obj.scale.setScalar(1); }
    for (const d of [...this.fx.oil, ...this.fx.burgers, ...this.fx.drops]) this.scene.remove(d.m);
    this.fx.oil = []; this.fx.burgers = []; this.fx.drops = [];
    this.events = [];
  },
};
