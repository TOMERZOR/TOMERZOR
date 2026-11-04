// A sample company to try the app with: three platoons, three sites, a few gimels, referrals
// and constraints, then an automatic schedule on top.

import { addDays, today, uid, addEvent, SITE_COLORS } from './store.js';
import { autoAssign } from './schedule.js';

const NAMES = [
  ['איתי כהן', 'מחלקה 1', 'מ״כ'], ['נועם לוי', 'מחלקה 1', 'קלע'], ['יונתן מזרחי', 'מחלקה 1', 'מקלען'],
  ['עומר פרץ', 'מחלקה 1', 'חובש'], ['דניאל ביטון', 'מחלקה 1', 'קשר'], ['אורי אברהם', 'מחלקה 1', 'קלע'],
  ['אריאל פרידמן', 'מחלקה 2', 'מ״כ'], ['רועי אזולאי', 'מחלקה 2', 'נגביסט'], ['איתמר דהן', 'מחלקה 2', 'קלע'],
  ['יהונתן שפירא', 'מחלקה 2', 'צלף'], ['עידו גבאי', 'מחלקה 2', 'קלע'], ['אלון חדד', 'מחלקה 2', 'מטוליסט'],
  ['גיא אוחיון', 'מחלקה 3', 'מ״כ'], ['ליאור יוסף', 'מחלקה 3', 'קלע'], ['שחר בן דוד', 'מחלקה 3', 'קשר'],
  ['תומר קליין', 'מחלקה 3', 'חובש'], ['מתן אלמוג', 'מחלקה 3', 'קלע'], ['אביב רוזן', 'מחלקה 3', 'נהג'],
];

export function demoState() {
  const start = today();
  const st = {
    v: 1,
    unit: 'פלגה ב׳',
    start,
    days: 14,
    unassigned: 'home',
    rules: { maxStreak: 7, minRest: 3 },
    onboarded: true,
    sites: [
      { id: uid(), name: 'מוצב צפוני', color: SITE_COLORS[0], need: 4, weekendNeed: 3, start: '', end: '' },
      { id: uid(), name: 'ש.ג ראשי', color: SITE_COLORS[1], need: 2, weekendNeed: '', start: '', end: '' },
      { id: uid(), name: 'חמ״ל', color: SITE_COLORS[2], need: 1, weekendNeed: '', start: '08:00', end: '20:00' },
    ],
    soldiers: NAMES.map(([name, platoon, role], i) => ({
      id: uid(), name, platoon, role, pn: String(8712340 + i * 37), phone: `05${2 + (i % 3)}-${String(4410000 + i * 1373).slice(0, 7)}`, note: '',
    })),
    events: [],
  };
  const s = st.soldiers;
  const ev = (i, kind, from, to, extra = {}) => addEvent(st, { soldierId: s[i].id, kind, from: addDays(start, from), to: addDays(start, to), ...extra });
  ev(2, 'gimel', 0, 2, { note: 'דלקת גרון' });
  ev(9, 'gimel', 5, 6);
  ev(4, 'referral', 1, 1, { start: '09:30', end: '12:00', note: 'אורתופד, תל השומר' });
  ev(13, 'referral', 3, 3, { start: '14:00', end: '15:30', note: 'רופא שיניים' });
  ev(7, 'referral', 8, 8, { start: '08:00', end: '11:00', note: 'בדיקות דם' });
  ev(5, 'leave', 9, 11, { note: 'חופשה מיוחדת' });
  ev(16, 'course', 2, 6, { note: 'קורס חובשים' });
  ev(11, 'constraint', 4, 5, { note: 'חתונה של אח' });
  addEvent(st, { soldierId: s[1].id, kind: 'constraint', from: start, to: '', weekdays: [2], note: 'לימודים בימי ג׳' });
  ev(0, 'site', 0, 6, { siteId: st.sites[0].id, start: '', end: '' });
  autoAssign(st);
  return st;
}
