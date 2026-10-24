# רצים בשוק · Shuk Rush

A 3D endless runner set in Jerusalem's Mahane Yehuda market on a Friday. Dodge the grandpa with the shopping trolley, the Moroccan grandma with the gold bangles, the dancing Breslov hasidim and their van, the Chabad tefillin stand, the tomato vendor, the delivery guy with the pallet jack and the courier on a scooter. Collect 10-shekel coins, unlock characters, upgrade power-ups and level up through missions.

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
- **Power-ups**: magnet, double rugelach (×2 score), jump sneakers, and the hamsa that absorbs one hit. Each can be upgraded five times in the shop.
- **Characters**: nine playable runners, from Yoni the Nachlaot local to Ginger the market cat. Characters you don't play appear as pedestrians.
- **Missions and levels**: three missions at a time; finishing all three raises your level, which is your permanent score multiplier, and pays a bonus.
- **Trucks with ramps** you can run up and along the roof of.
- First run includes a short tutorial.

Progress is stored in the browser (localStorage).

## Code

| File | What it does |
| --- | --- |
| `js/main.js` | Renderer, loading, input routing, menus, main loop, adaptive quality |
| `js/game.js` | A run: physics steps, scoring, power-ups, stumbles and the chaser, revive, missions, camera |
| `js/track.js` | Obstacle/coin/power-up generation (always leaves a passable lane), walkers, collisions |
| `js/player.js` | Lanes, jump, roll, platforms, animation state machine |
| `js/world.js` | Street chunks (stalls, awnings, facades, lights), sky, fog and lighting per zone |
| `js/props.js` | Procedural props: crates, banners, the produce truck, the Na Nach van, power-ups, the coin |
| `js/assets.js` | GLB loading and the shared animation library |
| `js/audio.js` | Synthesized sound effects and the darbuka/oud music, recorded voice lines |
| `js/ui.js`, `css/style.css` | Hebrew right-to-left interface |
| `js/config.js` | Characters, prices, power-ups, zones, missions |

## Assets

Characters, market people, key art, the facade and paving textures and the shutter murals were generated with Higgsfield (image → Tripo 3D mesh → auto-rig). All characters share one animation set (`models/anims.glb`: run, jump, roll, stumble, fall, idle, dance, walk), retargeted by bone name. Voice lines were generated with ElevenLabs through Higgsfield. Stalls, produce, signs and props are built procedurally in code. Music and sound effects are synthesized live with WebAudio.
