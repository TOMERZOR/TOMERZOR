// Multiplayer through the artifact's live room: everyone who has the game's link open sees
// the others walking around, each playing as themselves from the cast. Presence carries
// the player's site, position and speech bubble; nothing is stored. Off the claude.ai
// link (a local copy, GitHub) the room is absent and the game stays single player.
const Multi = {
  room: null,
  ready: null,
  on: false,
  as: null,        // cast id the local player plays as
  peers: [],       // other players: { peer, who, name, site, x, y, a, m, r, c, say }
  sent: '',
  sendT: 0,

  init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        if (!window.claude || !window.claude.use) return null;
        const room = await window.claude.use('room');
        if (!room) return null;
        this.room = room;
        room.onPeers(ch => this.onPeers(ch.peers));
        return room;
      } catch (e) { return null; }
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
        // Smoothed position for drawing.
        dx: old ? old.dx : +s.x || 0, dy: old ? old.dy : +s.y || 0,
      };
    });
    // A player who joins as someone replaces that character's NPC.
    if (this.on && this.peers.map(p => p.who).sort().join() !== before) Game.resetNpcs();
  },

  // Cast ids in use by players right now (the local one included).
  taken() {
    const ids = new Set(this.peers.map(p => p.who));
    if (this.on && this.as) ids.add(this.as);
    return ids;
  },
  here() { return this.peers.filter(p => p.site === World.id); },

  start(personId) {
    this.on = true;
    this.as = personId;
    this.update(1);
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
      m: !!P.moving, r: !!P.running, c: P.carry || false, say: this.say || null,
    };
    const key = JSON.stringify(st);
    if (key === this.sent) return;
    this.sent = key;
    this.room.presence(st).catch(() => {});
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
