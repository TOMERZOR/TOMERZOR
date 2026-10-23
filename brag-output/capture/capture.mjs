// Captures the real game for the brag video, frame-perfect: the game is driven by hand at 30 fps
// (its own physics, renderer and slow motion), the level map steps through its five worlds with
// every CSS animation on a virtual clock, and the twelve balls are drawn by the game's renderer.
// usage: node capture/capture.mjs [hero|ember|night|map|balls ...]   (static server on :8080 serving shard/)
import pw from '/opt/node-tools/node_modules/playwright/index.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const { chromium } = pw;
const HERE = new URL('.', import.meta.url).pathname;
const ASSETS = new URL('../composition/assets/', import.meta.url).pathname;
const GAME = 'http://localhost:8080/index.html';
const FPS = 30;
const VIEW = { width: 392, height: 844 }; // a modern phone's points; even pixel sizes at every density used
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);
const pad = (n) => String(n).padStart(5, '0');

// a returning player: every world open, mostly perfect, sound off (the film gets its own mix)
const stars = {};
for (let w = 0; w < 5; w++) for (let i = 1; i <= 24; i++) stars[`w${w}-${i}`] = i % 7 === 3 ? 2 : 3;
const SAVE_ALL = { v: 1, stars, coins: 2480, skin: 'steel', owned: ['steel'], settings: { sfx: false, music: false, haptics: false }, tutorialDone: true, worldsSeen: [0, 1, 2, 3, 4] };
const SAVE_PLAY = { v: 1, stars: { 'w0-1': 3 }, coins: 0, skin: 'steel', owned: ['steel'], settings: { sfx: false, music: false, haptics: false }, tutorialDone: true, worldsSeen: [0, 1, 2, 3, 4] };

async function open(dpr, save) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  // a real phone's safe areas (status bar and camera above, home indicator below): the game lays itself out around them
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 54, bottom: 30, left: 0, right: 0 } });
  await page.addInitScript((s) => { localStorage.clear(); localStorage.setItem('shard.save', s); }, JSON.stringify(save));
  await page.goto(GAME);
  await page.waitForTimeout(900);
  // only what a player sees mid-level: no coach tips, toasts, title cards or the win sheet
  await page.addStyleTag({ content: '.toast, #sheet, #scrim, #worldcard, .coach { display: none !important; } .world-tabs { scroll-behavior: auto !important; }' });
  return { browser, page };
}

function encode(dir, out) {
  mkdirSync(out.replace(/[^/]+$/, ''), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${dir}/f%05d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
}

// one level, played with its solver proof: it assembles, the aim swings in, one shot clears it
async function gameClip(name, pickLevel, { dpr = 3, aimFrames = 16, after = 120 } = {}) {
  const { browser, page } = await open(dpr, SAVE_PLAY);
  const level = await page.evaluate(pickLevel);
  await page.evaluate(() => { window.__sfxLog = []; window.__simClock = 0; window.__shard.setManual(true); });
  await page.evaluate((i) => window.__shard.startLevel(i), level);
  const dir = `${HERE}frames-${name}`;
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  let f = 0;
  const step = async (per) => {
    if (per) await per();
    await page.evaluate((dt) => window.__shard.tick(dt), 1 / FPS);
    await page.screenshot({ path: `${dir}/f${pad(f++)}.jpg`, type: 'jpeg', quality: 93 });
  };
  const a = await page.evaluate(() => window.__shard.game.level.proof[0] * Math.PI / 180);
  for (let i = 0; i < 30; i++) await step();
  for (let i = 0; i < aimFrames; i++) await step(() => page.evaluate(([a, k]) => window.__shard.game.debugAim(a + (1 - k) * 0.35), [a, Math.min(1, (i + 1) / (aimFrames * 0.7))]));
  const fire = f;
  await page.evaluate(() => window.__shard.game.debugFire());
  for (let i = 0; i < after; i++) await step();
  const log = await page.evaluate(() => window.__sfxLog);
  const won = await page.evaluate(() => window.__shard.game.sim.st.won);
  await browser.close();
  encode(dir, `${ASSETS}clips/${name}.mp4`);
  // sound events in clip time: an event logged during tick k belongs to frame k-1
  writeFileSync(`${HERE}${name}-sfx.json`, JSON.stringify(log.map((e) => ({ ...e, t: Math.max(0, e.t - 1 / FPS) }))));
  console.log(name, { level: level + 1, frames: f, fireAt: +(fire / FPS).toFixed(3), won, events: log.length });
}

// the best one-shot levels of a world: lots of glass, cleared often by the average-player bot
const best = (w, need) => `(() => {
  const L = window.__shard.LEVELS, glass = (l) => l.objects.filter((o) => o.t === 'glass').length;
  const ok = L.map((l, i) => ({ l, i })).filter(({ l }) => l.world === ${w} && l.par === 1 && (${need})(l));
  ok.sort((a, b) => glass(b.l) * (0.5 + (b.l.win || 0)) - glass(a.l) * (0.5 + (a.l.win || 0)));
  return ok[0].i;
})()`;

// the level map, world by world: each world's map enters as it does in the game, then holds
async function mapClips(dpr = 3) {
  const { browser, page } = await open(dpr, SAVE_ALL);
  await page.evaluate(() => window.__shard.goHome());
  await page.waitForTimeout(300);
  await page.click('#btn-levels');
  await page.waitForTimeout(800);
  // every CSS animation and transition runs on a virtual clock, so each frame is exact
  await page.evaluate(() => {
    window.__drive = (t) => {
      for (const a of document.getAnimations()) {
        if (a.__t0 === undefined) a.__t0 = t;
        a.pause(); a.currentTime = Math.max(0, (t - a.__t0) * 1000);
      }
    };
  });
  for (const [w, n] of [[0, 24], [1, 24], [2, 24], [3, 24], [4, 75]]) {
    const dir = `${HERE}frames-map${w}`;
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    await page.evaluate((w) => document.querySelector(`.wtab[data-w="${w}"]`).click(), w);
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.__drive(t), (w * 100) + i / FPS);
      await page.screenshot({ path: `${dir}/f${pad(i)}.jpg`, type: 'jpeg', quality: 93 });
    }
    encode(dir, `${ASSETS}clips/map${w}.mp4`);
  }
  await browser.close();
  console.log('map clips: 5 worlds');
}

// the twelve balls, drawn by the game's own renderer onto transparent canvases
async function balls() {
  const { browser, page } = await open(1, SAVE_ALL);
  const out = await page.evaluate(async () => {
    const { createRenderer } = await import('/js/render.js');
    const { SKINS } = await import('/js/theme.js');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0';
    const stage = document.createElement('canvas'); host.appendChild(stage); document.body.appendChild(host);
    const r = createRenderer(stage);
    return SKINS.map((s) => {
      const c = document.createElement('canvas'); c.width = c.height = 360;
      r.drawBall(c.getContext('2d'), 180, 176, 130, s, 0.4);
      return { id: s.id, name: s.name, png: c.toDataURL('image/png') };
    });
  });
  mkdirSync(`${ASSETS}img/balls`, { recursive: true });
  for (const b of out) writeFileSync(`${ASSETS}img/balls/${b.id}.png`, Buffer.from(b.png.split(',')[1], 'base64'));
  writeFileSync(`${HERE}balls.json`, JSON.stringify(out.map(({ id, name }) => ({ id, name }))));
  await browser.close();
  console.log('balls', out.map((b) => b.id).join(' '));
}

if (want('hero')) await gameClip('hero', best(0, '(l) => glass(l) >= 6'), { after: 130 });
if (want('ember')) await gameClip('ember', best(3, "(l) => l.objects.some((o) => o.t === 'bomb')"), { after: 120 });
if (want('night')) await gameClip('night', best(4, "(l) => l.objects.some((o) => o.t === 'rope')"), { dpr: 5, after: 130 });
if (want('map')) await mapClips(3);
if (want('balls')) await balls();
