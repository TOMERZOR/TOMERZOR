# What are the odds? · מה הסיכוי?

A free site: finish the sentence "מה הסיכוי..." / "What are the odds..." and get the real odds, with an explanation and where the number comes from. Hebrew first, with an English toggle.

Live (after the deploy workflow runs): https://what-are-the-odds.moffy-app.workers.dev

## How a question is answered

1. **Checked facts** (`public/js/core/data.js`): 72 questions with real statistics or exact math, each with its source. The page matches them in the browser, so they answer instantly and work offline. Examples: being born a boy (51%), being born without ears (about 1 in 7,500), the sun exploding tomorrow (0%), winning the Israeli Lotto (1 in 16,273,488).
2. **AI estimate**: any other question goes to the Worker, which asks Workers AI (Llama 3.3 70B, falling back to Llama 3.1 8B) for a probability, a short explanation, what it's based on and how confident it is. These are labelled "הערכת AI" so nobody mistakes them for a statistic.
3. **Can't be known** ("that she likes me back"): no number, an explanation of what it depends on.
4. **Self-harm questions** never get a number. They get a short caring message and ERAN 1201 (and 988 / findahelpline.com in English).

The result card shows the number (percent, or "1 in N" with million/billion words, or ×10ⁿ for absurdly small odds), an odds meter on a log scale with familiar landmarks (coin, die, clover, lightning, Lotto), a comparison ("less likely than a four-leaf clover, more likely than a royal flush"), the explanation and the source. Every answer has a shareable link (`?q=...`).

## Cost

Free on Cloudflare's free plan: Workers (100,000 requests a day) and Workers AI (10,000 "neurons" a day, a few hundred AI answers). Checked facts never touch the AI. The Worker caches AI answers per question, the browser keeps them for a week, and each visitor can ask the AI at most 10 times a minute and 120 a day. When the allowance runs out the page says so and suggests checked questions.

## Run it

```
cd what-are-the-odds
npm test            # matcher, numbers and the API (with a fake AI)
npm start           # wrangler dev: the site and the API on http://localhost:8787 (AI needs a Cloudflare login)
```

The page alone also runs from any static server (`npx http-server public`); without the API it answers checked facts only.

## Deploy

`.github/workflows/what-are-the-odds.yml` runs the tests and deploys `wrangler.toml` (the site in `public/` as static assets, the API in `worker/worker.js`, the `AI` binding) on every push to its branch, using the repository secret `CLOUDFLARE_API_TOKEN`. It then checks `/api/health`, a checked question and an AI question.

## Adding questions

Add an entry to `FACTS` in `public/js/core/data.js`: the probability `p`, keyword groups `k` (every group must match; `stem*` matches word beginnings; Hebrew prefixes ו ה ש ב ל מ כ are stripped automatically), optional words `o`, the question and explanation in Hebrew and English, and the source. `npm test` checks that every question finds its own answer in both languages.

## Files

- `public/index.html`, `public/css/style.css`, `public/js/app.js`: the page
- `public/js/core/`: shared by the page and the Worker: `data.js` (facts), `match.js` (Hebrew-aware matching, self-harm check), `format.js` (numbers, comparisons)
- `public/js/config.js`: the API address used when the page is served from somewhere else (GitHub Pages)
- `worker/worker.js`: `/api/health` and `/api/odds`
- `test/`: `node --test`
