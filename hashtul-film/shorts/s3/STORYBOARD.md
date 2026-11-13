# S3 · "POV: אתם השתול"

18.0 s. The viewer is the plant: they answer their question honestly, find out everyone else was asked something else, have to bluff, and get away with it.

It teaches the half of the game the film did not show: you answer on your own phone, the real question is revealed with everyone's answers, the plant must improvise an excuse, and if the vote misses, the plant wins.

## The pair

The game's own demo pair for the rate-yourself kind (spice 1, clean):

| | |
|---|---|
| Your question (the plant's) | כמה אתם טובים בלשקר לאמא? |
| Everyone else's question | כמה אתם טובים בחניה ברוורס? |
| Kind | scale, 1–10, labels "אסון" (1) and "אלופים" (10) |
| Your answer | 10 |
| The others | תומר 7 · שירה 6 · נועה 4 · דנה 5 · איתי 8 |
| The vote | three on תומר, two on you: you escape |

The joke is double: you rated yourself a perfect 10 at lying to mum, and the next thing the game asks of you is to lie.

## Screens

Capture these from the demo mode as the plant (`mole=1&kind=scale&n=6`); I have seen all of them and they look right:

- `demo=answer-scale`: the answer screen. Chip "מדרגים מ־1 עד 10", the question card, the yellow "?" tile with "מתוך 10", the ten bars (10 on the left, 1 on the right), "אלופים" / "אסון", the waiting row, "נעלתי". You also need it with 10 picked, and locked (`demo=answered`).
- `demo=reveal`: title "השאלה האמיתית", the real question card, six cells ("7/10" …, yours "10/10" with the "אתם" tag), the reaction bar.
- `demo=discuss`: title "מי פה משקר?".
- `demo=result-escaped` along its timeline (`at`): stamp "ברח!", your cucumber figure, name tag "יובל", "עבדתם על כולם!" with "+300", the card (tag "השאלה שלכם הייתה", your question, bubble "והתשובה: 10", "כל השאר נשאלו: …"), and the vote panel (three votes on תומר, two on יובל).

## Beats

Anchor times are fixed (they sit on the music). Everything between them is yours.

| t | Picture | Sound |
|---|---|---|
| **0.0** | Frame 0 is already the answer screen: camera close on the question card "כמה אתם טובים בלשקר לאמא?". A pink sticker lands at the top: **"POV: אתם השתול"** | pop, calm music |
| 0.5 | a small white chip under it: **"ואתם עוד לא יודעים את זה"** | |
| 1.0–2.0 | the camera drifts down to the ten bars; the finger comes in | |
| **2.0**–3.0 | the finger slides along the bars from the middle up to 10. Bars light as it passes, the yellow tile counts up to **10**, "אלופים" pulses. A slide, not a tap: it reads as confident | rising ticks |
| 3.5 | the finger taps "נעלתי"; the lock closes; your tick appears in the waiting row | click |
| 3.7–4.0 | hold on the locked 10 | music stops |
| **4.0** | THE TWIST. The question card flips over and becomes the reveal's card: title **"השאלה האמיתית"**, card **"כמה אתם טובים בחניה ברוורס?"**. Same card, other side: that is the carry | boom, shake |
| 4.6 | sticker: **"כל השאר נשאלו משהו אחר"**. Your cucumber face peeks in at a corner with a sweat drop | gulp |
| **5.0**–7.0 | the cells flip on the beats: תומר 7/10 (5.0), שירה 6/10 (5.5), נועה 4/10 (6.0), דנה 5/10 (6.5), איתי 8/10 (7.0). The camera travels down the grid | flips, rising |
| 7.2–8.0 | a breath: the camera pushes in on your face-down cell | music thin |
| **8.0** | your cell flips: **10/10**, tag "אתם" | boom, crowd "oooh", shake |
| 8.4–9.6 | reactions fly at your cell: 🤨 👀 😂 💀 | pops |
| 9.0 | the title becomes **"מי פה משקר?"** (the game's discussion title) | |
| **10.0** | big yellow sticker: **"מהר, תאלתרו תירוץ!"** | stamp |
| 11.0–11.8 | the vote: voters' small faces fly to the tiles. Three land on תומר, two on you | ticks |
| **12.0** | **"ברח!"** stamps in. Your cucumber figure, smug, name tag "יובל", rays, a confetti burst | music drops, cheer |
| 12.5 | **"עבדתם על כולם!"** and the "+300" chip | coin |
| 12.8–13.7 | the card rises: tag "השאלה שלכם הייתה", "כמה אתם טובים בלשקר לאמא?", then the bubble "והתשובה: 10", then "כל השאר נשאלו: כמה אתם טובים בחניה ברוורס?" | swish, pop, laugh |
| 13.8–15.0 | still: both questions and the 10 on one card | |
| **15.0** | end card whips in | whip |
| **16.0** | wordmark lands | the music's last hit |
| 18.0 | end | |

## Key frames for `sheet_keys.png`

0.0 · 3.0 · 4.3 · 8.2 · 10.3 · 12.3 · 14.5 · 17.6

## Notes

- **Stickers.** The four stickers ("POV: אתם השתול", "ואתם עוד לא יודעים את זה", "כל השאר נשאלו משהו אחר", "מהר, תאלתרו תירוץ!") are ours, not the game's. Build them from the game's own sticker and chip styles so they belong. They sit over the UI in screen space or ride the world; choose what reads best, but they must never cover the question text.
- **Reading holds.** The real question (4.0 to about 5.2) and the final card (13.8 to 15.0) are the two moments the viewer must be able to read. Camera at rest, text at least 40 px tall.
- **The name tag** says "יובל" while the cell says "אתם". That is how the game shows it; keep it.
- **The reaction bar:** hide the 🍆 button.
- **Music shape** (plan C from `MUSIC.md` as the base): calm 0–4, stop at about 3.7, twist hit at 4.0, thin through 4–8 with a breath before 8.0, groove 8–12, drop at 12.0, last hit at 16.0.
