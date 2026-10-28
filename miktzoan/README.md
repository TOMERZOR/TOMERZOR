# מקצוען סימולטור (Pro Simulator)

A satirical 3D handyman game in Hebrew, in the style of idle-arcade "carry and deliver" games. Pick a trade (plumber, electrician, locksmith, renovator, AC tech or gardener), grab parts from the van, deliver them to neighbours, do the repair mini-game, then choose what to charge: fair price, no receipt, or garage price.

Play: https://tomerzor.github.io/TOMERZOR/miktzoan/

- Static site, no build step: three.js (vendored in `vendor/`), vanilla JS modules, WebAudio for all sound.
- `js/data.js`: trades, job texts, reviews, excuses, upgrade costs. Edit jokes and balance here.
- `js/world.js`: the neighbourhood, roads, houses, cars, cats, lighting, camera. Static scenery is merged into a few meshes at load (`bake()`).
- `js/models.js`: procedural low-poly people, houses, van, items.
- `js/game.js`: carrying, customers, jobs, coins, upgrade pads, helper, days, level-ups.
- `js/minigames.js`: one canvas mini-game per trade.
- `js/ui.js`: HUD, markers and speech bubbles anchored to the 3D world, phone toasts, modals, joystick.

Progress is saved per trade in `localStorage`. Add `?ts=4` to the URL to run the game four times faster when testing.

Preview locally: `npx http-server .` from the repo root and open http://localhost:8080/miktzoan/
