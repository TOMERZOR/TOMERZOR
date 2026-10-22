// The home logo's light sweep, caught mid-pass, and the tutorial coach clear of the cannon.
export default async ({ page, wait, shot }) => {
  await wait(500);
  await page.evaluate(() => window.__shard.goHome());
  await wait(5350);
  await shot('sheen');
  await page.evaluate(() => window.__shard.startLevel(1));
  await wait(900);
  await shot('coach');
};
