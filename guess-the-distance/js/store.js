// Everything the player keeps lives in this browser: profile, settings,
// stats, the Daily Challenge result.

const KEY = "gtd:v1";

const AVATARS = ["🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🐵", "🦉", "🐙", "🦄", "🐳", "🐝", "🦖", "👽", "🤖", "😎", "🧭"];

function defaults() {
  return {
    profile: { name: "", avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], clientId: "p" + Math.random().toString(36).slice(2, 12) },
    settings: { lang: (navigator.language || "he").startsWith("he") ? "he" : (navigator.language || "").startsWith("en") ? "en" : "he", music: true, sfx: true, haptics: true, map: "israel", measure: "time", botLevel: "normal" },
    stats: { games: 0, perfects: 0, wins: 0, losses: 0, rounds: 0, points: 0 },
    best: { classic: {}, timed: {}, streak: 0 },
    daily: {},
  };
}

let data;
export function load() {
  const d = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) {
      data = {
        ...d, ...saved,
        profile: { ...d.profile, ...saved.profile },
        settings: { ...d.settings, ...saved.settings },
        stats: { ...d.stats, ...saved.stats },
        best: { ...d.best, ...saved.best },
        daily: saved.daily || {},
      };
      return data;
    }
  } catch {}
  data = d;
  return data;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export const store = new Proxy({}, { get: (_, k) => (data || load())[k] });
export { AVATARS };
