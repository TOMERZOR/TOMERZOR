// Real screenshots of Koli for the connection guide (img/guide/).
// Run the local app first (node tools/serve.mjs 8787), then: node guide-shots.cjs <out-dir>
const { chromium } = require('playwright');
const OUT = process.argv[2];
const AI = '(עונה לך העוזרת הדיגיטלית של מאיה 🤖 · מאיה קוראת הכל)';
const now = Date.now();
const conv = {
  id: '17841400000000001', fanName: 'שירה כהן', username: 'shira.c', lastCampaignId: 'lumi', pausedUntil: 0, needsHuman: false,
  messages: [{ from: 'fan', text: 'כמה זה עולה???', storyId: 'st-lumi-1', at: now - 60000 }],
  draft: { messages: [`היי מותק 💛 הוא עולה עכשיו ₪119 במקום 149, ועם הקוד MAYA20 יש עוד 20% 🙈\n\n${AI}`], meta: { campaignId: 'lumi', intent: 'price', confidence: 0.98, handoff: false }, fanText: 'כמה זה עולה???', at: now },
};
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await p.route('**/api/health', r => r.fulfill({ json: { ok: true, claude: true, instagram: true, storage: 'kv', auth: true, model: 'claude-opus-5-5' } }));
  await p.route('**/api/config', r => r.fulfill({ json: { state: null, ok: true } }));
  await p.route('**/api/conversations', r => r.fulfill({ json: { conversations: [{ id: conv.id, fanName: conv.fanName, username: conv.username, updatedAt: now, needsHuman: false, hasDraft: true, paused: false, last: { from: 'fan', text: 'כמה זה עולה???' } }, { id: '2', fanName: 'נוי לוי', username: 'noy', updatedAt: now - 3600e3, needsHuman: true, hasDraft: false, paused: false, last: { from: 'bot', text: 'שאלה חשובה מותק 💛 אני מעבירה אותה למאיה' } }] } }));
  await p.route('**/api/conversations/*', r => r.fulfill({ json: { conversation: conv } }));
  await p.goto('http://localhost:8787/');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('koli.settings', JSON.stringify({ apiBase: 'https://koli-api.maya.workers.dev', token: 'k0li-admin-7f3a91c2' })); });
  await p.goto('http://localhost:8787/#connect'); await p.reload();
  await p.waitForSelector('.engine[data-state="ready"]');
  await p.addStyleTag({ content: '.toast{display:none!important} .view > .intro{display:none}' });
  await p.waitForTimeout(700);
  await p.locator('.view .grid2').first().screenshot({ path: `${OUT}/connect-server.png` });
  await p.click('.card:has(h2:text("שיחות אמיתיות")) header .btn'); await p.waitForTimeout(500);
  await p.click('.thread >> nth=0'); await p.waitForTimeout(700);
  await p.locator('.card:has(h2:text("שיחות אמיתיות"))').screenshot({ path: `${OUT}/real-inbox.png` });
  await b.close();
})();
