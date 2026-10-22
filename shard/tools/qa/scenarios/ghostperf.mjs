export default async ({ page, wait }) => {
  await wait(600);
  const r = await page.evaluate(async () => {
    const planck = await import('/js/vendor/planck.js');
    const { createSim, ghostPath } = await import('/js/engine.js');
    const L = window.__shard.LEVELS;
    const out = [];
    for (const idx of [10, 60, 110]) {
      const sim = createSim(planck, L[idx], { visual: true });
      for (let i = 0; i < 10; i++) sim.step();
      const t0 = performance.now();
      for (let k = 0; k < 100; k++) ghostPath(planck, sim, (20 + k * 1.4) * Math.PI / 180, 1);
      out.push({ level: L[idx].id, bodies: sim.ents.filter((e) => e.alive).length, msPerGuide: ((performance.now() - t0) / 100).toFixed(2) });
    }
    return out;
  });
  console.log(JSON.stringify(r));
};
