# per moment: the loudest 2-6 kHz / 6-14 kHz level of each layer as it sits in the mix (beds +3.5 dB, music -2.5+3.5 dB, undocked)
import sys, json, subprocess, numpy as np
SR = 48000
def load(p, extra=[]):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, *extra, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
def bands(x, n=2048, hop=480):
    w = np.hanning(n); fr = np.fft.rfftfreq(n, 1 / SR); idx = range(0, len(x) - n, hop)
    S = np.array([np.abs(np.fft.rfft(x[i:i + n] * w)) ** 2 for i in idx])
    t = np.array(list(idx)) / SR + n / 2 / SR
    return t, 10 * np.log10(S[:, (fr >= 2000) & (fr < 6000)].sum(1) + 1e-12), 10 * np.log10(S[:, (fr >= 6000) & (fr < 14000)].sum(1) + 1e-12)
tag, mix = sys.argv[1], sys.argv[2]
L = {'mix': load(mix), 'music': load('music/1012.mp3', ['-t', '48.4']) * 10 ** (1 / 20)}
for p in sys.argv[3:]: L[p.split('/')[-1].replace('.wav', '')] = load(p) * 10 ** (3.5 / 20)
B = {k: bands(v) for k, v in L.items()}
tb = lambda b: -0.0016 + 0.48388 * b
ev = {'drop': (tb(16), .25), 'explode': (tb(18), .25), 'frame break': (tb(24), .25), 'hero chain': (15.4, 1.5), 'ember chain': (23.3, 1.5),
      'night pendants': (28.16, .5), 'night last': (30.06, .4), 'logo': (tb(88), .25)}
for k, (a, d) in ev.items():
    row = []
    for name, (t, b26, b614) in B.items():
        w = (t >= a - 0.02) & (t <= a + d); row.append(f"{name} {b26[w].max():5.1f}/{b614[w].max():5.1f}")
    print(f"{tag} {k:15s} " + ' | '.join(row))
