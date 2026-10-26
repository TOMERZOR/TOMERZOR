const { chromium } = require('playwright');
const OUT = process.argv[2];
const AI = '(עונה לך העוזרת הדיגיטלית של מאיה 🤖 · מאיה קוראת הכל)';
const R = (o) => ({ campaign_id: 'lumi', intent: 'price', confidence: 0.98, handoff: false, handoff_reason: '', note: '', detection: { campaignId: 'lumi', confidence: 0.98, reasons: [] }, ...o });
function replyFor(text) {
  if (text.includes('כמה')) return R({ messages: ['היי מותק 💛 הוא עולה עכשיו ₪119 במקום 149!', `ועם הקוד MAYA20 יש עוד 20% הנחה 🙈\nhttps://example.com/lumi-serum\n\n${AI}`] });
  if (text.includes('רגיש')) return R({ intent: 'product', confidence: 0.94, messages: ['כן מאמי! הוא בלי בישום ומתאים גם לעור רגיש ✨ אני שמה אותו כל בוקר כבר חודש'] });
  if (text.includes('הריון')) return R({ intent: 'product', confidence: 0.91, handoff: true, handoff_reason: 'שאלה רפואית (הריון)', messages: [`שאלה חשובה מותק 💛 אני מעבירה אותה למאיה שתענה לך אישית\n\n${AI}`] });
  if (text.includes('קוד')) return R({ intent: 'coupon', confidence: 0.97, messages: [`בטח! הקוד MAYA20 נותן 20% הנחה\n\n${AI}`] });
  return R({ messages: ['תודה יפה שלי 🥹'] });
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 620, height: 1100 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await p.route('**/api/health', r => r.fulfill({ json: { ok: true, claude: true, instagram: true, storage: 'kv', auth: true, model: 'claude-opus-5-5' } }));
  await p.route('**/api/reply', async r => { const b = JSON.parse(r.request().postData()); await new Promise(x => setTimeout(x, 150)); r.fulfill({ json: { reply: replyFor(b.text) } }); });
  await p.goto('http://localhost:8787/');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('.engine[data-state="ready"]');
  await p.addStyleTag({ content: 'body.promo .composer, body.promo .chat-head .btn, body.promo .chat-head .chip { display: none !important } body.promo .messages { max-height: none } .toast { display: none !important } .samples { display: none !important }' });
  const promo = (on) => p.evaluate((on) => document.body.classList.toggle('promo', on), on);
  const setMode = async (m) => { await p.evaluate((m) => { const s = JSON.parse(localStorage.getItem('koli.state') || 'null'); }, m); };
  // auto mode via the UI
  await p.click('[data-tab="personality"]'); await p.click('text=עונה לבד'); await p.click('[data-tab="inbox"]');
  const send = async (text, story) => {
    await p.selectOption('#story-ref', story || '');
    await p.fill('#fan-text', text); await p.click('.composer .send .btn');
    await p.waitForFunction(() => !document.querySelector('.typing')); await p.waitForTimeout(700);
  };
  await send('כמה זה עולה???', 'st-lumi-1');
  await send('זה מתאים לעור רגיש? יש לי אדמומיות');
  await promo(true); await p.locator('.chat').screenshot({ path: `${OUT}/chat.png` }); await promo(false);
  // drafts
  await p.click('[data-tab="personality"]'); await p.click('text=טיוטות שאני מאשר/ת'); await p.click('[data-tab="inbox"]');
  await p.click('text=+ שיחה חדשה'); await p.fill('#fan-name', 'נוי');
  await send('אפשר לשים את הסרום בהריון?');
  await promo(true); await p.locator('.chat').screenshot({ path: `${OUT}/handoff.png` }); await promo(false);
  await p.click('text=+ שיחה חדשה'); await p.fill('#fan-name', 'יעל');
  await send('יש קוד הנחה?', 'st-lumi-2');
  await p.fill('#draft-0', `בטחחח מאמי! MAYA20 ותקבלי 20% הנחה 🙈\n\n(עונה לך העוזרת הדיגיטלית של מאיה 🤖 · מאיה קוראת הכל)`);
  await p.locator('.draft').screenshot({ path: `${OUT}/draft.png` });
  await p.click('.draft .btn >> text=שליחה'); await p.waitForTimeout(600);
  await p.locator('.stats').screenshot({ path: `${OUT}/stats.png` });
  await p.click('[data-tab="voice"]'); await p.waitForTimeout(600);
  const cards = p.locator('.view > .card');
  for (const a of ['היי מותקקק 💛 הוא 119₪ עכשיו, שווה כל שקל!', 'וואי בכיתי 🥹 תודה יפה שלי', 'זארה! לפני שבועיים, נראה לי עוד יש']) {
    await p.fill('.quiz textarea', a); await p.click('.quiz .btn >> text=הבא');
  }
  await p.fill('.quiz textarea', 'אוי לא מאמי 😢 ספרי לי מה קרה? לפעמים לוקח כמה שבועות לראות תוצאות');
  await p.waitForTimeout(500);
  await p.locator('.quiz').screenshot({ path: `${OUT}/quiz.png` });
  await cards.nth(3).screenshot({ path: `${OUT}/profile.png` });
  await cards.nth(4).screenshot({ path: `${OUT}/learned.png` });
  await cards.nth(2).screenshot({ path: `${OUT}/sources.png` });
  await p.click('[data-tab="personality"]'); await p.waitForTimeout(600);
  await p.locator('.sliders').locator('xpath=..').screenshot({ path: `${OUT}/sliders.png` });
  await p.locator('.card:has(h2:text("שקיפות"))').screenshot({ path: `${OUT}/disclosure.png` });
  await p.locator('.card:has(h2:text("גבולות"))').screenshot({ path: `${OUT}/limits.png` });
  await p.click('[data-tab="campaigns"]'); await p.waitForTimeout(500); await p.click('text=עריכה'); await p.waitForTimeout(500);
  await p.locator('.campaigns > .card').screenshot({ path: `${OUT}/campaign.png` });
  await p.evaluate(() => localStorage.setItem('koli.settings', JSON.stringify({ apiBase: 'https://koli-api.maya.workers.dev', token: 'x' })));
  await p.reload(); await p.waitForSelector('.engine[data-state="ready"]'); await p.addStyleTag({ content: '.toast{display:none!important}' });
  await p.click('[data-tab="connect"]'); await p.waitForTimeout(600);
  await p.locator('.card:has(h2:text("צעד אחר צעד"))').screenshot({ path: `${OUT}/setup.png` });
  await p.locator('header.top').screenshot({ path: `${OUT}/header.png` });
  await b.close();
})();
