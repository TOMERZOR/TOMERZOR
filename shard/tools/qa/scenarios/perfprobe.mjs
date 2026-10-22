// Frame-time probe on the heaviest real levels: fires a volley, measures rAF frame intervals
// and the JS time per frame. Run with THROTTLE=4 to approximate a mid-range phone.
export default async ({ page, wait }) => {
  await wait(800);
  const res = await page.evaluate(async () => {
    const S = window.__shard;
    const glass = (l) => l.objects.filter((o) => o.t === 'glass').length;
    const order = S.LEVELS.map((l, i) => ({ i, n: glass(l) })).sort((a, b) => b.n - a.n);
    const picks = [order[0].i, order[1].i, S.LEVELS.findIndex((l) => l.world === 4 && glass(l) >= 8)];
    const out = [];
    for (const idx of picks) {
      S.startLevel(idx);
      const g = S.game;
      await new Promise((r) => setTimeout(r, 300));
      const intervals = [], work = [];
      let last = performance.now(), n = 0;
      const orig = S.tick;
      await new Promise((resolve) => {
        const loop = (t) => {
          intervals.push(t - last); last = t;
          if (n % 45 === 0 && n < 360 && g.sim) g.sim.fire((55 + Math.random() * 70) * Math.PI / 180);
          n++;
          if (n < 480) requestAnimationFrame(loop); else resolve();
        };
        requestAnimationFrame(loop);
      });
      intervals.sort((a, b) => a - b);
      const q = (p) => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * p))].toFixed(1);
      out.push({ level: S.LEVELS[idx].id, glass: glass(S.LEVELS[idx]), p50: q(0.5), p95: q(0.95), p99: q(0.99), slow: (intervals.filter((v) => v > 20).length / intervals.length * 100).toFixed(1) + '%' });
    }
    return out;
  });
  for (const r of res) console.log(`perf ${r.level} (${r.glass} glass): p50 ${r.p50} ms, p95 ${r.p95} ms, p99 ${r.p99} ms, frames over 20 ms ${r.slow}`);
};
