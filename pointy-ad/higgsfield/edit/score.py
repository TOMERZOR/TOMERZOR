"""Music bed and UI sweeteners for the live-action Pointy ad, synthesized (no samples, no licensing).

The clips keep their own native audio (keys, breath, room); this adds a quiet sub pulse and plucks at
100 BPM that start on the key press, thin out under the frustration shot, come back when Pointy opens,
and resolve under the call to action, plus the UI sounds (bloom, typing, swish, pings, success chime).

usage: python3 score.py timeline.json out.wav [--no-music]   (--no-music keeps only the UI sweeteners)
"""
import json
import sys
import wave

import numpy as np

SR = 48000
tl = json.load(open(sys.argv[1]))
DUR = tl["end"]
N = int(SR * DUR)
rng = np.random.default_rng(5)
FX = np.zeros((N, 2))
MU = np.zeros((N, 2))


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.002, decay=0.1):
    t = tt(d)
    return np.minimum(1, t / a) * np.exp(-t / decay)


def add(sig, t, gain=1.0, pan=0.0, bus=None):
    bus = FX if bus is None else bus
    i = int(round(t * SR))
    if i >= N or i < 0:
        return
    sig = sig[: N - i] * gain
    bus[i:i + len(sig), 0] += sig * np.sqrt((1 - pan) / 2) * 1.414
    bus[i:i + len(sig), 1] += sig * np.sqrt((1 + pan) / 2) * 1.414


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def sine(freq, d):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (int(d * SR),))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def glide(f0, f1, d, k=30):
    return f1 + (f0 - f1) * np.exp(-tt(d) * k)


def norm(x):
    m = np.max(np.abs(x))
    return x / m if m else x


def noise(d):
    return rng.standard_normal(int(d * SR))


def bell(freq, d=1.2, decay=0.35):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / (decay / (1 + m * 0.6))) for m, a in [(1, 1), (2.01, 0.35), (3.02, 0.18)])
    return s * np.minimum(1, t / 0.002)


def whoosh(d, lo, hi, rev=False):
    n = norm(bandpass(noise(d), lo, hi))
    t = tt(d)
    shape = (t / d) ** 2.5 if rev else np.sin(np.pi * t / d) ** 2
    return n * shape


def thock():
    d = 0.6
    body = sine(glide(140, 48, d, 16), d) * env(d, 0.002, 0.16)
    click = bandpass(noise(d), 1500, 7000) * env(d, 0.0004, 0.006)
    return norm(body + click * 0.5)


def key():
    d = 0.05
    return norm(bandpass(noise(d), 1800, 6500) * env(d, 0.0005, 0.006) + sine(glide(260, 140, d, 60), d) * env(d, 0.001, 0.012) * 0.6) * 0.5


def pop():
    d = 0.16
    return sine(500 + 750 * (1 - np.exp(-tt(d) * 60)), d) * env(d, 0.002, 0.045)


# ---------------- sweeteners ----------------
s2, s3, s4, s5, press = tl["s2"], tl["s3"], tl["s4"], tl["s5"], tl["press"]
add(whoosh(0.9, 200, 3000, rev=True), press - 0.9, 0.35)       # sucked into the press
add(thock(), press, 0.9)
for k, f in enumerate([1318.5, 1760.0, 2349.3]):                    # Pointy opening: a soft bloom
    add(bell(f, 1.2, 0.4), s3 + 1.2 + k * 0.05, 0.07, (k - 1) * 0.3)
q = "איך עושים זום-אין איטי לסרטון?"
for i in range(len(q)):
    add(key(), s3 + 1.4 + 1.2 * (i + 1) / len(q), 0.18, rng.uniform(-.2, .2))
add(whoosh(0.4, 900, 4500), s3 + 2.9, 0.22, 0.2)                    # the cursor flies
add(bell(1568.0, 0.7, 0.2), s3 + 3.65, 0.12)
add(pop(), s4 + 0.5, 0.35)
for k, x in enumerate([s4 + 1.4, s4 + 2.2]):
    add(bell(1568.0 * (1.12 ** (k + 1)), 0.6, 0.18), x, 0.11)
for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):            # success
    add(bell(f, 1.2, 0.35), s4 + 3.0 + k * 0.06, 0.09, (k - 1.5) * 0.2)
add(whoosh(0.5, 300, 3000), s5 - 0.15, 0.25)
add(thock(), s5 + 0.3, 0.55)
for k, f in enumerate([1318.5, 1568.0, 1760.0, 2093.0, 2637.0]):
    add(bell(f, 1.4, 0.4), s5 + 0.32 + k * 0.05, 0.05, (k - 2) * 0.25)
add(pop(), s5 + 1.0, 0.35)

# ---------------- music: sub pulse + plucks, 100 BPM, A minor ----------------
B = 60 / 100


def sub(freq, d):
    t = tt(d)
    return np.sin(2 * np.pi * freq * t) * np.minimum(1, t / 0.01) * np.exp(-t / 0.35)


def pluck(freq, d=0.6):
    t = tt(d)
    return sum(np.sin(2 * np.pi * freq * m * t) / m * np.exp(-t * (5 + m * 4)) for m in range(1, 6)) * np.minimum(1, t / 0.002)


def pad(freqs, d):
    t = tt(d)
    s = sum(np.sin(2 * np.pi * f * (1 + det) * t) for f in freqs for det in (-0.002, 0.002))
    return s * np.minimum(1, t / 0.8) * np.minimum(1, (d - t) / 0.6) / len(freqs)


ROOTS = [55.0, 43.65, 65.41, 49.0]
CH = [[440.0, 523.25, 659.25], [349.23, 440.0, 523.25], [329.63, 392.0, 523.25], [392.0, 493.88, 587.33]]
t0, n = press, 0
while t0 < DUR - 0.8:
    bar = n // 4
    thin = s2 <= t0 < s3 + 1.1                                       # the frustration shot: only a low pulse
    add(sub(ROOTS[bar % 4] * 2, B * 0.9), t0, 0.35 if thin else 0.5, 0, MU)
    if not thin:
        add(pluck(CH[bar % 4][n % 3] * (2 if n % 4 == 3 else 1)), t0 + B / 2, 0.16, (n % 2 - .5) * .4, MU)
        if n % 4 == 0:
            add(pad(CH[bar % 4], B * 4), t0, 0.06, 0, MU)
    t0 += B
    n += 1
add(pad([440.0, 523.25, 659.25, 880.0], 2.4), DUR - 2.6, 0.08, 0, MU)

mix = FX + (0 if "--no-music" in sys.argv else MU * 0.8)
fo = int(0.3 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix / max(1e-9, np.max(np.abs(mix))) * 0.7
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", sys.argv[2])
