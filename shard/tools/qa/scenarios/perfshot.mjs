// Realistic frame times: the proof shot on the heaviest levels, in real time, frames measured from
// the moment of firing until the result. Run with THROTTLE=4 for a mid-range phone.
export default async ({ page, wait }) => {
  await wait(800);
  const res = await page.evaluate(async () => {
    const S = window.__shard;
    const glass = (l) => l.objects.filter((o) => o.t === 'glass').length;
    const picks = S.LEVELS.map((l, i) => ({ i, n: glass(l) + l.objects.filter((o) => o.t === 'bomb').length * 3 })).sort((a, b) => b.n - a.n).slice(0, 4).map((p) => p.i);
    const out = [];
    for (const idx of picks) {
      S.startLevel(idx);
      await new Promise((r) => setTimeout(r, 900));
      const iv = [];
      let last = performance.now(), on = true;
      const loop = (t) => { iv.push(t - last); last = t; if (on) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      for (const deg of S.game.level.proof) {
        S.game.debugAim(deg * Math.PI / 180);
        await new Promise((r) => setTimeout(r, 120));
        S.game.debugFire();
        const t0 = performance.now();
        while (performance.now() - t0 < 4000 && !S.game.sim.st.won) await new Promise((r) => setTimeout(r, 50));
        if (S.game.sim.st.won) break;
      }
      await new Promise((r) => setTimeout(r, 1500));
      on = false;
      iv.sort((a, b) => a - b);
      const q = (p) => iv[Math.min(iv.length - 1, Math.floor(iv.length * p))].toFixed(1);
      out.push({ id: S.LEVELS[idx].id, frames: iv.length, p50: q(0.5), p95: q(0.95), slow: (iv.filter((v) => v > 20).length / iv.length * 100).toFixed(1) + '%' });
    }
    return out;
  });
  for (const r of res) console.log(`shot ${r.id}: ${r.frames} frames, p50 ${r.p50} ms, p95 ${r.p95} ms, frames over 20 ms ${r.slow}`);
  console.log('tier', await page.evaluate(() => window.__shard.save.d.perfTier));
};
