// Replays every level's solver proof inside the browser build (same engine, browser JS VM)
// and reports levels whose proof does not clear the level there.
export default async ({ page, wait }) => {
  await wait(600);
  const res = await page.evaluate(async () => {
    const planck = await import('/js/vendor/planck.mjs');
    const { createSim } = await import('/js/engine.js');
    const which = new URLSearchParams(location.search).get('daily') ? 'DAILY' : 'LEVELS';
    const list = window.__shard[which];
    const out = [];
    for (const lv of list) {
      const sim = createSim(planck, { ...lv, balls: 99 });
      for (let i = 0; i < 12; i++) sim.step();
      for (const deg of lv.proof) {
        sim.fire(deg * Math.PI / 180);
        let n = 0;
        while (n++ < 480) { sim.step(); if (sim.st.won) break; if (sim.st.live === 0 && sim.st.quietSteps > 15) break; }
        if (sim.st.won) break;
      }
      out.push({ id: lv.id, won: sim.st.won, left: sim.st.glass });
    }
    return out;
  });
  const bad = res.filter((r) => !r.won);
  console.log(`proof replay: ${res.length - bad.length}/${res.length} clear in the browser`);
  if (bad.length) console.log('not cleared:', bad.map((b) => `${b.id}(${b.left} left)`).join(', '));
};
