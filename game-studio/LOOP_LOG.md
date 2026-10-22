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
- **Final result:** 61–72% per world, from about 100% at the start of a world to about 38% at its end.

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
