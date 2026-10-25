# על החבל · Full Bucket

A phone balance game. A tightrope walker crosses a gorge between two mountains with a full bucket of water on his head. You keep him upright by tilting the phone: the gyroscope is the controller. Spill more than the level allows and you're out: the level starts over. Lean too far and he falls.

Hebrew is the default; English is in Settings. Static site, no build step:

```
npx http-server .     # from the repo root, then open http://localhost:8080/tightrope/
```

When you change any file, bump the `?v=` number in `index.html` (the stylesheet, the import map and `main.js`) so phones load the new version instead of a cached one.

Motion sensors only work over https (GitHub Pages is fine). On iPhone the game asks for motion access when you tap Play.

## How to play

- Hold the phone however is comfortable. The angle you hold it at during the 3-2-1 countdown becomes "level" (Pause → Recalibrate resets it).
- Tilt left or right to push him that way. When he leans right, tilt left to bring him back. The pole in his hands mirrors your phone.
- Move smoothly. Sharp jerks of the phone slosh the water even if he stays upright.
- The bucket gauge in the corner shows the water and the red line you must not spill past. The arc at the bottom shows his lean (needle) and your tilt (yellow marker).
- A full bucket spills at the smallest lean; once a little has gone over the rim there's more room. That's why the first seconds are the most delicate.
- Stars: three for spilling under a third of the limit, two under two thirds, one otherwise.

No motion sensor (a computer, or access denied): drag left and right on the screen, or use the arrow keys.

## Levels

1. First Steps: calm morning, no wind.
2. Light Breeze: steady wind; the ribbon on the pole shows which way.
3. Midday Gusts: gusts, announced by an arrow and a whoosh about 1.4 s ahead.
4. Birds on the Pole: a bird lands on one end and its weight pulls him that way.
5. Valley Sunset: the rope swings under his feet.
6. Night Between Peaks: frequent gusts in the dark.
7. Snowstorm: strong steady wind, snow and sway.
8. The Great Canyon: the longest rope, everything at once.

Progress and settings are saved in the browser (localStorage).

## How it works

- `js/sensors.js`: tracks the "up" direction in the phone's axes. The gyroscope rotates it every motion event and the accelerometer slowly corrects drift, so the tilt is smooth and doesn't shake when your hand moves. Tilt is measured along the screen's left-right axis, so holding the phone flat or upright both work. Sign differences between browsers are detected live.
- `js/sim.js`: the walker is an inverted pendulum (lean grows on its own, your tilt pushes back). The water surface is a damped pendulum driven by the bucket's sideways acceleration and by how fast you rotate the phone. Water pours out when the surface tilts past the rim relative to the bucket; the rim angle grows as the bucket empties.
- `js/render.js`: a 2D canvas with a simple perspective camera behind the walker. The painted backdrop fills the screen and sets the horizon; the far cliff is a sprite whose ledge post is pinned to the rope's far anchor, so it grows as you approach and fades into the haze when far. The walker sprite's legs are drawn as two halves so each foot lifts on its step; the water, droplets, rope, ribbon, wind and snow are drawn live on top.
- `js/assets.js`: image paths and the measured anchor points in each painting (feet, pole, bucket rim, cliff ledge).
- `js/audio.js`: wind, pouring water, rope creaks, birds and stings, all synthesised with Web Audio.

## Art

The paintings in `img/` were generated with Higgsfield (GPT Image 2.5): a backdrop for each of the six themes (morning, midday, sunset, night, snowstorm, red canyon), three far cliffs (green granite, snowy, sandstone), the walker with his pole and bucket, and a sparrow perched and flying. They were cropped, resized and saved as WebP; the cliffs were faded to transparent at the bottom and sides so they melt into the gorge. Sunset, night and snow tint the cliff and walker to match the light.

## Tests

```
node tightrope/test/balance.mjs   # simulated players: a steady one clears every level, a jerky one fails the late ones, hands-off never wins
node tightrope/test/play.cjs <outDir> [level]   # plays in a phone-sized browser with fake motion sensors and saves screenshots (needs the local server on :8091)
```
