# ECHO לאייפון

המשחק עצמו נמצא בתיקייה `../echo` (HTML, CSS ו-JavaScript בלבד). התיקייה הזאת עוטפת אותו באפליקציית iOS אמיתית בעזרת [Capacitor](https://capacitorjs.com), כך שאפשר להתקין אותו על אייפון דרך Xcode.

הפרויקט של Xcode כבר נמצא כאן (`ios/App/App.xcodeproj`) יחד עם עותק של המשחק (`ios/App/App/public`), אז לא צריך להתקין כלום כדי לפתוח אותו.

## התקנה על האייפון (צריך מק עם Xcode 15 ומעלה)

1. פותחים את `echo-ios/ios/App/App.xcodeproj` ב-Xcode (לחיצה כפולה).
2. בפעם הראשונה Xcode מוריד את חבילת Capacitor דרך Swift Package Manager. זה לוקח דקה או שתיים; מחכים שהסרגל למעלה יסיים.
3. בעץ הקבצים משמאל בוחרים את `App`, ואז בלשונית **Signing & Capabilities**:
   - מסמנים **Automatically manage signing**.
   - ב-**Team** בוחרים את ה-Apple ID שלכם (אם אין, Xcode → Settings → Accounts → + מוסיף אותו. חשבון Apple רגיל וחינמי מספיק).
   - אם Xcode מתלונן שה-Bundle Identifier תפוס, משנים את `com.tomerzor.echo` למשהו ייחודי, למשל `com.tomerzor.echo2`.
4. מחברים את האייפון בכבל, ובאייפון מאשרים "Trust this computer".
5. למעלה, ליד כפתור ה-Play, בוחרים את האייפון שלכם במקום הסימולטור, ולוחצים **Run** (⌘R).
6. בפעם הראשונה האייפון יחסום את האפליקציה. באייפון: **הגדרות → כללי → VPN וניהול מכשיר** → לוחצים על המפתח שלכם → **Trust**. אחר כך פותחים את ECHO מהמסך הראשי.

עם חשבון Apple חינמי האפליקציה תקפה 7 ימים ואז צריך ללחוץ Run שוב. עם חברות במפתחים (99$ לשנה) אין מגבלה, ואפשר גם להעלות ל-TestFlight ולחנות.

## אחרי שינוי במשחק

כשמשנים משהו ב-`../echo`, מעתיקים את הגרסה החדשה לתוך האפליקציה:

```bash
cd echo-ios
npm install      # פעם אחת
npm run sync     # מעתיק את ../echo ל-www ומסנכרן לפרויקט של Xcode
npm run open     # פותח את Xcode
```

`sync.mjs` גם מזריק את כתובת השרת (`window.ECHO_SERVER`) כדי שהאפליקציה תתחבר לחדר היומי ולשמירה בענן. אפשר לשנות אותה עם `ECHO_SERVER=my-host npm run sync`. בלי אינטרנט המשחק עובד אופליין והשמירה נשארת במכשיר.

## מה יש בפנים

| נתיב | מה זה |
| --- | --- |
| `capacitor.config.ts` | מזהה האפליקציה (`com.tomerzor.echo`), השם והצבע הרקע |
| `sync.mjs` | מעתיק את המשחק מ-`../echo` ל-`www` |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset` | אייקון האפליקציה (נוצר ב-Higgsfield) |
| `ios/App/App/Info.plist` | כיווני מסך (portrait + landscape) והגדרות מערכת |
| `ios/App/App/public` | עותק המשחק שנארז לתוך האפליקציה |

## דברים שעוד לא אמיתיים באב-הטיפוס

- **רכישות**: החנות, חבילת הפתיחה וכרטיס העונה מדומים. לפני חנות אמיתית צריך StoreKit (למשל `@capacitor-community/in-app-purchases`) ואימות קבלות בשרת.
- **פרסומות**: "צפה בסרטון" הוא ספירה לאחור של 5 שניות. מחליפים ב-AdMob (`@capacitor-community/admob`) עם Rewarded Ads.
- **מועדונים**: רק כרטיס "בקרוב".
