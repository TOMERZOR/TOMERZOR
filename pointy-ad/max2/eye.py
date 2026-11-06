"""Puts the laptop screen, with Pointy on it, into the reflection in Max's eye (the macro shot of G2).

Seedance drew a dark screen-shaped reflection with an orange point in the cornea. We replace it with
the real screen (screens/index.html, scene "eye": the ask bar opens, the orange cursor glides in and
clicks) seen in a curved mirror: flipped left-right, bent like a cornea, dimmed and warmed, screen-
blended so the eye's own highlights stay on top. The eye is tracked through the slow push-in with ECC
(affine), so the reflection stays glued to the cornea.

usage: python3 eye.py <g2.mp4> <screen frames dir> <out.mp4>
"""
import glob
import os
import subprocess
import sys

import cv2
import numpy as np

src, scr_dir, dst = sys.argv[1:4]
REF = 72                    # the frame the reflection is laid out on (the first frame used in the edit)
FIRST, LAST = 66, 168       # the eye shot inside g2

cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
H, W = frames[0].shape[:2]
sx, sy = W / 854, H / 480   # the layout below is measured on the 854×480 draft

# where the screen's reflection sits on the cornea in frame REF (854×480 coordinates): the dark
# screen-shaped patch Seedance drew around its orange point at (458, 238)
cx, cy, rw, rh = 452 * sx, 229 * sy, 124 * sx, 78 * sy
QUAD = np.float32([[cx - rw / 2, cy - rh / 2 + 3 * sy], [cx + rw / 2, cy - rh / 2], [cx + rw / 2 + 4 * sx, cy + rh / 2], [cx - rw / 2 - 2 * sx, cy + rh / 2 + 3 * sy]])

# track the eye from REF outwards with ECC (affine), warm-started from the neighbouring frame
def gray(f):
    return cv2.GaussianBlur(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (0, 0), 1.2 * sx).astype(np.float32) / 255

mask = np.zeros((H, W), np.uint8)
cv2.ellipse(mask, (int(cx), int(cy + 10 * sy)), (int(230 * sx), int(150 * sy)), 0, 0, 360, 255, -1)
tmpl = gray(frames[REF])
warps = {REF: np.eye(2, 3, dtype=np.float32)}
crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 80, 1e-5)
for rng_ in (range(REF + 1, LAST + 1), range(REF - 1, FIRST - 1, -1)):
    prev = REF
    for k in rng_:
        w = warps[prev].copy()
        try:
            _, w = cv2.findTransformECC(tmpl, gray(frames[k]), w, cv2.MOTION_AFFINE, crit, mask, 5)
        except cv2.error:
            pass
        warps[k] = w
        prev = k
print("tracked", len(warps), "frames; scale at the end ≈ %.3f" % np.sqrt(abs(np.linalg.det(warps[LAST][:, :2]))))

# the reflection: the screen flipped, bent like a convex mirror, warm and dim
RW, RH = 320, 200
uu, vv = np.meshgrid(np.linspace(-1, 1, RW), np.linspace(-1, 1, RH))
rr = uu ** 2 * .9 + vv ** 2
bend = 1 + .22 * rr                                   # barrel: the edges of the screen fall away round the cornea
mapx = ((uu * bend + 1) / 2 * (1440 - 1)).astype(np.float32)
mapy = ((vv * bend + 1) / 2 * (900 - 1)).astype(np.float32)
edge = np.clip((1 - np.maximum(np.abs(uu * bend), np.abs(vv * bend))) / .08, 0, 1).astype(np.float32)


def reflection(scr):
    r = cv2.remap(scr, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    r = cv2.flip(r, 1).astype(np.float32) / 255
    r = r * edge[..., None]
    # the orange of Pointy reads first in a reflection: let it bloom
    b, g, rr_ = cv2.split(r)
    orange = np.clip((rr_ - b) * 1.6 - .25, 0, 1)[..., None] * np.array([.25, .6, 1.0], np.float32)
    r = np.power(r, 1.25) * np.array([.4, .47, .55], np.float32) + orange * .55 + cv2.GaussianBlur(orange, (0, 0), 7) * 1.4
    return r


scr_files = sorted(glob.glob(os.path.join(scr_dir, "f*_0.png")))
dst_quad = None
src_quad = np.float32([[0, 0], [RW - 1, 0], [RW - 1, RH - 1], [0, RH - 1]])
ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p", dst], stdin=subprocess.PIPE)
for k, f in enumerate(frames):
    if k in warps:
        A = np.vstack([warps[k], [0, 0, 1]])           # ECC's warp maps template (REF) coords to frame-k coords
        q = cv2.perspectiveTransform(QUAD[None], A)[0]
        i = int(np.clip(k - REF, 0, len(scr_files) - 1))
        ref = reflection(cv2.imread(scr_files[i]))
        M = cv2.getPerspectiveTransform(src_quad, q.astype(np.float32))
        lay = cv2.warpPerspective(ref, M, (W, H), flags=cv2.INTER_LINEAR)
        lay = cv2.GaussianBlur(lay, (0, 0), .9 * sx)
        alpha = cv2.warpPerspective(np.ones((RH, RW), np.float32), M, (W, H))
        alpha = cv2.GaussianBlur(alpha, (0, 0), 2.5 * sx)[..., None]
        base = f.astype(np.float32) / 255
        # darken Seedance's own reflection under ours, then screen ours on top
        base = base * (1 - .8 * alpha)
        out = 1 - (1 - base) * (1 - np.clip(lay, 0, 1) * alpha)
        f = np.clip(out * 255 + .5, 0, 255).astype(np.uint8)
    ff.stdin.write(f.tobytes())
ff.stdin.close()
ff.wait()
print("wrote", dst)
