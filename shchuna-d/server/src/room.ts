/**
 * שכונה ד׳ — online room.
 *
 * A relay, not a referee: every client simulates its own player, the room forwards
 * snapshots and events between the people in it and keeps one small shared document
 * (the crew's heist plan). The first person in is the host; if they leave, the next
 * oldest connection takes over.
 *
 * Wire format, JSON text frames:
 *   client → room   {t:"join", id, name}        once, first
 *                   {t:"s", ...}                 player snapshot, forwarded to the others
 *                   {t:"e", ...}                 event, forwarded to the others
 *                   {t:"plan", patch}            host only: merge into the shared plan
 *   room → client   {t:"hello", you, host, peers:[{id,name}], plan}
 *                   {t:"peer", id, name?, left?}
 *                   {t:"host", id}
 *                   {t:"s"|"e", id, ...}         from another player
 *                   {t:"plan", plan}
 *                   {t:"err", error}
 *
 * Rooms hibernate between messages, so nothing lives on the class: who is connected
 * comes from the socket attachments, the plan from storage.
 */
import { DurableObject } from "cloudflare:workers";

interface Env { ROOMS: DurableObjectNamespace; ASSETS?: Fetcher }
interface Who { id: string; name: string; seq: number }

const MAX_PLAYERS = 4;
const MAX_FRAME = 4096;           // bytes; a snapshot is ~150
const PING = "__ping", PONG = "__pong";
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected a websocket upgrade", { status: 426 });
    if (this.members().length >= MAX_PLAYERS) return new Response("room is full", { status: 409 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]!);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private who(ws: WebSocket): Who | null {
    const a = ws.deserializeAttachment() as Who | null;
    return a && a.id ? a : null;
  }
  private members(): { ws: WebSocket; who: Who }[] {
    const out: { ws: WebSocket; who: Who }[] = [];
    for (const ws of this.ctx.getWebSockets()) { const who = this.who(ws); if (who) out.push({ ws, who }); }
    return out.sort((a, b) => a.who.seq - b.who.seq);
  }
  private send(ws: WebSocket, data: unknown) { try { ws.send(typeof data === "string" ? data : JSON.stringify(data)); } catch { /* gone */ } }
  private others(from: WebSocket, data: string) { for (const m of this.members()) if (m.ws !== from) this.send(m.ws, data); }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string" || raw.length > MAX_FRAME) return;
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== "object") return;
    const me = this.who(ws);

    if (msg.t === "join") {
      if (me) return;
      const id = clean(msg.id, 24), name = clean(msg.name, 16) || "שחקן";
      if (!id) return this.send(ws, { t: "err", error: "missing id" });
      const before = this.members();
      // the same player reconnecting replaces their old socket
      for (const m of before) if (m.who.id === id) { try { m.ws.close(4000, "replaced"); } catch { /* gone */ } }
      const seq = ((await this.ctx.storage.get<number>("seq")) ?? 0) + 1;
      await this.ctx.storage.put("seq", seq);
      ws.serializeAttachment({ id, name, seq } satisfies Who);
      const all = this.members().filter((m) => m.ws === ws || m.who.id !== id);
      const plan = (await this.ctx.storage.get("plan")) ?? {};
      this.send(ws, { t: "hello", you: id, host: all[0]!.who.id, peers: all.filter((m) => m.ws !== ws).map((m) => ({ id: m.who.id, name: m.who.name })), plan });
      this.others(ws, JSON.stringify({ t: "peer", id, name }));
      return;
    }
    if (!me) return this.send(ws, { t: "err", error: "join first" });

    if (msg.t === "s" || msg.t === "e") {
      msg.id = me.id;                                  // never trust a client-supplied sender
      this.others(ws, JSON.stringify(msg));
      return;
    }
    if (msg.t === "plan") {
      const host = this.members()[0];
      if (!host || host.ws !== ws) return this.send(ws, { t: "err", error: "only the host plans" });
      const patch = msg.patch && typeof msg.patch === "object" ? (msg.patch as Record<string, unknown>) : {};
      const plan = Object.assign(((await this.ctx.storage.get("plan")) as Record<string, unknown>) ?? {}, patch);
      if (JSON.stringify(plan).length > 2000) return;
      await this.ctx.storage.put("plan", plan);
      const data = JSON.stringify({ t: "plan", plan });
      for (const m of this.members()) this.send(m.ws, data);
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const me = this.who(ws);
    if (!me) return;
    const rest = this.members().filter((m) => m.ws !== ws);
    if (rest.some((m) => m.who.id === me.id)) return;          // replaced by a reconnect
    const left = JSON.stringify({ t: "peer", id: me.id, left: true });
    for (const m of rest) this.send(m.ws, left);
    if (rest.length) { const host = JSON.stringify({ t: "host", id: rest[0]!.who.id }); for (const m of rest) this.send(m.ws, host); }
    else await this.ctx.storage.deleteAll();                    // empty room: forget the plan
  }
  override async webSocketError(ws: WebSocket): Promise<void> { await this.webSocketClose(ws); }
}
