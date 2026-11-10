// Where the online rooms live. The deploy workflow (.github/workflows/shchuna-d-server.yml)
// writes the Cloudflare Worker's address here. A copy of the game served by the room server
// itself always talks to its own origin.
export const NET = {
  server: "https://shchuna-d.moffy-app.workers.dev",
};
