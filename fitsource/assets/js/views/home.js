import { html, icon, reduceMotion } from "../ui.js";
import { FITS, findFit } from "../data/fits.js";
import { shot, feedTag, card, fitImg } from "../components.js";
import { startScan } from "../state.js";
import { deepScanStatus } from "../scan/engine.js";
import { warmUp } from "../scan/ondevice.js";
import { CONFIG } from "../config.js";

const DEMO_FIT = "night-shift";
const SAMPLES = ["slab-day", "butter-hour", "trail-mix"];

function render() {
  const demo = findFit(DEMO_FIT);
  const trending = [...FITS].sort((a, b) => b.scans - a.scans).slice(0, 8);
  const soldItem = demo.items.find((i) => i.status === "sold_out");
  const tm = findFit("trail-mix");
  return html`
  <section class="hero">
    <div class="wrap hero__grid">
      <div>
        <h1 class="display hero__title">
          <span class="line"><span style="--d:0">מוצאים את החנות</span></span>
          <span class="line"><span style="--d:1">מאחורי <span class="hl">כל לוק</span></span></span>
        </h1>
        <p class="lede">צילום מסך מכל מקום מספיק. אנחנו מזהים כל פריט, מוצאים איפה הוא נמכר ומסמנים מה אזל מהמלאי.</p>
        <div class="drop" data-drop>
          <div class="drop__row">
            <label class="btn btn--accent">
              ${icon("upload-simple")}בחרו תמונה
              <input type="file" accept="image/*" class="sr-only" data-file>
            </label>
            <span class="drop__hint">או גררו לכאן, או הדביקו עם <kbd dir="ltr">Ctrl V</kbd></span>
          </div>
          <p class="drop__error" role="alert" data-error></p>
          <div class="drop__samples">
            <span>אין תמונה? נסו דוגמה:</span>
            ${SAMPLES.map((id) => {
              const f = findFit(id);
              return html`<button type="button" class="sample" data-sample="${id}" aria-label="סריקת תמונת הדוגמה ${f.title}"><img src="${fitImg(f, true)}" alt="" loading="lazy"></button>`;
            })}
            <span class="engine-note" data-engine>${icon("lock-simple")}<span>סריקה מהירה רצה על המכשיר שלכם. התמונה לא עולה לשום מקום.</span></span>
          </div>
        </div>
      </div>
      <div class="demo" data-demo>
        ${shot({
          src: fitImg(demo),
          alt: `${demo.title}: ${demo.items.map((i) => i.name).join(", ")}`,
          spots: demo.items.map((i) => ({ x: i.x, y: i.y, label: i.name, sold: i.status === "sold_out" })),
          eager: true,
          cls: "demo__shot",
        })}
        <div class="demo__tag" data-demo-tag>${feedTag(demo.items[0], 0, { fitId: demo.id, mini: true })}</div>
        <div class="demo__caption"><span>${demo.title} של <bdi>@${demo.handle}</bdi></span><a href="#/fit/${demo.id}">לפתיחת הלוק ${icon("arrow-right")}</a></div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="section__head">
        <h2 class="h2" data-reveal>חם עכשיו</h2>
        <a class="link-arrow" href="#/feed" data-reveal>לפיד המלא ${icon("arrow-right")}</a>
      </div>
      <div class="rail">${trending.map((f, i) => card(f, { delay: i }))}</div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section__head"><h2 class="h2" data-reveal>מצילום מסך<br>עד לקופה</h2></div>
      <div class="bento">
        <div class="cell cell--a" data-reveal>
          <h3 class="cell__big">כל פריט, עם מקור</h3>
          <p>FitSource קורא את התמונה, מזהה כל פריט ומחפש את המקור בחנויות. סריקה מעמיקה גם בודקת את המלאי בכל חנות שהיא מוצאת.</p>
          <div class="cell__visual">
            ${shot({ src: fitImg(tm, true), alt: `${tm.title} בסריקה`, spots: tm.items.map((i) => ({ x: i.x, y: i.y, label: i.name, sold: i.status === "sold_out" })) })}
            <div class="log" data-demo-log aria-hidden="true"></div>
          </div>
        </div>
        <div class="cell cell--b" data-reveal style="--d:1">
          <h3 class="cell__big">כל צילום מסך עובד</h3>
          <p>טיקטוק, אינסטגרם, פינטרסט, סטורי של חברה. אם רואים את הלוק, אפשר לסרוק אותו.</p>
          <div class="shots-row" aria-hidden="true">${["varsity-rewind", "linen-season", "shop-floor"].map((id) => html`<img src="${fitImg(findFit(id), true)}" alt="" loading="lazy">`)}</div>
        </div>
        <div class="cell cell--c" data-reveal style="--d:2">
          ${icon("lock-simple")}
          <h3 class="h3">התמונה נשארת שלכם</h3>
          <p>סריקה מהירה רצה ישירות בדפדפן. שום דבר לא עולה ושום דבר לא נשמר.</p>
          <div class="ledger" aria-hidden="true"><div>העלאת התמונה<b>אף פעם</b></div><div>רץ על<b>המכשיר שלכם</b></div><div>צריך חשבון<b>לא</b></div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap split">
      <div class="split__visual" data-reveal>
        ${feedTag(soldItem, 0, { fitId: demo.id, mini: true })}
        ${feedTag({ ...soldItem, id: "demo-resale", brand: "מודעת יד שנייה", name: soldItem.name + ", נלבש פעמיים", price: soldItem.resale, status: "in_stock" }, 1, { mini: true })}
        ${feedTag(findFit("null-signal").items[0], 2, { mini: true })}
      </div>
      <div>
        <h2 class="h2" data-reveal>אזל מהמלאי?<br>זה לא הסוף</h2>
        <ul class="points">
          <li data-reveal style="--d:1"><span class="ico">${icon("bell")}</span><div><strong>התראות חזרה למלאי</strong><span>עקבו אחרי פריט שאזל. FitSource בודק את החנות ומעדכן אתכם כשהוא חוזר.</span></div></li>
          <li data-reveal style="--d:2"><span class="ico">${icon("recycle")}</span><div><strong>יד שנייה, בלחיצה אחת</strong><span>קפיצה ישירה לאותו פריט באתרי יד שנייה, בארץ ובעולם.</span></div></li>
          <li data-reveal style="--d:3"><span class="ico">${icon("tag")}</span><div><strong>דומים שיש במלאי</strong><span>התאמות קרובות בטווחי מחיר אחרים, כך שהלוק תמיד בהישג יד.</span></div></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="band" data-reveal>
        <div>
          <h2 class="h2">בחינם בשבילכם.<br>וזה הדיל.</h2>
        </div>
        <div>
          <p>חנויות משלמות ל־FitSource עמלה קטנה כשקונים דרך חלק מהקישורים שלנו. אתם משלמים אותו מחיר, וזה אף פעם לא משנה מה אנחנו מראים לכם. מותגים יכולים גם לנהל את המוצרים שלהם ולראות מה אנשים מחפשים.</p>
          <div class="band__actions">
            <a class="btn btn--accent" href="#/feed">${icon("squares-four")}לפיד</a>
            <a class="btn btn--ghost" href="#/brands">למותגים</a>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

const LOG_LINES = [
  ["קורא", "4 פריטים בתמונה"],
  ["מחפש", "מעיל של 3 שכבות בצבע זית"],
  ["פותח", "northpine.com"],
  ["מלאי", "Ridge 3L Shell: במלאי"],
  ["מחפש", "מכנסי דגמ\"ח ניילון בז'"],
  ["מלאי", "Trail Cargo: אזל"],
  ["יד 2", "נמצא ב־eBay מ־₪290"],
];

function mount(root) {
  const timers = [];
  const errorEl = root.querySelector("[data-error]");
  const fileInput = root.querySelector("[data-file]");
  const drop = root.querySelector("[data-drop]");

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) startScan(f);
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("is-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", () => drop.classList.remove("is-over"));
  // The model is fetched only once someone shows intent to scan.
  if (!CONFIG.scanDisabledMessage) drop.addEventListener("pointerdown", () => deepScanStatus().then((d) => d || warmUp()), { once: true });

  root.querySelectorAll("[data-sample]").forEach((b) =>
    b.addEventListener("click", async () => {
      errorEl.textContent = "";
      try {
        const fit = findFit(b.dataset.sample);
        const res = await fetch(fitImg(fit));
        const blob = await res.blob();
        startScan(new File([blob], `${fit.id}.jpg`, { type: "image/jpeg" }));
      } catch {
        errorEl.textContent = "לא הצלחנו לטעון את הדוגמה. בדקו את החיבור ונסו שוב.";
      }
    }),
  );

  deepScanStatus().then((deep) => {
    const note = root.querySelector("[data-engine] span");
    if (CONFIG.scanDisabledMessage && note) note.textContent = CONFIG.scanDisabledMessage;
    else if (deep && note) note.textContent = "סריקה מעמיקה פעילה: חנויות מדויקות ומלאי בזמן אמת.";
  });

  // ---- hero demo: walk through the pieces one by one ----
  const demo = root.querySelector("[data-demo]");
  const fit = findFit(DEMO_FIT);
  const tagBox = root.querySelector("[data-demo-tag]");
  const spots = [...demo.querySelectorAll(".hotspot")];
  let active = 0;
  let paused = false;
  const show = (i) => {
    active = i;
    spots.forEach((s, k) => s.classList.toggle("is-active", k === i));
    tagBox.classList.add("is-swap");
    timers.push(
      setTimeout(() => {
        tagBox.innerHTML = feedTag(fit.items[i], i, { fitId: fit.id, mini: true }).s;
        tagBox.classList.remove("is-swap");
      }, reduceMotion() ? 0 : 260),
    );
  };
  spots.forEach((s, i) =>
    s.addEventListener("click", () => {
      paused = true;
      show(i);
    }),
  );
  demo.addEventListener("pointerenter", () => (paused = true));
  demo.addEventListener("pointerleave", () => (paused = false));
  if (!reduceMotion()) {
    const iv = setInterval(() => {
      if (!paused && !document.hidden) show((active + 1) % spots.length);
    }, 2800);
    timers.push({ iv });
  }
  spots[0] && spots[0].classList.add("is-active");

  // ---- bento log: lines print like a receipt ----
  const log = root.querySelector("[data-demo-log]");
  let n = 0;
  const printLine = () => {
    const [k, v] = LOG_LINES[n % LOG_LINES.length];
    const line = document.createElement("div");
    line.className = "log__line";
    line.innerHTML = html`<span class="k">${k}</span><bdi>${v}</bdi>`.s;
    log.appendChild(line);
    while (log.children.length > 6) log.firstElementChild.remove();
    n++;
  };
  if (reduceMotion()) for (let k = 0; k < 6; k++) printLine();
  else {
    printLine();
    const iv2 = setInterval(() => !document.hidden && printLine(), 1400);
    timers.push({ iv: iv2 });
  }

  return () => timers.forEach((t) => (t && t.iv ? clearInterval(t.iv) : clearTimeout(t)));
}

export default { render, mount };
