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
    // Netivot is a small site: the fence encloses 40x34 tiles around the shared gate.
    netivot: {
      fence: [12, 8, 51, 41],
      roads: [[29, 16, 32, 41]],
      buildings: [
        { id: 'boys', name: 'מגורים — בנים', x: 13, y: 20, w: 10, h: 7, doors: [[22, 23]] },
        { id: 'girls', name: 'מגורים — בנות', x: 13, y: 27, w: 10, h: 7, doors: [[22, 30]] },
        { id: 'kitchen', name: 'מטבחון', x: 13, y: 34, w: 6, h: 5, doors: [[18, 36]] },
        { id: 'dining', name: 'חדר אוכל', x: 20, y: 34, w: 7, h: 6, doors: [[23, 34]] },
        { id: 'hamal', name: 'עמדת בקרה מקומית', x: 35, y: 16, w: 8, h: 6, doors: [[38, 21]] },
        { id: 'depot', name: 'מחסן מארזים', x: 44, y: 23, w: 7, h: 7, doors: [[44, 26]] },
        { id: 'store', name: 'מחסן רספ"ייה', x: 35, y: 29, w: 7, h: 5, doors: [[38, 29]] },
        { id: 'office', name: 'משרד מפקדים', x: 44, y: 31, w: 7, h: 5, doors: [[44, 33]] },
        { id: 'booth', name: 'ש"ג', x: 34, y: 38, w: 3, h: 3, doors: [[34, 39]] },
        { id: 'mig1', name: 'מיגונית', x: 24, y: 26, w: 3, h: 3, doors: [[25, 26]], shelter: true },
        { id: 'mig2', name: 'מיגונית', x: 24, y: 20, w: 3, h: 3, doors: [[25, 22]], shelter: true },
        { id: 'mig4', name: 'מיגונית', x: 38, y: 35, w: 3, h: 3, doors: [[39, 37]], shelter: true },
      ],
      launchers: [
        { id: 'L1', name: 'משגר 1', x: 37, y: 10 },
        { id: 'L2', name: 'משגר 2', x: 42, y: 10 },
        { id: 'L3', name: 'משגר 3', x: 47, y: 10 },
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
        { id: 'kantina', name: 'ש"ק — קנטינה', x: 38, y: 33, w: 6, h: 5, doors: [[40, 33]] },
        { id: 'gym', name: 'חדר כושר', x: 46, y: 35, w: 8, h: 5, doors: [[50, 35]] },
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
    { id: 'curious', name: 'שומר[/ת] הסף', desc: 'הרחקת 3 סקרנים מהשער בלי לגלות כלום' },
    { id: 'police', name: 'שלוש שנים זה לא צחוק', desc: 'הזמנת משטרה לסקרן שצילם את האתר' },
    { id: 'tutorial', name: 'קראת את ההוראות', desc: 'סיימת את הדרכת הכפתורים' },
    { id: 'rank_samal', name: 'שלושה פסים', desc: 'הועלית לדרגת סמל' },
    { id: 'rank_samar', name: 'עלה על הפסים', desc: 'הועלית לדרגת סמ"ר' },
    { id: 'kashag', name: 'מצוין בכש"ג', desc: 'קיבלת ציון מצוין במבחן הכושר של המדא"גית' },
    { id: 'baum_boss', name: 'מזרחית מנצחת', desc: 'הבסת את מפקדת הסוללה עם קריוקי וגרעינים' },
    { id: 'harasar_boss', name: 'אין לו מה להגיד', desc: 'הבסת את הרס"ר עם תלבושת מושלמת' },
    { id: 'bar_boss', name: 'שקט בחמ"ל', desc: 'הנחתת את הנץ המדבר עם ריטלין, מרדים ומחסום' },
    { id: 'orin_dance', name: 'אף אחד לא יאמין', desc: 'המפקדת העירה רק אותך באמצע הלילה ורקדה' },
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
    { id: 'yasmin', name: 'שרדת את {@inspector}', desc: 'עברת את מסדר הניקיון הרצחני' },
    { id: 'fridge', name: 'מלך התוקפים', desc: 'רשמת את כל התוקפים במקרר בלי טעות' },
    { id: 'hidden', name: 'אף אחד לא ראה כלום', desc: 'החבאת את כל האוכל לפני הביקורת של {@bc}' },
    { id: 'rafael', name: 'סבל של רפאל', desc: 'פרקת את ארוחת הצהריים לחדר האוכל' },
    { id: 'chef', name: 'שף מטבחון', desc: 'בישלת במטבחון' },
    { id: 'tech', name: 'ביקורת עברה', desc: 'עברת ביקורת טכנאים בלי הערות' },
    { id: 'amsalem', name: 'מטפים ושלוליות', desc: 'סיימת את המשימות של {@rasap}' },
    { id: 'ugga', name: 'אוגה בוגה', desc: 'עזרת ל{@p_liran} להגיש בקשה לקורס מיירטים' },
    { id: 'boss', name: 'מנצח הצ\'יזבורגר', desc: 'הבסת את {@deputy_rasap} בעזרת אוכל בריא' },
    { id: 'home', name: 'יציאה הביתה!', desc: 'נעלת את השער ויצאת הביתה' },
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
    6: [
      { from: 'אמא ❤️', text: 'מחר בבית!!! הכנתי שניצלים. ועוגה. ועוד שניצלים.' },
      { from: '{@p_ofek}', text: 'אחי אני כבר על התיק. פחית Blue חמישית לכבוד היציאה 💙' },
    ],
  },

  // The calendar: day 1 of the story is this date (day, month).
  startDate: [12, 10],
  // Days until going home on leave in story mode.
  homeDay: 6,

  // The Netivot storeroom: years of things nobody touches. "at" is the tile position.
  junk: [
    { id: 'crt', name: 'מסך CRT שעדיין מחובר ל־Windows 98', icon: '🖥️', at: [36.1, 30.1], keep: false },
    { id: 'chair', name: 'כיסא עם שלוש רגליים ותקווה', icon: '🪑', at: [36.1, 31.2], keep: false },
    { id: 'fax', name: 'מכונת פקס. אף אחד לא יודע את המספר שלה', icon: '📠', at: [36.1, 32.2], keep: false },
    { id: 'papers', name: 'ערימת טפסים משנת 2012, בשלושה עותקים', icon: '📚', at: [37.3, 32.2], keep: false },
    { id: 'cables', name: 'קופסת כבלים שלא מתאימים לשום דבר', icon: '🧶', at: [39.6, 30.1], keep: false },
    { id: 'tent', name: 'אוהל סיירים בלי יתדות ובלי סיירים', icon: '⛺', at: [40.0, 31.2], keep: false },
    { id: 'board', name: 'לוח שמירות מקורי של {@commander}', icon: '📋', at: [39.6, 32.2], keep: true },
  ],

  // Fridge inventory for the Yasmin inspection. off = days from today to the expiry date.
  fridge: [
    { name: 'חלב 3%', icon: '🥛', off: 3 },
    { name: 'קוטג\' 5%', icon: '🧀', off: -2 },
    { name: 'חומוס', icon: '🫘', off: 12 },
    { name: 'יוגורט של {@p_nevo}', icon: '🥣', off: -390 },
    { name: 'שניצל מלפני שבוע', icon: '🍗', off: -6 },
    { name: 'תבנית ביצים', icon: '🥚', off: 9 },
    { name: 'פחית Blue של {@p_ofek} (החמישית היום)', icon: '💙', off: 200 },
    { name: 'קופסת קינואה וברוקולי של {@p_shaked}', icon: '🥗', off: 2 },
    { name: 'רוטב שום מהפיצה של שישי', icon: '🧄', off: 30 },
    { name: 'עגבנייה בודדת ועצובה', icon: '🍅', off: -1 },
  ],

  // Kitchenette recipes.
  // The dining room: each meal has a few dishes; up to three plates a meal.
  menu: {
    breakfast: [
      { id: 'omelette', name: 'חביתה וסלט ישראלי', icon: '🍳', energy: 18, morale: 3 },
      { id: 'shakshuka', name: 'שקשוקה עם לחם', icon: '🥘', energy: 22, morale: 5 },
      { id: 'yogurt', name: 'יוגורט וגרנולה', icon: '🥣', energy: 10, morale: 2, healthy: true },
      { id: 'cornflakes', name: 'קורנפלקס עם חלב', icon: '🥛', energy: 8, morale: 2 },
      { id: 'coffee', name: 'קפה שחור', icon: '☕', energy: 12, morale: 4 },
    ],
    lunch: [
      { id: 'schnitzel', name: 'שניצל ופירה', icon: '🍗', energy: 25, morale: 5 },
      { id: 'majadra', name: 'מג׳דרה ויוגורט', icon: '🍚', energy: 20, morale: 3 },
      { id: 'kebab', name: 'קבב ואורז', icon: '🍢', energy: 24, morale: 5 },
      { id: 'salad', name: 'סלט ירקות גדול', icon: '🥗', energy: 8, morale: 1, healthy: true },
      { id: 'kubbeh', name: 'מרק קובה', icon: '🍲', energy: 18, morale: 6 },
    ],
    dinner: [
      { id: 'pasta', name: 'פסטה ברוטב עגבניות', icon: '🍝', energy: 22, morale: 4 },
      { id: 'soup', name: 'מרק עדשים', icon: '🍲', energy: 16, morale: 4 },
      { id: 'shnitzelonim', name: 'שניצלונים וצ׳יפס', icon: '🍟', energy: 22, morale: 7 },
      { id: 'tuna', name: 'סלט טונה וביצה', icon: '🥚', energy: 14, morale: 2, healthy: true },
      { id: 'pudding', name: 'מלבי לקינוח', icon: '🍮', energy: 6, morale: 6 },
    ],
  },
  recipes: [
    { id: 'shakshuka', name: 'שקשוקה', icon: '🍳', energy: 30, morale: 10, steps: 'בצל, עגבניות, ביצים, לא לגעת!', len: 5 },
    { id: 'toast', name: 'טוסט גבינה', icon: '🥪', energy: 20, morale: 8, steps: 'לחם, גבינה, לסגור, ללחוץ חזק', len: 4 },
    { id: 'pasta', name: 'פסטה ברוטב עגבניות', icon: '🍝', energy: 35, morale: 8, steps: 'מים, מלח, פסטה, רוטב, לסנן', len: 6 },
    { id: 'noodles', name: 'נודלס כוס — המנה של {@p_liran}', icon: '🍜', energy: 15, morale: 12, steps: 'מים רותחים. זהו. זה כל המתכון.', len: 3 },
    { id: 'quinoa', name: 'סלט קינואה של {@p_shaked}', icon: '🥗', energy: 25, morale: 4, healthy: true, steps: 'קינואה, ברוקולי, לימון, עוד ברוקולי', len: 6 },
  ],

  // Food bought outside the base, to hide before the battery commander's inspection.
  outsideFood: [
    { id: 'pizza', name: 'קרטון פיצה משפחתית', icon: '🍕', at: [18.5, 23.5] },
    { id: 'shawarma', name: 'שווארמה בלאפה', icon: '🌯', at: [18.5, 30.5] },
    { id: 'sushi', name: 'מגש סושי', icon: '🍣', at: [23.5, 36.9] },
    { id: 'burger', name: 'שקית המבורגרים', icon: '🍔', at: [15.7, 36.6] },
    { id: 'chips', name: 'קופסת צ\'יפס ענקית', icon: '🍟', at: [39.5, 25.5] },
    { id: 'malawach', name: 'מלאווח עם ביצה', icon: '🫓', at: [27.5, 29.5] },
  ],

  // Healthy weapons against the cheeseburger monster, and what hurts him most about each.
  healthy: [
    { id: 'broccoli', dmg: 9, name: 'ברוקולי', icon: '🥦', color: 0x3f8f2f, hit: 'אוי לא! סיבים תזונתיים!' },
    { id: 'ricecake', dmg: 8, name: 'פריכיות', icon: '🍘', color: 0xe8d6a0, hit: 'אוי לא! מזון לא מעובד!' },
    { id: 'protein', dmg: 10, name: 'חטיף חלבון', icon: '💪', color: 0x7a4a2a, hit: 'רק לא זה! דל סוכר!' },
    { id: 'carrot', dmg: 8, name: 'גזר', icon: '🥕', color: 0xe8781f, hit: 'בטא־קרוטן?! העיניים שלי רואות טוב מדי!' },
    { id: 'apple', dmg: 9, name: 'תפוח', icon: '🍎', color: 0xd8261f, hit: 'תפוח ביום — ואני בבית חולים!' },
    { id: 'cucumber', dmg: 7, name: 'מלפפון', icon: '🥒', color: 0x4f9e33, hit: 'מים! הרבה מים! אני מתייבש מבריאות!' },
  ],

  // What the battery commander can't stand (she's Ashkenazi), for her boss fight.
  mizrahi: [
    { id: 'karaoke', dmg: 11, name: 'ערכת קריוקי', icon: '🎤', color: 0xd63384, hit: 'לא! רק לא "מאמי, מאמי"! אני שומעת רק שופן!' },
    { id: 'seeds', dmg: 7, name: 'גרעינים שחורים', icon: '🌻', color: 0x1f1f1f, hit: 'קליפות! על הדרגות שלי?!' },
    { id: 'bibi', dmg: 10, name: 'פוסטר של ביבי', icon: '🖼️', color: 0x1d4fa8, hit: '"כפרה עליך"?! אני מצביעה מרצ!' },
    { id: 'babasali', dmg: 12, name: 'תמונה של הבבא סאלי', icon: '🕯️', color: 0xc9a227, hit: 'ברכה?! אני לא צריכה ברכה, אני צריכה נוהל!' },
  ],
  // What a battery sergeant major has nothing to say about, for his.
  uniform: [
    { id: 'boots', dmg: 9, name: 'נעליים מצוחצחות', icon: '👞', color: 0x111111, hit: 'מבריק?! אני רואה בהן את הפנים שלי! אאאא!' },
    { id: 'beret', dmg: 10, name: 'כומתה מקופלת', icon: '🎖️', color: 0x4a6fa5, hit: 'כומתה מקופלת כמו בספר! לא!' },
    { id: 'razor', dmg: 8, name: 'גילוח מושלם', icon: '🪒', color: 0xc0c0c0, hit: 'חלק?! אין לי על מה לרשום!' },
    { id: 'belt', dmg: 9, name: 'חוגר', icon: '🪪', color: 0x3c4822, hit: 'יש לו חוגר?! זה לא קרה אף פעם!' },
  ],
  // What finally quiets the HQ's operations clerk (the winged boss).
  calm: [
    { id: 'ritalin', dmg: 10, name: 'בקבוקון ריטלין', icon: '💊', color: 0xe8781f, hit: 'רגע... אני... מרוכזת?! זה מפחיד אותי!!!' },
    { id: 'sedative', dmg: 9, name: 'חומר מרדים', icon: '💤', color: 0x5f8fd8, hit: 'אני לא עייפה... אני רק... עוצמת עיניים... לשנייה...' },
    { id: 'muzzle', dmg: 11, name: 'מחסום פה', icon: '🐶', color: 0x7a4a26, hit: 'ממממ! מממממ ממ!!! (היא עדיין מדברת)' },
  ],

  // Made-up characters who live in the world like the cast does.
  extras: [
    {
      id: 'shekemist', map: 'hq', name: "ז'אן-פייר דה־לה־קנטין", short: "ז'אן-פייר", first: "ז'אן-פייר", head: 'none', emoji: '🥐', color: '#2b4c8c',
      title: 'השקמיסט · עלה מפריז, נתקע בש"ק של {hq}',
      lines: [
        'בונז\'ור! ברוך הבא לש"ק. פה זה לא פריז, אבל הבמבה טרייה. כמעט.',
        'בפריז היה לי בית קפה ליד הסן. פה יש לי מקרר של קולה ליד הדשא. זה גם רומנטי, בדרכו.',
        'קרואסון? אין. אבל יש בורקס של אתמול, ובצרפתית קוראים לזה "וינטאז\'".',
        'אני לא מבין למה כולם קונים אנרגיה בשתיים בלילה. אצלנו בצרפת ישנים. ואז שובתים.',
        'אומלט דו פרומאז\'! ...לא, סתם. יש רק טוסט. אבל אני אגיד את זה במבטא.',
        'מי שמשלם במזומן מקבל "מרסי". מי שמשלם בביט מקבל "מרסי" יותר מהר.',
      ],
      barks: ['בונז\'ור!', 'אוֹ לָה לָה, איזה תור', 'סה לה וי 🥐', 'מרסי, מרסי'],
    },
  ],

  // Voices that are not part of the cast.
  // Cartoon portraits for the dialog box (the cast's own come with the roster).
  faces: { rafael: 'assets/faces/rafael.webp' },
  characters: {
    officer: { name: 'קצין תורן', img: null, icon: '🔦' },
    narrator: { name: '', img: null, icon: '📻' },
    rafael: { name: 'נהג רפאל קייטרינג', img: null, icon: '🚚' },
    police: { name: 'שוטר', img: null, icon: '👮' },
  },
};
