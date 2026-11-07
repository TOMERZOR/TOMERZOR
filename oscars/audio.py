"""Soundtrack for the Oscars video: music synthesized from scratch, plus the sound effects and the
announcer, each placed on the frame where it happens.

The music is a 120 BPM electro-pop groove in A minor (Am F C G). The page writes the music sections
(marks.json): the energy follows them, so the opening builds, every countdown tightens with a snare
roll, the drum roll before a winner drops to near silence, and each winner lands on a full drop.
Every scene starts on a beat, so hits and section changes stay on the grid. The music ducks under the
announcer. Sound files come from private/audio/wav (ElevenLabs: effects and announcer); short UI
sounds (ticks, pops, swishes, the cymbal crash) are synthesized here.

usage: python3 audio.py private/out/sfx.json private/out/marks.json private/out/audio.wav
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
BPM = 120
BEAT = 60 / BPM
WAV = Path(__file__).parent / "private" / "audio" / "wav"
rng = np.random.default_rng(7)

cues = json.load(open(sys.argv[1]))
mk = json.load(open(sys.argv[2]))
OUT = sys.argv[3]
DUR = mk["dur"] + 1.5
N = int(DUR * SR)


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.003, decay=0.2):
    t = tt(d)
    return np.minimum(1, t / a) * np.exp(-t / decay)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def noise(d):
    return rng.standard_normal(int(d * SR))


def hz(note):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    n = names[note[0]]
    rest = note[1:]
    if rest.startswith("#"):
        n, rest = n + 1, rest[1:]
    elif rest.startswith("b"):
        n, rest = n - 1, rest[1:]
    return 440 * 2 ** ((n + (int(rest) - 4) * 12) / 12)


def saw(f, d, phase=0.0):
    t = tt(d)
    return 2 * ((f * t + phase) % 1) - 1


def add(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    if i >= len(buf):
        return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain


# ---------------------------------------------------------------- sections -> automation
LEVELS = {  # kick clap hat bass chords pad arp lead roll drone
    "intro": (0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0.7),
    "drop": (1, 1, 1, 1, 0.9, 0.25, 0.7, 0.75, 0, 0),
    "groove": (1, 0.9, 0.9, 1, 0.7, 0.3, 0.55, 0, 0, 0),
    "groove2": (1, 0.9, 1, 1, 0.55, 0.3, 0.8, 0, 0, 0),
    "tension": (1, 0, 0.5, 0.55, 0, 0.45, 0, 0, 1, 0.5),
    "level": (0.85, 0.6, 0.8, 0.85, 0.35, 0.5, 0.45, 0, 0, 0),
    "stop": (0, 0, 0, 0, 0, 0.12, 0, 0, 0, 0.45),
    "win": (1, 1, 1, 1, 1, 0.35, 0.75, 1, 0, 0),
    "chart": (0.85, 0.7, 0.9, 0.9, 0.45, 0.4, 0.7, 0, 0, 0),
    "light": (0.55, 0, 0.6, 0.7, 0, 0.6, 0.7, 0, 0, 0),
    "break": (0, 0, 0.35, 0.35, 0, 0.9, 0.85, 0, 0, 0),
    "special": (0.6, 0, 0.4, 0.5, 0, 0.7, 0.3, 0, 0.6, 0.4),
    "outro": (1, 1, 1, 1, 0.9, 0.35, 0.7, 0.8, 0, 0),
    "end": (0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
}
STEMS = ["kick", "clap", "hat", "bass", "chords", "pad", "arp", "lead", "roll", "drone"]
marks = sorted(mk["marks"], key=lambda m: m[1])


def section_at(t):
    cur, start = "intro", 0.0
    for typ, mt in marks:
        if mt <= t + 1e-6:
            cur, start = typ, mt
        else:
            break
    nxt = next((mt for typ, mt in marks if mt > t + 1e-6), DUR)
    return cur, start, nxt


def automation():
    """Per-stem gain curves, set per 16th note and smoothed (no clicks at section changes)."""
    step = BEAT / 4
    n = int(DUR / step) + 1
    g = np.zeros((len(STEMS), n))
    for k in range(n):
        t = k * step
        sec, a, b = section_at(t)
        lv = list(LEVELS[sec])
        if sec in ("tension", "special"):  # the snare roll builds through the section
            lv[8] *= ((t - a) / max(b - a, 0.1)) ** 1.6
        if sec == "intro" and t < 4:  # the very start: only the drone, swelling
            lv[5] *= t / 4
        g[:, k] = lv
    x = np.arange(N) / SR
    # linear ramps between 16th-note steps are smooth enough to avoid clicks
    return {s: np.interp(x, np.arange(n) * step, g[i]).astype(np.float32) for i, s in enumerate(STEMS)}


# ---------------------------------------------------------------- instruments
PROG = [("Am", "A1", ["A3", "C4", "E4", "A4"]), ("F", "F1", ["F3", "A3", "C4", "F4"]),
        ("C", "C2", ["G3", "C4", "E4", "G4"]), ("G", "G1", ["G3", "B3", "D4", "G4"])]
HOOK = {"Am": ["E5", "E5", "C5", "E5", "A5", "G5", "E5", "C5"], "F": ["F5", "F5", "C5", "F5", "A5", "G5", "F5", "C5"],
        "C": ["G5", "G5", "E5", "G5", "C6", "B5", "G5", "E5"], "G": ["D5", "D5", "B4", "D5", "G5", "A5", "G5", "D5"]}


def kick():
    d = 0.42
    t = tt(d)
    f = 46 + 110 * np.exp(-t / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    click = hp(noise(0.01), 3000) * 0.3
    s[: len(click)] += click
    return np.tanh(s * 1.6)


def clap():
    s = np.zeros(int(0.3 * SR))
    for k, o in enumerate([0, 0.011, 0.022]):
        add(s, bp(noise(0.25), 900, 3200) * env(0.25, 0.001, 0.05 if k < 2 else 0.12), o, 0.8)
    return s


def hat(open_=False):
    d = 0.3 if open_ else 0.06
    return hp(noise(d), 7000) * env(d, 0.001, 0.12 if open_ else 0.018)


def snare():
    d = 0.18
    return (bp(noise(d), 1200, 7000) * env(d, 0.001, 0.06) + np.sin(2 * np.pi * 190 * tt(d)) * env(d, 0.001, 0.04) * 0.5)


def bass_note(f, d):
    t = tt(d)
    s = 0.6 * saw(f, d) + 0.4 * np.sign(np.sin(2 * np.pi * f * t))
    s = lp(s, 520 + 900 * np.exp(-t[-1] * 0) * 0.3)
    return s * np.minimum(1, t / 0.004) * np.clip((d - t) / 0.03, 0, 1) * np.exp(-t / 0.5)


def supersaw(notes, d, cutoff, att=0.01, rel=0.2, voices=5, det=0.012):
    L = np.zeros(int(d * SR))
    R = np.zeros(int(d * SR))
    for nt in notes:
        f = hz(nt)
        for v in range(voices):
            dv = (v - (voices - 1) / 2) / ((voices - 1) / 2)
            s = saw(f * (1 + det * dv * 0.5), d, rng.random())
            pan = 0.5 + 0.45 * dv
            L += s * (1 - pan)
            R += s * pan
    t = tt(d)
    e = np.minimum(1, t / att) * np.clip((d - t) / rel, 0, 1)
    return lp(L, cutoff) * e / len(notes), lp(R, cutoff) * e / len(notes)


def pluck(f, d=0.3, bright=4000):
    t = tt(d)
    s = saw(f, d) * 0.6 + np.sign(np.sin(2 * np.pi * f * t)) * 0.4
    return lp(s, bright) * np.minimum(1, t / 0.002) * np.exp(-t / 0.09)


def lead_note(f, d):
    t = tt(d)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.15)
    ph = np.cumsum(f * vib) / SR
    s = 2 * (ph % 1) - 1 + 0.5 * np.sign(np.sin(2 * np.pi * ph * 1.002))
    return lp(s, 3200) * np.minimum(1, t / 0.006) * np.clip((d - t) / 0.04, 0, 1) * 0.6


def music():
    curves = automation()
    beats = int(DUR / BEAT)
    mono = {s: np.zeros(N, dtype=np.float32) for s in ["kick", "clap", "hat", "bass", "roll", "drone"]}
    st = {s: [np.zeros(N, dtype=np.float32), np.zeros(N, dtype=np.float32)] for s in ["chords", "pad", "arp", "lead"]}
    K, C, H, HO, SN = kick(), clap(), hat(), hat(True), snare()
    for b in range(beats):
        t = b * BEAT
        add(mono["kick"], K, t)
        if b % 2 == 1:
            add(mono["clap"], C, t)
        for s16 in range(4):
            add(mono["hat"], H, t + s16 * BEAT / 4, 0.55 if s16 % 2 else 0.35)
        add(mono["hat"], HO, t + BEAT / 2, 0.45)
        for s16 in range(4):
            add(mono["roll"], SN, t + s16 * BEAT / 4, 0.5 + 0.2 * (s16 % 2))
    bars = int(DUR / (4 * BEAT)) + 1
    for bar in range(bars):
        t = bar * 4 * BEAT
        name, root, chord = PROG[bar % 4]
        for e8 in range(8):  # offbeat-pumping bass: 8ths, accent on the "and"
            add(mono["bass"], bass_note(hz(root) * (2 if e8 % 2 else 1), BEAT / 2 * 0.9), t + e8 * BEAT / 2, 0.9 if e8 % 2 else 0.55)
        l, r = supersaw(chord, 4 * BEAT + 0.05, 3800, att=0.005, rel=0.05)
        add(st["chords"][0], l, t); add(st["chords"][1], r, t)
        l, r = supersaw([n.replace("3", "2").replace("4", "3") for n in chord[:3]], 4 * BEAT + 0.6, 1400, att=0.4, rel=0.6, det=0.02)
        add(st["pad"][0], l, t); add(st["pad"][1], r, t)
        tones = [hz(n) * 2 for n in chord]
        order = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2]
        for s16 in range(16):
            p = pluck(tones[order[s16]], 0.28)
            pan = 0.5 + (0.3 if s16 % 2 else -0.3)
            add(st["arp"][0], p * (1 - pan), t + s16 * BEAT / 4, 0.5)
            add(st["arp"][1], p * pan, t + s16 * BEAT / 4, 0.5)
            add(st["arp"][0], p * pan * 0.35, t + s16 * BEAT / 4 + 0.375)  # dotted-8th echo, opposite side
            add(st["arp"][1], p * (1 - pan) * 0.35, t + s16 * BEAT / 4 + 0.375)
        for e8, nt in enumerate(HOOK[name]):
            ln = lead_note(hz(nt), BEAT / 2 * 0.92)
            add(st["lead"][0], ln, t + e8 * BEAT / 2, 0.5); add(st["lead"][1], ln, t + e8 * BEAT / 2, 0.5)
            add(st["lead"][0], ln * 0.25, t + e8 * BEAT / 2 + 0.25); add(st["lead"][1], ln * 0.3, t + e8 * BEAT / 2 + 0.375)
    drone = np.zeros(N, dtype=np.float32)
    x = np.arange(N) / SR
    drone[:] = (np.sin(2 * np.pi * 55 * x) * 0.6 + np.sin(2 * np.pi * 82.4 * x) * 0.25 + lp(rng.standard_normal(N), 200) * 0.6)
    mono["drone"] = drone
    # sidechain pump from the kick (only felt when the kick plays)
    pump = np.ones(N, dtype=np.float32)
    shape = 1 - 0.55 * np.exp(-tt(BEAT) / 0.11)
    for b in range(beats):
        i = int(b * BEAT * SR)
        n = min(len(shape), N - i)
        pump[i:i + n] = shape[:n]
    kk = curves["kick"]
    pump = 1 - (1 - pump) * kk
    L = np.zeros(N, dtype=np.float32)
    R = np.zeros(N, dtype=np.float32)
    mixg = {"kick": 0.55, "clap": 0.35, "hat": 0.18, "bass": 0.34, "roll": 0.26, "drone": 0.22}
    for s, sig in mono.items():
        g = curves[s] * mixg[s] * (pump if s == "bass" else 1)
        L += sig * g
        R += sig * g
    stg = {"chords": 0.24, "pad": 0.3, "arp": 0.2, "lead": 0.22}
    for s, (l, r) in st.items():
        g = curves[s] * stg[s] * (pump if s in ("chords", "pad") else 1)
        L += l * g
        R += r * g
    # final chord rings out after the last section
    end_t = next((mt for typ, mt in marks if typ == "end"), mk["dur"] - 2)
    l, r = supersaw(["A2", "E3", "A3", "C4", "E4"], 4.5, 2400, att=0.01, rel=3.5)
    add(L, l, end_t, 0.5); add(R, r, end_t, 0.5)
    add(L, kick(), end_t, 0.9); add(R, kick(), end_t, 0.9)
    return L, R


# ---------------------------------------------------------------- effects
def load(name):
    w = wave.open(str(WAV / f"{name}.wav"))
    a = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32) / 32768
    return a


def synth(name, i):
    if name == "tick":
        return hp(noise(0.03), 2500) * env(0.03, 0.0005, 0.006) * 0.6 + np.sin(2 * np.pi * 3100 * tt(0.03)) * env(0.03, 0.0005, 0.005) * 0.4
    if name == "tock":  # countdown beat: woodblock + sub thump
        d = 0.5
        t = tt(d)
        f = 60 + 90 * np.exp(-t / 0.04)
        sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
        wood = np.sin(2 * np.pi * 880 * t) * np.exp(-t / 0.03) + np.sin(2 * np.pi * 1320 * t) * np.exp(-t / 0.02) * 0.5
        return np.tanh((sub * 1.2 + wood * 0.5) * 1.3)
    if name == "pop":
        d = 0.14
        t = tt(d)
        f = 1000 * (430 / 1000) ** (t / d)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.002, 0.045)
    if name == "swish":
        d = 0.45
        e = np.sin(np.pi * tt(d) / d) ** 2
        return bp(noise(d), 500, 5000) * e * 0.5
    if name == "blip":
        f = hz(["E5", "G5", "A5", "C6", "D6", "E6", "G6", "A6"][i % 8])
        return pluck(f, 0.4, 6000) * 0.8
    if name == "ding":
        t = tt(1.4)
        return sum(np.sin(2 * np.pi * f * m * t) * np.exp(-t / (0.8 / m)) / m for f in (hz("C6"), hz("E6")) for m in (1, 2.76)) * 0.4
    if name == "shutter":
        s = np.zeros(int(0.12 * SR))
        add(s, hp(noise(0.02), 2000) * env(0.02, 0.0005, 0.004), 0, 1)
        add(s, hp(noise(0.03), 1500) * env(0.03, 0.0005, 0.008), 0.055, 0.8)
        return s
    if name == "crash":
        d = 2.6
        return (hp(noise(d), 4500) * env(d, 0.002, 0.7) + bp(noise(d), 2500, 6000) * env(d, 0.002, 0.25) * 0.5) * 0.6
    if name == "hit":  # short orchestral-ish stab: sub + chord + noise
        d = 0.9
        t = tt(d)
        s = np.sin(2 * np.pi * 55 * t) * np.exp(-t / 0.3)
        for n in ("A3", "C4", "E4", "A4"):
            s += saw(hz(n), d) * np.exp(-t / 0.18) * 0.18
        s += bp(noise(d), 200, 3000) * np.exp(-t / 0.05) * 0.4
        return lp(s, 5000) * 0.8
    if name == "shimmer":
        s = np.zeros(int(1.8 * SR))
        for j, n in enumerate(["A5", "C6", "E6", "A6", "C7"]):
            t = tt(1.4)
            add(s, sum(np.sin(2 * np.pi * hz(n) * m * t) * np.exp(-t / (0.7 / m)) / m for m in (1, 2.4)), j * 0.05, 0.12)
        return s
    if name == "rise15":  # 1.5 s riser for the quick countdown
        d = 1.5
        t = tt(d)
        f = 180 * (1400 / 180) ** (t / d)
        s = saw(1, d) * 0  # placeholder for shape
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + bp(noise(d), 1500, 9000) * 0.5
        return s * (t / d) ** 2.2 * np.clip((d - t) / 0.02, 0, 1)
    if name == "roll1":  # one-second snare roll, 16ths speeding up to 32nds, crescendo
        s = np.zeros(int(1.1 * SR))
        x, k = 0.0, 0
        while x < 1.0:
            add(s, snare(), x, 0.35 + 0.65 * x)
            x += 0.125 - 0.0625 * min(1, x / 0.6)
            k += 1
        return s
    if name == "glitchblip":
        s = np.zeros(int(0.35 * SR))
        for j in range(6):
            f = rng.uniform(300, 2400)
            d = rng.uniform(0.02, 0.05)
            add(s, np.sign(np.sin(2 * np.pi * f * tt(d))) * 0.4, j * 0.05, 1)
        return s
    raise KeyError(name)


def main():
    print("music…")
    mL, mR = music()
    sL = np.zeros(N, dtype=np.float32)
    sR = np.zeros(N, dtype=np.float32)
    vL = np.zeros(N, dtype=np.float32)
    vR = np.zeros(N, dtype=np.float32)
    cache = {}
    counts = {}
    voice_spans = []
    for name, t, gain in cues:
        i = counts.get(name, 0)
        counts[name] = i + 1
        if (WAV / f"{name}.wav").exists():
            if name not in cache:
                a = load(name)
                if name.startswith("v_"):  # announcer: even loudness across lines
                    a = a * (0.17 / max(1e-4, np.sqrt((a ** 2).mean())))
                else:
                    a = a * (0.85 / max(1e-4, np.abs(a).max()))
                cache[name] = a
            a = cache[name]
            if name.startswith("v_"):
                add(vL, a[:, 0], t, gain); add(vR, a[:, 1], t, gain)
                voice_spans.append((t, t + len(a) / SR))
            else:
                add(sL, a[:, 0], t, gain * 0.8); add(sR, a[:, 1], t, gain * 0.8)
        else:
            s = synth(name, i).astype(np.float32)
            pan = {"blip": (i % 2) * 0.3 - 0.15, "pop": ((i % 3) - 1) * 0.25}.get(name, 0)
            add(sL, s * (1 - pan), t, gain * 0.8); add(sR, s * (1 + pan), t, gain * 0.8)
    # duck the music under the announcer
    fr = 100  # duck envelope at 100 Hz, smoothed, then stretched to the sample rate
    d = np.zeros(int(DUR * fr) + 1)
    for a, b in voice_spans:
        d[max(0, int((a - 0.08) * fr)):int((b + 0.25) * fr)] = 1
    ker = np.hanning(25)
    d = np.convolve(d, ker / ker.sum(), mode="same")
    duck = np.interp(np.arange(N) / SR, np.arange(len(d)) / fr, d).astype(np.float32)
    mg = (1 - 0.7 * duck) * 0.5
    sg = 1 - 0.35 * duck
    L = mL * mg + sL * sg + vL
    R = mR * mg + sR * sg + vR
    snr = []  # announcer vs everything else, per line (dB)
    for a, b in voice_spans:
        i0, i1 = int(a * SR), int(b * SR)
        v = np.sqrt((vL[i0:i1] ** 2).mean()) + 1e-9
        o = np.sqrt(((mL[i0:i1] * mg[i0:i1] + sL[i0:i1] * (1 - 0.35 * duck[i0:i1])) ** 2).mean()) + 1e-9
        snr.append((20 * np.log10(v / o), a))
    vals = [x for x, _ in snr]
    print(f"announcer over the rest: min {min(vals):.1f} dB, median {np.median(vals):.1f} dB")
    print("weakest lines:", [(round(t, 1), round(x, 1)) for x, t in sorted(snr)[:8]])
    mix = np.stack([L, R], axis=1)
    fade = int(1.2 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    peak = np.percentile(np.abs(mix), 99.95)
    mix = np.tanh(mix / peak * 0.95) * 0.93
    data = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(OUT, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"wrote {OUT}: {DUR:.1f}s, {len(cues)} cues")


if __name__ == "__main__":
    main()
