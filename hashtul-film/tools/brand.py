"""Brand files from the game's own artwork: python3 tools/brand.py  →  brand/*.png
   hashtul-icon-1024.png   the app icon (its icon.svg), transparent corners
   hashtul-profile-1080.png  profile picture for Instagram / TikTok: full-bleed, mascot inside the circle crop
   hashtul-logo.png        cast + wordmark lockup, transparent
   hashtul-wordmark.png    the wordmark alone, transparent"""
import asyncio, pathlib, re
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'brand'

ICON = (ROOT / 'ref/site/icon.svg').read_text(encoding='utf-8')

def mascot_box():
    """the mascot's visible extent in the icon's 120-unit viewBox, measured from the rendered icon"""
    from PIL import Image
    im = Image.open(OUT / 'hashtul-icon-1024.png').convert('RGBA'); px = im.load(); n = im.width
    bg = (74, 23, 166); xs, ys = [], []
    for y in range(0, n, 2):
        for x in range(0, n, 2):
            r, g, b, a = px[x, y]
            if a > 200 and abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 40: xs.append(x); ys.append(y)
    u = 120 / n
    return min(xs) * u, min(ys) * u, max(xs) * u, max(ys) * u

def profile_svg(fill=0.74, lift=1.5):
    # same artwork and purple as the app icon; square corners (the apps crop to a circle), a soft glow behind the
    # mascot, and the mascot scaled so its height fills `fill` of the side, its body near the circle's centre
    x0, y0, x1, y1 = mascot_box()
    k = fill * 120 / (y1 - y0); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    s = ICON.replace('<rect width="120" height="120" rx="28" fill="#4a17a6"/>',
                     '<defs><radialGradient id="glow" cx="50%" cy="54%" r="62%"><stop offset="0" stop-color="#5d24cc"/>'
                     '<stop offset=".62" stop-color="#4a17a6"/><stop offset="1" stop-color="#3d1290"/></radialGradient></defs>'
                     '<rect width="120" height="120" fill="url(#glow)"/>', 1)
    assert 'url(#glow)' in s and s.count('<g transform="translate(12 8)">') == 1 and s.rstrip().endswith('</svg>')
    s = s.replace('<g transform="translate(12 8)">',
                  f'<g transform="translate(60 {60 - lift:.2f}) scale({k:.4f}) translate({-cx:.3f} {-cy:.3f})"><g transform="translate(12 8)">', 1)
    return s.rstrip()[:-len('</svg>')] + '</g></svg>'

async def shot_svg(pg, svg, size, out):
    await pg.set_viewport_size({'width': size, 'height': size})
    await pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
    await pg.evaluate(f'''() => {{ const s = document.querySelector('svg'); s.setAttribute('width', {size}); s.setAttribute('height', {size}); }}''')
    await pg.screenshot(path=str(out), omit_background=True, clip={'x': 0, 'y': 0, 'width': size, 'height': size})

async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(device_scale_factor=1)
        await shot_svg(pg, ICON, 1024, OUT / 'hashtul-icon-1024.png')
        await shot_svg(pg, profile_svg(), 1080, OUT / 'hashtul-profile-1080.png')
        pg2 = await br.new_page(device_scale_factor=5, viewport={'width': 900, 'height': 700})
        for name, hash_ in (('hashtul-logo.png', ''), ('hashtul-wordmark.png', '?mark')):
            await pg2.goto((ROOT / 'tools/brand.html').as_uri() + hash_); await pg2.evaluate('window.__ready')
            await pg2.locator('#wrap').screenshot(path=str(OUT / name), omit_background=True)
        await br.close()
    from PIL import Image
    for name in ('hashtul-logo.png', 'hashtul-wordmark.png'):
        im = Image.open(OUT / name); bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        pad = 60; im = im.crop((bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad)); im.save(OUT / name, optimize=True)
    print('wrote', ', '.join(sorted(x.name for x in OUT.glob('*.png'))))

asyncio.run(main())
