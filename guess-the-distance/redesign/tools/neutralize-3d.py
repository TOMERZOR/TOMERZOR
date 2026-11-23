#!/usr/bin/env python3
"""Take the violet cast out of Microsoft Fluent Emoji 3D PNGs.

The redesign has no purple anywhere (REDESIGN-PROMPT.md, section 5.3), but
Fluent's 3D renders shade white and gray materials with lavender and draw
some parts in violet: the robot, the panda, the die, the swords, the
sunglasses, the bee's stripes, the unicorn. This pulls most of the
saturation out of purple pixels only. Every other color, the lightness and
the alpha stay as they are, so the art still looks like Fluent.

    python3 neutralize-3d.py SRC_DIR DST_DIR   # process every PNG in SRC_DIR
    python3 neutralize-3d.py --check DIR       # report purple share per PNG

Purple band (HSL hue): full effect 260-310 degrees, fading out over 15 degrees
on each side (245 and 325). Inside the band 20% of the saturation is kept.
Images larger than 256 px are scaled down to 256 px.

The check counts opaque pixels with HSV hue 250-320, saturation > 0.25 and
value > 0.15, and flags images above 12%. Tested on the 38 images listed in
section 5.4: before, up to 66% (the unicorn); after, about 10% at most
(the monkey's pink face, which sits on the edge of the band and is pink, not
purple).

Fluent Emoji is MIT licensed, so modified copies are fine; keep the credit.
Needs Pillow and numpy (pip install pillow numpy).
"""

import os
import sys

import numpy as np
from PIL import Image

KEEP = 0.2       # share of saturation kept inside the band
LIMIT = 0.12     # --check flags images above this purple share
MAX_SIZE = 256


def band_weight(h):
    """1 inside the purple band, 0 outside, linear at the edges. h in degrees."""
    w = np.zeros_like(h)
    w = np.where((h >= 260) & (h <= 310), 1.0, w)
    w = np.where((h >= 245) & (h < 260), (h - 245) / 15, w)
    w = np.where((h > 310) & (h <= 325), (325 - h) / 15, w)
    return w


def neutralize(img):
    a = np.asarray(img.convert("RGBA")).astype(np.float64) / 255
    rgb, alpha = a[..., :3], a[..., 3:]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    light = (mx + mn) / 2
    eps = 1e-9
    sat = np.where(d == 0, 0, d / (1 - np.abs(2 * light - 1) + eps))
    hue = np.where(
        mx == r, ((g - b) / (d + eps)) % 6,
        np.where(mx == g, (b - r) / (d + eps) + 2, (r - g) / (d + eps) + 4),
    ) * 60
    hue = np.where(d == 0, 0, hue)

    sat = sat * (1 - band_weight(hue) * (1 - KEEP))

    # HSL back to RGB
    c = (1 - np.abs(2 * light - 1)) * sat
    x = c * (1 - np.abs((hue / 60) % 2 - 1))
    m = light - c / 2
    zero = np.zeros_like(c)
    sector = (hue // 60).astype(int) % 6
    out = np.zeros_like(rgb)
    for i, parts in enumerate([(c, x, zero), (x, c, zero), (zero, c, x),
                               (zero, x, c), (x, zero, c), (c, zero, x)]):
        sel = sector == i
        for ch, val in enumerate(parts):
            out[..., ch] = np.where(sel, val + m, out[..., ch])

    res = np.concatenate([np.clip(out, 0, 1), alpha], -1)
    return Image.fromarray((res * 255 + 0.5).astype(np.uint8), "RGBA")


def purple_share(img):
    a = np.asarray(img.convert("RGBA").resize((96, 96))).astype(np.float64) / 255
    opaque = a[..., 3] >= 0.5
    rgb = a[..., :3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    eps = 1e-9
    hue = np.where(
        mx == r, ((g - b) / (d + eps)) % 6,
        np.where(mx == g, (b - r) / (d + eps) + 2, (r - g) / (d + eps) + 4),
    ) * 60
    sat = np.where(mx == 0, 0, d / (mx + eps))
    purple = opaque & (d > 0) & (hue >= 250) & (hue <= 320) & (sat > 0.25) & (mx > 0.15)
    total = opaque.sum()
    return purple.sum() / total if total else 0.0


def pngs(folder):
    return sorted(f for f in os.listdir(folder) if f.lower().endswith(".png"))


def main(argv):
    if len(argv) == 3 and argv[1] == "--check":
        folder = argv[2]
        bad = 0
        for f in pngs(folder):
            share = purple_share(Image.open(os.path.join(folder, f)))
            flag = "  <- too purple" if share > LIMIT else ""
            bad += bool(flag)
            print(f"{share * 100:5.1f}%  {f}{flag}")
        print(f"{bad} image(s) above {LIMIT * 100:.0f}%")
        return 1 if bad else 0
    if len(argv) == 3:
        src, dst = argv[1], argv[2]
        os.makedirs(dst, exist_ok=True)
        for f in pngs(src):
            img = Image.open(os.path.join(src, f))
            before = purple_share(img)
            if max(img.size) > MAX_SIZE:
                img = img.convert("RGBA")
                img.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)
            out = neutralize(img)
            out.save(os.path.join(dst, f), optimize=True)
            print(f"{before * 100:5.1f}% -> {purple_share(out) * 100:5.1f}%  {f}")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
