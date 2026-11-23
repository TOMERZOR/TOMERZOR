# ערסלייט לאייפון

האפליקציה עצמה היא האתר שבתיקייה `../arslate`. התיקייה הזאת עוטפת אותו באפליקציית iOS אמיתית עם [Capacitor](https://capacitorjs.com) 8, ומוסיפה שכבה שקיימת רק באפליקציה (`native.js`):

- **רטט** בשליחה ובקבלת תשובה.
- **מסך הסכמה** לפני התרגום החכם הראשון: הטקסט נשלח ל-Claude של Anthropic. בלי הסכמה הכל רץ במילון שבמכשיר. (אפל דורשת את זה מאז 2025, הנחיה 5.1.2(i).)
- **מכסה יומית**: 5 תרגומים חכמים בחינם ביום. אחר כך סרטון פרסומת (AdMob Rewarded) נותן עוד 10. המילון שבמכשיר תמיד בלי הגבלה.

כרגע הפרסומות הן **פרסומות בדיקה של Google** (מזהים ציבוריים). לפני החנות מחליפים במזהים שלך, ראו למטה.

## להריץ על אייפון (מק עם Xcode עדכני)

```bash
cd arslate-ios
npm install          # פעם אחת: Capacitor, רטט ו-AdMob ל-node_modules (פרויקט ה-Xcode מצביע אליהם)
npm run sync         # מעתיק את ../arslate ל-www, מוסיף את native.js ומסנכרן ל-Xcode
npm run open         # פותח את Xcode
```

ב-Xcode: בוחרים את `App` → **Signing & Capabilities** → **Automatically manage signing** → **Team**. מחברים אייפון, בוחרים אותו למעלה ולוחצים Run. בפעם הראשונה Xcode מוריד את החבילות (Capacitor, Google Mobile Ads) דרך Swift Package Manager, זה לוקח כמה דקות.

אחרי כל שינוי ב-`../arslate`: `npm run sync` שוב.

## הגדרות (משתני סביבה ל-`npm run sync`)

| משתנה | ברירת מחדל | מה זה |
| --- | --- | --- |
| `ARSLATE_API` | השרת ב-Cloudflare | כתובת שרת ה-AI. ריק = רק המילון שבמכשיר |
| `ADMOB_REWARDED` | יחידת בדיקה של Google | מזהה ה-Rewarded ad unit שלך מ-AdMob |
| `ADMOB_TESTING` | `1` | `0` = פרסומות אמיתיות |
| `FREE_PER_DAY` | `5` | תרגומים חכמים בחינם ביום |
| `PER_AD` | `10` | כמה תרגומים סרטון אחד נותן |

לגרסה לחנות:

```bash
ADMOB_REWARDED=ca-app-pub-XXXX/YYYY ADMOB_TESTING=0 npm run sync
```

ובנוסף, ב-`ios/App/App/Info.plist`: מחליפים את `GADApplicationIdentifier` במזהה האפליקציה שלך מ-AdMob (`ca-app-pub-XXXX~ZZZZ`), ומוסיפים ל-`SKAdNetworkItems` את הרשימה המלאה מ[המדריך של Google](https://developers.google.com/admob/ios/quick-start#update_your_infoplist).

## מה יש בפנים

| נתיב | מה זה |
| --- | --- |
| `capacitor.config.ts` | מזהה האפליקציה `com.tomerzor.arslate`, השם ערסלייט, צבע הרקע |
| `sync.mjs` | מעתיק את האתר ל-`www`, כותב `config.js` עם השרת וההגדרות, ומחבר את `native.js` |
| `native.js` | רטט, מסך ההסכמה, המכסה היומית והפרסומות |
| `ios/App/App/Info.plist` | אנכי בלבד, תמיד בהיר, AdMob, הסבר ל-App Tracking Transparency |
| `ios/App/App/Assets.xcassets` | אייקון 1024 (חוליות הזהב) ומסך פתיחה |

האפליקציה לאייפון בלבד (בלי iPad), כדי שלא יצטרכו צילומי מסך של iPad בחנות.
