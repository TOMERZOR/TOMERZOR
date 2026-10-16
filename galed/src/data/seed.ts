import type { Level } from "./trails";

export type Gender = "f" | "m" | "x";

export interface Person {
  id: string;
  name: string;
  g: Gender;
  age: number;
  city: string;
  pace: number; // km/h on flat ground
  level: Level;
  hikes: number;
  showUp: number; // % of planned hikes they actually came to
  langs: string[];
  car: boolean;
  bio: string;
  ink: "ultra" | "flame" | "moss" | "brick";
  verified: boolean;
  references: { from: string; text: string; trail: string }[];
}

export interface Post {
  id: string;
  authorId: string;
  trailId: string;
  dayOffset: number; // days from today
  days: number; // length of the window in days (1 = single day)
  flexible: boolean;
  start: string;
  direction?: string;
  spots: number;
  joined: string[];
  pace: number;
  level: Level;
  car: "has-car" | "needs-ride" | "shuttle";
  tags: string[];
  note: string;
  meet: string;
  createdHoursAgo: number;
}

export interface Message {
  id: string;
  from: string; // person id or "me"
  text: string;
  at: number; // ms timestamp
  kind?: "text" | "plan" | "system";
}

export interface Thread {
  id: string;
  withId: string;
  postId: string;
  messages: Message[];
  unread: number;
  plan: {
    meet: string;
    time: string;
    cars: string;
    gear: { label: string; who: string; done: boolean }[];
    shareWithEmergency: boolean;
  };
}

export const people: Person[] = [
  {
    id: "noa",
    name: "נועה ברק",
    g: "f",
    age: 29,
    city: "באר שבע",
    pace: 4.5,
    level: "קשה",
    hikes: 41,
    showUp: 98,
    langs: ["עברית", "English"],
    car: true,
    bio: "הולכת את שביל ישראל בקטעים, מדרום לצפון. אוהבת לצאת לפני הזריחה ולסיים לפני החום.",
    ink: "flame",
    verified: true,
    references: [
      { from: "איתי", text: "קצב יציב, מגיעה מוכנה עם מים לשניים. הייתי הולך איתה שוב מחר.", trail: "הר כרכום" },
      { from: "שירה", text: "דאגה לשאטל לרכב בסוף המסלול. ארגון ברמה אחרת.", trail: "נחל צין" },
    ],
  },
  {
    id: "itai",
    name: "איתי לוי",
    g: "m",
    age: 34,
    city: "חיפה",
    pace: 4,
    level: "בינוני",
    hikes: 27,
    showUp: 95,
    langs: ["עברית", "English", "Español"],
    car: false,
    bio: "מטייל עם מצלמה, עוצר הרבה. מחפש חבר׳ה לגליל ולגולן בסופי שבוע.",
    ink: "ultra",
    verified: true,
    references: [{ from: "נועה", text: "צילם לנו את כל המסלול ושלח באותו ערב. אדם רגוע.", trail: "הר כרכום" }],
  },
  {
    id: "maya",
    name: "מאיה כהן",
    g: "f",
    age: 26,
    city: "תל אביב",
    pace: 5,
    level: "מאתגר",
    hikes: 63,
    showUp: 100,
    langs: ["עברית", "English", "Deutsch"],
    car: true,
    bio: "טרייל ראנרית לשעבר. יוצאת ל-TMB באוגוסט ומחפשת שניים לחלוק בקתות.",
    ink: "moss",
    verified: true,
    references: [{ from: "רועי", text: "מהירה, אבל מחכה בצמתים. ידעה כל מעבר בדרך.", trail: "Alta Via 1" }],
  },
  {
    id: "yoni",
    name: "יונתן אזולאי",
    g: "m",
    age: 41,
    city: "ירושלים",
    pace: 3.5,
    level: "בינוני",
    hikes: 18,
    showUp: 92,
    langs: ["עברית", "Français"],
    car: true,
    bio: "אבא לשניים, יוצא פעם בחודש ליום שלם. מעדיף קצב נינוח ועצירה לקפה על גזייה.",
    ink: "brick",
    verified: false,
    references: [],
  },
  {
    id: "shira",
    name: "שירה מזרחי",
    g: "f",
    age: 31,
    city: "מצפה רמון",
    pace: 4.2,
    level: "קשה",
    hikes: 55,
    showUp: 97,
    langs: ["עברית", "English"],
    car: true,
    bio: "מדריכת טיולים בנגב. מכירה כל נקודת מים בין ערד לאילת. כלב בשם ג׳ינג׳י מצטרף.",
    ink: "flame",
    verified: true,
    references: [{ from: "מאיה", text: "ידעה בדיוק איפה יש צל בכל שעה. עדיף ממפה.", trail: "מכתש רמון" }],
  },
  {
    id: "omer",
    name: "עומר שגיא",
    g: "m",
    age: 23,
    city: "רחובות",
    pace: 5.2,
    level: "קשה",
    hikes: 12,
    showUp: 90,
    langs: ["עברית", "English"],
    car: false,
    bio: "אחרי צבא, לפני טיול גדול. טס לצ׳ילה בנובמבר, מחפש שותפים ל-W ול-O.",
    ink: "ultra",
    verified: false,
    references: [],
  },
];

export const personById = (id: string) => people.find((p) => p.id === id);

export const posts: Post[] = [
  {
    id: "p1",
    authorId: "noa",
    trailId: "ramon",
    dayOffset: 1,
    days: 1,
    flexible: false,
    start: "05:30",
    direction: "דרומה",
    spots: 2,
    joined: ["shira"],
    pace: 4.5,
    level: "קשה",
    car: "shuttle",
    tags: ["יציאה לפני זריחה", "שאטל רכבים", "4 ליטר מים"],
    note: "מסלול קווי. אני משאירה רכב בעין סהרונים בערב שלפני, ונוסעים יחד להתחלה. מחפשת מישהו שנוח לו עם ירידה תלולה.",
    meet: "מרכז המבקרים, מצפה רמון",
    createdHoursAgo: 3,
  },
  {
    id: "p2",
    authorId: "itai",
    trailId: "amud",
    dayOffset: 2,
    days: 1,
    flexible: true,
    start: "07:00",
    direction: "דרומה",
    spots: 3,
    joined: [],
    pace: 4,
    level: "בינוני",
    car: "needs-ride",
    tags: ["צילום", "מים בדרך", "מתאים לכלבים"],
    note: "אין לי רכב השבת. מי שבא מחיפה או מהקריות, אשמח לטרמפ ואשתתף בדלק.",
    meet: "חניון עין כמונים",
    createdHoursAgo: 7,
  },
  {
    id: "p3",
    authorId: "maya",
    trailId: "tmb",
    dayOffset: 290,
    days: 11,
    flexible: true,
    start: "08:00",
    direction: "נגד כיוון השעון",
    spots: 2,
    joined: [],
    pace: 5,
    level: "מאתגר",
    car: "has-car",
    tags: ["לינה בבקתות", "11 ימים", "תקציב בינוני"],
    note: "סגרתי חצי מהבקתות. מחפשת שניים בכושר טוב שיחלקו חדרים ועלויות. אפשר להצטרף לחלק מהימים.",
    meet: "שאמוני, Place du Triangle de l'Amitié",
    createdHoursAgo: 26,
  },
  {
    id: "p4",
    authorId: "yoni",
    trailId: "arbel",
    dayOffset: 8,
    days: 1,
    flexible: false,
    start: "06:15",
    spots: 3,
    joined: ["itai"],
    pace: 3.5,
    level: "קשה",
    car: "has-car",
    tags: ["קצב נינוח", "קפה בפסגה", "יוצא מירושלים"],
    note: "יוצא מירושלים ב-4:00, יש מקום לשלושה ברכב. עולים עם הזריחה מכפר חמאם.",
    meet: "חניון הר ארבל",
    createdHoursAgo: 30,
  },
  {
    id: "p5",
    authorId: "omer",
    trailId: "patagonia",
    dayOffset: 34,
    days: 5,
    flexible: true,
    start: "07:30",
    direction: "מערב ← מזרח",
    spots: 3,
    joined: [],
    pace: 5.2,
    level: "קשה",
    car: "needs-ride",
    tags: ["קמפינג", "חלוקת אוהל", "ספרדית בסיסית"],
    note: "יש לי אוהל לשניים וגזייה. מחפש שותף או שותפה לחלוק ציוד ומשקל.",
    meet: "Puerto Natales",
    createdHoursAgo: 50,
  },
  {
    id: "p6",
    authorId: "shira",
    trailId: "eilat",
    dayOffset: 15,
    days: 1,
    flexible: false,
    start: "06:00",
    direction: "מזרחה",
    spots: 4,
    joined: ["noa", "maya"],
    pace: 4.2,
    level: "מאתגר",
    car: "shuttle",
    tags: ["מודרך", "כלב מצטרף", "סיום בים"],
    note: "קטע אחרון של שביל ישראל. מי שמסיים איתי את השביל, יש בירה בחוף.",
    meet: "תצפית הר צפחות",
    createdHoursAgo: 72,
  },
  {
    id: "p7",
    authorId: "itai",
    trailId: "golan",
    dayOffset: 9,
    days: 2,
    flexible: true,
    start: "07:00",
    direction: "דרומה",
    spots: 2,
    joined: [],
    pace: 4,
    level: "בינוני",
    car: "needs-ride",
    tags: ["לינת שטח", "יומיים"],
    note: "רוצה לעשות קטעים 3-4 עם לינה ליד ברכת רם.",
    meet: "מג׳דל שמס, כניסה לשביל",
    createdHoursAgo: 90,
  },
  {
    id: "p8",
    authorId: "maya",
    trailId: "dolomites",
    dayOffset: 270,
    days: 1,
    flexible: true,
    start: "06:30",
    spots: 2,
    joined: [],
    pace: 5,
    level: "בינוני",
    car: "has-car",
    tags: ["זריחה", "יום אחד"],
    note: "חימום ל-TMB. רכב שכור מקורטינה.",
    meet: "Rifugio Auronzo",
    createdHoursAgo: 120,
  },
];

const t0 = Date.now();
const min = 60_000;

export const threads: Thread[] = [
  {
    id: "t-noa",
    withId: "noa",
    postId: "p1",
    unread: 2,
    messages: [
      { id: "m1", from: "me", text: "היי נועה, ראיתי את מכתש רמון מחר. עוד יש מקום?", at: t0 - 95 * min },
      { id: "m2", from: "noa", text: "יש! שירה כבר איתי. איך את/ה עם ירידה תלולה?", at: t0 - 80 * min },
      { id: "m3", from: "me", text: "בסדר גמור, עשיתי את מעלה נקרות בשנה שעברה.", at: t0 - 74 * min },
      { id: "m4", from: "noa", text: "מעולה. אני מקפיצה רכב לעין סהרונים בערב. נפגשים 5:15 במרכז המבקרים?", at: t0 - 12 * min },
      { id: "m5", from: "noa", text: "וקח/י 4 ליטר, אין מים עד הסוף.", at: t0 - 11 * min },
    ],
    plan: {
      meet: "מרכז המבקרים, מצפה רמון",
      time: "מחר · 05:15",
      cars: "רכב של נועה מחכה בסוף המסלול",
      gear: [
        { label: "גזייה וקפה", who: "נועה", done: true },
        { label: "ערכת עזרה ראשונה", who: "שירה", done: true },
        { label: "מפת סימון 1:50,000", who: "אני", done: false },
        { label: "פנס ראש לכל אחד", who: "כולם", done: false },
      ],
      shareWithEmergency: true,
    },
  },
  {
    id: "t-maya",
    withId: "maya",
    postId: "p3",
    unread: 0,
    messages: [
      { id: "m1", from: "maya", text: "ראיתי שהתעניינת ב-TMB. עשית פעם מסלול רב-יומי?", at: t0 - 26 * 60 * min },
      { id: "m2", from: "me", text: "את ה-GR20 לפני שנתיים. אני מתלבט/ת אם לעשות את כל 11 הימים.", at: t0 - 25 * 60 * min },
      { id: "m3", from: "maya", text: "אפשר להצטרף מקורמאייר, זה בערך באמצע. אשלח לך את רשימת הבקתות.", at: t0 - 24 * 60 * min },
    ],
    plan: {
      meet: "שאמוני",
      time: "אוגוסט · טרם נקבע",
      cars: "רכבת מז׳נבה",
      gear: [
        { label: "הזמנת בקתות", who: "מאיה", done: true },
        { label: "ביטוח חילוץ בהרים", who: "כולם", done: false },
      ],
      shareWithEmergency: false,
    },
  },
];
