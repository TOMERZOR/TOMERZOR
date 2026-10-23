# Old glass vs new breaks, moment by moment: the loudest short-term loudness (K-weighted as in BS.1770, 150 ms windows)
# of each moment on its own bus. Old = the v3 glass bus plus the Pixabay sparkle that played on three of its moments;
# new = the breaks bus; around them = the music and the other two beds as they enter the mix (music -2.5 dB, then
# everything +3.5 dB, before the ducking), and how far the new breaks sit above (+) or below (-) that.
# usage: python3 qa/breaks/calib.py OLD_GLASS_BED.wav NEW_BREAKS_BED.wav
import sys, json, subprocess, numpy as np
SR = 48000
tb = lambda b: -0.0016 + 0.48388 * b
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
def kweight(x):
    n = 1 << (len(x) + SR).bit_length(); z = np.exp(-2j * np.pi * np.fft.rfftfreq(n))  # z^-1 on the unit circle
    H = lambda b, a: (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)
    h = (H([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585])
         * H([1, -2, 1], [1, -1.99004745483398, 0.99007225036621]))
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c], n) * h, n)[:len(x)] for c in range(2)], 1)
def loudest(y, t0, t1, win=0.15, hop=0.01):
    c = np.concatenate([[0], np.cumsum((y ** 2).sum(1))]); wn = int(win * SR)
    e = max((c[int(s * SR) + wn] - c[int(s * SR)]) / wn for s in np.arange(t0, t1 - win + 1e-9, hop))
    return -0.691 + 10 * np.log10(e + 1e-20)
old, new = load(sys.argv[1]), load(sys.argv[2])
sp = load('src/sfx/assets/sfx/sparkle.mp3')
for t, g in ((tb(20) + 0.02, -8), (tb(41) + 0.02, -10), (tb(89.4), -9)):  # v3 played these from the game bed
    a = int(round(t * SR)); n = min(len(sp), len(old) - a); old[a:a + n] += sp[:n] * 10 ** (g / 20)
ctx = load('music/1012.mp3')[:len(old)] * 10 ** (1 / 20)
for p in ('audio/sfx_bed.wav', 'audio/game_bed.wav'): b = load(p)[:len(old)]; ctx[:len(b)] += b * 10 ** (3.5 / 20)
old, new, ctx = kweight(old), kweight(new[:len(old)]), kweight(ctx)
M = [('city D 0.03', 0.0, 0.9), ('city F 1.21', 1.1, 2.0), ('city A 2.18', 2.1, 3.0), ('drop 7.74', tb(16) - 0.02, 8.45),
     ('pop 8.52', 8.5, 8.69), ('burst 8.71', tb(18) - 0.01, 9.2), ('swell 9.58', 9.0, tb(20) - 0.06), ('sparkle 9.70', tb(20) - 0.01, 10.4),
     ('pop 11.37', 11.35, 11.59), ('frame 11.61', tb(24) - 0.01, 12.4), ('sparkle 19.86', tb(41) - 0.02, 20.6), ('night 30.97', tb(64) - 0.02, 31.7),
     ('pendants 31.77', tb(64) + 0.78, 32.6), ('rewind 41.28', 40.6, tb(84) + 0.66), ('rewind 41.81', tb(84) + 0.7, 42.4),
     ('logo 42.58', tb(88) - 0.02, 43.2), ('sparkle 43.26', tb(89.4) - 0.02, 44.0)]
for k, t0, t1 in M:
    lo, ln, lc = loudest(old, t0, t1), loudest(new, t0, t1), loudest(ctx, t0, t1)
    print(json.dumps({'moment': k, 'old_lufs': round(lo, 1), 'new_lufs': round(ln, 1), 'new_minus_old': round(ln - lo, 1),
                      'around_lufs': round(lc, 1), 'old_vs_around': round(lo + 3.5 - lc, 1), 'new_vs_around': round(ln + 3.5 - lc, 1)}))
