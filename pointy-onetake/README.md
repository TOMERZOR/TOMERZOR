# Pointy — 15 s onetake test

A 15-second vertical (1080×1920) Hebrew motion film for Pointy, made with the onetake skill
(`.claude/skills/onetake`). Concept: **the cursor is the film**. One orange point carries the whole take: it is born
from the ⌥ Space press, types the question as the caret, tips over into the Pointy arrow, points at the exact button
in three apps, folds the world back into itself and becomes the arrow inside the Pointy icon. No cuts.

- `pointy-test.mp4`: the draft (1080×1920, 30 fps, 180° shutter motion blur, synthesised sound effects)
- `BEATS.md`: the beat sheet: what moves, what is still and what carries each boundary
- `comp.html`: the composition. One canvas, every frame a pure function of time. Open `comp.html?play` to loop it,
  or `comp.html?t=6.4&hud` to pin a frame
- `score.py` → `sfx.wav`: sound placed from the composition's own `window.__events()`
- `motion.js`: onetake's move library (copied from the skill); `fonts.css`: Heebo (OFL), inlined

## Rebuild

```bash
cd pointy-onetake
python3 score.py                                                    # sfx.wav
python3 ../.claude/skills/onetake/scripts/render.py comp.html --width 1080 --height 1920 \
  --out pointy-test.mp4 --sfx sfx.wav                               # draft
python3 ../.claude/skills/onetake/scripts/probe.py comp.html --width 1080 --height 1920   # continuity, curves, framing
```

Needs python3 with `playwright`, `numpy`, `scipy`, `Pillow`, plus `ffmpeg`. For a final, add `--final`
(it renders 4K60; for vertical pass `--width 1080 --height 1920 --scale 2 --fps 60`).

`verify_promo.py` and `probe.py` default to a 1920×1080 frame: pass `--width 1080 --height 1920` to the probe, and
run verify with the probe patched to that size, or its framing leg reports a vertical film's pointer as off frame.

## Not in this draft

- **Music.** Sound effects only. A royalty-free bed goes on once the cut is accepted.
- **Real Pointy UI.** The step card and ring are drawn in the film's paper look, not copied from the app.
