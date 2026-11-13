#!/usr/bin/env python3
"""Check the joins of a music plan analytically (no ears): clicks, spectral jumps and downbeat timing.

  python3 tools/music_joins.py plan_events.json rendered.wav

For every join J (t1 of one segment == t0 of the next) the crossfade window [J+nudge-xlead-xfade, J+nudge-xlead] is
compared with the same window placed before the neighbouring beat lines (J +- 0.5, 1.0, 1.5, 2.0 s that are not joins):
  disc  max |x[n] - x[n-1]| in the window (a click shows as a step), dB relative to the neighbours' median
  hf    energy above 6 kHz in the window, dB relative to the neighbours' median
  flux  peak spectral flux (512-pt frames, 64 hop) in the window, relative to the neighbours' median (ratio)
  att   the downbeat's attack time relative to the film grid line J (first crossing of 30 % of the local peak of
        the >2 kHz envelope); the neighbours' median attack is printed beside it for reference
and, because the neighbours are not always the same kind of beat (take1's intro has a snare only every other beat),
the same window measured on the UNEDITED track as it would have sounded there without the join (old segment
continuing, new segment already playing), level-matched to the render: *_vs_unedited = join minus the louder of the
two (dB, or ratio for flux). A click or a jump shows as a clearly positive number in both comparisons.
"""
import sys, json
import numpy as np
from scipy import signal
from scipy.io import wavfile

ev = json.load(open(sys.argv[1])); plan = ev["music"]
sr, x = wavfile.read(sys.argv[2]); x = x.astype(np.float64) / 32768; x = x.mean(1) if x.ndim > 1 else x
nud = float(plan.get("nudge", 0)); xf = float(plan.get("xfade", 0.02)); xl = float(plan.get("xlead", 0.04))
segs = sorted(plan["segments"], key=lambda s: s["t0"])
joins = [s["t0"] for k, s in enumerate(segs) if k and segs[k - 1]["t1"] == s["t0"]]
hfb = signal.sosfilt(signal.butter(4, 6000, "hp", fs=sr, output="sos"), x)
hp2 = signal.sosfilt(signal.butter(4, 2000, "hp", fs=sr, output="sos"), x)
env = np.sqrt(np.convolve(hp2 ** 2, np.ones(48) / 48, "same"))
n, hop = 512, 64
fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
L = np.log1p(np.abs(np.fft.rfft(fr, axis=1)) * 50)
FL = np.r_[0, np.maximum(0, np.diff(L, axis=0)).sum(1)]
def I(t): return int(round(t * sr))
def metrics(c):
    a, b = c + nud - xl - xf - 0.002, c + nud - xl + 0.002
    seg = x[I(a):I(b)]; d = np.abs(np.diff(seg)).max()
    hf = (hfb[I(a):I(b)] ** 2).mean()
    fl = FL[max(0, I(a) // hop - 4):I(b) // hop + 1].max()
    w0, w1 = I(c - 0.08), I(c + 0.08); e = env[w0:w1]; att = (w0 + np.argmax(e > 0.3 * e.max())) / sr - c
    return d, hf, fl, att
import subprocess
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", plan.get("file", "audio/src/music/take1.mp3"), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
TR = np.frombuffer(raw, np.float32).astype(np.float64)
def local(sig, c):
    a, b = c + nud - xl - xf - 0.002, c + nud - xl + 0.002
    w = sig[I(a):I(b)]; d = np.abs(np.diff(w)).max()
    h = signal.sosfilt(signal.butter(4, 6000, "hp", fs=sr, output="sos"), sig[I(a) - 4800:I(b)])[4800:]
    f = np.lib.stride_tricks.sliding_window_view(sig[I(a) - n - 4 * hop:I(b) + n], n)[::hop] * np.hanning(n)
    Lw = np.log1p(np.abs(np.fft.rfft(f, axis=1)) * 50); fl = np.maximum(0, np.diff(Lw, axis=0)).sum(1).max()
    return d, (h ** 2).mean(), fl
def unedited(track_at_J, J, span):
    t = np.arange(len(x)) / sr; st = track_at_J + (t - J - nud)
    y = TR[np.clip((st * sr).astype(int), 0, len(TR) - 1)] * (st >= 0)
    a, b = I(J + span[0]), I(J + span[1]); k = np.sqrt((x[a:b] ** 2).mean() / ((y[a:b] ** 2).mean() + 1e-12))
    return y * k
res = []
for J in joins:
    refs = [J + d for d in (-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2) if 0.3 < J + d < ev["T"]["dur"] - 0.3 and all(abs(J + d - j) > 1e-6 for j in joins)]
    mj = metrics(J); mr = np.array([metrics(r) for r in refs])
    med = np.median(mr, 0)
    r = dict(join=J, disc_db=round(20 * np.log10(mj[0] / med[0]), 1), hf_db=round(10 * np.log10(mj[1] / med[1]), 1),
             flux_ratio=round(mj[2] / med[2], 2), attack_ms=round(mj[3] * 1000, 1), ref_attack_ms=round(med[3] * 1000, 1),
             ref_attack_spread_ms=round(float(np.ptp(mr[:, 3])) * 1000, 1), n_refs=len(refs))
    k = [i for i, sg in enumerate(segs) if sg["t0"] == J][0]; old, new = segs[k - 1], segs[k]
    uo = local(unedited(old["track"] + J - old["t0"], J, (-1.5, -0.1)), J); un = local(unedited(new["track"], J, (0.05, 1.5)), J)
    lj = local(x, J)
    r.update(disc_vs_unedited_db=round(20 * np.log10(lj[0] / max(uo[0], un[0])), 1), hf_vs_unedited_db=round(10 * np.log10(lj[1] / max(uo[1], un[1])), 1),
             flux_vs_unedited=round(lj[2] / max(uo[2], un[2]), 2))
    res.append(r); print(json.dumps(r))
# grid timing of every beat, as a summary
atts = [metrics(b)[3] * 1000 for b in np.arange(0.5, ev["T"]["dur"] - 0.3, 0.5)]
print(json.dumps({"all_beats_attack_ms_median": round(float(np.median(atts)), 1), "p10": round(float(np.percentile(atts, 10)), 1),
                  "p90": round(float(np.percentile(atts, 90)), 1)}))
