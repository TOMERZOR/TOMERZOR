# Pointy talking-head video — how it was made

A ~48 s vertical (1080×1920, 24 fps) Hebrew video for Pointy, cut from 8 phone takes. The person is restyled (black
hoodie, his own room behind him at f/1.4, a soft key light) while his real face, lip movement and gestures are kept;
a Mac screen recording of Pointy in Premiere is rebuilt in code; subtitles, explainer graphics and sound effects
are synced to his words. The footage and the rendered videos are not in the repo.

## Pipeline

1. **Transcribe** (`tools/transcribe.py`, ivrit-ai Whisper large-v3-turbo, local): word timings for every take.
2. **Edit** (`edl.json`): the best take of each line, silences and repeated takes cut (94 s → 47 s), in 3 chunks.
3. **Restyle** (Higgsfield Genjutsu Lite, 720p): outfit, room and light, guided by one approved still (GPT Image 2.6).
4. **Composite** (`tools/composite.py`): the real face aligned back onto the restyled head and relit from it,
   RobustVideoMatting matte, light wrap, bloom, one grade, one grain, so it reads as one photographed image.
5. **Film** (`comp.html`, onetake's `motion.js`): A-roll + the Mac screen (an AI-generated Premiere screenshot,
   `premiere.jpg`, with every moving part drawn live: the Pointy bar, suggestions, pointer, step cards, clicks, the
   zoom) + keycaps + graphics + word-synced subtitles. `timeline.py` maps every word to film time.
6. **Sound** (`score.py`): CC0 recordings (Freesound: clicks, keys, typing, whooshes, pop, bell) and onetake's palette,
   placed from the composition's `__events()`, under the cleaned speech; −14 LUFS. No music.
7. **Render** (`build.sh`): onetake's `render.py` at 1080×1920, 24 fps, motion blur; audio muxed.

## Credits

Sound effects (all CC0, Freesound): "Mouse click sounds" by Masgame, "typing on a laptop keyboard" by supersnd,
"swosh-08" and "Swosh swoosh whoosh" by qubodup, "Mouth pop" by fleurescence, "Wood block hit" by thomasjaunism,
"g1.wav" by angstrom. Font: Heebo (OFL).
