# S1 · "מי השתול?" (guess along)

18.0 s. The viewer plays one round as a detective: reads the question, sees six answers, gets three seconds to pick the odd one out, then watches the plant get caught and learns what the plant was really asked.

It teaches the core of the game: everyone answered the same question except one person, and the job is to find them.

## The pair

A real pair from the game's bank (id 573, clean), word kind:

| | |
|---|---|
| Everyone's question | חיה שהייתם רוצים לראות בספארי |
| The plant's question | חיה שהכי דומה לכם כשאתם רוקדים בחתונה |
| Kind | text (the answer screen's chip says "עונים במילה או שתיים") |
| "אתם" | נועה (p2, onion), with a normal answer |
| The plant | תומר (p1, carrot, crown). Not יובל: he is the plant in the film and in S3, and a returning viewer would know |

The six answers, in the order the game reveals the cells (right to left, top to bottom):

| Cell | Player | Answer |
|---|---|---|
| 1 | שירה | ג'ירפה |
| 2 | תומר | **פינגווין** (the plant) |
| 3 | דנה | אריה |
| 4 | נועה ("אתם") | פיל |
| 5 | יובל | נמר |
| 6 | איתי | זברה |

There are no penguins on a safari, so a sharp viewer can find it. The payoff is the picture the reveal puts in your head: תומר dancing at a wedding like a penguin.

## Screens

- `reveal` for the text kind (`demo=reveal&kind=text&n=6`, face-down and flipped): title "השאלה האמיתית", the question card, six cells with big words.
- The vote title "מי השתול?" (from `vote`, already in `../vendor/screens.js`).
- `result` (caught) along its timeline: roulette, the figure, "נתפס!", "תפסתם אותו!" with "+100", the card (tag "השאלה של תומר הייתה", the plant's question, bubble "והתשובה: פינגווין", "אתם נשאלתם: …"). The captured states in `../vendor/screens.js` are for יובל and the number kind; re-skin them for תומר (carrot figure with the crown, name tag, tag text) and the word answer.

## Beats

Anchor times are fixed (they sit on the music). Everything between them is yours.

| t | Picture | Sound |
|---|---|---|
| **0.0** | Frame 0: six avatars in a row, faces calm, and a pink sticker above them already on screen: **"אחד מהם קיבל שאלה אחרת"** | pop, light music |
| 0.5 | second line, yellow: **"תמצאו אותו?"** | pop |
| **1.0** | the reveal title **"השאלה האמיתית"** and the question card land under the sticker; **"חיה שהייתם רוצים לראות בספארי"** rises word by word | thud, swish |
| 1.4–1.9 | the six avatars dive into six face-down cells (the carry: the row becomes the grid) | swishes |
| **2.0**–4.5 | the cells flip on the beats, one per beat: 2.0, 2.5, 3.0, 3.5, 4.0, 4.5. The plant's cell is second and gets no special treatment | flips, rising pitch |
| 4.5–6.0 | the camera pulls back until the question and all six answers are in frame together, and rests | |
| **6.0** | the title becomes **"מי השתול?"**. A countdown ring appears beside it: 3 (6.5), 2 (7.0), 1 (7.5). The hook sticker leaves | stamp, `count` ×3, music thin |
| **8.0**–9.5 | the spotlight roulette: a light hops between the six cells, fast then slowing, the others dim. It lands on תומר's cell at 9.5 | roulette ticks slowing; the track's own riser peaks here |
| **10.0** | **"נתפס!"** stamps in. תומר's figure (carrot, caught: wide eyes, crying), name tag "תומר", rays | the groove drops, cheer, shake |
| 10.6 | **"תפסתם אותו!"** and the "+100" chip | coin |
| 11.5–13.1 | the card rises: tag **"השאלה של תומר הייתה"**, then **"חיה שהכי דומה לכם כשאתם רוקדים בחתונה"** (11.8), the bubble **"והתשובה: פינגווין"** (12.6), then **"אתם נשאלתם: חיה שהייתם רוצים לראות בספארי"** (13.1) | swish, pop, laugh at 12.8 |
| 13.3–15.0 | still: both questions and the answer on one card | |
| **15.0** | end card whips in (`cta: 'תצליחו לתפוס את השתול?'`) | whip |
| **16.0** | wordmark lands | the music's last hit |
| 18.0 | end | |

## Key frames for `sheet_keys.png`

0.0 · 1.8 · 5.5 · 7.0 · 9.5 · 10.3 · 14.0 · 17.6

## Notes

- **The puzzle has to be fair.** From 4.5 to 8.0 the viewer must be able to see the question and all six answers at once, large enough to read (at least 40 px tall), camera at rest. That is the whole point of this short.
- **The game's strings stay as they are.** "נתפס!", "תפסתם אותו!" and "השאלה של תומר הייתה" are the game's own wording.
- **The countdown ring** is the game's own timer ring (the header's), drawn large. It is the only new device in this short.
- **The roulette** is the film's (`SPOT` and `uResult` in `../film.js`), shortened.
- **The reaction bar:** hide the 🍆 button, or keep the bar out of frame.
- **Music:** plan A from `MUSIC.md`. Light intro 0–8 (thin it a little under the countdown 6–8), the track's own build and riser 8–10, the groove drops at 10.0, last hit at 16.0.
