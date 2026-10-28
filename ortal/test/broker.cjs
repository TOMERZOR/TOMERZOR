// A tiny MQTT-over-WebSocket broker (QoS 0 only) for testing online play
// offline, with optional fake latency, jitter and packet loss.
//   npm i ws && node ortal/test/broker.cjs [port] [latencyMs] [jitterMs] [lossPct]
// then open the game with ?broker=ws://localhost:PORT
const { WebSocketServer } = require("ws");
const PORT = +(process.argv[2] || 8883), LAT = +(process.argv[3] || 0), JIT = +(process.argv[4] || 0), LOSS = +(process.argv[5] || 0) / 100;
const subs = new Map(); // topic -> Set(ws)
function rl(n) { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; }
function pkt(type, body) { return Buffer.concat([Buffer.from([type, ...rl(body.length)]), body]); }
const wss = new WebSocketServer({ port: PORT, handleProtocols: () => "mqtt" });
let published = 0;
wss.on("connection", (ws) => {
  let buf = Buffer.alloc(0);
  ws.topics = new Set();
  ws.on("message", (data) => {
    buf = Buffer.concat([buf, data]);
    for (;;) {
      if (buf.length < 2) return;
      let mul = 1, len = 0, i = 1, b;
      do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
      if (buf.length < i + len) return;
      const type = buf[0] >> 4, body = buf.subarray(i, i + len);
      buf = buf.subarray(i + len);
      if (type === 1) ws.send(pkt(0x20, Buffer.from([0, 0])));
      else if (type === 8) {
        const pid = body.subarray(0, 2); const tl = body.readUInt16BE(2); const topic = body.subarray(4, 4 + tl).toString();
        if (!subs.has(topic)) subs.set(topic, new Set());
        subs.get(topic).add(ws); ws.topics.add(topic);
        ws.send(pkt(0x90, Buffer.concat([pid, Buffer.from([0])])));
      } else if (type === 3) {
        const tl = body.readUInt16BE(0); const topic = body.subarray(2, 2 + tl).toString();
        const out = pkt(0x30, Buffer.from(body));
        published++;
        for (const c of subs.get(topic) || []) {
          if (Math.random() < LOSS) continue;
          const d = LAT + (Math.random() * 2 - 1) * JIT;
          if (d <= 0) c.send(out); else setTimeout(() => { if (c.readyState === 1) c.send(out); }, d);
        }
      } else if (type === 12) ws.send(Buffer.from([0xd0, 0]));
    }
  });
  ws.on("close", () => { for (const t of ws.topics) subs.get(t)?.delete(ws); });
});
setInterval(() => { if (published) { console.log("broker: published", published); published = 0; } }, 10000);
console.log("broker on", PORT, "lat", LAT, "jit", JIT, "loss", LOSS);
