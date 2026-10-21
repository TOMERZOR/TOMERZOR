# ECHO · Style bible v1

The law for every asset, screen and animation in the rebuild. When in doubt,
pick the option that looks more like a molded toy and less like a web page.

## 1. Theme

**Toy lab after hours.** A robotics lab at night, lit warm. Everything is a
toy: chunky, rounded, glossy plastic and brushed metal, built to be picked
up. The player's robot is the only "real" thing; its echoes are holograms
projected from mint landing pads. Time portals are golden, swirling, warm.

## 2. Palette (final)

| Token | Hex | Use |
| --- | --- | --- |
| Plum ink | `#130e1b` | deepest shadow, letterbox |
| Plum night | `#1e1729` | base background |
| Plum wall | `#3c3052` → `#6e5d8c` | walls, panels, UI plates |
| Lilac text | `#a99ac6` | secondary text |
| Cream text | `#f7f2ff` | primary text |
| Hero orange | `#ff8a3d` → `#ffb86b` | hero, primary buttons, Play |
| Mint echo | `#7ef0c6` | echoes, holograms, success, secondary accents |
| Violet tech | `#c08cff` | plates, gates, premium currency, pass lane |
| Coral hazard | `#ff5c7a` | drones, danger, errors |
| Gold prize | `#ffcf5a` → `#ffe39a` | coins, stars, portals, rewards |

Rules: one accent per element; never two neon accents touching; gold is
only for value (coins, stars, portals, prizes); coral only for threat.

## 3. Light and material

- Key light top-left, 35°, warm (`#ffd9a8`). Rim light mint from behind on
  characters. Hard specular dot on every glossy surface.
- Plastic: smooth gradient, a bright bevel on the top edge, a darker band on
  the bottom edge, 2 px inner line. Metal: brushed horizontal gradient with
  a single highlight stripe.
- Shadows are soft, plum-colored (never black), offset down 6–10 px.
- Outlines: dark plum 4–6 px on characters and pickups only. UI has no
  outlines; it has bevels.

## 4. UI kit

- **Panels**: rounded 28 px, plum wall gradient, top bevel highlight,
  riveted corners (4 small studs), 1 px inner frame at 40% cream. 9-slice.
- **Primary button** (Play, Buy, Claim): gold→orange gradient, chamfered
  corners (16 px cut top-left and bottom-right), 4 px darker lip at the
  bottom, text in plum ink, uppercase display font with 0.06em tracking.
  Pressed: lip collapses, button moves down 3 px, brightness +10%.
- **Secondary button**: violet plastic, same shape, cream text.
- **Ghost button**: plum wall with 1 px lilac frame.
- **Chips/counters**: pill, plum night fill, icon left, number right in
  display font; count-up animation with tick sounds.
- **Progress bars**: inset plum track with inner shadow, fill in mint→violet
  with a moving highlight stripe.
- **Tabs / nav bar**: a painted metal bar with 5 slots; the active slot is a
  raised plastic key lit in mint.
- **Dialogs**: a panel on a 70% plum ink scrim, slides up 24 px and settles
  with a 1.03 overshoot.

## 5. Type

- Display: a chunky rounded geometric face (Fredoka-class), rendered as
  MSDF bitmap font. Sizes 96 / 56 / 36 / 26. Titles uppercase with tracking;
  numbers tabular.
- Body: rounded humanist (Nunito-class), 30 / 24 / 20.
- Hebrew: Heebo-class, same sizes, own bitmap font; layout mirrors.
- Text always has a plum ink drop shadow (0, 3) on art backgrounds.

## 6. Icons

Painted, three-tone (base, light, dark), 128 px, same stroke weight,
rounded terminals; mint for navigation, gold for value, violet for premium,
coral for danger. 30 icons: play, pause, back, settings, shop, bag, gem,
coin, star, star-empty, lock, chest, calendar, flame, trophy, crown,
ticket, undo, restart, skip, hint, sound, music, vibrate, language, share,
replay, check, cross, info.

## 7. Characters

9 robots, same rig: idle (breath + eye glance), hop (anticipate 2 frames,
air 2, land squash 2), celebrate (jump + arm raise), caught (zap + fall),
teleport (spin + shrink). Holograms: the same frames tinted in the robot's
light, 82% opacity, 3 px scanlines, mint pad ring under the feet.

## 8. World and room art

- Tiles 128 px: floor (3 variants + edge AO), wall top, wall front, inner
  corners, plate (off/on), gate (open/closed, 4 frames), exit portal (8
  frames), coin (8 frames), drone (hover 4 frames + eye glow), hazard glow.
- Worlds: 1 The Lab (plum, warm lamps), 2 The Observatory (deep violet,
  starlight), 3 The Mirror Lab (cool lilac, mirrored panels), 4 The Vault
  (bronze and gold), 5 The Core (coral alarms). Each world: tileset recolor,
  key art, map segment, music layer.

## 9. Motion

- Easing: `back.out(1.6)` for appearances, `power3.out` for moves,
  `elastic.out(1, .5)` for rewards. Durations 180–320 ms; nothing over 600
  ms except reward reveals (900 ms).
- Screen transitions: wipe with a soft mint edge, 260 ms.
- Every button: press squash 0.96, release overshoot 1.03.
- Idle: everything alive breathes at 2.4 s period.

## 10. Audio

Existing ElevenLabs set. Add: tab switch, panel open/close, counter tick,
chest open, reward sting, map node unlock, portal hum (loop), hologram
flicker (loop, quiet). Music: calm layer always; pulse layer fades in when
an echo is active; swell on level clear.

## 11. Reference set

Clash Royale (UI plasticity, chests), Royal Match (buttons, counters,
rewards), Monument Valley (calm palette discipline), Hitman GO (board
clarity), Alto's Odyssey (home screen restraint).
