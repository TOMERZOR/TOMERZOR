# Pointy: מודעה אנכית לרילס ולטיקטוק

מודעת מושן בעברית, 25 שניות, 1080×1920, עם ביט ואפקטים. ההוק: "תנו לי 20 שניות". טיימר סופר לאחור לאורך כל הסרטון ומגיע לאפס עם הקריאה לפעולה: "שלחו לי בדירקט את המילה פלאגין".

- `pointy.mp4`: הסרטון. הפריים הראשון הוא התמונה הממוזערת
- `pointy.jpg`: התמונה הממוזערת
- `caption.txt`: כיתוב לפוסט
- `composition/`: המקור. `index.html` מצייר כל פריים מתוך הזמן (`render(t)`), `audio.py` מסנתז את הביט ואת האפקטים מתוך רשימת האירועים של העמוד, ו-`render.cjs` מצלם את הפריימים ומחבר אותם ל-MP4

## לרנדר מחדש

```
cd pointy-ad/composition
node render.cjs                          # כ-5 דקות: sfx.json, audio.wav, ../pointy.mp4, ../pointy.jpg
node render.cjs --snap 1.6,10.5 snaps    # צילום של רגעים בודדים, לבדיקה
```

צריך Node עם Playwright, Python 3 עם numpy, ו-ffmpeg. לתצוגה מקדימה בלופ פותחים את `composition/index.html` בדפדפן.

## קרוסלה לאינסטגרם

`carousel/slides/01.png` עד `08.png`: שמונה שקפים של 1080×1350 (4:5), שמסבירים את המוצר על לפטופ: הבעיה, מה זה Pointy, שלושת הצעדים (⌥ Space, שואלים בעברית, הסמן מצביע), "עובד בכל תוכנה", וקריאה לפעולה עם "פלאגין". הכיתוב לפוסט נמצא ב-`carousel/caption.txt`.

לרנדר מחדש: `node carousel/render.cjs`. המקור הוא `carousel/index.html`, ופתיחה שלו בדפדפן מציגה את כל השקפים זה לצד זה.

## מודעה מצולמת (Higgsfield)

`higgsfield/pointy-live.mp4`: מודעה באורך 21.5 שניות, 1080×1920 ב-24fps, עם צילומים ריאליסטיים שנוצרו ב-Higgsfield. הסטילס נוצרו ב-Nano Banana Pro והווידאו ב-Cinema Studio 4.0 (בסך הכול 392 קרדיטים). הטקסט בעברית, ה-UI של Pointy והקריאה לפעולה מצוירים מעל הצילום מתוך `higgsfield/edit/overlay.html`. הסאונד הוא האודיו המקורי של הקליפים, יחד עם ביט ואפקטים מ-`higgsfield/edit/score.py`.

- `higgsfield/creative-brief.md`: הקונספט, התסריט, הפרומפטים והעלויות
- `higgsfield/keyframes/`: חמשת הסטילס שנבחרו, `higgsfield/clips/`: חמשת הקליפים המקוריים
- לערוך מחדש: `node higgsfield/edit/edit.cjs` (נקודות החיתוך מוגדרות ב-`CUTS` בראש הקובץ)
