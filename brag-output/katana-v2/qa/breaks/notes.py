# The music's held notes at each break moment, from tonal peaks only (spectral peaks 12 dB over their neighbourhood,
# 150-2000 Hz, 0.12-1.0 s after the moment), and the track's tuning against A = 440 Hz. usage: python3 qa/breaks/notes.py
import subprocess, numpy as np
SR = 48000
NAMES = 'C C# D D# E F F# G G# A A# B'.split()
raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', 'music/1012.mp3', '-t', '48.4', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
m = np.frombuffer(raw, np.float32).astype(np.float64)
n = 8192; w = np.hanning(n); fr = np.fft.rfftfreq(n, 1 / SR); band = (fr >= 150) & (fr < 2000)
def peaks(seg):
    S = np.abs(np.fft.rfft(seg * w)) ** 2; L = 10 * np.log10(S + 1e-20)
    from numpy.lib.stride_tricks import sliding_window_view as sw
    med = np.median(sw(np.pad(L, 40, mode='edge'), 81), axis=1)
    j = np.where((L[1:-1] > L[:-2]) & (L[1:-1] > L[2:]) & band[1:-1] & (L[1:-1] > med[1:-1] + 12))[0] + 1
    out = []
    for k in j:
        a, b, c = L[k - 1], L[k], L[k + 1]; d = 0.5 * (a - c) / (a - 2 * b + c); f = fr[k] + d * (fr[1] - fr[0])
        out.append((f, S[k]))
    return out
def notes(t0, t1):
    c = np.zeros(12); dev = []
    for i in range(int(t0 * SR), int(t1 * SR) - n, 2048):
        for f, e in peaks(m[i:i + n]):
            st = 12 * np.log2(f / 440) + 9; c[int(round(st)) % 12] += e; dev.append((st - round(st), e))
    return c / (c.max() + 1e-30), dev
tb = lambda b: -0.0016 + 0.48388 * b
ev = [('open 0.03', 0.03), ('open 1.21', 1.21), ('open 2.18', 2.18), ('drop', tb(16)), ('8.52', 8.52), ('tb18', tb(18)), ('11.37', 11.37),
      ('frame tb24', tb(24)), ('arrival tb41', tb(41)), ('night tb64', tb(64)), ('pendants', tb(64) + 0.8), ('rewind tb84', tb(84)),
      ('ting tb86.4', tb(86.4)), ('logo tb88', tb(88))]
alld = []
for k, t in ev:
    c, d = notes(t + 0.12, t + 1.0); alld += d
    print(f'{k:13s} {t:6.2f}s  ' + ' '.join(f'{NAMES[i]}{c[i]:.2f}' for i in np.argsort(-c)[:5]))
c, d = notes(0, 48.4)
dv = np.array([x for x, _ in d]); ew = np.array([e for _, e in d])
print('whole track: ' + ' '.join(f'{NAMES[i]}{c[i]:.2f}' for i in np.argsort(-c)[:7]))
print(f'tuning: energy-weighted mean offset {100 * (dv * ew).sum() / ew.sum():+.1f} cents from A440 (median {100 * np.median(dv):+.1f})')
