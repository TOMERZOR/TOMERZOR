"""Soundtrack for the Easy2Study ad, synthesized from scratch (numpy only).

Sound effects come from the page's own cue list (sfx.json, written by render.mjs), so every tap,
step and chime lands on the frame where it happens. The music starts as a low A-minor drone with a
clock (the hours that don't help), and on the logo reveal turns into a soft major groove at 96 BPM:
plucked arpeggios over C, G, Am, F, with bass, pad and a light beat. It stops on the last logo hit
and rings out on a C chord.

usage: python3 audio.py sfx.json out.wav
"""
import json
import sys
import wave

import numpy as np

SR = 48000
DUR = 31.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N)
R = np.zeros(N)


def tt(d):
    return np.arange(int(d * SR)) / SR


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2) * 1.414


def mix(*sigs):
    """Sum sounds of different lengths (shorter ones are padded with silence)."""
    n = max(len(x) for x in sigs)
    out = np.zeros(n)
    for x in sigs:
        out[: len(x)] += x
    return out


def env(d, a=0.004, decay=0.15, release=None):
    t = tt(d)
    e = np.minimum(1, t / a) * np.exp(-t / decay)
    if release:
        e *= np.clip((d - t) / release, 0, 1)
    return e


def band(sig, lo, hi):
    """Band-pass by masking the spectrum (fine for short sounds and pads)."""
    f = np.fft.rfft(sig)
    fr = np.fft.rfftfreq(len(sig), 1 / SR)
    m = ((fr >= lo) & (fr <= hi)).astype(float)
    # soft edges
    m = np.convolve(m, np.hanning(41) / np.hanning(41).sum(), mode="same")
    return np.fft.irfft(f * m, len(sig))


def noise(d):
    return rng.standard_normal(int(d * SR))


def hz(note):
    """'A3' -> Hz."""
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    n = names[note[0]]
    rest = note[1:]
    if rest.startswith("#"):
        n += 1
        rest = rest[1:]
    elif rest.startswith("b"):
        n -= 1
        rest = rest[1:]
    return 440 * 2 ** ((n + (int(rest) - 4) * 12) / 12)


def tone(f, d, kind="sine", a=0.004, decay=0.3, release=0.05, vib=0.0):
    t = tt(d)
    ph = 2 * np.pi * f * t + (vib * np.sin(2 * np.pi * 5 * t) if vib else 0)
    if kind == "sine":
        w = np.sin(ph)
    elif kind == "tri":
        w = 2 / np.pi * np.arcsin(np.sin(ph))
    else:  # soft saw: a few harmonics
        w = sum(np.sin(ph * h) / h for h in range(1, 7))
    return w * env(d, a, decay, release)


def pluck(f, d=0.9):
    t = tt(d)
    w = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.12) + 0.15 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.06)
    return w * env(d, 0.003, 0.32, 0.08)


def bell(f, d=1.6):
    t = tt(d)
    w = sum(np.sin(2 * np.pi * f * m * t) * np.exp(-t / (0.9 / m)) / m for m in (1, 2.76, 5.4))
    return w * np.minimum(1, t / 0.002)


# ---------------------------------------------------------------- sound effects
def sfx(kind, t, i=0):
    if kind == "tick":
        if t < 3:  # a clock
            s = mix(band(noise(0.03), 2500, 7000) * env(0.03, 0.0005, 0.006), tone(3200, 0.02, decay=0.004) * 0.4)
            add(s, t, 0.35, 0.25)
        else:  # the app's "got it" tick: 620 -> 930 Hz
            d = 0.12
            tt_ = tt(d)
            f = 620 * (930 / 620) ** (tt_ / d)
            add(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.004, 0.05), t, 0.55)
    elif kind == "scatter":
        d = 1.2
        s = band(noise(d), 600, 6000) * env(d, 0.02, 0.35)
        sweep = np.sin(2 * np.pi * np.cumsum(np.linspace(1400, 180, int(d * SR))) / SR) * env(d, 0.01, 0.3)
        add(s * 0.35 + sweep * 0.12, t, 0.7)
    elif kind == "pop":
        d = 0.12
        tt_ = tt(d)
        f = 900 * (480 / 900) ** (tt_ / d)
        add(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.002, 0.04), t, 0.5)
    elif kind == "scratch":
        d = 0.32
        s = band(noise(d), 1800, 5200) * np.sin(np.pi * tt(d) / d) ** 0.6
        add(s, t, 0.22, -0.3)
    elif kind == "swoosh":
        d = 0.5
        e = np.sin(np.pi * np.clip(tt(d) / d, 0, 1)) ** 2
        add(band(noise(d), 400, 3500) * e, t - 0.15, 0.22)
    elif kind == "word":
        add(mix(tone(hz("A2"), 0.4, decay=0.12), band(noise(0.05), 100, 900) * env(0.05, 0.001, 0.02) * 0.6), t, 0.6)
    elif kind == "riser":
        d = 1.05
        e = (tt(d) / d) ** 2
        f = np.linspace(200, 1800, int(d * SR))
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + band(noise(d), 2000, 9000) * 0.6
        add(s * e, t, 0.35)
    elif kind == "boom":
        d = 2.2
        tt_ = tt(d)
        f = 55 + 70 * np.exp(-tt_ / 0.05)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.002, 0.6)
        s = mix(s, band(noise(0.3), 60, 600) * env(0.3, 0.001, 0.06) * 0.7)
        add(s, t, 1.1)
    elif kind == "shimmer":
        for j, n in enumerate(["C6", "E6", "G6", "C7", "E7"]):
            add(bell(hz(n), 1.4), t + j * 0.05, 0.07, (j - 2) * 0.3)
    elif kind == "tap":
        add(mix(band(noise(0.04), 800, 4000) * env(0.04, 0.0005, 0.008), tone(1400, 0.03, decay=0.006) * 0.3), t, 0.3)
    elif kind == "step":
        add(tone(540, 0.14, "tri", decay=0.06), t, 0.45)
    elif kind == "blip":
        add(pluck(hz(["E5", "G5", "A5", "C6", "D6"][i % 5]), 0.5), t, 0.28)
    elif kind == "chime":
        add(tone(hz("G5"), 0.6, "tri", decay=0.2), t, 0.45)
        add(tone(hz("D6"), 0.9, "tri", decay=0.3), t + 0.1, 0.4)
    elif kind == "burst":
        for j in range(18):
            add(tone(rng.uniform(2500, 6000), 0.05, decay=0.01), t + rng.uniform(0, 0.5), 0.06, rng.uniform(-0.8, 0.8))
    elif kind == "rise":
        add(bell(hz(["C5", "E5", "G5", "C6"][i % 4]), 1.0), t, 0.2)
        add(tone(hz(["C5", "E5", "G5", "C6"][i % 4]) * 2, 0.15, "tri", decay=0.05), t, 0.12)


# ---------------------------------------------------------------- music
def pad(notes, t, d, gain):
    for j, n in enumerate(notes):
        s = tone(hz(n), d, "saw", a=0.8, decay=60, release=0.9, vib=0.003)
        add(band(s, 60, 1800), t, gain / len(notes), (j - 1) * 0.4)


def part_a():
    # 0 - 9.7: the hours that don't help. A low drone in A minor that thickens.
    d = 9.9
    drone = mix(tone(hz("A1"), d, "sine", a=1.5, decay=99, release=0.6) * 0.6, tone(hz("E2"), d, "sine", a=2.5, decay=99, release=0.6) * 0.3)
    add(drone, 0, 0.22)
    pad(["A2", "C3", "E3"], 0.0, 4.6, 0.10)
    pad(["F2", "A2", "C3"], 4.4, 2.6, 0.11)
    pad(["G2", "B2", "D3"], 7.0, 2.8, 0.12)
    for x, n in [(0.2, "E4"), (1.4, "C4"), (2.6, "A3"), (4.6, "F4"), (5.8, "E4"), (7.1, "D4"), (8.1, "B3")]:
        add(pluck(hz(n), 1.2), x, 0.12, -0.2)
    # a slow, heavy pulse while "you tried everything"
    for x in np.arange(4.4, 9.6, 1.0):
        add(mix(tone(55, 0.5, decay=0.12), tone(110, 0.2, decay=0.04) * 0.3), x, 0.18)


BPM = 96
BEAT = 60 / BPM
CHORDS = [("C", ["C3", "E3", "G3"], ["C4", "E4", "G4", "C5"]), ("G", ["B2", "D3", "G3"], ["B3", "D4", "G4", "D5"]),
          ("Am", ["A2", "C3", "E3"], ["A3", "C4", "E4", "A4"]), ("F", ["A2", "C3", "F3"], ["A3", "C4", "F4", "C5"])]
BASS = {"C": "C2", "G": "G1", "Am": "A1", "F": "F1"}


def part_b():
    # 9.75 - 28.45: things fall into place. Major groove; the beat comes in with the phone.
    start, end = 9.75, 28.45
    bar = 4 * BEAT
    t = start
    b = 0
    while t < end - 0.01:
        name, pad_notes, arp = CHORDS[b % 4]
        d = min(bar, end - t)
        pad(pad_notes, t, d + 0.6, 0.15)
        add(tone(hz(BASS[name]), d, "tri", a=0.01, decay=1.2, release=0.1) * 0.9, t, 0.36)
        for s in range(8):  # eighth-note arpeggio
            x = t + s * BEAT / 2
            if x >= end:
                break
            n = arp[[0, 1, 2, 3, 2, 1, 2, 3][s]]
            add(pluck(hz(n), 0.6), x, 0.15 if t < 12.4 else 0.21, 0.35 if s % 2 else -0.35)
        if t >= 12.4 - 0.01:
            for s in range(4):
                x = t + s * BEAT
                if x >= end:
                    break
                if s in (0, 2):  # soft kick
                    tt_ = tt(0.35)
                    f = 50 + 90 * np.exp(-tt_ / 0.03)
                    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.35, 0.002, 0.12), x, 0.55)
                if s in (1, 3):  # finger snap
                    add(band(noise(0.12), 1200, 5000) * env(0.12, 0.001, 0.03), x, 0.18, 0.15)
                for h in (0, 0.5):  # shaker
                    add(band(noise(0.06), 5000, 12000) * env(0.06, 0.004, 0.02), x + h * BEAT, 0.06 if h else 0.04, -0.4)
        t += bar
        b += 1


def part_c():
    # 28.45 - 31: the last hit rings out on C major.
    pad(["C3", "E3", "G3", "C4"], 28.45, 2.6, 0.16)
    add(tone(hz("C2"), 2.5, "tri", a=0.01, decay=1.4, release=0.4), 28.45, 0.35)
    for j, n in enumerate(["C5", "E5", "G5", "C6"]):
        add(bell(hz(n), 2.0), 28.5 + j * 0.09, 0.09, (j - 1.5) * 0.3)


def main():
    cues = json.load(open(sys.argv[1]))
    part_a()
    part_b()
    part_c()
    counts = {}
    for c in cues:
        kind, t = c[0], c[1]
        i = c[2] if len(c) > 2 else counts.get(kind, 0)
        counts[kind] = counts.get(kind, 0) + 1
        sfx(kind, t, i)
    mix = np.stack([L, R], axis=1)
    # gentle fade at the very end, then a soft limiter
    fade = int(0.4 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    peak = np.max(np.abs(mix))
    mix = np.tanh(mix / peak * 1.25) / np.tanh(1.25) * 0.89
    data = (mix * 32767).astype(np.int16)
    with wave.open(sys.argv[2], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"wrote {sys.argv[2]}: {DUR}s, {len(cues)} cues")


if __name__ == "__main__":
    main()
