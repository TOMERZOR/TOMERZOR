"""Contact sheet of the film at chosen times (portrait), plus any page errors. usage: stills.py out.png t1,t2,…"""
import asyncio, sys, pathlib
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parent.parent
async def main():
    out, times = sys.argv[1], [float(x) for x in sys.argv[2].split(',')]
    tw = int(sys.argv[3]) if len(sys.argv) > 3 else 270
    th = int(tw * 1920 / 1080)
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={"width": 1080, "height": 1920})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto((ROOT / "comp.html").as_uri() + "?render"); await pg.evaluate("window.__ready")
        cols = min(len(times), 8); rows = (len(times) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw, rows * (th + 26)), (12, 12, 12)); d = ImageDraw.Draw(sheet)
        for i, t in enumerate(times):
            await pg.evaluate(f"window.__seek({t})")
            png = await pg.screenshot(type="png"); im = Image.open(__import__('io').BytesIO(png)).convert("RGB").resize((tw, th), Image.LANCZOS)
            x, y = (i % cols) * tw, (i // cols) * (th + 26); sheet.paste(im, (x, y + 26)); d.text((x + 6, y + 6), f"{t:.2f}s", fill=(255, 230, 0))
        sheet.save(out); await br.close()
        print("errors:", errs[:10] if errs else "none")
asyncio.run(main())
