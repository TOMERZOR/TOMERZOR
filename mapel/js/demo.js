// Sample data to try the app with: three פלגות, three sites, a few gimels, referrals
// and constraints, then an automatic schedule on top.

import { addDays, today, uid, addEvent, SITE_COLORS } from './store.js';
import { autoAssign } from './schedule.js';

const NAMES = [
  ['איתי כהן', 'פלגה 1'], ['נועם לוי', 'פלגה 1'], ['יונתן מזרחי', 'פלגה 1'],
  ['עומר פרץ', 'פלגה 1'], ['דניאל ביטון', 'פלגה 1'], ['אורי אברהם', 'פלגה 1'],
  ['אריאל פרידמן', 'פלגה 2'], ['רועי אזולאי', 'פלגה 2'], ['איתמר דהן', 'פלגה 2'],
  ['יהונתן שפירא', 'פלגה 2'], ['עידו גבאי', 'פלגה 2'], ['אלון חדד', 'פלגה 2'],
  ['גיא אוחיון', 'פלגה 3'], ['ליאור יוסף', 'פלגה 3'], ['שחר בן דוד', 'פלגה 3'],
  ['תומר קליין', 'פלגה 3'], ['מתן אלמוג', 'פלגה 3'], ['אביב רוזן', 'פלגה 3'],
];

export function demoState() {
  const start = today();
  const st = {
    v: 1,
    unit: 'סוללה ב׳',
    start,
    days: 14,
    unassigned: 'home',
    rules: { maxStreak: 7, minRest: 3 },
    onboarded: true,
    platoons: ['פלגה 1', 'פלגה 2', 'פלגה 3'],
    sites: [
      { id: uid(), name: 'מוצב צפוני', color: SITE_COLORS[0], need: 4, weekendNeed: 3, start: '', end: '' },
      { id: uid(), name: 'ש.ג ראשי', color: SITE_COLORS[1], need: 2, weekendNeed: '', start: '', end: '' },
      { id: uid(), name: 'חמ״ל', color: SITE_COLORS[2], need: 1, weekendNeed: '', start: '08:00', end: '20:00' },
    ],
    soldiers: NAMES.map(([name, platoon], i) => ({
      id: uid(), name, platoon, pn: String(8712340 + i * 37), phone: `05${2 + (i % 3)}-${String(4410000 + i * 1373).slice(0, 7)}`, note: '',
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
