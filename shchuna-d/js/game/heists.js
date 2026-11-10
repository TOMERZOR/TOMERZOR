// Online heists. Each is modelled on a kind of job that Israeli crime reporting keeps describing:
// a cash machine pulled out with a loader, the envelope safe of a wedding hall, a cash-in-transit van.
// Every heist has preps (short missions) and a finale. They run on the host; the crew sees the
// same objective, the same cast, and anyone can do the work.
import { POI } from '../world/map.js';
import { dist2 } from '../core/util.js';
import * as THREE from 'three';

const V = (x, z) => ({ x, z });
const alive = (v) => () => (v.wreck ? 'הרכב נהרס' : false);
async function board(c, v, text) {
  const m = c.mark(() => v.pos, v.def.name);
  try { await c.until(() => c.driving(v), text, { target: () => v.pos }); } finally { c.unmark(m); }
}
const crewDown = (c) => () => (c.crewAllDown() ? 'כל הצוות על הרצפה' : false);

export const HEISTS = [
  {
    id: 'atm', title: 'כספומט בצומת', take: 60000,
    blurb: 'כספומט בודד בתחנת הדלק, שופל שמישהו שכח באתר בנייה. ארבעים שניות, אומרים ביוטיוב.',
    preps: [
      {
        key: 'loader', title: 'הכנה: ״להשאיל״ שופל מאתר הבנייה',
        async run(c) {
          c.hour(22.5); c.failIf(crewDown(c));
          const tr = c.car('tractor', 'site', Math.PI / 2, { dx: 26, dz: 22, free: true });
          const guards = [c.ped('guard', 'site', { dx: 14, dz: 10 }), c.ped('worker', 'site', { dx: 20, dz: 28, hp: 110 })];
          c.failIf(alive(tr));
          await c.goto('site', 'הגיעו ל<em>אתר הבנייה</em>', { r: 14, label: 'אתר הבנייה' });
          c.say('X', 'היי! האתר סגור! מי אתם?', 2.4); c.hostile(guards);
          await board(c, tr, 'קחו את <em>השופל</em>');
          c.wanted(2);
          await c.goto('scrap', 'החביאו את השופל ב<em>מתכות הנגב</em>', { r: 9, vehicle: tr, label: 'מתכות הנגב' });
          await c.loseCops('<em>תאבדו את המשטרה</em>');
        },
      },
      {
        key: 'chain', title: 'הכנה: שרשרת גרירה ומסכות מהשוק',
        async run(c) {
          c.hour(15.5); c.failIf(crewDown(c));
          const goons = [];
          for (let i = 0; i < 4; i++) goons.push(c.ped('goon', 'fence', { dx: -4 + i * 2.6, dz: 3 + (i % 2) * 2, hp: 130 }));
          await c.goto('fence', 'לכו ל<em>״סחורה טובה״</em> בשוק', { r: 9, label: 'הסוחר' });
          c.say('G', 'ציון לא מוכר לילדים. אלא אם ז׳וז׳ו אישר. ז׳וז׳ו לא אישר.', 3.2);
          await c.fight(goons, 'פנו את <em>הגובים</em> מהחנות');
          await c.hold('fence', '<em>אספו</em> את השרשרת והמסכות', 5, { r: 5, onFoot: true });
        },
      },
    ],
    async finale(c) {
      c.hour(23.4); c.density(0.5); c.failIf(crewDown(c));
      const tr = c.car('tractor', 'scrap', 0, { dz: 6, free: true });
      c.failIf(alive(tr));
      await board(c, tr, 'קחו את <em>השופל</em> מהמחסן');
      await c.goto('atmGas', 'סעו ל<em>כספומט בתחנת הדלק</em>', { r: 9, vehicle: tr, label: 'כספומט' });
      await c.hold('atmGas', 'השופל על הכספומט: <em>עקרו</em> אותו', 8, { r: 10, vehicle: tr });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x3a4a66, roughness: 0.5, metalness: 0.4 }));
      box.position.set(0, 1.3, tr.len / 2 + 0.2); box.rotation.x = 0.3; tr.root.add(box); c.cleanups.push(() => tr.root.remove(box));
      c.game.cam.shake(0.6); c.game.audio.crash(1);
      c.wanted(3); c.note('אזעקה. שלוש ניידות בדרך.', 'cop');
      await c.goto('garageIn', 'הביאו את הכספומט ל<em>מוסך של חכם</em>', { r: 9, vehicle: tr, label: 'המוסך' });
      await c.loseCops('<em>תאבדו את המשטרה</em> לפני שפותחים אותו');
    },
  },
  {
    id: 'wedding', title: 'המעטפות של ורסאי', take: 95000,
    blurb: 'שש מאות מוזמנים, כספת אחת במשרד האחורי, ודודים שלא אוהבים שנוגעים להם במתנות.',
    preps: [
      {
        key: 'van', title: 'הכנה: טנדר קייטרינג מאזור התעשייה',
        async run(c) {
          c.hour(14.2); c.failIf(crewDown(c));
          const van = c.car('van', 'depot', Math.PI, { dx: -8, dz: 4, free: true, tint: 0xf0d060 });
          c.failIf(alive(van));
          await c.goto('depot', 'הגיעו ל<em>מחסן ההפצה</em>', { r: 16, label: 'מחסן ההפצה' });
          await board(c, van, 'קחו את <em>טנדר הקייטרינג</em>');
          c.wanted(2);
          await c.loseCops('<em>תאבדו את המשטרה</em>');
          await c.goto('weddingBack', 'החנו אותו מאחורי <em>אולמי ורסאי</em>', { r: 10, vehicle: van, slow: true, label: 'ורסאי' });
        },
      },
      {
        key: 'uniforms', title: 'הכנה: חולצות מלצרים מהמתנ״ס',
        async run(c) {
          c.hour(18.6); c.failIf(crewDown(c));
          const g1 = c.ped('guard', 'matnas', { dx: 2 }), g2 = c.ped('guard', 'matnas', { dx: -3, dz: 2 });
          await c.goto('matnas', 'לכו ל<em>מתנ״ס</em>', { r: 10, label: 'המתנ״ס' });
          await c.hold('matnas', '<em>קחו</em> את החולצות מהמחסן של חוג הדרמה', 5, { r: 5, onFoot: true });
          c.say('X', 'זה התלבושות של ״כנר על הגג״! תחזירו!', 2.8); c.hostile([g1, g2]);
          await c.until(() => !c.anyCrewNear('matnas', 60), '<em>התרחקו</em> מהמתנ״ס');
        },
      },
    ],
    async finale(c) {
      c.hour(21.6); c.failIf(crewDown(c));
      const van = c.car('van', 'weddingBack', Math.PI / 2, { dx: -6, dz: 8, free: true, tint: 0xf0d060 });
      const guards = [c.ped('guard', 'weddingBack', { dx: 1.5 }), c.ped('guard', 'weddingBack', { dz: 3 }), c.ped('goon', 'weddingBack', { dx: 3, dz: 5, hp: 150 })];
      for (let i = 0; i < 8; i++) { const p = c.ped(['suit', 'girl', 'mom', 'suit', 'youth'][i % 5], 'wedding', { dx: -9 + i * 2.5, dz: 3 + (i % 3) * 1.6, mode: 'idle' }); if (p) { p.ai.script = true; p.gesture('dance'); } }
      await c.goto('weddingBack', 'הגיעו ל<em>כניסת השירות</em>', { r: 8, label: 'כניסת שירות' });
      c.game.wanted.frozen = true;
      await c.fight(guards, 'הורידו את <em>השומרים</em>');
      await c.hold('weddingBack', '<em>פרצו</em> את כספת המעטפות', 7, { r: 5, onFoot: true });
      c.game.wanted.frozen = false;
      c.say('D', 'גנבים! המעטפות! כל הדודים החוצה!', 2.6);
      const mob = [];
      for (let i = 0; i < 8; i++) mob.push(c.ped(['suit', 'youth', 'dod', 'suit'][i % 4], 'wedding', { dx: -10 + i * 3, dz: 2, hp: 70, mode: 'idle' }));
      c.hostile(mob); c.wanted(2);
      c.failIf(alive(van));
      await board(c, van, 'ל<em>טנדר</em>! כל האולם אחריכם');
      await c.goto('fence', 'הביאו את הכספת ל<em>סוחר</em> בשוק', { r: 9, vehicle: van, label: 'הסוחר' });
      await c.loseCops('<em>תאבדו את המשטרה</em>');
    },
  },
  {
    id: 'brinks', title: 'המשוריין של הבנק', take: 220000,
    blurb: 'כל יום בשתים עשרה, אותו מסלול, אותם שלושה מאבטחים. צריך משהו כבד כדי לעצור אותו ומקום להיעלם אחר כך.',
    preps: [
      {
        key: 'truck', title: 'הכנה: משאית כבדה לחסימה',
        async run(c) {
          c.hour(9.4); c.failIf(crewDown(c));
          const truck = c.car('truck', 'depot', Math.PI, { dx: 4, dz: 5, free: true });
          const guards = [c.ped('guard', 'depot', { dx: -2, dz: 2 }), c.ped('worker', 'depot', { dx: 6, dz: 1, hp: 110 })];
          c.failIf(alive(truck));
          await c.goto('depot', 'הגיעו ל<em>מחסן ההפצה</em>', { r: 16, label: 'מחסן ההפצה' });
          c.hostile(guards);
          await board(c, truck, 'קחו את <em>המשאית</em>');
          c.wanted(2);
          await c.loseCops('<em>תאבדו את המשטרה</em>');
          await c.goto('taxi', 'החנו אותה ב<em>חניון המרכז המסחרי</em>', { r: 10, vehicle: truck, slow: true, label: 'חניון' });
        },
      },
      {
        key: 'route', title: 'הכנה: לוח הזמנים של המשוריין',
        async run(c) {
          c.hour(11.5); c.failIf(crewDown(c));
          const g1 = c.ped('guard', 'bank', { dx: 2 }), g2 = c.ped('guard', 'bank', { dx: -2, dz: 2 });
          await c.goto('bank', 'לכו ל<em>בנק הדרום</em>', { r: 9, label: 'בנק הדרום' });
          await c.hold('bank', '<em>צלמו</em> את לוח המשמרות דרך החלון', 6, { r: 4, onFoot: true });
          c.say('X', 'אין לצלם פה! תן את הטלפון!', 2.4); c.hostile([g1, g2]);
          await c.fight([g1, g2], 'הורידו את <em>המאבטחים</em>');
        },
      },
    ],
    async finale(c) {
      c.hour(11.9); c.failIf(crewDown(c));
      const truck = c.car('truck', 'taxi', Math.PI / 2, { free: true });
      const van = c.car('armored', V(54.25, 44), Math.PI, { parked: false }); van.locked = true; van.owned = true;
      const ai = c.drive(van, [V(54.25, -170), V(66, -177.75), V(160, -177.75), V(167.75, -166), V(167.75, 40), V(160, 57), V(66, 57), V(54.25, 44)], 8.5, 'guard'); ai.loop = true; ai.pushy = true;
      const mk = c.mark(() => van.pos, 'המשוריין', 'foe', '#e5412d');
      c.note('המשאית מחכה בחניון. נגחו את המשוריין עד שייעצר.', '');
      let still = 0;
      await c.until((dt) => {
        if (van.speed < 1.2 && c.anyCrewNear(van.pos, 30)) still += dt; else still = Math.max(0, still - dt);
        return van.wreck || van.hp < van.maxHp * 0.45 || still > 5;
      }, '<em>עצרו</em> את המשוריין', { meter: () => 1 - Math.max(0, (van.hp / van.maxHp - 0.45) / 0.55), target: () => van.pos });
      ai.hold = true; van.ai = null; van.in.throttle = 0; van.in.brake = 1; c.unmark(mk); void truck;
      c.wanted(3);
      const guards = [];
      for (let i = 0; i < 4; i++) guards.push(c.ped('guard', V(van.pos.x, van.pos.z), { dx: (i - 1.5) * 2.2, dz: 3 + (i % 2), hp: 130 }));
      await c.fight(guards, 'הורידו את <em>המאבטחים</em>');
      let load = 0;
      await c.until((dt) => { if (c.anyCrewNear(van.pos, 6, true)) load += dt; return load >= 7; }, '<em>העמיסו</em> את השקים. הישארו ליד המשוריין', { meter: () => load / 7, target: () => van.pos });
      c.wanted(4); c.note('מסוק באוויר. אל תישארו בשטח פתוח.', 'cop');
      await c.goto('orchard', 'ברחו ל<em>מטע</em> של המושב', { r: 18, label: 'המטע' });
      await c.loseCops('הסתתרו בין העצים. <em>תאבדו אותם</em>');
    },
  },
];

// The heists as missions the runtime can start.
export function heistMissions() {
  const out = [];
  for (const h of HEISTS) {
    for (const p of h.preps) out.push({ id: `h:${h.id}:${p.key}`, online: true, heist: h, prepKey: p.key, act: h.title, title: p.title.replace('הכנה: ', ''), blurb: 'הכנה לשוד', reward: 0, silent: true, run: p.run });
    out.push({ id: `h:${h.id}:finale`, online: true, heist: h, act: 'השוד', title: h.title, blurb: h.blurb, reward: 0, silent: true, run: h.finale });
  }
  return out;
}
export { POI, dist2 };
