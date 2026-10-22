// One still per world (a mid-world level at rest) plus the home screen, for art direction reviews.
export default async ({ page, wait, shot }) => {
  await wait(600);
  await page.evaluate(() => window.__shard.setManual(true));
  const tick = (k) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__shard.tick(1 / 60); }, k);
  const picks = await page.evaluate(() => {
    const L = window.__shard.LEVELS, out = [];
    for (let w = 0; w < 5; w++) { const idx = L.map((l, i) => i).filter((i) => L[i].world === w); out.push(idx[Math.floor(idx.length * (+(new URLSearchParams(location.search).get('at') || 0.5)))]); }
    return out;
  });
  for (const [w, i] of picks.entries()) {
    await page.evaluate((i) => window.__shard.startLevel(i), i);
    await tick(90);
    await shot(`world${w}`);
  }
  await page.evaluate(() => window.__shard.goHome());
  await tick(60);
  await shot('home');
};
