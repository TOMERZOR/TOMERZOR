# השתול shorts kit

The 41 s film's engine (`../film.js`) without its story. It has three parts: `kit.js` (`window.KIT`), `endcard.js` (`KIT.endcard`) and `template/` (an 8 s short to copy). The film itself stays untouched.

## Start a short
```sh
cp -r shorts/template shorts/myshort          # comp.html = the film's page shell; film.js = your short
python3 tools/stills.py out/myshort/s.png 0.5,3,6,9,12,15,16,17.9 270 "" --comp shorts/myshort/comp.html
open shorts/myshort/comp.html?play            # or ?t=12.3&hud  ·  add &safe to see the safe zone
```
A short is one `KIT.run({...})` call (see `template/film.js`, ~110 lines):

| hook | when | does |
|---|---|---|
| `T` | — | the timeline table; `T.dur` is required (use `END.dur`) |
| `build()` | after fonts load | `KIT.screen(...)`, `KIT.mk(...)`, collect handles. Create every element here: later ones are never measured |
| `measure()` | after measuring | optional; derive values from `M(el)` |
| `camera()` | after measure | return `{ keys, hits, rests }` |
| `update(t)` | every seek | write every property you ever change, every frame |
| `events()` | once | `KIT.ev(...)` sound events |
| `track(box)` | probe/verify | `box('name', el)` for what the story is about |

The run installs `__meta __ready __seek __track __motion __events`, plus `__unsafe(t)` and `__T`. It also gives `?play`, `?t=…&hud`, `?render` and `&safe`, all behaving as in the film.

## API (`window.KIT`)
- **Constants:** `W H` (1080×1920), `G` (2.5), `FPS` (30), `SAFE`, `NAMES`, `CODES` (the cast: תומר נועה איתי שירה יובל דנה → demo-1…6), `SPR` (the game's springs: pop, soft, bouncy, firm, snap), `ease`, `OM`, `Q` (URL params).
- **Motion:** `K(t, t0, kind='pop')` is the game spring, 0 before t0. `life(t, t0, A, kind, R, t1, dur, X)` springs in from A, rests at R, and leaves toward X over [t1, t1+dur]. Also `pulse(t, t0, amp, decay, ω)`, `press(t, tc, dur)`, `mixS`, `toRect(r, v, uniform)` (FLIP), `lerpRect`, `center(r)`, `arcPt(a, b, k, h)`, `clamp lerp seg sstep spring cubicIn fix`.
- **DOM:** `$ $$`, `mk(tag, cls, parent=fx, inner)`, `put(el, {x,y,r,s,sx,sy,ry,op,base})`, `hide`, `txt html cls attr cssv`, `on(screen, bool)`. `put` caches transform and opacity per element and appends `el.__base` (the element's resting transform, e.g. `'rotate(-2deg)'`) unless you pass `base`.
- **Screens:** `screen(name, src=name)` returns a `div.scr` that you also find as `S[name]`. `fx` is the overlay layer, always on top of the screens. Use `avatar(code,o)`, `svgOf(code,o)` and `swapAvatar(span,code,o)` for the game's character generator, and `splitWords(el)` to wrap words in `span.w`.
- **Measure:** `M(el)` returns `{x,y,w,h}` in game px. Every element inside `#phone` (SVG internals excluded) is measured once, with an identity camera and every screen switched on. Rects include each screen's own offset (e.g. the end card's −1150).
- **Camera:** `Pt(gx, gy, zoom)` and `Fr(rect, zoom, ox, oy)` make keys. `camAt(t)` is the film's composer: keyed path (`OM.camera`), a hand-held two-sine float that dies in rests, and shakes. `keyedAt(t)` is the path without float or shake. `restEnv(t)` is 0 in rests. `rayAngle(t)` integrates the motion clock: rays turn only while the film moves. `rays(el, t, a, op, sc, base)` and `wobble(t, el, from, amp)` drive the game's rays and its ±3° `.wobble` on that clock.
- **Fx parts:** each takes a spec, or `() => spec` resolved after measuring.
  - `finger({knots:[{t,x,y}], taps:[t], windows:[[in,out]]})`: the film's finger, with a ripple on every tap. Sound is not automatic: emit `tap` / `key` / … yourself.
  - `sweat([{t0,t1,x,y,style:'drip'|'bead'}])`
  - `emoji([{t0,ch,from:[gx,gy],to:[gx,gy]}])`: 1.05 s fly-ups.
  - `confetti({t0,x,y,seed,n})`
- **Extra parts:** `part({build, measured, camera(acc), events, update(t, mat), track(box)})` adds your own. The end card is one.
- **End card:** `KIT.endcard({t0 | hit, cta, frame, dy})`, described below.

## Coordinates
- **Game px:** the phone's CSS px. The phone is **430×932**; its captured screens live at (0,0)–(430,932).
- **World px** = game px × **G = 2.5**: `#phone` is `scale(2.5)` inside `#cam`, so the phone is 1075×2330 world px.
- **Camera:** a key `{x, y, zoom}` puts world point (x,y) at the frame centre (540, 960). At zoom 1, one world px is one frame px, so the 1080×1920 frame shows 432×768 game px. At zoom z it shows 432/z × 768/z.
- Full-width elements (cards, grids, the wordmark) crop at the frame edge from about zoom 1.0–1.12. Zoom ≤ 1 shows the whole phone width.
- **The end card** is a second `home` screen at `translateY(-1150px)`: world game-y −1150…−218, above the scene. Keep your own screens out of that band, or pass `dy`.
- `__events` pan = the event's game point projected through the camera at t: x→[−1,1].

## Add a captured screen and animate it
Captured screens are in `vendor/screens.js`. To inspect one: `node -e "global.window={};require('./vendor/screens.js');console.log(Object.keys(window.SCREENS))"`, or compare with the original in `tools/lab.html`.
```js
const v = KIT.screen('vote', 'vote_pick');     // second instance of a capture: ids, url(#…), href="#…" are renamed
E.cells = KIT.$$('.vote__cell', v); E.title = KIT.$('.vote__head .title', v).parentElement; E.title.__base = 'rotate(-4deg)';
// update(t):
KIT.on(KIT.S.vote, t >= T.v0 && t < T.v1);    // a screen is display:none unless on
E.cells.forEach((c, i) => KIT.put(c, KIT.life(t, T.v0 + i * 0.05, { s: 0.5, r: -6 }, 'pop', {}, T.v1 - 0.3, 0.25, { y: 40, op: 0 })));
```
- **Nothing moves on its own:** `#phone *` has `animation:none; transition:none`. Every change is yours, every frame.
- **Inline styles:** captures carry the game's own inline `opacity/transform` (e.g. a face-down `.reveal__flip` has `rotateY(180deg)`). Overwrite them with `put` (`base:''` drops `__base`).
- **Morphs:** to make a card grow out of another, use `toRect(M(self), lerpRect(M(from), M(self), k), true)`.
- **Hidden parts:** hide pieces you don't use (headers, foot buttons) with `hide(el)` every frame.

## Key the camera
```js
camera() { const y = M(E.cells[4]); return {
  keys: [{ t: 0, ...Pt(215, 400, 0.92) },                                   // first key: no curve
         { t: 1.2, ...Pt(215, 430, 1.0), curve: KIT.ease.cubicInOut },     // curve = how we arrive at this key
         { t: 3.4, ...Fr(y, 1.62), curve: KIT.ease.expoOut }],              // punch-in on a rect
  hits:  [[3.38, 14, 9]],                                                   // [t, amp px, decay] shake
  rests: [[3.9, 4.7]] }; }                                                  // float off in [a,b] (0.25 s ramps)
```
- **Holding:** two keys with the same target hold the camera.
- **Shake sizes from the film:** logo 5/12, the 7 reveal 14/9, a tap 5/12, the verdict 18/8.
- **Rests:** the end card adds its keys after `t0` and its own rest from `t0+2.4`. It also clips your rests at `t0`.

## Sound events
Call `KIT.ev(t, kind, gx, gy, v)` with game px for the position, and v from 0 to 1. `tools/dump_events.py "" out/x/events.json --comp shorts/x/comp.html` writes `{T, events:[{t, kind, pan, v}]}`.

Kinds that `audio/score.py` `recipe()` knows:
- **UI:** `tap type key lock confirm check cell pop swish whoosh whip title flip card_slap deal deal_odd join crown on start`
- **Logo:** `letter logo_hit punch word`(silent) `glance drip riser gulp thud`
- **Hits:** `reveal_big stamp stamp_soft boom boom_soft drop verdict drum roulette mini`
- **Crowd:** `crowd_oooh crowd_cheer crowd_laugh react`
- **Rewards:** `reward coins step land win confetti`
- **Music ducking:** `logo_hit punch reveal_big verdict boom win crowd_* stamp lock` duck it harder.

**Warning:** `audio/score.py` as written is the film's mixer. Its music part reads film keys from `T` (`flip.יובל`, `drum`, `figDrop`, `verdict`, `endPitch`, `cells0`), cuts `take1.mp3` for 41 s, and always writes `audio/stem_*.wav`. Do not run it on a short's events: that fails, or overwrites the film's stems. A short needs its own mixer that reuses `recipe()`.

## The end card
```js
const END = KIT.endcard({ t0: 15.0, cta: 'תצליחו לתפוס את השתול?' });   // or { hit: 16.0 }
T.dur = END.dur;                                                          // t0 + 3.0
```
- **The grid after t0:**
  - 0–0.56: whip up, from wherever your camera is.
  - .30: cast pops.
  - .63: letters drop.
  - **1.00: `END.hit`**, the wordmark lands (logo_hit plus a small shake). Put this on the music's hit.
  - 1.5: pitch. 1.8: "חוץ מאחד." punch.
  - 1.9: URL chip.
  - 2.2: `cta` line (or the facts "3–12 שחקנים · מזמינים בוואטסאפ").
  - From 2.4: still.
  - 2.6: the eggplant's wink (closed by 2.98).
  - 3.0: end.
- **Keep your scene visible** until `t0 + 0.7`: the whip carries it off frame, and nothing fades.
- **After `run`:** `END.keys`, `END.events`, `END.T` (absolute times) and `END.h` (handles) are filled in.
- **`frame`:** `'safe'` (the default) keeps everything inside SAFE. `'film'` gives the film's exact framing, whose facts line sits in the bottom 420 px.

## SAFE (TikTok / Reels)
Nothing important goes in the top **150 px**, the bottom **420 px**, or the right **130 px of the lower half** (x > 950 and y > 960) of the 1080×1920 frame. `KIT.SAFE = {top:150, bottom:420, right:130, rightFromY:960}`. `comp.html?t=…&safe` draws the zones. `__unsafe(t)` lists tracked boxes that break SAFE (the finger is ignored).

## Checklist before handing a short over
1. **No page errors:** `python3 tools/stills.py out/<x>/s.png <times> 270 "" --comp shorts/<x>/comp.html` prints `errors: none`. Look at the sheet.
2. **Purity:** `python3 out/kit/purity.py shorts/<x>/comp.html 0,1.3,…,17.9`. It must say "seek twice: same · forward vs shuffled: identical". Usual culprits: something computed in `update` that only some frames write, state kept in closures, `Date`/`performance.now`/`Math.random` (use `OM.rng(seed)`), and elements created after `build`.
3. **SAFE:** `window.__unsafe(t)` is empty on your key frames; check them with `&safe`.
4. **Sound:** `dump_events.py` works, and pans look plausible: a sound where the camera is looking is near 0.
5. **Draft:** `python3 tools/render.py shorts/<x>/comp.html --out out/<x>/draft.mp4 --width 1080 --height 1920 --fps 30 --grain 2.5 --workers 2`. Use a separate out dir per composition: frames go to `<dirname(out)>/_frames`. Never render at 60 fps or with more than 2 workers on the shared machine.

## Paid-for gotchas
- **Unique ids:** ids and clip-path ids must be unique per instance. `screen()` renames them for every instance whose name ≠ src. Avatars generated by `CH` are unique already.
- **No grain or noise layer in the page.** It made every screenshot 2.4× slower; grain is added at encode (`--grain`).
- **Raster history:** `seek` re-creates the camera's compositor layers every call (`#cam` display toggle, about 6% of a capture). Without that, Chromium reuses a raster scale from earlier frames, and the same t differs by sub-pixel edges depending on what was drawn before. `KIT.keepLayers = true` turns it off. Never fix this with `will-change`: that pins the first raster scale and makes it worse.
- **End card offsets:** the end card's chip and facts are children of the lifted card. Their `top` is the measured pitch rect minus the offset, subtracted once.
