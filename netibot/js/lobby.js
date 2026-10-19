// Multiplayer without Claude accounts: a lobby on a free public MQTT broker. Everyone who
// opens the same invite link (same lobby code) is in the same world. The broker only relays
// small position messages between the players; nothing is stored anywhere.
// The invite link can also carry the cast's real names in its #fragment. A fragment is never
// sent to any server, so the names exist only in the link shared with the friends.
const LOBBY_BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081'];
const PAGES_URL = 'https://tomerzor.github.io/TOMERZOR/netibot/';

const Lobby = {
  // #l=<lobby code>&n=<names>&b=<broker url, for testing>
  params() {
    const out = {};
    for (const part of location.hash.replace(/^#/, '').split('&')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
    }
    return out;
  },
  invited() { return !!this.params().l; },
  code() {
    const fromLink = (this.params().l || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    if (fromLink) return fromLink;
    let c = null;
    try { c = localStorage.getItem('netibot.lobby'); } catch (e) { /* storage may be blocked */ }
    if (!c) {
      const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
      c = Array.from({ length: 6 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
      try { localStorage.setItem('netibot.lobby', c); } catch (e) { /* ignore */ }
    }
    return c;
  },

  // ---------- names in the link ----------
  encodeNames() {
    const c = {};
    for (const p of [...ROSTER.people, ROSTER.easterEgg]) c[p.id] = [p.name, p.short, p.first];
    const json = JSON.stringify({ p: ROSTER.platoon, h: ROSTER.sites.hq, c });
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  applyNames() {
    const n = this.params().n;
    if (!n) return;
    try {
      const bin = atob(n.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
      const clean = (v) => String(v || '').replace(/[<>{}\[\]]/g, '').slice(0, 40);
      if (data.p) ROSTER.platoon = clean(data.p);
      if (data.h) ROSTER.sites.hq = clean(data.h);
      for (const p of [...ROSTER.people, ROSTER.easterEgg]) {
        const v = data.c && data.c[p.id];
        if (Array.isArray(v) && v[1]) { p.name = clean(v[0]); p.short = clean(v[1]); p.first = clean(v[2] || v[1]); }
      }
      ROSTER.example = false;
      ROSTER.fromLink = true;
    } catch (e) { /* a broken link keeps the default names */ }
  },
  // The key that opens js/roster.enc.js: from the link, or remembered from an earlier visit,
  // or (on the owner's own copy) from js/roster.key.js.
  key() {
    if (this.params().k) return this.params().k.replace(/[^A-Za-z0-9_-]/g, '');
    try { const k = localStorage.getItem('netibot.key'); if (k) return k; } catch (e) { /* storage may be blocked */ }
    return window.ROSTER_KEY || null;
  },
  // Decrypt the real cast when this copy only has the made-up one. Resolves either way.
  // On the owner's copy (real roster.js) it still decrypts, for the faces and 3D models.
  async unlock() {
    const k = this.key();
    if (!k || !window.ROSTER_ENC || !window.crypto || !crypto.subtle) return;
    try {
      const un = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey('raw', un(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: un(ROSTER_ENC.iv) }, key, un(ROSTER_ENC.data));
      const real = JSON.parse(new TextDecoder().decode(plain));
      if (!real || !Array.isArray(real.people)) return;
      this.cryptoKey = key;
      if (!ROSTER.example) { ROSTER.faces = real.faces; ROSTER.models = real.models; ROSTER.scenes = real.scenes; return; }
      ROSTER = real;
      ROSTER.example = false;
      try { localStorage.setItem('netibot.key', k); } catch (e) { /* ignore */ }
    } catch (e) { /* a wrong key keeps the made-up names */ }
  },
  // Chat lines travel through a public relay, so they're sealed with the same key as the
  // cast: only people with the invite link can read them.
  async seal(text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.cryptoKey, new TextEncoder().encode(text)));
    const all = new Uint8Array(12 + ct.length);
    all.set(iv); all.set(ct, 12);
    let bin = '';
    all.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  },
  async open(b64) {
    const all = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, this.cryptoKey, all.slice(12));
    return new TextDecoder().decode(pt);
  },
  // A remembered key that no longer opens anything is dropped, so it can't come back.
  forgetKey() {
    if (this.params().k) return;
    try { localStorage.removeItem('netibot.key'); } catch (e) { /* ignore */ }
  },
  inviteLink() {
    const onPages = location.protocol.startsWith('http') && !/claude|claudeusercontent/.test(location.hostname) && location.hostname !== 'localhost';
    const base = onPages ? location.origin + location.pathname : PAGES_URL;
    const k = this.key();
    // Short link with the key; the long names-in-the-link form only if this copy has no key.
    if (k && window.ROSTER_ENC) return `${base}#l=${this.code()}&k=${k}`;
    return `${base}#l=${this.code()}${ROSTER.example ? '' : '&n=' + this.encodeNames()}`;
  },

  // ---------- connection ----------
  loadLib() {
    if (window.mqtt) return Promise.resolve(true);
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'vendor/mqtt.min.js';
      s.onload = () => resolve(!!window.mqtt);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  },
  // Connect to every broker at once and keep the first that answers.
  async connect(code) {
    if (!(await this.loadLib())) return null;
    const me = 'p' + Math.random().toString(36).slice(2, 10);
    const base = `netibot/v1/${code}/`;
    const urls = this.params().b ? [this.params().b] : LOBBY_BROKERS;
    return new Promise(resolve => {
      let done = false;
      const clients = [];
      const finish = (client) => {
        if (done) return;
        done = true;
        for (const c of clients) if (c !== client) { try { c.end(true); } catch (e) { /* ignore */ } }
        resolve(client ? lobbyRoom(client, base, me) : null);
      };
      for (const url of urls) {
        try {
          const c = window.mqtt.connect(url, { clientId: me, clean: true, connectTimeout: 6000, reconnectPeriod: 2000, will: { topic: base + 'p/' + me, payload: '', qos: 0, retain: false } });
          clients.push(c);
          c.once('connect', () => finish(c));
          c.on('error', () => {});
        } catch (e) { /* a blocked socket just doesn't count */ }
      }
      setTimeout(() => finish(null), 7000);
    });
  },
};

// The same shape as the artifact room (presence + onPeers), so Multi doesn't care which it has.
function lobbyRoom(client, base, me) {
  const peers = new Map();
  const fns = [];
  let last = null, lastSent = 0;
  const emit = () => {
    const list = [...peers].map(([id, p]) => ({ peer: id, isMe: false, kind: 'viewer', presence: p.presence }));
    for (const f of fns) f({ peers: list });
  };
  client.subscribe(base + 'p/+');
  client.on('message', (topic, buf) => {
    const id = topic.slice(base.length + 2);
    if (id === me) return;
    if (!buf.length) { if (peers.delete(id)) emit(); return; }
    if (buf.length > 3000) return;
    try {
      const pr = JSON.parse(buf.toString());
      if (pr && typeof pr === 'object' && !Array.isArray(pr)) { peers.set(id, { presence: pr, t: Date.now() }); emit(); }
    } catch (e) { /* not ours */ }
  });
  // Someone who closed the tab without saying goodbye drops out after a few seconds.
  setInterval(() => {
    let changed = false;
    for (const [id, p] of peers) if (Date.now() - p.t > 6000) { peers.delete(id); changed = true; }
    if (changed) emit();
  }, 1000);
  const send = () => { if (last) { client.publish(base + 'p/' + me, last); lastSent = Date.now(); } };
  setInterval(() => { if (Date.now() - lastSent > 1500) send(); }, 500);
  return {
    lobby: true,
    presence(st) { last = JSON.stringify(st); send(); return Promise.resolve(); },
    onPeers(fn) { fns.push(fn); return () => {}; },
    leave() { try { client.publish(base + 'p/' + me, ''); client.end(); } catch (e) { /* ignore */ } },
  };
}

Lobby.applyNames();
