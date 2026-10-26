// Hebrew-aware text helpers shared by the browser and the server.

const NIQQUD = /[֑-ׇ]/g;
const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
// One-letter prefixes (and common pairs) glued to Hebrew words: "והסרום", "בקוד", "שהלינק".
const PREFIXES = ["וכש", "וה", "וב", "ול", "ומ", "וש", "שה", "שב", "של", "כש", "מה", "לה", "בה", "ה", "ו", "ב", "ל", "מ", "ש", "כ"];
const HEBREW = /[א-ת]/;

export const STOPWORDS = new Set([
  "של", "את", "על", "עם", "זה", "זו", "זאת", "גם", "אבל", "או", "אם", "כי", "מה", "מי", "איך", "למה", "יש", "אין",
  "אני", "את", "אתה", "הוא", "היא", "אנחנו", "הם", "הן", "לי", "לך", "לו", "לה", "שלי", "שלך", "כל", "כמו", "רק",
  "עוד", "כבר", "פה", "שם", "היי", "הי", "אהלן", "תודה", "בבקשה", "מאוד", "ממש", "סתם", "אז", "ככה", "לא", "כן",
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "it", "for", "on", "with", "this", "that", "hi", "hey",
]);

/** Lowercase, strip niqqud and punctuation, unify final letters, collapse spaces. */
export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(NIQQUD, "")
    .replace(/[׳״'"`]/g, "")
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokens(text) {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

/** The word plus the word with a Hebrew prefix removed, so "והסרום" also matches "סרום". */
export function stems(word) {
  const out = [word];
  if (!HEBREW.test(word)) return out;
  for (const p of PREFIXES) {
    if (word.length - p.length >= 2 && word.startsWith(p)) out.push(word.slice(p.length));
  }
  return out;
}

/** Every token and its stems, for fast lookup. */
export function termSet(text) {
  const set = new Set();
  for (const t of tokens(text)) for (const s of stems(t)) set.add(s);
  return set;
}

/** Does the message contain the phrase, allowing a Hebrew prefix on its first word? */
export function hasPhrase(messageTerms, messageNorm, phrase) {
  const p = normalize(phrase);
  if (!p) return false;
  if (!p.includes(" ")) return messageTerms.has(p);
  if (` ${messageNorm} `.includes(` ${p} `)) return true;
  // multi-word phrase with a prefix glued to the first word ("והקרם לחות")
  const [first, ...rest] = p.split(" ");
  const tail = rest.join(" ");
  const words = messageNorm.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (stems(words[i]).includes(first) && words.slice(i + 1, i + 1 + rest.length).join(" ") === tail) return true;
  }
  return false;
}

/** Content words worth matching on: not a stopword, at least 3 letters. */
export function contentWords(text) {
  return [...new Set(tokens(text).filter((t) => t.length >= 3 && !STOPWORDS.has(t)))];
}

/**
 * Instagram's data export writes UTF-8 bytes as \u00XX escapes, so Hebrew arrives
 * as "×©×××". Re-decode such strings; leave proper text alone.
 */
export function fixMojibake(text) {
  const s = String(text ?? "");
  if (!/[\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s;
  const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return s;
  }
}
