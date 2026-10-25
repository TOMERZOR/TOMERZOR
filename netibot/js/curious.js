// "סקרנים": curious civilians who turn up at the gate once or twice a day. They photograph the
// launchers, try to get in, make friends with whoever is on the gate and ask questions they
// shouldn't. Someone has to walk over and send them away, politely: it's a military site.
// Made-up characters (public models and portraits, like the shekemist).
const CURIOUS = [
  {
    id: 'cur_shmulik', kind: 'photo', name: 'שמוליק "הצלם" זילברמן', short: 'שמוליק', first: 'שמוליק', emoji: '📸', color: '#8a7a4a', head: 'none',
    title: 'סקרן · צלם חובב. "של ציפורים"', scale: 1,
    arrive: '📸 מישהו עם מצלמה ענקית עומד ליד השער ומצלם את המשגרים!',
    barks: ['📸 קליק!', '📸 קליק-קליק!', 'איזה זום... רואים עד הבורג!', '📸 עוד אחת של השקיעה...', 'אני רק מצלם ציפורים!', '📸 תזיז[/י] קצת שמאלה...', 'זה זום של 600 מ"מ, אל תדאג[/י]', 'הפלאש? זה בטעות!', '📸 עוד אחת ואני הולך. באמת.'],
  },
  {
    id: 'cur_ortal', kind: 'enter', name: 'אורטל "אורטלוש" בן־שושן', short: 'אורטל', first: 'אורטל', emoji: '🤳', color: '#e0457b', head: 'none', female: true,
    title: 'סקרנית · "אינפלואנסרית", 1,200 עוקבים', scale: 0.97,
    arrive: '🤳 מישהי עם טלפון מצלמת סטורי ליד השער ומנסה להיכנס!',
    barks: ['היי חיילים!! 💕', '🤳 רגע, רגע, סטורי!', 'אפשר רק להיכנס לשנייה?', 'תעשו לי שלום למצלמה!', 'זה טיקטוק, זה לא נחשב!', '💕 אתם כאלה חמודים במדים!', 'רק לייק אחד ואני הולכת!', '🤳 תגיד[/י] "היי" לעוקבים!', 'זה לייב, תתנהגו יפה!'],
  },
  {
    id: 'cur_victor', kind: 'questions', name: 'ויקטור "התייר" קוזלוב', short: 'ויקטור', first: 'ויקטור', emoji: '🕶️', color: '#d1572b', head: 'none',
    title: 'סקרן · "תייר". שואל המון שאלות', scale: 1.04,
    arrive: '🕶️ "תייר" עם פנקס עומד ליד השער ושואל שאלות!',
    barks: ['Shalom! סתם שאלה...', 'כמה טילים בכל משגר? סתם!', 'באיזה שעה מחליפים משמרת?', '*רושם משהו בפנקס*', 'איפה המכ"ם? בשביל התמונה!', 'כמה חיילים ישנים פה? סתם, לסטטיסטיקה!', '*מסתכל על המשגר ומהנהן*', 'אני תייר! מאוד תייר!', 'מה הקוד לשער? בשביל הגלויה!'],
  },
];

const Curious = {
  npc: null,
  spot() { return { x: 34.5 * TS, y: 42.15 * TS }; },
  target() { return this.npc ? { x: this.npc.x, y: this.npc.y - 0.9 * TS } : SPOTS.gate; },
  // The cast list and the dialog box know them like anyone else.
  register() {
    for (const c of CURIOUS) {
      Cast.byId[c.id] = c;
      DATA.faces[c.id] = `assets/faces/${c.id}.webp`;
    }
  },

  // 1-2 a day, at random times in daylight, at Netivot.
  plan(S) {
    // Three a day, spread over the daylight hours, in every mode.
    S.dayFlags.curiousPlan = [0, 1, 2].map(k => 8 * 60 + 30 + k * 220 + Math.floor(Math.random() * 150));
  },
  update(dt) {
    const S = G.state;
    if (!S) return;
    if (this.npc && G.alert && !this.npc.leaving) { this.leave(this.npc, true); this.clearTask(); }
    if (this.npc) { this.updateNpc(dt); return; }
    if (!Settings.v.curious || World.id !== 'netivot') return;
    if (!S.dayFlags.curiousPlan) this.plan(S);
    const next = S.dayFlags.curiousPlan[0];
    if (next === undefined || S.clock < next) return;
    // Online the leader's phone sends them, to everyone (js/worldsync.js).
    if (!WorldSync.lead()) { S.dayFlags.curiousPlan.shift(); return; }
    if (G.alert || Mini.active || UI.busy || Boss.active || Story.ctl || Story.run || S.clock > 21 * 60 || !Game.calm()) return;
    S.dayFlags.curiousPlan.shift();
    this.arrive();
  },
  // id: who (online, the leader's).
  arrive(kind, id = null) {
    const S = G.state;
    this.register();
    // Not the same person twice in a row.
    const pool = CURIOUS.filter(c => (kind ? c.kind === kind : c.id !== S.flags.lastCurious));
    const c = CURIOUS.find(x => x.id === id) || pick(pool.length ? pool : CURIOUS);
    WorldSync.started('cur', c.id);
    S.flags.lastCurious = c.id;
    const start = { x: 22 * TS, y: 43.4 * TS };
    Assets.loadPublicPerson(c.id);
    const n = Game.addVisitor(c.id, start);
    if (!n) return;
    n.curious = c;
    n.spot = this.spot();
    const path = World.path(n.x, n.y, n.spot.x, n.spot.y);
    n.path = path && path.length ? path : [{ x: 30.5 * TS, y: 43.4 * TS }, n.spot];
    n.barkCd = 6;
    n.wait = 0;
    this.npc = n;
    Story.addTask('curious');
    UI.toast(c.arrive, 'bad');
    Sound.ding();
    Settings.buzz([120, 80, 120]);
  },
  updateNpc(dt) {
    const n = this.npc;
    if (!G.npcs.includes(n)) { this.npc = null; this.clearTask(); return; }
    if (n.leaving) {
      if (!n.path.length) { Game.removeVisitor(n.id); this.npc = null; }
      return;
    }
    if (!UI.busy && !G.paused) n.wait += dt;
    // Left alone for two minutes: they got what they came for.
    if (n.wait > 120 && !UI.busy) {
      this.leave(n);
      Story.complete('curious', -5, `${n.short} הסתובב[/ה] ליד השער בלי שאף אחד טיפל`);
      UI.toast(`😬 ${n.short} ${n.curious.kind === 'questions' ? 'מילא פנקס שלם' : 'צילם את כל האתר'} והלך. מישהו היה צריך לטפל בזה!`, 'bad');
      return;
    }
    // Photographers flash now and then.
    if (n.curious.kind !== 'questions' && !n.path.length && Math.random() < dt * 0.5 && typeof Scene3D !== 'undefined' && Scene3D.cameraFlash) Scene3D.cameraFlash(n.x, n.y);
  },
  leave(n, run) {
    n.leaving = true;
    n.running = !!run;
    n.bubble = null;
    const path = World.path(n.x, n.y, 4 * TS, 43.4 * TS);
    n.path = path && path.length ? path : [{ x: n.x, y: 43.4 * TS }, { x: 4 * TS, y: 43.4 * TS }];
  },
  clearTask() { const t = Story.tasks.find(x => x.id === 'curious' && !x.done); if (t) t.done = true; },
  // A friend's resumed game, a new day, another site: nobody left standing at the gate.
  reset() {
    if (this.npc) Game.removeVisitor(this.npc.id);
    this.npc = null;
  },

  // ---------- the conversation ----------
  async talk(n) {
    const c = n.curious;
    if (n.leaving) return;
    n.wait = 0;
    const me = 'player';
    let outcome;
    if (c.kind === 'photo') outcome = await this.talkPhoto(n, me);
    else if (c.kind === 'enter') outcome = await this.talkEnter(n, me);
    else outcome = await this.talkQuestions(n, me);
    this.finish(n, outcome);
  },
  // Lines that every curious one gets: the polite "military site" speech, the police warning.
  POLITE: 'סליחה, זה אתר צבאי סגור. אי אפשר להיות פה, ואסור לצלם. אני מבקש[/ת] שתתרחק[/י] מהגדר ותמשיך[/י] בדרך שלך.',
  POLICE: 'צילום של אתר צבאי זו עבירה. אם לא תמחק[/י] [ותלך/ותלכי] — אני מזמין[/ה] משטרה. זה נחשב פגיעה בביטחון המדינה, ועונש של עד 3 שנות מאסר.',
  async talkPhoto(n, me) {
    const id = n.id;
    let v = await UI.talk([
      { who: id, text: 'שלום חייל[/ת]! אל תדאג[/י], אני רק מצלם ציפורים. הנה, תראה[/י] איזה זום... רואים את המשגר עד הבורג האחרון!' },
      { who: id, text: 'אפשר עוד כמה תמונות מהצד השני של הגדר? שם יש אור יותר טוב על... הציפורים.', choices: [
        { label: '🙏 "זה אתר צבאי, אסור לצלם. בבקשה למחוק ולהתרחק."', value: 'polite' },
        { label: '👮 "תמחק עכשיו, או שאני מזמין[/ה] משטרה."', value: 'police' },
        { label: '😎 "וואו, איזו מצלמה! תצלם גם אותי ליד המשגר?"', value: 'bad' },
      ] },
    ]);
    if (v === 'bad') {
      await UI.talk([{ who: id, text: 'בשמחה!! תעמוד[/י] ליד המשגר... עוד קצת שמאלה... מושלם! עכשיו את המכ"ם מאחורייך. ותודה רבה, חמוד[/ה]!' }]);
      return 'leak';
    }
    if (v === 'polite') {
      v = await UI.talk([
        { who: me, text: this.POLITE },
        { who: id, text: 'אבל אני אזרח! זה מדינה חופשית! ...ואם אני רק מצלם את השקיעה, וזה במקרה מאחורי המשגר?', choices: [
          { label: '🙏 "גם לא. בבקשה למחוק את מה שצילמת ולהמשיך הלאה."', value: 'ok' },
          { label: '👮 "אם אתה ממשיך לצלם, אני מזמין[/ה] משטרה."', value: 'police' },
        ] },
      ]);
      if (v === 'ok') {
        await UI.talk([{ who: id, text: 'טוב, טוב. מוחק. רואה? מוחק... רק את השקיעה השארתי. בסדר, גם אותה. יום טוב, חייל[/ת].' }]);
        return 'polite';
      }
    }
    return this.policeTalk(n, me);
  },
  async talkEnter(n, me) {
    const id = n.id;
    let v = await UI.talk([
      { who: id, text: 'הייייי!! אני אורטל, יש לי 1,200 עוקבים 💅 אפשר להיכנס לצלם טיקטוק קטן עם הטילים? רק 15 שניות! אני אתייג אותך!' },
      { who: id, text: 'נו, תפתח[/י] לי את השער לשנייה. אף אחד לא יידע. חוץ מהעוקבים.', choices: [
        { label: '🙏 "זה אתר צבאי סגור. אי אפשר להיכנס ואסור לצלם."', value: 'polite' },
        { label: '👮 "אם צילמת את האתר — אני מזמין[/ה] משטרה."', value: 'police' },
        { label: '🚧 "טוב... רק מהר, ואל תגידי לאף אחד."', value: 'open' },
      ] },
    ]);
    if (v === 'open') {
      await UI.talk([
        { who: id, text: 'יאאא! סטורי מתוך כיפת ברזל! "תראו איפה אני" 📍 עם מיקום והכל! ...אופס, זה עלה לייב.' },
        { who: me, text: '...' },
      ]);
      return 'entered';
    }
    if (v === 'polite') {
      v = await UI.talk([
        { who: me, text: this.POLITE },
        { who: id, text: 'אוף, איזה רציני[/ת] 🙄 אז לפחות תביא[/י] לי את האינסטגרם שלך? אני אעשה לך תיוג, נהיה חברים!', choices: [
          { label: '🙏 "לא, תודה. ובבקשה להתרחק מהשער."', value: 'ok' },
          { label: '📱 "טוב... תרשמי."', value: 'friend' },
        ] },
      ]);
      if (v === 'ok') {
        await UI.talk([{ who: id, text: 'וואו. טוב. גם ככה התאורה פה גרועה. ביי! 💅' }]);
        return 'polite';
      }
      if (v === 'friend') {
        await UI.talk([{ who: id, text: 'יש! עוקב[/ת] חדש[/ה]! 🥰 אז... באיזה שעות את[ה/] בש"ג? סתם, כדי לבוא לבקר.' }]);
        return 'friend';
      }
    }
    return this.policeTalk(n, me);
  },
  async talkQuestions(n, me) {
    const id = n.id;
    let v = await UI.talk([
      { who: id, text: 'Shalom, my friend! אני תייר, אוהב מאוד ישראל. סתם שאלה, בשביל הסקרנות: כמה טילים יש בכל משגר?' },
      { who: id, text: 'ואיפה בדיוק המכ"ם? ובאיזה שעה מחליפים משמרת? אני רושם רק בשביל... הזיכרונות. *פותח פנקס*', choices: [
        { label: '🙏 "את זה אני לא יכול[/ה] להגיד. זה אתר צבאי, בבקשה להתרחק."', value: 'polite' },
        { label: '👮 "אתה רושם את זה? אני מזמין[/ה] משטרה ומדווח[/ת] לקצין."', value: 'police' },
        { label: '🤓 "עשרים בכל משגר, והמכ"ם מאחורה. מחליפים בשמונה."', value: 'leak' },
      ] },
    ]);
    if (v === 'leak') {
      await UI.talk([{ who: id, text: 'עשרים... מאחורה... שמונה. *רושם מהר* Spasibo! אה, כלומר, תודה! אני... צריך ללכת. לתיירות. ביי!' }]);
      return 'leak';
    }
    if (v === 'polite') {
      v = await UI.talk([
        { who: me, text: 'זה אתר צבאי סגור. אי אפשר להיות פה, ואני לא עונה על שאלות על האתר. בבקשה להתרחק מהגדר.' },
        { who: id, text: 'Of course, of course! רק... מה השם שלך, חבר? ומספר טלפון? אני אשלח לך גלויה מהבית.', choices: [
          { label: '🙏 "לא נותן[/ת] פרטים. להתרחק מהגדר, בבקשה."', value: 'ok' },
          { label: '📱 "קוראים לי {name}, תרשום..."', value: 'friend' },
        ] },
      ]);
      if (v === 'ok') {
        await UI.talk([{ who: id, text: 'Very good soldier. מאוד... מקצועי. *סוגר את הפנקס* אני הולך. לתיירות.' }]);
        return 'polite';
      }
      if (v === 'friend') {
        await UI.talk([{ who: id, text: '{name}... *רושם* ...אני אזכור אותך, חבר. מאוד אזכור.' }]);
        return 'friend';
      }
    }
    return this.policeTalk(n, me);
  },
  async policeTalk(n, me) {
    const id = n.id;
    const v = await UI.talk([
      { who: me, text: this.POLICE },
      { who: id, text: n.curious.kind === 'questions' ? 'משטרה?! לא, לא, אני רק תייר! ...אתה בטוח שצריך משטרה?' : 'שלוש שנים?! על תמונה?! רגע, רגע, אני מוחק!', choices: [
        { label: '📞 להזמין משטרה (100)', value: 'call' },
        { label: '✋ "מספיק שתמחק ותלך. עכשיו."', value: 'go' },
      ] },
    ]);
    if (v === 'go') {
      await UI.talk([{ who: id, text: n.curious.kind === 'enter' ? 'מחקתי! מחקתי! הנה, תראה[/י], גם מהגלריה! ביי!' : 'מחקתי! הנה! הולך, הולך!' }]);
      return 'warned';
    }
    UI.toast('📞 חייגת 100 ודיווחת לקצין התורן', 'good');
    await UI.talk([
      { who: 'narrator', text: '🚓 כעבור כמה דקות ניידת משטרה עוצרת ליד השער.' },
      { who: 'police', text: `ערב טוב. קיבלנו דיווח על ${n.curious.kind === 'questions' ? 'אדם ששואל שאלות על האתר' : 'אדם שמצלם את האתר'}. אדוני${n.curious.female ? ', כלומר גברתי' : ''}, תעביר[/י] לי בבקשה תעודת זהות ואת הטלפון${n.curious.kind === 'photo' ? ' והמצלמה' : ''}.` },
      { who: id, text: n.curious.kind === 'questions' ? 'אני... אני תייר! יש לי ויזה! ...איפשהו.' : 'זה בשביל העוקבים!! ...טוב, זה בשביל הציפורים.' },
      { who: 'police', text: 'נמשיך את השיחה בתחנה. כל הכבוד על הדיווח, חייל[/ת]. בדיוק ככה.' },
    ]);
    return 'police';
  },
  finish(n, outcome) {
    const S = G.state;
    S.stats.curious = (S.stats.curious || 0) + 1;
    const good = { polite: [6, 'הרחקת סקרן[/ית] בנימוס 👏'], warned: [5, 'הרחקת סקרן[/ית] מהשער'], police: [8, 'דיווחת למשטרה על צילום האתר 🚓'] };
    const bad = { leak: [-10, 'מסרת מידע על האתר!'], entered: [-15, 'הכנסת אזרחית לאתר!'], friend: [-5, 'התחברת עם סקרן[/ית] בשער'] };
    const r = good[outcome] || bad[outcome];
    Story.complete('curious', r[0], r[1]);
    if (good[outcome]) {
      S.stats.curiousOk = (S.stats.curiousOk || 0) + 1;
      if (S.stats.curiousOk >= 3) Game.achieve('curious');
      if (outcome === 'police') Game.achieve('police');
    } else if (outcome !== 'friend') Events.charge('curious');
    if (outcome === 'police') {
      // Taken away in the patrol car.
      UI.fade(() => { Game.removeVisitor(n.id); this.npc = null; });
      return;
    }
    if (outcome === 'entered') {
      // She runs in, films the launchers for a few seconds, and is escorted out.
      World.gateTarget = 1;
      Sound.gate();
      setTimeout(() => { if (this.npc === n) { n.path = [{ x: 30.5 * TS, y: 41.5 * TS }, { x: 30.5 * TS, y: 37 * TS }]; n.running = true; n.bubble = { text: '🤳 "תראו איפה אני!!"', t: 5 }; } }, 1200);
      setTimeout(() => { if (this.npc === n) { n.path = [{ x: 30.5 * TS, y: 41.5 * TS }, { x: 30.5 * TS, y: 43.4 * TS }, { x: 4 * TS, y: 43.4 * TS }]; n.leaving = true; } }, 7000);
      setTimeout(() => { World.gateTarget = 0; Sound.gate(); }, 10500);
      return;
    }
    this.leave(n, outcome === 'warned');
    n.bubble = { text: outcome === 'friend' ? '😘 נדבר!' : outcome === 'leak' ? '📝 *רושם מהר*' : '🙄 טוב, טוב...', t: 3 };
  },
};
