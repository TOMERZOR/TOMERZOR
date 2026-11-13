#!/usr/bin/env python3
"""Build the film's vendor layer from the game's own front-end (harvested into ref/).

  vendor/fonts.css   the game's faces (Rubik Variable 300-900, Karantina 700), inlined as base64 so file:// renders get them
  vendor/game.css    the game's stylesheet, minus its @font-face rules
  vendor/chars.js    the game's character generator (kinds, eyes, mouths, brows, moods) → window.CH
  vendor/screens.js  real screens captured from the game's demo mode → window.SCREENS (ids made unique per screen)

usage: python3 tools/build_vendor.py
"""
import asyncio, base64, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF, VENDOR = ROOT / "ref", ROOT / "vendor"
SITE = REF / "site"

FONTS = [  # (family, weight, style-range descriptor, file, unicode-range)
    ("Rubik Variable", "300 900", "rubik-hebrew-wght-normal-BIkpbuMU.woff2", "U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F"),
    ("Rubik Variable", "300 900", "rubik-latin-wght-normal-CnQIisVs.woff2",
     "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"),
    ("Karantina", "700", "karantina-hebrew-700-normal-CEidegjC.woff2", "U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F"),
    ("Karantina", "700", "karantina-latin-700-normal-CWlTIwJg.woff2",
     "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"),
]

# name → (capture file, selector). Captures come from the game's own ?demo= mode (tools in the README).
SCREENS = {
    "home": ("frames/home.html", ".screen"),
    "join": ("frames/join.html", ".screen"),
    "lobby": ("dom/lobby.html", ".screen"),
    "pepper_on": ("frames/lobby_host_pepper.html", ".pepper"),
    "intro": ("frames/intro_1700.html", ".screen"),
    "answer": ("dom/answer.html", ".screen"),
    "answer_typed": ("frames/answer_typed.html", ".screen"),
    "answer_locked": ("frames/answer_locked.html", ".screen"),
    "reveal": ("frames/reveal_2500.html", ".screen"),
    "reveal_done": ("frames/reveal_14000.html", ".screen"),
    "discuss": ("dom/discuss.html", ".screen"),
    "vote": ("dom/vote.html", ".screen"),
    "vote_pick": ("frames/vote_pick.html", ".screen"),
    "voted": ("dom/voted.html", ".screen"),
    "result_0": ("frames/result_0.html", ".screen"),
    "result_tally": ("frames/result_2000.html", ".screen"),
    "result_spot": ("frames/result_4000.html", ".screen"),
    "result_caught": ("frames/result_6000.html", ".screen"),
    "result_gain": ("frames/result_8000.html", ".screen"),
    "final_steps": ("frames/final_800.html", ".screen"),
    "final_figs": ("frames/final_2400.html", ".screen"),
    "final_crown": ("frames/final_4200.html", ".screen"),
}


def build_fonts():
    rules = []
    for fam, wt, fn, rng in FONTS:
        b64 = base64.b64encode((SITE / fn).read_bytes()).decode()
        fmt = "woff2-variations" if " " in wt else "woff2"
        rules.append(f'@font-face{{font-family:"{fam}";font-style:normal;font-display:block;font-weight:{wt};'
                     f'src:url(data:font/woff2;base64,{b64}) format("{fmt}");unicode-range:{rng}}}')
    (VENDOR / "fonts.css").write_text("\n".join(rules) + "\n", encoding="utf-8")


def build_css():
    css = (SITE / "game.orig.css").read_text(encoding="utf-8")
    css = re.sub(r"@font-face\{[^}]*\}", "", css)
    (VENDOR / "game.css").write_text("/* The game's own stylesheet (hashtul.onrender.com), @font-face rules moved to fonts.css. */\n" + css,
                                     encoding="utf-8")


def build_chars():
    raw = (SITE / "charmod.raw.js").read_text(encoding="utf-8").rstrip()
    if raw.endswith(","):
        raw = raw[:-1] + ";"
    # the game numbers its clip-paths fg1, rg2 …; give ours their own prefix so they never meet a captured screen's ids
    raw = raw.replace("r=`fg`+ ++Im", "r=`cfg`+ ++Im").replace("r=`rg`+ ++Im", "r=`crg`+ ++Im")
    js = """/* The game's character generator, lifted verbatim from its bundle (hashtul.onrender.com) → window.CH.
   CH.avatar(code, {size, variant: 'ring'|'figure', mood, planted, ring, dimmed, over}) returns the same markup as the
   game's <Avatar>. Codes are 'kind.eyes.mouth' or any string (hashed, like the game's demo players 'demo-1' …). */
(function () {
""" + raw + """
  function opts(code, o) {
    const t = ih(code);
    return { kind: t.kind, o: Object.assign({ eyes: t.eyes, mouth: t.mouth, planted: o.planted, ring: o.ring }, o.mood ? sh[o.mood] : null, o.over || null) };
  }
  function svg(code, o = {}) { const { kind, o: p } = opts(code, o); return o.variant === 'figure' ? Qm.fig(kind, p) : Qm.ring(kind, p); }
  function avatar(code, o = {}) {
    const size = o.size || 56, v = o.variant || 'ring';
    return `<span class="avatar avatar--${v}${o.dimmed ? ' avatar--dimmed' : ''}" style="width:${size}px;height:${size * 1.04}px" aria-hidden="true">${svg(code, o)}</span>`;
  }
  window.CH = { Qm, ih, sh, KINDS: Bm, svg, avatar, kindOf: c => ih(c).kind };
})();
"""
    (VENDOR / "chars.js").write_text(js, encoding="utf-8")


async def build_screens():
    from playwright.async_api import async_playwright
    out = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        page = await br.new_page()
        for name, (rel, sel) in SCREENS.items():
            html = (REF / rel).read_text(encoding="utf-8")
            html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S)
            html = re.sub(r"<link\b[^>]*>", "", html)
            await page.set_content(html)
            frag = await page.evaluate("s => document.querySelector(s).outerHTML", sel)
            ids = set(re.findall(r'\sid="([^"]+)"', frag))
            for i in sorted(ids, key=len, reverse=True):
                frag = re.sub(rf'(\sid=")({re.escape(i)})(")', rf"\g<1>{name}_\2\3", frag)
                frag = frag.replace(f"url(#{i})", f"url(#{name}_{i})").replace(f'href="#{i}"', f'href="#{name}_{i}"')
            out[name] = frag
            print(f"{name:14s} {len(frag):6d} chars, {len(ids)} ids")
        await br.close()
    (VENDOR / "screens.js").write_text(
        "/* Real screens captured from the game's demo mode (hashtul.onrender.com/?demo=…), ids made unique. */\n"
        "window.SCREENS = " + json.dumps(out, ensure_ascii=False, indent=0) + ";\n", encoding="utf-8")


if __name__ == "__main__":
    VENDOR.mkdir(exist_ok=True)
    build_fonts(); build_css(); build_chars()
    asyncio.run(build_screens())
    for f in sorted(VENDOR.iterdir()):
        print(f"{f.name:12s} {f.stat().st_size:8d} bytes")
