# Pointy — narrated screen reel (TikTok / Instagram)

~32 s, 1080×1920, 30 fps, Hebrew. Only the Mac screen — no talking head — with a narrator in place of the presenter,
made with the onetake skill (`.claude/skills/onetake`, method: `references/product-demo.md`).

## Narration

ElevenLabs, voice **Itamar — Israeli Hebrew Narrator**, model eleven_v4, take B of 2 (take A dropped the last line).
Every beat of the film sits on a word of this take (`vo.js`, word times from a local Hebrew Whisper):

> נתקעתם בפרימייר ולא מוצאים את הכפתור? במקום מדריך של 14 דקות ביוטיוב, תכירו את פוינטי. לוחצים אופשן ורווח,
> ושואלים בעברית: איך עושים זום אין איטי? פוינטי מסתכל על המסך, והסמן הכתום מראה לכם בדיוק על מה ללחוץ. לוחצים
> עשיתי, והוא כבר בשלב הבא. וזהו. זום אין מוכן, בלי מדריך. וזה עובד בכל תוכנה: אקסל, אפטר אפקטס, כל מה שיש לכם על
> המסך. במק ובווינדוס. רוצים לנסות? תגיבו "פלאגין", ותקבלו קישור בפרטי.

## The film

- **Stage:** the Mac screen fills the frame on a blurred copy of itself; an operator camera dives from control to control.
- **Screens:** Premiere, Excel and After Effects are AI-generated screenshots (`premiere.jpg`, `excel.jpg`, `ae.jpg`);
  everything that moves is drawn live: the menu bar, Pointy's frosted ask bar and suggestions, "קורא את …",
  the orange pointer with rings, the step cards, the user's mouse and clicks, Premiere's keyframes and the zoom.
- **Beats:** hook (lost mouse, "?") → a 14:37 tutorial card → the Pointy icon flies into the menu bar → ⌥ + Space
  (Windows: Alt + Space) → the question types in Hebrew → pointer, step 1, "עשיתי", steps 2–3 → the zoom plays →
  macOS swipe to Excel, then After Effects → Mission Control with all three → the comment CTA → end card.
- **Sound:** `score.py` — CC0 effects (Freesound) from the composition's `__events()` under the narrator, −14 LUFS.

Render: `python3 ../../.claude/skills/onetake/scripts/render.py comp.html --width 1080 --height 1920 --fps 30 --samples 4`,
then mux `mix.wav`.
