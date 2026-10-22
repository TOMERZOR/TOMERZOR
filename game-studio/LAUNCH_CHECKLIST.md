# SHARD launch checklist

Everything in the code is ready. These are the steps only you can do, because they need your accounts, payments or signature.

## 1. Accounts (once)
- [ ] **Apple Developer Program** ($99/year): developer.apple.com/programs
- [ ] **Google Play Console** ($25 one time): play.google.com/console
- [ ] **AdMob** (free): admob.google.com. Add an iOS app and an Android app.
- [ ] **RevenueCat** (free up to $2.5K/month in revenue): revenuecat.com
- [ ] **A support email and domain.** The privacy policy, terms and support page use `support@shardgame.app` as a placeholder. Replace it with your real address in:
  `shard/privacy.html`, `shard/terms.html`, `shard-site/support.html`

## 2. Replace placeholders (one file plus two native ones)
| What | Where |
|---|---|
| 4 AdMob ad unit IDs | `shard/js/monetization.js` → `CONFIG.admob` |
| AdMob App ID, iOS | `shard-app/ios/App/App/Info.plist` → `GADApplicationIdentifier` |
| AdMob App ID, Android | `shard-app/android/app/src/main/AndroidManifest.xml` |
| RevenueCat keys | `shard/js/monetization.js` → `CONFIG.revenuecat` |
| Publisher ID | `shard-site/app-ads.txt` |
| App Store ID (after creating the app) | `shard-site/index.html` → `apple-itunes-app` and the badge links |

## 3. Products in the stores
Create the 6 products exactly as listed in `shard-app/README.md` (IDs `shard_noads`, `shard_starter`, `shard_prism`, `shard_coins_s/m/l`), and in RevenueCat the 3 entitlements `no_ads`, `aurora`, `prism`.

## 4. Build
- iOS: `cd shard-app && npm install && npm run sync:ios && npm run open:ios` → in Xcode: Signing → Product › Archive → Distribute → App Store Connect.
- Android: `npm run sync:android && npm run open:android` → Build › Generate Signed App Bundle → upload the `.aab`.

## 5. Store pages
- Version 1.0 is declared for iPhone only (`TARGETED_DEVICE_FAMILY = 1`), so App Store Connect doesn't require iPad screenshots. iPads still run it in compatibility mode. To support iPad properly later, change it to `1,2` and add 13" screenshots.
- All the copy (title, subtitle, keywords, description, privacy labels) is in `game-studio/store/STORE_LISTING.md`.
- Store screenshots: `game-studio/store/screenshots/`.
- Promo video (App Preview / TikTok): `game-studio/store/trailer.mp4`.
- Icon: `game-studio/store/icon-1024.png`.
- Privacy policy URL: host `shard/privacy.html` (or the whole `shard-site/` folder) on any static host, for example GitHub Pages, Netlify or Cloudflare Pages.

## 6. Recommended soft launch (2–4 weeks)
1. Release in 2–3 small English-speaking markets first (for example Canada, Australia, New Zealand).
2. Targets: D1 retention ≥ 40%, D7 ≥ 15%, average session ≥ 8 minutes, rating ≥ 4.5.
3. If D1 is low: shorten the first levels (move up the easy ones). If D7 is low: strengthen the daily puzzle (bigger streak reward).
4. Then a global launch with the TikTok/Reels videos (5 hooks are ready in STORE_LISTING.md).

## 7. Recommended for v1.1
- Analytics (Firebase or GameAnalytics). The hook is ready in `shard/js/analytics.js` → `setSink`.
- More levels: run `node shard/tools/gen-levels.mjs` and every new level arrives solver-verified.
- Hebrew and other languages (the copy is concentrated in `main.js` and `index.html`).
