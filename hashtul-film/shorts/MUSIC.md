# Music and sound for the shorts

The source is one track, `audio/src/music/take1.mp3`: 44.04 s long, 120 BPM. Every mix is built by `audio/score.py` from the short's events file:

```sh
python3 audio/score.py shorts/s1/events.json shorts/s1/mix.wav
# writes mix.wav (48 kHz stereo, -16 LUFS, -4.2 dBTP) plus mix_stem_sfx.wav and mix_stem_music.wav next to it
python3 tools/music_joins.py shorts/s1/events.json shorts/s1/mix_stem_music.wav   # checks the joins
```

The events file has this shape: `{"T": {"dur": 18.0}, "events": [{"t", "kind", "pan", "v"}...], "music": {...}}`. The full `music` schema is in the docstring of `audio/score.py`. All times are in film seconds. `track` values are in seconds of take1.

## 1. What the track actually does (measured, not assumed)

The figures come from `tools/music_map.py` (per-beat and per-bar onsets, levels, chroma and pickups) and from per-band envelopes. They were checked against waveform and spectrogram plots.

- **The grid.** Beats fall at `0.557 + 0.5k`. Bar lines fall at `0.557 + 2k`.
- **The attacks lead that grid.** In the groove (from 16 s on), the kick and click attacks start **31 to 33 ms before** each nominal beat. The spread is under 1 ms. In the intro, the snare is a flam: one transient about 25 ms early, a second about 3 ms late.
  - The plans below therefore use `"nudge": 0.03`, which delays the music by 30 ms. Measured attacks then land **2.4 ms before** the film's 0.5 s grid (median of every beat).
  - Without the nudge they land 32 ms early, one frame at 30 fps.
- **Harmony.** One 8 s (4-bar) chord cycle runs through the whole track, intro included. It starts at `0.557 + 8k`, and the chord changes every 1 s, at `0.557 + k`:
  `| G#m  C#m | E  E | G#m  B | A#°/F#  E |`
  These labels are chroma estimates (the strongest pitch classes). What matters for editing is the position in the cycle, and that position is exact.
- **The real final hit is at 39.557, not 38.557.** 38.557 is the downbeat of the last bar, and its chord is the penultimate one (A#/F#). The last attack of the track is at **39.557**: a crash on the closing E chord, followed by nothing.
  - Its ring, in 0.1 s windows relative to the hit window: −7 dB at +0.2 and +0.45 s, −11 dB at +0.7 s, −24 dB at +0.95 s, −36 dB at +1.45 s, −47 dB at +1.95 s, and −55 dB at +2.45 s.
  - So **"final hit at film 16.0 with 2 s of ring-out" means `track = film + 23.557` for the last segment, not +22.557.**
  - With +22.557, the logo lands on an ordinary groove downbeat. The groove then plays two more beats, the crash comes at 17.0, and the ring is cut by the end of the film while still near full level (see `out/sound/strict_*.wav`).

## 2. Bar map (bar = 2 s of track time)

| bar | track s | section | chords | level dB | centroid Hz | edit notes |
|---|---|---|---|---|---|---|
| — | 0.000–0.557 | pre-roll stab | — | | | An unmetered held stab (1.6 and 4.4 kHz tones) before the first beat. It is not on the grid; never use it as a body. |
| 0 | 0.557 | **intro** (phrase 1) | G#m C#m | −34.5 | 1550 | Good in-point: the very first snare. Half-time snare on every whole second with a ~25 ms flam lead, mallet/keys chords, no kick. |
| 1 | 2.557 | intro | E E | −35.5 | 1640 | Good. |
| 2 | 4.557 | intro | G#m B | −35.0 | 1600 | Good. |
| 3 | 6.557 | intro | A#/F# E | −32.6 | 1490 | Good. |
| 4 | 8.557 | intro (phrase 2) | G#m C#m | −35.9 | 1640 | Good. |
| 5 | 10.557 | intro | E E | −33.9 | 1500 | Good. |
| 6 | 12.557 | intro | G#m B | −34.4 | 1590 | Good. |
| 7 | 14.557 | **build** | A#/F# E | −29.3 | 2990 | A noise riser at 15.0–16.0. **A pickup crosses the next bar line**: a kick plus a held stab at 16.057 (the four-on-the-floor starts there, one beat early), ringing to 16.55 (+7 dB in the last 60 ms before 16.557). **Do not cut out of this bar at 16.557 into anything but a downbeat.** |
| 8 | 16.557 | **groove A** (phrase 3) | G#m C#m | −25.0 | 1700 | Best in-point of the track: the groove lands. Kick on every beat, 8th hats, bass. |
| 9–11 | 18.557–24.557 | groove A | E E / G#m B / A#/F# E | −24 | 1700 | Good in-points. Steady; bar 11 is a little louder (−22.4). |
| 12–14 | 24.557–30.557 | groove A (phrase 4) | cycle | −24.5 | 1850 | Fine. Bar 13's line (26.557) has +4 dB of held material before it, so a join *out* of bar 12 there is slightly smeared. Use 24.557 or 28.557 instead. |
| 15 | 30.557 | groove + **fill** | A#/F# E | −21.3 | 2580 | A 16th fill at 31.557–32.557 leads into 32.557. Joining *into* 30.557 is fine. **Do not join out at 32.557 unless the new side is a strong downbeat.** |
| 16 | 32.557 | **groove B** (phrase 5) | G#m C#m | −23.0 | 2960 | Best second in-point: brighter (hats +3 dB, centroid +1200 Hz). |
| 17–18 | 34.557–38.557 | groove B | E E / G#m B | −22.8 | 2930 | Good in-points. 35.557 (second E, beat 3) is the half-bar entry the plans use. |
| 19 | 38.557 | **ending** | A#/F# → **E crash at 39.557** | −21.8 | 3000 | The last bar. 39.557 is the final hit; no attacks after it. |
| 20+ | 40.557– | ring/tail | E | −58 | | Ring only. Never join into it. |

**Rule for a seamless join.** Both sides must sit at the same position in the 8 s cycle: `track_new − track_old` must be a multiple of 8. The other seamless case is the two consecutive E chords, positions 2↔3 (track `2.557 + 8k` ↔ `3.557 + 8k`); that is how the plans step the ending by half a bar.

**Other bar-line joins** are rhythmically clean but jump the harmony. Hide them behind a `stop` or a `brake`.

## 3. The three base plans (all 18.0 s; final hit at film 16.0; ring 16–18)

All three plans share these properties:
- **Picture grid.** Beats at film 0.0, 0.5, 1.0, and so on; chord changes on every whole film second.
- **Bar lines.** Up to film 12 the track's bar lines are on even seconds. In the last segment they fall on odd seconds, which is what lets the final crash land on 16.0.
- **Joins.** Every join sits on an even film second and is harmonically seamless. The two exceptions are noted.
- **Level.** `gain` 0.26 as in the film. The groove sits ×0.72 under the intro, as in the film (the intro is about 10 dB quieter in the track).

The picture agents add their own `stops`, `thin`, `brakes` and `in` to these objects.

### Plan A: S1 "guess who" (intro body, the groove drops at 10)
```json
"music": {"segments": [{"t0": 0, "t1": 10, "track": 6.557}, {"t0": 10, "t1": 12, "track": 32.557}, {"t0": 12, "t1": 18, "track": 35.557}],
          "sections": [[9.45, 0.72]], "gain": 0.26, "nudge": 0.03}
```
| film s | what is heard |
|---|---|
| 0–8 | Light, curious intro. A snare tap on every whole second, mallet chords A#/F#, E, then G#m, C#m, E, E, G#m, B. No kick. Quiet. |
| 8–10 | Build: A#/F# then E. A noise **riser swells 8.5→9.5**, and a **pickup kick plus stab at 9.5** points at 10. |
| 10.0 | **The groove drops on the B-section downbeat** (G#m): four-on-the-floor kick, bright hats, bass. "Caught!" |
| 10–16 | Full groove, C#m E \| E G#m \| B A#/F#. Seamless join at 12 (E→E). |
| 16.0 | **Final crash on E**: the logo. |
| 16–18 | Ring: full level to about 16.7, −12 dB at 16.75, −20 dB at 17.0, −32 dB at 17.5, out by 18. |

Energy changes: riser 8.5–9.5; pickup at 9.5; groove at 10.0. For the director's shape, use `thin` [[6, 8]] for the countdown and `thin` or `stops` in 8–10 under the roulette. The riser is part of the track and will still be heard under a thin.

### Plan B: S2 "three question pairs" (groove from the start)
```json
"music": {"segments": [{"t0": 0, "t1": 12, "track": 22.557}, {"t0": 12, "t1": 18, "track": 35.557}],
          "sections": [[0, 0.72]], "gain": 0.26, "nudge": 0.03}
```
| film s | what is heard |
|---|---|
| 0–2 | Groove A already running (A#/F#, E). |
| 2–8 | Groove A: G#m C#m \| E E \| G#m B. The 4.0 flip lands on E. |
| 8–10 | Groove A: A#/F#, then a **16th fill at 9.0–10.0**. The 8.0 flip lands on this bar's downbeat. |
| 10.0 | **Lift into the brighter B section** (G#m). The track's own energy step comes here, not at a flip. |
| 10–16 | B: C#m, E, then the seamless join at 12 (E→E, where the flip lands), G#m, B, A#/F#. |
| 16.0 | Final crash on E. 16–18 ring as in A. |

Energy changes: the fill at 9–10 and the B lift at 10.0. The stops at 3.6–4.0, 7.6–8.0 and 11.6–12.0 each re-enter on a downbeat; the one at 12 re-enters exactly on the join.

### Plan C: S3 "POV: you are the plant" (opening of the track, a build, groove, B)
```json
"music": {"segments": [{"t0": 0, "t1": 4, "track": 0.557}, {"t0": 4, "t1": 12, "track": 12.557}, {"t0": 12, "t1": 18, "track": 35.557}],
          "sections": [[7.45, 0.72]], "gain": 0.26, "nudge": 0.03}
```
| film s | what is heard |
|---|---|
| 0–4 | Calm: the first two bars of the track (snare taps, mallets G#m C#m \| E E). |
| 4.0 | Seamless join (same cycle position) into intro bar 6: G#m, B. The hard stop at 3.7 and the twist hit at 4.0 sit on it. |
| 6–8 | Build: A#/F#, E, **riser 6.5–7.5**, **pickup kick plus stab at 7.5**. A breath at 7.6–8.0 keeps the pickup and cuts only its tail. |
| 8.0 | **The groove lands**: the track's real groove entry (G#m, phrase start). |
| 8–12 | Groove A: C#m \| E E. |
| 12.0 | Join into the brighter B section on E. Harmonically it is E-E-E for 10–13, a stall rather than a clash. For "escaped!", add a stop at 11.6–12.0 or a brake `[11.1, 11.6, 12.0]` with a `scratch` at 11.1. |
| 12–16 | B: E, G#m, B, A#/F#. |
| 16.0 | Final crash on E. 16–18 ring as in A. |

Energy changes: riser 6.5–7.5; pickup 7.5; groove 8.0; B lift 12.0.

### Measured join quality

These figures come from `tools/music_joins.py` on the music-only renders in `out/sound/plan_*.wav`:
- **The window.** The crossfade window is 20 ms and ends 40 ms before the join (plus the nudge), so the incoming downbeat is never inside the fade.
- **"vs unedited".** The same window measured on the track as it would sound with no join (old side continuing, new side already playing), level-matched to the render. A positive value means the join is worse than the music itself.
- **"vs neighbours".** The same window placed before the 7 or 8 surrounding beat lines.

| plan | join | disc vs unedited | >6 kHz vs unedited | flux vs unedited | disc / hf / flux vs neighbours | downbeat attack vs grid (neighbours) |
|---|---|---|---|---|---|---|
| A | 10.0 | +0.5 dB | −0.2 dB | ×0.90 | +1.8 dB / +1.8 dB / ×1.32 | −2.2 ms (−2.1) |
| A | 12.0 | −1.8 dB | 0.0 dB | ×0.70 | −0.6 dB / +0.9 dB / ×0.91 | −2.4 ms (−3.1) |
| B | 12.0 | +0.3 dB | −0.7 dB | ×0.75 | +0.8 dB / +0.1 dB / ×0.70 | −2.4 ms (−3.0) |
| C | 4.0 | +1.5 dB | 0.0 dB | ×1.04 | +7.6 dB / +10.1 dB / ×1.17 * | +6.0 ms (+3.1) |
| C | 12.0 | −1.2 dB | +0.9 dB | ×0.73 | −1.4 dB / −0.4 dB / ×0.69 | −2.4 ms (−2.8) |

\* For C at 4.0, the large values against neighbours come from the incoming bar's snare flam starting inside the window. Half of the neighbouring intro beats have no snare. The same window in the unedited track is within +1.5 dB, so this is the music, not a click.

Every downbeat after a join lands within 10 ms of the film grid. The median over all beats is −2.4 ms. Without the nudge it is −32 ms.

## 4. Event kinds (`recipe()` in audio/score.py)

`v` scales loudness (√v). `pan` runs from −1 to 1. Kinds marked **HIT** duck the music up to 6 dB; every other kind ducks it by about 2.5 dB.

**Openers / type**
- `glance`: a tiny high tick. An eye flick or a tiny UI blink.
- `drip`: a single water plip. A bead of sweat, a nervous detail.
- `riser`: a short (~1 s) airy upward whoosh. Into a reveal or a pull-back.
- `letter`: a soft tap with a small thud. One letter or a logo piece landing (use it in a stagger).
- `logo_hit` **HIT**: a deep boom plus a tap. The logo locking in.
- `word`: silent; a placeholder that marks a word appearing.
- `title`: a swish plus a pop. A title card or header entering.
- `punch` **HIT**: a mid boom plus a pop. A punchline word slamming in.

**Movement**
- `swish`: a card-through-air swish. Something sliding or flying past.
- `whoosh`: the game's whoosh. A bigger move or a screen transition.
- `whip`: a fast riser plus a whoosh. A camera whip-pan or a hard push.
- `drop`: a long, low swish. Something falling or dropping out of frame.

**UI / game**
- `tap`: the game's tap. A finger tap on a button.
- `type`: a tap that rises with each call (i). Typing digits.
- `key`: a firmer tap. One deliberate key press.
- `confirm`: a tap plus a pop. Submitting or confirming.
- `on`: the game's switch-on. A toggle turning on.
- `start`: the game's start sting. A game or round beginning.
- `check`: a light react blip. A tick mark or a player's answer arriving.
- `lock` **HIT**: the game's lock. Answers locked in.
- `stamp_soft`: a light stamp. A small badge landing.
- `stamp` **HIT**: a heavy rubber stamp. A verdict label slammed on.
- `cell`: a small pop. A grid cell filling.
- `mini`: a high small pop. A miniature or emoji pip.
- `react`: the game's react sound. An emoji reaction.
- `pop`: a soft bubble pop. Something appearing.
- `join`: a pop that rises with each call (i). Players joining one by one.
- `gulp`: a cartoon gulp. A nervous character beat.
- `thud`: a soft toy thud. Something small landing.
- `boom_soft`: a medium boom. A soft accent.

**Cards**
- `deal`: a card flick. Dealing a card.
- `deal_odd`: a lower card flick. The odd card out (the plant's).
- `flip`: the game's flip plus a swish (pitch varies with i). A card flipping over.
- `card_slap`: a heavy flip plus a thud. A card slammed down.

**Reveals**
- `reveal_big` **HIT**: a big boom, a flip and the game's boom. The big reveal (the odd answer).
- `crowd_oooh` **HIT**: friends going "ooooh". Suspicion.
- `roulette`: one wheel-peg click (v scales it). Spotlight or roulette steps; place one per step and slow them down.
- `drum`: a 2.1 s snare roll that swells. Suspense before a verdict (place it 2.1 s before the hit).
- `boom` **HIT**: the game's boom plus a boom take. A heavy impact.
- `verdict` **HIT**: a stamp plus a boom. "Caught!".
- `crowd_laugh` **HIT**: friends laughing. A punchline payoff.
- `crowd_cheer` **HIT**: friends cheering. A win.

**Reward**
- `reward`: the game's reward chime (rises with i). Points or a small win.
- `coins`: three reward chimes in a cascade. Points counting up.
- `crown`: a high reward chime. A crown or badge.
- `step`: a thud that rises with i. Podium steps.
- `land`: a thud plus a pop. A character landing on a podium.
- `win` **HIT**: the game's win jingle. The winner.
- `confetti`: a party popper crack with paper crackle. Confetti.

### Added for the shorts

These are new kinds only, built from takes and synthesis that already existed; no existing kind changed.

- `count`: a struck blip over a wood knock, plus a tick. Each 3-2-1 step of a countdown.
- `count_go` **HIT**: a blip an octave up, the game's start sting and a light boom. The "0 / GO" of a countdown.
- `scratch` **HIT**: a synthesized record scratch, 0.34 s. A record-stop gag. Pair it with a music `brakes` entry at the same time.
- `buzz` **HIT**: the game's alarm, 0.5 s. Wrong, busted or time-up.
- `wrong` **HIT**: the game's off-click plus a lower alarm. A softer "nope".
- `ding`: a bright two-tone glass ding. Correct or "aha".
- `heartbeat`: a lub-dub of two sub thumps. Tension; place one every 0.5 or 1.0 s under a thin.
- `shutter`: a two-clack camera shutter. A screenshot, the "POV" frame or a photo.
- `riser_bar`: a 2 s build that peaks **exactly at the event time**. Put `t` on the downbeat it leads into.
- `riser_long`: a 3 s airy swell starting at `t`. A slow build under a reveal.
- `bubble`: two layered pops, fuller than `pop`. A speech bubble or sticker popping in over the groove (added in sound QA: `pop` sat only +4 dB over the bed).
- `flip_up`: a flip with a thud body and a pop, its pitch rising with each call (i). A row of cells flipping one per beat.
- `crowd_laugh_c` **HIT**: a third 1 s laugh take, so a short's third laugh is not a repeat.
- `crowd_laugh_b`, `crowd_cheer_b`, `crowd_oooh_b` **HIT**: alternative crowd takes. Use them so the second short doesn't reuse the same crowd as the film.

A camera whip already exists (`whip`). The music-side "stop" tools live in the plan, not in `recipe()`:
- `stops`: an instant cut to silence.
- `brakes`: a tape-stop.
- `thin`: low-passed and lowered.

An event kind that does not exist is warned about once and skipped.

## 5. Notes for picture timing

- **Hits.** Put hard visual hits on whole seconds when you can: the chords change there, and in the intro the snare lands there. Half seconds are beats too, but softer.
- **Bar lines after 12.** In all three plans the track's own bar lines fall on odd seconds from 12 on. A picture hit on an even second after 12 still lands on a beat and a chord change, so nothing needs to move.
- **Within 0.6 s after 16.0.** The crash at 16.0 sustains at about full level for 0.7 s. Avoid another strong SFX in that window; let the crash be the end sound.
- **Breaths.** A stop of 0.3–0.4 s before a downbeat reads as a "breath". Shorter than 0.2 s sounds like a glitch.
- **Builds.** The intro/build bars already contain a riser and a pickup at fixed places (A: 8.5–9.5 and 9.5; C: 6.5–7.5 and 7.5). Time the picture's build to them rather than adding a second riser on top.
