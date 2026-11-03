from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import sys

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB').crop((0, 60, 1600, 527))
work = im.copy()
W, H = work.size
MARK = (255, 0, 255)
for p in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1), (W // 2, 0), (W // 2, H - 1), (2, H // 2), (W - 3, H // 2)]:
    if min(work.getpixel(p)) > 230:
        ImageDraw.floodfill(work, p, MARK, thresh=28)
a = np.asarray(work)
bg = (a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 255)
alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))
rgba = im.convert('RGBA')
rgba.putalpha(alpha)
rgba = rgba.crop(alpha.point(lambda v: 255 if v > 8 else 0).getbbox())
rgba.save(out)
print(out, rgba.size, 'bg fraction', bg.mean())
