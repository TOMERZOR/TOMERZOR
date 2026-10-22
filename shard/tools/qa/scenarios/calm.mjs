// Reduce Motion: no camera transforms, instant intro, no confetti, animations off.
export default async ({ page, wait }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await wait(600);
  const r = await page.evaluate(async () => {
    const S = window.__shard;
    for (let i = 0; i < 4; i++) S.save.d.stars[S.LEVELS[i].id] = 3;
    S.startLevel(4);
    await new Promise((res) => setTimeout(res, 80));
    const bg = document.getElementById('stage-bg');
    let maxTransform = '', confetti = 0;
    const lv = S.game.level;
    const watch = setInterval(() => { if (bg.style.transform) maxTransform = bg.style.transform; }, 16);
    for (const deg of lv.proof) { S.game.debugAim(deg * Math.PI / 180); S.game.debugFire(); await new Promise((res) => setTimeout(res, 2500)); if (S.game.sim.st.won) break; }
    await new Promise((res) => setTimeout(res, 2000));
    clearInterval(watch);
    const logo = getComputedStyle(document.querySelector('.logo span')).animationName;
    return { won: S.game.sim.st.won, maxTransform, sheet: !document.getElementById('sheet').hidden, logo };
  });
  console.log(`${!r.maxTransform ? 'PASS' : 'FAIL'} no camera or shake transform under Reduce Motion (${r.maxTransform || 'none'})`);
  console.log(`${r.won && r.sheet ? 'PASS' : 'FAIL'} level still plays and wins: ${JSON.stringify(r)}`);
  console.log(`${r.logo === 'none' ? 'PASS' : 'FAIL'} logo animations off (${r.logo})`);
};
