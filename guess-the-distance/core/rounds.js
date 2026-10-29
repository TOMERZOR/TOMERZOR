// Turns a seed and a map into rounds. The same seed always gives the same
// rounds, which is what makes the Daily Challenge, challenge links and duels fair.

import { PLACES, TRIPS, tripMaps } from "./places.js";
import { rngFrom, pick, shuffle } from "./rng.js";
import { haversineKm, offset } from "./geo.js";

const place = (id) => ({ id, ...PLACES[id] });

function tripSpec(trip, rand) {
  const [mode, a, b, km, min] = trip;
  const flip = mode !== "flight" && rand() < 0.5;
  const [from, to] = flip ? [b, a] : [a, b];
  return { mode, from: place(from), to: place(to), ref: { km: km || null, min } };
}

export function tripsFor(map) {
  if (map === "random" || map === "mixed") return TRIPS;
  return TRIPS.filter((t) => tripMaps(t).includes(map));
}

const CITY_IDS = Object.keys(PLACES).filter((id) => !PLACES[id].city);
const LANDMARK_CITIES = [...new Set(Object.values(PLACES).filter((p) => p.city).map((p) => p.city))];

// A random trip between two spots near real towns. It needs the live router
// (the spots are made up on the spot), so it carries a curated trip to fall
// back on.
function randomSpec(rand) {
  const roll = rand();
  if (roll < 0.2) {
    // A walk between two random spots in a city.
    const cityId = pick(rand, LANDMARK_CITIES);
    const c = PLACES[cityId];
    const a = offset(c, 0.2 + rand() * 1.2, rand() * 360);
    let b = offset(c, 0.6 + rand() * 1.8, rand() * 360);
    for (let k = 0; k < 6 && haversineKm(a, b) < 0.9; k++) b = offset(c, 0.8 + rand() * 1.8, rand() * 360);
    return {
      mode: "foot", random: true,
      from: { he: `ליד ${c.he}`, en: `Near ${c.en}`, ...a, near: true, around: cityId },
      to: { he: `ליד ${c.he}`, en: `Near ${c.en}`, ...b, near: true, around: cityId },
      ref: null,
    };
  }
  const region = roll < 0.55 ? "il" : roll < 0.8 ? "eu" : "na";
  const ids = CITY_IDS.filter((id) => PLACES[id].r === region);
  const aId = pick(rand, ids);
  const maxKm = region === "il" ? 400 : 700;
  const near = ids.filter((id) => id !== aId && haversineKm(PLACES[aId], PLACES[id]) <= maxKm);
  const bId = pick(rand, near.length ? near : ids.filter((id) => id !== aId));
  const A = PLACES[aId], B = PLACES[bId];
  const spread = region === "il" ? 6 : 15;
  return {
    mode: "car", random: true,
    from: { he: `ליד ${A.he}`, en: `Near ${A.en}`, ...offset(A, 1 + rand() * spread, rand() * 360), near: true, around: aId },
    to: { he: `ליד ${B.he}`, en: `Near ${B.en}`, ...offset(B, 1 + rand() * spread, rand() * 360), near: true, around: bId },
    ref: null,
  };
}

export function makeRounds({ seed, map = "israel", count = 5 }) {
  const rand = rngFrom(`${seed}|${map}`);
  const pool = tripsFor(map);
  const out = [];
  let deck = [];
  for (let i = 0; i < count; i++) {
    if (!deck.length) deck = shuffle(rand, pool);
    const curated = tripSpec(deck.pop(), rand);
    if (map === "random") {
      const spec = randomSpec(rand);
      spec.fallback = curated;
      out.push(spec);
    } else {
      out.push(curated);
    }
  }
  return out;
}

// Resolve a spec into a playable round with its real route. Falls back to
// the curated trip when the router can't serve a random one.
export async function resolveRound(spec, resolve) {
  let route = null;
  try { route = await resolve(spec); } catch { route = null; }
  if (route) return { ...stripSpec(spec), route };
  if (spec.fallback) return resolveRound(spec.fallback, resolve);
  throw new Error("No route for this round");
}

function stripSpec({ fallback, ...rest }) {
  return rest;
}

// What a player sees before guessing: no answer in it.
export function publicRound(round, n) {
  return {
    n,
    mode: round.mode,
    from: pubPlace(round.from, round.route?.fromName),
    to: pubPlace(round.to, round.route?.toName),
    crowKm: Math.round(haversineKm(round.from, round.to) * 10) / 10,
  };
}

function pubPlace(p, street) {
  const out = { he: p.he, en: p.en, lat: p.lat, lon: p.lon };
  if (p.id) out.id = p.id;
  if (p.near) out.near = true;
  if (street) out.street = street;
  return out;
}
