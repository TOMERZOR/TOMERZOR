# FitSource business model (Israel)

FitSource is a Hebrew, right-to-left site for Israeli shoppers. It is free to use. It makes money when the people it sends to shops buy something, and from brands that want to see and meet that demand. Every number below is an assumption to test, not a measurement. Prices are in shekels (₪), at roughly ₪3.7 to the dollar.

## Why Israel

Apps that source outfits from screenshots already exist abroad, but none is built for Israel. Here, people find fits on Instagram and TikTok, then buy from local chains (Terminal X, Castro, Fox, Factory 54, Next) or order from abroad (AliExpress, Shein, ASOS). FitSource covers both: it searches in Hebrew at Israeli shops and in English at the international ones, and its deep scan prefers stores that sell in Israel or ship there.

## How it differs from the others

StyleLens AI, Google Lens, Outfit Lens and FashionLens AI find similar clothes from a photo. Going by their listings, StyleLens AI is credit-based ($4.99 to $39.99 a month, one or two free scans) and also does beauty and colour analysis, and none of them is in Hebrew or built around Israeli shops. FitSource is free with no account, and adds what they don't have:

- Hebrew, shekels, and Israeli shops first (Terminal X, Castro, Next, Yad2, Marketplace), then shops that ship to Israel.
- Stock checked at the shop, with alerts when a price drops or when your size comes back.
- "יש לי כבר": the total counts only what you still need to buy.
- WhatsApp built in: send a fit or a scan, ask friends whether to buy, send a wish list.

## Who pays

| Stream | Who pays | How | When it starts |
|---|---|---|---|
| Affiliate commission (international) | AliExpress, Shein, ASOS | Commission on orders through FitSource links: AliExpress through AliExpress Portals or Admitad, ASOS through Rakuten or Awin, Shein through Awin, Admitad or its own programme. Set per-shop deep links in `affiliate.deeplinks` in `assets/js/config.js`. | Day one, once you are approved |
| Direct referral deals | Israeli chains and local brands | None of the Israeli chains we checked runs a public affiliate programme on a network, so make direct deals: a CPA (about 5 to 10% of the order) tracked with UTM links and a FitSource coupon code, the way Israeli influencers are paid. Terminal X's "Ambassador" programme pays 7% in site credit only, so it is not a revenue source. | From the first few thousand monthly scans |
| Brand plans | Israeli DTC and Instagram brands | Free to claim products. Growth plan at about ₪490 a month: verified-source badge, demand dashboard, sold-out demand ("230 people wanted the M this week"), creator matches | After about 20k monthly scans |
| Sponsored lookalikes | Brands | About ₪1 to ₪3 per click to appear as a labelled in-stock alternative when a piece sells out | With brand plans |
| FitSource Pro | Shoppers who want more | ₪14.90 a month: unlimited deep scans, restock and price-drop alerts by push, WhatsApp or email, size-specific alerts | Once deep scan has steady use |

Creators get a share (30 to 50%) of what their posted fits earn. That keeps the feed full of real Israeli fits.

**Networks that won't pay here.** Skimlinks says it monetises traffic only from North America, Europe and APAC, so it will probably not pay on Israeli visitors (https://skimlinks.com/program-policies/). Ask Sovrn, CJ and Rakuten about Israeli traffic before relying on them. The `skimlinksId` and `sovrnKey` settings remain for traffic from abroad.

## What a scan costs

- **Quick scan:** runs on the shopper's device. It costs nothing per scan beyond static hosting (free on GitHub Pages or Cloudflare Pages).
- **Deep scan:** Claude reads the photo, searches the web in Hebrew and English, and reads product pages. With Claude Sonnet 5.5 ($2 per million input tokens, $10 per million output) plus web search ($10 per 1,000 searches), expect roughly $0.10 to $0.30 a scan (₪0.40 to ₪1.10), depending on how many searches it runs. This is an estimate; measure it on your own traffic before setting limits (the worker logs usage). Ways to cut the cost:
  - Results are cached for 24 hours by image fingerprint, so a viral photo is paid for once.
  - `DAILY_SCAN_LIMIT` caps free deep scans per visitor (default 8).
  - `MAX_SEARCHES` and `MAX_FETCHES` cap the work per scan.
  - `FITSOURCE_MODEL` picks the model (see below).

### Which model

Five real outfit photos (a Nude Project tee, Timberland boots twice, a Carhartt WIP sweater with Birkenstock Boston clogs, a Scuffers "withlove" hoodie at night, a Stüssy Burly Threads tee with a Polo Ralph Lauren cap) were given to each model to identify, from the photo alone, without web search. Out of 9 brand and model identifications:

| Model | Price per million tokens (in / out) | Identified | Missed |
|---|---|---|---|
| Claude Haiku 5.5 | $0.10 / $0.50 | 4, plus 3 where it read the print but named no brand | Polo cap, Timberland in the dark |
| **Claude Sonnet 5.5** (default) | $2 / $10 | 7, plus "Nude Mansion" for Nude Project | Scuffers |
| Claude Opus 5.5 | $4 / $20 | 8 | Scuffers |
| Claude Fable 5.1 | $10 / $50 | 8 | Scuffers |

No model knew the Scuffers hoodie from its "withlove" print; the web search in a real scan is what finds that. Sonnet 5.5 identifies almost as well as Opus 5.5 at half the price, so it is the default. Haiku 5.5 costs a fraction (searches, at $0.01 each, become most of its bill) but needs the search to make up for what it doesn't recognise; try it with `FITSOURCE_MODEL = "claude-haiku-5-5"` (the worker then uses the basic web search and fetch tools, which Haiku supports) and compare on your own photos. Five photos is a small sample; re-run the comparison on real traffic before relying on it.

## Rough unit economics (assumptions)

- Average fashion order: ₪300. Blended commission: 6%, which is ₪18 per order.
- Clicks from a shop link to a purchase: 3%. Shop clicks per scan or fit view: 1.5.
- Revenue per scan: 1.5 × 3% × ₪18, about ₪0.80.
- A deep scan roughly breaks even on commission alone. Quick scans and the feed are almost all margin. That is why the free tier leads with quick scans and the feed, why deep scans are limited and cached, and why Pro exists.
- Israel is a smaller market than the US, so brand plans and direct deals with local brands matter more here than raw commission volume. At 300k monthly scans, about ₪240k a month in commission, before brand plans and Pro.

## Growth in Israel

1. **WhatsApp.** Israelis share everything on WhatsApp. Fits, scan results and wish lists go there in one tap, with every shop link, and "שאלו חברים" asks friends whether to buy. Every forwarded message carries the FitSource address.
2. **Israeli fashion creators.** Invite Instagram and TikTok creators to post fits with sourced pieces and a commission share. They bring their audience, and a code-based deal is a model they already know.
3. **Hebrew "where to buy" pages.** Each sourced product can become a public page ("איפה קונים את ז'קט הבומבר מהסרטון"). There is little Hebrew content for these searches.
4. **Sold-out moments.** Restock alerts bring people back when they are most likely to buy.
5. **Deal channels.** Telegram and WhatsApp deal groups are big in Israel. A weekly "sold out and back" or "the viral fit for less" post feeds them.

## Features to build next

- Share target (PWA share target on Android, an iOS shortcut): send a screenshot straight from Instagram or TikTok.
- Paste an Instagram or TikTok link; the worker fetches the image.
- Deliver the price-drop and size alerts by push, WhatsApp or email, not only on the next visit (needs accounts, opt-in and a scheduled worker).
- Israeli shop coverage: confirm Yad2 Market's search URL (it currently opens the clothing section) and add Factory 54, Fox, Adika and H&M Israel once their search links are checked in a browser.
- English or Arabic as a second language. The layout is already direction-aware.

## Before launch (not legal advice)

- **Accessibility statement:** Israeli accessibility regulations (Equal Rights for Persons with Disabilities regulations, standard IS 5568) require one. It is on the Privacy, disclosure and accessibility page. Before launch, set `contactEmail` so it names a real contact, and run an accessibility audit.
- **Affiliate and sponsorship disclosure:** keep the disclosure in the footer and on the privacy page. Mark sponsored placements, and make sure creators mark paid posts as advertising, as Israeli consumer protection rules require.
- **Privacy:** the site collects no personal details today. Adding accounts, alerts or analytics brings in the Privacy Protection Law (including Amendment 13). Update the privacy page, and check its registration and data-security requirements before storing personal data.
- **Marketing messages:** push, WhatsApp, SMS or email alerts need explicit opt-in under Israel's anti-spam law (section 30A of the Communications Law).
- **Photo rights:** feed photos must be owned or licensed by FitSource, or posted by their owners. Uploaded scans are not stored.
- **Trademarks:** show brand names as facts ("sold at"). Never imply a brand endorses FitSource unless it is on a brand plan.
