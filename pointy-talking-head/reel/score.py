#!/usr/bin/env python3
"""score.py → sfx.wav and mix.wav: effects from comp.html __events(), under the narrator.

Recorded CC0 sources (Freesound, see CREDITS in the delivery folder) for clicks, keys, typing, whooshes, pops and
the bell, plus onetake's synthesised palette (one shared room) for the felt hits. No music, by request.
"""
import asyncio, os, subprocess, sys
import numpy as np
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
sys.path.insert(0, "/home/user/TOMERZOR/.claude/skills/onetake/scripts")
from sfx_palette import Score, SR, air, glass, wood, sub, bubble, lp, hp   # noqa: E402

def load(name, t0=0.0, dur=None, gain=1.0):
    args = ["ffmpeg", "-v", "error", "-ss", str(t0)] + (["-t", str(dur)] if dur else []) + ["-i", f"{SCR}/sfx/{name}", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    x = np.frombuffer(subprocess.run(args, capture_output=True).stdout, np.float32).astype(np.float64)
    x = x / (np.abs(x).max() + 1e-9) * gain
    n = min(len(x), int(0.006 * SR)); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n)
    return x
def onsets(x, thr=0.25, gap=0.08):
    e = np.abs(x); idx = []; last = -1e9
    for i in np.where(e > thr * e.max())[0]:
        if i - last > gap * SR: idx.append(i)
        last = i
    return idx
def cut(x, i, dur): return x[max(0, i - int(0.004 * SR)): i + int(dur * SR)].copy()

CLICKS_ALL = load("click_mouse-click-so.mp3"); CL = [cut(CLICKS_ALL, i, 0.11) for i in onsets(CLICKS_ALL)][:6]
TYPE_ALL = load("keyboard_typing-on-a-la.mp3"); TY = [cut(TYPE_ALL, i, 0.09) for i in onsets(TYPE_ALL, 0.12, 0.06)][:40]
WH1, WH2 = load("whoosh_swosh-08-flac-.mp3"), load("whoosh_swosh-swoosh-w.mp3")
POP, WOOD, BELL = load("pop_mouth-pop.mp3"), load("wood_wood-block-hit.mp3"), load("bell_g1-wav.mp3", 0, 2.2)
print(f"clicks {len(CL)}, keystrokes {len(TY)}")

async def events():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1080, "height": 1920})
        await pg.goto("file://" + os.path.join(HERE, "comp.html")); await pg.evaluate("window.__ready")
        ev = await pg.evaluate("window.__events()"); dur = await pg.evaluate("window.__meta.dur"); await b.close(); return ev, dur

ev, dur = asyncio.run(events())
s = Score(dur=dur + 0.5, T60=0.9); rng = np.random.default_rng(3); ti = 0
for e in ev:
    t, k = e["t"], e["k"]; pan = float(np.clip((e["x"] - 540) / 540 * 0.4, -0.5, 0.5))
    if k == "whoosh":  s.place(WH2, t - 0.12, 0.30, pan, 0.25)
    elif k == "fly":   s.place(WH1, t, 0.26, 0.2, 0.25, pan_to=-0.1)
    elif k == "whip":  s.place(WH1, t, 0.30, -0.2, 0.2)
    elif k == "swipe": s.place(WH1, t, 0.18, 0.1, 0.2)
    elif k == "pop":   s.place(POP, t, 0.42, pan, 0.18); s.place(bubble(560 + rng.uniform(-60, 60), 0.16), t, 0.10, pan, 0.25)
    elif k == "tick":  s.place(WOOD, t, 0.12, pan, 0.15)
    elif k == "thud":  s.place(sub(55, 0.5), t, 0.45, 0, 0.1); s.place(WOOD, t, 0.2, 0, 0.2)
    elif k == "key":   s.place(lp(CL[1 % len(CL)], 2500), t, 0.55, pan, 0.12); s.place(sub(70, 0.25), t, 0.18, 0, 0.05)
    elif k == "flip":  s.place(WH1, t - 0.05, 0.16, 0, 0.2)
    elif k == "open":  s.place(glass(1319, 0.9, 0.6), t, 0.10, 0, 0.45); s.place(air(0.35, 400, 2600, 1.3, 0.35), t, 0.14, 0, 0.35)
    elif k == "type":  s.place(TY[ti % len(TY)], t + rng.uniform(0, 0.01), 0.20 * rng.uniform(0.7, 1.1), 0.05, 0.1); ti += 1
    elif k == "enter": s.place(lp(CL[0], 3000), t, 0.45, 0, 0.12)
    elif k == "click": s.place(CL[2 % len(CL)], t, 0.42, pan, 0.12)
    elif k == "ding":  s.place(glass(1760, 0.8, 0.8), t, 0.10, 0.2, 0.4)
    elif k == "send":  s.place(WH1, t, 0.22, 0, 0.2); s.place(POP, t + 0.05, 0.3, 0, 0.15)
    elif k == "success": s.place(BELL, t, 0.20, 0, 0.35)
sfx = s.mix(peak_db=-6.0)
import wave
def wav(path, x):
    x = np.clip(x, -1, 1); w = wave.open(path, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
wav(os.path.join(HERE, "sfx.wav"), sfx)
# the mix: speech on top, effects ~10 dB under it, a gentle limiter, −14 LUFS for Reels
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(HERE, "vo.wav"), "-i", os.path.join(HERE, "sfx.wav"), "-filter_complex",
                "[0:a]loudnorm=I=-16:TP=-2[v];[1:a]volume=0.5[f];[v][f]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.89:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=9",
                "-ar", "48000", "-ac", "2", os.path.join(HERE, "mix.wav")], check=True)
print("wrote sfx.wav, mix.wav", len(ev), "events")
