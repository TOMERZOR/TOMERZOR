# The strongest tonal peaks (Hz, note, level) in short windows of the music. usage: peaks_at.py T0 T1 [T0 T1 ...]
import sys, subprocess, numpy as np
SR = 48000
NAMES = 'C C# D D# E F F# G G# A A# B'.split()
raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', 'music/1012.mp3', '-t', '48.4', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
m = np.frombuffer(raw, np.float32).astype(np.float64)
a = [float(v) for v in sys.argv[1:]]
for t0, t1 in zip(a[::2], a[1::2]):
    x = m[int(t0 * SR):int(t1 * SR)]; n = len(x)
    S = np.abs(np.fft.rfft(x * np.hanning(n))) ** 2; fr = np.fft.rfftfreq(n, 1 / SR); L = 10 * np.log10(S + 1e-20)
    j = np.where((L[1:-1] > L[:-2]) & (L[1:-1] > L[2:]) & (fr[1:-1] > 100) & (fr[1:-1] < 2500))[0] + 1
    j = j[np.argsort(-L[j])][:10]
    out = []
    for k in sorted(j):
        st = 12 * np.log2(fr[k] / 440) + 9; out.append(f'{fr[k]:.0f}{NAMES[int(round(st)) % 12]}({L[k] - L[j].max():+.0f})')
    print(f'{t0:5.2f}-{t1:5.2f}s: ' + ' '.join(out))
