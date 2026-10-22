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
