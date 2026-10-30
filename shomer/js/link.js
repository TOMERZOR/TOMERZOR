// The link between the camera and the phone, through the relay (relay/worker.js) on the internet.
// Both devices connect out to the relay, so it works on any network (a hotspot, or each phone on
// its own mobile data) and reconnects by itself after a drop, or when the phone comes back from
// being locked or in the background. No scanning again.
//
// Everything is end-to-end encrypted (AES-GCM, 256-bit) with a key only the two devices have: the
// camera makes it and shows it in the pairing QR code, and both keep it. The relay sees only a
// room id derived from the key and how much data passes, never the pictures or the alerts.

import { config } from './config.js';

const PREFIX = 'SHOMER3:';
const PING_MS = 15000;
const DEAD_MS = 40000; // no answer to pings for this long: the connection is dead, open a new one
const PREVIEW_BACKLOG = 16 * 1024; // skip pictures while this much is still waiting to go out

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));

export const linkSupported = () => 'WebSocket' in window && !!window.crypto?.subtle && !!config.relay;
export const newKey = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
export const codeFor = key => PREFIX + key;
export const isCode = text => text.startsWith(PREFIX) && /^[A-Za-z0-9_-]{43}$/.test(text.slice(PREFIX.length).trim());
export const keyFrom = code => code.slice(PREFIX.length).trim();

async function roomFor(key) {
  return b64u(await crypto.subtle.digest('SHA-256', enc.encode('shomer-room:' + key))).slice(0, 22);
}

// Events: 'state' ('offline' | 'waiting' | 'connected'), 'open' (the other device just came
// online), 'message' (an object it sent), 'preview' (a picture from the camera).
export class Link {
  constructor(key, role) {
    this.key = key;
    this.role = role;
    this.handlers = {};
    this.peer = false;
    this.state = 'offline';
    this.retry = 0;
    this.out = Promise.resolve();
    this.in = Promise.resolve();
    this.kick = () => this.reconnectSoon(true);
    this.onVisible = () => !document.hidden && this.probe();
    window.addEventListener('online', this.kick);
    document.addEventListener('visibilitychange', this.onVisible);
    this.pinger = setInterval(() => this.ping(), PING_MS);
    this.connect();
  }

  on(name, fn) {
    this.handlers[name] = fn;
    return this;
  }

  emit(name, ...args) {
    this.handlers[name]?.(...args);
  }

  async connect() {
    if (this.closed || this.ws) return;
    this.aes ||= await crypto.subtle.importKey('raw', unb64u(this.key), 'AES-GCM', false, ['encrypt', 'decrypt']);
    this.room ||= await roomFor(this.key);
    if (this.closed || this.ws) return;
    const base = config.relay.replace(/^http/, 'ws');
    const ws = new WebSocket(`${base}/room/${this.room}?role=${this.role}`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.lastPong = Date.now();
      this.update();
    };
    ws.onmessage = e => this.ws === ws && this.receive(e.data);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.peer = false;
      this.update();
      this.reconnectSoon();
    };
    ws.onerror = () => ws.close();
  }

  // Waits 1, 2, 4, 8, then 10 s between tries; right away when the network or the screen comes back.
  reconnectSoon(now = false) {
    if (this.closed || this.ws) return;
    clearTimeout(this.timer);
    const wait = now ? 0 : Math.min(10000, 1000 * 2 ** this.retry++);
    this.timer = setTimeout(() => this.connect(), wait);
  }

  ping() {
    const ws = this.ws;
    if (ws?.readyState !== WebSocket.OPEN) return;
    if (Date.now() - this.lastPong > DEAD_MS) return ws.close();
    try { ws.send('ping'); } catch {}
  }

  // After the phone was locked, a connection can look open but be dead. Check, and replace it if so.
  probe() {
    const ws = this.ws;
    if (!ws) return this.reconnectSoon(true);
    if (ws.readyState !== WebSocket.OPEN) return;
    const sent = Date.now();
    try { ws.send('ping'); } catch {}
    setTimeout(() => {
      if (this.ws === ws && this.lastPong < sent) ws.close();
    }, 3000);
  }

  receive(data) {
    if (typeof data === 'string') {
      if (data === 'pong') return void (this.lastPong = Date.now());
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.t === 'peers') {
        this.peer = this.role === 'camera' ? msg.phones > 0 : !!msg.camera;
        this.update();
      }
      return;
    }
    // Decrypt in order. Anything that doesn't decrypt with our key is ignored.
    this.in = this.in.then(async () => {
      const bytes = new Uint8Array(data);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, this.aes, bytes.subarray(12));
      const msg = JSON.parse(dec.decode(plain));
      if (msg.type === 'preview') this.emit('preview', msg.d);
      else this.emit('message', msg);
    }).catch(() => {});
  }

  update() {
    const state = !this.ws || this.ws.readyState !== WebSocket.OPEN ? 'offline' : this.peer ? 'connected' : 'waiting';
    if (state === this.state) return;
    const was = this.state;
    this.state = state;
    this.emit('state', state);
    if (state === 'connected' && was !== 'connected') this.emit('open');
  }

  get open() {
    return this.state === 'connected';
  }

  // Encrypted and sent in order. Returns false when the other device isn't connected.
  send(msg) {
    if (!this.open) return false;
    const ws = this.ws;
    this.out = this.out.then(async () => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.aes, enc.encode(JSON.stringify(msg))));
      const frame = new Uint8Array(12 + cipher.length);
      frame.set(iv);
      frame.set(cipher, 12);
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    }).catch(() => {});
    return true;
  }

  // Pictures are skipped instead of piling up when the connection is slow.
  sendPreview(dataUrl) {
    if (!this.open || this.ws.bufferedAmount > PREVIEW_BACKLOG) return false;
    return this.send({ type: 'preview', d: dataUrl });
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.pinger);
    window.removeEventListener('online', this.kick);
    document.removeEventListener('visibilitychange', this.onVisible);
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(); } catch {}
  }
}
