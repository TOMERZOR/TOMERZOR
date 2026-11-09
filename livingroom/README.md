# Living Room

See any item from the internet in your own home, at its real size, in augmented reality. Paste a link to a sofa, a lamp, a rug or a poster from any store, and Living Room reads the product's real dimensions, builds it in 3D and places it on your floor or wall through the phone's camera. Hebrew, installable on the home screen (PWA). Static site, no build step, plus a small Cloudflare Worker.

Live (after merging): https://tomerzor.github.io/TOMERZOR/livingroom/

```
python3 -m http.server 8792        # from the repo root, then open http://localhost:8792/livingroom/
```

## What it does

- **Add anything:** paste a product link (the server reads the name, photo, price and the real outer dimensions; with Claude when the key is set), take or pick a photo of the product (the plain background is removed on the phone), or pick a type and type the dimensions. 14 ready-made items are there to try first.
- **Three ways to draw an item, always at its real size:**
  - *Shape*: drawn by the app for its type (sofa, armchair, chair, coffee table, table, bed, bookcase, sideboard, lamp, plant, rug, poster, mirror, TV, vase), in the product's colour. Instant and offline.
  - *Photo*: the product photo itself, cut out and standing at its real width and height.
  - *3D*: a real model, taken from the store page when it links one, or generated from the photo by AI (Tripo). It is stretched to the exact dimensions.
- **AR in the room** (`js/ar.js`):
  - Android (Chrome): WebXR with floor and wall detection. Wall items (posters, mirrors, TVs) hang on the wall. Place several items, drag them on the floor, turn them with two fingers or the buttons, move or remove them. A tape measure measures the real room ("will it fit?"). Items that overlap get a red outline. Shadows fall on the real floor and the room's light is used when the phone reports it.
  - iPhone / iPad: AR Quick Look with a USDZ built on the device. Scaling is locked so the item stays true to size.
  - Computer: a QR code that opens the same item on the phone.
- **Room planner** (`js/studio.js`): set the room's size, arrange items in 3D (drag, two-finger turn, duplicate), wall items snap to the walls, and the walls nearest the camera fade away. Toggles: all dimensions, walking space (the clearance each piece needs, e.g. 75 cm in front of a sofa and around a dining table), a 175 cm person for scale, and evening light with the lamps on. Overlapping items are flagged. The room's total price adds up. "בחדר שלי" drops the whole arrangement into the real room in one go, keeping the layout.
- **Edit and share:** change dimensions (cm or inches), colour, type and how the item is drawn; the 3D preview updates live. Share an item as a link that opens it in Living Room on another phone.

Everything stays on the device (IndexedDB): items, rooms, photos and 3D files. The server keeps nothing.

## Files

| file | what it does |
| --- | --- |
| `js/app.js` | screens, sheets, the add flows, rooms, sharing, AI model polling |
| `js/models.js` | builds each item at real size: shapes per type, photo cutout, GLB fitting |
| `js/scene-kit.js` | an item in a scene: soft shadow, dimension lines, walking space, outline, overlap test |
| `js/studio.js` | the 3D planner, and the turntable in the item sheet and on the home screen |
| `js/ar.js` | WebXR session (hit-test, drag, twist, tape measure, light estimation) and AR Quick Look export |
| `js/thumbs.js` | renders card pictures from the 3D models |
| `js/catalog.js` | types, default sizes, clearances, colours and the ready-made items |
| `server/` | the Cloudflare Worker (below) |
| `vendor/` | three.js r187 and its addons, qrcode-generator (MIT) |

## Server (`server/`)

| route | |
| --- | --- |
| `POST /api/import {url}` | fetches the page, reads JSON-LD, Open Graph, 3D model links and dimensions written in the text (`server/src/extract.js`), then asks Claude for clean dimensions in cm, the type, the best photo and the colour (`server/src/ai.js`). When the store blocks the request, Claude looks the product up with web search. |
| `GET /api/img?u=` | a store photo with CORS headers, so the app can cut it out |
| `GET /api/file?u=` | a GLB/glTF linked from a store page |
| `POST /api/model` | uploads the photo to Tripo and starts an image-to-3D task (`server/src/tripo.js`, API v3) |
| `GET /api/model/:task`, `/file` | progress, then the finished GLB |

Tests: `cd server && npm test`.

Deploy: `.github/workflows/livingroom-api.yml` deploys on push once the repository secret `CLOUDFLARE_API_TOKEN` exists, then writes the server address into `js/config.js`. Optional secrets: `ANTHROPIC_API_KEY` (already set for ArsLate) for reading pages with Claude, and `TRIPO_API_KEY` for AI 3D models (the Tripo account needs credit). Without the server the app still works: items are added from a photo or by dimensions.

Daily limits per visitor (when the KV namespace is bound by the workflow): 40 imports and 4 AI models, in `server/wrangler.toml`.

## Notes

- Dimensions come from the store page. When the page has none, the app says they are an estimate and asks to check them.
- WebXR AR needs Chrome on an ARCore phone. iPhone uses Quick Look, which shows one arrangement at a time and can't be edited inside AR.
