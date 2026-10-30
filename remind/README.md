# Remind.

A medicine reminder for every morning, noon and evening. Hebrew, Apple-style, installable on the phone's home screen (PWA). Static site, no build step.

Live (after merging): https://tomerzor.github.io/TOMERZOR/remind/

```
npx http-server -p 8791 -c-1 .     # from the repo root, then open http://localhost:8791/remind/
```

## What it does

- **Onboarding:** name, the usual morning/noon/evening times, how often to repeat a reminder, text size, the first medicines, notifications. On an iPhone in Safari it first shows how to add Remind. to the home screen (notifications only work from there, and the home-screen app keeps its own data).
- **Today:** progress ring, the next dose, a week strip, a heads-up 1–3 days before a monthly or one-date medicine, and the doses grouped by time. A dose is marked with its round checkbox **only after taking it**: marking more than 30 minutes early asks first, unmarking asks first, every mark shows the time it was taken and has an undo. Past days can be marked late; future days can't be marked.
- **Medicines:** name, type (tablet, capsule, syrup, drops, inhaler, injection), color, dose, how often (every day, chosen weekdays, once a month on a day of the month, or one date only; the 31st falls on the last day of shorter months), times (morning/noon/evening, or any time), before/with/after food, notes, an optional stock count that goes down with each mark and warns when about a week is left, and an optional end date for a course.
- **History:** full-day streak, adherence for 7 and 30 days, a month calendar with a ring per day, and the doses of any day.
- **Profile:** the times of day, repeat interval, notifications (with a test), text size, light/dark, a family contact and a one-tap WhatsApp summary of today, backup to a file, restore, delete everything.

Everything is stored on the phone (localStorage). Fonts: Heebo (Hebrew) and Plus Jakarta Sans (Latin and digits), self-hosted from `fonts/` (SIL OFL).

## Reminders when the app is closed (`server/`)

A web page can't schedule a notification for later, so a small Cloudflare Worker sends each reminder as a Web Push at its time. One Durable Object per phone holds the push subscription, the time zone and the dose times, and sets an alarm for the next dose. If a dose isn't marked, it repeats every N minutes (the user's choice) for up to two hours.

The server gets only times and random dose ids, never medicine names. The service worker (`sw.js`) fills in the names from a copy of the data on the phone when the notification arrives. Pushes are encrypted for the phone (RFC 8291) and signed with a key the server makes per phone (VAPID).

- Deploy: `.github/workflows/remind-push.yml` runs on pushes to `remind/server/` on the main branch (needs the `CLOUDFLARE_API_TOKEN` secret, already used by Shomer), then writes the address into `js/config.js`.
- Tests: `cd remind/server && npm test` (time zones and DST, repeats, weekdays, start/end dates, input checks, payload layout).

While Remind. is open, it also shows an in-app banner when a dose time arrives.

Bump `VERSION` in `sw.js` whenever a file changes, and `APP_VERSION` in `js/app.js` (shown in the profile). The app checks for a new version every time it comes back to the screen (an iPhone home-screen app is usually resumed, not relaunched) and reloads into it by itself, keeping all data.
