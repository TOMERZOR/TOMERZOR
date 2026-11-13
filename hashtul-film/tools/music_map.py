#!/usr/bin/env python3
"""Bar-by-bar map of a music track on a known beat grid (for picking edit points).

  python3 tools/music_map.py [audio/src/music/take1.mp3] [--grid0 0.557] [--beat 0.5] [--json out.json]

For each beat: onset strength (spectral flux) in three bands, level, and off-grid onsets in the beat (fills);
for each bar line (every 4 beats): what crosses it -- the level in the last 60 ms before it relative to the bar
(a held note or a pickup keeps it high), tonal continuity across it (chroma correlation 150 ms each side), the
strongest onset in the 250 ms before it (a pickup), and the downbeat's own onset strength.
"""
import sys, subprocess, json, argparse
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("path", nargs="?", default="audio/src/music/take1.mp3")
ap.add_argument("--grid0", type=float, default=0.557)
ap.add_argument("--beat", type=float, default=0.5)
ap.add_argument("--json")
a = ap.parse_args()

SR = 44100
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32).astype(np.float64)
dur = len(x) / SR
hop, n = 256, 2048
fr = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n // 2, n // 2)), n)[::hop] * np.hanning(n)
S = np.abs(np.fft.rfft(fr, axis=1)); f = np.fft.rfftfreq(n, 1 / SR); fps = SR / hop
t = np.arange(len(S)) / fps
L = np.log1p(S * 10)
def flux(lo, hi):
    m = (f >= lo) & (f < hi); d = np.maximum(0, np.diff(L[:, m], axis=0)).sum(1); d = np.r_[0, d]
    return d / (np.percentile(d, 99) + 1e-9)
FL, FM, FH = flux(20, 150), flux(150, 2000), flux(2000, 16000)
FA = flux(20, 16000)
rms = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
cent = (S * f).sum(1) / (S.sum(1) + 1e-9)
# chroma
pc = np.zeros((len(S), 12)); ok = (f > 60) & (f < 4000)
midi = 69 + 12 * np.log2(f[ok] / 440); cls = np.round(midi).astype(int) % 12
for c in range(12): pc[:, c] = (S[:, ok][:, cls == c] ** 2).sum(1)
pc /= np.linalg.norm(pc, axis=1, keepdims=True) + 1e-9
def idx(s): return int(np.clip(round(s * fps), 0, len(S) - 1))
def win(arr, s0, s1): return arr[idx(s0):max(idx(s1), idx(s0) + 1)]

# onset peaks (global)
pk = [i for i in range(1, len(FA) - 1) if FA[i] > FA[i - 1] and FA[i] >= FA[i + 1] and FA[i] > 0.25]
onsets = [(t[i], FA[i]) for i in pk]

beats = np.arange(a.grid0, dur, a.beat)
rows = []
for k, b in enumerate(beats):
    near = [(o, s) for o, s in onsets if abs(o - b) < 0.03]
    off = [(round(o - b, 3), round(s, 2)) for o, s in onsets if 0.03 <= o - b < a.beat - 0.03]
    rows.append(dict(k=k, t=round(b, 3), on=round(max([s for _, s in near], default=0), 2),
                     dt=round(max(near, key=lambda z: z[1])[0] - b, 4) if near else None,
                     low=round(win(FL, b - .02, b + .03).max(), 2), mid=round(win(FM, b - .02, b + .03).max(), 2),
                     high=round(win(FH, b - .02, b + .03).max(), 2), db=round(win(rms, b, b + a.beat).mean(), 1),
                     cent=int(win(cent, b, b + a.beat).mean()), off=off))
bars = []
bl = 4 * a.beat
for m, b in enumerate(np.arange(a.grid0, dur, bl)):
    bar_db = win(rms, b, b + bl).mean()
    pre = win(rms, b - 0.06, b - 0.005).mean() - win(rms, b - bl, b).mean() if b > bl else None
    tail = win(rms, b - 0.06, b - 0.005).mean() - win(rms, b - bl, b).min() if b > bl else None
    cc = float(np.dot(win(pc, b - .15, b).mean(0), win(pc, b + .02, b + .17).mean(0)) /
               (np.linalg.norm(win(pc, b - .15, b).mean(0)) * np.linalg.norm(win(pc, b + .02, b + .17).mean(0)) + 1e-9)) if b > .2 else None
    pick = [(round(o - b, 3), round(s, 2)) for o, s in onsets if -0.25 < o - b < -0.03]
    db_on = [r for r in rows if abs(r["t"] - b) < 1e-6]
    bars.append(dict(bar=m, t=round(b, 3), db=round(bar_db, 1), pre_vs_bar=None if pre is None else round(pre, 1),
                     chroma_cont=None if cc is None else round(cc, 2), pickup=pick,
                     down=db_on[0]["on"] if db_on else None, low=round(win(FL, b, b + bl).mean() * 100, 1),
                     high=round(win(FH, b, b + bl).mean() * 100, 1), cent=int(win(cent, b, b + bl).mean())))
print(f"duration {dur:.3f}  grid0 {a.grid0}  beat {a.beat}")
print("bar  t      dB    cent  lowF  hiF   down  pre60ms  chroma  pickups(dt,strength)")
for B in bars:
    print(f"{B['bar']:3d} {B['t']:6.3f} {B['db']:6.1f} {B['cent']:5d} {B['low']:5.1f} {B['high']:5.1f} {B['down'] or 0:5.2f} "
          f"{'' if B['pre_vs_bar'] is None else B['pre_vs_bar']:>7} {'' if B['chroma_cont'] is None else B['chroma_cont']:>6}  {B['pickup']}")
print("\nbeat  t      on    dt     low  mid  high   dB   off-grid onsets")
for r in rows:
    print(f"{r['k']:3d} {r['t']:6.3f} {r['on']:5.2f} {'' if r['dt'] is None else r['dt']:>7} {r['low']:4.2f} {r['mid']:4.2f} {r['high']:4.2f} {r['db']:6.1f}  {r['off']}")
if a.json:
    json.dump({"bars": bars, "beats": rows, "onsets": [(round(o, 4), round(s, 3)) for o, s in onsets]}, open(a.json, "w"), indent=1)
