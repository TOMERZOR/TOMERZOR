export default async ({ page, wait }) => {
  await wait(800);
  const res = await page.evaluate(async () => {
    const S = window.__shard;
    const idx = S.LEVELS.findIndex((l) => l.id === 'w3-10');
    S.startLevel(idx);
    await new Promise((r) => setTimeout(r, 900));
    window.__rstat = null;
    const t0 = performance.now();
    for (const deg of S.game.level.proof) {
      S.game.debugAim(deg * Math.PI / 180); await new Promise((r) => setTimeout(r, 100)); S.game.debugFire();
      const ts = performance.now();
      while (performance.now() - ts < 4000 && !S.game.sim.st.won) await new Promise((r) => setTimeout(r, 50));
      if (S.game.sim.st.won) break;
    }
    const wall = performance.now() - t0, st = window.__rstat;
    const r = {}; for (const k in st) r[k] = typeof st[k] === 'number' ? +st[k].toFixed(1) : st[k];
    r.wallMs = Math.round(wall); r.perDraw = (st.drawMs / st.draw).toFixed(2);
    return r;
  });
  console.log(JSON.stringify(res));
};
