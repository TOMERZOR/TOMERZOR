// Used by the deploy workflow: finds the KOLI_KV namespace on the
// Cloudflare account (creating it the first time) and binds it in
// wrangler.toml, so conversations and settings persist without anyone
// pasting an id. Needs CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID when
// the token reaches several accounts).
//   node tools/ensure-kv.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TITLE = "KOLI_KV";
const here = path.dirname(fileURLToPath(import.meta.url));
const toml = path.join(here, "../wrangler.toml");
const wrangler = (...args) => execFileSync("npx", ["--no-install", "wrangler", ...args], { cwd: path.join(here, ".."), encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

function findId() {
  const out = wrangler("kv", "namespace", "list");
  const list = JSON.parse(out.slice(out.indexOf("[")));
  return (list.find((n) => n.title === TITLE) || {}).id || null;
}

let config = fs.readFileSync(toml, "utf8");
if (/^\[\[kv_namespaces\]\]/m.test(config)) {
  console.log("wrangler.toml already binds a KV namespace");
  process.exit(0);
}
let id = findId();
if (!id) {
  wrangler("kv", "namespace", "create", TITLE);
  id = findId();
}
if (!/^[0-9a-f]{32}$/.test(id || "")) throw new Error(`Could not find or create the ${TITLE} namespace`);
config += `\n[[kv_namespaces]]\nbinding = "KOLI_KV"\nid = "${id}"\n`;
fs.writeFileSync(toml, config);
console.log(`Bound KV namespace ${TITLE} (${id})`);
