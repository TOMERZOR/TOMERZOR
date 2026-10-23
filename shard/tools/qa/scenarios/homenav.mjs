// The home screen's nav row in a light and a dark world.
export default async ({ page, wait, shot }) => {
  for (const prog of [5, 100]) {
    await page.evaluate((prog) => { const L = window.__shard.LEVELS, d = window.__shard.save.d; d.stars = {}; for (let i = 0; i < prog; i++) d.stars[L[i].id] = 3; window.__shard.save.flush(); window.__shard.goHome(); }, prog);
    await wait(1200);
    await shot(`home-${prog}`);
  }
};
