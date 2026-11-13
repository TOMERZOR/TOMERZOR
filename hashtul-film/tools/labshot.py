"""Render tools/lab.html?s=<screen> at 430×932 @3x next to the game's own capture, for checking the replica."""
import asyncio, sys, pathlib
from playwright.async_api import async_playwright
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAIRS = [a.split("=") for a in sys.argv[2:]]          # screen=refpng
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=2)
        tiles = []
        for name, ref in PAIRS:
            await pg.goto((ROOT / "tools/lab.html").as_uri() + f"?s={name}"); await pg.evaluate("window.__ready")
            await pg.wait_for_timeout(200)
            png = ROOT / f"tools/out_{name}.png"; await pg.screenshot(path=str(png))
            a = Image.open(png).convert("RGB").resize((430, 932)); b = Image.open(ROOT / ref).convert("RGB").resize((430, 932))
            t = Image.new("RGB", (870, 932), (255, 0, 255)); t.paste(b, (0, 0)); t.paste(a, (440, 0)); tiles.append(t)
        sheet = Image.new("RGB", (870 * len(tiles), 932)); [sheet.paste(t, (870 * i, 0)) for i, t in enumerate(tiles)]
        sheet.save(sys.argv[1]); await br.close()
asyncio.run(main())
