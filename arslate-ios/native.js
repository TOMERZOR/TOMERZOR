// ערסלייט לאייפון: מה שיש רק באפליקציה. sync.mjs מעתיק את הקובץ ל-www ומחבר אותו לפני הסקריפט הראשי.
// הוא ממלא את window.ARSLATE_NATIVE, וה-index.html של האתר קורא לו בשלוש נקודות: רטט, ולפני כל תרגום AI.
//
// לפני תרגום AI:
//   1. פעם אחת: מסך הסכמה. הטקסט נשלח ל-Claude (Anthropic) דרך השרת שלנו. בלי הסכמה, הכל רץ במנוע המקומי.
//      (הנחיה 5.1.2(i) של אפל: חובה להגיד ולבקש רשות לפני ששולחים מידע של המשתמש ל-AI של צד שלישי.)
//   2. מכסה יומית חינמית (FREE_PER_DAY). כשהיא נגמרת: סרטון פרסומת קצר נותן עוד PER_AD תרגומים,
//      ואפשר תמיד לוותר ולהמשיך עם המנוע המקומי, שהוא בלי הגבלה.
//
// ההגדרות מגיעות מ-window.ARSLATE_NATIVE_CONFIG, ש-sync.mjs כותב (מזהי פרסומות, מכסות, מצב בדיקה).
(function () {
  "use strict";
  const Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  const P = Cap.Plugins || {};
  const CFG = Object.assign({ freePerDay: 5, perAd: 10, rewardedId: "", testing: true }, window.ARSLATE_NATIVE_CONFIG || {});
  const PRIVACY_URL = "https://tomerzor.github.io/TOMERZOR/arslate/privacy.html";

  /* ---------- רטט ---------- */
  function haptic(kind) {
    if (!P.Haptics) return;
    try {
      if (kind === "result") P.Haptics.impact({ style: "MEDIUM" });
      else P.Haptics.impact({ style: "LIGHT" });
    } catch (e) {}
  }

  /* ---------- מצב שמור ---------- */
  const today = () => new Date().toISOString().slice(0, 10);
  function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function quota() {
    const q = load("arslate.ai", null);
    return q && q.day === today() ? q : { day: today(), used: 0, bonus: 0 };
  }
  const left = (q) => CFG.freePerDay + q.bonus - q.used;

  /* ---------- גיליון תחתון, באותה שפה עיצובית של האתר ---------- */
  function sheet({ title, body, primary, secondary }) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.setAttribute("dir", "rtl");
      wrap.style.cssText = "position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;" +
        "background:rgba(14,17,22,.28);opacity:0;transition:opacity .25s cubic-bezier(.16,1,.3,1);";
      const card = document.createElement("div");
      card.style.cssText = "width:100%;max-width:560px;background:#fff;border-radius:32px 32px 0 0;" +
        "padding:28px 24px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px -20px rgba(30,60,110,.35);" +
        "transform:translateY(40px);transition:transform .45s cubic-bezier(.34,1.4,.64,1);font-family:inherit;color:#0E1116;";
      card.innerHTML =
        `<div style="font-weight:800;font-size:26px;letter-spacing:-.035em;line-height:1.15">${title}</div>` +
        `<div style="margin-top:10px;color:#4A5261;font-size:17px;line-height:1.5">${body}</div>` +
        `<button data-a="1" style="margin-top:22px;width:100%;height:56px;border:0;border-radius:999px;background:#0E1116;color:#fff;font:inherit;font-size:18px;font-weight:700">${primary}</button>` +
        (secondary ? `<button data-a="0" style="margin-top:8px;width:100%;height:50px;border:0;border-radius:999px;background:transparent;color:#4A5261;font:inherit;font-size:16px;font-weight:600">${secondary}</button>` : "");
      wrap.appendChild(card);
      document.body.appendChild(wrap);
      requestAnimationFrame(() => { wrap.style.opacity = "1"; card.style.transform = "none"; });
      const done = (v) => { wrap.style.opacity = "0"; card.style.transform = "translateY(40px)"; setTimeout(() => wrap.remove(), 260); resolve(v); };
      card.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { haptic("tap"); done(b.dataset.a === "1"); }));
      wrap.addEventListener("click", (e) => { if (e.target === wrap) done(false); });
    });
  }

  /* ---------- הסכמה לשליחה ל-AI ---------- */
  async function consent() {
    const c = load("arslate.aiConsent", null);
    if (c && c.ok) return true;
    if (c && !c.ok && Date.now() - c.at < 7 * 864e5) return false;   // ויתר: לא שואלים שוב שבוע
    const ok = await sheet({
      title: "תרגום חכם עם AI",
      body: "כדי לתרגם כמו ערס אמיתי, הטקסט שכתבת נשלח לשרת שלנו ומשם ל-Claude של Anthropic, רק כדי לנסח אותו מחדש. לא שומרים אותו עם הפרטים שלך. בלי זה האפליקציה עובדת עם המילון שבמכשיר. " +
        // אפל דורשת קישור למדיניות הפרטיות גם בתוך האפליקציה. קישור חיצוני נפתח ב-Safari.
        `<a href="${PRIVACY_URL}" style="color:#0E1116;font-weight:600">מדיניות הפרטיות</a>`,
      primary: "יאללה, מאשר",
      secondary: "רק המילון שבמכשיר",
    });
    save("arslate.aiConsent", { ok, at: Date.now() });
    return ok;
  }

  /* ---------- פרסומות (AdMob, Rewarded) ---------- */
  let adsReady = null, adLoaded = null;
  function startAds() {
    if (adsReady) return adsReady;
    const Ad = P.AdMob;
    if (!Ad || !CFG.rewardedId) return (adsReady = Promise.resolve(false));
    adsReady = (async () => {
      try {
        let info = null;
        try {                                                          // GDPR (Google UMP)
          info = await Ad.requestConsentInfo();
          if (info.isConsentFormAvailable && info.status === "REQUIRED") info = await Ad.showConsentForm();
        } catch (e) {
          // נכשל כשאין טופס הסכמה מוגדר ב-AdMob (Privacy & messaging) או בלי רשת.
          // לא חוסמים בגלל זה: מחוץ לאירופה לא צריך הסכמה, ו-Google מחליטה בעצמה מה מותר להציג.
          info = null;
        }
        if (info && info.canRequestAds === false) { adsReady = null; return false; }
        try {                                                          // App Tracking Transparency, רק כשצריך פרסומת
          const st = await Ad.trackingAuthorizationStatus();
          if (st && st.status === "notDetermined") await Ad.requestTrackingAuthorization();
        } catch (e) {}
        await Ad.initialize({ initializeForTesting: !!CFG.testing });
        return true;
      } catch (e) { adsReady = null; return false; }                   // ננסה שוב בפעם הבאה
    })();
    return adsReady;
  }
  function preload() {
    if (adLoaded) return adLoaded;
    adLoaded = startAds().then((ok) => ok && P.AdMob.prepareRewardVideoAd({ adId: CFG.rewardedId, isTesting: !!CFG.testing }).then(() => true))
      .catch(() => false);
    adLoaded.then((ok) => { if (!ok) adLoaded = null; });
    return adLoaded;
  }
  // "ok" = צפה עד הסוף וקיבל את הפרס, "cancel" = סגר לפני הסוף, "fail" = לא היה סרטון להציג
  async function watchAd() {
    if (!(await preload())) return "fail";
    adLoaded = null;
    try { await P.AdMob.showRewardVideoAd(); return "ok"; }
    catch (e) { return e && e.code === "REWARDED_AD_CANCELLED" ? "cancel" : "fail"; }
    finally { setTimeout(preload, 1500); }
  }

  /* ---------- השער לפני כל תרגום AI ---------- */
  async function beforeAI() {
    if (!(await consent())) return false;
    let q = quota();
    if (left(q) <= 1) preload();                                       // מחממים פרסומת לפני שהמכסה נגמרת
    if (left(q) <= 0) {
      const want = await sheet({
        title: "נגמרו התרגומים החכמים להיום",
        body: `סרטון קצר נותן עוד ${CFG.perAd} תרגומים עם AI. המילון שבמכשיר ממשיך לעבוד בלי הגבלה.`,
        primary: `צפייה בסרטון, ועוד ${CFG.perAd}`,
        secondary: "להמשיך עם המילון",
      });
      if (!want) return false;
      let watched = await watchAd();
      if (watched === "fail") watched = await watchAd();               // עוד ניסיון אחד: לפעמים הטעינה הראשונה נופלת
      if (watched === "cancel") return false;                          // סגר לפני הסוף: בלי פרס
      if (watched === "fail") {
        // אין סרטון להציג: אפליקציה חדשה ש-AdMob עוד לא אישר, חוסם פרסומות, רשת חלשה.
        // זו לא אשמת המשתמש, אז נותנים את התרגומים בכל זאת. השרת עדיין מגביל ל-DAILY_LIMIT ביום לכל IP.
        await sheet({
          title: "אין סרטון כרגע",
          body: `הפעם עלינו. קיבלת עוד ${CFG.perAd} תרגומים חכמים.`,
          primary: "יאללה",
        });
      }
      q = quota(); q.bonus += CFG.perAd;
    }
    q.used += 1;
    save("arslate.ai", q);
    return true;
  }

  window.ARSLATE_NATIVE = { haptic, beforeAI };
})();
