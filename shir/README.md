# נחש את השיר (Guess the Song)

A Hebrew party game: each round shows a funny, very literal cartoon of a hit Israeli song's title, and you guess the song. Static site, no build step:

```
npx http-server -p 8770 -c-1 .     # from the repo root, then open http://localhost:8770/shir/
```

Live: https://tomerzor.github.io/TOMERZOR/shir/

## Modes

- **משחק יחיד (solo):** 10 pictures, 4 song titles to choose from, 20 seconds each. Points for speed (100 to 200), +50 from a streak of three, half points after the hint (the singer's name). Best score is kept in the browser.
- **מצב מסיבה (party):** two named teams share one screen. Everyone shouts, someone taps חשיפה, then taps which team got it. 10 to 30 pictures.

Pictures not seen yet come first, so repeat players keep getting new ones (kept in localStorage).

## The songs

`js/songs.js` holds 100 Hebrew hits from roughly 2024 to 2026, gathered from the Galgalatz and mako Hitlist year-end charts, Media Forest and ACUM airplay summaries, and Spotify Israel charts (via kworb.net). Each song was checked against at least one source that ties the title to the singer. A few are older but were still big in this period.

The picture illustrates the song's title. `line` (a quoted lyric shown on the answer card) is set only where a lyric was confirmed in a source. Songs about the war, the hostages and the Nova festival were left out on purpose.

Pictures are `img/s/<id>.webp` (720px), cartoons generated with Higgsfield (GPT Image 2.5). To add a song, add a row to `js/songs.js` and a matching square picture with no writing in it.
