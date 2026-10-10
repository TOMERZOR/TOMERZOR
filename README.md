# Whatsupphone | וואצפ פון

דף נחיתה בעברית (RTL) למעבדת הסלולר וחנות האביזרים Whatsupphone, נחלת בנימין 65, תל אביב.

## הרצה מקומית

אין שלב build. פותחים שרת סטטי בתיקייה:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## מבנה

- `index.html` כל התוכן, כולל אייקונים (Phosphor) מוטמעים ונתוני schema.org לגוגל.
- `assets/styles.css` שפת העיצוב, מצב בהיר/כהה אוטומטי, וכל האנימציות.
- `assets/main.js` חשיפה בגלילה, כניסת ה־hero ובר הפעולות במובייל.
- `assets/fonts/` פונטים מקומיים: Karantina (כותרות), IBM Plex Sans Hebrew (טקסט), IBM Plex Mono (מספרים).

## אנימציות

- **פירוק הטלפון**: בגלילה דרך אזור התיקונים, הטלפון מתפרק לשש שכבות (מסך, מצלמה, לוח, סוללה, שקע, גב) וכל שכבה מדליקה את התיקון המתאים ברשימה. עובד עם CSS scroll-driven animations; בדפדפנים בלי תמיכה הטלפון נפתח פעם אחת כשהוא נכנס למסך.
- כל התנועה נכבית אצל מי שביקש `prefers-reduced-motion`.

## פרסום

אפשר להפעיל GitHub Pages על הענף הראשי (Settings > Pages > Deploy from branch), או להעלות את התיקייה לכל אחסון סטטי.
