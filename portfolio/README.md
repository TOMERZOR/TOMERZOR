# Tomer Zoref portfolio

Hebrew (RTL) photography and video portfolio. Static HTML, CSS and vanilla JS with no build step, like the rest of this repo.

- `index.html`: the whole page (hero, filterable photo gallery, video, about, contact)
- `assets/css/style.css`: design tokens at the top (colors for light and dark, spacing, type)
- `assets/js/app.js`: header state, hero slideshow, masonry gallery and filters, lightbox, video previews and player
- `assets/img/`: photos as WebP at 480, 960 and 1600px wide (plus 2400px for the desktop hero)
- `assets/video/`: each video as a 720p MP4, a 5-second muted preview loop (`-preview.mp4`) and a poster (`.webp`)
- `assets/fonts/`: Noto Sans Hebrew (variable weight and width), self-hosted under the SIL Open Font License

Preview locally: `npx http-server portfolio` (or `python3 -m http.server` inside this folder) and open the printed address.

## Editing

**Add a photo.** Export three WebP files named `<category>-<nn>-480.webp`, `-960.webp` and `-1600.webp` into `assets/img/`, then copy any `<figure class="tile">` block in `index.html` and update its `data-cat` (`sport`, `party`, `event`, `portrait` or `street`), `data-w`/`data-h` (original pixel size), file names and `alt` text. Update the count in the matching filter chip.

**Add a video.** Put `<slug>.mp4`, `<slug>-preview.mp4` and `<slug>.webp` in `assets/video/` and copy a `<figure class="vcard">` block. Vertical reels go in `.reels` with the `vtile--v` class, horizontal videos in `.vgrid`.

**Contact.** The contact section links to Instagram (@tomerphotos_). A commented-out block right under that link adds WhatsApp and email buttons; fill in the number and address and remove the comment markers.

## Launch checklist

- Host the `portfolio/` folder on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages). Every path is relative, so it works from a subfolder or its own domain.
- Once the final address is known, change `og:image` in `index.html` to the full URL (for example `https://example.com/assets/img/og.jpg`) so WhatsApp and Instagram show the preview image.
- Videos total about 170MB. The largest file is 44MB, under GitHub's 50MB warning.
