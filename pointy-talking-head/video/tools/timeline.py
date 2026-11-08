"""timeline.py → film/timeline.json: every segment's place in the film and every word's film time (for subtitles)."""
import json
S = "/tmp/claude-0/-home-user-TOMERZOR/57893ae3-acda-505c-b44d-0e56fba7243b/scratchpad"
edl = json.load(open(f"{S}/edl.json"))["segments"]; W = json.load(open(f"{S}/words.json"))
FIX = {"ה": None, "-CT": "עשיתי", "בווינדאוויז.": "בווינדוס.", "לתגובות": "בתגובות", "אפקט,": "אפקטס,", "חמש": "5", "ארבע": "14", "עשר": None, "ומחשב": "ובמחשב", "אלט": "Alt."}
t = 0.0; segs = []; words = []; chunkstart = {}
for s in edl:
    d = s["t1"] - s["t0"]; chunkstart.setdefault(s["chunk"], t)
    segs.append({**s, "film0": round(t, 3), "film1": round(t + d, 3), "chunk0": round(t - chunkstart[s["chunk"]], 3)})
    for w0, w1, txt, p in W[s["take"]]:
        if min(w1, s["t1"]) - max(w0, s["t0"]) < 0.5 * (w1 - w0): continue
        if txt in FIX:
            txt = FIX[txt]
            if txt is None: continue
        words.append({"t0": round(t + max(w0, s["t0"]) - s["t0"], 3), "t1": round(t + min(w1, s["t1"]) - s["t0"], 3), "w": txt, "seg": s["id"]})
    t += d
json.dump({"dur": round(t, 3), "segments": segs, "words": words}, open(f"{S}/film/timeline.json", "w"), ensure_ascii=False, indent=1)
for s in segs: print(f"{s['id']:3} {s['film0']:6.2f}–{s['film1']:6.2f}  " + " ".join(w["w"] for w in words if w["seg"] == s["id"]))
print("dur", round(t, 3))
