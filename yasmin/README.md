# 5 לילות אצל יסמין

A first-person horror game in Hebrew. You are the last soldier left on a base for the weekend, and Yasmin, the cleaning-duty girl, hunts you through liminal container corridors with a mop and a bucket. Survive five nights, do the night's tasks, collect the four gate keys and escape.

Static site, no build step: serve the repository and open `yasmin/`.

```
npx http-server .     # then open http://localhost:8080/yasmin/
```

URL options: `?night=3` jumps straight into a night, `?q=low` / `?q=high` forces the graphics quality.

## Controls

Desktop: WASD to walk, mouse to look, Shift to run (stamina runs out), C or Ctrl to crouch (quieter), E to use / hide in a locker / hold for long actions, F for the flashlight, Tab hides the objectives, Esc pauses.
Phone: left stick to walk, drag on the right half to look, buttons for use, run, crouch and flashlight.

## The nights

1. **הלילה הראשון** — read the note on your bed, take the flashlight from your locker, find the first gate key in the kitchenette (the fridge is full of Roi's "squash"), get back to bed. She shows herself at the end of the corridor first, then starts patrolling; a mop bucket rolls out of the office on its own.
2. **דוח צל״ם** — take the form from the office, inspect four items in the equipment store (its lights die one by one and she comes to look), return the report and take the key that falls out. Maya's beheaded Labubu is on a bed in room 2.
3. **הפסקת חשמל** — the power is out (red emergency lights, the flashlight battery drains). Find three fuses, restore power in the generator room, check the camera room (live CCTV feeds: she appears behind you on CAM 4) and enter the isolation wing: Nevo, in a padded cell after 47 cleaning inspections, rushes the glass and mutters. His medical file and the third key are in the wing.
4. **מסדר ניקיון** — she announces an inspection over the speakers. Take a mop from the showers and clean four blood puddles (cleaning is loud), which opens her store: mops, buckets, a candle shrine, her diary and a board of crossed-out photos. The last key is in the bucket; she is waiting at the door.
5. **הבריחה** — red alarm. Unlock the exit at the end of the maze with the four keys, then hold E on the gate's padlock while she chases you without giving up, and run.

Getting caught is a jumpscare and a retry of the night. Progress (the furthest night) is saved in the browser.

## Yasmin's AI (`js/yasmin.js`)

Grid A* pathfinding with line-of-sight path smoothing. She patrols (drifting toward the player when she has been far away for a while), investigates noises (running is heard from far, crouching barely; doors, lockers and mopping make noise), notices the player with a sight cone whose range depends on light (flashlight on: very far; lit area; dark), chases at night-dependent speeds slightly below the player's sprint, searches the last known position and gives up. If she sees you enter a locker she opens it. Fixtures near her flicker; she leaves wet footprints that dry out; her bucket squeaks positionally; her eyes catch the flashlight in the dark.

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
