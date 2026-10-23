# SHARD film v2: prompts and jobs

Every paid job of this film, in the order the lines ran, with its prompt verbatim.

## loc_studio

- model `soul_cinematic` · 2k · 16:9

```
Photoreal cinematic film still, wide shot. A vast dark studio void with a glossy black reflective floor that mirrors everything. A sculpture garden of translucent frosted glass towers, prisms and stacked glass cubes in soft pastel tints (pale sky blue, blush pink and lilac) stands in clusters at different heights, the tallest tower near the centre of the frame. Soft caustic light patterns on the floor, a faint haze in the air, cool rim light from above and behind the glass. Elegant, minimal, high-end product-film lighting. Empty environment only: no people, no figures, no hands, no animals, no balls, no text, no logos.
```

- job `c965a2ca-d8e5-486e-91ea-f4c7a626b3db` · soul_cinematic · completed · charged 0.12 · second take; the other studio take was the closer match
- job `cd027d86-ae1e-40a8-b902-714ca1750191` · soul_cinematic · completed · charged 0.12 · location still for its Seedance shot

## loc_dawn

- model `soul_cinematic` · 2k · 16:9

```
Photoreal cinematic film still, wide establishing shot. A vast pale plain at sunrise under a soft peach and apricot sky with gentle haze. Across the plain stand rows of tall translucent frosted glass towers and stacked glass cubes in pastel sky blue, blush pink and lilac, at varying heights, glowing with warm backlight from the low sun; long soft shadows on smooth pale sand. Dreamy, clean, minimal. Empty landscape only: no people, no figures, no animals, no vehicles, no text.
```

- job `372fd544-04be-471a-84e3-da4048d8e8e4` · soul_cinematic · completed · charged 0.12 · second take; the other dawn take was the closer match
- job `3b35d06e-626d-4690-9e2c-c70e9f2db0a8` · soul_cinematic · completed · charged 0.12 · location still for its Seedance shot

## loc_ember

- model `soul_cinematic` · 2k · 16:9

```
Photoreal cinematic film still, medium-wide shot. A warm, airy courtyard at golden dusk with smooth pastel coral and peach plaster walls and a pale polished stone floor, bathed in soft warm low sunlight. Stacks of translucent frosted glass cubes, bottles and slabs tinted coral, peach, apricot and soft gold stand on low dark wooden shelves at several heights, glowing in the light; a few tiny floating embers and a light warm haze. Bright, clean, minimal palette of peach and coral. Empty environment only: no people, no figures, no flames, no text.
```

- job `76fbf5a1-d778-40ca-9067-69ed97345fbb` · soul_cinematic · completed · charged 0.12 · ember takes 1-2 judged rewrite (palette too dark and red); replaced by the re-roll
- job `62a2dbc7-dcf8-4dac-9c8e-bccbd72f8f7e` · soul_cinematic · completed · charged 0.12 · ember takes 1-2 judged rewrite (palette too dark and red); replaced by the re-roll
- job `fcddc59f-fa7e-46ca-887f-e2458cb783a5` · soul_cinematic · completed · charged 0.12 · re-roll of `62a2dbc7-dcf8-4dac-9c8e-bccbd72f8f7e` (background: styleframes rewrite, the Ember plate's deep orange-red palette and wall flames are far from the plan's light peach-coral Ember world) · location still for its Seedance shot

## loc_night

- model `soul_cinematic` · 2k · 16:9

```
Photoreal cinematic film still, wide shot. A grand dark hall at night in deep navy blue. A single cool blue moonbeam falls diagonally from a high window through faint haze onto a polished dark marble floor. A slender dark metal rail high above holds a cluster of hanging glass pendants and crystal bottles in lilac, pink and pale blue on thin cords, glowing softly in the moonbeam; tiny dust sparkles float in the air like stars. Empty environment only: no people, no figures, no text.
```

- job `a0900deb-82d9-4ecc-8761-9911f50ae2d5` · soul_cinematic · completed · charged 0.12 · second take; the other night take was the closer match
- job `0dfb3354-579c-4026-8f5d-048f4c58b1e3` · soul_cinematic · completed · charged 0.12 · location still for its Seedance shot

## plate_A2

- model `seedance_2_5` · mode `omni_reference` · 1080p · 16:9 · 6 s · generate_audio false · bitrate_mode high
- `@image1` = cd027d86-ae1e-40a8-b902-714ca1750191 (the loc_studio still)
- declined_preset_id `24bae836-2c4a-48e0-89b6-49fcc0b21612` (the generator suggested its IN THE DARK preset; the literal prompt was kept)

```
@image1 is the location: a dark studio void with a glossy black reflective floor and a sculpture garden of translucent frosted glass towers and cubes tinted pale sky blue, blush pink and lilac; keep its geometry, materials and light. Photoreal, ultra slow motion, high-speed camera look, crisp detail.
Shot 1 (0-6s): a polished dark gunmetal steel ball flies in from the left and smashes into the tallest pastel glass tower at the centre of the frame; on impact the glass bursts into thousands of glittering shards of pale blue, pink and lilac glass that expand toward the camera in ultra slow motion, tumbling and catching bright rim light, sparkling against the dark background, some shards drifting past the lens; the camera is locked off at the height of the impact with a very slow push-in.
No people, no hands, no text, no lettering, no logos.
```

- job `d1e299d5-774e-4780-9060-49cb5f7962a5` · seedance_2_5 · completed · charged 96.0 · 6.57 s on screen
  result: https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071358_d1e299d5-774e-4780-9060-49cb5f7962a5.mp4

## plate_A1

- model `seedance_2_5` · mode `omni_reference` · 1080p · 16:9 · 10 s · generate_audio false · bitrate_mode high
- `@image1` = cd027d86-ae1e-40a8-b902-714ca1750191 (the loc_studio still)
- declined_preset_id `24bae836-2c4a-48e0-89b6-49fcc0b21612` (the generator suggested its IN THE DARK preset; the literal prompt was kept)

```
@image1 is the location: a dark studio void with a glossy black reflective floor and a sculpture garden of translucent frosted glass towers and cubes tinted pale sky blue, blush pink and lilac; keep its geometry, materials and light in every shot. Photoreal, high-end product film, soft caustics, shallow depth of field, slow and elegant camera moves.
Shot 1 (0-4s): extreme close-up macro at floor level; the camera glides slowly forward between the glass towers; light refracts through the pastel glass and caustic patterns ripple across the glossy floor; floating dust motes catch the light.
Shot 2 (4-10s): low-angle shot at floor level: a mirror-polished dark chrome steel ball the size of a billiard ball rests on the glossy black floor in the foreground, mirroring the pastel glass towers on its surface; it begins to roll forward away from the camera, slowly at first, then accelerating toward the tallest glass tower in the background; the camera tracks low behind it.
No people, no hands, no text, no lettering, no logos.
```

- job `54bba259-5f84-44a1-96d9-05db71da872c` · seedance_2_5 · completed · charged 160.0 · 7.26 s on screen
  result: https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_072627_54bba259-5f84-44a1-96d9-05db71da872c.mp4

## plate_B

- model `seedance_2_5` · mode `omni_reference` · 1080p · 16:9 · 5 s · generate_audio false · bitrate_mode high
- `@image1` = 3b35d06e-626d-4690-9e2c-c70e9f2db0a8 (the loc_dawn still)

```
@image1 is the location: a pale plain at sunrise under a peach and apricot sky with rows of tall translucent frosted glass towers in pastel sky blue, blush pink and lilac; keep its geometry, palette and warm backlight. Photoreal, slow motion, high-speed camera look.
Shot 1 (0-5s): wide shot: the glass towers topple and shatter one after another in a chain reaction from left to right, each collapsing tower knocking into the next, sprays of glittering pastel shards bursting into the warm sunrise light; the camera trucks slowly to the right, following the wave of shattering glass.
No people, no animals, no text, no lettering.
```

- job `25bd720f-bb93-4097-a664-90b907b3b753` · seedance_2_5 · completed · charged 80.0 · 1.69 s on screen
  result: https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071432_25bd720f-bb93-4097-a664-90b907b3b753.mp4

## plate_C

- model `seedance_2_5` · mode `omni_reference` · 1080p · 16:9 · 4 s · generate_audio false · bitrate_mode high
- `@image1` = fcddc59f-fa7e-46ca-887f-e2458cb783a5 (the loc_ember still)

```
@image1 is the location: a warm coral and peach courtyard with rose-pink walls, a tall stepped tower of frosted rose glass blocks on the left, and smaller stacks of translucent frosted glass cubes and bottles tinted peach, orange and amber on white plinths and low dark shelves; keep its geometry, light and palette. Photoreal, slow motion, high-speed camera look.
Shot 1 (0-4s): medium shot: bursts of golden sparks and bright fire flashes pop between the glass stacks in quick succession, blowing the orange, peach and rose glass cubes and bottles apart into spinning shards and glowing fragments that scatter through the warm haze; the camera holds steady with a slight shake on each burst.
No people, no hands, no text, no lettering, no logos.
```

- job `f98b353b-6724-44f3-918d-56c0dc90f8c6` · seedance_2_5 · completed · charged 64.0 · 1.45 s on screen
  result: https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_072228_f98b353b-6724-44f3-918d-56c0dc90f8c6.mp4

## plate_D

- model `seedance_2_5` · mode `omni_reference` · 1080p · 16:9 · 4 s · generate_audio false · bitrate_mode high
- `@image1` = 0dfb3354-579c-4026-8f5d-048f4c58b1e3 (the loc_night still)
- declined_preset_id `24bae836-2c4a-48e0-89b6-49fcc0b21612` (the generator suggested its IN THE DARK preset; the literal prompt was kept)

```
@image1 is the location: a dark navy hall at night with a cool blue moonbeam falling through haze onto a polished dark marble floor, and a cluster of hanging glass pendants and crystal bottles in lilac, pink and pale blue on thin cords below a high metal rail; keep its geometry, palette and light. Photoreal, ultra slow motion, high-speed camera look.
Shot 1 (0-4s): low angle near the floor: the cords snap and the glass pendants and crystal bottles fall through the moonbeam in ultra slow motion and shatter on the dark marble floor in front of the camera, bursting into glittering lilac, pink and blue shards that bounce and slide across the reflective floor; the camera is locked off.
No people, no text, no lettering.
```

- job `d2aeadd5-4c81-48d5-b775-badfb7b7c2d5` · seedance_2_5 · completed · charged 64.0 · 2.42 s on screen
  result: https://d8j0ntlcm91z4.cloudfront.net/user_3ArYh7JJOHk1SxOZqJFdwiDPp9D/hf_20261023_071447_d2aeadd5-4c81-48d5-b775-badfb7b7c2d5.mp4

## Notes

- The ember still was re-rolled once (job fcddc59f…): takes 1–2 came out deep orange-red with wall flames, far from the game's light peach-coral Ember world. The prompt was rewritten for the bright coral courtyard (above).
- Seedance followed the shot plans closely. Where each moment really is, in source seconds:
  - plate_A1: shot 1 (glide) 0–4.0 s; shot 2 (the ball rolls) 4.0–10.0 s.
  - plate_A2: the ball hits the needle tower at 1.125 s (frame 27); the burst fills the frame to 6.0 s; 3.85–4.30 s unusable (the ball reads as a flat disc turning edge-on).
  - plate_B: the blue pillar tilts and bursts at 1.2 s; the chain crumbles left to right to 3.9 s; 3.9 s on is haze.
  - plate_C: sparks from 0.5 s; blasts and cracks 1.5–4.0 s.
  - plate_D: the pendants light up in the beam 1.0–2.0 s and burst on the floor at 2.4–3.0 s.
