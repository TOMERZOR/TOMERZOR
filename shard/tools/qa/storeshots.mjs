// Store screenshots: captures real game moments at 430x932 @3x, then frames them with captions.
// usage: node qa/storeshots.mjs  (static server on :8080 serving /home/user/TOMERZOR/shard)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const RAW = new URL('./out/', import.meta.url).pathname;
const FINAL = new URL('../../../game-studio/store/screenshots/', import.meta.url).pathname;
mkdirSync(RAW, { recursive: true }); mkdirSync(FINAL, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
// a returning player with some progress, so menus look lived-in
await page.addInitScript(() => {
  const stars = {};
  for (let w = 0; w < 2; w++) for (let i = 1; i <= 24; i++) stars[`w${w}-${i}`] = i % 5 === 0 ? 2 : 3;
  for (let i = 1; i <= 9; i++) stars[`w2-${i}`] = 3;
  const today = new Date(); const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const ykey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  localStorage.setItem('shard.save', JSON.stringify({ v: 1, stars, coins: 2480, skin: 'gold', owned: ['steel', 'chalk', 'coral', 'jade', 'gold', 'moon'], settings: { sfx: false, music: false, haptics: false }, daily: { last: ykey, streak: 6, best: 6, done: {} }, hints: { 0: true, 1: true } }));
  void key;
});
await page.goto('http://localhost:8080/index.html');
await page.waitForTimeout(900);
await page.addStyleTag({ content: '.coach, .toast { display: none !important; } body.nosheet #sheet, body.nosheet #scrim { display: none !important; }' });
await page.evaluate(() => document.body.classList.add('nosheet'));
await page.evaluate(() => window.__shard.setManual(true));
const tick = (n = 1, dt = 1 / 60) => page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__shard.tick(dt); }, [n, dt]);
const raw = async (name) => { await page.screenshot({ path: `${RAW}${name}.png` }); return name; };

const L = await page.evaluate(() => {
  const L = window.__shard.LEVELS;
  const glass = (l) => l.objects.filter((o) => o.t === 'glass').length;
  const best = (w, pred = () => true) => L.map((l, i) => ({ l, i })).filter(({ l }) => l.world === w && pred(l)).sort((a, b) => glass(b.l) - glass(a.l))[0]?.i ?? L.findIndex((l) => l.world === w);
  return {
    dawn: best(0, (l) => l.par === 1 && glass(l) >= 6),
    lilac: best(2, (l) => l.objects.some((o) => o.t === 'pad')),
    ember: best(3, (l) => l.par === 1 && l.objects.some((o) => o.t === 'bomb')),
    night: best(4, (l) => l.objects.filter((o) => o.t === 'rope').length >= 3),
  };
});
console.log('levels', L);

async function playUntil(index, stopWhen, maxFrames = 400) {
  await page.evaluate((i) => window.__shard.startLevel(i), index);
  await tick(20);
  const a = await page.evaluate(() => window.__shard.game.level.proof[0] * Math.PI / 180);
  await page.evaluate((a) => { window.__shard.game.debugAim(a); }, a);
  await tick(2);
  await page.evaluate(() => window.__shard.game.debugFire());
  for (let f = 0; f < maxFrames; f++) {
    await tick(1);
    if (await page.evaluate(stopWhen)) return true;
  }
  return false;
}

const shots = [];
// 1: mid-shatter on the final piece (slow motion)
await playUntil(L.dawn, () => window.__shard.game.sim.st.won);
await tick(10);
shots.push({ img: await raw('raw1'), cap: 'Aim. Fire. Shatter.', sub: 'The most satisfying sound on your phone', world: 0 });
// 2: aiming with the trajectory preview
await page.evaluate((i) => window.__shard.startLevel(i), L.lilac);
await tick(20);
await page.evaluate(() => { const g = window.__shard.game; g.debugAim(g.level.proof[0] * Math.PI / 180 + 0.05); });
await tick(2);
shots.push({ img: await raw('raw2'), cap: 'Bank it off the walls', sub: 'Every level is proven solvable', world: 2 });
// 3: explosion
await playUntil(L.ember, () => window.__shard.game.sim.st.broken >= 3 && window.__shard.game.sim.shards.length > 20);
await tick(3);
shots.push({ img: await raw('raw3'), cap: 'Chain reactions', sub: 'Bombs, stone, timber, glass', world: 3 });
// 4: night chandeliers at rest
await page.evaluate((i) => window.__shard.startLevel(i), L.night);
await tick(30);
shots.push({ img: await raw('raw4'), cap: '5 worlds. 120 levels.', sub: 'Plus a new puzzle every day', world: 4 });
// 5: home with the daily card
await page.evaluate(() => { document.body.classList.remove('nosheet'); window.__shard.goHome(); });
await tick(90);
await page.waitForTimeout(900);
shots.push({ img: await raw('raw5'), cap: 'A new puzzle daily', sub: 'Keep your streak alive', world: 1 });
// 6: shop
await page.evaluate(() => document.getElementById('btn-shop').click());
await tick(30);
await page.waitForTimeout(500);
shots.push({ img: await raw('raw6'), cap: 'Collect 12 balls', sub: 'From Chalk to Prism', world: 1 });

// frame them: App Store 6.9" (1290x2796) and Google Play (1080x1920, Play caps the aspect ratio at 2:1)
const WORLDS = await page.evaluate(async () => (await import('/js/theme.js')).WORLDS);
const comp = await ctx.newPage();
await comp.setViewportSize({ width: 430, height: 932 });
const { writeFileSync, mkdirSync: mk } = await import('node:fs');
const sets = [{ dir: FINAL, w: 1290, h: 2796 }, { dir: FINAL + 'google-play/', w: 1080, h: 1920 }];
for (const set of sets) {
  mk(set.dir, { recursive: true });
  for (const [i, s] of shots.entries()) {
    const w = WORLDS[s.world];
    const q = new URLSearchParams({ img: `/tools/qa/out/${s.img}.png`, cap: s.cap, sub: s.sub, c0: w.sky[0], c1: w.sky[1], ink: w.dark ? '#E7EAF6' : w.ink, accent: w.accent, w: set.w, h: set.h });
    await comp.goto(`http://localhost:8080/tools/qa/storeshot.html?${q}`);
    await comp.waitForFunction(() => document.title === 'ready' || document.title === 'error');
    const data = await comp.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    writeFileSync(`${set.dir}${String(i + 1).padStart(2, '0')}-${s.cap.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
}
console.log('store screenshots written to', FINAL);
await browser.close();
