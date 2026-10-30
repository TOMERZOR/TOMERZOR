import {
  MIN_YEAR, NOW_YEAR, FIRST_REAL_YEAR, WAYBACK_FALLBACK, CURVES, HEIGHT_YEAR, SLICES, TICKS,
  releasesFromConfig, releaseForYear, sliderToYear, yearToSlider, roundYear,
  formatYear, caption, sliceCover, seaLevel,
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
    id: "farm", sourceLayer: "landcover", type: "fill", pattern: "wild", opacity: 0.85, cores: false,
    filter: ["==", ["get", "class"], "farmland"],
    birth: curve(CURVES.farmland),
  },
  {
    id: "air", sourceLayer: "aeroway", type: "fill", pattern: "ground", opacity: 1, cores: false,
    filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
    birth: curve(CURVES.airport),
  },
  {
    id: "airline", sourceLayer: "aeroway", type: "line", pattern: "ground", opacity: 1, cores: false,
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

const DEFAULT_GROUND = [146, 138, 104];
const PATTERN_SIZE = 512; // drawn at 2x, so it repeats every 256 screen pixels

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise, a few octaves.
function noiseField(size, seed) {
  const rand = mulberry32(seed);
  const out = new Float32Array(size * size);
  const octaves = [[6, 0.22], [12, 0.3], [24, 0.24], [64, 0.14], [160, 0.1]];
  for (const [cells, weight] of octaves) {
    const grid = Array.from({ length: cells * cells }, rand);
    const at = (x, y) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells, gy = (y / size) * cells;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        let fx = gx - x0, fy = gy - y0;
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
        const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
        out[y * size + x] += (top * (1 - fy) + bottom * fy) * weight;
      }
    }
  }
  return out;
}

const NOISE_GROUND = noiseField(PATTERN_SIZE, 7);
const NOISE_WILD = noiseField(PATTERN_SIZE, 23);

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
  const shade = [base[0] * 0.6, base[1] * 0.72, base[2] * 0.5];
  const wildBase = [base[0] * 0.8 + 52 * 0.2, base[1] * 0.8 + 78 * 0.2, base[2] * 0.8 + 40 * 0.2];
  return {
    ground: makePattern(base, NOISE_GROUND, shade),
    wild: makePattern(wildBase, NOISE_WILD, [wildBase[0] * 0.55, wildBase[1] * 0.7, wildBase[2] * 0.45]),
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

// ---------- the page ----------

const els = {
  slider: document.getElementById("slider"),
  year: document.getElementById("year"),
  caption: document.getElementById("caption"),
  ticks: document.getElementById("ticks"),
  panel: document.getElementById("panel"),
};

let releases = { ...WAYBACK_FALLBACK };
let year = NOW_YEAR;
let groundColor = DEFAULT_GROUND;
let activeImagery = null;
let styleReady = false;

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
if (fromHash && fromHash.year != null) year = fromHash.year;

const map = new maplibregl.Map({
  container: "map",
  center: fromHash ? fromHash.center : DEFAULT_VIEW.center,
  zoom: fromHash ? fromHash.zoom : DEFAULT_VIEW.zoom,
  maxZoom: 19.5,
  attributionControl: { compact: true },
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
  style: {
    version: 8,
    sources: {
      dem: { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 11, attribution: DEM_ATTRIBUTION },
    },
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#10151b" } }],
  },
});
map.touchZoomRotate.disableRotation();
window.zman = { map, setYear: (y) => setYear(y) }; // handy in the console

function baseRelease() {
  return releaseForYear(FIRST_REAL_YEAR, releases);
}

function addImagery(rel) {
  const id = `img-${rel.num}`;
  if (!map.getSource(id)) {
    map.addSource(id, {
      type: "raster", tiles: [waybackTiles(rel.num)], tileSize: 256, maxzoom: 18,
      attribution: IMAGERY_ATTRIBUTION,
    });
    map.addLayer({ id, type: "raster", source: id, paint: { "raster-fade-duration": 250 } }, FIRST_COVER);
  }
  return id;
}

function showImagery(rel) {
  const id = addImagery(rel);
  map.setLayoutProperty(id, "visibility", "visible");
  map.moveLayer(id, FIRST_COVER); // on top of the other photos while it loads
  activeImagery = id;
  hideOtherImageryWhenLoaded();
}

// Keep the previous photo underneath until the new one has loaded, so
// switching years never shows holes.
function hideOtherImageryWhenLoaded() {
  if (!activeImagery || !map.isSourceLoaded(activeImagery)) return;
  const base = `img-${baseRelease().num}`;
  for (const layer of map.getStyle().layers) {
    if (layer.type === "raster" && layer.id !== activeImagery && layer.id !== base) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}

// ---------- OpenStreetMap tiles, rewritten in workers ----------
// The vector tiles go through tile-worker.js (see src/tiles.js), which splits
// merged shapes apart and gives each one its place in the build order.

const workers = Array.from({ length: Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) >> 1)) },
  () => new Worker("js/tile-worker.js"));
const pending = new Map();
let nextJob = 0;
for (const w of workers) {
  w.onmessage = ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    if (data.error) job.reject(new Error(data.error)); else job.resolve(data.data);
  };
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

async function addOsm() {
  const tilejson = await fetch(OSM_TILEJSON).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  map.addSource("osm", {
    type: "vector",
    tiles: tilejson.tiles.map((t) => `zman://${t}`),
    minzoom: tilejson.minzoom || 0,
    maxzoom: Math.min(14, tilejson.maxzoom || 14),
    attribution: OSM_ATTRIBUTION,
  });
  addCovers();
  applyCovers();
}

function addSea() {
  const pats = groundPatterns(groundColor);
  map.addImage("ground", pats.ground, { pixelRatio: 2 });
  map.addImage("wild", pats.wild, { pixelRatio: 2 });
  map.addLayer({
    id: FIRST_COVER, type: "color-relief", source: "dem",
    paint: { "color-relief-opacity": 0, "color-relief-color": seaColor(0) },
  });
}

function addCovers() {
  for (const g of GROUPS) {
    for (let k = 0; k < SLICES.length - 1; k++) {
      const layer = {
        id: coverId(g, k), type: g.type, source: "osm", "source-layer": g.sourceLayer,
        filter: sliceFilter(g, k),
        paint: {},
      };
      if (g.type === "fill") {
        layer.paint["fill-pattern"] = g.pattern;
        layer.paint["fill-antialias"] = false; // no hairline seams between neighboring covers
        layer.paint["fill-opacity"] = 0;
        layer.paint["fill-opacity-transition"] = { duration: 220 };
      } else {
        layer.layout = { "line-cap": "round", "line-join": "round" };
        layer.paint["line-pattern"] = g.pattern;
        layer.paint["line-width"] = g.width;
        layer.paint["line-opacity"] = 0;
        layer.paint["line-opacity-transition"] = { duration: 220 };
      }
      map.addLayer(layer);
    }
  }
}

function seaColor(level) {
  const c = groundColor;
  const sand = "rgb(214, 198, 158)";
  const land = `rgb(${c[0] * 0.92 | 0}, ${c[1] * 0.98 | 0}, ${c[2] * 0.85 | 0})`;
  const shore = `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})`;
  if (level > -6) return ["interpolate", ["linear"], ["elevation"], -2, "rgba(0,0,0,0)", -1, "rgba(0,0,0,0)"];
  return ["interpolate", ["linear"], ["elevation"],
    level - 0.6, "rgba(0,0,0,0)", level, sand, level + 2, land, -2.6, shore, -2, "rgba(0,0,0,0)"];
}

function applyCovers() {
  const past = year < FIRST_REAL_YEAR;
  for (const g of GROUPS) {
    for (let k = 0; k < SLICES.length - 1; k++) {
      if (!map.getLayer(coverId(g, k))) continue;
      map.setPaintProperty(coverId(g, k), opacityProp(g), past ? g.opacity * sliceCover(year, k) : 0);
    }
  }
  const level = seaLevel(year);
  map.setPaintProperty(FIRST_COVER, "color-relief-color", seaColor(level));
  map.setPaintProperty(FIRST_COVER, "color-relief-opacity", level > -6 ? 0 : 0.97);
}

let sampledTile = "";
async function updateGround() {
  const c = map.getCenter();
  const key = tileXY(c.lng, c.lat, 7).join("/");
  if (key === sampledTile) return;
  sampledTile = key;
  try {
    const color = await sampleGround(baseRelease().num, c.lng, c.lat);
    if (!color || key !== sampledTile) return;
    groundColor = color;
    const pats = groundPatterns(color);
    map.updateImage("ground", pats.ground);
    map.updateImage("wild", pats.wild);
    applyCovers();
  } catch {
    // Keep the current color if the sample tile can't be read.
  }
}

function render() {
  els.year.textContent = formatYear(year);
  const rel = releaseForYear(Math.max(year, FIRST_REAL_YEAR), releases);
  const real = year >= FIRST_REAL_YEAR;
  els.caption.textContent = caption(year, rel);
  els.panel.dataset.mode = real ? "real" : "estimate";
  els.slider.setAttribute("aria-valuetext", `${formatYear(year)}, ${els.caption.textContent}`);
  document.title = `${formatYear(year)} · זמן`;
  if (!styleReady) return;
  showImagery(rel);
  applyCovers();
  saveHash();
}

let hashTimer = 0;
function saveHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const c = map.getCenter();
    const hash = `#${map.getZoom().toFixed(2)}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}/${year}`;
    history.replaceState(null, "", hash);
  }, 250);
}

function setYear(next, { moveSlider = true } = {}) {
  next = Math.min(NOW_YEAR, Math.max(MIN_YEAR, next));
  if (moveSlider) els.slider.value = Math.round(yearToSlider(next) * Number(els.slider.max));
  updateSliderFill();
  if (next === year && styleReady && activeImagery) return;
  year = next;
  render();
}

function updateSliderFill() {
  els.slider.style.setProperty("--p", `${(Number(els.slider.value) / Number(els.slider.max)) * 100}%`);
}

function buildTicks() {
  els.ticks.textContent = "";
  for (const t of TICKS) {
    const tick = document.createElement("button");
    tick.type = "button";
    tick.className = `tick${t.wide ? " tick--wide" : ""}`;
    tick.style.left = `${yearToSlider(t.year) * 100}%`;
    tick.textContent = t.label;
    tick.tabIndex = -1;
    tick.addEventListener("click", () => setYear(t.year));
    els.ticks.appendChild(tick);
  }
  els.slider.style.setProperty("--real", `${yearToSlider(FIRST_REAL_YEAR) * 100}%`);
}

// One step of the arrow keys: a year near today, more further back.
function stepYear(dir) {
  const ago = NOW_YEAR - year;
  const step = ago > 3000 ? 100 : ago > 1000 ? 50 : ago > 300 ? 10 : 1;
  return roundYear(year + dir * step);
}

let playing = 0;
function togglePlay() {
  if (playing) { cancelAnimationFrame(playing); playing = 0; return; }
  let t = yearToSlider(year);
  if (t >= 0.999) t = 0;
  let last = performance.now();
  const tick = (now) => {
    t = Math.min(1, t + (now - last) / 30000);
    last = now;
    setYear(sliderToYear(t));
    playing = t < 1 ? requestAnimationFrame(tick) : 0;
  };
  playing = requestAnimationFrame(tick);
}

els.slider.max = 10000;
els.slider.addEventListener("input", () => {
  if (playing) togglePlay();
  setYear(sliderToYear(Number(els.slider.value) / Number(els.slider.max)), { moveSlider: false });
});
els.slider.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setYear(stepYear(-1)); }
  else if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setYear(stepYear(1)); }
  else if (e.key === "Home") { e.preventDefault(); setYear(MIN_YEAR); }
  else if (e.key === "End") { e.preventDefault(); setYear(NOW_YEAR); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === " " && !e.target.closest("button")) { e.preventDefault(); togglePlay(); }
});

buildTicks();
els.slider.value = Math.round(yearToSlider(year) * Number(els.slider.max));
updateSliderFill();
render();

map.on("load", () => {
  // Start with the credits folded into the (i) button; they're one tap away.
  const foldCredits = () => document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  foldCredits();
  map.once("idle", foldCredits);
  addSea();
  addImagery(baseRelease());
  styleReady = true;
  render();
  updateGround();
  addOsm().catch(() => { /* no OpenStreetMap: the photos still work, without the reconstruction */ });
});
map.on("sourcedata", (e) => { if (e.sourceId === activeImagery) hideOtherImageryWhenLoaded(); });
map.on("moveend", () => {
  if (!styleReady) return;
  updateGround();
  saveHash();
});

fetch(WAYBACK_CONFIG)
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((config) => {
    const live = releasesFromConfig(config);
    if (Object.keys(live).length) { releases = live; render(); }
  })
  .catch(() => { /* the built-in list still works */ });
