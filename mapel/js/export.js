// Builds the Excel file: the full board, the closings per site, the soldiers, and every event.

import { buildXlsx, colName } from './xlsx.js';
import {
  KINDS, index, dayOf, look, timeText, periodDates, sortedSoldiers, siteRoster, needOn, tally,
  fmtDay, fmtShort, kindLabel, isWeekend, today,
} from './store.js';

const mix = (hex, other, t) => {
  const a = hex.replace('#', ''), b = other.replace('#', '');
  const ch = i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
  return '#' + [0, 2, 4].map(i => ch(i).toString(16).padStart(2, '0')).join('');
};
const tint = c => mix(c, '#ffffff', 0.8);
const ink = c => mix(c, '#000000', 0.45);

const S = {
  title: { bold: true, size: 16, h: 'right' },
  sub: { size: 11, color: '#6c6c70', h: 'right' },
  head: { bold: true, fill: '#1c1c1e', color: '#ffffff', h: 'center', border: true, wrap: true },
  headWknd: { bold: true, fill: '#3a3a3c', color: '#ffffff', h: 'center', border: true, wrap: true },
  headToday: { bold: true, fill: '#007aff', color: '#ffffff', h: 'center', border: true, wrap: true },
  name: { bold: true, h: 'right', border: true },
  text: { h: 'right', border: true, wrap: true },
  center: { h: 'center', border: true },
  group: { bold: true, fill: '#e5e5ea', h: 'right', border: true },
  empty: { h: 'center', border: true, color: '#8e8e93' },
  total: { bold: true, fill: '#f2f2f7', h: 'center', border: true },
  totalName: { bold: true, fill: '#f2f2f7', h: 'right', border: true },
};

function cellFor(st, x, date) {
  const lk = look(st, x.main);
  const lines = [];
  if (lk.label) lines.push(lk.label);
  const t = x.main ? timeText(x.main, date) : '';
  if (t) lines.push(t);
  for (const r of x.refs) lines.push(`הפניה${timeText(r, date) ? ' ' + timeText(r, date) : ''}${r.note ? ' · ' + r.note : ''}`);
  for (const c of x.cons) lines.push(`אילוץ${c.note ? ': ' + c.note : ''}`);
  const color = x.main ? lk.color : x.refs.length ? KINDS.referral.color : null;
  const s = color
    ? { h: 'center', border: true, wrap: true, fill: tint(color), color: ink(color), bold: !!x.main }
    : { ...S.empty, wrap: true, fill: lk.label ? '#f2f2f7' : undefined, color: '#6c6c70' };
  // rows don't grow by themselves in Excel, so count the wrapped lines (about 13 characters fit a day column)
  const wrapped = lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 13)), 0);
  return { cell: { v: lines.join('\n'), s }, lines: Math.max(1, wrapped) };
}

function boardSheet(st, idx, ds) {
  const soldiers = sortedSoldiers(st);
  const fixed = ['שם', 'מ.א.', 'מחלקה', 'תפקיד'];
  const t = today();
  const rows = [];
  const merges = [];
  const width = fixed.length + ds.length;
  rows.push({ height: 26, cells: [{ v: `${st.unit || 'הפלוגה'} · לוח נוכחות`, s: S.title }] });
  rows.push({ cells: [{ v: `${fmtShort(ds[0])}–${fmtShort(ds[ds.length - 1])} · הופק ב־${fmtShort(t)}`, s: S.sub }] });
  merges.push(`A1:${colName(width - 1)}1`, `A2:${colName(width - 1)}2`);
  rows.push({ height: 32, cells: [...fixed.map(v => ({ v, s: S.head })),
    ...ds.map(d => ({ v: fmtDay(d), s: d === t ? S.headToday : isWeekend(d) ? S.headWknd : S.head }))] });

  let group = null;
  for (const so of soldiers) {
    const g = so.platoon || 'ללא מחלקה';
    if (g !== group) {
      group = g;
      const r = rows.length + 1;
      rows.push({ height: 20, cells: [{ v: g, s: S.group }, ...Array(width - 1).fill({ v: '', s: S.group })] });
      merges.push(`A${r}:${colName(width - 1)}${r}`);
    }
    let maxLines = 1;
    const dayCells = ds.map(d => {
      const c = cellFor(st, dayOf(idx, so.id, d), d);
      maxLines = Math.max(maxLines, c.lines);
      return c.cell;
    });
    rows.push({
      height: Math.max(22, 14 * maxLines + 6),
      cells: [{ v: so.name, s: S.name }, { v: so.pn || '', s: S.center }, { v: so.platoon || '', s: S.center }, { v: so.role || '', s: S.center }, ...dayCells],
    });
  }

  // Totals per day
  rows.push({ cells: [] });
  const tr = rows.length + 1;
  rows.push({ height: 22, cells: [{ v: 'סיכום יומי', s: S.totalName }, ...Array(3).fill({ v: '', s: S.totalName }), ...ds.map(d => ({ v: fmtDay(d), s: S.total }))] });
  merges.push(`A${tr}:D${tr}`);
  const rosters = ds.map(d => siteRoster(st, idx, d));
  for (const site of st.sites) {
    const r = rows.length + 1;
    rows.push({ cells: [{ v: site.name, s: { ...S.name, color: ink(site.color) } }, '', '', '',
      ...ds.map((d, i) => {
        const have = rosters[i].get(site.id).length, need = needOn(site, d);
        const short = have < need;
        return { v: need ? `${have}/${need}` : String(have), s: { h: 'center', border: true, bold: short, fill: short ? '#ffd9d6' : undefined, color: short ? '#b3261e' : undefined } };
      })] });
    merges.push(`A${r}:D${r}`);
  }
  const count = (pred) => ds.map(d => ({ v: soldiers.filter(so => pred(dayOf(idx, so.id, d))).length, s: S.center }));
  for (const [label, pred] of [
    ['בבית', x => !x.main || x.main.kind === 'home'],
    ['גימלים', x => x.main?.kind === 'gimel'],
    ['הפניות', x => x.refs.length > 0],
    ['חופשה / קורס / אחר', x => ['leave', 'course', 'other'].includes(x.main?.kind)],
  ]) {
    const r = rows.length + 1;
    rows.push({ cells: [{ v: label, s: S.name }, '', '', '', ...count(pred)] });
    merges.push(`A${r}:D${r}`);
  }

  return { name: 'לוח נוכחות', rtl: true, cols: [18, 11, 10, 12, ...ds.map(() => 15)], rows, merges, freeze: { rows: 3, cols: 1 } };
}

function sitesSheet(st, idx, ds) {
  const t = today();
  const rows = [];
  const width = 1 + ds.length;
  rows.push({ height: 26, cells: [{ v: `${st.unit || 'הפלוגה'} · מי סוגר איפה`, s: S.title }] });
  rows.push({ cells: [] });
  rows.push({ height: 32, cells: [{ v: 'אתר', s: S.head }, ...ds.map(d => ({ v: fmtDay(d), s: d === t ? S.headToday : isWeekend(d) ? S.headWknd : S.head }))] });
  const rosters = ds.map(d => siteRoster(st, idx, d));
  for (const site of st.sites) {
    let max = 1;
    const cells = ds.map((d, i) => {
      const list = rosters[i].get(site.id);
      const need = needOn(site, d);
      const names = list.map(x => x.soldier.name + (timeText(x.ev, d) ? ` (${timeText(x.ev, d)})` : ''));
      const short = list.length < need;
      const lines = [...names, need ? `${list.length}/${need}${short ? ` · חסרים ${need - list.length}` : ''}` : ''].filter(Boolean);
      max = Math.max(max, lines.length);
      return { v: lines.join('\n'), s: { h: 'center', v: 'top', border: true, wrap: true, fill: short ? '#ffd9d6' : tint(site.color), color: short ? '#b3261e' : ink(site.color) } };
    });
    const hours = site.start || site.end ? `\n${site.start || ''}–${site.end || ''}` : '';
    rows.push({ height: Math.max(24, 15 * max + 6), cells: [{ v: site.name + hours, s: { ...S.name, wrap: true, color: ink(site.color) } }, ...cells] });
  }
  return { name: 'מי סוגר איפה', rtl: true, cols: [18, ...ds.map(() => 16)], rows, merges: [`A1:${colName(width - 1)}1`], freeze: { rows: 3, cols: 1 } };
}

function soldiersSheet(st, idx) {
  const rows = [{ height: 26, cells: [{ v: 'חיילים', s: S.title }] }, { cells: [] }];
  const head = ['שם', 'מ.א.', 'מחלקה', 'תפקיד', 'טלפון', 'ימי סגירה', 'ימים בבית', 'גימלים', 'חופשה / קורס', 'הפניות', 'הערות'];
  rows.push({ height: 30, cells: head.map(v => ({ v, s: S.head })) });
  for (const so of sortedSoldiers(st)) {
    const t = tally(st, idx, so.id);
    rows.push({ cells: [
      { v: so.name, s: S.name }, { v: so.pn || '', s: S.center }, { v: so.platoon || '', s: S.center }, { v: so.role || '', s: S.center },
      { v: so.phone || '', s: S.center }, { v: t.site, s: S.center }, { v: t.home + t.none, s: S.center }, { v: t.gimel, s: S.center },
      { v: t.leave + t.course, s: S.center }, { v: t.referral, s: S.center }, { v: so.note || '', s: S.text },
    ] });
  }
  return { name: 'חיילים', rtl: true, cols: [18, 11, 10, 12, 13, 10, 10, 9, 12, 9, 28], rows, freeze: { rows: 3, cols: 1 } };
}

function eventsSheet(st, ds) {
  const from = ds[0], to = ds[ds.length - 1];
  const rows = [{ height: 26, cells: [{ v: 'הפניות, גימלים ואילוצים', s: S.title }] }, { cells: [] }];
  rows.push({ height: 30, cells: ['חייל', 'סוג', 'מתאריך', 'עד תאריך', 'משעה', 'עד שעה', 'פרטים'].map(v => ({ v, s: S.head })) });
  const names = new Map(st.soldiers.map(s => [s.id, s.name]));
  const list = st.events
    .filter(e => e.kind !== 'site' && e.kind !== 'home' && e.from <= to && (!e.to || e.to >= from))
    .sort((a, b) => a.from.localeCompare(b.from) || (names.get(a.soldierId) || '').localeCompare(names.get(b.soldierId) || '', 'he'));
  const wdTxt = e => (e.weekdays?.length ? ` (כל ${e.weekdays.map(w => ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][w]).join(', ')})` : '');
  for (const e of list) {
    const c = KINDS[e.kind].color;
    rows.push({ cells: [
      { v: names.get(e.soldierId) || '', s: S.name },
      { v: kindLabel(st, e), s: { h: 'center', border: true, bold: true, fill: tint(c), color: ink(c) } },
      { v: fmtDay(e.from), s: S.center }, { v: e.to ? fmtDay(e.to) : 'ללא סיום', s: S.center },
      { v: e.start || '', s: S.center }, { v: e.end || '', s: S.center },
      { v: (e.note || '') + wdTxt(e), s: S.text },
    ] });
  }
  if (!list.length) rows.push({ cells: [{ v: 'אין אירועים בתקופה', s: S.sub }] });
  return { name: 'הפניות ואילוצים', rtl: true, cols: [18, 12, 12, 12, 9, 9, 36], rows, freeze: { rows: 3, cols: 1 } };
}

export function workbook(st) {
  const idx = index(st);
  const ds = periodDates(st);
  return buildXlsx([boardSheet(st, idx, ds), sitesSheet(st, idx, ds), soldiersSheet(st, idx), eventsSheet(st, ds)]);
}

export function fileName(st) {
  const ds = periodDates(st);
  // Latin only: some browsers drop a Hebrew download name and save the file as "download"
  return `mapel-for-you ${fmtShort(ds[0])}-${fmtShort(ds[ds.length - 1])}.xlsx`;
}
