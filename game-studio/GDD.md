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

## Worlds (24 levels each, 120 at launch)
1. **Dawn**: glass and shelves (tutorial in levels 1–3)
2. **Mint**: stone and wood
3. **Lilac**: bounce pads and banks
4. **Ember**: bombs
5. **Night**: ropes and movers

Every level is **generated and verified by a solver**, then **calibrated with an average-player bot** that aims with the same guide line: hard levels get spare balls, levels it almost never clears are replaced, and each world is ordered from easy to hard by measured success.

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
- **Type:** Nunito (SIL OFL), bundled, so every platform, screenshot and the website match. Big numbers, small-caps labels, lots of space.
- **Motion:** weight follows frequency.
  - A level start (frequent) is under a second and never blocks: pieces pop in bottom-up while glass notes play.
  - A win (every level) is quick: stars one by one, coins counting up, confetti on 3 stars.
  - A new world (rare) is expressive: a title card on frosted light.
  - Hit-stop is 30–70 ms per break, budgeted at 0.24 s per shot. The camera kicks toward each break and pushes in on the last piece during 0.2× slow motion.
  - Reduce Motion turns off the camera, shake, hit-stop and decorative loops.
- **Sound:**
  - Recorded glass under randomised synthesised bell partials.
  - Chain notes are FM crystal bells climbing a pentatonic scale, the same scale as the level-intro notes.
  - The last piece slows time with a falling sigh while the music ducks. The win ends on a bell and a shimmer.
- **Haptics:** light on fire, then light, medium and heavy as a chain grows (rate-limited); heavy on bombs and the final shatter; success on a win, warning on a loss.

## Retention: the star crystal
Every 15 stars fills a crystal. Its ring sits next to the star count on the home screen and glows when full. Shattering it pays 100 coins, rising by 25 per crystal up to 400, with a shake, eight flying facets, a chime and confetti. It's a goal that is always one or two levels away, and the reward is smashing glass.

## Rendering architecture
- Two canvas layers:
  - Settled layer: the stage plus every body asleep in the physics engine. It redraws only when that set changes.
  - Live layer: what moves, effects and UI-in-canvas.
- Camera and shake apply to both.
- Particles are pooled.
- **Adaptive quality:** a rolling frame-time average picks one of four tiers (resolution, motes and dust, moving shadows, camera, shard edges, glow size). The tier is saved per device and retried one step higher on each launch.
