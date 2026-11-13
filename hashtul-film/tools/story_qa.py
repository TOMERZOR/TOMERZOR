#!/usr/bin/env python3
"""Two-moment check for a short loop (stories): momentary loudness (BS.1770, 400 ms windows, 10 ms hop).

  python3 tools/story_qa.py mix.wav 1.0 6.0
For each big moment t: the loudest 400 ms window that contains t. 'elsewhere': the loudest window that contains
neither. 'after': the loudest window starting at or after t_last + 0.5. Plus the loop seam and loudness.
"""
import sys, subprocess, re
import numpy as np
from scipy.io import wavfile
from scipy import signal
p = sys.argv[1]; big = [float(v) for v in sys.argv[2:]]
sr, x = wavfile.read(p); x = x.astype(float) / 32768
b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
k = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0); ms = (k ** 2).sum(1); c = np.r_[0, np.cumsum(ms)]; w = int(.4 * sr)
st = np.arange(0, len(ms) - w, int(.01 * sr)) / sr
M = np.array([-0.691 + 10 * np.log10((c[int(t * sr) + w] - c[int(t * sr)]) / w + 1e-14) for t in st])
cont = np.zeros(len(st), bool); out = []
for b in big:
    m = (st <= b) & (st + 0.4 > b); cont |= m; out.append((b, round(float(M[m].max()), 1)))
o = ~cont; i = np.argmax(np.where(o, M, -999))
af = st >= big[-1] + 0.5
print("moments:", out, f"| elsewhere max {M[i]:.1f} (window at {st[i]:.2f})", f"| after {big[-1] + 0.5}: max {M[af].max():.1f}")
def lv(a, b): return round(10 * np.log10((x[int(a * sr):int(b * sr)] ** 2).mean() + 1e-14), 1)
d = len(x) / sr
print(f"loop: last 0.25 s {lv(d - .25, d)} dB, first 0.25 s {lv(0, .25)} dB, first 0.4 s M {M[0]:.1f}, median M {np.median(M):.1f}")
r = subprocess.run(["ffmpeg", "-nostats", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
print("loudness: I", re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1], "TP", re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
