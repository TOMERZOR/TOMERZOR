// The map behind every round, at night: two pins, then the real route
// drawing itself in the color of the way of travel, with the 3D vehicle
// riding along it.
//
// The street map comes from the first service that answers, all free and
// keyless:
//   1. OpenFreeMap vector tiles, drawn by MapLibre: recolored in code into
//      the night palette and tilted (pitch ~38 degrees, like golfee).
//   2. OpenStreetMap's raster tiles, darkened with a CSS filter (Leaflet).
//   3. Esri's World Street Map, the same way.
// If none can load, the game draws its own map from Natural Earth data in
// the night palette. City names are HTML over the map (our own places and
// Natural Earth's list), so Hebrew always shows right.

import { getLang } from "./i18n.js";
import { src3d, MODE_3D, MODE_HEX } from "./icons.js";
import { reducedMotion } from "./ui.js";
import { PLACES } from "../core/places.js";

const L = window.L;
const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const NE_CREDIT = 'Map data: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>';

// The night palette (REDESIGN-PROMPT.md 5.5): charcoal land, deep navy sea,
// dark green parks, lime main roads. Nothing in the purple range.
const NIGHT = {
  water: "#06111A", land: "#1C232C", park: "#18261F", residential: "#1F2731", ice: "#232B35",
  major: "#C8FF3D", majorOpacity: 0.35, secondary: "#3C4856", local: "#2C3541",
  border: "#5C6B7C", building: "#252E39", aeroway: "#2C3541",
};
const PIN_COLOR = { a: "#C8FF3D", b: "#FF8A2A" };
const PITCH = 38;

const STYLES = ["https://tiles.openfreemap.org/styles/dark", "https://tiles.openfreemap.org/styles/liberty"];
const RASTERS = [
  { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", opts: { maxZoom: 19, attribution: OSM, className: "tiles-night" } },
  { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", opts: { maxZoom: 19, attribution: "Tiles © Esri", className: "tiles-night" } },
];

let host = null; // the #map element
let view = null; // the live map: a GL view or a Leaflet view (below)
let source = null; // { kind: "vector", style } | { kind: "raster", i } | { kind: "offline" }
let probe = null;
let scene = null; // what is on the map now, to put back after a switch: { round, route }
let animFrame = 0;

const vendor = (f) => new URL(`../vendor/${f}`, import.meta.url).href;

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function fetchStyle() {
  for (const url of STYLES) {
    try {
      const res = await withTimeout(fetch(url, { mode: "cors" }), 8000);
      if (!res?.ok) continue;
      const st = await res.json();
      if (st?.sources && st.layers?.length) return st;
    } catch {}
  }
  return null;
}

function imageOk(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve("slow"), 8000);
    img.onload = () => { clearTimeout(timer); resolve("ok"); };
    img.onerror = () => { clearTimeout(timer); resolve("fail"); };
    img.src = url.replace("{z}", "5").replace("{x}", "19").replace("{y}", "13");
  });
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
}

let glReady = null;
function loadGL() {
  if (!glReady) {
    glReady = (async () => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = vendor("maplibre/maplibre-gl.css");
      document.head.append(css);
      await loadScript(vendor("maplibre/maplibre-gl.js"));
      return !!window.maplibregl;
    })().catch(() => false);
  }
  return glReady;
}

// Called once at startup: find the first map service that answers, so the
// first round already has its map. If none does, load the built-in map.
export function prepareMap() {
  if (probe) return probe;
  probe = (async () => {
    const [style, ...rasters] = await Promise.all([fetchStyle(), ...RASTERS.map((r) => imageOk(r.url))]);
    if (style && hasWebGL() && (await loadGL())) {
      source = { kind: "vector", style };
    } else {
      let i = rasters.indexOf("ok");
      if (i < 0) i = rasters.indexOf("slow");
      source = i >= 0 ? { kind: "raster", i } : { kind: "offline" };
    }
    if (host) applySource();
    return source;
  })();
  return probe;
}

export function initMap(el) {
  if (host) return;
  host = el;
  if (source) applySource();
  else prepareMap();
}

// Which map is showing, for the Profile screen.
export function mapStatus() {
  if (!source) return "checking";
  if (source.kind === "vector") return "openfreemap";
  if (source.kind === "raster") return source.i === 0 ? "osm" : "esri";
  return "builtin";
}

function applySource() {
  if (!host || !source) return;
  cancelAnimationFrame(animFrame);
  view?.destroy();
  view = source.kind === "vector" ? glView() : leafletView();
  if (!view) {
    source = { kind: "offline" };
    view = leafletView();
  }
}

// When the street map fails after all, move down the list.
function nextSource() {
  if (source?.kind === "vector") source = { kind: "raster", i: 0 };
  else if (source?.kind === "raster" && source.i < RASTERS.length - 1) source = { kind: "raster", i: source.i + 1 };
  else source = { kind: "offline" };
  applySource();
}

// The built-in map is a last resort: at the start of each game, ask the map
// services again in case the network has come back.
let retrying = false;
export async function retryRealMap() {
  if (source?.kind !== "offline" || retrying || !host) return;
  retrying = true;
  probe = null;
  const prev = source;
  try {
    await prepareMap();
  } finally {
    retrying = false;
  }
  if (source?.kind === "offline") source = prev;
}

export function relabel() {
  view?.labels();
}

// For tests and debugging: which engine is up and where the camera is.
export function debugMap() {
  if (!view) return { kind: null, source: source?.kind || null };
  if (view.kind === "gl") {
    const m = view.map;
    return { kind: "gl", source: "vector", pitch: m.getPitch(), zoom: m.getZoom(), center: m.getCenter().toArray(), padding: m.getPadding() };
  }
  return { kind: "leaflet", source: source?.kind, zoom: view.map.getZoom() };
}

export function invalidate() {
  view?.resize();
}

export function zoomBy(d) {
  view?.zoomBy(d);
}

export function clear() {
  scene = null;
  cancelAnimationFrame(animFrame);
  view?.clear();
}

// Pan away from everything for menus.
export function idle() {
  clear();
  view?.idle();
}

const maxZoomFor = (mode) => (mode === "foot" || mode === "bike" ? 16 : mode === "flight" ? 6 : 12);

function tripPoints(round) {
  const a = [round.from.lat, round.from.lon];
  let b = [round.to.lat, round.to.lon];
  if (round.mode === "flight") {
    // take the short way around the globe
    while (b[1] - a[1] > 180) b = [b[0], b[1] - 360];
    while (b[1] - a[1] < -180) b = [b[0], b[1] + 360];
  }
  return [a, b];
}

// Show the two places of a round.
export async function showTrip(round, pad) {
  if (!view) {
    scene = { round, pad };
    return;
  }
  clear();
  scene = { round, pad };
  view.resize();
  const [a, b] = tripPoints(round);
  view.pins(a, b);
  await view.fit([a, b], pad, maxZoomFor(round.mode), round.mode);
}

function arc(a, b, n = 48) {
  // a gentle curve for routes we only know the numbers of
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[1] - a[1], dy = b[0] - a[0];
  const ctrl = [mid[0] + dx * 0.18, mid[1] - dy * 0.18];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([
      (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * ctrl[0] + t * t * b[0],
      (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * ctrl[1] + t * t * b[1],
    ]);
  }
  return pts;
}

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Rough distance along the path (degrees, scaled by latitude), enough to
// move the vehicle at an even speed.
function cumulative(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const [la1, lo1] = pts[i - 1], [la2, lo2] = pts[i];
    const k = Math.cos((((la1 + la2) / 2) * Math.PI) / 180);
    cum.push(cum[i - 1] + Math.hypot(la2 - la1, (lo2 - lo1) * k));
  }
  return cum;
}

function along(pts, cum, d) {
  let k = 1;
  while (k < cum.length - 1 && cum[k] < d) k++;
  const seg = cum[k] - cum[k - 1] || 1;
  const f = Math.max(0, Math.min(1, (d - cum[k - 1]) / seg));
  return { k, p: [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f] };
}

// Draw the real route. Resolves when the line has finished drawing.
export async function drawRoute(round, route, pad, ms = 2200) {
  if (!view) {
    // the map isn't up yet: it draws the finished route when it is
    scene = { round, route, pad: pad || scene?.pad };
    return;
  }
  const [a, b] = tripPoints(round);
  let pts = route.geometry?.length > 1 ? route.geometry : arc(a, b);
  if (round.mode === "flight" && pts.length > 1) {
    // keep a great circle continuous across the date line
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      let [la, lo] = pts[i];
      const prev = out[i - 1][1];
      while (lo - prev > 180) lo -= 360;
      while (lo - prev < -180) lo += 360;
      out.push([la, lo]);
    }
    pts = out;
  }
  const color = MODE_HEX[round.mode] || MODE_HEX.car;
  const exact = !!route.geometry?.length;
  const usePad = pad || scene?.pad;
  scene = { round, route, pad: usePad };
  await view.fit(pts, usePad, maxZoomFor(round.mode) + 1, round.mode);
  const line = view.route(pts, color, exact);
  if (reducedMotion() || ms <= 0) {
    line.progress(1);
    return;
  }
  const cum = cumulative(pts);
  const total = cum[cum.length - 1] || 1;
  const veh = view.vehicle(round.mode, pts[0]);
  return new Promise((resolve) => {
    const t0 = performance.now();
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = easeInOut(p);
      line.progress(e);
      const at = along(pts, cum, e * total);
      veh.move(at.p, pts[Math.max(0, at.k - 1)], pts[at.k]);
      if (p < 1) animFrame = requestAnimationFrame(frame);
      else {
        setTimeout(() => veh.remove(), 600);
        resolve();
      }
    };
    animFrame = requestAnimationFrame(frame);
  });
}

// ---------- pins, vehicle, labels: the HTML shared by both engines ----------
function pinHtml(kind) {
  const he = getLang() === "he";
  const label = kind === "a" ? (he ? "א" : "A") : he ? "ב" : "B";
  return `<div class="pin ${kind}" style="--c:${PIN_COLOR[kind]}"><span class="rip"></span><span class="pc">${label}</span></div>`;
}

function vehicleEl(mode) {
  const el = document.createElement("div");
  el.className = "vehicle";
  el.innerHTML = `<img class="i3d" src="${src3d(MODE_3D[mode] || "car")}" alt="" width="44" height="44">`;
  return el;
}

// Point the vehicle: the plane turns to its heading (its art points up and
// to the right); the car, bike and walker only face left or right.
function aim(img, mode, dx, dy) {
  if (!img || (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)) return;
  if (mode === "flight") {
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 45;
    img.style.transform = `rotate(${deg.toFixed(1)}deg)`;
  } else {
    // the car and the bike face left, the walker faces right
    const facesLeft = mode !== "foot";
    const goingLeft = dx < 0;
    img.style.transform = goingLeft === facesLeft ? "" : "scaleX(-1)";
  }
}

// Place names: our own places with their Hebrew names win over Natural
// Earth's where both exist.
let allPlaces = null;
let nePlaces = null;
function loadPlaces() {
  if (!nePlaces) nePlaces = fetch(vendor("basemap-places.json")).then((r) => r.json()).catch(() => []);
  return nePlaces;
}
function placeList(ne) {
  if (allPlaces) return allPlaces;
  const near = (a, c) => Math.abs(a[0] - c[0]) < 0.05 && Math.abs(a[1] - c[1]) < 0.06;
  const own = Object.values(PLACES).filter((p) => !p.city).map((p) => [p.lat, p.lon, p.en, p.he, p.r === "il" ? 5 : 3]);
  allPlaces = [...own, ...(ne || []).filter((p) => !own.some((o) => near(o, p)))].sort((a, c) => a[4] - c[4]);
  return allPlaces;
}

// Pick the names to show: biggest first, no overlaps, none under the pins.
// project: [lat, lon] -> {x, y} in the map's pixels; z: the zoom in
// Leaflet's terms.
function pickLabels(list, project, z, inView, pinPts) {
  const he = getLang() === "he";
  const taken = pinPts.map((pt) => [pt.x - 28, pt.y - 30, pt.x + 28, pt.y + 30]);
  const out = [];
  for (const p of list) {
    if (p[4] > z - 1.5) break;
    if (out.length >= 60) break;
    if (!inView(p)) continue;
    const name = (he && p[3]) || p[2];
    if (!name) continue;
    const pt = project(p);
    if (!pt) continue;
    const w = name.length * 7.2 + 14, h = 20;
    const box = [pt.x - w / 2, pt.y - h - 4, pt.x + w / 2, pt.y + 4];
    if (taken.some((t) => !(box[2] < t[0] || box[0] > t[2] || box[3] < t[1] || box[1] > t[3]))) continue;
    taken.push(box);
    out.push({ p, name, big: p[4] <= 2 });
  }
  return out;
}

const labelHtml = (name, big) => `<div class="map-label ${big ? "big" : ""}"><i></i><span>${name.replace(/[<>&]/g, "")}</span></div>`;

// ---------- MapLibre: the tilted night map ----------
function nightStyle(raw) {
  const st = JSON.parse(JSON.stringify(raw));
  delete st.sprite;
  delete st.terrain;
  st.sky = { "sky-color": NIGHT.water, "horizon-color": NIGHT.land, "fog-color": NIGHT.water, "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.8, "atmosphere-blend": 0 };
  st.layers = st.layers.filter((l) => !["symbol", "raster", "hillshade", "heatmap", "fill-extrusion"].includes(l.type));
  // lime only for the highways, so the route stays the brightest line
  const roadColor = ["match", ["get", "class"], ["motorway", "trunk"], NIGHT.major, ["primary", "secondary", "tertiary"], NIGHT.secondary, NIGHT.local];
  const roadOpacity = ["match", ["get", "class"], ["motorway", "trunk"], NIGHT.majorOpacity, 1];
  for (const l of st.layers) {
    const id = l.id.toLowerCase();
    const sl = String(l["source-layer"] || "").toLowerCase();
    const p = (l.paint ||= {});
    const lay = (l.layout ||= {});
    for (const k of ["fill-pattern", "line-pattern", "background-pattern", "fill-outline-color", "line-gradient"]) delete p[k];
    const fill = (c, o = 1) => { p["fill-color"] = c; p["fill-opacity"] = o; p["fill-antialias"] = true; };
    if (l.type === "background") { p["background-color"] = NIGHT.land; continue; }
    if (sl === "water") { if (l.type === "fill") fill(NIGHT.water); else { p["line-color"] = NIGHT.water; } continue; }
    if (sl === "waterway") { p["line-color"] = NIGHT.water; p["line-opacity"] = 1; continue; }
    if (sl === "landcover") { fill(/ice|glacier/.test(id) ? NIGHT.ice : NIGHT.park, 0.9); continue; }
    if (sl === "park") { if (l.type === "fill") fill(NIGHT.park); else lay.visibility = "none"; continue; }
    if (sl === "landuse") { fill(/residential/.test(id) ? NIGHT.residential : NIGHT.park, 0.9); continue; }
    if (sl === "building") { fill(NIGHT.building, 0.9); l.minzoom = Math.max(l.minzoom || 0, 15); continue; }
    if (sl === "aeroway") { if (l.type === "fill") fill(NIGHT.aeroway); else { p["line-color"] = NIGHT.aeroway; if (/casing/.test(id)) lay.visibility = "none"; } continue; }
    if (sl === "boundary") { p["line-color"] = NIGHT.border; p["line-opacity"] = 0.8; p["line-dasharray"] = [2, 2]; continue; }
    if (sl === "transportation") {
      if (l.type === "fill") { fill(NIGHT.land); continue; }
      if (/casing|hatching|dashline|rail|transit|ferry|pier/.test(id)) { lay.visibility = "none"; continue; }
      p["line-color"] = roadColor;
      p["line-opacity"] = roadOpacity;
      delete p["line-dasharray"];
      continue;
    }
    if (l.type === "fill") fill(NIGHT.land);
    else if (l.type === "line") p["line-color"] = NIGHT.local;
    else if (l.type === "circle") lay.visibility = "none";
  }
  return st;
}

function glView() {
  const gl = window.maplibregl;
  if (!gl || !source?.style) return null;
  let map;
  try {
    map = new gl.Map({
      container: host,
      style: nightStyle(source.style),
      center: [35, 31.6],
      zoom: 6,
      pitch: PITCH,
      bearing: 0,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      keyboard: false,
      fadeDuration: 150,
      maxPitch: 60,
      renderWorldCopies: true,
    });
  } catch {
    return null;
  }
  map.touchZoomRotate.disableRotation();
  let loaded = false;
  let probing = false;
  let pins = [];
  let labelMarkers = [];
  let lastPins = [];
  map.on("load", () => {
    loaded = true;
    map.addSource("route", { type: "geojson", lineMetrics: true, data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MODE_HEX.car, "line-width": 16, "line-blur": 10, "line-opacity": 0.5 } });
    map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MODE_HEX.car, "line-width": 6 } });
    // the credits fold into the (i) button instead of covering the map
    host.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
    v.labels();
    if (scene) restore();
  });
  map.on("error", (e) => {
    if (!loaded && /style|fetch|load|source|tile/i.test(String(e?.error?.message || ""))) {
      loaded = true;
      nextSource();
    }
  });
  map.on("moveend", () => !probing && v.labels());
  setTimeout(() => {
    if (!loaded && view === v) nextSource();
  }, 12000);

  const ll = (p) => [p[1], p[0]];
  const restore = () => {
    const s = scene;
    if (!s) return;
    const [a, b] = tripPoints(s.round);
    v.pins(a, b);
    if (s.route) {
      const pts = s.route.geometry?.length > 1 ? s.route.geometry : arc(a, b);
      v.route(pts, MODE_HEX[s.round.mode] || MODE_HEX.car, !!s.route.geometry?.length).progress(1);
    }
    v.fit(s.route?.geometry?.length > 1 ? s.route.geometry : [a, b], s.pad, maxZoomFor(s.round.mode) + (s.route ? 1 : 0), s.round.mode, true);
  };

  // Fit points on a tilted map: find the center and zoom on the side, by
  // moving the camera and measuring inside one task (nothing paints in
  // between), then fly there.
  const fitCamera = (points, pad, maxZoom, pitch) => {
    const W = host.clientWidth, H = host.clientHeight;
    // keep at least a 60px window between the panels
    const squeeze = (a, b, size) => {
      const over = a + b + 60 - size;
      if (over <= 0) return [a, b];
      const k = Math.max(0, (size - 60) / (a + b || 1));
      return [Math.floor(a * k), Math.floor(b * k)];
    };
    const [top, bottom] = squeeze(pad.top, pad.bottom, H);
    const [left, right] = squeeze(pad.left, pad.right, W);
    const padding = { top, bottom, left, right };
    const lngs = points.map((p) => p[1]), lats = points.map((p) => p[0]);
    const bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
    const save = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padding: map.getPadding() };
    probing = true;
    // cameraForBounds counts the map's current padding on top of ours: clear it
    map.jumpTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, pitch: 0, bearing: 0 });
    const flat = map.cameraForBounds(bounds, { padding, maxZoom });
    if (!flat) {
      map.jumpTo(save);
      probing = false;
      return null;
    }
    let center = flat.center, zoom = Math.min(flat.zoom, maxZoom);
    const sample = points.length > 40 ? points.filter((_, i) => i % Math.ceil(points.length / 40) === 0 || i === points.length - 1) : points;
    const box = [left, top, W - right, H - bottom];
    try {
      for (let k = 0; k < 14; k++) {
        map.jumpTo({ center, zoom, pitch, bearing: 0, padding });
        const ps = sample.map((p) => map.project(ll(p)));
        const minX = Math.min(...ps.map((q) => q.x)), maxX = Math.max(...ps.map((q) => q.x));
        const minY = Math.min(...ps.map((q) => q.y)), maxY = Math.max(...ps.map((q) => q.y));
        const fits = minX >= box[0] && maxX <= box[2] && minY >= box[1] && maxY <= box[3];
        // move so the points sit in the middle of the free area
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const bx = (box[0] + box[2]) / 2, by = (box[1] + box[3]) / 2;
        // with padding, the camera's center shows at the middle of the free
        // area, so aim it at the middle of the points
        if (Math.abs(cx - bx) > 2 || Math.abs(cy - by) > 2) {
          const c = map.unproject([cx, cy]);
          center = [c.lng, c.lat];
        }
        if (fits && k > 1) break;
        if (!fits) zoom -= 0.25;
      }
    } finally {
      map.jumpTo(save);
      probing = false;
    }
    return { center, zoom, pitch, bearing: 0, padding };
  };

  const v = {
    kind: "gl",
    map,
    destroy() {
      cancelAnimationFrame(animFrame);
      pins.forEach((m) => m.remove());
      labelMarkers.forEach((m) => m.remove());
      try { map.remove(); } catch {}
      host.innerHTML = "";
    },
    resize() { try { map.resize(); } catch {} },
    zoomBy(d) { map.easeTo({ zoom: map.getZoom() + d, duration: 300 }); },
    clear() {
      pins.forEach((m) => m.remove());
      pins = [];
      lastPins = [];
      if (loaded) map.getSource("route")?.setData({ type: "FeatureCollection", features: [] });
      v.labels();
    },
    idle() { map.jumpTo({ center: [35, 31.7], zoom: 6.3, pitch: PITCH, bearing: 0 }); },
    pins(a, b) {
      pins.forEach((m) => m.remove());
      lastPins = [a, b];
      pins = [["a", a], ["b", b]].map(([k, p]) => {
        const el = document.createElement("div");
        el.innerHTML = pinHtml(k);
        return new gl.Marker({ element: el.firstElementChild, anchor: "center" }).setLngLat(ll(p)).addTo(map);
      });
    },
    fit(points, pad, maxZoomLeaflet, mode, instant = false) {
      const pitch = mode === "flight" ? 24 : PITCH;
      const cam = fitCamera(points, pad, maxZoomLeaflet - 1, pitch);
      if (!cam) return Promise.resolve();
      return new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        map.once("moveend", finish);
        setTimeout(finish, 1500);
        if (instant || reducedMotion()) map.jumpTo(cam);
        else map.flyTo({ ...cam, duration: 1100, curve: 1.3, essential: true });
      });
    },
    route(pts, color, exact) {
      const data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts.map(ll) } };
      if (!loaded) return { progress() {} };
      map.getSource("route")?.setData(data);
      for (const id of ["route-glow", "route-line"]) {
        map.setPaintProperty(id, "line-color", color);
        map.setPaintProperty(id, "line-dasharray", exact || id === "route-glow" ? null : [0.2, 2.2]);
        map.setPaintProperty(id, "line-gradient", undefined);
        map.setPaintProperty(id, "line-opacity", exact ? (id === "route-glow" ? 0.5 : 1) : 0);
      }
      // the glow of a dashed arc stays off; the dots carry it
      if (!exact) map.setPaintProperty("route-glow", "line-width", 0);
      else map.setPaintProperty("route-glow", "line-width", 16);
      return {
        progress(e) {
          if (exact) {
            const g = e >= 1 ? null : ["step", ["line-progress"], color, Math.max(0.0005, e), "rgba(0,0,0,0)"];
            for (const id of ["route-glow", "route-line"]) {
              try { map.setPaintProperty(id, "line-gradient", g || undefined); } catch {}
            }
          } else {
            map.setPaintProperty("route-line", "line-opacity", e);
            map.setPaintProperty("route-glow", "line-opacity", 0.5 * e);
          }
        },
      };
    },
    vehicle(mode, at) {
      const el = vehicleEl(mode);
      const img = el.querySelector("img");
      const m = new gl.Marker({ element: el, anchor: "center" }).setLngLat(ll(at)).addTo(map);
      return {
        move(p, from, to) {
          m.setLngLat(ll(p));
          const A = map.project(ll(from)), B = map.project(ll(to));
          aim(img, mode, B.x - A.x, B.y - A.y);
        },
        remove() {
          el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => m.remove(), () => m.remove());
        },
      };
    },
    async labels() {
      if (!loaded) return;
      const ne = await loadPlaces();
      if (view !== v) return;
      labelMarkers.forEach((m) => m.remove());
      labelMarkers = [];
      const W = host.clientWidth, H = host.clientHeight;
      const z = map.getZoom() + 1; // in Leaflet's terms
      const list = placeList(ne);
      const proj = (p) => {
        const q = map.project([p[1], p[0]]);
        return q.x > -20 && q.x < W + 20 && q.y > 76 && q.y < H + 20 ? q : null;
      };
      const pinPts = lastPins.map((p) => map.project(ll(p)));
      const picked = pickLabels(list, proj, z, () => true, pinPts);
      for (const { p, name, big } of picked) {
        const el = document.createElement("div");
        el.className = "gl-label";
        el.innerHTML = labelHtml(name, big);
        labelMarkers.push(new gl.Marker({ element: el, anchor: "bottom" }).setLngLat([p[1], p[0]]).addTo(map));
      }
    },
  };
  return v;
}

// ---------- Leaflet: street tiles darkened, or the built-in night map ----------
function leafletView() {
  if (!L) return null;
  host.innerHTML = "";
  const map = L.map(host, {
    zoomControl: false,
    attributionControl: true,
    worldCopyJump: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    fadeAnimation: true,
  }).setView([31.6, 35], 7);
  map.attributionControl.setPrefix(false);
  const layer = L.layerGroup().addTo(map);
  let labels = null;
  let base = null;
  let baseLayers = [];
  let tiles = null;
  let lastPins = [];
  const offline = source.kind !== "raster";

  if (!offline) {
    const R = RASTERS[source.i];
    let ok = 0, err = 0;
    tiles = L.tileLayer(R.url, { detectRetina: false, ...R.opts });
    tiles.on("tileload", () => ok++);
    tiles.on("tileerror", () => {
      err++;
      if (err >= 4 && ok === 0 && view === v) nextSource();
    });
    tiles.addTo(map);
  } else {
    map.getContainer().style.background = NIGHT.water;
    map.attributionControl.addAttribution(NE_CREDIT);
    fetch(vendor("basemap.json")).then((r) => r.json()).then((data) => {
      if (view !== v) return;
      base = data;
      drawBase();
      v.labels();
    }).catch(() => {});
  }

  function drawBase() {
    baseLayers.forEach((l) => l.remove());
    baseLayers = [];
    const renderer = L.canvas({ padding: 0.4 });
    const pane = map.getPane("basemap") || map.createPane("basemap");
    pane.style.zIndex = 150;
    const ll = (r, shift = 0) => r.map(([lon, lat]) => [lat, lon + shift]);
    const add = (l) => baseLayers.push(l.addTo(map));
    const common = { renderer, pane: "basemap", interactive: false, smoothFactor: 1.2 };
    for (const shift of [0, -360, 360]) {
      add(L.polygon(base.land.map((r) => [ll(r, shift)]), { ...common, stroke: false, fillColor: NIGHT.land, fillOpacity: 1 }));
    }
    add(L.polygon(base.lakes.map((r) => [ll(r)]), { ...common, stroke: false, fillColor: NIGHT.water, fillOpacity: 1 }));
    add(L.polyline(base.roads.minor.map((r) => ll(r)), { ...common, color: NIGHT.local, weight: 1.8, opacity: 1 }));
    add(L.polyline(base.roads.major.map((r) => ll(r)), { ...common, color: NIGHT.major, weight: 2.6, opacity: NIGHT.majorOpacity }));
    add(L.polyline(base.borders.map((r) => ll(r)), { ...common, color: NIGHT.border, weight: 1.2, opacity: 0.8, dashArray: "5 4" }));
  }

  map.on("moveend zoomend", () => v.labels());

  const v = {
    kind: "leaflet",
    map,
    destroy() {
      cancelAnimationFrame(animFrame);
      try { map.remove(); } catch {}
      host.innerHTML = "";
      host.style.background = "";
    },
    resize() { map.invalidateSize({ animate: false }); },
    zoomBy(d) { map.setZoom(map.getZoom() + d); },
    clear() {
      lastPins = [];
      layer.clearLayers();
    },
    idle() { map.setView([31.7, 35.0], 7, { animate: false }); },
    pins(a, b) {
      lastPins = [a, b];
      for (const [k, p] of [["a", a], ["b", b]]) {
        L.marker(p, { icon: L.divIcon({ className: "", html: pinHtml(k), iconSize: [44, 44], iconAnchor: [22, 22] }), keyboard: false, interactive: false, zIndexOffset: k === "b" ? 10 : 0 }).addTo(layer);
      }
    },
    fit(points, pad, maxZoom, _mode, instant = false) {
      const b = L.latLngBounds(points);
      map.flyToBounds(b, {
        paddingTopLeft: [pad.left, pad.top],
        paddingBottomRight: [pad.right, pad.bottom],
        maxZoom,
        duration: instant || reducedMotion() ? 0 : 1.1,
        easeLinearity: 0.2,
      });
      return new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        map.once("moveend", finish);
        setTimeout(finish, 1500);
      });
    },
    route(pts, color, exact) {
      const glow = L.polyline(pts, { color, weight: 14, opacity: 0.4, className: "route-line route-glow", interactive: false }).addTo(layer);
      const line = L.polyline(pts, { color, weight: 6, opacity: 1, className: "route-line", interactive: false, dashArray: exact ? null : "2 12" }).addTo(layer);
      const paths = [glow.getElement(), line.getElement()].filter(Boolean);
      const lens = paths.map((p) => p.getTotalLength?.() || 0);
      if (exact) paths.forEach((p, i) => { p.style.strokeDasharray = `${lens[i]} ${lens[i]}`; p.style.strokeDashoffset = String(lens[i]); });
      else paths.forEach((p) => (p.style.opacity = "0"));
      return {
        progress(e) {
          if (exact) {
            paths.forEach((p, i) => (p.style.strokeDashoffset = String(lens[i] * (1 - e))));
            if (e >= 1) paths.forEach((p) => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; });
          } else paths.forEach((p) => (p.style.opacity = String(e)));
        },
      };
    },
    vehicle(mode, at) {
      const el = vehicleEl(mode);
      const img = el.querySelector("img");
      const m = L.marker(at, { icon: L.divIcon({ className: "", html: "", iconSize: [46, 46], iconAnchor: [23, 23] }), interactive: false, keyboard: false, zIndexOffset: 50 }).addTo(layer);
      m.getElement()?.append(el);
      return {
        move(p, from, to) {
          m.setLatLng(p);
          const A = map.latLngToContainerPoint(from), B = map.latLngToContainerPoint(to);
          aim(img, mode, B.x - A.x, B.y - A.y);
        },
        remove() { m.remove(); },
      };
    },
    labels() {
      // street tiles carry their own names; only the built-in map needs ours
      if (!offline || !base) return;
      if (!labels) labels = L.layerGroup().addTo(map);
      labels.clearLayers();
      const b = map.getBounds().pad(0.05);
      const list = placeList(base.places);
      const pinPts = lastPins.map((p) => map.latLngToContainerPoint(p));
      const picked = pickLabels(list, (p) => map.latLngToContainerPoint([p[0], p[1]]), map.getZoom(), (p) => b.contains([p[0], p[1]]), pinPts);
      for (const { p, name, big } of picked) {
        L.marker([p[0], p[1]], {
          icon: L.divIcon({ className: "", html: labelHtml(name, big), iconSize: [0, 0] }),
          interactive: false, keyboard: false, pane: "overlayPane",
        }).addTo(labels);
      }
    },
  };
  if (scene) {
    const s = scene;
    setTimeout(() => {
      if (view !== v || !scene) return;
      const [a, b] = tripPoints(s.round);
      v.pins(a, b);
      if (s.route) v.route(s.route.geometry?.length > 1 ? s.route.geometry : arc(a, b), MODE_HEX[s.round.mode] || MODE_HEX.car, !!s.route.geometry?.length).progress(1);
      v.fit([a, b], s.pad, maxZoomFor(s.round.mode), s.round.mode, true);
    }, 0);
  }
  return v;
}
