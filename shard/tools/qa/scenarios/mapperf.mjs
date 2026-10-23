// Frame pacing on the level map: idle (its ambient motion) and while scrolling. Run with THROTTLE=4.
export default async ({ page, wait }) => {
  const prog = +(process.env.PROG || 30);
  await page.evaluate((prog) => {
    const L = window.__shard.LEVELS, d = window.__shard.save.d;
    for (let i = 0; i < prog; i++) d.stars[L[i].id] = 3;
    d.tutorialDone = true;
    window.__shard.save.flush();
  }, prog);
  await page.reload();
  await wait(900);
  if (await page.evaluate(() => window.__shard.mode !== 'home')) { await page.evaluate(() => window.__shard.goHome()); await wait(600); }
  if (process.env.TRAVEL) {
    // frame pacing while the ball hops five levels on, the camera following
    await page.evaluate(() => { const d = window.__shard.save.d; d.mapAt = Math.max(0, Object.keys(d.stars).length - 5); });
    const p = page.evaluate(() => new Promise((done) => {
      const dts = []; let last = performance.now(); const t0 = last;
      const f = (t) => { dts.push(t - last); last = t; if (t - t0 < 2400) requestAnimationFrame(f); else { dts.shift(); done({ frames: dts.length, slow: +(100 * dts.filter((d) => d > 20).length / dts.length).toFixed(1), worst: +Math.max(...dts).toFixed(1) }); } };
      requestAnimationFrame(f);
    }));
    await page.click('#btn-levels');
    console.log('travel', JSON.stringify(await p));
    return;
  }
  await page.click('#btn-levels');
  if (process.env.WORLD) { await page.click(`.wtab[data-w="${process.env.WORLD}"]`); }
  await wait(1500);
  const measure = (scroll) => page.evaluate((scroll) => new Promise((done) => {
    const sc = document.querySelector('#map-scroll');
    const dts = []; let last = performance.now(), t0 = last, dir = -1;
    const f = (t) => {
      dts.push(t - last); last = t;
      if (scroll) { if (sc.scrollTop <= 0) dir = 1; if (sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 1) dir = -1; sc.scrollTop += dir * 9; }
      if (t - t0 < 4000) requestAnimationFrame(f);
      else {
        dts.shift(); dts.sort((a, b) => a - b);
        done({ frames: dts.length, slow: +(100 * dts.filter((d) => d > 20).length / dts.length).toFixed(1), p50: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1) });
      }
    };
    requestAnimationFrame(f);
  }), scroll);
  console.log('idle  ', JSON.stringify(await measure(false)));
  console.log('scroll', JSON.stringify(await measure(true)));
};
