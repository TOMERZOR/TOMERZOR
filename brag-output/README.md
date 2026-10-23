# SHARD — the brag films

## The second film: `brag-katana-v2.mp4`

A 48.4-second launch film made in Higgsfield Katana: photoreal glass worlds generated for the game, the real gameplay shown large with a how-to-play walkthrough, and code-drawn motion graphics, cut to the music.

- `brag-katana-v2.mp4`: **the film** (1920×1080, 30 fps, 1452 frames, −12.6 LUFS, true peak −1.7 dBTP). Frame 0 is the poster.
- `brag-katana-v2.jpg`: the poster.
- `katana-v2/`: everything needed to re-render it, with the QA record (`qa/gate_v2.md`; the first cut's is `qa/gate_v1.md`), the prompts and job ids (`PROMPTS.md`) and the handoff (`HANDOFF.md`).

**This cut.** The first cut (33 s) moved too fast to follow the game. This one runs 48 s and shows how the game is played:
- How to play, on the real level 4 seen close up:
  - a finger pulls back over the game's own dotted aim line ("Pull back to aim.") and lets go;
  - the ball breaks every glass block in one chained shot ("Break all the glass.");
  - the game's level-clear screen gives three stars ("Clear it in one shot.").
- Two more real levels, each with a caption:
  - World 4, Ember: bombs set off chain reactions;
  - World 5, Night: the shot bounces off the walls, with slow motion on the last piece.
- Longer holds on the worlds, the balls and the logo, and no more one-cut-per-beat montage.

**What is generated and what is code.**
- Generated with Higgsfield for the first cut and reused here: four location stills (Soul Cinematic), then five shots animated from them with Seedance 2.5:
  - the glass city and the rolling ball;
  - the impact;
  - the dawn chain;
  - the ember blasts;
  - the night pendants.
- Real game: the gameplay, level maps, balls and icon. Levels 4, 82 and 112 were captured frame by frame with `capture/capture.mjs hero2 ember2 night2`.
- Code (`katana-v2/motion/`, one page drawn frame by frame):
  - the type and captions;
  - the 3D phones and the finger, which follows the aim angles the game logged during capture;
  - the glass fracture of words and frames;
  - the zoom-through and whip transitions;
  - the flashes and shakes.

**Sound.**
- Music: "Take this Higher" by Michael Ramir C. (Mixkit, same licence as below; terms in `katana-v2/src/mixkit-music-license.txt`). It plays from 0 s at its own 124 BPM; the drop lands on the impact, the second drop on the ball's wall bounce in the night level, and "Coming soon" on the last big hit.
- Effects:
  - CC0 library recordings (listed in `katana-v2/audio/sfx_licenses.txt`);
  - the game's own glass, cannon, bomb and level-clear sounds, rebuilt from each capture's sound log by `capture/stems.py` and synced to the gameplay on screen.

**Credits.** 465.08 Higgsfield credits, all spent on the first cut (reconciled with the account's transactions): 464 for the five Seedance shots, 1.08 for nine stills. This cut spent none.

**Re-render** (in the Higgsfield sandbox; see `katana-v2/HANDOFF.md` §6). Text, timing and sound changes cost no credits.

## The first film: `brag-katana.mp4`

A 22.5-second launch film for SHARD, built with HyperFrames from the real game and finished with music in Higgsfield Katana.

- `brag-katana.mp4`: **the film** (1920×1080, 30 fps, −12.8 LUFS), with music and sound effects, and the poster as frame 0.
- `brag.mp4`: the same picture with sound effects only (−14 LUFS), the source Katana finished.
- `brag.jpg`: the poster.
- `share-copy.txt`: post copy and alt text.
- `brag-plan.md`: the angle, storyboard and sound plan.

### Music

"Golden Storm" by Diego Nava, from Mixkit, under the [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree). The terms are saved in `katana/research/mixkit-music-license.txt`.

- **Allowed:** social media posts, online marketing ads and YouTube. No credit is required.
- **Not allowed:** using the track inside the game, TV or radio broadcast, CDs or DVDs, or a music-only remix.

### How it's made

| Step | File | What it does |
|---|---|---|
| 1 | `capture/capture.mjs` | Plays three levels frame by frame and records the level map and the 12 balls. Serve `shard/` on port 8080 first. |
| 2 | `capture/stems.py` | Rebuilds each clip's game sound from the sound log the game wrote during capture. |
| 3 | `build.mjs` | Writes the whole composition from one beat table, so the cut retimes to any tempo. |
| 4 | `finish.mjs` | Renders at full quality, normalises the mix to −14 LUFS and bakes in the poster (`brag.mp4`). |
| 5 | `katana/` | The Katana finish, run in Higgsfield's sandbox (see below). |

### The Katana finish

The picture is `brag.mp4`'s, stream-copied unchanged. Only the sound was rebuilt:

- **Music:** the track is stretched from 127 to the cut's 128 BPM with its pitch kept. It is trimmed so its first drop lands on beat 8, the reveal. Its drop-out before that falls on the glass break, and it steps down a gear as the logo assembles. It fades out on the final bar.
- **Effects:** rebuilt from the film's cue list (`build.mjs` writes it into `composition/index.html`). The synthetic riser is dropped, and ball pops, world ticks, whooshes, reverse glass and game sounds are raised so they cut through.
- **Mix:** the music sits 7.5 dB down and ducks a few dB under each hit. The master is limited to −1 dBTP.

Files in `katana/`:
- `tools/`: the two scripts, `mix.py` and `master.py`.
- `plan/` and `analysis/`: the plan, the task contract and the music source record.
- `qa/`: the QA gate.

The scripts expect the Katana sandbox layout (`src/`, `audio/`, `out/`).

### Re-cutting to another track

The HyperFrames cut sits on a 128 BPM grid, and the reveal (beat 8) is where the music should drop.

```sh
node prep-music.mjs path/to/track.mp3   # finds tempo, downbeats and the drop; writes composition/assets/bgm/track.json
node build.mjs                          # retimes every scene and sound to the track
(cd composition && npx hyperframes check)
node finish.mjs                         # brag.mp4 and brag.jpg
```

Use `--drop <seconds>` with `prep-music.mjs` to choose the drop by hand.

`HYPERFRAMES_BROWSER_PATH` must point to a Chromium headless shell.
