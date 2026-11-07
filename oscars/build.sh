#!/usr/bin/env bash
# Builds the Oscars video end to end. Needs: Python (numpy, scipy), Node + Playwright, ffmpeg,
# and the private inputs in private/ (votes.csv, photos/, faces/, audio/wav/).
set -euo pipefail
cd "$(dirname "$0")"
OUT=private/out
mkdir -p "$OUT"
python3 build-data.py private/votes.csv private/data.json
python3 -m http.server 8811 --bind 127.0.0.1 >/dev/null 2>&1 & SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
node render.mjs "$OUT/frames.mp4" --workers "${WORKERS:-6}"
python3 audio.py "$OUT/sfx.json" "$OUT/marks.json" "$OUT/audio.wav"
# poster frame: the opening title card
ffmpeg -v error -y -ss 12.5 -i "$OUT/frames.mp4" -frames:v 1 -q:v 2 "$OUT/poster.jpg"
# full quality: video copied, audio loudness-normalized to -14 LUFS
ffmpeg -v error -y -i "$OUT/frames.mp4" -i "$OUT/audio.wav" -map 0:v -map 1:a -c:v copy \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 224k -ar 48000 -shortest -movflags +faststart "$OUT/oscars-1080p.mp4"
# light version for WhatsApp
ffmpeg -v error -y -i "$OUT/oscars-1080p.mp4" -vf scale=1280:720 -c:v libx264 -preset slow -crf 26 -tune film \
  -c:a aac -b:a 128k -movflags +faststart "$OUT/oscars-720p.mp4"
ls -lh "$OUT"/oscars-*.mp4
