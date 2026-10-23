# SHARD — the brag film

A 22.5-second launch film for SHARD, built with HyperFrames from the real game and finished with music in Higgsfield Katana.

- `brag-katana.mp4`: **the film** (1920×1080, 30 fps, −12.8 LUFS), with music and sound effects, and the poster as frame 0.
- `brag.mp4`: the same picture with sound effects only (−14 LUFS), the source Katana finished.
- `brag.jpg`: the poster.
- `share-copy.txt`: post copy and alt text.
- `brag-plan.md`: the angle, storyboard and sound plan.

## Music

"Golden Storm" by Diego Nava, from Mixkit, under the [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree). The terms are saved in `katana/research/mixkit-music-license.txt`.

- **Allowed:** social media posts, online marketing ads and YouTube. No credit is required.
- **Not allowed:** using the track inside the game, TV or radio broadcast, CDs or DVDs, or a music-only remix.

## How it's made

| Step | File | What it does |
|---|---|---|
| 1 | `capture/capture.mjs` | Plays three levels frame by frame and records the level map and the 12 balls. Serve `shard/` on port 8080 first. |
| 2 | `capture/stems.py` | Rebuilds each clip's game sound from the sound log the game wrote during capture. |
| 3 | `build.mjs` | Writes the whole composition from one beat table, so the cut retimes to any tempo. |
| 4 | `finish.mjs` | Renders at full quality, normalises the mix to −14 LUFS and bakes in the poster (`brag.mp4`). |
| 5 | `katana/` | The Katana finish, run in Higgsfield's sandbox (see below). |

## The Katana finish

The picture is `brag.mp4`'s, stream-copied unchanged. Only the sound was rebuilt:

- **Music:** the track is stretched from 127 to the cut's 128 BPM with its pitch kept. It is trimmed so its first drop lands on beat 8, the reveal. Its drop-out before that falls on the glass break, and it steps down a gear as the logo assembles. It fades out on the final bar.
- **Effects:** rebuilt from the film's cue list (`build.mjs` writes it into `composition/index.html`). The synthetic riser is dropped, and ball pops, world ticks, whooshes, reverse glass and game sounds are raised so they cut through.
- **Mix:** the music sits 7.5 dB down and ducks a few dB under each hit. The master is limited to −1 dBTP.

Files in `katana/`:
- `tools/`: the two scripts, `mix.py` and `master.py`.
- `plan/` and `analysis/`: the plan, the task contract and the music source record.
- `qa/`: the QA gate.

The scripts expect the Katana sandbox layout (`src/`, `audio/`, `out/`).

## Re-cutting to another track

The HyperFrames cut sits on a 128 BPM grid, and the reveal (beat 8) is where the music should drop.

```sh
node prep-music.mjs path/to/track.mp3   # finds tempo, downbeats and the drop; writes composition/assets/bgm/track.json
node build.mjs                          # retimes every scene and sound to the track
(cd composition && npx hyperframes check)
node finish.mjs                         # brag.mp4 and brag.jpg
```

Use `--drop <seconds>` with `prep-music.mjs` to choose the drop by hand.

`HYPERFRAMES_BROWSER_PATH` must point to a Chromium headless shell.
