// Real routes from OpenStreetMap routers (OSRM), with a cache and fallbacks:
//   1. the FOSSGIS OSRM servers (car, bike and foot profiles),
//   2. the OSRM demo server (car),
//   3. the curated reference numbers that come with every listed trip.
// Flights are great-circle paths with scheduled block times.

import { greatCircle, haversineKm, flightMinutes, thin } from "./geo.js";

export const DEFAULT_ENDPOINTS = {
  car: ["https://routing.openstreetmap.de/routed-car", "https://router.project-osrm.org"],
  bike: ["https://routing.openstreetmap.de/routed-bike"],
  foot: ["https://routing.openstreetmap.de/routed-foot"],
};

const roundKm = (km) => (km < 20 ? Math.round(km * 10) / 10 : Math.round(km));

export function routeKey(spec) {
  const p = (x) => `${x.lat.toFixed(4)},${x.lon.toFixed(4)}`;
  return `${spec.mode}:${p(spec.from)}:${p(spec.to)}`;
}

export function createResolver({
  fetch: fetchFn = globalThis.fetch?.bind(globalThis),
  cache = new Map(),
  endpoints = DEFAULT_ENDPOINTS,
  timeoutMs = 7000,
  live = true,
} = {}) {
  let liveDownUntil = 0;
  // The public routers ask for gentle use: at most a few requests at a time.
  let running = 0;
  const waiting = [];
  const slot = () => (running < 3 ? (running++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
  const release = () => (waiting.length ? waiting.shift()() : running--);

  async function osrm(spec) {
    if (!live || !fetchFn || Date.now() < liveDownUntil) return null;
    const { from, to } = spec;
    const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    let failures = 0;
    const bases = endpoints[spec.mode] || [];
    for (const base of bases) {
      const url = `${base}/route/v1/driving/${coords}?overview=simplified&geometries=geojson&alternatives=false&steps=false`;
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      try {
        const res = await fetchFn(url, { signal: ctrl?.signal, headers: { Accept: "application/json" } });
        if (!res.ok) { failures++; continue; }
        const data = await res.json();
        const r = data?.routes?.[0];
        if (data?.code !== "Ok" || !r || !(r.distance > 0)) continue;
        // A random spot more than 3 km from any road is not a fair question.
        const wp = data.waypoints || [];
        if (spec.random && wp.some((w) => w.distance > 3000)) return null;
        if (spec.random && r.duration < 180) return null;
        const geometry = thin((r.geometry?.coordinates || []).map(([lon, lat]) => [+lat.toFixed(5), +lon.toFixed(5)]));
        return {
          km: roundKm(r.distance / 1000),
          min: Math.max(1, Math.round(r.duration / 60)),
          geometry,
          source: "live",
          fromName: wp[0]?.name || undefined,
          toName: wp[1]?.name || undefined,
        };
      } catch {
        failures++;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    // Every server failed outright: stop asking for a minute so the game stays quick.
    if (bases.length && failures === bases.length) liveDownUntil = Date.now() + 60_000;
    return null;
  }

  return async function resolve(spec) {
    if (spec.mode === "flight") {
      const km = Math.round(haversineKm(spec.from, spec.to));
      return { km, min: spec.ref?.min ?? flightMinutes(km), geometry: greatCircle(spec.from, spec.to), source: "flight" };
    }
    const key = routeKey(spec);
    const hit = await cache.get(key);
    if (hit) return hit;
    await slot();
    let route;
    try {
      route = await osrm(spec);
    } finally {
      release();
    }
    if (route) {
      await cache.set(key, route);
      return route;
    }
    if (spec.ref?.min) {
      const km = spec.ref.km ?? roundKm(haversineKm(spec.from, spec.to) * 1.25);
      return { km, min: spec.ref.min, geometry: null, source: "reference" };
    }
    return null;
  };
}
