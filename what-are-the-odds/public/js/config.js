// Where the API lives. The Worker serves the site and the API from one address,
// so on that address (and on localhost with `npm start`) the page uses its own origin.
// Anywhere else (GitHub Pages, a file) it calls this server.
window.ODDS_CONFIG = {
  server: "https://what-are-the-odds.moffy-app.workers.dev",
};
