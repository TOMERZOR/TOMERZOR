import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_DATA } from '../js/levels-data.js';
import { decodeLevel, levelSpec } from '../js/levels.js';
import { PALETTE, ART, ALBUMS, artToGrid } from '../js/art.js';
import { createGame, ammoByColor, coatsByColor } from '../js/engine.js';
import { playSmart } from '../js/bot.js';

test('every artwork is rectangular, uses known colors and belongs to an album', () => {
  const ids = new Set();
  for (const a of ART) {
    assert.ok(!ids.has(a.id), 'duplicate id ' + a.id); ids.add(a.id);
    assert.equal(new Set(a.rows.map((r) => r.length)).size, 1, a.id + ' has ragged rows');
    assert.ok(ALBUMS.some((al) => al.id === a.album), a.id + ' album');
    artToGrid(a);
  }
  for (const al of ALBUMS) assert.equal(ART.filter((a) => a.album === al.id).length, 10, al.id + ' should have 10 artworks');
});

test('shipped levels: paint shots match pixels exactly for every color', () => {
  assert.ok(LEVEL_DATA.length >= 180);
  LEVEL_DATA.forEach((d, i) => {
    const lv = decodeLevel(d, PALETTE);
    assert.equal(lv.level, i + 1);
    const st = createGame(lv);
    assert.deepEqual(ammoByColor(st), coatsByColor(st), 'level ' + (i + 1));
  });
});

test('shipped levels match the current schedule (art + tag)', () => {
  LEVEL_DATA.forEach((d, i) => {
    const spec = levelSpec(i + 1);
    assert.equal(d.a, spec.art, 'art of level ' + (i + 1));
    assert.equal(d.t, spec.tag, 'tag of level ' + (i + 1));
  });
});

test('every shipped level is solvable by the bot without revives', () => {
  LEVEL_DATA.forEach((d, i) => {
    const r = playSmart(decodeLevel(d, PALETTE));
    assert.ok(r.win, 'level ' + (i + 1) + ' not solved');
  });
});

test('thinking beats spamming: stored difficulty shows a real gap', () => {
  const by = {};
  LEVEL_DATA.forEach((d) => { (by[d.t] = by[d.t] || []).push(d); });
  const avg = (xs, k) => xs.reduce((s, d) => s + d[k], 0) / xs.length;
  for (const tag of ['normal', 'hard', 'super']) {
    const xs = by[tag];
    assert.ok(xs && xs.length, tag);
    const gap = avg(xs, 'aw') - avg(xs, 'r');
    assert.ok(gap >= 30, `${tag}: awake ${avg(xs, 'aw').toFixed(0)} vs random ${avg(xs, 'r').toFixed(0)}`);
  }
  assert.ok(avg(by.normal, 'aw') >= 80, 'normal levels must be fair for a thinking player');
});
