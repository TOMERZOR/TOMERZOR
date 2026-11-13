# S1 · "מי השתול?" (guess along)

18.0 s. The viewer plays one round as a detective: reads the question, sees six answers, gets three seconds to pick the odd one out, then watches the plant get caught and learns what the plant was really asked.

It teaches the core of the game: everyone answered the same question except one person, and the job is to find them.

## The pair

TBD(bank): filled in by the director once the question bank is harvested. The kind is **text** (a word or two per answer), so the six answers read as big words in the cells and the odd one is not obvious at a glance.

| | |
|---|---|
| Everyone's question | TBD |
| The plant's question | TBD |
| Kind | text |
| Answers (cell order) | TBD ×6 |
| "אתם" | נועה (p2, onion), with a normal answer |
| The plant | דנה (p6, lemon). Not יובל: he is the plant in the film and in S3, and a returning viewer would know |

## Screens

- `reveal` for the text kind (`demo=reveal&kind=text&n=6`, face-down and flipped): title "השאלה האמיתית", the question card, six cells with big words.
- The vote title "מי השתול?" (from `vote`, already in `../vendor/screens.js`).
- `result` (caught) along its timeline: roulette, the figure, "נתפס!", "תפסתם אותו!" with "+100", the card (tag "השאלה של דנה הייתה", the plant's question, bubble "והתשובה: …", "אתם נשאלתם: …"). The captured states in `../vendor/screens.js` are for יובל and the number kind; re-skin them for דנה (lemon figure, name tag, tag text) and the text answer.

## Beats

Anchor times are fixed (they sit on the music). Everything between them is yours.

| t | Picture | Sound |
|---|---|---|
| **0.0** | Frame 0: six avatars in a row, faces calm, and a pink sticker above them already on screen: **"אחד מהם קיבל שאלה אחרת"** | pop, curious music |
| 0.5 | second line, yellow: **"תמצאו אותו?"** | pop |
| **1.0** | the reveal title **"השאלה האמיתית"** and the question card land under the sticker; the question rises word by word | thud, swish |
| 1.4–1.9 | the six avatars dive into six face-down cells (the carry: the row becomes the grid) | swishes |
| **2.0**–4.5 | the cells flip on the beats, one per beat: 2.0, 2.5, 3.0, 3.5, 4.0, 4.5. The plant's cell is NOT last and gets no special treatment | flips, rising pitch |
| 4.5–6.0 | the camera pulls back until the question and all six answers are in frame together, and rests | |
| **6.0** | the title becomes **"מי השתול?"**. A countdown ring appears beside it: 3 (6.5), 2 (7.0), 1 (7.5). The hook sticker leaves | stamp, three ticks, music thins |
| **8.0**–9.5 | the spotlight roulette: a light hops between the six cells, fast then slowing, the others dim. It lands on the plant's cell at 9.5 | roulette ticks slowing, suspense |
| **10.0** | **"נתפס!"** stamps in. The plant's figure (lemon, crying), name tag "דנה", rays | music drops, cheer, shake |
| 10.6 | **"תפסתם אותה!"** and the "+100" chip | coin |
| 11.5–13.1 | the card rises: tag **"השאלה של דנה הייתה"**, the plant's question (11.8), the bubble **"והתשובה: …"** (12.6), then **"אתם נשאלתם: …"** (13.1) | swish, pop, laugh at 12.8 |
| 13.3–15.0 | still: both questions and the answer on one card | |
| **15.0** | end card whips in | whip |
| **16.0** | wordmark lands | the music's last hit |
| 18.0 | end | |

## Key frames for `sheet_keys.png`

0.0 · 1.8 · 5.5 · 7.0 · 9.5 · 10.3 · 14.0 · 17.6

## Notes

- **The puzzle has to be fair.** From 4.5 to 8.0 the viewer must be able to see the question and all six answers at once, large enough to read (at least 40 px tall), camera at rest. That is the whole point of this short.
- **Gender.** דנה is feminine: "תפסתם אותה!" and "השאלה של דנה הייתה". The game's own strings for a caught plant are "תפסתם אותו!" / "תפסתם אותה!" depending on the name; if the captured markup says "אותו", change it.
- **The countdown ring** is the game's own timer ring (the header's), drawn large. It is the only new device in this short.
- **The roulette** is the film's (`SPOT` and `uResult` in `../film.js`), shortened.
- **The reaction bar:** hide the 🍆 button, or keep the bar out of frame.
- **Music shape** (plan A from `MUSIC.md` as the base): light and curious 0–6, thinner under the countdown 6–8, suspense under the roulette 8–10, the groove drops at 10.0, last hit at 16.0.
