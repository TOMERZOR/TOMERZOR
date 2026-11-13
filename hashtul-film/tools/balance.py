"""SFX vs music in each event's window (150 ms after the event): the action sounds must sit above the music."""
import json, pathlib
import numpy as np
from scipy.io import wavfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
sr, s = wavfile.read(ROOT / "audio/stem_sfx.wav"); _, m = wavfile.read(ROOT / "audio/stem_music.wav")
s = s.astype(float).mean(1); m = m.astype(float).mean(1)
ev = json.loads((ROOT / "audio/events.json").read_text())["events"]
rows = []
for e in ev:
    a = int(e["t"] * sr); b = a + int(0.15 * sr)
    rs = np.sqrt((s[a:b] ** 2).mean() + 1e-9); rm = np.sqrt((m[a:b] ** 2).mean() + 1e-9)
    rows.append((e["t"], e["kind"], 20 * np.log10(rs / rm)))
bad = [r for r in rows if r[2] < 3]
print(f"{len(rows)} events; median SFX-over-music {np.median([r[2] for r in rows]):.1f} dB; under +3 dB: {len(bad)}")
for r in bad[:40]: print(f"  {r[0]:6.2f}s {r[1]:12s} {r[2]:+.1f} dB")
