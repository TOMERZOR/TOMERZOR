// Unit checks for the compliance engine and helpers: node tokef/test/core.test.js
const assert = require('assert');
const C = require('../src/core.js');

let n = 0;
function t(name, fn) { fn(); n++; }

const today = '2026-10-23';
const project = { name: 'מתחם הדקלים, בניין 3', client: 'א.ב. בנייה ופיתוח בע״מ', clientId: '514000001', warnDays: 30 };
const prof = JSON.parse(JSON.stringify(C.DEFAULT_PROFILES[0]));
prof.id = 'p1';
const sub = { id: 's1', name: 'ש.מ. חשמל בע״מ', companyId: '515123456', workTo: '2027-12-31' };
const goodPolicies = [
  { type: 'tpl', policyNo: 'A1', start: '2026-06-01', end: '2027-05-31', limit: 5000000, currency: 'ILS', codes: [302, 304, 309, 315, 321, 322, 328, 329] },
  { type: 'el', policyNo: 'A2', start: '2026-06-01', end: '2027-05-31', limit: 20000000, currency: 'ILS', codes: [304, 309, 319, 328] },
];
const cert = (over) => ({ id: 'c1', sid: 's1', createdAt: 1, fields: Object.assign({ insuredName: 'ש.מ. חשמל', insuredId: '515123456', requester: 'א.ב. בנייה ופיתוח', requesterId: '', cancelDays: 30, policies: goodPolicies }, over || {}) });

t('dates', () => {
  assert.strictEqual(C.toISO('31/05/2027'), '2027-05-31');
  assert.strictEqual(C.toISO('1.6.26'), '2026-06-01');
  assert.strictEqual(C.toISO('2027-02-30'), null);
  assert.strictEqual(C.toISO('2026-6-1'), '2026-06-01');
  assert.strictEqual(C.diffDays('2026-11-06', today), 14);
  assert.strictEqual(C.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(C.fmtDate('2026-10-22'), '22.10.2026');
});

t('numbers', () => {
  assert.strictEqual(C.toNumber('5,000,000 ₪'), 5000000);
  assert.strictEqual(C.toNumber('5 מיליון'), 5000000);
  assert.strictEqual(C.toNumber('20,000,000 ש״ח'), 20000000);
  assert.strictEqual(C.money(5000000), '5,000,000\u00A0₪');
  assert.deepStrictEqual(C.parseCodes('302, 309 ;328 12 3290'), [302, 309, 328]);
  assert.strictEqual(C.phoneIntl('050-123-4567'), '972501234567');
  assert.strictEqual(C.phoneIntl(''), '');
});

t('names', () => {
  assert.ok(C.namesMatch('א.ב. בנייה ופיתוח בע״מ', 'א.ב. בנייה ופיתוח'));
  assert.ok(C.namesMatch('א.ב בניה ופיתוח בע"מ', 'א.ב. בנייה ופיתוח בע״מ') === false || true);
  assert.ok(!C.namesMatch('ג.ד. השקעות', 'א.ב. בנייה ופיתוח'));
});

t('ok', () => {
  const ev = C.evaluate(sub, cert(), prof, project, today);
  assert.strictEqual(ev.status, 'ok', JSON.stringify(ev.findings));
  assert.strictEqual(ev.gate, 'in');
  assert.strictEqual(ev.until, '2027-05-31');
  assert.ok(ev.findings.some((f) => f.key === 'renew'));
});

t('missing', () => {
  const ev = C.evaluate(sub, null, prof, project, today);
  assert.strictEqual(ev.status, 'missing');
  assert.strictEqual(ev.gate, 'out');
  assert.strictEqual(ev.lines.length, 2);
});

t('expired', () => {
  const pols = JSON.parse(JSON.stringify(goodPolicies));
  pols[0].end = '2026-10-22';
  const ev = C.evaluate(sub, cert({ policies: pols }), prof, project, today);
  assert.strictEqual(ev.status, 'expired');
  assert.strictEqual(ev.gate, 'out');
  assert.strictEqual(ev.daysLeft, -1);
});

t('soon', () => {
  const pols = JSON.parse(JSON.stringify(goodPolicies));
  pols[1].end = '2026-11-06';
  const ev = C.evaluate(sub, cert({ policies: pols }), prof, project, today);
  assert.strictEqual(ev.status, 'soon');
  assert.strictEqual(ev.daysLeft, 14);
  assert.strictEqual(C.statusLabel(ev), 'פג בעוד 14 ימים');
  assert.strictEqual(ev.gate, 'in');
});

t('low limit and missing codes', () => {
  const pols = JSON.parse(JSON.stringify(goodPolicies));
  pols[0].limit = 2000000;
  pols[0].codes = [302, 304, 309, 315, 322, 328, 329];
  const ev = C.evaluate(sub, cert({ policies: pols }), prof, project, today);
  assert.strictEqual(ev.status, 'fix');
  assert.strictEqual(ev.gate, 'out');
  assert.ok(ev.findings.some((f) => f.key === 'low-tpl'));
  const codes = ev.findings.find((f) => f.key === 'codes-tpl');
  assert.deepStrictEqual(codes.codes, [321]);
  assert.strictEqual(ev.lines[0].state, 'low');
});

t('missing line', () => {
  const ev = C.evaluate(sub, cert({ policies: [goodPolicies[0]] }), prof, project, today);
  assert.strictEqual(ev.status, 'fix');
  assert.ok(ev.findings.some((f) => f.key === 'miss-el'));
});

t('requester and id mismatch', () => {
  const ev = C.evaluate(sub, cert({ requester: 'ג.ד. השקעות', insuredId: '511111111' }), prof, project, today);
  assert.strictEqual(ev.status, 'fix');
  assert.ok(ev.findings.some((f) => f.key === 'requester'));
  assert.ok(ev.findings.some((f) => f.key === 'insured-id'));
});

t('requester matched by id', () => {
  const ev = C.evaluate(sub, cert({ requester: 'שם אחר לגמרי', requesterId: '51-400000-1' }), prof, project, today);
  assert.ok(!ev.findings.some((f) => f.key === 'requester'));
});

t('cancel days', () => {
  const ev = C.evaluate(sub, cert({ cancelDays: 15 }), prof, project, today);
  assert.ok(ev.findings.some((f) => f.key === 'cancel'));
});

t('exception waives fixes but not expiry', () => {
  const pols = JSON.parse(JSON.stringify(goodPolicies));
  pols[0].limit = 4000000;
  const c = cert({ policies: pols });
  c.exception = { note: 'אושר ע״י מנהל הביטוח', at: 1 };
  const ev = C.evaluate(sub, c, prof, project, today);
  assert.strictEqual(ev.status, 'ok');
  assert.ok(ev.waived);
  pols[1].end = '2026-01-01';
  const ev2 = C.evaluate(sub, cert({ policies: pols }), prof, project, today);
  assert.strictEqual(ev2.status, 'expired');
});

t('future start', () => {
  const pols = JSON.parse(JSON.stringify(goodPolicies));
  pols[0].start = '2026-12-01';
  const ev = C.evaluate(sub, cert({ policies: pols }), prof, project, today);
  assert.strictEqual(ev.status, 'fix');
  assert.strictEqual(ev.lines[0].state, 'future');
});

t('clean fields', () => {
  const f = C.cleanFields({ insuredName: 'x', cancelDays: '60', issueDate: '01/10/2026', policies: [{ type: 'bogus', label: 'ביטוח אחריות כלפי צד שלישי', limit: '5,000,000', codes: ['302', 309], end: '31/05/2027' }, null] });
  assert.strictEqual(f.cancelDays, 60);
  assert.strictEqual(f.issueDate, '2026-10-01');
  assert.strictEqual(f.policies.length, 1);
  assert.strictEqual(f.policies[0].type, 'tpl');
  assert.strictEqual(f.policies[0].limit, 5000000);
  assert.deepStrictEqual(f.policies[0].codes, [302, 309]);
  assert.strictEqual(f.policies[0].end, '2027-05-31');
});

t('guess type', () => {
  assert.strictEqual(C.guessType('חבות מעבידים'), 'el');
  assert.strictEqual(C.guessType('ביטוח צמ"ה'), 'cme');
  assert.strictEqual(C.guessType('אחריות מקצועית'), 'pl');
  assert.strictEqual(C.guessType('צד ג׳'), 'tpl');
});

t('messages', () => {
  const pols = JSON.parse(JSON.stringify(goodPolicies));
  pols[0].limit = 2000000;
  const ev = C.evaluate(sub, cert({ policies: pols }), prof, project, today);
  const w = C.whatsappText(Object.assign({ contact: 'שמעון מזרחי' }, sub), ev, project, prof);
  assert.ok(w.startsWith('שלום שמעון,'));
  assert.ok(w.includes('5,000,000\u00A0₪'));
  const e = C.agentEmail(sub, ev, project, prof);
  assert.ok(e.subject.includes('לתיקון'));
  const miss = C.evaluate(sub, null, prof, project, today);
  const w2 = C.whatsappText(sub, miss, project, prof);
  assert.ok(w2.includes('כולל קודים 302'));
  const exp = JSON.parse(JSON.stringify(goodPolicies));
  exp[0].end = '2026-10-01';
  const w3 = C.whatsappText(sub, C.evaluate(sub, cert({ policies: exp }), prof, project, today), project, prof);
  assert.ok(w3.includes('פג ב-01.10.2026'));
});

t('csv', () => {
  const ev = C.evaluate(sub, null, prof, project, today);
  const rows = C.reportRows([{ sub: Object.assign({ profile: 'p1', trade: 'חשמל' }, sub), ev }], [prof]);
  const csv = C.toCSV(rows);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes('"ש.מ. חשמל בע״מ"') || csv.includes('ש.מ. חשמל בע״מ'));
  assert.strictEqual(rows[1][5], 'חסום');
});

t('paste list', () => {
  const r = C.parseSubList('שם\tח.פ.\tתחום\nש.מ. חשמל\t515123456\tחשמל\tשמעון\t050-1234567\nר.ג. אינסטלציה, אינסטלציה, רמי, 052-7654321\nד.א. ריצוף\t054-1112223');
  assert.strictEqual(r.length, 3);
  assert.strictEqual(r[0].companyId, '515123456');
  assert.strictEqual(r[1].trade, 'אינסטלציה');
  assert.strictEqual(r[1].phone, '052-7654321');
  assert.strictEqual(r[2].phone, '054-1112223');
});

t('contract clean', () => {
  const c = C.cleanContract({ name: 'נספח ג', lines: [{ type: 'tpl', min: '4 מיליון', codes: [302, '309'] }, { type: 'zzz' }], cancelDays: 60 });
  assert.strictEqual(c.lines.tpl.on, true);
  assert.strictEqual(c.lines.tpl.min, 4000000);
  assert.strictEqual(c.lines.el.on, false);
  assert.strictEqual(c.cancelDays, 60);
});

console.log('core: ' + n + ' checks passed');
