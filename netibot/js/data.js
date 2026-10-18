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

  // Sites. Every site shares the fence, gate and access roads; buildings differ.
  // Buildings are drawn roofless so the player can see inside.
  // doors: tile coordinates on the building outline that stay open.
  maps: {
    netivot: {
      buildings: [
        { id: 'barracks', name: 'מגורים — פלג"צ', x: 5, y: 24, w: 15, h: 9, doors: [[19, 28]] },
        { id: 'dining', name: 'חדר אוכל', x: 5, y: 34, w: 10, h: 6, doors: [[9, 34]] },
        { id: 'kantina', name: 'ש.ק.', x: 17, y: 35, w: 6, h: 4, doors: [[19, 35]] },
        { id: 'office', name: 'משרד מפקדים', x: 44, y: 33, w: 6, h: 5, doors: [[46, 33]] },
        { id: 'booth', name: 'ש"ג', x: 34, y: 38, w: 3, h: 3, doors: [[34, 39]] },
        { id: 'depot', name: 'מחסן מארזים', x: 50, y: 24, w: 9, h: 7, doors: [[50, 27]] },
        { id: 'hamal', name: 'עמדת בקרה מקומית', x: 5, y: 5, w: 9, h: 7, doors: [[9, 11]] },
        { id: 'mig1', name: 'מיגונית', x: 22, y: 26, w: 3, h: 3, doors: [[23, 28]], shelter: true },
        { id: 'mig2', name: 'מיגונית', x: 36, y: 12, w: 3, h: 3, doors: [[37, 14]], shelter: true },
        { id: 'mig3', name: 'מיגונית', x: 53, y: 33, w: 3, h: 3, doors: [[53, 34]], shelter: true },
        { id: 'mig4', name: 'מיגונית', x: 26, y: 37, w: 3, h: 3, doors: [[27, 37]], shelter: true },
        { id: 'mig5', name: 'מיגונית', x: 15, y: 13, w: 3, h: 3, doors: [[16, 13]], shelter: true },
      ],
      launchers: [
        { id: 'L1', name: 'משגר 1', x: 41, y: 4 },
        { id: 'L2', name: 'משגר 2', x: 48, y: 4 },
        { id: 'L3', name: 'משגר 3', x: 55, y: 4 },
      ],
    },
    hq: {
      buildings: [
        { id: 'hamal', name: 'חמ"ל סוללתי', x: 5, y: 4, w: 14, h: 9, doors: [[12, 12]] },
        { id: 'bc', name: 'לשכת מפקדת הסוללה', x: 22, y: 4, w: 8, h: 6, doors: [[25, 9]] },
        { id: 'harasar', name: 'משרד הרס"ר', x: 31, y: 4, w: 6, h: 6, doors: [[33, 9]] },
        { id: 'rasap', name: 'רספ"ייה', x: 40, y: 4, w: 11, h: 8, doors: [[45, 11]] },
        { id: 'interceptors', name: 'מחסן מיירטים', x: 53, y: 4, w: 8, h: 8, doors: [[53, 7]] },
        { id: 'clinic', name: 'מרפאה', x: 5, y: 25, w: 8, h: 6, doors: [[12, 28]] },
        { id: 'dining', name: 'חדר אוכל', x: 14, y: 25, w: 11, h: 7, doors: [[19, 25]] },
        { id: 'tech', name: 'מעבדת טכנאים', x: 36, y: 25, w: 9, h: 6, doors: [[40, 25]] },
        { id: 'barracks', name: 'מגורים', x: 47, y: 25, w: 12, h: 7, doors: [[52, 25]] },
        { id: 'mig1', name: 'מיגונית', x: 26, y: 14, w: 3, h: 3, doors: [[27, 16]], shelter: true },
        { id: 'mig2', name: 'מיגונית', x: 44, y: 14, w: 3, h: 3, doors: [[45, 16]], shelter: true },
        { id: 'mig3', name: 'מיגונית', x: 34, y: 33, w: 3, h: 3, doors: [[35, 33]], shelter: true },
        { id: 'mig4', name: 'מיגונית', x: 20, y: 34, w: 3, h: 3, doors: [[21, 34]], shelter: true },
      ],
      launchers: [],
    },
    field: { buildings: [], launchers: [] },
  },

  // Bus stop (tile) used to travel between sites; the same spot on every site.
  travelStop: [26, 33],

  // What a site deployment brings, in the order the trucks arrive. Tiles on the field site.
  deploy: [
    { id: 'shelter', name: 'מיגונית', kind: 'shelter', x: 24, y: 26, w: 3, h: 3, color: 0x9b9a90 },
    { id: 'launcher', name: 'משגר', kind: 'launcher', x: 40, y: 4, w: 5, h: 6, color: 0x4b5a2a },
    { id: 'sleep', name: 'חדרי שינה', x: 8, y: 10, w: 9, h: 4, color: 0x5d6b3e },
    { id: 'dining', name: 'חדר אוכל', x: 8, y: 16, w: 8, h: 4, color: 0x8a6a3a },
    { id: 'kitchen', name: 'מטבח', x: 18, y: 16, w: 5, h: 4, color: 0x9a9a92 },
    { id: 'showers', name: 'מקלחות', x: 46, y: 27, w: 6, h: 3, color: 0x3a6e8f },
    { id: 'toilets', name: 'שירותים כימיים', x: 54, y: 27, w: 4, h: 3, color: 0x2f7fbf },
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
    { name: 'אבי ממן', role: 'פיצה לסוללה?!', car: '90-001-55' },
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
    { id: 'deploy', name: 'פורסים!', desc: 'פרסת אתר חדש מאפס' },
    { id: 'hq', name: 'ביקור בשו"ב', desc: 'נסעת לאתר השליטה של הסוללה' },
    { id: 'escape', name: 'חמקן[/ית]', desc: 'ברחת מ{@inspector} לפני שתפסה אותך' },
    { id: 'caught', name: 'נתפסת', desc: '{@inspector} תפסה אותך ונתנה מסדר' },
    { id: 'ruth', name: 'הבגרות של {@@ruth}', desc: 'מצאת את ה־Easter Egg' },
    { id: 'social', name: 'מכיר[/ה] את כולם', desc: 'דיברת עם 20 אנשים שונים' },
  ],

  // Final exam questions. Answers reflect what the game teaches.
  quiz: [
    {
      q: 'פורסים אתר חדש. איזו מכולה מציבים ראשונה?',
      a: ['חדר אוכל', 'מיגונית', 'שירותים כימיים', 'הרמקול של הנהג'],
      ok: 1,
    },
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
      { from: 'קבוצת הפלגה', text: '{@p_ofek}: מי לוקח את המיטה ליד המזגן? אני מוכן לשלם 😤' },
    ],
    2: [
      { from: 'אבא', text: 'שמעתי שיש אזעקות בדרום. [תשמור/תשמרי] על עצמך ותקשיב[/י] למפקדים.' },
      { from: '{@p_nevo}', text: '[אחי/אחותי] יש לי רעיון למשמרת. אל תשאל[/י]. תביא[/י] קולה.' },
    ],
    3: [
      { from: 'אמא ❤️', text: 'הכנתי לך שניצלים לשישי. מתי יוצאים?' },
      { from: '{@inspector}', text: 'מסדר ניקיון מחר!!! מי ניקה את השירותים??? אני יודעת שלא.' },
    ],
    4: [
      { from: 'סבתא', text: 'נכד[/ה] שלי החייל[/ת] 🥹 אני כל כך גאה' },
      { from: '{@commander}', text: 'המצב מתחמם. היום כנראה פורסים אתר. להיות מוכנים לנסיעה.' },
      { from: '{@friend}', text: 'מחר מבחן סיום פלג"צ. אני כתבתי אותו, אז... בהצלחה 😏' },
    ],
    5: [{ from: 'אמא ❤️', text: 'בהצלחה במבחן! אני מחזיקה אצבעות 🤞' }],
  },

  // Voices that are not part of the cast.
  characters: {
    officer: { name: 'קצין תורן', img: null, icon: '🔦' },
    narrator: { name: '', img: null, icon: '📻' },
  },
};
