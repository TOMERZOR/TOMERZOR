# SHARD

A premium-minimal physics puzzle: pull back, release, and shatter every piece of glass with as few balls as possible. Plain HTML, CSS and JavaScript modules (no build step), with [planck.js](https://github.com/piqnt/planck.js) for physics. The iOS and Android apps wrap this folder with Capacitor (see `../shard-app`).

Run locally: `python3 -m http.server 8080` in this folder, then open http://localhost:8080. Add `?test` to the URL to walk through simulated ads and purchases.

## Code map
| File | What it does |
|---|---|
| `js/engine.js` | Physics world built from level JSON: breakable glass (pierce, shards), frosted glass (cracks on the first hit, breaks on the second; the ball bounces off it), locked glass that only breaks once its gold key glass has, stone, wood, bounce pads, bombs, ropes, moving platforms; win and lose detection. Shared with the Node solver, so it takes planck as a parameter. |
| `js/game.js` | One level session: slingshot input, fixed 60 Hz stepping with interpolation, slow motion, screen shake, sound and haptic events. |
| `js/render.js` | Canvas renderer: cached static layer, glass with specular streaks (frosted glass milky with an inner wall and its crack, padlocks, the gold key), shards, particles, aim preview (it marks locked glass like a wall), the cannon. |
| `js/main.js` | Screens and flows: home (with a live demo), levels, HUD, win/lose/pause sheets, hints, continues, a coach line the first time each new kind of glass appears, daily puzzle and streak, ball shop, store, settings, reminders. |
| `js/audio.js` | Recorded glass, explosion and cannon sounds (assets/sfx) layered with synthesized bell tinkles, the crack of frosted glass, the clunk of a lock and the chime of locks opening; a generative ambient pad. Falls back to pure synthesis. |
| `js/monetization.js` | AdMob (rewarded and interstitial) and RevenueCat purchases behind one interface. Interstitial pacing: from level 12, every 3 clears, at least 150 s apart. |
| `js/save.js` | Versioned localStorage save with a backup copy. |
| `js/levels.js` | **Generated.** 120 campaign levels (made harder by `tools/harden-levels.mjs`) and 100 daily levels, each with a solver proof. |
| `js/theme.js` | World palettes and the 12 balls. |

## Levels
`tools/gen-levels.mjs` composes levels from set pieces (`tools/pieces.mjs`), rejects anything that isn't stable at rest, and searches for a solution with the real engine (`tools/solver.mjs`): every candidate angle at 1.25° steps, beam search up to 3 shots. A level is kept only when its winning shot still wins 0.6° to either side (and with timing offsets when platforms move), so nothing needs pixel-perfect aim. Difficulty sorts each world into a curve with breather levels. The first three levels are hand-made (`tools/tutorial.mjs`).

`tools/harden-levels.mjs` then makes the campaign harder without changing a layout. Some glass turns frosted (two hits, and the ball bounces off the first one, so one shot no longer pierces a whole row) and, from Lilac's seventh level on, some glass is locked behind a gold key glass. Each level tries up to eight variants (single frosted pieces, pairs, lock sets) and keeps the one that a skilled-player bot clears about as often as the level's place in its world asks: from 85% to 62% across the second half of Dawn, down to 68% to 42% across Night, with every fifth level a breather. The bot (`tools/playtest-bot.mjs --look 3`) aims where the guide shows glass, weighs three of those shots by playing each out, and fires the best with a degree of hand error. Every variant must stand still at rest and is solved again for its par and proof. Dawn's first twelve levels and the first level of every world stay as they were. Measured again on fresh seeds, the skilled bot's first-try clear rate went from 79% to 71% over the campaign (Lilac 73% to 64%, Ember 82% to 72%, Night 74% to 63%). The campaign before hardening is `tools/levels-base.js`; the result per level is in `tools/harden-report.txt`.

```bash
cd tools && npm install
node gen-levels.mjs --pool 44 --daily 100 --out levels-base.js   # about 30 minutes on 4 cores
node harden-levels.mjs                                           # about 16 minutes on 4 cores; writes ../js/levels.js
node playtest-bot.mjs 16 --look 3                                # how often a skilled player clears each level
```

## QA tools (`tools/qa`)
- `shot.mjs <scenario>`: Playwright on a phone viewport with screenshots and console errors (scenarios in `qa/scenarios`).
- `gallery.html`: every level at a glance.
- `scenarios/proofs.mjs`: replays each level's proof in the browser.
- `scenarios/newglass.mjs`: frosted glass cracking and breaking, and locks opening when the gold key breaks, on a phone.
- `trailer.mjs` + `mix.py`: frame-perfect 1080×1920 trailer with a soundtrack built from the game's sounds.
- `storeshots.mjs`: App Store screenshots from real game moments.
- `icon.html`: the app icon, drawn in code.
