// Seeded randomness, so a Daily Challenge, a shared challenge link and both
// sides of a duel all get the same rounds.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFrom(seed) {
  return mulberry32(typeof seed === "number" ? seed : hashString(String(seed)));
}

export function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

export function shuffle(rand, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// "2026-10-29" in Israel time, so the Daily Challenge rolls over at midnight there.
export function dayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return parts;
}

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}
