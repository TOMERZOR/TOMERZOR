// Unit tests for the emergency-contact SMS text and phone normalisation.
import { alertText, toE164, type AlertRow } from "../functions/checkin-alerts/message";

let failures = 0;
const expect = (cond: unknown, what: string) => {
  console.log(`  ${cond ? "ok " : "FAIL"} ${what}`);
  if (!cond) failures++;
};

expect(toE164("050-123-4567") === "+972501234567", "Israeli mobile with dashes");
expect(toE164("02 6234567") === "+97226234567", "Israeli landline");
expect(toE164("+972 50 1234567") === "+972501234567", "already international");
expect(toE164("00972501234567") === "+972501234567", "00 prefix");
expect(toE164("+1 (415) 555-0100") === "+14155550100", "abroad");
expect(toE164("12345") === null, "too short is rejected");
expect(toE164("") === null, "empty is rejected");

const row: AlertRow = {
  checkin_id: "x",
  kind: "overdue",
  hiker_name: "נועה ברק",
  hiker_gender: "f",
  contact_name: "אמא",
  contact_phone: "050-1234567",
  trail_name: "מכתש רמון",
  meet: "מרכז המבקרים",
  start_date: "2026-10-18",
  start_time: "05:30:00",
  return_by: "2026-10-18T11:00:00Z", // 14:00 in Israel (UTC+3)
  partners: ["שירה מזרחי", "תומר זהבי"],
};
const text = alertText(row);
console.log("    " + text);
expect(text.includes("נועה ברק יצאה למכתש רמון ב-18.10 05:30 ממרכז המבקרים"), "says who, where and when");
expect(text.includes("לחזור עד 14:00"), "return time in Israel time");
expect(text.includes("שותפים: שירה מזרחי, תומר זהבי"), "lists the partners");
expect(text.includes("מד״א 101"), "includes emergency numbers");
expect(alertText({ ...row, hiker_gender: "m", hiker_name: "איתי" }).includes("איתי יצא ל"), "masculine forms");
expect(alertText({ ...row, hiker_gender: "x" }).includes("יצא/ה"), "neutral forms");
const clear = alertText({ ...row, kind: "all-clear" });
console.log("    " + clear);
expect(clear.startsWith("גלעד: נועה סימנה שחזרה ממכתש רמון"), "all-clear message");

if (failures) {
  console.log(`${failures} unit test(s) failed`);
  process.exit(1);
}
console.log("all unit tests passed");
