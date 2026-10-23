// The level map. Seeds a save, opens Levels, shoots each world, and checks what the map must do.
// env: PROG = levels cleared (default 0), MAPAT = the level the map last showed (travel from there),
//      TABS = worlds to shoot ("0,1,2,3,4"), TRAVEL = 1 to film the ball's hop as stills, CHECK = 1 for assertions
export default async ({ page, wait, shot }) => {
  const prog = +(process.env.PROG || 0);
  const mapAt = process.env.MAPAT;
  const tag = process.env.TAG || `p${prog}`;
  await page.evaluate(({ prog, mapAt }) => {
    const L = window.__shard.LEVELS, d = window.__shard.save.d;
    for (let i = 0; i < prog; i++) d.stars[L[i].id] = [3, 2, 3, 1, 3, 3, 2][i % 7];
    if (mapAt !== undefined) d.mapAt = +mapAt;
    d.tutorialDone = true;
    window.__shard.save.flush();
  }, { prog, mapAt });
  await page.reload();
  await wait(900);
  // a brand-new player starts straight in level 1; come back out to the menu
  if (await page.evaluate(() => window.__shard.mode !== 'home')) { await page.evaluate(() => window.__shard.goHome()); await wait(600); }
  const fails = [];
  const expect = (ok, msg) => { if (!ok) fails.push(msg); };

  await page.click('#btn-levels');
  if (process.env.TRAVEL) {
    for (let i = 0; i < 14; i++) { await shot(`map-${tag}-t${String(i).padStart(2, '0')}`); await wait(90); }
  }
  await wait(1900);
  await shot(`map-${tag}`);

  if (process.env.CHECK) {
    const st = await page.evaluate(() => {
      const sc = document.querySelector('#map-scroll');
      const cur = sc.querySelector('.node.current');
      const r = cur?.getBoundingClientRect(), s = sc.getBoundingClientRect();
      const nodes = [...sc.querySelectorAll('.node')];
      const small = nodes.filter((n) => { const b = n.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).length;
      return {
        mode: window.__shard.mode, nodes: nodes.length, small,
        cur: cur ? +cur.dataset.i : -1,
        curInView: r ? r.top >= s.top && r.bottom <= s.bottom : null,
        pageScroll: document.querySelector('#levels').scrollTop,
        mapAt: window.__shard.save.d.mapAt,
        overflowX: sc.scrollWidth > sc.clientWidth,
      };
    });
    console.log('state', JSON.stringify(st));
    expect(st.nodes === 24, `24 nodes (got ${st.nodes})`);
    expect(st.small === 0, `${st.small} nodes under 44px`);
    expect(st.cur === -1 || st.curInView, 'current level in view');
    expect(st.pageScroll === 0, 'page itself does not scroll');
    expect(!st.overflowX, 'no sideways scroll');
    // a locked level answers with a toast and does not start
    const locked = await page.$('#map-scroll .node.locked');
    if (locked) {
      await locked.click({ force: true });
      await wait(250);
      const t = await page.evaluate(() => ({ mode: window.__shard.mode, toast: document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent }));
      expect(t.mode === 'page' && /^Clear level \d+ first$/.test(t.toast), `locked tap → toast (got ${JSON.stringify(t)})`);
    }
    // a locked gate answers too
    const gate = await page.$('#map-scroll .gate:not(.open):not(.end)');
    if (gate) {
      await page.evaluate(() => { const g = document.querySelector('#map-scroll .gate'); g.scrollIntoView({ block: 'center' }); });
      await wait(200);
      await gate.click({ force: true });
      await wait(250);
      const t = await page.evaluate(() => document.querySelector('#toast').textContent);
      expect(/^Clear level \d+ to open /.test(t), `locked gate → toast (got ${t})`);
    }
    // tabs switch worlds; an open gate goes to the next world
    await page.click('.wtab[data-w="1"]');
    await wait(500);
    const w1 = await page.evaluate(() => document.querySelector('.wtab[aria-selected="true"]').dataset.w + '/' + document.querySelector('#map-scroll .node').dataset.i);
    expect(w1 === '1/24', `tab 1 shows levels from 25 (got ${w1})`);
    await page.click('.wtab[data-w="0"]');
    await wait(500);
    const open = await page.$('#map-scroll .gate.open');
    if (open) {
      await page.evaluate(() => document.querySelector('#map-scroll .gate').scrollIntoView({ block: 'center' }));
      await wait(200);
      await open.click({ force: true });
      await wait(500);
      const w = await page.evaluate(() => document.querySelector('.wtab[aria-selected="true"]').dataset.w);
      expect(w === '1', `open gate → world 2 (got ${w})`);
    }
    // the current level starts, once, on a double tap
    await page.evaluate(() => { const L = window.__shard.LEVELS; let i = 0; while (i < L.length - 1 && window.__shard.save.d.stars[L[i].id]) i++; document.querySelector(`.wtab[data-w="${L[i].world}"]`).click(); });
    await wait(500);
    const cur = await page.$('#map-scroll .node.current');
    if (cur) {
      const played = await page.evaluate(() => window.__shard.save.d.stats.played);
      await cur.click({ force: true });
      await cur.click({ force: true }).catch(() => {});
      await wait(600);
      const after = await page.evaluate(() => ({ mode: window.__shard.mode, played: window.__shard.save.d.stats.played }));
      expect(after.mode === 'play' && after.played === played + 1, `current → plays once (got ${JSON.stringify(after)})`);
    }
    console.log(fails.length ? 'CHECK FAILED:\n  ' + fails.join('\n  ') : 'checks passed');
    return;
  }

  const tabs = (process.env.TABS || '').split(',').filter(Boolean).map(Number);
  for (const t of tabs) {
    await page.click(`.wtab[data-w="${t}"]`);
    await wait(700);
    await shot(`map-${tag}-w${t}`);
    if (process.env.TOPS) { await page.evaluate(() => { document.querySelector('#map-scroll').scrollTop = 0; }); await wait(300); await shot(`map-${tag}-w${t}-top`); }
    if (process.env.BOTTOMS) { await page.evaluate(() => { const s = document.querySelector('#map-scroll'); s.scrollTop = s.scrollHeight; }); await wait(300); await shot(`map-${tag}-w${t}-bottom`); }
  }
};
