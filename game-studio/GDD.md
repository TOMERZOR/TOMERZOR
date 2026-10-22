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

## Style bible: premium minimal
- **Palette per world:** a soft two-stop gradient sky, with objects in muted, low-saturation solids.
  - Dawn `#F6EFE7 → #F3D9C9`, Mint `#EAF4EF → #CFE6DC`, Lilac `#EEEAF6 → #D8D0EE`, Ember `#F7ECE6 → #F0C7B5`, Night `#1D2233 → #2D3550`
- **Glass:** translucent cool fill (alpha .32), crisp white edge, one diagonal specular streak, and sparkle on the shards.
- **Type:** system rounded (SF Pro Rounded or the system UI font), big numbers, small caps labels, lots of space.
- **Motion:** spring easing on all UI. Hit-stop of 30 ms on big impacts, slow-motion at 0.25× for 0.7 s on the final shatter, subtle screen shake only for bombs.
- **Sound:** synthesised glass made of a noise burst, 3–7 bell partials and a low thump, randomised so no two shatters sound the same. Combo chimes climb a pentatonic scale.
- **Haptics:** light on fire, medium on shatter (rate-limited), heavy on bombs and the final shatter.
