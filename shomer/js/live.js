// Live view over WebRTC. The video goes straight from the camera to the phone, encrypted and
// peer to peer; ntfy only carries the few messages that set up the connection, on a separate
// topic (<topic>-live) so they never show up as notifications.
// Works best with both devices on the same network, e.g. the camera on the phone's hotspot.

import * as ntfy from './ntfy.js';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CHUNK = 3000; // ntfy turns messages over 4096 bytes into attachments
const MAX_VIEWERS = 3;

export const liveTopic = topic => `${topic}-live`;
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('');

// SDP is a few KB of text; deflate + base64 keeps most messages in a single ntfy message.
async function pack(obj) {
  const stream = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function unpack(text) {
  const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

function iceGathered(pc, timeout = 3000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    const timer = setTimeout(done, timeout);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

class Signal {
  constructor(server, topic, onMessage) {
    this.server = server;
    this.topic = topic;
    this.parts = new Map();
    this.es = new EventSource(ntfy.sseUrl(server, topic));
    this.ready = new Promise(resolve => (this.es.onopen = resolve));
    this.es.onmessage = async e => {
      try {
        const m = JSON.parse(e.data);
        if (m.event !== 'message' || !m.message) return;
        const part = JSON.parse(m.message);
        if (!part.shomer) return;
        const got = this.parts.get(part.id) || [];
        got[part.i] = part.d;
        if (got.filter(Boolean).length < part.n) return this.parts.set(part.id, got);
        this.parts.delete(part.id);
        onMessage(await unpack(got.join('')));
      } catch {}
    };
  }

  async send(msg) {
    const data = await pack(msg);
    const id = randomId(), n = Math.ceil(data.length / CHUNK);
    for (let i = 0; i < n; i++) {
      const message = JSON.stringify({ shomer: 1, id, i, n, d: data.slice(i * CHUNK, (i + 1) * CHUNK) });
      await ntfy.publish(this.server, this.topic, { message });
    }
  }

  close() {
    this.es.close();
  }
}

export const liveSupported = () => 'RTCPeerConnection' in window && 'CompressionStream' in window;

// Runs on the camera device while it is watching.
export class LiveCamera {
  constructor(server, topic, { track, onViewers }) {
    this.track = track;
    this.onViewers = onViewers;
    this.peers = new Map();
    this.signal = new Signal(server, liveTopic(topic), m => this.handle(m).catch(() => {}));
    // Phones already waiting on the live screen connect as soon as the camera comes up.
    this.signal.ready.then(() => this.signal.send({ type: 'up' })).catch(() => {});
  }

  async handle(m) {
    if (m.type === 'hello') return this.offer(m.sid);
    const peer = this.peers.get(m.sid);
    if (!peer) return;
    if (m.type === 'answer') await peer.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
    if (m.type === 'bye') this.drop(m.sid);
  }

  async offer(sid) {
    if (this.peers.has(sid)) return;
    while (this.peers.size >= MAX_VIEWERS) this.drop(this.peers.keys().next().value);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = { pc, dc: pc.createDataChannel('events'), sender: pc.addTrack(this.track) };
    this.peers.set(sid, peer);
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) this.drop(sid);
      this.report();
    };
    // Give up on viewers that never finish connecting.
    setTimeout(() => pc.connectionState !== 'connected' && this.drop(sid), 30000);
    await pc.setLocalDescription(await pc.createOffer());
    await iceGathered(pc);
    await this.signal.send({ type: 'offer', sid, sdp: pc.localDescription.sdp });
  }

  drop(sid) {
    const peer = this.peers.get(sid);
    if (!peer) return;
    this.peers.delete(sid);
    peer.pc.close();
    this.report();
  }

  report() {
    let n = 0;
    for (const { pc } of this.peers.values()) if (pc.connectionState === 'connected') n++;
    if (n !== this.viewers) this.onViewers?.((this.viewers = n));
  }

  // The camera reopened (e.g. after the screen was off): keep streaming the new track.
  setTrack(track) {
    this.track = track;
    for (const { sender } of this.peers.values()) sender.replaceTrack(track).catch(() => {});
  }

  // Detection boxes and alerts reach open live views instantly, without waiting for ntfy.
  broadcast(event) {
    const text = JSON.stringify(event);
    for (const { dc } of this.peers.values()) if (dc.readyState === 'open') dc.send(text);
  }

  close() {
    for (const sid of [...this.peers.keys()]) this.drop(sid);
    this.signal.close();
  }
}

// Runs on the phone's receiving screen.
export class LiveViewer {
  constructor(server, topic, { video, onState, onEvent }) {
    Object.assign(this, { video, onState, onEvent });
    this.signal = new Signal(server, liveTopic(topic), m => this.handle(m).catch(() => {}));
    this.signal.ready.then(() => this.hello());
    onState('wait');
  }

  hello() {
    if (this.closed || this.pc?.connectionState === 'connected') return;
    this.pc?.close();
    this.pc = null;
    this.sid = randomId();
    this.signal.send({ type: 'hello', sid: this.sid }).catch(() => {});
    clearTimeout(this.retry);
    // The camera may be off; it also announces itself ('up') when it starts.
    this.retry = setTimeout(() => this.hello(), 30000);
  }

  async handle(m) {
    if (this.closed) return;
    if (m.type === 'up') return this.hello();
    if (m.type !== 'offer' || m.sid !== this.sid || this.pc) return;
    const pc = (this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS }));
    pc.ontrack = e => {
      this.video.srcObject = e.streams[0] || new MediaStream([e.track]);
      this.video.play().catch(() => {});
    };
    pc.ondatachannel = e => {
      e.channel.onmessage = ev => {
        try { this.onEvent(JSON.parse(ev.data)); } catch {}
      };
    };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(this.retry);
        this.onState('live');
      } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        this.onState('lost');
        clearTimeout(this.retry);
        this.retry = setTimeout(() => this.hello(), 3000);
      }
    };
    await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await iceGathered(pc);
    await this.signal.send({ type: 'answer', sid: this.sid, sdp: pc.localDescription.sdp });
  }

  close() {
    this.closed = true;
    clearTimeout(this.retry);
    if (this.sid) this.signal.send({ type: 'bye', sid: this.sid }).catch(() => {});
    this.pc?.close();
    this.signal.close();
    this.video.srcObject = null;
  }
}
