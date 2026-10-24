# מחקר שוק — איפה הכסף הגדול במובייל (אוקטובר 2026)

## השורה התחתונה
1. **Puzzle הוא הז'אנר הכי חזק במובייל ב-2026.** כ-$4.9B הוצאות שחקנים ב-H1 2026 (AppMagic), 44% מכל ה-casual. Match-3 עדיין הכי גדול ($2.5B) אבל רווי ולא צומח.
2. **הצמיחה האמיתית: Hybrid-casual puzzle** (~$2.4B, +23%). מנועי הצמיחה: **Sort, Screw, Block**. סאב-ז'אנר ה-Sort דווח בצמיחה של מאות אחוזים.
3. **Pixel Flow! (Loom Games, טורקיה, ~10 עובדים)** — יצא באוגוסט 2025 בלי מו"ל, עבר $100M IAP בפחות משנה, דווח על 7 ספרות ביום. המכניקה: יורים צבעוניים על מסוע סביב תמונת פיקסלים, כל יורה פוגע רק בפיקסלים בצבע שלו, 5 משבצות המתנה. איטרציה על This is Blast! של Voodoo. **זה ההוכחה הכי חזקה שצוות קטן עם מכניקה אחת מבריקה יכול להכות.**
4. **Block Blast!** — המשחק הכי מורד של 2025 (~368M הורדות), המרוויח #1 מפרסומות (~$127M בינואר-מאי 2026). כמעט 100% פרסומות. אבל: 2,000+ שיבוטים יצאו בחצי שנה — אוקיינוס אדום.
5. **Arrow tap-away (Arrows – Puzzle Escape)** — #1 בהורדות במאי-יוני 2026, בעיקר בזכות UA בתשלום. מונטיזציה חלשה יחסית, תלונות על עומס פרסומות.
6. **צביעה לפי מספרים** — ~30M הורדות בחודש, קהל מבוגרים שמחפש רוגע, מונטיזציה בעיקר IAP. ז'אנר "שקט" ש-plateau-ed: הקהל קיים ומחפש חידוש.

## מודל מונטיזציה — מה עובד
- ב-Hybrid-casual puzzle: **~59% IAP / 41% פרסומות** (Sensor Tower State of Gaming 2026). היברידי מנצח.
- ARPDAU טיפוסי: hybrid-casual $0.15–$0.50 מול hyper-casual $0.03–$0.08.
- דפוס Pixel Flow: Rewarded "x2 מטבעות" מרמה 10, Interstitial כפוי רק מרמה 20, Fail-offer (המשך בתשלום/בפרסומת), **No Ads $8.99** ו-**Pass $9.99** — שני מוצרי החנות המרכזיים.
- דפוס Arrows: hint ב-rewarded רק אחרי שהשחקן נתקע — מרגיש כמו עזרה, לא כמו הפרעה. עומס פרסומות = ביקורות רעות (17/100 מול 60/100 אצל מתחרה).

## בנצ'מרקים (טווחים, מקורות סותרים)
| מדד | חציון | יעד "מוכן למו"ל" | Best-in-class |
|---|---|---|---|
| D1 retention | ~22–30% | 35–40% | 45%+ |
| D7 retention | ~4–12% | 10–15% | 20–25%+ |
| CPI US (puzzle) | $0.80–$3.50 | | |
UA מתחיל להחזיר את עצמו בערך ב-D7 ≈ 18% ב-hybrid-casual.

## שיווק — מה עובד ב-2026
- **Playable ads** מנצחים: ~4.8 IPM מול 2.9 בווידאו. חיי קריאייטיב < 5 ימים — צריך הרבה גרסאות מהר.
- מכניקה אחת ברורה שמובנת בשנייה ("rule in one glance") + מסך סיום מספק.
- מכניקה > הבטחה. פאזלים עם תמונה שנחשפת/מתמלאת = תוכן ויזואלי מושלם לטיקטוק.

## ההחלטה: מה בונים
**PAINT PARADE** — פאזל יורים-צבעוניים על מסוע (המכניקה המוכחת הכי רווחית של השנה) עם טוויסט מהותי:
**במקום להרוס תמונה — מציירים אותה.** הקנבס מתחיל אפור (כמו צביעה-לפי-מספרים), ודליי צבע חמודים צועדים במצעד סביבו ומתיזים צבע על המשבצות התואמות. כל שלב נגמר ביצירת אמנות צבעונית שנכנסת לאלבום.

למה זה המהלך הנכון:
- **מכניקה מוכחת** ($100M+ בפחות משנה) → סיכון מוצר נמוך.
- **בידול אמיתי**: ההדרגה "אפור ← צבע" היא תגמול רגשי חזק יותר מ"תמונה ← כלום", ומושכת גם את קהל הצביעה (30M הורדות/חודש) — לא רק את קהל ה-hybrid-casual.
- **אלבום אוסף** = meta loop טבעי (השלמת אוספים → רטנציה, כמו מדבקות ב-Monopoly Go).
- **קריאייטיב שיווקי מובנה**: כל שלב הוא סרטון "satisfying" שמתמלא בצבע.
- **ביצוע**: HTML5 Canvas דטרמיניסטי → אפשר לבנות בוט שמאמת שכל שלב פתיר ומודד קושי.

## מקורות
- [AppMagic Casual Report H1 2026](https://appmagic.rocks/research/casual-report-H12026) · [PocketGamer.biz: Puzzle 44% of casual](https://www.pocketgamer.biz/puzzle-accounts-for-44-of-casual-mobile-earnings-in-h1-2026/) · [Mobidictum H1 2026](https://mobidictum.com/casual-games-mobile-marketing-report-h1-2026/)
- [Singular: Top mobile games 2026](https://www.singular.net/blog/top-mobile-games/) · [Anahata: Hybrid-casual 2026](https://anahatainteractive.com/blog/hybrid-casual-pulling-ahead-2026)
- [Udonis: Block Blast stats](https://www.blog.udonis.co/statistics/block-blast) · [Applixir: Block Blast playbook](https://www.applixir.com/blog/the-block-blast-playbook-what-127m-in-ad-revenue-actually-bought/)
- [Sensor Tower: Top 10 May 2026](https://sensortower.com/blog/top-10-worldwide-mobile-games-by-revenue-and-downloads-in-may-2026) · [AdBreak Media: Top downloaded 2026](https://adbreakmedia.com/blog/top-downloaded-mobile-games-2026) · [Capermint: Arrows](https://www.capermint.com/blog/develop-game-like-arrows-puzzle-escape/)
- [Gamigion: Pixel Flow success analysis](https://www.gamigion.com/pixel-flow-success-analysis/) · [mobilegamer.biz: Pixel Flow hits $100m](https://mobilegamer.biz/data-digest-pixel-flow-hits-100m-mays-top-games-neverness-to-everness-pokemon-go-more/) · [AppSamurai: Pixel Flow](https://appsamurai.com/blog/pixel-flow-an-analysis-of-its-rapid-rise/)
- [Game Growth Advisor: KPIs 2026](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/) · [Game Growth Advisor: Hybrid casual](https://gamegrowthadvisor.com/blog/2026-04-16-hybrid-casual-game-design-strategy-2026/) · [Genzopia: Puzzle stats](https://www.genzopia.com/blog/puzzle-games-statistics-2026)
- [Segwise: TikTok creatives 2026](https://segwise.ai/blog/latest-tiktok-ad-creative-types-2026) · [MegaDigital: TikTok playables](https://megadigital.ai/en/blog/tiktok-playable-ads) · [PlayTurbo: arrow puzzle creatives](https://www.playturbo.com/blog/arrow-puzzle-game-creative-best-practices-2026)
- [wnhub: coloring genre round table](https://wnhub.io/news/other/item-43522)

הערה: רוב המספרים הם הערכות צד-שלישי שמשתנות בין מקורות; הם משמשים לכיוון, לא לתחזית.
