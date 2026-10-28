# פריחה · Bloom

A block puzzle for phones in the spirit of Block Blast. Drag pieces onto an 8x8 board; a full row or column bursts into petals. Clear lines in a row for a combo. The game ends when none of the three pieces in the tray fits.

Hebrew, static site, no build step:

```
npx http-server -p 8093 .     # from the repo root, then open http://localhost:8093/bloom/
```

When you change a file, bump `CACHE` in `sw.js` (and the `?v=` numbers in `index.html` for the stylesheet and `main.js`) so phones load the new version.

## What keeps people playing

The design goal is that every game feels fair, every session ends on "almost", and there is always a next thing within reach. Nothing is paid; the one place an ad could go later is marked below.

**In the game (the engine, `js/engine.js`).** Whenever the tray empties, the engine reads how the player is doing and picks the next three pieces. It never changes the board, only what comes next. It computes a "mercy" value from 0 (tough) to 1 (kind):

| Signal | Effect |
|---|---|
| First three games | kinder (honeymoon: the first games should feel great) |
| First ~20 moves of every game | kinder (early deaths feel unfair and make people quit) |
| Board more than 42% full | kinder, growing with the fill |
| 4+ moves without a clear | kinder; after 7 a "rescue" tray that is guaranteed to complete a line right now |
| Last three games well below the player's median | kinder (a losing streak breaks the habit) |
| Long thinking time | slightly kinder |
| Empty board and a running combo | tougher (cruising → build tension) |
| Within 25% of the best score | kinder (the record falling is the biggest reward moment) |
| Well past the best score | tougher |
| A slow sine wave over the game | tension and release, like the sawtooth difficulty of Candy Crush levels |
| Very long game (80+ moves) | tougher (sessions should end while still fun) |

It then samples ~26 candidate trays (easy shapes favoured when kind, awkward ones when tough), checks each one (can all three be placed? how many lines can a sensible player clear with it? could it wipe the whole board?) and picks the best fit for the mood. Kind trays are always solvable; a tray with no way to place all three only appears in the engine's toughest mood.

Turn on **Settings → developer mode** to see the mercy value, the reasons and the tray's stats live while you play.

**Feedback ("juice").** Clears pop in a wave from where the piece landed, throw petals and sparks, shake the screen and float the points. The clear sound climbs a pentatonic scale with the combo, so a streak sounds like it's going up. Lines that a dragged piece would complete light up in its colour before you let go. Praise words grow with the clear ("יפה!" … "בלתי נתפס!"). Passing the best score mid-game fires a "שיא חדש!" banner and fanfare.

**Near misses.** The HUD counts down "עוד X לשיא!" once you pass 70% of your best (pulsing past 90%). The game-over screen says "כמעט!" and how many points were missing, and shows the nearest unfinished goal (chest, mission).

**Second chance.** Once per game, when nothing fits: if the board is crowded the densest 3x3 is blasted, then a rescue tray is dealt. This is the place for a rewarded ad if the game is ever monetised.

**Between games (`js/meta.js`).**
- **Levels and the garden.** Every point is XP. Each level plants a new flower in the garden on the home screen; the next flower is a bud that grows with your XP (and the first flower is a gift, so the garden is never empty). New players start with the XP bar part-filled (endowed progress).
- **Daily streak.** Opening the game on a new day gives gems that grow with the streak (+5 a day, up to 50) and says what tomorrow is worth. Missing a single day uses a streak freeze (you start with one and earn one every 7 days, up to 2), so one busy day doesn't wipe the streak.
- **Daily missions.** Three a day, picked from the date (clear N lines, reach combo xN, score N, play N games, clear N lines at once, place N pieces), harder as you level. A toast pops the moment one completes mid-game; finishing all three gives a bonus.
- **Lucky chest.** Fills with cleared lines (starts a quarter full). What's inside varies: usually 15-25 gems, sometimes 30-50, rarely an 80-120 jackpot.
- **Skins.** Gems buy block styles: Jelly (free), Candy, Pastel, Gems, Neon.

Progress and the game in progress are saved in the browser (localStorage), so closing the app mid-game resumes where you were.

## Where the line is

The engine helps players towards fun; it never sabotages them to sell a way out. There are no paid boosters, no lives or energy timers, no loot boxes and no hidden odds. If monetisation is added, keep it that way: rewarded ads on the second chance and cosmetic skins are fine; making the game harder to sell help is not (and runs into app store rules and consumer protection law, especially for children).

## Files

- `js/pieces.js`: the 13 piece families and all their rotations, each with a draw weight and an awkwardness score.
- `js/board.js`: the board, placing, line clears.
- `js/rules.js`: scoring (1/2/3/4 lines = 100/300/600/1000, times 1 + 0.5 per combo step; board clear +2000) and the combo window (a combo survives while every 3 moves clear something).
- `js/engine.js`: the adaptive tray engine (above).
- `js/render.js`: canvas drawing of the board, tray, drag, block skins and effects.
- `js/garden.js`: the home-screen garden.
- `js/audio.js`: all sounds, synthesised with Web Audio.
- `js/meta.js`: levels, gems, streak, missions, chest, skins, saved game.
- `js/main.js`: input, game flow, HUD, modals.

## Tests

```
node bloom/test/sim.mjs [games=12] [players=12]   # weak/casual/strong simulated players, engine vs plain random trays
node bloom/test/play.cjs <outDir> [moves=40]      # plays in a phone-sized browser with real drags, saves screenshots (needs the server on :8093)
node bloom/test/icons.cjs                         # redraws the app icons
```

A recent `sim.mjs 8 8` run (moves per game, p10 / median / p90):

| Player | Random trays | Engine |
|---|---|---|
| weak | 11 / 20 / 31 | 14 / 32 / 71 |
| casual | 17 / 29 / 50 | 20 / 56 / 127 |
| strong | 26 / 62 / 157 | 71 / 128 / 179 |

With the engine, casual players' games last about twice as long, games over in under 25 moves drop from 28% to 16%, and strong players get fewer very short games but still meet an end.
