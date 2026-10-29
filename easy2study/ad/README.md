# Easy2Study: הפרסומת

סרטון מושן של 31 שניות, 1080×1920 (לרילס, טיקטוק וסטטוס), להורים לילדים עם קשיי למידה. הקונספט והסטוריבורד ב-`plan.md`, טקסטים לפרסום ב-`share-copy.txt`.

- `easy2study-ad.mp4`: הסרטון עם הסאונד. `poster.jpg`: התמונה הממוזערת (גם הפריים הראשון של הסרטון).
- `index.html`: כל הסרטון. כל פריים הוא פונקציה של הזמן (`render(t)`), באותם צבעים, פונט ואייקונים של האפליקציה, ומסכי האפליקציה משוחזרים מהממשק האמיתי. פתיחה בדפדפן מנגנת אותו בלופ.
- `render.mjs`: מצלם את כל הפריימים (30 בשנייה) ל-`frames.mp4`, וכותב את רשימת הצלילים `sfx.json`.
- `audio.py`: הפסקול, מסונתז מאפס (numpy): דרון במינור ושעון בחלק של הכאב, ומהחשיפה גרוב רך במז'ור ב-96 BPM. כל אפקט נוחת על הפריים שלו.

## לייצר מחדש

```
npx http-server -p 8790 .              # מתיקיית השורש של הריפו
cd easy2study/ad
node render.mjs frames.mp4 30          # צריך Playwright ו-ffmpeg
python3 audio.py sfx.json audio.wav
ffmpeg -ss 11.9 -i frames.mp4 -frames:v 1 -q:v 2 poster.jpg
ffmpeg -i frames.mp4 -i poster.jpg -i audio.wav -filter_complex "[0:v][1:v]overlay=enable='eq(n\,0)'[v]" -map "[v]" -map 2:a -c:v libx264 -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart easy2study-ad.mp4
```

כדי לשנות טקסט או תזמון: העריכה ב-`index.html` (המשפטים בראש הסקריפט, התזמונים בתוך `render`), ואז לרנדר מחדש.
