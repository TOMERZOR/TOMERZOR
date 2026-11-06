"""Puts each slide's screen into the green screen of the MacBook photo and writes 1080×1350 backgrounds.

- finds the screen from the chroma green (soft edge, so the bezel and the notch stay untouched),
- maps the screen render onto it in perspective (corner points taken from the green area),
- removes the green spill from the keyboard and trackpad and lights them with the screen's own colour,
- adds a faint glass sheen to the display,
- slide 4 uses the macro photo of the ⌥ key instead of the laptop.

usage: python3 compose.py [916]   (reads assets/ and work/screen-0N.png, writes work/base-0N.png, or base-0N-916.png at 1080×1920)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
TALL = len(sys.argv) > 1 and sys.argv[1] == "916"
W, H = (1080, 1920) if TALL else (1080, 1350)
SUF = "-916" if TALL else ""


def coeffs(dst, src):
    """PIL PERSPECTIVE coefficients that map output points dst to input points src."""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(m, float), np.array(src, float).reshape(8)).tolist()


def fit(img):
    """Scale to cover 1080×1350 and centre-crop."""
    s = max(W / img.width, H / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - W) // 2, (img.height - H) // 2
    return img.crop((x, y, x + W, y + H))


photo = Image.open(os.path.join(HERE, "assets", "macbook-green.png")).convert("RGB")
P = np.asarray(photo).astype(np.float32)
r, g, b = P[..., 0], P[..., 1], P[..., 2]
green = g - np.maximum(r, b)
alpha = np.clip((green - 35) / 110, 0, 1)                       # soft screen matte
ys, xs = np.nonzero(green > 150)
s, d = xs + ys, xs - ys
TL = (xs[s.argmin()], ys[s.argmin()]); BR = (xs[s.argmax()], ys[s.argmax()])
TR = (xs[d.argmax()], ys[d.argmax()]); BL = (xs[d.argmin()], ys[d.argmin()])
grow = 6                                                          # reach past the rounded corners
quad = [(TL[0] - grow, TL[1] - grow), (TR[0] + grow, TR[1] - grow), (BR[0] + grow, BR[1] + grow), (BL[0] - grow, BL[1] + grow)]
print("screen corners", quad)
screen_bottom = max(BL[1], BR[1]); cx = (TL[0] + TR[0]) / 2; sw = TR[0] - TL[0]

# despill everywhere outside the screen: green can never exceed the larger of red and blue
desp = P.copy()
desp[..., 1] = np.minimum(g, np.maximum(r, b) * 1.02)
base = desp * (1 - alpha[..., None]) + P * alpha[..., None]

yy, xx = np.mgrid[0:P.shape[0], 0:P.shape[1]].astype(np.float32)
below = np.clip((yy - screen_bottom) / 30, 0, 1) * np.exp(-np.clip(yy - screen_bottom, 0, None) / 420)
across = np.exp(-((xx - cx) / (sw * 0.62)) ** 2)
spill_light = (below * across)[..., None]

for i in range(1, 9):
    if i == 4:
        macro = Image.open(os.path.join(HERE, "..", "higgsfield", "keyframes", "k1-macro.jpg")).convert("RGB")
        if not TALL:
            macro = macro.crop((0, 560, macro.width, 560 + round(macro.width * 1.25)))
        fit(macro).save(os.path.join(HERE, "work", f"base-04{SUF}.png"))
        continue
    scr = Image.open(os.path.join(HERE, "work", f"screen-{i:02d}.png")).convert("RGB")
    warped = np.asarray(scr.transform(photo.size, Image.PERSPECTIVE,
                                      coeffs(quad, [(0, 0), (scr.width, 0), (scr.width, scr.height), (0, scr.height)]),
                                      Image.BICUBIC)).astype(np.float32)
    # a display is never pure: a touch of black lift and a faint diagonal sheen
    sheen = np.clip(1 - ((xx - TL[0]) + (yy - TL[1]) * 1.6) / (sw * 0.9), 0, 1) ** 2 * 18
    disp = warped * 0.97 + 4 + sheen[..., None]
    mean = np.asarray(scr.resize((8, 5), Image.BOX)).reshape(-1, 3).mean(0)
    lit = base + spill_light * mean * 0.22                         # the screen lights the deck and the desk
    out = lit * (1 - alpha[..., None]) + disp * alpha[..., None]
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=30, threshold=2))
    fit(img).save(os.path.join(HERE, "work", f"base-{i:02d}{SUF}.png"))
    print("wrote base", i)
