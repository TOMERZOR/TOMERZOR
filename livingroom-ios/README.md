# Living Room לאייפון

האפליקציה עצמה נמצאת בתיקייה `../livingroom`. התיקייה הזאת עוטפת אותה באפליקציית iOS אמיתית בעזרת [Capacitor](https://capacitorjs.com), כך שאפשר להתקין אותה על אייפון דרך Xcode.

באפליקציה המציאות הרבודה נפתחת דרך AR Quick Look של אפל, עם תוסף קטן (`ios/App/App/LivingRoomViewController.swift`). התוסף מקבל מהאפליקציה קובץ USDZ של הפריט או של כל החדר, ומציג אותו בחדר. הגודל נעול לגודל האמיתי, כך שאי אפשר להגדיל או להקטין את הפריט בצביטה.

פרויקט ה-Xcode כבר נמצא כאן (`ios/App/App.xcodeproj`) עם עותק של האפליקציה (`ios/App/App/public`). אין צורך להתקין שום דבר חוץ מ-Xcode.

## התקנה על האייפון (צריך מק עם Xcode 16 ומעלה)

1. מורידים את המאגר למק: `git clone https://github.com/TOMERZOR/TOMERZOR.git`. אם הוא כבר אצלכם, מריצים `git pull`.
2. פותחים את `livingroom-ios/ios/App/App.xcodeproj` ב-Xcode (לחיצה כפולה).
3. בפעם הראשונה Xcode מוריד את חבילת Capacitor דרך Swift Package Manager. זה לוקח דקה או שתיים, ומחכים שהסרגל למעלה יסיים.
4. בעץ הקבצים משמאל בוחרים את `App`, ואז בלשונית **Signing & Capabilities**:
   - מסמנים **Automatically manage signing**.
   - ב-**Team** בוחרים את ה-Apple ID שלכם. אם אין, מוסיפים אותו דרך Xcode ← Settings ← Accounts ← +. חשבון Apple רגיל וחינמי מספיק.
   - אם Xcode מתלונן שה-Bundle Identifier תפוס, משנים את `com.tomerzor.livingroom` למשהו ייחודי, למשל `com.tomerzor.livingroom2`.
5. מחברים את האייפון בכבל, ובאייפון מאשרים "Trust this computer". באייפון עם iOS 16 ומעלה צריך גם להפעיל **Developer Mode**: הגדרות ← פרטיות ואבטחה ← Developer Mode, ואז הפעלה מחדש.
6. למעלה, ליד כפתור ה-Play, בוחרים את האייפון שלכם במקום הסימולטור, ולוחצים **Run** (⌘R).
7. בפעם הראשונה האייפון יחסום את האפליקציה. באייפון: **הגדרות ← כללי ← VPN וניהול מכשיר** ← לוחצים על המפתח שלכם ← **Trust**. אחר כך פותחים את Living Room מהמסך הראשי.

עם חשבון Apple חינמי האפליקציה תקפה 7 ימים, ואחרי זה צריך ללחוץ Run שוב. עם חברות במפתחים (99$ לשנה) אין מגבלה, ואפשר גם להעלות ל-TestFlight ולחנות.

המציאות הרבודה עובדת רק על אייפון אמיתי, לא בסימולטור.

## אחרי שינוי באפליקציה

כשמשנים משהו ב-`../livingroom`, מעתיקים את הגרסה החדשה לתוך האפליקציה. צריך לשם כך [Node.js](https://nodejs.org):

```bash
cd livingroom-ios
npm install      # פעם אחת
npm run sync     # מעתיק את ../livingroom ל-www ומסנכרן לפרויקט של Xcode
npm run open     # פותח את Xcode
```

האפליקציה מתחברת לאותו שרת כמו האתר (הכתובת שב-`livingroom/js/config.js`). השרת מאשר בקשות מהאפליקציה (`capacitor://localhost` ב-`ALLOWED_ORIGINS`).

## מה יש בפנים

| נתיב | מה זה |
| --- | --- |
| `capacitor.config.ts` | מזהה האפליקציה (`com.tomerzor.livingroom`), השם וצבע הרקע |
| `sync.mjs` | מעתיק את האפליקציה מ-`../livingroom` ל-`www`, בלי השרת וה-service worker |
| `ios/App/App/LivingRoomViewController.swift` | המסך הראשי והתוסף `ARQuickLook` שפותח את קובץ ה-USDZ במציאות רבודה |
| `ios/App/App/Info.plist` | הרשאות מצלמה ותמונות בעברית, מסך לאורך |
| `ios/App/App/Assets.xcassets` | אייקון ומסך פתיחה |
| `ios/App/App/public` | עותק האפליקציה שנארז לתוך האפליקציה |
