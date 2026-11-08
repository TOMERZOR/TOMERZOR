#!/bin/bash
# build.sh [out.mp4] — face-corrected A-roll → frames → render (24 fps, motion blur) → audio mix muxed in
set -e
S=/tmp/claude-0/-home-user-TOMERZOR/57893ae3-acda-505c-b44d-0e56fba7243b/scratchpad; F=$S/film; OUT=${1:-$F/pointy-film.mp4}
rm -rf $F/aroll && mkdir -p $F/aroll
ffmpeg -v error -y -i $S/hf/fb_c1.mp4 -i $S/hf/fb_c2.mp4 -i $S/hf/fb_c3.mp4 -filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=0" -q:v 2 $F/aroll/f_%05d.jpg
echo "aroll frames: $(ls $F/aroll | wc -l)"
cd $F && python3 score.py | tail -1 && python3 /home/user/TOMERZOR/.claude/skills/onetake/scripts/render.py comp.html --width 1080 --height 1920 --fps 24 --samples 6 --out $F/_silent.mp4
ffmpeg -v error -y -i $F/_silent.mp4 -i $F/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $OUT
echo "wrote $OUT $(ffprobe -v error -show_entries format=duration -of csv=p=0 $OUT)s"
