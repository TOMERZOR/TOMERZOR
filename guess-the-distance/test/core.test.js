import test from "node:test";
import assert from "node:assert/strict";
import { roundScore, verdict, duelMultiplier, DUEL_HP } from "../core/scoring.js";
import { makeRounds, resolveRound, publicRound, tripsFor } from "../core/rounds.js";
import { createResolver } from "../core/router.js";
import { PLACES, TRIPS, MAPS } from "../core/places.js";
import { haversineKm } from "../core/geo.js";
import { Duel } from "../core/duel.js";
import { Hub } from "../core/hub.js";

test("scoring rewards close guesses down to the minute", () => {
  assert.equal(roundScore(60, 60), 5000);
  assert.equal(roundScore(61, 60), 5000);
  assert.ok(roundScore(63, 60) > 4400);
  assert.ok(roundScore(66, 60) > roundScore(75, 60));
  assert.ok(roundScore(120, 60) < 1100);
  assert.equal(roundScore(null, 60), 0);
  assert.equal(roundScore(-3, 60), 0);
  // Ratio-based: 10% off a short and a long trip score about the same.
  assert.ok(Math.abs(roundScore(660, 600) - roundScore(66, 60)) < 400);
  assert.equal(roundScore(3.4, 3.4, "distance"), 5000);
  assert.ok(roundScore(5, 3.4, "distance") < 4000);
  assert.equal(verdict(5000), "perfect");
  assert.equal(verdict(100), "miss");
});

test("duel multiplier grows from round 4", () => {
  assert.equal(duelMultiplier(1), 1);
  assert.equal(duelMultiplier(3), 1);
  assert.equal(duelMultiplier(4), 1.5);
  assert.equal(duelMultiplier(6), 2.5);
  assert.equal(DUEL_HP, 6000);
});

test("data is sane", () => {
  for (const [mode, a, b, km, min] of TRIPS) {
    assert.ok(PLACES[a] && PLACES[b], `${a} ${b}`);
    assert.ok(["car", "foot", "bike", "flight"].includes(mode));
    assert.ok(min > 0);
    const crow = haversineKm(PLACES[a], PLACES[b]);
    if (mode !== "flight") {
      assert.ok(km >= crow * 1.02, `${a}-${b}: road ${km} shorter than crow ${crow.toFixed(1)}`);
      assert.ok(km <= crow * 3.2 + 1, `${a}-${b}: road ${km} too long vs crow ${crow.toFixed(1)}`);
      const speed = km / (min / 60);
      const range = { car: [15, 115], foot: [3, 6.5], bike: [10, 22] }[mode];
      assert.ok(speed >= range[0] && speed <= range[1], `${a}-${b}: ${speed.toFixed(1)} km/h for ${mode}`);
    } else {
      const speed = crow / (min / 60);
      assert.ok(speed > 250 && speed < 950, `${a}-${b}: flight ${speed.toFixed(0)} km/h`);
    }
  }
  for (const map of Object.keys(MAPS)) assert.ok(tripsFor(map).length >= 10, map);
});

test("rounds are deterministic and varied", () => {
  const a = makeRounds({ seed: "x1", map: "israel", count: 5 });
  const b = makeRounds({ seed: "x1", map: "israel", count: 5 });
  assert.deepEqual(a, b);
  const keys = new Set(a.map((r) => `${r.from.en}-${r.to.en}`));
  assert.equal(keys.size, 5);
  const c = makeRounds({ seed: "x2", map: "israel", count: 5 });
  assert.notDeepEqual(a, c);
  const r = makeRounds({ seed: "r", map: "random", count: 5 });
  for (const s of r) assert.ok(s.random && s.fallback && s.fallback.ref);
});

function osrmMock({ fail = false, calls = [] } = {}) {
  return async (url) => {
    calls.push(url);
    if (fail) throw new Error("offline");
    return {
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [{ distance: 64200, duration: 3300, geometry: { coordinates: [[34.78, 32.08], [35.0, 31.9], [35.21, 31.77]] } }],
        waypoints: [{ distance: 12, name: "Dizengoff" }, { distance: 20, name: "Jaffa Road" }],
      }),
    };
  };
}

test("router uses live routes, caches them, and falls back", async () => {
  const calls = [];
  const resolve = createResolver({ fetch: osrmMock({ calls }) });
  const spec = makeRounds({ seed: "s", map: "israel", count: 1 })[0];
  const r1 = await resolve({ ...spec, mode: "car" });
  assert.equal(r1.source, "live");
  assert.equal(r1.min, 55);
  assert.equal(r1.km, 64);
  assert.equal(r1.geometry.length, 3);
  await resolve({ ...spec, mode: "car" });
  assert.equal(calls.length, 1, "second call served from cache");

  const offline = createResolver({ fetch: osrmMock({ fail: true }) });
  const r2 = await offline({ ...spec, mode: "car" });
  assert.equal(r2.source, "reference");
  assert.equal(r2.min, spec.ref.min);

  const flight = await offline({ mode: "flight", from: PLACES.tlv, to: PLACES.nyc, ref: { min: 725 } });
  assert.equal(flight.source, "flight");
  assert.ok(flight.km > 9000 && flight.km < 9300);
  assert.equal(flight.min, 725);

  // A random round with no router falls back to its curated trip.
  const rs = makeRounds({ seed: "q", map: "random", count: 1 })[0];
  const rr = await resolveRound(rs, offline);
  assert.equal(rr.route.source === "reference" || rr.route.source === "flight", true);
  const pub = publicRound(rr, 1);
  assert.equal(pub.route, undefined);
  assert.ok(pub.crowKm > 0);
});

// A clock we can fast-forward.
function fakeClock() {
  let now = 0, seq = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        await new Promise((r) => setImmediate(r));
        let next = null;
        for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
      await new Promise((r) => setImmediate(r));
    },
  };
}

const offlineResolve = createResolver({ fetch: osrmMock({ fail: true }) });

test("a duel runs from the first round to a winner", async () => {
  const clock = fakeClock();
  const inbox = { a: [], b: [] };
  let ended = null;
  const duel = new Duel({
    id: "m1", seed: "duel-seed", map: "israel", measure: "time",
    players: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    resolve: offlineResolve, clock, send: (id, m) => inbox[id].push(m), onEnd: (d) => (ended = d),
  });
  duel.start();
  assert.equal(inbox.a[0].t, "match");
  assert.equal(inbox.a[0].opponent.name, "B");
  await clock.advance(5000);
  let round = inbox.a.findLast((m) => m.t === "round");
  assert.equal(round.n, 1);
  assert.equal(round.round.route, undefined, "no answer before the reveal");
  // A is spot on, B way off: B takes the damage.
  for (let i = 0; i < 20 && duel.phase !== "over"; i++) {
    const actual = duel.answer();
    duel.guess("a", duel.n, actual);
    const opp = inbox.b.findLast((m) => m.t === "oppLocked");
    assert.ok(opp && opp.timeLeft <= 15000);
    duel.guess("b", duel.n, actual * 3);
    const res = inbox.a.findLast((m) => m.t === "result");
    assert.equal(res.scores.you, 5000);
    assert.equal(res.damage.to, "opp");
    await clock.advance(12000);
  }
  assert.equal(duel.phase, "over");
  const endA = inbox.a.findLast((m) => m.t === "end");
  const endB = inbox.b.findLast((m) => m.t === "end");
  assert.equal(endA.result, "win");
  assert.equal(endB.result, "lose");
  assert.equal(endB.hp.you, 0);
  assert.ok(ended);
});

test("an unanswered round times out and scores zero", async () => {
  const clock = fakeClock();
  const inbox = { a: [], b: [] };
  const duel = new Duel({
    id: "m2", seed: "t", map: "world", measure: "distance",
    players: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    resolve: offlineResolve, clock, send: (id, m) => inbox[id].push(m),
  });
  duel.start();
  await clock.advance(5000);
  duel.guess("a", 1, duel.answer());
  await clock.advance(15001);
  const res = inbox.b.findLast((m) => m.t === "result");
  assert.equal(res.guesses.you, null);
  assert.equal(res.scores.you, 0);
  assert.equal(res.hp.you, 1000);
  // Sync after a reconnect during the reveal.
  const snap = duel.snapshot("b");
  assert.equal(snap.phase, "reveal");
  assert.equal(snap.result.scores.you, 0);
  duel.stop();
});

function sock() {
  const s = { got: [], send: (x) => s.got.push(JSON.parse(x)), close() {} };
  s.last = (t) => s.got.findLast((m) => m.t === t);
  return s;
}

test("hub: quick match, private room, bot, reconnect and rematch", async () => {
  const clock = fakeClock();
  const hub = new Hub({ resolve: offlineResolve, clock });
  const sa = sock(), sb = sock();
  const a = hub.connect(sa), b = hub.connect(sb);
  hub.message(a, JSON.stringify({ t: "hello", clientId: "A", name: "Alice", avatar: "🦊" }));
  hub.message(b, JSON.stringify({ t: "hello", clientId: "B", name: "Bob<script>", avatar: "🐻" }));
  assert.equal(sa.last("welcome").id, "A");
  hub.message(a, { t: "queue", map: "israel" });
  assert.equal(sa.last("queued").map, "israel");
  hub.message(b, { t: "queue", map: "israel" });
  assert.equal(sa.last("match").opponent.name, "Bobscript");
  await clock.advance(5000);
  const n = sa.last("round").n;
  hub.message(a, { t: "guess", n, value: 30 });
  assert.ok(sb.last("oppLocked"));

  // B drops and comes back on a new socket.
  hub.disconnect(b);
  assert.ok(sa.last("oppAway"));
  const sb2 = sock();
  const b2 = hub.connect(sb2);
  hub.message(b2, { t: "hello", clientId: "B", name: "Bob", avatar: "🐻" });
  const sync = sb2.last("sync");
  assert.equal(sync.phase, "guessing");
  assert.equal(sync.oppLocked, true);
  hub.message(b2, { t: "guess", n, value: 40 });
  assert.ok(sb2.last("result"));

  // A leaves: B wins by forfeit.
  hub.message(a, { t: "leave" });
  assert.equal(sb2.last("end").result, "win");
  assert.equal(sb2.last("end").reason, "forfeit");

  // Private room.
  hub.message(a, { t: "room:create", map: "world", measure: "distance" });
  const code = sa.last("room").code;
  assert.match(code, /^[A-Z]{4}$/);
  hub.message(b2, { t: "room:join", code: "zzzz" });
  assert.equal(sb2.last("error").code, "room-not-found");
  hub.message(b2, { t: "room:join", code: code.toLowerCase() });
  const m = sb2.last("match");
  assert.equal(m.map, "world");
  assert.equal(m.measure, "distance");
  hub.message(a, { t: "leave" });

  // Bot match, played to the end, then a rematch.
  const sc = sock();
  const c = hub.connect(sc);
  hub.message(c, { t: "hello", clientId: "C", name: "Cee" });
  hub.message(c, { t: "bot", map: "israel", level: "hard" });
  assert.equal(sc.last("match").opponent.bot, true);
  for (let i = 0; i < 40 && !sc.last("end"); i++) {
    await clock.advance(4000);
    const r = sc.last("round");
    const duel = hub.duelOf("C");
    if (r && duel.phase === "guessing" && !duel.guesses.C) hub.message(c, { t: "guess", n: r.n, value: duel.answer() });
    await clock.advance(30000);
  }
  assert.ok(sc.last("end"), "bot match finished");
  hub.message(c, { t: "rematch" });
  assert.equal(sc.got.filter((x) => x.t === "match").length, 2);
  hub.message(c, { t: "leave" });
  assert.deepEqual(hub.stats().duels, 0);
});
