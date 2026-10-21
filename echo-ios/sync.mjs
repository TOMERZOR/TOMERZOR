// Copies the web game from ../echo into www/ and points it at the live server
// for the shared daily board. The game itself runs offline from the bundle.
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
const SERVER = process.env.ECHO_SERVER || "echo-loop.higgsfield.app";
rmSync("www", { recursive: true, force: true });
mkdirSync("www");
cpSync("../echo", "www", { recursive: true, filter: (p) => !p.includes("/design") });
const html = readFileSync("www/index.html", "utf8")
  .replace('<script type="module" src="client.js"></script>',
    `<script>window.ECHO_SERVER = ${JSON.stringify(SERVER)};</script>\n  <script type="module" src="client.js"></script>`);
writeFileSync("www/index.html", html);
console.log("www/ ready, server =", SERVER);
