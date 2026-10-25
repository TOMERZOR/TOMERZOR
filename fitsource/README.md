# FitSource

Upload a photo of an outfit you found online. FitSource names every piece, finds the shop that sells it, and tells you when it's sold out. Free for shoppers; it earns affiliate commission and brand fees (see [BUSINESS.md](BUSINESS.md)).

Built for Israel: the whole site is in Hebrew and laid out right to left, prices are in shekels, and the shop links point at shops Israelis use. The name stays FitSource.

A static site (HTML, CSS, vanilla JS modules, no build step) plus an optional API on Cloudflare Workers.

## What works, and how

There are two scanners. The site picks the best one available.

| | Quick scan | Deep scan |
|---|---|---|
| Runs | In the visitor's browser | On the FitSource API (`worker/`) |
| Needs | Nothing | An Anthropic API key and a deployed worker |
| Finds | Each piece (jacket, jeans, sneakers...), its colour, where it is in the photo, and text printed on it (a brand or collection name) | The exact product and brand when the photo shows it, the original shop, other shops, resale listings and lookalikes |
| Stock | No (it doesn't know the exact product) | Yes: Claude reads the product pages, then the worker re-checks each shop itself (Shopify product data, schema.org markup) and trusts the shop over the model |
| Shopping | Search links per piece (the search words can be edited, and start with the brand and print when one was read): new at Google Shopping Israel, Terminal X, Castro, Next, ASOS, AliExpress; second-hand at Facebook Marketplace, Yad2, eBay, Depop | Direct product links with price, stock and sizes, Israeli shops first, plus the search links |
| Cost | Free | Roughly $0.15 to $0.40 per scan (see BUSINESS.md) |

The quick scan uses MobileCLIP (Apple, via Transformers.js): the photo is looked at through 29 overlapping windows, each compared with precomputed descriptions of 56 garment types; the colour comes from the pixels, with the background and skin filtered out. The model (23 MB) downloads once from Hugging Face and is cached. Photos are not uploaded.

The quick scan also reads text printed on the clothes (`scan/ocr.js`): PaddleOCR (PP-OCRv3 text detection and PP-OCRv5 English recognition, about 10 MB, from Hugging Face at a pinned revision, cached) runs on the body column of the photo at up to 1568 px, keeps the largest confident lettering (and a tagline set right under it), and recognises brand names from a short list (`BRANDS`), allowing for a misread letter or a word cut short ("EBRHARTT" is Carhartt, "STUSS" is Stüssy). The words go to the garment they are printed on and to the front of its search words, so a "NUDE MANSION" tee searches for "Nude Project NUDE MANSION"; Google gets them in English. Curved lettering (text around a circle) is not read. Try it with `node tools/eval-ocr.mjs photo.jpg`. The detector works in English; each piece is shown in Hebrew (`HE` in `vocab.js`), with the colour agreeing with the garment's gender and number (`colorHe` in `color.js`: "חולצה שחורה", "מכנסיים שחורים").

The deep scan sends the photo to Claude (`claude-opus-5-5` by default) with web search, web fetch and a structured `submit_results` tool, streams progress to the page, then verifies stock at each shop. It is told to report the original source, then favour shops that sell in Israel or ship there, to search in Hebrew and English, and to answer in Hebrew (brand, product and shop names stay as the store writes them).

Shop links search in Hebrew at Israeli shops and in English at shops with English catalogues (`en: true` in `shop.js`), so every piece carries both a Hebrew `query` and an English `queryEn`. Yad2 Market has no public search link, so its button opens the clothing section. Vinted is left out because it doesn't operate in Israel.

Features the other outfit finders don't have (shown on the home page as "רק ב־FitSource"):

- **WhatsApp:** send a fit or your scan results with every shop link, ask friends "לקנות או לא?", or send your saved pieces as a wish list (`assets/js/whatsapp.js`, wa.me links).
- **"יש לי כבר":** mark pieces you already own; the total shows only what's left to buy (stored in this browser).
- **Price-drop and size alerts:** the bell works on any piece with a shop page. Each check compares price and per-size stock (`compareStock` in `watch.js`), so you hear when the price drops, or when your size (picked in the closet) is back, not just "back in stock". Checked on each visit and with "בדיקה עכשיו", through the API's `/api/stock`.

Also: shoppable feed with vibe filters, dots on every photo, draw a box to look up one piece, saved closet, scan history, a shareable "fit receipt" image, light and dark themes, drag-and-drop and paste.

**The feed is sample content.** Its people and brands are invented and the photos are AI-generated (Higgsfield), except "Created By God", which is the real Dream Studios photo linking to the store in this repo. Replace it with real creator posts in `assets/js/data/fits.js`.

**Hebrew and right to left.** `index.html` sets `lang="he" dir="rtl"`. The CSS uses logical properties (`margin-inline-start`, `inset-inline-end`...), so the layout mirrors itself; dots on photos stay where the garment is. Arrows are flipped in `icon()`. Product and brand names sit in `<bdi>` so a Latin name like "1951 Raw Selvedge" keeps its order. Archivo and Geist Mono have no Hebrew letters, so Hebrew falls through to Heebo (self-hosted, Hebrew subset only). Money, dates and "5 hours ago" use `he-IL` formatting.

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

- **GitHub Pages:** in the repository settings, Pages, deploy from the branch that holds this folder. The site is then at `https://<user>.github.io/<repo>/fitsource/`, which is the default `siteUrl`.
- **Cloudflare Pages / Netlify (recommended with your own domain):** point it at this repository with no build command and `fitsource` as the output folder, so FitSource is the site's root. (The "Created By God" fit links to `../product.html`, the Dream Studios store next to it; if you deploy FitSource alone, change those two links in `fits.js`.)

### 2. Your own domain

1. Buy a domain (for example a `.co.il` from an Israeli registrar, or any domain from Cloudflare).
2. Connect it: in Cloudflare Pages, the project's Custom domains tab; on GitHub Pages, Settings, Pages, Custom domain (it adds a `CNAME` file at the repository root and serves the whole repository there, so FitSource would be at `https://your-domain/fitsource/`).
3. Set `siteUrl` in `assets/js/config.js` to the new address, ending in `/` (for example `https://fitsource.co.il/`).
4. Run `node tools/build-pages.mjs`, commit the changed files and deploy.
5. Add the site to Google Search Console and submit `sitemap.xml`.

`robots.txt`, `llms.txt` and `404.html` only take effect at the root of a domain, so they work once FitSource is the root of your domain (step 2 with Cloudflare Pages or Netlify). On a GitHub Pages project address, submit the sitemap in Search Console instead.

### Pages, search and link previews

Each page is a real file next to `index.html` (`feed.html`, `fit-night-shift.html`, `brands.html`, `legal.html`...), served at a clean address (`/feed`, `/fit-night-shift`). Each has its own title, description, canonical link, share image (`assets/img/og/`), structured data (the business as an `OnlineBusiness` serving Israel, the site, and breadcrumbs) and the page's content already in the HTML, so search engines and WhatsApp or Instagram previews see it without running the app. The app then takes over and moves between pages without reloading.

`tools/build-pages.mjs` writes all of it, plus `404.html`, `sitemap.xml`, `robots.txt`, `llms.txt` and `favicon.ico`, by rendering each page with the app in a headless browser. Run it after changing pages, the feed or `siteUrl`; `npm test` fails while the files are out of date. Closet and scan pages are personal, so they are marked `noindex` and left out of the sitemap.

There is no `LocalBusiness` schema: FitSource has no shop or address. `OnlineBusiness` is the schema.org type for a business that only exists online.

### 3. Deep scan (optional, recommended)

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

### 4. Make money

In `assets/js/config.js`:

- `affiliate.deeplinks`: per-shop deep-link templates, keyed by domain, for example AliExpress through Admitad or ASOS through Awin. `{url}` is replaced with the encoded shop link. These are checked first.
- `affiliate.skimlinksId` or `affiliate.sovrnKey`: wraps every other outbound shop link. Note that Skimlinks only pays on traffic from North America, Europe and APAC, not Israel.
- `affiliate.amazonTag`: your Amazon Associates tag, added to Amazon links.
- `contactEmail`: shows a "Partner with us" button on the For brands page, and is the contact in the accessibility statement. Israeli regulations require a real contact there before launch.

The Israeli chains have no public affiliate programmes on the networks; BUSINESS.md describes the direct deals to make instead.

## Tests

```sh
cd fitsource
npm test                       # unit tests: detector, colours, links, page files up to date, worker, stock parser
node test/smoke.mjs            # every page, desktop and phone, light and dark: no errors, no overflow, one <h1>, unique titles, canonical links, 404s
node test/e2e.mjs              # quick scan with the real model, deep scan against a fake Claude, feed and fit pages
```

The browser tests use the Chromium that Playwright finds, serve the CDN files from `node_modules`, and download the model from Hugging Face on first run. The deep-scan test runs the real worker code against a local fake of the Claude API and fake shops, so it needs no key.

## Layout

- `index.html`, `assets/css/app.css`: the page shell and all styles (tokens at the top, light and dark). The other `.html` files, `404.html`, `sitemap.xml`, `robots.txt`, `llms.txt`, `favicon.ico` and `assets/img/og/` are generated by `tools/build-pages.mjs`.
- `assets/js/app.js`: page switching, theme, drag and drop, paste, restock checks. `views/`: one file per page.
- `assets/js/router.js`: page addresses (`fit/<id>` is `fit-<id>.html`). `assets/js/seo.js`: each page's title, description, share image and breadcrumbs.
- `assets/js/components.js`: shoppable photo, swing tags, feed cards, shop links.
- `assets/js/scan/`: `engine.js` picks the scanner; `remote.js` talks to the API; `ondevice.js` + `ondevice.worker.js` run the model; `detect.js`, `color.js`, `vocab.js` are the detector logic; `embeddings.json` is generated.
- `assets/js/data/fits.js`: the feed.
- `assets/js/store.js`: closet, scans and preferences (browser storage).
- `assets/js/share.js`: the fit receipt.
- `worker/`: the API. `src/scan.js` (Claude), `src/stock.js` (stock checker), `src/prompt.js` (instructions and result schema), `src/index.js` (routes, cache, limits, CORS).
- `tools/`: `serve.mjs` (local preview, with the same clean addresses and 404 page as the hosts), `build-pages.mjs` (static pages, sitemap and share images), `build-embeddings.mjs` (after editing `vocab.js`), `build-icons.mjs` (after adding an icon), `eval-ondevice.mjs` (try the detector on photos from the command line), `eval-ocr.mjs` (read the text on clothes in a photo).

## Credits

MobileCLIP by Apple (Apple sample code licence). PaddleOCR models by PaddlePaddle (Apache 2.0), ONNX Runtime by Microsoft (MIT). Transformers.js by Hugging Face. Claude by Anthropic. Archivo, Geist Mono and Heebo fonts (SIL OFL, self-hosted). Phosphor Icons (MIT).
