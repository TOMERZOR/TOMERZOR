// Outbound links: shop search URLs and affiliate wrapping.
import { CONFIG } from "./config.js";

const q = (s) => encodeURIComponent(String(s || "").trim());

// Shops Israeli shoppers use. `en: true` shops have English catalogues and get
// the English search words; the rest search in Hebrew.
export const NEW_SHOPS = [
  { id: "google", name: "Google Shopping", url: (s) => `https://www.google.co.il/search?udm=28&hl=iw&gl=il&q=${q(s)}` },
  { id: "terminalx", name: "Terminal X", url: (s) => `https://www.terminalx.com/catalogsearch/result/?q=${q(s)}` },
  { id: "castro", name: "Castro", url: (s) => `https://www.castro.com/catalogsearch/result?q=${q(s)}` },
  { id: "next", name: "Next", url: (s) => `https://www.next.co.il/he/search?w=${q(s)}` },
  { id: "asos", name: "ASOS", en: true, url: (s) => `https://www.asos.com/search/?q=${q(s)}` },
  { id: "aliexpress", name: "AliExpress", en: true, url: (s) => `https://www.aliexpress.com/wholesale?SearchText=${q(s)}` },
];

export const RESALE_SHOPS = [
  { id: "marketplace", name: "Marketplace", url: (s) => `https://www.facebook.com/marketplace/telaviv/search?query=${q(s)}` },
  // Yad2 Market's search URL isn't public; this opens its clothing section.
  { id: "yad2", name: "יד2", url: () => "https://www.yad2.co.il/market/collections/clothing-cosmetics-and-accessories_clothing" },
  { id: "ebay", name: "eBay", en: true, url: (s) => `https://www.ebay.com/sch/i.html?_nkw=${q(s)}` },
  { id: "depop", name: "Depop", en: true, url: (s) => `https://www.depop.com/search/?q=${q(s)}` },
];

/**
 * The search words a shop gets: English catalogues get the English words when
 * there are any. When the piece is `named` (a brand or a print was read off
 * it), Google gets them too: brand names are searched in English.
 */
export const queryFor = (shop, query, queryEn, named = false) => ((shop.en || (named && shop.id === "google")) && queryEn ? queryEn : query);

function isHttp(url) {
  try {
    const u = new URL(url, location.href);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Is this link to another site (as opposed to the Dream Studios store next door)? */
export function isExternal(url) {
  try {
    return new URL(url, location.href).origin !== location.origin;
  } catch {
    return false;
  }
}

/** Add affiliate tracking to an outbound shop link, per CONFIG.affiliate. */
export function outbound(url) {
  if (!url || !isHttp(url)) return null;
  if (!isExternal(url)) return url;
  const { skimlinksId, sovrnKey, amazonTag, deeplinks = {} } = CONFIG.affiliate || {};
  let target = url;
  try {
    const u = new URL(url);
    // Per-shop deep links (e.g. AliExpress through Admitad, ASOS through Awin) win over network-wide wrapping.
    const host = Object.keys(deeplinks).find((h) => deeplinks[h] && (u.hostname === h || u.hostname.endsWith("." + h)));
    if (host) return deeplinks[host].replace("{url}", q(u.href));
    if (amazonTag && /(^|\.)amazon\./.test(u.hostname) && !u.searchParams.has("tag")) {
      u.searchParams.set("tag", amazonTag);
      return u.href; // Amazon only pays through its own programme
    }
    target = u.href;
  } catch {
    return null;
  }
  if (skimlinksId) return `https://go.skimresources.com/?id=${q(skimlinksId)}&xs=1&url=${q(target)}`;
  if (sovrnKey) return `https://redirect.viglink.com?key=${q(sovrnKey)}&u=${q(target)}`;
  return target;
}

/** Attributes for an outbound <a>. */
export function linkAttrs(url) {
  const href = outbound(url);
  if (!href) return null;
  return isExternal(href) ? { href, target: "_blank", rel: "sponsored noopener noreferrer" } : { href, target: "", rel: "" };
}

export function hostOf(url) {
  try {
    return new URL(url, location.href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
