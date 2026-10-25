// Ten levels in three parts of the site. Maps are 7 wide, 9 deep, back wall first:
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
  minion: { hp: 3, speed: 2.0 },
  ...def,
  ...parse(def.map),
});

export const AREAS = [
  { id: 'office', name: 'הקרוואן של מנהל העבודה', wall: 'wall_office', tint: 0xffffff },
  { id: 'store', name: 'המחסן', wall: 'wall_store', tint: 0xf2ead8 },
  { id: 'kitchen', name: 'המטבחון', wall: 'wall_kitchen', tint: 0xfff4e6 },
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
      ['ofek', 'יש עכבר בקרוואן. אני חוזר: יש. עכבר. בקרוואן.'],
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
    name: 'שתי מחילות', area: 0,
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
      ['ofek', 'סוללת אידו אמרו שהמחסן "לא באחריותם". גם הקרוואן לא. גם כלום.'],
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
];
