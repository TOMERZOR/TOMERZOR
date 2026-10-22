// QA helper: open the game on a phone-sized viewport, run actions, save screenshots.
// usage: node qa/shot.mjs <script.json-ish name> ; see scenarios below
import { chromium } from 'playwright';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-TOMERZOR/6ca015aa-c358-5e4d-be14-3a5969a5568f/scratchpad/qa';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:8080/index.html';
const [w, h] = (process.env.SIZE || '390x844').split('x').map(Number);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR || 2), isMobile: true, hasTouch: true });
const page = await ctx.newPage();
if (process.env.THROTTLE) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE }); }
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
if (process.env.FRESH !== '0') await page.addInitScript(() => { if (!sessionStorage.getItem('qa')) { localStorage.clear(); sessionStorage.setItem('qa', '1'); } });
await page.goto(URL);
await page.waitForTimeout(800);

const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
// drag-to-shoot: pull from (x,y) by (dx,dy) in CSS px
async function pull(x, y, dx, dy, steps = 8) {
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(x + dx * i / steps, y + dy * i / steps); await wait(16); }
  return { release: async () => { await page.mouse.up(); } };
}
// aim at an angle in degrees using the pull vector
async function aimAt(deg, len = 160) {
  const a = deg * Math.PI / 180;
  const x = w / 2, y = h * 0.55;
  return pull(x, y, -Math.cos(a) * len, Math.sin(a) * len);
}
const api = { page, wait, shot, pull, aimAt, w, h };
const scenario = process.argv[2] || 'basic';
const mod = await import(`./scenarios/${scenario}.mjs`);
try { await mod.default(api); } catch (e) { errors.push('[scenario] ' + e.stack); }
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
