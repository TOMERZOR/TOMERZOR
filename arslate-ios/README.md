# ערסלייט לאייפון

האפליקציה עצמה היא האתר שבתיקייה `../arslate`. התיקייה הזאת עוטפת אותו באפליקציית iOS אמיתית עם [Capacitor](https://capacitorjs.com) 8, ומוסיפה שכבה שקיימת רק באפליקציה (`native.js`):

- **רטט** בשליחה ובקבלת תשובה.
- **מסך הסכמה** לפני התרגום החכם הראשון: הטקסט נשלח ל-Claude של Anthropic. בלי הסכמה הכל רץ במילון שבמכשיר. (אפל דורשת את זה מאז 2025, הנחיה 5.1.2(i).)
- **מכסה יומית**: 5 תרגומים חכמים בחינם ביום. אחר כך סרטון פרסומת (AdMob Rewarded) נותן עוד 10. המילון שבמכשיר תמיד בלי הגבלה.

הפרסומות אמיתיות: האפליקציה והיחידה ב-AdMob כבר מוגדרות (`ca-app-pub-4472181066002865~1240295901`, Rewarded `ca-app-pub-4472181066002865/7969355780`). לבדיקה בלי פרסומות אמיתיות: `ADMOB_TESTING=1 npm run sync`. אם אין סרטון להציג (למשל לפני ש-AdMob אישר את האפליקציה), המשתמש מקבל את 10 התרגומים בכל זאת.

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
| `ADMOB_REWARDED` | יחידת ה-Rewarded של ערסלייט | מזהה יחידת הפרסומת ב-AdMob |
| `ADMOB_TESTING` | ריק (פרסומות אמיתיות) | `1` = פרסומות בדיקה של Google |
| `FREE_PER_DAY` | `5` | תרגומים חכמים בחינם ביום |
| `PER_AD` | `10` | כמה תרגומים סרטון אחד נותן |

לגרסה לחנות פשוט `npm run sync` (המזהים כבר בפנים, וגם רשימת ה-`SKAdNetworkItems` המלאה ב-`Info.plist`). לפני כל העלאה מעלים את `CURRENT_PROJECT_VERSION` ב-`project.pbxproj` באחד.

## מה יש בפנים

| נתיב | מה זה |
| --- | --- |
| `capacitor.config.ts` | מזהה האפליקציה `com.tomerzor.arslate`, השם ערסלייט, צבע הרקע |
| `sync.mjs` | מעתיק את האתר ל-`www`, כותב `config.js` עם השרת וההגדרות, ומחבר את `native.js` |
| `native.js` | רטט, מסך ההסכמה, המכסה היומית והפרסומות |
| `ios/App/App/Info.plist` | אנכי בלבד, תמיד בהיר, AdMob, הסבר ל-App Tracking Transparency |
| `ios/App/App/Assets.xcassets` | אייקון 1024 (חוליות הזהב) ומסך פתיחה |

האפליקציה לאייפון בלבד (בלי iPad), כדי שלא יצטרכו צילומי מסך של iPad בחנות.
