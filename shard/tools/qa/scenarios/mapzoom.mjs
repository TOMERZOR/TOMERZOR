// Stills of the next level's ring as it breathes out, for a close look at the map's one ambient motion.
export default async ({ page, wait, shot }) => {
  await page.evaluate(() => { const L = window.__shard.LEVELS, d = window.__shard.save.d; for (let i = 0; i < 10; i++) d.stars[L[i].id] = 3; d.mapAt = 10; window.__shard.save.flush(); });
  await page.reload(); await wait(900);
  await page.click('#btn-levels'); await wait(1200);
  for (let i = 0; i < 4; i++) { await shot(`zoom-${i}`); await wait(500); }
};
