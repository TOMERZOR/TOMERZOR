"""The soundtrack of "This is Max.", from work/timeline.json and work/cues.json (overlay timings).

Layers:
- the clips' own sound (room tone, paws, paper, the whip pans), cut with the picture and crossfaded
  over 30 ms at every cut so nothing starts or stops with a click;
- the narrator, line by line, where timeline.py puts each line;
- the music, from the hyperlapse to the end, ducked under the narrator in the outro and dipped
  (and darkened) under the "Two weeks later." card;
- sound effects, each placed so its attack lands on its frame (as in ../max/sting.py), with UI
  sounds for the screen inserts, one keystroke per typed letter, and the outro;
- a short room on the effects so they sit in the same space, then the whole mix to -14 LUFS with
  the true peak under -1 dBTP.

usage: python3 mix.py <out.wav> [--no-music]
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
out_path = sys.argv[1]
NO_MUSIC = "--no-music" in sys.argv
SR = 48000
TL = json.load(open(os.path.join(HERE, "work", "timeline.json")))
CUES = json.load(open(os.path.join(HERE, "work", "cues.json")))
END = TL["end"]
N = int(round(END * SR))
rng = np.random.default_rng(3)


def decode(path, start=None, dur=None):
    cmd = ["ffmpeg", "-loglevel", "error"]
    if start is not None:
        cmd += ["-ss", f"{start:.6f}"]
    cmd += ["-i", path]
    if dur is not None:
        cmd += ["-t", f"{dur:.6f}"]
    cmd += ["-vn", "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<f4").reshape(-1, 2).astype(np.float64)


def fade(x, a=.015, b=.015):
    x = x.copy()
    na, nb = min(len(x), int(a * SR)), min(len(x), int(b * SR))
    if na:
        x[:na] *= np.linspace(0, 1, na)[:, None]
    if nb:
        x[-nb:] *= np.linspace(1, 0, nb)[:, None]
    return x


def add(bus, x, t, gain=1.0):
    i = int(round(t * SR))
    if i < 0:
        x, i = x[-i:], 0
    x = x[: max(0, N - i)]
    bus[i:i + len(x)] += x * gain


def attack(x):
    e = np.sqrt(np.convolve((x ** 2).mean(1), np.ones(480) / 480, "same"))
    return int(np.argmax(e > e.max() * .3))


SFX_DIRS = [os.path.join(HERE, "sfx"), os.path.join(HERE, "..", "max", "sfx")]
_cache = {}


def sample(name):
    if name not in _cache:
        p = next(os.path.join(d, name + ".mp3") for d in SFX_DIRS if os.path.exists(os.path.join(d, name + ".mp3")))
        x = decode(p)
        _cache[name] = x / max(1e-9, np.abs(x).max())
    return _cache[name]


def place(bus, name, t, gain, first_hit=False, end_at=None, x=None):
    x = sample(name) if x is None else x
    if first_hit:                              # keep only the first keystroke of a take
        e = np.sqrt(np.convolve((x ** 2).mean(1), np.ones(240) / 240, "same"))
        a = attack(x)
        quiet = np.where(e[a + int(.05 * SR):] < e.max() * .08)[0]
        stop = a + int(.05 * SR) + (quiet[0] if len(quiet) else int(.12 * SR))
        x = fade(x[: stop + int(.03 * SR)], 0, .03)
    if end_at is not None:                     # a riser: its end (not its attack) lands on end_at
        add(bus, fade(x, .02, .01), end_at - len(x) / SR, gain)
        return
    add(bus, x, t - attack(x) / SR, gain)


# ---------- the clips' own sound ----------
amb = np.zeros((N, 2))
AMB_GAIN = {"s1": 1.3, "s2": .8, "s3": .55, "s4": 2.6, "s5": .7, "s6": .55, "h1": .32, "h2": .32, "h3": .32, "h4": .32,
            "s8": .5, "s9": .75, "s9a": .75, "s9b": .75, "s12": 1.4, "s14": 1.4}
# Seedance's own dog noises are muted where we put ours: its "sigh" in s2 came out as a voiced huff
MUTE = [(6.55, 7.95, .08)]                     # (from, to, gain), with 60 ms ramps
XF = .03
for s in TL["segs"]:
    if s["kind"] != "clip":
        continue
    src = "g2" if s["src"] == "g2eye" else s["src"]
    a = s["a"] / TL["src_fps"]
    d = s["t1"] - s["t0"]
    x = decode(os.path.join(HERE, "clips", src + ".mp4"), max(0, a - XF / 2), d + XF)
    add(amb, fade(x, XF, XF), s["t0"] - XF / 2, AMB_GAIN.get(s["id"], .8))
tt_ = np.arange(N) / SR
for a_, b_, g_ in MUTE:
    k_ = np.clip(np.minimum((tt_ - a_) / .06, (b_ - tt_) / .06), 0, 1)
    amb *= (1 - k_ * (1 - g_))[:, None]
# the wink shot's room runs on into the outro and fades under the wipe
o = TL["outro_at"]
x = decode(os.path.join(HERE, "clips", "g5.mp4"), 170 / 24, 1.2)
add(amb, fade(x, XF, .6), o, 1.4)

# ---------- narrator ----------
vo = np.zeros((N, 2))
take = decode(os.path.join(HERE, "vo", "vo_a.mp3"))
take /= np.abs(take).max()
for v in TL["vo"]:
    line = fade(take[int(v["a"] * SR):int(v["b"] * SR)], .012, .05)
    add(vo, line, v["at"], .75)

# ---------- music ----------
mus = np.zeros((N, 2))
if not NO_MUSIC:
    m = decode(os.path.join(HERE, "music", "m1.mp3"))
    m = fade(m, .004, .4)
    add(mus, m, TL["music_at"], .34)
    # dip and darken under the title card, ramps of 0.15 s
    card = next(s for s in TL["segs"] if s["id"] == "card")
    env = np.ones(N)
    t = np.arange(N) / SR
    k = np.clip(np.minimum((t - (card["t0"] - .15)) / .15, ((card["t1"] + .2) - t) / .2), 0, 1)
    env *= 1 - .6 * k
    # a one-pole low-pass whose cutoff falls under the card
    lp = mus.copy()
    alpha = 1 - np.exp(-2 * np.pi * 900 / SR)
    i0, i1 = int((card["t0"] - .2) * SR), int((card["t1"] + .3) * SR)
    y = np.zeros(2)
    for i in range(i0, i1):
        y += alpha * (mus[i] - y)
        lp[i] = y
    mus = (mus * (1 - k[:, None]) + lp * k[:, None]) * env[:, None]
    # duck under the narrator (outro lines), 80 ms attack, 250 ms release
    lvl = np.sqrt(np.convolve((vo ** 2).mean(1), np.ones(2400) / 2400, "same"))
    gate = (lvl > .02).astype(float)
    sm = np.zeros(N)
    g = 0.0
    up, down = 1 - np.exp(-1 / (.08 * SR)), 1 - np.exp(-1 / (.25 * SR))
    for i in range(N):
        g += (gate[i] - g) * (up if gate[i] > g else down)
        sm[i] = g
    mus *= (1 - sm * (1 - 10 ** (-8 / 20)))[:, None]

# ---------- effects ----------
fx = np.zeros((N, 2))
for e in TL["sfx"]:
    place(fx, e["name"], e["at"], e["gain"], e.get("first_hit", False), e.get("end_at"))
seg = {s["id"]: s for s in TL["segs"]}
# the screen inserts: Pointy's UI (times inside each insert, see screens/index.html)
i1, i2, i3 = seg["i1"]["t0"], seg["i2"]["t0"], seg["i3"]["t0"]
place(fx, "typing_b", i1 + .06, .22)
place(fx, "taps_b", i1 + 1.03, .3)          # the step card appears
place(fx, "click_b", i1 + 1.47, .4)         # the cursor presses on A1
place(fx, "click_b", i2 + .39, .3)          # Insert
place(fx, "click_b", i2 + .79, .3)          # Chart
place(fx, "logo_b", i2 + .86, .2)          # the chart pops in
place(fx, "chime_a", i3 + .49, .3)          # "All done"
place(fx, "taps_a", seg["i4"]["t0"] + .64, .25)   # the speech bubble
# one keystroke per typed letter of "Two weeks later."
keys = sample("keys_a")
env = np.sqrt(np.convolve((keys ** 2).mean(1), np.ones(240) / 240, "same"))
on = np.where((env[1:] > env.max() * .25) & (env[:-1] <= env.max() * .25))[0]
hits = []
for a in on:
    if hits and a - hits[-1] < int(.09 * SR):
        continue
    hits.append(a)
strokes = [fade(keys[max(0, a - 120): a + int(.1 * SR)], .002, .04) for a in hits]
strokes = [s for s in strokes if len(s) > 1000][:24] or [fade(sample("keys_b")[: int(.12 * SR)], .002, .04)]
for j, tt in enumerate(CUES["typing"]):
    s = strokes[j % len(strokes)]
    add(fx, s, tt - 120 / SR, .42 * (1 + .12 * rng.standard_normal()))
# the outro
c = CUES["outro"]
place(fx, "whoosh_b", c["cursor"] + .2, .2)
place(fx, "click_b", c["click"], .3)
place(fx, "wipe_b", c["wipe"] + .18, .18)
place(fx, "bass_b", c["logo"] + .04, .16)
place(fx, "taps_a", c["letters"] + .08, .12)
place(fx, "whoosh_a", c["glide"] + .25, .1)
place(fx, "click_a", c["dot"], .28)

# a short, dark room around the dry effects
ir_len = int(1.4 * SR)
tt = np.arange(ir_len) / SR
ir = rng.standard_normal((ir_len, 2)) * np.exp(-tt / .32)[:, None] * np.minimum(1, tt / .01)[:, None]
spec = np.fft.rfft(ir, axis=0)
f = np.fft.rfftfreq(ir_len, 1 / SR)
spec *= (1 / np.sqrt(1 + (f / 4500) ** 4))[:, None] * (f > 150)[:, None]
ir = np.fft.irfft(spec, ir_len, axis=0)
ir /= np.sqrt((ir ** 2).sum(0))
L = N + ir_len
wet = np.fft.irfft(np.fft.rfft(fx, L, axis=0) * np.fft.rfft(ir, L, axis=0), L, axis=0)[:N]
fx = fx + wet * .22

mix = amb * .5 + vo + mus + fx * .9
if os.environ.get("MIXDEBUG"):
    for nm, b in (("amb", amb * .5), ("vo", vo), ("mus", mus), ("fx", fx * .9)):
        print(nm, " ".join(f"{20 * np.log10(np.sqrt(np.mean(b[int(t * SR):int((t + .5) * SR)] ** 2)) + 1e-9):.0f}" for t in np.arange(51, 56, .5)))
fo = int(.35 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2

tmp = out_path + ".raw.wav"
with wave.open(tmp, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix / max(1.0, np.abs(mix).max()), -1, 1) * 32767).astype("<i2").tobytes())
# loudness: measure, then gain to -14 LUFS with a true-peak limiter at -1 dBTP
meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                      capture_output=True, text=True).stderr
js = json.loads(meas[meas.rindex("{"):meas.rindex("}") + 1])
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af",
                f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:"
                f"measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true,aresample=48000",
                "-c:a", "pcm_s16le", out_path], check=True)
os.remove(tmp)
print("wrote", out_path, "(input", js["input_i"], "LUFS)")
