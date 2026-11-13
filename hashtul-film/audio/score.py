#!/usr/bin/env python3
"""השתול · the soundtrack, scored from the picture.

Times come from the composition (audio/events.json, written by tools/dump_events.py from window.__events()), so a
retimed beat takes its sound with it. Sources: the game's own sound set (audio/game/, from hashtul.onrender.com/sfx),
ElevenLabs sound-effect takes (audio/src/eleven/), and an original instrumental (audio/src/music/take1.mp3,
ElevenLabs Music v2.5 via Higgsfield). Everything shares one synthetic room (onetake's sfx_palette), the music is cut
on its own beat grid and ducked under the hits, and the mix is mastered to -16 LUFS with a -4 dBTP ceiling.

usage: python3 audio/score.py            → audio/mix.wav (48 kHz stereo)
"""
import json, pathlib, subprocess, sys, re
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / ".claude/skills/onetake/scripts"))
import sfx_palette as P                                     # noqa: E402  (the shared room and synthetic materials)

SR = 48000
IR = P.impulse(1.0)                                         # first: it draws from the palette's shared random generator
rng = np.random.default_rng(23)
EV = json.loads((ROOT / "audio/events.json").read_text())
DUR = float(EV["T"]["dur"])
N = int(SR * (DUR + 0.5))
MUSIC_OFFSET = 0.107                                        # track time = film time + offset (puts the beats on the cuts)


def dec(path, ch=1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x.reshape(-1, ch) if ch > 1 else x


def clean(x, thr=0.04, pre=0.002, end=None, fade=0.02):
    """Trim the run-up to the onset, cut at `end` s after it, short fades, peak 1."""
    pk = np.abs(x).max() + 1e-12
    i0 = max(0, int(np.argmax(np.abs(x) > pk * thr)) - int(pre * SR))
    y = x[i0:] if end is None else x[i0:i0 + int(end * SR)]
    y = y.copy(); nf = min(len(y) // 4, int(fade * SR)); ni = int(0.003 * SR)
    y[:ni] *= np.linspace(0, 1, ni); y[-nf:] *= np.linspace(1, 0, nf)
    return P.hp(y, 30) / (np.abs(y).max() + 1e-12)


G = ROOT / "audio/game"; EL = ROOT / "audio/src/eleven"
SRC = {k: clean(dec(G / f)) for k, f in {
    "tap": "tap.wav", "lock": "lock.wav", "flip": "flip.wav", "react": "react.wav", "tick": "tick.wav", "on": "on.wav",
    "whoosh": "whoosh.wav", "start": "start.wav", "reward": "reward.wav", "win": "win.mp3", "boom": "boom.mp3"}.items()}
SRC.update({
    "e_boom1": clean(dec(EL / "boom_1.mp3")), "e_boom2": clean(dec(EL / "boom_2.mp3")), "e_boom3": clean(dec(EL / "boom_3.mp3")),
    "oooh": clean(dec(EL / "crowd_oooh_4.mp3"), fade=0.25), "laugh": clean(dec(EL / "crowd_laugh_3.mp3"), fade=0.3),
    "cheer": clean(dec(EL / "crowd_cheer_1.mp3"), fade=0.3),
    "deal": clean(dec(EL / "deal_1.mp3"), end=0.16), "drip": clean(dec(EL / "drip_4.mp3"), end=0.35),
    "gulp": clean(dec(EL / "gulp_1.mp3"), end=0.42), "pop_a": clean(dec(EL / "pop_3.mp3"), end=0.15),
    "pop_b": clean(dec(EL / "pop_2.mp3"), end=0.25), "riser": clean(dec(EL / "riser_2.mp3"), thr=0.01, fade=0.1),
    "riser_s": clean(dec(EL / "riser_3.mp3"), thr=0.01), "stamp": clean(dec(EL / "stamp_1.mp3"), end=0.4),
    "stamp3": clean(dec(EL / "stamp_3.mp3"), end=0.3), "swish1": clean(dec(EL / "swish_1.mp3"), thr=0.02, end=0.5),
    "swish3": clean(dec(EL / "swish_3.mp3"), end=0.12), "swish4": clean(dec(EL / "swish_4.mp3"), thr=0.02, end=0.3),
    "thud": clean(dec(EL / "thud_1.mp3"), end=0.3), "tick_r": clean(dec(EL / "roulette_2.mp3"), end=0.07),
})


def drumroll(dur=2.1):
    """A soft snare roll that tightens and swells (the suspense under 'השתול הוא…')."""
    n = int(SR * dur); y = np.zeros(n); t = 0.0
    while t < dur - 0.02:
        k = t / dur; i = int(t * SR); m = int(0.05 * SR)
        hit = P.bp(rng.standard_normal(m), 2400 + 1200 * rng.random(), 0.8) * np.exp(-np.arange(m) / SR * 60)
        hit += 0.5 * np.sin(2 * np.pi * 190 * np.arange(m) / SR) * np.exp(-np.arange(m) / SR * 45)
        amp = (0.25 + 0.75 * k ** 1.6) * (0.8 + 0.4 * rng.random())
        y[i:i + m] += hit[: n - i] * amp
        t += 1 / (11 + 17 * k) * (0.9 + 0.2 * rng.random())
    return y / np.abs(y).max()


def popper():
    """The party popper under the game's confetti: a sharp crack, then paper crackle."""
    n = int(SR * 1.2); t = np.arange(n) / SR
    crack = P.hp(rng.standard_normal(n), 900) * np.exp(-t * 90) + 0.6 * np.sin(2 * np.pi * 110 * t) * np.exp(-t * 30)
    crackle = np.zeros(n)
    for _ in range(90):
        i = int(rng.random() ** 1.6 * n * 0.95); m = int(0.004 * SR)
        crackle[i:i + m] += P.hp(rng.standard_normal(m), 3000) * (1 - i / n) * 0.5
    y = crack + crackle
    return y / np.abs(y).max()


SRC["roll"] = drumroll(); SRC["popper"] = popper()


def rate(x, r):
    if abs(r - 1) < 1e-3: return x
    n = int(len(x) / r); return np.interp(np.arange(n) * r, np.arange(len(x)), x)


# kind → layers (source, gain, playback rate, room send, offset s). Rates vary a little so nothing repeats exactly.
def recipe(kind, i, v):
    j = (rng.random() - 0.5)
    R = {
        "glance": [("tick", .16, 1.6, .25, 0)], "drip": [("drip", .5, 1.0, .35, 0)],
        "riser": [("riser", .5, 1.0, .45, 0)],
        "letter": [("tap", .55, .82 + .06 * j, .2, 0), ("thud", .3, 1.25, .15, 0)],
        "logo_hit": [("e_boom1", .5, 1.0, .35, 0), ("tap", .35, .7, .2, 0)],
        "swish": [("swish4", .55, 1.0 + .06 * j, .3, -0.04)], "pop": [("pop_a", .5, 1.0 + .1 * j, .25, 0)],
        "word": [],
        "punch": [("e_boom2", .42, 1.1, .3, 0), ("pop_b", .3, .9, .25, 0)],
        "gulp": [("gulp", .62, 1.0 + .04 * j, .2, 0)], "tap": [("tap", .72, 1.0, .15, 0)],
        "type": [("tap", .62, 1.0 + .07 * i, .15, 0)], "whoosh": [("whoosh", .55, 1.0 + .05 * j, .35, -0.05)],
        "thud": [("thud", .55, 1.0, .2, 0)], "join": [("pop_a", .58, .9 + .07 * i, .25, 0)],
        "crown": [("reward", .3, 1.25, .35, 0)], "on": [("on", .6, 1.0, .2, 0)], "start": [("start", .5, 1.0, .3, 0)],
        "boom_soft": [("e_boom2", .42, 1.0, .35, 0)], "flip": [("flip", .85, 1.0 + .08 * j + .03 * i, .2, 0), ("swish3", .35, 1.0 + .05 * i, .15, 0)],
        "card_slap": [("flip", .5, .8, .25, 0), ("thud", .28, 1.1, .2, 0)],
        "deal": [("deal", .62, 1.0 + .08 * j, .2, 0)], "deal_odd": [("deal", .66, .78, .25, 0)],
        "check": [("react", .48, 1.25 + .05 * j, .2, 0)], "key": [("tap", .75, 1.05, .15, 0)],
        "lock": [("lock", .75, 1.0, .25, 0)], "stamp_soft": [("stamp3", .5, 1.0, .25, 0)],
        "title": [("swish4", .42, 1.1, .3, -0.03), ("pop_b", .3, 1.0, .25, 0)],
        "cell": [("pop_a", .42, 1.1 + .08 * j, .25, 0)],
        "reveal_big": [("e_boom1", .8, 1.0, .4, 0), ("flip", .45, .85, .3, 0), ("boom", .45, 1.0, .3, 0)],
        "crowd_oooh": [("oooh", .46, 1.0, .5, 0)], "react": [("react", .6, 1.0 + .12 * j, .25, 0)],
        "stamp": [("stamp", .88, 1.0, .3, 0)], "confirm": [("tap", .68, 1.0, .2, 0), ("pop_b", .36, 1.1, .2, 0)],
        "mini": [("pop_a", .45, 1.3 + .08 * j, .25, 0)], "drum": [("roll", .42, 1.0, .3, 0)],
        "roulette": [("tick_r", .62 * (0.7 + 0.3 * v), 1.0 + .04 * j, .25, 0)],
        "drop": [("swish1", .45, .8, .3, -0.08)], "boom": [("boom", .55, 1.0, .35, 0), ("e_boom3", .4, 1.0, .35, 0)],
        "verdict": [("stamp", .78, .9, .3, 0), ("e_boom1", .66, .9, .45, 0)],
        "crowd_cheer": [("cheer", .46, 1.0, .5, 0)], "reward": [("reward", .45, 1.0 + .04 * i, .3, 0)],
        "crowd_laugh": [("laugh", .56, 1.0, .45, 0)],
        "coins": [("reward", .26, 1.2, .3, 0), ("reward", .22, 1.35, .3, .08), ("reward", .18, 1.5, .3, .16)],
        "step": [("thud", .55, .9 + .1 * i, .25, 0)], "land": [("thud", .6, 1.0, .25, 0), ("pop_b", .3, .9, .2, 0)],
        "win": [("win", .62, 1.0, .35, 0)], "confetti": [("popper", .34, 1.0, .35, 0)],
        "whip": [("riser_s", .62, 1.0, .35, -0.06), ("whoosh", .5, .85, .35, 0)],
    }
    return R.get(kind, [])


HITS = {"logo_hit", "punch", "reveal_big", "verdict", "boom", "win", "crowd_oooh", "crowd_cheer", "crowd_laugh", "stamp", "lock"}


def main():
    dry = np.zeros((N, 2)); wet = np.zeros((N, 2)); duck = np.zeros(N)
    seen = {}
    for e in EV["events"]:
        k = e["kind"]; i = seen.get(k, 0); seen[k] = i + 1
        pan = float(e["pan"]) * 0.5
        for (src, g, r, send, off) in recipe(k, i, float(e.get("v", 1))):
            x = rate(SRC[src], r) * g * float(e.get("v", 1)) ** 0.5
            i0 = int((e["t"] + off) * SR)
            if i0 < 0: x = x[-i0:]; i0 = 0
            n = min(len(x), N - i0)
            L, Rr = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
            dry[i0:i0 + n, 0] += x[:n] * L; dry[i0:i0 + n, 1] += x[:n] * Rr
            wet[i0:i0 + n, 0] += x[:n] * L * send; wet[i0:i0 + n, 1] += x[:n] * Rr * send
        a0 = int(e["t"] * SR); duck[a0:a0 + int(0.12 * SR)] = np.maximum(duck[a0:a0 + int(0.12 * SR)], 1.0 if k in HITS else 0.45)
    room = np.stack([signal.fftconvolve(wet[:, c], IR[:, c])[:N] for c in (0, 1)], 1)
    sfx = dry + room * 0.8

    # ── the music, cut on its own grid ──
    tr = dec(ROOT / "audio/src/music/take1.mp3", 2)
    tf = np.arange(N) / SR
    src_i = np.clip(((tf + MUSIC_OFFSET) * SR).astype(int), 0, len(tr) - 1)
    mus = tr[src_i] * ((tf + MUSIC_OFFSET) * SR < len(tr))[:, None]
    lowp = np.stack([P.lp(mus[:, c], 900, 2) for c in (0, 1)], 1)
    def ramp(a, b): return np.clip((tf - a) / max(b - a, 1e-6), 0, 1)
    T = EV["T"]
    g = ramp(1.28, 1.62)                                                  # in with the pull-back (the cold open is quiet)
    seven = T["flip"]["יובל"]
    g *= 1 - ramp(seven - 0.36, seven - 0.32) * (1 - ramp(seven - 0.005, seven + 0.005))      # a stop before the 7
    sus0, sus1, verdict = T["drum"] - 0.05, T["figDrop"], T["verdict"]
    thin = ramp(sus0, sus0 + 0.25) * (1 - ramp(sus1, sus1 + 0.02))       # thinned under the drum and the spotlight
    g *= 1 - ramp(sus1, sus1 + 0.03) * (1 - ramp(verdict - 0.005, verdict + 0.005))         # the breath before "נתפס!"
    endhit = T["endPitch"] + 0.55
    g *= 1 - ramp(endhit + 0.35, endhit + 0.95)                           # the last bar rings, then out
    mix_m = mus * (1 - thin)[:, None] * 1.0 + lowp * thin[:, None] * 0.35
    # duck under the hits: 100 ms hold, ~350 ms release
    r_c = np.exp(-1 / (0.3 * SR))
    env = np.clip(signal.lfilter([1 - r_c], [1, -r_c], duck) * 1.5, 0, 1)
    gm = g * (1 - 0.5 * env)                                              # up to -6 dB under a hit, ~-2.5 under the rest
    section = np.where(tf < T["cells0"], 1.0, 0.72)                        # the full groove is louder: take 3 dB off it
    music = mix_m * (gm * section)[:, None] * 0.26                        # sits under the action sounds

    m = sfx + music
    m = np.stack([P.hp(m[:, c], 32) for c in (0, 1)], 1)[: int(SR * DUR)]
    out = master(m)
    wavfile.write(str(ROOT / "audio/mix.wav"), SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))
    # stems for checking balance
    wavfile.write(str(ROOT / "audio/stem_sfx.wav"), SR, (np.clip(sfx[: int(SR * DUR)] * 0.5, -1, 1) * 32767).astype(np.int16))
    wavfile.write(str(ROOT / "audio/stem_music.wav"), SR, (np.clip(music[: int(SR * DUR)] * 0.5, -1, 1) * 32767).astype(np.int16))
    print("wrote audio/mix.wav", loud(ROOT / "audio/mix.wav"))


def loud(path):
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]); tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
    return {"I": I, "TP": tp}


def limiter(x, ceil_db=-4.0):
    """Look-ahead peak limiter on a 4x oversampled detector."""
    c = 10 ** (ceil_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(1).reshape(-1, 4).max(1)[: len(x)]
    need = np.minimum(1, c / np.maximum(up, 1e-9))
    la = int(0.002 * SR)
    # min over a sliding window (look-ahead), then a smooth release
    from scipy.ndimage import minimum_filter1d
    gmin = minimum_filter1d(need, size=2 * la + 1)
    rel = np.exp(-1 / (0.06 * SR)); g = np.empty_like(gmin); cur = 1.0
    for i in range(len(gmin)):
        cur = gmin[i] if gmin[i] < cur else cur * rel + gmin[i] * (1 - rel)
        g[i] = cur
    return x * g[:, None]


def master(m):
    tmp = ROOT / "audio/.tmp.wav"
    wavfile.write(str(tmp), SR, (np.clip(m / (np.abs(m).max() + 1e-9) * 0.9, -1, 1) * 32767).astype(np.int16))
    L = loud(tmp)["I"]
    gain = 10 ** ((-16.0 - L) / 20) * 0.9 / (np.abs(m).max() + 1e-9)
    out = limiter(m * gain, -4.2)
    for _ in range(2):                                                   # the limiter costs loudness: correct and re-limit
        wavfile.write(str(tmp), SR, (np.clip(out, -1, 1) * 32767).astype(np.int16)); L2 = loud(tmp)["I"]
        out = limiter(out * 10 ** ((-16.0 - L2) / 20), -4.2)
    tmp.unlink(missing_ok=True)
    return out


if __name__ == "__main__":
    main()
