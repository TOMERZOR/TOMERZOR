"""Sound for the Pointy outro of the Max short, built from recorded-style sound effects generated with
ElevenLabs Text to Sound v2 (sfx/*.mp3): the cursor whoosh and click, the orange wipe, the logo landing,
the letters, the ⌥ + Space press and the closing chime. Each effect is placed so that its attack lands
on the frame where the animation happens.

usage: python3 sting.py cues.json duration out.wav
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
cues = json.load(open(sys.argv[1]))
DUR = float(sys.argv[2])
N = int(SR * DUR)
OUT = np.zeros((N, 2))


def load(name):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", os.path.join(HERE, "sfx", name + ".mp3"), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, "<f4").reshape(-1, 2).astype(np.float64)
    return x / max(1e-9, np.max(np.abs(x)))


def attack(x):
    """Time of the first moment the sound reaches 30% of its loudest 10 ms."""
    e = np.sqrt(np.convolve((x ** 2).mean(1), np.ones(480) / 480, "same"))
    return int(np.argmax(e > e.max() * .3))


def place(name, t, gain, fade_out=None):
    x = load(name)
    if fade_out:                                                   # trim a long tail
        n = int(fade_out * SR)
        x = x[:n] * np.linspace(1, 0, min(n, len(x)))[:, None] ** 1.5 if len(x) > n else x
    i = int(round(t * SR)) - attack(x)
    if i < 0:
        x, i = x[-i:], 0
    x = x[: N - i] * gain
    OUT[i:i + len(x)] += x


c = cues
place("whoosh_b", c["cursor"] + .15, .35)            # the cursor flies in
place("click_b", c["click"], .55)                    # and clicks the poster
place("wipe_b", c["wipe"] + .2, .6)                   # the orange wipe
place("logo_a", c["logo"] + .25, .7)                  # the logo lands
place("taps_a", c["letters"] + .1, .3)               # the letters
place("keys_b", c["press"], .75)                      # ⌥ + Space
place("chime_b", c["pill"] + .05, .45)                # closing chime

# a soft room around the dry effects, so every hit blooms and fades into the next instead of stopping short
rng = np.random.default_rng(7)
ir_len = int(2.2 * SR)
t = np.arange(ir_len) / SR
ir = rng.standard_normal((ir_len, 2)) * np.exp(-t / .5)[:, None] * np.minimum(1, t / .012)[:, None]
spec = np.fft.rfft(ir, axis=0)
f = np.fft.rfftfreq(ir_len, 1 / SR)
spec *= (1 / np.sqrt(1 + (f / 5000) ** 4))[:, None] * (f > 120)[:, None]        # darker, no rumble
ir = np.fft.irfft(spec, ir_len, axis=0)
ir /= np.sqrt((ir ** 2).sum(0))
L = N + ir_len
wet = np.fft.irfft(np.fft.rfft(OUT, L, axis=0) * np.fft.rfft(ir, L, axis=0), L, axis=0)[:N]
OUT = OUT + wet * .32

fo = int(.6 * SR)
OUT[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
peak = np.max(np.abs(OUT))
if peak > .85:
    OUT *= .85 / peak
with wave.open(sys.argv[3], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((OUT * 32767).astype("<i2").tobytes())
print("wrote", sys.argv[3])
