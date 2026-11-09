// The multiplayer hub: connections, quick matchmaking, private rooms, bots,
// rematches and reconnects. It knows nothing about the transport: the
// Cloudflare Durable Object, the Node dev server and the in-page offline
// mode all hand it sockets with a send(string) method.

import { Duel } from "./duel.js";
import { MAPS } from "./places.js";
import { randomSeed } from "./rng.js";

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const GRACE_MS = 25_000;
const ROOM_TTL_MS = 30 * 60_000;
const REMATCH_MS = 90_000;

const BOT_NAMES = [
  ["Nova", "🦊"], ["Atlas", "🐻"], ["Pixel", "🐼"], ["Waze-ish", "🐙"], ["Kilometer", "🦉"],
  ["Ziggy", "🐯"], ["Roadie", "🐨"], ["Miles", "🦁"], ["Compass", "🐸"], ["Turbo", "🐵"],
];
const BOT_SKILL = { easy: 0.55, normal: 0.32, hard: 0.16 };

const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
};

function clean(str, max) {
  return String(str ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
}

export class Hub {
  constructor({ resolve, clock = realClock, random = Math.random, timing, log = () => {} } = {}) {
    this.resolve = resolve;
    this.clock = clock;
    this.random = random;
    this.timing = timing;
    this.log = log;
    this.conns = new Set();
    this.byClient = new Map(); // clientId -> conn
    this.queue = []; // { conn, key }
    this.rooms = new Map(); // code -> { host, map, measure, at }
    this.duels = new Map(); // matchId -> duel
    this.playing = new Map(); // clientId -> matchId
    this.grace = new Map(); // clientId -> timer
    this.rematch = new Map(); // matchId -> { want: Set, timer }
    this.nextId = 1;
  }

  online() {
    return this.byClient.size;
  }

  connect(socket) {
    const conn = { id: this.nextId++, socket, player: null };
    this.conns.add(conn);
    return conn;
  }

  out(conn, msg) {
    try {
      conn?.socket.send(JSON.stringify(msg));
    } catch {
      /* the socket is closing */
    }
  }

  sendTo(clientId, msg) {
    const conn = this.byClient.get(clientId);
    if (conn) this.out(conn, msg);
  }

  message(conn, raw) {
    let m;
    try {
      m = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return;
    }
    if (!m || typeof m.t !== "string") return;
    if (m.t === "ping") return this.out(conn, { t: "pong", at: m.at, online: this.online() });
    if (m.t === "hello") return this.hello(conn, m);
    if (!conn.player) return this.out(conn, { t: "error", code: "hello-first" });
    const id = conn.player.id;
    switch (m.t) {
      case "queue": return this.enqueue(conn, m);
      case "cancel": return this.cancel(conn);
      case "room:create": return this.createRoom(conn, m);
      case "room:join": return this.joinRoom(conn, m);
      case "bot": return this.playBot(conn, m);
      case "guess": return this.duelOf(id)?.guess(id, m.n, m.value);
      case "ready": return this.duelOf(id)?.markReady(id, m.n);
      case "rematch": return this.askRematch(conn);
      case "leave": return this.leave(conn);
      default: return this.out(conn, { t: "error", code: "unknown" });
    }
  }

  hello(conn, m) {
    const clientId = clean(m.clientId, 40) || `c${this.nextId++}`;
    const player = { id: clientId, name: clean(m.name, 18) || "Player", avatar: clean(m.avatar, 8) || "🙂" };
    const prev = this.byClient.get(clientId);
    if (prev && prev !== conn) {
      prev.replaced = true;
      this.dropFromLobby(prev);
      try { prev.socket.close?.(4000, "replaced"); } catch {}
    }
    conn.player = player;
    this.byClient.set(clientId, conn);
    this.out(conn, { t: "welcome", id: clientId, online: this.online() });
    // Back in a match after a dropped connection?
    const g = this.grace.get(clientId);
    if (g) {
      this.clock.clearTimeout(g);
      this.grace.delete(clientId);
    }
    const duel = this.duelOf(clientId);
    if (duel && duel.phase !== "over") {
      this.out(conn, duel.snapshot(clientId));
      const opp = duel.other(clientId);
      if (!opp.bot) this.sendTo(opp.id, { t: "oppBack" });
    }
  }

  duelOf(clientId) {
    const id = this.playing.get(clientId);
    return id ? this.duels.get(id) : null;
  }

  busy(conn) {
    const d = this.duelOf(conn.player.id);
    return d && d.phase !== "over";
  }

  normalize(m) {
    return {
      map: MAPS[m.map] ? m.map : "israel",
      measure: m.measure === "distance" ? "distance" : "time",
    };
  }

  enqueue(conn, m) {
    if (this.busy(conn)) return this.out(conn, { t: "error", code: "in-match" });
    this.dropFromLobby(conn);
    const { map, measure } = this.normalize(m);
    const key = `${map}|${measure}`;
    const i = this.queue.findIndex((q) => q.key === key && q.conn !== conn && this.byClient.get(q.conn.player.id) === q.conn);
    if (i >= 0) {
      const [other] = this.queue.splice(i, 1);
      return this.startDuel([other.conn.player, conn.player], map, measure);
    }
    this.queue.push({ conn, key, at: this.clock.now() });
    this.out(conn, { t: "queued", map, measure, online: this.online() });
  }

  cancel(conn) {
    this.dropFromLobby(conn);
    this.out(conn, { t: "cancelled" });
  }

  dropFromLobby(conn) {
    this.queue = this.queue.filter((q) => q.conn !== conn);
    for (const [code, room] of this.rooms) if (room.host === conn) this.rooms.delete(code);
  }

  newCode() {
    for (;;) {
      let code = "";
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(this.random() * CODE_LETTERS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  createRoom(conn, m) {
    if (this.busy(conn)) return this.out(conn, { t: "error", code: "in-match" });
    this.dropFromLobby(conn);
    this.sweepRooms();
    const { map, measure } = this.normalize(m);
    const code = this.newCode();
    this.rooms.set(code, { host: conn, map, measure, at: this.clock.now() });
    this.out(conn, { t: "room", code, map, measure });
  }

  joinRoom(conn, m) {
    if (this.busy(conn)) return this.out(conn, { t: "error", code: "in-match" });
    const code = clean(m.code, 8).toUpperCase();
    const room = this.rooms.get(code);
    if (!room || this.byClient.get(room.host.player.id) !== room.host) {
      return this.out(conn, { t: "error", code: "room-not-found" });
    }
    if (room.host === conn || room.host.player.id === conn.player.id) {
      return this.out(conn, { t: "error", code: "own-room" });
    }
    this.rooms.delete(code);
    this.dropFromLobby(conn);
    this.startDuel([room.host.player, conn.player], room.map, room.measure);
  }

  sweepRooms() {
    const now = this.clock.now();
    for (const [code, room] of this.rooms) if (now - room.at > ROOM_TTL_MS) this.rooms.delete(code);
  }

  playBot(conn, m) {
    if (this.busy(conn)) return this.out(conn, { t: "error", code: "in-match" });
    this.dropFromLobby(conn);
    const { map, measure } = this.normalize(m);
    const [name, avatar] = BOT_NAMES[Math.floor(this.random() * BOT_NAMES.length)];
    const level = BOT_SKILL[m.level] ? m.level : "normal";
    const bot = { id: `bot-${this.nextId++}`, name, avatar, bot: true, level };
    this.startDuel([conn.player, bot], map, measure);
  }

  startDuel(players, map, measure, seed = randomSeed()) {
    const matchId = `m${this.nextId++}-${seed}`;
    const bots = players.filter((p) => p.bot);
    const duel = new Duel({
      id: matchId,
      players,
      map,
      measure,
      seed,
      resolve: this.resolve,
      clock: this.clock,
      timing: this.timing,
      send: (id, msg) => {
        const bot = bots.find((b) => b.id === id);
        if (bot) return this.botHears(duel, bot, msg);
        this.sendTo(id, msg);
      },
      onEnd: (d) => this.ended(d),
    });
    this.duels.set(matchId, duel);
    for (const p of players) if (!p.bot) this.playing.set(p.id, matchId);
    this.log(`duel ${matchId} ${players.map((p) => p.name).join(" vs ")} on ${map}`);
    duel.start();
    return duel;
  }

  // The bot guesses like a decent player: close, with some noise, after a
  // human-looking pause. It waits for you a bit longer once you've locked in.
  botHears(duel, bot, msg) {
    if (msg.t === "round") {
      const n = msg.n;
      const delay = 6000 + this.random() * 14000;
      this.clock.setTimeout(() => {
        if (duel.phase !== "guessing" || duel.n !== n) return;
        const actual = duel.answer();
        const sigma = BOT_SKILL[bot.level] ?? 0.32;
        const g = gauss(this.random) * sigma;
        let value = actual * Math.exp(g);
        value = duel.measure === "time" ? Math.max(1, Math.round(value / 5) * 5 || Math.round(value)) : Math.round(value * 10) / 10;
        duel.guess(bot.id, n, value);
      }, delay);
    }
  }

  ended(duel) {
    const humans = duel.players.filter((p) => !p.bot);
    // Keep the pair around for a rematch for a while.
    const timer = this.clock.setTimeout(() => this.closeDuel(duel.id), REMATCH_MS);
    this.rematch.set(duel.id, { want: new Set(), timer });
    for (const p of humans) {
      const g = this.grace.get(p.id);
      if (g) {
        this.clock.clearTimeout(g);
        this.grace.delete(p.id);
      }
    }
  }

  closeDuel(matchId) {
    const duel = this.duels.get(matchId);
    if (!duel) return;
    const r = this.rematch.get(matchId);
    if (r) this.clock.clearTimeout(r.timer);
    this.rematch.delete(matchId);
    this.duels.delete(matchId);
    for (const p of duel.players) if (this.playing.get(p.id) === matchId) this.playing.delete(p.id);
  }

  askRematch(conn) {
    const id = conn.player.id;
    const duel = this.duelOf(id);
    if (!duel || duel.phase !== "over") return this.out(conn, { t: "error", code: "no-rematch" });
    const r = this.rematch.get(duel.id);
    if (!r) return this.out(conn, { t: "error", code: "no-rematch" });
    r.want.add(id);
    const opp = duel.other(id);
    if (opp.bot) r.want.add(opp.id);
    if (r.want.size === 2) {
      this.closeDuel(duel.id);
      const opponent = opp.bot ? { ...opp } : this.byClient.get(opp.id)?.player;
      if (!opponent) return this.out(conn, { t: "error", code: "opponent-gone" });
      this.startDuel([conn.player, opponent], duel.map, duel.measure);
    } else {
      this.out(conn, { t: "rematchWaiting" });
      this.sendTo(opp.id, { t: "rematchAsked" });
    }
  }

  leave(conn) {
    const id = conn.player.id;
    this.dropFromLobby(conn);
    const duel = this.duelOf(id);
    if (!duel) return;
    if (duel.phase !== "over") duel.forfeit(id);
    const opp = duel.other(id);
    if (!opp.bot) this.sendTo(opp.id, { t: "oppLeft" });
    this.closeDuel(duel.id);
  }

  disconnect(conn) {
    this.conns.delete(conn);
    if (!conn.player) return;
    const id = conn.player.id;
    this.dropFromLobby(conn);
    if (conn.replaced || this.byClient.get(id) !== conn) return;
    this.byClient.delete(id);
    const duel = this.duelOf(id);
    if (!duel) return;
    if (duel.phase === "over") {
      const opp = duel.other(id);
      if (!opp.bot) this.sendTo(opp.id, { t: "oppLeft" });
      this.closeDuel(duel.id);
      return;
    }
    const opp = duel.other(id);
    if (!opp.bot) this.sendTo(opp.id, { t: "oppAway", graceMs: GRACE_MS });
    const timer = this.clock.setTimeout(() => {
      this.grace.delete(id);
      if (duel.phase !== "over") duel.forfeit(id);
    }, GRACE_MS);
    this.grace.set(id, timer);
  }

  stats() {
    return { online: this.online(), queued: this.queue.length, rooms: this.rooms.size, duels: this.duels.size };
  }
}

function gauss(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
