# Which notes the music holds at each break moment (pitch-class energy 110-2000 Hz over the next ~0.9 s), and the
# pitch content of the new break sounds. usage: python3 qa/breaks/chroma.py
import subprocess, numpy as np
SR = 48000
NAMES = 'C C# D D# E F F# G G# A A# B'.split()
def load(p, extra=[]):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, *extra, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
def chroma(x, lo=110, hi=2000):
    n = len(x); S = np.abs(np.fft.rfft(x * np.hanning(n))) ** 2; f = np.fft.rfftfreq(n, 1 / SR)
    k = (f >= lo) & (f < hi); pc = np.round(12 * np.log2(f[k] / 261.6256)).astype(int) % 12
    c = np.bincount(pc, S[k], 12); return c / c.max()
def top(c, n=5): return ' '.join(f'{NAMES[i]}{c[i]:.2f}' for i in np.argsort(-c)[:n])
tb = lambda b: -0.0016 + 0.48388 * b
m = load('music/1012.mp3', ['-t', '48.4'])
ev = [('open 0.03', 0.03), ('open 1.21', 1.21), ('open 2.18', 2.18), ('drop', tb(16)), ('8.52', 8.52), ('tb18', tb(18)), ('11.37', 11.37),
      ('frame tb24', tb(24)), ('arrival tb41', tb(41)), ('night tb64', tb(64)), ('pendants', tb(64) + 0.8), ('rewind tb84', tb(84)),
      ('ting tb86.4', tb(86.4)), ('logo tb88', tb(88))]
for k, t in ev:
    a = int((t + 0.06) * SR); x = m[a:a + int(0.9 * SR)]
    print(f'{k:13s} {t:6.2f}s  {top(chroma(x))}')
for f in ['deep', 'ping1', 'ping2', 'pop1', 'pop2', 'pop3', 'pop4']:
    x = load(f'src/sfx/film/break_{f}.mp3'); n = len(x)
    S = np.abs(np.fft.rfft(x * np.hanning(n))) ** 2; fr = np.fft.rfftfreq(n, 1 / SR)
    pk = fr[np.argsort(-S * (fr > 150))[:1]]
    # strongest partials (local maxima) above 150 Hz
    loc = np.where((S[1:-1] > S[:-2]) & (S[1:-1] > S[2:]) & (fr[1:-1] > 150))[0] + 1
    best = loc[np.argsort(-S[loc])][:6]
    part = ' '.join(f'{fr[i]:.0f}Hz({NAMES[int(round(12*np.log2(fr[i]/261.6256)))%12]}{(12*np.log2(fr[i]/261.6256)-round(12*np.log2(fr[i]/261.6256)))*100:+.0f}c)' for i in sorted(best))
    print(f'{f:6s} {n/SR:.2f}s chroma {top(chroma(x, 150, 6000), 4)} | partials {part}')
