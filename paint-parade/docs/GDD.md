# PAINT PARADE — Game Design Document

**Pitch (one line):** Tap cute paint buckets onto the parade belt — they march around a grey canvas and splash their color on every matching pixel they can see. Color the whole picture before your waiting spots fill up.

**Genre:** Hybrid-casual color-sort puzzle · **Platforms:** iOS, Android, Web (PWA) · **Orientation:** Portrait, one hand · **Session:** 60–150 s per level

## 1. Core rules
- The **canvas** is a grid of pixels. Each pixel has a target color (or is empty background). All pixels start **grey**.
- A **parade belt** runs around the canvas, counter-clockwise: along the bottom (looking up), up the right side (looking left), along the top (looking down), down the left side (looking right).
- **Buckets** wait in 2–4 **lanes** below the canvas. Tap the bucket at the front of a lane to put it on the belt.
- Each bucket has a **color** and a number = **paint shots**. At every step it looks straight into the canvas. If the first still-grey pixel in that line has the bucket's color, it splashes it (one shot). Grey pixels of other colors block the view; colored pixels and background don't.
- A bucket whose shots reach 0 pops (done!). A bucket that completes a full lap with paint left jumps into one of the **waiting spots** (5 by default). Tap a waiting bucket to send it around again.
- **Win:** every pixel is colored → the artwork comes alive and goes into your **Gallery**.
- **Lose:** a bucket finishes its lap and every waiting spot is full.
- The belt holds a limited number of buckets at once (shown as dots).
- By construction, the total shots of each color equals the pixels of that color (×2 for double-coat pixels). The level generator + a bot solver guarantee every shipped level is solvable.

## 2. Mechanics introduced over time (freshness)
| Level | New thing |
|---|---|
| 1 | One lane, two colors — the hand shows what to tap |
| 2–4 | Two lanes, waiting spots explained, 3 colors |
| 6 | First **HARD** level (more coins) |
| 9 | **Mystery bucket** (?) — color revealed when it reaches the front |
| 15 | **Double coat** pixels (striped) need two splashes |
| 22 | **Twin buckets** — linked pair, launch together |
| 30+ | Bigger canvases, 5–6 colors, fewer waiting spots on SUPER HARD |

## 3. Meta loop
- **Coins**: +20 per win (HARD +40, SUPER HARD +60), ×2 with a rewarded video.
- **Gallery**: every artwork is collected into themed albums (10 per album). Completing an album opens a chest (coins + boosters).
- **Win streak ("Hot Brush")**: 3 wins in a row → the next level starts with a free extra waiting spot. Losing resets it (loss aversion, like Royal Match / Block Blast streaks).
- **Daily Canvas**: one special level per day, seeded by date, +100 coins, streak counter.
- **Lives**: 5 hearts, one lost per fail, one regenerates every 20 min. Refill with coins or a rewarded video. (Lives only kick in from level 10 so the first session is frictionless.)

## 4. Boosters (consistent with shot accounting)
| Booster | Effect | Price |
|---|---|---|
| **+Spot** | One extra waiting spot this level | 150 coins |
| **Grabber** | Pick any bucket from anywhere in a lane | 200 coins |
| **Rainbow** | Adds a rainbow bucket (12 shots) that paints any color | 250 coins |
Unlocked at levels 7, 12 and 18 with a free sample each.

## 5. Monetization (hybrid IAA + IAP, modeled on Pixel Flow / Arrows)
- **Revive on fail**: "+2 waiting spots and keep going" — rewarded video (once per level) or 300 coins.
- **Rewarded**: ×2 coins on win, +1 life, free coins in shop (3/day), free booster when stuck.
- **Interstitial**: only after a **win**, only from level 12, at most one per 90 s, never right after a revive. Removed by No Ads.
- **IAP**: No Ads $6.99 · No Ads Bundle $9.99 (no ads + 1,500 coins + 3 of each booster) · Starter Pack $1.99 one-time (1,000 coins + 2 of each booster + 1 h unlimited lives) · coin packs $1.99–$49.99.
- Ads and IAP sit behind `Ads` / `IAP` interfaces. Web build uses a mock; native build plugs AdMob (or AppLovin MAX) and RevenueCat / StoreKit / Play Billing.

## 6. Feel ("juice") checklist
Bucket hop with squash & stretch · paint projectile arc · splat burst + droplet particles · pixel pop-in scale · combo pitch rising on consecutive splashes · bucket "empty" confetti pop · belt rolling texture · picture "comes alive" sweep + sparkle on win · coin fly-to-counter · gentle screen shake on fail · haptic tick on every splash (rate-limited) · sound for every action · mute / vibration toggles.

## 7. Difficulty curve
Saw-tooth: every 5th–6th level is HARD, every ~15th SUPER HARD, followed by 2 easy "breathers". Measured by bot simulation: solvable with the configured spots, peak spot usage and number of "wasted laps".

## 8. KPI targets (soft launch)
D1 ≥ 40% · D7 ≥ 15% · avg session ≥ 8 min · levels/day/DAU ≥ 12 · rewarded views/DAU ≥ 2 · ARPDAU ≥ $0.15 · IAP conversion ≥ 2%.

## 9. Analytics events
`level_start`, `level_win`, `level_fail`, `revive`, `booster_use`, `ad_rewarded`, `ad_interstitial`, `iap_purchase`, `daily_complete`, `album_complete`, `tutorial_step`.
