import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../js/model.js";
import { CORES } from "../js/cores.js";

test("slider ends are 10,000 BCE and today", () => {
  assert.equal(m.sliderToYear(0), m.MIN_YEAR);
  assert.equal(m.sliderToYear(1), m.NOW_YEAR);
});

test("slider round-trips and gives the real-photo years a good share", () => {
  for (const y of [-10000, -3000, 1, 1000, 1800, 1950, 2000, 2014, 2020, m.NOW_YEAR]) {
    assert.equal(m.sliderToYear(m.yearToSlider(y)), m.roundYear(y));
  }
  const realShare = 1 - m.yearToSlider(m.FIRST_REAL_YEAR);
  assert.ok(realShare > 0.2 && realShare < 0.35, `real share ${realShare}`);
});

test("year text", () => {
  assert.equal(m.formatYear(1948), "1948");
  assert.equal(m.formatYear(0), "1 לפנה״ס");
  assert.equal(m.formatYear(-3000), "3,000 לפנה״ס");
  assert.equal(m.formatYear(-500), "500 לפנה״ס");
});

test("one Wayback release per year, the oldest for 2014", () => {
  const cfg = {
    10: { itemTitle: "World Imagery (Wayback 2014-02-20)" },
    11: { itemTitle: "World Imagery (Wayback 2014-06-01)" },
    20: { itemTitle: "World Imagery (Wayback 2015-03-01)" },
    21: { itemTitle: "World Imagery (Wayback 2015-11-01)" },
    bad: { itemTitle: "nope" },
  };
  const r = m.releasesFromConfig(cfg);
  assert.deepEqual(r, { 2014: [10, "2014-02-20"], 2015: [21, "2015-11-01"] });
  assert.equal(m.releaseForYear(2013, r).num, 10);
  assert.equal(m.releaseForYear(2016, r).num, 21);
  assert.equal(m.caption(2015, m.releaseForYear(2015, r)), "צילום לוויין · נובמבר 2015");
  assert.equal(m.caption(1900, m.releaseForYear(1900, r)), "שחזור משוער");
});

test("covers: everything covered at the start, nothing in 2015", () => {
  for (let k = 0; k < m.SLICES.length - 1; k++) {
    assert.equal(m.sliceCover(m.MIN_YEAR - 1, k), 1);
    assert.equal(m.sliceCover(2015, k), 0);
  }
  assert.equal(m.sliceCover(m.MIN_YEAR, 0), 1);
  assert.ok(m.SLICES.every((v, i) => i === 0 || v > m.SLICES[i - 1]));
});

test("curves end by 2014 and only go forward in h", () => {
  for (const [name, c] of Object.entries(m.CURVES)) {
    assert.ok(c[0][0] === 0 && c.at(-1)[0] === 1, name);
    assert.ok(c.at(-1)[1] <= 2014, name);
    for (let i = 1; i < c.length; i++) assert.ok(c[i][0] > c[i - 1][0] && c[i][1] >= c[i - 1][1], name);
  }
  // about a third of today's buildings stood by 1950
  const share1950 = [...Array(1000).keys()].filter((i) => m.curveYear(m.CURVES.building, i / 1000) <= 1950).length / 1000;
  assert.ok(share1950 > 0.25 && share1950 < 0.45, String(share1950));
});

test("sea level", () => {
  assert.ok(m.seaLevel(m.MIN_YEAR) < -50);
  assert.equal(m.seaLevel(0), 0);
  assert.ok(m.seaLevel(-7000) < m.seaLevel(-6000));
});

test("cores are well formed", () => {
  for (const [name, lon, lat, founded, r] of CORES) {
    assert.ok(Math.abs(lon) <= 180 && Math.abs(lat) <= 90 && founded < 2000 && r > 50 && r < 3000, name);
  }
});
