// Online, one shared world. Whoever has been online the longest leads it: their phone keeps
// the day and the clock, and only it starts the world's own events (the day's red alerts,
// Rafael's truck, the technician's inspection, the curious civilians at the gate, the
// commander's Anne Frank visit). Everyone else follows: the same day, the same minute, and the
// same events a moment later, once they're free. Red alerts and boss fights spread to everyone
// from whoever has them (js/story.js, js/boss.js). When the leader leaves, the next one along
// carries on from where the world is.
const WorldSync = {
  joinT: 0,          // when I came online (ms): the earliest one online leads
  ev: [],            // as the leader, today's events: [id, kind, arg, day]
  seen: new Set(),   // the leader's events I already took (or let go)
  queue: [],         // the leader's events waiting for me to be free
  lastLead: null,

  start() {
    this.joinT = Date.now();
    this.ev = []; this.seen = new Set(); this.queue = []; this.dayWait = 0; this.lastLead = null;
  },
  // The one who leads, if it isn't me (the earliest online; the cast id breaks a tie).
  leaderPeer() {
    if (!Multi.on) return null;
    let best = null;
    for (const p of Multi.peers) if (p.jt && p.w && (!best || p.jt < best.jt || (p.jt === best.jt && p.who < best.who))) best = p;
    if (!best) return null;
    return best.jt < this.joinT || (best.jt === this.joinT && best.who < (Multi.as || '')) ? best : null;
  },
  // Mine to start: offline always, online only for the leader.
  lead() { return !Multi.on || !this.leaderPeer(); },
  // In my presence: the day and clock, and (as the leader) today's events.
  out() {
    const S = G.state;
    if (!S) return null;
    return { d: S.day, c: Math.round(S.clock * 10) / 10, ev: this.lead() ? this.ev.slice(-6) : [] };
  },
  // The leader started something for everyone.
  started(kind, arg = '') {
    if (!Multi.on || !this.lead()) return;
    this.ev.push([Date.now(), kind, String(arg), G.state.day]);
    if (this.ev.length > 12) this.ev.shift();
  },
  free() {
    return G.running && !G.alert && !Mini.active && !UI.busy && !Boss.active && !Story.ctl && !Arcade.active && !Race.active && !Tutorial.active;
  },

  // Every frame online, whatever is on the screen.
  update(dt) {
    if (!Multi.on || !G.running || !G.state) return;
    const S = G.state;
    // Online the world's clock runs on through talks, menus, the club and races; only a boss
    // fight (everyone's in it) and the controls tutorial hold it.
    if (!Boss.active && !Tutorial.active) S.clock += dt * DATA.minutesPerSecond;
    const L = this.leaderPeer();
    if (L !== this.lastLead && (L ? L.who : null) !== (this.lastLead ? this.lastLead.who : null)) {
      if (L && Multi.peers.length) UI.toast(`🌐 השעון והאירועים מסונכרנים עם ${L.name}`);
      else if (!L && this.lastLead) UI.toast('🌐 עכשיו השעון והאירועים של כולם מסונכרנים לפיך');
    }
    this.lastLead = L;
    if (!L) return;
    const w = L.w;
    // They're on another day (a save from another week, or they woke up first): join theirs.
    if (w.d && w.d !== S.day) {
      this.dayWait += dt;
      if (this.dayWait > 4 && this.free() && !S.dayFlags.ending && !Multi.sleeping) {
        this.dayWait = 0;
        UI.toast(`🌐 מצטרפים ליום של ${L.name}`);
        Story.startDay(w.d);
      }
      return;
    }
    this.dayWait = 0;
    // Their minute: a small gap closes smoothly, a big one at once.
    const diff = w.c - S.clock;
    if (Math.abs(diff) > 2) S.clock = w.c;
    else S.clock += diff * Math.min(1, dt);
    // Their events, each once, when I'm free (for a few minutes; after that it's over).
    for (const e of w.ev) {
      if (this.seen.has(e[0])) continue;
      this.seen.add(e[0]);
      if (e[3] === S.day) this.queue.push({ id: e[0], k: e[1], a: e[2], at: performance.now() });
    }
    this.queue = this.queue.filter(q => performance.now() - q.at < 180000);
    if (this.queue.length && this.free()) this.mirror(this.queue.shift());
  },
  // The leader's event, here.
  mirror(q) {
    const S = G.state;
    if (q.k === 'rafael') { if (!Events.rafael && !S.dayFlags.rafael) Events.startRafael(); }
    else if (q.k === 'tech') { if (!Events.tech && !S.dayFlags.tech && World.id === 'netivot') Events.startTech(q.a); }
    else if (q.k === 'cur') { if (!Curious.npc && World.id === 'netivot' && Settings.v.curious) Curious.arrive(null, q.a); }
  },
};
