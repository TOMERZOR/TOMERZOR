# FitSource

Upload a photo of an outfit you found online. FitSource names every piece, finds the shop that sells it, and tells you when it's sold out. Free for shoppers; it earns affiliate commission (see [BUSINESS.md](BUSINESS.md)).

A static site (HTML, CSS, vanilla JS modules, no build step) plus an optional API on Cloudflare Workers.

## What works, and how

There are two scanners. The site picks the best one available.

| | Quick scan | Deep scan |
|---|---|---|
| Runs | In the visitor's browser | On the FitSource API (`worker/`) |
| Needs | Nothing | An Anthropic API key and a deployed worker |
| Finds | Each piece (jacket, jeans, sneakers...), its colour and where it is in the photo | The exact product and brand when the photo shows it, the original shop, other shops, resale listings and lookalikes |
| Stock | No (it doesn't know the exact product) | Yes: Claude reads the product pages, then the worker re-checks each shop itself (Shopify product data, schema.org markup) and trusts the shop over the model |
| Shopping | Search links per piece: Google Shopping, ASOS, Amazon, Depop, Vinted, eBay, Grailed (the search words can be edited) | Direct product links with price, stock and sizes, plus the search links |
| Cost | Free | Roughly $0.15 to $0.40 per scan (see BUSINESS.md) |

The quick scan uses MobileCLIP (Apple, via Transformers.js): the photo is looked at through 29 overlapping windows, each compared with precomputed descriptions of 56 garment types; the colour comes from the pixels, with the background and skin filtered out. The model (23 MB) downloads once from Hugging Face and is cached. Photos are not uploaded.

The deep scan sends the photo to Claude (`claude-opus-5-5` by default) with web search, web fetch and a structured `submit_results` tool, streams progress to the page ("searching...", "opening ssense.com"), then verifies stock at each shop.

Other features: shoppable feed with vibe filters, dots on every photo, draw a box to look up one piece, saved closet, restock alerts (checked each visit through the API), scan history, a shareable "fit receipt" image, light and dark themes, drag-and-drop and paste.

**The feed is sample content.** Its people and brands are invented and the photos are AI-generated (Higgsfield), except "Created By God", which is the real Dream Studios photo linking to the store in this repo. Replace it with real creator posts in `assets/js/data/fits.js`.

## Run it locally

```sh
cd fitsource
npm install                    # dev tools only: tests, model tools, icon build
node tools/serve.mjs           # http://localhost:8080/fitsource/
```

With deep scan, using your own key (the API runs inside the preview server):

```sh
ANTHROPIC_API_KEY=sk-ant-... node tools/serve.mjs
```

## Put it online

### 1. The site (free)

It is plain files, so any static host works.

- **GitHub Pages:** in the repository settings, Pages, deploy from the branch that holds this folder. The site is then at `https://<user>.github.io/<repo>/fitsource/`.
- **Cloudflare Pages / Netlify:** point it at this repository with no build command and `fitsource` as the output folder. (The "Created By God" fit links to `../product.html`, the Dream Studios store next to it; if you deploy FitSource alone, change those two links in `fits.js`.)

After deploying, set `og:image` in `index.html` to the full address of `assets/img/og.jpg` so link previews show the image.

### 2. Deep scan (optional, recommended)

1. Create an Anthropic API key at console.anthropic.com and set a monthly spend limit there.
2. Create a free Cloudflare account, then:

   ```sh
   cd fitsource/worker
   npm install
   npx wrangler login
   npx wrangler kv namespace create FITSOURCE_KV   # paste the id into wrangler.toml and uncomment that block
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler deploy
   ```

3. Put the address it prints (e.g. `https://fitsource-api.<you>.workers.dev`) in `assets/js/config.js` as `apiBase`.
4. In `wrangler.toml`, set `ALLOWED_ORIGINS` to your site's address (comma-separated if several) and `wrangler deploy` again. Requests from other websites are then refused, so they can't spend your credits from a visitor's browser. Scripts outside a browser can still call the API, so keep the daily limit on and, for a hard cap, add a Cloudflare rate-limiting rule for `/api/scan` in the dashboard.

Settings in `wrangler.toml`: `DAILY_SCAN_LIMIT` (free deep scans per visitor per day), `FITSOURCE_MODEL`, `FITSOURCE_EFFORT`, `MAX_SEARCHES`, `MAX_FETCHES`. Requests use Anthropic's server-side fallback (`fallbacks: "default"`) so a declined request is retried on a fallback model.

### 3. Make money

In `assets/js/config.js`:

- `affiliate.skimlinksId` or `affiliate.sovrnKey`: wraps every outbound shop link (sign up at skimlinks.com or sovrn.com).
- `affiliate.amazonTag`: your Amazon Associates tag, added to Amazon links.
- `contactEmail`: shows a "Partner with us" button on the For brands page.

## Tests

```sh
cd fitsource
npm test                       # unit tests: detector, colours, links, worker, stock parser
node test/smoke.mjs            # every page, desktop and phone, light and dark: no errors, no overflow
node test/e2e.mjs              # quick scan with the real model, deep scan against a fake Claude, feed and fit pages
```

The browser tests use the Chromium that Playwright finds, serve the CDN files from `node_modules`, and download the model from Hugging Face on first run. The deep-scan test runs the real worker code against a local fake of the Claude API and fake shops, so it needs no key.

## Layout

- `index.html`, `assets/css/app.css`: the page shell and all styles (tokens at the top, light and dark).
- `assets/js/app.js`: router, theme, drag and drop, paste, restock checks. `views/`: one file per page.
- `assets/js/components.js`: shoppable photo, swing tags, feed cards, shop links.
- `assets/js/scan/`: `engine.js` picks the scanner; `remote.js` talks to the API; `ondevice.js` + `ondevice.worker.js` run the model; `detect.js`, `color.js`, `vocab.js` are the detector logic; `embeddings.json` is generated.
- `assets/js/data/fits.js`: the feed.
- `assets/js/store.js`: closet, scans and preferences (browser storage).
- `assets/js/share.js`: the fit receipt.
- `worker/`: the API. `src/scan.js` (Claude), `src/stock.js` (stock checker), `src/prompt.js` (instructions and result schema), `src/index.js` (routes, cache, limits, CORS).
- `tools/`: `serve.mjs` (local preview), `build-embeddings.mjs` (after editing `vocab.js`), `build-icons.mjs` (after adding an icon), `eval-ondevice.mjs` (try the detector on photos from the command line).

## Credits

MobileCLIP by Apple (Apple sample code licence). Transformers.js by Hugging Face. Claude by Anthropic. Archivo and Geist Mono fonts (SIL OFL, self-hosted). Phosphor Icons (MIT).
