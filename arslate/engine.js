/* ערסלייט: מנוע התרגום (ARS-4). עובד כולו בדפדפן, בלי שרת.
   1. מחלק לשורות ולמשפטים, ובכל משפט מחליף את הביטוי הארוך ביותר שנמצא במילון (עד 6 מילים).
      מילים עם ו/ש בהתחלה נתפסות תמיד, ושמות עצם ותארים גם עם ה/ב/ל/מ/כ.
   2. "מתבל" כל משפט: פתיח (וואלה, שומע...) וסיומת (אחי, על אמא שלי...) לפי סוג המשפט.
   3. אם פונים לאישה (את, תגידי, בואי...), הפניות והציוויים עוברים ללשון נקבה.
   אותו טקסט תמיד נותן אותו תרגום; variant אחר נותן נוסח אחר. */
(function () {
  "use strict";

  const MAX_PHRASE = 6;
  function weighted(map) { return Object.entries(map).flatMap(([w, n]) => Array(n).fill(w)); }
  const APPOSITION = /, (כפרה עלי(ה|ו|הם)|מלכה?|מלכים|גבר גבר|גבר|צדיקה|חיים שלי|אם ירצה השם|בשעה טובה)$/;
  const LETTER = "א-תa-zA-Z0-9";
  const WORD_RE = new RegExp("[" + LETTER + "]+(?:['\"][" + LETTER + "]+)*'?", "g");

  /* ---------- המילון ---------- */
  const PHRASES = Object.create(null);
  const NOUNS = Object.create(null);
  const STAND = Object.create(null);
  const ARSIT = Object.create(null); // נוסחים של ערסית 2.5 שגוברים על המילון הרגיל
  let entryCount = 0;
  (function parse(src) {
    let target = PHRASES;
    for (const raw of src.split("\n")) {
      const line = raw.trim();
      if (!line || line[0] === "#") continue;
      if (line === "@phrases") { target = PHRASES; continue; }
      if (line === "@nouns") { target = NOUNS; continue; }
      if (line === "@stand") { target = STAND; continue; }
      if (line === "@arsit") { target = ARSIT; continue; }
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const variants = line.slice(eq + 1).split("|").map(s => s.trim());
      for (const k of line.slice(0, eq).split(",")) {
        const key = norm(k);
        if (!key) continue;
        target[key] = variants;
        entryCount++;
      }
    }
  })(window.ARS_LEXICON || "");

  /* משפטים שלמים מתוך מאגר הדוגמאות (examples.js): התרגום המדויק שלהם */
  const EXAMPLES = Object.create(null);
  for (const [src, dst] of ((typeof window !== "undefined" ? window : globalThis).ARS_EXAMPLES || [])) {
    const key = sentenceKey(src);
    if (key) { EXAMPLES[key] = dst.split("|").map(v => v.trim()); entryCount++; }
  }
  const ARSIT_EXAMPLES = Object.create(null);
  for (const [src, dst] of ((typeof window !== "undefined" ? window : globalThis).ARSIT_EXAMPLES || [])) {
    const key = sentenceKey(src);
    if (key) { ARSIT_EXAMPLES[key] = dst.split("|").map(v => v.trim()); entryCount++; }
  }
  function sentenceKey(s) {
    return tokenize(norm(s)).filter(t => t.w).map(t => t.n.replace(/'$/, "")).join(" ");
  }

  /* ---------- פניות ---------- */
  /* פניות לגבר, עם משקל: כמה פעמים כל אחת מופיעה ברשימה */
  const ADDR_M = weighted({
    "אחשלי": 5, "אחי": 1, "חיים שלי": 3, "יא מלך": 3, "מלך": 2, "תותח": 2, "יא תותח": 1,
    "צדיק": 2, "יא צדיק": 1, "חביבי": 2, "יא חביבי": 1, "נשמה": 2, "כפרה": 2, "כפרה עליך": 1,
    "גבר": 1, "יא גבר": 1, "נסיך": 1, "יא נסיך": 1, "אבא": 1, "יא אבא": 1, "ברבור": 1, "יא ברבור": 1,
    "יא ערס": 1, "אח שלי": 1
  });
  const ADDR_F = ["אחותי", "אחותי", "נשמה", "נשמה", "כפרה", "כפרה עלייך", "יא מלכה", "מלכה", "מאמי", "בובה", "נסיכה", "יא נסיכה",
    "חיים שלי", "יא חיים שלי", "נשמה שלי", "מותק", "יא מותק", "יא זהב", "בובה שלי", "אחותי היקרה", "צדיקה"];
  /* ערסית 2.5: הפניות שלה. בלי לדעת למי היא מדברת, רק פניות שמתאימות לשני המינים */
  const ADDR_AN = weighted({ "חיים שלי": 4, "כפרה": 3, "לבשלי": 3, "מאמי": 2, "חיים": 2, "נשמה": 2, "כפרה עליך": 1 });
  const ADDR_AF = weighted({ "יפה שלי": 3, "מתוקה": 3, "אחותי": 3, "חיים שלי": 3, "כפרה": 2, "מאמי": 2, "לבשלי": 2,
    "שימדורה": 1, "אמא": 1, "חיים": 1, "כפרה עלייך": 1 });
  const ADDR_ALL = new Set(ADDR_M.concat(ADDR_F, ADDR_AN, ADDR_AF));

  /* פתיחים וסיומות לפי סוג משפט */
  const OPEN = {
    plain: ["וואלה,", "שומע,", "שומע אחשלי,", "{A},", "אחשלי,", "אחשלי,", "יא אללה,", "בחייאת,", "שומע מה אני אומר לך,", "בקיצר,", "{A}, שומע,", "וואלה {A},", "וואלק,"],
    question: ["תגיד,", "{A},", "שאלה,", "תגיד לי {A},", "וואלה,", "בחייאת,"],
    anger: ["שומע טוב,", "יא אללה,", "בחייאת,", "{A}, שומע,", "וואלק,", "אינעל ראבק,", "אל תשגע אותי,", "כוסאומו,", "כושלירבאק,", "כוסאומו {A},"],
    love: ["{A},", "שומע,", "כפרה,", "וואלה {A},"],
    sad: ["וואלה,", "{A},", "יא אללה,", "אחח,"],
    excited: ["יא אללה,", "וואלק,", "{A},", "וואלה,", "אמאל'ה,"]
  };
  const CLOSE = {
    plain: [" {A}", " {A}", " {A}", ", באמא שלי", ", באמא שלי", ", נודר", ", ביקר לי", ", בתפילין", ", נודר נדר", ", על אמא שלי", ", בחיי", ", אתה מבין", ", קלטת", ", סגור", ", חלאס", ", וזהו", ", בלי חוכמות"],
    question: [" {A}", " {A}", " {A}", ", נו", ", מה, לא", ", יא אללה"],
    anger: [" {A}", ", באמא שלי", ", נודר נדר", ", בתפילין", ", חלאס", ", עד כאן", ", אל תשגע אותי", ", מה התסביך", ", כוסאומו", ", כושלירבאק"],
    love: [" {A}", " {A}", ", באמא שלי", ", ביקר לי", ", מכל הלב"],
    sad: [" {A}", ", מה לעשות", ", באסה", ", יא אללה"],
    excited: [" {A}", " {A}", ", פצצות", ", אש", ", יא אללה", ", חבל על הזמן"]
  };

  /* שבועות: לא שמים שתיים באותו משפט */
  const OATH_RE = /באמא של|על אמא של|נודר|ביקר לי|בתפילין|בחיי|על המשפחה/;
  /* קללות: אחת למשפט מספיקה */
  const CURSE_RE = /כוסאומו|כושלירבאק|מזדיין|להזדיין|תזדיין|אינעל|מזיין|לזיין/;

  const OPEN_ARSIT = {
    plain: ["וואנה,", "יעני,", "אמאלה,", "יאללה,", "שומע,", "{A},", "{A},", "וואלה,"],
    question: ["שומע {A},", "{A},", "יעני,", "וואנה,"],
    anger: ["וואנה,", "אמאלה,", "{A}, שומע,", "יעני,"],
    love: ["{A},", "וואנה {A},", "אמאלה,"],
    sad: ["אמאלה,", "{A},", "וואנה,"],
    excited: ["אמאלה,", "וואנה,", "{A},", "יאללה,"]
  };
  const CLOSE_ARSIT = {
    plain: [" {A}", " {A}", " {A}", ", בעזרת השם", ", ברוך השם", ", יעני", ", אני מתה", ", באמא שלי"],
    question: [" {A}", " {A}", ", יעני"],
    anger: [" {A}", ", אמאלה", ", יעני", ", באמא שלי"],
    love: [" {A}", " {A}", ", אני מתה עליך", ", ביקר לי"],
    sad: [" {A}", ", מה לעשות", ", בעזרת השם"],
    excited: [" {A}", ", אני מתה", ", אני פיפי, אני מתה", ", אמאלה"]
  };
  /* היא מדברת על עצמה בלשון נקבה */
  const SPEAKER_F = [
    ["אני מת", "אני מתה"], ["מת על", "מתה על"], ["מת לראות", "מתה לראות"], ["מת מרעב", "מתה מרעב"], ["מת מצחוק", "מתה מצחוק"],
    ["משוגע על", "משוגעת על"], ["אני חייב", "אני חייבת"], ["חייב לחרבן", "חייבת לחרבן"], ["אני מאחר", "אני מאחרת"],
    ["אני זז", "אני זזה"], ["אני עף", "אני עפה"], ["אני מתקפל", "אני מתקפלת"], ["אני חותך", "אני חותכת"], ["אני מגיע", "אני מגיעה"],
    ["אני רותח", "אני רותחת"], ["אני מתפוצץ", "אני מתפוצצת"], ["אני מפוצץ", "אני מפוצצת"], ["אני יודע", "אני יודעת"],
    ["מה אני יודע", "מה אני יודעת"], ["לא קולט", "לא קולטת"], ["לא יודע", "לא יודעת"], ["אני אומר לך", "אני אומרת לך"],
    ["מה אני, פראייר", "מה אני, פראיירית"], ["פראייר פה", "פראיירית פה"], ["אני טוחן", "אני טוחנת"], ["זורם", "זורמת"],
    ["אני שבור", "אני שבורה"], ["אני מסדר", "אני מסדרת"], ["אני מטפל", "אני מטפלת"], ["אני רץ", "אני רצה"],
    ["הייתי אוכל", "הייתי אוכלת"], ["מורעב", "מורעבת"], ["אני בטוח", "אני בטוחה"], ["לא סגור", "לא סגורה"],
    ["סגור איתך", "סגורה איתך"], ["אני לחוץ", "אני לחוצה"], ["מבואס", "מבואסת"], ["אני מאושר", "אני מאושרת"],
    ["אני שמח", "אני שמחה"], ["אני גמור", "אני גמורה"], ["אני מפורק", "אני מפורקת"], ["אני הרוס", "אני הרוסה"],
    ["אני משוגע", "אני משוגעת"], ["אני עסוק", "אני עסוקה"], ["אני מת עליך", "אני מתה עליך"]
  ];
  /* פניות גבריות שמגיעות מהמילון או מהדוגמאות מוחלפות בפנייה שלה */
  const MALE_ADDR_RE = /(^|[^\u05D0-\u05EA'])(אחשלי|אחי|יא מלך|יא גבר|יא ערס|יא ברבור|ברבור|יא נסיך|יא אבא|יא צדיק|יא תותח|יא חביבי)(?=$|[^\u05D0-\u05EA'])/g;

  /* מילים שאם המשפט כבר מתחיל בהן, לא מוסיפים פתיח */
  const NO_OPEN = new Set(["וואנה", "יעני", "אמאלה", "מחילה", "אני", "שחרר", "סעי", "שומע", "שומעת", "כוסאומו", "כושלירבאק", "אהלן", "וואלק", "נודר", "באמא", "ביקר", "בתפילין", "אל", "מה", "יאללה", "וואלה", "שמע", "שמעי", "תקשיב", "תקשיבי", "תגיד", "תגידי", "בוקר", "ערב",
    "לילה", "שבת", "חג", "יא", "סבבה", "סגור", "בטח", "ברור", "אין", "חלאס", "די", "סחתיין", "מזל", "תודה", "כפרה",
    "סורי", "מחילה", "בכיף", "שלום", "רואים", "וואו", "וואי", "אמאל'ה", "אוף", "בחיי", "בחייאת", "על", "תכלס", "בקיצור",
    "קיצר", "בקיצר", "לחיים", "שנה", "יום", "צהריים", "ערבים", "בוקרים", "רגע", "שנייה", "חכה'לי", "חכי'לי", "תסתום", "תסתמי",
    "שחרר", "עזוב", "חחחח", "מתתי", "קרעת", "בהצלחה", "בתיאבון", "נעים", "כבוד", "דבש", "אש", "הכל", "חיים",
    "ששש", "נו", "אוהו", "פצצות", "פצצה", "מהההה", "באסה", "פדיחה", "אופס"]);

  const MOOD_WORDS = {
    anger: /(^| )(משקר|משקרת|לעזאזל|פאק|שיט|מבזבז|תבלבל|כועס|כועסת|עצבני|עצבנית|נמאס|שונא|שונאת|תסתום|שתוק|תשתוק|מעצבן|מעצבנת|לעזאזל|תפסיק|תפסיקי|מטומטם|מטומטמת|אידיוט|די)( |$)/,
    love: /(^| )(אוהב|אוהבת|מתגעגע|מתגעגעת|אהבה|יקר לי|יקרה לי|חסר לי|חסרה לי)( |$)/,
    sad: /(^| )(עצוב|עצובה|באסה|קשה לי|בוכה|מבואס|מבואסת|חבל|מצטער|מצטערת)( |$)/
  };
  const QUESTION_START = /^(מה|למה|איך|מתי|איפה|מי|כמה|האם|מאיפה|לאן|איזה|איזו|אפשר|יש לך|יש לכם|נכון ש)( |$)/;
  const SKIP_DECOR = /(^| )(שלום|היי|הי|בוקר|ערב|לילה|תודה|סליחה|להתראות|ביי|מזל טוב|שבת שלום|חג שמח|בהצלחה|נתראה)( |$)/;

  /* פנייה לאישה */
  const FEM_RE = /(^\s*|[,.!?]\s*)(את|ואת)(?=\s)|(^|[\s,.!?])(בואי|תבואי|תגידי|תעשי|תקשיבי|תשמעי|תראי|תחכי|חכי|תביאי|תלכי|תירגעי|תרגעי|תסלחי|תעזרי|תתקשרי|תשלחי|תשמרי|תפסיקי|תשתקי|תני|קחי|שבי|לכי|יפה שלי|מתוקה|חמודה|יקרה|אהובתי|מאמי|אחותי|גברת|מלכה|נסיכה|בובה|משקרת|צוחקת|רצינית|צודקת|בטוחה|אלייך|עלייך|אותך מתוקה)(?=$|[\s,.!?])/;
  /* מה מחליפים בטקסט שהמנוע מייצר כשפונים לאישה (לא נוגעים במילים שהמשתמש כתב) */
  const FEM_SWAP = [
    ["שחרר ממני", "סעי ממני"], ["אל תעלה לי את העצבים", "אל תעלי לי את העצבים"], ["אתה חי בסרט", "את חיה בסרט"],
    ["אתה מעלה לי", "את מעלה לי"],
    ["אתה מלך", "את מלכה"], ["אתה תותח", "את תותחית"], ["אתה מגיע", "את מגיעה"], ["אתה חושב", "את חושבת"],
    ["אתה צריך", "את צריכה"], ["אתה בא", "את באה"], ["אתה מבין", "את מבינה"], ["אתה שומע", "את שומעת"],
    ["אתה קולט", "את קולטת"], ["אתה עושה", "את עושה"], ["אתה מכיר", "את מכירה"], ["אתה סגור", "את סגורה"],
    ["אתה רציני", "את רצינית"], ["אתה יכול", "את יכולה"], ["אתה מחרטט", "את מחרטטת"], ["אתה עובד", "את עובדת"],
    ["אתה מספר", "את מספרת"], ["אתה משגע", "את משגעת"], ["אתה מוציא", "את מוציאה"], ["אל תשגע", "אל תשגעי"], ["אתה מסתכל", "את מסתכלת"], ["אתה נלחץ", "את נלחצת"], ["אתה פה", "את פה"],
    ["אתה יקר", "את יקרה"], ["אתה הכל", "את הכל"], ["אתה לא", "את לא"], ["אתה רוצה", "את רוצה"],
    ["מה אתה", "מה את"], ["אתה", "את"], ["אחי", "אחותי"], ["אחשלי", "אחותי"], ["יא גבר", "יא מלכה"], ["יא נסיך", "יא נסיכה"], ["תותח", "תותחית"], ["צדיק", "צדיקה"], ["חביבי", "חביבתי"], ["יא מזדיין", "יא מזדיינת"], ["אל תזדיין", "אל תזדייני"], ["תפסיק להזדיין", "תפסיקי להזדיין"], ["יא ברבור", "יא נסיכה"], ["יא אבא", "יא מלכה"], ["מה התסביך שלך", "מה התסביך שלך"],
    ["עליך", "עלייך"], ["אליך", "אלייך"], ["בשבילך", "בשבילך"], ["שומע טוב", "שומעת טוב"], ["שומע", "שומעת"], ["שמע", "שמעי"], ["תקשיב", "תקשיבי"], ["תשמע", "תשמעי"],
    ["תגיד", "תגידי"], ["תראה", "תראי"], ["תסתכל", "תסתכלי"], ["תירגע", "תירגעי"], ["תעשה", "תעשי"], ["תסדר", "תסדרי"],
    ["תקפוץ", "תקפצי"], ["תביא", "תביאי"], ["תן", "תני"], ["קח", "קחי"], ["תוריד", "תורידי"], ["שב", "שבי"],
    ["תצלצל", "תצלצלי"], ["תזרוק", "תזרקי"], ["תשאיר", "תשאירי"], ["תהיה", "תהיי"], ["תמכור", "תמכרי"], ["תיקח", "תיקחי"],
    ["שחרר", "שחררי"], ["עזוב", "עזבי"], ["תסתום", "תסתמי"], ["סגור את הפה", "סגרי את הפה"], ["תסגור", "תסגרי"],
    ["תחכה", "תחכי"], ["חכה'לי", "חכי'לי"], ["בוא'נה", "בואי'נה"], ["תגיע", "תגיעי"], ["תתפלל", "תתפללי"], ["תמחל", "תמחלי"],
    ["תרים", "תרימי"], ["שים", "שימי"], ["שמור", "שמרי"], ["תשמור", "תשמרי"], ["תקרע", "תקרעי"], ["תפרק", "תפרקי"],
    ["תאמין", "תאמיני"], ["תבין", "תביני"], ["תקלוט", "תקלטי"], ["תחלום", "תחלמי"], ["תטחן", "תטחני"], ["תחזור", "תחזרי"],
    ["תרגיש", "תרגישי"], ["תיזהר", "תיזהרי"], ["בוא נשב", "בואי נשב"], ["בוא נעשה", "בואי נעשה"], ["בוא נדפוק", "בואי נדפוק"],
    ["בוא נרים", "בואי נרים"], ["בוא", "בואי"], ["סע", "סעי"], ["שתחיה", "שתחיי"], ["ותעשה", "ותעשי"], ["שתהיה בריא", "שתהיי בריאה"],
    ["תהיה חזק", "תהיי חזקה"], ["צודק", "צודקת"], ["דיברת", "דיברת"], ["אכלת", "אכלת"]
  ];
  const SPEAKER_F_RE = SPEAKER_F.map(([m, f]) => [new RegExp("(^|[^" + LETTER + "'])" + esc(m) + "(?=$|[^" + LETTER + "'])", "g"), "$1" + f]);
  const FEM_SWAP_RE = FEM_SWAP.map(([m, f]) => [new RegExp("(^|[^" + LETTER + "'])" + esc(m) + "(?=$|[^" + LETTER + "'])", "g"), "$1" + f]);

  /* ---------- כלים ---------- */

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function norm(s) {
    return s.normalize("NFC")
      .replace(/[֑-ׇ]/g, "")
      .replace(/[׳‘’`]/g, "'")
      .replace(/[״“”]/g, '"')
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(list, r) { return list[Math.floor(r() * list.length)]; }
  function femify(s) {
    for (const [re, to] of FEM_SWAP_RE) s = s.replace(re, to);
    return s;
  }

  /* מפרק משפט לטוקנים: מילים ומה שביניהן */
  function tokenize(s) {
    const out = [];
    let last = 0;
    WORD_RE.lastIndex = 0;
    let m;
    while ((m = WORD_RE.exec(s))) {
      if (m.index > last) out.push({ w: false, t: s.slice(last, m.index) });
      out.push({ w: true, t: m[0], n: norm(m[0]).replace(/'$/, "") });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ w: false, t: s.slice(last) });
    return out;
  }

  const ALWAYS_PREFIX = ["וכש", "וש", "כש", "ש", "ו"];
  const NOUN_PREFIX = ["וכשה", "וכשב", "וכשל", "כשה", "כשב", "כשל", "ושה", "ושב", "ושל", "ושמ", "וה", "וב", "ול", "ומ", "וכ",
    "שה", "שב", "של", "שמ", "מה", "כה", "ה", "ב", "ל", "מ", "כ"];

  /* מחפש ביטוי במילון; מחזיר [variants, prefix] או null */
  let ARSIT_ON = false; // נקבע בכל תרגום
  function ph(k) { return (ARSIT_ON && ARSIT[k]) || PHRASES[k]; }
  function lookup(words) {
    const key = words.join(" ");
    if (ph(key)) return [ph(key), ""];
    if (words.length === 1 && NOUNS[key]) return [NOUNS[key], ""];
    const first = words[0];
    const rest = words.slice(1).join(" ");
    for (const p of ALWAYS_PREFIX) {
      if (first.length > p.length + 1 && first.startsWith(p)) {
        const k = (first.slice(p.length) + (rest ? " " + rest : ""));
        if (ph(k)) return [ph(k), p];
        if (words.length === 1 && NOUNS[k]) return [NOUNS[k], p];
      }
    }
    if (words.length === 1) {
      for (const p of NOUN_PREFIX) {
        if (first.length > p.length + 1 && first.startsWith(p) && NOUNS[first.slice(p.length)]) {
          return [NOUNS[first.slice(p.length)], p];
        }
      }
    }
    return null;
  }

  /* מדביק תחילית (ו, ה, ב...) לנוסח שנבחר */
  function attachPrefix(prefix, variant) {
    if (!prefix) return variant;
    if (!variant) return prefix.replace(/[הבלמכ]+$/, "") ;
    if (variant[0] === "{") return variant;
    let p = prefix, v = variant;
    if (v[0] === "ה" && /[בלכ]$/.test(p)) v = v.slice(1);
    else if (v[0] === "ה" && /ה$/.test(p)) p = p.slice(0, -1);
    return p + v;
  }

  /* ---------- תרגום ---------- */
  function translate(input, variant, persona) {
    const arsit = persona === "arsit";
    ARSIT_ON = arsit;
    const t0 = (typeof performance !== "undefined" ? performance : Date).now();
    const clean = input.normalize("NFC").replace(/[֑-ׇ]/g, "").replace(/[׳‘’]/g, "'").replace(/[״“”]/g, '"');
    if (!clean.trim()) return { text: "", score: 0, words: 0, ms: 0 };

    const r = rng(hash(norm(clean)) ^ Math.imul((variant | 0) + 1, 0x9E3779B1));
    const fem = FEM_RE.test(" " + norm(clean) + " ");
    const pool = (arsit ? (fem ? ADDR_AF : ADDR_AN) : (fem ? ADDR_F : ADDR_M)).slice();
    const OP = arsit ? OPEN_ARSIT : OPEN, CL = arsit ? CLOSE_ARSIT : CLOSE;
    const usedAddr = new Set();
    let addrBudget = 0; // כמה פניות מותר עוד (מתחדש בכל משפט שני)
    const gen = s => {
      let o = fem ? femify(s) : s;
      if (arsit) {
        for (const [re, to] of SPEAKER_F_RE) o = o.replace(re, to);
        o = o.replace(MALE_ADDR_RE, (m, pre) => pre + address());
      }
      return o;
    };

    // כל הטקסט הוא משפט מהמאגר
    const wk = sentenceKey(clean);
    const whole = arsit ? (ARSIT_EXAMPLES[wk] || (ARSIT[wk] ? null : EXAMPLES[wk])) : EXAMPLES[wk];
    if (whole) {
      let text = gen(whole[(hash(norm(clean)) + (variant | 0)) % whole.length]);
      const end = clean.trim().match(/[.!?…]+$/);
      if (end && !/[.!?…]$/.test(text)) text += end[0];
      const ms = (typeof performance !== "undefined" ? performance : Date).now() - t0;
      return { text, score: 97 + (hash(text) % 3), words: sentenceKey(clean).split(" ").length, ms, fem };
    }

    function address() {
      let choices = pool.filter(a => !usedAddr.has(a));
      if (!choices.length) choices = pool;
      const a = pick(choices, r);
      usedAddr.add(a);
      return a;
    }
    /* ממלא {A}: פנייה אמיתית או מוחק אותה, לפי התקציב */
    function fill(s, allow) {
      return s.replace(/(,?\s*)\{A\}(,?)/g, (m, before, after, off) => {
        if (allow.n > 0) {
          allow.n--;
          return before + address() + after;
        }
        const atStart = off === 0;
        return atStart ? "" : (after && !before.includes(",") ? "," : "");
      }).replace(/^\s*,\s*/, "").replace(/\s+,/g, ",").replace(/,,+/g, ",").replace(/\s{2,}/g, " ").trim();
    }

    // לשורות ואז למשפטים, ושומרים את הפיסוק והרווחים שבסוף כל משפט
    const parts = clean.split(/(\n+)/);
    let replacedWords = 0, totalWords = 0, decorations = 0;
    const lines = [];
    let sentenceIndex = 0;
    const allSentences = [];
    for (const part of parts) {
      if (/^\n+$/.test(part)) { lines.push({ br: part }); continue; }
      const re = /[^.!?…]+(?:[.!?…]+|$)\s*|[.!?…]+\s*/g;
      let m;
      const sents = [];
      while ((m = re.exec(part))) {
        if (!m[0]) { re.lastIndex++; continue; }
        const mm = m[0].match(/^([\s\S]*?)([.!?…]*)(\s*)$/);
        sents.push({ body: mm[1], punct: mm[2], space: mm[3] });
      }
      lines.push({ sents });
      allSentences.push(...sents);
    }
    const lastSentence = allSentences[allSentences.length - 1];

    for (const line of lines) {
      if (line.br) continue;
      for (const s of line.sents) {
        const isFirst = sentenceIndex === 0;
        const isLast = s === lastSentence;
        sentenceIndex++;
        if (sentenceIndex % 2 === 1) addrBudget = Math.min(addrBudget + 1, 1);
        const allow = { n: addrBudget };

        const lead = s.body.match(/^\s*/)[0];
        const tokens = tokenize(s.body.trim());
        const words = tokens.filter(t => t.w);
        totalWords += words.length;
        if (!words.length) { s.out = s.body; continue; }
        const key = words.map(w => w.n.replace(/'$/, "")).join(" ");

        // משפט שעומד לבד
        let out;
        let standalone = false;
        const exList = arsit ? (ARSIT_EXAMPLES[key] || (ARSIT[key] ? null : EXAMPLES[key])) : EXAMPLES[key];
        if (exList) {
          out = gen(exList[(hash(key) + (variant | 0)) % exList.length]).replace(/[.!?…]+$/, "");
          replacedWords += words.length;
          standalone = true;
        } else if ((arsit && ARSIT[key]) || STAND[key] || (words.length === 1 && /^ח{3,}$/.test(key))) {
          const list = (arsit && ARSIT[key]) || STAND[key] || ph("חחח");
          out = fill(gen(pick(list, r)), allow);
          replacedWords += words.length;
          standalone = true;
        } else {
          // החלפת ביטויים: הארוך ביותר קודם
          const pieces = [];
          let i = 0;
          while (i < tokens.length) {
            const tok = tokens[i];
            if (!tok.w) { pieces.push({ t: tok.t }); i++; continue; }
            let hit = null, span = 0, idxEnd = i;
            const seq = [];
            const idx = [];
            let j = i;
            while (j < tokens.length && seq.length < MAX_PHRASE) {
              if (tokens[j].w) { seq.push(tokens[j].n); idx.push(j); j++; }
              else if (/^\s+$/.test(tokens[j].t) && j + 1 < tokens.length && tokens[j + 1].w) j++;
              else break;
            }
            for (let L = seq.length; L >= 1; L--) {
              const found = lookup(seq.slice(0, L));
              if (found) { hit = found; span = L; idxEnd = idx[L - 1]; break; }
            }
            if (/^ח{3,}$/.test(tok.n)) { hit = [ph("חחח"), ""]; span = 1; idxEnd = i; }
            if (hit) {
              let [variants, prefix] = hit;
              if (prefix && /[הבלמכ]/.test(prefix)) {
                const single = variants.filter(v => v && !/\s/.test(v));
                if (single.length) variants = single;
              }
              const followedByWord = tokens.slice(idxEnd + 1).some(t => t.w);
              if (followedByWord) {
                // באמצע משפט: נוסחים בלי פסיק, חוץ מתוספות כמו "אמא שלי, כפרה עליה"
                const inline = variants.filter(v => !v.replace(/\s*\{A\}$/, "").includes(",") || APPOSITION.test(v));
                if (inline.length) variants = inline;
              }
              const sofar = pieces.map(p => p.t).join("");
              let v = pick(variants, r);
              for (let k = 0; k < 4 && v && sofar.includes(gen(v.replace(/\s*\{A\}.*$/, ""))); k++) v = pick(variants, r);
              const atStart = pieces.every(p => !p.t.trim());
              if (followedByWord) v = v.replace(/,?\s*\{A\}\s*$/, "");
              if (!atStart) v = v.replace(/^\{A\},?\s*/, "");
              if (followedByWord && v.includes(",") && !/[,?]$/.test(v) && tokens[idxEnd + 1] && /^\s+$/.test(tokens[idxEnd + 1].t)) v += ",";
              v = attachPrefix(prefix, v);
              pieces.push({ t: fill(gen(v), allow), hit: true });
              replacedWords += span;
              i = idxEnd + 1;
            } else {
              pieces.push({ t: tok.t });
              i++;
            }
          }
          out = pieces.map(p => p.t).join("").replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/^\s*,\s*/, "").trim();
        }

        // סוג המשפט
        const isQ = s.punct.includes("?") || QUESTION_START.test(key);
        let mood = isQ ? "question" : "plain";
        if (MOOD_WORDS.anger.test(key)) mood = "anger";
        else if (MOOD_WORDS.love.test(key)) mood = "love";
        else if (MOOD_WORDS.sad.test(key)) mood = "sad";
        else if (!isQ && s.punct.includes("!")) mood = "excited";

        const skipDecor = SKIP_DECOR.test(key);
        const hasAddr = [...ADDR_ALL].some(a => new RegExp("(^|[^" + LETTER + "])" + esc(a) + "($|[^" + LETTER + "])").test(out));
        if (hasAddr) allow.n = 0;

        // פתיח
        const firstWord = (out.match(WORD_RE) || [""])[0];
        const openChance = standalone ? 0 : isFirst ? 0.8 : 0.3;
        if (!skipDecor && out && !NO_OPEN.has(firstWord) && !ADDR_ALL.has(firstWord) && r() < openChance) {
          const opens = CURSE_RE.test(out) ? OP[mood].filter(o => !CURSE_RE.test(o)) : OP[mood];
          const op = fill(gen(pick(opens, r)), allow);
          if (op && op !== ",") { out = op.replace(/,?$/, ",") + " " + out; decorations++; }
        }
        // סיומת
        const closeChance = isLast ? 0.85 : 0.35;
        const hasAddrNow = hasAddr || [...usedAddr].some(a => out.includes(a));
        const hasOath = OATH_RE.test(out);
        if (!skipDecor && out && r() < closeChance) {
          let options = CL[mood];
          if (hasAddrNow || allow.n <= 0) options = options.filter(c => !c.includes("{A}"));
          if (standalone) options = options.filter(c => c.includes("{A}"));
          if (hasOath || isQ) options = options.filter(c => !OATH_RE.test(c));
          if (CURSE_RE.test(out)) options = options.filter(c => !CURSE_RE.test(c));
          if (options.length) {
            const tpl = pick(options, r);
            const body = tpl.replace(/^,?\s*/, "");
            const c = fill(gen(body), allow);
            if (c && !out.includes(c)) {
              const sep = tpl.startsWith(",") || (body.startsWith("{A}") && out.includes(",")) ? ", " : " ";
              out = out.replace(/[,\s]+$/, "") + sep + c;
              decorations++;
            }
          }
        }
        addrBudget = allow.n;

        // פיסוק: קריאה מקבלת עוד סימן, שאלה נשארת שאלה
        let punct = s.punct;
        if (punct === "!" && r() < 0.5) punct = "!!";
        if (punct === "?" && mood === "anger") punct = "?!";
        if (punct) out = out.replace(/[.!?…]+$/, "");
        s.out = lead + out + punct + s.space;
      }
    }

    const text = lines.map(l => (l.br ? l.br : l.sents.map(s => s.out).join(""))).join("").trim();
    const ratio = totalWords ? replacedWords / totalWords : 0;
    const score = Math.max(61, Math.min(99, Math.round(58 + ratio * 34 + decorations * 4 + (hash(text) % 5))));
    const ms = (typeof performance !== "undefined" ? performance : Date).now() - t0;
    return { text, score, words: totalWords, ms, fem };
  }

  /* אם אין בכלל עברית ולא מצאנו כלום */
  function translateSafe(input, variant, persona) {
    const res = translate(input, variant, persona);
    if (res.text && !/[א-ת]/.test(input) && !/[א-ת]/.test(res.text)) {
      const lines = ["אחי, תכתוב בעברית. מה אני, גוגל?", "וואלה לא קלטתי, תכתוב בעברית נשמה", "בעברית {A}, בעברית. אנחנו בישראל"];
      res.text = lines[hash(input) % lines.length].replace("{A}", "אחי");
      res.score = 99;
    }
    return res;
  }

  window.Arslate = { translate: translateSafe, size: entryCount };
})();
