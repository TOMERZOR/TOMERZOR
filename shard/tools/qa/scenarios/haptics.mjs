// Haptics on the web. Android (navigator.vibrate): what a level's shot, breaks and win send to the motor.
// iPhone (no vibrate, IOS=1): every button carries the invisible label and switch, a tap still acts exactly once,
// and the layout doesn't move. The tick itself needs a real iPhone.
export default async ({ page, wait, shot }) => {
  const ios = !!process.env.IOS;
  await page.addInitScript((ios) => {
    if (ios) { delete Navigator.prototype.vibrate; return; }
    window.__vib = [];
    Navigator.prototype.vibrate = function (p) { window.__vib.push([Math.round(performance.now()), p]); return true; };
  }, ios);
  await page.reload();
  await page.waitForFunction(() => window.__shard);
  await wait(800);
  const pass = (ok, msg) => console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`);

  if (!ios) {
    // level 4 with its proof: a shot, a run of breaks, the last piece, the win
    await page.evaluate(() => { const s = window.__shard.save; s.d.stars = { 'w0-1': 3, 'w0-2': 3, 'w0-3': 3 }; s.flush(); window.__shard.startLevel(3); });
    await wait(1200);
    const t0 = await page.evaluate(() => { window.__vib.length = 0; const g = window.__shard.game, lv = g.level; g.debugAim(lv.proof[0] * Math.PI / 180); g.debugFire(); return Math.round(performance.now()); });
    await page.waitForFunction(() => !document.getElementById('sheet').hidden, null, { timeout: 15000 });
    await wait(1200);
    const vib = await page.evaluate(() => window.__vib);
    console.log('vibrate calls (ms after the shot: pattern):', vib.map(([t, p]) => `${t - t0}:${JSON.stringify(p)}`).join('  '));
    pass(vib[0] && vib[0][1] === 18 && vib[0][0] - t0 < 100, 'the shot kicks (18 ms)');
    const pulses = vib.filter(([, p]) => typeof p === 'number');
    pass(pulses.some(([, p]) => p === 30), 'the last piece lands heavy (30 ms)');
    const echoes = pulses.filter(([t, p], i) => p === 10 && i > 0 && t - pulses[i - 1][0] >= 45 && t - pulses[i - 1][0] <= 70);
    pass(echoes.length > 0, `breaks crunch: a light tick about 50 ms after the hit (${echoes.length})`);
    pass(vib.some(([, p]) => Array.isArray(p) && p.length === 3 && p[2] === 26), 'the win ends on the success pattern');
    const gaps = pulses.slice(1).map(([t], i) => t - pulses[i][0]);
    pass(gaps.every((g) => g >= 30), `never buzzing: closest pulses ${Math.min(...gaps)} ms apart`);
    // haptics off: nothing reaches the motor
    await page.evaluate(() => { window.__shard.save.d.settings.haptics = false; window.__shard.save.flush(); });
    await page.reload(); await page.waitForFunction(() => window.__shard); await wait(800);
    await page.evaluate(() => { window.__vib.length = 0; window.__shard.startLevel(3); });
    await wait(1200);
    await page.evaluate(() => { const g = window.__shard.game; g.debugAim(g.level.proof[0] * Math.PI / 180); g.debugFire(); });
    await wait(3000);
    pass((await page.evaluate(() => window.__vib.length)) === 0, 'with Haptics off, no vibration at all');
    return;
  }

  // ---- iPhone: the tap layer (from home: a fresh game opens in level 1)
  await page.evaluate(() => { const s = window.__shard.save; s.d.stars = { 'w0-1': 3 }; s.flush(); window.__shard.goHome(); });
  await wait(900);
  const before = await page.evaluate(() => ({ buttons: document.querySelectorAll('button').length, armed: document.querySelectorAll('button > .hx > input[switch]').length, toggles: document.querySelectorAll('input.toggle[switch]').length }));
  pass(before.armed === before.buttons, `every button carries a switch (${before.armed}/${before.buttons}), settings toggles are switches (${before.toggles})`);
  // one tap, one action: count clicks reaching the document per tap
  await page.evaluate(() => { window.__clicks = 0; document.addEventListener('click', () => window.__clicks++); });
  const tap = async (sel) => { const n0 = await page.evaluate(() => window.__clicks); await page.tap(sel); await wait(450); return (await page.evaluate(() => window.__clicks)) - n0; };
  let c = await tap('#btn-levels');
  pass(c === 1 && await page.evaluate(() => window.__shard.mode === 'page'), `Levels opens with one click (${c})`);
  const flipped = await page.evaluate(() => document.querySelector('#btn-levels > .hx > input').checked);
  pass(flipped, 'the tap reached the switch (on an iPhone, that is the tick)');
  const nodes = await page.evaluate(() => [document.querySelectorAll('#map-scroll .node').length, document.querySelectorAll('#map-scroll .node > .hx').length]);
  pass(nodes[0] > 0 && nodes[0] === nodes[1], `the map's gems are armed as it is drawn (${nodes[1]}/${nodes[0]})`);
  c = await tap('#world-tabs .wtab[data-w="1"]');
  pass(c === 1, `a world tab: one click (${c})`);
  await tap('#world-tabs .wtab[data-w="0"]'); // back to the world with the level to play
  await page.evaluate(() => { const g = document.querySelector('#map-scroll .node.current') || document.querySelector('#map-scroll .node'); g.scrollIntoView({ block: 'center' }); });
  await wait(300);
  c = await tap('#map-scroll .node.current');
  pass(c === 1 && await page.evaluate(() => window.__shard.mode === 'play'), `a level gem starts the level with one click (${c})`);
  await wait(800);
  c = await tap('#btn-pause');
  const paused = await page.evaluate(() => !document.getElementById('sheet').hidden && document.querySelector('#sheet h2')?.textContent);
  pass(c === 1 && paused === 'Paused', `pause opens its sheet with one click (${c})`);
  const sheetArmed = await page.evaluate(() => [...document.querySelectorAll('#sheet button')].every((b) => b.querySelector(':scope > .hx')));
  pass(sheetArmed, 'the sheet\'s new buttons are armed');
  // Haptics off from the pause sheet: the switches stop (no tick), the buttons still work
  c = await tap('#sheet [data-act="t-haptics"]');
  const off = await page.evaluate(() => [...document.querySelectorAll('.hx input')].every((s) => s.disabled));
  pass(c === 1 && off, `Haptics off disables every switch (${c} click)`);
  await shot('haptics-ios-pause');
  await tap('#sheet [data-act="t-haptics"]');
  const backOn = await page.evaluate(() => [...document.querySelectorAll('.hx input')].every((s) => !s.disabled));
  pass(backOn, 'Haptics on again re-enables them');
  await page.evaluate(() => window.__shard.goHome());
  await wait(700);
  await shot('haptics-ios-home');
};
