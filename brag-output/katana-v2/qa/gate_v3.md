# QA gate: out/katana-shard-v2_v3.mp4 (v3, softer glass)

Why v3: the viewer found the glass-breaking sound harsh and annoying. v3 changes the sound only; the picture is v2's,
stream-copied.

Delivered file: H.264 High, 27.17 MB, 4.49 Mb/s (remux of out/comp.mp4 = v2's video stream + the new audio/mix.m4a).

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Frame count | PASS | ffprobe -count_frames: 1452 = output_target.frames 1452 |
| 2 | Presentation timing | PASS | r_frame_rate = avg_frame_rate = 30/1; video PTS 0.000 .. 48.3667 (CFR); audio starts at 0.000 |
| 3 | Duration and ending | PASS | format 48.400 s; video 48.400 s; audio 48.400 s; ending unchanged from v2 |
| 4 | Format and color | PASS | 1920x1080, SAR 1:1, yuv420p, tv range, bt709 primaries / transfer / matrix |
| 5 | Audio | PASS | AAC-LC 48 kHz stereo, -12.9 LUFS integrated, LRA 6.2 LU, true peak -1.9 dBTP on the encoded file; the mux is a stream copy (audio packet md5 30f4f0db... equal to audio/mix.m4a). Measured, not listened |
| 6 | Complete visual coverage | PASS (inherited) | the video stream is byte-identical to v2's (packet md5 69ed2f14... in both files), so v2's full-frame review holds (qa/gate_v2.md, qa/v2/) |
| 7-19 | Story, text, look, cuts, ranges, logic | PASS / N/A (inherited) | unchanged picture: see qa/gate_v2.md |
| 20 | Glass harshness | PASS | table below: every glass moment lost 5.6-11 dB in the 2-6 kHz band (where the ear is most sensitive) and 4.6-11 dB above 6 kHz; the glass now sits under the music in that band everywhere except the night level's pendants, where the music is in its break; spectrogram qa/glass/spec_7_19.jpg (old over new) shows no new clicks |

## What changed in the sound
- Every glass break runs through one bus: a presence dip (-5 dB at 3.4 kHz), a gentler top (-5 dB shelf from 7 kHz,
  low-pass at 12 kHz) and the game's own small room (js/audio.js: 1.6 s of decaying noise, Web Audio normalisation).
- Fewer layers: the burst of three glass tinks at 8.5 s is one soft crack; the second and third layers at 11.4 s are gone;
  the brightest glass ting (spectral centre 7.3 kHz) is replaced by a soft glass hit at 30.97 s and 41.81 s and sits 6 dB
  lower at 1.21 s.
- Lower levels: the library glass 4-7.5 dB down; the game's own glass at the big hits from 0 / -3 / -2 dB to -6 / -9 / -8 dB.
- The three levels' sound (capture/stems.py) now follows the game's own rules: a break is quieter when more than three
  overlap and is dropped when it lands on five others within 20 ms; the chain's bells are the game's chime; the wall
  bounces get the game's soft tap and the last piece its slow-motion sigh; the glass is softened like the bus and sits
  4 dB under the bells; all three stems share one fixed level (each was normalised to its own loudest break before,
  which had pulled the glass back up). Their mix gains keep the cannon, bombs and bells where they were (matched on the
  cannon shot).

## Glass and game sounds, before -> after (loudest band level in the window as it sits in the mix, dB; qa/glass/layers.py)
| Moment | 2-6 kHz | 6-14 kHz | Music in the window (2-6 / 6-14 kHz) |
|---|---|---|---|
| impact on the drop 7.74 s | 47.7 -> 36.9 | 44.0 -> 32.7 | 39.7 / 42.7 |
| SHATTER. breaks 8.71 s | 43.8 -> 32.8 | 43.6 -> 32.7 | 40.5 / 36.5 |
| frame breaks to the game 11.61 s | 44.8 -> 33.6 | 49.2 -> 38.1 | 42.2 / 43.1 |
| level 4 chain 15.4-16.9 s | 45.2 -> 36.3 | 45.5 -> 35.3 | 39.6 / 42.9 |
| ember chain 23.3-24.8 s | 44.0 -> 36.5 | 41.5 -> 34.6 | 44.4 / 40.6 |
| night pendants 28.2 s | 47.4 -> 38.6 | 43.7 -> 39.1 | 39.1 / 31.0 |
| night last piece 30.06 s | 42.8 -> 37.2 | 39.4 -> 31.9 | 37.2 / 36.3 |
| logo 42.58 s | 45.7 -> 34.9 | 42.0 -> 30.7 | 35.6 / 34.6 |

No BLOCK or FIX items open. Fresh-eyes review: not run (optional).
