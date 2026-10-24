# FitSource business model (Israel)

FitSource is a Hebrew, right-to-left site for Israeli shoppers. It is free to use. It makes money when the people it sends to shops buy something, and from brands that want to see and meet that demand. Every number below is an assumption to test, not a measurement. Prices are in shekels (₪), at roughly ₪3.7 to the dollar.

## Why Israel

Apps that source outfits from screenshots already exist abroad, but none is built for Israel. Here, people find fits on Instagram and TikTok, then buy from local chains (Terminal X, Castro, Fox, Factory 54, Next) or order from abroad (AliExpress, Shein, ASOS). FitSource covers both: it searches in Hebrew at Israeli shops and in English at the international ones, and its deep scan prefers stores that sell in Israel or ship there.

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
- **Deep scan:** Claude reads the photo, searches the web in Hebrew and English, and reads product pages. With Claude Opus 5.5 ($4 per million input tokens, $20 per million output) plus web search, expect about $0.15 to $0.40 a scan (₪0.55 to ₪1.50), depending on how many searches it runs. Measure it on your own traffic before setting limits; the worker logs usage. Ways to cut the cost:
  - Results are cached for 24 hours by image fingerprint, so a viral photo is paid for once.
  - `DAILY_SCAN_LIMIT` caps free deep scans per visitor (default 8).
  - `MAX_SEARCHES` and `MAX_FETCHES` cap the work per scan.
  - `FITSOURCE_MODEL` can be switched to `claude-sonnet-5-5` ($2 / $10), at some cost in accuracy. Test it on real photos first.

## Rough unit economics (assumptions)

- Average fashion order: ₪300. Blended commission: 6%, which is ₪18 per order.
- Clicks from a shop link to a purchase: 3%. Shop clicks per scan or fit view: 1.5.
- Revenue per scan: 1.5 × 3% × ₪18, about ₪0.80.
- A deep scan roughly breaks even on commission alone. Quick scans and the feed are almost all margin. That is why the free tier leads with quick scans and the feed, why deep scans are limited and cached, and why Pro exists.
- Israel is a smaller market than the US, so brand plans and direct deals with local brands matter more here than raw commission volume. At 300k monthly scans, about ₪240k a month in commission, before brand plans and Pro.

## Growth in Israel

1. **WhatsApp.** Israelis share everything on WhatsApp. The fit receipt (a story-sized image with every piece, price and "sold out" stamp) is made to be forwarded. A one-tap WhatsApp share is the next thing to build.
2. **Israeli fashion creators.** Invite Instagram and TikTok creators to post fits with sourced pieces and a commission share. They bring their audience, and a code-based deal is a model they already know.
3. **Hebrew "where to buy" pages.** Each sourced product can become a public page ("איפה קונים את ז'קט הבומבר מהסרטון"). There is little Hebrew content for these searches.
4. **Sold-out moments.** Restock alerts bring people back when they are most likely to buy.
5. **Deal channels.** Telegram and WhatsApp deal groups are big in Israel. A weekly "sold out and back" or "the viral fit for less" post feeds them.

## Features to build next

- Share to WhatsApp from the receipt and fit pages.
- Share target (PWA share target on Android, an iOS shortcut): send a screenshot straight from Instagram or TikTok.
- Paste an Instagram or TikTok link; the worker fetches the image.
- Restock and price-drop alerts by push, WhatsApp or email (needs accounts and a scheduled worker).
- Size-aware alerts ("tell me when the M is back").
- Israeli shop coverage: confirm Yad2 Market's search URL (it currently opens the clothing section) and add Factory 54, Fox, Adika and H&M Israel once their search links are checked in a browser.
- English or Arabic as a second language. The layout is already direction-aware.

## Before launch (not legal advice)

- **Accessibility statement:** Israeli accessibility regulations (Equal Rights for Persons with Disabilities regulations, standard IS 5568) require one. It is on the Privacy, disclosure and accessibility page. Before launch, set `contactEmail` so it names a real contact, and run an accessibility audit.
- **Affiliate and sponsorship disclosure:** keep the disclosure in the footer and on the privacy page. Mark sponsored placements, and make sure creators mark paid posts as advertising, as Israeli consumer protection rules require.
- **Privacy:** the site collects no personal details today. Adding accounts, alerts or analytics brings in the Privacy Protection Law (including Amendment 13). Update the privacy page, and check its registration and data-security requirements before storing personal data.
- **Marketing messages:** push, WhatsApp, SMS or email alerts need explicit opt-in under Israel's anti-spam law (section 30A of the Communications Law).
- **Photo rights:** feed photos must be owned or licensed by FitSource, or posted by their owners. Uploaded scans are not stored.
- **Trademarks:** show brand names as facts ("sold at"). Never imply a brand endorses FitSource unless it is on a brand plan.
