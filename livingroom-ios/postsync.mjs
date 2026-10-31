// `cap sync` rewrites capacitor.config.json; this puts the app's own AR plugin back in its plugin
// list, so Capacitor loads it at start (in addition to LivingRoomViewController registering it).
import { readFileSync, writeFileSync } from "node:fs";
const file = "ios/App/App/capacitor.config.json";
const cfg = JSON.parse(readFileSync(file, "utf8"));
cfg.packageClassList = [...new Set([...(cfg.packageClassList || []), "ARQuickLookPlugin"])];
writeFileSync(file, JSON.stringify(cfg, null, "\t") + "\n");
console.log("plugins:", cfg.packageClassList.join(", "));
