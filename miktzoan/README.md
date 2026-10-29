# סימולטור הנדימן (Handyman Simulator)

A satirical 3D handyman game in Hebrew, in the style of idle-arcade "carry and deliver" games. Pick a trade (plumber, electrician, locksmith, renovator, AC tech or gardener), grab parts from the van, deliver them to neighbours, do the repair mini-game, then choose what to charge: fair price, no receipt, or garage price.

Play: https://tomerzor.github.io/TOMERZOR/miktzoan/

- Before each repair there is a WhatsApp-style chat on the doorstep: answers move the customer's mood (tips, stars), the price (upsell gamble, "neighbour price") or the repair time, and can book a follow-up job. VIP customers pay double with less patience; happy customers in a row build a streak multiplier.
- Happy customers may sign a maintenance subscription. Subscriptions pay into the register at the base (bills pile up, walk in to collect), also at half rate while the game is closed. The "פרסום" pad raises the rate, the register size and the sign-up chance.

- Static site, no build step: three.js (vendored in `vendor/`), vanilla JS modules, WebAudio for all sound.
- `js/data.js`: trades, job texts, reviews, excuses, upgrade costs. Edit jokes and balance here.
- `js/world.js`: the neighbourhood, roads, houses, cars, cats, lighting, camera. Static scenery is merged into a few meshes at load (`bake()`).
- `js/models.js`: procedural low-poly people, houses, van, items.
- `js/game.js`: carrying, customers, jobs, coins, upgrade pads, helper, days, level-ups.
- `js/minigames.js`: one canvas mini-game per trade.
- `js/ui.js`: HUD, markers and speech bubbles anchored to the 3D world, phone toasts, modals, joystick.

Progress is saved per trade in `localStorage`. Add `?ts=4` to the URL to run the game four times faster when testing.

Preview locally: `npx http-server .` from the repo root and open http://localhost:8080/miktzoan/

App icon: `tools/icon.html` renders the game's own handyman with three.js. Serve the repo, open `/miktzoan/tools/icon.html` (add `?zoom=0.78` for the maskable version with extra margin), screenshot the 1024×1024 square and resize it into `img/` (`icon-192/512`, `icon-maskable-192/512`, `apple-touch-icon` 180, `favicon-32`).
