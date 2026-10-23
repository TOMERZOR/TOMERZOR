// The new glass on a phone: frosted panes that crack and then break, locked glass that opens when the gold key breaks.
// usage: node qa/shot.mjs newglass
const LEVEL = {
  id: 'qa-newglass', world: 1, par: 3, balls: 9, launcher: { x: 4.5 },
  objects: [
    { t: 'glass', s: 'jar', x: 1.3, y: 0.474, w: 0.72, h: 0.94, tint: 0, hp: 2 },
    { t: 'glass', s: 'box', x: 7.7, y: 0.374, w: 0.74, h: 0.74, tint: 1, hp: 2 },
    { t: 'glass', s: 'orb', x: 5.7, y: 8.6, r: 0.42, tint: 2, lock: 1 },
    { t: 'rope', x: 5.7, y: 14, to: 2 },
    { t: 'glass', s: 'jar', x: 7.0, y: 9.4, w: 0.7, h: 0.92, tint: 0, lock: 1 },
    { t: 'rope', x: 7.0, y: 14, to: 4 },
    { t: 'glass', s: 'bottle', x: 2.3, y: 9.8, w: 0.52, h: 1.34, tint: 1, key: 1 },
    { t: 'rope', x: 2.3, y: 14, to: 6 },
    { t: 'glass', s: 'pane', x: 3.5, y: 9.0, w: 0.2, h: 1.34, tint: 2 },
    { t: 'rope', x: 3.5, y: 14, to: 8 },
  ],
};
export default async ({ page, wait, shot }) => {
  // the angle at which the aim guide first touches a given piece
  const angleFor = (idx) => page.evaluate(async ([lv, idx]) => {
    const planck = await import('./js/vendor/planck.js');
    const { ghostPath } = await import('./js/engine.js');
    const S = window.__shard, sim = S.game.sim;
    const target = sim.ents.find((e) => e.alive && e.kind === 'glass' && Math.abs(e.body.getPosition().x - lv.objects[idx].x) < 0.05 && Math.abs(e.body.getPosition().y - lv.objects[idx].y) < 0.3);
    if (!target) return null;
    let best = null;
    for (let a = 12; a <= 168; a += 0.25) {
      const p = ghostPath(planck, sim, a * Math.PI / 180, 0);
      if (!p.hit || p.hit.kind !== 'glass') continue;
      const d = Math.hypot(p.hit.x - target.body.getPosition().x, p.hit.y - target.body.getPosition().y);
      if (!best || d < best.d) best = { a, d };
    }
    return best && best.a;
  }, [LEVEL, idx]);
  const fireAt = async (a) => { await page.evaluate((a) => { const g = window.__shard.game; g.debugAim(a * Math.PI / 180); }, a); await wait(250); };
  await page.evaluate((lv) => { const S = window.__shard; S.LEVELS[30] = lv; S.save.d.tipsSeen = []; S.startLevel(30); }, LEVEL);
  await wait(1800);
  await shot('ng-1-start');
  // crack the frosted jar
  const aJar = await angleFor(1);
  console.log('frosted jar angle', aJar);
  await fireAt(aJar); await shot('ng-2-aim-frosted');
  await page.evaluate(() => window.__shard.game.debugFire());
  await wait(260); await shot('ng-3-crack');
  await wait(2600); await shot('ng-4-cracked');
  // break the key: the locks open
  const aKey = await angleFor(6);
  console.log('key angle', aKey);
  await fireAt(aKey);
  await page.evaluate(() => window.__shard.game.debugFire());
  for (let i = 0; i < 6; i++) { await wait(110); await shot('ng-5-key-' + i); }
  await wait(2500); await shot('ng-6-after');
  const st = await page.evaluate(() => { const sim = window.__shard.game.sim; return { glass: sim.st.glass, locks: sim.ents.filter((e) => e.alive && e.lock).length, frost: sim.ents.filter((e) => e.alive && e.frost).map((e) => e.hp) }; });
  console.log('state', JSON.stringify(st));
};
