// Step-by-step guide to connecting Koli to Instagram. Steps that happen in
// Koli show real screenshots (img/guide/); steps on Meta, GitHub and the
// Instagram app show a labelled illustration of where to click, because
// those screens sit behind the creator's own login.

import { h, toast, copyText } from "../dom.js";
import { store } from "../store.js";

const STEPS = [
  {
    id: "pro",
    title: "להפוך את החשבון באינסטגרם לחשבון מקצועי",
    time: "2 דקות",
    body: [
      "באפליקציית אינסטגרם: פרופיל ← תפריט ☰ ← הגדרות ופעילות.",
      "גוללים ל״סוג חשבון וכלים״ ← ״מעבר לחשבון מקצועי״.",
      "בוחרים ״יוצר/ת תוכן״ (Creator) או ״עסק״ (Business). שניהם עובדים עם קולי.",
    ],
    tip: "כבר יש לך חשבון מקצועי? מדלגים לשלב הבא.",
    mock: { kind: "phone", title: "סוג חשבון וכלים", rows: [{ t: "סוג חשבון: אישי" }, { t: "מעבר לחשבון מקצועי", target: "לוחצים כאן" }, { t: "הוספת חשבון מקצועי חדש" }] },
  },
  {
    id: "dev",
    title: "לפתוח חשבון מפתחים ב-Meta",
    time: "3 דקות",
    body: [
      "נכנסים ל-developers.facebook.com ומתחברים עם חשבון הפייסבוק.",
      "לוחצים ״Get Started״ ומאשרים את התנאים. אם מבקשים, מאמתים טלפון או מייל.",
    ],
    tip: "זה חינם, ולא צריך לדעת לתכנת.",
    mock: { kind: "browser", url: "developers.facebook.com", title: "Meta for Developers", rows: [{ t: "Docs · Tools · Support" }, { t: "Get Started", target: "לוחצים כאן", button: true }] },
  },
  {
    id: "app",
    title: "ליצור אפליקציה",
    time: "3 דקות",
    body: [
      "בתפריט העליון: ״My Apps״ ← ״Create App״.",
      "בוחרים את מקרה השימוש של אינסטגרם לניהול הודעות ותוכן. אם שואלים על סוג אפליקציה, בוחרים ״Business״.",
      "נותנים שם (למשל ״Koli של מאיה״), מייל, ולוחצים ״Create app״.",
    ],
    tip: "Meta משנה מדי פעם את שמות הכפתורים. אם משהו נראה אחרת, חפשו את האפשרות שמזכירה Instagram ו-messaging.",
    mock: { kind: "browser", url: "developers.facebook.com/apps", title: "Create an app", rows: [{ t: "Add use cases" }, { t: "Manage messaging & content on Instagram", target: "בוחרים את זה" }, { t: "Other" }, { t: "Next", button: true }] },
  },
  {
    id: "secret",
    title: "להעתיק את ה-App Secret של אינסטגרם",
    time: "דקה",
    body: [
      "בלוח האפליקציה: Instagram ← ״API setup with Instagram login״ (לא האפשרות עם Facebook Login).",
      "מעתיקים את ״Instagram app secret״ (לוחצים Show). זה ה-IG_APP_SECRET.",
    ],
    warn: "הסוד הזה הוא כמו סיסמה. לא שולחים אותו לאף אחד ולא מדביקים אותו באפליקציית קולי, רק בהגדרות השרת (שלב 6).",
    mock: { kind: "browser", url: "developers.facebook.com/apps/…/instagram", title: "API setup with Instagram login", rows: [{ t: "Instagram app ID   1234567890" }, { t: "Instagram app secret   ••••••••   Show", target: "מעתיקים" }] },
  },
  {
    id: "token",
    title: "לחבר את החשבון ולקבל Access Token",
    time: "2 דקות",
    body: [
      "באותו מסך, באזור ״Generate access tokens״, לוחצים ״Add account״.",
      "מתחברים לחשבון האינסטגרם המקצועי בחלון שנפתח ומאשרים את ההרשאות, כולל הודעות.",
      "לוחצים ״Generate token״ ליד החשבון ומעתיקים. זה ה-IG_ACCESS_TOKEN.",
    ],
    tip: "ההרשאות שצריך: instagram_business_basic ו-instagram_business_manage_messages. ה-token בתוקף 60 יום, ואפשר לחדש אותו.",
    mock: { kind: "browser", url: "developers.facebook.com/apps/…/instagram", title: "Generate access tokens", rows: [{ t: "Add account", target: "1. מחברים", button: true }, { t: "@maya.style   Generate token", target: "2. מעתיקים" }] },
  },
  {
    id: "deploy",
    title: "להעלות את השרת של קולי",
    time: "10 דקות",
    body: [
      "ב-GitHub, בריפו של קולי: Settings ← Secrets and variables ← Actions ← ״New repository secret״.",
      "מוסיפים אחד-אחד: ANTHROPIC_API_KEY (מ-console.anthropic.com), CLOUDFLARE_API_TOKEN (מ-Cloudflare, תבנית ״Edit Cloudflare Workers״), KOLI_ADMIN_TOKEN (מחרוזת אקראית ארוכה שתמציאו), IG_APP_SECRET ו-IG_ACCESS_TOKEN משלבים 4 ו-5, ו-IG_VERIFY_TOKEN (מילה שתבחרו, למשל koli-maya-2026).",
      "בלשונית Actions בוחרים ״Deploy Koli API״ ← ״Run workflow״. בסוף הריצה מופיעה כתובת שמסתיימת ב-workers.dev. מעתיקים אותה.",
    ],
    tip: "מומלץ להגדיר ב-console.anthropic.com תקרת הוצאה חודשית.",
    mock: { kind: "browser", url: "github.com/…/settings/secrets/actions", title: "Actions secrets", rows: [{ t: "ANTHROPIC_API_KEY ✓" }, { t: "KOLI_ADMIN_TOKEN ✓" }, { t: "IG_ACCESS_TOKEN ✓" }, { t: "New repository secret", target: "מוסיפים כל סוד", button: true }] },
  },
  {
    id: "koli",
    title: "לחבר את קולי לשרת",
    time: "דקה",
    body: [
      "בקולי, בלשונית ״חיבור לאינסטגרם״: מדביקים את כתובת השרת ואת ה-KOLI_ADMIN_TOKEN, ולוחצים ״שמירה ובדיקה״.",
      "כשמצב החיבור מראה ״אינסטגרם: מחובר״, לוחצים ״שליחת ההגדרות לשרת״. מעכשיו השרת עונה בקול, באופי ובקמפיינים שהגדרת.",
    ],
    tip: "אחרי כל שינוי בקול, באופי או בקמפיינים, לוחצים שוב ״שליחת ההגדרות לשרת״.",
    shot: "connect-server.png",
  },
  {
    id: "webhook",
    title: "לחבר את ה-Webhook",
    time: "2 דקות",
    body: [
      "ב-Meta, במסך ״API setup with Instagram login״, באזור ״Configure webhooks״.",
      "Callback URL: מדביקים את הכתובת שקולי מציגה (ממש כאן למטה).",
      "Verify token: אותה מילה שהגדרתם ב-IG_VERIFY_TOKEN. לוחצים ״Verify and save״.",
      "ברשימת השדות מפעילים ״Subscribe״ ליד messages.",
    ],
    copyWebhook: true,
    mock: { kind: "browser", url: "developers.facebook.com/apps/…/instagram", title: "Configure webhooks", rows: [{ t: "Callback URL   https://koli-api…/webhook/instagram", field: true }, { t: "Verify token   koli-maya-2026", field: true }, { t: "Verify and save", target: "1", button: true }, { t: "messages   Subscribe", target: "2" }] },
  },
  {
    id: "allow",
    title: "לאפשר גישה להודעות באינסטגרם",
    time: "דקה",
    body: [
      "באפליקציית אינסטגרם, בחשבון המקצועי: הגדרות ופעילות ← הודעות ותגובות לסטוריז ← בקרת הודעות.",
      "תחת ״כלים מחוברים״ מפעילים ״אפשר גישה להודעות״.",
    ],
    tip: "לא מוצאים? מחפשים ״גישה להודעות״ בשורת החיפוש של ההגדרות.",
    mock: { kind: "phone", title: "כלים מחוברים", rows: [{ t: "אפשר גישה להודעות", target: "מפעילים", toggle: true }] },
  },
  {
    id: "test",
    title: "לבדוק עם חשבון בודק",
    time: "5 דקות",
    body: [
      "ב-Meta: App roles ← Roles ← ״Add people״ ← Instagram Tester, ומזינים שם משתמש של חשבון אחר (למשל של חבר/ה).",
      "בחשבון הבודק באינסטגרם מאשרים את ההזמנה (הגדרות ← הרשאות לאתרים ← אפליקציות ואתרים ← הזמנות לבודקים).",
      "שולחים מהחשבון הבודק הודעה לחשבון שלך, למשל תגובה לסטורי. היא מופיעה בקולי, ב״שיחות אמיתיות מאינסטגרם״, עם טיוטה לאישור.",
    ],
    shot: "real-inbox.png",
  },
  {
    id: "review",
    title: "לפתוח לכל העוקבים (App Review)",
    time: "כמה ימים עד שבועות",
    body: [
      "עד עכשיו קולי עונה רק לחשבונות בודקים. כדי לענות לכל העוקבים, מגישים ב-Meta בקשה להרשאה instagram_business_manage_messages ב-Advanced Access.",
      "צריך: קישור למדיניות פרטיות, הסבר קצר איך האפליקציה משתמשת בהודעות, וסרטון מסך שמראה הודעה נכנסת ותשובה של קולי. ייתכן שיבקשו גם אימות עסק.",
      "אחרי האישור מעבירים את האפליקציה ל-Live, וזהו.",
    ],
    tip: "בסרטון כדאי להראות את סימון ה-AI בתשובה ואת המעבר אלייך בשאלות רגישות. זה בדיוק מה ש-Meta בודקת.",
  },
];

function done() {
  return new Set(store.settings.guideDone || []);
}

function toggleDone(id) {
  const d = done();
  d.has(id) ? d.delete(id) : d.add(id);
  store.settings.guideDone = [...d];
  store.saveSettings();
}

function webhookUrl() {
  const base = (store.settings.apiBase || "https://YOUR-SERVER.workers.dev").replace(/\/+$/, "");
  return `${base}/webhook/instagram`;
}

/** A drawn illustration of a screen the creator will see, with the target marked. */
function mock(m) {
  const frame = m.kind === "phone" ? "mock phone" : "mock browser";
  return h(
    "figure",
    { class: frame },
    m.kind === "browser"
      ? h("div", { class: "bar" }, h("i"), h("i"), h("i"), h("span", { class: "url" }, m.url))
      : h("div", { class: "notch" }),
    h(
      "div",
      { class: "screen" },
      h("p", { class: "mtitle" }, m.title),
      m.rows.map((r) =>
        h(
          "div",
          { class: `mrow${r.button ? " button" : ""}${r.field ? " field" : ""}${r.target ? " target" : ""}` },
          h("span", {}, r.t),
          r.toggle && h("span", { class: "mtoggle", "aria-hidden": "true" }),
          r.target && h("b", { class: "callout" }, r.target),
        ),
      ),
    ),
    h("figcaption", {}, "איור להמחשה, לא צילום מסך. המסך האמיתי יכול להיראות קצת אחרת."),
  );
}

function shot(file) {
  return h("figure", { class: "shot-real" }, h("a", { href: `img/guide/${file}`, target: "_blank", rel: "noopener" }, h("img", { src: `img/guide/${file}`, alt: "צילום מסך מקולי", loading: "lazy" })), h("figcaption", {}, "צילום מסך מקולי. לחיצה פותחת בגודל מלא."));
}

export function renderGuide(root, rerender) {
  const d = done();
  const count = STEPS.filter((s) => d.has(s.id)).length;
  root.append(
    h(
      "section",
      { class: "card guide-head" },
      h("header", {}, h("h2", {}, "מחברים את קולי לאינסטגרם"), h("span", { class: "mono quiz-count" }, `${count}/${STEPS.length}`), h("p", {}, "11 שלבים, בערך חצי שעה, ובלי לכתוב קוד. החיבור הוא דרך ה-API הרשמי של Meta: בלי סיסמאות ובלי סיכון לחשבון. סמנו כל שלב שסיימתם, וההתקדמות נשמרת.")),
      h("div", { class: "quiz-progress", "aria-hidden": "true" }, h("span", { class: "fill", style: `transform: scaleX(${count / STEPS.length})` })),
      h("div", { class: "row" }, h("button", { type: "button", class: "btn quiet small", onclick: () => window.dispatchEvent(new CustomEvent("koli:tab", { detail: "connect" })) }, "חזרה ללשונית החיבור")),
    ),
    h(
      "ol",
      { class: "guide" },
      STEPS.map((s, i) => {
        const isDone = d.has(s.id);
        const copyBtn = s.copyWebhook && h("button", { type: "button", class: "btn quiet small" }, "העתקה");
        copyBtn?.addEventListener("click", () => copyText(webhookUrl(), copyBtn));
        return h(
          "li",
          { class: `gstep${isDone ? " done" : ""}`, id: `step-${s.id}` },
          h("span", { class: "gnum", "aria-hidden": "true" }, isDone ? "✓" : String(i + 1)),
          h(
            "div",
            { class: "gbody card" },
            h("header", {}, h("h3", {}, s.title), h("span", { class: "chip" }, s.time)),
            h(
              "div",
              { class: "gcols" },
              h(
                "div",
                { class: "gtext" },
                h("ol", { class: "gsub" }, s.body.map((b) => h("li", {}, b))),
                s.copyWebhook && h("div", { class: "copy" }, h("code", {}, webhookUrl()), copyBtn),
                s.tip && h("p", { class: "gtip" }, s.tip),
                s.warn && h("p", { class: "gwarn" }, s.warn),
                h("label", { class: "switch" }, h("input", { type: "checkbox", id: `gdone-${s.id}`, checked: isDone, onchange: () => { toggleDone(s.id); if (!isDone) toast(i === STEPS.length - 1 ? "סיימת! קולי עונה עכשיו לכל העוקבים" : "מעולה, ממשיכים"); rerender(); } }), "סיימתי את השלב הזה"),
              ),
              (s.shot || s.mock) && h("div", { class: "gvisual" }, s.shot && shot(s.shot), s.mock && mock(s.mock)),
            ),
          ),
        );
      }),
    ),
  );
}
