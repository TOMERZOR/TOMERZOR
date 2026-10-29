"""Soundtrack for the ArsLate ad, synthesized from scratch.

Sound effects come from the page's own cue list (sfx.json, written by the renderer), so every key click
lands on the frame where a letter appears. The music is a darbuka maqsum groove with bass, pad and a
plucked lead in Hijaz on D at 100 BPM. It enters on the logo reveal, drops out before the outro and comes
back on the last logo hit.

usage: python3 audio.py sfx.json out.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
DUR = 30.5
rng = np.random.default_rng(7)
L = np.zeros(int(SR * DUR))
R = np.zeros(int(SR * DUR))


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
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
def key(bright=1.0):
    d = 0.05
    n = rng.standard_normal(int(d * SR))
    click = bandpass(n, 1800 * bright, 6500 * bright) * env(d, 0.0005, 0.006)
    body = sine(glide(260, 140, d, 60), d) * env(d, 0.001, 0.012) * 0.6
    return norm(click * 1.4 + body) * 0.5


def pop(f0=500, f1=1250):
    d = 0.16
    return sine(f0 + (f1 - f0) * (1 - np.exp(-tt(d) * 60)), d) * env(d, 0.002, 0.045)


def swoosh(d, f0, f1, q=1.4):
    n = rng.standard_normal(int(d * SR))
    t = tt(d)
    shape = np.sin(np.pi * t / d) ** 2
    return norm(sweep_bp(n, f0, f1, q)) * shape


def boom():
    d = 1.6
    sub = sine(glide(90, 42, d, 6), d) * env(d, 0.004, 0.55)
    hit = bandpass(rng.standard_normal(int(d * SR)), 30, 900) * env(d, 0.001, 0.05)
    return norm(sub + hit * 0.5)


def bell(freq, d=1.2, decay=0.35):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / (decay / (1 + m * 0.6))) for m, a in [(1, 1), (2.01, 0.35), (3.02, 0.18), (4.2, 0.08)])
    return s * np.minimum(1, t / 0.002)


def cash():
    d = 0.9
    t = tt(d)
    s = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / dc) for f, dc in [(2093, .35), (2637, .3), (3136, .25), (4186, .18)])
    tick = bandpass(rng.standard_normal(len(t)), 3000, 9000) * env(d, 0.0005, 0.01)
    return norm(s * np.minimum(1, t / 0.001) + tick * 2)


def riser():
    d = 1.0
    t = tt(d)
    n = norm(sweep_bp(rng.standard_normal(len(t)), 400, 6000, 1.2))
    tone = sine(220 * 2 ** (t * 1.0), d) * 0.25
    return (n + tone) * (t / d) ** 2.2


SFX = json.load(open(sys.argv[1]))
for t, kind in SFX:
    j = rng.uniform(-0.15, 0.15)
    if kind == "key":
        add(key(1 + j), t, 0.32, rng.uniform(-.25, .25))
    elif kind == "space":
        add(key(0.7), t, 0.36, rng.uniform(-.2, .2))
    elif kind == "del":
        add(key(1.3 + j), t, 0.28, -0.1)
    elif kind == "pop":
        add(pop(), t, 0.45, 0.15)
    elif kind == "soft":
        add(pop(300, 520), t, 0.35)
    elif kind in ("whoosh",):
        add(swoosh(0.5, 3200, 380), t - 0.12, 0.35, 0.3)
    elif kind == "swish":
        add(swoosh(0.4, 500, 2600), t - 0.05, 0.25, -0.2)
    elif kind == "send":
        add(swoosh(0.28, 900, 5000, 2.2), t, 0.33, -0.3)
    elif kind == "tick":
        add(sine(2600, .03) * env(.03, .0005, .008), t, 0.3)
    elif kind == "thud":
        add(sine(glide(160, 60, .3, 25), .3) * env(.3, .002, .09), t, 0.7)
        add(sine(2600, .03) * env(.03, .0005, .008), t, 0.3)
    elif kind == "roll":
        for k in range(6):
            add(sine(1800 + k * 220, .03) * env(.03, .0005, .008), t + k * 0.06, 0.25)
    elif kind == "riser":
        add(riser(), t, 0.3)
    elif kind == "boom":
        add(boom(), t, 0.95)
    elif kind == "shimmer":
        for k, f in enumerate([1174.7, 1244.5, 1480.0, 1760.0, 2349.3]):
            add(bell(f, 1.4, 0.4), t + k * 0.055, 0.09, (k - 2) * 0.25)
    elif kind == "chime":
        add(bell(1760.0, 1.2, .35), t, 0.14, 0.2)
        add(bell(2349.3, 1.2, .35), t + 0.08, 0.12, -0.2)
    elif kind == "click":
        add(key(0.6), t, 0.4)
    elif kind == "paste":
        add(swoosh(0.18, 2000, 6000, 2.5), t, 0.22)
    elif kind == "strike":
        add(swoosh(0.22, 1500, 4000, 3), t, 0.25, 0.2)
    elif kind == "cash":
        add(cash(), t, 0.35)
    elif kind == "scramble":
        for k in range(14):
            add(sine(rng.uniform(1200, 3600), .025) * env(.025, .0005, .006), t + k * 0.036, 0.22, rng.uniform(-.5, .5))

# ---------------- music ----------------
BPM = 100
S16 = 60 / BPM / 4
BAR = S16 * 16
HZ = {"C2": 65.41, "D2": 73.42, "Eb2": 77.78, "F#2": 92.50, "G2": 98.0, "A2": 110.0,
      "D3": 146.83, "Eb3": 155.56, "F#3": 185.0, "G3": 196.0, "A3": 220.0, "Bb3": 233.08, "C4": 261.63,
      "D4": 293.66, "Eb4": 311.13, "F#4": 369.99, "G4": 392.0, "A4": 440.0, "Bb4": 466.16, "C5": 523.25, "D5": 587.33}


def doum():
    d = 0.4
    s = sine(glide(150, 78, d, 22), d) * env(d, 0.002, 0.16)
    s += bandpass(rng.standard_normal(int(d * SR)), 60, 400) * env(d, 0.001, 0.03) * 0.6
    return norm(s)


def tek(soft=False):
    d = 0.09
    n = rng.standard_normal(int(d * SR))
    s = bandpass(n, 2500, 8000) * env(d, 0.0004, 0.012) + sine(980, d) * env(d, 0.0005, 0.02) * 0.5
    return norm(s) * (0.45 if soft else 1)


def bass(freq, d):
    t = tt(d)
    s = sum(np.sin(2 * np.pi * freq * m * t) / m * np.exp(-t * (2 + m * 3)) for m in range(1, 7))
    return s * np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.03)


def pad(freqs, d):
    t = tt(d)
    s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.12, 0.12):
            s += sum(np.sin(2 * np.pi * (f + det * f / 100) * m * t + m) / (m * m) for m in range(1, 5))
    swell = np.minimum(1, t / 0.35) * np.minimum(1, (d - t) / 0.3)
    return s * swell / len(freqs)


def pluck(freq, d=0.9):
    """Karplus-Strong, close enough to an oud for a three-second hook."""
    n = int(SR / freq)
    buf = rng.uniform(-1, 1, n)
    out = np.zeros(int(d * SR))
    for i in range(len(out)):
        out[i] = buf[i % n]
        buf[i % n] = 0.996 * 0.5 * (buf[i % n] + buf[(i + 1) % n])
    return out * np.minimum(1, tt(d) / 0.002)


MAQSUM = {0: "D", 2: "T", 4: "k", 6: "T", 8: "D", 10: "k", 12: "T", 14: "k", 15: "k"}
FILL = {0: "D", 2: "T", 4: "k", 6: "T", 8: "D", 10: "k", 11: "k", 12: "T", 13: "T", 14: "T", 15: "T"}
BASS_A = {0: "D2", 3: "D2", 6: "Eb2", 8: "D2", 11: "F#2", 14: "Eb2"}
BASS_B = {0: "D2", 3: "D2", 6: "C2", 8: "D2", 11: "Eb2", 14: "D2"}
CHORDS = [["D3", "F#3", "A3"], ["D3", "F#3", "A3"], ["Eb3", "G3", "Bb3"], ["D3", "F#3", "A3"]]
HOOK = [(0, "D4"), (2, "Eb4"), (4, "F#4"), (6, "G4"), (8, "A4"), (11, "G4"), (12, "F#4"), (14, "Eb4"), (16, "D4")]

D_, T_, K_ = doum(), tek(), tek(True)
MG = 0.6  # music sits under the effects


def bar_at(t0, n, fill=False, hook=False, drums=True):
    pat = FILL if fill else MAQSUM
    if drums:
        for st, h in pat.items():
            g = {"D": 0.55, "T": 0.32, "k": 0.32}[h]
            add({"D": D_, "T": T_, "k": K_}[h], t0 + st * S16 + rng.uniform(0, .004), g * MG, {"D": 0, "T": .25, "k": -.25}[h])
    for st, note in (BASS_A if n % 2 == 0 else BASS_B).items():
        add(bass(HZ[note], S16 * 2.6), t0 + st * S16, 0.42 * MG)
    add(pad([HZ[x] for x in CHORDS[n % 4]], BAR), t0, 0.07 * MG)
    if hook:
        for st, note in HOOK:
            add(pluck(HZ[note] * 2, 0.8), t0 + st * S16, 0.22 * MG, 0.3)


# a quiet, slightly uneasy drone under the opening chat
add(pad([HZ["D3"], HZ["A3"], HZ["Eb4"]], 5.0), 0.3, 0.035)

# section 1: from the reveal to just before the outro
t0, n = 9.0, 0
while t0 + BAR <= 26.2 + 1e-6:
    bar_at(t0, n, fill=(n % 4 == 3), hook=(n in (0, 4)))
    t0 += BAR
    n += 1
# the remaining beat up to the drop, bass and pad only
rest = 26.2 - t0
if rest > 0.2:
    add(bass(HZ["D2"], rest * 0.9), t0, 0.35)
# section 2: outro on the last logo hit
bar_at(26.8, 0, hook=True)
add(D_, 26.8 + BAR, 0.6)
add(bass(HZ["D2"], 1.2), 26.8 + BAR, 0.45)
for k, note in enumerate(["D4", "F#4", "A4", "D5"]):
    add(pluck(HZ[note], 1.5), 26.8 + BAR + k * 0.03, 0.18, (k - 1.5) * .2)

# ---------------- mix ----------------
fade = np.ones(len(L))
fo = int(0.6 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
mix = np.stack([L, R], 1) * fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix / np.max(np.abs(mix)) * 0.89
pcm = (mix * 32767).astype("<i2")
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[2], len(SFX), "cues")
