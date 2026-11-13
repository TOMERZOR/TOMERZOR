#!/usr/bin/env python3
"""Momentary loudness (EBU M, 400 ms) of a mix right after each event, ranked; plus the opening and the loop seam.

  python3 tools/mix_moments.py events.json mix.wav [t1 t2 ...]   (optional: the times of the 'big moments' to check)
"""
import sys, json, subprocess, re
import numpy as np
ev = json.load(open(sys.argv[1])); mix = sys.argv[2]; big = [float(x) for x in sys.argv[3:]]
from scipy.io import wavfile
from scipy import signal
sr, x = wavfile.read(mix); x = x.astype(np.float64) / 32768
# BS.1770 K-weighting at 48 kHz, then 400 ms mean square every 50 ms
b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
k = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
ms = (k ** 2).sum(1); w = int(0.4 * sr); c = np.r_[0, np.cumsum(ms)]
T = np.arange(w, len(ms), int(0.05 * sr)) / sr
Mv = np.array([-0.691 + 10 * np.log10((c[int(t * sr)] - c[int(t * sr) - w]) / w + 1e-14) for t in T])
def M_at(t): return float(Mv[np.argmin(np.abs(T - (t + 0.4)))])  # the 400 ms window that starts at t
rows = sorted({(round(e["t"], 2), e["kind"]) for e in ev["events"] if e["kind"] != "word"})
vals = [(t, k, M_at(t)) for t, k in rows]
print("top 10 momentary (LUFS):", [(t, k, round(m, 1)) for t, k, m in sorted(vals, key=lambda v: -v[2])[:10]])
if big:
    allm = np.array([v[2] for v in vals])
    for b in big:
        m = M_at(b); print(f"  big {b:5.2f}: M {m:.1f} LUFS, rank {int((allm > m + 1e-9).sum()) + 1} of {len(allm)} event windows; median of all {np.median(allm):.1f}")
print("opening M (0-0.4):", round(M_at(0), 1), " body median M:", round(float(np.median(Mv[(T > 1) & (T < 15)])), 1),
      " end M (17.6-18.0):", round(float(Mv[np.argmin(np.abs(T - T.max()))]), 1))
