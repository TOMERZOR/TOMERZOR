export default async ({ page, wait, shot }) => {
  await wait(600);
  await page.evaluate(() => { const s = window.__shard.save; s.d.stars = { 'w0-1': 3, 'w0-2': 3, 'w0-3': 3 }; s.flush(); window.__shard.startLevel(6); });
  await wait(500);
  for (const [i, deg] of [[1, 48], [2, 128], [3, 75]]) {
    await page.evaluate((d) => window.__shard.game.debugAim(d * Math.PI / 180), deg);
    await wait(250);
    await shot('guide' + i);
  }
};
