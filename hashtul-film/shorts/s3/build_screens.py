#!/usr/bin/env python3
"""S3 · turn the captures in shorts/s3/cap/ (capture.py) into shorts/s3/screens.js.

Same cleaning as tools/build_vendor.py: ids (and url(#…) / href="#…") are prefixed with the screen's name so two
screens never share a clip path. The result is merged into window.SCREENS (vendor/screens.js is loaded first).

usage: python3 shorts/s3/build_screens.py
"""
import json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
CAP = HERE / "cap"
SCREENS = {                     # name in window.SCREENS → capture
    "s3_answer": "answer",          # demo=answer-scale, untouched (the 10-picked state is reproduced by classes: see film.js)
    "s3_answered": "answered",      # demo=answered: the locked card
    "s3_reveal": "reveal_done",     # demo=reveal&at=14000: every card face up (the film flips them)
    "s3_discuss": "discuss",        # demo=discuss: the title "מי פה משקר?"
    "s3_esc0": "esc_0",             # demo=result-escaped&at=0: the tally, "השתול הוא", the mystery figure, the counts
    "s3_esc": "esc_8000",           # demo=result-escaped&at=8000: ברח!, the figure, the line, the card, the board
}


def main():
    out = {}
    for name, src in SCREENS.items():
        frag = (CAP / f"{src}.html").read_text(encoding="utf-8")
        frag = re.sub(r"<script\b[^>]*>.*?</script>", "", frag, flags=re.S)
        ids = set(re.findall(r'\sid="([^"]+)"', frag))
        for i in sorted(ids, key=len, reverse=True):
            frag = re.sub(rf'(\sid=")({re.escape(i)})(")', rf"\g<1>{name}_\2\3", frag)
            frag = frag.replace(f"url(#{i})", f"url(#{name}_{i})").replace(f'href="#{i}"', f'href="#{name}_{i}"')
        out[name] = frag
        print(f"{name:12s} {len(frag):6d} chars, {len(ids)} ids")
    (HERE / "screens.js").write_text(
        "/* S3 · screens captured from the game's demo mode as the plant, rate-yourself kind\n"
        " * (hashtul.onrender.com/?demo=…&kind=scale&n=6&mole=1), ids made unique. Built by build_screens.py from cap/. */\n"
        "Object.assign(window.SCREENS, " + json.dumps(out, ensure_ascii=False, indent=0) + ");\n", encoding="utf-8")


if __name__ == "__main__":
    main()
