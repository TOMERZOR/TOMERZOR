import { html, icon } from "../ui.js";
import { href } from "../router.js";
import { CONFIG } from "../config.js";
import { findFit } from "../data/fits.js";
import { shot, fitImg, breadcrumbs } from "../components.js";
import { pageMeta } from "../seo.js";

function render() {
  const contact = CONFIG.contactEmail ? `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent("שיתוף פעולה עם FitSource")}` : null;
  return html`
  <div class="wrap">
    ${breadcrumbs(pageMeta("brands").breadcrumbs)}
    <section class="brand-hero">
      <div>
        <h1 class="display" style="font-size:clamp(2.2rem,4.4vw,3.9rem)">כל סריקה היא מישהו שמחפש את המוצר שלכם</h1>
      </div>
      <div>
        <p class="lede" style="margin-bottom:22px">אנשים מצלמים מסך של לוקים כל היום ולא יודעים מאיפה הפריטים. FitSource שולח אותם לחנות שמוכרת אותם, ומראה למותגים מה אנשים רוצים.</p>
        ${contact ? html`<a class="btn btn--accent" href="${contact}">${icon("megaphone")}דברו איתנו</a>` : html`<span class="muted">שיתופי פעולה עם מותגים ייפתחו בהשקה הרשמית.</span>`}
      </div>
    </section>

    <section class="brand-strip" aria-label="לוקים ששולחים קונים למותגים">
      ${["created-by-god", "shop-floor", "butter-hour"].map((id, i) => {
        const f = findFit(id);
        return html`<a href="${href(`fit/${id}`)}" class="brand-strip__item" data-reveal style="--d:${i}">${shot({ src: fitImg(f, true), alt: `${f.title}: ${f.items.map((x) => x.name).join(", ")}`, spots: f.items.map((x) => ({ x: x.x, y: x.y, label: x.brand ? `${x.brand}: ${x.name}` : x.name })) })}</a>`;
      })}
    </section>

    <section class="offers" aria-label="מה מותגים מקבלים">
      <div class="offer" data-reveal>${icon("seal-check")}<h2 class="h3">מקור מאומת</h2><p>אמתו את המוצרים שלכם, והחנות שלכם תופיע ראשונה עם תג אימות בכל פעם שאחד מהם נסרק.</p></div>
      <div class="offer" data-reveal style="--d:1">${icon("chart-line-up")}<h2 class="h3">ביקוש שרואים</h2><p>אילו פריטים נסרקים, מאילו לוקים, וכמה אנשים רצו אחד כשהוא אזל. מחדשים מלאי לפי מספרים, לא לפי תחושה.</p></div>
      <div class="offer" data-reveal style="--d:2">${icon("users-three")}<h2 class="h3">התאמה ליוצרים</h2><p>גלו אילו יוצרים ויוצרות מביאים סריקות לפריטים שלכם, והגיעו אליהם דרך תוכנית היוצרים.</p></div>
      <div class="offer" data-reveal style="--d:3">${icon("tag")}<h2 class="h3">הצגה כפריט דומה</h2><p>הופיעו כחלופה שיש במלאי כשפריט דומה אוזל. תמיד מסומן כממומן, ואף פעם לא מעורבב עם התאמות מדויקות.</p></div>
    </section>

    <section class="section">
      <h2 class="h2" data-reveal style="margin-bottom:28px">איך FitSource מרוויח, ונשאר בחינם</h2>
      <div class="money-flow">
        <div class="flow-step" data-reveal>${icon("scan")}<h3 class="h3">מישהו סורק לוק</h3><p>בחינם ובלי חשבון. סריקה מהירה רצה על הטלפון.</p></div>
        <div class="flow-step" data-reveal style="--d:1">${icon("storefront")}<h3 class="h3">FitSource מוצא את החנות</h3><p>קודם החנות המקורית, אחר כך חנויות נוספות, יד שנייה ופריטים דומים.</p></div>
        <div class="flow-step" data-reveal style="--d:2">${icon("shopping-bag")}<h3 class="h3">הקנייה נעשית בחנות</h3><p>במחיר הרגיל של החנות. החנות משלמת עמלת הפניה דרך רשתות שותפים.</p></div>
        <div class="flow-step" data-reveal style="--d:3">${icon("chart-line-up")}<h3 class="h3">המותגים מקבלים את הנתונים</h3><p>נתוני ביקוש וחשיפה הם מסלולים בתשלום למותגים. יוצרים מקבלים חלק מהעמלה שהלוקים שלהם מכניסים.</p></div>
      </div>
    </section>
  </div>`;
}

export default { render };
