# רצים בשוק · Shuk Rush

A 3D endless runner set in Jerusalem's Mahane Yehuda market on a Friday. Dodge the grandpa with the shopping trolley, the Moroccan grandma with the gold bangles, the dancing Breslov hasidim and their van, the Chabad tefillin stand, the tomato vendor, the delivery guy with the pallet jack and the courier on a scooter. Collect 10-shekel coins, unlock characters, upgrade power-ups and level up through missions.

Hebrew is the default language; English can be switched on in Settings → Language (the choice is remembered).

Static site, no build step: open `shuk/index.html` from any web server (GitHub Pages works).

```
npx http-server .     # then open http://localhost:8080/shuk/
```

## Controls

Swipe (or arrow keys / WASD): left and right change lanes, up jumps, down rolls (in the air it drops you fast). Space jumps, P or Esc pauses.

Running into someone head-on ends the run. Brushing past from the side, or tripping over crates and under-banners you missed, makes the grandma whose tomatoes you knocked over chase you; a second slip while she's behind you and she catches you.

## What's in the game

- **Zones** that change every 900 m: the open street (morning), the covered market (Etz Chaim street), Shabbat-eve sunset, and the night market with painted shutters and bars. Speed keeps rising.
- **Coins**: each 10₪ coin adds ₪10 to your wallet.
- **Power-ups**: magnet, double rugelach (×2 score), jump sneakers, the hamsa that absorbs one hit, and the magic carpet that flies you over the market along a trail of coins in the air (and lands you on a cleared patch of street). Each can be upgraded five times in the shop.
- **Mystery bags**: a random prize: a pile of coins, a free power-up, bonus points, or a shower of coins across all three lanes.
- **Rolling watermelons** escape their piles and roll down the lanes at you: jump them or step aside.
- **Oncoming traffic**: a white delivery van, the greengrocer's pickup or the Na Nach van drives down your lane at you over a trail of coins. The trail ends a beat before the bumper (about 0.6 s, a little less as the run gets harder) and the vehicle's speed is kept in step with yours until then, so you can always grab every coin and still get out of the way. Stay in the lane and it hits you. The later you dodge, the bigger the moment: a close call drops into slow motion with a lens kick, a flash at the screen edges, a sting and points (150, or 300 by a hair), and counts towards the close-call mission. Vehicles honk when they get near and lean on the horn if you're still in their way.
- **Coin streaks**: every 50 coins without tripping pays a bonus.
- **Characters**: nine playable runners, from Yoni the Nachlaot local to Ginger the market cat. Characters you don't play appear as pedestrians.
- **Missions and levels**: three missions at a time; finishing all three raises your level, which is your permanent score multiplier, and pays a bonus.
- **Trucks with ramps** you can run up and along the roof of.
- First run includes a short tutorial.
- **Jokes**: loading tips, character bios, speech bubbles, zone captions and the game-over line are affectionate shuk satire (haggling grandmas, parking, the light rail, tourists, every edah's food).

## Look

The street bends away toward the horizon (curved-world vertex shader). The colour grade (saturation, contrast, warmth) is folded into a custom tone-mapping function, so every material applies it as it writes its pixels (`js/look.js`).

Light (`js/light.js`):
- **Baked sun shadows for the whole street.** Each 30 m chunk gets a tile in a 4x2 depth atlas, rendered from that zone's sun direction only when the chunk is placed (one tile per frame, back faces only so lit surfaces never shadow themselves). Buildings throw jagged shade across the street, awnings, tarps, balconies, arches and AC units shade what is under them, at any distance, for one hardware-filtered texture lookup per pixel. Characters, walkers and obstacles darken when they step into it.
- **Sky occlusion and bounce.** Ambient light falls off toward the bottom of the street canyon, under the awnings and on walls facing a tall opposite wall; sunlit stone throws warm light back onto faces turned from the sun. Shade is lit by a cool sky, sun by a warm sun.
- The per-frame shadow map only holds what moves (runner, walkers, obstacles); the two multiply, so nothing is darkened twice. Light shafts slant through the covered market's roof.

Quality levels:
- **Auto** (default): renders straight to the screen at 2x with the canvas' MSAA, no full-screen passes; vignette and speed lines are CSS layers; baked street shadows (512 texels per tile, one tap) plus hardware-PCF shadows from things that move. It lowers the resolution (then drops the moving shadows) only if the median frame rate over ~2.5 s stays under 45 fps.
- **High**: up to 2.5x, a 4x MSAA half-float target, bloom, sharper baked shadows (768 per tile, four filtered taps), soft 2048 shadows from moving things that also fall on the stalls.
- **Battery saver**: Auto at 1.25x with baked shadows only (384 per tile).

Add `?fps` to the address to show the measured frame rate, frame times, resolution, draw calls and triangles.

The street is a row of separate buildings on each side, each with its own width, height (stepped rooflines), setback or overhang, stone tint and shutter colour (the photo's green shutters are recoloured in the facade shader), with real side walls, parapets, solar water heaters, dishes and antennas on the roofs, enclosed and open balconies, laundry lines, sills and AC units lined up with the painted windows. Speech bubbles are a generated frame drawn in five slices around one or two lines of text. Every character, walker and obstacle stands on a soft contact shadow as well as casting a sun shadow.

Street furniture follows photos of the real market: patchwork tarp and corrugated-tin canopies on pipe frames over the stalls (with shop names hung under the front beam), bar counters with high stools on the curb and chalkboard menus, chalkboard A-frames on the pavement, open burlap sacks of nuts and spices with price cards stuck in them, spice mounds in white bowls, halva blocks with cut faces, brass coffee pots, rolls of plastic bags, and in the covered market ceiling fans and bare bulbs. Signs are lettered in Hebrew sign-painter faces (Suez One, Karantina, Amatic SC, Secular One, Rubik) over generated weathered blanks (`img/signs.webp`: painted tin, enamel, wood, chalkboard, cardboard, lightbox, the blue street-name plate): shop boards, "for rent" boards on balconies, street names, handwritten cardboard and price cards.

Depth comes from geometry rather than post effects: raised curbs and basalt bands that converge on the horizon, balconies, sills and AC units lined up with the painted windows, contact shadows, and distance haze. Distant chunks swap the generated stalls for vertex-coloured low-detail versions and hide the stall keepers; pedestrians use reduced textures so only the runner keeps its full 2048 texture. Physics advances in equal substeps per frame, so motion stays even when frame times wobble.

The HUD and menus are built from generated art: glossy buttons, 3D icons, an awning panel header and the logo plate (`img/ui/`), set in the Fredoka display font with outlined gold titles. Coins fly to the counter, the runner squashes on landing and the lens widens with speed. See `ART_DIRECTION.md` for the brief.

Progress is stored in the browser (localStorage).

## Sound

The music is a Mizrahi dance-pop groove in Hijaz on D, generated live: four-on-the-floor kick under a darbuka maqsum, claps on the backbeat, riq and hats, a 3-3-2 bass, offbeat keyboard stabs that duck under the kick and a written two-phrase hook on a zurna-like lead with slides and vibrato (the oud plays it in the menu), in a 16-bar form with a darbuka break and a riser. It starts at 126 BPM and speeds up to about 148 with the run.

Coins on the street all give the same ding; coins strung together in one jump (or a carpet ride) climb a scale, and the next landing resets it. There are footfalls at a running cadence, a whoosh on near misses, engines that rise in pitch as traffic comes at you and drop as it passes, car horns, a close-call sting with the music dipping under water during the slow motion, a coin shower for streaks, paper and a pop for the mystery bag, lift-off, wind and a swoop for the carpet, three ticks as a power-up runs out, a revive sweep, a sad trombone at game over (a fanfare for a new best), and a swish on menu sheets. Vendors, the Breslov, the Chabad guy, the grandpa, the delivery guys and the chasing grandma each have their own voice.

## Code

| File | What it does |
| --- | --- |
| `js/main.js` | Renderer, loading, input routing, menus, main loop, adaptive quality |
| `js/game.js` | A run: physics steps, scoring, power-ups, stumbles and the chaser, revive, missions, camera |
| `js/track.js` | Obstacle/coin/power-up generation (always leaves a passable lane), walkers, oncoming traffic timed to its coin trail, collisions |
| `js/player.js` | Lanes, jump, roll, platforms, animation state machine |
| `js/world.js` | Street chunks (stalls, awnings, facades, lights), sky, fog and lighting per zone |
| `js/props.js` | Obstacles (generated crate and watermelon models, procedural sacks, barriers, banners, the produce truck, the Na Nach van), the generated delivery van and pickup, power-ups, the coin |
| `js/look.js` | Curved-world shader patch and the post-processing chain |
| `js/light.js` | Baked sun-shadow atlas, sky occlusion and bounce light patched into the materials |
| `js/i18n.js` | All player-facing text in Hebrew and English |
| `js/assets.js` | GLB loading and the shared animation library |
| `js/audio.js` | Synthesized music and sound effects, recorded voice lines |
| `js/ui.js`, `css/style.css` | Interface, right-to-left in Hebrew and left-to-right in English |
| `js/config.js` | Characters, prices, power-ups, zones, missions |

## Assets

Characters, market people, key art, the facade and paving textures and the shutter murals were generated with Higgsfield (image → Tripo 3D mesh → auto-rig). All characters share one animation set (`models/anims.glb`: run, jump, roll, stumble, fall, idle, dance, walk), retargeted by bone name. The art student's auto-rig had bound her tote bag to her right arm and thigh and part of that forearm to the thigh, so raising the arm dragged them into a wedge: her right side now takes its weights from the mirrored left side, the bag rides on the spine, and the triangles fusing the bag to her hand and leg are cut. Voice lines are ElevenLabs v4 performances by native Hebrew voices directed with tags (shouting, raspy, elderly, singing), checked by transcribing them back, then trimmed, levelled and given a short street echo; the grandma's take is pitched down to sound her age. The fruit, spice and sweets stalls, the parked supplier truck, the crate and watermelon obstacles, the white delivery van and the greengrocer's pickup (from a reference photo of a high-roof panel van), the ground litter decals, the 10-shekel coin face and all UI art were generated the same way (image → Tripo mesh, simplified and compressed with gltf-transform/meshopt). The remaining stalls, produce, signs and props are built procedurally in code. Music and sound effects are synthesized live with WebAudio (see Sound).
