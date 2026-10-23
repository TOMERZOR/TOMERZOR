# QA gate v1: out/katana-shard-1023_v1.mp4

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Frame count | PASS | 675 decoded frames = output_target 675 |
| 2 | Presentation timing | PASS | CFR 30/1, video PTS 0.000-22.433, 675 packets |
| 3 | Duration and ending | PASS | video ends 22.467 (container 22.5); audio 22.5 s, planned 1.5 s fade to the bar line, RMS -53.7 dB at 22.375 |
| 4 | Format and color | PASS | 1920x1080 SAR 1:1 yuv420p, bt709 primaries/transfer/matrix |
| 5 | Audio | PASS | AAC-LC 48 kHz stereo; -12.8 LUFS, true peak -1.5 dBTP; music and all 30 kept effect cues present; drop on 3.75 s; measured, not listened |
| 6 | Complete visual coverage | PASS | 15 sheets, frames 0-674 viewed in order (qa/sheets/v1_00..14.jpg) |
| 7 | Story / motif | PASS | aim -> fire -> shatter -> reveal on the drop -> chains -> one shot -> five worlds -> twelve balls -> logo; the music's drop-out lands on the glass break and its step-down on the logo |
| 8 | Identity and cast | N/A | no people in the film |
| 9 | Text, logos and marks | PASS | all lines intact and unchanged from the source picture |
| 11 | Bars and edges | PASS | no bars; full-frame composition throughout |
| 15 | Declared source reuse | PASS | video stream packet MD5 equal to the supplied film (1ea8e691ae9c95630f227557e9bfe10f): the picture is unchanged |
| 19 | Energy vs reference | N/A | no reference video |
| NOTE | | | each falling ball crosses the "Collect 12 balls." line for about two frames on its way down (intended motion in the source picture) |
