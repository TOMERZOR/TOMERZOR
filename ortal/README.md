# אורטל קומבט (Ortal Kombat)

A 3D fighting game in the style of Mortal Kombat, in Hebrew. Eight fighters, combos, flying iPhones and the Keter chair. Play the computer, a friend on the same screen, or a friend online. Static site, no build step:

```
npx http-server -p 8770 -c-1 .     # from the repo root, then open http://localhost:8770/ortal/
```

Live: https://tomerzor.github.io/TOMERZOR/ortal/

## The fighters

| | throws (special) | forward + special | her combo |
|---|---|---|---|
| שונטל | תיק לואי | סיבוב תיק (two hits) | סטירה, סטירה, קדימה+סטירה, למטה+סטירה |
| רויטל | ענן סומק (dazes) | ציפורני ג'ל (lunge, three hits) | סטירה, בעיטה, קדימה+סטירה |
| ליאל | אייפון 18 פרו מקס | פלאש סלפי (dazes) | סטירה, סטירה, בעיטה, קדימה+בעיטה |
| ליאן | כפכף (arc) | סיבוב קוקו | בעיטה, קדימה+סטירה, למטה+סטירה |
| שיראל | עקב (arc) | בעיטה מעופפת (knockdown) | סטירה, קדימה+סטירה, למטה+סטירה |
| אגם | אייפון 18 פרו מקס | ענן וייפ (stays and hurts) | סטירה, בעיטה, קדימה+בעיטה |
| מעיין | תיק לואי | צעקה (low, knockdown, long range) | סטירה, סטירה, למטה+בעיטה |
| תהל | אייפון 18 פרו מקס | ריקוד טיקטוק (four hits) | בעיטה, קדימה+סטירה, קדימה+בעיטה |

Every fighter also has: slap (jab, then a second jab), forward+slap (hook), down+slap (uppercut that launches), kick, forward/back+kick (roundhouse, knockdown), down+kick (sweep), air slap and air kick, and block+slap up close (hair pull, unblockable).

**Keter meter (כוח כתר).** Hits fill it, hits in a row fill it faster, and landing your fighter's own combo all the way gives a big bonus. When it is full the 🪑 button lights up: she picks up a white plastic Keter chair and throws it (230 damage, knockdown). When a match is won by knockout, the loser stands dazed ("תגמרי אותה!") and the winner can press 🪑 for the כיסאליטי: chairs rain from the ceiling.

Best of three rounds, 99 seconds each. Standing block stops high and mid, crouching block stops low and mid; jumping attacks must be blocked standing.

## Hits you can feel

Every hit that lands: a white starburst and a shockwave ring at the point of contact, the camera jolts toward the hit and springs back while the lens punches in, the struck fighter rocks back and trembles through the hit freeze, a layered thump (sub, body, crack), and the fighters grunt and cry out: real effort and pain sounds from ElevenLabs' sound-effects model (three takes each of a light attack, a heavy attack yell, a hit, a heavy hit and a knockout scream, `voice/x_*.mp3`, trimmed to the burst by `tools/trimgrunt.py`), pitched differently for each fighter and never the same take twice in a row. Heavy hits kick up dust and sometimes knock off a gold hoop earring. When you are the one hit, the edge of the screen flashes red (your half in local versus) and your health bar jolts. Phones vibrate (Android; iPhone with iOS 18 through the switch-tap trick in `js/haptics.js`), gamepads rumble, each with its own pattern for landing, being hit, blocking, the chair and the knockout. Vibration can be turned off in the menu.

## Controls

- Phone: joystick on the left (it moves to where your thumb lands), buttons on the right: סטירה, בעיטה, זריקה, חסימה (hold), 🪑.
- Keyboard: W A S D, J slap, K kick, L throw, I or Space block, O chair. Player 2 on the same keyboard: arrows, numpad 1/2/3, 0 block, 5 chair (or , . / ; ').
- Gamepads work too (X slap, A kick, B throw, Y chair, shoulders block).

## Online

One player taps "פתחי חדר" and gets a 5-digit code (and a link to share); the other enters it. There is no game server:

- The two browsers find each other through public MQTT brokers over WebSocket (`js/net.js`, a ~100-line MQTT client; four brokers at once, so one being down doesn't matter, one of them on port 443).
- They then try a direct WebRTC data channel (STUN only). If the networks don't allow it (some mobile carriers), the game keeps running through the brokers.
- The fight itself (`js/sim.js`) is a deterministic simulation in integers: same inputs, same fight, on any device. `js/rollback.js` is GGPO-style rollback netcode: each side plays immediately with a guess of the other player's input, and when the real input arrives and differs, it rewinds and replays in the same tick. 2 frames of input delay, up to 12 frames of rollback, time sync so neither side runs ahead, and a checksum every second; if the two sides ever disagree, the host's copy is sent and the guest replays from it.

## Code

- `js/sim.js`: the rules. Moves (frame data), projectiles, hits, blocking, juggles, combo scaling, the meter, rounds, finish and fatality. No DOM, runs in Node.
- `js/rollback.js`, `js/net.js`: online play (above).
- `js/render.js`: three.js. The stage is a painted backdrop on a curved wall with a floor continuing from it and stacks of Keter chairs; the fighters are rigged meshes posed from the sim state each frame (any frame can be redrawn, which rollback needs); items, sparks, glitter, blood, camera.
- `js/anim.js`: turns `models/anims.json` into clips for any fighter (rotation deltas from the rig's rest pose, so one set of animations fits all eight).
- `js/props.js`: the Keter chair, iPhone 18 Pro Max, bag, slide, heel and vape, built from primitives.
- `js/main.js`: screens, the game loop, events to sound and effects, HUD.
- `js/ai.js`: the computer opponent (reaction delay, blocks, throws items, does its fighter's combo). Three levels; the arcade ladder gets harder as you go.
- `js/audio.js`: voice lines plus effects and a hijaz trap beat synthesised with Web Audio.
- `js/input.js`: keyboard, gamepad, touch.

## Assets

- Fighters: concept renders made with GPT Image 2.5, turned into textured, rigged 3D models with Meshy (through Higgsfield). `tools/opt.mjs` cleans them for the web: removes triangles where the image-to-3D welded a hand to the hip or a sleeve to the torso, fixes stray skin weights, 1024px WebP textures, meshopt compression (~0.7–1.1 MB each).
- Animations: 21 clips from the Meshy library, applied to one rig and packed by `tools/anims.mjs`.
- Stages: generated backdrops (`img/stage_*.webp`).
- Voices: ElevenLabs v3 in Hebrew, an announcer and four voices for the fighters, generated in batches and cut by silence with `tools/split.py`.

## Tests

```
node ortal/test/net.mjs [seconds] [latencyMs] [jitterMs] [lossPct]   # two rollback sessions over a bad fake network must end identical, and equal to a replay
node ortal/test/bots.mjs                                             # all 64 pairings, computer vs computer, to the end
npm i ws && node ortal/test/broker.cjs 8883 60 25 3                  # local MQTT broker with lag, for testing online in two browser windows:
#   open /ortal/index.html?broker=ws://localhost:8883 in both (add &nortc=1 to force the relay path)
```
