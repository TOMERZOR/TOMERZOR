// Frame-perfect trailer capture: drives the game by hand at 30 fps, screenshots each frame
// at 1080x1920, logs every sound event, then a Python mixer builds the soundtrack.
// usage: node qa/trailer.mjs  (needs the static server on :8080)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';

const OUT = process.env.OUT || '/tmp/claude-0/-home-user-TOMERZOR/6ca015aa-c358-5e4d-be14-3a5969a5568f/scratchpad/trailer';
const FPS = 30;
rmSync(`${OUT}/frames`, { recursive: true, force: true });
mkdirSync(`${OUT}/frames`, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('shard.save', JSON.stringify({ v: 1, stars: { 'w0-1': 3 }, coins: 0, settings: { sfx: false, music: false, haptics: false } })); });
await page.goto('http://localhost:8080/index.html');
await page.waitForTimeout(800);
await page.addStyleTag({ content: `
  #hud, #home, .toast, #sheet, #scrim { display: none !important; }
  #cap { position: fixed; left: 50%; top: 4.2%; transform: translateX(-50%); width: max-content; max-width: 86%; text-align: center; font: 900 23px/1.15 ui-rounded, system-ui, sans-serif; color: var(--sky0); background: color-mix(in srgb, var(--ink) 90%, transparent); padding: 12px 20px; border-radius: 22px; letter-spacing: -.005em; box-shadow: 0 10px 30px -12px rgba(0,0,0,.45); }
  #cap:empty { display: none; }
  #cap small { display: block; font-size: 13px; font-weight: 800; opacity: .75; margin-top: 4px; letter-spacing: .06em; text-transform: uppercase; }
  #end { position: fixed; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 18px; background: linear-gradient(160deg, #3A2E7A, #191339); color: #fff; text-align: center; font-family: ui-rounded, system-ui, sans-serif; }
  #end img { width: 132px; height: 132px; border-radius: 30px; box-shadow: 0 20px 50px -10px rgba(0,0,0,.5); }
  #end h1 { margin: 0; font-size: 64px; font-weight: 900; letter-spacing: .04em; }
  #end p { margin: 0; font-size: 22px; font-weight: 800; opacity: .8; }
  #end .pill { margin-top: 8px; padding: 12px 22px; border-radius: 999px; background: #FF6B57; font-weight: 900; font-size: 18px; }
` });
await page.evaluate(() => {
  const c = document.createElement('div'); c.id = 'cap'; document.body.appendChild(c);
  const e = document.createElement('div'); e.id = 'end';
  e.innerHTML = '<img src="assets/icon-512.png" alt=""><h1>SHARD</h1><p>Aim. Fire. Shatter.</p><div class="pill">Free on iPhone &amp; Android</div>';
  document.body.appendChild(e);
  window.__sfxLog = []; window.__simClock = 0;
  window.__shard.setManual(true);
});

let frame = 0;
async function snap() {
  await page.screenshot({ path: `${OUT}/frames/f${String(frame).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  frame++;
}
async function run(frames, perFrame) {
  for (let i = 0; i < frames; i++) {
    if (perFrame) await perFrame(i);
    await page.evaluate((dt) => window.__shard.tick(dt), 1 / FPS);
    await snap();
  }
}
const caption = (html) => page.evaluate((h) => { document.getElementById('cap').innerHTML = h; }, html);

// segments: pick par-1 levels from the generated campaign with a lot of glass
const pick = await page.evaluate(() => {
  const L = window.__shard.LEVELS;
  const glass = (l) => l.objects.filter((o) => o.t === 'glass').length;
  const best = (w, pred = () => true) => L.map((l, i) => ({ l, i })).filter(({ l }) => l.world === w && l.par === 1 && pred(l)).sort((a, b) => glass(b.l) * (0.5 + b.l.win) - glass(a.l) * (0.5 + a.l.win))[0];
  return {
    dawn: best(0, (l) => glass(l) >= 6)?.i ?? 3,
    ember: best(3, (l) => l.objects.some((o) => o.t === 'bomb'))?.i ?? 72,
    night: best(4, (l) => l.objects.some((o) => o.t === 'rope'))?.i ?? 96,
    mint: best(1, (l) => glass(l) >= 6)?.i ?? 30,
  };
});
console.log('segments', pick);

async function shotSegment(index, cap, holdAim = 14, after = 70) {
  await page.evaluate((i) => window.__shard.startLevel(i), index);
  await caption(cap);
  const proof = await page.evaluate(() => window.__shard.game.level.proof);
  const a = proof[0] * Math.PI / 180;
  await run(8);
  // swing the aim in from the side for a natural look
  await run(holdAim, (i) => page.evaluate(([a, k]) => window.__shard.game.debugAim(a + (1 - k) * 0.35), [a, Math.min(1, (i + 1) / (holdAim * 0.7))]));
  await page.evaluate(() => window.__shard.game.debugFire());
  await run(after);
}

await shotSegment(0, 'The most satisfying sound<br>on your phone<small>Sound on</small>', 12, 62);
await shotSegment(pick.dawn, 'One shot. Every piece.', 14, 80);
await shotSegment(pick.ember, 'Chain reactions', 14, 80);
await shotSegment(pick.night, '120 levels · 5 worlds', 14, 80);
await page.evaluate(() => { document.getElementById('end').style.display = 'flex'; document.getElementById('cap').innerHTML = ''; });
await run(75);

const log = await page.evaluate(() => window.__sfxLog);
writeFileSync(`${OUT}/sfx-log.json`, JSON.stringify(log));
console.log('frames', frame, 'sound events', log.length);
await browser.close();
