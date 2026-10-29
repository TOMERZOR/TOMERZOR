# פריטה (Prita): learn guitar

A guitar teacher in your pocket, in Hebrew. A short daily practice that adjusts to you, from the first chord to fast solos. Static site, no build step:

```
npx http-server -p 8790 -c-1 .     # from the repo root, then open http://localhost:8790/prita/
```

Live: https://tomerzor.github.io/TOMERZOR/prita/

## What's in it

- **אימון (daily practice):** pick 10, 20, 30 or 45 minutes and press start. The app builds the session from your level: a warm-up, the next step on your path, one-minute chord changes, a review of something you already passed, and a song to finish. Every block has a timer, and after each tempo exercise you say whether it was hard, just right or too easy; the next session's metronome moves by -5, +2 or +5 BPM. A streak, the last 7 days and your records are on the same screen.
- **מסלול (path):** 8 levels and 40 steps, from holding the guitar to II-V-I jazz improvisation. Each step has how-to instructions and a clear goal. Goals that can be measured (changes per minute, clean BPM, notes per minute, ear-training streak) are checked automatically when you beat them; the rest you mark yourself. On first launch you choose how much you already play, and the earlier levels are skipped.
- **אקורדים (chords):** 47 chord diagrams with finger numbers (open, 7ths, barre, sus/add, power, jazz). Tap one to hear it. The one-minute changes trainer counts how many times you switch between two chords and keeps your record for each pair.
- **אימונים (trainers):**
  - Find the note: a one-minute game. Tap the note on the neck, or play it and the microphone checks it.
  - Ear training: intervals (4 levels) and chord types (3 levels).
  - Scales on the neck: 8 scales in any key, with the 5 pentatonic boxes, note names or degrees.
  - Jam: the app plays chords and bass for 7 progressions (pop, 12-bar blues, Andalusian, dorian, II-V-I) and suggests which scale to solo with.
  - Speed trainer: the chromatic 1-2-3-4 exercise with a metronome that speeds up by itself.
  - 7 strumming patterns, highlighted as they play.
- **כלים (tools):** a chromatic tuner from the microphone (standard, Drop D, half step down, Open G, with reference tones) and a metronome with tap tempo, beats per bar, subdivisions and a speed trainer.

## Design

A night-stage look taken from the instrument: rosewood, nickel strings and an amp-amber glow. Amber is kept for primary actions and things that are playing; green means in tune or correct.

- **Playable strings:** the home screen, the chord sheets and the first-run screen have six strings you can strum with a finger, with sound and vibrating strings.
- **Native-style navigation:** a floating glass tab bar, large titles that fold into a compact bar as you scroll, screens that push in with the previous one sliding aside, swipe from the right edge to go back, and chord details in a bottom sheet you pull down to close.
- **Tactile controls:** a rotary tempo knob that pulses on each beat, a BPM number you can drag sideways, iOS-style switches, a headstock-shaped tuner with pegs that light up when a string is in tune, and short vibrations on phones that support them.
- Type: Heebo for text, Karantina for Hebrew display titles, Barlow Condensed for numbers and chord names. Reduced motion, reduced transparency and increased contrast are respected.

Progress is kept only in the browser (localStorage). The microphone needs HTTPS (GitHub Pages is fine) and permission in the browser.

## Code

- `js/data.js`: chords, scales, strumming patterns, progressions and the 8-level path. To add a step, add a unit to a level in `PATH`.
- `js/audio.js`: a plucked-string synth (Karplus-Strong), the metronome scheduler, and YIN pitch detection for the tuner and the note game.
- `js/ui.js`: the playable strings, the tempo knob, progress rings, drag-to-scrub and haptics.
- `js/icons.js`: the stroke icon set.
- `js/app.js`: the screens, the practice activities and the daily session builder.
