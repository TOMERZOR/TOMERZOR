// Thirty levels in seven parts of the site. Maps are 7 wide, 9 deep, back wall first:
// . floor   # junk the mice run around   H burrow   G the food
// Waves: t = seconds after the start, hole = index into the map's burrows (reading order).

import { COLS, ROWS } from './game.js';

function parse(map) {
  const rows = map.trim().split('\n').map((s) => s.trim());
  if (rows.length !== ROWS) throw new Error('map needs ' + ROWS + ' rows');
  const holes = [], rocks = [];
  let goal = null;
  rows.forEach((row, r) => {
    if (row.length !== COLS) throw new Error('row ' + r + ' needs ' + COLS + ' cells: ' + row);
    [...row].forEach((ch, c) => {
      if (ch === 'H') holes.push([c, r]);
      else if (ch === 'G') goal = [c, r];
      else if (ch === '#') rocks.push([c, r, (c * 7 + r * 3) % 3]);
    });
  });
  return { holes, rocks, goal };
}

const L = (def) => ({
  food: 3, ofek: 1, shalev: 0, shaked: 1, snapHold: 3.2, glueHold: 2.3, cheeseHold: 2.4, liorReturn: 2.5,
  minion: { hp: 3, speed: 2.0 }, fat: { hp: 9, speed: 1.3 }, fast: { hp: 2, speed: 3.0 }, orel: { hp: 44, speed: 2.15 }, bucketHold: 4.4,
  ...def,
  ...parse(def.map),
});

export const AREAS = [
  { id: 'office', name: 'המכולה של מנהל העבודה', wall: 'wall_office', tint: 0xffffff },
  { id: 'store', name: 'המחסן', wall: 'wall_store', tint: 0xf2ead8 },
  { id: 'kitchen', name: 'המטבחון', wall: 'wall_kitchen', tint: 0xfff4e6 },
  { id: 'meeting', name: 'חדר הישיבות', wall: 'wall_meeting', tint: 0xf4efe6 },
  { id: 'yard', name: 'בית הגדי', wall: 'wall_yard', tint: 0xffe9d2 },
  { id: 'parking', name: 'החניון', wall: 'wall_parking', tint: 0xe8e8ee },
  { id: 'ido', name: 'מטה סוללת אידו', wall: 'wall_ido', tint: 0xf3efe8 },
];

export const LEVELS = [
  L({
    name: 'יום ראשון באתר', area: 0,
    map: `
      ...H...
      .......
      .#...#.
      .......
      ##...##
      .......
      .#...#.
      .......
      ...G...`,
    budget: 4, tools: ['snap', 'block'], snapHold: 4.0, shaked: 0,
    lior: { hp: 14, speed: 1.5 },
    waves: [{ t: 1, type: 'lior', hole: 0 }],
    tutorial: true,
    intro: [
      ['ofek', 'יש עכבר במכולה. אני חוזר: יש. עכבר. במכולה.'],
      ['shalev', 'קוראים לה ליאור באום. אני לא מתחבר אליה.'],
      ['ofek', 'שים לה מלכודת על השביל, וכשהיא נתפסת: תכסח אותה בכפכף! מהר!'],
    ],
  }),
  L({
    name: 'ליאור חוזרת', area: 0,
    map: `
      .H.....
      .......
      ###.###
      .......
      .......
      #.#.#.#
      .......
      .......
      .....G.`,
    budget: 7, tools: ['snap', 'cheese', 'block'],
    lior: { hp: 24, speed: 1.6 },
    waves: [{ t: 1, type: 'lior', hole: 0 }],
    hint: 'cheese',
    hint2: 'shaked',
    intro: [
      ['lior', 'חזרתי, מותק. והבאתי תיאבון.'],
      ['ofek', 'גבינה! היא לא עומדת בפני גבינה. שים אחת ליד המלכודת, היא תיעצר לאכול.'],
      ['shalev', 'דיווחתי לסוללת אידו. אמרו שזה "בטיפול".'],
      ['shaked', 'יש עכברים באחורי! אני אומרת את זה כבר חודשיים ואף אחד לא מקשיב לי!'],
    ],
  }),
  L({
    name: 'שתי מחילות', area: 0, newMouse: 'minion',
    map: `
      .H...H.
      .......
      .##.##.
      .......
      #..#..#
      .......
      .#.#.#.
      .......
      ...G...`,
    budget: 10, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 1,
    lior: { hp: 30, speed: 1.7 },
    waves: [{ t: 1, type: 'lior', hole: 0 }, { t: 7, type: 'minion', hole: 1 }],
    hint: 'glue',
    intro: [
      ['ofek', 'היא חפרה עוד מחילה. והביאה חבר. אני על הכיסא ולא יורד.'],
      ['shalev', 'אני לא מתחבר לעכברה הזאת. אם תלחץ עליי, אני אנתק לה את הראש מהמסלול.'],
      ['lior', 'תכירו את הבאומון. הוא מתמחה אצלי.'],
    ],
  }),
  L({
    name: 'ליאור למדה', area: 1,
    map: `
      ...H...
      .#.#.#.
      .......
      ##.#.##
      .......
      .##.##.
      .......
      #.....#
      ...G...`,
    budget: 11, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 1, smart: true,
    lior: { hp: 32, speed: 1.75 },
    waves: [{ t: 1, type: 'lior', hole: 0 }],
    hint: 'smart',
    intro: [
      ['lior', 'אני מכירה את המלכודות שלך, חביבי. אני עוקפת אותן בעיניים עצומות.'],
      ['shalev', 'היא עוקפת מלכודות שהיא רואה. תסגור לה את הדרכים עם בלוקים, שלא תהיה לה ברירה.'],
      ['ofek', 'סוללת אידו אמרו שהמחסן "לא באחריותם". גם המכולה לא. גם כלום.'],
    ],
  }),
  L({
    name: 'החמולה', area: 1,
    map: `
      H.....H
      .......
      ..###..
      .......
      .#...#.
      .......
      ..#.#..
      .......
      ...G...`,
    budget: 13, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 1,
    lior: { hp: 34, speed: 1.8 },
    waves: [
      { t: 1, type: 'lior', hole: 0 }, { t: 3, type: 'minion', hole: 1 },
      { t: 9, type: 'minion', hole: 0 }, { t: 14, type: 'minion', hole: 1 },
    ],
    intro: [
      ['ofek', 'הם מתרבים! יש פה יותר עכברים מעובדים!'],
      ['lior', 'העכברים משתלטים על האתר. תתרגלו.'],
      ['shaked', 'אמרתי לכם! אמרתי! עכברים באחורי! עכשיו יש חמולה!'],
      ['shalev', 'תגיד לסוללת אידו שאני לא מתחבר גם אליהם.'],
    ],
  }),
  L({
    name: 'מהצד השני', area: 1,
    map: `
      ...G...
      .......
      .#.#.#.
      .......
      ##...##
      .......
      .#.#.#.
      .......
      H.....H`,
    budget: 12, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 1, smart: true,
    lior: { hp: 38, speed: 1.85 },
    waves: [{ t: 1, type: 'lior', hole: 1 }, { t: 6, type: 'minion', hole: 0 }, { t: 12, type: 'minion', hole: 1 }],
    intro: [
      ['ofek', 'שמתי את החומוס על המדף מאחור. היא לא תגיע לשם. נכון? נכון?!'],
      ['lior', 'מדף? חמוד. אני עולה על מדפים מגיל שבועיים.'],
    ],
  }),
  L({
    name: 'ריצת בוקר', area: 2,
    map: `
      .H...H.
      .......
      #.#.#.#
      .......
      .......
      #.#.#.#
      .......
      .......
      ...G...`,
    budget: 13, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 1, glueHold: 2.1, snapHold: 3.0,
    lior: { hp: 40, speed: 2.15 },
    waves: [{ t: 1, type: 'lior', hole: 0 }, { t: 5, type: 'minion', hole: 1 }, { t: 10, type: 'minion', hole: 0 }],
    intro: [
      ['lior', 'שתיתי שלושה אספרסו מהמכונה של המטבחון. תנסה לעמוד בקצב.'],
      ['ofek', 'היא מהירה מדי! אני לא רואה אותה! היא מאחוריי?! אל תגידו לי!'],
      ['shalev', 'מכונת הקפה של סוללת אידו. גם היא לא עובדת, רק אצלה.'],
    ],
  }),
  L({
    name: 'פלישה למטבחון', area: 2,
    map: `
      H..H..H
      .......
      .#.#.#.
      .......
      .......
      .##.##.
      .......
      .......
      ...G...`,
    budget: 15, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 1, ofek: 2, snapHold: 3.0, glueHold: 2.1,
    lior: { hp: 40, speed: 2.0 },
    minion: { hp: 3, speed: 2.2 },
    waves: [
      { t: 1, type: 'minion', hole: 0 }, { t: 2, type: 'minion', hole: 2 }, { t: 4, type: 'lior', hole: 1 },
      { t: 8, type: 'minion', hole: 0 }, { t: 11, type: 'minion', hole: 2 }, { t: 15, type: 'minion', hole: 1 },
    ],
    intro: [
      ['ofek', 'שלוש מחילות. שלוש! אני מגיש מכתב התפטרות לסוללת אידו.'],
      ['shalev', 'הם לא יקראו אותו. הם לא מתחברים למכתבים.'],
      ['shaked', 'אני כבר כתבתי להם תלונה. ועוד אחת. ועוד שלושים.'],
      ['lior', 'באומונים, להסתער! החומוס של אופק שלנו!'],
    ],
  }),
  L({
    name: 'ליאור למדה עוד', area: 2,
    map: `
      .H...H.
      .......
      ##.#.##
      ...H...
      .#...#.
      .......
      ###.###
      .......
      ...G...`,
    budget: 14, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 1, smart: true, snapHold: 2.9, glueHold: 2.0,
    lior: { hp: 44, speed: 2.05 },
    minion: { hp: 3, speed: 2.1 },
    waves: [
      { t: 1, type: 'lior', hole: 2 }, { t: 4, type: 'minion', hole: 0 }, { t: 7, type: 'minion', hole: 1 },
      { t: 12, type: 'minion', hole: 2 },
    ],
    intro: [
      ['lior', 'חפרתי מחילה באמצע המטבחון. סוללת אידו אישרו לי היתר בנייה.'],
      ['ofek', 'הם נתנו לה היתר ולנו לא?!'],
      ['shalev', 'היא חכמה, היא עוקפת מלכודות. תבנה לה מבוך.'],
    ],
  }),
  L({
    name: 'השתלטות על האתר', area: 2, boss: true,
    map: `
      H.....H
      .......
      .#.#.#.
      .......
      H.....H
      .......
      .##.##.
      .......
      ...G...`,
    budget: 17, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, shaked: 2, food: 4, snapHold: 2.9, glueHold: 2.0,
    lior: { hp: 70, speed: 2.0 }, liorReturn: 2.0,
    minion: { hp: 4, speed: 2.2 },
    waves: [
      { t: 1, type: 'lior', hole: 0 }, { t: 3, type: 'minion', hole: 1 }, { t: 6, type: 'minion', hole: 2 },
      { t: 9, type: 'minion', hole: 3 }, { t: 13, type: 'minion', hole: 0 }, { t: 17, type: 'minion', hole: 3 },
      { t: 21, type: 'minion', hole: 1 },
    ],
    intro: [
      ['lior', 'זהו. האתר שלי. מהיום אני מנהלת העבודה, והחומוס עובר אליי.'],
      ['ofek', 'זה הקרב האחרון. אני יורד מהכיסא. ...טוב, לא. אבל אני צורח מאוד חזק.'],
      ['shalev', 'אני עדיין לא מתחבר אליה. אבל אני מתחבר לרעיון שהיא תיעלם.'],
      ['shaked', 'ואם היא עוד פעם מופיעה באחורי, אני מתלוננת עד שסוללת אידו סוגרים את האתר.'],
    ],
  }),
  // ---------- part two ----------
  L({
    name: 'הבאומון השמן', area: 3, newMouse: 'fat',
    map: `
      .H...H.
      .......
      .##.##.
      .......
      .##.##.
      .......
      .#...#.
      .......
      ...G...`,
    budget: 15, tools: ['snap', 'glue', 'cheese', 'block'], shalev: 1, snapHold: 2.9, glueHold: 2.0,
    lior: { hp: 52, speed: 2.0 },
    waves: [{ t: 1, type: 'fat', hole: 0 }, { t: 3, type: 'lior', hole: 1 }, { t: 10, type: 'minion', hole: 0 }, { t: 14, type: 'fat', hole: 1 }],
    hint: 'fat',
    intro: [
      ['ofek', 'מה זה הדבר הזה?! זה עכבר או מקרר?!'],
      ['lior', 'תכירו את צ׳יבוטרו. הוא אכל את כל הבורקס של הישיבה.'],
      ['shalev', 'הוא איטי, אבל צריך עליו הרבה מכות. דבק עליו ותכסח.'],
    ],
  }),
  L({
    name: 'מלכודת הדלי', area: 3,
    map: `
      ...H...
      .#...#.
      ...#...
      .#...#.
      ...#...
      .#...#.
      ...#...
      .......
      .G.....`,
    budget: 17, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 1, snapHold: 3.0, glueHold: 2.1,
    lior: { hp: 48, speed: 2.0 },
    waves: [{ t: 1, type: 'lior', hole: 0 }, { t: 6, type: 'fat', hole: 0 }, { t: 12, type: 'minion', hole: 0 }],
    hint: 'bucket',
    intro: [
      ['shaked', 'מצאתי דלי במחסן. ...אל תשאלו מה היה בו.'],
      ['ofek', 'דלי הפוך! היא נכנסת מתחת, הוא נופל, והיא תקועה שם הרבה זמן. ואז: כפכף.'],
      ['lior', 'דלי? מה אני, עכברה מסרט מצויר?'],
    ],
  }),
  L({
    name: 'ספרינטרים', area: 3, newMouse: 'fast',
    map: `
      H.....H
      .#.#.#.
      .......
      #.#.#.#
      .......
      .#.#.#.
      .......
      ##...##
      ...G...`,
    budget: 18, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 1, ofek: 2, snapHold: 3.0, glueHold: 2.1,
    lior: { hp: 50, speed: 2.05 }, fast: { hp: 2, speed: 2.6 },
    waves: [{ t: 1, type: 'fast', hole: 0 }, { t: 2.5, type: 'fast', hole: 1 }, { t: 5, type: 'lior', hole: 0 }, { t: 10, type: 'fast', hole: 1 }, { t: 13, type: 'fast', hole: 0 }, { t: 18, type: 'minion', hole: 1 }],
    hint: 'fast',
    intro: [
      ['lior', 'הבאתי את נבחרת הריצה של המחילה. הם עושים קילומטר בשלוש דקות.'],
      ['ofek', 'הם רצים כמו טילים! אני לא מספיק לצרוח!'],
      ['shalev', 'הם מהירים אבל שבירים. מכה אחת או שתיים. רק תפגע.'],
    ],
  }),
  L({
    name: 'ישיבת הנהלה', area: 3,
    map: `
      .H.H.H.
      .......
      ##.#.##
      .......
      .##.##.
      .......
      #.#.#.#
      .......
      ...G...`,
    budget: 19, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 1, smart: true, snapHold: 2.8, glueHold: 1.9,
    lior: { hp: 54, speed: 2.1 },
    waves: [{ t: 1, type: 'lior', hole: 1 }, { t: 4, type: 'minion', hole: 0 }, { t: 7, type: 'fat', hole: 2 }, { t: 11, type: 'fast', hole: 0 }, { t: 15, type: 'minion', hole: 2 }],
    intro: [
      ['lior', 'פתחתי ישיבת הנהלה. סדר יום: סעיף א׳, החומוס של אופק. סעיף ב׳, גם.'],
      ['shaked', 'הם עושים ישיבות ואנחנו לא? אני מתלוננת על זה במיוחד.'],
      ['shalev', 'היא שוב רואה מלכודות. תבנה לה מבוך.'],
    ],
  }),
  L({
    name: 'ההנהלה החדשה', area: 3,
    map: `
      H..H..H
      .......
      .#.#.#.
      .......
      .#####.
      .......
      .#.#.#.
      .......
      ...G...`,
    budget: 18, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 1, ofek: 2, snapHold: 2.8, glueHold: 1.9,
    lior: { hp: 62, speed: 2.1 },
    waves: [{ t: 1, type: 'lior', hole: 1 }, { t: 3, type: 'fat', hole: 0 }, { t: 3, type: 'fat', hole: 2 }, { t: 9, type: 'fast', hole: 1 }, { t: 12, type: 'minion', hole: 0 }, { t: 15, type: 'fast', hole: 2 }, { t: 19, type: 'minion', hole: 1 }],
    intro: [
      ['lior', 'ההנהלה החליטה פה אחד: החומוס עובר לעכברים. זה דמוקרטיה.'],
      ['ofek', 'מי הצביע?!'],
      ['lior', 'אני, צ׳יבוטרו וצ׳יבוטרו השני.'],
    ],
  }),
  L({
    name: 'שקיעה בבית הגדי', area: 4,
    map: `
      H.....H
      .......
      ..#.#..
      ...G...
      ..#.#..
      .......
      .......
      .#...#.
      H.....H`,
    budget: 18, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 1, snapHold: 2.8, glueHold: 1.9,
    lior: { hp: 62, speed: 2.15 },
    waves: [{ t: 1, type: 'lior', hole: 0 }, { t: 3, type: 'minion', hole: 3 }, { t: 6, type: 'fast', hole: 1 }, { t: 9, type: 'fat', hole: 2 }, { t: 13, type: 'fast', hole: 3 }, { t: 17, type: 'minion', hole: 0 }],
    intro: [
      ['ofek', 'יצאתי לחצר לראות את השקיעה. היה רגע של שקט. היה.'],
      ['lior', 'יפה פה בבית הגדי. אני אבנה פה מחילת נופש.'],
      ['shaked', 'עכשיו גם בחוץ?! יש עכברים באחורי וגם בקדמי!'],
    ],
  }),
  L({
    name: 'חכמה ומהירה', area: 4,
    map: `
      ...H...
      .#.#.#.
      .......
      ##.#.##
      .H...H.
      .#.#.#.
      .......
      #.....#
      ...G...`,
    budget: 18, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, smart: true, snapHold: 2.8, glueHold: 1.9,
    lior: { hp: 64, speed: 2.3 },
    waves: [{ t: 1, type: 'lior', hole: 0 }, { t: 4, type: 'fast', hole: 1 }, { t: 6, type: 'fast', hole: 2 }, { t: 11, type: 'fat', hole: 0 }, { t: 15, type: 'fast', hole: 1 }, { t: 17, type: 'fast', hole: 2 }],
    intro: [
      ['lior', 'התחלתי להתאמן עם הספרינטרים. ולמדתי עוד כמה טריקים.'],
      ['shalev', 'היא גם מהירה וגם עוקפת מלכודות. אני כמעט מתחבר. כמעט.'],
    ],
  }),
  L({
    name: 'מבצע חמולה', area: 4,
    map: `
      H.H.H.H
      .......
      .#.#.#.
      .......
      #.##.##
      .......
      .#.#.#.
      .......
      ...G...`,
    budget: 20, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, shaked: 2, food: 4, snapHold: 2.8, glueHold: 1.9,
    lior: { hp: 66, speed: 2.2 },
    waves: [
      { t: 1, type: 'minion', hole: 0 }, { t: 1.5, type: 'minion', hole: 3 }, { t: 3, type: 'lior', hole: 1 }, { t: 5, type: 'fat', hole: 2 },
      { t: 8, type: 'fast', hole: 0 }, { t: 9, type: 'fast', hole: 3 }, { t: 13, type: 'fat', hole: 1 }, { t: 16, type: 'minion', hole: 2 },
      { t: 19, type: 'fast', hole: 0 }, { t: 22, type: 'minion', hole: 3 },
    ],
    intro: [
      ['ofek', 'ארבע מחילות! זה כבר לא אתר בנייה, זה כפר עכברים!'],
      ['shaked', 'כתבתי לסוללת אידו מכתב של ארבעה עמודים. הם ענו במילה אחת: "קיבלנו".'],
      ['lior', 'באומונים! צ׳יבוטרואים! ספרינטרים! הכול לחומוס!'],
    ],
  }),
  L({
    name: 'המבוך של שליו', area: 4,
    map: `
      H......
      .#####.
      .....#.
      ##.#.#.
      ...#.#.
      .#.#...
      .#.####
      .#.....
      .#....G`,
    budget: 16, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, smart: true, snapHold: 2.7, glueHold: 1.9,
    lior: { hp: 70, speed: 2.2 }, liorReturn: 2.0,
    waves: [{ t: 1, type: 'lior', hole: 0 }, { t: 5, type: 'fat', hole: 0 }, { t: 9, type: 'fast', hole: 0 }, { t: 13, type: 'fast', hole: 0 }, { t: 17, type: 'fat', hole: 0 }],
    intro: [
      ['shalev', 'בניתי מבוך מהבלוקים. זה הדבר היחיד באתר שאני מתחבר אליו.'],
      ['lior', 'מבוך? אני גדלתי במחילה. כל החיים שלי מבוך.'],
      ['ofek', 'יש לה רק דרך אחת. תמלא אותה במלכודות!'],
    ],
  }),
  L({
    name: 'ליאור באום: הסיבוב הגדול', area: 4, boss: true,
    map: `
      H..H..H
      .......
      .#.#.#.
      H.....H
      .##.##.
      .......
      #.#.#.#
      .......
      ...G...`,
    budget: 24, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, shaked: 2, food: 4, snapHold: 2.8, glueHold: 1.9, bucketHold: 4.3,
    lior: { hp: 84, speed: 2.2 }, liorReturn: 1.9,
    waves: [
      { t: 1, type: 'lior', hole: 1 }, { t: 3, type: 'fast', hole: 3 }, { t: 5, type: 'fat', hole: 0 }, { t: 7, type: 'fast', hole: 4 },
      { t: 10, type: 'minion', hole: 2 }, { t: 13, type: 'fat', hole: 3 }, { t: 16, type: 'fast', hole: 0 }, { t: 18, type: 'fast', hole: 2 },
      { t: 21, type: 'minion', hole: 4 }, { t: 24, type: 'fat', hole: 1 },
    ],
    intro: [
      ['lior', 'זהו. אני לוקחת את החומוס, את האתר, ואת בית הגדי.'],
      ['shaked', 'ואני לוקחת את הכפכף.'],
      ['ofek', 'אני... אני יורד מהכיסא. באמת הפעם. בשביל החומוס.'],
      ['shalev', 'טוב. בפעם הראשונה בחיים: אני מתחבר. יאללה.'],
    ],
  }),
  // ---------- part three: Orel, the family, and Ido's own headquarters ----------
  L({
    name: 'אוראל מגיע', area: 5, newMouse: 'orel',
    map: `
      .H...H.
      .......
      .#.#.#.
      .......
      ##.#.##
      .......
      .#...#.
      .......
      ...G...`,
    budget: 17, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 1, snapHold: 2.8, glueHold: 1.9, items: { spray: 2 },
    orel: { hp: 59, speed: 2.15 },
    waves: [{ t: 1, type: 'orel', hole: 0 }, { t: 4, type: 'minion', hole: 1 }, { t: 8, type: 'fast', hole: 0 }, { t: 12, type: 'minion', hole: 1 }, { t: 15, type: 'fat', hole: 0 }],
    hint: 'spray',
    intro: [
      ['orel', 'תקשיב טוב, חביבי. החומוס הזה? מהיום הוא של המשפחה.'],
      ['ofek', 'מי זה?! למה יש לו סוויטשירט סטן?!'],
      ['shaked', 'הבאתי תרסיס נגד עכברים. סוללת אידו אמרו שזה "לא תקני". שיתבעו אותי.'],
    ],
  }),
  L({
    name: 'שיקוי הבגידה', area: 5,
    map: `
      H..H..H
      .......
      .##.##.
      .......
      .......
      #.#.#.#
      .......
      .......
      ...G...`,
    budget: 19, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 1, snapHold: 2.8, glueHold: 1.9, items: { spray: 1, potion: 2 },
    lior: { hp: 74, speed: 2.15 },
    waves: [
      { t: 1, type: 'lior', hole: 1 }, { t: 2, type: 'minion', hole: 0 }, { t: 2.5, type: 'minion', hole: 2 }, { t: 6, type: 'minion', hole: 0 },
      { t: 7, type: 'fat', hole: 2 }, { t: 11, type: 'minion', hole: 1 }, { t: 14, type: 'fast', hole: 0 }, { t: 15, type: 'fast', hole: 2 },
    ],
    hint: 'potion',
    intro: [
      ['shalev', 'מצאתי שיקוי במחסן. מי ששותה אותו מתחיל להרביץ לחברים שלו. מזכיר לי משהו.'],
      ['lior', 'הבאומונים שלי נאמנים לי. נכון, חבר׳ה? ...חבר׳ה?'],
    ],
  }),
  L({
    name: 'בלטות מהשמיים', area: 5,
    map: `
      H.....H
      .#...#.
      .......
      ..#.#..
      H.....H
      .......
      .#.#.#.
      .......
      ...G...`,
    budget: 17, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 1, ofek: 2, snapHold: 2.8, glueHold: 1.9, items: { spray: 1, potion: 1, tile: 2 },
    orel: { hp: 62, speed: 2.2 },
    waves: [
      { t: 1, type: 'fast', hole: 0 }, { t: 1.5, type: 'fast', hole: 1 }, { t: 3, type: 'orel', hole: 2 }, { t: 4, type: 'fast', hole: 3 },
      { t: 7, type: 'minion', hole: 0 }, { t: 8, type: 'minion', hole: 1 }, { t: 11, type: 'fast', hole: 2 }, { t: 12, type: 'fast', hole: 3 }, { t: 16, type: 'fat', hole: 0 },
    ],
    hint: 'tile',
    intro: [
      ['ofek', 'יש בלטות על הגג של החניון. אני עולה לשם. גבוה. רחוק מהעכברים.'],
      ['orel', 'בלטות? אצלנו במשפחה זורקים בלטות רק על מי שלא משלם.'],
      ['shaked', 'אופק, תזרוק! על כולם! עכשיו!'],
    ],
  }),
  L({
    name: 'המשפחה', area: 5, boss: true,
    map: `
      .H...H.
      .#...#.
      ...#...
      .#...#.
      ...#...
      .#.#.#.
      .......
      ##...##
      ...G...`,
    budget: 19, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, food: 4, snapHold: 2.8, glueHold: 1.9, items: { spray: 2, potion: 1, tile: 1 },
    lior: { hp: 84, speed: 2.15 }, orel: { hp: 62, speed: 2.2 }, liorReturn: 2.2,
    waves: [{ t: 1, type: 'lior', hole: 0 }, { t: 2, type: 'orel', hole: 1 }, { t: 7, type: 'minion', hole: 0 }, { t: 10, type: 'fat', hole: 1 }, { t: 14, type: 'fast', hole: 0 }],
    intro: [
      ['lior', 'אוראל, אתה בא?'],
      ['orel', 'אני תמיד בא. המשפחה לא משאירה חומוס על השולחן.'],
      ['shalev', 'שניהם ביחד. אני מתחבר לזה פחות מתמיד.'],
    ],
  }),
  L({
    name: 'מרדף בחניון', area: 5,
    map: `
      H.H.H.H
      .......
      #.#.#.#
      .......
      .##.##.
      .......
      #.#.#.#
      .......
      ...G...`,
    budget: 21, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, smart: true, snapHold: 2.7, glueHold: 1.8, items: { spray: 2, potion: 1, tile: 1 },
    orel: { hp: 56, speed: 2.3 },
    minion: { hp: 4, speed: 2.3 }, fast: { hp: 2, speed: 3.0 },
    waves: [
      { t: 1, type: 'orel', hole: 1 }, { t: 2, type: 'fast', hole: 0 }, { t: 2.5, type: 'fast', hole: 3 }, { t: 6, type: 'minion', hole: 2 },
      { t: 9, type: 'fat', hole: 0 }, { t: 12, type: 'fast', hole: 1 }, { t: 13, type: 'fast', hole: 2 }, { t: 17, type: 'minion', hole: 3 },
    ],
    intro: [
      ['orel', 'למדתי מליאור. אני רואה מלכודות מקילומטר.'],
      ['shaked', 'הם עוקפים מלכודות?! תחסום להם הכול ותרסס!'],
    ],
  }),
  L({
    name: 'הלובי של סוללת אידו', area: 6,
    map: `
      ...H...
      .#####.
      .......
      H.#.#.H
      .......
      .#####.
      .......
      .#...#.
      ...G...`,
    budget: 19, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, snapHold: 2.7, glueHold: 1.8, items: { spray: 2, potion: 2, tile: 1 },
    lior: { hp: 89, speed: 2.2 },
    waves: [
      { t: 1, type: 'lior', hole: 0 }, { t: 3, type: 'minion', hole: 1 }, { t: 3.5, type: 'minion', hole: 2 }, { t: 7, type: 'fat', hole: 1 },
      { t: 8, type: 'fat', hole: 2 }, { t: 12, type: 'fast', hole: 0 }, { t: 15, type: 'minion', hole: 1 }, { t: 16, type: 'minion', hole: 2 },
    ],
    intro: [
      ['shaked', 'הגענו למטה של סוללת אידו. אם הם לא מטפלים, אנחנו נטפל.'],
      ['ofek', 'רגע... יש פה עכברים בלובי?! גם אצלם?!'],
      ['lior', 'ברוכים הבאים למשרד שלי.'],
    ],
  }),
  L({
    name: 'מחלקת תלונות', area: 6,
    map: `
      H.....H
      .##.##.
      .......
      #.#.#.#
      .H...H.
      .......
      ##.#.##
      .......
      ...G...`,
    budget: 22, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, food: 4, snapHold: 2.7, glueHold: 1.8, items: { spray: 2, potion: 2, tile: 2 },
    orel: { hp: 60, speed: 2.3 },
    minion: { hp: 5, speed: 2.3 }, fast: { hp: 2, speed: 3.3 }, fat: { hp: 12, speed: 1.35 },
    waves: [
      { t: 1, type: 'fast', hole: 0 }, { t: 1, type: 'fast', hole: 1 }, { t: 3, type: 'orel', hole: 2 }, { t: 4, type: 'minion', hole: 3 },
      { t: 7, type: 'fat', hole: 0 }, { t: 8, type: 'fat', hole: 1 }, { t: 11, type: 'fast', hole: 2 }, { t: 12, type: 'fast', hole: 3 },
      { t: 15, type: 'minion', hole: 0 }, { t: 16, type: 'minion', hole: 1 }, { t: 19, type: 'fast', hole: 2 },
    ],
    intro: [
      ['shaked', 'זאת מחלקת התלונות. יש פה 4,812 תלונות שלי. אף אחת לא נפתחה.'],
      ['orel', 'אנחנו משתמשים בהן לבנות מחילות. נייר טוב.'],
    ],
  }),
  L({
    name: 'ישיבת הנהלה של סוללת אידו', area: 6, boss: true,
    map: `
      .H.H.H.
      .......
      ##.#.##
      .......
      .#.#.#.
      .......
      #.###.#
      .......
      ...G...`,
    budget: 23, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, smart: true, food: 4, snapHold: 2.7, glueHold: 1.8, items: { spray: 2, potion: 2, tile: 2 },
    lior: { hp: 84, speed: 2.25 }, orel: { hp: 60, speed: 2.3 }, liorReturn: 2.0,
    waves: [
      { t: 1, type: 'lior', hole: 1 }, { t: 2, type: 'orel', hole: 2 }, { t: 5, type: 'minion', hole: 0 }, { t: 9, type: 'fat', hole: 2 },
      { t: 12, type: 'fast', hole: 0 }, { t: 13, type: 'fast', hole: 1 }, { t: 17, type: 'minion', hole: 2 },
    ],
    intro: [
      ['lior', 'פתחנו את ישיבת ההנהלה. סעיף ראשון: אנחנו ההנהלה.'],
      ['orel', 'סעיף שני: מי שמתלונן, מקבל בלטה.'],
      ['shalev', 'סוף סוף ישיבה שאני מתחבר אליה. כי אני הולך לפרק אותה.'],
    ],
  }),
  L({
    name: 'הכספת', area: 6,
    map: `
      H.....H
      .#.#.#.
      .#.#.#.
      .......
      ###.###
      ..#.#..
      .#...#.
      .#.#.#.
      ...G...`,
    budget: 18, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, smart: true, food: 4, snapHold: 2.7, glueHold: 1.8, items: { spray: 2, potion: 2, tile: 2 },
    lior: { hp: 94, speed: 2.3 },
    minion: { hp: 5, speed: 2.3 }, fast: { hp: 2, speed: 3.3 }, fat: { hp: 14, speed: 1.4 },
    waves: [
      { t: 1, type: 'lior', hole: 0 }, { t: 2, type: 'fat', hole: 1 }, { t: 5, type: 'fast', hole: 0 }, { t: 6, type: 'fast', hole: 1 },
      { t: 10, type: 'fat', hole: 0 }, { t: 13, type: 'minion', hole: 1 }, { t: 14, type: 'minion', hole: 0 }, { t: 18, type: 'fast', hole: 1 },
    ],
    intro: [
      ['ofek', 'זאת הכספת של סוללת אידו. מה הם שומרים פה?'],
      ['shaked', 'את כל הכסף שלא הוציאו על מדביר.'],
      ['lior', 'ועכשיו הוא שלי. כמו כל השאר.'],
    ],
  }),
  L({
    name: 'העימות האחרון', area: 6, boss: true,
    map: `
      H.H.H.H
      .......
      .#.#.#.
      H.....H
      ..#.#..
      .#...#.
      .......
      #.#.#.#
      ...G...`,
    budget: 22, tools: ['snap', 'bucket', 'glue', 'cheese', 'block'], shalev: 2, ofek: 2, shaked: 2, food: 4, snapHold: 2.7, glueHold: 1.8, bucketHold: 4.2,
    items: { spray: 3, potion: 2, tile: 2 },
    lior: { hp: 108, speed: 2.25 }, orel: { hp: 76, speed: 2.3 }, liorReturn: 1.8,
    minion: { hp: 5, speed: 2.3 }, fast: { hp: 2, speed: 3.3 }, fat: { hp: 14, speed: 1.4 },
    waves: [
      { t: 1, type: 'lior', hole: 1 }, { t: 2, type: 'orel', hole: 2 }, { t: 4, type: 'fast', hole: 0 }, { t: 4.5, type: 'fast', hole: 3 },
      { t: 8, type: 'fat', hole: 4 }, { t: 9, type: 'fat', hole: 5 }, { t: 12, type: 'minion', hole: 0 }, { t: 13, type: 'minion', hole: 3 },
      { t: 16, type: 'fast', hole: 4 }, { t: 17, type: 'fast', hole: 5 }, { t: 21, type: 'fat', hole: 1 }, { t: 24, type: 'minion', hole: 2 },
    ],
    intro: [
      ['lior', 'זהו. כל המשפחה פה. כל המחילות פתוחות. אין לכם לאן לברוח.'],
      ['orel', 'תמסרו את החומוס בשקט, ואף אחד לא מקבל בלטה.'],
      ['shaked', 'יש לי תרסיס, שיקוי, ובלטה. ותלונה. בעיקר תלונה.'],
      ['ofek', 'אני יורד מהכיסא. הפעם באמת. בשביל האתר.'],
      ['shalev', 'אני... מתחבר. יאללה, לסיים את זה.'],
    ],
  }),
];
