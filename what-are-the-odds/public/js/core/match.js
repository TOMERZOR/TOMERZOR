// Finds the checked answer (data.js) that a question is asking about.
// Hebrew-aware: strips the prefixes ו ה ש ב ל מ כ, ignores final letter forms,
// quotes and gershayim, and niqqud. Works the same in the browser and the Worker.

import { FACTS } from "./data.js";

const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
const PREFIXES = "והשבלמכ";

// Words that carry no meaning for matching (and don't count against "understood").
const STOP_RAW = new Set([
  // Hebrew
  "מה", "הסיכוי", "סיכוי", "הסיכויים", "סיכויים", "הסבירות", "סבירות", "אני", "אתה", "את", "אנחנו", "הוא", "היא", "הם", "זה", "זו", "זאת",
  "של", "שלי", "שלך", "שלו", "שלה", "עם", "על", "אל", "כל", "גם", "רק", "או", "אם", "כי", "יש", "יהיה", "תהיה", "יהיו", "להיות", "היה", "הייתה",
  "אותי", "אותו", "אותה", "לי", "לך", "לו", "לה", "בי", "בו", "בה", "מישהו", "מישהי", "אדם", "בן אדם", "פעם", "כמה", "באמת", "ממש", "בכלל",
  "שאני", "שאתה", "שהוא", "שהיא", "שזה", "שיש", "שיהיה", "שתהיה", "שאת", "שהם", "ושל", "שלנו", "אצלי", "מישהו", "שמישהו", "אהיה", "שאהיה", "נהיה", "תהיי", "אוכל", "אצליח", "יצא", "יצליח", "יקרה", "שיקרה", "לקרות", "קורה", "עד", "כדי", "לפי", "ככה", "כך", "בערך", "איזה", "מתי", "למה",
  // English
  "what", "whats", "are", "is", "the", "odds", "odd", "chance", "chances", "probability", "likelihood", "of", "that", "a", "an", "i", "you", "we",
  "he", "she", "they", "it", "my", "your", "me", "will", "would", "be", "being", "been", "to", "in", "on", "at", "by", "for", "with", "and", "or",
  "get", "gets", "getting", "having", "have", "has", "do", "does", "someone", "somebody", "person", "ever", "really", "actually", "happen",
  "happens", "happening", "this", "any", "some", "there", "was", "were", "if", "become", "becoming", "find", "finding", "guess", "guessing",
  "win", "winning", "catch", "catching", "making", "make", "using", "one", "an", "ever", "before", "so", "just",
  // generic Hebrew verbs and fillers
  "לקבל", "לנחש", "למצוא", "לזכות", "לתפוס", "אקבל", "אנחש", "אמצא", "אזכה", "אתפוס", "אשלוף", "אענה", "אעשה", "אקלע", "אנצח", "אראה", "אתקבל", "ייצא", "תהיה", "יהיו", "אכנס", "כשאני", "אמות", "im", "dealt", "get", "gets", "אחד", "אחת", "היתה", "כבר", "אי", "הזה", "הזאת", "בחיים", "שבחיים",
]);

const STOP = new Set([...STOP_RAW].map((w) => normalize(w)));

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // niqqud and cantillation
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/['"`׳״’‘“”]/g, "")
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Drop the "what are the odds" opener if the person typed it themselves.
const OPENERS = [
  /^מה (?:ה)?(?:סיכויימ|סיכויים|סיכוי|סבירות)\s*/, /^(?:what s|what are|whats|what is) the (?:odds|chances?|probability|likelihood)\s*/,
  /^(?:odds|chances?)\s*/,
];
export function stripOpener(normalized) {
  let s = normalized;
  for (const re of OPENERS) s = s.replace(re, "");
  return s.trim();
}

function variants(token) {
  const out = [token];
  if (/[א-ת]/.test(token)) {
    let t = token;
    for (let i = 0; i < 3 && t.length > 2 && PREFIXES.includes(t[0]); i++) {
      t = t.slice(1);
      out.push(t);
    }
  } else if (/^[a-z]+$/.test(token) && token.length > 3) {
    if (token.endsWith("ies")) out.push(token.slice(0, -3) + "y");
    else if (token.endsWith("es")) out.push(token.slice(0, -2), token.slice(0, -1));
    else if (token.endsWith("s")) out.push(token.slice(0, -1));
  }
  return out;
}

// Compile keywords once: { words: [...], prefix: bool }
const compiled = new WeakMap();
function compileKeyword(kw) {
  const prefix = kw.endsWith("*");
  const words = normalize(prefix ? kw.slice(0, -1) : kw).split(" ").filter(Boolean);
  return { words, prefix };
}
function compileFact(f) {
  let c = compiled.get(f);
  if (!c) {
    c = {
      groups: f.k.map((g) => g.map(compileKeyword)),
      optional: (f.o || []).map(compileKeyword),
      exclude: (f.x || []).map(compileKeyword),
    };
    compiled.set(f, c);
  }
  return c;
}

function wordMatches(tokenVariants, word, prefix) {
  for (const v of tokenVariants) {
    if (v === word) return true;
    if (prefix && word.length >= 2 && v.startsWith(word)) return true;
  }
  return false;
}

// Returns the indexes of the question tokens this keyword covers, or null.
function matchKeyword(tokens, tvars, kw) {
  const n = kw.words.length;
  if (n === 0) return null;
  for (let i = 0; i + n <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      const last = j === n - 1;
      // any word may carry a prefix letter (שיום ההולדת); only the last may be a stem
      const vs = tvars[i + j];
      if (!wordMatches(vs, kw.words[j], kw.prefix && last)) { ok = false; break; }
    }
    if (ok) return Array.from({ length: n }, (_, j) => i + j);
  }
  return null;
}

export function tokenize(question) {
  return stripOpener(normalize(question)).split(" ").filter(Boolean);
}

function isContent(token) {
  if (STOP.has(token)) return false;
  // "שאקבל", "ושזה": a stop word behind ש or ו
  if (/^[שו][\u05D0-\u05EA]{2,}/.test(token) && STOP.has(token.slice(1))) return false;
  return token.length > 1 || /\d/.test(token);
}

/**
 * Score every fact against the question.
 * Returns [{ fact, groups, matched, coverage, score }] best first.
 *   matched:  how many keyword groups matched (of `groups`)
 *   coverage: share of the question's meaningful words that were understood
 */
export function rank(question, facts = FACTS) {
  const tokens = tokenize(question);
  if (!tokens.length) return [];
  const tvars = tokens.map(variants);
  const content = tokens.map(isContent);
  const contentCount = content.filter(Boolean).length || 1;
  const results = [];

  for (const fact of facts) {
    const c = compileFact(fact);
    const covered = new Set();
    let matched = 0;
    for (const group of c.groups) {
      let hit = false;
      for (const kw of group) {
        const idx = matchKeyword(tokens, tvars, kw);
        if (idx) { hit = true; idx.forEach((i) => covered.add(i)); }
      }
      if (hit) matched++;
    }
    if (!matched) continue;
    for (const kw of c.optional) {
      const idx = matchKeyword(tokens, tvars, kw);
      if (idx) idx.forEach((i) => covered.add(i));
    }
    let understood = 0;
    covered.forEach((i) => { if (content[i]) understood++; });
    const coverage = Math.min(1, understood / contentCount);
    const groups = c.groups.length;
    // words that mean it's a different question ("five-leaf clover", "a lunar eclipse")
    const excluded = c.exclude.some((kw) => matchKeyword(tokens, tvars, kw));
    const full = matched === groups && !excluded;
    const score = (full ? 10 : 0) + (matched / groups) * 4 + groups * 0.5 + coverage * 3;
    results.push({ fact, groups, matched: excluded ? Math.min(matched, groups - 1) : matched, coverage, score });
  }
  return results.sort((a, b) => b.score - a.score);
}

// How sure we must be to answer with a checked fact instead of asking the AI.
export const CONFIDENT_COVERAGE = 0.5;

/**
 * The best checked answer, if we're confident it's what was asked.
 * Returns { fact, related } where fact may be null; related are other close facts.
 */
export function findFact(question, facts = FACTS) {
  const ranked = rank(question, facts);
  const best = ranked[0];
  const confident = best && best.matched === best.groups && best.coverage >= CONFIDENT_COVERAGE;
  const related = ranked
    .filter((r) => (!confident || r !== best) && (r.matched === r.groups || r.matched >= 1) && r.coverage > 0)
    .slice(0, 4)
    .map((r) => r.fact);
  return { fact: confident ? best.fact : null, related, best: best || null };
}

export function factById(id, facts = FACTS) {
  return facts.find((f) => f.id === id) || null;
}

// Questions about hurting oneself get a caring answer, never a number.
const CARE = [
  "להתאבד", "התאבדות", "אתאבד", "יתאבד", "תתאבד", "לפגוע בעצמי", "אפגע בעצמי", "לשים קץ", "לסיים את החיים", "לא רוצה לחיות", "בא לי למות",
  "רוצה למות", "ארצה למות", "שארצה למות", "suicide", "suicidal", "kill myself", "killing myself", "end my life", "self harm", "selfharm", "hurt myself", "want to die",
];
const CARE_N = CARE.map(normalize);
export function needsCare(question) {
  const n = " " + normalize(question) + " ";
  return CARE_N.some((c) => n.includes(" " + c + " ") || n.includes(" " + c) || n.includes("ש" + c));
}
