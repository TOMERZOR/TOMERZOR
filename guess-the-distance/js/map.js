// The map behind every round: two pins, then the real route drawing itself
// with a little vehicle riding along it. Uses Leaflet with CARTO's tiles,
// and falls back to a built-in coastline map when tiles can't load.

import { getLang } from "./i18n.js";
import { MODE_EMOJI } from "./icons.js";
import { reducedMotion } from "./ui.js";

const L = window.L;
const MODE_COLOR = { car: "#0a84ff", foot: "#30c35a", bike: "#ff9500", flight: "#af52de" };

let map = null;
let tiles = null;
let layer = null;
let offline = false;
let tileOk = 0, tileErr = 0;
let animFrame = 0;

const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;

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
  setTiles();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", setTiles);
  layer = L.layerGroup().addTo(map);
  return map;
}

function setTiles() {
  if (!map) return;
  if (tiles) tiles.remove();
  if (offline) return;
  const url = dark()
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  tiles = L.tileLayer(url, {
    subdomains: "abcd",
    maxZoom: 19,
    detectRetina: false,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  });
  tiles.on("tileload", () => tileOk++);
  tiles.on("tileerror", () => {
    tileErr++;
    if (tileErr >= 4 && tileOk === 0) goOffline();
  });
  tiles.addTo(map);
}

// No tiles (offline, blocked network): draw the coastlines we ship.
async function goOffline() {
  if (offline) return;
  offline = true;
  if (tiles) tiles.remove();
  try {
    const res = await fetch(new URL("../vendor/land.json", import.meta.url));
    const rings = await res.json();
    const css = getComputedStyle(document.documentElement);
    const renderer = L.canvas({ padding: 0.5 });
    const style = {
      renderer,
      color: dark() ? "rgba(140,150,170,.35)" : "rgba(120,130,150,.35)",
      weight: 1,
      fillColor: css.getPropertyValue("--land").trim() || "#f7f7f5",
      fillOpacity: 1,
      interactive: false,
    };
    for (const shift of [0, -360, 360]) {
      const polys = rings.map((r) => [r.map(([lon, lat]) => [lat, lon + shift])]);
      L.polygon(polys, style).addTo(map).bringToBack();
    }
  } catch {
    /* the plain background still works */
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
