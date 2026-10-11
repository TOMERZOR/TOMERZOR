import sys
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
fp, out = sys.argv[1], sys.argv[2]
chars = [chr(c) for c in sorted(TTFont(fp).getBestCmap()) if c > 32 and c != 0xA0]
f = ImageFont.truetype(fp, 120); lab = ImageFont.load_default()
cols = 11; cw, ch = 160, 230
rows = (len(chars) + cols - 1) // cols
img = Image.new('RGB', (cols * cw, rows * ch), 'white'); d = ImageDraw.Draw(img)
for i, c in enumerate(chars):
    r, k = divmod(i, cols); x, y = (cols - 1 - k) * cw, r * ch
    d.rectangle([x, y, x + cw - 1, y + ch - 1], outline=(225, 225, 235))
    d.line([(x, y + 150), (x + cw, y + 150)], fill=(200, 210, 240))
    d.text((x + cw / 2, y + 150), c, font=f, fill=(20, 30, 90), anchor='ms')
    d.text((x + 6, y + 6), f'U+{ord(c):04X}', font=lab, fill=(150, 150, 150))
img.save(out)
