// Brand catalogs: every product on the brand stores in catalog/brands.json,
// built nightly by tools/crawl-catalog.mjs. A scan that names a brand looks the
// piece up here and links to its page on the brand's own site, with price,
// sizes in stock and the date the stock was read. Shared by the crawler (Node)
// and the site.
import { CONFIG } from "./config.js";

// ---------- names ----------

/** Lower case, no accents, letters and digits only: "Stüssy" and "STUSSY" are both "stussy". */
export const foldName = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const STOP = new Set(["the", "and", "with", "for", "in", "of", "a", "an", "by", "x", "new", "mens", "men", "womens", "women", "unisex"]);
/** Search words of a text: folded, split, without filler words. */
export function words(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

// ---------- crawling ----------

/** Does robots.txt let any crawler fetch `pathname`? (Only the `User-agent: *` group is read.) */
export function robotsAllows(robots, pathname) {
  let applies = false;
  let allowed = true;
  let best = -1;
  for (const raw of String(robots || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (/^user-agent$/i.test(key)) applies = value.trim() === "*";
    else if (applies && /^(dis)?allow$/i.test(key) && value) {
      const rule = value.trim().replace(/\*$/, "");
      if (pathname.startsWith(rule) && rule.length > best) {
        best = rule.length;
        allowed = /^allow$/i.test(key);
      }
    }
  }
  return allowed;
}

/** The parts of a Shopify product (from /products.json) a scan needs, in few bytes. */
export function compactProduct(p) {
  if (!p || typeof p.handle !== "string" || typeof p.title !== "string") return null;
  const vars = Array.isArray(p.variants) ? p.variants : [];
  const opts = Array.isArray(p.options) ? p.options : [];
  const at = (re) => opts.findIndex((o) => re.test((o && o.name) || ""));
  const ci = at(/colou?r|farbe|couleur|kleur|צבע/i);
  const si = at(/size|taglia|talla|grö(ss|ß)e|maat|מידה/i);
  const opt = (v, i) => (i >= 0 && v ? v[`option${i + 1}`] : null);
  const uniq = (list) => [...new Set(list.filter(Boolean).map(String))];
  const prices = vars.map((v) => parseFloat(v.price)).filter(Number.isFinite);
  const compare = vars.map((v) => parseFloat(v.compare_at_price)).filter(Number.isFinite);
  const price = prices.length ? Math.min(...prices) : null;
  const was = compare.length ? Math.max(...compare) : null;
  const out = {
    h: p.handle,
    t: p.title.slice(0, 140),
    a: vars.some((v) => v.available),
  };
  if (p.product_type) out.ty = String(p.product_type).slice(0, 60);
  if (p.vendor) out.v = String(p.vendor).slice(0, 60);
  const colors = uniq(vars.map((v) => opt(v, ci))).slice(0, 12);
  if (colors.length) out.c = colors;
  const sizes = uniq(vars.filter((v) => v.available).map((v) => opt(v, si))).slice(0, 20);
  if (sizes.length) out.s = sizes;
  if (price != null) out.p = price;
  if (was != null && price != null && was > price) out.cp = was;
  const img = Array.isArray(p.images) && p.images[0] && p.images[0].src;
  if (img) out.i = String(img).replace(/^https?:/, "");
  return out;
}

// ---------- searching ----------

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}
/** Same word, or one letter off for longer words ("threads" and "threadds"). */
const sameWord = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && Math.abs(a.length - b.length) <= 1 && editDistance(a, b) <= 1);

// What each category is called in English product titles and types.
const CATEGORY_WORDS = {
  top: ["tee", "tshirt", "shirt", "top", "polo", "sweater", "sweatshirt", "hoodie", "crewneck", "knit", "jumper", "longsleeve", "tank", "jersey", "cardigan"],
  outerwear: ["jacket", "coat", "parka", "bomber", "puffer", "vest", "gilet", "blazer", "anorak", "overshirt", "windbreaker", "fleece"],
  bottom: ["pant", "pants", "jean", "jeans", "trouser", "trousers", "short", "shorts", "jogger", "sweatpant", "sweatpants", "cargo", "skirt", "denim"],
  dress: ["dress", "jumpsuit"],
  footwear: ["shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "clog", "loafer", "sandal", "slide", "mule"],
  bag: ["bag", "backpack", "tote", "pouch", "wallet"],
  headwear: ["cap", "hat", "beanie", "bucket", "visor"],
  eyewear: ["sunglasses", "glasses", "eyewear"],
  jewelry: ["ring", "chain", "necklace", "bracelet", "earring"],
  accessory: ["socks", "belt", "scarf", "gloves", "keychain"],
};

/**
 * Rank a catalog's products against what a scan knows about a piece:
 * `name` (product name, weighs most), `query` (more words), `color`,
 * `category`. Rarer words count for more. Returns [{ product, score, cover }],
 * best first; `cover` is the share of the name's words the product has.
 */
export function searchProducts(products, { name = "", query = "", color = "", category = "" } = {}, limit = 8) {
  const docs = products.map((p) => ({ p, w: [...new Set(words(`${p.t} ${p.ty || ""} ${(p.c || []).join(" ")}`))] }));
  const df = new Map();
  for (const d of docs) for (const w of d.w) df.set(w, (df.get(w) || 0) + 1);
  const idf = (w) => Math.log((docs.length + 1) / ((df.get(w) || 0) + 1)) + 1;
  const nameWords = [...new Set(words(name))];
  const terms = new Map();
  for (const w of nameWords) terms.set(w, 2);
  for (const w of words(query)) if (!terms.has(w)) terms.set(w, 1);
  for (const w of words(color)) if (!terms.has(w)) terms.set(w, 0.7);
  const catWords = CATEGORY_WORDS[category] || [];
  const out = [];
  for (const d of docs) {
    let score = 0;
    let named = 0;
    for (const [t, weight] of terms) {
      const hit = d.w.find((w) => sameWord(w, t));
      if (hit) {
        score += weight * idf(hit);
        if (nameWords.includes(t)) named++;
      }
    }
    if (catWords.length && d.w.some((w) => catWords.includes(w) || catWords.includes(w.replace(/s$/, "")))) score *= 1.25;
    if (score > 0) out.push({ product: d.p, score, cover: nameWords.length ? named / nameWords.length : 0 });
  }
  return out.sort((a, b) => b.score - a.score || Number(b.product.a) - Number(a.product.a)).slice(0, limit);
}

// ---------- loading ----------

const base = () => {
  const b = CONFIG.catalogBase || "";
  return b && !b.endsWith("/") ? b + "/" : b;
};
let indexPromise = null;
const brandFiles = new Map();

async function getJson(url) {
  const res = await fetch(url, { cache: "default" });
  if (!res.ok) throw new Error(`catalog: HTTP ${res.status}`);
  return res.json();
}

/** The catalog index, or null when there is none (no catalogBase, offline, not built yet). */
export function catalogIndex() {
  if (!indexPromise) indexPromise = base() ? getJson(base() + "index.json").catch(() => null) : Promise.resolve(null);
  return indexPromise;
}

function loadBrand(id) {
  if (!brandFiles.has(id)) brandFiles.set(id, getJson(base() + `${id}.json`).catch(() => null));
  return brandFiles.get(id);
}

/** Catalog ids that sell `brandName`: the brand's own store first, then stores that stock it. */
export function catalogsFor(index, brandName) {
  const key = foldName(brandName);
  if (!index || !key) return [];
  const own = index.brands.filter((b) => b.ok && [b.name, ...(b.aliases || [])].some((n) => foldName(n) === key || (foldName(n).length >= 4 && key.startsWith(foldName(n)))));
  const ids = own.map((b) => b.id);
  for (const id of (index.vendors && index.vendors[key]) || []) if (!ids.includes(id)) ids.push(id);
  return ids;
}

/**
 * Products that may be this piece, from every catalog that sells its brand.
 * Resolves [{ product, score, cover, store }], best first; [] when the brand
 * isn't indexed.
 */
export async function findProducts(piece, limit = 8) {
  const index = await catalogIndex();
  const ids = catalogsFor(index, piece.brand);
  if (!ids.length) return [];
  const cats = (await Promise.all(ids.slice(0, 3).map(loadBrand))).filter(Boolean);
  const key = foldName(piece.brand);
  const found = [];
  for (const cat of cats) {
    const own = [cat.name, ...((index.brands.find((b) => b.id === cat.id) || {}).aliases || [])].some((n) => foldName(n) === key || key.startsWith(foldName(n)));
    // in a store that sells many brands, only that brand's products
    const pool = own ? cat.products : cat.products.filter((p) => foldName(p.v) === key);
    for (const r of searchProducts(pool, piece, limit)) found.push({ ...r, store: cat, own });
  }
  // the brand's own store wins a tie with a retailer
  return found.sort((a, b) => b.score - a.score || Number(b.own) - Number(a.own)).slice(0, limit);
}

/** A found product as a scan match (the shape the deep scan uses). */
export function toMatch({ product: p, store, own }, kind = "original") {
  const date = new Date(store.updatedAt);
  const when = isNaN(date) ? "" : date.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
  return {
    title: p.t,
    brand: p.v || store.name,
    shop: own ? `${store.name}, האתר הרשמי` : store.name,
    url: `https://${store.domain}/products/${p.h}`,
    price: p.p ?? null,
    currency: store.currency || null,
    availability: p.a ? "in_stock" : "sold_out",
    sizes_in_stock: p.s || [],
    match: kind,
    note: when ? `מלאי לפי האתר, ${when}` : null,
    image: p.i ? `https:${p.i}` : null,
    catalog: true,
  };
}
