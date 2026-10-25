# תוכנית השקה — Paint Parade

## שלב 0 — לפני העלאה (שבוע 1)
- [ ] חשבונות: Apple Developer ($99/שנה), Google Play Console ($25), AdMob, RevenueCat (חינם עד $2.5K MTR).
- [ ] להחליף מזהי בדיקה למזהים אמיתיים (ראו `app/README.md` סעיף 3), ליצור את 8 המוצרים (סעיף 4).
- [ ] להעלות `privacy.html`, `terms.html` ו-`landing/` לכתובת ציבורית (GitHub Pages / Netlify — חינם).
- [ ] לחבר אנליטיקס: Firebase Analytics או GameAnalytics (חינם). המשחק כבר שולח את כל האירועים דרך `track()` ב-`js/platform.js` — מספיק להגדיר `window.ppAnalytics` או `gtag`.
- [ ] TestFlight + Internal testing ב-Google Play: 10–20 חברים, לבדוק רכישות בסביבת Sandbox ופרסומות בדיקה.

## שלב 1 — Soft launch (שבועות 2–5)
**מדינות:** קנדה, אוסטרליה, ניו זילנד (קהל דומה לארה"ב, CPI זול יותר), + פיליפינים לבדיקת רטנציה זולה.
**תקציב:** ~$50–100 ליום (Meta + TikTok + AppLovin/Unity Ads), מטרה: 3,000–5,000 התקנות.
**KPI לעבור לשלב הבא:**
| מדד | סף מינימום | יעד |
|---|---|---|
| D1 retention | 35% | 40%+ |
| D7 retention | 10% | 15%+ |
| זמן משחק ממוצע ביום | 15 דק' | 25 דק' |
| שלבים ליום ל-DAU | 8 | 12+ |
| צפיות Rewarded ל-DAU | 1.5 | 2.5+ |
| ARPDAU | $0.10 | $0.15+ |
| CPI (CA/AU) | < $1.50 | < $1.00 |

**מה מכווננים בשלב הזה (כולם קבועים במקום אחד בקוד; כדאי לחבר Firebase Remote Config כדי לשנות בלי עדכון גרסה):** `interstitialFromLevel`, `interstitialGapMs`, מחירי בוסטרים, `LIVES_FROM`, עוצמת הקושי של HARD/SUPER HARD (ב-`js/levels.js` ← `TARGET`).

## שלב 2 — השקה גלובלית (חודש 2)
- ארה"ב, בריטניה, גרמניה, יפן, קוריאה (לוקליזציה לגרמנית/יפנית/קוריאנית — פאזלים חזקים מאוד שם).
- סקייל UA ל-ROAS D7 ≥ 25% ו-ROAS D30 ≥ 60%.
- Apple "Today" featuring: לשלוח בקשה דרך App Store Connect → Featuring Nominations, 6–8 שבועות מראש.

## קריאייטיבים (הכי חשוב ל-UA)
הקריאייטיב מתיישן תוך ~5 ימים — מתכננים 10–15 גרסאות חדשות בשבוע.
1. **"Satisfying fill"** (30 שנ') — צילום מסך של שלב שמתמלא מאפור לצבע, בלי טקסט, מוזיקה טרנדית. הכי חזק לטיקטוק.
2. **"Fail ad"** — שחקן "טיפש" בוחר דלי לא נכון, מקומות ההמתנה מתמלאים... "Can you do better?". (Pixel Flow ו-Royal Match בנו על זה.)
3. **"Which bucket?"** — עצירה בנקודת החלטה עם 3 דליים מסומנים A/B/C → מעודד תגובות.
4. **Playable ad** (HTML5 קטן, < 5MB) — כבר כתוב ב-HTML5, אפשר לחתוך שלב אחד מהמשחק כמעט כמו שהוא. Playables מביאים ~4.8 IPM מול 2.9 לווידאו.
5. **ASMR** — זום על התזות + סאונד.
6. **Gallery reveal** — "60 ציורים מחכים לך" עם גלילה באלבום.

חומר גלם: `marketing/key-art.png`, `marketing/screenshots/`, `marketing/trailer.mp4`. אפשר להפיק עוד וריאציות וידאו בכלים כמו Higgsfield (המשחק כבר נבנה עם תמונות שנוצרו שם).

## רשתות חברתיות
- TikTok/Instagram Reels: 1 סרטון ביום בחודש הראשון (קליפים מהמשחק עצמו, "POV: you finally beat level 28").
- Reddit: r/incremental_games לא מתאים; כן r/AndroidGaming, r/iosgaming, r/pixelart (ציור השבוע).
- להשאיר Daily Canvas כ"תוכן חדש כל יום" לפוסטים.

## Live-ops (אחרי השקה)
- **כל שבועיים:** אלבום חדש (10 ציורים) — `js/art.js` + `node tools/build-levels.mjs`.
- **אירועי חג:** אלבום Halloween / Christmas / Valentine עם רקעים מיוחדים.
- **Season Pass ($4.99–9.99):** מסלול פרסים של 30 יום — זה מוצר ה-IAP השני הכי רווחי אצל Pixel Flow.
- **Team / Leaderboard:** תחרות ניקוד שבועית על הציור היומי.
