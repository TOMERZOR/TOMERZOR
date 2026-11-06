"""Download chosen Openverse/Freesound candidates into assets/<cat>/ and write manifest.json (licence, author, page)."""
import json, os, urllib.request, urllib.parse
PICK = {  # category: freesound ids (already downloaded files are skipped)
 "sigh": [274841, 397882, 425905, 543165],
 "sip": [411973],
 "slam": [524752, 416416, 387929],
 "keyboard": [215744],
 "riser": [219836],
 "whoosh": [59995, 60026],
 "click": [467490, 347544],
 "pop": [573153, 258269],
 "bell": [11072, 11088, 349503],
 "wood": [218460],
 "impact": [82712],
 "room": [278154],
 "paper": [454707],
}
idx = {}
for f in os.listdir("."):
    if f.startswith("search_") and f.endswith(".json"):
        for it in json.load(open(f)):
            p = it.get("page") or ""
            if "freesound.org" in p:
                idx[int(p.rstrip("/").split("/")[-1])] = it
man = []
for cat, ids in PICK.items():
    os.makedirs(f"assets/{cat}", exist_ok=True)
    for i in ids:
        it = idx.get(i)
        if not it: print("missing in searches:", i); continue
        slug = "".join(c if (c.isascii() and c.isalnum()) else "-" for c in it["title"].lower())[:40].strip("-")
        dst = f"assets/{cat}/fs-{i}_{slug}.mp3"
        if not os.path.exists(dst):
            import subprocess
            r = subprocess.run(["curl", "-sS", "-f", "-o", dst, it["url"]], capture_output=True, text=True)
            if r.returncode: print("FAILED", i, it["url"], r.stderr.strip()); continue
            import time; time.sleep(6)                        # polite, sequential: Freesound blocks fast clients
        man.append({"file": dst, "category": cat, "source": "freesound via Openverse", "freesound_id": i, "title": it["title"],
                    "creator": it["creator"], "licence": it["lic"], "page": it["page"], "url": it["url"]})
json.dump(man, open("manifest.json", "w"), indent=1)
print(len(man), "files")
