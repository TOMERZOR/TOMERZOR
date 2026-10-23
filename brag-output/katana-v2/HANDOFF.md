# SHARD launch film v2: handoff for the next chat

> For Claude in a new chat: read this file fully, then PROMPTS.md. Resume the workspace with
> `source "$HF_WORKFLOWS/katana/scripts/rr.sh"` and `rr_restore katana-shard-v2 '<state url>'` (the URL is in the
> chat message that delivered v1; the archive is katana-shard-v2_v1_state.tar.gz). Talk to the user in English, briefly.

## 1. What this is
No reference video. The user asked: "Make a totally new one with katana use credits and do amazing motion graphics and a
wow effect on people. Plan yourself first then get to work". The subject is SHARD, the user's mobile glass-breaking physics
puzzle game (its gameplay captures, level maps, 12 ball skins and app icon are in src/game/). Earlier request carried over:
high energy, music, sharp quick motion graphics, sound effects, clean and in Apple's design style, landscape 16:9.

## 2. Current state
| Version | File | Frames · fps · size | Audio | What changed |
|---|---|---|---|---|
| v1 | out/katana-shard-v2_v1.mp4 (22.7 MB) | 987 · 30 · 1920x1080 | Take this Higher + effects, -13.0 LUFS, -1.5 dBTP | first cut |
Feedback status: v1 delivered 2026-10-23, no feedback yet.

## 3. Decisions
- User: Katana with paid generation; a new film; amazing motion graphics and wow; landscape 16:9; Apple-clean.
- Authored (not user decisions): 32.9 s at 30 fps; photoreal generated glass worlds rhyming with the real game; Nunito type;
  music "Take this Higher" (Mixkit, asset 1012) from 0 s at its own 124 BPM; spending cap 640 credits (internal).

## 4. Structure (no reference breakdown)
Beat grid t(b) = -0.0016 + 0.48388 b. Glass world in near silence with "Everything here / is glass." (0-3.1) > the steel
ball, "Aim." with a target lock, "Fire." (3.1-7.3) > the ball flies into the glass needle on the drop (7.74): flash, shake,
slow-motion burst, "SHATTER." cracks and breaks, the shards fly back as the SHARD wordmark (b20) + "The physics puzzle game."
> the frame cracks and breaks away to the phone, "Chain reactions." (11.6) > each level zooms through the phone screen
into the same world made real (dawn towers, ember blasts, night pendants, "One perfect shot.") with whip pans back to the
next level > 5 phones, "5 worlds. 120 levels." (19.4) > "12 balls." orbit (21.3) > one shot per beat (23.2-27.3) > a white-out
and the shatter rewinding in the music's break > the icon slams on the second drop (29.03) > SHARD, "Coming soon to iPhone &
Android." > fade with the music.

## 5. Pipeline as executed
- 4 location stills (Soul Cinematic 2k, 2 takes each, ember re-rolled once), judged in qa/styleframes.json.
- 5 Seedance 2.5 shots (omni reference, 1080p, no audio): plate_A1 10 s (macro glide; the ball rolling), plate_A2 6 s
  (impact and burst), plate_B 5 s (dawn chain), plate_C 4 s (ember blasts), plate_D 4 s (night pendants). Logic pages in qa/logic.
- The film is one code-driven page: motion/index.html + lib.js (easing, fracture, 3D phone) + edit.js (every footage
  placement, screen time -> source seconds) + film.js (shots, transitions, type, post), rendered with
  `comp/page_render.py`. Footage comes from plates/<id>/ frame folders (render.py prep).
- Sound: tools/build_mix.py (music edit, CC0 library effects via sfx.py bed, the game's own sounds synced to the
  gameplay on screen, ducking, limiter) -> audio/mix.m4a. Licences: audio/sfx_licenses.txt, src/mixkit-music-license.txt,
  src/sfx/assets/sfx/CREDITS.md.

## 6. How to resume and re-render
```
source "$HF_WORKFLOWS/katana/scripts/rr.sh"; rr_restore katana-shard-v2 '<state url>'; cd ~/rr/katana-shard-v2
# re-create the frame folders if missing (prep is free):
for c in A1 A2 B C D; do python3 $RR/comp/render.py prep . gen/plate_$c.mp4 --clip p_$c --quality 2; done
for c in hero ember night map0 map1 map2 map3 map4; do python3 $RR/comp/render.py prep . src/game/clips/$c.mp4 --clip g_$c --height 1600 --quality 3; done
python3 tools/build_mix.py                          # sound
node tools/uses.js && python3 $RR/prodcheck.py ranges . --uses qa/uses.json
python3 $RR/comp/page_render.py render . --jobs $(nproc)   # out/comp.mp4 (use an XL sandbox: ~3.5 min)
python3 $RR/deliver.py out/comp.mp4 out/katana-shard-v2_v2.mp4
```
Text, timing, colour and sound changes need no new generation (0 credits).

## 7. Files in the workspace
analysis/task-contract.json, plan/creative-plan.json, plan/gen_plan.json, plan/prompts/, plan/ledger.json,
plan/ledger_summary.md, plan/transactions.json, qa/styleframes.json, qa/logic/, qa/uses.json, qa/ranges.json,
qa/gate_v1.md, qa/inspection_v1.json, qa/v1/ (sheets, crops), motion/, tools/, comp/sfx_cues.json, audio/.

## 8. Higgsfield ids
| What | Job / media id | Result | Used in |
|---|---|---|---|
| studio still | cd027d86-ae1e-40a8-b902-714ca1750191 | soul_cinematic | plate_A1, plate_A2 |
| dawn still | 3b35d06e-626d-4690-9e2c-c70e9f2db0a8 | soul_cinematic | plate_B |
| ember still (re-roll) | fcddc59f-fa7e-46ca-887f-e2458cb783a5 | soul_cinematic | plate_C |
| night still | 0dfb3354-579c-4026-8f5d-048f4c58b1e3 | soul_cinematic | plate_D |
| plate_A1 | 54bba259-5f84-44a1-96d9-05db71da872c | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_072627_54bba259-5f84-44a1-96d9-05db71da872c.mp4 | 0-7.26 s |
| plate_A2 | d1e299d5-774e-4780-9060-49cb5f7962a5 | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071358_d1e299d5-774e-4780-9060-49cb5f7962a5.mp4 | 7.26-12.5, 25.16, 27.34-29.03, poster |
| plate_B | 25bd720f-bb93-4097-a664-90b907b3b753 | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071432_25bd720f-bb93-4097-a664-90b907b3b753.mp4 | 13.55, 23.23, 27.10 |
| plate_C | f98b353b-6724-44f3-918d-56c0dc90f8c6 | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_072228_f98b353b-6724-44f3-918d-56c0dc90f8c6.mp4 | 15.48, 24.19 |
| plate_D | d2aeadd5-4c81-48d5-b775-badfb7b7c2d5 | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071447_d2aeadd5-4c81-48d5-b775-badfb7b7c2d5.mp4 | 17.42, 26.13 |
Unused takes: c965a2ca (studio), 372fd544 (dawn), a0900deb (night), 76fbf5a1 and 62a2dbc7 (ember, judged rewrite).

## 9. Timing
Moments inside each shot (source seconds): A1 shot cut at 4.0; A2 impact at 1.125 (frame 27), unusable 3.85-4.30;
B pillar burst 1.2, haze from 3.9; C sparks 0.5, blasts 1.5-4.0; D pendants light 1.0-2.0, burst on the floor 2.4-3.0.

## 10. Gotchas met in this project
- Seedance prompts set in a dark room bounce to the "IN THE DARK" preset suggestion without creating a job: preflight
  with get_cost and resubmit with declined_preset_id 24bae836-2c4a-48e0-89b6-49fcc0b21612.
- The Pro plan allowed 3 Seedance jobs at once here (the 4th returned 429 rate_limit_reached, no charge).
- In plate_A2 the steel ball turns into a flat black disc for a moment (3.85-4.30 s); it is never on screen.
- `pkill -f page_render.py` from a sandbox command kills that command's own shell; kill by pid instead.

## 11. Authored adaptations and limitations
Authored: new story, 32.9 s, new text, music from the Mixkit library. No open production defects in the v1 gate.
Audio was measured, not listened to.

## 12. Spend
Quoted 465.08 · charged 465.08 (reconciled with transactions, 14 jobs matched, no refunds) · 464.48 in the film ·
0.6 on five unused still takes. 14.1 credits per second of film. Seedance on-screen use 19.4 s of 29 s generated (67 %).
Balance 945.44 before, 466.36 after (14 credits of other image jobs on the account at 07:32-07:34 belong to another chat).
Full table: plan/ledger_summary.md.

## 13. Remaining limitations
None recorded.
