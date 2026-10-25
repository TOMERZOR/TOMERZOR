// The web build (app/index.html) opened as a plain page, with no viewer runtime:
// node tokef/test/standalone.mjs /tmp/tokef-standalone
import http from 'http';
import fs from 'fs';
import path from 'path';
import { ROOT, VENDOR, launch, watch } from './harness.mjs';

const OUT = process.argv[2] || '/tmp/tokef-standalone';
const WEB = path.join(ROOT, 'app');
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
fs.mkdirSync(OUT, { recursive: true });

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/tokef\/app/, '');
  if (p === '/' || p === '') p = '/index.html';
  const f = path.join(WEB, p);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }
  else { res.writeHead(404); res.end(); }
}).listen(8791);

function cdnFile(url) {
  const m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^@/]+)@([^/]+)\/(.+)$/.exec(url);
  return m ? path.join(VENDOR, m[1].replace('@', '').replace('/', '-') + '-' + m[2], 'package', m[3]) : null;
}

const browser = await launch();
const errors = [];
let ok = true;
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const ctx = await browser.newContext({ ...opts, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  await ctx.route('https://cdn.jsdelivr.net/**', async (r) => {
    const f = cdnFile(r.request().url());
    if (f && fs.existsSync(f)) await r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) });
    else await r.fulfill({ status: 404, body: '' });
  });
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  watch(page, errors);
  await page.goto('http://127.0.0.1:8791/tokef/app/');
  const hasClaude = await page.evaluate(() => !!window.claude);
  if (hasClaude) { errors.push(name + ': window.claude exists in a plain page'); ok = false; }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, name + '-1-first.png') });
  const demo = page.getByRole('button', { name: /הדגמה/ }).first();
  if (await demo.count()) {
    await demo.click();
    await page.waitForTimeout(1500);
  } else { errors.push(name + ': no demo button'); ok = false; }
  await page.screenshot({ path: path.join(OUT, name + '-2-demo.png') });
  const text = await page.evaluate(() => document.body.innerText);
  if (!/מתחם הדקלים/.test(text)) { errors.push(name + ': demo project did not load'); ok = false; }
  await page.reload();
  await page.waitForTimeout(1500);
  const kept = await page.evaluate(() => document.body.innerText);
  if (!/מתחם הדקלים/.test(kept)) { errors.push(name + ': data not kept after reload'); ok = false; }
  await page.screenshot({ path: path.join(OUT, name + '-3-reload.png') });
  await ctx.close();
}
await browser.close();
srv.close();
if (errors.length) console.log(errors.join('\n'));
console.log(ok && !errors.length ? 'standalone: ok' : 'standalone: FAILED');
process.exit(ok && !errors.length ? 0 : 1);
