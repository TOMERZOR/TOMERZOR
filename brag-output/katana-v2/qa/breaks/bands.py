# How far each break sits above (+) or below (-) everything around it inside the band where the break itself is
# loudest: per moment, the loudest 2048-point frame of the break in each band (300-1000 Hz, 1-2.5 kHz, 2.5-6 kHz,
# 6-14 kHz) against the music and the other beds in the same frame (as they enter the mix, before ducking).
# usage: python3 qa/breaks/bands.py OLD_GLASS_BED.wav NEW_BREAKS_BED.wav
import sys, json, subprocess, numpy as np
SR = 48000
tb = lambda b: -0.0016 + 0.48388 * b
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
old, new = load(sys.argv[1]), load(sys.argv[2])
sp = load('src/sfx/assets/sfx/sparkle.mp3')
for t, g in ((tb(20) + 0.02, -8), (tb(41) + 0.02, -10), (tb(89.4), -9)):
    a = int(round(t * SR)); n = min(len(sp), len(old) - a); old[a:a + n] += sp[:n] * 10 ** (g / 20)
ctx = load('music/1012.mp3')[:len(old)] * 10 ** (1 / 20)
for p in ('audio/sfx_bed.wav', 'audio/game_bed.wav'): b = load(p)[:len(old)]; ctx[:len(b)] += b * 10 ** (3.5 / 20)
g = 10 ** (3.5 / 20); old, new = old * g, new[:len(old)] * g
BANDS = [(300, 1000), (1000, 2500), (2500, 6000), (6000, 14000)]
n = 2048; w = np.hanning(n); fr = np.fft.rfftfreq(n, 1 / SR)
def frames(x, t0, t1):
    idx = range(int(t0 * SR), int(t1 * SR) - n, 480)
    S = np.array([np.abs(np.fft.rfft(x[i:i + n] * w)) ** 2 for i in idx])
    return np.array([10 * np.log10(S[:, (fr >= lo) & (fr < hi)].sum(1) + 1e-12) for lo, hi in BANDS])  # bands x frames
M = [('city D 0.03', 0.0, 0.9), ('city F 1.21', 1.1, 2.0), ('city A 2.18', 2.1, 3.0), ('drop 7.74', tb(16) - 0.02, 8.45),
     ('pop 8.52', 8.5, 8.69), ('burst 8.71', tb(18) - 0.01, 9.2), ('swell 9.58', 9.0, tb(20) - 0.06), ('sparkle 9.70', tb(20) - 0.01, 10.4),
     ('pop 11.37', 11.35, 11.59), ('frame 11.61', tb(24) - 0.01, 12.4), ('sparkle 19.86', tb(41) - 0.02, 20.6), ('night 30.97', tb(64) - 0.02, 31.7),
     ('pendants 31.77', tb(64) + 0.78, 32.6), ('rewind 41.28', 40.6, tb(84) + 0.66), ('rewind 41.81', tb(84) + 0.7, 42.4),
     ('logo 42.58', tb(88) - 0.02, 43.2), ('sparkle 43.26', tb(89.4) - 0.02, 44.0)]
for k, t0, t1 in M:
    C = frames(ctx, t0, t1); row = {'moment': k}
    for name, x in (('old', old), ('new', new)):
        X = frames(x, t0, t1); j = np.unravel_index(np.argmax(X), X.shape)  # the break's loudest band and frame
        row[name] = f'{BANDS[j[0]][0]}-{BANDS[j[0]][1]} Hz: {X[j]:.1f} vs {C[j]:.1f} -> {X[j] - C[j]:+.1f} dB'
        row[name + "_snr"] = round(float(X[j] - C[j]), 1)
        if name == "new": row["new_by_band"] = [round(float((X[b] - C[b]).max()), 1) for b in range(len(BANDS))]
    print(json.dumps(row))
