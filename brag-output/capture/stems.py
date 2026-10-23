# One sound stem per gameplay clip, rebuilt from the sound events the game logged while it was captured, through the
# game's own chain (js/audio.js): the cannon and bombs from its samples, the crystal bells that climb with a chain, soft
# thuds when the ball meets a wall, the slow-motion sigh, quieter breaks when they pile up, a small room, and one fixed
# output level for every level's stem. For the film each break is a satisfying pop instead of breaking glass (sfx/:
# soft pops for small pieces, a pop with a bell ping for big ones), and the bells, pings and level-clear chime are in
# the film music's key, D minor. No music here; the film's bed comes separately.
# usage: python3 capture/stems.py hero2 ember2 night2
import json, os, subprocess, sys, wave, random
import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
SFX = os.path.join(HERE, '../../shard/assets/sfx')
OUT = os.path.join(HERE, '../composition/assets/audio')
os.makedirs(OUT, exist_ok=True)
FILM = os.path.join(HERE, 'sfx')  # the film's break sounds (sfx/CREDITS.md)
KEY_ROOT, KEY_STEPS = 587.33, [0, 3, 5, 7, 10]  # D minor pentatonic from D5: the chain climbs it, as the game climbs its own scale
PING_HZ = {'ping1': 1744.9, 'ping2': 1761.2}  # where each recorded ping rings (A6; katana-v2/qa/breaks/track.py)
PING_LO = 1046.5  # a big piece's ping lands in C6-C7, under the 2-5 kHz band where the ear is sharpest
BREAK_DB = -8  # the breaks against the bells
STEM_GAIN = 0.5  # one level for every stem (not each normalised to its own loudest break), so BREAK_DB really sets the breaks

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

S = {n: load(f'{SFX}/{n}.mp3') for n in [f'boom{i}' for i in range(1, 4)] + [f'fire{i}' for i in range(1, 4)]}
S.update({n: load(f'{FILM}/break_{n}.wav') for n in ['pop1', 'pop2', 'pop3', 'pop4', 'ping1', 'ping2']})

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
    # the game's win(): a rising arpeggio, its top note rung out as a crystal bell, a shimmer of air (the game's is
    # C major; here F major, C-F-A, which sits inside the film's D minor)
    out = np.zeros(int(SR * 2.4))
    def put(sig, at):
        s = int(at * SR); e = min(len(out), s + len(sig)); out[s:e] += sig[:e - s]
    for i, f in enumerate([523.25, 698.46, 880.0, 1046.5, 1396.91]):
        put(tone(f, 0.9 - i * 0.08, 0.08, 0.005), 0.05 + i * 0.085)
        put(tone(f * 2, 0.4, 0.022, 0.005), 0.05 + i * 0.085)
    put(bell(1760, 1.6, 0.05), 0.41)
    put(air(0.7, 0.03, 7500), 0.39)
    return out

def note(combo):
    # the note of a chain's link: each link climbs the film's scale, as the game climbs its own
    step = min(combo - 2, 11)
    return KEY_ROOT * 2 ** ((KEY_STEPS[step % 5] + 12 * (step // 5)) / 12)

def chime(combo):
    # the game's chime(): a crystal bell on the link's note
    f = note(combo)
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
            g = (0.5 + power * 0.5) * crowd * 10 ** (BREAK_DB / 20)
            if min(1, size) >= 0.62:
                # a big piece: a pop with a bell ping, its ping moved to the chain's note (folded into C6-C7)
                f = note(combo) if combo and combo > 1 else 1760.0
                p = pick('ping', 2)
                sig = rate(S[p], f * 2 ** np.ceil(np.log2(PING_LO / f)) / PING_HZ[p])
            else:
                sig = rate(S[pick('pop', 4)], 0.94 + random.random() * 0.14)
            add(sig, t + 0.005, g, (x - 0.5) * 1.4, 0.5)
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
