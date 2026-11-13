"""Check a rendered film against its composition: for a grid of times, compare the video's frame with the page seeked to
the same time (both shrunk and blurred, so motion blur and grain don't matter). A broken stretch (a page that failed to
load mid-render, frames out of order, a stale file) shows up as a low score.

usage: verify_frames.py <comp.html> <video.mp4> [step=0.25] [--sheet out.png]
prints the worst times; with --sheet, writes video|page pairs for the eight worst."""
import asyncio, io, pathlib, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent

def small(im):
    g = im.convert('L').resize((108, 192), Image.BILINEAR).filter(ImageFilter.GaussianBlur(2))
    return np.asarray(g, dtype=np.float32)

def score(a, b):
    a = a - a.mean(); b = b - b.mean()
    d = float(np.sqrt((a * a).sum() * (b * b).sum()))
    return float((a * b).sum() / d) if d > 1e-6 else 1.0

def video_frame(video, t):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.4f}', '-i', str(video), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
                       capture_output=True)
    return Image.open(io.BytesIO(r.stdout)).convert('RGB')

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sheet = sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None
    if sheet: args.remove(sheet)
    comp = pathlib.Path(args[0]); comp = comp if comp.is_absolute() else ROOT / comp
    video = pathlib.Path(args[1]); video = video if video.is_absolute() else ROOT / video
    step = float(args[2]) if len(args) > 2 else 0.25
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={'width': 1080, 'height': 1920})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(comp.as_uri() + '?render'); await pg.evaluate('window.__ready')
        dur = await pg.evaluate('window.__meta.dur')
        fps = float(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', str(video)],
                                   capture_output=True, text=True).stdout.strip().split('/')[0])
        rows = []
        n = int(dur / step)
        for i in range(n):
            t = round(i * step + 0.5 / fps, 4)                       # the middle of a frame, so both sides show the same instant
            await pg.evaluate(f'window.__seek({t})')
            page = Image.open(io.BytesIO(await pg.screenshot(type='png'))).convert('RGB')
            vid = video_frame(video, i * step)
            rows.append((score(small(vid), small(page)), i * step, vid, page))
        await br.close()
    rows.sort(key=lambda r: r[0])
    print(f'{len(rows)} times checked · page errors: {errs or "none"}')
    print('worst:', ', '.join(f'{t:.2f}s={s:.3f}' for s, t, _, _ in rows[:8]))
    print('median:', f'{sorted(r[0] for r in rows)[len(rows) // 2]:.3f}', '· below 0.80:', sum(1 for r in rows if r[0] < 0.80))
    if sheet:
        w, h = 216, 384; out = Image.new('RGB', (8 * (2 * w + 10), h + 24), (12, 12, 12))
        from PIL import ImageDraw
        d = ImageDraw.Draw(out)
        for k, (s, t, vid, page) in enumerate(rows[:8]):
            x = k * (2 * w + 10); out.paste(vid.resize((w, h)), (x, 24)); out.paste(page.resize((w, h)), (x + w, 24))
            d.text((x + 4, 6), f'{t:.2f}s  score {s:.3f}  video | page', fill=(255, 230, 0))
        out.save(sheet)
asyncio.run(main())
