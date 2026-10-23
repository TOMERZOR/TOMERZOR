# SHARD — the brag film

A 22.5-second launch film for SHARD, built with HyperFrames from the real game.

- `brag.mp4`: the film (1920×1080, 30 fps, −14 LUFS), with the poster baked in as frame 0.
- `brag.jpg`: the poster.
- `share-copy.txt`: post copy and alt text.
- `brag-plan.md`: the angle, storyboard and sound plan.

## How it's made

| Step | File | What it does |
|---|---|---|
| 1 | `capture/capture.mjs` | Plays three levels frame by frame and records the level map and the 12 balls. Serve `shard/` on port 8080 first. |
| 2 | `capture/stems.py` | Rebuilds each clip's game sound from the sound log the game wrote during capture. |
| 3 | `build.mjs` | Writes the whole composition from one beat table, so the cut retimes to any tempo. |
| 4 | `finish.mjs` | Renders at full quality, normalises the mix to −14 LUFS and bakes in the poster. |

## Adding music

The cut sits on a 128 BPM grid, and the reveal (beat 8) is where the music should drop.

```sh
node prep-music.mjs path/to/track.mp3   # finds tempo, downbeats and the drop; writes composition/assets/bgm/track.json
node build.mjs                          # retimes every scene and sound to the track
(cd composition && npx hyperframes check)
node finish.mjs                         # brag.mp4 and brag.jpg
```

Use `--drop <seconds>` with `prep-music.mjs` to choose the drop by hand.

`HYPERFRAMES_BROWSER_PATH` must point to a Chromium headless shell.
