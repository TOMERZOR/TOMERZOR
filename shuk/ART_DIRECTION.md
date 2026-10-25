# Art direction brief (the bar to hit)

**Prompt to myself:** Make "Shuk Rush" look like a top-grossing mobile runner that a studio has polished for years (Subway Surfers, Talking Tom Gold Run, Temple Run 2 era 2024). Nothing may look like a prototype, a slide deck, or flat 2D. Every screen should feel tactile, saturated, chunky and alive.

## World (3D)
- **Curved world**: the street bends down and slightly sideways toward the horizon (vertex-shader bend), like Subway Surfers. Hides pop-in, adds depth.
- **Post-processing**: soft bloom on bulbs, coins and power-ups; warm color grade with extra saturation and contrast; vignette; FXAA. Quality toggle for weak phones.
- **Real props, not boxes**: hero market stalls generated as textured 3D models (fruit and vegetable stall, spice stall, sweets/bakery stall), a real produce truck, real crate stacks. Procedural geometry only for filler.
- **Lighting**: strong warm key light with crisp shadows, cool sky fill, rim light on the runner, blob contact shadows under props, emissive bulbs that glow at night.
- **Sky**: gradient with soft clouds by day, stars at night.
- **Motion**: speed lines at high speed, coin pickup fly-to-counter, squash and stretch on landing, camera FOV kick on super jump.

## UI (2D)
- **Font**: rounded, heavy game font with Hebrew support (Fredoka), always with a thick dark outline and a drop shadow, gradient fills for titles and numbers. Never a plain office font.
- **Buttons**: glossy, beveled, candy-like (generated art), big press animation, sound and haptic on every tap.
- **Icons**: rendered 3D icons (coin, magnet, rugelach, sneakers, hamsa, star, gear, pause, people, bolt, flag), generated and background-removed.
- **Panels**: wooden market-board / awning theme with stripes, rope and light; no plain white cards.
- **Logo**: layered 3D-looking lettering with outline, bevel highlight and a badge.
- **HUD**: score top with outlined gradient digits, coin counter with 3D coin, circular power-up timers.

## Tone
Affectionate Israeli satire: the shuk on a Friday, Jerusalem quirks, every edah's grandma, haggling, tourists, parking, Shabbat rush. Jokes punch at situations, never at people's dignity.

## Language
Hebrew by default, English available from settings.
