"""Soundtrack for the Pointy ad, synthesized from scratch (no samples, no licensing).

Sound effects come from the page's own cue list (sfx.json, written by the renderer), so every key, click
and landing sounds on the frame where it happens. The music is a bright electronic groove at 120 BPM in
A minor (Am F C G). Before the reveal there is only a low pad, the timer's ticks and a riser; the beat
drops on the ⌥ Space press (6.3 s), stops for the timer hitting zero (19.8 s) and comes back for the
call to action. The music is ducked on every kick so the effects stay clear.

usage: python3 audio.py sfx.json out.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
DUR = 25.0
rng = np.random.default_rng(11)
N = int(SR * DUR)
FX = np.zeros((N, 2))
MU = np.zeros((N, 2))


def add(sig, t, gain=1.0, pan=0.0, bus=None):
    bus = FX if bus is None else bus
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[: N - i] * gain
    bus[i:i + len(sig), 0] += sig * np.sqrt((1 - pan) / 2) * 1.414
    bus[i:i + len(sig), 1] += sig * np.sqrt((1 + pan) / 2) * 1.414


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.002, decay=0.1):
    t = tt(d)
    return np.minimum(1, t / a) * np.exp(-t / decay)


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def sweep_bp(x, f0, f1, q=2.0):
    """Biquad band-pass whose centre glides from f0 to f1."""
    y = np.zeros_like(x)
    n = len(x)
    fc = f0 * (f1 / f0) ** (np.arange(n) / max(1, n - 1))
    x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        w = 2 * np.pi * fc[i] / SR
        al = np.sin(w) / (2 * q)
        b0, a0, a1, a2 = al, 1 + al, -2 * np.cos(w), 1 - al
        yi = (b0 * x[i] - b0 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, yi
        y[i] = yi
    return y


def sine(freq, d, phase=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (int(d * SR),))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def glide(f0, f1, d, k=30):
    return f1 + (f0 - f1) * np.exp(-tt(d) * k)


def norm(x):
    m = np.max(np.abs(x))
    return x / m if m else x


def noise(d):
    return rng.standard_normal(int(d * SR))


# ---------------- sound effects ----------------
def key(bright=1.0):
    d = 0.05
    click = bandpass(noise(d), 1800 * bright, 6500 * bright) * env(d, 0.0005, 0.006)
    body = sine(glide(260, 140, d, 60), d) * env(d, 0.001, 0.012) * 0.6
    return norm(click * 1.4 + body) * 0.5


def pop(f0=500, f1=1250):
    d = 0.16
    return sine(f0 + (f1 - f0) * (1 - np.exp(-tt(d) * 60)), d) * env(d, 0.002, 0.045)


def swoosh(d, f0, f1, q=1.4):
    t = tt(d)
    return norm(sweep_bp(noise(d), f0, f1, q)) * np.sin(np.pi * t / d) ** 2


def boom():
    d = 1.6
    sub = sine(glide(110, 44, d, 6), d) * env(d, 0.004, 0.5)
    hit = bandpass(noise(d), 30, 1200) * env(d, 0.001, 0.05)
    return norm(sub + hit * 0.5)


def hit():
    d = 0.7
    body = sine(glide(180, 60, d, 14), d) * env(d, 0.002, 0.18)
    snap = bandpass(noise(d), 800, 6000) * env(d, 0.0005, 0.04)
    return norm(body + snap * 0.6)


def bell(freq, d=1.2, decay=0.35):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / (decay / (1 + m * 0.6))) for m, a in [(1, 1), (2.01, 0.35), (3.02, 0.18), (4.2, 0.08)])
    return s * np.minimum(1, t / 0.002)


def riser(d=1.0):
    t = tt(d)
    n = norm(sweep_bp(noise(d), 300, 7000, 1.2))
    tone = sine(220 * 2 ** (t * 1.2), d) * 0.3
    return (n + tone) * (t / d) ** 2.4


def buzz():
    d = 0.32
    t = tt(d)
    sq = np.sign(np.sin(2 * np.pi * 118 * t)) * 0.6 + np.sign(np.sin(2 * np.pi * 123 * t)) * 0.4
    gate = ((t < 0.13) | (t > 0.17)).astype(float)
    return bandpass(sq, 80, 2500) * gate * np.minimum(1, (d - t) / 0.02) * np.minimum(1, t / 0.003)


def glitch():
    d = 0.24
    out = np.zeros(int(d * SR))
    pos = 0
    while pos < len(out):
        ln = int(rng.uniform(0.012, 0.035) * SR)
        x = np.arange(ln) / SR
        seg = np.sign(np.sin(2 * np.pi * rng.uniform(200, 2400) * x)) * 0.5 + rng.standard_normal(ln) * 0.3
        seg = np.round(seg * 4) / 4
        seg = seg[: len(out) - pos]
        out[pos:pos + len(seg)] = seg * rng.uniform(0.4, 1.0)
        pos += ln
    return out * 0.7


def ding():
    return norm(bell(1318.5, 1.6, .5) + 0.8 * bell(1975.5, 1.6, .45) + 0.4 * bell(2637.0, 1.6, .3))


cues = json.load(open(sys.argv[1]))
for t, kind in cues:
    j = rng.uniform(-0.15, 0.15)
    if kind == "key":
        add(key(1 + j), t, 0.30, rng.uniform(-.25, .25))
    elif kind == "space":
        add(key(0.7), t, 0.34, rng.uniform(-.2, .2))
    elif kind == "pop":
        add(pop(), t, 0.42, 0.15)
    elif kind == "qpop":
        add(pop(700, 1700), t, 0.38, rng.uniform(-.5, .5))
    elif kind == "whoosh":
        add(swoosh(0.45, 3400, 350), t - 0.1, 0.34, 0.3)
    elif kind == "swish":
        add(swoosh(0.35, 500, 3000), t - 0.05, 0.26, -0.2)
    elif kind == "fly":
        add(swoosh(0.38, 900, 4200, 2.0), t, 0.22, 0.1)
    elif kind == "send":
        add(swoosh(0.26, 900, 5200, 2.2), t, 0.3, -0.3)
    elif kind == "tick":
        add(sine(2400, .03) * env(.03, .0005, .008), t, 0.34)
        add(sine(1200, .04) * env(.04, .0005, .012), t, 0.14)
    elif kind == "tickL":
        add(sine(2400, .04) * env(.04, .0005, .012), t, 0.55)
        add(sine(1200, .05) * env(.05, .0005, .018), t, 0.3)
    elif kind == "boom":
        add(boom(), t, 0.95)
    elif kind == "hit":
        add(hit(), t, 0.7)
    elif kind == "strike":
        add(swoosh(0.22, 1500, 4200, 3), t, 0.3, 0.2)
        add(pop(420, 240), t + 0.18, 0.3)
    elif kind == "buzz":
        add(buzz(), t, 0.32)
    elif kind == "click":
        add(key(0.6), t, 0.42)
    elif kind == "clack":
        add(key(0.45), t, 0.7)
        add(sine(glide(170, 70, .25, 25), .25) * env(.25, .002, .07), t, 0.6)
    elif kind == "clack2":
        add(key(0.55), t, 0.45)
    elif kind == "scrub":
        k, x = 0, 0.0
        while x < 0.95:
            add(sine(1500 + 1800 * x, .02) * env(.02, .0005, .005), t + x, 0.22, rng.uniform(-.4, .4))
            x += 0.07 * (1 - x * 0.75)
            k += 1
    elif kind == "riser":
        add(riser(1.0), t, 0.32)
    elif kind == "glitch":
        add(glitch(), t, 0.4)
    elif kind == "shimmer":
        for k, f in enumerate([1318.5, 1568.0, 1760.0, 2093.0, 2637.0]):
            add(bell(f, 1.4, 0.4), t + k * 0.05, 0.08, (k - 2) * 0.25)
    elif kind == "ping":
        add(bell(1568.0, .8, .22), t, 0.13, 0.1)
        add(bell(2349.3, .6, .16), t + 0.03, 0.07, -0.1)
    elif kind == "chime":
        for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
            add(bell(f, 1.2, .35), t + k * 0.07, 0.11, (k - 1.5) * 0.2)
    elif kind == "scramble":
        for k in range(10):
            add(sine(rng.uniform(1200, 3200), .025) * env(.025, .0005, .006), t + k * 0.03, 0.2, rng.uniform(-.5, .5))
    elif kind == "burst":
        for k in range(5):
            add(key(1 + rng.uniform(-.2, .2)), t + k * 0.03, 0.18, rng.uniform(-.3, .3))
    elif kind == "ding":
        add(ding(), t, 0.42)

# ---------------- music ----------------
BPM = 120
B = 60 / BPM
S16 = B / 4
T0 = 6.3
HZ = {"A1": 55.0, "C2": 65.41, "E2": 82.41, "F1": 43.65, "F2": 87.31, "G1": 49.0, "G2": 98.0, "A2": 110.0, "C3": 130.81,
      "E4": 329.63, "G4": 392.0, "A4": 440.0, "B4": 493.88, "C5": 523.25, "D5": 587.33, "E5": 659.25, "F4": 349.23}
PROG = [("A1", ["A4", "C5", "E5"]), ("F1", ["F4", "A4", "C5"]), ("C2", ["E4", "G4", "C5"]), ("G1", ["G4", "B4", "D5"])]


def kick():
    d = 0.35
    s = sine(glide(150, 46, d, 28), d) * env(d, 0.001, 0.13)
    s += bandpass(noise(d), 1500, 6000) * env(d, 0.0003, 0.004) * 0.5
    return norm(s)


def clap():
    d = 0.3
    n = bandpass(noise(d), 900, 4000)
    t = tt(d)
    e = sum(np.where(t >= o, np.exp(-(t - o) / 0.008), 0) for o in (0, 0.011, 0.022)) * 0.6 + np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.08), 0)
    return norm(n * e)


def hat(open_=False):
    d = 0.18 if open_ else 0.05
    return norm(bandpass(noise(d), 7000, 15000)) * env(d, 0.0005, 0.06 if open_ else 0.012)


def saw(freq, d, h=12, bright=1.0):
    t = tt(d)
    return sum(np.sin(2 * np.pi * freq * m * t) / m * np.exp(-t * (m * 6 / bright)) for m in range(1, h))


def bassnote(freq, d):
    t = tt(d)
    s = saw(freq * 2, d, 8, 1.6) * 0.8 + np.sin(2 * np.pi * freq * t) * 0.9
    return s * np.minimum(1, t / 0.003) * np.minimum(1, (d - t) / 0.02)


def stab(freqs, d=0.2):
    t = tt(d)
    s = sum(saw(f * (1 + det), d, 10, 0.9) for f in freqs for det in (-0.004, 0.004))
    return s * np.minimum(1, t / 0.002) * np.exp(-t / 0.09) / len(freqs)


def pad(freqs, d):
    t = tt(d)
    s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.15, 0.15):
            s += sum(np.sin(2 * np.pi * (f + det * f / 100) * m * t + m) / (m * m) for m in range(1, 5))
    return s * np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.4) / len(freqs)


K, CL, HC, HO = kick(), clap(), hat(), hat(True)
duck = np.ones(N)


def beat_bar(t0, n, hats16=False, open_hats=False, stabs=True, until=None):
    root, chord = PROG[n % 4]
    for b in range(4):
        tb = t0 + b * B
        if until is not None and tb >= until - 1e-6:
            break
        add(K, tb, 0.85, 0, MU)
        i = int(tb * SR)
        ln = int(0.22 * SR)
        if i < N:
            seg = 1 - 0.55 * np.exp(-np.arange(min(ln, N - i)) / SR / 0.07)
            duck[i:i + len(seg)] = np.minimum(duck[i:i + len(seg)], seg)
        if b in (1, 3):
            add(CL, tb, 0.42, 0.05, MU)
        for s in range(4):
            if hats16 or s % 2 == 0:
                if s != 0 or hats16:
                    add(HC, tb + s * S16, 0.14 if s % 2 else 0.2, 0.3, MU)
        if open_hats:
            add(HO, tb + 2 * S16, 0.12, -0.3, MU)
        # offbeat bass: the classic pumping house pattern
        for s in (2, 3):
            add(bassnote(HZ[root] * 2, S16 * 0.95), tb + s * S16, 0.34, 0, MU)
        if stabs and b in (0, 2):
            add(stab([HZ[x] for x in chord]), tb + 2 * S16, 0.16, -0.15, MU)
            add(stab([HZ[x] for x in chord]), tb + 3 * S16, 0.1, 0.15, MU)


# intro: a low pad under the hook and the pain, then the riser (an SFX cue) into the drop
add(pad([HZ["A2"], HZ["E2"] * 2, HZ["C3"]], 6.3), 0.0, 0.05, 0, MU)

# section 1: from the ⌥ Space press to the timer's last second
t0, n = T0, 0
while t0 < 19.8 - 1e-6:
    montage = t0 >= 14.3 - 1e-6
    beat_bar(t0, n, hats16=montage, open_hats=montage, until=19.8)
    t0 += 4 * B
    n += 1
# section 2: the call to action
t0, n = 20.3, 0
while t0 < 24.3 - 1e-6:
    beat_bar(t0, n, hats16=n >= 1, open_hats=n >= 1, until=24.3)
    t0 += 4 * B
    n += 1
add(pad([HZ["A4"], HZ["C5"], HZ["E5"]], 2.4), 22.3, 0.05, 0, MU)
add(stab([HZ["A4"], HZ["C5"], HZ["E5"]], 0.9), 24.3, 0.25, 0, MU)
add(K, 24.3, 0.8, 0, MU)

# ---------------- mix ----------------
MU *= duck[:, None] * 0.62
mix = FX + MU
fade = np.ones(N)
fo = int(0.35 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
mix *= fade[:, None]
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix = mix / np.max(np.abs(mix)) * 0.89
pcm = (mix * 32767).astype("<i2")
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[2], len(cues), "cues")
