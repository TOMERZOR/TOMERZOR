#!/usr/bin/env python3
"""score.py — the Pointy film's sound, placed from the composition's own window.__events().

    python3 score.py            → sfx.wav (48 kHz stereo)

Draft sound on onetake's synthesised palette (scripts/sfx_palette.py): one room, fewer events than beats.
No music yet: a royalty-free bed goes on top once the cut is accepted (see the skill's references/sound.md).
"""
import asyncio, os, sys
import numpy as np
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.join(HERE, "..", ".claude", "skills", "onetake", "scripts")
sys.path.insert(0, SKILL)
from sfx_palette import Score, air, glass, wood, sub, bubble, pan_of   # noqa: E402

async def events():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1080, "height": 1920})
        await pg.goto("file://" + os.path.join(HERE, "comp.html")); await pg.evaluate("window.__ready")
        ev = await pg.evaluate("window.__events()"); await b.close(); return ev

rng = np.random.default_rng(7)
s = Score(dur=15.0, T60=1.2)
P = lambda x: pan_of(x, 1080)
# pitches stay in one key (E major pentatonic) so the glass touches read as one instrument
E = {"E5": 659, "G#5": 831, "B5": 988, "C#6": 1109, "E6": 1319, "B4": 494}

for e in asyncio.run(events()):
    t, k, x = e["t"], e["k"], P(e["x"])
    if k == "keys":    s.place(air(0.5, 160, 900, 1.1, 0.7), t, 0.18, 0.0, 0.4)
    elif k == "press": s.place(wood(150, 0.14), t, 0.55, -0.1, 0.25); s.place(wood(120, 0.12), t + 0.012, 0.40, 0.15, 0.25); s.place(sub(58, 0.5), t, 0.45, 0.0, 0.1)
    elif k == "pop":   s.place(bubble(560, 0.22), t, 0.38, x, 0.35)
    elif k == "land":  s.place(wood(300, 0.08), t, 0.30, x, 0.3)
    elif k == "bar":   s.place(air(0.38, 400, 2600, 1.4, 0.35), t, 0.22, -0.2, 0.45, pan_to=0.2)
    elif k == "type":
        if rng.uniform() < 0.3: continue
        s.place(wood(175 + rng.uniform(-25, 25), 0.08), t + rng.uniform(0, 0.004), 0.12 * rng.uniform(0.7, 1.3), x, 0.15)
    elif k == "send":  s.place(wood(260, 0.07), t, 0.32, x, 0.2); s.place(glass(E["E5"], 0.9, 0.7), t + 0.03, 0.14, x, 0.5)
    elif k == "open":  s.place(air(0.6, 220, 1800, 1.2, 0.5), t, 0.30, 0.0, 0.5)
    elif k == "fly":   s.place(air(e["d"], 300, 2400, 1.3, 0.6), t, 0.24, P(700), 0.45, pan_to=P(905))
    elif k == "point": s.place(glass(E["B5"], 0.7, 0.9), t, 0.15, x, 0.45); s.place(wood(320, 0.06), t, 0.18, x, 0.2)
    elif k == "card":  s.place(bubble(420, 0.2), t, 0.18, 0.0, 0.3)
    elif k == "click": s.place(wood(240, 0.07), t, 0.40, x, 0.2); s.place(wood(200, 0.06), t + 0.07, 0.26, x, 0.2)
    elif k == "remove":s.place(air(0.8, 2400, 500, 1.1, 0.25), t, 0.22, P(390), 0.55)
    elif k == "done":  s.place(glass(E["E6"], 1.2, 0.8), t, 0.16, 0.0, 0.6); s.place(glass(E["B5"], 1.2, 0.7), t + 0.09, 0.12, 0.1, 0.6)
    elif k == "iris":  s.place(air(0.5, 250, 3200, 1.5, 0.3), t, 0.26, x, 0.45)
    elif k == "whip":  s.place(air(0.32, 800, 3600, 1.6, 0.55), t, 0.22, x, 0.35)
    elif k == "word":  s.place(sub(70, 0.35), t, 0.22, 0.0, 0.1)
    elif k == "fold":  s.place(air(0.6, 3000, 220, 1.2, 0.75), t, 0.30, x, 0.5)
    elif k == "settle":s.place(bubble(480, 0.2), t, 0.16, x, 0.3)
    elif k == "icon":  s.place(sub(52, 0.9), t + 0.08, 0.60, 0.0, 0.15); s.place(glass(E["E5"], 1.6, 0.8), t + 0.08, 0.16, 0.0, 0.7); s.place(glass(E["B4"], 1.6, 0.6), t + 0.08, 0.12, 0.0, 0.7)
    elif k == "mark":  s.place(air(0.5, 200, 1400, 1.2, 0.6), t, 0.18, 0.0, 0.45)
    elif k == "pill":  s.place(bubble(600, 0.24), t, 0.30, 0.0, 0.35); s.place(glass(E["G#5"], 1.4, 0.8), t + 0.02, 0.12, 0.0, 0.6)

s.write(os.path.join(HERE, "sfx.wav"))
print("wrote sfx.wav")
