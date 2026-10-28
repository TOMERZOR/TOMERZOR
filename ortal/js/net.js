// Online play without a game server of our own.
// The two browsers find each other through public MQTT brokers (WebSocket),
// using a 5-digit room code, and then try to open a direct WebRTC data channel.
// Game packets go over the direct channel when it opens; if it can't (some
// mobile networks block it), they keep flowing through the brokers instead.
// Several brokers are used at once so one being down or slow doesn't matter.

const qs = new URLSearchParams(location.search);
// ?broker=ws://... points at a different broker (used by the tests); ?nortc=1 skips WebRTC
const BROKERS = qs.get("broker") ? [qs.get("broker")] : [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];
const NO_RTC = qs.get("nortc") === "1";
const PREFIX = "ortalkombat/v2/";
const ICE = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const enc = new TextEncoder();
const dec = new TextDecoder();

function str(s) {
  const b = enc.encode(s);
  const out = new Uint8Array(b.length + 2);
  out[0] = b.length >> 8; out[1] = b.length & 255; out.set(b, 2);
  return out;
}
function cat(...parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function packet(type, body) {
  const len = [];
  let n = body.length;
  do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; len.push(d); } while (n > 0);
  return cat(Uint8Array.of(type, ...len), body);
}

// Just enough MQTT 3.1.1 for QoS 0 publish/subscribe.
class Mqtt {
  constructor(url, onMessage) {
    this.url = url; this.onMessage = onMessage;
    this.ready = false; this.closed = false; this.buf = new Uint8Array(0); this.pid = 1;
    this.subs = [];
  }
  connect(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = (e) => { if (!done) { done = true; reject(e); } try { this.ws && this.ws.close(); } catch {} };
      const timer = setTimeout(() => fail(new Error("timeout " + this.url)), timeoutMs);
      let ws;
      try { ws = new WebSocket(this.url, "mqtt"); } catch (e) { clearTimeout(timer); fail(e); return; }
      this.ws = ws;
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        const id = "ok" + Math.random().toString(36).slice(2, 12);
        const body = cat(str("MQTT"), Uint8Array.of(4, 2, 0, 30), str(id));
        ws.send(packet(0x10, body));
      };
      ws.onmessage = (e) => {
        this.feed(new Uint8Array(e.data), () => { if (!done) { done = true; clearTimeout(timer); this.ready = true; resolve(this); } });
      };
      ws.onerror = () => { clearTimeout(timer); fail(new Error("ws error " + this.url)); };
      ws.onclose = () => { this.ready = false; this.closed = true; clearTimeout(this.ping); if (!done) { clearTimeout(timer); fail(new Error("closed " + this.url)); } };
      this.ping = setInterval(() => { if (this.ready) try { ws.send(Uint8Array.of(0xc0, 0)); } catch {} }, 20000);
    });
  }
  feed(chunk, onConnack) {
    this.buf = this.buf.length ? cat(this.buf, chunk) : chunk;
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      let mul = 1, len = 0, i = 1, byte;
      do {
        if (i >= b.length) return;
        byte = b[i++]; len += (byte & 127) * mul; mul *= 128;
      } while (byte & 128);
      if (b.length < i + len) return;
      const type = b[0] >> 4;
      const body = b.subarray(i, i + len);
      this.buf = b.subarray(i + len);
      if (type === 2) { if (body[1] === 0) onConnack(); }
      else if (type === 3) {
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        let off = 2 + tl;
        if ((b[0] >> 1) & 3) off += 2; // packet id for QoS > 0
        this.onMessage(topic, dec.decode(body.subarray(off)));
      }
    }
  }
  subscribe(topic) {
    const pid = this.pid++;
    this.ws.send(packet(0x82, cat(Uint8Array.of(pid >> 8, pid & 255), str(topic), Uint8Array.of(0))));
  }
  publish(topic, text) {
    if (!this.ready) return;
    try { this.ws.send(packet(0x30, cat(str(topic), enc.encode(text)))); } catch {}
  }
  close() {
    this.closed = true; clearInterval(this.ping);
    try { if (this.ready) this.ws.send(Uint8Array.of(0xe0, 0)); this.ws.close(); } catch {}
  }
}

export class Net {
  constructor() {
    this.brokers = [];
    this.handlers = {};
    this.role = "";      // "h" host or "g" guest
    this.room = "";
    this.sid = "";
    this.gid = Math.random().toString(36).slice(2, 10);
    this.peer = false;
    this.mode = "";      // "relay" or "p2p"
    this.rtt = 0;
    this.lastHeard = 0;
    this.seq = 1;
    this.seen = new Set();
    this.pc = null; this.dc = null;
    this.timers = [];
    this.pendingIce = [];
  }

  on(name, fn) { this.handlers[name] = fn; }
  emit(name, ...a) { if (this.handlers[name]) this.handlers[name](...a); }

  async connectBrokers() {
    const tries = BROKERS.map((u) => new Mqtt(u, (t, m) => this.onBroker(t, m)).connect().then((c) => { this.brokers.push(c); return c; }));
    // resolve as soon as one works; keep the others joining in the background
    await new Promise((resolve, reject) => {
      let fails = 0;
      for (const t of tries) t.then((c) => { c.subscribe(PREFIX + this.room + "/" + this.role); resolve(); }, () => { if (++fails === tries.length) reject(new Error("no broker")); });
    });
  }

  async host() {
    this.role = "h";
    this.room = String(Math.floor(10000 + Math.random() * 90000));
    this.sid = Math.random().toString(36).slice(2, 10);
    await this.connectBrokers();
    this.startPings();
    return this.room;
  }

  async join(room) {
    this.role = "g";
    this.room = String(room).replace(/\D/g, "");
    await this.connectBrokers();
    // knock until the host answers
    const knock = () => { if (!this.peer) this.relay({ t: "hello", gid: this.gid }); };
    knock();
    this.timers.push(setInterval(knock, 500));
    this.startPings();
    await new Promise((resolve, reject) => {
      this._joined = resolve;
      setTimeout(() => { if (!this.peer) reject(new Error("no host")); }, 15000);
    });
  }

  startPings() {
    this.timers.push(setInterval(() => {
      if (!this.peer) return;
      this.send({ t: "ping", ts: performance.now() });
      if (this.lastHeard && performance.now() - this.lastHeard > 7000) this.emit("lost");
    }, 1000));
  }

  // through the brokers
  relay(msg) {
    msg.sid = this.sid;
    const text = JSON.stringify(msg);
    const to = PREFIX + this.room + "/" + (this.role === "h" ? "g" : "h");
    for (const b of this.brokers) b.publish(to, text);
  }

  // important control messages get a sequence number and go both ways
  sendImportant(msg) {
    msg.n = this.role + this.seq++;
    this.send(msg, true);
  }

  send(msg, both = false) {
    const direct = this.dc && this.dc.readyState === "open";
    if (direct) { try { this.dc.send(JSON.stringify(msg)); } catch {} }
    if (!direct || both) this.relay({ ...msg });
  }

  onBroker(topic, text) {
    let msg; try { msg = JSON.parse(text); } catch { return; }
    if (this.role === "h" && msg.t === "hello") {
      if (!this.peer) {
        this.peer = true; this.guestId = msg.gid;
        this.relay({ t: "welcome", gid: msg.gid });
        this.lastHeard = performance.now();
        this.emit("peer");
        this.startRtc();
      } else if (msg.gid === this.guestId) {
        this.relay({ t: "welcome", gid: msg.gid });
      }
      return;
    }
    if (this.role === "g" && msg.t === "welcome") {
      if (msg.gid !== this.gid) return;
      if (!this.peer) {
        this.peer = true; this.sid = msg.sid; this.lastHeard = performance.now();
        this.emit("peer");
        if (this._joined) this._joined();
      }
      return;
    }
    if (!this.sid || msg.sid !== this.sid) return;
    this.onMsg(msg);
  }

  onMsg(msg) {
    this.lastHeard = performance.now();
    if (msg.n) { if (this.seen.has(msg.n)) return; this.seen.add(msg.n); }
    switch (msg.t) {
      case "ping": this.send({ t: "pong", ts: msg.ts }); return;
      case "pong": {
        const r = performance.now() - msg.ts;
        this.rtt = this.rtt ? this.rtt * 0.8 + r * 0.2 : r;
        return;
      }
      case "sdp": this.onSdp(msg.d); return;
      case "ice": this.onIce(msg.c); return;
      case "bye": this.emit("lost", "bye"); return;
    }
    this.emit("msg", msg);
  }

  // ---- WebRTC ----
  makePc() {
    if (typeof RTCPeerConnection === "undefined" || NO_RTC) return null;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.pc = pc;
    this.dc = pc.createDataChannel("game", { negotiated: true, id: 7, ordered: false, maxRetransmits: 0 });
    this.dc.onopen = () => { this.mode = "p2p"; this.emit("mode", "p2p"); };
    this.dc.onclose = () => { this.mode = "relay"; this.emit("mode", "relay"); };
    this.dc.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.onMsg(m); };
    pc.onicecandidate = (e) => { if (e.candidate) this.relay({ t: "ice", c: e.candidate.toJSON() }); };
    return pc;
  }
  async startRtc() {
    this.mode = "relay"; this.emit("mode", "relay");
    const pc = this.makePc();
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sendOffer = () => { if (this.mode !== "p2p" && pc.localDescription) this.relay({ t: "sdp", d: pc.localDescription.toJSON() }); };
      sendOffer();
      // resend a couple of times in case a broker dropped it
      setTimeout(sendOffer, 1500); setTimeout(sendOffer, 4000);
    } catch (e) { /* stay on relay */ }
  }
  async onSdp(d) {
    try {
      if (d.type === "offer") {
        if (!this.pc) { this.mode = "relay"; this.emit("mode", "relay"); this.makePc(); }
        const pc = this.pc;
        if (!pc || pc.signalingState !== "stable" || pc.remoteDescription) {
          if (pc && pc.localDescription && pc.localDescription.type === "answer") this.relay({ t: "sdp", d: pc.localDescription.toJSON() });
          return;
        }
        await pc.setRemoteDescription(d);
        await this.flushIce();
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        this.relay({ t: "sdp", d: pc.localDescription.toJSON() });
      } else if (d.type === "answer" && this.pc && !this.pc.remoteDescription) {
        await this.pc.setRemoteDescription(d);
        await this.flushIce();
      }
    } catch (e) { /* stay on relay */ }
  }
  async onIce(c) {
    if (!this.pc || !this.pc.remoteDescription) { this.pendingIce.push(c); return; }
    try { await this.pc.addIceCandidate(c); } catch {}
  }
  async flushIce() {
    const list = this.pendingIce; this.pendingIce = [];
    for (const c of list) { try { await this.pc.addIceCandidate(c); } catch {} }
  }

  close() {
    try { if (this.peer) this.relay({ t: "bye" }); } catch {}
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    setTimeout(() => {
      for (const b of this.brokers) b.close();
      this.brokers = [];
      try { this.dc && this.dc.close(); this.pc && this.pc.close(); } catch {}
    }, 200);
    this.peer = false;
  }
}
