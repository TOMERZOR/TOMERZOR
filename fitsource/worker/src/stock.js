// Stock checker. Reads a product page and works out whether it can be bought
// right now, without any AI: Shopify's product JSON first, then schema.org
// JSON-LD, then microdata / Open Graph meta tags. Returns null fields when a
// shop gives nothing away, so the caller can keep what it already knew.

export const AVAILABILITY = ["in_stock", "low_stock", "sold_out", "preorder", "unknown"];

const SCHEMA_MAP = {
  instock: "in_stock",
  onlineonly: "in_stock",
  instoreonly: "in_stock",
  limitedavailability: "low_stock",
  outofstock: "sold_out",
  soldout: "sold_out",
  discontinued: "sold_out",
  preorder: "preorder",
  presale: "preorder",
  backorder: "preorder",
  // Open Graph spellings
  oos: "sold_out",
  "out of stock": "sold_out",
  "in stock": "in_stock",
  available: "in_stock",
  pending: "preorder",
};

/** Map any availability spelling (schema.org URL, OG value, free text) to ours. */
export function normalizeAvailability(value) {
  if (value == null) return "unknown";
  let v = String(value).trim().toLowerCase();
  v = v.replace(/^https?:\/\/schema\.org\//, "").replace(/^schema:/, "");
  if (SCHEMA_MAP[v]) return SCHEMA_MAP[v];
  const compact = v.replace(/[\s_-]+/g, "");
  if (SCHEMA_MAP[compact]) return SCHEMA_MAP[compact];
  if (AVAILABILITY.includes(v)) return v;
  return "unknown";
}

/** Combine several offers/variants into one product-level status. */
export function combineAvailability(list) {
  const set = new Set(list.filter((a) => a && a !== "unknown"));
  if (set.size === 0) return "unknown";
  if (set.has("in_stock")) return "in_stock";
  if (set.has("low_stock")) return "low_stock";
  if (set.has("preorder")) return "preorder";
  return "sold_out";
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ---------- Shopify ----------

/** Shopify product URLs end in /products/<handle>; the .js twin is public JSON. */
export function shopifyJsonUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const m = u.pathname.match(/^(.*\/products\/[^/?#.]+)/);
  if (!m) return null;
  return `${u.origin}${m[1]}.js`;
}

/** Parse Shopify's /products/<handle>.js payload. Prices there are in cents. */
export function parseShopifyProduct(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.variants)) return null;
  const variants = json.variants.map((v) => ({
    label: String(v.public_title || v.title || v.option1 || "").trim(),
    available: v.available === true,
  }));
  const anyAvailable = json.available === true || variants.some((v) => v.available);
  const total = variants.length;
  const open = variants.filter((v) => v.available).length;
  let availability = anyAvailable ? "in_stock" : "sold_out";
  if (anyAvailable && total >= 3 && open / total <= 0.25) availability = "low_stock";
  const priceCents = toNumber(json.price);
  return {
    availability,
    price: priceCents == null ? null : Math.round(priceCents) / 100,
    currency: null, // .js does not carry it; the page or caller fills it in
    title: json.title || null,
    sizes: total > 1 ? variants.filter((v) => v.label && v.label !== "Default Title") : [],
    source: "shopify",
  };
}

// ---------- JSON-LD ----------

function* walkLd(node) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walkLd(n);
    return;
  }
  if (typeof node !== "object") return;
  yield node;
  if (node["@graph"]) yield* walkLd(node["@graph"]);
  if (node.hasVariant) yield* walkLd(node.hasVariant);
}

function hasType(node, type) {
  const t = node["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function offersOf(node) {
  const o = node.offers;
  if (!o) return [];
  const list = Array.isArray(o) ? o : [o];
  const out = [];
  for (const offer of list) {
    if (offer && Array.isArray(offer.offers)) out.push(...offer.offers);
    else if (offer) out.push(offer);
  }
  return out;
}

export function extractJsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim().replace(/^<!--/, "").replace(/-->$/, "");
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Some shops ship invalid JSON-LD (trailing commas, raw newlines); skip it.
    }
  }
  return blocks;
}

export function parseJsonLd(html) {
  const products = [];
  for (const block of extractJsonLdBlocks(html)) {
    for (const node of walkLd(block)) {
      if (hasType(node, "Product") || hasType(node, "ProductGroup")) products.push(node);
    }
  }
  if (products.length === 0) return null;

  const statuses = [];
  const sizes = [];
  let price = null;
  let currency = null;
  let title = null;
  for (const p of products) {
    title = title || p.name || null;
    for (const offer of offersOf(p)) {
      const a = normalizeAvailability(offer.availability);
      statuses.push(a);
      const offerPrice = toNumber(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
      if (price == null && offerPrice != null) price = offerPrice;
      currency = currency || offer.priceCurrency || offer.priceSpecification?.priceCurrency || null;
      const label = offer.name || offer.sku || null;
      if (p["@type"] !== "ProductGroup" && label && offersOf(p).length > 1) {
        sizes.push({ label: String(label), available: a === "in_stock" || a === "low_stock" });
      }
    }
  }
  const availability = combineAvailability(statuses);
  if (availability === "unknown" && price == null) return null;
  return { availability, price, currency, title, sizes, source: "jsonld" };
}

// ---------- meta tags ----------

function metaContent(html, attr, name) {
  const re = new RegExp(
    `<meta[^>]+${attr}\\s*=\\s*["']${name}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re);
  if (!tag) return null;
  const c = tag[0].match(/content\s*=\s*["']([^"']*)["']/i);
  return c ? c[1] : null;
}

export function parseMeta(html) {
  const raw =
    metaContent(html, "property", "product:availability") ||
    metaContent(html, "property", "og:availability") ||
    metaContent(html, "itemprop", "availability");
  let availability = normalizeAvailability(raw);
  if (availability === "unknown") {
    const link = html.match(/<link[^>]+itemprop\s*=\s*["']availability["'][^>]*>/i);
    const href = link && link[0].match(/href\s*=\s*["']([^"']+)["']/i);
    if (href) availability = normalizeAvailability(href[1]);
  }
  const price = toNumber(
    metaContent(html, "property", "product:price:amount") ||
      metaContent(html, "property", "og:price:amount") ||
      metaContent(html, "itemprop", "price"),
  );
  const currency =
    metaContent(html, "property", "product:price:currency") ||
    metaContent(html, "property", "og:price:currency") ||
    metaContent(html, "itemprop", "priceCurrency");
  if (availability === "unknown" && price == null) return null;
  return { availability, price, currency: currency || null, title: null, sizes: [], source: "meta" };
}

/** Best guess from a page's HTML alone. */
export function parseProductHtml(html) {
  return parseJsonLd(html) || parseMeta(html);
}

// ---------- network ----------

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 FitSourceStockCheck/1.0",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.8",
};

// Wildcard DNS services that map any name to any IP (e.g. 127.0.0.1.nip.io).
const WILDCARD_DNS = ["nip.io", "sslip.io", "xip.io", "localtest.me", "lvh.me", "traefik.me", "localhost.run"];

/** Only public http(s) hosts; no localhost, IP literals or internal names. */
export function isSafePublicUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  if (u.port && !["80", "443"].includes(u.port)) return false;
  const host = u.hostname.toLowerCase().replace(/\.+$/, ""); // "localhost." is localhost
  if (!host.includes(".")) return false;
  if (host === "localhost" || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[") || host.includes(":")) return false;
  if (/(^|\.)\d+[.-]\d+[.-]\d+[.-]\d+\./.test(host) || WILDCARD_DNS.some((d) => host === d || host.endsWith("." + d))) return false;
  return true;
}

/** Fetch with a timeout, following at most 4 redirects and re-checking every hop. */
async function fetchWithTimeout(fetchImpl, url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetchImpl(current, { headers: BROWSER_HEADERS, redirect: "manual", signal: ctrl.signal });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!location) return res;
      const next = new URL(location, current).href;
      if (!isSafePublicUrl(next)) throw new TypeError("redirect to a disallowed address");
      current = next;
    }
    throw new TypeError("too many redirects");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check one product URL. Never throws: on any failure it returns
 * { availability: "unknown", error }.
 */
export async function checkStock(url, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const checkedAt = new Date().toISOString();
  if (!isSafePublicUrl(url)) return { url, availability: "unknown", error: "invalid_url", checked_at: checkedAt };

  const jsonUrl = shopifyJsonUrl(url);
  if (jsonUrl) {
    try {
      const res = await fetchWithTimeout(fetchImpl, jsonUrl, timeoutMs);
      const type = res.headers.get("content-type") || "";
      if (res.ok && /json|javascript/.test(type)) {
        const parsed = parseShopifyProduct(await res.json());
        if (parsed) return { url, ...parsed, checked_at: checkedAt };
      }
    } catch {
      // fall through to the HTML page
    }
  }

  try {
    const res = await fetchWithTimeout(fetchImpl, url, timeoutMs);
    if (res.status === 404 || res.status === 410) {
      return { url, availability: "sold_out", price: null, currency: null, sizes: [], source: "http_" + res.status, checked_at: checkedAt };
    }
    if (!res.ok) return { url, availability: "unknown", error: "http_" + res.status, checked_at: checkedAt };
    const html = (await res.text()).slice(0, 1_500_000);
    const parsed = parseProductHtml(html);
    if (parsed) return { url, ...parsed, checked_at: checkedAt };
    return { url, availability: "unknown", error: "no_product_data", checked_at: checkedAt };
  } catch (err) {
    return { url, availability: "unknown", error: err && err.name === "AbortError" ? "timeout" : "fetch_failed", checked_at: checkedAt };
  }
}
