# היכרות בקליק

A social network for the moment you meet someone new from the army. You build your profile once (where you're from, age, mechina or service year, unit down to the team, tironut, roles and courses). When you meet someone, they scan your code and see your whole path, the people you both know and what you have in common. Hebrew, RTL, installable on the home screen (PWA). Static site, no build step.

Live: https://hekerut.moffy-app.workers.dev (its own address; the old GitHub Pages link forwards there with the login).

```
npx http-server -p 8795 -c-1 .     # from the repo root, then open http://localhost:8795/hekerut/
```

## What it does

- **Onboarding (5 short steps):** photo, name, how to address you (he/she/either), age, city · mechina or service year · status, draft and release month, corps, then the unit levels. The labels follow the corps: artillery asks for a סוללה, infantry for a פלוגה, the air force for a טייסת. Each level opens after the one above it, and all of them are optional · tironut, roles and courses with years · one line about you, and who sees the full path.
- **Home:** friends as round "stories", a "met someone new?" card, people you may know (friends of friends, same unit, mechina, tironut or city, with the reason), your own card, recent activity.
- **פז״ם and days left:** the draft date (day, month, year) and the service track: בן, 2 years 8 months · בת, 2 years · בת לוחמת (דין אישה כדין גבר), 2 years 8 months. The track defaults from the form of address. For people in regular service the profile, the home card and the path story show days served, days left, a progress bar and the expected release date, all computed on the phone each day. Before the draft it counts down to it.
- **Code (center button):** your QR code and a share link, or the camera scanner. Scanning opens a "nice to meet you" screen: how many people you both know, who they are, what you share ("same battery!", "same mechina", "same draft") and one tap to connect.
- **Profiles:** friends / followers / following counts, follow, mutual connections, "what you have in common", and the path as a timeline. The **story** button plays the path as full-screen slides (Instagram-style: tap for next, hold to pause).
- **Making a post or a story** (`js/create.js`, Instagram-style, full screen): the + opens the story camera (shutter, gallery, flip), with tabs for פוסט and סטורי at the bottom. Stories: after the shot, text you drag around, recolor, resize, set on a box, or drag onto the trash; the photo itself can be dragged to frame it; "Aa" makes a text story on a color. What you see is burned into one image. Posts: pick a photo and frame it (1:1, 4:5 or its own shape) by dragging, pick one of nine filters (`js/imagefx.js`: the preview is CSS, the saved photo applies the same color matrices), write a caption, share.
- **Watching stories:** tap for the next one, hold to pause, swipe sideways to the next person, swipe down to close, a heart on other people's stories (the author gets it in activity and sees the count), viewers and delete on your own.
- **Posts:** a photo (cropped between 4:5 and 1.91:1, compressed on the phone) with a caption. A feed of posts from people you follow on the home screen, double-tap or the heart to like, and a grid on every profile (next to the path tab). Your own posts can be deleted.
- **Stories:** a photo (9:16) or a line of text on a background, gone after 24 hours. They show as rings at the top of the home screen (gold until seen; friends without a story keep a quiet ring that plays their path). Tap for the next one, hold to pause. On your own stories you see who viewed them and can delete them.
- Posts and stories are seen by the same people who see the full path: people you follow and people who met you (or everyone, with the public setting).
- **Friends and followers:** following is one-way. When both follow each other, they're friends. You can remove a follower.
- **Activity:** who scanned your code, who followed you, who followed back, who liked a post, and when a friend starts a new role.
- **Settings:** light/dark/auto, who sees the full path, a new code (the old one stops opening the full path), moving to another phone (a personal login QR), delete the account.

### Privacy

- Never asks for a personal number. The service step reminds people not to enter classified unit names or locations.
- By default the full path (battalion and below, tironut, dates, roles) is visible only to people who scanned your code or whom you follow. Everyone else sees name, age, city, corps, brigade, mechina and current role. One setting makes everything public.

## Server (`server/`)

A Cloudflare Worker with one Durable Object (SQLite) holding profiles, follows, activity, posts, likes, stories and their images, so mutual connections are a quick lookup. The rules (who sees what, what counts as mutual, what two people have in common, suggestions) are in `js/core.js`, shared between the server and the app's demo mode.

- Login: on sign-up the server returns an id and a random secret token, kept on the phone. Sign-ups are limited to 10 an hour per address.
- Deploy: `.github/workflows/hekerut-api.yml` runs on every push to `hekerut/` on the app's own branch, `claude/military-social-app-zbkrwn`, with no merge needed. It tests and deploys the server, then deploys the app's static files as the `hekerut` worker (`site/wrangler.toml`). It needs the `CLOUDFLARE_API_TOKEN` secret, already used by Remind. and Shomer. `js/config.js` holds both addresses.
- Images arrive as JPEG data URLs of at most 400 KB, are served from `/m/<id>`, and are deleted with their post or story. Expired stories are cleared whenever someone posts a new one. Limits: 20 posts an hour, 30 stories a day.
- Tests: `cd hekerut/server && npm test` (both stores, visibility, follows, friends, mutuals, common ground, suggestions, posts, likes, stories, routes).

**Demo mode:** while `js/config.js` has no server address, the whole network runs in the browser with ten made-up people (two of them with a text story), and they follow back after a moment. The scanner has a "try with a sample profile" button. In demo mode a code only works on the phone that made it.

Bump `VERSION` in `sw.js` whenever a file changes, and `APP_VERSION` in `js/app.js` (shown in settings).

Fonts: Heebo and Plus Jakarta Sans, self-hosted (SIL OFL). QR: qrcode-generator (MIT) and jsQR (Apache 2.0) in `vendor/`.
