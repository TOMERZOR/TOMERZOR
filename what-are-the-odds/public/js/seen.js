// What this player (this browser) has already been asked, so it isn't asked again.
// Lists are oldest first; seeing something again moves it to the end.

const KEYS = { cards: "odds:seen", questions: "odds:seenq" };
const MAX = 2000;

function read(kind) {
  try {
    const v = JSON.parse(localStorage.getItem(KEYS[kind]) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(kind, list) {
  try { localStorage.setItem(KEYS[kind], JSON.stringify(list.slice(-MAX))); } catch { /* private mode */ }
}

export function seenList(kind = "cards") {
  return read(kind);
}

export function markSeen(id, kind = "cards") {
  if (!id) return;
  write(kind, read(kind).filter((x) => x !== id).concat(id));
}

// Pick from items the player hasn't seen; when all are seen, the longest-forgotten.
export function pickUnseen(items, keyOf, kind = "questions") {
  const seen = read(kind);
  const seenSet = new Set(seen);
  const fresh = items.filter((it) => !seenSet.has(keyOf(it)));
  let pick;
  if (fresh.length) pick = fresh[Math.floor(Math.random() * fresh.length)];
  else {
    const byKey = new Map(items.map((it) => [keyOf(it), it]));
    pick = byKey.get(seen.find((k) => byKey.has(k))) || items[Math.floor(Math.random() * items.length)];
  }
  markSeen(keyOf(pick), kind);
  return pick;
}
