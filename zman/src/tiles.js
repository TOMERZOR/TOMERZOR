// Rewrites an OpenFreeMap (OpenMapTiles schema) vector tile for the time
// slider. The tiles merge look-alike features into one multi-shape per tile
// (all untagged buildings, all residential areas, streets with the same tags),
// which would make whole tiles appear at once. Here every building, area and
// street becomes its own feature again, with:
//   h     0..1, uniform: its place in the order things were built. Mostly
//         smooth noise over the map, so neighborhoods grow together, plus a
//         little per-feature randomness.
//   core  founding year, when it stands in a historic core (see cores.js).
// Only the layers the map uses are kept, with only the fields it reads.

import Pbf from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import vtpbf from "vt-pbf";

const KEEP = {
  building: ["render_height"],
  transportation: ["class", "brunnel"],
  landuse: ["class"],
  landcover: ["class"],
  aeroway: ["class"],
};

// How much of h comes from broad noise (~1 km), local noise (~300 m) and
// per-feature randomness, per layer. Broad noise is kept modest so any
// city-sized view still sees the whole range of ages.
const MIX = {
  building: [0.36, 0.34, 0.3],
  transportation: [0.42, 0.4, 0.18],
  landuse: [0.45, 0.42, 0.13],
  landcover: [0.4, 0.2, 0.4],
  aeroway: [0.3, 0.2, 0.5],
};

// ---------- noise ----------

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(u, v, seed) {
  const x0 = Math.floor(u), y0 = Math.floor(v);
  let fx = u - x0, fy = v - y0;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

// u, v: Web Mercator position scaled so 1 unit is a z15 tile (~1.2 km at the equator).
function rawH(layer, u, v) {
  const [w1, w2, w3] = MIX[layer];
  const broad = valueNoise(u * 1.2, v * 1.2, 11);
  const local = valueNoise(u * 4, v * 4, 29);
  const own = hash2(Math.floor(u * 4096), Math.floor(v * 4096), 53);
  return w1 * broad + w2 * local + w3 * own;
}

// The mix isn't uniform; a lookup table from sampling makes it so, which the
// build-year curves assume.
const LUT_SIZE = 256;
const LUTS = {};
for (const layer of Object.keys(MIX)) {
  const samples = [];
  for (let i = 0; i < 20000; i++) samples.push(rawH(layer, hash2(i, 1, 7) * 5000, hash2(i, 2, 7) * 5000));
  samples.sort((a, b) => a - b);
  LUTS[layer] = Array.from({ length: LUT_SIZE + 1 }, (_, k) => samples[Math.min(samples.length - 1, Math.round((k / LUT_SIZE) * (samples.length - 1)))]);
}

function uniform(layer, raw) {
  const lut = LUTS[layer];
  let lo = 0, hi = LUT_SIZE;
  if (raw <= lut[0]) return 0;
  if (raw >= lut[hi]) return 0.9999;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lut[mid] <= raw) lo = mid; else hi = mid;
  }
  const t = (raw - lut[lo]) / (lut[hi] - lut[lo] || 1);
  return Math.min(0.9999, (lo + t) / LUT_SIZE);
}

export function featureH(layer, u, v) {
  return uniform(layer, rawH(layer, u, v));
}

// ---------- geometry ----------

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x - ring[i].x) * (ring[i].y + ring[j].y);
  }
  return sum;
}

/** Splits MVT polygon rings into polygons: [outer, ...holes][]. */
function splitPolygons(rings) {
  const polygons = [];
  let outerSign = 0;
  for (const ring of rings) {
    const area = ringArea(ring);
    if (area === 0) continue;
    const sign = Math.sign(area);
    if (!outerSign) outerSign = sign;
    if (sign === outerSign || !polygons.length) polygons.push([ring]);
    else polygons[polygons.length - 1].push(ring);
  }
  return polygons;
}

function centroid(ring) {
  let x = 0, y = 0;
  const n = ring.length > 1 ? ring.length - 1 : 1; // skip the closing point
  for (let i = 0; i < n; i++) { x += ring[i].x; y += ring[i].y; }
  return { x: x / n, y: y / n };
}

function insideRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// ---------- the tile ----------

class Feature {
  constructor(type, geometry, properties) {
    this.type = type;
    this.geometry = geometry;
    this.properties = properties;
  }
  loadGeometry() { return this.geometry; }
}

class Layer {
  constructor(name, extent) {
    this.name = name;
    this.extent = extent;
    this.version = 2;
    this.features = [];
  }
  get length() { return this.features.length; }
  feature(i) { return this.features[i]; }
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer  the original tile
 * @param {number} z @param {number} x @param {number} y  its address
 * @param {Array} cores  [name, lon, lat, founded, radius][]
 * @returns {Uint8Array} the rewritten tile
 */
export function transformTile(buffer, z, x, y, cores = []) {
  const tile = new VectorTile(new Pbf(buffer));
  const scale = 2 ** (15 - z); // tile units -> z15 tile units

  // Historic cores near this tile, in this tile's coordinates.
  const n = 2 ** z;
  const lat0 = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  const metersPerTile = (40075016.7 * Math.cos(lat0)) / n;
  const near = [];
  for (const [, lon, lat, founded, radius] of cores) {
    const cx = ((lon + 180) / 360) * n - x;
    const r = (lat * Math.PI) / 180;
    const cy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n - y;
    const rad = radius / metersPerTile;
    if (cx > -rad - 0.1 && cx < 1 + rad + 0.1 && cy > -rad - 0.1 && cy < 1 + rad + 0.1) near.push({ cx, cy, rad, founded });
  }

  const out = {};
  for (const [name, fields] of Object.entries(KEEP)) {
    const src = tile.layers[name];
    if (!src) continue;
    const extent = src.extent;
    const layer = new Layer(name, extent);
    const coreAt = (px, py, polygon) => {
      for (const c of near) {
        const dx = px / extent - c.cx, dy = py / extent - c.cy;
        if (dx * dx + dy * dy < c.rad * c.rad) return c.founded;
        if (polygon && insideRing(polygon[0], c.cx * extent, c.cy * extent)) return c.founded;
      }
      return null;
    };
    const add = (type, geometry, base, px, py, polygon) => {
      const props = { ...base, h: featureH(name, (x + px / extent) * scale, (y + py / extent) * scale) };
      const core = near.length ? coreAt(px, py, polygon) : null;
      if (core != null) props.core = core;
      layer.features.push(new Feature(type, geometry, props));
    };

    for (let i = 0; i < src.length; i++) {
      const f = src.feature(i);
      if (f.type === 1) continue; // points: not drawn
      const base = {};
      for (const k of fields) if (f.properties[k] !== undefined) base[k] = f.properties[k];
      const geom = f.loadGeometry();
      if (f.type === 3) {
        for (const polygon of splitPolygons(geom)) {
          const c = centroid(polygon[0]);
          add(3, polygon, base, c.x, c.y, polygon);
        }
      } else {
        for (const line of geom) {
          if (line.length < 2) continue;
          const mid = line[line.length >> 1];
          add(2, [line], base, mid.x, mid.y, null);
        }
      }
    }
    out[name] = layer;
  }
  return vtpbf.fromVectorTileJs({ layers: out });
}
