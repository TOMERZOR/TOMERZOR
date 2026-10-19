// Multiplayer: everyone in the same lobby sees the others walking around, each playing as
// themselves from the cast. Presence carries the player's site, position and speech bubble;
// nothing is stored. The room is the invite-link lobby (js/lobby.js) or, inside claude.ai,
// the artifact's live room.
const Multi = {
  room: null,
  ready: null,
  on: false,
  as: null,        // cast id the local player plays as
  peers: [],       // other players: { peer, who, name, site, x, y, a, m, r, c, say }
  sent: '',
  sendT: 0,
  // Cast members a player can be. In multiplayer they only exist as real players: whoever
  // isn't connected isn't in the world.
  PLAYABLE_HQ: ['bc', 'deputy_bc', 'harasar', 'rasap', 'deputy_rasap', 'sarsap', 'interceptors', 'officer1', 'officer2', 'officer3', 'ops', 'hamalist'],
  playable(person) { return person.map === 'netivot' || this.PLAYABLE_HQ.includes(person.id); },

  // The lobby from the invite link comes first (it works for anyone, no account needed);
  // inside claude.ai the artifact's own room is the fallback.
  init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      let room = null;
      try { room = await Lobby.connect(Lobby.code()); } catch (e) { room = null; }
      if (!room) {
        try {
          if (window.claude && window.claude.use) room = await window.claude.use('room');
        } catch (e) { room = null; }
      }
      if (!room) { this.ready = null; return null; }
      this.room = room;
      room.onPeers(ch => this.onPeers(ch.peers));
      window.addEventListener('pagehide', () => { if (room.leave) room.leave(); });
      return room;
    })();
    return this.ready;
  },
  available() { return !!this.room; },

  onPeers(list) {
    const before = this.peers.map(p => p.who).sort().join();
    this.peers = list.filter(p => !p.isMe && p.kind === 'viewer' && p.presence && p.presence.who).map(p => {
      const s = p.presence;
      const old = this.peers.find(q => q.peer === p.peer);
      return {
        peer: p.peer, who: String(s.who).slice(0, 40), name: String(s.name || '').slice(0, 24), site: s.site,
        x: +s.x || 0, y: +s.y || 0, a: +s.a || 0, m: !!s.m, r: !!s.r, c: s.c ? String(s.c).slice(0, 12) : false,
        say: s.say && typeof s.say.text === 'string' ? { text: s.say.text.slice(0, 80), at: +s.say.at || 0 } : null,
        // Their last few chat messages, sealed: to everyone (to '') or to one player's cast id.
        cm: Array.isArray(s.cm) ? s.cm.slice(-8).filter(o => o && typeof o === 'object' && typeof o.d === 'string' && o.d.length < 800).map(o => ({ i: String(o.i || '').slice(0, 16), to: String(o.to || '').slice(0, 40), d: o.d, at: +o.at || 0 })) : [],
        // A co-op boss fight this player is in: which one, its max HP, the damage they dealt.
        baum: s.baum && +s.baum.id ? { id: +s.baum.id, hid: Array.isArray(s.baum.hid) ? s.baum.hid.slice(0, 10).map(String) : [], carry: s.baum.carry ? String(s.baum.carry).slice(0, 16) : null } : null,
        fx: s.fx && typeof s.fx === 'object' ? {
          s: Array.isArray(s.fx.s) ? s.fx.s.slice(0, 10).filter(o => o && typeof o === 'object').map(o => ({ t: +o.t || 0, x: +o.x || 0, y: +o.y || 0, k: String(o.k || '').slice(0, 12) })) : [],
          b: Array.isArray(s.fx.b) ? s.fx.b.slice(0, 10).filter(o => o && typeof o === 'object').map(o => ({ t: +o.t || 0, x0: +o.x0 || 0, y0: +o.y0 || 0, x1: +o.x1 || 0, y1: +o.y1 || 0 })) : [],
        } : null,
        // A race they're in or hosting (cd: seconds until the host's start).
        race: s.race && +s.race.id ? { id: +s.race.id, host: !!s.race.host, car: String(s.race.car || '').slice(0, 12), x: +s.race.x || 0, z: +s.race.z || 0, a: +s.race.a || 0, v: +s.race.v || 0, lap: Math.max(0, Math.min(9, +s.race.lap | 0)), pr: Math.max(-2000, Math.min(9000, +s.race.pr || 0)), fin: Math.max(0, +s.race.fin || 0), cd: Math.max(0, Math.min(60, +s.race.cd || 0)) } : null,
        // A red alert this player is in: everyone online at that site gets it too.
        sl: !!s.sl,
        al: s.al && +s.al.id ? { id: +s.al.id, site: String(s.al.site || '').slice(0, 12) } : null,
        boss: s.boss && +s.boss.id ? { id: +s.boss.id, max: Math.min(1000, Math.max(50, +s.boss.max || 100)), dmg: Math.min(1000, Math.max(0, +s.boss.dmg || 0)), tk: Array.isArray(s.boss.tk) ? s.boss.tk.slice(-40).map(n => Math.floor(+n)).filter(n => n >= 0 && n < 5000) : [] } : null,
        // Smoothed position for drawing.
        dx: old ? old.dx : +s.x || 0, dy: old ? old.dy : +s.y || 0,
      };
    });
    if (this.on) for (const p of this.peers) if (p.al) this.alertFrom(p);
    if (this.on) for (const p of this.peers) this.readChat(p);
    // A player who joins as someone replaces that character's NPC.
    if (this.on && this.peers.map(p => p.who).sort().join() !== before) Game.resetNpcs();
  },

  // Cast ids in use by players right now (the local one included).
  taken() {
    const ids = new Set(this.peers.map(p => p.who));
    if (this.on && this.as) ids.add(this.as);
    if (G.state && G.state.role) ids.add(G.state.role); // role mode: you are them
    return ids;
  },
  here() { return this.peers.filter(p => p.site === World.id); },

  start(personId) {
    this.on = true;
    this.as = personId;
    this.update(1);
    UI.chatRefresh();
  },

  update(dt) {
    if (!this.on || !this.room) return;
    for (const p of this.peers) {
      const k = Math.min(1, dt * 10);
      p.dx += (p.x - p.dx) * k;
      p.dy += (p.y - p.dy) * k;
    }
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 0.1;
    const P = G.player;
    const st = {
      v: 1, who: this.as, name: G.profile.name, site: World.id,
      x: Math.round(P.x), y: Math.round(P.y), a: Math.round(P.angle * 100) / 100,
      m: !!P.moving, r: !!P.running, c: P.carry || false, say: this.say || null, cm: this.outbox,
      sl: !!this.sleeping,
      race: Race.presence(),
      al: G.alert && !G.alert.drill && G.alert.sid ? { id: G.alert.sid, site: World.id } : null,
      boss: Boss.active && Boss.coop ? { id: Boss.coop.id, max: Boss.max, dmg: Boss.myDmg, tk: Boss.myTaken.slice(-30) } : null,
      fx: Boss.active && Boss.coop ? Boss.fxOut() : null,
      baum: Events.baum && Events.baum.coop ? { id: Events.baum.coop.id, hid: [...Events.baum.myHid], carry: Events.baum.carrying ? Events.baum.carrying.id : null } : null,
    };
    const key = JSON.stringify(st);
    if (key === this.sent) return;
    this.sent = key;
    this.room.presence(st).catch(() => {});
  },

  // Red alerts are shared: when a friend's siren goes off at your site, yours does too.
  // Each alert has an id, so it spreads once and doesn't bounce back and forth.
  seenAlerts: new Set(),
  alertFrom(p) {
    if (this.seenAlerts.has(p.al.id)) return;
    this.seenAlerts.add(p.al.id);
    if (p.al.site !== World.id) { UI.toast(`🚨 צבע אדום ב${siteName(p.al.site)} — ${p.name} במיגונית`, 'bad'); return; }
    Story.remoteAlert = { id: p.al.id, from: p.name, at: Date.now() };
  },
  newAlertId() {
    const id = Math.floor(Math.random() * 1e9) + 1;
    this.seenAlerts.add(id);
    return id;
  },

  // ---------- chat ----------
  // Everyone's last messages ride along in their presence; each one is read once.
  chatLog: [],   // { from, name, to, text, at, mine }
  outbox: [],
  seenMsg: new Set(),
  unread: 0,
  async send(text, to = '') {
    const t = String(text || '').replace(/[\u0000-\u001f\u200b-\u200f\u202a-\u202e]/g, '').trim().slice(0, 160);
    if (!t || !Lobby.cryptoKey) return;
    const at = Date.now();
    const d = await Lobby.seal(JSON.stringify({ t }));
    this.outbox = [...this.outbox, { i: Math.random().toString(36).slice(2, 10), to, d, at }].slice(-8);
    this.chatLog.push({ from: this.as, name: G.profile.name, to, text: t, at, mine: true });
    // To everyone: also a bubble over your head, like before.
    if (!to) this.speak(t.slice(0, 80));
    else Sound.pop();
    UI.chatRefresh();
  },
  async readChat(p) {
    for (const m of p.cm || []) {
      const key = p.peer + ':' + m.i;
      if (this.seenMsg.has(key)) continue;
      this.seenMsg.add(key);
      // Not for me, or old (from before I joined).
      if ((m.to && m.to !== this.as) || Date.now() - m.at > 10 * 60 * 1000) continue;
      try {
        const { t } = JSON.parse(await Lobby.open(m.d));
        const msg = { from: p.who, name: p.name, to: m.to, text: String(t).slice(0, 160), at: m.at };
        this.chatLog.push(msg);
        this.chatLog = this.chatLog.slice(-80);
        if (!UI.chatOpen()) {
          this.unread++;
          UI.toast(`${m.to ? '🔒' : '💬'} <span data-raw>${esc(p.name)}</span>${m.to ? ' (רק אליך)' : ''}: <span data-raw>${esc(msg.text)}</span>`);
          Sound.ding();
        }
        UI.chatRefresh();
      } catch (e) { /* not sealed with our key */ }
    }
  },

  // A line of chat over your head for everyone on the same site.
  speak(text) {
    const t = String(text || '').replace(/[\u0000-\u001f​-‏‪-‮]/g, '').trim().slice(0, 80);
    if (!t) return;
    this.say = { text: t, at: Date.now() };
    G.player.bubble = { text: t, t: 5 };
    Sound.pop();
  },
};
