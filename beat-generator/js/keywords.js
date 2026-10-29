"use strict";

// Turns free text into tags. Each tag has the words (Hebrew and English) that trigger it.
// Styles pick the drum pattern; moods change the scale, tempo and sound.
window.BG = window.BG || {};

BG.STYLES = {
  trap:    { label: "טראפ",    words: ["טראפ", "טרפ", "trap", "אטלנטה", "atlanta"] },
  drill:   { label: "דריל",    words: ["דריל", "drill", "לונדון", "london", "ברוקלין", "brooklyn"] },
  boombap: { label: "בום באפ", words: ["בום באפ", "בומבאפ", "בום-באפ", "boom bap", "boombap", "boom-bap", "אולד סקול", "אולדסקול", "old school", "oldschool", "ניינטיז", "90s", "90", "קלאסי", "classic", "ניו יורק", "new york"] },
  lofi:    { label: "לו-פיי",  words: ["לו פיי", "לו-פיי", "לופיי", "lofi", "lo-fi", "lo fi", "לימודים", "study", "ג'אז", "ג׳אז", "jazz"] },
  dembow:  { label: "רגאטון",  words: ["רגאטון", "reggaeton", "דמבו", "dembow", "אפרו", "afro", "אפרוביט", "afrobeat", "לטיני", "latin", "מסיבה", "party", "רחבה"] }
};

BG.MOODS = {
  dark:       { label: "אפל",      words: ["אפל", "חושך", "חשוך", "dark", "כהה", "מפחיד", "scary", "אימה", "horror", "צל", "shadow"] },
  sad:        { label: "עצוב",     words: ["עצוב", "עצב", "sad", "שבור", "broken", "כאב", "pain", "דמעות", "tears", "געגוע", "געגועים", "רגשי", "emotional", "בדידות", "lonely"] },
  happy:      { label: "שמח",      words: ["שמח", "שמחה", "happy", "שמש", "sun", "sunny", "חוף", "beach", "חגיגה", "כיף", "fun"] },
  summer:     { label: "קיץ",      words: ["קיץ", "summer", "חם", "hot", "ים", "sea", "אילת"] },
  aggressive: { label: "אגרסיבי",  words: ["אגרסיבי", "aggressive", "כועס", "זעם", "עצבים", "angry", "rage", "קרב", "battle", "באטל", "רחוב", "street", "hard", "קשה", "מלחמה", "war"] },
  chill:      { label: "צ'יל",     words: ["צ'יל", "צ׳יל", "צייל", "chill", "רגוע", "נינוח", "relax", "שקט", "quiet", "שבת", "בוקר", "morning"] },
  epic:       { label: "אפי",      words: ["אפי", "epic", "ניצחון", "victory", "מלך", "king", "מלכה", "queen", "אימפריה", "empire", "קולנועי", "cinematic", "גיבור", "hero", "כתר"] },
  night:      { label: "לילה",     words: ["לילה", "night", "ירח", "moon", "עיר", "city", "נאון", "neon", "חצות", "midnight", "תל אביב", "tel aviv"] },
  rain:       { label: "גשם",      words: ["גשם", "rain", "rainy", "חורף", "winter", "סערה", "storm", "ענן", "עננים", "cloud"] },
  vinyl:      { label: "ויניל",    words: ["ויניל", "vinyl", "תקליט", "record", "נוסטלגיה", "nostalgia", "ישן", "old", "רטרו", "retro"] },
  oriental:   { label: "מזרחי",    words: ["מזרחי", "מזרחית", "oriental", "ערבי", "arabic", "ים תיכוני", "ים-תיכוני", "mediterranean", "דרבוקה", "חפלה", "תימני"] },
  dreamy:     { label: "חלומי",    words: ["חלום", "חלומי", "חלומות", "dream", "dreamy", "חלל", "space", "כוכבים", "stars", "ריחוף", "float"] },
  love:       { label: "אהבה",     words: ["אהבה", "love", "רומנטי", "romantic", "לב", "heart", "נשיקה"] },
  fast:       { label: "מהיר",     words: ["מהיר", "fast", "אנרגיה", "energy", "טורבו", "turbo", "ריצה", "אדרנלין"] },
  slow:       { label: "איטי",     words: ["איטי", "slow", "כבד", "heavy", "עייף", "tired"] }
};

// Hebrew attaches prefixes to words ("בלילה", "והגשם"); try the word without them too.
const PREFIXES = ["וה", "שה", "בה", "לה", "מה", "כש", "ה", "ו", "ב", "ל", "מ", "ש", "כ"];

function normalize(text) {
  return text.toLowerCase().replace(/[״"]/g, "").replace(/\s+/g, " ").trim();
}

BG.parseKeywords = function (text) {
  const norm = normalize(text || "");
  const styles = [];
  const moods = [];
  const matched = new Set();
  const index = [];
  for (const [id, s] of Object.entries(BG.STYLES)) for (const w of s.words) index.push({ w: normalize(w), kind: "style", id });
  for (const [id, m] of Object.entries(BG.MOODS)) for (const w of m.words) index.push({ w: normalize(w), kind: "mood", id });
  // Longer phrases first, so "בום באפ" wins over a single word inside it.
  index.sort((a, b) => b.w.length - a.w.length);

  const add = (hit) => {
    const list = hit.kind === "style" ? styles : moods;
    if (!list.includes(hit.id)) list.push(hit.id);
  };

  // Multi-word phrases are matched on the whole text.
  let rest = " " + norm.replace(/[,،.;!?]/g, " ") + " ";
  for (const hit of index) {
    if (!hit.w.includes(" ")) continue;
    const needle = " " + hit.w + " ";
    if (rest.includes(needle)) {
      add(hit);
      hit.w.split(" ").forEach((p) => matched.add(p));
      rest = rest.split(needle).join(" ");
    }
  }

  const tokens = rest.split(" ").filter(Boolean);
  const unknown = [];
  for (const tok of tokens) {
    const tries = [tok];
    for (const p of PREFIXES) if (tok.startsWith(p) && tok.length - p.length >= 2) tries.push(tok.slice(p.length));
    const hit = index.find((h) => !h.w.includes(" ") && tries.includes(h.w));
    if (hit) { add(hit); matched.add(tok); }
    else unknown.push(tok);
  }
  return { styles, moods, unknown: [...new Set(unknown)], text: norm };
};
