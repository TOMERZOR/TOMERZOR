#!/usr/bin/env python3
"""S3 · capture the game's own screens for the rate-yourself kind, as the plant (mole=1, יובל).

Ten page loads in one browser session (be gentle with the production server). Writes the raw outerHTML of `.screen`
plus a screenshot for each state into shorts/s3/cap/. build_screens.py turns them into shorts/s3/screens.js.

usage: python3 shorts/s3/capture.py
"""
import asyncio, pathlib
from playwright.async_api import async_playwright

HERE = pathlib.Path(__file__).resolve().parent
CAP = HERE / "cap"
BASE = "https://hashtul.onrender.com/?demo={phase}&kind=scale&n=6&mole=1"

# name → (phase, at)
STATES = [
    ("answered", "answered", None),
    ("reveal_0", "reveal", 2500),
    ("reveal_done", "reveal", 14000),
    ("discuss", "discuss", None),
    ("esc_0", "result-escaped", 0),
    ("esc_2000", "result-escaped", 2000),
    ("esc_4000", "result-escaped", 4000),
    ("esc_6000", "result-escaped", 6000),
    ("esc_8000", "result-escaped", 8000),
]


async def grab(pg, name):
    html = await pg.evaluate("document.querySelector('.screen').outerHTML")
    (CAP / f"{name}.html").write_text(html, encoding="utf-8")
    await pg.screenshot(path=str(CAP / f"{name}.png"))
    print(f"{name:14s} {len(html):6d} chars")


async def main():
    CAP.mkdir(exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=1)
        # the answer screen: untouched, then 10 picked (press the 10 bar), then locked
        await pg.goto(BASE.format(phase="answer-scale"), wait_until="networkidle", timeout=90000)
        await pg.wait_for_timeout(2500)
        await grab(pg, "answer")
        bars = await pg.query_selector_all(".answer__bar")
        meter = await pg.query_selector(".answer__meter")
        bb = await bars[9].bounding_box()
        await pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        await pg.wait_for_timeout(900)
        await grab(pg, "answer_10")
        # also a middle value, to see how a partial fill looks
        bb = await bars[4].bounding_box()
        await pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        await pg.wait_for_timeout(900)
        await grab(pg, "answer_5")
        void = meter
        for name, phase, at in STATES:
            url = BASE.format(phase=phase) + (f"&at={at}" if at is not None else "")
            await pg.goto(url, wait_until="networkidle", timeout=90000)
            await pg.wait_for_timeout(2500)
            await grab(pg, name)
        await br.close()


if __name__ == "__main__":
    asyncio.run(main())
