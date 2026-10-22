// Copies the web game from ../shard into www/ (without dev tools) for the native build.
import { cpSync, rmSync, mkdirSync } from "node:fs";
rmSync("www", { recursive: true, force: true });
mkdirSync("www");
cpSync("../shard", "www", {
  recursive: true,
  filter: (p) => !/\/shard\/tools(\/|$)/.test(p) && !p.endsWith(".map"),
});
console.log("www/ ready");
