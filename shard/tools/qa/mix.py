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
            add(tone(f, 0.5) * 0.11, t + 0.03); add(tone(f * 2, 0.3) * 0.035, t + 0.03)
    elif k == 'boom':
        add(S[pick('boom', 3)], t, 0.9, (a[0] - 0.5) if a else 0)
    elif k == 'win':
        for i, f in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.5]):
            add(tone(f, 0.9 - i * 0.08) * 0.09, t + 0.05 + i * 0.085); add(tone(f * 2, 0.4) * 0.025, t + 0.05 + i * 0.085)
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
    add(sig * env * 0.012, t0)
mix = np.stack([L, R], 1)[: int(SR * dur)]
peak = np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix / peak * 1.2) / np.tanh(1.2) * 0.89
with wave.open(os.path.join(OUT, 'mix.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('mix written', len(log), 'events', round(dur, 2), 's')
