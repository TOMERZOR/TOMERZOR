// The Gonni heist (השוד בגוני): a GTA-style heist in the club, Kosatka planning board and all.
// The crew plans in a dead container behind the dining hall: two preps are a must (the
// break-in tools from our own storeroom, a getaway vehicle driven to the hideout), two more
// make the night easier (a photo of the safe code, Gonni shirts off their laundry line). The
// finale is at Palmachim, in Gonni's battery: guards with a vision triangle on the sand that
// goes green, yellow, red; whoever sees you runs to raise the alarm in their command post
// (the שו"ב). Take them down quietly from behind, or with the MILES pistol (loud), crack the
// safe, grab the chain and the padlock, and drive out past the gate.
// Alone (or alone online) three from the platoon join as the crew. Online the host's phone
// is the referee: it picks the missions, runs the guards, the alarm, the safe and the loot;
// everyone else sends where they are and what they did (events), like the other club games.
// The stills, textures and the cart, chain and bag models are Higgsfield's (assets/heist).
// Missions live in js/heist/*.js and register themselves in Heist.stages.

const HS_CREW = ['p_liran', 'p_nevo', 'p_shaked'];
const HS_PREPS = [
  { id: 'tools', icon: '🧰', name: 'כלי פריצה', req: true, img: 'assets/heist/prep_tools.jpg', desc: 'מקדחה וקאטר מהמחסן של הסוללה. בלילה. בלי ש{@harasar} ישים לב.' },
  { id: 'car', icon: '🚙', name: 'רכב מילוט', req: true, img: 'assets/heist/prep_car.jpg', desc: 'לבחור רכב — ולהביא אותו למחבוא בשלום, בלי לדרוס אף אחד.' },
  { id: 'code', icon: '🔢', name: 'קוד הכספת', req: false, img: 'assets/heist/prep_code.jpg', desc: 'לצלם את הפתק על המסך של קצין התורן בגוני. בלי קוד — מקדחים. וזה רועש.' },
  { id: 'uni', icon: '🎽', name: 'מדים של גוני', req: false, img: 'assets/heist/prep_uni.jpg', desc: 'חולצות של גוני מחבל הכביסה שלהם. ככה נכנסים בשער הראשי כאילו אנחנו משם.' },
];
// Getaway vehicles. top m/s, acc m/s², grip turning, armor (hits it takes), noise (guards hear
// it), stats for the cards: speed, armor, quiet (of 5).
const HS_CARS = {
  hummer: { id: 'hummer', name: 'ההאמר הישן של הסוללה', model: 'car_hummer', len: 4.8, img: 'assets/race/car_hummer.webp', top: 19, acc: 8, grip: 0.95, armor: 9, noise: 1, stats: [3, 5, 1], desc: 'כבד, רועש, ומעיף מחסומים. המזגן עובד רק בחורף.' },
  hilux: { id: 'hilux', name: 'הטויוטה של הרס"פית', model: 'car_hilux', len: 5.2, img: 'assets/race/car_hilux.webp', top: 23, acc: 10, grip: 1.05, armor: 6, noise: 0.6, stats: [5, 3, 3], desc: 'מהירה ונוחה. אם יש בה שריטה אחת — הרס"פית יודעת.' },
  cart: { id: 'cart', name: 'עגלת הגולף של השק"ם', model: 'hs_cart', len: 2.9, img: 'assets/heist/i_cart.webp', top: 14, acc: 11, grip: 1.4, armor: 3, noise: 0, stats: [2, 1, 5], desc: 'שקטה לגמרי. איטית לגמרי. עוברת מתחת למחסום.' },
};
const HS_APPR = {
  gate: { name: 'השער הראשי', icon: '🚪', need: 'uni', desc: 'נכנסים במדים של גוני. "ערב טוב!"' },
  fence: { name: 'חיתוך הגדר', icon: '✂️', desc: 'מהצפון־מזרח, עם הקאטר. שקט, אם לא רצים.' },
  beach: { name: 'מהים', icon: '🌊', desc: 'לאורך החוף, דרך הפרצה של המעשנים. ארוך, אבל ריק.' },
};
// What the crew says on the radio and in the field ([m/f] is the player's).
const HS_BANTER = {
  sneak: [['p_nevo', 'אני רק אומר שאם נתפסים — אני ישנתי כל הערב.'], ['p_shaked', 'נשימות. ארבע פנימה, ארבע החוצה. ושקט!'], ['p_liran', 'פתחתי הימורים מי נתפס ראשון. כרגע את[ה/] מוביל[/ה].'], ['p_nevo', 'מישהו הביא במבה? אני שואל בשביל חבר.'], ['p_shaked', 'לא לרוץ! ריצה עושה רעש. גם בסנדלים.'], ['p_liran', 'אם {@harasar} שואל — אנחנו באימון ניווט לילה.']],
  seen: [['p_liran', 'הוא מסתכל! הוא מסתכל!'], ['p_shaked', 'משולש צהוב! לזוז מהמשולש!'], ['p_nevo', 'אני לא פה. אני בכלל לא פה.']],
  alarm: [['p_liran', 'אזעקה!!! תוכנית ב\'! ...יש לנו תוכנית ב\'?'], ['p_shaked', 'כולם! MILES! זה תרגיל! ...זה תרגיל, נכון?'], ['p_nevo', 'אני אמרתי שזה רעיון רע. בשקט. בלב.']],
};

const Heist = {
  id: 'heist', name: 'השוד בגוני', icon: '💰',
  desc: 'שוד בסגנון GTA: הכנות, רכב מילוט — ושרשרת עם מנעול בכספת של השו"ב של גוני בפלמחים. אונליין מ־2.',
  cover: 'assets/heist/cover.jpg', solo: true, online: true, minOnline: 2,
  stages: {},

  // ---------- a session ----------
  enter(ctx) {
    // A rematch comes straight back in here: clean up the last round first.
    if (this.cur || this.scene) this.leave();
    this.ctx = ctx;
    this.host = ctx.solo || !!(ctx.net && ctx.net.host);
    const me = { who: Multi.as || 'me', name: G.profile.name, isMe: true };
    this.crew = ctx.solo
      ? [me, ...HS_CREW.filter(id => Cast.get(id)).map(id => ({ who: id, name: fmt(`{@${id}}`), bot: true }))]
      : ctx.players.map(p => ({ who: p.isMe ? (Multi.as || 'me') : p.who, name: p.name, isMe: p.isMe, peer: p.peer }));
    this.me = this.crew.find(c => c.isMe);
    this.evOut = []; this.evId = 0; this.evSeen = {};
    this.n = 0; this.k = null; this.cur = null; this.opt = {}; this.lostT = 0;
    this.ui();
    Arcade.buttons({ act: 'E', run: 'ריצה' });
    Arcade.loadModels(['container', 'launcher', 'radar', 'tower', 'generator', 'palm', 'arc_sandbags', 'arc_table', 'gun_pistol', 'gun_rifle', 'car_hummer', 'car_hilux', 'hs_cart', 'hs_chain', 'hs_bag', 'pickup', 'truck']).then(() => { if (this.ctx === ctx && this.cur && this.cur.dress) this.cur.dress(); });
    Sound.music('night');
    this.bindKeys();
    if (this.host) this.go('board');
    else Arcade.panel('<h2>💰 השוד בגוני</h2><p class="ar-sub">⏳ מתחברים לצוות...</p>');
  },
  leave() {
    if (this.cur && this.cur.leave) try { this.cur.leave(); } catch (e) { console.warn(e); }
    this.cur = null;
    this.endCine();
    Sound.stopSiren();
    if (this.scene) Arcade.dispose(this.scene);
    this.scene = null; this.cam = null; this.shot = null;
    this.unbindKeys();
    const a = $('#arcade'); if (a) a.classList.remove('hs-cinema');
    document.body.classList.remove('hs-on', 'hs-noctl');
  },
  // Host (or alone): on to a stage, for everyone.
  go(k, opt = {}) {
    if (!this.host) return;
    this.start(k, this.n + 1, opt);
  },
  start(k, n, opt = {}) {
    if (this.cur && this.cur.leave) try { this.cur.leave(); } catch (e) { console.warn(e); }
    this.endCine();
    Sound.stopSiren();
    Arcade.panel('');
    this.hint(''); this.meter(null); this.fire(false); this.obj(''); this.stat(''); this.board(null);
    document.body.classList.remove('hs-noctl');
    if (this.scene) Arcade.dispose(this.scene);
    this.scene = null; this.cam = null; this.shot = null;
    this.k = k; this.n = n; this.opt = opt; this.evOut = [];
    this.cur = this.stages[k];
    this.cur.enter(opt);
  },

  // ---------- each frame ----------
  update(dt, t) {
    dt = Math.min(dt, 0.05);
    if (!this.host) {
      const h = this.hostS();
      if (h) { this.lostT = 0; if (h.n !== this.n && this.stages[h.k]) this.start(h.k, h.n, h.o || {}); }
      else if ((this.lostT += dt) > 8) { UI.toast('המארח/ת יצא/ה מהשוד', 'bad'); Arcade.exit(); return; }
    } else if (!this.ctx.solo) this.pollEv();
    if (this.cine) this.cineUpdate(dt);
    if (this.cur) this.cur.update(dt, t);
    if (this.shot && this.cam) this.shotCam();
    if (this.keysDown) this.keysDown.clear();
  },
  render(renderer) {
    if (!this.scene || !this.cam) return;
    Arcade.fit(this.cam);
    renderer.render(this.scene, this.cam);
  },
  act() {
    if (this.cine) { this.cineNext(); return; }
    if (this.cur && this.cur.act) this.cur.act();
  },
  // Keys pressed this frame (F to fire), and the mouse.
  bindKeys() {
    this.keysDown = new Set();
    this.onKey = (e) => { if (!e.repeat) this.keysDown.add(e.code); if (this.cur && this.cur.key) this.cur.key(e); };
    this.onMouse = (e) => { if (e.button === 0 && e.target && e.target.tagName === 'CANVAS') this.keysDown.add('Mouse0'); };
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('mousedown', this.onMouse);
  },
  unbindKeys() {
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('mousedown', this.onMouse);
  },
  pressed(...codes) { return codes.some(c => this.keysDown && this.keysDown.has(c)); },

  // ---------- online ----------
  hostS() { const h = Arcade.others().find(o => o.host); return h && h.s && h.s.h; },
  // What the host's phone is running for everyone (a guest reads it every frame).
  hostSt() { const h = this.hostS(); return h && h.n === this.n ? h.st : null; },
  // The others in this stage: [{ who, name, s }].
  peers() { return Arcade.others().filter(o => o.s && o.s.n === this.n); },
  // Something I did (a takedown, a shot, the safe): straight to the referee, or out in my presence.
  emit(t, ...a) {
    if (this.host) { if (this.cur && this.cur.onEv) this.cur.onEv(this.me.who, t, a); return; }
    this.evOut = [...this.evOut, [++this.evId, t, ...a]].slice(-8);
  },
  pollEv() {
    for (const o of Arcade.others()) {
      const s = o.s;
      if (!s || !Array.isArray(s.ev) || s.n !== this.n) continue;
      const last = this.evSeen[o.who] || 0;
      for (const e of s.ev) if (Array.isArray(e) && e[0] > last) { this.evSeen[o.who] = e[0]; if (this.cur && this.cur.onEv) this.cur.onEv(o.who, e[1], e.slice(2)); }
    }
  },
  presence() {
    const s = { n: this.n, ev: this.evOut };
    if (this.cur && this.cur.mine) Object.assign(s, this.cur.mine());
    if (this.host) s.h = { k: this.k, n: this.n, o: this.opt, pg: this.pgShort(), st: this.cur && this.cur.hostOut ? this.cur.hostOut() : null };
    return s;
  },

  // ---------- progress ----------
  // The save's own (the host's, or alone); a guest goes by the host's.
  save() { const S = G.state; S.heist = S.heist || {}; return S.heist; },
  prog() {
    if (this.host) return this.save();
    const h = this.hostS();
    return (h && h.pg) || {};
  },
  pgShort() { const p = this.save(); return { tools: p.tools ? 1 : 0, car: p.car || 0, code: p.code || 0, uni: p.uni ? 1 : 0, appr: p.appr || 'fence', wins: p.wins || 0 }; },
  prepDone(id, val = 1) {
    if (!this.host) return;
    const p = this.save();
    p[id] = val;
    if (id === 'uni' && !p.appr) p.appr = 'gate';
    try { Game.save(); } catch (e) { /* no save in a test */ }
  },
  ready() { const p = this.prog(); return !!(p.tools && p.car); },

  // ---------- helpers for the stages ----------
  // A night scene with a sky, a sand floor, and the camera.
  world({ bg = 0x0b1226, fog = [40, 170], ground = 'assets/tex/sand.jpg', rep = 30, size = 260, tint = 0x6f6456, sky = 'assets/arcade/hide_sky.jpg', moon = 0.42 } = {}) {
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(bg);
    if (fog) sc.fog = new THREE.Fog(bg, fog[0], fog[1]);
    this.cam = new THREE.PerspectiveCamera(55, 1, 0.15, 700);
    sc.add(new THREE.HemisphereLight(0x6474b8, 0x221a10, 0.46));
    const m = this.moon = new THREE.DirectionalLight(0xb8c6ff, moon);
    m.position.set(-25, 40, 18); m.castShadow = !G.touch; m.shadow.mapSize.set(1024, 1024);
    Object.assign(m.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
    sc.add(m); sc.add(m.target);
    if (sky) Arcade.sky(sc, sky, { r: 300, h: 160, y0: -14, repeat: 3 });
    if (ground) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: Arcade.texture(ground, rep), color: tint, roughness: 1 }));
      g.rotation.x = -Math.PI / 2; g.receiveShadow = true; sc.add(g);
    }
    this.cols = [];
    return sc;
  },
  mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }); },
  // A strip of road from one point to another (the asphalt repeats along it).
  road(x0, z0, x1, z1, w = 8, y = 0.02) {
    const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0);
    const t = Arcade.texture('assets/tex/asphalt.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(L / w, 1);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(L + w * 0.9, w), new THREE.MeshStandardMaterial({ map: t, color: 0x7c7c80, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2; r.rotation.z = -a; r.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); r.receiveShadow = true;
    this.scene.add(r);
    return r;
  },
  // A box that's also a wall (w along x, d along z); h ≥ 1.2 blocks sight.
  box(x, z, w, d, h, mat, { y = 0, col = true, shadow = true, parent = null } = {}) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y + h / 2, z);
    b.castShadow = shadow; b.receiveShadow = true;
    (parent || this.scene).add(b);
    if (col) this.cols.push({ x, z, hw: w / 2, hd: d / 2, h: y + h });
    return b;
  },
  col(x, z, w, d, h = 2.5) { this.cols.push({ x, z, hw: w / 2, hd: d / 2, h }); },
  // A model (or a stand-in box) at (x, z), with its collider.
  prop(name, x, z, fit, { ry = 0, w = 0, d = 0, h = 2.5, col = true, fallback = 0x5b6648 } = {}) {
    let m = Assets.model(name, fit);
    if (!m) { m = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(w || 2, h, d || 2), this.mat(fallback)); b.position.y = h / 2; b.castShadow = true; m.add(b); m.userData.stand = true; }
    m.position.set(x, 0, z); m.rotation.y = ry;
    this.scene.add(m);
    if (col && w) this.col(x, z, w, d, h);
    return m;
  },
  // Chain-link fence from (x0, z0) to (x1, z1), straight along x or z; gaps: [[from, to]] along it.
  fence(x0, z0, x1, z1, gaps = [], h = 2.4) {
    if (!this.fenceMat) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.strokeStyle = 'rgba(190,200,205,0.9)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.moveTo(32, -32); g.lineTo(96, 32); g.moveTo(-32, 32); g.lineTo(32, 96); g.moveTo(32, 96); g.lineTo(96, 32); g.moveTo(-32, 32); g.lineTo(32, -32); g.stroke();
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this.fenceTex = t;
      this.postMat = this.mat(0x6b6f68, { metalness: 0.4, roughness: 0.6 });
    }
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const a = alongX ? Math.min(x0, x1) : Math.min(z0, z1), b = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
    const segs = [];
    let s = a;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) segs.push([s, g0]); s = Math.max(s, g1); }
    if (s < b) segs.push([s, b]);
    for (const [p, q] of segs) {
      const L = q - p, mid = (p + q) / 2;
      const t = this.fenceTex.clone(); t.needsUpdate = true; t.repeat.set(L / 0.9, h / 0.9);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.6 }));
      if (alongX) m.position.set(mid, h / 2, z0); else { m.position.set(x0, h / 2, mid); m.rotation.y = Math.PI / 2; }
      this.scene.add(m);
      for (let u = p; u <= q + 0.01; u += Math.max(2.5, L / Math.ceil(L / 3))) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h + 0.3, 6), this.postMat);
        post.position.set(alongX ? u : x0, (h + 0.3) / 2, alongX ? z0 : u); this.scene.add(post);
      }
      // A fence doesn't hide you: it stops you, not their eyes (h 1).
      if (alongX) this.cols.push({ x: mid, z: z0, hw: L / 2, hd: 0.12, h: 1 }); else this.cols.push({ x: x0, z: mid, hw: 0.12, hd: L / 2, h: 1 });
    }
  },
  // A soldier with a name tag.
  soldier(look, tag, { bg = 'rgba(20,26,16,.8)', fg = '#f4f1e6' } = {}) {
    const m = Arcade.soldier(this.scene, look);
    if (tag) { const l = Scene3D.label(tag, { bg, fg, size: 0.4 }); l.position.y = 2.2; m.root.add(l); m.tag = l; }
    return m;
  },
  // A guard of Gonni: a helmet, no cast face.
  gonniLook(i) { return { id: null, skin: DATA.skinTones[i % 4], hair: DATA.hairColors[i % 3], head: 'helmet', female: i % 3 === 1, uniform: 0x5b6b3c }; },
  // A glowing column over where to go.
  beacon(x, z, color = 0xffd34a, h = 9, w = 0.55) {
    const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(w, w, h, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: h < 7 ? 0.1 : 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    col.position.y = h / 2; g.add(col);
    const ring = new THREE.Mesh(new THREE.RingGeometry(w * 2, w * 2.5, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    g.position.set(x, 0, z); g.userData.ring = ring;
    this.scene.add(g);
    return g;
  },
  pulse(b, t) { if (!b) return; const k = 1 + Math.sin(t * 4) * 0.12; b.userData.ring.scale.set(k, k, k); },
  // A word that floats up from a spot.
  pop(x, z, text, { bg = 'rgba(255,214,0,.95)', fg = '#3a1a0a', y = 1.9 } = {}) {
    const l = Scene3D.label(fmt(text), { bg, fg, size: 0.5 });
    l.position.set(x, y, z); this.scene.add(l);
    (this.pops = this.pops || []).push({ m: l, t: 0 });
  },
  updatePops(dt) {
    for (const p of this.pops || []) { p.t += dt; p.m.position.y += dt * 1.1; p.m.material.opacity = Math.max(0, 1 - p.t / 1.6); }
    this.pops = (this.pops || []).filter(p => { if (p.t < 1.6) return true; this.scene && this.scene.remove(p.m); return false; });
  },
  // Pushes (p.x, p.z) out of the walls; r is how round they are.
  collide(p, r = 0.35, bounds = null) {
    for (const c of this.cols) {
      // Soft: washing on a line, you walk through it (it still hides you).
      if (c.off || c.soft) continue;
      const dx = p.x - c.x, dz = p.z - c.z, ox = c.hw + r - Math.abs(dx), oz = c.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz; }
    }
    if (bounds) { p.x = Math.max(bounds[0], Math.min(bounds[1], p.x)); p.z = Math.max(bounds[2], Math.min(bounds[3], p.z)); }
  },
  // Is the way from one point to another clear of anything tall?
  los(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.4);
    for (let k = 1; k < n; k++) {
      const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n;
      for (const c of this.cols) if (!c.off && c.h >= 1.2 && Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd) return false;
    }
    return true;
  },
  // How far one looks along an angle before a wall.
  ray(x, z, a, max) {
    const cx = Math.cos(a), cz = Math.sin(a);
    for (let d = 0.4; d < max; d += 0.4) {
      const px = x + cx * d, pz = z + cz * d;
      for (const c of this.cols) if (!c.off && c.h >= 1.2 && Math.abs(px - c.x) < c.hw && Math.abs(pz - c.z) < c.hd) return d;
    }
    return max;
  },
  // Walks a player by the stick: returns the speed. mul slows (carrying, sneaking).
  walk(p, dt, inp, mul = 1, bounds = null) {
    const ix = inp.x, iz = -inp.y, l = Math.hypot(ix, iz);
    const sp = (inp.run ? 6.4 : 3.5) * mul;
    const tvx = l > 0.08 ? ix / Math.max(1, l) * sp : 0, tvz = l > 0.08 ? iz / Math.max(1, l) * sp : 0;
    const k = Math.min(1, dt * 10);
    p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k;
    p.x += p.vx * dt; p.z += p.vz * dt;
    const v = Math.hypot(p.vx, p.vz);
    if (v > 0.3) p.a = Math.atan2(p.vz, p.vx);
    this.collide(p, 0.35, bounds);
    p.run = !!inp.run && v > 4;
    return v;
  },
  // The play camera: up and behind, a little ahead of where you walk.
  follow(p, dt, { up = 12.5, back = 9.5, look = 0 } = {}) {
    if (!this.cam || this.shot) return;
    const want = new THREE.Vector3(p.x + (p.vx || 0) * 0.25, up, p.z + back + (p.vz || 0) * 0.25);
    this.cam.position.lerp(want, Math.min(1, dt * 4));
    if (G.shake > 0 && Settings.v.shake !== false) { this.cam.position.x += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt); }
    this.cam.lookAt(this.cam.position.x, look, this.cam.position.z - back);
  },
  // Someone else's soldier, smoothed toward their presence.
  smooth(p, s, dt) {
    const k = Math.min(1, dt * 9);
    const ox = p.x, oz = p.z;
    p.x += (s.x - p.x) * k; p.z += (s.z - p.z) * k;
    let da = (s.a || 0) - p.a; da = Math.atan2(Math.sin(da), Math.cos(da)); p.a += da * k;
    p.vx = (p.x - ox) / Math.max(dt, 1e-3); p.vz = (p.z - oz) / Math.max(dt, 1e-3);
  },
  // The crew's banter now and then (alone: the platoon on the radio).
  banter(dt, kind = 'sneak', every = 22) {
    this.banT = (this.banT == null ? every * 0.6 : this.banT) - dt;
    if (this.banT > 0) return;
    this.banT = every * (0.8 + Math.random() * 0.5);
    const pool = HS_BANTER[kind].filter(([w]) => this.crew.some(c => c.bot && c.who === w) || !this.ctx.solo);
    if (!pool.length || !this.ctx.solo) return;
    const [w, line] = pick(pool);
    Arcade.say(`📻 ${line}`, w, 3200);
  },

  // ---------- the gun: models in soldiers' hands (copied from the club shooter's IK) ----------
  arm(m, kind = 'rifle') {
    const src = Assets.models[kind === 'rifle' ? 'gun_rifle' : 'gun_pistol'];
    if (m.gunMount) m.root.remove(m.gunMount);
    const mount = m.gunMount = new THREE.Group(); m.root.add(mount);
    let g;
    if (src) { g = src.clone(true); g.scale.setScalar(kind === 'rifle' ? 0.72 : 0.19); g.traverse(o => { if (o.isMesh) { o.castShadow = true; if (!o.material.userData.hsLit) { o.material = o.material.clone(); o.material.color.setScalar(1.6); o.material.userData.hsLit = true; } } }); }
    else { g = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, kind === 'rifle' ? 0.7 : 0.2), this.mat(0x2a2a28)); }
    const holder = new THREE.Group(); holder.add(g); holder.rotation.y = Math.PI / 2;
    mount.add(holder); m.gun = holder; m.gunKind = kind;
    if (!m.bones) { const B = {}; m.root.traverse(o => { if (o.isBone && /^(LeftArm|LeftForeArm|LeftHand|RightArm|RightForeArm|RightHand)$/.test(o.name) && !B[o.name]) B[o.name] = o; }); m.bones = B; }
  },
  aim(m, a, low = 0) {
    if (!m.gunMount) return;
    const r = m.gunKind === 'rifle';
    m.gunMount.position.set(r ? 0.32 : 0.42, 1.36 - low * 0.3, 0.1);
    m.gunMount.rotation.set(0, 0, -low);
    const B = m.bones;
    if (!B || !B.RightArm || !B.RightForeArm || !B.RightHand || low > 0.6) return;
    m.root.updateMatrixWorld(true);
    const V = THREE.Vector3, g = m.gun;
    const grip = g.localToWorld(new V(0, r ? -0.05 : -0.035, r ? 0.03 : -0.05));
    const fore = g.localToWorld(new V(0, r ? -0.01 : -0.04, r ? 0.22 : -0.04));
    const side = new V(-Math.sin(a), 0, Math.cos(a));
    this.ik(B.RightArm, B.RightForeArm, B.RightHand, grip, new V(0, -1, 0).addScaledVector(side, 0.6));
    if (B.LeftArm && B.LeftForeArm && B.LeftHand) this.ik(B.LeftArm, B.LeftForeArm, B.LeftHand, fore, new V(0, -1, 0).addScaledVector(side, -0.8));
  },
  ik(upper, lower, hand, target, hint) {
    const V = THREE.Vector3, Q = THREE.Quaternion;
    const a = upper.getWorldPosition(new V()), b = lower.getWorldPosition(new V()), c = hand.getWorldPosition(new V());
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
    const toT = target.clone().sub(a); let d = toT.length();
    d = Math.max(0.05, Math.min(l1 + l2 - 0.001, d));
    const dir = toT.normalize();
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const perp = hint.clone().sub(dir.clone().multiplyScalar(hint.dot(dir))).normalize();
    const elbow = a.clone().addScaledVector(dir, cosA * l1).addScaledVector(perp, sinA * l1);
    const turn = (bone, from, to, cur) => {
      const want = to.clone().sub(from).normalize(), have = cur.clone().sub(from).normalize();
      const q = new Q().setFromUnitVectors(have, want);
      const bw = bone.getWorldQuaternion(new Q()), pw = bone.parent.getWorldQuaternion(new Q());
      bone.quaternion.copy(pw.invert().multiply(q.multiply(bw)));
      bone.updateMatrixWorld(true);
    };
    turn(upper, a, elbow, b);
    const b2 = lower.getWorldPosition(new V()), c2 = hand.getWorldPosition(new V());
    turn(lower, b2, a.clone().addScaledVector(dir, d), c2);
  },

  // ---------- cinema: letterbox, stills and camera shots, a line at a time ----------
  // seq: [{ img, shot: { from, to, at, atEnd, dur }, who (cast id | 'player' | ''), name, text, ms }]
  // Lines go on by themselves (online everyone keeps the same pace); a tap goes on sooner.
  play(seq, { skip = true } = {}) {
    return new Promise(done => {
      this.endCine();
      const a = $('#arcade');
      if (!a) { done(); return; }
      UI.cinema(true, () => null);
      a.classList.add('hs-cinema');
      const box = document.createElement('div');
      box.className = 'hs-cine';
      box.innerHTML = `<div class="hs-still"><img alt=""></div><div class="dialog hs-cap"><div class="hs-face"></div><div class="body"><div class="who"></div><div class="txt"></div><div class="hint">${G.touch ? 'הקש להמשך' : 'רווח / E / לחיצה להמשך'}</div></div></div>${skip ? '<button class="hs-skip">⏭ דילוג</button>' : ''}`;
      a.appendChild(box);
      box.addEventListener('click', (e) => { if (e.target.closest('.hs-skip')) { Sound.click(); this.endCine(true); return; } this.cineNext(); });
      this.cine = { seq: seq.filter(Boolean), i: -1, box, done, t: 0, ms: 0, full: '' };
      this.cineNext();
    });
  },
  cineNext() {
    const c = this.cine;
    if (!c) return;
    // Mid-typing, the first tap shows the whole line.
    if (c.i >= 0 && c.shown < c.full.length) { c.shown = c.full.length; c.box.querySelector('.txt').textContent = c.full; c.t = Math.max(c.t, c.ms - 1500); return; }
    c.i++;
    if (c.i >= c.seq.length) { this.endCine(true); return; }
    if (c.i > 0) Sound.click();
    const L = c.seq[c.i], box = c.box;
    const still = box.querySelector('.hs-still'), img = still.querySelector('img');
    if (L.img) { if (img.getAttribute('src') !== L.img) { img.src = L.img; img.style.animation = 'none'; void img.offsetWidth; img.style.animation = ''; } still.classList.add('on'); }
    else still.classList.remove('on');
    if (L.shot) this.shot = { ...L.shot, t0: performance.now() };
    if (L.fx) try { L.fx(); } catch (e) { console.warn(e); }
    const who = L.who || '';
    const person = who && who !== 'player' ? Cast.get(who) : null;
    const name = L.name ? fmt(L.name) : who === 'player' ? fmt('{name}') : person ? fmt(`{@${who}}`) : '';
    const face = who ? faceUrl(who) : null;
    box.querySelector('.hs-face').innerHTML = face ? `<img class="face" src="${face}" alt="">` : who === 'player' ? '<div class="portrait-fallback">🪖</div>' : person ? avatarHtml(person) : L.icon ? `<div class="portrait-fallback">${L.icon}</div>` : '';
    box.querySelector('.hs-cap').classList.toggle('nobody', !name && !L.icon && !face);
    box.querySelector('.who').textContent = name;
    c.full = person ? fmtAs(person, L.text || '') : fmt(L.text || '');
    c.shown = 0; c.t = 0;
    c.ms = L.ms || Math.max(2800, Math.min(7500, 1600 + c.full.length * 55));
    box.querySelector('.txt').textContent = '';
    box.querySelector('.hs-cap').classList.toggle('hidden', !c.full);
  },
  cineUpdate(dt) {
    const c = this.cine;
    c.t += dt * 1000;
    if (c.shown < c.full.length) {
      const n = Math.min(c.full.length, Math.floor(c.t / 22));
      if (n > c.shown) { if (Math.floor(n / 6) !== Math.floor(c.shown / 6)) Sound.blip(); c.shown = n; c.box.querySelector('.txt').textContent = c.full.slice(0, n); }
    }
    if (c.t >= c.ms) this.cineNext();
  },
  endCine(finished = false) {
    const c = this.cine;
    if (!c) return;
    this.cine = null;
    c.box.remove();
    UI.cinema(false);
    const a = $('#arcade'); if (a) a.classList.remove('hs-cinema');
    this.shot = null;
    void finished;
    c.done();
  },
  // The camera on a shot: from → to, looking at → atEnd, eased.
  shotCam() {
    const s = this.shot, c = this.cam;
    let k = Math.min(1, (performance.now() - s.t0) / (s.dur || 6000));
    k = k * k * (3 - 2 * k);
    const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    c.position.copy(V(s.from).lerp(V(s.to || s.from), k));
    c.lookAt(V(s.at).lerp(V(s.atEnd || s.at), k));
  },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="hs-hud"><div class="hs-obj ar-chip hidden"></div><div class="hs-stat ar-chip hidden"></div>
      <div class="hs-meter hidden"><span></span><i><b></b></i></div><div class="hs-hint"></div>
      <button class="hs-fire hidden" aria-label="ירי">🔫</button><div class="hs-board hidden"></div></div>`);
    const h = $('#arcade .hs-hud');
    this.el = { obj: h.querySelector('.hs-obj'), stat: h.querySelector('.hs-stat'), meter: h.querySelector('.hs-meter'), hint: h.querySelector('.hs-hint'), fire: h.querySelector('.hs-fire'), board: h.querySelector('.hs-board') };
    this.el.fire.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.keysDown && this.keysDown.add('Touch'); });
    document.body.classList.add('hs-on');
  },
  set(el, html) { if (!this.el) return; const e = this.el[el]; if (!e) return; if (e.dataset.html !== html) { e.dataset.html = html; e.innerHTML = html ? fmt(html) : ''; } e.classList.toggle('hidden', !html); },
  obj(html) { this.set('obj', html); },
  stat(html) { this.set('stat', html); },
  hint(text) { if (!this.el) return; const t = text ? fmt(text) : ''; if (this.el.hint.textContent !== t) this.el.hint.textContent = t; },
  // A progress bar for things you hold E for (null hides it).
  meter(frac, label = '') {
    if (!this.el) return;
    const m = this.el.meter;
    m.classList.toggle('hidden', frac == null);
    if (frac == null) return;
    m.querySelector('b').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    const t = fmt(label); if (m.querySelector('span').textContent !== t) m.querySelector('span').textContent = t;
  },
  fire(show) { if (this.el) this.el.fire.classList.toggle('hidden', !(show && G.touch)); },
  // The board (and the car picker) is all buttons: the phone's stick and buttons step aside.
  board(html) { this.set('board', html); document.body.classList.toggle('hs-noctl', !!html); return this.el && this.el.board; },
  key2() { return G.touch ? '' : 'E — '; },
};
Arcade.register(Heist);

// ---------- the planning board: the hideout container behind the dining hall ----------
Heist.stages.board = {
  enter() {
    const H = Heist;
    const sc = H.world({ bg: 0x0d0b08, fog: null, ground: null, sky: null, moon: 0.15 });
    // The container: walls, floor, a table, the board on the wall, one warm bulb.
    const wall = H.mat(0x7a7f6a, { map: Arcade.texture('assets/tex/container.jpg', 2), roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), H.mat(0x6b5d48, { map: Arcade.texture('assets/heist/tex_floor.jpg', 3) }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    H.box(0, -3, 12, 0.1, 2.8, wall, { col: false }); H.box(-6, 0, 0.1, 6, 2.8, wall, { col: false }); H.box(6, 0, 0.1, 6, 2.8, wall, { col: false });
    H.box(0, 3, 12, 0.1, 2.8, wall, { col: false }).visible = false;
    H.box(0, 0, 12, 6, 0.1, wall, { y: 2.8, col: false });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.0), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/heist/board.jpg'), roughness: 0.9 }));
    board.position.set(0, 1.6, -2.93); sc.add(board);
    const tableTop = H.box(0, -0.3, 2.6, 1.4, 0.08, H.mat(0x6b4a2a), { y: 0.82, col: false });
    for (const [x, z] of [[-1.2, -0.9], [1.2, -0.9], [-1.2, 0.3], [1.2, 0.3]]) H.box(x, z, 0.08, 0.08, 0.82, H.mat(0x3a2a1a), { col: false });
    const map = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/heist/arrive.jpg'), roughness: 1 }));
    map.rotation.x = -Math.PI / 2; map.position.set(0, 0.91, -0.3); sc.add(map);
    void tableTop;
    // Snacks on the table, a jerrycan and boxes in the corners.
    for (const [x, z, c] of [[0.9, 0.1, 0x2a6ad8], [-0.95, -0.7, 0xe0302a], [1.05, -0.75, 0x3a3a3a]]) H.box(x, z, 0.18, 0.12, 0.26, H.mat(c), { y: 0.9, col: false });
    H.box(-5, -2, 1.2, 0.8, 0.9, H.mat(0x4f5a34), { col: false }); H.box(-5, -2, 1, 0.7, 0.6, H.mat(0x46512e), { y: 0.9, col: false });
    H.box(5.2, -2.2, 0.5, 0.3, 0.7, H.mat(0x375a2a), { col: false });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
    bulb.position.set(0, 2.35, -0.3); sc.add(bulb);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 4), H.mat(0x111111)); wire.position.set(0, 2.58, -0.3); sc.add(wire);
    const lamp = this.lamp = new THREE.PointLight(0xffc878, 1.7, 11, 1.4); lamp.position.set(0, 2.25, -0.3); lamp.castShadow = !G.touch; sc.add(lamp);
    const fill = new THREE.PointLight(0x6080ff, 0.35, 12); fill.position.set(0, 2, 2.6); sc.add(fill);
    // The crew around the table.
    const spots = [[0, 0.75, -Math.PI / 2], [-1.75, -0.35, 0], [1.75, -0.3, Math.PI], [-0.9, -1.45, Math.PI / 3]];
    this.ms = H.crew.slice(0, 4).map((c, i) => {
      const m = H.soldier(Arcade.look(c.isMe ? null : (Cast.get(c.who) ? c.who : null)), null);
      const [x, z, a] = spots[i];
      Arcade.pose(m, x, z, a, 0, 0);
      return { m, x, z, a, who: c.isMe ? 'player' : c.who };
    });
    H.cam.position.set(0, 2.2, 4.2); H.cam.lookAt(0, 1.2, -1);
    this.t = 0; this.pgKey = '';
    const p = H.prog();
    const first = !Heist.seenBrief && !(H.host && p.brief);
    Heist.seenBrief = true;
    const n = H.n;
    if (first) this.brief().then(() => { if (H.n === n) this.show(); });
    else this.show();
  },
  // The first time: the briefing, around the table.
  brief() {
    const H = Heist;
    if (H.host) { H.save().brief = 1; }
    const bot = (id) => H.crew.find(c => c.who === id) ? id : (H.crew.find(c => !c.isMe) || {}).who || '';
    const S = {
      wide: { from: [3.4, 2.3, 3.6], to: [2.2, 2.1, 3.2], at: [0, 1.1, -0.6], dur: 9000 },
      board: { from: [0.6, 1.7, 0.2], to: [-0.4, 1.65, -0.6], at: [0, 1.6, -2.9], dur: 8000 },
      table: { from: [0.3, 2.6, 0.6], to: [-0.2, 2.2, 0.4], at: [0, 0.9, -0.3], atEnd: [0.1, 0.9, -0.35], dur: 8000 },
      left: { from: [-0.4, 1.7, 0.9], to: [-0.6, 1.7, 0.7], at: [-1.75, 1.55, -0.35], dur: 7000 },
      right: { from: [0.5, 1.7, 0.9], to: [0.7, 1.7, 0.7], at: [1.75, 1.55, -0.3], dur: 7000 },
      me: { from: [0.4, 1.65, -1.6], to: [0.2, 1.62, -1.3], at: [0, 1.5, 0.75], dur: 7000 },
    };
    const [a, b, c] = [bot('p_liran'), bot('p_shaked'), bot('p_nevo')];
    return H.play([
      { img: 'assets/heist/brief.jpg', text: 'מכולה נטושה מאחורי חדר האוכל. 23:40. מישהו הביא במבה. מישהו הביא מפה. ומישהו הביא... תוכנית.', ms: 5200 },
      { shot: S.left, who: a, text: 'בכל כנס גדוד של 947, גוני מנפנפים בה. "השרשרת". עם המנעול. כאילו זה גביע המדינה.' },
      { shot: S.right, who: b, text: 'והיא שוכבת להם בכספת, בשו"ב שלהם בפלמחים. עם שומרים. עם משולשי ראייה. עם אזעקה.' },
      { shot: S.table, who: c, text: 'אז... אנחנו לא הולכים לישון הלילה?' },
      { shot: S.left, who: a, text: 'אנחנו הולכים לגנוב אותה. ובכנס הבא — היא תהיה על הצוואר של {name}.' },
      { shot: S.me, who: 'player', text: 'אני בפנים. מה צריך?' },
      { shot: S.board, img: 'assets/heist/board.jpg', who: b, text: 'קודם הכנות. כלי פריצה ורכב מילוט — חובה. קוד הכספת ומדים של גוני — בונוס, אבל עם זה הלילה נהיה הרבה יותר קל.' },
      { shot: S.wide, who: c, text: 'ואני מבקש 15 אחוז. על הבמבה.' },
    ]);
  },
  show() { this.pgKey = ''; this.draw(); },
  // The board itself: the preps, the approach, the crew, and the big button.
  draw() {
    const H = Heist, p = H.prog();
    const key = JSON.stringify([p.tools, p.car, p.code, p.uni, p.appr, H.host]);
    if (key === this.pgKey) return;
    this.pgKey = key;
    const host = H.host;
    const hostName = (Arcade.others().find(o => o.host) || {}).name || 'המארח/ת';
    const done = (id) => id === 'car' ? !!p.car : !!p[id];
    const card = (q) => {
      const ok = done(q.id);
      const extra = q.id === 'car' && p.car && HS_CARS[p.car] ? `<em>${HS_CARS[p.car].name}</em>` : q.id === 'code' && p.code ? `<em>📸 ${String(p.code)}</em>` : '';
      return `<div class="hs-card ${ok ? 'ok' : ''} ${q.req ? 'req' : 'opt'}">
        <img src="${q.img}" alt=""><div class="hs-cbody"><b>${q.icon} ${q.name}</b>
        <span class="hs-tag">${ok ? '✅ הושלם' : q.req ? '❗ חובה' : '⭐ בונוס'}</span>${extra}
        <i>${q.desc}</i>
        ${host ? `<button class="btn small ${ok ? 'ghost' : ''}" data-p="${q.id}">${ok ? '🔁 שוב' : '▶ למשימה'}</button>` : ''}</div></div>`;
    };
    const appr = p.appr && (p.appr !== 'gate' || p.uni) ? p.appr : 'fence';
    const apprBtns = Object.entries(HS_APPR).map(([id, a]) => {
      const locked = a.need && !p[a.need];
      return `<button class="hs-ap ${appr === id ? 'on' : ''} ${locked ? 'locked' : ''}" data-a="${id}" ${!host || locked ? 'disabled' : ''} title="${a.desc}">${locked ? '🔒' : a.icon} ${a.name}</button>`;
    }).join('');
    const split = H.ctx.solo ? [55, 15, 15, 15] : H.crew.map(() => Math.round(100 / H.crew.length));
    const crew = H.crew.map((c, i) => `<span class="${c.isMe ? 'me' : ''}"><bdi data-raw>${esc(c.name)}</bdi> <small>${split[i] || 0}%</small></span>`).join('');
    const ready = H.ready();
    const box = H.board(`<div class="hs-bd">
      <div class="hs-bhead"><h2>📋 לוח תכנון — השוד בגוני</h2><p>🎯 המטרה: השרשרת והמנעול בכספת של השו"ב של גוני, פלמחים</p></div>
      <div class="hs-cards">${HS_PREPS.map(card).join('')}</div>
      <div class="hs-brow"><div class="hs-crewl"><b>👥 הצוות</b>${crew}</div>
        <div class="hs-apl"><b>🧭 כניסה</b>${apprBtns}</div></div>
      <div class="hs-go">${host ? `<button class="btn hs-start ${ready ? '' : 'off'}" data-go ${ready ? '' : 'disabled'}>${ready ? '💰 להתחיל את השוד' : '🔒 קודם ההכנות שחובה'}</button>` : `<p class="hs-wait">⏳ <bdi data-raw>${esc(hostName)}</bdi> בוחר[/ת] משימה...</p>`}</div>
    </div>`);
    if (!box || !host) return;
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { Sound.click(); H.go(b.dataset.p); });
    box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { Sound.click(); H.save().appr = b.dataset.a; this.pgKey = ''; this.draw(); });
    const go = box.querySelector('[data-go]');
    if (go) go.onclick = () => { if (!H.ready()) return; Sound.horn(); H.go('fin', { appr, car: p.car, code: p.code || 0, uni: p.uni ? 1 : 0, seed: Math.floor(Math.random() * 1e6) }); };
  },
  update(dt) {
    const H = Heist;
    this.t += dt;
    for (const s of this.ms) Arcade.pose(s.m, s.x, s.z, s.a, 0, dt);
    if (this.lamp) this.lamp.intensity = 1.7 + Math.sin(this.t * 13) * 0.04 + (Math.random() < 0.01 ? -0.6 : 0);
    if (!H.shot) { const a = this.t * 0.08; H.cam.position.set(Math.sin(a) * 2.6, 2.4, 3.4 + Math.cos(a) * 0.4); H.cam.lookAt(0, 1.1, -0.8); }
    if (!H.cine) { this.drawT = (this.drawT || 0) - dt; if (this.drawT <= 0) { this.drawT = 0.5; this.draw(); } }
  },
  leave() { Heist.board(null); },
};
