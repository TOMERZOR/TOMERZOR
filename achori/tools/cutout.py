# Cuts a drawing out of a plain white background: flood-fills the near-white pixels
# connected to the border (so white teeth and eyes inside the outline stay), softens the edge.
# Usage: python3 tools/cutout.py in.png out.png
import sys
from collections import deque
from PIL import Image, ImageFilter

im = Image.open(sys.argv[1]).convert('RGB')
W, H = im.size
px = im.load()
bg = bytearray(W * H)
q = deque()
def white(x, y):
    r, g, b = px[x, y]
    return r > 232 and g > 232 and b > 232
for x in range(W):
    for y in (0, H - 1):
        if white(x, y): q.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        if white(x, y): q.append((x, y))
while q:
    x, y = q.popleft()
    i = y * W + x
    if bg[i]: continue
    bg[i] = 1
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and not bg[ny * W + nx] and white(nx, ny):
            q.append((nx, ny))
mask = Image.frombytes('L', (W, H), bytes(0 if v else 255 for v in bg))
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
out = im.convert('RGBA')
out.putalpha(mask)
out.save(sys.argv[2])
