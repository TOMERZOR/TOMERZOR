"""Search Openverse for real recordings (CC0 / CC BY only) and print candidates.
usage: python3 ov_search.py "query" [max_dur_s] [n]"""
import json, sys, urllib.parse, urllib.request
q = sys.argv[1]; maxd = float(sys.argv[2]) if len(sys.argv) > 2 else 30; n = int(sys.argv[3]) if len(sys.argv) > 3 else 12
url = "https://api.openverse.org/v1/audio/?" + urllib.parse.urlencode({"q": q, "license": "cc0,by", "page_size": 20})
req = urllib.request.Request(url, headers={"User-Agent": "pointy-sfx-research/0.1"})
r = json.load(urllib.request.urlopen(req, timeout=30))
out = []
for it in r.get("results", []):
    d = (it.get("duration") or 0) / 1000
    if d and d > maxd: continue
    out.append({"id": it["id"], "title": it["title"], "dur": round(d, 2), "lic": it["license"], "src": it["source"], "creator": it.get("creator"),
                "url": it["url"], "page": it.get("foreign_landing_url"), "fmt": it.get("filetype")})
for o in out[:n]:
    print(f'{o["dur"]:6.2f}s {o["lic"]:4} {o["src"]:10} {o["title"][:60]:60} | {o["creator"]} | {o["page"]} | {o["url"]}')
json.dump(out, open(f"search_{q.replace(' ', '_')[:40]}.json", "w"), indent=1)
