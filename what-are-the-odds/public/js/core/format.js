// Turning a probability into words people feel: "51%", "1 in 16.3 million", "0".

const WORDS = {
  he: { thousand: "אלף", million: "מיליון", billion: "מיליארד", trillion: "טריליון", quadrillion: "קוודריליון", quintillion: "קווינטיליון", in: "מתוך", one: "1" },
  en: { thousand: "thousand", million: "million", billion: "billion", trillion: "trillion", quadrillion: "quadrillion", quintillion: "quintillion", in: "in", one: "1" },
};

function trim(n, digits) {
  return Number(n.toFixed(digits)).toLocaleString("en-US", { maximumFractionDigits: digits });
}

// 16273488 -> { text: "16.3 million" }, 8e67 -> { text: "8", exp: 67 } (shown as 8 × 10^67)
export function bigNumber(n, lang = "he") {
  const w = WORDS[lang] || WORDS.en;
  if (!isFinite(n)) return { text: "∞" };
  n = Number(n.toPrecision(12)); // 1 / 1e-9 is 999999999.9999999
  if (n < 10) return { text: trim(n, n < 1.5 ? 2 : 1) };
  if (n < 1e5) return { text: Math.round(n).toLocaleString("en-US") };
  const scales = [
    [1e18, w.quintillion], [1e15, w.quadrillion], [1e12, w.trillion], [1e9, w.billion], [1e6, w.million],
  ];
  if (n >= 1e21) {
    const exp = Math.floor(Math.log10(n));
    const mant = n / 10 ** exp;
    return { text: trim(mant, 1), exp };
  }
  for (const [v, name] of scales) {
    if (n >= v) {
      const x = n / v;
      return { text: `${trim(x, x < 100 ? 1 : 0)} ${name}` };
    }
  }
  // 100,000 .. 999,999: "650 thousand" reads worse than 649,740
  return { text: Math.round(n).toLocaleString("en-US") };
}

function percent(p) {
  const pct = p * 100;
  if (pct >= 99.5 && p < 1) return ">99%";
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${trim(pct, 1)}%`;
  if (pct >= 0.01) return `${trim(pct, 2)}%`;
  // tiny: 0.0000061%
  const digits = Math.min(20, Math.ceil(-Math.log10(pct)) + 1);
  if (digits > 12) return null;
  return `${pct.toFixed(digits).replace(/0+$/, "")}%`;
}

/**
 * Everything the result card shows for a probability.
 * {
 *   main:  { kind: "percent"|"oneIn"|"zero"|"certain", text, exp? }
 *   alt:   secondary line text (the other form), may be ""
 *   oneIn: number (1/p) or null
 *   log:   log10(p), -Infinity for 0
 * }
 */
export function describe(p, lang = "he") {
  const he = lang === "he";
  if (!(p >= 0)) p = 0;
  if (p > 1) p = 1;
  if (p === 0) {
    return { main: { kind: "zero", text: "0%" }, alt: "", oneIn: null, log: -Infinity };
  }
  if (p === 1) {
    return { main: { kind: "certain", text: "100%" }, alt: "", oneIn: 1, log: 0 };
  }
  const oneIn = 1 / p;
  const n = bigNumber(oneIn, lang);
  const ratio = he ? `1 מתוך ${n.text}` : `1 in ${n.text}`;
  const pct = percent(p);
  if (p >= 0.01) {
    // "51%", alt "about 1 in 2". Odds near even read better as "about 1 in 2".
    // a second number only when it says something the first doesn't: small percentages
    const alt = p < 0.1 ? (he ? "בערך " : "about ") + ratio : "";
    return { main: { kind: "percent", text: pct }, alt, oneIn, log: Math.log10(p) };
  }
  return {
    main: { kind: "oneIn", text: n.text, exp: n.exp },
    alt: "",
    oneIn,
    log: Math.log10(p),
  };
}

// Plain text version, for sharing and for screen readers.
export function plain(p, lang = "he") {
  const d = describe(p, lang);
  const he = lang === "he";
  if (d.main.kind === "zero") return he ? "0% (בלתי אפשרי)" : "0% (impossible)";
  if (d.main.kind === "certain") return "100%";
  if (d.main.kind === "percent") return d.alt ? `${d.main.text} (${d.alt})` : d.main.text;
  const num = d.main.exp != null ? `${d.main.text}×10^${d.main.exp}` : d.main.text;
  return he ? `1 מתוך ${num}` : `1 in ${num}`;
}

// Familiar odds to compare against, most likely first.
export const LANDMARKS = [
  { id: "coin-heads", p: 1 / 2, he: "עץ בהטלת מטבע", en: "heads on a coin flip", short: { he: "מטבע", en: "Coin" } },
  { id: "dice-six", p: 1 / 6, he: "6 בקובייה", en: "rolling a six" },
  { id: "left-handed", p: 1 / 10, he: "להיות שמאלי", en: "being left-handed" },
  { id: "double-six", p: 1 / 36, he: "שש-שש בשתי קוביות", en: "rolling double six" },
  { id: "ten-heads", p: 1 / 1024, he: "10 פעמים עץ ברצף", en: "10 heads in a row" },
  { id: "four-leaf", p: 1 / 5000, he: "תלתן בן ארבעה עלים", en: "a four-leaf clover", short: { he: "תלתן", en: "Clover" } },
  { id: "royal-flush", p: 1 / 649740, he: "רויאל פלאש בפוקר", en: "a royal flush" },
  { id: "lightning-year", p: 1 / 1222000, he: "פגיעת ברק השנה", en: "lightning this year", short: { he: "ברק", en: "Lightning" } },
  { id: "lotto-israel", p: 1 / 16273488, he: "זכייה בלוטו", en: "winning the Israeli Lotto", short: { he: "לוטו", en: "Lotto" } },
  { id: "powerball", p: 1 / 292201338, he: "ג׳קפוט בפאוורבול", en: "the Powerball jackpot" },
  { id: "eight-billion", p: 1 / 8.2e9, he: "לבחור אותך באקראי מכל בני האדם", en: "picking you at random from all humans" },
];

// "Less likely than rolling a six, more likely than a four-leaf clover."
export function compare(p, lang = "he", selfId = null) {
  const he = lang === "he";
  if (p === 0 || p === 1) return "";
  const list = LANDMARKS.filter((l) => l.id !== selfId);
  let above = null; // more likely than p (bigger)
  let below = null;
  for (const l of list) {
    if (l.p >= p) above = l;
    else if (!below) below = l;
  }
  // Hebrew glues "than" (מ) to the word; before a digit or Latin it takes a maqaf
  const than = (l) => (he ? (/^[0-9A-Za-z]/.test(l.he) ? "מ־" : "מ") + l.he : l.en);
  const close = (a) => a && Math.abs(Math.log10(a.p) - Math.log10(p)) < 0.08;
  if (close(above)) return he ? `בערך כמו ${above.he}` : `About the same as ${above.en}`;
  if (close(below)) return he ? `בערך כמו ${below.he}` : `About the same as ${below.en}`;
  if (above && below) {
    return he
      ? `פחות סביר ${than(above)}, אבל יותר סביר ${than(below)}`
      : `Less likely than ${above.en}, but more likely than ${below.en}`;
  }
  if (above) return he ? `פחות סביר אפילו ${than(above)}` : `Even less likely than ${above.en}`;
  if (below) return he ? `יותר סביר ${than(below)}` : `More likely than ${below.en}`;
  return "";
}
