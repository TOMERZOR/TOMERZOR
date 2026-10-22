# SHARD for iPhone and Android

The game itself lives in `../shard` (HTML, CSS and JavaScript, no build step). This folder wraps it in a real iOS and Android app with [Capacitor](https://capacitorjs.com), along with:

- Haptics (`@capacitor/haptics`)
- Ads: rewarded and interstitial (`@capacitor-community/admob`) including the GDPR consent form and Apple's tracking prompt (ATT)
- In-app purchases through RevenueCat (`@revenuecat/purchases-capacitor`)
- A store review request (`@capacitor-community/in-app-review`), the Android back button (`@capacitor/app`) and a hidden status bar

The Xcode project (`ios/App/App.xcodeproj`) and the Android Studio project (`android/`) are already here and configured: portrait only, full screen, icons, a splash screen, the AdMob test IDs, and the permissions.

## Every time you change something in the game

```bash
cd shard-app
npm install          # once
npm run sync         # copies ../shard into www and syncs to both platforms
npm run open:ios     # opens Xcode
npm run open:android # opens Android Studio
```

## iPhone: install on a device (needs a Mac with Xcode 16 or later)

1. `npm install`, then `npm run sync:ios`, then `npm run open:ios`.
2. In Xcode, select `App` → **Signing & Capabilities** → check **Automatically manage signing** and pick your **Team**.
3. If the Bundle Identifier is taken, change `com.tomerzor.shard` to something unique (and also in `capacitor.config.ts`).
4. Connect the iPhone, select it at the top, and press **Run** (⌘R).
5. The first time: on the iPhone, go to Settings → General → VPN & Device Management → Trust.

## Android: install on a device

1. Install [Android Studio](https://developer.android.com/studio).
2. `npm install`, then `npm run sync:android`, then `npm run open:android`.
3. Turn on Developer options and USB debugging on the phone, connect it, and press Run.
4. For a store build: **Build → Generate Signed App Bundle** (an `.aab` file) with a new keystore. Back up the keystore in a safe place: without it you cannot release updates.

## Before release: replace the test IDs with real ones

**Everything is in one file: `../shard/js/monetization.js` → `CONFIG`.**

### AdMob (ads)
1. Create an account at [admob.google.com](https://admob.google.com) and add two apps (iOS and Android).
2. In each app create two ad units: **Rewarded** and **Interstitial**.
3. Replace in `CONFIG.admob` the four ad unit IDs (`ca-app-pub-XXXX/YYYY`).
4. Replace the **App ID** (`ca-app-pub-XXXX~ZZZZ`) in two places:
   - iOS: `ios/App/App/Info.plist` → `GADApplicationIdentifier`
   - Android: `android/app/src/main/AndroidManifest.xml` → `com.google.android.gms.ads.APPLICATION_ID`
5. In AdMob → Privacy & messaging, create a **GDPR** message (the game already shows it automatically) and an **IDFA explainer** for iOS.
6. Upload `app-ads.txt` to your developer website (AdMob shows the line to add).

### In-app purchases (RevenueCat)
1. In App Store Connect and Google Play Console, create the products with exactly these IDs:

| ID | Type | Price |
|---|---|---|
| `shard_noads` | Non-consumable | $3.99 |
| `shard_starter` | Non-consumable | $4.99 |
| `shard_prism` | Non-consumable | $1.99 |
| `shard_coins_s` | Consumable | $0.99 |
| `shard_coins_m` | Consumable | $2.99 |
| `shard_coins_l` | Consumable | $7.99 |

2. Create a free account at [revenuecat.com](https://www.revenuecat.com), add the iOS and Android apps, and import the products.
3. Create three **Entitlements**: `no_ads` (attach `shard_noads` and `shard_starter`), `aurora` (attach `shard_starter`), and `prism` (attach `shard_prism`). This is what lets "Restore purchases" work on a new device.
4. Put the public API keys in `CONFIG.revenuecat` (`appl_...` and `goog_...`).

## What's inside

```
shard-app/
  capacitor.config.ts   app ID com.tomerzor.shard, name SHARD, background color
  sync.mjs              copies ../shard to www without the dev tools
  ios/                  Xcode project (SPM, no CocoaPods needed)
  android/              Android Studio project (minSdk 24, targetSdk 36)
```
