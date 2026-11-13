#!/usr/bin/env python3
"""השתול · the soundtrack, scored from the picture.

Times come from the composition (audio/events.json, written by tools/dump_events.py from window.__events()), so a
retimed beat takes its sound with it. Sources: the game's own sound set (audio/game/, from hashtul.onrender.com/sfx),
ElevenLabs sound-effect takes (audio/src/eleven/), and an original instrumental (audio/src/music/take1.mp3,
ElevenLabs Music v2.5 via Higgsfield). Everything shares one synthetic room (onetake's sfx_palette), the music is cut
on its own beat grid and ducked under the hits, and the mix is mastered to -16 LUFS with a -4 dBTP ceiling.

usage: python3 audio/score.py [events.json] [mix.wav]   → audio/mix.wav (48 kHz stereo)
       python3 audio/score.py audio/events_clean.json audio/mix_clean.wav   (the clean cut)
       python3 audio/score.py shorts/s1/events.json shorts/s1/mix.wav      (any other composition)

events.json: {"T": {"dur": seconds, ...}, "events": [{"t", "kind", "pan", "v"}, ...], "music": {...} (optional)}
  Event kinds are the keys of recipe(); an unknown kind is warned about once and skipped.
  Stems: audio/stem_sfx.wav + audio/stem_music.wav when the mix is written into audio/, otherwise
  <mix>_stem_sfx.wav + <mix>_stem_music.wav next to the mix.

Without a "music" object the film's own edit is used (keyed on the film's T: flip.יובל, drum, figDrop, verdict,
endPitch, cells0). With one, it is the music plan. All times are film seconds; "track" is take1.mp3 seconds.
  "music": {
    "segments": [{"t0": 0, "t1": 10, "track": 6.557, "gain": 1.0}, ...]
        which part of the track plays when: track time = track + (t - t0) inside [t0, t1). Adjacent segments
        (t1 of one == t0 of the next) join with an equal-power crossfade of `xfade` s that ENDS `xlead` s before
        the join, so the new bar's downbeat (whose attack leads the nominal grid by ~33 ms in take1) is heard
        whole and the old bar's next attack is never heard. A segment with no neighbour starts/stops with a
        3 ms ramp. "gain" (optional, default 1) is a per-segment level (take1's intro is ~10 dB below its groove).
        Joins go on film bar lines (even seconds) and on a chord line of the track (take1 changes chord every 1 s,
        at 0.557 + k; its bar lines are 0.557 + 2k, its 4-bar phrase starts 0.557 + 8k). The script warns when a
        segment is off the beat grid or a join is not on both. See shorts/MUSIC.md for which joins are seamless.
    "in":    [a, b]              fade-in ramp (optional; default: full level from the first segment)
    "stops": [[a, b], ...]       music gain -> 0 from a (20 ms ramp ending at a) to b (back in 10 ms centred on b):
                                 the breath before a hit. 4-number form [a0, a1, b0, b1]: down over a0..a1, up over b0..b1.
    "thin":  [[a, b], ...]       low-passed (900 Hz) and lowered (x0.35), the suspense treatment under the film's drum
                                 roll: in over 0.25 s from a, out over 0.02 s at b. 4-number form as for stops.
    "brakes": [[a, b, back], ...]  tape stop: the music slows to a halt between a and b (pitch falls with it), is
                                 silent until `back`, and comes back at full speed at `back` on the track time the
                                 segments say (so `back` should be a bar/beat line). Pair with the "scratch" kind.
    "out":   [a, b]              final fade (optional). Default: the track's own ending rings; only the last 0.15 s
                                 before the film's end is faded so the cut cannot click.
    "gain":  0.26                bed level under the action sounds (default 0.26, the film's).
    "sections": [[t, gain], ...] optional section gains from time t on (applied in order).
    "nudge": 0.0                 delay the whole music by this many s (segments and joins move with it; stops/thin/in/
                                 out stay in film time). take1's attacks lead its nominal grid by ~31-33 ms in the
                                 groove; nudge 0.03 puts them on the film grid.
    "xfade": 0.02, "xlead": 0.04 join crossfade length and how far before the join it ends.
    "file": "audio/src/music/take1.mp3"
  }
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
EV_PATH = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "audio/events.json")
MIX_PATH = ROOT / (sys.argv[2] if len(sys.argv) > 2 else "audio/mix.wav")
EV = json.loads(EV_PATH.read_text())
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

# ── sources for the kinds added for the shorts. Their own generator, so the film's random draws are untouched. ──
rng2 = np.random.default_rng(57)


def scratch():
    """A record scratch: a short grain of noisy 'vinyl' tone dragged back and forth (pitch follows the hand)."""
    n = int(SR * 0.34); t = np.arange(n) / SR
    v = np.interp(t, [0, .06, .13, .2, .34], [0, 1, -0.6, 1.2, 0])          # hand speed
    f = 300 + 1100 * np.abs(v); ph = np.cumsum(2 * np.pi * f / SR)
    tone = np.sign(np.sin(ph)) * 0.35 + np.sin(ph)
    noise = P.sweep_bp(rng2.standard_normal(n), 900, 2600, 1.4)
    y = P.sat((tone * 0.5 + noise * 0.8) * (0.15 + np.abs(v)), 2.0)
    y = P.bp(y, 1400, 0.7) * np.r_[np.linspace(0, 1, 96), np.ones(n - 96 - 960), np.linspace(1, 0, 960)]
    return y / np.abs(y).max()


def heartbeat():
    """Lub-dub: two felt sub thumps 0.28 s apart."""
    a = P.sub(55, 0.35); b = P.sub(48, 0.45) * 0.7; y = np.zeros(int(SR * 0.75))
    y[:len(a)] += a; i = int(0.28 * SR); y[i:i + len(b)] += b[: len(y) - i]
    return P.lp(y, 400) / np.abs(y).max()


def shutter():
    """A camera shutter: two clacks 45 ms apart, bright snap over a small wooden body."""
    y = np.zeros(int(SR * 0.16))
    for d, g in ((0.0, 1.0), (0.045, 0.75)):
        k = P.wood(900, 0.06) * 0.5 + P.hp(rng2.standard_normal(int(0.06 * SR)), 2500) * np.exp(-np.arange(int(0.06 * SR)) / SR * 160)
        i = int(d * SR); y[i:i + len(k)] += k[: len(y) - i] * g
    return y / np.abs(y).max()


def countblip(f=1046.5):
    """The countdown blip: a short struck tone over a wood knock (the 3-2-1 under a timer)."""
    y = P.glass(f, 0.35, 0.6); w = P.wood(f / 4, 0.12); y[:len(w)] += 0.6 * w
    return y / np.abs(y).max()


SRC["scratch"] = scratch(); SRC["heart"] = heartbeat(); SRC["shutter"] = shutter(); SRC["blip"] = countblip()
SRC["ding"] = (lambda y: y / np.abs(y).max())(P.glass(1318.5, 1.0, 0.8) + 0.6 * np.r_[P.glass(1975.5, 0.8, 0.5), np.zeros(SR // 5)])
SRC["buzz"] = clean(dec(G / "alarm.mp3"), end=0.5, fade=0.08)
SRC["off"] = clean(dec(G / "off.wav"))
SRC["riser_bar"] = clean(dec(EL / "riser_1.mp3"), thr=0.002, end=2.1, fade=0.03)   # a 2 s build that peaks at its end
RISER_BAR_PK = int(np.argmax(np.abs(signal.hilbert(SRC["riser_bar"])) > 0.7)) / SR   # where it peaks (placed on t)
SRC["riser_long"] = clean(dec(EL / "riser_4.mp3"), thr=0.01, end=3.0, fade=0.1)    # a long airy swell, 3 s
SRC["laugh_b"] = clean(dec(EL / "crowd_laugh_1.mp3"), fade=0.3)
SRC["laugh_c"] = clean(dec(EL / "crowd_laugh_2.mp3"), fade=0.3)
SRC["cheer_b"] = clean(dec(EL / "crowd_cheer_2.mp3"), fade=0.3)
SRC["oooh_b"] = clean(dec(EL / "crowd_oooh_1.mp3"), end=1.4, fade=0.3)


def rate(x, r):
    if abs(r - 1) < 1e-3: return x
    n = int(len(x) / r); return np.interp(np.arange(n) * r, np.arange(len(x)), x)


# kind → layers (source, gain, playback rate, room send, offset s). Rates vary a little so nothing repeats exactly.
def recipe(kind, i, v):
    j = (rng.random() - 0.5)
    return _table(i, v, j).get(kind, [])


def _table(i, v, j):
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
        # ── added for the shorts (new kinds only; nothing above changed) ──
        "count": [("blip", .42, 1.0, .25, 0), ("tick", .3, 1.2, .15, 0)],                     # 3-2-1 blips, i-th call
        "count_go": [("blip", .5, 2.0, .3, 0), ("start", .45, 1.0, .3, 0), ("e_boom2", .3, 1.1, .3, 0)],
        "scratch": [("scratch", .5, 1.0 + .04 * j, .15, 0)],
        "buzz": [("buzz", .42, 1.0, .25, 0)], "wrong": [("off", .6, .9, .2, 0), ("buzz", .25, .85, .25, 0)],
        "ding": [("ding", .42, 1.0, .4, 0)], "heartbeat": [("heart", .45, 1.0, .1, 0)],
        "shutter": [("shutter", .5, 1.0 + .03 * j, .2, 0)],
        "riser_bar": [("riser_bar", .4, 1.0, .45, -RISER_BAR_PK)], "riser_long": [("riser_long", .35, 1.0, .5, 0)],
        "crowd_laugh_b": [("laugh_b", .5, 1.0, .45, 0)], "crowd_cheer_b": [("cheer_b", .46, 1.0, .5, 0)],
        "crowd_oooh_b": [("oooh_b", .44, 1.0, .5, 0)],
        "bubble": [("pop_b", .55, 1.0 + .05 * j, .25, 0), ("pop_a", .45, .9, .2, 0)],          # a speech bubble / sticker popping in
        "crowd_laugh_c": [("laugh_c", .5, 1.0, .45, 0)],                                     # a third laugh take (1 s)
    }
    return R


KINDS = set(_table(0, 1.0, 0.0))


HITS = {"logo_hit", "punch", "reveal_big", "verdict", "boom", "win", "crowd_oooh", "crowd_cheer", "crowd_laugh", "stamp", "lock",
        "count_go", "buzz", "wrong", "scratch", "crowd_laugh_b", "crowd_laugh_c", "crowd_cheer_b", "crowd_oooh_b"}


def main():
    dry = np.zeros((N, 2)); wet = np.zeros((N, 2)); duck = np.zeros(N)
    seen = {}; warned = set()
    for e in EV["events"]:
        k = e["kind"]
        if k not in KINDS:
            if k not in warned: print(f"warning: unknown event kind {k!r}: skipped", file=sys.stderr); warned.add(k)
            continue
        i = seen.get(k, 0); seen[k] = i + 1
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
    tf = np.arange(N) / SR
    plan = EV.get("music") or legacy_plan(EV["T"])
    music = render_music(plan, tf, duck)

    m = sfx + music
    m = np.stack([P.hp(m[:, c], 32) for c in (0, 1)], 1)[: int(SR * DUR)]
    out = master(m)
    wavfile.write(str(MIX_PATH), SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))
    # stems for checking balance
    if MIX_PATH.resolve().parent == ROOT / "audio": st = {"sfx": ROOT / "audio/stem_sfx.wav", "music": ROOT / "audio/stem_music.wav"}
    else: st = {k: MIX_PATH.with_name(f"{MIX_PATH.stem}_stem_{k}.wav") for k in ("sfx", "music")}
    wavfile.write(str(st["sfx"]), SR, (np.clip(sfx[: int(SR * DUR)] * 0.5, -1, 1) * 32767).astype(np.int16))
    wavfile.write(str(st["music"]), SR, (np.clip(music[: int(SR * DUR)] * 0.5, -1, 1) * 32767).astype(np.int16))
    print("wrote", MIX_PATH, loud(MIX_PATH))


def legacy_plan(T):
    """The film's own music edit, as a plan (4-number ramps reproduce the original arithmetic exactly)."""
    seven = T["flip"]["יובל"]
    sus0, sus1, verdict = T["drum"] - 0.05, T["figDrop"], T["verdict"]
    endhit = T["endPitch"] + 0.55
    return {"segments": [{"t0": 0.0, "t1": float("inf"), "track": MUSIC_OFFSET}],
            "in": [1.28, 1.62],                                                     # in with the pull-back
            "stops": [[seven - 0.36, seven - 0.32, seven - 0.005, seven + 0.005],     # a stop before the 7
                      [sus1, sus1 + 0.03, verdict - 0.005, verdict + 0.005]],         # the breath before "נתפס!"
            "thin": [[sus0, sus0 + 0.25, sus1, sus1 + 0.02]],                       # under the drum and the spotlight
            "out": [endhit + 0.35, endhit + 0.95],                                  # the last bar rings, then out
            "sections": [[T["cells0"], 0.72]],                                      # the full groove is louder
            "gain": 0.26, "_legacy": True}


TRACK_GRID0, TRACK_BEAT = 0.557, 0.5                                       # take1: beats at 0.557 + 0.5 k, bars of 4


def _warn_grid(segs, path):
    if not str(path).endswith("take1.mp3"): return
    def off(x, p): r = (x - TRACK_GRID0) % p; return min(r, p - r)
    for k, sg in enumerate(segs):
        if off(sg["track"] - sg["t0"], TRACK_BEAT) > 0.002:
            print(f"warning: music segment {k} is off the beat grid (track - t0 = {sg['track'] - sg['t0']:.3f})", file=sys.stderr)
        if k and segs[k - 1]["t1"] == sg["t0"] and (abs(sg["t0"] / 2 - round(sg["t0"] / 2)) > 1e-3 or off(sg["track"], 2 * TRACK_BEAT) > 0.002):
            print(f"warning: music join at {sg['t0']} s is not on a film bar line (even s) or not on a track chord line (0.557 + k)", file=sys.stderr)


def render_music(plan, tf, duck):
    """Render a music plan (see the docstring) to an (N, 2) bed, ducked under the hits."""
    path = ROOT / plan.get("file", "audio/src/music/take1.mp3")
    tr = dec(path, 2)
    legacy = plan.get("_legacy", False)
    def ramp(a, b): return np.clip((tf - a) / max(b - a, 1e-6), 0, 1)
    def window(w, d_in, d_out):                          # 1 inside [a, b] with the ramps of `stops`/`thin`
        if len(w) == 4: a0, a1, b0, b1 = w
        else: a, b = w; a0, a1, b0, b1 = a - d_in[0], a + d_in[1], b - d_out[0], b + d_out[1]
        return ramp(a0, a1) * (1 - ramp(b0, b1))
    segs = sorted(plan["segments"], key=lambda z: z["t0"])
    if not legacy: _warn_grid(segs, path)
    nudge = float(plan.get("nudge", 0.0)); xf = float(plan.get("xfade", 0.02)); xl = float(plan.get("xlead", 0.04))
    tm = tf - nudge                                                       # music time (segments and joins live here)
    # tape stops: warp music time inside [a, b] (speed 1 → 0), silence until `back`
    brake_g = np.ones(N); frac = np.zeros(N, bool)
    for a, b, back in plan.get("brakes", []):
        u = np.clip((tf - a) / (b - a), 0, 1); inb = (tf >= a) & (tf < b)
        tm = np.where(inb, (a - nudge) + (b - a) * (u - u * u / 2), tm); frac |= inb
        brake_g *= 1 - ramp(b - 0.012, b) * (1 - ramp(back - 0.003, back))
        brake_g *= 1 - 0.5 * ramp(a + 0.6 * (b - a), b)                  # the last of it sinks a little
    mus = np.zeros((N, 2))
    for k, sg in enumerate(segs):
        t0, t1 = float(sg["t0"]), float(sg["t1"])
        st = (tm - t0) + float(sg["track"])                              # track time
        prev = k > 0 and segs[k - 1]["t1"] == sg["t0"]; nxt = k + 1 < len(segs) and segs[k + 1]["t0"] == sg["t1"]
        if legacy:
            w = None
        else:
            def ep(c, s): return np.clip((tm - c) / s, 0, 1)
            a = ep(t0 - xl - xf, xf) if prev else (ep(t0 - xl, 0.003) if t0 > 0 else 1.0)
            a = np.sin(0.5 * np.pi * a) if prev else a
            b_ = ep(t1 - xl - xf, xf) if nxt else ep(t1 - xl - 0.003, 0.003)
            b_ = np.cos(0.5 * np.pi * b_) if nxt else 1 - b_
            if t1 == float("inf"): b_ = 1.0
            w = a * b_ * float(sg.get("gain", 1.0))
        live = (st * SR < len(tr)) & (st >= 0)
        si = np.clip((st * SR).astype(int), 0, len(tr) - 1)
        x = tr[si]
        if frac.any():                                                    # fractional reads inside a brake
            ff = np.clip(st[frac] * SR, 0, len(tr) - 1); i0 = ff.astype(int); i1 = np.minimum(i0 + 1, len(tr) - 1); d = (ff - i0)[:, None]
            x[frac] = tr[i0] * (1 - d) + tr[i1] * d
        seg = x * live[:, None]
        mus += seg if w is None else seg * (w * 1.0 if np.ndim(w) else np.full(N, w))[:, None]
    lowp = np.stack([P.lp(mus[:, c], float(plan.get("thin_lp", 900)), 2) for c in (0, 1)], 1)
    g = ramp(*plan["in"]) if plan.get("in") else np.ones(N)
    for w in plan.get("stops", []): g *= 1 - window(w, (0.02, 0.0), (0.005, 0.005))
    thin = np.zeros(N)
    for w in plan.get("thin", []): thin = np.maximum(thin, window(w, (0.0, 0.25), (0.0, 0.02)))
    if plan.get("out"): g *= 1 - ramp(*plan["out"])
    elif not legacy: g *= 1 - ramp(DUR - 0.15, DUR)
    if not legacy: g *= ramp(0.0, 0.002)                                  # never start on a click
    if plan.get("brakes"): g *= brake_g
    mix_m = mus * (1 - thin)[:, None] * 1.0 + lowp * thin[:, None] * float(plan.get("thin_gain", 0.35))
    # duck under the hits: 100 ms hold, ~350 ms release
    r_c = np.exp(-1 / (0.3 * SR))
    env = np.clip(signal.lfilter([1 - r_c], [1, -r_c], duck) * 1.5, 0, 1)
    gm = g * (1 - 0.5 * env)                                              # up to -6 dB under a hit, ~-2.5 under the rest
    section = np.ones(N)
    for t, sgain in plan.get("sections", []): section = np.where(tf < t, section, sgain)
    return mix_m * (gm * section)[:, None] * float(plan.get("gain", 0.26))  # sits under the action sounds


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
