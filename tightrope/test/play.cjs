// Plays level 1 in a phone-sized browser with simulated motion sensors and
// saves screenshots. A bot reads the walker's lean and tilts the fake phone.
// Run: npx http-server -p 8091 . (from the repo root), then
//      node tightrope/test/play.cjs [outDir] [level]
const { chromium } = require('playwright');
const path = require('path');

const out = process.argv[2] || '.';
const level = Number(process.argv[3] || 1);
const URL = process.env.URL || 'http://localhost:8091/tightrope/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((lvl) => {
    localStorage.setItem('tightrope.v1', JSON.stringify({ unlocked: lvl, tutorialSeen: true }));
    // Fake phone held at 50° pitch; roll gamma comes from the bot.
    const beta = 50 * Math.PI / 180;
    let gamma = 0.05, last = performance.now();
    window.__bot = { on: true, scale: 1 };
    setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const tr = window.__tightrope;
      const s = tr && tr.sim;
      let target = 0.05;
      if (s && window.__bot.on && s.state === 'walk') {
        target = 0.05 - (1.2 * s.theta + 0.8 * s.omega) / Math.cos(beta) * window.__bot.scale;
      }
      const g0 = gamma;
      gamma += (target - gamma) * Math.min(1, dt / 0.12);
      const rate = (gamma - g0) / Math.max(dt, 1e-3);
      const up = [-Math.cos(beta) * Math.sin(gamma), Math.sin(beta), Math.cos(beta) * Math.cos(gamma)];
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
        accelerationIncludingGravity: { x: up[0] * 9.81, y: up[1] * 9.81, z: up[2] * 9.81 },
        rotationRate: { alpha: 0, beta: 0, gamma: rate * 180 / Math.PI },
        interval: 16,
      }));
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 50, gamma: gamma * 180 / Math.PI }));
    }, 16);
  }, level);

  await page.goto(URL);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, 'menu.png') });
  await page.click('#play-btn');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, 'brief.png') });
  await page.click('#brief-start');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'countdown.png') });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(out, 'play1.png') });
  const src = await page.evaluate(() => window.__tightrope.tilt.source);
  // Keep walking until the level ends (or two minutes pass).
  let state = 'walk';
  for (let i = 0; i < 240 && state === 'walk'; i++) {
    await page.waitForTimeout(500);
    state = await page.evaluate(() => window.__tightrope.sim && window.__tightrope.sim.state);
    if (i === 14) await page.screenshot({ path: path.join(out, 'play2.png') });
  }
  await page.waitForTimeout(1500);
  const res = await page.evaluate(() => {
    const s = window.__tightrope.sim;
    return { state: s.state, fail: s.fail, spilled: +(s.spilled * 100).toFixed(1), z: +s.z.toFixed(1), t: +s.t.toFixed(1), mode: window.__tightrope.mode };
  });
  await page.screenshot({ path: path.join(out, 'result.png') });

  // Now let go of the phone: he should spill and be disqualified.
  await page.evaluate(() => { window.__bot.on = false; });
  await page.click('#result-main').catch(() => {});
  if (res.state === 'won') await page.click('#brief-start').catch(() => {});
  await page.waitForTimeout(4000 + 9000);
  await page.screenshot({ path: path.join(out, 'fail.png') });
  const res2 = await page.evaluate(() => ({ state: window.__tightrope.sim.state, fail: window.__tightrope.sim.fail, mode: window.__tightrope.mode }));

  console.log(JSON.stringify({ source: src, firstRun: res, handsOff: res2, errors }, null, 1));
  await browser.close();
  process.exit(errors.length || res.state !== 'won' || res2.state === 'walk' ? 1 : 0);
})();
