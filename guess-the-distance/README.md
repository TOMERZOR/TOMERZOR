# Guess The Distance

How long does it take to get there? A guessing game about real travel times: Tel Aviv to Jerusalem by car, the Eiffel Tower to the Louvre on foot, Tel Aviv to New York by plane, or two random spots near Katzrin and Beit Shemesh. Guess the time (or the road distance) on a wheel, watch the real route draw itself on a night map, and score up to 5,000 points a round, GeoGuessr style. Hebrew first, with an English toggle.

```
cd guess-the-distance
npm install
npm start          # http://localhost:8787  (game + API + live duels)
npm test
```

Live (after the deploy workflow has run once): the Worker's `workers.dev` address, and https://tomerzor.github.io/TOMERZOR/guess-the-distance/

## Modes

- **Daily Challenge:** the same 5 rounds for everyone today (the map rotates by day). One try, and a shareable emoji grid.
- **Classic:** 5 rounds on the map you pick, no rush.
- **Streak:** keep going while every guess scores 2,800 or more (about 25% off or closer).
- **Time Attack:** 30 seconds a guess. If time runs out, whatever is on the wheel counts (if you touched it).
- **Challenge a Friend:** after a game, send a link that replays the same 5 rounds and shows your score to beat.
- **1v1 Duels:** live against another person. Quick match (random opponent on the same map), a private room with a 4-letter code or invite link, or a bot (easy, normal, hard) when nobody's around.

Maps: Israel, The World, City Walks, Flights, Random Places. What you guess: travel time or road distance.

## Phone and desktop

From 1024px wide the game switches to a desktop layout: a night sidebar (with the online count, a small player card and music and sound toggles) instead of the tab bar, content in columns, the game's trip card and guess panel in a glass side panel next to a full-size map with zoom buttons, and results in windows. Keyboard: Enter guesses and moves to the next round, ↑↓ turn a wheel, ←→ move between wheels, Esc leaves, 1/2/3 switch screens. In Hebrew everything is mirrored (sidebar and panel on the right).

## Look and feel

"A toy lobby, a mission at night." The menus are a dark, neutral charcoal with saturated stickers on it: cards in lime, yellow, sky, mint, turquoise and flame with a thick rim and a solid shadow in a darker shade of their own color, Fluent 3D characters and icons breaking out of their frames, and thick "candy" buttons that sink into their own shadow. The signature color is neon lime. A round is a night control room: a dark, tilted map (OpenFreeMap's vector tiles recolored in code: charcoal land, deep navy sea, lime highways at 35%), a glowing route in the color of the way of travel, coin pins (A lime, B flame) and dark glass cards; the next button to press is the only bright thing on screen. No purple anywhere: `node redesign/tools/check-colors.mjs` scans the code, and `python3 redesign/tools/neutralize-3d.py --check img/3d` the 3D art.

Every control answers (`js/juice.js`, one delegated listener on `[data-juice]`): candy buttons sink on press and spring back with a small squash and a ripple from the finger, glint on hover, pulse a lime focus ring, and have loading (hopping dots), success (mint, a check that writes itself, sparks) and error (a shake and a coral frame) states. Map chips fill with lime from the touch point, mode cards lean toward the mouse and their art hops, the segmented thumb stretches as it slides, switches squash. Sound and haptics follow the settings, and with reduced motion only color and state changes stay. `redesign/lab.html` (served locally, not deployed) shows every component in every state.

Type: Karantina for the big narrow titles, Fredoka for the interface, Rubik with tabular figures for numbers that count; all three hosted in `fonts/`.

## Scoring

Up to 5,000 a round. The error is measured as a ratio, so being 6 minutes off a 1-hour drive costs the same as 1.5 hours off a 15-hour one: `5000 × e^(−2.5 × |ln((guess + 5) / (actual + 5))|)`. Within a minute (or 0.5%) is a perfect 5,000. Roughly: 5% off ≈ 4,450, 10% ≈ 4,000, 25% ≈ 3,000, 50% ≈ 1,950, double ≈ 1,000.

Duels follow GeoGuessr Duels: both start with 6,000 health; each round the lower score loses the difference; once one player locks in, the other has 15 seconds; from round 4 damage is multiplied (×1.5, ×2, ×2.5…). The server holds the answer until the round ends, so nobody can peek.

## Real routes

Every round asks a live OpenStreetMap router (OSRM, through the FOSSGIS servers at routing.openstreetmap.de for car, bike and foot, and the OSRM demo server for cars) for the actual route, its distance and its duration, and draws that route on the map. Drive times are without traffic. Flights are great-circle paths with scheduled block times. Results are cached (in memory on the Node server, in Cloudflare's edge cache on the Worker), and at most 3 router requests run at once.

If the router can't be reached, listed trips fall back to reference numbers from real road, path and flight data (`core/places.js`), and the reveal says so. Random Places needs the live router (the spots are made up on the spot, then snapped to the nearest road); without it those rounds swap to a listed trip. The map is a real street map from the first free, keyless service that answers: OpenFreeMap vector tiles drawn natively by MapLibre (vendored in `vendor/maplibre/`), recolored into the night palette and tilted about 38 degrees, then OpenStreetMap's raster tiles, then Esri's World Street Map (both through Leaflet, darkened with a CSS filter that also takes most of the color out). The app checks them once at startup. City names are HTML over the map, from the game's own places and Natural Earth's list (`vendor/basemap-places.json`, taken from `vendor/basemap.json`), so Hebrew always shows right. If no service can load (offline, blocked network), the game draws its own map from Natural Earth data in `vendor/basemap.json` (land, lakes, borders, roads, and city names in Hebrew and English) in the same night palette. It is only downloaded in that case.

## Server

`server/` runs the same hub (`core/hub.js`) in two places:

- **Cloudflare Worker + Durable Object** (`server/worker.js`, `wrangler.toml`): production. One Durable Object holds every socket, the matchmaking queue, private rooms and live duels; the Worker serves the API and the game itself as static assets. `.github/workflows/guess-the-distance.yml` deploys it when `CLOUDFLARE_API_TOKEN` is set, checks `/api/health`, and writes its address into `config.js` so the GitHub Pages copy uses it.
- **Node** (`server/node.mjs`): local play and any host that runs Node (Render, Fly, Railway, a VPS). `PORT` sets the port, `ROUTER_URL` points at your own OSRM (with `/routed-car`, `/routed-bike`, `/routed-foot` under it), `ROUTER=off` uses the reference data only.

API: `GET /api/health`, `GET /api/rounds?seed=&map=&count=&from=` (solo rounds with routes), WebSocket `/ws` (duels). Without any server the page still works: solo modes route straight from the browser, and duels run against a bot inside the page.

Reconnects: if a player drops mid-duel (or reloads), the server keeps their seat for 25 seconds and puts them back exactly where they were.

## Sound

All music and effects are synthesized live with the Web Audio API, nothing to download: a calm menu loop, a brighter game loop and a faster minor duel loop on one scheduler, plus wheel ticks, lock-in, reveal swell, rising score ticks, a perfect-guess chime, hits, damage, countdowns, victory and defeat. Music, sound effects and haptics each have a switch in Profile.

Haptics: a tick on every notch of the time and distance wheels and while points count up, a tap on buttons, chips and switches, and distinct feels for locking in, the verdict, the duel countdown, the last 5 seconds, taking damage and winning. Android uses the vibration API. iPhones ignore it, so on iOS (Safari 18 and later) the game toggles a hidden native switch, which plays the system haptic tick.

## Files

- `core/`: shared by the page and the servers. `places.js` (places, trips with reference numbers, maps), `rounds.js` (seeded rounds), `router.js` (OSRM with cache and fallbacks), `scoring.js`, `duel.js` (one duel's rules), `hub.js` (matchmaking, rooms, bots, reconnects, rematches).
- `js/`: the page. `app.js` (screens, first run, links), `solo.js`, `duelui.js`, `stage.js` (game screen pieces), `kit.js` (the HTML of every control and card), `juice.js` (button and control animations), `wheel.js` (wheel picker and distance odometer), `map.js` (MapLibre night map, Leaflet fallbacks, route drawing), `icons.js` (line icons and the 3D art), `audio.js`, `net.js`, `i18n.js`.
- `css/app.css`: the design: tokens (colors, each color's dark edge, type, springs), stickers, candy buttons and every state, the night HUD, desktop layout, reduced motion and reduced transparency.
- `img/3d/`: Microsoft Fluent Emoji 3D, scaled to 256px and run through `redesign/tools/neutralize-3d.py`. `img/topo.svg`: the contour lines behind the lobby. `fonts/`: the three typefaces.
- `redesign/`: the redesign brief's tools and the component lab (not deployed: listed in `.assetsignore`).

Credits: map data © OpenStreetMap contributors, vector tiles by OpenFreeMap / OpenMapTiles, MapLibre GL (BSD-3), routing by OSRM / FOSSGIS, coastlines from Natural Earth, Leaflet (BSD-2). 3D art: Microsoft Fluent Emoji (MIT). Type: Karantina, Fredoka and Rubik (SIL Open Font License).
