# ECHO · Rebuild brief (prompt to myself)

You are rebuilding ECHO so that it is indistinguishable from a top-grossing
mobile puzzle game made by a real studio. The current build plays well but
looks like a website: DOM cards with blur, CSS buttons, system-ish fonts,
HUD chrome around a canvas. Nothing on screen looks painted, owned, or
designed as one object. Start from zero where needed. Keep only `logic.js`
(rules, levels, economy, validation) and the sound set. Everything the
player sees is replaced.

## 0. The one rule

Every pixel is game art. No HTML buttons, no CSS panels, no glassmorphism,
no system shadows, no web fonts rendered by the browser. If it is on
screen, it was drawn as an asset or rendered by the game renderer from an
asset. Judge every screen by one question: would this screenshot pass as a
Supercell / King / Playrix App Store screenshot? If not, it is not done.

## 1. Stack (web + Capacitor iOS, same as today)

- Renderer: PixiJS 8, one full-screen WebGL canvas, letterboxed to a 1080×1920
  design resolution with safe-area aware anchoring. All screens are Pixi
  containers (scene stack with push/pop and transitions), including shop,
  settings, dialogs, toasts.
- UI kit: 9-slice panels, buttons with up/down/disabled states, tabs, pills,
  progress bars, chips, currency counters with count-up, scrollable lists,
  modal dialogs. All textures from an atlas built by a script (`tools/atlas`).
- Text: a bitmap font (MSDF) generated from a chunky rounded display face
  (Fredoka-like, licensed) in 3 sizes, plus a body face. Hebrew gets its own
  bitmap font. Never `canvas.fillText` in the final UI.
- Animation: GSAP timelines for every state change (screen in/out, button
  press, reward reveal, star burst, counter roll). Nothing appears without
  motion; nothing moves linearly. Spine/DragonBones-style rigs for the hero
  and robots (idle, hop, land, celebrate, caught, teleport); if rigs are out
  of reach, 8-frame hand-animated sprite sheets per state.
- Audio: Howler, the existing ElevenLabs set plus UI sweeteners and a
  2-layer adaptive music system (calm layer always, pulse layer when echoes
  are active).
- Build: Vite, TypeScript, one `npm run build` producing `dist/` for GitHub
  Pages, Higgsfield and Capacitor.

## 2. Art direction (write the style bible first, then generate)

- Theme: "Toy lab after hours". Chunky toy-plastic robots, warm plum hall,
  golden time portals, mint holograms, violet tech, coral hazards. The
  palette from the current CSS tokens is the law; nothing else.
- Materials: everything looks like molded, lit plastic and brushed metal
  with a hard rim light from top-left; thick dark outlines only on
  characters, never on UI.
- UI language: rounded rectangles with a top bevel highlight and a bottom
  shadow band, chamfered gold/orange primary buttons with a 3-px drop
  lip, violet secondary buttons, panels with a subtle inner frame and
  riveted corners. Icons are painted, three-tone, 128px, consistent stroke.
- Generate every asset with Higgsfield from the style bible and one
  reference sheet; key out and slice with the existing pipeline. Required
  assets: UI kit (≈40 textures), icon set (≈30), room tileset (floor,
  walls, corners, gates, plates, exit, coins, drones, hazards) for three
  worlds, character rigs/sheets for 9 robots, key art per world, shop
  banners, pass banner, app icon (keep the portal icon), splash.

## 3. Screens (each is its own Pixi scene, each gets a screenshot test)

1. Splash + loading (logo, portal spin, progress) → title in < 2 s.
2. Home: key art hall, your robot on stage with holo-echoes, animated
   logo, today's cards (daily, pass, event), Play with next room, bottom
   nav bar (Home, Levels, Shop, Daily, Profile) as a painted tab bar.
3. World map: a real map, not a list: a painted vertical path through the
   lab with level nodes, world gates, chests at milestones, clouds/fog
   on locked areas, the camera scrolling to the current node on entry.
4. Level: the room fills the screen; HUD is painted (move counter as a
   mechanical dial, echo slots as hologram lamps, End Loop as the big
   action button). Win: stars slam in with screen flash, coins fly, chest
   or robot reward reveal. Fail: short, kind, with rewind.
5. Shop: hero banner carousel (featured robot, starter pack, pass), robot
   cards with 3D-ish podium, rarity frames, "try it" preview that plays an
   idle animation, currency packs with best-value ribbons.
6. Season pass: a vertical track with free and premium lanes, animated
   chests, claim bursts, "unlock premium" sticky CTA.
7. Daily + events: calendar with streak gems, a leaderboard panel with
   avatars (robot heads), countdown timers.
8. Profile/settings: robot showcase, stats, language, audio, haptics.
9. Dialogs: purchase confirm, out of currency (offer), rate us, rewards.

## 4. Game design to ship (not just look)

- 60 rooms across 5 worlds; each world introduces one mechanic (plates,
  drones, mirror echoes, teleport pads, timed gates) and ends with an exam
  room and a chest. Pars tuned by the solver; every room proven solvable
  and every loop survivable (keep `tools/check-levels.mjs`).
- Difficulty curve: 3 easy, 2 medium, 1 hard per 6; a star gate every world.
- Assists stay: drone forecast, danger cells, rewind, undo, adaptive help.
- First 90 seconds: no menus. Splash → room 1-1 with a 3-step overlay
  tutorial (swipe, wait, end loop) → first echo moment → reward → home.
- Retention: daily room with streak, weekly event world, chests with robot
  shards, season pass, 9 robots at launch with 3 more teased.
- Monetization (simulated until StoreKit): gems, starter pack, remove ads,
  pass; rewarded ads for hints and coin doubling; no energy system.

## 5. Juice checklist (every item must be visibly present)

Button press squash, screen transitions with wipes, parallax on map and
home, hop with squash/stretch, landing dust, coin magnet with trail, star
burst with chromatic flash, counter roll-ups with tick sounds, idle
animations on every character, portal particles, hologram scanlines,
haptics on every meaningful touch, toasts that slide and bounce.

## 6. Process

1. Style bible + UI kit sheet + one fully painted mock of Home, Map, Level,
   Shop. Compare side by side with three reference games; iterate until the
   mock passes the rule in §0.
2. Generate and slice the asset set; build the Pixi UI kit; port screens
   one at a time, screenshot-testing each at iPhone 15, iPhone SE and iPad.
3. Port gameplay rendering to Pixi (tiles, lights as additive sprites,
   particles, rigs), keeping `logic.js` as the only source of truth.
4. Play-test every room through the real UI with the recorded solutions;
   run the assist tests; profile to 60 fps on a mid phone.
5. Ship to GitHub Pages, Higgsfield and Capacitor; new App Store
   screenshots and icon.

## 7. Done means

A stranger shown the home screen, the map, a level and the shop on a phone
cannot tell it from a published studio game; 60 rooms solvable; 60 fps;
onboarding in 90 s; zero DOM elements over the canvas except the Capacitor
shell.
