// Levels and daily events layered on the base story: lunch from Rafael catering, technician
// inspections, Amsalem's chores at HQ, Yasmin's boss inspection, the battery commander's
// surprise visit, cooking, the storeroom, Liran's course request, Arad, and the
// "שחורה" meter (how fed up you are; it drops as going home gets closer).

// Calendar date for a story day, as "DD/MM".
function gameDate(day, offset = 0) {
  const [d0, m0] = DATA.startDate;
  const dt = new Date(2026, m0 - 1, d0 + day - 1 + offset);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear() % 100).padStart(2, '0')}`;
}

const TECH_STEPS = [
  { id: 'launcher', label: 'להראות את משגר 1', title: 'ניגוב אבק מהמשגר', at: () => launcherSpot(World.launchers[0]) },
  { id: 'generator', label: 'להראות את הגנרטור', title: 'בדיקת שמן ודלק', at: () => SPOTS.generator },
  { id: 'hamal', label: 'להראות את עמדת הבקרה', title: 'הפעלה מחדש של העמדה', at: () => SPOTS.hamal },
];
const TECH_LINES = {
  tech_launch: { hi: 'ביקורת טכנאים. אני בודק את המשגרים. ואת מי שנגע בהם.', launcher: 'יש פה טביעת אצבע. היא שלך? ...תנגב[/י]. עכשיו.', generator: 'גנרטור זה לא שלי. אבל אני שופט.', hamal: 'מסכים נקיים זה טוב. מסכים דולקים — עוד יותר טוב.' },
  tech_ground: { hi: 'ביקורת ציוד קרקע! אני ה{first} שמתקן. בואו נראה מה {@p_nevo} שבר החודש.', launcher: 'המשגר בסדר. אל תגיד[/י] לו שאמרתי, שלא יתגאה.', generator: 'רעש? רעש זה טוב. גנרטור שמח.', hamal: 'מי שפך פה Blue על המקלדת?! ...{@p_ofek}.' },
  tech_comms: { hi: 'ביקורת תקשוב. לפני שאת[ה/] שואל[/ת] — כן, כיביתי והדלקתי.', launcher: 'הכבלים פה מסודרים כמו ספגטי. [תסדר/תסדרי].', generator: 'הגנרטור מפריע לי לקליטה. או שזה {@p_arad}.', hamal: 'הקשר עובד. אם הוא לא יעבוד — זה בגלל שנגעת.' },
};

const Events = {
  rafael: null,   // the catering truck while it is on site
  tech: null,     // { id, step, errors } during a technician inspection
  baum: null,     // the battery commander's visit: { t, food, phase }
  chores: null,   // Amsalem's chores at HQ: { ext: [...], puddle, dragging }
  fartCd: 15,

  // ---------- day lifecycle ----------
  startDay(day) {
    const S = G.state;
    S.flags = S.flags || {};
    S.junkDone = S.junkDone || [];
    if (S.shchora == null) S.shchora = 45;
    if (!S.homeDay) S.homeDay = DATA.homeDay;
    this.rafael = null;
    this.tech = null;
    this.baum = null;
    this.chores = null;
    // Technician inspections: day 2 in the story, and now and then afterwards.
    const story = S.mode === 'story' && !S.graduated;
    if (story ? day === 2 : Math.random() < 0.5) S.dayFlags.techAt = story ? 15 * 60 : (13 + Math.random() * 4) * 60;
    // Every morning the meter settles a bit lower the closer going home is.
    S.shchora = Math.max(this.base(), Math.min(100, S.shchora - 6));
  },
  daysToHome() { const S = G.state; return Math.max(0, (S.homeDay || DATA.homeDay) - S.day); },
  base() { return 10 + this.daysToHome() * 9; },

  // ---------- per frame ----------
  update(dt) {
    const S = G.state;
    const free = !G.alert && !Mini.active && !UI.busy && !Story.gateShift && !Boss.active;
    // The meter relaxes toward its base; above 85 it eats into morale.
    const mins = dt * DATA.minutesPerSecond;
    if (S.shchora > this.base()) S.shchora = Math.max(this.base(), S.shchora - mins * 0.02);
    if (S.shchora >= 85) S.morale = Math.max(0, S.morale - mins * 0.01);

    if (S.clock >= 11 * 60 && !S.dayFlags.rafael && free) this.startRafael();
    if (this.rafael) this.updateRafael(dt);
    if (S.dayFlags.techAt && S.clock >= S.dayFlags.techAt && !S.dayFlags.tech && free && World.id === 'netivot') this.startTech();
    if (this.tech) this.updateTech(dt);
    this.watchBaum();
    if (this.baum) this.updateBaum(dt);
    if (this.chores) this.updateChores(dt);

    // Arad. Everyone knows. Nobody talks about it.
    this.fartCd -= dt;
    const arad = Game.npc('p_arad');
    if (arad && this.fartCd <= 0 && !G.alert && Math.hypot(arad.x - G.player.x, arad.y - G.player.y) < 130) {
      this.fartCd = 22 + Math.random() * 20;
      this.fart(arad);
    }
  },
  fart(n) {
    Sound.fart();
    Scene3D.greenPuff(n.x, n.y, (n.person.scale || 1) * 1.1);
    n.bubble = { text: fmtAs(n.person, pick(['💨 סליחה', 'פררררט... סליחה', 'זה היה הכיסא!', 'בחולדה זה נחשב מחמאה'])), t: 3 };
    Game.addStat('morale', -1);
  },

  // ---------- interactables ----------
  interactables(add) {
    const S = G.state, P = G.player;
    if (World.id === 'netivot') {
      add(SPOTS.stove.x, SPOTS.stove.y, this.cookLabel(), () => this.cook(), 30);
      add(SPOTS.fridge.x, SPOTS.fridge.y, Story.has('y_fridge') ? 'לרשום תוקפים במקרר' : 'לפתוח את המקרר', () => this.fridge(), 28);
      for (const o of World.objects) {
        if (o.kind !== 'junk' || o.gone) continue;
        const j = DATA.junk.find(x => x.id === o.junk);
        add(o.x + o.w / 2, o.y + o.h / 2, Story.has('y_store') ? `לסדר: ${fmt(j.name)}` : `${j.icon} ${fmt(j.name)}`, () => this.junk(o, j), 30);
      }
      const r = this.rafael;
      if (r && r.state === 'waiting' && !P.carry && r.left.length) add(r.x, r.y, `לקחת ${r.left[0] === 'water' ? 'שישיית מים' : 'ארגז אוכל'} מרפאל`, () => this.takeFromRafael(), 80);
      if (r && (P.carry === 'crate' || P.carry === 'water')) add(SPOTS.diningDrop.x, SPOTS.diningDrop.y, 'להניח בחדר האוכל', () => this.deliverRafael(), 44);
      if (this.tech && this.tech.step < TECH_STEPS.length) {
        const st = TECH_STEPS[this.tech.step];
        const at = st.at();
        add(at.x, at.y, st.label, () => this.techStep(), 46);
      }
      if (this.baum && this.baum.phase === 'hide') {
        if (!P.carry) for (const f of this.baum.food) if (!f.hidden && !f.carried && !f.peerCarried) add(f.x, f.y, `להרים: ${f.name}`, () => this.pickFood(f), 34);
        if (P.carry === 'food') for (const h of this.hideSpots()) add(h.x, h.y, h.label, () => this.hideFood(h), h.r || 32);
      }
      add(SPOTS.pullup.x, SPOTS.pullup.y, 'מתקן מתח', () => this.pullups(), 30);
      if (Multi.on && !this.baum) add(SPOTS.board.x, SPOTS.board.y + 30, '🍕 נוהל אנה פרנק — {@bc} מגיעה! (לכל מי שבנתיבות)', () => this.startBaumCoop(), 34);
    } else if (World.id === 'hq') {
      add(SPOTS_HQ.stove.x, SPOTS_HQ.stove.y, this.cookLabel(), () => this.cook(), 30);
      const c = this.chores;
      if (c) {
        if (!P.carry) for (const e of c.ext) if (!e.done) add(e.x, e.y, 'להרים מטף', () => { P.carry = 'ext'; c.carrying = e; Sound.pickup(); }, 34);
        if (P.carry === 'ext') add(SPOTS_HQ.dropExt.x, SPOTS_HQ.dropExt.y, 'להניח את המטף "שם"', () => this.dropExt(), 50);
        if (!P.carry && !c.puddle.done) add(c.puddle.x, c.puddle.y, 'לגרור את השלולית עם מגב', () => { P.carry = 'squeegee'; c.dragging = true; Sound.sweep(); }, 46);
        if (c.dragging) add(SPOTS_HQ.drain.x, SPOTS_HQ.drain.y, 'לשפוך את השלולית "לשם"', () => this.dropPuddle(), 54);
      }
    }
  },

  // NPC conversations owned by events. Returns true when it handled the talk.
  async talkTo(n) {
    const S = G.state;
    if (n.id === 'p_liran') {
      if (!S.flags.ugga) {
        S.flags.ugga = 1;
        await UI.talk([
          { who: 'p_liran', text: 'אוגה בוגה. {first} רוצה קורס מיירטים. מיירט עושה בום. {first} אוהב בום.' },
          { who: 'p_liran', text: '[תביא/תביאי] ל{first} טופס הקצאה מ{@interceptors} בשו"ב? {first} ייתן לך אבן. אבן טובה.' },
        ]);
        Story.addTask('ugga', false);
        return true;
      }
      if (S.flags.ugga === 2) {
        S.flags.ugga = 3;
        await UI.talk([
          { who: 'p_liran', text: 'אוגה בוגה!!! טופס! {first} ממלא טופס! ...איך כותבים "מיירט"? עם ט או עם ת?' },
          { who: 'p_liran', text: 'הנה אבן. {first} אוהב אותך. אבל לא כמו מיירטים.' },
        ]);
        Story.complete('ugga', 3, 'עזרת ל{@p_liran}');
        Game.achieve('ugga');
        return true;
      }
    }
    if (n.id === 'interceptors' && S.flags.ugga === 1) {
      S.flags.ugga = 2;
      await UI.talk([
        { who: 'interceptors', text: '{@p_liran}? זה שעושה "בום" עם הפה? ...טוב. הנה טופס בקשת הקצאה לקורס מיירטים.' },
        { who: 'interceptors', text: 'שימלא בעט. לא בפחם. ולא על קיר המערה.' },
      ]);
      UI.toast('קיבלת טופס הקצאה 📝 — להביא ל{@p_liran}', 'good');
      return true;
    }
    if (n.id === 'p_arad' && Math.random() < 0.5) { this.fart(n); return false; }
    if (n.id === 'p_shaked' && !S.dayFlags.shakedSnack) {
      S.dayFlags.shakedSnack = true;
      await UI.talk([{ who: 'p_shaked', text: pick(['[קח/קחי] חטיף חלבון. בלי סוכר, בלי שמחה, עם המון חלבון 💪', 'אכלת היום ירק? במבה זה לא ירק. [קח/קחי] גזר.']) }]);
      Game.addStat('energy', 10);
      UI.toast('אנרגיה +10 🥕', 'good');
      return true;
    }
    if (n.id === 'p_ofek' && !S.dayFlags.blue) {
      S.dayFlags.blue = true;
      await UI.talk([{ who: 'p_ofek', text: 'רוצה Blue? יש לי חמש. ...ארבע. אחת כבר בדם. ככה נהיים הכי מבצעיים בפלגה 💙' }]);
      Game.addStat('energy', 20);
      Game.addStat('morale', -2);
      UI.toast('אנרגיה +20 ⚡ (והלב דופק)', 'good');
      return true;
    }
    return false;
  },

  // ---------- shchora ----------
  addShchora(d, reason) {
    const S = G.state;
    S.shchora = Math.max(0, Math.min(100, (S.shchora || 0) + d));
    if (reason && Math.abs(d) >= 4) UI.toast(`${d > 0 ? '🖤 +' : '🤍 '}${d} שחורה — ${reason}`, d > 0 ? 'bad' : 'good');
  },

  // ---------- Rafael catering, every day at 11:00 ----------
  startRafael() {
    const S = G.state;
    S.dayFlags.rafael = true;
    if (World.id !== 'netivot') { UI.toast('🚚 רפאל קייטרינג הגיעו לנתיבות. {@p_liran} סחב הכל במקומך. אוגה בוגה.'); return; }
    this.rafael = { x: 30.5 * TS, y: 46 * TS, angle: -Math.PI / 2, state: 'arriving', left: ['crate', 'crate', 'water'], delivered: 0 };
    World.gateTarget = 1;
    Sound.truck();
    UI.toast('🚚 11:00 — רפאל קייטרינג בשער עם ארוחת הצהריים!');
    Story.addTask('rafael');
  },
  updateRafael(dt) {
    const r = this.rafael;
    const S = G.state;
    const sp = 150 * dt;
    const drive = (tx, ty) => {
      const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
      if (d < sp) { r.x = tx; r.y = ty; return true; }
      r.x += dx / d * sp; r.y += dy / d * sp; r.angle = Math.atan2(dy, dx);
      return false;
    };
    if (r.state === 'arriving' && drive(SPOTS.truck.x, SPOTS.truck.y)) {
      r.state = 'waiting';
      World.gateTarget = 0;
      Sound.horn();
      UI.talk([{ who: 'rafael', text: pick([
        'רפאל קייטרינג! שני ארגזים ושישיית מים. לא, לא רפאל של כיפת ברזל. אצלנו המיירטים הם שניצלים.',
        'צהריים! [תסחב/תסחבי] לחדר האוכל, אני לא נכנס. בפעם האחרונה {@inspector} נתנה לי מסדר.',
        'שניצל, פירה ואורז. כמו אתמול. וכמו מחר. זה נקרא יציבות.',
      ]) }]);
    } else if (r.state === 'leaving') {
      World.gateTarget = 1;
      if (drive(30.5 * TS, 47 * TS)) { this.rafael = null; World.gateTarget = 0; }
    } else if (r.state === 'waiting' && S.clock > 12 * 60 + 40 && Story.has('rafael')) {
      r.state = 'leaving';
      if (G.player.carry === 'crate' || G.player.carry === 'water') G.player.carry = false;
      Story.complete('rafael', -5, 'רפאל חיכו ונסעו');
      UI.talk([{ who: 'commander', text: 'רפאל נסעו כי אף אחד לא פרק? {platoon}, היום אוכלים במבה לצהריים. תודה ל{name}.' }]);
    }
  },
  takeFromRafael() {
    const r = this.rafael;
    G.player.carry = r.left.shift();
    Sound.pickup();
    UI.toast(G.player.carry === 'water' ? 'שישיית מים 💧 — לחדר האוכל' : 'ארגז אוכל 📦 — לחדר האוכל');
  },
  deliverRafael() {
    const r = this.rafael;
    G.player.carry = false;
    r.delivered++;
    Sound.good();
    if (r.delivered < 3) { UI.toast(`נפרקו ${r.delivered}/3`, 'good'); return; }
    r.state = 'leaving';
    Story.complete('rafael', 5, 'פריקת רפאל');
    this.addShchora(4, 'סחבת ארגזים');
    Game.achieve('rafael');
    G.state.dayFlags.rafaelFood = true;
    UI.talk([{ who: 'rafael', text: 'יאללה, נתראה מחר ב־11:00. ותגיד[/י] ל{@p_ofek} שאין לנו Blue ושיפסיק לשאול.' }]);
  },

  // ---------- technician inspection ----------
  startTech() {
    const S = G.state;
    S.dayFlags.tech = true;
    const id = pick(['tech_launch', 'tech_ground', 'tech_comms']);
    this.tech = { id, step: 0, errors: 0 };
    Game.addVisitor(id, SPOTS.gate);
    Game.setNpcSpot(id, SPOTS.parade);
    Sound.horn();
    UI.toast(fmt(`🔧 ביקורת טכנאים! ${Cast.short(id)} הגיע[/ה] לאתר`), 'bad');
    Story.addTask('techcheck');
    UI.talk([{ who: id, text: TECH_LINES[id].hi }, { who: 'commander', text: '{name}, [תלווה/תלווי] את הטכנאי: משגר, גנרטור ועמדת בקרה. ותחייך[/י]. לא יותר מדי.' }]);
    this.addShchora(6, 'ביקורת טכנאים');
  },
  updateTech(dt) {
    const t = this.tech;
    if (World.id !== 'netivot') {
      this.tech = null;
      Story.complete('techcheck', 0, 'הטכנאי חיכה ונסע');
      return;
    }
    // The technician follows a step behind the player.
    t.follow = (t.follow || 0) - dt;
    const n = Game.npc(t.id);
    if (n && t.follow <= 0) {
      t.follow = 0.8;
      const P = G.player;
      if (Math.hypot(n.x - P.x, n.y - P.y) > 70) n.path = World.path(n.x, n.y, P.x, P.y) || [];
    }
  },
  async techStep() {
    const t = this.tech;
    const st = TECH_STEPS[t.step];
    const n = Game.npc(t.id);
    if (n && Math.hypot(n.x - G.player.x, n.y - G.player.y) > 160) { UI.toast(fmt(`לחכות ש${Cast.short(t.id)} יגיע[/תגיע]`)); return; }
    await UI.talk([{ who: t.id, text: TECH_LINES[t.id][st.id] }]);
    const r = await Mini.open('qte', { title: st.title, sub: 'הטכנאי מסתכל. [הקש/הקישי] את הרצף בלי לפספס!', length: 5, time: 8, silent: true });
    if (!r.success || r.errors) t.errors++;
    UI.toast(r.success ? '✔ עבר' : '✘ הערה בדוח', r.success ? 'good' : 'bad');
    t.step++;
    if (t.step < TECH_STEPS.length) return;
    const ok = t.errors === 0;
    await UI.talk([{ who: t.id, text: ok ? 'אין הערות. זה לא קרה לי מאז הקורס. אני רושם את זה כתקלה.' : `${t.errors} הערות בדוח. זה לא נורא. זה גם לא טוב. זה דוח.` }]);
    Story.complete('techcheck', ok ? 8 : 3, 'ביקורת טכנאים');
    if (ok) Game.achieve('tech');
    Game.setNpcSpot(t.id, SPOTS.gate);
    const id = t.id;
    this.tech = null;
    setTimeout(() => Game.removeVisitor(id), 9000);
  },

  // ---------- the battery commander's visit: hide all the food from outside ----------
  // coop: { id } in multiplayer, when everyone at Netivot hides the food together.
  startBaum(coop = null, quiet = false) {
    const food = DATA.outsideFood.map(f => ({ ...f, name: fmt(f.name), x: f.at[0] * TS, y: f.at[1] * TS, hidden: false }));
    this.baum = { t: 120, food, phase: 'hide', used: {}, coop, myHid: new Set() };
    if (quiet) return;
    UI.cutscene([{ img: 'assets/hide.jpg', who: '{@@commander}', text: '{@@bc} בדרך לביקורת פתע! יש לנו שתי דקות. כל האוכל שקנינו בחוץ — להחביא, עכשיו. מפעילים נוהל אנה פרנק!' }]).then(() =>
      UI.talk([
        { who: 'p_nevo', text: 'גם את הדאודורנט שלי להחביא?' },
        { who: 'commander', text: 'אותו דווקא תוציא. ותשתמש בו.' },
        { who: 'p_hila', text: 'אני אבלע את הפיצה! בשלמותה! עם הקרטון!' },
        { who: 'commander', text: 'לא, {@p_hila}. {name} — [תרים/תרימי] כל אוכל ו[תחביא/תחביאי] בלוקר, במקפיא, מאחורי הגנרטור או במחסן הרספ"ייה.' },
      ]));
  },
  hideSpots() {
    const spots = [];
    World.lockers.forEach((l, i) => { const sp = lockerSpot(i); spots.push({ id: 'locker' + i, x: sp.x, y: sp.y, label: 'להחביא בלוקר', r: 30 }); });
    spots.push({ id: 'freezer', ...SPOTS.fridge, label: 'להחביא במקפיא — {@bc} לא פותחת מקפיאים' });
    spots.push({ id: 'generator', ...SPOTS.generator, label: 'להחביא מאחורי הגנרטור', r: 44 });
    spots.push({ id: 'store', ...SPOTS.store, label: 'להחביא במחסן הרספ"ייה', r: 44 });
    return spots.filter(h => (this.baum.used[h.id] || 0) < 2);
  },
  pickFood(f) {
    f.carried = true;
    G.player.carry = 'food';
    this.baum.carrying = f;
    Sound.pickup();
    UI.toast(`${f.icon} ${f.name} — להחביא מהר!`);
  },
  hideFood(h) {
    const b = this.baum;
    const f = b.carrying;
    f.hidden = true;
    b.myHid.add(f.id);
    f.carried = false;
    b.carrying = null;
    b.used[h.id] = (b.used[h.id] || 0) + 1;
    G.player.carry = false;
    Sound.sweep();
    const left = b.food.filter(x => !x.hidden).length;
    UI.toast(left ? `הוחבא! נשארו ${left}` : 'הכל מוחבא! 🤫', 'good');
    if (!left) b.t = Math.min(b.t, 2);
  },
  updateBaum(dt) {
    const b = this.baum;
    if (b.phase !== 'hide') return;
    if (b.coop) {
      // Shared: one clock for everyone, and whatever anyone hid or is holding is off the floor.
      b.t = 120 - (Date.now() - b.coop.id) / 1000;
      const hid = new Set(b.myHid), held = new Set();
      for (const p of Multi.peers) if (p.baum && p.baum.id === b.coop.id) { p.baum.hid.forEach(id => hid.add(id)); if (p.baum.carry) held.add(p.baum.carry); }
      for (const f of b.food) { f.hidden = hid.has(f.id); f.peerCarried = held.has(f.id) && !f.carried; }
      if (b.carrying && b.carrying.hidden && !b.myHid.has(b.carrying.id)) { b.carrying.carried = false; b.carrying = null; G.player.carry = false; }
      // Everything hidden: she arrives two seconds later instead of waiting out the clock.
      if (!b.food.some(f => !f.hidden)) b.coop.doneAt = b.coop.doneAt || Date.now() + 2000;
      if (b.coop.doneAt) b.t = Math.min(b.t, (b.coop.doneAt - Date.now()) / 1000);
      if (UI.busy || Mini.active) return;
    } else {
      if (UI.busy || Mini.active) return;
      b.t -= dt;
    }
    const hidden = b.food.filter(x => x.hidden).length;
    const m = Math.max(0, Math.ceil(b.t));
    UI.banner(fmt(`🍕 נוהל אנה פרנק 🍕<small>{@bc} מגיעה בעוד ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} · הוחבאו ${hidden}/${b.food.length}</small>`));
    if (b.t <= 0) this.baumArrives();
  },
  async baumArrives() {
    const b = this.baum;
    b.phase = 'inspect';
    UI.banner(null);
    Sound.horn();
    Game.addVisitor('bc', SPOTS.parade);
    const P = G.player;
    const seen = b.food.filter(f => !f.hidden);
    const inHands = b.carrying;
    const lines = [{ who: 'bc', text: 'בוקר טוב, {platoon}. ביקורת מפקדת סוללה. יש לי ארבע דקות ושלושים שניות, וטבלה.' }];
    for (const f of seen) lines.push({ who: 'bc', text: f === inHands ? `{name}... מה זה ביד שלך? ${f.name}? אל תענה[/י]. אני רושמת.` : `מה זה? ${f.name}? באקסל שלי אין עמודה ל${f.name}.` });
    if (!seen.length) {
      lines.push({ who: 'bc', text: 'נקי. חשוד, אבל נקי. ...רגע. למה מריח פה משווארמה?' });
      lines.push({ who: 'p_nevo', text: 'זה אני, המפקדת. לא התקלחתי. שיטה פרקטית.' });
      lines.push({ who: 'bc', text: 'סימנתי את האתר בירוק. ואת {@p_nevo} — בחום. מקלחת. עכשיו.' });
    } else lines.push({ who: 'bc', text: `${seen.length} פריטי אוכל מבחוץ. סימנתי בכתום. {@@commander}, נדבר.` });
    await UI.talk(lines);
    P.carry = false;
    if (b.coop) {
      (this.baumDone = this.baumDone || new Set()).add(b.coop.id);
      Game.addScore(seen.length ? Math.max(-6, 4 - seen.length * 2) : 10, seen.length ? 'הביקורת של {@bc}' : 'נוהל אנה פרנק — ביחד');
      if (!seen.length) Game.achieve('hidden');
    } else if (!seen.length) { Game.achieve('hidden'); Story.complete('baum', 10, 'נוהל אנה פרנק הצליח'); }
    else Story.complete('baum', Math.max(-8, 4 - seen.length * 3), 'הביקורת של {@bc}');
    this.addShchora(8, 'ביקורת מפקדת סוללה');
    // What stayed hidden turns into a feast tonight.
    G.state.dayFlags.feast = b.food.length - seen.length;
    this.baum = null;
    Game.setNpcSpot('bc', SPOTS.gate);
    setTimeout(() => Game.removeVisitor('bc'), 9000);
  },
  // Multiplayer: start the inspection for everyone at Netivot, or join one that is running.
  startBaumCoop() { this.startBaum({ id: Date.now() }); },
  watchBaum() {
    if (!Multi.on || this.baum || Boss.active) return;
    this.baumDone = this.baumDone || new Set();
    this.baumHeard = this.baumHeard || new Set();
    const p = Multi.peers.find(q => q.baum && !this.baumDone.has(q.baum.id) && Date.now() - q.baum.id < 118000);
    if (!p) return;
    if (World.id === 'netivot' && p.site === 'netivot') {
      this.startBaum({ id: p.baum.id }, true);
      UI.toast(fmt(`🍕 ${p.name}: {@bc} בדרך! נוהל אנה פרנק — להחביא את כל האוכל!`), 'bad');
      Sound.whistle();
    } else if (!this.baumHeard.has(p.baum.id)) {
      this.baumHeard.add(p.baum.id);
      UI.toast(fmt(`🍕 נוהל אנה פרנק בנתיבות! ${p.name} צריך[/ה] עזרה`), 'bad');
    }
  },

  // ---------- Yasmin's boss inspection (day 3) ----------
  yasminTasks: ['y_room', 'y_fridge', 'y_store', 'y_trash'],
  setupYasmin() {
    const S = G.state;
    const room = myRoom();
    const beds = World.beds.filter(b => b.room === room);
    beds.slice().sort(() => Math.random() - 0.5).slice(0, 4).forEach(b => b.messy = true);
    World.beds[S.myBed].messy = true;
    World.lockers.filter(l => l.room === room).slice(0, 2).forEach(l => l.open = true);
    Story.dust = [];
    for (let i = 0; i < 5; i++) Story.dust.push(dustSpot());
    Story.spawnTrash(8);
    const y = Game.npc('inspector');
    if (y) { y.wanderSaved = y.wander; y.wander = null; }
    Game.setNpcSpot('inspector', tc(33, 30));
  },
  async yasminIntro() {
    await UI.cutscene([
      { img: 'assets/yasmin.jpg', who: '⚔️ בוס: {@inspector} — מלכת מסדרי הניקיון', text: 'מסדר ניקיון רצחני על כל האתר. המגורים, המקרר, המחסן, וכל גרגר חול בנתיבות. יש לכם עד 13:00.' },
    ]);
    await UI.talk([
      { who: 'inspector', text: 'בוקר טוב. היום אני לא מדייקת בעוצמה. היום אני מדייקת בעוצמה מקסימלית.' },
      { who: 'inspector', text: 'אחת — המגורים שלך. שתיים — לרשום תוקף של כל דבר במקרר. שלוש — המחסן של הרספ"ייה. הדברים שם יושבים מ־2009 ואף אחד לא נוגע. היום נוגעים. ארבע — שמונה פסולת בשטח.' },
      { who: 'p_rotem', text: 'גם ספיידרמן לא היה עומד בזה.' },
      { who: 'inspector', text: 'ספיידרמן לא היה עובר את המסדר שלי. יש לו קורים בכל הפינות.' },
    ]);
  },
  yasminLeft() {
    let n = World.beds.filter(b => b.messy).length + World.lockers.filter(l => l.open).length + Story.dust.length;
    n += Story.trash.length;
    if (Story.has('y_fridge')) n += 3;
    n += World.objects.filter(o => o.kind === 'junk' && !o.gone).length;
    return n;
  },
  yasminCheck() {
    if (Story.has('y_room') && !World.beds.some(b => b.messy) && !World.lockers.some(l => l.open) && !Story.dust.length) {
      Story.complete('y_room', 4, 'המגורים מוכנים');
    }
    if (Story.has('y_trash') && !Story.trash.length) Story.complete('y_trash', 4, 'השטח נקי');
  },
  async yasminFinal() {
    const S = G.state;
    const left = this.yasminLeft();
    const late = Math.max(0, S.clock - 13 * 60) / 15;
    const grade = Math.max(20, Math.round(100 - left * 6 - late * 4 - (S.dayFlags.fridgeErrors || 0) * 3));
    await UI.cutscene([{ img: 'assets/inspection.jpg', who: '{@inspector}', text: `מסדר! ...אצבע על הלוקר... פנס מתחת למיטה... מריחה את המקרר... סופרת קולבים במחסן... ציון: ${grade}` }]);
    await UI.talk([{ who: 'inspector', text: grade >= 85 ? 'אני... אין לי מה להגיד. זה לא קרה לי אף פעם. אני הולכת לשבת רגע.' : grade >= 65 ? 'עברת. בקושי. ראיתי גרגר חול שמסתכל עליי מתחת למיטה.' : 'זה לא מסדר. זה אתר ארכיאולוגי. מחר שוב, ובשש בבוקר.' }]);
    if (grade >= 85) await UI.talk([{ who: 'sergeant', text: 'ניצחת את {@inspector}! מלך[/ה]! 👑 זה נכנס להיסטוריה של הפלגה.' }]);
    if (grade >= 65) Game.achieve('yasmin');
    Game.addStat('morale', grade >= 65 ? 8 : -6);
    Story.complete('y_final', Math.round(grade / 6), 'הבוס: מסדר של {@inspector}');
    this.addShchora(15, 'המסדר של {@inspector}');
    const y = Game.npc('inspector');
    if (y && y.wanderSaved) y.wander = y.wanderSaved;
  },

  // ---------- fridge, storeroom, cooking ----------
  async fridge() {
    const S = G.state;
    if (!Story.has('y_fridge')) {
      Sound.click();
      UI.toast(pick(['במקרר: פחית Blue, עגבנייה עצובה וקופסת קינואה עם שם של {@p_shaked}.', 'יש פה יוגורט מתקופת הטירונות של {@p_nevo}. לא לגעת.', 'קר פה. זה הדבר הכי טוב שיש במקרר.']));
      return;
    }
    const r = await Mini.open('fridge', { day: S.day, count: 6 });
    S.dayFlags.fridgeErrors = r.errors;
    if (r.errors === 0) Game.achieve('fridge');
    Story.complete('y_fridge', r.errors ? 3 : 6, 'רישום תוקפים');
  },
  async junk(o, j) {
    if (!Story.has('y_store')) {
      UI.toast(pick(['זה פה מ־2009. אף אחד לא נוגע. זו מסורת.', 'שכבת האבק פה מוגנת על ידי רשות הטבע.', 'אם תזיז[/י] את זה, {@inspector} תבקש לסדר את כל המחסן. ...היא תבקש בכל מקרה.']));
      return;
    }
    const v = await UI.talk([{ who: 'inspector', text: `${j.icon} ${fmt(j.name)}. מה עושים עם זה?`, choices: [{ label: '🗑️ לזרוק', value: 'throw' }, { label: '📦 לשמור', value: 'keep' }] }]);
    const right = (v === 'keep') === !!j.keep;
    o.gone = true;
    G.state.junkDone.push(j.id);
    Sound.sweep();
    await UI.talk([{ who: 'inspector', text: right
      ? (j.keep ? 'נכון. את זה שומרים. {@commander} תהרוג מישהו אם זה ייעלם.' : 'לזבל. סוף סוף. זה חיכה לך שנים.')
      : (j.keep ? 'זרקת את הלוח של {@commander}?! ...הוצאתי אותו מהפח. פעם הבאה תחשוב[/י].' : 'לשמור?! למה? למקרה שיחזור הפקס? לזבל.') }]);
    if (!right) Game.addScore(-1, 'החלטה לא נכונה במחסן');
    if (!World.objects.some(x => x.kind === 'junk' && !x.gone)) Story.complete('y_store', 5, 'המחסן מסודר');
  },
  // The stove needs a break between meals: two and a half game hours.
  cookLeft() {
    const S = G.state;
    const at = S.dayFlags.cookAt;
    if (at === undefined) return 0;
    return Math.max(0, at + 150 - S.clock) / DATA.minutesPerSecond; // real seconds
  },
  cookLabel() {
    const left = this.cookLeft();
    if (!left) return 'לבשל במטבחון';
    const s = Math.ceil(left);
    return `⏳ המטבחון מתקרר — אפשר לבשל שוב בעוד ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
  async cook() {
    const S = G.state;
    if (this.cookLeft()) { UI.toast(this.cookLabel() + '. גם המחבת צריכה מנוחה.'); return; }
    const r = await Mini.open('cook');
    if (!r.recipe) return;
    S.dayFlags.cookAt = S.clock;
    const rec = r.recipe;
    if (!r.success) { UI.toast('נשרף... 🔥 לפחות יש ריח', 'bad'); Game.addStat('morale', -2); return; }
    Game.addStat('energy', rec.energy);
    Game.addStat('morale', rec.morale);
    this.addShchora(-6, `${rec.icon} ${fmt(rec.name)}`);
    Game.achieve('chef');
    if (rec.healthy && World.id === 'netivot') UI.talk([{ who: 'p_shaked', text: 'קינואה?! ברוקולי?! אני כל כך גאה בך שאני עושה עוד סט! 💪' }]);
    else if (rec.id === 'noodles') UI.talk([{ who: 'p_liran', text: 'נודלס! {first} אוהב נודלס! אוגה בוגה!' }]);
  },
  async pullups() {
    const r = await Mini.open('qte', { title: 'מתח', sub: 'כל חץ — עוד מתח. [תגיע/תגיעי] ל־15 כמו {@ruth}?', length: 8, time: 7, silent: true });
    const reps = r.success ? 15 - Math.min(10, r.errors * 2) : 3 + Math.floor(Math.random() * 4);
    UI.toast(`💪 עשית ${reps} מתח`, reps >= 15 ? 'good' : '');
    Game.addStat('energy', -5);
    if (Game.npc('ruth')) UI.talk([{ who: 'ruth', text: reps >= 15 ? 'חמש עשרה! [ברוך/ברוכה] הבא[/ה] למועדון. אנחנו שתי[ים/יים] עכשיו.' : `${reps}? חמוד. עוד ${15 - reps} ואת[ה/] כמוני. ובלי משקולת.` }]);
  },

  // ---------- Amsalem at HQ ----------
  amsalemAllowed() {
    const S = G.state;
    return World.id === 'hq' && !this.chores && !S.dayFlags.amsalem && !G.player.carry && !Story.run && !Boss.active && !Story.has('snack') && !Story.has('boss') && !Story.has('graduation');
  },
  async amsalemCaught() {
    const S = G.state;
    S.dayFlags.amsalem = true;
    Sound.whistle();
    await UI.talk([
      { who: 'rasap', text: 'תפסתי אותך! [קח/קחי] את כל המטפים האלה לשם. ו[תעביר/תעבירי] את השלולית הזאת לשם.' },
      { who: 'player', text: 'לאן זה "שם"?' },
      { who: 'rasap', text: '"שם" זה שם. ליד הרספ"ייה. והשלולית — לניקוז בפינה. ואל [תשאל/תשאלי] למה. אני {short}.' },
    ]);
    const ext = [];
    for (let i = 0; i < 4; i++) ext.push({ x: (6.5 + i * 1.2) * TS, y: 23.4 * TS, done: false });
    this.chores = { ext, puddle: { x: 19.5 * TS, y: 21.5 * TS, done: false }, dragging: false, carrying: null };
    Story.addTask('amsalem', false);
    this.addShchora(10, '{@rasap} תפסה אותך');
  },
  dropExt() {
    const c = this.chores;
    c.carrying.done = true;
    // Line the extinguishers up "there".
    const k = c.ext.filter(e => e.done).length - 1;
    c.carrying.x = SPOTS_HQ.dropExt.x + (k - 1.5) * 18;
    c.carrying.y = SPOTS_HQ.dropExt.y;
    c.carrying = null;
    G.player.carry = false;
    Sound.good();
    this.choresCheck();
  },
  dropPuddle() {
    const c = this.chores;
    c.dragging = false;
    c.puddle.done = true;
    c.puddle.x = SPOTS_HQ.drain.x;
    c.puddle.y = SPOTS_HQ.drain.y;
    G.player.carry = false;
    Sound.sweep();
    this.choresCheck();
  },
  updateChores(dt) {
    const c = this.chores;
    if (World.id !== 'hq') return;
    if (c.dragging) {
      // The puddle sloshes along behind the squeegee.
      const P = G.player;
      const bx = P.x - Math.cos(P.angle) * 34, by = P.y - Math.sin(P.angle) * 34;
      c.puddle.x += (bx - c.puddle.x) * Math.min(1, dt * 2.2);
      c.puddle.y += (by - c.puddle.y) * Math.min(1, dt * 2.2);
    }
  },
  choresCheck() {
    const c = this.chores;
    if (c.ext.some(e => !e.done) || !c.puddle.done) return;
    Story.complete('amsalem', 4, 'המטפים והשלולית "שם"');
    Game.achieve('amsalem');
    UI.talk([{ who: 'rasap', text: 'יופי. עכשיו [תחזיר/תחזירי] את המטפים לאיפה שהם היו. ...סתם. ...או שלא. נראה מחר.' }]);
    this.chores.finished = true;
  },
};

// A random dust spot in the aisle of the player's room.
function dustSpot() {
  return { x: (15.3 + Math.random() * 6) * TS, y: (roomY() + 3.15 + Math.random() * 0.7) * TS };
}
