// Chords, scales, strumming patterns and the learning path.
// Strings are listed low to high: E A D G B e. Fret -1 = muted, 0 = open.

const TUNING = [40, 45, 50, 55, 59, 64];
const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_HE = { C: "דו", "C#": "דו#", D: "רה", "D#": "רה#", E: "מי", F: "פה", "F#": "פה#", G: "סול", "G#": "סול#", A: "לה", "A#": "לה#", B: "סי" };

const TUNINGS = {
  standard: { name: "רגיל (E A D G B E)", notes: [40, 45, 50, 55, 59, 64] },
  dropD: { name: "Drop D", notes: [38, 45, 50, 55, 59, 64] },
  half: { name: "חצי טון למטה", notes: [39, 44, 49, 54, 58, 63] },
  openG: { name: "Open G", notes: [38, 43, 50, 55, 59, 62] },
};

// frets, fingers (0 = none), optional barre {fret, from, to} (string indexes)
const CHORDS = {
  Em:    { cat: "open", frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Am:    { cat: "open", frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  C:     { cat: "open", frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  G:     { cat: "open", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  D:     { cat: "open", frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  E:     { cat: "open", frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  A:     { cat: "open", frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Dm:    { cat: "open", frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  Fmini: { cat: "open", name: "F (קטן)", frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], barre: { fret: 1, from: 4, to: 5 } },
  E7:    { cat: "seventh", frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  A7:    { cat: "seventh", frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  D7:    { cat: "seventh", frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  G7:    { cat: "seventh", frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  C7:    { cat: "seventh", frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  B7:    { cat: "seventh", frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  Am7:   { cat: "seventh", frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Em7:   { cat: "seventh", frets: [0, 2, 2, 0, 3, 0], fingers: [0, 1, 2, 0, 3, 0] },
  Dm7:   { cat: "seventh", frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], barre: { fret: 1, from: 4, to: 5 } },
  Cmaj7: { cat: "seventh", frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  Fmaj7: { cat: "seventh", frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  Amaj7: { cat: "seventh", frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
  Dmaj7: { cat: "seventh", frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1], barre: { fret: 2, from: 3, to: 5 } },
  F:     { cat: "barre", frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
  Bm:    { cat: "barre", frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, from: 1, to: 5 } },
  "F#m": { cat: "barre", frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 2, from: 0, to: 5 } },
  B:     { cat: "barre", frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 2, from: 1, to: 5 } },
  Bb:    { cat: "barre", frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: { fret: 1, from: 1, to: 5 } },
  Gm:    { cat: "barre", frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 3, from: 0, to: 5 } },
  Cm:    { cat: "barre", frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 3, from: 1, to: 5 } },
  Gbar:  { cat: "barre", name: "G (מוט 3)", frets: [3, 5, 5, 4, 3, 3], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 3, from: 0, to: 5 } },
  Ambar: { cat: "barre", name: "Am (מוט 5)", frets: [5, 7, 7, 5, 5, 5], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 5, from: 0, to: 5 } },
  Cadd9: { cat: "sus", frets: [-1, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4] },
  Dsus2: { cat: "sus", frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  Dsus4: { cat: "sus", frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
  Asus2: { cat: "sus", frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  Asus4: { cat: "sus", frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Esus4: { cat: "sus", frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
  E5:    { cat: "power", frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 1, 0, 0, 0] },
  A5:    { cat: "power", frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 1, 0, 0] },
  G5:    { cat: "power", frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0] },
  C5:    { cat: "power", frets: [-1, 3, 5, 5, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },
  D5:    { cat: "power", frets: [-1, 5, 7, 7, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },
  Gmaj7: { cat: "jazz", name: "Gmaj7 (3)", frets: [3, -1, 4, 4, 3, -1], fingers: [2, 0, 3, 4, 1, 0] },
  Am7j:  { cat: "jazz", name: "Am7 (5)", frets: [5, -1, 5, 5, 5, -1], fingers: [2, 0, 3, 3, 3, 0] },
  Dm7j:  { cat: "jazz", name: "Dm7 (5)", frets: [-1, 5, 7, 5, 6, 5], fingers: [0, 1, 3, 1, 2, 1], barre: { fret: 5, from: 1, to: 5 } },
  G7j:   { cat: "jazz", name: "G7 (3)", frets: [3, -1, 3, 4, 3, -1], fingers: [2, 0, 3, 4, 1, 0] },
  Cmaj7j:{ cat: "jazz", name: "Cmaj7 (3)", frets: [-1, 3, 5, 4, 5, -1], fingers: [0, 1, 3, 2, 4, 0] },
};

const CHORD_CATS = [
  ["open", "בסיסיים"],
  ["seventh", "ספטאקורדים"],
  ["barre", "מוטים (בארה)"],
  ["sus", "Sus / add"],
  ["power", "פאוור"],
  ["jazz", "ג'אז"],
];

function chordName(id) { return (CHORDS[id] && CHORDS[id].name) || id; }

// Scales as semitone steps from the root
const SCALES = {
  minPent: { name: "פנטטונית מינורית", steps: [0, 3, 5, 7, 10], boxes: true },
  majPent: { name: "פנטטונית מז'ורית", steps: [0, 2, 4, 7, 9], boxes: true },
  blues:   { name: "בלוז", steps: [0, 3, 5, 6, 7, 10] },
  major:   { name: "מז'ור (יוני)", steps: [0, 2, 4, 5, 7, 9, 11] },
  minor:   { name: "מינור טבעי (איולי)", steps: [0, 2, 3, 5, 7, 8, 10] },
  dorian:  { name: "דורי", steps: [0, 2, 3, 5, 7, 9, 10] },
  mixo:    { name: "מיקסולידי", steps: [0, 2, 4, 5, 7, 9, 10] },
  harmMin: { name: "מינור הרמוני", steps: [0, 2, 3, 5, 7, 8, 11] },
};

// Strumming: one entry per 8th (or 16th) slot. D = down, U = up, "-" = skip (hand keeps moving)
const STRUMS = {
  quarters: { name: "רבעים למטה", sub: 2, slots: "D-D-D-D-" },
  eighths:  { name: "שמיניות", sub: 2, slots: "DUDUDUDU" },
  folk:     { name: "הקצב האוניברסלי", sub: 2, slots: "D-DU-UDU" },
  pop:      { name: "פופ", sub: 2, slots: "D-D-DUDU" },
  rock:     { name: "רוק", sub: 2, slots: "D-DUDUDU" },
  reggae:   { name: "רגאיי (אופביט)", sub: 2, slots: "-U-U-U-U" },
  funk:     { name: "פאנק (שש-עשריות)", sub: 4, slots: "D-DU-UD-D-DU-UDU" },
};

const PROGRESSIONS = [
  { id: "pop", name: "פופ: G D Em C", chords: ["G", "D", "Em", "C"], scale: ["G", "majPent"] },
  { id: "sad", name: "Am F C G", chords: ["Am", "F", "C", "G"], scale: ["A", "minPent"] },
  { id: "doo", name: "שנות ה-50: C Am F G", chords: ["C", "Am", "Fmaj7", "G"], scale: ["C", "majPent"] },
  { id: "blues", name: "בלוז 12 תיבות ב-A", chords: ["A7", "A7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "E7"], scale: ["A", "blues"] },
  { id: "andal", name: "אנדלוסית: Am G F E", chords: ["Am", "G", "Fmaj7", "E"], scale: ["A", "harmMin"] },
  { id: "dorian", name: "דורי: Am7 D7", chords: ["Am7", "Am7", "D7", "D7"], scale: ["A", "dorian"] },
  { id: "jazz", name: "ג'אז II-V-I: Dm7 G7 Cmaj7", chords: ["Dm7j", "G7j", "Cmaj7j", "Cmaj7j"], scale: ["C", "major"] },
];

// Practice exercise kinds used in the path and the daily session:
//  chords   — play the chords along with the metronome (params: chords, strum, bpm)
//  changes  — one-minute changes between a chord pair, counted by taps
//  strum    — a strumming pattern on one chord (params: strum, chord, bpm)
//  scale    — play a scale/box along with the metronome (params: key, scale, box, bpm)
//  spider   — the chromatic 1-2-3-4 finger exercise (params: bpm)
//  notes    — fretboard note finder game
//  ear      — ear training
//  jam      — play along with a chord progression (params: prog, bpm)
//  free     — free practice with written steps
const PATH = [
  {
    id: 1, name: "צעדים ראשונים", goal: "מחזיקים את הגיטרה, מכוונים, ומנגנים 4 אקורדים ראשונים.",
    units: [
      { id: "1a", title: "כיוון והחזקה", kind: "free", minutes: 3,
        how: ["פותחים את המכוון בלשונית כלים ומכוונים את כל 6 המיתרים.", "יושבים זקוף, הגיטרה על הרגל הימנית, הצוואר מעט למעלה.", "אגודל יד שמאל מאחורי הצוואר, מול האצבע האמצעית.", "לוחצים קרוב לסריג (המתכת), לא באמצע המשבצת. זה מוריד את הזמזום."],
        goal: "כל המיתרים בירוק במכוון", check: "self" },
      { id: "1b", title: "Em ו-Am", kind: "chords", chords: ["Em", "Am"], strum: "quarters", bpm: 60, minutes: 4,
        how: ["מתחילים ב-Em: שתי אצבעות בלבד.", "פורטים כל מיתר לבד ובודקים שכולם נשמעים נקי.", "עוברים ל-Am: האצבעות 2 ו-3 זזות יחד מיתר אחד למטה.", "4 פריטות על כל אקורד, עם המטרונום."],
        goal: "4 פריטות נקיות לכל אקורד ב-60 BPM", check: "self" },
      { id: "1c", title: "החלפות בדקה: Em ↔ Am", kind: "changes", pair: ["Em", "Am"], minutes: 3,
        how: ["דקה אחת, מחליפים הלוך וחזור כמה שיותר מהר.", "כל החלפה = לחיצה אחת על הכפתור הגדול.", "לא חשוב לפרוט יפה, רק להגיע לאקורד מדויק."],
        goal: "30 החלפות בדקה", check: { changes: ["Em", "Am"], min: 30 } },
      { id: "1d", title: "C ו-G", kind: "chords", chords: ["C", "G"], strum: "quarters", bpm: 60, minutes: 4,
        how: ["ב-C שלוש אצבעות בצורת מדרגות. מיתר ה-E הנמוך לא מנגנים.", "ב-G אפשר להתחיל בגרסה עם אצבע אחת (מיתר e בסריג 3) ולהוסיף בהדרגה.", "מסתכלים על הדיאגרמה, לא על היד, ככל שאפשר."],
        goal: "4 פריטות נקיות לכל אקורד ב-60 BPM", check: "self" },
      { id: "1e", title: "החלפות בדקה: C ↔ G", kind: "changes", pair: ["C", "G"], minutes: 3,
        how: ["מחליפים C ↔ G במשך דקה.", "האצבע ה-3 היא העוגן: היא נוחתת ראשונה."],
        goal: "25 החלפות בדקה", check: { changes: ["C", "G"], min: 25 } },
    ],
  },
  {
    id: 2, name: "שיר ראשון", goal: "מוסיפים D, E, A ופריטה בקצב. אחרי הרמה הזו מנגנים מאות שירים.",
    units: [
      { id: "2a", title: "D, E ו-A", kind: "chords", chords: ["D", "A", "E"], strum: "quarters", bpm: 70, minutes: 4,
        how: ["ב-D מנגנים רק 4 מיתרים (מ-D למטה).", "ב-A שלוש אצבעות צפופות בסריג 2. אפשר לסדר 2-1-3 אם נוח יותר.", "E נראה כמו Am, רק מיתר אחד למעלה."],
        goal: "4 פריטות נקיות לכל אקורד ב-70 BPM", check: "self" },
      { id: "2b", title: "החלפות בדקה: D ↔ A", kind: "changes", pair: ["D", "A"], minutes: 3,
        how: ["מחליפים D ↔ A במשך דקה.", "שימו לב לאצבע שלא זזה הרבה, היא מובילה."],
        goal: "35 החלפות בדקה", check: { changes: ["D", "A"], min: 35 } },
      { id: "2c", title: "שמיניות: למטה-למעלה", kind: "strum", strum: "eighths", chord: "G", bpm: 70, minutes: 4,
        how: ["היד הימנית זזה כמו מטוטלת: למטה על המספר, למעלה על ה'ו'.", "1 ו 2 ו 3 ו 4 ו. סופרים בקול.", "פריטה למעלה פוגעת רק ב-3-4 המיתרים הגבוהים, וזה בסדר."],
        goal: "דקה רצופה בלי לעצור ב-70 BPM", check: "self" },
      { id: "2d", title: "הקצב האוניברסלי", kind: "strum", strum: "folk", chord: "C", bpm: 70, minutes: 5,
        how: ["למטה, למטה-למעלה, למעלה-למטה-למעלה.", "היד לא עוצרת לעולם. ברווחים פשוט מחטיאים את המיתרים.", "התחילו לאט מאוד. הקצב הזה לבד מספיק לרוב שירי הפופ."],
        goal: "דקה רצופה ב-80 BPM", check: "self" },
      { id: "2e", title: "שיר: G D Em C", kind: "jam", prog: "pop", bpm: 70, minutes: 5,
        how: ["ארבעת האקורדים של אלפי להיטים.", "פורטים פעם אחת על כל אקורד, ואז 4 רבעים, ואז הקצב האוניברסלי.", "אם החלפה נתקעת, שומרים על היד הימנית בתנועה ופורטים מיתרים פתוחים במעבר."],
        goal: "סיבוב שלם 4 פעמים בלי לעצור", check: "self" },
    ],
  },
  {
    id: 3, name: "יד שמאל חזקה", goal: "אצבעות עצמאיות, אקורדים של 7 ו-F קטן. מכינים את הקרקע למוטים.",
    units: [
      { id: "3a", title: "עכביש כרומטי 1-2-3-4", kind: "spider", bpm: 60, minutes: 4,
        how: ["סריגים 1-2-3-4 על כל מיתר, אצבע לכל סריג, מ-E הנמוך עד e ובחזרה.", "פריטה מתחלפת: למטה-למעלה-למטה-למעלה.", "שומרים אצבעות קרוב למיתרים. ההרמה הקטנה ביותר = מהירות בעתיד.", "אחרי כל אימון, המטרונום שלכם יעלה אוטומטית."],
        goal: "תו לכל פעמה, נקי, ב-80 BPM", check: { bpm: "spider", min: 80 } },
      { id: "3b", title: "ספטאקורדים: E7 A7 D7", kind: "chords", chords: ["E7", "A7", "D7", "B7"], strum: "folk", bpm: 70, minutes: 4,
        how: ["אקורדי 7 נותנים צליל בלוז/קאנטרי.", "B7 משתמש בכל 4 האצבעות. קחו זמן.", "נסו רצף: E7 A7 B7 E7."],
        goal: "רצף E7 A7 B7 E7 ב-70 BPM", check: "self" },
      { id: "3c", title: "F קטן", kind: "chords", chords: ["Fmini", "C"], strum: "quarters", bpm: 60, minutes: 4,
        how: ["אצבע 1 שוכבת על שני המיתרים הגבוהים בסריג 1 (מוט קטן).", "מגלגלים את האצבע מעט לצד, הצד הקשה שלה לוחץ טוב יותר.", "C ↔ F הוא אחד המעברים הנפוצים בשירים."],
        goal: "C ↔ F ב-60 BPM נקי", check: "self" },
      { id: "3d", title: "החלפות בדקה: G ↔ Em", kind: "changes", pair: ["G", "Em"], minutes: 3,
        how: ["מחליפים G ↔ Em במשך דקה.", "מטרה: מעברים בלי לחשוב, כדי שהקשב יעבור למוזיקה."],
        goal: "40 החלפות בדקה", check: { changes: ["G", "Em"], min: 40 } },
      { id: "3e", title: "Am F C G", kind: "jam", prog: "sad", bpm: 75, minutes: 5,
        how: ["מתחילים עם F הקטן במקום F המלא.", "שני רבעים על כל אקורד, ואז כל תיבה שלמה.", "תנסו לשיר מעל. זה עוזר לתזמון."],
        goal: "סיבוב שלם 4 פעמים בלי לעצור", check: "self" },
    ],
  },
  {
    id: 4, name: "מוטים וסולו ראשון", goal: "F המלא, Bm, פאוור קורדים והפנטטונית הראשונה. מכאן כל השירים פתוחים.",
    units: [
      { id: "4a", title: "פאוור קורדים", kind: "chords", chords: ["E5", "G5", "A5", "C5"], strum: "eighths", bpm: 80, minutes: 4,
        how: ["2-3 מיתרים בלבד: שורש וקווינטה.", "צורה אחת שזזה לכל מקום על הצוואר.", "יד ימין משתיקה קלות את המיתרים ליד הגשר (palm mute) לסאונד רוק."],
        goal: "E5 G5 A5 C5 בשמיניות ב-90 BPM", check: "self" },
      { id: "4b", title: "F המלא (מוט)", kind: "chords", chords: ["F", "C"], strum: "quarters", bpm: 60, minutes: 5,
        how: ["אצבע 1 לאורך כל הסריג הראשון, קרוב מאוד למתכת.", "המרפק קרוב לגוף, האגודל נמוך מאחורי הצוואר.", "לא לוחצים חזק יותר, מושכים את היד אחורה בעזרת משקל הזרוע.", "בודקים כל מיתר לבד. זה לוקח שבועות ולגמרי נורמלי."],
        goal: "כל 6 המיתרים נשמעים ב-F", check: "self" },
      { id: "4c", title: "Bm ו-F#m", kind: "chords", chords: ["Bm", "F#m", "D", "A"], strum: "folk", bpm: 65, minutes: 4,
        how: ["Bm: מוט בסריג 2 מהמיתר A, הצורה של Am מעליו.", "F#m: צורת Em במוט בסריג 2.", "רצף נפוץ: D A Bm F#m."],
        goal: "D A Bm F#m ב-70 BPM", check: "self" },
      { id: "4d", title: "פנטטונית מינורית, תיבה 1", kind: "scale", root: "A", scale: "minPent", box: 0, bpm: 70, minutes: 5,
        how: ["סריג 5 עד 8, שני תווים על כל מיתר.", "אצבע 1 בסריג 5, אצבע 3 או 4 בסריג 7-8.", "עולים ויורדים עם פריטה מתחלפת.", "זה הסולם של רוב הסולואים ברוק, בלוז ופופ."],
        goal: "תו לכל פעמה ב-90 BPM", check: { bpm: "scale:minPent", min: 90 } },
      { id: "4e", title: "סולו ראשון על בלוז", kind: "jam", prog: "blues", bpm: 80, minutes: 6,
        how: ["האפליקציה מנגנת בלוז ב-A, אתם מאלתרים בתיבה 1.", "מתחילים בשלושה תווים בלבד. משפטים קצרים, ואז שקט.", "נוחתים על התו A (סריג 5 על E, סריג 7 על D) כשהאקורד חוזר ל-A7."],
        goal: "3 סיבובים של 12 תיבות בלי לעצור", check: "self" },
    ],
  },
  {
    id: 5, name: "שליטה בצוואר", goal: "יודעים איפה כל תו, מזהים מרווחים באוזן, טכניקות סולו.",
    units: [
      { id: "5a", title: "תווים על מיתרי E ו-A", kind: "notes", strings: [0, 1], minutes: 4,
        how: ["התווים הטבעיים: A B C D E F G. בין B-C ובין E-F חצי טון, בשאר טון שלם.", "זה המפתח למוטים: השורש של F על E, של Bm על A.", "משחק: האפליקציה אומרת תו, אתם מוצאים או מנגנים אותו."],
        goal: "20 תשובות נכונות בדקה", check: { notes: 20 } },
      { id: "5b", title: "האמר-און, פול-אוף וסלייד", kind: "free", minutes: 5,
        how: ["האמר-און: פורטים סריג 5, ו'מכים' עם אצבע 3 על סריג 7 בלי לפרוט שוב.", "פול-אוף: ההפך. מושכים את האצבע קלות הצידה כדי לפרוט את המיתר.", "סלייד: מחליקים מסריג 5 ל-7 בלחיצה רצופה.", "מתרגלים בתוך תיבה 1 של הפנטטונית."],
        goal: "כל תו נשמע באותה עוצמה כמו תו פרוט", check: "self" },
      { id: "5c", title: "בנדים וויברטו", kind: "free", minutes: 5,
        how: ["בנד: מיתר G סריג 7, שלוש אצבעות יחד דוחפות את המיתר למעלה.", "מטרה: להגיע לגובה של סריג 9. בודקים עם המכוון!", "ויברטו: בנד קטן מהיר הלוך-חזור, מסובבים מפרק כף היד.", "בנד מדויק = ההבדל בין חובבן לגיטריסט."],
        goal: "בנד של טון שלם, מדויק במכוון", check: "self" },
      { id: "5d", title: "אוזן: מרווחים", kind: "ear", minutes: 4,
        how: ["שומעים שני תווים ומזהים את המרווח.", "זוכרים לפי שירים: טרצה גדולה = When the Saints, קוורטה = Here Comes the Bride, קווינטה = Twinkle Twinkle, אוקטבה = Somewhere Over the Rainbow (הקפיצה הראשונה בכל שיר).", "אוזן טובה = מנגנים מה ששומעים בראש."],
        goal: "15 נכונות ברצף", check: { ear: 15 } },
      { id: "5e", title: "כל 5 התיבות", kind: "scale", root: "A", scale: "minPent", box: 1, bpm: 70, minutes: 5,
        how: ["כל תיבה מתחברת לבאה. תיבה 2 מתחילה איפה שתיבה 1 נגמרת.", "בכל יום תיבה אחרת, ואז שתיים ברצף.", "בסוף רואים את כל הצוואר כתבנית אחת."],
        goal: "כל 5 התיבות ב-80 BPM", check: "self" },
    ],
  },
  {
    id: 6, name: "הרמוניה וקצב מתקדם", goal: "מוטים בכל מקום, שש-עשריות, מצבים (מודוסים) ומשפטים מוזיקליים.",
    units: [
      { id: "6a", title: "מוטים על כל הצוואר", kind: "chords", chords: ["Gbar", "Ambar", "Cm", "Gm"], strum: "folk", bpm: 70, minutes: 5,
        how: ["צורת E (שורש על E) וצורת A (שורש על A) הן כל מה שצריך.", "בעזרת תווי הצוואר שלמדתם, כל אקורד מז'ור/מינור נמצא בשתי דרכים.", "אתגר: נגנו G Em C D רק במוטים."],
        goal: "G Em C D במוטים ב-70 BPM", check: "self" },
      { id: "6b", title: "פאנק: שש-עשריות", kind: "strum", strum: "funk", chord: "Am7", bpm: 70, minutes: 5,
        how: ["היד זזה בשש-עשריות כל הזמן: 1 e ו a.", "משתיקים בין המכות בעזרת שחרור לחץ ביד שמאל.", "מתחילים ב-60 BPM ועולים 5 בכל פעם."],
        goal: "דקה ב-90 BPM, יד ימין לא נעצרת", check: "self" },
      { id: "6c", title: "סולם מז'ור בכל הצוואר", kind: "scale", root: "G", scale: "major", bpm: 70, minutes: 5,
        how: ["דו-רה-מי. הסולם שממנו בנויה כל ההרמוניה.", "מנגנים ב-3 תווים לכל מיתר. זה מכין לנגינה מהירה.", "בטלפון רואים את כל התווים. נגנו אוקטבה בכמה מקומות שונים."],
        goal: "2 אוקטבות ב-90 BPM", check: { bpm: "scale:major", min: 90 } },
      { id: "6d", title: "דורי ומיקסולידי", kind: "jam", prog: "dorian", bpm: 85, minutes: 6,
        how: ["דורי = מינור עם סקסטה גדולה. הצליל של סנטנה ופינק פלויד.", "מאלתרים מעל Am7 D7, ומדגישים את התו F# (סריג 7 על B).", "מיקסולידי = מז'ור עם ספטימה קטנה, צליל רוק קלאסי."],
        goal: "3 דקות אלתור שנשמע מוזיקלי", check: "self" },
      { id: "6e", title: "אוזן: אקורדים", kind: "ear", mode: "chords", minutes: 4,
        how: ["שומעים אקורד ומזהים: מז'ור, מינור, 7, maj7.", "מז'ור שמח, מינור עצוב, 7 מתוח ('רוצה לזוז'), maj7 חלומי."],
        goal: "15 נכונות ברצף", check: { ear: 15 } },
    ],
  },
  {
    id: 7, name: "מהירות ודיוק", goal: "בונים מהירות בשיטה, בלי פציעות ובלי ללכלך.",
    units: [
      { id: "7a", title: "מאמן מהירות: עכביש", kind: "spider", bpm: 90, minutes: 5, sub: 2,
        how: ["עכשיו שני תווים לכל פעמה (שמיניות).", "החוק: עולים 5 BPM רק אחרי 3 חזרות נקיות לגמרי.", "מתח בכתף או באגודל = לעצור, לנער ידיים, להוריד מהירות."],
        goal: "שמיניות נקיות ב-110 BPM", check: { bpm: "spider", min: 110 } },
      { id: "7b", title: "פנטטונית בשלישיות", kind: "scale", root: "A", scale: "minPent", box: 0, bpm: 80, minutes: 5, sub: 3,
        how: ["שלושה תווים לכל פעמה.", "רצף: 1-2-3, 2-3-4, 3-4-5... עולים ויורדים בתיבה.", "הדגשה קלה על התו הראשון של כל שלישייה."],
        goal: "שלישיות ב-100 BPM", check: { bpm: "scale:minPent", min: 100 } },
      { id: "7c", title: "תווים בכל הצוואר", kind: "notes", strings: [0, 1, 2, 3, 4, 5], minutes: 4,
        how: ["כל 6 המיתרים, עד סריג 12.", "טיפ: מיתר e זהה ל-E, ו-B קל להסיק מ-E (סריג 5 = E)."],
        goal: "25 תשובות נכונות בדקה", check: { notes: 25 } },
      { id: "7d", title: "לגאטו ומיתר אחד", kind: "free", minutes: 5,
        how: ["על מיתר אחד: פריטה אחת, ואז שני תווים באמר/פול. 5-7-8, 8-7-5.", "מזיזים את התבנית לאורך מיתר G בתווי הסולם.", "מטרה: עוצמה אחידה. מקליטים את עצמכם ומקשיבים."],
        goal: "16 תווים רצופים באחידות", check: "self" },
      { id: "7e", title: "מאמן מהירות: 16-יות", kind: "spider", bpm: 70, minutes: 5, sub: 4,
        how: ["ארבעה תווים לכל פעמה.", "70 BPM בשש-עשריות = 140 בשמיניות. עובדים לאט ועולים בהדרגה.", "השאיפה לטווח ארוך: 120 BPM בשש-עשריות."],
        goal: "שש-עשריות נקיות ב-100 BPM", check: { bpm: "spider", min: 100 } },
    ],
  },
  {
    id: 8, name: "רמה גבוהה", goal: "ג'אז, ארפג'יו, אלתור על חילופי אקורדים, והקול האישי שלכם.",
    units: [
      { id: "8a", title: "אקורדי ג'אז", kind: "chords", chords: ["Dm7j", "G7j", "Cmaj7j", "Gmaj7"], strum: "quarters", bpm: 80, minutes: 5,
        how: ["אקורדי 'shell': שורש, טרצה וספטימה.", "II-V-I: הרצף החשוב בג'אז.", "פורטים רבעים קצרים, בסגנון ג'אז 'Freddie Green'."],
        goal: "II-V-I נקי ב-100 BPM", check: "self" },
      { id: "8b", title: "אלתור על II-V-I", kind: "jam", prog: "jazz", bpm: 90, minutes: 6,
        how: ["נוחתים על תו מהאקורד (טרצה או ספטימה) בכל החלפה.", "טרצה של Dm7 = F, של G7 = B, של Cmaj7 = E.", "זה ההבדל בין 'לנגן סולם' לבין 'לנגן את השינויים'."],
        goal: "מוצאים את הטרצה של כל אקורד בזמן", check: "self" },
      { id: "8c", title: "פנטטונית בכל התיבות", kind: "scale", root: "A", scale: "minPent", box: 2, bpm: 100, minutes: 5, sub: 2,
        how: ["תיבות 3-5 בשמיניות.", "מתחברים בין תיבות באמצעות סלייד.", "נגנו משפט אחד בשלוש תיבות שונות."],
        goal: "שמיניות ב-120 BPM", check: { bpm: "scale:minPent", min: 120 } },
      { id: "8d", title: "אנדלוסית ומינור הרמוני", kind: "jam", prog: "andal", bpm: 90, minutes: 6,
        how: ["Am G F E: הרצף הספרדי/מזרחי.", "מעל E מנגנים את התו G# (מינור הרמוני) לצליל מזרחי.", "שלבו בנדים וויברטו מהרמה 5."],
        goal: "3 דקות אלתור עם G# על E", check: "self" },
      { id: "8e", title: "הקול שלכם", kind: "free", minutes: 8,
        how: ["בחרו סולו שאתם אוהבים ולמדו 4 תיבות ממנו מהאוזן, בלי טאבים.", "הקליטו את עצמכם פעם בשבוע ושמרו את ההקלטות.", "משפט טוב = שאלה ותשובה. נגנו משפט, ואז 'ענו' עליו.", "המשיכו להשתמש באימון היומי: הוא ממשיך להעלות את המהירות שלכם."],
        goal: "סולו של 4 תיבות שלמדתם מהאוזן", check: "self" },
    ],
  },
];
