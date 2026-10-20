// Backgammon (שש בש) on the pergola tables, played in first person from the bench.
// Sitting at a pergola puts the camera at eye height (Scene3D.seatCamera). Every table has a
// board; look at it (or tap it) to offer a game to whoever sits opposite: a cast member, who
// answers in character, or a friend online, who gets an invite card.
// Online, everything rides on presence (the arcade's `ar` slot with g: 'shesh'): the seat, an
// offer and its answer, and the last turn played. The offering player's seed rolls every die,
// so both phones see the same throws.
//
// Positions: [mine, theirs], each an array of 26 counts from that player's own side: 1..24
// the points (1 = deepest in their home board), 25 the bar, 0 borne off. Their point j is my
// point 25 - j.

const SHESH_SHOT = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1].map(n => n / 36);
const SHESH_PT = [0, 1.0, 1.5, 2.0, 2.6, 3.2, 3.0, 2.4, 1.6, 1.1, 0.9, 0.6, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 1.0, 1.8, 1.8, 1.0, 1.0, 1.0];

// ---------- the rules ----------
const SheshRules = {
  start() { const a = new Array(26).fill(0); a[24] = 2; a[13] = 5; a[8] = 3; a[6] = 5; return [a.slice(), a.slice()]; },
  copy(p) { return [p[0].slice(), p[1].slice()]; },
  key(p) { return p[0].join(',') + '|' + p[1].join(','); },
  pips(a) { let s = 0; for (let i = 1; i <= 25; i++) s += a[i] * i; return s; },
  allHome(a) { for (let i = 7; i <= 25; i++) if (a[i]) return false; return true; },
  // Single moves for side s with one die: entering from the bar first, bearing off once home.
  moves(p, s, d) {
    const me = p[s], op = p[1 - s], out = [];
    const open = (to) => op[25 - to] < 2;
    if (me[25]) {
      const to = 25 - d;
      if (open(to)) out.push({ from: 25, to, d, hit: op[25 - to] === 1 });
      return out;
    }
    const home = this.allHome(me);
    for (let f = 24; f >= 1; f--) {
      if (!me[f]) continue;
      const to = f - d;
      if (to >= 1) { if (open(to)) out.push({ from: f, to, d, hit: op[25 - to] === 1 }); continue; }
      if (!home) continue;
      // Exactly off, or a bigger die from the highest point when nothing sits higher.
      let higher = false;
      if (to < 0) for (let k = f + 1; k <= 6; k++) if (me[k]) { higher = true; break; }
      if (!higher) out.push({ from: f, to: 0, d, hit: false });
    }
    return out;
  },
  apply(p, s, m) {
    const q = this.copy(p), me = q[s], op = q[1 - s];
    me[m.from]--; me[m.to]++;
    if (m.to >= 1 && op[25 - m.to] === 1) { op[25 - m.to] = 0; op[25]++; }
    return q;
  },
  // The most dice that can be played from here.
  maxUse(p, s, dice) {
    if (!dice.length) return 0;
    let best = 0;
    const tried = new Set();
    for (let i = 0; i < dice.length; i++) {
      const d = dice[i];
      if (tried.has(d)) continue;
      tried.add(d);
      const rest = dice.slice(0, i).concat(dice.slice(i + 1));
      for (const m of this.moves(p, s, d)) {
        const u = 1 + this.maxUse(this.apply(p, s, m), s, rest);
        if (u > best) best = u;
        if (best === dice.length) return best;
      }
    }
    return best;
  },
  // A turn's limits: how many dice must be played, and (when only one of two different dice
  // can be) which one: the larger whenever it is playable.
  turn(p, s, dice) {
    const max = this.maxUse(p, s, dice);
    let only = null;
    if (max === 1 && dice.length === 2 && dice[0] !== dice[1]) {
      const big = Math.max(dice[0], dice[1]), small = Math.min(dice[0], dice[1]);
      only = this.moves(p, s, big).length ? big : small;
    }
    return { max, only };
  },
  // Moves allowed now, so the whole turn can still use as many dice as possible.
  legal(p, s, left, need, only) {
    if (need <= 0) return [];
    const out = [], seen = new Set();
    for (let i = 0; i < left.length; i++) {
      const d = left[i];
      if (seen.has(d) || (only && d !== only)) continue;
      seen.add(d);
      const rest = left.slice(0, i).concat(left.slice(i + 1));
      for (const m of this.moves(p, s, d)) if (1 + this.maxUse(this.apply(p, s, m), s, rest) >= need) out.push(m);
    }
    return out;
  },
  // Every distinct way to play the whole roll: [{ moves, pos }].
  seqs(p, s, dice, max, only) {
    if (!max) return [{ moves: [], pos: p }];
    const out = new Map();
    const go = (q, left, moves) => {
      if (moves.length === max) { const k = this.key(q); if (!out.has(k)) out.set(k, { moves, pos: q }); return; }
      const seen = new Set();
      for (let i = 0; i < left.length; i++) {
        const d = left[i];
        if (seen.has(d) || (only && d !== only)) continue;
        seen.add(d);
        const rest = left.slice(0, i).concat(left.slice(i + 1));
        for (const m of this.moves(q, s, d)) go(this.apply(q, s, m), rest, moves.concat([m]));
      }
    };
    go(p, dice, []);
    return [...out.values()];
  },
  // How good a position is for side s: a coffee-house player's sense of the game. Hit, make
  // points (home and the bar point first), build primes, don't leave blots in range, and once
  // the armies have passed each other, just race home.
  evalPos(p, s) {
    const me = p[s], op = p[1 - s];
    if (me[0] === 15) return 1e6;
    const myPip = this.pips(me), opPip = this.pips(op);
    let myBack = 0, opBack = 0;
    for (let i = 25; i >= 1; i--) if (me[i]) { myBack = i; break; }
    for (let j = 25; j >= 1; j--) if (op[j]) { opBack = j; break; }
    if (myBack + opBack <= 25) {
      // A pure race: pips, checkers off, and no gaps that waste a roll.
      let sc = -myPip + me[0] * 2.5;
      for (let i = 1; i <= 6; i++) if (me[i] > 3) sc -= (me[i] - 3) * 0.3;
      return sc;
    }
    let sc = (opPip - myPip) * 0.1 + me[0] * 2 - me[25] * 6;
    let home = 0;
    for (let i = 1; i <= 6; i++) if (me[i] >= 2) home++;
    sc += op[25] * (4 + home * 0.9);
    let run = 0, best = 0;
    for (let i = 1; i <= 24; i++) {
      if (me[i] >= 2) { sc += SHESH_PT[i]; run++; if (run > best) best = run; } else run = 0;
      if (me[i] > 3) sc -= (me[i] - 3) * 0.45;
    }
    if (best >= 3) sc += (best - 2) * 2.5;
    // Blots: the chance one of their checkers (or bar checkers) hits it, times what it costs.
    const shooters = [];
    for (let j = 1; j <= 25; j++) if (op[j]) shooters.push(25 - j);
    for (let i = 1; i <= 24; i++) {
      if (me[i] !== 1) continue;
      let miss = 1;
      for (const k of shooters) if (k < i) miss *= 1 - (SHESH_SHOT[i - k] || 0);
      sc -= (1 - miss) * (4 + (25 - i) * 0.22) * (i >= 19 ? 0.5 : 1) * 2.1;
    }
    // Ahead in the race: bring the back checkers home.
    if (opPip - myPip > 12) for (let i = 19; i <= 24; i++) sc -= me[i] * 0.8;
    return sc;
  },
  best(p, s, dice, noise = 0.3) {
    const t = this.turn(p, s, dice);
    let best = null, bv = -Infinity;
    for (const c of this.seqs(p, s, dice, t.max, t.only)) {
      const v = this.evalPos(c.pos, s) + (Math.random() - 0.5) * noise;
      if (v > bv) { bv = v; best = c; }
    }
    return best ? best.moves : [];
  },
};

// ---------- what the cast says across the board ----------
// [m/f] is the player's gender; «m|f» is the speaker's own.
const SHESH_LINES = {
  accept: ['יאללה, שש בש! אני «מזהיר|מזהירה» אותך מראש: «אלוף|אלופת» הפלגה.', 'סבבה. מי שמפסיד מביא שתייה מהש"ק.', 'שש בש? [אחי/אחותי], «נולדתי|נולדתי» עם קוביות ביד.', 'רק משחק אחד. ...טוב, אולי שניים. לא, אחד.', 'פתח[/י] את הלוח, {name}. אני רק «אסדר|אסדר» את האבנים... ואנצח.'],
  decline: ['לא עכשיו, אני באמצע לחשוב על כלום. זה חשוב.', 'אני «שבור|שבורה» מהשמירה. [תשאל/תשאלי] אותי עוד דקה.', 'בפעם האחרונה ששיחקתי הפסדתי ל{@rasap} ובכיתי. עוד לא «מוכן|מוכנה» נפשית.', 'שש בש? עכשיו? הקוביות שלי בכביסה.'],
  yes2: ['טוב, טוב. [שכנעת/שכנעת]. סיבוב אחד.', 'אוף. בסדר. אבל אם אני «מנצח|מנצחת», את[ה/] «מוזג|מוזג» לי קפה... [תמזוג/תמזגי].', 'נו באמת. ...יאללה, שים[/י] אבנים.'],
  again: ['עוד אחד? קדימה, עכשיו ברצינות.', 'נקמה! שים[/י] אבנים.', 'הפעם אני לא «מרחם|מרחמת».'],
  myHit: ['בום! על הבר. סליחה. לא באמת סליחה.', 'תגיד[/י] שלום לאבן שלך 👋', 'אאוץ\'... בשבילך. לא בשבילי.', 'זה נקרא טקטיקה, {name}.'],
  gotHit: ['אאוץ\'!', 'מה זה היה?!', 'זה לא הוגן, הקוביות שלך מכושפות.', 'אני «זוכר|זוכרת» את זה. אני «זוכר|זוכרת» הכל.'],
  myDouble: ['דאבל! אמא שלי מתפללת בשבילי.', 'דאבל!! תראו, תראו!', 'שש־שש? לא, סתם. אבל דאבל!'],
  yourDouble: ['שוב דאבל?! מי סידר לך את הקוביות?', 'דאבל... בטח החלפת קוביות כשלא «הסתכלתי|הסתכלתי».', 'אני «מבקש|מבקשת» לבדוק את הקוביות האלה.'],
  stuck: ['חסום... אני «חסום|חסומה» כמו השער בבוקר.', 'אין לי לאן ללכת. כמו ביום ראשון בבוקר.'],
  youStuck: ['אין לך מהלכים. «מצטער|מצטערת». לא באמת.', 'חסום! הא!'],
  nag: ['[תזרוק/תזרקי] כבר, אני «מזדקן|מזדקנת» פה.', 'הלו? {name}? נרדמת על הלוח?', 'עוד דקה אני «קורא|קוראת» ל{@inspector} שתראה אותך לא עושה כלום.', 'אני «סופר|סופרת» עד עשר. אחת... שתיים...'],
  iWin: ['ניצחתי! תתלו את זה בלוח המודעות.', 'זה היה מזל? לא. זה היה כישרון.', 'עוד אחד? או שאת[ה/] צריך[/ה] רגע להתאושש?'],
  iLose: ['הקוביות שלך לא חוקיות. אני «דורש|דורשת» בדיקה של {@harasar}.', 'טוב... ניצחת. אבל הרשיתי לך.', 'זה לא נחשב, לא «התחממתי|התחממתי».'],
  mars: ['מארס?! תמחקו את זה מהזיכרון של כולם.', 'מארס... אני «הולך|הולכת» לחשוב על החיים שלי.'],
  leave: ['לאן?! אני «שומר|שומרת» על הלוח. [תחזור/תחזרי].', 'אל תיגע[/י] בכלום, אני «זוכר|זוכרת» איפה כל אבן.'],
  back: ['חזרת! איפה היינו... אה כן, אני «מנצח|מנצחת».', 'יופי שחזרת. הלוח חיכה. גם אני.'],
  come: ['מה, לבד? [זוז/זוזי].', 'שולחן ריק? אני «מצטרף|מצטרפת».', 'לשבת לבד זה עצוב. אני «פה|פה».'],
  quit: ['פרשת? «קיבלתי|קיבלתי». ניצחון זה ניצחון.', 'וויתרת?! טוב, אני «רושם|רושמת» ניצחון.'],
};
// A few voices of their own.
const SHESH_OWN = {
  p_liran: { accept: ['אוגה בוגה! 🦴 שש בש!'], iWin: ['אוגה בוגה!!! 🦴🦴'] },
  p_shalev: { accept: ['בעזרת השם, שש בש! 🙏'], iWin: ['🎶 שאטי לייק א מלודי... ניצחתי! 🎶'] },
  p_nevo: { nag: ['אני «נרדם|נרדמת»... [תעיר/תעירי] אותי כשזה התור שלי 💤'], accept: ['פרקטי, [אחי/אחותי]. יאללה.'] },
  p_arad: { myHit: ['💨 ...סליחה. גם על האבן.'] },
  p_choco: { accept: ['מי שמפסיד קונה לי שוקולד 🍫'] },
  p_rotem: { myHit: ['🕷️ קורים! האבן שלך נתקעה ברשת.'] },
  p_ofek: { accept: ['פחית חמישית ושש בש. הכי מבצעי בפלגה 💙'] },
  p_hila: { myDouble: ['אאאאאא!!! 🌀 דאבל!!!'] },
  p_shaked: { accept: ['פוצ׳! סיבוב אחד ואחרי זה עשרים שכיבות סמיכה.'] },
};

const Shesh = {
  R: SheshRules,
  speed: 1,           // tests speed the animations up
  boards: [],
  root: null,
  seat: null,         // the pergola seat the player sits on
  board: null,        // that table's board
  m: null,            // the game on the board
  saved: null,        // a game against a cast member left mid-way: { m, seat, at }
  offer: null,        // our open online offer { id, to, seed, at }
  ans: null,          // our answer to a friend's offer { ac | dn }
  seen: new Set(),
  aim: null,          // what the reticle (or the last tap) points at
  anims: [],

  // ---------- each frame (from Scene3D.update) ----------
  update(dt) {
    if (!G.state || !Scene3D.root || !World.seats) return;
    if (this.root !== Scene3D.root) this.build();
    this.netSeats();
    const P = G.player, st = P.sit && P.sit.pergola ? P.sit : null;
    if (st !== this.seat) this.onSeat(st);
    this.place(dt);
    this.stepAnims(dt);
    // A game starting tilts the head down to the board (still free to look around).
    if (this.tilt > 0 && Scene3D.inSeat) { this.tilt -= dt; Scene3D.pitch += (1.08 - Scene3D.pitch) * Math.min(1, dt * 5); }
    if (this.seat) this.seated(dt);
    this.releaseHelper(dt);
    this.hud();
  },

  // ---------- the boards ----------
  W: 0.70, D: 0.50, F: 0.022, BAR: 0.05, TRAY: 0.062, H: 0.018, CR: 0.0215, CH: 0.0085,
  colU(i) { const pw = (this.W - 2 * this.F - this.BAR) / 12, b = this.BAR / 2; return i <= 6 ? b + (6 - i + 0.5) * pw : i <= 12 ? -(b + (i - 7 + 0.5) * pw) : i <= 18 ? -(b + (18 - i + 0.5) * pw) : b + (i - 19 + 0.5) * pw; },
  // Where the k-th checker of a pile sits, in the board's frame (u: the player's right, v: away).
  slot(side, idx, k) {
    const r = this.CR, h = this.CH, sgn = side === 0 ? -1 : 1;
    if (idx === 25) return { u: 0, v: sgn * (0.04 + (k % 4) * 2 * r), y: Math.floor(k / 4) * h };
    if (idx === 0) return { u: this.W / 2 + this.TRAY / 2, v: sgn * (this.D / 2 - this.F - 0.007 - k * 0.0099), y: 0.009, edge: true };
    const i = side === 0 ? idx : 25 - idx, near = i <= 12;
    const v = near ? -this.D / 2 + this.F + r + (k % 5) * 2 * r : this.D / 2 - this.F - r - (k % 5) * 2 * r;
    return { u: this.colU(i), v, y: Math.floor(k / 5) * h };
  },
  local(s) { return new THREE.Vector3(-s.u, this.H + this.CH / 2 + s.y, s.v); },
  // Unlit highlight colours, given as they should look on screen (the renderer outputs sRGB).
  lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); },

  mats() {
    if (this.M) return this.M;
    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.04, ...o });
    const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
    const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
    // Checker faces: turned rings, like the wooden ones in every canteen.
    const face = (base, ring) => tex(canvas(128, 128, (g) => {
      g.fillStyle = base; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = ring; g.lineWidth = 6;
      for (const r of [56, 40, 22]) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); }
      g.fillStyle = ring; g.beginPath(); g.arc(64, 64, 7, 0, 7); g.fill();
    }));
    const pip = (n) => tex(canvas(96, 96, (g) => {
      g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, 96, 96);
      g.strokeStyle = '#cfc6b0'; g.lineWidth = 4; g.strokeRect(2, 2, 92, 92);
      const P = { 1: [[48, 48]], 2: [[26, 26], [70, 70]], 3: [[24, 24], [48, 48], [72, 72]], 4: [[26, 26], [70, 26], [26, 70], [70, 70]], 5: [[24, 24], [72, 24], [48, 48], [24, 72], [72, 72]], 6: [[26, 22], [70, 22], [26, 48], [70, 48], [26, 74], [70, 74]] }[n];
      g.fillStyle = n === 1 ? '#c0281c' : '#1b1712';
      for (const [x, y] of P) { g.beginPath(); g.arc(x, y, n === 1 ? 13 : 9, 0, 7); g.fill(); }
    }));
    const dieMats = [1, 6, 2, 5, 3, 4].map(n => std(0xffffff, { map: pip(n), roughness: 0.35 }));
    const ivory = std(0xefe4cc, { roughness: 0.35 }), ebony = std(0x2a211d, { roughness: 0.35 });
    this.M = {
      surf: std(0xffffff, { map: tex(this.surface()), roughness: 0.7 }),
      rim: std(0x4a2a14, { roughness: 0.5 }), dark: std(0x2e190b, { roughness: 0.6 }),
      brass: std(0xc9a14a, { metalness: 0.6, roughness: 0.35 }),
      side: [[ivory, std(0xffffff, { map: face('#f1e7d1', '#c8b894'), roughness: 0.35 }), ivory], [ebony, std(0xffffff, { map: face('#2d2420', '#5c4a3e'), roughness: 0.35 }), ebony]],
      die: dieMats,
      hit: new THREE.MeshBasicMaterial({ visible: false }),
    };
    return this.M;
  },
  // The playing surface, drawn once: olive-wood field, walnut and red points, the bar.
  surface() {
    const W = this.W, D = this.D, F = this.F, cw = 1024, chh = Math.round(cw * D / W);
    const c = document.createElement('canvas'); c.width = cw; c.height = chh;
    const g = c.getContext('2d');
    const X = (u) => (W / 2 - u) / W * cw, Y = (v) => (v + D / 2) / D * chh;
    g.fillStyle = '#4a2a14'; g.fillRect(0, 0, cw, chh);
    const field = g.createLinearGradient(0, 0, cw, chh);
    field.addColorStop(0, '#d8b67e'); field.addColorStop(0.5, '#e3c48e'); field.addColorStop(1, '#cfa96f');
    g.fillStyle = field; g.fillRect(X(W / 2 - F), Y(-D / 2 + F), X(-W / 2 + F) - X(W / 2 - F), Y(D / 2 - F) - Y(-D / 2 + F));
    // Grain.
    g.globalAlpha = 0.09; g.strokeStyle = '#6b4520';
    for (let i = 0; i < 70; i++) { const y = Math.random() * chh; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(cw * 0.3, y + 8 * Math.sin(i), cw * 0.7, y - 8 * Math.cos(i), cw, y + 4); g.stroke(); }
    g.globalAlpha = 1;
    const pw = (W - 2 * F - this.BAR) / 12, len = D / 2 - F - 0.03;
    for (let i = 1; i <= 24; i++) {
      const u = this.colU(i), near = i <= 12, v0 = near ? -D / 2 + F : D / 2 - F, v1 = near ? v0 + len : v0 - len;
      g.fillStyle = i % 2 ? '#7a2a1c' : '#3b2414';
      g.beginPath(); g.moveTo(X(u - pw / 2 + 0.002), Y(v0)); g.lineTo(X(u + pw / 2 - 0.002), Y(v0)); g.lineTo(X(u), Y(v1)); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,230,170,.35)'; g.lineWidth = 2; g.stroke();
    }
    // The bar and a thin brass inlay around the field.
    g.fillStyle = '#4a2a14'; g.fillRect(X(this.BAR / 2), 0, X(-this.BAR / 2) - X(this.BAR / 2), chh);
    g.strokeStyle = '#c9a14a'; g.lineWidth = 3;
    g.strokeRect(X(W / 2 - F) + 4, Y(-D / 2 + F) + 4, X(-W / 2 + F) - X(W / 2 - F) - 8, Y(D / 2 - F) - Y(-D / 2 + F) - 8);
    return c;
  },

  build() {
    // The old site's boards: everything but the shared materials was built for them.
    const M0 = this.M ? new Set([this.M.surf, this.M.rim, this.M.dark, this.M.brass, this.M.hit, ...this.M.die, ...this.M.side.flat()]) : new Set();
    for (const ob of this.boards) ob.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !Array.isArray(o.material) && !M0.has(o.material)) o.material.dispose(); });
    this.root = Scene3D.root;
    this.boards = [];
    this.board = null;
    this.anims = [];
    const M = this.mats();
    const box = (w, h, d, mat, x, y, z, g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    const W = this.W, D = this.D, F = this.F, H = this.H, T = this.TRAY;
    const cGeo = new THREE.CylinderGeometry(this.CR, this.CR, this.CH, 28);
    const dGeo = new THREE.BoxGeometry(0.021, 0.021, 0.021);
    for (const rec of Scene3D.props || []) {
      if (rec.o.kind !== 'pergola') continue;
      const o = rec.o, g = new THREE.Group();
      const frame = M.rim.clone();
      // The case: base, the field, rims, the bar's hinge and the tray for borne-off checkers.
      box(W + T, H - 0.004, D, frame, -T / 2, (H - 0.004) / 2, 0, g);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.surf);
      top.rotation.x = -Math.PI / 2; top.position.y = H; top.receiveShadow = true; g.add(top);
      const rh = 0.016;
      for (const sv of [-1, 1]) box(W + T, rh, F, frame, -T / 2, H + rh / 2, sv * (D / 2 - F / 2), g);
      for (const su of [-1, 1]) box(F, rh, D, frame, su * (W / 2 - F / 2), H + rh / 2, 0, g);
      box(F * 0.7, rh, D, frame, -(W / 2 + T - F * 0.35), H + rh / 2, 0, g);
      box(this.BAR, rh * 0.8, D - 2 * F, frame, 0, H + rh * 0.4, 0, g);
      box(0.012, rh * 0.85, D * 0.3, M.brass, 0, H + rh * 0.42, 0, g);
      const tray = box(T - F * 0.4, 0.004, D - 2 * F, M.dark, -(W / 2 + T / 2 - F * 0.1), H + 0.002, 0, g);
      tray.castShadow = false;
      const b = { o, rec, g, frame, checkers: [[], []], loc: null, hits: [], tri: [], rings: [], ghosts: [], dice: [], u0: null };
      for (let s = 0; s < 2; s++) for (let k = 0; k < 15; k++) {
        const c = new THREE.Mesh(cGeo, M.side[s]);
        c.castShadow = true;
        g.add(c);
        b.checkers[s].push(c);
      }
      for (let k = 0; k < 2; k++) { const d = new THREE.Mesh(dGeo, M.die); d.castShadow = true; d.visible = false; g.add(d); b.dice.push(d); }
      // Where a look or a tap lands: each point's half-column, the bar, the tray.
      const pw = (W - 2 * F - this.BAR) / 12, half = D / 2 - F;
      const hit = (w, d, u, v, kind, idx) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.hit);
        m.rotation.x = -Math.PI / 2; m.position.set(-u, H + 0.012, v); m.userData = { kind, idx };
        g.add(m); b.hits.push(m);
      };
      for (let i = 1; i <= 24; i++) hit(pw, half, this.colU(i), i <= 12 ? -half / 2 : half / 2, 'pt', i);
      hit(this.BAR, D, 0, 0, 'bar', 25);
      hit(T, D, W / 2 + T / 2, 0, 'off', 0);
      // Highlights: a glow on each point, gold rings on the checkers you can move, ghost
      // checkers where the picked one can go.
      const len = D / 2 - F - 0.03;
      for (let i = 1; i <= 24; i++) {
        const u = this.colU(i), near = i <= 12, v0 = near ? -D / 2 + F : D / 2 - F, v1 = near ? v0 + len : v0 - len;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([-(u - pw / 2), 0, v0, -(u + pw / 2), 0, v0, -u, 0, v1], 3));
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: this.lin(0xffc21a), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
        m.position.y = H + 0.0015; m.visible = false; m.renderOrder = 2;
        g.add(m); b.tri[i] = m;
      }
      const trayGlow = box(T - F * 0.5, 0.003, D / 2 - F, new THREE.MeshBasicMaterial({ color: this.lin(0xffc21a), transparent: true, opacity: 0.6, depthWrite: false }), -(W / 2 + T / 2 - F * 0.1), H + 0.005, -(D / 4 - F / 2), g);
      trayGlow.visible = false; trayGlow.castShadow = false; b.tri[0] = trayGlow;
      const barGlow = box(this.BAR * 0.9, 0.003, D / 2 - F, new THREE.MeshBasicMaterial({ color: this.lin(0xffc21a), transparent: true, opacity: 0.6, depthWrite: false }), 0, H + rh * 0.8 + 0.002, -(D / 4 - F / 2), g);
      barGlow.visible = false; barGlow.castShadow = false; b.tri[25] = barGlow;
      const ringGeo = new THREE.RingGeometry(this.CR * 0.5, this.CR * 1.18, 28);
      for (let k = 0; k < 16; k++) {
        const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: this.lin(0xffb300), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
        r.rotation.x = -Math.PI / 2; r.visible = false; r.renderOrder = 3; g.add(r); b.rings.push(r);
      }
      for (let k = 0; k < 4; k++) {
        const gh = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ color: this.lin(0x3ee05a), transparent: true, opacity: 0.6, depthWrite: false }));
        gh.visible = false; gh.renderOrder = 3; g.add(gh); b.ghosts.push(gh);
      }
      // Sitting on the table top (the model's or the fallback's, measured with a ray).
      const cx = (o.x + o.w / 2) * S3, cz = (o.y + o.h / 2) * S3;
      rec.g.updateMatrixWorld(true);
      const rc = new THREE.Raycaster(new THREE.Vector3(cx, 1.6, cz), new THREE.Vector3(0, -1, 0));
      const h = rc.intersectObject(rec.g, true).find(x => x.point.y > 0.5 && x.point.y < 1.2);
      b.top = h ? h.point.y : 0.77;
      b.cx = cx; b.cz = cz;
      g.position.set(cx, b.top, cz);
      this.root.add(g);
      b.pos = SheshRules.start();
      this.layout(b);
      this.boards.push(b);
    }
    // Rebuilt while sitting: the game carries on on the new board.
    if (this.seat) {
      this.board = this.boards.find(x => x.o === this.seat.pergola) || null;
      if (this.board && this.m) { this.board.pos = this.m.pos; this.layout(this.board); }
    }
  },
  // Puts every checker where the position says (no animation).
  layout(b) {
    this.anims = this.anims.filter(a => a.die);
    if (this.lifted && b === this.board) this.lifted = null;
    b.loc = [[], []];
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i <= 25; i++) b.loc[s][i] = [];
      let k = 0;
      for (let i = 0; i <= 25; i++) for (let n = 0; n < b.pos[s][i]; n++) b.loc[s][i].push(b.checkers[s][k++]);
      for (let i = 0; i <= 25; i++) b.loc[s][i].forEach((c, n) => this.snap(c, s, i, n));
    }
  },
  snap(c, s, i, n) {
    const sl = this.slot(s, i, n);
    c.position.copy(this.local(sl));
    c.rotation.set(sl.edge ? Math.PI / 2 : 0, 0, 0);
  },
  // Each board faces whoever sits at it (the player first), slid in front of their seat.
  place(dt) {
    for (const b of this.boards) {
      const st = this.seat && this.seat.pergola === b.o ? this.seat : null;
      const want = st ? st.x * S3 : b.cx;
      if (b.u0 === null || !dt) b.u0 = want;
      b.u0 += (want - b.u0) * Math.min(1, dt * 5);
      b.g.position.x = b.u0;
      const a = st ? st.angle : Math.PI / 2;
      b.g.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
    }
  },

  // ---------- seats ----------
  seatIdx(st) { return World.seats.indexOf(st); },
  oppositeSeat(st) { return World.seats.find(s => s !== st && s.pergola === st.pergola && Math.abs(s.x - st.x) < 2 && Math.abs(s.y - st.y) > 4) || null; },
  // Friends online sitting at a table hold its seat for everyone else.
  netSeats() {
    for (const s of World.seats) if (typeof s.by === 'string' && s.by[0] === '@') s.by = null;
    if (!Multi.on) return;
    for (const p of Multi.peers) {
      const s = this.peerSeat(p);
      if (s && !s.by) s.by = '@' + p.who;
    }
  },
  peerS(p) { return p && p.site === World.id && p.ar && p.ar.g === 'shesh' && p.ar.s && typeof p.ar.s === 'object' ? p.ar.s : null; },
  peerSeat(p) { const s = this.peerS(p); const i = s ? Math.floor(+s.st) : -1; return i >= 0 && i < World.seats.length ? World.seats[i] : null; },
  // Who sits opposite: { kind: 'npc', n } or { kind: 'peer', p }, with their name.
  opposite() {
    if (!this.seat) return null;
    const os = this.oppositeSeat(this.seat);
    if (!os) return null;
    const n = G.npcs.find(q => q.seat === os && q.sitting);
    if (n) return { kind: 'npc', n, id: n.id, name: n.short, person: n.person };
    if (Multi.on) {
      const p = Multi.peers.find(q => this.peerSeat(q) === os);
      if (p) return { kind: 'peer', p, id: p.who, name: p.name || Cast.short(p.who), person: Cast.get(p.who) };
    }
    return null;
  },

  onSeat(st) {
    const was = this.seat;
    this.seat = st;
    this.aim = null;
    this.offer = null; this.ans = null;
    this.waitT = 0; this.summonTries = 0; this.declined = 0;
    if (was && this.m) {
      const m = this.m;
      if (m.online) { if (m.phase !== 'over') { this.resigned = m.id; UI.toast('🎲 קמת באמצע — המשחק נגמר בפרישה', 'bad'); } }
      else if (m.phase !== 'over') {
        // Against a cast member the board waits for you a few minutes.
        this.rewindTurn(m);
        this.saved = { m, seat: was, at: performance.now() };
        const n = Game.npc(m.opp.id);
        if (n) this.npcSay(n, this.line('leave', n.person));
      }
      this.m = null;
    }
    this.clearMarks();
    if (this.board && !(this.saved && this.saved.seat.pergola === this.board.o)) {
      this.board.pos = SheshRules.start();
      this.layout(this.board);
      for (const d of this.board.dice) d.visible = false;
    }
    this.board = st ? this.boards.find(b => b.o === st.pergola) || null : null;
    this.resumeT = null;
    // On a phone, sitting needs no run button (the joystick still gets you up).
    if (st && !was) Arcade.buttons({ run: false, look: true });
    else if (!st && was && !Arcade.active && !Race.active) Arcade.buttons(null);
    if (st) {
      this.tipUntil = performance.now() + 7000;
      this.resigned = null;
      if (this.helper && this.helper.seat === this.oppositeSeat(st)) this.helper.leaveT = null;
    } else {
      if (this.helper) this.helper.leaveT = 6;
      this.hideEnd();
    }
  },

  seated(dt) {
    const opp = this.opposite();
    this.opp = opp;
    // A game left here against the same cast member picks up where it stopped.
    const sv = this.saved;
    if (!this.m && sv && sv.seat === this.seat && opp && opp.kind === 'npc' && opp.id === sv.m.opp.id && performance.now() - sv.at < 4 * 60000) {
      this.resumeT = (this.resumeT == null ? 0.8 : this.resumeT) - dt;
      if (this.resumeT <= 0) {
        this.resumeT = null;
        this.saved = null;
        this.m = sv.m; this.m.opp = { kind: 'npc', id: opp.id, name: opp.name, person: opp.person };
        this.board.pos = this.m.pos; this.layout(this.board);
        this.npcSay(opp.n, this.line('back', opp.person));
        this.beginTurn(this.m.side);
      }
    } else this.resumeT = null;
    // Nobody across the table: before long somebody from the cast comes over.
    if (!opp && !this.m) {
      this.waitT += dt;
      if (this.waitT > 4.5 && this.summonTries < 3) {
        this.waitT = -18;
        this.summonTries++;
        if (Math.random() < 0.8) this.summon();
      }
    } else this.waitT = 0;
    if (this.helper && this.helper.n && this.helper.n.sitting && !this.helper.said && this.helper.seat === this.oppositeSeat(this.seat)) {
      this.helper.said = true;
      this.npcSay(this.helper.n, this.line('come', this.helper.n.person));
    }
    if (Scene3D.inSeat) this.aim = this.cast(0, 0);
    this.netWatch(dt);
    if (this.m) this.play(dt);
  },

  // A cast member nearby walks over and sits opposite.
  summon() {
    const os = this.oppositeSeat(this.seat);
    if (!os || os.by) return;
    const P = G.player, chaser = typeof CHASERS !== 'undefined' ? CHASERS[World.id] : null;
    const pool = G.npcs.filter(n => !n.seat && !n.chasing && !n.curious && !n.visitor && !n.sheltering && !n.person.runner && n.id !== chaser && !n.leaving && Math.hypot(n.x - P.x, n.y - P.y) < 15 * TS)
      .sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y));
    const n = pool.find(q => q.id.startsWith('p_')) || pool[0];
    if (!n) return;
    this.helper = { n, id: n.id, seat: os, wander: n.wander, spot: { ...n.spot }, said: false, leaveT: null };
    n.wander = null;
    n.seat = os;
    os.by = n.id;
    Game.setNpcSpot(n.id, os.exit);
    n.path.push({ x: os.x, y: os.y });
    n.spot = { x: os.x, y: os.y };
  },
  // After you get up, whoever came over stays a moment, then goes back to what they did.
  releaseHelper(dt) {
    const h = this.helper;
    if (!h) return;
    const n = G.npcs.find(q => q.id === h.id);
    if (!n || n !== h.n) { if (h.seat.by === h.id) h.seat.by = null; this.helper = null; return; }
    if (h.leaveT == null || (this.saved && this.saved.m.opp.id === h.id && performance.now() - this.saved.at < 4 * 60000)) return;
    h.leaveT -= dt;
    if (h.leaveT > 0) return;
    if (n.seat === h.seat) {
      n.seat = null;
      if (h.seat.by === n.id) h.seat.by = null;
      n.wander = h.wander;
      n.spot = h.spot;
      n.path = [{ x: h.seat.exit.x, y: h.seat.exit.y }, ...(World.path(h.seat.exit.x, h.seat.exit.y, h.spot.x, h.spot.y) || [])];
    }
    this.helper = null;
  },

  // ---------- looking and tapping ----------
  ray: null,
  // A ray from the camera through a screen point (−1..1), against the player's board.
  cast(nx, ny) {
    const b = this.board;
    if (!b || !Scene3D.camera) return null;
    const cam = Scene3D.camera;
    cam.updateMatrixWorld();
    b.g.updateMatrixWorld(true);
    this.ray = this.ray || new THREE.Raycaster();
    this.ray.setFromCamera(new THREE.Vector2(nx, ny), cam);
    const h = this.ray.intersectObjects(b.hits, false)[0];
    if (!h || h.distance > 2.2) return null;
    return { kind: h.object.userData.kind, idx: h.object.userData.idx };
  },
  bindTap() {
    if (this.tapBound) return;
    this.tapBound = true;
    const cv = $('#world');
    const downs = new Map();
    cv.addEventListener('pointerdown', (e) => downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }));
    cv.addEventListener('pointerup', (e) => {
      const d = downs.get(e.pointerId);
      downs.delete(e.pointerId);
      if (!d || !this.seat || !Scene3D.inSeat || G.paused || UI.busy) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 500) return;
      const r = cv.getBoundingClientRect();
      this.tap(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    });
  },
  tap(nx, ny) {
    const hit = this.cast(nx, ny);
    if (!hit) return;
    const a = this.actionFor(hit);
    if (a) a.action();
  },
  // The seat's E prompt while sitting (js/story.js): what the reticle points at.
  interact(st) {
    if (st !== this.seat || !this.board) return null;
    this.bindTap();
    const m = this.m;
    if (m && m.phase === 'roll') return { label: '🎲 לזרוק קוביות', action: () => this.roll() };
    // In a game, E never gets you up by accident: away from the board it does nothing.
    if (m && m.phase !== 'over') return this.actionFor(this.aim) || { label: '', action: () => {} };
    return this.aim ? this.actionFor(this.aim) : null;
  },
  actionFor(hit) {
    if (!hit) return null;
    const m = this.m;
    if (!m || m.phase === 'over') {
      const o = this.opp;
      if (!o) return { label: '🎲 שש בש — אין מול מי לשחק', action: () => UI.toast('🎲 צריך מישהו שישב מולך') };
      if (this.offer) return { label: `🎲 מחכים ל${o.name}...`, action: () => {} };
      return { label: `🎲 שש בש — להציע ל${o.name}`, action: () => this.propose() };
    }
    if (m.phase === 'roll') return { label: '🎲 לזרוק קוביות', action: () => this.roll() };
    if (m.phase !== 'move') return null;
    const t = hit.idx;
    if (m.sel != null && m.legal.some(x => x.from === m.sel && x.to === t)) return { label: t === 0 ? '⬇ להוציא מהלוח' : '⬇ להניח כאן', action: () => this.choose(t) };
    if (m.legal.some(x => x.from === t)) return { label: m.sel === t ? '✋ לבטל בחירה' : '✋ להרים אבן', action: () => this.choose(t) };
    if (m.sel == null && m.legal.some(x => x.to === t)) return { label: '⬇ להזיז לכאן', action: () => this.choose(t) };
    return null;
  },

  // ---------- offering a game ----------
  propose() {
    const o = this.opp;
    if (!o || this.m && this.m.phase !== 'over' || this.offer) return;
    Sound.click();
    this.hideEnd();
    if (o.kind === 'peer') {
      this.offer = { id: Math.floor(Math.random() * 1e9) + 1, to: o.p.who, seed: Math.floor(Math.random() * 2e9) + 1, at: performance.now() };
      this.say(`🎲 הזמנת את <bdi data-raw>${esc(o.name)}</bdi> לשש בש — מחכים לתשובה...`);
      return;
    }
    // A cast member thinks about it for a second.
    const n = o.n, again = this.m && this.m.phase === 'over';
    this.offer = { id: 1, npc: true, at: performance.now() };
    n.bubble = { text: '🤔', t: 1.2 };
    setTimeout(() => {
      this.offer = null;
      if (!this.seat || !this.opp || this.opp.id !== o.id) return;
      if (!again && !this.declined && Math.random() < 0.25) {
        this.declined++;
        this.npcSay(n, this.line('decline', n.person));
        Sound.bad();
        return;
      }
      this.npcSay(n, this.line(again ? 'again' : this.declined ? 'yes2' : 'accept', n.person));
      this.start({ opp: { kind: 'npc', id: o.id, name: o.name, person: o.person } });
    }, 1100 / this.speed);
  },
  // Friends online: offers, answers and turns, all read from their presence.
  netWatch() {
    if (!Multi.on) return;
    const o = this.opp, ps = o && o.kind === 'peer' ? this.peerS(o.p) : null;
    // Our offer: accepted, declined, or ignored for half a minute.
    if (this.offer && !this.offer.npc) {
      if (!o || o.kind !== 'peer' || o.p.who !== this.offer.to) { this.offer = null; }
      else if (ps && +ps.ac === this.offer.id) {
        const of = this.offer;
        this.offer = null;
        this.start({ opp: { kind: 'peer', who: o.p.who, name: o.name, person: o.person }, online: true, host: true, id: of.id, seed: of.seed });
      } else if (ps && +ps.dn === this.offer.id) {
        this.offer = null;
        this.say(`🎲 <bdi data-raw>${esc(o.name)}</bdi> לא בא לו עכשיו. אולי אחר כך.`);
        Sound.bad();
      } else if (performance.now() - this.offer.at > 30000) {
        this.offer = null;
        this.say('🎲 אין תשובה...');
      }
    }
    // Their offer to us.
    const of = ps && ps.of && typeof ps.of === 'object' ? ps.of : null;
    if (of && of.to === Multi.as && +of.id && !this.seen.has(+of.id) && (!this.m || this.m.phase === 'over')) {
      this.seen.add(+of.id);
      const id = +of.id, seed = +of.seed || 1, who = o.p.who, name = o.name;
      const go = () => {
        const q = this.opp, qs = q && q.kind === 'peer' ? this.peerS(q.p) : null;
        if (!qs || q.p.who !== who || !qs.of || +qs.of.id !== id) { UI.toast('🎲 ההזמנה כבר לא בתוקף', 'bad'); return; }
        if (this.m && this.m.phase !== 'over') return;
        this.ans = { ac: id };
        this.offer = null;
        this.start({ opp: { kind: 'peer', who, name, person: q.person }, online: true, host: false, id, seed });
      };
      // Both offered at once: the older offer wins, no questions asked.
      if (this.offer && !this.offer.npc && this.offer.to === who) { if (id < this.offer.id) go(); return; }
      if (Multi.verGate(o.p, 'מזמין לשש בש')) return;
      Sound.horn();
      const fem = o.person && o.person.female;
      UI.invite(`🎲 ${name} ${fem ? 'מזמינה' : 'מזמין'} אותך לשש בש!`, '🎲 לשחק', go);
      const card = $('#invite-card');
      const no = card && card.querySelector('[data-n]');
      if (no) no.addEventListener('click', () => { this.ans = { dn: id }; });
    }
  },
  presence() {
    if (!this.seat) return null;
    const s = { st: this.seatIdx(this.seat) };
    if (this.offer && !this.offer.npc) s.of = { id: this.offer.id, to: this.offer.to, seed: this.offer.seed };
    if (this.ans) Object.assign(s, this.ans);
    const m = this.m;
    if (m && m.online) { s.g = m.id; if (m.pub) s.t = m.pub; if (m.rolled != null) s.r = m.rolled; if (m.quit) s.x = m.id; }
    if (this.resigned) s.x = this.resigned;
    return s;
  },

  // ---------- a game ----------
  start(o) {
    const b = this.board;
    if (!b) return;
    this.saved = null;
    this.hideEnd();
    const m = this.m = {
      opp: o.opp, online: !!o.online, host: !!o.host, id: o.id || 0,
      pos: SheshRules.start(), side: 0, n: 0, dice: null, left: [], used: 0, moves: [], hist: [], legal: [], sel: null,
      phase: 'open', timers: [], idle: 0, nagAt: 120, pub: null, rolled: null,
    };
    b.pos = m.pos;
    this.layout(b);
    this.clearMarks();
    if (Scene3D.pitch < 1.0) this.tilt = 0.8;
    // Online, the offering player's seed throws every die of the game, the same on both phones.
    if (m.online) {
      const rnd = Arcade.rng(o.seed);
      for (let i = 0; i < 7; i++) rnd();
      m.seq = Array.from({ length: 600 }, () => 1 + Math.floor(rnd() * 6));
      m.si = 0;
    }
    const die = () => (m.online ? m.seq[m.si++ % m.seq.length] : 1 + Math.floor(Math.random() * 6));
    let a, c;
    for (let k = 0; k < 40; k++) { a = die(); c = die(); if (a !== c) break; }
    if (a === c) c = a % 6 + 1;
    // a is the host's (or the player's, against the cast), c the other's.
    const mine = !m.online || m.host ? a : c, theirs = !m.online || m.host ? c : a;
    m.open = [mine, theirs];
    Sound.whoosh && Sound.whoosh();
    this.throwDice(0, [mine], 0);
    this.throwDice(1, [theirs], 1);
    this.msg('זורקים מי מתחיל...');
    this.after(1.25, () => {
      const first = mine > theirs ? 0 : 1;
      this.msg(first === 0 ? `${mine} מול ${theirs} — [אתה מתחיל/את מתחילה]!` : `${theirs} מול ${mine} — ${m.opp.name} ${this.fem(m.opp) ? 'מתחילה' : 'מתחיל'}`);
      this.after(1.1, () => { m.side = first; m.n = 0; this.rolled(first, [mine, theirs]); });
    });
  },
  fem(opp) { return !!(opp && opp.person && opp.person.female); },
  after(sec, fn) { if (this.m) this.m.timers.push({ t: sec, fn }); },
  beginTurn(side) {
    const m = this.m;
    m.side = side; m.dice = null; m.left = []; m.used = 0; m.moves = []; m.hist = []; m.legal = []; m.sel = null;
    m.turnPos = SheshRules.copy(m.pos);
    m.idle = 0;
    this.clearMarks();
    if (side === 0) { m.phase = 'roll'; this.msg(`תורך — [זרוק/זרקי] את הקוביות`); }
    else if (m.online) { m.phase = 'remote'; m.shown = false; this.msg(`התור של ${m.opp.name}...`); }
    else { m.phase = 'ai'; this.msg(`${m.opp.name} ${this.fem(m.opp) ? 'זורקת' : 'זורק'}...`); this.after(0.8, () => this.roll()); }
  },
  // Back to the start of the turn (when the game is left mid-way).
  rewindTurn(m) {
    if (m.turnPos && m.phase !== 'open') { m.pos = SheshRules.copy(m.turnPos); m.moves = []; }
    m.timers = [];
  },
  diceFor(m) {
    if (!m.online) return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    return [m.seq[m.si++ % m.seq.length], m.seq[m.si++ % m.seq.length]];
  },
  // The player taps the dice button (or E); the cast's turn calls it too.
  roll() {
    const m = this.m;
    if (!m || (m.phase !== 'roll' && m.phase !== 'ai')) return;
    const side = m.side;
    const d = this.diceFor(m);
    m.phase = 'rolling';
    if (side === 0 && m.online) m.rolled = m.n;
    Sound.whoosh && Sound.whoosh();
    this.throwDice(side, d);
    this.after(0.95, () => this.rolled(side, d));
  },
  rolled(side, d) {
    const m = this.m;
    m.dice = d;
    m.left = d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : d.slice();
    m.turnPos = SheshRules.copy(m.pos);
    const t = SheshRules.turn(m.pos, side, m.left);
    m.max = t.max; m.only = t.only; m.used = 0; m.moves = []; m.hist = []; m.sel = null;
    if (d[0] === d[1] && m.n > 0 && m.opp.kind === 'npc') { const n = Game.npc(m.opp.id); if (n && Math.random() < 0.6) this.npcSay(n, this.line(side === 0 ? 'yourDouble' : 'myDouble', n.person)); }
    if (!t.max) {
      m.phase = 'pass';
      const n = m.opp.kind === 'npc' && Game.npc(m.opp.id);
      if (side === 0) { this.msg('אין לך מהלכים 🤷'); if (n) this.npcSay(n, this.line('youStuck', n.person)); }
      else { this.msg(`ל${m.opp.name} אין מהלכים`); if (n) this.npcSay(n, this.line('stuck', n.person)); }
      this.after(1.8, () => this.endTurn());
      return;
    }
    if (side === 0) {
      m.phase = 'move';
      this.refresh();
      this.msg(m.pos[0][25] ? 'יש לך אבן על הבר — להכניס אותה קודם' : '[בחר/בחרי] אבן, ואז לאן להזיז');
    } else if (!m.online) {
      m.phase = 'aimove';
      const plan = SheshRules.best(m.pos, 1, m.left);
      const step = (i) => {
        if (i >= plan.length) { this.after(0.6, () => this.endTurn()); return; }
        this.after(i ? 0.55 : 0.5, () => { this.move(1, plan[i]); if (this.m === m && m.phase === 'aimove') step(i + 1); });
      };
      step(0);
    } else m.phase = 'remote';
  },
  // The player's pick: a checker, then where it goes (or straight to a spot only one checker can reach).
  choose(t) {
    const m = this.m;
    if (!m || m.phase !== 'move') return;
    m.idle = 0;
    if (m.sel != null) {
      if (t === m.sel) { m.sel = null; Sound.click(); this.refresh(); return; }
      const mv = m.legal.filter(x => x.from === m.sel && x.to === t).sort((a, b) => a.d - b.d)[0];
      if (mv) { this.myMove(mv); return; }
    }
    if (m.legal.some(x => x.from === t)) {
      m.sel = t; Sound.click(); this.refresh();
      return;
    }
    const to = m.legal.filter(x => x.to === t);
    if (to.length && to.every(x => x.from === to[0].from)) { this.myMove(to.sort((a, b) => a.d - b.d)[0]); return; }
    Sound.bad();
  },
  myMove(mv) {
    const m = this.m;
    m.hist.push({ pos: SheshRules.copy(m.pos), left: m.left.slice(), moves: m.moves.slice() });
    m.sel = null;
    this.move(0, mv);
    if (this.m !== m || m.phase === 'over' || m.phase === 'over-wait') return;
    if (m.used >= m.max) { m.phase = 'done'; this.clearMarks(); this.msg('✔'); this.after(1.3, () => { if (m.phase === 'done') this.endTurn(); }); }
    else this.refresh();
  },
  undo() {
    const m = this.m;
    if (!m || (m.phase !== 'move' && m.phase !== 'done') || !m.hist.length) return;
    const h = m.hist.pop();
    m.pos = h.pos; m.left = h.left; m.moves = h.moves; m.used = m.moves.length; m.sel = null;
    m.timers = [];
    m.phase = 'move';
    this.board.pos = m.pos;
    this.layout(this.board);
    Sound.click();
    this.refresh();
    this.msg('[בחר/בחרי] אבן, ואז לאן להזיז');
  },
  // One checker moves (either side), with the hit checker flying to the bar.
  move(side, mv) {
    const m = this.m, b = this.board;
    const i = m.left.indexOf(mv.d);
    if (i >= 0) m.left.splice(i, 1);
    m.used++;
    m.moves.push([mv.from, mv.to]);
    const hit = mv.to >= 1 && m.pos[1 - side][25 - mv.to] === 1;
    m.pos = SheshRules.apply(m.pos, side, mv);
    b.pos = m.pos;
    const c = b.loc[side][mv.from].pop();
    if (c) { b.loc[side][mv.to].push(c); this.slide(c, side, mv.to, b.loc[side][mv.to].length - 1, 0, Sound.pop); }
    if (hit) {
      const o = 1 - side, h = b.loc[o][25 - mv.to].pop();
      if (h) { b.loc[o][25].push(h); this.slide(h, o, 25, b.loc[o][25].length - 1, 0.2, Sound.click); }
      const n = m.opp.kind === 'npc' && Game.npc(m.opp.id);
      if (n && Math.random() < 0.75) this.npcSay(n, this.line(side === 0 ? 'gotHit' : 'myHit', n.person));
      if (side === 0) Settings.buzz && Settings.buzz(40);
    }
    if (m.pos[side][0] === 15) { m.phase = 'over-wait'; this.after(0.5, () => this.finish(side)); }
  },
  endTurn() {
    const m = this.m;
    if (!m || m.phase === 'over' || m.phase === 'over-wait') return;
    if (m.online && m.side === 0) m.pub = { n: m.n, m: m.moves.slice(0, 4) };
    m.n++;
    this.beginTurn(1 - m.side);
  },
  // A friend's turn arrives in their presence: their throw, then their moves one by one.
  remote(dt) {
    const m = this.m, o = this.opp, ps = o && o.kind === 'peer' && o.p.who === m.opp.who ? this.peerS(o.p) : null;
    if (!ps || +ps.g !== m.id) {
      m.goneT = (m.goneT || 0) + dt;
      if (ps && +ps.x === m.id) { this.finish(0, true); return; }
      if (m.goneT > 4) { this.finish(0, true); return; }
      return;
    }
    m.goneT = 0;
    if (+ps.x === m.id) { this.finish(0, true); return; }
    if (m.phase !== 'remote') return;
    const t = ps.t && typeof ps.t === 'object' ? ps.t : null;
    if (!m.dice && (+ps.r === m.n || (t && +t.n === m.n))) {
      // Their dice come off the same seed as everyone's.
      const d = this.diceFor(m);
      m.dice = d;
      this.throwDice(1, d);
      m.phase = 'rolling';
      this.after(0.95, () => { m.phase = 'remote'; this.rolled(1, d); });
      return;
    }
    if (!m.dice || !t || +t.n !== m.n) return;
    m.phase = 'aimove';
    const list = Array.isArray(t.m) ? t.m.slice(0, 4) : [];
    const step = (i) => {
      if (i >= list.length) { this.after(0.5, () => this.endTurn()); return; }
      this.after(0.45, () => {
        const from = Math.floor(+list[i][0]), to = Math.floor(+list[i][1]);
        let mv = SheshRules.legal(m.pos, 1, m.left, m.max - m.used, m.only).find(x => x.from === from && x.to === to);
        // Out of step (shouldn't happen: same rules, same dice): trust their board.
        if (!mv) { m.desync = (m.desync || 0) + 1; mv = { from, to, d: m.left.find(d => d === from - to) || m.left.find(d => d > from - to) || m.left[0], hit: false }; }
        if (from >= 0 && from <= 25 && to >= 0 && to <= 25 && m.pos[1][from] > 0) this.move(1, mv);
        if (this.m === m && m.phase === 'aimove') step(i + 1);
      });
    };
    step(0);
  },
  quit() {
    const m = this.m;
    if (!m || m.phase === 'over') return;
    if (!this.quitArm || performance.now() - this.quitArm > 3000) { this.quitArm = performance.now(); this.msg('לפרוש? עוד לחיצה על 🏳️'); Sound.click(); return; }
    this.quitArm = 0;
    if (m.online) m.quit = true;
    this.finish(1, false, true);
  },
  finish(winner, tech = false, quit = false) {
    const m = this.m;
    if (!m || m.phase === 'over') return;
    m.phase = 'over';
    m.timers = [];
    // Won on the board: the last turn still goes out, so their board ends the same way.
    if (m.online && winner === 0 && !tech && !quit && m.side === 0) m.pub = { n: m.n, m: m.moves.slice(0, 4) };
    this.clearMarks();
    const loser = 1 - winner, mars = !tech && !quit && m.pos[loser][0] === 0;
    const n = m.opp.kind === 'npc' && Game.npc(m.opp.id);
    let title, sub = '', prize = 0, morale = 3;
    if (winner === 0) {
      prize = tech ? 0 : mars ? 12 : 6;
      morale = tech ? 3 : 10;
      title = mars ? '🏆 מארס! ניצחון כפול' : tech ? '🏆 ניצחון טכני' : '🏆 ניצחת!';
      if (tech) sub = `${m.opp.name} ${this.fem(m.opp) ? 'קמה' : 'קם'} מהשולחן`;
      if (n) this.npcSay(n, this.line(mars ? 'mars' : 'iLose', n.person));
      Sound.fanfare();
      if (prize) { G.state.money += prize; Sound.coin(); }
    } else {
      title = quit ? '🏳️ פרשת' : mars ? '😱 מארס... הפסד כפול' : '🎲 הפסדת';
      sub = quit ? '' : 'לפחות ישבת קצת בצל';
      if (n) this.npcSay(n, this.line(quit ? 'quit' : 'iWin', n.person));
      Sound.bad();
    }
    Game.addStat('morale', morale);
    this.msg(title);
    this.showEnd(title, sub, prize, morale);
  },
  play(dt) {
    const m = this.m;
    for (const t of m.timers.splice(0)) { t.t -= dt * this.speed; if (t.t <= 0) t.fn(); else if (this.m === m && m.phase !== 'over') m.timers.push(t); }
    if (this.m !== m) return;
    if (m.online && m.phase !== 'over') this.remote(dt);
    // Two minutes without a move: the cast member across the table says something.
    if (m.opp.kind === 'npc' && (m.phase === 'roll' || m.phase === 'move')) {
      m.idle += dt;
      if (m.idle > m.nagAt) {
        m.nagAt = m.idle + 60;
        const n = Game.npc(m.opp.id);
        if (n) this.npcSay(n, this.line('nag', n.person));
      }
    }
    // The cast member got up (an alert, a story scene): the game waits for both of you.
    if (m.opp.kind === 'npc' && m.phase !== 'over' && (!this.opp || this.opp.id !== m.opp.id)) {
      this.rewindTurn(m);
      this.saved = { m, seat: this.seat, at: performance.now() };
      this.m = null;
      this.clearMarks();
      this.msg('');
      this.resumeT = 1;
    }
  },

  // ---------- highlights ----------
  clearMarks() {
    const b = this.board;
    if (this.lifted) {
      const l = this.lifted;
      this.lifted = null;
      if (!this.anims.some(a => a.c === l.c)) l.c.position.y = l.y;
    }
    if (!b) return;
    for (const t of b.tri) if (t) t.visible = false;
    for (const r of b.rings) r.visible = false;
    for (const g of b.ghosts) g.visible = false;
  },
  // Legal moves now: gold rings on the checkers that can move, ghosts where the picked one goes.
  refresh() {
    const m = this.m, b = this.board;
    if (!m || !b) return;
    m.legal = m.phase === 'move' || m.phase === 'done' ? SheshRules.legal(m.pos, 0, m.left, m.max - m.used, m.only) : [];
    this.clearMarks();
    const froms = [...new Set(m.legal.map(x => x.from))];
    froms.forEach((f, k) => {
      const r = b.rings[k], n = b.loc[0][f].length;
      if (!r || !n) return;
      const p = this.local(this.slot(0, f, n - 1));
      r.position.set(p.x, p.y + this.CH / 2 + 0.0015 + (m.sel === f ? 0.02 : 0), p.z);
      r.material.color.copy(this.lin(m.sel === f ? 0x2fd24f : 0xffb300));
      r.visible = true;
      r.userData.base = r.position.y;
    });
    if (m.sel != null) {
      const list = b.loc[0][m.sel], top = list[list.length - 1];
      if (top && !this.anims.some(a => a.c === top)) { const y = this.local(this.slot(0, m.sel, list.length - 1)).y; this.lifted = { c: top, y }; top.position.y = y + 0.02; }
      m.legal.filter(x => x.from === m.sel).forEach((x, k) => {
        const g = b.ghosts[k];
        if (!g) return;
        const n = b.loc[0][x.to].length;
        const sl = this.slot(0, x.to, n);
        g.position.copy(this.local(sl));
        g.rotation.set(sl.edge ? Math.PI / 2 : 0, 0, 0);
        g.visible = true;
        if (b.tri[x.to]) b.tri[x.to].visible = true;
      });
    }
  },

  // ---------- animation ----------
  slide(c, side, idx, k, delay, sound) {
    const sl = this.slot(side, idx, k);
    this.anims = this.anims.filter(a => a.c !== c);
    this.anims.push({ c, a: c.position.clone(), b: this.local(sl), ra: c.rotation.x, rb: sl.edge ? Math.PI / 2 : 0, t: -delay, dur: 0.38, lift: 0.05, sound });
  },
  throwDice(side, vals, slotK = null) {
    const b = this.board;
    if (!b) return;
    const sgn = side === 0 ? 1 : -1;
    vals.forEach((v, j) => {
      const k = slotK != null ? slotK : j;
      const d = b.dice[k];
      d.visible = true;
      const eu = sgn * (0.11 + j * 0.07 + Math.random() * 0.03), ev = -sgn * (0.02 + Math.random() * 0.05);
      // On top of a tall pile, if one is in the way.
      const pi = this.pointAt(eu, ev), pile = pi ? Math.max(b.pos[0][pi], b.pos[1][25 - pi]) : 0;
      const y = this.H + 0.0105 + (pile >= 5 ? Math.ceil(pile / 5) * this.CH : 0);
      const n = [null, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(-1, 0, 0)][v];
      const q = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 1, 0));
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2));
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      this.anims = this.anims.filter(a => a.c !== d);
      this.anims.push({ c: d, die: true, a: new THREE.Vector3(-sgn * (0.06 + j * 0.05), 0.16, -sgn * 0.33), b: new THREE.Vector3(-eu, y, ev), q, axis, spin: 13 + Math.random() * 6, t: 0, dur: 0.85, bounced: 0 });
    });
  },
  pointAt(u, v) {
    for (let i = 1; i <= 24; i++) if (Math.abs(this.colU(i) - u) < 0.026 && (i <= 12) === (v < 0)) return i;
    return 0;
  },
  stepAnims(dt) {
    if (!this.anims.length) return;
    const qa = new THREE.Quaternion();
    this.anims = this.anims.filter(a => {
      a.t += dt * this.speed;
      if (a.t < 0) return true;
      const k = Math.min(1, a.t / a.dur);
      if (a.die) {
        const e = 1 - (1 - k) * (1 - k);
        a.c.position.lerpVectors(a.a, a.b, e);
        a.c.position.y = a.b.y + (a.a.y - a.b.y) * (1 - k) ** 1.6 * Math.abs(Math.cos(k * Math.PI * 2.5));
        qa.setFromAxisAngle(a.axis, a.spin * (1 - k) ** 2);
        a.c.quaternion.copy(a.q).multiply(qa);
        const bounce = Math.floor(k * 2.5 + 0.5);
        if (bounce > a.bounced && k < 1) { a.bounced = bounce; Sound.click(); }
        return k < 1;
      }
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      a.c.position.lerpVectors(a.a, a.b, e);
      a.c.position.y += Math.sin(Math.PI * k) * a.lift;
      a.c.rotation.x = a.ra + (a.rb - a.ra) * e;
      if (k >= 1 && a.sound) a.sound();
      return k < 1;
    });
  },

  // ---------- talk ----------
  line(kind, person) {
    const own = person && SHESH_OWN[person.id] && SHESH_OWN[person.id][kind];
    const list = own && Math.random() < 0.6 ? own : SHESH_LINES[kind];
    const t = list[Math.floor(Math.random() * list.length)];
    const fem = !!(person && person.female);
    return t.replace(/«([^|»]*)\|([^»]*)»/g, (_, a, b) => (fem ? b : a));
  },
  npcSay(n, text) {
    const t = fmtAs(n.person, text);
    n.bubble = { text: t, t: 4 };
    n.barkCd = Math.max(n.barkCd || 0, 12);
    Sound.pop();
    this.say(`<b>${esc(n.short)}:</b> ${esc(t)}`, true);
  },
  say(html, raw = false) {
    this.sayHtml = raw ? html : fmt(html);
    this.sayUntil = performance.now() + 4200;
  },
  msg(text) { if (this.m) this.m.msg = text ? fmt(text) : ''; },

  // ---------- the HUD ----------
  ui() {
    let u = $('#shesh');
    if (u) return u;
    u = document.createElement('div');
    u.id = 'shesh';
    u.innerHTML = `<div class="sb-ret"></div>
      <div class="sb-top hidden"><div class="sb-p me"><i class="sb-chip w"></i><b class="sb-n"></b><span class="sb-pip"></span></div>
        <div class="sb-mid"><div class="sb-dice"></div><div class="sb-msg"></div></div>
        <div class="sb-p op"><i class="sb-chip b"></i><b class="sb-n"></b><span class="sb-pip"></span></div></div>
      <div class="sb-say hidden"></div>
      <div class="sb-btns hidden"><button class="btn sb-roll">🎲 לזרוק</button><button class="btn ghost sb-undo" title="ביטול מהלך">↩ ביטול</button><button class="btn ghost sb-flag" title="פרישה">🏳️</button></div>
      <div class="sb-end hidden"></div>
      <div class="sb-tip hidden"></div>`;
    document.body.appendChild(u);
    const stop = (e) => e.stopPropagation();
    for (const b of u.querySelectorAll('button')) b.addEventListener('pointerdown', stop);
    u.querySelector('.sb-roll').onclick = () => { if (this.m) this.m.idle = 0; this.roll(); };
    u.querySelector('.sb-undo').onclick = () => this.undo();
    u.querySelector('.sb-flag').onclick = () => this.quit();
    return u;
  },
  hud() {
    const on = !!(this.seat && Scene3D.inSeat && G.running && !Arcade.active && !Race.active);
    let u = $('#shesh');
    if (!on) { if (u) u.classList.add('hidden'); document.body.classList.remove('shesh-fpv', 'shesh-game'); return; }
    u = this.ui();
    u.classList.remove('hidden');
    const m = this.m, now = performance.now();
    document.body.classList.add('shesh-fpv');
    document.body.classList.toggle('shesh-game', !!m);
    const set = (sel, html) => { const e = u.querySelector(sel); if (e && e.innerHTML !== html) e.innerHTML = html; return e; };
    const act = this.aim && this.actionFor(this.aim);
    u.querySelector('.sb-ret').classList.toggle('on', !!act);
    // The board glows while you look at it to offer a game.
    if (this.board) {
      const glow = !m && this.aim && this.opp && !this.offer;
      this.board.frame.emissive.setHex(glow ? 0x7a5a10 : 0x000000);
      this.board.frame.emissiveIntensity = glow ? 0.6 + Math.sin(now / 160) * 0.4 : 0;
      const k = Math.sin(now / 150);
      for (const r of this.board.rings) if (r.visible) r.material.opacity = 0.75 + k * 0.22;
      for (const g of this.board.ghosts) if (g.visible) g.material.opacity = 0.55 + k * 0.2;
      for (const t of this.board.tri) if (t && t.visible) t.material.opacity = 0.65 + k * 0.25;
    }
    const top = u.querySelector('.sb-top');
    top.classList.toggle('hidden', !m);
    if (m) {
      const R = SheshRules;
      set('.me .sb-n', esc(G.profile.name || 'אני'));
      set('.op .sb-n', esc(m.opp.name));
      set('.me .sb-pip', `${R.pips(m.pos[0])}${m.pos[0][0] ? ` · <em>${m.pos[0][0]}/15</em>` : ''}`);
      set('.op .sb-pip', `${R.pips(m.pos[1])}${m.pos[1][0] ? ` · <em>${m.pos[1][0]}/15</em>` : ''}`);
      u.querySelector('.me').classList.toggle('turn', m.side === 0 && m.phase !== 'over' && m.phase !== 'open');
      u.querySelector('.op').classList.toggle('turn', m.side === 1 && m.phase !== 'over' && m.phase !== 'open');
      const F = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      let dice = '';
      if (m.dice && m.phase !== 'rolling') {
        const all = m.dice[0] === m.dice[1] ? [m.dice[0], m.dice[0], m.dice[0], m.dice[0]] : m.dice.slice();
        const left = m.left.slice();
        dice = all.map(v => { const i = left.indexOf(v); if (i >= 0) left.splice(i, 1); return `<span class="${i >= 0 ? '' : 'used'}">${F[v]}</span>`; }).join('');
      } else if (m.phase === 'rolling') dice = '<span class="spin">🎲</span>';
      set('.sb-dice', dice);
      set('.sb-msg', m.msg || '');
    }
    const say = u.querySelector('.sb-say');
    if (this.sayHtml && now < this.sayUntil) { set('.sb-say', this.sayHtml); say.classList.remove('hidden'); } else say.classList.add('hidden');
    const btns = u.querySelector('.sb-btns');
    const live = m && m.phase !== 'over';
    btns.classList.toggle('hidden', !live);
    if (live) {
      u.querySelector('.sb-roll').classList.toggle('hidden', m.phase !== 'roll');
      u.querySelector('.sb-undo').classList.toggle('hidden', !((m.phase === 'move' || m.phase === 'done') && m.hist.length));
    }
    const tip = u.querySelector('.sb-tip');
    const showTip = now < (this.tipUntil || 0) && !m;
    tip.classList.toggle('hidden', !showTip);
    if (showTip) set('.sb-tip', G.touch ? '👆 גרירה — להסתכל · הקשה על הלוח · ג\'ויסטיק — לקום' : '🖱️ גרירה — להסתכל · לחיצה על הלוח או <kbd>E</kbd> · <kbd>W</kbd> — לקום');
  },
  showEnd(title, sub, prize, morale) {
    const u = this.ui(), e = u.querySelector('.sb-end');
    e.innerHTML = `<h3>${fmt(title)}</h3>${sub ? `<p>${fmt(sub)}</p>` : ''}<p class="sb-prize">${prize ? `${prize}₪+ · ` : ''}מורל ${morale}+</p>
      <div class="sb-row"><button class="btn small" data-a>🔁 עוד משחק</button><button class="btn small ghost" data-c>✕</button></div>`;
    e.classList.remove('hidden');
    for (const b of e.querySelectorAll('button')) b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    e.querySelector('[data-a]').onclick = () => { Sound.click(); this.hideEnd(); this.propose(); };
    e.querySelector('[data-c]').onclick = () => { Sound.click(); this.hideEnd(); };
  },
  hideEnd() { const e = $('#shesh .sb-end'); if (e) e.classList.add('hidden'); },
};

// Our seat and game ride in the arcade's presence slot while no arcade game is on.
(() => {
  const own = Arcade.presence.bind(Arcade);
  Arcade.presence = () => {
    const a = own();
    if (a) return a;
    const s = Shesh.presence();
    return s ? { g: 'shesh', id: 1 + s.st, host: false, cd: 0, s } : null;
  };
})();
