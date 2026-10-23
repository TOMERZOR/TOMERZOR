# Loop log: what each round found and fixed

Every round asks: Are there bugs? Does it look good? Is it fun? Does it make money? Is it fast?

## Round 1: the engine
- **Found:** a ball reaching glass near the top of its arc is slow and bounced off without breaking it. That would feel unfair.
- **Fix:** the steel ball breaks glass at any speed above 1.6 m/s. Falling objects still need 4.2 m/s.

## Round 2: geometry (the most important finding)
- **Found:** the ball flies almost in a straight line, so shelves hid the glass from the cannon. Only 6–9% of angles hit anything; the tutorial levels needed a bank shot at 2% accuracy.
- **Fix:** a closed room with a ceiling and bouncy walls. The ball ricochets like pinball and every shot is a chain of hits. Hit rate rose to 20–60%.

## Round 3: the first impression
- **Found:** level 1 was one orb in an empty room; the cannon looked like a pawn; the ball bounced off an invisible ceiling.
- **Fix:** a string of 3 glass beads straight above the cannon (a one-shot win with ×3 combo and slow motion); a new cannon (barrel and dome); visible ceiling and floor bands that frame the room.

## Round 4: level density
- **Found (gallery of 30 levels):** levels too empty, only 2 glass pieces, tiny objects in a big room.
- **Fix:** glass 30% bigger, richer set pieces (rows of 3–5, pyramids of 6–10, bead strings, chandeliers), a minimum glass count per difficulty, compositions spread across the room's height, and mirror symmetry in 30% of levels so they look hand-designed.

## Round 5: screens
- **Found:** demo glass covered the logo on the home screen; the cannon peeked out from behind the Play button; 99 demo balls drew dots across the screen; the pause toggles didn't show their state; the "Remove ads" icon was an X.
- **Fix:** a dedicated demo scene between the logo and the buttons, a hidden cannon in the demo, ball dots capped at 8 with "+N", On/Off toggles, a dedicated no-ads icon and real ball previews in the store.

## Round 6: app icon
- Tested 4 variants at 1024/120/60 px. **Chose:** indigo background, a glass orb shattering realistically (the same algorithm as the game) and a coral ball. It reads clearly even at 60 px.

## Round 7: sound (the game's selling point)
- **Problem:** synthesized sound can come out cheap, and I can't listen to it.
- **What I did:** generated 16 professional sound effects (ElevenLabs: 8 glass, 4 explosions, 4 cannon shots) and **analysed them numerically** instead of listening: start time, length, loudness, brightness and clipping.
- **Found:** up to 410 ms of silence before the sound (a shatter would lag behind the impact), 3-second tails, peaks above 0 dB, and one explosion clipped at 3%.
- **Fix:** trimmed to the first millisecond, cut the tails with fades, matched loudness across variants, added a limiter, and dropped the clipped explosion. In the game the recording is layered with random synthesized bell tinkles and a random speed (pitch) per hit, so no two shatters sound alike. Synthesis remains the fallback. Total: 196 KB.

## Round 8: retention
- An opt-in daily reminder (6 PM, only on days not yet played, inexact scheduling so Android doesn't open its alarm-permissions screen).
- A short hint at the start of each new world, a "Mint complete." celebration, automatic ball unlocks at star milestones, and a magnetic hint line that locks onto the exact solution angle.

## Round 9: edge cases
- **Bug:** a player who starts the daily at 23:59 and finishes after midnight lost their streak. **Fix:** compare against the day before the puzzle's own date.
- **Web:** "TEST AD" screens would have appeared to outside players. **Fix:** on the web, rewards are granted straight away and purchases point to the app. `?test` keeps the simulation.
- **Accessibility:** screen shake and flashes are off under Reduce Motion. **Performance:** resolution drops automatically if the frame rate falls.

## Round 10: marketing pipelines
- A frame-perfect 1080×1920 trailer with a soundtrack built from the logged sound events; the trial run exposed captions covering the game, so captions became compact pills.
- 6 store screenshots at 1290×2796 from real game moments; the trial run exposed broken caption wrapping, the win sheet in an action shot, and home buttons captured mid-animation. All fixed.

## Round 11: is it actually beatable? (the biggest finding)
- **Tool:** an "average player" bot. It shoots only at glass it can see (the way a player reads the screen), with ±1° hand error.
- **Found:** it cleared only **10–28%** of the levels, even though every one is solver-proven. The cause was the mechanic, not the levels: the aim line stopped at the first contact, so glass resting on shelves could only be reached with a blind ricochet. Making glass more fragile changed nothing, which ruled out that hypothesis.
- **Fix:** a pool-style guide line, one bounce past the first contact. A first attempt with mirror reflection was only 24% accurate after the bounce (it ignored friction and spin), so it was replaced with a **ghost ball in a copy of the static geometry with the same physics**: 100% accurate to the first contact and 97% after the bounce. Cost: under 1 ms per aim. Physics is unchanged, so every proof stays valid.
- **Result:** the average player's clear rate rose to **47–77%**.

## Round 12: calibrating the campaign
- Tutorial level 3 (the pyramid) was cleared by the average player only 20% of the time; the shelf hid the pyramid from the cannon. 15 variants tested; the winner (a low, narrow shelf with big boxes) reaches **85%**.
- Calibration: extra balls only where the average player fell short of the target; 34 "wall" levels the average player almost never cleared were replaced with new ones that pass both the solver and the bot; each world is ordered easy to hard by measured success, with a breather level every few levels.
- Daily levels: a fairness bar of 50% for the average player (a daily that's too hard breaks the streak). The ones that failed were replaced with new ones.
- **Final result:** 61–79% per world for the average player, from about 100% on a world's first levels to 17–58% on its last ones (the world finales, where a hint or an extra-balls continue helps). 120 campaign and 100 daily levels, all solver-proven and replayed in the browser.

## Round 13: independent code review (a separate agent)
| # | Severity | Bug | Fix | Verified |
|---|---|---|---|---|
| 1 | High | The home demo could "win" and run the real win flow: a frozen app, or stars for an unfinished level | the demo never reports results; the main loop survives an exceptional frame | the agent's repro: alive, nothing credited |
| 2 | Medium | Pause or hint within 250 ms of a loss left the game stuck | the lose sheet belongs to its own session; pause and hint are blocked while a result is pending | the agent's repro |
| 3 | Medium | Music stacked up in the background on Android (154 sounds at once) | no scheduling while audio is suspended | 0 sounds |
| 4 | Medium-low | A loss declared while glass was still rolling swallowed a later win | a late win replaces the lose sheet | "Shattered." +60 coins |
| 5 | Low-medium | `color-mix()` doesn't exist on iOS 15: invisible logo | precomputed tint variables in JS | screenshots intact |
| 6 | Low | A rewarded video closed early never settled | settle on close or failure, with a timeout | per AdMob API |
| 7 | Low | Coin packs bought with pending approval were lost | a pending marker plus a listener that grants on completion, without double grants | per RevenueCat API |
| ? | Risk | `.mjs` might not load on iOS 15/16 (blank screen) | renamed to `.js` | n/a |

## Round 14: launch assets, final pass
- **Store screenshots:** 6 for the App Store at 1290×2796 and 6 for Google Play at 1080×1920 (Play rejects screenshots taller than 2:1). One caption wrapped onto two lines at full size; it was shortened to "A new puzzle daily".
- **Trailer:** 15.4 s at 1080×1920, captured frame by frame from the real game and mixed from the logged sound events. The opening caption now leads with the hook: "The most satisfying sound on your phone".
- **Landing page** (`shard-site/`): checked at 1280 px and at 390 px (phone). The numbered badges 1/2/3 on the feature cards suggested a sequence that isn't there, so they became icons (sparkle, shield, calendar). No console errors.

## Round 15: small and large screens
- **Tool:** the full screen flow at 320×568 (iPhone SE 1st gen), 360×640 (small Android), 375×667 (iPhone SE 2/3, iPhone 8), 412×915, 430×932, 768×1024 and 800×1280 (Android tablet), plus the shareable web build inside a page wrapper.
- **Found:** (1) the shareable web build crashed at start because the page wrapper has no `theme-color` tag; (2) on 16:9 phones the home-screen glass scene sat behind the Daily card, and on tablets it overlapped the tagline; (3) at 360 px the "×2 coins" button wrapped onto two lines.
- **Fix:** (1) the tag is optional; (2) the scene now measures the gap between the tagline and the Daily card and centers itself there (shrinking only when the gap is too small), the logo moves up on short screens, and the demo picks its shots with the same aim guide players use, so every shot reaches glass; (3) tighter padding and no wrapping on the small buttons.
- **Verified:** no glass moves before the first shot on any size, the regression suite passes (hint, shop, streak, economy, audio), and all 220 proofs replay in the browser.

## Round 16: the masterpiece pass begins
- Standing orders written to `game-studio/MASTERPIECE_COMMAND.md`: five pillars (satisfying, luminous, calm, rewarding, fair), guardrails, art direction, 12 work areas and the loop.
- **Typography:** Nunito (SIL OFL) is bundled. Until now the iPhone showed SF Pro Rounded, Android showed Roboto and the store screenshots showed Inter; now all of them match.
- **New tools:** `qa/film.mjs` films a shot frame by frame into a contact sheet; the `perfprobe` scenario measures frame times on the heaviest real levels, with `THROTTLE=4` to imitate a mid-range phone.

## Rounds 17–18: light and materials
- **Stage:**
  - Each world is now a time of day with its own key light: a soft shaft from the top left, a pool of light where it lands, dust drifting through the beam, a vignette, fine grain, and shade where the walls meet the floor and ceiling.
  - Ember became a sunset so it no longer looks like Dawn, with embers rising.
  - Night got a moonbeam and twinkling stars.
- **Glass:**
  - Each piece is baked once into a sprite: clear where the light enters and denser away from it, a saturated band where the wall is seen edge-on, two reflections plus a faint one on the far side, a rim catching the light, and a glint.
  - Every piece casts a coloured shadow with a bright caustic core; at night it throws coloured light instead.
  - Reflections and glints vary per piece, so stacks don't repeat.
- **Other materials:**
  - Wood: grain and a knot.
  - Stone: speckles.
  - Shelves: lacquered, with soft cast shadows.
  - Bombs: an iron shell, a glowing core, a breathing halo and a sparking fuse.
  - Pads: glossy, with chevrons, and they squash when hit.
  - Movers: a machined hub and a dotted rail that shows where they travel.
- **Found:**
  - At 4× CPU throttle, shadows took the heaviest level from 12% to 34–45% slow frames.
  - An earlier "0% slow frames" reading was false: a debug hook threw every frame, so nothing was drawn. Lesson: never trust a perf number without checking that the frame actually rendered.
- **Fix:** two canvas layers. Everything asleep in the physics engine (nearly all glass, nearly all the time) is drawn once into a settled layer that redraws only when something wakes, sleeps or breaks. The live layer draws only what moves.
- **Result:** 1–11% slow frames at 4× throttle, better than before the overhaul, with far richer visuals. Proof replay 220/220, validate-levels passes, and the scenarios pass with no console errors.

## Round 19: the shatter
- **Tool:** `film.mjs` gained `BREAK=1` and `BOMB=1`, which fast-forward to the first break or explosion and film it frame by frame. The previous strips had skipped the very moment that matters.
- **Shatter, frame by frame:**
  - A flash of light and a star of white crack lines bloom at the impact.
  - The broken piece glows white-hot for 0.14 s.
  - The shards are real glass: tinted body, darker rim, white edges on whichever side faces the light (recomputed as they spin), and a glint each time they turn toward it.
  - Glitter twinkles and falls slowly, and a puff of tinted glass dust drifts.
- **Weight:**
  - Hit-stop: a 30–70 ms freeze on strong or chained breaks, capped at 0.24 s per shot so chains never drag.
  - A camera kick toward each break, and a slow push-in on the last piece during the slow motion.
  - Shake only on chains.
  - All of it is off under Reduce Motion.
- **Combos:** one counter per chain instead of a stack of texts. It pops with every link, grows, turns gold at ×5 and white with a glow at ×8, and sits above and toward the middle so it never covers the glass. Haptics escalate with the chain (light, then medium, then heavy) and are rate-limited.
- **Bombs:** a white-hot core inside an orange fireball, a shockwave, hot sparks, dark shell fragments, embers drifting down, and smoke.
- **Engineering:**
  - Particles are pooled and swap-removed: no garbage per frame.
  - A camera transform covers both canvas layers.
  - If frames stay slow after the resolution drops, effects thin out.
- **Verified:** proof replay 120/120 and the scenarios pass with no console errors.

## Round 20: ball, cannon, aim guide
- **Ball:**
  - Bounce light from the room on its far side, a crisp edge, and a sharp highlight on top of the soft one.
  - A soft comet tail replaces the grey smear.
  - Slight stretch at speed, and a squash against whatever it hits (0.14 s).
- **Cannon:**
  - A lit cylinder barrel with a bright accent muzzle ring.
  - A dome with gradient and rim light, and a contact shadow on the floor.
  - A ready light that glows when loaded and dims while it reloads.
  - Firing gives a flash at the muzzle, sparks forward and a breath of smoke.
- **Shots left** are drawn as little balls in the equipped skin, so the ball you bought is visible all game.
- **Aim guide:** dots flow toward the target and taper with distance. The first contact shows as a ghost ball. On glass it turns to the accent colour with four pulsing ticks, meaning "this breaks".
- **Verified:** proof replay 120/120, scenarios pass.

## Round 21: level flow
- **Motion rule (from the design-motion skill):** weight follows frequency.
  - A level start happens hundreds of times: subtle, under a second, never blocking.
  - A win happens every level: quick, satisfying, with the Next button live straight away.
  - A world opening or completing happens five times: expressive.
  - Every new animation has a reduced-motion answer.
- **Level intro:** shelves are already there; the glass, wood, stone and bombs pop in from the bottom up with a springy settle (0.32 s each, about 0.6 s in all), while a soft rising run of glass notes plays. The physics is live from the first frame, and pieces join the settled layer all at once when the intro ends, so it redraws once.
- **New world:** the first time a world opens, a title card ("World 2 · Mint · Stone & timber") rises in on a frosted band of light, holds, and drifts away. It never blocks input.
- **Wins:**
  - A 3-star clear brings a gentle shower of tumbling glass confetti.
  - Completing a world brings two bigger waves.
  - The scrim behind the win sheet is lighter, so the celebration stays visible.
- **Found:** a "+0 coins" in an earlier filmstrip was only a capture artifact: the count-up runs on a real-time timer, the film tool on a manual clock. The real flow shows "+35".
- **Verified:** scenarios pass, proof replay 120/120, no console errors.

## Round 22: screens
- **Method:** the UI-craft skill's rules: refine, don't replace; these are tool screens, so scanability comes first and the brand lives in the details; one batched pass, then confirm.
- **Levels:**
  - Was a wall of identical locked boxes.
  - Now: a gold star progress bar and "n / 24 cleared" under the world name; perfect levels get a gold edge; the current level breathes an accent ring; locked levels are quiet outlined tiles with faint numbers and a small lock, so the path ahead is visible.
- **HUD:** the glass counter is tiny gems in the world's three glass colours, emptying as glass breaks.
- **Home:** a band of light sweeps across the logo, letter by letter, every seven seconds.
- **Balls:** the preview floats and pops when you pick a skin.
- **Store:** "No more interstitials" (jargon) became "No ads between levels. Ever."
- **Found:** the tutorial coach covered the cannon. It now positions itself from the cannon's real height on any screen.
- **Reduced Motion:** stops the sheen, the hover and the pulse.

## Round 23: sound and haptics
- **Combos:** each link now rings a struck crystal bell (FM synthesis) climbing the pentatonic scale, under a soft sine. The same scale as the level-intro notes, so the game has one musical language.
- **Last piece:** time audibly slows: a deep falling sigh, air drawn out, and the music ducks for 1.4 s, then swells back.
- **Win:** the arpeggio ends on a ringing bell with a shimmer of air.
- **Loss:** a gentle warning haptic.
- **Can't listen, so measured:** at the highest combos the bell's FM sidebands could have folded past 20 kHz. Capping the modulation depth keeps energy above 16 kHz at or below 1.3% and the peak at 0.075 (no clipping).

## Round 24: retention
- **Star crystal**, the game's own reward:
  - Every 15 stars fills one. Its ring sits next to the star count on the home screen; when full it glows and pulses.
  - Opening it is a moment: the faceted gem shakes, then shatters into eight pieces that fly apart, revealing coins that count up, with a shatter sound, a chime and confetti.
  - Rewards start at 100 coins and grow 25 per crystal, up to 400.
  - The toast "Your star crystal is full" appears the moment a win fills it.
  - It gives a goal that's always one or two levels away, on-brand: you smash glass for the reward.
- **Par in the HUD** ("Level 12 · Par 2"): perfect is always a visible target.
- **New scenario `crystal`:** checks the filling state, the ready state, that a shatter pays exactly once (no double collect), and that the next crystal starts filling. Passes.
- **Found:** the test tool can't click a pulsing button ("not stable"). That's a test limitation, not a player one, so the test forces the click.

## Round 25: robustness and performance, measured honestly
- **Soak:** 40 levels back to back, with a forced garbage collection before each sample. The heap holds at 5.0–5.5 MB the whole way, and shard and body counts stay bounded. No leak.
- **New realistic test (`perfshot`):** one real proof shot at a time on the four heaviest bomb levels, with frames measured from firing until the result. The old volley test fired eight balls at once, which is not how anyone plays.
- **Found:** at 4× CPU throttle these shots dropped 32–63% of frames, against 7–22% for the pre-overhaul version (checked out separately and measured the same way). Instrumentation showed JavaScript drawing takes only 3.6 ms per frame and physics is unchanged, so the cost is rasterizing many small effects. Switching each one off gives a small gain; switching all off returns to the old baseline. Death by a thousand cuts, in a test where headless Chromium rasterizes on the CPU while real phones use the GPU. Backdrop blur was ruled out by A/B test.
- **Fix:** an adaptive quality ladder. A rolling frame-time average is checked every 1.2 s of play; a device that can't hold about 50 fps steps down a tier.
  - Tier 1: lower resolution, no motes or dust.
  - Tier 2: no moving shadows, camera kicks or shard edge-light; smaller glows.
  - Tier 3: the minimum.
  - The device's tier is saved, and each launch retries one tier higher, so a passing hiccup never degrades a device for good. This replaces the old ladder, which needed about 10 s of jank before effects thinned out.
- **Result:** at 4× throttle the heavy shots now drop 1–7% of frames, better than before the overhaul. At normal speed the game stays at full quality with 0–0.1% slow frames.
- **Verified:** proof replay 220/220, validate-levels and all scenarios pass, no console errors.

## Round 26: marketing regenerated from the new game
- **Store screenshots** (6 for the App Store at 1290×2796, 6 for Google Play at 1080×1920): the ×10 chain glowing white, the bank-shot guide, bombs with lit fuses mid-chain, the Night moonbeam with bottles throwing coloured light, the home screen with a full crystal, and the ball shop.
  - Captures now wait for the level intro to finish.
  - Home and shop are framed in the Lilac palette they actually show; before, they were framed in Mint, a mismatch.
  - Captions use Nunito.
- **Trailer:** 18.4 s at 1080×1920, captured frame by frame; each level assembles on camera.
  - The mixer was taught the new sound design: crystal bells on chains, the intro notes, the slow-motion sigh with music ducking, and the win shimmer.
  - Mix peak 0.89, no clipping.
- **Landing page:** a new hero (the chain reaction) and four screenshots, and Nunito bundled on the site and support page.
- **First-run walkthrough** (`firstrun` scenario): a fresh install, the coached first shot, a ×3 one-shot clear, confetti, then level 2 assembling with its own tip. No console errors.

## Round 27: personal bests, and the native pipeline
- **New best chain:** when a chain of ×4 or more beats the player's record, the win sheet names it on a small gold ribbon that pops in after the stars. A personal-best hook for "one more go". The `record` scenario checks that the first big chain is named and the same chain again is not.
- **Native pipeline:** `sync.mjs` copies the whole web build except dev tools, so the bundled font reaches both apps. `npx cap copy` was run and both native projects carry the new build.
- **iOS 15 audit of the new code:** no `.at()`, `findLast`, `:has()`, `dvh`, `color-mix`, `roundRect`, canvas `filter`, `OffscreenCanvas` or CSS nesting.
- The playable web link was republished (version 4) with the whole overhaul.

## Round 28: independent code review (a separate agent, given only the diff and the platform rules)
Verdict: no crashes, no physics changes, no iOS 15 problems. Confirmed sound: the settled-layer logic (the hash can't collide in practice, and bodies can't wake and sleep between frames), the camera matching across both layers, per-level state resets, pause and slow-motion interplay, the crystal's pay-once guard, and the audio ducking.

| # | Severity | Finding | Fix | Verified |
|---|---|---|---|---|
| 1 | Medium | The star crystal sheet trapped the player when the crystal wasn't full (no scrim or back dismissal, only "Play") | "Not now" button; scrim and Android back close it | the reviewer's repro: closes both ways |
| 2 | Low-medium | Moon/Sunset unlocks share multiples of 15 with the crystal, so "Your star crystal is full" overwrote "New ball unlocked" after 200 ms | background news queues; replies to taps still show at once | repro: Moon at 5.2 s, crystal at 7.9 s; shop test passes |
| 3 | Low | At the particle cap, swap-removal evicted the newest particle, not the oldest | evict the most-aged particle | heaviest level peaks at 379 of 480 |
| 4 | Low | Shake uncovered a 5 px strip of page background | the page wears the floor colour, so the strip matches the frame | repro: the gap is the floor colour |
| 5 | Low | Motes and star twinkles ignored Reduce Motion; the crystal reward still sprang | gated by Reduce Motion; the reward fades | `calm` scenario |
| 6 | Low | A delayed world-complete confetti wave could land in the next level | the callback checks it's still the same level | by code |
| 7 | Low | The world title card replayed on every restart of a world's first level and drew above sheets | played once per world (saved); sheets and toasts layered above it | by code |
| 8 | Low | A save from before crystals existed got a backlog (300 stars = 20 crystals, about 6,000 coins) | such saves start with one full crystal | by code |
| 9 | Low | Pads and movers blurred their glow every frame on every tier | the blur only runs on the top tiers | by code |

**Also this round:** each ball you own sprinkles its own glitter into every break: gold for Gold, coral for Coral, rainbow for the Prism ball. The design document had promised balls with their own impact colour, and it gives a reason to buy one.

## Round 29: the level map
**Found** (the player's own words): the Levels screen, a grid of rounded tiles, "is very banal and looks very AI".

**Changed:**
- **The grid became a map** (`js/map.js`). Each world is a place: 24 glass gems on a winding trail, a sign where it begins, and a glass gate to the next world where it ends. The trail's wander is different in every world.
  - **Scenery:** terraces of hills, each crest catching the light, with props set beside the trail: glassware in Dawn, leaves and stone in Mint, bubbles in Lilac, bombs in Ember, lanterns in Night. Plus each world's sky: sun, greenhouse ribs, bubbles, sparks, a crescent moon and stars.
  - **The world tabs stay on top.** They run edge to edge and centre the chosen world. Tapping an open gate goes to the next world.
- **Progress feels like a journey:**
  - Your ball waits on the next level.
  - Coming back after clearing levels, it hops gem to gem with a rising glass note per landing. The trail lights behind it, the stars land on the levels it leaves, and the view follows.
  - A new world opens with the ball dropping onto its first level.
  - The final world ends at a summit crystal that lights up once everything is cleared.
- **Taps:**
  - A locked level answers "Clear level N first" and the next level nudges.
  - A locked gate names what opens it.
- **Home:** the Levels button's icon is now a folded map with a trail (the dots are cut out, so it works on Night's light icons too).

**Performance, measured at 4× CPU throttle and 3× pixel density:**
- First version: 60% slow frames at idle, 80% while scrolling.
- Causes, each isolated with an on/off test:
  - The home scene kept simulating and drawing behind every opaque menu page. Now it stops.
  - The two stage canvases still cost about 30% of frames whenever a page animated. Pages now take them out of the compositor.
  - JS parallax cost about 20% of frames while scrolling. It was removed.
  - Ambient loops that repainted every frame (a flowing trail, a box-shadow pulse, SVG glints) were rebuilt as transform and opacity only.
- Also:
  - The palette isn't re-applied when the world hasn't changed.
  - The map's ball is a cached image rather than a new canvas per visit.
  - A map with nothing new is reused, not rebuilt.
- **Result:** 0% slow frames at idle and while scrolling, about 10% during the hop sequence (mostly the frame that opens the screen). Reopening costs about 25 ms at 4× throttle.

**Robustness:**
- Leaving the map mid-hop settles it silently.
- A long frame can't skip a landing.
- A rebuild cancels the hop.
- The map rebuilds only when the width changes.
- A save field `mapAt` remembers where the map last left the ball; old saves start without a hop.

**Verified:**
- New `map` scenario with checks, in three states (fresh, mid-game, everything cleared):
  - 24 levels, none under 44 px.
  - The current level is in view, and the page itself never scrolls.
  - No sideways scroll.
  - Locked-level and locked-gate toasts.
  - Tabs, and the open gate.
  - The current level starts once on a double tap.
- New `mapperf` scenario for frame pacing.
- Reduce Motion: a still map.
- Phones from 320 to 430 wide, and tablet.
- The full suite, proof replay 120/120 and 100/100, and validate-levels pass, with no console errors.

