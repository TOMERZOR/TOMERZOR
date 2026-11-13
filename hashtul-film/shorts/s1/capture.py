#!/usr/bin/env python3
"""S1: capture the text-kind states S1 needs from the game's demo mode (a handful of loads) into shorts/s1/cap/,
then build shorts/s1/screens.js (ids made unique per screen, like tools/build_vendor.py)."""
import asyncio, json, pathlib, re, sys
HERE = pathlib.Path(__file__).resolve().parent
CAP = HERE / "cap"
BASE = "https://hashtul.onrender.com/?demo={ph}&kind=text&n=6&me=p2&at={at}"
SHOTS = {  # name -> (phase, at ms)
    "t_reveal_down": ("reveal", 2500),
    "t_reveal_done": ("reveal", 14000),
    "t_result_gain": ("result", 8000),
}

async def capture():
    from playwright.async_api import async_playwright
    CAP.mkdir(exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=1)
        for name, (ph, at) in SHOTS.items():
            await pg.goto(BASE.format(ph=ph, at=at), wait_until="networkidle")
            await pg.wait_for_timeout(2500)
            (CAP / f"{name}.html").write_text(await pg.content(), encoding="utf-8")
            await pg.screenshot(path=str(CAP / f"{name}.png"))
            print(name, "ok")
        await br.close()

async def build():
    from playwright.async_api import async_playwright
    out = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(); page = await br.new_page()
        for name in SHOTS:
            html = (CAP / f"{name}.html").read_text(encoding="utf-8")
            html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S)
            html = re.sub(r"<link\b[^>]*>", "", html)
            await page.set_content(html)
            frag = await page.evaluate("s => document.querySelector(s).outerHTML", ".screen")
            ids = set(re.findall(r'\sid="([^"]+)"', frag))
            for i in sorted(ids, key=len, reverse=True):
                frag = re.sub(rf'(\sid=")({re.escape(i)})(")', rf"\g<1>{name}_\2\3", frag)
                frag = frag.replace(f"url(#{i})", f"url(#{name}_{i})").replace(f'href="#{i}"', f'href="#{name}_{i}"')
            out[name] = frag
            print(name, len(frag))
        await br.close()
    (HERE / "screens.js").write_text("/* S1: text-kind screens captured from the game's demo mode (shorts/s1/capture.py). Added to window.SCREENS. */\n"
        "Object.assign(window.SCREENS, " + json.dumps(out, ensure_ascii=False, indent=0) + ");\n", encoding="utf-8")

if __name__ == "__main__":
    if "build" not in sys.argv[1:]: asyncio.run(capture())
    asyncio.run(build())
