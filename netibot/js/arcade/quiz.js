// The platoon quiz show (הבוחן של הפלגה): ten questions on a stage with colored podiums, the
// platoon's "queen" hosting with a crown and a microphone, the platoon officer heckling from
// the side. Four answers, answer fast for more points, the last question counts double.
// Solo against three soldiers from the platoon; online everyone gets the same questions
// (from the shared seed) and each phone keeps its own score, shown to the others.
//
// Cast members only ever appear as {@id} tokens, so the same questions work with the public
// made-up cast and with the real one.

// a[0] is always the right answer; they're shuffled when asked. cat: 'cast' (who's who),
// 'lore' (the game itself), 'dome' (the real thing). say: the host's line on the reveal.
const QUIZ_POOL = [
  { cat: 'cast', q: 'מי שואלת כל פעם מחדש "שתית מים?"', a: ['{@medic1}', '{@madag}', '{@commander}', '{@rasap}'], say: 'שתית מים? ...מה? זה מדבק.' },
  { cat: 'cast', q: 'מה {@p_liran} אומר כשהוא מתרגש?', a: ['"אוגה בוגה!"', '"וואלה!"', '"חיים שלי!"', '"מון דיה!"'], say: 'אוגה בוגה. אוגה אוגה. ...סליחה, נדבק לי.' },
  { cat: 'cast', q: 'מאיזה קיבוץ {@p_arad}?', a: ['חולדה', 'דגניה', 'עין גדי', 'יטבתה'], say: 'חולדה! הקיבוץ עם הנפיחות הכי גבוהות בארץ.' },
  { cat: 'cast', q: 'מי בפלגה מעריצה של ספיידרמן?', a: ['{@p_rotem}', '{@p_hila}', '{@p_shaked}', '{@p_miriam}'], say: 'יש לה פלסטר של ספיידרמן. הוא מרפא פי שניים.' },
  { cat: 'cast', q: 'מי חיה מכושר ומברוקולי?', a: ['{@p_shaked}', '{@p_rotem}', '{@inspector}', '{@p_hila}'], say: 'ברוקולי לארוחת בוקר. ברוקולי לצהריים. ובערב? שייק ברוקולי.' },
  { cat: 'cast', q: 'מי מחזיק בתואר "הכי מבצעי בפלגה"?', a: ['{@p_ofek}', '{@p_nevo}', '{@p_shalev}', '{@p_aharon}'], say: 'הכי מבצעי. וגם יודע איפה כל השירותים באתר. זה קשור.' },
  { cat: 'cast', q: 'מי יעבור לגולני — ביום שגולני יעברו לנתיבות?', a: ['{@p_shalev}', '{@p_liran}', '{@p_ofek}', '{@p_arad}'], say: 'בגולני יש כומתה חומה. אצלנו יש מזגן. קשה להחליט.' },
  { cat: 'cast', q: 'מי בנה את המשחק הזה?', a: ['{@friend}', '{@bc}', '{@ops}', '{@p_ofek}'], say: 'בשמירות לילה. לכן יש בו כל כך הרבה שמירות לילה.' },
  { cat: 'cast', q: 'מאיפה {@p_miriam}?', a: ['ירושלים', 'אילת', 'חיפה', 'נתיבות'], say: 'חיים שלי, רוגלך למי שענה נכון!' },
  { cat: 'cast', q: 'איזו שפה {@p_aharon} מדבר כשהוא מתעצבן?', a: ['צרפתית', 'רוסית', 'אמהרית', 'ספרדית'], say: 'Oh là là! ...זה כל הצרפתית שאני יודעת.' },
  { cat: 'cast', q: 'מה {@deputy_rasap} לא מוריד אף פעם, גם לא בלילה?', a: ['משקפי שמש', 'כומתה', 'אפוד', 'כפכפים'], say: '"זו הגנה מפני שאלות." ...טוב, אז לא אשאל.' },
  { cat: 'cast', q: 'מה {@deputy_rasap} מחביא ומכחיש שבכלל קיים?', a: ['ארונית חטיפים', 'מחסנית רזרבית', 'כלב', 'את הפנס שלי'], say: '"איזו ארונית? אין ארונית." ...יש ארונית.' },
  { cat: 'cast', q: 'מה {@rasap} צריכה ממך על כל דבר?', a: ['חתימה', 'סלפי', 'מאה שקל', 'שיר'], say: 'חתמת על התשובה? לא? אז היא לא נחשבת. ...טוב, נחשבת.' },
  { cat: 'cast', q: 'מה יש ל{@madag} תמיד על הצוואר?', a: ['משרוקית', 'מפתחות', 'מגבת', 'שעון עצר'], say: '*פייייייי!* ...סליחה. רפלקס.' },
  { cat: 'cast', q: 'באיזו תוכנה {@bc} חיה?', a: ['אקסל', 'טיקטוק', 'פוטושופ', 'מיינקראפט'], say: 'יש לה גיליון לכל דבר. גם לגיליונות.' },
  { cat: 'cast', q: 'מה {@bc} שומעת בסוף יום ארוך?', a: ['שופן', 'מזרחית בווליום', 'פודקאסט על אקסל', 'את הסירנה'], say: 'שופן. ובגלל זה קריוקי מפיל אותה. מדע.' },
  { cat: 'cast', q: 'מה {@deputy_bc} צועקת כשצריך מהר?', a: ['"דבאי!"', '"יאללה!"', '"ואמוס!"', '"צ\'יק צ\'אק!"'], say: 'דבאי זה "יאללה". בליסטרו זה "מהר". ביחד זה "עכשיו".' },
  { cat: 'cast', q: 'מי מלכת מסדרי הניקיון?', a: ['{@inspector}', '{@sergeant}', '{@commander}', '{@p_hila}'], say: 'היא ישנה עם פנס. בשביל השערות.' },
  { cat: 'cast', q: 'מי המלכה של הפלגה?', a: ['{@sergeant}', '{@inspector}', '{@p_miriam}', '{@hamalist}'], say: 'אני! מי עוד? 👑 תודה, תודה, אין צורך במחיאות כפיים. ...טוב, יש.' },
  { cat: 'cast', q: 'מתי {@hamalist} מפסיקה לדבר?', a: ['אף פעם', 'ב־22:00', 'בשבת', 'כשהיא ישנה'], say: 'גם כשהיא ישנה. בדקנו.' },
  { cat: 'cast', q: 'כמה מים {@p_ofek} שותה במשמרת?', a: ['שלושה ליטר', 'כוס אחת', 'אף טיפה, רק אנרגיה', 'ליטר וחצי'], say: 'ואין שירותים בעמדה. תחשבו על זה רגע.' },
  { cat: 'cast', q: 'מה הכינוי של {@commander}?', a: ['"שני ארונות"', '"הפנס"', '"שקשוקה"', '"המיירטת"'], say: 'אחד לציוד, ואחד לציוד שהיא מחרימה ממך.' },
  { cat: 'cast', q: 'מי בפלגה "לא משוגעת, רק מרובת אנרגיות"?', a: ['{@p_hila}', '{@p_rotem}', '{@p_shaked}', '{@p_miriam}'], say: 'ככה כתוב בטופס. אז זה רשמי.' },
  { cat: 'cast', q: 'מה {@harasar} הכי אוהב לבדוק?', a: ['את התלבושת', 'את המטבח', 'את הנשקים', 'את מזג האוויר'], say: 'חוגר, נעליים, גילוח. ובסוף — עוד פעם חוגר.' },
  { cat: 'lore', q: 'ממה צ\'יזבורגרו הכי מפחד?', a: ['אוכל בריא', 'שמירות', 'מים קרים', '{@harasar}'], say: 'ברוקולי! גזר! פריכיות! *צ\'יזבורגרו בוכה בפינה*' },
  { cat: 'lore', q: 'למה {@deputy_rasap} הופך כשמשהו נשבר בו?', a: ['צ\'יזבורגרו', 'מפלצת נהלים', 'נץ מדבר', 'פלאפל מעופף'], say: 'מפלצת צ\'יזבורגר ענקית. עם שומשום על הכתפיים.' },
  { cat: 'lore', q: 'מה זורקים על {@hamalist} כשצומחות לה כנפיים?', a: ['ריטלין, מרדים ומחסום פה', 'קפה, קפה וקפה', 'פיתות עם חריף', 'אטמי אוזניים'], say: 'ואז, בפעם הראשונה בהיסטוריה — שקט בחמ"ל.' },
  { cat: 'lore', q: 'מה מביס את {@harasar} בקרב?', a: ['תלבושת מושלמת', 'בדיחה טובה', 'גפילטע פיש', 'קריוקי וגרעינים'], say: 'נעליים מצוחצחות, כומתה מקופלת, גילוח וחוגר. ופתאום אין לו מה להגיד.' },
  { cat: 'lore', q: 'מה {@bc} זורקת כשהיא הופכת לענקית?', a: ['גפילטע פיש', 'דו"חות', 'צ\'יזבורגרים', 'בלונים'], say: 'ומה מביס אותה? קריוקי וגרעינים שחורים. מתבקש.' },
  { cat: 'lore', q: 'איך כולם קוראים לאתר ליד נתיבות?', a: ['נתיבוט', 'נתיבולנד', 'הגבעה', 'החולית'], say: 'נתיבוט. כמו המשחק. צירוף מקרים מוחלט.' },
  { cat: 'lore', q: 'מה זה פלג"צ?', a: ['הפלגה הצעירה', 'פלוגת צנחנים', 'פלאפל, גלידה, צ\'יפס', 'פיקוד לוגיסטי צבאי'], say: 'פלאפל, גלידה וצ\'יפס — רק בסופ"ש.' },
  { cat: 'lore', q: 'כמה ימים נמשך פלג"צ?', a: ['חמישה', 'שבוע וחצי', 'חודש', 'עד ש{@harasar} מרוצה'], say: 'רשמית — חמישה. רגשית — שנה.' },
  { cat: 'lore', q: 'כמה נקודות צריך בציון פלג"צ כדי לעבור?', a: () => [`${DATA.passScore}`, `${DATA.passScore * 2}`, `${Math.round(DATA.passScore / 3)}`, 'מיליון'], say: 'ולעבור 3 מתוך 4 חלקי מבחן הסיום. אין הנחות.' },
  { cat: 'lore', q: () => `בנתיבות, כמה זמן יש מהאזעקה עד שצריך להיות במיגונית?`, a: () => [`${DATA.redAlertSeconds} שניות`, `${DATA.redAlertSeconds * 2} שניות`, 'דקה וחצי', '5 שניות'], say: 'ובלי צרחות. {@commander} ביקשה.' },
  { cat: 'lore', q: 'מה {@cur_ortal} עושה ליד השער?', a: ['מצלמת סטורי', 'מוכרת פלאפל', 'מחפשת את הרס"פ', 'עושה ש"ג'], say: 'עם מיקום והכל. ...זה עלה לייב.', need: 'cur_ortal' },
  { cat: 'dome', q: 'איך נקרא הטיל המיירט של כיפת ברזל?', a: ['תמיר', 'חץ', 'פטריוט', 'שרביט'], say: 'תמיר! וכל אחד עולה יותר מהמכונית של אבא שלך.' },
  { cat: 'dome', q: 'מה כיפת ברזל עושה לרקטה שתיפול בשטח פתוח?', a: ['נותנת לה ליפול', 'מיירטת פעמיים, ליתר ביטחון', 'שולחת הודעה לחמ"ל', 'מצלמת לסטורי'], say: 'חבל על התמיר. {@bc} כבר פתחה על זה גיליון.' },
  { cat: 'dome', q: 'כמה מיירטים יש במשגר אחד של כיפת ברזל?', a: ['20', '4', '7', '100'], say: 'עשרים. במשחקון קיבלת רק 16 — {@bc} עשתה תקציב.' },
  { cat: 'dome', q: 'מי מפתחת את כיפת ברזל?', a: ['רפאל', 'אלביט', 'אינטל', 'תנובה'], say: 'תנובה מפתחת קוטג\'. זה גם חשוב. אבל לא.' },
  { cat: 'dome', q: 'באיזו שנה כיפת ברזל יירטה רקטה בפעם הראשונה?', a: ['2011', '2006', '2016', '1999'], say: 'אפריל 2011. מאז — אלפי יירוטים. ואף יונה. ...כמעט.' },
  { cat: 'dome', q: 'מה התפקיד של המכ"ם בסוללה?', a: ['לגלות ולעקוב אחרי האיום', 'לחמם את הקפה', 'לצלם את השער', 'לקלוט רדיו'], say: 'הוא רואה הכל. כמו {@inspector}, רק בלי להעיר.' },
  { cat: 'dome', q: 'איזו מערכת מיירטת טילים בליסטיים ארוכי טווח?', a: ['חץ', 'כיפת ברזל', 'תמיר', 'מגן דוד אדום'], say: 'חץ למעלה, כיפה באמצע, ואנחנו — למטה, במיגונית.' },
  { cat: 'dome', q: 'מה צבע הכומתה של חיל האוויר?', a: ['כחולה־אפורה', 'ירוקה', 'חומה', 'סגולה'], say: 'חומה זה גולני. {@p_shalev}, תפסיק לחלום.' },
  { cat: 'dome', q: 'מה זה כטב"ם?', a: ['כלי טיס בלתי מאויש', 'כלי טיס בלי מזגן', 'כמה טילים, בערך, מחר', 'כיפה טובה, ברזל מצוין'], say: 'בלתי מאויש. כמו המטבח בשבת בבוקר.' },
  { cat: 'dome', q: 'מה זה "מטח"?', a: ['הרבה רקטות בבת אחת', 'רקטה אחת גדולה במיוחד', 'הפסקת קפה בחמ"ל', 'מסדר ניקיון מפתיע'], say: '{@hamalist} קוראת לזה "יום שלישי".' },
  { cat: 'dome', q: 'מה עושים כשיש צבע אדום?', a: ['רצים למיגונית', 'מצלמים את השמיים', 'ממשיכים לאכול', 'מתקשרים לאמא'], say: 'קודם מיגונית. אמא — אחרי.' },
  { cat: 'dome', q: 'איך קוראים למבנה הבטון הקטן שרצים אליו באזעקה?', a: ['מיגונית', 'מכולה', 'ש"ג', 'קנטינה'], say: 'מיגונית. הנכס הכי מבוקש בנתיבות. גם בלי נוף.' },
];
const QUIZ_COLORS = [
  { c: '#e8392b', dark: '#7a1a12', icon: '✦', hex: 0xe8392b },
  { c: '#2f7fe0', dark: '#123a72', icon: '🛡️', hex: 0x2f7fe0 },
  { c: '#f2c12e', dark: '#7a5a0a', icon: '⚡', hex: 0xf2c12e },
  { c: '#3fae3a', dark: '#1a5a18', icon: '🌿', hex: 0x3fae3a },
];
// Podium colors, one per contestant.
const QUIZ_PODIUM = [0xe8392b, 0x2f7fe0, 0xf2c12e, 0x3fae3a, 0xb36bff, 0xff8a2a];
const QUIZ_HOST = {
  intro: ['ערב טוב {platoon}!!! ברוכים הבאים לבוחן של הפלגה! 👑', 'שלום שלום! מי מוכן להיכשל מול כל הפלגה? 🎤', 'מצלמות, אורות — ובלי להעתיק מהשכן!'],
  right: ['מלך[/ה]! 👑', 'נכון!!! ככה עונים!', 'וואו. את[ה/] גאון[/ה]. כמעט כמוני.', 'בול! {@inspector} אפילו לא מצאה מה לתקן.', 'יאאא! מישהו פה למד!', 'נכון! מגיע לך צ\'ופר. ...אין צ\'ופר. אבל נכון!'],
  wrong: ['לא. פשוט לא.', 'תורנות מטבח. על התשובה הזאת.', 'מי לימד אותך את זה?!', 'אני רושמת את זה לתחקיר.', '...אני לא כועסת. אני מאוכזבת.', 'סגרו [לו/לה] את המיקרופון. עכשיו.'],
  late: ['נרדמת? [תתעורר/תתעוררי]!', 'שתיקה זה לא תשובה. גם לא בצבא.', 'הלו? יש מישהו בבית?'],
  nobody: 'אף אחד?! אף אחד?! {platoon}, אני בהלם.',
  last: '🔥 שאלה אחרונה — שווה כפול! הכל פתוח!',
  win: ['ויש לנו מנצח[/ת]! 🏆', 'זה נגמר! וזה היה... ממש לא מביך. כמעט.'],
};

const QuizGame = {
  id: 'quiz', name: 'הבוחן של הפלגה', icon: '🎤',
  desc: 'שעשועון על במה: 10 שאלות על הפלגה, הבוסים וכיפת ברזל. מהר = יותר נקודות, האחרונה שווה כפול.',
  cover: 'assets/arcade/cover_quiz.jpg', solo: true, online: true, minOnline: 2,
  N: 10, QT: 12, RV: 4.2,

  // ---------- the stage ----------
  build() {
    if (this.scene) return;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x0c0d12);
    sc.fog = new THREE.Fog(0x0c0d12, 22, 48);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    sc.add(new THREE.HemisphereLight(0x8fa2c8, 0x2a2018, 0.55));
    const key = new THREE.DirectionalLight(0xfff0d8, 0.8);
    key.position.set(4, 9, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 8, bottom: -4, near: 1, far: 30 });
    sc.add(key);
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
    // The hall's floor, the round stage with a glowing rim, and a step down in front.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat(0x16171c, { roughness: 0.35, metalness: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.8, 0.42, 64, 1, false, -Math.PI / 2, Math.PI), mat(0x2b2d35, { roughness: 0.3, metalness: 0.4 }));
    stage.rotation.y = Math.PI; stage.position.set(0, 0.21, -2.5); stage.receiveShadow = true; sc.add(stage);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9.6, 0.05, 6, 80, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(0, 0.43, -2.5); sc.add(rim);
    this.rim = rim;
    // The back wall: the hall from Higgsfield (the lights, the big screen, the camo nets, the
    // flag), cropped above the podiums it draws.
    const wt = Arcade.texture('assets/arcade/quiz_stage.jpg');
    wt.repeat.set(1, 0.38); wt.offset.set(0, 0.62);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(31, 8.2), new THREE.MeshBasicMaterial({ map: wt }));
    wall.position.set(0, 4.5, -6.6); sc.add(wall);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(31, 1), mat(0x1c1d22));
    under.position.set(0, 0.4, -6.59); sc.add(under);
    // Over the drawn screen: our own, with the question number and the clock.
    this.screenCv = document.createElement('canvas'); this.screenCv.width = 512; this.screenCv.height = 230;
    this.screenTex = new THREE.CanvasTexture(this.screenCv); this.screenTex.encoding = THREE.sRGBEncoding;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 4.55), new THREE.MeshBasicMaterial({ map: this.screenTex }));
    screen.position.set(0, 5.28, -6.55); sc.add(screen);
    // Spotlight beams sweeping over the stage.
    this.beams = [];
    const beamGeo = new THREE.ConeGeometry(1.5, 10, 24, 1, true);
    beamGeo.translate(0, -5, 0);
    [0xff4f4f, 0x4f8fff, 0xffd23f, 0x4fe36a].forEach((c, i) => {
      const b = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      b.position.set(-7.5 + i * 5, 9.5, -3.5);
      sc.add(b);
      this.beams.push(b);
    });
    // Confetti, reused.
    this.confetti = [];
    const cg = new THREE.PlaneGeometry(0.12, 0.2);
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: [0xffd23f, 0xff4f6a, 0x4fd1ff, 0x7dff6a, 0xffffff][i % 5], side: THREE.DoubleSide }));
      m.visible = false; sc.add(m);
      this.confetti.push({ m, vy: 0, vx: 0, spin: 0, live: false });
    }
  },

  // A podium: a box with a lit front in its color, a buzzer on top, and a panel with the
  // contestant's name and score.
  podium(x, color) {
    const g = new THREE.Group();
    g.position.set(x, 0.42, 0.2);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.8), new THREE.MeshStandardMaterial({ color: 0x23252c, roughness: 0.4, metalness: 0.5 }));
    body.position.y = 0.475; body.castShadow = true; g.add(body);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.78), new THREE.MeshBasicMaterial({ color }));
    front.position.set(0, 0.5, 0.405); g.add(front);
    for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.84, 0.05), new THREE.MeshBasicMaterial({ color: 0xfff1c1 })); s.position.set(sx * 0.69, 0.5, 0.41); g.add(s); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.07, 0.9), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.3 }));
    top.position.y = 0.98; g.add(top);
    const buzzer = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.3 }));
    buzzer.position.set(0, 1.015, 0.1); g.add(buzzer);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 190;
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.77), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    panel.position.set(0, 0.5, 0.41); g.add(panel);
    this.scene.add(g);
    return { g, front, buzzer, cv, tex, color };
  },
  drawPanel(c) {
    const p = c.pod, g = p.cv.getContext('2d'), W = 256, H = 190;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(10, 12, W - 20, 54);
    g.direction = 'rtl'; g.textAlign = 'center';
    g.fillStyle = '#fff'; g.font = '800 34px Rubik, Arial';
    g.fillText((c.gone ? '🚪 ' : '') + c.name.slice(0, c.gone ? 10 : 12), W / 2, 52);
    g.font = '900 72px Rubik, Arial';
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 6;
    const s = String(Math.round(c.shown));
    g.strokeText(s, W / 2, 150); g.fillText(s, W / 2, 150);
    if (c.streak >= 3) { g.font = '700 30px Rubik, Arial'; g.fillText('🔥' + c.streak, W - 40, 182); }
    p.tex.needsUpdate = true;
  },
  drawScreen(text, sub, frac) {
    const g = this.screenCv.getContext('2d'), W = 512, H = 230;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#16224a'); gr.addColorStop(1, '#0a0f24');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,179,71,.85)'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
    g.direction = 'rtl'; g.textAlign = 'center';
    // Kept to the lower part: on a phone the question box covers the top of the screen.
    g.fillStyle = '#ffd23f'; g.font = '900 64px Rubik, Arial';
    g.fillText(text, W / 2, 126);
    g.fillStyle = '#e6ecff'; g.font = '700 30px Rubik, Arial';
    g.fillText(sub, W / 2, 172);
    if (frac != null) {
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(60, 192, W - 120, 14);
      g.fillStyle = frac < 0.25 ? '#ff5a4a' : '#ffd23f'; g.fillRect(60 + (W - 120) * (1 - frac), 192, (W - 120) * frac, 14);
    }
    this.screenTex.needsUpdate = true;
  },
  // A crown for the host, out of a gold ring with points.
  crown() {
    const g = new THREE.Group(), gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0x8a5a00, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.25 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.07, 16, 1, true), gold); g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 5), gold);
      s.position.set(Math.cos(a) * 0.125, 0.07, Math.sin(a) * 0.125); g.add(s);
      const j = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), new THREE.MeshBasicMaterial({ color: [0xff3b5c, 0x3bb0ff, 0x6aff6a][i % 3] }));
      j.position.set(Math.cos(a) * 0.13, 0.0, Math.sin(a) * 0.13); g.add(j);
    }
    return g;
  },

  // The crown sits on the host's head, whatever her height: on the top of her model, pinned to
  // the head bone so it bobs with her.
  crownHost(m, cr) {
    const root = m.root, body = (m.lean && m.lean.children[0]) || root;
    root.updateMatrixWorld(true);
    let head = null;
    root.traverse(o => { if (!head && o.isBone && /head(?!.*(end|top))/i.test(o.name)) head = o; });
    const hp = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.6, 0);
    // The highest point of the (skinned) model right over the head.
    let top = -Infinity;
    const v = new THREE.Vector3();
    body.traverseVisible(o => {
      const pos = o.isMesh && o.geometry && o.geometry.attributes.position;
      if (!pos) return;
      const step = Math.max(1, Math.floor(pos.count / 6000));
      for (let i = 0; i < pos.count; i += step) {
        if (o.isSkinnedMesh) o.boneTransform(i, v); else v.fromBufferAttribute(pos, i);
        v.applyMatrix4(o.matrixWorld);
        if (v.y > top && Math.hypot(v.x - hp.x, v.z - hp.z) < 0.22) top = v.y;
      }
    });
    if (!isFinite(top) || top < hp.y) top = hp.y + 0.2;
    cr.position.copy(root.worldToLocal(new THREE.Vector3(hp.x, top - 0.03, hp.z)));
    root.add(cr);
    if (head) head.attach(cr);
  },

  // ---------- a round ----------
  enter(ctx) {
    this.build();
    this.ctx = ctx;
    this.clear();
    const rnd = Arcade.rng(ctx.seed);
    // The questions: shuffled by the seed, a mix of who's who, the game and the real thing.
    const pool = QUIZ_POOL.filter(q => !q.need || Cast.get(q.need));
    const by = (cat) => pool.filter(q => q.cat === cat).sort(() => rnd() - 0.5);
    const cast = by('cast'), lore = by('lore'), dome = by('dome');
    const pickN = [...cast.slice(0, 4), ...lore.slice(0, 3), ...dome.slice(0, 3)].sort(() => rnd() - 0.5);
    this.qs = pickN.map(q => {
      const text = typeof q.q === 'function' ? q.q() : q.q;
      const answers = (typeof q.a === 'function' ? q.a() : q.a).map((t, i) => ({ t: fmt(t), ok: i === 0 }));
      answers.sort(() => rnd() - 0.5);
      return { cat: q.cat, text: fmt(text), answers, right: answers.findIndex(a => a.ok), say: q.say };
    });
    // The contestants: online, everyone in the game; alone, you and three from the platoon.
    const list = ctx.solo
      ? [{ who: null, name: G.profile.name, isMe: true }, ...Arcade.bots(3, rnd).map(b => ({ who: b.id, name: fmt(`{@${b.id}}`), bot: true, skill: 0.4 + rnd() * 0.3 }))]
      : ctx.players.slice(0, 6).map(p => ({ who: p.isMe ? null : (Cast.get(p.who) ? p.who : null), name: p.name, isMe: p.isMe, peer: p.peer }));
    const n = list.length, span = this.span = Math.min(11, 2.3 * (n - 1));
    this.cs = list.map((c, i) => {
      const x = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
      const pod = this.podium(x, QUIZ_PODIUM[i % QUIZ_PODIUM.length]);
      const m = Arcade.soldier(this.scene, c.isMe ? Arcade.look(null) : Arcade.look(c.who));
      m.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
      return { ...c, x, pod, m, score: 0, shown: 0, streak: 0, ans: -1, ansAt: 0, react: null, reactT: 0, gain: 0 };
    });
    this.me = this.cs.find(c => c.isMe);
    this.cs.forEach(c => this.drawPanel(c));
    // The host, stage right, with her crown; the officer heckles from the wings.
    this.host = Arcade.soldier(this.scene, Arcade.look('sergeant'));
    this.crownHost(this.host, this.crown());
    this.hostX = span / 2 + 1.9;
    this.qi = -1; this.stage = 'intro'; this.t0 = null; this.ticked = -1;
    this.buildUi();
    // Keys 1-4 (and the numpad) answer, straight from the key event so a quick tap counts.
    if (!this.onKey) this.onKey = (e) => { const m = /^(Digit|Numpad)([1-4])$/.exec(e.code); if (m && !e.repeat && Arcade.active === this && !Settings.isOpen()) this.answer(+m[2] - 1); };
    removeEventListener('keydown', this.onKey);
    addEventListener('keydown', this.onKey);
    document.body.classList.add('qz-on');
    Arcade.buttons({ act: false, run: false });
    this.drawScreen('🎤', 'הבוחן של הפלגה', null);
    this.ui.q.innerHTML = `<div class="qz-text">${fmt(pick(QUIZ_HOST.intro))}</div><div class="qz-hint">10 שאלות · מהר = יותר נקודות · ${G.touch ? 'נוגעים בתשובה' : '1-4 במקלדת או קליק'} · האחרונה שווה כפול</div>`;
    Sound.music('boss');
    Arcade.countdown(performance.now() + (ctx.solo ? 4200 : 3200), () => { if (Arcade.active === this && this.stage === 'intro') this.t0 = performance.now(); }, '🎤!');
    this.camT = 0;
  },
  clear() {
    for (const c of this.cs || []) { this.scene.remove(c.pod.g); this.scene.remove(c.m.root); }
    if (this.host) this.scene.remove(this.host.root);
    for (const f of this.confetti) { f.live = false; f.m.visible = false; }
    for (const p of this.pops || []) { this.scene.remove(p.s); p.s.material.map.dispose(); p.s.material.dispose(); }
    this.cs = []; this.host = null; this.pops = [];
  },
  buildUi() {
    const h = Arcade.hud(`<div class="qz">
      <div class="qz-q"></div>
      <div class="qz-bar"><b></b></div>
      <div class="qz-say hidden"></div>
      <div class="qz-ans">${QUIZ_COLORS.map((c, i) => `<button class="qz-a pe" data-i="${i}" style="--c:${c.c};--d:${c.dark}"><span class="qz-ic">${c.icon}</span><span class="qz-t"></span><span class="qz-k">${i + 1}</span></button>`).join('')}</div>
      <div class="qz-me ar-chip"></div></div>`);
    this.ui = { root: h.querySelector('.qz'), q: h.querySelector('.qz-q'), bar: h.querySelector('.qz-bar b'), say: h.querySelector('.qz-say'), ans: [...h.querySelectorAll('.qz-a')], me: h.querySelector('.qz-me') };
    this.ui.ans.forEach(b => b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.answer(+b.dataset.i); }));
    this.ui.root.classList.add('intro');
  },

  showQuestion(i) {
    const q = this.qs[i];
    this.qi = i; this.stage = 'ask';
    for (const c of this.cs) {
      c.ans = -1; c.ansAt = 0; c.react = null; c.gain = 0;
      c.pod.buzzer.material.emissiveIntensity = 0.25;
      if (c.bot) {
        // Bots know the platoon less well than the real thing, and think for a few seconds.
        const p = q.cat === 'cast' ? c.skill - 0.08 : c.skill;
        const right = Math.random() < p;
        c.botAns = right ? q.right : [0, 1, 2, 3].filter(k => k !== q.right)[Math.floor(Math.random() * 3)];
        // Now and then one of them just freezes and doesn't answer at all.
        c.botAt = Math.random() < 0.07 ? 99 : 2 + Math.random() * (right ? 6.5 : 8.5);
      }
    }
    const last = i === this.N - 1;
    const cat = { cast: '👥 הפלגה', lore: '🎮 המשחק', dome: '🛡️ כיפת ברזל' }[q.cat];
    this.ui.root.classList.remove('intro', 'reveal');
    this.ui.q.innerHTML = `<div class="qz-meta"><span>שאלה ${i + 1}/${this.N}</span><span>${cat}</span>${last ? '<span class="qz-x2">×2</span>' : ''}</div><div class="qz-text">${q.text}</div>`;
    this.ui.q.classList.remove('pop'); void this.ui.q.offsetWidth; this.ui.q.classList.add('pop');
    this.ui.ans.forEach((b, k) => { b.className = 'qz-a pe'; b.querySelector('.qz-t').textContent = q.answers[k].t; b.style.animationDelay = `${0.08 * k}s`; });
    this.hostSay(last ? QUIZ_HOST.last : null);
    Sound.whoosh();
    Sound.synth.later(120, () => { Sound.synth.tone(523, 0.1, 'triangle', 0.08); Sound.synth.later(90, () => Sound.synth.tone(784, 0.14, 'triangle', 0.08)); });
  },
  answer(k) {
    if (this.stage !== 'ask' || !this.me || this.me.ans >= 0) return;
    const left = this.QT - this.elapsed();
    if (left <= 0) return;
    this.me.ans = k; this.me.ansAt = left;
    this.ui.ans.forEach((b, j) => b.classList.toggle(j === k ? 'mine' : 'off', true));
    this.press(this.me);
    Sound.pop();
  },
  press(c) {
    c.pressT = 0.25;
    c.pod.buzzer.material.emissiveIntensity = 1.1;
    if (!c.isMe) Sound.synth.tone(300 + Math.random() * 200, 0.05, 'square', 0.025);
  },
  elapsed() { return this.t0 == null ? 0 : ((performance.now() - this.t0) / 1000) % (this.QT + this.RV); },

  reveal() {
    const q = this.qs[this.qi], last = this.qi === this.N - 1;
    this.stage = 'reveal';
    this.ui.root.classList.add('reveal');
    this.ui.ans.forEach((b, k) => { b.classList.toggle('right', k === q.right); b.classList.toggle('wrong', k !== q.right && b.classList.contains('mine')); });
    let anyRight = false;
    for (const c of this.cs) {
      // Online, the others' answers come from their own phones.
      if (c.peer) {
        const o = Arcade.others().find(x => x.peer === c.peer), s = o && o.s;
        if (s && s.q === this.qi && s.a >= 0) { c.ans = s.a; c.ansAt = s.t / 10; }
      }
      const ok = c.ans === q.right;
      if (ok) {
        anyRight = true;
        c.streak++;
        c.gain = Math.round((500 + 500 * Math.max(0, c.ansAt) / this.QT) / 10) * 10 + (c.streak >= 3 ? 100 : 0);
        if (last) c.gain *= 2;
        c.react = 'jump';
      } else { c.streak = 0; c.gain = 0; c.react = c.ans < 0 ? 'sleep' : 'slump'; }
      if (!c.peer) c.score += c.gain;
      c.reactT = 0;
      if (c.gain) this.popGain(c);
    }
    const me = this.me;
    if (me) {
      if (me.ans === q.right) { Sound.good(); Sound.synth.later(160, () => Sound.ding()); this.burst(me.x, 2.4, 26); }
      else if (me.ans < 0) Sound.bad();
      else { Sound.bad(); G.shake = 0.3; }
      const line = me.ans === q.right ? pick(QUIZ_HOST.right) : me.ans < 0 ? pick(QUIZ_HOST.late) : pick(QUIZ_HOST.wrong);
      this.hostSay((anyRight ? '' : fmt(QUIZ_HOST.nobody) + ' ') + fmt(line) + (q.say ? ' ' + fmt(q.say) : ''), me.ans === q.right ? 'sergeant' : 'commander');
    }
    if (anyRight) this.cs.filter(c => c.react === 'jump' && !c.isMe).forEach(c => this.burst(c.x, 2.4, 8));
  },
  // "+760" rises over a podium.
  popGain(c) {
    const s = Scene3D.label(`${c.streak >= 3 ? '🔥 ' : ''}${c.gain}+`, { bg: 'rgba(255,210,63,.95)', fg: '#3a2600', size: 0.75 });
    s.position.set(c.x, 2.9, 0.4);
    this.scene.add(s);
    (this.pops = this.pops || []).push({ s, t: 0 });
  },
  burst(x, y, n) {
    let k = 0;
    for (const f of this.confetti) {
      if (f.live || k >= n) continue;
      k++;
      f.live = true; f.m.visible = true;
      f.m.position.set(x + (Math.random() - 0.5) * 1.2, y + Math.random() * 0.5, 0.3 + (Math.random() - 0.5) * 0.8);
      f.vx = (Math.random() - 0.5) * 4; f.vy = 3 + Math.random() * 3; f.spin = (Math.random() - 0.5) * 14;
    }
  },
  hostSay(text, who = 'sergeant') {
    const el = this.ui.say;
    if (!text) { el.classList.add('hidden'); return; }
    el.innerHTML = `<b>${fmt(`{@${who}}`)}${who === 'sergeant' ? ' 👑' : ''}:</b> ${text}`;
    el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
    this.talkT = 1.6;
    this.talker = who;
  },

  // ---------- each frame ----------
  update(dt, t) {
    const now = performance.now();
    if (this.t0 != null && this.stage !== 'done') {
      const total = (now - this.t0) / 1000, slot = this.QT + this.RV;
      const qi = Math.floor(total / slot), inQ = total - qi * slot;
      // (A long hitch, or the phone sleeping, can jump past a reveal: it still happens, so the
      // answer you gave still counts.)
      if (qi >= this.N) { if (this.stage === 'ask') this.reveal(); this.finish(); }
      else {
        if (qi !== this.qi) { if (this.stage === 'ask') this.reveal(); this.showQuestion(qi); }
        if (this.stage === 'ask') {
          const left = this.QT - inQ;
          for (const c of this.cs) {
            if (c.bot && c.ans < 0 && inQ >= c.botAt) { c.ans = c.botAns; c.ansAt = left; this.press(c); }
            if (c.peer && c.ans < 0) {
              const o = Arcade.others().find(x => x.peer === c.peer);
              if (o && o.s && o.s.q === qi && o.s.a >= 0) { c.ans = -2; this.press(c); }
            }
          }
          this.ui.bar.style.width = `${Math.max(0, left / this.QT) * 100}%`;
          this.ui.bar.parentNode.classList.toggle('low', left < 3.5);
          const sec = Math.ceil(left);
          if (sec !== this.ticked) { this.ticked = sec; if (sec <= 3 && sec > 0) Sound.beep(false); else if (sec > 0) Sound.synth.tone(1400, 0.02, 'square', 0.015); }
          const answered = this.cs.filter(c => c.ans !== -1).length;
          this.drawScreen(`${Math.max(0, sec)}`, `שאלה ${qi + 1}/${this.N} · ענו ${answered}/${this.cs.length}`, Math.max(0, left / this.QT));
          if (left <= 0) this.reveal();
        }
      }
    }
    // Scores count up on the podiums.
    for (const c of this.cs) {
      if (c.peer) {
        const o = Arcade.others().find(x => x.peer === c.peer);
        if (o && o.s && o.s.sc != null) c.score = o.s.sc;
        if (!o && !c.gone) { c.gone = true; this.drawPanel(c); }
      }
      if (c.shown !== c.score) {
        c.shown = Math.min(c.score, c.shown + Math.max(10, (c.score - c.shown) * dt * 4));
        if (c.score < c.shown) c.shown = c.score;
        this.drawPanel(c);
      }
    }
    if (this.me) this.ui.me.innerHTML = `⭐ ${Math.round(this.me.shown)}${this.me.streak >= 2 ? ` · 🔥${this.me.streak}` : ''}`;
    if (this.stage === 'done' && this.resultsAt && now > this.resultsAt) { this.resultsAt = null; this.results(); }
    this.animate(dt, now);
  },

  animate(dt, now) {
    const tt = now / 1000;
    const leader = this.stage === 'done' ? this.ranking()[0] : null;
    for (const c of this.cs) {
      c.reactT += dt;
      c.pressT = Math.max(0, (c.pressT || 0) - dt);
      const dancing = leader === c && this.stage === 'done';
      Scene3D.animateSoldier(c.m, { x: c.x / S3, y: -0.35 / S3, angle: Math.PI / 2, speed: 0, dancing }, false, dt);
      let y = 0.62, tilt = 0;
      if (c.react === 'jump' && c.reactT < 1.2) y += Math.abs(Math.sin(c.reactT * 7.5)) * 0.55 * (1 - c.reactT / 1.2);
      if (c.react === 'slump') tilt = Math.min(1, c.reactT * 4) * 0.35;
      if (c.react === 'sleep') tilt = Math.min(1, c.reactT * 2) * 0.22 + Math.sin(tt * 2) * 0.03;
      if (this.stage === 'ask' || dancing) tilt = 0;
      c.m.root.position.y = y;
      c.m.root.rotation.x = tilt;
      c.pod.buzzer.scale.y = 1 - c.pressT * 1.6;
      // Locked in: the buzzer stays lit until the reveal.
      if (this.stage === 'reveal') c.pod.front.material.color.setHex(c.react === 'jump' ? 0x7dff6a : c.react ? 0x3a3a3a : c.pod.color);
      else c.pod.front.material.color.setHex(c.pod.color);
    }
    if (this.host) {
      const talking = this.talkT > 0 && this.talker === 'sergeant';
      this.talkT = Math.max(0, (this.talkT || 0) - dt);
      Scene3D.animateSoldier(this.host, { x: this.hostX / S3, y: 0.6 / S3, angle: Math.PI / 2 + 0.55, speed: 0, dancing: this.stage === 'done' || (this.stage === 'reveal' && this.me && this.me.react === 'jump') }, false, dt);
      this.host.root.position.y = 0.42 + (talking ? Math.abs(Math.sin(tt * 9)) * 0.03 : 0);
    }
    for (const b of this.beams) {
      const i = this.beams.indexOf(b);
      b.rotation.z = Math.sin(tt * 0.7 + i * 1.7) * 0.45;
      b.rotation.x = 0.25 + Math.sin(tt * 0.5 + i) * 0.15;
      b.material.opacity = this.stage === 'reveal' ? 0.16 : 0.09;
    }
    this.rim.material.color.setHSL((tt * 0.05) % 1, 0.9, 0.6);
    for (const f of this.confetti) {
      if (!f.live) continue;
      f.vy -= 6 * dt;
      f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt;
      f.vx *= 0.98; if (f.vy < -1.6) f.vy = -1.6;
      f.m.rotation.x += f.spin * dt; f.m.rotation.y += f.spin * 0.6 * dt;
      if (f.m.position.y < 0.45) { f.live = false; f.m.visible = false; }
    }
    for (const p of this.pops || []) {
      p.t += dt;
      p.s.position.y = 2.9 + p.t * 0.9;
      p.s.material.opacity = Math.max(0, 1 - Math.max(0, p.t - 1.2) / 0.6);
    }
    this.pops = (this.pops || []).filter(p => { if (p.t < 1.8) return true; this.scene.remove(p.s); p.s.material.map.dispose(); p.s.material.dispose(); return false; });
    // The camera: a slow drift in front of the stage; leans toward you on the reveal and
    // pushes in on the winner at the end.
    this.camT += dt;
    const cam = this.camera, aspect = cam.aspect || 1.8;
    const wide = Math.max(4, this.span || 6);
    const back = (aspect < 1.3 ? 1.9 : 1.05) * wide + 3.5;
    let tx = Math.sin(this.camT * 0.25) * 0.6, tz = back, ty = 2.75, lx = 0, ly = 2.15;
    if (this.stage === 'reveal' && this.me) { tx = this.me.x * 0.35; tz = back - 1.5; }
    if (leader) { tx = leader.x * 0.8; tz = 5.2; ty = 2.4; lx = leader.x; ly = 1.7; }
    const k = Math.min(1, dt * 2.2);
    cam.position.x += (tx - cam.position.x) * k; cam.position.y += (ty - cam.position.y) * k; cam.position.z += (tz - cam.position.z) * k;
    this.look = this.look || new THREE.Vector3(0, 1.9, 0);
    this.look.x += (lx - this.look.x) * k; this.look.y += (ly - this.look.y) * k;
    if (G.shake > 0) { cam.position.x += (Math.random() - 0.5) * G.shake * 0.3; G.shake = Math.max(0, G.shake - dt); }
    cam.lookAt(this.look);
  },
  ranking() { return [...this.cs].sort((a, b) => b.score - a.score); },

  finish() {
    this.stage = 'done';
    this.ui.root.classList.add('done');
    this.ui.q.innerHTML = `<div class="qz-text">🏆 ${fmt(pick(QUIZ_HOST.win))}</div>`;
    this.hostSay(null);
    const win = this.ranking()[0];
    this.drawScreen('🏆', win ? win.name : '', null);
    this.burst(win ? win.x : 0, 4, 90);
    Sound.fanfare();
    Arcade.big('🏆', 1600);
    this.resultsAt = performance.now() + (this.ctx.solo ? 3800 : 5000);
  },
  results() {
    const rows = this.ranking().map(c => ({ name: c.name, value: `${c.score} נק'`, me: c.isMe }));
    const me = rows.findIndex(r => r.me);
    const sub = me === 0 ? fmt('{@sergeant}: "מלך[/ה] של הבוחן! 👑 מגיע לך כתר. ...לא שלי."') : me === rows.length - 1 ? fmt('{@commander}: "מקום אחרון. אני מצפה לראות אותך בשיעור חינוך."') : fmt('{@sergeant}: "לא רע! בפעם הבאה — פחות לנחש, יותר ללמוד."');
    Arcade.results('🎤 הבוחן של הפלגה', rows, { sub, img: 'assets/arcade/win_quiz.jpg' });
  },

  render(renderer) {
    Arcade.fit(this.camera);
    renderer.render(this.scene, this.camera);
  },
  presence() {
    if (!this.me) return null;
    return { q: this.qi, a: this.stage === 'ask' || this.stage === 'reveal' ? this.me.ans : -1, t: Math.round(Math.max(0, this.me.ansAt) * 10), sc: this.me.score };
  },
  act() {},
  leave() {
    document.body.classList.remove('qz-on');
    removeEventListener('keydown', this.onKey);
    this.clear();
    this.t0 = null; this.stage = null;
  },
};
Arcade.register(QuizGame);
