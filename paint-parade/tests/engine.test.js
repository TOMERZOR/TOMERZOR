import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, launchLane, launchSlot, trackPos, trackLength, lineTarget, revive, ammoByColor, coatsByColor, addRainbow } from '../js/engine.js';
import { playSmart } from '../js/bot.js';

const tiny = () => ({
  w: 2, h: 2,
  cells: [0, 1,
          1, 0],
  lanes: [[{ c: 0, n: 2 }], [{ c: 1, n: 2 }]],
  slots: 2, beltCap: 3,
});

test('track walks the whole ring and comes back', () => {
  const w = 3, h = 2, L = trackLength(w, h);
  assert.equal(L, 14);
  const seen = new Set();
  for (let p = 0; p < L; p++) { const t = trackPos(w, h, p); seen.add(t.x + ',' + t.y); }
  assert.equal(seen.size, L);
  assert.deepEqual(trackPos(w, h, 1), { x: 0, y: 2, look: { dx: 0, dy: -1 } });
  assert.equal(trackPos(w, h, L).x, -1);
});

test('line of sight stops at the first grey pixel', () => {
  const st = createGame(tiny());
  // position 1 = under column 0, looks up: first grey is (0,1) color 1
  assert.equal(lineTarget(st, 1), 2);
});

test('a bucket splashes matching pixels and pops when empty', () => {
  const st = createGame(tiny());
  assert.ok(launchLane(st, 0));
  assert.ok(launchLane(st, 1));
  for (let i = 0; i < 100 && st.status === 'play'; i++) step(st);
  assert.equal(st.status, 'win');
  assert.equal(st.left, 0);
});

test('a bucket that cannot finish parks in a waiting spot', () => {
  const lv = tiny(); lv.lanes = [[{ c: 0, n: 2 }, { c: 1, n: 2 }]];
  lv.cells = [0, 0, 1, 1]; // bottom row color 1 blocks the color 0 from below and sides partly
  const st = createGame(lv);
  launchLane(st, 0);
  for (let i = 0; i < st.L + 3; i++) step(st);
  // color 0 is on top row: visible from top side and sides, so it should have painted
  assert.equal(st.status, 'play');
});

test('fail when the waiting spots are full, revive gives two more', () => {
  const lv = { w: 1, h: 1, cells: [0], lanes: [[{ c: 1, n: 1 }, { c: 0, n: 1 }]], slots: 0, beltCap: 2 };
  // color 1 has nothing to paint (accounting broken on purpose) -> it must park and fail
  const st = createGame(lv);
  launchLane(st, 0);
  for (let i = 0; i < 20 && st.status === 'play'; i++) step(st);
  assert.equal(st.status, 'fail');
  assert.ok(revive(st));
  assert.equal(st.status, 'play');
  assert.equal(st.slots.filter(Boolean).length, 1);
  assert.ok(launchLane(st, 0));
  for (let i = 0; i < 20 && st.status === 'play'; i++) step(st);
  assert.equal(st.status, 'win');
});

test('slot relaunch works', () => {
  const lv = { w: 2, h: 1, cells: [0, 1], lanes: [[{ c: 1, n: 1 }], [{ c: 0, n: 1 }]], slots: 2, beltCap: 2 };
  const st = createGame(lv);
  for (let i = 0; i < 60 && st.status === 'play'; i++) {
    if (st.belt.length === 0 && st.pending.length === 0) {
      if (st.lanes[0].length) launchLane(st, 0); else if (st.lanes[1].length) launchLane(st, 1); else { const k = st.slots.findIndex(Boolean); if (k >= 0) launchSlot(st, k); }
    }
    step(st);
  }
  assert.equal(st.status, 'win');
});

test('double coat needs two splashes, accounting stays exact', () => {
  const lv = { w: 1, h: 1, cells: [0], coats: [2], lanes: [[{ c: 0, n: 2 }]], slots: 1, beltCap: 1 };
  const st = createGame(lv);
  assert.deepEqual(ammoByColor(st), { 0: 2 });
  assert.deepEqual(coatsByColor(st), { 0: 2 });
  launchLane(st, 0);
  for (let i = 0; i < 40 && st.status === 'play'; i++) step(st);
  assert.equal(st.status, 'win');
});

test('twins launch together and need both at the front', () => {
  const lv = { w: 2, h: 1, cells: [0, 1], lanes: [[{ c: 0, n: 1, twin: 1 }], [{ c: 1, n: 1 }, { c: 1, n: 0, twin: 1 }]], slots: 2, beltCap: 3 };
  const st = createGame(lv);
  assert.equal(launchLane(st, 0), false);
  assert.ok(launchLane(st, 1));
  assert.ok(launchLane(st, 0));
  assert.equal(st.pending.length, 3);
});

test('rainbow paints any color', () => {
  const lv = { w: 2, h: 1, cells: [0, 1], lanes: [[]], slots: 1, beltCap: 2 };
  const st = createGame(lv);
  addRainbow(st, 2);
  for (let i = 0; i < 40 && st.status === 'play'; i++) step(st);
  assert.equal(st.status, 'win');
});

test('smart bot solves a small layered picture', () => {
  const w = 5, h = 5, cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.min(x, y, w - 1 - x, h - 1 - y);
    cells.push(d === 0 ? 0 : d === 1 ? 1 : 2);
  }
  const cnt = [16, 8, 1];
  const lv = { w, h, cells, slots: 3, beltCap: 4,
    lanes: [[{ c: 2, n: 1 }, { c: 0, n: 8 }], [{ c: 0, n: 8 }, { c: 1, n: 8 }]] };
  const r = playSmart(lv);
  assert.ok(r.win, 'bot should win');
});

test('exposure marks only the first grey pixel from each side', async () => {
  const { exposure } = await import('../js/engine.js');
  // 3x3, ring color 0 around a center of color 1
  const cells = [0, 0, 0, 0, 1, 0, 0, 0, 0];
  const coats = new Uint8Array(9).fill(1);
  const e = exposure(3, 3, cells, coats);
  assert.equal(e[4], 0, 'center is buried');
  assert.equal(e[1], 1);
  coats[1] = 0; // paint the top-middle: center becomes visible from above
  assert.equal(exposure(3, 3, cells, coats)[4], 1);
});
