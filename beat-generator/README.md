# Beat Generator

A beat machine for freestyle. Type keywords (Hebrew or English) and get a looping beat. Freestyle mode flashes a word on every bar change, and you can record yourself over the beat.

Static site: HTML, CSS and vanilla JS, no build step. Sound runs in the browser with Tone.js (vendored in `js/vendor/tone.js`, MIT), with no servers or API keys. Drums, 808s and melodies are real recorded samples in `samples/` (TR-808, TR-707 and the CC0 Versilian Community Sample Library; see `samples/CREDITS.md`). Each beat loads only the kit and instruments it uses.

## How it works

- `js/keywords.js`: the dictionary. Each style (trap, drill, boom bap, lo-fi, reggaeton) and mood (dark, sad, rain, oriental...) lists the words that trigger it. Hebrew prefixes are stripped, so "בלילה" matches "לילה". Add words here.
- `js/recipe.js`: turns the tags into a recipe: tempo, swing, key and scale, a 4-bar chord progression, and a pattern for every track. Melodies come from `MOTIFS`, short loops written in chord tones the way producers build piano and bell loops, so they always fit the chord under them; the qanun plays Hijaz phrases instead. Chords are voice-led 7th chords. The text and the variation number seed the randomness, so the same link always gives the same beat.
- `js/engine.js`: builds the instruments and plays the recipe. `BG.KITS` picks the drum kit per style and `BG.INSTRUMENTS` maps the sampled instruments. The 808 is one tuned sample, repitched per note, with slides. Every beat has a song form like a released freestyle type beat: a 4-bar intro with only the loop, then the full beat, with a 4-bar breakdown at the end of every 32 bars. The download is a 2-minute WAV made by rendering the intro, main and breakdown sections once each and laying them out.
- Mix levels are in `BG.LEVELS` and `BG.STYLE_LEVELS` at the top of `js/engine.js`. They were tuned by measuring renders against two reference type beats (a trap beat at about 123 BPM and a hard boom bap beat at about 85 BPM): loudness around -12 dBFS RMS, most of the energy in the sub and the 808, a steady melodic loop, and drums leading in boom bap.
- `js/words.js`: the freestyle word bank. Unknown keywords are added to it.
- `js/app.js`: the page: chips, step grid (click to edit, click a row name to mute), freestyle stage, recording, download and share link.

Share links look like `#k=<keywords>&v=<variation>&bpm=<tempo>`.

## Run locally

```
npx http-server .
```

Then open http://localhost:8080/beat-generator/. The microphone only works over https or localhost.

## Notes

- Recording mixes the mic with the beat in the browser and saves WebM (Chrome, Firefox) or M4A (Safari). Headphones keep the beat from leaking into the mic.
- The beat in the recording is delayed by the measured audio latency so the voice lines up. If takes sound early or late on some device, tune `lag` in `startRecording` in `js/app.js`.
