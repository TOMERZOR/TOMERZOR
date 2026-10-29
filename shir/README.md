# נחש את השיר (Guess the Song)

A party game in Hebrew: each round shows a funny, very literal cartoon of a hit song's title, Israeli or English, and you type the song's name. Static site, no build step:

```
npx http-server -p 8770 -c-1 .     # from the repo root, then open http://localhost:8770/shir/
```

Live: https://tomerzor.github.io/TOMERZOR/shir/

## Modes

Pick the songs on the home screen: עברית, English or הכול (remembered in the browser).

- **משחק יחיד (solo):** 10 pictures, 60 seconds each. Type the song's title into the letter slots under the picture with the on-screen keyboard (Hebrew or English, following the title's letters; a physical keyboard works too). Digits and punctuation are filled in for you, and final letters count as their regular form (ם = מ). A wrong guess flashes red and clears. Points for speed (100 to 200), +50 from a streak of three. 🏳️ ויתור skips the picture. Best score is kept in the browser.
- **מצב מסיבה (party):** two named teams share one screen. Everyone shouts, someone taps חשיפה, then taps which team got it. 10 to 30 pictures.

Hints, in both modes:
- **גלה אות:** fills one random letter of the title. Tap again for another; the last letter always stays hidden. Each letter costs 15% of the round's points in solo.
- **מי שר?:** shows the singer on the picture. Costs 40% in solo.

A right answer keeps at least 20% of its points however many hints were used.

Pictures not seen yet come first, so repeat players keep getting new ones (kept in localStorage).

## The songs

`js/songs.js` holds 200 hits from roughly 2024 to 2026:

- **100 in Hebrew**, gathered from the Galgalatz and mako Hitlist year-end charts, Media Forest and ACUM airplay summaries, and Spotify Israel charts (via kworb.net). Songs about the war, the hostages and the Nova festival were left out on purpose.
- **100 in English** (`lang: "en"`), from the Billboard Hot 100 and Year-End charts, UK Official Chart number ones and Spotify's yearly lists, including the big 2026 hits.

Each song was checked against at least one source that ties the title to the singer. A few are older but were still big in this period. The picture illustrates the song's title. `answer` is what the player types when the title has a long bracketed tail ("A Bar Song" for "A Bar Song (Tipsy)"). `line` (a quoted lyric shown on the answer card) is set only where a lyric was confirmed in a source.

Pictures are `img/s/<id>.webp` (720px), cartoons generated with Higgsfield (GPT Image 2.5). To add a song, add a row to `js/songs.js` and a matching square picture with no writing in it.
