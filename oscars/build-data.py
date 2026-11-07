"""Reads the Google Forms export and writes private/data.json for the video.

Normalizes spelling variants ("אהרון בנהרוש" -> "אהרון"), counts votes per category, builds the
podium (up to three vote levels, ties share a level), groups the free-text "moment" answers by who
they are about, and counts how often each person is mentioned across the whole form.

usage: python3 build-data.py [private/votes.csv] [private/data.json]
"""
import csv
import json
import sys
from collections import Counter, OrderedDict
from pathlib import Path

SRC = sys.argv[1] if len(sys.argv) > 1 else "private/votes.csv"
OUT = sys.argv[2] if len(sys.argv) > 2 else "private/data.json"

# people with a face photo in private/faces (also the names counted for the "most mentioned" award)
PEOPLE = sorted(p.stem for p in Path("private/faces").glob("*.jpg"))

# How each column is shown and animated. kind: people | couple | text
CATS = [
    ("funny", "people", "המצחיק של הפלגה"),
    ("slacker", "people", "החפשן של הפלגה"),
    ("mom", "people", "המאמא של הפלגה"),
    ("couple", "couple", "הזוג של הפלגה"),
    ("yellow", "people", "הצהוב של הפלגה"),
    ("lions", "people", "מפנק האריות של הפלגה"),
    ("burnt", "people", "המושחר/ת של הפלגה"),
    ("staff", "people", "איש סגל מועדף"),
    ("moment", "text", "רגע מכונן של הפלגה"),
    ("lol", "text", "רגע מצחיק של הפלגה"),
    ("forget", "text", "רגע שהייתי מעדיף לשכוח"),
    ("baby", "people", "התינוקי הפוץ של הפלגה"),
    ("model", "people", "הכי מדוגם של הפלגה"),
    ("weird", "people", "הכי מוזר של הפלגה"),
]

# Spelling variants -> canonical answer(s). A list means the vote counts for each.
ALIASES = {
    "אהרון בנהרוש": "אהרון",
    "נבו הפוץ": "נבו",
    "שליו עם המגולגלות שלו": "שליו",
    "אופק בלי ספק": "אופק",
    "יסמין אהבת חיי": "יסמין",
    "אורין!": "אורין",
    "אורין ויסמין": ["אורין", "יסמין"],
    "נבו לירן": "נבו ולירן",
}
NON_ANSWERS = {"אין", "?"}

# Free-text answers grouped by who/what they are about (the most-mentioned group wins).
TEXT_GROUPS = {
    "moment": [("גבירול", ["גבירול", "פריסה בגבירול"])],
    "lol": [("לירן", ["לירן אומר ליסמין שהיא מנפיצה", "לירן צועק לא על יסמין", "שלירן אומר דברים בלי לחשוב לפני"]),
            ("תומר", ["בדיחות תומר", "סיכומי שבוע של תומר"])],
    "forget": [("לירן", ["יסמין נוזפת בנו, לירן מדבר", "הבדיחות הכל מצחיקות של לירן"])],
}


def clean(s):
    return " ".join(s.replace("‏", "").replace("‎", "").split())


def main():
    rows = list(csv.reader(open(SRC, encoding="utf-8")))
    data = rows[1:]
    cats = []
    for ci, (cid, kind, title) in enumerate(CATS, start=1):
        raw = [clean(r[ci]) for r in data]
        if kind == "text":
            groups = TEXT_GROUPS.get(cid, [])
            grouped = {q for _, qs in groups for q in qs}
            singles = [a for a in raw if a and a not in grouped and a not in NON_ANSWERS]
            gs = sorted(({"label": g, "quotes": qs, "count": len(qs)} for g, qs in groups), key=lambda g: -g["count"])
            cats.append({"id": cid, "kind": kind, "title": title, "nominees": singles, "groups": gs,
                         "empty": sum(1 for a in raw if a in NON_ANSWERS)})
            continue
        counts = Counter()
        quotes = {}
        for a in raw:
            if not a:
                continue
            target = ALIASES.get(a, a)
            for t in (target if isinstance(target, list) else [target]):
                counts[t] += 1
                if a != t and a not in NON_ANSWERS and len(a) > len(t):
                    quotes.setdefault(t, []).append(a)
        results = [{"label": k, "votes": v, "quotes": quotes.get(k, [])} for k, v in counts.most_common()]
        levels = sorted({r["votes"] for r in results if r["label"] not in NON_ANSWERS}, reverse=True)[:3]
        podium = [[r["label"] for r in results if r["votes"] == lv and r["label"] not in NON_ANSWERS] for lv in levels]
        cats.append({"id": cid, "kind": kind, "title": title, "results": results,
                     "podium": [{"votes": lv, "names": names} for lv, names in zip(levels, podium)]})

    mentions = Counter()
    for r in data:
        for a in r[1:]:
            for p in PEOPLE:
                if p in a:
                    mentions[p] += 1
    cfg_path = Path(SRC).with_name("config.json")  # names, slogan and photo choices stay private
    cfg = json.load(open(cfg_path, encoding="utf-8")) if cfg_path.exists() else {}
    import wave  # announcer line lengths, so title cards can fit their line
    voice = {}
    for f in sorted(Path("private/audio/wav").glob("v_*.wav")):
        with wave.open(str(f)) as w:
            voice[f.stem] = round(w.getnframes() / w.getframerate(), 3)
    out = OrderedDict(meta=cfg, voice=voice, voters=len(data), categories=cats,
                      mentions=[{"name": k, "count": v} for k, v in mentions.most_common()], people=PEOPLE)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    for c in cats:
        if c["kind"] == "text":
            print(c["title"], "| winner:", c["groups"][0]["label"] if c["groups"] else "-", "| nominees:", len(c["nominees"]))
        else:
            print(c["title"], "|", " / ".join(f'{",".join(p["names"])} ({p["votes"]})' for p in c["podium"]))
    print("mentions:", out["mentions"][:6])


if __name__ == "__main__":
    main()
