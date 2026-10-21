# ECHO 2.0 (the rebuild)

The game drawn to the painted mocks in `../echo/design/mocks`: one WebGL canvas
(PixiJS 8), a 1080×1920 design space scaled to the phone, GSAP for motion,
Howler for sound. The rules stay in `../echo/logic.js`, shared with the server;
this folder only draws and listens.

```
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # dist/  (deployed to Pages as /echo2/, to Higgsfield at /, and into echo-ios)
```

## Layout

- `src/main.ts` boot: Pixi app, asset preload, safe-area aware `fit()`.
- `src/scenes.ts` scene stack with the mint wipe; `layout` is the visible box.
- `src/ui.ts` the plastic UI kit (panels, chamfered buttons, round keys, pills, bars, ribbons).
- `src/widgets.ts` top bar, tab bar, icon and robot sprites (echo holograms baked once per skin), scroll view, toggle, toast.
- `src/state.ts` the profile: `logic.js` run locally against localStorage (`echo2:` keys).
- `src/scenes/` home, map, level (board, beats, assists, rewind, coach, result sheet), shop, pass, daily, profile, settings, dialog.
- `public/assets/` sprites, sliced icons and tiles, backdrops, sound.

## Rooms

50 rooms in five worlds live in `../echo/logic.js`; `../echo/tools/plan.mjs`
plans a room with the real rules and sets its par, `../echo/tools/check-levels.mjs`
replays every recorded solution and lints door placement.
