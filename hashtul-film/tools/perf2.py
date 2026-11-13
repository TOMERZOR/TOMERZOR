"""Which layer makes a capture slow? Time screenshots with suspects switched off."""
import asyncio, pathlib, time
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
CASES = {
    "baseline": "",
    "no grain": "#grain{display:none!important}",
    "ground layer": "#ground{will-change:transform}",
    "no rays": ".home__rays,.answer__rays,.vote__rays,.result__rays{display:none!important}",
    "no dots": "#dots{display:none!important}",
    "no text-stroke": "#phone *{-webkit-text-stroke:0!important}",
    "no shadows": "#phone *{box-shadow:none!important;text-shadow:none!important}",
}
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={"width": 1080, "height": 1920})
        await pg.goto((ROOT / "comp.html").as_uri()); await pg.evaluate("window.__ready")
        for name, css in CASES.items():
            await pg.evaluate("css => { let s = document.getElementById('perfcss'); if (!s) { s = document.createElement('style'); s.id = 'perfcss'; document.head.appendChild(s); } s.textContent = css; }", css)
            tot = 0
            for t in (2.0, 9.0, 18.2, 28.6, 34.6):
                await pg.evaluate(f"window.__seek({t})")
                a = time.time(); await pg.screenshot(type="png"); tot += time.time() - a
            print(f"{name:16s} {tot / 5 * 1000:6.0f} ms per shot")
        await br.close()
asyncio.run(main())
