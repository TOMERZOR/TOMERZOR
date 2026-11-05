"""Soundtrack for the מפל for you ad, synthesized from scratch.

Sound effects come from the page's own cue list (sfx.json, written by render.mjs), so every ping and pop
lands on the frame where its message or cell appears. The opening is tension only: a low drone, a ticking
pulse that speeds up with the messages, and a riser that cuts dead when the chat is sucked away. The beat
(118 BPM: kick, clap, hats, sub bass and a pad in A minor) drops on the logo and runs to the end.

usage: python3 audio.py sfx.json out.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
DUR = 24.5
rng = np.random.default_rng(11)
L = np.zeros(int(SR * DUR))
R = np.zeros(int(SR * DUR))


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0:
        sig = sig[-i:]
        i = 0
    if i >= len(L):
        return
    sig = sig[: len(L) - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2) * 1.414


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.002, decay=0.1):
    t = tt(d)
    return np.minimum(1, t / a) * np.exp(-t / decay)


def bandpass(x, f_lo, f_hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < f_lo) | (f > f_hi)] = 0
    return np.fft.irfft(X, len(x))


def sweep_bp(x, f0, f1, q=2.0):
    """Biquad band-pass whose center glides from f0 to f1."""
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    n = len(x)
    for i in range(n):
        fc = f0 * (f1 / f0) ** (i / n)
        w = 2 * np.pi * fc / SR
        alpha = np.sin(w) / (2 * q)
        b0, a0, a1, a2 = alpha, 1 + alpha, -2 * np.cos(w), 1 - alpha
        yi = (b0 * x[i] - b0 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, yi
        y[i] = yi
    return y


def sine(freq, d, phase=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (int(d * SR),))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def glide(f0, f1, d, k=30):
    t = tt(d)
    return f1 + (f0 - f1) * np.exp(-t * k)


def norm(x):
    m = np.max(np.abs(x))
    return x / m if m else x


# ---------------- sound effects ----------------
def ping(i):
    """A message landing: two quick bell partials, a little higher each time."""
    f = 880 * 2 ** ((i % 7) / 12 * 2)
    d = 0.35
    t = tt(d)
    s = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t / 0.09)
    return s * np.minimum(1, t / 0.002)


def pop(step=0):
    f0 = 420 * 2 ** (step / 12 * 1.5)
    d = 0.16
    return sine(f0 + f0 * 1.4 * (1 - np.exp(-tt(d) * 60)), d) * env(d, 0.002, 0.045)


def tap():
    d = 0.06
    n = rng.standard_normal(int(d * SR))
    return norm(bandpass(n, 1200, 5000) * env(d, 0.0005, 0.008) + sine(glide(300, 160, d, 70), d) * env(d, 0.001, 0.015) * 0.7)


def tick(i):
    return sine(2400 + i * 180, .03) * env(.03, .0005, .008)


def swoosh(d, f0, f1, q=1.4):
    n = rng.standard_normal(int(d * SR))
    t = tt(d)
    shape = np.sin(np.pi * t / d) ** 2
    return norm(sweep_bp(n, f0, f1, q)) * shape


def flip(i):
    d = 0.12
    n = rng.standard_normal(int(d * SR))
    return norm(bandpass(n, 900 + i * 60, 3500 + i * 120)) * env(d, 0.002, 0.03)


def boom():
    d = 1.6
    sub = sine(glide(95, 40, d, 6), d) * env(d, 0.004, 0.55)
    hit = bandpass(rng.standard_normal(int(d * SR)), 30, 900) * env(d, 0.001, 0.05)
    return norm(sub + hit * 0.5)


def hit():
    """The hook line landing: a short low thump with a clap on top."""
    d = 0.5
    s = sine(glide(140, 55, d, 18), d) * env(d, 0.002, 0.14)
    s += bandpass(rng.standard_normal(int(d * SR)), 900, 6000) * env(d, 0.001, 0.04) * 0.6
    return norm(s)


def bell(freq, d=1.2, decay=0.35):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / (decay / (1 + m * 0.6))) for m, a in [(1, 1), (2.01, 0.35), (3.02, 0.18), (4.2, 0.08)])
    return s * np.minimum(1, t / 0.002)


def riser(d=1.75):
    t = tt(d)
    n = norm(sweep_bp(rng.standard_normal(len(t)), 300, 7000, 1.2))
    tone = sine(110 * 2 ** (t / d * 2), d) * 0.3
    return (n + tone) * (t / d) ** 2


def suck():
    """Reverse whoosh: the chat collapsing into a point."""
    d = 0.4
    t = tt(d)
    n = norm(sweep_bp(rng.standard_normal(len(t)), 5000, 300, 1.6))
    return n * (t / d) ** 2.5


SFX = json.load(open(sys.argv[1]))
for cue in SFX:
    t, kind = cue[0], cue[1]
    arg = cue[2] if len(cue) > 2 else 0
    if kind == "ping":
        add(ping(arg), t, 0.28, rng.uniform(-.35, .35))
    elif kind == "riser":
        add(riser(), t, 0.5)
    elif kind == "hit":
        add(hit(), t, 0.7)
    elif kind == "suck":
        add(suck(), t - 0.32, 0.4)
    elif kind == "boom":
        add(boom(), t, 0.95)
    elif kind == "shimmer":
        for k, f in enumerate([880.0, 1046.5, 1318.5, 1760.0, 2093.0]):
            add(bell(f, 1.4, 0.4), t + k * 0.055, 0.08, (k - 2) * 0.25)
    elif kind == "whoosh":
        add(swoosh(0.45, 3200, 380), t - 0.1, 0.32, 0.3)
    elif kind == "swish":
        add(swoosh(0.35, 500, 2600), t - 0.05, 0.22, -0.2)
    elif kind == "tap":
        add(tap(), t, 0.5)
    elif kind == "paste":
        add(swoosh(0.18, 2000, 6000, 2.5), t, 0.22)
    elif kind == "tick":
        add(tick(arg), t, 0.36, 0.2)
    elif kind == "pop":
        add(pop(arg), t, 0.42, rng.uniform(-.2, .2))
    elif kind == "flip":
        add(flip(arg), t, 0.42, (arg % 3 - 1) * .3)
    elif kind == "chime":
        add(bell(1318.5, 1.2, .35), t, 0.14, 0.2)
        add(bell(1760.0, 1.2, .35), t + 0.08, 0.12, -0.2)
    elif kind == "send":
        add(swoosh(0.28, 900, 5000, 2.2), t, 0.33, -0.3)
        add(pop(8), t + 0.2, 0.3)
    elif kind == "end":
        add(boom(), t, 0.7)

# ---------------- music ----------------
BPM = 118
BEAT = 60 / BPM
S16 = BEAT / 4
BAR = BEAT * 4
HZ = {"A1": 55.0, "F1": 43.65, "C2": 65.41, "G1": 49.0, "E2": 82.41,
      "A3": 220.0, "C4": 261.63, "E4": 329.63, "F3": 174.61, "G3": 196.0, "B3": 246.94, "D4": 293.66}


def kick():
    d = 0.45
    s = sine(glide(150, 48, d, 28), d) * env(d, 0.001, 0.18)
    s += bandpass(rng.standard_normal(int(d * SR)), 1500, 6000) * env(d, 0.0005, 0.004) * 0.4
    return norm(s)


def clap():
    d = 0.3
    n = rng.standard_normal(int(d * SR))
    e = np.zeros(int(d * SR))
    for k, a in enumerate([1, .7, .5]):
        i = int(k * 0.011 * SR)
        seg = env(d, 0.0005, 0.035 if k < 2 else 0.12)[: len(e) - i]
        e[i:i + len(seg)] += a * seg
    return norm(bandpass(n, 900, 5000) * e)


def hat(open_=False):
    d = 0.2 if open_ else 0.05
    n = rng.standard_normal(int(d * SR))
    return norm(bandpass(n, 7000, 16000)) * env(d, 0.0005, 0.06 if open_ else 0.012)


def sub(freq, d):
    t = tt(d)
    s = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2 * t)
    return s * np.minimum(1, t / 0.005) * np.minimum(1, (d - t) / 0.04) * np.exp(-t * 1.2)


def pad(freqs, d):
    t = tt(d)
    s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.15, 0.15):
            s += sum(np.sin(2 * np.pi * (f + det * f / 100) * m * t + m) / (m * m) for m in range(1, 5))
    swell = np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.25)
    return s * swell / len(freqs)


K, C, H, HO = kick(), clap(), hat(), hat(True)
PROG = [("A1", ["A3", "C4", "E4"]), ("F1", ["F3", "A3", "C4"]), ("C2", ["G3", "C4", "E4"]), ("G1", ["G3", "B3", "D4"])]
MG = 0.45


def bar_at(t0, n, half=False):
    root, chord = PROG[n % 4]
    for b in range(4):
        add(K, t0 + b * BEAT, 0.62 * MG)
        if b in (1, 3) and not half:
            add(C, t0 + b * BEAT, 0.34 * MG, 0.1)
    for s16 in range(16):
        if half and s16 % 4:
            continue
        add(HO if s16 % 4 == 2 else H, t0 + s16 * S16, (0.16 if s16 % 2 == 0 else 0.1) * MG, 0.3 if s16 % 2 else -0.2)
    for st in (0, 3, 6, 10, 12):
        add(sub(HZ[root], S16 * 2.5), t0 + st * S16, 0.5 * MG)
    add(pad([HZ[x] for x in chord], BAR), t0, 0.05 * MG)


# opening: a low drone and a pulse that speeds up with the messages, cut at 3.0
drone = pad([110.0, 164.81, 233.08], 3.0)
add(drone * np.linspace(.4, 1, len(drone)), 0.0, 0.05)
tp, gap = 0.0, 0.42
while tp < 2.95:
    add(K * 0.6, tp, 0.22)
    tp += gap
    gap = max(0.14, gap * 0.9)

# the beat: from the logo to the end hit
DROP = 3.38
t0, n = DROP, 0
while t0 + BAR <= 23.9 + 1e-6:
    bar_at(t0, n, half=(n == 0))
    t0 += BAR
    n += 1
rest = 23.9 - t0
for b in range(int(rest / BEAT)):
    add(K, t0 + b * BEAT, 0.62 * MG)
add(pad([HZ[x] for x in ["A3", "C4", "E4"]], 0.6 + 1.2), 23.9, 0.06)

# ---------------- mix ----------------
fade = np.ones(len(L))
fo = int(0.5 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
mix = np.stack([L, R], 1) * fade[:, None]
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix = mix / np.max(np.abs(mix)) * 0.89
pcm = (mix * 32767).astype("<i2")
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[2], len(SFX), "cues")
