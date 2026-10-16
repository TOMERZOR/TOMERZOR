import type { Post } from "./data/seed";
import { trailById, type Level } from "./data/trails";

export interface Me {
  name: string;
  city: string;
  pace: number;
  level: Level;
  hikes: number;
  emergencyContact: string;
  freeDays: number[]; // day offsets marked free in the next 21 days
}

const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const longDayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const months = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

export const dateFromOffset = (offset: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

export const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;

export const dayLabel = (offset: number) => {
  if (offset === 0) return "היום";
  if (offset === 1) return "מחר";
  if (offset === 2) return "מחרתיים";
  const d = dateFromOffset(offset);
  if (offset < 7) return `יום ${longDayNames[d.getDay()]}`;
  if (offset < 60) return `${dayNames[d.getDay()] === "שבת" ? "שבת" : "יום " + dayNames[d.getDay()]} ${ddmm(d)}`;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const shortDay = (offset: number) => {
  const d = dateFromOffset(offset);
  return { dow: dayNames[d.getDay()], dm: ddmm(d), day: d.getDate(), month: months[d.getMonth()] };
};

export const rangeLabel = (p: Post) => {
  if (p.days <= 1) return dayLabel(p.dayOffset);
  const a = dateFromOffset(p.dayOffset);
  const b = dateFromOffset(p.dayOffset + p.days - 1);
  return `${ddmm(a)}-${ddmm(b)}`;
};

const levelRank: Record<Level, number> = { קל: 0, בינוני: 1, קשה: 2, מאתגר: 3 };

/**
 * How well a post fits me, 0–100. Weighs pace, difficulty, whether the date
 * lands on a day I marked free, and whether there is still room.
 */
export function matchScore(p: Post, me: Me): number {
  const paceGap = Math.abs(p.pace - me.pace);
  const pace = Math.max(0, 35 - paceGap * 22);
  const lvlGap = Math.abs(levelRank[p.level] - levelRank[me.level]);
  const level = [25, 17, 6, 0][lvlGap];
  const days = Array.from({ length: p.days }, (_, i) => p.dayOffset + i);
  const free = days.some((d) => me.freeDays.includes(d)) ? 25 : p.flexible ? 14 : p.dayOffset > 30 ? 10 : 4;
  const room = p.spots - p.joined.length > 0 ? 15 : 0;
  return Math.round(Math.min(99, pace + level + free + room));
}

export const spotsLeft = (p: Post) => Math.max(0, p.spots - p.joined.length);

export const carLabel: Record<Post["car"], string> = {
  "has-car": "יש רכב, יש מקום",
  "needs-ride": "מחפש/ת טרמפ",
  shuttle: "שאטל רכבים לקווי",
};

export const trailOf = (p: Post) => trailById(p.trailId);

export const hashInk = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (["ultra", "flame", "moss", "brick"] as const)[h % 4];
};

export const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export const timeAgo = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60_000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} ש׳`;
  const d = Math.round(h / 24);
  return d === 1 ? "אתמול" : `לפני ${d} ימים`;
};

export const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
