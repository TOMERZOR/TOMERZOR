"""Sound for the Pointy outro of the Max short, synthesized (no samples): the cursor whoosh and click,
the orange wipe, the logo landing, the letters, the ⌥ + Space press and a closing chime with a soft pad.

usage: python3 sting.py cues.json duration out.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
cues = json.load(open(sys.argv[1]))
DUR = float(sys.argv[2])
N = int(SR * DUR)
rng = np.random.default_rng(3)
OUT = np.zeros((N, 2))


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.002, decay=0.1):
    t = tt(d)
    return np.minimum(1, t / a) * np.exp(-t / decay)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i < 0 or i >= N:
        return
    sig = sig[: N - i] * gain
    OUT[i:i + len(sig), 0] += sig * np.sqrt((1 - pan) / 2) * 1.414
    OUT[i:i + len(sig), 1] += sig * np.sqrt((1 + pan) / 2) * 1.414


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def norm(x):
    m = np.max(np.abs(x))
    return x / m if m else x


def sine(freq, d):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (int(d * SR),))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def glide(f0, f1, d, k=30):
    return f1 + (f0 - f1) * np.exp(-tt(d) * k)


def whoosh(d, lo, hi, rise=False):
    t = tt(d)
    shape = (t / d) ** 2.2 if rise else np.sin(np.pi * t / d) ** 2
    return norm(bandpass(rng.standard_normal(len(t)), lo, hi)) * shape


def bell(freq, d=1.2, decay=0.35):
    t = tt(d)
    return sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / (decay / (1 + m * .6))) for m, a in [(1, 1), (2.01, .35), (3.02, .15)]) * np.minimum(1, t / .002)


def thock(f0=150):
    d = .6
    return norm(sine(glide(f0, 46, d, 16), d) * env(d, .002, .16) + bandpass(rng.standard_normal(int(d * SR)), 1500, 7000) * env(d, .0004, .006) * .5)


def click():
    d = .05
    return norm(bandpass(rng.standard_normal(int(d * SR)), 1800, 6500) * env(d, .0005, .006) + sine(glide(260, 140, d, 60), d) * env(d, .001, .012) * .6) * .5


def pad(freqs, d):
    t = tt(d)
    s = sum(np.sin(2 * np.pi * f * (1 + det) * t) for f in freqs for det in (-.002, .002))
    return s * np.minimum(1, t / .5) * np.minimum(1, (d - t) / .8) / len(freqs)


c = cues
add(whoosh(.55, 600, 4500), c["cursor"], .3, .4)                    # the cursor flies in
add(click(), c["click"], .6)
add(bell(1568, .6, .2), c["click"] + .02, .12)
add(whoosh(.5, 200, 3000, rise=True), c["wipe"] - .2, .35)           # the orange wipe
add(thock(120), c["wipe"] + .25, .6)
add(whoosh(.45, 300, 2500), c["card"] - .15, .25, -.3)
add(thock(170), c["logo"] + .25, .75)                                 # the logo lands
for k, f in enumerate([1318.5, 1568.0, 1760.0, 2093.0, 2637.0]):
    add(bell(f, 1.4, .4), c["logo"] + .28 + k * .05, .06, (k - 2) * .25)
for i in range(6):                                                    # the letters
    add(click(), c["letters"] + i * .05 + .1, .25, (i - 2.5) * .15)
add(thock(200), c["press"], .55)                                      # ⌥ + Space
add(click(), c["press"] + .01, .5)
for k, f in enumerate([1046.5, 1318.5, 1568.0]):
    add(bell(f, 1.0, .3), c["tag"] + k * .06, .08)
add(bell(2093.0, 1.6, .5), c["pill"] + .1, .12)                      # closing chime
add(pad([440.0, 523.25, 659.25, 880.0], DUR - c["card"]), c["card"], .07)

fo = int(.4 * SR)
OUT[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
OUT = np.tanh(OUT * 1.1) / np.tanh(1.1)
OUT = OUT / max(1e-9, np.max(np.abs(OUT))) * .8
with wave.open(sys.argv[3], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((OUT * 32767).astype("<i2").tobytes())
print("wrote", sys.argv[3])
