// The story of Nehorai, in twelve missions and three acts, plus the things you can do
// around town between them. Everything here is fiction; the patterns it is built on are not:
// the public-housing eligibility trap, "5%" grey-market loans that are 5% a week, ATMs pulled
// out with loaders, wedding-hall safes, orchard theft, and towers that replace the blocks.
import { POI } from '../world/map.js';
import { fmtMoney, dist2 } from '../core/util.js';
import * as THREE from 'three';

export const SPEAKERS = {
  N: { name: 'נהוראי', face: 'hero', color: '#f5b301', pitch: 260 },
  M: { name: 'אמא', face: 'mom', color: '#f0a8b8', pitch: 420 },
  S: { name: 'שימי', face: 'shimi', color: '#ff7a5c', pitch: 300 },
  J: { name: 'ז׳וז׳ו', face: 'boss', color: '#d2ab45', pitch: 200 },
  G: { name: 'מוטי הגובה', face: 'goon', color: '#e5412d', pitch: 150 },
  R: { name: 'ליאם', face: 'rival', color: '#a56bf0', pitch: 330 },
  C: { name: 'פקד דהן', face: 'cop', color: '#5b9bff', pitch: 240 },
  SV: { name: 'סבתא מזל', face: 'savta', color: '#e0b0ea', pitch: 480 },
  H: { name: 'חכם', face: 'dod', color: '#6fd08c', pitch: 190 },
  SH: { name: 'שירן', face: 'girl', color: '#35c0c0', pitch: 440 },
  E: { name: 'אליהו', face: 'dod', color: '#f5d060', pitch: 210 },
  Z: { name: 'ציון הסוחר', face: 'boss', color: '#c9ced2', pitch: 180 },
  X: { name: 'שומר', face: 'cop', color: '#9aa3ad', pitch: 230 },
  K: { name: 'קבלן', face: 'boss', color: '#9fb7b0', pitch: 170 },
  T: { name: 'לקוח', face: 'dod', color: '#c9ced2', pitch: 220 },
  D: { name: 'דוד שלמה', face: 'dod', color: '#c9ced2', pitch: 180 },
  B: { name: 'הבנים', face: 'shimi', color: '#ff7a5c', pitch: 280 },
};

const V = (x, z) => ({ x, z });
// wait until the player is driving a given vehicle
async function board(c, v, text) {
  const m = c.mark(() => v.pos, v.def.name);
  try { await c.until(() => c.player.vehicle === v, text, { target: v.pos }); } finally { c.unmark(m); }
}
const alive = (v) => () => (v.wreck ? 'הרכב נהרס' : false);

export const STORY = [
  // ───────────────────────── ACT 1 ─────────────────────────
  {
    id: 'shichrur', act: 'מערכה ראשונה · חוזרים לבלוק', title: 'שחרור', blurb: 'שלוש שנים. אותה תחנה, אותו חום, אותו שימי.',
    at: 'busArrive', where: 'התחנה המרכזית', passLine: 'ברוך הבא הביתה.', reward: 0,
    async run(c) {
      c.hour(16.6); c.density(0.8);
      const shimi = c.ped('dalet', 'busArrive', { dx: 2.2, dz: 1.5, tint: 0xffffff, heading: -1.6 });
      const moped = c.car('moped', 'busArrive', 0.4, { dx: 5.5, dz: 3, free: true, tint: 0xffffff });
      await c.wait(0.6);
      await c.talk([
        ['S', 'נהוראי! אחי! שלוש שנים בלי לראות את הפרצוף המכוער שלך!'],
        ['N', 'שימי. תראה אותך. גדלת. לרוחב.'],
        ['S', 'זה שרירים. שרירים במנוחה. יאללה, אמא שלך מחכה. כל הבלוק יודע שהשתחררת.'],
        ['N', 'איך כל הבלוק יודע? ירדתי מהאוטובוס לפני דקה.'],
        ['S', 'סבתא מזל ראתה אותך מהספסל. זה כמו להעלות לסטורי, רק יותר מהר ועם פרשנות.'],
        ['S', 'קח את הקטנוע של בן דוד שלי. רק אל תשרוט, הוא עוד משלם עליו. מ־2019.'],
      ], { actors: { S: shimi } });
      c.note(c.game.input.touch ? 'ג׳ויסטיק שמאלי לתנועה. גרור בצד ימין כדי לסובב את המצלמה.' : 'WASD לתנועה, עכבר למצלמה, Shift לריצה. F כדי לעלות על רכב.', '');
      await board(c, moped, 'עלה על <em>הקטנוע</em>');
      c.note(c.game.input.touch ? 'גז וברקס בצד ימין. ״ידני״ לבלם יד.' : 'W גז · S בלם ורוורס · רווח בלם יד · Q רדיו', '');
      c.follow(shimi);
      await c.goto('home', 'סע <em>הביתה</em>, לבלוק 412', { r: 9, label: 'הבית' });
      const mom = c.ped('mom', 'mom', { tint: 0xffffff, heading: Math.PI });
      await c.goto('mom', 'גש אל <em>אמא</em>', { r: 2.6, onFoot: true, label: 'אמא' });
      await c.talk([
        ['M', 'נהוראי שלי! תן לראות אותך. רזית. לא נותנים לכם לאכול שם?'],
        ['N', 'אמא, מה זה המכתב הזה ביד שלך?'],
        ['M', 'זה כלום. זה מ״קורת גג״, החברה של הדיור. שטויות.'],
        ['N', '״הודעת פינוי. תשעים יום.״ אמא. זה לא שטויות.'],
        ['M', 'התחלתי לעבוד בניקיון בעירייה. שכר מינימום. אז עכשיו אני ״מרוויחה יותר מדי״ ואין לי זכאות. שלושים שנה אני בדירה הזאת.'],
        ['N', 'אז תפסיקי לעבוד.'],
        ['M', 'ואז ממה נשלם לז׳וז׳ו?'],
        ['N', '...מי זה ז׳וז׳ו?'],
        ['M', 'כשאבא שלך היה חולה לקחתי הלוואה. עשרים אלף. ״בלי ערבים, רק חמישה אחוז״. לא אמרו שזה חמישה אחוז לשבוע.'],
        ['N', 'כמה אנחנו חייבים?'],
        ['M', 'אל תשאל. לך תאכל משהו. הנה חמישים שקל. תקנה פלאפל אצל אליהו, תגיד שאתה הבן של ז׳קלין, הוא ישים לך חריף בצד.'],
      ], { actors: { M: mom } });
      c.money(50);
      await c.goto('falafel', 'לך ל<em>פלאפל אליהו</em> במרכז המסחרי', { r: 3.2, onFoot: true, label: 'פלאפל אליהו' });
      c.note('ליד דוכני אוכל לחץ ' + (c.game.input.touch ? '״אישור״' : 'E') + ' כדי לאכול ולהחזיר בריאות.', '');
      c.sms('שימי', 'אחי בוא מחר לפיצוצייה. יש לי עבודה בשבילך. חוקית!! (בערך)');
    },
  },
  {
    id: 'shlichim', after: ['shichrur'], act: 'מערכה ראשונה', title: 'שליח עד הבית', blurb: 'אפליקציית המשלוחים ״בא לי״. הלקוח תמיד צודק. הלקוח אף פעם לא נותן טיפ.',
    at: 'kiosk', giver: 'שימי', where: 'פיצוציית הנסיך', reward: 350, passLine: 'אחרי עמלה, דלק וביטוח: שלוש מאות וחמישים.',
    async run(c) {
      c.hour(12.2);
      const shimi = c.ped('dalet', 'kiosk', { tint: 0xffffff, dx: 1.2 });
      const moped = c.car('moped', 'kiosk', 1.2, { dx: -3, dz: 2.5, free: true, tint: 0xff8a70 });
      await c.talk([
        ['S', 'תקשיב, בן דוד שלי פתח סניף של ״בא לי״. משלוחים. אתה לוקח קטנוע, לוקח שקית, מביא ללקוח. כסף קל.'],
        ['N', 'כמה כסף?'],
        ['S', 'שלושה משלוחים, שלוש מאות חמישים. לפני עמלה. ולפני קנסות. ואם הלקוח מדרג אותך כוכב אחד זה יורד מהשכר.'],
        ['N', 'ואם הוא מדרג חמישה?'],
        ['S', 'אף אחד לא מדרג חמישה, נהוראי. זה לא סרט.'],
      ], { actors: { S: shimi } });
      await board(c, moped, 'קח את <em>קטנוע המשלוחים</em>');
      c.failIf(alive(moped));
      c.timer(100, 'האוכל התקרר. הלקוח ביטל.');
      await c.goto('towers', 'משלוח 1: סושי ל<em>נווה יוקרה</em>', { r: 8, vehicle: moped, label: 'משלוח' });
      c.timer(0);
      await c.say('X', 'שליחים מהכניסה האחורית.');
      await c.say('N', 'איפה הכניסה האחורית?');
      await c.say('X', 'אין. תשאיר אצלי. אני אעביר. בערך.');
      c.sms('בא לי', 'הלקוח דירג אותך ★☆☆☆☆: ״השליח נשם ליד האוכל״');
      c.timer(110, 'האוכל התקרר. הלקוח ביטל.');
      await c.goto('bituach', 'משלוח 2: שווארמה ל<em>ביטוח הלאומי</em>', { r: 8, vehicle: moped, label: 'משלוח' });
      c.timer(0);
      await c.say('T', 'סוף סוף! אני בתור משש בבוקר. הזמנתי כבר ארוחת בוקר לפה, עכשיו צהריים.', 4);
      await c.say('N', 'ואיזה מספר אתה?');
      await c.say('T', 'שמונה מאות ארבעים ושבע. עכשיו משרתים את שתים עשרה.', 3.4);
      c.timer(120, 'האוכל התקרר. הלקוח ביטל.');
      await c.goto('court3', 'משלוח 3: פיצה משפחתית ל<em>מגרש בשכונה ג׳</em>', { r: 9, vehicle: moped, label: 'משלוח' });
      c.timer(0);
      const a = c.ped('gimel', 'court3', { dx: 3, dz: 2, hp: 60 }), b = c.ped('gimel', 'court3', { dx: -3, dz: 3, hp: 60 });
      await c.talk([
        ['R', 'תראו תראו. שליח מד׳. אתה יודע שעל משלוח לג׳ יש מכס?'],
        ['N', 'מה המכס?'],
        ['R', 'הקטנוע.'],
        ['N', 'הקטנוע לא שלי. הוא של בן דוד של שימי. הוא עוד משלם עליו.'],
        ['R', 'אז שימשיך לשלם. חבר׳ה, תסבירו לו.'],
      ], { actors: { R: a } });
      if (c.player.vehicle) c.player.leaveVehicle(true);
      c.note(c.game.input.touch ? '״אגרוף״ שלוש פעמים לקומבו. ״בעיטה״ מפילה.' : 'J או קליק שמאלי: אגרוף (שלוש פעמים = קומבו). K או קליק ימני: בעיטה.', '');
      c.game.world.mobT = 60;            // a private lesson, not a whole-block brawl
      await c.fight([a, b], 'תן להם שיעור');
      await c.say('N', 'תגידו לליאם שהפיצה עליי.');
      await board(c, moped, 'חזור ל<em>קטנוע</em>');
      await c.goto('kiosk', 'החזר את הקטנוע ל<em>פיצוצייה</em>', { r: 8, vehicle: moped });
    },
  },
  {
    id: 'chov', after: ['shlichim'], act: 'מערכה ראשונה', title: 'ריבית דריבית', blurb: 'חמישה אחוז. לשבוע. משנת 2021.',
    at: 'home', giver: 'אמא', where: 'הבית, בלוק 412', reward: 0, passLine: 'מאה ושמונים אלף שקל. עד סוף החודש.',
    async run(c) {
      c.hour(18.4);
      const mom = c.ped('mom', 'mom', { tint: 0xffffff, heading: Math.PI });
      const moti = c.ped('goon', 'mom', { dx: 2.4, dz: 2.2, tint: 0xffffff, hp: 170 }), g2 = c.ped('goon', 'mom', { dx: -1.5, dz: 3.2, hp: 130 });
      await c.talk([
        ['G', 'גברת ז׳קלין. שבוע שלישי שאין תשלום. ז׳וז׳ו מתחיל לקחת את זה אישי.'],
        ['M', 'אמרתי לכם, בראשון אני מקבלת משכורת.'],
        ['G', 'בראשון זה כבר אלפיים ארבע מאות ועוד ריבית על האיחור. אולי ניקח בינתיים את הטלוויזיה. או את המקרר. משהו סמלי.'],
        ['N', 'אולי תיקח את הידיים שלך מהדלת של אמא שלי.'],
        ['G', 'אה, החייל חזר. חמוד. חבל על הפרצוף, רק השתחררת.'],
      ], { actors: { G: moti, M: mom } });
      const shimi = c.ped('dalet', 'yard', { tint: 0xffffff }); shimi.ai.script = null; c.follow(shimi);
      c.game.world.mobT = 90;
      await c.fight([moti, g2], 'הורד את <em>הגובים</em>');
      await c.say('S', 'אחי, פירקת את מוטי הגובה! אף אחד לא פירק את מוטי הגובה!', 3);
      c.wanted(2);
      c.note('המשטרה בדרך. שבור קו ראייה: בין הבלוקים, מתחת לעמודים, רחוק מהכביש.', 'cop');
      await c.loseCops('<em>היעלם</em> מהמשטרה');
      c.sms('מספר חסוי', 'שמעתי שנגעת בעובדים שלי. בוא לצ׳יינג׳. עכשיו. — ז׳');
      const jojo = c.ped('suit', 'change', { tint: 0xffffff, hp: 300 });
      await c.goto('change', 'לך ל<em>צ׳יינג׳ הזהב</em>', { r: 2.8, onFoot: true, label: 'ז׳וז׳ו' });
      await c.talk([
        ['J', 'נהוראי. הבן של ז׳קלין. שב. לא, אל תשב, אין כיסא.'],
        ['N', 'אמא שלי לקחה עשרים אלף. היא שילמה כבר ארבעים.'],
        ['J', 'נכון. ונשארו מאה ושמונים. זה נקרא ריבית דריבית, מותק. לומדים את זה בכיתה י׳. אה, סליחה, אתם לא סיימתם י׳.'],
        ['N', 'זה לא חוקי.'],
        ['J', 'בטח שחוקי. יש לי רישיון, יש לי רואה חשבון, יש לי חבר בעירייה. מה יש לך? אמא עם הודעת פינוי.'],
        ['J', 'עכשיו גם שברת למוטי שן. שן זה עשרת אלפים. אני עגלתי.'],
        ['N', 'אני אביא לך את הכסף.'],
        ['J', 'מאה ושמונים. עד סוף החודש. או שתבוא לעבוד אצלי, ילד חזק כמוך תמיד צריך. תחשוב על זה.'],
      ], { actors: { J: jojo } });
    },
  },
  {
    id: 'subaru', after: ['chov'], act: 'מערכה ראשונה', title: 'חלפים משומשים', blurb: 'חכם לא גונב רכבים. חכם ממחזר.',
    at: 'garage', giver: 'חכם', where: 'מוסך חכם ובניו, אזור התעשייה', reward: 1500, passLine: 'רכב אחד נכנס. מאה חלקים יוצאים.',
    async run(c) {
      c.hour(20.6);
      const h = c.ped('worker', 'garage', { tint: 0xd0d0d0 });
      await c.talk([
        ['H', 'אתה הבן של ז׳קלין. שימי אמר שאתה צריך כסף ושאתה יודע לנהוג.'],
        ['N', 'אני יודע לנהוג.'],
        ['H', 'יש בנווה יוקרה סדאן שחורה. הבעלים שלה קבלן, יש לו עוד שלוש. הוא לא ירגיש. אני צריך אותה שלמה.'],
        ['N', 'אתה רוצה שאני אגנוב רכב.'],
        ['H', 'חס וחלילה. אני רוצה שתמחזר רכב. אני מפרק, מוכר חלפים, אנשים מתקנים בזול. זה ירוק. זה קיימות.'],
        ['H', 'רק בלי שריטות. כל שריטה יורדת לך מהכסף.'],
      ], { actors: { H: h } });
      const car = c.car('sedan', 'towers', 0, { dx: 62, dz: 38, tint: 0x16181d });
      c.failIf(alive(car));
      await c.goto('towers', 'לך ל<em>נווה יוקרה</em>', { r: 14, label: 'נווה יוקרה' });
      await board(c, car, 'קח את <em>הסדאן השחורה</em> מהחניון');
      c.wanted(2); c.note('אזעקה. מישהו התקשר למוקד.', 'cop');
      await c.goto('garageIn', 'הבא את הרכב ל<em>מוסך</em>', { r: 6, vehicle: car, slow: true, meter: () => car.hp / car.maxHp, label: 'המוסך' });
      await c.loseCops('לא עם המשטרה על הזנב. <em>תאבד אותם</em>');
      if (c.player.vehicle) c.player.leaveVehicle(true);
      car.locked = true;
      const cut = Math.round((1 - car.hp / car.maxHp) * 900);
      await c.say('H', cut > 150 ? `יפה. חוץ מהפח. מוריד לך ${fmtMoney(cut)} על השריטות.` : 'נקייה. כמו מהניילון. אתה מוכשר, ילד.', 3.4);
      if (cut > 150) c.money(-Math.min(cut, 900));
      c.flags.garage = true;
      c.sms('חכם', 'מהיום כל רכב ״ממוחזר״ שתביא למוסך, אני קונה. בלי שאלות.');
    },
  },
  // ───────────────────────── ACT 2 ─────────────────────────
  {
    id: 'protection', after: ['subaru'], act: 'מערכה שנייה · קומבינות', title: 'דמי חסות', blurb: 'חמשת אלפים בחודש כדי שלא יקרה כלום. אחרת יקרה משהו.',
    at: 'falafel', giver: 'אליהו', where: 'פלאפל אליהו, המרכז המסחרי', reward: 1200, passLine: 'פלאפל חינם לכל החיים. טוב, עד סוף החודש.',
    async run(c) {
      c.hour(13.5);
      const eli = c.ped('dod', 'falafel', { tint: 0xffffff });
      await c.talk([
        ['E', 'נהוראי, טוב שבאת. הילדים מג׳ היו פה. ״שמירה״, הם קוראים לזה. חמשת אלפים בחודש.'],
        ['N', 'שמירה ממה?'],
        ['E', 'מהם! אמרתי להם: אני מוכר מנה בשמונה עשרה שקל, אתם יודעים כמה חומוס זה חמשת אלפים? הם אמרו שיחזרו בצהריים.'],
        ['N', 'מה השעה?'],
        ['E', 'צהריים.'],
      ], { actors: { E: eli } });
      const shimi = c.ped('dalet', 'plaza', { tint: 0xffffff }), d2 = c.ped('dalet2', 'plaza', { dx: 2 }), d3 = c.ped('dalet', 'plaza', { dx: -2, dz: 2 });
      for (const a of [shimi, d2, d3]) { a.ai.script = null; c.follow(a); }
      const foes = [];
      for (let i = 0; i < 6; i++) foes.push(c.ped(i % 3 === 2 ? 'gimel2' : 'gimel', 'plaza', { dx: -14 + i * 2.2, dz: 26 + (i % 2) * 2, hp: 85 }));
      for (const f of foes) c.send(f, 'falafel', 2.4);
      await c.wait(2.5);
      await c.say('R', 'אליהו! הבאנו קבלה. מי זה, השליח?', 2.6);
      c.game.world.mobT = 120;
      for (const a of [shimi, d2, d3]) { a.ai.mode = 'fight'; a.ai.target = foes[Math.floor(Math.random() * foes.length)]; }
      await c.fight(foes, 'הגן על <em>הדוכן</em>');
      await c.talk([
        ['E', 'אתם רואים? זה שכונה! ככה זה כשיש גב! נהוראי, אצלי אתה אוכל חינם. לכל החיים.'],
        ['S', 'גם אני?'],
        ['E', 'אתה משלם כפול, שימי. אתה אוכל כמו שלושה.'],
      ], { actors: { E: eli, S: shimi } });
      c.flags.freeFalafel = true;
    },
  },
  {
    id: 'caspomat', after: ['protection'], act: 'מערכה שנייה', title: 'כספומט נייד', blurb: 'שימי ראה ביוטיוב איך עוקרים כספומט עם שופל. מה כבר יכול להשתבש.',
    at: 'kiosk', giver: 'שימי', where: 'פיצוציית הנסיך', reward: 9000, passLine: 'שבע מאות אלף היו בפנים, אמרו בחדשות. לכם יצא תשע.',
    async run(c) {
      c.hour(23.2); c.density(0.5);
      const shimi = c.ped('dalet', 'kiosk', { tint: 0xffffff, dx: 1.2 });
      await c.talk([
        ['S', 'אחי, יש לי תוכנית. בתחנת הדלק בצומת יש כספומט. לבד. בלי שומר. באתר של הפינוי־בינוי יש שופל. עם מפתחות בפנים.'],
        ['N', 'מאיפה אתה יודע שיש מפתחות בפנים?'],
        ['S', 'כי הפועלים לא מקבלים משכורת כבר חודשיים, אז להם כבר לא אכפת.'],
        ['N', 'שימי, זה כספומט. יש בו מצלמות, יש בו צבע, יש בו אזעקה.'],
        ['S', 'ראיתי סרטון. לוקח ארבעים שניות. הבחור בסרטון נתפס, אבל הוא היה איטי.'],
      ], { actors: { S: shimi } });
      const tr = c.car('tractor', 'site', Math.PI / 2, { dx: 26, dz: 22, free: true });
      c.failIf(alive(tr));
      await c.goto('site', 'לך ל<em>אתר הבנייה</em>', { r: 12, label: 'אתר הבנייה' });
      await board(c, tr, 'קח את <em>השופל</em>');
      await c.say('N', 'הוא נוסע שלושים קמ״ש. זה הרכב מילוט הכי גרוע בעולם.', 3);
      await c.goto('atmGas', 'סע ל<em>כספומט בתחנת הדלק</em>', { r: 8, vehicle: tr, label: 'כספומט' });
      await c.hold('atmGas', 'החזק את השופל על הכספומט כדי <em>לעקור</em> אותו', 7, { r: 9, vehicle: tr });
      // the machine comes out of the wall and rides in the bucket
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x3a4a66, roughness: 0.5, metalness: 0.4 }));
      box.position.set(0, 1.3, tr.len / 2 + 0.2); box.rotation.x = 0.3; tr.root.add(box); c.cleanups.push(() => tr.root.remove(box));
      c.game.cam.shake(0.6); c.game.audio.crash(1);
      c.wanted(3); c.note('אזעקה שקטה. שלוש ניידות בדרך.', 'cop');
      await c.say('S', 'זה עבד! זה באמת עבד! למה אתה נוסע כל כך לאט?!', 3);
      await c.goto('scrap', 'הבא את הכספומט ל<em>מתכות הנגב</em>', { r: 9, vehicle: tr, label: 'מתכות הנגב' });
      await c.loseCops('הסתר את השופל. <em>תאבד את המשטרה</em>');
      await c.say('N', 'ארבעים שניות, אמרת.', 2.4);
    },
  },
  {
    id: 'chatuna', after: ['caspomat'], act: 'מערכה שנייה', title: 'מעטפות', blurb: 'חתונה באולמי ורסאי. שש מאות מוזמנים. כספת אחת.',
    at: 'fence', giver: 'ציון הסוחר', where: '״סחורה טובה״, בשוק', reward: 14000, passLine: 'חצי צ׳קים דחויים. חצי מהחצי בלי כיסוי. עדיין ארבעה עשר אלף.',
    async run(c) {
      c.hour(21.4);
      const z = c.ped('suit', 'fence', { tint: 0x9aa3ad });
      await c.talk([
        ['Z', 'נהוראי. שמעתי עליך. הכספומט. יפה. מגושם, אבל יפה.'],
        ['Z', 'הערב באולמי ורסאי מתחתן האחיין של ז׳וז׳ו. שש מאות איש. כל אחד שם מעטפה. המעטפות הולכות לכספת במשרד מאחורה.'],
        ['N', 'אתה רוצה שאני אשדוד חתונה.'],
        ['Z', 'אני רוצה שתיקח כסף מז׳וז׳ו ותיתן אותו לז׳וז׳ו. יש בזה משהו פואטי, לא?'],
        ['Z', 'כניסת השירות מאחורה. שני שומרים. בשקט. אם האולם ישמע, כל הדודים יוצאים, ודודים בחתונה זה לא משהו שאתה רוצה לפגוש.'],
      ], { actors: { Z: z } });
      const van = c.car('van', 'wedding', Math.PI / 2, { dx: -40, dz: 10, free: true, tint: 0xe8e8e8 });
      const g1 = c.ped('guard', 'weddingBack', { dx: 1.5 }), g2 = c.ped('guard', 'weddingBack', { dz: 3 });
      for (let i = 0; i < 7; i++) { const p = c.ped(['suit', 'girl', 'mom', 'suit', 'youth'][i % 5], 'wedding', { dx: -8 + i * 2.6, dz: 3 + (i % 3) * 1.6, mode: 'idle' }); if (p) { p.ai.script = true; p.gesture('dance'); } }
      await c.goto('weddingBack', 'הגע ל<em>כניסת השירות</em> של אולמי ורסאי', { r: 7, onFoot: true, label: 'כניסת שירות' });
      await c.say('X', 'היי! פה זה רק קייטרינג!', 2);
      c.game.world.mobT = 200; c.game.wanted.frozen = true;
      await c.fight([g1, g2], 'הורד את <em>השומרים</em>');
      await c.hold('weddingBack', '<em>פרוץ</em> את כספת המעטפות', 6, { r: 4, onFoot: true });
      c.game.wanted.frozen = false;
      await c.say('D', 'גנב! המעטפות! דוד שלמה, תביא את כולם!', 2.6);
      const mob = [];
      for (let i = 0; i < 7; i++) mob.push(c.ped(['suit', 'youth', 'dod', 'suit'][i % 4], 'wedding', { dx: -10 + i * 3, dz: 2, hp: 70, mode: 'idle' }));
      c.hostile(mob);
      c.wanted(2);
      await board(c, van, 'ברח ל<em>טנדר</em> בחניון. כל האולם אחריך');
      c.failIf(alive(van));
      await c.goto('fence', 'הבא את הכספת ל<em>ציון</em> בשוק', { r: 8, vehicle: van, label: 'ציון' });
      await c.loseCops('<em>תאבד את המשטרה</em> לפני שאתה פורק');
      await c.say('Z', 'מזל טוב לחתן ולכלה.', 2.2);
    },
  },
  {
    id: 'avocado', after: ['chatuna'], act: 'מערכה שנייה', title: 'זהב ירוק', blurb: 'בתל אביב שמים אותו על טוסט בעשרים שקל ליחידה. במושב הוא סתם תלוי על עץ.',
    at: 'fence', giver: 'ציון הסוחר', where: '״סחורה טובה״, בשוק', reward: 11000, passLine: 'שני טון אבוקדו. השוק לא ישאל מאיפה.',
    async run(c) {
      c.hour(2.2); c.density(0.4);
      const z = c.ped('suit', 'fence', { tint: 0x9aa3ad });
      await c.talk([
        ['Z', 'אבוקדו. זה הזהב החדש. במטע של מושב תלמים יש שני טון ארוזים, מחכים למשאית של הבוקר.'],
        ['N', 'ואנחנו המשאית של הלילה.'],
        ['Z', 'אתה לומד מהר. יש שומר. הוא ישן. בדרך כלל. ועל הכביש חזרה יש מחסום של משמר הגבול, הם מחפשים בדיוק אותך.'],
        ['N', 'אז איך אני חוזר?'],
        ['Z', 'יש כביש, ויש מדבר. המדבר לא שואל שאלות.'],
      ], { actors: { Z: z } });
      const truck = c.car('truck', 'fence', -Math.PI / 2, { dx: 6, dz: -9, free: true });
      c.failIf(alive(truck));
      await board(c, truck, 'קח את <em>המשאית</em>');
      await c.goto('orchard', 'סע ל<em>מטע</em> של מושב תלמים', { r: 9, vehicle: truck, label: 'המטע' });
      const guard = c.ped('guard', 'moshav', { dx: -3 }), guard2 = c.ped('worker', 'moshav', { dx: 4, hp: 100 });
      let woke = false;
      const loading = c.hold('orchard', '<em>העמס</em> את הארגזים. אל תזיז את המשאית', 14, { r: 10, vehicle: truck, cond: () => c.player.vehicle === truck && truck.speed < 1 });
      c.wait(5).then(() => { woke = true; c.hostile([guard, guard2]); c.line('X', 'מי שם?! עצור! זה שטח פרטי!'); }).catch(() => {});
      await loading;
      void woke;
      // Border Police checkpoint on the road home
      const cp = V(430, POI.exitEast.z);
      const pc1 = c.car('police', cp, 0.3, { dz: -2 }), pc2 = c.car('police', cp, -0.3, { dz: 2.6, dx: 5 });
      pc1.siren = pc2.siren = true; pc1.owned = pc2.owned = true;
      const cops = [c.ped('cop', cp, { dx: -4, dz: 5 }), c.ped('cop', cp, { dx: -5, dz: -5 }), c.ped('cop', cp, { dx: -3 })];
      const mk = c.mark(cp, 'מחסום', 'foe', '#2f7bff');
      let spotted = false;
      c.failIf(() => { if (!spotted && dist2(c.player.pos.x, c.player.pos.z, cp.x, cp.z) < 42 * 42) { spotted = true; c.wanted(3); c.hostile(cops); c.note('המחסום זיהה את המשאית!', 'cop'); } return false; });
      await c.say('N', 'מחסום. אמר שיהיה מחסום. המדבר לא שואל שאלות.', 3);
      await c.goto('fence', 'חזור ל<em>שוק</em>. עקוף את המחסום דרך המדבר', { r: 9, vehicle: truck, meter: () => truck.hp / truck.maxHp, label: 'ציון' });
      c.unmark(mk);
      await c.loseCops('<em>תאבד את המשטרה</em>');
      await c.say('Z', 'יפה. מחר הם על טוסט ברוטשילד.', 2.4);
    },
  },
  // ───────────────────────── ACT 3 ─────────────────────────
  {
    id: 'iriya', after: ['avocado'], act: 'מערכה שלישית · פינוי־בינוי', title: 'עיר עם עתיד', blurb: 'שירן מ״דרום עכשיו״ שואלת שאלה פשוטה: למי שייכים החובות של שכונה ד׳?',
    at: 'cafe', giver: 'שירן', where: 'קפה שש־בש', reward: 2000, passLine: 'תמונה אחת. שלושה אנשים שלא אמורים להכיר.',
    async run(c) {
      c.hour(10.4);
      const sh = c.ped('girl', 'cafe', { tint: 0xffffff });
      await c.talk([
        ['SH', 'נהוראי? שירן. למדנו ביחד בתקווה, ישבת מאחוריי והעתקת ממני בחשבון.'],
        ['N', 'ולא עזר לי. מה את עושה פה?'],
        ['SH', 'אני כתבת ב״דרום עכשיו״. תקשיב. ארבע מאות משפחות בשכונה קיבלו הודעת פינוי בחצי השנה האחרונה. לכולן יש חוב אצל אותו אדם.'],
        ['N', 'ז׳וז׳ו.'],
        ['SH', '״קורת גג״ מוכרת לו את החובות בגרושים. הוא לוחץ, המשפחות עוזבות, הבלוק מתרוקן. ואז בא קבלן ובונה מגדל של שלושים ואחת קומות.'],
        ['SH', 'אני צריכה תמונה אחת: הקבלן, ז׳וז׳ו וסגן ראש העיר ביחד. הקבלן יוצא עכשיו מהעירייה. תעקוב אחריו. לא קרוב מדי.'],
      ], { actors: { SH: sh } });
      const car = c.car('sedan', V(172.25, 6), Math.PI, { tint: 0x16181d, parked: false });
      car.locked = true; car.owned = true;
      const route = [V(172.25, -50), V(160, -62.25), V(60, -62.25), V(45.75, -50), V(45.75, 170), V(60, 182.25), V(160, 182.25), V(172.25, 170), V(172.25, 128)];
      const ai = c.drive(car, route, 9.5, 'suit'); ai.hold = true;
      await c.goto(V(178, 30), 'הגע ל<em>עירייה</em> ומצא רכב', { r: 30, label: 'הקבלן' });
      ai.hold = false;
      const mk = c.mark(() => car.pos, 'הקבלן', '', '#f5b301');
      let sus = 0, lost = 0;
      c.failIf(() => (car.wreck ? 'פגעת ברכב של הקבלן' : false));
      await c.until((dt) => {
        const d = Math.sqrt(dist2(c.player.pos.x, c.player.pos.z, car.pos.x, car.pos.z));
        if (d < 11) sus += dt * 0.5; else sus = Math.max(0, sus - dt * 0.15);
        if (d > 75) lost += dt; else lost = 0;
        if (sus >= 1) c.ms.fail('הוא זיהה אותך במראה');
        if (lost > 7) c.ms.fail('איבדת אותו');
        return ai.done;
      }, '<em>עקוב</em> אחרי הקבלן. לא קרוב מדי, לא רחוק מדי', { meter: () => sus, target: () => car.pos });
      c.unmark(mk);
      const jojo = c.ped('suit', 'siteOffice', { tint: 0xffffff, hp: 300 }), dep = c.ped('suit', 'siteOffice', { dx: 2, tint: 0xb9c4d6 }), kab = c.ped('suit', 'siteOffice', { dx: -2, dz: 1, tint: 0x9aa3ad });
      for (const a of [jojo, dep, kab]) a.gesture('talk');
      const guards = [c.ped('goon', 'siteOffice', { dx: 8, dz: 6, hp: 140 }), c.ped('goon', 'siteOffice', { dx: -7, dz: 9, hp: 140 })];
      await c.hold(V(POI.siteOffice.x + 3, POI.siteOffice.z + 16), 'היכנס לאתר ו<em>צלם</em> את הפגישה', 6, { r: 6, onFoot: true });
      await c.say('K', 'היי! מי זה שם עם הטלפון?!', 2);
      c.game.world.mobT = 200;
      c.hostile(guards);
      await c.until(() => dist2(c.player.pos.x, c.player.pos.z, POI.siteOffice.x, POI.siteOffice.z) > 95 * 95, '<em>ברח</em> מהאתר עם התמונות');
      c.sms('שירן', 'קיבלתי. זה הם. אל תעשה שום דבר טיפשי עד שזה מתפרסם.');
      c.flags.photos = true;
    },
  },
  {
    id: 'milchama', after: ['iriya'], act: 'מערכה שלישית', title: 'מלחמת שכונות', blurb: 'מישהו שילם לג׳ כדי שייקחו את שימי. סבתא מזל ראתה הכול.',
    at: 'yard', giver: 'סבתא מזל', where: 'החצר של בלוק 412', reward: 0, passLine: 'ד׳ וג׳. אותו טיח מתקלף, אותו בעל חוב.',
    async run(c) {
      c.hour(19.3);
      const sv = c.ped('savta', 'yard', { tint: 0xffffff });
      await c.talk([
        ['SV', 'נהוראי! איפה היית?! לקחו את שימי! ארבעה מג׳, בטנדר לבן, לפני עשר דקות, הנהג עם קעקוע של נשר על הצוואר!'],
        ['N', 'סבתא מזל, איך את יודעת את כל זה?'],
        ['SV', 'אני יושבת על הספסל הזה מ־1974. אני יודעת מה אכלת בבוקר. לקחו אותו למגרש שלהם. לך! וקח את הבנים, אל תלך לבד כמו טמבל.'],
      ], { actors: { SV: sv } });
      const crew = [];
      for (let i = 0; i < 4; i++) { const a = c.ped(i % 2 ? 'dalet2' : 'dalet', 'yard', { dx: 3 + i * 1.5, dz: 3, hp: 130 }); a.ai.script = null; c.follow(a); crew.push(a); }
      await c.say('B', 'אנחנו איתך. ד׳ זה משפחה.', 2.2);
      const shimi = c.ped('dalet', 'court3', { tint: 0xffffff, hp: 400 }); shimi.knockdown(null, true); shimi.downT = 9999;
      const liam = c.ped('gimel', 'court3', { tint: 0xffffff, hp: 190, dx: 2 });
      const foes = [liam];
      for (let i = 0; i < 7; i++) foes.push(c.ped(i % 3 ? 'gimel' : 'gimel2', 'court3', { dx: -8 + i * 2.6, dz: 4 + (i % 2) * 3, hp: 90 }));
      await c.goto('court3', 'רוץ ל<em>מגרש של שכונה ג׳</em>', { r: 22, label: 'שימי' });
      await c.say('R', 'הנה הגיבור. באת לקחת את השמן שלך?', 2.6);
      c.game.world.mobT = 300;
      for (const a of crew) { a.ai.mode = 'fight'; a.ai.target = foes[1 + Math.floor(Math.random() * (foes.length - 1))]; }
      await c.fight(foes, 'פרק את <em>החבורה של ג׳</em>');
      liam.revive(0.3); liam.ai.mode = 'script'; liam.ai.script = true;
      shimi.downT = 0;
      await c.wait(1.2);
      await c.talk([
        ['R', 'די. די. מספיק. זה לא היה אישי.'],
        ['N', 'מי שילם לכם?'],
        ['R', 'ז׳וז׳ו. אלפיים שקל לראש. הוא אמר שאתם מפריעים לו לעסק עם המגדלים.'],
        ['N', 'ליאם. גם הבלוקים שלכם ברשימה. ראיתי את המפה. ג׳ יורדת חצי שנה אחרי ד׳.'],
        ['R', '...אמא שלי קיבלה מכתב בשבוע שעבר. חשבתי שזה טעות.'],
        ['N', 'זה לא טעות. זה תוכנית עסקית.'],
        ['R', 'אז מה עושים?'],
        ['N', 'לוקחים לו את הכסף. את כל הכסף.'],
      ], { actors: { R: liam } });
      shimi.ai.script = null; c.follow(shimi);
      await c.goto('home', 'קח את שימי <em>הביתה</em>', { r: 10, label: 'הבית' });
      await c.say('S', 'אחי. אכלתי מכות בשביל אלפיים שקל לראש. אני שווה לפחות חמש.', 3.4);
      c.flags.truce = true;
    },
  },
  {
    id: 'brinks', after: ['milchama'], act: 'מערכה שלישית', title: 'המשוריין', blurb: 'השוחד של העירייה נוסע היום במשוריין מבנק הדרום. ד׳ וג׳ מחכים לו ביחד.',
    at: 'kiosk', giver: 'שימי וליאם', where: 'פיצוציית הנסיך', reward: 150000, passLine: 'מאה וחמישים אלף. במזומן. של ז׳וז׳ו.',
    async run(c) {
      c.hour(11.2);
      const shimi = c.ped('dalet', 'kiosk', { tint: 0xffffff, dx: 1.2 }), liam = c.ped('gimel', 'kiosk', { tint: 0xffffff, dx: -1.4, dz: 0.6, faction: 'dalet' });
      await c.talk([
        ['R', 'בן דוד שלי נהג במשוריין של ״מבצר״. היום בשתים עשרה הוא לוקח שקים מבנק הדרום לעירייה. זה לא משכורות. זה של ז׳וז׳ו.'],
        ['S', 'והבן דוד בעניין?'],
        ['R', 'הבן דוד לא קיבל העלאה ארבע שנים. הוא מאוד בעניין. הוא רק ביקש שלא נשרוט לו את הפנים.'],
        ['N', 'משוריין לא עוצרים עם סדאן. צריך משהו כבד. משאית. אוטובוס.'],
        ['S', 'יש משאיות באזור התעשייה ואוטובוסים בתחנה. תבחר.'],
        ['N', 'עוצרים אותו בשדרה, לוקחים את השקים, נעלמים במטע של המושב עד שיירגע.'],
      ], { actors: { R: liam, S: shimi } });
      const van = c.car('armored', V(54.25, 44), Math.PI, { parked: false }); van.locked = true; van.owned = true;
      const ai = c.drive(van, [V(54.25, -170), V(66, -177.75), V(160, -177.75), V(167.75, -166), V(167.75, -20), V(167.75, 40), V(160, 57), V(66, 57), V(54.25, 44)], 8.5, 'guard'); ai.loop = true; ai.pushy = true;
      const mk = c.mark(() => van.pos, 'המשוריין', 'foe', '#e5412d');
      c.note('מצא רכב כבד (משאית, אוטובוס) ונגח את המשוריין עד שייעצר.', '');
      let still = 0;
      await c.until((dt) => {
        if (van.speed < 1.2 && dist2(c.player.pos.x, c.player.pos.z, van.pos.x, van.pos.z) < 30 * 30) still += dt; else still = Math.max(0, still - dt);
        return van.wreck || van.hp < van.maxHp * 0.45 || still > 5;
      }, '<em>עצור</em> את המשוריין', { meter: () => 1 - Math.max(0, (van.hp / van.maxHp - 0.45) / 0.55), target: () => van.pos });
      ai.hold = true; van.ai = null; van.in.throttle = 0; van.in.brake = 1; c.unmark(mk);
      c.wanted(3);
      const guards = [];
      for (let i = 0; i < 3; i++) guards.push(c.ped('guard', V(van.pos.x, van.pos.z), { dx: (i - 1) * 2.2, dz: 3 + i, hp: 130 }));
      c.game.world.mobT = 200;
      await c.fight(guards, 'הורד את <em>המאבטחים</em>');
      let load = 0;
      await c.until((dt) => { if (!c.player.vehicle && dist2(c.player.pos.x, c.player.pos.z, van.pos.x, van.pos.z) < 6 * 6) load += dt; return load >= 6; }, '<em>העמס</em> את השקים. הישאר ליד המשוריין', { meter: () => load / 6, target: () => van.pos });
      c.wanted(4); c.note('מסוק באוויר. אל תישאר בשטח פתוח.', 'cop');
      await c.say('S', 'יש מסוק! למה תמיד יש מסוק?!', 2.4);
      await c.goto('orchard', 'ברח ל<em>מטע</em> של המושב', { r: 16, label: 'המטע' });
      await c.loseCops('הסתתר בין העצים. <em>תאבד אותם</em>');
    },
  },
  {
    id: 'shchuna', after: ['brinks'], act: 'מערכה שלישית', title: 'שכונה ד׳', blurb: 'יש לך את הכסף שלו ואת התמונות שלו. ז׳וז׳ו מחכה באתר הבנייה.',
    at: 'site', giver: 'ז׳וז׳ו', where: 'אתר הפינוי־בינוי', reward: 0, silent: true,
    async run(c) {
      c.hour(18.9); c.density(0.5);
      const jojo = c.ped('suit', 'siteTop', { tint: 0xffffff, hp: 260 });
      const goons = [];
      for (let i = 0; i < 5; i++) goons.push(c.ped('goon', 'siteTop', { dx: -3 + i * 2.4, dz: 4 + (i % 2) * 2, hp: 150 }));
      await c.goto('siteTop', 'היכנס לאתר ופגוש את <em>ז׳וז׳ו</em>', { r: 9, onFoot: true, label: 'ז׳וז׳ו' });
      await c.talk([
        ['J', 'נהוראי. הילד שלקח לי משוריין. אתה יודע, כמעט התרשמתי.'],
        ['N', 'יש לי את הכסף שלך. ויש לי תמונה שלך עם הקבלן ועם סגן ראש העיר.'],
        ['J', 'אז יש לנו על מה לדבר. תראה את המגדל הזה. שלושים ואחת קומות. אתה יודע מה היה פה קודם? בלוק. כמו שלך. אף אחד לא זוכר איך קראו למשפחות.'],
        ['J', 'הנה ההצעה. תחזיר את הכסף, תמחק את התמונה. החוב של אמא שלך נמחק. היא מקבלת דירה במגדל. קומה שלוש. בלי נוף, אבל עם מעלית.'],
        ['N', 'ושאר הבלוק?'],
        ['J', 'שאר הבלוק זה לא הבעיה שלך. זה אף פעם לא היה הבעיה של אף אחד. ככה בונים עיר.'],
      ], { actors: { J: jojo } });
      const pick = await c.choice('מה נהוראי עושה?', ['לפרסם את התמונות', 'לקחת את העסקה']);
      if (pick === 1) {
        const pay = Math.min(c.player.money, 180000);
        c.money(-pay);
        await c.talk([
          ['N', '...תמחק את החוב.'],
          ['J', 'ילד חכם. אמרתי לך בפעם הראשונה: יש לי רואה חשבון ויש לי חבר בעירייה. אתה פשוט לא הקשבת.'],
        ], { actors: { J: jojo } });
        c.flags.ending = 'deal';
        await c.fade(true, 1.2);
        c.hour(9); c.teleport('home');
        await c.fade(false, 0.6);
        await c.game.ui.banner('', 'קומה שלוש', 'אמא קיבלה מפתח לדירה במגדל. מהחלון רואים את החניון. בלוק 412 נהרס באביב. סבתא מזל עברה לבת שלה באשדוד, ואין מי שיספר מה קרה פה.', { hold: 9000 });
      } else {
        await c.talk([
          ['N', 'התמונה כבר אצל שירן. היא עולה הערב. והכסף הולך לארבע מאות המשפחות שברשימה שלך.'],
          ['J', 'טעות. מוטי. כולם. תסבירו לו.'],
        ], { actors: { J: jojo } });
        const allies = [];
        for (let i = 0; i < 3; i++) { const a = c.ped('dalet', 'site', { dx: 3 + i * 2, dz: (i - 1) * 3, hp: 150 }); a.ai.script = null; allies.push(a); }
        for (let i = 0; i < 3; i++) { const a = c.ped('gimel', 'site', { dx: 4 + i * 2, dz: 6 + i, hp: 150, faction: 'dalet' }); a.ai.script = null; allies.push(a); }
        for (const a of allies) { a.ai.mode = 'fight'; a.ai.target = goons[Math.floor(Math.random() * goons.length)]; }
        c.line('S', 'ד׳ וג׳ ביחד! מי היה מאמין!');
        c.game.world.mobT = 400; c.game.wanted.frozen = true;
        await c.fight(goons, 'ד׳ וג׳ ביחד. <em>פרק אותם</em>');
        // he runs for his car
        const jcar = c.car('sedan', 'site', -Math.PI / 2, { dx: -6, dz: 0, tint: 0x16181d, parked: false }); jcar.locked = true; jcar.owned = true;
        c.game.world.removeActor(jojo);
        const ai = c.drive(jcar, [V(167.75, 170), V(160, 182.25), V(60, 182.25), V(45.75, 190), V(45.75, 290), V(45.75, 420), V(45.75, 570)], 15, 'suit'); ai.pushy = true;
        const chase = c.car('pickup', 'site', Math.PI, { dx: -4, dz: 9, free: true });
        const mk = c.mark(() => jcar.pos, 'ז׳וז׳ו', 'foe', '#e5412d');
        await c.say('S', 'הוא בורח לכביש 25! קח את הטנדר!', 2.4);
        c.failIf(() => (ai.done ? 'ז׳וז׳ו יצא מהעיר' : false));
        await c.until(() => jcar.wreck || jcar.hp < jcar.maxHp * 0.3 || (jcar.speed < 1 && dist2(c.player.pos.x, c.player.pos.z, jcar.pos.x, jcar.pos.z) < 8 * 8 && c.game.time > 5), '<em>עצור</em> את ז׳וז׳ו לפני שהוא יוצא מהעיר', { meter: () => 1 - Math.max(0, (jcar.hp / jcar.maxHp - 0.3) / 0.7), target: () => jcar.pos });
        c.unmark(mk); void chase;
        jcar.ai = null; jcar.in.throttle = 0; jcar.in.brake = 1;
        const cop = c.ped('cop', V(jcar.pos.x, jcar.pos.z), { dx: 4, dz: 3 });
        const j2 = c.ped('suit', V(jcar.pos.x, jcar.pos.z), { dx: -3, dz: 1, tint: 0xffffff }); j2.knockdown(null, true); j2.downT = 999;
        if (c.player.vehicle) c.player.leaveVehicle(true);
        await c.wait(1);
        await c.talk([
          ['C', 'ז׳וז׳ו כהן. חיכינו לזה שנים.'],
          ['N', 'חיכיתם? הוא יושב בצ׳יינג׳ מול התחנה שלכם כל יום.'],
          ['C', 'חיכינו שמישהו אחר יעשה את העבודה. זה חלק מהנוהל. אתה נהוראי, נכון? הכתבה עלתה לפני רבע שעה. אתה חופשי ללכת. בינתיים.'],
        ], { actors: { C: cop } });
        c.game.wanted.frozen = false;
        c.flags.ending = 'expose';
        await c.fade(true, 1.2);
        c.hour(8.5); c.teleport('home');
        await c.fade(false, 0.6);
        await c.game.ui.banner('', 'בינתיים', 'צווי הפינוי הוקפאו ״עד לבירור״. סגן ראש העיר יצא לחופשה. הקבלן הגיש בקשה חדשה תחת שם אחר. אמא עדיין מנקה בעירייה, ועדיין אין לה זכאות. אבל הבלוק עומד, וסבתא מזל על הספסל.', { hold: 9500 });
      }
      await c.game.ui.banner('', 'שכונה ד׳', 'תודה ששיחקת. העיר פתוחה: המשך להסתובב, למחזר רכבים אצל חכם, או היכנס לאונליין.', { hold: 6000 });
    },
  },
];

// ---- things to do around town --------------------------------------------------------------
export function setupWorldSpots(game) {
  const g = game, pl = () => g.player;
  const eat = (poi, name, price, heal) => {
    if (!POI[poi]) return;
    g.addSpot({
      pos: POI[poi], r: 2.4,
      text: () => (poi === 'falafel' && g.missions.flags.freeFalafel ? `${name} · על חשבון הבית` : `${name} · ${fmtMoney(price)}`),
      cond: () => !g.missions.active || g.missions.active.id === 'shichrur',
      action: () => {
        const free = poi === 'falafel' && g.missions.flags.freeFalafel, a = pl().actor;
        if (a.hp >= a.maxHp - 1) { g.ui.notify('אתה מלא. גם בגאווה.', ''); return; }
        if (!free && pl().money < price) { g.ui.notify('אין לך מספיק. אליהו רושם, אבל לא לך.', 'bad'); return; }
        if (!free) pl().addMoney(-price, 'food');
        a.hp = Math.min(a.maxHp, a.hp + heal); g.ui.notify(['חריף בצד, כמו שאמא אמרה.', 'טעים. שורף. מרפא.', 'עוד מנה והיית צריך מונית.'][Math.floor(Math.random() * 3)], 'ok');
      },
    });
  };
  eat('falafel', 'מנת פלאפל', 18, 45); eat('shawarma', 'לאפה שווארמה', 42, 100); eat('kiosk', 'קפה שחור וגרעינים', 12, 22); eat('gas', 'סנדוויץ׳ עצוב', 24, 40); eat('cafe', 'קפה ועוגת שיש', 16, 28);

  if (POI.home) g.addSpot({
    pos: POI.home, r: 2.6, text: 'לישון עד הבוקר (שמירה)', cond: () => g.mode === 'story' && !g.missions.active && g.wanted.level === 0,
    action: async () => {
      g.fade(true); await new Promise((r) => setTimeout(r, 600));
      g.sky.setHour(7.5); g.sky.day++; const a = pl().actor; a.hp = a.maxHp; g.save();
      g.fade(false); g.ui.notify('בוקר טוב. אמא השאירה קפה. המשחק נשמר.', 'ok');
    },
  });
  if (POI.bituach) g.addSpot({ pos: POI.bituach, r: 2.6, text: 'לקחת מספר', action: () => g.ui.notify(`המספר שלך: ${700 + Math.floor(Math.random() * 280)}. משרתים כעת: ${8 + Math.floor(Math.random() * 9)}.`, '', 'הביטוח הלאומי') });
  const atm = (poi) => POI[poi] && g.addSpot({ pos: POI[poi], r: 2, text: 'לבדוק יתרה', action: () => g.ui.notify([`יתרה: ${fmtMoney(pl().money)}. הכספומט מרחם עליך.`, 'הכרטיס נבלע. סתם. הנה הוא.', 'עמלת בירור יתרה: ₪1.80. נוכתה.'][Math.floor(Math.random() * 3)], '', 'בנק הדרום') });
  atm('atm'); atm('atmGas');
  if (POI.post) g.addSpot({ pos: POI.post, r: 2.4, text: 'לשאול על החבילה', action: () => g.ui.notify('החבילה שלך במרכז המיון. מאז פסח.', '', 'דואר קריית שמש') });
  if (POI.kiosk) g.addSpot({
    pos: { x: POI.kiosk.x + 9, z: POI.kiosk.z + 4 }, r: 2.2, text: `טופס טוטו · ${fmtMoney(20)}`,
    action: () => {
      if (pl().money < 20) { g.ui.notify('אפילו על טוטו אין לך.', 'bad'); return; }
      pl().addMoney(-20, 'toto'); const r = Math.random();
      if (r < 0.004) { pl().addMoney(5000, 'toto'); g.ui.notify('לא ייאמן. זכית בחמשת אלפים!', 'ok', 'טוטו'); }
      else if (r < 0.11) { pl().addMoney(120, 'toto'); g.ui.notify('זכית ב־120. הפועל ניצחה, נס.', 'ok', 'טוטו'); }
      else g.ui.notify(['כמעט. תמיד כמעט.', 'השוער שלהם, כרגיל.', 'בשבוע הבא זה בטוח.'][Math.floor(Math.random() * 3)], '', 'טוטו');
    },
  });
  // sell a "recycled" car to Hakham
  const value = (v) => Math.round({ sedan: 2200, hatch: 1800, pickup: 2600, van: 2400, taxi: 1500, moped: 700, truck: 3200, bus: 2800, police: 0, armored: 0, tractor: 1800 }[v.type] * (0.35 + 0.65 * (v.hp / v.maxHp)));
  if (POI.garageIn) g.addSpot({
    pos: POI.garageIn, r: 7, vehicle: true,
    cond: () => g.mode === 'story' && g.missions.flags.garage && !g.missions.active && pl().vehicle && pl().vehicle.stolen && !pl().vehicle.sold && value(pl().vehicle) > 0 && g.wanted.level === 0,
    text: () => `למחזר אצל חכם · ${fmtMoney(value(pl().vehicle))}`,
    action: () => { const v = pl().vehicle, m = value(v); pl().leaveVehicle(true); v.sold = true; v.locked = true; v.despawn = true; v.keep = false; pl().lastVehicle = null; pl().addMoney(m, 'car'); g.ui.notify('חכם: ״יפה. מחר זה כבר פגוש, דלת ושלושה פנסים.״', 'ok'); },
  });
}
