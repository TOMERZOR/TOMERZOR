# הרוג את העכבר באחורי

A phone game. Lior Baum, the mouse who took over the site, comes up out of his burrows to steal Ofek's hummus and pita. You place blocks to steer his route and traps that hold him still, and when he's caught you hammer him with a flip-flop as fast as you can tap. Hebrew, portrait, static site, no build step:

```
npx http-server -p 8093 -c-1 .     # from the repo root, then open http://localhost:8093/achori/
```

When you change a file, run `python3 achori/tools/version.py` so phones load the new version instead of a cached one.

## How to play

- **Plan.** The coloured dotted lines show exactly where each burrow's mouse will run. Pick a tool in the tray and tap a cell. Tap an item you placed to take it back (and get the money back). You can't wall the food off completely.
- **Release the mouse.** Tap a mouse to whack it. A running mouse is hard to hit and dodges, so the real damage happens while it's held:
  - **Trap** (₪3): catches it and holds it for about 3 seconds. Tap as fast as you can.
  - **Glue** (₪2): holds it for about 2 seconds; works twice.
  - **Cheese** (₪1): a mouse within 4 steps goes for it and stops to eat.
  - **Block** (₪1): it has to go around.
- **Combo.** Twelve hits in a row without a pause or a miss doubles the damage.
- **Ofek's scream** freezes every mouse for a moment (and adds time to the ones already caught). **Shalev disconnects** sends them wandering away from the food.
- **Shaked complains** to Ido's battalion so loudly that they refund ₪3 in the middle of the round, so you can buy another trap (from level 2).
- When a mouse reaches the food it grabs a pita and runs for the nearest burrow. Kill it on the way and the pita comes back. If it gets away, the pita is gone. Lior always comes back from another burrow, having healed half his wounds.
- Lose every pita and the mice win. Stars: 3 for keeping every pita, 2 for losing one, 1 otherwise.
- From level 4 Lior is smart: he sees traps and glue and goes around them, so you have to block every other way.
- The "סוללת אידו" button files a complaint. It never helps.

Vibration: every tap, placement, hit, catch, kill, steal and ability has its own pattern (`js/haptics.js`), and a caught mouse ticks faster and faster just before it breaks free. Android uses the Vibration API; iPhone Safari has no vibration API, so on iOS 18+ each pulse is the system tap from toggling a hidden switch. It can be turned off on the title screen and in pause.

Leftover money can be spent during the action too: pick a tool, then tap an empty cell.

## Levels

Ten levels in three parts of the site (the site manager's caravan, the storeroom, the kitchenette), adding a second burrow, henchman mice, cheese, glue, smart Lior, a burrow in the middle, and a final level with four burrows. Progress is saved in the browser.

## Code

- `js/game.js`: the rules, with no DOM, so the tests play it in Node. A grid of 7×9 cells, Dijkstra routes (the same function draws the planning preview), mouse states (emerge, run, caught, glued, eating, stunned, confused, flee), damage and combo.
- `js/levels.js`: the maps (ASCII), budgets, mouse speed and health, waves and the dialogue before each level.
- `js/scene.js`: three.js. A real perspective camera over the floor and the back wall; the art stands in the room as sprites that face the camera and are drawn back to front. The camera fits itself so the grid sits between the HUD and the tray on any screen.
- `js/main.js`: screens, input, effects (slipper, comic words, particles, the mash ring), HUD and the loop.
- `js/audio.js`: every sound and the music, synthesised with Web Audio.
- `js/text.js`: all the lines and jokes.

## Art

All the art was generated with Higgsfield (GPT Image 2.5) in a flat adult-sitcom cartoon style: Lior in seven poses (standing, running, caught in a trap, glued, eating, knocked out, ghost; made from the first one as a reference so they match), the henchman mouse, Ofek on his chair, Shalev and Shaked (caricatures drawn from photos of the real people, with the old drawings as a style reference), the trap, glue, cheese, blocks, toolbox, burrow, the hummus plate, the flip-flop, the floor, three back walls and the key art. `tools/sprite.py` trims them and saves WebP.

## Tests

```
node achori/test/sim.mjs [level]        # each level: lost with no plan, won with a good plan, how many random plans win, a slower player
node achori/test/play.cjs <outDir> [level]   # plays a level in a phone-sized browser and saves screenshots (needs the server on :8093)
node achori/test/levels.cjs             # walks through all ten levels, the result screens and the ending; fails on any page error
```
