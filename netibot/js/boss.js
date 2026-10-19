// Final boss: the deputy rasap turned into a giant cheeseburger monster. He throws
// cheeseburgers; the player picks up healthy food around the arena and throws it back.
const BOSS_TAUNTS = [
  'אתם תסגרו 35, ואני אנפיץ אתכם!',
  'עוד צ\'יזבורגר? יש לי מלאי עד השחרור!',
  'בזמני — לפני ארבעה חודשים — אכלנו שמנת לארוחת בוקר!',
  'קלוריות זה כוח! כוח זה פז"ם!',
  'המנעול שלי! כמו כל החטיפים בסוללה!',
];
// His lines, recorded in a monster voice (ElevenLabs). Index matches BOSS_TAUNTS.
const BOSS_VOICE = 'assets/audio/boss/';
const BOSS_TAUNT_VOICE = ['intro', 'taunt2', 'taunt3', 'taunt4', 'taunt5'];
const BOSS_ARENA = { x0: 15 * TS, x1: 45 * TS, y0: 13.5 * TS, y1: 21 * TS };

// Every boss shares the same fight: pick up what hurts them, throw it back, dodge what they
// throw. The cheeseburger at HQ is the story's; the other two come out of events.
const BOSSES = {
  burger: {
    map: 'hq', arena: BOSS_ARENA, icon: '🍔', name: () => "צ'יזבורגרו", npc: 'deputy_rasap', ammo: () => DATA.healthy,
    taunts: BOSS_TAUNTS, voice: true, throws: 'burger', meter: 'כולסטרול', hp: 140, hitDmg: 22,
    hitMe: '🍔 צ\'יזבורגר בפרצוף!', full: '🚑 {@medic1}: כולסטרול מאה?! [שתה/שתי] מים ו[תחזור/תחזרי] לקרב',
  },
  // The battery commander, after p_liran told her what he reads on guard.
  baum: {
    map: 'netivot', arena: { x0: 23.5 * TS, x1: 34.5 * TS, y0: 21.5 * TS, y1: 29 * TS }, icon: '📚', name: () => fmt('{@@bc}'), npc: 'bc', ammo: () => DATA.mizrahi,
    taunts: ['ספר?! בשמירה?! בשמירה קוראים את הגדר!', 'אצלי בסוללה קוראים רק נהלים. בעמידה.', 'גפילטע פיש! בתאבון, {platoon}!', 'תכבו את המוזיקה הזאת! שימו שופן!', 'באקסל שלי אין עמודה לגרעינים!'],
    throws: 'gefilte', meter: 'גפילטע', hp: 150, hitDmg: 22,
    hitMe: '🐟 גפילטע פיש בפרצוף!', full: '🥴 יותר מדי גפילטע... {@p_shaked} מביאה לך פיתה עם חריף: "[תאכל/תאכלי], פוצ׳". [תחזור/תחזרי] לקרב!',
  },
  // The battery sergeant major, who found one too many things wrong with your uniform.
  harasar: {
    map: 'hq', arena: BOSS_ARENA, icon: '👀', name: () => fmt('{@@harasar}'), npc: 'harasar', ammo: () => DATA.uniform,
    taunts: ['מי בלי חוגר?!', 'אני רואה חול על הנעליים שלך מפה!', 'זקן! אני רואה זקן! תגזור[/י]!', 'דום! גם הדשא בדום!', 'שלושה ימי ריתוק! לכולם! עכשיו!'],
    throws: 'report', meter: 'דו"חות', hp: 140, hitDmg: 22,
    hitMe: '📋 דו"ח תלבושת!', full: '📋 חמישה דו"חות! {@sarsap} חותם[/ת] לך על מחילה. [תחזור/תחזרי] לקרב!',
  },
  // The HQ's operations clerk, who talked for three hours straight and grew hawk wings. She
  // shoots a laser of sentences and screeches like a hawk; ritalin, a sedative and a dog
  // muzzle bring her down. Her lines are recorded (ElevenLabs) and travel encrypted with the
  // cast (ROSTER.audio), since they name the platoon.
  bar: {
    map: 'hq', arena: BOSS_ARENA, icon: '🦅', name: () => fmt('{@@hamalist}'), npc: 'hamalist', ammo: () => DATA.calm,
    taunts: ['הוא סבבה והכל... אבל הוא מ{platoon}!', 'ואז היא אמרה לה שהוא אמר לו שבכלל זה היה ביום שלישי... רגע, על מה דיברנו?!', 'שתיתי רק ארבעה קפה!!! אני ממש רגועה!!!', 'יש לי שלושה מסכים בחמ"ל ושלושה נושאים במקביל!!!', 'מי צריך שקט כשיש אותי?!', 'בלה בלה בלה — ואז — בלה!!!'],
    voices: ['bar_gutman', 'bar_rant'], throws: 'words', meter: 'כאב ראש', hp: 150, screech: true,
    hitMe: '🗯️ לייזר של משפטים!', hitDmg: 9, full: '🤯 יותר מדי מילים! {@medic1} מביאה לך מים ואטמי אוזניים. [תחזור/תחזרי] לקרב!',
  },
};
// What they say when you go down, and when they win and dance.
const BOSS_KO = {
  burger: ['עוד מנה? יש לי מלאי!', 'כולסטרול מאה! ואני רק התחלתי!', 'שומשום על הקבר שלך!'],
  baum: ['לא היית בתרגיל? עכשיו היית.', 'גפילטע פיש — ואת[ה/] על הרצפה!', 'נרשם באקסל: נפל[/ה].'],
  harasar: ['שכיבות סמיכה! ...אה, את[ה/] כבר שוכב[/ת].', 'דו"ח! על השכיבה בלי אישור!', 'קום[/י]! ...לא? טוב, דו"ח.'],
  bar: ['רגע, נפלת?! לא סיימתי לספר לך!!!', 'ואז הוא נפל, ואז אני אמרתי...', 'קיייי! עוד אחד!!!'],
};
const BOSS_WIN = {
  burger: "חחחח! צ'יזבורגרו מנצח! הארונית שלי, הבמבה שלי, הסוללה שלי!",
  baum: 'שלוש פעמים על הרצפה. זה ייכנס לסיכום השבועי. עם גרף.',
  harasar: 'שלוש נפילות! שלושה ימי ריתוק! ...ועכשיו תסתכל[/י] איך רוקדים בתלבושת מלאה.',
  bar: 'ניצחתי!!! אני חייבת לספר לכולם!!! לכו-לם!!! ואז אני אספר להם שסיפרתי!!!',
};
// Who turns into which boss: talking to them online offers a fight for everyone.
const BOSS_OF = { deputy_rasap: 'burger', bc: 'baum', harasar: 'harasar', hamalist: 'bar' };
const BOSS_DARE = {
  burger: '*מוריד משקפי שמש לאט* ...אתם רוצים לראות את הצד השני שלי? את הצד עם השומשום?',
  baum: 'ביקורת? אני אתן לכם ביקורת. לכולכם. ביחד. תביאו את כל הפלגה.',
  harasar: 'ביקורת תלבושת קבוצתית? אני אוהב קבוצות. יותר אנשים — יותר דו"חות.',
  bar: 'כולם רוצים לשמוע אותי?!?! וואו!!! תקראו לכולם!!! יש לי כל כך הרבה מה להגיד!!!',
};
// What her sentence laser is made of.
const BOSS_WORDS = ['בלה בלה', 'ואז היא אמרה', 'רגע רגע רגע', 'סבבה והכל', 'אבל!!!', 'קפה?!', 'בקיצור...', 'לא, רגע', 'שמעת?!', '#@!?', 'יאללה יאללה', 'מה?!', 'ש־ק־ט', 'וואאאו!!!', 'אמרתי לך!'];

const Boss = {
  active: false,
  PICKUPS: 9, // healthy food lying around the arena at any time
  NAME: "צ'יזבורגרו",

  // coop: { id, max } when the fight is shared with the other players in the lobby.
  start(coop = null, kind = 'burger') {
    const cfg = this.cfg = BOSSES[kind];
    this.kind = kind;
    this.arena = cfg.arena;
    this.NAME = cfg.name();
    this.fem = kind !== 'burger' && !!(Cast.get(cfg.npc) || {}).female;
    this.cx = (cfg.arena.x0 + cfg.arena.x1) / 2;
    this.span = (cfg.arena.x1 - cfg.arena.x0) / 3;
    this.active = true;
    this.coop = coop;
    this.max = coop ? coop.max : cfg.hp || 100;
    this.hp = this.max;
    this.myDmg = 0;
    this.peerDmg = 0;
    this.fxLog = { s: [], b: [] };
    this.remoteShots = [];
    this.remoteBurgers = [];
    this.remoteSeen = new Map();
    // The player's own life: 100 HP and three lives. Lose all three and the boss wins.
    this.life = 100;
    this.deaths = 0;
    this.dead = 0;
    this.inv = 0;
    this.victory = 0;
    this.slam = null;
    this.slamCd = 9;
    this.enraged = false;
    document.body.classList.add('boss-fight');
    this.ammo = Object.fromEntries(cfg.ammo().map(k => [k.id, 0]));
    this.pickups = [];
    this.shots = [];
    this.burgers = [];
    this.x = this.cx;
    this.y = cfg.arena.y0 + 2.1 * TS;
    this.dir = 1;
    this.throwCd = 2.5;
    this.tauntCd = 4;
    this.flash = 0;
    this.bubble = { text: fmt(cfg.taunts[0]), t: 3.5 };
    this.hurtCd = 3;
    this.screech = null;
    this.screechCd = 8;
    if (cfg.voices) this.taunt(0);
    if (cfg.voice && !(Date.now() - (this.introAt || 0) < 15000)) Sound.voice(BOSS_VOICE + 'intro.mp3');
    this.lastPick = cfg.ammo()[0].id;
    if (coop) { this.taken = new Set(); this.myTaken = []; this.pickCache = {}; this.coopPickups(); }
    else for (let i = 0; i < Boss.PICKUPS; i++) this.spawnPickup();
    if (!coop) BossArcs.apply(kind);
    G.player.x = this.cx;
    G.player.y = cfg.arena.y1 - 0.5 * TS;
    G.player.carry = false;
    Scene3D.yaw = 0;
    // Everyone else at HQ clears the arena and watches from the edges.
    if (cfg.map === 'hq') G.npcs.forEach((n, i) => { n.x = n.spot.x = (6 + (i % 12) * 4.5) * TS; n.y = n.spot.y = (i < 12 ? 23.6 : 12.4) * TS; n.path = []; n.wander = null; });
    else G.npcs.forEach((n, i) => { n.x = n.spot.x = (i % 2 ? 35.6 : 22.4) * TS; n.y = n.spot.y = (22 + Math.floor(i / 2) * 1.1) * TS; n.path = []; n.wander = null; });
    G.npcs = G.npcs.filter(n => n.id !== cfg.npc);
    $('#boss-hud').classList.remove('hidden');
    this.hud();
    const a = cfg.ammo();
    UI.toast(`${a[0].icon} לאסוף ${a.map(k => k.name).join(', ')} · ${G.touch ? 'כפתור E' : 'E'} — לזרוק`);
  },

  // Co-op: pickup number n lies in the same spot for everyone (seeded by the fight id), and
  // one that anybody took is gone for everybody.
  coopPickup(n) {
    const id = this.coop.id % 1000003;
    const kinds = this.cfg.ammo();
    for (let g = 0; g < 40; g++) {
      const r = (k) => { const v = Math.sin(id * 0.0131 + n * 78.233 + g * 12.9898 + k * 4.1414) * 43758.5453; return v - Math.floor(v); };
      const A = this.arena;
      const x = A.x0 + r(1) * (A.x1 - A.x0);
      const y = A.y0 + 2 * TS + r(2) * (A.y1 - A.y0 - 2 * TS);
      if (World.blocked(x, y, 14)) continue;
      return { n, x, y, kind: kinds[Math.floor(r(3) * kinds.length)] };
    }
    return { n, x: this.cx, y: this.arena.y1 - 2 * TS, kind: kinds[0] };
  },
  coopPickups() {
    for (const p of Multi.peers) if (p.boss && p.boss.id === this.coop.id) for (const n of p.boss.tk || []) this.taken.add(n);
    const out = [];
    for (let n = 0; out.length < Boss.PICKUPS && n < 5000; n++) if (!this.taken.has(n)) out.push(this.pickCache[n] || (this.pickCache[n] = this.coopPickup(n)));
    this.pickups = out;
  },

  spawnPickup() {
    const kinds = this.cfg.ammo(), A = this.arena;
    for (let guard = 0; guard < 40; guard++) {
      const x = A.x0 + Math.random() * (A.x1 - A.x0);
      const y = A.y0 + 2 * TS + Math.random() * (A.y1 - A.y0 - 2 * TS);
      if (World.blocked(x, y, 14) || Math.hypot(x - this.x, y - this.y) < 4 * TS) continue;
      this.pickups.push({ x, y, kind: kinds[Math.floor(Math.random() * kinds.length)] });
      return;
    }
  },

  update(dt) {
    if (!this.active) return;
    const P = G.player;
    if (this.victory) { this.updateVictory(dt); return; }
    this.inv = Math.max(0, this.inv - dt);
    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) this.respawn();
    }
    const hurt = this.hp < this.max / 2;
    // Below a quarter they lose it: faster, more of everything.
    if (!this.enraged && this.hp < this.max * 0.25 && this.hp > 0) {
      this.enraged = true;
      this.bubble = { text: 'עכשיו זה אישי!!! 😡', t: 2.2 };
      UI.toast(`😡 ${this.NAME} בטירוף! הכל מהר יותר`, 'bad');
      Sound.horn();
    }
    if (this.coop) {
      // Shared fight: everyone sees him in the same place (a path from the start time), and
      // his HP is what's left after the damage every player has dealt.
      const t = (Date.now() - this.coop.id) / 1000;
      this.x = this.cx + Math.sin(t / (hurt ? 2.0 : 3.2)) * this.span;
      let peer = 0;
      for (const p of Multi.peers) if (p.boss && p.boss.id === this.coop.id) peer += p.boss.dmg;
      if (peer > this.peerDmg) { this.flash = 1; if (!this.bubble || this.bubble.t < 1) this.bubble = { text: pick(this.cfg.ammo()).hit, t: 1.8 }; Sound.splat(); }
      this.peerDmg = Math.max(this.peerDmg, peer);
      this.hp = Math.max(0, this.max - this.myDmg - this.peerDmg);
      if (this.hp <= 0) { this.end(true); return; }
    } else {
      // He shuffles from side to side, faster when hurt.
      const speed = (this.enraged ? 105 : hurt ? 80 : 50) * dt;
      this.x += this.dir * speed;
      if (this.x > this.cx + this.span) this.dir = -1;
      if (this.x < this.cx - this.span) this.dir = 1;
    }
    // Keep the player out of his bun.
    const dx = P.x - this.x, dy = P.y - this.y, d = Math.hypot(dx, dy);
    if (d < 2.6 * TS) { P.x = this.x + dx / (d || 1) * 2.6 * TS; P.y = this.y + dy / (d || 1) * 2.6 * TS; }
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    this.flash = Math.max(0, this.flash - dt * 3);

    this.tauntCd -= dt;
    if (this.tauntCd <= 0 && !this.bubble) { this.tauntCd = 7 + Math.random() * 5; this.taunt(1 + Math.floor(Math.random() * (this.cfg.taunts.length - 1))); }
    this.hurtCd -= dt;

    // Cheeseburgers, aimed where the player is heading.
    this.throwCd -= dt;
    if (this.throwCd <= 0) {
      this.throwCd = (this.enraged ? 0.8 : hurt ? 1.05 : 1.5) + Math.random() * 0.6;
      const words = this.cfg.throws === 'words';
      // Her laser is a quick straight burst of sentences in a row.
      const n = words ? (this.enraged ? 5 : hurt ? 4 : 3) : this.enraged ? 3 : hurt ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const lead = P.moving ? 0.75 : 0;
        const spread = words ? 26 : 80;
        const tx = P.x + Math.cos(P.angle) * (P.running ? 165 : 90) * lead + (i ? (Math.random() - 0.5) * spread : 0);
        const ty = P.y + Math.sin(P.angle) * (P.running ? 165 : 90) * lead + (i ? (Math.random() - 0.5) * spread : 0);
        if (words) { this.burgers.push({ x0: this.x, y0: this.y, x1: tx, y1: ty, t: -i * 0.14, dur: 0.6, text: pick(BOSS_WORDS) }); continue; }
        this.burgers.push({ x0: this.x, y0: this.y, x1: tx, y1: ty, t: 0, dur: 1.15 });
        if (this.coop) this.fxLog.b.push({ t: Date.now(), x0: Math.round(this.x), y0: Math.round(this.y), x1: Math.round(tx), y1: Math.round(ty) });
      }
      if (words) Sound.zap(); else Sound.whoosh();
    }
    for (const b of this.burgers) {
      b.t += dt;
      if (b.t >= b.dur && !b.done) {
        b.done = true;
        if (b.text) Sound.pop(); else Sound.splat();
        if (Math.hypot(P.x - b.x1, P.y - b.y1) < 38) this.hitPlayer();
      }
    }
    this.burgers = this.burgers.filter(b => !b.done);
    if (this.cfg.screech) this.updateScreech(dt, hurt);
    else this.updateSlam(dt, hurt);

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

  // The hawk's cry: she rears up for a moment (time to get away), then it spreads 6 tiles out.
  updateScreech(dt, hurt) {
    const P = G.player;
    if (!this.screech) {
      this.screechCd -= dt;
      if (this.screechCd > 0) return;
      this.screech = { t: 0, x: this.x, y: this.y, r: 0 };
      this.bubble = { text: 'קיייייייייי!!! 🦅', t: 1.6 };
      Sound.screech();
      if (!this.warned) { this.warned = true; UI.toast('🦅 היא עומדת לשאוג — [תתרחק/תתרחקי] ממנה!', 'bad'); }
      return;
    }
    const s = this.screech;
    s.t += dt;
    if (s.t > 0.9) s.r = Math.min(1, (s.t - 0.9) / 0.5) * 6 * TS;
    if (!s.hit && s.r > 0 && Math.hypot(P.x - s.x, P.y - s.y) < s.r) { s.hit = true; this.hitPlayer('🦅 שאגת נץ! האוזניים מצפצפות', 30); }
    if (s.t > 1.6) { this.screech = null; this.screechCd = (hurt ? 6 : 9) + Math.random() * 3; }
  },

  // The others' heavy attack: they mark the spot where you stand (a red circle on the grass),
  // and a moment later something huge lands there. Keep moving.
  updateSlam(dt, hurt) {
    const P = G.player;
    if (!this.slam) {
      this.slamCd -= dt;
      if (this.slamCd > 0 || this.dead > 0) return;
      this.slam = { t: 0, x: P.x, y: P.y, r: 0, R: 3.2 * TS, warn: 1.15, slam: true };
      this.bubble = { text: { burger: 'גוש גבינה מלמעלה!!!', baum: 'קלסר נהלים!!!', harasar: 'פנקס דו"חות ענק!!!' }[this.kind] || '!!!', t: 1.4 };
      Sound.whoosh();
      if (!this.slamWarned) { this.slamWarned = true; UI.toast('🔴 עיגול אדום על הרצפה — לברוח ממנו, מהר!', 'bad'); }
      return;
    }
    const s = this.slam;
    s.t += dt;
    if (s.t >= s.warn && !s.hit) {
      s.hit = true;
      s.r = s.R;
      Sound.boom();
      G.shake = Math.max(G.shake || 0, 0.35);
      if (Math.hypot(P.x - s.x, P.y - s.y) < s.R) this.hitPlayer(this.cfg.slamHit || '💥 בום! ישר עליך!', 34);
    }
    if (s.t > s.warn + 0.45) { this.slam = null; this.slamCd = (this.enraged ? 4.5 : hurt ? 6 : 8.5) + Math.random() * 2.5; }
  },

  // Down: a moment on the grass, then back at the edge of the arena with a few seconds' cover.
  die() {
    this.deaths++;
    this.dead = 2.4;
    this.life = 0;
    G.shake = 0.8;
    Sound.bad();
    Sound.boom();
    G.player.carry = false;
    const left = 3 - this.deaths;
    this.bubble = { text: fmt(pick(BOSS_KO[this.kind] || BOSS_KO.burger)), t: 2.4 };
    if (left <= 0) { this.lose(); return; }
    UI.toast(`💀 [נפלת/נפלת]! ${left === 1 ? 'נשאר לך ❤️ אחרון' : 'נשארו לך עוד ' + left + ' ❤️'} — חוזר[/ת] לקרב עוד רגע`, 'bad');
    this.hud();
  },
  respawn() {
    this.dead = 0;
    this.life = 100;
    this.inv = 3;
    this.burgers = [];
    const P = G.player;
    P.x = this.cx + (Math.random() - 0.5) * this.span;
    P.y = this.arena.y1 - 0.5 * TS;
    P.vx = P.vy = 0;
    Sound.good();
    UI.toast('❤️ [חזרת/חזרת] לקרב! שלוש שניות של חסינות', 'good');
  },
  // Three times down: the boss wins and dances it in, then the fight's over.
  lose() {
    this.victory = 6.5;
    this.burgers = [];
    this.shots = [];
    this.screech = null;
    this.slam = null;
    this.bubble = { text: fmt(BOSS_WIN[this.kind] || BOSS_WIN.burger), t: 6.5 };
    Sound.stopVoice && Sound.stopVoice();
    Sound.fanfare();
    UI.toast(`☠️ שלוש נפילות — ${this.NAME} ${this.fem ? 'ניצחה' : 'ניצח'}... וזה ריקוד הניצחון`, 'bad');
    this.hud();
  },
  updateVictory(dt) {
    this.victory = Math.max(0, this.victory - dt);
    this.flash = 0;
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    // The camera turns to face them while they dance.
    const P = G.player;
    const want = Math.atan2(-(this.x - P.x), -(this.y - P.y));
    Scene3D.yaw += Math.atan2(Math.sin(want - Scene3D.yaw), Math.cos(want - Scene3D.yaw)) * Math.min(1, dt * 2);
    this.hud();
    if (this.victory <= 0) this.end(false);
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
      if (!p.fx || !p.boss || p.boss.id !== this.coop.id || p.site !== this.cfg.map) continue;
      for (const o of p.fx.s) {
        const key = p.peer + 's' + o.t;
        live.add(key);
        let r = this.remoteSeen.get(key);
        if (!r) { const am = this.cfg.ammo(); r = { first: now, x: o.x, y: o.y, sx: o.x, sy: o.y, kind: am.find(k => k.id === o.k) || am[0], t: 0 }; this.remoteSeen.set(key, r); }
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
        if (!r) { const words = this.cfg.throws === 'words'; r = { first: now, x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, t: 0, dur: words ? 0.6 : 1.15, text: words ? pick(BOSS_WORDS) : null }; this.remoteSeen.set(key, r); }
        r.t = (now - r.first) / 1000;
        if (r.t < r.dur) burgers.push(r);
        else if (!r.splat) { r.splat = true; Sound.splat(); }
      }
    }
    for (const k of this.remoteSeen.keys()) if (!live.has(k)) this.remoteSeen.delete(k);
    this.remoteShots = shots;
    this.remoteBurgers = burgers;
  },

  // Multiplayer: wake a boss for everyone at its site. The others join from the presence.
  // invite: asked for (the menu, or talking to the boss), so everyone online is called in.
  async startCoop(invite = false, kind = 'burger') {
    const cfg = BOSSES[kind];
    const here = invite ? Multi.peers.length : Multi.peers.filter(p => p.site === cfg.map).length;
    const coop = { id: Date.now(), max: (cfg.hp || 100) + 90 * here };
    this.introAt = Date.now();
    if (kind === 'burger') await UI.cutscene([{ img: 'assets/boss2.jpg', voice: BOSS_VOICE + 'intro.mp3', who: '{@@deputy_rasap}', text: `${here ? 'כמה אתם? ' + (here + 1) + '?! ' : ''}אתם תסגרו 35, ואני אנפיץ אתכם!!! *שומשום... גבינה... רוטב אלף האיים...*` }]);
    else await this.intro(kind, { skipIntro: true });
    this.start(coop, kind);
    if (here) UI.toast(`👥 הזמנה נשלחה ל־${here} שחקנים — הם מצטרפים מכל מקום`, 'good');
  },
  // Talking to someone who turns into a boss, online: fight them with everyone, or just talk.
  async offerCoop(n) {
    const kind = BOSS_OF[n.id];
    if (!kind || !Multi.on || this.active || G.alert || Story.ctl) return false;
    const v = await UI.talk([{ who: n.id, text: BOSS_DARE[kind], choices: [{ label: `⚔️ קרב בוס אונליין — להזמין את כולם (${Multi.peers.length})`, value: 1 }, { label: '💬 לדבר', value: 0 }] }]);
    if (!v) return false;
    this.inviteCoop(kind);
    return true;
  },
  // Called every frame in multiplayer: join a fight someone started here, or hear about it.
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
    const kind = BOSSES[p.boss.k] ? p.boss.k : 'burger', cfg = BOSSES[kind], name = cfg.name();
    if (World.id === cfg.map && p.site === cfg.map) {
      UI.toast(`${cfg.icon} קרב בוס נגד ${name}! ${p.name} כבר בפנים — לקרב!`, 'bad');
      this.start({ id, max: p.boss.max }, kind);
    } else if (!this.heard.has(id)) {
      this.heard.add(id);
      Sound.horn();
      UI.invite(`${cfg.icon} ${p.name}: קרב בוס נגד ${name} ב${siteName(cfg.map)}! בואו ביחד`, '⚔️ להצטרף עכשיו', () => this.joinCoop(id, p.boss.max, kind));
    }
  },
  // Accepting an invite: straight to the arena (free) and into the same fight.
  joinCoop(id, max, kind = 'burger') {
    if (this.active || G.alert || Story.ctl || Race.active) return;
    const cfg = BOSSES[kind];
    UI.fade(() => {
      if (World.id !== cfg.map) { if (G.player.carry) G.player.carry = false; Game.switchMap(cfg.map); }
      this.start({ id, max }, kind);
      UI.toast(`⚔️ הצטרפת לקרב! לאסוף ${cfg.ammo().map(k => k.icon).join(' ')} ולזרוק`, 'good');
    });
  },
  // From the menu (the cheeseburger) or a boss's own dare: everyone online is invited.
  inviteCoop(kind = 'burger') {
    if (this.active || G.alert || Story.ctl) { UI.toast('לא עכשיו', 'bad'); return; }
    const cfg = BOSSES[kind];
    UI.fade(() => {
      if (World.id !== cfg.map) { if (G.player.carry) G.player.carry = false; Game.switchMap(cfg.map); }
      this.startCoop(true, kind);
    });
  },

  // Throw whatever healthy food you have most of (E / the action button).
  throw() {
    const kinds = this.cfg.ammo().filter(k => this.ammo[k.id] > 0).sort((a, b) => this.ammo[b.id] - this.ammo[a.id]);
    if (!kinds.length) { UI.toast(`אין תחמושת! לאסוף ${this.cfg.ammo().map(k => k.icon).join(' ')}`, 'bad'); return; }
    const k = kinds[0];
    this.ammo[k.id]--;
    this.shots.push({ x: G.player.x, y: G.player.y, kind: k, t: 0 });
    if (this.coop) this.fxLog.s.push({ t: Date.now(), x: Math.round(G.player.x), y: Math.round(G.player.y), k: k.id });
    Sound.whoosh();
  },

  taunt(i) {
    this.bubble = { text: fmt(this.cfg.taunts[i]), t: i === 1 && this.cfg.voices ? 6 : 3.6 };
    if (this.cfg.voice) Sound.voice(BOSS_VOICE + BOSS_TAUNT_VOICE[i] + '.mp3');
    const v = this.cfg.voices && this.cfg.voices[i] && Assets.voice(this.cfg.voices[i]);
    if (v) Sound.voice(v);
  },

  // Starting one of the event bosses: a short cutscene, then the fight where they stand.
  async startOther(kind, opts = {}) {
    await this.intro(kind, opts);
    this.start(null, kind);
  },
  async intro(kind, opts = {}) {
    if (kind === 'baum') {
      if (!opts.skipIntro) await UI.talk([
        { who: 'p_liran', text: 'המפקדת! המפקדת! {first} קרא ספר בשמירה! ספר עם תמונות! על מיירטים! אוגה!' },
        { who: 'bc', text: '...ספר. בשמירה. ב־ש־מ־י־ר־ה.' },
      ]);
      await UI.cutscene([
        { img: Assets.scene('baum_intro'), who: '', text: 'משהו נשבר אצל {@bc}. היא גדלה... וגדלה... מפלצת נהלים בגובה שלוש קומות, עם אקסל ביד אחת וגפילטע פיש ביד השנייה.' },
        { img: Assets.scene('baum_intro'), who: '{@@p_shalev}', text: 'יש רק דבר אחד שהיא לא תעמוד בו — תרבות מזרחית! קריוקי, גרעינים שחורים, הפוסטר של ביבי והתמונה של הבבא סאלי! [תאסוף/תאספי] ו[תזרוק/תזרקי] (E)!' },
      ]);
    } else if (kind === 'bar') {
      await UI.cutscene([
        { img: Assets.scene('bar_intro'), who: '', text: '{@hamalist} מדברת. ומדברת. ומדברת. שלוש שעות בלי לנשום — ופתאום צומחות לה כנפיים של נץ. היא ממריאה מעל הדשא של {hq} ופותחת את הפה...' },
        { img: Assets.scene('bar_intro'), who: '{@@ops}', text: 'זה נגמר רק בשלושה דברים: בקבוקון ריטלין, חומר מרדים ומחסום פה. [תאסוף/תאספי] ו[תזרוק/תזרקי] עליה (E)! וכשהיא שואגת — [תתרחק/תתרחקי]!' },
      ]);
    } else {
      await UI.cutscene([
        { img: Assets.scene('harasar_intro'), who: '', text: '{@harasar} מסתכל עליך מלמטה למעלה. הוריד. ושוב העלה. "...אין לך מה להגיד? טוב. לי יש." — הוא מתנפח, מתנפח, ענק עם פנקס דו"חות.' },
        { img: Assets.scene('harasar_intro'), who: '{@@sarsap}', text: 'רס"ר אפשר להביס רק בדבר אחד: תלבושת מושלמת. [תאסוף/תאספי] נעליים מצוחצחות, כומתה מקופלת, גילוח וחוגר — ו[תזרוק/תזרקי] עליו (E)!' },
      ]);
    }
  },
  // The end of the other bosses.
  async endOther() {
    const kind = this.kind;
    $('#boss-hud').classList.add('hidden');
    this.burgers = []; this.shots = []; this.pickups = [];
    if (kind === 'baum') {
      await UI.cutscene([{ img: Assets.scene('baum_win'), who: '', text: 'גרעינים, קריוקי, ביבי והבבא סאלי... {@bc} מתכווצת חזרה לגודל רגיל, יושבת על הדשא ומזמזמת "יא מאמא" בלי לשים לב.' }]);
      await UI.talk([
        { who: 'bc', text: '...זה היה... מרגש. אני לא אגיד לאף אחד. ואם מישהו ישאל — זה היה תרגיל.' },
        { who: 'bc', text: '{@p_liran}, שמירה כפולה. עם הספר. ותביא לי את הגרעינים, יש לי עוד חצי שעה עד הנסיעה.' },
      ]);
      G.state.flags.baumBoss = true;
      BossArcs.won('baum');
      Game.achieve('baum_boss');
      Game.addScore(15, 'ניצחת את {@bc}');
    } else if (kind === 'bar') {
      Sound.stopVoice();
      await UI.cutscene([{ img: Assets.scene('bar_win'), who: '', text: 'ריטלין, מרדים ומחסום... הכנפיים מתקפלות לאט. {@hamalist} נוחתת על הדשא, מחייכת, ונרדמת באמצע משפט. בפעם הראשונה בהיסטוריה של {hq} — שקט.' }]);
      await UI.talk([
        { who: 'hamalist', text: '...מה?! לא ישנתי!!! עצמתי עיניים כדי לחשוב!!! ...אבל באמת, הוא סבבה והכל. רק...' },
        { who: 'ops', text: 'שקט בקשר. סוף סוף. {name}, את[ה/] מקבל[/ת] ממני מדליה. מדליה שקטה.' },
      ]);
      G.state.flags.barBoss = true;
      BossArcs.won('bar');
      Game.achieve('bar_boss');
      Game.addScore(15, 'ניצחת את {@hamalist}');
    } else {
      await UI.cutscene([{ img: Assets.scene('harasar_win'), who: '', text: 'נעליים מבריקות, כומתה בכותפת, גילוח חלק וחוגר... {@harasar} מתכווץ, מסתכל עליך מלמטה למעלה — ובפעם הראשונה בהיסטוריה של הסוללה, אין לו מה להגיד.' }]);
      await UI.talk([{ who: 'harasar', text: '...*מצדיע* זה לא קרה. ואם תספר[/י] — שלושה ימי ריתוק. ...טוב, שניים.' }]);
      G.state.flags.harasarBoss = true;
      BossArcs.won('harasar');
      Game.achieve('harasar_boss');
      Game.addScore(15, 'ניצחת את {@harasar}');
    }
    Game.addStat('morale', 15);
    Game.resetNpcs();
  },

  // The boss won: they gloat, everyone goes back to normal, and you can come back for more.
  async endLose() {
    const kind = this.kind, coop = this.coop;
    $('#boss-hud').classList.add('hidden');
    this.hud();
    this.burgers = []; this.shots = []; this.pickups = []; this.remoteShots = []; this.remoteBurgers = [];
    this.victory = 0; this.slam = null; this.screech = null;
    if (coop) { (this.doneIds = this.doneIds || new Set()).add(coop.id); this.coop = null; }
    const retry = {
      burger: 'לחזור לארונית החטיפים בשו"ב — סיבוב שני',
      baum: 'לדבר שוב עם {@bc} — סיבוב שני', harasar: 'לדבר שוב עם {@harasar} — סיבוב שני', bar: 'לדבר שוב עם {@hamalist} — סיבוב שני',
    }[kind];
    await UI.talk([{ who: this.cfg.npc, text: { burger: '*מלקק את האצבעות* ...תחזור[/י] כשתאכל[/י] יותר ברוקולי.', baum: 'בפעם הבאה — עם הכנה מראש. ונוהל.', harasar: 'תתייצב[/י] שוב כשהתלבושת תהיה מוכנה. וגם את[ה/].', bar: 'היה כל כך כיף!!! בוא[/י] עוד פעם!!! אני לא הולכת לשום מקום!!! אף פעם!!!' }[kind] }]);
    Game.addStat('morale', -8);
    Game.resetNpcs();
    G.player.x = Math.max(this.arena.x0, Math.min(this.arena.x1, G.player.x));
    UI.toast(`💪 [נסה/נסי] שוב: ${fmt(retry)}`, 'bad');
  },

  hitBoss(kind) {
    if (!this.active || this.victory) return;
    const dmg = kind.dmg || 8;
    this.myDmg += dmg;
    this.hp = Math.max(0, this.max - this.myDmg - this.peerDmg);
    this.flash = 1;
    this.bubble = { text: kind.hit, t: 2.2 };
    Sound.splat();
    if (this.cfg.voice && this.hurtCd <= 0 && this.hp > 0) { this.hurtCd = 9 + Math.random() * 6; Sound.voice(BOSS_VOICE + 'hurt.mp3'); }
    G.shake = 0.25;
    if (this.hp <= 0) this.end(true);
  },

  hitPlayer(msg, amount = this.cfg.hitDmg || 22) {
    if (this.inv > 0 || this.dead > 0 || this.victory) return;
    this.life = Math.max(0, this.life - amount);
    // A short moment of cover after each hit, so one burst can't take everything at once.
    this.inv = 0.3;
    this.hurtFx = 1;
    G.shake = 0.4;
    Sound.bad();
    UI.toast(`${msg || this.cfg.hitMe} −${amount}❤️`, 'bad');
    if (this.life <= 0) this.die();
  },

  hud() {
    const h = $('#boss-hud');
    if (!h) return;
    let ko = $('#boss-ko');
    if (!ko) { ko = document.createElement('div'); ko.id = 'boss-ko'; ko.className = 'boss-ko'; $('#hud').appendChild(ko); }
    const koText = !this.active ? '' : this.victory ? `🕺 ${this.NAME} ${this.fem ? 'רוקדת' : 'רוקד'} ריקוד ניצחון` : this.dead > 0 ? `💀 ${fmt('[נפלת/נפלת]')}! ${3 - this.deaths === 1 ? '❤️ אחרון' : 3 - this.deaths + ' ❤️ נשארו'}` : '';
    if (ko.textContent !== koText) { ko.textContent = koText; ko.classList.toggle('hidden', !koText); ko.style.animation = 'none'; void ko.offsetWidth; ko.style.animation = ''; }
    const ammo = this.cfg.ammo().map(k => `<span class="ammo">${k.icon} ${this.ammo[k.id]}</span>`).join('');
    const team = this.coop ? Multi.peers.filter(p => p.boss && p.boss.id === this.coop.id).length + 1 : 1;
    const pct = Math.max(0, Math.round(this.hp / this.max * 100));
    h.innerHTML = `<div class="boss-top"><span class="boss-name">${this.cfg.icon} ${this.NAME}</span><div class="boss-bar"><b style="width:${pct}%"></b></div><span class="boss-pct">${pct}%</span>${team > 1 ? `<span class="boss-team">👥${team}</span>` : ''}</div>
      <div class="boss-row"><span class="boss-lives" title="חיים">${[0, 1, 2].map(i => i < 3 - this.deaths ? '❤️' : '🖤').join('')}</span><div class="chol-bar life${this.life <= 35 ? ' hot' : ''}${this.inv > 0.4 ? ' inv' : ''}"><b style="width:${this.life}%"></b></div>${ammo}</div>`;
  },

  async end(win) {
    this.active = false;
    document.body.classList.remove('boss-fight');
    if ($('#boss-ko')) $('#boss-ko').classList.add('hidden');
    if (!win) { await this.endLose(); return; }
    // Whoever lands the last hit keeps telling the others for a few seconds, so their fight
    // ends too instead of waiting on a boss that's already down.
    if (this.coop) this.coopTail = { until: Date.now() + 10000, st: { id: this.coop.id, k: this.kind, max: this.max, dmg: this.myDmg, tk: (this.myTaken || []).slice(-30) } };
    if (this.kind !== 'burger') {
      const coop = this.coop;
      if (coop) {
        (this.doneIds = this.doneIds || new Set()).add(coop.id);
        const team = Multi.peers.filter(p => p.boss && p.boss.id === coop.id).map(p => p.name);
        if (team.length) UI.toast(`👥 ניצחתם ביחד: ${team.join(', ')} ו־${fmt('{name}')}!`, 'good');
        this.remoteShots = []; this.remoteBurgers = [];
      }
      await this.endOther();
      if (coop) { Game.addScore(5, 'קרב בוס משותף'); this.coop = null; }
      return;
    }
    if (win) Sound.voice(BOSS_VOICE + 'defeat.mp3');
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
