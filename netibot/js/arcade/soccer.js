// Sufa soccer (כדורגל סופות): Rocket-League-style, two against two in the race's cars on a sand
// pitch walled in by sandbags and camo nets, a huge bouncy ball, the platoon in the stands and
// the HQ clerk commentating without a breath.
//
// Driving: everyone drives the same car (the race's cars are only its looks), so it's fair. It
// grips and turns hard, slides with the handbrake (or when you brake while turning), reverses,
// jumps, and a second jump in the air is a dodge that whacks the ball. Boost drains while held
// and refills from the pads on the pitch. The camera keeps you and the ball in view (ball cam)
// or sits behind the car; an arrow at the edge of the screen shows the ball when it's out of view.
// A match: three minutes or first to five; a tie goes to a golden goal.
//
// Alone: you and a teammate from the platoon against two more. Online: the players split into
// the two teams in order and bots fill the teams up to two each. The host's phone owns the ball
// and the bots; each phone drives its own car, plays the ball ahead for its own hits (so they
// feel instant) and tells the host about them.

const SOC_LINES = {
  kickoff: ['{@hamalist}: "ויוצאים לדרך!!! ארבע מכוניות, כדור אחד, אפס שכל!!!"', '{@hamalist}: "שריקה!!! מי שרק? אני שרקתי? אני לא יודעת לשרוק!!!"', '{@commander}: "בלי תאונות. ...טוב, בלי הרבה תאונות."'],
  kick: ['{@hamalist} (בקריינות): "והכדור אצל — רגע, איפה הכדור? שם! לא, שם!!!"', '{@hamalist}: "בום!!! הכדור הזה צריך גימלים!!!"', '{@hamalist}: "איזו פצצה!!! ...זה לא היה מטח, נכון? רק כדור? טוב."', '{@hamalist}: "ואז הוא נוסע, והוא נוסע, ואז היא אמרה לי—"', '{@hamalist}: "הכדור הזה עף יותר רחוק מהחופשה הבאה שלי!!!"', '{@p_nevo}: "...מה? כבר בעטו? תעירו אותי כשיש גול."', '{@hamalist}: "וואו!!! וואו!!! ...מה קרה? לא ראיתי, צעקתי."'],
  air: ['{@hamalist}: "באוויר!!! זה ציפור?! זה מטוס?! לא — זו סופה!!!"', '{@interceptors}: "יירוט! ...סליחה, הרגל."', '{@hamalist}: "מכונית עפה!!! מישהו מדווח לחיל האוויר?!"'],
  save: ['{@hamalist}: "הצלה!!! מישהו שם שם קיר!!!"', '{@harasar}: "ככה מגינים על הבסיס! ...על השער. אותו דבר."', '{@hamalist}: "לא נכנס!!! לא נכנס!!! אני צריכה לשבת!!!"'],
  post: ['{@hamalist}: "קורה!!! הקורה!!! אני לא נושמת!!!"', '{@rasap}: "פגיעה ברכוש צה״לי. רשמתי."'],
  goal: ['{@hamalist}: "גוווווווווול!!! גול גול גול!!! אני צריכה מים!!!"', '{@hamalist}: "שער!!! שער של מפקד נסיעה!!!"', '{@commander}: "יפה! ...עכשיו לנקות את החול מהמנוע."', '{@hamalist}: "גול!!! תביאו לי מיקרופון גדול יותר!!!"'],
  own: ['{@hamalist}: "שער עצמי!!! הו לא!!! זה כל כך מביך!!! אני אספר לכולם!!!"', '{@commander}: "שער עצמי. נדבר על זה בשיחת הסיכום."'],
  wall: ['{@harasar}: "השקים! מי ממלא אותם מחדש?!"', '{@rasap}: "כל שק חתום אצלי."'],
  bump: ['{@harasar}: "מי משלם על הפח?!"', '{@p_liran}: "אוגה בוגה!!! תאונה!!!"', '{@rasap}: "דוח נזק. שלושה עותקים."'],
  empty: ['{@rasap}: "נגמר הטורבו? יש טופס לזה. בשלושה עותקים."', '{@hamalist}: "אין טורבו!!! סעו על הכריות הכתומות!!!"'],
  last: ['{@hamalist}: "דקה אחרונה!!! אני מזיעה ואני אפילו לא משחקת!!!"'],
  ot: ['{@hamalist}: "הארכה!!! גול זהב!!! מי שמבקיע — לוקח הכל!!! (הכל זה כבוד)"', '{@commander}: "הארכה. גול זהב. מי שמבקיע — יוצא הביתה ראשון."'],
  pass: ['"[קח/קחי]!!! [תבעט/תבעטי]!!!"', '"שלך!!! שלך!!!"', '"מסירה! ...זאת הייתה מסירה, נכון?"'],
};
// The pitch (meters): half its length and width, the goal mouth's half width and its height, the
// ball's radius, the corners cut at 45°, the ceiling.
const SOC_L = 30, SOC_W = 19, SOC_GOAL = 6.5, SOC_GH = 5.6, SOC_GD = 3.6, SOC_R = 1.6, SOC_CUT = 7, SOC_CEIL = 16;
// The car everyone drives: half length, half width, height; speeds in m/s.
const SOC_CAR = { len: 4.4, hl: 2.15, hw: 1.15, h: 1.55, top: 23, boostTop: 33, acc: 22, rev: 11, jump: 10, grav: 28, r: 1.8 };
// Boost pads: big ones fill the tank, small ones a quarter.
const SOC_PADS = [
  ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => ({ x: a * (SOC_L - 6), z: b * (SOC_W - 5), big: true })),
  { x: 0, z: -(SOC_W - 3), big: true }, { x: 0, z: SOC_W - 3, big: true },
  ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => ({ x: a * 12, z: b * 8 })),
  { x: -20, z: 0 }, { x: 20, z: 0 }, { x: 0, z: -9 }, { x: 0, z: 9 },
];
const SOC_MODELS = ['sufa', 'hilux', 'hummer', 'picanto', 'van'];
const socWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const socClamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));

const SoccerGame = {
  id: 'soccer', name: 'כדורגל סופות', icon: '⚽',
  desc: 'שניים על שניים במכוניות של המירוץ, כדור ענק, קפיצות וטורבו — ו{@hamalist} בקריינות.',
  cover: 'assets/arcade/cover_soccer.jpg', solo: true, online: true, minOnline: 2,
  LEN: 180, WIN: 5,
  ballCam: true,

  // ---------- the world (built once) ----------
  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0xf2b06a);
    sc.fog = new THREE.Fog(0xf2c89a, 90, 300);
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.3, 700);
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
    // Each goal's box painted in its team's color: blue defends −x, red +x.
    for (const sx of [-1, 1]) {
      const box = new THREE.Mesh(new THREE.PlaneGeometry(7, SOC_GOAL * 2 + 5), new THREE.MeshBasicMaterial({ color: sx < 0 ? 0x2f7fe0 : 0xd8261f, transparent: true, opacity: 0.22, depthWrite: false }));
      box.rotation.x = -Math.PI / 2; box.position.set(sx * (SOC_L - 3.5), 0.03, 0); sc.add(box);
    }
    // Sandbag walls all round with the corners cut, camo nets on poles above them (the ball
    // bounces off those too), gaps for the goals.
    const bag = new THREE.MeshStandardMaterial({ color: 0xc8b07a, roughness: 1 });
    const netTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = 'rgba(70,82,40,.95)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    const pole = new THREE.MeshStandardMaterial({ color: 0x4b5a2a, roughness: 0.9 });
    const NET_H = 8;
    const wall = (x, z, len, rot, y0 = 0, net = true) => {
      const g = new THREE.Group();
      if (!y0) { const m = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 1.4), bag); m.position.y = 0.7; m.castShadow = m.receiveShadow = true; g.add(m); }
      if (net) {
        const t = netTex.clone(); t.needsUpdate = true; t.repeat.set(len / 1.6, (NET_H - 1.4 - y0) / 1.6);
        const n = new THREE.Mesh(new THREE.PlaneGeometry(len, NET_H - 1.4 - y0), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
        n.position.y = (NET_H + 1.4 + y0) / 2; g.add(n);
        for (let i = 0; i <= Math.round(len / 7); i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, NET_H, 6), pole); p.position.set(-len / 2 + i * len / Math.round(len / 7), NET_H / 2, 0); g.add(p); }
      }
      g.position.set(x, 0, z); g.rotation.y = rot; sc.add(g);
    };
    const longLen = SOC_L * 2 - SOC_CUT * 2;
    wall(0, -SOC_W - 0.7, longLen, 0); wall(0, SOC_W + 0.7, longLen, 0);
    for (const sx of [-1, 1]) {
      const len = SOC_W - SOC_GOAL - SOC_CUT;
      wall(sx * (SOC_L + 0.7), -(SOC_GOAL + len / 2), len, Math.PI / 2); wall(sx * (SOC_L + 0.7), SOC_GOAL + len / 2, len, Math.PI / 2);
      wall(sx * (SOC_L + 0.7), 0, SOC_GOAL * 2, Math.PI / 2, SOC_GH - 1.4); // the net over the goal
      for (const sz of [-1, 1]) wall(sx * (SOC_L - SOC_CUT / 2 + 0.5), sz * (SOC_W - SOC_CUT / 2 + 0.5), SOC_CUT * Math.SQRT2, -Math.atan2(sz, -sx) + Math.PI / 2);
    }
    // Flags along the walls.
    for (let i = 0; i < 10; i++) { const f = Scene3D.label('🇮🇱', { bg: 'rgba(0,0,0,0)', size: 1.2 }); f.position.set(-SOC_L + SOC_CUT + i * (longLen / 9), NET_H + 0.6, i % 2 ? SOC_W + 1 : -SOC_W - 1); sc.add(f); }
    // The ball: white with black patches, big, its shadow and a ring on the ground under it.
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d'); g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#1a1a1a'; for (let i = 0; i < 12; i++) { const x = (i % 6) * 44 + (i > 5 ? 22 : 0), y = i > 5 ? 90 : 34; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } g.fill(); }
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(SOC_R, 28, 18), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.45, emissive: 0xffe0a0, emissiveIntensity: 0 }));
    this.ball.castShadow = true; sc.add(this.ball);
    this.soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.soft, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.04; sc.add(this.shadow);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.05; sc.add(this.ring);
    // Boost pads.
    this.pads = SOC_PADS.map(p => {
      const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(p.big ? 1.6 : 0.95, 24), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.85, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; grp.add(disc);
      let orb = null;
      if (p.big) { orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc23c })); orb.position.y = 1.2; grp.add(orb); }
      sc.add(grp);
      return { ...p, disc, orb, t: 0 };
    });
    // Effects: a pool of soft puffs, the goal's flash and shockwave.
    this.pool = [];
    for (let i = 0; i < 180; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, transparent: true, depthWrite: false })); m.visible = false; sc.add(m); this.pool.push({ m, t: 1, life: 1, s: 1, vy: 0 }); }
    this.poolI = 0;
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flash.visible = false; sc.add(this.flash);
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.wave.rotation.x = -Math.PI / 2; this.wave.position.y = 0.2; this.wave.visible = false; sc.add(this.wave);
    this.goals = [];
    this.camLook = new THREE.Vector3();
    // C switches the camera (a key event, so even a quick tap counts).
    document.addEventListener('keydown', (e) => { if (Arcade.active === this && e.code === 'KeyC' && !e.repeat && e.target.tagName !== 'INPUT') this.toggleCam(); });
  },
  addGoals() {
    for (const g of this.goals) this.scene.remove(g);
    this.goals = [];
    for (const sx of [-1, 1]) {
      const m = Assets.model('arc_goal', { size: [SOC_GD, SOC_GH + 0.3, SOC_GOAL * 2 + 0.8], rotY: Math.PI / 2 });
      const g = new THREE.Group();
      if (m) g.add(m);
      else { const net = new THREE.Mesh(new THREE.BoxGeometry(SOC_GD, SOC_GH, SOC_GOAL * 2), new THREE.MeshStandardMaterial({ color: 0x4b5a2a, transparent: true, opacity: 0.6 })); net.position.y = SOC_GH / 2; g.add(net); }
      g.position.set(sx * (SOC_L + SOC_GD / 2), 0, 0); g.rotation.y = sx > 0 ? Math.PI : 0;
      this.scene.add(g); this.goals.push(g);
    }
  },

  // ---------- a match ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    // A wider view on a phone's short screen.
    this.camera.fov = G.touch ? 72 : 66; this.camera.updateProjectionMatrix();
    this.clear();
    this.addGoals();
    if (!Assets.has('arc_goal')) Arcade.loadModels(['arc_goal']).then(() => { if (this.ctx === ctx) this.addGoals(); });
    Race.loadModels().then(() => { if (this.ctx === ctx) for (const c of this.cars) this.dress(c); });
    const rnd = Arcade.rng(ctx.seed);
    this.host = ctx.solo || !!(ctx.net && ctx.net.host);
    const players = ctx.solo
      ? [{ who: 'me', name: G.profile.name, isMe: true }]
      : ctx.players.slice(0, 6).map(p => ({ who: p.isMe ? (Multi.as || 'me') : p.who, name: p.name, isMe: p.isMe, peer: p.peer }));
    // Teams: blue (attacking +x) and red, alternating in order; then bots from the platoon fill
    // both teams up to two each (the same bots on every phone: picked from the shared seed).
    const team = players.map((p, i) => (ctx.solo ? 0 : i % 2));
    const want = Math.max(2, ...[0, 1].map(t => team.filter(x => x === t).length));
    const fill = [0, 1].flatMap(t => Array(want - team.filter(x => x === t).length).fill(t));
    const pool = ROSTER.people.filter(p => p.map === 'netivot' && p.id.startsWith('p_') && !players.some(q => q.who === p.id)).map(p => p.id).sort();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const all = [...players.map((p, i) => ({ ...p, team: team[i] })), ...fill.map((t, i) => ({ who: pool[i % Math.max(1, pool.length)] || 'p_bot' + i, name: fmt(`{@${pool[i % Math.max(1, pool.length)]}}`), bot: true, team: t }))];
    this.cars = all.map((p, i) => {
      const c = { ...p, idx: i, model: SOC_MODELS[i % SOC_MODELS.length], x: 0, z: 0, y: 0, a: 0, vx: 0, vz: 0, vy: 0, steer: 0, boost: 34, goals: 0, skill: p.bot ? 0.86 + rnd() * 0.07 : 1, role: 'attack' };
      // Bots run on the host; on a guest's phone they (and the other players) follow the network.
      c.net = !!p.peer || (!!p.bot && !this.host);
      c.obj = this.makeCar(c);
      return c;
    });
    this.me = this.cars.find(c => c.isMe);
    this.score = [0, 0]; this.t = 0; this.ot = false; this.started = false; this.over = false; this.lineT = 4; this.ko = 0;
    this.slowT = 0; this.celebrate = 0; this.hitSeq = 0; this.hitOut = null; this.hitHold = 0; this.ack = null; this.hostSeen = performance.now(); this.lastMin = false;
    this.jumpReq = false; this.tb = { boost: false, rev: false }; this.emptySaid = false;
    for (const p of this.pads) p.t = 0;
    this.kickoff(true);
    this.ui();
    Arcade.buttons({ act: false, run: false });
    const u = $('#arcade'); if (u) u.classList.add('soc');
    Arcade.panel(`<img class="ar-banner" src="${this.cover}" alt=""><h2>⚽ כדורגל סופות</h2>
      <p class="ar-sub">את[ה/] בקבוצה ה${this.me.team === 0 ? 'כחולה 🔵 — תוקפים ימינה, לשער האדום ➡️' : 'אדומה 🔴 — תוקפים שמאלה, לשער הכחול ⬅️'}. ${this.LEN / 60} דקות או ${this.WIN} שערים.</p>
      <p class="ar-sub sc-how">${G.touch
        ? '🕹️ ג\'ויסטיק — [סע/סעי] לאן שמצביעים · ⤴️ קפיצה (עוד פעם באוויר — זינוק לכדור!) · 🚀 טורבו · ⏪ רוורס (עם היגוי — סיבוב בלם) · 🎥 מצלמה'
        : '⬆️⬇️ / W S — גז ורוורס · ⬅️➡️ / A D — היגוי · רווח — קפיצה (עוד פעם באוויר — זינוק לכדור!) · Shift / E — טורבו · X — בלם יד · C — מצלמת כדור'}</p>
      <p class="ar-sub">🟠 כריות כתומות ממלאות טורבו. [סע/סעי] לתוך הכדור — כמה שיותר מהר, ככה הוא עף יותר רחוק.</p>`);
    Sound.music('boss');
    Arcade.countdown(performance.now() + (ctx.solo ? 5200 : 3600), () => { Arcade.panel(''); this.started = true; Sound.whistle(); this.line('kickoff', true); }, '⚽!');
  },
  clear() {
    for (const c of this.cars || []) this.scene.remove(c.obj.root);
    for (const f of this.pool || []) { f.m.visible = false; f.t = f.life; }
    if (this.flash) { this.flash.visible = false; this.wave.visible = false; }
    this.cars = [];
  },
  makeCar(c) {
    const root = new THREE.Group(), tilt = new THREE.Group(), body = new THREE.Group();
    // The tilt group turns about the car's middle (for flips); the body sits inside it.
    tilt.position.y = 0.8; body.position.y = -0.8;
    root.add(tilt); tilt.add(body); this.scene.add(root);
    const col = c.team === 0 ? 0x2f7fe0 : 0xd8261f;
    let flag = null;
    if (!c.isMe) {
      flag = Scene3D.label(`${c.team === 0 ? '🔵' : '🔴'} ${c.name}`, { bg: c.team === 0 ? 'rgba(47,127,224,.92)' : 'rgba(216,38,31,.92)', size: 0.7 });
      flag.position.y = 3.2; root.add(flag);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, c.isMe ? 2.75 : 2.55, 32), new THREE.MeshBasicMaterial({ color: c.isMe ? 0xffd23f : col, transparent: true, opacity: c.isMe ? 0.85 : 0.6, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; root.add(ring);
    // A team flag on an antenna at the back.
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    ant.position.set(-SOC_CAR.hl + 0.5, 2.2, 0.55); tilt.add(ant);
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    pennant.position.set(-SOC_CAR.hl + 0.05, 2.7, 0.55); tilt.add(pennant);
    // Boost flames out of the back.
    const flames = [];
    for (const s of [-0.45, 0.45]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 10), new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.85, depthWrite: false }));
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffe066, depthWrite: false }));
      core.position.y = 0.2; f.add(core);
      f.rotation.z = Math.PI / 2; f.position.set(-SOC_CAR.hl - 0.75, -0.15, s); f.visible = false; tilt.add(f); flames.push(f);
    }
    const o = { root, tilt, body, flames, pennant, flag };
    c.obj = o;
    this.dress(c);
    return o;
  },
  dress(c) {
    const { body } = c.obj;
    while (body.children.length) body.remove(body.children[0]);
    const m = Assets.model('car_' + c.model, { length: SOC_CAR.len, rotY: Math.PI / 2 });
    if (m) body.add(m);
    else { const b = new THREE.Mesh(new THREE.BoxGeometry(SOC_CAR.len, 1.4, 2.2), new THREE.MeshStandardMaterial({ color: c.team ? 0xd8261f : 0x2f7fe0 })); b.position.y = 0.9; body.add(b); }
  },
  // Everyone to their half, facing the ball; the ball to the middle; a countdown (but not
  // before the first, which has its own).
  kickoff(first = false) {
    this.b = { x: 0, y: SOC_R, z: 0, vx: 0, vy: 0, vz: 0 };
    this.ball.position.set(0, SOC_R, 0);
    // Diagonal spots, the same distance from the ball for both teams.
    const spots = [[14, 5], [22, -8], [25, 9]];
    for (const t of [0, 1]) this.cars.filter(c => c.team === t).forEach((c, k) => {
      const s = t === 0 ? -1 : 1, [sx, sz] = spots[k % spots.length];
      c.x = s * sx; c.z = s * sz * (k < 3 ? 1 : -1); c.y = 0; c.a = Math.atan2(-c.z, -c.x);
      c.vx = c.vz = c.vy = 0; c.steer = 0; c.boost = 34; c.touchAt = null; c.rev = 0; c.stuckT = 0; c.kickT = 0; c.boosting = false; c.canDodge = 0; c.dodgeT = 0; c.flip = null; c.jumpReq = false;
      c.role = k === 0 ? 'attack' : 'support'; c.react = 0.15 + Math.random() * 0.45;
      c.nx = c.x; c.nz = c.z; c.na = c.a;
    });
    this.lastTouch = null; this.camSnap = true; this.stillT = 0; this.roleT = 0;
    if (first) { this.frozen = false; return; }
    this.frozen = true;
    Arcade.countdown(performance.now() + 3000, () => { this.frozen = false; Sound.whistle(); }, '⚽!');
  },

  // ---------- each frame ----------
  update(dt) {
    // Slow motion for a moment after a goal.
    if (this.slowT > 0) this.slowT -= dt;
    const ts = this.slowT > 0 ? (this.slowT < 0.3 ? 0.3 + (0.3 - this.slowT) * 2.3 : 0.3) : 1, sdt = dt * ts;
    const drive = this.started && !this.over && !this.frozen;
    const clock = drive && this.celebrate <= 0;
    if (clock) {
      this.t += dt;
      if (this.host && this.t >= this.LEN) {
        if (this.score[0] === this.score[1]) { if (!this.ot) { this.ot = true; Arcade.big('⏱️ הארכה! גול זהב', 2000); Sound.horn(); this.line('ot', true); } }
        else this.finish();
      }
      if (!this.lastMin && this.LEN - this.t < 60 && this.LEN - this.t > 50) { this.lastMin = true; this.line('last', true); }
    }
    if (this.celebrate > 0) {
      this.celebrate -= dt;
      if (this.celebrate <= 0 && !this.over && (this.host || this.hostKo == null)) { if (this.host) this.ko++; this.kickoff(); }
    }
    // Input: mine from the keys / the phone, the bots' from their heads.
    if (this.host && drive) { this.roleT -= dt; if (this.roleT <= 0) { this.roleT = 0.35; this.roles(); } }
    if (!drive) this.jumpReq = false;
    for (const c of this.cars) {
      if (c.net) { this.remote(c, dt); continue; }
      c.inp = !drive ? { steer: 0, thr: 0 } : c.isMe ? this.input() : this.bot(c, sdt);
    }
    // The world in small steps: the cars, then the ball (on the host; a guest plays it ahead
    // only against its own car, and the host's ball pulls it back in line).
    const n = Math.max(1, Math.ceil(sdt / (1 / 90))), h = sdt / n;
    for (let i = 0; i < n; i++) {
      for (const c of this.cars) if (!c.net) this.moveCar(c, c.inp, h, i === 0);
      this.carsBump();
      if (this.started && !this.frozen) this.ballStep(h);
    }
    if (!this.host) this.followHost(dt);
    this.padsUpdate(dt);
    this.lineT -= dt;
    this.animate(dt, sdt);
    this.hud();
    if (this.me && !this.over) Sound.engine(Math.min(1, Math.hypot(this.me.vx, this.me.vz) / SOC_CAR.boostTop) * 0.9 + (this.me.boosting ? 0.1 : 0));
    else Sound.engine(null);
    if (this.over && this.resultsAt && performance.now() > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  // Your car: keys, or the phone's joystick (push it where you want to go on the screen) and buttons.
  input() {
    const k = G.keys, st = G.stick || { x: 0, y: 0 }, key = (...c) => (c.some(x => k.has(x)) ? 1 : 0), c = this.me;
    let steer = key('ArrowRight', 'KeyD') - key('ArrowLeft', 'KeyA');
    let thr = key('ArrowUp', 'KeyW') - key('ArrowDown', 'KeyS');
    const sx = st.x || 0, sy = st.y || 0, m = Math.hypot(sx, sy);
    if (this.tb.rev) { thr = -1; steer = socClamp(steer + sx * 1.4); }
    else if (m > 0.15 && !steer && !thr) {
      const want = (this.camYaw == null ? c.a : this.camYaw) + Math.atan2(sx, -sy), da = socWrap(want - c.a);
      steer = socClamp(da * 2.4);
      thr = Math.min(1, m * 1.3) * (Math.abs(da) > 2.2 ? 0.75 : 1);
    }
    const jump = this.jumpReq; this.jumpReq = false;
    return { steer, thr, boost: !!(key('ShiftLeft', 'ShiftRight', 'KeyE') || this.tb.boost), hb: !!key('KeyX'), jump };
  },
  // Space / Enter (E is the boost): a jump, or in the air a dodge.
  act() { if (G.keys.has('Space') || G.keys.has('Enter')) this.jumpReq = true; },
  toggleCam() {
    this.ballCam = !this.ballCam; this.camSnap = false;
    Sound.click();
    const b = $('#arcade .sc-cam'); if (b) b.innerHTML = this.ballCam ? '🎥 <small>כדור</small>' : '🚗 <small>רכב</small>';
    UI.toast(this.ballCam ? '🎥 מצלמת כדור: [אתה/את] והכדור תמיד בתמונה' : '🚗 מצלמה מאחורי הרכב');
  },

  // One car, one small step: throttle, brakes, steering (sliding with the handbrake), jumps and
  // dodges, the walls.
  moveCar(c, inp, dt, first) {
    const K = SOC_CAR;
    let ca = Math.cos(c.a), sa = Math.sin(c.a);
    let vf = c.vx * ca + c.vz * sa, vl = -c.vx * sa + c.vz * ca;
    c.steer += ((inp.steer || 0) - c.steer) * Math.min(1, dt * 14);
    c.boosting = !!inp.boost && c.boost > 0 && !this.over;
    if (c.boosting) { c.boost = Math.max(0, c.boost - 33 * dt); if (c.boost <= 0 && c.isMe && !this.emptySaid) { this.emptySaid = true; this.line('empty'); } }
    if (c.isMe && c.boost > 10) this.emptySaid = false;
    c.boost = Math.min(100, c.boost + 2.5 * dt);
    c.kickT = Math.max(0, (c.kickT || 0) - dt); c.dodgeT = Math.max(0, (c.dodgeT || 0) - dt);
    const jump = first && inp.jump;
    const ground = c.y <= 0.001;
    const top = K.top * (c.skill || 1);
    if (ground) {
      const thr = inp.thr || 0;
      if (thr > 0.05) {
        if (vf < -0.5) vf = Math.min(0, vf + 45 * dt);
        else if (vf < top) vf += (K.acc * (1 - Math.max(0, vf) / top) + 3) * thr * dt;
      } else if (thr < -0.05) {
        if (vf > 0.5) vf = Math.max(0, vf - 42 * dt * -thr);
        else vf = Math.max(-K.rev, vf - 20 * dt * -thr);
      } else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
      if (c.boosting) vf = Math.min(K.boostTop * (c.skill || 1), vf + 24 * dt);
      else if (vf > top) vf -= (vf - top) * 1.2 * dt;
      // Steering: sharp at low speed, a bit calmer flat out; the handbrake (or braking while
      // turning hard at speed) turns harder and lets the back slide out.
      const sp = Math.abs(vf);
      const hb = !!inp.hb || (thr < -0.3 && vf > 9 && Math.abs(c.steer) > 0.5);
      let yaw = 3.8 * Math.min(1, sp / 5) * (1 - 0.3 * Math.min(1, sp / 30));
      if (hb) yaw *= 1.6;
      c.a += c.steer * yaw * (vf < -0.5 ? -1 : 1) * dt;
      vl *= Math.exp(-(hb ? 2.2 : 14) * dt);
      if (hb && sp > 3) vf -= Math.sign(vf) * Math.min(sp, 8 * dt);
      c.drift = hb && sp > 9;
      ca = Math.cos(c.a); sa = Math.sin(c.a);
      c.vx = ca * vf - sa * vl; c.vz = sa * vf + ca * vl;
      if (jump) { c.vy = K.jump; c.canDodge = 1.3; c.dodged = false; if (c.isMe) Sound.synth.tone(300, 0.12, 'triangle', 0.08, 520); this.puff(c.x, 0.3, c.z, 0xe6d2a6, 2.2, 0.6, 0.5); }
    } else {
      // In the air: turn a little, boost pushes forward, a second jump is a dodge.
      c.drift = false;
      c.a += c.steer * 2.6 * dt;
      if (c.boosting) { c.vx += Math.cos(c.a) * 18 * dt; c.vz += Math.sin(c.a) * 18 * dt; }
      c.canDodge -= dt;
      if (jump && c.canDodge > 0 && !c.dodged) {
        let f = inp.thr || 0, s = inp.steer || 0;
        if (Math.hypot(f, s) < 0.3) { f = 1; s = 0; }
        const l = Math.hypot(f, s); f /= l; s /= l;
        const dx = Math.cos(c.a) * f - Math.sin(c.a) * s, dz = Math.sin(c.a) * f + Math.cos(c.a) * s;
        c.vx += dx * 12; c.vz += dz * 12; c.vy = Math.max(c.vy, 3);
        c.dodged = true; c.dodgeT = 0.55; c.flip = { f, s, t: 0 };
        if (c.isMe) Sound.whoosh();
      }
    }
    c.vy -= K.grav * dt;
    c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt;
    if (c.y <= 0) {
      if (c.vy < -7) { this.puff(c.x, 0.3, c.z, 0xe6d2a6, 2, 0.6, 0.4); if (c.isMe) Sound.synth.noise(0.12, 0.15, 500); }
      c.y = 0; c.vy = 0; c.dodged = false;
    }
    // The walls: sandbags all round with the corners cut; the goal mouths are open (a car
    // can drive into a goal, and is kept between its side nets).
    const r = K.r, ax = Math.abs(c.x), az = Math.abs(c.z), gz = SOC_GOAL - 1.2, cxs = Math.sign(c.x) || 1, czs = Math.sign(c.z) || 1;
    if (ax > SOC_L) {
      // In a goal: its side nets and its back.
      if (az > gz) { c.z = czs * gz; this.carWall(c, 0, -czs); }
      if (ax > SOC_L + SOC_GD - 1.2) { c.x = cxs * (SOC_L + SOC_GD - 1.2); this.carWall(c, -cxs, 0); }
    } else if (ax > SOC_L - r && az > gz) {
      // The end wall (or the corner of a goal post): out the shorter way.
      if (ax - (SOC_L - r) < az - gz || az > SOC_GOAL + 0.5) { c.x = cxs * (SOC_L - r); this.carWall(c, -cxs, 0); }
      else { c.z = czs * gz; this.carWall(c, 0, -czs); }
    }
    if (Math.abs(c.z) > SOC_W - r) { const s = Math.sign(c.z); c.z = s * (SOC_W - r); this.carWall(c, 0, -s); }
    const sx = Math.sign(c.x) || 1, sz = Math.sign(c.z) || 1, lim = SOC_L + SOC_W - SOC_CUT - r * Math.SQRT2, e = sx * c.x + sz * c.z - lim;
    if (e > 0) { c.x -= sx * e / 2; c.z -= sz * e / 2; this.carWall(c, -sx / Math.SQRT2, -sz / Math.SQRT2); }
    if (c.flip) { c.flip.t += dt; if (c.flip.t > 0.55) c.flip = null; }
  },
  carWall(c, nx, nz) {
    const vn = c.vx * nx + c.vz * nz;
    if (vn < 0) { c.vx -= 1.3 * vn * nx; c.vz -= 1.3 * vn * nz; if (vn < -8) this.thud(c); }
  },
  thud(c) { if (c.isMe && !(c.bumpT > performance.now())) { c.bumpT = performance.now() + 400; Sound.bump(); if (Math.random() < 0.15) this.line('wall'); } },
  // Cars push each other apart; a hard hit throws the other car about.
  carsBump() {
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const A = this.cars[i], B = this.cars[j], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), r = SOC_CAR.r * 2;
      if (d >= r || d < 0.01 || Math.abs(A.y - B.y) > 1.6) continue;
      const nx = dx / d, nz = dz / d, o = (r - d) / (A.net || B.net ? 1 : 2);
      if (!A.net) { A.x -= nx * o; A.z -= nz * o; }
      if (!B.net) { B.x += nx * o; B.z += nz * o; }
      const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
      if (rel >= 0) continue;
      const j2 = -1.4 * rel / 2;
      if (!A.net) { A.vx -= nx * j2; A.vz -= nz * j2; }
      if (!B.net) { B.vx += nx * j2; B.vz += nz * j2; }
      if (-rel > 16) {
        const slow = Math.hypot(A.vx, A.vz) < Math.hypot(B.vx, B.vz) ? A : B;
        if (!slow.net && slow.y <= 0) slow.vy = 5;
        this.puff((A.x + B.x) / 2, 1, (A.z + B.z) / 2, 0xffffff, 2.4, 0.5, 0.6);
      }
      if ((A.isMe || B.isMe) && -rel > 5 && !(this.bumpAt > performance.now())) { this.bumpAt = performance.now() + 350; Sound.bump(); if (-rel > 18) { G.shake = Math.max(G.shake || 0, 0.25); if (Math.random() < 0.3) this.line('bump'); } }
    }
  },

  // ---------- the ball ----------
  ballStep(h) {
    const b = this.b, R = SOC_R;
    b.vy -= 18 * h;
    b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    const dr = Math.exp(-0.05 * h); b.vx *= dr; b.vz *= dr;
    if (b.y < R) {
      b.y = R;
      if (b.vy < -2.5) { const imp = -b.vy; b.vy = imp * 0.62; if (imp > 7) { this.puff(b.x, 0.4, b.z, 0xe6d2a6, 1.4 + imp * 0.08, 0.7, 0.6); this.bounce(imp); } }
      else b.vy = 0;
      const fr = Math.exp(-0.4 * h); b.vx *= fr; b.vz *= fr;
    }
    if (b.y > SOC_CEIL - R) { b.y = SOC_CEIL - R; if (b.vy > 0) b.vy *= -0.6; }
    this.walls();
    // Into a goal? (After a goal, the ball just rolls about in the net.)
    if (this.host && this.celebrate <= 0 && !this.over && Math.abs(b.x) > SOC_L + R * 0.8 && Math.abs(b.z) < SOC_GOAL && b.y < SOC_GH) { this.goal(b.x > 0 ? 0 : 1); return; }
    for (const c of this.cars) {
      if (!this.host && c !== this.me) continue;
      if (this.carBall(c) && this.walls()) {
        // Pinned against a wall: the wall wins, the car is pushed back and the ball squirts up.
        if (!c.net) { const dx = b.x - c.x, dz = b.z - c.z, d = Math.hypot(dx, dz) || 1; c.x -= dx / d * 0.3; c.z -= dz / d * 0.3; c.vx *= 0.6; c.vz *= 0.6; }
        b.vy = Math.max(b.vy, 8);
      }
    }
    const v = Math.hypot(b.vx, b.vz); if (v > 44) { b.vx *= 44 / v; b.vz *= 44 / v; }
    // Stuck by a wall or in a corner for two seconds: a nudge back toward the middle.
    const nearWall = Math.abs(b.z) > SOC_W - R - 1.5 || (Math.abs(b.x) > SOC_L - R - 1.5 && Math.abs(b.x) < SOC_L) || Math.abs(b.x) + Math.abs(b.z) > SOC_L + SOC_W - SOC_CUT - R * Math.SQRT2 - 2;
    if (this.host && nearWall && v < 3 && Math.abs(b.vy) < 3) this.stillT += h; else this.stillT = 0;
    if (this.stillT > 2) {
      this.stillT = 0;
      const l = Math.hypot(b.x, b.z) || 1;
      b.vx = -b.x / l * 9; b.vz = -b.z / l * 9; b.vy = 8;
      this.puff(b.x, b.y, b.z, 0xffffff, 3, 0.6, 0.5); this.bounce(10);
    }
  },
  // The car as a box (it turns with the car, jumps with it): the closest point on it to the
  // ball. A hit sends the ball along the hit, more the faster the car came in (and a dodge
  // hits hardest), nudged the way the car points so you can aim. True if they touched.
  carBall(c) {
    const b = this.b, K = SOC_CAR, R = SOC_R, ca = Math.cos(c.a), sa = Math.sin(c.a);
    const dx = b.x - c.x, dz = b.z - c.z, dy = b.y - (c.y + K.h / 2);
    if (dx * dx + dz * dz > 30 || Math.abs(dy) > K.h / 2 + R) return false;
    const lf = dx * ca + dz * sa, ls = -dx * sa + dz * ca;
    const qf = socClamp(lf, -K.hl, K.hl), qs = socClamp(ls, -K.hw, K.hw), qy = socClamp(dy, -K.h / 2, K.h / 2);
    let nf = lf - qf, ns = ls - qs, ny = dy - qy, d = Math.hypot(nf, ns, ny), pen;
    if (d >= R) return false;
    if (d < 1e-4) {
      const pf = K.hl - Math.abs(lf), ps = K.hw - Math.abs(ls), py = K.h / 2 - Math.abs(dy);
      nf = ns = ny = 0;
      if (py <= pf && py <= ps) { ny = Math.sign(dy) || 1; pen = R + py; } else if (pf < ps) { nf = Math.sign(lf) || 1; pen = R + pf; } else { ns = Math.sign(ls) || 1; pen = R + ps; }
    } else { nf /= d; ns /= d; ny /= d; pen = R - d; }
    const nx = nf * ca - ns * sa, nz = nf * sa + ns * ca;
    b.x += nx * pen; b.y += ny * pen; b.z += nz * pen;
    const rel = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny + (b.vz - c.vz) * nz;
    if (rel >= 0) return true;
    const fresh = !(c.kickT > 0);
    c.kickT = 0.2;
    const danger = this.danger();
    const j = -1.35 * rel;
    b.vx += j * nx; b.vy += j * ny; b.vz += j * nz;
    if (!fresh) return true;
    // The shot's extra kick comes from the car's own speed into the ball (so a parked car is a
    // wall, not a cannon), more with a dodge.
    const pow = -rel, into = Math.max(0, c.vx * nx + c.vy * ny + c.vz * nz);
    const ex = Math.min(12, into * 0.4) + (c.dodgeT > 0 ? 9 : 0) + (c.boosting && into > 5 ? 2 : 0);
    let hx = nx, hz = nz;
    if (nf > 0.3) { hx = nx * 0.6 + ca * 0.4; hz = nz * 0.6 + sa * 0.4; const l = Math.hypot(hx, hz) || 1; hx /= l; hz /= l; }
    b.vx += hx * ex; b.vz += hz * ex; b.vy += ex * 0.35 + 1.5;
    if (!c.net) { c.vx -= nx * pow * 0.12; c.vz -= nz * pow * 0.12; }
    this.touched(c, pow + ex, danger);
    return true;
  },
  // A touch: who touched it last, the sound and the shake by how hard, commentary; a guest tells
  // the host about its own hits.
  touched(c, power, danger) {
    const b = this.b;
    this.lastTouch = c; c.touchAt = this.t;
    if (power > 6) {
      this.puff(b.x, b.y, b.z, 0xffffff, 1 + power * 0.04, 0.5, 0.3);
      if (c.isMe || this.ctx.solo || Math.hypot(c.x - this.me.x, c.z - this.me.z) < 30) { Sound.synth.noise(0.14, Math.min(0.5, 0.12 + power * 0.012), 700 + power * 15); Sound.synth.tone(110 + power * 3, 0.1, 'sine', Math.min(0.2, power * 0.006), 60); }
      if (c.isMe && power > 18) G.shake = Math.max(G.shake || 0, Math.min(0.5, power * 0.012));
      this.ballGlow = Math.min(1, power / 30);
    }
    if (danger !== null && danger === c.team && !this.danger()) this.line('save');
    else if (c.y > 1.2 && power > 10) this.line('air');
    else if (power > 22) this.line('kick');
    if (c === this.me && !this.host) {
      this.hitSeq++;
      this.hitOut = [this.hitSeq, ...[b.x, b.y, b.z, b.vx, b.vy, b.vz].map(n => Math.round(n * 10) / 10)];
      this.hitHold = 1.2;
    }
  },
  // Which team's goal the ball is about to go into (in the next second or so), or null.
  danger() {
    const b = this.b;
    if (Math.abs(b.vx) < 6) return null;
    const s = Math.sign(b.vx), tt = (s * SOC_L - b.x) / b.vx;
    if (tt < 0 || tt > 1.2) return null;
    const z = b.z + b.vz * tt;
    return Math.abs(z) < SOC_GOAL + 0.5 ? (s > 0 ? 1 : 0) : null;
  },
  // Keeps the ball inside: the side walls, the cut corners, the end walls beside and above the
  // goals, the posts and the bar, and inside a goal its side nets, roof and back. True if it
  // touched anything.
  walls() {
    const b = this.b, R = SOC_R, sx = Math.sign(b.x) || 1, sz = Math.sign(b.z) || 1;
    let hit = false;
    const reflect = (nx, ny, nz, e) => {
      const vn = b.vx * nx + b.vy * ny + b.vz * nz;
      if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz; if (vn < -5) this.bounce(-vn); }
      hit = true;
    };
    if (Math.abs(b.z) > SOC_W - R) { b.z = sz * (SOC_W - R); reflect(0, 0, -sz, 0.75); }
    const lim = SOC_L + SOC_W - SOC_CUT - R * Math.SQRT2, e = sx * b.x + sz * b.z - lim;
    if (e > 0) { b.x -= sx * e / 2; b.z -= sz * e / 2; reflect(-sx / Math.SQRT2, 0, -sz / Math.SQRT2, 0.75); }
    // The posts and the bar.
    if (b.y < SOC_GH + R) for (const pz of [-SOC_GOAL, SOC_GOAL]) {
      const dx = b.x - sx * SOC_L, dz = b.z - pz, d = Math.hypot(dx, dz), rr = R + 0.3;
      if (d < rr && d > 0.001) { b.x = sx * SOC_L + dx / d * rr; b.z = pz + dz / d * rr; const vn = b.vx * dx / d + b.vz * dz / d; reflect(dx / d, 0, dz / d, 0.7); if (vn < -10) this.line('post'); }
    }
    if (Math.abs(b.z) < SOC_GOAL) {
      const dx = b.x - sx * SOC_L, dy = b.y - SOC_GH, d = Math.hypot(dx, dy), rr = R + 0.3;
      if (d < rr && d > 0.001) { b.x = sx * SOC_L + dx / d * rr; b.y = SOC_GH + dy / d * rr; const vn = b.vx * dx / d + b.vy * dy / d; reflect(dx / d, dy / d, 0, 0.7); if (vn < -10) this.line('post'); }
    }
    if (Math.abs(b.x) < SOC_L) {
      const open = Math.abs(b.z) < SOC_GOAL && b.y < SOC_GH;
      if (Math.abs(b.x) > SOC_L - R && !open) { b.x = sx * (SOC_L - R); reflect(-sx, 0, 0, 0.75); }
    } else {
      // In a goal: its side nets, its roof, its back.
      if (Math.abs(b.z) > SOC_GOAL - R) { b.z = sz * (SOC_GOAL - R); reflect(0, 0, -sz, 0.3); }
      if (b.y > SOC_GH - R) { b.y = SOC_GH - R; reflect(0, -1, 0, 0.3); }
      if (Math.abs(b.x) > SOC_L + SOC_GD - R) { b.x = sx * (SOC_L + SOC_GD - R); reflect(-sx, 0, 0, 0.25); }
    }
    return hit;
  },
  bounce(v) {
    if (this.bounceAt > performance.now()) return;
    this.bounceAt = performance.now() + 90;
    Sound.synth.tone(120 + Math.random() * 30, 0.1, 'sine', Math.min(0.12, 0.03 + v * 0.004), 70);
  },
  goal(team) {
    this.score[team]++;
    // The goal is the scorers' last touch in the last few seconds (a keeper who only got a
    // touch on it on the way in didn't score an own goal); otherwise it's an own goal.
    const lt = this.lastTouch, mine = this.cars.filter(c => c.team === team && c.touchAt != null && this.t - c.touchAt < 4).sort((a, b) => b.touchAt - a.touchAt)[0];
    const by = mine || lt, own = !mine && lt && lt.team !== team;
    this.lastTouch = by;
    if (by && !own) by.goals++;
    this.lastGoal = team; this.celebrate = 3; this.slowT = 1.5;
    this.goalFx(team, by, own);
    if (this.score[team] >= this.WIN || this.ot) this.finish();
  },
  // The goal: a flash in the scorers' color, a shockwave that throws the cars about, confetti,
  // the stands roar, a moment of slow motion.
  goalFx(team, by, own) {
    const b = this.b, col = team === 0 ? 0x4fa8ff : 0xff4f4a;
    Sound.boom(); Sound.fanfare(); Sound.horn(); Sound.synth.later(250, () => Sound.synth.noise(2, 0.2, 1400, 'bandpass'));
    Arcade.big(`⚽ גול! ${team === 0 ? '🔵' : '🔴'} ${this.score[0]}:${this.score[1]}`, 2400);
    Arcade.say(`${by ? `<b>${esc(by.name)}</b> · ` : ''}${fmt(pick(own ? SOC_LINES.own : SOC_LINES.goal))}`, null, 3200);
    this.flash.material.color.setHex(col); this.flash.position.set(b.x, b.y, b.z); this.flash.visible = true; this.flashT = 0;
    this.wave.material.color.setHex(col); this.wave.position.set(b.x, 0.2, b.z); this.wave.visible = true;
    for (let i = 0; i < 50; i++) this.puff(b.x + (Math.random() - 0.5) * 4, 1 + Math.random() * 5, b.z + (Math.random() - 0.5) * 8, [0xffd23f, col, 0xffffff, col][i % 4], 1.2 + Math.random(), 1.4, 2 + Math.random() * 4);
    for (const c of this.cars) {
      const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz);
      if (d > 16 || c.net) continue;
      const k = (16 - d) / 16 * 22;
      c.vx += dx / (d || 1) * k; c.vz += dz / (d || 1) * k; c.vy = Math.max(c.vy, k * 0.4);
    }
    G.shake = 0.7;
    this.lineT = 6;
  },
  finish() {
    if (this.over) return;
    this.over = true;
    Sound.whistle(); Sound.fanfare();
    const [b, r] = this.score, mine = this.me.team;
    setTimeout(() => { if (this.over && Arcade.active === this) Arcade.big(b === r ? '🤝 תיקו!' : (b > r ? 0 : 1) === mine ? '🏆 ניצחתם!' : '😩 הפסדתם', 2000); }, this.celebrate > 0 ? 1500 : 0);
    this.resultsAt = performance.now() + (this.celebrate > 0 ? 4200 : 3000);
  },
  results() {
    const [b, r] = this.score;
    const win = b === r ? -1 : b > r ? 0 : 1;
    const rows = [...this.cars].sort((x, y) => ((y.team === win) - (x.team === win)) || (y.goals - x.goals) || ((y.isMe ? 1 : 0) - (x.isMe ? 1 : 0)) * (win === -1 ? -1 : 1))
      .map(c => ({ name: `${c.team === 0 ? '🔵' : '🔴'} ${c.name}`, value: `${c.goals ? `${'⚽'.repeat(Math.min(5, c.goals))} · ` : ''}${this.score[c.team]}:${this.score[1 - c.team]}`, me: c.isMe }));
    const won = win === this.me.team;
    Arcade.results(`⚽ כדורגל סופות · ${b}:${r}`, rows, { sub: fmt(won ? '{@hamalist}: "אלופים!!! אני הולכת לספר לכל הבסיס!!! לכל הגדוד!!!"' : win === -1 ? '{@hamalist}: "תיקו!!! כולם ניצחו!!! ...או שכולם הפסידו? לא שמתי לב, דיברתי."' : '{@hamalist}: "היה משחק מטורף!!! ...מי ניצח? לא שמתי לב, דיברתי."'), img: 'assets/arcade/win_soccer.jpg', prize: won ? 10 : win === -1 ? 4 : 2 });
  },
  line(kind, force = false) {
    if (!force && this.lineT > 0) return;
    this.lineT = kind === 'kick' ? 9 : 6;
    // Not the same line twice in a row.
    const all = SOC_LINES[kind], last = (this.said = this.said || {})[kind], opts = all.length > 1 ? all.filter(l => l !== last) : all;
    const l = this.said[kind] = pick(opts);
    Arcade.say(fmt(l), null, 2600);
  },

  // ---------- the bots ----------
  // Who goes for the ball on each team: the one best placed (close, and behind the ball). When
  // that's a player, the bots on their team hang back to defend and wait for a pass.
  roles() {
    const b = this.b;
    for (const t of [0, 1]) {
      const dir = t === 0 ? 1 : -1, team = this.cars.filter(c => c.team === t);
      const cost = (c) => Math.hypot(b.x - c.x, b.z - c.z) + ((c.x - b.x) * dir > 1 ? 12 : 0) - (c.role === 'attack' ? 3 : 0);
      const best = team.reduce((a, c) => (cost(c) < cost(a) ? c : a), team[0]);
      for (const c of team) if (c.bot) c.role = c === best ? 'attack' : 'support';
    }
  },
  // An attacker gets behind the ball (on the line from where it wants the ball to go, through
  // the ball) and drives through it, jumping for high balls and dodging into it for a power
  // shot; from the wrong side it swings round the ball. A supporter guards the goal while the
  // ball is in our half and waits at the far post for a cross when it's in theirs. Anyone
  // stuck against a wall backs out.
  bot(c, dt) {
    const b = this.b, dir = c.team === 0 ? 1 : -1, gx = dir * SOC_L, ox = -gx, sk = c.skill || 0.9;
    const clampX = (x) => socClamp(x, -SOC_L + 2.5, SOC_L - 2.5), clampZ = (z) => socClamp(z, -SOC_W + 2.5, SOC_W - 2.5);
    const sp = Math.hypot(c.vx, c.vz);
    if (c.react > 0) { c.react -= dt; return { steer: 0, thr: 0 }; }
    if (c.rev > 0) { c.rev -= dt; return { steer: c.revSteer, thr: -1 }; }
    if (c.wantGo && sp < 2.5 && c.y <= 0) c.stuckT = (c.stuckT || 0) + dt; else c.stuckT = 0;
    if (c.stuckT > 0.7) { c.stuckT = 0; c.rev = 0.6 + Math.random() * 0.4; c.revSteer = Math.random() < 0.5 ? -1 : 1; return { steer: c.revSteer, thr: -1 }; }
    const toBall = Math.hypot(b.x - c.x, b.z - c.z);
    const lead = Math.min(0.9, toBall / 28);
    const px = clampX(b.x + b.vx * lead), pz = clampZ(b.z + b.vz * lead);
    const inOurHalf = (px - ox) * dir < SOC_L;
    let tx, tz, slow = false, hit = false, rush = false;
    if (c.role === 'support') {
      const threat = inOurHalf || this.danger() === c.team;
      if (threat) {
        // Between the ball and our goal; out to meet it when it comes close and we're goal-side.
        tx = ox + (px - ox) * 0.35; tz = pz * 0.4;
        rush = this.danger() === c.team;
        if (toBall < 11 && (c.x - b.x) * dir < -1) { tx = px; tz = pz; hit = true; }
        else slow = Math.hypot(tx - c.x, tz - c.z) < 3;
      } else {
        // In their half: at the far post for a cross, or back for boost when empty.
        const pad = c.boost < 25 && this.pads.filter(p => p.big && p.t <= 0 && (p.x - b.x) * dir < -6).sort((p, q) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z))[0];
        if (pad && Math.hypot(pad.x - c.x, pad.z - c.z) < 22) { tx = pad.x; tz = pad.z; }
        else { tx = (gx - px) * dir < 22 ? gx - dir * 9 : px - dir * 12; tz = (gx - px) * dir < 22 ? -Math.sign(pz || 1) * 4 : pz * 0.4; slow = Math.hypot(tx - c.x, tz - c.z) < 3; }
      }
    }
    if (c.role !== 'support' || hit) {
      // Aim: their goal (a bit off-center, by skill); from out wide near their goal with a
      // teammate waiting in front of it, a cross to them instead.
      if (!c.aimT || c.aimT < performance.now()) { c.aimT = performance.now() + 1500; c.aimZ = (Math.random() - 0.5) * 6 * (1.2 - sk); }
      let ax = gx, az = socClamp(pz, -3, 3) + c.aimZ;
      if (hit && c.role === 'support') { ax = gx; az = pz > 0 ? SOC_W : -SOC_W; } // a clearance, to the side
      const m2 = this.cars.find(o => o !== c && o.team === c.team);
      if (c.role === 'attack' && m2 && Math.abs(pz) > 8 && (gx - px) * dir < 20 && (m2.x - px) * dir > 5 && Math.abs(m2.z) < 8) {
        ax = m2.x + dir * 2; az = m2.z;
        if (toBall < 7 && !(c.passAt > performance.now())) { c.passAt = performance.now() + 8000; if (this.ctx.solo && m2.isMe) Arcade.say(fmt(pick(SOC_LINES.pass)), c.who, 1800); }
      }
      const ux0 = px - ax, uz0 = pz - az, ul = Math.hypot(ux0, uz0) || 1, ux = ux0 / ul, uz = uz0 / ul;
      const bx = px + ux * 3.8, bz = pz + uz * 3.8;
      const along = (c.x - px) * -ux + (c.z - pz) * -uz; // > 0: the car is between the ball and where it should go
      if (along > -1.5) {
        const side = (c.z - pz) * ux - (c.x - px) * uz >= 0 ? 1 : -1;
        tx = px + ux * 5 - uz * side * 6.5; tz = pz + uz * 5 + ux * side * 6.5;
        hit = false;
      } else if (Math.hypot(bx - c.x, bz - c.z) < 4.5 || (along < -2 && Math.abs((c.x - px) * uz - (c.z - pz) * ux) < 1.8)) { tx = px; tz = pz; hit = true; }
      else { tx = bx; tz = bz; hit = false; }
    }
    // Not going for the ball: keep out of its way (driving home through it scores for them).
    if (!hit) {
      const sx = tx - c.x, sz = tz - c.z, sl = Math.hypot(sx, sz) || 1, ex = sx / sl, ez = sz / sl;
      const tb = (b.x - c.x) * ex + (b.z - c.z) * ez, lat = (b.x - c.x) * -ez + (b.z - c.z) * ex;
      if (tb > 0 && tb < sl + 2 && Math.abs(lat) < 5.5) { const side = lat > 0 ? -1 : 1; tx = b.x + -ez * side * 7; tz = b.z + ex * side * 7; }
    }
    tx = clampX(tx); tz = clampZ(tz);
    const da = socWrap(Math.atan2(tz - c.z, tx - c.x) - c.a);
    const dist = Math.hypot(tx - c.x, tz - c.z), back = Math.abs(da) > 2.3 && dist < 7;
    let thr = back ? -1 : slow ? (dist > 1.5 ? 0.3 : 0) : Math.abs(da) > 1.4 ? 0.45 : 1;
    // About to run the ball into our own goal: brake.
    if (toBall < 8 && sp > 6) {
      const hx = c.vx / sp, hz = c.vz / sp, bx = (b.x - c.x) / toBall, bz = (b.z - c.z) / toBall;
      const gl = Math.hypot(ox - b.x, b.z) || 1, home = ((ox - b.x) * hx + -b.z * hz) / gl;
      if (hx * bx + hz * bz > 0.75 && home > 0.65) thr = -1;
    }
    c.wantGo = thr !== 0;
    // Boost when lined up for a hit or rushing home; jump for a high ball; dodge into it.
    const boost = c.boost > 12 && Math.abs(da) < 0.25 && ((hit && toBall > 5) || (rush && dist > 8));
    let jump = false;
    const ahead = Math.abs(socWrap(Math.atan2(b.z - c.z, b.x - c.x) - c.a)) < 0.45;
    if (c.y <= 0 && hit && ahead && b.y > 2.8 && b.y < 6 && toBall < 3 + sp * 0.22 && Math.random() < sk) jump = true;
    else if (c.y <= 0 && hit && ahead && b.y < 2.4 && toBall < 6.5 && sp > 13 && Math.random() < dt * 3 * sk) jump = true;
    else if (c.y > 0.4 && !c.dodged && c.canDodge > 0 && toBall < 4.5 && ahead) jump = true;
    return { steer: socClamp((back ? -da : da) * 2.6), thr, boost, jump };
  },

  // ---------- online ----------
  // Another player's car (or, on a guest's phone, a bot): from their latest state, carried on
  // at their speed between updates.
  remote(c, dt) {
    let s = null;
    if (c.peer) { const o = Arcade.others().find(x => x.peer === c.peer); s = o && o.s; }
    else { const h = Arcade.others().find(o => o.host), bots = h && h.s && h.s.bots, k = this.cars.filter(x => x.bot).indexOf(c); s = bots && bots[k] ? { x: bots[k][0], z: bots[k][1], a: bots[k][2], v: bots[k][3], y: bots[k][4], bt: bots[k][5] } : null; }
    const sig = s && s.x != null ? `${s.x},${s.z},${s.a},${s.v},${s.y},${s.h ? s.h[0] : ''}` : null;
    if (sig && c.hSeq == null && c.peer) c.hSeq = s.h ? s.h[0] : 0;
    if (sig && sig !== c.lastS) {
      c.lastS = sig;
      c.nx = +s.x || 0; c.nz = +s.z || 0; c.na = +s.a || 0; c.nv = +s.v || 0; c.ny = +s.y || 0;
      c.boosting = !!s.bt;
      if (s.h && Array.isArray(s.h) && this.host) this.hostHit(c, s.h);
    }
    if (c.nx == null) return;
    // Carry on along the last heading, and ease toward it.
    c.nx += Math.cos(c.na) * (c.nv || 0) * dt; c.nz += Math.sin(c.na) * (c.nv || 0) * dt;
    const k = Math.min(1, dt * 12), px = c.x, pz = c.z;
    c.x += (c.nx - c.x) * k; c.z += (c.nz - c.z) * k; c.y += ((c.ny || 0) - c.y) * k;
    c.a += socWrap(c.na - c.a) * k;
    c.vx = dt > 0 ? (c.x - px) / dt * 0.5 + Math.cos(c.a) * (c.nv || 0) * 0.5 : 0; c.vz = dt > 0 ? (c.z - pz) / dt * 0.5 + Math.sin(c.a) * (c.nv || 0) * 0.5 : 0; c.vy = 0;
  },
  // The host takes a guest's own hit as it was on their phone (if the ball is about there).
  hostHit(c, h) {
    if (h[0] === c.hSeq) return;
    c.hSeq = h[0];
    const b = this.b, [, x, y, z, vx, vy, vz] = h.map(Number);
    if (![x, y, z, vx, vy, vz].every(Number.isFinite) || Math.hypot(b.x - x, b.z - z) > 9 || this.celebrate > 0 || this.frozen) return;
    Object.assign(b, { x, y: Math.max(SOC_R, y), z, vx: socClamp(vx, -48, 48), vy: socClamp(vy, -30, 30), vz: socClamp(vz, -48, 48) });
    this.lastTouch = c; c.touchAt = this.t;
    this.ack = [c.idx, c.hSeq];
  },
  // A guest: the ball, the score, the clock and the kickoffs from the host.
  followHost(dt) {
    this.hitHold = Math.max(0, this.hitHold - dt);
    const h = Arcade.others().find(o => o.host), s = h && h.s;
    if (!s || !s.b) {
      if (this.started && !this.over && performance.now() - this.hostSeen > 9000) { UI.toast('המארח יצא מהמשחק', 'bad'); this.finish(); }
      return;
    }
    this.hostSeen = performance.now();
    const sig = s.b.join();
    if (sig !== this.lastHostS) { this.lastHostS = sig; this.hostAt = performance.now(); }
    const age = Math.min(0.3, (performance.now() - this.hostAt) / 1000) + 0.08;
    const [x, y, z, vx, vy, vz] = s.b.map(Number), b = this.b;
    const tx = socClamp(x + vx * age, -(SOC_L + SOC_GD - SOC_R), SOC_L + SOC_GD - SOC_R), ty = socClamp(y + vy * age - 9 * age * age, SOC_R, SOC_CEIL - SOC_R), tz = socClamp(z + vz * age, -(SOC_W - SOC_R), SOC_W - SOC_R);
    // After my own hit the host's ball is behind until it has taken the hit (it says so): till
    // then mine flies on its own (unless it's way off).
    if (this.hitHold > 0 && Array.isArray(s.hk) && s.hk[0] === this.me.idx && s.hk[1] === this.hitSeq) this.hitHold = Math.min(this.hitHold, 0.1);
    const err = Math.hypot(tx - b.x, ty - b.y, tz - b.z);
    if (err > (this.hitHold > 0 ? 30 : 7) || this.frozen || !this.started) { b.x = tx; b.y = ty; b.z = tz; b.vx = vx; b.vy = vy; b.vz = vz; }
    else {
      const k = Math.min(1, dt * (this.hitHold > 0 ? 0.6 : 7)), kv = Math.min(1, dt * (this.hitHold > 0 ? 0.3 : 5));
      b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; b.z += (tz - b.z) * k;
      b.vx += (vx - b.vx) * kv; b.vy += (vy - b.vy) * kv; b.vz += (vz - b.vz) * kv;
    }
    if (s.t != null && Math.abs(s.t - this.t) > 0.6) this.t = +s.t || 0;
    if (s.ot && !this.ot) { this.ot = true; Arcade.big('⏱️ הארכה! גול זהב', 2000); this.line('ot', true); }
    if (Array.isArray(s.g)) s.g.forEach((n, i) => { if (this.cars[i]) this.cars[i].goals = +n || 0; });
    if (s.sc && (s.sc[0] !== this.score[0] || s.sc[1] !== this.score[1])) {
      const team = s.sc[0] > this.score[0] ? 0 : 1; this.score = s.sc.slice(0, 2).map(Number);
      const by = s.lt != null ? this.cars[s.lt] : null;
      this.lastGoal = team; this.celebrate = 3; this.slowT = 1.5;
      this.goalFx(team, by, !!(by && by.team !== team));
    }
    // Kickoffs when the host's (an older host without them: after our own celebration).
    this.hostKo = s.ko;
    if (s.ko != null && s.ko !== this.ko) { this.ko = s.ko; this.celebrate = 0; this.kickoff(); }
    if (s.over && !this.over) this.finish();
    // An older host has no bots: drop ours.
    if (!s.bots && this.cars.some(c => c.bot)) { for (const c of this.cars.filter(c => c.bot)) this.scene.remove(c.obj.root); this.cars = this.cars.filter(c => !c.bot); }
  },
  presence() {
    const c = this.me;
    if (!c) return null;
    const r = (n) => Math.round(n * 10) / 10;
    const vf = c.vx * Math.cos(c.a) + c.vz * Math.sin(c.a);
    const out = { x: r(c.x), z: r(c.z), a: Math.round(c.a * 100) / 100, v: Math.round(vf), bt: c.boosting ? 1 : 0, y: r(c.y) };
    if (this.hitOut) out.h = this.hitOut;
    if (this.host) {
      const b = this.b;
      out.b = [b.x, b.y, b.z, b.vx, b.vy, b.vz].map(r); out.sc = this.score; out.over = this.over ? 1 : 0;
      out.t = r(this.t); out.ot = this.ot ? 1 : 0; out.ko = this.ko; out.g = this.cars.map(q => q.goals);
      out.lt = this.lastTouch ? this.lastTouch.idx : null;
      if (this.ack) out.hk = this.ack;
      out.bots = this.cars.filter(q => q.bot).map(q => [r(q.x), r(q.z), Math.round(q.a * 100) / 100, Math.round(q.vx * Math.cos(q.a) + q.vz * Math.sin(q.a)), r(q.y), q.boosting ? 1 : 0]);
    }
    return out;
  },

  // ---------- drawing ----------
  puff(x, y, z, color, size, life = 0.9, vy = 0.8) {
    const f = this.pool[this.poolI++ % this.pool.length];
    f.m.material.color.setHex(color); f.m.material.opacity = 0.75; f.m.position.set(x, y, z); f.m.scale.setScalar(size); f.m.visible = true;
    f.t = 0; f.life = life; f.s = size; f.vy = vy;
  },
  padsUpdate(dt) {
    const now = performance.now() / 1000;
    for (const p of this.pads) {
      if (p.t > 0) p.t -= dt;
      const on = p.t <= 0;
      p.disc.material.color.setHex(on ? 0xff9a3c : 0x5a4a3a); p.disc.material.opacity = on ? 0.6 + Math.sin(now * 5) * 0.25 : 0.4;
      if (p.orb) { p.orb.visible = on; p.orb.position.y = 1.2 + Math.sin(now * 3 + p.x) * 0.25; }
      if (!on) continue;
      for (const c of this.cars) {
        if (c.y > 1.5 || Math.hypot(c.x - p.x, c.z - p.z) > (p.big ? 2.2 : 1.6)) continue;
        if (!c.net) { if (c.boost >= 100) continue; c.boost = Math.min(100, c.boost + (p.big ? 100 : 25)); }
        p.t = p.big ? 9 : 4;
        if (c.isMe) Sound.pickup();
        this.puff(p.x, 0.8, p.z, 0xffb03c, p.big ? 3 : 1.8, 0.5, 1);
        break;
      }
    }
  },
  animate(dt, sdt) {
    const t = performance.now();
    for (const c of this.cars) {
      const { root, tilt, flames, pennant, flag } = c.obj;
      root.position.set(c.x, c.y, c.z); root.rotation.y = -c.a;
      // Names over the others' cars, but not over one right in front of the camera.
      if (flag) flag.visible = this.camera.position.distanceToSquared(root.position) > 100;
      const sp = Math.hypot(c.vx, c.vz);
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      const vl = -c.vx * sa + c.vz * ca;
      // Lean into turns and slides; a dodge flips the car over the way it dodged.
      let rx = socClamp(-vl * 0.01 - c.steer * 0.06 * Math.min(1, sp / 20), -0.2, 0.2), rz = c.y > 0 ? (c.vy > 0 ? 0.12 : -0.05) : 0;
      if (c.flip) { const ang = Math.min(1, c.flip.t / 0.55) * Math.PI * 2; rz = -c.flip.f * ang; rx += c.flip.s * ang; }
      tilt.rotation.set(rx, 0, rz);
      pennant.rotation.y = Math.sin(t / 90 + c.idx) * 0.3 + Math.min(0.6, sp * 0.02);
      for (const f of flames) { f.visible = !!c.boosting; if (c.boosting) { const k = 0.8 + Math.random() * 0.5; f.scale.set(k, k * (1 + Math.random() * 0.4), k); } }
      const back = c.x - ca * SOC_CAR.hl, backz = c.z - sa * SOC_CAR.hl;
      if (c.boosting && Math.random() < 0.7) this.puff(back, c.y + 0.6, backz, Math.random() < 0.5 ? 0xff9a3c : 0xffd23f, 1.1, 0.4, 0.3);
      if ((c.drift || Math.abs(vl) > 6) && c.y <= 0 && Math.random() < 0.6) this.puff(back, 0.3, backz, 0xe6d2a6, 1.4, 0.7, 0.5);
      if (sp > SOC_CAR.top + 4 && Math.random() < 0.5) this.puff(back, c.y + 0.9, backz, 0xffffff, 0.8, 0.35, 0);
    }
    // The ball rolls; its shadow and ring on the ground; a trail when it flies fast.
    const b = this.b, bv = Math.hypot(b.vx, b.vz);
    this.ball.position.set(b.x, b.y, b.z);
    this.ball.rotation.z -= (b.vx || 0) * sdt / SOC_R; this.ball.rotation.x += (b.vz || 0) * sdt / SOC_R;
    this.ballGlow = Math.max(0, (this.ballGlow || 0) - dt * 2);
    this.ball.material.emissiveIntensity = this.ballGlow * 0.6;
    const hgt = Math.max(0, b.y - SOC_R);
    this.shadow.position.set(b.x, 0.04, b.z); this.shadow.scale.setScalar(SOC_R * 2.4 * (1 + hgt * 0.04)); this.shadow.material.opacity = Math.max(0.12, 0.5 - hgt * 0.03);
    this.ring.position.set(b.x, 0.05, b.z); this.ring.scale.setScalar(SOC_R * 1.2 + hgt * 0.15); this.ring.material.opacity = hgt > 0.5 ? 0.75 : 0.35;
    if (bv > 22 && Math.random() < 0.85) { const lt = this.lastTouch; this.puff(b.x, b.y, b.z, lt ? (lt.team === 0 ? 0x8cc8ff : 0xff9a8a) : 0xffffff, SOC_R * 1.4, 0.35, 0); }
    for (const f of this.pool) {
      if (!f.m.visible) continue;
      f.t += sdt;
      if (f.t >= f.life) { f.m.visible = false; continue; }
      const k = f.t / f.life;
      f.m.material.opacity = 0.75 * (1 - k); f.m.scale.setScalar(f.s * (1 + k * 1.5)); f.m.position.y += sdt * f.vy;
    }
    if (this.flash.visible) {
      this.flashT += dt;
      const k = this.flashT / 0.9;
      if (k >= 1) { this.flash.visible = false; this.wave.visible = false; }
      else { this.flash.scale.setScalar(2 + k * 14); this.flash.material.opacity = 0.85 * (1 - k); this.wave.scale.setScalar(2 + k * 34); this.wave.material.opacity = 0.9 * (1 - k); }
    }
    this.cameraUpdate(dt);
  },
  // The camera: behind your car on the line from the ball through it (ball cam: both always in
  // view), or behind the car the way it drives. It turns smoothly, stays inside the walls
  // (rising over them when squeezed) and pulls back a little at speed.
  cameraUpdate(dt) {
    const c = this.me, b = this.b, cam = this.camera;
    if (!c) return;
    const dx = b.x - c.x, dz = b.z - c.z, dist = Math.hypot(dx, dz);
    const sp = Math.hypot(c.vx, c.vz), vf = c.vx * Math.cos(c.a) + c.vz * Math.sin(c.a);
    const ballView = this.ballCam && dist > 2.5;
    const yaw = ballView ? Math.atan2(dz, dx) : sp > 4 && vf > 0 && c.y <= 0 ? Math.atan2(c.vz, c.vx) : c.a;
    if (this.camSnap || this.camYaw == null) this.camYaw = yaw;
    else this.camYaw += socWrap(yaw - this.camYaw) * Math.min(1, dt * (ballView ? 5 : 4));
    const D = 9.5 + Math.min(3, sp * 0.09), H = 4.2 + (ballView ? Math.min(3.5, Math.max(0, b.y - 3) * 0.3) : 0);
    let px = c.x - Math.cos(this.camYaw) * D, pz = c.z - Math.sin(this.camYaw) * D, py = c.y * 0.6 + H, push = 0;
    const lx = Math.abs(pz) < SOC_GOAL - 1 ? SOC_L + SOC_GD - 0.6 : SOC_L - 0.6, lz = SOC_W - 0.6;
    if (Math.abs(px) > lx) { push += Math.abs(px) - lx; px = Math.sign(px) * lx; }
    if (Math.abs(pz) > lz) { push += Math.abs(pz) - lz; pz = Math.sign(pz) * lz; }
    const sx = Math.sign(px) || 1, sz = Math.sign(pz) || 1, e = sx * px + sz * pz - (SOC_L + SOC_W - SOC_CUT - 0.9);
    if (e > 0) { px -= sx * e / 2; pz -= sz * e / 2; push += e * 0.7; }
    py = Math.min(SOC_CEIL - 1, py + push * 0.45);
    const snap = this.camSnap; this.camSnap = false;
    const k = snap ? 1 : Math.min(1, dt * 10);
    cam.position.x += (px - cam.position.x) * k; cam.position.y += (py - cam.position.y) * k; cam.position.z += (pz - cam.position.z) * k;
    let lxp, lyp, lzp;
    if (ballView) { const w = Math.min(0.32, 12 / Math.max(1, dist)); lxp = c.x + dx * w; lzp = c.z + dz * w; lyp = c.y + 1.2 + Math.max(0, b.y - 1.5) * 0.3; }
    else { lxp = c.x + Math.cos(this.camYaw) * 6; lzp = c.z + Math.sin(this.camYaw) * 6; lyp = c.y + 1.4; }
    if (snap) this.camLook.set(lxp, lyp, lzp);
    else { const kl = Math.min(1, dt * 12); this.camLook.x += (lxp - this.camLook.x) * kl; this.camLook.y += (lyp - this.camLook.y) * kl; this.camLook.z += (lzp - this.camLook.z) * kl; }
    if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake; cam.position.y += (Math.random() - 0.5) * G.shake * 0.6; G.shake = Math.max(0, G.shake - dt); }
    cam.lookAt(this.camLook);
    cam.updateMatrixWorld();
  },

  // ---------- the overlay ----------
  ui() {
    const touch = G.touch;
    Arcade.hud(`<div class="sc${touch ? ' sc-touch' : ''}">
      <div class="sc-board ar-chip"><span class="sc-b">🔵 0</span><span class="sc-t">3:00</span><span class="sc-r">0 🔴</span></div>
      <div class="sc-boost ar-chip"><b>34</b><i><u></u></i><span>🚀</span></div>
      <div class="sc-ball hidden"><em></em><span>⚽</span></div>
      <button class="sc-cam" aria-label="מצלמה">${this.ballCam ? '🎥 <small>כדור</small>' : '🚗 <small>רכב</small>'}</button>
      ${touch ? `<div class="sc-pad">
        <button class="sc-btn sc-rev" aria-label="רוורס">⏪</button>
        <button class="sc-btn sc-bst" aria-label="טורבו">🚀<small>טורבו</small></button>
        <button class="sc-btn sc-jmp" aria-label="קפיצה">⤴️<small>קפיצה</small></button>
      </div>` : '<div class="sc-keys">רווח — קפיצה (×2 זינוק) · Shift — טורבו · X — בלם יד · C — מצלמה</div>'}
    </div>`);
    const h = $('#arcade .sc');
    this.el = { root: h, b: h.querySelector('.sc-b'), r: h.querySelector('.sc-r'), t: h.querySelector('.sc-t'), boostN: h.querySelector('.sc-boost b'), boost: h.querySelector('.sc-boost u'), ball: h.querySelector('.sc-ball'), ballArrow: h.querySelector('.sc-ball em'), bst: h.querySelector('.sc-bst') };
    h.querySelector('.sc-cam').addEventListener('click', (e) => { e.preventDefault(); this.toggleCam(); });
    const hold = (sel, key) => {
      const el = h.querySelector(sel); if (!el) return;
      const on = (e) => { e.preventDefault(); Sound.unlock(); this.tb[key] = true; el.classList.add('on'); };
      const off = () => { this.tb[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off);
    };
    hold('.sc-bst', 'boost'); hold('.sc-rev', 'rev');
    const j = h.querySelector('.sc-jmp');
    if (j) {
      j.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.unlock(); this.jumpReq = true; j.classList.add('on'); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) j.addEventListener(ev, () => j.classList.remove('on'));
    }
  },
  hud() {
    const e = this.el, c = this.me;
    if (!e || !c) return;
    e.root.classList.toggle('sc-over', !!this.over);
    e.b.textContent = `🔵 ${this.score[0]}`; e.r.textContent = `${this.score[1]} 🔴`;
    const left = this.LEN - this.t;
    const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    e.t.textContent = this.ot ? `⏱️ ${mmss(Math.max(0, -left))}+` : mmss(Math.max(0, Math.ceil(left)));
    e.t.classList.toggle('sc-hot', !this.ot && left < 30);
    const bp = Math.round(c.boost);
    e.boostN.textContent = bp; e.boost.style.width = `${bp}%`;
    if (e.bst) { e.bst.style.setProperty('--b', `${bp}%`); e.bst.classList.toggle('empty', bp < 1); }
    // The ball when it's off the screen: an arrow at the edge pointing at it.
    const v = this.ball.position.clone().project(this.camera), behind = v.z > 1;
    let x = behind ? -v.x : v.x, y = behind ? -v.y : v.y;
    const off = behind || Math.abs(x) > 0.96 || Math.abs(y) > 0.94;
    e.ball.classList.toggle('hidden', !off || !this.started);
    if (off) {
      if (behind && Math.abs(x) < 0.05 && Math.abs(y) < 0.05) y = -1;
      const m = Math.max(Math.abs(x) / 0.86, Math.abs(y) / 0.72);
      x /= m; y /= m;
      const ang = Math.atan2(-y, x);
      e.ball.style.left = `${(x * 0.5 + 0.5) * 100}%`; e.ball.style.top = `${(-y * 0.5 + 0.5) * 100}%`;
      e.ballArrow.style.transform = `rotate(${ang}rad)`;
    }
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  leave() { this.clear(); this.el = null; this.over = false; this.resultsAt = null; this.tb = { boost: false, rev: false }; Sound.engine(null); },
};
Arcade.register(SoccerGame);
