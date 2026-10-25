# 5 לילות אצל יסמין

A first-person horror game in Hebrew. You are the last soldier left on a base for the weekend, and Yasmin, the cleaning-duty girl, hunts you through liminal container corridors with a mop and a bucket. Survive five nights, do the night's tasks, collect the four gate keys and escape.

Live: https://tomerzor.github.io/TOMERZOR/yasmin/ (the share preview uses `img/og.jpg`).

Static site, no build step: serve the repository and open `yasmin/`.

```
npx http-server .     # then open http://localhost:8080/yasmin/
```

URL options: `?night=3` jumps straight into a night, `?q=low` / `?q=high` forces the graphics quality.

Releasing: run `python3 tools/version.py` before committing. It stamps a version on every script and stylesheet URL (and the code adds it to every asset it loads), because GitHub Pages lets browsers cache files for ten minutes and phones would otherwise keep running the old code.

## Controls

Desktop: WASD to walk, mouse to look, Shift to run (stamina runs out), C or Ctrl to crouch (quieter), E to use / hide in a locker / hold for long actions, F for the flashlight, G or right click to throw a bottle, J for the journal, Tab hides the objectives, Esc pauses.
Phone: left stick to walk, drag on the right half to look, buttons for use, run, crouch, flashlight and throw.

Settings: mouse sensitivity, volume, music, brightness, difficulty (easy / normal / hard) and graphics quality.

## The nights

1. **הלילה הראשון** — read the note on your bed, take the flashlight from your locker, find the first gate key in the kitchenette (the fridge is full of Roi's "squash"), get back to bed. She shows herself at the end of the corridor first, then starts patrolling; a mop bucket rolls out of the office on its own.
2. **דוח צל״ם** — take the form from the office, inspect four items in the equipment store (its lights die one by one and she comes to look), return the report and take the key that falls out. Maya's beheaded Labubu is on a bed in room 2.
3. **הפסקת חשמל** — the power is out (red emergency lights, the flashlight battery drains). Find three fuses, restore power in the generator room, check the camera room (live CCTV feeds: she appears behind you on CAM 4) and enter the isolation wing: Nevo, in a padded cell after 47 cleaning inspections, rushes the glass and mutters. His medical file and the third key are in the wing.
4. **מסדר ניקיון** — she announces an inspection over the speakers. Take a mop from the showers and clean four blood puddles (cleaning is loud), which opens her store: mops, buckets, a candle shrine, her diary and a board of crossed-out photos. The last key is in the bucket; she screams in the doorway, the lights cut out, and she comes running from the far end of the base.
5. **הבריחה** — red alarm. Unlock the exit at the end of the maze with the four keys, then hold E on the gate's padlock while she chases you without giving up, and run.

### Ruth

Three months before you, Ruth was "the new one". She tried to escape through the maze and vanished. Her missing poster hangs in the north corridor; her photo is crossed out on Yasmin's board; her boots stand in Yasmin's store ("לכלכה" written on the sole). Each night one of her cassette tapes lies somewhere (on your bed, on a shelf in the equipment store, on the gurney in the isolation wing, in her boots, in a dead end of the maze); they are voiced, subtitled, and can be replayed from the journal. Her ghost shows itself a few times (your doorway after the first tape, the end of a corridor, inside Nevo's cell — he says her name), and on the last night she stands at the turns of the maze to show you the way. Find all five tapes and she walks out of the gate with you (the credits and the last message change).

### Stealth tools and hazards

- **Bottles**: pick up empty bottles (up to three) and throw them; she goes to look where one lands, even mid-chase once she has lost sight of you.
- **Wet floor**: she stops to mop, leaving a shiny patch and a yellow "זהירות! רצפה רטובה" sign. Running across it splashes loudly and slows you.
- **Lockers**: hide; if she saw you get in, she opens it.
- **Hints**: stuck on an objective for a few minutes, a hint appears.
- **Checkpoints**: on night 3 after the generator is back on, on night 4 once her store is open, and on night 5 after the exit door is open, getting caught restarts there. After three catches the game-over screen offers easy mode.

Getting caught is a jumpscare and a retry. Progress (the furthest night), found tapes and discoveries are saved in the browser. The menu shows the live corridor with Yasmin walking toward you.

## Yasmin's AI (`js/yasmin.js`)

Grid A* (binary heap) with path smoothing that only cuts a corner when the straight line is clear of furniture, door frames and open doors; if she is still wedged somewhere she finds a short way out on a 25 cm grid. She patrols (drifting toward the player when she has been far away for a while), investigates noises (running is heard from far, crouching barely; doors, lockers and mopping make noise), notices the player with a sight cone whose range depends on light (flashlight on: very far; lit area; dark) — at a distance it takes her a couple of seconds to be sure (the eye at the top of the screen fills up), up close almost none — freezes and stares for a beat when she spots you, then chases at night-dependent speeds slightly below the player's sprint, searches the last known position and gives up. If she sees you enter a locker she opens it. Fixtures near her flicker; she leaves wet footprints that dry out; her bucket squeaks positionally; her eyes catch the flashlight in the dark.

## Look and sound

- Shell built from the grid with baked corner shading on floors, walls and ceilings; generated PBR-ish textures (corrugated container panels, blue-grey linoleum with wet roughness, stucco ceiling) with derived normal maps; a pool of real point lights follows the player among ~80 flickering fluorescent fixtures, red emergency lights, the fridge light, candles and monitor glow; a shadow-casting flashlight with a lens cookie; exponential fog; bloom; a horror grade with grain, vignette, chromatic aberration, fear pulse and VHS tearing (`js/post.js`).
- Live CCTV: the camera room renders four cameras into render targets shown through a monochrome security-monitor shader.
- Sound: recorded Hebrew voice lines with subtitles (Yasmin, Nevo) and effects, positional HRTF audio with a corridor reverb, plus a synthesized drone, fluorescent hum, drips, creaks, heartbeat, breathing, footsteps, stingers and a chase score (`js/audio.js`).

## Assets

Yasmin and Nevo were generated as images from reference photos, turned into rigged, animated 3D models (Meshy image-to-3D with auto-rig; Yasmin's walk-with-bucket, run, scream and idle clips merged onto one skeleton); the mop bucket, the Labubu and the squash bottle are image-to-3D (Tripo) models; the wall/floor/ceiling textures, the jumpscare frames, the CCTV still and the key art were generated with GPT Image; all via Higgsfield. Voice lines are ElevenLabs v4 performances (library voices), effects are ElevenLabs sound effects. Models are compressed with gltf-transform (WebP textures, meshopt). Everything else (furniture, signage, posters, blood, the fence, the yard) is built in code.

## Code

| File | What it does |
| --- | --- |
| `js/main.js` | Renderer, loading, menus, input, main loop, jumpscare, end of night, ending, random scares |
| `js/map.js` | The base as a character grid, walkability, line of sight, A* |
| `js/world.js` | Geometry, furniture, lockers, doors, fixtures and the light pool, the yard and gate, collision |
| `js/story.js` | Nights, objectives, items, notes, discoveries, scripted scenes, Nevo, CCTV |
| `js/yasmin.js` | Yasmin's model, props, animation and AI |
| `js/player.js` | Movement, stamina, head bob, flashlight, lockers, interaction picking |
| `js/audio.js` | Samples, positional audio, synthesized ambience and score |
| `js/post.js` | Post-processing |
| `js/textures.js` | Texture loading and all canvas-drawn textures |
| `js/ui.js` | HUD, screens, notes, touch controls |
| `js/ruth.js` | Ruth's tapes, ghost, missing poster |
| `js/mechanics.js` | Thrown bottles, wet floor and signs |
| `tools/version.py` | Stamps a release version on script and asset URLs |

## Testing

Headless (Playwright with SwiftShader) scripts drove the game through `window.__game.dbg` (`tick(dt)` steps the game logic without rendering): every night completed by calling its interactions in order; every key spot reached by walking with the real collision on a 25 cm navigation grid; every interaction usable from a standing position; Yasmin's chase, locker check and give-up; and a bot that plays each night (walks, freezes when she is close, runs and hides when chased) against the real AI to find soft-locks and tune difficulty.
