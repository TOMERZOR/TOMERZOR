# SHARD

A premium-minimal physics puzzle: pull back, release, and shatter every piece of glass with as few balls as possible. Plain HTML, CSS and JavaScript modules (no build step), with [planck.js](https://github.com/piqnt/planck.js) for physics. The iOS and Android apps wrap this folder with Capacitor (see `../shard-app`).

Run locally: `python3 -m http.server 8080` in this folder, then open http://localhost:8080. Add `?test` to the URL to walk through simulated ads and purchases.

## Code map
| File | What it does |
|---|---|
| `js/engine.js` | Physics world built from level JSON: breakable glass (pierce, shards), stone, wood, bounce pads, bombs, ropes, moving platforms; win and lose detection. Shared with the Node solver, so it takes planck as a parameter. |
| `js/game.js` | One level session: slingshot input, fixed 60 Hz stepping with interpolation, slow motion, screen shake, sound and haptic events. |
| `js/render.js` | Canvas renderer: cached static layer, glass with specular streaks, shards, particles, aim preview, the cannon. |
| `js/main.js` | Screens and flows: home (with a live demo), levels, HUD, win/lose/pause sheets, hints, continues, daily puzzle and streak, ball shop, store, settings, reminders. |
| `js/audio.js` | Recorded glass, explosion and cannon sounds (assets/sfx) layered with synthesized bell tinkles; a generative ambient pad. Falls back to pure synthesis. |
| `js/monetization.js` | AdMob (rewarded and interstitial) and RevenueCat purchases behind one interface. Interstitial pacing: from level 12, every 3 clears, at least 150 s apart. |
| `js/save.js` | Versioned localStorage save with a backup copy. |
| `js/levels.js` | **Generated.** 120 campaign levels and 100 daily levels, each with a solver proof. |
| `js/theme.js` | World palettes and the 12 balls. |

## Levels
`tools/gen-levels.mjs` composes levels from set pieces (`tools/pieces.mjs`), rejects anything that isn't stable at rest, and searches for a solution with the real engine (`tools/solver.mjs`): every candidate angle at 1.25° steps, beam search up to 3 shots. A level is kept only when its winning shot still wins 0.6° to either side (and with timing offsets when platforms move), so nothing needs pixel-perfect aim. Difficulty sorts each world into a curve with breather levels. The first three levels are hand-made (`tools/tutorial.mjs`).

```bash
cd tools && npm install
node gen-levels.mjs --pool 44 --daily 100   # about 30 minutes on 4 cores
```

## QA tools (`tools/qa`)
- `shot.mjs <scenario>`: Playwright on a phone viewport with screenshots and console errors (scenarios in `qa/scenarios`).
- `gallery.html`: every level at a glance.
- `scenarios/proofs.mjs`: replays each level's proof in the browser.
- `trailer.mjs` + `mix.py`: frame-perfect 1080×1920 trailer with a soundtrack built from the game's sounds.
- `storeshots.mjs`: App Store screenshots from real game moments.
- `icon.html`: the app icon, drawn in code.
