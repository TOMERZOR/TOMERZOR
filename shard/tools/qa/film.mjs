// Filmstrip: plays a level's proof shot frame by frame (manual clock) and saves a contact sheet,
// so motion and effects can be judged from stills.
// usage: node qa/film.mjs <levelIndex|daily:N|home> [frames=24] [every=3] [name]
//   env: SIZE=390x844 DPR=2 OUT=dir  (needs the static server on :8080)
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [what = '0', framesArg = '24', everyArg = '3', nameArg] = process.argv.slice(2);
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-TOMERZOR/6ca015aa-c358-5e4d-be14-3a5969a5568f/scratchpad/film';
const name = nameArg || `film-${what.replace(':', '')}`;
const dir = `${OUT}/${name}`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const [w, h] = (process.env.SIZE || '390x844').split('x').map(Number);
const FRAMES = +framesArg, EVERY = +everyArg, FPS = 60;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR || 2), isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => { if (!sessionStorage.getItem('film')) { localStorage.clear(); localStorage.setItem('shard.save', JSON.stringify({ v: 1, stars: { 'w0-1': 3, 'w0-2': 3, 'w0-3': 3 }, coins: 240, tutorialDone: true, settings: { sfx: true, music: false, haptics: false } })); sessionStorage.setItem('film', '1'); } });
await page.goto(process.env.URL || 'http://localhost:8080/index.html');
await page.waitForTimeout(700);
await page.evaluate(() => window.__shard.setManual(true));
let n = 0;
const tick = (k = 1) => page.evaluate(([k, dt]) => { for (let i = 0; i < k; i++) window.__shard.tick(dt); }, [k, 1 / FPS]);
const snap = async (label) => { await page.screenshot({ path: `${dir}/${String(n).padStart(3, '0')}${label ? '-' + label : ''}.png` }); n++; };

if (what === 'home') {
  await page.evaluate(() => window.__shard.goHome());
  for (let i = 0; i < FRAMES; i++) { await tick(EVERY); await snap(); }
} else {
  const daily = what.startsWith('daily:');
  const idx = +(daily ? what.slice(6) : what);
  await page.evaluate(([i, daily]) => {
    const s = window.__shard;
    if (daily) s.startLevel(0, { daily: true, level: s.DAILY[i], dateKey: 'film' }); else s.startLevel(i);
  }, [idx, daily]);
  // INTRO=1: film the level assembling itself, then stop
  if (process.env.INTRO) { for (let i = 0; i < FRAMES; i++) { await snap(); await tick(EVERY); } }
  await tick(20); await snap('start');
  const proof = process.env.INTRO ? [] : await page.evaluate(() => window.__shard.game.level.proof);
  for (const [k, deg] of proof.entries()) {
    const a = deg * Math.PI / 180;
    for (let i = 0; i < 12; i++) { await page.evaluate(([a, t]) => window.__shard.game.debugAim(a + (1 - t) * 0.3), [a, Math.min(1, (i + 1) / 8)]); await tick(1); }
    await snap('aim' + k);
    await page.evaluate(() => window.__shard.game.debugFire());
    // BREAK=1: fast-forward to the first piece of glass breaking, then film it closely
    if (process.env.BOMB) {
      const bombs = () => page.evaluate(() => window.__shard.game.sim.ents.filter((e) => e.alive && e.kind === 'bomb').length);
      const n0 = await bombs();
      await page.evaluate(([n0, dt]) => { const S = window.__shard; for (let i = 0; i < 900 && S.game.sim.ents.filter((e) => e.alive && e.kind === 'bomb').length === n0; i++) S.tick(dt); }, [n0, 1 / FPS]);
      await snap('boom');
    } else if (process.env.BREAK) {
      const b0 = await page.evaluate(() => window.__shard.game.sim.st.broken);
      await page.evaluate(([b0, dt]) => { for (let i = 0; i < 600 && window.__shard.game.sim.st.broken === b0; i++) window.__shard.tick(dt); }, [b0, 1 / FPS]);
      await snap('break');
    }
    for (let i = 0; i < FRAMES; i++) { await tick(EVERY); await snap(); if (await page.evaluate(() => window.__shard.game.sim.st.won)) { for (let j = 0; j < 6; j++) { await tick(EVERY * 3); await snap('end'); } break; } }
    if (await page.evaluate(() => window.__shard.game.sim.st.won)) break;
    await tick(90);
  }
  await tick(120); await snap('result');
}
await browser.close();
execFileSync('python3', ['-c', `
import sys, glob
from PIL import Image
files = sorted(glob.glob(sys.argv[1] + '/*.png'))
ims = [Image.open(f).convert('RGB') for f in files]
cols = 6 if len(ims) > 12 else 4
W = 300; H = int(ims[0].height * W / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W + (cols - 1) * 6, rows * H + (rows - 1) * 6), 'black')
for i, im in enumerate(ims):
    sheet.paste(im.resize((W, H)), ((i % cols) * (W + 6), (i // cols) * (H + 6)))
sheet.save(sys.argv[2])
print('sheet', sys.argv[2], len(ims), 'frames')
`, dir, `${OUT}/${name}.png`], { stdio: 'inherit' });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
