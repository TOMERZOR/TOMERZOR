"""Soundtrack for the ArsLate showreel: narration and effects (no music), mixed from scratch.

- The narration (vo.mp3, ElevenLabs) is cut into its nine lines and placed where the picture wants them
  (vo.json `segs`), so the words land on the cuts.
- Sound effects follow the page's own cue list (sfx.json), so a key click lands on the frame its letter appears.

usage: python3 audio.py sfx.json vo.f32 vo.json out.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(11)
cues = json.load(open(sys.argv[1]))
SFX = cues["sfx"] if isinstance(cues, dict) else cues
VO = json.load(open(sys.argv[3]))
DUR = VO["dur"]
N = int(SR * DUR)
MUS_L, MUS_R = np.zeros(N), np.zeros(N)
FX_L, FX_R = np.zeros(N), np.zeros(N)
VO_L, VO_R = np.zeros(N), np.zeros(N)


def add(L, R, sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    sig = sig[: N - i] * gain
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


# ---------------- effects ----------------
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
    return norm(sweep_bp(n, f0, f1, q)) * np.sin(np.pi * t / d) ** 2


def boom():
    d = 1.6
    sub = sine(glide(90, 42, d, 6), d) * env(d, 0.004, 0.55)
    hit = bandpass(rng.standard_normal(int(d * SR)), 30, 900) * env(d, 0.001, 0.05)
    return norm(sub + hit * 0.5)


def bell(freq, d=1.2, decay=0.35):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / (decay / (1 + m * 0.6))) for m, a in [(1, 1), (2.01, 0.35), (3.02, 0.18), (4.2, 0.08)])
    return s * np.minimum(1, t / 0.002)


def riser(d=1.0):
    t = tt(d)
    n = norm(sweep_bp(rng.standard_normal(len(t)), 400, 6000, 1.2))
    tone = sine(220 * 2 ** (t / d), d) * 0.25
    return (n + tone) * (t / d) ** 2.2


def stamp():
    d = 0.35
    thud = sine(glide(220, 70, d, 30), d) * env(d, 0.001, 0.08)
    slap = bandpass(rng.standard_normal(int(d * SR)), 300, 3000) * env(d, 0.0005, 0.02)
    return norm(thud + slap * 0.8)


def tick(f=2600):
    return sine(f, .03) * env(.03, .0005, .008)


for t, kind in SFX:
    j = rng.uniform(-0.15, 0.15)
    if kind == "key":
        add(FX_L, FX_R, key(1 + j), t, 0.3, rng.uniform(-.25, .25))
    elif kind == "space":
        add(FX_L, FX_R, key(0.7), t, 0.34, rng.uniform(-.2, .2))
    elif kind == "pop":
        add(FX_L, FX_R, pop(), t, 0.42, 0.15)
    elif kind == "whoosh":
        add(FX_L, FX_R, swoosh(0.55, 3200, 380), t - 0.12, 0.32, 0.3)
    elif kind == "swish":
        add(FX_L, FX_R, swoosh(0.4, 500, 2600), t - 0.05, 0.25, -0.2)
    elif kind == "send":
        add(FX_L, FX_R, swoosh(0.28, 900, 5000, 2.2), t, 0.33, -0.3)
    elif kind == "tick":
        add(FX_L, FX_R, tick(), t, 0.3)
    elif kind == "blip":
        add(FX_L, FX_R, tick(1400 + j * 600), t, 0.35)
    elif kind == "thud":
        add(FX_L, FX_R, sine(glide(160, 60, .3, 25), .3) * env(.3, .002, .09), t, 0.7)
        add(FX_L, FX_R, tick(), t, 0.3)
    elif kind == "roll":
        for k in range(6):
            add(FX_L, FX_R, tick(1800 + k * 220), t + k * 0.06, 0.25)
    elif kind == "riser":
        add(FX_L, FX_R, riser(), t - 0.5, 0.3)
    elif kind == "boom":
        add(FX_L, FX_R, boom(), t, 0.95)
    elif kind == "shimmer":
        for k, f in enumerate([1174.7, 1244.5, 1480.0, 1760.0, 2349.3]):
            add(FX_L, FX_R, bell(f, 1.4, 0.4), t + k * 0.055, 0.09, (k - 2) * 0.25)
    elif kind == "chime":
        add(FX_L, FX_R, bell(1760.0, 1.2, .35), t, 0.14, 0.2)
        add(FX_L, FX_R, bell(2349.3, 1.2, .35), t + 0.08, 0.12, -0.2)
    elif kind == "click":
        add(FX_L, FX_R, key(0.6), t, 0.4)
    elif kind == "stamp":
        add(FX_L, FX_R, stamp(), t, 0.8)
    elif kind == "strike":
        add(FX_L, FX_R, swoosh(0.22, 1500, 4000, 3), t, 0.3, 0.2)

# ---------------- narration ----------------
raw = np.fromfile(sys.argv[2], dtype=np.float32).reshape(-1, 2)
for seg in VO["segs"]:
    a, b = seg["src"]
    i0, i1 = max(0, int(a * SR)), min(len(raw), int(b * SR))
    piece = raw[i0:i1].copy()
    fade = min(int(0.03 * SR), len(piece) // 4)
    ramp = np.linspace(0, 1, fade)[:, None]
    piece[:fade] *= ramp
    piece[-fade:] *= ramp[::-1]
    at = seg["at"] + (i0 / SR - a)  # keep the placement exact if the cut was clamped
    add(VO_L, VO_R, piece[:, 0], at, 1.0, -0.02)
    add(VO_L, VO_R, piece[:, 1], at, 1.0, 0.02)

# ---------------- mix ----------------
vo_gain = 1.0
mix = np.stack([FX_L + VO_L * vo_gain, FX_R + VO_R * vo_gain], 1)
fo = int(0.6 * SR)
mix[-fo:] *= (np.linspace(1, 0, fo) ** 2)[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix / np.max(np.abs(mix)) * 0.92
pcm = (mix * 32767).astype("<i2")
with wave.open(sys.argv[4], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[4], len(SFX), "cues")
