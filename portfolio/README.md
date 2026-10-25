# Tomer Zoref portfolio

Hebrew (RTL) photography and video portfolio built around a camera: the page opens with an iris, the hero is a viewfinder that fires a burst of frames as you scroll, the gallery is filtered with a mode dial, and photos open in a playback screen. Static HTML, CSS and vanilla JS with no build step, like the rest of this repo.

- `index.html`: the whole page (viewfinder hero, gallery with mode dial, video, about, contact, playback and video dialogs)
- `assets/css/style.css`: design tokens at the top (dark palette, accent and focus colors, spacing, type)
- `assets/js/app.js`: iris, viewfinder burst, focus cursor, mode dial and gallery, playback, video previews and player, WhatsApp messages, optional shutter sound
- `assets/img/`: photos as WebP at 480, 960 and 1600px wide (plus 2400px for the desktop hero)
- `assets/video/`: each video as a 720p MP4, a 5-second muted preview loop (`-preview.mp4`) and a poster (`.webp`)
- `assets/fonts/`: Noto Sans Hebrew (variable weight and width) and Geist Mono, self-hosted under the SIL Open Font License

Preview locally: `npx http-server portfolio` (or `python3 -m http.server` inside this folder) and open the printed address.

Everything works without JavaScript (the first hero frame, the full gallery and the contact links stay usable), and visitors who ask for reduced motion get no iris, burst or focus cursor.

## Editing

**Add a photo.** Export three WebP files named `<category>-<nn>-480.webp`, `-960.webp` and `-1600.webp` into `assets/img/`, then copy any `<figure class="tile">` block in `index.html` and update its `data-cat` (`sport`, `party`, `event`, `portrait` or `street`), `data-w`/`data-h` (original pixel size), `data-full`, file names and `alt` text. The dial counts the photos itself; only the starting text of `.dial__count` ("59 תמונות") needs the new total.

**Change the hero burst.** Each `<figure class="vf__frame">` is one frame, with a landscape image for desktop and a portrait one for phones. Keep `--frames` on the `.vf` section equal to the number of frames, since it sets how long the burst stays pinned.

**Add a video.** Put `<slug>.mp4`, `<slug>-preview.mp4` and `<slug>.webp` in `assets/video/` and copy a `<figure class="vcard">` block. Vertical reels go in `.reels`, horizontal videos in `.vgrid`.

**Contact.** WhatsApp messages are set at the WhatsApp section of `app.js`: `PHONE` (international format, no plus sign), the opening sentence in `base` and one ending per subject chip in `subjects`. If the number changes, also update the `tel:` link, the two `wa.me` links and `telephone` in the JSON-LD block of `index.html`, which are what visitors without JavaScript get. Email and Instagram are plain links in the contact section and in the JSON-LD `sameAs` list.

## Launch checklist

- Host the `portfolio/` folder on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages). Every path is relative, so it works from a subfolder or its own domain.
- Once the final address is known, change `og:image` in `index.html` to the full URL (for example `https://example.com/assets/img/og.jpg`) so WhatsApp and Instagram show the preview image.
- Videos total about 170MB. The largest file is 44MB, under GitHub's 50MB warning.
