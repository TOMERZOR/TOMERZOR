// Copies the built game from ../echo-next/dist into www/ (what Capacitor
// bundles) and into ios/App/App/public (the copy checked into the Xcode
// project), so the app can be built on a Mac without running Vite first.
// Build the game before syncing:  cd ../echo-next && npm run build
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
const src = "../echo-next/dist";
if (!existsSync(src + "/index.html")) { console.error("build the game first: cd ../echo-next && npm install && npm run build"); process.exit(1); }
for (const dst of ["www", "ios/App/App/public"]) {
  rmSync(dst, { recursive: true, force: true }); mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(dst + "/ ready");
}
