# QA gate: out/katana-shard-v2_v4.mp4 (v4, pops and pings instead of glass)

Why v4: after v3 the viewer asked to switch the glass sound for a satisfying other sound. v4 changes the sound only; the
picture is v2's, stream-copied.

Delivered file: H.264 High, 27.17 MB, 4.49 Mb/s (remux of out/comp.mp4 = v3's video stream + the new audio/mix.m4a).

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Frame count | PASS | ffprobe -count_frames: 1452 = output_target.frames 1452 |
| 2 | Presentation timing | PASS | r_frame_rate = avg_frame_rate = 30/1; video PTS 0.000 .. 48.3667 (CFR); audio starts at 0.000 |
| 3 | Duration and ending | PASS | format 48.400 s; video 48.400 s; audio 48.400 s; ending unchanged |
| 4 | Format and color | PASS | 1920x1080, SAR 1:1, yuv420p, tv range, bt709 primaries / transfer / matrix |
| 5 | Audio | PASS | AAC-LC 48 kHz stereo, -12.9 LUFS integrated, LRA 6.1 LU, true peak -1.9 dBTP on the encoded file; the mux is a stream copy (audio packet md5 e37df53e... equal to audio/mix.m4a). Measured, not listened |
| 6 | Complete visual coverage | PASS (inherited) | the video stream is byte-identical to v3's and v2's (packet md5 69ed2f14... in all three), so v2's full-frame review holds (qa/gate_v2.md) |
| 7-19 | Story, text, look, cuts, ranges, logic | PASS / N/A (inherited) | unchanged picture: see qa/gate_v2.md |
| 20 | No glass | PASS | tools/build_mix.py plays no glass file (the game's glass samples, the Kenney glass, the reversed glass and the Pixabay sparkle are all gone); the levels' breaks are pops and pings (capture/stems.py) |
| 21 | Harshness | PASS | table below: the effects' 2-6 kHz peak is lower at every moment (1.5-20 dB); the mix's 99th percentile drops from 42.9 to 40.8 dB at 2-6 kHz and from 40.5 to 39.5 dB at 6-14 kHz. Where harsh.py's "jump over the surroundings" rose (8.5 s, 11.4 s, the level 4 and ember chains), the peak itself is unchanged within 0.5 dB (the music) and the surroundings got 0.1-3.4 dB quieter |
| 22 | In tune | PASS | the music holds A = 440 Hz (-1.9 cents, qa/breaks/notes.py); each ping is set to a note the music holds at that moment (below); ping1 rings 15 cents flat and is corrected by speed |
| 23 | Heard, not buried | PASS | big breaks 7.5-10 dB over the music in their own band, sparkles 8 dB, small pops about 3 dB, opening pings 5-6.5 dB (qa/breaks/bands.py) |
| 24 | Clicks | PASS | spectrogram qa/breaks/spec_v3_v4.jpg (7-13.5 s and 40-44.6 s, v3 over v4): no new vertical lines; the high glass haze and the 42-44 s twinkles are gone, the pings show as clean tones under 2 kHz; reversed sounds start from silence (60 ms fade-in) |

## What changed in the sound
- New break sounds made for the film with ElevenLabs sound effects (repo: capture/sfx/, CREDITS.md): a deep soft pop,
  two bell pings (A6) and four small round pops, all mellow (spectral centre 0.5-1.8 kHz, at most 0.1 % of their energy
  above 4 kHz).
- The film's breaks (tools/build_mix.py, one bus in the game's small room): a big break is the deep pop plus a ping on a
  note the music holds there (drop G6, tower burst F6, frame break A6, pendants D6, logo D6 and A6 together); small
  cracks are single pops; the glass city opens with three quiet pings rising D-F-A; the three sparkles are a quick D-F-A
  of pings; the swell into "SHATTER." and the rewind are the deep pop reversed, and the second rewind swell is the F6 ping
  reversed so it lands on its own ring at 41.81 s.
- The levels' sound (capture/stems.py): a small piece pops, a big one pops with a ping on the chain's note, folded into
  C6-C7 (folded around A6 its top notes sat at 2.1-2.4 kHz, 7-10 dB up in that band); the chain bells climb D minor
  pentatonic and the level-clear chime is F major, in the music's key; mix gains +1.6 dB for the new fixed stem level
  (STEM_GAIN 0.5), so the cannon and bombs stay where they were.
- Levels set per moment against the music inside each sound's own band (qa/breaks/calib.py, bands.py), because the old
  glass got through above 6 kHz while the new sounds share the music's range.

## Each moment, v3 -> v4 (the break bus on its own; loudness = loudest 150 ms, K-weighted; band = the sound's loudest band against the music and other effects)
| Moment | Sound in v4 | Loudness, LUFS | Over the music in its band, dB |
|---|---|---|---|
| glass city 0.03 / 1.21 / 2.18 s | pings D6, F6, A6 | -46.8 / -40.3 / -41.6 -> -35.6 / -39.7 / -34.7 | 13.8 / -6.6 / 5.0 -> 25.4 / 6.5 / 5.1 (the music has barely started at 0.03 s) |
| impact on the drop 7.74 s | deep pop + ping G6 | -21.2 -> -21.6 | 7.9 -> 9.9 |
| crack 8.52 s | pop | -38.2 -> -31.7 | -8.1 -> 2.8 |
| tower burst 8.71 s | deep pop + ping F6 | -26.2 -> -23.4 | -0.3 -> 7.7 |
| swell into SHATTER. 9.58 s | deep pop reversed | -23.6 -> -25.4 | 7.2 -> 7.3 |
| sparkle 9.70 s | pings D-F-A | -14.1 -> -20.2 | 13.4 -> 8.0 |
| crack 11.37 s | pop | -33.0 -> -34.0 | -3.6 -> 2.9 |
| frame breaks 11.61 s | deep pop + ping A6 | -22.3 -> -18.9 | 2.7 -> 7.5 |
| dawn arrival sparkle 19.86 s | pings D-F-A | -16.1 -> -23.7 | 5.5 -> 8.0 |
| night arrival 30.97 s | ping A6 | -36.0 -> -23.8 | -2.3 -> 2.7 |
| pendants 31.77 s | deep pop + ping D6 | -27.6 -> -19.2 | -1.8 -> 7.7 |
| rewind 41.28 / 41.81 s | deep pop reversed / ping F6 reversed into ping F6 | -24.0 / -24.8 -> -23.4 / -22.6 | 6.7 / 8.5 -> 7.1 / 7.3 |
| logo 42.58 s | deep pop + pings D6 and A6 | -22.9 -> -17.4 | 3.5 -> 10.1 |
| logo sparkle 43.26 s | pings D-F-A | -15.1 -> -21.7 | 13.5 -> 8.1 |

## Harshness, v3 -> v4 (qa/glass/harsh.py: the effects' loudest 2-6 kHz level in the window, dB)
| Moment | Effects 2-6 kHz | Mix 2-6 kHz peak |
|---|---|---|
| impact on the drop 7.74 s | 33.4 -> 15.6 | 39.4 -> 35.9 |
| crack 8.5 s / burst 8.71 s | 29.0 / 29.3 -> 19.5 / 19.5 | 37.5 / 40.7 -> 37.5 / 40.4 |
| frame breaks 11.61 s | 30.1 -> 19.6 | 39.8 -> 37.0 |
| level 4 chain 15.4-16.9 s | 32.8 -> 26.9 | 39.1 -> 39.1 |
| dawn arrival 19.84 s | 39.9 -> 19.3 | 43.9 -> 41.1 |
| ember chain 23.3 s | 33.0 -> 31.5 | 42.6 -> 42.7 |
| night pendants 28.2 s / last piece 30.06 s | 35.1 / 33.7 -> 21.4 / 26.5 | 40.2 / 37.8 -> 39.2 / 36.4 |
| night arrival 30.97 s / pendants 31.77 s | 22.4 / 23.0 -> 7.6 / 18.7 | 36.9 / 38.4 -> 36.9 / 38.0 |
| rewind 41.81 s | 27.5 -> 20.4 | 35.6 -> 35.5 |
| logo 42.58 s | 32.4 -> 23.8 | 35.0 -> 32.8 |

No BLOCK or FIX items open. Fresh-eyes review: not run (optional).
