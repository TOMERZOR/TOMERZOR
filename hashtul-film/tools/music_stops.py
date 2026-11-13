#!/usr/bin/env python3
"""Clicks at a plan's stops/brakes: HF bursts where the music cuts out and comes back (music stem).

  python3 tools/music_stops.py events.json music_stem.wav
For a stop [a, b]: 'out' = >6 kHz energy in the 30 ms after the cut-out (a) relative to the 30 ms before it (a click
shows as a burst, a clean fade as a big negative number) and the largest sample step in [a-0.03, a+0.03] relative to
the median step of the music; 'in' = the re-entry downbeat's >6 kHz peak (5 ms windows) relative to the median of the
other downbeats, and the attack time vs b.
"""
import sys, json
import numpy as np
from scipy import signal
from scipy.io import wavfile
ev = json.load(open(sys.argv[1])); pl = ev["music"]
sr, x = wavfile.read(sys.argv[2]); x = x.astype(np.float64).mean(1) / 32768
h = signal.sosfilt(signal.butter(4, 6000, "hp", fs=sr, output="sos"), x)
def I(t): return int(t * sr)
def e(a, b): return 10 * np.log10((h[I(a):I(b)] ** 2).mean() + 1e-16)
def hpk(t): w = h[I(t - 0.04):I(t + 0.03)] ** 2; return 10 * np.log10(np.convolve(w, np.ones(240) / 240, "valid").max() + 1e-16)
stepmed = np.median(np.abs(np.diff(x))[np.abs(x[1:]) > 1e-4])
stops = [w for w in pl.get("stops", [])] + [[b[0], b[2]] for b in pl.get("brakes", [])]
beats = [t for t in np.arange(0.5, ev["T"]["dur"] - 2.5, 0.5) if all(not (s[0] - 0.05 < t < s[1] + 0.05) for s in stops)]
ref = np.median([hpk(t) for t in beats])
for a, b in [(w[0], w[-1]) if len(w) == 2 else (w[0], w[3]) for w in stops]:
    st = 20 * np.log10(np.abs(np.diff(x[I(a - 0.03):I(a + 0.03)])).max() / stepmed)
    env = np.sqrt(np.convolve(h ** 2, np.ones(48) / 48, "same")); w0 = I(b - 0.06); seg = env[w0:I(b + 0.06)]
    att = (w0 + np.argmax(seg > 0.3 * seg.max())) / sr - b
    print(json.dumps({"stop": [a, b], "out_hf_after_vs_before_db": round(e(a, a + 0.03) - e(a - 0.03, a), 1),
                      "out_max_step_vs_median_db": round(st, 1), "in_hf_peak_vs_other_downbeats_db": round(hpk(b) - ref, 1),
                      "in_attack_ms": round(att * 1000, 1)}))
