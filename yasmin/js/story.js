// The five nights: objectives, items, notes, discoveries and scripted scares.
import * as THREE from 'three';
import { locks, gateClosed, roomAt, toCell, lineOfSight, opaque } from './map.js';
import * as T from './textures.js';
import { TAPE_SPOTS, MAZE_GUIDE, tapeMesh, Ghost, missingPosterTex, loadTapes } from './ruth.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const NIGHTS = [
  null,
  { title: 'הלילה הראשון', text: 'יום חמישי, 23:57.\nכולם יצאו הביתה לסופ״ש. רק אתה נשארת לשמור על הבסיס.\nאתה ו... יסמין, תורנית הניקיון.\nהמפתחות של השער אצלה.\nעל הקיר במסדרון תלויה מודעה ישנה: "נעדרת — רות".' },
  { title: 'דוח צל״ם', text: 'שרדת לילה אחד.\nבבוקר מצאת על המיטה פתק: "בלי דוח צל״ם — אין יציאה הביתה."\nהחתימה: יסמין, ממלאת מקום רס״פ.\nבלילה שמעת מישהי בוכה בתוך הקירות. זה לא היה הקול של יסמין.' },
  { title: 'הפסקת חשמל', text: 'מישהו הוציא את הנתיכים מלוח החשמל.\nבחושך שומעים רק את הגלגלים של הדלי.\nבאגף הבידוד מישהו צוחק, ומישהו סופר.\nרות הייתה שם לפניך. היא השאירה קלטת.' },
  { title: 'מסדר ניקיון', text: '"מסדר ניקיון! כל המסדרון מבריק עד ארבע!"\nהקול מגיע מהרמקולים.\nהיא בטוחה שאתה כבר בתורנות.\nהמפתח האחרון אצלה. בדלי.' },
  { title: 'הבריחה', text: 'יש לך ארבעה מפתחות.\nהיציאה בסוף המבוך — באותו מקום שבו רות נעלמה.\nהיא יודעת שאתה בא.\nהפעם היא לא תוותר.' },
];

// Shown when the player has been stuck on an objective for a while.
const HINTS = {
  note: 'הפתק מונח על המיטה שלך, בפינה של חדר 1.',
  light: 'הלוקר שלך בקיר המערבי של חדר 1.',
  key1: 'המטבחון — הדלת השלישית במסדרון הצפוני. תבדוק במקרר.',
  clip: 'המשרד של הרס״פ — במסדרון הצפוני, אחרי המטבחון. הטופס על השולחן.',
  zalam: 'מחסן הצל״ם — הדלת באמצע המסדרון הצפוני. חפש את התוויות הלבנות על המדפים.',
  tray: 'המגש על השולחן במשרד הרס״פ.',
  fuses: 'נתיך במקלחות (על הכיור), נתיך בחדר 4 (על מיטה), ונתיך בתוך המבוך (בפינה בלי מוצא).',
  power: 'חדר הגנרטור — מהמסדרון האמצעי. הלוח על הקיר הרחוק.',
  lever: 'הידית הצהובה, ליד לוח החשמל.',
  cctv: 'חדר המצלמות — במסדרון הצפוני, ליד הקצה המזרחי.',
  iso: 'אגף הבידוד — הדלת עם השלט האדום במסדרון הדרומי.',
  file: 'התיק הרפואי על השולחן בקצה האגף.',
  key3: 'ארון התרופות הלבן באגף הבידוד.',
  mop: 'המגב במקלחות, ליד הכיורים.',
  clean: 'השלוליות האדומות: במסדרון הצפוני, בדרומי, ובשני המסדרונות האמצעיים.',
  store: 'המחסן של יסמין — הדלת בקצה המזרחי של המסדרון הצפוני.',
  key4: 'בדלי הגדול במחסן של יסמין.',
  bed: 'המיטה שלך — בפינה של חדר 1.',
  exit: 'הכניסה למבוך — הדלת עם "???" במסדרון הדרומי. אולי מישהי תראה לך את הדרך.',
  gate: 'המנעול בצד של השער.',
  run: 'צא מהשער!',
};

const OVER_LINES = [
  'יסמין שלחה אותך לנקות את כל הבסיס עם מברשת שיניים.',
  'עכשיו אתה בתורנות ניקיון. לנצח.',
  'נבו מקבל שותף לתא.',
  'הרצפה הייתה רטובה. אתה ידעת.',
  '47 מסדרים. אתה תעשה 48.',
  'היא אמרה שאתה מלכלך. היא צדקה.',
  'הסקווש הבא — בטעם שלך.',
];
export function overLine() { return OVER_LINES[Math.floor(Math.random() * OVER_LINES.length)]; }

const NOTES = {
  rasap: `<h3>פתק על המיטה</h3>החדש —
אתה נשאר לבד בבסיס לסופ״ש.
המפתחות של השער אצל יסמין, תורנית הניקיון.
אל תבקש ממנה. אל תדבר איתה.
<span class="blood">ובשום מצב — אל תלכלך.</span>
הפנס בלוקר שלך.
— הרס״פ`,
  roi: `<h3>פתק מודבק על המקרר</h3>אם מישהו מוצא את זה:
שפכתי סקווש פטל על המסדרון. רק טיפה.
יסמין ראתה.
היא אמרה שהיא תדאג שזה "יתנקה עד הסוף".
אחר כך היא מילאה לי את כל הבקבוקים מחדש.
<span class="blood">זה לא פטל.</span>
— רועי`,
  maya: `<h3>פתק ליד הלבובו</h3>השארתי את הלבובו על המיטה ולא סידרתי אותה למסדר.
יסמין לקחה אותו "לחקירה".
הוא חזר ככה.
אני הולכת להתלונן לרס״פ.
אם אני לא חוזרת — תשמרו לי על הראש שלו.
— מאיה`,
  zalam: `<h3>הודעה</h3>דוח צל״ם — חובה לפני יציאה הביתה.
מי שלא מגיש — נשאר עוד לילה.
ועוד לילה.
ועוד לילה.
<span class="blood">— יסמין, ממלאת מקום רס״פ</span>`,
  fuses: `<h3>מודבק על לוח החשמל</h3>חסרים 3 נתיכים.
<span class="blood">"אין אור — אין לכלוך."</span>
מישהו פיזר אותם בבסיס:
אחד במקלחות. אחד בחדר 4. אחד... בפנים.`,
  nevo: `<div class="type"><h3>תיק רפואי — נבו ה.</h3><img src="img/photo_nevo.jpg" alt="">
<b>אבחנה:</b> הפרעת מסדרים כפייתית חריפה, לאחר 47 מסדרי ניקיון ברצף.
<b>תסמינים:</b> סופר משבצות ברצפה. מבקש "עוד אחד". מתעורר בצעקות מצליל של גלגלים.
<b>הערות:</b> המטופל מסרב לגעת במגב. לא להכניס דליים לתא. לא להזכיר את השם "יסמין".
<b>המלצה:</b> בידוד, עד שיסמין תשתחרר.
<span class="blood">תאריך השחרור של יסמין: לא ידוע.</span></div>`,
  diary: `<h3>יומן תורנות — יסמין</h3>יום 1: המסדרון מלוכלך.
יום 12: הם מלכלכים בכוונה.
יום 30: נבו סיים 47 מסדרים. עדיין לא מבריק.
יום 31: רועי שפך סקווש. ניקיתי אותו.
יום 33: מאיה לא סידרה מיטה. ניקיתי גם אותה.
יום 35: רות ניסתה לברוח דרך המבוך. ניקיתי גם אותה.
יום 40: יש חדש. הוא הולך עם נעליים על הרטוב.
<span class="blood">הלילה אני מנקה אותו.</span>`,
  missing: `<h3>מודעה על הקיר</h3><img src="img/ruth_photo.jpg" alt="">
<b>נעדרת: רות ל.</b>
נראתה לאחרונה במשמרת לילה, ליד המבוך, לפני שלושה חודשים.
ממישהו שראה אותה בלילה ההוא נשאר רק פתק: "היא הלכה יחפה".
<span class="blood">מי שראה — שלא יחפש.</span>`,
  boots: `<h3>נעליים צבאיות</h3>זוג נעליים, מסודרות בקפידה.
בפנים, בעט: <b>רות ל.</b>
הן נקיות. נקיות מדי.
<span class="blood">על הסוליה מישהו כתב בטוש: "לכלכה".</span>`,
  daniel: `<h3>פתק מתחת למזרן — חדר 4</h3>שמעתי אותה הלילה מחוץ לדלת.
היא מגבה את אותו מקום כבר שעה.
הלוך. חזור. הלוך. חזור.
כאילו היא מנסה לנקות משהו שלא יורד.
בבוקר ראיתי את המקום. הרצפה שם בהירה יותר.
<span class="blood">בצורה של אדם.</span>
— דניאל`,
  camlog: `<div class="type"><h3>יומן מצלמות — משמרת לילה</h3>02:58 — שקט.
03:12 — תורנית במסדרון הצפוני.
03:13 — תורנית במסדרון הצפוני.
03:14 — תורנית במסדרון הצפוני. עומדת. לא זזה.
03:15 — תורנית מול המצלמה.
03:16 — <span class="blood">אין תמונה.</span>
03:17 — יש מישהו בחדר מצלמות.</div>`,
  board: `<h3>הלוח של יסמין</h3><img src="img/photo_yasmin.jpg" alt="">
מתחת לתמונה, בטוש אדום:
<span class="blood">"עובדת החודש. כל חודש."</span>`,
};

export class Story {
  constructor(game) {
    this.g = game;
    this.objs = [];
    this.items = {};
  }

  // ---------- one-time setup of story props ----------
  setup() {
    const g = this.g, W = g.world, M = W.M, root = W.root;
    const models = g.models;
    const place = (src, x, y, z, ry = 0, s = 1, parent = root) => {
      const m = src.clone(true);
      m.position.set(x, y, z); m.rotation.y = ry; m.scale.multiplyScalar(s);
      m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      parent.add(m); return m;
    };
    const norm = (scene, height) => { // scale a generated model so it is `height` tall, feet at 0
      const box = new THREE.Box3().setFromObject(scene);
      const s = height / (box.max.y - box.min.y);
      const g2 = new THREE.Group(); scene.position.y = -box.min.y; g2.add(scene); g2.scale.setScalar(s);
      return g2;
    };
    this.bucketModel = norm(models.bucket.scene, 0.82);
    this.squashModel = norm(models.squash.scene, 0.3);
    this.labubuModel = norm(models.labubu.scene, 0.26);

    // --- kitchen: open fridge full of "squash", more on the table, a red puddle
    const K = W.bounds.K;
    const fr = W.fridgePos;
    const pivot = new THREE.Group(); pivot.position.set(fr.x - 0.35, 0, fr.z + 0.375); pivot.rotation.y = 1.75; root.add(pivot);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.85, 0.74), M.white);
    door.position.set(0, 0.95, -0.37); door.castShadow = true; pivot.add(door);
    for (const y of [0.5, 1.0, 1.45]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.6), M.white); sh.position.set(-0.06, y, -0.37); pivot.add(sh); }
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 1.7), new THREE.MeshStandardMaterial({ color: 0xf2f5f5, emissive: 0xdde8ff, emissiveIntensity: 0.9 }));
    inner.position.set(fr.x + 0.37, 0.95, fr.z); inner.rotation.y = -Math.PI / 2; root.add(inner);
    for (const y of [0.45, 0.95, 1.4]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.02, 0.66), M.glass); s.position.set(fr.x + 0.02, y, fr.z); root.add(s); }
    for (const [dy, dz] of [[0.47, -0.2], [0.47, 0.05], [0.47, 0.25], [0.97, -0.15], [0.97, 0.18], [1.42, 0.12]]) place(this.squashModel, fr.x + 0.05, dy, fr.z + dz, Math.random() * 6, 1);
    place(this.squashModel, K.X0 + 4.7, 0.76, K.Z0 + 3.5, 0.4, 1);
    const fallen = place(this.squashModel, K.X0 + 5.4, 0.85, K.Z0 + 3.7, 0, 1); fallen.rotation.z = Math.PI / 2;
    W.decal(T.bloodTex('splat'), K.X0 + 5.6, K.Z0 + 4.1, 1.3, 1.3, 0.4);
    W.decal(T.puddleTex(true), fr.x - 1.0, fr.z + 0.3, 1.6, 1.4, 1);
    W.wallDecal(T.bloodTex('hand'), fr.x + 0.36, 1.2, fr.z + 0.1, -Math.PI / 2, 0.3, 0.3);
    W.addEmitter({ x: fr.x - 0.6, y: 1.1, z: fr.z, color: 0xd8e6ff, power: 2.2, dist: 4.5 });

    // --- room 2: the beheaded Labubu on a bed
    const B = W.bounds.B;
    this.labubu = place(this.labubuModel, B.X1 - 1.6, 0.52, B.Z0 + 1.0, 0.6, 1);
    W.decal(T.bloodTex('splat'), B.X1 - 1.2, B.Z0 + 1.6, 0.9, 0.9, 0);

    // --- buckets
    this.rollBucket = place(this.bucketModel, 43, 0, 6.5, 0, 1);
    place(this.bucketModel, 69.0, 0, 4.4, 0.4, 1);
    this.keyBucket = place(this.bucketModel, 68.3, 0, 6.6, -0.6, 1);
    place(this.bucketModel, 31.5, 0, 34.6, 2, 1);
    W.addBox(68.5, 69.5, 4.0, 4.8); W.addBox(67.8, 68.8, 6.2, 7.0);

    // --- Yasmin's store: shrine with candles, photo board, diary
    const J = W.bounds.J;
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08 + Math.random() * 0.12, 8), M.white);
      c.position.set(J.X0 + 1.2 + i * 0.27, 0.8, J.Z1 - 1.4 + (i % 2) * 0.15); root.add(c);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffa040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      fl.scale.set(0.05, 0.09, 1); fl.position.set(c.position.x, c.position.y + c.geometry.parameters.height / 2 + 0.04, c.position.z); root.add(fl);
      W.dynamic.push({ update: (dt, t) => { fl.scale.y = 0.08 + Math.sin(t * 13 + i) * 0.015; fl.visible = this.candles; } });
    }
    this.candles = true;
    W.addEmitter({ x: J.X0 + 2, y: 1.1, z: J.Z1 - 1.5, color: 0xff8a3a, power: 3, dist: 6, flicker: 'candle', on: () => this.candles });
    const loadImg = (src) => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = src; });
    Promise.all(['img/photo_yasmin.jpg', 'img/photo_nevo.jpg', 'img/photo_labubu.jpg', 'img/photo_squash.jpg'].map(loadImg)).then(([py, pn, pl, ps]) => {
      const pin = (tex, x, y, z, ry, rz) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.36), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); m.position.set(x, y, z); m.rotation.set(0, ry, rz); root.add(m); return m; };
      pin(T.photoFrameTex(py, 'אני ♥'), J.X0 + 0.02, 1.65, 5.0, Math.PI / 2, 0.05);
      pin(T.crossOut(T.photoFrameTex(pn, 'נבו')), J.X0 + 0.02, 1.62, 4.2, Math.PI / 2, -0.08);
      pin(T.crossOut(T.photoFrameTex(pl, 'מאיה')), J.X0 + 0.02, 1.25, 4.6, Math.PI / 2, 0.1);
      pin(T.crossOut(T.photoFrameTex(ps, 'רועי')), J.X0 + 0.02, 1.25, 5.4, Math.PI / 2, -0.04);
      // the "missing" board in the office also has Nevo's photo
      pin(T.photoFrameTex(pn, 'נבו ה. — בידוד'), 47.98, 1.6, 6.2, -Math.PI / 2, 0.03);
    });
    W.wallDecal(T.scrawlTex('עובדת החודש', { color: 'rgba(150,10,10,0.9)', size: 90 }), J.X0 + 0.03, 2.1, 4.8, Math.PI / 2, 1.4, 0.35);
    const diary = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), M.red); diary.position.set(J.X0 + 2.7, 0.775, J.Z1 - 1.3); root.add(diary);
    W.decal(T.bloodTex('smear'), J.X0 + 3, J.Z0 + 4, 2.5, 1.0, 0.3);

    // --- office: clipboard, tray, paper
    const O = W.bounds.O;
    this.clip = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.32), M.wood); this.clip.add(board);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.29), new THREE.MeshStandardMaterial({ map: T.formTex(), roughness: 0.8 })); sheet.rotation.x = -Math.PI / 2; sheet.position.y = 0.008; this.clip.add(sheet);
    this.clip.position.set(O.X0 + 4.6, 0.785, O.Z0 + 1.0); this.clip.rotation.y = 0.2; root.add(this.clip);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.26), M.darkMetal); tray.position.set(O.X0 + 5.5, 0.8, O.Z0 + 0.9); root.add(tray);
    this.trayPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.29), sheet.material); this.trayPaper.rotation.x = -Math.PI / 2; this.trayPaper.position.set(O.X0 + 5.5, 0.83, O.Z0 + 0.9); this.trayPaper.visible = false; root.add(this.trayPaper);
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), M.plastic); monitor.position.set(O.X0 + 5, 1.0, O.Z0 + 0.7); root.add(monitor);

    // --- notes lying around
    this.notePaper = (x, y, z, r = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), new THREE.MeshStandardMaterial({ map: T.paperTex(), roughness: 0.85, side: THREE.DoubleSide })); m.rotation.set(-Math.PI / 2, 0, r); m.position.set(x, y, z); root.add(m); return m; };
    this.paperBed = this.notePaper(3.4, 0.51, 7.05, 0.3);
    this.paperFridge = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), new THREE.MeshStandardMaterial({ map: T.paperTex(), roughness: 0.85 }));
    this.paperFridge.position.set(-0.035, 0.35, 0.05); this.paperFridge.rotation.y = -Math.PI / 2; door.add(this.paperFridge);
    this.paperMaya = this.notePaper(B.X1 - 1.9, 0.52, B.Z0 + 1.25, -0.4);
    this.paperFuse = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), new THREE.MeshStandardMaterial({ map: T.paperTex(), roughness: 0.85 }));
    this.paperFuse.position.set(W.fusePanel.x - 0.12, 1.45, W.fusePanel.z + 0.6); this.paperFuse.rotation.y = -Math.PI / 2; root.add(this.paperFuse);
    this.paperNevo = this.notePaper(64.2, 0.785, 43.1, 2.9);
    this.paperDaniel = this.notePaper(3.25, 0.535, 40.4, 1.2);
    this.paperCam = this.notePaper(51.6, 0.785, 3.1, 0.4);
    W.wallDecal(T.scrawlTex('היא מאחוריך', { color: 'rgba(140,10,10,0.85)', size: 110 }), 8.5, 1.58, 14.06, 0, 0.9, 0.22);

    // --- generic pickups
    const keyMesh = () => {
      const k = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 16), M.chrome); k.add(ring);
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.014), new THREE.MeshStandardMaterial({ color: 0xc9a64a, metalness: 1, roughness: 0.3 })); shaft.position.x = 0.05; k.add(shaft);
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.003, 0.06), M.red); tag.position.set(-0.04, 0, 0); k.add(tag);
      k.rotation.x = -Math.PI / 2;
      return k;
    };
    const glint = () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(0.12); return s; };
    this.pickups = [];
    const pickup = (id, mesh, x, y, z) => {
      mesh.position.set(x, y, z); root.add(mesh);
      const gl = glint(); gl.position.set(x, y + 0.04, z); root.add(gl);
      const p = { id, mesh, glint: gl, taken: false };
      this.pickups.push(p); this.items[id] = p;
      mesh.visible = gl.visible = false;
      return p;
    };
    pickup('key1', keyMesh(), fr.x - 0.05, 1.43, fr.z - 0.18);
    pickup('key2', keyMesh(), O.X0 + 5.5, 0.84, O.Z0 + 0.9);
    pickup('key3', keyMesh(), 67.28, 1.05, 34.5);
    pickup('key4', keyMesh(), 68.3, 0.62, 6.6);
    const fuse = () => { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0xd6d0c0, roughness: 0.4 })); f.rotation.z = Math.PI / 2; return f; };
    pickup('fuse1', fuse(), 8.5, 0.92, 14.35);
    pickup('fuse2', fuse(), 3.2, 0.47, 36.2);
    pickup('fuse3', fuse(), 27, 0.03, 43);
    const battery = () => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.065, 10), new THREE.MeshStandardMaterial({ color: 0x1e5aa8, metalness: 0.5, roughness: 0.4 })); b.rotation.z = Math.PI / 2; return b; };
    pickup('bat1', battery(), 21, 0.03, 18);
    pickup('bat2', battery(), 48.3, 0.5, 10.35);
    pickup('bat3', battery(), 30.6, 0.78, 5.6);
    const mopItem = new THREE.Group();
    { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.45, 8), M.wood); s.position.y = 0.85; mopItem.add(s); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.3, 9), M.mopString); h.position.y = 0.15; mopItem.add(h); mopItem.rotation.z = 0.25; }
    pickup('mop', mopItem, 11.2, 0, 14.5);
    // inspection items in the equipment store
    this.zalamItems = [
      { id: 'z1', name: 'אמר״ל (משקפת לילה)', serial: 'צ׳ 30117', x: 26.4, y: 0.95, z: 16.55 },
      { id: 'z2', name: 'מכשיר קשר 710', serial: 'צ׳ 8842', x: 38.6, y: 0.95, z: 19.55 },
      { id: 'z3', name: 'אלונקה מקופלת', serial: 'צ׳ 1203', x: 41.3, y: 0.9, z: 23.4 },
      { id: 'z4', name: 'פנס ראש', serial: 'צ׳ 47 — מוכתם', x: 29.6, y: 1.6, z: 22.55 },
    ];
    for (const z of this.zalamItems) {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0xf1e9c8, roughness: 0.7 }));
      tag.position.set(z.x, z.y, z.z + 0.01); root.add(tag);
      const gl = glint(); gl.position.set(z.x, z.y + 0.05, z.z + 0.03); root.add(gl);
      z.mesh = tag; z.glint = gl; z.done = false;
    }
    // night 4 puddles (meshes created per night)
    this.puddleSpots = [[16, 11], [45, 19], [21, 27], [69, 20]];
    this.puddles = [];

    // --- Nevo in his padded cell
    const nv = models.nevo;
    this.nevo = nv.scene;
    this.nevo.position.set(53, 0, 39.5); this.nevo.rotation.y = Math.PI;
    this.nevo.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material.roughness = 0.8; } });
    root.add(this.nevo);
    this.nevoMixer = new THREE.AnimationMixer(this.nevo);
    const clip = nv.animations[0].clone();
    const hips = clip.tracks.find(t => t.name.endsWith('Hips.position'));
    if (hips) { const v = hips.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } }
    this.nevoMixer.clipAction(clip).play();
    this.nevoState = 'rock'; this.nevoVoiceT = 2; this.nevoLine = 0;
    // lying mops inside the cell
    for (const [x, z, r] of [[50, 41, 0.4], [56.5, 36, -1.1]]) {
      const m = mopItem.clone(); m.position.set(x, 0.03, z); m.rotation.set(Math.PI / 2, 0, r); root.add(m);
    }
    place(this.bucketModel, 56.6, 0, 41.2, 1, 0.7).rotation.z = 1.4;
    W.decal(T.puddleTex(false), 54, 40, 2, 1.6, 0);
    W.addEmitter({ x: 53, y: 2.5, z: 38, color: 0xeef6ff, power: 4, dist: 7, flicker: 'bad' });

    // --- Blood and wet trails around the base
    W.decal(T.bloodTex('smear'), 20, 11, 2.6, 0.9, 0.1);
    W.decal(T.bloodTex('splat'), 46, 26.8, 0.8, 0.8);
    W.decal(T.puddleTex(false), 9, 11, 2.2, 1.6);
    W.decal(T.puddleTex(false), 34, 27, 2.6, 1.6);
    W.decal(T.puddleTex(false), 35, 39, 1.6, 1.4);
    W.wallDecal(T.bloodTex('hand'), 41.98, 1.2, 36.5, -Math.PI / 2, 0.4, 0.4);
    W.wallDecal(T.bloodTex('hand'), 2.02, 1.4, 22, Math.PI / 2, 0.35, 0.35);

    // --- Ruth: the missing poster, her photo on Yasmin's board, her boots, the tapes, her ghost
    this.tapeMeshes = [null];
    for (let i = 1; i <= 5; i++) {
      const [x, y, z] = TAPE_SPOTS[i];
      const m = tapeMesh(M); m.position.set(x, y, z); m.rotation.y = i * 1.3; m.visible = false; root.add(m);
      const gl = glint(); gl.position.set(x, y + 0.05, z); gl.visible = false; root.add(gl);
      this.tapeMeshes.push({ mesh: m, glint: gl });
    }
    this.ghost = new Ghost(W.scene, g.tex.ruth_ghost);
    this.posterPos = v3(10.6, 1.5, 10.05);
    loadImg('img/ruth_photo.jpg').then(im => {
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.77), new THREE.MeshStandardMaterial({ map: missingPosterTex(im), roughness: 0.8 }));
      poster.position.set(10.6, 1.55, 10.01); root.add(poster);
      const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.36), new THREE.MeshStandardMaterial({ map: T.crossOut(T.photoFrameTex(im, 'רות')), roughness: 0.6 }));
      p2.position.set(J.X0 + 0.02, 1.95, 4.6); p2.rotation.set(0, Math.PI / 2, 0.06); root.add(p2);
    });
    for (const dx of [0, 0.16]) {
      const boot = new THREE.Group();
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.3), M.rubber); sole.position.y = 0.02; boot.add(sole);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.13), new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.5 })); top.position.set(0, 0.13, -0.08); boot.add(top);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.18), top.material); toe.position.set(0, 0.06, 0.06); boot.add(toe);
      boot.position.set(60.75 + dx, 0, 2.75); boot.rotation.y = Math.PI / 2 + 0.1; boot.traverse(o => { if (o.isMesh) o.castShadow = true; });
      root.add(boot);
    }
    // empty bottles to throw (shown per night)
    this.bottleSpots = [[29.2, 0.95, 2.35], [48.6, 0.5, 10.35], [9.8, 0.92, 14.35], [7, 0.02, 37.5], [31, 0.02, 31], [61.5, 0.02, 41], [21, 0.02, 4.5], [50.5, 0.78, 3.1]];
    this.bottleMeshes = this.bottleSpots.map(([x, y, z]) => {
      const b = this.g.mech.bottleMesh(); b.position.set(x, y, z); b.visible = false; root.add(b);
      const gl = glint(); gl.position.set(x, y + 0.12, z); gl.visible = false; root.add(gl);
      return { mesh: b, glint: gl };
    });

    // CCTV monitors
    this.setupCCTV();
  }

  setupCCTV() {
    const g = this.g, W = g.world;
    const res = g.quality === 'low' ? [192, 144] : [320, 240];
    this.cams = [];
    const mk = (label, pos, look, live = true, img = null) => {
      const rt = live ? new THREE.WebGLRenderTarget(res[0], res[1]) : null;
      const cam = new THREE.PerspectiveCamera(78, res[0] / res[1], 0.1, 40);
      cam.position.copy(pos); cam.lookAt(look);
      return { label, cam, rt, img, live };
    };
    this.cams.push(mk('CAM 1 · מסדרון צפוני', v3(5, 2.5, 11), v3(30, 1, 11)));
    this.cams.push(mk('CAM 2 · ???', v3(26.5, 2.5, 30.5), v3(34, 0.5, 38)));
    this.cams.push(mk('CAM 3 · בידוד תא 3', null || v3(0, 0, 0), v3(0, 0, 0), false, g.tex.nevo_cctv));
    this.cams.push(mk('CAM 4 · חדר מצלמות', v3(57.6, 2.55, 7.6), v3(52, 0.9, 2.5)));
    this.cams.push(mk('CAM 5 · אגף בידוד', v3(47, 2.5, 31), v3(60, 1, 31)));
    this.cams.push(mk('CAM 6 · חצר', null || v3(0, 0, 0), v3(0, 0, 0), false, null));
    this.cams.push(mk('CAM 7 · ש.ג', v3(30, 4, 54), v3(36, 0, 64)));
    const shader = {
      uniforms: { map: { value: null }, time: { value: 0 }, noise: { value: 0.15 }, has: { value: 1 }, on: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D map; uniform float time, noise, has, on; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          vec2 uv = vUv; vec2 c = uv - 0.5; uv = 0.5 + c * (1.0 + dot(c,c) * 0.25);
          float line = floor(uv.y * 120.0);
          uv.x += (h(vec2(line, floor(time*12.0))) - 0.5) * 0.01 * noise * 4.0;
          vec3 col = has > 0.5 ? texture2D(map, uv).rgb : vec3(0.0);
          float l = dot(col, vec3(0.3,0.59,0.11));
          l = pow(l, 0.75) * 1.6;
          float n = h(uv * 300.0 + time * 7.0);
          l = mix(l, n, has > 0.5 ? noise : 1.0);
          l *= 0.8 + 0.2 * sin(uv.y * 600.0 + time * 10.0);
          l *= smoothstep(0.75, 0.3, length(c));
          vec3 o = vec3(l * 0.85, l, l * 0.9);
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) o = vec3(0.0);
          gl_FragColor = vec4(o * on, 1.0);
        }`,
    };
    this.screens = [];
    W.monitorSlots.forEach((s, i) => {
      const c = this.cams[i];
      const mat = new THREE.ShaderMaterial(THREE.UniformsUtils.clone(shader.uniforms) && { ...shader, uniforms: THREE.UniformsUtils.clone(shader.uniforms) });
      mat.uniforms.map.value = c.rt ? c.rt.texture : c.img;
      mat.uniforms.has.value = (c.rt || c.img) ? 1 : 0;
      const w = s.small ? 1.12 : 1.15, h = s.small ? 0.62 : 0.72;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(s.x, s.y, s.z); W.root.add(m);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06), new THREE.MeshBasicMaterial({ map: T.labelTex(c.label.split(' · ')[0] + ' ' + (i + 1)), transparent: true, opacity: 0.8 }));
      lab.position.set(s.x - w / 2 + 0.27, s.y + h / 2 - 0.06, s.z + 0.002); W.root.add(lab);
      this.screens.push({ mesh: m, mat, cam: c });
    });
    W.addEmitter({ x: 54, y: 1.5, z: 3.5, color: 0x9fc4c8, power: 1.6, dist: 6, on: () => this.screensOn !== false });
  }

  renderCCTV(renderer, scene, t) {
    if (!this.screens) return;
    for (const s of this.screens) s.mat.uniforms.time.value = t;
    // only when the player is in the camera room
    if (roomAt(this.g.player.pos.x, this.g.player.pos.z) !== 'c') return;
    const live = this.cams.filter(c => c.live);
    this._rr = ((this._rr || 0) + 1) % live.length;
    const c = live[this._rr];
    const old = renderer.getRenderTarget();
    const fog = scene.fog;
    renderer.setRenderTarget(c.rt);
    renderer.render(scene, c.cam);
    renderer.setRenderTarget(old);
    scene.fog = fog;
  }

  // ---------- objectives ----------
  setObjectives(list) { this.objs = list; this.refresh(); }
  obj(id) { return this.objs.find(o => o.id === id); }
  done(id) { const o = this.obj(id); if (o && !o.done) { o.done = true; this.refresh(); this.g.audio.pickup(); this.stuckT = 0; } }
  add(o) { if (!this.obj(o.id)) { this.objs.push(o); this.refresh(); } }
  refresh() { this.g.ui.objectives(`לילה ${this.night} · ${NIGHTS[this.night].title}`, this.objs); }

  // ---------- nights ----------
  start(n) {
    const g = this.g, W = g.world, Y = g.yasmin, P = g.player;
    this.night = n;
    this.stuckT = 0;
    this.flags = {};
    this.events = [];
    this.timers = [];
    this.inter = [];
    g.finale = false;
    // reset world state
    for (const k of Object.keys(locks)) locks[k] = true;
    locks.P = false; gateClosed.v = true;
    for (const k in W.doors) { W.doors[k].target = 0; W.doors[k].open = 0; W.doors[k].led.material.color.set(0xff2020); }
    W.gate.target = 0; W.gate.open = 0;
    W.power = true; W.alarm = 0;
    this.candles = true; this.screensOn = true;
    for (const p of this.pickups) { p.mesh.visible = p.glint.visible = false; p.taken = false; }
    for (const z of this.zalamItems) { z.done = false; z.glint.visible = false; }
    for (const pd of this.puddles) W.decals.remove(pd.mesh);
    this.puddles = [];
    for (const L of W.lockers) { L.target = 0; }
    this.trayPaper.visible = false; this.clip.visible = true;
    this.rollBucket.position.set(43, 0, 6.5);
    this.nevo.position.set(53, 0, 39.5); this.nevoState = 'rock';
    P.pos.set(3.2, 0, 5.6); P.yaw = -Math.PI / 2 + 0.3; P.pitch = -0.05;
    P.hasLight = n > 1; P.lightOn = false; P.battery = 1; P.drain = n === 3 ? 1 / 200 : 1 / 900;
    P.hidden = null; P.stamina = 1; P.slow = 1;
    Y.hide(); Y.setNight(n, g.settings.difficulty);
    Y.footprints.forEach(f => f.mesh.material.opacity = 0);
    this.carryMop = false;
    const it = (o) => { this.inter.push(o); return o; };
    const show = (id) => { const p = this.items[id]; p.mesh.visible = p.glint.visible = true; };
    const take = (id) => { const p = this.items[id]; p.taken = true; p.mesh.visible = p.glint.visible = false; };
    const pickupIt = (id, label, onTake, range = 1.8) => it({
      label, pos: () => this.items[id].mesh.position, range, enabled: () => this.items[id].mesh.visible && !this.items[id].taken,
      use: () => { take(id); g.audio.pickup(); onTake && onTake(); },
    });
    const keysHave = () => ['key1', 'key2', 'key3', 'key4'].filter(k => this.flags[k]).length;

    // notes everyone can read
    it({ label: 'קרא פתק', pos: () => this.paperBed.position, enabled: () => n === 1, use: () => { this.read('rasap'); if (n === 1) this.done('note'); } });
    it({ label: 'קרא פתק', pos: () => this.paperFridge.getWorldPosition(v3(0, 0, 0)), use: () => { this.read('roi'); this.discover('squash'); } });
    it({ label: 'קרא פתק', pos: () => this.paperMaya.position, use: () => { this.read('maya'); this.discover('labubu'); } });
    it({ label: 'קרא', pos: () => this.paperFuse.position, use: () => { this.read('fuses'); } });
    it({ label: 'קרא פתק', pos: () => this.paperDaniel.position, use: () => { this.read('daniel'); } });
    it({ label: 'קרא יומן מצלמות', pos: () => this.paperCam.position, use: () => { this.read('camlog'); } });
    it({ label: 'קרא תיק רפואי', pos: () => this.paperNevo.position, enabled: () => !locks.I, use: () => {
      this.read('nevo'); this.discover('nevo'); if (n === 3) this.done('file');
      if (!this.flags.ghostCell) { this.flags.ghostCell = true; this.when(() => g.state === 'play' && P.pos.x < 59 && P.pos.z < 33, () => { this.apparition(49.6, 37, 5, true); this.after(0.6, () => g.audio.play('n_ruth', { pos: v3(this.nevo.position.x, 1.6, this.nevo.position.z), volume: 1.3 })); }); }
    } });
    it({ label: 'קרא יומן', pos: () => v3(62.7, 0.8, 6.7), enabled: () => !locks.J, use: () => { this.read('diary'); } });
    it({ label: 'הסתכל על התמונות', pos: () => v3(60.1, 1.5, 4.8), enabled: () => !locks.J, use: () => { this.read('board'); } });
    it({ label: 'הסתכל', pos: () => this.labubu.position, range: 1.8, use: () => { this.discover('labubu'); g.ui.toast('הראש של הלבובו...'); } });
    // lockers: hide (and the flashlight one)
    for (const L of W.lockers) {
      if (!L.hide) continue;
      it({ label: 'התחבא בארון', pos: () => v3(L.x + L.fwd.x * 0.4, 1.2, L.z + L.fwd.z * 0.4), range: 1.6, enabled: () => !P.hidden, use: () => g.enterLocker(L) });
    }
    const myLocker = W.lockers.reduce((a, b) => Math.hypot(a.x - 2.3, a.z - 4.4) < Math.hypot(b.x - 2.3, b.z - 4.4) ? a : b);
    this.myLocker = myLocker;
    it({ label: 'פתח את הלוקר שלך', pos: () => v3(myLocker.x + 0.4, 1.2, myLocker.z), range: 1.6, enabled: () => !P.hasLight,
      use: () => { myLocker.target = 1; g.audio.play('sfx_locker', { pos: v3(myLocker.x, 1, myLocker.z) }); P.hasLight = true; P.setLight(true); g.ui.toast('לקחת פנס  ·  [F] להדליק/לכבות'); this.done('light'); if (g.ui.isTouch) g.ui.toast('לקחת פנס'); this.after(1.5, () => myLocker.target = 0); } });
    // batteries every night (more useful on night 3)
    for (const b of ['bat1', 'bat2', 'bat3']) { if (n >= 2) show(b); pickupIt(b, 'קח סוללה', () => { P.battery = 1; g.ui.toast('סוללה חדשה'); }); }
    // Ruth's tape for tonight, the missing poster, her boots
    this.ghost.hide(true);
    for (let i = 1; i <= 5; i++) { const tp = this.tapeMeshes[i]; tp.mesh.visible = tp.glint.visible = i === n; }
    const tp = this.tapeMeshes[n];
    const heard = loadTapes();
    const tapeRoom = [null, null, 'E', 'I', 'J', null][n];
    it({ label: heard.has(n) ? 'האזן שוב לקלטת של רות' : 'קח קלטת', pos: () => tp.mesh.position, range: 1.8, enabled: () => tp.mesh.visible && (!tapeRoom || !locks[tapeRoom]),
      use: () => { tp.mesh.visible = tp.glint.visible = false; g.playTape(n); } });
    it({ label: 'קרא מודעה', pos: () => this.posterPos, range: 2.2, use: () => { this.read('missing'); this.discover('ruth'); } });
    it({ label: 'הסתכל על הנעליים', pos: () => v3(60.85, 0.15, 2.75), range: 1.7, enabled: () => !locks.J, use: () => { this.read('boots'); this.discover('ruth'); } });
    // bottles to throw: a few each night
    const bottleSet = [[0, 1, 6], [0, 2, 7], [1, 3, 4, 5], [0, 2, 3, 6], [1, 4, 6, 7]][n - 1];
    this.bottleMeshes.forEach((b, i) => {
      b.mesh.visible = b.glint.visible = bottleSet.includes(i);
      it({ label: 'קח בקבוק ריק (לזריקה)', pos: () => b.mesh.position, range: 1.8, enabled: () => b.mesh.visible && P.bottles < 3,
        use: () => { b.mesh.visible = b.glint.visible = false; P.bottles++; g.audio.pickup(); g.ui.toast(g.ui.isTouch ? 'בקבוק · כפתור "זרוק" כדי להסיח אותה' : 'בקבוק · [G] זרוק כדי להסיח אותה'); } });
    });
    P.bottles = 0;
    this.mazeGuide = n === 5 ? 0 : -1;
    g.mech.clear();
    // the bed ends the night once the night's work is done
    it({ label: 'לך לישון (סיים את הלילה)', pos: () => v3(3.2, 0.6, 7.0), range: 1.8, enabled: () => this.flags.canSleep && n < 5, use: () => g.endNight() });

    let list = [];
    if (n === 1) {
      list = [
        { id: 'note', text: 'קרא את הפתק על המיטה שלך' },
        { id: 'light', text: 'קח פנס מהלוקר שלך' },
        { id: 'key1', text: 'מצא את מפתח השער הראשון', hidden: true },
        { id: 'bed', text: 'חזור למיטה בחדר 1 ושרוד את הלילה', hidden: true },
      ];
      show('key1');
      // after the note: where the first key might be
      this.when(() => this.obj('note').done && this.obj('light').done, () => { this.obj('key1').hidden = false; this.obj('key1').text = 'מצא את מפתח השער הראשון (אולי במטבחון)'; this.refresh(); });
      pickupIt('key1', 'קח מפתח', () => {
        this.flags.key1 = true; g.audio.keys(); this.done('key1'); g.ui.toast('מפתח שער 1/4');
        this.obj('bed').hidden = false; this.flags.canSleep = true; this.refresh();
        // she wakes up
        g.audio.play('sfx_door', { pos: v3(60, 1, 27), volume: 1.4 });
        this.after(1.2, () => g.audio.play('sfx_distant', { pos: v3(10, 1, 40), volume: 1 }));
        this.after(2, () => { Y.spawn(55, 27, 'patrol', -Math.PI / 2); Y.goTo(20, 11); });
        // the rolling bucket in the corridor on your way back
        this.flags.rollArmed = true;
      });
      // first sight of her: standing at the far end of the corridor
      this.when(() => P.pos.z > 9.6 && P.hasLight, () => this.peek(26.5, 11, -Math.PI / 2, 4, 'y_intro'));
      this.when(() => this.flags.rollArmed && P.pos.x > 30 && P.pos.x < 41 && P.pos.z > 9.5 && P.pos.z < 12, () => this.rollTheBucket());
    }
    if (n === 2) {
      P.hasLight = true;
      list = [
        { id: 'clip', text: 'קח את טופס הצל״ם מהמשרד' },
        { id: 'zalam', text: 'רשום את הציוד במחסן הצל״ם', hidden: true, count: 4, have: 0 },
        { id: 'tray', text: 'החזר את הדוח למגש במשרד', hidden: true },
        { id: 'bed', text: 'חזור למיטה', hidden: true },
      ];
      it({ label: 'קח את טופס הצל״ם', pos: () => this.clip.position, enabled: () => this.clip.visible, use: () => {
        this.clip.visible = false; g.audio.paper(); this.done('clip');
        this.read('zalam');
        this.obj('zalam').hidden = false; this.refresh();
        W.openDoor('E'); g.audio.play('sfx_locker', { pos: v3(33, 1, 13), rate: 0.6, volume: 1.4 });
        g.ui.toast('מחסן הצל״ם נפתח');
        Y.noiseAt(33, 13, 14);
      } });
      for (const z of this.zalamItems) {
        z.glint.visible = true;
        it({ label: `בדוק ${z.name}`, pos: () => z.mesh.position, range: 1.7, enabled: () => !locks.E && !z.done && this.obj('clip').done, use: () => {
          z.done = true; z.glint.visible = false; g.audio.paper();
          const o = this.obj('zalam'); o.have++; this.refresh();
          g.ui.note(this.formHtml());
          g.state = 'note';
          if (z.id === 'z4') this.after(0.2, () => g.audio.stinger('discover'));
          if (o.have >= 4) { this.done('zalam'); this.obj('tray').hidden = false; this.refresh(); this.equipmentScare(); }
        } });
      }
      it({ label: 'הנח את הדוח במגש', pos: () => this.trayPaper.position, enabled: () => this.obj('zalam').done && !this.trayPaper.visible, use: () => {
        this.trayPaper.visible = true; g.audio.paper(); this.done('tray');
        show('key2');
        g.ui.toast('משהו נפל מהמגירה...');
      } });
      pickupIt('key2', 'קח מפתח', () => { this.flags.key2 = true; g.audio.keys(); g.ui.toast('מפתח שער 2/4'); this.flags.canSleep = true; this.obj('bed').hidden = false; this.refresh(); this.after(3, () => g.audio.play('y_hum', { volume: 0.6, verb: 0.9 })); });
      this.after(4, () => Y.spawn(66, 27, 'patrol', -Math.PI / 2));
      this.after(2.5, () => this.pa('y_pa2'));
      // a girl in a wet uniform at the end of the corridor, once the report is done
      this.when(() => this.obj('zalam').done && P.pos.x > 19.5 && P.pos.x < 22.5 && P.pos.z < 13, () => this.apparition(21, 23.2, 4));
      this.when(() => roomAt(P.pos.x, P.pos.z) === 'b', () => { g.audio.stinger('discover'); });
    }
    if (n === 3) {
      P.hasLight = true;
      W.power = false;
      list = [
        { id: 'fuses', text: 'מצא נתיכים', count: 3, have: 0 },
        { id: 'power', text: 'הכנס את הנתיכים ללוח בחדר הגנרטור', hidden: true },
        { id: 'lever', text: 'הפעל את הגנרטור', hidden: true },
        { id: 'cctv', text: 'בדוק את חדר המצלמות', hidden: true },
        { id: 'iso', text: 'היכנס לאגף הבידוד', hidden: true },
        { id: 'file', text: 'קרא את התיק הרפואי', hidden: true },
        { id: 'key3', text: 'מצא את מפתח השער השלישי', hidden: true },
        { id: 'bed', text: 'חזור למיטה', hidden: true },
      ];
      for (const f of ['fuse1', 'fuse2', 'fuse3']) { show(f); pickupIt(f, 'קח נתיך', () => { const o = this.obj('fuses'); o.have++; this.refresh(); if (o.have >= 3) { this.done('fuses'); this.obj('power').hidden = false; this.refresh(); } }); }
      it({ label: 'הכנס נתיכים', pos: () => v3(W.fusePanel.x - 0.1, 1.45, W.fusePanel.z), enabled: () => this.obj('fuses').done && !this.obj('power').done, hold: 1.5, use: () => { this.done('power'); this.obj('lever').hidden = false; this.refresh(); g.audio.click(); } });
      it({ label: 'משוך את הידית', pos: () => v3(W.leverPos.x - 0.1, 1.3, W.leverPos.z), enabled: () => this.obj('power').done && !this.obj('lever').done, use: () => this.powerOn() });
      this.after(3, () => Y.spawn(10, 27, 'patrol', Math.PI / 2));
      this.after(5, () => this.pa('y_pa3'));
      this.after(1, () => g.audio.play('n_laugh', { pos: v3(53, 1.5, 39), volume: 0.8, sub: false }));
    }
    if (n === 4) {
      P.hasLight = true;
      list = [
        { id: 'mop', text: 'קח מגב מהמקלחות' },
        { id: 'clean', text: 'נקה את שלוליות הדם במסדרונות', hidden: true, count: 4, have: 0 },
        { id: 'store', text: 'היכנס למחסן של יסמין', hidden: true },
        { id: 'key4', text: 'מצא את מפתח השער האחרון', hidden: true },
        { id: 'bed', text: 'חזור למיטה', hidden: true },
      ];
      show('mop');
      pickupIt('mop', 'קח מגב', () => { this.carryMop = true; this.done('mop'); this.obj('clean').hidden = false; this.refresh(); for (const p of this.puddles) p.mesh.visible = true; });
      for (const [x, z] of this.puddleSpots) {
        const m = W.decal(T.puddleTex(true), x, z, 1.8, 1.4, Math.random() * 3);
        const p = { mesh: m, x, z, clean: false };
        this.puddles.push(p);
        it({ label: 'נקה (החזק)', pos: () => v3(x, 0.4, z), range: 2.2, hold: 2.6, enabled: () => this.carryMop && !p.clean,
          onHold: () => { if (Math.random() < 0.06) g.audio.mopSwish(); if (!p.heard) { p.heard = true; Y.noiseAt(x, z, 12); } },
          use: () => {
            p.clean = true; W.decals.remove(m);
            const o = this.obj('clean'); o.have++; this.refresh();
            g.audio.play('sfx_mop', { pos: v3(x, 0.2, z), volume: 1.2 });
            if (o.have >= 4) {
              this.done('clean'); this.openStore();
              // checkpoint: getting caught after this point restarts at the open store
              g.checkpoint = { night: 4, apply: () => {
                const mi = this.items.mop; mi.taken = true; mi.mesh.visible = mi.glint.visible = false;
                this.carryMop = true; this.done('mop'); this.obj('clean').hidden = false;
                for (const q of this.puddles) { q.clean = true; W.decals.remove(q.mesh); }
                const c = this.obj('clean'); c.have = 4; this.done('clean');
                P.pos.set(64, 0, 11); P.yaw = 0;
                this.openStore();
              } };
            }
          } });
      }
      this.after(2, () => { g.audio.static_(0.6, 0.18); g.audio.play('y_misdar', { volume: 1.1, verb: 1, muffle: false }); g.ui.toast('מסדר ניקיון!'); });
      this.after(6, () => Y.spawn(40, 27, 'patrol', Math.PI / 2));
      pickupIt('key4', 'הכנס יד לדלי', () => {
        this.flags.key4 = true; g.audio.keys(); g.audio.play('sfx_mop', { volume: 1, pos: v3(68.3, 0.5, 6.6) });
        g.ui.toast('מפתח שער 4/4'); this.done('key4'); this.flags.canSleep = true; this.obj('bed').hidden = false; this.refresh();
        this.storeAmbush();
      }, 1.6);
    }
    if (n === 5) {
      P.hasLight = true;
      W.alarm = 1;
      ['key1', 'key2', 'key3', 'key4'].forEach(k => this.flags[k] = true);
      list = [
        { id: 'exit', text: 'פתח את דלת היציאה בסוף המבוך' },
        { id: 'gate', text: 'פתח את השער', hidden: true },
        { id: 'run', text: 'ברח!', hidden: true },
      ];
      it({ label: 'פתח את דלת היציאה (4 מפתחות)', pos: () => v3(35, 1.1, 43.8), range: 2.0, hold: 2.2, enabled: () => locks.X,
        onHold: () => { if (Math.random() < 0.08) g.audio.keys(); },
        use: () => {
          W.openDoor('X'); g.audio.play('sfx_door', { pos: v3(35, 1, 45), volume: 1.4 }); this.done('exit'); this.obj('gate').hidden = false; this.refresh(); this.finale();
          g.checkpoint = { night: 5, apply: () => { W.openDoor('X'); this.done('exit'); this.obj('gate').hidden = false; this.refresh(); P.pos.set(35, 0, 46.5); P.yaw = Math.PI; this.mazeGuide = -1; this.finale(); } };
        } });
      it({ label: 'פתח את המנעול בשער (החזק)', pos: () => v3(37.4, 1.1, 64.3), range: 2.4, hold: 4.0, enabled: () => !locks.X && gateClosed.v,
        onHold: () => { if (Math.random() < 0.05) g.audio.keys(); if (Math.random() < 0.03) g.audio.play('sfx_gate', { pos: v3(37, 1, 65), volume: 0.6, sub: false }); },
        use: () => { gateClosed.v = false; W.gate.target = 1; g.audio.play('sfx_gate', { pos: v3(36, 1, 65), volume: 1.5 }); g.audio.grind(4.5); this.done('gate'); this.obj('run').hidden = false; this.refresh(); } });
      this.when(() => P.pos.z > 67, () => g.escape());
      this.after(1.5, () => this.pa('y_pa5'));
      this.after(6, () => { Y.spawn(52, 27, 'patrol', -Math.PI / 2); });
      // in the yard she reminds you of Ruth
      this.when(() => g.finale && P.pos.z > 52 && Y.state === 'chase', () => Y.speak('y_ruth', { force: true }));
    }
    this.setObjectives(list);
  }

  // ---------- scripted bits ----------
  after(t, fn) { this.timers.push({ t, fn }); }
  when(test, fn) { this.events.push({ test, fn }); }

  // Yasmin over the loudspeakers: everywhere at once.
  pa(name) {
    const g = this.g;
    g.audio.static_(0.5, 0.12);
    this.after(0.35, () => g.audio.play(name, { volume: 1.0, verb: 0.9, muffle: false }));
    g.ui.toast('📢', 1.5);
  }

  // Ruth's ghost stands somewhere for a moment, then she is gone.
  apparition(x, z, dur = 4, quiet = false) {
    const g = this.g;
    this.ghost.show(x, z, 0.8);
    if (!quiet) g.audio.stinger('peek');
    g.audio.noise(2.5, { type: 'bandpass', f: 600, q: 4, vol: 0.06, f2: 300, verb: 1 });
    let gone = false;
    const vanish = () => { if (gone) return; gone = true; this.ghost.hide(); g.player.flicker = 0.25; };
    this.after(dur, vanish);
    this.when(() => Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 4.5, vanish);
  }

  onTapeEnd(n) {
    const g = this.g, P = g.player;
    if (n === 1 && !this.flags.ghost1) {
      // she was standing in your doorway the whole time
      this.flags.ghost1 = true;
      const f = P.forward(v3(0, 0, 0));
      if (P.pos.z < 8.5) this.apparition(7, 9.2, 3);
    }
  }

  read(id) { this.g.audio.paper(); this.g.ui.note(NOTES[id]); this.g.state = 'note'; }
  discover(id) {
    if (this.flags['d_' + id]) return;
    this.flags['d_' + id] = true;
    this.g.audio.stinger('discover');
    this.g.discovered(id);
  }
  formHtml() {
    const rows = this.zalamItems.map(z => `<tr><td>${z.name}</td><td class="${z.done ? 'ok' : ''}">${z.done ? z.serial + ' ✓' : ''}</td></tr>`).join('');
    const done = this.zalamItems.every(z => z.done);
    return `<h3>דוח צל״ם — מחסן</h3><table>${rows}</table>${done ? '<p class="blood" style="margin-top:12px">"פנס ראש — מוכתם". מוכתם במה?</p>' : ''}`;
  }

  // She stands far away, then the lights go and she's gone.
  peek(x, z, dir, dur, line) {
    const g = this.g, Y = g.yasmin;
    if (Y.state === 'chase') return;
    Y.spawn(x, z, 'scripted', dir);
    Y.script = null; Y.scriptMove = 0;
    g.audio.stinger('peek');
    if (line) this.after(0.8, () => Y.speak(line, { force: true }));
    let gone = false;
    const vanish = () => {
      if (gone) return; gone = true;
      g.flashBlackout(0.35);
      this.after(0.12, () => { Y.hide(); });
    };
    this.after(dur, vanish);
    this.when(() => Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < 11, vanish);
  }

  rollTheBucket() {
    const g = this.g, b = this.rollBucket;
    const h = g.audio.play('sfx_bucket', { pos: v3(43, 0.4, 8), volume: 1.4, loop: true });
    let t = 0;
    const W = g.world;
    W.dynamic.push({ update: (dt) => {
      if (t > 3) return;
      t += dt;
      const k = Math.min(1, t / 2.6);
      b.position.z = 6.5 + k * 4.6; b.rotation.y = Math.sin(t * 3) * 0.1;
      if (h && h.panner) g.audio.setPos(h.panner, v3(b.position.x, 0.4, b.position.z));
      if (t > 2.6 && h) { h.stop(0.3); }
    } });
    g.audio.stinger('peek');
  }

  equipmentScare() {
    // the store's lights die one by one and she comes to look
    const g = this.g, W = g.world;
    const inE = W.fixtures.filter(f => f.room === 'e');
    inE.forEach((f, i) => this.after(0.4 + i * 0.35, () => { f.on = false; g.audio.bulbPop(v3(f.x, f.y, f.z)); }));
    this.after(1.6, () => g.ui.toast('היא שמעה. כבה את הפנס ותתחבא!', 3.5));
    this.after(4.5, () => { const Y = g.yasmin; if (Y.state !== 'chase') { Y.spawn(33, 7, 'investigate', 0); Y.lastSeen.set(33, 0, 16); Y.goTo(33, 18); Y.speak('y_where', { force: true }); } });
    this.after(30, () => inE.forEach(f => f.on = true));
  }

  powerOn(silent = false) {
    const g = this.g, W = g.world;
    this.done('lever');
    if (!silent) { g.audio.lever(); g.audio.play('sfx_power', { volume: 1.3 }); g.audio.grind(1.5); }
    // checkpoint: getting caught after this point restarts here
    g.checkpoint = { night: 3, apply: () => {
      for (const f of ['fuse1', 'fuse2', 'fuse3']) { const p = this.items[f]; p.taken = true; p.mesh.visible = p.glint.visible = false; }
      const o = this.obj('fuses'); o.have = 3; o.done = true; this.obj('power').hidden = false; this.obj('power').done = true; this.obj('lever').hidden = false;
      g.player.pos.set(62.5, 0, 17.4); g.player.yaw = Math.PI / 2;
      this.powerOn(true);
    } };
    // lights return in a wave, closest first
    W.power = true;
    const P = g.player.pos;
    for (const f of W.fixtures) { const d = Math.hypot(f.x - P.x, f.z - P.z); f.on = false; this.after(0.3 + d * 0.04 + Math.random() * 0.2, () => { f.on = true; }); }
    W.openDoor('I');
    this.obj('cctv').hidden = false; this.refresh();
    this.after(2.5, () => { g.audio.play('sfx_distant', { pos: v3(53, 1, 40), volume: 1.2 }); g.ui.toast('הדלת של אגף הבידוד נפתחה'); });
    // the camera room scare
    this.when(() => roomAt(P.x, P.z) === 'c', () => this.cctvScare());
    this.when(() => roomAt(P.x, P.z) === 'i' && !this.obj('iso').done, () => { this.done('iso'); this.obj('file').hidden = false; this.obj('key3').hidden = false; this.refresh(); this.items.key3.mesh.visible = this.items.key3.glint.visible = true; });
    const take = () => {
      const p = this.items.key3; p.taken = true; p.mesh.visible = p.glint.visible = false;
      this.flags.key3 = true; g.audio.keys(); g.audio.pickup(); g.ui.toast('מפתח שער 3/4'); this.done('key3');
      this.flags.canSleep = true; this.obj('bed').hidden = false; this.refresh();
      // she looks in from the wing's door, then goes back to her rounds
      this.after(1.5, () => { if (g.yasmin.state !== 'chase') { this.peek(57, 27.4, 0, 3, 'y_hear'); this.after(4, () => { if (!g.yasmin.visible) g.yasmin.spawn(6, 27, 'patrol', Math.PI / 2); }); } });
    };
    this.inter.push({ label: 'פתח את הארון וקח מפתח', pos: () => this.items.key3.mesh.position, range: 1.8, enabled: () => this.items.key3.mesh.visible, use: take });
  }

  cctvScare() {
    const g = this.g, Y = g.yasmin, P = g.player;
    this.done('cctv');
    this.obj('iso').hidden = false; this.refresh();
    let looked = 0;
    this.when(() => {
      // looking at the monitors for a moment
      const f = P.forward(v3(0, 0, 0));
      if (f.z < -0.6 && P.pos.z < 6) looked += 1 / 60;
      return looked > 2.2;
    }, () => {
      if (Y.state === 'chase') return;
      // she is standing in the doorway behind you — visible on CAM 4
      Y.spawn(53, 8.6, 'scripted', Math.PI);
      Y.play('idle', 0.1);
      g.audio.static_(0.5, 0.06);
      this.after(2.6, () => {
        for (const s of this.screens) s.mat.uniforms.noise.value = 1;
        g.audio.static_(1.5, 0.3);
        g.audio.stinger('peek');
        Y.speak('y_hear', { force: true });
        this.after(1.2, () => { Y.setState('patrol'); Y.startChase(P, g); });
        this.after(3, () => { for (const s of this.screens) s.mat.uniforms.noise.value = 0.15; });
      });
    });
  }

  openStore() {
    const g = this.g, W = g.world;
    W.openDoor('J');
    g.audio.play('sfx_door', { pos: v3(65, 1, 9), volume: 1.3, rate: 0.7 });
    g.ui.toast('משהו נפתח בקצה המסדרון...');
    this.obj('store').hidden = false; this.refresh();
    this.when(() => roomAt(g.player.pos.x, g.player.pos.z) === 'j', () => { this.done('store'); this.obj('key4').hidden = false; this.refresh(); this.items.key4.mesh.visible = this.items.key4.glint.visible = true; g.audio.stinger('discover'); this.discover('store'); });
  }

  storeAmbush() {
    const g = this.g, Y = g.yasmin;
    this.candles = false;
    g.audio.play('y_hear', { pos: v3(65, 1.6, 9.5), volume: 1.4 });
    // she screams in the doorway, the lights cut out, and when they come back she is gone —
    // then she comes running from the far end of the base, so there is a way out
    this.after(0.4, () => { Y.spawn(65, 11, 'scripted', Math.PI); Y.play('scream', 0.1); g.audio.stinger('peek'); });
    this.after(2.0, () => { g.flashBlackout(0.5); this.after(0.25, () => Y.hide()); });
    this.after(4.5, () => { Y.spawn(69, 27, 'patrol', Math.PI); Y.startChase(g.player, g); Y.lostT = 0.7; });
    this.after(3.0, () => g.ui.toast('ברח! תמצא איפה להתחבא'));
  }

  finale() {
    const g = this.g, Y = g.yasmin;
    g.finale = true;
    g.world.alarm = 1;
    g.audio.stinger('riser');
    this.after(1.5, () => {
      Y.spawn(27, 31, 'patrol', Math.PI / 2);
      Y.setNight(5, g.settings.difficulty);
      Y.startChase(g.player, g);
      Y.speak('y_chase', { force: true });
    });
  }

  update(dt, t) {
    const g = this.g;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i]; tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (e.test()) { this.events.splice(i, 1); e.fn(); }
    }
    // gentle hints when stuck
    this.stuckT += dt;
    if (this.stuckT > 150) {
      this.stuckT = 0;
      const o = this.objs.find(o => !o.done && !o.hidden && HINTS[o.id]);
      if (o) { g.ui.sub('רמז: ' + HINTS[o.id], 7); g.audio.click(); }
    }
    // Ruth's ghost; on the last night she shows the way through the maze
    this.ghost.update(dt, t, g.player.cam);
    if (this.mazeGuide >= 0 && this.mazeGuide < MAZE_GUIDE.length && !g.finale) {
      const [gx, gz] = MAZE_GUIDE[this.mazeGuide];
      const P0 = g.player.pos;
      const d = Math.hypot(P0.x - gx, P0.z - gz);
      if (!this.ghost.shown && d < 9 && d > 4 && lineOfSight(P0.x, P0.z, gx, gz, opaque) && roomAt(P0.x, P0.z) === 'm') {
        this.ghost.show(gx, gz, 0.7);
        g.audio.noise(1.6, { type: 'bandpass', f: 500, q: 5, vol: 0.05, f2: 260, verb: 1 });
      }
      if (this.ghost.shown && d < 3.2) { this.ghost.hide(); this.mazeGuide++; g.player.flicker = 0.15; }
    }
    // glints pulse
    const pulse = 0.25 + 0.25 * Math.sin(t * 3);
    for (const p of this.pickups) if (p.glint.visible) p.glint.material.opacity = pulse;
    for (const z of this.zalamItems) if (z.glint.visible) z.glint.material.opacity = pulse;
    for (const tp of this.tapeMeshes) if (tp && tp.glint.visible) tp.glint.material.opacity = pulse;
    for (const b of this.bottleMeshes) if (b.glint.visible) b.glint.material.opacity = pulse * 0.7;
    // Nevo: holds his head and mutters; rushes to the glass the first time you come close
    this.nevoMixer.update(dt);
    const P = g.player.pos;
    const dn = Math.hypot(P.x - 53, P.z - 31.5);
    if (!locks.I && P.z > 29.5 && P.z < 33 && P.x > 47 && P.x < 59) {
      if (this.nevoState === 'rock' && dn < 6) {
        this.nevoState = 'rush'; this.rushT = 0;
        g.audio.play('n_whisper', { pos: v3(53, 1.6, 34.5), volume: 1.5 });
        g.audio.stinger('peek');
      }
    }
    if (this.nevoState === 'rush') {
      this.rushT += dt;
      const k = Math.min(1, this.rushT / 0.45);
      this.nevo.position.z = 39.5 - k * 5.0;
      if (this.rushT > 0.45 && !this.flags.thud) { this.flags.thud = true; g.audio.tone(70, 0.4, { vol: 0.8, pos: v3(53, 1.4, 33.6) }); g.audio.noise(0.2, { type: 'lowpass', f: 900, vol: 0.5, pos: v3(53, 1.4, 33.6) }); g.player.shake = 0.7; }
      if (this.rushT > 4) this.nevoState = 'glass';
    }
    if (this.nevoState !== 'rock' && dn < 9) {
      this.nevoVoiceT -= dt;
      if (this.nevoVoiceT < 0) {
        const lines = ['n_count', 'n_cry', 'n_ruth', 'n_laugh', 'n_whisper'];
        this.nevoVoiceT = 9 + Math.random() * 4;
        g.audio.play(lines[this.nevoLine++ % lines.length], { pos: v3(this.nevo.position.x, 1.6, this.nevo.position.z), volume: 1.2 });
      }
    }
  }
}
