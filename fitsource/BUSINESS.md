# FitSource business model

FitSource is free for shoppers. It makes money when the people it sends to shops buy something, and from brands that want to see and meet that demand. Every number below is an assumption to test, not a measurement.

## Who pays

| Stream | Who pays | How | When it starts |
|---|---|---|---|
| Affiliate commission | Shops | 4 to 12% of each order placed through a FitSource link, via Skimlinks or Sovrn (one tag covers thousands of stores), plus direct programmes (Amazon, ASOS, SSENSE, Farfetch, Depop) | Day one: set `affiliate` in `assets/js/config.js` |
| FitSource Pro | Shoppers who want more | $4.99 a month: unlimited deep scans, instant restock and price-drop alerts by push and email, size-specific alerts, price history | Once deep scan has steady use |
| Brand plans | Brands | Claim products (free), Growth at about $199 a month: verified-source badge, demand dashboard, sold-out demand signals, creator matches | After about 50k monthly scans |
| Sponsored lookalikes | Brands | Cost per click (about $0.30 to $1.00) to appear as a labelled in-stock alternative when a piece sells out | With brand plans |
| Trend data | Retailers, buyers, investors | Monthly reports and an API: what is being scanned, what sells out, which styles are rising | Year two |

Creators get a share (30 to 50%) of the commission their posted fits earn. That is what keeps the feed full of real fits, the way LTK and ShopMy do it.

## What a scan costs

- **Quick scan:** runs on the shopper's device. Costs nothing per scan beyond static hosting (free on GitHub Pages or Cloudflare Pages).
- **Deep scan:** Claude reads the photo, searches the web and reads product pages. With Claude Opus 5.5 ($4 per million input tokens, $20 per million output) plus web search, expect roughly $0.15 to $0.40 a scan depending on how many searches it runs. Measure it on your own traffic (the worker logs usage) before setting limits. Ways to cut it:
  - The worker caches results for 24 hours by image fingerprint, so a viral photo scanned 1,000 times is paid for once.
  - `DAILY_SCAN_LIMIT` caps free deep scans per visitor (default 8).
  - `MAX_SEARCHES` and `MAX_FETCHES` cap the work per scan.
  - `FITSOURCE_MODEL` can be switched to `claude-sonnet-5-5` ($2 / $10), at some cost in accuracy. Test on a sample of real photos first.
  - Feed fits are sourced once and served free to everyone after that.

## Rough unit economics (assumptions)

- Average fashion order: $90. Blended commission: 7%. That is $6.30 per order.
- Shop click to purchase: 3%. Clicks per scan or feed view of a fit: 1.5.
- Revenue per scan: 1.5 x 3% x $6.30 = about $0.28.
- So a deep scan roughly breaks even on commission alone; quick scans and the feed are almost pure margin. That is why the free tier leads with quick scans and the feed, why deep scans are limited and cached, and why Pro exists.
- At 1M monthly scans (80% quick, 20% deep): about $280k a month in commission against about $60k in deep-scan cost, before Pro and brand revenue.

## Growth

1. **The fit receipt.** Every scan can be shared as a story-sized receipt with every piece, price and "sold out" stamp, plus the FitSource address. Each share is an ad.
2. **"Where to buy" pages.** Each sourced product can become a public page ("Where to buy the Halden cropped leather bomber"). People search exactly this; it is the main organic channel.
3. **Creators.** Invite fashion creators to post fits with sourced pieces and earn from them. They bring their audience.
4. **Sold-out moments.** Restock alerts bring people back at the moment they are most likely to buy.
5. **Short video.** "I found the jacket from that video" content on TikTok and Reels, made from real scans.

## Features to build next

- Share-sheet target (PWA share target on Android, iOS shortcut): share a screenshot straight from TikTok or Instagram to FitSource.
- Paste a TikTok, Instagram or Pinterest link; the worker fetches the image.
- Browser extension: right-click any image, "Find this fit".
- Push and email restock alerts (needs accounts and a scheduled worker; Cloudflare Cron Triggers plus an email API).
- Price history and price-drop alerts on saved pieces.
- Size-aware alerts ("tell me when the M is back").
- "Complete the look": pieces that go with something you saved.
- Hebrew and other languages.

## Before launch (not legal advice)

- **Affiliate disclosure:** keep the disclosure in the footer and on the Privacy and disclosure page; it is required by the FTC (US), the ASA (UK) and Israeli consumer law for paid links.
- **Photo rights:** feed photos must be owned or licensed by FitSource or posted by their owners. Uploaded scans are not stored.
- **Privacy:** the privacy page describes what is sent where. Update it if you add analytics, accounts or email.
- **Trademarks:** show brand names as facts ("sold by"), never imply a brand endorses FitSource unless it has a brand plan.
