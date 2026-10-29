# Bloom

A gravity puzzle for phones. You drop bundles of coloured seeds into a garden; four or more seeds of one colour that touch bloom into flowers and disappear, everything above falls, and the fall can set off the next bloom: a chain. Weeds push up from below every few drops and only wither when something blooms next to them. The game ends when no bundle fits.

English, static site, no build step:

```
npx http-server -p 8093 .     # from the repo root, then open http://localhost:8093/bloom/
```

When you change a file, bump `CACHE` in `sw.js` (and the `?v=` numbers in `index.html` for the stylesheet and `main.js`) so phones load the new version.

## How to play

- **Drag** a bundle from the tray over the garden and let go: each seed drops down its own column. A ghost shows where the seeds will land, and seeds that would bloom pulse.
- **Tap** a bundle to turn it.
- **Bloom:** 4+ touching seeds of one colour. The garden is 8 columns by 10 rows and opens with three planted rows (no ready-made blooms, plenty of pairs and threes to build on).
- **Chains:** a bloom that makes seeds fall into a new bloom. Points per link: 10 a seed, +15 for each seed past four in a group, 20 a weed, then x2, x3, x5, x8, x12 ... for the 2nd, 3rd, 4th ... link.
- **Special flowers:** a group of 6-7 leaves a **sunflower** behind (it blasts a 3x3 when it blooms); 8+ leaves a **rainbow flower** (it blooms every seed of its colour). Specials set each other off.
- **Weeds:** a counter under the garden says when the next ones come. They push up from the bottom of several columns and only go when a bloom touches them.
- **Clean garden:** blooming every last seed (after clearing at least 12 in that drop) is worth +3000.
- **Second chance:** once per game, when nothing fits: the top four rows burst into flowers, the tray is refilled with kind bundles and the weeds hold off for three more drops. This is the place for a rewarded ad if the game is ever monetised.
- First game: short hints explain dropping, blooming, turning and weeds.

## What keeps people playing

**The engine (`js/engine.js`).** Every time a slot in the tray empties, the engine reads how the player is doing and picks the next bundle: its shape and the colour of every seed. It also paces the weeds. It never changes the garden behind the player's back. It computes a "mercy" value from 0 (tough) to 1 (kind):

| Signal | Effect |
|---|---|
| First three games | kinder (the first games should feel great) |
| First ~12 drops of every game | kinder |
| Garden more than 40% full, or a column near the top | kinder |
| 3+ drops without a bloom | kinder; after 6 a "rescue" bundle guaranteed to bloom right away |
| Last three games well below the player's median | kinder |
| Long thinking time | slightly kinder |
| Low garden and chains going | tougher (cruising → build tension) |
| Within 25% of the best score | kinder (the record falling is the biggest reward moment) |
| Well past the best score | tougher |
| A slow wave over the game | tension and release |
| Late in the game (from drop 40, full by 110) | the help fades and turns into pressure, so even great runs end while still fun |

Kind bundles use colours that are already showing on top of the columns (weighted by the group they would join), are more often single-coloured and smaller; tough ones mix colours and come in wide shapes. Each candidate is tested in every turn and column: does it bloom, how big, how long a chain, how high the garden ends up. A bundle never blooms on its own (at most three seeds of one colour).

Difficulty also climbs on its own: 4 colours for a new player's opening, 5 from drop 30 (or straight away from the third game), 6 from drop 55. Weeds start every 7 drops in 3 columns and speed up to every 3 drops in up to 7 columns; when the engine is being kind they wait one drop longer.

Turn on **Settings → developer mode** to see the mercy value, the reasons, the weed pace and the last bundle's stats while you play.

**Look.** A dark, glassy "night garden" interface: deep teal with drifting teal, green and coral glows behind frosted cards, a coral-to-peach accent for the main actions and mint progress bars, the Outfit typeface, line icons, a level ring and bottom sheets for every dialog. Seeds are soft clay shapes, and each colour has its own silhouette (round, square, drop, leaf, hexagon, clover), so groups read by shape too, which also helps colour-blind players.

**Feedback.** Seeds of the same colour are joined by soft bridges, so groups read at a glance. Blooms open into flowers in a wave and burst into petals; the clear sound climbs a pentatonic scale with the chain; banners for chains ("Chain x3!"), big blooms and new specials; screen shake grows with the chain and specials. The sky over the garden glows red when a column nears the top. Passing the best score mid-game fires "New best!".

**Near misses.** The HUD counts down "X to beat your best!" from 70% of your best. The game-over screen says "So close!" and how many points were missing, and shows the nearest unfinished goal.

**Between games (`js/meta.js`).** Levels from XP, each planting a flower in the garden on the home screen (the next one is a bud that grows with XP); a daily streak with growing gems and a streak freeze; three daily missions (bloom N groups, chain xN, score N, play N games, bloom N seeds at once, pull N weeds, make N special flowers); a lucky chest that fills with blooms and holds a random amount of gems (sometimes a jackpot); skins bought with gems (Clay, Glass, Pastel, Gems, Neon). Progress and the game in progress are saved in the browser.

## Where the line is

The engine helps players towards fun; it never sabotages them to sell a way out. No paid boosters, no lives or energy timers, no loot boxes, no hidden odds. If monetisation is added, keep it that way: a rewarded ad on the second chance and cosmetic skins are fine; making the game harder to sell help is not (and runs into app store rules and consumer protection law, especially for children).

## Files

- `js/board.js`: the garden, dropping, gravity, groups, blooms, chains, specials, weeds, the planted opening.
- `js/pieces.js`: the five bundle shapes.
- `js/rules.js`: scoring.
- `js/engine.js`: the adaptive engine (above).
- `js/render.js`: canvas drawing of the garden, seeds, flowers, tray, drag and effects.
- `js/garden.js`: the home-screen garden.
- `js/audio.js`: all sounds, synthesised with Web Audio.
- `js/meta.js`: levels, gems, streak, missions, chest, skins, saved game.
- `js/main.js`: input, the drop → bloom → fall → weeds sequence, HUD, hints, modals.

## Tests

```
node bloom/test/sim.mjs [games=8] [players=8]   # weak/casual/strong simulated players, engine vs plain random bundles
node bloom/test/play.cjs <outDir> [drops=40]    # plays in a phone-sized browser with real taps and drags, saves screenshots (needs the server on :8093)
node bloom/test/icons.cjs [previewDir]          # redraws the app icons
```

A recent `sim.mjs 6 6` run (drops per game, p10 / median / p90):

| Player | Random bundles | Engine |
|---|---|---|
| weak | 34 / 57 / 73 | 82 / 95 / 111 |
| casual | 63 / 82 / 99 | 96 / 111 / 130 |
| strong | 85 / 102 / 114 | 99 / 128 / 149 |

With the engine, weak players' games last about as long as strong players' do with random bundles, and everyone's games still end; skill shows in the score (median 6,500 weak vs 9,075 strong).
