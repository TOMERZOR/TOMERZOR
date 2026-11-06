"""Listen to the downloaded recordings with earshot (models load once): for every file, the best takes for its
category's description (find), then on the best take: realness, and a match against the description with the
confusions we must avoid (a bark instead of a sigh, a clink instead of a sip). Writes listen.json.

usage: <earshot venv python> listen.py [category ...]
"""
import glob
import json
import os
import sys

from earshot import api

HERE = os.path.dirname(os.path.abspath(__file__))
Q = {
    "sigh": ("a dog sighing, one long breathy exhale through the nose", ["a dog barking", "a dog growling", "a person speaking"], "event"),
    "sip": ("a single sip and swallow of a drink", ["glasses clinking together", "liquid pouring", "a person speaking"], "event"),
    "slam": ("a heavy stack of paper dropped flat on a table, one thud", ["a door slamming", "a gunshot", "paper rustling"], "event"),
    "keyboard": ("a single laptop keyboard key press", ["a mouse click", "a typewriter key"], "event"),
    "riser": ("a cymbal swell rising in volume", ["a crash cymbal hit", "white noise"], "texture"),
    "whoosh": ("a fast air swish of a stick", ["wind", "a jet engine"], "event"),
    "click": ("a single computer mouse click", ["a keyboard key press", "a finger snap"], "event"),
    "pop": ("a soft round mouth pop", ["a gunshot", "a balloon burst"], "event"),
    "bell": ("a single glockenspiel note ringing", ["a doorbell", "a synthesizer beep"], "event"),
    "wood": ("a wooden block hit", ["a door knock", "a clap"], "event"),
    "impact": ("a deep soft drum hit", ["an explosion", "a door slam"], "event"),
    "room": ("quiet office room tone", ["rain", "traffic"], "texture"),
    "paper": ("a single page flip", ["paper crumpling", "a book dropped"], "event"),
    "dog": ("a dog sniffing", ["a dog barking", "a person breathing"], "event"),
}
cats = sys.argv[1:] or list(Q)
out_path = os.path.join(HERE, "listen.json")
res = json.load(open(out_path)) if os.path.exists(out_path) else {}
for cat in cats:
    q, alts, kind = Q[cat]
    for f in sorted(glob.glob(os.path.join(HERE, "assets", cat, "*.mp3"))):
        key = os.path.relpath(f, HERE)
        try:
            fd = api.find(f, q, top=3, kind=kind)
            segs = fd.get("segments") or fd.get("results") or []
            best = []
            for s in segs[:3]:
                a, b = s.get("start"), s.get("end")
                rl = api.realness(f, start=a, end=b)
                mt = api.match(f, q, alts=alts, start=a, end=b)
                best.append({"start": a, "end": b, "z": s.get("z"), "kind": s.get("kind"), "head": s.get("head"), "tail": s.get("tail"),
                             "notes": s.get("notes") or s.get("flags"), "real": rl.get("verdict"), "p_real": rl.get("p_real"),
                             "match": mt.get("verdict"), "match_z": mt.get("z"), "closest_alt": mt.get("closest_alt") or mt.get("alts")})
            res[key] = {"category": cat, "query": q, "takes": best}
            print(f"{key}")
            for b in best:
                print(f"   {b['start']:.2f}-{b['end']:.2f}  find z {b['z']}  real: {b['real']} ({b['p_real']})  match: {b['match']} z {b['match_z']}  head/tail {b['head']}/{b['tail']}")
        except Exception as e:                                         # noqa: BLE001
            print(key, "ERROR", e)
            res[key] = {"category": cat, "error": str(e)}
        json.dump(res, open(out_path, "w"), indent=1, default=str)
