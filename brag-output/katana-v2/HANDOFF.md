# SHARD launch film v2: handoff for the next chat

> For Claude in a new chat: read this file fully, then PROMPTS.md. Resume the workspace with
> `source "$HF_WORKFLOWS/katana/scripts/rr.sh"` and `rr_restore katana-shard-v2 '<state url>'` (the URL is in the
> chat message that delivered the latest cut; the archive is katana-shard-v2_v2_state.tar.gz). Talk to the user in English, briefly.

## 1. What this is
No reference video. The user asked: "Make a totally new one with katana use credits and do amazing motion graphics and a
wow effect on people. Plan yourself first then get to work". The subject is SHARD, the user's mobile glass-breaking physics
puzzle game (gameplay captures, level maps, 12 ball skins and the app icon are in src/game/ and src/game2/). Earlier request
carried over: high energy, music, sharp quick motion graphics, sound effects, clean and in Apple's design style, landscape 16:9.
Feedback on v1: "It runs too fast and i can't quite understand what happens in the game itself. Fix that" (answered by v2).

## 2. Current state
| Version | File | Frames · fps · size | Audio | What changed |
|---|---|---|---|---|
| v1 | out/katana-shard-v2_v1.mp4 (22.7 MB) | 987 · 30 · 1920x1080 | Take this Higher + effects, -13.0 LUFS, -1.5 dBTP | first cut |
| v2 | out/katana-shard-v2_v2.mp4 (27.2 MB) | 1452 · 30 · 1920x1080 | same track, 48.4 s of it, -12.6 LUFS, -1.7 dBTP | slower: how to play on the real level 4, two more levels with captions, the per-beat climax removed |
Feedback status: v2 delivered 2026-10-23, no feedback yet.

## 3. Decisions
- User: Katana with paid generation; a new film; amazing motion graphics and wow; landscape 16:9; Apple-clean.
- User (on v1): slower, and make what happens in the game understandable.
- Authored (not user decisions): v1 32.9 s; v2 48.4 s at 30 fps (longer than the usual 15-25 s because the user asked for
  slower and clearer); photoreal generated glass worlds rhyming with the real game; Nunito type; music "Take this Higher"
  (Mixkit, asset 1012) from 0 s at its own 124 BPM; spending cap 640 credits (internal). v2 spent no credits.

## 4. Structure of v2 (no reference breakdown)
Beat grid t(b) = -0.0016 + 0.48388 b. Same as v1 to 11.6 s: glass world, "Everything here / is glass." (0-3.1) > the steel
ball, "Aim." with a target lock, "Fire." (3.1-7.3) > the ball flies into the glass needle on the drop (7.74): flash, shake,
slow-motion burst, "SHATTER." cracks and breaks, the shards fly back as SHARD (b20) + "The physics puzzle game." > the frame
cracks and breaks away to the phone (b24, 11.61). New in v2:
- HOW TO PLAY on level 4 (11.6-19.8): the phone pushes in to a close-up; a drawn finger pulls back over the game's own dotted
  aim line ("Pull back / to aim." 12.0), lets go ("Let go." 14.06), the ball chains through the pyramid to x10 ("Break all /
  the glass." 15.05), the game's level-clear sheet rises with 3 stars and "One shot." ("Clear it in / one shot." 17.05).
- Zoom through the screen into the dawn world (b41) > whip to level 82, WORLD 4 · EMBER, "Bombs set off / chain reactions."
  (b44; the bombs go at 23.6) > zoom into the ember courtyard (b53) > whip to level 112, WORLD 5 · NIGHT, "Bounce shots / off
  the walls." (b56.5; the shot fires 27.43, left wall 27.73, the second drop b60 lands on the right-wall bounce 29.03) >
  "Last piece? / Slow motion." (29.25; slow motion from 30.06) > zoom into the night pendants, "One perfect shot." (b64).
- 5 phones, "5 worlds. 120 levels." (b68) > "12 balls." orbit (b76) > a white-out and the shatter rewinding (b84) > the icon
  slams (b88) > SHARD, "Coming soon to iPhone & Android." on the hit at b92 (44.52) > fade with the music to 48.4.

## 5. Pipeline as executed
- 4 location stills (Soul Cinematic 2k, 2 takes each, ember re-rolled once), judged in qa/styleframes.json.
- 5 Seedance 2.5 shots (omni reference, 1080p, no audio): plate_A1 10 s (macro glide; the ball rolling), plate_A2 6 s
  (impact and burst), plate_B 5 s (dawn chain), plate_C 4 s (ember blasts), plate_D 4 s (night pendants). Logic pages in qa/logic.
- v2 gameplay, captured from the game (free): the repo's brag-output/capture/capture.mjs (gameClip2: hero2, ember2, night2)
  plays each level frame by frame at 1176x2532 with a slow, readable aim (2.2 s), keeps the level-clear sheet for hero2, and
  logs every sound event and aim angle (capture/<name>-sfx.json, <name>-aim.json); capture/stems.py rebuilds each level's
  sound from its log (the game's own samples, its FM bell and its win chime). Here: src/game2/{hero2,ember2,night2}.mp4 and
  game-*.mp3; motion/aims.js holds the logged aim angles that drive the drawn finger.
- The film is one code-driven page: motion/index.html + lib.js (easing, fracture, 3D phone) + aims.js + edit.js (every
  footage placement, screen time -> source seconds) + film.js (shots, transitions, type, finger, captions, post), rendered
  with `comp/page_render.py`. Footage comes from plates/<id>/ frame folders (render.py prep). v1's page is kept in
  motion_v1/, with tools/build_mix_v1.py and tools/uses_v1.js.
- Sound: tools/build_mix.py (music edit, CC0 library effects via sfx.py bed, the game's own sounds synced to the gameplay on
  screen, ducking, limiter) -> audio/mix.m4a. Licences: audio/sfx_licenses.txt, src/mixkit-music-license.txt,
  src/sfx/assets/sfx/CREDITS.md.

## 6. How to resume and re-render
```
source "$HF_WORKFLOWS/katana/scripts/rr.sh"; rr_restore katana-shard-v2 '<state url>'; cd ~/rr/katana-shard-v2
# re-create the frame folders if missing (prep is free):
for c in A1 A2 B C D; do python3 $RR/comp/render.py prep . gen/plate_$c.mp4 --clip p_$c --quality 2; done
for c in hero ember night map0 map1 map2 map3 map4; do python3 $RR/comp/render.py prep . src/game/clips/$c.mp4 --clip g_$c --height 1600 --quality 3; done
for c in hero2 ember2 night2; do python3 $RR/comp/render.py prep . src/game2/$c.mp4 --clip g_$c --native --quality 3; done
python3 tools/build_mix.py                          # sound
node tools/uses.js && python3 $RR/prodcheck.py ranges . --uses qa/uses.json
python3 $RR/comp/page_render.py render . --jobs $(nproc)   # out/comp.mp4 (use an XL sandbox: ~4 min)
python3 $RR/deliver.py out/comp.mp4 out/katana-shard-v2_v3.mp4
```
Text, timing, colour and sound changes need no new generation (0 credits). If src/game2 is missing, the captures are in
the user's repo (brag-output/composition/assets/clips/*2.mp4 are git-ignored; re-run capture.mjs hero2 ember2 night2 with
shard/ served on port 8080, then stems.py hero2 ember2 night2).

## 7. Files in the workspace
analysis/task-contract.json, plan/creative-plan.json, plan/gen_plan.json, plan/prompts/, plan/ledger.json,
plan/ledger_summary.md, plan/transactions.json, qa/styleframes.json, qa/logic/, qa/uses.json, qa/ranges.json,
qa/gate_v1.md, qa/inspection_v1.json, qa/v1/ (sheets, crops), qa/gate_v2.md, qa/inspection_v2.json, qa/v2/ (sheets, crops,
the per-frame comparison of the night retime), motion/, motion_v1/, tools/, comp/sfx_cues.json, audio/, src/game2/.

## 8. Higgsfield ids
| What | Job / media id | Result | On screen in v2 |
|---|---|---|---|
| studio still | cd027d86-ae1e-40a8-b902-714ca1750191 | soul_cinematic | plate_A1, plate_A2 |
| dawn still | 3b35d06e-626d-4690-9e2c-c70e9f2db0a8 | soul_cinematic | plate_B |
| ember still (re-roll) | fcddc59f-fa7e-46ca-887f-e2458cb783a5 | soul_cinematic | plate_C |
| night still | 0dfb3354-579c-4026-8f5d-048f4c58b1e3 | soul_cinematic | plate_D |
| plate_A1 | 54bba259-5f84-44a1-96d9-05db71da872c | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_072627_54bba259-5f84-44a1-96d9-05db71da872c.mp4 | 0-7.26 s |
| plate_A2 | d1e299d5-774e-4780-9060-49cb5f7962a5 | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071358_d1e299d5-774e-4780-9060-49cb5f7962a5.mp4 | 7.26-12.46, 40.65-42.58, poster |
| plate_B | 25bd720f-bb93-4097-a664-90b907b3b753 | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071432_25bd720f-bb93-4097-a664-90b907b3b753.mp4 | 19.84-21.29 |
| plate_C | f98b353b-6724-44f3-918d-56c0dc90f8c6 | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_072228_f98b353b-6724-44f3-918d-56c0dc90f8c6.mp4 | 25.64-27.34 |
| plate_D | d2aeadd5-4c81-48d5-b775-badfb7b7c2d5 | https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071447_d2aeadd5-4c81-48d5-b775-badfb7b7c2d5.mp4 | 30.97-32.90 |
Unused takes: c965a2ca (studio), 372fd544 (dawn), a0900deb (night), 76fbf5a1 and 62a2dbc7 (ember, judged rewrite).

## 9. Timing
Moments inside each shot (source seconds): A1 shot cut at 4.0; A2 impact at 1.125 (frame 27), unusable 3.85-4.30;
B pillar burst 1.2, haze from 3.9; C sparks 0.5, blasts 1.5-4.0; D pendants light 1.0-2.0, burst on the floor 2.4-3.0.
Game captures (30 fps): hero2 (level 4) aim 1.0-3.2, fire 3.2, x10 chain, win and sheet 7.17; ember2 (level 82) fire 2.8,
first bomb 4.63, chain 4.8-5.0, slow motion 6.5, win 7.73; night2 (level 112) fire 2.8, walls 3.1 and 4.4, pendants
3.53-4.0, last piece and slow motion 5.43, win 6.67. In v2 they start at 0.75 (hero2), 2.3 (ember2) and 2.708 (night2).

## 10. Gotchas met in this project
- Seedance prompts set in a dark room bounce to the "IN THE DARK" preset suggestion without creating a job: preflight
  with get_cost and resubmit with declined_preset_id 24bae836-2c4a-48e0-89b6-49fcc0b21612.
- The Pro plan allowed 3 Seedance jobs at once here (the 4th returned 429 rate_limit_reached, no charge).
- In plate_A2 the steel ball turns into a flat black disc for a moment (3.85-4.30 s); it is never on screen.
- `pkill -f page_render.py` from a sandbox command kills that command's own shell; kill by pid instead.
- rrio.py sheet --end is exclusive (use start+48 for 48-frame sheets).
- A sandbox call returns a timeout after about 60 s whatever timeout_seconds says; poll background work with short sleeps.
- The game's assembly "tink" sounds run on wall-clock timers during capture, so their logged times are not the picture's;
  stems.py leaves them out.

## 11. Authored adaptations and limitations
Authored: new story, 48.4 s (v2), new text, music from the Mixkit library, the drawn finger (a circle, not a hand) driven by
the logged aim angles. No open production defects in the v2 gate. Audio was measured, not listened to.

## 12. Spend
v1: quoted 465.08 · charged 465.08 (reconciled with transactions, 14 jobs matched, no refunds) · 464.48 in the film · 0.6 on
five unused still takes. Balance 945.44 before, 466.36 after (14 credits of other image jobs on the account at 07:32-07:34
belong to another chat). Full table: plan/ledger_summary.md. v2: 0 credits (a re-cut of the same shots plus new captures from
the game). Seedance on-screen use in v2: 19.5 s of 29 s generated (67 %).

## 13. Remaining limitations
None recorded.
