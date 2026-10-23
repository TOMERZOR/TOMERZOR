# One sound stem per gameplay clip, rebuilt from the sound events the game logged while it was captured, through the
# game's own chain (js/audio.js): recorded glass, cannon and bombs from its samples, the crystal bells that climb with
# a chain, soft thuds when the ball meets a wall, the slow-motion sigh, quieter glass when breaks pile up, a small room,
# and one fixed output level for every level's stem. For the film the glass recordings also lose their sting (a presence
# dip and a gentler top) and sit a little under the bells. No music here; the film's bed comes separately.
# usage: python3 capture/stems.py hero2 ember2 night2
import json, os, subprocess, sys, wave, random
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
SFX = os.path.join(HERE, '../../shard/assets/sfx')
OUT = os.path.join(HERE, '../composition/assets/audio')
os.makedirs(OUT, exist_ok=True)
PENTA = [0, 2, 4, 7, 9]
SOFT = 'equalizer=f=3400:t=q:w=0.9:g=-5,highshelf=f=7000:g=-5,lowpass=f=12000'  # the film's glass: less bite, same body
GLASS_DB = -4  # the glass under the bells, so a chain reads as rising notes rather than a wall of breaks
STEM_GAIN = 0.6  # one level for every stem (not each normalised to its own loudest break), so GLASS_DB really lowers the glass

def load(n, af=None):
    cmd = ['ffmpeg', '-v', 'quiet', '-i', f'{SFX}/{n}.mp3', '-ac', '1', '-ar', str(SR)] + (['-af', af] if af else []) + ['-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

S = {n: load(n, SOFT if n.startswith('glass') else None)
     for n in [f'{p}{i}' for p in ('glass_s', 'glass_b') for i in range(1, 5)] + [f'boom{i}' for i in range(1, 4)] + [f'fire{i}' for i in range(1, 4)]}

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

def tone(f, d, gain, a=0.002, glide=None):
    # the game's tone(): a sine whose gain ramps exponentially up over `a`, then down over `d`, optionally gliding in pitch
    t = np.arange(int(SR * (a + d + 0.05))) / SR
    lo = 1e-4 / gain
    env = np.where(t < a, lo ** np.clip(1 - t / a, 0, 1), lo ** np.clip((t - a) / d, 0, 1)) * gain
    if glide:
        fr = f * (glide / f) ** np.minimum(1, t / d)
        ph = 2 * np.pi * np.cumsum(fr) / SR
    else:
        ph = 2 * np.pi * f * t
    return np.sin(ph) * env

def filtered_noise(d, kind, f0, gain, q=0.7, f1=None, seed=5):
    # the game's noise(): white noise through a biquad (bandpass or lowpass, optionally sweeping), exponential envelope
    rng = np.random.default_rng(seed)
    n = int(SR * (d + 0.05)); x = rng.uniform(-1, 1, n); y = np.zeros(n)
    t = np.arange(n) / SR
    fc = f0 * (f1 / f0) ** np.minimum(1, t / d) if f1 else np.full(n, float(f0))
    x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        w = 2 * np.pi * fc[i] / SR; al = np.sin(w) / (2 * q); cw = np.cos(w); a0 = 1 + al
        if kind == 'bandpass': b0, b1, b2 = al, 0.0, -al
        else: b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
        yi = (b0 * x[i] + b1 * x1 + b2 * x2 + 2 * cw * y1 - (1 - al) * y2) / a0
        x2, x1, y2, y1 = x1, x[i], y1, yi; y[i] = yi
    lo = 1e-4 / gain
    return y * np.where(t < 0.002, lo ** np.clip(1 - t / 0.002, 0, 1), lo ** np.clip((t - 0.002) / d, 0, 1)) * gain

def air(d, gain, cutoff):
    # a breath of high-passed noise (the game's noise() through a highpass), shaped like its envelope
    rng = np.random.default_rng(3)
    n = int(SR * (d + 0.05)); x = rng.standard_normal(n)
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(n, 1 / SR); X[fr < cutoff] *= 0.05
    x = np.fft.irfft(X, n); x /= np.max(np.abs(x)) + 1e-9
    t = np.arange(n) / SR
    return x * gain * np.minimum(1, t / 0.002) * (1e-4 / gain) ** np.minimum(1, t / d) * 0.6

def win_chime():
    # the game's win(): a rising C-major arpeggio, its top note rung out as a crystal bell, a shimmer of air
    out = np.zeros(int(SR * 2.4))
    def put(sig, at):
        s = int(at * SR); e = min(len(out), s + len(sig)); out[s:e] += sig[:e - s]
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.5, 1318.5]):
        put(tone(f, 0.9 - i * 0.08, 0.08, 0.005), 0.05 + i * 0.085)
        put(tone(f * 2, 0.4, 0.022, 0.005), 0.05 + i * 0.085)
    put(bell(1568, 1.6, 0.05), 0.41)
    put(air(0.7, 0.03, 7500), 0.39)
    return out

def chime(combo):
    # the game's chime(): each link of a chain climbs the pentatonic scale
    step = min(combo - 2, 11); f = 659.25 * 2 ** ((PENTA[step % 5] + 12 * (step // 5)) / 12)
    b, a, c = bell(f, 0.9, 0.075), tone(f, 0.5, 0.05, 0.004), tone(f * 2, 0.3, 0.02, 0.004)
    out = np.zeros(max(len(b), len(a), len(c))); out[:len(b)] += b; out[:len(a)] += a; out[:len(c)] += c
    return out

def slowmo():
    # the game's slowmo(): a deep falling sigh and air drawn down as time slows on the last piece
    a, b = tone(170, 1.1, 0.13, 0.04, 68), filtered_noise(0.95, 'bandpass', 5600, 0.05, 1.4, 1700)
    out = np.zeros(max(len(a), len(b))); out[:len(a)] += a; out[:len(b)] += b
    return out

def thud(v):
    # the game's hit() for walls and shelves: a short falling sine and a dull tap
    a, b = tone(240 + random.random() * 60, 0.07, 0.32 * v, 0.002, 140), filtered_noise(0.03, 'lowpass', 900, 0.2 * v, 1.0)
    out = np.zeros(max(len(a), len(b))); out[:len(a)] += a; out[:len(b)] += b
    return out

def room():
    # the game's small airy reverb: 1.6 s of decaying stereo noise, scaled the way a Web Audio ConvolverNode normalises it
    rng = np.random.default_rng(11)
    n = int(SR * 1.6); ir = rng.uniform(-1, 1, (2, n)) * (1 - np.arange(n) / n) ** 3.2
    return ir * (0.00125 / np.sqrt((ir ** 2).mean())) * (44100 / SR)

def convolve(x, h):
    n = len(x) + len(h) - 1; m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:len(x)]

def stem(name):
    log = json.load(open(os.path.join(HERE, f'{name}-sfx.json')))
    dur = max(e['t'] for e in log) + 3.0
    L = np.zeros(int(SR * dur)); R = np.zeros_like(L); WL = np.zeros_like(L); WR = np.zeros_like(L)
    cyc = {}
    def pick(prefix, count):
        i = cyc.get(prefix, random.randint(0, count - 1)); cyc[prefix] = (i + 1) % count
        return f'{prefix}{i + 1}'
    def add(sig, t, gain=1.0, pan=0.0, wet=0.0):
        s = int(t * SR); e = min(len(L), s + len(sig))
        if s >= len(L) or e <= s: return
        p = max(-0.8, min(0.8, pan)); x = sig[:e - s] * gain
        gl, gr = np.sqrt(0.5 * (1 - p)), np.sqrt(0.5 * (1 + p))
        L[s:e] += x * gl; R[s:e] += x * gr
        if wet: WL[s:e] += x * gl * wet; WR[s:e] += x * gr * wet
    random.seed(7)
    voices = []  # start times of the shatters still sounding (the game counts a voice for 0.3 s)
    last = -1.0
    for ev in log:
        k, a, t = ev['k'], ev.get('a') or [], ev['t']
        if k == 'fire':
            add(rate(S[pick('fire', 3)], 0.94 + random.random() * 0.12), t, 0.75, 0, 0.05)
        elif k == 'shatter':
            x, size, power, combo = (list(a) + [0.5, 0.6, 0.6, 1][len(a):])[:4]
            voices = [v for v in voices if t - v < 0.3]
            if t - last < 0.02 and len(voices) > 5: continue  # the game drops a break that lands on five others
            last = t; voices.append(t)
            crowd = 0.65 if len(voices) > 3 else 1.0
            big = min(1, size)
            r = (0.9 + random.random() * 0.24) * (1 + (0.62 - big) * 0.35)
            g = (0.5 + power * 0.5) * crowd * 10 ** (GLASS_DB / 20)
            add(rate(S[pick('glass_b' if big >= 0.62 else 'glass_s', 4)], r), t + 0.005, g, (x - 0.5) * 1.4, 0.5)
            if combo and combo > 1:
                add(chime(combo), t + 0.03, 1.0, 0, 0.8)
        elif k == 'boom':
            add(rate(S[pick('boom', 3)], 0.92 + random.random() * 0.14), t, 0.95, (a[0] - 0.5) if a else 0, 0.4)
        elif k == 'hit':
            v = min(1, (a[2] if len(a) > 2 else 0) / 12)
            if v >= 0.08: add(thud(v), t + 0.002, 1.0, ((a[3] if len(a) > 3 else 0.5) - 0.5) * 1.2, 0.1)
        elif k == 'slowmo':
            add(slowmo(), t + 0.01, 1.0, 0, 0.9)
        elif k == 'win':
            add(win_chime(), t, 1.6, 0, 0.9)
        # tink: the assembly notes run on wall-clock timers during capture, so their logged times are not the picture's; left out
    h = room()
    L += convolve(WL, h[0]); R += convolve(WR, h[1])
    mix = np.stack([L, R], 1) * STEM_GAIN
    peak = float(np.max(np.abs(mix)))
    if peak > 0.89: sys.exit(f'{name}: peak {peak:.2f} would clip; lower STEM_GAIN')
    path = os.path.join(OUT, f'game-{name}.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print(name, 'stem', round(dur, 2), 's,', len(log), 'events, peak', round(20 * np.log10(peak), 1), 'dBFS ->', os.path.relpath(path, os.path.join(HERE, '..')))

for n in sys.argv[1:]:
    stem(n)
