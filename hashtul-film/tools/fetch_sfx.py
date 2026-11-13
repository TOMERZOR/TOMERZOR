"""Download the ElevenLabs takes listed in audio/src/eleven_urls.json into audio/src/eleven/<sound>_<n>.mp3."""
import json, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parent.parent
urls = json.loads((ROOT / "audio/src/eleven_urls.json").read_text())
out = ROOT / "audio/src/eleven"; out.mkdir(parents=True, exist_ok=True)
for name, lst in urls.items():
    for i, u in enumerate(lst):
        f = out / f"{name}_{i + 1}.mp3"
        r = subprocess.run(["curl", "-sS", "-m", "60", "-o", str(f), "-w", "%{http_code}", u], capture_output=True, text=True)
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout.strip()
        print(f"{f.name:18s} {r.stdout} {dur}s")
