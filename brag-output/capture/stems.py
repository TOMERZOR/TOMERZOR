# One sound stem per gameplay clip, rebuilt from the sound events the game logged while it was captured:
# recorded glass and bombs from the game's own samples, and the crystal bells that climb with a chain.
# No music here; the film's bed comes separately. usage: python3 capture/stems.py hero ember night
import json, os, subprocess, sys, wave, random
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
SFX = os.path.join(HERE, '../../shard/assets/sfx')
OUT = os.path.join(HERE, '../composition/assets/audio')
os.makedirs(OUT, exist_ok=True)
PENTA = [0, 2, 4, 7, 9]

def load(n):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', f'{SFX}/{n}.mp3', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

S = {n: load(n) for n in [f'{p}{i}' for p in ('glass_s', 'glass_b') for i in range(1, 5)] + [f'boom{i}' for i in range(1, 4)] + [f'fire{i}' for i in range(1, 4)]}

def rate(sig, r):
    n = int(len(sig) / r)
    return np.interp(np.linspace(0, len(sig) - 1, n), np.arange(len(sig)), sig)

def bell(f, d, gain):
    # the game's crystal bell: FM, depth capped so high notes never alias
    t = np.arange(int(SR * (d + 0.05))) / SR
    dev = min(f * 2.4, 2600) * np.exp(np.log(0.02) * np.minimum(t / (d * 0.8), 1))
    pm = np.cumsum(dev * np.sin(2 * np.pi * f * 3.5 * t)) / SR
    env = np.minimum(1, t / 0.003) * np.exp(-t / (d / 4.5))
    return gain * np.sin(2 * np.pi * f * t + 2 * np.pi * pm) * env

def stem(name):
    log = json.load(open(os.path.join(HERE, f'{name}-sfx.json')))
    dur = max(e['t'] for e in log) + 3.0
    L = np.zeros(int(SR * dur)); R = np.zeros_like(L)
    cyc = {}
    def pick(prefix, count):
        i = cyc.get(prefix, random.randint(0, count - 1)); cyc[prefix] = (i + 1) % count
        return f'{prefix}{i + 1}'
    def add(sig, t, gain=1.0, pan=0.0):
        s = int(t * SR); e = min(len(L), s + len(sig))
        if s >= len(L) or e <= s: return
        L[s:e] += sig[:e - s] * gain * np.sqrt(0.5 * (1 - pan)); R[s:e] += sig[:e - s] * gain * np.sqrt(0.5 * (1 + pan))
    random.seed(7)
    for ev in log:
        k, a, t = ev['k'], ev.get('a') or [], ev['t']
        if k == 'fire':
            add(rate(S[pick('fire', 3)], 0.98), t, 0.7)
        elif k == 'shatter':
            x, size, power, combo = (list(a) + [0.5, 0.6, 0.6, 1][len(a):])[:4]
            big = size >= 0.62
            r = random.uniform(0.92, 1.12) * (1 + (0.62 - min(1, size)) * 0.35)
            add(rate(S[pick('glass_b' if big else 'glass_s', 4)], r), t, 0.55 + 0.45 * power, (x - 0.5) * 1.0)
            if combo and combo > 1:
                step = min(combo - 2, 11); semis = PENTA[step % 5] + 12 * (step // 5)
                add(bell(659.25 * 2 ** (semis / 12), 0.9, 0.09), t + 0.03)
        elif k == 'boom':
            add(S[pick('boom', 3)], t, 0.95, (a[0] - 0.5) if a else 0)
    mix = np.stack([L, R], 1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.89  # -1 dBFS peak; the composition sets each stem's level
    path = os.path.join(OUT, f'game-{name}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print(name, 'stem', round(dur, 2), 's,', len(log), 'events ->', os.path.relpath(path, os.path.join(HERE, '..')))

for n in sys.argv[1:]:
    stem(n)
