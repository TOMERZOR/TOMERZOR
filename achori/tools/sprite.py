# Turns a generated PNG into a game sprite: trims to the visible pixels, firms up the
# alpha the generator leaves at 252-254, scales so the longest side is `size`, saves WebP.
# Usage: python3 tools/sprite.py in.png out.webp [size] [opaque]
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 512
opaque = len(sys.argv) > 4 and sys.argv[4] == 'opaque'

im = Image.open(src).convert('RGBA')
if not opaque:
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < 10 else (255 if v > 235 else v))
    im = Image.merge('RGBA', (r, g, b, a))
    box = a.getbbox()
    pad = 4
    im = im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))
scale = size / max(im.size)
if scale < 1:
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
if opaque:
    im.convert('RGB').save(dst, 'WEBP', quality=84, method=6)
else:
    im.save(dst, 'WEBP', quality=88, method=6, exact=False)
print(dst, im.size)
