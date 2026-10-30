// A direct, local link between the camera device and the phone (WebRTC data channels, encrypted).
// There is no server at all: the two devices pair by showing each other QR codes, and then
// talk straight over the Wi-Fi they share (e.g. the phone's hotspot, internet not needed).
//
// Only data goes over the link, no video stream: it needs no renegotiation once connected and
// little bandwidth, which keeps it steady. Two channels:
// - "shomer": reliable and ordered, for alerts, heartbeats and commands.
// - "preview": unreliable, for the once-a-second picture. A lost or late picture is simply
//   skipped, so it can never hold up an alert or a heartbeat behind it.

const PREFIX = 'SHOMER1:'; // full SDP, deflated (fallback)
const COMPACT = 'SHOMER2:'; // just the fields that differ between connections

export const isCode = text => text.startsWith(PREFIX) || text.startsWith(COMPACT);

async function pack(obj) {
  const stream = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIX + btoa(bin);
}

async function unpack(text) {
  if (text.startsWith(COMPACT)) return expand(text);
  if (!text.startsWith(PREFIX)) throw new Error('not a Shomer code');
  const bytes = Uint8Array.from(atob(text.slice(PREFIX.length)), c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

// A data-channel-only SDP is the same everywhere except for the ICE credentials, the DTLS
// fingerprint, the DTLS role and the addresses, so the QR code carries only those (~150 chars
// instead of ~600) and the other side rebuilds the rest. Falls back to the full SDP otherwise.
async function encode(role, sdp) {
  const get = re => sdp.match(re)?.[1];
  const ufrag = get(/^a=ice-ufrag:(\S+)/m), pwd = get(/^a=ice-pwd:(\S+)/m);
  const fp = get(/^a=fingerprint:sha-256 ([0-9A-F:]+)/im), setup = get(/^a=setup:(\w+)/m);
  const cands = [...sdp.matchAll(/^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host/gim)].slice(0, 4).map(m => `${m[1]} ${m[2]}`);
  const plain = (sdp.match(/^m=/gm) || []).length === 1 && /^m=application .*webrtc-datachannel/m.test(sdp);
  if (!plain || !ufrag || !pwd || !fp || !setup || !cands.length) return pack({ r: role, s: sdp });
  const fpBytes = String.fromCharCode(...fp.split(':').map(h => parseInt(h, 16)));
  return COMPACT + [role, ufrag, pwd, btoa(fpBytes), { actpass: 'x', active: 'a', passive: 'p' }[setup] || 'x', cands.join(',')].join('|');
}

function expand(text) {
  const [role, ufrag, pwd, fpB64, setup, cands] = text.slice(COMPACT.length).split('|');
  const fp = Array.from(atob(fpB64), c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(':');
  const roles = { x: 'actpass', a: 'active', p: 'passive' };
  const lines = [
    'v=0',
    `o=- ${Date.now()} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    ...cands.split(',').map((c, i) => {
      const [addr, port] = c.split(' ');
      return `a=candidate:${i + 1} 1 udp ${2122260223 - i} ${addr} ${port} typ host`;
    }),
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${roles[setup] || 'actpass'}`,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    '',
  ];
  return { r: role, s: lines.join('\r\n') };
}

export const linkSupported = () => 'RTCPeerConnection' in window && 'CompressionStream' in window;

function gathered(pc, timeout = 2500) {
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

// Only what's needed on a local network: UDP IPv4 and .local candidates, no TCP or IPv6.
function trimSdp(sdp) {
  return sdp
    .split('\r\n')
    .filter(line => !line.startsWith('a=candidate:') || (/ udp /i.test(line) && !/ [0-9a-f]*:[0-9a-f:]+ \d+ typ/i.test(line)))
    .filter(line => !line.startsWith('a=extmap-allow-mixed'))
    .join('\r\n');
}

const PREVIEW_BACKLOG = 64 * 1024; // skip pictures while this much is still waiting to go out

class Link {
  constructor() {
    this.handlers = {};
    // No STUN/TURN servers: candidates come only from the devices' own network interfaces.
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.onconnectionstatechange = () => this.emit('state', this.pc.connectionState);
  }

  on(name, fn) {
    this.handlers[name] = fn;
    return this;
  }

  emit(name, ...args) {
    this.handlers[name]?.(...args);
  }

  setupChannel(dc) {
    if (dc.label === 'preview') {
      this.preview = dc;
      dc.onmessage = e => typeof e.data === 'string' && this.emit('preview', e.data);
      return;
    }
    this.dc = dc;
    dc.onopen = () => this.emit('open');
    dc.onclose = () => this.emit('state', 'closed');
    dc.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.emit('message', msg);
    };
  }

  send(msg) {
    if (this.dc?.readyState !== 'open') return false;
    try {
      this.dc.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  sendPreview(dataUrl) {
    const dc = this.preview;
    if (dc?.readyState !== 'open' || dc.bufferedAmount > PREVIEW_BACKLOG) return false;
    try {
      dc.send(dataUrl);
      return true;
    } catch {
      return false;
    }
  }

  get open() {
    return this.dc?.readyState === 'open';
  }

  close() {
    this.closed = true;
    this.pc.close();
  }
}

export class CameraLink extends Link {
  constructor() {
    super();
    this.setupChannel(this.pc.createDataChannel('shomer', { ordered: true }));
    this.setupChannel(this.pc.createDataChannel('preview', { ordered: false, maxRetransmits: 0 }));
  }

  // Step 1: the code the phone scans.
  async createCode() {
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await gathered(this.pc);
    return encode('o', trimSdp(this.pc.localDescription.sdp));
  }

  // Step 3: the code the phone shows back.
  async acceptCode(text) {
    const msg = await unpack(text);
    if (msg.r !== 'a') throw new Error('expected the phone\'s code');
    await this.pc.setRemoteDescription({ type: 'answer', sdp: msg.s });
  }
}

export class PhoneLink extends Link {
  constructor() {
    super();
    this.pc.ondatachannel = e => this.setupChannel(e.channel);
  }

  // Step 2: scan the camera's code, return the code to show back to it.
  async answerCode(text) {
    const msg = await unpack(text);
    if (msg.r !== 'o') throw new Error('expected the camera\'s code');
    await this.pc.setRemoteDescription({ type: 'offer', sdp: msg.s });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await gathered(this.pc);
    return encode('a', trimSdp(this.pc.localDescription.sdp));
  }
}
