# Print ad

- `ad.pdf`: the ad for print, 165 x 250 mm, fonts embedded. `ad.png`: the same at about 380 dpi.
- `newspaper-mockup.png`: a placement mock-up on a daily's page. It is for showing the idea only; the page around the ad is placeholder blocks.
- `ad.html` / `newspaper.html`: the sources. Edit, then re-render with Chromium (print to PDF at 165 x 250 mm, background graphics on).
- `qr-go.svg`: the QR code. It points to `https://my-old-friend.moffy-app.workers.dev/go` on our own server. Until the app is live it shows a short page about Moffy; once it is, set `APP_STORE_URL` in `server/wrangler.toml` and redeploy, and every printed code sends people straight to the App Store.

Before sending to the paper: ask their ad department for the exact size, bleed and colour profile (newsprint is usually CMYK); the layout scales, and the PDF can be converted to their profile.
