export default async ({ page, wait, shot }) => {
  await wait(800);
  const res = await page.evaluate(async () => {
    const { LEVELS } = await import('/tools/qa/sample-levels.js');
    const { WORLDS } = await import('/js/theme.js');
    // heaviest level by glass count
    const lv = [...LEVELS].sort((a, b) => b.objects.filter(o => o.t === 'glass').length - a.objects.filter(o => o.t === 'glass').length)[0];
    window.__shard.goHome();
    const g = window.__shard.game;
    g.load({ ...lv, balls: 20 }, { palette: WORLDS[lv.world] });
    const times = [];
    let last = performance.now();
    let n = 0;
    await new Promise((resolve) => {
      const tick = (t) => {
        times.push(t - last); last = t;
        if (n % 40 === 0 && n < 400) g.sim.fire((50 + Math.random() * 80) * Math.PI / 180);
        n++;
        if (n < 600) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    times.sort((a, b) => a - b);
    const avg = times.reduce((s, v) => s + v, 0) / times.length;
    return { id: lv.id, glass: lv.objects.filter(o => o.t === 'glass').length, avgMs: avg.toFixed(2), p50: times[times.length >> 1].toFixed(2), p95: times[Math.floor(times.length * 0.95)].toFixed(2), max: times[times.length - 1].toFixed(2), shards: g.sim.shards.length };
  });
  console.log(JSON.stringify(res));
  await shot('perf-end');
};
