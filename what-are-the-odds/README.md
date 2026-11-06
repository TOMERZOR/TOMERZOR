# What are the odds? · מה הסיכוי?

A free site with two modes. Hebrew first, with an English toggle.

- **Just curious (סתם סקרן):** finish the sentence "מה הסיכוי..." / "What are the odds..." and get the real odds, with an explanation and where the number comes from. A dice button types one of 200 random questions for people with no idea what to ask.
- **Game (משחק), "Higher or lower?":** a card shows a question and a number; guess whether the real odds are higher or lower. Solo (a streak, 3 misses and you're out), two players on one phone, or two phones in a room joined by link or 4-letter code. Turns alternate, and like Hitster's tokens the other player may challenge twice a game: if the guess is wrong, the point goes to them. First to 5 wins.

Live (after the deploy workflow runs): https://what-are-the-odds.moffy-app.workers.dev

## How a question is answered

1. **Checked facts** (`public/js/core/data.js`): 97 questions with real statistics or exact math, each with its source. The page matches them in the browser, so they answer instantly and work offline. Examples: being born a boy (51%), being born without ears (about 1 in 7,500), the sun exploding tomorrow (0%), winning the Israeli Lotto (1 in 16,273,488). The game only deals these.
2. **AI estimate**: any other question goes to the Worker, which asks Workers AI (Llama 3.3 70B, falling back to Llama 3.1 8B) for a probability, a short explanation, what it's based on and how confident it is. These are labelled "הערכת AI" so nobody mistakes them for a statistic.
3. **Can't be known** ("that she texts me back"): no number, an explanation of what it depends on.
4. **Self-harm questions** never get a number. They get a short caring message and ERAN 1201 (and 988 / findahelpline.com in English).

## Feel

- While it works it says "מחשב סיכויים" with a shimmer and bouncing dots (at least 0.9 s, so checked facts get the same moment of suspense).
- The number then rolls through discrete steps that come further and further apart (an ease-out in time), each with a synthesized tick that climbs in pitch, until the exact number lands with a small pop and a chime. Phones also get a haptic tick per step (Android vibration; on iPhone, Safari 18+'s switch haptic).
- Sounds are made live with Web Audio (`public/js/sound.js`), with a mute button. `prefers-reduced-motion` skips the roll and the shimmer.
- Type: Assistant for Hebrew and the system font for English and numbers (SF Pro on iPhone and Mac). Light and dark follow the device.

## Cost

Free on Cloudflare's free plan: Workers (100,000 requests a day), SQLite-backed Durable Objects for game rooms, and Workers AI (10,000 "neurons" a day, a few hundred AI answers). Checked facts never touch the AI. The Worker caches AI answers per question, the browser keeps them for a week, and each visitor can ask the AI at most 10 times a minute and 120 a day. When the allowance runs out the page says so and suggests checked questions.

## Run it

```
cd what-are-the-odds
npm test            # matcher, numbers and the API (with a fake AI)
npm start           # wrangler dev: site, API and game rooms on http://localhost:8787 (the AI binding needs a Cloudflare login)
```

The page alone also runs from any static server (`npx http-server public`); without the API it answers checked facts only, and solo and one-phone games still work.

## Deploy

`.github/workflows/what-are-the-odds.yml` runs the tests and deploys `wrangler.toml` (the site in `public/` as static assets, the API in `worker/worker.js`, the `AI` binding, the `ROOMS` Durable Object) on every push to its branch, using the repository secret `CLOUDFLARE_API_TOKEN`. It then checks `/api/health`, a checked question and an AI question.

## Adding questions

Add an entry to `FACTS` in `public/js/core/data.js`: the probability `p`, keyword groups `k` (every group must match; `stem*` matches word beginnings; Hebrew prefixes ו ה ש ב ל מ כ are stripped automatically), optional words `o`, the question and explanation in Hebrew and English, and the source. `npm test` checks that every question finds its own answer in both languages.

## Files

- `public/index.html`, `public/css/style.css`, `public/js/app.js`: the page and the "just curious" mode
- `public/js/game-ui.js`: the game screens; `roll.js`: the rolling number; `sound.js`: sounds and haptics; `i18n.js`: all interface text; `icons.js`: Phosphor icons (MIT)
- `public/js/core/`: shared by the page and the Worker: `data.js` (facts), `questions.js` (the 200 random questions), `match.js` (Hebrew-aware matching, self-harm check), `format.js` (numbers, comparisons), `game.js` (thresholds and the two-player rules)
- `public/js/config.js`: the API address used when the page is served from somewhere else (GitHub Pages)
- `worker/worker.js`: `/api/health`, `/api/odds`, and the game rooms: `POST /api/room` makes a code, `/api/room/CODE/ws` is a WebSocket into a Durable Object (`GameRoom`) that runs the same `Match` rules for both phones, keeps seats across reloads and gives the challenger 9 seconds
- `test/`: `node --test`
