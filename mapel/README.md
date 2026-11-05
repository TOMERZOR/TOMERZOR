# מפל for you

A company commander's attendance board (מ״פ): where every soldier is on every day of the coming weeks, who is present at which site (נוכחות; over a weekend, Thursday to Saturday, it's a closing, סגירה), gimels, medical referrals, leave and constraints, and the whole board as an Excel file. Hebrew, Apple-style, light and dark, installable on the phone's home screen (PWA). Static site, no build step, works offline.

Live: https://mapel.moffy-app.workers.dev (every push to the branch `claude/mapel-for-you-app-5tqv5y` deploys it, by `.github/workflows/mapel-site.yml`; no merge needed). After a merge it is also at https://tomerzor.github.io/TOMERZOR/mapel/

```
npx http-server -p 8795 -c-1 .     # from the repo root, then open http://localhost:8795/mapel/
```

## What it does

- **עכשיו (Now):** where everyone is right now, or at any day and hour you pick: a tile per site (how many are there out of how many it needs), then the soldiers grouped by site, gimels, referrals (only while the referral is going on), leave, course and home. On top, what needs attention in the period: sites that are short, and soldiers who were put to close on a day they have a constraint.
- **לוח (Board):** soldiers by platoon × days (a week, two weeks or a month; move by week). Each cell shows the site or status, its hours, a referral badge and a constraint mark. Closing days are dark (light in dark mode) with a dot in the site's color, so it's easy to see who closes; weekday presence is a light tint of the site's color. The Excel board does the same. Tap a cell to set the day in one tap (a site or home) or to add a gimel, referral, leave, course, constraint or anything else for several days and with hours. Press and hold a cell (or the select button) to select many cells, whole rows (tap a name) or whole columns (tap a day), and set them all at once. A totals row shows how many are present each day out of the soldiers shown ("9/12 נוכחים"), in red when a site is short.
- **אתרים (Sites):** add the sites to close at (name, color, soldiers needed per day, a different number for Friday–Saturday, hours). A coverage grid of site × day; tap a cell to see who's there, take someone out, or add one of the free soldiers. **Automatic scheduling** fills every site from the soldiers who are free that day: nobody on gimels/leave/course/home is used, a soldier with a constraint only if there's nobody else, closings come in blocks of up to N days in a row with at least M days at home in between (both adjustable), and the load is balanced. What you entered by hand is never changed, and a new run replaces only the previous automatic one. Undo is in the toast.
- **חיילים (Soldiers):** add one, or paste a whole list (one per line, or `name, personal number, role, phone`). Each soldier has a page with the days strip, totals, constraints and every event.
- **Excel export** (button on the board, or settings), in two versions: **for a computer**, real Excel right-to-left sheets with the names column frozen; **for a phone** (WhatsApp, the iPhone preview and Numbers ignore Excel's right-to-left setting), the columns are written in reverse so it still reads right to left. The version for the device you're on is offered first. Four sheets: the full colored board with daily totals, who closes where (names per site per day, short days in red), soldiers with totals, and all referrals, gimels and constraints. On a phone it opens the share sheet (WhatsApp, Files, Mail).
- **Settings:** company name, period start and length, whether an empty day shows as "home", backup to a file and restore, a sample company to try it with, delete everything.

Everything is stored on the phone (localStorage); nothing is sent anywhere. Fonts: Heebo and Plus Jakarta Sans, self-hosted from `fonts/` (SIL OFL).

## Files

- `js/store.js`: the data (soldiers, sites, events), dates, and the rules: one full-day event per soldier per day (a new one cuts the old one out of those days), referrals and constraints sit on top.
- `js/schedule.js`: the automatic scheduling.
- `js/xlsx.js`: a small .xlsx writer (styles, merged cells, frozen panes, RTL) with no library; `js/export.js` builds the four sheets.
- `js/app.js`: the screens; `js/ui.js`: sheets (stacking, swipe down to close), alerts, toasts.

Bump `VERSION` in `sw.js` whenever a file changes, and `APP_VERSION` in `js/app.js` (shown in settings).
