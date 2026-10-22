# SHARD: the masterpiece pass (my standing orders)

The playable game works. This pass makes it a work of art: the most satisfying, beautiful, polished glass-smashing game on any phone, the kind people open "for one level" and put down forty minutes later. Every detail gets attention: light, glass, motion, sound, touch, words, code. I keep going, round after round, until nothing on this page is left undone, and then I look again.

## The feel I'm building
**"Every shot ends in a burst of light."**

Five pillars, in this order when they conflict:
1. **Satisfying.** Every action gets an immediate, proportional answer in picture, sound and touch, all landing on the same frame. Big moments are bigger: a brief freeze on impact, rising notes in a chain, slow motion on the last piece.
2. **Luminous.** Glass is the hero. It catches light, bends what's behind it, throws colored light onto the shelves, and glints as it falls. Each world is a time of day with its own light.
3. **Calm.** Premium and minimal. Nothing on screen that doesn't earn its place. Soft motion and room to breathe. No clutter, no shouting UI.
4. **Rewarding.** Progress is celebrated generously and visibly: stars land one by one, coins count up, worlds open like doors.
5. **Fair.** Every level stays solver-proven, and the aim guide stays exact.

## Guardrails (never break these)
- **Nothing regresses.** The proof replay stays 220/220, `validate-levels` passes, every QA scenario passes, and the console stays clean. I run them after every round.
- **Physics stays still unless it has to move.** A change to `engine.js` constants or contact rules invalidates proofs and calibration. Feel comes from rendering, timing, sound and haptics first. If physics must change: re-run validate-levels, proofs and bot calibration, and log it.
- **60 fps on a mid-range phone.** Every heavy visual change gets measured before and after with the perf probe under 4× CPU throttling. Effects scale down with the adaptive quality tier, and nothing allocates in hot paths.
- **Offline-first.** No runtime network requests. Fonts, sounds and art are bundled.
- **iOS 15 WebKit.** None of these: `color-mix()`, canvas `ctx.filter`, `roundRect()`, `OffscreenCanvas`, CSS nesting. Every newer API needs a fallback.
- **Accessibility.**
  - Every new animation has a reduced-motion answer.
  - Tap targets are at least 44 px, and text keeps its contrast.
  - Haptics follow the setting.
- **Honest economy.** No dark patterns. Ads stay as fair as they are now.

## Art direction
- **Light.** One key light per world, from the top left. Each room has a sunbeam (or moonbeam) with dust drifting in it, a soft vignette, and a fine grain so flat areas feel like material rather than pixels.
- **Worlds as times of day:**
  - Dawn: warm peach sunrise.
  - Mint: cool morning greenhouse.
  - Lilac: dusk.
  - Ember: glass-blower's furnace.
  - Night: moonlit gallery with twinkling stars.

  Each world gets its own ambient motion (motes, embers, stars) and a background motif drawn into the static layer.
- **Glass, the hero:** art glass.
  - Clear center and saturated edges for thickness.
  - A bright rim on the lit side.
  - A specular streak, and the background seen through it slightly bent (refraction).
  - A colored shadow on the wall and a caustic spot of light on the shelf below.
- **Shatter.** Shards keep the glass material and flash a glint as they turn toward the light. Four-point sparkles twinkle and fade. The impact gets a bright flash, then a puff of glass dust. Shards settle on shelves and fade gracefully.
- **Other materials**, each readable at a glance:
  - Shelves: lacquered dark wood with a top highlight.
  - Wood: grain and an end-cut.
  - Stone: weight and texture.
  - Bomb: a warm pulsing core.
  - Pads: springy.
  - Movers: machined.
- **Ball.** Real shading (key light, rim light, contact shadow) and a tapered gradient trail. Slight stretch at speed, squash on impact.
- **Cannon.** A crafted object: a recoil spring, a muzzle flash, a ready glow, and a smooth turn toward the aim.
- **Aim guide.** Dots that flow toward the target, a landing reticle that breathes, and a clear first-contact mark. Still exact.
- **Typography.** One bundled rounded face (Nunito, OFL) on every platform, so the iPhone, Android, the web build, the store screenshots and the landing page all look the same. A clear type scale, and tabular numbers for counters.
- **Motion language.**
  - UI moves on springs: quick in, slight overshoot, 180–450 ms, ease-out on entry and ease-in on exit.
  - Game objects move with physics; effects use curves, never linear.
  - One orchestrated moment per screen beats scattered effects.

## Work areas (each one has to reach the bar)
- **A. Stage and light:** backgrounds, light shafts, vignette, grain, world motifs, ambient particles.
- **B. Materials:** glass (refraction, rim, specular, colored shadow, caustic), shelves, wood, stone, bomb, pads, movers, ropes and anchors.
- **C. Shatter and effects:** shard glints, sparkles, impact flash, dust, rings, pooled particles with no garbage.
- **D. Game feel:**
  - Hit-stop on big breaks, a camera punch, and slow-motion zoom on the last piece.
  - Escalating combos: popups grow, notes climb a scale, haptics strengthen.
  - "So close" when one piece is left, tension on the last ball, a "One shot!" celebration.
- **E. Ball, cannon, aim guide:** shading, trail, squash, recoil, muzzle flash, flowing guide.
- **F. Level flow:**
  - Level intro: a title card, and the glass materializes piece by piece.
  - Restart, lose, next-level and world-complete transitions.
  - The win sequence: stars pop in one at a time with rising dings, coins count up, glass confetti.
- **G. Screens:**
  - Home: logo with a light sweep, breathing play button, the demo scene.
  - Levels: world header, progress, clear tile states.
  - Balls: a 3D preview that turns, and an unlock reveal.
  - Store, settings, sheets and toasts, plus consistent tokens for radius, spacing and shadow.
- **H. Sound:**
  - Musical combos, UI ticks and whooshes, the win jingle, star dings, coin count-up ticks.
  - World ambience, and a mix that leaves headroom.
- **I. Retention:** star-milestone chests with an opening moment, a daily streak calendar, visible 3-star goals, frictionless "one more level".
- **J. Code:** a renderer split into clear parts, pooled particles, no per-frame allocation, clear names, dead code removed, comments where the why isn't obvious.
- **K. Performance and robustness:** adaptive quality tiers, the perf probe, long-session memory, pause and resume, every interrupted state.
- **L. Marketing:** after the overhaul, regenerate the store screenshots, trailer, landing images and the shareable web build, so they match the real game.

## The loop (repeat until done, then once more)
1. **Look.** Film the moment with `tools/qa/film.mjs` (frame-perfect strips) and capture screens at 390×844, with spot checks at 360×640 and 430×932. Write the critique twice: once as a player (is it fun, clear, satisfying?) and once as an art director (what's flat, ugly, noisy, inconsistent?).
2. **Pick** the change with the biggest effect on what the player sees and feels most often.
3. **Design before code:** exactly what changes, the timings, colors and curves, and why.
4. **Build** it small and clean, in the style of the surrounding code.
5. **Prove it.**
   - Before/after filmstrips or screenshots, viewed side by side.
   - Regression: the scenarios, proof replay and validate-levels.
   - The perf probe for anything that draws more.
   - A reduced-motion check for anything that moves.
6. **Judge.** Is it more beautiful? More satisfying? Clearer? If not, revert it or redo it.
7. **Ship the round:** commit, push, and a LOOP_LOG entry (found / changed / evidence).

## Questions I ask every round
- Would a player screenshot this moment or show it to a friend?
- Does every touch get an answer within one frame: picture, sound, haptic?
- What on screen isn't earning its place? Remove one thing.
- Is any motion janky, slow, linear, or inconsistent with the rest?
- Does it look as good on the smallest and the largest phone, and in Night (dark) as in Dawn?
- What state haven't I designed: empty, first-time, interrupted, offline, out of coins, all levels done?
- Any bug? Try to break it: tap fast, pause mid-slow-motion, rotate, background the app, restart during a win.

## Done when
Every work area meets the bar on film, the whole suite is green, the perf probe holds 60 fps at mid-range, an independent review finds nothing high-severity, the marketing assets are regenerated from the new game, and the web build is republished. Then one more full pass, as a first-time player.
