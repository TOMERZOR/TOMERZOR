// Alerts on saved pieces: re-check watched items through the API's stock
// endpoint and report what changed: back in stock, back in your size, or a
// lower price.
import * as store from "./store.js";
import { deepScanStatus, apiBase } from "./scan/engine.js";
import { isExternal } from "./shop.js";
import { money } from "./ui.js";

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

/** One alert in words. */
export function describe(ev) {
  const name = ev.item.name;
  if (ev.kind === "size") return `מידה ${ev.size} של ${name} חזרה למלאי`;
  if (ev.kind === "drop") return `${name} ירד ל־${money(ev.to, ev.item.currency || "ILS")} (היה ${money(ev.from, ev.item.currency || "ILS")})`;
  return `${name} חזר למלאי`;
}

/** A summary for a toast or note. */
export function summarize(events) {
  if (!events.length) return "";
  return events.length === 1 ? describe(events[0]) : `${events.length} עדכונים על פריטים שאתם עוקבים אחריהם`;
}

const inStock = (a) => a === "in_stock" || a === "low_stock";

/**
 * What changed between the saved item and a fresh stock check.
 * Returns { patch, events }, events being { kind: "back" | "size" | "drop", item, size?, from?, to? }.
 */
export function compareStock(item, r) {
  const patch = { checkedAt: r.checked_at || new Date().toISOString() };
  const events = [];
  const sizes = Array.isArray(r.sizes) && r.sizes.length ? r.sizes.map((s) => ({ label: String(s.label), available: Boolean(s.available) })) : null;
  if (sizes) patch.sizes = sizes;
  if (r.availability && r.availability !== "unknown") {
    patch.status = r.availability;
    if (item.watchSize && sizes) {
      // watching one size: only that size coming back counts
      const was = (item.sizes || []).find((s) => s.label === item.watchSize);
      const now = sizes.find((s) => s.label === item.watchSize);
      if (now && now.available && was && !was.available) {
        patch.backInStock = true;
        events.push({ kind: "size", item, size: item.watchSize });
      }
    } else if (item.status === "sold_out" && inStock(r.availability)) {
      patch.backInStock = true;
      events.push({ kind: "back", item });
    }
  }
  if (r.price != null && Number.isFinite(r.price)) {
    const sameCurrency = !r.currency || !item.currency || r.currency === item.currency;
    if (item.price != null && sameCurrency && r.price < item.price - 0.005) {
      patch.priceDrop = { from: item.price, to: r.price };
      events.push({ kind: "drop", item, from: item.price, to: r.price });
    }
    if (sameCurrency) patch.price = r.price;
  }
  return { patch, events };
}

/**
 * Re-check watched items (at most every 6 hours each, unless forced; `only`
 * limits it to one item). Returns the events, newest news first.
 */
export async function recheckWatches({ force = false, only = null } = {}) {
  const watched = store.closet().filter((i) => i.watch && i.url && isExternal(i.url) && (!only || i.key === only));
  if (!watched.length || !(await deepScanStatus())) return [];
  const events = [];
  for (const item of watched) {
    if (!force && item.checkedAt && Date.now() - new Date(item.checkedAt).getTime() < RECHECK_EVERY) continue;
    try {
      const r = await check(item.url);
      const out = compareStock(item, r);
      store.updateItem(item.key, out.patch);
      events.push(...out.events);
    } catch {
      // try again next visit
    }
  }
  return events;
}
