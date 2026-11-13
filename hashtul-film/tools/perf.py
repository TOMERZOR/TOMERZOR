"""Where does a capture's time go: __seek in the page vs the screenshot."""
import asyncio, pathlib, time
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={"width": 1080, "height": 1920})
        await pg.goto((ROOT / "comp.html").as_uri()); await pg.evaluate("window.__ready")
        for t in (2.0, 9.0, 13.9, 18.2, 22.6, 26.6, 30.6, 34.6, 38.6):
            js = await pg.evaluate(f"(() => {{ const a = performance.now(); window.__seek({t}); return performance.now() - a; }})()")
            a = time.time(); await pg.screenshot(type="png"); s1 = time.time() - a
            a = time.time(); await pg.evaluate(f"window.__seek({t + 0.01})"); await pg.screenshot(type="png"); s2 = time.time() - a
            m = time.time(); await pg.evaluate(f"window.__motion({t}, {t + 0.016})"); mt = time.time() - m
            print(f"t={t:5.1f}  seek {js:6.1f} ms   shot {s1*1000:6.0f} ms   seek+shot {s2*1000:6.0f} ms   motion {mt*1000:6.0f} ms")
        await br.close()
asyncio.run(main())
