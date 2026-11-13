#!/usr/bin/env python3
"""Sound QA of a scored mix: balance per event, the big moments, opening/loop, loudness.

  python3 tools/mix_qa.py events.json mix.wav [--stems sfx.wav music.wav] [--detail]

Stems default to <mix>_stem_sfx.wav / <mix>_stem_music.wav (or audio/stem_*.wav for a mix in audio/).
  over   SFX RMS minus music RMS in the event window [t, t+0.25 s] (both stems are written at the same scale)
  pk     the mix's peak level (dBFS) in [t-0.01, t+0.3]: how loud each moment lands after mastering
Loudness: integrated LUFS and true peak (ffmpeg ebur128), short-term (3 s) loudness median / max.
"""
import sys, json, subprocess, re, pathlib
import numpy as np
from scipy.io import wavfile

a = sys.argv[1:]
detail = "--detail" in a; a = [x for x in a if x != "--detail"]
ev = json.load(open(a[0])); mix = pathlib.Path(a[1])
if "--stems" in a: i = a.index("--stems"); sfx_p, mus_p = a[i + 1], a[i + 2]
elif mix.resolve().parent.name == "audio": sfx_p, mus_p = mix.parent / "stem_sfx.wav", mix.parent / "stem_music.wav"
else: sfx_p, mus_p = mix.with_name(mix.stem + "_stem_sfx.wav"), mix.with_name(mix.stem + "_stem_music.wav")
def rd(p): sr, x = wavfile.read(str(p)); return sr, x.astype(np.float64).mean(1) / 32768
sr, M = rd(mix); _, S = rd(sfx_p); _, U = rd(mus_p)
def I(t): return int(max(0, t) * sr)
def rms(x): return 10 * np.log10((x ** 2).mean() + 1e-14)
rows = []
for e in ev["events"]:
    t = e["t"]
    if e["kind"] == "word": continue
    s, u = rms(S[I(t):I(t + 0.25)]), rms(U[I(t):I(t + 0.25)])
    pk = 20 * np.log10(np.abs(M[I(t - 0.01):I(t + 0.3)]).max() + 1e-9)
    rows.append((t, e["kind"], round(s - u, 1), round(pk, 1), round(u, 1)))
over = np.array([r[2] for r in rows])
print(f"events {len(rows)}  SFX over music in event windows: median {np.median(over):+.1f} dB  min {over.min():+.1f}  p10 {np.percentile(over, 10):+.1f}")
if detail:
    for r in rows: print(f"  {r[0]:6.2f} {r[1]:14s} over {r[2]:+6.1f}  mix pk {r[3]:6.1f}  (music {r[4]:.1f})")
low = [r for r in rows if r[2] < 6]
if low: print("  under +6 dB:", [(r[0], r[1], r[2]) for r in low])
top = sorted(rows, key=lambda r: -r[3])[:8]
print("  loudest moments (mix peak dBFS):", [(r[0], r[1], r[3]) for r in top])
# opening and loop
def lv(a0, a1): return round(rms(M[I(a0):I(a1)]), 1)
first = np.argmax(np.abs(M) > 10 ** (-40 / 20)) / sr
print(f"opening: first sample above -40 dBFS at {first * 1000:.1f} ms; level 0-0.25 s {lv(0, .25)} dB, 0.25-0.5 {lv(.25, .5)}")
dur = len(M) / sr
print(f"loop: last 0.25 s {lv(dur - .25, dur)} dB (last 50 ms {lv(dur - .05, dur)}) -> first 0.25 s {lv(0, .25)} dB; last sample {M[-1]:+.4f}, first {M[0]:+.4f}")
r = subprocess.run(["ffmpeg", "-nostats", "-i", str(mix), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
I_ = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]); tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
st = [float(v) for v in re.findall(r" S:\s*(-?[\d.]+)", r)]; st = np.array([v for v in st if v > -70])
print(f"loudness: I {I_} LUFS  TP {tp} dBTP  short-term median {np.median(st):.1f}  max {st.max():.1f}  p10 {np.percentile(st, 10):.1f}")
