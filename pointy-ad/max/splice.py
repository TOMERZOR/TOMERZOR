"""Replaces the last shot of the Max clip with a re-shot one (the poster printed in Hebrew from the start),
and prints where the poster sits near the end, in 1920×1080 coordinates, for the cursor click in edit.cjs.

usage: python3 splice.py <main.mp4> <new_last_shot.mp4> <out.mp4>
"""
import subprocess
import sys

import cv2
import numpy as np

main, shot, out = sys.argv[1:4]


def frames_of(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    fs = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        fs.append(f)
    return fs, fps


fs, fps = frames_of(main)
small = [cv2.resize(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (96, 54)).astype(np.float32) for f in fs]
diff = np.array([0] + [np.mean(np.abs(small[i] - small[i - 1])) for i in range(1, len(small))])
cut = int(np.argmax(np.where(np.arange(len(diff)) > len(diff) * .6, diff, 0)))
t_cut = cut / fps
print(f"last shot of the main clip starts at frame {cut} ({t_cut:.3f}s)")

W, H = fs[0].shape[1], fs[0].shape[0]
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", main, "-i", shot, "-filter_complex",
                f"[0:v]trim=end_frame={cut},setpts=PTS-STARTPTS,fps={fps}[a];[0:a]atrim=end={cut / fps:.6f},asetpts=PTS-STARTPTS,aresample=48000[aa];"
                f"[1:v]scale={W}:{H},setsar=1,fps={fps},setpts=PTS-STARTPTS[b];[1:a]aresample=48000,asetpts=PTS-STARTPTS[ba];"
                "[a][aa][b][ba]concat=n=2:v=1:a=1[v][au]",
                "-map", "[v]", "-map", "[au]", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out], check=True)

# the poster near the end of the new shot: the biggest dark, roughly 3:4 component (its black frame)
ns, _ = frames_of(shot)
ref = ns[int(len(ns) * .85)]
gray = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
n, lab, stats, _ = cv2.connectedComponentsWithStats((gray < 70).astype(np.uint8), 8)
h0, w0 = gray.shape
best = None
for i in range(1, n):
    x, y, w, h, a = stats[i]
    if w > w0 * .06 and h > h0 * .15 and .5 < w / h < 1.05 and (best is None or w * h > best[2] * best[3]):
        best = (x, y, w, h)
if best:
    x, y, w, h = best
    print(f"TARGET {round((x + w / 2) * 1920 / w0)},{round((y + h * .45) * 1080 / h0)}")
print("wrote", out)
