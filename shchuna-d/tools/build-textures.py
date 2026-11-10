#!/usr/bin/env python3
"""Makes the generated surface photos tile cleanly and derives normal maps.

For every assets/raw/tex/<name>.png it writes assets/tex/<name>.webp (base colour) and
assets/tex/<name>_n.webp (tangent-space normal). Steps: flatten large-scale brightness drift
(the thing that makes a tile visibly repeat), blend the wrap seam, Sobel the luminance for normals.

    python3 build-textures.py
"""
import os, sys, glob
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '../assets/raw/tex')
OUT = os.path.join(HERE, '../assets/tex')
os.makedirs(OUT, exist_ok=True)

# name -> (output size, flatten strength 0..1, normal strength)
CFG = {
    'plaster': (1024, 0.85, 2.2), 'concrete': (1024, 0.6, 1.4), 'asphalt': (1024, 0.8, 2.0),
    'paving': (1024, 0.7, 2.6), 'sand': (1024, 0.85, 1.6), 'grass': (1024, 0.75, 1.8),
    'roof': (512, 0.6, 1.5), 'metal': (512, 0.5, 2.5),
}


CONTRAST = {'asphalt': 0.85, 'roof': 0.55, 'sand': 0.8, 'grass': 0.85}


def wrap_blur(a, radius):
    """Gaussian blur that wraps around the edges."""
    h, w = a.shape[:2]
    t = np.tile(a, (3, 3, 1))
    im = Image.fromarray(np.clip(t, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(im).astype(np.float32)[h:2 * h, w:2 * w]


def flatten(a, k, div=10):
    low = wrap_blur(a, a.shape[0] / div)
    mean = a.reshape(-1, 3).mean(0)
    return np.clip(a - (low - mean) * k, 0, 255)


def seam_fix(a, band=0.12):
    """Cross-fade each edge with the opposite edge so the tile wraps without a step."""
    h, w = a.shape[:2]
    out = a.copy()
    bw = int(w * band)
    ramp = (np.arange(bw, dtype=np.float32) / bw)[None, :, None]          # 0 at the edge -> 1 inside
    left, right = a[:, :bw].copy(), a[:, w - bw:].copy()
    # at the very edge both sides become the average of the two edges
    out[:, :bw] = left * (0.5 + 0.5 * ramp) + right[:, ::-1] * (0.5 - 0.5 * ramp)
    out[:, w - bw:] = right * (0.5 + 0.5 * ramp[:, ::-1]) + left[:, ::-1] * (0.5 - 0.5 * ramp[:, ::-1])
    a2 = out.copy()
    bh = int(h * band)
    rampv = (np.arange(bh, dtype=np.float32) / bh)[:, None, None]
    top, bot = a2[:bh].copy(), a2[h - bh:].copy()
    out[:bh] = top * (0.5 + 0.5 * rampv) + bot[::-1] * (0.5 - 0.5 * rampv)
    out[h - bh:] = bot * (0.5 + 0.5 * rampv[::-1]) + top[::-1] * (0.5 - 0.5 * rampv[::-1])
    return out


def normal_map(a, strength):
    lum = (a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114) / 255.0
    lum = wrap_blur(np.repeat(lum[..., None] * 255, 3, 2), 0.8)[..., 0] / 255.0
    dx = (np.roll(lum, -1, 1) - np.roll(lum, 1, 1)) * strength
    dy = (np.roll(lum, -1, 0) - np.roll(lum, 1, 0)) * strength
    nz = np.ones_like(lum) * 0.5
    n = np.stack([-dx, dy, nz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def seam_ratio(a):
    seam = np.abs(a[0] - a[-1]).mean() + np.abs(a[:, 0] - a[:, -1]).mean()
    base = np.abs(np.diff(a, axis=0)).mean() + np.abs(np.diff(a, axis=1)).mean()
    return seam / base


for f in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    if name not in CFG:
        continue
    size, k, ns = CFG[name]
    im = Image.open(f).convert('RGB')
    m = int(im.size[0] * 0.03)                                   # drop the soft outer border
    im = im.crop((m, m, im.size[0] - m, im.size[1] - m)).resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    before = seam_ratio(a)
    a = flatten(a, 1.0 if name == 'asphalt' else k, 70 if name == 'asphalt' else 10)
    if name in CONTRAST:
        m_ = a.reshape(-1, 3).mean(0)
        a = np.clip(m_ + (a - m_) * CONTRAST[name], 0, 255)
    a = seam_fix(a)
    after = seam_ratio(a)
    Image.fromarray(a.astype(np.uint8)).save(os.path.join(OUT, name + '.webp'), quality=84, method=6)
    Image.fromarray(normal_map(a, ns)).save(os.path.join(OUT, name + '_n.webp'), quality=88, method=6)
    print(f'{name}: seam {before:.2f} -> {after:.2f}')
