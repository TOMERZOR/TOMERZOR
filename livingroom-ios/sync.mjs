// Copies the web app from ../livingroom into www/ (without the server and the service worker).
import { cpSync, rmSync, mkdirSync, readFileSync } from "node:fs";
rmSync("www", { recursive: true, force: true });
mkdirSync("www");
cpSync("../livingroom", "www", {
  recursive: true,
  filter: (p) => !/\/(server|README\.md|sw\.js)(\/|$)/.test(p),
});
const api = readFileSync("www/js/config.js", "utf8").match(/api: "([^"]*)"/)?.[1];
console.log("www/ ready, server =", api || "(none)");
