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

  start() {
    this.active = true;
    this.hp = 100;
    this.chol = 0;
    this.ammo = { broccoli: 0, ricecake: 0, protein: 0 };
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
    for (let i = 0; i < 4; i++) this.spawnPickup();
    G.player.x = 30 * TS;
    G.player.y = 20.5 * TS;
    G.player.carry = false;
    Scene3D.yaw = 0;
    // Everyone else at HQ clears the arena and watches from the edges.
    G.npcs.forEach((n, i) => { n.x = n.spot.x = (6 + (i % 12) * 4.5) * TS; n.y = n.spot.y = (i < 12 ? 23.6 : 12.4) * TS; n.path = []; n.wander = null; });
    G.npcs = G.npcs.filter(n => n.id !== 'deputy_rasap');
    $('#boss-hud').classList.remove('hidden');
    this.hud();
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
    // He shuffles from side to side, faster when hurt.
    const speed = (this.hp < 50 ? 75 : 45) * dt;
    this.x += this.dir * speed;
    if (this.x > 40 * TS) this.dir = -1;
    if (this.x < 20 * TS) this.dir = 1;
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
      this.throwCd = (this.hp < 50 ? 1.2 : 1.9) + Math.random() * 0.8;
      const n = this.hp < 50 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const lead = P.moving ? 0.6 : 0;
        const tx = P.x + Math.cos(P.angle) * (P.running ? 165 : 90) * lead + (i ? (Math.random() - 0.5) * 80 : 0);
        const ty = P.y + Math.sin(P.angle) * (P.running ? 165 : 90) * lead + (i ? (Math.random() - 0.5) * 80 : 0);
        this.burgers.push({ x0: this.x, y0: this.y, x1: tx, y1: ty, t: 0, dur: 1.15 });
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

    for (const p of this.pickups) {
      if (Math.hypot(P.x - p.x, P.y - p.y) < 34) {
        p.taken = true;
        this.ammo[p.kind.id] += 2;
        this.lastPick = p.kind.id;
        Sound.pickup();
        UI.toast(`${p.kind.icon} ${p.kind.name} ×2`, 'good');
      }
    }
    if (this.pickups.some(p => p.taken)) {
      this.pickups = this.pickups.filter(p => !p.taken);
      while (this.pickups.length < 4) this.spawnPickup();
    }
    this.hud();
  },

  // Throw whatever healthy food you have most of (E / the action button).
  throw() {
    const kinds = DATA.healthy.filter(k => this.ammo[k.id] > 0).sort((a, b) => this.ammo[b.id] - this.ammo[a.id]);
    if (!kinds.length) { UI.toast('אין תחמושת בריאה! לאסוף ברוקולי, פריכיות וחטיפי חלבון', 'bad'); return; }
    const k = kinds[0];
    this.ammo[k.id]--;
    this.shots.push({ x: G.player.x, y: G.player.y, kind: k, t: 0 });
    Sound.whoosh();
  },

  hitBoss(kind) {
    if (!this.active) return;
    this.hp = Math.max(0, this.hp - (kind.id === 'protein' ? 10 : kind.id === 'ricecake' ? 8 : 9));
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
    UI.talk([
      { who: 'medic1', text: 'כולסטרול מאה?! [שתה/שתי] מים. [תאכל/תאכלי] מלפפון. ו[תחזור/תחזרי] לקרב.' },
      { who: 'medic2', text: 'שמתי לך פלסטר על העורק. זה עוזר. בערך.' },
    ]);
  },

  hud() {
    const h = $('#boss-hud');
    if (!h) return;
    const ammo = DATA.healthy.map(k => `<span class="ammo">${k.icon} ${this.ammo[k.id]}</span>`).join('');
    h.innerHTML = `<div class="boss-name">🍔 ${fmt('{@deputy_rasap}')} — מפלצת הצ'יזבורגר</div>
      <div class="boss-bar"><b style="width:${this.hp}%"></b></div>
      <div class="boss-row"><span>כולסטרול</span><div class="chol-bar"><b style="width:${this.chol}%"></b></div>${ammo}</div>
      <div class="boss-hint">${G.touch ? 'כפתור E — לזרוק' : 'E — לזרוק'} · לאסוף אוכל בריא מהדשא</div>`;
  },

  async end(win) {
    this.active = false;
    $('#boss-hud').classList.add('hidden');
    this.burgers = [];
    this.shots = [];
    this.pickups = [];
    await UI.cutscene([
      { img: 'assets/boss3.jpg', who: '', text: 'סיבים תזונתיים, מזון לא מעובד ודל סוכר... המפלצת מתכווצת, מתכווצת... ונשאר רק {@deputy_rasap}, יושב על הדשא עם שומשום על הכתפיים.' },
    ]);
    await UI.talk([
      { who: 'deputy_rasap', text: '*מוריד משקפי שמש לאט* ...אני מרגיש קליל. זה סלט? אני מרגיש... סלט.' },
      { who: 'deputy_rasap', text: 'הנה המנעול. האחרון בסוללה. ואל תספר[/י] ל{@rasap} על הארונית. ...או על המפלצת.' },
      { who: 'rasap', text: 'אני יודעת על הארונית מנובמבר 25. חתמת עליה?' },
    ]);
    Game.achieve('boss');
    Story.complete('boss', 20, 'ניצחת את מפלצת הצ\'יזבורגר');
    Game.resetNpcs();
    UI.toast('🔒 קיבלת את המנעול! לנסוע לנתיבות ולנעול את השער', 'good');
  },
};
