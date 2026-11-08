import sys, json, glob, os, wave
import numpy as np
def load(f):
    w=wave.open(f); return np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
from faster_whisper import WhisperModel
m = WhisperModel("ivrit-ai/whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8", cpu_threads=4)
out = {}
for f in sorted(glob.glob(sys.argv[1] + "/*.wav")):
    segs, info = m.transcribe(load(f), language="he", word_timestamps=True, vad_filter=False, beam_size=5)
    words = []
    for s in segs:
        for w in s.words: words.append([round(w.start, 2), round(w.end, 2), w.word.strip(), round(w.probability, 2)])
    out[os.path.basename(f)[:-4]] = words
    print(os.path.basename(f), " ".join(w[2] for w in words), flush=True)
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
