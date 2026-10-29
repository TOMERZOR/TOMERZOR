// Guess The Distance: where the game server lives. The deploy workflow writes
// the Cloudflare Worker's address here. Empty = use the server that serves
// this page (local Node server or the Worker itself), or play offline.
window.GTD_CONFIG = {
  server: "https://guess-the-distance.moffy-app.workers.dev",
};
