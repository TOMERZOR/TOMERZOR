// Captures gameplay for the promo, frame-perfect: the page runs on a virtual clock (timers,
// requestAnimationFrame, performance.now, CSS/WAAPI animations), each frame advances exactly
// 1/30 s and is then screenshotted at 1080x1920. Scripted taps are dispatched between frames.
//   node achori/promo/capture.cjs <outDir> [port=8093]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = process.argv[2];
const port = process.argv[3] || 8093;
const FPS = 30, DT = 1000 / FPS;

const VIRTUAL_CLOCK = () => {
  let now = 0;
  const base = Date.now();
  const timers = new Map();
  let tid = 1, rafs = [];
  performance.now = () => now;
  Date.now = () => base + now;
  window.setTimeout = (fn, ms = 0, ...a) => { const id = tid++; timers.set(id, { at: now + Math.max(0, +ms || 0), fn, a }); return id; };
  window.clearTimeout = (id) => { timers.delete(id); };
  window.setInterval = (fn, ms = 0, ...a) => { const id = tid++; const tick = () => { timers.set(id, { at: now + Math.max(1, +ms || 1), fn: () => { tick(); fn(...a); }, a: [] }); }; tick(); return id; };
  window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => { const id = tid++; rafs.push({ id, fn }); return id; };
  window.cancelAnimationFrame = (id) => { rafs = rafs.filter((r) => r.id !== id); };
  const seen = new WeakSet();
  window.__vt = {
    step(ms) {
      const target = now + ms;
      for (;;) {
        let best = null;
        for (const [id, t] of timers) if (t.at <= target && (!best || t.at < best[1].at)) best = [id, t];
        if (!best) break;
        timers.delete(best[0]);
        now = Math.max(now, best[1].at);
        try { best[1].fn(...best[1].a); } catch (e) { console.error(e); }
      }
      now = target;
      const list = rafs; rafs = [];
      for (const r of list) { try { r.fn(now); } catch (e) { console.error(e); } }
      for (const a of document.getAnimations()) {
        if (!seen.has(a)) { seen.add(a); a.pause(); a.currentTime = 0; continue; }
        a.pause();
        const end = a.effect && a.effect.getComputedTiming().endTime;
        const t = (a.currentTime || 0) + ms;
        if (Number.isFinite(end) && t >= end) { try { a.finish(); } catch { a.currentTime = end; } } else a.currentTime = t;
      }
    },
    get now() { return now; },
  };
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.addInitScript(VIRTUAL_CLOCK);
  await p.goto(`http://localhost:${port}/achori/?t=1`);
  const step = (n = 1) => p.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__vt.step(dt); }, [n, DT]);
  // let the page load (textures) in virtual time
  for (let i = 0; i < 400; i++) {
    await step(3);
    if (await p.evaluate(() => document.getElementById('title').classList.contains('show'))) break;
    await new Promise((r) => setTimeout(r, 30));
  }
  await p.evaluate(() => {
    localStorage.setItem('achori.v1', JSON.stringify({ unlocked: 19, stars: Array(19).fill(3), muted: true, haptics: false, beatTips: 9,
      hints: { tutorial: 1, cheese: 1, glue: 1, smart: 1, shaked: 1, fat: 1, bucket: 1, fast: 1, ring: 1 } }));
  });
  await p.reload();
  for (let i = 0; i < 400; i++) {
    await step(3);
    if (await p.evaluate(() => document.getElementById('title').classList.contains('show'))) break;
    await new Promise((r) => setTimeout(r, 30));
  }

  let shotDir = null, shotN = 0;
  const startShot = (name) => { shotDir = path.join(out, name); fs.mkdirSync(shotDir, { recursive: true }); shotN = 0; };
  const frame = async () => {
    await step(1);
    if (shotDir) await p.screenshot({ path: path.join(shotDir, String(++shotN).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  };
  const frames = async (n, each) => { for (let i = 0; i < n; i++) { if (each) await each(i); await frame(); } };
  const tapAt = (x, y) => p.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y) || document.getElementById('gl');
    const o = { clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  }, [x, y]);
  const click = (sel) => p.evaluate((sel) => document.querySelector(sel).click(), sel);
  const cellXY = (i) => p.evaluate((i) => window.__achori.scene.project(i % 7 - 3, 0, Math.floor(i / 7) - 4), i);
  const openLevel = async (n) => {
    shotDir = null;
    await click('#levels-btn'); await step(10);
    await p.evaluate((n) => document.querySelectorAll('.lvl')[n].click(), n); await step(10);
    await click('#dlg-skip'); await step(15);
  };
  const until = async (cond, max = 900) => { for (let i = 0; i < max; i++) { if (await p.evaluate(cond)) return true; await frame(); } return false; };

  // ---------- G1: planning, the route bends around what you place (level 5) ----------
  await openLevel(4);
  const routes = await p.evaluate(() => window.__achori.game.previewRoutes().map((r) => r.path));
  startShot('g1_plan');
  await frames(12);
  await click('.tool[data-tool="snap"]');
  await frames(8);
  let c = await cellXY(routes[0][4]); await tapAt(c.x, c.y);
  await frames(16);
  await click('.tool[data-tool="glue"]');
  await frames(6);
  c = await cellXY(routes[1][3]); await tapAt(c.x, c.y);
  await frames(16);
  await click('.tool[data-tool="block"]');
  await frames(6);
  c = await cellXY(routes[0][2]); await tapAt(c.x, c.y);
  await frames(18);
  await click('.tool[data-tool="cheese"]');
  await frames(6);
  c = await cellXY(routes[0][6]); await tapAt(c.x, c.y);
  await frames(20);

  // ---------- G2: release, Lior gets caught, mash, kill ----------
  shotDir = null;
  await click('#go-btn');
  await until(() => window.__achori.game.mice.some((m) => m.type === 'lior' && m.alive && m.state !== 'emerge'), 200);
  startShot('g2_run');
  await frames(30);
  shotDir = null;
  // make sure she lands in a trap: put one right in front of her if she has none on her way
  await until(() => window.__achori.game.mice.some((m) => m.type === 'lior' && (m.state === 'caught' || m.state === 'glued')), 600);
  await p.evaluate(() => { const g = window.__achori.game; const m = g.mice.find((q) => q.type === 'lior'); m.hp = Math.min(m.hp, 26); m.t = Math.max(m.t, 3); m.heldMax = m.t; });
  startShot('g2_mash');
  await frames(100, async (i) => {
    if (i % 2 === 0) {
      const s = await p.evaluate(() => { const g = window.__achori.game; const m = g.mice.find((q) => q.type === 'lior' && q.alive); return m && window.__achori.scene.mouseScreen(m); });
      if (s) await tapAt(s.x + ((i * 37) % 21) - 10, s.y + ((i * 53) % 17) - 8);
    }
  });
  await frames(40);

  // ---------- G3: Ofek's scream ----------
  shotDir = null;
  await until(() => window.__achori.game && window.__achori.game.liveMice().some((m) => m.state === 'run'), 300);
  if (await p.evaluate(() => window.__achori.game.phase === 'action' && window.__achori.game.abilities.ofek > 0)) {
    startShot('g3_scream');
    await frames(6);
    await click('#ab-ofek');
    await frames(48);
  }

  // ---------- G4: the yard at sunset, a triple kill ----------
  await p.evaluate(() => { const r = document.getElementById('pause-btn'); r.click(); });
  await step(5);
  await click('#pause-levels'); await step(10);
  await click('#levels-back'); await step(5);
  await openLevel(15);
  shotDir = null;
  await click('#go-btn');
  await until(() => window.__achori.game.liveMice().filter((m) => m.state === 'run' || m.state === 'flee').length >= 3, 900);
  startShot('g4_multi');
  await frames(10);
  const ids = await p.evaluate(() => window.__achori.game.liveMice().filter((m) => m.state === 'run' || m.state === 'flee').slice(0, 3).map((m) => m.id));
  for (const id of ids) {
    await p.evaluate((id) => { const g = window.__achori.game; const m = g.mice.find((q) => q.id === id); if (m && m.alive) { g.hold(m, 'caught', 2, null); m.hp = Math.min(m.hp, 2); } }, id);
    for (let k = 0; k < 2; k++) {
      const s = await p.evaluate((id) => { const g = window.__achori.game; const m = g.mice.find((q) => q.id === id && q.alive); return m && window.__achori.scene.mouseScreen(m); }, id);
      if (s) await tapAt(s.x, s.y);
      await frames(3);
    }
    await frames(5);
  }
  await frames(50);
  console.log('done');
  await b.close();
})();
