const { chromium } = require('playwright');
const fs = require('fs');
const SHOTS = process.argv[2], OUT = process.argv[3];

const POSTS = [
  { file: '01-cover', theme: 'rose', title: ['המעריצות שואלות.', 'קולי עונה, <em>בקול שלך.</em>'], sub: 'עוזרת AI שלומדת איך את כותבת ועונה בהודעות הפרטיות באינסטגרם, גם כשאת לא שם.', shots: ['chat.png'] },
  { file: '02-voice', title: ['לומדת לכתוב', '<em>בדיוק כמוך</em>'], sub: 'מייבאים את ההודעות, הכיתובים והתגובות מאינסטגרם. קולי בונה פרופיל קול שאפשר לערוך.', shots: ['profile.png'] },
  { file: '03-campaigns', title: ['יודעת על איזה', '<em>מוצר</em> שואלים'], sub: 'הגיבו לסטורי? קולי מזהה את הקמפיין, עונה רק מהעובדות שלך ושולחת קוד ולינק עם מעקב.', shots: ['campaign.png'] },
  { file: '04-personality', title: ['האופי', '<em>בשליטה שלך</em>'], sub: 'שמונה כיוונונים, מחום והומור ועד כמה למכור. נשמעת כמוך, בגרסה שבחרת.', shots: ['sliders.png'] },
  { file: '05-learning', title: ['כל תיקון', '<em>מלמד אותה</em>'], sub: 'במצב טיוטות את מאשרת כל תשובה. מה שאת עורכת נשמר, וקולי מחקה אותו בפעם הבאה.', shots: ['draft.png', 'learned.png'] },
  { file: '06-handoff', title: ['יודעת מתי', '<em>להעביר אלייך</em>'], sub: 'תלונות, שאלות רפואיות ושיתופי פעולה מגיעים אלייך מסומנים. כשאת עונה בעצמך, קולי זזה הצידה.', shots: ['handoff.png'] },
  { file: '07-official', title: ['רשמי', '<em>ושקוף</em>'], sub: 'מחובר דרך ה-API הרשמי של Meta, בלי סיסמאות. כל שיחה מתחילה בגילוי שזו העוזרת הדיגיטלית שלך.', shots: ['setup.png'] },
  { file: '00-wide', theme: 'rose', wide: true, title: ['המעריצות שואלות.', 'קולי עונה, <em>בקול שלך.</em>'], sub: 'עוזרת AI להודעות הפרטיות באינסטגרם: לומדת את הקול שלך, מזהה קמפיינים, ומעבירה אלייך כשצריך.', shots: ['chat.png'] },
];

const css = `
:root { --bg:#f5f4f8; --glow:#fde3ec; --ink:#18151f; --muted:#5f596b; --accent:#e0306b; --accent-strong:#c41d57; --surface:#fff; }
* { box-sizing: border-box; margin: 0; }
body { width: var(--w); height: var(--h); overflow: hidden; direction: rtl; font-family: "Assistant", sans-serif; color: var(--ink);
  background: radial-gradient(900px 600px at 90% -10%, var(--glow), transparent 65%), radial-gradient(700px 500px at -10% 110%, #ece4ff, transparent 60%), var(--bg); }
.rose { --ink:#fff; --muted:rgb(255 255 255 / .86); background: radial-gradient(900px 700px at 85% -10%, #ff6f9c, transparent 60%), radial-gradient(800px 700px at 0% 110%, #a3134a, transparent 60%), #e0306b; }
.post { position: relative; height: 100%; padding: 76px 76px 0; display: grid; grid-template-rows: auto auto auto 1fr; gap: 26px; }
.brand { display: flex; align-items: center; gap: 14px; }
.logo { width: 64px; height: 64px; border-radius: 20px; background: var(--accent); display: grid; place-items: center; box-shadow: 0 10px 26px -10px rgb(224 48 107 / .7); }
.rose .logo { background: #fff; }
.bars { display: flex; gap: 4px; align-items: center; height: 28px; }
.bars i { width: 5px; border-radius: 4px; background: #fff; }
.rose .bars i { background: var(--accent); }
.bars i:nth-child(1){height:40%} .bars i:nth-child(2){height:85%} .bars i:nth-child(3){height:60%} .bars i:nth-child(4){height:100%} .bars i:nth-child(5){height:45%}
.word { font-family: "Fredoka", sans-serif; font-weight: 700; font-size: 44px; line-height: 1; }
h1 { font-family: "Fredoka", sans-serif; font-weight: 600; font-size: 92px; line-height: 1.04; letter-spacing: -0.02em; }
h1 span { display: block; }
h1 em { font-style: normal; color: var(--accent); }
.rose h1 em { color: #ffe1ea; text-decoration: underline; text-decoration-thickness: 6px; text-underline-offset: 14px; text-decoration-color: rgb(255 255 255 / .5); }
p.sub { font-size: 34px; line-height: 1.4; color: var(--muted); max-width: 26ch; font-weight: 600; }
.stage { position: relative; align-self: end; display: grid; gap: 22px; justify-items: center; margin-inline: -6px; }
.shot { width: 100%; border-radius: 30px; box-shadow: 0 2px 4px rgb(24 21 31 / .06), 0 40px 80px -30px rgb(60 20 45 / .45); background: #fff; overflow: hidden; border: 1px solid rgb(24 21 31 / .06); }
.shot img { display: block; width: 100%; }
.stage.bleed .shot:last-child { border-end-start-radius: 0; border-end-end-radius: 0; }
.stage.multi { align-self: center; gap: 0; }
.stage.multi .shot:first-child { width: 94%; justify-self: end; transform: rotate(1.2deg); position: relative; z-index: 1; }
.stage.multi .shot:last-child { width: 90%; justify-self: start; transform: rotate(-1.5deg); margin-top: -18px; border-radius: 30px; }
.wide .post { grid-template-columns: 1fr 1.05fr; }
.wide .stage { margin-top: 70px; }
.wide .post { grid-template-columns: 1fr 1fr; grid-template-rows: auto auto auto 1fr; column-gap: 60px; padding: 64px 70px 0; }
.wide .post > :not(.stage) { grid-column: 1; }
.wide .stage { grid-column: 2; grid-row: 1 / -1; align-self: start; margin-top: 40px; }
.wide h1 { font-size: 74px; }
.wide p.sub { font-size: 28px; }
`;

function page(p, shotSizes) {
  const [w, h] = p.wide ? [1600, 900] : [1080, 1350];
  const shots = p.shots.map((s) => `<div class="shot"><img src="file://${SHOTS}/${s}"></div>`).join('');
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Assistant:wght@400;600;700&display=swap">
<style>${css} body{--w:${w}px;--h:${h}px}</style></head>
<body class="${p.theme || ''} ${p.wide ? 'wide' : ''}"><div class="post">
<div class="brand"><span class="logo"><span class="bars"><i></i><i></i><i></i><i></i><i></i></span></span><span class="word">קולי</span></div>
<h1>${p.title.map((t) => `<span>${t}</span>`).join('')}</h1>
<p class="sub">${p.sub}</p>
<div class="stage ${p.shots.length > 1 ? 'multi' : 'bleed'}">${shots}</div>
</div></body></html>`;
}

(async () => {
  const b = await chromium.launch();
  for (const p of POSTS) {
    const [w, h] = p.wide ? [1600, 900] : [1080, 1350];
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const file = `${OUT}/${p.file}.html`;
    fs.writeFileSync(file, page(p));
    await pg.goto('file://' + file);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: `${OUT}/${p.file}.png` });
    await pg.close();
  }
  await b.close();
})();
