# How much each glass sound sticks out of the music in the ear's most sensitive band (2-6 kHz) and above (6-14 kHz).
# usage: python3 qa/glass/harsh.py LABEL MIX.wav BED.wav [BED.wav ...]
import sys, json, subprocess, numpy as np
SR = 48000
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
def bands(x, n=2048, hop=480):
    w = np.hanning(n); fr = np.fft.rfftfreq(n, 1 / SR)
    idx = range(0, len(x) - n, hop)
    S = np.array([np.abs(np.fft.rfft(x[i:i + n] * w)) ** 2 for i in idx])
    b = lambda lo, hi: 10 * np.log10(S[:, (fr >= lo) & (fr < hi)].sum(1) + 1e-12)
    return np.array([i / SR for i in idx]) + n / 2 / SR, b(2000, 6000), b(6000, 14000), b(60, 14000)
mix = load(sys.argv[2]); fx = sum(load(p)[:len(mix)] for p in sys.argv[3:])
t, m26, m614, mall = bands(mix)
_, fx26, fx614, _ = bands(fx)
tb = lambda b: -0.0016 + 0.48388 * b
ev = {'open tink 0.03': 0.03, 'open ting 1.21': 1.21, 'open tink 2.18': 2.18, 'drop 7.74': tb(16), 'tink trio 8.5': 8.52, 'explode 8.71': tb(18),
      'cracks 11.4': 11.37, 'frame break 11.61': tb(24), 'hero chain 15.4-16.9': 15.4, 'arrival 19.84': tb(41), 'ember chain 23.3': 23.3,
      'night 28.2': 28.16, 'night last 30.06': 30.06, 'arrival ting 30.97': tb(64), 'D burst 31.77': tb(64) + 0.8, 'rewind ting 41.81': tb(86.4), 'logo 42.58': tb(88)}
rows = []
for k, at in ev.items():
    w = (t >= at - 0.02) & (t <= at + (1.5 if 'chain' in k else 0.25))
    ctx = ((t >= at - 1.2) & (t < at - 0.1)) | ((t > at + 0.6) & (t <= at + 1.5))
    rows.append({'event': k, 'mix_2_6k_peak': round(float(m26[w].max()), 1), 'mix_2_6k_jump': round(float(m26[w].max() - np.median(m26[ctx])), 1),
                 'mix_6_14k_jump': round(float(m614[w].max() - np.median(m614[ctx])), 1), 'fx_2_6k_peak': round(float(fx26[w].max()), 1)})
print(json.dumps({'label': sys.argv[1], 'median_mix_2_6k': round(float(np.median(m26)), 1), 'p99_mix_2_6k': round(float(np.percentile(m26, 99)), 1),
                  'p99_mix_6_14k': round(float(np.percentile(m614, 99)), 1)}))
for r in rows: print(json.dumps(r))
