"""Cuts the picture of "This is Max." from work/timeline.json: 1920×1080 at 48 fps, no titles, no sound.

Clips are read frame-exactly (source frame a + output frame // 2, since 48 = 2 × 24), so a cut can
never pull in a stray frame. The hyperlapse plates (one 360° orbit, cut in four on the beat) get a
slight push-in. The card is black; the outro runs the end of the wink shot on and holds it (the
outro wipes it away).

usage: python3 build.py <out.mp4> [clips dir] [inserts dir]
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]
clips = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "clips")
inserts = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "work")
TL = json.load(open(os.path.join(HERE, "work", "timeline.json")))
W, H, FPS = 1920, 1080, TL["fps"]

# hyperlapse: the orbit is in the footage now; each plate only gets a slight push-in
MOVES = {h: ((1.0, 1.035), (0.0, 0.0), (0.0, 0.0)) for h in ("h1", "h2", "h3", "h4")}


class Reader:
    def __init__(self, path):
        self.cap = cv2.VideoCapture(path)
        self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.pos, self.last = None, None

    def frame(self, i):
        i = min(i, self.n - 1)
        if self.pos is None or i < self.pos or i > self.pos + 30:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            self.pos = i - 1
        while self.pos < i:
            ok, f = self.cap.read()
            if not ok:
                break
            self.pos += 1
            self.last = f
        return self.last


readers = {}


def reader(path):
    if path not in readers:
        readers[path] = Reader(path)
    return readers[path]


def fit(f, move=None, u=0.0, flip=False):
    h, w = f.shape[:2]
    if flip:
        f = cv2.flip(f, 1)
    if move is None:
        return cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4) if (w, h) != (W, H) else f
    (z0, z1), (r0, r1), (d0, d1) = move
    z, r, d = z0 + (z1 - z0) * u, r0 + (r1 - r0) * u, d0 + (d1 - d0) * u
    s = z * W / w
    M = cv2.getRotationMatrix2D((w / 2 + d * w, h / 2), r, s)
    M[0, 2] += W / 2 - (w / 2 + d * w)
    M[1, 2] += H / 2 - h / 2
    return cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)


ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                       "-i", "-", "-c:v", "libx264", "-crf", "13", "-preset", "medium", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
black = np.zeros((H, W, 3), np.uint8)
total = 0
for s in TL["segs"]:
    n = round(s["t1"] * FPS) - round(s["t0"] * FPS)
    for j in range(n):
        if s["kind"] == "clip":
            f = reader(os.path.join(clips, s["src"] + ".mp4")).frame(s["a"] + j // 2)
            f = fit(f, MOVES.get(s["id"]) if s.get("move") else None, j / max(1, n - 1), s.get("flip", False))
        elif s["kind"] == "insert":
            f = fit(reader(os.path.join(inserts, s["scene"] + ".mp4")).frame(j // 2))
        elif s["kind"] == "card":
            f = black
        else:                                   # outro: the wink shot runs on, then holds
            f = fit(reader(os.path.join(clips, "g5.mp4")).frame(170 + j // 2))
        ff.stdin.write(np.ascontiguousarray(f).tobytes())
    total += n
    print(f"{s['id']:6} {n:4d} frames", flush=True)
ff.stdin.close()
ff.wait()
print(f"wrote {out}: {total} frames, {total / FPS:.3f}s")
