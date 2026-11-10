/** Routes /ws/<room> to its room. Everything else is the static game. */
import { Room } from "./room";

export { Room };
interface Env { ROOMS: DurableObjectNamespace; ASSETS: Fetcher }
const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws" || url.pathname.startsWith("/ws/")) {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("expected a websocket upgrade", { status: 426 });
      const room = url.pathname.slice(3).replace(/^\/+/, "") || "main";
      if (!ROOM_RE.test(room)) return new Response("invalid room name", { status: 400 });
      return env.ROOMS.get(env.ROOMS.idFromName(room.toUpperCase())).fetch(request);
    }
    if (url.pathname === "/health") return Response.json({ game: "shchuna-d", ok: true }, { headers: { "access-control-allow-origin": "*" } });
    if (request.method === "GET" && request.headers.get("Accept")?.includes("text/html")) return env.ASSETS.fetch(new Request(new URL("/", url), request));
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
