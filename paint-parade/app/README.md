# Paint Parade — אפליקציית iOS ו-Android

המשחק עצמו נמצא בתיקייה שמעל (`../`, HTML/CSS/JS בלבד). התיקייה הזאת עוטפת אותו באפליקציה אמיתית עם [Capacitor 8](https://capacitorjs.com): פרויקט Xcode ב-`ios/` ופרויקט Android Studio ב-`android/`.

כבר מוגדר: מזהה אפליקציה `com.tomerzor.paintparade`, אייקון, מסך פתיחה, מסך אנכי בלבד, רטט, AdMob (פרסומות), RevenueCat (רכישות), בקשת ATT באייפון, טופס הסכמה GDPR, ורשימת SKAdNetwork.

## 0. פעם אחת
```bash
cd paint-parade/app
npm install        # מוריד את Capacitor והתוספים (AdMob, RevenueCat, Haptics...)
npm run sync       # מעתיק את המשחק ל-www ומסנכרן לשני הפרויקטים
```

## 1. אייפון (צריך מק עם Xcode 16+)
```bash
npm run ios        # מסנכרן ופותח את Xcode
```
1. בחרו את `App` ← **Signing & Capabilities** ← סמנו *Automatically manage signing* ובחרו Team.
2. הוסיפו Capability בשם **In-App Purchase**.
3. חברו אייפון ולחצו ▶ (⌘R). לבדיקה מהירה גם הסימולטור עובד.
4. להעלאה לחנות: **Product → Archive → Distribute App → App Store Connect** (צריך חשבון Apple Developer, ‏99$ לשנה).

## 2. אנדרואיד (Android Studio)
```bash
npm run android    # מסנכרן ופותח את Android Studio
```
1. לבדיקה: חברו טלפון (מצב מפתח) ולחצו ▶.
2. לחנות: **Build → Generate Signed App Bundle (.aab)** → צרו keystore (שמרו אותו! בלעדיו אי אפשר לעדכן את האפליקציה) → העלו ל-Google Play Console (25$ חד-פעמי).

## 3. לפני העלאה לחנות — להחליף מזהי בדיקה במזהים אמיתיים
כרגע מוגדרים **מזהי הבדיקה הרשמיים של Google**, כך שאפשר לבדוק פרסומות בלי סכנת חסימה. לפני השקה:

| מה | איפה |
|---|---|
| AdMob App ID (iOS) | `ios/App/App/Info.plist` → `GADApplicationIdentifier`, וגם `capacitor.config.json` |
| AdMob App ID (Android) | `android/app/src/main/res/values/strings.xml` → `admob_app_id`, וגם `capacitor.config.json` |
| מזהי יחידות פרסומת (Rewarded + Interstitial) | `../js/platform.js` → `CONFIG.admob`, ושנו `testing: false` |
| מפתחות RevenueCat | `../js/platform.js` → `CONFIG.revenuecat` |

אחרי כל שינוי ב-`../`: `npm run sync`.

## 4. מוצרים לרכישה (ליצור ב-App Store Connect וב-Google Play Console, ולחבר ב-RevenueCat)
| Product ID | סוג | מחיר | מה מקבלים |
|---|---|---|---|
| `pp_starter` | Consumable (חד-פעמי במשחק) | $1.99 | 1,000 מטבעות, 2 מכל בוסטר, שעה לבבות ללא הגבלה |
| `pp_noads` | Non-consumable | $6.99 | בלי פרסומות כפויות |
| `pp_noads_bundle` | Non-consumable | $9.99 | בלי פרסומות + 1,500 מטבעות + 3 מכל בוסטר |
| `pp_coins_1` | Consumable | $1.99 | 1,000 מטבעות |
| `pp_coins_2` | Consumable | $4.99 | 3,000 מטבעות |
| `pp_coins_3` | Consumable | $9.99 | 7,500 מטבעות |
| `pp_coins_4` | Consumable | $19.99 | 20,000 מטבעות |
| `pp_coins_5` | Consumable | $49.99 | 60,000 מטבעות |

ב-RevenueCat: צרו Entitlement בשם **`no_ads`** וצרפו אליו את `pp_noads` ו-`pp_noads_bundle`, וצרו Offering ברירת מחדל עם כל המוצרים. המשחק מציג את המחיר האמיתי מהחנות אוטומטית (במטבע המקומי).

## 5. דברים שהחנויות שואלות
- **Privacy Policy URL**: העלו את `../privacy.html` לכתובת ציבורית (למשל GitHub Pages) והדביקו בחנויות.
- **App Privacy (Apple) / Data safety (Google)**: Device ID לפרסום (AdMob), Purchase history (RevenueCat), Crash data. לא אוספים שם/מייל/מיקום מדויק.
- **דירוג גיל**: 4+ (Apple) / Everyone (Google). המשחק לא מיועד לילדים מתחת ל-13 (בגלל פרסומות מותאמות).
- **אימייל תמיכה**: `support@paintparade.app` מופיע במשחק ובמדיניות — החליפו לכתובת שלכם אם אין לכם את הדומיין.
