// Restock alerts: re-check watched items through the API's stock endpoint.
import * as store from "./store.js";
import { deepScanStatus, apiBase } from "./scan/engine.js";
import { isExternal } from "./shop.js";

const RECHECK_EVERY = 6 * 60 * 60 * 1000;

async function check(url) {
  const res = await fetch(`${apiBase()}/api/stock?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error("stock check failed");
  return res.json();
}

/** Can this item be watched at all? Needs a real shop URL and a running API. */
export async function canWatch() {
  return Boolean(await deepScanStatus());
}

/**
 * Re-check watched items (at most every 6 hours each, unless forced).
 * Returns the items that came back in stock.
 */
export async function recheckWatches({ force = false } = {}) {
  const watched = store.closet().filter((i) => i.watch && i.url && isExternal(i.url));
  if (!watched.length || !(await deepScanStatus())) return [];
  const backs = [];
  for (const item of watched) {
    if (!force && item.checkedAt && Date.now() - new Date(item.checkedAt).getTime() < RECHECK_EVERY) continue;
    try {
      const r = await check(item.url);
      const patch = { checkedAt: r.checked_at || new Date().toISOString() };
      if (r.availability && r.availability !== "unknown") {
        const wasOut = item.status === "sold_out";
        const nowIn = r.availability === "in_stock" || r.availability === "low_stock";
        patch.status = r.availability;
        if (r.price != null) patch.price = r.price;
        if (wasOut && nowIn) {
          patch.backInStock = true;
          backs.push(item);
        }
      }
      store.updateItem(item.key, patch);
    } catch {
      // try again next visit
    }
  }
  return backs;
}
