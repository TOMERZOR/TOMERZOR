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

- **Run:** hold a finger on the screen. Double points, but every step jolts the water more.
- **Jump:** flick the top of the phone toward you (or swipe up) to jump the striped hurdles. Miss one and he trips.
- **Perfect balance** builds a score multiplier up to x5; any wobble or spill resets it.
- **Coins** float at head height off to the side: lean to grab them with your head, then come back. **Water drops** sit further out and put 5% back in the bucket.
- **Knots** in the rope jolt him. **Rain clouds** refill the bucket while you keep it under the drizzle.
- **The ibex** walks toward you along the rope: lean to one side and it squeezes past (bonus); stay upright and it bumps you.
- Coins are kept between games and buy new characters.

No motion sensor (a computer, or access denied): drag left and right on the screen (hold the Run button to run), or use the arrow keys (up to run, space to jump).

## Endless mode

Rope after rope, each harder than the last, through all six themes. The bucket isn't refilled between ropes, so drops and rain matter; the run ends when less than 40% is left. Your best rope count and score are kept.

## Characters

| Character | Carries | How it plays |
|---|---|---|
| Yossi the Walker | a bucket of water | the default |
| The Waiter (150 coins) | five champagne flutes on a tray | spills at the smallest shake, but only a little at a time |
| Grandma Rachel (300) | a wide pot of soup | slow, big waves that are hard to stop |
| Ginger the Cat (500) | a goldfish bowl | balances better, but the fish jumps and kicks the water |
| Dubi the Bear (800) | a jar of honey | thick honey barely spills, but he is heavy and slow |

## Levels

1. First Steps: calm morning, no wind, coins to practise leaning.
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
- `js/sim.js`: the walker is a slightly unstable, heavily damped pendulum: a lean drifts away on its own over a few seconds, and the phone's tilt sets how fast he leans back. (An earlier version had your tilt push him directly; people with a normal 0.3 s reaction time kept overcorrecting and swinging, so the damping was raised until simulated ordinary players found it steady.) It also lays out what's on each rope (coins, drops, knots, hurdles, ibex, rain), keeps the score and multiplier, and holds each liquid's slosh frequency, damping, container shape and spill rate. The liquid surface is a damped pendulum driven by the bucket's sideways acceleration and by how fast you rotate the phone. Water pours out when the surface tilts past the rim relative to the bucket; the rim angle grows as the bucket empties.
- `js/render.js`: a 2D canvas with a simple perspective camera behind the walker. The painted backdrop fills the screen and sets the horizon; the far cliff is a sprite whose ledge post is pinned to the rope's far anchor, so it grows as you approach and fades into the haze when far. The walker sprite's legs are drawn as two halves so each foot lifts on its step; the water, droplets, rope, ribbon, wind and snow are drawn live on top.
- `js/assets.js`: image paths and the measured anchor points in each painting (feet, pole, bucket rim, cliff ledge).
- `js/audio.js`: wind, pouring water, rope creaks, birds and stings, all synthesised with Web Audio.

## Art

The paintings in `img/` were generated with Higgsfield (GPT Image 2.5): a backdrop for each of the six themes (morning, midday, sunset, night, snowstorm, red canyon), three far cliffs (green granite, snowy, sandstone), the walker with his pole and bucket, the four other characters (made with the walker as a reference so they share his pose, pole and style), a sparrow perched and flying, the ibex, a rain cloud and the coin. They were cropped, resized and saved as WebP; the cliffs were faded to transparent at the bottom and sides so they melt into the gorge. Sunset, night and snow tint the cliff and walker to match the light.

## Tests

```
node tightrope/test/balance.mjs   # difficulty check with simulated ordinary players (below); also: hands-off never wins, perfect play always can
node tightrope/test/human.mjs     # just the per-level report for ordinary players
node tightrope/test/play.cjs <outDir> [level]   # plays in a phone-sized browser with fake motion sensors and saves screenshots (needs the local server on :8091)
node tightrope/test/features.cjs <outDir>       # plays a late level, buys a character in the shop, and runs endless mode across a rope change
```

`test/human.mjs` simulates a population of ordinary players, each with their own traits: about 0.3 s between seeing a lean and the hand moving, corrections made in separate moves every 0.2-0.45 s, small leans (under ~1.5°) going unnoticed, a poor sense of how fast the lean is changing, a personal and imperfect correction strength, hand overshoot, tremor and a slowly drifting grip, jumps timed by eye, and many of them chasing coins. The current targets: levels 1-3 cleared 85-100% of the time, then a gradual drop to about half on level 8, almost no falls, and a typical endless run of 4-14 ropes.
