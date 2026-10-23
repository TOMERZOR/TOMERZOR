// Outbound links: shop search URLs and affiliate wrapping.
import { CONFIG } from "./config.js";

const q = (s) => encodeURIComponent(String(s || "").trim());

export const NEW_SHOPS = [
  { id: "google", name: "Google Shopping", url: (s) => `https://www.google.com/search?udm=28&q=${q(s)}` },
  { id: "asos", name: "ASOS", url: (s) => `https://www.asos.com/search/?q=${q(s)}` },
  { id: "amazon", name: "Amazon", url: (s) => `https://www.amazon.com/s?k=${q(s)}` },
];

export const RESALE_SHOPS = [
  { id: "depop", name: "Depop", url: (s) => `https://www.depop.com/search/?q=${q(s)}` },
  { id: "vinted", name: "Vinted", url: (s) => `https://www.vinted.com/catalog?search_text=${q(s)}` },
  { id: "ebay", name: "eBay", url: (s) => `https://www.ebay.com/sch/i.html?_nkw=${q(s)}` },
  { id: "grailed", name: "Grailed", url: (s) => `https://www.grailed.com/shop?query=${q(s)}` },
];

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
  const { skimlinksId, sovrnKey, amazonTag } = CONFIG.affiliate || {};
  let target = url;
  try {
    const u = new URL(url);
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
