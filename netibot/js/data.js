// NetiBot — game data. Everything a designer may want to tweak lives here.
// Text supports gender tokens: "[מוכן/מוכנה]" picks the left side for male and
// the right for female, and "{name}" / "{battery}" / "{gdud}" are replaced too.

const DATA = {
  // Battalions (gdudim) and their batteries. Batteries for 137/138/139 are
  // placeholders — replace them with the real names.
  gdudim: [
    {
      id: '137', name: 'גדוד 137',
      perk: { key: 'stamina', label: 'סיבולת: ריצה ארוכה יותר' },
      color: '#6cc24a',
      batteries: [
        { id: '137a', name: "סוללה א'" },
        { id: '137b', name: "סוללה ב'" },
        { id: '137c', name: "סוללה ג'" },
      ],
    },
    {
      id: '138', name: 'גדוד 138',
      perk: { key: 'morale', label: 'אחדות: המורל יורד לאט יותר' },
      color: '#4aa3df',
      batteries: [
        { id: '138a', name: "סוללה א'" },
        { id: '138b', name: "סוללה ב'" },
        { id: '138c', name: "סוללה ג'" },
      ],
    },
    {
      id: '139', name: 'גדוד 139',
      perk: { key: 'discipline', label: 'משמעת: בונוס לכל מסדר' },
      color: '#e07b39',
      batteries: [
        { id: '139a', name: "סוללה א'" },
        { id: '139b', name: "סוללה ב'" },
        { id: '139c', name: "סוללה ג'" },
      ],
    },
    {
      id: '947', name: 'גדוד 947',
      perk: { key: 'reload', label: 'טעינה מהירה: זמן נוסף בהחלפת מארזים' },
      color: '#f2c14e',
      batteries: [
        { id: 'goni', name: 'גוני' },
        { id: 'ido', name: 'אידו' },
        { id: 'bazelet', name: 'בזלת' },
      ],
    },
  ],

  skinTones: ['#f1c9a5', '#d9a77c', '#b07a52', '#7a4e32'],
  hairColors: ['#1d150f', '#4a2d17', '#8a5a2b', '#c9a15a'],

  // Seconds of real time a red alert gives you to reach a shelter.
  redAlertSeconds: 30,
  // Game minutes that pass per real second.
  minutesPerSecond: 1.5,
  passScore: 150,

  tile: 40,
  mapW: 64,
  mapH: 46,

  // Buildings are drawn roofless so the player can see inside.
  // doors: tile coordinates on the building outline that stay open.
  buildings: [
    { id: 'barracks', name: 'מגורים — פלג"צ', x: 5, y: 24, w: 15, h: 9, doors: [[19, 28]] },
    { id: 'dining', name: 'חדר אוכל', x: 5, y: 34, w: 10, h: 6, doors: [[9, 34]] },
    { id: 'kantina', name: 'ש.ק.', x: 17, y: 35, w: 6, h: 4, doors: [[19, 35]] },
    { id: 'office', name: 'משרד מפקד', x: 44, y: 33, w: 6, h: 5, doors: [[46, 33]] },
    { id: 'booth', name: 'ש"ג', x: 34, y: 38, w: 3, h: 3, doors: [[34, 39]] },
    { id: 'depot', name: 'מחסן מארזים', x: 50, y: 24, w: 9, h: 7, doors: [[50, 27]] },
    { id: 'hamal', name: 'חמ"ל', x: 5, y: 5, w: 9, h: 7, doors: [[9, 11]] },
    { id: 'mig1', name: 'מיגונית', x: 22, y: 26, w: 3, h: 3, doors: [[23, 28]], shelter: true },
    { id: 'mig2', name: 'מיגונית', x: 36, y: 12, w: 3, h: 3, doors: [[37, 14]], shelter: true },
    { id: 'mig3', name: 'מיגונית', x: 53, y: 33, w: 3, h: 3, doors: [[53, 34]], shelter: true },
    { id: 'mig4', name: 'מיגונית', x: 26, y: 37, w: 3, h: 3, doors: [[27, 37]], shelter: true },
    { id: 'mig5', name: 'מיגונית', x: 15, y: 13, w: 3, h: 3, doors: [[16, 13]], shelter: true },
  ],

  // Launchers sit on concrete pads in the north of the site.
  launchers: [
    { id: 'L1', name: 'משגר 1', x: 41, y: 4 },
    { id: 'L2', name: 'משגר 2', x: 48, y: 4 },
    { id: 'L3', name: 'משגר 3', x: 55, y: 4 },
  ],

  // Gate visitors for ש"ג duty. "ok" visitors appear on the day's entry list.
  visitors: [
    { name: 'רס"ר יוסי אלמוג', role: 'רס"ר הגדוד', car: '24-117-88' },
    { name: 'סגן נועה ברק', role: 'קצינת אג"ם', car: '31-902-14' },
    { name: 'משה דהן', role: 'ספק מזון', car: '77-412-30' },
    { name: 'רונית פרץ', role: 'אחזקה — חשמל', car: '58-220-61' },
    { name: 'סמ"ר עידן כהן', role: 'נהג מים', car: '45-663-09' },
    { name: 'דוד אזולאי', role: 'קבלן גידור', car: '12-345-67' },
    { name: 'רב"ט ליאור חדד', role: 'מכונאי', car: '66-781-23' },
    { name: 'שירן מזרחי', role: 'משלוח דואר', car: '83-150-42' },
    { name: 'אבי ביטון', role: 'פיצה לסוללה?!', car: '90-001-55' },
    { name: 'סרן תמר לוי', role: 'רופאת גדוד', car: '29-874-36' },
  ],

  shop: [
    { id: 'coffee', name: 'קפה שחור', price: 3, energy: 22, morale: 2, icon: '☕' },
    { id: 'bamba', name: 'במבה', price: 4, energy: 6, morale: 12, icon: '🥜' },
    { id: 'bisli', name: 'ביסלי גריל', price: 5, energy: 6, morale: 15, icon: '🍟' },
    { id: 'seeds', name: 'גרעינים', price: 3, energy: 0, morale: 10, icon: '🌻' },
    { id: 'choco', name: 'שוקו בשקית', price: 4, energy: 12, morale: 10, icon: '🥛' },
    { id: 'energy', name: 'משקה אנרגיה', price: 8, energy: 45, morale: -3, icon: '⚡' },
  ],

  achievements: [
    { id: 'beret', name: 'כומתה כחולה', desc: 'סיימת טירונות וקיבלת כומתה' },
    { id: 'first_shelter', name: 'בזמן!', desc: 'הגעת למיגונית בזמן בצבע אדום' },
    { id: 'speedy', name: 'ברק', desc: 'הגעת למיגונית בפחות מ-10 שניות' },
    { id: 'reload', name: 'טוען מוסמך', desc: 'החלפת מארז בהצלחה' },
    { id: 'clean', name: 'מלך הניקיון', desc: 'ניקית את כל הבסיס' },
    { id: 'inspection', name: 'מסדר מושלם', desc: 'עברת מסדר ניקיון בציון 90+' },
    { id: 'gate', name: 'שומר הסף', desc: 'משמרת ש"ג בלי אף טעות' },
    { id: 'awake', name: 'עיני נץ', desc: 'שמירת לילה בלי להירדם' },
    { id: 'radar', name: 'עין בשמיים', desc: '90%+ בעמדת הבקרה' },
    { id: 'sniper', name: 'קלע', desc: '80+ במטווח' },
    { id: 'shopper', name: 'לקוח קבוע', desc: 'קנית 5 פעמים בש.ק.' },
    { id: 'palgatz', name: 'סיימתי פלג"צ!', desc: 'עברת את מבחן סיום פלג"צ' },
  ],

  // Final exam questions. Answers reflect what the game teaches.
  quiz: [
    {
      q: 'נשמעת אזעקת צבע אדום. מה עושים קודם?',
      a: ['ממשיכים במשימה', 'רצים למיגונית הקרובה', 'מתקשרים הביתה', 'מחפשים את המפקד'],
      ok: 1,
    },
    {
      q: 'כמה זמן נשאר במיגונית אחרי האזעקה (במשחק)?',
      a: ['לא נשארים בכלל', 'עד שמשעמם', 'עד שמודיעים שאפשר לצאת', 'דקה אחת בדיוק'],
      ok: 2,
    },
    {
      q: 'מתי כיפת ברזל מיירטת איום?',
      a: ['תמיד, על כל רקטה', 'כשהאיום צפוי ליפול בשטח מיושב', 'רק בלילה', 'רק כשהמפקד מבקש'],
      ok: 1,
    },
    {
      q: 'רכב מגיע לש"ג ואינו ברשימת הכניסה. מה עושים?',
      a: ['פותחים — הוא נראה נחמד', 'לא מכניסים ומדווחים', 'מכניסים אם יש לו פיצה', 'מתעלמים'],
      ok: 1,
    },
    {
      q: 'מה עושים עם המחסום אחרי שרכב מורשה עבר?',
      a: ['משאירים פתוח', 'סוגרים מיד', 'סוגרים בסוף המשמרת', 'מפרקים אותו'],
      ok: 1,
    },
    {
      q: 'מה הדבר הראשון בהחלפת מארז?',
      a: ['להכניס את המארז', 'לבדוק תקינות', 'נעילת בטיחות של המשגר', 'לצלם סטורי'],
      ok: 2,
    },
  ],

  // Text messages that arrive on the in-game phone, by day.
  messages: {
    1: [
      { from: 'אמא ❤️', text: 'מאמי! איך הבסיס? אכלת? תשלח[/י] תמונה עם הכומתה!!' },
      { from: 'קבוצת הפלגה', text: 'מי לוקח את המיטה ליד המזגן? 😤' },
    ],
    2: [
      { from: 'אבא', text: 'שמעתי שיש אזעקות בדרום. [תשמור/תשמרי] על עצמך ותקשיב[/י] למפקדים.' },
      { from: 'שקד (חבר מהפלגה)', text: '[אחי/אחותי] יש לי גרעינים למשמרת, תביא[/י] קולה' },
    ],
    3: [
      { from: 'אמא ❤️', text: 'הכנתי לך שניצלים לשישי. מתי יוצאים?' },
      { from: 'קבוצת הפלגה', text: 'מסדר ניקיון מחר!!! מי ניקה את השירותים???' },
    ],
    4: [
      { from: 'סבתא', text: 'נכד[/ה] שלי החייל[/ת] 🥹 אני כל כך גאה' },
      { from: 'שקד (חבר מהפלגה)', text: 'מחר מבחן סיום פלג"צ. לא לישון בשמירה 😂' },
    ],
    5: [{ from: 'אמא ❤️', text: 'בהצלחה במבחן! אני מחזיקה אצבעות 🤞' }],
  },

  characters: {
    commander: { name: 'סגן אורי — מפקד הפלגה', img: 'assets/commander.jpg', icon: '🎖️' },
    sergeant: { name: 'סמלת מאיה', img: 'assets/sergeant.jpg', icon: '📋' },
    friend: { name: 'שקד', img: 'assets/friend.jpg', icon: '😄' },
    officer: { name: 'קצין תורן', img: null, icon: '🔦' },
    narrator: { name: '', img: null, icon: '📻' },
  },
};
