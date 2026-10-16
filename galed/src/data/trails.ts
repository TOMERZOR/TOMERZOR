// Trail catalog. Distances and climbs are approximate and only for the prototype.

export type BlazeColor = "red" | "blue" | "green" | "black" | "int";
export type Level = "קל" | "בינוני" | "קשה" | "מאתגר";
export type Region = "il" | "abroad";

export interface Trail {
  id: string;
  name: string;
  segment: string;
  area: string;
  country: string;
  region: Region;
  km: number;
  ascent: number;
  hours: string;
  days?: number;
  level: Level;
  blaze: BlazeColor;
  linear: boolean;
  cover: string;
  coords: string;
  profile: number[];
  intSection?: number;
}

const media = (name: string) => `${import.meta.env.BASE_URL}media/${name}.webp`;

export const trails: Trail[] = [
  {
    id: "ramon",
    name: "מכתש רמון",
    segment: "שביל ישראל · מצפה רמון ← עין סהרונים",
    area: "נגב",
    country: "ישראל",
    region: "il",
    km: 19.5,
    ascent: 380,
    hours: "7-8",
    level: "קשה",
    blaze: "int",
    linear: true,
    cover: media("ramon"),
    coords: "30.61°N 34.80°E",
    profile: [870, 860, 740, 610, 520, 505, 498, 520, 560, 540, 510, 470, 455, 480],
    intSection: 7,
  },
  {
    id: "amud",
    name: "נחל עמוד",
    segment: "עין כמונים ← טחנות הקמח",
    area: "גליל עליון",
    country: "ישראל",
    region: "il",
    km: 11.2,
    ascent: 210,
    hours: "4-5",
    level: "בינוני",
    blaze: "int",
    linear: true,
    cover: media("amud"),
    coords: "32.93°N 35.49°E",
    profile: [520, 470, 400, 330, 260, 210, 160, 120, 90, 60, 40, 30, 80, 110],
    intSection: 2,
  },
  {
    id: "arbel",
    name: "מצוק ארבל",
    segment: "חניון ארבל ← כפר חמאם ← חזרה",
    area: "כנרת",
    country: "ישראל",
    region: "il",
    km: 7.5,
    ascent: 420,
    hours: "3-4",
    level: "קשה",
    blaze: "black",
    linear: false,
    cover: media("arbel"),
    coords: "32.82°N 35.50°E",
    profile: [180, 120, 20, -90, -160, -200, -150, -60, 40, 120, 170, 180],
  },
  {
    id: "golan",
    name: "שביל הגולן",
    segment: "קטע 3 · מג׳דל שמס ← קשת",
    area: "רמת הגולן",
    country: "ישראל",
    region: "il",
    km: 16.4,
    ascent: 290,
    hours: "6",
    level: "בינוני",
    blaze: "green",
    linear: true,
    cover: media("golan"),
    coords: "33.17°N 35.77°E",
    profile: [1100, 1060, 1010, 990, 1020, 980, 930, 950, 900, 880, 910, 860],
  },
  {
    id: "eilat",
    name: "הרי אילת",
    segment: "הר שלמה ← נחל גשרון",
    area: "אילת",
    country: "ישראל",
    region: "il",
    km: 10.8,
    ascent: 610,
    hours: "5-6",
    level: "מאתגר",
    blaze: "red",
    linear: true,
    cover: media("eilat"),
    coords: "29.56°N 34.94°E",
    profile: [90, 230, 410, 560, 700, 660, 520, 470, 380, 260, 170, 120],
    intSection: 7,
  },
  {
    id: "eingedi",
    name: "עין גדי",
    segment: "נחל דוד ← מעיין עין גדי",
    area: "ים המלח",
    country: "ישראל",
    region: "il",
    km: 5.2,
    ascent: 260,
    hours: "3",
    level: "קל",
    blaze: "blue",
    linear: false,
    cover: media("eingedi"),
    coords: "31.46°N 35.39°E",
    profile: [-330, -300, -250, -190, -140, -110, -150, -220, -290, -330],
  },
  {
    id: "dolomites",
    name: "Tre Cime",
    segment: "סובב טרה צ׳ימה די לברדו",
    area: "דולומיטים",
    country: "איטליה",
    region: "abroad",
    km: 10.2,
    ascent: 420,
    hours: "4",
    level: "בינוני",
    blaze: "red",
    linear: false,
    cover: media("dolomites"),
    coords: "46.62°N 12.30°E",
    profile: [2320, 2350, 2400, 2454, 2410, 2380, 2400, 2420, 2380, 2320],
  },
  {
    id: "tmb",
    name: "Tour du Mont Blanc",
    segment: "11 ימים · שאמוני ← שאמוני",
    area: "האלפים",
    country: "צרפת · איטליה · שוויץ",
    region: "abroad",
    km: 170,
    ascent: 10000,
    hours: "6-8 ביום",
    days: 11,
    level: "מאתגר",
    blaze: "red",
    linear: false,
    cover: media("montblanc"),
    coords: "45.83°N 6.86°E",
    profile: [1035, 1800, 2480, 1700, 2600, 1950, 2530, 1600, 2400, 1350, 2100, 1035],
  },
  {
    id: "patagonia",
    name: "W Trek",
    segment: "5 ימים · טורס דל פאיינה",
    area: "פטגוניה",
    country: "צ׳ילה",
    region: "abroad",
    km: 80,
    ascent: 3100,
    hours: "6-9 ביום",
    days: 5,
    level: "קשה",
    blaze: "blue",
    linear: true,
    cover: media("patagonia"),
    coords: "50.94°S 72.97°W",
    profile: [120, 450, 870, 300, 80, 420, 1000, 380, 90, 600, 120],
  },
];

export const trailById = (id: string) => trails.find((t) => t.id === id)!;

// The Israel National Trail, north to south, as coarse sections for the segment strip.
export const intSections = [
  { n: 1, name: "דן ← מירון", km: 120 },
  { n: 2, name: "מירון ← כנרת", km: 95 },
  { n: 3, name: "כנרת ← כרמל", km: 140 },
  { n: 4, name: "כרמל ← הרי ירושלים", km: 230 },
  { n: 5, name: "הרי ירושלים ← ערד", km: 165 },
  { n: 6, name: "ערד ← מצפה רמון", km: 150 },
  { n: 7, name: "מצפה רמון ← אילת", km: 200 },
];
