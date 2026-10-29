# Guess The Distance: the working prompt (my checklist for this build)

Build a new web game called **Guess The Distance**. Do not stop until every box below is checked and verified in a real browser.

## The request, item by item
1. [ ] Concept: guess the **travel time** between two places: cities in Israel, cities in the world, and random places.
2. [ ] Use **real time, distance and routes**: real road routes (OSRM / FOSSGIS routing on OpenStreetMap) with the real drawn route on a map. If the live router is unreachable, fall back to a curated dataset of real-world values, never to made-up numbers.
3. [ ] Scoring like GeoGuessr: up to 5,000 points a round. The closer the guess (down to the minute), the more points. A 5-round game, max 25,000.
4. [ ] **1v1** against another person in real time (GeoGuessr Duels: health bars, damage = score gap × a growing multiplier, a countdown once the first player locks in). Random matchmaking plus a private room with a code / invite link.
5. [ ] Copy GeoGuessr's single-player modes: Classic (5 rounds), Daily Challenge (same rounds for everyone today), Streak (keep going while you stay within range), Time Attack (timed rounds), and Challenge a Friend (share a link with the same rounds).
6. [ ] The name everywhere: "Guess The Distance".
7. [ ] Apple-style UI: Liquid Glass surfaces, SF-style type, vibrant gradient cards (like the reference shots), large titles, a native iOS wheel time picker, springs. Use the design skills (apple-design, design-motion-principles).
8. [ ] Fun, satisfying animations: number count-ups, a route drawing itself on the map, confetti on perfect guesses, health bars draining, haptic-style feedback.
9. [ ] Built for a server: a Cloudflare Worker + Durable Object (realtime WebSockets, matchmaking, server-authoritative rounds and scoring, route cache), deployed by a GitHub Action like the other projects, plus a Node server for local play and tests. Solo modes still work as a static page.
10. [ ] Music and sound effects, generated live with the Web Audio API: a calm background loop, clicks on the wheel, lock-in, the reveal, points ticking, perfect, damage, win, lose. Mute buttons for each.
11. [ ] Everything smooth and clean: no console errors, 60fps animations, reconnect after a dropped connection, works on a phone and a desktop, Hebrew (RTL) with an English toggle.
12. [ ] Work in a loop until it is finished: test, take screenshots, fix, repeat.
13. [ ] Ask the user when a decision is really theirs.

## Done means
- Unit tests pass (scoring, rounds, duel rules, routing with a mock router).
- Two real browsers play a full 1v1 duel against the local server.
- Every solo mode plays from start to finish.
- Screenshots on a phone size and a desktop size look polished.
- README explains how to run it and how the server is deployed.
- Committed and pushed to the branch.
