import {
  MIN_YEAR, NOW_YEAR, FIRST_REAL_YEAR, WAYBACK_FALLBACK, CURVES, HEIGHT_YEAR, SLICES, TICKS,
  releasesFromConfig, releaseForYear, sliderToYear, yearToSlider, roundYear,
  formatYear, yearParts, caption, sliceCover, seaLevel, rulerTicks,
} from "./model.js";

const WAYBACK_CONFIG = "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json";
const waybackTiles = (num) =>
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${num}/{z}/{y}/{x}`;
const OSM_TILEJSON = "https://tiles.openfreemap.org/planet";
const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const IMAGERY_ATTRIBUTION = 'Imagery: <a href="https://livingatlas.arcgis.com/wayback/" target="_blank" rel="noopener">Esri World Imagery Wayback</a>, Maxar, Earthstar Geographics, GIS User Community';
const OSM_ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const DEM_ATTRIBUTION = 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen Terrain Tiles</a>';

const DEFAULT_VIEW = { center: [34.7665, 32.0635], zoom: 14.2 }; // Jaffa and Tel Aviv
const FIRST_COVER = "sea";

// ---------- feature birth expressions ----------

// Each feature's place in the build order, 0..1, set by the tile worker.
const HASH = ["to-number", ["get", "h"], 0.5];

const curve = (stops) => ["interpolate", ["linear"], HASH, ...stops.flat()];

const LANDUSE_BUILT = ["commercial", "industrial", "retail", "railway", "garages", "bus_station", "stadium", "pitch",
  "theme_park", "zoo", "school", "university", "college", "kindergarten", "hospital", "library", "playground",
  "track", "military", "quarry", "dam"];
const ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "busway", "rail", "transit"];

// Road width in meters, turned into pixels at each zoom (about right at mid latitudes).
const ROAD_METERS = ["match", ["get", "class"],
  "motorway", 34, "trunk", 26, "primary", 20, "secondary", 17, "tertiary", 14,
  "rail", 9, "transit", 7, "service", 7, 10];
const metersToPx = (m) => ["interpolate", ["exponential", 2], ["zoom"],
  8, ["*", m, 2 ** -8], 22, ["*", m, 2 ** 6]];

// Each group is one kind of thing that gets covered by land before it existed.
// Drawn in this order: whole neighborhoods last, so where a neighborhood is
// covered, the building and street covers under it (whose textures don't line
// up with it) can't show through.
const GROUPS = [
  {
    id: "farm", sourceLayer: "landcover", type: "fill", pattern: "wild", opacity: 0.85, cores: false, from: -8000,
    filter: ["==", ["get", "class"], "farmland"],
    birth: curve(CURVES.farmland),
  },
  {
    id: "air", sourceLayer: "aeroway", type: "fill", pattern: "ground", opacity: 1, cores: false, from: 1925,
    filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
    birth: curve(CURVES.airport),
  },
  {
    id: "airline", sourceLayer: "aeroway", type: "line", pattern: "ground", opacity: 1, cores: false, from: 1925,
    filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
    birth: curve(CURVES.airport),
    width: metersToPx(["match", ["get", "class"], "runway", 60, 25]),
  },
  {
    id: "edge", sourceLayer: "building", type: "line", pattern: "ground", opacity: 1, cores: true,
    filter: true,
    birth: null,
    // Covers the roof edge and some of the shadow, which the footprint misses.
    width: ["interpolate", ["exponential", 2], ["zoom"], 13, 0.8, 16, 4, 19, 14],
  },
  {
    id: "bldg", sourceLayer: "building", type: "fill", pattern: "ground", opacity: 1, cores: true,
    filter: true,
    birth: null, // set below; shared with the edge layer
  },
  {
    id: "road", sourceLayer: "transportation", type: "line", pattern: "ground", opacity: 1, cores: true,
    filter: ["all",
      ["match", ["get", "class"], ROAD_CLASSES, true, false],
      ["match", ["get", "brunnel"], ["tunnel", "bridge"], false, true],
      ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false]],
    birth: ["match", ["get", "class"],
      ["motorway", "trunk"], curve(CURVES.highway),
      ["primary", "secondary"], curve(CURVES.mainroad),
      ["rail", "transit"], curve(CURVES.rail),
      curve(CURVES.street)],
    width: metersToPx(["*", ROAD_METERS, 1.35]),
  },
  {
    id: "land", sourceLayer: "landuse", type: "fill", pattern: "ground", opacity: 1, cores: true,
    filter: ["match", ["get", "class"], ["residential", "cemetery", ...LANDUSE_BUILT], true, false],
    birth: ["match", ["get", "class"],
      "residential", curve(CURVES.residential),
      "cemetery", curve(CURVES.cemetery),
      curve(CURVES.builtup)],
  },
];
const BUILDING_BIRTH = ["max",
  curve(CURVES.building),
  ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0], ...HEIGHT_YEAR.flat()]];
for (const g of GROUPS) if (g.sourceLayer === "building") g.birth = BUILDING_BIRTH;

// Inside a historic core (the worker marks the founding year as `core`),
// nearly half of what stands today goes back to the founding.
const CORE_BIRTH = ["let", "c", ["to-number", ["get", "core"]],
  ["interpolate", ["linear"], HASH,
    0, ["var", "c"], 0.45, ["var", "c"],
    0.6, ["+", ["var", "c"], ["*", ["-", 1850, ["var", "c"]], 0.6]],
    0.8, 1900, 1, 2010]];

function sliceFilter(g, k) {
  const birth = g.cores ? ["case", ["has", "core"], CORE_BIRTH, g.birth] : g.birth;
  const inSlice = ["let", "b", birth, ["all", [">=", ["var", "b"], SLICES[k]], ["<", ["var", "b"], SLICES[k + 1]]]];
  return g.filter === true ? inSlice : ["all", g.filter, inSlice];
}

const coverId = (g, k) => `c-${g.id}-${k}`;
const opacityProp = (g) => (g.type === "fill" ? "fill-opacity" : "line-opacity");

// ---------- ground textures ----------
// Land drawn over things that didn't exist yet. The color is sampled from a
// wide view of the area so a desert gets sand and a forest gets green.
// Made only once the reconstruction is first needed, so it never delays the
// first photo.

const DEFAULT_GROUND = [146, 138, 104];
const PATTERN_SIZE = 256;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise, a few octaves. The broad ones are kept faint so the
// 256 px repeat doesn't show as a pattern.
function noiseField(size, seed) {
  const rand = mulberry32(seed);
  const out = new Float32Array(size * size);
  for (const [cells, weight] of [[4, 0.08], [8, 0.2], [16, 0.3], [40, 0.24], [96, 0.18]]) {
    const grid = Float32Array.from({ length: cells * cells }, rand);
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cells, y0 = Math.floor(gy);
      let fy = gy - y0; fy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells, x0 = Math.floor(gx);
        let fx = gx - x0; fx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % cells, c1 = (x0 + 1) % cells;
        const top = grid[r0 + c0] * (1 - fx) + grid[r0 + c1] * fx;
        const bottom = grid[r1 + c0] * (1 - fx) + grid[r1 + c1] * fx;
        out[y * size + x] += (top * (1 - fy) + bottom * fy) * weight;
      }
    }
  }
  return out;
}

let noises = null;

function makePattern(base, noise, shadeTint) {
  const data = new Uint8ClampedArray(PATTERN_SIZE * PATTERN_SIZE * 4);
  const rand = mulberry32(99);
  for (let i = 0; i < PATTERN_SIZE * PATTERN_SIZE; i++) {
    const n = noise[i] - 0.5 + (rand() - 0.5) * 0.12; // about -0.55..0.55
    const light = 1 + n * 0.55;
    // Darker patches lean toward the shade tint (vegetation), lighter ones toward dry soil.
    const mix = Math.max(0, -n) * 0.9;
    for (let c = 0; c < 3; c++) {
      const v = base[c] * light * (1 - mix) + shadeTint[c] * mix;
      data[i * 4 + c] = v + (n > 0 ? n * 18 * (c === 0 ? 1 : c === 1 ? 0.8 : 0.4) : 0);
    }
    data[i * 4 + 3] = 255;
  }
  return { width: PATTERN_SIZE, height: PATTERN_SIZE, data };
}

function groundPatterns(base) {
  noises ||= { ground: noiseField(PATTERN_SIZE, 7), wild: noiseField(PATTERN_SIZE, 23) };
  const shade = [base[0] * 0.6, base[1] * 0.72, base[2] * 0.5];
  const wildBase = [base[0] * 0.8 + 52 * 0.2, base[1] * 0.8 + 78 * 0.2, base[2] * 0.8 + 40 * 0.2];
  return {
    ground: makePattern(base, noises.ground, shade),
    wild: makePattern(wildBase, noises.wild, [wildBase[0] * 0.55, wildBase[1] * 0.7, wildBase[2] * 0.45]),
  };
}

function tileXY(lng, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [Math.min(n - 1, Math.max(0, x)), Math.min(n - 1, Math.max(0, y))];
}

/** Median color of the natural-looking pixels in a wide satellite tile. */
async function sampleGround(num, lng, lat) {
  const [x, y] = tileXY(lng, lat, 7);
  const url = waybackTiles(num).replace("{z}", 7).replace("{y}", y).replace("{x}", x);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 64, 64);
  const px = ctx.getImageData(0, 0, 64, 64).data;
  const r = [], g = [], b = [];
  for (let i = 0; i < px.length; i += 4) {
    const [R, G, B] = [px[i], px[i + 1], px[i + 2]];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const luma = 0.3 * R + 0.59 * G + 0.11 * B;
    const sat = max ? (max - min) / max : 0;
    if (B > R + 6 && B >= G - 4) continue; // water
    if (luma < 30) continue; // deep shadow, dark water
    if (luma > 205 && sat < 0.15) continue; // cloud, snow, concrete
    if (sat < 0.07) continue; // gray: towns and roads
    r.push(R); g.push(G); b.push(B);
  }
  if (r.length < 60) return null;
  const median = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [median(r), median(g), median(b)];
}

// ---------- state ----------

const els = {
  hud: document.getElementById("hud"),
  yearNum: document.getElementById("yearNum"),
  yearEra: document.getElementById("yearEra"),
  caption: document.getElementById("caption"),
  captionRow: document.getElementById("captionRow"),
  scrubber: document.getElementById("scrubber"),
  track: document.getElementById("track"),
  ruler: document.getElementById("ruler"),
  labels: document.getElementById("labels"),
  playhead: document.getElementById("playhead"),
};

let releases = { ...WAYBACK_FALLBACK };
let year = NOW_YEAR;
let t = 1; // playhead position 0..1; kept separately so dragging is continuous
let groundColor = DEFAULT_GROUND;
let styleReady = false;
let dragging = false;

function parseHash() {
  const parts = location.hash.replace(/^#/, "").split("/").map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((v) => !Number.isFinite(v))) return null;
  const [zoom, lat, lng, y] = parts;
  return {
    zoom: Math.min(20, Math.max(1, zoom)),
    center: [lng, Math.min(85, Math.max(-85, lat))],
    year: Number.isFinite(y) ? Math.min(NOW_YEAR, Math.max(MIN_YEAR, Math.round(y))) : null,
  };
}

const fromHash = parseHash();
if (fromHash && fromHash.year != null) { year = fromHash.year; t = yearToSlider(year); }

const map = new maplibregl.Map({
  container: "map",
  center: fromHash ? fromHash.center : DEFAULT_VIEW.center,
  zoom: fromHash ? fromHash.zoom : DEFAULT_VIEW.zoom,
  maxZoom: 19.5,
  // Phones with 3x screens would draw 2.25x more pixels for little visible gain.
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  attributionControl: false,
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
  refreshExpiredTiles: false,
  style: {
    version: 8,
    sources: {
      dem: { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 11, attribution: DEM_ATTRIBUTION },
    },
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b0d10" } }],
  },
});
map.touchZoomRotate.disableRotation();
map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-left");
window.zman = { map, setYear: (y) => jumpTo(y) }; // handy in the console

// ---------- satellite photos ----------
// One raster layer per Wayback release, created on first use. The previous
// photo stays underneath until the new one has loaded, so switching years
// never shows holes, and only a few photo layers are ever drawn at once.

const shownImagery = new Set();
let topImagery = null;
let pendingImagery = null;
let wantedRelease = null;
let imageryTimer = 0;

function baseRelease() {
  return releaseForYear(FIRST_REAL_YEAR, releases);
}

function ensureImagery(rel) {
  const id = `img-${rel.num}`;
  if (!map.getSource(id)) {
    map.addSource(id, {
      type: "raster", tiles: [waybackTiles(rel.num)], tileSize: 256, maxzoom: 18,
      attribution: IMAGERY_ATTRIBUTION,
    });
    map.addLayer({ id, type: "raster", source: id, layout: { visibility: "none" }, paint: { "raster-fade-duration": 300 } }, FIRST_COVER);
  }
  return id;
}

function showImagery(rel) {
  const id = ensureImagery(rel);
  if (id === topImagery && !pendingImagery) return;
  if (!shownImagery.has(id)) {
    map.setLayoutProperty(id, "visibility", "visible");
    shownImagery.add(id);
  }
  if (topImagery !== id) {
    map.moveLayer(id, FIRST_COVER);
    topImagery = id;
  }
  pendingImagery = id;
  setLoading(true);
  settleImagery();
}

function settleImagery() {
  if (!pendingImagery || !map.isSourceLoaded(pendingImagery)) return;
  for (const id of shownImagery) {
    if (id !== pendingImagery) map.setLayoutProperty(id, "visibility", "none");
  }
  shownImagery.clear();
  shownImagery.add(pendingImagery);
  pendingImagery = null;
  setLoading(false);
}

/** While dragging, wait until the playhead rests on a year before fetching its photo. */
function requestImagery(rel) {
  if (wantedRelease && wantedRelease.num === rel.num) return;
  wantedRelease = rel;
  clearTimeout(imageryTimer);
  if (dragging) imageryTimer = setTimeout(() => showImagery(rel), 140);
  else showImagery(rel);
}

let loadingOn = false;
function setLoading(on) {
  if (on === loadingOn) return;
  loadingOn = on;
  if (on) els.hud.dataset.loading = ""; else delete els.hud.dataset.loading;
}

// ---------- OpenStreetMap tiles, rewritten in workers ----------
// The vector tiles go through tile-worker.js (see src/tiles.js), which splits
// merged shapes apart and gives each one its place in the build order.
// Nothing here loads until the reconstruction is about to be needed.

let workers = null;
const pending = new Map();
let nextJob = 0;

function startWorkers() {
  workers = Array.from({ length: Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) >> 1)) },
    () => new Worker("js/tile-worker.js"));
  for (const w of workers) {
    w.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.data);
    };
  }
}

maplibregl.addProtocol("zman", (params, abort) => new Promise((resolve, reject) => {
  const url = params.url.slice("zman://".length);
  const m = /\/(\d+)\/(\d+)\/(\d+)\.\w+(\?|$)/.exec(url);
  if (!m) return reject(new Error(`Unexpected tile URL ${url}`));
  const id = nextJob++;
  pending.set(id, { resolve: (data) => resolve({ data }), reject });
  abort.signal.addEventListener("abort", () => pending.delete(id));
  workers[id % workers.length].postMessage({ id, url, z: Number(m[1]), x: Number(m[2]), y: Number(m[3]) });
}));

let coversState = "off"; // off -> loading -> on
const coverLayers = []; // { id, prop, group, k }
const lastOpacity = new Map();

function ensureCovers() {
  if (coversState !== "off" || !styleReady) return;
  coversState = "loading";
  startWorkers();
  const pats = groundPatterns(groundColor);
  map.addImage("ground", pats.ground);
  map.addImage("wild", pats.wild);
  fetch(OSM_TILEJSON)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((tilejson) => {
      map.addSource("osm", {
        type: "vector",
        tiles: tilejson.tiles.map((url) => `zman://${url}`),
        minzoom: tilejson.minzoom || 0,
        maxzoom: Math.min(14, tilejson.maxzoom || 14),
        attribution: OSM_ATTRIBUTION,
      });
      addCoverLayers();
      coversState = "on";
      applyMap();
      updateGround();
    })
    .catch(() => { /* no OpenStreetMap: the photos still work, without the reconstruction */ });
}

function addCoverLayers() {
  for (const g of GROUPS) {
    for (let k = 0; k < SLICES.length - 1; k++) {
      if (SLICES[k + 1] <= (g.from ?? MIN_YEAR)) continue; // nothing of this kind is that old
      const id = coverId(g, k);
      const layer = { id, type: g.type, source: "osm", "source-layer": g.sourceLayer, filter: sliceFilter(g, k), paint: {} };
      if (g.type === "fill") {
        Object.assign(layer.paint, { "fill-pattern": g.pattern, "fill-antialias": false, "fill-opacity": 0, "fill-opacity-transition": { duration: 160 } });
      } else {
        layer.layout = { "line-cap": "round", "line-join": "round" };
        Object.assign(layer.paint, { "line-pattern": g.pattern, "line-width": g.width, "line-opacity": 0, "line-opacity-transition": { duration: 160 } });
      }
      map.addLayer(layer);
      coverLayers.push({ id, prop: opacityProp(g), group: g, k });
      lastOpacity.set(id, 0);
    }
  }
}

function addSea() {
  map.addLayer({
    id: FIRST_COVER, type: "color-relief", source: "dem",
    layout: { visibility: "none" },
    paint: { "color-relief-opacity": 0.97, "color-relief-color": seaColor(-50) },
  });
}

function seaColor(level) {
  const c = groundColor;
  const sand = "rgb(214, 198, 158)";
  const land = `rgb(${c[0] * 0.92 | 0}, ${c[1] * 0.98 | 0}, ${c[2] * 0.85 | 0})`;
  const shore = `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})`;
  return ["interpolate", ["linear"], ["elevation"],
    level - 0.6, "rgba(0,0,0,0)", level, sand, level + 2, land, -2.6, shore, -2, "rgba(0,0,0,0)"];
}

let seaShown = false;
let seaLevelDrawn = null;
function applySea() {
  const level = Math.round(seaLevel(year) * 2) / 2;
  const show = level <= -6;
  if (show !== seaShown) {
    map.setLayoutProperty(FIRST_COVER, "visibility", show ? "visible" : "none");
    seaShown = show;
  }
  if (show && level !== seaLevelDrawn) {
    map.setPaintProperty(FIRST_COVER, "color-relief-color", seaColor(level));
    seaLevelDrawn = level;
  }
}

/** Sets only the layer opacities that changed: a drag usually touches one or two slices. */
function applyCovers() {
  const past = year < FIRST_REAL_YEAR;
  for (const { id, prop, group, k } of coverLayers) {
    const value = past ? Math.round(group.opacity * sliceCover(year, k) * 100) / 100 : 0;
    if (lastOpacity.get(id) === value) continue;
    lastOpacity.set(id, value);
    map.setPaintProperty(id, prop, value);
  }
}

let sampledTile = "";
async function updateGround() {
  if (coversState !== "on") return;
  const c = map.getCenter();
  const key = tileXY(c.lng, c.lat, 7).join("/");
  if (key === sampledTile) return;
  sampledTile = key;
  try {
    const color = await sampleGround(baseRelease().num, c.lng, c.lat);
    if (!color || key !== sampledTile) return;
    const diff = Math.abs(color[0] - groundColor[0]) + Math.abs(color[1] - groundColor[1]) + Math.abs(color[2] - groundColor[2]);
    if (diff < 18) return; // close enough: skip rebuilding the textures
    groundColor = color;
    const pats = groundPatterns(color);
    map.updateImage("ground", pats.ground);
    map.updateImage("wild", pats.wild);
    seaLevelDrawn = null;
    applySea();
  } catch {
    // Keep the current color if the sample tile can't be read.
  }
}

// ---------- applying a year ----------
// Input only records where the playhead is; the HUD and the map catch up once
// per animation frame, however many pointer events arrived in between.

let frame = 0;
let shownMode = "";
let shownYear = null;

function schedule() {
  if (!frame) frame = requestAnimationFrame(flush);
}

function flush() {
  frame = 0;
  drawPlayhead();
  if (year !== shownYear) {
    shownYear = year;
    renderReadout();
    applyMap();
  }
}

function renderReadout() {
  const { num, era } = yearParts(year);
  els.yearNum.textContent = num;
  els.yearEra.textContent = era;
  const rel = releaseForYear(Math.max(year, FIRST_REAL_YEAR), releases);
  const mode = year >= FIRST_REAL_YEAR ? "real" : "estimate";
  els.caption.textContent = caption(year, rel);
  if (mode !== shownMode) {
    els.hud.dataset.mode = mode;
    if (shownMode) { // not on first paint
      els.captionRow.classList.remove("is-swapping");
      void els.captionRow.offsetWidth;
      els.captionRow.classList.add("is-swapping");
    }
    shownMode = mode;
  }
  els.scrubber.setAttribute("aria-valuenow", String(Math.round(t * 1000)));
  els.scrubber.setAttribute("aria-valuetext", `${formatYear(year)}, ${els.caption.textContent}`);
  document.title = `${formatYear(year)} · זמן`;
}

function applyMap() {
  if (!styleReady) return;
  if (year < FIRST_REAL_YEAR + 2) ensureCovers(); // close to the past: get the reconstruction ready
  requestImagery(releaseForYear(Math.max(year, FIRST_REAL_YEAR), releases));
  applyCovers();
  applySea();
  saveHash();
}

let hashTimer = 0;
function saveHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const c = map.getCenter();
    history.replaceState(null, "", `#${map.getZoom().toFixed(2)}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}/${year}`);
  }, 300);
}

// ---------- the scrubber ----------

let trackWidth = 0;
function measure() {
  trackWidth = els.track.getBoundingClientRect().width;
  drawPlayhead();
}

function drawPlayhead() {
  els.playhead.style.setProperty("--x", (t * trackWidth).toFixed(1));
}

function setT(next) {
  t = Math.min(1, Math.max(0, next));
  const y = sliderToYear(t);
  if (y !== year) buzz(year, y);
  year = y;
  schedule();
}

function jumpTo(y) {
  year = Math.min(NOW_YEAR, Math.max(MIN_YEAR, Math.round(y)));
  t = yearToSlider(year);
  schedule();
}

// A light tick on phones that support it, when the playhead crosses a labeled year.
const MAJOR = TICKS.map((tk) => tk.year);
function buzz(from, to) {
  if (!dragging || !navigator.vibrate) return;
  const lo = Math.min(from, to), hi = Math.max(from, to);
  if (MAJOR.some((m) => m > lo && m <= hi)) navigator.vibrate(4);
}

function buildRuler() {
  const ns = "http://www.w3.org/2000/svg";
  const real = yearToSlider(FIRST_REAL_YEAR);
  const majors = new Set(TICKS.map((tk) => tk.year));
  const frag = document.createDocumentFragment();
  const base = document.createElementNS(ns, "line");
  Object.entries({ x1: 0, x2: 1000, y1: 24, y2: 24, class: "base" }).forEach(([k, v]) => base.setAttribute(k, v));
  frag.appendChild(base);
  const marks = rulerTicks(0.0045);
  for (const tk of TICKS) if (!marks.some((m) => m.year === tk.year)) marks.push({ year: tk.year, t: yearToSlider(tk.year) });
  for (const m of marks) {
    const major = majors.has(m.year);
    const line = document.createElementNS(ns, "line");
    const x = (m.t * 1000).toFixed(2);
    line.setAttribute("x1", x); line.setAttribute("x2", x);
    line.setAttribute("y1", major ? 6 : 15); line.setAttribute("y2", 24);
    line.setAttribute("class", `${m.t >= real - 1e-9 ? "real" : "past"}${major ? " major" : ""}`);
    frag.appendChild(line);
  }
  els.ruler.replaceChildren(frag);

  els.labels.replaceChildren(...TICKS.map((tk) => {
    const label = document.createElement("span");
    label.className = `label${tk.wide ? " label--wide" : ""}${tk.year >= FIRST_REAL_YEAR ? " is-real" : ""}`;
    label.style.left = `${yearToSlider(tk.year) * 100}%`;
    label.textContent = tk.label;
    return label;
  }));
}

function pointerT(e) {
  const r = els.track.getBoundingClientRect();
  return (e.clientX - r.left) / r.width;
}

let downX = 0;
els.scrubber.addEventListener("pointerdown", (e) => {
  if (e.button > 0) return;
  stopPlay();
  dragging = true;
  downX = e.clientX;
  els.scrubber.setPointerCapture(e.pointerId);
  els.scrubber.classList.add("is-dragging");
  ensureCovers();
  setT(pointerT(e));
});
els.scrubber.addEventListener("pointermove", (e) => {
  if (dragging) setT(pointerT(e));
});
function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  els.scrubber.classList.remove("is-dragging");
  // A tap (not a drag) near a labeled year lands exactly on it.
  if (Math.abs(e.clientX - downX) < 4 && trackWidth) {
    const near = TICKS.find((tk) => Math.abs(yearToSlider(tk.year) - t) * trackWidth < 12);
    if (near) jumpTo(near.year);
  }
  // Fetch the photo for where the playhead stopped right away.
  clearTimeout(imageryTimer);
  wantedRelease = null;
  if (styleReady) applyMap();
}
els.scrubber.addEventListener("pointerup", endDrag);
els.scrubber.addEventListener("pointercancel", endDrag);

// One step of the arrow keys: a year near today, more further back.
function stepYear(dir, big = false) {
  const ago = NOW_YEAR - year;
  const step = ago > 3000 ? 100 : ago > 1000 ? 50 : ago > 300 ? 10 : 1;
  return roundYear(year + dir * step * (big ? 10 : 1));
}

els.scrubber.addEventListener("focus", () => ensureCovers());
els.scrubber.addEventListener("keydown", (e) => {
  const keys = {
    ArrowLeft: () => stepYear(-1), ArrowDown: () => stepYear(-1),
    ArrowRight: () => stepYear(1), ArrowUp: () => stepYear(1),
    PageDown: () => stepYear(-1, true), PageUp: () => stepYear(1, true),
    Home: () => MIN_YEAR, End: () => NOW_YEAR,
  };
  if (!keys[e.key]) return;
  e.preventDefault();
  stopPlay();
  jumpTo(keys[e.key]());
});

let playing = 0;
function stopPlay() {
  if (playing) cancelAnimationFrame(playing);
  playing = 0;
}
function togglePlay() {
  if (playing) return stopPlay();
  ensureCovers();
  if (t >= 0.999) t = 0;
  let last = performance.now();
  const step = (now) => {
    setT(t + (now - last) / 30000);
    last = now;
    playing = t < 1 ? requestAnimationFrame(step) : 0;
  };
  playing = requestAnimationFrame(step);
}
document.addEventListener("keydown", (e) => {
  if (e.key === " ") { e.preventDefault(); togglePlay(); }
});

new ResizeObserver(measure).observe(els.track);
buildRuler();
measure();
flush();

map.on("load", () => {
  // Start with the credits folded into the (i) button; they're one tap away.
  const foldCredits = () => document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  foldCredits();
  map.once("idle", foldCredits);
  addSea();
  ensureImagery(baseRelease());
  styleReady = true;
  shownYear = null;
  flush();
});
map.on("sourcedata", (e) => {
  if (pendingImagery && e.sourceId === pendingImagery) settleImagery();
});
map.on("idle", () => { if (pendingImagery) settleImagery(); });
map.on("moveend", () => {
  if (!styleReady) return;
  updateGround();
  saveHash();
});

fetch(WAYBACK_CONFIG)
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((config) => {
    const live = releasesFromConfig(config);
    if (!Object.keys(live).length) return;
    releases = live;
    shownYear = null;
    wantedRelease = null;
    schedule();
  })
  .catch(() => { /* the built-in list still works */ });
