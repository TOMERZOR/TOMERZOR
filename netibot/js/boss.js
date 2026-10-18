// Final boss: the deputy rasap turned into a giant cheeseburger monster. He throws
// cheeseburgers; the player picks up healthy food around the arena and throws it back.
const BOSS_TAUNTS = [
  'אתם תסגרו 35, ואני אנפיץ אתכם!',
  'עוד צ\'יזבורגר? יש לי מלאי עד השחרור!',
  'בזמני — לפני ארבעה חודשים — אכלנו שמנת לארוחת בוקר!',
  'קלוריות זה כוח! כוח זה פז"ם!',
  'המנעול שלי! כמו כל החטיפים בסוללה!',
];
const BOSS_ARENA = { x0: 15 * TS, x1: 45 * TS, y0: 13.5 * TS, y1: 21 * TS };

const Boss = {
  active: false,
  PICKUPS: 9, // healthy food lying around the arena at any time
  NAME: "צ'יזבורגרו",

  // coop: { id, max } when the fight is shared with the other players in the lobby.
  start(coop = null) {
    this.active = true;
    this.coop = coop;
    this.max = coop ? coop.max : 100;
    this.hp = this.max;
    this.myDmg = 0;
    this.peerDmg = 0;
    this.fxLog = { s: [], b: [] };
    this.remoteShots = [];
    this.remoteBurgers = [];
    this.remoteSeen = new Map();
    this.chol = 0;
    this.ammo = Object.fromEntries(DATA.healthy.map(k => [k.id, 0]));
    this.pickups = [];
    this.shots = [];
    this.burgers = [];
    this.x = 30 * TS;
    this.y = 15.6 * TS;
    this.dir = 1;
    this.throwCd = 2.5;
    this.tauntCd = 4;
    this.flash = 0;
    this.bubble = { text: BOSS_TAUNTS[0], t: 3.5 };
    this.lastPick = 'broccoli';
    if (coop) { this.taken = new Set(); this.myTaken = []; this.pickCache = {}; this.coopPickups(); }
    else for (let i = 0; i < Boss.PICKUPS; i++) this.spawnPickup();
    G.player.x = 30 * TS;
    G.player.y = 20.5 * TS;
    G.player.carry = false;
    Scene3D.yaw = 0;
    // Everyone else at HQ clears the arena and watches from the edges.
    G.npcs.forEach((n, i) => { n.x = n.spot.x = (6 + (i % 12) * 4.5) * TS; n.y = n.spot.y = (i < 12 ? 23.6 : 12.4) * TS; n.path = []; n.wander = null; });
    G.npcs = G.npcs.filter(n => n.id !== 'deputy_rasap');
    $('#boss-hud').classList.remove('hidden');
    this.hud();
    UI.toast(G.touch ? '🥦 לאסוף אוכל בריא מהדשא · כפתור E — לזרוק' : '🥦 לאסוף אוכל בריא מהדשא · E — לזרוק');
  },

  // Co-op: pickup number n lies in the same spot for everyone (seeded by the fight id), and
  // one that anybody took is gone for everybody.
  coopPickup(n) {
    const id = this.coop.id % 1000003;
    const kinds = DATA.healthy;
    for (let g = 0; g < 40; g++) {
      const r = (k) => { const v = Math.sin(id * 0.0131 + n * 78.233 + g * 12.9898 + k * 4.1414) * 43758.5453; return v - Math.floor(v); };
      const x = BOSS_ARENA.x0 + r(1) * (BOSS_ARENA.x1 - BOSS_ARENA.x0);
      const y = BOSS_ARENA.y0 + 2 * TS + r(2) * (BOSS_ARENA.y1 - BOSS_ARENA.y0 - 2 * TS);
      if (World.blocked(x, y, 14)) continue;
      return { n, x, y, kind: kinds[Math.floor(r(3) * kinds.length)] };
    }
    return { n, x: 30 * TS, y: 19 * TS, kind: kinds[0] };
  },
  coopPickups() {
    for (const p of Multi.peers) if (p.boss && p.boss.id === this.coop.id) for (const n of p.boss.tk || []) this.taken.add(n);
    const out = [];
    for (let n = 0; out.length < Boss.PICKUPS && n < 5000; n++) if (!this.taken.has(n)) out.push(this.pickCache[n] || (this.pickCache[n] = this.coopPickup(n)));
    this.pickups = out;
  },

  spawnPickup() {
    const kinds = DATA.healthy;
    for (let guard = 0; guard < 40; guard++) {
      const x = BOSS_ARENA.x0 + Math.random() * (BOSS_ARENA.x1 - BOSS_ARENA.x0);
      const y = BOSS_ARENA.y0 + 2 * TS + Math.random() * (BOSS_ARENA.y1 - BOSS_ARENA.y0 - 2 * TS);
      if (World.blocked(x, y, 14) || Math.hypot(x - this.x, y - this.y) < 4 * TS) continue;
      this.pickups.push({ x, y, kind: kinds[Math.floor(Math.random() * kinds.length)] });
      return;
    }
  },

  update(dt) {
    if (!this.active) return;
    const P = G.player;
    const hurt = this.hp < this.max / 2;
    if (this.coop) {
      // Shared fight: everyone sees him in the same place (a path from the start time), and
      // his HP is what's left after the damage every player has dealt.
      const t = (Date.now() - this.coop.id) / 1000;
      this.x = 30 * TS + Math.sin(t / (hurt ? 2.2 : 3.4)) * 10 * TS;
      let peer = 0;
      for (const p of Multi.peers) if (p.boss && p.boss.id === this.coop.id) peer += p.boss.dmg;
      if (peer > this.peerDmg) { this.flash = 1; if (!this.bubble || this.bubble.t < 1) this.bubble = { text: pick(DATA.healthy).hit, t: 1.8 }; Sound.splat(); }
      this.peerDmg = Math.max(this.peerDmg, peer);
      this.hp = Math.max(0, this.max - this.myDmg - this.peerDmg);
      if (this.hp <= 0) { this.end(true); return; }
    } else {
      // He shuffles from side to side, faster when hurt.
      const speed = (hurt ? 75 : 45) * dt;
      this.x += this.dir * speed;
      if (this.x > 40 * TS) this.dir = -1;
      if (this.x < 20 * TS) this.dir = 1;
    }
    // Keep the player out of his bun.
    const dx = P.x - this.x, dy = P.y - this.y, d = Math.hypot(dx, dy);
    if (d < 2.6 * TS) { P.x = this.x + dx / (d || 1) * 2.6 * TS; P.y = this.y + dy / (d || 1) * 2.6 * TS; }
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    this.flash = Math.max(0, this.flash - dt * 3);

    this.tauntCd -= dt;
    if (this.tauntCd <= 0 && !this.bubble) { this.tauntCd = 7 + Math.random() * 5; this.bubble = { text: pick(BOSS_TAUNTS), t: 3.2 }; }

    // Cheeseburgers, aimed where the player is heading.
    this.throwCd -= dt;
    if (this.throwCd <= 0) {
      this.throwCd = (hurt ? 1.2 : 1.9) + Math.random() * 0.8;
      const n = hurt ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const lead = P.moving ? 0.6 : 0;
        const tx = P.x + Math.cos(P.angle) * (P.running ? 165 : 90) * lead + (i ? (Math.random() - 0.5) * 80 : 0);
        const ty = P.y + Math.sin(P.angle) * (P.running ? 165 : 90) * lead + (i ? (Math.random() - 0.5) * 80 : 0);
        this.burgers.push({ x0: this.x, y0: this.y, x1: tx, y1: ty, t: 0, dur: 1.15 });
        if (this.coop) this.fxLog.b.push({ t: Date.now(), x0: Math.round(this.x), y0: Math.round(this.y), x1: Math.round(tx), y1: Math.round(ty) });
      }
      Sound.whoosh();
    }
    for (const b of this.burgers) {
      b.t += dt;
      if (b.t >= b.dur && !b.done) {
        b.done = true;
        Sound.splat();
        if (Math.hypot(P.x - b.x1, P.y - b.y1) < 38) this.hitPlayer();
      }
    }
    this.burgers = this.burgers.filter(b => !b.done);

    // Healthy food flies at him.
    for (const s of this.shots) {
      const sx = this.x - s.x, sy = this.y - 0.5 * TS - s.y, sd = Math.hypot(sx, sy);
      const step = 520 * dt;
      s.t += dt;
      if (sd < step + 30) { s.done = true; this.hitBoss(s.kind); continue; }
      s.x += sx / sd * step;
      s.y += sy / sd * step;
    }
    this.shots = this.shots.filter(s => !s.done);
    if (!this.active) return;
    if (this.coop) this.updateRemoteFx();

    if (this.coop) this.coopPickups();
    for (const p of this.pickups) {
      if (Math.hypot(P.x - p.x, P.y - p.y) < 34) {
        p.taken = true;
        if (this.coop) { this.taken.add(p.n); this.myTaken.push(p.n); }
        this.ammo[p.kind.id] += 2;
        this.lastPick = p.kind.id;
        Sound.pickup();
        UI.toast(`${p.kind.icon} ${p.kind.name} ×2`, 'good');
      }
    }
    if (this.coop) this.coopPickups();
    else if (this.pickups.some(p => p.taken)) {
      this.pickups = this.pickups.filter(p => !p.taken);
      while (this.pickups.length < Boss.PICKUPS) this.spawnPickup();
    }
    this.hud();
  },

  // What this player threw in the last moment, for the others to draw.
  fxOut() {
    const now = Date.now();
    this.fxLog.s = this.fxLog.s.filter(o => now - o.t < 1600).slice(-8);
    this.fxLog.b = this.fxLog.b.filter(o => now - o.t < 1300).slice(-8);
    return { s: this.fxLog.s, b: this.fxLog.b };
  },
  // The other players' healthy food and the cheeseburgers thrown at them. Each item is timed
  // from when it first arrived here, so clocks that differ between phones don't matter.
  updateRemoteFx() {
    const now = performance.now();
    const shots = [], burgers = [], live = new Set();
    for (const p of Multi.peers) {
      if (!p.fx || !p.boss || p.boss.id !== this.coop.id || p.site !== 'hq') continue;
      for (const o of p.fx.s) {
        const key = p.peer + 's' + o.t;
        live.add(key);
        let r = this.remoteSeen.get(key);
        if (!r) { r = { first: now, x: o.x, y: o.y, sx: o.x, sy: o.y, kind: DATA.healthy.find(k => k.id === o.k) || DATA.healthy[0], t: 0 }; this.remoteSeen.set(key, r); }
        r.t = (now - r.first) / 1000;
        const bx = this.x, by = this.y - 0.5 * TS;
        const dur = Math.max(0.15, Math.hypot(bx - r.sx, by - r.sy) / 520);
        const k = Math.min(1, r.t / dur);
        r.x = r.sx + (bx - r.sx) * k;
        r.y = r.sy + (by - r.sy) * k;
        if (k < 1) shots.push(r);
      }
      for (const o of p.fx.b) {
        const key = p.peer + 'b' + o.t;
        live.add(key);
        let r = this.remoteSeen.get(key);
        if (!r) { r = { first: now, x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, t: 0, dur: 1.15 }; this.remoteSeen.set(key, r); }
        r.t = (now - r.first) / 1000;
        if (r.t < r.dur) burgers.push(r);
        else if (!r.splat) { r.splat = true; Sound.splat(); }
      }
    }
    for (const k of this.remoteSeen.keys()) if (!live.has(k)) this.remoteSeen.delete(k);
    this.remoteShots = shots;
    this.remoteBurgers = burgers;
  },

  // Multiplayer: wake the monster for everyone at HQ. The others join from the presence.
  // invite: started from the menu, so everyone online is asked to come, not only who's at HQ.
  async startCoop(invite = false) {
    const here = invite ? Multi.peers.length : Multi.peers.filter(p => p.site === 'hq').length;
    const coop = { id: Date.now(), max: 100 + 70 * here };
    await UI.cutscene([{ img: 'assets/boss2.jpg', who: '{@@deputy_rasap}', text: `${here ? 'כמה אתם? ' + (here + 1) + '?! ' : ''}אתם תסגרו 35, ואני אנפיץ אתכם!!! *שומשום... גבינה... רוטב אלף האיים...*` }]);
    this.start(coop);
  },
  // Called every frame in multiplayer: join a fight someone at HQ started, or hear about it.
  watchCoop() {
    if (!Multi.on || this.active || UI.busy || Mini.active || G.alert) return;
    const now = Date.now();
    this.doneIds = this.doneIds || new Set();
    this.heard = this.heard || new Set();
    const p = Multi.peers.find(q => q.boss && !this.doneIds.has(q.boss.id) && now - q.boss.id < 15 * 60000);
    if (!p) return;
    const id = p.boss.id;
    let dealt = 0;
    for (const q of Multi.peers) if (q.boss && q.boss.id === id) dealt += q.boss.dmg;
    if (dealt >= p.boss.max) { this.doneIds.add(id); return; }
    if (World.id === 'hq' && p.site === 'hq') {
      UI.toast(`🍔 ${p.name} העיר[/ה] את צ'יזבורגרו! לקרב!`, 'bad');
      this.start({ id, max: p.boss.max });
    } else if (!this.heard.has(id)) {
      this.heard.add(id);
      Sound.horn();
      UI.invite(`🍔 ${p.name} קורא לך לקרב בוס נגד צ'יזבורגרו בשו"ב!`, '⚔️ להצטרף עכשיו', () => this.joinCoop(id, p.boss.max));
    }
  },
  // Accepting an invite: straight to the arena (free) and into the same fight.
  joinCoop(id, max) {
    if (this.active || G.alert || Story.ctl) return;
    UI.fade(() => {
      if (World.id !== 'hq') { if (G.player.carry) G.player.carry = false; Game.switchMap('hq'); }
      this.start({ id, max });
      UI.toast('⚔️ הצטרפת לקרב! לאסוף אוכל בריא ולזרוק', 'good');
    });
  },
  // From the menu: invite everyone online and wake the monster at HQ.
  inviteCoop() {
    if (this.active || G.alert || Story.ctl) { UI.toast('לא עכשיו', 'bad'); return; }
    UI.fade(() => {
      if (World.id !== 'hq') { if (G.player.carry) G.player.carry = false; Game.switchMap('hq'); }
      this.startCoop(true);
    });
  },

  // Throw whatever healthy food you have most of (E / the action button).
  throw() {
    const kinds = DATA.healthy.filter(k => this.ammo[k.id] > 0).sort((a, b) => this.ammo[b.id] - this.ammo[a.id]);
    if (!kinds.length) { UI.toast('אין תחמושת בריאה! לאסוף ברוקולי, פריכיות וחטיפי חלבון', 'bad'); return; }
    const k = kinds[0];
    this.ammo[k.id]--;
    this.shots.push({ x: G.player.x, y: G.player.y, kind: k, t: 0 });
    if (this.coop) this.fxLog.s.push({ t: Date.now(), x: Math.round(G.player.x), y: Math.round(G.player.y), k: k.id });
    Sound.whoosh();
  },

  hitBoss(kind) {
    if (!this.active) return;
    const dmg = { protein: 10, ricecake: 8, broccoli: 9, carrot: 8, apple: 9, cucumber: 7 }[kind.id] || 8;
    this.myDmg += dmg;
    this.hp = Math.max(0, this.max - this.myDmg - this.peerDmg);
    this.flash = 1;
    this.bubble = { text: kind.hit, t: 2.2 };
    Sound.splat();
    G.shake = 0.25;
    if (this.hp <= 0) this.end(true);
  },

  hitPlayer() {
    this.chol = Math.min(100, this.chol + 20);
    G.shake = 0.4;
    UI.toast('🍔 צ\'יזבורגר בפרצוף! כולסטרול +20', 'bad');
    if (this.chol < 100) return;
    this.chol = 30;
    UI.toast(fmt('🚑 {@medic1}: כולסטרול מאה?! [שתה/שתי] מים ו[תחזור/תחזרי] לקרב'), 'bad');
  },

  hud() {
    const h = $('#boss-hud');
    if (!h) return;
    const ammo = DATA.healthy.map(k => `<span class="ammo">${k.icon} ${this.ammo[k.id]}</span>`).join('');
    const team = this.coop ? Multi.peers.filter(p => p.boss && p.boss.id === this.coop.id).length + 1 : 1;
    const pct = Math.max(0, Math.round(this.hp / this.max * 100));
    h.innerHTML = `<div class="boss-top"><span class="boss-name">🍔 ${this.NAME}</span><div class="boss-bar"><b style="width:${pct}%"></b></div><span class="boss-pct">${pct}%</span>${team > 1 ? `<span class="boss-team">👥${team}</span>` : ''}</div>
      <div class="boss-row"><span>🩸</span><div class="chol-bar${this.chol >= 70 ? ' hot' : ''}"><b style="width:${this.chol}%"></b></div>${ammo}</div>`;
  },

  async end(win) {
    this.active = false;
    if (this.coop) {
      (this.doneIds = this.doneIds || new Set()).add(this.coop.id);
      $('#boss-hud').classList.add('hidden');
      this.burgers = []; this.shots = []; this.pickups = []; this.remoteShots = []; this.remoteBurgers = [];
      const team = Multi.peers.filter(p => p.boss && p.boss.id === this.coop.id).map(p => p.name);
      await UI.cutscene([{ img: 'assets/boss3.jpg', who: '', text: `ניצחתם ביחד! ${team.length ? team.join(', ') + ' ו־' + fmt('{name}') : fmt('{name}')} — סיבים תזונתיים, מזון לא מעובד ודל סוכר. צ'יזבורגרו מתכווץ בחזרה ל{@deputy_rasap}.` }]);
      await UI.talk([{ who: 'deputy_rasap', text: '*יושב על הדשא* ...אתם כמה, ואני אחד. זה לא הוגן. ...זה סלט? אני מרגיש סלט.' }]);
      Game.achieve('boss');
      Game.addScore(15, 'קרב בוס משותף');
      this.coop = null;
      Game.resetNpcs();
      return;
    }
    $('#boss-hud').classList.add('hidden');
    this.burgers = [];
    this.shots = [];
    this.pickups = [];
    this.remoteShots = [];
    this.remoteBurgers = [];
    await UI.cutscene([
      { img: 'assets/boss3.jpg', who: '', text: 'סיבים תזונתיים, מזון לא מעובד ודל סוכר... צ\'יזבורגרו מתכווץ, מתכווץ... ונשאר רק {@deputy_rasap}, יושב על הדשא עם שומשום על הכתפיים.' },
    ]);
    await UI.talk([
      { who: 'deputy_rasap', text: '*מוריד משקפי שמש לאט* ...אני מרגיש קליל. זה סלט? אני מרגיש... סלט.' },
      { who: 'deputy_rasap', text: 'הנה המנעול. האחרון בסוללה. ואל תספר[/י] ל{@rasap} על הארונית. ...או על המפלצת.' },
      { who: 'rasap', text: 'אני יודעת על הארונית מנובמבר 25. חתמת עליה?' },
    ]);
    Game.achieve('boss');
    Story.complete('boss', 20, 'ניצחת את צ\'יזבורגרו');
    Game.resetNpcs();
    UI.toast('🔒 קיבלת את המנעול! לנסוע לנתיבות ולנעול את השער', 'good');
  },
};
