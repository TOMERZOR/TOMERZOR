# QA gate: out/katana-shard-v2_v1.mp4 (v1)

Delivered file: H.264 High, 22.68 MB, 5.51 Mb/s (deliver.py remux of out/comp.mp4: already under the 12 Mb/s cap).

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Frame count | PASS | ffprobe -count_frames: 987 = output_target.frames 987 |
| 2 | Presentation timing | PASS | r_frame_rate = avg_frame_rate = 30/1; video PTS 0.000 .. 32.8667 (CFR) |
| 3 | Duration and ending | PASS | format 32.900 s; audio 32.900 s; the end card holds to f960, fades to black f976-986 with the music's last-bar fade |
| 4 | Format and color | PASS | 1920x1080, SAR 1:1, yuv420p, tv range, bt709 primaries / transfer / matrix |
| 5 | Audio | PASS | AAC-LC 48 kHz stereo, -13.0 LUFS integrated, true peak -1.5 dBTP on the encoded file; mux is a stream copy (md5 5663fc13... equal to audio/mix.m4a). Measured, not listened |
| 6 | Complete visual coverage | PASS | qa/v1/sheet_00..20.jpg cover f0-986 (48 frames each, all viewed) + native crops qa/v1/crops f0, f44, f120, f180, f250, f320, f372, f545, f625, f660, f930 |
| 7 | Story | PASS | glass world (f1-94) > Aim/Fire (f95-217) > approach + impact on the drop (f218, f233) > SHATTER. breaks (f240-275) > SHARD assembles (f276-291) > frame breaks into the phone (f342-360) > game/world rhymes (f407-575) > 5 worlds, 120 levels (f581-638) > 12 balls (f639-696) > beat climax (f697-819) > rewind in the break (f820-870) > logo on the second drop (f871-986) |
| 8 | Identity and cast | N/A | no people anywhere (location stills checked for faces, every generated clip checked in qa/logic) |
| 9 | Text, logos and marks | PASS | all words as authored, Nunito 900/800 loaded (page check): Everything here / is glass. / Aim. / Fire. / SHATTER. / SHARD / The physics puzzle game. / Chain reactions. / One perfect shot. / 5 worlds. 120 levels. / 12 balls. / Coming soon to iPhone & Android.; the app icon is the game's own |
| 10 | Mask edges | N/A | no mattes |
| 11 | Bars and edges | PASS | no bars; shakes are zoom-compensated (f233-245, f349-356, f871-880 inspected); whips and zoom-throughs smear by design |
| 12 | Cadence | PASS | 24 fps Seedance shots at 1x use the nearest frame; the 0.45x slow motion (f233-348) and the rewind (f820-870) blend neighbouring frames |
| 13 | Text placement | PASS | no clipping; every line holds >= 0.9 s settled except Aim. (1.6 s) and Fire. (1.4 s) which are single words |
| 14 | Look | PASS | photoreal pastel glass worlds + clean light/dark stages; one type family; consistent flash/shake grammar on the big hits |
| 15 | Declared source reuse | N/A | none |
| 16 | Cut/event positions | PASS | cuts on the beat grid t(b) = -0.0016 + 0.48388 b: f218 (b15), f233 drop (b16), f240 (b16.5), f262 (b18), f291 (b20), f349 (b24), f407 (b28), f436 (b30), f465 (b32), f494 (b34), f523 (b36), f581 (b40), f639 (b44), f697 (b48) and one cut per beat to f820 (b56.5), f871 (b60) |
| 17 | Source frames used once | PASS | prodcheck.py ranges --uses qa/uses.json: RANGES OK, 29 placements from 13 sources (frame 0 is a poster built from A2 frame 90, used nowhere else) |
| 18 | Generation logic | PASS | qa/logic: plate_A1 ok, plate_A2 partial (3.85-4.30 s avoided), plate_B partial (3.9-5.04 s avoided), plate_C ok, plate_D ok |
| 19 | Energy vs reference | N/A | no reference video (authored film) |

No BLOCK or FIX items open. Fresh-eyes review: not run (optional).
