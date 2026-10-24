// Game tuning and content tables. All player-facing text is Hebrew.

export const LANE_X = [-2.4, 0, 2.4];
export const LANE_W = 2.4;

export const SPEED = {
  start: 13,
  max: 34,
  rampDist: 3200, // meters to reach ~63% of the way from start to max
};

export const PHYS = {
  gravity: 46,
  jumpHeight: 2.25,
  superJumpHeight: 4.4,
  rollTime: 0.62,
  laneTime: 0.16,
  fastFall: 34,
};

export const PLAYER_BOX = { halfW: 0.34, halfD: 0.3, height: 1.6, rollHeight: 0.85 };

// Playable characters. `model` is loaded lazily; all of them share models/anims.glb.
export const CHARACTERS = [
  { id: 'tzabar', name: 'יוני', title: 'הצבר מנחלאות', price: 0, model: 'models/ch_tzabar.glb', color: '#3fa7a0',
    bio: 'מכיר כל דוכן בשוק, וכל קיצור דרך.' },
  { id: 'student', name: 'נועה', title: 'סטודנטית בבצלאל', price: 15000, model: 'models/ch_student.glb', color: '#e2a93b',
    bio: 'באה לקנות פירות לציור טבע דומם, נשארה לרוץ.' },
  { id: 'chef', name: 'אסף', title: 'השף של השוק', price: 30000, model: 'models/ch_chef.glb', color: '#e0e6ea',
    bio: 'צריך עגבניות טריות לפני שהמסעדה נפתחת.' },
  { id: 'savta', name: 'סבתא שושנה', title: 'בת 78, רצה מרתונים', price: 50000, model: 'models/ch_savta.glb', color: '#7b3fa0',
    bio: 'אף אחד לא עוקף אותה בתור לחלות.' },
  { id: 'soldier', name: 'עומרי', title: 'חייל ביציאה', price: 75000, model: 'models/ch_soldier.glb', color: '#6b7b3a',
    bio: 'יש לו שעתיים עד האוטובוס חזרה לבסיס.' },
  { id: 'tourist', name: "ג'ף", title: 'תייר מאוהיו', price: 100000, model: 'models/ch_tourist.glb', color: '#f06b4f',
    bio: 'צילם כל רימון בשוק. פעמיים.' },
  { id: 'ars', name: 'מאור', title: 'השרירי עם השרשרת', price: 150000, model: 'models/ch_ars.glb', color: '#d6b03c',
    bio: 'אחי, תביא מקום. הוא ממהר.' },
  { id: 'dj', name: 'לילך', title: 'הדי־ג׳יי של הלילה', price: 220000, model: 'models/ch_dj.glb', color: '#9be12b',
    bio: 'מתקלטת בבר של השוק כשהדוכנים נסגרים.' },
  { id: 'cat', name: 'ג׳ינג׳י', title: 'החתול של השוק', price: 350000, model: 'models/ch_cat.glb', color: '#f08a24',
    bio: 'המלך האמיתי של מחנה יהודה. גונב דגים בלי להתנצל.' },
];

// Obstacle people and objects. kind: wall (dodge), low (jump), high (roll), platform (climb on top).
// speed: walking speed toward the player in m/s.
export const NPC_TYPES = {
  grandpa:  { model: 'models/npc_grandpa.glb',  kind: 'wall', w: 0.95, d: 1.0, h: 1.7, speed: 1.3, bob: 'shuffle', say: ['סליחה, סליחה...', 'לאט, ילד!', 'יש פה תור!'] },
  moroccan: { model: 'models/npc_moroccan.glb', kind: 'wall', w: 1.0, d: 0.7, h: 1.6, speed: 0.9, rig: 'walk', say: ['כמה זה הקילו?!', 'יא חביבי, תיזהר!', 'בעשר? בשמונה!'] },
  breslov:  { model: 'models/npc_breslov.glb',  kind: 'wall', w: 1.0, d: 0.6, h: 1.8, speed: 0, rig: 'dance', say: ['נ נח נחמ נחמן מאומן!', 'רק שמחה!', 'אין שום ייאוש!'] },
  chabad:   { model: 'models/npc_chabad.glb',   kind: 'wall', w: 0.8, d: 0.8, h: 1.8, speed: 0, bob: 'sway', say: ['הנחת תפילין היום?', 'רק דקה, אחי!', 'שבת שלום!'] },
  vendor:   { model: 'models/npc_vendor.glb',   kind: 'wall', w: 1.1, d: 0.7, h: 1.8, speed: 0, bob: 'shout', say: ['הכל בעשר! הכל בעשר!', 'עגבניות מתוקות!', 'יאללה, יאללה!'] },
  jack:     { model: 'models/npc_jack.glb',     kind: 'wall', w: 1.4, d: 1.9, h: 1.9, speed: 2.4, bob: 'push', say: ['זהירות, ג׳ק!', 'פנו דרך!', 'סחורה עוברת!'] },
  scooter:  { model: 'models/npc_scooter.glb',  kind: 'wall', w: 0.9, d: 1.7, h: 1.7, speed: 7.5, bob: 'ride', say: ['משלוח דחוף!', 'צפצוף!', 'תזוז!'] },
};

// Playable characters double as walking pedestrians (when not the one being played).
export const PEDESTRIAN_SAY = ['אופס!', 'רגע, רגע!', 'איפה החלבה?', 'מה הלחץ?', 'שבת שלום!'];

export const POWERUPS = {
  magnet:   { name: 'מגנט', desc: 'מושך אליך את כל המטבעות', base: 9, step: 2.5, color: '#e63946' },
  x2:       { name: 'רוגלך כפול', desc: 'כל הנקודות כפול 2', base: 10, step: 2.5, color: '#c47a2c' },
  sneakers: { name: 'נעלי קפיצה', desc: 'קפיצות ענק מעל הכל', base: 9, step: 2.5, color: '#2a9df4' },
  hamsa:    { name: 'חמסה', desc: 'מגינה עליך מהתנגשות אחת', base: 12, step: 3, color: '#1d6fd8' },
};
// prices are in shekels; every coin you pick up is worth ₪10
export const UPGRADE_COST = [5000, 12000, 25000, 50000, 90000];
export const MAX_UPGRADE = 5;

// Zones change look, obstacle mix and difficulty as the run goes on.
export const ZONES = [
  { id: 'open',    name: 'רחוב מחנה יהודה', sub: 'בוקר של יום שישי', theme: 'day' },
  { id: 'covered', name: 'השוק המקורה',      sub: 'רחוב עץ החיים',    theme: 'covered' },
  { id: 'sunset',  name: 'ערב שבת',          sub: 'כולם ממהרים הביתה', theme: 'sunset' },
  { id: 'night',   name: 'השוק בלילה',       sub: 'הבארים נפתחים',     theme: 'night' },
];
export const ZONE_LENGTH = 900;

export const REVIVE_COST = [4000, 9000];
export const LEVEL_REWARD = 5000; // × the level you just finished

// Mission templates. `stat` names a per-run counter tracked by the game.
export const MISSIONS = [
  { stat: 'coins',     text: n => `אספו ${n} מטבעות בריצה אחת`, base: 120, grow: 1.35, single: true },
  { stat: 'dist',      text: n => `רוצו ${n} מטר בריצה אחת`, base: 600, grow: 1.3, single: true },
  { stat: 'jumps',     text: n => `קפצו ${n} פעמים`, base: 25, grow: 1.3 },
  { stat: 'rolls',     text: n => `התגלגלו ${n} פעמים`, base: 20, grow: 1.3 },
  { stat: 'score',     text: n => `השיגו ${n} נקודות בריצה אחת`, base: 8000, grow: 1.45, single: true },
  { stat: 'powerups',  text: n => `אספו ${n} חפצים מיוחדים`, base: 4, grow: 1.25 },
  { stat: 'dodgeNpc',  text: n => `עקפו ${n} אנשים בשוק`, base: 40, grow: 1.3 },
  { stat: 'roofs',     text: n => `עלו על גג של משאית ${n} פעמים`, base: 3, grow: 1.3 },
  { stat: 'zones',     text: n => `הגיעו לאזור ${n} בריצה אחת`, base: 2, grow: 1.0, single: true, cap: 4 },
  { stat: 'magnetCoins', text: n => `אספו ${n} מטבעות עם מגנט`, base: 60, grow: 1.35 },
  { stat: 'nearMiss',  text: n => `עברו ${n} פעמים ממש ליד מישהו`, base: 10, grow: 1.3 },
  { stat: 'runs',      text: n => `שחקו ${n} ריצות`, base: 3, grow: 1.2 },
];
export const MAX_MULT = 30;

export const STORE_KEY = 'shuk-rush-save-v1';
