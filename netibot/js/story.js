// Story: daily task lists, scripted events, red alerts, gate shifts, the PALGATZ exam.
const tc = (x, y) => ({ x: (x + 0.5) * TS, y: (y + 0.5) * TS });

const SPOTS = {
  commander: tc(38, 25),
  sergeantDoor: tc(23, 25),
  sergeantDepot: tc(43, 26),
  dining: { x: 23.5 * TS, y: 37.6 * TS },
  diningDrop: { x: 23.5 * TS, y: 35.5 * TS },
  stove: { x: 15.7 * TS, y: 36.3 * TS },
  fridge: { x: 14.6 * TS, y: 36.4 * TS },
  hamal: { x: 39.5 * TS, y: 19 * TS },
  depot: { x: 45.5 * TS, y: 26.5 * TS },
  store: { x: 38.5 * TS, y: 30.7 * TS },
  generator: { x: 46 * TS, y: 39 * TS },
  booth: tc(35, 39),
  tower: { x: 49.6 * TS, y: 39.9 * TS },
  range: tc(20, 13),
  track: tc(20, 19),
  board: { x: 33.9 * TS, y: 25 * TS },
  parade: tc(38, 25),
  pullup: tc(15, 40),
  gate: { x: 30.5 * TS, y: 39.6 * TS },
  truck: { x: 30.5 * TS, y: 33 * TS },
};
// The player's own room depends on gender: boys and girls sleep apart.
const myRoom = () => (G.profile && G.profile.gender === 'f' ? 'girls' : 'boys');
const roomY = (room = myRoom()) => (room === 'girls' ? 27 : 20);
const roomSpot = (room = myRoom()) => tc(18, roomY(room) + 3);
const TRACK_POINTS = [tc(13, 14), tc(26, 14), tc(26, 19), tc(13, 19)];
const SPOTS_HQ = {
  hamal: { x: 11.5 * TS, y: 7.6 * TS },
  rasap: { x: 45.5 * TS, y: 10.5 * TS },
  clinic: { x: 10.5 * TS, y: 28.6 * TS },
  dining: { x: 19.5 * TS, y: 29.5 * TS },
  kantina: { x: 40.5 * TS, y: 35 * TS },
  gym: { x: 50.2 * TS, y: 37.6 * TS },
  stove: { x: 56.4 * TS, y: 27.3 * TS },
  snack: { x: 48.6 * TS, y: 7.2 * TS },
  arena: tc(30, 18),
  dropExt: tc(46, 13),
  drain: tc(56, 21),
};
const travelSpot = () => tc(DATA.travelStop[0] + 0.6, DATA.travelStop[1]);
const siteName = (id) => fmt(ROSTER.sites[id]);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Task catalogue. target() returns the waypoint in px.
const TASKS = {
  meet_cmd: { title: 'להתייצב אצל {@@commander}', desc: 'קצינת הפלגה, ברחבת המסדרים.', target: () => npcPos('commander'), pts: 2 },
  locker: { title: 'לסדר ציוד בלוקר', desc: 'במגורים — הלוקר שלך מסומן.', target: () => lockerSpot(G.state.myLocker), pts: 3 },
  drill: { title: 'תרגיל צבע אדום עם {@sergeant}', desc: '{@sergeant} מחכה ליד המגורים.', target: () => npcPos('sergeant'), pts: 0 },
  clean: { title: 'ניקיון שטח — לאסוף 10 פסולת', desc: 'לחפש פסולת ברחבי הבסיס (מסומן במפה).', target: () => nearestTrash(), pts: 8 },
  dinner: { title: 'ארוחת ערב בחדר האוכל (מ־17:00)', desc: 'אפשר לחכות בחדר האוכל עד שמגישים.', target: () => SPOTS.dining, pts: 2 },
  sleep: { title: 'לישון במיטה שלך', desc: 'המיטה שלך במגורים. שינה מסיימת את היום ושומרת משחק.', target: () => bedSpot(G.state.myBed), pts: 0, last: true },
  lineup: { title: 'מסדר בוקר עד 06:45', desc: 'רחבת המסדרים. לא לאחר!', target: () => SPOTS.parade, pts: 4 },
  reload_train: { title: 'תדריך טעינה אצל {@sergeant}', desc: 'ליד מחסן המארזים.', target: () => npcPos('sergeant'), pts: 2 },
  reload: { title: 'להחליף מארז במשגר הריק', desc: 'לקחת מארז מהמחסן ולהביא למשגר המסומן "ריק".', target: () => reloadTarget(), pts: 8 },
  gate: { title: 'משמרת ש"ג', desc: 'להיכנס לעמדת הש"ג ולבדוק את הרכבים שמגיעים.', target: () => SPOTS.booth, pts: 0 },
  inspection_prep: { title: 'להכין את החדר למסדר ניקיון', desc: 'לסדר מיטות, לסגור לוקרים ולטאטא אבק.', target: () => inspectionTarget(), pts: 0 },
  inspection: { title: 'לקרוא ל{@inspector} לבדיקה', desc: 'כשהחדר מוכן — {@inspector} בתוך המגורים.', target: () => npcPos('inspector'), pts: 0 },
  radar: { title: 'משמרת בקרה בחמ"ל הסוללתי', desc: 'ב{hq}, אצל {@@ops}.', target: () => SPOTS_HQ.hamal, pts: 0, map: 'hq' },
  hq_gear: { title: 'לחתום על ציוד אצל {@rasap}', desc: 'ברספ"ייה ב{hq}.', target: () => SPOTS_HQ.rasap, pts: 0, map: 'hq' },
  deploy: { title: 'פריסת אתר חדש', desc: 'לנסוע לאתר הפריסה ולהכווין את המשאיות עם המכולות.', target: () => Story.deployTarget(), pts: 0, map: 'field' },
  surprise: { title: 'מסדר פתע של {@inspector}: לטאטא אבק במגורים', desc: 'נתפסת. קורה לטובים ביותר.', target: () => inspectionTarget(), pts: 0, optional: true },
  ofek_swap: { title: 'להחליף את {@p_ofek} בעמדה — הוא חייב שירותים', desc: 'קריאטין, מים, ושלושה ליטר של דחיפות.', target: () => SPOTS.tower, pts: 0, optional: true },
  guard: { title: 'שמירת לילה בעמדה', desc: 'עמדת השמירה בפינת הבסיס.', target: () => SPOTS.tower, pts: 0 },
  train2: { title: 'שני אימונים (לוח אימונים / מטווח / מסלול)', desc: '', target: () => SPOTS.board, pts: 0, count: 2 },
  exam_reload: { title: 'מבחן: החלפת מארז', desc: 'הסמלת ליד משגר 2.', target: () => (G.state.dayFlags.examReload ? reloadTarget() : npcPos('sergeant')), pts: 0 },
  exam_alert: { title: 'מבחן: תרגיל צבע אדום', desc: '{@commander} ברחבה מתחילה את התרגיל.', target: () => npcPos('commander'), pts: 0 },
  exam_radar: { title: 'מבחן: עמדת בקרה', desc: 'בחמ"ל.', target: () => SPOTS.hamal, pts: 0 },
  exam_quiz: { title: 'מבחן ידע אצל {@commander}', desc: '', target: () => npcPos('commander'), pts: 0 },
  graduation: { title: 'לשמוע את התוצאה מ{@@bc}', desc: 'בלשכת מפקדת הסוללה ב{hq}.', target: () => npcPos('bc'), pts: 0, map: 'hq' },
  rafael: { title: 'לפרוק את רפאל: 2 ארגזים ושישיית מים לחדר האוכל', desc: 'משאית הקייטרינג מחכה בכביש ליד השער.', target: () => (!Events.rafael ? null : ['crate', 'water'].includes(G.player.carry) ? SPOTS.diningDrop : { x: Events.rafael.x, y: Events.rafael.y }), pts: 0 },
  techcheck: { title: 'ביקורת טכנאים: משגר, גנרטור, עמדת בקרה', desc: 'ללוות את הטכנאי בכל התחנות.', target: () => (Events.tech && Events.tech.step < TECH_STEPS.length ? TECH_STEPS[Events.tech.step].at() : null), pts: 0 },
  baum: { title: 'נוהל אנה פרנק: להחביא את כל האוכל מבחוץ', desc: 'לוקרים, מקפיא, מאחורי הגנרטור, מחסן הרספ"ייה.', target: () => baumTarget(), pts: 0 },
  y_room: { title: 'בוס {@inspector}: לסדר את המגורים שלך', desc: 'מיטות, לוקרים ואבק.', target: () => inspectionTarget(), pts: 0 },
  y_fridge: { title: 'בוס {@inspector}: לרשום תוקפים במקרר', desc: 'המקרר במטבחון.', target: () => SPOTS.fridge, pts: 0 },
  y_store: { title: 'בוס {@inspector}: לסדר את מחסן הרספ"ייה', desc: 'מה לזרוק ומה לשמור.', target: () => nearestJunk(), pts: 0 },
  y_trash: { title: 'בוס {@inspector}: לאסוף 8 פסולת בשטח', desc: '', target: () => nearestTrash(), pts: 0 },
  y_final: { title: 'הקרב האחרון: לקרוא ל{@inspector} למסדר', desc: 'כשהכל מוכן. או כשנגמר האומץ.', target: () => npcPos('inspector'), pts: 0 },
  ugga: { title: 'טופס הקצאה לקורס מיירטים בשביל {@p_liran}', desc: 'אצל {@interceptors} בשו"ב.', map: () => (G.state.flags.ugga === 1 ? 'hq' : 'netivot'), target: () => npcPos(G.state.flags.ugga === 1 ? 'interceptors' : 'p_liran'), pts: 0, optional: true },
  amsalem: { title: 'המטפים "לשם" והשלולית "לשם"', desc: 'כי {@rasap} אמרה.', map: 'hq', target: () => choresTarget(), pts: 0, optional: true },
  find_lock: { title: 'למצוא מנעול חדש לשער של נתיבות', desc: 'רק לרס"פית יש מנעולים.', map: 'hq', target: () => npcPos('rasap'), pts: 0 },
  snack: { title: 'לפתוח את ארונית החטיפים הסודית של {@deputy_rasap}', desc: 'מאחורי המדפים ברספ"ייה.', map: 'hq', target: () => SPOTS_HQ.snack, pts: 0 },
  boss: { title: 'להביס את צ\'יזבורגרו!', desc: 'לאסוף אוכל בריא ולזרוק עליו.', map: 'hq', target: () => (Boss.active && Boss.pickups[0]) || null, pts: 0 },
  lock_gate: { title: 'לנעול את השער של נתיבות ולצאת הביתה', desc: 'עם המנעול האחרון בסוללה.', target: () => SPOTS.gate, pts: 0, last: true },
};
const FINAL_DAY = { title: 'יום אחרון לפני יציאה הביתה 🏠', tasks: ['lineup', 'find_lock', 'snack', 'boss', 'lock_gate'], alerts: [] };

const DAYS = {
  1: { title: 'יום 1 — קליטה בפלג"צ', tasks: ['meet_cmd', 'locker', 'drill', 'clean', 'dinner', 'sleep'], alerts: [] },
  2: { title: 'יום 2 — משגרים וחתימות', tasks: ['lineup', 'reload_train', 'hq_gear', 'gate', 'sleep'], alerts: [13 * 60 + 20] },
  3: { title: 'יום 3 — בוס: המסדר הרצחני של {@inspector}', tasks: ['lineup', 'y_room', 'y_fridge', 'y_store', 'y_trash', 'y_final', 'radar', 'guard', 'sleep'], alerts: [16 * 60 + 30] },
  4: { title: 'יום 4 — נוהל אנה פרנק, ופורסים אתר', tasks: ['lineup', 'baum', 'deploy', 'train2', 'sleep'], alerts: [17 * 60 + 10] },
  5: { title: 'יום 5 — מבחן סיום פלג"צ', tasks: ['lineup', 'exam_reload', 'exam_alert', 'exam_radar', 'exam_quiz', 'graduation'], alerts: [] },
};

// A free spot a step or two from a teleport target, facing it rather than on top of it.
function warpSpot(t) {
  for (let r = 1.2; r < 6; r += 0.6) {
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2 + Math.PI / 2;
      const x = t.x + Math.cos(a) * r * TS, y = t.y + Math.sin(a) * r * TS;
      if (!World.blocked(x, y, 13)) return { x, y };
    }
  }
  return null;
}
function npcPos(id) { const n = Game.npc(id); return n ? { x: n.x, y: n.y } : null; }
function lockerSpot(i) { const l = World.lockers[i]; return { x: l.x + l.w + 16, y: l.y + l.h / 2 }; }
function bedSpot(i) { const b = World.beds[i]; return { x: b.x + b.w / 2, y: b.top ? b.y + b.h + 14 : b.y - 14 }; }
function launcherSpot(L) { return { x: L.x + L.w / 2, y: L.y + L.h + 22 }; }
function nearestTrash() {
  const p = G.player;
  let best = null, bd = Infinity;
  for (const t of Story.trash) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = t; } }
  return best;
}
function reloadTarget() {
  const L = World.launchers.find(l => l.needsReload);
  if (!L) return null;
  return G.player.carry === 'canister' ? launcherSpot(L) : SPOTS.depot;
}
function nearestOf(list) {
  const p = G.player;
  let best = null, bd = Infinity;
  for (const t of list) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = t; } }
  return best;
}
function nearestJunk() {
  return nearestOf(World.objects.filter(o => o.kind === 'junk' && !o.gone).map(o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 })));
}
function baumTarget() {
  const b = Events.baum;
  if (!b || b.phase !== 'hide') return null;
  if (G.player.carry === 'food') return nearestOf(Events.hideSpots());
  return nearestOf(b.food.filter(f => !f.hidden));
}
function choresTarget() {
  const c = Events.chores;
  if (!c) return null;
  if (G.player.carry === 'ext') return SPOTS_HQ.dropExt;
  if (c.dragging) return SPOTS_HQ.drain;
  return nearestOf(c.ext.filter(e => !e.done)) || (c.puddle.done ? null : c.puddle);
}
function inspectionTarget() {
  const p = G.player;
  const items = [
    ...World.beds.filter(b => b.messy).map(b => bedSpot(World.beds.indexOf(b))),
    ...World.lockers.filter(l => l.open).map(l => lockerSpot(World.lockers.indexOf(l))),
    ...Story.dust,
  ];
  let best = null, bd = Infinity;
  for (const t of items) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = t; } }
  return best;
}

const Story = {
  tasks: [],
  trash: [],
  dust: [],
  pendingAlerts: [],
  gateShift: null,
  run: null,
  examParts: {},

  // ---------- day lifecycle ----------
  async startDay(day) {
    const S = G.state;
    S.day = day;
    S.clock = 6 * 60;
    S.energy = 100;
    S.dayFlags = {};
    S.trainCount = {};
    this.trash = [];
    this.dust = [];
    this.gateShift = null;
    this.run = null;
    Scene3D.clearSky();
    G.alert = null;
    UI.banner(null);
    Sound.stopSiren();
    World.gateOpen = World.gateTarget = 0;
    if (World.id !== 'netivot') Game.switchMap('netivot');
    World.beds.forEach(b => b.messy = false);
    World.lockers.forEach(l => l.open = false);
    G.player.carry = false;
    // Boys and girls sleep in separate rooms; older saves get a bed in the right one.
    const room = myRoom();
    if (!World.beds[S.myBed] || World.beds[S.myBed].room !== room) S.myBed = room === 'girls' ? 10 : 2;
    if (!World.lockers[S.myLocker] || World.lockers[S.myLocker].room !== room) S.myLocker = room === 'girls' ? 4 : 1;
    for (const o of World.objects) if (o.kind === 'junk') o.gone = (S.junkDone || []).includes(o.junk);
    Events.startDay(day);

    const plan = this.planFor(day);
    this.tasks = plan.tasks.map(id => ({ id, ...TASKS[id], done: false, progress: 0 }));
    this.pendingAlerts = plan.alerts.slice();
    if (this.has('exam_reload')) this.examParts = {};
    const start = roomSpot();
    G.player.x = start.x; G.player.y = start.y;
    Game.resetNpcs();
    this.prepare();
    for (const m of DATA.messages[day] || []) S.inbox.push(m);
    if (DATA.messages[day]) setTimeout(() => UI.toast('📱 הודעה חדשה'), 1500);
    if (day > 1) { S.money += 15; }
    Game.save();
    UI.toast(plan.title);
    await this.morning(day);
  },

  // Everything needed to pick the day up again later, mid-day: tasks, the player, the mess.
  snapshot() {
    const net = World.cache.netivot || World;
    return {
      day: G.state.day, map: World.id, x: Math.round(G.player.x), y: Math.round(G.player.y), yaw: Scene3D.yaw,
      tasks: this.tasks.map(t => ({ id: t.id, done: t.done, progress: t.progress || 0 })),
      alerts: this.pendingAlerts.slice(),
      trash: this.trash.map(t => ({ x: t.x, y: t.y, kind: t.kind })),
      dust: this.dust.map(d => ({ x: d.x, y: d.y })),
      beds: net.beds.map(b => b.messy), lockers: net.lockers.map(l => l.open),
      launchers: net.launchers.map(l => ({ ammo: l.ammo, needsReload: l.needsReload })),
    };
  },

  async resumeDay(snap) {
    const S = G.state;
    S.flags = S.flags || {};
    S.junkDone = S.junkDone || [];
    S.dayFlags = S.dayFlags || {};
    this.gateShift = null;
    this.run = null;
    Scene3D.clearSky();
    G.alert = null;
    UI.banner(null);
    Sound.stopSiren();
    G.player.carry = false;
    if (World.id !== 'netivot') Game.switchMap('netivot');
    World.gateOpen = World.gateTarget = 0;
    (snap.beds || []).forEach((m, i) => { if (World.beds[i]) World.beds[i].messy = m; });
    (snap.lockers || []).forEach((o, i) => { if (World.lockers[i]) World.lockers[i].open = o; });
    (snap.launchers || []).forEach((l, i) => { if (World.launchers[i]) Object.assign(World.launchers[i], l); });
    for (const o of World.objects) if (o.kind === 'junk') o.gone = S.junkDone.includes(o.junk);
    // Events that were halfway through (a truck at the gate, a visiting technician) start over.
    Events.rafael = Events.tech = Events.baum = Events.chores = null;
    const redo = { rafael: 'rafael', techcheck: 'tech', amsalem: 'amsalem' };
    this.tasks = snap.tasks.filter(t => TASKS[t.id] && (t.done || !redo[t.id])).map(t => ({ id: t.id, ...TASKS[t.id], done: t.done, progress: t.progress }));
    for (const t of snap.tasks) if (!t.done && redo[t.id]) S.dayFlags[redo[t.id]] = false;
    // A boss fight never resumes halfway: open the snack cabinet again.
    if (this.has('boss')) { const sn = this.tasks.find(t => t.id === 'snack'); if (sn) sn.done = false; }
    this.pendingAlerts = (snap.alerts || []).filter(t => t > S.clock);
    this.trash = snap.trash || [];
    this.dust = snap.dust || [];
    if (snap.map && snap.map !== 'netivot') Game.switchMap(snap.map);
    else Game.resetNpcs();
    G.player.x = snap.x;
    G.player.y = snap.y;
    if (World.blocked(G.player.x, G.player.y, G.player.r)) { const q = Game.walkableNear(G.player) || travelSpot(); G.player.x = q.x; G.player.y = q.y; }
    Scene3D.yaw = snap.yaw || 0;
    if (this.has('reload_train') || this.has('exam_reload')) Game.setNpcSpot('sergeant', this.has('exam_reload') ? launcherSpot(World.launchers[1]) : SPOTS.sergeantDepot);
    if (this.tasks.some(t => !t.done && t.id.startsWith('y_'))) { const y = Game.npc('inspector'); if (y) { y.wanderSaved = y.wander; y.wander = null; } }
    if (this.has('baum') && !this.has('lineup') && World.id === 'netivot') Events.startBaum();
    UI.toast('ממשיכים מאיפה שעצרת ✔', 'good');
  },

  planFor(day) {
    const S = G.state;
    if (Roles.current()) return Roles.planFor(day);
    if (S.mode === 'story' && S.graduated && !S.wentHome) return FINAL_DAY;
    if (S.mode === 'story' && !S.graduated && DAYS[Math.min(day, 5)]) {
      const d = DAYS[S.examRetry ? 5 : Math.min(day, 5)];
      return { title: d.title, tasks: d.tasks, alerts: d.alerts };
    }
    // Free play / after graduation: a random mix every day.
    const pool = ['gate', 'radar', 'guard', 'clean', 'train2', 'hq_gear', 'deploy'];
    const picks = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    const alerts = [];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) alerts.push(8 * 60 + Math.floor(Math.random() * 11 * 60));
    return { title: `יום ${day} בסוללה ${fmt('{battery}')}`, tasks: ['lineup', ...picks, 'sleep'], alerts: alerts.sort((a, b) => a - b) };
  },

  async morning(day) {
    const S = G.state;
    if (S.mode === 'story' && day === 1) {
      const same = (G.profile.name || '').trim() === Cast.get('friend').first;
      await UI.talk([
        { who: 'friend', text: 'יו, {name}! את[ה/] הפלג"צניק[/ית] החדש[/ה]? אני {@friend}. אני גם בפלגה... וגם בניתי את המשחק הזה. כן, זה מוזר גם לי.' },
        ...(same ? [{ who: 'friend', text: 'רגע... גם לך קוראים {name}? אחד מאיתנו מיותר במשחק. ...טוב, אני כתבתי את הקוד, אז זה לא אני.' }] : []),
        { who: 'friend', text: 'שלושה כללים בנתיבות: אחת — לדעת איפה המיגונית. שתיים — הגרעינים בש.ק. שלוש — כש{@inspector} מחפשת מישהו למסדר, רצים. Shift. ברצינות.' },
        { who: 'friend', text: '{@@commander} מחכה ברחבת המסדרים. [תעקוב/תעקבי] אחרי החץ הצהוב. ואם נתקעת בקיר — זה פיצ\'ר.' },
      ]);
    } else if (this.has('lineup')) {
      Sound.whistle();
      UI.toast('⏰ השכמה! מסדר בוקר ב-06:45', 'bad');
    }
  },

  async endDay(forced = false) {
    const S = G.state;
    let missed = 0;
    for (const t of this.tasks) if (!t.done && !t.last && !t.optional) missed++;
    if (missed) Game.addScore(-4 * missed, `${missed} משימות לא בוצעו`);
    if (forced) Game.addScore(-5, 'נרדמת מחוץ למיטה');
    S.stats.days++;
    UI.fade(async () => {
      await this.startDay(S.day + 1);
    });
  },

  // ---------- tasks ----------
  taskList() { return this.tasks.filter(t => !t.hidden); },
  has(id) { return this.tasks.some(t => t.id === id && !t.done); },
  current() { return this.tasks.find(t => !t.done); },
  addTask(id, beforeLast = true) {
    if (this.has(id)) return;
    const t = { id, ...TASKS[id], done: false, progress: 0 };
    const lastIdx = this.tasks.findIndex(x => x.last && !x.done);
    if (beforeLast && lastIdx >= 0) this.tasks.splice(lastIdx, 0, t); else this.tasks.push(t);
    UI.toast(`משימה חדשה: ${t.title}`);
  },
  complete(id, pts = null, reason = '') {
    const t = this.tasks.find(x => x.id === id && !x.done);
    if (!t) return;
    t.done = true;
    const p = pts ?? t.pts;
    if (p) Game.addScore(p, reason || t.title);
    else Sound.good();
    // Every task done adds a little to the "שחורה".
    if (!t.last) Events.addShchora(2);
  },

  objective() {
    if (G.alert) return null;
    const t = this.current();
    if (!t) return { text: World.id === 'netivot' ? 'אין משימות. אפשר להסתובב, להתאמן או ללכת לישון.' : 'אין משימות כאן. תחנת ההסעות מחזירה לנתיבות.', target: World.id === 'netivot' ? null : travelSpot() };
    const tmap = (typeof t.map === 'function' ? t.map() : t.map) || 'netivot';
    if (tmap !== World.id) return { text: `לנסוע ל${siteName(tmap)} — ${fmt(t.title)}`, target: travelSpot() };
    if (t.id === 'deploy') return { text: this.deployText(), target: this.deployTarget() };
    let text = t.title;
    if (t.id === 'clean') text += ` (${10 - this.trash.length}/10)`;
    if (t.id === 'train2') text += ` (${t.progress}/2)`;
    if (t.id === 'reload' && G.player.carry === 'canister') text = 'להביא את המארז למשגר הריק';
    if (t.id === 'rafael' && Events.rafael) text += ` (${Events.rafael.delivered}/3)`;
    if (t.id === 'y_trash') text += ` (${8 - this.trash.length}/8)`;
    if (t.id === 'y_final' && this.tasks.some(x => !x.done && x.id.startsWith('y_') && x.id !== 'y_final')) text = `בוס {@inspector}: עוד ${Events.yasminLeft()} דברים לסדר`;
    if (t.id === 'gate' && this.gateShift) text = `משמרת ש"ג — רכב ${Math.min(this.gateShift.done + 1, this.gateShift.total)}/${this.gateShift.total}`;
    if (this.run) text = `מסלול כושר — נקודה ${this.run.idx + 1}/${this.run.points.length} · ${this.run.time.toFixed(0)} שנ'`;
    return { text, target: this.run ? this.run.points[this.run.idx] : (t.target ? t.target() : null) };
  },

  // ---------- per-frame ----------
  update(dt) {
    const S = G.state;
    // Scheduled alerts wait for the player to be free.
    if (this.pendingAlerts.length && S.clock >= this.pendingAlerts[0] && !G.alert && !Mini.active && !UI.busy && !this.gateShift?.car && World.id !== 'field') {
      this.pendingAlerts.shift();
      this.alert(false);
    }
    // A friend online at this site set off a red alert: it's everyone's.
    const ra = this.remoteAlert;
    if (ra && Date.now() - ra.at > 20000) this.remoteAlert = null;
    else if (ra && !G.alert && !Mini.active && !UI.busy && !Boss.active && !this.ctl && World.id !== 'field') {
      this.remoteAlert = null;
      this.alert(false, 'real', ra.id);
      UI.toast(`🚨 ${ra.from}: אזעקה! כולם למיגונית!`, 'bad');
    }
    if (G.alert) this.updateAlert(dt);
    if (this.gateShift) this.updateGate(dt);
    if (this.run) this.updateRun(dt);
    if (World.id === 'field') this.updateDeploy(dt);
    Events.update(dt);
    Boss.watchCoop();
    Boss.update(dt);
    // Morning lineup: arriving at the parade ground completes it.
    if (this.has('lineup') && !G.alert) {
      const p = G.player;
      if (World.id === 'netivot' && p.x > 34 * TS && p.x < 43.5 * TS && p.y > 22 * TS && p.y < 28.5 * TS) this.lineup();
      else if (S.clock > 8 * 60 && !S.dayFlags.lineupMissed) {
        S.dayFlags.lineupMissed = true;
        this.complete('lineup', -8, 'פספסת את מסדר הבוקר');
      }
    }
    if (S.clock >= 25 * 60 + 30 && !UI.busy && !Mini.active && !G.alert && !S.dayFlags.ending) {
      S.dayFlags.ending = true;
      UI.toast('נרדמת בעמידה... 😴', 'bad');
      this.endDay(true);
    }
  },

  async lineup() {
    const S = G.state;
    const late = S.clock > 6 * 60 + 45;
    this.tasks.find(t => t.id === 'lineup').done = true;
    Sound.whistle();
    const bonus = G.perk && G.perk.key === 'discipline' ? 3 : 0;
    const lines = late
      ? [{ who: 'commander', text: `איחור של ${Math.round(S.clock - (6 * 60 + 45))} דקות, {name}. אני לא כועסת. אני רושמת. זה יותר גרוע.` }]
      : [{ who: 'commander', text: pick(['בוקר טוב {platoon}! עמוד דום... עמוד נוח. {name}, בזמן — יפה מאוד.', 'בוקר! כולם פה? {@p_liran}, גם הנשמה צריכה להיות פה, לא רק הגוף.', 'בוקר טוב. {@p_ofek}, לא, אין עדכון על ברסה במסדר.']) }];
    const today = this.tasks.filter(t => !t.done && !t.last).map(t => '• ' + fmt(t.title)).join('\n');
    if (today) lines.push({ who: 'commander', text: 'המשימות להיום אצלך בטלפון: ' + today.replace(/\n/g, '  ') });
    await UI.talk(lines);
    Game.addScore(late ? -5 : 4 + bonus, late ? 'איחור למסדר' : 'מסדר בוקר בזמן');
    if (this.has('y_room')) await Events.yasminIntro();
    if (this.has('baum')) Events.startBaum();
    if (this.has('find_lock')) {
      await UI.talk([
        { who: 'commander', text: 'יום אחרון לפני יציאה הביתה. רק בעיה אחת: המנעול של השער נשבר. {@p_hila} ניסתה לפתוח אותו עם שיר.' },
        { who: 'p_hila', text: 'וזה כמעט עבד!!! הוא זז! ...טוב, זו הייתה הרוח.' },
        { who: 'commander', text: 'אף אחד לא יוצא הביתה עד שיש מנעול חדש. {name}, [תמצא/תמצאי] מנעול. רק לרס"פית יש מנעולים — {@rasap} בשו"ב.' },
      ]);
    }
  },

  // ---------- interactables ----------
  interactables() {
    const S = G.state;
    const list = [];
    const add = (x, y, label, action, r = 46) => list.push({ x, y, label, action, r });
    const P = G.player;

    if (Boss.active || this.ctl) return list;
    for (const n of G.npcs) list.push({ x: n.x, y: n.y, label: `לדבר עם ${n.short}`, action: () => this.talkTo(n), r: 50, talk: true });
    const ts = travelSpot();
    add(ts.x, ts.y, 'תחנת הסעות', () => this.travelMenu(), 46);

    if (World.id === 'hq') {
      add(SPOTS_HQ.hamal.x, SPOTS_HQ.hamal.y, 'עמדת בקרה בחמ"ל', () => this.radarShift(), 44);
      add(SPOTS_HQ.rasap.x, SPOTS_HQ.rasap.y, this.has('hq_gear') ? 'לחתום על ציוד' : 'דלפק הרספ"ייה', () => this.talkTo(Game.npc('rasap') || { id: 'rasap', person: Cast.get('rasap') }), 44);
      add(SPOTS_HQ.clinic.x, SPOTS_HQ.clinic.y, 'מרפאה', () => this.clinic(), 40);
      add(SPOTS_HQ.gym.x, SPOTS_HQ.gym.y, '🏋️ להתאמן בחדר הכושר', () => this.gym(), 40);
      add(SPOTS_HQ.dining.x, SPOTS_HQ.dining.y, 'לאכול', () => this.eat(), 40);
      add(SPOTS_HQ.kantina.x, SPOTS_HQ.kantina.y, 'לקנות בש"ק', () => Mini.open('shop'), 40);
      if (this.has('snack') && !this.has('find_lock')) add(SPOTS_HQ.snack.x, SPOTS_HQ.snack.y, 'לפתוח את ארונית החטיפים הסודית', () => this.openSnack(), 40);
      else if (Multi.on) add(SPOTS_HQ.snack.x, SPOTS_HQ.snack.y, '🍔 להעיר את צ\'יזבורגרו — קרב עם כל מי שבשו"ב', () => Boss.startCoop(), 40);
      Events.interactables(add);
      Roles.interactables(add);
      return list;
    }
    if (World.id === 'field') {
      this.deployInteractables(add);
      return list;
    }

    // Own bed / locker.
    World.beds.forEach((b, i) => {
      const sp = bedSpot(i);
      if (b.messy) add(sp.x, sp.y, 'לסדר מיטה', () => this.fixBed(b), 34);
      else if (i === S.myBed) add(sp.x, sp.y, 'לישון', () => this.sleep(), 34);
    });
    World.lockers.forEach((l, i) => {
      const sp = lockerSpot(i);
      if (l.open) add(sp.x, sp.y, 'לסדר ולסגור לוקר', () => this.fixLocker(l), 30);
      else if (i === S.myLocker && this.has('locker')) add(sp.x, sp.y, 'לסדר ציוד בלוקר', () => this.doLocker(), 30);
    });
    for (const t of this.trash) add(t.x, t.y, 'לאסוף פסולת', () => this.pickTrash(t), 34);
    for (const d of this.dust) add(d.x, d.y, 'לטאטא', () => this.sweep(d), 30);

    if (!P.carry) add(SPOTS.dining.x, SPOTS.dining.y, 'לאכול', () => this.eat(), 40);
    Events.interactables(add);
    Roles.interactables(add);
    if (this.has('lock_gate') && !this.has('boss')) add(SPOTS.gate.x, SPOTS.gate.y, 'לנעול את השער עם המנעול', () => this.lockGate(), 50);
    add(SPOTS.hamal.x, SPOTS.hamal.y, 'עמדת בקרה', () => this.radarShift(), 40);
    add(SPOTS.board.x, SPOTS.board.y, 'לוח אימונים', () => this.trainingMenu(), 40);
    add(SPOTS.range.x, SPOTS.range.y, 'מטווח', () => this.training('range'), 44);
    add(SPOTS.track.x, SPOTS.track.y, 'מסלול כושר', () => this.training('run'), 40);
    if (this.has('ofek_swap')) add(SPOTS.tower.x, SPOTS.tower.y, '🚽 להחליף את {@p_ofek} בעמדה', () => Events.swapOfek(), 60);
    else add(SPOTS.tower.x, SPOTS.tower.y, 'עמדת שמירה', () => this.guardShift(), 44);

    if (World.launchers.some(l => l.needsReload) && !P.carry) add(SPOTS.depot.x, SPOTS.depot.y, 'לקחת מארז', () => this.takeCanister(), 50);
    for (const L of World.launchers) {
      const sp = launcherSpot(L);
      if (L.needsReload && P.carry === 'canister') add(sp.x, sp.y, `להחליף מארז ב${L.name}`, () => this.reloadLauncher(L), 56);
    }

    // Gate booth panel.
    const gs = this.gateShift;
    let gateLabel = World.gateTarget ? 'לסגור מחסום' : 'לפתוח מחסום';
    if (gs && gs.car && gs.car.state === 'waiting') gateLabel = 'לבדוק את הרכב';
    else if (!gs && this.has('gate')) gateLabel = 'להתחיל משמרת ש"ג';
    add(SPOTS.booth.x, SPOTS.booth.y, gateLabel, () => this.boothAction(), 24);
    return list;
  },

  // ---------- NPC conversations ----------
  // A random line from the character that isn't the one they said last time.
  chatter(n) {
    const lines = n.person.lines;
    let line = pick(lines);
    if (lines.length > 1) while (line === n.lastLine) line = pick(lines);
    n.lastLine = line;
    return UI.talk([{ who: n.id, text: line }]);
  },

  async talkTo(n) {
    const S = G.state;
    S.talked = S.talked || [];
    if (!S.talked.includes(n.id)) { S.talked.push(n.id); if (S.talked.length >= 20) Game.achieve('social'); }
    if (n.chasing) return;
    const id = n.id;
    if (await Events.talkTo(n)) return;
    if (this.has('find_lock') && id !== 'rasap' && await this.lockHint(n)) return;

    if (id === 'commander') {
      if (this.has('meet_cmd')) {
        const v = await UI.talk([
          { who: 'commander', text: 'אז את[ה/] {name}. אני {@@commander}, קצינת הפלגה. פה קוראים לי "שני ארונות". את הסיבה [תגלה/תגלי] לבד.' },
          { who: 'commander', text: 'בנתיבות לא משחקים. צבע אדום — 30 שניות למיגונית. יירוט — מישהו מחליף מארז. שמירה — לא נרדמים. ו{@inspector}? ממנה פשוט [תיזהר/תיזהרי].' },
          { who: 'commander', text: 'בעוד חמישה ימים יש מבחן סיום פלג"צ. מי שעובר[/ת] עולה לסוללת {battery} כ[לוחם/לוחמת] [מוסמך/מוסמכת] ונוסע[/ת] ל{hq} לפגוש את {@@bc}. [מוכן/מוכנה]?', choices: [{ label: 'כן המפקדת!', value: 1 }, { label: 'נראה לי...', value: 0 }] },
        ]);
        await UI.talk([{ who: 'commander', text: v ? 'יפה. ככה אני אוהבת. קודם כל — [לך/לכי] למגורים ו[תסדר/תסדרי] את הציוד בלוקר.' : '"נראה לי" זה לא תשובה בצבא. זה מצב רוח. [לך/לכי] לסדר את הלוקר, ותחזור[/י] עם תשובה.' }]);
        if (!v) Game.addStat('morale', -3);
        this.complete('meet_cmd');
      } else if (this.has('exam_alert') && !this.has('exam_reload')) {
        await UI.talk([{ who: 'commander', text: 'מבחן צבע אדום. כשאני שורקת — רצים למיגונית. בלי לצרוח הפעם. זמן מתחיל... עכשיו!' }]);
        this.alert(true, 'exam');
      } else if (this.has('exam_quiz') && !this.has('exam_radar') && !this.has('exam_alert')) {
        await UI.talk([{ who: 'commander', text: 'שלב אחרון: מבחן ידע. חמש שאלות. [תחשוב/תחשבי] לפני שאת[ה/] עונה. {@friend} אמר שהוא כתב את השאלות. אל תסמוך[/י] עליו.' }]);
        const r = await Mini.open('quiz', { questions: DATA.quiz, count: 5 });
        this.examParts.quiz = r.success;
        this.complete('exam_quiz', r.success ? 10 : 0, 'מבחן ידע');
        if (!this.has('graduation')) return;
        await UI.talk([{ who: 'commander', text: 'סיימת. את התוצאה [תשמע/תשמעי] מ{@@bc} ב{hq}. ההסעה בתחנה. ו{name}... [תתלבש/תתלבשי] יפה, {@harasar} שם.' }]);
      } else {
        await this.chatter(n);
      }
    } else if (id === 'sergeant') {
      if (this.has('drill') && !this.has('locker') && !this.has('meet_cmd')) {
        await UI.talk([
          { who: 'sergeant', text: 'אני {@sergeant}, המש"קית שלך. כולם קוראים לי מלכה, ואני לא מתווכחת 👑' },
          { who: 'sergeant', text: 'בוא[/י] נעשה תרגיל: כשיש אזעקה — רצים למיגונית הקרובה. פס אדום על הגג, נקודה אדומה במפה. מתחילים... עכשיו!' },
        ]);
        this.alert(true, 'drill');
      } else if (this.has('drill')) {
        await UI.talk([{ who: 'sergeant', text: 'קודם [תסיים/תסיימי] עם {@commander} והלוקר, מלך[/ה]. אחר כך תרגיל.' }]);
      } else if (this.has('reload_train')) {
        await UI.talk([
          { who: 'sergeant', text: 'היום לומדים להחליף מארז. משגר 1 ריק בשבילך, באהבה.' },
          { who: 'sergeant', text: 'נכנסים למחסן, לוקחים מארז, מביאים למשגר: נעילת בטיחות, תפסים, מנוף, כבלים, בדיקה. ואם {@tech_launch} שואל — לא נגעת בכלום.' },
        ]);
        World.launchers[0].needsReload = true;
        World.launchers[0].ammo = 0;
        this.complete('reload_train');
        this.addTask('reload');
        Game.setNpcSpot('sergeant', SPOTS.sergeantDoor);
      } else if (this.has('exam_reload')) {
        await UI.talk([{ who: 'sergeant', text: 'מבחן טעינה: משגר 2 ריק. 80 שניות. יש לי סטופר ואמונה מלאה בך 👑' }]);
        World.launchers[1].needsReload = true;
        World.launchers[1].ammo = 0;
        G.state.dayFlags.examReload = true;
        UI.toast('לקחת מארז מהמחסן ולהביא למשגר 2');
      } else {
        await this.chatter(n);
      }
    } else if (id === 'inspector' && this.has('y_final')) {
      const open = this.tasks.filter(t => !t.done && t.id.startsWith('y_') && t.id !== 'y_final');
      if (!open.length) { await Events.yasminFinal(); return; }
      const v = await UI.talk([{ who: 'inspector', text: `עוד ${Events.yasminLeft()} דברים לסדר. ספרתי פעמיים. רוצה שאבדוק עכשיו בכל זאת?`, choices: [{ label: 'כן, [תבדקי/תבדקי] עכשיו', value: 1 }, { label: 'לא, עוד רגע', value: 0 }] }]);
      if (v) { for (const t of open) t.done = true; await Events.yasminFinal(); }
    } else if (id === 'inspector') {
      if (this.has('inspection') && !this.has('inspection_prep')) await this.inspect();
      else if (this.has('inspection_prep') || this.has('surprise')) {
        const left = World.beds.filter(b => b.messy).length + World.lockers.filter(l => l.open).length + this.dust.length;
        await UI.talk([{ who: 'inspector', text: `עוד ${left} דברים לסדר. ספרתי. פעמיים. ואז עוד פעם, ליתר ביטחון.` }]);
      } else await this.chatter(n);
    } else if (id === 'friend') {
      if (!S.dayFlags.seeds) {
        S.dayFlags.seeds = true;
        await UI.talk([{ who: 'friend', text: pick([
          'קח[י] גרעינים. בקוד המקורי זה היה +5 מורל, אבל חיבבתי אותך אז שמתי +8 🌻',
          'יודע[/ת] למה קוראים לזה נתיבוט? כי נתיבות + בוט. לקח לי שלושה ימים להמציא את זה.',
          'טיפ ממי שכתב את המשחק: {@inspector} לא רואה אותך כשאת[ה/] רץ[/ה]. ...טוב, היא רואה. אבל היא לא מספיקה.',
          'אם תמצא[/י] באג — תגיד[/י] ל{@p_nevo}. הוא בטוח יגיד שזה הוא שבר.',
        ]) }]);
        Game.addStat('morale', 8);
        UI.toast('מורל +8 🌻', 'good');
      } else await this.chatter(n);
    } else if (id === 'ruth') {
      await this.ruth();
    } else if (id === 'bc') {
      if (this.has('graduation') && !this.tasks.some(t => t.id.startsWith('exam_') && !t.done)) await this.graduation();
      else await this.chatter(n);
    } else if (id === 'rasap' && this.has('find_lock')) {
      await UI.talk([
        { who: 'rasap', text: 'מנעול? אין. ...טוב. יש אחד. המנעול האחרון בסוללה.' },
        { who: 'rasap', text: 'הוא בארונית החטיפים הסודית של {@deputy_rasap}. מאחורי המדפים ברספ"ייה. הוא חושב שאני לא יודעת.' },
        { who: 'rasap', text: 'אף אחד שנכנס לשם לא יצא עם אותה תזונה. [תיזהר/תיזהרי]. ו[תחתום/תחתמי] על המנעול.' },
      ]);
      this.complete('find_lock', 3, 'גילית איפה המנעול');
    } else if (id === 'deputy_rasap' && this.has('snack')) {
      await UI.talk([{ who: 'deputy_rasap', text: '*מסתיר משהו מאחורי הגב* ארונית? איזו ארונית? אין פה ארונית. יש פה... מדף. מדף עם דלת. ומנעול.' }]);
    } else if (id === 'rasap') {
      if (this.has('hq_gear')) await this.signGear();
      else await this.chatter(n);
    } else if (id === 'ops' && this.has('radar')) {
      await UI.talk([
        { who: 'ops', text: 'משמרת בקרה. [שב/שבי] בעמדה, עיניים על המסך. {@hamalist} — שקט.' },
        { who: 'hamalist', text: 'אני שקטה!!! זה הקול השקט שלי!!!' },
      ]);
      await this.radarShift();
    } else if (id === 'harasar' && !S.dayFlags.uniform) {
      S.dayFlags.uniform = true;
      await UI.talk([{ who: 'harasar', text: 'בדיקת לבוש! עמוד[/י] ישר. ...מה זה החגור הזה? ליישר. מהר!' }]);
      const r = await Mini.open('qte', { title: 'יישור מדים מול הרס"ר', sub: 'חגור, כומתה, שרוולים. [הקש/הקישי] מהר!', length: 4, time: 5, silent: true });
      await UI.talk([{ who: 'harasar', text: r.success ? 'טוב. הפעם. אני עוד אמצא משהו. אני תמיד מוצא.' : 'הכומתה על הכתף, השרוולים מגולגלים, ובנעליים יש חוף שלם. [לך/לכי] לתקן.' }]);
      Game.addScore(r.success ? 3 : -2, r.success ? 'עברת בדיקת לבוש' : 'נכשלת בבדיקת לבוש');
    } else if (World.id === 'field' && (id === 'driver1' || id === 'driver2') && this.deployTruck && this.deployTruck.state === 'waiting') {
      this.acceptTruck();
    } else {
      await this.chatter(n);
    }
  },

  // ---------- HQ ----------
  async signGear() {
    await UI.talk([
      { who: 'rasap', text: 'שלום, אני {@rasap}. באת לחתום? יופי. אפוד, קסדה, מימייה, פנס — וחתימה על זה שחתמת.' },
      { who: 'deputy_rasap', text: '*נשען על הדלפק בהילוך איטי* ...תחתום[/י] חזק. כמו בסרטים.' },
      { who: 'rasap', text: '{@deputy_rasap}, אתה מפריע. ותוריד את המשקפיים, אנחנו בתוך מבנה.' },
    ]);
    const r = await Mini.open('qte', { title: 'חתימה על טופס ציוד', sub: 'שם, מספר אישי, חתימה, חתימה על החתימה. [הקש/הקישי] את הרצף!', length: 6, time: 9, silent: true });
    if (!r.success) { await UI.talk([{ who: 'rasap', text: 'החתימה יצאה עקומה. גם את זה צריך לחתום מחדש. עוד פעם.' }]); return; }
    await UI.talk([
      { who: 'rasap', text: 'חתום. עכשיו הציוד קיים. אם הוא נעלם — את[ה/] קיים[/ת] אצלי בטבלה 📦' },
      { who: 'sarsap', text: 'ואם חסר משהו — זה אצלי. ...לא, רגע, זה אצלך עכשיו. מזל טוב.' },
    ]);
    this.complete('hq_gear', 5, 'חתימה על ציוד');
  },
  async gym() {
    const S = G.state;
    if (S.dayFlags.gym) { UI.toast('כבר התאמנת היום. השרירים צריכים לנוח, ו[אתה/את] צריך[/ה] מקלחת.'); return; }
    const r = await Mini.open('qte', { title: 'חדר כושר — סט אחרון', sub: 'עוד חזרה אחת! [הקש/הקישי] את הרצף לפני שהמשקולת מנצחת.', length: 7, time: 9, silent: true });
    S.dayFlags.gym = true;
    if (!r.success) { Game.addStat('energy', -6); UI.toast('המשקולת ניצחה. היום. 😮‍💨', 'bad'); return; }
    Game.addStat('energy', -8);
    Game.addStat('morale', 8);
    Events.addShchora(-2);
    Game.addScore(2, 'אימון בחדר הכושר');
    await UI.talk([{ who: 'p_shaked', text: pick(['יפה! עכשיו ברוקולי וחלבון. לא, צ׳יפס זה לא חלבון.', 'עוד סט אחד ואתה מוכן ל{@deputy_rasap}. כלומר לצ׳יזבורגרו.', 'גאה בך. מחר — רגליים. אל תברח[/י].']) }]);
  },
  async clinic() {
    const S = G.state;
    if (S.dayFlags.clinic) { await UI.talk([{ who: 'medic1', text: 'כבר היית היום. [שתה/שתי] מים. כן, שוב.' }]); return; }
    S.dayFlags.clinic = true;
    await UI.talk([
      { who: 'medic3', text: 'שלום! מה כואב? ...הכל? אקמול, מים ומנוחה.' },
      { who: 'medic2', text: 'ופלסטר. תמיד יש פלסטר.' },
      { who: 'medic1', text: '[שתה/שתי] את כל הבקבוק. אני מסתכלת.' },
    ]);
    Game.addStat('energy', 25);
    Game.addStat('morale', 4);
    UI.toast('אנרגיה +25 💧', 'good');
  },

  // ---------- easter egg ----------
  async ruth() {
    const S = G.state;
    const egg = ROSTER.easterEgg;
    if (S.achievements.includes('ruth')) { await UI.talk([{ who: 'ruth', text: 'שששש! אני לא פה. אני בכיתה. [תגיד/תגידי] ל{@commander} שלום ממני 📚' }]); return; }
    const v = await UI.talk([
      { who: 'ruth', text: egg.hello },
      { who: 'ruth', text: egg.question, choices: egg.answers.map((a, i) => ({ label: a, value: i + 1 })) },
    ]);
    const right = v - 1 === egg.ok;
    await UI.talk([{ who: 'ruth', text: right ? egg.right : egg.wrong }]);
    if (right) { Game.achieve('ruth'); Game.addStat('morale', 10); }
  },

  // ---------- inspector chase ----------
  chaseAllowed() {
    return G.state && !this.has('meet_cmd') && !this.has('inspection_prep') && !this.has('inspection') && !this.has('surprise') && !this.gateShift && !G.player.carry
      && !this.tasks.some(t => !t.done && t.id.startsWith('y_')) && !Events.baum && !Events.tech;
  },
  async caught() {
    Game.achieve('caught');
    Sound.whistle();
    await UI.talk([
      { who: 'inspector', text: pick(['תפסתי אותך! מסדר פתע. ארבעה כתמי אבק במגורים, עכשיו.', 'חשבת שתברח[/י]? יש לי סיבולת של מסדרים. לטאטא את המגורים!', 'מה זה, טיול? מסדר פתע! המגורים מחכים לך.']) },
      { who: 'p_shalev', text: 'טפנו עלא וושק... ברוך השם שזה לא אני הפעם.' },
    ]);
    for (let i = 0; i < 4; i++) this.dust.push(dustSpot());
    this.addTask('surprise');
    Game.addStat('morale', -4);
  },

  // ---------- travel between sites ----------
  async travelMenu() {
    if (this.gateShift) { UI.toast('קודם לסיים את משמרת הש"ג'); return; }
    if (this.run) { UI.toast('קודם לסיים את הריצה'); return; }
    const S = G.state;
    const dests = ['netivot', 'hq'];
    if (this.has('deploy') || (S.deploy && S.deploy.placed && S.deploy.placed.length)) dests.push('field');
    const choices = dests.filter(d => d !== World.id).map(d => ({ label: `ל${siteName(d)}`, value: d }));
    choices.push({ label: 'לא עכשיו', value: null });
    const dest = await UI.talk([{ who: 'player', text: 'לאן נוסעים?', choices }]);
    if (!dest) return;
    const driver = pick(['driver1', 'driver2']);
    const ride = {
      driver1: ['דבאי, תעלה[/י]. חגורה! ...אצלנו ברוסיה לא שמים. פה כן.', 'נוסעים. אם יש בורות — זה לא אני, זה הכביש.'],
      driver2: ['[אחי/אחותי] תעלה[/י], יש לי פלייליסט שיעשה לך צמרמורת.', 'לפי וויז עשרים דקות. לפי {@driver2} — שבע.'],
    }[driver];
    await UI.talk([{ who: driver, text: pick(ride) }]);
    if (G.player.carry) { G.player.carry = false; UI.toast('את מה שסחבת השארת בתחנה. מישהו כבר יסחוב.'); }
    if (Events.chores && Events.chores.dragging) Events.chores.dragging = false;
    if (dest === 'field' && S.deploy && S.deploy.done) { S.deploy = { placed: [] }; delete World.cache.field; }
    UI.fade(() => {
      S.clock += 25;
      Game.switchMap(dest);
      UI.toast(`הגעת ל${siteName(dest)}`, 'good');
      if (dest === 'hq') Game.achieve('hq');
      if (dest === 'field' && this.has('deploy')) setTimeout(() => this.startDeploy(), 600);
    });
  },

  // ---------- teleport ----------
  // For 2₪ you skip the walk (and the bus): straight to where the current task is.
  WARP_PRICE: 2,
  warpTarget() {
    if (G.alert || Boss.active || this.ctl || this.run || Mini.active || UI.busy || G.paused || !G.running) return null;
    const t = this.current();
    if (!t) return null;
    const tmap = (typeof t.map === 'function' ? t.map() : t.map) || 'netivot';
    if (tmap !== World.id) return { map: tmap };
    if (t.id === 'deploy') return null;
    const o = this.objective();
    if (!o || !o.target) return null;
    if (Math.hypot(o.target.x - G.player.x, o.target.y - G.player.y) < 7 * TS) return null;
    return { map: World.id };
  },
  warp() {
    const w = this.warpTarget();
    if (!w) return;
    const S = G.state;
    if (S.money < this.WARP_PRICE) { Sound.bad(); UI.toast(`אין מספיק כסף — להשתגר עולה ${this.WARP_PRICE}₪`, 'bad'); return; }
    S.money -= this.WARP_PRICE;
    Sound.whoosh();
    UI.fade(() => {
      if (w.map !== World.id) {
        if (G.player.carry) G.player.carry = false;
        if (Events.chores && Events.chores.dragging) Events.chores.dragging = false;
        if (w.map === 'field' && S.deploy && S.deploy.done) { S.deploy = { placed: [] }; delete World.cache.field; }
        Game.switchMap(w.map);
        if (w.map === 'hq') Game.achieve('hq');
        if (w.map === 'field' && this.has('deploy')) setTimeout(() => this.startDeploy(), 600);
      }
      const o = this.objective();
      const q = o && o.target && warpSpot(o.target);
      if (q) { G.player.x = q.x; G.player.y = q.y; G.player.vx = G.player.vy = 0; }
      Scene3D.greenPuff(G.player.x, G.player.y, 1.4);
      UI.toast(`⚡ השתגרת! −${this.WARP_PRICE}₪`, 'good');
      Game.hud();
    });
  },

  // ---------- site deployment ----------
  // The deployment is hands-on: drive each truck in from the gate with the arrows, then
  // raise the launcher or lower the container onto its marked pad with the crane.
  deployTruck: null,
  ctl: null, // { mode: 'drive' | 'raise' | 'crane', ... } while the player is at the controls
  nextDeployItem() {
    const placed = (G.state.deploy && G.state.deploy.placed) || [];
    return DATA.deploy.find(d => !placed.includes(d.id));
  },
  async startDeploy() {
    const S = G.state;
    S.deploy = S.deploy || { placed: [] };
    if (S.deploy.intro) return;
    S.deploy.intro = true;
    await UI.talk([
      { who: 'commander', text: 'המצב מתחמם. פורסים אתר חדש, עכשיו. המשאיות בדרך עם המכולות.' },
      { who: 'commander', text: 'כל משאית שמגיעה — את[ה/] [מנווט/מנווטת] אותה בעצמך עד הסימון הצהוב. משגר — [מזקיף/מזקיפה]. מכולה — [מוריד/מורידה] עם המנוף, בדיוק על הסימון. קודם מיגונית.' },
      { who: 'p_nevo', text: 'אפשר להתחיל מהשירותים הכימיים? יש לי סיבות אישיות.' },
      { who: 'commander', text: 'לא.' },
    ]);
  },
  padCenter(it) { return { x: (it.x + it.w / 2) * TS, y: (it.y + it.h / 2) * TS }; },
  updateDeploy(dt) {
    if (!this.has('deploy')) return;
    const S = G.state;
    if (!S.deploy || !S.deploy.intro) return;
    let tr = this.deployTruck;
    if (!tr) {
      const item = this.nextDeployItem();
      if (!item) return;
      const driver = (S.deploy.placed.length % 2) ? 'driver2' : 'driver1';
      tr = this.deployTruck = { item, driver, x: 30.5 * TS, y: 46 * TS, angle: -Math.PI / 2, speed: 0, state: 'arriving' };
      World.gateTarget = 1;
      Sound.truck();
    }
    const sp = 170 * dt;
    const drive = (tx, ty) => {
      const dx = tx - tr.x, dy = ty - tr.y, d = Math.hypot(dx, dy);
      if (d < sp) { tr.x = tx; tr.y = ty; return true; }
      tr.x += dx / d * sp; tr.y += dy / d * sp;
      tr.angle = Math.atan2(dy, dx);
      return false;
    };
    if (tr.state === 'arriving' && drive(30.5 * TS, 37 * TS)) { tr.state = 'waiting'; World.gateTarget = 0; Sound.horn(); UI.toast(`🚛 הגיעה משאית: ${tr.item.name} — לגשת אליה ולהכווין`); }
    else if (tr.state === 'leaving') {
      World.gateTarget = 1;
      // Back to the main road first, then out of the gate.
      const out = Math.abs(tr.x - 30.5 * TS) > 4 ? drive(30.5 * TS, Math.max(tr.y, 24 * TS)) : drive(30.5 * TS, 47 * TS);
      if (out && tr.y > 46 * TS) { this.deployTruck = null; World.gateTarget = 0; }
    }
    if (this.ctl) this.updateCtl(dt);
  },
  acceptTruck() {
    const tr = this.deployTruck;
    if (!tr || tr.state !== 'waiting') return;
    tr.state = 'drive';
    this.ctl = { mode: 'drive', stillT: 0, wrongT: 0, joked: {} };
    const lines = {
      driver1: ['דבאי, תנהג[/י] את[ה/]. אני רואה רק במראות, ובמראות רואים רק אותך.', 'ההגה שלך. אם יש שריטה — זה עליך.'],
      driver2: ['[קח/קחי] את ההגה, [אחי/אחותי]. שבע דקות, כמו שאני הייתי עושה.', 'אני עם הפלייליסט, את[ה/] עם ההגה. דיל.'],
    }[tr.driver];
    UI.talk([{ who: tr.driver, text: `${pick(lines)} יש לי פה: ${tr.item.name}.`, choices: [
      { label: '🔒 לחגור חגורה', value: 1 },
      { label: 'בלי חגורה — זה רק מאתיים מטר', value: 0 },
    ] }]).then(v => {
      if (v) return;
      UI.toast('🚨 בלי חגורה! מישהו מהלשכה ראה...', 'bad');
      Events.charge('belt');
    });
  },

  // ---------- at the controls ----------
  // input: { steer, throttle, mx, my, lower, raise } from Game.update.
  ctlInput(inp) { this.ctlIn = inp; },
  // The launcher goes up to 70°; the green range is a few degrees either side.
  RAISE: { target: 70, lo: 67, hi: 73, max: 85 },
  updateCtl(dt) {
    const c = this.ctl, tr = this.deployTruck, inp = this.ctlIn || {};
    if (!tr) { this.ctl = null; return; }
    const it = tr.item, pc = this.padCenter(it);
    if (c.mode === 'drive') {
      // Simple truck physics: throttle, drag, and steering that needs speed to turn.
      tr.speed += (inp.throttle || 0) * 140 * dt;
      tr.speed *= Math.pow(inp.throttle ? 0.6 : 0.15, dt);
      tr.speed = Math.max(-60, Math.min(150, tr.speed));
      tr.angle += (inp.steer || 0) * dt * 1.6 * Math.max(-1, Math.min(1, tr.speed / 60));
      const nx = tr.x + Math.cos(tr.angle) * tr.speed * dt, ny = tr.y + Math.sin(tr.angle) * tr.speed * dt;
      World.gateTarget = tr.y > 38 * TS ? 1 : World.gateTarget;
      const hits = [-2.4, -1.2, 0, 1.2, 2.4].some(o => World.blocked(nx + Math.cos(tr.angle) * o * TS, ny + Math.sin(tr.angle) * o * TS, 20));
      if (hits) { if (Math.abs(tr.speed) > 40) { Sound.bad(); G.shake = 0.2; } tr.speed = -tr.speed * 0.3; }
      else { tr.x = nx; tr.y = ny; }
      // Parked: slow, and the truck's middle beside the yellow outline.
      const near = Math.hypot(tr.x - pc.x, tr.y - pc.y) < (Math.max(it.w, it.h) / 2 + 2) * TS;
      c.stillT = Math.abs(tr.speed) < 12 ? c.stillT + dt : 0;
      if (near && c.stillT > 0.6) {
        tr.speed = 0;
        Sound.horn();
        if (it.kind === 'launcher') { this.ctl = { mode: 'raise', angle: 0, holdT: 0 }; tr.state = 'raise'; UI.toast('🚀 להזקיף את המשגר ל־70 מעלות: ↑ להרים, ↓ להוריד — ולהחזיק בטווח הירוק'); }
        else { this.ctl = { mode: 'crane', hx: tr.x, hy: tr.y, cx: tr.x, cy: tr.y, vx: 0, vy: 0, h: 6.5 }; tr.state = 'crane'; UI.toast('🏗️ להוריד עם המנוף: חצים — להזיז, רווח/E — להוריד, Shift — להרים'); }
        return;
      }
      // Stopped by the wrong pad: the driver has opinions.
      const wrong = !near && DATA.deploy.find(d => d.id !== it.id && !G.state.deploy.placed.includes(d.id) && Math.hypot(tr.x - this.padCenter(d).x, tr.y - this.padCenter(d).y) < (Math.max(d.w, d.h) / 2 + 1.5) * TS);
      if (wrong && c.stillT > 0.8 && !c.joked[wrong.id]) {
        c.joked[wrong.id] = true;
        const jokes = {
          driver1: [`זה הסימון של ${wrong.name}. ברוסיה היינו מתווכחים. פה — סע הלאה.`, 'זה לא המקום. אפילו אני יודע, ואני רק יושב פה.'],
          driver2: [`[אחי/אחותי], זה "${wrong.name}". אני מחזיק "${it.name}". ...אני מקווה.`, 'אם אני מוריד פה, {@commander} מורידה אותי. נוסעים.'],
        }[tr.driver];
        UI.toast(fmt(`🚛 ${Cast.short(tr.driver)}: ${pick(jokes)}`));
        Game.addScore(-1, 'חנייה במקום הלא נכון');
      }
    } else if (c.mode === 'raise') {
      // ↑/↓ swing the launch box; it has to sit in the green range for a moment.
      const R = this.RAISE;
      c.angle = Math.max(0, Math.min(R.max, c.angle + (inp.throttle || 0) * 30 * dt));
      const ok = c.angle >= R.lo && c.angle <= R.hi;
      c.holdT = ok ? c.holdT + dt : Math.max(0, c.holdT - dt * 2);
      if (c.holdT > 1.3) { Sound.good(); this.placeDeploy(); }
    } else if (c.mode === 'crane') {
      // The hook follows the arrows; the load swings after it on its cable.
      const B = Scene3D.basis();
      const mx = inp.mx || 0, my = inp.my || 0;
      c.hx += (B.rx * mx - B.fx * my) * 60 * dt;
      c.hy += (B.rz * mx - B.fz * my) * 60 * dt;
      const lim = (Math.max(it.w, it.h) / 2 + 4) * TS;
      c.hx = Math.max(pc.x - lim, Math.min(pc.x + lim, c.hx));
      c.hy = Math.max(pc.y - lim, Math.min(pc.y + lim, c.hy));
      const k = 6, damp = 2.2;
      c.vx += ((c.hx - c.cx) * k - c.vx * damp) * dt;
      c.vy += ((c.hy - c.cy) * k - c.vy * damp) * dt;
      c.cx += c.vx * dt;
      c.cy += c.vy * dt;
      if (inp.lower) c.h = Math.max(0, c.h - 1.4 * dt);
      if (inp.raise) c.h = Math.min(7, c.h + 1.8 * dt);
      c.aligned = Math.abs(c.cx - pc.x) < 0.7 * TS && Math.abs(c.cy - pc.y) < 0.7 * TS;
      if (c.h <= 0) {
        if (c.aligned && Math.hypot(c.vx, c.vy) < 60) { Sound.boom(); G.shake = 0.3; this.placeDeploy(); }
        else { c.h = 1.6; Sound.bad(); G.shake = 0.2; UI.toast(c.aligned ? 'מתנדנד מדי! לחכות שיתייצב' : 'לא על הסימון! להרים ולכוון שוב', 'bad'); Game.addScore(-1, 'הורדה לא מדויקת'); }
      }
    }
  },
  placeDeploy() {
    const tr = this.deployTruck;
    const S = G.state;
    S.deploy.placed.push(tr.item.id);
    const o = World.placeContainer(null, tr.item);
    if (o) Scene3D.addProp(o);
    Game.addScore(3, `הוצב: ${tr.item.name}`);
    this.ctl = null;
    tr.state = 'leaving';
    tr.speed = 0;
    if (!this.nextDeployItem()) this.finishDeploy();
  },
  async finishDeploy() {
    const S = G.state;
    S.deploy.done = true;
    await UI.talk([
      { who: 'commander', text: 'האתר פרוס. מיגונית, משגר, חדרי שינה, חדר אוכל, מטבח, מקלחות ושירותים. {platoon} — כל הכבוד.' },
      { who: 'p_nevo', text: 'ואני חנכתי את השירותים הכימיים. לא תודה לי, תודה למדע.' },
      { who: 'driver2', text: 'ואת כל זה עשינו בשבע דקות. לפי השעון שלי.' },
    ]);
    Game.achieve('deploy');
    this.complete('deploy', 15, 'פריסת אתר');
  },
  deployInteractables(add) {
    const tr = this.deployTruck;
    if (!tr || this.ctl) return;
    if (tr.state === 'waiting') add(tr.x, tr.y, `לקחת את ההגה: ${tr.item.name}`, () => this.acceptTruck(), 90);
  },
  deployTarget() {
    if (World.id !== 'field') return travelSpot();
    const tr = this.deployTruck;
    if (!tr) return null;
    if (tr.state === 'waiting') return { x: tr.x, y: tr.y };
    if (tr.state === 'drive' || tr.state === 'crane') return this.padCenter(tr.item);
    return null;
  },
  deployText() {
    const S = G.state;
    const n = (S.deploy && S.deploy.placed.length) || 0;
    const tr = this.deployTruck;
    let step = 'ממתינים למשאית';
    if (tr && tr.state === 'waiting') step = `לקחת את ההגה של המשאית: ${tr.item.name}`;
    else if (tr && tr.state === 'drive') step = `לנהוג עד הסימון של: ${tr.item.name}`;
    else if (tr && tr.state === 'raise') step = 'להזקיף את המשגר';
    else if (tr && tr.state === 'crane') step = `להוריד עם המנוף: ${tr.item.name}`;
    return `פריסת אתר (${n}/${DATA.deploy.length}) — ${step}`;
  },

  // ---------- simple actions ----------
  async doLocker() {
    const r = await Mini.open('qte', { title: 'סידור לוקר', sub: 'לקפל מדים, לסדר נעליים, לתלות כומתה. [הקש/הקישי] את הרצף!', length: 5, time: 9 });
    if (r.success) this.complete('locker');
  },
  async fixBed(b) {
    const r = await Mini.open('qte', { title: 'סידור מיטה', sub: 'מתיחת שמיכה — פינות "בית חולים"!', length: 4, time: 7, silent: true });
    if (r.success) { b.messy = false; Sound.good(); this.checkPrep(); } else UI.toast('לא מספיק מתוח, עוד פעם', 'bad');
  },
  async fixLocker(l) {
    const r = await Mini.open('qte', { title: 'סידור לוקר', length: 4, time: 7, silent: true });
    if (r.success) { l.open = false; Sound.good(); this.checkPrep(); } else UI.toast('נפל הכל... עוד פעם', 'bad');
  },
  sweep(d) {
    this.dust.splice(this.dust.indexOf(d), 1);
    Sound.sweep();
    this.checkPrep();
  },
  checkPrep() {
    Events.yasminCheck();
    if (this.has('surprise') && !this.dust.length) {
      this.complete('surprise', 2, 'מסדר פתע');
      UI.talk([{ who: 'inspector', text: pick(['...טוב. הפעם עברת. אני עדיין מסתכלת עליך.', 'נקי. בערך. נגיד שנקי.']) }]);
    }
    if (!this.has('inspection_prep')) return;
    const left = World.beds.filter(b => b.messy).length + World.lockers.filter(l => l.open).length + this.dust.length;
    if (!left) { this.complete('inspection_prep', 3, 'החדר מוכן'); UI.toast('החדר מוכן! לקרוא ל{@inspector}', 'good'); }
  },
  pickTrash(t) {
    this.trash.splice(this.trash.indexOf(t), 1);
    Sound.pickup();
    Events.yasminCheck();
    if (!this.trash.length && this.has('clean')) {
      this.complete('clean');
      Game.achieve('clean');
    }
  },
  async eat() {
    const S = G.state;
    const meal = S.clock < 10 * 60 ? 'breakfast' : S.clock < 17 * 60 ? 'lunch' : 'dinner';
    // The dinner task can't be done in the morning: offer to wait in the dining room until it's served.
    if (meal !== 'dinner' && this.has('dinner')) {
      const ate = S.dayFlags['ate_' + meal];
      const choices = [{ label: '⏩ לחכות לארוחת ערב (18:00)', value: 'wait' }];
      if (!ate) choices.push({ label: meal === 'breakfast' ? '🍳 לאכול ארוחת בוקר' : '🍗 לאכול צהריים', value: 'eat' });
      choices.push({ label: 'לא עכשיו', value: null });
      const v = await UI.talk([{ who: 'player', text: `ארוחת ערב מוגשת מ־17:00, ועכשיו ${clockText()}.`, choices }]);
      if (v === 'wait') { await this.waitForDinner(); return; }
      if (v !== 'eat') return;
    }
    if (meal === 'lunch' && World.id === 'netivot' && this.has('rafael')) { UI.toast('האוכל עדיין במשאית של רפאל. קודם לפרוק!', 'bad'); return; }
    // Choose from the dishes on the counter; up to three plates a meal.
    const eaten = S.dayFlags['eat_' + meal] = S.dayFlags['eat_' + meal] || [];
    if (eaten.length >= 3) { UI.toast('כבר אכלת שלוש מנות. עוד ביס ואת[ה/] מתגלגל[/ת] למסדר.'); return; }
    const feast = meal === 'dinner' && S.dayFlags.feast && !eaten.includes('feast');
    const dishes = DATA.menu[meal].filter(d => !eaten.includes(d.id));
    const choices = dishes.map(d => ({ label: `${d.icon} ${d.name}`, value: d.id }));
    if (feast) choices.unshift({ label: '🍕 החגיגה: כל האוכל שהוחבא מ{@bc}!', value: 'feast' });
    choices.push({ label: 'סיימתי', value: null });
    const title = { breakfast: 'ארוחת בוקר', lunch: 'ארוחת צהריים', dinner: 'ארוחת ערב' }[meal];
    const pickId = await UI.talk([{ who: 'player', text: `${title}. מה לוקחים? (${eaten.length}/3 מנות)`, choices }]);
    if (!pickId) return;
    eaten.push(pickId);
    S.dayFlags['ate_' + meal] = true;
    if (pickId === 'feast') {
      Game.addStat('energy', 30); Game.addStat('morale', 14); Events.addShchora(-4);
      UI.toast('🍕🌯🍣 חגיגה!', 'good');
    } else {
      const d = DATA.menu[meal].find(x => x.id === pickId);
      let name = d.name;
      if (pickId === 'schnitzel' && S.dayFlags.rafaelFood) name = 'שניצל של רפאל ופירה';
      Game.addStat('energy', d.energy);
      Game.addStat('morale', d.morale);
      Events.addShchora(d.healthy ? -3 : -2);
      UI.toast(`${d.icon} ${name} · אנרגיה +${d.energy}`, 'good');
      if (d.healthy) Game.addScore(1, 'אוכל בריא');
    }
    if (meal === 'dinner') this.complete('dinner');
  },
  async waitForDinner() {
    const S = G.state;
    if (Events.rafael) { UI.toast('קודם לפרוק את רפאל — המשאית מחכה בשער', 'bad'); return; }
    UI.fade(() => {
      S.clock = Math.max(S.clock, 18 * 60);
      // Whatever was scheduled for the skipped hours happened without you.
      this.pendingAlerts = this.pendingAlerts.filter(t => t > S.clock);
      if (!S.dayFlags.rafael) { S.dayFlags.rafael = true; S.dayFlags.rafaelFood = true; }
      if (S.dayFlags.techAt && !S.dayFlags.tech) S.dayFlags.tech = true;
      Game.addStat('energy', -10);
    });
    await new Promise(r => setTimeout(r, 650));
    UI.toast('⏩ השעה 18:00 — ארוחת ערב!');
    await this.eat();
  },

  async sleep() {
    const S = G.state;
    const open = this.tasks.filter(t => !t.done && !t.last);
    if (S.mode === 'story' && this.has('graduation')) { UI.toast('קודם לשמוע את התוצאה מ{@@bc}'); return; }
    if (S.clock < 19 * 60 && open.length) {
      const v = await UI.talk([{ who: 'player', text: `עוד ${open.length} משימות פתוחות והשעה ${clockText()}. ללכת לישון בכל זאת?`, choices: [{ label: 'כן, לישון', value: 1 }, { label: 'לא, עוד רגע', value: 0 }] }]);
      if (!v) return;
    }
    this.complete('sleep');
    // Lights out — but the night isn't always quiet.
    if (!S.dayFlags.nightDone) {
      S.dayFlags.nightDone = true;
      const r = Math.random();
      if (r < 0.05 && Cast.get('commander') && !Multi.taken().has('commander')) { await Events.orinDance(); }
      else if (r < 0.05 + 0.33) {
        await UI.cutscene([{ img: 'assets/redalert.jpg', who: '', text: '02:13. הטלפונים מצפצפים, האורות נדלקים. "הקפצה! צבע אדום — תרגיל!"' }]);
        this.alert(true, 'night-drill');
        return; // endAlert puts everyone back to bed
      }
    }
    this.goToSleep();
  },
  // In multiplayer the day moves on only when everyone online is asleep.
  goToSleep() {
    const S = G.state;
    if (Multi.on && Multi.peers.length) { this.waitForAll(); return; }
    S.dayFlags.ending = true;
    this.endDay();
  },
  waitForAll() {
    const S = G.state;
    Multi.sleeping = true;
    let box = $('#sleep-wait');
    if (!box) { box = document.createElement('div'); box.id = 'sleep-wait'; box.className = 'sleep-wait'; document.body.appendChild(box); }
    box.innerHTML = '<div class="sw-z">😴</div><div class="sw-t"></div><button class="btn small ghost" data-up>לקום מהמיטה</button>';
    box.classList.remove('hidden');
    G.paused = true;
    const stop = () => { clearInterval(timer); box.classList.add('hidden'); Multi.sleeping = false; G.paused = false; };
    box.querySelector('[data-up]').onclick = () => { stop(); UI.toast('קמת. כולם מחכים לך במיטה 🛏️'); };
    const tick = () => {
      const awake = Multi.peers.filter(p => !p.sl);
      box.querySelector('.sw-t').textContent = awake.length
        ? `ישנים ${Multi.peers.length + 1 - awake.length}/${Multi.peers.length + 1}. מחכים ל: ${awake.map(p => p.name).join(', ')}`
        : 'כולם ישנים. לילה טוב...';
      if (!awake.length || !Multi.on) { stop(); S.dayFlags.ending = true; this.endDay(); }
    };
    const timer = setInterval(tick, 500);
    tick();
  },
  async trainingMenu() {
    const r = await Mini.open('training');
    if (r.pick) this.training(r.pick);
  },

  async training(kind) {
    const S = G.state;
    const count = S.trainCount[kind] || 0;
    let ok = false, pts = 0;
    if (kind === 'range') { const r = await Mini.open('range'); ok = r.success; pts = Math.round(r.score / 10); if (r.score >= 80) Game.achieve('sniper'); }
    else if (kind === 'reload') { const r = await Mini.open('reload', { launcher: 'משגר אימון' }); ok = r.success; pts = 5; }
    else if (kind === 'radar') { const r = await Mini.open('radar', { duration: 35 }); ok = r.success; pts = Math.round(r.accuracy / 15); if (r.accuracy >= 90) Game.achieve('radar'); }
    else if (kind === 'guard') { const r = await Mini.open('guard', { duration: 40 }); ok = r.success; pts = 5; }
    else if (kind === 'quiz') { const r = await Mini.open('quiz', { questions: DATA.quiz, count: 5 }); ok = r.success; pts = r.right; }
    else if (kind === 'alertDrill') { await UI.talk([{ who: 'sergeant', text: 'תרגיל! [רוץ/רוצי] למיגונית!' }]); this.alert(true, 'drill-train'); return; }
    else if (kind === 'run') { this.startRun(); return; }
    else if (kind === 'gateDrill') { this.startGateShift(3, true); UI.toast('לרוץ לעמדת הש"ג!'); return; }
    this.trainingDone(kind, ok, pts);
  },
  trainingDone(kind, ok, pts) {
    const S = G.state;
    if (!ok) return;
    S.trainCount[kind] = (S.trainCount[kind] || 0) + 1;
    if (S.trainCount[kind] <= 2) Game.addScore(pts, 'אימון');
    const t = this.tasks.find(x => x.id === 'train2' && !x.done);
    if (t) { t.progress++; if (t.progress >= 2) this.complete('train2', 4, 'שני אימונים'); }
  },

  startRun() {
    if (this.run) return;
    const pts = [...TRACK_POINTS, ...TRACK_POINTS, SPOTS.track];
    this.run = { points: pts, idx: 0, time: 0 };
    Sound.whistle();
    UI.toast('🏃 2 הקפות! לרוץ דרך הנקודות הצהובות');
  },
  updateRun(dt) {
    const r = this.run;
    r.time += dt;
    const p = r.points[r.idx];
    if (Math.hypot(G.player.x - p.x, G.player.y - p.y) < 42) {
      r.idx++;
      Sound.click();
      if (r.idx >= r.points.length) {
        this.run = null;
        const ok = r.time < 75;
        UI.toast(ok ? `סיימת ב-${r.time.toFixed(1)} שניות! 💪` : `${r.time.toFixed(1)} שניות — איטי מדי`, ok ? 'good' : 'bad');
        Game.addStat('energy', -12);
        this.trainingDone('run', ok, r.time < 50 ? 8 : 5);
      }
    }
  },

  // ---------- canisters ----------
  takeCanister() {
    G.player.carry = 'canister';
    Sound.click();
    UI.toast('לקחת מארז — כבד! תביא[/י] אותו למשגר הריק');
  },
  async reloadLauncher(L) {
    const exam = this.has('exam_reload') && G.state.dayFlags.examReload;
    if (exam) Game.setNpcSpot('sergeant', launcherSpot(World.launchers[1]));
    const r = await Mini.open('reload', { launcher: L.name, exam, time: 80 });
    if (!r.success) {
      if (exam) { this.examParts.reload = false; this.complete('exam_reload', 0, 'מבחן טעינה'); G.player.carry = false; L.needsReload = false; L.ammo = 20; }
      return;
    }
    G.player.carry = false;
    L.needsReload = false;
    L.ammo = 20;
    G.state.stats.reloads++;
    Game.achieve('reload');
    if (exam) { this.examParts.reload = true; this.complete('exam_reload', 10, 'מבחן טעינה'); return; }
    if (!World.launchers.some(l => l.needsReload)) this.complete('reload', 6 + Math.round(r.timeLeft / 10), 'החלפת מארז');
    else Game.addScore(4, 'החלפת מארז');
  },

  // ---------- inspection ----------
  setupInspection() {
    const room = myRoom();
    const beds = World.beds.filter(b => b.room === room).sort(() => Math.random() - 0.5).slice(0, 4);
    beds.forEach(b => b.messy = true);
    World.beds[G.state.myBed].messy = true;
    World.lockers.filter(l => l.room === room).slice(0, 2).forEach(l => l.open = true);
    this.dust = [];
    for (let i = 0; i < 5; i++) this.dust.push(dustSpot());
    const insp = Game.npc('inspector');
    if (insp) { insp.wanderSaved = insp.wander; insp.wander = null; }
    Game.setNpcSpot('inspector', roomSpot());
  },
  async inspect() {
    const S = G.state;
    const left = World.beds.filter(b => b.messy).length + World.lockers.filter(l => l.open).length + this.dust.length;
    const lateness = Math.max(0, S.clock - 12 * 60) / 30;
    const grade = Math.max(30, Math.round(100 - left * 10 - lateness * 5));
    await UI.cutscene([{ img: 'assets/inspection.jpg', who: '{@inspector}', text: `מסדר ניקיון! ...מעבירה אצבע על הלוקר... מרימה מזרן... מסתכלת על המנורה מלמטה... ציון: ${grade}` }]);
    await UI.talk([{ who: 'inspector', text: grade >= 90 ? 'מושלם. אני... אני כמעט מרוצה. אל [תתרגל/תתרגלי].' : grade >= 70 ? 'עובר. אבל ראיתי גרגר חול מתחת למיטה. והוא ראה אותי.' : 'זה לא מסדר, זה אתר ארכיאולוגי. מחר שוב. ובעוד שעה גם.' }]);
    if (grade >= 90) await UI.talk([{ who: 'sergeant', text: 'שמעתם? {@inspector} אמרה "כמעט מרוצה"! זה היסטורי 👑' }]);
    if (grade >= 90) Game.achieve('inspection');
    Game.addStat('morale', grade >= 70 ? 6 : -6);
    this.complete('inspection', Math.round(grade / 7), 'מסדר ניקיון');
    const insp = Game.npc('inspector');
    if (insp && insp.wanderSaved) insp.wander = insp.wanderSaved;
    Game.setNpcSpot('inspector', tc(33, 30));
  },

  // ---------- control room / guard ----------
  async radarShift() {
    if (this.has('exam_radar') && !this.has('exam_reload')) {
      const r = await Mini.open('radar', { duration: 45 });
      this.examParts.radar = r.success;
      this.complete('exam_radar', r.success ? 10 : 0, 'מבחן בקרה');
      if (r.accuracy >= 90) Game.achieve('radar');
      return;
    }
    if (this.has('radar')) {
      const r = await Mini.open('radar', { duration: 50 });
      if (r.accuracy >= 90) Game.achieve('radar');
      this.complete('radar', r.score, 'משמרת בקרה');
      Game.addStat('energy', -10);
      return;
    }
    this.training('radar');
  },
  async guardShift() {
    if (!this.has('guard')) { this.training('guard'); return; }
    const S = G.state;
    UI.fade(() => {
      S.clock = Math.max(S.clock, 22 * 60);
      // Alerts scheduled for hours that were skipped don't fire late.
      this.pendingAlerts = this.pendingAlerts.filter(t => t > S.clock);
    });
    await new Promise(r => setTimeout(r, 600));
    const r = await Mini.open('guard', { duration: 60 });
    if (!r.asleep && r.errors === 0) Game.achieve('awake');
    this.complete('guard', r.asleep ? -10 : r.score, r.asleep ? 'נרדמת בשמירה!' : 'שמירת לילה');
    if (r.asleep) Events.charge('post');
    S.clock = Math.max(S.clock, 24 * 60);
    Game.addStat('energy', -25);
    UI.toast('המשמרת נגמרה. ללכת לישון!');
  },

  // ---------- gate shifts ----------
  boothAction() {
    const gs = this.gateShift;
    if (!gs && this.has('gate')) { this.startGateShift(4, false); return; }
    if (gs && gs.car && gs.car.state === 'waiting') { this.checkCar(gs.car); return; }
    World.gateTarget = World.gateTarget ? 0 : 1;
    Sound.gate();
    if (gs && gs.car && gs.car.state === 'passed' && !World.gateTarget && !gs.car.closed) {
      gs.car.closed = true;
      Game.addScore(1, 'מחסום נסגר בזמן');
    }
  },
  startGateShift(total, drill) {
    const pool = DATA.visitors.slice().sort(() => Math.random() - 0.5);
    const list = pool.slice(0, 5);
    const outsiders = pool.slice(5);
    const arrivals = [];
    for (let i = 0; i < total; i++) {
      const r = Math.random();
      if (i === 0 || r < 0.45) arrivals.push({ ...list[i % list.length], ok: true });
      else if (r < 0.7) {
        const v = list[(i + 2) % list.length];
        const digits = v.car.split('');
        const di = digits.findIndex((c, j) => j > 2 && /\d/.test(c));
        digits[di] = String((+digits[di] + 3) % 10);
        arrivals.push({ ...v, car: digits.join(''), ok: false });
      } else arrivals.push({ ...outsiders[i % outsiders.length], ok: false });
    }
    const lines = ['שלום, יש לי אישור.', 'בוקר טוב! נכנס רק לשנייה.', 'אהלן, באתי לסוללה.', 'היי, מחכים לי בפנים.'];
    arrivals.forEach(a => a.line = lines[Math.floor(Math.random() * lines.length)]);
    this.gateShift = { list, arrivals, done: 0, total, mistakes: 0, car: null, cooldown: 1.5, drill };
    World.gateTarget = 0;
    UI.toast('משמרת ש"ג התחילה — רכבים בדרך');
  },
  spawnCar(visitor) {
    const colors = ['#c9c4b6', '#2b4c7e', '#7e2b2b', '#4b5a2a', '#e8e3d3', '#333'];
    return { visitor, x: 6 * TS, y: 43.5 * TS, angle: 0, color: colors[Math.floor(Math.random() * colors.length)], state: 'arriving', wait: 0, honk: 12 };
  },
  updateGate(dt) {
    const gs = this.gateShift;
    if (!gs.car) {
      gs.cooldown -= dt;
      if (gs.cooldown <= 0 && gs.done < gs.total) gs.car = this.spawnCar(gs.arrivals[gs.done]);
      else if (gs.done >= gs.total && !gs.car) this.endGateShift();
      return;
    }
    const car = gs.car;
    const gateX = 30.5 * TS;
    const speed = 230 * dt;
    if (car.state === 'arriving') {
      if (car.x < gateX) { car.x = Math.min(gateX, car.x + speed); car.angle = 0; }
      else if (car.y > 42.6 * TS) { car.y -= speed * 0.6; car.angle = -Math.PI / 2; }
      else { car.state = 'waiting'; Sound.gate(); }
    } else if (car.state === 'waiting') {
      car.wait += dt;
      car.honk -= dt;
      if (car.honk <= 0) { car.honk = 14; Sound.bad(); UI.toast('🚗 הנהג מצפצף בש"ג'); }
    } else if (car.state === 'entering') {
      if (World.gateOpen > 0.9) {
        car.y -= speed;
        if (car.y < 39.5 * TS && !car.passedAt) { car.passedAt = 1; car.state = 'passed'; car.closeTimer = 8; }
      }
    } else if (car.state === 'passed') {
      car.y -= speed;
      car.closeTimer -= dt;
      if (car.y < 24 * TS) car.hidden = true;
      if (!car.closed && car.closeTimer <= 0 && World.gateTarget) {
        Game.addScore(-4, 'השארת את המחסום פתוח!');
        gs.mistakes++;
        World.gateTarget = 0;
        car.closed = true;
      }
      if (car.closed && car.hidden) { gs.car = null; gs.cooldown = 3; }
    } else if (car.state === 'leaving') {
      if (car.y < 43.5 * TS) { car.y += speed * 0.6; car.angle = Math.PI / 2; }
      else { car.x += speed; car.angle = 0; if (car.x > World.W * TS + 80) { gs.car = null; gs.cooldown = 2; } }
    }
  },
  async checkCar(car) {
    const gs = this.gateShift;
    const r = await Mini.open('gate', { visitor: car.visitor, list: gs.list });
    gs.done++;
    G.state.stats.cars++;
    const v = car.visitor;
    if (r.approved) {
      World.gateTarget = 1;
      Sound.gate();
      car.state = 'entering';
      if (v.ok) Game.addScore(gs.drill ? 1 : 3, 'רכב מורשה נכנס');
      else { gs.mistakes++; Game.addScore(-8, 'הכנסת רכב לא מורשה!'); if (!gs.drill) Events.charge('gate'); }
    } else {
      car.state = 'leaving';
      if (v.ok) { gs.mistakes++; Game.addScore(-3, 'סירבת לרכב מורשה'); }
      else Game.addScore(gs.drill ? 2 : 5, 'עצרת רכב לא מורשה 👏');
    }
  },
  endGateShift() {
    const gs = this.gateShift;
    this.gateShift = null;
    if (!gs.mistakes) Game.achieve('gate');
    UI.toast(`המשמרת הסתיימה — ${gs.mistakes} טעויות`, gs.mistakes ? 'bad' : 'good');
    if (gs.drill) { this.trainingDone('gateDrill', gs.mistakes === 0, 4); return; }
    this.complete('gate', gs.mistakes ? 2 : 6, 'משמרת ש"ג');
  },

  // ---------- red alert ----------
  alert(drill, kind = 'real', sid = null) {
    const S = G.state;
    G.alert = { drill, kind, t: DATA.redAlertSeconds, phase: 'run', inside: 0, elapsed: 0, spawned: 0, spawnT: 0.6 };
    if (!drill) G.alert.sid = sid || Multi.newAlertId();
    if (!drill) S.stats.alerts++;
    Sound.startSiren();
    if (this.gateShift && this.gateShift.car && this.gateShift.car.state === 'waiting') this.gateShift.car.honk = 99;
    Game.npcsToShelters();
    if (G.player.carry) UI.toast('השארת הכל על הקרקע — רוץ!', 'bad');
    if (G.player.carry === 'food' && Events.baum && Events.baum.carrying) { Events.baum.carrying.carried = false; Events.baum.carrying = null; }
    if (G.player.carry === 'ext' && Events.chores) Events.chores.carrying = null;
    if (Events.rafael && ['crate', 'water'].includes(G.player.carry)) Events.rafael.left.unshift(G.player.carry);
    if (Events.chores) Events.chores.dragging = false;
    G.player.carry = false;
  },
  updateAlert(dt) {
    const A = G.alert;
    A.elapsed += dt;
    const P = G.player;
    if (A.phase === 'run') {
      A.t -= dt;
      UI.banner(`🚨 צבע אדום${A.drill ? ' — תרגיל' : ''} 🚨<small>למיגונית! ${Math.max(0, A.t).toFixed(1)}</small>`);
      if (World.inShelter(P.x, P.y)) {
        A.phase = 'inside';
        A.made = true;
        const took = DATA.redAlertSeconds - A.t;
        Sound.good();
        UI.toast(`במיגונית תוך ${took.toFixed(1)} שניות ✔`, 'good');
        Game.achieve('first_shelter');
        if (took < 10) Game.achieve('speedy');
      } else if (A.t <= 0) {
        A.phase = 'inside';
        A.made = false;
        Sound.bad();
        UI.toast('לא הגעת למיגונית בזמן!', 'bad');
      }
    } else if (A.phase === 'inside') {
      A.inside += dt;
      Sound.stopSiren();
      const wait = A.drill ? 4 : 12;
      UI.banner(`ממתינים במיגונית<small>${A.drill ? 'תרגיל — עוד רגע יוצאים' : 'עד הודעה על יציאה'} · ${Math.max(0, wait - A.inside).toFixed(0)}</small>`);
      if (A.inside >= wait) this.endAlert();
    }
    // Rockets and interceptors during real alerts.
    if (!A.drill && A.spawned < 7) {
      A.spawnT -= dt;
      if (A.spawnT <= 0) { A.spawnT = 0.9 + Math.random() * 1.4; A.spawned++; this.spawnThreat(); }
    }
  },
  async endAlert() {
    const A = G.alert;
    G.alert = null;
    UI.banner(null);
    Sound.stopSiren();
    Game.npcsReturn();
    const S = G.state;
    if (A.kind === 'drill') {
      if (A.made) this.complete('drill', 5, 'תרגיל צבע אדום');
      else { UI.toast('ננסה שוב — לדבר עם הסמלת', 'bad'); }
      if (A.made) await UI.talk([{ who: 'sergeant', text: 'מלך[/ה]! ככה בדיוק 👑 עכשיו ניקיון שטח: יש פסולת בכל הבסיס. 10 פריטים, לפני ש{@inspector} רואה.' }]);
      return;
    }
    if (A.kind === 'drill-train') { this.trainingDone('alertDrill', A.made, 4); return; }
    if (A.kind === 'night-drill') {
      Game.addScore(A.made ? 3 : -3, A.made ? 'הקפצת לילה — הגעת בזמן' : 'הקפצת לילה — איחרת');
      await UI.talk([{ who: 'sergeant', text: A.made ? 'מצוין. חזרה למיטות, ובשקט. מי שמדבר — שומר.' : 'בפעם הבאה בפיג׳מה, אבל בזמן. חזרה למיטות.' }]);
      Game.addStat('energy', -8);
      this.goToSleep();
      return;
    }
    if (A.kind === 'exam') {
      this.examParts.alert = A.made;
      this.complete('exam_alert', A.made ? 10 : 0, 'מבחן צבע אדום');
      return;
    }
    Game.addScore(A.made ? 6 : -10, A.made ? 'הגעת למיגונית בזמן' : 'לא הגעת למיגונית');
    Game.addStat('morale', A.made ? 2 : -10);
    // The busiest launcher needs a fresh canister.
    const L = (World.cache.netivot || World).launchers.slice().sort((a, b) => a.ammo - b.ammo)[0];
    L.needsReload = true;
    L.ammo = 0;
    await UI.talk([{ who: World.id === 'hq' ? 'interceptors' : 'commander', text: World.id === 'hq' ? `יצאו מיירטים. ${L.name} בנתיבות ריק. ספרתי. {name}, [סע/סעי] להחליף מארז.` : `כל הכבוד לכולם. היו יירוטים — ${L.name} ריק. {name}, להחליף מארז, עכשיו.` }]);
    this.addTask('reload');
  },

  spawnThreat() {
    // A rocket from the west; a loaded launcher fires an interceptor at it.
    const all = (World.cache.netivot || World).launchers;
    const launchers = all.filter(l => l.ammo > 0);
    const L = launchers[Math.floor(Math.random() * launchers.length)] || all[0];
    L.ammo = Math.max(0, L.ammo - 1 - Math.floor(Math.random() * 3));
    Scene3D.spawnThreat(L);
  },

  spawnTrash(n) {
    this.trash = [];
    let guard = 0;
    while (this.trash.length < n && guard++ < 2000) {
      const [fx0, fy0, fx1, fy1] = World.fence;
      const tx = fx0 + 2 + Math.floor(Math.random() * (fx1 - fx0 - 3)), ty = fy0 + 2 + Math.floor(Math.random() * (fy1 - fy0 - 3));
      const t = World.tile(tx, ty);
      if (![T.SAND, T.ROAD, T.PAD].includes(t)) continue;
      let nearWall = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ([T.WALL, T.FENCE].includes(World.tile(tx + dx, ty + dy))) nearWall = true;
      if (nearWall) continue;
      const x = (tx + 0.5) * TS, y = (ty + 0.5) * TS;
      if (World.blocked(x, y, 14)) continue;
      this.trash.push({ x, y, kind: Math.floor(Math.random() * 3) });
    }
  },

  // ---------- final exam ----------
  async graduation() {
    const S = G.state;
    const parts = Object.values(this.examParts).filter(Boolean).length;
    const pass = parts >= 3 && S.score >= DATA.passScore;
    if (pass) {
      this.complete('graduation');
      S.graduated = true;
      S.examRetry = false;
      Game.achieve('palgatz');
      await UI.talk([
        { who: 'bc', text: `{name}. קיבלתי את התוצאות. בדקתי פעמיים. באקסל. ${parts} מתוך 4 חלקים, ציון פלג"צ ${Math.round(S.score)}.` },
        { who: 'bc', text: 'סימנתי את השורה שלך בירוק. אני לא מסמנת בירוק סתם.' },
      ]);
      await UI.cutscene([
        { img: 'assets/graduation.jpg', who: '{@@bc}', text: 'עברת את פלג"צ! מהיום את[ה/] [לוחם/לוחמת] [מוסמך/מוסמכת] בסוללת {battery}, {gdud}.' },
        { img: 'assets/graduation.jpg', who: '', text: 'קיבלת דרגת רב"ט 🎖️ {@commander} מחייכת (פעם ראשונה שמישהו רואה את זה), {@sergeant} בוכה, ו{@inspector} כבר מחפשת אבק על הדרגה החדשה.' },
      ]);
      await UI.talk([
        { who: 'harasar', text: 'מזל טוב. עכשיו [תיישר/תיישרי] את הכומתה, רב"ט.' },
        { who: 'hamalist', text: 'מזל טוב!!!!!! 🎉🎉🎉 אני כל כך שמחה שאני הולכת לשתות עוד קפה!!!' },
        { who: 'deputy_bc', text: 'דבאי, מספיק חגיגות. יש סוללה להפעיל.' },
      ]);
      S.mode = 'story';
      Game.save();
      UI.toast('🏅 סיימת פלג"צ! המשחק ממשיך — ימים בסוללה', 'ach');
      this.tasks.push({ id: 'sleep', ...TASKS.sleep, done: false });
    } else {
      this.complete('graduation');
      S.examRetry = true;
      await UI.talk([
        { who: 'bc', text: `עברת ${parts} מתוך 4 חלקים וציון הפלג"צ שלך ${Math.round(S.score)} (צריך ${DATA.passScore}). סימנתי בכתום. כתום זה לא אדום, אבל זה גם לא ירוק.` },
        { who: 'bc', text: 'מחר — מבחן חוזר בנתיבות. [תתאמן/תתאמני] במטווח, בבקרה ובטעינה. לוח זמנים מצורף.' },
      ]);
      this.examParts = {};
      this.tasks.push({ id: 'sleep', ...TASKS.sleep, done: false });
    }
  },

  // ---------- the last day: a lock for the gate ----------
  async lockHint(n) {
    const hints = {
      commander: 'רק ל{@rasap} יש מנעולים. [סע/סעי] לשו"ב. ואל [תחזור/תחזרי] בלי.',
      p_nevo: 'יש לי מנעול! ...לא, זו גרב. היא פשוט עומדת ככה לבד.',
      p_hila: 'אני אהיה המנעול! אני אעמוד בשער כל סוף השבוע ואצעק "סגור"!',
      p_ofek: 'אני אשמור על השער כל הלילה. אני הכי מבצעי בפלגה. רק תביא[/י] שש פחיות Blue.',
      p_liran: '{first} ישים אבן גדולה בשער. אבן זה מנעול. אוגה בוגה.',
      p_rotem: 'ספיידרמן היה סוגר את השער בקורים. אין לי קורים. יש לי גומייה.',
      p_shaked: 'בזמן שאת[ה/] [מחפש/מחפשת] מנעול, אני אעשה עוד סט. [תזכור/תזכרי]: רק ל{@rasap} יש מנעולים.',
      p_arad: '💨 ...סליחה. מנעול? בחולדה לא נועלים. כל הקיבוץ יודע מי לקח מה.',
      friend: 'בקוד כתבתי שהמנעול אצל {@rasap} בשו"ב. ...אל תשאל[/י] מה כתבתי אחרי זה.',
    };
    if (!hints[n.id]) return false;
    await UI.talk([{ who: n.id, text: hints[n.id] }]);
    return true;
  },
  async openSnack() {
    await UI.talk([{ who: 'deputy_rasap', text: '*בהילוך איטי, מאחוריך* ...מישהו נגע לי בארונית?' }]);
    const f = $('#fade');
    f.classList.add('on');
    Sound.boom();
    await new Promise(r => setTimeout(r, 1400));
    f.classList.remove('on');
    await UI.cutscene([
      { img: 'assets/boss1.jpg', who: '{@@deputy_rasap}', text: 'זה המנעול האחרון בסוללה. והוא שלי. כמו הבמבה. כמו הביסלי. כמו כל מה שבארונית הזאת.' },
      { img: 'assets/boss2.jpg', voice: 'assets/audio/boss/intro.mp3', who: '{@@deputy_rasap}', text: 'אתם רוצים יציאה הביתה?! אתם תסגרו 35, ואני אנפיץ אתכם!!! *שומשום... גבינה... רוטב אלף האיים...*' },
      { img: 'assets/boss3.jpg', who: '', text: '{@deputy_rasap} הפך לצ\'יזבורגרו — מפלצת צ\'יזבורגר ענקית! רק דבר אחד מפחיד אותו: אוכל בריא. [אסוף/אספי] ברוקולי, גזר, תפוחים, מלפפונים, פריכיות וחטיפי חלבון — ו[זרוק/זרקי] עליו (E)!' },
    ]);
    this.complete('snack', 0);
    Boss.introAt = Date.now();
    Boss.start();
  },
  async lockGate() {
    const r = await Mini.open('qte', { title: 'נעילת השער', sub: 'שרשרת, מנעול, קליק. [הקש/הקישי] את הרצף!', length: 5, time: 9, silent: true });
    if (!r.success) { UI.toast('המנעול נפל לחול. עוד פעם', 'bad'); return; }
    World.gateTarget = 0;
    Sound.gate();
    this.complete('lock_gate', 10, 'השער נעול');
    await this.goHome();
  },
  async goHome() {
    const S = G.state;
    S.wentHome = true;
    S.shchora = 0;
    Game.achieve('home');
    Sound.fanfare();
    await UI.cutscene([
      { img: 'assets/home.jpg', who: '', text: 'קליק. השער של נתיבות נעול עם המנעול האחרון בסוללה. {@@commander} מהנהנת. זה הכי קרוב לחיבוק שיש אצלה.' },
      { img: 'assets/home.jpg', who: '{@@commander}', text: '{platoon} — יציאה הביתה! ההסעה בתחנה. [תתקלח/תתקלחי] בבית. {@p_nevo}, זה במיוחד אליך.' },
      { img: 'assets/home.jpg', who: '', text: 'שחורה: 0. {@p_ofek} פותח פחית שישית לכבוד. {@p_liran} לוקח את האבן הביתה. ו{@deputy_rasap}? אוכל סלט. בהילוך איטי.' },
      { img: 'assets/title.jpg', who: 'נתיבוט', text: 'תודה ששיחקת! בנה: {@@friend}. כל הדמויות והאירועים בדיוניים. המשחק ממשיך — שבוע חדש בסוללה מתחיל ביום ראשון.' },
    ]);
    S.homeDay = S.day + 7;
    Game.save();
    this.endDay();
  },

  // Called once when a day's tasks are created, to prepare scene state.
  prepare() {
    if (this.has('inspection_prep')) this.setupInspection();
    if (this.has('y_room')) Events.setupYasmin();
    if (this.has('reload_train') || this.has('exam_reload')) Game.setNpcSpot('sergeant', this.has('exam_reload') ? launcherSpot(World.launchers[1]) : SPOTS.sergeantDepot);
    if (this.has('clean')) this.spawnTrash(10);
  },
};
