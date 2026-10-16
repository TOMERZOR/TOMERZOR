// Text of the SMS sent to an emergency contact. Plain TypeScript with no
// imports, so the edge function (Deno) and the tests (Node) share it.

export interface AlertRow {
  checkin_id: string;
  kind: "overdue" | "all-clear";
  hiker_name: string;
  hiker_gender: "f" | "m" | "x";
  contact_name: string;
  contact_phone: string;
  trail_name: string;
  meet: string;
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  return_by: string; // ISO timestamp
  partners: string[];
}

/** Israeli and international numbers to E.164, or null when it cannot be a phone number. */
export function toE164(raw: string): string | null {
  const plus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!plus && digits.startsWith("00")) digits = digits.slice(2);
  else if (!plus && digits.startsWith("0")) digits = "972" + digits.slice(1);
  if (digits.length < 9 || digits.length > 15) return null;
  return "+" + digits;
}

const verb = (g: AlertRow["hiker_gender"], f: string, m: string) => (g === "f" ? f : g === "m" ? m : `${m}/ה`);

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

const ddmm = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

export function alertText(r: AlertRow, timeZone = "Asia/Jerusalem"): string {
  const first = r.hiker_name.split(" ")[0] || r.hiker_name;
  const g = r.hiker_gender;
  if (r.kind === "all-clear") {
    return `גלעד: ${first} ${verb(g, "סימנה", "סימן")} ${verb(g, "שחזרה", "שחזר")} מ${r.trail_name} והכל בסדר. תודה שהייתם זמינים.`;
  }
  const partners = r.partners.length ? ` ${r.partners.length === 1 ? "שותף/ה" : "שותפים"}: ${r.partners.join(", ")}.` : "";
  const meet = r.meet ? ` מ${r.meet}` : "";
  return (
    `גלעד: ${r.hiker_name} ${verb(g, "יצאה", "יצא")} ל${r.trail_name} ב-${ddmm(r.start_date)} ${r.start_time.slice(0, 5)}${meet}` +
    ` ${verb(g, "וקבעה", "וקבע")} לחזור עד ${clock(r.return_by, timeZone)}. ${first} עוד לא ${verb(g, "סימנה", "סימן")} ${verb(g, "שחזרה", "שחזר")}.` +
    `${partners} כדאי לנסות להתקשר. בחירום: משטרה 100, מד״א 101.`
  );
}
