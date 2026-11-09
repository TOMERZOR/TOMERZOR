# המדריך המלא: מחנות מוכנה לעסק שמוכר

הכול לפי הסדר. כל שלב תלוי בזה שלפניו. הקישורים לאדמין של שופיפיי הם ישירות לחנות שלך (`dci1rw-xn`).

**זמן משוער:** בערך יום עבודה אחד ממך, ועוד 1-2 שבועות של המתנה לספק ולדוגמה.

---

## שלב 0: עסק רשום (יום 1)

1. **פתיחת עוסק פטור** במע"מ ובמס הכנסה, אונליין:
   https://www.gov.il/he/service/request-open-exempt-dealer-via-internet
   (תקרת עוסק פטור ב-2026 היא כ-122,833 ₪ בשנה. מעליה עוברים לעוסק מורשה. כדאי לבדוק עם רו"ח.)
2. **רישום כעצמאי בביטוח לאומי:**
   https://www.btl.gov.il/Insurance/National%20Insurance/type_list/Self_Employed/Pages/howtoregister.aspx
3. **חשבון בנק** שאליו תיכנס הסליקה. אפשר את הפרטי, אבל עדיף חשבון נפרד לעסק.

**בסוף השלב יש לך:** מספר עוסק. הוא נדרש בסליקה, בחשבוניות ובמדיניות.

---

## שלב 1: הגדרות החנות בשופיפיי (30 דקות)

| # | מה עושים | קישור |
|---|---|---|
| 1 | **מפרסמים את התבנית** "LUNÉ - בדיקה מלאה 31.10" ← Publish, ומוחקים את הישנה | https://admin.shopify.com/store/dci1rw-xn/themes |
| 2 | **שם החנות:** LUNÉ. **פורמט מטבע:** Store currency ← Change formatting ← בשתי השורות `₪{{amount_no_decimals}}` | https://admin.shopify.com/store/dci1rw-xn/settings/general |
| 3 | **שפה:** מוסיפים עברית ומגדירים אותה כברירת מחדל (Change default). אחרת התשלום והמיילים יהיו באנגלית | https://admin.shopify.com/store/dci1rw-xn/settings/languages |
| 4 | **מדיניות:** מדביקים כל קובץ מ-`dropship/policies/` דרך כפתור `<>`, אחרי שממלאים את ה-[סוגריים] (שם עסק, מספר עוסק, כתובת, טלפון) | https://admin.shopify.com/store/dci1rw-xn/settings/policies |
| 5 | **פרטי העסק בתחתית האתר:** Customize ← Footer ← "פרטי העסק" | https://admin.shopify.com/store/dci1rw-xn/themes |
| 6 | **באנר עוגיות:** Customer privacy ← Cookie banner ← On | https://admin.shopify.com/store/dci1rw-xn/settings/customer_privacy |
| 7 | **מיילים ללקוחות:** לוגו, צבע `#141A30`, והבלוק "מתי זה מגיע" (ההוראות ב-`dropship/emails/README.md`) | https://admin.shopify.com/store/dci1rw-xn/settings/notifications |
| 8 | **תזכורת סל נטוש:** Abandoned checkouts ← שליחה אוטומטית אחרי 10 שעות | https://admin.shopify.com/store/dci1rw-xn/settings/checkout |
| 9 | **שדרוג תוכנית ל-Basic.** בלי זה אי אפשר למכור | https://admin.shopify.com/store/dci1rw-xn/settings/plan |

---

## שלב 2: סליקה (1-3 ימי עבודה של חברת הסליקה)

Shopify Payments לא זמין בישראל, אז בוחרים סולק ישראלי אחד:

- **PayPlus** (כולל Bit, Apple Pay וחשבוניות): https://payplus.co.il/en/shopify-guide
- **Tranzila** (מתאים למי שכבר יש לו מספר ספק אצל חברת אשראי): https://apps.shopify.com/tranzila-payment-app
- **Allpay** (כרטיסים, Apple Pay ו-Bit): https://apps.shopify.com/allpay-secure-payment

**איך בוחרים:** משווים עמלה לעסקה, דמי מנוי חודשיים, ותמיכה ב-Bit. נפתחים אצלם עם מספר עוסק, תעודת זהות ופרטי בנק. אחרי האישור מפעילים את הסולק:
https://admin.shopify.com/store/dci1rw-xn/settings/payments

---

## שלב 3: חשבוניות אוטומטיות (15 דקות)

לכל הזמנה צריכה לצאת חשבונית/קבלה כחוק. יש שתי אפשרויות:
- **מורנינג (חשבונית ירוקה):** https://apps.shopify.com/green-invoice (החל מ-396$ לשנה).
- **החשבוניות של הסולק:** PayPlus ו-Tranzila מציעות חשבוניות מובנות. אם בחרת אחד מהם, אולי זה מספיק ויותר זול.

---

## שלב 4: הספק, הלב של הדרופשיפינג (שעה, ועוד כמה ימים המתנה)

1. **נרשמים ל-CJdropshipping:** https://cjdropshipping.com
2. **מתקינים את האפליקציה שלהם בשופיפיי:** https://apps.shopify.com/cucheng
   מדריך חיבור רשמי: https://blog.cjdropshipping.cn/detail/how-to-connect-shopify-shops-to-app-cjdropshipping-com
3. **שולחים בקשת איתור מוצר** (Service ← Sourcing ← Post a Sourcing Request). מעלים את `dropship/product-images/01-set-champagne.jpg` ומדביקים:
   ```
   Heatless satin curling set: one soft flexible foam rod covered in satin, about 85-93 cm long,
   plus 2 matching satin scrunchies and a satin drawstring storage pouch.
   Colours: champagne/gold, black, dusty pink. Please quote unit price and shipping to ISRAEL
   (CJPacket or fastest tracked line), and delivery time to Israel. Expected volume: 50-300 sets/month.
   ```
   בדרך כלל התשובה מגיעה תוך יומיים.
4. **במקביל, דוגמה מעליבאבא** (ספק עם מוט 91-93 ס"מ, מינימום 5 יחידות):
   https://www.alibaba.com/product-detail/Hair-styling-tools-heatless-curling-rod_1601203736031.html
   כותבים לו את אותה בקשה ומבקשים הצעה למשלוח לישראל.
5. **מחברים את הווריאציות:** כשהמוצר מאושר ב-CJ, מחברים באפליקציה (Connection / Products) את 9 הווריאציות בשופיפיי לצבעים אצל CJ:
   - "סט אחד" ← כמות **1**
   - "2 סטים" ← כמות **2**
   - "3 סטים" ← כמות **3**

   חשוב מאוד: בלי זה, מי שקונה 3 סטים תקבל סט אחד.
6. **תשלום אוטומטי ל-CJ:** מטעינים את הארנק (Wallet) או מחברים כרטיס, ומפעילים Auto-pay / Auto-order. אחרת כל הזמנה מחכה לאישור ידני, וההזמנה נשמרת רק 24 שעות.
7. **הזמנת ניסיון** של סט אחד לכתובת שלך, דרך האתר עצמו. ככה בודקים את כל השרשרת: תשלום ← הזמנה ב-CJ ← מספר מעקב ← מייל ללקוחה. ומהסט שמגיע מצלמים את הסרטונים.
8. **עדכון המספרים:**
   - העלות האמיתית בגיליון `dropship/lune-profit-tracker.xlsx` (לשונית "הגדרות ורווח", התאים הצהובים).
   - אורך המוט בתיאור המוצר, אם הוא שונה מ-85 ס"מ (תגיד לי, ואני אעדכן).

**אלטרנטיבה ל-CJ:** עלי אקספרס דרך האפליקציה DSers: https://apps.shopify.com/dsers

---

## שלב 5: ביקורות (10 דקות)

**Judge.me** (חינם): https://apps.shopify.com/judgeme
אחרי ההתקנה: Themes ← Customize ← עמוד מוצר ← הסקשן "אפליקציות (ביקורות)" ← Add block ← Judge.me.
הוא שולח ללקוחות בקשה לביקורת אחרי שההזמנה מגיעה. **לא מייבאים ביקורות מזויפות.**

---

## שלב 6: פייסבוק ואינסטגרם (שעה)

1. **Meta Business Suite:** יוצרים עמוד LUNÉ ומחברים חשבון אינסטגרם עסקי: https://business.facebook.com
   התמונות והטקסטים מוכנים ב-`dropship/social/`.
2. **חשבון מודעות:** מטבע **ILS** ואזור זמן **ירושלים**. אי אפשר לשנות אותם אחר כך. מוסיפים כרטיס אשראי.
3. **האפליקציה Facebook & Instagram בשופיפיי** מחברת את הפיקסל. בוחרים שיתוף נתונים **Maximum**:
   https://apps.shopify.com/facebook
4. **אימות דומיין:** Business settings ← Brand safety ← Domains: https://business.facebook.com/settings
5. **בדיקת אירועים:** ב-Events Manager מוודאים ש-ViewContent, AddToCart ו-Purchase מגיעים (בזמן הזמנת הניסיון):
   https://business.facebook.com/events_manager2
6. **מפרסמים 9 פוסטים** בעמוד לפי `dropship/social/README.md`.
7. **הקמפיין:** https://adsmanager.facebook.com
   - Sales ← Advantage+ ← ישראל, נשים 20-55 ← 120-150 ₪ ליום.
   - העלאה: שני הסרטונים מ-`dropship/ads/video/` וששת התמונות מ-`dropship/ads/images/`, עם הטקסטים מ-`dropship/ads/README.md`.
   - **לא נוגעים 72 שעות.**

---

## שלב 7: השקה

1. **הסרת הסיסמה מהחנות:** https://admin.shopify.com/store/dci1rw-xn/online_store/preferences
2. **הפעלת הקמפיין.**
3. **הודעה לי:** "השקנו". אני בודק את החנות החיה ומתחיל את הדוח היומי.

---

## שלב 8: שגרה (10-15 דקות ביום)

| מתי | מה | מי |
|---|---|---|
| כל בוקר | דוח: הזמנות חדשות, הזמנות שלא נשלחו אחרי יומיים, הזמנות בלי מעקב אחרי 5 ימים, הזמנות שמתקרבות ל-18 ימי עסקים | **אני** (משימה מתוזמנת) |
| כל בוקר | טיוטות תשובה ב-Gmail ללקוחות ששאלו "איפה ההזמנה" או ביקשו לבטל | **אני** מכין, **את/ה** שולח/ת |
| כל ערב | מעתיקים מ-Ads Manager לגיליון: הוצאה, קליקים, הוספות לסל, רכישות. הגיליון אומר מה לעשות | **את/ה** (2 דקות) |
| כל 3 ימים | שולחים לי CSV מ-Ads Manager, ואני ממליץ מה לכבות, מה להגדיל ואילו פרסומות חדשות להכין | **שנינו** |
| כל שבוע | דוח רווח: הכנסות, עלות ספק, פרסום, רווח נקי | **אני** |
| כל שבוע | 3 רילס חדשים מהסט האמיתי (תסריטים ב-`dropship/ads/README.md`) | **את/ה** מצלם/ת, **אני** כותב/עורך |
| כשיש בעיה | הזמנה תקועה אצל CJ ← פנייה לנציג שלהם דרך הצ'אט בחשבון | **את/ה** |

---

## מה אני לא יכול לעשות במקומך

- לפתוח חשבונות (עוסק, בנק, סליקה, CJ, Meta) ולשלם בהם.
- לשלם לספק. את זה עושה התשלום האוטומטי של CJ.
- להפעיל, לעצור או לשנות קמפיינים בפייסבוק. אין לי חיבור ל-Meta.
- לשלוח מיילים ללקוחות בלי אישורך.
- לפרסם תבנית או לערוך מדיניות בשופיפיי. הקונקטור חסום לפעולות האלה.

כל השאר: תגיד לי, ואני עושה.
