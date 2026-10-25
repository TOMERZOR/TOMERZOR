// End-to-end pass over every flow. node tokef/test/e2e.mjs <outdir> [scenario...]
import { startServer, launch, newContext, watch, ROOT } from './harness.mjs';
import fs from 'fs';
import path from 'path';

const out = process.argv[2] || '/tmp/tokef-e2e';
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const PORT = 8792;
const BASE = `http://127.0.0.1:${PORT}/`;
const FIX = path.join(ROOT, 'test/fixtures');
const srv = await startServer(PORT);
const browser = await launch();
const failures = [];
const notes = [];

const ANSWER = {
  insuredName: 'א.ד. טפסנות בע״מ', insuredId: '515234561', requester: 'א.ב. בנייה ופיתוח בע״מ', requesterId: '514000001',
  insurer: 'ארז חברה לביטוח בע״מ', agent: 'מ.ד. סוכנות לביטוח', issueDate: '2026-10-20', cancelDays: 30,
  policies: [
    { type: 'tpl', label: 'צד ג׳', policyNo: '11-1007950', start: '2026-03-01', end: '2027-02-28', limit: 5000000, currency: 'ILS', codes: [302, 304, 309, 315, 321, 322, 328, 329] },
    { type: 'el', label: 'אחריות מעבידים', policyNo: '11-1007981', start: '2026-03-01', end: '2027-02-28', limit: 20000000, currency: 'ILS', codes: [304, 309, 319, 328] },
  ],
  confidence: 'high', notes: null,
};
const CONTRACT = { name: 'נספח ביטוח: מכרז 12/2026', cancelDays: 60, requester: true, lines: [{ type: 'tpl', min: 8000000, codes: [302, 309, 321, 328] }, { type: 'el', min: 20000000, codes: [309, 319, 328] }, { type: 'car', min: null, codes: [309, 318] }], notes: null };

function check(cond, msg) { if (!cond) failures.push(msg); }
async function shot(page, name, full) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: !!full }); }
async function settle(page, ms) { await page.waitForTimeout(ms || 400); }
async function text(page, sel) { return (await page.locator(sel).first().innerText().catch(() => '')).trim(); }
async function loadDemo(page) {
  await page.goto(BASE);
  await page.waitForSelector('.welcome, .hero', { timeout: 20000 });
  if (await page.locator('.welcome').count()) {
    await page.getByRole('button', { name: 'פרויקט הדגמה' }).click();
    await page.waitForSelector('.hero', { timeout: 20000 });
  }
  await page.waitForSelector('section.kpis', { timeout: 20000 });
  await settle(page, 700);
}
async function kpi(page, i) { return Number(await page.locator('.kpi .v').nth(i).innerText()); }
async function openSub(page, name) {
  await page.locator('nav.crumb button, .nav').first().count();
  if (!(await page.locator('#subs-table').count())) { await page.locator('.rail .nav').first().click(); await settle(page); }
  await page.locator('#subs-table tbody tr', { hasText: name }).first().click();
  await page.waitForSelector('.rec-head', { timeout: 8000 });
  await settle(page, 500);
}

async function run(name, fn, opts) {
  if (only.length && !only.includes(name)) return;
  const errors = [];
  const o = Object.assign({}, opts || {});
  o.mock = Object.assign({}, o.mock || {});
  o.mock.sample = Object.assign({ mode: 'ok', ms: 1200, answer: ANSWER }, o.mock.sample || {});
  const ctx = await newContext(browser, PORT, o);
  const page = await ctx.newPage();
  watch(page, errors);
  const t0 = Date.now();
  try { await fn(page, ctx); }
  catch (e) { failures.push(name + ': threw ' + (e && e.message ? e.message.split('\n')[0] : e)); try { await shot(page, name + '-crash'); } catch (x) {} }
  for (const e of errors) failures.push(name + ': ' + e);
  const mockErr = await page.evaluate(() => window.__mockErrors || []).catch(() => []);
  for (const e of mockErr) failures.push(name + ': mock listener error ' + e);
  notes.push(name + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  await ctx.close();
}

/* ---------------- desktop, everything granted ---------------- */
await run('desktop', async (page) => {
  await page.goto(BASE);
  await page.waitForSelector('.welcome', { timeout: 20000 });
  await shot(page, '00-welcome');
  await page.getByRole('button', { name: 'פרויקט הדגמה' }).click();
  await page.waitForSelector('section.kpis', { timeout: 20000 });
  await settle(page, 900);
  await shot(page, '10-dashboard');
  check((await kpi(page, 0)) === 11 && (await kpi(page, 1)) === 2 && (await kpi(page, 2)) === 2 && (await kpi(page, 3)) === 2, 'dashboard KPIs should be 11/2/2/2');
  check((await page.locator('#subs-table tbody tr').count()) === 15, 'table should list 15 subcontractors');

  await page.locator('.kpi').nth(3).click();
  await settle(page);
  check((await page.locator('#subs-table tbody tr').count()) === 2, 'blocked tile should filter to 2 rows');
  await page.locator('.kpi').nth(3).click();
  await page.getByRole('searchbox', { name: 'חיפוש קבלן משנה' }).fill('טפסנות');
  await settle(page);
  check((await page.locator('#subs-table tbody tr').count()) === 1, 'search should find 1 row');
  await page.getByRole('searchbox', { name: 'חיפוש קבלן משנה' }).fill('515945678');
  await settle(page);
  check((await page.locator('#subs-table tbody tr').count()) === 1, 'search by company id should find 1 row');
  await page.getByRole('searchbox', { name: 'חיפוש קבלן משנה' }).fill('');

  await openSub(page, 'ש.מ. חשמל');
  await shot(page, '20-sub-expired', true);
  check((await text(page, '.stamp b')).includes('חסום לכניסה'), 'expired sub should show the blocked stamp');
  check((await page.locator('.ribbon .rb-row').count()) === 2, 'ribbon should have 2 rows');
  await page.getByRole('button', { name: 'מייל לסוכן' }).click();
  await page.waitForSelector('.modal');
  await shot(page, '21-mail');
  const body = await page.locator('#mail-body').inputValue();
  check(body.includes('ש.מ. חשמל') && body.includes('נא להנפיק אישור מעודכן'), 'agent e-mail should describe the renewal');
  await page.getByRole('button', { name: 'העתקת המייל' }).click();
  await settle(page, 300);
  check((await page.locator('.toast').count()) > 0, 'copy should toast');
  await page.keyboard.press('Escape');
  await settle(page);
  check((await page.locator('.modal').count()) === 0, 'Escape should close the modal');
  const wa = await page.locator('a.btn', { hasText: 'בקשה בוואטסאפ' }).getAttribute('href');
  check(wa && wa.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes('פג ב-22.10.2026'), 'WhatsApp link should carry the expiry message');

  await page.locator('nav.crumb button').click();
  await settle(page);
  await openSub(page, 'א.ד. טפסנות');
  await shot(page, '22-sub-fix', true);
  check((await page.locator('.findings li').count()) >= 2, 'fix sub should list findings');
  await page.getByRole('button', { name: 'אישור חריגה' }).click();
  await page.waitForSelector('#waive-note');
  await shot(page, '23-waive');
  await page.locator('#waive-note').fill('אושר על ידי מנהל הביטוח עד לחידוש');
  await page.getByRole('button', { name: 'אישור החריגה' }).click();
  await settle(page, 800);
  check((await text(page, '.stamp b')).includes('מורשה כניסה'), 'waiver should allow entry');
  await page.getByRole('button', { name: 'ביטול החריגה' }).click();
  await settle(page, 800);
  check((await text(page, '.stamp b')).includes('חסום לכניסה'), 'removing the waiver should block again');

  await page.getByRole('button', { name: 'העלאת אישור' }).first().click();
  await page.waitForSelector('.check');
  await settle(page);
  check((await page.locator('#ck-sub').inputValue()) !== '', 'check view should preselect the subcontractor');
  await shot(page, '30-check-empty');
  await page.locator('.drop input[type=file]').setInputFiles(path.join(FIX, 'cert.pdf'));
  await page.waitForSelector('.sheet img', { timeout: 20000 });
  await settle(page, 600);
  await shot(page, '31-check-pdf');
  await page.getByRole('button', { name: 'קריאה אוטומטית' }).click();
  await settle(page, 500);
  await shot(page, '32-reading');
  await page.waitForSelector('#ck-in', { timeout: 15000 });
  await settle(page, 600);
  await shot(page, '33-review', true);
  const calls = await page.evaluate(() => window.__sampleCalls);
  check(calls.length === 1 && calls[0].kind === 'json' && calls[0].images.length === 2, 'reading should send one json call with 2 page crops, got ' + JSON.stringify(calls.map((c) => c.images.length)));
  check((await page.locator('#ck-in').inputValue()) === 'א.ד. טפסנות בע״מ', 'extracted insured name should fill the form');
  check((await text(page, '.verdict .verdict-big')).includes('יהיה מורשה כניסה'), 'corrected certificate should pass');
  await page.locator('#pl-0').fill('3,000,000');
  await settle(page, 300);
  check((await text(page, '.verdict .verdict-big')).includes('ייחסם'), 'lowering the limit should flip the live verdict');
  await page.locator('#pl-0').fill('5,000,000');
  await settle(page, 300);
  await page.getByRole('button', { name: 'שמירת האישור' }).click();
  await page.waitForSelector('.rec-head', { timeout: 15000 });
  await settle(page, 900);
  await shot(page, '34-after-save', true);
  check((await text(page, '.stamp b')).includes('מורשה כניסה'), 'after saving the corrected certificate the sub should be allowed');
  const uploads = await page.evaluate(() => window.__uploads || []);
  check(uploads.length === 1 && uploads[0].type === 'application/pdf', 'the PDF should be uploaded as an asset');
  check((await page.locator('.history li').count()) === 2, 'history should show 2 certificates');
  const fileHref = await page.locator('.history a.btn').first().getAttribute('href');
  const res = await page.request.get(BASE.replace(/\/$/, '') + fileHref);
  check(res.ok(), 'the stored file should be served from /_blob');

  await page.locator('.rail .nav', { hasText: 'דרישות ביטוח' }).click();
  await page.waitForSelector('.profiles');
  await settle(page);
  await shot(page, '40-rules', true);
  await page.locator('#mn-tpl').fill('6,000,000');
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await settle(page, 800);
  await page.locator('.rail .nav', { hasText: 'לוח בקרה' }).click();
  await page.waitForSelector('section.kpis');
  await settle(page, 500);
  const fixAfter = await kpi(page, 2);
  check(fixAfter >= 8, 'raising the third-party minimum should mark many subs for fixing, got ' + fixAfter);
  await page.locator('.rail .nav', { hasText: 'דרישות ביטוח' }).click();
  await page.waitForSelector('.profiles');
  await page.locator('#mn-tpl').fill('5,000,000');
  await page.locator('.req-line', { hasText: 'ביטוח צד שלישי' }).locator('.codepick button', { hasText: '332' }).click();
  await page.locator('.req-line', { hasText: 'ביטוח צד שלישי' }).locator('.codepick button', { hasText: '332' }).click();
  await page.locator('#ac-tpl').fill('399');
  await page.locator('#ac-tpl').press('Enter');
  await settle(page, 200);
  check((await page.locator('.req-line', { hasText: 'ביטוח צד שלישי' }).locator('.codepick button', { hasText: 'קוד נוסף' }).count()) === 1, 'custom code should be added');
  await page.locator('.req-line', { hasText: 'ביטוח צד שלישי' }).locator('.codepick button', { hasText: 'קוד נוסף' }).click();
  await page.getByRole('button', { name: 'שמירה', exact: true }).click();
  await settle(page, 800);

  await page.getByRole('button', { name: 'ייבוא מנספח החוזה' }).click();
  await page.waitForSelector('#ct-text');
  await page.evaluate((c) => { window.__MOCK_ANSWER_NEXT = c; }, CONTRACT);
  await page.locator('#ct-text').fill('הקבלן יערוך ביטוח צד שלישי בגבול של 8 מיליון ₪ וביטוח חבות מעבידים...');
  await page.getByRole('button', { name: 'קריאת הדרישות' }).click();
  await page.waitForSelector('.modal .reqlist', { timeout: 10000 });
  await shot(page, '41-contract');
  await page.getByRole('button', { name: 'יצירת הפרופיל' }).click();
  await settle(page, 900);
  check((await page.locator('.prof').count()) === 5, 'contract import should add a fifth profile');

  await page.locator('.rail .nav', { hasText: 'בדיקת כניסה' }).click();
  await page.waitForSelector('.gates');
  await settle(page);
  await shot(page, '50-gate');
  await page.locator('.bigsearch input').fill('חשמל');
  await settle(page);
  check((await page.locator('.gatecard').count()) === 1 && (await text(page, '.gatecard .verdict-big')).includes('חסום'), 'gate search should show the blocked electrician');
  await page.locator('.bigsearch input').fill('אין כזה קבלן');
  await settle(page);
  check((await page.locator('.gates').count()) === 0 && (await text(page, '.card.empty b')).includes('לא נמצא'), 'unknown name should show the not-found note');

  await page.locator('.rail .nav', { hasText: 'יומן פעילות' }).click();
  await page.waitForSelector('.log');
  await shot(page, '60-log');
  check((await page.locator('.log li').count()) >= 10, 'log should hold the demo entries plus new ones');
  check((await page.locator('.log li', { hasText: 'נבדק אישור של א.ד. טפסנות' }).count()) >= 1, 'log should record the new check');

  await page.locator('.rail .nav', { hasText: 'הגדרות פרויקט' }).click();
  await page.waitForSelector('#ps-warn');
  await shot(page, '70-project');
  await page.locator('#ps-warn').selectOption('60');
  await page.getByRole('button', { name: 'שמירת השינויים' }).click();
  await settle(page, 700);
  await page.locator('.rail .nav', { hasText: 'לוח בקרה' }).click();
  await page.waitForSelector('section.kpis');
  await settle(page, 400);
  check((await kpi(page, 1)) === 3, 'warning window of 60 days should flag 3 subs, got ' + (await kpi(page, 1)));

  await page.evaluate(() => { location.hash = 'u-sdemo02'; });
  await page.waitForSelector('.portal', { timeout: 8000 });
  await settle(page, 400);
  await shot(page, '80-portal', true);
  await page.getByRole('button', { name: 'חזרה' }).click();
  await page.waitForSelector('.rec-head');

  await page.locator('.rail .nav', { hasText: 'לוח בקרה' }).click();
  await page.waitForSelector('section.kpis');
  await page.getByRole('button', { name: 'קבלן משנה' }).click();
  await page.waitForSelector('#sm-name');
  await shot(page, '85-add-sub');
  await page.locator('#sm-name').fill('ק.ר. מסגרות');
  await page.locator('#sm-cid').fill('517000111');
  await page.locator('#sm-trade').fill('מסגרות');
  await page.locator('#sm-phone').fill('050-0000000');
  await page.getByRole('button', { name: 'הוספה', exact: true }).click();
  await page.waitForSelector('.rec-head');
  await settle(page, 500);
  check((await text(page, '.rec-head .h1')).includes('ק.ר. מסגרות'), 'new sub should open');
  check((await text(page, '.stamp b')).includes('חסום'), 'new sub without certificate should be blocked');

  await page.locator('.rail .nav', { hasText: 'לוח בקרה' }).click();
  await page.waitForSelector('section.kpis');
  await page.getByRole('button', { name: 'קבלן משנה' }).click();
  await page.getByRole('button', { name: 'רשימה מאקסל' }).click();
  await page.locator('#sm-paste').fill('שם\tח.פ.\tתחום\nא.א. חשמל עליון\t518000001\tחשמל\tאלי\t050-0000001\nב.ב. ריצוף\t518000002\tריצוף');
  await settle(page, 300);
  await shot(page, '86-paste');
  check((await page.locator('.modal .tbl tbody tr').count()) === 2, 'paste preview should show 2 rows');
  await page.getByRole('button', { name: /הוספת 2 קבלנים/ }).click();
  await settle(page, 900);
  check((await page.locator('#subs-table tbody tr').count()) === 18, 'table should now list 18 subcontractors, got ' + (await page.locator('#subs-table tbody tr').count()));

  await page.getByRole('button', { name: 'ייצוא דוח' }).click();
  await settle(page, 500);
  const dl = await page.evaluate(() => window.__downloads);
  check(dl.length === 1 && dl[0].filename.endsWith('.csv') && dl[0].data.startsWith('﻿') && dl[0].data.split('\r\n').length === 19, 'export should save a 19-line CSV with BOM');

  await page.locator('.rail .switcher > button').click();
  await page.getByRole('menuitem', { name: 'פרויקט חדש' }).click();
  await page.waitForSelector('#np-name');
  await page.locator('#np-name').fill('מגדל הים, חיפה');
  await page.locator('#np-client').fill('א.ב. בנייה ופיתוח בע״מ');
  await page.locator('.modal .cover-opt').nth(0).click();
  await shot(page, '90-new-project');
  await page.getByRole('button', { name: 'יצירת הפרויקט' }).click();
  await page.waitForSelector('section.kpis', { timeout: 10000 });
  await settle(page, 900);
  await shot(page, '91-new-project-dashboard');
  check((await text(page, '.hero .h1')).includes('מגדל הים'), 'new project should open');
  check((await page.locator('#subs-table .empty').count()) === 1, 'new project should show the empty table state');
  await page.locator('.rail .nav', { hasText: 'דרישות ביטוח' }).click();
  await page.waitForSelector('.profiles');
  check((await page.locator('.prof').count()) === 4, 'new project should start with 4 profiles');
  await page.locator('.rail .nav', { hasText: 'הגדרות פרויקט' }).click();
  await page.getByRole('button', { name: 'מחיקת הפרויקט' }).click();
  await page.getByRole('button', { name: 'ללחוץ שוב למחיקה סופית' }).click();
  await page.waitForSelector('section.kpis', { timeout: 10000 });
  await settle(page, 800);
  check((await text(page, '.hero .h1')).includes('מתחם הדקלים'), 'after deleting, the demo project should be current');
  const left = await page.evaluate(() => Object.keys(window.__mockStore()).filter((k) => !k.includes('demo')).length);
  check(left === 3 + 1 + 1, 'only the 3 added subs, the contract profile and the new cert should remain outside demo ids, got ' + left);
});

/* ---------------- phone ---------------- */
await run('mobile', async (page) => {
  await loadDemo(page);
  await shot(page, 'm10-dashboard', true);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(sw <= 0, 'phone dashboard must not scroll sideways, overflow ' + sw);
  await page.locator('.cards .subcard', { hasText: 'א.ד. טפסנות' }).click();
  await page.waitForSelector('.rec-head');
  await settle(page, 500);
  await shot(page, 'm20-sub', true);
  const sw2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(sw2 <= 0, 'phone record must not scroll sideways, overflow ' + sw2);
  await page.getByRole('button', { name: 'עריכה' }).click();
  await page.waitForSelector('#sm-name');
  await shot(page, 'm21-edit-sheet');
  await page.keyboard.press('Escape');
  await page.locator('.tabbar button.mid').click();
  await page.waitForSelector('.check');
  await page.locator('#ck-sub').selectOption({ label: 'ת.א. נגרות' });
  await page.locator('.drop input[type=file]').setInputFiles(path.join(FIX, 'cert.jpg'));
  await page.waitForSelector('.sheet img', { timeout: 15000 });
  await page.getByRole('button', { name: 'קריאה אוטומטית' }).click();
  await page.waitForSelector('#ck-in', { timeout: 15000 });
  await settle(page, 500);
  await shot(page, 'm30-check', true);
  const calls = await page.evaluate(() => window.__sampleCalls);
  check(calls.length === 1 && calls[0].images.length === 2 && calls[0].images.every((i) => i.type === 'image/jpeg'), 'phone photo should be sent as 2 jpeg crops');
  const sw3 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(sw3 <= 0, 'phone check view must not scroll sideways, overflow ' + sw3);
  await page.locator('.tabbar button', { hasText: 'כניסה' }).click();
  await page.waitForSelector('.gates');
  await settle(page, 300);
  await shot(page, 'm40-gate');
  await page.locator('.tabbar button', { hasText: 'דרישות' }).click();
  await page.waitForSelector('.profiles');
  await settle(page, 300);
  await shot(page, 'm50-rules', true);
  const sw4 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(sw4 <= 0, 'phone rules must not scroll sideways, overflow ' + sw4);
  await page.locator('.tabbar button', { hasText: 'עוד' }).click();
  await page.waitForSelector('.modal');
  await shot(page, 'm60-more');
  await page.getByRole('button', { name: 'יומן פעילות' }).click();
  await page.waitForSelector('.log');
  await shot(page, 'm61-log');
  await page.evaluate(() => { location.hash = 'u-sdemo14'; });
  await page.waitForSelector('.portal');
  await settle(page, 300);
  await shot(page, 'm70-portal', true);
}, { viewport: { width: 390, height: 844 }, mobile: true });

/* ---------------- dark ---------------- */
await run('dark', async (page) => {
  await loadDemo(page);
  await shot(page, 'd10-dashboard');
  await openSub(page, 'י.ל. הנדסת מבנים');
  await shot(page, 'd20-sub', true);
  await page.locator('.rail .cta').click();
  await page.waitForSelector('.check');
  await page.locator('#ck-sub').selectOption({ label: 'ר.ג. אינסטלציה' });
  await page.getByRole('button', { name: 'אין קובץ? הזנה ידנית' }).click();
  await page.waitForSelector('#ck-in');
  await settle(page, 300);
  await shot(page, 'd30-manual', true);
  await page.locator('.rail .nav', { hasText: 'דרישות ביטוח' }).click();
  await page.waitForSelector('.profiles');
  await shot(page, 'd40-rules');
  await page.locator('.rail .nav', { hasText: 'בדיקת כניסה' }).click();
  await page.waitForSelector('.gates');
  await shot(page, 'd50-gate');
}, { scheme: 'dark' });

/* ---------------- outside Claude: local store, manual entry ---------------- */
await run('local', async (page) => {
  await page.goto(BASE);
  await page.waitForSelector('.welcome', { timeout: 20000 });
  check((await page.locator('.welcome .muted').count()) === 1, 'welcome should explain local storage');
  await page.getByRole('button', { name: 'פרויקט הדגמה' }).click();
  await page.waitForSelector('section.kpis', { timeout: 20000 });
  await settle(page, 600);
  check((await page.locator('.banner').count()) === 1, 'local mode banner should show');
  check((await page.getByRole('button', { name: 'ייצוא דוח' }).count()) === 1, 'export should be offered');
  await page.getByRole('button', { name: 'ייצוא דוח' }).click();
  await settle(page, 400);
  const lastToast = (await page.locator('.toast').last().innerText().catch(() => '')).trim();
  check(lastToast.includes('הועתקה') || lastToast.includes('ההעתקה'), 'export without downloads should copy the table, toast: ' + lastToast);
  await openSub(page, 'ת.א. נגרות');
  await page.getByRole('button', { name: 'העלאת אישור' }).first().click();
  await page.waitForSelector('.check');
  await page.locator('.drop input[type=file]').setInputFiles(path.join(FIX, 'cert.png'));
  await page.waitForSelector('#ck-in', { timeout: 15000 });
  await settle(page, 400);
  check((await page.locator('.notice').first().innerText()).includes('מזינים את פרטי האישור ידנית'), 'without Claude the page should explain manual entry');
  check((await page.locator('.pol').count()) === 2, 'manual form should prefill the 2 required policies');
  await page.locator('#ck-in').fill('ת.א. נגרות');
  await page.locator('#ck-rq').fill('א.ב. בנייה ופיתוח בע״מ');
  for (const i of [0, 1]) {
    await page.locator('#ps-' + i).fill('2026-06-01');
    await page.locator('#pe-' + i).fill('2027-05-31');
  }
  await page.locator('#pl-0').fill('5000000');
  await page.locator('#pl-1').fill('20000000');
  await page.locator('#pc-0').fill('302, 304, 309, 315, 321, 322, 328, 329');
  await page.locator('#pc-0').press('Tab');
  await page.locator('#pc-1').fill('304 309 319 328');
  await page.locator('#pc-1').press('Tab');
  await settle(page, 300);
  await shot(page, 'l10-manual', true);
  check((await text(page, '.verdict .verdict-big')).includes('יהיה מורשה'), 'manual entry with full data should pass, got ' + (await text(page, '.verdict')));
  await page.getByRole('button', { name: 'שמירת האישור' }).click();
  await page.waitForSelector('.rec-head', { timeout: 10000 });
  await settle(page, 600);
  check((await text(page, '.stamp b')).includes('מורשה'), 'saved manual certificate should allow entry');
  check((await text(page, '.history li')).includes('ללא קובץ'), 'local mode keeps no file');
  await page.reload();
  await page.waitForSelector('.rec-head', { timeout: 15000 });
  check((await text(page, '.rec-head .h1')).includes('ת.א. נגרות'), 'reload should reopen the same record from the link');
  await page.locator('.rail .nav').first().click();
  await page.waitForSelector('section.kpis', { timeout: 15000 });
  await settle(page, 600);
  check((await kpi(page, 3)) === 1, 'after reload the local store should keep the change (1 blocked), got ' + (await kpi(page, 3)));
}, { mock: { noClaude: true } });

/* ---------------- reading fails, then works manually ---------------- */
await run('ai-error', async (page) => {
  await loadDemo(page);
  await page.locator('.rail .cta').click();
  await page.waitForSelector('.check');
  await page.locator('#ck-sub').selectOption({ label: 'ס.מ. צבע' });
  await page.locator('.drop input[type=file]').setInputFiles(path.join(FIX, 'cert.pdf'));
  await page.waitForSelector('.sheet img', { timeout: 15000 });
  await page.getByRole('button', { name: 'קריאה אוטומטית' }).click();
  await page.waitForSelector('#ck-in', { timeout: 15000 });
  await settle(page, 300);
  await shot(page, 'e10-error');
  check((await text(page, '.notice.bad')).includes('יותר מדי בקשות'), 'rate limit should explain itself');
  check((await page.getByRole('button', { name: 'קריאה אוטומטית' }).count()) === 1, 'reading can be retried from the review step');
}, { mock: { sample: { mode: 'error:rate_limited', ms: 300 } } });

await run('ai-cancel', async (page) => {
  await loadDemo(page);
  await page.locator('.rail .cta').click();
  await page.waitForSelector('.check');
  await page.locator('#ck-sub').selectOption({ label: 'ס.מ. צבע' });
  await page.locator('.drop input[type=file]').setInputFiles(path.join(FIX, 'cert.pdf'));
  await page.waitForSelector('.sheet img', { timeout: 15000 });
  await page.getByRole('button', { name: 'קריאה אוטומטית' }).click();
  await settle(page, 400);
  await page.getByRole('button', { name: 'עצירה' }).click();
  await settle(page, 400);
  check((await page.getByRole('button', { name: 'קריאה אוטומטית' }).count()) === 1, 'stop should return to the ready step');
  check((await page.locator('#ck-in').count()) === 0, 'stop should not open the form');
}, { mock: { sample: { mode: 'ok', ms: 4000 } } });

/* ---------------- a viewer without file storage, and a failing write ---------------- */
await run('reader', async (page) => {
  await loadDemo(page);
  await page.locator('.rail .cta').click();
  await page.waitForSelector('.check');
  await page.locator('#ck-sub').selectOption({ label: 'ת.א. נגרות' });
  await page.locator('.drop input[type=file]').setInputFiles(path.join(FIX, 'cert.pdf'));
  await page.waitForSelector('.sheet img', { timeout: 15000 });
  await page.getByRole('button', { name: 'קריאה אוטומטית' }).click();
  await page.waitForSelector('#ck-in', { timeout: 15000 });
  await page.getByRole('button', { name: 'שמירת האישור' }).click();
  await page.waitForSelector('.rec-head', { timeout: 10000 });
  await settle(page, 500);
  check((await text(page, '.history li')).includes('ללא קובץ'), 'without assets the certificate is saved without its file');
}, { mock: { caps: ['db', 'sample', 'downloads', 'user'] } });

await run('write-fail', async (page) => {
  await loadDemo(page);
  await openSub(page, 'א.ד. טפסנות');
  await page.evaluate(() => { window.__MOCK_FAIL_NEXT = true; window.__MOCK_FAIL_CODE = 'quota_exceeded'; });
  await page.getByRole('button', { name: 'אישור חריגה' }).click();
  await page.locator('#waive-note').fill('בדיקה');
  await page.getByRole('button', { name: 'אישור החריגה' }).click();
  await settle(page, 800);
  check((await page.locator('.toast.bad').count()) === 1, 'a failed write should show an error toast');
  check((await page.locator('.modal').count()) === 1, 'the modal stays open after a failed write');
});

/* ---------------- a view-only member ---------------- */
await run('viewer', async (page) => {
  await page.goto(BASE);
  await page.waitForSelector('.welcome', { timeout: 20000 });
  check((await page.getByRole('button', { name: 'יצירת פרויקט' }).count()) === 0, 'a view-only viewer should not be offered project creation');
}, { mock: { canWrite: false, denyWrites: true, caps: ['db', 'sample', 'downloads', 'user'] } });

await run('viewer-seeded', async (page) => {
  // load the demo as the owner first, then come back as a view-only member in the same tab
  await loadDemo(page);
  await page.evaluate(() => sessionStorage.setItem('__mockOverride', JSON.stringify({ canWrite: false, denyWrites: true })));
  await page.reload();
  await page.waitForSelector('section.kpis', { timeout: 20000 });
  await settle(page, 600);
  await shot(page, 'v10-viewer');
  check((await page.locator('.banner', { hasText: 'צפייה בלבד' }).count()) === 1, 'view-only banner should show');
  check((await page.getByRole('button', { name: 'קבלן משנה' }).count()) === 0, 'add-subcontractor should be hidden for view-only');
  await openSub(page, 'א.ד. טפסנות');
  check((await page.getByRole('button', { name: 'עריכה' }).count()) === 0 && (await page.getByRole('button', { name: 'אישור חריגה' }).count()) === 0, 'record edit controls should be hidden for view-only');
  check(await page.locator('#sv-prof').isDisabled(), 'profile select should be disabled for view-only');
}, {});

await run('viewer-unknown', async (page) => {
  await loadDemo(page);
  await page.evaluate(() => sessionStorage.setItem('__mockOverride', JSON.stringify({ canWrite: null, denyWrites: true })));
  await page.reload();
  await page.waitForSelector('section.kpis', { timeout: 20000 });
  await openSub(page, 'א.ד. טפסנות');
  await page.getByRole('button', { name: 'אישור חריגה' }).click();
  await page.locator('#waive-note').fill('בדיקה');
  await page.getByRole('button', { name: 'אישור החריגה' }).click();
  await settle(page, 800);
  check((await page.locator('.banner', { hasText: 'צפייה בלבד' }).count()) === 1, 'a refused write with no stated level should switch to view-only');
}, {});

console.log(notes.join(' | '));
console.log(failures.length ? 'FAILURES (' + failures.length + '):\n- ' + failures.join('\n- ') : 'ALL CHECKS PASSED');
await browser.close();
srv.close();
