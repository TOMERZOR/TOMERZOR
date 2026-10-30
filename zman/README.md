# זמן (Zman)

A satellite map of the whole world with one control: a year slider. Drag it and the place you're looking at changes with time, from 10,000 BCE to today. Hebrew UI, no sign-in, no API keys, static files only.

Live (once this folder is on the Pages branch): https://tomerzor.github.io/TOMERZOR/zman/

```
cd zman
npm install      # only for tests and rebuilding the tile worker
npm test
npm start        # http://localhost:8080
```

## What you see

- **2014 to today: real satellite photos.** [Esri World Imagery Wayback](https://livingatlas.arcgis.com/wayback/) keeps every release of Esri's world imagery since February 2014. Each year shows the last release of that year (2014 shows the first one). The list of releases is fetched live, with a built-in copy in `js/model.js` as a fallback. The caption reads "צילום לוויין · <month year>" with a green dot.
- **Before 2014: an estimated reconstruction.** No satellite photos of the whole world exist before then, so the map takes the oldest photo (February 2014) and covers whatever didn't exist yet with natural ground, using OpenStreetMap data from [OpenFreeMap](https://openfreemap.org). The caption reads "שחזור משוער" with a gold dot, and the slider track is gold for that part.

## How the reconstruction works

Every building, street, railway, airport, neighborhood and built-up area gets an estimated build year:

- **Order.** `src/tiles.js` runs in Web Workers (`js/tile-worker.js` is its bundle). It rewrites each OpenStreetMap vector tile, splitting the merged multi-shapes OpenFreeMap ships back into single features, and gives each one `h`, its place in the build order (0..1). `h` is mostly smooth noise over the map, so whole neighborhoods grow together, plus some per-feature randomness.
- **Year.** `CURVES` in `js/model.js` maps `h` to a year per kind of thing, shaped roughly like 20th-century urban growth. For example, about a third of today's buildings stood in 1950 and almost none before 1850. Motorways come after 1950 and railways after 1845. Tall buildings can't be older than their height allows (`HEIGHT_YEAR`). Farmland turns back to wild land as you go back past the start of farming.
- **Historic cores.** `js/cores.js` lists about 60 old centers (Jerusalem's Old City, Jaffa, Akko, Rome, Cairo, Xi'an, Cusco…), each with a founding year and radius. Inside one, about half of what stands today goes back to the founding.
- **Sea level.** Before about 5000 BCE the sea was lower (58 m lower at 10,000 BCE), so the exposed sea floor is painted as land from elevation data ([Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)).
- **Ground color.** It's sampled from a wide photo of the area, so a desert gets sand and a forest gets green.

Speed: build years are grouped into time slices with one map layer per slice, so moving the slider only changes layer opacities and never re-reads tiles.

It's an illustration, not history: the growth curves are global averages, and actual build dates aren't in OpenStreetMap for most places. Places that grew differently, like a city flattened in a war or one built from scratch in the 1990s, will look wrong.

## Controls

- Drag the slider, or click a year under it.
- Arrow keys on the slider step a year near today, and 10, 50 or 100 years further back. Home and End jump to the ends.
- Space plays the whole timeline in 30 seconds.
- The address keeps the place and year (`#zoom/lat/lon/year`), so a link opens the same view.

## Files

- `index.html`, `style.css`: the page and the slider panel
- `js/app.js`: the map, imagery switching, cover layers, textures, slider
- `js/model.js`: slider scale, year text, build-year curves, sea level, Wayback releases
- `js/cores.js`: historic cores
- `src/tiles.js`, `src/tile-worker.js`: the tile rewrite (run `npm run build` after changing them)
- `vendor/maplibre/`: MapLibre GL JS 5.24 (BSD-3-Clause)
- `test/`: `node --test`

## Data and terms

- Imagery: Esri World Imagery Wayback (Esri, Maxar, Earthstar Geographics, GIS User Community). Esri allows use with attribution, which the map shows. Check [Esri's terms](https://www.esri.com/en-us/legal/terms/full-master-agreement) before any commercial use.
- Map data: © OpenStreetMap contributors (ODbL), tiles by OpenFreeMap.
- Elevation: Mapzen Terrain Tiles on AWS Open Data.
