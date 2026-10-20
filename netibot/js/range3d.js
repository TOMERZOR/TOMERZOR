// The weapons range (מטווח נשק): the first-person side of the shooting range. A firing line with
// sandbags under a shade roof, sand berms, red flags, a range tower with a loudspeaker and the
// range officer in it, and six stages (מקצים) of about 30–45 seconds:
//   popup  — targets that pop up from behind mounds and drop when hit, with civilians among them;
//   rails  — targets riding rails at different speeds, swinging steel plates, bobbing targets;
//   house  — a plywood killhouse walked on rails: threats turn to face you and shoot back;
//   sky    — clay plates thrown in the air, balloons, a zigzagging UAV (and the photographer's drone);
//   long   — steel plates at 100–400 m with bullet drop, wind and a scope;
//   flash  — a target shows itself for 0.6 s: a silhouette — shoot, a civilian — don't.
// Weapons: the Tavor with the holographic sight (1), the Glock (2), and the stage's special (3):
// a Negev, or a sniper rifle with a scope on the long stage. Right-click / 🎯 aims down the sights.
// The props are Higgsfield models (assets/models/r3_*.json, gun_negev, gun_sniper; the Tavor,
// Glock and sight are the shooter's, the tower, sandbags, generator, pergola and pickup the
// game's); each has a plain stand-in until the models are in.
// Bullets fly (they drop, the wind pushes them) and are tested each frame against the targets'
// own planes, so swinging and turning targets are hit where they are.
// It runs inside a mini-game box (Minigames.range → Range3D.play) and draws with the world's
// renderer, which it takes over while it's on. done({ success, score 0–100 }) like the classic.
// The gun view model, flash, shells, tracers and impacts follow js/arcade/shooter.js.

const R3_EYE = 1.6;
const R3_W = {
  // The Tavor (the shooter's model and its sight numbers): the model's own optic is cut away and
  // the holographic sight sits on the rail.
  rifle: { key: 'rifle', name: 'תבור', model: 'gun_rifle', len: 0.72, rate: 0.1, auto: true, mag: 30, reload: 1.4, draw: 0.45, spread: 0.007, ads: 0.0012, bloom: 0.004, bloomMax: 0.02, kick: 0.012, speed: 900, fov: 46, dmg: 1, hip: [0.2, -0.2, -0.5], tracer: 1,
    muzzle: [0, 0.067, 0.36], sight: { rail: 0.122, cx: -0.006 }, holo: 0.045, cut: [[0.1225, -0.008, 0.1]], grip: [-0.07, 0.03], fore: [-0.03, 0.24] },
  pistol: { key: 'pistol', name: 'גלוק', model: 'gun_pistol', len: 0.19, rate: 0.13, auto: false, mag: 15, reload: 1.05, draw: 0.28, spread: 0.008, ads: 0.0022, bloom: 0.01, bloomMax: 0.03, kick: 0.03, speed: 360, fov: 60, dmg: 1, hip: [0.14, -0.13, -0.36], tracer: 0.35,
    muzzle: [0, 0.051, 0.095] },
  // The Negev and the sniper rifle: Higgsfield models one unit long, muzzle toward +z
  // (numbers in metres, measured off the models).
  negev: { key: 'negev', name: 'נגב', model: 'gun_negev', len: 1.0, rate: 0.072, auto: true, mag: 100, reload: 2.6, draw: 0.7, spread: 0.014, ads: 0.006, bloom: 0.003, bloomMax: 0.03, kick: 0.009, speed: 850, fov: 54, dmg: 1, hip: [0.2, -0.165, -0.64], tracer: 1,
    muzzle: [0.01, 0.05, 0.5], sight: { rail: 0.119, cx: 0.008 }, holo: -0.02, grip: [-0.06, -0.22], fore: [-0.02, 0.22] },
  sniper: { key: 'sniper', name: 'צלף', model: 'gun_sniper', len: 1.12, rate: 1.05, auto: false, mag: 5, reload: 2.2, draw: 0.6, spread: 0.03, ads: 0.00012, bloom: 0, bloomMax: 0, kick: 0.05, speed: 820, fov: 6, dmg: 5, scope: true, zero: 100, hip: [0.2, -0.16, -0.66], tracer: 1,
    muzzle: [0.017, 0.039, 0.56], eye: { x: 0.005, y: 0.119, z: -0.33, d: 0.1 }, grip: [-0.055, -0.36], fore: [-0.03, 0.1], cx: 0.01 },
};
const R3_HOLO = 0.095; // the holographic sight's size on the rifle (the shooter's)
// The Higgsfield models the range uses (and the game's own it borrows).
const R3_MODELS = ['gun_rifle', 'gun_pistol', 'sight_holo', 'gun_negev', 'gun_sniper', 'arc_sandbags', 'tower', 'generator', 'pergola', 'pickup',
  'r3_target', 'r3_hostage', 'r3_steel', 'r3_drone', 'r3_trolley', 'r3_thrower', 'r3_speaker', 'r3_ammo'];
// Where things are on the target models (model units: 1 high, the base at y −0.5, the face at z).
const R3_STAND = {
  r3_target: { face: 0.0245, aim: 0.04, head: 0.342 },
  r3_hostage: { face: 0.0245, aim: 0.05 },
};
// Hit zones on the threat model's print: the head, the A-zone oval, the body.
function r3tgtZone(x, y) {
  if (r3inEll(x, y, 0, 0.342, 0.075, 0.085)) return 'head';
  if (r3inEll(x, y, 0, 0.04, 0.06, 0.13)) return 'center';
  if (Math.abs(x) < 0.155 && y > -0.145 && y < 0.19) return 'body';
  if (y >= 0.19 && y < 0.25 && Math.abs(x) < 0.155 - (y - 0.19) * 1.6) return 'body';
  if (Math.abs(x) < 0.05 && y >= 0.25 && y < 0.3) return 'body';
  return null;
}
// The civilian cutout: anywhere on the board, the raised arms or the head.
function r3civModelZone(x, y) {
  if (Math.abs(x) < 0.175 && y > -0.367 && y < 0.233) return 'civ';
  if (r3inEll(x, y, 0, 0.358, 0.075, 0.09)) return 'civ';
  if (Math.abs(x) > 0.1 && Math.abs(x) < 0.19 && y >= 0.233 && y < 0.5) return 'civ';
  return null;
}

// The range officer ({@p_shalev}) over the loudspeaker, and a few others.
const R3_SAY = {
  start: ['קו האש — מוכן? ...קו האש מוכן! אש!', 'מחסנית פנימה! דרוך! ירי בכוונה!', 'ירי בכוונה! לא בהתלהבות!', 'מצב מוכנות! ...אש חופשית!', 'נשימה, כוונת, סחיטה. אש!'],
  empty: ['מחסנית החוצה! מחסנית פנימה! זה לא ריקוד, זה נוהל!', 'נגמרו הכדורים? מחסנית!', 'קליק זה לא ירי. מחסנית!'],
  tower: ['מי ירה במגדל?!?!', 'חדל!!! מי ירה עליי?!', 'המגדל זה לא מטרה! אני בפנים!!!'],
  sky: ['יורים על המטרות, לא על הציפורים!', 'ירית על הירח? הוא קצת מחוץ לטווח.', 'הקנה למטה! השמיים לא עשו לך כלום!'],
  bags: ['ירית בשק חול. הוא לא עשה לך כלום.', 'השקים זה בשבילך, לא בשבילם!'],
  hostage: ['חדל! חדל! חדל! זה אזרח!!!', 'ירית באזרח! זה נרשם בתחקיר.', 'אזרח! ידיים למעלה זה אזרח!!!'],
  friend: ['ידיים למעלה זה אזרח! לא יורים!!!', 'יד פתוחה — לא יורים. רשמתי.'],
  photo: ['זה היה הרחפן של הצלם!!! ...הוא צילם הכל.', 'הרחפן של דובר צה״ל!!! איך אני מסביר את זה?!'],
  streak: ['אש! אש! אש! תמשיך[/י] ככה!', 'רצף! אני מעביר אותך לגולני. ...אחרי שאני אעבור.', 'יפה! ככה יורים!'],
  miss: ['נשימה. כוונת. סחיטה. לא לחיצה — סחיטה!', 'הכדורים הולכים לסוללה. המטרות מחכות.', 'לאט. לכוון. ואז לירות.'],
  head: ['בראש! ראית את זה?!', 'ראש! עוד פעם אחת ואני מתחיל להתרגש.'],
  hurt: ['נפגעת! בתרגיל. אבל עדיין — נפגעת.', 'הוא ירה ראשון! מהר יותר!'],
  go: ['קדימה! קדימה!', 'לא נתקעים בדלת!'],
  drone: ['הכטב״ם הופל!!! תביאו לי אותו, אני רוצה תמונה.', 'כטב״ם למטה! יששש!'],
  far: ['פגיעה ב־400!!! {@commander} תשמע על זה!', 'דינג מ־400 מטר. אני צריך לשבת.'],
  end: ['חדל! נצור! פרוק! הצג נשק לבדיקה!', 'חדל אש! נשק למטה, מחסניות החוצה!'],
};
const R3_STAGE = [
  { id: 'popup', icon: '🎯', name: 'מטרות קופצות', time: 35, w: 'rifle', x3: 'negev', par: 650,
    desc: 'דמויות קופצות מאחורי תלוליות העפר ונופלות כשפוגעים. ראש — הכי הרבה נקודות. בין הדמויות יש גם אזרחים — לא לירות בהם!' },
  { id: 'rails', icon: '🛤️', name: 'מסילות ומטוטלות', time: 35, w: 'rifle', x3: 'negev', par: 1300,
    desc: 'מטרות שנוסעות על מסילות במהירויות שונות, צלחות פלדה מתנדנדות ומטרות שקופצות מאחורי קיר. להקדים את המטרה!' },
  { id: 'house', icon: '🏚️', name: 'בית ירי', time: 50, w: 'pistol', x3: 'negev', par: 380,
    desc: 'מתקדמים לבד בין החדרים. מי שמחזיק נשק — יורד. מי שמרים ידיים — אזרח. מי שלא מורידים תוך כמה שניות — יורה בך.' },
  { id: 'sky', icon: '🛸', name: 'צלחות וכטב״ם', time: 35, w: 'negev', x3: 'negev', par: 1300,
    desc: 'צלחות חימר עפות באוויר, בלונים עולים, וכטב״ם שעושה זיגזג. צלחת זהב — כפול. הרחפן הלבן של הצלם — לא!' },
  { id: 'long', icon: '🔭', name: 'צליפה לטווח ארוך', time: 45, w: 'sniper', x3: 'sniper', par: 600,
    desc: 'צלחות פלדה ב־100 עד 400 מטר. הקליע נופל והרוח מזיזה אותו: לכוון גבוה ונגד הרוח (הדגלים מראים). דינג!' },
  { id: 'flash', icon: '⚡', name: 'רפלקסים', time: 30, w: 'pistol', x3: 'negev', par: 700,
    desc: 'מטרה מופיעה ל־0.6 שניות בלבד. דמות ירוקה — לירות מהר (מהר יותר = יותר נקודות). אזרח עם ידיים למעלה — לא לירות!' },
];
const R3_KH = 90; // where the killhouse stands (x), away from the main lane
const r3rnd = (a, b) => a + Math.random() * (b - a);
const r3pick = (a) => a[Math.floor(Math.random() * a.length)];
const r3ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r3clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The paper silhouette (meters, x from the middle, y up from the bottom of a 0.56 x 1.0 sheet).
const R3_SIL = [[-0.25, 0], [-0.25, 0.55], [-0.2, 0.66], [-0.08, 0.72], [0.08, 0.72], [0.2, 0.66], [0.25, 0.55], [0.25, 0]];
function r3inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const r3inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
// Where a threat silhouette is hit: head, the center (A) zone, the body — or nothing.
function r3silZone(x, y, dx = 0) {
  x -= dx;
  if (r3inEll(x, y, 0, 0.84, 0.085, 0.105)) return 'head';
  if (Math.abs(x) < 0.1 && y > 0.4 && y < 0.66) return 'center';
  if (r3inPoly(x, y, R3_SIL) || (Math.abs(x) < 0.05 && y > 0.7 && y < 0.77)) return 'body';
  return null;
}
// A civilian has their arms up, so more of them can be hit.
function r3civZone(x, y, dx = 0) {
  x -= dx;
  if (r3silZone(x, y)) return 'civ';
  if (Math.abs(x) > 0.17 && Math.abs(x) < 0.27 && y > 0.55 && y < 1.0) return 'civ';
  return null;
}

const Range3D = {
  // ---------- entering and leaving ----------
  play(box, opts, done) {
    this.box = box; this.opts = opts || {}; this.done = done;
    this.root = $('#mini');
    this.root.classList.add('r3d-on');
    document.body.classList.add('r3d-on');
    box.classList.add('r3d');
    this.build();
    this.mode = 'menu'; this.time = 0; this.stage = null; this.st = null; this.course = null; this.runs = [];
    this.look = { yaw: Math.PI / 2, pitch: 0 }; this.recoil = { p: 0, y: 0 }; this.sway = { x: 0, y: 0 };
    this.trigger = false; this.semiHeld = false; this.ads = false; this.adsK = 0; this.breath = 3; this.holdBreath = false;
    this.kick = 0; this.hurtFx = 0; this.hm = 0; this.shake = 0; this.shells = this.shells || [];
    this.nextNeighbor = 3; this.sayUntil = 0; this.noLock = false;
    this.setLoadout('rifle', 'negev');
    this.dressGuns();
    this.dressProps();
    // The models load while you pick a stage (a stage waits for them, up to a few seconds).
    this.ready = R3_MODELS.every(n => Assets.has(n)) ? Promise.resolve() : Arcade.loadModels(R3_MODELS).then(() => { if (this.box !== box) return; this.dressGuns(); this.dressProps(); });
    // While it's on, the world isn't drawn: this draws into the same canvas instead.
    this.origRender = Scene3D.render;
    this.mine = () => {};
    Scene3D.render = this.mine;
    this.ui();
    this.bind();
    this.menu();
    Mini.loop(dt => this.frame(dt));
    Mini.cleanup.push(() => this.leave());
  },
  // Gives the world its renderer back (the results card shows over the world, like the others).
  release() {
    if (this.mine && Scene3D.render === this.mine) Scene3D.render = this.origRender;
    this.mine = null;
    if (this.root) this.root.classList.remove('r3d-on');
    document.body.classList.remove('r3d-on');
    if (this.box) this.box.classList.remove('r3d');
    this.lockOff();
  },
  leave() {
    this.unbind();
    this.release();
    this.clearStage();
    for (const b of this.bullets || []) if (b.m) this.scene.remove(b.m);
    this.bullets = [];
    this.mode = 'off'; this.box = null; this.el = null; this.done = null;
  },

  // ---------- the world, built once ----------
  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x4a86d0);
    sc.fog = new THREE.Fog(0xf2c89a, 140, 1050);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 1400);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x9a7a58, 0.95));
    const sun = this.sun = new THREE.DirectionalLight(0xffd2a0, 1.15);
    sun.position.set(34, 42, -26); sun.target.position.set(0, 0, 18);
    sun.castShadow = typeof Settings === 'undefined' || Settings.shadows();
    sun.shadow.mapSize.set(G.touch ? 1024 : 2048, G.touch ? 1024 : 2048);
    sun.shadow.bias = -0.0006;
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 40, bottom: -30, near: 1, far: 140 });
    sc.add(sun, sun.target);
    const sky = Arcade.sky(sc, 'assets/arcade/range_sky.jpg', { r: 1000, h: 1150, y0: -410, repeat: 1 });
    sky.rotation.y = Math.PI; // the seam behind the firing line
    // The ground: sand all the way to the hills.
    const sandTex = Arcade.texture('assets/tex/sand.jpg', 260);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ map: sandTex, color: 0xf4dcbc, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.z = 500; ground.receiveShadow = true; sc.add(ground);
    this.soft = this.radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.flashTex = [this.flashCanvas(0), this.flashCanvas(1)];
    this.fx = []; this.decals = []; this.bullets = []; this.targets = []; this.blockers = []; this.stageBlockers = [];
    this.decalMat = new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.holeMat = new THREE.MeshBasicMaterial({ color: 0x111111, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.leadMat = new THREE.MeshBasicMaterial({ color: 0x9a9aa0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.decalGeo = new THREE.CircleGeometry(0.05, 8);
    this.holeGeo = new THREE.CircleGeometry(0.009, 7);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracerGeo = new THREE.BoxGeometry(0.02, 0.02, 1); this.tracerGeo.translate(0, 0, 0.5);
    this.flashLight = new THREE.PointLight(0xffc070, 0, 9, 2); sc.add(this.flashLight);
    this.sandMat = new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg', 5), color: 0xe2bd90, roughness: 1, flatShading: true });
    // A berm: a trapezoid of earth with an uneven top (one unit long, high and deep; scaled).
    const sh = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.3, 0.88), new THREE.Vector2(0, 1), new THREE.Vector2(-0.3, 0.88)]);
    const mg = this.moundGeo = new THREE.ExtrudeGeometry(sh, { depth: 1, steps: 10, bevelEnabled: false });
    mg.translate(0, 0, -0.5); mg.rotateY(Math.PI / 2);
    const pa = mg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); if (y > 0.05) pa.setY(i, y * (1 + 0.1 * Math.sin(x * 23.7 + z * 5.1) + 0.06 * Math.sin(x * 61 - z * 11))); }
    mg.computeVertexNormals();
    this.woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 });
    this.metalMat = new THREE.MeshStandardMaterial({ color: 0x5a5e5a, roughness: 0.5, metalness: 0.6 });
    this.stageGroup = new THREE.Group(); sc.add(this.stageGroup);
    this.props = new THREE.Group(); sc.add(this.props);
    this.flags = [];
    this.buildLine();
    this.buildField();
    this.buildTower();
    this.buildHouse();
    this.buildViewModel();
  },
  radial(a, b) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  },
  flashCanvas(k) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 64);
    const n = k ? 5 : 7;
    for (let i = 0; i < n; i++) {
      g.rotate(Math.PI * 2 / n + (k ? 0.3 : 0));
      const gr = g.createLinearGradient(0, 0, 60, 0);
      gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.4, 'rgba(255,190,80,.9)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -7); g.lineTo(k ? 50 : 62, 0); g.lineTo(0, 7); g.fill();
    }
    const core = g.createRadialGradient(0, 0, 1, 0, 0, 26);
    core.addColorStop(0, 'rgba(255,255,240,1)'); core.addColorStop(1, 'rgba(255,200,90,0)');
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill();
    return new THREE.CanvasTexture(c);
  },
  canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  },
  // Low concrete walls (the rails' cover): grey blocks with dirt at the foot.
  wallMat() {
    if (this.wallM) return this.wallM;
    const t = this.canvasTex(256, 64, (g, W, H) => {
      g.fillStyle = '#8f8a7e'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
      g.fillStyle = 'rgba(60,50,40,.35)'; for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 2, H);
      const gr = g.createLinearGradient(0, H * 0.5, 0, H); gr.addColorStop(0, 'rgba(160,120,70,0)'); gr.addColorStop(1, 'rgba(160,120,70,.6)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1);
    this.wallM = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
    return this.wallM;
  },
  // A sand mound (a half-buried stretched cylinder) along x, or along z with rotY.
  mound(x, z, len, h, d, rotY = 0, parent = this.scene) {
    const m = new THREE.Mesh(this.moundGeo, this.sandMat);
    m.scale.set(len, h, d); m.position.set(x, 0, z); m.rotation.y = rotY;
    m.receiveShadow = true; m.castShadow = h < 2;
    parent.add(m);
    return m;
  },
  // A static thing bullets stop at: { x0..x1, y0..y1, z0..z1, kind }.
  block(list, x0, x1, y0, y1, z0, z1, kind) { list.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0, y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), kind }); },
  board(text, { w = 1, h = 0.6, bg = '#f4efe2', fg = '#1a1a14', font = 900 } = {}) {
    const t = this.canvasTex(256, Math.round(256 * h / w), (g, W, H) => {
      g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
      g.fillStyle = fg; g.font = `${font} ${Math.round(H * 0.62)}px Rubik, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(text, W / 2, H / 2 + 4);
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  },
  // A red flag on a pole that waves (in the wind of the long stage too).
  flag(x, z, pole = 4, color = 0xd8261f, parent = this.scene) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, pole, 6), this.metalMat); p.position.y = pole / 2; p.castShadow = true; g.add(p);
    const geo = new THREE.PlaneGeometry(1.1, 0.7, 10, 1); geo.translate(0.55, 0, 0);
    const f = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
    f.position.y = pole - 0.4; g.add(f);
    parent.add(g);
    const base = geo.attributes.position.array.slice();
    this.flags.push({ g, f, geo, base, ph: Math.random() * 6 });
    return g;
  },

  // The firing line: a concrete slab, sandbags, a shade roof, lane posts.
  buildLine() {
    const sc = this.scene;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(30, 0.12, 4.4), new THREE.MeshStandardMaterial({ color: 0xb8ae9e, roughness: 0.95 }));
    slab.position.set(0, 0.06, -1.1); slab.receiveShadow = true; sc.add(slab);
    // Sandbags (boxes painted as bags until the model is in).
    const bagTex = this.canvasTex(256, 128, (g, W, H) => {
      g.fillStyle = '#b89a66'; g.fillRect(0, 0, W, H);
      for (let r = 0; r < 3; r++) for (let k = -1; k < 5; k++) {
        const x = k * 64 + (r % 2) * 32, y = r * 42 + 2;
        const gr = g.createLinearGradient(0, y, 0, y + 40); gr.addColorStop(0, '#d4b884'); gr.addColorStop(1, '#8a7046');
        g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x + 2, y, 60, 38, 14) : g.rect(x + 2, y, 60, 38); g.fill();
        g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 2; g.stroke();
      }
    });
    bagTex.wrapS = THREE.RepeatWrapping; bagTex.repeat.set(10, 1);
    this.bagBox = new THREE.Mesh(new THREE.BoxGeometry(30, 1.0, 0.7), new THREE.MeshStandardMaterial({ map: bagTex, roughness: 1 }));
    this.bagBox.position.set(0, 0.5, 1.05); this.bagBox.castShadow = this.bagBox.receiveShadow = true; sc.add(this.bagBox);
    this.block(this.blockers, -15, 15, 0, 1.0, 0.7, 1.4, 'bags');
    // The shade roof over the line.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 4.6), new THREE.MeshStandardMaterial({ color: 0x6a7448, roughness: 0.9 }));
    roof.position.set(0, 3.1, -0.9); roof.rotation.x = -0.06; roof.castShadow = true; sc.add(roof);
    for (const x of [-14, -7, 7, 14]) for (const z of [-3, 1.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.1, 0.14), this.metalMat); post.position.set(x, 1.55, z); post.castShadow = true; sc.add(post);
    }
    // Lane numbers along the sandbags; yours is 5.
    for (let i = 1; i <= 9; i++) {
      const x = (5 - i) * 3;
      const b = this.board(String(i), { w: 0.3, h: 0.3, bg: i === 5 ? '#f2c14e' : '#f4efe2' });
      b.position.set(x, 0.62, 0.57); b.rotation.y = Math.PI; sc.add(b);
    }
    // A table behind you with magazines and ear muffs (it's a proper range).
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.7), this.woodMat); table.position.set(2.4, 0.8, -2.2); table.castShadow = true; sc.add(table);
    for (const dx of [-0.6, 0.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.6), this.woodMat); l.position.set(2.4 + dx, 0.4, -2.2); sc.add(l); }
    const magMat = new THREE.MeshStandardMaterial({ color: 0x2a2a26, roughness: 0.6 });
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.07), magMat); m.position.set(1.9 + k * 0.12, 0.92, -2.15); m.rotation.z = 0.1; sc.add(m); }
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.25), new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.9 })); box.position.set(2.9, 0.94, -2.25); sc.add(box);
  },
  // The field: berms, side berms, distance boards and flags. The middle of the back berm is
  // open, for the long stage beyond it.
  buildField() {
    const B = this.blockers;
    this.mound(-24, 64, 34, 6.5, 9); this.mound(24, 64, 34, 6.5, 9);
    this.block(B, -41, -7, 0, 5.4, 60, 68, 'berm'); this.block(B, 7, 41, 0, 5.4, 60, 68, 'berm');
    this.mound(-23, 30, 62, 4, 7, Math.PI / 2); this.mound(23, 30, 62, 4, 7, Math.PI / 2);
    this.block(B, -26, -20, 0, 3.4, 0, 60, 'berm'); this.block(B, 20, 26, 0, 3.4, 0, 60, 'berm');
    // The far backstop of the long lane.
    this.mound(0, 470, 140, 22, 40);
    this.block(B, -70, 70, 0, 18, 452, 488, 'berm');
    for (const [x, z] of [[-21, 61], [21, 61], [-23, 6], [23, 6], [-23, 40], [23, 40], [-30, 470], [30, 470]]) this.flag(x, z, z > 100 ? 9 : 4.5);
    for (const [d, x] of [[25, -19], [50, -19], [100, -9], [200, -15], [300, -20], [400, -26]]) {
      const b = this.board(String(d), { w: d >= 100 ? 2.4 : 0.9, h: d >= 100 ? 1.3 : 0.5 });
      b.position.set(x, d >= 100 ? 2.2 : 1.2, d); b.rotation.y = Math.PI; this.scene.add(b);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.1, d >= 100 ? 1.6 : 1, 0.1), this.woodMat); st.position.set(x, d >= 100 ? 0.8 : 0.5, d + 0.05); this.scene.add(st);
    }
    // Long lane wind flags (they show the wind of the long stage).
    this.flag(-6, 150, 5, 0xff8a1a); this.flag(8, 250, 6, 0xff8a1a); this.flag(-12, 350, 7, 0xff8a1a);
    this.windFlagSet = this.flags.slice(-3);
    // A few bushes and stones.
    const bush = new THREE.MeshStandardMaterial({ color: 0x7a8a46, roughness: 1 }), stone = new THREE.MeshStandardMaterial({ color: 0xb09878, roughness: 1 });
    for (let i = 0; i < 40; i++) {
      const x = r3rnd(-60, 60), z = r3rnd(-30, 140);
      if (Math.abs(x) < 20 && z > -6 && z < 62) continue;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r3rnd(0.3, 0.8), 0), i % 3 ? bush : stone);
      m.position.set(x, 0.15, z); m.scale.y = 0.6; this.scene.add(m);
    }
  },
  // The range tower behind the line, on the left: legs, a cabin with windows, a loudspeaker,
  // the red flag on top and the range officer in the window.
  buildTower() {
    const sc = this.scene, g = this.towerProc = new THREE.Group(); g.position.set(-9, 0, -8); g.rotation.y = 0.35;
    const leg = new THREE.MeshStandardMaterial({ color: 0x5a5040, roughness: 0.9 });
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), leg); l.position.set(x, 2, z); l.castShadow = true; g.add(l); }
    const winTex = this.canvasTex(256, 160, (c, W, H) => {
      c.fillStyle = '#d8c8a4'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#2a3a48'; c.fillRect(20, 30, W - 40, 70);
      c.fillStyle = '#b02a1e'; c.fillRect(0, H - 40, W, 40);
      c.fillStyle = '#fff'; c.font = '900 30px Rubik, Arial'; c.textAlign = 'center'; c.direction = 'rtl'; c.fillText('מגדל מטווח', W / 2, H - 10);
    });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 3.2), new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.9 }));
    cab.position.y = 5.2; cab.castShadow = true; g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 3.8), new THREE.MeshStandardMaterial({ color: 0x7a7060, roughness: 0.9 })); roof.position.y = 6.5; g.add(roof);
    // The officer in the window: a body and a head with a beret.
    const off = new THREE.Group(); off.position.set(0.3, 4.9, 1.45);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x5b6b3c })); body.position.y = 0.1; off.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xc8956a })); head.position.y = 0.7; off.add(head);
    const beret = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 6, 0, 7, 0, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a6a3a })); beret.position.y = 0.78; beret.rotation.z = 0.25; off.add(beret);
    g.add(off); this.officer = off;
    // Stairs.
    for (let k = 0; k < 9; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.35), leg); s.position.set(2.1, 0.3 + k * 0.45, 1.6 - k * 0.38); g.add(s); }
    // The loudspeaker horn, pointing at the line.
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.06, 0.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xe0e0d8, side: THREE.DoubleSide, roughness: 0.5 }));
    horn.rotation.x = Math.PI / 2; horn.rotation.z = -0.5; horn.position.set(1.2, 6.9, 1.4); g.add(horn);
    sc.add(g);
    // The red flag over the tower (on the model's roof once it's in).
    this.flag(-10.7, -9.5, 10.4);
    // Bullets that reach the tower (anyone turning round to shoot it).
    this.block(this.blockers, -11.2, -6.8, 0, 9, -10.2, -5.8, 'tower');
  },
  // The killhouse (בית ירי): plywood walls, a corridor with rooms off it and a hall at the end.
  buildHouse() {
    const ply = this.canvasTex(256, 256, (g, W, H) => {
      g.fillStyle = '#c9a46a'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(110,70,30,${r3rnd(0.05, 0.18)})`; g.lineWidth = r3rnd(1, 3); g.beginPath(); const y = Math.random() * H; g.moveTo(0, y); g.bezierCurveTo(W / 3, y + r3rnd(-10, 10), W * 2 / 3, y + r3rnd(-10, 10), W, y + r3rnd(-6, 6)); g.stroke(); }
      g.fillStyle = 'rgba(80,50,20,.5)'; g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
    });
    ply.wrapS = ply.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: ply, roughness: 0.95 });
    const X = R3_KH, H = 2.6, B = this.blockers;
    const wall = (x0, z0, x1, z1) => {
      const w = Math.max(0.12, Math.abs(x1 - x0)), d = Math.max(0.12, Math.abs(z1 - z0));
      const geo = new THREE.BoxGeometry(w, H, d);
      const m = new THREE.Mesh(geo, mat.clone()); m.material.map = ply.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(Math.max(w, d) / 2.4, 1);
      m.position.set(X + (x0 + x1) / 2, H / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; this.scene.add(m);
      this.block(B, X + Math.min(x0, x1) - 0.06, X + Math.max(x0, x1) + 0.06, 0, H, Math.min(z0, z1) - 0.06, Math.max(z0, z1) + 0.06, 'wall');
    };
    // The corridor (x −1.5..1.5) with doorways, the rooms and the end hall.
    wall(1.5, 0, 1.5, 4); wall(1.5, 6, 1.5, 28); wall(1.5, 30, 1.5, 36);
    wall(-1.5, 0, -1.5, 11); wall(-1.5, 13, -1.5, 28); wall(-1.5, 30, -1.5, 36);
    wall(1.5, 2, 6.5, 2); wall(1.5, 8, 6.5, 8); wall(6.5, 2, 6.5, 8);
    wall(-1.5, 9, -6.5, 9); wall(-1.5, 15, -6.5, 15); wall(-6.5, 9, -6.5, 15);
    wall(1.5, 26, 6.5, 26); wall(1.5, 32, 6.5, 32); wall(6.5, 26, 6.5, 32);
    wall(-1.5, 26, -6.5, 26); wall(-1.5, 32, -6.5, 32); wall(-6.5, 26, -6.5, 32);
    wall(-6, 36, -1.5, 36); wall(1.5, 36, 6, 36); wall(-6, 45, 6, 45); wall(-6, 36, -6, 45); wall(6, 36, 6, 45);
    // A low barrier of sandbags across half the corridor, and ammo crates in the rooms (cover the
    // targets stand behind): stand-ins here, the models in dressProps().
    const proc = this.houseProc = new THREE.Group(); this.scene.add(proc);
    const crate = new THREE.MeshStandardMaterial({ color: 0x4a5430, roughness: 0.9 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.9, 0.6), crate); bar.position.set(X - 0.82, 0.45, 23.4); proc.add(bar);
    this.block(B, X - 1.5, X - 0.15, 0, 0.9, 23.1, 23.7, 'wall');
    this.crates = [[5, 6.6, 0.9], [-5.4, 10.4, 0.8], [-3, 41, 1.0], [3.4, 40.2, 0.9], [4.8, 30.6, 0.8]];
    for (const [x, z, s] of this.crates) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(s * 1.3, s, s * 0.85), crate); c.position.set(X + x, s / 2, z); c.castShadow = c.receiveShadow = true; proc.add(c);
      this.block(B, X + x - s * 0.65, X + x + s * 0.65, 0, s, z - s * 0.43, z + s * 0.43, 'wall');
    }
    // The doors (swing open as you arrive).
    this.doors = [];
    const door = (hx, hz, len, open, dir) => {
      const pv = new THREE.Group(); pv.position.set(X + hx, 0, hz);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, len), new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.8 }));
      d.position.set(0, 1.05, dir * len / 2); d.castShadow = true; pv.add(d);
      this.scene.add(pv); this.doors.push({ pv, open, k: 0 }); return this.doors.length - 1;
    };
    this.doorAt = { 1: door(1.5, 4, 2, 1.6, 1), 2: door(-1.5, 11, 2, -1.6, 1), 4: door(1.5, 28, 2, 1.6, 1), 5: door(-1.5, 28, 2, -1.6, 1) };
    // The entrance sign.
    const sign = this.board('בית ירי', { w: 2.6, h: 0.6, bg: '#b02a1e', fg: '#fff' }); sign.position.set(X, 2.9, -0.05); sign.rotation.y = Math.PI; this.scene.add(sign);
    const num = (n, x, z, ry) => { const b = this.board(String(n), { w: 0.5, h: 0.5, bg: '#f2c14e' }); b.position.set(X + x, 2.1, z); b.rotation.y = ry; this.scene.add(b); };
    num(1, 1.44, 3, -Math.PI / 2); num(2, -1.44, 10, Math.PI / 2); num(3, 1.44, 22, -Math.PI / 2); num(4, -1.44, 27, Math.PI / 2);
  },
  // The models once they're in: sandbags, the tower with the range officer in it, loudspeakers,
  // the generator, a pergola and ammo crates behind the line; the killhouse's cover.
  dressProps() {
    const P = this.props;
    while (P.children.length) P.remove(P.children[0]);
    const put = (name, fit, x, y, z, ry = 0, parent = P) => { const m = Assets.model(name, fit); if (!m) return null; m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
    if (Assets.has('arc_sandbags')) {
      this.bagBox.visible = false;
      for (let x = -13.5; x <= 13.6; x += 3) put('arc_sandbags', { size: [3.1, 0.98, 0.75] }, x, 0, 1.05);
      put('arc_sandbags', { size: [1.45, 0.92, 0.65] }, R3_KH - 0.82, 0, 23.4);
    }
    if (Assets.has('tower')) {
      this.towerProc.visible = false;
      put('tower', { height: 9.2 }, -9, 0, -8, 0.35);
      // The range officer at the window, looking over the line.
      if (!this.officerM) {
        try {
          const grp = new THREE.Group(); grp.position.set(-8.9, 5.9, -7.6); grp.rotation.y = 0.35;
          this.officerM = Arcade.soldier(this.scene, Arcade.look('p_shalev'));
          this.scene.remove(this.officerM.root); grp.add(this.officerM.root); this.scene.add(grp); this.officerG = grp;
        } catch (e) { this.officerM = null; }
      }
    }
    put('r3_speaker', { height: 5 }, -15.6, 0, -1.6, 0.4);
    put('r3_speaker', { height: 5 }, 15.6, 0, -1.6, -0.4);
    put('r3_speaker', { height: 4.2 }, -6.2, 0, -6.4, 0.9);
    put('generator', { length: 2.2 }, -13.5, 0, -9, 0.3);
    put('pergola', { length: 4.2 }, 7, 0, -7.5, 0);
    put('r3_ammo', { length: 0.75 }, 2.3, 0.83, -2.2, 0.15);
    put('r3_ammo', { length: 0.7 }, -1.4, 0.12, -1.6, -0.3);
    put('r3_ammo', { length: 0.7 }, 5.6, 0.12, -1.5, 0.5);
    if (Assets.has('r3_ammo')) {
      this.houseProc.visible = false;
      for (const [x, z, s] of this.crates) put('r3_ammo', { size: [s * 1.3, s, s * 0.85] }, R3_KH + x, 0, z, 0);
    }
  },

  // ---------- the view model (the shooter's guns and sights, plus the Negev and the sniper rifle) ----------
  buildViewModel() {
    const vs = this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    vs.add(new THREE.HemisphereLight(0xffe2c4, 0x4a3a30, 0.75));
    const key = new THREE.DirectionalLight(0xffc890, 0.9); key.position.set(-1, 0.6, 0.4); vs.add(key);
    const fill = new THREE.DirectionalLight(0x90a0ff, 0.22); fill.position.set(1, 0.2, 1); vs.add(fill);
    this.vm = new THREE.Group(); vs.add(this.vm);
    this.vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex[0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    this.vmFlash.visible = false; vs.add(this.vmFlash);
    this.vmLight = new THREE.PointLight(0xffb060, 0, 2, 2); vs.add(this.vmLight);
    this.shells = [];
    this.shellGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 6); this.shellGeo.rotateZ(Math.PI / 2);
    this.shellMat = new THREE.MeshStandardMaterial({ color: 0xd8a83a, metalness: 0.8, roughness: 0.3 });
    this.vmGuns = {};
  },
  // A gun for the view model: the model (or a stand-in), hands, sights, the muzzle. g.userData.eye:
  // the point that ends up in the middle of the screen when aiming, and how far in front of the eye.
  makeGun(key) {
    const W = R3_W[key], src = Assets.models[W.model];
    const g = new THREE.Group();
    if (src) {
      const m = src.clone(true);
      m.scale.setScalar(W.len);
      // The Tavor loses its own (closed) optic: the holographic sight goes on the rail instead.
      if (W.cut) m.traverse(o => { if (o.isMesh && o.geometry.index) o.geometry = this.cutBoxes(o.geometry, W.len, W.cut); });
      m.traverse(o => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        if (!o.material.userData.shLit) { o.material.color.setScalar(W.model === 'gun_rifle' || W.model === 'gun_pistol' ? 1.7 : 1.35); o.material.userData.shLit = true; }
      });
      g.add(m);
    } else {
      const mat = this.sightMat();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, W.len), mat); body.position.y = key === 'pistol' ? 0.02 : 0.06; g.add(body);
    }
    // Hands and sleeves: the right on the grip, the left forward.
    const skinC = (G.profile && G.profile.skin) || '#d9a77c';
    const skin = new THREE.MeshStandardMaterial({ color: skinC, roughness: 0.7 }), sleeve = new THREE.MeshStandardMaterial({ color: 0x3e4a28, roughness: 0.95 });
    const hand = (x, y, z, rx, ry, big = 1) => {
      const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.set(rx, ry, 0);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin); palm.scale.set(0.028 * big, 0.045 * big, 0.05 * big); h.add(palm);
      for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), skin); f.position.set(0.024 * big, 0.026 - k * 0.017, 0.025); h.add(f); }
      const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.045, 8), skin); thumb.rotation.x = Math.PI / 2; thumb.position.set(-0.024 * big, 0.03, 0.035); h.add(thumb);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.046, 0.7, 12), sleeve); arm.rotation.x = Math.PI / 2; arm.position.set(0, -0.02, -0.39); h.add(arm);
      g.add(h); return h;
    };
    if (key === 'pistol') {
      g.userData.rh = hand(0.024, -0.06, -0.065, 0.3, 0.15, 1.15); g.userData.lh = hand(-0.03, -0.075, -0.05, 0.3, -0.45, 1.1); g.userData.lhY = -0.075;
      this.pistolSights(g);
    } else {
      const cx = W.sight ? W.sight.cx : W.cx;
      g.userData.rh = hand(cx + 0.012, W.grip[0], W.grip[1], 0.35, 0.12); g.userData.lh = hand(cx - 0.035, W.fore[0], W.fore[1], -0.33, -0.51); g.userData.lhY = W.fore[0];
      if (W.holo) this.mountHolo(g, W);
      else g.userData.eye = W.eye;
    }
    const mz = new THREE.Object3D(); mz.position.set(...W.muzzle); g.add(mz); g.userData.muzzle = mz;
    return g;
  },
  // (From the shooter.) Drops the triangles inside boxes [y0, z0, z1] from a copy of a mesh.
  cutBoxes(geo, s, boxes) {
    const out = geo.clone(), p = out.attributes.position, idx = out.index.array, keep = [];
    const inside = (i) => { const y = p.getY(i) * s, z = p.getZ(i) * s; return boxes.some(([y0, z0, z1]) => y > y0 && z > z0 && z < z1); };
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    out.setIndex(keep);
    return out;
  },
  sightMat() { return this.sightM || (this.sightM = new THREE.MeshStandardMaterial({ color: 0x101110, roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide })); },
  // (From the shooter.) The holographic sight on the rail, its window cut through, a faint glass
  // and the reticle (a red ring and a dot) in it.
  mountHolo(g, W) {
    const src = Assets.models.sight_holo, s = R3_HOLO, S = W.sight;
    const h = new THREE.Group();
    h.position.set(S.cx, S.rail + 0.38 * s, W.holo); h.rotation.y = Math.PI;
    if (src) {
      const m = src.clone(true); m.scale.setScalar(s);
      m.traverse(o => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        if (!o.material.userData.shLit) { o.material = o.material.clone(); o.material.color.setScalar(2.1); o.material.userData.shLit = true; }
        if (o.geometry.index) o.geometry = this.cutWindow(o.geometry);
      });
      h.add(m);
    } else {
      const dark = this.sightMat();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.03, 0.09), dark); box.position.set(0, -0.022, 0); h.add(box);
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.05), dark); w.position.set(sx * 0.022, 0.012, 0.012); h.add(w); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.05), dark); top.position.set(0, 0.032, 0.012); h.add(top);
    }
    g.add(h);
    const wx = S.cx - 0.01 * s, wy = S.rail + 0.58 * s, wz = W.holo - 0.15 * s;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.3 * s, 0.2 * s), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    glass.position.set(wx, wy, wz + 0.004); glass.renderOrder = 2; g.add(glass);
    if (!this.holoTex) this.holoTex = this.canvasTex(128, 128, (c) => {
      c.shadowColor = 'rgba(255,40,30,.9)'; c.shadowBlur = 6; c.strokeStyle = 'rgba(255,60,45,.95)'; c.lineWidth = 5;
      c.beginPath(); c.arc(64, 64, 46, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,90,70,1)'; c.beginPath(); c.arc(64, 64, 5.5, 0, Math.PI * 2); c.fill();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); c.beginPath(); c.moveTo(64 + ca * 46, 64 + sa * 46); c.lineTo(64 + ca * 56, 64 + sa * 56); c.stroke(); }
    });
    const ret = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.holoTex, transparent: true, depthWrite: false }));
    ret.position.set(wx, wy, wz); ret.renderOrder = 3; g.add(ret); g.userData.dot = ret;
    g.userData.eye = { x: wx, y: wy, z: wz, d: 0.17 };
  },
  cutWindow(geo) {
    const out = geo.clone(), p = out.attributes.position, idx = out.index.array, keep = [];
    const inside = (i) => { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); return x > -0.145 && x < 0.165 && y > 0.095 && y < 0.31 && z > -0.04 && z < 0.37; };
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    out.setIndex(keep);
    return out;
  },
  // (From the shooter.) The Glock's sights: a rear notch with two white dots, a front post with one.
  pistolSights(g) {
    const dark = this.sightMat(), white = new THREE.MeshBasicMaterial({ color: 0xf4f4ea });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; g.add(m); return m; };
    const cx = -0.0007, top = 0.073;
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.0062, 0.0125, 0.007), dark, cx + sx * 0.0086, top - 0.00625, -0.068);
      add(new THREE.CircleGeometry(0.0015, 12), white, cx + sx * 0.0086, top - 0.0042, -0.0716).rotation.y = Math.PI;
    }
    add(new THREE.BoxGeometry(0.0234, 0.006, 0.007), dark, cx, 0.0625, -0.068);
    add(new THREE.BoxGeometry(0.0052, 0.012, 0.0055), dark, cx, top - 0.006, 0.085);
    add(new THREE.CircleGeometry(0.0016, 12), white, cx, top - 0.0032, 0.0821).rotation.y = Math.PI;
    g.userData.eye = { x: cx, y: top, z: -0.068, d: 0.27 };
  },
  dressGuns() {
    for (const k of Object.keys(R3_W)) { if (this.vmGuns[k]) this.vm.remove(this.vmGuns[k]); this.vmGuns[k] = this.makeGun(k); this.vm.add(this.vmGuns[k]); }
  },
  // The three weapons of a stage: 1 Tavor, 2 Glock, 3 the special.
  setLoadout(w, x3) {
    this.slots = ['rifle', 'pistol', x3];
    this.ammo = {}; for (const k of this.slots) this.ammo[k] = R3_W[k].mag;
    this.w = w; this.cool = 0; this.reloadT = 0; this.drawT = R3_W[w].draw; this.bloom = 0; this.boltT = 0;
  },

  // ---------- textures for the targets ----------
  paperTex(kind) {
    this.texCache = this.texCache || {};
    if (this.texCache[kind]) return this.texCache[kind];
    const w = kind === 'captor' ? 0.7 : kind === 'ring' ? 0.6 : 0.56, h = kind === 'ring' ? 0.6 : 1.0;
    const W = 256, H = Math.round(256 * h / w);
    const P = (x, y) => [(x + w / 2) / w * W, (1 - y / h) * H];
    const t = this.canvasTex(W, H, (g) => {
      g.fillStyle = '#efe8d6'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(120,100,60,${Math.random() * 0.06})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      const sil = (fill, dx = 0) => {
        g.fillStyle = fill; g.beginPath();
        R3_SIL.forEach(([x, y], i) => { const [px, py] = P(x + dx, y); i ? g.lineTo(px, py) : g.moveTo(px, py); });
        g.closePath(); g.fill();
        const [nx, ny] = P(dx - 0.05, 0.78), [nx2, ny2] = P(dx + 0.05, 0.7); g.fillRect(nx, ny, nx2 - nx, ny2 - ny);
        const [hx, hy] = P(dx, 0.84); g.beginPath(); g.ellipse(hx, hy, 0.085 / w * W, 0.105 / h * H, 0, 0, 7); g.fill();
      };
      const lines = (dx = 0) => {
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
        const [ax, ay] = P(dx - 0.1, 0.66), [bx, by] = P(dx + 0.1, 0.4); g.strokeRect(ax, ay, bx - ax, by - ay);
        const [hx, hy] = P(dx, 0.84); g.beginPath(); g.ellipse(hx, hy, 0.05 / w * W, 0.06 / h * H, 0, 0, 7); g.stroke();
      };
      const gun = (dx = 0) => { // an arm out with a pistol
        g.fillStyle = '#2a3018'; const [ax, ay] = P(dx + 0.16, 0.6); g.save(); g.translate(ax, ay); g.rotate(-0.25); g.fillRect(0, -9, 0.13 / w * W, 18); g.restore();
        g.fillStyle = '#111'; const [px, py] = P(dx + 0.25, 0.63); g.fillRect(px - 2, py - 10, 22, 10); g.fillRect(px - 2, py - 2, 8, 16);
      };
      const civ = (dx = 0, arms = true) => {
        // Arms up, a light shirt, a face: a person, not a target.
        g.fillStyle = '#d9a77c';
        if (arms) for (const sx of [-1, 1]) { const [ax, ay] = P(dx + sx * 0.22, 0.98); const [bx, by] = P(dx + sx * 0.17, 0.58); g.fillRect(Math.min(ax, bx) - 2, ay, Math.abs(bx - ax) + 18, by - ay); const [hx, hy] = P(dx + sx * 0.22, 0.97); g.beginPath(); g.arc(hx + 8, hy, 13, 0, 7); g.fill(); }
        sil('#6aa8e0', dx);
        g.fillStyle = '#d9a77c'; const [hx, hy] = P(dx, 0.84); g.beginPath(); g.ellipse(hx, hy, 0.08 / w * W, 0.1 / h * H, 0, 0, 7); g.fill();
        g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(hx, hy - 0.06 / h * H, 0.085 / w * W, 0.05 / h * H, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#222'; g.beginPath(); g.arc(hx - 9, hy, 3, 0, 7); g.arc(hx + 9, hy, 3, 0, 7); g.fill();
        g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.arc(hx, hy + 12, 8, 0.2, Math.PI - 0.2); g.stroke();
        g.fillStyle = '#fff'; g.font = '900 34px Rubik, Arial'; g.textAlign = 'center'; g.direction = 'rtl'; const [tx, ty] = P(dx, 0.3); g.fillText('אזרח', tx, ty);
      };
      if (kind === 'threat') { sil('#55613a'); lines(); gun(); g.fillStyle = '#fff'; g.font = '900 30px Rubik, Arial'; g.textAlign = 'center'; const [tx, ty] = P(0, 0.2); g.fillText('!', tx, ty); }
      else if (kind === 'hostage') civ();
      else if (kind === 'friend') {
        sil('#3aa04a');
        g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.textAlign = 'center'; const [tx, ty] = P(0, 0.42); g.fillText('✋', tx, ty);
        g.font = '900 28px Rubik, Arial'; g.direction = 'rtl'; const [ux, uy] = P(0, 0.12); g.fillText('לא לירות', ux, uy);
      } else if (kind === 'red') { sil('#c8301e'); lines(); gun(); }
      else if (kind === 'captor') {
        // The captor behind, the hostage in front: only his head and shoulder show.
        sil('#55613a', 0.17);
        civ(-0.06, false);
      } else if (kind === 'ring') {
        const [cx, cy] = P(0, 0.3);
        for (const [r, c] of [[0.29, '#222'], [0.21, '#efe8d6'], [0.13, '#222'], [0.05, '#d8261f']]) { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r / w * W, 0, 7); g.fill(); }
        g.strokeStyle = '#888'; g.lineWidth = 1.5; for (const r of [0.25, 0.17, 0.09]) { g.beginPath(); g.arc(cx, cy, r / w * W, 0, 7); g.stroke(); }
      }
    });
    this.texCache[kind] = t;
    return t;
  },
  steelTex() {
    if (this.steelT) return this.steelT;
    this.steelT = this.canvasTex(128, 128, (g, W) => {
      g.fillStyle = '#f2f0ea'; g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill();
      g.strokeStyle = '#c8301e'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 22, 0, 7); g.stroke();
      g.fillStyle = '#c8301e'; g.beginPath(); g.arc(64, 64, 7, 0, 7); g.fill();
      for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(120,120,120,.35)'; g.beginPath(); g.arc(r3rnd(20, W - 20), r3rnd(20, W - 20), r3rnd(2, 5), 0, 7); g.fill(); }
    });
    return this.steelT;
  },

  // ---------- targets ----------
  // A target: { kind, base (where it stands, turned to face the shooter), hinge (pops/turns/swings;
  // its local frame is the target's face: x across, y up, +z toward the shooter), shape 'plane' or
  // 'sphere' (r), zone(x, y) → zone name or null, up 0..1 (how far it's up / turned), alive }.
  addTarget(t) {
    t.alive = t.alive !== false; t.up = t.up == null ? 1 : t.up; t.holes = 0; t.id = (this.tid = (this.tid || 0) + 1);
    if (t.base && !t.base.parent) this.stageGroup.add(t.base);
    if (t.mesh && !t.mesh.parent) this.stageGroup.add(t.mesh);
    this.targets.push(t);
    return t;
  },
  removeTarget(t) {
    t.dead = true;
    if (t.base) this.stageGroup.remove(t.base);
    if (t.mesh) this.stageGroup.remove(t.mesh);
  },
  // A paper target (threat / hostage / ring / friend / red / captor) at (x, y, z) facing (fx, fz).
  // A threat or a civilian is the Higgsfield standee (the print is the target) unless flat is
  // asked for (a paper sheet on a trolley); rings are always paper.
  paper(kind, x, y, z, opts = {}) {
    const mname = { threat: 'r3_target', red: 'r3_target', hostage: 'r3_hostage', friend: 'r3_hostage' }[kind];
    if (mname && !opts.flat && Assets.has(mname)) return this.standee(kind, mname, x, y, z, opts);
    const { fx = 0, fz = -2, stand = true, scale = 1 } = opts;
    const w = kind === 'captor' ? 0.7 : kind === 'ring' ? 0.6 : 0.56, h = kind === 'ring' ? 0.6 : 1.0;
    const base = new THREE.Group(); base.position.set(x, y, z);
    base.rotation.y = Math.atan2(fx - x, fz - z);
    const hinge = new THREE.Group(); base.add(hinge); hinge.scale.setScalar(scale);
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2 + (kind === 'ring' ? 0.25 : 0), 0);
    const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.paperTex(kind), roughness: 0.95, side: THREE.DoubleSide }));
    face.castShadow = true; hinge.add(face);
    if (stand) {
      for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, h + 0.3, 0.03), this.woodMat); st.position.set(sx * (w / 2 - 0.04), (h + 0.3) / 2 - 0.15 + (kind === 'ring' ? 0.25 : 0), -0.02); st.castShadow = true; hinge.add(st); }
    }
    const t = { kind, base, hinge, face, w, h, shape: 'plane', bad: kind === 'hostage' || kind === 'friend', paper: true };
    t.zone = (lx, ly) => this.paperZone(kind, lx, ly / 1);
    t.aimL = new THREE.Vector3(0, kind === 'ring' ? 0.55 : 0.52, 0); t.badL = new THREE.Vector3(0, 0.5, 0);
    return t;
  },
  // The model target: base (turned to face fx, fz) → hinge (pops / turns) → the model, its print
  // on the hinge's z = 0 plane and its feet at y = 0. Zones are read in model units.
  standee(kind, mname, x, y, z, { fx = 0, fz = -2, scale = 1 } = {}) {
    const H = 1.15 * scale, S = R3_STAND[mname];
    const base = new THREE.Group(); base.position.set(x, y, z);
    base.rotation.y = Math.atan2(fx - x, fz - z);
    const hinge = new THREE.Group(); base.add(hinge);
    const m = Assets.model(mname, { height: H });
    m.position.z = -S.face * H;
    hinge.add(m);
    const civ = mname === 'r3_hostage';
    const t = { kind, base, hinge, face: m, H, shape: 'plane', bad: civ, paper: true, model: true };
    t.zone = (lx, ly) => (civ ? r3civModelZone : r3tgtZone)(lx / H, ly / H - 0.5);
    t.aimL = new THREE.Vector3(0, (S.aim + 0.5) * H, 0); t.badL = t.aimL;
    t.headL = S.head != null ? new THREE.Vector3(0, (S.head + 0.5) * H, 0) : null;
    return t;
  },
  paperZone(kind, x, y) {
    if (kind === 'ring') { const r = Math.hypot(x, y - 0.55); return r < 0.05 ? 'bull' : r < 0.13 ? 'r10' : r < 0.21 ? 'r6' : r < 0.29 ? 'r3' : null; }
    if (kind === 'hostage' || kind === 'friend') return r3civZone(x, y) || (kind === 'friend' && r3silZone(x, y) ? 'civ' : null);
    if (kind === 'captor') { if (r3silZone(x, y, -0.06)) return 'civ'; const z = r3silZone(x, y, 0.17); return z ? (z === 'head' ? 'head' : 'body') : null; }
    return r3silZone(x, y);
  },
  // Points for a hit zone (before the combo).
  zonePts(t, zone) {
    if (t.pts) return typeof t.pts === 'function' ? t.pts(zone) : t.pts;
    return { head: 20, center: 12, body: 6, bull: 15, r10: 10, r6: 6, r3: 3, steel: 10 }[zone] || 5;
  },
  // A steel plate of radius r on its post: the Higgsfield gong (the whole post sways when hit), or
  // a plate hanging from a bar at height y until the model is in.
  steel(x, y, z, r, opts = {}) {
    if (Assets.has('r3_steel')) {
      const H = r / 0.167;
      const base = new THREE.Group(); base.position.set(x, 0, z); base.rotation.y = Math.atan2(-x, -z);
      const hinge = new THREE.Group(); base.add(hinge);
      const m = Assets.model('r3_steel', { height: H });
      m.position.z = -0.035 * H;
      m.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
      hinge.add(m);
      const t = { kind: 'steel', base, hinge, plate: m, r, cy: (0.167 + 0.5) * H, shape: 'plane', steel: true, model: true };
      t.zone = (lx, ly) => { const d = Math.hypot(lx, ly - t.cy); return d < r * 0.3 ? 'bull' : d < r ? 'steel' : null; };
      t.glow = (on) => m.traverse(o => { if (o.isMesh) o.material.emissive.setHex(on ? 0x2a6a2a : 0); });
      return t;
    }
    const base = new THREE.Group(); base.position.set(x, y, z); base.rotation.y = Math.atan2(-x, -z);
    const hinge = new THREE.Group(); base.add(hinge);
    const L = opts.chain || 0.5;
    const plate = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ map: this.steelTex(), roughness: 0.5, metalness: 0.3 }));
    plate.position.y = -L - r; plate.castShadow = true; hinge.add(plate);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 24), this.metalMat); back.rotation.x = Math.PI / 2; back.position.set(0, -L - r, -0.012); hinge.add(back);
    for (const sx of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, L, 4), this.metalMat); ch.position.set(sx * r * 0.5, -L / 2, 0); hinge.add(ch); }
    if (opts.frame !== false) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(r * 2 + 0.6, 0.08, 0.08), this.metalMat); base.add(beam);
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, y, 0.08), this.metalMat); p.position.set(sx * (r + 0.3), -y / 2, 0); p.castShadow = true; base.add(p); }
    }
    const t = { kind: 'steel', base, hinge, plate, r, cy: -L - r, shape: 'plane', steel: true, swing: 0, swingV: 0 };
    t.glow = (on) => plate.material.emissive.setHex(on ? 0x226622 : 0);
    t.zone = (lx, ly) => { const d = Math.hypot(lx, ly - t.cy); return d < r * 0.3 ? 'bull' : d < r ? 'steel' : null; };
    return t;
  },
  // Something round in the air: { mesh, r }.
  ball(kind, mesh, r) { return { kind, mesh, r, shape: 'sphere', v: new THREE.Vector3() }; },

  // ---------- the menu, the briefing, the countdown ----------
  rec() {
    const S = G.state || {};
    const R = S.range3d = S.range3d || { best: {} };
    R.best = R.best || {};
    return R;
  },
  stars(pct) { return pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 45 ? 1 : 0; },
  starStr(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); },
  menu() {
    this.mode = 'menu';
    this.clearStage();
    this.ads = false; this.trigger = false;
    this.lockOff();
    const R = this.rec();
    const card = (s) => { const b = R.best[s.id]; return `<button class="r3-card" data-s="${s.id}"><span class="r3-ic">${s.icon}</span><b>${s.name}</b><i>${fmt(s.desc)}</i><em>${b ? `<span class="r3-st">${this.starStr(b.stars)}</span> שיא ${b.pct}` : 'עוד לא ניסית'}</em></button>`; };
    this.panel(`<div class="r3-menu"><h2>🔫 מטווח נשק</h2>
      <p class="r3-sub">${fmt('מפקד המטווח: {@p_shalev}. [בחר/בחרי] מקצה — או את כל המסלול.')}</p>
      <div class="r3-cards">${R3_STAGE.map(card).join('')}</div>
      <div class="r3-row"><button class="btn" data-course>🏆 מסלול מלא — 6 מקצים</button></div>
      <p class="r3-ctl">${G.touch ? 'גרירה — לכוון · 🔥 — אש · 🎯 — כוונת · 🔄 — מחסנית · שם הנשק — להחליף · 🫁 — עצירת נשימה' : 'עכבר — לכוון (קליק נועל, Esc משחרר) · קליק — אש · קליק ימני — כוונת 🎯 · R — מחסנית · 1/2/3 — נשק · Shift — עצירת נשימה בצלף'}</p></div>`);
    const p = this.el.panel;
    p.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { Sound.click(); this.course = null; this.runs = []; this.brief(b.dataset.s); });
    p.querySelector('[data-course]').onclick = () => { Sound.click(); this.course = R3_STAGE.map(s => s.id); this.courseI = 0; this.runs = []; this.brief(this.course[0]); };
  },
  brief(id) {
    if (!R3_MODELS.every(n => Assets.has(n)) && !this.waited) {
      this.panel('<div class="r3-brief"><h2>⏳ מכינים את המטווח…</h2><p class="r3-sub">מעמידים מטרות, ממלאים מחסניות.</p></div>');
      const go = () => { if (this.waited || !this.box) return; this.waited = true; this.brief(id); };
      this.ready.then(go); setTimeout(go, 8000);
      return;
    }
    const s = R3_STAGE.find(x => x.id === id);
    this.mode = 'brief';
    this.stage = s;
    this.setLoadout(s.w, s.x3);
    this.buildStage(s);
    const n = this.course ? `מקצה ${this.courseI + 1}/${this.course.length} · ` : '';
    const wn = this.slots.map((k, i) => `${i + 1} ${R3_W[k].name}`).join(' · ');
    this.panel(`<div class="r3-brief"><h2>${s.icon} ${s.name}</h2><p class="r3-sub">${n}${s.time} שניות · ${wn}</p>
      <p>${fmt(s.desc)}</p><div class="r3-row"><button class="btn" data-go>▶ לקו האש</button>${this.course ? '' : '<button class="btn ghost" data-back>↩ מקצים</button>'}</div></div>`);
    const p = this.el.panel;
    p.querySelector('[data-go]').onclick = () => { Sound.click(); this.lockOn(); this.countdown(); };
    const back = p.querySelector('[data-back]'); if (back) back.onclick = () => { Sound.click(); this.menu(); };
  },
  countdown() {
    this.panel('');
    this.mode = 'count';
    this.cdT = 2.4;
    this.say(r3pick(R3_SAY.start));
    Sound.synth.tone(660, 0.12, 'square', 0.05);
  },

  // ---------- a stage ----------
  clearStage() {
    for (const t of this.targets || []) this.removeTarget(t);
    this.targets = [];
    if (this.stageGroup) while (this.stageGroup.children.length) this.stageGroup.remove(this.stageGroup.children[0]);
    for (const d of this.decals || []) this.scene.remove(d);
    this.decals = [];
    for (const f of this.fx || []) this.scene.remove(f.m);
    this.fx = [];
    this.stageBlockers = [];
    for (const d of this.doors || []) { d.k = 0; d.want = 0; d.pv.rotation.y = 0; }
  },
  buildStage(s) {
    this.clearStage();
    this.st = { def: s, id: s.id, t: 0, time: s.time, score: 0, shots: 0, hits: 0, heads: 0, bad: 0, combo: 0, bestCombo: 0, missRun: 0, reacts: [], bonus: 0, hurt: 0, over: false, wind: 0, endAt: null };
    this.look.yaw = Math.PI / 2; this.look.pitch = 0; this.recoil.p = this.recoil.y = 0;
    this.pos = new THREE.Vector3(0, R3_EYE, 0);
    this.STAGES[s.id].build.call(this, this.st);
  },
  startLive() {
    this.mode = 'live';
    Sound.whistle();
    this.big('אש!');
  },
  endStage(why) {
    const st = this.st;
    if (!st || st.over) return;
    st.over = true;
    this.mode = 'sum';
    this.trigger = false; this.ads = false;
    if (this.STAGES[st.id].end) this.STAGES[st.id].end.call(this, st);
    const pct = r3clamp(Math.round(100 * Math.max(0, st.score) / st.def.par), 0, 100);
    const stars = this.stars(pct);
    const acc = st.shots ? Math.round(100 * st.hits / st.shots) : 0;
    const R = this.rec(), prev = R.best[st.id];
    const isBest = !prev || pct > prev.pct || (pct === prev.pct && st.score > prev.score);
    if (isBest) R.best[st.id] = { score: Math.round(st.score), pct, stars };
    const run = { id: st.id, name: st.def.name, icon: st.def.icon, score: Math.round(st.score), pct, stars, acc, shots: st.shots, hits: st.hits, heads: st.heads, bad: st.bad, best: st.bestCombo, react: st.reacts.length ? Math.round(1000 * st.reacts.reduce((a, b) => a + b, 0) / st.reacts.length) : null, bonus: st.bonus, newBest: isBest && !!prev };
    this.runs.push(run);
    this.say(r3pick(R3_SAY.end));
    Sound.whistle();
    this.lockOff();
    const more = this.course && this.courseI < this.course.length - 1;
    const rows = [
      ['ניקוד', run.score + (st.bonus ? ` <small>(בונוס זמן ${st.bonus})</small>` : '')], ['דיוק', `${acc}% <small>(${st.hits}/${st.shots})</small>`],
      ['ראש / בול', st.heads], ['רצף הכי ארוך', `×${this.mult(st.bestCombo).toFixed(1)} (${st.bestCombo})`],
    ];
    if (st.bad) rows.push([st.id === 'sky' ? 'רחפן הצלם / אזרחים' : 'אזרחים שנפגעו', `<b class="r3-bad">${st.bad}</b>`]);
    if (run.react) rows.push(['זמן תגובה ממוצע', `${run.react} מ״ש`]);
    if (st.hurt) rows.push(['נפגעת', st.hurt]);
    this.panel(`<div class="r3-sum"><h2>${st.def.icon} ${st.def.name} — ${why === 'clear' ? 'הושלם!' : 'הזמן נגמר'}</h2>
      <div class="r3-big"><span class="r3-st">${this.starStr(stars)}</span> ${pct}<small>/100</small>${run.newBest ? ' <em class="r3-new">שיא חדש!</em>' : ''}</div>
      <table class="r3-tab">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
      <div class="r3-row">${more ? '<button class="btn" data-next>▶ המקצה הבא</button>' : '<button class="btn" data-fin>📋 לסיכום</button><button class="btn ghost" data-again>🔁 שוב</button>'}</div></div>`);
    const p = this.el.panel;
    const nx = p.querySelector('[data-next]'); if (nx) nx.onclick = () => { Sound.click(); this.courseI++; this.brief(this.course[this.courseI]); };
    const fin = p.querySelector('[data-fin]'); if (fin) fin.onclick = () => { Sound.click(); this.results(); };
    const ag = p.querySelector('[data-again]'); if (ag) ag.onclick = () => { Sound.click(); this.runs.pop(); this.brief(st.id); };
  },
  // The card at the end, like every mini-game's; done() reports success and a 0–100 score.
  results() {
    const runs = this.runs;
    if (!runs.length) { this.menu(); return; }
    const pct = Math.round(runs.reduce((a, r) => a + r.pct, 0) / runs.length);
    const stars = this.stars(pct), shots = runs.reduce((a, r) => a + r.shots, 0), hits = runs.reduce((a, r) => a + r.hits, 0);
    const acc = shots ? Math.round(100 * hits / shots) : 0, bad = runs.reduce((a, r) => a + r.bad, 0);
    const R = this.rec(), S = G.state || {};
    if (R.day !== S.day) { R.day = S.day; R.paid = 0; }
    // A prize the first three times a day: money by the stars, morale by how it went.
    let money = 0, morale = 0;
    if ((R.paid || 0) < 3) {
      money = runs.length > 1 ? Math.min(25, runs.reduce((a, r) => a + [0, 2, 4, 7][r.stars], 0)) : [0, 2, 4, 7][stars];
      morale = stars >= 2 ? 3 : stars === 1 ? 1 : -1;
      R.paid = (R.paid || 0) + 1;
      if (money && S.money != null) { S.money += money; Sound.coin(); }
      if (morale && typeof Game !== 'undefined' && Game.addStat) Game.addStat('morale', morale);
    }
    const shells = runs.reduce((a, r) => a + r.shots, 0);
    const success = pct >= 50;
    const done = this.done;
    this.mode = 'res';
    this.release();
    const title = runs.length > 1 ? '🔫 מטווח נשק — מסלול מלא' : `${runs[0].icon} ${runs[0].name}`;
    const lines = [
      `דיוק ${acc}% · ${hits} פגיעות מתוך ${shots} כדורים${bad ? ` · <b style="color:var(--red)">${bad} אזרחים/רחפנים</b>` : ''}`,
      money || morale ? `פרס: ${money ? `₪${money}` : ''}${money && morale ? ' · ' : ''}${morale ? `מורל ${morale > 0 ? '+' : ''}${morale}` : ''}` : 'הפרסים של היום כבר חולקו (עד 3 בכל יום).',
      `{@p_shalev}: "${pct >= 90 ? 'קלע[/ית] מצטיי[ן/נת]. אני כותב את זה בפנקס.' : pct >= 70 ? 'יפה מאוד. עוד קצת ואני מעביר אותך לגולני.' : pct >= 50 ? 'עברת. המטרות שרדו בקושי.' : 'צריך עוד אימון. המטרות צוחקות.'}"`,
      `{@harasar}: "ספרתי ${shells} תרמילים. אני רוצה ${shells} תרמילים בחזרה."`,
    ];
    Mini.result(this.box, { title, big: `${this.starStr(stars)} ${pct}/100`, ok: success, lines }, () => done && done({ success, score: pct, stars, accuracy: acc, mode: 'weapons' }));
    if (runs.length > 1) {
      const tab = `<table class="r3-res">${runs.map(r => `<tr><td>${r.icon} ${r.name}</td><td class="r3-st">${this.starStr(r.stars)}</td><td>${r.pct}</td></tr>`).join('')}</table>`;
      const act = this.box.querySelector('.actions'); if (act) act.insertAdjacentHTML('beforebegin', tab);
    }
  },

  // ---------- each frame ----------
  frame(dt) {
    if (!this.box || this.mode === 'res' || this.mode === 'off') return;
    this.dt = dt; this.time += dt;
    const st = this.st;
    if (this.mode === 'count') {
      this.cdT -= dt;
      const n = Math.ceil(this.cdT / 0.8);
      if (n !== this.cdN && n > 0) { this.cdN = n; this.big(String(n)); Sound.synth.tone(880, 0.08, 'square', 0.05); }
      if (this.cdT <= 0) { this.cdN = null; this.startLive(); }
    }
    if (this.mode === 'live' && st) {
      st.t += dt;
      this.STAGES[st.id].tick.call(this, st, dt);
      if (!st.over && st.t >= st.time) this.endStage('time');
    } else if (st && this.mode === 'count' && this.STAGES[st.id].idle) this.STAGES[st.id].idle.call(this, st, dt);
    this.player(dt);
    this.scene.updateMatrixWorld();
    for (const t of this.targets) if (t.hinge) { t.inv = t.inv || new THREE.Matrix4(); t.inv.copy(t.hinge.matrixWorld).invert(); }
    this.bulletsStep(dt);
    this.fxStep(dt);
    this.camStep(dt);
    this.hud();
    if (!this.noRender) this.render(Scene3D.renderer);
  },
  // Weapon timers, the trigger, aiming, recoil and the sniper's sway.
  player(dt) {
    const W = R3_W[this.w];
    this.cool = Math.max(0, this.cool - dt);
    this.bloom = Math.max(0, this.bloom - dt * 0.08);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.reloadT = 0; this.ammo[this.w] = W.mag; } }
    if (this.drawT > 0) this.drawT -= dt;
    if (this.boltT > 0) this.boltT -= dt;
    const live = this.mode === 'live';
    const wantAds = (this.ads && live && this.reloadT <= 0) ? 1 : 0;
    this.adsK += (wantAds - this.adsK) * Math.min(1, dt * (W.scope ? 9 : 12));
    if (Math.abs(wantAds - this.adsK) < 0.002) this.adsK = wantAds;
    if (live && this.trigger) this.tryFire();
    // The recoil comes back down by itself.
    this.recoil.p -= this.recoil.p * Math.min(1, dt * 5.5); this.recoil.y -= this.recoil.y * Math.min(1, dt * 5.5);
    // The scope breathes; Shift / 🫁 holds the breath (for three seconds, then it shakes).
    if (this.holdBreath && this.breath > 0) this.breath = Math.max(0, this.breath - dt);
    else this.breath = Math.min(3, this.breath + dt * (this.holdBreath ? 0 : 0.7));
    const scoped = W.scope && this.adsK > 0.5;
    const k = scoped ? (this.holdBreath ? (this.breath > 0 ? 0.12 : 1.8) : 1) : 0;
    const t = this.time;
    const sx = (Math.sin(t * 0.9) * 0.0024 + Math.sin(t * 2.3) * 0.0009) * k, sy = (Math.cos(t * 0.7) * 0.0019 + Math.sin(t * 1.9) * 0.0008) * k;
    this.sway.x += (sx - this.sway.x) * Math.min(1, dt * 6); this.sway.y += (sy - this.sway.y) * Math.min(1, dt * 6);
    // A distant lane fires now and then (it's a busy range).
    if ((this.mode === 'live' || this.mode === 'menu') && (this.nextNeighbor -= dt) <= 0) {
      this.nextNeighbor = r3rnd(1.5, 4.5);
      const n = Math.random() < 0.4 ? 3 : 1;
      for (let i = 0; i < n; i++) Sound.synth.later(i * 110, () => { Sound.synth.noise(0.12, 0.05, 1400); Sound.synth.noise(0.3, 0.03, 300, 'lowpass'); });
    }
  },
  aimYaw() { return this.look.yaw + this.recoil.y + this.sway.x; },
  aimPitch() { return this.look.pitch + this.recoil.p + this.sway.y; },
  camStep(dt) {
    const c = this.camera, st = this.st;
    if (this.mode === 'menu' || !st) {
      // Over the range: the tower, the line, the berms.
      const t = this.time * 0.12;
      c.position.set(-4 + Math.sin(t) * 5, 4.2, -9 + Math.cos(t * 0.7) * 1.5);
      c.lookAt(Math.sin(t) * 3, 1.2, 30);
      c.fov = 60; c.updateProjectionMatrix();
      return;
    }
    const W = R3_W[this.w];
    const fov = 72 + (W.fov - 72) * this.adsK * (W.scope ? (this.adsK > 0.85 ? 1 : 0.4) : 1);
    if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix(); }
    c.position.copy(this.pos);
    if (this.shake > 0) { c.position.x += (Math.random() - 0.5) * this.shake * 0.15; c.position.y += (Math.random() - 0.5) * this.shake * 0.15; this.shake = Math.max(0, this.shake - dt); }
    const yaw = this.aimYaw(), pit = this.aimPitch();
    c.lookAt(c.position.x + Math.cos(yaw) * Math.cos(pit), c.position.y + Math.sin(pit), c.position.z + Math.sin(yaw) * Math.cos(pit));
    this.viewModel(dt);
  },
  // The gun in the corner: sway, recoil, reload, draw; with the sights on the axis when aiming.
  viewModel(dt) {
    const W = R3_W[this.w], g = this.vmGuns[this.w];
    for (const k of Object.keys(this.vmGuns)) this.vmGuns[k].visible = k === this.w;
    if (!g) return;
    const t = this.time, a = this.adsK, e = a * a * (3 - 2 * a);
    this.kick = Math.max(0, this.kick - dt * 9);
    const kk = this.kick * this.kick;
    const [hx, hy, hz] = W.hip, ey = g.userData.eye || { x: 0, y: 0.1, z: 0, d: 0.2 };
    // Where the gun sits with the sight point on the axis, d in front of the eye (the gun is
    // turned round, so its +z is forward).
    const ax = ey.x, ay = -ey.y, az = -ey.d + ey.z;
    let x = hx + (ax - hx) * e, y = hy + (ay - hy) * e, z = hz + (az - hz) * e;
    let rx = 0.02 * (1 - e), ry = (this.w === 'pistol' ? 0.04 : 0.05) * (1 - e), rz = 0;
    x += Math.sin(t * 1.3) * 0.003 * (1 - e * 0.8); y += Math.sin(t * 1.9) * 0.003 * (1 - e * 0.8);
    const dyaw = this.lastYaw != null ? this.look.yaw - this.lastYaw : 0; this.lastYaw = this.look.yaw;
    this.vsway = (this.vsway || 0) * Math.exp(-dt * 10) + r3clamp(dyaw, -0.04, 0.04) * 0.5;
    ry -= this.vsway * 0.6 * (1 - e * 0.7); x -= this.vsway * 0.15 * (1 - e);
    z += kk * (this.w === 'pistol' ? 0.04 : this.w === 'sniper' ? 0.09 : 0.05) * (1 - e * 0.4); rx += kk * (this.w === 'pistol' ? 0.2 : 0.08) * (1 - e * 0.6); y += kk * 0.01;
    if (this.reloadT > 0) {
      const p = 1 - this.reloadT / W.reload, s = Math.sin(Math.min(1, p) * Math.PI);
      rz += s * 0.7; rx -= s * 0.25; y -= s * 0.06; x -= s * 0.03;
      if (g.userData.lh) g.userData.lh.position.y = g.userData.lhY - Math.sin(Math.min(1, p * 1.6) * Math.PI) * 0.18;
    } else if (g.userData.lh) g.userData.lh.position.y = g.userData.lhY;
    if (this.boltT > 0 && this.adsK < 0.5) { const s = Math.sin((1 - this.boltT / W.rate) * Math.PI); rz -= s * 0.25; y -= s * 0.02; if (g.userData.rh) g.userData.rh.position.y = -0.07 + s * 0.05; }
    if (this.drawT > 0) { const p = this.drawT / W.draw; y -= p * p * 0.3; rx -= p * 0.8; }
    g.position.set(x, y, z);
    g.rotation.set(rx, Math.PI + ry, rz);
    // Looking through the scope: the gun is out of the way, the overlay shows.
    g.visible = !(W.scope && this.adsK > 0.85);
    const mz = g.userData.muzzle.getWorldPosition(new THREE.Vector3());
    const fl = this.vmFlashN > 0;
    this.vmFlash.visible = fl && g.visible;
    if (fl) { this.vmFlash.material.map = this.flashTex[2 - this.vmFlashN]; this.vmFlashN--; }
    this.vmFlash.position.copy(mz).add(new THREE.Vector3(0, 0, -0.04));
    this.vmFlash.scale.setScalar(this.w === 'pistol' ? 0.16 : this.w === 'negev' ? 0.24 : 0.2);
    this.vmLight.position.copy(mz).add(new THREE.Vector3(0, 0.05, -0.15)); this.vmLight.intensity = fl ? 0.9 : 0;
    // The holographic reticle: the same size on any screen, brighter when you look through it.
    if (g.userData.dot) {
      const d = g.userData.dot;
      d.scale.setScalar(Math.max(56, innerHeight * 0.085) * 2 * Math.tan(this.vmCam.fov * Math.PI / 360) * ey.d / Math.max(1, innerHeight));
      d.material.opacity = 0.35 + 0.65 * e;
    }
    for (const s of this.shells) { s.t += dt; s.vy -= 6 * dt; s.m.position.x += s.vx * dt * 0.4; s.m.position.y += s.vy * dt * 0.4; s.m.position.z += s.vz * dt * 0.4; s.m.rotation.x += s.r * dt; s.m.rotation.y += s.r * 0.7 * dt; }
    this.shells = this.shells.filter(s => { if (s.t < 0.7) return true; this.vmScene.remove(s.m); return false; });
  },
  render(renderer) {
    if (!renderer) return;
    const s = renderer.getSize(new THREE.Vector2()), a = s.x / Math.max(1, s.y);
    if (Math.abs(this.camera.aspect - a) > 0.001) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }
    if (this.sun.castShadow !== (typeof Settings === 'undefined' || Settings.shadows())) this.sun.castShadow = !this.sun.castShadow;
    renderer.render(this.scene, this.camera);
    if (this.st && this.mode !== 'menu') {
      if (Math.abs(this.vmCam.aspect - a) > 0.001) { this.vmCam.aspect = a; this.vmCam.updateProjectionMatrix(); }
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      // (The last thing drawn may have left depth writes off, and then a clear does nothing.)
      renderer.state.buffers.depth.setMask(true);
      renderer.clearDepth();
      renderer.render(this.vmScene, this.vmCam);
      renderer.autoClear = ac;
    }
  },

  // ---------- weapons ----------
  swap(w) {
    if (!this.slots.includes(w) || this.w === w) return;
    this.w = w; this.reloadT = 0; this.drawT = R3_W[w].draw; this.cool = Math.max(this.cool, R3_W[w].draw * 0.8); this.semiHeld = true; this.boltT = 0;
    Sound.synth.tone(500, 0.04, 'square', 0.03); Sound.synth.later(120, () => Sound.synth.tone(900, 0.03, 'square', 0.03));
  },
  cycle() { const i = this.slots.indexOf(this.w); this.swap(this.slots[(i + 1) % this.slots.length]); },
  reload() {
    const W = R3_W[this.w];
    if (this.reloadT > 0 || this.ammo[this.w] >= W.mag || this.mode === 'menu') return false;
    this.reloadT = W.reload;
    const at = Sound.synth.now();
    Sound.synth.tone(1400, 0.03, 'square', 0.05, null, at + 0.15); Sound.synth.noise(0.08, 0.12, 2400, 'bandpass', at + 0.25);
    Sound.synth.tone(900, 0.04, 'square', 0.06, null, at + W.reload * 0.62); Sound.synth.tone(1800, 0.03, 'square', 0.06, null, at + W.reload * 0.88);
    if (this.ammo[this.w] === 0 && Math.random() < 0.5) this.say(r3pick(R3_SAY.empty));
    return true;
  },
  tryFire() {
    const W = R3_W[this.w];
    if (this.cool > 0 || this.reloadT > 0 || this.drawT > 0.05) return false;
    if (!W.auto && this.semiHeld) return false;
    if (this.ammo[this.w] <= 0) {
      this.cool = 0.25; Sound.synth.tone(2200, 0.02, 'square', 0.05);
      this.reload();
      return false;
    }
    this.ammo[this.w]--;
    this.cool = W.rate;
    if (!W.auto) this.semiHeld = !G.touch || W.scope;
    if (W.scope) this.boltT = W.rate;
    this.fire();
    return true;
  },
  // The direction a shot leaves at (the sniper is zeroed at 100 m: a hair above the line).
  launch(yaw, pitch, W) {
    if (W.zero) pitch += 0.5 * 9.8 * (W.zero / W.speed) ** 2 / W.zero;
    return new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
  },
  fire() {
    const W = R3_W[this.w], st = this.st;
    const scoped = W.scope && this.adsK > 0.85;
    let spread = (W.scope ? (scoped ? W.ads : W.spread) : W.spread + (W.ads - W.spread) * this.adsK) + this.bloom;
    this.bloom = Math.min(W.bloomMax, this.bloom + W.bloom);
    const r = spread * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
    const d = this.launch(this.aimYaw() + Math.cos(th) * r, this.aimPitch() + Math.sin(th) * r, W);
    const o = this.camera.position.clone();
    const b = { p: o.clone(), v: d.multiplyScalar(W.speed), w: this.w, d: 0, dmg: W.dmg, shotAt: this.time, pitch: this.aimPitch() };
    if (Math.random() < W.tracer) { b.m = new THREE.Mesh(this.tracerGeo, this.tracerMat); b.m.visible = false; this.scene.add(b.m); }
    this.bullets.push(b);
    if (st) st.shots++;
    // Recoil: up and a little sideways (less when aiming); the gun kicks back.
    const k = W.kick * (0.8 + Math.random() * 0.4) * (1 - this.adsK * 0.35);
    this.recoil.p += k; this.recoil.y += (Math.random() - 0.5) * k * 0.5;
    this.kick = 1;
    this.vmFlashN = 2; this.vmFlash.material.rotation = Math.random() * 6;
    this.ejectShell();
    this.flashLight.position.copy(o).add(new THREE.Vector3(Math.cos(this.look.yaw) * 0.8, -0.2, Math.sin(this.look.yaw) * 0.8)); this.flashLight.intensity = 2;
    this.shake = Math.max(this.shake, this.w === 'sniper' ? 0.25 : this.w === 'pistol' ? 0.1 : 0.06);
    const S = Sound.synth;
    if (this.w === 'rifle') { S.noise(0.11, 0.42, 2600); S.noise(0.28, 0.22, 420, 'lowpass'); S.tone(120, 0.07, 'square', 0.05, 50); }
    else if (this.w === 'pistol') { S.noise(0.08, 0.38, 3400); S.tone(190, 0.06, 'square', 0.05, 80); S.noise(0.18, 0.12, 600, 'lowpass'); }
    else if (this.w === 'negev') { S.noise(0.1, 0.45, 2000); S.noise(0.3, 0.26, 340, 'lowpass'); S.tone(90, 0.08, 'square', 0.06, 40); }
    else {
      S.noise(0.22, 0.6, 1800); S.noise(0.9, 0.3, 280, 'lowpass'); S.tone(62, 0.25, 'sine', 0.2, 35);
      S.later(420, () => S.noise(0.7, 0.08, 500, 'lowpass'));
      S.later(520, () => { S.tone(700, 0.04, 'square', 0.04); S.noise(0.05, 0.08, 2600, 'bandpass'); });
      S.later(760, () => { S.tone(1100, 0.04, 'square', 0.04); S.noise(0.05, 0.08, 3000, 'bandpass'); });
    }
  },
  ejectShell() {
    const g = this.vmGuns[this.w]; if (!g || !g.visible) return;
    const m = new THREE.Mesh(this.shellGeo, this.shellMat);
    const base = new THREE.Vector3(0.03, 0.03, this.w === 'pistol' ? 0 : -0.1); g.localToWorld(base);
    m.position.copy(base); this.vmScene.add(m);
    this.shells.push({ m, t: 0, vx: 0.8 + Math.random() * 0.5, vy: 0.9 + Math.random() * 0.4, vz: 0.1 + Math.random() * 0.2, r: Math.random() * 20 });
    if (this.shells.length > 14) this.vmScene.remove(this.shells.shift().m);
    Sound.synth.later(380 + Math.random() * 200, () => Sound.synth.tone(3800 + Math.random() * 900, 0.04, 'sine', 0.012));
  },

  // ---------- bullets in flight ----------
  bulletsStep(dt) {
    const wind = this.st ? this.st.wind : 0;
    const keep = [];
    for (const b of this.bullets) {
      const speed = b.v.length();
      const n = Math.max(1, Math.ceil(speed * dt / 12)), h = dt / n;
      let hit = null;
      const from = b.p.clone();
      for (let i = 0; i < n && !hit; i++) {
        const a = b.p.clone();
        b.v.y -= 9.8 * h; b.v.x += wind * 1.6 * h;
        b.p.addScaledVector(b.v, h);
        b.d += speed * h;
        hit = this.traceSeg(a, b.p);
        if (hit) b.p.copy(hit.p);
      }
      // The tracer: a streak behind the bullet, starting a few metres out.
      if (b.m) {
        const L = Math.min(b.d - 3, Math.max(4, b.p.distanceTo(from) * 0.9));
        if (L > 0.5) { b.m.visible = true; b.m.position.copy(b.p); b.m.lookAt(b.p.x - b.v.x, b.p.y - b.v.y, b.p.z - b.v.z); b.m.scale.set(b.w === 'sniper' ? 1.4 : 1, b.w === 'sniper' ? 1.4 : 1, L); }
      }
      if (hit) { this.resolve(b, hit); if (b.m) this.scene.remove(b.m); continue; }
      if (b.d > 1300 || b.p.y < -2) { this.miss(b, null); if (b.m) this.scene.remove(b.m); continue; }
      keep.push(b);
    }
    this.bullets = keep;
  },
  // The nearest thing between a and b: a target (in its own frame), a wall / berm / tower, the ground.
  traceSeg(a, b) {
    let best = null;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const la = new THREE.Vector3(), lb = new THREE.Vector3();
    for (const t of this.targets) {
      if (t.dead || !t.alive || !this.hittable(t)) continue;
      if (t.shape === 'plane') {
        la.copy(a).applyMatrix4(t.inv); lb.copy(b).applyMatrix4(t.inv);
        if (!(la.z > 0 && lb.z <= 0)) continue;
        const k = la.z / (la.z - lb.z);
        if (best && k >= best.k) continue;
        const lx = la.x + (lb.x - la.x) * k, ly = la.y + (lb.y - la.y) * k;
        const zone = t.zone(lx, ly);
        if (zone) best = { k, t, zone, lx, ly };
      } else {
        const c = t.mesh.position, fx = a.x - c.x, fy = a.y - c.y, fz = a.z - c.z;
        const A = dx * dx + dy * dy + dz * dz, B = 2 * (fx * dx + fy * dy + fz * dz), C = fx * fx + fy * fy + fz * fz - t.r * t.r;
        const disc = B * B - 4 * A * C;
        if (disc < 0) continue;
        const k = (-B - Math.sqrt(disc)) / (2 * A);
        if (k < 0 || k > 1 || (best && k >= best.k)) continue;
        best = { k, t, zone: 'ball' };
      }
    }
    for (const list of [this.blockers, this.stageBlockers]) for (const o of list) {
      // Slabs.
      let t0 = 0, t1 = 1, nx = 0, ny = 0, nz = 0;
      const ax = [[a.x, dx, o.x0, o.x1, 'x'], [a.y, dy, o.y0, o.y1, 'y'], [a.z, dz, o.z0, o.z1, 'z']];
      let ok = true;
      for (const [p, d, lo, hi, axis] of ax) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { ok = false; break; } continue; }
        let u0 = (lo - p) / d, u1 = (hi - p) / d, sign = -1;
        if (u0 > u1) { const tmp = u0; u0 = u1; u1 = tmp; sign = 1; }
        if (u0 > t0) { t0 = u0; nx = axis === 'x' ? sign : 0; ny = axis === 'y' ? sign : 0; nz = axis === 'z' ? sign : 0; }
        t1 = Math.min(t1, u1);
        if (t0 > t1) { ok = false; break; }
      }
      if (!ok || (best && t0 >= best.k) || t0 <= 0) continue;
      best = { k: t0, block: o, n: new THREE.Vector3(nx, ny, nz) };
    }
    if (a.y > 0 && b.y <= 0) { const k = a.y / (a.y - b.y); if (!best || k < best.k) best = { k, ground: true, n: new THREE.Vector3(0, 1, 0) }; }
    if (!best) return null;
    best.p = new THREE.Vector3(a.x + dx * best.k, a.y + dy * best.k, a.z + dz * best.k);
    return best;
  },
  hittable(t) { return t.up > 0.6 && !t.down; },
  // What a bullet did when it stopped.
  resolve(b, hit) {
    const st = this.st;
    if (hit.t) {
      const t = hit.t;
      if (t.paper) this.hole(t, hit.lx, hit.ly);
      if (t.steel) this.lead(t, hit.lx, hit.ly);
      if (t.shape === 'sphere') this.spark(hit.p.x, hit.p.y, hit.p.z, 0, 0, -1);
      if (st && !st.over && this.mode === 'live') this.STAGES[st.id].hit.call(this, st, t, hit.zone, hit, b);
      return;
    }
    if (hit.block) {
      const o = hit.block, n = hit.n;
      if (o.kind === 'berm') this.dust(hit.p, 1);
      else this.impact(hit.p.x, hit.p.y, hit.p.z, n.x, n.y, n.z);
      if (o.kind === 'tower' && st && this.mode === 'live') { this.penalty(25, hit.p, 'המגדל!'); this.say(r3pick(R3_SAY.tower), 'p_shalev', true); Sound.synth.tone(300, 0.3, 'sawtooth', 0.08, 120); }
      else if (o.kind === 'bags' && Math.random() < 0.35) this.say(r3pick(R3_SAY.bags));
    } else if (hit.ground) this.dust(hit.p, 0.6);
    this.miss(b, hit);
  },
  miss(b, hit) {
    const st = this.st;
    if (!st || st.over || this.mode !== 'live') return;
    st.missRun++;
    if (st.missRun >= (R3_W[b.w].auto ? 4 : 1) && st.combo) { st.combo = 0; }
    if (st.missRun === 6 && Math.random() < 0.7) this.say(r3pick(R3_SAY.miss));
    if (!hit && b.pitch > 0.4 && st.id !== 'sky' && Math.random() < 0.6) this.say(r3pick(R3_SAY.sky));
  },
  mult(c) { return Math.min(3, 1 + Math.floor(c / 3) * 0.5); },
  // A scoring hit: points × the combo, a popup where it hit, the hit marker.
  award(base, at, label = '', opts = {}) {
    const st = this.st;
    st.combo++; st.missRun = 0; st.hits++;
    st.bestCombo = Math.max(st.bestCombo, st.combo);
    const m = this.mult(st.combo), pts = Math.round(base * m);
    st.score += pts;
    if (opts.head) st.heads++;
    this.popup(at, `+${pts}${label ? ' ' + label : ''}`, opts.head ? 'head' : '');
    this.hm = 0.22; this.hmKill = !!opts.kill;
    Sound.synth.tone(opts.head ? 2400 : 1500, 0.05, 'triangle', opts.head ? 0.12 : 0.08);
    if (st.combo === 9) this.say(r3pick(R3_SAY.streak));
    if (opts.head && (st.heads === 3 || st.heads === 8)) this.say(r3pick(R3_SAY.head));
    return pts;
  },
  penalty(pts, at, label) {
    const st = this.st;
    st.score -= pts; st.combo = 0; st.bad++;
    this.popup(at, `−${pts} ${label}`, 'bad');
    this.hurtFx = Math.max(this.hurtFx, 0.35);
    Sound.bad();
  },

  // ---------- effects ----------
  hole(t, lx, ly) {
    if (t.holes > 24) return;
    t.holes++;
    const h = new THREE.Mesh(this.holeGeo, this.holeMat); h.position.set(lx, ly, 0.004); t.hinge.add(h);
    const p = t.hinge.localToWorld(new THREE.Vector3(lx, ly, 0.05));
    this.puff(p.x, p.y, p.z, 0xf0ead8, 0.12, 0.35, 0.2);
    Sound.synth.noise(0.04, 0.08, 3200, 'bandpass');
  },
  lead(t, lx, ly) {
    if (t.holes > 30) return;
    t.holes++;
    const h = new THREE.Mesh(this.holeGeo, this.leadMat); h.scale.setScalar(2.2); h.position.set(lx, ly, 0.004); t.hinge.add(h);
    const p = t.hinge.localToWorld(new THREE.Vector3(lx, ly, 0.05));
    for (let i = 0; i < 5; i++) this.spark(p.x, p.y, p.z, r3rnd(-1, 1), r3rnd(-0.2, 1), -0.4);
    // The ding comes back at the speed of sound.
    const dist = p.distanceTo(this.pos);
    Sound.synth.later(Math.min(1400, dist / 0.343), () => { Sound.synth.tone(1850 + Math.random() * 200, 0.7, 'sine', Math.max(0.03, 0.14 - dist / 4000)); Sound.synth.tone(2780, 0.45, 'sine', 0.04); });
  },
  impact(x, y, z, nx, ny, nz) {
    for (let i = 0; i < 4; i++) this.spark(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03, nx, ny, nz);
    this.puff(x + nx * 0.1, y + ny * 0.1, z + nz * 0.1, 0xc8a878, 0.35, 0.5);
    const d = new THREE.Mesh(this.decalGeo, this.decalMat);
    d.position.set(x + nx * 0.012, y + ny * 0.012, z + nz * 0.012); d.lookAt(x + nx, y + ny, z + nz);
    this.scene.add(d); this.decals.push(d);
    if (this.decals.length > 80) this.scene.remove(this.decals.shift());
    if (this.pos && Math.hypot(x - this.pos.x, z - this.pos.z) < 20) Sound.synth.tone(2600 + Math.random() * 1400, 0.03, 'triangle', 0.02);
  },
  dust(p, big) {
    const far = Math.max(1, p.distanceTo(this.pos || p) / 40);
    for (let i = 0; i < 3; i++) this.puff(p.x + r3rnd(-0.1, 0.1), p.y + 0.1, p.z + r3rnd(-0.1, 0.1), 0xd8b080, 0.5 * big * Math.min(far, 4), 0.9, 0.9);
    this.spark(p.x, p.y + 0.05, p.z, 0, 1, 0);
  },
  spark(x, y, z, nx, ny, nz, color = 0xffd080) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, z); m.scale.setScalar(0.08); this.scene.add(m);
    const s = 2 + Math.random() * 3;
    this.fx.push({ m, t: 0, life: 0.25, s: 0.08, vx: (nx + (Math.random() - 0.5) * 1.4) * s, vy: (ny + Math.random() * 0.8) * s, vz: (nz + (Math.random() - 0.5) * 1.4) * s, g: 9 });
  },
  puff(x, y, z, color, size, life = 0.9, vy = 0.5) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color, transparent: true, depthWrite: false, opacity: 0.6 }));
    m.position.set(x, y, z); m.scale.setScalar(size); this.scene.add(m);
    this.fx.push({ m, t: 0, life, s: size, vx: (Math.random() - 0.5) * 0.4, vy, vz: (Math.random() - 0.5) * 0.4, g: 0, grow: true });
    if (this.fx.length > 220) { const f = this.fx.shift(); this.scene.remove(f.m); }
  },
  // Pieces flying off (a clay plate, a balloon, the drone).
  shards(p, color, n = 8, size = 0.06, sp = 4) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.3, size * 0.8), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      m.position.copy(p); this.scene.add(m);
      this.fx.push({ m, t: 0, life: 1.2, s: 1, vx: r3rnd(-1, 1) * sp, vy: r3rnd(0, 1.4) * sp, vz: r3rnd(-1, 1) * sp, g: 9.8, solid: true, rx: r3rnd(-12, 12) });
    }
  },
  fxStep(dt) {
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 30);
    this.hurtFx = Math.max(0, this.hurtFx - dt * 0.8);
    this.hm = Math.max(0, this.hm - dt);
    for (const f of this.fx) {
      f.t += dt;
      f.vy -= f.g * dt;
      f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
      const k = f.t / f.life;
      if (f.solid) { f.m.rotation.x += f.rx * dt; f.m.rotation.y += f.rx * 0.6 * dt; if (f.m.position.y < 0.02) { f.m.position.y = 0.02; f.vx *= 0.5; f.vz *= 0.5; f.vy = 0; f.rx = 0; } }
      else { if (f.grow) f.m.scale.setScalar(f.s * (1 + k * 1.6)); f.m.material.opacity = (f.grow ? 0.6 : 1) * (1 - k); }
    }
    this.fx = this.fx.filter(f => { if (f.t < f.life) return true; this.scene.remove(f.m); return false; });
    // The flags.
    const wind = this.st ? this.st.wind : 0;
    for (const fl of this.flags) {
      const arr = fl.geo.attributes.position.array, t = this.time * 6 + fl.ph;
      for (let i = 0; i < arr.length; i += 3) { const x = fl.base[i]; arr[i + 2] = fl.base[i + 2] + Math.sin(x * 4 - t) * 0.08 * x; }
      fl.geo.attributes.position.needsUpdate = true;
      // Pointing downwind (the wind blows along x): the long stage's flags show it.
      const want = this.windFlagSet && this.windFlagSet.includes(fl) ? (wind >= 0 ? 0 : Math.PI) + (1 - Math.min(1, Math.abs(wind) / 3)) * 0.9 : 0.6;
      fl.f.rotation.y += (want - fl.f.rotation.y) * Math.min(1, dt * 2);
      fl.f.rotation.z = this.windFlagSet && this.windFlagSet.includes(fl) ? -(1 - Math.min(1, Math.abs(wind) / 3)) * 1.1 : -0.15;
    }
    // The range officer stands in the tower window (the cast's own model).
    if (this.officerM) { try { Arcade.pose(this.officerM, 0, 0, Math.PI / 2 + Math.sin(this.time * 0.4) * 0.3, 0, dt); } catch (e) { this.officerM = null; } }
    // The killhouse doors.
    for (const d of this.doors || []) { d.k += ((d.want || 0) - d.k) * Math.min(1, dt * 6); d.pv.rotation.y = d.open * d.k; }
  },
  popup(at, text, cls) {
    if (!this.el) return;
    const p = at.clone().project(this.camera);
    if (p.z > 1) return;
    const e = document.createElement('div');
    e.className = `r3-pop ${cls || ''}`; e.textContent = text;
    e.style.left = `${((p.x + 1) / 2 * 100).toFixed(1)}%`; e.style.top = `${((1 - p.y) / 2 * 100).toFixed(1)}%`;
    this.el.pops.appendChild(e);
    setTimeout(() => e.remove(), 900);
  },
  big(text) {
    if (!this.el) return;
    const b = this.el.big; b.textContent = text; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  },
  // The loudspeaker.
  say(text, who = 'p_shalev', force = false) {
    if (!this.el) return;
    const now = performance.now();
    if (!force && now < this.sayUntil - 1400) return;
    this.sayUntil = now + 2800;
    this.el.say.innerHTML = `<b>📢 ${fmt(`{@${who}}`)}:</b> ${fmt(text)}`;
    this.el.say.classList.add('on');
    clearTimeout(this.sayT);
    this.sayT = setTimeout(() => { if (this.el) this.el.say.classList.remove('on'); }, 2800);
    Sound.synth.noise(0.06, 0.05, 2800, 'bandpass'); Sound.synth.tone(1200, 0.05, 'square', 0.015);
  },

  // ---------- the overlay ----------
  ui() {
    const touch = !!G.touch;
    this.box.innerHTML = `<div class="r3-hud ${touch ? 'touch' : ''}">
      <div class="r3-scope"><svg viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet"><circle r="99" fill="none" stroke="#000" stroke-width="2"/>
        <line x1="-99" y1="0" x2="-8" y2="0"/><line x1="8" y1="0" x2="99" y2="0"/><line x1="0" y1="-99" x2="0" y2="-8"/><line x1="0" y1="8" x2="0" y2="99"/>
        ${[1, 2, 3, 4, 5].map(i => `<line class="m" x1="-3" y1="${i * 10}" x2="3" y2="${i * 10}"/><text x="6" y="${i * 10 + 2.5}">${i}</text><line class="m" x1="${i * 10}" y1="-2" x2="${i * 10}" y2="2"/><line class="m" x1="${-i * 10}" y1="-2" x2="${-i * 10}" y2="2"/>`).join('')}
        <circle r="1.1" fill="#d8261f"/></svg><i class="r3-breathbar"><b></b></i></div>
      <div class="r3-vig"></div>
      <div class="r3-top"><span class="r3-stage"></span><b class="r3-time"></b><span class="r3-score"></span></div>
      <div class="r3-combo"></div>
      <div class="r3-say"></div>
      <div class="r3-cross"><i></i><i></i><i></i><i></i></div><div class="r3-hm">✕</div>
      <div class="r3-pops"></div><div class="r3-bigt"></div>
      <div class="r3-ammo"><b></b><small></small><span class="r3-wn"></span></div>
      <div class="r3-slots"></div>
      <div class="r3-info"></div>
      <div class="r3-hint"></div>
      ${touch ? '<button class="r3-fire" aria-label="אש">🔥</button><button class="r3-ads" aria-label="כוונת">🎯</button><button class="r3-rel" aria-label="מחסנית">🔄</button><button class="r3-breath" aria-label="עצירת נשימה">🫁</button>' : ''}
    </div><div class="r3-panel"></div>`;
    const q = (s) => this.box.querySelector(s);
    this.el = { hud: q('.r3-hud'), panel: q('.r3-panel'), stage: q('.r3-stage'), time: q('.r3-time'), score: q('.r3-score'), combo: q('.r3-combo'), say: q('.r3-say'), cross: q('.r3-cross'), hm: q('.r3-hm'), pops: q('.r3-pops'), big: q('.r3-bigt'), ammo: q('.r3-ammo b'), res: q('.r3-ammo small'), wn: q('.r3-wn'), slots: q('.r3-slots'), info: q('.r3-info'), hint: q('.r3-hint'), scope: q('.r3-scope'), breath: q('.r3-breathbar b'), vig: q('.r3-vig'), ads: q('.r3-ads'), breathBtn: q('.r3-breath'), ammoBox: q('.r3-ammo') };
  },
  panel(html) {
    const p = this.el.panel;
    p.innerHTML = html;
    p.classList.toggle('on', !!html);
    this.el.hud.classList.toggle('pre', this.mode === 'menu' || this.mode === 'brief');
  },
  hud() {
    const e = this.el, st = this.st;
    if (!e) return;
    const pre = this.mode === 'menu' || this.mode === 'brief';
    e.hud.classList.toggle('pre', pre);
    if (pre || !st) return;
    const W = R3_W[this.w];
    const left = Math.max(0, st.time - st.t);
    const txt = (el, v) => { if (el.textContent !== v) el.textContent = v; };
    txt(e.stage, `${st.def.icon} ${st.def.name}`);
    const sec = Math.ceil(left);
    txt(e.time, `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
    e.time.classList.toggle('low', this.mode === 'live' && left < 6);
    txt(e.score, `${Math.round(st.score)}`);
    const m = this.mult(st.combo);
    const ch = st.combo >= 3 ? `🔥 רצף ×${m.toFixed(1)}` : '';
    txt(e.combo, ch); e.combo.classList.toggle('hot', m >= 2);
    txt(e.ammo, String(this.ammo[this.w])); txt(e.res, `/ ${W.mag}`);
    txt(e.wn, this.reloadT > 0 ? 'מחליף מחסנית…' : W.name);
    e.ammoBox.classList.toggle('empty', this.ammo[this.w] === 0);
    const sl = this.slots.map((k, i) => `<span class="${k === this.w ? 'on' : ''}" data-w="${k}">${G.touch ? '' : `<kbd>${i + 1}</kbd>`}${R3_W[k].name}</span>`).join('');
    if (e.slots.innerHTML !== sl) e.slots.innerHTML = sl;
    let info = '';
    if (st.id === 'long') info = `🌬️ רוח ${st.wind > 0 ? '→' : '←'} ${Math.abs(st.wind).toFixed(1)} מ׳/ש׳`;
    else if (st.id === 'house') info = `🚪 חדר ${Math.min(st.stops ? st.stops.length : 0, (st.si || 0) + 1)}/${st.stops ? st.stops.length : 0}`;
    else if (st.id === 'flash' && st.reacts.length) info = `⚡ ${Math.round(st.reacts[st.reacts.length - 1] * 1000)} מ״ש`;
    txt(e.info, info);
    // The crosshair: hidden while aiming (the sights do it), open with the spread.
    const spread = W.spread + (W.ads - W.spread) * this.adsK + this.bloom;
    const px = spread * (innerHeight / 2) / Math.tan(this.camera.fov * Math.PI / 360);
    e.cross.style.setProperty('--gap', `${Math.round(4 + Math.min(60, px))}px`);
    e.cross.classList.toggle('hidden', this.adsK > 0.45 || this.mode !== 'live');
    const scoped = !!W.scope && this.adsK > 0.85;
    e.scope.classList.toggle('on', scoped);
    if (scoped) { e.breath.style.width = `${(this.breath / 3) * 100}%`; e.breath.parentNode.classList.toggle('out', this.holdBreath && this.breath <= 0); }
    e.hm.style.opacity = this.hm > 0 ? Math.min(1, this.hm * 6) : 0;
    e.hm.classList.toggle('kill', !!this.hmKill);
    e.vig.style.opacity = Math.min(1, this.hurtFx);
    if (e.ads) e.ads.classList.toggle('on', this.ads);
    if (e.breathBtn) e.breathBtn.classList.toggle('hidden', !(W.scope && this.ads));
    let hint = '';
    if (!G.touch && this.mode === 'live' && !this.locked() && !this.noLock) hint = '🖱️ קליק על המסך — לנעול את העכבר ולכוון';
    else if (this.mode === 'live' && this.ammo[this.w] === 0 && this.reloadT <= 0) hint = G.touch ? '🔄 — מחסנית!' : 'R — מחסנית!';
    else if (this.mode === 'live' && W.scope && !this.ads && st.t < 6) hint = G.touch ? '🎯 — לכוונת הצלף' : 'קליק ימני — לכוונת הצלף';
    if (e.hint.textContent !== hint) e.hint.textContent = hint;
  },

  // ---------- input ----------
  locked() { return document.pointerLockElement === this.box && !!this.box; },
  lockOn() {
    if (G.touch || this.noLock || !this.box || this.locked()) return;
    try { const r = this.box.requestPointerLock(); if (r && r.catch) r.catch(() => { this.noLock = true; }); } catch (err) { this.noLock = true; }
  },
  lockOff() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* none */ } },
  bind() {
    this.unbind();
    const L = this.listeners = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); L.push([t, ev, fn, o]); };
    const box = this.box;
    const sens = () => (typeof Settings !== 'undefined' && Settings.v.sens) || 1;
    const look = (dx, dy, k) => {
      if (this.mode !== 'live' && this.mode !== 'count') return;
      k *= sens() * (this.camera.fov / 72);
      this.look.yaw += dx * k;
      const inv = typeof Settings !== 'undefined' && Settings.v.invertY ? -1 : 1;
      this.look.pitch = r3clamp(this.look.pitch - dy * k * inv, -1.2, 1.35);
    };
    const playing = () => this.mode === 'live' || this.mode === 'count';
    this.drag = new Map();
    // A second mouse button pressed (or let go) while another is held comes only as a pointer
    // move with new buttons, no pointerdown: aiming with the right button and then clicking the
    // left never fired. Every mouse event notes the buttons; a move that changes them acts.
    this.mb = 0;
    const chord = (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.buttons | 0, was = this.mb;
      this.mb = b;
      if (e.type !== 'pointermove' || b === was || !playing() || (!this.locked() && !this.noLock)) return;
      if ((b & 1) && !(was & 1)) this.fireDown(); else if (!(b & 1) && (was & 1)) this.fireUp();
      if ((b & 2) && !(was & 2)) this.ads = true; else if (!(b & 2) && (was & 2)) this.ads = false;
    };
    for (const t of ['pointerdown', 'pointerup', 'pointermove']) on(window, t, chord, true);
    // With the pointer locked, the click is the trigger (and the right button aims).
    on(window, 'pointerdown', (e) => {
      if (!this.locked() || e.pointerType !== 'mouse') return;
      e.stopPropagation(); e.preventDefault();
      if (e.button === 0) this.fireDown();
      if (e.button === 2) this.ads = true;
    }, true);
    on(box, 'pointerdown', (e) => {
      if (!playing() || e.target.closest('button, .r3-panel.on')) return;
      if (e.pointerType === 'mouse') {
        if (e.button === 2) { this.ads = true; e.preventDefault(); }
        if (!this.locked()) {
          this.lockOn();
          this.drag.set(e.pointerId, { x: e.clientX, y: e.clientY, mouse: true });
          if (this.noLock && e.button === 0) this.fireDown();
        }
        return;
      }
      this.drag.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    on(window, 'pointermove', (e) => {
      const d = this.drag.get(e.pointerId);
      if (!d) return;
      if (d.mouse && this.locked()) { this.drag.delete(e.pointerId); return; }
      look(e.clientX - d.x, e.clientY - d.y, e.pointerType === 'touch' ? 0.0062 : 0.005);
      d.x = e.clientX; d.y = e.clientY;
    });
    const up = (e) => {
      const d = this.drag.get(e.pointerId); this.drag.delete(e.pointerId);
      if (e.pointerType === 'mouse') { if (e.button === 2) this.ads = false; else if (d || this.locked()) this.fireUp(); }
    };
    on(window, 'pointerup', up); on(window, 'pointercancel', up);
    on(document, 'mousemove', (e) => {
      if (!this.locked()) return;
      const mx = e.movementX || 0, my = e.movementY || 0;
      if (Math.abs(mx) > 250 || Math.abs(my) > 250) return;
      look(mx, my, 0.0024);
    });
    on(document, 'mouseup', (e) => { if (!this.locked()) return; if (e.button === 0) this.fireUp(); if (e.button === 2) this.ads = false; });
    on(box, 'contextmenu', (e) => e.preventDefault());
    on(document, 'pointerlockchange', () => { if (!this.locked()) { this.unlockAt = performance.now(); this.fireUp(); this.ads = false; } });
    on(document, 'pointerlockerror', () => { this.noLock = true; });
    on(box, 'wheel', (e) => {
      e.preventDefault();
      const now = performance.now();
      if (!playing() || Math.abs(e.deltaY) < 4 || now - (this.wheelAt || 0) < 300) return;
      this.wheelAt = now; this.cycle();
    }, { passive: false });
    // Esc with the pointer locked only frees the mouse; it doesn't leave the range.
    on(window, 'keydown', (e) => {
      if (e.code === 'Escape' && (this.locked() || performance.now() - (this.unlockAt || 0) < 400)) { e.stopImmediatePropagation(); return; }
      if (!playing()) return;
      if (e.repeat) return;
      if (e.code === 'KeyR') this.reload();
      else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') this.swap(this.slots[+e.code.slice(5) - 1]);
      else if (e.code === 'KeyQ') this.cycle();
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.holdBreath = true;
      else if (e.code === 'KeyZ') this.ads = !this.ads;
    }, true);
    on(window, 'keyup', (e) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.holdBreath = false; });
    on(window, 'blur', () => { this.fireUp(); this.holdBreath = false; });
    // The phone's buttons.
    const btn = (sel, down, upFn) => {
      const b = box.querySelector(sel); if (!b) return;
      on(b, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.unlock(); down(e); });
      if (upFn) for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) on(b, ev, (e) => upFn(e));
    };
    btn('.r3-fire', () => this.fireDown(), () => this.fireUp());
    btn('.r3-ads', () => { this.ads = !this.ads; Sound.synth.tone(700, 0.03, 'square', 0.03); });
    btn('.r3-rel', () => this.reload());
    btn('.r3-breath', () => { this.holdBreath = true; }, () => { this.holdBreath = false; });
    on(this.el.slots, 'pointerdown', (e) => { const s = e.target.closest('[data-w]'); if (!s) return; e.preventDefault(); e.stopPropagation(); if (G.touch) this.cycle(); else this.swap(s.dataset.w); });
  },
  fireDown() { this.trigger = true; this.semiHeld = false; },
  fireUp() { this.trigger = false; this.semiHeld = false; },
  unbind() { for (const [t, ev, fn, o] of this.listeners || []) t.removeEventListener(ev, fn, o); this.listeners = []; },

  // ---------- the stages ----------
  STAGES: {
    // ----- pop-up targets behind mounds -----
    popup: {
      build(st) {
        const spots = [[-8, 9], [-3, 10], [2.5, 9], [7, 11], [-10, 15], [-5, 16], [1, 15], [6, 17], [10, 14], [-8, 22], [-2, 21], [4, 23], [9, 21], [-5, 29], [2, 28], [7, 31], [-9, 36], [0, 37], [8, 36]];
        st.spots = spots.map(([x, z]) => {
          this.mound(x, z - 0.8, 2.1, 0.7, 1.4, 0, this.stageGroup);
          const kinds = {};
          for (const k of ['threat', 'hostage']) { const t = this.addTarget(this.paper(k, x, 0, z, { fx: 0, fz: 0, scale: 1.5 })); t.up = 0; t.hinge.rotation.x = -1.5; t.hinge.visible = false; t.state = 'down'; t.spot = null; kinds[k] = t; }
          return { x, z, kinds, busy: false, last: -9 };
        });
        st.next = 0.6; st.popped = 0;
      },
      tick(st, dt) {
        const T = st.t;
        // Raise targets: faster and more of them as time goes on.
        st.next -= dt;
        const upN = this.targets.filter(t => t.state && t.state !== 'down').length;
        if (st.next <= 0 && upN < (T < 12 ? 2 : T < 24 ? 3 : 4)) {
          st.next = Math.max(0.42, 1.05 - T * 0.018);
          const free = st.spots.filter(s => !s.busy && T - s.last > 1.4);
          if (free.length) {
            const s = r3pick(free), bad = st.popped > 2 && Math.random() < 0.18;
            const t = s.kinds[bad ? 'hostage' : 'threat'];
            s.busy = true; t.spot = s; t.state = 'rise'; t.k = 0; t.hold = Math.max(1.15, 2.4 - T * 0.03); t.alive = true; t.hinge.visible = true;
            st.popped++;
            Sound.synth.noise(0.12, 0.04, 900, 'lowpass');
          }
        }
        for (const t of this.targets) {
          if (!t.state || t.state === 'down') continue;
          if (t.state === 'rise') { t.k = Math.min(1, t.k + dt / 0.18); if (t.k >= 1) t.state = 'up'; }
          else if (t.state === 'up') { t.hold -= dt; if (t.hold <= 0) t.state = 'fall'; }
          else if (t.state === 'fall' || t.state === 'shot') { t.k = Math.max(0, t.k - dt / (t.state === 'shot' ? 0.16 : 0.3)); if (t.k <= 0) { t.state = 'down'; t.hinge.visible = false; t.spot.busy = false; t.spot.last = st.t; } }
          t.up = t.state === 'shot' ? 0 : t.k;
          t.hinge.rotation.x = -1.5 * (1 - t.k);
        }
      },
      hit(st, t, zone, hit) {
        if (t.state !== 'up' && t.state !== 'rise') return;
        t.state = 'shot';
        if (t.bad) { this.penalty(40, hit.p, 'אזרח!'); this.say(r3pick(R3_SAY.hostage), 'p_shalev', true); return; }
        this.award(this.zonePts(t, zone), hit.p, zone === 'head' ? '🎯 ראש' : '', { head: zone === 'head', kill: true });
        Sound.synth.noise(0.2, 0.06, 700, 'lowpass');
      },
    },

    // ----- rails, pendulums, bobbing targets -----
    rails: {
      build(st) {
        const G2 = this.stageGroup;
        st.rails = [];
        const railMat = new THREE.MeshStandardMaterial({ color: 0x6a6a64, roughness: 0.5, metalness: 0.6 });
        for (const [z, half, sp] of [[13, 9, 2.6], [21, 11, 4.2], [31, 13, 5.6], [44, 15, 7.4]]) {
          for (const dz of [-0.25, 0.25]) { const r = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 2, 0.06, 0.06), railMat); r.position.set(0, 0.03, z + dz); G2.add(r); }
          // A low wall in front hides the carts' wheels.
          const wall = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 3, 0.45, 0.35), this.wallMat());
          wall.position.set(0, 0.22, z - 0.8); wall.castShadow = wall.receiveShadow = true; G2.add(wall);
          this.block(this.stageBlockers, -half - 1.5, half + 1.5, 0, 0.45, z - 0.98, z - 0.62, 'wall');
          const n = z > 40 ? 1 : 2;
          for (let i = 0; i < n; i++) {
            const kind = z < 25 ? 'ring' : 'threat';
            const t = this.addTarget(this.paper(kind, (i ? 1 : -1) * half * 0.5, 0.3, z, { fx: 0, fz: -1e6, scale: 1.4, flat: true }));
            // The board rides a trolley (the model, turned so it rolls along the rail).
            const cart = Assets.model('r3_trolley', { length: 1.3, rotY: Math.PI }) || new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.6), new THREE.MeshStandardMaterial({ color: 0xb03a22, roughness: 0.7 }));
            cart.position.set(0, cart.isMesh ? -0.18 : -0.3, 0.12); t.base.add(cart);
            t.rail = { z, half, sp: sp * r3rnd(0.85, 1.15), dir: i ? 1 : -1, x: (i ? 1 : -1) * half * 0.5 }; t.kindNow = kind; t.vel = new THREE.Vector3();
            st.rails.push(t);
          }
        }
        // Pendulums: steel plates swinging under a gantry.
        st.pend = [];
        for (const [x, z, ph] of [[-5, 26, 0], [6, 36, 1.7]]) {
          const t = this.addTarget(this.steel(x, 3.2, z, 0.32, { chain: 1.1 }));
          t.ph = ph; t.amp = 0.75; t.pts = (zn) => zn === 'bull' ? 16 : 10; t.cd = 0; t.swK = t.model ? 0.42 : 1;
          st.pend.push(t);
        }
        // Bobbers behind a wall: up and down, never still.
        const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 1.1, 0.4), this.wallMat());
        wall.position.set(0, 0.55, 17.4); wall.castShadow = wall.receiveShadow = true; G2.add(wall);
        this.block(this.stageBlockers, -6, 6, 0, 1.1, 17.2, 17.6, 'wall');
        st.bob = [];
        for (const [x, ph] of [[-4, 0], [0, 2.1], [4, 4.2]]) {
          const t = this.addTarget(this.paper('threat', x, 0, 18, { fx: 0, fz: 0, scale: 1.3 }));
          t.ph = ph; t.bx = x; t.downT = 0; t.vel = new THREE.Vector3();
          st.bob.push(t);
        }
        st.hostageAt = 6;
      },
      idle(st, dt) { this.STAGES.rails.move.call(this, st, dt * 0.4); },
      move(st, dt) {
        for (const t of st.rails) {
          const r = t.rail;
          if (t.flip > 0) { t.flip -= dt; t.hinge.rotation.y = (1 - Math.max(0, t.flip) / 0.7) * Math.PI * 2; if (t.flip <= 0) { t.hinge.rotation.y = 0; t.down = false; } }
          r.x += r.dir * r.sp * dt;
          if (Math.abs(r.x) > r.half) { r.x = Math.sign(r.x) * r.half; r.dir *= -1; if (Math.random() < 0.35) r.sp *= r3rnd(0.8, 1.25); r.sp = r3clamp(r.sp, 2, 9); }
          t.vel.set(r.dir * r.sp, 0, 0);
          t.base.position.x = r.x;
        }
        const T = this.time;
        for (const t of st.pend) {
          t.cd -= dt;
          const a = Math.sin(T * 2.6 + t.ph) * t.amp;
          t.hinge.rotation.z = a * t.swK;
          t.amp += (0.75 - t.amp) * dt * 0.5;
        }
        for (const t of st.bob) {
          t.downT -= dt;
          const s = Math.max(0, Math.sin(T * 1.9 + t.ph));
          const y = t.downT > 0 ? -1 : -0.95 + s * 1.6;
          const prev = t.base.position.y;
          t.base.position.y = y; t.vel.set(0, (y - prev) / Math.max(1e-3, dt), 0);
          t.up = t.downT > 0 ? 0 : 1;
        }
      },
      tick(st, dt) {
        this.STAGES.rails.move.call(this, st, dt);
        // Now and then a civilian rides a cart instead.
        st.hostageAt -= dt;
        if (st.hostageAt <= 0) {
          st.hostageAt = r3rnd(5, 8);
          const t = r3pick(st.rails.filter(x => !x.down && x.kindNow === 'threat'));
          if (t) this.STAGES.rails.retype.call(this, t, 'hostage');
        }
      },
      retype(t, kind) {
        t.kindNow = kind; t.kind = kind; t.bad = kind === 'hostage';
        t.face.material.map = this.paperTex(kind); t.face.material.needsUpdate = true;
        t.zone = (lx, ly) => this.paperZone(kind, lx, ly);
      },
      hit(st, t, zone, hit) {
        if (t.steel) {
          if (t.cd > 0) return;
          t.cd = 1.2; t.amp = Math.min(1.25, t.amp + 0.25);
          this.award(this.zonePts(t, zone), hit.p, zone === 'bull' ? '🎯' : '🔔', { head: zone === 'bull' });
          return;
        }
        if (t.rail) {
          t.down = true; t.flip = 0.7;
          if (t.bad) { this.penalty(40, hit.p, 'אזרח!'); this.say(r3pick(R3_SAY.hostage), 'p_shalev', true); }
          else {
            const lead = t.rail.sp > 6 ? ' 🏎️' : '';
            this.award(this.zonePts(t, zone) + Math.round(t.rail.sp), hit.p, (zone === 'head' || zone === 'bull' ? '🎯' : '') + lead, { head: zone === 'head' || zone === 'bull', kill: true });
          }
          const back = t.rail.z < 25 ? 'ring' : 'threat';
          setTimeout(() => { if (!t.dead) this.STAGES.rails.retype.call(this, t, back); }, 350);
          return;
        }
        if (st.bob.includes(t)) {
          t.downT = 1.2; t.up = 0;
          this.award(this.zonePts(t, zone) + 4, hit.p, zone === 'bull' ? '🎯' : '', { head: zone === 'bull', kill: true });
        }
      },
    },

    // ----- the killhouse, walked on rails -----
    house: {
      build(st) {
        const X = R3_KH;
        this.pos.set(X, R3_EYE, -1.5);
        this.look.yaw = Math.PI / 2;
        // Stops: where you stand, which way you face, what's in the room, which door opens.
        const tg = (kind, x, z, y = 0) => ({ kind, x: X + x, z, y });
        st.stops = [
          { at: [0.6, 5], face: 0, door: 1, ts: [tg('threat', 4.6, 3.6), tg('hostage', 5.4, 5.6), tg('threat', 3.6, 6.6)] },
          { at: [-0.6, 12], face: Math.PI, door: 2, ts: [tg('threat', -4.6, 13.8), tg('threat', -5.6, 11.2), tg('hostage', -3.4, 10.0)] },
          { at: [0.4, 19.5], face: Math.PI / 2, ts: [tg('threat', -0.9, 24.4, 0.35), tg('threat', 1.0, 34.4), tg('hostage', -1.0, 35.0)] },
          { at: [0, 29], face: Math.PI, door: 5, door2: 4, ts: [tg('threat', -5, 30.8), tg('hostage', -4.4, 27.2), tg('threat', 4.5, 27.4), tg('threat', 5.6, 29.8)] },
          { at: [0, 37.4], face: Math.PI / 2, ts: [...(Assets.has('r3_target') ? [tg('hostage', 0.05, 43.1), tg('captor', 0.55, 43.5)] : [tg('captor', 0.3, 43.4)]), tg('threat', -3.8, 42.2, 0.4), tg('threat', 3.6, 41.4), tg('hostage', -2, 43.6), tg('threat', 4.6, 43.4)] },
        ];
        const path = [[0, -1.5]];
        for (const s of st.stops) path.push(s.at);
        st.path = path; st.si = -1; st.walk = null; st.at = 0;
        for (const [i, s] of st.stops.entries()) {
          s.targets = s.ts.map(o => {
            const model = o.kind === 'captor' && Assets.has('r3_target');
            const t = this.addTarget(this.paper(model ? 'threat' : o.kind, o.x, o.y, o.z, { fx: X + s.at[0], fz: s.at[1], scale: 1.5 }));
            t.captor = o.kind === 'captor';
            t.stop = i; t.alive = false; t.up = 0; t.turn = 0;
            // Edge-on until the stop starts; then it turns to face you.
            t.hinge.rotation.y = Math.PI / 2;
            t.threat = o.kind === 'threat' || o.kind === 'captor';
            return t;
          });
        }
        this.STAGES.house.next.call(this, st);
      },
      // Walk to the next stop.
      next(st) {
        st.si++;
        if (st.si >= st.stops.length) {
          const left = Math.max(0, st.time - st.t);
          st.bonus = Math.round(left * 6);
          st.score += st.bonus;
          this.popup(new THREE.Vector3(this.pos.x + Math.cos(this.look.yaw) * 3, R3_EYE, this.pos.z + Math.sin(this.look.yaw) * 3), `+${st.bonus} ⏱️ זמן`, 'head');
          this.endStage('clear');
          return;
        }
        const s = st.stops[st.si];
        st.walk = { from: this.pos.clone(), to: new THREE.Vector3(R3_KH + s.at[0], R3_EYE, s.at[1]), k: 0 };
        st.walk.len = st.walk.from.distanceTo(st.walk.to);
        st.at = 0; st.engaged = false;
      },
      idle() {},
      tick(st, dt) {
        const s = st.stops[st.si];
        if (!s) return;
        if (st.walk) {
          const w = st.walk;
          w.k = Math.min(1, w.k + dt * 3.6 / Math.max(0.5, w.len));
          this.pos.lerpVectors(w.from, w.to, w.k);
          this.pos.y = R3_EYE + Math.abs(Math.sin(w.k * w.len * 2.2)) * 0.03;
          // Turn toward the room as you get there.
          if (w.k > 0.45) this.look.yaw += r3ang(s.face - this.look.yaw) * Math.min(1, dt * 5);
          if (w.k > 0.7) { if (s.door != null) this.doors[this.doorAt[s.door]].want = 1; if (s.door2 != null) this.doors[this.doorAt[s.door2]].want = 1; }
          if (w.k >= 1) { st.walk = null; st.at = 0; this.STAGES.house.reveal.call(this, st, s); }
          return;
        }
        st.at += dt;
        for (const t of s.targets) {
          t.turn = Math.min(1, t.turn + dt / 0.22);
          if (t.alive || t.shot) t.hinge.rotation.y = Math.PI / 2 * (1 - t.turn);
          t.up = t.turn;
          // A threat still standing shoots back.
          if (t.threat && t.alive && st.at > t.fireAt) {
            t.fireAt = st.at + 2.2;
            const p = t.hinge.localToWorld(new THREE.Vector3(0.28, 0.62, 0.1));
            this.flashAt(p);
            Sound.synth.noise(0.09, 0.3, 3000); Sound.synth.tone(170, 0.06, 'square', 0.04, 70);
            st.hurt++;
            st.score -= 15; st.combo = 0;
            this.hurtFx = 0.9; this.shake = 0.3;
            this.popup(p, '−15 נפגעת!', 'bad');
            this.say(r3pick(R3_SAY.hurt));
          }
        }
        const left = s.targets.filter(t => t.threat && t.alive).length;
        if (!left && !st.clearAt) st.clearAt = st.at + 0.55;
        if ((st.clearAt && st.at > st.clearAt) || st.at > 7) {
          if (left) this.say(r3pick(R3_SAY.go));
          for (const t of s.targets) t.alive = false;
          st.clearAt = null;
          this.STAGES.house.next.call(this, st);
        }
      },
      reveal(st, s) {
        const react = Math.max(1.6, 2.9 - st.si * 0.25);
        s.targets.forEach((t, i) => { t.alive = true; t.fireAt = react + i * 0.35; });
        Sound.synth.noise(0.15, 0.06, 900, 'lowpass');
        if (st.si === 3) this.say('שני חדרים! שמאלה — ואז ימינה!', 'p_shalev', true);
        if (st.si === 4) this.say('בן ערובה! רק בראש של החוטף!', 'p_shalev', true);
      },
      hit(st, t, zone, hit) {
        if (!t.alive) return;
        if (zone === 'civ') { this.penalty(40, hit.p, 'אזרח!'); this.say(r3pick(R3_SAY.hostage), 'p_shalev', true); t.alive = false; t.shot = true; return; }
        if (!t.threat) return;
        t.alive = false; t.shot = true;
        const pts = t.captor ? (zone === 'head' ? 40 : 10) : this.zonePts(t, zone) + 4;
        this.award(pts, hit.p, zone === 'head' ? '🎯 ראש' : '', { head: zone === 'head', kill: true });
        // It drops back flat.
        const h = t.hinge; let k = 0;
        const fall = () => { k += 0.08; h.rotation.x = -Math.min(1.45, k * 1.45); if (k < 1 && !t.dead) requestAnimationFrame(fall); };
        fall();
      },
      end() { this.pos.set(0, R3_EYE, 0); },
    },

    // ----- clays, balloons, the drone -----
    sky: {
      build(st) {
        const G2 = this.stageGroup;
        for (const [x, z] of [[-15, 22], [15, 28]]) {
          const h = Assets.model('r3_thrower', { height: 1.3, rotY: x < 0 ? -Math.PI / 2 : Math.PI / 2 }) || new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.9 }));
          h.position.set(x, h.isMesh ? 0.65 : 0, z); G2.add(h);
          const lb = Scene3D.label('🥏 זורק', { size: 0.55 }); lb.position.set(x, 2.1, z); G2.add(lb);
        }
        st.nextClay = 0.8; st.nextBall = 0.5; st.droneAt = 2.5; st.photoAt = 13; st.drones = 0;
        this.clayGeo = this.clayGeo || new THREE.CylinderGeometry(0.11, 0.12, 0.03, 16);
        this.clayMat = this.clayMat || new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7 });
        this.goldMat = this.goldMat || new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.3, metalness: 0.7, emissive: 0x553300 });
      },
      idle() {},
      clay(st) {
        const side = Math.random() < 0.5 ? -1 : 1, gold = Math.random() < 0.12;
        const m = new THREE.Mesh(this.clayGeo, gold ? this.goldMat : this.clayMat);
        m.position.set(side * 14.6, 1.35, side < 0 ? 22 : 28); m.castShadow = true;
        const t = this.addTarget(this.ball('clay', m, 0.3));
        t.v.set(-side * r3rnd(6.5, 10), r3rnd(8.5, 12), r3rnd(-1.5, 2.5)); t.gold = gold; t.g = 9.8; t.spin = r3rnd(8, 14);
        Sound.synth.noise(0.1, 0.08, 600, 'lowpass'); Sound.synth.tone(260, 0.08, 'square', 0.03, 120);
      },
      balloon() {
        const cols = [0xe63b2e, 0x4aa3df, 0xf2c14e, 0x6cc24a, 0xc05ad8];
        const m = new THREE.Group();
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), new THREE.MeshStandardMaterial({ color: r3pick(cols), roughness: 0.3, metalness: 0.1 })); b.scale.y = 1.18; m.add(b);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0xffffff })); s.position.y = -0.95; m.add(s);
        m.position.set(r3rnd(-14, 14), 0.4, r3rnd(30, 42));
        const t = this.addTarget(this.ball('balloon', m, 0.36));
        t.v.set(r3rnd(-0.4, 0.4), r3rnd(1.6, 2.5), 0); t.ph = Math.random() * 6; t.col = b.material.color.getHex();
      },
      drone(st, photo) {
        const m = new THREE.Group();
        // The UAV model flies along its +z: turned to fly along x.
        const um = Assets.model('r3_drone', { length: photo ? 1.6 : 4.4, tint: photo ? 0xffffff : 0x8a9080 });
        if (um) { um.position.y = -0.2; const turn = new THREE.Group(); turn.rotation.y = Math.PI / 2; turn.add(um); m.add(turn); }
        const bodyMat = new THREE.MeshStandardMaterial({ color: photo ? 0xf2f2ee : 0x4a4f48, roughness: 0.5, metalness: 0.3 });
        if (um) {
          const lb = Scene3D.label(photo ? '📷 הצלם — לא לירות!' : 'כטב״ם', { bg: photo ? 'rgba(40,120,60,.9)' : 'rgba(160,30,20,.9)', size: photo ? 0.75 : 0.6 }); lb.position.y = 0.9; m.add(lb);
          if (!photo) st.drones++;
        } else if (photo) {
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), bodyMat); m.add(body);
          for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 })); r.position.set(x, 0.1, z); m.add(r); }
          const cam = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0x111111 })); cam.position.y = -0.12; m.add(cam);
          const lb = Scene3D.label('📷 הצלם — לא לירות!', { bg: 'rgba(40,120,60,.9)', size: 0.75 }); lb.position.y = 0.9; m.add(lb);
        } else {
          // A small fixed-wing UAV: fuselage, wings, tail, a prop.
          const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1.6, 10), bodyMat); fus.rotation.z = Math.PI / 2; m.add(fus);
          const wing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 2.6), bodyMat); m.add(wing);
          const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.04), bodyMat); tail.position.set(-0.7, 0.2, 0); m.add(tail);
          const ht = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.8), bodyMat); ht.position.set(-0.72, 0.05, 0); m.add(ht);
          const prop = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: 0x222222 })); prop.position.x = -0.82; m.add(prop); m.userData.prop = prop;
          const lb = Scene3D.label('כטב״ם', { bg: 'rgba(160,30,20,.9)', size: 0.6 }); lb.position.y = 0.9; m.add(lb);
          st.drones++;
        }
        m.position.set(photo ? -20 : r3rnd(-12, 12), photo ? 7 : r3rnd(12, 17), photo ? 28 : r3rnd(34, 44));
        const t = this.addTarget(this.ball(photo ? 'photo' : 'drone', m, photo ? 0.8 : 1.3));
        t.hp = photo ? 1 : 8 + st.drones * 3; t.max = t.hp; t.photo = photo; t.bad = photo;
        t.dir = 1; t.turnT = 0; t.sp = photo ? 3.2 : 6 + st.drones * 1.5; t.vy = 0; t.alt = m.position.y; t.life = photo ? 12 : 1e9;
        if (!photo) { const bar = Scene3D.label('▮▮▮▮▮▮▮▮', { bg: 'rgba(20,20,20,.7)', fg: '#ff5a4a', size: 0.45 }); bar.position.y = 1.4; m.add(bar); t.bar = bar; }
        return t;
      },
      tick(st, dt) {
        const T = st.t;
        if ((st.nextClay -= dt) <= 0) { st.nextClay = Math.max(0.75, 1.6 - T * 0.02); this.STAGES.sky.clay.call(this, st); if (T > 12 && Math.random() < 0.4) this.STAGES.sky.clay.call(this, st); }
        if ((st.nextBall -= dt) <= 0) { st.nextBall = r3rnd(0.9, 1.6); this.STAGES.sky.balloon.call(this, st); }
        if (st.droneAt != null && (st.droneAt -= dt) <= 0) { st.droneAt = null; this.STAGES.sky.drone.call(this, st, false); }
        if (st.photoAt != null && (st.photoAt -= dt) <= 0) { st.photoAt = null; this.STAGES.sky.drone.call(this, st, true); this.say('רגע! הרחפן הלבן זה של הצלם! לא לירות עליו!', 'p_shalev', true); }
        for (const t of this.targets) {
          if (t.dead) continue;
          const m = t.mesh;
          if (t.kind === 'clay') {
            t.v.y -= t.g * dt; m.position.addScaledVector(t.v, dt); m.rotation.y += t.spin * dt; m.rotation.x = 0.25;
            if (m.position.y < -0.2) this.removeTarget(t);
          } else if (t.kind === 'balloon') {
            t.ph += dt; m.position.x += (t.v.x + Math.sin(t.ph * 1.7) * 0.5) * dt; m.position.y += t.v.y * dt;
            t.v.set(t.v.x, t.v.y, 0);
            if (m.position.y > 34) this.removeTarget(t);
          } else if (t.kind === 'drone' || t.kind === 'photo') {
            if (t.falling) {
              t.vy -= 9.8 * dt; m.position.y += t.vy * dt; m.position.x += t.dir * t.sp * 0.5 * dt; m.rotation.x += dt * 6; m.rotation.z -= dt * 1.5;
              if (Math.random() < 0.6) this.puff(m.position.x, m.position.y, m.position.z, 0x333333, 0.8, 1.4, 0.4);
              if (m.position.y < 0.3) { this.boom(m.position); this.removeTarget(t); if (!t.photo) st.droneAt = 2.5; }
              continue;
            }
            t.turnT -= dt;
            if (t.turnT <= 0) { t.turnT = t.photo ? 4 : r3rnd(0.5, 1.4); t.dir = t.photo ? 1 : (Math.abs(m.position.x) > 11 ? -Math.sign(m.position.x) : (Math.random() < 0.5 ? -1 : 1)); t.vy = t.photo ? 0 : r3rnd(-2.2, 2.2); }
            m.position.x += t.dir * t.sp * dt;
            m.position.y = r3clamp(m.position.y + t.vy * dt, 9, 24);
            m.rotation.y = t.dir > 0 ? 0 : Math.PI; m.rotation.x = r3clamp(t.vy * 0.15, -0.4, 0.4) * t.dir;
            if (m.userData.prop) m.userData.prop.rotation.x += dt * 50;
            t.v.set(t.dir * t.sp, t.vy, 0);
            t.life -= dt;
            if (t.photo && (t.life <= 0 || Math.abs(m.position.x) > 28)) this.removeTarget(t);
          }
        }
        this.targets = this.targets.filter(t => !t.dead);
      },
      hit(st, t, zone, hit, b) {
        const p = hit.p;
        if (t.kind === 'clay') {
          this.shards(p, t.gold ? 0xffd23a : 0xff6a1a, 10, 0.07, 4); this.puff(p.x, p.y, p.z, 0xff9a5a, 0.5, 0.6, 0);
          Sound.synth.noise(0.14, 0.25, 5000, 'bandpass'); Sound.synth.tone(3200, 0.05, 'triangle', 0.04);
          this.removeTarget(t);
          this.award(t.gold ? 40 : 15, p, t.gold ? '✨ זהב' : '🥏', { head: t.gold, kill: true });
        } else if (t.kind === 'balloon') {
          this.shards(p, t.col, 6, 0.08, 2.5);
          Sound.synth.noise(0.06, 0.32, 4200, 'highpass'); Sound.synth.tone(900, 0.04, 'sine', 0.05, 300);
          this.removeTarget(t);
          this.award(8, p, '🎈', { kill: true });
        } else if (t.kind === 'photo') {
          t.falling = true; t.vy = 0; t.alive = false;
          this.penalty(40, p, '📷 הצלם!'); this.say(r3pick(R3_SAY.photo), 'p_shalev', true);
        } else if (t.kind === 'drone') {
          t.hp -= b.dmg;
          for (let i = 0; i < 3; i++) this.spark(p.x, p.y, p.z, r3rnd(-1, 1), r3rnd(-1, 1), -1);
          Sound.synth.tone(1700 + Math.random() * 400, 0.04, 'triangle', 0.05);
          if (t.bar) { const n = Math.max(0, Math.ceil(8 * t.hp / t.max)); if (n !== t.barN) { t.barN = n; t.mesh.remove(t.bar); t.bar.material.map.dispose(); t.bar.material.dispose(); t.bar = Scene3D.label('▮'.repeat(Math.max(1, n)), { bg: 'rgba(20,20,20,.7)', fg: '#ff5a4a', size: 0.45 }); t.bar.position.y = 1.4; t.mesh.add(t.bar); } }
          if (t.hp <= 0) {
            t.falling = true; t.vy = 2; t.alive = false;
            this.award(80, p, '🛸 הופל!', { head: true, kill: true });
            this.say(r3pick(R3_SAY.drone), 'p_shalev', true);
          } else this.award(4, p, '', {});
        }
      },
    },

    // ----- long range steel -----
    long: {
      build(st) {
        st.plates = [];
        for (const [x, z, r, pts] of [[-3, 100, 0.32, 10], [1.5, 150, 0.2, 25], [4, 200, 0.45, 20], [-9, 300, 0.6, 35], [12, 400, 0.75, 50]]) {
          const t = this.addTarget(this.steel(x, 2.3, z, r, { chain: 0.35 }));
          t.base.scale.setScalar(1);
          t.basePts = pts; t.cd = 0; t.amp = 0; t.dist = z;
          t.pts = (zn) => Math.round(pts * (zn === 'bull' ? 1.5 : 1));
          if (z === 150) { const lb = Scene3D.label('בונוס', { bg: 'rgba(160,30,20,.9)', size: 0.9 }); lb.position.set(0, t.cy + 0.9, 0); t.base.add(lb); }
          st.plates.push(t);
        }
        // A cardboard jeep crossing at 250 m.
        const jt = this.canvasTex(256, 128, (g, W, H) => {
          g.fillStyle = '#7a6a48'; g.beginPath(); g.moveTo(10, 100); g.lineTo(20, 50); g.lineTo(80, 48); g.lineTo(100, 14); g.lineTo(190, 14); g.lineTo(200, 48); g.lineTo(246, 56); g.lineTo(246, 100); g.closePath(); g.fill();
          g.fillStyle = '#222'; for (const x of [56, 196]) { g.beginPath(); g.arc(x, 104, 22, 0, 7); g.fill(); }
          g.fillStyle = '#9ab0c0'; g.fillRect(110, 22, 70, 26);
          g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(150, 76, 18, 0, 7); g.stroke();
        });
        const base = new THREE.Group(); base.position.set(-25, 0, 250);
        const hinge = new THREE.Group(); base.add(hinge);
        // An old pickup (the game's model, rusted) crossing the range; a cardboard one without it.
        const truck = Assets.model('pickup', { length: 5, rotY: Math.PI / 2, tint: 0xa88a66 });
        let face;
        if (truck) { face = truck; hinge.add(truck); }
        else {
          const geo = new THREE.PlaneGeometry(3.6, 1.8); geo.translate(0, 0.9, 0);
          face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: jt, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })); hinge.add(face);
        }
        base.rotation.y = Math.PI;
        const jeep = this.addTarget({ kind: 'jeep', base, hinge, face, shape: 'plane', paper: true, vel: new THREE.Vector3() });
        jeep.zone = truck ? (lx, ly) => (Math.abs(lx) < 2.4 && ly > 0.25 && ly < 1.85 ? (ly > 1.15 && Math.abs(lx) < 0.8 ? 'bull' : 'steel') : null)
          : (lx, ly) => (Math.abs(lx) < 1.7 && ly > 0.1 && ly < 1.6 ? (Math.hypot(lx, ly - 0.84) < 0.2 ? 'bull' : 'steel') : null);
        jeep.aimL = new THREE.Vector3(0, truck ? 1.0 : 0.84, 0);
        jeep.pts = (zn) => (zn === 'bull' ? 60 : 40); jeep.dir = 1; jeep.cd = 0;
        st.jeep = jeep;
        st.wind = r3rnd(1, 3.2) * (Math.random() < 0.5 ? -1 : 1); st.windT = 0;
        this.say('רוח צד! תסתכל[/י] על הדגלים הכתומים.', 'p_shalev', true);
      },
      idle(st, dt) { this.STAGES.long.move.call(this, st, dt); },
      move(st, dt) {
        const j = st.jeep;
        j.cd -= dt;
        j.base.position.x += j.dir * 3.6 * dt; j.vel.set(j.dir * 3.6, 0, 0);
        if (Math.abs(j.base.position.x) > 25) { j.base.position.x = Math.sign(j.base.position.x) * 25; j.dir *= -1; }
        for (const t of st.plates) {
          t.cd -= dt;
          t.amp *= Math.exp(-dt * 1.2);
          t.hinge.rotation.x = -Math.sin(this.time * 7) * t.amp * (t.model ? 0.12 : 1);
          if (t.glow && (t.cd > 0) !== !!t.lit) { t.lit = t.cd > 0; t.glow(t.lit); }
        }
      },
      tick(st, dt) {
        this.STAGES.long.move.call(this, st, dt);
        st.windT -= dt;
        if (st.windT <= 0) { st.windT = r3rnd(6, 10); st.windTo = r3clamp(st.wind + r3rnd(-1.4, 1.4), -3.6, 3.6); }
        if (st.windTo != null) st.wind += (st.windTo - st.wind) * Math.min(1, dt * 0.5);
      },
      hit(st, t, zone, hit) {
        if (t.kind === 'jeep') {
          if (t.cd > 0) return;
          t.cd = 0.8;
          this.award(t.pts(zone), hit.p, '🚙', { head: zone === 'bull' });
          return;
        }
        if (t.cd > 0) return;
        t.cd = 2.6; t.amp = 0.6;
        this.award(t.pts(zone), hit.p, `🔔 ${t.dist}מ׳`, { head: zone === 'bull' });
        if (t.dist >= 400) this.say(r3pick(R3_SAY.far), 'p_shalev', true);
      },
    },

    // ----- 0.6 seconds -----
    flash: {
      build(st) {
        st.spots = [];
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 2 + (i - 4.5) * 0.21, r = 7 + (i % 3) * 3;
          const x = Math.cos(a) * r, z = Math.sin(a) * r + 1.5;
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), this.woodMat); post.position.set(x, 0.25, z); this.stageGroup.add(post);
          const kinds = {};
          for (const k of ['red', 'friend']) {
            const t = this.addTarget(this.paper(k, x, 0.45, z, { fx: 0, fz: 0, scale: 1.2 }));
            t.up = 0; t.alive = false; t.hinge.rotation.y = Math.PI / 2; t.hinge.visible = false; kinds[k] = t;
          }
          st.spots.push({ x, z, kinds });
        }
        st.next = 1.2;
        this.flashL = this.flashL || new THREE.PointLight(0xffffff, 0, 8, 2);
        this.stageGroup.add(this.flashL);
      },
      idle() {},
      tick(st, dt) {
        const T = st.t;
        st.next -= dt;
        if (st.next <= 0) {
          st.next = Math.max(0.75, 1.5 - T * 0.025);
          const n = T > 15 && Math.random() < 0.35 ? 2 : 1;
          const free = st.spots.filter(s => !s.kinds.red.alive && !s.kinds.friend.alive && !s.kinds.red.k && !s.kinds.friend.k);
          for (let i = 0; i < n && free.length; i++) {
            const s = free.splice(Math.floor(Math.random() * free.length), 1)[0];
            const bad = Math.random() < 0.25;
            const t = s.kinds[bad ? 'friend' : 'red'];
            t.alive = true; t.k = 0.001; t.shown = 0; t.hinge.visible = true;
            this.flashL.position.set(s.x, 1.6, s.z - 0.6); this.flashL.intensity = 3;
            Sound.synth.tone(bad ? 520 : 1320, 0.06, 'square', 0.05);
          }
        }
        this.flashL.intensity = Math.max(0, this.flashL.intensity - dt * 20);
        for (const s of st.spots) for (const t of [s.kinds.red, s.kinds.friend]) {
          if (!t.k) continue;
          if (t.alive) { t.shown += dt; t.k = Math.min(1, t.k + dt / 0.06); if (t.shown > 0.6) t.alive = false; }
          else { t.k = Math.max(0, t.k - dt / 0.12); if (!t.k) t.hinge.visible = false; }
          t.up = t.alive ? t.k : 0;
          t.hinge.rotation.y = Math.PI / 2 * (1 - t.k);
        }
      },
      hit(st, t, zone, hit, b) {
        if (!t.alive) return;
        t.alive = false;
        if (t.kind === 'friend') { this.penalty(30, hit.p, '✋ אזרח!'); this.say(r3pick(R3_SAY.friend), 'p_shalev', true); return; }
        // The reaction: from when it showed to when the trigger was pulled.
        const rt = t.shown - (this.time - b.shotAt);
        st.reacts.push(Math.max(0.05, rt));
        const pts = Math.round(10 + 25 * Math.max(0, 1 - rt / 0.6)) + (zone === 'head' ? 10 : 0);
        this.award(pts, hit.p, `⚡${Math.round(Math.max(0.05, rt) * 1000)}`, { head: zone === 'head', kill: true });
      },
    },
  },
  flashAt(p) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex[0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.copy(p); s.scale.setScalar(0.6); this.scene.add(s);
    this.fx.push({ m: s, t: 0, life: 0.08, s: 0.6, vx: 0, vy: 0, vz: 0, g: 0 });
  },
  boom(p) {
    for (let i = 0; i < 8; i++) this.puff(p.x + r3rnd(-1, 1), p.y + r3rnd(0, 1), p.z + r3rnd(-1, 1), i % 2 ? 0x444444 : 0xff8a3a, 1.6, 1.6, 1.2);
    this.shards(p, 0x3a3a36, 12, 0.18, 5);
    Sound.boom();
  },

  // ---------- for tests: aim at a target the way a perfect shot would ----------
  dbg: {
    get R() { return Range3D; },
    state() { const R = Range3D, st = R.st; return { mode: R.mode, stage: st && st.id, t: st && +st.t.toFixed(2), score: st && Math.round(st.score), shots: st && st.shots, hits: st && st.hits, bad: st && st.bad, heads: st && st.heads, combo: st && st.combo, w: R.w, ammo: R.ammo && R.ammo[R.w], adsK: +R.adsK.toFixed(2), runs: R.runs && R.runs.length, si: st && st.si }; },
    // Live targets: where to aim (a world point) and how they move.
    live(bad = false) {
      const R = Range3D, out = [];
      for (const t of R.targets) {
        if (t.dead || !t.alive || !R.hittable(t) || !!t.bad !== bad || t.cd > 0 || t.falling) continue;
        if (t.kind === 'captor' && bad) continue;
        let p;
        if (t.shape === 'sphere') p = t.mesh.position.clone();
        else if (t.steel) p = t.hinge.localToWorld(new THREE.Vector3(0, t.cy, 0));
        else if (t.kind === 'captor') p = t.hinge.localToWorld(new THREE.Vector3(0.17, bad ? 0.5 : 0.84, 0));
        else if (t.captor && t.headL) p = t.hinge.localToWorld(t.headL.clone());
        else p = t.hinge.localToWorld((bad ? t.badL : t.aimL).clone());
        // Only what you can actually see (not behind a wall).
        const hit = R.traceSeg(R.pos.clone(), p.clone().add(p.clone().sub(R.pos).setLength(0.4)));
        if (!hit || hit.t !== t) continue;
        out.push({ t, p, v: t.v || t.vel || new THREE.Vector3(), d: p.distanceTo(R.pos) });
      }
      return out.sort((a, b) => a.d - b.d);
    },
    // Sets the look so the next bullet meets point p (moving at v): drop, wind and lead included.
    aim(p, v = new THREE.Vector3()) {
      const R = Range3D, W = R3_W[R.w], o = R.pos.clone(), wind = R.st ? R.st.wind : 0;
      let yaw = Math.atan2(p.z - o.z, p.x - o.x), pit = Math.atan2(p.y - o.y, Math.hypot(p.x - o.x, p.z - o.z));
      for (let it = 0; it < 6; it++) {
        // Fly a bullet to the target's distance.
        const b = o.clone(), vel = R.launch(yaw, pit, W).multiplyScalar(W.speed);
        const D = Math.hypot(p.x - o.x, p.z - o.z);
        let t = 0; const h = 0.002;
        while (Math.hypot(b.x - o.x, b.z - o.z) < D && t < 3) { vel.y -= 9.8 * h; vel.x += wind * 1.6 * h; b.addScaledVector(vel, h); t += h; }
        const goal = p.clone().addScaledVector(v, t + 0.02);
        const gy = Math.atan2(goal.z - o.z, goal.x - o.x), by = Math.atan2(b.z - o.z, b.x - o.x);
        const gp = Math.atan2(goal.y - o.y, Math.hypot(goal.x - o.x, goal.z - o.z)), bp = Math.atan2(b.y - o.y, Math.hypot(b.x - o.x, b.z - o.z));
        yaw += r3ang(gy - by); pit += gp - bp;
      }
      R.look.yaw = yaw - R.recoil.y - R.sway.x; R.look.pitch = pit - R.recoil.p - R.sway.y;
    },
    shootAt(x) { const R = Range3D; this.aim(x.p, x.v); R.trigger = true; R.semiHeld = false; const ok = R.tryFire(); R.trigger = false; return ok; },
  },
};
