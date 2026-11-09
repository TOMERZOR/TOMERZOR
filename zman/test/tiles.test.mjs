import test from "node:test";
import assert from "node:assert/strict";
import Pbf from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import vtpbf from "vt-pbf";
import { transformTile, featureH } from "../src/tiles.js";

const square = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }, { x, y }];
const hole = (x, y, s) => square(x, y, s).reverse();
const layer = (name, features) => ({
  name, extent: 4096, version: 2, length: features.length,
  feature: (i) => ({ ...features[i], loadGeometry: () => features[i].geometry }),
});

// A z14 tile over Jaffa's old city (lon 34.7525, lat 32.0545).
const Z = 14, X = 9774, Y = 6644;

function sourceTile() {
  return vtpbf.fromVectorTileJs({
    layers: {
      // One merged feature with three buildings, the middle one with a courtyard.
      building: layer("building", [{ type: 3, properties: { render_height: 5, colour: "#ccc" },
        geometry: [square(100, 100, 50), square(300, 300, 80), hole(320, 320, 20), square(3000, 3000, 40)] }]),
      transportation: layer("transportation", [{ type: 2, properties: { class: "minor", oneway: 0 },
        geometry: [[{ x: 0, y: 10 }, { x: 4096, y: 10 }], [{ x: 10, y: 0 }, { x: 10, y: 4096 }]] }]),
      water: layer("water", [{ type: 3, properties: { class: "ocean" }, geometry: [square(0, 0, 4096)] }]),
    },
  });
}

test("merged shapes come out as separate features, holes kept", () => {
  const out = new VectorTile(new Pbf(transformTile(sourceTile(), Z, X, Y, [])));
  assert.deepEqual(Object.keys(out.layers).sort(), ["building", "transportation"]);
  const b = out.layers.building;
  assert.equal(b.length, 3);
  assert.equal(b.feature(1).loadGeometry().length, 2, "courtyard kept as a hole");
  for (let i = 0; i < b.length; i++) {
    const p = b.feature(i).properties;
    assert.equal(p.render_height, 5);
    assert.equal(p.colour, undefined, "unused fields dropped");
    assert.ok(p.h >= 0 && p.h < 1);
  }
  assert.equal(out.layers.transportation.length, 2);
  assert.equal(out.layers.transportation.feature(0).properties.class, "minor");
});

test("features in a historic core carry its founding year", () => {
  // Core centered on this tile's first building.
  const n = 2 ** Z;
  const lon = ((X + 125 / 4096) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (Y + 125 / 4096)) / n))) * 180) / Math.PI;
  const out = new VectorTile(new Pbf(transformTile(sourceTile(), Z, X, Y, [["Test", lon, lat, -1800, 300]])));
  const b = out.layers.building;
  assert.equal(b.feature(0).properties.core, -1800);
  assert.equal(b.feature(2).properties.core, undefined, "far corner is outside");
});

test("h is spread evenly and smooth across the map", () => {
  const hs = [];
  for (let i = 0; i < 4000; i++) hs.push(featureH("building", (i * 7.31) % 900, (i * 3.77) % 900));
  const quarter = hs.filter((h) => h < 0.25).length / hs.length;
  assert.ok(quarter > 0.18 && quarter < 0.32, `share below 0.25: ${quarter}`);
  // neighbors 20 m apart are much closer in h than random pairs
  let near = 0, far = 0;
  for (let i = 0; i < 2000; i++) {
    const u = (i * 1.37) % 500, v = (i * 2.11) % 500;
    near += Math.abs(featureH("transportation", u, v) - featureH("transportation", u + 0.016, v));
    far += Math.abs(featureH("transportation", u, v) - featureH("transportation", u + 37.3, v + 11.1));
  }
  assert.ok(near < far * 0.6, `near ${near} far ${far}`);
});
