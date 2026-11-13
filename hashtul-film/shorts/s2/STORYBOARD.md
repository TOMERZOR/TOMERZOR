# S2 · three question pairs, rapid fire

18.0 s. Three stations, one take. At each station a question card lands, a plant gives an answer that looks ridiculous, and the card flips over to show what that plant was actually asked.

It is the taste of the question bank. It teaches the idea behind every round: one question for everyone, a completely different one for the plant, and the plant's answer is judged against the wrong question.

## The pairs

Three real pairs from the game's bank (ids 855, 928, 1997; all clean), three kinds, three different plants:

| Station | Kind (chip on the card) | Everyone's question | The plant's answer | The plant's question | The plant |
|---|---|---|---|---|---|
| 1 | number ("עונים במספר") | כמה שפות אתם יודעים לדבר? | **6** | כמה טסטים עשיתם עד שעברתם? | שירה (peach) |
| 2 | player ("בוחרים מישהו מהחדר") | את מי פה אפשר לזהות מקילומטר? | **יובל** (with his small cucumber avatar) | למי פה יש את ריח הרגליים הכי קטלני? | איתי (corn) |
| 3 | choice ("בוחרים אחת") | כל כמה זמן אתם מתקשרים לסבתא? | **כל יום** | כל כמה זמן אתם בודקים מה האקס העלה לסטורי? | דנה (lemon) |

Copy the questions character for character.

## One station

Top to bottom inside the safe zone:

- A progress chip in the game's chip style: **"שאלה 1 מתוך 3"**.
- A label sticker above the card: **"כולם נשאלו"** (white). After the flip: **"אבל השתול נשאל"** (pink).
- The question card: the game's own question card from the answer screen (cream, tilted, the big "?" watermark, the kind chip on its corner). Its back is the same card in the plant's pink, the pink the film already uses for the plant's dealt card.
- Under it, the plant: a full-body figure (the result screen's figure, about a third of the frame tall), its name tag, and a big yellow speech bubble with its answer (the result card's bubble style).

The three stations sit side by side in the world. The camera whips from one to the next, right to left, the way Hebrew reads.

## Beats

Anchor times are fixed (they sit on the music). Everything between them is yours.

| t | Picture | Sound |
|---|---|---|
| **0.0** | Frame 0: station 1's plant (שירה) already standing there, innocent, and a white sticker on screen: **"שאלה אחת לכולם."** | pop, groove from the start |
| 0.5 | pink sticker under it: **"ולשתול? אחרת לגמרי."** | pop |
| **1.0** | card 1 lands with its label "כולם נשאלו"; the question rises word by word. The two stickers fold into the progress chip "שאלה 1 מתוך 3" | thud |
| **2.0** | the plant's bubble pops: **6**. The plant looks pleased with itself | pop |
| 3.6–4.0 | everything holds | music stops |
| **4.0** | FLIP 1: the card turns over to pink, the label becomes "אבל השתול נשאל", and the back reads **"כמה טסטים עשיתם עד שעברתם?"**. The plant gulps, a sweat drop | boom, laugh |
| 4.0–5.7 | still enough to read | |
| 5.7–6.0 | whip to station 2 | whip |
| **6.0** | card 2 lands; chip "שאלה 2 מתוך 3" | thud |
| 7.0 | bubble 2: **יובל** with his small avatar | pop |
| 7.6–8.0 | hold | music stops |
| **8.0** | FLIP 2: **"למי פה יש את ריח הרגליים הכי קטלני?"** | boom, laugh |
| 9.7–10.0 | whip to station 3 | whip |
| **10.0** | card 3 lands; chip "שאלה 3 מתוך 3" | thud; the track lifts here |
| 11.0 | bubble 3: **כל יום** | pop |
| 11.6–12.0 | hold | music stops |
| **12.0** | FLIP 3: **"כל כמה זמן אתם בודקים מה האקס העלה לסטורי?"** | boom, the biggest laugh |
| 13.0 | a green **"נתפס!"** stamps onto the third plant | stamp, cheer |
| 13.2–15.0 | still | |
| **15.0** | end card whips in (`cta: 'תצליחו לתפוס את השתול?'`) | whip |
| **16.0** | wordmark lands | the music's last hit |
| 18.0 | end | |

## Key frames for `sheet_keys.png`

0.0 · 2.5 · 4.5 · 7.3 · 8.5 · 11.3 · 13.5 · 17.6

## Notes

- **Reading comes first.** Each question is on screen for about two seconds, so the card text must be large (aim for 60 px tall or more on the 1080×1920 frame) and the camera at rest whenever a question is up. If a question does not fit on three lines at that size, tell me.
- **The flip** is a real turn of the card around its vertical axis (the film's cells flip the same way), cream side to pink side, landing exactly on the bar line. The answer bubble does not change during the flip: the same answer now sits under a different question, and that is the joke.
- **The plants' faces** carry the comedy: pleased before the flip, caught after it (wide eyes, sweat, a gulp). Use the character generator's moods and gaze.
- **The bubble by kind:** station 1 is the bare number, station 2 a player's name with his small avatar (the way the game's reveal cells show a player answer), station 3 the chosen option.
- **"נתפס!"** is the game's own stamp (mint sticker, tilted).
- **Carry between stations:** something should travel with the whip (the progress chip counting up is the minimum).
- **Music:** plan B from `MUSIC.md`. The groove from the start, a short stop before each flip (3.6–4.0, 7.6–8.0, 11.6–12.0) so every flip lands on a downbeat re-entry, the track's own lift at 10.0, last hit at 16.0.
