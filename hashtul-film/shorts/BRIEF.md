# Three shorts for השתול: director's brief

Read this, then your own `sN/STORYBOARD.md`, then `KIT.md` and `MUSIC.md`.

## What we are making

Three 18.0 s vertical shorts (1080×1920) for TikTok and Reels. Each one gives a taste of the game's question pairs: the question everyone gets, and the different question the plant ("השתול") gets. A viewer who has never heard of the game should finish each short knowing what you do in it.

They look like the finished film (`../hashtul.mp4`, source `../film.js`): the game's own UI (its captured DOM, CSS, fonts and characters), an operated hand-held camera, a finger wherever something is pressed, and nothing replaced without something carrying over.

| | Short | The viewer is | Question kind | Ends with |
|---|---|---|---|---|
| S1 | "מי השתול?" guess along | a player hunting the plant | word | "נתפס!" and the plant's question |
| S2 | three question pairs, rapid fire | watching three plants squirm | number, player, choice | three flips |
| S3 | "POV: אתם השתול" | the plant | rate yourself 1–10 | "ברח!" |

## The game in four lines

This is the game's own how-to text. When a storyboard needs explanatory copy, it comes from here.

1. כל אחד מקבל שאלה לטלפון ועונה בשקט. מספר, מילה, או מישהו מהחדר.
2. אחד מכם, השתול, קיבל שאלה אחרת לגמרי. הוא עוד לא יודע את זה.
3. השאלה האמיתית נחשפת עם כל התשובות. עכשיו השתול מבין, וחייב לאלתר תירוץ.
4. מתווכחים, מצביעים מי השתול, ואז מגלים על איזו שאלה הוא באמת ענה.

## Cast

The game's demo cast, the same six as the film:

| id | name | character | notes |
|---|---|---|---|
| p1 | תומר | carrot | host, wears the crown |
| p2 | נועה | onion | "אתם" in the film and in S1 |
| p3 | איתי | corn | |
| p4 | שירה | peach | |
| p5 | יובל | cucumber | the plant in demo mode; "אתם" in S3 |
| p6 | דנה | lemon | |

## Where the real screens come from

The game has a client-side demo mode (no server traffic beyond static files):

```
https://hashtul.onrender.com/?demo=<phase>[-<kind>]&kind=<kind>&n=6&me=p2&mole=1&at=<ms since the phase started>
```

- Phases: `lobby`, `answer`, `answered`, `reveal`, `discuss`, `vote`, `voted`, `result`, `result-escaped`, `scores`, `final`.
- Kinds: `number`, `player`, `text`, `choice`, `scale`.
- `mole=1` makes you the plant (always p5, יובל). `me=pN` picks who you are otherwise.
- `at` moves along a phase's own timeline (the result phase goes tally → roulette → verdict → card → gains).

`../vendor/screens.js` already holds 22 captured states of the number kind (built by `../tools/build_vendor.py` from `../ref/`). If your short needs another kind or state, capture it yourself the same way into `shorts/sN/screens.js`. Be gentle with the site: a handful of page loads, not a loop.

The demo's own question text is only a placeholder. The questions and answers in your storyboard replace it.

## Timing contract (all three shorts)

- **Duration:** 18.0 s.
- **Grid:** beats fall on every 0.5 s of film time, bar lines on even seconds. Big accents sit on bar lines, the rest on beats. Motion between them is free.
- **End card:** `KIT.endcard({ t0: 15.0, cta: 'תצליחו לתפוס את השתול?' })`. The wordmark lands at 16.0 on the music's last hit. The frame is still from about 17.4, and the short ends at 18.0.
- **Music:** each short declares its own `music` plan in its events (see `MUSIC.md`). Take the base segments from the sound engineer's plan for your short and add your own `stops` and `thin` ranges.

## Hard rules

- **Copy:** Hebrew exactly as written in the storyboard. Most of it is the game's own wording. If a line does not fit, tell me; do not reword it.
- **Safe zone:** nothing that must be read in the top 150 px, the bottom 420 px, or the right 130 px of the lower half of the frame (`KIT.SAFE`).
- **Readability:** any text that must be read is at least 40 px tall on the 1080×1920 frame, stays at least 1.2 s, and is not travelling while it is read. The camera rests (float off) during reading holds.
- **Clean for TikTok:** no sexual content. The 🍆 reaction must not appear anywhere: hide that button in the reaction bar. Flying reactions come from 😂 🤨 👀 💀 🔥.
- **Purity:** every value is a function of `t`. No CSS animations or transitions, no clock or random numbers at seek time.
- **Frame 0:** already a designed frame, never empty. TikTok shows it as the cover and viewers decide in the first second.
- **Loop:** the cut from the last frame back to the first should not jar.
- **Shared files:** do not edit `kit.js`, `endcard.js`, `../vendor/`, `../tools/`, `../audio/`, `../film.js`. If the kit lacks something, build it in your own short and tell me. If you find a kit bug, tell me; do not fork a silent fix.
- **Machine:** four cores, shared with other agents. Stills are cheap. Drafts at 30 fps with at most 2 workers. Never 60 fps: I run the finals. Each short renders into its own directory `../out/sN/`, because the renderer keeps frames in `<dirname(out)>/_frames`.
- **Git:** no add, commit or push.

## What you deliver, in `shorts/sN/`

- `comp.html` and `film.js`, plus `screens.js` if you captured extra states.
- The question data at the top of `film.js` as one plain object (questions, answers, who the plant is), so a different pair can be swapped in later without touching the animation.
- `events.json`, including the `music` plan:
  `python3 tools/dump_events.py "" shorts/sN/events.json --comp shorts/sN/comp.html`
- Two contact sheets that you have looked at yourself:
  - `out/sN/sheet_all.png`: one tile per second, 0.0 to 17.9, 270 px wide.
  - `out/sN/sheet_keys.png`: the key frames named in the storyboard, 540 px wide.
- A 30 fps draft `out/sN/draft.mp4`, with sound if the mix works for your events (`python3 audio/score.py shorts/sN/events.json shorts/sN/mix.wav`), silent otherwise.

## Check your own work before you report

Look at your stills with the Read tool and answer honestly:

1. Does frame 0 hook? By 3 s, can a stranger tell that people answered a question and one of them is off?
2. Is every line of text fully inside the frame and the safe zone, unclipped, in the right RTL order?
3. Do both questions, everyone's and the plant's, each get a clean, still, readable moment?
4. Is there a frame where the screen is empty, or where something pops in or out with nothing carrying it?
5. Any overlapping text? Are the avatars the right characters with the right names? Does the plant's answer match the storyboard?
6. No page errors, and the purity check passes?

## What to report

- What differs from the storyboard, and why.
- What you are unsure about.
- Exact paths of the sheets and the draft.

I review the pictures myself and come back with corrections.
