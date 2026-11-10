// Static game data: who exists, what they drive, what they shout.

export const CHARS = {
  hero:   { model: 'c_hero',  height: 1.78, name: 'נהוראי' },
  shimi:  { model: 'c_shimi', height: 1.72, name: 'שימי' },
  rival:  { model: 'c_rival', height: 1.76, name: 'ילד מג׳' },
  goon:   { model: 'c_goon',  height: 1.92, name: 'גובה' },
  cop:    { model: 'c_cop',   height: 1.8,  name: 'שוטר' },
  savta:  { model: 'c_savta', height: 1.55, name: 'סבתא', speed: 0.72 },
  dod:    { model: 'c_dod',   height: 1.7,  name: 'דוד' },
  girl:   { model: 'c_girl',  height: 1.66, name: 'בחורה' },
  boss:   { model: 'c_boss',  height: 1.78, name: 'ז׳וז׳ו' },
  mom:    { model: 'c_mom',   height: 1.62, name: 'אמא' },
};

// Archetypes spawned on the street. tint multiplies the texture so one model gives several people.
export const PEDS = {
  dod:    { char: 'dod',   hp: 70,  tints: [0xffffff, 0xd9c7b0, 0xc9d6e2], faction: 'civ', brave: 0.25 },
  savta:  { char: 'savta', hp: 40,  tints: [0xffffff, 0xe8d8ea, 0xd8e6d2], faction: 'civ', brave: 0.0 },
  girl:   { char: 'girl',  hp: 55,  tints: [0xffffff, 0xf2c8c8, 0xc8d8f2, 0xd2f0d0], faction: 'civ', brave: 0.1 },
  mom:    { char: 'mom',   hp: 55,  tints: [0xffffff, 0xd6c6e6, 0xe6dcc0], faction: 'civ', brave: 0.1 },
  suit:   { char: 'boss',  hp: 70,  tints: [0xb9c4d6, 0xd6c9b0, 0x9aa3ad], faction: 'civ', brave: 0.2 },
  youth:  { char: 'hero',  hp: 90,  tints: [0xc9a0a0, 0xa9b9d9, 0xd9d0a0, 0xa0d0b0], faction: 'civ', brave: 0.6 },
  dalet:  { char: 'shimi', hp: 110, tints: [0xffffff, 0xffc9b0, 0xd0d0ff], faction: 'dalet', brave: 1 },
  dalet2: { char: 'hero',  hp: 110, tints: [0xff9a8a, 0xffb070], faction: 'dalet', brave: 1 },
  gimel:  { char: 'rival', hp: 110, tints: [0xffffff, 0xd0b0ff, 0xb0b0c8], faction: 'gimel', brave: 1 },
  gimel2: { char: 'shimi', hp: 120, tints: [0x9070d0, 0x7060b0], faction: 'gimel', brave: 1 },
  goon:   { char: 'goon',  hp: 190, tints: [0xffffff, 0xc8c0b8], faction: 'goon', brave: 1, dmg: 1.5 },
  cop:    { char: 'cop',   hp: 150, tints: [0xffffff], faction: 'cop', brave: 1, dmg: 1.2 },
  guard:  { char: 'cop',   hp: 140, tints: [0x9a9a9a, 0x808a80], faction: 'guard', brave: 1, dmg: 1.2 },
  worker: { char: 'dod',   hp: 90,  tints: [0xf0b040, 0xe07030], faction: 'civ', brave: 0.5 },
};
export const CIV_MIX = ['dod', 'dod', 'savta', 'girl', 'girl', 'mom', 'suit', 'youth', 'youth'];

// Vehicles. len/wid in metres, mass in tonnes-ish, top speed m/s. front: which model axis faces forward.
export const VEHICLES = {
  sedan:   { model: 'v_sedan',   name: 'סוסיתא 1.6',      len: 4.3, wid: 1.72, hgt: 1.42, mass: 1.1, top: 36, acc: 7.5, grip: 1.0, tints: [0xffffff, 0xc9302a, 0x2a4f9a, 0x8e8e8e, 0x23262b, 0xc8b070, 0x3a7a5a], seat: [0.38, 0.55, 0.1] },
  hatch:   { model: 'v_hatch',   name: 'נמלה עירונית',     len: 3.85, wid: 1.68, hgt: 1.5, mass: 1.0, top: 34, acc: 7.0, grip: 1.05, tints: [0xffffff, 0xd9d9d9, 0xb3261e, 0x3d5f9e, 0x6a6a6a, 0xf0c040], seat: [0.36, 0.55, 0.05] },
  pickup:  { model: 'v_pickup',  name: 'טנדר מגנום',       len: 5.1, wid: 1.82, hgt: 1.75, mass: 1.7, top: 33, acc: 6.5, grip: 0.92, tints: [0xffffff, 0xd9d2bd, 0x9a9a9a, 0x7a3a2a], seat: [0.42, 0.75, 0.5] },
  van:     { model: 'v_van',     name: 'ואן קבלנים',       len: 5.2, wid: 1.95, hgt: 2.3, mass: 2.0, top: 30, acc: 5.5, grip: 0.88, tints: [0xffffff, 0xe8e8e8, 0xf0d060], seat: [0.45, 0.9, 1.2] },
  taxi:    { model: 'v_sedan',   name: 'מונית',            len: 4.3, wid: 1.72, hgt: 1.42, mass: 1.1, top: 37, acc: 7.8, grip: 1.0, tints: [0xffffff], seat: [0.38, 0.55, 0.1], roofSign: 0xf5d020 },
  police:  { model: 'v_police',  name: 'ניידת',            len: 4.5, wid: 1.82, hgt: 1.7, mass: 1.5, top: 42, acc: 9.5, grip: 1.12, tints: [0xffffff], seat: [0.4, 0.7, 0.2], siren: true },
  armored: { model: 'v_armored', name: 'משוריין כספים',    len: 6.0, wid: 2.3, hgt: 2.7, mass: 5.5, top: 26, acc: 4.2, grip: 0.85, tints: [0xffffff], seat: [0.5, 1.2, 1.4], tough: 4 },
  truck:   { model: 'v_truck',   name: 'משאית חלוקה',      len: 6.4, wid: 2.3, hgt: 3.0, mass: 4.0, top: 27, acc: 4.5, grip: 0.85, tints: [0xffffff, 0xe8e0c8], seat: [0.5, 1.3, 2.0], tough: 2 },
  bus:     { model: 'v_bus',     name: 'אוטובוס קו 7',     len: 11.5, wid: 2.55, hgt: 3.1, mass: 9.0, top: 24, acc: 3.6, grip: 0.8, tints: [0xffffff], seat: [0.7, 1.3, 4.2], tough: 3 },
  tractor: { model: 'v_tractor', name: 'שופל',             len: 6.8, wid: 2.4, hgt: 3.6, mass: 7.0, top: 13, acc: 4.0, grip: 0.9, tints: [0xffffff], seat: [0, 1.9, 0.3], tough: 4 },
  moped:   { model: 'v_moped',   name: 'קטנוע משלוחים',    len: 2.15, wid: 0.8, hgt: 1.35, mass: 0.25, top: 30, acc: 9.0, grip: 1.1, tints: [0xffffff, 0xff8a70], seat: [0, 0.78, -0.25], bike: true },
};
export const TRAFFIC_MIX = ['sedan', 'sedan', 'hatch', 'hatch', 'hatch', 'pickup', 'van', 'taxi', 'sedan', 'moped', 'truck', 'bus'];
export const PARKED_MIX = ['sedan', 'sedan', 'hatch', 'hatch', 'pickup', 'van', 'moped', 'hatch'];

// Things people say. Chosen by situation; shown as speech bubbles.
export const BARKS = {
  bump: ['יא אחי, עיניים!', 'מה אתה דוחף?', 'סליחה?!', 'נו באמת', 'חביבי, יש מדרכה לכולם', 'תסתכל לאן אתה הולך'],
  flee: ['יא אללה!', 'משטרה! משטרה!', 'לא ראיתי כלום!', 'אמא׳לה!', 'תתקשרו 100!', 'אני רק עברתי פה!'],
  savta: ['אני מכירה את אמא שלך!', 'בזמני היה כבוד', 'בוא נראה אותך מרים יד על סבתא', 'נהוראי! מה זה צריך להיות?!', 'יש לי את המספר של ראש העיר'],
  hit: ['אאוץ׳!', 'בן של...', 'אתה גמור', 'על מי אתה מרים יד?!', 'חכה חכה'],
  dalet: ['ד׳ זה משפחה', 'מי נגע בו?!', 'אחי, אנחנו איתך', 'יאללה בלאגן', 'פה זה לא ג׳'],
  gimel: ['טעית בשכונה', 'מה אתה עושה פה, ד׳?', 'תביאו את כולם!', 'פה זה ג׳, מותק', 'אתה לא יוצא מפה'],
  goon: ['ז׳וז׳ו מוסר ד״ש', 'הריבית עלתה', 'כלום אישי, חביבי', 'חוב זה חוב'],
  cop: ['עצור! משטרה!', 'ידיים למעלה!', 'נהוראי, אל תקשה עליי', 'מרכז, חשוד בורח', 'עוד דו״ח היום ואני סוגר מכסה'],
  car: ['הרכב שלי!!', 'זה עוד בליסינג!', 'גנב! גנב!', 'יש לי שם את התיק!', 'לפחות תתדלק אותו'],
  idle: ['שמעת שמעלים ארנונה?', 'אומרים שיבנו פה מגדלים', 'הפועל שוב הפסידו', 'הכספומט שוב אכל לי את הכרטיס', 'מי מוכר פה גרעינים?', 'אחי, יש לך סיגריה?',
    'עמידר אמרו שיבואו ביום שלישי. איזה שלישי לא אמרו', 'הילד שלי בצבא, אני לא ישנה', 'איפה התור לביטוח לאומי?', 'חם היום, אה?', 'אתמול הייתה חתונה בוורסאי, שמעו עד דימונה'],
  queue: ['אני פה משש בבוקר', 'איזה מספר אתה?', 'המחשב נפל. שוב', 'אמרו לחזור מחר עם טופס 4', 'מי אחרון?'],
  cheer: ['תן לו!', 'מכות! מכות!', 'וואלה איזה סטירה', 'מי מצלם?', 'זה עולה לסטורי'],
};

export const FACTION_COLOR = { dalet: '#f5b301', gimel: '#8a3fe0', cop: '#2a6bff', goon: '#e5412d', guard: '#9aa3ad' };
// Who a faction attacks on sight when provoked nearby.
export const ENEMIES = { dalet: ['gimel', 'goon'], gimel: ['dalet'], goon: ['dalet'], cop: [], guard: [], civ: [] };

export const RADIO = [
  { id: 'off', name: 'רדיו כבוי' },
  { id: 'darom', name: 'רדיו דרום 97.5', file: 'assets/audio/radio_darom.m4a', tag: 'ים־תיכוני · טראפ מזרחי' },
  { id: 'lev', name: 'קול הלב 101', file: 'assets/audio/radio_lev.m4a', tag: 'חפלות · דרבוקות · חתונות' },
];

// Generated buildings and street furniture beyond the first set (assets/models/<name>.glb).
export const ENV_MODELS = ['b_school', 'b_police', 'b_bituach', 'b_city', 'b_wedding', 'b_matnas', 'b_garage', 'b_scrap', 'b_hangarA', 'b_hangarB', 'b_tower', 'b_skeleton', 'b_gas', 'e_stall', 'b_shops2', 'b_shops3', 'b_blockD', 'b_blockE', 'e_bench', 'e_crane', 'e_euc', 'e_bush', 'b_station', 'e_signpost', 'e_wall', ];
