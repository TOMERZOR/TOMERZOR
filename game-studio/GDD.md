# SHARD: Game Design Document

**Pitch:** Aim, fire, and watch glass explode. A premium, minimalist physics smasher built for the "oddly satisfying" feeling: crisp shatter sounds, precise haptics, slow-motion final hits and chain reactions.

**Store title:** SHARD: Satisfying Glass Smash
**Platforms:** iOS + Android (HTML5 + Capacitor), web build for testing and sharing
**Orientation:** portrait, one thumb
**Session:** 20–60 seconds per level, 8–15 minutes per session

## Why this game (from the market research)
- Smash Fest reached the US top 3 with zero paid UA thanks to ASMR audio, haptics and near-miss tension. Physics destruction travels on TikTok.
- The leading casual games are criticised for ad overload. SHARD keeps ads optional or rare, which wins on rating and retention.
- Hybrid-casual monetisation (rewarded ads, a few interstitials, IAP) is the segment that is growing.

## Core loop (30 seconds)
1. A scene of shelves, ledges and contraptions holding **glass**.
2. **Drag back** anywhere (slingshot) to aim the launcher at the bottom. A dotted line shows the exact path to the first contact, then a fainter line one bounce further, like a pool guide line. It is computed by a ghost ball in a copy of the static geometry with the same physics, so it doesn't lie.
3. **Release** to fire a heavy ball. Fast hits **pierce** glass, so the ball smashes through and keeps flying. Glass knocked off a ledge shatters when it lands.
4. Break **all glass** within the ball budget. Stars depend on balls used against par.
5. The final shard triggers a slow-motion, a chord, and a big haptic.

## Materials and mechanics (introduced one per world)
| Material | Behaviour |
|---|---|
| Glass (pane, jar, bottle, orb) | Breaks when relative impact speed > 4.2 m/s. A ball faster than the threshold passes through and loses 12% speed. |
| Shelf (static) | Off-white ledges. The ball bounces off them. |
| Stone (dynamic, heavy) | Unbreakable. Use it to crush glass below. |
| Wood plank (dynamic, light) | Topples like dominoes, lever. |
| Bounce pad (static) | Restitution 1.15. Enables trick shots. |
| Bomb | Explodes on any hit faster than 2 m/s: radial impulse, chains. |
| Rope (pendulum) | Glass hangs and swings. |
| Mover (kinematic) | Platforms that slide or spin. Timing. |
| Frosted glass | Milky, thicker glass. The first hit cracks it and the ball bounces off; the second breaks it. Anything but the ball needs 6 m/s to crack it; a bomb breaks it outright. From the second half of Dawn. |
| Locked glass and its gold key | Locked glass carries a padlock and shrugs off every hit (the ball bounces off; the aim guide marks it like a wall) until the gold key glass breaks; then light runs from the key to each lock and they break like any glass. From Lilac's seventh level. |

## Worlds (24 levels each, 120 at launch)
1. **Dawn**: glass and shelves (tutorial in levels 1–3)
2. **Mint**: stone and wood
3. **Lilac**: bounce pads and banks
4. **Ember**: bombs
5. **Night**: ropes and movers

Every level is **generated and verified by a solver**, then **calibrated with an average-player bot** that aims with the same guide line: hard levels get spare balls, levels it almost never clears are replaced, and each world is ordered from easy to hard by measured success.

**Hardening pass:** a skilled-player bot (it weighs three of the shots the guide offers by playing each out, then fires the best with hand error) cleared 86–91% of the first halves of Dawn, Mint, Lilac and Ember, so the campaign was too easy. Without changing any layout, each level then gets the frosted and locked glass that brings it closest to a first-try clear rate for its place: from 85% to 62% across the second half of Dawn, down to 68% to 42% across Night, every fifth level a breather. Dawn's first twelve levels and each world's first level are untouched. Each new kind of glass is explained by a one-line coach the first time it appears. Measured again on fresh seeds, the skilled bot's first-try clear rate went from 79% to 71% over the campaign, about ten points in Lilac, Ember and Night.

The solver part: that simulates the real physics. A level ships only when it has a solution with par balls that still works if the aim is off by ±0.6°. No pixel-perfect or unfair levels.

## Return loop
- **Daily Smash:** one seeded, solver-verified level per day, with a streak counter and a coin reward that grows with the streak.
- **Ball collection:** 12 cosmetic balls with their own trail and impact colour. Bought with coins, star milestones or IAP.
- Stars unlock the next world (soft gate: 70% of the world's stars, or play on with coins).

## Economy
- Coins per clear: 10 + 5 per star, plus a combo bonus. A rewarded ad doubles it.
- Hint: shows the solver's first aim. 1 free per world, then 40 coins or a rewarded ad.
- Extra ball (out of balls): rewarded ad or 60 coins, once per attempt.

## Monetisation (fair hybrid)
- **Rewarded ads only by choice:** extra ball, double coins, hint.
- **Interstitials:** none before level 12. Then at most one every 3 clears and 150 seconds apart. Never on a fail or retry.
- **IAP:** Remove Ads $3.99 · Starter Pack $4.99 (no ads, 1500 coins, Aurora ball, offered once after level 8) · coins $0.99 / $2.99 / $7.99 · Prism ball $1.99.
- SDKs: AdMob (with UMP consent and ATT) and RevenueCat, behind `monetization.js`. The web build uses test mocks.

## Style bible: premium minimal, luminous (after the masterpiece pass)
- **Worlds are times of day,** each with a key light from the top left, a shaft of light, a pool where it lands, drifting motes, a vignette and fine grain:
  - Dawn: peach morning. Mint: greenhouse. Lilac: afternoon haze. Ember: sunset, with rising embers. Night: moonbeam and twinkling stars.
  - Palettes, light and mote settings live in `shard/js/theme.js`.
- **Glass is the hero,** baked once per piece into a sprite:
  - Clear where the light enters and denser away from it.
  - A saturated edge band where the wall is seen edge-on.
  - Two reflections and a faint far-side one, a lit rim, and a glint.
  - A coloured shadow with a bright caustic core; at night, coloured light instead.
  - Reflections vary per piece.
- **Shatter:**
  - A flash and white crack lines, and the piece glows white-hot.
  - Shards of real glass catch the light on their lit edges and glint as they turn.
  - Glitter and glass dust follow.
- **Other materials:** wood grain, speckled stone, lacquered shelves with cast shadows, iron bombs with a glowing core and a sparking fuse, squashy pads with chevrons, movers on a visible rail.
- **Ball and cannon:**
  - The ball has bounce light, a comet tail, stretch at speed and a squash on impact.
  - The cannon has a lit barrel, a ready light, a muzzle flash and a contact shadow.
  - Shots left are drawn as mini balls in the equipped skin.
- **Aim guide:** flowing dots and a ghost ball at the first contact. On glass it's marked to break.
- **Type:** Archivo (SIL OFL), bundled in two cuts so every platform, screenshot and the website match: a little wide (104%) for text, fully expanded (125%) and heavy for the logo, titles, world names, big numbers and the main buttons. Sharp, not rounded; big numbers, small-caps labels, lots of space.
- **Motion:** weight follows frequency.
  - A level start (frequent) is under a second and never blocks: pieces pop in bottom-up while glass notes play.
  - A win (every level) is quick: stars one by one, coins counting up, confetti on 3 stars.
  - A new world (rare) is expressive: a title card on frosted light.
  - Hit-stop is 30–70 ms per break, budgeted at 0.24 s per shot. The camera kicks toward each break and pushes in on the last piece during 0.2× slow motion.
  - A loss (frequent) never waits for the last ball to stop bouncing. A replay of the shot runs ahead, so "Out of balls" comes 1 s after the last shot, or 0.75 s after the last glass it broke or cracked.
  - Reduce Motion turns off the camera, shake, hit-stop and decorative loops.
- **Sound:**
  - Recorded glass under randomised synthesised bell partials.
  - Chain notes are FM crystal bells climbing a pentatonic scale, the same scale as the level-intro notes.
  - The last piece slows time with a falling sigh while the music ducks. The win ends on a bell and a shimmer.
- **Haptics:**
  - A medium kick on fire, and a light thud when the ball knocks hard into a wall or a shelf.
  - Each break is a crunch: the hit, then a lighter tick as the pieces fly. It grows from light to heavy as a chain grows (rate-limited), and the last piece always lands heavy.
  - Heavy on bombs; success on a win, warning on a loss; a tick per star on the win sheet, the last one firmer.
  - On the web, Android vibrates the same moments. An iPhone web page can't vibrate; the one touch Safari allows is the tick of a switch, so there every button tap ticks.

## The level map
Each world is a place, and its 24 levels are glass gems on a trail that climbs it, from the world's sign at the bottom to a glass gate at the top (in the next world's colours, lit once it's open). The worlds stay as tabs above the map.
- **Scenery per world, low contrast so the trail leads:**
  - Dawn: a rising sun, terraces of peach dunes, glassware set out to catch the light.
  - Mint: greenhouse ribs, leaves, stone and timber.
  - Lilac: glass bubbles in a haze.
  - Ember: a furnace sunset, sparks, bombs beside bottles.
  - Night: a crescent moon, stars, lanterns.
- **Gems:** lit from the top left like the game's glass. Cleared levels carry their stars; perfect ones glint; locked ones are dim glass in the world's tint.
- **The next level:** your own ball rests on it, a ring breathes out from it, and a "Play" label sits under it.
- **Coming back after progress:** the ball hops gem to gem along the trail, lighting it. Each landing plays a rising glass note, and the stars of the levels you just cleared land as it leaves them. A new world's first level gets the ball dropped onto it instead.
- **The last world** ends at a summit crystal that lights up when every level is cleared.
- **Motion rules:**
  - Ambient motion is compositor-only (transform and opacity): the ring, the ball's bob, the glints.
  - No parallax: it cost a fifth of frames while scrolling and jitters on iOS.
  - The game's canvases leave the page while a menu page covers them.
  - Reduce Motion: no hops, bob, ring or glints.

## Retention: the star crystal
Every 15 stars fills a crystal. Its ring sits next to the star count on the home screen and glows when full. Shattering it pays 100 coins, rising by 25 per crystal up to 400, with a shake, eight flying facets, a chime and confetti. It's a goal that is always one or two levels away, and the reward is smashing glass.

## Rendering architecture
- Two canvas layers:
  - Settled layer: the stage plus every body asleep in the physics engine. It redraws only when that set changes.
  - Live layer: what moves, effects and UI-in-canvas.
- Camera and shake apply to both.
- Particles are pooled.
- **Adaptive quality:** a rolling frame-time average picks one of four tiers (resolution, motes and dust, moving shadows, camera, shard edges, glow size). The tier is saved per device and retried one step higher on each launch.
