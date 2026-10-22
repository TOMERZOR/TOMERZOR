# Builds the trailer soundtrack from the logged sound events and the game's own samples.
import json, subprocess, sys, wave, numpy as np, random, os
SR = 44100
OUT = sys.argv[1]
SFX = os.path.join(os.path.dirname(__file__), '../../assets/sfx')
log = json.load(open(os.path.join(OUT, 'sfx-log.json')))
dur = float(sys.argv[2])
L = np.zeros(int(SR * (dur + 2))); R = np.zeros_like(L)
def load(n):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', f'{SFX}/{n}.mp3', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)
S = {n: load(n) for n in ['glass_s1','glass_s2','glass_s3','glass_s4','glass_b1','glass_b2','glass_b3','glass_b4','boom1','boom2','boom3','fire1','fire2','fire3']}
cyc = {}
def pick(prefix, count):
    i = cyc.get(prefix, random.randint(0, count - 1)); cyc[prefix] = (i + 1) % count
    return f'{prefix}{i + 1}'
def add(sig, t, gain=1.0, pan=0.0):
    s = int(t * SR); e = min(len(L), s + len(sig))
    if s >= len(L) or e <= s: return
    gl = gain * np.sqrt(0.5 * (1 - pan)); gr = gain * np.sqrt(0.5 * (1 + pan))
    L[s:e] += sig[:e - s] * gl; R[s:e] += sig[:e - s] * gr
def rate(sig, r):
    n = int(len(sig) / r); x = np.linspace(0, len(sig) - 1, n)
    return np.interp(x, np.arange(len(sig)), sig)
def tone(f, d, a=0.004):
    t = np.arange(int(SR * (d + a))) / SR
    env = np.minimum(1, t / a) * np.exp(-np.maximum(0, t - a) / (d / 4.5))
    return np.sin(2 * np.pi * f * t) * env
def bell(f, d, gain):
    # the game's crystal bell: FM, depth capped so high notes never alias
    t = np.arange(int(SR * (d + 0.05))) / SR
    depth = min(f * 2.4, 2600)
    dev = depth * np.exp(np.log(0.02) * np.minimum(t / (d * 0.8), 1))
    pm = np.cumsum(dev * np.sin(2 * np.pi * f * 3.5 * t)) / SR
    env = np.minimum(1, t / 0.003) * np.exp(-t / (d / 4.5))
    return gain * np.sin(2 * np.pi * f * t + 2 * np.pi * pm) * env
def noise(d, lo, hi, gain):
    n = int(SR * d); x = np.random.default_rng(3).standard_normal(n)
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(n, 1 / SR); X[(fr < lo) | (fr > hi)] = 0
    y = np.fft.irfft(X, n); y /= np.max(np.abs(y)) + 1e-9
    return y * gain * np.exp(-np.arange(n) / SR / (d / 3))
duck = []  # times the music steps back for the slow-motion finish
PENTA = [0, 2, 4, 7, 9]
random.seed(7)
for ev in log:
    k, a, t = ev['k'], ev['a'], ev['t']
    if k == 'fire':
        add(rate(S[pick('fire', 3)], random.uniform(0.95, 1.06)), t, 0.6)
    elif k == 'shatter':
        x, size, power, combo = (a + [0.5, 0.6, 0.6, 1])[:4] if len(a) < 4 else a[:4]
        big = size >= 0.62
        sig = S[pick('glass_b' if big else 'glass_s', 4)]
        r = random.uniform(0.9, 1.14) * (1 + (0.62 - min(1, size)) * 0.35)
        add(rate(sig, r), t, 0.5 + 0.5 * power, (x - 0.5) * 1.2)
        if combo and combo > 1:
            step = min(combo - 2, 11); semis = PENTA[step % 5] + 12 * (step // 5)
            f = 659.25 * 2 ** (semis / 12)
            add(bell(f, 0.9, 0.075), t + 0.03); add(tone(f, 0.5) * 0.05, t + 0.03); add(tone(f * 2, 0.3) * 0.02, t + 0.03)
    elif k == 'boom':
        add(S[pick('boom', 3)], t, 0.9, (a[0] - 0.5) if a else 0)
    elif k == 'win':
        for i, f in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.5]):
            add(tone(f, 0.9 - i * 0.08) * 0.08, t + 0.05 + i * 0.085); add(tone(f * 2, 0.4) * 0.022, t + 0.05 + i * 0.085)
        add(bell(1568, 1.6, 0.05), t + 0.41); add(noise(0.7, 7500, 16000, 0.03), t + 0.39)
    elif k == 'tink':
        i = a[0] if a else 0
        f = 1318.5 * 2 ** ((PENTA[i % 5] + 12 * (i // 5)) / 12)
        add(tone(f, 0.22) * 0.022, t, 1, 0.25 if i % 2 else -0.25)
    elif k == 'slowmo':
        n = int(SR * 1.1); tt = np.arange(n) / SR
        fr = 170 * (68 / 170) ** (tt / 1.1); ph = 2 * np.pi * np.cumsum(fr) / SR
        add(np.sin(ph) * np.minimum(1, tt / 0.04) * np.exp(-tt / 0.5) * 0.13, t)
        add(noise(0.95, 1700, 5600, 0.05), t)
        duck.append(t)
    elif k == 'hit':
        sp = a[2] if len(a) > 2 else 4
        add(tone(260 + random.random() * 80, 0.07) * min(1, sp / 12) * 0.25, t)
# soft pad
chords = [[48, 55, 59, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 64], [43, 50, 55, 59, 62]]
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)
bar = 4.0
for bi in range(int(dur / bar) + 1):
    t0 = bi * bar; n = int(SR * (bar + 1.5)); tt = np.arange(n) / SR
    env = np.minimum(1, tt / 1.6) * np.minimum(1, np.maximum(0, (bar + 1.5 - tt) / 1.5))
    sig = np.zeros(n)
    for m in chords[bi % 4]:
        f = mtof(m); sig += np.sin(2 * np.pi * f * tt) + 0.18 * np.sin(2 * np.pi * 3 * f * tt)
    g = np.ones(n)
    for td in duck:  # the pad steps back under the slow-motion finish, then swells home
        rel = t0 + tt - td
        g = np.minimum(g, np.where((rel > 0) & (rel < 1.4), 0.25, np.where((rel >= 1.4) & (rel < 2.6), 0.25 + 0.75 * (rel - 1.4) / 1.2, 1)))
    add(sig * env * g * 0.012, t0)
mix = np.stack([L, R], 1)[: int(SR * dur)]
peak = np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix / peak * 1.2) / np.tanh(1.2) * 0.89
with wave.open(os.path.join(OUT, 'mix.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('mix written', len(log), 'events', round(dur, 2), 's')
