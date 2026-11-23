"""Soundtrack for the Guess The Distance brag video, synthesized from scratch.

Sound effects come from the page's own cue list (sfx.json, written by
`node render.cjs cues sfx.json`), so every wheel tick lands on the frame where a
number passes the band. The music is the game's own chord loop (Dmaj9, Bm9,
Gmaj7, A6) at 112 BPM: sparse under the hook, full from the logo, a breakdown
under the duel's VS, back for the hit, resolving on the last chord.

usage: python3 audio.py sfx.json out.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
DUR = 22.5
N = int(SR * DUR)
rng = np.random.default_rng(11)
MUS = np.zeros((2, N))   # music bus
FX = np.zeros((2, N))    # effects bus
SEND = np.zeros((2, N))  # reverb send

BPM = 112
BEAT = 60 / BPM
SIX = BEAT / 4
BAR = BEAT * 4


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(d):
    return np.arange(int(d * SR)) / SR


def place(bus, sig, t, gain=1.0, pan=0.0, send=0.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i] * gain
    l, r = np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414
    bus[0, i:i + len(sig)] += sig * l
    bus[1, i:i + len(sig)] += sig * r
    if send:
        SEND[0, i:i + len(sig)] += sig * l * send
        SEND[1, i:i + len(sig)] += sig * r * send


def adsr(n, a=0.005, d=0.1, s=0.6, r=0.2, total=None):
    total = n / SR if total is None else total
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel_start = max(0.0, total - r)
    e *= np.where(t > rel_start, np.clip(1 - (t - rel_start) / max(r, 1e-6), 0, 1), 1)
    return e


def fft_filter(x, lo=0.0, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def noise(d):
    return rng.uniform(-1, 1, int(d * SR))


# ---------- instruments ----------
def soft_saw(f, d, harmonics=10, bright=1.0):
    t = tt(d)
    out = np.zeros_like(t)
    for n in range(1, harmonics + 1):
        if f * n > 12000:
            break
        out += np.sin(2 * np.pi * f * n * t) / n * (bright ** (n - 1))
    return out


def pad(notes, t, d, gain=0.05, bright=0.55):
    sig = sum(soft_saw(mtof(n), d + 0.8, 9, bright) * 0.5 + soft_saw(mtof(n) * 1.004, d + 0.8, 9, bright) * 0.5 for n in notes)
    sig *= adsr(len(sig), a=0.6, d=1, s=1, r=0.8, total=d + 0.8)
    place(MUS, sig, t, gain, 0, send=0.6)


def pluck(n, t, gain=0.12, pan=0.0, d=0.45):
    f = mtof(n)
    x = tt(d)
    sig = (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(4 * np.pi * f * x) + 0.12 * np.sin(6 * np.pi * f * x)) * np.exp(-x / 0.16)
    sig *= np.minimum(1, x / 0.003)
    place(MUS, sig, t, gain, pan, send=0.35)


def bass(n, t, d, gain=0.32):
    f = mtof(n)
    x = tt(d)
    sig = np.sin(2 * np.pi * f * x) + 0.25 * np.sin(4 * np.pi * f * x)
    sig *= adsr(len(sig), a=0.008, d=0.15, s=0.7, r=0.06)
    place(MUS, np.tanh(sig * 1.4), t, gain)


def kick(t, gain=0.85, bus=None):
    d = 0.42
    x = tt(d)
    freq = 45 + 110 * np.exp(-x / 0.045)
    sig = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-x / 0.14)
    sig += noise(d) * np.exp(-x / 0.004) * 0.25
    place(MUS if bus is None else bus, sig, t, gain)


def clap(t, gain=0.22):
    d = 0.25
    sig = fft_filter(noise(d), 900, 4500)
    x = tt(d)
    e = np.exp(-x / 0.06) * (1 + 0.7 * np.exp(-((x - 0.012) ** 2) / 0.00002))
    place(MUS, sig * e, t, gain, 0.1, send=0.5)


def hat(t, gain=0.05, d=0.05, pan=0.25):
    sig = fft_filter(noise(d), 7000) * np.exp(-tt(d) / (d / 4))
    place(MUS, sig, t, gain, pan)


# ---------- music ----------
PROG = [[50, 57, 61, 64, 69], [47, 54, 57, 62, 66], [43, 50, 54, 59, 62], [45, 52, 57, 61, 64]]


def section(t):
    """How full the music is at time t."""
    if t < 3.2:
        return "intro"
    if t < 6.7:
        return "build"
    if t < 12.55:
        return "full"
    if t < 14.2:
        return "break"
    if t < 19.8:
        return "full"
    return "end"


bars = int(DUR / BAR) + 1
for b in range(bars):
    t0 = b * BAR
    if t0 >= 19.8:
        break
    ch = PROG[b % 4]
    pad(ch[1:], t0, min(BAR, 19.8 - t0), gain=0.065 if section(t0) == "intro" else 0.04 if section(t0) == "break" else 0.045, bright=0.45 if t0 < 3.2 else 0.6)
    for s in range(16):
        t = t0 + s * SIX
        if t >= 19.8:
            break
        sec = section(t)
        tones = ch[1:] + [n + 12 for n in ch[1:]]
        # arpeggio: sparse in the intro, every 8th later
        if s % 2 == 0 and (sec != "intro" or s % 4 == 0):
            idx = (s // 2 + b * 3) % len(tones)
            pluck(tones[idx] + 12, t, 0.16 if sec == "intro" else 0.11, pan=0.3 if s % 4 else -0.3)
        if sec in ("build", "full"):
            hat(t, 0.035 if s % 2 else 0.05) if (sec == "full" or s % 2 == 0) else None
        if sec == "build" and s in (0, 8):
            kick(t, 0.6)
        if sec == "intro" and s in (0, 8) and t > 0.3:
            kick(t, 0.5)
            bass(ch[0] - 12, t, SIX * 6, 0.2)
        if sec == "full":
            if s % 4 == 0:
                kick(t)
            if s in (4, 12):
                clap(t)
            if s % 2 == 0:
                bass(ch[0] - 12 + (12 if s % 8 == 6 else 0), t, SIX * 1.7)
        if sec == "build" and s in (0, 10):
            bass(ch[0] - 12, t, SIX * 5, 0.24)

# final chord on the outro, ringing out
pad([50, 57, 61, 64, 69, 74], 19.95, 2.2, gain=0.06, bright=0.7)
bass(38, 19.95, 1.8, 0.3)
for i, n in enumerate([74, 78, 81, 86]):
    pluck(n, 20.0 + i * 0.09, 0.08, pan=(-0.4 + i * 0.25), d=1.2)


# ---------- effects ----------
def tone(f, t, d, gain, kind="sine", pan=0.0, send=0.2, decay=None):
    x = tt(d)
    if kind == "tri":
        sig = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * x))
    elif kind == "saw":
        sig = soft_saw(f, d, 8, 0.8)
    else:
        sig = np.sin(2 * np.pi * f * x)
    sig *= np.minimum(1, x / 0.004) * (np.exp(-x / decay) if decay else np.clip(1 - x / d, 0, 1))
    place(FX, sig, t, gain, pan, send)


def bell(f, t, gain=0.12, d=1.2, pan=0.0):
    for k, a in [(1, 1), (2.01, 0.35), (3.98, 0.12)]:
        tone(f * k, t, d, gain * a, pan=pan, send=0.5, decay=d / (2.5 * k))


def whoosh(t, d=0.5, gain=0.18, lo=300, hi=4000):
    n = noise(d)
    x = tt(d)
    # crossfade a dark and a bright version for a sweep
    dark = fft_filter(n, lo * 0.6, lo * 3)
    bright = fft_filter(n, hi * 0.4, hi * 1.6)
    p = x / d
    sig = dark * (1 - p) + bright * p
    sig *= np.sin(np.pi * np.clip(p, 0, 1)) ** 1.5
    place(FX, sig, t, gain, 0, send=0.3)


def boom(t, gain=0.9):
    d = 1.6
    x = tt(d)
    freq = 38 + 70 * np.exp(-x / 0.08)
    sig = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-x / 0.5)
    sig += fft_filter(noise(d), 60, 900) * np.exp(-x / 0.25) * 0.5
    place(FX, sig, t, gain, 0, send=0.6)


cues = json.load(open(sys.argv[1]))
duck = np.ones(N)


def duck_at(t, depth=0.4, length=0.6):
    i = int(t * SR)
    n = int(length * SR)
    if i >= N:
        return
    seg = 1 - depth * np.exp(-np.arange(n) / (SR * length / 3))
    duck[i:i + n] = np.minimum(duck[i:i + n], seg[: N - i])


PENTA = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95, 98]
for c in cues:
    t, k, v = c["t"], c["k"], c.get("v")
    if k == "tick":
        d = 0.02
        sig = fft_filter(noise(d), 2500, 6000) * np.exp(-tt(d) / 0.004)
        place(FX, sig, t, 0.55 * (v or 1), 0.15)
        tone(2600, t, 0.015, 0.03)
    elif k == "press":
        tone(180, t, 0.08, 0.25, decay=0.03)
    elif k == "lock":
        tone(mtof(76), t, 0.25, 0.16, "tri", decay=0.08)
        tone(mtof(83), t + 0.07, 0.4, 0.16, "tri", decay=0.12)
    elif k == "whoosh":
        whoosh(t - 0.15, 0.55, 0.16)
    elif k == "swap":
        tone(1400, t, 0.05, 0.06)
    elif k == "draw":
        d = 1.4
        x = tt(d)
        sig = fft_filter(noise(d), 1500, 5000) * (x / d) ** 2 * 0.25
        place(FX, sig, t, 0.25, 0, send=0.4)
        for i in range(8):
            pluck(62 + [0, 4, 7, 9, 12, 16, 19, 21][i], t + i * 0.17, 0.05, pan=-0.5 + i * 0.13)
    elif k == "count":
        n = PENTA[min(len(PENTA) - 1, int(v * len(PENTA)))]
        tone(mtof(n), t, 0.1, 0.07, "tri", send=0.1, decay=0.04)
    elif k == "bell":
        for i, n in enumerate([72, 76, 79, 84] if v == 3 else [74, 78, 81, 86, 90]):
            bell(mtof(n), t + i * 0.08, 0.1, pan=-0.3 + i * 0.15)
    elif k == "riser":
        d = 0.35
        x = tt(d)
        sig = fft_filter(noise(d), 2000, 9000) * (x / d) ** 3
        place(FX, sig, t, 0.3, 0, send=0.3)
    elif k == "boom":
        boom(t)
        duck_at(t, 0.6, 0.9)
    elif k == "boom2":
        boom(t, 0.6)
        duck_at(t, 0.4, 0.7)
    elif k == "sparkle":
        for i, n in enumerate([86, 90, 93, 98, 102]):
            bell(mtof(n), t + i * 0.06, 0.05, 0.8, pan=-0.4 + i * 0.2)
    elif k == "swish":
        whoosh(t - 0.08, 0.3, 0.09, 600, 6000)
    elif k == "pop":
        d = 0.09
        x = tt(d)
        f = 500 + 900 * x / d + (v or 0) * 60
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.03)
        place(FX, sig, t, 0.12, -0.3 + (v or 0) * 0.15)
    elif k in ("slam", "slam2"):
        kick(t, 0.8, FX)
        place(FX, fft_filter(noise(0.3), 200, 3000) * np.exp(-tt(0.3) / 0.06), t, 0.3, -0.5 if k == "slam" else 0.5, send=0.4)
        duck_at(t, 0.5, 0.4)
    elif k == "vs":
        for n in [57, 64, 69, 73, 76]:
            tone(mtof(n), t, 0.9, 0.045, "saw", send=0.5, decay=0.35)
    elif k == "hit":
        tone(1318, t, 0.25, 0.05, "tri")
        bell(1760, t + 0.04, 0.1, 0.6)
        place(FX, fft_filter(noise(0.12), 5000) * np.exp(-tt(0.12) / 0.03), t, 0.12)
    elif k == "damage":
        kick(t, 1.0, FX)
        place(FX, fft_filter(noise(0.4), 80, 1400) * np.exp(-tt(0.4) / 0.1), t, 0.45)
        d = 0.6
        x = tt(d)
        f = 110 * (50 / 110) ** (x / d)
        place(FX, np.tanh(3 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-x / 0.2), t, 0.14)
        duck_at(t, 0.6, 0.8)

# ---------- reverb (FFT convolution with a decaying noise tail) ----------
ir_len = int(2.2 * SR)
xi = np.arange(ir_len) / SR
size = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.zeros((2, N))
for ch in range(2):
    ir = rng.uniform(-1, 1, ir_len) * np.exp(-xi / 0.55)
    ir = fft_filter(ir, 200, 7000)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet[ch] = np.fft.irfft(np.fft.rfft(SEND[ch], size) * np.fft.rfft(ir, size), size)[:N]

mix = MUS * duck + FX + wet * 0.28
# gentle fade in/out
fade = np.ones(N)
fade[: int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
tail = int(0.6 * SR)
fade[-tail:] = np.linspace(1, 0, tail) ** 1.5
mix *= fade
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix /= max(1e-9, np.max(np.abs(mix))) / 0.89

out = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(out.tobytes())
print("wrote", sys.argv[2], f"{DUR}s")
