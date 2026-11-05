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
