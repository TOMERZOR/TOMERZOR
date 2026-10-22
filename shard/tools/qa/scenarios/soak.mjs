// Long session: plays 40 levels back to back with their proofs at real speed-ish (fast clock),
// and watches heap size, live particles and shards for growth.
export default async ({ page, wait }) => {
  await wait(600);
  const res = await page.evaluate(async () => {
    const S = window.__shard;
    S.setManual(true);
    const samples = [];
    const tick = (n) => { for (let i = 0; i < n; i++) S.tick(1 / 60); };
    for (let k = 0; k < 40; k++) {
      const idx = (k * 3) % S.LEVELS.length;
      S.startLevel(idx);
      tick(30);
      for (const deg of S.game.level.proof) {
        S.game.debugAim(deg * Math.PI / 180); tick(2); S.game.debugFire();
        for (let i = 0; i < 360 && !S.game.sim.st.won; i++) tick(1);
        if (S.game.sim.st.won) break;
      }
      tick(120);
      if (k % 8 === 7) {
        await new Promise((r) => setTimeout(r, 50));
        if (window.gc) { window.gc(); window.gc(); }
        samples.push({ level: k + 1, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, shards: S.game.sim.shards.length, bodies: S.game.sim.world.getBodyCount() });
      }
    }
    S.setManual(false);
    return samples;
  });
  for (const s of res) console.log(`after ${s.level} levels: heap ${s.heapMB} MB, shards ${s.shards}, bodies ${s.bodies}`);
};
