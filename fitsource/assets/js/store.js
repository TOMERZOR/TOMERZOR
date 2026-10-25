// Everything a visitor saves lives in their own browser (localStorage).
// Every read and write is guarded: private windows and full storage must not break the page.

const KEYS = { closet: "fs.closet.v1", scans: "fs.scans.v1", prefs: "fs.prefs.v1", likes: "fs.likes.v1", owned: "fs.owned.v1" };
const MAX_SCANS = 8;
const listeners = new Set();

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function emit() {
  for (const fn of listeners) fn();
}
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

// ---------- closet (saved items and watches) ----------

/** Stable key for an item: its product URL when known, else its name + query. */
export function itemKey(item) {
  return item.key || item.url || `${item.brand || ""}|${item.name}|${item.query || ""}`.toLowerCase();
}

export const closet = () => read(KEYS.closet, []);
export const isSaved = (key) => closet().some((i) => i.key === key);
export const isWatching = (key) => closet().some((i) => i.key === key && i.watch);

export function saveItem(item, { watch = false } = {}) {
  const list = closet();
  const key = itemKey(item);
  const existing = list.find((i) => i.key === key);
  if (existing) {
    if (watch) existing.watch = true;
  } else {
    list.unshift({
      key,
      name: item.name,
      brand: item.brand || null,
      shop: item.shop || null,
      price: item.price ?? null,
      currency: item.currency || null,
      status: item.status || "unknown",
      img: item.img || null,
      url: item.url || null,
      query: item.query || item.name,
      fitId: item.fitId || null,
      watch,
      savedAt: new Date().toISOString(),
      checkedAt: null,
      backInStock: false,
    });
  }
  write(KEYS.closet, list.slice(0, 200));
  emit();
}

export function removeItem(key) {
  write(KEYS.closet, closet().filter((i) => i.key !== key));
  emit();
}

export function setWatch(key, watch) {
  const list = closet();
  const it = list.find((i) => i.key === key);
  if (it) it.watch = watch;
  write(KEYS.closet, list);
  emit();
}

export function updateItem(key, patch) {
  const list = closet();
  const it = list.find((i) => i.key === key);
  if (!it) return;
  Object.assign(it, patch);
  write(KEYS.closet, list);
  emit();
}

// ---------- scan history ----------

export const scans = () => read(KEYS.scans, []);
export const getScan = (id) => scans().find((s) => s.id === id) || null;

/** Keep the latest scans; drop the oldest until it fits in storage. */
export function saveScan(scan) {
  let list = [scan, ...scans().filter((s) => s.id !== scan.id)].slice(0, MAX_SCANS);
  while (list.length && !write(KEYS.scans, list)) list = list.slice(0, -1);
  emit();
  return list.some((s) => s.id === scan.id);
}

export function deleteScan(id) {
  write(KEYS.scans, scans().filter((s) => s.id !== id));
  emit();
}

// ---------- pieces you already own ("יש לי כבר") ----------

/** Key for a piece of a fit or a scan: "fit:<fitId>:<itemId>" or "scan:<scanId>:<itemId>". */
export const ownKey = (kind, id, itemId) => `${kind}:${id}:${itemId}`;
const ownedSet = () => new Set(read(KEYS.owned, []));
export const isOwned = (key) => ownedSet().has(key);
export function toggleOwned(key) {
  const set = ownedSet();
  set.has(key) ? set.delete(key) : set.add(key);
  write(KEYS.owned, [...set].slice(-500));
  emit();
  return set.has(key);
}

// ---------- likes and preferences ----------

export const likes = () => new Set(read(KEYS.likes, []));
export function toggleLike(id) {
  const set = likes();
  set.has(id) ? set.delete(id) : set.add(id);
  write(KEYS.likes, [...set]);
  emit();
  return set.has(id);
}

export const prefs = () => read(KEYS.prefs, {});
export function setPref(name, value) {
  write(KEYS.prefs, { ...prefs(), [name]: value });
}
