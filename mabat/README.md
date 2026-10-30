# מבט (Mabat)

A market scanner that reads the charts all the time and says when to enter a stock, with alerts on the phone. Hebrew, Apple-style, installable on the home screen (PWA). Static site, no build step, plus a small Cloudflare Worker that does the scanning.

Live (after merging): https://tomerzor.github.io/TOMERZOR/mabat/

```
python3 -m http.server 8791        # from the repo root, then open http://localhost:8791/mabat/
```

Not financial advice: an entry signal is a chart condition, not a promise. Mabat never places an order.

## What it does

- **Today:** the S&P 500 and Nasdaq 100 with their trend, the stocks with an entry signal right now (entry price, stop, target and how many shares for your budget), the ones close to a trigger, and your watchlist.
- **Stock page:** the chart (1M to 1Y, touch to read any day, 20/50/200-day averages, volume, entry/stop/target lines), the verdict and score, how much to buy, every check behind the score (chart, SEC financials, fund holdings, news), headlines, filings and which funds hold it. "I entered" adds it to the portfolio with its stop and target.
- **Scanner:** every tracked stock sorted by score, filters (entry, near, watchlist, uptrend, avoid), and search for any US stock or ETF.
- **Portfolio:** open positions with P/L and where the price sits between stop and target, closed trades with realized gains split into short and long term, and a warning when one stock is over your cap.
- **Updates:** the alert feed, what well-known funds hold (13F) and what changed, and Congress trade reports (Pelosi is watched).
- **Alerts** (Web Push, also when the app is closed): new entry signals (all stocks above a minimum score, or only the watchlist), near a trigger, target 1, target 2 and exit signals of your positions, important 8-K filings for stocks you watch or hold, a new Pelosi report, and the opening bell.

Everything personal (budget, watchlist, positions, closed trades) stays on the phone (localStorage); the server gets the watchlist, the stops and targets, and the alert settings. Backup and restore are in Settings.

## How a signal is made (`server/signals.js`)

From the daily chart: trend (price against the 20/50/200-day averages, the 50-day slope), momentum (RSI 14, MACD, 3-month strength against the S&P 500), volume against its 20-day average (adjusted for how much of the session has passed), and six setups, each counted on the last bar or the one before:

| setup | condition |
| --- | --- |
| breakout | close above the 20-day high on 1.3× volume, above the 50-day average |
| pullback | in an uptrend, touched the 20/50-day average with RSI under 50, then closed above the previous high |
| MACD cross | MACD crosses its signal line, above the 200-day average |
| golden cross | the 50-day average crosses above the 200-day |
| oversold reversal | RSI back above 30 on a green candle |
| squeeze breakout | Bollinger bands at their narrowest in six months, then a close above the upper band |

The score (0 to 100) adds the SEC fundamentals rules (revenue growth, profitability, P/E), fund holdings, and takes off for a serious 8-K (restatement, delisting, bankruptcy, impairment, cyber incident), for a price that has run too far (RSI over 80 or 12% above the 20-day average), and in a weak market (S&P 500 under its 200-day average). **Enter** needs a setup and a score of 65 or more. **Near** is a stock in an uptrend within 3% of its 20-day high.

### Ready-made trade plans (`server/plans.js`, `js/playbook.js`)

Every signal comes with a plan for its setup: the entry (and the most to pay; a "near" stock gets a pending buy above its trigger), a stop placed by the setup's own logic (under the breakout level, under the pullback low, under the middle Bollinger band...), always 1 to 3 ATR and at most 12% under the entry, and two targets in multiples of the risk R:

| setup | target 1 | target 2 | trailing stop | early exit | time stop |
| --- | --- | --- | --- | --- | --- |
| breakout | 1.5R | 3R | 3 ATR | close back under the breakout level | 10 days |
| pullback | 1.5R | 3R | 3 ATR | close under the 50-day average | 15 days |
| MACD cross | 1.5R | 3R | 3 ATR | MACD under its signal two days running | 15 days |
| golden cross | 2R | 4R | 3.5 ATR | close under the 200-day average | 30 days |
| oversold reversal | 1.5R | 2.5R | 2 ATR | RSI above 70 (the bounce is done) | 7 days |
| squeeze breakout | 1.5R | 3R | 3 ATR | close under the 20-day average before target 1 | 10 days |

At target 1 half is sold and the stop moves to the entry; once the trade is 1R up the stop trails under the highest close and never moves down. "I entered" saves the plan with the position, and the server manages it from the bars (no stored state): alerts at target 1, target 2 and on any exit (stop, stop at entry, trailing stop, failed setup, time stop). A position added by hand gets the same defaults. The setups library (Today → "הסטאפים", or Settings) explains each plan in Hebrew.

How much to buy follows trader-budget and trader-risk: risk a set percent of the budget between entry and stop, never more than the per-stock cap, never into the cash buffer.

## The trader skills inside

| skill | in Mabat |
| --- | --- |
| trader-alerts | the NYSE clock and holidays, Yahoo chart prices with Stooq as a fallback, stop/target/opening-bell alerts that ring once |
| trader-analyst | SEC XBRL company concepts: quarterly revenue, net and operating income, diluted EPS, the derived fourth quarter, TTM |
| trader-screener | the fundamentals rules on the stock page and in the score |
| trader-news | Yahoo headline RSS and 8-K items from SEC submissions; serious items block an entry |
| trader-copycat | 13F-HR information tables of six funds, holdings and changes against the quarter before |
| trader-pelosi | the House Clerk's yearly disclosure index, new Periodic Transaction Reports |
| trader-budget, trader-risk | position size, per-stock cap, cash buffer |
| trader-rebalance | the over-the-cap warning in the portfolio |
| trader-tax | holding period, short and long term, realized gains per year |
| trader-broker | not connected: Mabat never places an order |

## The server (`server/`)

One Durable Object holds everything. A cron trigger wakes it every minute; it refreshes the 8 stocks whose data is oldest (every stock about every 6 minutes while the market is open, every 3 hours when it's closed), then runs up to two slower jobs: SEC ticker map, filings, headlines, fundamentals, 13F, Congress. Sources: Yahoo Finance chart JSON and headline RSS, Stooq CSV, SEC EDGAR (needs a name and email, entered once in Settings or set as the `SEC_USER_AGENT` secret), the House Clerk.

- Deploy: `.github/workflows/mabat-market.yml` runs on pushes to `mabat/server/` on the main branch (needs the `CLOUDFLARE_API_TOKEN` secret, already used by Shomer and Remind.), writes the address into `js/config.js`, and after four minutes reports whether prices are arriving.
- Tests: `cd mabat/server && npm test` (NYSE clock, indicators, every setup on synthetic charts, trade plans and position management, sizing, the Yahoo/Stooq/RSS/SEC/13F/House readers, the ZIP reader, device input checks).
- End to end without the internet: `node test/upstream.js 8799` (a stand-in for Yahoo, SEC, the House Clerk and Apple's push service, which decrypts the pushes it gets) and `npx wrangler dev --var DEV:1 --var UPSTREAM:http://127.0.0.1:8799`, then `curl -X POST localhost:8787/tick` and open the app with `?server=http://127.0.0.1:8787`.

Bump `VERSION` in `sw.js` whenever a file changes.
