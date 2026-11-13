"""Write the composition's sound events (window.__events) to audio/events.json — the score reads times from the picture."""
import asyncio, json, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={"width": 1080, "height": 1920})
        await pg.goto((ROOT / "comp.html").as_uri() + "?render"); await pg.evaluate("window.__ready")
        ev = await pg.evaluate("window.__events()")
        (ROOT / "audio/events.json").write_text(json.dumps(ev, ensure_ascii=False, indent=1))
        print(len(ev["events"]), "events; dur", ev["T"]["dur"])
        await br.close()
asyncio.run(main())
