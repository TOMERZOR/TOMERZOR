# The strongest partial of a sound over time (80 ms frames), to see where a break sound rings. usage: track.py FILE
import sys, subprocess, numpy as np
SR = 48000
NAMES = 'C C# D D# E F F# G G# A A# B'.split()
raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', sys.argv[1], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).astype(np.float64)
n = 4096; w = np.hanning(n); fr = np.fft.rfftfreq(n, 1 / SR)
for i in range(0, len(x) - n // 2, int(0.08 * SR)):
    seg = x[i:i + n]; seg = np.pad(seg, (0, n - len(seg)))
    S = np.abs(np.fft.rfft(seg * w)) ** 2; S[fr < 150] = 0
    j = np.argmax(S); lvl = 10 * np.log10(S[j] + 1e-20)
    # parabolic interpolation for the peak frequency
    if 0 < j < len(S) - 1:
        a, b, c = np.log(S[j - 1] + 1e-30), np.log(S[j] + 1e-30), np.log(S[j + 1] + 1e-30); d = 0.5 * (a - c) / (a - 2 * b + c); f = fr[j] + d * (fr[1] - fr[0])
    else: f = fr[j]
    st = 12 * np.log2(f / 261.6256); nm = NAMES[int(round(st)) % 12]
    rms = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12)
    print(f'{i / SR:5.2f}s rms {rms:6.1f} dB  peak {f:7.1f} Hz {nm}{(st - round(st)) * 100:+4.0f}c  ({lvl:5.1f})')
