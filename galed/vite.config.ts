import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { privacy, terms, LEGAL_UPDATED, SUPPORT_EMAIL, type LegalDoc } from "./src/legal";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function legalPage(doc: LegalDoc, other: { href: string; title: string }) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(doc.title)} · גלעד</title>
<style>
  :root { --paper: #eee6d3; --ink: #161a35; --ink-2: #4b4c63; --ultra: #2b44c4; --flame: #ff6b1a; color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root { --paper: #0f1330; --ink: #efe7d4; --ink-2: #b9b4c8; --ultra: #7d91ff; color-scheme: dark; } }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.65 "IBM Plex Sans Hebrew", "Segoe UI", Arial, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 40px max(16px, env(safe-area-inset-left)) 64px; }
  h1 { margin: 0 0 6px; font-size: 40px; line-height: 1.1; color: var(--ultra); text-shadow: 2px 1.5px 0 color-mix(in srgb, var(--flame) 70%, transparent); }
  h2 { margin: 28px 0 6px; font-size: 20px; }
  p { margin: 0 0 8px; color: var(--ink-2); }
  .meta { font-size: 13px; color: var(--ink-2); }
  a { color: var(--ultra); }
</style>
</head>
<body>
<main>
<h1>${esc(doc.title)}</h1>
<p class="meta">גלעד · עודכן ${LEGAL_UPDATED} · <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> · <a href="${other.href}">${esc(other.title)}</a></p>
<p>${esc(doc.intro)}</p>
${doc.sections.map((s) => `<h2>${esc(s.h)}</h2>\n${s.p.map((p) => `<p>${esc(p)}</p>`).join("\n")}`).join("\n")}
</main>
</body>
</html>
`;
}

/** Writes terms.html and privacy.html next to the app, for the store listings. */
const legalPages = (): Plugin => ({
  name: "galed-legal-pages",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "terms.html", source: legalPage(terms, { href: "privacy.html", title: privacy.title }) });
    this.emitFile({ type: "asset", fileName: "privacy.html", source: legalPage(privacy, { href: "terms.html", title: terms.title }) });
  },
});

export default defineConfig({
  plugins: [react(), legalPages()],
  base: "./",
});
