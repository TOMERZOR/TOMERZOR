// Mirrors public.banned_terms (supabase/migrations/0003_safety.sql) so the
// app can explain a rejection before sending. The server is what enforces it.
const terms = ["זונה", "זונות", "שרמוטה", "שרמוטות", "כוס אמק", "כוסאמק", "מניאק", "מניאקים", "fuck", "cunt", "whore", "slut", "nigger"];

export const hasBannedTerm = (text: string) => {
  const t = text.toLowerCase();
  return terms.some((w) => t.includes(w));
};

export const filterMessage = "יש בטקסט מילים שלא מתאימות לגלעד. אפשר לנסח מחדש.";

/** Turns a server error into something a person can act on. */
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/objectionable/.test(m)) return filterMessage;
  if (/blocked/.test(m)) return "אי אפשר: אחד מכם חסם את השני.";
  if (/group is full/.test(m)) return "הקבוצה כבר מלאה.";
  if (/18 and up/.test(m)) return "גלעד מיועד לגיל 18 ומעלה.";
  if (/future/.test(m)) return "שעת החזרה צריכה להיות בעתיד.";
  return "השמירה נכשלה. בדקו את החיבור ונסו שוב.";
}
