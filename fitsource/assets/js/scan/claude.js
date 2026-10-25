// Claude in the viewer: when FitSource runs as a claude.ai artifact, the
// `sample` capability lets the viewer's own Claude look at the photo and name
// each piece (brand and model when the photo shows them). No API key and no
// server; it can't browse, so the shop links stay searches. Elsewhere (GitHub
// Pages, a local preview) there is no `window.claude` and this stays off.

const CATEGORIES = ["outerwear", "top", "bottom", "dress", "footwear", "bag", "headwear", "eyewear", "jewelry", "accessory"];
const CONFIDENCE = ["exact", "likely", "similar"];

let samplePromise = null;

/** The viewer's Claude when this page can send it images, else null. */
export function viewerClaude() {
  if (!samplePromise) {
    samplePromise = (async () => {
      if (typeof window === "undefined" || !window.claude || typeof window.claude.use !== "function") return null;
      const sample = await window.claude.use("sample");
      if (!sample) return null;
      const limits = await sample.limits().catch(() => null);
      return limits && limits.images ? sample : null;
    })().catch(() => null);
  }
  return samplePromise;
}

export class ClaudeScanError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Hebrew copy for the `sample` failure codes a shopper can act on. */
function errorFor(e) {
  const code = (e && e.code) || "upstream_error";
  const copy = {
    not_granted: "כדי לסרוק כאן צריך לאשר ל־FitSource להשתמש ב־Claude. אפשר לשנות את זה בהרשאות של הדף.",
    sampling_disabled: "Claude לא זמין בחשבון הזה.",
    rate_limited: "הגעתם למגבלת השימוש ב־Claude כרגע. נסו שוב בעוד כמה דקות.",
    session_expired: "צריך להתחבר מחדש ל־Claude ולנסות שוב.",
    image_rejected: "Claude לא הצליח לקרוא את התמונה. נסו צילום מסך בפורמט JPEG או PNG.",
    refused: "לא ניתן לסרוק את התמונה הזו.",
    invalid_json: "התשובה של Claude לא הגיעה שלמה. נסו שוב.",
  }[code];
  return new ClaudeScanError(code, copy || "הזיהוי עם Claude נכשל. נסו שוב.");
}

const RULES = `You are the sourcing engine behind FitSource, an Israeli site. Shoppers upload a photo of an outfit they saw online, and you name each piece so they can find it in shops.

- Look at the photo. List the clearly visible clothing items and accessories the person wears or carries, most important first; three to six is typical. Skip anything you can only guess at, and skip things that aren't part of the outfit (a shop's paper bag, the background).
- For each item, look for real evidence of what it is: logos, labels, prints, signature design details (a silhouette, sole, buckle or stitching that identifies a model). Name a brand or product only when that evidence supports it; otherwise use null. Read printed text carefully: a brand's name or a collection name on a print is strong evidence.
- Write vibe, summary, label, color and search_query in natural, everyday Israeli Hebrew (e.g. label "ז'קט בומבר קצר מעור", color "שחור"). Keep brand and product_name exactly as the brand writes them. search_query_en is the English search most likely to find this exact item: brand, product name and colour when known, else a precise description.
- Boxes use a 0 to 1000 scale on both axes, origin at the top left of the image: x and y are the box's top-left corner, w and h its size. Approximate is fine.`;

const FORMAT = `Reply with only this JSON, no other text:
{"vibe": "two to four Hebrew words naming the style", "summary": "one Hebrew sentence describing the fit", "items": [{"label": "...", "category": "${CATEGORIES.join("|")}", "color": "...", "brand": null, "product_name": null, "confidence": "exact|likely|similar", "box": {"x": 0, "y": 0, "w": 0, "h": 0}, "search_query": "...", "search_query_en": "..."}]}
confidence: exact when the specific product is identified, likely for a strong guess, similar when only the kind of item is known.`;

const str = (v, max = 160) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null);
const clamp = (v) => Math.min(1000, Math.max(0, Math.round(Number(v) || 0)));

/** Check and tidy one item from Claude's answer; null when it isn't usable. */
export function cleanItem(it) {
  if (!it || typeof it !== "object") return null;
  const label = str(it.label, 80);
  if (!label) return null;
  const b = it.box && typeof it.box === "object" ? it.box : {};
  const x = clamp(b.x), y = clamp(b.y);
  return {
    label,
    category: CATEGORIES.includes(it.category) ? it.category : "accessory",
    color: str(it.color, 40) || "",
    brand: str(it.brand, 60),
    product_name: str(it.product_name, 100),
    confidence: CONFIDENCE.includes(it.confidence) ? it.confidence : "similar",
    box: { x, y, w: Math.max(20, Math.min(1000 - x, clamp(b.w))), h: Math.max(20, Math.min(1000 - y, clamp(b.h))) },
    search_query: str(it.search_query, 120) || label,
    search_query_en: str(it.search_query_en, 120) || "",
  };
}

/** Identify every piece in the photo. Resolves { vibe, summary, items }. */
export async function claudeScan(sample, blob, { onProgress = () => {}, signal } = {}) {
  onProgress({ t: "status", msg: "Claude מסתכל על הלוק" });
  let found = 0;
  try {
    const data = await sample.json(`${RULES}\n\nThe attached image is the outfit photo.\n\n${FORMAT}`, {
      images: [blob],
      signal,
      onText: ({ text }) => {
        const n = (text.match(/"label"/g) || []).length;
        if (n === 1 && !found) onProgress({ t: "status", msg: "כותבים את הפריטים" });
        if (n > found) onProgress({ t: "found", n: (found = n) });
      },
    });
    const items = Array.isArray(data && data.items) ? data.items.map(cleanItem).filter(Boolean).slice(0, 8) : [];
    return { vibe: str(data && data.vibe, 40) || "", summary: str(data && data.summary, 200) || "", items };
  } catch (e) {
    if (e && e.code === "cancelled") throw new DOMException("Scan cancelled", "AbortError");
    throw errorFor(e);
  }
}

/** Identify the one piece inside a crop the shopper drew. Resolves an item or null. */
export async function claudeRegion(sample, crop) {
  try {
    const data = await sample.json(`${RULES}\n\nThe attached image is a crop the shopper drew around ONE item of the outfit. Name just that item; its box is the whole image (x 0, y 0, w 1000, h 1000).\n\n${FORMAT}`, { images: [crop] });
    const items = Array.isArray(data && data.items) ? data.items.map(cleanItem).filter(Boolean) : [];
    return items[0] || null;
  } catch (e) {
    throw errorFor(e);
  }
}

/**
 * Which catalog product each piece is. `pieces` is [{ item, candidates }]
 * (candidates from the brand catalogs). Claude looks at the photo again and
 * picks, per piece, the candidate that is the same product, or null.
 * Resolves an array of candidate indexes (or null), one per piece.
 */
export async function claudePick(sample, blob, pieces, { signal } = {}) {
  const lines = pieces.map(({ item, candidates }, n) => {
    const head = `Piece ${n + 1}: ${item.queryEn || item.name} (brand ${item.brand}${item.productName ? `, looks like "${item.productName}"` : ""})`;
    const list = candidates.map(({ product: p }, k) => `  ${k}: ${p.t}${p.ty ? ` | ${p.ty}` : ""}${p.c ? ` | colours: ${p.c.join(", ")}` : ""}`);
    return [head, ...list].join("\n");
  });
  const prompt = `The attached image is an outfit photo. For each piece below, a search of stores that sell its brand (the brand's own store first) returned candidate products. Pick the candidate that is the same product as the piece in the photo: same design, same print or logo, same colourway. If no candidate is that product, use null; a similar product from the same brand is not a match.

${lines.join("\n\n")}

Reply with only this JSON: {"picks": [one candidate number or null per piece, in order]}`;
  try {
    const data = await sample.json(prompt, { images: [blob], signal });
    const picks = Array.isArray(data && data.picks) ? data.picks : [];
    return pieces.map((p, n) => (Number.isInteger(picks[n]) && picks[n] >= 0 && picks[n] < p.candidates.length ? picks[n] : null));
  } catch (e) {
    if (e && e.code === "cancelled") throw new DOMException("Scan cancelled", "AbortError");
    throw errorFor(e);
  }
}
