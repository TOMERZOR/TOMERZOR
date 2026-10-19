// Story-mode boss arcs: on the way to each boss fight there are tasks that belong to it, and
// each one done brings a weapon to the fight (starting ammo) and takes a bit off the boss.
//  Day 2 at HQ — the battery sergeant major: polished boots, a folded beret, a shave, the חוגר.
//  Day 4 at Netivot — the battery commander: karaoke, black seeds, the poster, the Baba Sali.
//  The last day — Cheeseburgero: vegetables from the platoon's fitness nut.
const BOSS_PREP = {
  h_shine: { boss: 'harasar', item: 'boots', n: 2, title: 'לצחצח נעליים לביקורת של {@harasar}', desc: 'בלוקר שלך במגורים.', spot: () => lockerSpot(G.state.myLocker), label: '👞 לצחצח נעליים', qte: 'צחצוח נעליים' },
  h_beret: { boss: 'harasar', item: 'beret', n: 2, title: 'שיעור קיפול כומתה אצל {@sergeant}', desc: '{@sergeant} מכירה את הרס"ר.', who: 'sergeant',
    lines: ['כומתה? [בוא/בואי]. קיפול אחד, שני קיפולים, ולשים בכותפת שמאל. לא ימין. אף פעם ימין.', 'עכשיו היא נראית כמו בתמונה בספר. {@harasar} ישנא את זה. מעולה.'] },
  h_shave: { boss: 'harasar', item: 'razor', n: 2, title: 'מכונת גילוח מ{@p_ofek}', desc: 'נע"ת ציוד לחימה. יש לו הכל.', who: 'p_ofek',
    lines: ['גילוח? יש לי שלוש מכונות. אחת לחירום, אחת לחירום של החירום, ואחת ש{@p_nevo} עוד לא גילה.', 'קח[/י]. רק אל תגיד[/י] ל{@p_nevo} שיש פה סכינים. הוא יחשוב שזה מזלג.'] },
  h_belt: { boss: 'harasar', item: 'belt', n: 2, map: 'hq', title: 'להוציא חוגר ברספ"ייה ב{hq}', desc: 'החוגר שלך מחכה אצל {@rasap} מהגיוס.', spot: () => ({ x: SPOTS_HQ.rasap.x + 1.3 * TS, y: SPOTS_HQ.rasap.y }), label: '🪪 לקחת את החוגר', qte: 'חתימה על חוגר' },
  h_boss: { boss: 'harasar', fight: true, map: 'hq', title: 'ביקורת תלבושת: להתייצב מול {@harasar}', desc: 'בדשא של {hq}. עם כל מה שהכנת.', who: 'harasar' },

  b_karaoke: { boss: 'baum', item: 'karaoke', n: 2, title: 'לשאול מ{@p_hila} את ערכת הקריוקי', desc: 'נע"ת חינוך. תמיד יש לה מיקרופון.', who: 'p_hila',
    lines: ['קריוקי? נגד המפקדת?! זה הרגע שחיכיתי לו כל השירות!! 🎤', 'יש גם שיר מוכן: "מאמי, מאמי". [תשיר/תשירי] חזק. היא תתפרק.'] },
  b_seeds: { boss: 'baum', item: 'seeds', n: 2, title: 'גרעינים שחורים מ{@p_arad}', desc: 'נע"ת לוגיסטיקה. המחסן הסודי.', who: 'p_arad',
    lines: ['גרעינים? יש לי שק של עשרה קילו. מהקיבוץ. אל תשאל[/י].', 'אם היא שואלת — זה מלאי של הגדוד. וזה לא שקר. כמעט.'] },
  b_bibi: { boss: 'baum', item: 'bibi', n: 2, title: 'הפוסטר מהלוקר של {@p_nevo}', desc: 'הוא שומר אותו מתחת לגרביים.', who: 'p_nevo',
    lines: ['הפוסטר? הוא ליד הגרביים של יום ראשון. [תחזיק/תחזיקי] מהפינה. מהפינה הנקייה. אין פינה נקייה.', 'אוקיי, הוא קצת מריח. זה רק יעזור.'] },
  b_babasali: { boss: 'baum', item: 'babasali', n: 2, title: 'התמונה של הבבא סאלי מ{@p_miriam}', desc: 'יש לה אחת בכל כיס.', who: 'p_miriam',
    lines: ['חיים שלי, הבבא סאלי? [קח/קחי], יש לי עוד שלוש. ברכה לדרך.', 'ואם היא מתחילה לבכות — [תן/תני] לה רוגלך. תמיד יש לי רוגלך.'] },
  b_boss: { boss: 'baum', fight: true, title: 'להתעמת עם {@bc}', desc: 'היא עוד באתר, ועצבנית. עם כל מה שאספת.', who: 'bc' },

  f_veggies: { boss: 'burger', item: 'broccoli', n: 3, title: 'ירקות לקרב מ{@p_shaked}', desc: 'אם מישהו יודע איך מנצחים צ\'יזבורגר — זאת היא.', who: 'p_shaked',
    lines: ['צ\'יזבורגר?! [קח/קחי] ברוקולי. הרבה ברוקולי. הוא יברח מזה כמו {@p_nevo} ממקלחת.', 'וגם גזר. ועוד ברוקולי. זה לא נשק, זה דרך חיים. 🥦'], also: { carrot: 2 } },
};

const BossArcs = {
  // Where the battery commander waits (her office at Netivot) until the showdown.
  BC_SPOT: () => tc(47, 33),
  // She stays on the site until it's settled, even after a trip elsewhere or a reload.
  update() {
    if (!Story.has('b_boss') || Story.has('baum') || World.id !== 'netivot' || Boss.active || Game.npc('bc')) return;
    Game.addVisitor('bc', this.BC_SPOT());
  },
  // Each prep is an ordinary task, so the HUD, the arrow and the phone all list it.
  init() {
    for (const [id, p] of Object.entries(BOSS_PREP)) {
      TASKS[id] = {
        title: p.title, desc: p.desc, map: p.map, pts: 0,
        target: () => (p.spot ? p.spot() : npcPos(p.who)),
      };
    }
  },
  ammo() { const S = G.state; return (S && S.dayFlags && S.dayFlags.bossAmmo) || {}; },
  done(boss) { return Object.entries(BOSS_PREP).filter(([id, p]) => p.boss === boss && p.item && !Story.has(id) && Story.tasks.some(t => t.id === id)).length; },
  give(id) {
    const p = BOSS_PREP[id], S = G.state;
    S.dayFlags.bossAmmo = S.dayFlags.bossAmmo || {};
    const add = { [p.item]: p.n, ...(p.also || {}) };
    for (const [k, v] of Object.entries(add)) S.dayFlags.bossAmmo[k] = (S.dayFlags.bossAmmo[k] || 0) + v;
    const kinds = [...DATA.uniform, ...DATA.mizrahi, ...DATA.healthy];
    const names = Object.entries(add).map(([k, v]) => { const it = kinds.find(x => x.id === k); return `${it ? it.icon : ''} ${it ? it.name : k} ×${v}`; }).join(', ');
    Story.complete(id, 3, fmt(p.title));
    UI.toast(`🎒 לקרב: ${names}`, 'good');
  },

  interactables(add) {
    for (const t of Story.tasks) {
      const p = BOSS_PREP[t.id];
      if (!p || t.done || !p.spot) continue;
      if ((p.map || 'netivot') !== World.id) continue;
      const at = p.spot();
      add(at.x, at.y, p.label, () => this.prepSpot(t.id), 40);
    }
  },
  async prepSpot(id) {
    const p = BOSS_PREP[id];
    const r = await Mini.open('qte', { title: p.qte, length: 5, time: 9 });
    if (r.success) this.give(id);
  },
  // Talking to someone with a prep task for them (or to the boss, when it's time).
  async talk(n) {
    const t = Story.tasks.find(x => !x.done && BOSS_PREP[x.id] && BOSS_PREP[x.id].who === n.id);
    if (!t) return false;
    const p = BOSS_PREP[t.id];
    if (p.fight) return this.fight(p.boss);
    await UI.talk(p.lines.map(text => ({ who: n.id, text })));
    this.give(t.id);
    return true;
  },
  async fight(boss) {
    const left = Object.entries(BOSS_PREP).filter(([id, p]) => p.boss === boss && p.item && Story.has(id)).length;
    if (left) {
      const v = await UI.talk([{ who: 'player', text: `עוד ${left} דברים להכין לפני הקרב. להתחיל בכל זאת?`, choices: [{ label: '⚔️ כן, עכשיו', value: 1 }, { label: 'קודם להתכונן', value: 0 }] }]);
      if (!v) return true;
    }
    if (boss === 'harasar') {
      await UI.talk([{ who: 'harasar', text: '{name}. ביקורת תלבושת. [עמוד/עמדי] ישר. ...נעליים? כומתה? גילוח? חוגר? בוא[/י] נראה מה יש לך.' }]);
      Boss.startOther('harasar');
    } else {
      await UI.talk([{ who: 'bc', text: 'אה, {name}. עוד מישהו שקורא ספרים בשמירה? ...מה זה בידיים שלך? זה... גרעינים?!' }]);
      Boss.startOther('baum', { skipIntro: true });
    }
    return true;
  },
  // Boss.start: what the preps brought, and a weaker boss for each one done.
  apply(kind) {
    const pre = this.ammo();
    const got = [];
    for (const [k, v] of Object.entries(pre)) if (k in Boss.ammo) { Boss.ammo[k] += v; got.push(k); }
    const preps = Object.entries(BOSS_PREP).filter(([id, p]) => p.boss === kind && p.item && Story.tasks.some(t => t.id === id && t.done)).length;
    if (preps && !Boss.coop) { Boss.max = Math.max(50, Boss.max - preps * 10); Boss.hp = Boss.max; }
    if (got.length) {
      G.state.dayFlags.bossAmmo = {};
      setTimeout(() => UI.toast(`🎒 הבאת מוכן לקרב — ${preps} הכנות: הבוס חלש יותר!`, 'good'), 1500);
    }
  },
  // Done with a fight: the arc's last task.
  won(kind) {
    const id = kind === 'harasar' ? 'h_boss' : kind === 'baum' ? 'b_boss' : null;
    if (id && Story.has(id)) Story.complete(id, 8, fmt(BOSS_PREP[id].title));
  },
};

BossArcs.init();
