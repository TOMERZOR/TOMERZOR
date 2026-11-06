"""Turns rendered laptop-screen frames into footage of that screen shot up close with a cinema camera.

For every output pixel we find the point of the screen it sees (a hand-held camera: the pan/zoom from
cams.json, a slight tilt and keystone, a little shake) and light only the sub-pixel stripe there, so
the RGB pixel grid of the panel shows, with the moiré you get when a sensor samples it. Then the lens
and the camera: a tilted plane of focus, a short focus hunt as the shot starts, bloom, chromatic
aberration, vignette and grain. Three sub-frames per frame blend into motion blur.

usage: python3 filmed.py <framesdir> <out.mp4> [seed]
"""
import glob
import json
import os
import subprocess
import sys

import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1
rng = np.random.default_rng(seed)
W, H = 1920, 1080
SS = 2                                            # supersampling of the sub-pixel pattern
cams = json.load(open(os.path.join(src, "cams.json")))
n = len(cams)

# hand-held drift: a few slow sines per axis, random phases
ph = rng.uniform(0, 2 * np.pi, (3, 3))
fr = np.array([.7, 1.3, 2.9])


def shake(t):
    s = np.sin(2 * np.pi * fr[None, :] * t + ph).dot(np.array([1, .45, .15]))
    return s[0] * 3.2, s[1] * 2.4, s[2] * .35      # screen px, screen px, degrees


uu, vv = np.meshgrid((np.arange(W * SS, dtype=np.float32) + .5) / SS, (np.arange(H * SS, dtype=np.float32) + .5) / SS)


def homography(cx, cy, w, t):
    dx, dy, dr = shake(t)
    s = W / w
    th = np.radians(-1.6 + dr)
    T1 = np.array([[1, 0, -(cx + dx)], [0, 1, -(cy + dy)], [0, 0, 1]], float)
    S = np.diag([s, s, 1.0])
    R = np.array([[np.cos(th), -np.sin(th), 0], [np.sin(th), np.cos(th), 0], [0, 0, 1]])
    K = np.array([[1, 0, 0], [0, 1, 0], [.00006, -.00011, 1]])        # the camera is a little below and left of square-on
    T2 = np.array([[1, 0, W / 2], [0, 1, H / 2], [0, 0, 1]], float)
    return T2 @ K @ R @ S @ T1


def stripe(f, a, b, soft=.06):
    return np.clip((f - a) / soft, 0, 1) * np.clip((b - f) / soft, 0, 1)


# the panel's sub-pixel layout as lookup tables over the position inside a pixel (64 steps):
# three vertical stripes, B G R from the right, with a dark gap between pixel rows. A floor keeps
# the pattern a texture rather than a grille, as it reads through a real lens.
L = 64
f = (np.arange(L) + .5) / L
COLS = (.26 + .74 * np.stack([stripe(f, .69, .97), stripe(f, .36, .64), stripe(f, .03, .31)], -1)).astype(np.float32)  # B, G, R
ROWS = (.38 + .62 * stripe(f, .08, .92)).astype(np.float32)
GAIN = 1.0 / float(COLS.mean(0).mean() * ROWS.mean())


def panel(screen, Hm):
    """What the sensor sees of the panel: each output pixel samples one sub-pixel stripe."""
    Hi = np.linalg.inv(Hm).astype(np.float32)
    d = Hi[2, 0] * uu + Hi[2, 1] * vv + Hi[2, 2]
    sx = (Hi[0, 0] * uu + Hi[0, 1] * vv + Hi[0, 2]) / d
    sy = (Hi[1, 0] * uu + Hi[1, 1] * vv + Hi[1, 2]) / d
    pix = cv2.remap(screen, sx - .5, sy - .5, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    ix = ((sx - np.floor(sx)) * L).astype(np.int32)
    iy = ((sy - np.floor(sy)) * L).astype(np.int32)
    img = pix * COLS[ix] * (ROWS[iy] * GAIN)[..., None]
    img = cv2.GaussianBlur(img, (0, 0), .38 * SS)           # the lens' own softness: an optical low-pass
    return cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
vign = (1 - .2 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.4).clip(.3, 1)[..., None]
HUNT = [7, 5.2, 3.6, 2.2, 1.1, .5, 1.0, 1.25, .8, .35, .1, 0]     # focus hunt at the head of the shot (σ, px)


def lens(img, i, t):
    # tilted focal plane: sharp along a line through the middle, softer towards top and bottom
    dist = np.abs((yy - H * .52) + (xx - W / 2) * .12) / (H / 2)
    b1, b2 = cv2.GaussianBlur(img, (0, 0), 2.2), cv2.GaussianBlur(img, (0, 0), 5.5)
    k = np.clip(dist * 1.6 - .25, 0, 2)[..., None]
    img = np.where(k < 1, img * (1 - k) + b1 * k, b1 * (2 - k) + b2 * (k - 1))
    if i < len(HUNT) and HUNT[i] > 0:
        img = cv2.GaussianBlur(img, (0, 0), HUNT[i])
    # glass: soft halation round bright UI, chromatic aberration at the edges
    lum = img.max(2, keepdims=True)
    img = img + cv2.GaussianBlur(np.clip(img - .62, 0, None), (0, 0), 22) * .55 + cv2.GaussianBlur(img, (0, 0), 40) * .06
    b, g, r = cv2.split(img)
    def scale(ch, s):
        M = np.array([[s, 0, W / 2 * (1 - s)], [0, s, H / 2 * (1 - s)]], np.float32)
        return cv2.warpAffine(ch, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    img = cv2.merge([scale(b, .9978), g, scale(r, 1.0024)])
    # a little screen glare and black lift, exposure breathing, vignette, tone curve, grain
    img = img * (1 + .02 * np.sin(t * 7.3)) + .015 + .025 * np.clip(1 - yy / H, 0, 1)[..., None] * np.array([1, .95, .9])
    img = img * vign
    img = 1 - np.exp(-1.35 * np.clip(img, 0, None))      # soft shoulder instead of hard clipping
    img = img / (1 - np.exp(-1.35))
    g = rng.normal(0, .022, (H // 2, W // 2, 1)).astype(np.float32)
    img = img + cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
    return np.clip(img, 0, 1)


ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", "24",
                       "-i", "-", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p", dst], stdin=subprocess.PIPE)
for i in range(n):
    t = i / 24
    c = cams[i]
    acc = None
    subs = sorted(glob.glob(os.path.join(src, f"f{i:04d}_*.png")))
    for j, p in enumerate(subs):
        scr = cv2.imread(p).astype(np.float32) / 255
        img = panel(scr, homography(c["x"], c["y"], c["w"], t + j / 144))
        acc = img if acc is None else acc + img
    img = lens(acc / len(subs), i, t)
    ff.stdin.write((img * 255 + .5).astype(np.uint8).tobytes())
    if i % 12 == 0:
        print(f"  {i}/{n}", flush=True)
ff.stdin.close()
ff.wait()
print("wrote", dst)
