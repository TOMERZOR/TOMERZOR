import sys
from PIL import Image, ImageDraw, ImageFont, features
font_path, out = sys.argv[1], sys.argv[2]
texts = sys.argv[3:]
assert features.check('raqm'), 'needs raqm for RTL layout'
f = ImageFont.truetype(font_path, 90)
W = 1800; lh = 150
img = Image.new('RGB', (W, lh * len(texts) + 60), 'white'); d = ImageDraw.Draw(img)
for i, t in enumerate(texts):
    y = 40 + i * lh
    d.line([(40, y + 95), (W - 40, y + 95)], fill=(220, 225, 240), width=2)  # baseline guide
    d.text((W - 60, y + 95), t, font=f, fill=(20, 30, 90), anchor='rs', direction='rtl')
img.save(out)
