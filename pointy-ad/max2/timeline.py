"""The cut list of "This is Max." and every timed event on it, written to work/timeline.json.

Everything else reads that file: build.py (picture), overlay.html (subtitles, title card, outro),
screens (insert lengths) and mix.py (sound). Times are seconds on the output clock (48 fps);
clip ranges are source frames of the 24 fps Seedance drafts (or their 1080p finals, same frames).

The hyperlapse is cut on the music's beat grid (124 BPM, a beat every 0.4838 s, a downbeat at 0),
and the outro is placed so the cursor clicks the full stop of "easy to click." on the song's
final hit (34.83 s into the track).
"""
import json
import os

FPS = 48
SRC = 24
BEAT = 0.4838
MUSIC_HIT = 34.83          # the song's last hit, seconds into music/m1.mp3
HERE = os.path.dirname(os.path.abspath(__file__))


def q(t):                  # snap to the output frame grid
    return round(t * FPS) / FPS


segs = []
t = 0.0


def clip(id, src, a, b, **kw):
    global t
    d = (b - a) / SRC
    segs.append(dict(id=id, kind="clip", src=src, a=a, b=b, t0=q(t), t1=q(t + d), **kw))
    t = q(t + d)


def other(id, kind, d, **kw):
    global t
    segs.append(dict(id=id, kind=kind, t0=q(t), t1=q(t + d), **kw))
    t = q(t + d)


# act 1: Max, the problem
clip("s1", "g1", 0, 86)            # "This… is Max."
clip("s2", "g1", 86, 192)          # the spreadsheet, the sigh
clip("s3", "g1", 192, 256)         # the paper tower slams down (impact on source frame 200)
clip("s4", "g1", 262, 350)         # Max peeks around the tower
clip("s5", "g2", 0, 65)            # paw: option, then space (key hits on frames 20 and 44)
clip("s6", "g2eye", 72, 144)       # the eye, Pointy reflected in it

# act 2: the hyperlapse, cut on the beat; the music drops on its first frame
T_H = t
# g3 is one continuous 360° orbit (front, side, behind, other side, front; day to night), cut in order
plan = [("h1", "g3", 0, 4, {}), ("i1", "ins1", None, 4, {}), ("h2", "g3", 58, 3, {}),
        ("i2", "ins2", None, 3, {}), ("h3", "g3", 103, 3, {}), ("i3", "ins3", None, 2, {}),
        ("h4", "g3", 157, 3, {})]
beats = 0
for id, src, a, n, kw in plan:
    t0, t1 = q(T_H + beats * BEAT), q(T_H + (beats + n) * BEAT)
    if a is None:
        segs.append(dict(id=id, kind="insert", scene=src, t0=t0, t1=t1))
    else:
        segs.append(dict(id=id, kind="clip", src=src, a=a, b=a + int((t1 - t0) * SRC + .999), t0=t0, t1=t1, move=True, **kw))
    beats += n
t = q(T_H + beats * BEAT)

# act 3: the payoff
clip("s8", "g4", 0, 72)            # beer
clip("s9a", "g4b", 6, 140)         # the coworker glances, whip to the finished desk, whip back: impressed
clip("s9b", "g4", 220, 289)        # mid-whip from her to Max, smiling
other("card", "card", 1.75, text="Two weeks later.")
clip("s12", "g5", 12, 118)         # the poster
other("i4", "insert", 1.5, scene="hello")

# the outro starts so that its full-stop click lands on the song's last hit
OUTRO_CLICK = 2.95                 # seconds into the outro (keep in sync with overlay.html)
music_at = T_H
outro_at = q(music_at + MUSIC_HIT - OUTRO_CLICK)
wink_frames = round((outro_at - t) * SRC)
clip("s14", "g5", 118, 118 + wink_frames)   # the wink (source frames ~144-158)
outro_at = t                       # within a frame of the target; the click lands on the hit
other("outro", "outro", 4.6)
END = t

# narration: take A of vo/vo_a.mp3, cut into lines [start, end) in the take, and where each lands
VO = [
    dict(id="v1", a=0.05, b=0.95, at=0.45, text="This", style="big"),
    dict(id="v2", a=1.50, b=2.62, at=1.95, text="is Max.", style="big"),
    dict(id="v3", a=3.62, b=6.26, at=3.95, text="Max doesn't know how to make an Excel chart.", style="small"),
    dict(id="v4", a=7.02, b=9.42, at=14.55, text="Luckily, Max has Pointy.", style="small"),
    dict(id="v5", a=9.52, b=11.96, at=17.25, text="The AI that shows you where to click.", style="small"),
    dict(id="v6", a=12.50, b=13.36, at=outro_at + 1.22, text="Pointy.", style="none"),
    dict(id="v7", a=13.50, b=14.68, at=outro_at + 2.02, text="Easy to click.", style="none"),
]


def seg(id):
    return next(s for s in segs if s["id"] == id)


def at_src(id, frame):             # timeline time of a source frame inside a clip segment
    s = seg(id)
    return q(s["t0"] + (frame - s["a"]) / SRC)


SFX = [
    dict(name="sigh2_b", at=6.9, gain=.5),
    dict(name="slam", at=at_src("s3", 200), gain=.9),
    dict(name="key", at=at_src("s5", 20), gain=.5),
    dict(name="key", at=at_src("s5", 44), gain=.5),
    dict(name="riser", at=seg("s6")["t0"], gain=.45, end_at=T_H),
    dict(name="sip", at=seg("s8")["t0"] + .85, gain=.6),
    dict(name="whip", at=at_src("s9a", 38), gain=.5),
    dict(name="whip", at=at_src("s9a", 93), gain=.5),
    dict(name="whip", at=seg("s9b")["t0"] - .02, gain=.45),
    dict(name="pop", at=seg("i4")["t0"] + .12, gain=.26),
    dict(name="wood", at=seg("i4")["t0"] + .2, gain=.18),
    dict(name="wood", at=at_src("s14", 147), gain=.35),
]

out = dict(fps=FPS, src_fps=SRC, beat=BEAT, end=END, music_at=music_at, music_hit=MUSIC_HIT,
           outro_at=outro_at, outro_click=OUTRO_CLICK, segs=segs, vo=VO, sfx=SFX)
os.makedirs(os.path.join(HERE, "work"), exist_ok=True)
json.dump(out, open(os.path.join(HERE, "work", "timeline.json"), "w"), indent=1)
if __name__ == "__main__":
    for s in segs:
        extra = f"{s.get('src', s.get('scene', ''))} {s.get('a', '')}-{s.get('b', '')}" if s["kind"] != "card" else s["text"]
        print(f"{s['id']:6} {s['kind']:7} {s['t0']:7.3f} → {s['t1']:7.3f}  ({s['t1'] - s['t0']:.3f}s)  {extra}")
    print(f"music from {music_at:.3f}, outro at {outro_at:.3f}, end {END:.3f}")
