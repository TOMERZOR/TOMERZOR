// Little Netivot (נתיבות הקטנה): a first-person 1-on-1 / 2-on-2 shootout in a tiny town square
// at dusk — containers, shelters, two Iron Dome launchers and the radar for cover, a container
// you can climb up a ramp, lamp posts, and a welcome sign. An M16 (or an M4, a Tavor, a Negev or a
// marksman rifle from the HQ's armory, js/armory.js, with the attachments fitted there: a
// suppressor, a foregrip, a bipod, a holographic sight or an ACOG) and a Glock, armour and grenades bought at
// the start of each round, rounds to three, bots who take cover, peek, flank, retreat, throw
// grenades and complain. It's a drill, everyone insists.
// Alone: you (and a bot teammate in 2v2) against the platoon's bots. Online: the host's phone is
// the referee: it runs the bots, keeps everyone's HP, the rounds and the score; each player
// moves themselves and reports their own shots (what they hit), which the host checks against
// the walls before it counts.

// The guns. Five rifles (the M16 everyone has; the M4, the Tavor, the Negev and the marksman
// rifle bought with the game's shekels and kept for good) and the Glock as the sidearm. The dearer the rifle, the better:
// more damage, a tighter spread, faster and steadier. slot: which of the two you carry it in.
// ads: aiming down the sights — the zoom (the world's and your gun's), and how much of the
// spread, the speed, the kick and the bloom is left. Each rifle has iron sights (sight: the rail
// height, the rear aperture's and the front post's z, the line of sight, and the middle in x),
// where the holographic sight sits (holo: z), and what of the model's own sights is cut away from
// your view-model copy (cut: boxes [y0, z0, z1]). grip / fore: where the hands go.
const SH_W = {
  m16: { id: 'm16', slot: 'rifle', name: 'M16', price: 0, dmg: 18, rate: 0.075, burst: 3, burstGap: 0.3, auto: false, spread: 0.009, move: 0.026, air: 0.06, bloom: 0.006, bloomMax: 0.05, kick: 0.013, mag: 30, reserve: 90, reload: 1.6, draw: 0.55, len: 1.0, model: 'gun_m16', muzzle: [0.014, 0.09, 0.5], speed: 0.95,
    desc: 'הוותיק של הפלגה. צרורות של שלוש, מדויק בערך.', img: 'assets/arcade/sh_m16.jpg',
    ads: { fov: 50, vm: 56, spread: 0.3, move: 0.55, kick: 0.65, bloom: 0.55 },
    sight: { rail: 0.124, cx: 0.014, line: 0.168, rear: -0.235, front: 0.262, post: 0.1 }, holo: -0.12, cut: [[0.125, -0.3, -0.03], [0.103, 0.232, 0.3]],
    grip: [-0.065, -0.27], fore: [0.035, 0.12], hip: [0.2, -0.2, -0.62] },
  m4: { id: 'm4', slot: 'rifle', name: 'M4', price: 50, dmg: 22, rate: 0.095, auto: true, spread: 0.006, move: 0.022, air: 0.06, bloom: 0.007, bloomMax: 0.045, kick: 0.011, mag: 30, reserve: 90, reload: 1.4, draw: 0.45, len: 0.82, model: 'gun_m4', muzzle: [0.01, 0.083, 0.41], speed: 1,
    desc: 'קרבין קצר ואוטומטי. יותר נזק, פיזור קטן יותר.', img: 'assets/arcade/sh_m4.jpg',
    ads: { fov: 48, vm: 56, spread: 0.25, move: 0.6, kick: 0.6, bloom: 0.5 },
    sight: { rail: 0.124, cx: 0.01, line: 0.17, rear: -0.12, front: 0.31, post: 0.09 }, holo: -0.01, cut: [[0.126, -0.165, -0.08], [0.1, 0.262, 0.345]],
    grip: [-0.075, -0.17], fore: [0.035, 0.17], hip: [0.2, -0.2, -0.56] },
  tavor: { id: 'tavor', slot: 'rifle', name: 'תבור', price: 110, dmg: 26, rate: 0.085, auto: true, spread: 0.0035, move: 0.018, air: 0.05, bloom: 0.005, bloomMax: 0.035, kick: 0.009, mag: 30, reserve: 90, reload: 1.3, draw: 0.5, len: 0.72, model: 'gun_rifle', muzzle: [0, 0.067, 0.36], speed: 0.97,
    desc: 'הבולפאפ של צה״ל. הכי מדויק, הכי חזק, הכי מהיר.', img: 'assets/arcade/sh_tavor.jpg',
    ads: { fov: 45, vm: 56, spread: 0.2, move: 0.55, kick: 0.6, bloom: 0.5 },
    sight: { rail: 0.122, cx: -0.006, line: 0.163, rear: -0.035, front: 0.2, post: 0.12 }, holo: 0.045, cut: [[0.1225, -0.008, 0.1]],
    grip: [-0.07, 0.03], fore: [-0.03, 0.24], hip: [0.2, -0.2, -0.5] },
  // The Negev (a light machine gun: a hundred rounds, fast, heavy and loose) and the marksman
  // rifle (bolt action, its own scope, a body shot takes three quarters). Numbers off the models
  // (as in js/range3d.js); the marksman's scope is its own (scope: the eye point behind it).
  negev: { id: 'negev', slot: 'rifle', name: 'נגב', price: 80, dmg: 21, rate: 0.068, auto: true, spread: 0.012, move: 0.034, air: 0.07, bloom: 0.0045, bloomMax: 0.05, kick: 0.009, mag: 100, reserve: 100, reload: 2.6, draw: 0.75, len: 1.0, model: 'gun_negev', muzzle: [0.01, 0.05, 0.5], speed: 0.86,
    desc: 'מקלע קל. מאה כדורים, יורה בלי הפסקה, כבד ופחות מדויק.', img: 'assets/arcade/sh_negev.jpg',
    ads: { fov: 52, vm: 56, spread: 0.38, move: 0.5, kick: 0.6, bloom: 0.6 },
    sight: { rail: 0.119, cx: 0.008, line: 0.158, rear: -0.06, front: 0.36, post: 0.1 }, holo: -0.02,
    grip: [-0.06, -0.22], fore: [-0.02, 0.22], hip: [0.2, -0.165, -0.64] },
  sniper: { id: 'sniper', slot: 'rifle', name: 'רובה צלפים', price: 150, dmg: 75, rate: 1.05, auto: false, bolt: true, spread: 0.03, move: 0.05, air: 0.09, bloom: 0, bloomMax: 0, kick: 0.05, mag: 5, reserve: 20, reload: 2.2, draw: 0.65, len: 1.12, model: 'gun_sniper', muzzle: [0.017, 0.039, 0.56], speed: 0.9,
    desc: 'נעילת בריח וכוונת משלו. פגיעה בגוף — שלושה רבעים, בראש — סוף.', img: 'assets/arcade/sh_sniper.jpg', scope: true,
    ads: { fov: 14, vm: 50, spread: 0.004, move: 0.45, kick: 0.5, bloom: 0, t: 0.32 },
    eye: { x: 0.005, y: 0.119, z: -0.33, d: 0.1 }, sight: { rail: 0.1, cx: 0.01 },
    grip: [-0.055, -0.36], fore: [-0.03, 0.1], hip: [0.2, -0.16, -0.66] },
  pistol: { id: 'pistol', slot: 'pistol', name: 'גלוק', dmg: 20, rate: 0.17, auto: false, spread: 0.003, move: 0.012, air: 0.04, bloom: 0.012, bloomMax: 0.04, kick: 0.022, mag: 12, reserve: 48, reload: 1.1, draw: 0.3, len: 0.19, model: 'gun_pistol', muzzle: [0, 0.051, 0.095], speed: 1.05,
    ads: { fov: 58, vm: 48, spread: 0.45, move: 0.75, kick: 0.75, bloom: 0.7 } },
};
const SH_GUNS = ['m16', 'm4', 'tavor', 'negev', 'sniper'];
// The holographic sight (bought once, fits every rifle): a ring and a dot through its window.
const SH_HOLO = { id: 'holo', name: 'כוונת הולוגרפית', price: 35, optic: 1, img: 'assets/arcade/sh_holo.jpg', desc: 'טבעת אדומה ונקודה, רואים דרכה הכול. מתאימה לכל רובה.', s: 0.095 };
// The attachments (js/armory.js sells them, at the HQ's armory): each bought once, owned for
// good and fitted per rifle (G.state.shFit). One optic at a time: the holo or the ACOG.
//  supp  — a quieter, muffled report the others hear from much closer (hear: metres), a small
//          flash, a little less damage far off (fall: lost at range, from near to far metres).
//  grip  — less kick and bloom, and the bloom settles faster.
//  bipod — standing still and aiming: much steadier (spread, kick and bloom), nothing otherwise.
//  acog  — a 4x scope with a chevron and horseshoe: the zoom (fov), tighter through it, slower up.
const SH_ATT = {
  supp: { id: 'supp', name: 'משתיק קול', price: 40, model: 'att_supp', img: 'assets/arcade/sh_supp.jpg', icon: '🤫', desc: 'שקט. שומעים אותך רק מקרוב, בלי הבזק. טיפה פחות נזק למרחק.', hear: 9, quiet: 18, fall: 0.12, near: 12, far: 32, flash: 0.3 },
  grip: { id: 'grip', name: 'ידית הסתערות', price: 25, model: 'att_grip', img: 'assets/arcade/sh_grip.jpg', icon: '✊', desc: 'פחות רתע, הנשק חוזר מהר למקום.', kick: 0.68, bloom: 0.72, settle: 1.7 },
  bipod: { id: 'bipod', name: 'דו־רגלית', price: 30, model: 'att_bipod', img: 'assets/arcade/sh_bipod.jpg', icon: '🦵', desc: 'עומדים במקום ומכוונים — יציב כמו סלע. בתנועה — לא עוזרת.', spread: 0.35, kick: 0.35, bloom: 0.4 },
  acog: { id: 'acog', name: 'כוונת טריג׳יקון', price: 60, model: 'att_acog', img: 'assets/arcade/sh_acog.jpg', icon: '🔭', desc: 'זום פי 4 עם חץ ופרסה. הכי טובה לרחוק, עולה לעין לאט יותר.', optic: 2, fov: 20.6, spread: 0.55, t: 0.3, move: 0.85 },
};
const SH_OPTICS = [null, 'holo', 'acog'];
const SH_LEGS_UP = -1.05; // the bipod folded: its legs swung forward and up toward the barrel // the optic's number (in the presence too)
const SH_HEAR = 26; // how far bots hear an ordinary shot (m)
// The buy phase at the start of each round, with the round's own money (not the shekels).
const SH_BUY = [
  { id: 'vest', key: 'Digit3', n: 3, icon: '🦺', img: 'assets/arcade/sh_vest.jpg', name: 'שכפ״ץ', price: 400, tip: 'סופג חצי מהפגיעות עד 50 נקודות שריון' },
  { id: 'helmet', key: 'Digit4', n: 4, icon: '⛑️', img: 'assets/arcade/sh_helmet.jpg', name: 'קסדה', price: 300, tip: 'פגיעה בראש פחות כואבת' },
  { id: 'nade', key: 'Digit5', n: 5, icon: '💣', img: 'assets/arcade/sh_nade.jpg', name: 'רימון', price: 300, tip: 'G לזרוק · עד 2' },
];
// Where the vest and the helmet sit on a soldier (metres, in the body's own frame: x forward).
const SH_WEAR = { vest: { s: 0.42, up: 0.5, fwd: 0.03 }, helm: { s: 0.46, up: 0.12, fwd: 0.01 } };
const SH_CASH = { start: 800, round: 300, kill: 200, lose: 500, max: 9000 }, SH_BUY_T = 9.5;
const SH_NADE = { fuse: 3, r: 7, dmg: 95, max: 2, speed: 15 };
// Recorded sounds (assets/audio/shooter/*.mp3) and how loud each is against the others. Each
// gun has its own report (two takes where there are two); 'far' is a shot across town.
const SH_SFX = {
  shot_m16: 0.8, shot_m16b: 1, shot_m4: 0.85, shot_m4b: 1, shot_tavor: 0.85, shot_glock: 0.9, shot_glockb: 0.9, far: 0.8,
  dry: 0.7, mag_out: 0.75, mag_in: 0.8, bolt: 0.9, pmag: 0.75, pslide: 0.75, mag_drop: 0.55, hit_concrete: 0.55, hit_metal: 0.45, ads: 0.35,
  whizz: 0.7, pin: 0.7, bounce: 0.6, boom: 1,
};
const SH_SHOTS = { m16: ['shot_m16', 'shot_m16b'], m4: ['shot_m4', 'shot_m4b'], tavor: ['shot_tavor'], negev: ['shot_m4b', 'shot_m16'], sniper: ['shot_m16b'], pistol: ['shot_glock', 'shot_glockb'] };
const SH_BUFS = {};
const SH_WK = ['rifle', 'pistol'];
const SH_TEAM = [{ name: 'כחולים', icon: '🔵', color: 0x2f7fe0, css: '#5aa8ff' }, { name: 'אדומים', icon: '🔴', color: 0xd8261f, css: '#ff6a5a' }];
const SH_FOV = 72, SH_ADS_T = 0.17; // the field of view from the hip, and how long the gun takes to come up to the eye
const SH_EYE = 1.62, SH_R = 0.35, SH_STEP = 0.5, SH_HALF = 19.3, SH_GRAV = 15, SH_JUMP = 5.0;

// What the bots shout ([m/f] is the bot's own gender) and what the cast says about the rounds.
const SH_LINES = {
  cover: ['קאבר!', 'מחפה!', 'זז! זז! זז!', 'אני מאחורי המיגונית!', 'תחפו עליי!'],
  dead: ['נפסלתי!!', 'אהההה! פגעו בי!', 'זה לא נחשב, הייתי בהפסקה!', 'תגידו לאמא שלי שהייתי גיבו[ר/רה]', 'רגע, זה היה אמיתי?!'],
  kill: ['זה אימון!!', 'יששש!', 'אוגה בוגה!', 'ראיתם את זה?!', 'אחד-אפס למטבח!'],
  reload: ['מישהו ראה את המחסנית שלי?', 'מחליף מחסנית!', 'רגע רגע, מעצור!', 'נגמרו לי הכדורים, שנייה!'],
  hurt: ['איי!', 'מי ירה עליי?!', 'זה כואב גם בתרגיל!', 'חובש!!!'],
  start: ['יאללה!', 'כולם לעמדות!', 'מי שנפסל קונה שתייה.', 'שקט, אני מקשיב לצעדים...'],
  flank: ['אני מאגף מימין!', 'עוקף מהסמטה!', 'הם לא יראו אותי בא...'],
  nade: ['רימון!!', 'רימון יוצא!', 'תתפזרו!!', 'מתנה בדרך אליכם!'],
};
const SH_SAY = {
  intro: ['{@commander} (בקשר): "זה היה אמור להיות תרגיל חפ״ק... מישהו הביא נשק במקום מפות."', '{@harasar}: "כל תרמיל שנופל פה — חוזר אליי. ספרתי."'],
  win: ['{@commander}: "זה היה אמור להיות תרגיל חפ״ק..."', '{@harasar}: "יפה. עכשיו לאסוף את כל התרמילים. אחד אחד."', '{@hamalist}: "אני מעדכנת את כל הגדוד!!! סיבוב לנו!!!"', '{@commander}: "יפה מאוד. מי אישר את זה בכלל?"'],
  lose: ['{@harasar}: "כמו שאמרתי בתדריך: לא עומדים באמצע הכיכר."', '{@commander}: "אני רואה פה הרבה גבורה ומעט מחסה."', '{@hamalist}: "אוי לא... טוב, אני לא אספר לאף אחד. (מספרת לכולם)"'],
  clutch: ['{@hamalist}: "קלאץ\'!!! לבד מול שניים!!! אני רועדת!!!"', '{@commander}: "אחד נגד שניים וניצח. אני מגיש את זה לצל״ש. או לדו״ח. עוד לא החלטתי."'],
  whiff: ['{@harasar}: "מחסנית שלמה ואפס פגיעות. ירית על הירח?"', '{@p_liran}: "פתחתי הימורים על הכדור הבא. אף אחד לא מהמר שהוא פוגע."'],
  head: ['{@harasar}: "בראש! בדיוק כמו במטווח. ...שלא היה."', '{@hamalist}: "הדשוט!!! אני לא יודעת מה זה אבל הדשוט!!!"'],
  draw: ['{@commander}: "תיקו. כולם חוזרים לעמדות, ואף אחד לא מספר על זה לסמג״ד."'],
};

// ---------- the town ----------
// Boxes: { kind, x, z, w (along x), d (along z), h }. Everything comes in pairs mirrored through
// the middle (x, z → −x, −z), so both sides get the same cover. Ramps lead up the two
// climbable containers.
const SH_MAP = (() => {
  const boxes = [], ramps = [], lamps = [], palms = [];
  const add = (o, mirror = true) => { boxes.push({ ...o, ry: o.ry || 0 }); if (mirror) boxes.push({ ...o, x: -o.x, z: -o.z, ry: (o.ry || 0) + Math.PI }); };
  add({ kind: 'radar', x: 0, z: 0, w: 2.6, d: 2.6, h: 3.4 }, false);
  add({ kind: 'launcher', x: -7.5, z: -1.5, w: 2.8, d: 7.2, h: 3.0 });
  add({ kind: 'container', x: 7, z: -9, w: 6.2, d: 2.6, h: 2.6 });
  add({ kind: 'container', x: -14.5, z: -8.5, w: 2.6, d: 6.2, h: 2.6, climb: true });
  add({ kind: 'shelter', x: -2.6, z: -9.5, w: 3.4, d: 2.4, h: 2.5 });
  add({ kind: 'shelter', x: 16.6, z: -3, w: 2.4, d: 3.4, h: 2.5 });
  add({ kind: 'bags', x: 0, z: -13.6, w: 3.4, d: 1.0, h: 1.05 });
  add({ kind: 'bags', x: 3.8, z: -3.4, w: 3.0, d: 1.0, h: 1.05 });
  add({ kind: 'bags', x: 11.5, z: -2.5, w: 1.0, d: 3.0, h: 1.05 });
  add({ kind: 'crate', x: 11, z: -14.5, w: 1.3, d: 1.3, h: 1.3 });
  add({ kind: 'crate', x: -9.5, z: -13, w: 1.3, d: 1.3, h: 2.6 });
  add({ kind: 'crate', x: 2.6, z: -6.4, w: 1.2, d: 1.2, h: 1.2 });
  add({ kind: 'crate', x: 18.5, z: 7, w: 1.2, d: 1.2, h: 1.2 });
  add({ kind: 'dumpster', x: 16.8, z: -12, w: 1.4, d: 2.2, h: 1.5 });
  // The ramp up the climbable container (it's high at the container's end).
  ramps.push({ x0: -15.6, x1: -13.4, z0: -5.4, z1: -0.8, h: 2.6, hi: 'z0' });
  ramps.push({ x0: 13.4, x1: 15.6, z0: 0.8, z1: 5.4, h: 2.6, hi: 'z1' });
  for (const [x, z] of [[-6, -15.5], [13, -7.5], [-4.6, 5.2]]) { lamps.push({ x, z }, { x: -x, z: -z }); boxes.push({ kind: 'pole', x, z, w: 0.3, d: 0.3, h: 4.6 }, { kind: 'pole', x: -x, z: -z, w: 0.3, d: 0.3, h: 4.6 }); }
  for (const [x, z] of [[18.4, 18.4], [-18.4, 18.4]]) { palms.push({ x, z }, { x: -x, z: -z }); boxes.push({ kind: 'pole', x, z, w: 0.6, d: 0.6, h: 7 }, { kind: 'pole', x: -x, z: -z, w: 0.6, d: 0.6, h: 7 }); }
  // The houses around the square (outside the walkable area, but bullets hit them).
  const H = [5.2, 7.4, 6.2, 8, 5.6];
  for (let i = 0; i < 5; i++) {
    const c = -16 + i * 8;
    boxes.push({ kind: 'house', x: c, z: 23.2, w: 7.8, d: 7, h: H[i], i }, { kind: 'house', x: -c, z: -23.2, w: 7.8, d: 7, h: H[i], i: i + 5 });
    boxes.push({ kind: 'house', x: 23.2, z: c, w: 7, d: 7.8, h: H[(i + 2) % 5], i: i + 10 }, { kind: 'house', x: -23.2, z: -c, w: 7, d: 7.8, h: H[(i + 2) % 5], i: i + 15 });
  }
  for (const b of boxes) { b.x0 = b.x - b.w / 2; b.x1 = b.x + b.w / 2; b.z0 = b.z - b.d / 2; b.z1 = b.z + b.d / 2; }
  // Where each team starts: blue at the south end facing north (+z), red at the north end.
  const spawns = [[{ x: -3, z: -17.4 }, { x: 3, z: -17.4 }], [{ x: 3, z: 17.4 }, { x: -3, z: 17.4 }]];
  return { boxes, ramps, lamps, palms, spawns };
})();

const ShooterGame = {
  id: 'shooter', name: 'נתיבות הקטנה', icon: '🔫',
  desc: 'יריות בגוף ראשון, אחד על אחד או שניים על שניים, בעיירה קטנה של מכולות, מיגוניות וכיפת ברזל. ראשון לשלושה סיבובים. זה תרגיל. כולם אומרים שזה תרגיל.',
  cover: 'assets/arcade/cover_shooter.jpg', solo: true, online: true, minOnline: 2,
  WIN: 3, ROUND: 90,

  // ---------- the world, built once ----------
  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0.102, 0.145, 0.44); // the top of the panorama
    sc.fog = new THREE.Fog(0x8a5a5a, 40, 190);
    this.camera = new THREE.PerspectiveCamera(SH_FOV, 1, 0.05, 600);
    sc.add(new THREE.HemisphereLight(0xffc9a0, 0x4a3a50, 0.75));
    const sun = this.sun = new THREE.DirectionalLight(0xffa860, 1.15);
    sun.position.set(-38, 18, 14); sun.castShadow = true; sun.shadow.mapSize.set(G.touch ? 1024 : 2048, G.touch ? 1024 : 2048);
    sun.shadow.bias = -0.0006;
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 110 });
    sc.add(sun);
    Arcade.sky(sc, 'assets/arcade/dome_city.jpg', { r: 200, h: 110, y0: -8, repeat: 3 });
    // The ground: sand all round, an asphalt square, lane markings and a crosswalk.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/sand.jpg', 50), color: 0xd8b088, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.y = -0.03; sand.receiveShadow = true; sc.add(sand);
    const asph = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: Arcade.texture('assets/tex/asphalt.jpg', 8), color: 0xb0a090, roughness: 0.95 }));
    asph.rotation.x = -Math.PI / 2; asph.receiveShadow = true; sc.add(asph);
    const paint = new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 });
    const stripe = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), paint); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z); m.receiveShadow = true; sc.add(m); };
    for (let z = -18; z <= 18; z += 3) if (Math.abs(z) > 2.5) stripe(0, z, 0.18, 1.6);
    for (let i = 0; i < 6; i++) { stripe(-10.5 + i * 0.9, 12.5, 0.5, 3); stripe(10.5 - i * 0.9, -12.5, 0.5, 3); }
    // A curb round the square.
    const curb = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xd8b02a, roughness: 0.8 });
    for (const [x, z, w, d] of [[0, 19.75, 39.5, 0.4], [0, -19.75, 39.5, 0.4], [19.75, 0, 0.4, 39.5], [-19.75, 0, 0.4, 39.5]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), curb); c.position.set(x, 0.08, z); c.receiveShadow = true; sc.add(c);
      for (let k = -18; k <= 18; k += 4) { const y = new THREE.Mesh(new THREE.BoxGeometry(w > 1 ? 2 : 0.41, 0.17, w > 1 ? 0.41 : 2), yellow); y.position.set(w > 1 ? k : x, 0.08, w > 1 ? z : k); sc.add(y); }
    }
    this.soft = this.radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.flashTex = [this.flashCanvas(0), this.flashCanvas(1)];
    this.props = new THREE.Group(); sc.add(this.props);
    this.decals = []; this.fx = []; this.tracers = [];
    this.decalMat = new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decalGeo = new THREE.CircleGeometry(0.06, 8);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracerGeo = new THREE.BoxGeometry(0.018, 0.018, 1); this.tracerGeo.translate(0, 0, 0.5);
    // The world's muzzle flash light (one, moved to whoever fired last).
    this.flashLight = new THREE.PointLight(0xffc070, 0, 9, 2); sc.add(this.flashLight);
    this.buildTown();
    this.buildViewModel();
    this.buildGrid();
  },
  // A player's gun in a slot: their rifle (the one they chose or were given) or the Glock.
  wp(p, w = p.w) { return w === 'pistol' ? SH_W.pistol : this.loadW((p && p.gun) || 'm16', p && p.att); },
  // ---------- loadouts: a rifle and what is fitted on it ----------
  // att: { o: optic (0 none, 1 holo, 2 acog), s: suppressor, g: foregrip, b: bipod } (0/1 each).
  att(a) { a = a || {}; return { o: a.o === 2 ? 2 : a.o === 1 ? 1 : 0, s: a.s ? 1 : 0, g: a.g ? 1 : 0, b: a.b ? 1 : 0 }; },
  attKey(a) { a = this.att(a); return `${a.o}${a.s}${a.g}${a.b}`; },
  // Packed small for the presence: the optic, and the rest as bits (1 supp, 2 grip, 4 bipod).
  attBits(a) { a = this.att(a); return a.s | (a.g << 1) | (a.b << 2); },
  attFrom(o, bits) { return this.att({ o: +o || 0, s: bits & 1, g: bits & 2, b: bits & 4 }); },
  // A rifle's numbers with its attachments (the bipod's steadiness depends on standing still, so
  // it is applied per shot, see steady). Cached per rifle and fitting.
  loadW(gun, a) {
    const base = SH_W[gun] || SH_W.m16;
    a = this.att(a);
    if (base.scope) a.o = 0; // the marksman rifle has its own scope
    const key = gun + ':' + this.attKey(a);
    this.wCache = this.wCache || {};
    if (this.wCache[key]) return this.wCache[key];
    const W = { ...base, ads: { ...base.ads }, att: a, adsT: base.ads.t || SH_ADS_T, hear: SH_HEAR, settle: 1 };
    if (a.s) { const A = SH_ATT.supp; W.hear = A.hear; W.supp = true; W.draw += 0.05; }
    if (a.g) { const A = SH_ATT.grip; W.kick *= A.kick; W.bloom *= A.bloom; W.settle = A.settle; }
    if (a.b) { W.bipod = true; W.draw += 0.08; }
    if (a.o === 2) { const A = SH_ATT.acog; W.ads.fov = A.fov; W.ads.spread *= A.spread; W.ads.move *= A.move; W.adsT = A.t; W.ads.vm = 40; W.acog = true; }
    return (this.wCache[key] = W);
  },
  // The bipod: standing still on the ground with the gun up, a multiplier (spread, kick, bloom).
  steady(p, W) {
    if (!W.bipod || !p.onGround || Math.hypot(p.vx || 0, p.vz || 0) > 0.6 || (p.adsK || 0) < 0.6) return null;
    return SH_ATT.bipod;
  },
  // Your spread right now (the crosshair, the shot): the gun, moving, in the air, the bloom,
  // the sight and the bipod.
  spreadOf(p, W = this.wp(p)) {
    const moving = Math.hypot(p.vx || 0, p.vz || 0) > 1, ak = p.adsK || 0;
    let s = (W.spread + (moving ? W.move : 0) + (p.onGround === false ? W.air : 0) + (p.bloom || 0)) * (1 - (1 - W.ads.spread) * ak);
    if (W.scope && ak < 0.85) s = W.spread + (moving ? W.move : 0) + (p.onGround === false ? W.air : 0);
    const st = this.steady(p, W); if (st) s *= st.spread;
    return s;
  },
  // A hit's damage from the shooter's rifle: a suppressed one loses a little far off.
  shotDmg(p, W, dist) {
    let d = W.dmg;
    if (W.supp && dist != null) { const A = SH_ATT.supp; d *= 1 - A.fall * Math.max(0, Math.min(1, (dist - A.near) / (A.far - A.near))); }
    return d;
  },
  radial(a, b) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  },
  // Two muzzle flash frames: a hot core and a star of flame tongues.
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
  // A house front: stucco, windows (some lit for the evening), a door, shutters.
  facade(i, w, h) {
    const cols = ['#e8dcc0', '#dcc8a0', '#efe4d0', '#d8c4a8', '#e4d2b4'];
    return this.canvasTex(256, Math.round(256 * h / w), (g, W, Hh) => {
      g.fillStyle = cols[i % cols.length]; g.fillRect(0, 0, W, Hh);
      for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * Hh, 3, 3); }
      const floors = Math.max(1, Math.round(h / 2.8)), fh = Hh / floors;
      for (let f = 0; f < floors; f++) for (let k = 0; k < 3; k++) {
        const x = 26 + k * 78, y = f * fh + fh * 0.25, ww = 44, wh = fh * 0.42;
        const lit = ((i * 7 + f * 3 + k) % 5) < 2;
        g.fillStyle = '#5a4a3a'; g.fillRect(x - 4, y - 4, ww + 8, wh + 8);
        g.fillStyle = lit ? '#ffd27a' : '#3a4a5a'; g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + ww / 2 - 1, y, 2, wh);
        if (!lit) { g.fillStyle = '#8a7a6a'; for (let s = 0; s < wh * 0.6; s += 5) g.fillRect(x, y + s, ww, 3); }
      }
      g.fillStyle = '#6a4a2a'; g.fillRect(W / 2 - 18, Hh - fh * 0.55, 36, fh * 0.55);
    });
  },
  buildTown() {
    const sc = this.scene;
    // The houses: plain boxes with a front, flat roofs with a solar water heater (דוד שמש).
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb8aa98, roughness: 1 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.5, metalness: 0.3 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.3, metalness: 0.5 });
    for (const b of SH_MAP.boxes.filter(o => o.kind === 'house')) {
      const front = this.facade(b.i, Math.max(b.w, b.d), b.h);
      const side = new THREE.MeshStandardMaterial({ map: front, roughness: 0.95 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), [side, side, roofMat, roofMat, side, side]);
      m.position.set(b.x, b.h / 2, b.z); m.castShadow = m.receiveShadow = true; sc.add(m);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 12), tankMat);
      tank.rotation.z = Math.PI / 2; tank.position.set(b.x + 1, b.h + 0.6, b.z); sc.add(tank);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 1.1), panelMat);
      panel.rotation.x = -0.5; panel.position.set(b.x + 1, b.h + 0.35, b.z + 1); sc.add(panel);
    }
    // Shop signs on a few houses, facing the square.
    const shops = [['פלאפל אצל הדוד', '#c0392b'], ['מכולת השכונה', '#2a7a3a'], ['פיצה ומשלוחים', '#d8901a'], ['מספרה', '#2a5aa8']];
    const houses = SH_MAP.boxes.filter(o => o.kind === 'house');
    [houses[2], houses[5], houses[8], houses[15]].forEach((b, k) => {
      const [text, col] = shops[k];
      const t = this.canvasTex(512, 96, (g, W, Hh) => { g.fillStyle = col; g.fillRect(0, 0, W, Hh); g.strokeStyle = '#fff6'; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, Hh - 12); g.fillStyle = '#fff'; g.font = '900 54px Rubik, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(text, W / 2, Hh / 2 + 2); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.75), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 }));
      const nx = Math.abs(b.x) > 20 ? -Math.sign(b.x) : 0, nz = Math.abs(b.z) > 20 ? -Math.sign(b.z) : 0;
      s.position.set(b.x + nx * (b.w / 2 + 0.03), 3, b.z + nz * (b.d / 2 + 0.03));
      s.rotation.y = Math.atan2(nx, nz);
      sc.add(s);
    });
    // The welcome sign over the south end, and a goodbye one over the north.
    const sign = (z, text, sub) => {
      const t = this.canvasTex(1024, 256, (g, W, Hh) => {
        const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#1f5a9a'); gr.addColorStop(1, '#123a6a');
        g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
        g.strokeStyle = '#ffd23f'; g.lineWidth = 10; g.strokeRect(10, 10, W - 20, Hh - 20);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
        g.font = '900 96px Rubik, Arial'; g.fillText(text, W / 2, Hh * 0.42);
        g.font = '700 40px Rubik, Arial'; g.fillStyle = '#ffd23f'; g.fillText(sub, W / 2, Hh * 0.8);
      });
      const mat = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3, roughness: 0.6 });
      const board = new THREE.Group();
      for (const f of [0, Math.PI]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.1), mat); p.rotation.y = f; p.position.z = f ? -0.04 : 0.04; board.add(p); }
      const back = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.3, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
      board.add(back);
      board.position.set(0, 5.6, z); board.rotation.y = z < 0 ? 0 : Math.PI;
      sc.add(board);
      const pole = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, metalness: 0.6, roughness: 0.4 });
      for (const sx of [-4.3, 4.3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6.8, 8), pole); p.position.set(sx, 3.4, z); p.castShadow = true; sc.add(p); }
    };
    sign(-19.4, 'ברוכים הבאים לנתיבות הקטנה', 'עיר הכיפה · אוכלוסייה: 4 · גובה: 2.6 מ׳ (על המכולה)');
    sign(19.4, 'נתיבות הקטנה מאחלת נסיעה טובה', 'לא לשכוח לאסוף את התרמילים');
    // Lamp posts with warm bulbs; a few real lights.
    const pm = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.6, roughness: 0.5 });
    const bulb = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
    SH_MAP.lamps.forEach((l, i) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8), pm); p.position.set(l.x, 2.3, l.z); p.castShadow = true; sc.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.1), pm); arm.position.set(l.x + 0.4, 4.55, l.z); sc.add(arm);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bulb); b.position.set(l.x + 0.8, 4.4, l.z); sc.add(b);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color: 0xffc070, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(1.8); glow.position.copy(b.position); sc.add(glow);
      if (i < (G.touch ? 2 : 4)) { const L = new THREE.PointLight(0xffb060, 0.9, 12, 1.6); L.position.set(l.x + 0.8, 4.2, l.z); sc.add(L); }
    });
    // Ramps up the climbable containers: a steel plate on legs.
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x6a6e66, metalness: 0.5, roughness: 0.6 });
    for (const r of SH_MAP.ramps) {
      const len = Math.hypot(r.z1 - r.z0, r.h), w = r.x1 - r.x0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, len), rampMat);
      m.position.set((r.x0 + r.x1) / 2, r.h / 2 - 0.05, (r.z0 + r.z1) / 2);
      m.rotation.x = (r.hi === 'z0' ? 1 : -1) * Math.atan2(r.h, r.z1 - r.z0);
      m.castShadow = m.receiveShadow = true; sc.add(m);
      for (let k = 1; k < 6; k++) { const t = k / 6, y = r.h * (r.hi === 'z0' ? 1 - t : t); const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.08), rampMat); s.position.set((r.x0 + r.x1) / 2, y + 0.03, r.z0 + (r.z1 - r.z0) * t); sc.add(s); }
    }
  },
  // The props from models (rebuilt when the models arrive); boxes stand in until then.
  dress() {
    const P = this.props;
    while (P.children.length) P.remove(P.children[0]);
    const crateTex = this.crateTex || (this.crateTex = this.canvasTex(128, 128, (g) => {
      g.fillStyle = '#8a6a3a'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#6a4e28'; for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 3);
      g.strokeStyle = '#5a3e1a'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118); g.beginPath(); g.moveTo(5, 5); g.lineTo(123, 123); g.stroke();
      g.fillStyle = '#2a2a1a'; g.font = '900 22px Arial'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('צה״ל', 64, 70);
    }));
    const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.9 });
    for (const b of SH_MAP.boxes) {
      if (b.kind === 'house' || b.kind === 'pole') continue;
      const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
      let m = null;
      const long = b.w > b.d;
      if (b.kind === 'container') m = Assets.model('container', { rotY: long ? Math.PI / 2 : 0, size: [b.w, b.h, b.d] });
      else if (b.kind === 'shelter') m = Assets.model('arc_shelter', { rotY: (long ? 0 : Math.PI / 2) + (b.ry || 0), size: [b.w, b.h, b.d] });
      else if (b.kind === 'bags') m = Assets.model('arc_sandbags', { rotY: long ? 0 : Math.PI / 2, size: [b.w + 0.2, b.h + 0.05, b.d + 0.3] });
      else if (b.kind === 'dumpster') m = Assets.model('arc_dumpster', { rotY: long ? 0 : Math.PI / 2, size: [b.w, b.h, b.d] });
      else if (b.kind === 'launcher') { m = Assets.model('launcher', { rotY: b.ry || 0, depth: b.d + 0.6 }); }
      else if (b.kind === 'radar') { m = Assets.model('radar', { length: 4.6, rotY: 0.6 }); }
      if (b.kind === 'crate') {
        const n = Math.round(b.h / b.w) || 1, s = b.h / n;
        for (let k = 0; k < n; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(b.w, s, b.d), crateMat); c.position.y = s / 2 + k * s; c.rotation.y = k * 0.25; c.castShadow = c.receiveShadow = true; g.add(c); }
      } else if (m) g.add(m);
      else {
        const col = { container: 0x5d6b3e, shelter: 0x9b9a90, bags: 0xc8b07a, dumpster: 0x2f5a3a, launcher: 0x4b5a2a, radar: 0x8a8f88 }[b.kind] || 0x777777;
        const box = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }));
        box.position.y = b.h / 2; g.add(box);
      }
      if (b.kind === 'shelter') {
        const lb = Scene3D.label('מיגונית', { bg: 'rgba(200,45,35,.9)', size: 0.5 }); lb.position.y = b.h + 0.5; g.add(lb);
      }
      if (b.climb) { const lb = Scene3D.label('⬆️ אפשר לעלות', { size: 0.55 }); lb.position.y = b.h + 0.7; g.add(lb); }
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      P.add(g);
    }
    for (const p of SH_MAP.palms) { const m = Assets.model('palm', { height: 7.5 }); if (m) { m.position.set(p.x, 0, p.z); m.rotation.y = p.x * 3; P.add(m); } }
  },

  // ---------- collision and rays ----------
  rampH(x, z) {
    for (const r of SH_MAP.ramps) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const t = (z - r.z0) / (r.z1 - r.z0);
      return r.h * (r.hi === 'z0' ? 1 - t : t);
    }
    return -1;
  },
  // The floor under someone whose feet are at y: the ground, a box top, or a ramp.
  floorAt(x, z, y) {
    let f = 0;
    for (const b of SH_MAP.boxes) {
      if (b.h > y + SH_STEP || x < b.x0 - 0.15 || x > b.x1 + 0.15 || z < b.z0 - 0.15 || z > b.z1 + 0.15) continue;
      if (b.h > f) f = b.h;
    }
    const r = this.rampH(x, z);
    if (r > f && r <= y + SH_STEP + 0.05) f = r;
    return f;
  },
  // Moves a body (x, z, y) by (dx, dz): pushed out of walls, stopped by a ramp's high side.
  slide(p, dx, dz) {
    const ox = p.x, oz = p.z;
    p.x += dx; p.z += dz;
    for (let it = 0; it < 2; it++) for (const b of SH_MAP.boxes) {
      if (b.h <= p.y + SH_STEP) continue;
      const cx = Math.max(b.x0, Math.min(b.x1, p.x)), cz = Math.max(b.z0, Math.min(b.z1, p.z));
      const ddx = p.x - cx, ddz = p.z - cz, d2 = ddx * ddx + ddz * ddz;
      if (d2 >= SH_R * SH_R) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (SH_R - d) / d; p.x += ddx * k; p.z += ddz * k; }
      else {
        // Inside the box: out the nearest side.
        const e = [p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z], m = Math.min(...e), i = e.indexOf(m);
        if (i === 0) p.x = b.x0 - SH_R; else if (i === 1) p.x = b.x1 + SH_R; else if (i === 2) p.z = b.z0 - SH_R; else p.z = b.z1 + SH_R;
      }
    }
    const r = this.rampH(p.x, p.z);
    if (r > p.y + SH_STEP + 0.05) { p.x = ox; p.z = oz; }
    p.x = Math.max(-SH_HALF, Math.min(SH_HALF, p.x)); p.z = Math.max(-SH_HALF, Math.min(SH_HALF, p.z));
  },
  // A ray against the town: { t, x, y, z, nx, ny, nz } for the nearest wall, box or the ground.
  rayStatic(o, d, maxT = 120) {
    let best = { t: maxT, nx: 0, ny: 1, nz: 0, hit: false };
    if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best.t) best = { t, nx: 0, ny: 1, nz: 0, hit: true, ground: true }; }
    for (const b of SH_MAP.boxes) {
      let t0 = 0, t1 = best.t, n = null;
      const ax = [[o.x, d.x, b.x0, b.x1, 'x'], [o.y, d.y, 0, b.h, 'y'], [o.z, d.z, b.z0, b.z1, 'z']];
      let ok = true;
      for (const [oo, dd, lo, hi, k] of ax) {
        if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) { ok = false; break; } continue; }
        let ta = (lo - oo) / dd, tb = (hi - oo) / dd, s = -1;
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; }
        if (ta > t0) { t0 = ta; n = [k, s]; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
      if (!ok || !n || t0 <= 0 || t0 >= best.t) continue;
      best = { t: t0, nx: n[0] === 'x' ? n[1] : 0, ny: n[0] === 'y' ? n[1] : 0, nz: n[0] === 'z' ? n[1] : 0, hit: true, box: b };
    }
    // The ramps' slopes.
    for (const r of SH_MAP.ramps) {
      const L = r.z1 - r.z0, s = r.hi === 'z0' ? -1 : 1;
      // Plane: y = r.h * (s > 0 ? (z - z0) / L : (z1 - z) / L)  →  y − k z − c = 0
      const k = s * r.h / L, c = s > 0 ? -k * r.z0 : r.h - k * r.z0;
      const den = d.y - k * d.z;
      if (Math.abs(den) < 1e-9) continue;
      const t = (k * o.z + c - o.y) / den;
      if (t <= 0 || t >= best.t) continue;
      const x = o.x + d.x * t, z = o.z + d.z * t;
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const nl = Math.hypot(1, k); best = { t, nx: 0, ny: 1 / nl, nz: -k / nl, hit: true };
    }
    best.x = o.x + d.x * best.t; best.y = o.y + d.y * best.t; best.z = o.z + d.z * best.t;
    return best;
  },
  // A ray against a soldier: a body cylinder and a head. → { t, head } or null.
  rayBody(o, d, e) {
    let best = null;
    const hx = e.x, hz = e.z, hy = e.y + 1.6, hr = 0.17;
    // Head (sphere).
    const ox = o.x - hx, oy = o.y - hy, oz = o.z - hz;
    const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - hr * hr, disc = b * b - c;
    if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0) best = { t, head: true }; }
    // Body (vertical cylinder from the feet to the neck).
    const px = o.x - e.x, pz = o.z - e.z, A = d.x * d.x + d.z * d.z;
    if (A > 1e-9) {
      const B = px * d.x + pz * d.z, C = px * px + pz * pz - 0.3 * 0.3, D = B * B - A * C;
      if (D >= 0) {
        const t = (-B - Math.sqrt(D)) / A, y = o.y + d.y * t;
        if (t > 0 && y >= e.y && y <= e.y + 1.47 && (!best || t < best.t)) best = { t, head: false };
      }
    }
    return best;
  },
  // Can a see b (eye to a point at height h on b)?
  sees(a, bx, by, bz) {
    const o = { x: a.x, y: a.y + SH_EYE, z: a.z }, dx = bx - o.x, dy = by - o.y, dz = bz - o.z, L = Math.hypot(dx, dy, dz) || 1;
    return this.rayStatic(o, { x: dx / L, y: dy / L, z: dz / L }, L).hit === false;
  },

  // ---------- the bots' map: a grid for paths, and spots to take cover at ----------
  buildGrid() {
    const N = this.GN = 80, cell = 0.5;
    const bl = this.blocked = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -20 + (i + 0.5) * cell, z = -20 + (j + 0.5) * cell;
      let b = Math.abs(x) > SH_HALF - 0.1 || Math.abs(z) > SH_HALF - 0.1;
      for (const o of SH_MAP.boxes) if (!b && o.h > 0.6 && x > o.x0 - 0.45 && x < o.x1 + 0.45 && z > o.z0 - 0.45 && z < o.z1 + 0.45) b = true;
      for (const r of SH_MAP.ramps) if (!b && x > r.x0 - 0.45 && x < r.x1 + 0.45 && z > r.z0 - 0.45 && z < r.z1 + 0.45) b = true;
      bl[j * N + i] = b ? 1 : 0;
    }
    // Cover spots: beside every solid thing at least chest high, plus the low sandbags.
    this.covers = [];
    for (const o of SH_MAP.boxes) {
      if (o.kind === 'house' || o.kind === 'pole' || o.h < 1) continue;
      const hw = o.w / 2 + 0.75, hd = o.d / 2 + 0.75;
      const pts = [[o.x - hw, o.z], [o.x + hw, o.z], [o.x, o.z - hd], [o.x, o.z + hd]];
      if (o.w > 2.5) pts.push([o.x - o.w / 4, o.z - hd], [o.x + o.w / 4, o.z - hd], [o.x - o.w / 4, o.z + hd], [o.x + o.w / 4, o.z + hd]);
      if (o.d > 2.5) pts.push([o.x - hw, o.z - o.d / 4], [o.x - hw, o.z + o.d / 4], [o.x + hw, o.z - o.d / 4], [o.x + hw, o.z + o.d / 4]);
      for (const [x, z] of pts) if (this.free(x, z)) this.covers.push({ x, z, low: o.h < 1.5 });
    }
  },
  cellOf(x, z) { return [Math.max(0, Math.min(this.GN - 1, Math.floor((x + 20) * 2))), Math.max(0, Math.min(this.GN - 1, Math.floor((z + 20) * 2)))]; },
  free(x, z) { const [i, j] = this.cellOf(x, z); return Math.abs(x) < 19.2 && Math.abs(z) < 19.2 && !this.blocked[j * this.GN + i]; },
  // A* on the grid; the path comes back as points, the start left out.
  path(x0, z0, x1, z1) {
    const N = this.GN, bl = this.blocked;
    let [si, sj] = this.cellOf(x0, z0), [gi, gj] = this.cellOf(x1, z1);
    const near = (i, j) => { if (!bl[j * N + i]) return [i, j]; for (let r = 1; r < 5; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < N && b < N && !bl[b * N + a]) return [a, b]; } return [i, j]; };
    [si, sj] = near(si, sj); [gi, gj] = near(gi, gj);
    const S = sj * N + si, T = gj * N + gi;
    const g = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
    const heap = [];
    const push = (n, f) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hf = (n) => { const dx = Math.abs(n % N - gi), dy = Math.abs(((n / N) | 0) - gj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    g[S] = 0; push(S, hf(S));
    let found = false, iter = 0;
    while (heap.length && iter++ < 7000) {
      const [, n] = pop();
      if (closed[n]) continue;
      if (n === T) { found = true; break; }
      closed[n] = 1;
      const i = n % N, j = (n / N) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const m = b * N + a;
        if (bl[m] || closed[m]) continue;
        if (di && dj && (bl[j * N + a] || bl[b * N + i])) continue;
        const ng = g[n] + (di && dj ? 1.414 : 1);
        if (ng < g[m]) { g[m] = ng; from[m] = n; push(m, ng + hf(m)); }
      }
    }
    if (!found) return null;
    const out = [];
    for (let n = T; n !== S && n >= 0; n = from[n]) out.push({ x: -20 + (n % N + 0.5) * 0.5, z: -20 + (((n / N) | 0) + 0.5) * 0.5 });
    out.reverse();
    // The exact goal when it's somewhere you can stand (not on top of a container).
    if (out.length && this.free(x1, z1)) out[out.length - 1] = { x: x1, z: z1 };
    return out;
  },
  // Is the straight walk from a to b clear of walls (checked every 30 cm)?
  clearWalk(x0, z0, x1, z1) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 0.3);
    for (let k = 1; k <= n; k++) { const t = k / n; if (!this.free(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false; }
    return true;
  },

  // ---------- the view model: your hands and gun, drawn over the world ----------
  buildViewModel() {
    const vs = this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    vs.add(new THREE.HemisphereLight(0xffd8b8, 0x3a3040, 0.7));
    const key = new THREE.DirectionalLight(0xffb070, 0.9); key.position.set(-1, 0.6, 0.4); vs.add(key);
    const fill = new THREE.DirectionalLight(0x8090ff, 0.25); fill.position.set(1, 0.2, 1); vs.add(fill);
    this.vm = new THREE.Group(); vs.add(this.vm);
    // A muzzle flash and a light for the hands.
    this.vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex[0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    this.vmFlash.visible = false; vs.add(this.vmFlash);
    this.vmLight = new THREE.PointLight(0xffb060, 0, 2, 2); vs.add(this.vmLight);
    this.shells = [];
    this.shellGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 6); this.shellGeo.rotateZ(Math.PI / 2);
    this.shellMat = new THREE.MeshStandardMaterial({ color: 0xd8a83a, metalness: 0.8, roughness: 0.3 });
    this.vmGuns = {};
    this.vmNadeT = 0;
  },
  // Builds a gun for the view model or a soldier's hands: the model, or a stand-in made of boxes.
  // key: a gun id (m16 / m4 / tavor / negev / sniper / pistol); att: what is fitted (see att()),
  // or true for just the holographic sight.
  makeGun(key, forVm, att = null) {
    const W = SH_W[key], src = Assets.models[W.model], rifle = W.slot === 'rifle';
    const a = this.att(att === true ? { o: 1 } : att);
    if (W.scope) a.o = 0;
    const g = new THREE.Group();
    if (src) {
      const m = src.clone(true);
      m.scale.setScalar(W.len);
      // Your own copy loses the model's sights (closed, you can't look through them): yours are
      // built below.
      if (forVm && W.cut) m.traverse(o => { if (o.isMesh && o.geometry.index) o.geometry = this.cutBoxes(o.geometry, W.len, W.cut); });
      m.traverse(o => { if (o.isMesh) { o.castShadow = !forVm; o.frustumCulled = false; if (!o.material.userData.shLit) { o.material.color.setScalar(1.7); o.material.userData.shLit = true; } } });
      g.add(m);
    } else {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.6, metalness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, W.len), mat); body.position.y = rifle ? 0.08 : 0.02; g.add(body);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.04), mat); grip.position.set(0, rifle ? W.grip[0] : -0.05, rifle ? W.grip[1] : -W.len * 0.3); grip.rotation.x = -0.25; g.add(grip);
    }
    if (forVm) {
      // Hands and sleeves: the right on the grip, the left forward on the handguard.
      const skinC = (G.profile && G.profile.skin) || '#d9a77c';
      const skin = new THREE.MeshStandardMaterial({ color: skinC, roughness: 0.7 }), sleeve = new THREE.MeshStandardMaterial({ color: 0x3e4a28, roughness: 0.95 });
      const hand = (x, y, z, rx, ry, big = 1) => {
        const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.set(rx, ry, 0);
        // A fist round the grip: a squashed ball, knuckles, a thumb.
        const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin); palm.scale.set(0.028 * big, 0.045 * big, 0.05 * big); h.add(palm);
        for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), skin); f.position.set(0.024 * big, 0.026 - k * 0.017, 0.025); h.add(f); }
        const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.045, 8), skin); thumb.rotation.x = Math.PI / 2; thumb.position.set(-0.024 * big, 0.03, 0.035); h.add(thumb); h.userData.thumb = thumb;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.046, 0.7, 12), sleeve); arm.rotation.x = Math.PI / 2; arm.position.set(0, -0.02, -0.39); h.add(arm);
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.04, 10), new THREE.MeshStandardMaterial({ color: 0x46552c })); cuff.rotation.x = Math.PI / 2; cuff.position.set(0, -0.02, -0.06); h.add(cuff);
        g.add(h); return h;
      };
      if (rifle) { const cx = W.sight.cx; g.userData.rh = hand(cx + 0.012, W.grip[0], W.grip[1], 0.35, 0.12); g.userData.lh = hand(cx - 0.035, W.fore[0], W.fore[1], -0.33, -0.51); g.userData.lhY = W.fore[0]; }
      else { g.userData.rh = hand(0.024, -0.06, -0.065, 0.3, 0.15, 1.15); g.userData.lh = hand(-0.03, -0.075, -0.05, 0.3, -0.45, 1.1); g.userData.lhY = -0.075; }
      if (rifle) { if (W.scope) g.userData.eye = W.eye; else this.ironSights(g, W); if (a.o === 1) this.mountHolo(g, W, true); else if (a.o === 2) this.mountAcog(g, W, true); }
      else this.pistolSights(g);
    } else if (rifle) { if (a.o === 1) this.mountHolo(g, W, false); else if (a.o === 2) this.mountAcog(g, W, false); }
    const mz = new THREE.Object3D(); mz.position.set(...W.muzzle); g.add(mz); g.userData.muzzle = mz;
    if (rifle) this.mountKit(g, key, W, a, forVm);
    g.userData.att = a;
    return g;
  },
  // An attachment model, brightened like the guns (null while it isn't loaded).
  attModel(name, scale, forVm) {
    const src = Assets.models[name];
    if (!src) return null;
    const m = src.clone(true); m.scale.setScalar(scale);
    m.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = !forVm;
      if (!o.material.userData.shLit) { o.material = o.material.clone(); o.material.color.setScalar(1.8); o.material.metalness = 0; o.material.roughness = 0.7; o.material.userData.shLit = true; }
    });
    return m;
  },
  // How low the gun's underside is at z (its own units × its length), for what hangs under it:
  // the lowest point of the model within a couple of centimetres of z, near the middle.
  underY(key, z) {
    const W = SH_W[key], src = Assets.models[W.model];
    this.underCache = this.underCache || {};
    const ck = key + ':' + z.toFixed(3);
    if (this.underCache[ck] != null) return this.underCache[ck];
    let lo = Infinity;
    if (src) {
      src.updateMatrixWorld(true);
      const v = new THREE.Vector3(), cx = W.sight ? W.sight.cx : 0;
      src.traverse(o => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).multiplyScalar(W.len);
          if (Math.abs(v.z - z) < 0.02 && Math.abs(v.x - cx) < 0.03 && v.y < lo) lo = v.y;
        }
      });
    }
    if (!isFinite(lo)) lo = (W.fore ? W.fore[0] : -0.03) + 0.01;
    return (this.underCache[ck] = lo);
  },
  // The suppressor on the muzzle, the foregrip under the handguard (where the left hand goes),
  // the bipod further forward (folded along the barrel; it swings down when it's in use).
  mountKit(g, key, W, a, forVm) {
    const cx = W.sight ? W.sight.cx : 0;
    if (a.s) {
      const L = 0.17, m = this.attModel('att_supp', L, forVm);
      if (m) { m.rotation.y = Math.PI / 2; m.position.set(W.muzzle[0], W.muzzle[1], W.muzzle[2] + L / 2 - 0.012); g.add(m); g.userData.supp = m; }
      g.userData.muzzle && g.userData.muzzle.position.set(W.muzzle[0], W.muzzle[1], W.muzzle[2] + L - 0.01);
    }
    if (a.g) {
      const z = W.fore[1], y = this.underY(key, z), m = this.attModel('att_grip', 0.1, forVm);
      if (m) { m.position.set(cx, y - 0.048, z); g.add(m); g.userData.vgrip = m; }
      g.userData.foreAt = [y - 0.07, z];
      const lh = g.userData.lh;
      // (The hand round its lower half, a little to the left, so the top of the grip shows.)
      if (lh) { lh.position.set(cx - 0.02, y - 0.082, z - 0.01); lh.rotation.set(0.2, -0.25, 0); g.userData.lhY = lh.position.y; }
    }
    if (a.b) {
      const z = Math.min(W.muzzle[2] - 0.08, W.fore[1] + 0.16), y = this.underY(key, z), m = this.attModel('att_bipod', 0.2, forVm);
      if (m) {
        const pivot = new THREE.Group(); pivot.position.set(cx, y + 0.004, z); m.position.y = -0.1; pivot.add(m);
        pivot.rotation.x = SH_LEGS_UP; g.add(pivot); g.userData.bipod = pivot;
      }
    }
  },
  // The ACOG on the rail: 4x, a tan housing; for your own gun its eye point is behind the
  // eyepiece (through it, the scope overlay takes over, see hud).
  mountAcog(g, W, forVm) {
    const s = 0.15, S = W.sight, m = this.attModel('att_acog', s, forVm);
    const z = W.holo + 0.01, base = S.rail + 0.245 * s;
    if (m) { m.rotation.y = Math.PI; m.position.set(S.cx, base, z); g.add(m); g.userData.acog = m; }
    if (forVm) {
      g.userData.eye = { x: S.cx, y: base + 0.07 * s, z: z - 0.5 * s, d: 0.07 };
      const ir = g.userData.irons; if (ir) { ir.rear.visible = false; ir.front.visible = false; }
    }
  },
  // Drops the triangles inside boxes [y0, z0, z1] (above y0, between z0 and z1) from a copy of a
  // mesh (s: the model's scale).
  cutBoxes(geo, s, boxes) {
    const out = geo.clone(), p = out.attributes.position, idx = out.index.array, keep = [];
    const inside = (i) => { const y = p.getY(i) * s, z = p.getZ(i) * s; return boxes.some(([y0, z0, z1]) => y > y0 && z > z0 && z < z1); };
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    out.setIndex(keep);
    return out;
  },
  sightMat() {
    return this.sightM || (this.sightM = new THREE.MeshStandardMaterial({ color: 0x101110, roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide }));
  },
  // A rifle's iron sights: a rear aperture (a ring on a little tower) and a front post between
  // two ears, both on the line of sight. g.userData.eye: the point that ends up in the middle of
  // the screen when you aim, and how far in front of the eye it sits.
  ironSights(g, W) {
    const S = W.sight, dark = this.sightMat(), cx = S.cx, L = S.line;
    const add = (geo, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, dark); m.position.set(x, y, z); m.frustumCulled = false; parent.add(m); return m; };
    const rear = new THREE.Group(); g.add(rear);
    add(new THREE.BoxGeometry(0.007, L - 0.007 - S.rail, 0.01), cx, (L - 0.007 + S.rail) / 2, S.rear, rear);
    add(new THREE.BoxGeometry(0.018, 0.005, 0.014), cx, S.rail + 0.0025, S.rear, rear);
    const ring = add(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 24, 1, true), cx, L, S.rear, rear); ring.rotation.x = Math.PI / 2;
    for (const z of [S.rear - 0.002, S.rear + 0.002]) add(new THREE.RingGeometry(0.0034, 0.0075, 24), cx, L, z, rear);
    const front = new THREE.Group(); g.add(front);
    add(new THREE.BoxGeometry(0.0045, L - S.post, 0.005), cx, (L + S.post) / 2, S.front, front);
    for (const sx of [-1, 1]) { const ear = add(new THREE.BoxGeometry(0.004, L - S.post + 0.008, 0.012), cx + sx * 0.011, (L + S.post) / 2 + 0.004, S.front, front); ear.rotation.z = -sx * 0.12; }
    add(new THREE.BoxGeometry(0.03, 0.012, 0.02), cx, S.post + 0.004, S.front, front);
    g.userData.irons = { rear, front };
    g.userData.ironEye = { x: cx, y: L, z: S.rear, d: 0.13 };
    g.userData.eye = g.userData.ironEye;
  },
  // The holographic sight on the rail. For your own gun the window is cut through (the model's
  // is closed), with a faint glass and the reticle (a red ring and a dot) in it; the irons fold
  // away under it.
  mountHolo(g, W, forVm) {
    const src = Assets.models.sight_holo, s = SH_HOLO.s, S = W.sight;
    const h = new THREE.Group();
    // The model: 1 long, its base at y −0.38, the window's middle at (0.01, 0.2, 0.15); turned
    // round so the battery is at the front.
    h.position.set(S.cx, S.rail + 0.38 * s, W.holo); h.rotation.y = Math.PI;
    if (src) {
      const m = src.clone(true); m.scale.setScalar(s);
      m.traverse(o => {
        if (!o.isMesh) return;
        o.frustumCulled = false; o.castShadow = !forVm;
        if (!o.material.userData.shLit) { o.material = o.material.clone(); o.material.color.setScalar(2.1); o.material.userData.shLit = true; }
        if (forVm && o.geometry.index) o.geometry = this.cutWindow(o.geometry);
      });
      h.add(m);
    } else {
      const dark = this.sightMat();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.03, 0.09), dark); box.position.set(0, -0.022, 0); h.add(box);
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.05), dark); w.position.set(sx * 0.022, 0.012, 0.012); h.add(w); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.05), dark); top.position.set(0, 0.032, 0.012); h.add(top);
    }
    g.add(h); g.userData.holo = h;
    const wx = S.cx - 0.01 * s, wy = S.rail + 0.58 * s, wz = W.holo - 0.15 * s;
    if (forVm) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.3 * s, 0.2 * s), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      glass.position.set(wx, wy, wz + 0.004); glass.renderOrder = 2; g.add(glass);
      if (!this.holoTex) this.holoTex = this.canvasTex(128, 128, (c) => {
        c.shadowColor = 'rgba(255,40,30,.9)'; c.shadowBlur = 6; c.strokeStyle = 'rgba(255,60,45,.95)'; c.lineWidth = 5;
        c.beginPath(); c.arc(64, 64, 46, 0, Math.PI * 2); c.stroke();
        c.fillStyle = 'rgba(255,90,70,1)'; c.beginPath(); c.arc(64, 64, 5.5, 0, Math.PI * 2); c.fill();
        // The four ticks of the ring.
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a); c.beginPath(); c.moveTo(64 + ca * 46, 64 + sa * 46); c.lineTo(64 + ca * 56, 64 + sa * 56); c.stroke(); }
      });
      const ret = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.holoTex, transparent: true, depthWrite: false }));
      ret.position.set(wx, wy, wz); ret.renderOrder = 3; g.add(ret);
      g.userData.dot = ret;
      g.userData.eye = { x: wx, y: wy, z: wz, d: 0.17 };
      const ir = g.userData.irons; if (ir) { ir.rear.visible = false; ir.front.visible = false; }
    }
  },
  // The holographic sight's window, cut through: the triangles in the tunnel (model units).
  cutWindow(geo) {
    const out = geo.clone(), p = out.attributes.position, idx = out.index.array, keep = [];
    const inside = (i) => { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); return x > -0.145 && x < 0.165 && y > 0.095 && y < 0.31 && z > -0.04 && z < 0.37; };
    for (let t = 0; t < idx.length; t += 3) if (!(inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2]))) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    out.setIndex(keep);
    return out;
  },
  // The Glock's iron sights, a bit bigger than the real ones so you can see them: a rear notch
  // (two blades with a white dot each) and a front post with a white dot.
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
  // (Re)builds your guns once the models are in (each rifle and fitting is made when first
  // needed), and everyone's in their hands.
  dressGuns() {
    for (const k in this.vmGuns) this.vm.remove(this.vmGuns[k]);
    this.vmGuns = {}; this.underCache = {};
    for (const p of this.ps || []) this.armSoldier(p);
  },
  // Your gun in the view model now (built the first time).
  vmGun(me) {
    const id = me.w === 'pistol' ? 'pistol' : (me.gun || 'm16') + ':' + this.attKey(me.att);
    if (!this.vmGuns[id]) { const g = this.makeGun(me.w === 'pistol' ? 'pistol' : me.gun || 'm16', true, me.w === 'pistol' ? null : me.att); g.visible = false; this.vm.add(g); this.vmGuns[id] = g; }
    return this.vmGuns[id];
  },

  // The fitted attachments as little icons (the HUD's weapon name, the loadout chip).
  attIcons(a) {
    a = this.att(a);
    return (a.o === 1 ? ' 🔴' : a.o === 2 ? ' ' + SH_ATT.acog.icon : '') + (a.s ? ' ' + SH_ATT.supp.icon : '') + (a.g ? ' ' + SH_ATT.grip.icon : '') + (a.b ? ' ' + SH_ATT.bipod.icon : '');
  },
  // ---------- a match ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    this.slots = null; this.md = null;
    this.dress();
    this.dressGuns();
    const need = ['gun_rifle', 'gun_m16', 'gun_m4', 'gun_negev', 'gun_sniper', 'gun_pistol', 'sight_holo', 'att_supp', 'att_grip', 'att_bipod', 'att_acog', 'prop_nade', 'prop_vest', 'prop_helmet', 'arc_shelter', 'arc_sandbags', 'arc_dumpster'];
    if (need.some(n => !Assets.has(n))) Arcade.loadModels(need).then(() => { if (this.ctx !== ctx) return; this.dress(); this.dressGuns(); });
    this.host = ctx.solo || !!(ctx.net && ctx.net.host);
    this.rnd = Arcade.rng(ctx.seed);
    this.sc = [0, 0]; this.rd = 0; this.st = 'pick'; this.t = 0; this.over = false; this.resultsAt = null;
    this.seq = 1; this.myShots = []; this.botShots = []; this.hits = []; this.kf = []; this.feed = [];
    this.seen = new Set(); this.lastHost = performance.now();
    this.look = { yaw: Math.PI / 2, pitch: 0 }; this.trigger = false; this.prevKeys = new Set();
    this.adsHold = false; this.adsTog = false; this.fovNow = SH_FOV;
    this.dmgFx = 0; this.dirs = []; this.hm = 0; this.camRoll = 0; this.spec = null;
    this.nades = []; this.nums = []; this.rq = []; this.myThrows = []; this.nadeSeq = 1; this.booms = [];
    this.audio();
    this.ui();
    this.bind();
    Arcade.buttons({ act: false, run: false });
    Sound.music('tension');
    this.lockOff();
    this.intro();
    // Online, the host's choice comes by itself if they don't choose in time.
    if (!ctx.solo && this.host) this.pickT = performance.now() + 20000;
    Arcade.say(fmt(pick(SH_SAY.intro)), null, 4200);
  },
  // The intro panel: the rules, the controls, the gun shop and (for the host) 1v1 / 2v2.
  intro() {
    if (this.slots || !this.ctx) return;
    const online = !this.ctx.solo;
    const choose = (n) => `<button class="btn" data-md="${n}">${n === 1 ? '⚔️ אחד על אחד' : '👥 שניים על שניים'}</button>`;
    const ctl = G.touch
      ? 'ג׳ויסטיק — לזוז (עד הסוף — ריצה) · לגרור בצד ימין — להסתכל · 🔥 — לירות · 🎯 — כוונת · 💣 — רימון · 🔄 — מחסנית · ⤒ — קפיצה · הנשק למטה — להחליף'
      : 'WASD — לזוז · עכבר — לכוון (לחיצה נועלת את הסמן, Esc משחרר) · קליק — אש · קליק ימני (או Z) — כוונת · G — רימון · R — מחסנית · Shift — ריצה · רווח — קפיצה · 1/2 — רובה/אקדח · בתחילת סיבוב: 3/4/5 — קניות';
    const p = Arcade.panel(`<img class="ar-banner sh-banner" src="${this.cover}" alt=""><h2>🔫 נתיבות הקטנה</h2>
      <p class="ar-sub sh-rules">ראשון לשלושה סיבובים. סיבוב נגמר כשקבוצה שלמה נפסלת (או אחרי ${this.ROUND} שניות — מי שנשארו לו יותר אנשים). פגיעה בראש — כפול. מסתתרים — והחיים חוזרים לאט. בתחילת כל סיבוב יש ${Math.round(SH_BUY_T)} שניות לקנות שכפ״ץ, קסדה ורימונים בכסף של הסיבוב 💵.</p>
      <div class="ar-row sh-modes">${online && !this.host ? '<p class="ar-sub">⏳ המארח בוחר: אחד על אחד או שניים על שניים... בינתיים — לבחור נשק</p>' : choose(1) + choose(2)}</div>
      ${this.shopHtml()}
      <p class="ar-sub sh-ctl">${ctl}</p>`);
    if (!p) return;
    p.querySelectorAll('[data-md]').forEach(b => b.onclick = () => { Sound.click(); this.pick(+b.dataset.md); });
    p.querySelectorAll('.sh-gchip').forEach(b => b.onclick = () => this.shopPick(b.dataset.id));
  },
  // ---------- your guns (the game's shekels, owned for good; sold at the HQ's armory) ----------
  // G.state.shOwned: the rifles and attachments bought (the M16 is everyone's); shGun: the rifle
  // in hand; shFit: per rifle, what is fitted { o: 'holo' | 'acog' | null, s, g, b }. Saves from
  // before the armory have only shSight ('holo' on every rifle), which still counts until the
  // rifle is fitted at the armory.
  owned() {
    const st = G.state || {};
    return new Set(['m16', ...(Array.isArray(st.shOwned) ? st.shOwned : [])]);
  },
  myGun() { const g = (G.state || {}).shGun; return SH_GUNS.includes(g) && this.owned().has(g) ? g : 'm16'; },
  fitOf(gun) {
    const st = G.state || {}, own = this.owned(), f = st.shFit && st.shFit[gun];
    const o = f ? f.o : (st.shSight === 'holo' ? 'holo' : null);
    return { o: (o === 'holo' || o === 'acog') && own.has(o) && !(SH_W[gun] || {}).scope ? o : null, s: !!(f && f.s && own.has('supp')), g: !!(f && f.g && own.has('grip')), b: !!(f && f.b && own.has('bipod')) };
  },
  setFit(gun, fit) {
    const st = G.state; if (!st) return;
    st.shFit = { ...(st.shFit || {}) };
    st.shFit[gun] = { o: fit.o || null, s: !!fit.s, g: !!fit.g, b: !!fit.b };
    // (Kept in step for the rifle in hand, for anything that still reads the old field.)
    if (gun === this.myGun()) st.shSight = fit.o === 'holo' ? 'holo' : null;
  },
  myAtt(gun = this.myGun()) { const f = this.fitOf(gun); return this.att({ o: SH_OPTICS.indexOf(f.o) > 0 ? SH_OPTICS.indexOf(f.o) : 0, s: f.s, g: f.g, b: f.b }); },
  mySight() { return this.myAtt().o === 1; },
  // Something from the armory's shelves: a rifle, the holo, or an attachment.
  item(id) { return SH_W[id] && SH_GUNS.includes(id) ? SH_W[id] : id === 'holo' ? SH_HOLO : SH_ATT[id] || null; },
  // Buys it with the game's shekels (false: already yours, or not enough). A rifle goes in your
  // hands; an attachment onto gun (the rifle in hand unless said).
  buyItem(id, gun = this.myGun()) {
    const it = this.item(id), st = G.state;
    if (!it || !st || this.owned().has(id) || (st.money || 0) < it.price) return false;
    st.money -= it.price;
    st.shOwned = [...new Set([...(Array.isArray(st.shOwned) ? st.shOwned : []), id])];
    st.stats = st.stats || {}; st.stats.purchases = (st.stats.purchases || 0) + 1;
    if (SH_GUNS.includes(id)) st.shGun = id;
    else {
      const f = this.fitOf(gun);
      if (id === 'holo' || id === 'acog') { if (!SH_W[gun].scope) f.o = id; } else f[{ supp: 's', grip: 'g', bipod: 'b' }[id]] = true;
      this.setFit(gun, f);
    }
    if (typeof Game !== 'undefined') Game.save();
    return true;
  },
  // The intro panel's corner: the rifle in hand with what's on it, your other rifles to switch
  // to, and where the shop is now.
  shopHtml() {
    const own = this.owned(), gun = this.myGun(), W = SH_W[gun], money = (G.state || {}).money || 0;
    const chips = SH_GUNS.filter(id => own.has(id)).map(id => `<button class="sh-gchip ${id === gun ? 'on' : ''}" data-id="${id}"><img src="${SH_W[id].img}" alt=""><b>${SH_W[id].name}</b><i>${this.attIcons(this.myAtt(id)) || '—'}</i></button>`).join('');
    const a = this.myAtt(gun);
    const fitted = [a.o === 1 ? SH_HOLO : a.o === 2 ? SH_ATT.acog : null, a.s && SH_ATT.supp, a.g && SH_ATT.grip, a.b && SH_ATT.bipod].filter(Boolean);
    return `<div class="sh-shop sh-load"><p class="sh-wallet">🎒 הנשק שלך · 💰 ${money} ₪</p>
      <div class="sh-lmain"><img src="${W.img}" alt=""><div><b>${W.name}</b><span>${W.dmg} נזק · ${W.burst ? 'צרור 3' : W.bolt ? 'בריח' : 'אוטומטי'}${W.mag > 30 ? ` · ${W.mag} כדורים` : ''}</span>
      <span class="sh-fitted">${fitted.length ? fitted.map(f => `<em>${f.icon || '🔴'} ${f.name}</em>`).join('') : '<em class="none">בלי תוספות</em>'}</span></div></div>
      ${chips.length > 1 ? `<div class="sh-gchips">${chips}</div>` : ''}
      <p class="sh-armhint">🔧 שיפוצים בנשקייה בשו"ב — רובים, משתיק, ידית, דו־רגלית וכוונות</p></div>`;
  },
  // A rifle chip tapped: that one in hand.
  shopPick(id) {
    if (this.slots || !G.state || !this.owned().has(id) || !SH_GUNS.includes(id)) return;
    Sound.click();
    G.state.shGun = id; G.state.shSight = this.fitOf(id).o === 'holo' ? 'holo' : null;
    Game.save(); this.intro();
  },
  clear() {
    for (const p of this.ps || []) { this.scene.remove(p.m.root); if (p.m.flash) this.scene.remove(p.m.flash); if (p.m.vest) this.scene.remove(p.m.vest); if (p.m.helm) this.scene.remove(p.m.helm); }
    for (const f of this.fx || []) this.scene.remove(f.m);
    for (const d of this.decals || []) this.scene.remove(d);
    for (const t of this.tracers || []) this.scene.remove(t.m);
    for (const s of this.shells || []) this.vmScene.remove(s.m);
    for (const n of this.nades || []) this.scene.remove(n.m);
    for (const n of this.nums || []) this.scene.remove(n.m);
    this.ps = []; this.fx = []; this.decals = []; this.tracers = []; this.shells = []; this.nades = []; this.nums = [];
    this.me = null;
  },
  // Who plays: humans first in their order, then bots. Slot i is on team i % 2.
  pick(md) {
    if (this.slots) return;
    this.md = md;
    const ctx = this.ctx, n = md === 1 ? 2 : 4;
    let humans = ctx.solo ? [{ who: 'me', name: G.profile.name, isMe: true }] : ctx.players.slice(0, n).map(p => ({ who: p.isMe ? (Multi.as || 'me') : p.who, name: p.name, isMe: p.isMe, peer: p.peer }));
    // Alone in 2v2 you get a bot teammate: you're slot 0 (blue), the bots fill 1, 2, 3.
    const bots = Arcade.bots(n - humans.length, this.rnd);
    const slots = [...humans.map(h => ({ ...h, kind: 'h' })), ...bots.map(b => ({ who: b.id, name: fmt(`{@${b.id}}`), kind: 'b', bot: true }))];
    this.makeSlots(slots);
    this.startRound(1);
  },
  // Online guests: the host's list of who is in which slot.
  adoptSlots(list) {
    const me = Multi.as || 'me';
    const others = Arcade.others();
    const slots = list.map(s => {
      const [k, who] = [s[0], s.slice(2)];
      if (k === 'b') return { who, name: fmt(`{@${who}}`), kind: 'b', bot: true, remoteBot: true };
      if (who === me) return { who, name: G.profile.name, isMe: true, kind: 'h' };
      const o = others.find(q => q.who === who);
      return { who, name: o ? o.name : who, peer: o ? o.peer : null, kind: 'h' };
    });
    this.md = slots.length === 2 ? 1 : 2;
    this.makeSlots(slots);
  },
  makeSlots(slots) {
    this.slots = slots;
    this.ps = slots.map((s, i) => {
      const team = i % 2;
      const look = Arcade.look(s.isMe ? null : (Cast.get(s.who) ? s.who : null));
      look.head = 'helmet';
      const m = Arcade.soldier(this.scene, look);
      const tag = Scene3D.label(`${SH_TEAM[team].icon} ${s.name}`, { bg: team ? 'rgba(216,38,31,.88)' : 'rgba(47,127,224,.88)', size: 0.42 });
      tag.position.y = 2.15; m.root.add(tag); m.tag = tag;
      m.root.traverse(o => { if (o.isMesh && o.material !== Scene3D.blobMat) o.castShadow = true; });
      const p = { ...s, i, team, m, x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, a: 0, pitch: 0, hp: 100, alive: true, k: 0, d: 0, w: 'rifle', ammo: {}, hurtAt: -99, skill: s.bot ? 0.62 + this.rnd() * 0.22 : 1, female: s.isMe ? (G.profile || {}).gender === 'f' : !!(Cast.get(s.who) || {}).female,
        gun: s.isMe ? this.myGun() : 'm16', att: s.isMe ? this.myAtt() : this.att(null), cash: SH_CASH.start, armor: 0, helmet: false, nadeN: 0 };
      this.armSoldier(p);
      return p;
    });
    // Your teammate bot is a bit better than the others; in 1v1 the bot is fair.
    for (const p of this.ps) if (p.bot && this.ps.some(q => q.isMe && q.team === p.team)) p.skill = Math.min(0.9, p.skill + 0.08);
    // The bots' rifles (the host picks): mostly up to the best of the three assault rifles a human
    // here has, now and then one better, once in a while a Negev; a sight and a grip sometimes.
    if (this.host) {
      const top = Math.max(1, ...this.ps.filter(p => !p.bot).map(p => Math.min(2, SH_GUNS.indexOf(p.gun))));
      for (const p of this.ps) if (p.bot) {
        p.gun = this.rnd() < 0.1 ? 'negev' : SH_GUNS[Math.min(2, Math.floor(this.rnd() * (top + 1)) + (this.rnd() < 0.15 ? 1 : 0))];
        const r = this.rnd();
        p.att = this.att({ o: r < 0.25 ? 1 : r < 0.35 ? 2 : 0, g: this.rnd() < 0.3, s: this.rnd() < 0.12 });
        this.armSoldier(p);
      }
    }
    this.me = this.ps.find(p => p.isMe) || null;
  },
  // A gun in a soldier's hands (built again when the models arrive).
  armSoldier(p) {
    const m = p.m;
    if (m.guns) m.root.remove(m.gunMount);
    if (m.flash) this.scene.remove(m.flash);
    m.gunMount = new THREE.Group(); m.root.add(m.gunMount);
    // The vest and the helmet from the buy phase (shown while they have them; placed on the
    // head and between the hips and the head each frame, see animate).
    for (const k of ['vest', 'helm']) { if (m[k]) { this.scene.remove(m[k]); m[k] = null; } }
    // (The vest model faces +z, the helmet −x; the body faces +x.)
    const wear = (name, turn) => {
      const src = Assets.models[name]; if (!src) return null;
      const w = new THREE.Group(), c = src.clone(true); c.rotation.y = turn; w.add(c); w.visible = false;
      c.traverse(q => { if (q.isMesh) { q.castShadow = true; q.frustumCulled = false; if (!q.material.userData.shLit) { q.material.color.setScalar(1.35); q.material.userData.shLit = true; } } });
      this.scene.add(w); return w;
    };
    m.vest = wear('prop_vest', Math.PI / 2); m.helm = wear('prop_helmet', Math.PI);
    if (!m.headBone) m.root.traverse(o => { if (o.isBone && !m.headBone && o.name === 'Head') m.headBone = o; if (o.isBone && !m.hipBone && o.name === 'Hips') m.hipBone = o; });
    m.guns = {}; m.gunId = (p.gun || 'm16') + ':' + this.attKey(p.att);
    for (const k of SH_WK) { const g = this.makeGun(k === 'rifle' ? p.gun || 'm16' : 'pistol', false, k === 'rifle' ? p.att : null); g.rotation.y = Math.PI / 2; m.gunMount.add(g); m.guns[k] = g; }
    // The flash at the muzzle when they fire.
    m.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex[0], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.flash.visible = false; m.flash.scale.setScalar(0.5); this.scene.add(m.flash);
    if (!m.bones) {
      const B = {};
      m.root.traverse(o => { if (o.isBone && /^(LeftArm|LeftForeArm|LeftHand|RightArm|RightForeArm|RightHand|Spine2|Spine1|Spine)$/.test(o.name) && !B[o.name]) B[o.name] = o; });
      m.bones = B;
    }
  },
  spawnPos(p) {
    const team = SH_MAP.spawns[p.team], k = Math.floor(p.i / 2);
    return team[k % team.length];
  },
  // A new round: everyone back to their side, full health and ammo, rifle up; 3-2-1.
  // The 3-2-1 is the buy phase: frozen at the spawn, armour and grenades with the round's money.
  startRound(rd, cdMs = SH_BUY_T * 1000) {
    this.rd = rd; this.st = 'cd'; this.t = 0; this.roundWin = null;
    for (const n of this.nades || []) this.scene.remove(n.m);
    this.nades = [];
    for (const p of this.ps) {
      const s = this.spawnPos(p);
      // Out last round: the armour and the grenades are gone (survivors keep theirs).
      if (!p.alive) { p.armor = 0; p.helmet = false; p.nadeN = 0; }
      Object.assign(p, { x: s.x, z: s.z, y: 0, vx: 0, vz: 0, vy: 0, a: p.team ? -Math.PI / 2 : Math.PI / 2, pitch: 0, hp: 100, alive: true, hurtAt: -99, w: 'rifle', ammo: { rifle: [this.wp(p, 'rifle').mag, this.wp(p, 'rifle').reserve], pistol: [SH_W.pistol.mag, SH_W.pistol.reserve] }, reloadT: 0, drawT: 0, cool: 0, bloom: 0, deadT: 0, fired: 0, hitN: 0, magHits: 0, magShots: 0, burstN: 0 });
      p.m.root.visible = true;
      const L = p.m.lean || p.m.root; L.rotation.z = 0; L.rotation.x = 0;
      p.m.root.position.y = 0;
      if (p.bot) this.botReset(p);
      p.rx = p.x; p.rz = p.z;
    }
    if (this.me) { this.look.yaw = this.me.a; this.look.pitch = 0; this.me.drawT = this.wp(this.me, 'rifle').draw; }
    this.spec = null; this.camRoll = 0; this.dmgFx = 0; this.dirs = []; this.trigger = false; this.adsTog = false;
    for (const p of this.ps) { p.ads = false; p.adsK = 0; }
    Arcade.panel('');
    Arcade.big(`סיבוב ${rd}`, 1100);
    Sound.horn();
    const at = performance.now() + cdMs;
    Arcade.countdown(at, () => { if (this.st === 'cd') { this.st = 'live'; this.t = 0; } }, 'קדימה!');
    // A bot on your side says something.
    const b = this.ps.find(q => q.bot && this.me && q.team === this.me.team) || this.ps.find(q => q.bot);
    if (b && this.host) setTimeout(() => this.shout(b, pick(SH_LINES.start)), 900);
    // The bots shop too, a moment in.
    if (this.host) for (const q of this.ps) if (q.bot) q.buyAt = Math.min(cdMs / 1000 - 0.5, 0.8 + this.rnd() * 3);
  },
  // ---------- the buy phase ----------
  canBuy(p, id) {
    const it = SH_BUY.find(b => b.id === id);
    if (!it || !p || !p.alive || this.st !== 'cd' || (p.cash || 0) < it.price) return false;
    if (id === 'vest') return (p.armor || 0) < 50;
    if (id === 'helmet') return !p.helmet;
    return (p.nadeN || 0) < SH_NADE.max;
  },
  // The host buys for someone (or a guest asks the host).
  buy(p, id, quiet) {
    if (!this.host) {
      if (!p.isMe || !this.canBuy(p, id)) { if (p.isMe && !quiet) Sound.bad(); return false; }
      this.rq.push({ id: this.seq++, it: id, at: performance.now() });
      Sound.coin();
      return true;
    }
    if (!this.canBuy(p, id)) { if (p.isMe && !quiet) Sound.bad(); return false; }
    const it = SH_BUY.find(b => b.id === id);
    p.cash -= it.price;
    if (id === 'vest') p.armor = 50; else if (id === 'helmet') p.helmet = true; else p.nadeN = (p.nadeN || 0) + 1;
    if (p.isMe) Sound.coin();
    return true;
  },
  // Bots: armour first, then a grenade, a helmet if there's money left.
  botBuy(b) {
    if (!b.armor || b.armor < 50) this.buy(b, 'vest', true);
    if (this.rnd() < 0.8) this.buy(b, 'nade', true);
    if (this.rnd() < 0.6) this.buy(b, 'helmet', true);
    if (b.cash > 1500) this.buy(b, 'nade', true);
  },

  // ---------- each frame ----------
  update(dt) {
    dt = Math.min(dt, 0.05);
    this.dt = dt;
    const now = performance.now();
    if (!this.host) this.follow(dt);
    else if (!this.slots && this.pickT && now > this.pickT) { this.pickT = null; this.pick(Arcade.players().length > 2 ? 2 : 1); }
    if (!this.slots) { this.idleCam(dt); return; }
    if (this.st === 'live') this.t += dt;
    const live = this.st === 'live';
    this.readKeys();
    for (const p of this.ps) {
      if (p.isMe) this.updateMe(p, dt, live);
      else if (p.bot && this.host) this.bot(p, dt, live);
      else this.remote(p, dt);
      p.cool = Math.max(0, (p.cool || 0) - dt);
      p.bloom = Math.max(0, (p.bloom || 0) - dt * 0.12 * (p.w === 'rifle' ? this.wp(p).settle || 1 : 1));
      if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) this.finishReload(p); }
      if (p.drawT > 0) p.drawT -= dt;
      // Health comes back slowly after four seconds out of fire (the host decides).
      if (this.host && p.alive && live && p.hp < 100 && this.t - p.hurtAt > 4) p.hp = Math.min(100, p.hp + 9 * dt);
    }
    if (this.host && this.st === 'cd') {
      // (By the clock of the 3-2-1, so a slow phone doesn't leave them empty-handed.)
      const el = Arcade.cdAt ? SH_BUY_T - (Arcade.cdAt - now) / 1000 : 99;
      for (const q of this.ps) if (q.bot && q.alive && q.buyAt != null && el > q.buyAt) { q.buyAt = null; this.botBuy(q); }
    }
    this.netShots();
    this.updateNades(dt);
    if (this.host) this.referee(dt);
    this.animate(dt);
    this.camUpdate(dt);
    this.hud();
    if (this.over && this.resultsAt && now > this.resultsAt) { this.resultsAt = null; this.results(); }
  },
  readKeys() {
    const k = G.keys, prev = this.prevKeys, pressed = (c) => k.has(c) && !prev.has(c);
    const me = this.me;
    if (me && me.alive && this.st !== 'pick') {
      if (pressed('KeyR')) this.reload(me);
      if (pressed('Digit1')) this.swap(me, 'rifle');
      if (pressed('Digit2')) this.swap(me, 'pistol');
      if (pressed('KeyQ')) this.swap(me, me.w === 'rifle' ? 'pistol' : 'rifle');
      if (pressed('KeyZ')) this.toggleAds();
      if (pressed('KeyG')) this.throwNade(me);
      for (const it of SH_BUY) if (pressed(it.key)) this.buy(me, it.id);
    }
    this.prevKeys = new Set(k);
  },
  // The local player: walk / run / jump, look, shoot.
  updateMe(p, dt, live) {
    if (!p.alive) { p.deadT += dt; p.ads = false; p.adsK = 0; return; }
    const k = G.keys, st = G.stick, key = (...c) => (c.some(x => k.has(x)) ? 1 : 0);
    let ix = key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft') + (st.x || 0);
    let iy = key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown') - (st.y || 0);
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    // On a phone the stick pushed all the way runs, but not while the sight is up (you walk
    // with it); Shift always runs, and running puts the sight down.
    const stickFull = G.touch && !this.adsTog && Math.hypot(st.x || 0, st.y || 0) > 0.92 && -(st.y || 0) > 0.5;
    const sprint = (k.has('ShiftLeft') || k.has('ShiftRight') || stickFull) && iy > 0.3 && !(this.trigger && p.reloadT <= 0);
    p.sprint = sprint && live;
    if (p.sprint) this.adsTog = false;
    // The sight: up while the right button is held (or after Z / 🎯), not while running, reloading
    // or bringing a gun up. adsK eases 0 → 1 over SH_ADS_T.
    p.ads = (this.adsHold || this.adsTog) && !p.sprint && p.reloadT <= 0 && p.drawT <= 0.05 && !this.over && this.st !== 'pick';
    p.adsK = Math.max(0, Math.min(1, (p.adsK || 0) + (p.ads ? 1 : -1) * dt / (this.wp(p).adsT || SH_ADS_T)));
    if (p.ads && !this.adsWas) this.sfx('ads', { cap: 2 });
    this.adsWas = p.ads;
    if (!live) { ix = iy = 0; }
    // Touch aim assist: a gentle pull toward an enemy near the crosshair while you aim or shoot.
    if (G.touch && live && (this.trigger || this.lookMoving > 0)) this.assist(p, dt);
    this.lookMoving = Math.max(0, (this.lookMoving || 0) - dt);
    p.a = this.look.yaw; p.pitch = this.look.pitch;
    this.move(p, ix, iy, sprint, dt);
    if (live && (this.trigger || p.burstN > 0)) this.tryFire(p);
    // Footsteps.
    const sp = Math.hypot(p.vx, p.vz);
    if (p.onGround && sp > 1.5) { p.stepPh = (p.stepPh || 0) + dt * sp * 0.55; if (p.stepPh > 1) { p.stepPh = 0; Sound.synth.noise(0.06, sprint ? 0.09 : 0.05, 450, 'lowpass'); } }
  },
  // Moves someone by an input (x right, y forward) in their facing; gravity, jumps, walls.
  move(p, ix, iy, sprint, dt) {
    const W = this.wp(p);
    const top = (sprint ? 6.8 : 4.6) * W.speed * (p.reloadT > 0 ? 0.85 : 1) * (1 - (1 - W.ads.move) * (p.adsK || 0));
    const fx = Math.cos(p.a), fz = Math.sin(p.a), rx = -Math.sin(p.a), rz = Math.cos(p.a);
    const wx = (fx * iy + rx * ix) * top, wz = (fz * iy + rz * ix) * top;
    const acc = p.onGround ? 14 : 2.5;
    p.vx += (wx - p.vx) * Math.min(1, dt * acc); p.vz += (wz - p.vz) * Math.min(1, dt * acc);
    this.slide(p, p.vx * dt, p.vz * dt);
    const floor = this.floorAt(p.x, p.z, p.y);
    p.vy -= SH_GRAV * dt; p.y += p.vy * dt;
    if (p.y <= floor) { if (p.vy < -7 && p.isMe) { Sound.synth.noise(0.1, 0.15, 300); } p.y = floor; p.vy = 0; p.onGround = true; }
    else p.onGround = p.y - floor < 0.05;
  },
  act() { const p = this.me; if (p && p.alive && this.st === 'live' && p.onGround) { p.vy = SH_JUMP; p.onGround = false; Sound.synth.noise(0.08, 0.06, 600); } },
  assist(p, dt) {
    // Through the sight it's gentler, and only for someone close to the dot.
    const ak = p.adsK || 0;
    let best = null, bd = 0.11 * (1 - 0.45 * ak);
    for (const e of this.ps) {
      if (e.team === p.team || !e.alive) continue;
      const dx = e.x - p.x, dz = e.z - p.z, dy = e.y + 1.2 - (p.y + SH_EYE), L = Math.hypot(dx, dz);
      if (L > 30) continue;
      let da = Math.atan2(dz, dx) - p.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      const dp = Math.atan2(dy, L) - p.pitch;
      const off = Math.hypot(da, dp);
      if (off < bd && this.sees(p, e.x, e.y + 1.2, e.z)) { bd = off; best = { da, dp }; }
    }
    if (!best) return;
    const k = Math.min(1, dt * 2.2) * (1 - 0.6 * ak);
    this.look.yaw += best.da * k * 0.6; this.look.pitch += best.dp * k * 0.4;
  },

  // ---------- weapons ----------
  swap(p, w) {
    if (p.w === w || !p.alive) return;
    p.w = w; p.reloadT = 0; p.drawT = this.wp(p, w).draw; p.cool = Math.max(p.cool, this.wp(p, w).draw * 0.8); p.burstN = 0;
    if (p.isMe) { this.sfx('ads', { vol: 1.4, rate: 0.85, cap: 2 }); Sound.synth.tone(500, 0.04, 'square', 0.03); Sound.synth.later(120, () => Sound.synth.tone(900, 0.03, 'square', 0.03)); this.semiHeld = true; }
  },
  reload(p) {
    const a = p.ammo[p.w], W = this.wp(p);
    if (!p.alive || p.reloadT > 0 || a[0] >= W.mag || a[1] <= 0) return false;
    p.reloadT = W.reload; p.burstN = 0;
    // (A tactical reload, rounds still in, skips the bolt.)
    const sounded = this.reloadSound(p, W, a[0] === 0);
    if (p.isMe) {
      const at = Sound.synth.now();
      if (!sounded) { Sound.synth.tone(1400, 0.03, 'square', 0.05, null, at + 0.15); Sound.synth.noise(0.08, 0.12, 2400, 'bandpass', at + 0.25); Sound.synth.tone(900, 0.04, 'square', 0.06, null, at + W.reload * 0.62); Sound.synth.tone(1800, 0.03, 'square', 0.06, null, at + W.reload * 0.88); }
      // A whole magazine and not one hit: someone notices.
      if (p.magShots >= W.mag * 0.8 && !p.magHits && Math.random() < 0.6) Arcade.say(fmt(pick(SH_SAY.whiff)), null, 3000);
      p.magShots = 0; p.magHits = 0;
    } else if (p.bot && Math.random() < 0.3) this.shout(p, pick(SH_LINES.reload));
    return true;
  },
  finishReload(p) {
    const a = p.ammo[p.w], W = this.wp(p), n = Math.min(W.mag - a[0], a[1]);
    a[0] += n; a[1] -= n; p.reloadT = 0;
  },
  // Pulls the trigger (if the gun is ready): empty → click and reload; otherwise a shot.
  tryFire(p) {
    const W = this.wp(p), a = p.ammo[p.w];
    if (!p.alive || p.cool > 0 || p.reloadT > 0 || p.drawT > 0.05 || p.sprint) return false;
    // (A burst, once started, finishes by itself.)
    if (!W.auto && p.isMe && this.semiHeld && !G.touch && !(p.burstN > 0)) return false;
    if (a[0] <= 0) {
      p.cool = 0.25; p.burstN = 0;
      if (p.isMe && !this.sfx('dry', { cap: 2 })) Sound.synth.tone(2200, 0.02, 'square', 0.05);
      if (!this.reload(p) && p.w === 'rifle') this.swap(p, 'pistol');
      return false;
    }
    a[0]--; p.cool = W.auto ? W.rate : (G.touch && p.isMe ? 0.28 : W.rate);
    // The M16: three quick ones, then a short pause.
    if (W.burst) { if (!(p.burstN > 0)) p.burstN = W.burst; p.burstN--; p.cool = p.burstN > 0 ? W.rate : W.burstGap; }
    if (p.isMe && !W.auto) this.semiHeld = true;
    this.fire(p);
    return true;
  },
  // A shot from p along where they look (with spread): what it hits, the effects, and the damage
  // (here when this phone is the referee, or reported to the host when it isn't).
  fire(p, aim = null) {
    const W = this.wp(p);
    const ak = p.adsK || 0, st = this.steady(p, W);
    let spread = this.spreadOf(p, W);
    if (aim && aim.extra) spread += aim.extra;
    p.bloom = Math.min(W.bloomMax, p.bloom + W.bloom * (1 - (1 - W.ads.bloom) * ak) * (st ? st.bloom : 1));
    this.lastSpread = spread;
    const yaw = aim ? aim.yaw : p.a, pit = aim ? aim.pitch : p.pitch;
    const r = spread * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
    const ey = yaw + Math.cos(th) * r, ep = pit + Math.sin(th) * r;
    const d = { x: Math.cos(ey) * Math.cos(ep), y: Math.sin(ep), z: Math.sin(ey) * Math.cos(ep) };
    const o = { x: p.x, y: p.y + SH_EYE, z: p.z };
    const hit = this.trace(o, d, p);
    p.fired++; p.magShots = (p.magShots || 0) + 1;
    if (hit.who) p.magHits = (p.magHits || 0) + 1;
    // Recoil for the player.
    if (p.isMe) { const kk = W.kick * (1 - (1 - W.ads.kick) * ak) * (st ? st.kick : 1); this.lastKick = kk; this.look.pitch = Math.min(1.3, this.look.pitch + kk * (0.8 + Math.random() * 0.4)); this.look.yaw += (Math.random() - 0.5) * kk * 0.5; this.kick = 1; }
    const shot = { id: this.seq++, s: p.i, w: p.w === 'rifle' ? 0 : 1, o: [o.x, o.y, o.z], e: [hit.x, hit.y, hit.z], v: hit.who ? hit.who.i : -1, hs: hit.head ? 1 : 0, at: performance.now() };
    this.shotFx(p, shot, hit);
    const dist = Math.hypot(hit.x - o.x, hit.y - o.y, hit.z - o.z);
    if (this.host) { if (hit.who) this.damage(hit.who, p, this.shotDmg(p, W, dist), !!hit.head, hit); if (p.bot || p.isMe) this.botShots.push(shot); }
    else if (p.isMe) {
      this.myShots.push(shot);
      // A guest sees its own hit at once (and what it should take off); the host decides.
      if (hit.who) { this.hm = 0.25; this.hmKill = false; Sound.synth.tone(hit.head ? 2400 : 1500, 0.05, 'triangle', hit.head ? 0.12 : 0.08); this.dmgNum(hit, this.dmgCalc(hit.who, this.shotDmg(p, W, dist), !!hit.head).hp, !!hit.head, hit.who); }
    }
    // Everyone near hears it (the bots learn where you are).
    this.heard(p);
    return hit;
  },
  // The nearest thing a ray hits: a soldier (not the shooter, alive) or the town.
  trace(o, d, from) {
    const wall = this.rayStatic(o, d, 120);
    let best = { ...wall, who: null };
    for (const e of this.ps) {
      if (e === from || !e.alive) continue;
      const h = this.rayBody(o, d, e);
      if (h && h.t < best.t) best = { t: h.t, x: o.x + d.x * h.t, y: o.y + d.y * h.t, z: o.z + d.z * h.t, who: e, head: h.head, nx: -d.x, ny: -d.y, nz: -d.z, hit: true };
    }
    return best;
  },
  // Effects of a shot: the flash, the tracer, sparks or blood at the end, sound by distance.
  shotFx(p, shot, hit) {
    const isMe = p.isMe, w = shot.w ? 'pistol' : 'rifle';
    const [ox, oy, oz] = shot.o, [ex, ey, ez] = shot.e;
    // The muzzle (the view model's for you, the soldier's gun for the others).
    let mx = ox, my = oy - 0.15, mz = oz;
    if (!isMe && p.m.guns) { const g = p.m.guns[w]; if (g && g.userData.muzzle) { const v = g.userData.muzzle.getWorldPosition(new THREE.Vector3()); mx = v.x; my = v.y; mz = v.z; } }
    else { const right = 0.18 * (1 - (p.adsK || 0)); mx += -Math.sin(p.a) * right + Math.cos(p.a) * 0.5; mz += Math.cos(p.a) * right + Math.sin(p.a) * 0.5; }
    // The flash: two drawn frames (the star, then the smaller one), however fast the screen is.
    // (A suppressor all but hides it: a small flash, hardly any light.)
    const fk = w === 'rifle' && this.wp(p, 'rifle').supp ? SH_ATT.supp.flash : 1;
    this.lastFlash = fk;
    if (isMe) { this.vmFlashN = 2; this.vmFlashK = fk; this.vmFlash.material.rotation = Math.random() * 6; this.ejectShell(w); }
    else { p.m.flashN = 2; p.m.flash.position.set(mx, my, mz); p.m.flash.material.rotation = Math.random() * 6; p.m.flash.scale.setScalar((w === 'rifle' ? 0.55 : 0.4) * fk); }
    this.flashLight.position.set(mx, my, mz); this.flashLight.intensity = 2.2 * fk * fk;
    // Tracer: every rifle shot, some pistol ones.
    if (w === 'rifle' || Math.random() < 0.5) {
      // Yours starts a few metres out, so it doesn't streak across your own face.
      if (isMe) { const dx = ex - mx, dy = ey - my, dz = ez - mz, L = Math.hypot(dx, dy, dz) || 1, k = Math.min(0.9, 3 / L); this.tracer(mx + dx * k, my + dy * k, mz + dz * k, ex, ey, ez); }
      else this.tracer(mx, my, mz, ex, ey, ez);
    }
    if (hit) {
      if (hit.who) this.blood(ex, ey, ez);
      else if (hit.hit) this.impact(ex, ey, ez, hit.nx, hit.ny, hit.nz, false, hit.box && hit.box.kind);
    } else this.impact(ex, ey, ez, 0, 1, 0, true);
    // The bang.
    const me = this.me, dist = me ? Math.hypot(ox - me.x, oz - me.z) : 0;
    const v = isMe ? 1 : Math.max(0.12, 1 - dist / 45), cut = isMe ? 1 : Math.max(0.35, 1 - dist / 40);
    const quiet = w === 'rifle' && this.wp(p, 'rifle').supp;
    if (this.shotSound(p, w, ox, oz)) { /* the recorded report */ }
    else if (quiet) { if (isMe || dist < SH_ATT.supp.quiet) Sound.synth.noise(0.06, 0.12 * (isMe ? 1 : Math.max(0, 1 - dist / SH_ATT.supp.quiet)), 900, 'lowpass'); }
    else if (w === 'rifle') { Sound.synth.noise(0.11, 0.42 * v, 2600 * cut); Sound.synth.noise(0.28, 0.22 * v, 420, 'lowpass'); Sound.synth.tone(120, 0.07, 'square', 0.05 * v, 50); }
    else { Sound.synth.noise(0.08, 0.38 * v, 3400 * cut); Sound.synth.tone(190, 0.06, 'square', 0.05 * v, 80); Sound.synth.noise(0.18, 0.12 * v, 600, 'lowpass'); }
    if (isMe) G.shake = Math.max(G.shake || 0, w === 'rifle' ? 0.03 : 0.05);
    // A bullet cracking past your head.
    if (!isMe && me && me.alive) {
      const dx = ex - ox, dy = ey - oy, dz = ez - oz, L = Math.hypot(dx, dy, dz) || 1;
      const px = me.x - ox, py = me.y + 1.6 - oy, pz = me.z - oz, t = (px * dx + py * dy + pz * dz) / L;
      if (t > 0 && t < L) { const cx = ox + dx / L * t - me.x, cy = oy + dy / L * t - me.y - 1.6, cz = oz + dz / L * t - me.z; if (Math.hypot(cx, cy, cz) < 1.2 && !this.sfx('whizz', { vol: 0.9, pan: (cx * -Math.sin(this.look.yaw) + cz * Math.cos(this.look.yaw)) / (Math.hypot(cx, cz) || 1) * 0.8, cap: 2 })) Sound.synth.noise(0.05, 0.12, 5000, 'bandpass', 0, null, 2); }
    }
  },
  tracer(x0, y0, z0, x1, y1, z1) {
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    if (L < 1.5) return;
    const m = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
    m.position.set(x0, y0, z0); m.lookAt(x1, y1, z1);
    this.scene.add(m);
    this.tracers.push({ m, L, t: 0, x0, y0, z0, dx: (x1 - x0) / L, dy: (y1 - y0) / L, dz: (z1 - z0) / L });
  },
  impact(x, y, z, nx, ny, nz, quiet, kind) {
    for (let i = 0; i < 4; i++) this.spark(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03, nx, ny, nz);
    this.puff(x + nx * 0.1, y + ny * 0.1, z + nz * 0.1, ny > 0.5 ? 0xc8a878 : 0xb8b0a0, 0.35, 0.5);
    // A small dark mark where it hit.
    const dcl = new THREE.Mesh(this.decalGeo, this.decalMat);
    dcl.position.set(x + nx * 0.012, y + ny * 0.012, z + nz * 0.012);
    dcl.lookAt(x + nx, y + ny, z + nz);
    this.scene.add(dcl); this.decals.push(dcl);
    if (this.decals.length > 70) this.scene.remove(this.decals.shift());
    // What it hit: a ping off metal (containers, launchers, poles), a thud off the rest.
    const metal = /container|launcher|radar|dumpster|pole|crate/.test(kind || '');
    if (!quiet && !this.sfxAt(metal ? 'hit_metal' : 'hit_concrete', x, z, { range: 22, cap: 3, vol: 0.9 }) && this.me && Math.hypot(x - this.me.x, z - this.me.z) < 14) Sound.synth.tone(2600 + Math.random() * 1400, 0.03, 'triangle', 0.02);
  },
  blood(x, y, z) { for (let i = 0; i < 3; i++) this.puff(x, y, z, 0x9a1a14, 0.22, 0.35); },
  spark(x, y, z, nx, ny, nz) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color: 0xffd080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, y, z); m.scale.setScalar(0.08); this.scene.add(m);
    const s = 2 + Math.random() * 3;
    this.fx.push({ m, t: 0, life: 0.25, s: 0.08, vx: (nx + (Math.random() - 0.5) * 1.4) * s, vy: (ny + Math.random() * 0.8) * s, vz: (nz + (Math.random() - 0.5) * 1.4) * s, g: 9, spark: true });
  },
  puff(x, y, z, color, size, life = 0.9, vy = 0.5) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color, transparent: true, depthWrite: false, opacity: 0.6 }));
    m.position.set(x, y, z); m.scale.setScalar(size); this.scene.add(m);
    this.fx.push({ m, t: 0, life, s: size, vx: (Math.random() - 0.5) * 0.4, vy, vz: (Math.random() - 0.5) * 0.4, g: 0 });
    if (this.fx.length > 160) { const f = this.fx.shift(); this.scene.remove(f.m); }
  },
  ejectShell(w) {
    const m = new THREE.Mesh(this.shellGeo, this.shellMat);
    const g = this.me && this.vmGun(this.me); if (!g) return;
    const base = new THREE.Vector3(0.03, 0.03, w === 'rifle' ? -0.1 : 0.0); g.localToWorld(base);
    m.position.copy(base); this.vmScene.add(m);
    this.shells.push({ m, t: 0, vx: 0.8 + Math.random() * 0.5, vy: 0.9 + Math.random() * 0.4, vz: 0.1 + Math.random() * 0.2, r: Math.random() * 20 });
    if (this.shells.length > 12) this.vmScene.remove(this.shells.shift().m);
    Sound.synth.later(380 + Math.random() * 200, () => Sound.synth.tone(3800 + Math.random() * 900, 0.04, 'sine', 0.012));
  },

  // ---------- sound ----------
  // The game's audio context and its effects bus (so the volume and the sound switch apply):
  // borrowed from the first node Sound.synth connects to it. No bus (sound off) → no clips.
  audio() {
    if (this.ac) return this.ac;
    let cap = null;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dst, ...r) { if (!cap && this instanceof GainNode && dst instanceof AudioNode) cap = { ctx: this.context, bus: dst }; return orig.call(this, dst, ...r); };
    try { Sound.synth.tone(30, 0.01, 'sine', 0.0001); } catch (e) { cap = null; } finally { AudioNode.prototype.connect = orig; }
    if (!cap) return null;
    const ctx = cap.ctx, inp = ctx.createGain(); inp.gain.value = 1.1; inp.connect(cap.bus);
    // The town: a short slapback off the houses (~0.11 s, a second, softer one), darker each time.
    const echo = ctx.createGain(), d1 = ctx.createDelay(0.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    d1.delayTime.value = 0.115; fb.gain.value = 0.32; lp.type = 'lowpass'; lp.frequency.value = 2400;
    echo.connect(d1); d1.connect(lp); lp.connect(fb); fb.connect(d1); lp.connect(inp);
    this.ac = { ctx, inp, echo };
    this.voices = [];
    for (const n of Object.keys(SH_SFX)) {
      if (SH_BUFS[n]) continue;
      SH_BUFS[n] = 'loading';
      fetch(`assets/audio/shooter/${n}.mp3`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then(buf => { SH_BUFS[n] = buf; }).catch(() => { delete SH_BUFS[n]; });
    }
    return this.ac;
  },
  // Plays a clip: vol, rate (± a little at random), pan −1..1, lp (a low-pass in Hz, for distance),
  // echo (how much goes to the slapback), delay (s), cap (how many of the same at once: the
  // oldest is faded out, so fast auto fire doesn't pile up). false if the clip isn't ready.
  sfx(name, o = {}) {
    const A = this.audio(), buf = SH_BUFS[name];
    if (!A || !(buf instanceof AudioBuffer)) return false;
    const { ctx } = A, t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() - 0.5) * (o.jit != null ? o.jit : 0.06));
    const g = ctx.createGain(); g.gain.value = (o.vol != null ? o.vol : 1) * SH_SFX[name] * (0.9 + Math.random() * 0.2);
    let node = src;
    if (o.lp && o.lp < 16000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g); node = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); node.connect(p); node = p; }
    node.connect(A.inp);
    if (o.echo) { const e = ctx.createGain(); e.gain.value = o.echo; node.connect(e); e.connect(A.echo); }
    src.start(t);
    const v = { name, src, g, at: t };
    src.onended = () => { const i = this.voices.indexOf(v); if (i >= 0) this.voices.splice(i, 1); };
    this.voices.push(v);
    const steal = (list) => { const old = list[0]; this.voices.splice(this.voices.indexOf(old), 1); try { old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.015); old.src.stop(ctx.currentTime + 0.08); } catch (e) { /* ended */ } };
    const same = this.voices.filter(q => q.name === name);
    if (same.length > (o.cap || 6)) steal(same);
    if (this.voices.length > 32) steal(this.voices);
    (this.sfxLog = this.sfxLog || []).push(name); if (this.sfxLog.length > 60) this.sfxLog.shift();
    return true;
  },
  // Where a sound at (x, z) is from you: distance, pan, and the distance's level, dullness, echo
  // and delay (sound takes its time across the square).
  heardAt(x, z) {
    const me = this.me, c = this.camera, lx = me && me.alive ? me.x : c.position.x, lz = me && me.alive ? me.z : c.position.z;
    const yaw = me && me.alive ? this.look.yaw : Math.atan2(c.getWorldDirection(new THREE.Vector3()).z, c.getWorldDirection(new THREE.Vector3()).x);
    const dx = x - lx, dz = z - lz, d = Math.hypot(dx, dz) || 0.01;
    const pan = ((dx * -Math.sin(yaw) + dz * Math.cos(yaw)) / d) * Math.min(1, d / 3) * 0.85;
    const k = Math.min(1, d / 45);
    return { d, pan, vol: Math.max(0.08, Math.pow(1 - k, 1.3)), lp: 17000 * Math.pow(1 - k, 2.2) + 700, echo: 0.12 + 0.45 * k, delay: d / 343 };
  },
  // A gunshot: yours close and full (crack + body, a mechanical clack, the slapback); others' by
  // distance and direction, a far one with the across-town take mixed in.
  shotSound(p, w, x, z) {
    const gun = w === 'pistol' ? 'pistol' : (p.gun || 'm16'), takes = SH_SHOTS[gun], name = takes[Math.floor(Math.random() * takes.length)];
    const rate = gun === 'tavor' ? 1.06 : gun === 'm4' ? 0.97 : gun === 'negev' ? 0.92 : gun === 'sniper' ? 0.8 : 1;
    // Suppressed: a muffled, softer "thup" (yours), and the others only hear it from close by.
    if (w !== 'pistol' && this.wp(p, 'rifle').supp) {
      const Q = SH_ATT.supp;
      if (p.isMe) { this.lastShotVol = 0.4; if (!this.sfx(name, { vol: 0.4, rate: rate * 1.18, lp: 1500, echo: 0.04, cap: 5 })) return false; Sound.synth.noise(0.07, 0.1, 900, 'lowpass'); Sound.synth.tone(1500, 0.02, 'square', 0.015); return true; }
      const h = this.heardAt(x, z);
      this.lastShotVol = h.d > Q.quiet ? 0 : 0.45 * Math.pow(1 - h.d / Q.quiet, 1.4);
      if (h.d > Q.quiet) return true;
      return this.sfx(name, { vol: this.lastShotVol, rate: rate * 1.18, pan: h.pan, lp: Math.min(1300, h.lp), echo: 0.05, delay: h.delay, cap: 6 });
    }
    if (p.isMe) {
      this.lastShotVol = 1;
      if (!this.sfx(name, { vol: 1, rate, echo: 0.2, cap: 5 })) return false;
      Sound.synth.tone(gun === 'pistol' ? 2400 : 1700, 0.025, 'square', 0.025);
      Sound.synth.noise(0.09, 0.12, 180, 'lowpass');
      return true;
    }
    const h = this.heardAt(x, z);
    this.lastShotVol = h.vol * 0.9;
    if (!this.sfx(name, { vol: h.vol * 0.9, rate, pan: h.pan, lp: h.lp, echo: h.echo, delay: h.delay, cap: 6 })) return false;
    if (h.d > 18) this.sfx('far', { vol: Math.min(1, (h.d - 18) / 20) * 0.7, pan: h.pan * 0.6, lp: 2500, delay: h.delay, cap: 3 });
    return true;
  },
  // A sound from somewhere in the square (impacts, grenades, someone else's reload).
  sfxAt(name, x, z, o = {}) {
    const h = this.heardAt(x, z);
    if (o.range && h.d > o.range) return true;
    return this.sfx(name, { ...o, vol: (o.vol != null ? o.vol : 1) * h.vol, pan: h.pan, lp: Math.min(o.lp || 20000, h.lp), echo: (o.echo || 0) + h.echo * 0.5, delay: h.delay });
  },
  // A magazine change, in step with the animation: release and out (it clatters down when it was
  // empty), the new one in with a click, and on an empty gun the bolt (or the Glock's slide).
  reloadSound(p, W, empty) {
    const R = W.reload, pistol = W.slot === 'pistol';
    const play = (n, at, o = {}) => (p.isMe ? this.sfx(n, { delay: at, ...o }) : this.sfxAt(n, p.x, p.z, { delay: at, range: 16, ...o }));
    let ok;
    if (pistol) { ok = play('pmag', R * 0.12); if (empty) play('pslide', R * 0.78); }
    else {
      ok = play('mag_out', R * 0.1);
      if (empty) play('mag_drop', R * 0.3, { vol: 0.8 });
      play('mag_in', R * 0.55);
      if (empty) play('bolt', R * 0.82);
    }
    return ok;
  },

  // ---------- grenades ----------
  // Throws one along where p looks (a bot: at a spot, with the arc worked out). The host owns
  // grenades: a guest asks it (the throw goes in the presence) and sees it when the host has it.
  throwNade(p, at) {
    const now = performance.now();
    if (!p || !p.alive || this.st !== 'live' || !(p.nadeN > 0) || (p.nadeAt || 0) > now) return false;
    p.nadeAt = now + 900;
    const fx = Math.cos(p.a), fz = Math.sin(p.a);
    const o = { x: p.x + fx * 0.4, y: p.y + SH_EYE - 0.12, z: p.z + fz * 0.4 };
    let v;
    if (at) {
      // A bot: a flight time by the distance, and the speed that lands it there.
      const dx = at.x - o.x, dz = at.z - o.z, D = Math.hypot(dx, dz), T = Math.max(0.55, Math.min(1.5, D / 13));
      v = { x: dx / T, y: (0.3 - o.y + 0.5 * SH_GRAV * T * T) / T, z: dz / T };
    } else {
      const pit = p.pitch + 0.14, sp = SH_NADE.speed;
      v = { x: Math.cos(p.a) * Math.cos(pit) * sp + (p.vx || 0) * 0.5, y: Math.sin(pit) * sp + 1.2, z: Math.sin(p.a) * Math.cos(pit) * sp + (p.vz || 0) * 0.5 };
    }
    p.nadeN--;
    if (this.host) this.spawnNade(p.i, o, v);
    else if (p.isMe) this.myThrows.push({ id: this.seq++, o, v, at: now });
    if (p.isMe) { this.vmNadeT = 0.4; }
    if (p.isMe) { p.drawT = Math.max(p.drawT || 0, 0.35); if (!this.sfx('pin', { cap: 2 })) { Sound.synth.tone(2600, 0.03, 'square', 0.04); Sound.synth.noise(0.08, 0.06, 1200); } }
    else this.sfxAt('pin', p.x, p.z, { range: 12, vol: 0.7 });
    if (p.bot && this.rnd() < 0.6) this.shout(p, pick(SH_LINES.nade));
    return true;
  },
  spawnNade(s, o, v, id = this.nadeSeq++, t = 0) {
    if (!this.nadeGeo) {
      this.nadeGeo = new THREE.SphereGeometry(0.045, 10, 8); this.nadeGeo.scale(1, 1.25, 1);
      this.nadeMat = new THREE.MeshStandardMaterial({ color: 0x3e4a2a, roughness: 0.7, metalness: 0.2 });
    }
    const m = this.nadeModel(); m.traverse(q => { if (q.isMesh) q.castShadow = true; });
    m.position.set(o.x, o.y, o.z); this.scene.add(m);
    const n = { id, s, x: o.x, y: o.y, z: o.z, vx: v.x, vy: v.y, vz: v.z, t: 0, m, rest: false };
    this.nades.push(n);
    // Caught up to where it is already (a guest hears about it a little late).
    for (let k = 0; k < t; k += 0.02) this.stepNade(n, Math.min(0.02, t - k));
    return n;
  },
  // The grenade (the model, about 11 cm tall; a ball until it's loaded).
  nadeModel() {
    const src = Assets.models.prop_nade;
    if (!src) return new THREE.Mesh(this.nadeGeo, this.nadeMat);
    const g = new THREE.Group(), m = src.clone(true); m.scale.setScalar(0.11);
    m.traverse(q => { if (q.isMesh) { q.frustumCulled = false; if (!q.material.userData.shLit) { q.material.color.setScalar(1.5); q.material.userData.shLit = true; } } });
    g.add(m); return g;
  },
  // Flies, bounces off whatever it meets (the ground, boxes, walls, ramps), rolls to a stop.
  stepNade(n, dt) {
    n.t += dt;
    if (n.rest) return;
    n.vy -= SH_GRAV * dt;
    const sp = Math.hypot(n.vx, n.vy, n.vz);
    if (sp < 1e-4) return;
    const d = { x: n.vx / sp, y: n.vy / sp, z: n.vz / sp }, L = sp * dt;
    const h = this.rayStatic({ x: n.x, y: n.y, z: n.z }, d, L + 0.05);
    if (h.hit && h.t <= L + 0.05) {
      const vn = n.vx * h.nx + n.vy * h.ny + n.vz * h.nz;
      n.vx -= 1.4 * vn * h.nx; n.vy -= 1.4 * vn * h.ny; n.vz -= 1.4 * vn * h.nz;
      n.vx *= 0.7; n.vy *= 0.7; n.vz *= 0.7;
      n.x = h.x + h.nx * 0.05; n.y = h.y + h.ny * 0.05; n.z = h.z + h.nz * 0.05;
      // The first landing: the recorded bounce-and-roll; later knocks: little taps.
      if (Math.abs(vn) > 2 && n.t > 0.05 && this.me) { const dm = Math.hypot(n.x - this.me.x, n.z - this.me.z); if (dm < 25 && (n.tapped || !this.sfxAt('bounce', n.x, n.z, { range: 25, cap: 3 }))) Sound.synth.tone(900 + Math.random() * 400, 0.03, 'triangle', 0.03 * (1 - dm / 25)); n.tapped = true; }
      if (h.ny > 0.6 && Math.hypot(n.vx, n.vy, n.vz) < 0.6) { n.rest = true; n.vx = n.vy = n.vz = 0; }
    } else { n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt; }
    if (n.y < 0.05) { n.y = 0.05; if (n.vy < 0) n.vy = -n.vy * 0.3; }
  },
  updateNades(dt) {
    for (const n of this.nades) {
      for (let k = 0; k < 3; k++) this.stepNade(n, dt / 3);
      n.m.position.set(n.x, n.y, n.z);
      if (!n.rest) { n.m.rotation.x += dt * 9; n.m.rotation.z += dt * 6; }
      if (n.t >= SH_NADE.fuse && !n.boom) this.explode(n);
    }
    this.nades = this.nades.filter(n => { if (!n.boom) return true; this.scene.remove(n.m); return false; });
  },
  // Bang: the flash, dust, sparks, a shake by distance; the host hurts whoever is in reach and
  // not behind something (falling off with distance; your own team is spared, you aren't).
  explode(n) {
    n.boom = true;
    const x = n.x, y = Math.max(0.1, n.y), z = n.z, me = this.me;
    this.flashLight.position.set(x, y + 0.5, z); this.flashLight.intensity = 9;
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex[0], color: 0xffd090, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.position.set(x, y + 0.4, z); fl.scale.setScalar(2.6); this.scene.add(fl);
    this.fx.push({ m: fl, t: 0, life: 0.22, s: 2.6, vx: 0, vy: 0, vz: 0, g: 0, spark: true });
    for (let i = 0; i < 10; i++) this.puff(x + (Math.random() - 0.5) * 1.2, y + 0.2 + Math.random() * 0.6, z + (Math.random() - 0.5) * 1.2, i < 4 ? 0x5a5048 : 0xc8a878, 1.1 + Math.random() * 0.6, 1.6, 0.8 + Math.random());
    for (let i = 0; i < 14; i++) this.spark(x, y + 0.1, z, (Math.random() - 0.5) * 2, 0.6 + Math.random(), (Math.random() - 0.5) * 2);
    const dcl = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), this.decalMat); dcl.rotation.x = -Math.PI / 2; dcl.position.set(x, this.floorAt(x, z, y) + 0.015, z); this.scene.add(dcl); this.decals.push(dcl);
    const dm = me ? Math.hypot(x - me.x, z - me.z) : 30, v = Math.max(0.15, 1 - dm / 45);
    if (this.sfxAt('boom', x, z, { vol: 1.1, jit: 0.1, echo: 0.3, cap: 3 })) Sound.synth.tone(48, 0.9, 'sine', 0.22 * v, 28);
    else { Sound.synth.noise(0.7, 0.7 * v, 900, 'lowpass'); Sound.synth.noise(0.15, 0.5 * v, 3000); Sound.synth.tone(55, 0.5, 'sine', 0.25 * v, 30); }
    if (dm < 18) G.shake = Math.max(G.shake || 0, 0.45 * (1 - dm / 18));
    if (!this.host) return;
    const owner = this.ps[n.s];
    for (const q of this.ps) {
      if (!q.alive || !owner) continue;
      if (q.team === owner.team && q !== owner) continue;
      const cy = q.y + 1.0, d = Math.hypot(q.x - x, cy - y, q.z - z);
      if (d >= SH_NADE.r) continue;
      const dir = { x: (q.x - x) / d, y: (cy - y - 0.15) / d, z: (q.z - z) / d };
      const w = this.rayStatic({ x, y: y + 0.15, z }, dir, d);
      if (w.hit && w.t < d - 0.3) continue;
      const base = SH_NADE.dmg * Math.pow(1 - d / SH_NADE.r, 1.4) * (q === owner ? 0.6 : 1);
      if (base >= 1) this.damage(q, owner, base, false, { x: q.x, y: q.y + 1.4, z: q.z });
    }
    for (const b of this.ps) if (b.bot && b.alive && Math.hypot(b.x - x, b.z - z) < 20 && owner) b.know = { x: owner.x, z: owner.z, t: this.t, who: owner };
  },
  // What a hit took off, on the screen where it landed: a number that jumps up and fades
  // (yellow; red and bigger in the head), and under the crosshair the total you've taken off
  // the same soldier in a row (it resets two seconds after you stop hitting him).
  dmgNum(at, dmg, head, who = null) {
    const v = Math.round(dmg), root = this.el && this.el.root;
    if (v < 1 || !at || !root) return;
    const q = new THREE.Vector3(at.x, at.y, at.z).project(this.camera);
    const W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight;
    const on = q.z < 1 && Math.abs(q.x) < 1.1 && Math.abs(q.y) < 1.1;
    const x = on ? (q.x + 1) / 2 * W : W / 2, y = on ? (1 - q.y) / 2 * H : H / 2;
    const n = document.createElement('b');
    n.className = 'sh-dn' + (head ? ' head' : '');
    n.textContent = `-${v}`; n.dir = 'ltr';
    n.style.left = `${Math.round(x + 22 + (Math.random() - 0.5) * 26)}px`;
    n.style.top = `${Math.round(y - 18 + (Math.random() - 0.5) * 16)}px`;
    root.appendChild(n);
    setTimeout(() => n.remove(), 950);
    const T = this.dmgTot;
    if (T && T.who === who && who && this.t - T.at < 2) { T.sum += v; T.n++; T.at = this.t; }
    else this.dmgTot = { who, sum: v, n: 1, at: this.t };
    const e = this.el.dt;
    if (e) {
      const D = this.dmgTot, name = D.who && D.who.name ? `<small>${esc(D.who.name)}</small>` : '';
      e.innerHTML = `${name}<bdi dir="ltr">-${D.sum}</bdi>${D.who && D.who.hp <= 0 ? ' 💀' : ''}`;
      e.classList.toggle('show', D.n > 1 || head);
      e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
    }
  },

  // ---------- damage, deaths, rounds (the referee) ----------
  // What a hit takes off: double in the head (a helmet makes it 1.35); on the body the vest
  // takes half until its 50 points are gone. { hp, ar }: off the health and off the armour.
  dmgCalc(v, base, head) {
    if (head) return { hp: base * (v.helmet ? 1.35 : 2), ar: 0 };
    const ar = Math.min(v.armor || 0, base * 0.5);
    return { hp: base - ar, ar };
  },
  // A hit (the host decides): base damage from the shooter's gun (or a grenade), where it hit.
  damage(v, from, base, head, at) {
    if (!v.alive || this.st !== 'live') return;
    const c = this.dmgCalc(v, base, head), dmg = c.hp;
    v.armor = Math.max(0, (v.armor || 0) - c.ar);
    v.hp -= dmg; v.hurtAt = this.t;
    if (from.isMe && from !== v) this.dmgNum(at || { x: v.x, y: v.y + 1.3, z: v.z }, dmg, head, v);
    const id = this.seq++;
    this.hits.push({ id, v: v.i, a: from.i, d: Math.round(dmg), hs: head ? 1 : 0, at: performance.now() });
    this.onHit(v, from, dmg, head);
    v.know = { x: from.x, z: from.z, t: this.t, who: from }; v.hurtT = this.t;
    if (v.bot && v.hp > 0 && Math.random() < 0.18) this.shout(v, pick(SH_LINES.hurt));
    if (v.hp <= 0) {
      v.hp = 0;
      from.k++; v.d++;
      if (from !== v && from.team !== v.team) from.cash = Math.min(SH_CASH.max, (from.cash || 0) + SH_CASH.kill);
      const kid = this.seq++;
      this.kf.push({ id: kid, k: from.i, v: v.i, hs: head ? 1 : 0, w: from.w === 'rifle' ? 0 : 1, at: performance.now() });
      this.onKill(from, v, head);
    }
  },
  // Feedback of a hit for the people involved (on every phone, from the host's list).
  onHit(v, from, dmg, head) {
    if (from.isMe) { this.hm = 0.25; this.hmKill = v.hp <= 0; Sound.synth.tone(head ? 2400 : 1500, 0.05, 'triangle', head ? 0.12 : 0.08); if (head) Sound.synth.tone(3200, 0.12, 'sine', 0.06); }
    if (v.isMe) {
      this.dmgFx = Math.min(1, this.dmgFx + dmg / 50);
      this.dirs.push({ a: Math.atan2(from.z - v.z, from.x - v.x), t: 1.2 });
      Sound.synth.noise(0.09, 0.3, 380); Sound.synth.tone(95, 0.12, 'sine', 0.12, 60);
      G.shake = Math.max(G.shake || 0, 0.12);
    } else if (this.me && Math.hypot(v.x - this.me.x, v.z - this.me.z) < 25) Sound.synth.noise(0.06, 0.08, 500);
  },
  onKill(k, v, head) {
    v.alive = false; v.deadT = 0; v.hp = 0; v.reloadT = 0;
    v.fall = 0; v.fallDir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < 6; i++) this.puff(v.x + (Math.random() - 0.5) * 0.8, v.y + 0.2, v.z + (Math.random() - 0.5) * 0.8, 0xc8a878, 0.7, 1.2, 0.6);
    // A grunt.
    const me = this.me, near = me ? Math.max(0.15, 1 - Math.hypot(v.x - me.x, v.z - me.z) / 35) : 1;
    Sound.synth.tone(v.female ? 330 : 170, 0.32, 'sawtooth', 0.08 * near, v.female ? 200 : 90); Sound.synth.noise(0.25, 0.12 * near, 700);
    this.feed.unshift({ k: k.i, v: v.i, hs: head, w: k.w, at: performance.now() });
    this.feed = this.feed.slice(0, 5);
    if (k.isMe && k !== v) { this.hm = 0.35; this.hmKill = true; }
    if (k.isMe) { Sound.synth.tone(880, 0.08, 'square', 0.06); Sound.synth.later(90, () => Sound.synth.tone(1320, 0.12, 'square', 0.06)); if (head && Math.random() < 0.5) Arcade.say(fmt(pick(SH_SAY.head)), null, 2600); }
    if (v.isMe) { Arcade.big('💀 נפסלת', 1200); this.spec = null; }
    if (v.bot && Math.random() < 0.7) this.shout(v, pick(SH_LINES.dead));
    else if (k.bot && Math.random() < 0.45) this.shout(k, pick(SH_LINES.kill));
  },
  // The host: counts who's left; ends the round and the match.
  referee(dt) {
    if (this.st === 'live') {
      const alive = [0, 1].map(t => this.ps.filter(p => p.team === t && p.alive).length);
      if (!alive[0] || !alive[1]) this.endRound(alive[0] ? 0 : alive[1] ? 1 : -1, alive);
      else if (this.t >= this.ROUND) this.endRound(alive[0] > alive[1] ? 0 : alive[1] > alive[0] ? 1 : -1, alive);
    } else if (this.st === 'post') {
      this.postT -= dt;
      if (this.postT <= 0) {
        if (this.sc[0] >= this.WIN || this.sc[1] >= this.WIN) this.finish();
        else this.startRound(this.rd + (this.roundWin === -1 ? 0 : 1));
      }
    }
  },
  endRound(win, alive) {
    this.st = 'post'; this.postT = 3.6; this.roundWin = win;
    if (win >= 0) this.sc[win]++;
    // The round's money: everyone gets some, the side that lost a bit more to catch up.
    for (const p of this.ps) p.cash = Math.min(SH_CASH.max, (p.cash || 0) + SH_CASH.round + (win < 0 ? SH_CASH.lose / 2 : p.team !== win ? SH_CASH.lose : 0));
    this.roundFx(win, alive);
  },
  // The banner, the sound and a word from the cast (on every phone).
  roundFx(win, alive) {
    const mine = this.me ? this.me.team : 0;
    if (win < 0) { Arcade.big('🤝 תיקו — שוב!', 2000); Arcade.say(fmt(pick(SH_SAY.draw)), null, 3200); Sound.bad(); return; }
    const T = SH_TEAM[win];
    Arcade.big(`${T.icon} סיבוב ל${T.name}!`, 2200);
    if (win === mine) { Sound.fanfare(); } else Sound.bad();
    // A clutch: one alive against two at the start of the round's end.
    const last = this.ps.filter(p => p.team === win && p.alive);
    if (this.md === 2 && last.length === 1 && last[0].isMe && (this.clutchSeen || 0) < this.rd) { this.clutchSeen = this.rd; Arcade.say(fmt(pick(SH_SAY.clutch)), null, 3400); }
    else Arcade.say(fmt(pick(win === mine ? SH_SAY.win : SH_SAY.lose)), null, 3000);
    void alive;
  },
  finish() {
    if (this.over) return;
    this.over = true; this.st = 'over';
    this.lockOff();
    const mine = this.me ? this.me.team : 0, w = this.sc[0] >= this.WIN ? 0 : 1;
    Sound.fanfare(); Sound.horn();
    Arcade.big(w === mine ? '🏆 ניצחתם!' : '😩 הפסדתם', 2200);
    this.resultsAt = performance.now() + 3000;
  },
  results() {
    const w = this.sc[0] >= this.sc[1] ? 0 : 1, mine = this.me ? this.me.team : 0, won = w === mine;
    const rows = [...this.ps].sort((a, b) => ((b.team === w) - (a.team === w)) || (b.k - a.k) || (a.d - b.d)).map(p => ({ name: `${SH_TEAM[p.team].icon} ${p.name}`, value: `🎯 ${p.k} &nbsp; 💀 ${p.d}`, me: p.isMe }));
    const top = [...this.ps].sort((a, b) => b.k - a.k)[0];
    const sub = won
      ? fmt('{@commander}: "ניצחון. עכשיו, מי מסביר לי למה יש חורים בשלט של נתיבות הקטנה?"')
      : fmt('{@harasar}: "הפסד. כולם — מסדר נשק בעוד עשר דקות. כן, גם המנצחים."');
    Arcade.results(`🔫 נתיבות הקטנה · ${this.sc[0]}:${this.sc[1]}`, rows, { sub: `${sub}${top && top.k ? `<br>🎯 הכי הרבה פסילות: <bdi data-raw>${esc(top.name)}</bdi> (${top.k})` : ''}`, img: this.cover, prize: won ? 10 : 3 });
  },
  shout(p, text) {
    if (!p || !p.m) return;
    const line = String(text).replace(/\[([^\/\]]*)\/([^\]]*)\]/g, (_, m, f) => (p.female ? f : m));
    Scene3D.setBubble(p.m, fmt(line), 2.6);
    clearTimeout(p.bubbleT);
    p.bubbleT = setTimeout(() => { if (p.m) Scene3D.setBubble(p.m, null); }, 2200);
    // Teammates (and anyone close) are heard over the radio.
    if (this.me && (p.team === this.me.team || Math.hypot(p.x - this.me.x, p.z - this.me.z) < 10)) Arcade.say(`<b><bdi data-raw>${esc(p.name)}</bdi>:</b> ${esc(fmt(line))}`, null, 2000);
  },

  // ---------- the bots ----------
  botReset(b) {
    Object.assign(b, { state: 'advance', goal: null, route: null, routeT: 0, know: null, target: null, react: 0, lostT: 0, holdT: 0, burst: 0, pauseT: 0, strafe: 1, strafeT: 0, stuckT: 0, lastX: b.x, lastZ: b.z, aimYaw: b.a, aimPitch: 0, peekT: 0, flank: this.rnd() < 0.3, sawT: -9, thinkT: 0 });
    b.coverT = 0;
  },
  // Someone fired: bots within earshot learn roughly where.
  heard(p) {
    const R = this.hearRange(p);
    for (const b of this.ps) {
      if (!b.bot || !b.alive || b.team === p.team) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (d < R && (!b.know || this.t - b.know.t > 1.5)) b.know = { x: p.x + (Math.random() - 0.5) * 3, z: p.z + (Math.random() - 0.5) * 3, t: this.t, who: p };
    }
  },
  // How far a shot from p carries (a suppressor: much less).
  hearRange(p) { return p.w === 'pistol' ? SH_HEAR : this.wp(p).hear; },
  enemiesOf(b) { return this.ps.filter(e => e.team !== b.team && e.alive); },
  canSee(b, e) {
    const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz);
    if (d > 48) return null;
    let da = Math.atan2(dz, dx) - b.aimYaw; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > 1.25 && d > 5 && !(b.know && b.know.who === e && this.t - b.know.t < 1)) return null;
    if (this.sees(b, e.x, e.y + 1.6, e.z)) return { d, head: true };
    if (this.sees(b, e.x, e.y + 1.1, e.z)) return { d, head: false };
    return null;
  },
  // Picks a spot: hidden from where the enemy is thought to be, not too far, ahead if wanted.
  pickCover(b, from, opts = {}) {
    const dir = b.team === 0 ? 1 : -1;
    let best = null, bs = -1e9;
    for (const c of this.covers) {
      const dMe = Math.hypot(c.x - b.x, c.z - b.z);
      if (dMe < 1.5 && !opts.here) continue;
      let s = opts.near ? -dMe * 1.2 : -Math.abs(dMe - 8) * 0.4;
      if (from) {
        const dE = Math.hypot(c.x - from.x, c.z - from.z);
        if (dE < 5) continue;
        const hidden = !this.sees({ x: from.x, y: 0, z: from.z }, c.x, 1.0, c.z);
        s += hidden ? 8 : -6;
        if (opts.advance) s += -Math.abs(dE - 12) * 0.5;
      }
      if (opts.advance) s += Math.max(-4, Math.min(6, (c.z - b.z) * dir * 0.5));
      if (opts.flank) s += Math.abs(c.x) > 11 ? 6 : -2;
      if (opts.avoid && Math.hypot(c.x - opts.avoid.x, c.z - opts.avoid.z) < 3) s -= 10;
      for (const o of this.ps) if (o !== b && o.bot && o.goal && Math.hypot(o.goal.x - c.x, o.goal.z - c.z) < 2.5) s -= 6;
      s += this.rnd() * 3;
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  },
  goTo(b, g) {
    b.goal = g ? { x: g.x, z: g.z } : null;
    b.route = g ? this.path(b.x, b.z, g.x, g.z) : null;
    b.routeT = 0;
  },
  // One bot, each frame: see, decide, move, aim, shoot.
  bot(b, dt, live) {
    if (!b.alive) { b.deadT += dt; return; }
    if (!live) { this.move(b, 0, 0, false, dt); return; }
    // Seeing: the nearest visible enemy.
    let seen = null, sd = 1e9;
    for (const e of this.enemiesOf(b)) { const v = this.canSee(b, e); if (v && v.d < sd) { sd = v.d; seen = e; seen._head = v.head; } }
    if (seen) {
      if (b.target !== seen) { b.target = seen; b.react = (0.62 - 0.4 * b.skill) + this.rnd() * 0.2 + (this.t - b.sawT > 3 ? 0.12 : 0); }
      b.lostT = 0; b.sawT = this.t; b.know = { x: seen.x, z: seen.z, t: this.t, who: seen };
    } else if (b.target) { b.lostT += dt; if (b.lostT > 0.7 || !b.target.alive) b.target = null; }
    else {
      // Footsteps: someone running close by (or walking very close) is heard.
      for (const e of this.enemiesOf(b)) {
        const d = Math.hypot(e.x - b.x, e.z - b.z), sp = Math.hypot(e.vx || 0, e.vz || 0);
        if ((sp > 5.5 && d < 14) || (sp > 2 && d < 6)) { if (!b.know || this.t - b.know.t > 2) b.know = { x: e.x, z: e.z, t: this.t, who: e }; }
      }
    }
    b.react = Math.max(0, b.react - dt);
    // Hurt and low: back to cover to heal.
    // (Not when they're winning the duel: an enemy in sight who is hurt worse gets finished.)
    const losing = !b.target || b.target.hp > b.hp + 20 || Math.hypot(b.target.x - b.x, b.target.z - b.z) > 14;
    if (b.hp < 38 && b.state !== 'retreat' && this.t - (b.hurtT || -9) < 2.5 && losing) {
      b.state = 'retreat'; b.holdT = 0;
      this.goTo(b, this.pickCover(b, b.know || b.target, { near: true }));
      if (this.rnd() < 0.5) this.shout(b, pick(SH_LINES.cover));
    }
    let ix = 0, iy = 0, run = false;
    // Decide.
    if (b.state === 'retreat') {
      if (b.hp > 72 || (b.target && Math.hypot(b.target.x - b.x, b.target.z - b.z) < 7) || this.t - (b.hurtT || 0) > 9) { b.state = 'hold'; b.holdT = 0.8; }
    } else if (b.target && b.react <= 0) b.state = 'fight';
    else if (b.state === 'fight' && !b.target) {
      // Lost them: wait a moment watching the corner, then go and look.
      b.state = 'hold'; b.holdT = 0.8 + this.rnd() * 1.2; b.goal = null; b.route = null;
    }
    if (b.state === 'hold') {
      b.holdT -= dt;
      // Peek: a step to the side toward where they were.
      if (b.know && this.t - b.know.t < 6) { b.peekT -= dt; if (b.peekT <= 0) { b.peekT = 1 + this.rnd() * 1.5; b.strafe = -b.strafe; } ix = b.strafe * 0.6; }
      if (b.holdT <= 0) { b.state = 'advance'; b.goal = null; }
    }
    if (b.state === 'advance' && (!b.goal || !b.route)) {
      const late = this.t > 32;
      let goal = null;
      if (late) {
        // Late in the round: they "hear footsteps" and go for whoever is left.
        const e = this.enemiesOf(b).sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z))[0];
        if (e) goal = { x: e.x + (this.rnd() - 0.5) * 3, z: e.z + (this.rnd() - 0.5) * 3 };
      } else if (b.know && this.t - b.know.t < 10) goal = this.pickCover(b, b.know, { advance: true, flank: b.flank });
      else goal = this.pickCover(b, null, { advance: true, flank: b.flank });
      if (b.flank && goal && Math.abs(goal.x) > 11 && this.rnd() < 0.35) this.shout(b, pick(SH_LINES.flank));
      this.goTo(b, goal);
      if (!b.route) { b.state = 'hold'; b.holdT = 0.5; }
    }
    // Moving along the route (advance / retreat / and drifting while fighting).
    let walking = null;
    if ((b.state === 'advance' || b.state === 'retreat') && b.route && b.route.length) {
      // Skip ahead to the furthest point in a straight line.
      while (b.route.length > 1 && this.clearWalk(b.x, b.z, b.route[1].x, b.route[1].z) && Math.hypot(b.route[1].x - b.x, b.route[1].z - b.z) < 9) b.route.shift();
      const w = b.route[0], dx = w.x - b.x, dz = w.z - b.z, d = Math.hypot(dx, dz);
      const last = b.route.length === 1;
      if (d < (last ? 0.8 : 0.6)) { b.route.shift(); if (!b.route.length) { b.holdT = b.state === 'retreat' ? 4 : 0.8 + this.rnd() * 1.6; b.state = 'hold'; b.goal = null; } }
      else {
        // World direction → input in the bot's facing.
        const ux = dx / d, uz = dz / d, fx = Math.cos(b.a), fz = Math.sin(b.a);
        // Slowing down for the last metre, so they stop at the spot instead of circling it.
        const slow = last ? Math.min(1, 0.35 + d / 1.6) : 1;
        iy = (ux * fx + uz * fz) * slow; ix = (ux * -fz + uz * fx) * slow; walking = w;
        run = b.state === 'retreat' || (!b.target && d > 4);
      }
      // Stuck: a new route.
      b.stuckT += dt;
      if (b.stuckT > 1) { const moved = Math.hypot(b.x - b.lastX, b.z - b.lastZ); b.stuckT = 0; b.lastX = b.x; b.lastZ = b.z; if (moved < 0.4) { b.goal = null; b.route = null; if (b.state === 'retreat') { b.state = 'hold'; b.holdT = 1; } } }
    }
    if (b.state === 'fight' && b.target) {
      // Strafe side to side while shooting; sometimes step back into cover.
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeT = 0.5 + this.rnd() * 0.9; b.strafe = this.rnd() < 0.5 ? -1 : 1; b.stop = this.rnd() < 0.35; }
      if (!b.stop) ix = b.strafe * 0.75;
      const d = Math.hypot(b.target.x - b.x, b.target.z - b.z);
      if (d > 22) iy = 0.5; else if (d < 4) iy = -0.5;
    }
    // Aim: toward where the enemy is (or was), at the turning speed of their skill.
    let wantYaw = b.aimYaw, wantPitch = 0;
    const tg = b.target || (b.know && this.t - b.know.t < 4 ? b.know : null);
    if (tg) {
      const ty = (tg.y || 0) + (b.target && b.target._head && b.skill > 0.75 && this.rnd() < 0.02 ? 1.6 : 1.25);
      wantYaw = Math.atan2(tg.z - b.z, tg.x - b.x);
      wantPitch = Math.atan2(ty - (b.y + SH_EYE), Math.hypot(tg.x - b.x, tg.z - b.z));
    } else if (walking) wantYaw = Math.atan2(walking.z - b.z, walking.x - b.x);
    let dy = wantYaw - b.aimYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const turn = (2.2 + b.skill * 3.5) * dt;
    b.aimYaw += Math.max(-turn, Math.min(turn, dy));
    b.aimPitch += (wantPitch - b.aimPitch) * Math.min(1, dt * 6);
    b.a = b.aimYaw; b.pitch = b.aimPitch;
    // A grenade close by: away from it, running.
    const nd = this.nades.find(n => Math.hypot(n.x - b.x, n.z - b.z) < 5.5 && n.t > 0.4);
    if (nd) {
      const ax = b.x - nd.x, az = b.z - nd.z, al = Math.hypot(ax, az) || 1, fx = Math.cos(b.a), fz = Math.sin(b.a);
      iy = (ax * fx + az * fz) / al; ix = (ax * -fz + az * fx) / al; run = true;
    }
    // Throwing one: at where an enemy is hiding (seen or heard lately), now and then.
    if (b.nadeN > 0 && this.t > 3 && b.state !== 'retreat' && b.know && this.t - b.know.t < 3 && b.reloadT <= 0) {
      const D = Math.hypot(b.know.x - b.x, b.know.z - b.z);
      if (D > 7 && D < 24 && this.rnd() < dt * (b.target ? 0.12 : 0.4)) this.throwNade(b, { x: b.know.x, z: b.know.z });
    }
    b.sprint = run && (!b.target || !!nd);
    this.move(b, ix, iy, b.sprint, dt);
    // Shoot.
    if (b.target && b.react <= 0 && (b.state === 'fight' || b.state === 'retreat')) {
      const W = this.wp(b), a = b.ammo[b.w];
      if (a[0] <= 0 && b.reloadT <= 0) { if (!this.reload(b) && b.w === 'rifle') this.swap(b, 'pistol'); }
      else if (Math.abs(dy) < 0.09 && b.pauseT <= 0) {
        const d = Math.hypot(b.target.x - b.x, b.target.z - b.z);
        const extra = (1 - b.skill) * 0.05 + Math.min(0.02, d * 0.0006) + (b.hp < 40 ? 0.01 : 0);
        if (b.cool <= 0 && b.reloadT <= 0 && b.drawT <= 0.05) {
          a[0]--; b.cool = W.auto ? W.rate * (1.1 + this.rnd() * 0.4) : W.burst ? (b.burst % W.burst === W.burst - 1 ? W.burstGap + this.rnd() * 0.15 : W.rate) : 0.32 + this.rnd() * 0.2;
          this.fire(b, { yaw: b.aimYaw, pitch: b.aimPitch, extra });
          b.burst++;
          if (b.burst >= 3 + Math.floor(this.rnd() * 5)) { b.burst = 0; b.pauseT = 0.25 + this.rnd() * 0.5; }
        }
      }
      b.pauseT -= dt;
    } else if (b.reloadT <= 0 && b.ammo[b.w][0] < this.wp(b).mag * 0.4 && !b.target) this.reload(b);
    // Back to the rifle when calm.
    if (b.w === 'pistol' && !b.target && b.ammo.rifle[0] + b.ammo.rifle[1] > 0 && b.reloadT <= 0) this.swap(b, 'rifle');
  },

  // ---------- online ----------
  // A guest: everything the host decides (slots, round, HP, kills), and the other players.
  follow(dt) {
    const h = Arcade.others().find(o => o.host), s = h && h.s && h.s.H;
    const now = performance.now();
    if (!s) { if (this.slots && now - this.lastHost > 8000 && !this.over) { UI.toast('המארח יצא מהמשחק', 'bad'); this.finish(); } return; }
    this.lastHost = now;
    if (!this.slots && Array.isArray(s.sl) && s.sl.length) { this.adoptSlots(s.sl); }
    if (!this.slots) return;
    // The round.
    if (s.rd !== this.rd || (s.ph === 'cd' && this.st !== 'cd' && this.st !== 'live')) {
      if (s.ph === 'cd' || s.ph === 'live') this.startRound(s.rd, Math.max(300, (s.cd || 0) * 1000));
    }
    if (s.ph === 'live' && this.st === 'cd' && !Arcade.cdAt) this.st = 'live';
    if (s.ph === 'post' && this.st !== 'post') { this.st = 'post'; this.sc = s.sc.slice(); this.roundFx(s.rw, null); }
    if (s.ph === 'over' && !this.over) { this.sc = s.sc.slice(); this.finish(); }
    if (Array.isArray(s.sc)) this.sc = s.sc.slice();
    if (s.t != null && Math.abs(s.t - this.t) > 1.5) this.t = s.t;
    // Health, kills and deaths.
    (s.hp || []).forEach((hp, i) => { const p = this.ps[i]; if (p) p.hp = hp; });
    (s.k || []).forEach((k, i) => { const p = this.ps[i]; if (p) { p.k = k; p.d = (s.d || [])[i] || 0; } });
    for (const [id, v, a, d, hs] of s.hits || []) {
      const key = 'h' + id; if (this.seen.has(key)) continue; this.seen.add(key);
      const V = this.ps[v], A = this.ps[a];
      if (V && A && (V.isMe)) this.onHit(V, A, d, !!hs);
    }
    for (const [id, k, v, hs, w] of s.kf || []) {
      const key = 'k' + id; if (this.seen.has(key)) continue; this.seen.add(key);
      const K = this.ps[k], V = this.ps[v];
      if (K && V && V.alive) { K.w = w ? 'pistol' : 'rifle'; this.onKill(K, V, !!hs); }
    }
    // Money, armour, grenades; the bots' rifles.
    this.ps.forEach((p, i) => {
      if (s.$) p.cash = s.$[i] || 0;
      if (s.ar) p.armor = s.ar[i] || 0;
      if (s.hm) p.helmet = !!s.hm[i];
      if (s.gn) p.nadeN = s.gn[i] || 0;
      if (p.remoteBot && s.gu && s.gu[i] >= 0) this.setLoadout(p, SH_GUNS[s.gu[i]] || 'm16', this.attFrom((s.gs || [])[i], (s.ga || [])[i] || 0));
    });
    // Grenades: new ones appear (caught up to their age); one gone from the host's list went off.
    const gl = s.gr || [], ids = new Set(gl.map(r => r[0]));
    for (const [id, si, x, y, z, vx, vy, vz, t] of gl) {
      if (this.seen.has('n' + id)) continue; this.seen.add('n' + id);
      const n = this.spawnNade(si, { x, y, z }, { x: vx, y: vy, z: vz }, id);
      n.t = t;
    }
    for (const n of this.nades) if (!ids.has(n.id) && !n.boom && n.t > 0.3) this.explode(n);
    // The bots' bodies.
    (s.b || []).forEach(r => { const p = this.ps[r[0]]; if (p && p.remoteBot) p.net = { x: r[1], z: r[2], y: r[3], a: r[4], pitch: r[5], w: r[6] ? 'pistol' : 'rifle', rl: !!r[7] }; });
    // A dead player (from the host) who is alive here falls; everyone respawns with the round.
    for (const p of this.ps) if (p.alive && p.hp <= 0 && this.st === 'live') this.onKill(p, p, false);
  },
  // Shots someone else fired (their own, or the host's bots'): effects, and on the host, damage.
  otherShots(peer, list) {
    for (const r of list || []) {
      const [id, s, w, ox, oy, oz, ex, ey, ez, v, hs] = r;
      const key = peer + ':' + id;
      if (this.seen.has(key)) continue; this.seen.add(key);
      const p = this.ps[s];
      if (!p || p.isMe) continue;
      p.w = w ? 'pistol' : 'rifle';
      const victim = v >= 0 ? this.ps[v] : null;
      // Where it hit (and which way that wall faces), worked out here.
      const dx = ex - ox, dy = ey - oy, dz = ez - oz, L = Math.hypot(dx, dy, dz) || 1;
      const wall = victim ? null : this.rayStatic({ x: ox, y: oy, z: oz }, { x: dx / L, y: dy / L, z: dz / L }, L + 0.3);
      this.shotFx(p, { o: [ox, oy, oz], e: [ex, ey, ez], w }, victim ? { who: victim } : wall);
      if (this.host && victim) {
        // The referee: the shooter is alive and where it says, and nothing solid is in the way.
        const ok = p.alive && victim.alive && Math.hypot(ox - p.x, oz - p.z) < 4 && this.sees({ x: ox, y: oy - SH_EYE, z: oz }, ex, ey, ez) && Math.hypot(ex - victim.x, ez - victim.z) < 2.2;
        if (ok) this.damage(victim, p, this.shotDmg(p, this.wp(p), L), !!hs);
      }
      if (this.host) this.heard(p);
    }
  },
  // Everyone's shots (on the host they also count).
  netShots() {
    if (!this.ctx || this.ctx.solo) return;
    for (const o of Arcade.others()) {
      if (!o.s) continue;
      if (o.s.sh) this.otherShots(o.peer, o.s.sh);
      if (!this.host || !this.slots) continue;
      // A guest's buys and throws: the host checks and does them.
      const p = this.ps.find(q => !q.bot && !q.isMe && q.who === o.who);
      if (!p) continue;
      for (const [id, it] of o.s.rq || []) { const key = 'b' + o.peer + ':' + id; if (this.seen.has(key)) continue; this.seen.add(key); this.buy(p, it, true); }
      for (const [id, ox, oy, oz, vx, vy, vz] of o.s.th || []) {
        const key = 'g' + o.peer + ':' + id; if (this.seen.has(key)) continue; this.seen.add(key);
        if (p.alive && p.nadeN > 0 && this.st === 'live' && Math.hypot(ox - p.x, oz - p.z) < 4 && Math.hypot(vx, vy, vz) < 30) { p.nadeN--; this.spawnNade(p.i, { x: ox, y: oy, z: oz }, { x: vx, y: vy, z: vz }); }
      }
    }
  },
  // Another human: lerp toward what they report.
  remote(p, dt) {
    let s = null;
    if (p.remoteBot) s = p.net;
    else { const o = Arcade.others().find(q => q.who === p.who); s = o && o.s; }
    if (!s || s.x == null) return;
    const k = Math.min(1, dt * 12);
    const px = p.x, pz = p.z;
    p.x += (s.x - p.x) * k; p.z += (s.z - p.z) * k; p.y += ((s.y || 0) - p.y) * k;
    let da = (s.a || 0) - p.a; da = Math.atan2(Math.sin(da), Math.cos(da)); p.a += da * k;
    const tp = (s.pitch != null ? s.pitch : s.p) || 0;
    p.pitch += (tp - p.pitch) * k;
    if (s.w != null) p.w = s.w === 1 || s.w === 'pistol' ? 'pistol' : 'rifle';
    p.vx = (p.x - px) / Math.max(dt, 1e-3); p.vz = (p.z - pz) / Math.max(dt, 1e-3);
    p.onGround = p.y < 0.05 || Math.abs(p.y - this.floorAt(p.x, p.z, p.y)) < 0.1;
    if (s.rl && !p.netReload) this.reloadSound(p, this.wp(p), false);
    p.netReload = !!s.rl;
    p.ads = !!s.ad;
    if (!p.remoteBot && s.g != null) this.setLoadout(p, SH_GUNS[s.g] || 'm16', this.attFrom(s.o, s.at || 0));
  },
  // Someone's rifle and fitting from the network: re-armed when it changed.
  setLoadout(p, gun, a) {
    if (gun === p.gun && this.attKey(a) === this.attKey(p.att)) return;
    p.gun = gun; p.att = a; this.armSoldier(p);
  },
  presence() {
    const me = this.me, r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;
    const now = performance.now();
    const out = {};
    if (me) Object.assign(out, { x: r1(me.x), z: r1(me.z), y: r1(me.y), a: r2(me.a), p: r2(me.pitch), w: me.w === 'pistol' ? 1 : 0, rl: me.reloadT > 0 ? 1 : 0 });
    // One more flag while you aim, so the others see the gun at your eye; your rifle and sight.
    if (me && me.alive && me.ads) out.ad = 1;
    if (me) { out.g = SH_GUNS.indexOf(me.gun); const a = this.att(me.att); if (a.o) out.o = a.o; if (this.attBits(a)) out.at = this.attBits(a); }
    const pack = (list) => list.filter(s => now - s.at < 600).slice(-10).map(s => [s.id % 100000, s.s, s.w, ...s.o.map(r1), ...s.e.map(r1), s.v, s.hs]);
    if (this.host) {
      this.botShots = this.botShots.filter(s => now - s.at < 600);
      this.hits = this.hits.filter(h => now - h.at < 1200);
      this.kf = this.kf.filter(k => now - k.at < 3000);
      out.sh = pack(this.botShots);
      out.H = {
        ph: this.over ? 'over' : this.st, rd: this.rd, t: Math.round(this.t), sc: this.sc, rw: this.roundWin,
        cd: Arcade.cdAt ? Math.max(0, Math.round((Arcade.cdAt - now) / 100) / 10) : 0,
        sl: this.slots ? this.slots.map(s => (s.kind === 'b' ? 'b:' : 'h:') + s.who) : null,
        hp: this.ps.map(p => Math.ceil(p.hp)), k: this.ps.map(p => p.k), d: this.ps.map(p => p.d),
        hits: this.hits.slice(-6).map(h => [h.id, h.v, h.a, h.d, h.hs]),
        kf: this.kf.slice(-4).map(k => [k.id, k.k, k.v, k.hs, k.w]),
        b: this.ps.filter(p => p.bot).map(p => [p.i, r1(p.x), r1(p.z), r1(p.y), r2(p.a), r2(p.pitch), p.w === 'pistol' ? 1 : 0, p.reloadT > 0 ? 1 : 0]),
        // The round's money, armour, helmets, grenades in hand, everyone's rifle and sight.
        $: this.ps.map(p => p.cash || 0), ar: this.ps.map(p => Math.ceil(p.armor || 0)), hm: this.ps.map(p => (p.helmet ? 1 : 0)), gn: this.ps.map(p => p.nadeN || 0),
        gu: this.ps.map(p => SH_GUNS.indexOf(p.gun)), gs: this.ps.map(p => this.att(p.att).o), ga: this.ps.map(p => this.attBits(p.att)),
        gr: this.nades.filter(n => !n.boom).slice(-5).map(n => [n.id, n.s, r2(n.x), r2(n.y), r2(n.z), r1(n.vx), r1(n.vy), r1(n.vz), r2(n.t)]),
      };
    } else {
      this.myShots = this.myShots.filter(s => now - s.at < 600);
      out.sh = pack(this.myShots);
      // What you asked the host for: buys and throws.
      this.rq = this.rq.filter(r => now - r.at < 2500); this.myThrows = this.myThrows.filter(t => now - t.at < 1500);
      if (this.rq.length) out.rq = this.rq.map(r => [r.id % 100000, r.it]);
      if (this.myThrows.length) out.th = this.myThrows.map(t => [t.id % 100000, r2(t.o.x), r2(t.o.y), r2(t.o.z), r2(t.v.x), r2(t.v.y), r2(t.v.z)]);
    }
    // Keep it under the size a presence may carry: drop the oldest shots first.
    while (JSON.stringify(out).length > 1500 && out.sh.length) out.sh.shift();
    return out;
  },

  // ---------- drawing ----------
  animate(dt) {
    const now = performance.now();
    for (const p of this.ps) {
      const m = p.m;
      const sp = Math.hypot(p.vx || 0, p.vz || 0);
      if (p.isMe) { m.root.visible = false; continue; }
      m.root.visible = true;
      // Body faces where they aim; legs walk at their speed.
      if (p.alive) Arcade.pose(m, p.x, p.z, p.a, sp, dt);
      else { m.root.position.x = p.x; m.root.position.z = p.z; if (m.mixer) m.mixer.update(dt * 0.3); }
      m.root.position.y = p.y;
      if (m.tag) m.tag.visible = p.alive;
      this.wearing(p);
      // The gun: at the shoulder, pitched with the aim, lowered while sprinting or reloading.
      const W = this.wp(p);
      for (const k of SH_WK) if (m.guns && m.guns[k]) m.guns[k].visible = k === p.w && p.alive;
      if (m.gunMount) {
        const low = (p.reloadT > 0 || p.netReload) ? 0.5 : p.sprint ? 0.35 : 0;
        // Aiming (another player online): the gun up at the eye, in front of the face.
        p.adsK = Math.max(0, Math.min(1, (p.adsK || 0) + (p.ads && p.alive && !low ? 1 : -1) * dt / (W.adsT || SH_ADS_T)));
        const ak = p.adsK * p.adsK * (3 - 2 * p.adsK), r = p.w === 'rifle', fwd = r ? (0.03 - this.wp(p).grip[1]) * 0.75 : 0;
        m.gunMount.position.set((r ? 0.32 : 0.42) + fwd + ak * (r ? -0.04 : 0.1), 1.36 - low * 0.25 + ak * (r ? 0.12 : 0.16), 0.1 - ak * (r ? 0.06 : 0.1));
        m.gunMount.rotation.set(0, p.w === 'pistol' ? -0.05 * (1 - ak) : 0, (p.alive ? p.pitch : 0) - low);
      }
      if (m.guns && m.guns.rifle) this.legs(m.guns.rifle, W.bipod && p.ads && sp < 0.6 && p.alive, dt);
      if (p.alive && m.bones && m.bones.RightArm) this.aimPose(p);
      // Muzzle flash.
      if (m.flash) { m.flash.visible = m.flashN > 0; if (m.flashN > 0) { m.flash.material.map = this.flashTex[2 - m.flashN]; m.flashN--; } }
      // Falling over when out.
      if (!p.alive) {
        p.fall = Math.min(1, (p.fall || 0) + dt * 2.6);
        const L = m.lean || m.root, e = p.fall * p.fall;
        L.rotation.z = e * 1.5 * p.fallDir;
      }
      void W; void now;
    }
    // Shot effects.
    if (this.flashLight.intensity > 0) this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 40);
    for (const t of this.tracers) {
      t.t += dt;
      const head = Math.min(t.L, t.t * 220), len = Math.min(3.5, head);
      t.m.position.set(t.x0 + t.dx * (head - len), t.y0 + t.dy * (head - len), t.z0 + t.dz * (head - len));
      t.m.scale.set(1, 1, Math.max(0.01, len));
      t.m.material.opacity = head >= t.L ? Math.max(0, 0.9 - (t.t - t.L / 220) * 12) : 0.9;
    }
    this.tracers = this.tracers.filter(t => { if (t.m.material.opacity > 0.01) return true; this.scene.remove(t.m); t.m.material.dispose(); return false; });
    for (const f of this.fx) {
      f.t += dt;
      f.vy -= f.g * dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
      const k = f.t / f.life;
      if (f.spark) { f.m.material.opacity = 1 - k; }
      else { f.m.material.opacity = Math.max(0, 0.6 * (1 - k)); f.m.scale.setScalar(f.s * (1 + k * 2)); }
    }
    this.fx = this.fx.filter(f => { if (f.t < f.life) return true; this.scene.remove(f.m); f.m.material.dispose(); return false; });
    // Damage numbers: up and out, the same size on screen whatever the distance.
    const zoom = Math.tan(this.camera.fov * Math.PI / 360) / Math.tan(SH_FOV * Math.PI / 360);
    for (const n of this.nums) {
      n.t += dt; n.m.position.y += dt * 0.9;
      const k = n.t / 0.9, d = this.camera.position.distanceTo(n.m.position), sc = d * 0.06 * zoom * (n.head ? 1.25 : 1) * (1 + Math.max(0, 0.25 - n.t) * 1.6);
      n.m.scale.set(sc, sc / 2, 1); n.m.material.opacity = Math.max(0, 1 - k * k);
    }
    this.nums = this.nums.filter(n => { if (n.t < 0.9) return true; this.scene.remove(n.m); n.m.material.map.dispose(); n.m.material.dispose(); return false; });
  },
  // The vest on the chest (between the hips and the head) and the helmet on the head, turned and
  // tipped with the body, sized with the soldier.
  wearing(p) {
    const m = p.m, V = THREE.Vector3;
    const on = { vest: (p.armor || 0) > 0 && !!m.vest, helm: !!p.helmet && !!m.helm };
    if (m.vest) m.vest.visible = on.vest;
    if (m.helm) m.helm.visible = on.helm;
    // (The bought helmet takes the place of the plain one they all wear.)
    if (m.helmet) m.helmet.visible = !on.helm;
    if (!(on.vest || on.helm) || !m.headBone || !m.hipBone) return;
    m.root.updateMatrixWorld(true);
    const body = m.lean || m.root, q = body.getWorldQuaternion(new THREE.Quaternion()), rs = m.root.scale.x;
    const up = new V(0, 1, 0).applyQuaternion(q), fwd = new V(1, 0, 0).applyQuaternion(q);
    const head = m.headBone.getWorldPosition(new V()), hip = m.hipBone.getWorldPosition(new V());
    if (on.vest) { const W = SH_WEAR.vest; m.vest.position.copy(hip).lerp(head, W.up).addScaledVector(fwd, W.fwd * rs); m.vest.quaternion.copy(q); m.vest.scale.setScalar(W.s * rs); }
    if (on.helm) { const W = SH_WEAR.helm; m.helm.position.copy(head).addScaledVector(up, W.up * rs).addScaledVector(fwd, W.fwd * rs); m.helm.quaternion.copy(q); m.helm.scale.setScalar(W.s * rs); }
  },
  // Arms reach for the gun: two-bone IK for each arm toward the grip and the handguard.
  aimPose(p) {
    const m = p.m, B = m.bones, g = m.guns && m.guns[p.w];
    if (!g || !B.RightArm || !B.RightForeArm || !B.RightHand) return;
    m.root.updateMatrixWorld(true);
    const V = THREE.Vector3;
    const W = this.wp(p), rf = p.w === 'rifle';
    const grip = g.localToWorld(new V(0, rf ? W.grip[0] + 0.02 : -0.035, rf ? W.grip[1] : -0.05));
    const fa = rf && g.userData.foreAt;
    const fore = g.localToWorld(fa ? new V(0, fa[0] + 0.02, fa[1] - 0.01) : new V(0, rf ? W.fore[0] + 0.02 : -0.04, rf ? W.fore[1] - 0.02 : -0.04));
    const side = new V(-Math.sin(p.a), 0, Math.cos(p.a));
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
    // The elbow: on the plane of the target and the hint, at the right distance.
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const perp = hint.clone().sub(dir.clone().multiplyScalar(hint.dot(dir))).normalize();
    const elbow = a.clone().addScaledVector(dir, cosA * l1).addScaledVector(perp, sinA * l1);
    const aim = (bone, from, to, cur) => {
      const want = to.clone().sub(from).normalize(), have = cur.clone().sub(from).normalize();
      const q = new Q().setFromUnitVectors(have, want);
      const bw = bone.getWorldQuaternion(new Q()), pw = bone.parent.getWorldQuaternion(new Q());
      bone.quaternion.copy(pw.invert().multiply(q.multiply(bw)));
      bone.updateMatrixWorld(true);
    };
    aim(upper, a, elbow, b);
    const b2 = lower.getWorldPosition(new V()), c2 = hand.getWorldPosition(new V());
    aim(lower, b2, a.clone().addScaledVector(dir, d), c2);
  },
  // Before the teams are picked: a slow look over the square.
  idleCam(dt) {
    const t = performance.now() / 1000, c = this.camera;
    c.position.set(Math.cos(t * 0.1) * 24, 11, Math.sin(t * 0.1) * 24); c.lookAt(0, 1, 0);
    void dt;
  },
  // The world camera's zoom: the hip's, or the sight's while the gun is up.
  setFov(dt) {
    const me = this.me, W = me && this.wp(me), k = me && me.alive ? (me.adsK || 0) : 0, e = k * k * (3 - 2 * k);
    const want = W ? SH_FOV + (W.ads.fov - SH_FOV) * e : SH_FOV;
    this.fovNow += (want - this.fovNow) * Math.min(1, dt * 30);
    if (Math.abs(this.fovNow - want) < 0.01) this.fovNow = want;
    const c = this.camera;
    if (Math.abs(c.fov - this.fovNow) > 0.001) { c.fov = this.fovNow; c.updateProjectionMatrix(); }
  },
  camUpdate(dt) {
    const c = this.camera, me = this.me;
    this.setFov(dt);
    if (!me) { this.spectate(dt); return; }
    if (!me.alive) {
      // Down: the camera sinks and tilts; after a moment, watch a teammate.
      if (me.deadT < 2.2 || !this.ps.some(p => p.alive && p.team === me.team) && me.deadT < 3.5) {
        const k = Math.min(1, me.deadT / 0.7), e = 1 - (1 - k) * (1 - k);
        c.position.set(me.x, me.y + SH_EYE - e * 1.35, me.z);
        const yaw = this.look.yaw, pit = this.look.pitch * (1 - e) - e * 0.25;
        c.up.set(-Math.sin(yaw) * Math.sin(e * 0.9), Math.cos(e * 0.9), Math.cos(yaw) * Math.sin(e * 0.9));
        c.lookAt(c.position.x + Math.cos(yaw) * Math.cos(pit), c.position.y + Math.sin(pit), c.position.z + Math.sin(yaw) * Math.cos(pit));
        return;
      }
      c.up.set(0, 1, 0);
      this.spectate(dt);
      return;
    }
    c.up.set(0, 1, 0);
    // Head bob while walking.
    const sp = Math.hypot(me.vx, me.vz);
    this.bob = (this.bob || 0) + dt * sp * 1.9;
    const bob = me.onGround ? Math.sin(this.bob * 2) * 0.03 * Math.min(1, sp / 4) : 0;
    c.position.set(me.x, me.y + SH_EYE + bob, me.z);
    if (G.shake > 0) { c.position.x += (Math.random() - 0.5) * G.shake * 0.3; c.position.y += (Math.random() - 0.5) * G.shake * 0.3; G.shake = Math.max(0, G.shake - dt); }
    const yaw = this.look.yaw, pit = this.look.pitch;
    c.lookAt(c.position.x + Math.cos(yaw) * Math.cos(pit), c.position.y + Math.sin(pit), c.position.z + Math.sin(yaw) * Math.cos(pit));
    this.viewModel(dt);
  },
  // Watching someone else: over their shoulder, the same way they look.
  spectate(dt) {
    const c = this.camera;
    const pool = this.ps.filter(p => p.alive && (!this.me || p.team === this.me.team));
    const list = pool.length ? pool : this.ps.filter(p => p.alive);
    if (!list.length) return;
    if (!this.spec || !this.spec.alive || !list.includes(this.spec)) this.spec = list[0];
    const s = this.spec;
    const want = new THREE.Vector3(s.x - Math.cos(s.a) * 2.6 - Math.sin(s.a) * 0.6, s.y + 2.3, s.z - Math.sin(s.a) * 2.6 + Math.cos(s.a) * 0.6);
    c.position.lerp(want, Math.min(1, dt * 6));
    c.lookAt(s.x + Math.cos(s.a) * 6, s.y + 1.4 + Math.sin(s.pitch || 0) * 6, s.z + Math.sin(s.a) * 6);
  },
  nextSpec() {
    const list = this.ps.filter(p => p.alive);
    if (!list.length) return;
    const i = list.indexOf(this.spec);
    this.spec = list[(i + 1) % list.length];
  },
  // Your gun in the corner: sway, bob, recoil, reload and draw.
  viewModel(dt) {
    const me = this.me, W = this.wp(me), g = this.vmGun(me);
    for (const k in this.vmGuns) this.vmGuns[k].visible = this.vmGuns[k] === g;
    if (!g) return;
    const t = performance.now() / 1000, sp = Math.hypot(me.vx, me.vz);
    this.kick = Math.max(0, (this.kick || 0) - dt * 9);
    const k = this.kick * this.kick;
    const hip = W.hip || [0.14, -0.13, -0.36];
    let x = hip[0], y = hip[1], z = hip[2];
    let rx = 0.02, ry = me.w === 'rifle' ? 0.05 : 0.04, rz = 0;
    // Aiming: the gun slides in to the middle until the sight's eye point is right on the axis of
    // the camera, the sight eye.d in front of it (the gun is turned round, so local x and z flip).
    const ak = me.adsK || 0, e = ak * ak * (3 - 2 * ak), eye = g.userData.eye, calm = 1 - 0.85 * e;
    if (eye && e > 0) {
      x += (eye.x - x) * e; y += (-eye.y - y) * e; z += (eye.z - eye.d - z) * e;
      rx *= 1 - e; ry *= 1 - e;
    }
    // Idle sway and the walk (much less through the sight).
    x += Math.sin(t * 1.3) * 0.003 * calm; y += Math.sin(t * 1.9) * 0.003 * calm;
    if (me.onGround) { x += Math.sin(this.bob || 0) * 0.012 * Math.min(1, sp / 4) * calm; y -= Math.abs(Math.cos(this.bob || 0)) * 0.012 * Math.min(1, sp / 4) * calm; }
    // The look lags behind a turn a little.
    const dyaw = (this.lastYaw != null ? this.look.yaw - this.lastYaw : 0); this.lastYaw = this.look.yaw;
    this.sway = (this.sway || 0) * Math.exp(-dt * 10) + Math.max(-0.04, Math.min(0.04, dyaw)) * 0.5;
    ry -= this.sway * 0.6 * calm; x -= this.sway * 0.15 * calm;
    // Recoil: back and up (through the sight a short hop of the sight that settles back).
    z += k * (me.w === 'rifle' ? 0.05 : 0.04) * (1 - 0.5 * e); rx += k * (me.w === 'rifle' ? 0.08 : 0.2) * (1 - 0.6 * e); y += k * (0.01 - 0.004 * e);
    // Sprinting: lowered and turned in.
    this.sprintK = (this.sprintK || 0) + ((me.sprint ? 1 : 0) - (this.sprintK || 0)) * Math.min(1, dt * 8);
    x -= this.sprintK * 0.04; y -= this.sprintK * 0.05; ry += this.sprintK * 0.7; rx -= this.sprintK * 0.25;
    // Reloading: tipped over, down, the left hand away and back.
    if (me.reloadT > 0) {
      const p = 1 - me.reloadT / W.reload, e = Math.sin(Math.min(1, p) * Math.PI);
      rz += e * 0.7; rx -= e * 0.25; y -= e * 0.06; x -= e * 0.03;
      if (g.userData.lh) g.userData.lh.position.y = g.userData.lhY - Math.sin(Math.min(1, p * 1.6) * Math.PI) * 0.18;
    } else if (g.userData.lh) g.userData.lh.position.y = g.userData.lhY;
    // Through a rifle's sights the left thumb would stick out beside the handguard like a stick.
    if (me.w === 'rifle' && g.userData.lh) g.userData.lh.userData.thumb.visible = e < 0.5;
    // Drawing: up from below.
    if (me.drawT > 0) { const p = me.drawT / W.draw; y -= p * p * 0.3; rx -= p * 0.8; }
    g.position.set(x, y, z);
    g.rotation.set(rx, Math.PI + ry, rz);
    // The bipod swings down when it's doing its job (still, the gun up), and folds when you move.
    this.legs(g, !!this.steady(me, W), dt);
    // Through a 4x (the ACOG, the marksman's scope) the scope overlay takes over: the gun goes.
    this.scoped = me.w === 'rifle' && (W.acog || W.scope) && e > 0.85;
    g.visible = !this.scoped;
    // The flash at the muzzle.
    const mz = g.userData.muzzle.getWorldPosition(new THREE.Vector3());
    const fl = this.vmFlashN > 0;
    this.vmFlash.visible = fl;
    if (fl) { this.vmFlash.material.map = this.flashTex[2 - this.vmFlashN]; this.vmFlashN--; }
    this.vmFlash.position.copy(mz).add(new THREE.Vector3(0, 0, -0.04));
    this.vmFlash.scale.setScalar((me.w === 'rifle' ? 0.2 * (this.vmFlashK || 1) : 0.16) * (1 - 0.45 * e));
    // The gun's own camera closes in a little too, so the sight fills a bit more of the screen.
    const vf = 62 + (W.ads.vm - 62) * e;
    if (Math.abs(this.vmCam.fov - vf) > 0.001) { this.vmCam.fov = vf; this.vmCam.updateProjectionMatrix(); }
    // The holographic reticle: the same size on any screen, brighter when you look through it.
    if (g.userData.dot) {
      const d = g.userData.dot;
      d.scale.setScalar(Math.max(56, innerHeight * 0.085) * 2 * Math.tan(this.vmCam.fov * Math.PI / 360) * eye.d / Math.max(1, innerHeight));
      d.material.opacity = 0.35 + 0.65 * e;
    }
    this.vmLight.position.copy(mz).add(new THREE.Vector3(0, 0.05, -0.15)); this.vmLight.intensity = fl ? 0.9 : 0;
    // The grenade in your hand as you throw it: up from below on the right and away.
    if (!this.vmNade || (this.vmNade.isMesh && Assets.models.prop_nade)) { if (this.vmNade) this.vmScene.remove(this.vmNade); if (!this.nadeGeo) { this.nadeGeo = new THREE.SphereGeometry(0.045, 10, 8); this.nadeGeo.scale(1, 1.25, 1); this.nadeMat = new THREE.MeshStandardMaterial({ color: 0x3e4a2a, roughness: 0.7, metalness: 0.2 }); } this.vmNade = this.nadeModel(); this.vmScene.add(this.vmNade); }
    this.vmNadeT = Math.max(0, (this.vmNadeT || 0) - dt);
    this.vmNade.visible = this.vmNadeT > 0;
    if (this.vmNadeT > 0) { const q = 1 - this.vmNadeT / 0.4; this.vmNade.position.set(0.16 - q * 0.08, -0.2 + Math.sin(q * Math.PI) * 0.16, -0.32 - q * 0.45); this.vmNade.rotation.set(q * 4, 0.4, q * 2); }
    // Shells.
    for (const s of this.shells) { s.t += dt; s.vy -= 6 * dt; s.m.position.x += s.vx * dt * 0.4; s.m.position.y += s.vy * dt * 0.4; s.m.position.z += s.vz * dt * 0.4; s.m.rotation.x += s.r * dt; s.m.rotation.y += s.r * 0.7 * dt; }
    this.shells = this.shells.filter(s => { if (s.t < 0.7) return true; this.vmScene.remove(s.m); return false; });
  },

  // The bipod's legs on a gun: down (in use) or folded forward along the barrel.
  legs(g, down, dt) {
    const b = g && g.userData.bipod;
    if (!b) return;
    const want = down ? 0 : SH_LEGS_UP;
    b.rotation.x += (want - b.rotation.x) * Math.min(1, dt * 10);
  },
  // ---------- input: mouse look (pointer lock), touch look and buttons ----------
  bind() {
    this.unbind();
    const cv = $('#world');
    const L = this.listeners = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); L.push([el, ev, fn, o]); };
    // Through the sight the mouse (or the finger) turns you less, in step with the zoom.
    const sens = () => (Settings.v.sens || 1) * Math.tan(this.fovNow * Math.PI / 360) / Math.tan(SH_FOV * Math.PI / 360);
    const look = (dx, dy, k) => {
      this.look.yaw += dx * k * sens();
      this.look.pitch = Math.max(-1.35, Math.min(1.35, this.look.pitch - dy * k * sens() * (Settings.v.invertY ? -1 : 1)));
      this.lookMoving = 0.15;
    };
    this.drag = new Map();
    // A second mouse button pressed (or let go) while another is held can come only as a
    // pointer move with new buttons, no pointerdown or mousedown (aim with the right button,
    // then the left didn't fire). Every mouse event notes the buttons; a move that changes them acts.
    this.mb = 0;
    const chord = (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.buttons | 0, was = this.mb;
      this.mb = b;
      if (e.type !== 'pointermove' || b === was || !this.slots || this.over || (document.pointerLockElement !== cv && !this.noLock)) return;
      if ((b & 1) && !(was & 1)) this.fireDown(); else if (!(b & 1) && (was & 1)) this.fireUp();
      if ((b & 2) && !(was & 2)) { this.adsHold = true; this.adsTog = false; } else if (!(b & 2) && (was & 2)) this.adsHold = false;
    };
    for (const t of ['pointerdown', 'pointerup', 'pointermove']) on(window, t, chord, true);
    // With the pointer locked, clicks are caught first: the world's own camera drag would try to
    // capture the pointer, which a locked pointer refuses (an error each click).
    on(window, 'pointerdown', (e) => {
      if (document.pointerLockElement !== cv || e.pointerType !== 'mouse') return;
      e.stopPropagation();
      if (!this.slots || this.over) return;
      if (e.button === 0) this.fireDown();
    }, true);
    on(cv, 'pointerdown', (e) => {
      if (!this.slots || this.over) return;
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement !== cv) {
          if (cv.requestPointerLock && !this.noLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => { this.noLock = true; }); } catch (err) { this.noLock = true; } }
          // Without a lock (or until it arrives) a drag looks and the button fires.
          this.drag.set(e.pointerId, { x: e.clientX, y: e.clientY, mouse: true });
          if (this.noLock && e.button === 0) this.fireDown();
          return;
        }
        return;
      }
      // Touch: the right part of the screen looks around; a tap while out switches who you watch.
      if (e.clientX > innerWidth * 0.36) { this.drag.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.me && !this.me.alive) this.nextSpec(); }
    });
    on(window, 'pointermove', (e) => {
      const d = this.drag.get(e.pointerId);
      if (!d) return;
      if (d.mouse && document.pointerLockElement === cv) { this.drag.delete(e.pointerId); return; }
      look(e.clientX - d.x, e.clientY - d.y, e.pointerType === 'touch' ? 0.0065 : 0.005);
      d.x = e.clientX; d.y = e.clientY;
    });
    const up = (e) => { const d = this.drag.get(e.pointerId); this.drag.delete(e.pointerId); if (e.pointerType === 'mouse' && (d || document.pointerLockElement === cv)) this.fireUp(); };
    on(window, 'pointerup', up); on(window, 'pointercancel', up);
    on(document, 'mousemove', (e) => {
      if (document.pointerLockElement !== cv) return;
      // Browsers now and then report a jump of hundreds of pixels (the cursor warping): skip it.
      const mx = e.movementX || 0, my = e.movementY || 0;
      if (Math.abs(mx) > 250 || Math.abs(my) > 250) return;
      look(mx, my, 0.0024);
    });
    on(document, 'mouseup', (e) => {
      if (document.pointerLockElement !== cv && !this.noLock) return;
      if (e.button === 0) this.fireUp();
      if (e.button === 2) this.adsHold = false;
    });
    // The right button holds the sight up. (A second button pressed while one is held comes as a
    // mousedown but not as a pointerdown, so the left one is caught here too in that case.)
    on(document, 'mousedown', (e) => {
      if (!this.slots || this.over || (document.pointerLockElement !== cv && !this.noLock)) return;
      if (e.button === 2) { this.adsHold = true; this.adsTog = false; }
      else if (e.button === 0 && (e.buttons & ~1)) this.fireDown();
    }, true);
    on(window, 'contextmenu', (e) => { if (this.slots && (e.target === cv || document.pointerLockElement === cv)) e.preventDefault(); }, true);
    on(window, 'blur', () => { this.adsHold = false; });
    on(document, 'pointerlockchange', () => { if (document.pointerLockElement !== cv) { this.unlockAt = performance.now(); this.fireUp(); this.adsHold = false; } });
    on(document, 'pointerlockerror', () => { this.noLock = true; });
    on(cv, 'wheel', (e) => {
      e.preventDefault();
      // A trackpad sends a stream of these: one swap per flick.
      const now = performance.now();
      if (Math.abs(e.deltaY) < 4 || now - (this.wheelAt || 0) < 300) return;
      this.wheelAt = now;
      if (this.me && this.me.alive) this.swap(this.me, this.me.w === 'rifle' ? 'pistol' : 'rifle');
    }, { passive: false });
    // Esc with the pointer locked only frees the mouse; it doesn't leave the game.
    on(window, 'keydown', (e) => {
      if (e.code === 'Escape' && (document.pointerLockElement === cv || performance.now() - (this.unlockAt || 0) < 400)) { e.stopImmediatePropagation(); }
    }, true);
    // The phone's buttons.
    const hud = $('#arcade .ar-hud');
    const btn = (sel, down, upFn) => {
      const b = hud.querySelector(sel); if (!b) return;
      on(b, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.unlock(); down(e); if (upFn) { this.drag.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: true }); } });
      if (upFn) for (const ev of ['pointerup', 'pointercancel']) on(b, ev, (e) => { upFn(e); this.drag.delete(e.pointerId); });
    };
    btn('.sh-fire', () => this.fireDown(), () => this.fireUp());
    btn('.sh-reload', () => { if (this.me) this.reload(this.me); });
    btn('.sh-jump', () => this.act());
    btn('.sh-swap', () => { if (this.me) this.swap(this.me, this.me.w === 'rifle' ? 'pistol' : 'rifle'); });
    btn('.sh-ads', () => this.toggleAds());
    btn('.sh-nade', () => { if (this.me) this.throwNade(this.me); });
    hud.querySelectorAll('.sh-bb').forEach(b => on(b, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sound.unlock(); if (this.me) this.buy(this.me, b.dataset.b); }));
  },
  // Z / 🎯: the sight up or down (running puts it down again).
  toggleAds() {
    const me = this.me;
    if (!me || !me.alive || this.over || !this.slots) return;
    this.adsTog = !this.adsTog;
    Sound.synth.tone(this.adsTog ? 700 : 520, 0.03, 'square', 0.025);
  },
  fireDown() { if (this.me && !this.me.alive) { this.nextSpec(); return; } this.trigger = true; this.semiHeld = false; },
  fireUp() { this.trigger = false; this.semiHeld = false; },
  unbind() { for (const [el, ev, fn, o] of this.listeners || []) el.removeEventListener(ev, fn, o); this.listeners = []; },
  lockOff() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* none */ } },

  // ---------- the overlay ----------
  ui() {
    Arcade.hud(`<div class="sh">
      <div class="sh-scope"><div class="sh-lens"><svg class="sh-acogret" viewBox="-100 -100 200 200" aria-hidden="true">
        <path d="M -30 34 A 46 46 0 1 1 30 34" fill="none" stroke="#ff8a1c" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M -9 9 L 0 0 L 9 9" fill="none" stroke="#ff8a1c" stroke-width="3.4" stroke-linejoin="miter"/>
        <path d="M 0 9 V 74 M -7 22 H 7 M -5.5 34 H 5.5 M -4.5 46 H 4.5 M -3.5 58 H 3.5" stroke="#1a1a1a" stroke-width="1.6"/></svg>
        <svg class="sh-snipret" viewBox="-100 -100 200 200" aria-hidden="true"><path d="M -100 0 H -8 M 8 0 H 100 M 0 -100 V -8 M 0 8 V 100" stroke="#111" stroke-width="1.4"/>
        <path d="M -100 0 H -55 M 55 0 H 100 M 0 -100 V -55 M 0 55 V 100" stroke="#111" stroke-width="4"/><circle r="1.6" fill="#d22"/>
        ${[-40, -30, -20, -10, 10, 20, 30, 40].map(k => `<circle cx="${k}" r="1.3" fill="#111"/><circle cy="${k}" r="1.3" fill="#111"/>`).join('')}</svg></div></div>
      <div class="sh-board ar-chip"><span class="sh-b"></span><span class="sh-mid"><b class="sh-rd"></b><i class="sh-t"></i></span><span class="sh-r"></span></div>
      <div class="sh-feed"></div>
      <div class="sh-vig"></div><div class="sh-dirs"></div>
      <div class="sh-cross"><i></i><i></i><i></i><i></i></div><div class="sh-hm">✕</div><div class="sh-dt"></div>
      <div class="sh-hp ar-chip"><span>❤</span><i><b></b></i><em></em></div>
      <div class="sh-ar ar-chip"><span>🛡</span><i><b></b></i><em></em><u class="sh-helm">⛑️</u><u class="sh-nd"></u></div>
      <div class="sh-buy"><div class="sh-bh"><b>🛒 קניות</b> <span class="sh-cash"></span> <i class="sh-bt"></i></div><div class="sh-bi">${SH_BUY.map(it => `<button class="sh-bb pe" data-b="${it.id}">${G.touch ? '' : `<kbd>${it.n}</kbd>`}<img src="${it.img}" alt=""><b>${it.name}</b><em>💵 ${it.price}</em><small>${it.tip}</small></button>`).join('')}</div></div>
      <div class="sh-ammo ar-chip"><b></b><small></small><span class="sh-wn"></span></div>
      <div class="sh-hint"></div>
      ${G.touch ? '<button class="sh-fire pe" aria-label="אש">🔥</button><button class="sh-reload pe" aria-label="מחסנית">🔄</button><button class="sh-jump pe" aria-label="קפיצה">⤒</button><button class="sh-swap pe" aria-label="החלפת נשק"></button><button class="sh-ads pe" aria-label="כוונת">🎯</button><button class="sh-nade pe" aria-label="רימון">💣<small></small></button>' : ''}
    </div>`);
    const h = $('#arcade .sh');
    const q = (s) => h.querySelector(s);
    this.el = { root: h, b: q('.sh-b'), r: q('.sh-r'), rd: q('.sh-rd'), t: q('.sh-t'), feed: q('.sh-feed'), vig: q('.sh-vig'), dirs: q('.sh-dirs'), cross: q('.sh-cross'), hm: q('.sh-hm'), dt: q('.sh-dt'), hp: q('.sh-hp b'), hpn: q('.sh-hp em'), hpBox: q('.sh-hp'), ammo: q('.sh-ammo b'), res: q('.sh-ammo small'), wn: q('.sh-wn'), swap: q('.sh-swap'), ads: q('.sh-ads'), nade: q('.sh-nade'), ar: q('.sh-ar b'), arn: q('.sh-ar em'), arBox: q('.sh-ar'), helm: q('.sh-helm'), nd: q('.sh-nd'), buy: q('.sh-buy'), cash: q('.sh-cash'), bt: q('.sh-bt'), hint: q('.sh-hint'), ammoBox: q('.sh-ammo'), scope: q('.sh-scope') };
    h.classList.toggle('touch', !!G.touch);
    h.classList.add('pre');
  },
  hud() {
    const e = this.el, me = this.me;
    if (!e) return;
    e.root.classList.toggle('pre', !this.slots);
    e.root.classList.toggle('spec', !me);
    const pip = (t) => this.ps.filter(p => p.team === t).map(p => `<s class="${p.alive ? '' : 'out'}${p.isMe ? ' me' : ''}"></s>`).join('');
    const bHtml = `${SH_TEAM[0].icon} <b>${this.sc[0]}</b> ${pip(0)}`, rHtml = `${pip(1)} <b>${this.sc[1]}</b> ${SH_TEAM[1].icon}`;
    if (e.b.innerHTML !== bHtml) e.b.innerHTML = bHtml;
    if (e.r.innerHTML !== rHtml) e.r.innerHTML = rHtml;
    e.rd.textContent = this.rd ? `סיבוב ${this.rd}` : '';
    const left = Math.max(0, this.ROUND - this.t);
    e.t.textContent = this.st === 'live' ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '';
    e.t.classList.toggle('low', this.st === 'live' && left < 15);
    // The kill feed.
    const now = performance.now();
    this.feed = this.feed.filter(f => now - f.at < 6000);
    const fh = this.feed.map(f => { const K = this.ps[f.k], V = this.ps[f.v]; if (!K || !V) return ''; const self = K === V; return `<div class="${K.isMe || V.isMe ? 'mine' : ''}"><bdi data-raw style="color:${SH_TEAM[K.team].css}">${esc(K.name)}</bdi> ${self ? '💀' : f.hs ? '🎯' : (f.w === 'pistol' ? '🔫' : '︻デ═')} ${self ? '' : `<bdi data-raw style="color:${SH_TEAM[V.team].css}">${esc(V.name)}</bdi>`}</div>`; }).join('');
    if (e.feed.innerHTML !== fh) e.feed.innerHTML = fh;
    if (!me) return;
    // Health, armour (and the helmet, the grenades in hand).
    const hp = Math.max(0, Math.ceil(me.hp));
    e.hp.style.width = `${hp}%`; e.hpn.textContent = hp; e.hpBox.classList.toggle('low', hp < 35);
    const ar = Math.max(0, Math.ceil(me.armor || 0));
    e.ar.style.width = `${ar * 2}%`; e.arn.textContent = ar; e.arBox.classList.toggle('none', !ar && !me.helmet);
    e.helm.classList.toggle('hidden', !me.helmet);
    const nd = me.nadeN ? `💣${me.nadeN > 1 ? '×' + me.nadeN : ''}` : '';
    if (e.nd.textContent !== nd) e.nd.textContent = nd;
    if (e.nade) { e.nade.classList.toggle('off', !me.nadeN); e.nade.querySelector('small').textContent = me.nadeN || ''; }
    // The buy phase.
    const buying = this.st === 'cd' && me.alive && !!this.slots && !this.over;
    e.buy.classList.toggle('hidden', !buying);
    if (buying) {
      const cash = `💵 <b>${me.cash || 0}</b>`;
      if (e.cash.innerHTML !== cash) e.cash.innerHTML = cash;
      e.bt.textContent = Arcade.cdAt ? `${Math.max(0, Math.ceil((Arcade.cdAt - now) / 1000))} שנ׳` : '';
      e.buy.querySelectorAll('.sh-bb').forEach(b => { const id = b.dataset.b; b.classList.toggle('no', !this.canBuy(me, id)); b.classList.toggle('have', id === 'vest' ? (me.armor || 0) >= 50 : id === 'helmet' ? !!me.helmet : (me.nadeN || 0) >= SH_NADE.max); });
    }
    // Ammo.
    const a = me.ammo[me.w] || [0, 0];
    e.ammo.textContent = a[0]; e.res.textContent = `/ ${a[1]}`;
    e.wn.textContent = me.reloadT > 0 ? 'מחליף מחסנית…' : this.wp(me).name + (me.w === 'rifle' ? this.attIcons(me.att) : '');
    e.ammoBox.classList.toggle('empty', a[0] === 0);
    if (e.swap) { const o = me.w === 'rifle' ? 'pistol' : 'rifle'; const t = `${this.wp(me).name} ⇄ ${this.wp(me, o).name}`; if (e.swap.textContent !== t) e.swap.textContent = t; }
    // The crosshair opens with the spread.
    const W = this.wp(me);
    const ak = me.adsK || 0;
    const spread = this.spreadOf(me, W);
    const px = spread * (innerHeight / 2) / Math.tan(this.camera.fov * Math.PI / 360);
    e.cross.style.setProperty('--gap', `${Math.round(5 + px)}px`);
    e.cross.classList.toggle('hidden', !me.alive || me.sprint || this.st === 'pick' || this.over || ak > 0.85);
    // Through the sight the crosshair fades out (the dot or the iron sights take over).
    const co = (1 - Math.min(1, ak / 0.85)).toFixed(2);
    if (e.cross.style.opacity !== co) e.cross.style.opacity = co;
    if (e.ads) e.ads.classList.toggle('on', !!(this.adsTog || me.ads));
    // The 4x scope's view: the ACOG's chevron and horseshoe, or the marksman's crosshair.
    const sc = !!(this.scoped && me.alive && this.slots && !this.over);
    e.scope.classList.toggle('on', sc);
    e.scope.classList.toggle('snip', sc && !!W.scope);
    // The hit marker and the damage.
    this.hm = Math.max(0, this.hm - this.dt);
    e.hm.style.opacity = this.hm > 0 ? Math.min(1, this.hm * 6) : 0;
    e.hm.classList.toggle('kill', !!this.hmKill);
    if (e.dt && this.dmgTot && this.t - this.dmgTot.at > 2) { e.dt.classList.remove('show'); this.dmgTot = null; }
    this.dmgFx = Math.max(0, this.dmgFx - this.dt * 0.7);
    const lowHp = me.alive && me.hp < 35 ? 0.25 + Math.sin(now / 180) * 0.08 : 0;
    e.vig.style.opacity = Math.min(1, Math.max(this.dmgFx, lowHp, me.alive ? 0 : 0.5));
    this.dirs = this.dirs.filter(d => (d.t -= this.dt) > 0);
    const dh = this.dirs.map(d => { let r = d.a - me.a; r = Math.atan2(Math.sin(r), Math.cos(r)); return `<i style="transform:rotate(${r.toFixed(3)}rad);opacity:${Math.min(1, d.t).toFixed(2)}"></i>`; }).join('');
    if (e.dirs.innerHTML !== dh) e.dirs.innerHTML = dh;
    // A hint line.
    let hint = '';
    if (!me.alive && this.st === 'live') hint = `👀 צופה ב<bdi data-raw>${esc((this.spec || {}).name || '')}</bdi> · ${G.touch ? 'נגיעה' : 'קליק'} — להחליף`;
    else if (!G.touch && this.slots && !this.over && document.pointerLockElement !== $('#world') && !this.noLock && this.st !== 'pick') hint = '🖱️ קליק על המסך — לנעול את העכבר ולכוון';
    else if (me.alive && a[0] === 0 && a[1] > 0 && me.reloadT <= 0) hint = G.touch ? '🔄 — מחסנית!' : 'R — מחסנית!';
    if (e.hint.innerHTML !== hint) e.hint.innerHTML = hint;
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
    if (this.me && this.me.alive && this.slots && !this.over && this.st !== 'pick') {
      const a = this.camera.aspect;
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
  leave() {
    this.unbind();
    this.lockOff();
    for (const p of this.ps || []) clearTimeout(p.bubbleT);
    this.clear();
    this.slots = null; this.el = null; this.over = false; this.resultsAt = null; this.trigger = false; this.pickT = null;
    this.adsHold = false; this.adsTog = false; this.fovNow = SH_FOV; this.scoped = false;
    if (this.camera) { this.camera.fov = SH_FOV; this.camera.updateProjectionMatrix(); }
  },
};
Arcade.register(ShooterGame);
