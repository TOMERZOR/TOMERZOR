// The map behind every round: two pins, then the real route drawing itself
// with a little vehicle riding along it. A real street map from the first
// tile service that answers (CARTO, then OpenStreetMap, then Esri). If none
// can load, the game draws its own map from Natural Earth data: land, lakes,
// borders, roads and cities with Hebrew names.

import { getLang } from "./i18n.js";
import { MODE_EMOJI } from "./icons.js";
import { reducedMotion } from "./ui.js";
import { PLACES } from "../core/places.js";

const L = window.L;
const MODE_COLOR = { car: "#0a84ff", foot: "#30c35a", bike: "#ff9500", flight: "#af52de" };
const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const PROVIDERS = [
  {
    url: (d) => d ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    opts: { subdomains: "abcd", maxZoom: 19, attribution: `${OSM} · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>` },
  },
  {
    url: () => "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    opts: { maxZoom: 19, attribution: OSM, className: "tiles-invert-dark" },
  },
  {
    url: () => "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    opts: { maxZoom: 19, attribution: "Tiles © Esri", className: "tiles-invert-dark" },
  },
];

let map = null;
let tiles = null;
let provider = 0;
let layer = null;
let offline = false;
let animFrame = 0;

const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;

// Called once at startup: find the first tile service that answers, so the
// first round already has its map. If none does, start loading the built-in map.
let probe = null;
let basePromise = null;
export function prepareMap() {
  if (probe) return probe;
  const tryTile = (i) => new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), 5000);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = PROVIDERS[i].url(false).replace("{s}", "a").replace("{z}", "5").replace("{x}", "19").replace("{y}", "13").replace("{r}", "");
  });
  probe = (async () => {
    const ok = await Promise.all(PROVIDERS.map((_, i) => tryTile(i)));
    const first = ok.indexOf(true);
    if (first >= 0) {
      if (!tiles) provider = first;
      return true;
    }
    loadBase();
    if (map && !offline) goOffline();
    else if (!map) offline = "pending";
    return false;
  })();
  return probe;
}

function loadBase() {
  if (!basePromise) {
    basePromise = fetch(new URL("../vendor/basemap.json", import.meta.url)).then((r) => r.json()).catch(() => null);
  }
  return basePromise;
}

export function initMap(el) {
  if (map || !L) return map;
  map = L.map(el, {
    zoomControl: false,
    attributionControl: true,
    worldCopyJump: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 90,
    fadeAnimation: true,
    preferCanvas: false,
  }).setView([31.6, 35], 7);
  map.attributionControl.setPrefix(false);
  if (offline === "pending") {
    offline = false;
    goOffline();
  } else setTiles();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => (offline ? restyleBasemap() : setTiles()));
  layer = L.layerGroup().addTo(map);
  return map;
}

function setTiles() {
  if (!map || offline) return;
  if (tiles) tiles.remove();
  const P = PROVIDERS[provider];
  let ok = 0, err = 0;
  tiles = L.tileLayer(P.url(dark()), { detectRetina: false, ...P.opts });
  tiles.on("tileload", () => ok++);
  tiles.on("tileerror", () => {
    err++;
    // This service isn't answering here: try the next one.
    if (err >= 4 && ok === 0) {
      if (provider < PROVIDERS.length - 1) {
        provider++;
        setTiles();
      } else goOffline();
    }
  });
  tiles.addTo(map);
}

// ---------- the built-in map ----------
let base = null;
let baseLayers = [];
let labels = null;

const STYLE = {
  light: { water: "#a9d3f2", land: "#f4f1ea", lake: "#a9d3f2", border: "#a39aa8", major: "#f6c95d", majorCase: "#d9a63a", minor: "#ffffff", minorCase: "#d6d1c8" },
  dark: { water: "#16263a", land: "#2a2c30", lake: "#16263a", border: "#6c6772", major: "#8a6d2c", majorCase: "#5c4a1f", minor: "#4a4d53", minorCase: "#3a3c41" },
};

async function goOffline() {
  if (offline) return;
  offline = true;
  if (tiles) tiles.remove();
  map.attributionControl.addAttribution('Map data: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>');
  base = await loadBase();
  if (!base) return; /* the plain background still works */
  restyleBasemap();
  map.on("moveend zoomend", placeLabels);
  placeLabels();
}

function restyleBasemap() {
  if (!base) return;
  baseLayers.forEach((l) => l.remove());
  baseLayers = [];
  const c = STYLE[dark() ? "dark" : "light"];
  map.getContainer().style.background = c.water;
  const renderer = L.canvas({ padding: 0.4 });
  const pane = map.getPane("basemap") || map.createPane("basemap");
  pane.style.zIndex = 150;
  const ll = (r, shift = 0) => r.map(([lon, lat]) => [lat, lon + shift]);
  const add = (l) => baseLayers.push(l.addTo(map));
  const common = { renderer, pane: "basemap", interactive: false, smoothFactor: 1.2 };
  for (const shift of [0, -360, 360]) {
    add(L.polygon(base.land.map((r) => [ll(r, shift)]), { ...common, stroke: false, fillColor: c.land, fillOpacity: 1 }));
  }
  add(L.polygon(base.lakes.map((r) => [ll(r)]), { ...common, stroke: false, fillColor: c.lake, fillOpacity: 1 }));
  add(L.polyline(base.roads.minor.map((r) => ll(r)), { ...common, color: c.minorCase, weight: 3.2, opacity: 0.9 }));
  add(L.polyline(base.roads.minor.map((r) => ll(r)), { ...common, color: c.minor, weight: 1.8, opacity: 1 }));
  add(L.polyline(base.roads.major.map((r) => ll(r)), { ...common, color: c.majorCase, weight: 4.4, opacity: 0.9 }));
  add(L.polyline(base.roads.major.map((r) => ll(r)), { ...common, color: c.major, weight: 2.8, opacity: 1 }));
  add(L.polyline(base.borders.map((r) => ll(r)), { ...common, color: c.border, weight: 1.2, opacity: 0.8, dashArray: "5 4" }));
  if (labels) placeLabels();
}

// City names, biggest first, without overlaps. Our own places (with their
// Hebrew names) win over Natural Earth's where both exist.
let allPlaces = null;
let pins = [];
function placeLabels() {
  if (!base || !map) return;
  if (!labels) labels = L.layerGroup().addTo(map);
  labels.clearLayers();
  const near = (a, c) => Math.abs(a[0] - c[0]) < 0.05 && Math.abs(a[1] - c[1]) < 0.06;
  if (!allPlaces) {
    const own = Object.values(PLACES).filter((p) => !p.city).map((p) => [p.lat, p.lon, p.en, p.he, p.r === "il" ? 5 : 3]);
    allPlaces = [...own, ...base.places.filter((p) => !own.some((o) => near(o, p)))].sort((a, c) => a[4] - c[4]);
  }
  const z = map.getZoom();
  const b = map.getBounds().pad(0.05);
  const he = getLang() === "he";
  // keep names out from under the round's pins
  const taken = pins.map((ll) => {
    const pt = map.latLngToContainerPoint(ll);
    return [pt.x - 26, pt.y - 50, pt.x + 26, pt.y + 6];
  });
  let count = 0;
  for (const p of allPlaces) {
    if (p[4] > z - 1.5) break;
    if (count >= 70) break;
    if (!b.contains([p[0], p[1]])) continue;
    const name = (he && p[3]) || p[2];
    if (!name) continue;
    const pt = map.latLngToContainerPoint([p[0], p[1]]);
    const w = name.length * 7 + 12, h = 18;
    const box = [pt.x - w / 2, pt.y - h - 4, pt.x + w / 2, pt.y + 4];
    if (taken.some((t) => !(box[2] < t[0] || box[0] > t[2] || box[3] < t[1] || box[1] > t[3]))) continue;
    taken.push(box);
    count++;
    L.marker([p[0], p[1]], {
      icon: L.divIcon({ className: "", html: `<div class="map-label ${p[4] <= 2 ? "big" : ""}"><i></i><span>${name.replace(/[<>&]/g, "")}</span></div>`, iconSize: [0, 0] }),
      interactive: false, keyboard: false, pane: "overlayPane",
    }).addTo(labels);
  }
}

export function invalidate() {
  map?.invalidateSize({ animate: false });
}

function pinIcon(kind) {
  const he = getLang() === "he";
  const label = kind === "a" ? (he ? "א" : "A") : he ? "ב" : "B";
  const c = kind === "a" ? "#0a84ff" : "#ff3b30";
  return L.divIcon({
    className: "",
    html: `<div class="pin ${kind === "b" ? "b2" : ""}"><div class="b" style="--c:${c}"></div><div class="l">${label}</div></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 42],
  });
}

export function clear() {
  pins = [];
  cancelAnimationFrame(animFrame);
  layer?.clearLayers();
}

let lastPad = null;
function fit(latlngs, pad, maxZoom) {
  lastPad = pad;
  const b = L.latLngBounds(latlngs);
  map.flyToBounds(b, {
    paddingTopLeft: [pad.left, pad.top],
    paddingBottomRight: [pad.right, pad.bottom],
    maxZoom,
    duration: reducedMotion() ? 0 : 1.1,
    easeLinearity: 0.2,
  });
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    map.once("moveend", finish);
    setTimeout(finish, 1500);
  });
}

const maxZoomFor = (mode) => (mode === "foot" || mode === "bike" ? 16 : mode === "flight" ? 6 : 12);

// Show the two places of a round.
export async function showTrip(round, pad) {
  if (!map) return;
  clear();
  invalidate();
  const a = [round.from.lat, round.from.lon];
  let b = [round.to.lat, round.to.lon];
  if (round.mode === "flight") {
    // take the short way around the globe
    while (b[1] - a[1] > 180) b = [b[0], b[1] - 360];
    while (b[1] - a[1] < -180) b = [b[0], b[1] + 360];
  }
  pins = [a, b];
  L.marker(a, { icon: pinIcon("a"), keyboard: false, interactive: false }).addTo(layer);
  L.marker(b, { icon: pinIcon("b"), keyboard: false, interactive: false, zIndexOffset: 10 }).addTo(layer);
  await fit([a, b], pad, maxZoomFor(round.mode));
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

// Draw the real route. Resolves when the line has finished drawing.
export async function drawRoute(round, route, pad, ms = 2200) {
  if (!map) return;
  const a = [round.from.lat, round.from.lon];
  const b = [round.to.lat, round.to.lon];
  const pts = route.geometry?.length > 1 ? route.geometry : arc(a, b);
  const color = MODE_COLOR[round.mode] || MODE_COLOR.car;
  const exact = !!route.geometry?.length;
  await fit(pts, pad || lastPad, maxZoomFor(round.mode) + 1);
  const glow = L.polyline(pts, { color, weight: 12, opacity: 0.22, className: "route-line route-glow", interactive: false }).addTo(layer);
  const line = L.polyline(pts, { color, weight: 5.5, opacity: 1, className: "route-line", interactive: false, dashArray: exact ? null : "2 10" }).addTo(layer);
  if (reducedMotion()) return;
  const paths = [glow.getElement(), line.getElement()].filter(Boolean);
  // Distances along the path, for the vehicle.
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + map.distance(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1] || 1;
  const veh = L.marker(pts[0], {
    icon: L.divIcon({ className: "", html: `<div class="vehicle">${MODE_EMOJI[round.mode] || "🚗"}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] }),
    interactive: false, keyboard: false, zIndexOffset: 50,
  }).addTo(layer);
  const lens = paths.map((p) => p.getTotalLength());
  paths.forEach((p, i) => {
    p.style.strokeDasharray = exact ? `${lens[i]} ${lens[i]}` : p.style.strokeDasharray;
    if (exact) p.style.strokeDashoffset = String(lens[i]);
  });
  if (!exact) paths.forEach((p) => (p.style.opacity = "0"));
  return new Promise((resolve) => {
    const t0 = performance.now();
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = easeInOut(p);
      if (exact) paths.forEach((path, i) => (path.style.strokeDashoffset = String(lens[i] * (1 - e))));
      else paths.forEach((path) => (path.style.opacity = String(e)));
      const d = e * total;
      let k = 1;
      while (k < cum.length - 1 && cum[k] < d) k++;
      const seg = cum[k] - cum[k - 1] || 1;
      const f = Math.max(0, Math.min(1, (d - cum[k - 1]) / seg));
      veh.setLatLng([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f]);
      if (p < 1) animFrame = requestAnimationFrame(frame);
      else {
        if (exact) paths.forEach((path) => { path.style.strokeDasharray = ""; path.style.strokeDashoffset = ""; });
        setTimeout(() => veh.remove(), 600);
        resolve();
      }
    };
    animFrame = requestAnimationFrame(frame);
  });
}

// Pan away from everything for menus: a slow drift over Israel.
export function idle() {
  if (!map) return;
  clear();
  map.setView([31.7, 35.0], 7, { animate: false });
}
