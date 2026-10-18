// Role mode: instead of a new soldier, play as someone who is already in the platoon or on
// the staff, and do their job — the commander's night alerts and orders from the battery
// commander, the inspector's room checks, each soldier's own נע"ת duty.
// Each role task is a TASKS entry (so the HUD, the arrow and the day plan work as usual)
// plus a `run` that says what happens at the spot.

const ROLE_QUIZ = {
  interceptors: [
    { q: 'כמה זמן יש לך להגיע למיגונית בנתיבות?', a: ['15 שניות', '45 שניות', 'דקה וחצי', 'עד שנגמר הסרט'], ok: 0 },
    { q: 'מתי מיירטים איום?', a: ['תמיד', 'רק כשהוא ייפול בשטח מיושב', 'רק בלילה', 'כש{@p_liran} אומר "בום"'], ok: 1 },
    { q: 'מה עושים כשיש תקלה במשגר?', a: ['מכים עליו', 'מדווחים לחמ"ל ולטכנאי', 'מצלמים לסטורי', 'מחכים שיעבור'], ok: 1 },
    { q: 'מי מחליט על היירוט?', a: ['הבקר בעמדת הבקרה', 'הנהג', 'הש"ג', 'הרס"ר'], ok: 0 },
    { q: 'מה יש במארז?', a: ['פיתות', 'מיירטים', 'גרעינים', 'ספרים של {@p_liran}'], ok: 1 },
  ],
  education: [
    { q: 'מה ערך "רעות" בצה"ל?', a: ['לעזור לחבר גם כשקשה', 'לישון הרבה', 'לאכול ראשון', 'לא לדבר'], ok: 0 },
    { q: 'מי מגן על השמיים מעל נתיבות?', a: ['כיפת ברזל', 'הש.ק.', 'מטוסי נייר', 'אף אחד'], ok: 0 },
    { q: 'מה עושים עם חייל שמתקשה?', a: ['צוחקים עליו', 'מדברים איתו ומדווחים למפקד', 'מתעלמים', 'שולחים אותו לש"ג'], ok: 1 },
    { q: 'מה המשמעות של "דבקות במשימה"?', a: ['להמשיך עד שהמשימה נגמרת', 'להדביק פתקים', 'לישון בעמדה', 'לוותר'], ok: 0 },
    { q: 'מה עושים בצבע אדום?', a: ['רצים למיגונית', 'מצלמים את השמיים', 'ממשיכים לאכול', 'מתקשרים לאמא'], ok: 0 },
  ],
};

// A choice talk: each step asks once; a wrong pick costs points but the task still ends.
const roleChoose = (steps) => async () => {
  let good = 0;
  for (const st of steps) {
    const v = await UI.talk([{ who: st.who || 'player', text: st.text, choices: st.options.map((o, i) => ({ label: o.label, value: i })) }]);
    const o = st.options[v] || st.options[0];
    if (o.ok) good++;
    (o.ok ? Sound.good : Sound.bad)();
    if (o.reply) await UI.talk([{ who: o.who || st.replyWho || st.who || 'player', text: o.reply }]);
  }
  return good === steps.length;
};
const roleQte = (title, sub) => async () => (await Mini.open('qte', { title, sub, length: 6, time: 9, silent: true })).success;
const roleMini = (name, opts = {}) => async () => !!(await Mini.open(name, opts)).success;
const roleQuiz = (set) => async () => (await Mini.open('quiz', { questions: ROLE_QUIZ[set].map(q => ({ ...q, q: fmt(q.q), a: q.a.map(fmt) })), count: 5 })).success;

const ROLE_TASKS = {
  // ----- friend: נע"ת שמירות -----
  r_roster: {
    title: 'לבנות את לוח השמירות להלילה', desc: 'בלוח האימונים. כל שעה צריכה שומר — וכל שומר צריך לישון.', target: () => SPOTS.board, pts: 6,
    run: roleChoose([
      { text: 'מי שומר ב־02:00–04:00?', options: [
        { label: '{@p_ofek} — הוא ער בכל מקרה מהקריאטין', ok: true, reply: 'גאוני. הוא ממילא קם שלוש פעמים בלילה.' },
        { label: '{@p_nevo} — הוא ישן בכל מקום, גם בעמדה', reply: '...זאת בדיוק הבעיה.' },
      ] },
      { text: 'ומי פותח את הבוקר ב־06:00?', options: [
        { label: '{@p_shaked} — היא קמה לריצה ממילא', ok: true, reply: 'היא אפילו שמחה. מוזרה.' },
        { label: 'אני. מישהו צריך להקריב', reply: 'נע"ת שמירות ששומר על עצמו. זה עצוב, אבל מבצעי.' },
      ] },
    ]),
  },
  r_nightcheck: {
    title: 'לבדוק את השומר בעמדה (אחרי 22:00)', desc: 'נע"ת שמירות עובר בלילה לוודא שכולם ערים.', target: () => SPOTS.tower, pts: 4, after: 22 * 60,
    run: roleChoose([{ who: 'p_nevo', text: '*קופץ* אני ער! אני ער! ...מה השעה? איפה אני?', options: [
      { label: 'להעיר אותו בעדינות ולהביא לו קפה', ok: true, reply: 'תודה... אני לא אגיד לאף אחד שנרדמתי. גם את[ה/] לא, נכון?', who: 'p_nevo' },
      { label: 'לדווח עליו ל{@commander}', reply: '...בגדת בי. בגלל זה קוראים לך נע"ת.', who: 'p_nevo' },
    ] }]),
  },
  // ----- p_shalev: רובאות -----
  r_range_lead: { title: 'להעביר מטווח לפלגה', desc: 'במטווח. להראות להם איך עושים את זה. כמו בגולני (בלי השטח).', target: () => SPOTS.range, pts: 6, run: roleMini('range') },
  r_weapons: { title: 'בדיקת נשקים לפני שבת', desc: 'ליד מחסן המארזים.', target: () => SPOTS.depot, pts: 4, run: roleQte('בדיקת נשקים', 'נצרה, מחסנית, קנה נקי. מהר, לפני ש{@harasar} מגיע.') },
  // ----- p_nevo: גיבוש -----
  r_bonding: {
    title: 'לארגן ערב גיבוש לפלגה', desc: 'בחדר האוכל.', target: () => SPOTS.dining, pts: 6,
    run: roleChoose([{ text: 'מה עושים בערב גיבוש?', options: [
      { label: '🍕 פיצות וקריוקי', ok: true, reply: 'כולם שרים "מאמי מאמי". אפילו {@commander} מזמזמת בשקט.' },
      { label: '🧹 מסדר ניקיון "מגבש"', reply: '{@inspector} מאושרת. כל השאר — פחות.' },
      { label: '🎤 הרצאה על לוגיסטיקה מ{@p_arad}', reply: 'אחרי עשר דקות נשארו רק {@p_arad} והכיסאות.' },
    ] }]),
  },
  r_money: { title: 'לאסוף כסף לפיצה מכל הפלגה', desc: 'ברחבה. אף אחד לא עונה בקבוצה.', target: () => SPOTS.parade, pts: 3, run: roleQte('גביית כסף לפיצה', 'כל אחד אומר "אני אעביר בביט אחר כך". [תגבה/תגבי] מהר!') },
  // ----- p_ofek: בטיחות, תחקירים וציוד לחימה -----
  r_debrief: {
    title: 'לכתוב תחקיר בטיחות', desc: 'בחמ"ל. מה קרה, למה קרה, ואיך זה לא יקרה שוב.', target: () => SPOTS.hamal, pts: 6,
    run: roleChoose([
      { text: 'אירוע: מישהו נסע במשאית בלי חגורה. מה הלקח?', options: [
        { label: 'חוגרים תמיד — גם למאתיים מטר', ok: true, reply: 'נכתב. נחתם. נשלח ל{@bc}.' },
        { label: 'לנסוע יותר לאט', reply: '{@bc} החזירה את התחקיר עם עיגול אדום.' },
      ] },
      { text: 'אירוע: שומר עזב את העמדה לשירותים. מה הלקח?', options: [
        { label: 'לא עוזבים עמדה בלי מחליף', ok: true, reply: '...אני כותב תחקיר על עצמי. זה מרגיש מוזר. אבל נכון.' },
        { label: 'להפסיק לשתות מים', reply: 'עם הקריאטין? זה כבר תחקיר רפואי.' },
      ] },
    ]),
  },
  r_gear: { title: 'בדיקת ציוד לחימה', desc: 'קסדות, אפודים, אלונקה. במחסן.', target: () => SPOTS.store, pts: 4, run: roleQte('ספירת ציוד לחימה', 'קסדה, אפוד, אלונקה, פנס. [ספור/ספרי] לפני שמישהו "שואל" משהו.') },
  // ----- p_shaked: כושר -----
  r_fitness: { title: 'להעביר אימון כושר לפלגה', desc: 'במסלול הכושר. ברוקולי אחרי.', target: () => SPOTS.track, pts: 6, run: roleQte('אימון כושר לפלגה', 'שכיבות סמיכה, בטן, ספרינט. [תספור/תספרי] חזרות לפני שהם בורחים.') },
  r_veggies: {
    title: 'לחלק ירקות בחדר האוכל', desc: 'מישהו צריך להציל את הפלגה מצ\'יזבורגרו.', target: () => SPOTS.dining, pts: 4,
    run: roleChoose([{ who: 'p_nevo', text: 'מה זה הירוק הזה? זה... בריא?', options: [
      { label: 'ברוקולי. [תאכל/תאכלי]. עכשיו.', ok: true, reply: '*אוכל* ...זה לא רע. אל תגיד[/י] לאף אחד.', who: 'p_nevo' },
      { label: 'עזוב, [קח/קחי] במבה', reply: 'צ\'יזבורגרו מחייך איפשהו.' },
    ] }]),
  },
  // ----- p_rotem: רפואה -----
  r_medkit: { title: 'לבדוק את תיק החובש', desc: 'במחסן. תחבושות, חוסם עורקים, ופלסטרים של ספיידרמן.', target: () => SPOTS.store, pts: 4, run: roleQte('בדיקת תיק חובש', 'תחבושת, חוסם עורקים, מספריים, פלסטר של ספיידרמן 🕷️') },
  r_hydrate: {
    title: 'לוודא שכולם שותים מים', desc: 'ברחבה. במיוחד {@p_ofek}. במיוחד לא {@p_ofek}.', target: () => SPOTS.parade, pts: 4,
    run: roleChoose([{ who: 'p_ofek', text: 'שתיתי כבר חמישה ליטר. קריאטין. אני צריך עוד?', options: [
      { label: 'מספיק! והשירותים בצד השני', ok: true, reply: 'צודקת. אני... אני חייב ללכת. עכשיו.', who: 'p_ofek' },
      { label: 'עוד שניים, ליתר ביטחון', reply: '*רץ לשירותים באמצע המשפט*', who: 'p_ofek' },
    ] }]),
  },
  // ----- p_miriam: עוזרת מפ"ל -----
  r_mafal: { title: 'לעדכן את טבלת הנוכחות של המפ"ל', desc: 'בלוח האימונים.', target: () => SPOTS.board, pts: 4, run: roleQte('טבלת נוכחות', 'מי בבית, מי ביציאה, מי "בדרך" כבר שלוש שעות.') },
  r_forms: {
    title: 'להחתים את {@commander} על טפסים', desc: 'ברחבה.', target: () => npcPosR('commander'), pts: 4,
    run: roleChoose([{ who: 'commander', text: 'עוד טפסים? מה זה הפעם?', options: [
      { label: 'בקשת יציאה של {@p_nevo}, ותחקיר של {@p_ofek}', ok: true, reply: '*חותמת* תודה. בלעדייך הפלגה הייתה מתפרקת.', who: 'commander' },
      { label: 'לא יודעת, [תחתמי/תחתמי] וזהו', reply: '...חתמתי בטעות על ויתור על היציאה שלי. אבל בסדר.', who: 'commander' },
    ] }]),
  },
  // ----- p_hila: חינוך -----
  r_class: { title: 'להעביר שיעור חינוך', desc: 'בחדר האוכל. כולם מקשיבים (בערך).', target: () => SPOTS.dining, pts: 6, run: roleQuiz('education') },
  // ----- p_arad: לוגיסטיקה -----
  r_stock: { title: 'ספירת מלאי במחסן', desc: 'כמה מים, כמה מנות קרב, כמה שקיות במבה "נעלמו".', target: () => SPOTS.store, pts: 4, run: roleQte('ספירת מלאי', 'שישיות מים, מנות קרב, נייר טואלט. [ספור/ספרי] הכל!') },
  r_supply: {
    title: 'להזמין ציוד מ{@rasap}', desc: 'ברספ"ייה בשו"ב.', map: 'hq', target: () => SPOTS_HQ.rasap, pts: 5,
    run: roleChoose([{ who: 'rasap', text: 'מה צריך? ותזכור — כל דבר צריך חתימה.', options: [
      { label: 'מים, נייר טואלט ומטף — חתמתי על הכל מראש', ok: true, reply: 'מישהו שחותם מראש. אני כמעט בוכה.', who: 'rasap' },
      { label: 'קרטון במבה. לוגיסטיקה של מורל', reply: 'במבה זה לא ציוד. ...תשאיר את הקרטון פה.', who: 'rasap' },
    ] }]),
  },
  // ----- p_liran: חומר לימודי של מיירטים -----
  r_study: { title: 'להעביר שיעור על מיירטים', desc: 'בלוח האימונים. אוגה בוגה, אבל מקצועי.', target: () => SPOTS.board, pts: 6, run: roleQuiz('interceptors') },
  // ----- p_aharon: צרפתי -----
  r_french: {
    title: 'לתרגם ל{@shekemist} את המחירון', desc: 'בש"ק בשו"ב. הוא מסרב לכתוב בעברית.', map: 'hq', target: () => SPOTS_HQ.kantina, pts: 4,
    run: roleChoose([{ who: 'shekemist', text: 'Comment on dit "בורקס" en hébreu? ...רגע, זה כבר עברית?', options: [
      { label: '"בורקס" זה "בורקס". והגרעינים — 3 שקל', ok: true, reply: 'Magnifique! סוף סוף מחירון שאני מבין.', who: 'shekemist' },
      { label: 'Croissant du chef — 40 שקל', reply: 'אף אחד לא קנה כלום. אבל זה נשמע יוקרתי.', who: 'shekemist' },
    ] }]),
  },
  // ----- inspector: מש"קית -----
  r_rooms: {
    title: 'מסדר ניקיון — לבדוק את המגורים', desc: 'בחדר הבנים. הם יודעים שאת באה.', target: () => roomSpot('boys'), pts: 6,
    run: roleChoose([
      { text: 'מיטה לא מסודרת, ובתוכה ישן {@p_nevo}. מה עושים?', options: [
        { label: 'להעיר אותו ולתת לו חמש דקות', ok: true, reply: 'בארבע דקות הוא סידר. בדקה החמישית נרדם שוב — אבל על מיטה מסודרת.' },
        { label: 'סגירת שבת על המקום', reply: 'הוא בכה. גם את קצת.' },
      ] },
      { text: 'בלוקר של {@p_arad} יש 14 שקיות במבה. מה עושים?', options: [
        { label: 'להחרים 13 ולהשאיר אחת לגיבוש', ok: true, reply: 'צודקת וגם אהובה. נדיר.' },
        { label: 'לא ראיתי כלום', reply: 'מחר יהיו 28.' },
      ] },
    ]),
  },
  r_tash: {
    title: 'שיחת ת"ש עם {@p_nevo}', desc: 'ברחבה. כולם קוראים לו "הומלס" — אולי יש סיבה.', target: () => npcPosR('p_nevo') || SPOTS.parade, pts: 5,
    run: roleChoose([{ who: 'p_nevo', text: 'אני בסדר... פשוט אין לי איפה לכבס בבית, אז אני לא מתקלח. שיטה פרקטית.', options: [
      { label: 'נסדר לך מכונת כביסה מהת"ש. ומקלחת — היום', ok: true, reply: '...באמת? תודה. אני אתקלח. אולי.', who: 'p_nevo' },
      { label: 'זה לא מעניין אותי, [תתקלח/תתקלח]', reply: 'אוקיי... *הולך להתקלח עצוב*', who: 'p_nevo' },
    ] }]),
  },
  r_fridge_check: { title: 'לבדוק תוקפים במקרר', desc: 'במטבחון.', target: () => SPOTS.fridge, pts: 4, run: async () => !!(await Mini.open('fridge', { day: G.state.day, count: 6 })).success },
  // ----- sergeant: מש"קית -----
  r_reload_brief: { title: 'להעביר תדריך טעינה לפלג"צניקים', desc: 'ליד מחסן המארזים.', target: () => SPOTS.depot, pts: 6, run: roleMini('reload', { launcher: 'משגר אימון' }) },
  // ----- commander: קצינת הפלגה -----
  r_lineup_cmd: {
    title: 'לנהל את מסדר הבוקר', desc: 'ברחבת המסדרים.', target: () => SPOTS.parade, pts: 5,
    run: roleChoose([{ text: 'הפלגה בשלשות. מה ההודעה של הבוקר?', options: [
      { label: 'היום ביקורת, יש פריסה, ומי שמחביא אוכל — שיחביא טוב', ok: true, reply: '*כל הפלגה מהנהנת. {@p_arad} מזיז בשקט שקית מאחורי הגב.*' },
      { label: 'אין הודעות. לכו', reply: '*מסדר של שלושים שניות. {@bc} תשמע על זה.*' },
    ] }]),
  },
  r_hamal: { title: 'משמרת בחמ"ל', desc: 'עמדת הבקרה בנתיבות.', target: () => SPOTS.hamal, pts: 0, run: roleMini('radar', { duration: 40 }) },
  r_orders: {
    title: 'פקודה מ{@bc}: מצב מבצעי', desc: 'בחמ"ל. הטלפון כבר מצלצל.', target: () => SPOTS.hamal, pts: 6,
    run: async () => {
      const ok = await roleChoose([{ who: 'bc', text: '{@commander}, מודיעין: ירי צפוי לכיוון הדרום הלילה. מה את עושה?', options: [
        { label: '🚛 לשלוח צוות לפרוס אתר נוסף, עכשיו', ok: true, reply: 'בדיוק. המשאיות כבר בדרך לאתר הפריסה.', who: 'bc' },
        { label: '📋 לכתוב על זה מצגת', reply: 'מצגת לא מיירטת. אבל תשלחי אותה גם. ותפרסי אתר.', who: 'bc' },
        { label: '😴 לחכות לבוקר', reply: 'בבוקר נדבר. בלשכה שלי.', who: 'bc' },
      ] }])();
      Story.addTask('deploy');
      UI.toast('🚛 משימה חדשה: פריסת אתר — לנסוע לאתר הפריסה', 'good');
      return ok;
    },
  },
  r_night: {
    title: 'הקפצה לילית לפלגה (אחרי 22:00)', desc: 'ברחבה. בתור המפקדת — את מחליטה מתי. ואף אחד לא יאמין.', target: () => SPOTS.parade, pts: 6, after: 22 * 60,
    run: async () => {
      await UI.cutscene([{ img: 'assets/redalert.jpg', who: '{@@commander}', text: '23:47. את לוחצת על הכפתור. בכל המגורים נדלקים האורות. "הקפצה! צבע אדום — תרגיל!"' }]);
      Story.alert(true, 'night-drill');
      return true;
    },
  },
  r_talk: {
    title: 'שיחת מפקדת עם {@p_liran}', desc: 'הוא רוצה קורס מיירטים. מאוד.', target: () => npcPosR('p_liran') || SPOTS.board, pts: 4,
    run: roleChoose([{ who: 'p_liran', text: 'המפקדת. {first} רוצה קורס מיירטים. {first} למד הכל. גם בשמירה.', options: [
      { label: 'אני אמליץ עליך. בלי ספרים בשמירה', ok: true, reply: 'אוגה! {first} מבטיח. ...רק מגזינים.', who: 'p_liran' },
      { label: 'קודם תסיים פלג"צ', reply: '{first} עצוב. {first} יקרא ספר על עצב.', who: 'p_liran' },
    ] }]),
  },
  // ----- Ops (HQ): קצינת מבצעים -----
  r_hamal_hq: { title: 'משמרת בחמ"ל הסוללתי', desc: 'בשו"ב.', map: 'hq', target: () => SPOTS_HQ.hamal, pts: 0, run: roleMini('radar', { duration: 45 }) },
  r_dispatch: {
    title: 'לשלוח משימת אמל"ח לפי המצב', desc: 'בחמ"ל בשו"ב. {@bc} על הקו.', map: 'hq', target: () => SPOTS_HQ.hamal, pts: 6,
    run: roleChoose([
      { who: 'bc', text: 'משגר 2 בנתיבות לא מגיב. מה שולחים?', options: [
        { label: '🔧 טכנאי שו"ב שיגור, עכשיו', ok: true, reply: 'יוצא. ותעדכני את {@commander}.', who: 'bc' },
        { label: '🚚 את רפאל קייטרינג', reply: 'הם הגיעו עם שניצלים. המשגר עדיין לא מגיב.', who: 'bc' },
      ] },
      { who: 'bc', text: 'צריך מארזים לאתר החדש. מי מוביל?', options: [
        { label: '🚛 משאית מנוף עם נהג וליווי', ok: true, reply: 'נכון. וחגורות — שלא יהיה לי עוד משפט.', who: 'bc' },
        { label: '🏃 שני פלג"צניקים עם עגלה', reply: '...את רצינית? אני רושמת את זה.', who: 'bc' },
      ] },
    ]),
  },
};
const npcPosR = (id) => { const n = Game.npc(id); return n ? { x: n.x, y: n.y } : null; };

// Who you can be, and the job that comes with it.
const ROLES = {
  commander: { tasks: ['r_lineup_cmd', 'r_orders', 'r_hamal', 'r_talk', 'r_night'], every: ['r_night'], lineup: false },
  inspector: { tasks: ['r_rooms', 'r_tash', 'r_fridge_check'], every: ['r_rooms'] },
  sergeant: { tasks: ['r_reload_brief', 'gate', 'r_fridge_check'], every: ['r_reload_brief'] },
  friend: { tasks: ['r_roster', 'r_nightcheck', 'gate', 'guard'], every: ['r_roster'] },
  p_shalev: { tasks: ['r_range_lead', 'r_weapons', 'guard'], every: ['r_range_lead'] },
  p_nevo: { tasks: ['r_bonding', 'r_money', 'guard'], every: ['r_bonding'] },
  p_ofek: { tasks: ['r_debrief', 'r_gear', 'guard'], every: ['r_debrief'] },
  p_shaked: { tasks: ['r_fitness', 'r_veggies', 'gate'], every: ['r_fitness'] },
  p_rotem: { tasks: ['r_medkit', 'r_hydrate', 'gate'], every: ['r_medkit'] },
  p_miriam: { tasks: ['r_mafal', 'r_forms', 'radar'], every: ['r_mafal'] },
  p_hila: { tasks: ['r_class', 'gate', 'radar'], every: ['r_class'] },
  p_arad: { tasks: ['r_stock', 'r_supply', 'guard'], every: ['r_stock'] },
  p_liran: { tasks: ['r_study', 'guard', 'radar'], every: ['r_study'] },
  p_aharon: { tasks: ['r_french', 'gate', 'guard'], every: ['r_french'] },
  ops: { tasks: ['r_hamal_hq', 'r_dispatch'], every: ['r_dispatch'], lineup: false },
};

const Roles = {
  init() {
    for (const id in ROLE_TASKS) TASKS[id] = ROLE_TASKS[id];
  },
  available() { return Object.keys(ROLES).map(id => Cast.get(id)).filter(Boolean); },
  current() { const S = G.state; return S && S.role && ROLES[S.role] ? S.role : null; },

  // The day's list: the role's own duty every day, two more from its pool, then bed.
  planFor(day) {
    const id = this.current(), r = ROLES[id], person = Cast.get(id);
    const rest = r.tasks.filter(t => !r.every.includes(t)).sort(() => Math.random() - 0.5).slice(0, 2);
    const alerts = [];
    if (Math.random() < 0.6) alerts.push(9 * 60 + Math.floor(Math.random() * 9 * 60));
    // Night-only duties go last, so the arrow starts with what can be done now.
    const own = [...r.every, ...rest].sort((a, b) => (TASKS[a].after ? 1 : 0) - (TASKS[b].after ? 1 : 0));
    return {
      title: `יום ${day} בתור ${person.short}`,
      tasks: [...(r.lineup === false ? [] : ['lineup']), ...own, 'sleep'],
      alerts,
    };
  },

  // A spot on the map for each open role task.
  interactables(add) {
    if (!this.current()) return;
    for (const t of Story.tasks) {
      const def = ROLE_TASKS[t.id];
      if (!def || t.done) continue;
      const map = typeof def.map === 'function' ? def.map() : def.map || 'netivot';
      if (map !== World.id) continue;
      const at = def.target();
      if (at) add(at.x, at.y, '⭐ ' + fmt(def.title), () => this.run(t.id), 46);
    }
  },
  async run(id) {
    const def = ROLE_TASKS[id];
    const S = G.state;
    if (def.after && (S.clock % 1440) < def.after && (S.clock % 1440) > 5 * 60) { UI.toast(`רק אחרי ${clockText(def.after)}`, 'bad'); return; }
    const ok = await def.run();
    if (!Story.has(id)) return;
    Story.complete(id, ok ? def.pts : Math.floor(def.pts / 3), fmt(def.title));
    Game.addStat('morale', ok ? 4 : -2);
  },

  // The title-screen menu: pick who to be.
  menu() {
    const people = this.available();
    UI.screen(`<div class="content"><div class="panel">
      <h2>🎭 מצב תפקיד</h2><p>לא דמות חדשה — [אתה/את] אחד מהם. לראות את הסוללה מהעיניים שלהם ולעשות את התפקיד שלהם.</p>
      <div class="grid">${people.map(p => {
        const saved = Game.load('role.' + p.id);
        return `<div class="card" data-id="${p.id}">${faceUrl(p.id) ? `<img class="card-face" src="${faceUrl(p.id)}" alt="">` : `<div class="big">${p.emoji}</div>`}<div class="nm">${p.name}</div><div class="ds">${fmtAs(p, p.title || '')}${saved ? ` · יום ${saved.state.day}` : ''}</div></div>`;
      }).join('')}</div>
      <div class="actions"><button class="btn ghost" id="r-back">חזרה</button></div></div></div>`, 'assets/title.jpg');
    $('#r-back').onclick = () => Game.title();
    $('#screen').querySelectorAll('.card').forEach(c => c.onclick = () => {
      Sound.click();
      const person = Cast.get(c.dataset.id);
      const saved = Game.load('role.' + person.id);
      G.profile = saved ? saved.profile : { name: person.short, gender: person.female ? 'f' : 'm', skin: person.skin || DATA.skinTones[1], hair: person.hair || DATA.hairColors[0], gdud: '947', battery: 'ido', as: person.id };
      G.state = saved ? saved.state : Game.newState('role.' + person.id);
      G.state.role = person.id;
      Game.startWorld(!saved).then(async () => {
        if (person.map === 'hq' && World.id !== 'hq') Game.switchMap('hq');
        if (!saved) await UI.talk([{ who: person.id, text: fmtAs(person, `היום אני {full}. ${fmtAs(person, person.title || '')}. בואו נראה איך זה מבפנים.`) }]);
      });
    });
  },
};
Roles.init();
