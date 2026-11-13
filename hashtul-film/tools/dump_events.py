"""Write the composition's sound events (window.__events) to audio/events.json — the score reads times from the picture.
   usage: dump_events.py [query] [out.json] [--comp shorts/s1/comp.html]   e.g. dump_events.py cut=clean audio/events_clean.json"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
def _comp():
    """--comp <path> (relative to hashtul-film/ or absolute) picks another composition; default comp.html"""
    if '--comp' in sys.argv:
        i = sys.argv.index('--comp'); p = pathlib.Path(sys.argv[i + 1]); del sys.argv[i:i + 2]
        return p if p.is_absolute() else ROOT / p
    return ROOT / 'comp.html'
COMP = _comp()
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={"width": 1080, "height": 1920})
        q = sys.argv[1] if len(sys.argv) > 1 else ""
        await pg.goto(COMP.as_uri() + "?render" + ("&" + q if q else "")); await pg.evaluate("window.__ready")
        ev = await pg.evaluate("window.__events()")
        (ROOT / (sys.argv[2] if len(sys.argv) > 2 else "audio/events.json")).write_text(json.dumps(ev, ensure_ascii=False, indent=1))
        print(len(ev["events"]), "events; dur", ev["T"]["dur"])
        await br.close()
asyncio.run(main())
